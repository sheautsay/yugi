import { InjectionToken, Injectable, inject } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { CardNameEntry, mayReplace } from './card-names';

// Traditional Chinese translation table (CR-009). It lives in its own IndexedDB database so the main
// database version, its stores and the backup format stay exactly as they are.

export const CARD_NAMES_DB = new InjectionToken<string>('CARD_NAMES_DB', {
  providedIn: 'root',
  factory: () => 'ygo-card-names',
});

interface CardNamesSchema extends DBSchema {
  names: { key: number; value: CardNameEntry };
  meta: { key: string; value: { key: string; value: unknown } };
}

type CardNamesDb = IDBPDatabase<CardNamesSchema>;

const VERSION = 1;

export function openCardNamesDb(name: string): Promise<CardNamesDb> {
  return openDB<CardNamesSchema>(name, VERSION, {
    upgrade(db) {
      db.createObjectStore('names', { keyPath: 'cardId' });
      db.createObjectStore('meta', { keyPath: 'key' });
    },
    blocking(_current, _blocked, event) {
      (event.target as IDBDatabase).close();
    },
  });
}

export interface WriteOutcome {
  applied: number;
  /** Entries not written because the stored entry has a higher rank (G64, N50). */
  kept: number;
}

@Injectable({ providedIn: 'root' })
export class CardNameStore {
  private readonly name = inject(CARD_NAMES_DB);
  private dbPromise?: Promise<CardNamesDb>;

  private db(): Promise<CardNamesDb> {
    this.dbPromise ??= openCardNamesDb(this.name).catch((error: unknown) => {
      this.dbPromise = undefined;
      throw error;
    });
    return this.dbPromise;
  }

  /** Every stored entry keyed by card ID. */
  async all(): Promise<Map<number, CardNameEntry>> {
    const db = await this.db();
    return new Map((await db.getAll('names')).map((e) => [e.cardId, e]));
  }

  /**
   * Writes the entries in ONE transaction. Each entry replaces the stored one only when mayReplace() allows it.
   * If any step throws, the transaction is aborted and nothing from this call is kept (G63, N48).
   */
  async write(entries: readonly CardNameEntry[], note: { importedAt: string; count: number }): Promise<WriteOutcome> {
    const db = await this.db();
    const tx = db.transaction(['names', 'meta'], 'readwrite');
    tx.done.catch(() => undefined);
    let applied = 0;
    let kept = 0;
    try {
      const names = tx.objectStore('names');
      for (const entry of entries) {
        const existing = await names.get(entry.cardId);
        if (mayReplace(existing, entry)) {
          await names.put(entry);
          applied++;
        } else {
          kept++;
        }
      }
      await tx.objectStore('meta').put({ key: 'lastImport', value: note });
      await tx.done;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // already finished by the failure itself
      }
      throw error;
    }
    return { applied, kept };
  }

  /** The note of the last successful write (for the settings page), or null. */
  async lastImport(): Promise<{ importedAt: string; count: number } | null> {
    const entry = await (await this.db()).get('meta', 'lastImport');
    return (entry?.value as { importedAt: string; count: number } | undefined) ?? null;
  }
}
