import { HandClause } from './models';

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
