import { expect, test } from '@playwright/test';
import { MALISS, toYdke } from '../e2e/fixtures';
import { BRIDGE_EXE_NAME, alive, goto, launchApp, processes, waitUntil } from './app';

// Win11 acceptance against the INSTALLED release build (docs/acceptance-desktop-v1*.md). REAL YGOPRODeck network.
// Every test starts the app from its installed .exe, exactly like the desktop shortcut does.

const ids = Object.values(MALISS);
const MALISS_DECK = {
  main: ids.filter((id) => ![MALISS.redRansom, MALISS.whiteBinder, MALISS.heartsCrypter].includes(id as never)).map((id): [number, number] => [id, 1]),
  extra: [MALISS.redRansom, MALISS.whiteBinder, MALISS.heartsCrypter].map((id): [number, number] => [id, 1]),
  side: [] as Array<[number, number]>,
};

test.describe.configure({ mode: 'serial' });

/** Unique per run, so repeated runs against the same installed app never collide. */
const DECK = `桌面驗收牌組 ${Date.now().toString(36)}`;

test('P0.1 / DK2 / DK3: the installed app starts from its exe, shows the zh-TW shell, every route opens, a reload keeps the page', async () => {
  const app = await launchApp();
  try {
    const { page } = app;
    await expect(page).toHaveTitle(/YGO Combo 助手/);
    // CR-012: the installed app opens on the home page.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('首頁');
    expect(page.url()).toBe('http://tauri.localhost/home');
    for (const [path, heading] of [
      ['/combos', 'Combo 管理'],
      ['/settings', '設定'],
      ['/decks', '牌組'],
    ] as const) {
      await goto(page, path);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    }
    // Deep link + reload must come back to the same page, not a blank window (P0.1).
    await goto(page, '/combos');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Combo 管理' }).first()).toBeVisible();
    // No dev server: everything is served by the app itself.
    expect(await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /localhost:4200/.test(n)))).toEqual([]);
  } finally {
    await app.close();
  }
});

test('UI root cause: the installed app loads every stylesheet — no CSP violation, component styles applied (no browser-default links)', async () => {
  // Found 2026-10-11: Tauri added a nonce to style-src, which makes browsers ignore 'unsafe-inline', so Angular's
  // component styles were blocked and the header showed default blue underlined links.
  const app = await launchApp();
  try {
    const { page } = app;
    const violations: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy|Refused to (apply|load)/i.test(m.text())) violations.push(m.text());
    });
    for (const path of ['/decks', '/combos', '/settings']) {
      await goto(page, path);
      await page.waitForTimeout(500);
    }
    await page.reload();
    await page.waitForTimeout(1000);
    expect(violations).toEqual([]);
    const link = page.locator('header a, nav a').first();
    await expect(link).toBeVisible();
    const style = await link.evaluate((el) => {
      const s = getComputedStyle(el);
      return { decoration: s.textDecorationLine, color: s.color };
    });
    expect(style.decoration).toBe('none');
    expect(style.color).not.toBe('rgb(0, 0, 238)'); // the browser default link blue
    // Every <style> element Angular added is actually in effect (has rules the browser accepted).
    const blocked = await page.evaluate(() => [...document.querySelectorAll('style')].filter((s) => s.textContent && s.textContent.length > 20 && (s.sheet?.cssRules.length ?? 0) === 0).length);
    expect(blocked).toBe(0);
  } finally {
    await app.close();
  }
});

test('P0.3 / DK5 / DK6: real card data and card images download through the app, are cached, and still show after a restart', async () => {
  let app = await launchApp();
  try {
    const { page } = app;
    await goto(page, '/decks');
    await page.getByLabel('牌組代碼或 YDK 內容').fill(toYdke(MALISS_DECK));
    await page.getByRole('button', { name: '解析', exact: true }).click();
    // First run: the card data is downloaded through the app. Later runs: it is already in the app's own cache.
    const download = page.getByRole('button', { name: '從 YGOPRODeck 下載缺少的卡片資料' });
    if (await download.isVisible().catch(() => false)) {
      await download.click();
      await expect(page.getByRole('status')).toContainText('已下載 12 張卡片資料', { timeout: 60_000 });
    }
    await expect(page.getByText('尚未識別')).toHaveCount(0);
    await page.getByLabel('新牌組名稱').fill(DECK);
    await page.getByRole('button', { name: '確認匯入' }).click();
    await expect(page.getByRole('status')).toContainText(`已匯入「${DECK}」`);
    await page.locator('.deck-row', { hasText: DECK }).getByRole('link', { name: '編輯' }).click();
    await expect(page.getByText('Maliss <Q> Hearts Crypter').first()).toBeVisible();
    await page.getByRole('button', { name: '下載此牌組卡圖' }).click();
    await expect(page.getByRole('status')).toContainText(/已下載 \d+ 張卡圖（已快取者略過）/, { timeout: 90_000 });
    await expect(page.getByRole('status')).not.toContainText('失敗');
    const img = page.locator('app-card-tile img').first();
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(100);
    expect(await img.getAttribute('src')).toMatch(/^blob:/);
  } finally {
    await app.close();
  }

  // Restart: the deck, card data and cached images are still there (IndexedDB of the installed app).
  app = await launchApp();
  try {
    const { page } = app;
    await goto(page, '/decks');
    await page.locator('.deck-row', { hasText: DECK }).getByRole('link', { name: '編輯' }).click();
    const img = page.locator('app-card-tile img').first();
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(100);
  } finally {
    await app.close();
  }
});

test('DK11 / P0.4 / P0.5: choosing the ChatGPT account starts the bundled service by itself; closing the app ends it', async () => {
  const app = await launchApp();
  try {
    const { page } = app;
    expect(processes(BRIDGE_EXE_NAME).size).toBe(0);
    await goto(page, '/decks');
    await page.locator('.deck-row', { hasText: DECK }).getByRole('link', { name: 'AI 展開分析' }).click();
    // CR-011: the only provider offered is the ChatGPT account.
    await expect(page.getByLabel(/ChatGPT 帳號登入/)).toBeChecked();
    await expect(page.getByText('Claude API（雲端')).toHaveCount(0);
    await expect(page.getByText('本機 Ollama')).toHaveCount(0);
    await page.getByRole('button', { name: '重新整理' }).click();
    await expect(page.getByRole('button', { name: 'Continue with ChatGPT' }).first()).toBeVisible({ timeout: 60_000 });
    const bridges = processes(BRIDGE_EXE_NAME);
    expect(bridges.size).toBe(1);
    const [[bridgePid, parent]] = [...bridges];
    expect(parent).toBe(app.pid); // started by the app, not by the user
    await app.close();
    await waitUntil(() => !alive(bridgePid), 10_000, 'the ChatGPT service to end with the app');
  } finally {
    if (alive(app.pid)) await app.kill();
  }
});

test('DK25 / P0.13: ending the app with no chance to clean up (End task) leaves no ChatGPT service behind', async () => {
  const app = await launchApp();
  const { page } = app;
  await goto(page, '/decks');
  await page.locator('.deck-row', { hasText: DECK }).getByRole('link', { name: 'AI 展開分析' }).click();
  await page.getByRole('button', { name: '重新整理' }).click();
  await expect(page.getByRole('button', { name: 'Continue with ChatGPT' }).first()).toBeVisible({ timeout: 60_000 });
  const [bridgePid] = [...processes(BRIDGE_EXE_NAME).keys()];
  expect(bridgePid).toBeTruthy();
  await app.kill();
  await waitUntil(() => !alive(bridgePid), 10_000, 'the ChatGPT service to end after the app was killed');
  // And the app starts normally again.
  const again = await launchApp();
  await expect(again.page.getByRole('heading', { level: 1 })).toHaveText('首頁');
  await again.close();
});

test('DK12: when the ChatGPT service crashes, "重新整理" starts a new one (no terminal, no restart of the app)', async () => {
  const app = await launchApp();
  try {
    const { page } = app;
    await goto(page, '/decks');
    await page.locator('.deck-row', { hasText: DECK }).getByRole('link', { name: 'AI 展開分析' }).click();
    await page.getByRole('button', { name: '重新整理' }).click();
    await expect(page.getByRole('button', { name: 'Continue with ChatGPT' }).first()).toBeVisible({ timeout: 60_000 });
    const [first] = [...processes(BRIDGE_EXE_NAME).keys()];
    process.kill(first); // simulate a crash
    await waitUntil(() => !alive(first), 5000, 'crash');
    // One click on 「重新整理」 is enough: the app notices the service is gone, starts a new one and reads its status.
    await page.getByRole('button', { name: '重新整理' }).click();
    await waitUntil(() => [...processes(BRIDGE_EXE_NAME).keys()].some((pid) => pid !== first), 60_000, 'a new ChatGPT service after one refresh');
    await expect(page.getByRole('button', { name: 'Continue with ChatGPT' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('本機 ChatGPT 服務目前沒有回應')).toHaveCount(0);
    const second = [...processes(BRIDGE_EXE_NAME).keys()];
    expect(second, `ygo-bridge processes after the restart: ${JSON.stringify([...processes(BRIDGE_EXE_NAME)])}, crashed pid ${first}, app pid ${app.pid}`).toHaveLength(1);
    expect(second[0]).not.toBe(first);
    await expect(page.getByText('npm run chatgpt-bridge')).toHaveCount(0);
  } finally {
    await app.close();
  }
});
