import { Injectable, inject, signal } from '@angular/core';
import { CardApiError, DbVersion, YgoProDeckClient, toCardRecord } from './card-api';
import { CardNameEntry, searchNames } from './card-names';
import { EMPTY_QUERY, searchCards } from './card-search';
import { AppDb } from './db';
import { CardPool, CardRecord, MdBan } from './models';

export interface DownloadResult {
  added: number;
  /** IDs the source answered for but does not know. */
  unknownIds: number[];
  /** Set when the source could not be reached; nothing in the cache was changed. */
  error?: string;
}

/** What the last successful full sync stored (meta store, key `cardSync`). */
export interface SyncInfo {
  dbVersion: string;
  lastUpdate: string;
  pool: CardPool;
  syncedAt: string;
  count: number;
}

export type SyncResult =
  | { status: 'synced'; info: SyncInfo; added: number; updated: number }
  | { status: 'up-to-date'; info: SyncInfo }
  | { status: 'failed'; error: string };

/** User annotations on a card — never produced by the program. */
export interface CardNote {
  cardId: number;
  nameZhTw?: string;
  aliases?: string[];
  mdBan?: MdBan;
}

const SYNC_KEY = 'cardSync';
const NOTE_FIELDS = ['nameZhTw', 'aliases', 'mdBan'] as const;

/** New upstream data over the old record, keeping the user's own annotations (G17-5). */
export function mergeCard(existing: CardRecord | undefined, incoming: CardRecord): CardRecord {
  const merged: CardRecord = { ...existing, ...incoming };
  for (const field of NOTE_FIELDS) {
    if (existing?.[field] !== undefined) (merged as unknown as Record<string, unknown>)[field] = existing[field];
    else delete (merged as Partial<CardRecord>)[field];
  }
  return merged;
}

/** Local card database. Network access only happens in the explicitly user-triggered methods. */
@Injectable({ providedIn: 'root' })
export class CardDataService {
  private readonly appDb = inject(AppDb);
  private readonly client = inject(YgoProDeckClient);
  private cache: { version: number; cards: Promise<CardRecord[]> } | null = null;

  /** Bumped whenever cached cards change so views can reload. */
  readonly version = signal(0);

  async getMany(ids: Iterable<number>): Promise<Map<number, CardRecord>> {
    const db = await this.appDb.db();
    const tx = db.transaction('cards');
    const map = new Map<number, CardRecord>();
    await Promise.all(
      [...new Set(ids)].map(async (id) => {
        const card = await tx.store.get(id);
        if (card) map.set(id, card);
      }),
    );
    await tx.done;
    return map;
  }

  async count(): Promise<number> {
    return (await this.appDb.db()).count('cards');
  }

  /** Every stored card, read once per data version and kept in memory for searching (G18). */
  allCards(): Promise<CardRecord[]> {
    const version = this.version();
    if (this.cache?.version !== version) {
      const cards = this.appDb.db().then((db) => db.getAll('cards'));
      this.cache = { version, cards };
      cards.catch(() => (this.cache = null));
    }
    return this.cache.cards;
  }

  /**
   * Local search by passcode or name: English, Traditional and Simplified names, aliases, and the translation
   * table when the caller passes it (CR-009, G56). Same matcher as the card-search page.
   */
  async search(query: string, limit = 30, entries: ReadonlyMap<number, CardNameEntry> = new Map()): Promise<CardRecord[]> {
    const text = query.trim();
    if (!text) return [];
    const all = await this.allCards();
    return searchCards(all, { ...EMPTY_QUERY, text, pool: 'all' }, (card) => searchNames(card, entries.get(card.cardId))).slice(0, limit);
  }

  async syncInfo(): Promise<SyncInfo | null> {
    const entry = await (await this.appDb.db()).get('meta', SYNC_KEY);
    return (entry?.value as SyncInfo | undefined) ?? null;
  }

  /** Explicit user action: the upstream database version, without downloading card data. */
  async remoteVersion(): Promise<{ version?: DbVersion; error?: string }> {
    try {
      return { version: await this.client.checkDbVersion() };
    } catch (error) {
      return { error: describe(error) };
    }
  }

  /**
   * Explicit user action (G17): downloads every card of the pool unless the stored data already
   * has the upstream version. Cards and the sync record are written in one transaction, so a
   * failure at any point leaves the previous data exactly as it was.
   */
  async syncAll(pool: CardPool, options: { force?: boolean } = {}): Promise<SyncResult> {
    let remote: DbVersion;
    try {
      remote = await this.client.checkDbVersion();
    } catch (error) {
      return { status: 'failed', error: describe(error) };
    }
    const local = await this.syncInfo();
    if (!options.force && local && local.dbVersion === remote.version && local.pool === pool) return { status: 'up-to-date', info: local };

    let records: CardRecord[];
    try {
      const now = new Date().toISOString();
      records = (await this.client.fetchAll(pool)).map((c) => toCardRecord(c, now));
    } catch (error) {
      return { status: 'failed', error: describe(error) };
    }

    const info: SyncInfo = { dbVersion: remote.version, lastUpdate: remote.lastUpdate, pool, syncedAt: new Date().toISOString(), count: records.length };
    let added = 0;
    const db = await this.appDb.db();
    const tx = db.transaction(['cards', 'meta'], 'readwrite');
    try {
      const cards = tx.objectStore('cards');
      const existing = new Map((await cards.getAll()).map((c) => [c.cardId, c]));
      for (const record of records) {
        if (!existing.has(record.cardId)) added++;
        await cards.put(mergeCard(existing.get(record.cardId), record));
      }
      await tx.objectStore('meta').put({ key: SYNC_KEY, value: info });
      await tx.done;
    } catch {
      // Abort so writes already issued in this transaction are rolled back too.
      try {
        tx.abort();
      } catch {
        // already aborted by the failing request
      }
      await tx.done.catch(() => undefined);
      return { status: 'failed', error: '卡片資料寫入本機資料庫失敗，已取消整批寫入，原有資料不受影響。請確認瀏覽器儲存空間後再試。' };
    }
    this.version.update((v) => v + 1);
    return { status: 'synced', info, added, updated: records.length - added };
  }

  /** Explicit user action: download metadata for IDs not yet cached. */
  async downloadMissing(ids: Iterable<number>): Promise<DownloadResult> {
    const wanted = [...new Set(ids)];
    const cached = await this.getMany(wanted);
    return this.download(wanted.filter((id) => !cached.has(id)));
  }

  /** Explicit user action: re-download metadata for every cached card. */
  async refreshAll(): Promise<DownloadResult> {
    const keys = await (await this.appDb.db()).getAllKeys('cards');
    return this.download(keys);
  }

  /** Explicit user action: online name search; results are cached. */
  async searchOnline(query: string): Promise<{ cards: CardRecord[]; error?: string }> {
    const q = query.trim();
    if (q.length < 2) return { cards: [], error: '請至少輸入 2 個字元再線上搜尋' };
    try {
      const records = (await this.client.searchByName(q)).slice(0, 50).map((c) => toCardRecord(c, new Date().toISOString()));
      return { cards: await this.store(records) };
    } catch (error) {
      return { cards: [], error: describe(error) };
    }
  }

  /** Saves the user's own zh-TW name, aliases and Master Duel ban mark for one card. */
  async saveNote(note: CardNote): Promise<CardRecord | undefined> {
    const db = await this.appDb.db();
    const card = await db.get('cards', note.cardId);
    if (!card) return undefined;
    const next: CardRecord = { ...card, nameZhTw: note.nameZhTw?.trim() || undefined, aliases: note.aliases?.map((a) => a.trim()).filter(Boolean), mdBan: note.mdBan };
    if (!next.aliases?.length) delete next.aliases;
    for (const field of NOTE_FIELDS) if (next[field] === undefined) delete next[field];
    await db.put('cards', next);
    this.version.update((v) => v + 1);
    return next;
  }

  async notes(): Promise<CardNote[]> {
    return (await this.allCards())
      .filter((c) => NOTE_FIELDS.some((f) => c[f] !== undefined))
      .map((c) => ({ cardId: c.cardId, nameZhTw: c.nameZhTw, aliases: c.aliases, mdBan: c.mdBan }));
  }

  /** Applies imported notes to cards present in the local database; others are reported. */
  async applyNotes(notes: readonly CardNote[]): Promise<{ applied: number; missing: number[] }> {
    const db = await this.appDb.db();
    const tx = db.transaction('cards', 'readwrite');
    const missing: number[] = [];
    let applied = 0;
    for (const note of notes) {
      const card = await tx.store.get(note.cardId);
      if (!card) {
        missing.push(note.cardId);
        continue;
      }
      await tx.store.put({ ...card, ...Object.fromEntries(NOTE_FIELDS.filter((f) => note[f] !== undefined).map((f) => [f, note[f]])) });
      applied++;
    }
    await tx.done;
    this.version.update((v) => v + 1);
    return { applied, missing };
  }

  private async download(ids: number[]): Promise<DownloadResult> {
    if (ids.length === 0) return { added: 0, unknownIds: [] };
    try {
      const now = new Date().toISOString();
      const records = await this.store((await this.client.fetchByIds(ids)).map((c) => toCardRecord(c, now)));
      const found = new Set(records.map((r) => r.cardId));
      return { added: records.length, unknownIds: ids.filter((id) => !found.has(id)) };
    } catch (error) {
      return { added: 0, unknownIds: [], error: describe(error) };
    }
  }

  private async store(records: CardRecord[]): Promise<CardRecord[]> {
    if (records.length === 0) return [];
    const db = await this.appDb.db();
    const tx = db.transaction('cards', 'readwrite');
    const stored = await Promise.all(
      records.map(async (record) => {
        const merged = mergeCard(await tx.store.get(record.cardId), record);
        await tx.store.put(merged);
        return merged;
      }),
    );
    await tx.done;
    this.version.update((v) => v + 1);
    return stored;
  }
}

function describe(error: unknown): string {
  const reason = error instanceof CardApiError ? error.message : '未知錯誤';
  return `${reason}。已快取的資料不受影響，請確認網路後再試一次。`;
}
