import { expect, test } from '@playwright/test';
import { importTestDeck, MALISS, mockCardSource, openAddDeck, setAutoThumbnails, TEST_DECK, toYdk, toYdke } from './fixtures';

// Card source is MOCKED here (see fixtures.ts); these tests prove UI behaviour only.

test('G3: ydke import shows a draft preview, resolves cards on request, writes only on confirm', async ({ page }) => {
  const { apiCalls } = await mockCardSource(page);
  await page.goto('/decks');
  await openAddDeck(page);
  await page.getByLabel('牌組代碼或 YDK 內容').fill(`\n  ${toYdke(TEST_DECK)}  \n`);
  await page.getByRole('button', { name: '解析', exact: true }).click();

  await expect(page.getByText('預覽（尚未寫入）— 格式：ydke://')).toBeVisible();
  await expect(page.getByText(/主牌 40 張／額外 15 張／備牌 0 張/)).toBeVisible();
  await expect(page.getByText('匯入後會是草稿')).toBeVisible();
  expect(apiCalls).toEqual([]); // nothing is downloaded without an explicit click

  await page.getByRole('button', { name: '從 YGOPRODeck 下載缺少的卡片資料' }).click();
  await expect(page.getByText('牌表檢核通過，匯入後可用於起手查詢。')).toBeVisible();
  expect(apiCalls).toHaveLength(1);
  await expect(page.getByText('我的牌組').locator('..').getByText('尚未建立任何牌組')).toBeVisible();

  await page.getByLabel('新牌組名稱').fill('碼莉絲測試');
  await page.getByRole('button', { name: '確認匯入' }).click();
  const row = page.locator('.deck-row', { hasText: '碼莉絲測試' });
  await expect(row.getByText('可查詢')).toBeVisible();
  await expect(row.getByText('主牌 40／額外 15／備牌 0')).toBeVisible();
});

test('G1/G3: .ydk file upload with BOM + CRLF keeps zones and counts; cancel writes nothing', async ({ page }) => {
  await mockCardSource(page);
  await page.goto('/decks');
  const deck = { ...TEST_DECK, side: [[MALISS.mtp07, 2]] as Array<[number, number]> };
  await page.locator('input[type=file]').setInputFiles({ name: 'maliss.ydk', mimeType: 'text/plain', buffer: Buffer.from('﻿' + toYdk(deck), 'utf8') });

  await expect(page.getByText('預覽（尚未寫入）— 格式：YDK')).toBeVisible();
  await expect(page.getByText(/主牌 40 張／額外 15 張／備牌 2 張/)).toBeVisible();
  await expect(page.getByLabel('新牌組名稱')).toHaveValue('maliss');
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.getByText('預覽（尚未寫入）')).toHaveCount(0);
  await expect(page.getByText('尚未建立任何牌組')).toBeVisible();
});

test('N1: invalid YDK lines are reported with line numbers and never import', async ({ page }) => {
  await page.goto('/decks');
  await openAddDeck(page);
  await page.getByLabel('牌組代碼或 YDK 內容').fill('#main\n32061192\nnot-a-card\n-1\n#extar\n');
  await page.getByRole('button', { name: '解析', exact: true }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('第 3 行「not-a-card」');
  await expect(alert).toContainText('第 4 行「-1」');
  await expect(alert).toContainText('第 5 行「#extar」');
  await expect(page.getByRole('button', { name: '確認匯入' })).toHaveCount(0);
});

test('N11: an unsupported in-game style code is not guessed', async ({ page }) => {
  await page.goto('/decks');
  await openAddDeck(page);
  await page.getByLabel('牌組代碼或 YDK 內容').fill('MDXK-7F3Q-9ZPA');
  await page.getByRole('button', { name: '解析', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('遊戲內牌組代碼無法直接解碼'); // CR-003
});

test('deck edit: count changes save a new version; images download on request and work offline', async ({ page }) => {
  const { imageCalls } = await mockCardSource(page);
  await setAutoThumbnails(page, false); // CR-002: this test covers the explicit download path
  await importTestDeck(page, '編輯測試');
  await page.locator('.deck-row', { hasText: '編輯測試' }).getByRole('link', { name: '編輯' }).click();
  await expect(page.getByRole('heading', { name: '編輯牌組' })).toBeVisible();

  await page.getByRole('button', { name: `減少一張 ${MALISS.dormouse}` }).click();
  await expect(page.getByText('有未儲存的變更')).toBeVisible();
  await expect(page.getByText('主牌 39 張（需 40–60 張）')).toBeVisible();
  await page.getByRole('button', { name: `增加一張 ${MALISS.dormouse}` }).click();
  await expect(page.getByText('有未儲存的變更')).toHaveCount(0); // back to the saved list
  await expect(page.getByRole('button', { name: '儲存' })).toBeDisabled();

  await page.getByRole('button', { name: `減少一張 ${MALISS.dormouse}` }).click();
  await page.getByRole('button', { name: `增加一張 ${MALISS.chessyCat}` }).click();
  await expect(page.getByText('牌表檢核通過，可用於起手查詢。')).toBeVisible();
  await page.getByRole('button', { name: '儲存' }).click();
  await expect(page.getByRole('status')).toContainText('已儲存（版本 2）');

  expect(imageCalls).toEqual([]);
  await page.getByRole('button', { name: '下載此牌組卡圖' }).click();
  await expect(page.getByRole('status')).toContainText('正在下載 33 張卡圖');
  // 33 images at the ≥250 ms throttle need ~8 s.
  await expect(page.getByRole('status')).toContainText('已下載 33 張卡圖', { timeout: 30_000 });
  await expect(page.locator('app-card-tile img').first()).toBeVisible();

  // Internet down, local server still up: every external card-source request fails.
  await page.unrouteAll();
  const blocked: string[] = [];
  await page.route(/db\.ygoprodeck\.com|\/ygo-images\//, (route) => {
    blocked.push(route.request().url());
    return route.abort('internetdisconnected');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '編輯牌組' })).toBeVisible();
  await expect(page.locator('app-card-tile img').first()).toBeVisible();
  await expect(page.getByText('Maliss <P> Dormouse').first()).toBeVisible();
  expect(blocked).toEqual([]); // everything shown came from the local cache
});
