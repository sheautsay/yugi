import { CardNamesService } from '../../core/card-names.service';
import { ChangeDetectionStrategy, Component, DestroyRef, forwardRef, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AnalysisGoalKind, GOAL_KINDS, GOAL_LABEL } from '../../core/ai/analysis-goal';
import { AiAnalysisService, AiSettings, AnalysisRun, Phase, SETTING_LIMITS, TOKENS_PER_ROUTE } from '../../core/ai/analysis.service';
import { BRIDGE_COMMAND, MANAGE_USAGE_URL, bridgeHints } from '../../core/ai/chatgpt';
import { endSnapshot } from '../../core/ai/board-snapshot';
import { RankedCandidate, RouteEvaluation, START_KIND_LABEL, StartKind, analyzeCandidates, groupBySize, handText, addedValue, siblingOverlap } from '../../core/ai/evaluate';
import { generatedRoutes } from '../../core/ai/prompt';
import { ROLE_LABEL, STAGED_LIMITS, STOP_LABEL, StagedStatus } from '../../core/ai/staged';
import { CLAUDE_MODELS, Effort } from '../../core/ai/providers';
import { analysisLevel } from '../../core/analysis-level';
import { CardDataService } from '../../core/card-data.service';
import { EFFORT_LABEL, TEXT, pct } from '../../core/texts';
import { comboCardIds } from '../../core/combo';
import { ComboRepository } from '../../core/combo-repository';
import { checkDeck, deckFingerprint } from '../../core/deck';
import { checkFtkRoute, isFtkRoute } from '../../core/ftk-check';
import { DeckRepository } from '../../core/deck-repository';
import { ANALYSIS_LEVEL_LABEL, PROVIDER_LABEL } from '../../core/labels';
import { AnalysisLevel, CardRecord, ComboInfo, ComboRoute, DeckRecord } from '../../core/models';
import { checkRoute } from '../../core/route-check';
import { localDateTime } from '../../core/time';
import { CardDataPrompt } from '../../shared/card-data-prompt';
import { MissingCards } from '../../shared/missing-cards';
import { openExternal } from '../../shared/open-external';
import { focusApp, hasExternalOpener } from '../../shared/platform-hooks';
import { ViewerMode } from '../../shared/combo/combo-viewer';
import { ANALYSIS_PAGE } from './analysis-context';
import { AnalysisHistory } from './analysis-history';
import { AnalysisResults } from './analysis-results';
import { AnalysisSettings } from './analysis-settings';

const PHASE_LABEL: Record<Phase, string> = {
  idle: '尚未開始',
  preparing: '準備資料',
  requesting: '等待模型回應',
  validating: '驗證結果',
  done: '完成',
  failed: '失敗',
  cancelled: '已取消',
};

/** CR-004: AI deck combo analysis for one deck (route /decks/:deckId/analysis). */
@Component({
  selector: 'app-analysis-page',
  imports: [RouterLink, CardDataPrompt, MissingCards, AnalysisSettings, AnalysisHistory, AnalysisResults],
  providers: [{ provide: ANALYSIS_PAGE, useExisting: forwardRef(() => AnalysisPage) }],
  templateUrl: './analysis-page.html',
  styleUrl: './analysis-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisPage {
  readonly ai = inject(AiAnalysisService);
  private readonly decks = inject(DeckRepository);
  private readonly combos = inject(ComboRepository);
  private readonly cardData = inject(CardDataService);
  readonly hasCardData = this.cardData.hasData;
  private readonly router = inject(Router);

  readonly deckId = input.required<string>();

  readonly models = CLAUDE_MODELS;
  readonly providerLabel = PROVIDER_LABEL;
  readonly time = localDateTime;
  readonly manageUsageUrl = MANAGE_USAGE_URL;
  readonly bridgeCommand = BRIDGE_COMMAND;
  /** Whether this build offers a model service (the Windows app offers only the ChatGPT account). */
  offers = (id: 'anthropic' | 'ollama' | 'chatgpt') => this.ai.providers.includes(id);
  /** Desktop: the app starts the local ChatGPT service itself, so there is no command to run. */
  readonly bridgeManaged = () => bridgeHints().managed;
  readonly chatgptMessage = signal('');
  /** 進階設定 (candidate counts, limits, budgets) start folded so the common settings stay in front (CR-012). */
  readonly advancedOpen = signal(false);
  private pollTimer?: ReturnType<typeof setTimeout>;
  readonly efforts: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
  readonly effortLabel = EFFORT_LABEL;
  readonly texts = TEXT;
  readonly limits = SETTING_LIMITS;
  readonly phaseLabel = PHASE_LABEL;
  readonly levelLabel = ANALYSIS_LEVEL_LABEL;
  readonly goalKinds = GOAL_KINDS;
  readonly goalLabel = GOAL_LABEL;
  readonly startKindLabel = START_KIND_LABEL;
  readonly handText = handText;
  readonly generated = generatedRoutes;
  readonly stagedLimits = STAGED_LIMITS;
  readonly roleLabel = ROLE_LABEL;
  readonly stopLabel = STOP_LABEL;
  readonly comboStatusLabel: Record<StagedStatus, string> = { done: '完成', failed: '失敗', truncated: '輸出被截斷（沒有收錄不完整的路線）', cancelled: '已取消', skipped: '尚未分析' };
  /** CR-008 G52-3: routes picked for the side-by-side view (candidate indexes, at most 3). */
  readonly compareSet = signal<number[]>([]);
  /** Re-ranking of the selected run by another goal (local only, no new request); null = the run's goal. */
  readonly sortGoal = signal<AnalysisGoalKind | null>(null);

  readonly deck = signal<DeckRecord | null>(null);
  readonly notFound = signal(false);
  readonly cards = signal(new Map<number, CardRecord>());
  readonly runs = signal<AnalysisRun[]>([]);
  readonly selectedRunId = signal<string | null>(null);
  readonly viewing = signal<number | null>(null);
  readonly savedRoutes = signal<ComboRoute[]>([]);
  readonly reasons = signal<string[]>([]);
  readonly usage = signal<{ requests: number; estimatedCostUsd: number } | null>(null);
  readonly message = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly now = signal(Date.now());
  readonly viewerMode = signal<ViewerMode>('flow');

  private readonly cardNames = inject(CardNamesService);
  readonly name = (id: number) => {
    const card = this.cards().get(id);
    return card ? this.cardNames.labelOf(id, card) : `ID ${id}`;
  };
  readonly fingerprint = computed(() => {
    const deck = this.deck();
    return deck ? deckFingerprint(deck) : '';
  });
  readonly deckCheck = computed(() => {
    const deck = this.deck();
    return deck ? checkDeck(deck, this.cards(), this.cardNames.nameLabel) : null;
  });
  readonly running = computed(() => ['preparing', 'requesting', 'validating'].includes(this.ai.state().phase));
  readonly elapsed = computed(() => {
    const started = this.ai.state().startedAt;
    return started && this.running() ? Math.max(0, Math.round((this.now() - started) / 1000)) : 0;
  });
  readonly selectedRun = computed(() => this.runs().find((r) => r.id === this.selectedRunId()) ?? null);
  readonly estimate = computed(() => {
    const deck = this.deck();
    this.ai.settings();
    return deck && this.cards().size ? this.ai.estimate(deck, this.cards()) : null;
  });
  readonly singleStarters = computed(() => (this.selectedRun()?.starters ?? []).filter((s) => s.kind === 'single'));
  readonly multiStarters = computed(() => (this.selectedRun()?.starters ?? []).filter((s) => s.kind === 'multi'));
  /** CR-006: this deck's Extra Deck monsters, offered as preferred targets. */
  readonly extraOptions = computed(() => {
    const deck = this.deck();
    return deck ? deck.extra.filter((r) => r.count > 0).map((r) => ({ cardId: r.cardId, name: this.name(r.cardId) })) : [];
  });
  /** CR-006 G36-1: rough output size for the requested number of routes vs the output limit. */
  readonly tokenHint = computed(() => {
    const s = this.ai.settings();
    const n = generatedRoutes(s.scope);
    const [lo, hi] = TOKENS_PER_ROUTE.map((t) => t * n);
    return { n, lo, hi, tight: s.provider !== 'chatgpt' && hi > s.maxOutputTokens };
  });
  /** B7: the deck is a first-turn-kill deck (its plans branch; the goal is fixed). */
  readonly pct = pct;
  /** How many ways through a plan reach the kill. */
  successCount = (check: { leaves: ReadonlyArray<{ success: boolean }> }) => check.leaves.filter((l) => l.success).length;
  readonly isFtk = computed(() => !!this.deck()?.ftk);
  /** B7: the plans of an FTK run, each checked way by way, best chance first. */
  readonly ftkRows = computed(() => {
    const run = this.selectedRun();
    const deck = this.deck();
    if (!run?.candidates || !deck || !run.candidates.some((c) => isFtkRoute(c.route))) return null;
    const rows = run.candidates.map((candidate, index) => {
      const check = checkFtkRoute(candidate.route, deck, { cards: this.cards(), name: this.name });
      return { index, candidate, check, p: check.probability.ok ? check.probability.p : null, level: analysisLevel(candidate.route, deck, { cards: this.cards(), name: this.name }) ?? 'ai-candidate' };
    });
    return rows.sort((a, b) => (b.p ?? -1) - (a.p ?? -1) || a.index - b.index).map((r, i) => ({ ...r, rank: i + 1 }));
  });
  /** CR-006 G36/G37/G39: candidates checked, evaluated and ranked against the deck as it is now. */
  readonly analysis = computed(() => {
    const run = this.selectedRun();
    const deck = this.deck();
    if (!run?.candidates || !deck) return null;
    if (run.candidates.some((c) => isFtkRoute(c.route))) return null; // shown by ftkRows
    const goal = { kind: this.sortGoal() ?? run.goal?.kind ?? 'interruptions', preferredExtraIds: run.goal?.preferredExtraIds ?? [] };
    const result = analyzeCandidates(run, deck, this.cards(), goal, this.name);
    const routes = run.candidates.map((c) => c.route);
    const rankOf = new Map([...result.shown, ...result.more].map((r, i) => [r.index, i + 1] as const));
    const row = (r: RankedCandidate, rank: number) => {
      const candidate = run.candidates![r.index];
      const check = checkRoute(candidate.route, deck, { cards: this.cards(), name: this.name });
      return {
        ...r,
        rank,
        candidate,
        level: analysisLevel(candidate.route, deck, { cards: this.cards(), name: this.name }) ?? 'ai-candidate',
        problems: r.evaluation.problemCount,
        /** CR-008 G51: the end board from the state after the last step; null without card moves. */
        snapshot: endSnapshot(candidate.route, deck, this.cards(), check),
        /** CR-008 G52-4: what the extra starter cards bring over the nearest smaller route. */
        added: addedValue(r, result.items, this.name),
        /** CR-008: another route of the same starter cards that repeats this one from the start (a note, not a fold). */
        sibling: ((o) => (o?.sameLine ? { ...o, rank: rankOf.get(o.otherIndex) ?? o.otherIndex + 1 } : null))(siblingOverlap(r.index, routes)),
        unverified: check.rules?.unverified.length ?? 0,
      };
    };
    const shown = result.shown.map((r, i) => row(r, i + 1));
    const more = result.more.map((r, i) => row(r, result.shown.length + i + 1));
    const grouped = groupBySize(shown);
    const groups = (
      [
        ['single', '單卡展開'],
        ['double', '雙卡展開'],
        ['triple', '三卡展開'],
        ['other', '其他張數'],
      ] as const
    )
      .map(([key, label]) => ({ key, label, rows: grouped[key] }))
      .filter((g) => g.rows.length);
    return { goal, coverage: result.coverage, shown, more, all: [...shown, ...more], folded: result.folded, groups };
  });
  /** CR-008 G52-3: the routes picked for the side-by-side view. */
  readonly compared = computed(() => {
    const picked = new Set(this.compareSet());
    return (this.analysis()?.all ?? []).filter((r) => picked.has(r.index));
  });
  /** CR-008: what a phased analysis can use at most, for the hint before starting. */
  readonly stagedHint = computed(() => {
    const deck = this.deck();
    const s = this.ai.settings();
    return deck && this.cards().size && s.mode === 'staged' ? this.ai.estimateStaged(deck, this.cards(), s) : null;
  });
  readonly staged = computed(() => this.selectedRun()?.staged ?? null);
  readonly viewed = computed(() => {
    const i = this.viewing();
    return i === null ? null : (this.selectedRun()?.candidates?.[i] ?? null);
  });
  /** G26-1: saved AI routes of this deck, checked against the deck as it is now. */
  readonly affected = computed(() => {
    const deck = this.deck();
    if (!deck) return [];
    return this.savedRoutes().map((route) => {
      const result = checkRoute(route, deck, { cards: this.cards(), name: this.name });
      return { route, changed: route.analysis!.deckFingerprint !== this.fingerprint(), passed: result.passed, problems: result.problems.slice(0, 3).map((p) => `${p.step ? `第 ${p.step} 步：` : ''}${p.message}`) };
    });
  });

  constructor() {
    effect(() => void this.load(this.deckId()));
    effect(() => {
      this.cardData.version();
      void this.cardData.refreshTotal();
      void this.refreshLists();
    });
    effect(() => {
      this.ai.settings();
      this.ai.apiKey();
      // read for its dependency: the effect re-runs whenever the run phase changes
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      this.ai.state().phase;
      this.ai.chatgpt();
      this.ai.chatgptModels();
      const deck = this.deck();
      const cards = this.cards();
      if (deck) void this.refreshPreflight(deck, cards);
    });
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      clearTimeout(this.pollTimer);
    });
  }

  private async load(id: string): Promise<void> {
    await this.ai.ready;
    if (this.ai.settings().provider === 'chatgpt') void this.ai.refreshChatGpt();
    const deck = await this.decks.get(id);
    this.notFound.set(!deck);
    this.deck.set(deck ?? null);
    if (!deck) return;
    await this.refreshLists();
  }

  private async refreshLists(): Promise<void> {
    const deck = this.deck();
    if (!deck) return;
    const runs = await this.ai.listRuns(deck.id);
    const saved = (await this.combos.list()).filter((c) => c.analysis?.deckId === deck.id);
    // Names also for cards no longer in the deck (removed after the analysis) or outside it.
    const ids = [
      ...[...deck.main, ...deck.extra].map((r) => r.cardId),
      ...saved.flatMap(comboCardIds),
      ...runs.flatMap((r) => [...(r.candidates ?? []).flatMap((c) => comboCardIds(c.route)), ...(r.starters ?? []).flatMap((s) => s.cardIds), ...(r.extenders ?? []).map((e) => e.cardId)]),
    ];
    this.cards.set(await this.cardData.getMany(new Set(ids)));
    this.runs.set(runs);
    if (!this.selectedRunId() && runs.length) this.selectedRunId.set(runs[0].id);
    this.savedRoutes.set(saved);
  }

  private async refreshPreflight(deck: DeckRecord, cards: Map<number, CardRecord>): Promise<void> {
    this.reasons.set(await this.ai.preflight(deck, cards));
    const u = await this.ai.usageToday();
    this.usage.set({ requests: u.requests, estimatedCostUsd: u.estimatedCostUsd });
  }

  // ---- settings ----

  update(patch: Partial<AiSettings>): void {
    void this.ai.updateSettings(patch);
  }

  scope(patch: Partial<AiSettings['scope']>): void {
    this.update({ scope: { ...this.ai.settings().scope, ...patch } });
  }

  stagedSetting(patch: Partial<AiSettings['staged']>): void {
    this.update({ staged: { ...this.ai.settings().staged, ...patch } });
  }

  goalKind(kind: AnalysisGoalKind): void {
    this.update({ goal: { ...this.ai.settings().goal, kind } });
  }

  prefer(cardId: number, on: boolean): void {
    const ids = this.ai.settings().goal.preferredExtraIds.filter((id) => id !== cardId);
    this.update({ goal: { ...this.ai.settings().goal, preferredExtraIds: on ? [...ids, cardId] : ids } });
  }

  num(value: string): number {
    return Math.trunc(Number(value));
  }

  // ---- ChatGPT account (CR-005) ----

  async chooseChatGpt(): Promise<void> {
    await this.ai.updateSettings({ provider: 'chatgpt' });
    await this.ai.refreshChatGpt();
  }

  refreshChatGpt(): Promise<void> {
    return this.ai.refreshChatGpt();
  }

  /**
   * "使用 ChatGPT 登入": the official sign-in page opens in a new tab. The tab is opened
   * synchronously (popup rules) and detached from this page before it is sent to OpenAI.
   */
  async signInChatGpt(): Promise<void> {
    this.chatgptMessage.set('');
    // Browser: the tab is opened synchronously (pop-up rules). Desktop: the system browser opens the link, no tab trick.
    const tab = hasExternalOpener() ? null : window.open('', '_blank');
    try {
      const url = await this.ai.chatgptSignIn();
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        openExternal(url);
      }
      this.chatgptMessage.set(tab ? '已在新分頁開啟 OpenAI 官方登入頁，完成後回到這裡。' : '已在系統瀏覽器開啟 OpenAI 官方登入頁；完成授權後會自動回到本程式。');
      this.poll(Date.now());
    } catch (error) {
      tab?.close();
      this.chatgptMessage.set(error instanceof Error ? error.message : String(error));
    }
  }

  /** Waits for the bridge to finish the sign-in (up to 5 minutes). */
  private poll(started: number): void {
    clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(async () => {
      await this.ai.refreshChatGpt();
      const g = this.ai.chatgpt();
      if (g.signedIn || g.lastError || !g.reachable) {
        this.chatgptMessage.set(g.signedIn ? (g.sharing ? '已登入 ChatGPT，並已授權使用你的 ChatGPT 方案額度。' : '已登入 ChatGPT，但沒有授權使用方案額度；請重新登入並同意。') : '');
        focusApp(); // the sign-in finished (or failed) in the system browser: come back to the app
        return;
      }
      if (Date.now() - started < 5 * 60 * 1000) this.poll(started);
      else this.chatgptMessage.set('等待登入逾時，請再按一次「使用 ChatGPT 登入」。');
    }, 2000);
  }

  /** Another ChatGPT account: sign out, drop this account's registration, then start a new sign-in. */
  async switchChatGptAccount(): Promise<void> {
    if (!confirm('切換帳號會登出目前的 ChatGPT 帳號並撤銷此 App 的授權，接著開啟官方登入頁讓你選擇另一個帳號。要繼續嗎？')) return;
    try {
      await this.ai.chatgptSignOut(true);
    } catch (error) {
      this.chatgptMessage.set(error instanceof Error ? error.message : String(error));
      return;
    }
    await this.signInChatGpt();
  }

  async signOutChatGpt(): Promise<void> {
    try {
      const result = await this.ai.chatgptSignOut();
      this.chatgptMessage.set(result.revoked ? '已登出，並已撤銷此 App 的授權。' : `已在本機登出。${result.message ?? ''}`);
    } catch (error) {
      this.chatgptMessage.set(error instanceof Error ? error.message : String(error));
    }
  }

  // ---- runs ----

  async start(force = false): Promise<void> {
    const deck = this.deck();
    if (!deck) return;
    this.error.set('');
    this.message.set('');
    this.viewing.set(null);
    try {
      const run = this.ai.settings().mode === 'staged' ? await this.ai.startStaged(deck, { force }) : await this.ai.start(deck, { force });
      await this.refreshLists();
      this.selectedRunId.set(run.id);
      this.sortGoal.set(null);
      if (this.ai.state().fromCache) this.message.set(`使用快取結果（${localDateTime(run.startedAt)}，未送出新的請求）。需要時可按「強制重新分析」。`);
      else if (run.status === 'succeeded') this.message.set(`分析完成：${run.candidates?.length ?? 0} 條候選路線。這些都只是 AI 候選，請看各路線的驗證層級。`);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }

  cancel(): void {
    this.ai.cancel();
  }

  selectRun(id: string): void {
    this.selectedRunId.set(id);
    this.viewing.set(null);
    this.sortGoal.set(null);
  }

  async deleteRun(run: AnalysisRun): Promise<void> {
    if (!confirm(`確定要刪除 ${localDateTime(run.startedAt)} 的分析紀錄嗎？已存成 Combo 的路線不受影響。`)) return;
    await this.ai.deleteRun(run.id);
    if (this.selectedRunId() === run.id) this.selectedRunId.set(null);
    await this.refreshLists();
  }

  // ---- candidates ----

  view(index: number): void {
    this.viewing.set(this.viewing() === index ? null : index);
  }

  private async withRun(action: (run: AnalysisRun) => Promise<void>): Promise<void> {
    const run = this.selectedRun();
    if (!run) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action(structuredClone(run));
      await this.refreshLists();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy.set(false);
    }
  }

  save(index: number): Promise<void> {
    return this.withRun(async (run) => {
      const route = await this.ai.saveCandidate(run, index);
      this.message.set(`已存成固定 Combo「${route.name}」（${route.verification.status === 'unverified' ? '未驗證' : '草稿'}），可在 Combo 管理與起手查詢中使用。`);
    });
  }

  /** B2: all candidates that pass the local check and are new, saved in one go after a confirmation with the numbers. */
  saveAll(): Promise<void> {
    const deck = this.deck();
    const bulk = TEXT.ai.bulk;
    return this.withRun(async (run) => {
      if (!deck) return;
      const plan = await this.ai.planBulkSave(run, deck);
      const skipped = bulk.skipped(plan);
      if (!plan.toSave.length) {
        this.message.set(bulk.nothing(skipped));
        return;
      }
      if (!confirm(bulk.confirm(plan.toSave.length, skipped))) return;
      const { saved, plan: done } = await this.ai.saveAllCandidates(run, deck);
      this.message.set(bulk.done(saved.length, bulk.skipped(done)));
    });
  }

  recheck(index: number): Promise<void> {
    const deck = this.deck();
    return this.withRun(async (run) => {
      if (!deck) return;
      const c = await this.ai.recheckCandidate(run, index, deck);
      this.message.set(`已依目前牌組重新驗證「${c.route.name}」：${c.route.analysis?.check.passed ? '資料完整性通過' : '未通過'}。`);
    });
  }

  remove(index: number): Promise<void> {
    if (!confirm('確定要刪除這條候選路線嗎？已存成 Combo 的不受影響。')) return Promise.resolve();
    this.viewing.set(null);
    return this.withRun((run) => this.ai.deleteCandidate(run, index));
  }

  async openCombo(id: string): Promise<void> {
    await this.router.navigate(['/combos', id]);
  }

  async recheckSaved(route: ComboRoute): Promise<void> {
    const deck = this.deck();
    if (!deck) return;
    this.busy.set(true);
    try {
      await this.ai.recheckCombo(route, deck);
      await this.refreshLists();
      this.message.set(`已重新驗證「${route.name}」。`);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy.set(false);
    }
  }

  handNames(route: ComboRoute): string {
    return route.conditions.handAllOf.map((c) => `${this.name(c.anyOf[0])}${c.count > 1 ? `×${c.count}` : ''}`).join('、');
  }

  names(ids: number[]): string {
    return ids.map((id) => this.name(id)).join('＋');
  }

  /** The simulated final field: monsters, then Set Spells/Traps. */
  finalText(e: RouteEvaluation): string {
    const monsters = e.finalMonsters.length ? this.names(e.finalMonsters) : '沒有怪獸';
    return e.finalBacks.length ? `${monsters}；魔陷：${this.names(e.finalBacks)}` : monsters;
  }

  /** Extra Deck monsters summoned, marked as end board or only used on the way. */
  extraText(e: RouteEvaluation): string {
    return e.extraUsed.map((u) => `${this.name(u.cardId)}（${u.onFinalBoard ? '終場' : '中途'}）`).join('、') || '無';
  }

  /** CR-008 G52-3: at most three routes side by side. */
  toggleCompare(index: number, on: boolean): void {
    const rest = this.compareSet().filter((i) => i !== index);
    if (!on) return this.compareSet.set(rest);
    if (rest.length >= 3) {
      this.message.set('並排比較最多 3 條路線，請先取消其中一條。');
      return this.compareSet.set(rest);
    }
    this.compareSet.set([...rest, index]);
  }

  /** G47-3: who the required, replaceable, extender and avoid-in-hand cards are (AI labels, not verified). */
  comboText(combo: ComboInfo): string {
    const alt = combo.alternatives
      .filter((a) => a.instead.length > 0)
      .map((a) => `${this.name(a.cardId)} 可換成 ${this.names(a.instead)}`)
      .join('；');
    return [
      `必要起手牌：${this.names(combo.required)}`,
      alt ? `可替代的起手牌：${alt}（AI 標示，未驗證）` : '',
      combo.extenders.length ? `補點／延伸卡：${this.names(combo.extenders)}` : '',
      combo.avoidInHand.length ? `不希望抽上手的必要組件：${this.names(combo.avoidInHand)}` : '',
    ]
      .filter(Boolean)
      .join('・');
  }

  /** G52-2: what the route needs in the Deck and the Extra Deck. */
  needsText(route: ComboRoute): string {
    const rows = (list: Array<{ cardId: number; count: number }> | undefined) => (list ?? []).map((r) => `${this.name(r.cardId)}${r.count > 1 ? `×${r.count}` : ''}`).join('、');
    const main = rows(route.conditions.mustRemainInMain);
    const extra = rows(route.conditions.mustExistInExtra);
    return [main ? `牌組內需留有：${main}` : '', extra ? `額外牌組需有：${extra}` : ''].filter(Boolean).join('；') || '沒有特別要求';
  }

  /** G52-2: where the route is weak — the model's own listed weaknesses plus what the local checks could not settle. */
  riskText(c: { problems: number; unverified: number; candidate: { route: ComboRoute } }): string {
    const cons = c.candidate.route.analysis?.cons ?? [];
    return [c.problems ? `資料驗證 ${c.problems} 項未通過` : '', c.unverified ? `本機檢查有 ${c.unverified} 項未能驗證` : '', ...cons].filter(Boolean).join('；') || '未列出';
  }

  /** G52-2: each interruption with its status and the reason it counts or not. */
  basisLines(e: RouteEvaluation): string[] {
    return e.interruptions.map((i) => `${this.name(i.cardId)}：${i.status === 'effective' ? '有效' : i.status === 'conditional' ? '條件未能驗證' : '無效'}（靜態估算）${i.reason ? '—' + i.reason : ''}`);
  }

  roleNames(roles: string[]): string {
    return roles.map((r) => ROLE_LABEL[r as keyof typeof ROLE_LABEL] ?? r).join('、');
  }

  levelText(level: AnalysisLevel): string {
    return ANALYSIS_LEVEL_LABEL[level];
  }

  startText(kind: StartKind): string {
    return START_KIND_LABEL[kind];
  }

  routeName(index: number): string {
    return this.selectedRun()?.candidates?.[index]?.route.name ?? `#${index + 1}`;
  }
}
