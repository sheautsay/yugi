import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { APP_EXE, BACKUP_DIR_NAME, DATA_DIR, INSTALL_DIR, goto, launchApp } from './app';

// DK16 / DK17 / P0.12 (decision D1): upgrading, uninstalling with the default options and reinstalling must keep the
// user's data. Uses the real installer and the real uninstaller, silently, for the current user (no admin).

const SETUP = process.env['YGO_SETUP'] ?? resolve('src-tauri/target/release/bundle/nsis/YGO Combo Assistant_0.1.0_x64-setup.exe');
const documents = () => execFileSync('powershell.exe', ['-NoProfile', '-Command', "[Environment]::GetFolderPath('MyDocuments')"], { encoding: 'utf8' }).trim();
const desktopLink = () => join(execFileSync('powershell.exe', ['-NoProfile', '-Command', "[Environment]::GetFolderPath('Desktop')"], { encoding: 'utf8' }).trim(), 'YGO Combo Assistant.lnk');
const startLink = () => join(execFileSync('powershell.exe', ['-NoProfile', '-Command', "[Environment]::GetFolderPath('Programs')"], { encoding: 'utf8' }).trim(), 'YGO Combo Assistant.lnk');

async function userData(): Promise<{ decks: string[]; combos: string[] }> {
  const app = await launchApp();
  try {
    await goto(app.page, '/decks');
    await expect(app.page.locator('.deck-row').first()).toBeVisible();
    const decks = await app.page.locator('.deck-row').allInnerTexts();
    await goto(app.page, '/combos');
    await expect(app.page.locator('.combo-row').first()).toBeVisible();
    const combos = await app.page.locator('.combo-row').allInnerTexts();
    expect(decks.length).toBeGreaterThan(0);
    return { decks: decks.map((d) => d.split('\n')[0]).sort(), combos: combos.map((c) => c.split('\n')[0]).sort() };
  } finally {
    await app.close();
  }
}

const runInstaller = () => execFileSync(SETUP, ['/S'], { stdio: 'ignore', timeout: 300_000 });
// `_?=` makes the NSIS uninstaller run in place and wait, instead of copying itself to %TEMP% and returning at once.
const runUninstaller = () => execFileSync(join(INSTALL_DIR, 'uninstall.exe'), ['/S', `_?=${INSTALL_DIR}`], { stdio: 'ignore', timeout: 300_000 });

test.describe.configure({ mode: 'serial' });

test('DK16 / DK17 / P0.12: upgrade, uninstall (default options) and reinstall keep every deck and combo', async () => {
  test.setTimeout(900_000);
  expect(existsSync(SETUP), SETUP).toBe(true);
  const before = await userData();
  const backupsBefore = readdirSync(join(documents(), BACKUP_DIR_NAME)).filter((n) => n.startsWith('ygo-backup-'));

  // DK16: install the same version over the existing one (an upgrade).
  runInstaller();
  expect(await userData()).toEqual(before);

  // DK17: uninstall with the default options.
  runUninstaller();
  // NSIS removes its files a moment after the uninstaller returns; in a full-suite run the desktop shortcut was once
  // still there when the program file was already gone (removed shortly after), so wait for all three.
  const deadline = Date.now() + 30_000;
  while ([APP_EXE, desktopLink(), startLink()].some((p) => existsSync(p)) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
  expect(existsSync(APP_EXE), 'the program is removed').toBe(false);
  expect(existsSync(desktopLink()), 'the desktop shortcut is removed').toBe(false);
  expect(existsSync(startLink()), 'the Start-menu shortcut is removed').toBe(false);
  expect(existsSync(DATA_DIR), `the user data folder is kept: ${DATA_DIR}`).toBe(true);
  const backupsAfter = readdirSync(join(documents(), BACKUP_DIR_NAME)).filter((n) => n.startsWith('ygo-backup-'));
  expect(backupsAfter, 'automatic backups are kept').toEqual(backupsBefore);

  // Reinstall: the same data is there.
  runInstaller();
  expect(existsSync(APP_EXE)).toBe(true);
  expect(existsSync(desktopLink())).toBe(true);
  expect(existsSync(startLink())).toBe(true);
  expect(await userData()).toEqual(before);
});
