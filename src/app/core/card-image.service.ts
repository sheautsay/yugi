import { Injectable, inject, signal } from '@angular/core';
import { CardApiError, ImageVariant, YgoProDeckClient } from './card-api';
import { AppDb } from './db';

const imageKey = (cardId: number, variant: ImageVariant) => `${variant}:${cardId}`;

/** Card images cached as IndexedDB blobs; downloads happen only on explicit user action. */
@Injectable({ providedIn: 'root' })
export class CardImageService {
  private readonly appDb = inject(AppDb);
  private readonly client = inject(YgoProDeckClient);
  private readonly objectUrls = new Map<string, string>();

  readonly version = signal(0);

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

  /** Explicit user action: download images not yet cached (throttled by the client). */
  async download(cardIds: Iterable<number>, variant: ImageVariant = 'small'): Promise<{ downloaded: number; failed: number[]; error?: string }> {
    const failed: number[] = [];
    let downloaded = 0;
    let error: string | undefined;
    for (const cardId of await this.missing(cardIds, variant)) {
      try {
        const blob = await this.client.fetchImage(cardId, variant);
        await (await this.appDb.db()).put('images', { key: imageKey(cardId, variant), blob, cachedAt: new Date().toISOString() });
        downloaded++;
        this.version.update((v) => v + 1);
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
    this.version.update((v) => v + 1);
  }
}
