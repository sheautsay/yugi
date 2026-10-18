import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { MALISS_DECK_API_CARDS } from '../src/app/core/ai/maliss-deck-cards.sample';
import { routeAllied, routeFirewall, routeMalissOnly, sampleAnswer } from '../src/app/core/ai/maliss-routes.sample';
import { anthropicSse } from '../src/app/core/ai/mock-ai.sample';
import { EDGE_SAMPLE } from '../src/app/core/neuron-deck.sample';
import { mockCardSource, openAddDeck } from './fixtures';

// CR-007 G41 / G42 with the user's real deck list. Every AI answer is MOCKED and built from
// HAND-WRITTEN routes (not model output). All AI hosts are intercepted; no real AI service is contacted.

const KEY = 'sk-ant-e2e-mock-key-not-real';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };

async function mockAi(context: BrowserContext, answer: () => Record<string, unknown>) {
  const calls: string[] = [];
  const handle = async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    calls.push(req.url());
    return route.fulfill({ status: 200, body: anthropicSse(JSON.stringify(answer())), headers: { ...CORS, 'content-type': 'text/event-stream' } });
  };
  for (const host of ['https://api.anthropic.com/**', 'http://localhost:11434/**', 'https://api.openai.com/**', 'https://auth.openai.com/**']) await context.route(host, handle);
  return calls;
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
  await expect(page.getByText('牌表檢核通過，匯入後可用於起手查詢。')).toBeVisible();
  await page.getByLabel('新牌組名稱').fill(name);
  await page.getByRole('button', { name: '確認匯入' }).click();
  await page.locator('.deck-row', { hasText: name }).getByRole('link', { name: 'AI 展開分析' }).click();
  await expect(page.getByRole('heading', { name: `AI 展開分析：${name}` })).toBeVisible();
}

test('G41 / G42: a single-card start shows confirmed + untracked cards; interruptions are static estimates with 0 verified', async ({ page, context }) => {
  const calls = await mockAi(context, () => sampleAnswer([routeAllied(), routeFirewall(), routeMalissOnly()]));
  await importRealDeck(page, '瑪麗絲（rev7）');
  await page.getByLabel('Claude API Key').fill(KEY);
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText('分析完成：3 條候選路線。')).toBeVisible();
  expect(calls).toHaveLength(1);

  // The list item: static estimate, verified 0, hand split into confirmed and untracked.
  const item = page.getByRole('list', { name: '候選路線' }).getByRole('listitem').filter({ hasText: 'Dormouse → Allied Code Talker＋White Binder' });
  await expect(item).toContainText('有效干擾（靜態估算）1');
  await expect(item).toContainText('已驗證 0');
  await expect(item).toContainText('剩餘手牌：已確認 0 張＋未追蹤 4 張');

  // The comparison table has the same split and a separate "verified" column.
  const table = page.getByRole('table', { name: '候選比較' });
  await expect(table.getByRole('columnheader', { name: '有效干擾（靜態估算）' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: '已驗證干擾' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: '剩餘手牌（已確認＋未追蹤）' })).toBeVisible();
  await expect(table.getByRole('row').nth(1)).toContainText('已確認 0 張＋未追蹤 4 張');

  // N32: no place may show a bare "remaining hand 0".
  await expect(page.locator('body')).not.toContainText(/剩餘手牌[：:\s]+0(?![\d～])\s*(?:張|$)/);

  // The panel: same wording, every interruption tagged as a static estimate.
  await item.getByRole('button', { name: '查看完整展開' }).click();
  const evaluation = page.getByRole('region', { name: '終場評估' });
  await expect(evaluation).toContainText('靜態估算 1 項；已驗證 0 項');
  await expect(evaluation).toContainText('已確認 0 張＋未追蹤 4 張');
  await expect(evaluation).toContainText('有效（靜態估算）');
  await expect(evaluation).toContainText('不是規則引擎或實際操作的驗證');
  await expect(page.getByText('目前層級：資料完整性通過')).toBeVisible();
});
