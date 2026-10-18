import { TestBed } from '@angular/core/testing';
import { CardNamesService } from './card-names.service';
import { CARD_NAMES_DB } from './card-names.store';
import { AppDb, DB_NAME } from './db';
import { CardRecord } from './models';
import { SettingsService } from './settings.service';

// rev9 G55, G59, G61, G63–G66. Names below are test fixtures ("測試用"), never real translations.

const card = (cardId: number, nameEn: string, extra: Partial<CardRecord> = {}): CardRecord => ({ cardId, nameEn, kind: 'monster', source: 'test', updatedAt: '2026-10-09T00:00:00.000Z', ...extra });
const DORMOUSE = card(32061192, 'Maliss <P> Dormouse');
const RABBIT = card(69272449, 'Maliss <P> White Rabbit');
const CARDS = new Map([[DORMOUSE.cardId, DORMOUSE], [RABBIT.cardId, RABBIT]]);

/** Same database names across calls = the same "browser profile" (a reload keeps the stored settings). */
function setup(profile: string): CardNamesService {
  TestBed.configureTestingModule({
    providers: [
      { provide: DB_NAME, useValue: `app-${profile}` },
      { provide: CARD_NAMES_DB, useValue: `names-${profile}` },
    ],
  });
  return TestBed.inject(CardNamesService);
}

const file = (rows: unknown[]) => JSON.stringify(rows);
const row = (cardId: number, translationStatus: string, nameZhTw = `測試用${cardId}`, extra: Record<string, unknown> = {}) => ({
  cardId,
  nameZhTw,
  translationSource: '測試檔案',
  translationStatus,
  ...extra,
});

describe('CardNamesService (rev9)', () => {
  it('G66: the default language is Traditional Chinese, and a language choice survives a reload', async () => {
    const profile = crypto.randomUUID();
    const first = setup(profile);
    await first.ready;
    expect(first.language()).toBe('zh-TW');
    await first.setLanguage('both');

    TestBed.resetTestingModule();
    const again = setup(profile);
    await TestBed.inject(SettingsService).ready;
    expect(again.language()).toBe('both');
  });

  it('G66: an unknown stored language value falls back to the default instead of breaking the page', async () => {
    const profile = crypto.randomUUID();
    const service = setup(profile);
    await service.ready;
    const db = await TestBed.inject(AppDb).db();
    await db.put('meta', { key: 'settings', value: { cardLanguage: 'klingon' } });
    TestBed.resetTestingModule();
    const again = setup(profile);
    await TestBed.inject(SettingsService).ready;
    expect(again.language()).toBe('zh-TW');
  });

  it('G61 / G55: the same card gives a different label after the language changes, without reloading anything', async () => {
    const service = setup(crypto.randomUUID());
    await service.ready;
    await service.importText(file([row(32061192, 'community', '測試用睡鼠')]), new Set([32061192, 69272449]));
    expect(service.labelOf(32061192, DORMOUSE)).toBe('測試用睡鼠');
    await service.setLanguage('en');
    expect(service.labelOf(32061192, DORMOUSE)).toBe('Maliss <P> Dormouse');
    await service.setLanguage('both');
    expect(service.labelOf(32061192, DORMOUSE)).toBe('測試用睡鼠（Maliss <P> Dormouse）');
  });

  it('G58: a card with no translation shows English; an unknown ID shows 未識別', async () => {
    const service = setup(crypto.randomUUID());
    await service.ready;
    expect(service.labelOf(69272449, RABBIT)).toBe('Maliss <P> White Rabbit');
    expect(service.labelOf(12345678, undefined)).toBe('未識別');
  });

  it('G63 / G68: a bad file is rejected as a whole and the table stays exactly as it was', async () => {
    const service = setup(crypto.randomUUID());
    await service.ready;
    expect(await service.importText(file([row(32061192, 'official')]), new Set([32061192]))).toMatchObject({ status: 'applied', applied: 1 });
    const before = [...service.entries().values()];

    const broken = await service.importText('[{"cardId": 69272449,', new Set());
    expect(broken.status).toBe('rejected');
    const invalid = await service.importText(file([row(69272449, 'official'), row(1, 'user')]), new Set());
    expect(invalid.status).toBe('rejected');
    expect([...service.entries().values()]).toEqual(before);
    expect(await service.lastImport()).toMatchObject({ count: 1 });
  });

  it('G64 / G65: a valid import is applied; lower-rank entries are kept out; coverage counts the result', async () => {
    const service = setup(crypto.randomUUID());
    await service.ready;
    const applied = await service.importText(file([row(32061192, 'official', '正式睡鼠'), row(69272449, 'provisional', '暫定白兔')]), new Set([32061192, 69272449]));
    expect(applied).toEqual({ status: 'applied', applied: 2, kept: 0, unknownIds: [] });

    const again = await service.importText(file([row(32061192, 'provisional', '暫定睡鼠')]), new Set([32061192]));
    expect(again).toEqual({ status: 'applied', applied: 0, kept: 1, unknownIds: [] });
    expect(service.labelOf(32061192, DORMOUSE)).toBe('正式睡鼠');

    const stats = service.coverageOf([DORMOUSE, RABBIT, card(3, 'Third')]);
    expect(stats).toMatchObject({ total: 3, translated: 2, untranslated: 1, percent: 67, byStatus: { user: 0, official: 1, community: 0, provisional: 1 } });
  });

  it('G64: a user correction on the card is not overwritten by an imported official name (N49)', async () => {
    const service = setup(crypto.randomUUID());
    await service.ready;
    await service.importText(file([row(32061192, 'official', '正式睡鼠')]), new Set([32061192]));
    const corrected = { ...DORMOUSE, nameZhTw: '使用者修正' };
    expect(service.labelOf(32061192, corrected)).toBe('使用者修正');
    expect(service.statusOf(corrected)).toBe('使用者修正');
    expect(service.statusOf(RABBIT)).toBe('無（顯示英文）');
  });

  it('G58: IDs that are not in the card database are stored and reported, not dropped silently', async () => {
    const service = setup(crypto.randomUUID());
    await service.ready;
    const r = await service.importText(file([row(32061192, 'community', '測試用睡鼠'), row(99999999, 'community', '測試用未知')]), new Set([32061192]));
    expect(r).toMatchObject({ status: 'applied', applied: 2, unknownIds: [99999999] });
  });

  it('G59 / G60: a language change does not change the translation table or the cards', async () => {
    const service = setup(crypto.randomUUID());
    await service.ready;
    await service.importText(file([row(32061192, 'official')]), new Set([32061192]));
    const entriesBefore = JSON.stringify([...service.entries().entries()]);
    const cardsBefore = JSON.stringify([...CARDS.values()]);
    await service.setLanguage('en');
    await service.setLanguage('zh-TW');
    expect(JSON.stringify([...service.entries().entries()])).toBe(entriesBefore);
    expect(JSON.stringify([...CARDS.values()])).toBe(cardsBefore);
  });
});
