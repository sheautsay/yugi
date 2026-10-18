import { expect, test } from '@playwright/test';
import { mockCardSource } from './fixtures';

// P1: first-run flow — card data download from the home page, ordered quick-start steps, sample data.

test('P1.1/P1.4: a new profile starts on the home page and downloads card data with one click', async ({ page }) => {
  await mockCardSource(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/home$/);
  const steps = page.locator('.quick-steps li');
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).not.toHaveClass(/done/);

  await steps.nth(0).getByRole('button', { name: '下載卡片資料' }).click();
  await expect(steps.nth(0)).toHaveClass(/done/, { timeout: 15_000 });
  await expect(steps.nth(0)).toContainText('已完成（本機有 97 張）');
  await expect(steps.nth(1)).not.toHaveClass(/done/);
});

test('P1.1: the deck list offers the same download block while there is no card data', async ({ page }) => {
  await mockCardSource(page);
  await page.goto('/decks');
  const block = page.locator('app-card-data-prompt');
  await expect(block.getByRole('button', { name: '下載卡片資料' })).toBeVisible();
  await block.getByRole('button', { name: '下載卡片資料' }).click();
  await expect(block).toHaveCount(1);
  await expect(page.locator('app-card-data-prompt button')).toHaveCount(0, { timeout: 15_000 });
});

test('P1.3: the sample loads from the empty Combo page as unverified routes and a usable deck', async ({ page }) => {
  await mockCardSource(page);
  await page.goto('/combos');
  await expect(page.getByText('尚未收錄任何 Combo')).toBeVisible();
  await page.getByRole('button', { name: '載入範例（Maliss）' }).click();
  await expect(page.getByText(/已載入範例牌組與 3 條範例 Combo/)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.combo-row')).toHaveCount(3);
  await expect(page.locator('.combo-row .badge', { hasText: '未驗證' })).toHaveCount(3);

  await page.goto('/decks');
  await expect(page.locator('.deck-row', { hasText: '範例：Maliss' })).toBeVisible();
});
