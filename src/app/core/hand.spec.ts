import { checkHand, drawHand, mulberry32, remainingInMain, tally } from './hand';
import { CardCount } from './models';

const main: CardCount[] = [
  { cardId: 1, count: 3 },
  { cardId: 2, count: 1 },
  { cardId: 3, count: 2 },
  ...Array.from({ length: 34 }, (_, i) => ({ cardId: 100 + i, count: 1 })),
];

describe('checkHand — G4 / G16', () => {
  it('accepts exactly 5 (first) or 6 (second) cards within the deck copies', () => {
    expect(checkHand(main, [1, 1, 1, 2, 3], 5)).toEqual({ complete: true, errors: [] });
    expect(checkHand(main, [1, 1, 1, 2, 3, 3], 6)).toEqual({ complete: true, errors: [] });
  });

  it('is incomplete (no error) until the hand is full', () => {
    expect(checkHand(main, [1, 2], 5)).toEqual({ complete: false, errors: [] });
    expect(checkHand(main, [1, 2, 3, 100, 101], 6).complete).toBe(false);
  });

  it('N3: picking the same card twice when the deck has one copy is rejected', () => {
    const result = checkHand(main, [2, 2, 1, 3, 100], 5);
    expect(result.complete).toBe(false);
    expect(result.errors).toEqual(['「ID 2」選了 2 張，但主牌組只有 1 張']);
  });

  it('N3: an old hand becomes invalid after the deck list changes', () => {
    const hand = [1, 1, 1, 2, 3];
    const edited = main.map((c) => (c.cardId === 1 ? { ...c, count: 2 } : c));
    expect(checkHand(main, hand, 5).complete).toBe(true);
    expect(checkHand(edited, hand, 5).errors).toEqual(['「ID 1」選了 3 張，但主牌組只有 2 張']);
    expect(checkHand(main.filter((c) => c.cardId !== 2), hand, 5).errors).toEqual(['「ID 2」不在主牌組中']);
  });

  it('N12: a 6-card hand switched back to first player must lose a card before querying', () => {
    const result = checkHand(main, [1, 1, 1, 2, 3, 3], 5);
    expect(result.complete).toBe(false);
    expect(result.errors).toEqual(['手牌有 6 張，先攻只能 5 張，請移除 1 張']);
  });

  it('N12: over-allocation is also caught in 6-card hands', () => {
    expect(checkHand(main, [3, 3, 3, 1, 2, 100], 6).errors).toEqual(['「ID 3」選了 3 張，但主牌組只有 2 張']);
  });

  it('remainingInMain subtracts the hand from the deck copies', () => {
    expect(remainingInMain(main, [1, 1, 2], 1)).toBe(1);
    expect(remainingInMain(main, [1, 1, 2], 2)).toBe(0);
    expect(remainingInMain(main, [1, 1, 2], 999)).toBe(0);
  });
});

describe('drawHand — G4 / G16 without replacement, reproducible', () => {
  it('the same seed gives the same hand; different seeds usually differ', () => {
    expect(drawHand(main, 5, 42)).toEqual(drawHand(main, 5, 42));
    expect(drawHand(main, 6, 7)).toEqual(drawHand(main, 6, 7));
    const distinct = new Set(Array.from({ length: 20 }, (_, s) => drawHand(main, 5, s).join(',')));
    expect(distinct.size).toBeGreaterThan(15);
  });

  it('never draws more copies than the deck holds (2000 seeded draws of 5 and 6)', () => {
    for (let seed = 0; seed < 1000; seed++) {
      for (const size of [5, 6]) {
        const hand = drawHand(main, size, seed);
        expect(hand).toHaveLength(size);
        expect(checkHand(main, hand, size as 5 | 6).complete).toBe(true);
      }
    }
  });

  it('samples by actual copies: a 3-copy card appears about 3× as often as a 1-copy card', () => {
    let three = 0;
    let one = 0;
    for (let seed = 0; seed < 4000; seed++) {
      const counts = tally(drawHand(main, 5, seed));
      three += counts.get(1) ?? 0;
      one += counts.get(2) ?? 0;
    }
    // Expected per draw: 5 × 3/40 = 0.375 vs 5 × 1/40 = 0.125.
    expect(three / 4000).toBeGreaterThan(0.33);
    expect(three / 4000).toBeLessThan(0.42);
    expect(three / one).toBeGreaterThan(2.4);
    expect(three / one).toBeLessThan(3.8);
  });

  it('does not mutate the deck list and rejects decks that are too small', () => {
    const snapshot = structuredClone(main);
    drawHand(main, 6, 1);
    expect(main).toEqual(snapshot);
    expect(() => drawHand([{ cardId: 1, count: 3 }], 5, 1)).toThrow('無法抽 5 張');
  });

  it('mulberry32 is deterministic', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
