import { TestBed } from '@angular/core/testing';
import { AppDb, DB_NAME } from '../db';
import { AI_OUTPUT_JSON_SCHEMA } from './analysis-output';
import { AiAnalysisService } from './analysis.service';
import { BRIDGE_DOWN, callChatGpt, chatGptModels, chatGptSignIn, chatGptStatus } from './chatgpt';
import { mockAiOutput, responsesSse } from './mock-ai.sample';
import { AI_FETCH, AiError, AiRequest, FetchLike } from './providers';
import { IDS, testCards, testDeck } from './test-deck.sample';

// CR-005 G30–G32 / N25 on the Angular side, against a FAKE local bridge. The page only ever talks
// to /chatgpt-bridge; it never sees a token and never contacts OpenAI.
const request: AiRequest = { system: 'SYS', user: 'USER', schema: AI_OUTPUT_JSON_SCHEMA, maxOutputTokens: 32000 };
const GOOD = JSON.stringify(mockAiOutput(IDS));
const sse = (body: string, headers: Record<string, string> = {}) => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream', ...headers } });
const err = (status: number, code: string, extra: Record<string, unknown> = {}) => Response.json({ error: { code, message: `${code} (mock)`, ...extra } }, { status });

interface Captured {
  url: string;
  init: RequestInit;
}

function fake(routes: Record<string, (init: RequestInit) => Response | Promise<Response>>): { fetch: FetchLike; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetch: FetchLike = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes[url];
    if (!route) throw new TypeError(`unexpected ${url}`);
    return route(init);
  };
  return { fetch, calls };
}

const run = (respond: () => Response | Promise<Response>, signal = new AbortController().signal) => {
  const { fetch, calls } = fake({ '/chatgpt-bridge/responses': respond });
  return { promise: callChatGpt({ model: 'gpt-a' }, request, { signal, fetch }), calls };
};

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'resolved';
  } catch (e) {
    return e instanceof AiError ? e.code : `other: ${String(e)}`;
  }
}

describe('callChatGpt (local bridge, mocked)', () => {
  it('reads the Responses stream until response.completed; only model, instructions, input and schema are sent', async () => {
    const progress: number[] = [];
    const { fetch, calls } = fake({ '/chatgpt-bridge/responses': () => sse(responsesSse(GOOD, { model: 'gpt-a-2026' }), { 'x-ygo-structured-output': 'true' }) });
    const result = await callChatGpt({ model: 'gpt-a' }, request, { signal: new AbortController().signal, fetch, onProgress: (n) => progress.push(n) });
    expect(result).toEqual({ text: GOOD, model: 'gpt-a-2026', usage: { inputTokens: 15000, outputTokens: 3500 }, structuredOutput: true });
    expect(progress.at(-1)).toBe(GOOD.length);
    const init = calls[0].init;
    expect(new Headers(init.headers).get('x-ygo-bridge')).toBe('1');
    const body = JSON.parse(String(init.body));
    expect(Object.keys(body).sort()).toEqual(['input', 'instructions', 'model', 'schema']);
    expect(body).toMatchObject({ model: 'gpt-a', instructions: 'SYS', input: 'USER' });
  });

  it('records when the bridge had to drop structured output', async () => {
    const { promise } = run(() => sse(responsesSse(GOOD), { 'x-ygo-structured-output': 'false' }));
    expect((await promise).structuredOutput).toBe(false);
  });

  it('N25: usage limit, not eligible, unavailable, unsupported, signed out — documented codes map to clear errors', async () => {
    expect(await code(run(() => err(429, 'subscription_sharing_usage_limit_exceeded')).promise)).toBe('usage-limit');
    expect(await code(run(() => err(403, 'subscription_sharing_user_not_eligible')).promise)).toBe('permission');
    expect(await code(run(() => err(503, 'subscription_sharing_usage_unavailable')).promise)).toBe('server');
    expect(await code(run(() => err(400, 'subscription_sharing_unsupported_capability', { param: 'model' })).promise)).toBe('bad-request');
    expect(await code(run(() => err(401, 'reauth_required')).promise)).toBe('auth');
    expect(await code(run(() => err(403, 'sharing_disabled')).promise)).toBe('permission');
    expect(await code(run(() => err(401, 'subscription_sharing_invalid_user', { requestId: 'req_1' })).promise)).toBe('auth');
  });

  it('N25: failures inside the stream — response.failed, response.incomplete, an error event, a cut stream', async () => {
    expect(await code(run(() => sse(responsesSse(GOOD.slice(0, 100), { end: 'failed' }))).promise)).toBe('usage-limit');
    expect(await code(run(() => sse(responsesSse(GOOD.slice(0, 100), { end: 'incomplete' }))).promise)).toBe('truncated');
    expect(await code(run(() => sse(`event: error\ndata: ${JSON.stringify({ type: 'error', code: 'subscription_sharing_user_unavailable', message: 'x' })}\n\n`)).promise)).toBe('server');
    expect(await code(run(() => sse(responsesSse(GOOD.slice(0, 100), { end: 'cut' }))).promise)).toBe('network');
  });

  it('bridge not running (connection refused or a proxy error page) → tells how to start it', async () => {
    const down = run(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(down.promise).rejects.toThrow('npm run chatgpt-bridge');
    expect(await code(run(() => new Response('Error occurred while trying to proxy', { status: 504 })).promise)).toBe('network');
  });

  it('cancel aborts the request', async () => {
    const controller = new AbortController();
    const { promise } = run(
      () =>
        new Promise<Response>((_, reject) => {
          setTimeout(() => {
            controller.abort();
            reject(new DOMException('aborted', 'AbortError'));
          }, 5);
        }),
      controller.signal,
    );
    expect(await code(promise)).toBe('cancelled');
  });
});

describe('bridge account calls', () => {
  it('status copies only known fields (a token field from a broken bridge is never kept)', async () => {
    const { fetch } = fake({ '/chatgpt-bridge/status': () => Response.json({ ok: true, signedIn: true, sharing: true, account: { email: 'p@example.com', name: 'P' }, expiresAt: null, pending: false, lastError: null, access_token: 'leak' }) });
    const status = await chatGptStatus(fetch);
    expect(status).toEqual({ reachable: true, signedIn: true, sharing: true, account: { email: 'p@example.com', name: 'P' }, expiresAt: null, pending: false, lastError: null });
    expect(JSON.stringify(status)).not.toContain('leak');
    expect(await chatGptStatus(fake({ '/chatgpt-bridge/status': () => new Response('proxy error', { status: 504 }) }).fetch)).toEqual(BRIDGE_DOWN);
  });

  it('models come from the bridge; sign-in only accepts an https authorization page', async () => {
    const { fetch } = fake({
      '/chatgpt-bridge/models': () => Response.json({ models: [{ slug: 'gpt-b', displayName: 'GPT B' }, { slug: 'gpt-a', displayName: '' }] }),
      '/chatgpt-bridge/auth/start': () => Response.json({ authorizeUrl: 'javascript:alert(1)' }),
    });
    expect(await chatGptModels(fetch)).toEqual([
      { slug: 'gpt-b', displayName: 'GPT B' },
      { slug: 'gpt-a', displayName: 'gpt-a' },
    ]);
    await expect(chatGptSignIn(fetch)).rejects.toThrow('沒有回傳有效的登入網址');
  });
});

describe('AiAnalysisService with the ChatGPT provider', () => {
  const deck = testDeck();
  const cards = testCards(deck);
  const status = { ok: true, signedIn: true, sharing: true, account: { email: 'p@example.com', name: 'P' }, expiresAt: null, pending: false, lastError: null };

  async function setup(routes: Record<string, (init: RequestInit) => Response | Promise<Response>>) {
    const { fetch, calls } = fake(routes);
    TestBed.configureTestingModule({ providers: [{ provide: DB_NAME, useValue: `chatgpt-${crypto.randomUUID()}` }, { provide: AI_FETCH, useValue: fetch }] });
    const db = await TestBed.inject(AppDb).db();
    for (const card of cards.values()) await db.put('cards', card);
    await db.put('decks', deck);
    const service = TestBed.inject(AiAnalysisService);
    await service.ready;
    await service.updateSettings({ provider: 'chatgpt' });
    return { service, db, calls };
  }

  it('G30: cannot start until the bridge runs, the user signs in with plan usage, and picks a listed model', async () => {
    let current: Record<string, unknown> = { ok: false };
    const { service, calls } = await setup({
      '/chatgpt-bridge/status': () => (current['ok'] ? Response.json(current) : new Response('', { status: 504 })),
      '/chatgpt-bridge/models': () => Response.json({ models: [{ slug: 'gpt-a', displayName: 'GPT A' }] }),
    });
    const reasons = async () => (await service.preflight(deck, cards)).join('\n');
    await service.refreshChatGpt();
    expect(await reasons()).toContain('npm run chatgpt-bridge');
    current = { ...status, signedIn: false, sharing: false, account: null };
    await service.refreshChatGpt();
    expect(await reasons()).toContain('使用 ChatGPT 登入');
    current = { ...status, sharing: false };
    await service.refreshChatGpt();
    expect(await reasons()).toContain('沒有授權使用 ChatGPT 方案用量');
    expect(calls.some((c) => c.url.endsWith('/models'))).toBe(false); // models only when plan usage is granted
    current = status;
    await service.refreshChatGpt();
    expect(service.chatgptModels()).toEqual([{ slug: 'gpt-a', displayName: 'GPT A' }]);
    expect(await reasons()).toContain('請從目前帳號的模型清單選擇模型');
    await service.updateSettings({ chatgptModel: 'gpt-retired' });
    expect(await reasons()).toContain('不在目前帳號的模型清單中');
    await service.updateSettings({ chatgptModel: 'gpt-a' });
    expect(await reasons()).toBe('');
    expect(calls.some((c) => c.url.endsWith('/responses'))).toBe(false);
  });

  it('G31/G32: a run uses the shared flow and records store/stream, usage and no dollar cost; results stay candidates', async () => {
    const { service, db } = await setup({
      '/chatgpt-bridge/status': () => Response.json(status),
      '/chatgpt-bridge/models': () => Response.json({ models: [{ slug: 'gpt-a', displayName: 'GPT A' }] }),
      '/chatgpt-bridge/responses': () => sse(responsesSse(GOOD, { model: 'gpt-a-2026' }), { 'x-ygo-structured-output': 'true' }),
    });
    await service.refreshChatGpt();
    await service.updateSettings({ chatgptModel: 'gpt-a' });
    const r = await service.start(deck);
    expect(r).toMatchObject({
      status: 'succeeded',
      provider: 'chatgpt',
      model: 'gpt-a',
      servedModel: 'gpt-a-2026',
      params: { store: false, stream: true, structuredOutput: true, timeoutSeconds: 900 },
      usage: { inputTokens: 15000, outputTokens: 3500 },
    });
    expect(r.params.maxOutputTokens).toBeUndefined();
    expect(r.usage?.estimatedCostUsd).toBeUndefined();
    expect(r.candidates?.map((c) => c.route.verification.status)).toEqual(['unverified', 'draft']);
    expect(r.candidates?.[0].route.analysis?.provider).toBe('chatgpt');
    expect(JSON.stringify(await db.getAll('meta'))).not.toMatch(/access_token|refresh_token|id_token/);
  });

  it('N25: the plan usage limit fails the run with the usage-limit code and leaves decks and combos alone', async () => {
    const { service, db } = await setup({
      '/chatgpt-bridge/status': () => Response.json(status),
      '/chatgpt-bridge/models': () => Response.json({ models: [{ slug: 'gpt-a', displayName: 'GPT A' }] }),
      '/chatgpt-bridge/responses': () => err(429, 'subscription_sharing_usage_limit_exceeded'),
    });
    await service.refreshChatGpt();
    await service.updateSettings({ chatgptModel: 'gpt-a' });
    const before = JSON.stringify([await db.getAll('decks'), await db.getAll('combos')]);
    const r = await service.start(deck);
    expect([r.status, r.error?.code]).toEqual(['failed', 'usage-limit']);
    expect(JSON.stringify([await db.getAll('decks'), await db.getAll('combos')])).toBe(before);
  });
});
