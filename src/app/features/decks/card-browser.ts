import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CardDataService, SyncInfo } from '../../core/card-data.service';
import { CardNamesService } from '../../core/card-names.service';
import { CardQuery, facets, isDeckCard, pageOf } from '../../core/card-search';
import { ParsedDeck, countOf } from '../../core/deck';
import { CardKind, CardPool, CardRecord } from '../../core/models';
import { SettingsService } from '../../core/settings.service';
import { localDate } from '../../core/time';
import { CardDetail } from '../../shared/card-detail';
import { CardTile } from '../../shared/card-tile';

export interface CardAdjust {
  card: CardRecord;
  delta: 1 | -1;
}

const KIND_LABEL: Record<CardKind, string> = { monster: '怪獸', spell: '魔法', trap: '陷阱', unknown: '其他' };
const POOL_LABEL: Record<CardPool, string> = { 'master-duel': 'Master Duel 卡池', all: '全部遊戲王卡片' };

/** Local search over the synced card database with +/− into the deck being edited (G18, G20). */
@Component({
  selector: 'app-card-browser',
  imports: [CardTile, CardDetail],
  templateUrl: './card-browser.html',
  styleUrl: './card-browser.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardBrowser {
  private readonly cardData = inject(CardDataService);
  private readonly settings = inject(SettingsService);
  protected readonly cardNames = inject(CardNamesService);

  readonly deck = input.required<ParsedDeck>();
  readonly adjust = output<CardAdjust>();
  /** A card's notes changed in the details dialog. */
  readonly cardUpdated = output<CardRecord>();

  protected readonly kindLabel = KIND_LABEL;
  protected readonly poolLabel = POOL_LABEL;
  protected readonly date = localDate;

  protected readonly cards = signal<CardRecord[]>([]);
  protected readonly loading = signal(true);
  protected readonly syncInfo = signal<SyncInfo | null>(null);
  protected readonly syncing = signal(false);
  protected readonly message = signal('');

  protected readonly text = signal('');
  protected readonly kind = signal<CardKind | 'any'>('any');
  protected readonly zone = signal<'any' | 'main' | 'extra'>('any');
  protected readonly archetype = signal('');
  protected readonly attribute = signal('');
  protected readonly race = signal('');
  protected readonly level = signal<number | null>(null);
  protected readonly page = signal(1);
  protected readonly detail = signal<CardRecord | null>(null);

  protected readonly pool = computed(() => this.settings.settings().cardPool);
  protected readonly query = computed<CardQuery>(() => ({
    text: this.text(),
    kind: this.kind(),
    zone: this.zone(),
    archetype: this.archetype(),
    attribute: this.attribute(),
    race: this.race(),
    level: this.level(),
    pool: this.pool(),
  }));
  protected readonly results = computed(() => this.cardNames.search(this.cards(), this.query()));
  protected readonly paged = computed(() => pageOf(this.results(), this.page()));
  protected readonly facetValues = computed(() => facets(this.cards(), this.pool()));

  constructor() {
    effect(() => {
      this.cardData.version();
      void this.reload();
    });
    // A new search starts on page 1.
    effect(() => {
      this.query();
      this.page.set(1);
    });
  }

  private async reload(): Promise<void> {
    this.cards.set(await this.cardData.allCards());
    this.syncInfo.set(await this.cardData.syncInfo());
    this.loading.set(false);
  }

  protected copies(cardId: number): number {
    const deck = this.deck();
    return countOf(deck.main, cardId) + countOf(deck.extra, cardId) + countOf(deck.side, cardId);
  }

  protected zoneCounts(cardId: number): string {
    const deck = this.deck();
    return (
      [
        ['主', countOf(deck.main, cardId)],
        ['額', countOf(deck.extra, cardId)],
        ['備', countOf(deck.side, cardId)],
      ] as const
    )
      .filter(([, n]) => n > 0)
      .map(([label, n]) => `${label} ${n}`)
      .join('・');
  }

  protected canAdd(card: CardRecord): boolean {
    return isDeckCard(card) && this.copies(card.cardId) < 3;
  }

  protected addBlockedReason(card: CardRecord): string {
    if (!isDeckCard(card)) return 'Skill／Token 卡不能放入牌組';
    return this.copies(card.cardId) >= 3 ? '同名卡已達 3 張' : '';
  }

  protected setText(value: string): void {
    this.text.set(value.slice(0, 100));
  }

  protected setLevel(value: string): void {
    this.level.set(value === '' ? null : Number(value));
  }

  protected resetFilters(): void {
    this.text.set('');
    this.kind.set('any');
    this.zone.set('any');
    this.archetype.set('');
    this.attribute.set('');
    this.race.set('');
    this.level.set(null);
  }

  protected async setPool(pool: CardPool): Promise<void> {
    await this.settings.update({ cardPool: pool });
  }

  /** Explicit user action: full card-data download (skipped when already up to date). */
  protected async sync(): Promise<void> {
    this.syncing.set(true);
    this.message.set(`正在檢查並下載${POOL_LABEL[this.pool()]}的完整卡片資料（約 24 MB，請稍候）…`);
    const result = await this.cardData.syncAll(this.pool());
    this.syncing.set(false);
    this.message.set(
      result.status === 'failed'
        ? result.error
        : result.status === 'up-to-date'
          ? `卡片資料已是最新版本（${result.info.dbVersion}），未重新下載。`
          : `已同步 ${result.info.count} 張卡片（新增 ${result.added}、更新 ${result.updated}），資料版本 ${result.info.dbVersion}。`,
    );
  }

  protected onNoteSaved(card: CardRecord): void {
    this.detail.set(card);
    this.cardUpdated.emit(card);
  }
}
