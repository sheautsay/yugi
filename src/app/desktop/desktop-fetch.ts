import { CHATGPT_BRIDGE } from '../core/ai/chatgpt';
import type { FetchLike } from '../core/ai/providers';
import type { DesktopApis } from './desktop-apis';

/** What the host returns once the local ChatGPT service (sidecar) is running. */
export interface BridgeSession {
  port: number;
  /** Per-launch secret; held in memory only, never stored, logged or shown. */
  token: string;
}

export const BRIDGE_TOKEN_HEADER = 'x-ygo-bridge-token';

const isBridgeUrl = (url: string) => url === CHATGPT_BRIDGE || url.startsWith(`${CHATGPT_BRIDGE}/`) || url.startsWith(`${CHATGPT_BRIDGE}?`);

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

/**
 * The desktop `fetch` (injected as `AI_FETCH` and `FETCH_FN`): every request is sent by the host, and calls to the
 * local ChatGPT service (`/chatgpt-bridge/...`, a path that only exists behind the dev-server proxy) are pointed at the
 * sidecar the host starts on demand, carrying its per-launch secret. The application code is unchanged.
 */
export function createDesktopFetch(apis: Pick<DesktopApis, 'fetch' | 'invoke'>): FetchLike & { reset(): void } {
  let session: Promise<BridgeSession> | null = null;
  const ensure = (): Promise<BridgeSession> => {
    session ??= apis.invoke<BridgeSession>('bridge_start').then(validate).catch((error: unknown) => {
      session = null; // the next call asks the host again (it restarts a sidecar that has ended)
      throw error;
    });
    return session;
  };

  const desktopFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    if (!isBridgeUrl(url)) return withRealHeaders(await apis.fetch(input, init));
    const send = async ({ port, token }: BridgeSession) => {
      const headers = new Headers(init?.headers);
      headers.set(BRIDGE_TOKEN_HEADER, token);
      return withRealHeaders(await apis.fetch(`http://127.0.0.1:${port}${url.slice(CHATGPT_BRIDGE.length)}`, { ...init, headers }));
    };
    // A sidecar that cannot start is reported as it is (no second attempt, which could double a long wait).
    const running = await ensure();
    try {
      return await send(running);
    } catch (error) {
      if (init?.signal?.aborted) throw error; // a user abort is not a failure
      // A refused connection means the sidecar ended (crash, killed): forget it so the host starts a new one.
      session = null;
      // Reads (status, model list) are safe to repeat, so recover right away. Never re-send anything else
      // (e.g. an analysis request), which the user must start again themselves.
      if ((init?.method ?? 'GET').toUpperCase() !== 'GET') throw error;
      return send(await ensure());
    }
  }) as FetchLike & { reset(): void };
  desktopFetch.reset = () => {
    session = null;
  };
  return desktopFetch;
}

/**
 * `@tauri-apps/plugin-http` creates its Response without headers and attaches them afterwards as a plain property, so the
 * Response's own header list is empty: `blob().type` comes out as "" (card images were rejected as "not an image").
 * Re-wrap it with the real headers. The body stream is passed through untouched, so streaming (SSE) still works.
 */
export function withRealHeaders(response: Response): Response {
  const nullBody = [101, 103, 204, 205, 304].includes(response.status);
  return new Response(nullBody ? null : response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

function validate(value: BridgeSession): BridgeSession {
  if (!value || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535 || typeof value.token !== 'string' || value.token.length < 32) {
    throw new Error('本機 ChatGPT 服務回報的資料不正確');
  }
  return value;
}
