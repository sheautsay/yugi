import { EffectRule, MaterialInfo, SummonLock, effectRule, isExtraMonsterZone, isLinkCard, isMonsterSlot, linkMaterialIssues, parseEffectRef, pointedSlots } from './card-rules';
import { CardMove, CardRecord, ComboStep, FieldSlot, PlayZone } from './models';

// CR-006 partial rule check, run step by step inside the data check (route-check.ts). It only
// reports DEFINITE violations of the modelled rules (card-rules.ts); whatever it cannot decide is
// listed as "not verified". Passing it never makes a route legal or raises its trust level.

export interface FieldInstance {
  cardId: number;
  slot?: FieldSlot;
  fromExtra: boolean;
  normalSummoned: boolean;
  linkSummoned: boolean;
  /** Effects negated while face-up (Splash Mage). */
  negated: boolean;
  /** Summoned by Maliss <C> TB-11: its effects cannot be activated this turn. */
  cannotActivate: boolean;
  /** Effect refs used while this card stayed face-up on the field. */
  usedWhileFaceUp: string[];
  arrivedAt: number;
}

export interface BoardState {
  /** Monsters on the field when the route ends. */
  monsters: FieldInstance[];
  /** Spells/Traps on the field when the route ends. */
  backs: Array<{ cardId: number; slot?: FieldSlot }>;
  /** Every monster on the field had a zone throughout the route. */
  layoutKnown: boolean;
  /** Uses of each effect this turn. */
  used: Record<string, number>;
}

export interface RuleIssue {
  step?: number;
  message: string;
}

/** CR-008 G49-4 / G51: the state after one step — effects used this turn, standing restrictions, the board. */
export interface StepState {
  order: number;
  /** Effects used so far this turn, with how often. */
  used: Array<{ ref: string; count: number }>;
  /** Summon restrictions in force after this step (text, with the step and card that caused it). */
  locks: string[];
  board: { monsters: FieldInstance[]; backs: Array<{ cardId: number; slot?: FieldSlot }> };
}

export interface RuleReport {
  /** What the rule check looked at (for the record shown to the user). */
  checked: string[];
  /** Rules it could not decide for this route. */
  unverified: RuleIssue[];
  board: BoardState;
  /** One state per step, in order (CR-008). */
  steps: StepState[];
}

type Zones = Record<PlayZone, Map<number, number>>;

const ZONE_LABEL: Record<EffectRule['zone'], string> = { field: '場上', hand: '手牌', gy: '墓地', banished: '除外狀態', 'field-or-gy': '場上或墓地' };
const LOCK_TEXT: Record<SummonLock, string> = {
  'no-special-summon': '本回合不能再特殊召喚',
  'cyberse-only': '只能特殊召喚電子界族怪獸',
  'extra-link-only': '從額外牌組只能特殊召喚連結怪獸',
};

interface Lock {
  lock: SummonLock;
  step: number;
  source: number;
}

interface SpecialSummon {
  step: number;
  cardId: number;
  fromExtra: boolean;
  slot?: FieldSlot;
}

export class RuleTracker {
  private readonly monsters: FieldInstance[] = [];
  private readonly backs: Array<{ cardId: number; slot?: FieldSlot }> = [];
  private readonly used = new Map<string, number>();
  private readonly locks: Lock[] = [];
  private readonly wholeTurnLocks: Lock[] = [];
  private readonly summons: SpecialSummon[] = [];
  /** Material card → the Link Monster it was last used for. */
  private readonly materialFor = new Map<number, number>();
  private readonly unverified: RuleIssue[] = [];
  private readonly stepStates: StepState[] = [];
  private readonly noted = new Set<string>();
  private layoutKnown = true;
  private counts = { linkSummons: 0, placements: 0, effects: 0, specialSummons: 0 };

  private step?: ComboStep;
  private effect: EffectRule | null = null;
  private pointedForEffect: FieldSlot[] | null = null;
  private coLinked: number | null = null;
  private removed: FieldInstance[] = [];

  constructor(
    private readonly cards: ReadonlyMap<number, CardRecord>,
    private readonly name: (id: number) => string,
    private readonly violation: (message: string, step: number) => void,
  ) {}

  private q(id: number): string {
    return `「${this.name(id)}」`;
  }

  private fail(message: string): void {
    this.violation(`規則檢查：${message}`, this.step!.order);
  }

  private note(message: string, key = message, step = this.step?.order): void {
    if (this.noted.has(key)) return;
    this.noted.add(key);
    this.unverified.push(step === undefined ? { message } : { step, message });
  }

  private isMonster(cardId: number): boolean {
    return this.cards.get(cardId)?.kind === 'monster';
  }

  private onField(cardId: number): FieldInstance[] {
    return this.monsters.filter((m) => m.cardId === cardId);
  }

  /** Slots pointed to by your Link Monsters, or null when a Link Monster's zone or arrows are unknown. */
  private pointedByMine(): Set<FieldSlot> | null {
    const pointed = new Set<FieldSlot>();
    for (const m of this.monsters) {
      const card = this.cards.get(m.cardId);
      if (!isLinkCard(card)) continue;
      if (!m.slot || !card?.linkMarkers?.length) return null;
      pointedSlots(m.slot, card.linkMarkers).forEach((s) => pointed.add(s));
    }
    return pointed;
  }

  private pointedBy(instance: FieldInstance | undefined): FieldSlot[] | null {
    const markers = instance && this.cards.get(instance.cardId)?.linkMarkers;
    return instance?.slot && markers?.length && this.layoutKnown ? pointedSlots(instance.slot, markers) : null;
  }

  private coLinkedCount(instance: FieldInstance | undefined): number | null {
    const mine = this.pointedBy(instance);
    if (!instance || !mine) return null;
    let n = 0;
    for (const other of this.monsters) {
      if (other === instance || !other.slot || !mine.includes(other.slot)) continue;
      const theirs = this.pointedBy(other);
      if (theirs === null && isLinkCard(this.cards.get(other.cardId))) return null;
      if (theirs?.includes(instance.slot!)) n++;
    }
    return n;
  }

  beginStep(step: ComboStep, before: Zones): void {
    this.step = step;
    this.effect = null;
    this.pointedForEffect = null;
    this.coLinked = null;
    this.removed = [];
    if (!step.effectRef) return;

    const parsed = parseEffectRef(step.effectRef);
    const rule = parsed && effectRule(step.effectRef, this.cards);
    if (!parsed || !rule) {
      this.note(`使用的效果 ${step.effectRef}${parsed ? `（${this.q(parsed.cardId)}）` : ''}不在規則表，或卡片文字與規則表不符：未檢查次數、限制與條件`, `ref:${step.effectRef}`);
      return;
    }
    this.counts.effects++;
    this.effect = rule;
    const id = parsed.cardId;
    const who = `${this.q(id)}的效果（#${parsed.n}）`;
    if (!step.actorCardIds.includes(id)) this.note(`效果 ${step.effectRef} 的卡不是此步的執行卡`, `actor:${step.order}`);

    // Where the card is when the effect is activated.
    const moves = step.moves ?? [];
    const inZone = (zone: PlayZone) => (before[zone].get(id) ?? 0) > 0 || moves.some((m) => m.cardId === id && m.from === zone);
    const onFieldNow = this.onField(id).length > 0 || this.backs.some((b) => b.cardId === id) || moves.some((m) => m.cardId === id && m.to === 'field');
    const present = rule.zone === 'field' ? onFieldNow : rule.zone === 'field-or-gy' ? onFieldNow || inZone('gy') : inZone(rule.zone);
    if (!present) this.fail(`${who}發動時應在${ZONE_LABEL[rule.zone]}，但此步之前不在`);

    const instances = this.onField(id);
    if (rule.zone === 'field' && instances.length) {
      if (instances.every((i) => i.cannotActivate)) this.fail(`${this.q(id)}由「Maliss <C> TB-11」特殊召喚，本回合不能發動效果`);
      else if (instances.every((i) => i.negated)) this.fail(`${this.q(id)}的效果被「Splash Mage」無效，在場上不能發動效果`);
    }

    // Once per turn.
    const uses = this.used.get(rule.ref) ?? 0;
    if (rule.once === 'effect' && uses > 0) this.fail(`${who}每回合只能使用 1 次`);
    if (rule.once === 'name') {
      const prefix = `${id}#`;
      if ([...this.used].some(([ref, n]) => ref.startsWith(prefix) && n > 0)) this.fail(`${this.q(id)}每回合只能發動 1 次`);
    }
    if (rule.once === 'face-up' && (uses > 0 || instances.some((i) => i.usedWhileFaceUp.includes(rule.ref)))) this.fail(`${who}在場上表側期間只能使用 1 次`);

    // Activation conditions.
    if (rule.requires === 'cyberse-from-extra') {
      const fromExtra = this.monsters.filter((m) => m.fromExtra);
      if (fromExtra.some((m) => !this.cards.get(m.cardId)?.race)) this.note(`${who}的發動條件：場上怪獸的種族資料不足，無法確認`);
      else if (!fromExtra.some((m) => this.cards.get(m.cardId)?.race === 'Cyberse')) this.fail(`${who}需要控制從額外牌組特殊召喚的電子界族怪獸，此時場上沒有`);
    }
    if (rule.requires === 'material-for-cyberse-link-2300') {
      const target = this.cards.get(this.materialFor.get(id) ?? 0);
      if (!target || target.race !== 'Cyberse' || (target.atk ?? 0) < 2300) this.fail(`${who}需要此卡剛作為原本攻擊力 2300 以上的電子界族連結怪獸的素材送去墓地`);
    }
    if (rule.requires === 'link-summoned' && !instances.some((i) => i.linkSummoned)) this.fail(`${who}只在此卡連結召喚時發動`);
    if (rule.requires === 'summon-to-pointed-zone') {
      const self = instances[0];
      const pointed = this.pointedBy(self);
      if (!self || pointed === null) this.note(`${who}的發動條件（怪獸特殊召喚到它指向的格子）需要格子位置，無法驗證`);
      else if (!this.summons.some((s) => s.step >= self.arrivedAt && s.slot && pointed.includes(s.slot))) this.fail(`${who}需要有怪獸特殊召喚到它指向的格子（${pointed.join('、') || '無'}）`);
    }
    if (rule.placeInPointedZones) {
      this.pointedForEffect = this.pointedBy(instances[0]);
      if (this.pointedForEffect === null) this.note(`${who}只能把怪獸放到它指向的格子：格子位置不足，無法驗證`);
    }
    if (rule.returnsUpToCoLinked) {
      this.coLinked = this.coLinkedCount(instances[0]);
      if (this.coLinked === null) this.note(`${who}的返回數上限（相互連結數）需要格子位置，無法驗證`);
    }

    this.used.set(rule.ref, uses + 1);
    if (rule.once === 'face-up') instances[0]?.usedWhileFaceUp.push(rule.ref);
  }

  /** Called for every move the data check accepted. */
  move(m: CardMove): void {
    const step = this.step!;
    if (m.from === 'field') {
      const find = (pool: ReadonlyArray<{ cardId: number; slot?: FieldSlot }>) => {
        const i = pool.findIndex((x) => x.cardId === m.cardId && (!m.slot || x.slot === m.slot));
        return i >= 0 ? i : pool.findIndex((x) => x.cardId === m.cardId);
      };
      if (this.isMonster(m.cardId)) {
        const at = find(this.monsters);
        if (at >= 0) this.removed.push(...this.monsters.splice(at, 1));
      } else {
        const at = find(this.backs);
        if (at >= 0) this.backs.splice(at, 1);
      }
      return;
    }
    if (m.to !== 'field') return;
    const card = this.cards.get(m.cardId);
    if (!this.isMonster(m.cardId)) {
      if (m.slot && isMonsterSlot(m.slot)) this.fail(`${this.q(m.cardId)}不是怪獸，不能放在 ${m.slot}`);
      else if (m.slot && this.backs.some((b) => b.slot === m.slot)) this.fail(`${m.slot} 已經有卡片，不能再放${this.q(m.cardId)}`);
      this.backs.push({ cardId: m.cardId, ...(m.slot ? { slot: m.slot } : {}) });
      return;
    }

    const special = step.actionType !== 'normal-summon' && step.actionType !== 'set';
    const fromEffect = !!this.effect && special && m.cardId !== parseEffectRef(this.effect.ref)?.cardId;
    const instance: FieldInstance = {
      cardId: m.cardId,
      ...(m.slot ? { slot: m.slot } : {}),
      fromExtra: m.from === 'extra',
      normalSummoned: step.actionType === 'normal-summon',
      linkSummoned: step.actionType === 'link-summon' && m.from === 'extra',
      negated: fromEffect && !!this.effect?.summonedNegated,
      cannotActivate: fromEffect && !!this.effect?.summonedCannotActivate && (m.from === 'deck' || m.from === 'extra'),
      usedWhileFaceUp: [],
      arrivedAt: step.order,
    };

    if (!m.slot) {
      this.layoutKnown = false;
      this.note('有怪獸移到場上卻沒有格子位置：連結箭頭、額外怪獸區、指向位置與相互連結的規則無法驗證', 'no-slot');
    } else {
      this.counts.placements++;
      const taken = this.monsters.find((x) => x.slot === m.slot);
      if (!isMonsterSlot(m.slot)) this.fail(`${this.q(m.cardId)}是怪獸，不能放在 ${m.slot}`);
      else if (taken) this.fail(`${m.slot} 已經有${this.q(taken.cardId)}，不能再放${this.q(m.cardId)}`);
      else if (isExtraMonsterZone(m.slot) && m.from !== 'extra') this.fail(`只有從額外牌組特殊召喚的怪獸能放在額外怪獸區，${this.q(m.cardId)}不能放在 ${m.slot}`);
      else if (m.from === 'extra' && isLinkCard(card)) this.checkExtraPlacement(m.cardId, m.slot);
      if (fromEffect && this.effect?.placeInPointedZones && this.pointedForEffect && !this.pointedForEffect.includes(m.slot)) {
        const source = parseEffectRef(this.effect.ref)!.cardId;
        this.fail(`${this.q(source)}的效果只能把怪獸特殊召喚到它指向的格子（${this.pointedForEffect.join('、') || '無'}），${m.slot} 不是`);
      }
    }

    if (special) {
      this.counts.specialSummons++;
      for (const lock of this.locks) this.checkLock(lock, m.cardId, m.from === 'extra');
      this.summons.push({ step: step.order, cardId: m.cardId, fromExtra: m.from === 'extra', ...(m.slot ? { slot: m.slot } : {}) });
    }
    this.monsters.push(instance);
  }

  private checkExtraPlacement(cardId: number, slot: FieldSlot): void {
    const pointed = this.pointedByMine();
    if (isExtraMonsterZone(slot)) {
      const other: FieldSlot = slot === 'EMZ-L' ? 'EMZ-R' : 'EMZ-L';
      if (!this.monsters.some((x) => x.slot === other)) return;
      if (pointed === null) this.note(`第二個額外怪獸區（${slot}）是否被連結箭頭指向，需要所有連結怪獸的格子與箭頭，無法驗證`);
      else if (!pointed.has(slot)) this.fail(`從額外牌組特殊召喚的${this.q(cardId)}不能放在 ${slot}：已使用另一個額外怪獸區（${other}），且 ${slot} 沒有被自己的連結怪獸指向`);
      return;
    }
    if (pointed === null) this.note(`主要怪獸區 ${slot} 是否被連結箭頭指向，需要所有連結怪獸的格子與箭頭，無法驗證`);
    else if (!pointed.has(slot)) this.fail(`從額外牌組特殊召喚的${this.q(cardId)}只能放在額外怪獸區或被自己的連結怪獸指向的主要怪獸區，${slot} 沒有被指向`);
  }

  private checkLock(lock: Lock, cardId: number, fromExtra: boolean): void {
    const card = this.cards.get(cardId);
    const head = `第 ${lock.step} 步${this.q(lock.source)}的效果之後${LOCK_TEXT[lock.lock]}`;
    if (lock.lock === 'no-special-summon') this.fail(`${head}（${this.q(cardId)}）`);
    else if (lock.lock === 'cyberse-only') {
      if (!card?.race) this.note(`${this.q(cardId)}的種族資料不足，無法確認是否違反電子界族限制`);
      else if (card.race !== 'Cyberse') this.fail(`${head}，${this.q(cardId)}是 ${card.race} 族`);
    } else if (lock.lock === 'extra-link-only' && fromExtra && !isLinkCard(card)) this.fail(`${head}，${this.q(cardId)}不是連結怪獸`);
  }

  endStep(step: ComboStep): void {
    if (step.actionType === 'link-summon') {
      const pool = [...this.removed];
      const materials: MaterialInfo[] = (step.materialCardIds ?? []).map((cardId) => {
        const at = pool.findIndex((x) => x.cardId === cardId);
        const instance = at >= 0 ? pool.splice(at, 1)[0] : undefined;
        return { cardId, card: this.cards.get(cardId), ...(instance ? { normalSummoned: instance.normalSummoned } : {}) };
      });
      for (const target of (step.moves ?? []).filter((m) => m.from === 'extra' && m.to === 'field')) {
        const card = this.cards.get(target.cardId);
        if (!card) continue;
        this.counts.linkSummons++;
        const issues = linkMaterialIssues(card, materials, this.name);
        issues.violations.forEach((v) => this.fail(v));
        issues.unverified.forEach((u) => this.note(u, `mat:${step.order}:${u}`));
        for (const m of materials) this.materialFor.set(m.cardId, target.cardId);
      }
    }
    const rule = this.effect;
    if (rule?.returnsUpToCoLinked && this.coLinked !== null) {
      const returned = (step.moves ?? []).filter((m) => m.to === 'hand' && (m.from === 'field' || m.from === 'gy') && this.isMonster(m.cardId)).length;
      const source = parseEffectRef(rule.ref)!.cardId;
      if (returned > this.coLinked) this.fail(`${this.q(source)}返回 ${returned} 張，但此時與它相互連結的怪獸只有 ${this.coLinked} 隻`);
    }
    if (rule?.lock) {
      const lock = { lock: rule.lock, step: step.order, source: parseEffectRef(rule.ref)!.cardId };
      (rule.lockWholeTurn ? this.wholeTurnLocks : this.locks).push(lock);
    }
    this.stepStates.push({
      order: step.order,
      used: [...this.used].map(([ref, count]) => ({ ref, count })),
      locks: [...this.locks, ...this.wholeTurnLocks].map((l) => `${LOCK_TEXT[l.lock]}（第 ${l.step} 步${this.q(l.source)}）`),
      board: { monsters: this.monsters.map((m) => ({ ...m, usedWhileFaceUp: [...m.usedWhileFaceUp] })), backs: this.backs.map((b) => ({ ...b })) },
    });
  }

  finish(): RuleReport {
    for (const lock of this.wholeTurnLocks) {
      for (const s of this.summons) {
        if (s.step === lock.step) continue;
        const card = this.cards.get(s.cardId);
        if (lock.lock === 'cyberse-only' && card?.race && card.race !== 'Cyberse') {
          this.violation(`規則檢查：第 ${lock.step} 步${this.q(lock.source)}的效果發動的回合只能特殊召喚電子界族怪獸，第 ${s.step} 步特殊召喚了${this.q(s.cardId)}（${card.race} 族）`, s.step);
        }
      }
    }
    const c = this.counts;
    const checked = [
      `連結素材（${c.linkSummons} 次連結召喚）`,
      `召喚位置與連結箭頭（${c.placements} 次有格子位置的上場）`,
      `每回合次數與發動條件（${c.effects} 次規則表內的效果）`,
      `召喚限制（${c.specialSummons} 次特殊召喚）`,
    ];
    return {
      checked,
      unverified: this.unverified,
      board: { monsters: [...this.monsters], backs: [...this.backs], layoutKnown: this.layoutKnown, used: Object.fromEntries(this.used) },
      steps: this.stepStates,
    };
  }
}
