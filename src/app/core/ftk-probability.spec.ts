import { HandClause } from './models';
import { OTHER, TooLargeError, choose, conditionHolds, drawOutcomes, fold, pAtLeastOne, pExactly, poolSize, withoutDrawn } from './ftk-probability';

const pool = (rows: Array<[number, number]>) => new Map(rows);
const clause = (anyOf: number[], count = 1): HandClause => ({ anyOf, count });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 12);

describe('FTK probability (B7)', () => {
  it('counts combinations', () => {
    expect(choose(40, 5)).toBe(658008);
    expect(choose(5, 0)).toBe(1);
    expect(choose(3, 5)).toBe(0);
  });

  it('at least one of m copies in k draws is the textbook hypergeometric value', () => {
    // 40 cards, 3 copies, draw 5 → 1 − C(37,5)/C(40,5) = 0.3375… (a classic: ~33.76 %)
    near(pAtLeastOne(40, 3, 5), 1 - choose(37, 5) / choose(40, 5));
    expect(pAtLeastOne(40, 3, 5)).toBeCloseTo(0.3376, 3);
    expect(pAtLeastOne(40, 0, 5)).toBe(0);
    expect(pAtLeastOne(40, 40, 1)).toBe(1);
    near(pExactly(40, 3, 5, 0) + pExactly(40, 3, 5, 1) + pExactly(40, 3, 5, 2) + pExactly(40, 3, 5, 3), 1);
  });

  it('enumerates every different result once, and the probabilities add up to 1', () => {
    const p = pool([[1, 3], [2, 2], [3, 1], [4, 34]]);
    const outcomes = drawOutcomes(p, 5, new Set([1, 2, 3]));
    near(sum(outcomes.map((o) => o.p)), 1);
    // the 34 unmentioned cards are one class
    expect(outcomes.every((o) => [...o.drawn.keys()].every((id) => [1, 2, 3, OTHER].includes(id)))).toBe(true);
    expect(new Set(outcomes.map((o) => JSON.stringify([...o.drawn].sort()))).size).toBe(outcomes.length);
  });

  it('"at least one of A or B" over the outcomes equals the closed form (several different cards, repeated copies)', () => {
    const p = pool([[1, 3], [2, 2], [9, 35]]);
    const outcomes = drawOutcomes(p, 5, new Set([1, 2]));
    const viaOutcomes = sum(outcomes.filter((o) => conditionHolds(o.drawn, [clause([1, 2])])).map((o) => o.p));
    near(viaOutcomes, pAtLeastOne(40, 5, 5));
  });

  it('a condition that needs two different cards, or two copies of one, is exact', () => {
    const p = pool([[1, 3], [2, 2], [9, 35]]);
    const outcomes = drawOutcomes(p, 5, new Set([1, 2]));
    const both = sum(outcomes.filter((o) => conditionHolds(o.drawn, [clause([1]), clause([2])])).map((o) => o.p));
    // P(≥1 of A and ≥1 of B) = 1 − P(no A) − P(no B) + P(neither)
    near(both, 1 - choose(37, 5) / choose(40, 5) - choose(38, 5) / choose(40, 5) + choose(35, 5) / choose(40, 5));
    const twoCopies = sum(outcomes.filter((o) => conditionHolds(o.drawn, [clause([1], 2)])).map((o) => o.p));
    near(twoCopies, pExactly(40, 3, 5, 2) + pExactly(40, 3, 5, 3));
    // "A or B, twice" can be A+B as well as A+A
    const orTwice = sum(outcomes.filter((o) => conditionHolds(o.drawn, [clause([1, 2], 2)])).map((o) => o.p));
    near(orTwice, 1 - pExactly(40, 5, 5, 0) - pExactly(40, 5, 5, 1));
  });

  it('drawing more cards than the deck holds draws the whole deck', () => {
    const outcomes = drawOutcomes(pool([[1, 1], [2, 1]]), 5, new Set([1, 2]));
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].p).toBe(1);
    expect(poolSize(outcomes[0].drawn)).toBe(2);
  });

  it('removes what was drawn from the pool and keeps the rest', () => {
    const p = pool([[1, 3], [2, 2], [9, 35]]);
    const rest = withoutDrawn(p, new Map([[1, 1], [OTHER, 2]]), new Set([1, 2]));
    expect(rest.get(1)).toBe(2);
    expect(rest.get(2)).toBe(2);
    expect(rest.get(OTHER)).toBe(33);
    expect(fold(p, new Set()).get(OTHER)).toBe(40);
  });

  it('refuses a question with too many outcomes instead of hanging', () => {
    const many = pool(Array.from({ length: 40 }, (_, i) => [i + 1, 1] as [number, number]));
    expect(() => drawOutcomes(many, 10, new Set(many.keys()), 1000)).toThrow(TooLargeError);
  });
});
