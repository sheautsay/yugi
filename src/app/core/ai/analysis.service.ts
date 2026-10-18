import { Injectable, inject, signal } from '@angular/core';
import { CardDataService } from '../card-data.service';
import { ComboRepository } from '../combo-repository';
import { checkDeck, cyrb53, deckFingerprint } from '../deck';
import { CardRecord, ComboRoute, DeckRecord } from '../models';
import { AiRunStore } from './ai-run-store.service';
import { AiSettings, estimateTokens } from './ai-settings';
import { AiSettingsService } from './ai-settings.service';
import { AI_OUTPUT_JSON_SCHEMA, AI_OUTPUT_JSON_SCHEMA_V3, Candidate, parseAiOutput, toCandidate, toExplored, toStarters } from './analysis-output';
import { goalForDeck } from './analysis-goal';
import { AnalysisRun, ExploredEntry, RunState } from './analysis-types';
import { CandidateService } from './candidate.service';
import { ChatGptAccountService } from './chatgpt-account.service';
import { OllamaCheck } from './ollama-check';
import { providerAdapter } from './provider-adapters';
import { MD_ASSUMPTIONS, PROMPT_VERSION, buildPrompt, cardsWithoutText, linkCardsWithoutArrows } from './prompt';
import {
  Budget,
  ESTIMATED_PLAN_OUTPUT,
  ESTIMATED_ROUTE_OUTPUT,
  PLAN_JSON_SCHEMA,
  PlannedCombo,
  STAGED_PROMPT_VERSION,
  STOP_LABEL,
  StagedCombo,
  StagedRecord,
  StopReason,
  buildComboPrompt,
  buildPlanPrompt,
  parsePlan,
  selectCombos,
  selectedSizes,
  stopReason,
} from './staged';
import { AI_FETCH, AiCallOptions, AiError, AiRequest, AiResult } from './providers';

// Public API of the analysis stays here; the pieces live next to it:
//   ai-settings(.service)   settings, limits, per-tab key, daily usage
//   provider-adapters       everything that differs between Claude API / Ollama / ChatGPT
//   ai-run-store.service    stored runs
//   chatgpt-account.service ChatGPT account (refresh / sign in / sign out / welcome)
//   candidate.service       save / re-check / delete candidate routes
// CR-004 orchestration: preflight → cache → one request (timeout / cancel / progress) →
// schema validation → conversion + local data check → run record. It never writes decks or
// combos, except when the user explicitly saves a candidate.

export * from './ai-settings';
export * from './analysis-types';
export { API_KEY_STORAGE } from './ai-settings.service';
export { costUsd } from './ai-settings';

@Injectable({ providedIn: 'root' })
export class AiAnalysisService {
  private readonly cardData = inject(CardDataService);
  private readonly config = inject(AiSettingsService);
  private readonly runs = inject(AiRunStore);
  private readonly account = inject(ChatGptAccountService);
  private readonly candidates = inject(CandidateService);

  // Settings, key and Ollama check.
  readonly providers = this.config.providers;
  readonly settings = this.config.settings;
  readonly apiKey = this.config.apiKey;
  readonly ollamaCheck = this.config.ollamaCheck;
  readonly ollamaChecking = this.config.ollamaChecking;
  readonly ready = this.config.ready;
  // ChatGPT account.
  readonly chatgpt = this.account.status;
  readonly chatgptModels = this.account.models;
  readonly chatgptError = this.account.error;
  readonly chatgptWelcomeSeen = this.account.welcomeSeen;

  readonly state = signal<RunState>({ phase: 'idle', receivedChars: 0 });

  private readonly fetchFn = inject(AI_FETCH);
  private controller?: AbortController;
  private timedOut = false;
  private running = false;
  /** CR-008: the user asked to stop; a phased analysis checks it between requests. */
  private cancelRequested = false;

  updateSettings(patch: Partial<AiSettings>): Promise<void> {
    return this.config.updateSettings(patch);
  }

  checkOllama(): Promise<OllamaCheck> {
    return this.config.checkOllama();
  }

  setApiKey(key: string): void {
    this.config.setApiKey(key);
  }

  // ---- usage & runs ---------------------------------------------------------------------

  usageToday() {
    return this.config.usageToday();
  }

  private addUsage(patch: Parameters<AiSettingsService['addUsage']>[0]): Promise<void> {
    return this.config.addUsage(patch);
  }

  listRuns(deckId?: string): Promise<AnalysisRun[]> {
    return this.runs.listRuns(deckId);
  }

  getRun(id: string): Promise<AnalysisRun | undefined> {
    return this.runs.getRun(id);
  }

  saveRun(run: AnalysisRun): Promise<void> {
    return this.runs.saveRun(run);
  }

  deleteRun(id: string): Promise<void> {
    return this.runs.deleteRun(id);
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
    reasons.push(...providerAdapter(settings.provider).preflight({ settings, apiKey, chatgpt: this.chatgpt(), chatgptModels: this.chatgptModels() }));
    const usage = await this.usageToday();
    if (usage.requests >= settings.dailyRequestLimit) reasons.push(`今天已送出 ${usage.requests} 次分析請求，達到每日上限 ${settings.dailyRequestLimit} 次`);
    return reasons;
  }

  cacheKey(deck: DeckRecord, cardDataVersion: string, settings = this.settings()): string {
    const model = providerAdapter(settings.provider).cacheKeyParts(settings);
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

  /** Worst-case cost before sending (providers with a price list only). */
  estimate(deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, settings = this.settings()): { inputTokens: number; maxCostUsd?: number } {
    const prompt = buildPrompt(deck, cards, settings.scope, settings.goal);
    const inputTokens = estimateTokens(prompt.system + prompt.user + JSON.stringify(AI_OUTPUT_JSON_SCHEMA));
    const maxCostUsd = providerAdapter(settings.provider).costUsd(this.modelName(settings), inputTokens, settings.maxOutputTokens);
    return { inputTokens, ...(settings.provider === 'anthropic' ? { maxCostUsd } : {}) };
  }

  private modelName(settings: AiSettings): string {
    return providerAdapter(settings.provider).modelOf(settings);
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
    const adapter = providerAdapter(settings.provider);
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

    const model = adapter.modelOf(settings);
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
      params: adapter.runParams(settings),
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

    let result: (AiResult & { structuredOutput?: boolean }) | undefined;
    try {
      const callOptions = { signal: this.controller.signal, fetch: this.fetchFn, onProgress: (n: number) => this.state.update((s) => ({ ...s, receivedChars: n })) };
      result = await adapter.call(settings, apiKey, request, callOptions);
      if (result.structuredOutput !== undefined) run.params.structuredOutput = result.structuredOutput;
      this.state.update((s) => ({ ...s, phase: 'validating' }));
      if (result.usage) {
        const estimatedCostUsd = adapter.costUsd(model, result.usage.inputTokens, result.usage.outputTokens);
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
      return await providerAdapter(settings.provider).call(settings, apiKey, full, options);
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
    const adapter = providerAdapter(settings.provider);
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

    const model = adapter.modelOf(settings);
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
      params: adapter.runParams(settings),
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
      const estimatedCostUsd = adapter.costUsd(model, result.usage.inputTokens, result.usage.outputTokens);
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
      const estimatedCostUsd = adapter.costUsd(model, usageIn, usageOut);
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

  refreshChatGpt(): Promise<void> {
    return this.account.refresh();
  }

  chatgptSignIn(): Promise<string> {
    return this.account.signIn();
  }

  chatgptSignOut(forget = false): Promise<{ revoked: boolean; message?: string }> {
    return this.account.signOut(forget);
  }

  dismissChatGptWelcome(): Promise<void> {
    return this.account.dismissWelcome();
  }

  // ---- candidates -----------------------------------------------------------------------

  saveCandidate(run: AnalysisRun, index: number): Promise<ComboRoute> {
    return this.candidates.saveCandidate(run, index);
  }

  recheckCandidate(run: AnalysisRun, index: number, deck: DeckRecord): Promise<Candidate> {
    return this.candidates.recheckCandidate(run, index, deck);
  }

  deleteCandidate(run: AnalysisRun, index: number): Promise<void> {
    return this.candidates.deleteCandidate(run, index);
  }

  recheckCombo(route: ComboRoute, deck: DeckRecord): Promise<ComboRoute> {
    return this.candidates.recheckCombo(route, deck);
  }
}
