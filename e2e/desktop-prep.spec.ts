import { Page, expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { importTestDeck, mockCardSource, seedCombos, testComboRoute } from './fixtures';

// CR-010 (browser build, card source and Ollama MOCKED): the pieces added for the desktop app must work — and change
// nothing — in a normal browser. The installed desktop app is verified separately (docs/acceptance-desktop-v1.md).

async function importAndSync(page: Page, deckName: string) {
  await importTestDeck(page, deckName);
  await page.goto('/settings');
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText(/已同步 \d+ 張卡片/)).toBeVisible();
}

async function openAnalysis(page: Page, deckName: string) {
  await page.goto('/decks');
  await page.locator('.deck-row', { hasText: deckName }).getByRole('link', { name: 'AI 展開分析' }).click();
  await expect(page.getByRole('heading', { name: `AI 展開分析：${deckName}` })).toBeVisible();
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

/** A fake local Ollama. `mode` decides what it answers; every request path is recorded. */
async function mockOllama(page: Page, mode: 'ready' | 'missing' | 'down' | 'noModels') {
  const paths: string[] = [];
  await page.route('http://localhost:11434/**', async (route) => {
    const url = new URL(route.request().url());
    paths.push(url.pathname);
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (mode === 'down') return route.abort('connectionrefused');
    if (url.pathname === '/api/version') return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ version: '0.12.3' }) });
    if (url.pathname === '/api/tags') {
      const models = mode === 'noModels' ? [] : mode === 'ready' ? [{ name: 'qwen3:8b' }, { name: 'llama3:latest' }] : [{ name: 'llama3:latest' }];
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ models }) });
    }
    return route.fulfill({ status: 404, headers: CORS, body: 'not found' });
  });
  return paths;
}

test('P0.15 (browser): "check Ollama" tells ready / service down / model missing, and nothing contacts Ollama before the user asks', async ({ page }) => {
  await mockCardSource(page);
  await importAndSync(page, 'Ollama 檢查');
  const paths = await mockOllama(page, 'ready');
  await openAnalysis(page, 'Ollama 檢查');
  await page.getByLabel('本機 Ollama（離線；需自行安裝）').check();
  await page.getByLabel('模型名稱').fill('qwen3:8b');
  await page.getByLabel('模型名稱').press('Tab');
  await expect(page.getByText('尚未檢查。')).toBeVisible();
  expect(paths).toEqual([]); // choosing Ollama and typing a model contacts nothing (G22-2)

  await page.getByRole('button', { name: '檢查 Ollama' }).click();
  await expect(page.locator('[data-ollama-state="ready"]')).toContainText('Ollama 就緒');
  expect(paths).toEqual(['/api/version', '/api/tags']);

  // A different model that is not installed.
  await page.getByLabel('模型名稱').fill('mistral');
  await page.getByLabel('模型名稱').press('Tab');
  await expect(page.getByText('設定已變更，這是先前的檢查結果')).toBeVisible();
  await page.getByRole('button', { name: '檢查 Ollama' }).click();
  await expect(page.locator('[data-ollama-state="model-missing"]')).toContainText('ollama pull mistral');
});

test('P0.15 (browser): service not running and nothing installed are reported in plain words', async ({ page }) => {
  await mockCardSource(page);
  await importAndSync(page, 'Ollama 離線');
  await mockOllama(page, 'down');
  await openAnalysis(page, 'Ollama 離線');
  await page.getByLabel('本機 Ollama（離線；需自行安裝）').check();
  await page.getByRole('button', { name: '檢查 Ollama' }).click();
  await expect(page.locator('[data-ollama-state="service-down"]')).toContainText('ollama serve');

  await page.unroute('http://localhost:11434/**');
  await mockOllama(page, 'noModels');
  await page.getByRole('button', { name: '檢查 Ollama' }).click();
  await expect(page.locator('[data-ollama-state="no-model-name"]')).toContainText('ollama pull');
});

test('D7/D8 (browser): the backup carries the non-secret settings and never a key; restoring brings the settings back', async ({ page }) => {
  await mockCardSource(page);
  await importAndSync(page, '設定備份');
  const KEY = 'sk-ant-api03-E2E-DO-NOT-LEAK-0123456789ABCDEF';

  await page.goto('/decks');
  await page.locator('.deck-row', { hasText: '設定備份' }).getByRole('link', { name: 'AI 展開分析' }).click();
  await page.getByLabel('Claude API Key').fill(KEY);
  await page.goto('/settings');
  await page.getByRole('radio', { name: /English/ }).check();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '匯出完整備份（JSON）' }).click()]);
  const path = await download.path();
  const text = await readFile(path, 'utf8');
  const backup = JSON.parse(text);
  expect(backup.settings.app.cardLanguage).toBe('en');
  expect(backup.settings.ai.provider).toBe('anthropic');
  expect(text).not.toContain(KEY);
  expect(text).not.toMatch(/apiKey|api_key|refresh_token|access_token|Bearer /);

  // Change the setting away, then restore from the file with "restore settings" ticked.
  await page.getByRole('radio', { name: /繁體中文/ }).check();
  await page.getByLabel('從備份檔還原…').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.getByText('還原預覽（尚未寫入）')).toBeVisible();
  const box = page.getByLabel(/同時還原備份內的設定/);
  await expect(box).toBeChecked();
  await page.getByRole('button', { name: '確認還原' }).click();
  await expect(page.getByRole('status').filter({ hasText: '還原完成' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /English/ })).toBeChecked();

  // Unticked: the data is restored but the settings stay as they are.
  await page.getByRole('radio', { name: /繁體中文/ }).check();
  await page.getByLabel('從備份檔還原…').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.getByLabel(/同時還原備份內的設定/).uncheck();
  await page.getByRole('button', { name: '確認還原' }).click();
  await expect(page.getByRole('status').filter({ hasText: '還原完成' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /繁體中文/ })).toBeChecked();
});

test('D7 (browser): a backup whose settings carry a key or token is rejected as a whole', async ({ page }) => {
  await mockCardSource(page);
  await page.goto('/settings');
  const bad = JSON.stringify({
    format: 'ygo-combo-assistant/backup',
    backupVersion: 1,
    exportedAt: '2026-10-11T00:00:00.000Z',
    decks: [],
    combos: [],
    layouts: [],
    settings: { app: { cardPool: 'master-duel', autoThumbnails: true, cardLanguage: 'zh-TW' }, ai: { provider: 'anthropic', apiKey: 'x' } },
  });
  await page.getByLabel('從備份檔還原…').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(bad) });
  await expect(page.getByText('無法還原（未寫入任何資料）')).toBeVisible();
  await expect(page.getByText(/含有疑似機密/)).toBeVisible();
});

test('P0.14 (browser, external hosts blocked): every stored-data page and both teaching modes work with no network', async ({ page }) => {
  await mockCardSource(page);
  await importAndSync(page, '離線牌組');
  await page.goto('/combos');
  await seedCombos(page, [testComboRoute({ id: 'offline-route', name: '離線路線', steps: 3 })]);

  // From here on every external host is unreachable (only the dev server itself answers).
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  await page.route(/db\.ygoprodeck\.com|images\.ygoprodeck\.com|\/ygo-images\/|api\.anthropic\.com|db\.yugioh-card\.com|localhost:11434|\/chatgpt-bridge/, (route) => route.abort('internetdisconnected'));

  await page.goto('/decks');
  await expect(page.locator('.deck-row', { hasText: '離線牌組' })).toBeVisible();
  await page.locator('.deck-row', { hasText: '離線牌組' }).getByRole('link', { name: '編輯' }).click();
  await expect(page.getByRole('heading', { name: '搜尋卡片並加入牌組' })).toBeVisible();
  await page.goto('/combos');
  await expect(page.locator('.combo-row', { hasText: '離線路線' })).toBeVisible();
  await page.locator('.combo-row', { hasText: '離線路線' }).getByRole('link').first().click();
  await expect(page.getByRole('heading', { name: '離線路線' }).first()).toBeVisible();
  await page.getByRole('button', { name: '逐步教學' }).click();
  await expect(page.getByText(/第 1 \/ 3 步/).first()).toBeVisible();
  await page.getByRole('button', { name: /圖像流程/ }).click();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: '備份與還原' })).toBeVisible();
  await page.getByRole('button', { name: '匯出完整備份（JSON）' }).click();
  // The AI page opens, and a Claude analysis without a key explains itself instead of hanging.
  await openAnalysis(page, '離線牌組');
  expect(errors).toEqual([]);
});
