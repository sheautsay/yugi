import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { MALISS_DECK_API_CARDS } from '../src/app/core/ai/maliss-deck-cards.sample';
import { C, routeAllied, routeAlliedTooFewMaterials, routeFirewall, routeFirewallIntoAllied, routeMalissOnly, sampleAnswer } from '../src/app/core/ai/maliss-routes.sample';
import { anthropicSse } from '../src/app/core/ai/mock-ai.sample';
import { EDGE_SAMPLE } from '../src/app/core/neuron-deck.sample';
import { mockCardSource, openAdvanced } from './fixtures';

// CR-006 (G34–G40) with the user's real deck list (their Neuron paste) and the real card data of its
// 41 cards — served by the MOCKED card source. Every AI answer is MOCKED and built from HAND-WRITTEN
// routes (not model output). All AI hosts are intercepted; no real or paid AI service is contacted.

const KEY = 'sk-ant-e2e-mock-key-not-real';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };

async function mockAi(context: BrowserContext, answer: () => Record<string, unknown>) {
  const calls: Array<{ url: string; body: string }> = [];
  const handle = async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    calls.push({ url: req.url(), body: req.postData() ?? '' });
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
  await page.getByLabel('牌組代碼或 YDK 內容').fill(EDGE_SAMPLE);
  await page.getByRole('button', { name: '解析', exact: true }).click();
  await expect(page.getByText(/主牌 40 張／額外 15 張／備牌 0 張/)).toBeVisible();
  await expect(page.getByText('牌表檢核通過，匯入後可用於起手查詢。')).toBeVisible();
  await page.getByLabel('新牌組名稱').fill(name);
  await page.getByRole('button', { name: '確認匯入' }).click();
  await page.locator('.deck-row', { hasText: name }).getByRole('link', { name: 'AI 展開分析' }).click();
  await expect(page.getByRole('heading', { name: `AI 展開分析：${name}` })).toBeVisible();
}

test('G34–G39: goal B with preferred Allied Code Talker / Firewall Dragon / Transcode Talker — checked, ranked, compared, covered', async ({ page, context }) => {
  const calls = await mockAi(context, () => sampleAnswer([routeMalissOnly(), routeAlliedTooFewMaterials(), routeFirewall(), routeAllied(), routeFirewallIntoAllied()]));
  await importRealDeck(page, '瑪麗絲（實際牌表）');

  // G35: goal and preferences — only this deck's Extra Deck monsters are offered.
  await page.getByLabel('B 優先達成指定終場怪獸').check();
  const preferred = page.getByRole('group', { name: /優先評估的額外牌組怪獸/ });
  await expect(preferred.getByRole('checkbox')).toHaveCount(15);
  for (const n of ['Allied Code Talker @Ignister', 'Firewall Dragon', 'Transcode Talker']) await preferred.getByLabel(n, { exact: true }).check();
  // G36-1: generation and display are separate.
  await openAdvanced(page); // CR-012: the fields are in 「進階設定」
  await page.getByLabel('最多顯示路線數').fill('3');
  await page.getByLabel('最多顯示路線數').press('Tab');
  await page.getByLabel('AI 產生候選數').fill('5');
  await page.getByLabel('AI 產生候選數').press('Tab');
  await page.getByLabel('Claude API Key').fill(KEY);
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText('分析完成：5 條候選路線。')).toBeVisible();

  // G34-4 / G35-3: one mocked request carrying all 41 cards, arrows, the goal and the preferences.
  expect(calls).toHaveLength(1);
  const sent = calls[0].body;
  for (const id of [C.dormouse, C.allied, C.firewall, C.transcode, C.wicckid, C.splashMage]) expect(sent).toContain(`\\"id\\":${id},`);
  expect(sent).toContain('\\"arrows\\":[\\"Left\\",\\"Right\\",\\"Bottom-Left\\",\\"Bottom\\",\\"Bottom-Right\\"]');
  expect(sent).toContain('Preferred Extra Deck monsters');
  expect(sent).toContain('Return at most 5 routes');

  // G36: three shown, two kept under "more"; the comparison names end-board vs intermediate use.
  await expect(page.getByRole('list', { name: '候選路線' }).getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText('其他候選（超過顯示上限 2 條）')).toBeVisible();
  const table = page.getByRole('table', { name: '候選比較' });
  await expect(table).toContainText('Allied Code Talker @Ignister（終場）');
  await expect(table).toContainText('Firewall Dragon（中途）');
  await expect(table).toContainText('Firewall Dragon（終場）');
  await expect(table).toContainText('單卡');

  // G39: coverage per preferred monster; nothing claimed for Transcode Talker.
  const coverage = page.getByRole('region', { name: '偏好怪獸的結果' });
  await expect(coverage).toContainText('Allied Code Talker @Ignister：找到 2 條');
  await expect(coverage).toContainText('Firewall Dragon：找到 1 條');
  await expect(coverage).toContainText('Transcode Talker：未找到已驗證路線');
  await expect(coverage).not.toContainText('不可能');

  // G37 / G38: the shown route's panel separates summoned from effective, lists rule checks; level stays data-checked.
  await page.getByRole('list', { name: '候選路線' }).getByRole('listitem').filter({ hasText: 'Dormouse → Allied Code Talker＋White Binder' }).getByRole('button', { name: '查看完整展開' }).click();
  await expect(page.getByText('目前層級：資料完整性通過')).toBeVisible();
  const evaluation = page.getByRole('region', { name: '終場評估' });
  await expect(evaluation).toContainText('Allied Code Talker @Ignister');
  await expect(evaluation).toContainText('有效');
  await expect(page.getByRole('region', { name: '規則檢查（部分）' })).toContainText('連結素材');
  await expect(page.locator('.ladder li', { hasText: '規則引擎驗證' })).toContainText('尚未整合（BLOCKED）');

  // N27: the rule-breaking route is kept but stays an AI candidate with the reason.
  await page.getByText('其他候選（超過顯示上限 2 條）').click();
  const more = page.getByRole('list', { name: '其他候選' });
  await expect(more.getByRole('listitem').filter({ hasText: '素材不足' })).toContainText('AI 候選');

  // Re-ranking by another goal is local (no new request).
  await page.getByLabel('排序依據').selectOption('interruptions');
  await expect(page.getByText('其他候選（超過顯示上限 2 條）')).toBeVisible();
  expect(calls).toHaveLength(1);
});

test('G39 / N29 / N30: only a Maliss-only board → "未找到已驗證路線"; Link arrows missing → nothing is sent', async ({ page, context }) => {
  const calls = await mockAi(context, () => sampleAnswer([routeMalissOnly()], { summary: '已找到 Allied Code Talker 路線（模擬的錯誤宣稱）' }));
  await importRealDeck(page, '瑪麗絲（只有本家）');
  await page.getByLabel('B 優先達成指定終場怪獸').check();
  const preferred = page.getByRole('group', { name: /優先評估的額外牌組怪獸/ });
  for (const n of ['Allied Code Talker @Ignister', 'Firewall Dragon']) await preferred.getByLabel(n, { exact: true }).check();
  await page.getByLabel('Claude API Key').fill(KEY);
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText('分析完成：1 條候選路線。')).toBeVisible();
  const coverage = page.getByRole('region', { name: '偏好怪獸的結果' });
  await expect(coverage).toContainText('Allied Code Talker @Ignister：未找到已驗證路線');
  await expect(coverage).toContainText('Firewall Dragon：未找到已驗證路線');
  const table = page.getByRole('table', { name: '候選比較' });
  await expect(table).toContainText('Maliss <Q> Hearts Crypter（終場）');
  await expect(table.getByRole('row').nth(1)).toContainText('0');
  expect(calls).toHaveLength(1);

  // N30: card data without Link arrows (synced before CR-006) blocks the request.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('ygo-combo-assistant');
        open.onsuccess = () => {
          const tx = open.result.transaction('cards', 'readwrite');
          const store = tx.objectStore('cards');
          const get = store.get(5043010);
          get.onsuccess = () => store.put({ ...get.result, linkMarkers: undefined });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await page.getByLabel('Claude API Key').fill(KEY);
  await expect(page.getByText(/連結怪獸沒有連結箭頭資料.*強制重新下載/)).toBeVisible();
  await expect(page.getByRole('button', { name: '強制重新分析' })).toBeDisabled();
  expect(calls).toHaveLength(1);
});
