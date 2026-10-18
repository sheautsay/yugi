import { Injectable, inject, signal } from '@angular/core';
import { AppDb } from './db';
import { DeckRepository } from './deck-repository';
import { DeckRecord } from './models';

const KEY = 'currentDeck';

/**
 * The deck the user is working with ("使用此牌組", CR-012): the shell's 起手查詢 and AI 展開分析 shortcuts open it.
 * Stored as a single id in the existing `meta` store (no data-format change; not part of backups). When the chosen
 * deck no longer exists, the most recently edited deck is used instead.
 */
@Injectable({ providedIn: 'root' })
export class CurrentDeckService {
  private readonly appDb = inject(AppDb);
  private readonly decks = inject(DeckRepository);

  readonly deck = signal<DeckRecord | null>(null);

  constructor() {
    void this.refresh();
  }

  async use(deckId: string): Promise<void> {
    await (await this.appDb.db()).put('meta', { key: KEY, value: deckId });
    await this.refresh();
  }

  /** Re-reads the decks (after a deck was created, renamed or deleted). */
  async refresh(): Promise<DeckRecord | null> {
    try {
      const [entry, all] = await Promise.all([(await this.appDb.db()).get('meta', KEY), this.decks.list()]);
      const chosen = all.find((d) => d.id === entry?.value);
      const fallback = [...all].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0] ?? null;
      const deck = chosen ?? fallback;
      this.deck.set(deck);
      return deck;
    } catch {
      this.deck.set(null);
      return null;
    }
  }
}
