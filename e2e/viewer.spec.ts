import { expect, test } from '@playwright/test';
import { MALISS, importTestDeck, mockCardSource, seedCombos, testComboRoute } from './fixtures';

// Card source MOCKED; the route is test data (verified against the test deck for this UI test only).

test.beforeEach(async ({ page }) => {
  await mockCardSource(page);
  await importTestDeck(page, '檢視測試牌組');
  await seedCombos(page, [testComboRoute({ id: 'view-route', name: '檢視測試路線', status: 'verified', steps: 12 })]);
});

test('G7: from a hand query into the route; A/B share the step; back returns to the same hand', async ({ page }) => {
  await page.locator('.deck-row', { hasText: '檢視測試牌組' }).getByRole('link', { name: '起手查詢' }).click();
  for (const name of ['Maliss <P> Dormouse', 'Test Filler 90000001', 'Test Filler 90000002', 'Test Filler 90000003', 'Test Filler 90000004']) {
    await page.getByRole('button', { name: new RegExp(`^加入 ${name.replace(/[<>]/g, '.')}（剩`) }).click();
  }
  await expect(page.locator('[data-kind="available"]', { hasText: '檢視測試路線' })).toBeVisible();
  await page.locator('[data-kind="available"]', { hasText: '檢視測試路線' }).getByRole('link', { name: '查看完整展開' }).click();

  await expect(page.getByRole('heading', { level: 1, name: '檢視測試路線' })).toBeVisible();
  await page.getByRole('button', { name: '第 7 步：測試步驟 7' }).click();
  await page.getByRole('button', { name: '逐步教學' }).click();
  await expect(page.getByText('第 7 / 12 步')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('第 9 / 12 步')).toBeVisible();
  await page.getByRole('button', { name: '圖像流程' }).click();
  await expect(page.locator('.node.current')).toHaveAttribute('data-order', '9');

  await page.getByRole('button', { name: '逐步教學' }).click();
  await page.getByRole('button', { name: '跳至終場' }).click();
  await expect(page.getByText('第 12 / 12 步')).toBeVisible();
  await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('第 12 / 12 步')).toBeVisible();
  await expect(page.getByRole('heading', { name: '預計終場' })).toBeFocused();

  await page.getByRole('link', { name: '← 返回起手查詢' }).click();
  await expect(page.getByRole('heading', { name: '起手（5 / 5 張）' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: '檢視測試路線' })).toBeVisible();
});

test('N7: with the card source unreachable a cached route still opens; missing card data is labelled', async ({ page }) => {
  await seedCombos(page, [{ ...testComboRoute({ id: 'unknown-card-route', name: '含未下載卡片的路線' }), endBoard: [{ cardId: 55555555, zone: 'EMZ', count: 1 }] }]);
  await page.unrouteAll();
  const external: string[] = [];
  await page.route(/db\.ygoprodeck\.com|\/ygo-images\//, (route) => {
    external.push(route.request().url());
    return route.abort('internetdisconnected');
  });

  await page.goto('/combos/view-route');
  await expect(page.getByRole('heading', { level: 1, name: '檢視測試路線' })).toBeVisible();
  await page.getByRole('button', { name: '逐步教學' }).click();
  await expect(page.getByText('第 1 / 12 步')).toBeVisible();
  await expect(page.getByText('Maliss <P> Dormouse').first()).toBeVisible();

  await page.goto('/combos/unknown-card-route');
  await expect(page.getByText('有 1 張卡沒有卡片資料，以 ID 顯示（未識別）')).toBeVisible();
  await expect(page.getByLabel('未識別（ID 55555555）').first()).toBeVisible();
  expect(external).toEqual([]);
});

test('source links open in a new tab only for whitelisted https URLs', async ({ page }) => {
  await page.goto('/combos/view-route');
  await page.getByText('來源與驗證資訊').click();
  const link = page.getByRole('link', { name: '開啟來源（新分頁）' });
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=test&t=30');
  expect(MALISS.redRansom).toBeGreaterThan(0);
});
