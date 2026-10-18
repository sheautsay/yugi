import { BoardRole, cardRule, isLinkCard, matchesArchetype, pointedSlots } from '../card-rules';
import { CardRecord, ComboRoute, DeckRecord, HAND_SIZE } from '../models';
import { FieldInstance } from '../rule-check';
import { RouteCheckResult, checkRoute, routeHand } from '../route-check';
import { AnalysisGoal, DEFAULT_GOAL } from './analysis-goal';
import type { AnalysisRun, ExploredEntry } from './analysis.service';

// CR-006 G36/G37/G39: what a candidate route really ends with, how it ranks for a goal, and
// whether a preferred monster was reached. Always recomputed from the route and the deck as they
// are now; ATK and Link Rating are never used.

export type InterruptionStatus = 'effective' | 'conditional' | 'inactive';

/**
 * CR-007 G42: how an interruption was established. `static-estimate` = derived from the end board
 * and the partial rule table; `verified` = confirmed by a rules engine or by playing it. Nothing in
 * this app can produce `verified` today (the rules engine is BLOCKED and Master Duel testing is done
 * by the user), so every interruption is a static estimate.
 */
export type InterruptionBasis = 'static-estimate' | 'verified';

export interface Interruption {
  cardId: number;
  label: string;
  status: InterruptionStatus;
  reason: string;
  basis: InterruptionBasis;
}

/** CR-007 G41: what is known about the hand when the route ends. */
export interface HandStatus {
  /** Cards the route lists (opening hand and draws) that are still in hand; null = the opening hand is not fixed. */
  confirmed: number | null;
  /** Other opening cards the route never mentions: content unknown, NOT simulated, so not "0". */
  untracked: { min: number; max: number };
  /** Every card in hand is accounted for by the simulation. */
  complete: boolean;
}

export type StartKind = 'single' | 'double' | 'triple' | 'multi';

/** CR-008 G50-2: what is left for the following turns (a static estimate; every part is named in `basis`). */
export interface FollowUp {
  /** Cards still in hand: confirmed plus the lower bound of the untracked ones (G41). */
  hand: number;
  /** Spells/Traps left Set or face-up on the field. */
  backrow: number;
  /** Cards in the Graveyard or banished zone with an effect (from the rule table) that works there. */
  recoverable: number;
  total: number;
  basis: string[];
}

export interface RouteEvaluation {
  /** The data check (with the partial rule check) passes for the deck as it is now. */
  valid: boolean;
  problemCount: number;
  startKind: StartKind;
  handSize: number;
  /** The starter cards the route lists, sorted (repeat an id for copies); empty when the hand is not fixed. */
  starters: number[];
  /** Same value ⇔ same starter cards, whatever the order. */
  starterKey: string;
  /** Monsters on the field when the route ends (one entry per copy). */
  finalMonsters: number[];
  /** Spells/Traps on the field when the route ends. */
  finalBacks: number[];
  /** Every Extra Deck monster the route summons, and whether it is still on the field at the end. */
  extraUsed: Array<{ cardId: number; onFinalBoard: boolean }>;
  interruptions: Interruption[];
  /** Static-estimate interruptions whose conditions hold (NOT verified). */
  effective: number;
  /** Interruptions confirmed by a rules engine or by playing them: always 0 for now. */
  verified: number;
  conditional: number;
  protections: string[];
  extensions: string[];
  /** Listed cards still in hand (confirmed). The unlisted rest of the opening hand is in `hand.untracked`. */
  handLeft: number;
  hand: HandStatus;
  followUp: FollowUp;
  /** Same value ⇔ same end board. */
  signature: string;
  layoutKnown: boolean;
}

export const START_KIND_LABEL: Record<StartKind, string> = { single: '單卡', double: '雙卡', triple: '三卡', multi: '多卡' };
export const INTERRUPTION_BASIS_LABEL: Record<InterruptionBasis, string> = { 'static-estimate': '靜態估算', verified: '已驗證' };

/** Opening hands this route can start from: 5 going first, 6 going second, either when unspecified. */
function handSizes(route: ComboRoute): number[] {
  const order = route.conditions.setup.turnOrder;
  return order === 'first' ? [HAND_SIZE.first] : order === 'second' ? [HAND_SIZE.second] : [HAND_SIZE.first, HAND_SIZE.second];
}

function handOf(route: ComboRoute, listed: number | null, confirmed: number): HandStatus {
  const sizes = handSizes(route);
  const cost = route.conditions.unallocatedHandMin ?? 0;
  if (listed === null) return { confirmed: null, untracked: { min: 0, max: Math.max(...sizes) }, complete: false };
  const untracked = { min: Math.max(0, Math.min(...sizes) - listed - cost), max: Math.max(0, Math.max(...sizes) - listed - cost) };
  return { confirmed, untracked, complete: untracked.max === 0 };
}

/** Never a bare number: the unlisted opening cards are not "0", they are unknown. */
export function handText(h: HandStatus): string {
  if (h.confirmed === null) return '無法確認（起手含「或」選項，內容未定）';
  if (h.untracked.max === 0) return `已確認 ${h.confirmed} 張`;
  const n = h.untracked.min === h.untracked.max ? `${h.untracked.min}` : `${h.untracked.min}～${h.untracked.max}`;
  return `已確認 ${h.confirmed} 張＋未追蹤 ${n} 張（其他起手牌，內容未知，未參與展開）`;
}

/** The interruption count as it must be shown: an estimate, with what is (not) verified. */
export function interruptionText(e: Pick<RouteEvaluation, 'effective' | 'verified' | 'conditional'>): string {
  return `靜態估算 ${e.effective} 項；已驗證 ${e.verified} 項（規則引擎未整合，未經實際操作）${e.conditional ? `；另有 ${e.conditional} 項條件未能驗證（不計入）` : ''}`;
}
/** G50-2: hand + Set cards + cards that can act again from the Graveyard or banished zone, each part named. */
function followUpOf(hand: HandStatus, finalBacks: number[], gy: Array<{ cardId: number; count: number }>, banished: Array<{ cardId: number; count: number }>, cards: ReadonlyMap<number, CardRecord>, name: (id: number) => string): FollowUp {
  const handCount = (hand.confirmed ?? 0) + hand.untracked.min;
  const usable = (rows: typeof gy, zones: string[]) => rows.filter((r) => cardRule(r.cardId, cards)?.effects.some((e) => zones.includes(e.zone)));
  const reusable = [...usable(gy, ['gy', 'field-or-gy']).map((r) => ({ ...r, where: '墓地' })), ...usable(banished, ['banished']).map((r) => ({ ...r, where: '除外' }))];
  const recoverable = reusable.reduce((sum, r) => sum + r.count, 0);
  const backNames = [...new Set(finalBacks)].map((id) => `${name(id)}${finalBacks.filter((x) => x === id).length > 1 ? '×' + finalBacks.filter((x) => x === id).length : ''}`);
  const basis = [
    hand.confirmed === null ? '手牌：起手含「或」選項，無法確認' : `手牌 ${handCount} 張（已確認 ${hand.confirmed}＋未追蹤至少 ${hand.untracked.min}）`,
    ...(finalBacks.length ? [`蓋放或場上的魔法陷阱 ${finalBacks.length} 張：${backNames.join('、')}`] : []),
    ...(recoverable ? [`${reusable.map((r) => `${r.where}的「${name(r.cardId)}」${r.count > 1 ? '×' + r.count : ''}`).join('、')}有能在該區域發動的效果（下一回合起可再用）`] : []),
  ];
  return { hand: handCount, backrow: finalBacks.length, recoverable, total: handCount + finalBacks.length + recoverable, basis };
}

export const STATUS_LABEL: Record<InterruptionStatus, string> = { effective: '有效', conditional: '條件未能驗證', inactive: '無效（條件不成立）' };

export function evaluateRoute(
  route: ComboRoute,
  deck: Pick<DeckRecord, 'main' | 'extra'>,
  cards: ReadonlyMap<number, CardRecord>,
  check: RouteCheckResult = checkRoute(route, deck, { cards }),
  name: (id: number) => string = (id) => cards.get(id)?.nameEn ?? `ID ${id}`,
): RouteEvaluation {
  const hand = routeHand(route);
  const handSize = 'hand' in hand ? hand.hand.length : route.conditions.handAllOf.reduce((s, c) => s + c.count, 0);
  const handLeft = check.final.hand.reduce((s, r) => s + r.count, 0);
  const handStatus = handOf(route, 'hand' in hand ? hand.hand.length : null, handLeft);
  const starters = 'hand' in hand ? [...hand.hand].sort((a, b) => a - b) : [];
  const isMonster = (id: number) => cards.get(id)?.kind === 'monster';
  const expand = (rows: Array<{ cardId: number; count: number }>) => rows.flatMap((r) => Array<number>(r.count).fill(r.cardId));
  const finalField = expand(check.final.field);
  const finalMonsters = finalField.filter(isMonster);
  const finalBacks = finalField.filter((id) => !isMonster(id));
  const summoned = [...new Set(route.steps.flatMap((s) => (s.moves ?? []).filter((m) => m.from === 'extra' && m.to === 'field').map((m) => m.cardId)))];
  const board = check.rules?.board;
  const layoutKnown = !!board?.layoutKnown;
  const banished = expand(check.final.banished);
  const followUp = followUpOf(handStatus, finalBacks, check.final.gy, check.final.banished, cards, name);

  const interruptions: Interruption[] = [];
  const protections: string[] = [];
  const extensions: string[] = [];
  const monsters: Array<Pick<FieldInstance, 'cardId' | 'slot' | 'usedWhileFaceUp'>> = board?.monsters ?? finalMonsters.map((cardId) => ({ cardId, usedWhileFaceUp: [] }));
  const backs = board?.backs ?? finalBacks.map((cardId) => ({ cardId }));
  const pointedBy = (m: (typeof monsters)[number]) => (layoutKnown && m.slot ? pointedSlots(m.slot, cards.get(m.cardId)?.linkMarkers) : null);

  const judge = (cardId: number, role: BoardRole, self?: (typeof monsters)[number]): Interruption => {
    const out = (status: InterruptionStatus, reason: string): Interruption => ({ cardId, label: role.label, status, reason, basis: 'static-estimate' });
    const spent = !!role.ref && !!self?.usedWhileFaceUp.includes(role.ref);
    switch (role.needs) {
      case 'pointed-link': {
        const pointed = self && pointedBy(self);
        if (!pointed) return out('conditional', '缺少格子位置，無法確認它指向的格子是否有自己的連結怪獸');
        const links = monsters.filter((m) => m !== self && m.slot && pointed.includes(m.slot) && isLinkCard(cards.get(m.cardId)));
        return links.length ? out('effective', `它指向的${links.map((m) => `「${name(m.cardId)}」`).join('、')}可作為解放的連結怪獸`) : out('inactive', '它指向的格子沒有自己的連結怪獸，無法發動');
      }
      case 'co-linked': {
        if (spent) return out('inactive', '本回合已在場上表側時使用過（場上表側期間只能一次）');
        const mine = self && pointedBy(self);
        if (!mine) return out('conditional', '缺少格子位置，無法確認相互連結的怪獸');
        const n = monsters.filter((m) => m !== self && m.slot && mine.includes(m.slot) && pointedBy(m)?.includes(self!.slot!)).length;
        return n ? out('effective', `與 ${n} 隻怪獸相互連結，最多返回 ${n} 張`) : out('inactive', '沒有相互連結的怪獸，可返回的數量為 0');
      }
      case 'banished-maliss': {
        const target = banished.find((id) => matchesArchetype(cards.get(id), 'Maliss'));
        return target ? out('effective', `可指定除外的「${name(target)}」作為對象`) : out('inactive', '沒有除外中的「Maliss」卡可作為對象');
      }
      case 'opponent-face-up':
        return out('conditional', '需要對手場上有表側表示的怪獸；對手場上的狀況未知，不計入');
      case 'opponent-trap':
        return out('conditional', '只能對應對手發動的陷阱卡');
      case 'maliss-cost-and-link': {
        const maliss = monsters.filter((m) => matchesArchetype(cards.get(m.cardId), 'Maliss'));
        const links = maliss.filter((m) => isLinkCard(cards.get(m.cardId))).length;
        const ok = links >= 2 || (links >= 1 && maliss.length - links >= 1);
        return ok ? out('effective', '可除外 1 隻 Maliss 怪獸作為代價，之後仍控制 Maliss 連結怪獸') : out('inactive', '需要可除外作為代價的 Maliss 怪獸，且之後仍控制 Maliss 連結怪獸');
      }
      default:
        return out('effective', '');
    }
  };

  const roles = (cardId: number, self?: (typeof monsters)[number]) => {
    for (const role of cardRule(cardId, cards)?.board ?? []) {
      if (role.kind === 'protection') protections.push(`「${name(cardId)}」：${role.label}`);
      else if (role.kind === 'extension') extensions.push(`「${name(cardId)}」：${role.label}`);
      else interruptions.push(judge(cardId, role, self));
    }
  };
  monsters.forEach((m) => roles(m.cardId, m));
  backs.forEach((b) => roles(b.cardId));

  return {
    valid: check.passed,
    problemCount: check.problems.length,
    startKind: handSize <= 1 ? 'single' : handSize === 2 ? 'double' : handSize === 3 ? 'triple' : 'multi',
    handSize,
    starters,
    starterKey: starters.join('+'),
    finalMonsters,
    finalBacks,
    extraUsed: summoned.map((cardId) => ({ cardId, onFinalBoard: finalMonsters.includes(cardId) })),
    interruptions,
    effective: interruptions.filter((i) => i.status === 'effective' && i.basis === 'static-estimate').length,
    verified: interruptions.filter((i) => i.status === 'effective' && i.basis === 'verified').length,
    conditional: interruptions.filter((i) => i.status === 'conditional').length,
    protections,
    extensions,
    handLeft,
    hand: handStatus,
    followUp,
    signature: [...finalField].sort((a, b) => a - b).join('+'),
    layoutKnown,
  };
}

// ---- ranking ---------------------------------------------------------------------------------

export interface RankedCandidate {
  /** Index in the run's candidate list. */
  index: number;
  evaluation: RouteEvaluation;
  /** Another (higher-ranked) valid candidate with exactly the same end board. */
  sameEndBoardAs?: number;
  targetsOnBoard: number;
  targetsIntermediate: number;
}

function score(e: RouteEvaluation, goal: AnalysisGoal, onBoard: number, intermediate: number): number[] {
  switch (goal.kind) {
    case 'targets':
      return [onBoard, e.effective, intermediate, e.conditional, e.handLeft];
    case 'resources':
      // Known + untracked cards both stay in hand; at equal totals the confirmed (listed) ones come first.
      return [(e.hand.confirmed ?? 0) + e.hand.untracked.min, e.hand.confirmed ?? 0, e.effective, e.conditional];
    case 'balanced':
      return [e.effective + e.followUp.total, e.effective, e.conditional];
    case 'diverse':
    case 'interruptions':
      return [e.effective, e.conditional, e.protections.length, e.handLeft];
  }
}

const compare = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
};

/** Valid routes first, then by the goal; ties keep the model's order. Never uses ATK or Link Rating. */
export function rankCandidates(items: ReadonlyArray<{ index: number; evaluation: RouteEvaluation }>, goal: AnalysisGoal): RankedCandidate[] {
  const preferred = new Set(goal.preferredExtraIds);
  const rows = items.map(({ index, evaluation: e }) => {
    const onBoard = new Set(e.finalMonsters.filter((id) => preferred.has(id))).size;
    const intermediate = e.extraUsed.filter((u) => preferred.has(u.cardId) && !u.onFinalBoard).length;
    return { index, evaluation: e, targetsOnBoard: onBoard, targetsIntermediate: intermediate, key: [e.valid ? 1 : 0, ...score(e, goal, onBoard, intermediate), -e.problemCount] };
  });
  rows.sort((a, b) => compare(a.key, b.key) || a.index - b.index);

  const first = new Map<string, number>();
  const ranked: RankedCandidate[] = rows.map(({ key: _, ...r }) => {
    if (!r.evaluation.valid) return r;
    const same = first.get(r.evaluation.signature);
    if (same === undefined) {
      first.set(r.evaluation.signature, r.index);
      return r;
    }
    return { ...r, sameEndBoardAs: same };
  });
  if (goal.kind !== 'diverse') return ranked;
  return [...ranked.filter((r) => r.evaluation.valid && r.sameEndBoardAs === undefined), ...ranked.filter((r) => r.evaluation.valid && r.sameEndBoardAs !== undefined), ...ranked.filter((r) => !r.evaluation.valid)];
}

// ---- CR-008: size groups, duplicates, what the extra cards bring --------------------------------------

type Scored = { index: number; evaluation: RouteEvaluation };

/** G52-1: single / double / triple card routes (by the starter cards each route really lists), order kept. */
export function groupBySize<T extends Scored>(items: readonly T[]): { single: T[]; double: T[]; triple: T[]; other: T[] } {
  const groups = { single: [] as T[], double: [] as T[], triple: [] as T[], other: [] as T[] };
  for (const item of items) {
    const kind = item.evaluation.startKind;
    groups[kind === 'multi' ? 'other' : kind].push(item);
  }
  return groups;
}

/**
 * G52-6: routes with the same starter cards (any order) and the same end board are one line. The
 * best-ranked one is kept; the rest are folded into it. Routes that failed their checks are never folded.
 */
export function foldDuplicates(ranked: readonly RankedCandidate[]): { kept: RankedCandidate[]; folded: Array<{ index: number; into: number }> } {
  const first = new Map<string, number>();
  const kept: RankedCandidate[] = [];
  const folded: Array<{ index: number; into: number }> = [];
  for (const r of ranked) {
    const e = r.evaluation;
    if (!e.valid || !e.starterKey) {
      kept.push(r);
      continue;
    }
    const key = `${e.starterKey}|${e.signature}`;
    const into = first.get(key);
    if (into === undefined) {
      first.set(key, r.index);
      kept.push(r);
    } else folded.push({ index: r.index, into });
  }
  return { kept, folded };
}

/** How many steps from the start two routes share exactly: same action, actors, effect, materials and every card move. */
export function sharedPrefix(a: ComboRoute, b: ComboRoute): number {
  const sig = (s: ComboRoute['steps'][number]) => JSON.stringify([s.actionType, s.actorCardIds, s.effectRef ?? null, s.materialCardIds ?? [], s.moves ?? []]);
  let n = 0;
  while (n < a.steps.length && n < b.steps.length && sig(a.steps[n]) === sig(b.steps[n])) n++;
  return n;
}

/**
 * The other route of the same required starter cards that repeats this route the longest from the start.
 * A note, never a fold: routes with different end boards are all kept (rev8 duplicate rule); this only
 * tells the reader that two "different" routes are one line with two endings.
 */
export interface SiblingOverlap {
  otherIndex: number;
  shared: number;
  steps: number;
  otherSteps: number;
  /** At least half of the shorter route is identical from the start. */
  sameLine: boolean;
}

export function siblingOverlap(index: number, routes: readonly ComboRoute[]): SiblingOverlap | null {
  const key = (r: ComboRoute) => [...(r.analysis?.combo?.required ?? [])].sort((x, y) => x - y).join('+');
  const mine = routes[index];
  const k = mine ? key(mine) : '';
  if (!k) return null;
  let best: SiblingOverlap | null = null;
  for (let i = 0; i < routes.length; i++) {
    if (i === index || key(routes[i]) !== k) continue;
    const shared = sharedPrefix(mine, routes[i]);
    if (best && shared <= best.shared) continue;
    const steps = mine.steps.length;
    const otherSteps = routes[i].steps.length;
    best = { otherIndex: i, shared, steps, otherSteps, sameLine: shared > 0 && shared * 2 >= Math.min(steps, otherSteps) };
  }
  return best;
}

export type AddedVerdict = 'better' | 'same' | 'worse' | 'mixed';
export const ADDED_VERDICT_LABEL: Record<AddedVerdict, string> = { better: '較好', same: '相同', worse: '較差', mixed: '各有取捨' };

/** G52-4: what a route with more starter cards has over the nearest route with fewer of the same cards. */
export interface AddedValue {
  baseIndex: number;
  addedStarters: number[];
  addedOnBoard: number[];
  removedFromBoard: number[];
  effectiveDelta: number;
  followUpDelta: number;
  handDelta: number;
  verdict: AddedVerdict;
  summary: string;
}

const multiset = (ids: readonly number[]) => {
  const m = new Map<number, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
};
const minus = (a: readonly number[], b: readonly number[]): number[] => {
  const left = multiset(b);
  return a.filter((id) => {
    const n = left.get(id) ?? 0;
    if (n > 0) left.set(id, n - 1);
    return n === 0;
  });
};
const isProperSubset = (small: readonly number[], big: readonly number[]) => small.length > 0 && small.length < big.length && minus(small, big).length === 0;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : '±0');

export function addedValue(target: Scored, pool: readonly Scored[], name: (id: number) => string = (id) => `ID ${id}`): AddedValue | null {
  const t = target.evaluation;
  const bases = pool.filter((p) => p.index !== target.index && p.evaluation.valid && isProperSubset(p.evaluation.starters, t.starters));
  const base = bases.reduce<Scored | null>((best, p) => (!best || p.evaluation.starters.length > best.evaluation.starters.length ? p : best), null);
  if (!base) return null;
  const b = base.evaluation;

  const addedStarters = minus(t.starters, b.starters);
  const boardOf = (e: RouteEvaluation) => [...e.finalMonsters, ...e.finalBacks];
  const addedOnBoard = minus(boardOf(t), boardOf(b));
  const removedFromBoard = minus(boardOf(b), boardOf(t));
  const effectiveDelta = t.effective - b.effective;
  const followUpDelta = t.followUp.total - b.followUp.total;
  const handDelta = t.followUp.hand - b.followUp.hand;
  const backDelta = t.followUp.backrow - b.followUp.backrow;
  const recoverDelta = t.followUp.recoverable - b.followUp.recoverable;

  const verdict: AddedVerdict =
    effectiveDelta === 0 && followUpDelta === 0 ? 'same' : effectiveDelta >= 0 && followUpDelta >= 0 ? 'better' : effectiveDelta <= 0 && followUpDelta <= 0 ? 'worse' : 'mixed';

  // The verdict never says more than the numbers: it names what did NOT improve.
  const note =
    verdict === 'better' && effectiveDelta === 0
      ? '（靜態估算的有效干擾沒有增加，只是後續資源較多）'
      : verdict === 'better' && followUpDelta === 0
        ? '（後續資源沒有增加）'
        : verdict === 'worse' && effectiveDelta === 0
          ? '（有效干擾沒有增加，後續資源變少）'
          : verdict === 'mixed'
            ? `（有效干擾 ${signed(effectiveDelta)}，後續資源 ${signed(followUpDelta)}）`
            : '';

  const isBack = (id: number) => t.finalBacks.includes(id) || b.finalBacks.includes(id);
  const label = (ids: number[]) => [...new Set(ids)].map((id) => `${name(id)}${isBack(id) ? '（蓋放）' : ''}${ids.filter((x) => x === id).length > 1 ? `×${ids.filter((x) => x === id).length}` : ''}`).join('、');
  const parts = [handDelta ? `手牌${handDelta > 0 ? '多' : '少'} ${Math.abs(handDelta)} 張` : '', backDelta ? `蓋放的魔法陷阱${backDelta > 0 ? '多' : '少'} ${Math.abs(backDelta)} 張` : '', recoverDelta ? `墓地／除外可再用的卡${recoverDelta > 0 ? '多' : '少'} ${Math.abs(recoverDelta)} 張` : ''].filter(Boolean);
  const summary =
    `加入${[...new Set(addedStarters)].map((id) => `「${name(id)}」${addedStarters.filter((x) => x === id).length > 1 ? `×${addedStarters.filter((x) => x === id).length}` : ''}`).join('')}：` +
    `終場${addedOnBoard.length ? `多了${label(addedOnBoard)}` : ''}${addedOnBoard.length && removedFromBoard.length ? '、' : ''}${removedFromBoard.length ? `少了${label(removedFromBoard)}` : ''}${!addedOnBoard.length && !removedFromBoard.length ? '沒有變化' : ''}；` +
    `有效干擾（靜態估算）${signed(effectiveDelta)}；後續資源 ${signed(followUpDelta)}${parts.length ? `（${parts.join('、')}）` : ''}；結論：${ADDED_VERDICT_LABEL[verdict]}${note}`;
  return { baseIndex: base.index, addedStarters, addedOnBoard, removedFromBoard, effectiveDelta, followUpDelta, handDelta, verdict, summary };
}

// ---- preferred monsters -----------------------------------------------------------------------

export interface TargetCoverage {
  cardId: number;
  /** A valid route ends with it on the field. */
  found: boolean;
  onFinalBoard: number;
  intermediate: number;
  failedChecks: number;
  explored: number;
  message: string;
}

export function targetCoverage(
  items: ReadonlyArray<{ index: number; evaluation: RouteEvaluation }>,
  ids: readonly number[],
  explored: ReadonlyArray<Pick<ExploredEntry, 'extraDeckCardIds' | 'finalBoardCardIds'>> = [],
): TargetCoverage[] {
  return ids.map((cardId) => {
    const valid = items.filter((i) => i.evaluation.valid).map((i) => i.evaluation);
    const onFinalBoard = valid.filter((e) => e.finalMonsters.includes(cardId)).length;
    const intermediate = valid.filter((e) => !e.finalMonsters.includes(cardId) && e.extraUsed.some((u) => u.cardId === cardId)).length;
    const failedChecks = items.filter((i) => !i.evaluation.valid && (i.evaluation.finalMonsters.includes(cardId) || i.evaluation.extraUsed.some((u) => u.cardId === cardId))).length;
    const mentioned = explored.filter((x) => x.extraDeckCardIds.includes(cardId) || x.finalBoardCardIds.includes(cardId)).length;
    const found = onFinalBoard > 0;
    const details = [
      failedChecks ? `AI 提出 ${failedChecks} 條使用此怪獸的路線，但未通過資料驗證或規則檢查` : '',
      intermediate ? `${intermediate} 條通過檢查的路線只在中途使用此怪獸（沒有留在終場）` : '',
      mentioned ? `AI 提到 ${mentioned} 次但沒有展開成逐步路線（未驗證）` : '',
    ].filter(Boolean);
    const message = found
      ? `找到 ${onFinalBoard} 條終場有此怪獸、資料驗證通過且規則檢查沒有發現違規的路線${intermediate ? `；另有 ${intermediate} 條只在中途使用` : ''}`
      : `未找到已驗證路線：${details.length ? details.join('；') : 'AI 沒有提出使用此怪獸的路線'}。這只代表本次候選中沒有，可改變分析目標或重新分析`;
    return { cardId, found, onFinalBoard, intermediate, failedChecks, explored: mentioned, message };
  });
}

/** Everything the analysis page shows for one run: ranked (shown / more) and preferred-monster coverage. */
export function analyzeCandidates(
  run: Pick<AnalysisRun, 'candidates' | 'goal' | 'scope' | 'explored' | 'staged'>,
  deck: Pick<DeckRecord, 'main' | 'extra'>,
  cards: ReadonlyMap<number, CardRecord>,
  goal: AnalysisGoal = run.goal ?? DEFAULT_GOAL,
  name?: (id: number) => string,
  options: { fold?: boolean } = {},
): { ranked: RankedCandidate[]; shown: RankedCandidate[]; more: RankedCandidate[]; folded: Array<{ index: number; into: number }>; items: Array<{ index: number; evaluation: RouteEvaluation }>; coverage: TargetCoverage[] } {
  const items = (run.candidates ?? []).map((c, index) => ({ index, evaluation: evaluateRoute(c.route, deck, cards, checkRoute(c.route, deck, { cards, ...(name ? { name } : {}) }), name) }));
  const ranked = rankCandidates(items, goal);
  // CR-008: only a phased analysis folds duplicates; a one-shot analysis shows every candidate as before.
  const { kept, folded } = options.fold ?? !!run.staged ? foldDuplicates(ranked) : { kept: ranked, folded: [] };
  const limit = Math.max(1, run.scope.maxRoutes);
  return { ranked, shown: kept.slice(0, limit), more: kept.slice(limit), folded, items, coverage: targetCoverage(items, goal.preferredExtraIds, run.explored ?? []) };
}
