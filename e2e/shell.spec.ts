import { expect, test } from '@playwright/test';

test('root redirects to the zh-TW deck list', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/decks$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-TW');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('牌組');
  await expect(page.getByRole('navigation', { name: '主要導覽' })).toContainText('Combo 管理');
});

test('a deck saved to IndexedDB survives a page reload', async ({ page }) => {
  await page.goto('/decks');
  await page.getByLabel('牌組名稱', { exact: true }).fill('E2E 測試牌組');
  await page.getByRole('button', { name: '建立', exact: true }).click();
  await expect(page.getByText('E2E 測試牌組', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('E2E 測試牌組', { exact: true })).toBeVisible();
});
