import { AiCallOptions, AiError, AiRequest, AiResult, FetchLike } from './providers';

// CR-005: the "ChatGPT account" provider. Everything goes through the local ChatGPT bridge
// (scripts/chatgpt-bridge, reached via the dev-server proxy). This page never holds a token:
// the bridge signs in with the official Sign in with ChatGPT flow and calls the Responses API.

export const CHATGPT_BRIDGE = '/chatgpt-bridge';
export const BRIDGE_COMMAND = 'npm run chatgpt-bridge';
/** "Manage usage" (UI/UX guidelines): ChatGPT settings → Usage. */
export const MANAGE_USAGE_URL = 'https://chatgpt.com/settings/usage';
const HEADERS = { 'x-ygo-bridge': '1' };

export interface ChatGptStatus {
  reachable: boolean;
  signedIn: boolean;
  /** Plan usage granted (chatgpt.tokens.use.direct). */
  sharing: boolean;
  account: { email: string | null; name: string | null } | null;
  expiresAt: string | null;
  pending: boolean;
  lastError: { code: string; message: string } | null;
}

export interface ChatGptModel {
  slug: string;
  displayName: string;
}

export const BRIDGE_DOWN: ChatGptStatus = { reachable: false, signedIn: false, sharing: false, account: null, expiresAt: null, pending: false, lastError: null };
/** How the app tells the user the local service is not running. The desktop build replaces these (CR-010): there is no terminal to open. */
export interface BridgeHints {
  /** Error message for a failed call. */
  down: string;
  /** Reason shown by the analysis pre-flight. */
  preflight: string;
  /** True when the host app starts the local service itself. */
  managed: boolean;
}

const BROWSER_HINTS: BridgeHints = {
  down: `本機 ChatGPT 服務沒有啟動：請另開終端機，在專案資料夾執行「${BRIDGE_COMMAND}」`,
  preflight: `本機 ChatGPT 服務沒有啟動：請另開終端機，在專案資料夾執行「${BRIDGE_COMMAND}」後按「重新整理」`,
  managed: false,
};
let hints: BridgeHints = BROWSER_HINTS;

export function setBridgeHints(next: BridgeHints | null): void {
  hints = next ?? BROWSER_HINTS;
}

export const bridgeHints = (): BridgeHints => hints;

interface BridgeErrorBody {
  code?: string | null;
  message?: string;
  param?: string | null;
  requestId?: string | null;
}

async function bridge(fetchFn: FetchLike, path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetchFn(CHATGPT_BRIDGE + path, { ...init, headers: { ...HEADERS, ...(init.body ? { 'content-type': 'application/json' } : {}) } });
  } catch {
    if (init.signal?.aborted) throw new AiError('cancelled', '已中止');
    throw new AiError('network', hints.down);
  }
}

/** The bridge always answers errors as JSON `{ error: { code } }`; anything else means it is not running. */
async function errorOf(response: Response): Promise<AiError> {
  let body: { error?: BridgeErrorBody } = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  if (!body.error || body.error.code === undefined) return new AiError('network', hints.down);
  return chatGptError(response.status, body.error);
}

/** Maps documented plan-usage errors (errors-and-recovery) to app errors. Never switches billing. */
export function chatGptError(status: number, error: BridgeErrorBody): AiError {
  const detail = error.message ? `：${error.message}` : '';
  const request = error.requestId ? `（請求 ID ${error.requestId}）` : '';
  switch (error.code) {
    case 'not_signed_in':
    case 'reauth_required':
      return new AiError('auth', `ChatGPT 登入已失效或尚未登入，請按「Continue with ChatGPT」重新登入`);
    case 'sharing_disabled':
      return new AiError('permission', '此登入沒有授權使用 ChatGPT 方案用量，請重新登入並同意使用方案用量');
    case 'subscription_sharing_usage_limit_exceeded':
      return new AiError('usage-limit', '已達 ChatGPT 方案用量上限。請到 ChatGPT 設定檢視你的方案或此 App 的用量上限（管理用量）。');
    case 'subscription_sharing_user_not_eligible':
      return new AiError('permission', `此 ChatGPT 帳號或方案目前不符合使用資格，不會重試${detail}`);
    case 'subscription_sharing_usage_unavailable':
    case 'subscription_sharing_user_unavailable':
    case 'refresh_unavailable':
      return new AiError('server', `ChatGPT 方案用量暫時無法使用，請稍後再試${detail}`);
    case 'subscription_sharing_unsupported_capability':
      return new AiError('bad-request', `ChatGPT 方案不支援此請求內容（${error.param ?? '未指出參數'}）${detail}`);
    case 'subscription_sharing_route_not_supported':
      return new AiError('bad-request', `ChatGPT 方案不支援此端點${detail}`);
    case 'subscription_sharing_invalid_user':
      return new AiError('auth', `ChatGPT 帳號授權未被接受${request}${detail}`);
    case 'chatpass_v2_scope_not_authorized':
    case 'chatpass_v2_invalid_authorization_context':
      return new AiError('permission', `ChatGPT 授權設定不符，不會重試${detail}`);
  }
  if (status === 401) return new AiError('auth', `ChatGPT 帳號授權未被接受${request}${detail}`);
  if (status === 403) return new AiError('permission', `請求被拒絕（例如服務地區限制）${detail}`);
  if (status === 429) return new AiError('rate-limit', `請求太頻繁，請稍後再試${detail}`);
  if (status >= 500 || status === 0) return new AiError('server', `ChatGPT 服務暫時無法使用${detail}`);
  return new AiError('unknown', `ChatGPT 請求失敗（${status}）${detail}`);
}

export async function chatGptStatus(fetchFn: FetchLike): Promise<ChatGptStatus> {
  try {
    const response = await bridge(fetchFn, '/status');
    const body = await response.json();
    if (!response.ok || body?.ok !== true) return BRIDGE_DOWN;
    return {
      reachable: true,
      signedIn: !!body.signedIn,
      sharing: !!body.sharing,
      account: body.account ? { email: body.account.email ?? null, name: body.account.name ?? null } : null,
      expiresAt: body.expiresAt ?? null,
      pending: !!body.pending,
      lastError: body.lastError ?? null,
    };
  } catch {
    return BRIDGE_DOWN;
  }
}

/** Starts the official sign-in; returns the authorization page to open. */
export async function chatGptSignIn(fetchFn: FetchLike): Promise<string> {
  const response = await bridge(fetchFn, '/auth/start', { method: 'POST', body: '{}' });
  if (!response.ok) throw await errorOf(response);
  const { authorizeUrl } = (await response.json()) as { authorizeUrl?: string };
  if (!authorizeUrl || new URL(authorizeUrl).protocol !== 'https:') throw new AiError('unknown', '本機服務沒有回傳有效的登入網址');
  return authorizeUrl;
}

/** `forget`: also drop this account's registration so a different ChatGPT account can sign in (switch account). */
export async function chatGptSignOut(fetchFn: FetchLike, forget = false): Promise<{ revoked: boolean; message?: string }> {
  const response = await bridge(fetchFn, '/auth/logout', { method: 'POST', body: forget ? JSON.stringify({ forget: true }) : '{}' });
  if (!response.ok) throw await errorOf(response);
  return response.json();
}

/** Models actually available to the signed-in account (never a built-in list). */
export async function chatGptModels(fetchFn: FetchLike): Promise<ChatGptModel[]> {
  const response = await bridge(fetchFn, '/models');
  if (!response.ok) throw await errorOf(response);
  const body = (await response.json()) as { models?: ChatGptModel[] };
  return (body.models ?? []).filter((m) => typeof m?.slug === 'string').map((m) => ({ slug: m.slug, displayName: m.displayName || m.slug }));
}

interface StreamEvent {
  type?: string;
  delta?: string;
  refusal?: string;
  code?: string;
  message?: string;
  response?: { model?: string; usage?: { input_tokens?: number; output_tokens?: number }; error?: BridgeErrorBody; incomplete_details?: { reason?: string } };
}

/**
 * One analysis through the user's ChatGPT plan. The bridge fixes store:false / stream:true and
 * drops unsupported parameters; this reads the Responses stream until `response.completed`.
 */
export async function callChatGpt(config: { model: string }, request: AiRequest, options: AiCallOptions): Promise<AiResult & { structuredOutput: boolean }> {
  if (!config.model) throw new AiError('config', '尚未選擇模型');
  const response = await bridge(options.fetch, '/responses', {
    method: 'POST',
    body: JSON.stringify({ model: config.model, instructions: request.system, input: request.user, schema: request.schema }),
    signal: options.signal,
  });
  if (!response.ok) throw await errorOf(response);
  if (!response.body) throw new AiError('network', '沒有收到串流資料');
  const structuredOutput = response.headers.get('x-ygo-structured-output') !== 'false';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let refusal = '';
  let completed: StreamEvent['response'] | undefined;
  const handle = (block: string) => {
    const data = block
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart())
      .join('\n');
    if (!data || data === '[DONE]') return;
    let event: StreamEvent;
    try {
      event = JSON.parse(data);
    } catch {
      throw new AiError('bad-format', 'ChatGPT 串流資料格式錯誤');
    }
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
      text += event.delta;
      options.onProgress?.(text.length);
    } else if ((event.type === 'response.refusal.delta' || event.type === 'response.refusal.done') && typeof (event.delta ?? event.refusal) === 'string') {
      // The model declined: remember it so the user is told that, instead of "the answer is not valid JSON".
      refusal = event.type === 'response.refusal.done' ? String(event.refusal) : refusal + String(event.delta);
    } else if (event.type === 'response.completed') {
      completed = event.response ?? {};
    } else if (event.type === 'response.failed') {
      throw chatGptError(0, event.response?.error ?? {});
    } else if (event.type === 'response.incomplete') {
      throw new AiError('truncated', `ChatGPT 回應未完成（${event.response?.incomplete_details?.reason ?? '原因不明'}）`);
    } else if (event.type === 'error') {
      throw chatGptError(0, { code: event.code, message: event.message });
    }
  };
  try {
    while (!completed) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      blocks.forEach(handle);
    }
    if (!completed && buffer.trim()) handle(buffer);
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (options.signal.aborted) throw new AiError('cancelled', '已中止');
    throw new AiError('network', '與本機 ChatGPT 服務的連線中斷');
  } finally {
    reader.cancel().catch(() => undefined);
  }
  if (options.signal.aborted) throw new AiError('cancelled', '已中止');
  // Only response.completed means success (models-and-inference).
  if (!completed) throw new AiError('network', 'ChatGPT 串流在完成前中斷');
  if (!text.trim() && refusal.trim()) throw new AiError('refusal', '模型拒絕回應此請求（refusal），沒有產生結果');
  const usage = completed.usage;
  return {
    text,
    model: completed.model ?? config.model,
    ...(usage ? { usage: { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 } } : {}),
    structuredOutput,
  };
}
