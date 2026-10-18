import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { MALISS_DECK_API_CARDS } from '../src/testing/ai/maliss-deck-cards.sample';
import { C, combo, routeAllied, routeAlliedPlusTrap, routeAlliedPlusTwoTraps, routeFirewall, routeFirewallIntoAllied, sampleAnswer, samplePlan, withRoles } from '../src/testing/ai/maliss-routes.sample';
import { anthropicSse } from '../src/testing/ai/mock-ai.sample';
import { EDGE_SAMPLE } from '../src/testing/neuron-deck.sample';
import { mockCardSource, openAddDeck, openAdvanced } from './fixtures';

// CR-008 (G47–G52, G54) with the user's real deck list. Every AI answer is MOCKED and built from
// HAND-WRITTEN routes (not model output). All AI hosts are intercepted; no real or paid AI service
// is contacted, and the number of requests is asserted.

const KEY = 'sk-ant-e2e-mock-key-not-real';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };

const PLAN = samplePlan([
  combo([C.dormouse], 1),
  combo([C.impermanence, C.dormouse], 2),
  combo([C.dormouse, C.impermanence, C.impermanence], 3),
  combo([C.dormouse, C.impermanence], 4), // same cards as #2 → dropped
  combo([C.whiteBinder], 5), // Extra Deck monster → dropped
]);
const ANSWERS = [
  PLAN,
  sampleAnswer([withRoles(routeAllied()), withRoles(routeFirewallIntoAllied()), withRoles(routeFirewall())]),
  sampleAnswer([withRoles(routeAlliedPlusTrap())]),
  // The second alternative has nothing listed to replace Dormouse (a real model answered like this): it must not show as "可換成 " with a blank.
  sampleAnswer([withRoles(routeAlliedPlusTwoTraps(), { alternativeStarters: [{ cardId: C.impermanence, instead: [C.ash], note: '' }, { cardId: C.dormouse, instead: [], note: '' }] })]),
];

async function mockQueue(context: BrowserContext, answers: Record<string, unknown>[]) {
  const calls: string[] = [];
  const handle = async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const body = answers[calls.length] ?? answers.at(-1)!;
    calls.push(req.postData() ?? '');
    return route.fulfill({ status: 200, body: anthropicSse(JSON.stringify(body), { inputTokens: 12000, outputTokens: 3000 }), headers: { ...CORS, 'content-type': 'text/event-stream' } });
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

async function configure(page: Page, o: { maxCombos?: number; routesPerCombo?: number; maxRequests?: number } = {}) {
  await page.getByLabel('分階段分析（1～3 卡，多次請求）').check();
  await expect(page.getByLabel('單卡展開')).toBeChecked();
  await expect(page.getByLabel('雙卡展開')).toBeChecked();
  await expect(page.getByLabel('三卡展開')).not.toBeChecked(); // the default is unchanged: 1 and 2 cards
  await page.getByLabel('三卡展開').check();
  const set = async (label: string, value: number | undefined) => {
    if (value === undefined) return;
    await page.getByLabel(label).fill(String(value));
    await page.getByLabel(label).press('Tab');
  };
  await openAdvanced(page); // CR-012: the fields are in 「進階設定」
  await set('最大候選起手組合數', o.maxCombos ?? 3);
  await set('每個組合的候選路線數', o.routesPerCombo ?? 3);
  await set('AI 請求次數上限（含階段 A）', o.maxRequests);
  await page.getByLabel('Claude API Key').fill(KEY);
}

test('G47–G52: three starter sizes, phased analysis, grouped results, thumbnails, comparison and the end-board preview', async ({ page, context }) => {
  const calls = await mockQueue(context, ANSWERS);
  await importRealDeck(page, '瑪麗絲（rev8）');
  await configure(page);
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText('分析完成：5 條候選路線。')).toBeVisible();

  // G48: one request for phase A and one per accepted combination; nothing for the dropped ones (N39)
  expect(calls).toHaveLength(4);
  expect(calls[0]).toContain('Card roles');
  expect(calls[1]).toContain('Starter combination');
  for (const body of calls) expect(body.match(/\{\\"id\\":\d+,/g)).toHaveLength(41);

  // G48-8: what phase A produced and what became of each combination
  const stagedPanel = page.getByRole('region', { name: '分階段分析結果' });
  await expect(stagedPanel).toContainText('AI 請求 4／6 次');
  await expect(stagedPanel).toContainText('不代表已窮舉所有展開');
  const combos = stagedPanel.getByRole('table', { name: '起手組合狀態' });
  await expect(combos.getByRole('row')).toHaveCount(4); // header + 3
  await expect(combos.getByRole('row').nth(1)).toContainText('完成');
  await expect(stagedPanel.getByText('被捨棄的組合（2）')).toBeVisible();
  await expect(stagedPanel.getByText('AI 候選標籤，不是規則驗證')).toBeVisible();
  await stagedPanel.getByText('卡片角色（AI 候選標籤，不是規則驗證）').click(); // the roles table is in a collapsed section
  const roles = stagedPanel.getByRole('table', { name: '卡片角色' });
  await expect(roles).toContainText('Starter');
  await expect(roles).toContainText('Hand Trap');

  // G52-1: grouped by the number of required cards; the duplicate (same cards, same board) is folded (G52-6)
  await expect(page.getByRole('heading', { name: '單卡展開（2）' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '雙卡展開（1）' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '三卡展開（1）' })).toBeVisible();
  await expect(page.getByText('已折疊 1 條起手與終場都相同的重複路線')).toBeVisible();
  await expect(page.getByRole('list', { name: '單卡展開路線' }).getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('list', { name: '雙卡展開路線' }).getByRole('listitem')).toHaveCount(1);

  // G47-3: replaceable starters are AI labels; an alternative without any replacement is left out, not printed as "可換成 "
  await expect(page.getByRole('list', { name: '三卡展開路線' })).toContainText(/Infinite Impermanence 可換成 Ash Blossom/);
  await expect(page.getByRole('main')).not.toContainText(/可換成\s*[；（]/);

  // two routes of the same starter card that repeat each other from the start are called one line, not two ideas
  await expect(page.getByText(/完全相同：這兩條是同一條主線的不同結尾/).first()).toBeVisible();

  // G51-4: every shown route has an end-board thumbnail built from its data
  const twoCard = page.getByRole('list', { name: '雙卡展開路線' }).getByRole('listitem');
  const thumb = twoCard.getByRole('group', { name: /終場縮圖/ });
  await expect(thumb).toBeVisible();
  await expect(thumb.locator('[data-slot="EMZ-L"]')).toContainText('Allied Code Talker @Ignister');
  await expect(thumb.locator('[data-slot="S2"]')).toContainText('Infinite Impermanence');
  await expect(page.getByRole('group', { name: /終場縮圖/ })).toHaveCount(4);

  // G52-2/4: the comparison shows what the second and third card bring — and does not call it better
  const table = page.getByRole('table', { name: '候選比較' });
  for (const h of ['張數', '起手組合', '需要的牌組資源', '步驟數', '依據', '後續資源', '風險與限制', '相較較少張數路線']) await expect(table.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  const row2 = table.getByRole('row').filter({ hasText: 'Dormouse＋Infinite Impermanence →' });
  await expect(row2).toContainText('雙卡');
  await expect(row2).toContainText('加入「Infinite Impermanence」');
  await expect(row2).toContainText('結論：相同');
  await expect(table.getByRole('row').filter({ hasText: 'Infinite Impermanence×2' })).toContainText('三卡');

  // G52-3: side by side
  await twoCard.getByLabel(/加入並排比較/).check();
  await page.getByRole('list', { name: '單卡展開路線' }).getByRole('listitem').first().getByLabel(/加入並排比較/).check();
  const side = page.getByRole('region', { name: '並排比較' });
  await expect(side.getByRole('article')).toHaveCount(2);
  await expect(side.getByRole('group', { name: /終場預覽/ })).toHaveCount(2);

  // G51 / G49-4: the full board and the step records in the player (same Combo data, both modes)
  await twoCard.getByRole('button', { name: '查看完整展開' }).click();
  const viewer = page.locator('app-combo-viewer');
  const board = viewer.getByRole('group', { name: '終場預覽（由最後一步的狀態快照產生）' });
  await expect(board.locator('[data-slot]')).toHaveCount(2 + 5 + 5 + 1); // EMZ ×2, MMZ ×5, S/T ×5, field zone
  await expect(board.locator('[data-slot="EMZ-L"]')).toContainText('Allied Code Talker @Ignister');
  await expect(board.locator('[data-slot="EMZ-L"] .arrow')).toHaveCount(5);
  await expect(board.locator('[data-slot="M1"]')).toContainText('Maliss <Q> White Binder');
  await expect(board.locator('[data-slot="S2"]')).toContainText('Infinite Impermanence');
  await expect(board.locator('[data-colinked="true"]')).toHaveCount(0);
  for (const t of ['墓地（', '除外（', '剩餘手牌', '額外牌組剩', '牌組剩', '有效干擾（靜態估算）']) await expect(board).toContainText(t);
  await viewer.getByRole('button', { name: '逐步教學' }).click();
  await expect(viewer).toContainText('本回合已使用的效果');
  await expect(viewer).toContainText('目前的召喚限制');
  await expect(page.getByText('目前層級：資料完整性通過')).toBeVisible(); // a nicer picture never raises the level

  // the Firewall Dragon route: both monsters are marked as co-linked
  await page.getByRole('list', { name: '單卡展開路線' }).getByRole('listitem').filter({ hasText: 'Firewall Dragon＋White Binder' }).getByRole('button', { name: '查看完整展開' }).click();
  const board2 = page.locator('app-combo-viewer').getByRole('group', { name: '終場預覽（由最後一步的狀態快照產生）' });
  await expect(board2.locator('[data-colinked="true"]')).toHaveCount(2);
  await expect(board2.locator('[data-slot="EMZ-L"]')).toContainText('Firewall Dragon');
  expect(calls).toHaveLength(4); // viewing and comparing never send anything
});

test('G48-5/6: the request limit stops the loop; finished work stays; the rest is listed as not analysed (N40)', async ({ page, context }) => {
  const calls = await mockQueue(context, ANSWERS);
  await importRealDeck(page, '瑪麗絲（rev8 預算）');
  await configure(page, { maxRequests: 2 });
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText(/分析完成：3 條候選路線/)).toBeVisible();
  expect(calls).toHaveLength(2);
  const panel = page.getByRole('region', { name: '分階段分析結果' });
  await expect(panel).toContainText('未分析 2 個組合');
  await expect(panel).toContainText('不代表已窮舉所有展開');
  await expect(panel).toContainText('AI 請求 2／2 次');
  const combos = panel.getByRole('table', { name: '起手組合狀態' });
  await expect(combos.getByRole('row').nth(1)).toContainText('完成');
  await expect(combos.getByRole('row').nth(2)).toContainText('尚未分析');
  await expect(combos.getByRole('row').nth(2)).toContainText('請求次數');
  await expect(page.getByRole('heading', { name: /單卡展開（/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /雙卡展開（/ })).toHaveCount(0);
});

test('G54: the one-shot mode is still the default and still sends exactly one request', async ({ page, context }) => {
  const calls = await mockQueue(context, [sampleAnswer([routeAllied()])]);
  await importRealDeck(page, '瑪麗絲（rev8 單次）');
  await expect(page.getByLabel('單次分析（一次請求）')).toBeChecked();
  await expect(page.getByLabel('最大候選起手組合數')).toHaveCount(0);
  await page.getByLabel('Claude API Key').fill(KEY);
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText('分析完成：1 條候選路線。')).toBeVisible();
  expect(calls).toHaveLength(1);
  await expect(page.getByRole('region', { name: '分階段分析結果' })).toHaveCount(0);
});
