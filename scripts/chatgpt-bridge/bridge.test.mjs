// CR-005 G28/G29/G30/G31/N23–N26: the bridge against a FAKE OpenAI (injected fetch).
// No request in this file reaches OpenAI; the bridge itself listens on 127.0.0.1 only.
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { API_BASE, AUTHORIZE_URL, ISSUER, JWKS_URL, PLAN_SCOPE, REVOKE_URL, SCOPES, TOKEN_URL, createBridge } from './bridge.mjs';

const KEYS = generateKeyPairSync('rsa', { modulusLength: 2048 });
const OTHER = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-kid';
const ISSUED = 'oaiapp_test_issued';
const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

function idToken(claims, key = KEYS.privateKey, header = { alg: 'RS256', kid: KID, typ: 'JWT' }) {
  const data = `${b64(header)}.${b64(claims)}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), key).toString('base64url')}`;
}

const sse = (events) => events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const STREAM = sse([
  { type: 'response.created', response: { id: 'resp_1' } },
  { type: 'response.output_text.delta', delta: '{"ok":' },
  { type: 'response.output_text.delta', delta: 'true}' },
  { type: 'response.completed', response: { id: 'resp_1', model: 'gpt-test-1', usage: { input_tokens: 100, output_tokens: 20 } } },
]);

/** A fake OpenAI authorization server + API, recording every call. */
function fakeOpenAI(clock) {
  const s = {
    calls: [],
    nonce: null,
    scope: SCOPES,
    sub: 'user-abc',
    aud: null,
    iss: ISSUER,
    expOffset: 3600,
    signWith: KEYS.privateKey,
    tokenError: null,
    refreshError: null,
    refreshStatus: 400,
    revokeStatus: 200,
    issuedTokens: 0,
    models: [
      { slug: 'gpt-b', display_name: 'GPT B', visibility: 'list' },
      { slug: 'gpt-hidden', display_name: 'Hidden', visibility: 'hide' },
      { slug: 'gpt-a', display_name: 'GPT A', visibility: 'list' },
    ],
    responses: () => new Response(STREAM, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  };
  s.fetch = async (url, init = {}) => {
    const u = String(url);
    const body = init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : init.body ? JSON.parse(init.body) : undefined;
    s.calls.push({ url: u, method: init.method ?? 'GET', headers: new Headers(init.headers), body, signal: init.signal });
    if (u === JWKS_URL) return Response.json({ keys: [{ ...KEYS.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] });
    if (u === TOKEN_URL && body.grant_type === 'authorization_code') {
      if (s.tokenError) return Response.json({ error: s.tokenError }, { status: 400 });
      s.issuedTokens++;
      const now = Math.floor(clock() / 1000);
      return Response.json({
        access_token: `at-${s.issuedTokens}`,
        refresh_token: `rt-${s.issuedTokens}`,
        id_token: idToken({ iss: s.iss, aud: s.aud ?? body.client_id, sub: s.sub, email: 'player@example.com', name: 'Player', nonce: s.nonce, iat: now, exp: now + s.expOffset }, s.signWith),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: s.scope,
      });
    }
    if (u === TOKEN_URL && body.grant_type === 'refresh_token') {
      if (s.refreshError) return Response.json({ error: s.refreshError }, { status: s.refreshStatus });
      await new Promise((r) => setTimeout(r, 20));
      s.issuedTokens++;
      return Response.json({ access_token: `at-${s.issuedTokens}`, refresh_token: `rt-${s.issuedTokens}`, token_type: 'Bearer', expires_in: 3600, scope: s.scope });
    }
    if (u === REVOKE_URL) return new Response('', { status: s.revokeStatus });
    if (u === `${API_BASE}/models`) return Response.json({ models: s.models });
    if (u === `${API_BASE}/responses`) return s.responses(body);
    throw new TypeError(`unexpected request to ${u}`);
  };
  return s;
}

let dir;
let clock;
let api;
let bridge;
let logs;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ygo-bridge-'));
  clock = Date.now();
  api = fakeOpenAI(() => clock);
  logs = [];
  bridge = createBridge({ port: 0, dataDir: dir, fetch: api.fetch, now: () => clock, sleep: async () => undefined, log: (e, d) => logs.push(`${e} ${JSON.stringify(d ?? {})}`) });
  await bridge.listen();
});

afterEach(async () => {
  await bridge.close();
  await rm(dir, { recursive: true, force: true });
});

const base = () => `http://127.0.0.1:${bridge.port}`;
const call = (path, init = {}) => fetch(base() + path, { ...init, headers: { 'x-ygo-bridge': '1', ...(init.method === 'POST' ? { 'content-type': 'application/json' } : {}), ...init.headers } });
const getJson = async (path, init) => (await call(path, init)).json();

async function start() {
  const { authorizeUrl } = await getJson('/auth/start', { method: 'POST' });
  const url = new URL(authorizeUrl);
  api.nonce = url.searchParams.get('nonce');
  return url;
}

async function callback(params) {
  const res = await fetch(`${base()}/auth/callback?${new URLSearchParams(params)}`);
  return { status: res.status, html: await res.text() };
}

async function signIn(extra = {}) {
  const url = await start();
  const r = await callback({ code: 'code-1', state: url.searchParams.get('state'), client_id: ISSUED, ...extra });
  assert.equal(r.status, 200, r.html);
  return url;
}

const tokenCalls = () => api.calls.filter((c) => c.url === TOKEN_URL);
const saved = async () => JSON.parse(await readFile(join(dir, 'auth.json'), 'utf8'));

describe('G28 official sign-in (OAuth + PKCE S256, loopback callback, dynamic registration)', () => {
  it('builds the documented authorize request; the host ID is opaque and persisted before sign-in', async () => {
    const url = await start();
    assert.equal(`${url.origin}${url.pathname}`, AUTHORIZE_URL);
    const p = url.searchParams;
    assert.equal(p.get('response_type'), 'code');
    assert.equal(p.get('client_id'), 'dynamic_agent_client');
    assert.equal(p.get('agent_name_hint'), 'YGO Combo Assistant');
    assert.equal(p.get('redirect_uri'), `http://127.0.0.1:${bridge.port}/auth/callback`);
    assert.equal(p.get('scope'), 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct');
    assert.equal(p.get('resource'), 'https://api.openai.com/v1');
    assert.equal(p.get('code_challenge_method'), 'S256');
    assert.match(p.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
    assert.match(p.get('ext_agent_host_id'), /^urn:uuid:[0-9a-f-]{36}$/);
    const host = JSON.parse(await readFile(join(dir, 'host.json'), 'utf8'));
    assert.equal(host.hostId, p.get('ext_agent_host_id'));
    const again = await start();
    assert.equal(again.searchParams.get('ext_agent_host_id'), host.hostId);
    assert.notEqual(again.searchParams.get('state'), p.get('state'));
    assert.notEqual(again.searchParams.get('nonce'), p.get('nonce'));
  });

  it('exchanges the code with the issued client ID and the PKCE verifier, validates the ID token, saves the tokens', async () => {
    const url = await signIn();
    const [exchange] = tokenCalls();
    assert.equal(exchange.method, 'POST');
    assert.equal(exchange.headers.get('content-type'), 'application/x-www-form-urlencoded');
    assert.deepEqual(Object.keys(exchange.body).sort(), ['client_id', 'code', 'code_verifier', 'grant_type', 'redirect_uri', 'resource']);
    assert.equal(exchange.body.grant_type, 'authorization_code');
    assert.equal(exchange.body.client_id, ISSUED);
    assert.equal(exchange.body.redirect_uri, url.searchParams.get('redirect_uri'));
    assert.equal(exchange.body.resource, API_BASE);
    const challenge = createHash('sha256').update(exchange.body.code_verifier).digest('base64url');
    assert.equal(challenge, url.searchParams.get('code_challenge'));

    const record = await saved();
    assert.equal(record.clientId, ISSUED);
    assert.equal(record.tokens.access_token, 'at-1');
    assert.equal(record.tokens.refresh_token, 'rt-1');
    assert.deepEqual(record.account, { sub: 'user-abc', email: 'player@example.com', name: 'Player' });
    if (process.platform !== 'win32') assert.equal((await stat(join(dir, 'auth.json'))).mode & 0o777, 0o600);

    const status = await getJson('/status');
    assert.deepEqual({ signedIn: status.signedIn, sharing: status.sharing, account: status.account }, { signedIn: true, sharing: true, account: { email: 'player@example.com', name: 'Player' } });
    const text = JSON.stringify(status);
    for (const secret of ['at-1', 'rt-1', record.tokens.id_token]) assert.ok(!text.includes(secret));
  });

  it('a second sign-in reuses the issued client ID and does not send agent_name_hint', async () => {
    await signIn();
    const url = await start();
    assert.equal(url.searchParams.get('client_id'), ISSUED);
    assert.equal(url.searchParams.get('agent_name_hint'), null);
    const r = await callback({ code: 'code-2', state: url.searchParams.get('state') });
    assert.equal(r.status, 200);
    assert.equal(tokenCalls().at(-1).body.client_id, ISSUED);
  });
});

describe('N23 sign-in failures never exchange or save', () => {
  it('state mismatch, access_denied and a missing issued client ID stop before the exchange', async () => {
    let url = await start();
    assert.equal((await callback({ code: 'x', state: 'forged', client_id: ISSUED })).status, 400);
    assert.equal((await getJson('/status')).lastError.code, 'state_mismatch');
    assert.equal((await callback({ error: 'access_denied', state: url.searchParams.get('state') })).status, 400);
    assert.equal((await getJson('/status')).lastError.code, 'access_denied');
    url = await start();
    assert.equal((await callback({ code: 'x', state: url.searchParams.get('state') })).status, 400);
    assert.equal((await getJson('/status')).lastError.code, 'registration_incomplete');
    assert.equal(tokenCalls().length, 0);
  });

  for (const [label, patch, message] of [
    ['bad signature', { signWith: OTHER.privateKey }, '簽章驗證失敗'],
    ['wrong issuer', { iss: 'https://evil.example' }, 'issuer'],
    ['wrong audience', { aud: 'someone-else' }, 'audience'],
    ['expired', { expOffset: -10 }, '已過期'],
  ]) {
    it(`ID token ${label} → not saved`, async () => {
      Object.assign(api, patch);
      const url = await start();
      const r = await callback({ code: 'c', state: url.searchParams.get('state'), client_id: ISSUED });
      assert.equal(r.status, 400);
      assert.match(r.html, new RegExp(message));
      assert.equal((await saved()).tokens, null);
      assert.equal((await getJson('/status')).signedIn, false);
    });
  }

  it('ID token nonce mismatch → not saved', async () => {
    const url = await start();
    api.nonce = 'another-nonce';
    assert.equal((await callback({ code: 'c', state: url.searchParams.get('state'), client_id: ISSUED })).status, 400);
    assert.equal((await getJson('/status')).lastError.message, 'ID Token 的 nonce 不符');
  });

  it('invalid_grant on exchange and a different client ID on reauthorization are rejected', async () => {
    api.tokenError = 'invalid_grant';
    let url = await start();
    assert.equal((await callback({ code: 'c', state: url.searchParams.get('state'), client_id: ISSUED })).status, 400);
    assert.equal((await getJson('/status')).lastError.message, '授權碼已失效，請重新登入');
    assert.equal((await saved()).clientId, ISSUED); // saved before the exchange, reused next time
    api.tokenError = null;
    url = await start();
    assert.equal(url.searchParams.get('client_id'), ISSUED);
    assert.equal((await callback({ code: 'c', state: url.searchParams.get('state'), client_id: 'oaiapp_other' })).status, 400);
    assert.equal((await getJson('/status')).lastError.code, 'client_mismatch');
  });
});

describe('N24 / G30 plan usage scope and model list', () => {
  it('without chatgpt.tokens.use.direct the user is signed in but cannot list models or infer', async () => {
    api.scope = 'openid profile email offline_access';
    await signIn();
    const status = await getJson('/status');
    assert.deepEqual([status.signedIn, status.sharing], [true, false]);
    const res = await call('/models');
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error.code, 'sharing_disabled');
    assert.equal(api.calls.filter((c) => c.url.startsWith(API_BASE)).length, 0);
  });

  it('lists only visibility=list models in the server order, with the bearer token sent only to OpenAI', async () => {
    await signIn();
    assert.deepEqual(await getJson('/models'), { models: [{ slug: 'gpt-b', displayName: 'GPT B' }, { slug: 'gpt-a', displayName: 'GPT A' }] });
    const m = api.calls.find((c) => c.url === `${API_BASE}/models`);
    assert.equal(m.headers.get('authorization'), 'Bearer at-1');
  });

  it('not signed in → 401 for models and responses', async () => {
    assert.equal((await call('/models')).status, 401);
    assert.equal((await call('/responses', { method: 'POST', body: JSON.stringify({ model: 'm', instructions: 'i', input: 'x' }) })).status, 401);
  });
});

describe('G31 Responses requests', () => {
  const ask = (body) => call('/responses', { method: 'POST', body: JSON.stringify(body) });
  const SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };

  it('sends only store:false, stream:true, instructions and an input array; unsupported fields never pass', async () => {
    await signIn();
    const res = await ask({ model: 'gpt-a', instructions: 'SYS', input: 'USER', schema: SCHEMA, temperature: 0, max_output_tokens: 9, metadata: { a: 1 }, previous_response_id: 'r', background: true, store: true, user: 'u' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-ygo-structured-output'), 'true');
    assert.equal(res.headers.get('access-control-allow-origin'), null);
    assert.equal(await res.text(), STREAM);
    const up = api.calls.find((c) => c.url === `${API_BASE}/responses`);
    assert.equal(up.headers.get('authorization'), 'Bearer at-1');
    assert.deepEqual(Object.keys(up.body).sort(), ['input', 'instructions', 'model', 'store', 'stream', 'text']);
    assert.equal(up.body.store, false);
    assert.equal(up.body.stream, true);
    assert.deepEqual(up.body.input, [{ role: 'user', content: [{ type: 'input_text', text: 'USER' }] }]);
    assert.deepEqual(up.body.text, { format: { type: 'json_schema', name: 'ygo_deck_analysis', schema: SCHEMA, strict: true } });
  });

  it('an unsupported text format is removed and sent once more; other errors pass through with code and param', async () => {
    await signIn();
    let n = 0;
    api.responses = (body) => (n++ === 0 && body.text ? Response.json({ error: { code: 'subscription_sharing_unsupported_capability', message: 'text.format unsupported', param: 'text.format' } }, { status: 400 }) : new Response(STREAM, { status: 200 }));
    const res = await ask({ model: 'gpt-a', instructions: 'S', input: 'U', schema: SCHEMA });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-ygo-structured-output'), 'false');
    const ups = api.calls.filter((c) => c.url === `${API_BASE}/responses`);
    assert.equal(ups.length, 2);
    assert.equal(ups[1].body.text, undefined);

    api.responses = () => Response.json({ error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'limit' } }, { status: 429, headers: { 'x-request-id': 'req_9' } });
    const limited = await ask({ model: 'gpt-a', instructions: 'S', input: 'U', schema: SCHEMA });
    assert.equal(limited.status, 429);
    assert.deepEqual((await limited.json()).error, { code: 'subscription_sharing_usage_limit_exceeded', message: 'limit', param: null, requestId: 'req_9' });
    api.responses = () => Response.json({ error: { code: 'subscription_sharing_unsupported_capability', message: 'no', param: 'model' } }, { status: 400 });
    const unsupported = await ask({ model: 'gpt-a', instructions: 'S', input: 'U' });
    assert.equal(unsupported.status, 400);
    assert.equal((await unsupported.json()).error.param, 'model');
  });

  it('a client disconnect aborts the upstream request', async () => {
    await signIn();
    api.responses = () =>
      new Promise((_, reject) => {
        api.calls.at(-1).signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    const controller = new AbortController();
    const req = call('/responses', { method: 'POST', body: JSON.stringify({ model: 'gpt-a', instructions: 'S', input: 'U' }), signal: controller.signal }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 100));
    controller.abort();
    await req;
    await new Promise((r) => setTimeout(r, 100));
    const signals = api.calls.filter((c) => c.url === `${API_BASE}/responses`).map((c) => c.signal.aborted);
    assert.ok(signals.includes(true));
  });
});

describe('G29 tokens: refresh, rotation, logout', () => {
  it('refreshes near expiry once for concurrent requests, without scope, and stores the rotated token', async () => {
    await signIn();
    clock += 3600 * 1000 - 60 * 1000; // one minute before expiry
    await Promise.all([call('/models'), call('/models'), call('/models')]);
    const refreshes = tokenCalls().filter((c) => c.body.grant_type === 'refresh_token');
    assert.equal(refreshes.length, 1);
    assert.deepEqual(Object.keys(refreshes[0].body).sort(), ['client_id', 'grant_type', 'refresh_token', 'resource']);
    assert.equal(refreshes[0].body.client_id, ISSUED);
    assert.equal(refreshes[0].body.refresh_token, 'rt-1');
    const record = await saved();
    assert.equal(record.tokens.refresh_token, 'rt-2');
    assert.ok(api.calls.filter((c) => c.url === `${API_BASE}/models`).every((c) => c.headers.get('authorization') === 'Bearer at-2'));
  });

  it('a terminal refresh error clears the tokens but keeps the registration; a 5xx keeps the tokens', async () => {
    await signIn();
    clock += 3600 * 1000;
    api.refreshError = 'server_error';
    api.refreshStatus = 503;
    assert.equal((await call('/models')).status, 503);
    assert.equal((await saved()).tokens.refresh_token, 'rt-1');
    api.refreshError = 'refresh_token_reused';
    api.refreshStatus = 400;
    const res = await call('/models');
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, 'reauth_required');
    const record = await saved();
    assert.equal(record.tokens, null);
    assert.equal(record.clientId, ISSUED);
  });

  it('logout revokes the refresh token, then clears it; registration and host ID stay', async () => {
    await signIn();
    const hostBefore = await readFile(join(dir, 'host.json'), 'utf8');
    assert.deepEqual(await getJson('/auth/logout', { method: 'POST' }), { revoked: true });
    const revoke = api.calls.find((c) => c.url === REVOKE_URL);
    assert.deepEqual(revoke.body, { token: 'rt-1', token_type_hint: 'refresh_token', client_id: ISSUED });
    const record = await saved();
    assert.equal(record.tokens, null);
    assert.equal(record.clientId, ISSUED);
    assert.equal(await readFile(join(dir, 'host.json'), 'utf8'), hostBefore);
    assert.equal((await getJson('/status')).signedIn, false);
  });

  it('when revocation cannot be confirmed the tokens are still cleared and the user is told', async () => {
    await signIn();
    api.revokeStatus = 503;
    const result = await getJson('/auth/logout', { method: 'POST' });
    assert.equal(result.revoked, false);
    assert.match(result.message, /ChatGPT 設定/);
    assert.equal(api.calls.filter((c) => c.url === REVOKE_URL).length, 3);
    assert.equal((await saved()).tokens, null);
  });
});

describe('N26 bridge protection', () => {
  const raw = (headers, path = '/status') =>
    new Promise((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: bridge.port, path, headers }, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject);
      req.end();
    });

  it('rejects a foreign Host (DNS rebinding), a foreign Origin and requests without the bridge header', async () => {
    assert.equal(await raw({ host: `evil.example:${bridge.port}`, 'x-ygo-bridge': '1' }), 403);
    assert.equal(await raw({ host: `localhost:${bridge.port}`, 'x-ygo-bridge': '1' }), 403);
    assert.equal(await raw({ host: `127.0.0.1:${bridge.port}`, 'x-ygo-bridge': '1', origin: 'https://evil.example' }), 403);
    assert.equal(await raw({ host: `127.0.0.1:${bridge.port}` }), 403);
    assert.equal(await raw({ host: `127.0.0.1:${bridge.port}`, 'x-ygo-bridge': '1', origin: 'http://localhost:4200' }), 200);
  });

  it('rejects oversized bodies', async () => {
    await signIn();
    const res = await call('/responses', { method: 'POST', body: JSON.stringify({ model: 'm', instructions: 'i', input: 'x'.repeat(2 * 1024 * 1024 + 10) }) });
    assert.equal(res.status, 413);
  });

  it('logs never contain tokens, codes, verifiers or URLs', async () => {
    await signIn();
    await call('/models');
    clock += 3600 * 1000;
    await call('/models');
    await call('/auth/logout', { method: 'POST' });
    const text = logs.join('\n');
    for (const secret of ['at-1', 'at-2', 'rt-1', 'rt-2', 'code-1', 'https://', 'Bearer']) assert.ok(!text.includes(secret), `log contains ${secret}`);
    assert.ok(text.includes('signin.done'));
    assert.ok(!text.includes(PLAN_SCOPE + ' '));
  });
});

// CR-011: checks against the official "ChatGPT plan usage" pages as read on 2026-10-11
// (developers.openai.com/siwc/token-sharing-open-source: sign-in, models-and-inference, errors-and-recovery,
// preview-limitations). Still a FAKE OpenAI: this proves what the bridge sends, not that OpenAI accepts it —
// that needs the user's real sign-in (docs/acceptance-desktop-v1-rev1.md, CG1–CG3).
describe('CR-011 official conformance', () => {
  const idTokenOf = (u) => u.searchParams.get('id_token_hint');
  const decode = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));

  it('reauthorization carries id_token_hint and login_hint for the same account; a new registration and a sign-out do not', async () => {
    const first = await start();
    assert.equal(idTokenOf(first), null, 'a new registration has no hint');
    assert.equal(first.searchParams.get('login_hint'), null);
    await callback({ code: 'code-1', state: first.searchParams.get('state'), client_id: ISSUED });

    // The access token can no longer be refreshed: tokens are cleared, but the last ID token is kept as the hint.
    clock += 3600 * 1000;
    api.refreshError = 'refresh_token_reused';
    api.refreshStatus = 400;
    assert.equal((await call('/models')).status, 401);
    assert.equal((await saved()).tokens, null);

    const again = await start();
    assert.equal(again.searchParams.get('client_id'), ISSUED);
    const hint = idTokenOf(again);
    assert.ok(hint, 'id_token_hint is required on reauthorization');
    assert.equal(again.searchParams.get('login_hint'), 'player@example.com');
    assert.equal(decode(hint).sub, 'user-abc');
    assert.equal(decode(hint).email, again.searchParams.get('login_hint'), 'both hints refer to the same account');
    assert.equal(again.searchParams.get('agent_name_hint'), null);

    // After sign-out nothing is kept.
    await callback({ code: 'code-2', state: again.searchParams.get('state') });
    await call('/auth/logout', { method: 'POST' });
    const afterLogout = await start();
    assert.equal(idTokenOf(afterLogout), null);
    assert.equal(afterLogout.searchParams.get('login_hint'), null);
    assert.equal((await saved()).idTokenHint, undefined);
  });

  it('stores the verified identity (issuer, subject, email), client ID, scopes and save time; the host ID stays with the runtime', async () => {
    await signIn();
    const record = await saved();
    assert.equal(record.issuer, ISSUER);
    assert.equal(record.account.sub, 'user-abc');
    assert.equal(record.account.email, 'player@example.com');
    assert.equal(record.clientId, ISSUED);
    assert.ok(record.tokens.id_token && record.tokens.access_token && record.tokens.refresh_token);
    assert.equal(record.tokens.token_type, 'Bearer');
    assert.ok(record.tokens.scope.split(' ').includes(PLAN_SCOPE));
    assert.ok(Number.isFinite(Date.parse(record.updatedAt)), 'saved_at');
    const host = JSON.parse(await readFile(join(dir, 'host.json'), 'utf8'));
    assert.match(host.hostId, /^urn:uuid:[0-9a-f-]{36}$/);
    assert.ok(!JSON.stringify(host).includes('player@example.com'), 'the host ID must not identify the user');
  });

  it('every inference request is exactly store:false, stream:true, instructions and a role/content input array — none of the documented unsupported fields', async () => {
    await signIn();
    const hostile = {
      model: 'gpt-a',
      instructions: 'sys',
      input: 'hi',
      schema: { type: 'object' },
      // Every field the preview-limitations page says to omit, plus the ones that would escape plan usage:
      background: true, conversation: 'c', max_output_tokens: 99, max_tool_calls: 1, metadata: { a: 1 }, moderation: 'x', multi_agent: true, prompt: {}, prompt_cache_retention: 'x',
      safety_identifier: 's', temperature: 0, top_logprobs: 1, top_p: 1, truncation: 'auto', user: 'u', previous_response_id: 'resp_0', tools: [{ type: 'web_search' }], service_tier: 'priority',
    };
    const res = await call('/responses', { method: 'POST', body: JSON.stringify(hostile) });
    assert.equal(res.status, 200);
    await res.text();
    const sent = api.calls.find((c) => c.url === `${API_BASE}/responses`).body;
    assert.deepEqual(Object.keys(sent).sort(), ['input', 'instructions', 'model', 'store', 'stream', 'text']);
    assert.equal(sent.store, false);
    assert.equal(sent.stream, true);
    assert.ok(Array.isArray(sent.input) && sent.input.length === 1);
    assert.deepEqual(Object.keys(sent.input[0]).sort(), ['content', 'role']);
    assert.notEqual(sent.input[0].role, 'system');
    assert.equal(typeof sent.instructions, 'string');
  });

  it('never leaves plan usage: no API key is read or sent, no other endpoint is used, and it never falls back when plan usage is off', async () => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test-must-never-be-used-0123456789abcdef';
    try {
      await signIn();
      await call('/models');
      await (await call('/responses', { method: 'POST', body: JSON.stringify({ model: 'gpt-a', instructions: 'i', input: 'x' }) })).text();
      for (const c of api.calls) {
        assert.ok(c.url.startsWith(`${ISSUER}/`) || c.url.startsWith(`${API_BASE}/`), `unexpected host: ${c.url}`);
        assert.ok(!c.url.includes('backend-api'), 'ChatGPT backend-api must not be used');
        assert.ok(!(c.headers.get('authorization') ?? '').includes('sk-'), 'an API key was sent');
        if (c.headers.get('authorization')) assert.match(c.headers.get('authorization'), /^Bearer at-\d+$/);
      }
      const inference = api.calls.filter((c) => c.url.startsWith(`${API_BASE}/`)).map((c) => `${c.method} ${c.url.slice(API_BASE.length)}`);
      assert.deepEqual([...new Set(inference)].sort(), ['GET /models', 'POST /responses']);
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });

  it('signed in without the plan-usage scope: inference is refused locally and nothing is sent to OpenAI (no paid fallback)', async () => {
    api.scope = 'openid profile email offline_access resource.invoke';
    await signIn();
    const before = api.calls.length;
    const res = await call('/responses', { method: 'POST', body: JSON.stringify({ model: 'gpt-a', instructions: 'i', input: 'x' }) });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error.code, 'sharing_disabled');
    assert.equal(api.calls.length, before, 'a request left the bridge although plan usage is not granted');
    assert.equal((await call('/models')).status, 403);
    assert.equal(api.calls.filter((c) => c.url === `${API_BASE}/responses` || c.url === `${API_BASE}/models`).length, 0);
  });

  it('pre-stream errors with only {"detail": ...} are passed on as diagnostics with their status, and credentials are kept', async () => {
    await signIn();
    for (const status of [401, 403, 503]) {
      api.responses = () => new Response(JSON.stringify({ detail: `blocked ${status}` }), { status, headers: { 'content-type': 'application/json', 'x-request-id': 'req-1' } });
      const res = await call('/responses', { method: 'POST', body: JSON.stringify({ model: 'gpt-a', instructions: 'i', input: 'x' }) });
      assert.equal(res.status, status);
      const body = await res.json();
      assert.equal(body.error.code, null);
      assert.match(body.error.message, new RegExp(`blocked ${status}`));
      assert.equal(body.error.requestId, 'req-1');
    }
    assert.equal((await saved()).tokens.refresh_token, 'rt-1', 'a temporary or policy error must not discard credentials');
  });

  it('the documented structured errors keep their code and param (usage limit, not eligible, unsupported capability, route, user, scope)', async () => {
    await signIn();
    const cases = [
      [429, 'subscription_sharing_usage_limit_exceeded', null],
      [403, 'subscription_sharing_user_not_eligible', null],
      [400, 'subscription_sharing_unsupported_capability', 'tools[0]'],
      [403, 'subscription_sharing_route_not_supported', null],
      [401, 'subscription_sharing_invalid_user', null],
      [403, 'chatpass_v2_scope_not_authorized', null],
      [503, 'subscription_sharing_usage_unavailable', null],
      [503, 'subscription_sharing_user_unavailable', null],
    ];
    for (const [status, code, param] of cases) {
      let sends = 0;
      api.responses = () => {
        sends++;
        return Response.json({ error: { code, message: 'm', param } }, { status });
      };
      const res = await call('/responses', { method: 'POST', body: JSON.stringify({ model: 'gpt-a', instructions: 'i', input: 'x' }) });
      assert.equal(res.status, status, code);
      const body = (await res.json()).error;
      assert.equal(body.code, code);
      assert.equal(body.param, param);
      assert.equal(sends, 1, `${code}: the same body must not be sent again`);
    }
    assert.equal((await saved()).tokens.refresh_token, 'rt-1');
  });
});

// Switch account: a client ID is bound to the account that registered it, so another account starts a new
// registration (dynamic_agent_client + agent_name_hint), with the same host ID.
describe('switch account', () => {
  it('sign-out with forget drops the registration; the next sign-in registers anew with the same host ID', async () => {
    const first = await signIn();
    const hostId = first.searchParams.get('ext_agent_host_id');
    assert.deepEqual(await getJson('/auth/logout', { method: 'POST', body: JSON.stringify({ forget: true }) }), { revoked: true });
    const record = await saved();
    assert.equal(record.clientId, null);
    assert.equal(record.tokens, null);
    assert.equal(record.account, null);
    const next = await start();
    assert.equal(next.searchParams.get('client_id'), 'dynamic_agent_client');
    assert.equal(next.searchParams.get('agent_name_hint'), 'YGO Combo Assistant');
    assert.equal(next.searchParams.get('ext_agent_host_id'), hostId);
    assert.equal(next.searchParams.get('id_token_hint'), null);
    // A different account can now complete sign-in (no account-mismatch rejection).
    api.sub = 'user-other';
    const r = await callback({ code: 'code-9', state: next.searchParams.get('state'), client_id: 'oaiapp_other' });
    assert.equal(r.status, 200, r.html);
    assert.equal((await saved()).account.sub, 'user-other');
    assert.equal((await saved()).clientId, 'oaiapp_other');
  });

  it('a plain sign-out keeps the registration, so the same account signs in again with its client ID', async () => {
    await signIn();
    await call('/auth/logout', { method: 'POST' });
    assert.equal((await saved()).clientId, ISSUED);
    const again = await start();
    assert.equal(again.searchParams.get('client_id'), ISSUED);
  });

  it('without forget a different account is still refused (it would reuse another account\'s registration)', async () => {
    await signIn();
    clock += 3600 * 1000;
    api.refreshError = 'refresh_token_reused';
    await call('/models');
    const again = await start();
    api.sub = 'user-other';
    const r = await callback({ code: 'code-3', state: again.searchParams.get('state') });
    assert.equal(r.status, 400);
    assert.match(r.html, /帳號不同/);
  });
});
