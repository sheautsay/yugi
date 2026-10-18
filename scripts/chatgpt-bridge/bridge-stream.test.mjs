// The event log must tell a normal end from an aborted request. Found in two real analyses: the app stops reading at
// `response.completed` (the only success signal) while OpenAI keeps the stream open a few seconds more, and the bridge
// logged that normal end as "request.aborted". FAKE OpenAI; no request leaves this machine.
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { API_BASE, SCOPES, createBridge } from './bridge.mjs';

const sse = (e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;

/** A Responses stream: a delta, then (after `completeAfterMs`) response.completed, then it stays open `holdMs`. */
function fakeOpenAI({ completeAfterMs = 0, holdMs = 600 } = {}) {
  return async (url, init = {}) => {
    if (String(url) !== `${API_BASE}/responses`) throw new TypeError(`unexpected request to ${url}`);
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        init.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
        controller.enqueue(enc.encode(sse({ type: 'response.output_text.delta', delta: '{"ok":true}' })));
        await new Promise((r) => setTimeout(r, completeAfterMs));
        if (init.signal?.aborted) return;
        controller.enqueue(enc.encode(sse({ type: 'response.completed', response: { id: 'r1', model: 'gpt-a', usage: { input_tokens: 1, output_tokens: 1 } } })));
        await new Promise((r) => setTimeout(r, holdMs));
        if (!init.signal?.aborted) controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
}

let dir;
let bridge;
let logs;

async function start(fetchImpl) {
  await writeFile(
    join(dir, 'auth.json'),
    JSON.stringify({ clientId: 'oaiapp_test', account: { email: 'p@example.com' }, tokens: { access_token: 'at-1', refresh_token: 'rt-1', token_type: 'Bearer', scope: SCOPES, expires_at: Date.now() + 3_600_000 } }),
  );
  logs = [];
  bridge = createBridge({ port: 0, dataDir: dir, fetch: fetchImpl, log: (e, d) => logs.push(`${e} ${JSON.stringify(d ?? {})}`) });
  await bridge.listen();
}

/** Reads the bridge's stream like the app does: until response.completed, then stops reading (cancel). */
async function readUntil(marker, abortEarlyMs) {
  const controller = new AbortController();
  const res = await fetch(`http://127.0.0.1:${bridge.port}/responses`, {
    method: 'POST',
    headers: { 'x-ygo-bridge': '1', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-a', instructions: 'x', input: 'y' }),
    signal: controller.signal,
  });
  assert.equal(res.status, 200);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = '';
  if (abortEarlyMs !== undefined) setTimeout(() => controller.abort(), abortEarlyMs);
  try {
    while (!text.includes(marker)) {
      const { value, done } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
    }
  } catch {
    // aborted early
  } finally {
    reader.cancel().catch(() => undefined);
  }
  await new Promise((r) => setTimeout(r, 300));
  return text;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ygo-bridge-stream-'));
});
afterEach(async () => {
  await bridge?.close();
  await rm(dir, { recursive: true, force: true });
});

describe('Responses stream end in the event log', () => {
  it('the app closing after response.completed is logged as a normal end, not as an aborted request', async () => {
    await start(fakeOpenAI({ holdMs: 800 }));
    const text = await readUntil('response.completed');
    assert.match(text, /response\.completed/);
    assert.ok(logs.includes('responses.done {"closedByApp":true}'), logs.join('\n'));
    assert.ok(!logs.some((l) => l.startsWith('request.aborted')), logs.join('\n'));
  });

  it('a stream that OpenAI ends by itself is logged as done', async () => {
    await start(fakeOpenAI({ holdMs: 0 }));
    await readUntil('never-present-marker');
    assert.ok(logs.includes('responses.done {}'), logs.join('\n'));
  });

  it('closing before response.completed is still logged as an aborted request', async () => {
    await start(fakeOpenAI({ completeAfterMs: 1500 }));
    const text = await readUntil('response.completed', 200);
    assert.doesNotMatch(text, /response\.completed/);
    assert.ok(logs.some((l) => l.startsWith('request.aborted')), logs.join('\n'));
    assert.ok(!logs.some((l) => l.startsWith('responses.done')), logs.join('\n'));
  });
});
