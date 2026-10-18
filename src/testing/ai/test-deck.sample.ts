/** TEST DATA ONLY — an abstract 40/15 deck and card records for CR-004 unit tests. */
import { CardRecord, DeckRecord } from '../../app/core/models';
import { MockIds } from './mock-ai.sample';

export const IDS: MockIds = { starter: 101, searched: 102, extender: 103, filler: 104, link: 301, link2: 302, outsider: 999 };

const MAIN_FILLERS = Array.from({ length: 10 }, (_, i) => 201 + i);
const EXTRA_FILLERS = Array.from({ length: 13 }, (_, i) => 401 + i);

export function testDeck(patch: Partial<DeckRecord> = {}): DeckRecord {
  return {
    schemaVersion: 1,
    id: 'deck-1',
    name: '測試牌組',
    format: 'master-duel',
    version: 3,
    main: [
      { cardId: IDS.starter, count: 3 },
      { cardId: IDS.searched, count: 3 },
      { cardId: IDS.extender, count: 3 },
      { cardId: IDS.filler, count: 1 },
      ...MAIN_FILLERS.map((cardId) => ({ cardId, count: 3 })),
    ],
    extra: [{ cardId: IDS.link, count: 1 }, { cardId: IDS.link2, count: 1 }, ...EXTRA_FILLERS.map((cardId) => ({ cardId, count: 1 }))],
    side: [],
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
    ...patch,
  };
}

export function testCards(deck = testDeck()): Map<number, CardRecord> {
  const record = (cardId: number, extra: boolean): CardRecord => ({
    cardId,
    nameEn: `Test Card ${cardId}`,
    kind: 'monster',
    isExtraDeckType: extra,
    typeLine: extra ? 'Link Monster' : 'Effect Monster',
    // CR-006: Link Monsters carry arrows (the analysis is not sent without them).
    ...(extra ? { linkMarkers: ['Bottom' as const] } : {}),
    archetype: 'Testers',
    desc: `Effect text of ${cardId}.`,
    source: 'test',
    updatedAt: '2026-10-08T12:00:00.000Z',
  });
  return new Map([...deck.main.map((r) => [r.cardId, record(r.cardId, false)] as const), ...deck.extra.map((r) => [r.cardId, record(r.cardId, true)] as const)]);
}
