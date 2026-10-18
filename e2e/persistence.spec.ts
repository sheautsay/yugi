import { BrowserContext, chromium, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dumpUserData, importTestDeck, mockCardSource, testComboRoute } from './fixtures';

// G9 in a real browser profile: data must survive closing and relaunching Edge, and a backup
// must restore into a brand-new profile. Card source MOCKED.

const BASE = 'http://localhost:4310';
const dirs: string[] = [];

async function launch(dir: string): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext(dir, { channel: 'msedge', baseURL: BASE, acceptDownloads: true });
  await mockCardSource(context);
  return context;
}

async function newProfile(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ygo-e2e-profile-'));
  dirs.push(dir);
  return dir;
}

test.afterAll(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
});

test('G9: decks and combos survive a full browser restart; a backup restores into a new profile', async () => {
  test.setTimeout(180_000);
  const profileA = await newProfile();

  // Session 1: create data, then close the whole browser.
  let context = await launch(profileA);
  let page = await context.newPage();
  await importTestDeck(page, '重啟測試牌組');
  await page.goto('/combos');
  await page.getByLabel('JSON 內容').fill(JSON.stringify(testComboRoute({ id: 'persist-route', name: '重啟測試路線' })));
  await page.getByRole('button', { name: '檢查' }).click();
  await page.getByRole('button', { name: '確認匯入' }).click();
  await expect(page.getByRole('status')).toContainText('已匯入 1 條');
  const before = await dumpUserData(page);
  await context.close();

  // Session 2: same profile, fresh browser process.
  context = await launch(profileA);
  page = await context.newPage();
  await page.goto('/decks');
  await expect(page.locator('.deck-row', { hasText: '重啟測試牌組' })).toBeVisible();
  await page.goto('/combos');
  await expect(page.locator('.combo-row', { hasText: '重啟測試路線' })).toBeVisible();
  expect(await dumpUserData(page)).toEqual(before);

  await page.goto('/settings');
  await expect(page.getByText('清除瀏覽器資料或換電腦會消失')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '匯出完整備份（JSON）' }).click()]);
  const backupPath = join(await newProfile(), 'backup.json');
  await download.saveAs(backupPath);
  await context.close();

  // Session 3: brand-new profile (no data) → restore from the backup file.
  context = await launch(await newProfile());
  page = await context.newPage();
  await page.goto('/decks');
  await expect(page.getByText('尚未建立任何牌組')).toBeVisible();
  await page.goto('/settings');
  await page.getByLabel('從備份檔還原…').setInputFiles(backupPath);
  await expect(page.getByText(/牌組 1、Combo 1、版型 0/)).toBeVisible();
  await expect(page.getByText('將會：新增 2、覆蓋 0、另存副本 0、略過 0、內容相同不變 0。')).toBeVisible();
  expect((await dumpUserData(page)).decks).toEqual([]); // preview writes nothing
  await page.getByRole('button', { name: '確認還原' }).click();
  await expect(page.getByRole('status')).toContainText('還原完成：新增 2');
  expect(await dumpUserData(page)).toEqual(before);

  // Restoring the same file again changes nothing (no duplicates).
  await page.getByLabel('從備份檔還原…').setInputFiles(backupPath);
  await expect(page.getByText('將會：新增 0、覆蓋 0、另存副本 0、略過 0、內容相同不變 2。')).toBeVisible();
  await page.getByRole('button', { name: '確認還原' }).click();
  expect(await dumpUserData(page)).toEqual(before);
  await context.close();
});

test('G9: a corrupted backup file is rejected without writing anything', async () => {
  const context = await launch(await newProfile());
  const page = await context.newPage();
  await page.goto('/settings');
  await page.getByLabel('從備份檔還原…').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'ygo-combo-assistant/backup', backupVersion: 1, exportedAt: 'x', decks: [{ id: 'd' }], combos: [], layouts: [] })),
  });
  await expect(page.getByRole('alert')).toContainText('無法還原（未寫入任何資料）');
  expect(await dumpUserData(page)).toEqual({ decks: [], combos: [], layouts: [] });
  await context.close();
});
