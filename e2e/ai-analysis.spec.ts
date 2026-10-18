import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { anthropicSse, mockAiOutput, ollamaNdjson } from '../src/app/core/ai/mock-ai.sample';
import { MALISS, dumpUserData, importTestDeck, mockCardSource } from './fixtures';

// CR-004 (G22–G27). Every AI answer here is MOCKED: api.anthropic.com and localhost:11434 are
// intercepted at the browser-context level, so no real or paid AI service is ever contacted.
// The mocked routes are placeholders built from real Maliss passcodes, not real combos.

const IDS = {
  starter: MALISS.whiteRabbit,
  searched: MALISS.dormouse,
  extender: MALISS.chessyCat,
  filler: 90_000_001,
  link: MALISS.redRansom,
  link2: MALISS.whiteBinder,
  outsider: 12_345_678,
};
const GOOD = JSON.stringify(mockAiOutput(IDS));
const KEY = 'sk-ant-e2e-mock-key-not-real';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };

type Reply = { status: number; body: string; type: string } | 'hang';
interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

async function mockAi(context: BrowserContext, reply: () => Reply) {
  const calls: Call[] = [];
  const pending: Route[] = [];
  const handle = async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    calls.push({ url: req.url(), headers: req.headers(), body: JSON.parse(req.postData() ?? '{}') });
    const r = reply();
    if (r === 'hang') {
      pending.push(route);
      return;
    }
    return route.fulfill({ status: r.status, body: r.body, headers: { ...CORS, 'content-type': r.type } });
  };
  await context.route('https://api.anthropic.com/**', handle);
  await context.route('http://localhost:11434/**', handle);
  return { calls, release: () => Promise.all(pending.map((r) => r.abort().catch(() => undefined))) };
}

const sse = (text: string, options: Parameters<typeof anthropicSse>[1] = {}): Reply => ({ status: 200, body: anthropicSse(text, options), type: 'text/event-stream' });
const apiError = (status: number, type: string): Reply => ({ status, body: JSON.stringify({ type: 'error', error: { type, message: `${type} (mock)` } }), type: 'application/json' });

/** The analysis needs every card's effect text, which the full card sync provides (G22-2). */
async function importAndSync(page: Page, deckName: string) {
  await importTestDeck(page, deckName);
  await page.goto('/settings');
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText(/已同步 \d+ 張卡片/)).toBeVisible();
}

async function openAnalysis(page: Page, deckName: string) {
  await page.goto('/decks');
  await page.locator('.deck-row', { hasText: deckName }).getByRole('link', { name: 'AI 展開分析' }).click();
  await expect(page.getByRole('heading', { name: `AI 展開分析：${deckName}` })).toBeVisible();
}

async function allStores(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const open = indexedDB.open('ygo-combo-assistant');
        open.onsuccess = async () => {
          const db = open.result;
          const all = (store: string) =>
            new Promise<unknown[]>((res) => {
              const req = db.transaction(store).objectStore(store).getAll();
              req.onsuccess = () => res(req.result);
            });
          const out = await Promise.all([...db.objectStoreNames].filter((s) => s !== 'images').map(all));
          db.close();
          resolve(JSON.stringify(out));
        };
      }),
  );
}

const candidates = (page: Page) => page.getByRole('list', { name: '候選路線' }).getByRole('listitem');

test('G22–G25: mocked Claude analysis → structured result, separate levels, save as Combo, editor and both view modes', async ({ page, context }) => {
  await mockCardSource(page);
  const ai = await mockAi(context, () => sse(GOOD, { inputTokens: 18000, outputTokens: 4000 }));
  await importAndSync(page, 'AI 測試牌組');
  await openAnalysis(page, 'AI 測試牌組');

  // G22-2 / N22: without a key nothing can be sent.
  await expect(page.getByText('請輸入 Claude API Key（只存在目前分頁）')).toBeVisible();
  await expect(page.getByRole('button', { name: '開始分析' })).toBeDisabled();
  await page.getByLabel('Claude API Key').fill(KEY);
  await expect(page.getByRole('button', { name: '開始分析' })).toBeEnabled();
  await expect(page.getByText(/最高約 US\$\d+\.\d\d（依 2026-10 公告價格估算/)).toBeVisible();

  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText('分析完成：2 條候選路線。')).toBeVisible();
  expect(ai.calls).toHaveLength(1);
  const call = ai.calls[0];
  expect(new URL(call.url).host).toBe('api.anthropic.com');
  expect(call.headers['x-api-key']).toBe(KEY);
  expect(call.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  expect(call.body).toMatchObject({ model: 'claude-opus-5-5', output_config: { effort: 'high', format: { type: 'json_schema' } } });
  const sent = JSON.stringify(call.body);
  expect(sent).toContain('Maliss <P> White Rabbit');
  expect(sent).not.toContain(KEY);

  // G23-1: starters (single / multi), extenders; a card outside the deck is flagged.
  await expect(page.getByRole('heading', { name: '單卡起手（Starter）' })).toBeVisible();
  await expect(page.locator('li', { hasText: 'Maliss <P> Chessy Cat＋Test Filler 90000001' })).toBeVisible();
  await expect(page.getByText('「ID 12345678」不在主牌組中')).toBeVisible();

  // G24: separate levels; the inconsistent route stays an AI candidate with its problems counted.
  await expect(candidates(page)).toHaveCount(2);
  await expect(candidates(page).nth(0)).toContainText('資料完整性通過');
  await expect(candidates(page).nth(1)).toContainText('AI 候選');
  await expect(candidates(page).nth(1)).toContainText(/資料驗證 \d+ 項未通過/);

  // G25-2: the same player for a candidate — both modes share the current step; moves are shown.
  await candidates(page).nth(0).getByRole('button', { name: '查看完整展開' }).click();
  await expect(page.getByText('目前層級：資料完整性通過')).toBeVisible();
  await expect(page.locator('.ladder li', { hasText: '規則引擎驗證' })).toContainText('尚未提供');
  await expect(page.locator('.ladder li', { hasText: 'Master Duel 實測確認' })).toContainText('未達成');
  await page.getByRole('button', { name: '逐步教學' }).click();
  await expect(page.locator('.progress')).toHaveText('第 1 / 4 步');
  await expect(page.getByText('Maliss <P> White Rabbit：手牌 → 場上')).toBeVisible();
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.locator('.progress')).toHaveText('第 2 / 4 步');
  await page.getByRole('button', { name: '圖像流程' }).click();
  await expect(page.locator('.node.current')).toHaveAttribute('data-order', '2');

  await candidates(page).nth(1).getByRole('button', { name: '查看完整展開' }).click();
  await expect(page.getByText('目前層級：AI 候選')).toBeVisible();
  await expect(page.getByText(/「ID 12345678」（ID 12345678）不在此牌組的主牌或額外牌組中/).first()).toBeVisible();

  // G25-3 / G24-3: saved as ordinary Combos — unverified and draft, never verified.
  await candidates(page).nth(0).getByRole('button', { name: '存成固定 Combo' }).click();
  await expect(page.getByText('已存成固定 Combo「單卡起手：測試路線（mock）」（未驗證）')).toBeVisible();
  await candidates(page).nth(1).getByRole('button', { name: '存成固定 Combo' }).click();
  await expect(page.getByText('已存成固定 Combo「雙卡起手：不一致的路線（mock）」（草稿）')).toBeVisible();
  const stored = (await dumpUserData(page)).combos as Array<{ name: string; verification: { status: string }; analysis?: unknown }>;
  expect(stored.map((c) => [c.name, c.verification.status, !!c.analysis]).sort()).toEqual([
    ['單卡起手：測試路線（mock）', 'unverified', true],
    ['雙卡起手：不一致的路線（mock）', 'draft', true],
  ]);

  // G22-5: same settings again → cached, no new request.
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText(/使用快取結果/)).toBeVisible();
  expect(ai.calls).toHaveLength(1);

  // Combo page: AI panel + the existing viewer; editor keeps the AI fields.
  await candidates(page).nth(0).getByRole('button', { name: '開啟已存的 Combo' }).click();
  await expect(page.getByRole('heading', { name: '單卡起手：測試路線（mock）' })).toBeVisible();
  await expect(page.getByText('AI 產生')).toBeVisible();
  await expect(page.getByText('目前層級：資料完整性通過')).toBeVisible();
  await page.getByRole('link', { name: '編輯', exact: true }).click();
  await expect(page.getByText(/此路線由 AI 產生（claude-opus-5-5/)).toBeVisible();
  await page.getByLabel('名稱（必填）').fill('AI 路線（已編輯）');
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByText('已儲存（版本 2）。')).toBeVisible();
  await page.getByRole('link', { name: '查看展開' }).click();
  await expect(page.getByRole('heading', { name: 'AI 路線（已編輯）' })).toBeVisible();
  await page.getByRole('button', { name: '逐步教學' }).click();
  await expect(page.getByText('Maliss <P> White Rabbit：手牌 → 場上')).toBeVisible();
  await expect(page.getByText('目前層級：資料完整性通過')).toBeVisible();

  // G27-2: the key is only in this tab's sessionStorage — not in IndexedDB or a backup.
  expect(await page.evaluate(() => Object.values(sessionStorage).join())).toContain(KEY);
  expect(await allStores(page)).not.toContain(KEY);
  await page.goto('/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /匯出完整備份/ }).click()]);
  const backup = await (await download.createReadStream()).toArray();
  expect(Buffer.concat(backup).toString('utf8')).not.toContain(KEY);
});

test('G26: after a deck change the affected AI route is listed and is not offered in the opening-hand query', async ({ page, context }) => {
  await mockCardSource(page);
  await mockAi(context, () => sse(JSON.stringify(mockAiOutput(IDS, { routes: 1 }))));
  await importAndSync(page, '變更測試');
  await openAnalysis(page, '變更測試');
  await page.getByLabel('Claude API Key').fill(KEY);
  await page.getByRole('button', { name: '開始分析' }).click();
  await candidates(page).nth(0).getByRole('button', { name: '存成固定 Combo' }).click();
  await expect(page.getByText(/已存成固定 Combo/)).toBeVisible();

  const pickHand = async () => {
    await page.goto('/decks');
    await page.locator('.deck-row', { hasText: '變更測試' }).getByRole('link', { name: '起手查詢' }).click();
    for (const name of ['Maliss <P> White Rabbit', 'Test Filler 90000002', 'Test Filler 90000003', 'Test Filler 90000004', 'Test Filler 90000005']) {
      await page.getByRole('button', { name: new RegExp(`^加入 ${name.replace(/[<>]/g, '.')}（剩`) }).click();
    }
    await expect(page.getByRole('heading', { name: '起手（5 / 5 張）' })).toBeVisible();
  };
  await pickHand();
  await expect(page.locator('[data-kind="unverified"]', { hasText: '單卡起手：測試路線（mock）' })).toBeVisible();

  // Remove the Link monster the route summons, then save the deck.
  await page.goto('/decks');
  await page.locator('.deck-row', { hasText: '變更測試' }).getByRole('link', { name: '編輯' }).click();
  await page.getByRole('region', { name: '額外' }).locator('li', { hasText: 'Maliss <Q> Red Ransom' }).getByRole('button', { name: '移除' }).click();
  await page.getByRole('button', { name: '儲存', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('此牌組有 1 條 AI 路線，其中 1 條已不再通過資料驗證');

  await openAnalysis(page, '變更測試');
  const affected = page.getByRole('region', { name: '此牌組已存成 Combo 的 AI 路線' });
  await expect(affected.locator('li', { hasText: '單卡起手：測試路線（mock）' })).toContainText('已不適用');
  await expect(affected).toContainText('Maliss <Q> Red Ransom');
  await expect(page.locator('.item', { hasText: 'Claude API' }).getByText('牌組已變更')).toBeVisible();

  await pickHand();
  await expect(page.locator('[data-kind="unverified"]', { hasText: '單卡起手：測試路線（mock）' })).toHaveCount(0);
  await page.getByText(/^不符合（\d+）/).click();
  await expect(page.locator('[data-kind="unavailable"]', { hasText: '單卡起手：測試路線（mock）' })).toContainText('AI 路線不適用於目前牌組');
});

test('N20 / G27-1: API errors, bad output, refusal and cancel leave decks and combos untouched', async ({ page, context }) => {
  await mockCardSource(page);
  let next: Reply = apiError(401, 'authentication_error');
  const ai = await mockAi(context, () => next);
  await importAndSync(page, '失敗測試');
  await openAnalysis(page, '失敗測試');
  await page.getByLabel('Claude API Key').fill(KEY);
  const before = JSON.stringify(await dumpUserData(page));

  const expectFailure = async (reply: Reply, message: string) => {
    next = reply;
    await page.getByRole('button', { name: '強制重新分析' }).click();
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page.getByRole('alert')).toContainText('既有牌組與 Combo 未受影響');
    expect(JSON.stringify(await dumpUserData(page))).toBe(before);
  };
  await expectFailure(apiError(401, 'authentication_error'), 'API Key 無效或已撤銷（401）');
  await expectFailure(apiError(429, 'rate_limit_error'), '429');
  await expectFailure(apiError(500, 'api_error'), 'Anthropic API 錯誤（500）');
  await expectFailure(sse('這不是 JSON'), 'AI 回應不是有效的 JSON');
  await expectFailure(sse(JSON.stringify({ ...mockAiOutput(IDS), routes: [] })), 'AI 沒有提出任何路線');
  await expectFailure(sse('', { stopReason: 'refusal' }), '模型拒絕回應');
  await expectFailure(sse(GOOD.slice(0, 300), { stopReason: 'max_tokens' }), '被截斷');

  next = 'hang';
  await page.getByRole('button', { name: '強制重新分析' }).click();
  await expect(page.getByText('狀態：等待模型回應')).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.getByRole('alert')).toContainText('已取消');
  await ai.release();
  expect(JSON.stringify(await dumpUserData(page))).toBe(before);
  expect(ai.calls).toHaveLength(8);
  await expect(page.locator('.item .badge', { hasText: '失敗' })).toHaveCount(7);
});

test('N21 / G22-2: missing card text or a failed deck check blocks the analysis and nothing is sent', async ({ page, context }) => {
  await mockCardSource(page);
  const ai = await mockAi(context, () => sse(GOOD));
  await importTestDeck(page, '未同步牌組');
  await openAnalysis(page, '未同步牌組');
  await page.getByLabel('Claude API Key').fill(KEY);
  await expect(page.getByText('有 33 種卡沒有效果文字，請先下載完整卡片資料（設定 → 完整卡片資料庫）')).toBeVisible();
  await expect(page.getByRole('button', { name: '開始分析' })).toBeDisabled();

  await page.goto('/decks');
  await page.getByLabel('牌組名稱', { exact: true }).fill('空白牌組');
  await page.getByRole('button', { name: '建立', exact: true }).click();
  await openAnalysis(page, '空白牌組');
  await page.getByLabel('Claude API Key').fill(KEY);
  await expect(page.getByText(/牌組未通過牌表檢核/)).toBeVisible();
  await expect(page.getByRole('button', { name: '開始分析' })).toBeDisabled();
  expect(ai.calls).toHaveLength(0);
});

test('local Ollama provider (mocked local server): no cloud request, no API cost', async ({ page, context }) => {
  await mockCardSource(page);
  const ai = await mockAi(context, () => ({ status: 200, body: ollamaNdjson(GOOD, { model: 'qwen-test' }), type: 'application/x-ndjson' }));
  await importAndSync(page, '本機模型');
  await openAnalysis(page, '本機模型');
  await page.getByLabel('本機 Ollama（離線；需自行安裝並下載模型）').check();
  await page.getByLabel('模型名稱').fill('qwen-test');
  await page.getByLabel('模型名稱').press('Tab');
  await expect(page.getByText('本機執行，不產生 API 費用。')).toBeVisible();
  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText('分析完成：2 條候選路線。')).toBeVisible();
  expect(ai.calls.map((c) => c.url)).toEqual(['http://localhost:11434/api/chat']);
  await expect(candidates(page).nth(0)).toContainText('資料完整性通過');
});
