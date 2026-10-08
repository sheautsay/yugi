import { Injectable, inject } from '@angular/core';
import { UserData } from './backup';
import { AppDb } from './db';

/** Whole-user-data access for backup / restore (F11). */
@Injectable({ providedIn: 'root' })
export class UserDataService {
  private readonly appDb = inject(AppDb);

  async readAll(): Promise<UserData> {
    const db = await this.appDb.db();
    const [decks, combos, layouts] = await Promise.all([db.getAll('decks'), db.getAll('combos'), db.getAll('layouts')]);
    return { decks, combos, layouts };
  }

  /** One transaction across all user stores: either every record is written or none (N6). */
  async write(data: UserData): Promise<void> {
    const db = await this.appDb.db();
    const tx = db.transaction(['decks', 'combos', 'layouts'], 'readwrite');
    try {
      for (const deck of data.decks) await tx.objectStore('decks').put(deck);
      for (const combo of data.combos) await tx.objectStore('combos').put(combo);
      for (const layout of data.layouts) await tx.objectStore('layouts').put(layout);
      await tx.done;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // already aborted by the failing request
      }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }
}
