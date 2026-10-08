import { TestBed } from '@angular/core/testing';
import { FETCH_FN, SLEEP_FN, YgoProDeckClient, toCardRecord } from './card-api';
import { CardDataService, mergeCard } from './card-data.service';
import { CardImageService } from './card-image.service';
import { AppDb, DB_NAME } from './db';
import { newDeck } from './deck';
import { DeckRepository } from './deck-repository';
import { SettingsService } from './settings.service';

// G17 / G19 with a MOCKED card source (the real source is exercised by e2e:real).

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

const API_CARDS = [
  { id: 32061192, name: 'Maliss <P> Dormouse', type: 'Effect Monster', frameType: 'effect', desc: 'Effect text.', race: 'Cyberse', attribute: 'DARK', level: 3, atk: 900, def: 1200, archetype: 'Maliss', misc_info: [{ formats: ['TCG', 'OCG', 'Master Duel'] }] },
  { id: 68059897, name: 'Maliss <Q> Red Ransom', type: 'Link Monster', frameType: 'link', desc: 'Link text.', race: 'Cyberse', attribute: 'DARK', linkval: 3, atk: 2300, archetype: 'Maliss', misc_info: [{ formats: ['Master Duel'] }] },
  { id: 23434538, name: 'Maxx "C"', type: 'Effect Monster', frameType: 'effect', desc: 'Draw.', banlist_info: { ban_tcg: 'Forbidden', ban_ocg: 'Limited' }, misc_info: [{ formats: ['Master Duel'] }] },
];

interface Setup {
  version?: string | (() => Response);
  cards?: () => Response;
}

function setup(options: Setup = {}) {
  const urls: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: DB_NAME, useValue: `sync-${crypto.randomUUID()}` },
      { provide: SLEEP_FN, useValue: async () => undefined },
      {
        provide: FETCH_FN,
        useValue: async (url: string) => {
          urls.push(url);
          if (url.includes('checkDBVer')) {
            const v = options.version ?? '147.23';
            return typeof v === 'function' ? v() : json(200, [{ database_version: v, last_update: '2026-10-08 12:00:24' }]);
          }
          if (url.includes('cardinfo.php?misc=yes')) return options.cards ? options.cards() : json(200, { data: API_CARDS });
          if (url.includes('/ygo-images/')) return new Response('img', { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
          return json(400, { error: 'no' });
        },
      },
    ],
  });
  return { service: TestBed.inject(CardDataService), db: TestBed.inject(AppDb), urls };
}

describe('toCardRecord — full card fields', () => {
  it('keeps text, stats, archetype, formats and reference bans; drops absent fields', () => {
    const r = toCardRecord(API_CARDS[2] as never, 'now');
    expect(r).toMatchObject({ cardId: 23434538, desc: 'Draw.', formats: ['Master Duel'], banlist: { tcg: 'Forbidden', ocg: 'Limited' } });
    expect('atk' in r).toBe(false);
    const link = toCardRecord(API_CARDS[1] as never, 'now');
    expect(link).toMatchObject({ isExtraDeckType: true, linkval: 3, atk: 2300 });
    expect('def' in link).toBe(false);
  });

  it('mergeCard keeps user annotations and richer existing fields', () => {
    const existing = { ...toCardRecord(API_CARDS[0] as never, 'old'), nameZhTw: '睡鼠', mdBan: 'Limited' as const };
    const poorer = toCardRecord({ id: 32061192, name: 'Maliss <P> Dormouse', type: 'Effect Monster' }, 'new');
    expect(mergeCard(existing, poorer)).toMatchObject({ nameZhTw: '睡鼠', mdBan: 'Limited', desc: 'Effect text.', updatedAt: 'new' });
    expect('nameZhTw' in mergeCard(undefined, poorer)).toBe(false);
  });
});

describe('CardDataService.syncAll — G17', () => {
  it('downloads the Master Duel pool in two requests, stores it and records the version', async () => {
    const { service, urls } = setup();
    const result = await service.syncAll('master-duel');
    expect(result).toMatchObject({ status: 'synced', added: 3, updated: 0, info: { dbVersion: '147.23', pool: 'master-duel', count: 3 } });
    expect(urls).toEqual(['https://db.ygoprodeck.com/api/v7/checkDBVer.php', 'https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes&format=master%20duel']);
    expect(await service.count()).toBe(3);
    expect((await service.syncInfo())?.lastUpdate).toBe('2026-10-08 12:00:24');
  });

  it('does not download again when the version and pool are unchanged; force does', async () => {
    const { service, urls } = setup();
    await service.syncAll('master-duel');
    urls.length = 0;
    expect((await service.syncAll('master-duel')).status).toBe('up-to-date');
    expect(urls).toEqual(['https://db.ygoprodeck.com/api/v7/checkDBVer.php']);
    urls.length = 0;
    expect((await service.syncAll('master-duel', { force: true })).status).toBe('synced');
    expect(urls[1]).toContain('cardinfo.php');
  });

  it('switching to "all cards" downloads without the format filter', async () => {
    const { service, urls } = setup();
    await service.syncAll('master-duel');
    urls.length = 0;
    await service.syncAll('all');
    expect(urls[1]).toBe('https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes');
  });

  it('searching after a sync never calls the API', async () => {
    const { service, urls } = setup();
    await service.syncAll('master-duel');
    urls.length = 0;
    expect((await service.search('maliss')).length).toBe(2);
    expect((await service.allCards()).length).toBe(3);
    expect(urls).toEqual([]);
  });

  describe('N13: failures leave existing data and the version record untouched', () => {
    async function seeded(options: Setup) {
      const ctx = setup(options);
      const db = await ctx.db.db();
      await db.put('cards', { cardId: 1, nameEn: 'Existing', kind: 'spell', source: 't', updatedAt: '', nameZhTw: '既有' });
      await db.put('meta', { key: 'cardSync', value: { dbVersion: '100', lastUpdate: 'x', pool: 'master-duel', syncedAt: 'x', count: 1 } });
      await TestBed.inject(DeckRepository).save({ ...newDeck('我的牌組', '2026-10-08T00:00:00.000Z', 'deck-1'), main: [{ cardId: 1, count: 3 }] });
      return ctx;
    }
    async function expectUntouched(ctx: ReturnType<typeof setup>) {
      const db = await ctx.db.db();
      expect(await db.getAll('cards')).toEqual([{ cardId: 1, nameEn: 'Existing', kind: 'spell', source: 't', updatedAt: '', nameZhTw: '既有' }]);
      expect((await ctx.service.syncInfo())?.dbVersion).toBe('100');
      expect((await TestBed.inject(DeckRepository).get('deck-1'))?.main).toEqual([{ cardId: 1, count: 3 }]);
    }

    it('version check fails (offline)', async () => {
      const ctx = await seeded({ version: () => Promise.reject(new TypeError('offline')) as never });
      const result = await ctx.service.syncAll('master-duel');
      expect(result.status).toBe('failed');
      await expectUntouched(ctx);
    });

    it('card download fails, or the response lacks a data array, or is empty', async () => {
      for (const cards of [() => json(503, {}), () => json(200, { nope: true }), () => json(200, { data: 'x' }), () => json(200, { data: [] }), () => new Response('not json', { status: 200 })]) {
        TestBed.resetTestingModule();
        const ctx = await seeded({ cards });
        const result = await ctx.service.syncAll('master-duel');
        expect(result.status).toBe('failed');
        await expectUntouched(ctx);
      }
    });

    it('a write failure in the middle rolls the whole batch back', async () => {
      const ctx = await seeded({});
      const put = IDBObjectStore.prototype.put;
      let calls = 0;
      const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
        if (this.name === 'cards' && ++calls === 2) throw new DOMException('disk full', 'QuotaExceededError');
        return put.apply(this, args);
      });
      const result = await ctx.service.syncAll('master-duel');
      spy.mockRestore();
      expect(result).toMatchObject({ status: 'failed', error: expect.stringContaining('已取消整批寫入') });
      await expectUntouched(ctx);
    });
  });

  it('keeps the user\'s zh-TW names, aliases and ban marks across syncs', async () => {
    const { service } = setup();
    await service.syncAll('master-duel');
    await service.saveNote({ cardId: 32061192, nameZhTw: '碼莉絲〈P〉睡鼠', aliases: ['睡鼠'], mdBan: 'Limited' });
    await service.syncAll('master-duel', { force: true });
    expect((await service.getMany([32061192])).get(32061192)).toMatchObject({ nameZhTw: '碼莉絲〈P〉睡鼠', aliases: ['睡鼠'], mdBan: 'Limited', desc: 'Effect text.' });
    expect(await service.notes()).toEqual([{ cardId: 32061192, nameZhTw: '碼莉絲〈P〉睡鼠', aliases: ['睡鼠'], mdBan: 'Limited' }]);
  });

  it('G19-1: a sync downloads no images', async () => {
    const { service, urls } = setup();
    await service.syncAll('all', { force: true });
    expect(urls.some((u) => u.includes('/ygo-images/'))).toBe(false);
  });
});

describe('CardImageService — G19 thumbnails and full images', () => {
  afterEach(() => vi.restoreAllMocks());

  async function flush() {
    for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
  }

  it('downloads a wanted thumbnail once and stores it; later wants do not request again', async () => {
    const { urls } = setup();
    const images = TestBed.inject(CardImageService);
    images.want(32061192);
    images.want(32061192);
    await flush();
    expect(urls).toEqual(['/ygo-images/cards_small/32061192.jpg']);
    expect(await images.blob(32061192)).toBeTruthy();
    images.want(32061192);
    await flush();
    expect(urls).toHaveLength(1);
  });

  it('skips a queued thumbnail nobody wants any more, and respects the auto-thumbnail switch', async () => {
    const { urls } = setup();
    const images = TestBed.inject(CardImageService);
    images.want(1);
    images.unwant(1);
    await flush();
    expect(urls).toEqual([]);
    await TestBed.inject(SettingsService).update({ autoThumbnails: false });
    images.want(2);
    await flush();
    expect(urls).toEqual([]);
  });

  it('loads the full image only when asked (details opened) and caches it', async () => {
    // fake-indexeddb returns cloned Blobs Node cannot turn into object URLs; real browsers can (E2E).
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const { urls } = setup();
    const images = TestBed.inject(CardImageService);
    expect(await images.cachedUrl(5, 'full')).toBeNull();
    expect(urls).toEqual([]);
    expect(await images.fullUrl(5)).toMatch(/^blob:/);
    expect(urls).toEqual(['/ygo-images/cards/5.jpg']);
    await images.fullUrl(5);
    expect(urls).toHaveLength(1);
  });

  it('images use their own lane spaced ≥100 ms apart', async () => {
    const sleeps: number[] = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: DB_NAME, useValue: `lane-${crypto.randomUUID()}` },
        { provide: SLEEP_FN, useValue: async (ms: number) => void sleeps.push(ms) },
        { provide: FETCH_FN, useValue: async () => new Response('i', { status: 200, headers: { 'Content-Type': 'image/jpeg' } }) },
      ],
    });
    const client = TestBed.inject(YgoProDeckClient);
    await client.fetchImage(1, 'small');
    await client.fetchImage(2, 'small');
    expect(sleeps.some((ms) => ms > 0 && ms <= 100)).toBe(true);
    expect(sleeps.every((ms) => ms <= 100)).toBe(true);
  });
});
