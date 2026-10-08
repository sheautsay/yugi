import { Injectable, inject } from '@angular/core';
import { AppDb } from './db';
import { DeckRecord } from './models';

@Injectable({ providedIn: 'root' })
export class DeckRepository {
  private readonly appDb = inject(AppDb);

  async list(): Promise<DeckRecord[]> {
    const decks = await (await this.appDb.db()).getAll('decks');
    return decks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<DeckRecord | undefined> {
    return (await this.appDb.db()).get('decks', id);
  }

  async save(deck: DeckRecord): Promise<void> {
    await (await this.appDb.db()).put('decks', deck);
  }

  async delete(id: string): Promise<void> {
    await (await this.appDb.db()).delete('decks', id);
  }
}
