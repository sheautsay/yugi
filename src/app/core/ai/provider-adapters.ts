import { AiProviderId } from '../models';
import { AiSettings } from './ai-settings';
import type { AnalysisRun } from './analysis-types';
import { BridgeHints, ChatGptModel, ChatGptStatus, bridgeHints, callChatGpt } from './chatgpt';
import { AiCallOptions, AiRequest, AiResult, CLAUDE_MODELS, callAnthropic, callOllama, ollamaUrlProblem } from './providers';

// One adapter per model service. Everything the analysis needs to know about a provider — its model name,
// the parameters recorded with a run, the cache key parts, the call, the cost and the "can it start" checks —
// lives here, so the analysis code never branches on the provider id.

/** What a pre-flight check may look at; it never contacts any AI service. */
export interface PreflightContext {
  settings: AiSettings;
  apiKey: string;
  chatgpt: ChatGptStatus;
  chatgptModels: readonly ChatGptModel[] | null;
}

export interface AiProviderAdapter {
  readonly id: AiProviderId;
  /** The model name sent to the service. */
  modelOf(settings: AiSettings): string;
  /** Settings of this provider that change the answer (part of the cache key). */
  cacheKeyParts(settings: AiSettings): unknown[];
  /** The parameters recorded with a run. */
  runParams(settings: AiSettings): AnalysisRun['params'];
  call(settings: AiSettings, apiKey: string, request: AiRequest, options: AiCallOptions): Promise<AiResult & { structuredOutput?: boolean }>;
  /** Estimated cost in USD, or undefined when the provider has no price table. */
  costUsd(model: string, inputTokens: number, outputTokens: number): number | undefined;
  /** Why this provider cannot be used right now. */
  preflight(context: PreflightContext, hints?: BridgeHints): string[];
}

const anthropic: AiProviderAdapter = {
  id: 'anthropic',
  modelOf: (s) => s.claudeModel,
  cacheKeyParts: (s) => [s.claudeModel, s.effort],
  runParams: (s) => ({ effort: s.effort, maxOutputTokens: s.maxOutputTokens, timeoutSeconds: s.timeoutSeconds }),
  call: (s, apiKey, request, options) => callAnthropic({ apiKey, model: s.claudeModel, effort: s.effort, timeoutMs: s.timeoutSeconds * 1000 }, request, options),
  costUsd(model, inputTokens, outputTokens) {
    const m = CLAUDE_MODELS.find((x) => x.id === model);
    return m ? (inputTokens * m.inputPerMTok + outputTokens * m.outputPerMTok) / 1_000_000 : undefined;
  },
  preflight: ({ apiKey }) => (apiKey.trim() ? [] : ['請輸入 Claude API Key（只存在目前分頁）']),
};

const ollama: AiProviderAdapter = {
  id: 'ollama',
  modelOf: (s) => s.ollamaModel.trim(),
  cacheKeyParts: (s) => [s.ollamaBaseUrl, s.ollamaModel.trim()],
  runParams: (s) => ({ maxOutputTokens: s.maxOutputTokens, timeoutSeconds: s.timeoutSeconds, temperature: 0 }),
  call: (s, _apiKey, request, options) => callOllama({ baseUrl: s.ollamaBaseUrl, model: s.ollamaModel.trim() }, request, options),
  costUsd: () => undefined,
  preflight({ settings }) {
    const reasons: string[] = [];
    const problem = ollamaUrlProblem(settings.ollamaBaseUrl);
    if (problem) reasons.push(problem);
    if (!settings.ollamaModel.trim()) reasons.push('請輸入 Ollama 模型名稱');
    return reasons;
  },
};

const chatgpt: AiProviderAdapter = {
  id: 'chatgpt',
  modelOf: (s) => s.chatgptModel,
  cacheKeyParts: (s) => [s.chatgptModel],
  runParams: (s) => ({ timeoutSeconds: s.timeoutSeconds, store: false, stream: true, structuredOutput: true }),
  call: (s, _apiKey, request, options) => callChatGpt({ model: s.chatgptModel }, request, options),
  costUsd: () => undefined,
  preflight({ settings, chatgpt: g, chatgptModels }, hints = bridgeHints()) {
    if (!g.reachable) return [hints.preflight];
    if (!g.signedIn) return ['請按「使用 ChatGPT 登入」以 ChatGPT 帳號登入'];
    if (!g.sharing) return ['此登入沒有授權使用 ChatGPT 方案用量，請重新登入並同意'];
    if (!settings.chatgptModel) return ['請從目前帳號的模型清單選擇模型'];
    if (!(chatgptModels ?? []).some((m) => m.slug === settings.chatgptModel)) return ['所選模型不在目前帳號的模型清單中，請重新整理後再選'];
    return [];
  },
};

const ADAPTERS: Record<AiProviderId, AiProviderAdapter> = { anthropic, ollama, chatgpt };

export function providerAdapter(id: AiProviderId): AiProviderAdapter {
  return ADAPTERS[id];
}
