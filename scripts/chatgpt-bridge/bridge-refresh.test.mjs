// Token refresh across processes and at shutdown, against a FAKE OpenAI whose refresh tokens rotate and are single-use
// (a reused one is answered with `refresh_token_reused`, which clears the sign-in). No request reaches OpenAI.
// Background: on the installed app a real sign-in was lost at its first refresh; the official guidance is to
// "serialize refreshes for the same session so two processes do not race a rotating token".
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { API_BASE, SCOPES, TOKEN_URL, createBridge } from './bridge.mjs';
import { EVENT_LOG_NAME, createEventLog } from './event-log.mjs';

const ISSUED = 'oaiapp_test_issued';

/** One fake authorization server shared by every bridge in a test (like the real one). */
function fakeOpenAI({ refreshDelayMs = 50 } = {}) {
  const s = { valid: new Set(['rt-1']), issued: 1, refreshes: [], reused: 0 };
  s.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u === TOKEN_URL) {
      const body = Object.fromEntries(init.body);
      s.refreshes.push(body.refresh_token);
      await new Promise((r) => setTimeout(r, refreshDelayMs));
      if (!s.valid.has(body.refresh_token)) {
        s.reused++;
        return Response.json({ error: 'refresh_token_reused' }, { status: 400 });
      }
      s.valid.delete(body.refresh_token); // single use: rotated on every successful refresh
      s.issued++;
      s.valid.add(`rt-${s.issued}`);
      return Response.json({ access_token: `at-${s.issued}`, refresh_token: `rt-${s.issued}`, token_type: 'Bearer', expires_in: 3600, scope: SCOPES });
    }
    if (u === `${API_BASE}/models`) return Response.json({ models: [{ slug: 'gpt-a', display_name: 'GPT A', visibility: 'list' }] });
    throw new TypeError(`unexpected request to ${u}`);
  };
  return s;
}

let dir;
const bridges = [];

async function signedInFolder(expiresInMs) {
  await writeFile(
    join(dir, 'auth.json'),
    JSON.stringify({
      clientId: ISSUED,
      account: { email: 'player@example.com', name: 'Player' },
      tokens: { access_token: 'at-1', refresh_token: 'rt-1', token_type: 'Bearer', scope: SCOPES, expires_at: Date.now() + expiresInMs },
    }),
  );
}

async function startBridge(api, extra = {}) {
  const b = createBridge({ port: 0, dataDir: dir, fetch: api.fetch, log: () => undefined, ...extra });
  await b.listen();
  bridges.push(b);
  return b;
}

const models = (b) => fetch(`http://127.0.0.1:${b.port}/models`, { headers: { 'x-ygo-bridge': '1' } });
const saved = async () => JSON.parse(await readFile(join(dir, 'auth.json'), 'utf8'));

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ygo-bridge-refresh-'));
});

afterEach(async () => {
  for (const b of bridges.splice(0)) await b.close();
  await rm(dir, { recursive: true, force: true });
});

describe('token refresh across processes and at shutdown', () => {
  it('two services sharing one sign-in refresh it once; neither presents a used refresh token and both stay signed in', async () => {
    await signedInFolder(60_000); // inside the refresh margin
    const api = fakeOpenAI();
    const [a, b] = [await startBridge(api), await startBridge(api)];
    const [ra, rb] = await Promise.all([models(a), models(b)]);
    assert.equal(ra.status, 200);
    assert.equal(rb.status, 200);
    assert.deepEqual(api.refreshes, ['rt-1']);
    assert.equal(api.reused, 0);
    const record = await saved();
    assert.equal(record.tokens.refresh_token, 'rt-2');
    assert.equal(record.tokens.access_token, 'at-2');
  });

  it('a lock left behind by a killed process is taken over once it is stale', async () => {
    await signedInFolder(60_000);
    const lock = join(dir, 'refresh.lock');
    await writeFile(lock, '{"pid":1}');
    const old = new Date(Date.now() - 120_000);
    await utimes(lock, old, old);
    const api = fakeOpenAI();
    const a = await startBridge(api);
    assert.equal((await models(a)).status, 200);
    assert.deepEqual(api.refreshes, ['rt-1']);
    assert.equal((await saved()).tokens.refresh_token, 'rt-2');
  });

  it('a fresh lock held by another process makes the request wait, then use the tokens that process saved', async () => {
    await signedInFolder(60_000);
    const lock = join(dir, 'refresh.lock');
    await writeFile(lock, '{"pid":1}');
    const api = fakeOpenAI();
    const a = await startBridge(api);
    const pending = models(a);
    await new Promise((r) => setTimeout(r, 300));
    // The "other process" finishes its refresh: new tokens saved, lock released.
    api.valid.delete('rt-1');
    api.valid.add('rt-9');
    await writeFile(
      join(dir, 'auth.json'),
      JSON.stringify({ clientId: ISSUED, account: { email: 'player@example.com', name: 'Player' }, tokens: { access_token: 'at-9', refresh_token: 'rt-9', token_type: 'Bearer', scope: SCOPES, expires_at: Date.now() + 3_600_000 } }),
    );
    await rm(lock);
    assert.equal((await pending).status, 200);
    assert.deepEqual(api.refreshes, []); // it did not refresh again with the used token
    assert.equal((await saved()).tokens.refresh_token, 'rt-9');
  });

  it('the desktop event log explains a lost sign-in (status and OpenAI error code) and never contains a token', async () => {
    await signedInFolder(60_000);
    const api = fakeOpenAI();
    api.valid.delete('rt-1'); // already used elsewhere
    const a = await startBridge(api, { log: createEventLog(dir) });
    assert.equal((await models(a)).status, 401);
    const text = await readFile(join(dir, EVENT_LOG_NAME), 'utf8');
    assert.match(text, /^\d{4}-\d\d-\d\dT[\d:.]+Z refresh\.failed \{"status":400,"error":"refresh_token_reused"\}$/m);
    assert.doesNotMatch(text, /rt-1|at-1|Bearer|refresh_token"|access_token/);
    assert.equal((await saved()).tokens, null); // the documented recovery: clear the tokens, keep the registration
    assert.equal((await saved()).clientId, ISSUED);
  });

  it('the event log stays small: past the size limit the old file is kept once and a new one starts', async () => {
    const log = createEventLog(dir, 200);
    for (let i = 0; i < 20; i++) log('request.error', { path: '/models', status: 503, code: 'upstream_unreachable' });
    const current = await readFile(join(dir, EVENT_LOG_NAME), 'utf8');
    const older = await readFile(join(dir, `${EVENT_LOG_NAME}.1`), 'utf8');
    assert.ok(current.length <= 200 + 200);
    assert.ok(older.length > 0);
  });

  it('closing the service while a refresh is in flight waits until the rotated token is saved', async () => {
    await signedInFolder(60_000);
    const api = fakeOpenAI({ refreshDelayMs: 400 });
    const a = await startBridge(api);
    const pending = models(a).catch(() => null);
    await new Promise((r) => setTimeout(r, 100));
    bridges.splice(bridges.indexOf(a), 1);
    await a.close();
    await pending;
    assert.deepEqual(api.refreshes, ['rt-1']);
    assert.equal((await saved()).tokens.refresh_token, 'rt-2'); // not left with the used rt-1
  });
});
