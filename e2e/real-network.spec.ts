import { expect, test } from '@playwright/test';
import { EDGE_SAMPLE } from '../src/app/core/neuron-deck.sample';
import { MALISS, openAddDeck, setAutoThumbnails, syntheticScreenshot, toYdke } from './fixtures';

// REAL external source (YGOPRODeck API + images via the dev-server proxy). Run explicitly:
//   npm run e2e:real

test('real YGOPRODeck: card data and images for the Maliss archetype download and cache', async ({ page }) => {
  const ids = Object.values(MALISS);
  const deck = {
    main: ids.filter((id) => ![MALISS.redRansom, MALISS.whiteBinder, MALISS.heartsCrypter].includes(id as never)).map((id): [number, number] => [id, 1]),
    extra: [MALISS.redRansom, MALISS.whiteBinder, MALISS.heartsCrypter].map((id): [number, number] => [id, 1]),
    side: [] as Array<[number, number]>,
  };
  await setAutoThumbnails(page, false); // CR-002: this test covers the explicit download path
  await page.goto('/decks');
  await openAddDeck(page);
  await page.getByLabel('牌組代碼或 YDK 內容').fill(toYdke(deck));
  await page.getByRole('button', { name: '解析', exact: true }).click();
  await page.getByRole('button', { name: '從 YGOPRODeck 下載缺少的卡片資料' }).click();
  await expect(page.getByRole('status')).toContainText('已下載 12 張卡片資料');
  // Only the deck-size rule remains (12 cards is a deliberate partial deck).
  await expect(page.getByText('缺少資料')).toHaveCount(0);
  await expect(page.getByText('主牌 9 張（需 40–60 張）')).toBeVisible();

  await page.getByLabel('新牌組名稱').fill('真實資料檢查');
  await page.getByRole('button', { name: '確認匯入' }).click();
  await page.locator('.deck-row', { hasText: '真實資料檢查' }).getByRole('link', { name: '編輯' }).click();
  await expect(page.getByText('Maliss <Q> Hearts Crypter').first()).toBeVisible();

  await page.getByRole('button', { name: '下載此牌組卡圖' }).click();
  await expect(page.getByRole('status')).toContainText('已下載 12 張卡圖', { timeout: 30_000 });
  const img = page.locator('app-card-tile img').first();
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(100);
});

test('real card art: a synthetic screenshot built from real YGOPRODeck art is recognised confidently', async ({ page }) => {
  test.setTimeout(180_000);
  // A real, legal-sized list: 9 Maliss main-deck cards ×3 + 13 real Sky Striker main-deck cards.
  const extraFrames = new Set(['fusion', 'synchro', 'xyz', 'link', 'fusion_pendulum', 'synchro_pendulum', 'xyz_pendulum']);
  const sky = (await (await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?archetype=Sky%20Striker')).json()) as {
    data: Array<{ id: number; frameType: string }>;
  };
  const filler = sky.data.filter((c) => !extraFrames.has(c.frameType)).slice(0, 5).map((c) => c.id);
  const malissMain = [MALISS.dormouse, MALISS.whiteRabbit, MALISS.chessyCat, MALISS.marchHare, MALISS.underground, MALISS.mirror, MALISS.gwc06, MALISS.tb11, MALISS.mtp07];
  const deck = {
    main: [...malissMain.map((id): [number, number] => [id, 3]), ...filler.map((id, i): [number, number] => [id, i < 4 ? 3 : 1])],
    extra: [MALISS.redRansom, MALISS.whiteBinder, MALISS.heartsCrypter].map((id): [number, number] => [id, 1]),
    side: [] as Array<[number, number]>,
  };

  await page.goto('/decks');
  await openAddDeck(page);
  await page.getByLabel('牌組代碼或 YDK 內容').fill(toYdke(deck));
  await page.getByRole('button', { name: '解析', exact: true }).click();
  await page.getByRole('button', { name: '從 YGOPRODeck 下載缺少的卡片資料' }).click();
  await expect(page.getByText('牌表檢核通過，匯入後可用於起手查詢。')).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('新牌組名稱').fill('真實卡圖辨識');
  await page.getByRole('button', { name: '確認匯入' }).click();
  await page.locator('.deck-row', { hasText: '真實卡圖辨識' }).getByRole('link', { name: '起手查詢' }).click();

  await page.getByRole('button', { name: '開啟截圖辨識' }).click();
  await page.getByRole('button', { name: '下載辨識用卡圖（YGOPRODeck）' }).click();
  await expect(page.getByText('已下載 14 張辨識用卡圖')).toBeVisible({ timeout: 90_000 });

  const hand = [MALISS.dormouse, MALISS.whiteRabbit, MALISS.underground, MALISS.gwc06, filler[0]];
  const png = await syntheticScreenshot(page, hand.map((id) => `/ygo-images/cards_cropped/${id}.jpg`), { width: 1920, height: 1080 });
  await page.locator('app-screenshot-recognizer input[type=file]').setInputFiles({ name: 'real-art.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: '使用預設位置' }).click();
  await page.getByRole('button', { name: '開始辨識' }).click();

  const slots = page.locator('app-screenshot-recognizer li.slot');
  await expect(slots).toHaveCount(5);
  const statuses = await slots.evaluateAll((els) => els.map((e) => e.getAttribute('data-status')));
  const chosen = await slots.evaluateAll((els) => els.map((e) => e.querySelector('figure')?.getAttribute('aria-label') ?? ''));
  console.log('real-art recognition', JSON.stringify({ statuses, chosen }));
  expect(statuses).toEqual(Array(5).fill('confident'));
  hand.forEach((id, i) => expect(chosen[i]).toContain(`ID ${id}`));
});

test('real full sync: Master Duel pool downloads once, is searchable locally, re-check skips the download', async ({ page }) => {
  test.setTimeout(240_000);
  const api: string[] = [];
  page.on('request', (r) => r.url().includes('db.ygoprodeck.com') && api.push(r.url()));
  await page.goto('/settings');
  const started = Date.now();
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  const done = page.getByText(/已同步 (\d+) 張卡片/);
  await expect(done).toBeVisible({ timeout: 180_000 });
  const text = (await done.textContent()) ?? '';
  const count = Number(/已同步 (\d+) 張/.exec(text)?.[1]);
  console.log('real-sync', JSON.stringify({ text, seconds: Math.round((Date.now() - started) / 1000), requests: api }));
  expect(count).toBeGreaterThan(13_000);
  expect(api).toEqual(['https://db.ygoprodeck.com/api/v7/checkDBVer.php', 'https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes&format=master%20duel']);

  api.length = 0;
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText(/卡片資料已是最新版本/)).toBeVisible({ timeout: 30_000 });
  expect(api).toEqual(['https://db.ygoprodeck.com/api/v7/checkDBVer.php']);

  api.length = 0;
  await page.goto('/decks');
  await openAddDeck(page);
  await page.getByLabel('牌組名稱', { exact: true }).fill('真實搜尋');
  await page.getByRole('button', { name: '建立', exact: true }).click();
  await page.locator('.deck-row', { hasText: '真實搜尋' }).getByRole('link', { name: '編輯' }).click();
  await page.getByLabel('卡名（英文／繁中／俗稱）或卡片 ID').fill('maliss');
  await expect(page.locator('app-card-browser p[aria-live]')).toContainText(/符合 1\d 張/);
  await page.getByRole('button', { name: '查看 Maliss <P> Dormouse 詳細資訊' }).click();
  await expect(page.getByRole('dialog').locator('.image img')).toBeVisible({ timeout: 30_000 });
  expect(await page.getByRole('dialog').locator('.image img').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(300);
  await expect(page.getByRole('dialog')).toContainText('效果（英文原文）');
  expect(api).toEqual([]); // searching used local data only
});

test('real card data: the user\'s Edge deck list resolves to a valid 40 / 15 / 0 deck', async ({ page }) => {
  test.setTimeout(240_000);
  const official: string[] = [];
  page.on('request', (r) => r.url().includes('db.yugioh-card.com') && official.push(r.url()));
  await page.goto('/settings');
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText(/已同步 \d+ 張卡片|已是最新版本/)).toBeVisible({ timeout: 180_000 });
  await page.goto('/decks');
  await openAddDeck(page);
  await page.getByLabel('牌組代碼或 YDK 內容').fill(EDGE_SAMPLE);
  await page.getByRole('button', { name: '解析', exact: true }).click();
  await expect(page.getByText(/主牌 40 張／額外 15 張／備牌 0 張/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('牌表檢核通過，匯入後可用於起手查詢。')).toBeVisible();
  expect(official).toEqual([]);
});
