import { expect, test } from '@playwright/test';
import { importTestDeck, mockCardSource } from './fixtures';

// P2: no engineering vocabulary on the main screens, and the disclaimer only shows once.

const BANNED = [/BLOCKED/, /指紋/, /Provider/, /effort/i, /npm start/, /cardId/, /translationSource/, /translationStatus/, /Continue with ChatGPT/];

test('P2: AI analysis, settings and deck pages use plain Traditional Chinese wording', async ({ page }) => {
  await mockCardSource(page);
  await importTestDeck(page, '用詞檢查');
  const urls = ['/home', '/decks', '/settings', '/combos'];
  for (const url of urls) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const text = await page.locator('main').innerText();
    for (const word of BANNED) expect(text, `${url} contains ${word}`).not.toMatch(word);
  }
  await page.goto('/decks');
  await page.locator('.deck-row', { hasText: '用詞檢查' }).getByRole('link', { name: 'AI 展開分析' }).click();
  await expect(page.getByText('AI 路線只是候選，請在遊戲中實測。')).toBeVisible();
  const text = await page.locator('main').innerText();
  for (const word of BANNED) expect(text, `analysis contains ${word}`).not.toMatch(word);
  await expect(page.getByLabel('思考程度')).toHaveCount(1);
});

test('P2: the first-run note can be dismissed and stays away afterwards', async ({ page }) => {
  await page.goto('/home');
  const note = page.locator('.app-footer');
  await expect(note).toContainText('獨立查詢工具');
  await note.getByRole('button', { name: '知道了' }).click();
  await expect(note).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.app-footer')).toHaveCount(0);
  await page.goto('/settings');
  await expect(page.getByText('獨立查詢工具：不連接遊戲')).toBeVisible();
});

test('P2: without a deck the deck-only navigation items are disabled with a tooltip, and with decks the add form opens in a dialog', async ({ page }) => {
  await mockCardSource(page);
  await page.goto('/home');
  const disabled = page.locator('nav .nav-disabled');
  await expect(disabled).toHaveCount(2);
  await expect(disabled.first()).toHaveAttribute('data-tip', '需要先建立或匯入牌組');
  await importTestDeck(page, '對話框檢查');
  await page.goto('/decks');
  await expect(page.locator('#add-deck')).toHaveCount(0);
  await page.getByRole('button', { name: '＋ 新增牌組' }).click();
  await expect(page.locator('dialog.add-dialog[open]')).toBeVisible();
  await expect(page.getByLabel('牌組代碼或 YDK 內容')).toBeVisible();
});
