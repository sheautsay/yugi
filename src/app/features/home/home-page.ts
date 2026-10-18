import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiAnalysisService } from '../../core/ai/analysis.service';
import { CardDataService, SyncInfo } from '../../core/card-data.service';
import { CardNamesService } from '../../core/card-names.service';
import { ComboRepository } from '../../core/combo-repository';
import { CurrentDeckService } from '../../core/current-deck.service';
import { DeckCheck, checkDeck, deckCardIds } from '../../core/deck';
import { VERIFICATION_LABEL } from '../../core/labels';
import { CardRecord, ComboRoute } from '../../core/models';
import { localDateTime } from '../../core/time';
import { CardDataPrompt } from '../../shared/card-data-prompt';
import { CardTile } from '../../shared/card-tile';
import { Icon } from '../../shared/icon';

/** First screen (CR-012): the current deck, quick actions, ChatGPT connection, recent combos and card data. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, CardTile, Icon, CardDataPrompt],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly cardData = inject(CardDataService);
  private readonly combos = inject(ComboRepository);
  private readonly cardNames = inject(CardNamesService);
  protected readonly current = inject(CurrentDeckService);
  protected readonly ai = inject(AiAnalysisService);

  protected readonly time = localDateTime;
  protected readonly statusLabel = VERIFICATION_LABEL;
  protected readonly loading = signal(true);
  protected readonly recent = signal<ComboRoute[]>([]);
  protected readonly comboCount = signal(0);
  protected readonly sync = signal<SyncInfo | null>(null);
  protected readonly cardCount = signal<number | null>(null);
  protected readonly cards = signal<ReadonlyMap<number, CardRecord>>(new Map());
  protected readonly check = signal<DeckCheck | null>(null);
  protected readonly checking = signal(false);

  /** The deck's most-played main-deck card, as its picture. */
  protected readonly cover = computed(() => {
    const deck = this.current.deck();
    if (!deck?.main.length) return null;
    return [...deck.main].sort((a, b) => b.count - a.count)[0].cardId;
  });

  protected readonly hasCardData = this.cardData.hasData;

  constructor() {
    effect(() => {
      this.cardData.version();
      void this.load();
    });
  }

  private async load(): Promise<void> {
    try {
      const deck = await this.current.refresh();
      void this.cardData.refreshTotal();
      const [routes, sync, count] = await Promise.all([this.combos.list(), this.cardData.syncInfo(), this.cardData.count()]);
      this.comboCount.set(routes.length);
      this.recent.set([...routes].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, 5));
      this.sync.set(sync);
      this.cardCount.set(count);
      if (deck) {
        const cards = await this.cardData.getMany(deckCardIds(deck));
        this.cards.set(cards);
        this.check.set(checkDeck(deck, cards, (id, card) => this.cardNames.labelOf(id, card)));
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected async refreshChatGpt(): Promise<void> {
    this.checking.set(true);
    try {
      await this.ai.refreshChatGpt();
    } finally {
      this.checking.set(false);
    }
  }

  protected total(rows: Array<{ count: number }>): number {
    return rows.reduce((n, r) => n + r.count, 0);
  }
}
