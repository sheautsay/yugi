import { EMPTY_QUERY, CardQuery, facets, inPool, isDeckCard, pageOf, searchCards } from './card-search';
import { CardRecord } from './models';

function card(cardId: number, nameEn: string, extra: Partial<CardRecord> = {}): CardRecord {
  return { cardId, nameEn, kind: 'monster', isExtraDeckType: false, source: 'test', updatedAt: '', formats: ['Master Duel', 'TCG'], ...extra };
}

const CARDS: CardRecord[] = [
  card(32061192, 'Maliss <P> Dormouse', { archetype: 'Maliss', attribute: 'DARK', race: 'Cyberse', level: 3, nameZhTw: '碼莉絲〈P〉睡鼠', aliases: ['睡鼠'] }),
  card(69272449, 'Maliss <P> White Rabbit', { archetype: 'Maliss', attribute: 'DARK', race: 'Cyberse', level: 3 }),
  card(68059897, 'Maliss <Q> Red Ransom', { archetype: 'Maliss', attribute: 'DARK', race: 'Cyberse', isExtraDeckType: true, frameType: 'link', linkval: 3 }),
  card(68337209, 'Maliss in Underground', { kind: 'spell', archetype: 'Maliss', race: 'Field' }),
  card(20726052, 'Maliss <C> GWC-06', { kind: 'trap', archetype: 'Maliss', race: 'Normal' }),
  card(46986414, 'Dark Magician', { attribute: 'DARK', race: 'Spellcaster', level: 7, aliases: ['黑魔導'] }),
  card(38033121, 'Dark Magician Girl', { attribute: 'DARK', race: 'Spellcaster', level: 6 }),
  card(89631139, 'Blue-Eyes White Dragon', { attribute: 'LIGHT', race: 'Dragon', level: 8 }),
  card(11111111, 'TCG Only Card', { formats: ['TCG'] }),
  card(22222222, 'Old Cached Card', { formats: undefined }),
  card(33333333, 'Some Skill', { frameType: 'skill', kind: 'unknown', formats: ['Speed Duel'] }),
];

const q = (patch: Partial<CardQuery>): CardQuery => ({ ...EMPTY_QUERY, ...patch });
const ids = (cards: CardRecord[]) => cards.map((c) => c.cardId);

describe('searchCards — G18 text search', () => {
  it('matches English names partially and case-insensitively, prefix matches first', () => {
    expect(ids(searchCards(CARDS, q({ text: 'dark magician' })))).toEqual([46986414, 38033121]);
    expect(ids(searchCards(CARDS, q({ text: 'RABBIT' })))).toEqual([69272449]);
  });

  it('matches an exact card ID only', () => {
    expect(ids(searchCards(CARDS, q({ text: '32061192' })))).toEqual([32061192]);
    expect(searchCards(CARDS, q({ text: '3206119' }))).toEqual([]);
  });

  it('matches zh-TW names and aliases when the user has supplied them', () => {
    expect(ids(searchCards(CARDS, q({ text: '睡鼠' })))).toEqual([32061192]);
    expect(ids(searchCards(CARDS, q({ text: '碼莉絲' })))).toEqual([32061192]);
    expect(ids(searchCards(CARDS, q({ text: '黑魔導' })))).toEqual([46986414]);
  });

  it('N14: no result, special characters and very long input are handled safely', () => {
    expect(searchCards(CARDS, q({ text: 'zzzz no such card' }))).toEqual([]);
    expect(ids(searchCards(CARDS, q({ text: '<P>' })))).toEqual([32061192, 69272449]);
    expect(searchCards(CARDS, q({ text: '.*[(' }))).toEqual([]);
    expect(searchCards(CARDS, q({ text: 'a'.repeat(10_000) }))).toEqual([]);
    expect(searchCards(CARDS, q({ text: '99999999' }))).toEqual([]);
  });
});

describe('searchCards — G18 filters and pool', () => {
  it('filters by kind, deck zone, archetype, attribute, race and level', () => {
    expect(ids(searchCards(CARDS, q({ kind: 'spell' })))).toEqual([68337209]);
    expect(ids(searchCards(CARDS, q({ kind: 'trap' })))).toEqual([20726052]);
    expect(ids(searchCards(CARDS, q({ zone: 'extra' })))).toEqual([68059897]);
    expect(searchCards(CARDS, q({ zone: 'main', archetype: 'maliss' })).map((c) => c.nameEn)).toEqual([
      'Maliss <C> GWC-06',
      'Maliss <P> Dormouse',
      'Maliss <P> White Rabbit',
      'Maliss in Underground',
    ]);
    expect(ids(searchCards(CARDS, q({ attribute: 'LIGHT' })))).toEqual([89631139]);
    expect(ids(searchCards(CARDS, q({ race: 'Spellcaster', level: 7 })))).toEqual([46986414]);
  });

  it('Master Duel pool hides cards not listed for Master Duel; "all" shows them', () => {
    const md = ids(searchCards(CARDS, q({})));
    expect(md).not.toContain(11111111);
    expect(md).not.toContain(22222222);
    expect(ids(searchCards(CARDS, q({ pool: 'all' })))).toEqual(expect.arrayContaining([11111111, 22222222, 33333333]));
    expect(inPool(CARDS[0], 'master-duel')).toBe(true);
  });

  it('offers facet values from the pool only', () => {
    const f = facets(CARDS, 'master-duel');
    expect(f.archetypes).toEqual(['Maliss']);
    expect(f.attributes).toEqual(['DARK', 'LIGHT']);
    expect(f.levels).toEqual([3, 6, 7, 8]);
    expect(f.races).toContain('Field');
  });

  it('N16: Skill and Token cards are never deck cards', () => {
    expect(isDeckCard(CARDS[10])).toBe(false);
    expect(isDeckCard(card(1, 'Token', { frameType: 'token' }))).toBe(false);
    expect(isDeckCard(CARDS[0])).toBe(true);
  });
});

describe('pageOf and performance — G18-3', () => {
  it('pages results and clamps the page number', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(pageOf(items, 1)).toMatchObject({ page: 1, pages: 3, items: items.slice(0, 24) });
    expect(pageOf(items, 3).items).toEqual([48, 49]);
    expect(pageOf(items, 99).page).toBe(3);
    expect(pageOf([], 1)).toEqual({ items: [], page: 1, pages: 1 });
  });

  it('filters and sorts 15,000 cards in under 500 ms', () => {
    const big = Array.from({ length: 15_000 }, (_, i) =>
      card(100_000 + i, `Card ${i} ${i % 7 === 0 ? 'Dragon' : 'Warrior'}`, { archetype: `Arch${i % 300}`, level: (i % 12) + 1, attribute: i % 2 ? 'DARK' : 'LIGHT' }),
    );
    const started = performance.now();
    const results = searchCards(big, q({ text: 'dragon', attribute: 'DARK' }));
    const all = searchCards(big, q({}));
    facets(big, 'master-duel');
    const elapsed = performance.now() - started;
    expect(results.length).toBeGreaterThan(0);
    expect(all).toHaveLength(15_000);
    expect(elapsed).toBeLessThan(500);
  });
});
