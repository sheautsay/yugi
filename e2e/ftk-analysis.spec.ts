import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { BANQUET_API_CARDS, banquetDeck } from '../src/testing/ftk/banquet-deck.sample';
import { banquetAnswer } from '../src/testing/ftk/banquet-plans.sample';
import { anthropicSse } from '../src/testing/ai/mock-ai.sample';
import { mockCardSource, openAddDeck, toYdke } from './fixtures';

// B7: the AI analysis of an FTK deck. The AI answer is MOCKED and hand-written (not model output): it claims a branch wins
// that really takes only 1000 of the 8000 Life Points, and the program does the counting.

const KEY = 'sk-ant-e2e-mock-key-not-real';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
const deck = banquetDeck();

async function mockAi(context: BrowserContext, answer: () => Record<string, unknown>) {
  const requests: string[] = [];
  const handle = async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    requests.push(req.postData() ?? '');
    return route.fulfill({ status: 200, body: anthropicSse(JSON.stringify(answer())), headers: { ...CORS, 'content-type': 'text/event-stream' } });
  };
  for (const host of ['https://api.anthropic.com/**', 'http://localhost:11434/**']) await context.route(host, handle);
  return requests;
}

async function ftkDeck(page: Page, name: string) {
  await mockCardSource(page, { extraCards: BANQUET_API_CARDS.map((c) => ({ ...c, frameType: c.frameType ?? '', misc_info: [{ formats: ['Master Duel', 'TCG'] }] })) });
  await page.goto('/settings');
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText(/已同步 \d+ 張卡片/)).toBeVisible();
  await page.goto('/decks');
  await openAddDeck(page);
  const rows = (cards: typeof deck.main) => cards.map((c): [number, number] => [c.cardId, c.count]);
  await page.getByLabel('牌組代碼或 YDK 內容').fill(toYdke({ main: rows(deck.main), extra: rows(deck.extra), side: [] }));
  await page.getByRole('button', { name: '解析', exact: true }).click();
  await page.getByLabel('新牌組名稱').fill(name);
  await page.getByRole('button', { name: '確認匯入' }).click();
  await page.locator('.deck-row', { hasText: name }).getByRole('link', { name: '編輯' }).click();
  await page.getByLabel('這是先攻 FTK 牌組').check();
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByText(/已儲存（版本 2）/)).toBeVisible();
  await page.goto('/decks');
  await page.locator('.deck-row', { hasText: name }).getByRole('link', { name: 'AI 展開分析' }).click();
  await expect(page.getByRole('heading', { name: `AI 展開分析：${name}` })).toBeVisible();
}

test('B7: an FTK deck is analysed with its own instructions; the damage and the chance are the program\'s, and the plan\'s claim is refused', async ({ page, context }) => {
  test.setTimeout(120_000);
  const requests = await mockAi(context, () => banquetAnswer());
  await ftkDeck(page, 'FTK 分析');

  // The ordinary scope / phased-mode settings do not apply and the page says why.
  await expect(page.getByText('FTK 牌組：分析目標固定為 F（先攻 FTK）')).toBeVisible();
  await expect(page.getByRole('group', { name: /分析範圍/ })).toHaveCount(0);
  await page.getByLabel('Claude API Key').fill(KEY);
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByRole('heading', { name: /先攻 FTK 計畫（1）/ })).toBeVisible();

  // One request, with the FTK instructions (not the ordinary combo ones).
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain('FIRST-TURN-KILL');
  expect(requests[0]).toContain('NEVER list the cards that turn up as moves');
  expect(requests[0]).not.toContain('single-card starters');

  const plan = page.getByRole('list', { name: 'FTK 計畫' }).getByRole('listitem').first();
  await expect(plan).toContainText('Chicken Game → Contract');
  await expect(plan).toContainText('成功率：0.0%'); // Contract takes 1000 of 8000: no branch reaches 0
  await expect(plan).toContainText('標為成功，但依規則表計算對手 LP 還剩 7000');
  await expect(plan).toContainText('0 / 2 條路徑可以打到 0');
  await plan.getByText('抽牌後的分支').click();
  await expect(plan.getByText('抽到 「Contract with Don Thousand」')).toBeVisible();
  await expect(plan.getByText('否則（都沒有）')).toBeVisible();
  await expect(plan.getByText('對手 LP 還剩 7000', { exact: true })).toBeVisible();

  // A plan that did not pass its check cannot be saved in bulk.
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: '全部存成 Combo' }).click();
  await expect(page.getByText(/沒有可以存的新路線。略過：已存過 0 條、未通過檢查 1 條/)).toBeVisible();
});

test('B7: an answer that names the card it draws is refused with the reason', async ({ page, context }) => {
  test.setTimeout(120_000);
  await mockAi(context, () => banquetAnswer({ specifiedDraw: true }));
  await ftkDeck(page, 'FTK 指定抽牌');
  await page.getByLabel('Claude API Key').fill(KEY);
  await page.getByRole('button', { name: '開始分析' }).click();
  const plan = page.getByRole('list', { name: 'FTK 計畫' }).getByRole('listitem').first();
  await expect(plan).toContainText('不能寫出抽到的卡');
});
