import { ParsedDeck, countOf, deckFingerprint } from './deck';
import { remainingInMain, tally } from './hand';
import { ComboRoute, HandClause, MatchKind, MatchReasonCode, RouteConditions, RouteMatch, TurnOrder } from './models';

/** The player's situation; hand size follows `turnOrder` (rev1 R3/R4). */
export interface MatchContext {
  turnOrder: TurnOrder;
  emptyBoard: boolean;
  normalSummonAvailable: boolean;
  noInterruption: boolean;
}

export interface MatchOptions {
  name?: (cardId: number) => string;
  /** When given, routes referencing cards outside this set are `unknown` (missing card data). */
  knownCardIds?: ReadonlySet<number>;
}

export interface RouteResult {
  route: ComboRoute;
  match: RouteMatch;
}

const MAX_HAND = 6;
const isId = (v: unknown) => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 0xffffffff;
const isCount = (v: unknown, max = Infinity) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max;

/** Structural problems that make a route impossible to evaluate. */
export function conditionErrors(c: RouteConditions): string[] {
  const errors: string[] = [];
  if (!Array.isArray(c.handAllOf) || c.handAllOf.length === 0) errors.push('起手條件至少需要一個群組');
  c.handAllOf?.forEach((clause, i) => {
    if (!Array.isArray(clause.anyOf) || clause.anyOf.length === 0) errors.push(`起手群組 ${i + 1} 的候選卡不可為空`);
    else if (!clause.anyOf.every(isId)) errors.push(`起手群組 ${i + 1} 含無效卡片 ID`);
    else if (new Set(clause.anyOf).size !== clause.anyOf.length) errors.push(`起手群組 ${i + 1} 的候選卡重複`);
    if (!isCount(clause.count, MAX_HAND)) errors.push(`起手群組 ${i + 1} 的張數必須是 1–${MAX_HAND} 的整數`);
  });
  const required = (c.handAllOf ?? []).reduce((s, cl) => s + (Number.isInteger(cl.count) ? cl.count : 0), 0);
  if (required > MAX_HAND) errors.push(`起手條件共需 ${required} 張，超過手牌上限 ${MAX_HAND} 張`);
  if (c.unallocatedHandMin !== undefined && !(Number.isInteger(c.unallocatedHandMin) && c.unallocatedHandMin >= 0)) {
    errors.push('剩餘代價張數必須是 0 以上的整數');
  }
  for (const [label, list] of [
    ['主牌組必要卡', c.mustRemainInMain],
    ['額外牌組必要卡', c.mustExistInExtra],
  ] as const) {
    if (list?.some((r) => !isId(r.cardId) || !isCount(r.count))) errors.push(`${label}含無效的卡片 ID 或張數`);
  }
  if (c.forbiddenInHand?.some((id) => !isId(id))) errors.push('起手禁止卡含無效卡片 ID');
  const s = c.setup;
  if (!s || !['first', 'second', 'either'].includes(s.turnOrder) || [s.emptyBoard, s.normalSummonAvailable, s.noInterruption].some((b) => typeof b !== 'boolean')) {
    errors.push('前置情境資料不完整');
  }
  return errors;
}

export function conditionCardIds(c: RouteConditions): number[] {
  return [
    ...new Set([
      ...c.handAllOf.flatMap((cl) => cl.anyOf),
      ...(c.mustRemainInMain ?? []).map((r) => r.cardId),
      ...(c.mustExistInExtra ?? []).map((r) => r.cardId),
      ...(c.forbiddenInHand ?? []),
    ]),
  ];
}

export function handRequirement(route: ComboRoute): number {
  return route.conditions.handAllOf.reduce((sum, c) => sum + c.count, 0);
}

/**
 * Assigns distinct hand cards to every clause slot (AND of ORs sharing one multiset), or null.
 * Backtracking over at most 6 cards; copies of the same ID are interchangeable, so each slot
 * tries each distinct ID once.
 */
export function allocateHand(hand: readonly number[], clauses: readonly HandClause[]): Array<{ clauseIndex: number; cardIds: number[] }> | null {
  const slots = clauses.flatMap((c, i) => Array<number>(c.count).fill(i));
  if (slots.length > hand.length) return null;
  const options = (i: number) => hand.filter((id) => clauses[i].anyOf.includes(id)).length;
  slots.sort((a, b) => options(a) - options(b));

  const used = hand.map(() => false);
  const chosen: number[] = [];
  const search = (s: number): boolean => {
    if (s === slots.length) return true;
    const tried = new Set<number>();
    for (let h = 0; h < hand.length; h++) {
      const id = hand[h];
      if (used[h] || tried.has(id) || !clauses[slots[s]].anyOf.includes(id)) continue;
      tried.add(id);
      used[h] = true;
      chosen[s] = h;
      if (search(s + 1)) return true;
      used[h] = false;
    }
    return false;
  };
  if (!search(0)) return null;

  return clauses.map((_, clauseIndex) => ({
    clauseIndex,
    cardIds: slots.flatMap((slotClause, s) => (slotClause === clauseIndex ? [hand[chosen[s]]] : [])),
  }));
}

/** Pure: never mutates its inputs; same inputs give the same result. */
export function matchRoute(route: ComboRoute, deck: ParsedDeck, hand: readonly number[], context: MatchContext, options: MatchOptions = {}): RouteMatch {
  const name = options.name ?? ((id: number) => `ID ${id}`);
  const reasons: RouteMatch['reasons'] = [];
  const add = (code: MatchReasonCode, textZhTw: string) => reasons.push({ code, textZhTw });
  const result = (kind: MatchKind, matchedHandAllocation?: RouteMatch['matchedHandAllocation']): RouteMatch => ({
    routeId: route.id,
    kind,
    ...(matchedHandAllocation ? { matchedHandAllocation } : {}),
    reasons,
  });

  const structural = conditionErrors(route.conditions);
  if (structural.length) {
    structural.forEach((e) => add('INVALID_ROUTE', `路線資料無效：${e}`));
    return result('unknown');
  }
  const c = route.conditions;

  const allocation = allocateHand(hand, c.handAllOf);
  if (!allocation) explainHandFailure(hand, c.handAllOf, name).forEach((t) => add('HAND_MISSING', t));

  const spare = hand.length - handRequirement(route);
  if (c.unallocatedHandMin && spare < c.unallocatedHandMin) {
    add('HAND_COST_MISSING', `分配起手條件後手牌剩 ${Math.max(spare, 0)} 張，此路線需要至少 ${c.unallocatedHandMin} 張可當代價`);
  }

  const handCounts = tally(hand);
  for (const id of c.forbiddenInHand ?? []) {
    if (handCounts.has(id)) add('FORBIDDEN_IN_HAND', `起手不可有「${name(id)}」（此路線需要它留在牌組）`);
  }
  for (const { cardId, count } of c.mustRemainInMain ?? []) {
    const left = remainingInMain(deck.main, hand, cardId);
    if (left < count) add('REMAINING_DECK_MISSING', `主牌組需仍有「${name(cardId)}」×${count}，起手後只剩 ${Math.max(left, 0)} 張`);
  }
  for (const { cardId, count } of c.mustExistInExtra ?? []) {
    const have = countOf(deck.extra, cardId);
    if (have < count) add('EXTRA_MISSING', `額外牌組需要「${name(cardId)}」×${count}，目前有 ${have} 張`);
  }

  const s = c.setup;
  if (s.turnOrder !== 'either' && s.turnOrder !== context.turnOrder) {
    add('CONTEXT_MISMATCH', s.turnOrder === 'first' ? '此路線限先攻（5 張起手）' : '此路線限後攻（6 張起手）');
  }
  if (s.emptyBoard && !context.emptyBoard) add('CONTEXT_MISMATCH', '此路線假設雙方場上為空');
  if (s.normalSummonAvailable && !context.normalSummonAvailable) add('CONTEXT_MISMATCH', '此路線需要可用的通常召喚權');
  if (s.noInterruption && !context.noInterruption) add('CONTEXT_MISMATCH', '此路線假設對手不干擾');

  if (route.verification.status === 'invalidated') add('UNVERIFIED', '此路線已標記為失效，不再建議使用');
  if (reasons.length) return result('unavailable');

  const missing = options.knownCardIds ? conditionCardIds(c).filter((id) => !options.knownCardIds!.has(id)) : [];
  if (missing.length) {
    add('MISSING_CARD_DATA', `缺少卡片資料（ID：${missing.join('、')}），請先下載卡片資料`);
    return result('unknown', allocation!);
  }

  const problem = verificationProblem(route, deck);
  if (problem) {
    add('UNVERIFIED', problem);
    return result('unverified', allocation!);
  }
  return result('available', allocation!);
}

/** Why a route is not "verified for this deck", or null when it is. */
export function verificationProblem(route: ComboRoute, deck: Pick<ParsedDeck, 'main' | 'extra'>): string | null {
  const v = route.verification;
  if (v.status === 'draft') return '此路線為草稿，尚未驗證';
  if (v.status === 'unverified') return '此路線尚未經人工實測驗證';
  if (v.status === 'invalidated') return '此路線已標記為失效';
  if (route.steps.length === 0) return '此路線沒有步驟，不能視為已驗證';
  if (!v.verifiedAt || !v.verifiedBy || !v.evidenceNote || !v.deckFingerprint) return '此路線的驗證資料不完整（需實測日期、驗證者、證據與牌表指紋）';
  const fingerprint = deckFingerprint(deck);
  if (v.deckFingerprint !== fingerprint) return `此路線是以另一份牌表驗證（${v.deckFingerprint}），目前牌組（${fingerprint}）尚未實測`;
  return null;
}

const KIND_ORDER: Record<MatchKind, number> = { available: 0, unverified: 1, unknown: 2, unavailable: 3 };

/** Spec F06 default order: verified & matching → ranking weight → fewer hand cards → name. */
export function matchRoutes(routes: readonly ComboRoute[], deck: ParsedDeck, hand: readonly number[], context: MatchContext, options: MatchOptions = {}): RouteResult[] {
  return routes
    .map((route) => ({ route, match: matchRoute(route, deck, hand, context, options) }))
    .sort(
      (a, b) =>
        KIND_ORDER[a.match.kind] - KIND_ORDER[b.match.kind] ||
        (b.route.rankingWeight ?? 0) - (a.route.rankingWeight ?? 0) ||
        handRequirement(a.route) - handRequirement(b.route) ||
        a.route.name.localeCompare(b.route.name, 'zh-Hant'),
    );
}

function explainHandFailure(hand: readonly number[], clauses: readonly HandClause[], name: (id: number) => string): string[] {
  const counts = tally(hand);
  const reasons = clauses.flatMap((clause) => {
    const have = clause.anyOf.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
    if (have >= clause.count) return [];
    const label = clause.anyOf.map((id) => `「${name(id)}」`).join('或');
    return [`起手需要${label}${clause.anyOf.length > 1 ? '共' : ''} ${clause.count} 張，目前手牌只有 ${have} 張`];
  });
  return reasons.length ? reasons : ['手牌無法同時滿足所有起手條件：同一張卡不能同時分配給兩個條件'];
}
