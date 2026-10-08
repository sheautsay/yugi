import { Injectable, inject, signal } from '@angular/core';
import { CardApiError, ImageVariant, YgoProDeckClient } from './card-api';
import { AppDb } from './db';
import { SettingsService } from './settings.service';

const imageKey = (cardId: number, variant: ImageVariant) => `${variant}:${cardId}`;

/**
 * Card images cached as IndexedDB blobs. Thumbnails download when a card is on screen (CR-002,
 * can be switched off); full images when a card's details are opened; nothing at sync time.
 * Every download goes through the client's throttled image lane.
 */
@Injectable({ providedIn: 'root' })
export class CardImageService {
  private readonly appDb = inject(AppDb);
  private readonly client = inject(YgoProDeckClient);
  private readonly settings = inject(SettingsService);
  private readonly objectUrls = new Map<string, string>();

  /** Bumped when many images change at once (clear); single downloads use {@link loaded}. */
  readonly version = signal(0);
  /** The most recently stored image, so only the tiles showing that card refresh. */
  readonly loaded = signal<{ cardId: number; variant: ImageVariant } | null>(null);

  private readonly wanted = new Map<number, number>();
  private readonly queue: number[] = [];
  private readonly failed = new Set<number>();
  private pumping = false;

  async blob(cardId: number, variant: ImageVariant = 'small'): Promise<Blob | undefined> {
    return (await (await this.appDb.db()).get('images', imageKey(cardId, variant)))?.blob;
  }

  /** Object URL for a cached image, or null when it has not been downloaded. */
  async cachedUrl(cardId: number, variant: ImageVariant = 'small'): Promise<string | null> {
    const key = imageKey(cardId, variant);
    const known = this.objectUrls.get(key);
    if (known) return known;
    const blob = await this.blob(cardId, variant);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(key, url);
    return url;
  }

  async missing(cardIds: Iterable<number>, variant: ImageVariant = 'small'): Promise<number[]> {
    const keys = new Set(await (await this.appDb.db()).getAllKeys('images'));
    return [...new Set(cardIds)].filter((id) => !keys.has(imageKey(id, variant)));
  }

  /** A tile showing `cardId` is on screen and has no cached thumbnail. */
  want(cardId: number): void {
    this.wanted.set(cardId, (this.wanted.get(cardId) ?? 0) + 1);
    if (!this.failed.has(cardId) && !this.queue.includes(cardId)) {
      this.queue.push(cardId);
      void this.pump();
    }
  }

  /** The tile left the screen or was destroyed; a queued download is skipped if nobody wants it. */
  unwant(cardId: number): void {
    const n = (this.wanted.get(cardId) ?? 0) - 1;
    if (n > 0) this.wanted.set(cardId, n);
    else this.wanted.delete(cardId);
  }

  /** Full-size image for the details view, downloaded on first use. */
  async fullUrl(cardId: number): Promise<string | null> {
    const cached = await this.cachedUrl(cardId, 'full');
    if (cached) return cached;
    try {
      await this.fetchAndStore(cardId, 'full');
      return await this.cachedUrl(cardId, 'full');
    } catch {
      return null;
    }
  }

  /** Explicit user action: download images not yet cached (throttled by the client). */
  async download(cardIds: Iterable<number>, variant: ImageVariant = 'small'): Promise<{ downloaded: number; failed: number[]; error?: string }> {
    const failed: number[] = [];
    let downloaded = 0;
    let error: string | undefined;
    for (const cardId of await this.missing(cardIds, variant)) {
      try {
        await this.fetchAndStore(cardId, variant);
        this.failed.delete(cardId);
        downloaded++;
      } catch (e) {
        failed.push(cardId);
        error = e instanceof CardApiError ? e.message : '卡圖下載失敗';
      }
    }
    return { downloaded, failed, error };
  }

  async count(): Promise<number> {
    return (await this.appDb.db()).count('images');
  }

  async clear(): Promise<void> {
    await (await this.appDb.db()).clear('images');
    for (const url of this.objectUrls.values()) URL.revokeObjectURL(url);
    this.objectUrls.clear();
    this.failed.clear();
    this.version.update((v) => v + 1);
  }

  private async fetchAndStore(cardId: number, variant: ImageVariant): Promise<void> {
    const blob = await this.client.fetchImage(cardId, variant);
    await (await this.appDb.db()).put('images', { key: imageKey(cardId, variant), blob, cachedAt: new Date().toISOString() });
    this.loaded.set({ cardId, variant });
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      await this.settings.ready;
      while (this.queue.length) {
        const cardId = this.queue.shift()!;
        if (!this.wanted.has(cardId) || !this.settings.settings().autoThumbnails) continue;
        if (await this.blob(cardId, 'small')) {
          this.loaded.set({ cardId, variant: 'small' });
          continue;
        }
        try {
          await this.fetchAndStore(cardId, 'small');
        } catch {
          this.failed.add(cardId); // shown as a name + ID frame; "下載此牌組卡圖" retries
        }
      }
    } finally {
      this.pumping = false;
    }
  }
}
