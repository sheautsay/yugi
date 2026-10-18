import { allocateHand } from './hand-allocation';
import { HandClause } from './models';

// B7: exact probabilities for drawing from a known deck. The deck is a multiset (`Pool`: card id → copies left); cards
// nobody asks about are folded into one class so the number of outcomes stays small. Nothing here is random: the
// same deck and the same question always give the same number.

export type Pool = ReadonlyMap<number, number>;

/** Stands for every card that no condition mentions (card ids are positive, so 0 is free). */
export const OTHER = 0;

export class TooLargeError extends Error {
  constructor() {
    super('分支樹太大，無法精確計算成功率');
  }
}

/** C(n, k) as a float (exact for the sizes of a deck: C(60, 10) < 2^53). */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) r = (r * (n - i + 1)) / i;
  return Math.round(r);
}

export const poolSize = (pool: Pool): number => [...pool.values()].reduce((s, n) => s + n, 0);

/** Probability that none of `k` cards drawn from `n` cards is one of the `m` special ones. */
export function pNone(n: number, m: number, k: number): number {
  if (k > n) return 0;
  return choose(n - m, k) / choose(n, k);
}

/** Probability of at least one of `m` special cards among `k` drawn from `n` (hypergeometric). */
export function pAtLeastOne(n: number, m: number, k: number): number {
  return 1 - pNone(n, m, k);
}

/** Probability of exactly `x` special cards among `k` drawn from `n` cards of which `m` are special. */
export function pExactly(n: number, m: number, k: number, x: number): number {
  return (choose(m, x) * choose(n - m, k - x)) / choose(n, k);
}

/** The pool with the relevant ids kept and every other card folded into {@link OTHER}. */
export function fold(pool: Pool, relevant: ReadonlySet<number>): Map<number, number> {
  const out = new Map<number, number>();
  for (const [id, n] of pool) {
    if (n <= 0) continue;
    const key = relevant.has(id) ? id : OTHER;
    out.set(key, (out.get(key) ?? 0) + n);
  }
  return out;
}

export interface DrawOutcome {
  /** How many of each (folded) card were drawn. */
  drawn: Map<number, number>;
  p: number;
}

/**
 * Every different result of drawing `k` cards from `pool`, with its exact probability (they add up to 1). When `k` is
 * bigger than the deck, the whole deck is drawn.
 */
export function drawOutcomes(pool: Pool, k: number, relevant: ReadonlySet<number>, limit = 200_000): DrawOutcome[] {
  const folded = fold(pool, relevant);
  const entries = [...folded];
  const total = poolSize(folded);
  const draw = Math.min(k, total);
  const denominator = choose(total, draw);
  const out: DrawOutcome[] = [];
  const picked = new Map<number, number>();
  const go = (i: number, left: number, weight: number) => {
    if (out.length > limit) throw new TooLargeError();
    if (i === entries.length) {
      if (left === 0) out.push({ drawn: new Map(picked), p: weight / denominator });
      return;
    }
    const [id, have] = entries[i];
    for (let c = 0; c <= Math.min(have, left); c++) {
      if (c > 0) picked.set(id, c);
      else picked.delete(id);
      go(i + 1, left - c, weight * choose(have, c));
    }
    picked.delete(id);
  };
  go(0, draw, 1);
  return out;
}

/** The cards that turned up as a list (the folded class is dropped: it can never satisfy a condition). */
export function drawnCards(drawn: ReadonlyMap<number, number>): number[] {
  return [...drawn].flatMap(([id, n]) => (id === OTHER ? [] : Array<number>(n).fill(id)));
}

/** Whether the drawn cards satisfy the branch condition (every clause gets its own cards, like an opening hand). */
export function conditionHolds(drawn: ReadonlyMap<number, number>, when: readonly HandClause[]): boolean {
  return allocateHand(drawnCards(drawn), when) !== null;
}

/** The pool after the drawn cards are known and gone from the deck. */
export function withoutDrawn(pool: Pool, drawn: ReadonlyMap<number, number>, relevant: ReadonlySet<number>): Map<number, number> {
  const next = fold(pool, relevant);
  for (const [id, n] of drawn) next.set(id, (next.get(id) ?? 0) - n);
  return next;
}
