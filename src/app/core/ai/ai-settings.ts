import { AiProviderId } from '../models';
import { AnalysisGoal, DEFAULT_GOAL, normalizeGoal } from './analysis-goal';
import { AnalysisScope } from './prompt';
import { DEFAULT_STAGED, StagedSettings, normalizeStaged } from './staged';
import { CLAUDE_MODELS, Effort } from './providers';

// Settings of the AI analysis: the shape, the defaults, the limits and how stored values are normalised.

export interface AiSettings {
  provider: AiProviderId;
  claudeModel: string;
  effort: Effort;
  ollamaBaseUrl: string;
  ollamaModel: string;
  /** A slug from the signed-in account's model list (CR-005); never a built-in default. */
  chatgptModel: string;
  maxOutputTokens: number;
  timeoutSeconds: number;
  dailyRequestLimit: number;
  scope: AnalysisScope;
  /** CR-006: what to prefer (a preference, not a requirement). */
  goal: AnalysisGoal;
  /** CR-008: one request (the original way) or the phased analysis of 1–3 card starters. */
  mode: 'one-shot' | 'staged';
  /** CR-008: budgets of the phased analysis. */
  staged: StagedSettings;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'anthropic',
  claudeModel: 'claude-opus-5-5',
  effort: 'high',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: '',
  chatgptModel: '',
  maxOutputTokens: 32000,
  timeoutSeconds: 900,
  dailyRequestLimit: 10,
  scope: { single: true, multi: true, extenders: true, maxRoutes: 5, candidates: 6 },
  goal: DEFAULT_GOAL,
  mode: 'one-shot',
  staged: DEFAULT_STAGED,
};

export const SETTING_LIMITS = {
  maxOutputTokens: [1000, 128000],
  timeoutSeconds: [30, 3600],
  dailyRequestLimit: [1, 200],
  maxRoutes: [1, 10],
  candidates: [1, 10],
} as const;

/** Rough output size of one fully written route (CR-006 estimate shown before sending). */
export const TOKENS_PER_ROUTE = [3000, 10000] as const;

const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.trunc(Number.isFinite(n) ? n : lo)));
/** Rough token estimate for the cost preview (about 3.5 characters per token for this text). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export function costUsd(model: string, inputTokens: number, outputTokens: number): number | undefined {
  const m = CLAUDE_MODELS.find((x) => x.id === model);
  return m ? (inputTokens * m.inputPerMTok + outputTokens * m.outputPerMTok) / 1_000_000 : undefined;
}

export function normalizeSettings(s: Partial<AiSettings>): AiSettings {
  const merged = { ...DEFAULT_AI_SETTINGS, ...s, scope: { ...DEFAULT_AI_SETTINGS.scope, ...s.scope } };
  return {
    ...merged,
    provider: merged.provider === 'ollama' || merged.provider === 'chatgpt' ? merged.provider : 'anthropic',
    chatgptModel: typeof merged.chatgptModel === 'string' ? merged.chatgptModel : '',
    claudeModel: CLAUDE_MODELS.some((m) => m.id === merged.claudeModel) ? merged.claudeModel : DEFAULT_AI_SETTINGS.claudeModel,
    effort: (['low', 'medium', 'high', 'xhigh', 'max'] as const).includes(merged.effort) ? merged.effort : 'high',
    maxOutputTokens: clamp(merged.maxOutputTokens, SETTING_LIMITS.maxOutputTokens),
    timeoutSeconds: clamp(merged.timeoutSeconds, SETTING_LIMITS.timeoutSeconds),
    dailyRequestLimit: clamp(merged.dailyRequestLimit, SETTING_LIMITS.dailyRequestLimit),
    scope: { ...merged.scope, maxRoutes: clamp(merged.scope.maxRoutes, SETTING_LIMITS.maxRoutes), candidates: clamp(merged.scope.candidates ?? merged.scope.maxRoutes, SETTING_LIMITS.candidates) },
    goal: normalizeGoal(merged.goal),
    mode: merged.mode === 'staged' ? 'staged' : 'one-shot',
    staged: normalizeStaged(merged.staged),
  };
}
