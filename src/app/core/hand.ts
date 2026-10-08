import { countOf } from './deck';
import { CardCount, HandSize } from './models';

export interface HandCheck {
  /** Exactly `handSize` cards, none exceeding the main-deck copies. */
  complete: boolean;
  errors: string[];
}

/** F05 / rev1 R3: a hand is a multiset drawn from the main deck only. */
export function checkHand(main: readonly CardCount[], hand: readonly number[], handSize: HandSize, name: (id: number) => string = (id) => `ID ${id}`): HandCheck {
  const errors: string[] = [];
  for (const [cardId, n] of tally(hand)) {
    const available = countOf(main, cardId);
    if (available === 0) errors.push(`「${name(cardId)}」不在主牌組中`);
    else if (n > available) errors.push(`「${name(cardId)}」選了 ${n} 張，但主牌組只有 ${available} 張`);
  }
  if (hand.length > handSize) errors.push(`手牌有 ${hand.length} 張，${handSize === 5 ? '先攻' : '後攻'}只能 ${handSize} 張，請移除 ${hand.length - handSize} 張`);
  return { complete: errors.length === 0 && hand.length === handSize, errors };
}

export function tally(ids: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** Copies still in the main deck after the hand is taken out. */
export function remainingInMain(main: readonly CardCount[], hand: readonly number[], cardId: number): number {
  return countOf(main, cardId) - (tally(hand).get(cardId) ?? 0);
}

/** Deterministic PRNG (mulberry32) so a draw is reproducible from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws without replacement from the actual main-deck copies (partial Fisher–Yates). */
export function drawHand(main: readonly CardCount[], size: number, seed: number): number[] {
  const pool = main.flatMap(({ cardId, count }) => Array<number>(count).fill(cardId));
  if (pool.length < size) throw new Error(`主牌只有 ${pool.length} 張，無法抽 ${size} 張`);
  const random = mulberry32(seed);
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size);
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
