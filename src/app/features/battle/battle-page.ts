import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalysisGoalKind, GOAL_KINDS, GOAL_LABEL } from '../../core/ai/analysis-goal';
import { BoardSnapshot, endSnapshot } from '../../core/ai/board-snapshot';
import { BattleEntry, rankForBattle } from '../../core/battle-rank';
import { BATTLE_TOP_N, BattleSettingsService } from '../../core/battle-settings.service';
import { CardDataService } from '../../core/card-data.service';
import { CardNamesService } from '../../core/card-names.service';
import { ComboRepository } from '../../core/combo-repository';
import { CurrentDeckService } from '../../core/current-deck.service';
import { checkDeck, deckCardIds } from '../../core/deck';
import { checkHand, drawHand, randomSeed, remainingInMain } from '../../core/hand';
import { ACTION_LABEL } from '../../core/labels';
import { MatchContext, matchRoutes } from '../../core/matcher';
import { CardRecord, ComboRoute, HAND_SIZE, TurnOrder } from '../../core/models';
import { StepNavigator } from '../../core/step-navigator';
import { TEXT } from '../../core/texts';
import { BoardPreview } from '../../shared/board-preview';
import { CardTile } from '../../shared/card-tile';
import { Icon } from '../../shared/icon';
import { CaptureRequests, GameCaptureService } from '../../shared/recognition/game-capture.service';
import { GameCaptureInput, ScreenshotRecognizer } from '../../shared/recognition/screenshot-recognizer';
import { BattleFtk } from './battle-ftk';

// The battle mode's situation is fixed to the one every collected route assumes: empty boards, a normal summon
// available, no interruption. A route that needs something else is simply not offered.
const CONTEXT = { emptyBoard: true, normalSummonAvailable: true, noInterruption: true } as const;

/** B3: pick the hand, see the strongest collected routes for it, follow one step by step. Built for a narrow (~420px) window. */
@Component({
  selector: 'app-battle-page',
  imports: [RouterLink, BoardPreview, CardTile, Icon, ScreenshotRecognizer, BattleFtk],
  templateUrl: './battle-page.html',
  styleUrl: './battle-page.css',
  host: { '(document:keydown)': 'onKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BattlePage {
  private readonly cardData = inject(CardDataService);
  private readonly combos = inject(ComboRepository);
  private readonly cardNames = inject(CardNamesService);
  protected readonly settings = inject(BattleSettingsService);
  protected readonly current = inject(CurrentDeckService);
  protected readonly gameCapture = inject(GameCaptureService);
  private readonly captureRequests = inject(CaptureRequests);

  protected readonly t = TEXT.battle;
  protected readonly f = TEXT.ftk;
  /** B7: the deck is a first-turn-kill deck (always going first; plans are ranked by their chance). */
  protected readonly ftk = computed(() => !!this.deck()?.ftk);
  protected readonly ftkOpen = signal(false);
  protected readonly goalKinds = GOAL_KINDS;
  protected readonly goalLabel = GOAL_LABEL;
  protected readonly topNs = BATTLE_TOP_N;
  protected readonly actionLabel = ACTION_LABEL;

  protected readonly turnOrder = signal<TurnOrder>('first');
  protected readonly goal = signal<AnalysisGoalKind>('interruptions');
  protected readonly hand = signal<number[]>([]);
  protected readonly filter = signal('');
  protected readonly showShot = signal(false);
  /** B4: the game capture handed to the recognizer when cards need confirming or the layout must be drawn. */
  protected readonly captureInput = signal<GameCaptureInput | null>(null);
  /** B4: outcome of the last one-key capture. */
  protected readonly captureMessage = signal<{ text: string; bad: boolean } | null>(null);
  protected readonly canCapture = this.gameCapture.available();
  protected readonly routes = signal<ComboRoute[]>([]);
  protected readonly cards = signal(new Map<number, CardRecord>());
  protected readonly loaded = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly navigator = new StepNavigator();

  protected readonly deck = this.current.deck;
  protected readonly handSize = computed(() => HAND_SIZE[this.turnOrder()]);
  protected readonly name = (id: number) => this.cardNames.labelOf(id, this.cards().get(id));
  protected readonly deckCheck = computed(() => {
    const deck = this.deck();
    return deck ? checkDeck(deck, this.cards(), this.cardNames.nameLabel) : null;
  });
  protected readonly handCheck = computed(() => checkHand(this.deck()?.main ?? [], this.hand(), this.handSize(), this.name));

  protected readonly handNames = computed(() => this.hand().map((id) => this.name(id)).join('、'));

  protected readonly pool = computed(() => {
    const deck = this.deck();
    const q = this.filter().trim().toLowerCase();
    return (deck?.main ?? [])
      .map((c) => ({ ...c, left: remainingInMain(deck!.main, this.hand(), c.cardId), card: this.cards().get(c.cardId) }))
      .filter((c) => !q || String(c.cardId) === q || this.name(c.cardId).toLowerCase().includes(q));
  });

  /** All routes ranked for the hand; `null` until the deck is usable and the hand is complete. */
  protected readonly ranking = computed<BattleEntry[] | null>(() => {
    const deck = this.deck();
    if (!deck || deck.ftk || !this.deckCheck()?.queryable || !this.handCheck().complete) return null;
    const mainIds = new Set(deck.main.map((c) => c.cardId));
    const relevant = this.routes().filter((r) => r.conditions.handAllOf?.some((cl) => cl.anyOf?.some((id) => mainIds.has(id))));
    const context: MatchContext = { turnOrder: this.turnOrder(), ...CONTEXT };
    const results = matchRoutes(relevant, deck, this.hand(), context, { name: this.name, knownCardIds: new Set(this.cards().keys()), cards: this.cards() });
    return rankForBattle(results, deck, this.cards(), { kind: this.goal(), preferredExtraIds: [] }, this.name);
  });

  protected readonly shown = computed(() => (this.ranking() ?? []).slice(0, this.settings.topN()).map((entry, i) => ({ entry, rank: i + 1, snapshot: this.snapshotOf(entry.route) })));

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    const found = this.shown().find((s) => s.entry.route.id === id);
    return found ?? null;
  });

  constructor() {
    effect(() => {
      this.cardData.version();
      void this.load();
    });
    // B4: a press of the capture shortcut (possibly made before this page opened).
    effect(() => {
      this.captureRequests.tick();
      if (this.loaded() && untracked(() => this.captureRequests.take())) void untracked(() => this.captureNow());
    });
    // A new hand (or a different deck or goal) can change the list, so leave the open route.
    effect(() => {
      this.hand();
      this.deck();
      this.goal();
      this.turnOrder();
      untracked(() => this.select(null));
    });
  }

  private async load(): Promise<void> {
    const deck = await this.current.refresh();
    const routes = await this.combos.list();
    this.routes.set(routes);
    if (deck) this.cards.set(await this.cardData.getMany([...deckCardIds(deck), ...routes.flatMap((r) => r.endBoard.map((e) => e.cardId))]));
    this.loaded.set(true);
  }

  private snapshotOf(route: ComboRoute): BoardSnapshot | null {
    const deck = this.deck();
    return deck ? endSnapshot(route, deck, this.cards()) : null;
  }

  protected setTurn(order: TurnOrder): void {
    this.turnOrder.set(this.ftk() ? 'first' : order);
    this.hand.update((h) => h.slice(0, HAND_SIZE[order]));
  }

  protected add(cardId: number): void {
    if (this.hand().length >= this.handSize() || remainingInMain(this.deck()?.main ?? [], this.hand(), cardId) <= 0) return;
    this.hand.update((h) => [...h, cardId]);
  }

  protected removeAt(index: number): void {
    this.hand.update((h) => h.filter((_, i) => i !== index));
  }

  protected draw(): void {
    const deck = this.deck();
    if (deck) this.hand.set(drawHand(deck.main, this.handSize(), randomSeed()));
  }

  protected applyRecognized(hand: number[]): void {
    this.hand.set(hand);
    this.showShot.set(false);
    this.captureInput.set(null);
  }

  protected togglePaste(): void {
    this.showShot.update((open) => !open);
    this.captureInput.set(null);
  }

  /** B4: capture the game window and recognize the hand with the remembered layout. */
  protected async captureNow(): Promise<void> {
    const deck = this.deck();
    if (!deck || !this.deckCheck()?.queryable || this.gameCapture.busy()) return;
    this.select(null);
    this.captureMessage.set({ text: this.t.capturing, bad: false });
    const result = await this.gameCapture.quick(deck.main, this.handSize(), this.name);
    switch (result.kind) {
      case 'error':
        this.captureMessage.set({ text: result.message, bad: true });
        return;
      case 'done':
        this.captureInput.set(null);
        this.showShot.set(false);
        this.hand.set(result.hand);
        this.captureMessage.set({ text: this.t.captured(result.ms), bad: false });
        return;
      case 'needs-layout':
        this.captureMessage.set({ text: result.reason, bad: false });
        this.captureInput.set({ bitmap: result.bitmap, note: result.reason });
        this.showShot.set(true);
        return;
      case 'confirm': {
        const unsure = result.slots.filter((s) => s.status !== 'confident').length;
        const note = this.t.captureConfirm(unsure);
        this.captureMessage.set({ text: note, bad: false });
        this.captureInput.set({ bitmap: result.bitmap, regions: result.regions, slots: result.slots, note });
        this.showShot.set(true);
        return;
      }
    }
  }

  protected select(id: string | null): void {
    this.selectedId.set(id);
    const route = this.shown().find((s) => s.entry.route.id === id)?.entry.route;
    this.navigator.reset(route?.steps.length ?? 0);
  }

  protected badge(entry: BattleEntry): { label: string; cls: string } {
    if (entry.verified) return { label: this.t.tested, cls: 'ok' };
    return entry.route.analysis ? { label: this.t.candidate, cls: 'warn' } : { label: this.t.untested, cls: '' };
  }

  protected starters(entry: BattleEntry): string {
    return entry.evaluation.starters.map((id) => this.name(id)).join('、') || entry.route.conditions.handAllOf.map((c) => c.anyOf.map((id) => this.name(id)).join('或')).join('、');
  }

  /** Space / arrow keys step through the open route (never while typing in a field). */
  protected onKey(event: KeyboardEvent): void {
    if (!this.selected()) return;
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (event.key === ' ' || event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.navigator.next();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.navigator.prev();
    }
  }
}
