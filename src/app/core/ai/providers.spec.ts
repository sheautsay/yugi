import { AI_OUTPUT_JSON_SCHEMA } from './analysis-output';
import { anthropicSse, mockAiOutput, ollamaNdjson } from './mock-ai.sample';
import { AiError, AiRequest, FetchLike, callAnthropic, callOllama, ollamaUrlProblem } from './providers';
import { IDS } from './test-deck.sample';

// CR-004 N20 / G27-3: providers against a FAKE fetch — no request leaves the test.
const request: AiRequest = { system: 'SYS', user: 'USER', schema: AI_OUTPUT_JSON_SCHEMA, maxOutputTokens: 32000 };
const text = JSON.stringify(mockAiOutput(IDS));
const claude = { apiKey: 'test-key-not-real', model: 'claude-opus-5-5', effort: 'high' as const, timeoutMs: 60_000 };

interface Captured {
  url: string;
  init: RequestInit;
  headers: Headers;
  body: Record<string, unknown>;
}

function fakeFetch(respond: (c: Captured) => Response | Promise<Response>): { fetch: FetchLike; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetch: FetchLike = async (input, init = {}) => {
    const c = { url: String(input instanceof Request ? input.url : input), init, headers: new Headers(init.headers), body: JSON.parse(String(init.body ?? '{}')) };
    calls.push(c);
    return respond(c);
  };
  return { fetch, calls };
}

const sse = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
const apiError = (status: number, type: string) => new Response(JSON.stringify({ type: 'error', error: { type, message: `${type} (mock)` } }), { status, headers: { 'content-type': 'application/json' } });

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'resolved';
  } catch (e) {
    return e instanceof AiError ? e.code : `other: ${String(e)}`;
  }
}

describe('callAnthropic (official SDK, mocked network)', () => {
  it('streams, reports progress and returns the text, the serving model and usage', async () => {
    const { fetch, calls } = fakeFetch(() => sse(anthropicSse(text, { inputTokens: 15000, outputTokens: 4200 })));
    const progress: number[] = [];
    const result = await callAnthropic(claude, request, { signal: new AbortController().signal, fetch, onProgress: (n) => progress.push(n) });
    expect(result.text).toBe(text);
    expect(result.model).toBe('claude-opus-5-5');
    expect(result.usage).toEqual({ inputTokens: 15000, outputTokens: 4200 });
    expect(progress.at(-1)).toBe(text.length);

    expect(calls).toHaveLength(1);
    const c = calls[0];
    expect(new URL(c.url).host).toBe('api.anthropic.com');
    expect(c.headers.get('x-api-key')).toBe('test-key-not-real');
    expect(c.headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    expect(c.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(c.body).toMatchObject({ model: 'claude-opus-5-5', max_tokens: 32000, stream: true, system: 'SYS', fallbacks: 'default', output_config: { effort: 'high', format: { type: 'json_schema' } } });
    expect(c.body['thinking']).toBeUndefined();
    expect(c.body['messages']).toEqual([{ role: 'user', content: 'USER' }]);
  });

  it('records the model that actually answered after a fallback', async () => {
    const { fetch } = fakeFetch(() => sse(anthropicSse(text, { model: 'claude-opus-4-8' })));
    expect((await callAnthropic(claude, request, { signal: new AbortController().signal, fetch })).model).toBe('claude-opus-4-8');
  });

  it('no refusal fallback is requested for Haiku', async () => {
    const { fetch, calls } = fakeFetch(() => sse(anthropicSse(text, { model: 'claude-haiku-5-5' })));
    await callAnthropic({ ...claude, model: 'claude-haiku-5-5' }, request, { signal: new AbortController().signal, fetch });
    expect(calls[0].body['fallbacks']).toBeUndefined();
  });

  it('N20: 401, 403, 429, 500, network failure, refusal and truncation map to clear errors', async () => {
    const run = (respond: () => Response | Promise<Response>) => codeOf(callAnthropic(claude, request, { signal: new AbortController().signal, fetch: fakeFetch(respond).fetch }));
    expect(await run(() => apiError(401, 'authentication_error'))).toBe('auth');
    expect(await run(() => apiError(403, 'permission_error'))).toBe('permission');
    expect(await run(() => apiError(429, 'rate_limit_error'))).toBe('rate-limit');
    expect(await run(() => apiError(500, 'api_error'))).toBe('server');
    expect(await run(() => Promise.reject(new TypeError('Failed to fetch')))).toBe('network');
    expect(await run(() => sse(anthropicSse('', { stopReason: 'refusal' })))).toBe('refusal');
    expect(await run(() => sse(anthropicSse(text.slice(0, 500), { stopReason: 'max_tokens' })))).toBe('truncated');
  });

  it('no key: fails before any request', async () => {
    const { fetch, calls } = fakeFetch(() => sse(''));
    expect(await codeOf(callAnthropic({ ...claude, apiKey: '  ' }, request, { signal: new AbortController().signal, fetch }))).toBe('config');
    expect(calls).toHaveLength(0);
  });

  it('cancel aborts the request', async () => {
    const controller = new AbortController();
    const { fetch } = fakeFetch(
      (c) =>
        new Promise<Response>((_, reject) => {
          c.init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          setTimeout(() => controller.abort(), 10);
        }),
    );
    expect(await codeOf(callAnthropic(claude, request, { signal: controller.signal, fetch }))).toBe('cancelled');
  });
});

describe('callOllama (mocked local server)', () => {
  const ollama = { baseUrl: 'http://localhost:11434', model: 'qwen-test' };

  it('posts the schema as the output format and joins the streamed text', async () => {
    const { fetch, calls } = fakeFetch(() => new Response(ollamaNdjson(text, { model: 'qwen-test' }), { status: 200 }));
    const progress: number[] = [];
    const result = await callOllama(ollama, request, { signal: new AbortController().signal, fetch, onProgress: (n) => progress.push(n) });
    expect(result).toEqual({ text, model: 'qwen-test', usage: { inputTokens: 9000, outputTokens: 2500 } });
    expect(progress.at(-1)).toBe(text.length);
    expect(calls[0].url).toBe('http://localhost:11434/api/chat');
    expect(calls[0].body).toMatchObject({ model: 'qwen-test', stream: true, format: AI_OUTPUT_JSON_SCHEMA, options: { temperature: 0, num_predict: 32000 } });
  });

  it('only a local address is allowed', async () => {
    expect(ollamaUrlProblem('http://localhost:11434')).toBeNull();
    expect(ollamaUrlProblem('http://127.0.0.1:11434')).toBeNull();
    expect(ollamaUrlProblem('https://ollama.example.com')).toBe('Ollama 位址只能是本機（localhost）');
    const { fetch, calls } = fakeFetch(() => new Response(''));
    expect(await codeOf(callOllama({ ...ollama, baseUrl: 'http://192.168.1.5:11434' }, request, { signal: new AbortController().signal, fetch }))).toBe('config');
    expect(calls).toHaveLength(0);
  });

  it('N20: server not running, unknown model, truncated output', async () => {
    const run = (respond: () => Response | Promise<Response>) => codeOf(callOllama(ollama, request, { signal: new AbortController().signal, fetch: fakeFetch(respond).fetch }));
    expect(await run(() => Promise.reject(new TypeError('Failed to fetch')))).toBe('network');
    expect(await run(() => new Response('{"error":"model not found"}', { status: 404 }))).toBe('config');
    expect(await run(() => new Response(ollamaNdjson(text.slice(0, 300), { doneReason: 'length' }), { status: 200 }))).toBe('truncated');
    expect(await run(() => new Response('{"error":"out of memory"}\n', { status: 200 }))).toBe('server');
  });
});
