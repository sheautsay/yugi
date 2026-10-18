import { CardRecord } from './models';
import { CardNameEntry, coverage, identifyCardName, labelFor, mayReplace, parseNameImport, searchNames, zhTwName } from './card-names';

// rev9 (G55–G68, N46–N52). Pure rules only: no storage, no UI. The Chinese names below are TEST FIXTURES
// written by the test itself (marked "測試用"); they are not official or community translations.

const card = (cardId: number, nameEn: string, extra: Partial<CardRecord> = {}): CardRecord => ({ cardId, nameEn, kind: 'monster', source: 'test', updatedAt: '2026-10-09T00:00:00.000Z', ...extra });
const entry = (cardId: number, status: CardNameEntry['translationStatus'], extra: Partial<CardNameEntry> = {}): CardNameEntry => ({
  cardId,
  aliases: [],
  translationSource: 'test-fixture',
  translationStatus: status,
  updatedAt: '2026-10-09T00:00:00.000Z',
  ...extra,
});

const DORMOUSE = card(32061192, 'Maliss <P> Dormouse');
const RABBIT = card(69272449, 'Maliss <P> White Rabbit');

describe('labelFor — language and fallback (G55, G58, G66)', () => {
  it('G55: a confirmed zh-TW name is shown in the zh-TW mode; English stays available in the both mode', () => {
    const e = entry(32061192, 'official', { nameZhTw: '測試用睡鼠' });
    expect(labelFor(32061192, DORMOUSE, e, 'zh-TW')).toBe('測試用睡鼠');
    expect(labelFor(32061192, DORMOUSE, e, 'both')).toBe('測試用睡鼠（Maliss <P> Dormouse）');
    expect(labelFor(32061192, DORMOUSE, e, 'en')).toBe('Maliss <P> Dormouse');
  });

  it('G58: without a zh-TW name the zh-TW mode falls back to the English name, never to a blank or a Chinese name of another variant', () => {
    expect(labelFor(32061192, DORMOUSE, undefined, 'zh-TW')).toBe('Maliss <P> Dormouse');
    expect(labelFor(32061192, DORMOUSE, entry(32061192, 'official', { nameZhCn: '測試用簡體' }), 'zh-TW')).toBe('Maliss <P> Dormouse');
    expect(labelFor(32061192, DORMOUSE, entry(32061192, 'official', { nameZhCn: '測試用簡體' }), 'both')).toBe('Maliss <P> Dormouse');
  });

  it('G58: an ID that is not in the local card database is shown as "未識別", not guessed', () => {
    expect(labelFor(99999999, undefined, undefined, 'zh-TW')).toBe('未識別');
    expect(labelFor(99999999, undefined, entry(99999999, 'community', { nameZhTw: '測試用' }), 'zh-TW')).toBe('未識別');
  });

  it('G67: a provisional name is always marked 暫定 and is never shown as an official name', () => {
    const e = entry(69272449, 'provisional', { nameZhTw: '測試用白兔' });
    expect(labelFor(69272449, RABBIT, e, 'zh-TW')).toBe('測試用白兔（暫定）');
    expect(labelFor(69272449, RABBIT, e, 'both')).toBe('測試用白兔（暫定）（Maliss <P> White Rabbit）');
    expect(zhTwName(RABBIT, e)?.status).toBe('provisional');
  });

  it('N51: a Simplified-only entry is not displayed as Traditional Chinese', () => {
    const e = entry(69272449, 'community', { nameZhCn: '測試用简体' });
    expect(labelFor(69272449, RABBIT, e, 'zh-TW')).toBe('Maliss <P> White Rabbit');
  });
});

describe('zhTwName — source priority and user corrections (G64, N49)', () => {
  it('G64: a user correction on the card wins over every imported entry', () => {
    const user = card(32061192, 'Maliss <P> Dormouse', { nameZhTw: '使用者修正' });
    const imported = entry(32061192, 'official', { nameZhTw: '正式名稱' });
    expect(zhTwName(user, imported)).toEqual({ text: '使用者修正', status: 'user', source: undefined });
  });

  it('N49: a user correction is still shown after an official entry is imported for the same card', () => {
    const user = card(32061192, 'Maliss <P> Dormouse', { nameZhTw: '使用者修正' });
    expect(labelFor(32061192, user, entry(32061192, 'official', { nameZhTw: '正式名稱' }), 'zh-TW')).toBe('使用者修正');
  });

  it('G64: a new entry replaces an existing one only when its rank is the same or higher', () => {
    expect(mayReplace(undefined, entry(1, 'provisional'))).toBe(true);
    expect(mayReplace(entry(1, 'provisional'), entry(1, 'official'))).toBe(true);
    expect(mayReplace(entry(1, 'community'), entry(1, 'community'))).toBe(true);
  });

  it('N50: a provisional entry never replaces an official one', () => {
    expect(mayReplace(entry(1, 'official'), entry(1, 'provisional'))).toBe(false);
    expect(mayReplace(entry(1, 'official'), entry(1, 'community'))).toBe(false);
  });
});

describe('searchNames — one card, many names (G56, G57)', () => {
  it('G57: Traditional, Simplified, English, aliases and the ID all belong to the same card entry', () => {
    const e = entry(69272449, 'community', { nameZhTw: '測試用白兔', nameZhCn: '测试用白兔', aliases: ['測試俗稱'] });
    const terms = searchNames(RABBIT, e);
    expect(terms.names).toEqual(expect.arrayContaining(['maliss <p> white rabbit', '測試用白兔', '测试用白兔']));
    expect(terms.aliases).toEqual(expect.arrayContaining(['測試俗稱']));
  });

  it('G56: a card-level alias (user correction) is searchable too', () => {
    const user = card(69272449, 'Maliss <P> White Rabbit', { aliases: ['測試別名'] });
    expect(searchNames(user, undefined).aliases).toContain('測試別名');
  });
});

describe('identifyCardName — AI and typed names are never guessed (G62, N46)', () => {
  const cards = new Map<number, CardRecord>([
    [32061192, DORMOUSE],
    [69272449, RABBIT],
    [1, card(1, 'Twin Name'), ],
    [2, card(2, 'Twin Name')],
  ]);
  const entries = new Map<number, CardNameEntry>([[69272449, entry(69272449, 'community', { nameZhTw: '測試用白兔', aliases: ['測試俗稱'] })]]);

  it('G62: a unique exact English, Traditional, alias or ID match is identified', () => {
    expect(identifyCardName('maliss <p> dormouse', cards, entries)).toEqual({ status: 'matched', cardId: 32061192 });
    expect(identifyCardName('測試用白兔', cards, entries)).toEqual({ status: 'matched', cardId: 69272449 });
    expect(identifyCardName('測試俗稱', cards, entries)).toEqual({ status: 'matched', cardId: 69272449 });
    expect(identifyCardName('32061192', cards, entries)).toEqual({ status: 'matched', cardId: 32061192 });
  });

  it('N46: a name shared by two cards is pending with the candidates listed, never chosen', () => {
    expect(identifyCardName('Twin Name', cards, entries)).toEqual({ status: 'pending', candidates: [1, 2] });
  });

  it('G62: an unknown or partial name is pending with no candidate, never a near match', () => {
    expect(identifyCardName('Maliss Dorm', cards, entries)).toEqual({ status: 'pending', candidates: [] });
    expect(identifyCardName('nothing like this', cards, entries)).toEqual({ status: 'pending', candidates: [] });
    expect(identifyCardName('  ', cards, entries)).toEqual({ status: 'pending', candidates: [] });
  });
});

describe('coverage — statistics (G65, G67)', () => {
  const cards = [DORMOUSE, RABBIT, card(3, 'Third'), card(4, 'Fourth')];
  it('counts each status and the untranslated cards, and does not count unknown IDs', () => {
    const entries = new Map<number, CardNameEntry>([
      [32061192, entry(32061192, 'official', { nameZhTw: 'A' })],
      [69272449, entry(69272449, 'provisional', { nameZhTw: 'B' })],
      [99999999, entry(99999999, 'community', { nameZhTw: 'C' })],
    ]);
    const userCard = card(4, 'Fourth', { nameZhTw: '使用者修正' });
    const stats = coverage([...cards.slice(0, 3), userCard], entries);
    expect(stats).toEqual({
      total: 4,
      translated: 3,
      untranslated: 1,
      byStatus: { user: 1, official: 1, community: 0, provisional: 1 },
      percent: 75,
    });
  });

  it('reports 0 percent for an empty database instead of dividing by zero', () => {
    expect(coverage([], new Map()).percent).toBe(0);
  });
});

describe('parseNameImport — the file is validated as a whole (G68, N52, N47)', () => {
  const good = JSON.stringify([{ cardId: 32061192, nameZhTw: '測試用睡鼠', translationSource: '測試檔案', translationStatus: 'community', aliases: ['測試俗稱'] }]);

  it('accepts a well-formed file', () => {
    const r = parseNameImport(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entries[0]).toMatchObject({ cardId: 32061192, nameZhTw: '測試用睡鼠', translationStatus: 'community', aliases: ['測試俗稱'] });
  });

  it('N47: broken JSON rejects the whole file', () => {
    expect(parseNameImport('[{"cardId": 1,').ok).toBe(false);
    expect(parseNameImport('{"not": "an array"}').ok).toBe(false);
  });

  it('N52: a user status in a file is rejected', () => {
    expect(parseNameImport(JSON.stringify([{ cardId: 1, nameZhTw: 'x', translationSource: 's', translationStatus: 'user' }])).ok).toBe(false);
  });

  it('N52: an unknown field, a non-integer ID, an empty source or a name longer than 80 characters rejects the whole file', () => {
    const base = { cardId: 1, nameZhTw: 'x', translationSource: 's', translationStatus: 'official' };
    expect(parseNameImport(JSON.stringify([{ ...base, extra: true }])).ok).toBe(false);
    expect(parseNameImport(JSON.stringify([{ ...base, cardId: 1.5 }])).ok).toBe(false);
    expect(parseNameImport(JSON.stringify([{ ...base, translationSource: '' }])).ok).toBe(false);
    expect(parseNameImport(JSON.stringify([{ ...base, nameZhTw: 'x'.repeat(81) }])).ok).toBe(false);
  });

  it('a file where one entry is bad is rejected as a whole, not partly applied', () => {
    const r = parseNameImport(JSON.stringify([{ cardId: 1, nameZhTw: 'x', translationSource: 's', translationStatus: 'official' }, { cardId: 'bad' }]));
    expect(r.ok).toBe(false);
  });

  it('an entry needs at least one Chinese name', () => {
    expect(parseNameImport(JSON.stringify([{ cardId: 1, translationSource: 's', translationStatus: 'official' }])).ok).toBe(false);
  });
});
