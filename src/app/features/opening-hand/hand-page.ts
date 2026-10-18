import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { CardNamesService } from '../../core/card-names.service';
import { RouterLink } from '@angular/router';
import { CardDataService } from '../../core/card-data.service';
import { ComboRepository } from '../../core/combo-repository';
import { checkDeck, deckCardIds } from '../../core/deck';
import { DeckRepository } from '../../core/deck-repository';
import { checkHand, drawHand, randomSeed, remainingInMain } from '../../core/hand';
import { MatchContext, RouteResult, matchRoutes } from '../../core/matcher';
import { CardRecord, ComboRoute, DeckRecord, HAND_SIZE, TurnOrder } from '../../core/models';
import { CardTile } from '../../shared/card-tile';
import { HandStateService } from './hand-state.service';
import { KIND_LABEL, RouteResultList } from './route-result-list';
import { ScreenshotRecognizer } from './screenshot-recognizer';

@Component({
  selector: 'app-hand-page',
  imports: [RouterLink, CardTile, RouteResultList, ScreenshotRecognizer],
  templateUrl: './hand-page.html',
  styleUrl: './hand-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HandPage {
  private readonly decks = inject(DeckRepository);
  private readonly combos = inject(ComboRepository);
  private readonly cardData = inject(CardDataService);
  private readonly handStates = inject(HandStateService);

  readonly deckId = input.required<string>();

  protected readonly kindLabel = KIND_LABEL;
  protected readonly cardNames = inject(CardNamesService);

  protected readonly loaded = signal(false);
  protected readonly deck = signal<DeckRecord | null>(null);
  protected readonly cards = signal(new Map<number, CardRecord>());
  protected readonly routes = signal<ComboRoute[]>([]);
  protected readonly notice = signal('');

  protected readonly turnOrder = signal<TurnOrder>('first');
  protected readonly emptyBoard = signal(true);
  protected readonly normalSummonAvailable = signal(true);
  protected readonly noInterruption = signal(true);
  protected readonly hand = signal<number[]>([]);
  protected readonly history = signal<number[][]>([]);
  protected readonly seed = signal<number | null>(null);
  protected readonly seedInput = signal('');
  protected readonly poolFilter = signal('');
  protected readonly showRecognizer = signal(false);

  protected readonly name = (id: number) => this.cardNames.labelOf(id, this.cards().get(id));
  protected readonly deckCheck = computed(() => {
    const deck = this.deck();
    return deck ? checkDeck(deck, this.cards(), this.cardNames.nameLabel) : null;
  });
  protected readonly handSize = computed(() => HAND_SIZE[this.turnOrder()]);
  protected readonly handCheck = computed(() => checkHand(this.deck()?.main ?? [], this.hand(), this.handSize(), this.name));
  protected readonly context = computed<MatchContext>(() => ({
    turnOrder: this.turnOrder(),
    emptyBoard: this.emptyBoard(),
    normalSummonAvailable: this.normalSummonAvailable(),
    noInterruption: this.noInterruption(),
  }));

  protected readonly pool = computed(() => {
    const deck = this.deck();
    const q = this.poolFilter().trim().toLowerCase();
    return (deck?.main ?? [])
      .map((c) => ({ ...c, left: remainingInMain(deck!.main, this.hand(), c.cardId), card: this.cards().get(c.cardId) }))
      .filter((c) => !q || String(c.cardId) === q || this.cardNames.labelOf(c.cardId, c.card).toLowerCase().includes(q));
  });

  /** Routes whose opening cards appear in this deck; the rest belong to other decks. */
  private readonly relevantRoutes = computed(() => {
    const mainIds = new Set(this.deck()?.main.map((c) => c.cardId));
    return this.routes().filter((r) => r.conditions.handAllOf?.some((cl) => cl.anyOf?.some((id) => mainIds.has(id))));
  });
  protected readonly otherDeckRouteCount = computed(() => this.routes().length - this.relevantRoutes().length);

  /** Formal query only runs on a valid deck with a complete hand. */
  protected readonly results = computed<RouteResult[] | null>(() => {
    const deck = this.deck();
    if (!deck || !this.deckCheck()?.queryable || !this.handCheck().complete) return null;
    return matchRoutes(this.relevantRoutes(), deck, this.hand(), this.context(), { name: this.name, knownCardIds: new Set(this.cards().keys()), cards: this.cards() });
  });
  protected readonly grouped = computed(() => {
    const results = this.results() ?? [];
    return (['available', 'unverified', 'unknown', 'unavailable'] as const).map((kind) => ({ kind, items: results.filter((r) => r.match.kind === kind) }));
  });

  constructor() {
    effect(() => void this.load(this.deckId()));
    effect(() => {
      const deck = this.deck();
      if (!deck || !this.loaded()) return;
      this.handStates.set(deck.id, {
        deckVersion: deck.version,
        turnOrder: this.turnOrder(),
        hand: this.hand(),
        history: this.history(),
        seed: this.seed(),
      });
    });
  }

  private async load(deckId: string): Promise<void> {
    this.loaded.set(false);
    const [deck, routes] = await Promise.all([this.decks.get(deckId), this.combos.list()]);
    this.deck.set(deck ?? null);
    this.routes.set(routes);
    if (deck) {
      this.cards.set(await this.cardData.getMany([...deckCardIds(deck), ...routes.flatMap((r) => r.endBoard.map((e) => e.cardId))]));
      this.restore(deck);
    }
    this.loaded.set(true);
  }

  /** N3: a hand kept from an older deck version is only reused if it is still valid. */
  private restore(deck: DeckRecord): void {
    const saved = this.handStates.get(deck.id);
    this.notice.set('');
    if (!saved) return;
    this.turnOrder.set(saved.turnOrder);
    this.seed.set(saved.seed);
    if (saved.deckVersion !== deck.version) {
      const stillValid = checkHand(deck.main, saved.hand, HAND_SIZE[saved.turnOrder]).errors.length === 0;
      this.hand.set(stillValid ? saved.hand : []);
      this.history.set([]);
      this.notice.set(stillValid ? '牌組內容已更新，原手牌仍符合新牌表。' : '牌組內容已更新，原手牌不再符合新牌表，已清除。');
      return;
    }
    this.hand.set(saved.hand);
    this.history.set(saved.history);
  }

  protected setTurnOrder(order: TurnOrder): void {
    this.turnOrder.set(order);
  }

  protected add(cardId: number): void {
    if (this.hand().length >= this.handSize() || remainingInMain(this.deck()?.main ?? [], this.hand(), cardId) <= 0) return;
    this.hand.update((h) => [...h, cardId]);
  }

  protected removeAt(index: number): void {
    this.hand.update((h) => h.filter((_, i) => i !== index));
  }

  protected clear(): void {
    this.remember();
    this.hand.set([]);
  }

  protected draw(): void {
    const deck = this.deck();
    if (!deck) return;
    const typed = this.seedInput().trim();
    const seed = typed && /^\d+$/.test(typed) ? Number(typed) >>> 0 : randomSeed();
    this.remember();
    this.hand.set(drawHand(deck.main, this.handSize(), seed));
    this.seed.set(seed);
  }

  /** rev1 R8: a confirmed recognition result becomes the hand, exactly like a manual selection. */
  protected applyRecognized(hand: number[]): void {
    this.remember();
    this.hand.set(hand);
    this.notice.set('已套用截圖辨識結果（由你確認）。');
  }

  protected undo(): void {
    const previous = this.history().at(-1);
    if (!previous) return;
    this.history.update((h) => h.slice(0, -1));
    this.hand.set(previous);
  }

  private remember(): void {
    if (this.handCheck().complete) this.history.update((h) => [...h.slice(-19), this.hand()]);
  }
}
