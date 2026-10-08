import { ParsedDeck, banHints, checkDeck, countsFromIds, parseCardId } from './deck';
import { CardRecord } from './models';

function card(cardId: number, isExtraDeckType = false): CardRecord {
  return { cardId, nameEn: `Card ${cardId}`, kind: 'monster', isExtraDeckType, source: 'test', updatedAt: '2026-10-08T00:00:00.000Z' };
}

function cardMap(deck: ParsedDeck): Map<number, CardRecord> {
  const map = new Map<number, CardRecord>();
  for (const { cardId } of [...deck.main, ...deck.side]) map.set(cardId, card(cardId));
  for (const { cardId } of deck.extra) map.set(cardId, card(cardId, true));
  return map;
}

/** n distinct main-deck cards ×3 plus a remainder, so totals are exact. */
function mainOf(total: number, base = 1000) {
  const rows = [];
  for (let i = 0; total > 0; i++) {
    const count = Math.min(3, total);
    rows.push({ cardId: base + i, count });
    total -= count;
  }
  return rows;
}

const validDeck = (): ParsedDeck => ({ main: mainOf(40), extra: mainOf(15, 5000), side: mainOf(15, 9000) });

describe('checkDeck — G3 deck rules', () => {
  it('accepts a resolved 40 / 15 / 15 deck as queryable', () => {
    const deck = validDeck();
    expect(checkDeck(deck, cardMap(deck))).toEqual({ totals: { main: 40, extra: 15, side: 15 }, errors: [], unresolvedIds: [], queryable: true });
  });

  it('accepts 60 main and 0 extra', () => {
    const deck = { main: mainOf(60), extra: [], side: [] };
    expect(checkDeck(deck, cardMap(deck)).queryable).toBe(true);
  });

  it('rejects 39 or 61 main cards and 16 extra cards (N1: too few cards)', () => {
    for (const deck of [
      { ...validDeck(), main: mainOf(39) },
      { ...validDeck(), main: mainOf(61) },
      { ...validDeck(), extra: mainOf(16, 5000) },
    ]) {
      const result = checkDeck(deck, cardMap(deck));
      expect(result.queryable).toBe(false);
      expect(result.errors.join()).toMatch(/主牌 39|主牌 61|額外 16/);
    }
  });

  it('counts copies across zones for the 3-copy limit without mixing zone totals', () => {
    const deck = { ...validDeck(), side: [{ cardId: 1000, count: 1 }] };
    const result = checkDeck(deck, cardMap(deck));
    expect(result.totals).toEqual({ main: 40, extra: 15, side: 1 });
    expect(result.errors).toEqual(['「Card 1000」（ID 1000）共 4 張（同名卡最多 3 張）']);
  });

  it('N1: lists unresolved card IDs and blocks the normal query', () => {
    const deck = validDeck();
    const cards = cardMap(deck);
    cards.delete(1000);
    cards.delete(9000);
    const result = checkDeck(deck, cards);
    expect(result.unresolvedIds).toEqual([1000, 9000]);
    expect(result.queryable).toBe(false);
    expect(result.errors.join()).toContain('2 種卡片尚未識別');
  });

  it('flags extra-deck monsters in main and non-extra cards in extra, without moving them', () => {
    const deck = validDeck();
    const cards = cardMap(deck);
    cards.set(1000, card(1000, true));
    cards.set(5000, card(5000, false));
    const result = checkDeck(deck, cards);
    expect(result.errors).toHaveLength(2);
    expect(deck.main[0].cardId).toBe(1000);
    expect(deck.extra[0].cardId).toBe(5000);
  });

  it('flags duplicate rows and invalid counts', () => {
    const deck = { ...validDeck(), side: [{ cardId: 9000, count: 1 }, { cardId: 9000, count: 1 }, { cardId: 9001, count: 0 }] };
    const errors = checkDeck(deck, cardMap(deck)).errors.join();
    expect(errors).toContain('重複資料列');
    expect(errors).toContain('張數無效');
  });
});

describe('deck helpers', () => {
  it('countsFromIds keeps one row per ID in first-seen order', () => {
    expect(countsFromIds([3, 1, 3, 3, 2])).toEqual([
      { cardId: 3, count: 3 },
      { cardId: 1, count: 1 },
      { cardId: 2, count: 1 },
    ]);
  });

  it('parseCardId validates passcodes', () => {
    expect(parseCardId('89631139')).toBe(89631139);
    expect(parseCardId('-1')).toContain('負數');
    expect(parseCardId('1.0')).toContain('整數');
    expect(parseCardId('x1')).toContain('數字');
  });
});

describe('banHints — G20-4 (separate from the deck check)', () => {
  it('warns about the user\'s own Master Duel marks without making the deck a draft', () => {
    const deck = validDeck();
    const cards = cardMap(deck);
    cards.set(1000, { ...card(1000), mdBan: 'Limited' });
    cards.set(1001, { ...card(1001), mdBan: 'Semi-Limited' });
    cards.set(1002, { ...card(1002), mdBan: 'Forbidden' });
    expect(banHints(deck, cards)).toEqual([
      '「Card 1000」你標註為 Master Duel 限制卡（上限 1 張），目前 3 張',
      '「Card 1001」你標註為 Master Duel 準限制卡（上限 2 張），目前 3 張',
      '「Card 1002」你標註為 Master Duel 禁止卡（上限 0 張），目前 3 張',
    ]);
    expect(checkDeck(deck, cards).queryable).toBe(true);
  });

  it('gives no hint for unmarked cards or counts within the limit', () => {
    const deck = { ...validDeck(), main: [{ cardId: 7, count: 1 }] };
    expect(banHints(deck, new Map([[7, { ...card(7), mdBan: 'Limited' as const }]]))).toEqual([]);
  });
});
