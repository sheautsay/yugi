import { expect, test } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { testComboRoute } from '../e2e/fixtures';
import { APP_EXE, BACKUP_DIR_NAME, goto, launchApp, processes, waitUntil } from './app';

// Win11 acceptance against the INSTALLED release build: data protection, offline use, permissions.

test.describe.configure({ mode: 'serial' });

const RUN = Date.now().toString(36);
const COMBO = testComboRoute({ id: `desktop-${RUN}`, name: `桌面驗收路線 ${RUN}`, steps: 3 });
const documents = () => execFileSync('powershell.exe', ['-NoProfile', '-Command', "[Environment]::GetFolderPath('MyDocuments')"], { encoding: 'utf8' }).trim();

test('DK7: a combo is imported, saved and shown in both teaching modes (image flow and step-by-step)', async () => {
  const app = await launchApp();
  try {
    const { page } = app;
    await goto(page, '/combos');
    await page.getByLabel('JSON 內容').fill(JSON.stringify(COMBO));
    await page.getByRole('button', { name: '檢查' }).click();
    await page.getByRole('button', { name: '確認匯入' }).click();
    await expect(page.getByRole('status')).toContainText('已匯入 1 條');
    await page.locator('.combo-row', { hasText: COMBO.name }).getByRole('link').first().click();
    await expect(page.getByRole('heading', { name: COMBO.name }).first()).toBeVisible();
    await page.getByRole('button', { name: '逐步教學' }).click();
    await expect(page.getByText(/第 1 \/ 3 步/).first()).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(/第 2 \/ 3 步/).first()).toBeVisible();
    await page.getByRole('button', { name: /圖像流程/ }).click();
    await page.getByRole('button', { name: '逐步教學' }).click();
    await expect(page.getByText(/第 2 \/ 3 步/).first()).toBeVisible(); // the two modes share the current step
  } finally {
    await app.close();
  }
});

test('DK10 / DK18 / P0.11 (D6): "back up now" writes a verified file to the Documents folder Windows reports; restoring from it works', async () => {
  const app = await launchApp();
  const dir = join(documents(), BACKUP_DIR_NAME);
  try {
    const { page } = app;
    await goto(page, '/settings');
    await expect(page.getByRole('heading', { name: '自動備份' })).toBeVisible();
    await expect(page.getByText(dir)).toBeVisible(); // the folder comes from Windows, not a hard-coded path
    await page.getByRole('button', { name: '立即備份' }).click();
    await expect(page.getByRole('status').first()).toContainText(/已建立備份：ygo-backup-\d{8}-\d{6}\.json/);
    const names = readdirSync(dir).filter((n) => /^ygo-backup-\d{8}-\d{6}\.json$/.test(n)).sort();
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBeLessThanOrEqual(10);
    expect(readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
    const text = readFileSync(join(dir, names.at(-1)!), 'utf8');
    const backup = JSON.parse(text);
    expect(backup.format).toBe('ygo-combo-assistant/backup');
    expect(backup.combos.some((c: { id: string }) => c.id === COMBO.id)).toBe(true);
    expect(backup.settings.ai.provider).toBe('chatgpt');
    expect(text).not.toMatch(/refresh_token|access_token|id_token|apiKey|sk-[A-Za-z0-9]{10}|x-ygo-bridge-token/);

    // Restore from the newest automatic backup through the app (same preview and confirmation as a file).
    await page.getByRole('button', { name: '從此備份還原…' }).first().click();
    await expect(page.getByText('還原預覽（尚未寫入）')).toBeVisible();
    await page.getByRole('button', { name: '確認還原' }).click();
    await expect(page.getByRole('status').filter({ hasText: '還原完成' })).toBeVisible();
  } finally {
    await app.close();
  }
});

test('DK14 / CR-011: the app itself refuses network targets outside its approved list (Claude, Ollama, any other host)', async () => {
  const app = await launchApp();
  try {
    const results = await app.page.evaluate(`(async () => {
      const inv = window.__TAURI_INTERNALS__.invoke;
      const out = {};
      for (const url of ['https://api.anthropic.com/v1/models', 'http://localhost:11434/api/tags', 'https://example.com/', 'https://api.openai.com/v1/models', 'https://db.ygoprodeck.com/api/v7/checkDBVer.php']) {
        try { await inv('plugin:http|fetch', { clientConfig: { method: 'GET', url, headers: [], data: null } }); out[url] = 'allowed'; }
        catch (e) { out[url] = 'refused: ' + String(e).slice(0, 80); }
      }
      return out;
    })()`);
    const r = results as Record<string, string>;
    expect(r['https://db.ygoprodeck.com/api/v7/checkDBVer.php']).toBe('allowed');
    for (const url of ['https://api.anthropic.com/v1/models', 'http://localhost:11434/api/tags', 'https://example.com/', 'https://api.openai.com/v1/models']) {
      expect(r[url], url).toMatch(/^refused/); // OpenAI is reached only by the bundled ChatGPT service, never by the page
    }
  } finally {
    await app.close();
  }
});

test('DK20 / P0.14: with no internet the stored decks, cards, images, combos and both teaching modes work; online-only actions fail fast with a clear reason', async () => {
  // Internet is cut for the app process only (all HTTPS goes to a closed local port); the bundled service on
  // 127.0.0.1 is unaffected. A physical disconnect is repeated on the Windows 10 VM.
  const app = await launchApp({ env: { HTTPS_PROXY: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9', ALL_PROXY: 'http://127.0.0.1:9', NO_PROXY: '127.0.0.1' } });
  try {
    const { page } = app;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await goto(page, '/decks');
    const row = page.locator('.deck-row', { hasText: '桌面驗收牌組' }).first();
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: '編輯' }).click();
    const img = page.locator('app-card-tile img').first();
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(100);
    await expect(page.getByText('Maliss <Q> Hearts Crypter').first()).toBeVisible();

    await goto(page, '/combos');
    await page.locator('.combo-row', { hasText: COMBO.name }).getByRole('link').first().click();
    await page.getByRole('button', { name: '逐步教學' }).click();
    await expect(page.getByText(/第 1 \/ 3 步/).first()).toBeVisible();
    await page.getByRole('button', { name: /圖像流程/ }).click();

    // An online-only action: a clear reason within a bounded time, no hang, no crash.
    await goto(page, '/settings');
    const started = Date.now();
    await page.getByRole('button', { name: /下載／更新完整卡片資料/ }).click();
    await expect(page.getByRole('status').first()).toContainText(/無法連線|離線|失敗/, { timeout: 60_000 });
    expect(Date.now() - started).toBeLessThan(60_000);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test('DK3: a second launch does not start a second app (single instance)', async () => {
  const app = await launchApp();
  try {
    expect(processes('ygo-combo-assistant.exe').size).toBe(1);
    const second = spawn(APP_EXE, [], { stdio: 'ignore' });
    await new Promise((r) => second.once('exit', r));
    await waitUntil(() => processes('ygo-combo-assistant.exe').size === 1, 10_000, 'only one app instance');
    expect([...processes('ygo-combo-assistant.exe').keys()]).toEqual([app.pid]);
  } finally {
    await app.close();
  }
});

test('P0.16: copying the deck code puts it on the Windows clipboard', async () => {
  const app = await launchApp();
  try {
    const { page } = app;
    await goto(page, '/decks');
    await page.locator('.deck-row', { hasText: '桌面驗收牌組' }).first().getByRole('link', { name: '編輯' }).click();
    const copy = page.getByRole('button', { name: /複製.*(ydke|代碼)/ }).first();
    await copy.click();
    await expect(page.getByRole('status').filter({ hasText: '已複製 ydke:// 代碼。' })).toBeVisible();
    // Another process may hold the Windows clipboard open for a moment ("clipboard in use"): retry the read briefly.
    let clip = '';
    let lastError = '';
    for (let i = 0; i < 10 && !clip; i++) {
      try {
        clip = execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard'], { encoding: 'utf8' }).trim();
      } catch (e) {
        lastError = String(e).slice(0, 200);
        await page.waitForTimeout(500);
      }
    }
    expect(clip, lastError).toMatch(/^ydke:\/\//);
  } finally {
    await app.close();
  }
});

test('DK13: nothing secret is stored in the app\'s web storage', async () => {
  const app = await launchApp();
  try {
    const dump = await app.page.evaluate(`(async () => {
      const out = [JSON.stringify(localStorage), JSON.stringify(sessionStorage)];
      for (const info of await indexedDB.databases()) {
        const db = await new Promise((res, rej) => { const r = indexedDB.open(info.name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        for (const store of db.objectStoreNames) {
          if (store === 'images') continue;
          const all = await new Promise((res) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); });
          out.push(JSON.stringify(all));
        }
        db.close();
      }
      return out.join('\\n');
    })()`);
    expect(String(dump).length).toBeGreaterThan(100);
    expect(String(dump)).not.toMatch(/refresh_token|access_token|id_token|x-ygo-bridge-token|Bearer |sk-[A-Za-z0-9]{10}/);
    expect(existsSync(APP_EXE)).toBe(true);
  } finally {
    await app.close();
  }
});
