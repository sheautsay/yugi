import { Page, expect, test } from '@playwright/test';
import { BANQUET_API_CARDS, banquetDeck } from '../src/testing/ftk/banquet-deck.sample';
import { oneDrawPlan } from '../src/testing/ftk/banquet-plans.sample';
import { mockCardSource, openAddDeck, toYdke } from './fixtures';

// B7: the Banquet FTK reference deck in the battle mode. The plan is HAND-WRITTEN test data (see banquet-plans.sample.ts):
// Chicken Game draws 1 card; the one Contract with Don Thousand in the deck takes the 1000 Life Points this test asks for.

const deck = banquetDeck();

async function setup(page: Page, name: string) {
  await mockCardSource(page, { extraCards: BANQUET_API_CARDS.map((c) => ({ ...c, frameType: c.frameType ?? '', misc_info: [{ formats: ['Master Duel', 'TCG'] }] })) });
  await page.goto('/settings');
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText(/已同步 \d+ 張卡片/)).toBeVisible();

  await page.goto('/decks');
  await openAddDeck(page);
  const rows = (cards: typeof deck.main) => cards.map((c): [number, number] => [c.cardId, c.count]);
  await page.getByLabel('牌組代碼或 YDK 內容').fill(toYdke({ main: rows(deck.main), extra: rows(deck.extra), side: [] }));
  await page.getByRole('button', { name: '解析', exact: true }).click();
  await expect(page.getByText('牌表檢核通過，匯入後可用於起手查詢。')).toBeVisible();
  await page.getByLabel('新牌組名稱').fill(name);
  await page.getByRole('button', { name: '確認匯入' }).click();

  // Mark it as an FTK deck.
  await page.locator('.deck-row', { hasText: name }).getByRole('link', { name: '編輯' }).click();
  await page.getByLabel('這是先攻 FTK 牌組').check();
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByText(/已儲存（版本 2）/)).toBeVisible();

  // The plan comes in as a Combo (version 2: a random step and branches), through the normal import check.
  await page.goto('/combos');
  await page.getByLabel('JSON 內容或分享碼').fill(JSON.stringify({ format: 'ygo-combo-assistant/combos', combos: [oneDrawPlan()] }));
  await page.getByRole('button', { name: '檢查' }).click();
  await expect(page.getByText('預覽（尚未寫入）：1 條')).toBeVisible();
  await page.getByRole('button', { name: '確認匯入' }).click();
  await expect(page.locator('.combo-row')).toHaveCount(1);
  // The Combo page shows it as a tree.
  await page.locator('.combo-row').getByRole('link', { name: '查看' }).click();
  await expect(page.getByRole('heading', { name: '先攻 FTK 計畫' })).toBeVisible();
  await expect(page.getByText('抽到 「Contract with Don Thousand」')).toBeVisible();

  await page.goto('/settings');
  await page.getByLabel('啟用實戰模式（實驗性）').check();
}

const add = (page: Page, name: RegExp) => page.getByRole('button', { name }).first().click();

test('B7: plans are ranked by their chance, and the real draw updates the chance and picks the branch', async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page, 'Banquet FTK 實戰');
  await page.setViewportSize({ width: 420, height: 900 });
  await page.goto('/battle');
  await expect(page.getByText('目標：F 先攻 FTK')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: '先後攻' })).toHaveCount(0); // an FTK always goes first

  for (const card of [/Chicken Game/, /Dark World Dealings/, /Banquet of Millions/, /D\.D\. Dynamite/, /Evenly Matched/]) await add(page, new RegExp(`^加入 .*${card.source}`));
  const item = page.locator('.rank-item').first();
  await expect(item).toContainText('Chicken Game → Contract');
  await expect(item).toContainText('成功率：2.9%'); // 1 Contract among the 35 cards left
  await expect(item).toContainText('1 / 2 條路徑可以打到 0');
  await expect(page.locator('.results')).toContainText('假設無干擾');

  await item.getByRole('button').click();
  await expect(page.getByText('目前成功率：2.9%')).toBeVisible();
  await expect(page.getByText('對手 LP 1000・自己 LP 8000')).toBeVisible();
  await page.keyboard.press('Space'); // to the draw step
  await expect(page.getByRole('region', { name: '輸入抽到的卡' })).toBeVisible();
  await expect(page.getByText(/抽到 「Contract with Don Thousand」：出現機率 2.9%・之後成功率 100.0%/)).toBeVisible();
  await expect(page.getByText(/否則（都沒有）：出現機率 97.1%・之後成功率 0.0%/)).toBeVisible();

  // Another card turns up: the chance drops to 0 and the plan says it is the "otherwise" branch.
  await page.getByRole('button', { name: /^抽到 .*Trap Trick/ }).first().click();
  await expect(page.getByText('建議走的分支：否則（都沒有）')).toBeVisible();
  await page.getByRole('button', { name: '確認，走對應的分支' }).click();
  await expect(page.getByText('目前成功率：0.0%')).toBeVisible();

  // Go back and type the Contract instead: the branch with the kill, and the Life Points reach 0.
  await page.getByRole('button', { name: '重新輸入抽到的卡' }).click();
  await page.getByRole('button', { name: /^抽到 .*Contract with Don Thousand/ }).first().click();
  await expect(page.getByText(/建議走的分支：抽到 「Contract with Don Thousand」/)).toBeVisible();
  await page.getByRole('button', { name: '確認，走對應的分支' }).click();
  await expect(page.getByText('目前成功率：100.0%')).toBeVisible();
  await expect(page.getByText('對手 LP 0・自己 LP 6000')).toBeVisible();
  await expect(page.getByText('打到 0', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
