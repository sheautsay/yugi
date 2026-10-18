import { InjectionToken } from '@angular/core';
import type { AiProviderId } from '../models';

// CR-004 runtime model services. These run in the user's browser with the user's own
// configuration — they are unrelated to the coding assistant used to build this app.

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** All AI network calls go through this, so tests can answer them without any real service. */
export const AI_FETCH = new InjectionToken<FetchLike>('AI_FETCH', {
  providedIn: 'root',
  factory: () => (input, init) => fetch(input, init),
});

/**
 * Which model services this build offers (CR-011). The browser build (V1) offers all three, unchanged. The Windows app
 * offers only the ChatGPT account: the user's decision is to use their own ChatGPT plan, with no Claude API key and no
 * local Ollama. A stored choice outside this list is replaced by the first entry, so an old backup cannot select a
 * provider the app does not offer.
 */
export const AI_PROVIDERS = new InjectionToken<readonly AiProviderId[]>('AI_PROVIDERS', {
  providedIn: 'root',
  factory: () => ['anthropic', 'ollama', 'chatgpt'],
});

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ClaudeModel {
  id: string;
  label: string;
  /** USD per million tokens (Anthropic list price, 2026-10; an estimate, the bill is authoritative). */
  inputPerMTok: number;
  outputPerMTok: number;
  /** Server-side refusal fallback is available for this model. */
  fallback: boolean;
}

export const CLAUDE_MODELS: readonly ClaudeModel[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', inputPerMTok: 4, outputPerMTok: 20, fallback: true },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', inputPerMTok: 2, outputPerMTok: 10, fallback: true },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', inputPerMTok: 0.1, outputPerMTok: 0.5, fallback: false },
];

export interface AiRequest {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
}

export interface AiResult {
  text: string;
  /** The model that actually answered (may differ after a server-side fallback). */
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AiCallOptions {
  signal: AbortSignal;
  onProgress?: (receivedChars: number) => void;
  fetch: FetchLike;
}

export type AiErrorCode =
  | 'config'
  | 'auth'
  | 'permission'
  | 'rate-limit'
  /** ChatGPT plan usage limit reached (CR-005): "Manage usage" is the action. */
  | 'usage-limit'
  | 'server'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'refusal'
  | 'truncated'
  | 'bad-request'
  | 'bad-format'
  | 'unknown';

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  effort: Effort;
  timeoutMs: number;
}

/** Claude Messages API through the official SDK, streamed for progress, JSON-schema output. */
export async function callAnthropic(config: AnthropicConfig, request: AiRequest, options: AiCallOptions): Promise<AiResult> {
  if (!config.apiKey.trim()) throw new AiError('config', '尚未輸入 Claude API Key');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: config.apiKey.trim(),
    // The key is the user's own, typed into this local page; it never leaves this browser except to the API.
    dangerouslyAllowBrowser: true,
    // One analysis = one request, so the daily request limit is exact.
    maxRetries: 0,
    timeout: config.timeoutMs,
    fetch: options.fetch as never,
  });
  const fallback = CLAUDE_MODELS.find((m) => m.id === config.model)?.fallback ?? false;
  let received = 0;
  try {
    const stream = client.beta.messages.stream(
      {
        model: config.model,
        max_tokens: request.maxOutputTokens,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
        output_config: { effort: config.effort, format: { type: 'json_schema', schema: request.schema } },
        ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      },
      { signal: options.signal },
    );
    stream.on('text', (delta) => {
      received += delta.length;
      options.onProgress?.(received);
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') throw new AiError('refusal', '模型拒絕回應此請求（refusal），沒有產生結果');
    if (message.stop_reason === 'max_tokens') throw new AiError('truncated', `輸出達到最大輸出 ${request.maxOutputTokens} tokens 而被截斷；請提高上限或縮小分析範圍`);
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    const u = message.usage;
    return {
      text,
      model: message.model,
      usage: { inputTokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), outputTokens: u.output_tokens },
    };
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof Anthropic.APIUserAbortError || options.signal.aborted) throw new AiError('cancelled', '已中止');
    if (error instanceof Anthropic.APIConnectionTimeoutError) throw new AiError('timeout', '連線逾時');
    if (error instanceof Anthropic.AuthenticationError) throw new AiError('auth', 'API Key 無效或已撤銷（401）');
    if (error instanceof Anthropic.PermissionDeniedError) throw new AiError('permission', '此 API Key 沒有使用此模型的權限（403）');
    if (error instanceof Anthropic.RateLimitError) throw new AiError('rate-limit', '已達 Anthropic 的速率或用量限制（429），請稍後再試');
    if (error instanceof Anthropic.BadRequestError) throw new AiError('bad-request', `請求被拒絕（400）：${error.message}`);
    if (error instanceof Anthropic.APIConnectionError) throw new AiError('network', '無法連線到 Anthropic API（網路中斷或被阻擋）');
    if (error instanceof Anthropic.APIError) throw new AiError('server', `Anthropic API 錯誤（${error.status ?? '未知狀態'}）：${error.message}`);
    throw new AiError('unknown', error instanceof Error ? error.message : String(error));
  }
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

/** Only a model server on this computer is allowed (no other network service, G11). */
export function ollamaUrlProblem(baseUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return 'Ollama 位址不是有效的網址';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'Ollama 位址只接受 http 或 https';
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return 'Ollama 位址只能是本機（localhost）';
  return null;
}

/** Local Ollama `/api/chat`, streamed (NDJSON), with the JSON schema as the output format. */
export async function callOllama(config: OllamaConfig, request: AiRequest, options: AiCallOptions): Promise<AiResult> {
  const problem = ollamaUrlProblem(config.baseUrl);
  if (problem) throw new AiError('config', problem);
  if (!config.model.trim()) throw new AiError('config', '尚未輸入 Ollama 模型名稱');
  let response: Response;
  try {
    response = await options.fetch(new URL('/api/chat', config.baseUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model.trim(),
        stream: true,
        format: request.schema,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        options: { temperature: 0, num_predict: request.maxOutputTokens, num_ctx: 32768 },
      }),
      signal: options.signal,
    });
  } catch {
    if (options.signal.aborted) throw new AiError('cancelled', '已中止');
    throw new AiError('network', '無法連線到本機 Ollama：請確認已啟動，且允許此網頁的來源（OLLAMA_ORIGINS）');
  }
  if (response.status === 404) throw new AiError('config', `Ollama 找不到模型「${config.model}」（請先 ollama pull）`);
  if (!response.ok || !response.body) throw new AiError('server', `Ollama 回應錯誤（${response.status}）`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let model = config.model;
  let usage: AiResult['usage'];
  let doneReason = '';
  const handle = (line: string) => {
    if (!line.trim()) return;
    let chunk: { model?: string; message?: { content?: string }; done?: boolean; done_reason?: string; prompt_eval_count?: number; eval_count?: number; error?: string };
    try {
      chunk = JSON.parse(line);
    } catch {
      throw new AiError('bad-format', 'Ollama 串流資料格式錯誤');
    }
    if (chunk.error) throw new AiError('server', `Ollama 錯誤：${chunk.error}`);
    if (chunk.model) model = chunk.model;
    if (chunk.message?.content) {
      text += chunk.message.content;
      options.onProgress?.(text.length);
    }
    if (chunk.done) {
      doneReason = chunk.done_reason ?? '';
      usage = { inputTokens: chunk.prompt_eval_count ?? 0, outputTokens: chunk.eval_count ?? 0 };
    }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(handle);
    }
    handle(buffer);
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (options.signal.aborted) throw new AiError('cancelled', '已中止');
    throw new AiError('network', '與本機 Ollama 的連線中斷');
  }
  if (doneReason === 'length') throw new AiError('truncated', `輸出達到最大輸出 ${request.maxOutputTokens} tokens 而被截斷；請提高上限或縮小分析範圍`);
  return { text, model, ...(usage ? { usage } : {}) };
}
