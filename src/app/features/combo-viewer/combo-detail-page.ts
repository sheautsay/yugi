import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AiAnalysisService } from '../../core/ai/analysis.service';
import { CardDataService } from '../../core/card-data.service';
import { comboCardIds } from '../../core/combo';
import { ComboRepository } from '../../core/combo-repository';
import { DeckRepository } from '../../core/deck-repository';
import { VERIFICATION_LABEL } from '../../core/labels';
import { CardRecord, ComboRoute, DeckRecord } from '../../core/models';
import { RouteAnalysisPanel } from '../../shared/combo/route-analysis-panel';
import { ComboViewer, ViewerMode } from '../../shared/combo/combo-viewer';

@Component({
  selector: 'app-combo-detail-page',
  imports: [RouterLink, ComboViewer, RouteAnalysisPanel],
  templateUrl: './combo-detail-page.html',
  styleUrl: '../../shared/combo/combo-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboDetailPage {
  private readonly repo = inject(ComboRepository);
  private readonly cardData = inject(CardDataService);
  private readonly decks = inject(DeckRepository);
  private readonly ai = inject(AiAnalysisService);

  readonly comboId = input.required<string>();
  /** Set when opened from an opening-hand query, to offer the way back. */
  readonly deck = input<string>();

  protected readonly statusLabel = VERIFICATION_LABEL;
  protected readonly route = signal<ComboRoute | null>(null);
  protected readonly cards = signal(new Map<number, CardRecord>());
  protected readonly loaded = signal(false);
  /** CR-004: the deck an AI route was generated for, as it is now (null if deleted). */
  protected readonly analysisDeck = signal<DeckRecord | null>(null);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly mode = signal<ViewerMode>('flow');

  protected readonly backLink = computed(() => {
    const deck = this.deck();
    return deck ? ['/decks', deck, 'hand'] : ['/combos'];
  });
  protected readonly unknownCards = computed(() => {
    const route = this.route();
    return route ? comboCardIds(route).filter((id) => !this.cards().has(id)) : [];
  });

  constructor() {
    effect(() => void this.load(this.comboId()));
  }

  private async load(id: string): Promise<void> {
    this.loaded.set(false);
    const route = await this.repo.get(id);
    this.route.set(route ?? null);
    const deck = route?.analysis ? ((await this.decks.get(route.analysis.deckId)) ?? null) : null;
    this.analysisDeck.set(deck);
    if (route) {
      const ids = [...comboCardIds(route), ...(deck ? [...deck.main, ...deck.extra].map((r) => r.cardId) : [])];
      this.cards.set(await this.cardData.getMany(ids));
    }
    this.loaded.set(true);
  }

  /** G25-4: re-run the data check against the deck as it is now and record it. */
  protected async recheck(): Promise<void> {
    const route = this.route();
    const deck = this.analysisDeck();
    if (!route || !deck) return;
    this.busy.set(true);
    try {
      const next = await this.ai.recheckCombo(route, deck);
      this.route.set(next);
      this.message.set(`已依目前牌組重新驗證：${next.analysis?.check.passed ? '資料完整性通過' : '未通過'}（版本 ${next.version}）。`);
    } catch (error) {
      this.message.set(`重新驗證失敗：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.busy.set(false);
    }
  }
}
