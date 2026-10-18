import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { MALISS_DECK_API_CARDS } from '../src/testing/ai/maliss-deck-cards.sample';
import { routeAllied, routeFirewall, routeMalissOnly, sampleAnswer } from '../src/testing/ai/maliss-routes.sample';
import { anthropicSse } from '../src/testing/ai/mock-ai.sample';
import { EDGE_SAMPLE } from '../src/testing/neuron-deck.sample';
import { mockCardSource, openAddDeck } from './fixtures';

// B3: the battle mode page. Routes come from a MOCKED AI answer built from hand-written routes, saved with "全部存成 Combo".

const KEY = 'sk-ant-e2e-mock-key-not-real';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };

async function mockAi(context: BrowserContext, answer: () => Record<string, unknown>) {
  const handle = async (route: Route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 200, body: anthropicSse(JSON.stringify(answer())), headers: { ...CORS, 'content-type': 'text/event-stream' } });
  };
  for (const host of ['https://api.anthropic.com/**', 'http://localhost:11434/**']) await context.route(host, handle);
}

async function deckWithSavedRoutes(page: Page, context: BrowserContext, name: string) {
  await mockAi(context, () => sampleAnswer([routeAllied(), routeFirewall(), routeMalissOnly(), routeAllied()]));
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
  await page.getByLabel('Claude API Key').fill(KEY);
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText('分析完成：4 條候選路線。')).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: '全部存成 Combo' }).click();
  await expect(page.getByText(/已存成 3 條固定 Combo/)).toBeVisible();
}

const add = (page: Page, text: RegExp) => page.getByRole('button', { name: text }).first().click();
const HAND = [/Dormouse/, /Maxx/, /Ash Blossom/, /Ghost Belle/, /Fuwalos/];

test('B3: off by default; once enabled it ranks the saved routes for the hand and walks one step by step at 420px', async ({ page, context }) => {
  test.setTimeout(120_000);
  await deckWithSavedRoutes(page, context, '實戰牌組');

  // Off by default: no navigation entry, and the page explains how to switch it on.
  await page.goto('/battle');
  await expect(page.getByRole('heading', { name: '實戰模式尚未啟用' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '主要導覽' })).not.toContainText('實戰模式');
  await page.getByRole('link', { name: '前往設定' }).click();
  await page.getByLabel('啟用實戰模式（實驗性）').check();
  await expect(page.getByRole('navigation', { name: '主要導覽' })).toContainText('實戰模式');

  await page.setViewportSize({ width: 420, height: 900 });
  await page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: '實戰模式' }).click();
  await expect(page.getByRole('heading', { name: '實戰模式', exact: true })).toBeVisible();
  await expect(page.getByText('選滿 5 張手牌後顯示結果。')).toBeVisible();

  for (const card of HAND.slice(0, 4)) await add(page, new RegExp(`^加入 .*${card.source}`));
  // The fifth card: measure from the click to the results being on screen (target < 300 ms).
  const ms = await page.evaluate(
    (label) =>
      new Promise<number>((resolve) => {
        const t0 = performance.now();
        const done = () => document.querySelector('.rank-item, .results .notice.warn') && (obs.disconnect(), resolve(performance.now() - t0));
        const obs = new MutationObserver(done);
        obs.observe(document.body, { childList: true, subtree: true });
        (document.querySelector(`button[aria-label^="加入 "][aria-label*="${label}"]`) as HTMLButtonElement).click();
      }),
    'Fuwalos',
  );
  expect(ms).toBeLessThan(300);

  const items = page.locator('.rank-item');
  await expect(items.first()).toBeVisible();
  expect(await items.count()).toBeLessThanOrEqual(5);
  await expect(items.first()).toContainText('AI 候選');
  await expect(items.first()).toContainText('有效干擾');
  await expect(items).toHaveCount(3); // the three distinct end boards that were saved
  // 420 px: nothing scrolls sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  // One route: the final board stays above the steps; the space bar and the arrows move the highlighted step.
  await items.first().getByRole('button').click();
  await expect(page.getByRole('region', { name: '最終終場' })).toBeVisible();
  await expect(page.locator('.steps-list li.current')).toContainText('1');
  await page.keyboard.press('Space');
  await expect(page.getByText(/第 2 \/ \d+ 步/)).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText(/第 3 \/ \d+ 步/)).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText(/第 2 \/ \d+ 步/)).toBeVisible();
  await page.locator('.steps-list li').nth(0).getByRole('button').click();
  await expect(page.getByText(/第 1 \/ \d+ 步/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.getByRole('button', { name: '返回名次' }).click();
  await expect(items.first()).toBeVisible();
});

test('B3: a hand without any collected route says so and points to the AI analysis', async ({ page, context }) => {
  test.setTimeout(120_000);
  await deckWithSavedRoutes(page, context, '無展開');
  await page.goto('/settings');
  await page.getByLabel('啟用實戰模式（實驗性）').check();
  await page.goto('/battle');
  for (const card of [/Maxx/, /Ash Blossom/, /Ghost Belle/, /Fuwalos/, /Backup/]) await add(page, new RegExp(`^加入 .*${card.source}`));
  await expect(page.getByText('這手牌沒有已收錄的展開。')).toBeVisible();
  await expect(page.getByRole('link', { name: '前往 AI 展開分析' })).toBeVisible();
});
