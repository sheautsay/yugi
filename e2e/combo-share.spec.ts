import { expect, test } from '@playwright/test';
import { dumpUserData, importTestDeck, mockCardSource, testComboRoute } from './fixtures';

// B6: a Combo as a share code. Routes are test data (see fixtures.ts), not real verified combos.

test.beforeEach(async ({ page }) => {
  await mockCardSource(page);
  await importTestDeck(page, '分享測試牌組'); // also caches the card data the routes reference
});

test('B6: a share code carries a Combo to another profile through the normal import check, as unverified', async ({ page }) => {
  await page.goto('/combos');
  await page.getByLabel('JSON 內容').fill(JSON.stringify({ format: 'ygo-combo-assistant/combos', combos: [testComboRoute({ id: 'share-me', name: '要分享的路線', status: 'verified' })] }));
  await page.getByRole('button', { name: '檢查' }).click();
  await page.getByRole('button', { name: '確認匯入' }).click();
  const row = page.locator('.combo-row', { hasText: '要分享的路線' });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: '分享碼' }).click();
  const code = await page.getByRole('textbox', { name: /分享碼（貼到聊天軟體/ }).inputValue();
  expect(code).toMatch(/^YGOCOMBO1\.[A-Za-z0-9_-]+\.[a-z0-9]{6}$/);

  // The same Combo is deleted, then comes back from the code: previewed first, nothing written until confirmed.
  page.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: '刪除' }).click();
  await expect(page.locator('.combo-row')).toHaveCount(0);
  await page.getByLabel('JSON 內容或分享碼').fill(`  ${code}  \n`);
  await page.getByRole('button', { name: '檢查' }).click();
  await expect(page.getByText('預覽（尚未寫入）：1 條')).toBeVisible();
  expect((await dumpUserData(page)).combos).toEqual([]);
  await page.getByRole('button', { name: '確認匯入' }).click();
  await expect(page.locator('.combo-row', { hasText: '要分享的路線' }).getByText('未驗證', { exact: true })).toBeVisible();
});

test('B6: a broken code is refused with the reason and nothing is written', async ({ page }) => {
  await page.goto('/combos');
  await page.getByLabel('JSON 內容或分享碼').fill('YGOCOMBO1.eJzLSM3JyQcABiwCFQ.aaaaaa');
  await page.getByRole('button', { name: '檢查' }).click();
  await expect(page.getByText('檢查碼不符')).toBeVisible();
  expect((await dumpUserData(page)).combos).toEqual([]);
});
