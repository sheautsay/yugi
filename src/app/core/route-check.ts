import { ParsedDeck, countOf } from './deck';
import { tally } from './hand';
import { CardCount, CardRecord, ComboRoute, ComboStep, HAND_SIZE, PlayZone, PLAY_ZONES } from './models';
import { RuleReport, RuleTracker } from './rule-check';

// CR-004 local data check for a route: replays every card move against the actual deck list.
// Passing it means the route is internally consistent with this deck — NOT that it is legal.

export const PLAY_ZONE_LABEL: Record<PlayZone, string> = {
  deck: '牌組',
  hand: '手牌',
  extra: '額外牌組',
  field: '場上',
  gy: '墓地',
  banished: '除外',
  overlay: '超量素材',
};

/** End-board zone texts (free text in the editor) that map to a simulated zone. */
const END_ZONE_ALIASES: Record<string, PlayZone> = {
  ...Object.fromEntries(PLAY_ZONES.map((z) => [PLAY_ZONE_LABEL[z], z])),
  怪獸區: 'field',
  主要怪獸區: 'field',
  額外怪獸區: 'field',
  魔法陷阱區: 'field',
  場地區: 'field',
};

export function endZone(text: string): PlayZone | null {
  return END_ZONE_ALIASES[text.trim()] ?? null;
}

const EXTRA_SUMMONS = new Set(['link-summon', 'xyz-summon', 'synchro-summon', 'fusion-summon']);
const FIELD_MATERIAL_SUMMONS = new Set(['link-summon', 'xyz-summon', 'synchro-summon']);
const KEEPS_CARD = new Set<PlayZone>(['hand', 'field', 'gy', 'banished', 'overlay']);

export interface ResourceSnapshot {
  hand: CardCount[];
  field: CardCount[];
  gy: CardCount[];
  banished: CardCount[];
  overlay: CardCount[];
  deckCount: number;
  extraCount: number;
  normalSummons: number;
}

export interface RouteCheckIssue {
  /** Step order (1..N); absent for route-level issues. */
  step?: number;
  message: string;
}

export interface RouteCheckResult {
  passed: boolean;
  /** Each one blocks "data-checked". */
  problems: RouteCheckIssue[];
  /** Worth knowing, but not a contradiction of the deck list (e.g. a second normal summon). */
  warnings: RouteCheckIssue[];
  start: ResourceSnapshot;
  /** `afterStep[i]` is the state after step i+1. */
  afterStep: ResourceSnapshot[];
  final: ResourceSnapshot;
  /** CR-006 partial rule check (only with card data); its violations are also in `problems`. */
  rules?: RuleReport;
}

export interface RouteCheckOptions {
  /** Card records, for the Extra Deck type check and zone-size warnings. */
  cards?: ReadonlyMap<number, CardRecord>;
  name?: (cardId: number) => string;
}

type Zones = Record<PlayZone, Map<number, number>>;

const rows = (m: Map<number, number>): CardCount[] => [...m].filter(([, n]) => n > 0).map(([cardId, count]) => ({ cardId, count }));
const total = (m: Map<number, number>) => [...m.values()].reduce((s, n) => s + n, 0);

function snapshot(z: Zones, normalSummons: number): ResourceSnapshot {
  return {
    hand: rows(z.hand),
    field: rows(z.field),
    gy: rows(z.gy),
    banished: rows(z.banished),
    overlay: rows(z.overlay),
    deckCount: total(z.deck),
    extraCount: total(z.extra),
    normalSummons,
  };
}

/** Same set as `comboCardIds` (combo.ts), kept here so the matcher can use this file without an import cycle. */
function referencedIds(route: ComboRoute): number[] {
  const c = route.conditions;
  return [
    ...new Set([
      ...c.handAllOf.flatMap((cl) => cl.anyOf),
      ...(c.mustRemainInMain ?? []).map((r) => r.cardId),
      ...(c.mustExistInExtra ?? []).map((r) => r.cardId),
      ...route.steps.flatMap((s) => [...s.actorCardIds, ...(s.targetCardIds ?? []), ...(s.materialCardIds ?? []), ...(s.moves ?? []).map((m) => m.cardId)]),
      ...route.endBoard.map((e) => e.cardId),
    ]),
  ];
}

/** The exact opening hand of a route, or why it cannot be determined. */
export function routeHand(route: ComboRoute): { hand: number[] } | { error: string } {
  const clauses = route.conditions.handAllOf;
  if (clauses.some((c) => c.anyOf.length !== 1)) return { error: '起手條件含「或」選項：資料驗證只能檢查每個條件都是一張確定的卡' };
  return { hand: clauses.flatMap((c) => Array<number>(c.count).fill(c.anyOf[0])) };
}

/** Pure: replays the route on the deck list. Same inputs give the same result. */
export function checkRoute(route: ComboRoute, deck: Pick<ParsedDeck, 'main' | 'extra'>, options: RouteCheckOptions = {}): RouteCheckResult {
  const name = options.name ?? ((id: number) => options.cards?.get(id)?.nameEn ?? `ID ${id}`);
  const q = (id: number) => `「${name(id)}」`;
  const problems: RouteCheckIssue[] = [];
  const warnings: RouteCheckIssue[] = [];
  const problem = (message: string, step?: number) => problems.push(step === undefined ? { message } : { step, message });
  const warn = (message: string, step?: number) => warnings.push(step === undefined ? { message } : { step, message });

  // a. No card outside the deck (main + extra).
  const inDeck = new Set([...deck.main, ...deck.extra].filter((r) => r.count > 0).map((r) => r.cardId));
  for (const id of referencedIds(route)) if (!inDeck.has(id)) problem(`${q(id)}（ID ${id}）不在此牌組的主牌或額外牌組中`);

  // d. Steps and end board.
  if (route.steps.length === 0) problem('路線沒有步驟');
  if (route.endBoard.length === 0) problem('路線沒有預計終場');

  // g/b. Opening hand: a fixed multiset drawn from the main deck.
  const handResult = routeHand(route);
  const hand = 'hand' in handResult ? handResult.hand : [];
  if ('error' in handResult) problem(handResult.error);
  const turnOrder = route.conditions.setup.turnOrder === 'second' ? 'second' : 'first';
  const maxHand = HAND_SIZE[turnOrder];
  if (hand.length + (route.conditions.unallocatedHandMin ?? 0) > maxHand) problem(`起手需要 ${hand.length + (route.conditions.unallocatedHandMin ?? 0)} 張，超過${turnOrder === 'first' ? '先攻' : '後攻'}的 ${maxHand} 張`);
  if (route.conditions.unallocatedHandMin) warn(`另需 ${route.conditions.unallocatedHandMin} 張任意手牌作為代價：資料驗證沒有模擬這些卡`);

  const zones = Object.fromEntries(PLAY_ZONES.map((z) => [z, new Map<number, number>()])) as Zones;
  for (const r of deck.main) if (r.count > 0) zones.deck.set(r.cardId, r.count);
  for (const r of deck.extra) if (r.count > 0) zones.extra.set(r.cardId, r.count);
  for (const [id, n] of tally(hand)) {
    const have = countOf(deck.main, id);
    if (n > have) problem(`起手需要${q(id)}×${n}，但主牌組只有 ${have} 張`);
    zones.deck.set(id, Math.max(have - n, 0));
    zones.hand.set(id, n);
  }

  // c. Required cards still in the main deck after the hand, or in the Extra Deck.
  for (const { cardId, count } of route.conditions.mustRemainInMain ?? []) {
    const left = zones.deck.get(cardId) ?? 0;
    if (left < count) problem(`主牌組需仍有${q(cardId)}×${count}，扣除起手後只剩 ${left} 張`);
  }
  for (const { cardId, count } of route.conditions.mustExistInExtra ?? []) {
    const have = countOf(deck.extra, cardId);
    if (have < count) problem(`額外牌組需要${q(cardId)}×${count}，目前有 ${have} 張`);
  }

  const start = snapshot(zones, 0);
  const afterStep: ResourceSnapshot[] = [];
  let normalSummons = 0;
  // CR-006: with card data, the partial rule check replays the same steps alongside.
  const rules = options.cards ? new RuleTracker(options.cards, name, (msg, step) => problem(msg, step)) : null;

  // e. Replay every step.
  for (const step of route.steps) {
    const at = step.order;
    const before = Object.fromEntries(PLAY_ZONES.map((z) => [z, new Map(zones[z])])) as Zones;
    const moves = step.moves ?? [];
    rules?.beginStep(step, before);
    for (const m of moves) {
      if (m.from === m.to) {
        problem(`${q(m.cardId)}的移動起點與終點相同（${PLAY_ZONE_LABEL[m.from]}）`, at);
        continue;
      }
      const have = zones[m.from].get(m.cardId) ?? 0;
      if (have < 1) {
        problem(`${q(m.cardId)}不在${PLAY_ZONE_LABEL[m.from]}，不能移到${PLAY_ZONE_LABEL[m.to]}`, at);
        continue;
      }
      zones[m.from].set(m.cardId, have - 1);
      zones[m.to].set(m.cardId, (zones[m.to].get(m.cardId) ?? 0) + 1);
      rules?.move(m);
    }
    checkStep(step, before, moves, { problem: (msg) => problem(msg, at), warn: (msg) => warn(msg, at), q, cards: options.cards });
    rules?.endStep(step);
    if (step.actionType === 'normal-summon') {
      normalSummons++;
      if (normalSummons === 2) warn('通常召喚超過 1 次：除非有卡片效果給予額外的召喚權，否則不可行', at);
    }
    if (options.cards) {
      const kinds = rows(zones.field).reduce(
        (acc, r) => {
          const kind = options.cards!.get(r.cardId)?.kind;
          if (kind === 'monster') acc.monsters += r.count;
          else if (kind === 'spell' || kind === 'trap') acc.spells += r.count;
          return acc;
        },
        { monsters: 0, spells: 0 },
      );
      if (kinds.monsters > 7) warn(`場上怪獸 ${kinds.monsters} 張，超過怪獸區數量`, at);
      if (kinds.spells > 6) warn(`場上魔法／陷阱 ${kinds.spells} 張，超過魔法陷阱區與場地區數量`, at);
    }
    afterStep.push(snapshot(zones, normalSummons));
  }
  const report = rules?.finish();

  // f. The end board must match the simulated final state.
  for (const e of route.endBoard) {
    const zone = endZone(e.zone);
    if (!zone) {
      warn(`終場位置「${e.zone}」無法對應到模擬的位置，${q(e.cardId)}未檢查`);
      continue;
    }
    const have = zones[zone].get(e.cardId) ?? 0;
    if (have < e.count) problem(`終場列出${q(e.cardId)}×${e.count}（${PLAY_ZONE_LABEL[zone]}），但模擬結束時只有 ${have} 張`);
  }

  // CR-008 G47-4 / G49: routes written in the 1–3 card format (they carry `analysis.combo`) must be complete.
  if (route.analysis?.combo) comboProblems(route, route.analysis.combo, deck, hand, { problem, q });

  return { passed: problems.length === 0, problems, warnings, start, afterStep, final: snapshot(zones, normalSummons), ...(report ? { rules: report } : {}) };
}

/**
 * The extra checks of a "1–3 card route": every required starter card is used, the roles do not
 * contradict each other, and no step is unfinished or without a card move. Routes without combo
 * info never get here, so their results do not change.
 */
function comboProblems(
  route: ComboRoute,
  combo: NonNullable<NonNullable<ComboRoute['analysis']>['combo']>,
  deck: Pick<ParsedDeck, 'main' | 'extra'>,
  hand: readonly number[],
  ctx: { problem: (message: string, step?: number) => void; q: (id: number) => string },
): void {
  const { problem, q } = ctx;
  const required = tally(combo.required);
  if (combo.required.length > 3) problem(`必要起手牌有 ${combo.required.length} 張：1～3 卡展開最多 3 張必要起手牌`);

  const listed = tally(hand);
  if ([...required].some(([id, n]) => listed.get(id) !== n) || [...listed].some(([id, n]) => required.get(id) !== n)) problem('必要起手牌與路線的起手條件不一致');

  // Participation: a required card is used when a step moves it out of the hand, or names it as actor, target or material.
  const movedOut = new Map<number, number>();
  const named = new Set<number>();
  for (const step of route.steps) {
    for (const id of [...step.actorCardIds, ...(step.targetCardIds ?? []), ...(step.materialCardIds ?? [])]) named.add(id);
    for (const m of step.moves ?? []) if (m.from === 'hand') movedOut.set(m.cardId, (movedOut.get(m.cardId) ?? 0) + 1);
  }
  for (const [id, n] of required) {
    const used = Math.max(movedOut.get(id) ?? 0, named.has(id) ? 1 : 0);
    if (used >= n) continue;
    problem(n === 1 ? `必要起手牌${q(id)}沒有參與展開（沒有任何步驟使用它），不能把這條路線列為 ${combo.required.length} 卡展開` : `必要起手牌${q(id)}×${n}：只有 ${used} 張被使用，其餘 ${n - used} 張沒有參與展開`);
  }

  const mustStay = new Set((route.conditions.mustRemainInMain ?? []).map((r) => r.cardId));
  for (const id of combo.avoidInHand) {
    if (required.has(id)) problem(`不希望抽上手的${q(id)}同時被列為必要起手牌`);
    else if (!mustStay.has(id)) problem(`不希望抽上手的${q(id)}必須同時列為「必須留在牌組」的卡`);
  }
  for (const alt of combo.alternatives) {
    if (!required.has(alt.cardId)) problem(`可替代的起手牌：被替代的${q(alt.cardId)}不是必要起手牌`);
    for (const id of alt.instead) if (countOf(deck.main, id) === 0) problem(`可替代的起手牌${q(id)}不在主牌組中`);
  }

  for (const step of route.steps) {
    if (step.unresolved) problem(`未完成：${step.unresolved}`, step.order);
    else if (!step.moves?.length) problem('沒有任何卡片移動，無法確認這一步做了什麼（不能用「接著正常展開」這類描述代替實際操作）', step.order);
  }
}

function checkStep(
  step: ComboStep,
  before: Zones,
  moves: readonly { cardId: number; from: PlayZone; to: PlayZone }[],
  ctx: { problem: (m: string) => void; warn: (m: string) => void; q: (id: number) => string; cards?: ReadonlyMap<number, CardRecord> },
): void {
  const { problem, warn, q } = ctx;
  const moved = (id: number) => moves.some((m) => m.cardId === id);

  if (step.actorCardIds.length === 0) problem('沒有指定執行的卡');
  for (const id of step.actorCardIds) {
    const present = [...KEEPS_CARD].some((z) => (before[z].get(id) ?? 0) > 0);
    if (!present && !moved(id)) problem(`執行卡${q(id)}在此步之前不在手牌、場上、墓地或除外，且此步沒有移動它`);
  }

  const materials = tally(step.materialCardIds ?? []);
  for (const [id, n] of materials) {
    const leaving = moves.filter((m) => m.cardId === id);
    if (leaving.length < n) problem(`素材${q(id)}×${n}沒有對應的移動紀錄（素材必須離開原本的位置）`);
    if (FIELD_MATERIAL_SUMMONS.has(step.actionType) && leaving.some((m) => m.from !== 'field')) problem(`素材${q(id)}必須從場上移出`);
  }

  if (EXTRA_SUMMONS.has(step.actionType)) {
    const summoned = moves.filter((m) => m.from === 'extra' && m.to === 'field');
    if (summoned.length === 0) problem('從額外牌組召喚的步驟，必須有一張卡從額外牌組移到場上');
    for (const m of summoned) {
      const card = ctx.cards?.get(m.cardId);
      if (card && card.isExtraDeckType === false) problem(`${q(m.cardId)}不是額外牌組怪獸，不能從額外牌組召喚`);
    }
  }
  if (step.actionType === 'normal-summon' && !moves.some((m) => m.from === 'hand' && m.to === 'field')) problem('通常召喚必須把一張手牌的怪獸移到場上');
  if (step.actionType === 'special-summon' && !moves.some((m) => m.to === 'field')) warn('特殊召喚的步驟沒有任何卡移到場上');
  if ((step.actionType === 'search' || step.actionType === 'add-to-hand') && !moves.some((m) => m.to === 'hand')) warn('檢索／加入手牌的步驟沒有任何卡移到手牌');
}
