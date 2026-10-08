import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardDataService } from '../../core/card-data.service';
import { DeckCheck, checkDeck, deckCardIds, newDeck } from '../../core/deck';
import { DeckRepository } from '../../core/deck-repository';
import { DeckRecord } from '../../core/models';
import { DeckImportPanel } from './deck-import-panel';

interface DeckRow {
  deck: DeckRecord;
  check: DeckCheck;
}

@Component({
  selector: 'app-deck-list-page',
  imports: [RouterLink, DeckImportPanel],
  templateUrl: './deck-list-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckListPage {
  private readonly repo = inject(DeckRepository);
  private readonly cardData = inject(CardDataService);

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
      this.rows.set(decks.map((deck) => ({ deck, check: checkDeck(deck, cards) })));
      this.loadError.set('');
    } catch {
      this.loadError.set('無法開啟本機資料庫。請確認瀏覽器允許此網站儲存資料（非無痕模式），然後重新整理頁面。');
    }
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
    this.message.set(`已刪除「${deck.name}」。`);
    await this.reload();
  }
}
