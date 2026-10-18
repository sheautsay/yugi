// Captures screenshots of the INSTALLED app's main pages (real WebView2 rendering) at several window sizes.
// Usage: npx tsx e2e-desktop/capture.mts <out dir>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { goto, launchApp } from './app.ts';

const outDir = process.argv[2] ?? 'docs/ui/screenshots/before';
mkdirSync(outDir, { recursive: true });
const sizes = [
  { name: '1280x720', width: 1280, height: 720, scale: 1 },
  { name: '1366x768', width: 1366, height: 768, scale: 1 },
  { name: '1920x1080', width: 1920, height: 1080, scale: 1 },
  { name: '1280x720@150', width: 1280, height: 720, scale: 1.5 },
];
const app = await launchApp();
const { page } = app;
const cdp = await page.context().newCDPSession(page);
async function shot(label: string) {
  for (const s of sizes) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: s.width, height: s.height, deviceScaleFactor: s.scale, mobile: false });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, `${label}_${s.name}.png`) });
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');
}
try {
  await goto(page, '/home');
  await page.waitForTimeout(800);
  await shot('00-home');
  await goto(page, '/decks');
  await page.locator('.deck-row, .deck-card').first().waitFor();
  await shot('01-decks');
  const deck = page.locator('.deck-row, .deck-card', { hasText: '合法牌組' }).first();
  await deck.getByRole('link', { name: '編輯' }).click();
  await page.waitForTimeout(1200);
  await shot('02-deck-edit');
  await goto(page, '/decks');
  await page.locator('.deck-row, .deck-card', { hasText: '合法牌組' }).first().getByRole('link', { name: '起手查詢' }).click();
  await page.waitForTimeout(1200);
  await shot('03-hand');
  await goto(page, '/decks');
  await page.locator('.deck-row, .deck-card', { hasText: '合法牌組' }).first().getByRole('link', { name: 'AI 展開分析' }).click();
  await page.waitForTimeout(1500);
  await shot('04-analysis');
  await goto(page, '/combos');
  await page.waitForTimeout(800);
  await shot('05-combos');
  await page.locator('.combo-row, .combo-card').first().getByRole('link').first().click();
  await page.waitForTimeout(1000);
  await shot('06-combo-flow');
  await page.getByRole('button', { name: '逐步教學' }).click();
  await page.waitForTimeout(600);
  await shot('07-combo-steps');
  await goto(page, '/settings');
  await page.waitForTimeout(800);
  await shot('08-settings');
} finally {
  await app.close();
}
console.log(`screenshots in ${outDir}`);
