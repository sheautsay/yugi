import { Page, expect, test } from '@playwright/test';
import { MALISS, dumpUserData, mockCardSource, seedCombos, testComboRoute } from './fixtures';

// rev9 (G55, G56, G57, G58, G59, G60, G63, G65, G66, G68). The Chinese names in this file are TEST FIXTURES written
// for the test ("測試用…"); they are not translations of the real cards and they are not shipped with the app.
// The card list comes from a full sync, as in card-db.spec.ts (G18): the Master Duel pool is what the browser searches.

const FIXTURE = JSON.stringify([
  {
    cardId: MALISS.dormouse,
    nameZhTw: '測試用睡鼠',
    nameZhCn: '测试用睡鼠',
    aliases: ['測試俗稱'],
    translationSource: '測試用固定資料（e2e）',
    translationStatus: 'community',
  },
]);

async function fullSync(page: Page): Promise<void> {
  await page.goto('/settings');
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText('已同步 97 張卡片').first()).toBeVisible({ timeout: 10_000 });
}

async function importNames(page: Page, content: string): Promise<void> {
  await page.locator('section[aria-labelledby="names-heading"] input[type="file"]').setInputFiles({
    name: 'names.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content, 'utf8'),
  });
}

async function createDeck(page: Page, name: string): Promise<void> {
  await page.goto('/decks');
  await page.getByLabel('牌組名稱', { exact: true }).fill(name);
  await page.getByRole('button', { name: '建立', exact: true }).click();
  await page.locator('.deck-row', { hasText: name }).getByRole('link', { name: '編輯' }).click();
  await expect(page.getByRole('heading', { name: '搜尋卡片並加入牌組' })).toBeVisible();
}

const cardSearch = (page: Page) => page.getByRole('search', { name: '搜尋卡片' }).getByRole('searchbox');

test('G55 / G56 / G57 / G58 / G66: the Traditional name shows by default; search finds the same card by alias and by Simplified name once; untranslated cards fall back to English', async ({ page }) => {
  await mockCardSource(page);
  await fullSync(page);
  await expect(page.getByRole('radio', { name: '繁體中文（預設）' })).toBeChecked();
  await importNames(page, FIXTURE);
  await expect(page.getByRole('status').filter({ hasText: '已匯入：寫入 1 筆' })).toBeVisible();
  await expect(page.getByText(/覆蓋率：/)).toBeVisible();

  await createDeck(page, '卡名測試牌組');
  await cardSearch(page).fill('測試俗稱');
  await expect(page.locator('.result-row')).toHaveCount(1);
  await expect(page.locator('.result-row').first()).toContainText('測試用睡鼠');
  await expect(page.locator('.result-row').first()).toContainText('Maliss <P> Dormouse'); // English kept as the secondary name

  // G56 / G57: the Simplified name is the same card — one result, not a second entry
  await cardSearch(page).fill('测试用睡鼠');
  await expect(page.locator('.result-row')).toHaveCount(1);

  // G58: a card without a translation falls back to English
  await cardSearch(page).fill('White Rabbit');
  await expect(page.locator('.result-row').first()).toContainText('Maliss <P> White Rabbit');
});

test('G59 / G60 / G66: switching the card-name language keeps stored decks and combos unchanged, and the choice survives a reload', async ({ page }) => {
  await mockCardSource(page);
  await fullSync(page);
  await createDeck(page, '語言切換牌組');
  await seedCombos(page, [testComboRoute({ id: 'rev9-route', name: '語言測試路線' })]);
  await page.goto('/settings');
  await importNames(page, FIXTURE);
  const before = await dumpUserData(page);

  await page.goto('/settings');
  await page.getByRole('radio', { name: 'English' }).check();
  await expect(page.getByText('卡名顯示已改為：English。')).toBeVisible();
  await page.getByRole('radio', { name: '中英文並列' }).check();
  await page.reload();
  await expect(page.getByRole('radio', { name: '中英文並列' })).toBeChecked();
  expect(await dumpUserData(page)).toEqual(before);

  await page.goto('/decks');
  await page.locator('.deck-row', { hasText: '語言切換牌組' }).getByRole('link', { name: '編輯' }).click();
  await cardSearch(page).fill('測試俗稱');
  await expect(page.locator('.result-row').first()).toContainText('測試用睡鼠（Maliss <P> Dormouse）');
});

test('G63 / G68: a broken names file is refused as a whole; nothing changes and the page says so', async ({ page }) => {
  await mockCardSource(page);
  await page.goto('/settings');
  await importNames(page, '[{"cardId": 32061192, "translationStatus": "user", "nameZhTw": "x", "translationSource": "s"}]');
  await expect(page.getByRole('status').filter({ hasText: '格式錯誤，未改動任何中文名稱資料。' })).toBeVisible();
  await expect(page.getByText('上次匯入：尚未匯入')).toBeVisible();
  await expect(page.locator('section[aria-labelledby="names-heading"] ul.notice li').first()).toBeVisible();
});

test('G65: the coverage line counts the cards of the chosen pool', async ({ page }) => {
  await mockCardSource(page);
  await fullSync(page);
  await importNames(page, FIXTURE);
  await expect(page.getByText(/覆蓋率：\d+%（1 \/ 97 張有繁體中文名稱/)).toBeVisible();
});
