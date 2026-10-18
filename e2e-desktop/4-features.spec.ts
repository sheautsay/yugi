import { Page, expect, test } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { MALISS, toYdk, toYdke } from '../e2e/fixtures';
import { buildBackup } from '../src/app/core/backup';
import { newDeck } from '../src/app/core/deck';
import { goto, launchApp, outsideProject } from './app';

// Win11 acceptance against the INSTALLED release build: full card sync and search, deck management including the
// native Save dialog, a V1 browser backup imported into the desktop app, opening-hand query, screenshot recognition
// and the ChatGPT service's authorization seen from outside the app. REAL YGOPRODeck network.

test.describe.configure({ mode: 'serial' });

const RUN = Date.now().toString(36);
const malissMain = [MALISS.dormouse, MALISS.whiteRabbit, MALISS.chessyCat, MALISS.marchHare, MALISS.underground, MALISS.mirror, MALISS.gwc06, MALISS.tb11, MALISS.mtp07];
let filler: number[] = [];
const legalDeck = () => ({
  main: [...malissMain.map((id): [number, number] => [id, 3]), ...filler.map((id, i): [number, number] => [id, i < 4 ? 3 : 1])],
  extra: [MALISS.redRansom, MALISS.whiteBinder, MALISS.heartsCrypter].map((id): [number, number] => [id, 1]),
  side: [] as Array<[number, number]>,
});

/** Answers the Windows "Save As" dialog the app opens (e2e-desktop/save-dialog.ps1: sets the name, presses Save). */
function answerSaveDialog(appPid: number, path: string): Promise<number> {
  outsideProject(path);
  const helper = resolve(__dirname, 'save-dialog.ps1');
  return new Promise((done) =>
    spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helper, '-AppPid', String(appPid), '-Path', path], { stdio: 'ignore' }).once('exit', (c) => done(c ?? 1)),
  );
}

/** A synthetic screenshot drawn in the app from real card art (passed in as data: URLs — the app's CSP allows those for images). */
async function syntheticScreenshot(page: Page, art: string[], width = 1920, height = 1080): Promise<Buffer> {
  const base64 = (await page.evaluate(`(async () => {
    const art = ${JSON.stringify(art)};
    const canvas = document.createElement('canvas'); canvas.width = ${width}; canvas.height = ${height};
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#101826'; ctx.fillRect(0, 0, ${width}, ${height});
    const row = { x: 0.25 * ${width}, y: 0.72 * ${height}, w: 0.5 * ${width}, h: 0.26 * ${height} };
    const cardW = row.w / art.length;
    for (let i = 0; i < art.length; i++) {
      const img = new Image(); img.src = art[i]; await img.decode();
      const x = row.x + cardW * i;
      ctx.fillStyle = '#c4783c'; ctx.fillRect(x + 2, row.y, cardW - 4, row.h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, x + 0.12 * cardW, row.y + 0.185 * row.h, 0.76 * cardW, 0.52 * row.h);
    }
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s);
  })()`)) as string;
  return Buffer.from(base64, 'base64');
}

test.beforeAll(async () => {
  const sky = (await (await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?archetype=Sky%20Striker')).json()) as { data: Array<{ id: number; frameType: string }> };
  const extraFrames = new Set(['fusion', 'synchro', 'xyz', 'link', 'fusion_pendulum', 'synchro_pendulum', 'xyz_pendulum']);
  filler = sky.data.filter((c) => !extraFrames.has(c.frameType)).slice(0, 5).map((c) => c.id);
});

test('DK5: the full Master Duel card pool syncs through the app (about 24 MB) and is searchable locally by name and ID', async () => {
  test.setTimeout(420_000);
  const app = await launchApp();
  try {
    const { page } = app;
    await goto(page, '/settings');
    const started = Date.now();
    await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
    const done = page.getByText(/已同步 (\d+) 張卡片|卡片資料已是最新版本/).first();
    await expect(done).toBeVisible({ timeout: 300_000 });
    console.log(`full sync: ${(await done.textContent())?.trim()} in ${Math.round((Date.now() - started) / 1000)} s`);
    await goto(page, '/decks');
    await page.getByLabel('牌組名稱', { exact: true }).fill(`搜尋驗收 ${RUN}`);
    await page.getByRole('button', { name: '建立', exact: true }).click();
    await page.locator('.deck-row', { hasText: `搜尋驗收 ${RUN}` }).getByRole('link', { name: '編輯' }).click();
    await page.getByLabel('卡名（英文／繁中／俗稱）或卡片 ID').fill('maliss');
    await expect(page.locator('app-card-browser p[aria-live]')).toContainText(/符合 1\d 張/);
    await page.getByLabel('卡名（英文／繁中／俗稱）或卡片 ID').fill(String(MALISS.dormouse));
    await expect(page.locator('app-card-browser p[aria-live]')).toContainText('符合 1 張');
  } finally {
    await app.close();
  }
});

test('DK4: decks — import ydke:// and a YDK file, edit, save, and export through the Windows Save dialog', async () => {
  const app = await launchApp();
  const out = join(realpathSync.native(tmpdir()), `ygo-desktop-export-${RUN}.deck.json`);
  rmSync(out, { force: true });
  try {
    const { page } = app;
    await goto(page, '/decks');
    // ydke://
    await page.getByLabel('牌組代碼或 YDK 內容').fill(toYdke(legalDeck()));
    await page.getByRole('button', { name: '解析', exact: true }).click();
    const dl = page.getByRole('button', { name: '從 YGOPRODeck 下載缺少的卡片資料' });
    if (await dl.isVisible().catch(() => false)) await dl.click();
    await expect(page.getByText('牌表檢核通過，匯入後可用於起手查詢。')).toBeVisible({ timeout: 60_000 });
    await page.getByLabel('新牌組名稱').fill(`合法牌組 ${RUN}`);
    await page.getByRole('button', { name: '確認匯入' }).click();
    await expect(page.getByRole('status')).toContainText(`已匯入「合法牌組 ${RUN}」`);
    // YDK file through the file picker input.
    await page.locator('app-deck-import-panel input[type=file]').setInputFiles({ name: 'test.ydk', mimeType: 'text/plain', buffer: Buffer.from(toYdk(legalDeck())) });
    await page.getByRole('button', { name: '解析', exact: true }).click().catch(() => undefined);
    await expect(page.getByText('牌表檢核通過，匯入後可用於起手查詢。')).toBeVisible({ timeout: 60_000 });
    await page.getByLabel('新牌組名稱').fill(`YDK 牌組 ${RUN}`);
    await page.getByRole('button', { name: '確認匯入' }).click();
    await expect(page.getByRole('status')).toContainText(`已匯入「YDK 牌組 ${RUN}」`);

    // Edit + save.
    await page.locator('.deck-row', { hasText: `合法牌組 ${RUN}` }).getByRole('link', { name: '編輯' }).click();
    await expect(page.getByText('Maliss <P> Dormouse').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '儲存', exact: true })).toBeDisabled(); // nothing changed yet
    await page.getByRole('textbox', { name: '牌組名稱' }).fill(`合法牌組 ${RUN} 改`);
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await expect(page.getByRole('status').first()).toContainText('已儲存（版本 2）');

    // Export: the app opens the Windows Save dialog (answered here through UI Automation) and writes the file.
    const answered = answerSaveDialog(app.pid, out);
    await page.getByRole('button', { name: '下載牌組 JSON 備份' }).click();
    expect(await answered, 'the Save dialog appeared and was answered').toBe(0);
    await expect.poll(() => existsSync(out), { timeout: 15_000 }).toBe(true);
    const saved = JSON.parse(readFileSync(out, 'utf8'));
    expect(saved.name).toBe(`合法牌組 ${RUN} 改`);
    expect(saved.version).toBe(2);
    expect(saved.main.length).toBeGreaterThan(5);
  } finally {
    rmSync(out, { force: true });
    await app.close();
  }
});

test('DK19: a backup exported from the V1 browser version imports into the desktop app with the same content', async () => {
  const app = await launchApp();
  try {
    const { page } = app;
    // Built by the V1 code itself (the browser build's buildBackup), so it is exactly what V1 writes: backupVersion 1, no settings.
    const deck = { ...newDeck(`V1 匯入牌組 ${RUN}`, '2026-10-09T12:00:00.000Z', `v1-deck-${RUN}`), main: malissMain.map((cardId) => ({ cardId, count: 3 })), extra: [{ cardId: MALISS.redRansom, count: 1 }] };
    const v1 = buildBackup({ decks: [deck], combos: [], layouts: [] }, '2026-10-09T12:00:00.000Z');
    expect('settings' in v1).toBe(false);
    await goto(page, '/settings');
    await page.getByLabel('從備份檔還原…').setInputFiles({ name: 'v1-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v1)) });
    const failed = page.getByText('無法還原（未寫入任何資料）');
    if (await failed.isVisible().catch(() => false)) throw new Error(await page.locator('.notice.bad').innerText());
    await expect(page.getByText('還原預覽（尚未寫入）')).toBeVisible();
    await page.getByRole('button', { name: '確認還原' }).click();
    await expect(page.getByRole('status').filter({ hasText: '還原完成' })).toBeVisible();
    await goto(page, '/decks');
    await expect(page.locator('.deck-row', { hasText: `V1 匯入牌組 ${RUN}` })).toBeVisible();
  } finally {
    await app.close();
  }
});

test('DK8: opening-hand query on the legal deck, and screenshot recognition from real card art', async () => {
  test.setTimeout(420_000);
  const app = await launchApp();
  try {
    const { page } = app;
    await goto(page, '/decks');
    await page.locator('.deck-row', { hasText: `合法牌組 ${RUN}` }).getByRole('link', { name: '起手查詢' }).click();
    await page.getByRole('button', { name: '開啟截圖辨識' }).click();
    // The button is offered only while some recognition art is missing (later runs: already cached by the app).
    const refs = page.getByRole('button', { name: '下載辨識用卡圖（YGOPRODeck）' });
    if (await refs.isVisible().catch(() => false)) {
      await refs.click();
      await expect(page.getByText(/已下載 \d+ 張辨識用卡圖/)).toBeVisible({ timeout: 180_000 });
    }
    await expect(page.getByText(/還沒有辨識用卡圖/)).toHaveCount(0);
    const hand = [MALISS.dormouse, MALISS.whiteRabbit, MALISS.underground, MALISS.gwc06, filler[0]];
    const art = await Promise.all(
      hand.map(async (id) => `data:image/jpeg;base64,${Buffer.from(await (await fetch(`https://images.ygoprodeck.com/images/cards_cropped/${id}.jpg`)).arrayBuffer()).toString('base64')}`),
    );
    const png = await syntheticScreenshot(page, art);
    await page.locator('app-screenshot-recognizer input[type=file]').setInputFiles({ name: 'real-art.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: '使用預設位置' }).click();
    await page.getByRole('button', { name: '開始辨識' }).click();
    const slots = page.locator('app-screenshot-recognizer li.slot');
    await expect(slots).toHaveCount(5);
    const chosen = await slots.evaluateAll((els) => els.map((e) => e.querySelector('figure')?.getAttribute('aria-label') ?? ''));
    const statuses = await slots.evaluateAll((els) => els.map((e) => e.getAttribute('data-status')));
    console.log('desktop recognition', JSON.stringify({ statuses, chosen }));
    expect(statuses).toEqual(Array(5).fill('confident'));
    hand.forEach((id, i) => expect(chosen[i]).toContain(`ID ${id}`));
    await page.getByRole('button', { name: '確認手牌並查詢' }).click();
    await expect(page.getByRole('heading', { name: /起手（5 \/ 5 張）/ })).toBeVisible();
    // The query answers honestly: either matching combos or "no recorded combo" — never "cannot combo".
    await expect(page.getByText(/沒有收錄符合目前起手的固定展開|可用|不符合|未驗證/).first()).toBeVisible();
    await expect(page.getByText('無法展開')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('DK22 / P0.6 on the installed service: from outside the app, nothing is answered without the per-launch secret', async () => {
  const app = await launchApp();
  try {
    const session = (await app.page.evaluate(`window.__TAURI_INTERNALS__.invoke('bridge_start')`)) as { port: number; token: string };
    const get = (headers: Record<string, string>) =>
      new Promise<number>((resolve, reject) => {
        const req = httpRequest({ host: '127.0.0.1', port: session.port, path: '/status', headers: { host: `127.0.0.1:${session.port}`, ...headers } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        req.end();
      });
    expect(await get({ 'x-ygo-bridge': '1' })).toBe(401); // no Origin, no secret
    expect(await get({ 'x-ygo-bridge': '1', origin: 'http://tauri.localhost' })).toBe(401);
    expect(await get({ 'x-ygo-bridge': '1', 'x-ygo-bridge-token': 'x'.repeat(64) })).toBe(401);
    expect(await get({ 'x-ygo-bridge': '1', 'x-ygo-bridge-token': session.token, origin: 'https://evil.example' })).toBe(403);
    expect(await get({ 'x-ygo-bridge': '1', 'x-ygo-bridge-token': session.token })).toBe(200);
    const listening = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
      .split('\n')
      .map((l) => l.trim().split(' ').filter(Boolean))
      .filter((c) => c[3] === 'LISTENING' && c[1].endsWith(`:${session.port}`))
      .map((c) => c[1]);
    expect(listening).toEqual([`127.0.0.1:${session.port}`]);
  } finally {
    await app.close();
  }
});
