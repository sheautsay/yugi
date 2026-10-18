// CR-005: minimal local service for the official "Sign in with ChatGPT" / ChatGPT plan usage
// flow (developers.openai.com/siwc/token-sharing-open-source). It runs the loopback OAuth
// callback, keeps the tokens in a local file, and forwards eligible Responses API requests.
// The Angular app talks to it through the dev-server proxy and never receives a token.
import { createHash, createPublicKey, randomBytes, randomUUID, timingSafeEqual, verify } from 'node:crypto';
import { createServer } from 'node:http';
import { chmod, mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const ISSUER = 'https://auth.openai.com';
export const AUTHORIZE_URL = `${ISSUER}/api/accounts/authorize`;
export const TOKEN_URL = `${ISSUER}/api/accounts/oauth/token`;
export const REVOKE_URL = `${ISSUER}/api/accounts/oauth/revoke`;
export const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
export const API_BASE = 'https://api.openai.com/v1';
export const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
export const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
export const DYNAMIC_CLIENT = 'dynamic_agent_client';
export const APP_NAME = 'YGO Combo Assistant';
export const BRIDGE_HEADER = 'x-ygo-bridge';
/** Desktop mode: a per-launch secret the host app hands to the bridge; see DESKTOP-ROADMAP.md §5.2. */
export const TOKEN_HEADER = 'x-ygo-bridge-token';
export const MIN_TOKEN_LENGTH = 32;
export const DEFAULT_PORT = 47321;

const CALLBACK_PATH = '/auth/callback';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const MAX_BODY = 2 * 1024 * 1024;
/** Refresh errors after which the token set is unusable (errors-and-recovery). */
const TERMINAL_REFRESH = new Set(['invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired', 'refresh_token_invalidated', 'refresh_token_reused']);
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/;
/** The Windows desktop app's WebView origin (Tauri), accepted only together with the per-launch secret. */
const DESKTOP_ORIGIN = /^https?:\/\/tauri\.localhost$/;

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sha256 = (text) => createHash('sha256').update(text).digest();

class BridgeError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/**
 * @param {{ port?: number, token?: string, dataDir: string, fetch?: typeof fetch, now?: () => number,
 *   sleep?: (ms: number) => Promise<void>, log?: (event: string, detail?: object) => void }} options
 */
export function createBridge(options) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  // Only event names, status codes and error codes are ever logged — never tokens, codes or URLs.
  const log = options.log ?? (() => {});
  const files = { host: join(options.dataDir, 'host.json'), auth: join(options.dataDir, 'auth.json'), refreshLock: join(options.dataDir, 'refresh.lock') };
  // Cross-process refresh lock (another app session, or a restarted service, may hold the same credentials).
  const lockWaitMs = options.refreshLockWaitMs ?? 20_000;
  const lockStaleMs = options.refreshLockStaleMs ?? 30_000;

  // Without a token (the V1 `npm run chatgpt-bridge` way) behaviour is unchanged. With one, every request
  // except the browser's OAuth callback must carry it; a missing Origin header is never an authorization.
  const token = options.token;
  if (token !== undefined && (typeof token !== 'string' || token.length < MIN_TOKEN_LENGTH)) throw new Error(`bridge token must be a string of at least ${MIN_TOKEN_LENGTH} characters`);
  const tokenBuffer = token === undefined ? null : Buffer.from(token);
  const tokenOk = (given) => {
    if (!tokenBuffer || typeof given !== 'string') return false;
    const buf = Buffer.from(given);
    return buf.length === tokenBuffer.length && timingSafeEqual(buf, tokenBuffer);
  };

  let port = options.port ?? DEFAULT_PORT;
  let pending = null;
  let lastError = null;
  let refreshing = null;
  let jwks = null;

  // ---- local files (0600, atomic) ----

  async function readJson(file) {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {
      return null;
    }
  }

  async function writeJson(file, value) {
    await mkdir(options.dataDir, { recursive: true, mode: 0o700 });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
    await rename(tmp, file);
    await chmod(file, 0o600).catch(() => undefined); // best effort on Windows (user-profile ACLs apply)
  }

  /** Host ID: opaque urn:uuid, chosen once before the first sign-in and reused (G28-2). */
  async function hostId() {
    const saved = await readJson(files.host);
    if (typeof saved?.hostId === 'string' && saved.hostId.startsWith('urn:uuid:')) return saved.hostId;
    const id = `urn:uuid:${randomUUID()}`;
    await writeJson(files.host, { hostId: id });
    return id;
  }

  const loadAuth = async () => (await readJson(files.auth)) ?? {};
  const saveAuth = (record) => writeJson(files.auth, { ...record, updatedAt: new Date(now()).toISOString() });

  const redirectUri = () => `http://127.0.0.1:${port}${CALLBACK_PATH}`;
  const form = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined));

  async function postForm(url, params) {
    const response = await fetchFn(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form(params) });
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    return { response, body };
  }

  // ---- ID token (RS256 against OpenAI's JWKS) ----

  async function signingKey(kid, retry = true) {
    if (!jwks) {
      const response = await fetchFn(JWKS_URL);
      if (!response.ok) throw new BridgeError(502, 'jwks_unavailable', '無法取得 OpenAI 的簽章金鑰');
      jwks = (await response.json()).keys ?? [];
    }
    const jwk = jwks.find((k) => k.kid === kid);
    if (!jwk && retry) {
      jwks = null;
      return signingKey(kid, false);
    }
    if (!jwk) throw new BridgeError(400, 'id_token_invalid', 'ID Token 的簽章金鑰不明');
    return createPublicKey({ key: jwk, format: 'jwk' });
  }

  async function verifyIdToken(idToken, { clientId, nonce }) {
    const parts = String(idToken ?? '').split('.');
    if (parts.length !== 3) throw new BridgeError(400, 'id_token_invalid', 'ID Token 格式錯誤');
    let header;
    let claims;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new BridgeError(400, 'id_token_invalid', 'ID Token 格式錯誤');
    }
    if (header.alg !== 'RS256') throw new BridgeError(400, 'id_token_invalid', 'ID Token 演算法不是 RS256');
    const key = await signingKey(header.kid);
    const ok = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
    if (!ok) throw new BridgeError(400, 'id_token_invalid', 'ID Token 簽章驗證失敗');
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== ISSUER) throw new BridgeError(400, 'id_token_invalid', 'ID Token 的 issuer 不符');
    if (!aud.includes(clientId)) throw new BridgeError(400, 'id_token_invalid', 'ID Token 的 audience 不是此 App 的 client ID');
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now()) throw new BridgeError(400, 'id_token_invalid', 'ID Token 已過期');
    if (claims.nonce !== nonce) throw new BridgeError(400, 'id_token_invalid', 'ID Token 的 nonce 不符');
    return claims;
  }

  // ---- sign-in ----

  async function startSignIn() {
    const auth = await loadAuth();
    const host = await hostId();
    const verifier = b64url(randomBytes(32));
    const registration = !auth.clientId;
    pending = {
      state: b64url(randomBytes(24)),
      nonce: b64url(randomBytes(24)),
      verifier,
      clientId: auth.clientId ?? DYNAMIC_CLIENT,
      registration,
      redirectUri: redirectUri(),
      createdAt: now(),
    };
    lastError = null;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: pending.clientId,
      redirect_uri: pending.redirectUri,
      scope: SCOPES,
      resource: API_BASE,
      code_challenge: b64url(sha256(verifier)),
      code_challenge_method: 'S256',
      state: pending.state,
      nonce: pending.nonce,
      ext_agent_host_id: host,
    });
    if (registration) params.set('agent_name_hint', APP_NAME);
    // Reauthorization (sign-in guide): the ID token kept from this account's last sign-in, even if expired, and its email.
    // Omitted for a new registration and after sign-out, when none is kept.
    if (!registration && typeof auth.idTokenHint === 'string' && auth.idTokenHint) {
      params.set('id_token_hint', auth.idTokenHint);
      if (auth.account?.email) params.set('login_hint', auth.account.email);
    }
    log('signin.start', { registration });
    return `${AUTHORIZE_URL}?${params}`;
  }

  async function completeSignIn(query) {
    const attempt = pending;
    if (!attempt || now() - attempt.createdAt > PENDING_TTL_MS || query.get('state') !== attempt.state) {
      throw new BridgeError(400, 'state_mismatch', '登入狀態不符或已逾時，請回到 App 重新按「Continue with ChatGPT」');
    }
    pending = null;
    if (query.get('error')) {
      const code = query.get('error');
      throw new BridgeError(400, code, code === 'access_denied' ? '你取消了 ChatGPT 授權，未進行登入' : `ChatGPT 登入失敗（${code}）`);
    }
    const returned = query.get('client_id');
    let clientId = attempt.clientId;
    if (attempt.registration) {
      if (!returned || returned === DYNAMIC_CLIENT) throw new BridgeError(400, 'registration_incomplete', '註冊未完成（沒有收到核發的 client ID），請重新登入');
      clientId = returned;
      // Saved before the code exchange so a later attempt can reuse it (sign-in guide).
      const existing = await loadAuth();
      await saveAuth({ clientId, account: existing.account ?? null, tokens: null });
    } else if (returned && returned !== attempt.clientId) {
      throw new BridgeError(400, 'client_mismatch', '回傳的 client ID 與已註冊的不同，已拒絕');
    }
    const code = query.get('code');
    if (!code) throw new BridgeError(400, 'missing_code', '沒有收到授權碼');

    const { response, body } = await postForm(TOKEN_URL, {
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: attempt.verifier,
      redirect_uri: attempt.redirectUri,
      resource: API_BASE,
    });
    if (!response.ok) {
      log('signin.exchange_failed', { status: response.status, error: body.error });
      throw new BridgeError(400, body.error ?? 'token_exchange_failed', body.error === 'invalid_grant' ? '授權碼已失效，請重新登入' : `交換 Token 失敗（${body.error ?? response.status}）`);
    }
    const claims = await verifyIdToken(body.id_token, { clientId, nonce: attempt.nonce });
    const existing = await loadAuth();
    if (existing.account?.sub && existing.account.sub !== claims.sub && !attempt.registration) {
      throw new BridgeError(400, 'account_mismatch', '登入的帳號與已註冊的帳號不同，已拒絕');
    }
    const scope = body.scope ?? query.get('scope') ?? '';
    await saveAuth({
      clientId,
      account: { sub: claims.sub, email: typeof claims.email === 'string' ? claims.email : null, name: typeof claims.name === 'string' ? claims.name : null },
      tokens: tokenSet(body, null),
      issuer: claims.iss,
      idTokenHint: body.id_token ?? null,
    });
    log('signin.done', { sharing: scope.split(/\s+/).includes(PLAN_SCOPE) });
  }

  function tokenSet(body, previous) {
    return {
      access_token: body.access_token,
      // Rotating refresh tokens: always keep the newest replacement.
      refresh_token: body.refresh_token ?? previous?.refresh_token ?? null,
      id_token: body.id_token ?? previous?.id_token ?? null,
      token_type: body.token_type ?? 'Bearer',
      scope: body.scope ?? previous?.scope ?? '',
      expires_at: now() + (Number(body.expires_in) || 3600) * 1000,
    };
  }

  // ---- tokens ----

  /** A valid access token, refreshing near expiry; refreshes are serialized (one at a time). */
  async function accessToken() {
    const auth = await loadAuth();
    if (!auth.tokens?.access_token) throw new BridgeError(401, 'not_signed_in', '尚未用 ChatGPT 帳號登入');
    if (auth.tokens.expires_at - now() > REFRESH_MARGIN_MS) return { auth, token: auth.tokens.access_token };
    refreshing ??= refreshLocked().finally(() => {
      refreshing = null;
    });
    const next = await refreshing;
    return { auth: next, token: next.tokens.access_token };
  }

  /**
   * Refresh tokens rotate: two processes refreshing the same session at once would present the same refresh token
   * twice, and the second use can invalidate the whole sign-in. The official guidance is to serialize refreshes for
   * the same session across processes and always use the latest replacement, so the refresh runs under a lock file
   * and re-reads the saved tokens inside it — another process may already have refreshed them.
   */
  async function refreshLocked() {
    const release = await acquireRefreshLock();
    try {
      const auth = await loadAuth();
      if (!auth.tokens?.access_token) throw new BridgeError(401, 'not_signed_in', '尚未用 ChatGPT 帳號登入');
      if (auth.tokens.expires_at - now() > REFRESH_MARGIN_MS) return auth; // refreshed meanwhile by someone else
      return await refresh(auth);
    } finally {
      await release();
    }
  }

  async function acquireRefreshLock() {
    await mkdir(options.dataDir, { recursive: true, mode: 0o700 });
    const started = now();
    // Bounded by attempts too, so an injected clock or sleep (tests) can never make this wait forever.
    for (let attempt = 0; ; attempt++) {
      try {
        const handle = await open(files.refreshLock, 'wx', 0o600);
        await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date(now()).toISOString() }));
        await handle.close();
        return () => unlink(files.refreshLock).catch(() => undefined);
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        const info = await stat(files.refreshLock).catch(() => null);
        if (info && now() - info.mtimeMs > lockStaleMs) {
          log('refresh.lock_stale');
          await unlink(files.refreshLock).catch(() => undefined);
          continue;
        }
        if (now() - started > lockWaitMs || attempt > lockWaitMs / 100) throw new BridgeError(503, 'refresh_busy', '另一個程式正在更新 ChatGPT 登入，請稍後再試');
        await sleep(100);
      }
    }
  }

  async function refresh(auth) {
    if (!auth.tokens?.refresh_token) {
      await saveAuth({ ...auth, tokens: null });
      throw new BridgeError(401, 'reauth_required', 'ChatGPT 登入已過期，請重新登入');
    }
    let result;
    try {
      result = await postForm(TOKEN_URL, { grant_type: 'refresh_token', client_id: auth.clientId, refresh_token: auth.tokens.refresh_token, resource: API_BASE });
    } catch {
      throw new BridgeError(503, 'refresh_unavailable', '暫時無法更新 ChatGPT 登入（網路），請稍後再試');
    }
    const { response, body } = result;
    if (!response.ok) {
      log('refresh.failed', { status: response.status, error: body.error });
      if (TERMINAL_REFRESH.has(body.error)) {
        await saveAuth({ ...auth, tokens: null });
        throw new BridgeError(401, 'reauth_required', 'ChatGPT 登入已失效，請重新登入');
      }
      throw new BridgeError(response.status >= 500 ? 503 : 400, body.error ?? 'refresh_failed', `暫時無法更新 ChatGPT 登入（${body.error ?? response.status}）`);
    }
    const next = { ...auth, tokens: tokenSet(body, auth.tokens) };
    next.idTokenHint = next.tokens.id_token ?? auth.idTokenHint ?? null;
    await saveAuth(next);
    log('refresh.done');
    return next;
  }

  async function status() {
    const auth = await loadAuth();
    const scope = auth.tokens?.scope ?? '';
    return {
      ok: true,
      signedIn: !!auth.tokens?.access_token,
      sharing: !!auth.tokens?.access_token && scope.split(/\s+/).includes(PLAN_SCOPE),
      account: auth.tokens && auth.account ? { email: auth.account.email, name: auth.account.name } : null,
      expiresAt: auth.tokens?.expires_at ? new Date(auth.tokens.expires_at).toISOString() : null,
      registered: !!auth.clientId,
      pending: !!pending && now() - pending.createdAt <= PENDING_TTL_MS,
      lastError,
    };
  }

  /**
   * Signs out and revokes. `forget` ("switch account") also drops the issued client ID: a client ID is bound to the
   * account and workspace that registered it, so another account must start a new registration. The host ID stays.
   */
  async function signOut({ forget = false } = {}) {
    const auth = await loadAuth();
    const refreshToken = auth.tokens?.refresh_token;
    let revoked = !refreshToken;
    for (let attempt = 0; refreshToken && attempt < 3 && !revoked; attempt++) {
      try {
        const { response } = await postForm(REVOKE_URL, { token: refreshToken, token_type_hint: 'refresh_token', client_id: auth.clientId });
        if (response.ok) revoked = true;
        else if (response.status < 500) break;
      } catch {
        // network failure: retry with backoff
      }
      if (!revoked) await sleep(500 * 2 ** attempt);
    }
    // The registration (client ID) and the host ID are kept for a later sign-in.
    await saveAuth({ clientId: forget ? null : (auth.clientId ?? null), account: null, tokens: null });
    log('signout', { revoked, forget });
    return { revoked, ...(revoked ? {} : { message: '無法確認已在 OpenAI 撤銷授權；可到 ChatGPT 設定中斷此 App 的連結' }) };
  }

  async function requireSharing() {
    const { auth, token } = await accessToken();
    if (!(auth.tokens.scope ?? '').split(/\s+/).includes(PLAN_SCOPE)) throw new BridgeError(403, 'sharing_disabled', '此登入沒有授權使用 ChatGPT 方案用量（chatgpt.tokens.use.direct）');
    return token;
  }

  async function upstreamError(response) {
    let body = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    const err = body.error && typeof body.error === 'object' ? body.error : {};
    return new BridgeError(response.status, err.code ?? null, err.message ?? (typeof body.detail === 'string' ? body.detail : `OpenAI 回應 ${response.status}`), {
      param: err.param ?? null,
      requestId: response.headers.get('x-request-id'),
    });
  }

  async function models() {
    const token = await requireSharing();
    const response = await fetchFn(`${API_BASE}/models`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw await upstreamError(response);
    const body = await response.json();
    // Keep visibility == "list" and the server's order (models-and-inference).
    const list = (Array.isArray(body.models) ? body.models : []).filter((m) => m?.visibility === 'list' && typeof m.slug === 'string');
    return { models: list.map((m) => ({ slug: m.slug, displayName: typeof m.display_name === 'string' ? m.display_name : m.slug })) };
  }

  /** Only these fields reach OpenAI; everything else is fixed here (preview limitations). */
  function responsesBody(input, structured) {
    return {
      model: input.model,
      instructions: input.instructions,
      input: [{ role: 'user', content: [{ type: 'input_text', text: input.input }] }],
      store: false,
      stream: true,
      ...(structured ? { text: { format: { type: 'json_schema', name: 'ygo_deck_analysis', schema: input.schema, strict: true } } } : {}),
    };
  }

  async function responses(input, res, signal) {
    if (typeof input?.model !== 'string' || !input.model || input.model.length > 200) throw new BridgeError(400, 'bad_request', '缺少模型');
    if (typeof input.instructions !== 'string' || typeof input.input !== 'string') throw new BridgeError(400, 'bad_request', '缺少 instructions 或 input');
    const wantsSchema = !!input.schema && typeof input.schema === 'object';
    const token = await requireSharing();
    const send = (structured) =>
      fetchFn(`${API_BASE}/responses`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(responsesBody(input, structured)),
        signal,
      });
    let structured = wantsSchema;
    let response = await send(structured);
    if (!response.ok) {
      const error = await upstreamError(response);
      // Unsupported structured output: remove it and send once more (errors-and-recovery).
      if (structured && response.status === 400 && error.code === 'subscription_sharing_unsupported_capability' && String(error.extra.param ?? '').startsWith('text')) {
        log('responses.retry_without_text_format');
        structured = false;
        response = await send(false);
        if (!response.ok) throw await upstreamError(response);
      } else {
        throw error;
      }
    }
    log('responses.stream', { structured });
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-ygo-structured-output': String(structured) });
    const reader = response.body.getReader();
    // The app stops reading once it has `response.completed` (the only success signal) while OpenAI may keep the
    // stream open a moment longer; that close is the normal end, not an aborted request, and is logged as such.
    let completedSeen = false;
    let tail = '';
    for (;;) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (error) {
        if (signal.aborted && completedSeen) {
          log('responses.done', { closedByApp: true });
          return;
        }
        throw error;
      }
      const { value, done } = chunk;
      if (done) break;
      if (!completedSeen) {
        const text = tail + Buffer.from(value).toString('utf8');
        completedSeen = text.includes('response.completed');
        tail = text.slice(-40);
      }
      res.write(value);
    }
    log('responses.done');
    res.end();
  }

  // ---- HTTP ----

  const json = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(JSON.stringify(body));
  };

  const page = (res, status, title, text) => {
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" });
    res.end(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>${esc(title)}</title><body style="font-family:sans-serif;margin:2rem"><h1>${esc(title)}</h1><p>${esc(text)}</p><p>可以關閉此分頁，回到 YGO Combo 助手。</p></body></html>`);
  };

  async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw new BridgeError(413, 'too_large', '請求太大');
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      throw new BridgeError(400, 'bad_request', '請求不是有效的 JSON');
    }
  }

  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    // DNS-rebinding guard: only our own loopback host name (the dev proxy rewrites Host to it).
    if (req.headers.host !== `127.0.0.1:${port}`) return json(res, 403, { error: { code: 'forbidden_host', message: 'Host 不允許' } });
    const origin = req.headers.origin;
    // Desktop mode only: the app's own WebView origin (its HTTP plugin sends it). The per-launch secret checked below is
    // still required — a web page elsewhere can neither claim this origin nor know the secret.
    const originOk = !origin || LOCAL_ORIGIN.test(origin) || (tokenBuffer !== null && DESKTOP_ORIGIN.test(origin));
    if (!originOk) return json(res, 403, { error: { code: 'forbidden_origin', message: 'Origin 不允許' } });

    if (req.method === 'GET' && url.pathname === CALLBACK_PATH) {
      try {
        await completeSignIn(url.searchParams);
        return page(res, 200, 'ChatGPT 登入完成', '已完成登入與授權。');
      } catch (error) {
        lastError = { code: error.code ?? 'signin_failed', message: error.message };
        log('signin.failed', { code: lastError.code });
        return page(res, 400, 'ChatGPT 登入未完成', error.message);
      }
    }

    if (tokenBuffer && !tokenOk(req.headers[TOKEN_HEADER])) return json(res, 401, { error: { code: 'unauthorized', message: '缺少或錯誤的本機授權' } });
    // Cross-site requests cannot add this header without a CORS preflight, which is never approved.
    if (req.headers[BRIDGE_HEADER] !== '1') return json(res, 403, { error: { code: 'forbidden', message: '缺少 bridge 標頭' } });
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      if (req.method === 'GET' && url.pathname === '/status') return json(res, 200, await status());
      if (req.method === 'POST' && url.pathname === '/auth/start') return json(res, 200, { authorizeUrl: await startSignIn() });
      if (req.method === 'POST' && url.pathname === '/auth/logout') return json(res, 200, await signOut({ forget: (await readBody(req)).forget === true }));
      if (req.method === 'GET' && url.pathname === '/models') return json(res, 200, await models());
      if (req.method === 'POST' && url.pathname === '/responses') return await responses(await readBody(req), res, controller.signal);
      return json(res, 404, { error: { code: 'not_found', message: '找不到' } });
    } catch (error) {
      if (controller.signal.aborted) {
        log('request.aborted');
        return res.destroy();
      }
      if (error instanceof BridgeError) {
        log('request.error', { path: url.pathname, status: error.status, code: error.code });
        if (res.headersSent) return res.end();
        return json(res, error.status, { error: { code: error.code, message: error.message, ...error.extra } });
      }
      log('request.failed', { path: url.pathname });
      if (res.headersSent) return res.end();
      return json(res, 502, { error: { code: 'upstream_unreachable', message: '無法連線到 OpenAI' } });
    }
  }

  const server = createServer((req, res) => void handle(req, res));
  return {
    server,
    listen: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          port = server.address().port;
          resolve(port);
        });
      }),
    /** Resolves once no token refresh is in flight (a rotated refresh token must be saved before the process ends). */
    idle: (timeoutMs = 10_000) => Promise.race([(refreshing ?? Promise.resolve()).catch(() => undefined), sleep(timeoutMs)]),
    close: async () => {
      // Finish a refresh first: OpenAI has already rotated the refresh token once it answers, and ending before the
      // replacement is written would leave a used token behind and sign the user out.
      await Promise.race([(refreshing ?? Promise.resolve()).catch(() => undefined), sleep(10_000)]);
      await new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections(); // also ends open streams
      });
    },
    get port() {
      return port;
    },
    files,
  };
}
