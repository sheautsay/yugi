import { Injectable, InjectionToken, inject } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { CardRecord, ComboRoute, DeckRecord, HandLayoutPreset } from './models';

export interface CachedImage {
  key: string;
  blob: Blob;
  cachedAt: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

interface AppDbSchema extends DBSchema {
  decks: { key: string; value: DeckRecord };
  combos: { key: string; value: ComboRoute };
  cards: { key: number; value: CardRecord };
  images: { key: string; value: CachedImage };
  layouts: { key: string; value: HandLayoutPreset };
  meta: { key: string; value: MetaEntry };
}

export type AppDatabase = IDBPDatabase<AppDbSchema>;

export const DB_VERSION = 1;

export function openAppDb(name: string): Promise<AppDatabase> {
  return openDB<AppDbSchema>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Each block upgrades one version; a fresh install runs them all in order.
      if (oldVersion < 1) {
        db.createObjectStore('decks', { keyPath: 'id' });
        db.createObjectStore('combos', { keyPath: 'id' });
        db.createObjectStore('cards', { keyPath: 'cardId' });
        db.createObjectStore('images', { keyPath: 'key' });
        db.createObjectStore('layouts', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    },
    blocking(_current, _blocked, event) {
      // A newer version was opened in another tab: release it so that tab can upgrade.
      (event.target as IDBDatabase).close();
    },
  });
}

export const DB_NAME = new InjectionToken<string>('DB_NAME', {
  providedIn: 'root',
  factory: () => 'ygo-combo-assistant',
});

@Injectable({ providedIn: 'root' })
export class AppDb {
  private readonly name = inject(DB_NAME);
  private dbPromise?: Promise<AppDatabase>;

  db(): Promise<AppDatabase> {
    this.dbPromise ??= openAppDb(this.name).catch((error: unknown) => {
      this.dbPromise = undefined;
      throw error;
    });
    return this.dbPromise;
  }
}
