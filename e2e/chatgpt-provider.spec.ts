import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { mockAiOutput, responsesSse } from '../src/app/core/ai/mock-ai.sample';
import { MALISS, dumpUserData, importTestDeck, mockCardSource } from './fixtures';

// CR-005 (G28–G32). The local ChatGPT bridge is FAKED in the browser (/chatgpt-bridge/**) and the
// official sign-in page is STUBBED, so no request reaches OpenAI. The bridge itself (OAuth, tokens,
// Responses) is covered by `npm run test:bridge`. The mocked routes are placeholders, not combos.

const IDS = { starter: MALISS.whiteRabbit, searched: MALISS.dormouse, extender: MALISS.chessyCat, filler: 90_000_001, link: MALISS.redRansom, link2: MALISS.whiteBinder, outsider: 12_345_678 };
const GOOD = JSON.stringify(mockAiOutput(IDS));
const AUTHORIZE = 'https://auth.openai.com/api/accounts/authorize?response_type=code&client_id=dynamic_agent_client&state=s&nonce=n';

interface FakeBridge {
  up: boolean;
  signedIn: boolean;
  sharing: boolean;
  responses: () => { status: number; body: string; type: string };
  calls: Array<{ path: string; method: string; body: string }>;
}

async function fakeBridge(page: Page, context: BrowserContext): Promise<FakeBridge> {
  const bridge: FakeBridge = {
    up: true,
    signedIn: false,
    sharing: false,
    responses: () => ({ status: 200, body: responsesSse(GOOD, { model: 'gpt-mock-2026' }), type: 'text/event-stream' }),
    calls: [],
  };
  await page.route('**/chatgpt-bridge/**', async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/chatgpt-bridge', '');
    bridge.calls.push({ path, method: req.method(), body: req.postData() ?? '' });
    if (!bridge.up) return route.fulfill({ status: 504, body: 'Error occurred while trying to proxy' });
    if (req.headers()['x-ygo-bridge'] !== '1') return route.fulfill({ status: 403, json: { error: { code: 'forbidden' } } });
    if (path === '/status') {
      return route.fulfill({
        json: { ok: true, signedIn: bridge.signedIn, sharing: bridge.sharing, account: bridge.signedIn ? { email: 'player@example.com', name: 'Player' } : null, expiresAt: null, pending: false, lastError: null },
      });
    }
    if (path === '/auth/start') return route.fulfill({ json: { authorizeUrl: AUTHORIZE } });
    if (path === '/auth/logout') {
      bridge.signedIn = false;
      bridge.sharing = false;
      return route.fulfill({ json: { revoked: true } });
    }
    if (path === '/models') {
      return bridge.sharing
        ? route.fulfill({ json: { models: [{ slug: 'gpt-mock-b', displayName: 'GPT Mock B' }, { slug: 'gpt-mock-a', displayName: 'GPT Mock A' }] } })
        : route.fulfill({ status: 403, json: { error: { code: 'sharing_disabled', message: 'no plan usage' } } });
    }
    if (path === '/responses') {
      const r = bridge.responses();
      return route.fulfill({ status: r.status, body: r.body, headers: { 'content-type': r.type, 'x-ygo-structured-output': 'true' } });
    }
    return route.fulfill({ status: 404, json: { error: { code: 'not_found' } } });
  });
  // The official page is stubbed: "completing" it signs the fake bridge in with plan usage.
  await context.route('https://auth.openai.com/**', (route) => {
    bridge.signedIn = true;
    bridge.sharing = true;
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>official sign-in (stub)</h1>' });
  });
  return bridge;
}

async function openAnalysisWithChatGpt(page: Page, deckName: string) {
  await importTestDeck(page, deckName);
  await page.goto('/settings');
  await page.getByRole('button', { name: '下載／更新完整卡片資料' }).click();
  await expect(page.getByText(/已同步 \d+ 張卡片/)).toBeVisible();
  await page.goto('/decks');
  await page.locator('.deck-row', { hasText: deckName }).getByRole('link', { name: 'AI 展開分析' }).click();
  await page.getByLabel('ChatGPT 帳號登入（使用你的 ChatGPT 方案額度）').check();
}

test('G28–G32: sign in through the official page, pick a model from the account, analyse with the ChatGPT plan', async ({ page, context }) => {
  await mockCardSource(page);
  const bridge = await fakeBridge(page, context);
  const openai: string[] = [];
  page.on('request', (r) => /openai\.com/.test(r.url()) && openai.push(r.url()));
  bridge.up = false;
  await openAnalysisWithChatGpt(page, 'ChatGPT 測試');

  // Bridge not running → how to start it; nothing can be sent.
  await expect(page.getByText(/本機 ChatGPT 服務沒有啟動。請另開終端機，在專案資料夾執行 npm run chatgpt-bridge/)).toBeVisible();
  await expect(page.getByRole('button', { name: '開始分析' })).toBeDisabled();
  bridge.up = true;
  await page.getByRole('button', { name: '重新整理' }).click();
  await expect(page.getByText('尚未登入 ChatGPT。')).toBeVisible();
  await expect(page.getByText('請按「Continue with ChatGPT」以 ChatGPT 帳號登入')).toBeVisible();

  // "Continue with ChatGPT" opens the official authorization page in a new tab.
  const [tab] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Continue with ChatGPT' }).click()]);
  await tab.waitForURL(/auth\.openai\.com/);
  expect(tab.url()).toBe(AUTHORIZE);
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  await tab.close();

  // The page polls the bridge and shows the account; first sign-in shows the plan notice once.
  await expect(page.getByText('已登入：player@example.com')).toBeVisible({ timeout: 10_000 });
  const welcome = page.getByRole('dialog', { name: '你正在使用你的 ChatGPT 方案' });
  await expect(welcome).toBeVisible();
  await welcome.getByRole('button', { name: '知道了' }).click();
  await expect(welcome).toHaveCount(0);
  await expect(page.getByText('使用你的 ChatGPT 方案', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '管理用量' })).toHaveAttribute('href', 'https://chatgpt.com/settings/usage');

  // G30: the model list is the account's, in the server's order; no model is preselected.
  const select = page.getByLabel('模型（目前帳號可用）');
  expect(await select.locator('option').allTextContents()).toEqual(['請選擇模型', 'GPT Mock B', 'GPT Mock A']);
  await expect(page.getByText('請從目前帳號的模型清單選擇模型')).toBeVisible();
  await select.selectOption('gpt-mock-a');
  await expect(page.getByText('使用你的 ChatGPT 方案額度，不另外計算 API 費用。')).toBeVisible();
  await expect(page.getByLabel('最大輸出 tokens')).toBeDisabled();

  await page.getByRole('button', { name: '開始分析' }).click();
  await expect(page.getByText('分析完成：2 條候選路線。')).toBeVisible();
  const sent = bridge.calls.find((c) => c.path === '/responses')!;
  expect(Object.keys(JSON.parse(sent.body)).sort()).toEqual(['input', 'instructions', 'model', 'schema']);
  expect(JSON.parse(sent.body).model).toBe('gpt-mock-a');

  // G32-3: still only candidates, through the same data check.
  const list = page.getByRole('list', { name: '候選路線' }).getByRole('listitem');
  await expect(list.nth(0)).toContainText('資料完整性通過');
  await expect(list.nth(1)).toContainText('AI 候選');
  await page.getByText('分析紀錄（牌組、資料版本、規則假設、模型與參數）').click();
  await expect(page.getByText('ChatGPT 帳號（方案用量）／gpt-mock-a（實際回應：gpt-mock-2026）')).toBeVisible();
  await expect(page.getByText(/store false・stream true・結構化輸出 是/)).toBeVisible();
  await expect(page.getByText(/・使用 ChatGPT 方案用量/)).toBeVisible();
  await list.nth(0).getByRole('button', { name: '存成固定 Combo' }).click();
  await expect(page.getByText(/已存成固定 Combo「.*」（未驗證）/)).toBeVisible();

  // The page itself never called OpenAI (only the user-opened tab went to the official page).
  expect(openai).toEqual([]);

  // G32-1: sign out goes through the bridge.
  await page.getByRole('button', { name: '登出 ChatGPT' }).click();
  await expect(page.getByText('已登出，並已撤銷此 App 的授權。')).toBeVisible();
  await expect(page.getByText('尚未登入 ChatGPT。')).toBeVisible();
  expect(bridge.calls.some((c) => c.path === '/auth/logout' && c.method === 'POST')).toBe(true);
});

test('N24 / N25: no plan-usage consent blocks the analysis; the usage limit offers "Manage usage" and changes nothing', async ({ page, context }) => {
  await mockCardSource(page);
  const bridge = await fakeBridge(page, context);
  bridge.signedIn = true;
  bridge.sharing = false;
  await openAnalysisWithChatGpt(page, '方案上限');
  await expect(page.getByText('此登入沒有授權使用 ChatGPT 方案用量，不能用來分析。', { exact: false })).toBeVisible();
  await expect(page.getByLabel('模型（目前帳號可用）')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '開始分析' })).toBeDisabled();
  expect(bridge.calls.filter((c) => c.path === '/models' || c.path === '/responses')).toEqual([]);

  bridge.sharing = true;
  await page.getByRole('button', { name: '重新整理' }).click();
  await page.getByLabel('模型（目前帳號可用）').selectOption('gpt-mock-b');
  bridge.responses = () => ({ status: 429, body: JSON.stringify({ error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'limit (mock)', param: null, requestId: 'req_mock' } }), type: 'application/json' });
  const before = JSON.stringify(await dumpUserData(page));
  await page.getByRole('button', { name: '開始分析' }).click();
  const alert = page.getByRole('alert').filter({ hasText: '已達 ChatGPT 方案用量上限' });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('link', { name: '管理用量' })).toHaveAttribute('href', 'https://chatgpt.com/settings/usage');
  expect(JSON.stringify(await dumpUserData(page))).toBe(before);
});

test('CR-012: settings switches the ChatGPT account (sign out, forget this account, open the official page again)', async ({ page, context }) => {
  const bridge = await fakeBridge(page, context);
  bridge.signedIn = true;
  bridge.sharing = true;
  await page.goto('/settings');
  await expect(page.getByText('已連線：player@example.com')).toBeVisible();

  page.once('dialog', (d) => d.dismiss()); // cancelling the confirmation changes nothing
  await page.getByRole('button', { name: '切換帳號' }).click();
  expect(bridge.calls.some((c) => c.path === '/auth/logout')).toBe(false);

  page.once('dialog', (d) => d.accept());
  const [tab] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: '切換帳號' }).click()]);
  await tab.waitForURL(/auth\.openai\.com/);
  expect(tab.url()).toBe(AUTHORIZE);
  await tab.close();
  const logout = bridge.calls.find((c) => c.path === '/auth/logout')!;
  expect(logout.method).toBe('POST');
  expect(JSON.parse(logout.body)).toEqual({ forget: true });
  expect(bridge.calls.findIndex((c) => c.path === '/auth/logout')).toBeLessThan(bridge.calls.findIndex((c) => c.path === '/auth/start'));
  await expect(page.getByText('已登入 ChatGPT，並已授權使用你的 ChatGPT 方案額度。')).toBeVisible({ timeout: 10_000 });
});
