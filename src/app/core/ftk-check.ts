import { effectRule } from './card-rules';
import { ParsedDeck } from './deck';
import { Pool, TooLargeError, conditionHolds, drawOutcomes, withoutDrawn } from './ftk-probability';
import { CardRecord, ComboRoute, ComboStep, FTK_DEFAULT_OPPONENT_EXTRA, FTK_TARGET_LP, FtkInfo, RouteBranch } from './models';
import { checkRoute, routeHand } from './route-check';
import { allSteps, branchConditionIds, clauseText } from './route-tree';

// B7: the local check of a first-turn-kill (FTK) route. A route may branch after a random step (draw / excavate).
// Each way through the tree is replayed as an ordinary route — with the cards its branch condition names put in the
// hand — by the normal data check, so every branch gets the same card-position and count checks. On top of that:
//  - a random step never says which cards turn up (the branch condition does);
//  - the damage is worked out HERE from the rule table (never taken from the author's number);
//  - a branch only counts as a success when the opponent's Life Points really reach 0 on that way;
//  - a Trap Set this turn needs an effect that lets it be activated;
//  - the chance of success is exact (hypergeometric), added up over the tree.
// Not a rules engine: it cannot tell whether an effect may really be activated, and it assumes no interruption.

export interface FtkIssue {
  message: string;
  /** The way through the tree this belongs to, e.g. 「抽到 X」→ 否則; empty = the main line. */
  branch?: string;
  /** Step order within its own list. */
  step?: number;
}

export interface FtkLeaf {
  /** Branch ids from the main line to this end, joined with "/" (empty for a route without branches). */
  key: string;
  /** Readable path, e.g. ['抽到 X', '否則']. */
  labels: string[];
  /** Steps of this way through, in order (the branching steps included). */
  steps: ComboStep[];
  /** What the author wrote for this branch. */
  claimed?: 'success' | 'fail';
  /** The opponent's Life Points when this way ends (≤ 0 = the kill). */
  opponentLp: number;
  /** Damage dealt along this way (counted from the rule table). */
  damage: number;
  /** The opponent's gains on the way (Chicken Game). */
  recovered: number;
  selfLp: number;
  /** The opponent's banished cards at the end. */
  opponentBanished: number;
  problems: FtkIssue[];
  /** The kill is reached AND nothing on this way broke a check. */
  success: boolean;
}

export type FtkProbability = { ok: true; p: number } | { ok: false; error: string };

export interface FtkCheck {
  passed: boolean;
  problems: FtkIssue[];
  warnings: FtkIssue[];
  leaves: FtkLeaf[];
  info: FtkInfo;
  /** Chance that a hand like this one wins, with the deck as it is at the start of the route. */
  probability: FtkProbability;
}

export interface FtkOptions {
  cards?: ReadonlyMap<number, CardRecord>;
  name?: (cardId: number) => string;
}

export const ftkInfoOf = (route: Pick<ComboRoute, 'ftk'>): FtkInfo => route.ftk ?? { targetDamage: FTK_TARGET_LP, opponentExtraDeck: FTK_DEFAULT_OPPONENT_EXTRA };

/** True for a route that has to be checked as an FTK route (random steps, branches or an FTK block). */
export const isFtkRoute = (route: Pick<ComboRoute, 'steps' | 'ftk'>) => !!route.ftk || allSteps(route.steps).some((s) => s.random || s.branches?.length);

interface Path {
  steps: ComboStep[];
  taken: Array<{ step: ComboStep; branch: RouteBranch }>;
}

function paths(list: readonly ComboStep[], prefix: ComboStep[], taken: Path['taken'], out: Path[]): void {
  const steps = [...prefix, ...list];
  const last = list.at(-1);
  if (last?.branches?.length) for (const branch of last.branches) paths(branch.steps, steps, [...taken, { step: last, branch }], out);
  else out.push({ steps, taken });
}

const MAX_COMBINATIONS = 12;

/** Which concrete cards could have turned up for a branch condition: one member per clause. */
function assumptions(when: RouteBranch['when']): number[][] {
  if (!when) return [[]];
  let combos: number[][] = [[]];
  for (const clause of when) combos = combos.flatMap((c) => clause.anyOf.map((id) => [...c, ...Array<number>(clause.count).fill(id)]));
  return combos;
}

interface Replay {
  problems: FtkIssue[];
  damage: number;
  recovered: number;
  opponentLp: number;
  selfLp: number;
  opponentBanished: number;
}

export function checkFtkRoute(route: ComboRoute, deck: Pick<ParsedDeck, 'main' | 'extra'>, options: FtkOptions = {}): FtkCheck {
  const cards = options.cards;
  const name = options.name ?? ((id: number) => cards?.get(id)?.nameEn ?? `ID ${id}`);
  const info = ftkInfoOf(route);
  const problems: FtkIssue[] = [];
  const warnings: FtkIssue[] = [];
  const seen = new Map<FtkIssue[], Set<string>>();
  const add = (list: FtkIssue[], issue: FtkIssue) => {
    const key = `${issue.branch ?? ''}|${issue.step ?? ''}|${issue.message}`;
    const keys = seen.get(list) ?? seen.set(list, new Set()).get(list)!;
    if (!keys.has(key)) {
      keys.add(key);
      list.push(issue);
    }
  };

  // The steps themselves, once (not per way through).
  for (const s of allSteps(route.steps)) {
    const where = `步驟「${s.title || s.order}」`;
    if (s.random?.count && s.moves?.length) add(problems, { message: `${where}是結果未知的${s.actionType === 'excavate' ? '翻開' : '抽牌'}，不能寫出抽到的卡（用分支條件表達），請移除這一步的卡片移動`, step: s.order });
    if (s.branches?.length) {
      for (const b of s.branches) {
        const need = (b.when ?? []).reduce((n, c) => n + c.count, 0);
        if (s.random && need > s.random.count) add(problems, { message: `${where}只翻／抽 ${s.random.count} 張，但分支「${b.label}」的條件需要 ${need} 張`, step: s.order });
      }
    }
  }
  if (route.steps.length === 0) add(problems, { message: '路線沒有步驟' });

  const all: Path[] = [];
  paths(route.steps, [], [], all);
  const handResult = routeHand(route);
  const leaves: FtkLeaf[] = [];

  for (const path of all) {
    const labels = path.taken.map((t) => t.branch.label);
    const label = labels.length ? labels.join(' → ') : undefined;
    const combos = path.taken.reduce<number[][][]>((acc, t) => acc.flatMap((a) => assumptions(t.branch.when).map((c) => [...a, c])), [[]]);
    const used = combos.slice(0, MAX_COMBINATIONS);
    if (combos.length > MAX_COMBINATIONS) add(warnings, { message: `分支條件的「或」選項組合有 ${combos.length} 種，只檢查前 ${MAX_COMBINATIONS} 種`, ...(label ? { branch: label } : {}) });

    let first: Replay | null = null;
    const leafProblems: FtkIssue[] = [];
    for (const combo of used) {
      const replay = replayPath(route, path, combo, deck, { cards, name, info, label, add: (issue) => add(leafProblems, issue), addWarn: (issue) => add(warnings, issue), handOk: 'hand' in handResult });
      first ??= replay;
    }
    const r = first!;
    for (const issue of leafProblems) add(problems, issue);
    const claimed = path.taken.at(-1)?.branch.outcome;
    const killed = r.opponentLp <= 0;
    const mine = leafProblems.length === 0;
    if (claimed === 'success' && !killed) add(problems, { message: `標為成功，但依規則表計算對手 LP 還剩 ${r.opponentLp}（傷害 ${r.damage}${r.recovered ? `、對手回復 ${r.recovered}` : ''}），沒有打到 0；不能標為成功`, ...(label ? { branch: label } : {}) });
    if (claimed === 'fail' && killed && mine) add(warnings, { message: '標為失敗，但本機計算這條路可以打到 0（沒有採用作者的標示）', ...(label ? { branch: label } : {}) });
    leaves.push({
      key: path.taken.map((t) => t.branch.id).join('/'),
      labels,
      steps: path.steps,
      ...(claimed ? { claimed } : {}),
      opponentLp: r.opponentLp,
      damage: r.damage,
      recovered: r.recovered,
      selfLp: r.selfLp,
      opponentBanished: r.opponentBanished,
      problems: leafProblems,
      success: killed && mine,
    });
  }

  let probability: FtkProbability;
  if (!('hand' in handResult)) probability = { ok: false, error: handResult.error };
  else {
    const pool = remainingPool(deck, handResult.hand);
    try {
      probability = { ok: true, p: probabilityOf(route, leaves, pool) };
    } catch (error) {
      probability = { ok: false, error: error instanceof TooLargeError ? error.message : '無法計算成功率' };
    }
  }
  return { passed: problems.length === 0, problems, warnings, leaves, info, probability };
}

/** The deck as a multiset after the opening hand. */
export function remainingPool(deck: Pick<ParsedDeck, 'main'>, known: readonly number[]): Map<number, number> {
  const pool = new Map<number, number>();
  for (const r of deck.main) if (r.count > 0) pool.set(r.cardId, (pool.get(r.cardId) ?? 0) + r.count);
  for (const id of known) pool.set(id, Math.max(0, (pool.get(id) ?? 0) - 1));
  return pool;
}

function replayPath(
  route: ComboRoute,
  path: Path,
  assumed: number[][],
  deck: Pick<ParsedDeck, 'main' | 'extra'>,
  ctx: { cards?: ReadonlyMap<number, CardRecord>; name: (id: number) => string; info: FtkInfo; label?: string; add: (issue: FtkIssue) => void; addWarn: (issue: FtkIssue) => void; handOk: boolean },
): Replay {
  const { cards, name, info, label } = ctx;
  const at = (message: string, step?: number): FtkIssue => ({ message, ...(label ? { branch: label } : {}), ...(step !== undefined ? { step } : {}) });

  // The way through as one ordinary list of steps: a branching step gets the cards its condition names.
  const origin: Array<{ order: number }> = [];
  const synthetic: ComboStep[] = path.steps.map((s) => {
    origin.push({ order: s.order });
    const taken = path.taken.findIndex((t) => t.step === s);
    const injected = taken >= 0 && s.random ? assumed[taken].map((cardId) => ({ cardId, from: 'deck' as const, to: s.random!.to })) : [];
    if (taken >= 0 && s.random && assumed[taken].length > s.random.count) ctx.add(at(`分支條件需要 ${assumed[taken].length} 張，但這一步只有 ${s.random.count} 張`, s.order));
    return { ...s, branches: undefined, order: origin.length, moves: [...(s.moves ?? []), ...injected] };
  });
  const linear: ComboRoute = { ...route, schemaVersion: 1, steps: synthetic, endBoard: [], analysis: undefined, ftk: undefined };
  const check = checkRoute(linear, deck, { cards, name });
  for (const p of check.problems) {
    if (p.message === '路線沒有預計終場') continue;
    const o = p.step ? origin[p.step - 1] : undefined;
    ctx.add(at(p.message, o?.order));
  }
  for (const p of check.warnings) ctx.addWarn(at(p.message, p.step ? origin[p.step - 1]?.order : undefined));

  // Life Points, the opponent's banished cards and the Traps Set this turn.
  const states = synthetic.map((_, i) => (i === 0 ? check.start : check.afterStep[i - 1]));
  const life = walkLife(synthetic, { cards, info, gyBefore: (i) => states[i].gy });
  life.issues.forEach((i) => (i.kind === 'warn' ? ctx.addWarn(at(i.message, origin[i.index].order)) : ctx.add(at(i.message, origin[i.index].order))));
  if (cards) for (const i of trapActivationIssues(synthetic, cards, name)) ctx.add(at(i.message, origin[i.index].order));
  return { problems: [], damage: life.damage, recovered: life.recovered, opponentLp: life.opponentLp, selfLp: life.selfLp, opponentBanished: life.opponentBanished };
}

export interface LifeIssue {
  /** Index into the step list that was walked. */
  index: number;
  message: string;
  kind?: 'warn';
}

export interface LifeResult {
  damage: number;
  recovered: number;
  opponentLp: number;
  selfLp: number;
  opponentBanished: number;
  issues: LifeIssue[];
}

/**
 * The Life Points and the opponent's banished cards after each step, worked out from the rule table and the steps' own card
 * moves. A number the author wrote on a step is only compared, never used.
 */
export function walkLife(steps: readonly ComboStep[], ctx: { cards?: ReadonlyMap<number, CardRecord>; info: FtkInfo; gyBefore: (stepIndex: number) => ReadonlyArray<{ cardId: number; count: number }> }): LifeResult {
  const { cards, info } = ctx;
  const result: LifeResult = { damage: 0, recovered: 0, opponentLp: info.targetDamage, selfLp: 8000, opponentBanished: 0, issues: [] };
  const isTrap = (id: number) => cards?.get(id)?.kind === 'trap';
  steps.forEach((s, index) => {
    const moves = s.moves ?? [];
    const rule = s.effectRef && cards ? effectRule(s.effectRef, cards) : null;
    const ftk = rule?.ftk;
    let stepDamage = 0;
    if (ftk) {
      if (ftk.banishesOpponentExtraEqualToOwn) {
        const own = moves.filter((m) => m.from === 'extra' && m.to === 'banished').length;
        result.opponentBanished += Math.max(0, Math.min(own, info.opponentExtraDeck - result.opponentBanished));
      }
      if (ftk.damagePerOpponentBanished) stepDamage += ftk.damagePerOpponentBanished * result.opponentBanished;
      if (ftk.damage) stepDamage += ftk.damage;
      if (ftk.opponentLp) {
        if (ftk.opponentLp > 0) {
          result.recovered += ftk.opponentLp;
          result.opponentLp += ftk.opponentLp;
        } else stepDamage += -ftk.opponentLp;
      }
      if (typeof ftk.selfLp === 'number') result.selfLp += ftk.selfLp;
      else if (ftk.selfLp === 'half') result.selfLp = Math.ceil(result.selfLp / 2);
      if (result.selfLp <= 0) result.issues.push({ index, message: `自己的 LP 在這一步歸零（${result.selfLp}），輸掉了` });
      const allow = ftk.setAllowsActivationThisTurn;
      if (allow?.minTrapsInGy) {
        const trapsInGy = ctx.gyBefore(index).reduce((n, r) => n + (isTrap(r.cardId) ? r.count : 0), 0);
        const setNow = moves.filter((m) => m.to === 'field' && m.from !== 'field' && isTrap(m.cardId));
        if (trapsInGy < allow.minTrapsInGy && setNow.length) result.issues.push({ index, message: `這個效果只有在墓地有 ${allow.minTrapsInGy} 張以上陷阱時，蓋放的卡才能在這回合發動；此時墓地只有 ${trapsInGy} 張` });
      }
    } else if (s.effectRef && cards) {
      result.issues.push({ index, kind: 'warn', message: `效果 ${s.effectRef} 不在規則表（或卡片文字不符）：它的傷害與 LP 變化沒有計入` });
    }
    if (s.claimedDamage !== undefined && s.claimedDamage !== stepDamage) result.issues.push({ index, kind: 'warn', message: `作者寫的傷害 ${s.claimedDamage} 與本機依規則表計算的 ${stepDamage} 不同；採用本機計算` });
    result.damage += stepDamage;
    result.opponentLp -= stepDamage;
  });
  return result;
}

/**
 * A Trap Set this turn cannot be activated this turn unless an effect allows it (Trap Trick, Trap Holic: the card they Set
 * "can be activated this turn"). Returns the activations that have no such permission.
 */
export function trapActivationIssues(steps: readonly ComboStep[], cards: ReadonlyMap<number, CardRecord>, name: (id: number) => string): LifeIssue[] {
  const issues: LifeIssue[] = [];
  const isTrap = (id: number) => cards.get(id)?.kind === 'trap';
  const setThisTurn = new Map<number, number>();
  const allowed = new Map<number, number>();
  steps.forEach((s, index) => {
    const moves = s.moves ?? [];
    const allows = !!(s.effectRef && effectRule(s.effectRef, cards)?.ftk?.setAllowsActivationThisTurn);
    if (s.actionType === 'set' || allows) {
      for (const m of moves) {
        if (m.to !== 'field' || m.from === 'field' || !isTrap(m.cardId)) continue;
        setThisTurn.set(m.cardId, (setThisTurn.get(m.cardId) ?? 0) + 1);
        if (allows) allowed.set(m.cardId, (allowed.get(m.cardId) ?? 0) + 1);
      }
    }
    if (s.actionType !== 'activate') return;
    for (const id of s.actorCardIds) {
      if (!isTrap(id) || (setThisTurn.get(id) ?? 0) === 0) continue;
      if ((allowed.get(id) ?? 0) > 0) {
        allowed.set(id, allowed.get(id)! - 1);
        setThisTurn.set(id, setThisTurn.get(id)! - 1);
      } else issues.push({ index, message: `「${name(id)}」是這回合蓋放的陷阱，需要「陷阱戲法」「陷阱愛好者」這類效果允許，才能在蓋放的回合發動；這一步之前沒有` });
    }
  });
  return issues;
}

// ---- probability over the branch tree ----------------------------------------------------------------

export interface NodeBranchOdds {
  branch: RouteBranch;
  /** Chance that the cards drawn here lead to this branch (the first branch whose condition holds is taken). */
  mass: number;
  /** Chance of the kill once this branch is taken. */
  success: number;
}

const BUDGET = 400_000;

/** Chance of the kill from the start of `list`, with `pool` the deck as it is now. `chain` = branch ids taken so far. */
export function listProbability(route: Pick<ComboRoute, 'steps'>, list: readonly ComboStep[], leaves: readonly FtkLeaf[], pool: Pool, chain: readonly string[] = []): number {
  const relevant = new Set(branchConditionIds(route));
  const win = new Set(leaves.filter((l) => l.success).map((l) => l.key));
  let work = 0;
  const go = (steps: readonly ComboStep[], pl: Pool, ids: readonly string[]): number => {
    if (++work > BUDGET) throw new TooLargeError();
    const last = steps.at(-1);
    if (!last?.branches?.length || !last.random) return win.has(ids.join('/')) ? 1 : 0;
    let sum = 0;
    for (const o of drawOutcomes(pl, last.random.count, relevant)) {
      const b = last.branches.find((br) => br.when === null || conditionHolds(o.drawn, br.when));
      if (b) sum += o.p * go(b.steps, withoutDrawn(pl, o.drawn, relevant), [...ids, b.id]);
    }
    return sum;
  };
  return go(list, pool, chain);
}

function probabilityOf(route: ComboRoute, leaves: readonly FtkLeaf[], pool: Pool): number {
  return listProbability(route, route.steps, leaves, pool);
}

/** For one branching step: how likely each branch is and how likely the kill is after it. Pure reading. */
export function nodeOdds(route: Pick<ComboRoute, 'steps'>, step: ComboStep, leaves: readonly FtkLeaf[], pool: Pool, chain: readonly string[]): NodeBranchOdds[] {
  if (!step.random || !step.branches?.length) return [];
  const relevant = new Set(branchConditionIds(route));
  const mass = new Map<string, number>();
  const wins = new Map<string, number>();
  for (const o of drawOutcomes(pool, step.random.count, relevant)) {
    const b = step.branches.find((br) => br.when === null || conditionHolds(o.drawn, br.when));
    if (!b) continue;
    mass.set(b.id, (mass.get(b.id) ?? 0) + o.p);
    wins.set(b.id, (wins.get(b.id) ?? 0) + o.p * listProbability(route, b.steps, leaves, withoutDrawn(pool, o.drawn, relevant), [...chain, b.id]));
  }
  return step.branches.map((branch) => {
    const m = mass.get(branch.id) ?? 0;
    return { branch, mass: m, success: m > 0 ? (wins.get(branch.id) ?? 0) / m : 0 };
  });
}

/** The branch a set of actually revealed cards leads to (the first whose condition holds), or null when none does. */
export function branchFor(step: ComboStep, revealed: readonly number[]): RouteBranch | null {
  const drawn = new Map<number, number>();
  for (const id of revealed) drawn.set(id, (drawn.get(id) ?? 0) + 1);
  return step.branches?.find((b) => b.when === null || conditionHolds(drawn, b.when)) ?? null;
}

export const describeCondition = (b: RouteBranch, name: (id: number) => string) => (b.when ? `抽到 ${clauseText(b.when, name)}` : '否則（都沒有）');

