import { Injectable, inject, signal } from '@angular/core';
import { CardDataService } from '../card-data.service';
import { ComboRepository } from '../combo-repository';
import { AppDb } from '../db';
import { checkDeck, cyrb53, deckFingerprint } from '../deck';
import { localDate } from '../time';
import { AiProviderId, CardRecord, ComboRoute, DeckRecord } from '../models';
import { validateCombo } from '../combo';
import { AI_OUTPUT_JSON_SCHEMA, AI_OUTPUT_JSON_SCHEMA_V3, Candidate, ExtenderEntry, StarterEntry, parseAiOutput, toCandidate, toExplored, toStarters, withCheck } from './analysis-output';
import { AnalysisGoal, DEFAULT_GOAL, goalForDeck, normalizeGoal } from './analysis-goal';
import { AnalysisScope, MD_ASSUMPTIONS, PROMPT_VERSION, buildPrompt, cardsWithoutText, linkCardsWithoutArrows } from './prompt';
import {
  Budget,
  DEFAULT_STAGED,
  ESTIMATED_PLAN_OUTPUT,
  ESTIMATED_ROUTE_OUTPUT,
  PLAN_JSON_SCHEMA,
  PlannedCombo,
  STAGED_PROMPT_VERSION,
  STOP_LABEL,
  StagedCombo,
  StagedRecord,
  StagedSettings,
  StopReason,
  buildComboPrompt,
  buildPlanPrompt,
  normalizeStaged,
  parsePlan,
  selectCombos,
  selectedSizes,
  stopReason,
} from './staged';
import { OllamaCheck, checkOllama } from './ollama-check';
import { BRIDGE_DOWN, bridgeHints, ChatGptModel, ChatGptStatus, callChatGpt, chatGptModels, chatGptSignIn, chatGptSignOut, chatGptStatus } from './chatgpt';
import { AI_FETCH, AI_PROVIDERS, AiError, AiErrorCode, AiRequest, AiResult, CLAUDE_MODELS, Effort, callAnthropic, callOllama, ollamaUrlProblem } from './providers';

// CR-004 orchestration: preflight → cache → one request (timeout / cancel / progress) →
// schema validation → conversion + local data check → run record. It never writes decks or
// combos, except when the user explicitly saves a candidate.

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

/** A line the model mentions without writing it out (CR-006): never counted as found. */
export interface ExploredEntry {
  name: string;
  handCardIds: number[];
  extraDeckCardIds: number[];
  finalBoardCardIds: number[];
  routeName: string;
  note: string;
}

export type RunStatus = 'succeeded' | 'failed' | 'cancelled';

/** One analysis, as recorded (G22-6). Stored in the meta store, never in backups. */
export interface AnalysisRun {
  id: string;
  deckId: string;
  deckName: string;
  deckVersion: number;
  deckFingerprint: string;
  cardDataVersion: string;
  assumptions: string[];
  provider: AiSettings['provider'];
  model: string;
  servedModel?: string;
  /** ChatGPT plan usage: store/stream are fixed and max output is not supported (CR-005). */
  params: { effort?: Effort; maxOutputTokens?: number; timeoutSeconds: number; temperature?: number; store?: boolean; stream?: boolean; structuredOutput?: boolean };
  scope: AnalysisScope;
  /** CR-006: the goal as applied to this deck (absent in older records). */
  goal?: AnalysisGoal;
  promptVersion: string;
  cacheKey: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: RunStatus;
  error?: { code: AiErrorCode; message: string };
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd?: number };
  summary?: string;
  starters?: StarterEntry[];
  extenders?: ExtenderEntry[];
  candidates?: Candidate[];
  explored?: ExploredEntry[];
  /** CR-008: the record of a phased analysis (absent for a one-shot analysis). */
  staged?: StagedRecord;
}

export type Phase = 'idle' | 'preparing' | 'requesting' | 'validating' | 'done' | 'failed' | 'cancelled';

export interface RunState {
  phase: Phase;
  startedAt?: number;
  receivedChars: number;
  runId?: string;
  fromCache?: boolean;
  message?: string;
  /** CR-008: which phase and combination a phased analysis is working on. */
  progress?: string;
}

interface UsageDay {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

const SETTINGS_KEY = 'aiSettings';
const USAGE_KEY = 'aiUsage';
const RUN_PREFIX = 'aiRun:';
const CHATGPT_WELCOME_KEY = 'chatgptWelcomeSeen';
/** Per-tab only: never IndexedDB, backups, exports or source code (G27-2). */
export const API_KEY_STORAGE = 'ygo-combo-assistant.claude-api-key';

const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.trunc(Number.isFinite(n) ? n : lo)));
/** The daily request count follows the local calendar day. */
const today = () => localDate();

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

function readKey(): string {
  try {
    return sessionStorage.getItem(API_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

@Injectable({ providedIn: 'root' })
export class AiAnalysisService {
  private readonly appDb = inject(AppDb);
  private readonly cardData = inject(CardDataService);
  private readonly combos = inject(ComboRepository);
  private readonly fetchFn = inject(AI_FETCH);

  /** The model services this build offers (the Windows app: ChatGPT only). */
  readonly providers = inject(AI_PROVIDERS);
  readonly settings = signal<AiSettings>(this.restrict(DEFAULT_AI_SETTINGS));
  readonly apiKey = signal(readKey());
  readonly state = signal<RunState>({ phase: 'idle', receivedChars: 0 });
  /** CR-005: what the local ChatGPT bridge reports (never a token). */
  readonly chatgpt = signal<ChatGptStatus>(BRIDGE_DOWN);
  /** Models of the signed-in account; null until listed. */
  readonly chatgptModels = signal<ChatGptModel[] | null>(null);
  readonly chatgptError = signal('');
  /** CR-010: the last explicit "check Ollama" result (null until the user asks). The pre-flight never uses it. */
  readonly ollamaCheck = signal<OllamaCheck | null>(null);
  readonly ollamaChecking = signal(false);
  readonly chatgptWelcomeSeen = signal(true);
  readonly ready: Promise<void> = this.loadSettings();

  private controller?: AbortController;
  private timedOut = false;
  private running = false;
  /** CR-008: the user asked to stop; a phased analysis checks it between requests. */
  private cancelRequested = false;

  // ---- settings & key -------------------------------------------------------------------

  async updateSettings(patch: Partial<AiSettings>): Promise<void> {
    const next = this.restrict(normalizeSettings({ ...this.settings(), ...patch }));
    this.settings.set(next);
    await (await this.appDb.db()).put('meta', { key: SETTINGS_KEY, value: next });
  }

  /** User-started: is the Ollama service up and is the chosen model installed? */
  async checkOllama(): Promise<OllamaCheck> {
    this.ollamaChecking.set(true);
    try {
      const { ollamaBaseUrl, ollamaModel } = this.settings();
      const result = await checkOllama({ baseUrl: ollamaBaseUrl, model: ollamaModel }, this.fetchFn);
      this.ollamaCheck.set(result);
      return result;
    } finally {
      this.ollamaChecking.set(false);
    }
  }

  /** A provider this build does not offer is replaced by the first one it does. */
  private restrict(settings: AiSettings): AiSettings {
    return this.providers.includes(settings.provider) ? settings : { ...settings, provider: this.providers[0] };
  }

  setApiKey(key: string): void {
    this.apiKey.set(key);
    try {
      if (key) sessionStorage.setItem(API_KEY_STORAGE, key);
      else sessionStorage.removeItem(API_KEY_STORAGE);
    } catch {
      // storage unavailable: the key stays in memory for this page only
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const entry = await (await this.appDb.db()).get('meta', SETTINGS_KEY);
      if (entry) this.settings.set(this.restrict(normalizeSettings(entry.value as Partial<AiSettings>)));
    } catch {
      // keep defaults
    }
  }

  // ---- usage & runs ---------------------------------------------------------------------

  async usageToday(): Promise<UsageDay> {
    const entry = await (await this.appDb.db()).get('meta', USAGE_KEY);
    const usage = entry?.value as UsageDay | undefined;
    return usage?.date === today() ? usage : { date: today(), requests: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
  }

  private async addUsage(patch: Partial<Omit<UsageDay, 'date'>>): Promise<void> {
    const u = await this.usageToday();
    const next: UsageDay = {
      date: u.date,
      requests: u.requests + (patch.requests ?? 0),
      inputTokens: u.inputTokens + (patch.inputTokens ?? 0),
      outputTokens: u.outputTokens + (patch.outputTokens ?? 0),
      estimatedCostUsd: u.estimatedCostUsd + (patch.estimatedCostUsd ?? 0),
    };
    await (await this.appDb.db()).put('meta', { key: USAGE_KEY, value: next });
  }

  async listRuns(deckId?: string): Promise<AnalysisRun[]> {
    const db = await this.appDb.db();
    const entries = await db.getAll('meta', IDBKeyRange.bound(RUN_PREFIX, `${RUN_PREFIX}￿`));
    return entries
      .map((e) => e.value as AnalysisRun)
      .filter((r) => r && typeof r.id === 'string' && (!deckId || r.deckId === deckId))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getRun(id: string): Promise<AnalysisRun | undefined> {
    return (await (await this.appDb.db()).get('meta', RUN_PREFIX + id))?.value as AnalysisRun | undefined;
  }

  async saveRun(run: AnalysisRun): Promise<void> {
    await (await this.appDb.db()).put('meta', { key: RUN_PREFIX + run.id, value: run });
  }

  async deleteRun(id: string): Promise<void> {
    await (await this.appDb.db()).delete('meta', RUN_PREFIX + id);
  }

  // ---- preflight ------------------------------------------------------------------------

  async cardDataVersion(deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>): Promise<string> {
    const sync = await this.cardData.syncInfo();
    const newest = [...deck.main, ...deck.extra].map((r) => cards.get(r.cardId)?.updatedAt ?? '').sort().at(-1) ?? '';
    return `${sync ? `YGOPRODeck ${sync.dbVersion}` : '未完整同步'}｜${newest.slice(0, 19)}`;
  }

  /** Why an analysis cannot start; empty when it can (G22-2). Never contacts any AI service. */
  async preflight(deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, settings = this.settings(), apiKey = this.apiKey()): Promise<string[]> {
    const reasons: string[] = [];
    const check = checkDeck(deck, cards);
    if (!check.queryable) reasons.push(`牌組未通過牌表檢核：${check.errors.join('；')}`);
    const noText = cardsWithoutText(deck, cards);
    if (noText.length) reasons.push(`有 ${noText.length} 種卡沒有效果文字，請先下載完整卡片資料（設定 → 完整卡片資料庫）`);
    const noArrows = linkCardsWithoutArrows(deck, cards);
    if (noArrows.length) reasons.push(`有 ${noArrows.length} 種連結怪獸沒有連結箭頭資料（較早同步的卡片資料不含箭頭），請到「設定 → 完整卡片資料庫」按「強制重新下載」`);
    if (settings.mode === 'staged') {
      if (!selectedSizes(settings.scope).length) reasons.push('請至少選擇一種起手張數（單卡、雙卡或三卡展開）');
      const planCost = this.estimatePlan(deck, cards, settings) + ESTIMATED_PLAN_OUTPUT;
      if (planCost > settings.staged.tokenBudget) reasons.push(`Token 預算 ${settings.staged.tokenBudget} 不足以送出階段 A（約需 ${planCost} tokens），請提高預算`);
    } else if (!settings.scope.single && !settings.scope.multi && !settings.scope.triple && !settings.scope.extenders) reasons.push('請至少選擇一種分析範圍');
    if (settings.provider === 'anthropic' && !apiKey.trim()) reasons.push('請輸入 Claude API Key（只存在目前分頁）');
    if (settings.provider === 'ollama') {
      const problem = ollamaUrlProblem(settings.ollamaBaseUrl);
      if (problem) reasons.push(problem);
      if (!settings.ollamaModel.trim()) reasons.push('請輸入 Ollama 模型名稱');
    }
    if (settings.provider === 'chatgpt') {
      const g = this.chatgpt();
      if (!g.reachable) reasons.push(bridgeHints().preflight);
      else if (!g.signedIn) reasons.push('請按「Continue with ChatGPT」以 ChatGPT 帳號登入');
      else if (!g.sharing) reasons.push('此登入沒有授權使用 ChatGPT 方案用量，請重新登入並同意');
      else if (!settings.chatgptModel) reasons.push('請從目前帳號的模型清單選擇模型');
      else if (!(this.chatgptModels() ?? []).some((m) => m.slug === settings.chatgptModel)) reasons.push('所選模型不在目前帳號的模型清單中，請重新整理後再選');
    }
    const usage = await this.usageToday();
    if (usage.requests >= settings.dailyRequestLimit) reasons.push(`今天已送出 ${usage.requests} 次分析請求，達到每日上限 ${settings.dailyRequestLimit} 次`);
    return reasons;
  }

  cacheKey(deck: DeckRecord, cardDataVersion: string, settings = this.settings()): string {
    const model =
      settings.provider === 'anthropic' ? [settings.claudeModel, settings.effort] : settings.provider === 'chatgpt' ? [settings.chatgptModel] : [settings.ollamaBaseUrl, settings.ollamaModel.trim()];
    const key =
      settings.mode === 'staged'
        ? JSON.stringify([STAGED_PROMPT_VERSION, settings.provider, ...model, settings.maxOutputTokens, settings.scope, settings.staged, goalForDeck(settings.goal, deck), deckFingerprint(deck), cardDataVersion])
        : JSON.stringify([PROMPT_VERSION, settings.provider, ...model, settings.maxOutputTokens, settings.scope, goalForDeck(settings.goal, deck), deckFingerprint(deck), cardDataVersion]);
    return `ai1-${cyrb53(key).toString(16).padStart(14, '0')}`;
  }

  /** Input tokens of the phase-A request (CR-008). */
  estimatePlan(deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, settings = this.settings()): number {
    const prompt = buildPlanPrompt(deck, cards, settings.scope, settings.goal, settings.staged);
    return estimateTokens(prompt.system + prompt.user + JSON.stringify(PLAN_JSON_SCHEMA));
  }

  /** What a phased analysis can use at most: phase A plus one request per combination (CR-008). */
  estimateStaged(deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, settings = this.settings()): { planInput: number; comboInput: number; requests: number; tokens: number } {
    const first = deck.main[0]?.cardId ?? 0;
    const sample: PlannedCombo = { cardIds: [first], size: 1, priority: 1, reason: '', targetExtraIds: [], target: '' };
    const prompt = buildComboPrompt(deck, cards, sample, settings.scope, settings.goal, settings.staged);
    const comboInput = estimateTokens(prompt.system + prompt.user + JSON.stringify(AI_OUTPUT_JSON_SCHEMA_V3));
    const planInput = this.estimatePlan(deck, cards, settings);
    const requests = Math.min(settings.staged.maxRequests, 1 + settings.staged.maxCombos);
    const tokens = planInput + ESTIMATED_PLAN_OUTPUT + (requests - 1) * (comboInput + ESTIMATED_ROUTE_OUTPUT * settings.staged.routesPerCombo);
    return { planInput, comboInput, requests, tokens };
  }

  /** Worst-case cost before sending (cloud only). */
  estimate(deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, settings = this.settings()): { inputTokens: number; maxCostUsd?: number } {
    const prompt = buildPrompt(deck, cards, settings.scope, settings.goal);
    const inputTokens = estimateTokens(prompt.system + prompt.user + JSON.stringify(AI_OUTPUT_JSON_SCHEMA));
    return { inputTokens, ...(settings.provider === 'anthropic' ? { maxCostUsd: costUsd(settings.claudeModel, inputTokens, settings.maxOutputTokens) } : {}) };
  }

  // ---- run ------------------------------------------------------------------------------

  cancel(): void {
    this.cancelRequested = true;
    this.controller?.abort();
  }

  /**
   * Runs (or reuses) an analysis for `deck`. Resolves with the run record, also when it failed;
   * rejects only when preflight fails (nothing is sent then).
   */
  async start(deck: DeckRecord, options: { force?: boolean } = {}): Promise<AnalysisRun> {
    if (this.running) throw new Error('已有分析正在進行');
    this.running = true;
    try {
      return await this.run(deck, options);
    } finally {
      this.running = false;
    }
  }

  private async run(deck: DeckRecord, options: { force?: boolean }): Promise<AnalysisRun> {
    this.state.set({ phase: 'preparing', receivedChars: 0, startedAt: Date.now() });
    const settings = this.settings();
    const apiKey = this.apiKey();
    const cards = await this.cardData.getMany([...deck.main, ...deck.extra].map((r) => r.cardId));
    const reasons = await this.preflight(deck, cards, settings, apiKey);
    if (reasons.length) {
      this.state.set({ phase: 'idle', receivedChars: 0 });
      throw new Error(reasons.join('\n'));
    }

    const fingerprint = deckFingerprint(deck);
    const cardDataVersion = await this.cardDataVersion(deck, cards);
    const cacheKey = this.cacheKey(deck, cardDataVersion, settings);
    if (!options.force) {
      const cached = (await this.listRuns(deck.id)).find((r) => r.status === 'succeeded' && r.cacheKey === cacheKey);
      if (cached) {
        this.state.set({ phase: 'done', receivedChars: 0, runId: cached.id, fromCache: true });
        return cached;
      }
    }

    const model = settings.provider === 'anthropic' ? settings.claudeModel : settings.provider === 'chatgpt' ? settings.chatgptModel : settings.ollamaModel.trim();
    const startedAt = new Date().toISOString();
    const run: AnalysisRun = {
      id: crypto.randomUUID(),
      deckId: deck.id,
      deckName: deck.name,
      deckVersion: deck.version,
      deckFingerprint: fingerprint,
      cardDataVersion,
      assumptions: [...MD_ASSUMPTIONS],
      provider: settings.provider,
      model,
      params:
        settings.provider === 'anthropic'
          ? { effort: settings.effort, maxOutputTokens: settings.maxOutputTokens, timeoutSeconds: settings.timeoutSeconds }
          : settings.provider === 'chatgpt'
            ? { timeoutSeconds: settings.timeoutSeconds, store: false, stream: true, structuredOutput: true }
            : { maxOutputTokens: settings.maxOutputTokens, timeoutSeconds: settings.timeoutSeconds, temperature: 0 },
      scope: { ...settings.scope },
      goal: goalForDeck(settings.goal, deck),
      promptVersion: PROMPT_VERSION,
      cacheKey,
      startedAt,
      finishedAt: startedAt,
      durationMs: 0,
      status: 'failed',
    };

    const prompt = buildPrompt(deck, cards, settings.scope, settings.goal);
    const request = { ...prompt, schema: AI_OUTPUT_JSON_SCHEMA, maxOutputTokens: settings.maxOutputTokens };
    // Counted before sending, so failures and cancellations also count toward the daily limit.
    await this.addUsage({ requests: 1 });
    this.controller = new AbortController();
    this.timedOut = false;
    const timer = setTimeout(() => {
      this.timedOut = true;
      this.controller?.abort();
    }, settings.timeoutSeconds * 1000);
    const t0 = Date.now();
    this.state.set({ phase: 'requesting', receivedChars: 0, startedAt: t0, runId: run.id });

    let result: AiResult | undefined;
    try {
      const callOptions = { signal: this.controller.signal, fetch: this.fetchFn, onProgress: (n: number) => this.state.update((s) => ({ ...s, receivedChars: n })) };
      if (settings.provider === 'chatgpt') {
        const answer = await callChatGpt({ model }, request, callOptions);
        run.params.structuredOutput = answer.structuredOutput;
        result = answer;
      } else {
        result =
          settings.provider === 'anthropic'
            ? await callAnthropic({ apiKey, model, effort: settings.effort, timeoutMs: settings.timeoutSeconds * 1000 }, request, callOptions)
            : await callOllama({ baseUrl: settings.ollamaBaseUrl, model }, request, callOptions);
      }
      this.state.update((s) => ({ ...s, phase: 'validating' }));
      if (result.usage) {
        const estimatedCostUsd = settings.provider === 'anthropic' ? costUsd(model, result.usage.inputTokens, result.usage.outputTokens) : undefined;
        run.usage = { ...result.usage, ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}) };
        await this.addUsage({ inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, estimatedCostUsd: estimatedCostUsd ?? 0 });
      }
      run.servedModel = result.model;
      const parsed = parseAiOutput(result.text);
      if (!parsed.ok) throw new AiError('bad-format', parsed.error);

      const now = new Date().toISOString();
      const name = (id: number) => cards.get(id)?.nameEn ?? `ID ${id}`;
      const ctx = { runId: run.id, deck, deckFingerprint: fingerprint, cardDataVersion, provider: settings.provider, model, servedModel: result.model, promptVersion: PROMPT_VERSION, cards, now };
      const { starters, extenders } = toStarters(parsed.output, deck, name);
      run.summary = parsed.output.summary.slice(0, 4000);
      run.starters = starters;
      run.extenders = extenders;
      run.candidates = parsed.output.routes.map((r) => toCandidate(r, ctx));
      run.explored = toExplored(parsed.output);
      run.status = 'succeeded';
    } catch (error) {
      const e =
        error instanceof AiError
          ? error.code === 'cancelled' && this.timedOut
            ? new AiError('timeout', `超過 ${settings.timeoutSeconds} 秒未完成，已自動中止`)
            : error
          : new AiError('unknown', error instanceof Error ? error.message : String(error));
      run.status = e.code === 'cancelled' ? 'cancelled' : 'failed';
      run.error = { code: e.code, message: e.message.slice(0, 1000) };
    } finally {
      clearTimeout(timer);
      this.controller = undefined;
    }
    run.finishedAt = new Date().toISOString();
    run.durationMs = Date.now() - t0;
    await this.saveRun(run);
    this.state.set({
      phase: run.status === 'succeeded' ? 'done' : run.status === 'cancelled' ? 'cancelled' : 'failed',
      receivedChars: this.state().receivedChars,
      runId: run.id,
      ...(run.error ? { message: run.error.message } : {}),
    });
    return run;
  }

  // ---- phased analysis of 1–3 card starters (CR-008) ---------------------------------------------

  /** One request to the provider. The per-request timeout and the user's cancel abort it. */
  private async send(settings: AiSettings, apiKey: string, model: string, request: Omit<AiRequest, 'maxOutputTokens'>): Promise<AiResult> {
    this.controller = new AbortController();
    this.timedOut = false;
    const timer = setTimeout(() => {
      this.timedOut = true;
      this.controller?.abort();
    }, settings.timeoutSeconds * 1000);
    this.state.update((s) => ({ ...s, phase: 'requesting', receivedChars: 0 }));
    try {
      const full: AiRequest = { ...request, maxOutputTokens: settings.maxOutputTokens };
      const options = { signal: this.controller.signal, fetch: this.fetchFn, onProgress: (n: number) => this.state.update((s) => ({ ...s, receivedChars: n })) };
      if (settings.provider === 'chatgpt') return await callChatGpt({ model }, full, options);
      return settings.provider === 'anthropic'
        ? await callAnthropic({ apiKey, model, effort: settings.effort, timeoutMs: settings.timeoutSeconds * 1000 }, full, options)
        : await callOllama({ baseUrl: settings.ollamaBaseUrl, model }, full, options);
    } catch (error) {
      if (error instanceof AiError && error.code === 'cancelled' && this.timedOut) throw new AiError('timeout', `超過 ${settings.timeoutSeconds} 秒未完成，已自動中止`);
      throw error;
    } finally {
      clearTimeout(timer);
      this.controller = undefined;
    }
  }

  /**
   * Phased analysis: A (roles and starter combinations) → B (one request per accepted combination) →
   * C/D (local checks and comparison, done when the results are shown). Every request is checked against
   * the request limit, the token budget, the total time and the daily limit BEFORE it is sent; what is
   * finished is kept when a limit is hit, and the combinations not analysed are listed. It never claims
   * to have covered every possible line.
   */
  async startStaged(deck: DeckRecord, options: { force?: boolean } = {}): Promise<AnalysisRun> {
    if (this.running) throw new Error('已有分析正在進行');
    this.running = true;
    try {
      return await this.runStaged(deck, options);
    } finally {
      this.running = false;
    }
  }

  private async runStaged(deck: DeckRecord, options: { force?: boolean }): Promise<AnalysisRun> {
    this.cancelRequested = false;
    this.state.set({ phase: 'preparing', receivedChars: 0, startedAt: Date.now() });
    const settings = this.settings();
    const apiKey = this.apiKey();
    const staged = settings.staged;
    const cards = await this.cardData.getMany([...deck.main, ...deck.extra].map((r) => r.cardId));
    const reasons = await this.preflight(deck, cards, settings, apiKey);
    if (reasons.length) {
      this.state.set({ phase: 'idle', receivedChars: 0 });
      throw new Error(reasons.join('\n'));
    }

    const fingerprint = deckFingerprint(deck);
    const cardDataVersion = await this.cardDataVersion(deck, cards);
    const cacheKey = this.cacheKey(deck, cardDataVersion, settings);
    if (!options.force) {
      const cached = (await this.listRuns(deck.id)).find((r) => r.status === 'succeeded' && r.cacheKey === cacheKey);
      if (cached) {
        this.state.set({ phase: 'done', receivedChars: 0, runId: cached.id, fromCache: true });
        return cached;
      }
    }

    const model = settings.provider === 'anthropic' ? settings.claudeModel : settings.provider === 'chatgpt' ? settings.chatgptModel : settings.ollamaModel.trim();
    const startedAt = new Date().toISOString();
    const record: StagedRecord = { combos: [], rejected: [], budget: { maxRequests: staged.maxRequests, tokenBudget: staged.tokenBudget, requests: 0, tokens: 0, stoppedBy: null }, notAnalyzed: 0, failed: 0, exhaustive: false };
    const run: AnalysisRun = {
      id: crypto.randomUUID(),
      deckId: deck.id,
      deckName: deck.name,
      deckVersion: deck.version,
      deckFingerprint: fingerprint,
      cardDataVersion,
      assumptions: [...MD_ASSUMPTIONS],
      provider: settings.provider,
      model,
      params:
        settings.provider === 'anthropic'
          ? { effort: settings.effort, maxOutputTokens: settings.maxOutputTokens, timeoutSeconds: settings.timeoutSeconds }
          : settings.provider === 'chatgpt'
            ? { timeoutSeconds: settings.timeoutSeconds, store: false, stream: true, structuredOutput: true }
            : { maxOutputTokens: settings.maxOutputTokens, timeoutSeconds: settings.timeoutSeconds, temperature: 0 },
      scope: { ...settings.scope },
      goal: goalForDeck(settings.goal, deck),
      promptVersion: STAGED_PROMPT_VERSION,
      cacheKey,
      startedAt,
      finishedAt: startedAt,
      durationMs: 0,
      status: 'failed',
      staged: record,
    };

    const budget: Budget = { maxRequests: staged.maxRequests, tokenBudget: staged.tokenBudget, requests: 0, tokens: 0, startedAt: Date.now(), totalTimeoutMs: staged.totalTimeoutSeconds * 1000 };
    const t0 = Date.now();
    const name = (id: number) => cards.get(id)?.nameEn ?? `ID ${id}`;
    let usageIn = 0;
    let usageOut = 0;
    const sync = () => (record.budget = { ...record.budget, requests: budget.requests, tokens: budget.tokens });
    const guard = async (estimate: number): Promise<StopReason | null> =>
      this.cancelRequested ? 'cancelled' : stopReason(budget, { tokens: estimate }, Date.now(), settings.dailyRequestLimit - (await this.usageToday()).requests);
    /** Counts a request that is about to be sent (failures and cancellations count too). */
    const begin = async () => {
      budget.requests += 1;
      await this.addUsage({ requests: 1 });
    };
    /** Adds what the answer used (the estimate when the provider reported nothing). */
    const spend = async (result: AiResult | undefined, estimate: number) => {
      if (!result?.usage) {
        budget.tokens += estimate;
        return;
      }
      budget.tokens += result.usage.inputTokens + result.usage.outputTokens;
      usageIn += result.usage.inputTokens;
      usageOut += result.usage.outputTokens;
      const estimatedCostUsd = settings.provider === 'anthropic' ? costUsd(model, result.usage.inputTokens, result.usage.outputTokens) : undefined;
      await this.addUsage({ inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, estimatedCostUsd: estimatedCostUsd ?? 0 });
    };
    const finish = async (): Promise<AnalysisRun> => {
      sync();
      run.finishedAt = new Date().toISOString();
      run.durationMs = Date.now() - t0;
      await this.saveRun(run);
      this.state.set({ phase: run.status === 'succeeded' ? 'done' : run.status === 'cancelled' ? 'cancelled' : 'failed', receivedChars: this.state().receivedChars, runId: run.id, ...(run.error ? { message: run.error.message } : {}) });
      return run;
    };
    const asAiError = (error: unknown) => (error instanceof AiError ? error : new AiError('unknown', error instanceof Error ? error.message : String(error)));

    // Phase A: roles and starter combinations.
    this.state.update((s) => ({ ...s, progress: '階段 A：標示卡片角色，提出候選起手組合' }));
    const planPrompt = buildPlanPrompt(deck, cards, settings.scope, settings.goal, staged);
    const planEstimate = estimateTokens(planPrompt.system + planPrompt.user + JSON.stringify(PLAN_JSON_SCHEMA)) + ESTIMATED_PLAN_OUTPUT;
    const blocked = await guard(planEstimate);
    if (blocked) {
      this.state.set({ phase: 'idle', receivedChars: 0 });
      throw new Error(`無法送出階段 A：${STOP_LABEL[blocked]}`);
    }
    await begin();
    let plan: Extract<ReturnType<typeof parsePlan>, { ok: true }>;
    let planResult: AiResult | undefined;
    try {
      const result = await this.send(settings, apiKey, model, { ...planPrompt, schema: PLAN_JSON_SCHEMA });
      planResult = result;
      await spend(result, planEstimate);
      const parsed = parsePlan(result.text);
      if (!parsed.ok) throw new AiError('bad-format', parsed.error);
      plan = parsed;
    } catch (error) {
      if (!planResult) await spend(undefined, planEstimate);
      const e = asAiError(error);
      run.status = e.code === 'cancelled' ? 'cancelled' : 'failed';
      run.error = { code: e.code, message: e.message.slice(0, 1000) };
      return finish();
    }
    const inDeck = new Set([...deck.main, ...deck.extra].map((r) => r.cardId));
    record.plan = { summary: plan.plan.summary.slice(0, 4000), roles: plan.plan.roles.filter((r) => inDeck.has(r.cardId)).map((r) => ({ cardId: r.cardId, roles: r.roles, note: r.note.slice(0, 300) })) };
    const picked = selectCombos(plan.plan, deck, selectedSizes(settings.scope), staged.maxCombos, name);
    record.rejected = picked.rejected;
    record.combos = picked.combos.map((c): StagedCombo => ({ ...c, status: 'skipped', routes: 0 }));

    // Phase B: the routes of each accepted combination, best priority first.
    const candidates: Candidate[] = [];
    const explored: ExploredEntry[] = [];
    const ctx = { runId: run.id, deck, deckFingerprint: fingerprint, cardDataVersion, provider: settings.provider, model, promptVersion: STAGED_PROMPT_VERSION, cards, now: new Date().toISOString() };
    for (const [i, entry] of record.combos.entries()) {
      this.state.update((s) => ({ ...s, progress: `階段 B：第 ${i + 1}／${record.combos.length} 個組合（${entry.cardIds.map(name).join('＋')}）` }));
      const prompt = buildComboPrompt(deck, cards, entry, settings.scope, settings.goal, staged);
      const estimate = estimateTokens(prompt.system + prompt.user + JSON.stringify(AI_OUTPUT_JSON_SCHEMA_V3)) + ESTIMATED_ROUTE_OUTPUT * staged.routesPerCombo;
      const stop = await guard(estimate);
      if (stop) {
        record.budget.stoppedBy = stop;
        break;
      }
      await begin();
      let answered: AiResult | undefined;
      try {
        const result = await this.send(settings, apiKey, model, { ...prompt, schema: AI_OUTPUT_JSON_SCHEMA_V3 });
        answered = result;
        await spend(result, estimate);
        if (result.usage) entry.usage = result.usage;
        const parsed = parseAiOutput(result.text);
        if (!parsed.ok) throw new AiError('bad-format', parsed.error);
        const made = parsed.output.routes.slice(0, staged.routesPerCombo).map((r) => toCandidate(r, { ...ctx, servedModel: result.model }));
        candidates.push(...made);
        explored.push(...toExplored(parsed.output));
        entry.routes = made.length;
        entry.status = 'done';
      } catch (error) {
        if (!answered) await spend(undefined, estimate);
        const e = asAiError(error);
        entry.error = e.message.slice(0, 500);
        if (e.code === 'cancelled') {
          entry.status = 'cancelled';
          record.budget.stoppedBy = 'cancelled';
          break;
        }
        entry.status = e.code === 'truncated' ? 'truncated' : 'failed';
        if (['auth', 'permission', 'usage-limit', 'config'].includes(e.code)) {
          record.budget.stoppedBy = 'error';
          break;
        }
      }
    }
    for (const entry of record.combos) if (entry.status === 'skipped' || entry.status === 'cancelled') entry.skippedBy = record.budget.stoppedBy ?? undefined;
    record.notAnalyzed = record.combos.filter((c) => c.status === 'skipped' || c.status === 'cancelled').length;
    record.failed = record.combos.filter((c) => c.status === 'failed' || c.status === 'truncated').length;

    const stoppedBy = record.budget.stoppedBy;
    run.candidates = candidates;
    run.explored = explored;
    run.starters = record.combos.map((c) => ({ cardIds: c.cardIds, kind: c.size === 1 ? 'single' : 'multi', description: c.reason || '（AI 提出的起手組合）' }));
    run.extenders = [];
    if (usageIn || usageOut) {
      const estimatedCostUsd = settings.provider === 'anthropic' ? costUsd(model, usageIn, usageOut) : undefined;
      run.usage = { inputTokens: usageIn, outputTokens: usageOut, ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}) };
    }
    const notes = [
      record.combos.length === 0 ? '沒有可分析的起手組合（AI 提出的組合都不符合條件，原因見「被捨棄的組合」）' : '',
      record.notAnalyzed ? `未分析 ${record.notAnalyzed} 個組合${stoppedBy ? `（${STOP_LABEL[stoppedBy]}）` : ''}` : '',
      record.failed ? `失敗 ${record.failed} 個組合（輸出被截斷或格式錯誤，沒有收錄任何不完整的路線）` : '',
      '以上只涵蓋 AI 提出的起手組合，不代表已窮舉所有展開',
    ]
      .filter(Boolean)
      .join('；');
    run.summary = `${record.plan.summary}\n\n${notes}。`.slice(0, 4000);
    if (this.cancelRequested || stoppedBy === 'cancelled') {
      run.status = 'cancelled';
      run.error = { code: 'cancelled', message: '已取消；已完成的組合結果保留' };
    } else run.status = 'succeeded';
    return finish();
  }

  // ---- ChatGPT account (CR-005) -------------------------------------------------------------

  /** Reads the bridge status and, when plan usage is granted, the account's actual model list. */
  async refreshChatGpt(): Promise<void> {
    const status = await chatGptStatus(this.fetchFn);
    this.chatgpt.set(status);
    if (!status.sharing) {
      this.chatgptModels.set(null);
      return;
    }
    try {
      this.chatgptModels.set(await chatGptModels(this.fetchFn));
      this.chatgptError.set('');
    } catch (error) {
      this.chatgptModels.set(null);
      this.chatgptError.set(`無法取得模型清單：${error instanceof Error ? error.message : String(error)}`);
    }
    const seen = await (await this.appDb.db()).get('meta', CHATGPT_WELCOME_KEY);
    this.chatgptWelcomeSeen.set(!!seen);
  }

  /** The official sign-in page to open (the bridge starts the loopback callback first). */
  chatgptSignIn(): Promise<string> {
    return chatGptSignIn(this.fetchFn);
  }

  async chatgptSignOut(forget = false): Promise<{ revoked: boolean; message?: string }> {
    const result = await chatGptSignOut(this.fetchFn, forget);
    await this.refreshChatGpt();
    return result;
  }

  async dismissChatGptWelcome(): Promise<void> {
    this.chatgptWelcomeSeen.set(true);
    await (await this.appDb.db()).put('meta', { key: CHATGPT_WELCOME_KEY, value: true });
  }

  // ---- candidates -----------------------------------------------------------------------

  /** Saves a candidate as an ordinary Combo (draft or unverified — never verified). */
  async saveCandidate(run: AnalysisRun, index: number): Promise<ComboRoute> {
    const candidate = run.candidates?.[index];
    if (!candidate) throw new Error('找不到此候選路線');
    if (candidate.savedComboId) {
      const existing = await this.combos.get(candidate.savedComboId);
      if (existing) return existing;
    }
    const result = validateCombo(candidate.route);
    if (!result.ok) throw new Error(`無法存成 Combo：${result.errors.join('；')}`);
    const now = new Date().toISOString();
    const route: ComboRoute = { ...result.route!, id: crypto.randomUUID(), version: 1, createdAt: now, updatedAt: now };
    await this.combos.save(route);
    candidate.savedComboId = route.id;
    await this.saveRun(run);
    return route;
  }

  /** Re-runs the data check of a candidate against the deck as it is now (G25-4). */
  async recheckCandidate(run: AnalysisRun, index: number, deck: DeckRecord): Promise<Candidate> {
    const candidate = run.candidates?.[index];
    if (!candidate) throw new Error('找不到此候選路線');
    const cards = await this.cardData.getMany([...deck.main, ...deck.extra].map((r) => r.cardId));
    const next = { ...withCheck(candidate.route, deck, cards, new Date().toISOString(), deckFingerprint(deck)), ...(candidate.savedComboId ? { savedComboId: candidate.savedComboId } : {}) };
    run.candidates![index] = next;
    await this.saveRun(run);
    return next;
  }

  async deleteCandidate(run: AnalysisRun, index: number): Promise<void> {
    run.candidates = (run.candidates ?? []).filter((_, i) => i !== index);
    await this.saveRun(run);
  }

  /** Re-checks a saved AI Combo against `deck` and stores the new check record (status unchanged). */
  async recheckCombo(route: ComboRoute, deck: DeckRecord): Promise<ComboRoute> {
    if (!route.analysis) throw new Error('這不是 AI 產生的路線');
    const cards = await this.cardData.getMany([...deck.main, ...deck.extra].map((r) => r.cardId));
    const checked = withCheck(route, deck, cards, new Date().toISOString(), deckFingerprint(deck)).route;
    const next: ComboRoute = { ...route, analysis: checked.analysis, version: route.version + 1, updatedAt: new Date().toISOString() };
    const result = validateCombo(next);
    if (!result.ok) throw new Error(result.errors.join('；'));
    await this.combos.save(next);
    return next;
  }
}
