import { BrowserContext, Page, expect, test } from '@playwright/test';
import { EDGE_SAMPLE, EDGE_SAMPLE_CARDS } from '../src/testing/neuron-deck.sample';
import { mockCardSource, openAddDeck } from './fixtures';

// G21 — Master Duel deck code, assisted import. YGOPRODeck is MOCKED (the 41 sample cards are real
// passcodes/names). The official site is STUBBED at context level: the test never contacts KONAMI.

const OFFICIAL = 'https://www.db.yugioh-card.com/yugiohdb/deck_search.action?ope=1&deck_code=2962ut6&request_locale=en';
const SAMPLE_CARDS = EDGE_SAMPLE_CARDS.map((c) => ({ ...c, misc_info: [{ formats: ['Master Duel'] }] }));

async function setup(page: Page, context: BrowserContext, options: { sync?: boolean } = {}) {
  const official: string[] = [];
  await context.route('https://www.db.yugioh-card.com/**', (route) => {
    official.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>official page stub</h1>' });
  });
  const fromApp: string[] = [];
  page.on('request', (r) => r.url().includes('db.yugioh-card.com') && fromApp.push(r.url()));
  await mockCardSource(page, { extraCards: SAMPLE_CARDS });
  if (options.sync !== false) {
    await page.goto('/settings');
    await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
    await expect(page.getByText(/已同步 \d+ 張卡片/)).toBeVisible();
  }
  await page.goto('/decks');
  return { official, fromApp };
}

async function pasteList(page: Page, text = EDGE_SAMPLE) {
  await openAddDeck(page);
  await page.getByLabel('牌組代碼或 YDK 內容').fill(text);
  await page.getByRole('button', { name: '解析', exact: true }).click();
}

test('G21: code opens only the official search; the pasted list imports as a 40/15/0 deck usable for editing and hand queries', async ({ page, context }) => {
  const { official, fromApp } = await setup(page, context);

  await page.getByLabel('Master Duel 牌組代碼').fill('2962ut6');
  const [tab] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: '在官方網站開啟' }).click()]);
  await tab.waitForLoadState();
  expect(tab.url()).toBe(OFFICIAL);
  await tab.close();

  await pasteList(page);
  await expect(page.getByText('預覽（尚未寫入）— 格式：官方牌組頁牌表（英文）')).toBeVisible();
  await expect(page.getByText(/主牌 40 張／額外 15 張／備牌 0 張/)).toBeVisible();
  await expect(page.getByText(/已讀取官方牌表區段：Monster Cards 27・Spell Cards 7・Trap Cards 6・Extra Deck 15；未包含：Side Deck/)).toBeVisible();
  await expect(page.getByText('牌表檢核通過，匯入後可用於起手查詢。')).toBeVisible();

  await page.getByLabel('新牌組名稱').fill('碼莉絲（官方頁）');
  await page.getByRole('button', { name: '確認匯入' }).click();
  const row = page.locator('.deck-row', { hasText: '碼莉絲（官方頁）' });
  await expect(row.getByText('可查詢')).toBeVisible();
  await expect(row.getByText('主牌 40／額外 15／備牌 0')).toBeVisible();

  await row.getByRole('link', { name: '編輯' }).click();
  const main = page.getByRole('region', { name: '主牌' });
  await expect(main.locator('li', { hasText: 'Ash Blossom & Joyous Spring' })).toContainText('×3');
  await expect(main.locator('li', { hasText: 'Droll & Lock Bird' })).toContainText('×2');
  await expect(page.getByRole('region', { name: '額外' }).locator('li', { hasText: 'S:P Little Knight' })).toContainText('×1');

  await page.getByRole('link', { name: '起手查詢' }).first().click();
  await page.getByRole('button', { name: '隨機抽 5 張' }).click();
  await expect(page.getByRole('heading', { name: '起手（5 / 5 張）' })).toBeVisible();

  expect(official).toEqual([OFFICIAL]); // only the user-opened tab, once
  expect(fromApp).toEqual([]); // the app page never requested the official site
});

test('N17: an invalid code shows an error and opens nothing', async ({ page, context }) => {
  await setup(page, context, { sync: false });
  let opened = 0;
  context.on('page', () => opened++);
  for (const bad of ['', '29 62', '2962ut6!', 'abc']) {
    await page.getByLabel('Master Duel 牌組代碼').fill(bad);
    await page.getByRole('button', { name: '在官方網站開啟' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  }
  expect(opened).toBe(0);
});

test('N18: unknown names and partial copies never import; downloading card data resolves the names', async ({ page, context }) => {
  await setup(page, context, { sync: false });
  await pasteList(page);
  await expect(page.getByRole('alert')).toContainText('本機卡片資料庫找不到卡名「Droll & Lock Bird」');
  await expect(page.getByRole('button', { name: '確認匯入' })).toHaveCount(0);
  await page.getByRole('button', { name: '下載完整卡片資料後重新解析' }).click();
  await expect(page.getByText(/主牌 40 張／額外 15 張／備牌 0 張/)).toBeVisible();

  const partial = EDGE_SAMPLE.split('\r\n').filter((l) => l !== 'Radiant Typhoon Chant').join('\r\n');
  await pasteList(page, partial);
  await expect(page.getByRole('alert')).toContainText('「Spell Cards」標示 7 張，但讀到 5 張（可能沒有完整複製）');
  await expect(page.getByRole('button', { name: '確認匯入' })).toHaveCount(0);
  await expect(page.getByText('尚未建立任何牌組')).toBeVisible();
});

test('G21-8/9: offline import works from local data; replacing an existing deck needs confirmation', async ({ page, context }) => {
  await setup(page, context);
  await openAddDeck(page);
  await page.getByLabel('牌組名稱', { exact: true }).fill('原有牌組');
  await page.getByRole('button', { name: '建立', exact: true }).click();
  await expect(page.locator('.deck-row', { hasText: '原有牌組' })).toBeVisible();

  await page.unrouteAll();
  await page.route(/db\.ygoprodeck\.com|\/ygo-images\/|db\.yugioh-card\.com/, (route) => route.abort('internetdisconnected'));
  await pasteList(page);
  await expect(page.getByText(/主牌 40 張／額外 15 張／備牌 0 張/)).toBeVisible();

  await page.getByLabel('匯入到').selectOption({ label: '取代：原有牌組' });
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: '確認匯入' }).click();
  await expect(page.locator('.deck-row', { hasText: '原有牌組' })).toContainText('主牌 0／額外 0／備牌 0');

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '確認匯入' }).click();
  await expect(page.locator('.deck-row', { hasText: '原有牌組' })).toContainText('主牌 40／額外 15／備牌 0');
});
