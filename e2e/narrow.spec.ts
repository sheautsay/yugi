import { Page, expect, test } from '@playwright/test';
import { importTestDeck, mockCardSource, seedCombos, testComboRoute } from './fixtures';

// G10: narrow windows (360 / 390 / 420 CSS px). Automated layout checks + screenshots saved to
// test-results/g10/ for the visual review recorded in docs/validation.

const WIDTHS = [360, 390, 420];

async function noPageOverflow(page: Page) {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll, 'page must not scroll horizontally').toBeLessThanOrEqual(inner);
}

async function fullyInside(page: Page, names: string[]) {
  const width = page.viewportSize()!.width;
  for (const name of names) {
    const button = page.getByRole('button', { name, exact: true }).first();
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    expect(box.x, `${name} left edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${name} right edge`).toBeLessThanOrEqual(width);
  }
}

for (const width of WIDTHS) {
  test(`G10 @ ${width}px: deck list, hand query, both viewer modes, editor and settings`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 800 });
    await mockCardSource(page);
    await importTestDeck(page, '窄視窗牌組');
    await seedCombos(page, [testComboRoute({ id: 'narrow-route', name: '窄視窗測試路線（名稱較長以測試換行顯示是否會被裁切）', status: 'verified', steps: 8 })]);

    await page.goto('/decks');
    await noPageOverflow(page);
    await page.screenshot({ path: `test-results/g10/${width}-1-decks.png`, fullPage: true });

    await page.locator('.deck-row', { hasText: '窄視窗牌組' }).getByRole('link', { name: '起手查詢' }).click();
    await page.getByLabel('種子（選填，可重現）').fill('7');
    await page.getByRole('button', { name: '隨機抽 5 張' }).click();
    await noPageOverflow(page);
    await fullyInside(page, ['隨機抽 5 張', '清除', '復原上一手', '開啟截圖辨識']);
    await page.screenshot({ path: `test-results/g10/${width}-2-hand.png`, fullPage: true });

    await page.goto('/combos/narrow-route');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('窄視窗測試路線');
    await noPageOverflow(page);
    await fullyInside(page, ['圖像流程', '逐步教學', '垂直', '水平']);
    const node = page.locator('.node').nth(1);
    await expect(node).toContainText('測試步驟 2');
    await expect(node).toContainText('⚠ 注意');
    await page.screenshot({ path: `test-results/g10/${width}-3-flow.png`, fullPage: true });

    await page.getByRole('button', { name: '水平' }).click();
    await noPageOverflow(page); // the flow canvas scrolls inside its own box
    await page.getByRole('button', { name: '逐步教學' }).click();
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('第 2 / 8 步')).toBeVisible();
    await noPageOverflow(page);
    await fullyInside(page, ['上一步', '下一步', '跳至終場']);
    await expect(page.getByText('⚠ 注意事項：測試注意事項：此效果每回合只能使用 1 次')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/g10/${width}-4-steps.png`, fullPage: true });

    await page.goto('/combos/narrow-route/edit');
    await noPageOverflow(page);
    await fullyInside(page, ['儲存', '＋ 新增步驟']);
    await page.screenshot({ path: `test-results/g10/${width}-5-editor.png` });

    await page.goto('/settings');
    await noPageOverflow(page);
    await fullyInside(page, ['匯出完整備份（JSON）']);
    await page.screenshot({ path: `test-results/g10/${width}-6-settings.png`, fullPage: true });
  });
}
