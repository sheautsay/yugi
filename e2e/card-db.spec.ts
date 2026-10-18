import { Page, expect, test } from '@playwright/test';
import { mockCardSource, openAddDeck, setAutoThumbnails } from './fixtures';

// G17–G20 with a MOCKED full card source (fixture FULL_DATASET: 97 Master Duel cards, 99 in all).

async function sync(page: Page, expected: RegExp | string, timeout = 5_000) {
  await page.goto('/settings');
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText(expected).first()).toBeVisible({ timeout });
}

async function newDeckEditor(page: Page, name: string) {
  await page.goto('/decks');
  await openAddDeck(page);
  await page.getByLabel('牌組名稱', { exact: true }).fill(name);
  await page.getByRole('button', { name: '建立', exact: true }).click();
  await page.locator('.deck-row', { hasText: name }).getByRole('link', { name: '編輯' }).click();
  await expect(page.getByRole('heading', { name: '搜尋卡片並加入牌組' })).toBeVisible();
}

async function search(page: Page, text: string) {
  await page.getByLabel('卡名（英文／繁中／俗稱）或卡片 ID').fill(text);
}

const summary = (page: Page) => page.locator('app-card-browser p[aria-live]');

test('G17: full sync, skip when unchanged, force/new version re-download, failure keeps data, pool switch', async ({ page }) => {
  test.setTimeout(90_000);
  let version = '147.23';
  let fullStatus = 200;
  const { apiCalls, imageCalls } = await mockCardSource(page, { dbVersion: () => version, fullStatus: () => fullStatus });
  await newDeckEditor(page, '同步前就有的牌組');
  await page.goto('/decks');

  await sync(page, '已同步 97 張卡片（新增 97、更新 0），資料版本 147.23。');
  expect(apiCalls).toEqual(['https://db.ygoprodeck.com/api/v7/checkDBVer.php', 'https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes&format=master%20duel']);
  expect(imageCalls).toEqual([]); // G19-1
  await expect(page.getByText(/本機資料：Master Duel 卡池・97 張・資料版本 147.23/)).toBeVisible();

  apiCalls.length = 0;
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText('卡片資料已是最新版本（147.23），未重新下載。')).toBeVisible();
  expect(apiCalls).toEqual(['https://db.ygoprodeck.com/api/v7/checkDBVer.php']);

  await page.getByRole('button', { name: '強制重新下載' }).click();
  await expect(page.getByText('已同步 97 張卡片（新增 0、更新 97），資料版本 147.23。')).toBeVisible();

  // N13: new upstream version but the download fails → nothing changes.
  version = '147.24';
  fullStatus = 500;
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText(/伺服器暫時無法回應（HTTP 500）.*已快取的資料不受影響/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/本機資料：Master Duel 卡池・97 張・資料版本 147.23/)).toBeVisible();

  fullStatus = 200;
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText('已同步 97 張卡片（新增 0、更新 97），資料版本 147.24。')).toBeVisible();

  await page.getByLabel('全部遊戲王卡片').check();
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText('已同步 99 張卡片（新增 2、更新 97），資料版本 147.24。')).toBeVisible();

  await page.goto('/decks');
  await expect(page.locator('.deck-row', { hasText: '同步前就有的牌組' })).toBeVisible(); // G17-4
});

test('G18: local search by name, ID, zh name and alias; filters; paging; details with full image on demand', async ({ page }) => {
  const { apiCalls, imageCalls } = await mockCardSource(page);
  await sync(page, '已同步 97 張卡片');
  await newDeckEditor(page, '搜尋測試');
  apiCalls.length = 0;

  await expect(summary(page)).toHaveText(/符合 97 張（Master Duel 卡池）・第 1 \/ 5 頁/);
  await search(page, 'MALISS');
  await expect(summary(page)).toHaveText(/符合 12 張/);
  await search(page, '68059897');
  await expect(summary(page)).toHaveText(/符合 1 張/);
  await expect(page.locator('.result-row').first()).toContainText('Maliss <Q> Red Ransom');
  await search(page, '!!@@ 沒有這張');
  await expect(page.getByText('沒有符合的卡片')).toBeVisible(); // N14
  await search(page, '');

  await page.getByLabel('種類').selectOption('spell');
  await expect(summary(page)).toHaveText(/符合 3 張/);
  await page.getByLabel('種類').selectOption('any');
  await page.getByLabel('牌組區').selectOption('extra');
  await expect(summary(page)).toHaveText(/符合 16 張/);
  await page.getByLabel('牌組區').selectOption('any');
  await page.getByLabel('屬性').selectOption('LIGHT');
  await page.getByLabel('等級／階級').selectOption('8');
  await expect(summary(page)).toHaveText(/符合 7 張/);
  await page.getByRole('button', { name: '清除條件' }).click();
  await page.getByLabel('系列').fill('Maliss');
  await page.getByLabel('系列').press('Tab');
  await expect(summary(page)).toHaveText(/符合 12 張/);
  await page.getByRole('button', { name: '清除條件' }).click();

  await page.getByRole('button', { name: '最後一頁' }).click();
  await expect(summary(page)).toHaveText(/第 5 \/ 5 頁/);
  await expect(page.locator('.result-row')).toHaveCount(1);
  await page.getByRole('button', { name: '上一頁' }).click();
  await expect(page.locator('.result-row')).toHaveCount(24);

  await page.getByLabel('卡池').selectOption('all');
  await expect(summary(page)).toHaveText(/符合 97 張（全部遊戲王卡片）/); // only what is stored locally
  await page.getByRole('button', { name: '下載全部遊戲王卡片資料' }).click();
  await expect(page.getByText('已同步 99 張卡片（新增 2、更新 97）')).toBeVisible();
  await expect(summary(page)).toHaveText(/符合 99 張（全部遊戲王卡片）/);
  await page.getByLabel('卡池').selectOption('master-duel');
  await expect(summary(page)).toHaveText(/符合 97 張（Master Duel 卡池）/);
  apiCalls.length = 0;

  // Details: effect text, reference ban, full image only now.
  await search(page, 'Dormouse');
  expect(imageCalls.some((u) => u.includes('/cards/32061192.jpg'))).toBe(false);
  await page.getByRole('button', { name: '查看 Maliss <P> Dormouse 詳細資訊' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Maliss <P> Dormouse' })).toBeVisible();
  await expect(dialog).toContainText('Maliss <P> Dormouse 的測試效果文字（fixture）。');
  await expect(dialog).toContainText('（尚無繁體中文名稱）');
  await expect(dialog.locator('.image img')).toBeVisible();
  expect(imageCalls.filter((u) => u.includes('/cards/32061192.jpg'))).toHaveLength(1);

  // zh-TW name and alias come only from the user.
  await dialog.getByText('編輯繁中名稱、俗稱與 Master Duel 禁限（自行輸入）').click();
  await dialog.getByLabel('繁體中文名稱').fill('碼莉絲〈P〉睡鼠');
  await dialog.getByLabel('俗稱（以逗號或頓號分隔）').fill('睡鼠、老鼠');
  await dialog.getByRole('button', { name: '儲存標註' }).click();
  await expect(dialog.getByRole('status')).toContainText('已儲存');
  await dialog.getByRole('button', { name: '關閉' }).click();
  await search(page, '老鼠');
  await expect(page.locator('.result-row').first()).toContainText('碼莉絲〈P〉睡鼠');
  await search(page, '碼莉絲');
  await expect(summary(page)).toHaveText(/符合 1 張/);

  expect(apiCalls).toEqual([]); // G17-2: searching never calls the API
});

test('G19: thumbnails download only for visible results, once, and stay cached; can be switched off', async ({ page }) => {
  const { imageCalls } = await mockCardSource(page);
  await sync(page, '已同步 97 張卡片');
  await newDeckEditor(page, '縮圖測試');
  await page.locator('.result-row').first().scrollIntoViewIfNeeded();
  await expect.poll(() => imageCalls.filter((u) => u.includes('/cards_small/')).length).toBeGreaterThan(0);
  await page.waitForTimeout(1_500);
  const small = imageCalls.filter((u) => u.includes('/cards_small/'));
  expect(small.length).toBeLessThanOrEqual(24);
  expect(new Set(small).size).toBe(small.length); // each once
  expect(small.some((u) => u.includes('/92000060.jpg'))).toBe(false); // a page-3 card was never shown

  const before = imageCalls.length;
  await page.reload();
  await page.locator('.result-row').first().scrollIntoViewIfNeeded();
  await expect(page.locator('.result-row').first().locator('img')).toBeVisible();
  await page.waitForTimeout(1_000);
  const again = imageCalls.slice(before).filter((u) => small.includes(u));
  expect(again).toEqual([]); // cached: no repeat requests

  await setAutoThumbnails(page, false);
  const off = imageCalls.length;
  await page.goBack();
  await page.getByRole('button', { name: '最後一頁' }).click();
  await page.locator('.result-row').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_000);
  expect(imageCalls.slice(off).filter((u) => u.includes('/cards_small/'))).toEqual([]);
});

test('G20: +/− from search, extra-deck auto routing, 3-copy limit, Skill blocked, side mode, ban hint, saved', async ({ page }) => {
  await mockCardSource(page);
  await sync(page, '已同步 97 張卡片');
  await newDeckEditor(page, '編輯測試牌組');
  const check = page.locator('p', { hasText: /主牌 \d+／額外 \d+／備牌 \d+/ });

  await search(page, 'Dormouse');
  const add = page.getByRole('button', { name: '加入一張 Maliss <P> Dormouse' });
  await add.click();
  await expect(page.getByRole('status').first()).toContainText('已將「Maliss <P> Dormouse」加入主牌');
  await expect(check).toContainText('主牌 1／額外 0／備牌 0');
  await add.click();
  await add.click();
  await expect(check).toContainText('主牌 3／額外 0／備牌 0');
  await expect(add).toBeDisabled(); // N16: no 4th copy
  await expect(page.locator('.result-row').first()).toContainText('同名卡已達 3 張');

  await search(page, 'Red Ransom');
  await page.getByRole('button', { name: '加入一張 Maliss <Q> Red Ransom' }).click();
  await search(page, 'Fusion Gamma');
  await page.getByRole('button', { name: '加入一張 Test Fusion Gamma' }).click();
  await expect(check).toContainText('主牌 3／額外 2／備牌 0'); // extra-deck monsters never go to main
  await expect(page.getByRole('region', { name: '額外' })).toContainText('Maliss <Q> Red Ransom');

  await page.getByLabel('卡池').selectOption('all');
  await page.getByRole('button', { name: '下載全部遊戲王卡片資料' }).click();
  await expect(page.getByText(/已同步 99 張卡片/)).toBeVisible();
  await search(page, 'Test Skill');
  await expect(page.getByRole('button', { name: '加入一張 Test Skill' })).toBeDisabled();
  await expect(page.locator('.result-row').first()).toContainText('Skill／Token 卡不能放入牌組');
  await page.getByLabel('卡池').selectOption('master-duel');

  await search(page, 'Dormouse');
  await page.getByRole('button', { name: '從牌組移除一張 Maliss <P> Dormouse' }).click();
  await expect(check).toContainText('主牌 2／額外 2／備牌 0');
  await page.getByLabel('改為加入／移除備牌').check();
  await add.click();
  await expect(check).toContainText('主牌 2／額外 2／備牌 1');
  await expect(add).toBeDisabled();
  await page.getByLabel('改為加入／移除備牌').uncheck();

  // Ban hint is separate from the deck check.
  await page.getByRole('button', { name: '查看 Maliss <P> Dormouse 詳細資訊' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('編輯繁中名稱、俗稱與 Master Duel 禁限（自行輸入）').click();
  await dialog.getByLabel('Master Duel 禁限').selectOption('Limited');
  await dialog.getByRole('button', { name: '儲存標註' }).click();
  await dialog.getByRole('button', { name: '關閉' }).click();
  await expect(page.getByText(/禁限提示：「Maliss <P> Dormouse」你標註為 Master Duel 限制卡（上限 1 張），目前 3 張/)).toBeVisible();

  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('status').first()).toContainText('已儲存（版本 2）');
  await page.reload();
  await expect(check).toContainText('主牌 2／額外 2／備牌 1');

  // Re-syncing card data leaves the deck as it is (G20-5).
  await page.goto('/settings');
  await page.getByRole('button', { name: '強制重新下載' }).click();
  await expect(page.getByText(/已同步 97 張卡片/)).toBeVisible();
  await page.goBack();
  await expect(check).toContainText('主牌 2／額外 2／備牌 1');
});

test('N15: with auto thumbnails on and the internet down, tiles fall back to name + ID and the page keeps working', async ({ page }) => {
  await mockCardSource(page);
  await sync(page, '已同步 97 張卡片');
  await newDeckEditor(page, '離線縮圖');
  await page.unrouteAll();
  await page.route(/db\.ygoprodeck\.com|\/ygo-images\//, (route) => route.abort('internetdisconnected'));
  await search(page, 'Test Dragon');
  await page.locator('.result-row').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_500);
  await expect(page.locator('.result-row').first().locator('.fallback')).toContainText('ID 92000001');
  await page.getByRole('button', { name: '加入一張 Test Dragon 01' }).click();
  await expect(page.locator('p', { hasText: /主牌 \d+／額外/ })).toContainText('主牌 1／額外 0／備牌 0');
  await page.getByRole('button', { name: '查看 Test Dragon 01 詳細資訊' }).click();
  // The full image goes through the retry/backoff policy (1 s + 2 s + 4 s) before giving up.
  await expect(page.getByRole('dialog')).toContainText('無法下載卡圖（可能離線），以文字顯示。', { timeout: 15_000 });
  await expect(page.getByRole('dialog')).toContainText('A test dragon.');
});

test('narrow window (360 px): search, +/− and the details dialog stay usable without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await mockCardSource(page);
  await sync(page, '已同步 97 張卡片');
  await newDeckEditor(page, '窄視窗搜尋');
  await search(page, 'Dormouse');
  const width = () => page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  const [scroll, inner] = await width();
  expect(scroll).toBeLessThanOrEqual(inner);
  for (const name of ['加入一張 Maliss <P> Dormouse', '查看 Maliss <P> Dormouse 詳細資訊']) {
    const box = (await page.getByRole('button', { name }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
  }
  await page.getByRole('button', { name: '查看 Maliss <P> Dormouse 詳細資訊' }).click();
  const dialog = (await page.getByRole('dialog').boundingBox())!;
  expect(dialog.x).toBeGreaterThanOrEqual(0);
  expect(dialog.x + dialog.width).toBeLessThanOrEqual(360);
  await page.screenshot({ path: 'test-results/g10/360-7-card-detail.png' });
  await page.getByRole('dialog').getByRole('button', { name: '關閉' }).click();
  await page.screenshot({ path: 'test-results/g10/360-8-card-browser.png', fullPage: true });
});
