import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { MALISS_DECK_API_CARDS } from '../src/testing/ai/maliss-deck-cards.sample';
import { routeAllied, routeFirewall, routeMalissOnly, sampleAnswer } from '../src/testing/ai/maliss-routes.sample';
import { anthropicSse } from '../src/testing/ai/mock-ai.sample';
import { EDGE_SAMPLE } from '../src/testing/neuron-deck.sample';
import { mockCardSource, openAddDeck } from './fixtures';

// B2: "全部存成 Combo". The AI answer is MOCKED from hand-written routes (not model output).

const KEY = 'sk-ant-e2e-mock-key-not-real';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };

async function mockAi(context: BrowserContext, answer: () => Record<string, unknown>) {
  const handle = async (route: Route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 200, body: anthropicSse(JSON.stringify(answer())), headers: { ...CORS, 'content-type': 'text/event-stream' } });
  };
  for (const host of ['https://api.anthropic.com/**', 'http://localhost:11434/**']) await context.route(host, handle);
}

async function importRealDeck(page: Page, name: string) {
  await mockCardSource(page, { extraCards: MALISS_DECK_API_CARDS.map((c) => ({ ...c, frameType: c.frameType ?? '' })) });
  await page.goto('/settings');
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText(/已同步 \d+ 張卡片/)).toBeVisible();
  await page.goto('/decks');
  await openAddDeck(page);
  await page.getByLabel('牌組代碼或 YDK 內容').fill(EDGE_SAMPLE);
  await page.getByRole('button', { name: '解析', exact: true }).click();
  await page.getByLabel('新牌組名稱').fill(name);
  await page.getByRole('button', { name: '確認匯入' }).click();
  await page.locator('.deck-row', { hasText: name }).getByRole('link', { name: 'AI 展開分析' }).click();
  await expect(page.getByRole('heading', { name: `AI 展開分析：${name}` })).toBeVisible();
}

test('B2: save all asks with the numbers, saves the new routes once and never duplicates on a second press', async ({ page, context }) => {
  await mockAi(context, () => sampleAnswer([routeAllied(), routeFirewall(), routeMalissOnly(), routeAllied()]));
  await importRealDeck(page, '全部存檔');
  await page.getByLabel('Claude API Key').fill(KEY);
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText('分析完成：4 條候選路線。')).toBeVisible();

  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.accept();
  });
  await page.getByRole('button', { name: '全部存成 Combo' }).click();
  await expect(page.getByText(/已存成 3 條固定 Combo/)).toBeVisible();
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0]).toContain('3 條');
  expect(dialogs[0]).toContain('終場相同 1 條');

  await page.getByRole('button', { name: '全部存成 Combo' }).click();
  await expect(page.getByText(/沒有可以存的新路線。略過：已存過 3 條/)).toBeVisible();
  expect(dialogs).toHaveLength(1); // nothing new: no confirmation, nothing written

  await page.goto('/combos');
  await expect(page.locator('.combo-row')).toHaveCount(3);
  await expect(page.locator('.combo-row .badge', { hasText: '未驗證' })).toHaveCount(3);
});
