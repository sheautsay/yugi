import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CardNamesService } from '../../core/card-names.service';
import { RouterLink } from '@angular/router';
import { CurrentDeckService } from '../../core/current-deck.service';
import { localDateTime } from '../../core/time';
import { CardTile } from '../../shared/card-tile';
import { CardDataService } from '../../core/card-data.service';
import { DeckCheck, checkDeck, deckCardIds, newDeck } from '../../core/deck';
import { DeckRepository } from '../../core/deck-repository';
import { CardRecord, DeckRecord } from '../../core/models';
import { DeckImportPanel } from './deck-import-panel';

interface DeckRow {
  deck: DeckRecord;
  check: DeckCheck;
}

@Component({
  selector: 'app-deck-list-page',
  imports: [RouterLink, DeckImportPanel, CardTile],
  templateUrl: './deck-list-page.html',
  styleUrl: './deck-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckListPage {
  private readonly repo = inject(DeckRepository);
  private readonly cardData = inject(CardDataService);
  private readonly cardNames = inject(CardNamesService);

  protected readonly current = inject(CurrentDeckService);
  protected readonly time = localDateTime;
  protected readonly cards = signal<ReadonlyMap<number, CardRecord>>(new Map());
  protected readonly rows = signal<DeckRow[]>([]);
  protected readonly decks = signal<DeckRecord[]>([]);
  protected readonly loadError = signal('');
  protected readonly message = signal('');
  protected readonly newName = signal('');

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    try {
      const decks = await this.repo.list();
      const cards = await this.cardData.getMany(decks.flatMap((d) => deckCardIds(d)));
      this.decks.set(decks);
      this.cards.set(cards);
      void this.current.refresh(); // a deck may have been added, copied or deleted here
      this.rows.set(decks.map((deck) => ({ deck, check: checkDeck(deck, cards, this.cardNames.nameLabel) })));
      this.loadError.set('');
    } catch {
      this.loadError.set('無法開啟本機資料庫。請確認瀏覽器允許此網站儲存資料（非無痕模式），然後重新整理頁面。');
    }
  }

  /** The deck's most-played main-deck card, shown as its picture. */
  protected coverOf(deck: DeckRecord): number | null {
    return deck.main.length ? [...deck.main].sort((a, b) => b.count - a.count)[0].cardId : null;
  }

  protected async use(deck: DeckRecord): Promise<void> {
    await this.current.use(deck.id);
    this.message.set(`目前使用「${deck.name}」：側邊欄的起手查詢與 AI 展開分析會開啟這副牌組。`);
  }

  protected scrollToAdd(): void {
    document.getElementById('add-deck')?.scrollIntoView({ block: 'start' });
  }

  protected async create(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;
    await this.repo.save(newDeck(name));
    this.newName.set('');
    this.message.set(`已建立空白牌組「${name}」（草稿），請在編輯頁加入卡片。`);
    await this.reload();
  }

  protected async onImported(message: string): Promise<void> {
    this.message.set(message);
    await this.reload();
  }

  protected async copy(deck: DeckRecord): Promise<void> {
    const now = new Date().toISOString();
    await this.repo.save({ ...structuredClone(deck), id: crypto.randomUUID(), name: `${deck.name}（複本）`, version: 1, createdAt: now, updatedAt: now });
    this.message.set(`已複製「${deck.name}」。`);
    await this.reload();
  }

  protected async remove(deck: DeckRecord): Promise<void> {
    if (!confirm(`確定要刪除牌組「${deck.name}」嗎？此動作無法復原（Combo 資料不會被刪除）。`)) return;
    await this.repo.delete(deck.id);
    void this.current.refresh();
    this.message.set(`已刪除「${deck.name}」。`);
    await this.reload();
  }
}
