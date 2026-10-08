import { Injectable, inject, signal } from '@angular/core';
import { CardApiError, YgoProDeckClient, toCardRecord } from './card-api';
import { AppDb } from './db';
import { CardRecord } from './models';

export interface DownloadResult {
  added: number;
  /** IDs the source answered for but does not know. */
  unknownIds: number[];
  /** Set when the source could not be reached; nothing in the cache was changed. */
  error?: string;
}

/** Local card metadata cache. Network access only happens in the explicitly user-triggered methods. */
@Injectable({ providedIn: 'root' })
export class CardDataService {
  private readonly appDb = inject(AppDb);
  private readonly client = inject(YgoProDeckClient);

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

  /** Local search by passcode or name (English, zh-TW, aliases). */
  async search(query: string, limit = 30): Promise<CardRecord[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all = await (await this.appDb.db()).getAll('cards');
    const matches = all.filter(
      (c) => String(c.cardId) === q || c.nameEn.toLowerCase().includes(q) || c.nameZhTw?.toLowerCase().includes(q) || c.aliases?.some((a) => a.toLowerCase().includes(q)),
    );
    return matches.sort((a, b) => a.nameEn.localeCompare(b.nameEn)).slice(0, limit);
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
      await this.store(records);
      return { cards: records };
    } catch (error) {
      return { cards: [], error: describe(error) };
    }
  }

  private async download(ids: number[]): Promise<DownloadResult> {
    if (ids.length === 0) return { added: 0, unknownIds: [] };
    try {
      const now = new Date().toISOString();
      const records = (await this.client.fetchByIds(ids)).map((c) => toCardRecord(c, now));
      await this.store(records);
      const found = new Set(records.map((r) => r.cardId));
      return { added: records.length, unknownIds: ids.filter((id) => !found.has(id)) };
    } catch (error) {
      return { added: 0, unknownIds: [], error: describe(error) };
    }
  }

  private async store(records: CardRecord[]): Promise<void> {
    if (records.length === 0) return;
    const db = await this.appDb.db();
    const tx = db.transaction('cards', 'readwrite');
    // Keep any locally supplied zh-TW name / aliases when refreshing upstream data.
    await Promise.all(
      records.map(async (record) => {
        const existing = await tx.store.get(record.cardId);
        await tx.store.put({ ...record, nameZhTw: existing?.nameZhTw, aliases: existing?.aliases });
      }),
    );
    await tx.done;
    this.version.update((v) => v + 1);
  }
}

function describe(error: unknown): string {
  const reason = error instanceof CardApiError ? error.message : '未知錯誤';
  return `${reason}。已快取的資料不受影響，請確認網路後再試一次。`;
}
