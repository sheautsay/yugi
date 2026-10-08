import { BrowserContext, Page, expect } from '@playwright/test';
import { crc32, deflateSync } from 'node:zlib';
import { mulberry32 } from '../src/app/core/hand';
import { deckFingerprint } from '../src/app/core/deck';

/** Real Maliss passcodes/names (fetched from YGOPRODeck 2026-10-08). */
export const MALISS = {
  dormouse: 32061192,
  whiteRabbit: 69272449,
  chessyCat: 96676583,
  marchHare: 20938824,
  underground: 68337209,
  mirror: 93453053,
  gwc06: 20726052,
  tb11: 57111661,
  mtp07: 94722358,
  redRansom: 68059897,
  whiteBinder: 95454996,
  heartsCrypter: 21848500,
} as const;

const MALISS_CARDS: Record<number, { name: string; type: string; frameType: string }> = {
  [MALISS.dormouse]: { name: 'Maliss <P> Dormouse', type: 'Effect Monster', frameType: 'effect' },
  [MALISS.whiteRabbit]: { name: 'Maliss <P> White Rabbit', type: 'Effect Monster', frameType: 'effect' },
  [MALISS.chessyCat]: { name: 'Maliss <P> Chessy Cat', type: 'Effect Monster', frameType: 'effect' },
  [MALISS.marchHare]: { name: 'Maliss <P> March Hare', type: 'Effect Monster', frameType: 'effect' },
  [MALISS.underground]: { name: 'Maliss in Underground', type: 'Spell Card', frameType: 'spell' },
  [MALISS.mirror]: { name: 'Maliss in the Mirror', type: 'Spell Card', frameType: 'spell' },
  [MALISS.gwc06]: { name: 'Maliss <C> GWC-06', type: 'Trap Card', frameType: 'trap' },
  [MALISS.tb11]: { name: 'Maliss <C> TB-11', type: 'Trap Card', frameType: 'trap' },
  [MALISS.mtp07]: { name: 'Maliss <C> MTP-07', type: 'Trap Card', frameType: 'trap' },
  [MALISS.redRansom]: { name: 'Maliss <Q> Red Ransom', type: 'Link Monster', frameType: 'link' },
  [MALISS.whiteBinder]: { name: 'Maliss <Q> White Binder', type: 'Link Monster', frameType: 'link' },
  [MALISS.heartsCrypter]: { name: 'Maliss <Q> Hearts Crypter', type: 'Link Monster', frameType: 'link' },
};

/** Test-only filler passcodes (not real cards): 900000xx main, 900001xx extra. */
const FILLER_MAIN = Array.from({ length: 9 }, (_, i) => 90_000_001 + i);
const FILLER_EXTRA = Array.from({ length: 12 }, (_, i) => 90_000_101 + i);

type Rows = Array<[number, number]>;

/** 40 main / 15 extra / 0 side test deck built around real Maliss cards. */
export const TEST_DECK: { main: Rows; extra: Rows; side: Rows } = {
  main: [
    [MALISS.dormouse, 3],
    [MALISS.whiteRabbit, 3],
    [MALISS.chessyCat, 2],
    [MALISS.marchHare, 1],
    [MALISS.underground, 2],
    [MALISS.mirror, 1],
    [MALISS.gwc06, 1],
    [MALISS.tb11, 1],
    [MALISS.mtp07, 1],
    ...FILLER_MAIN.map((id, i): [number, number] => [id, i < 8 ? 3 : 1]),
  ],
  extra: [[MALISS.redRansom, 1], [MALISS.whiteBinder, 1], [MALISS.heartsCrypter, 1], ...FILLER_EXTRA.map((id): [number, number] => [id, 1])],
  side: [],
};

export function toYdke(deck: { main: Rows; extra: Rows; side: Rows }): string {
  const encode = (rows: Rows) => {
    const ids = rows.flatMap(([id, n]) => Array<number>(n).fill(id));
    const buf = Buffer.alloc(ids.length * 4);
    ids.forEach((id, i) => buf.writeUInt32LE(id, i * 4));
    return buf.toString('base64');
  };
  return `ydke://${encode(deck.main)}!${encode(deck.extra)}!${encode(deck.side)}!`;
}

export function toYdk(deck: { main: Rows; extra: Rows; side: Rows }): string {
  const lines = (rows: Rows) => rows.flatMap(([id, n]) => Array<string>(n).fill(String(id)));
  return ['#created by e2e', '#main', ...lines(deck.main), '#extra', ...lines(deck.extra), '!side', ...lines(deck.side), ''].join('\r\n');
}

/** Minimal RGB PNG encoder for test images. */
export function encodePng(width: number, height: number, rgb: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set(rgb(x, y), y * (width * 3 + 1) + 1 + x * 3);
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Distinct 8×8 "artwork" per card ID, so mocked reference images can be told apart. */
export function patternPng(cardId: number): Buffer {
  const rnd = mulberry32(cardId);
  const pixels = Array.from({ length: 64 }, () => [Math.floor(rnd() * 256), Math.floor(rnd() * 256), Math.floor(rnd() * 256)] as [number, number, number]);
  return encodePng(8, 8, (x, y) => pixels[y * 8 + x]);
}

/**
 * MOCK of the external card source for deterministic UI tests. Results produced with this mock
 * prove UI behaviour only; real-source behaviour is covered by the `real-network` project.
 */
type ApiCardFixture = { id: number; name: string; type: string; frameType: string; [key: string]: unknown };

const MD = { misc_info: [{ formats: ['TCG', 'OCG', 'Master Duel'] }] };

/** TEST DATA for the mocked full download (cards beyond Maliss are invented test cards). */
export const FULL_DATASET: ApiCardFixture[] = [
  ...Object.entries(MALISS_CARDS).map(([id, c]) => ({ id: Number(id), ...c, archetype: 'Maliss', attribute: 'DARK', race: c.type.includes('Monster') ? 'Cyberse' : 'Normal', level: c.frameType === 'effect' ? 3 : undefined, desc: `${c.name} 的測試效果文字（fixture）。`, ...MD })),
  ...FILLER_MAIN.map((id) => ({ id, name: `Test Filler ${id}`, type: 'Effect Monster', frameType: 'effect', archetype: 'Filler', attribute: 'EARTH', race: 'Warrior', level: 4, desc: 'Filler effect.', ...MD })),
  ...FILLER_EXTRA.map((id) => ({ id, name: `Test Filler ${id}`, type: 'Link Monster', frameType: 'link', archetype: 'Filler', attribute: 'EARTH', race: 'Warrior', linkval: 2, desc: 'Filler link.', ...MD })),
  ...Array.from({ length: 60 }, (_, i) => ({ id: 92_000_001 + i, name: `Test Dragon ${String(i + 1).padStart(2, '0')}`, type: 'Normal Monster', frameType: 'normal', attribute: 'LIGHT', race: 'Dragon', level: (i % 8) + 1, desc: 'A test dragon.', ...MD })),
  { id: 91_000_001, name: 'Test Spell Alpha', type: 'Spell Card', frameType: 'spell', race: 'Quick-Play', desc: 'Spell text.', ...MD },
  { id: 91_000_002, name: 'Test Trap Beta', type: 'Trap Card', frameType: 'trap', race: 'Counter', desc: 'Trap text.', ...MD },
  { id: 91_000_003, name: 'Test Fusion Gamma', type: 'Fusion Monster', frameType: 'fusion', attribute: 'FIRE', race: 'Fiend', level: 8, desc: 'Fusion text.', ...MD },
  { id: 91_000_004, name: 'Test TCG Only', type: 'Effect Monster', frameType: 'effect', desc: 'Not in Master Duel.', misc_info: [{ formats: ['TCG'] }] },
  { id: 91_000_005, name: 'Test Skill', type: 'Skill Card', frameType: 'skill', desc: 'Skill.', misc_info: [{ formats: ['Speed Duel'] }] },
  { id: 91_000_006, name: 'Test Limited Card', type: 'Effect Monster', frameType: 'effect', desc: 'Limited.', banlist_info: { ban_tcg: 'Limited' }, ...MD },
];

export interface MockOptions {
  unknownIds?: number[];
  /** Upstream database version returned by checkDBVer.php. */
  dbVersion?: () => string;
  /** HTTP status for the full download (e.g. 500 to simulate a failure). */
  fullStatus?: () => number;
  /** Additional cards served by the full download and ID lookups. */
  extraCards?: ApiCardFixture[];
}

export async function mockCardSource(page: Page | BrowserContext, options: MockOptions = {}): Promise<{ apiCalls: string[]; imageCalls: string[] }> {
  const apiCalls: string[] = [];
  const imageCalls: string[] = [];
  const unknown = new Set(options.unknownIds ?? []);
  const dataset = [...FULL_DATASET, ...(options.extraCards ?? [])];
  const byId = new Map(dataset.map((c) => [c.id, c]));
  await page.route('https://db.ygoprodeck.com/api/v7/**', async (route) => {
    const url = new URL(route.request().url());
    apiCalls.push(route.request().url());
    if (url.pathname.endsWith('/checkDBVer.php')) {
      return route.fulfill({ status: 200, json: [{ database_version: options.dbVersion?.() ?? '147.23', last_update: '2026-10-08 12:00:24' }] });
    }
    if (url.searchParams.get('misc') === 'yes' && !url.searchParams.has('id')) {
      const status = options.fullStatus?.() ?? 200;
      if (status !== 200) return route.fulfill({ status, json: { error: 'mock failure' } });
      const pool = url.searchParams.get('format');
      const data = dataset.filter((c) => !pool || (c['misc_info'] as Array<{ formats: string[] }> | undefined)?.[0]?.formats.includes('Master Duel'));
      return route.fulfill({ status: 200, json: { data } });
    }
    const ids = (url.searchParams.get('id') ?? '').split(',').filter(Boolean).map(Number);
    const data = ids
      .filter((id) => !unknown.has(id))
      .map((id) => {
        const known = MALISS_CARDS[id];
        if (known) return { id, ...known };
        const fixture = byId.get(id);
        if (fixture) return { id, name: fixture.name, type: fixture.type, frameType: fixture.frameType };
        const isExtra = id >= 90_000_101;
        return { id, name: `Test Filler ${id}`, type: isExtra ? 'Link Monster' : 'Effect Monster', frameType: isExtra ? 'link' : 'effect' };
      });
    if (!data.length) return route.fulfill({ status: 400, json: { error: 'No card matching your query was found in the database.' } });
    return route.fulfill({ status: 200, json: { data } });
  });
  await page.route('**/ygo-images/**', async (route) => {
    imageCalls.push(route.request().url());
    const cardId = Number(/(\d+)\.jpg$/.exec(route.request().url())?.[1]);
    return route.fulfill({ status: 200, contentType: 'image/png', body: patternPng(cardId) });
  });
  return { apiCalls, imageCalls };
}

/**
 * SYNTHETIC screenshot drawn in the page: dark background, cards in the bottom-centre strip
 * (the recognizer's default row box), each card = orange frame + the art image in the standard
 * artwork window. `artUrls` are fetched by the page (mocked or real card art).
 */
export async function syntheticScreenshot(page: Page, artUrls: string[], size = { width: 1280, height: 720 }): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ urls, width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#101826';
      ctx.fillRect(0, 0, width, height);
      const row = { x: 0.25 * width, y: 0.72 * height, w: 0.5 * width, h: 0.26 * height };
      const cardW = row.w / urls.length;
      for (let i = 0; i < urls.length; i++) {
        const bitmap = await createImageBitmap(await (await fetch(urls[i])).blob());
        const x = row.x + cardW * i;
        ctx.fillStyle = '#c4783c';
        ctx.fillRect(x + 2, row.y, cardW - 4, row.h);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, x + 0.12 * cardW, row.y + 0.185 * row.h, 0.76 * cardW, 0.52 * row.h);
      }
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (const b of bytes) binary += String.fromCharCode(b);
      return btoa(binary);
    },
    { urls: artUrls, ...size },
  );
  return Buffer.from(base64, 'base64');
}

/** Switches the auto-thumbnail setting (CR-002) through the settings page. */
export async function setAutoThumbnails(page: Page, on: boolean): Promise<void> {
  await page.goto('/settings');
  const box = page.getByLabel(/卡片出現在畫面上時自動下載縮圖/);
  if ((await box.isChecked()) !== on) await box.setChecked(on);
  await expect(box).toBeChecked({ checked: on });
}

/** Writes routes straight into the app's IndexedDB (the page must have opened the app once). */
export async function seedCombos(page: Page, routes: unknown[]): Promise<void> {
  await page.evaluate(
    (items) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('ygo-combo-assistant');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('combos', 'readwrite');
          for (const item of items) tx.objectStore('combos').put(item);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    routes,
  );
}

/** Imports TEST_DECK through the UI (paste ydke → download card data → confirm). */
export async function importTestDeck(page: Page, name: string): Promise<void> {
  await page.goto('/decks');
  await page.getByLabel('牌組代碼或 YDK 內容').fill(toYdke(TEST_DECK));
  await page.getByRole('button', { name: '解析', exact: true }).click();
  await page.getByRole('button', { name: '從 YGOPRODeck 下載缺少的卡片資料' }).click();
  await expect(page.getByText('牌表檢核通過，匯入後可用於起手查詢。')).toBeVisible();
  await page.getByLabel('新牌組名稱').fill(name);
  await page.getByRole('button', { name: '確認匯入' }).click();
  await expect(page.getByRole('status')).toContainText(`已匯入「${name}」`);
}

const rowsOf = (r: Array<[number, number]>) => r.map(([cardId, count]) => ({ cardId, count }));
export const TEST_DECK_FINGERPRINT = deckFingerprint({ main: rowsOf(TEST_DECK.main), extra: rowsOf(TEST_DECK.extra) });

/**
 * TEST DATA ONLY — structurally valid route using real Maliss passcodes; the step texts are
 * placeholders and are NOT a real, verified Maliss combo.
 */
export function testComboRoute(options: { id?: string; name?: string; status?: 'verified' | 'unverified' | 'draft'; steps?: number; turnOrder?: 'first' | 'second' | 'either' } = {}) {
  const status = options.status ?? 'unverified';
  const actors = [MALISS.dormouse, MALISS.whiteRabbit, MALISS.underground, MALISS.marchHare, MALISS.chessyCat, MALISS.redRansom];
  return {
    schemaVersion: 1,
    id: options.id ?? 'e2e-route',
    version: 1,
    name: options.name ?? 'E2E 測試路線',
    archetype: 'Maliss',
    format: 'master-duel',
    description: '測試資料，不是實際展開',
    conditions: {
      handAllOf: [{ anyOf: [MALISS.dormouse], count: 1 }],
      unallocatedHandMin: 1,
      setup: { turnOrder: options.turnOrder ?? 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true },
    },
    steps: Array.from({ length: options.steps ?? 3 }, (_, i) => ({
      id: `e2e-step-${i + 1}`,
      order: i + 1,
      actionType: i === 0 ? 'normal-summon' : 'activate',
      actorCardIds: [actors[i % actors.length]],
      title: `測試步驟 ${i + 1}`,
      description: `測試步驟 ${i + 1} 的完整說明（測試資料）。`,
      ...(i === 1 ? { fromZone: '手牌', toZone: '主要怪獸區', costText: '除外 1 張', warning: '測試注意事項：此效果每回合只能使用 1 次' } : {}),
    })),
    endBoard: [{ cardId: MALISS.redRansom, zone: '額外怪獸區', count: 1, note: '測試終場' }],
    source: { title: '測試來源', url: 'https://www.youtube.com/watch?v=test', timeSeconds: 30 },
    verification:
      status === 'verified'
        ? { status, verifiedAt: '2026-10-08', verifiedBy: 'e2e', evidenceNote: 'E2E 測試資料（非實測）', deckFingerprint: TEST_DECK_FINGERPRINT }
        : { status },
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
  };
}

/** Dumps decks / combos / layouts from the app's IndexedDB. */
export async function dumpUserData(page: Page): Promise<{ decks: unknown[]; combos: unknown[]; layouts: unknown[] }> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('ygo-combo-assistant');
        open.onsuccess = async () => {
          const db = open.result;
          const all = (store: string) =>
            new Promise<unknown[]>((res) => {
              const req = db.transaction(store).objectStore(store).getAll();
              req.onsuccess = () => res(req.result);
            });
          const result = { decks: await all('decks'), combos: await all('combos'), layouts: await all('layouts') };
          db.close();
          resolve(result);
        };
      }),
  );
}
