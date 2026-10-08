import { Injectable, InjectionToken, inject } from '@angular/core';
import { CardKind, CardRecord } from './models';

// The single place that talks to the network (spec §9.8). Card metadata comes straight from the
// YGOPRODeck API (CORS enabled); card images go through the dev-server proxy in proxy.conf.json
// because images.ygoprodeck.com sends no CORS headers and the app must read image pixels.
export const CARD_API_BASE = 'https://db.ygoprodeck.com/api/v7';
export const CARD_IMAGE_BASE = '/ygo-images';
export const CARD_SOURCE = 'YGOPRODeck API v7';

/** Requests per batch of IDs; keeps URLs short. */
const ID_BATCH = 50;
/** Minimum gap between requests — far below the upstream limit of 20 requests/second. */
const MIN_INTERVAL_MS = 250;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

export interface ApiCard {
  id: number;
  name: string;
  type: string;
  frameType?: string;
}

export type ImageVariant = 'small' | 'cropped';

export class CardApiError extends Error {}

export type FetchFn = (url: string) => Promise<Response>;
export type SleepFn = (ms: number) => Promise<void>;

export const FETCH_FN = new InjectionToken<FetchFn>('FETCH_FN', {
  providedIn: 'root',
  factory: () => (url: string) => fetch(url),
});

export const SLEEP_FN = new InjectionToken<SleepFn>('SLEEP_FN', {
  providedIn: 'root',
  factory: () => (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
});

const EXTRA_FRAMES = new Set(['fusion', 'synchro', 'xyz', 'link', 'fusion_pendulum', 'synchro_pendulum', 'xyz_pendulum']);

export function toCardRecord(card: ApiCard, now: string): CardRecord {
  const kind: CardKind = /spell/i.test(card.type) ? 'spell' : /trap/i.test(card.type) ? 'trap' : /monster/i.test(card.type) ? 'monster' : 'unknown';
  return {
    cardId: card.id,
    nameEn: card.name,
    kind,
    isExtraDeckType: EXTRA_FRAMES.has(card.frameType ?? ''),
    frameType: card.frameType,
    source: CARD_SOURCE,
    updatedAt: now,
  };
}

@Injectable({ providedIn: 'root' })
export class YgoProDeckClient {
  private readonly fetchFn = inject(FETCH_FN);
  private readonly sleep = inject(SLEEP_FN);
  private queue: Promise<unknown> = Promise.resolve();
  private lastStart = 0;

  /** Unknown IDs are simply absent from the result (the API answers 400 when none match). */
  async fetchByIds(ids: readonly number[]): Promise<ApiCard[]> {
    const cards: ApiCard[] = [];
    for (let i = 0; i < ids.length; i += ID_BATCH) {
      const batch = ids.slice(i, i + ID_BATCH);
      cards.push(...(await this.getCards(`${CARD_API_BASE}/cardinfo.php?id=${batch.join(',')}`)));
    }
    return cards;
  }

  searchByName(fname: string): Promise<ApiCard[]> {
    return this.getCards(`${CARD_API_BASE}/cardinfo.php?fname=${encodeURIComponent(fname)}`);
  }

  async fetchImage(cardId: number, variant: ImageVariant): Promise<Blob> {
    const folder = variant === 'small' ? 'cards_small' : 'cards_cropped';
    const response = await this.request(`${CARD_IMAGE_BASE}/${folder}/${cardId}.jpg`);
    if (!response.ok) throw new CardApiError(`卡圖下載失敗（HTTP ${response.status}）`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      throw new CardApiError('卡圖下載失敗：伺服器未回傳圖片。卡圖下載需以 npm start 啟動的本機伺服器（含圖片代理）。');
    }
    return blob;
  }

  private async getCards(url: string): Promise<ApiCard[]> {
    const response = await this.request(url);
    if (response.status === 400) return []; // "No card matching your query"
    if (!response.ok) throw new CardApiError(`卡片資料下載失敗（HTTP ${response.status}）`);
    const body = (await response.json()) as { data?: unknown };
    if (!Array.isArray(body.data)) throw new CardApiError('卡片資料格式不符預期');
    return body.data.filter(isApiCard);
  }

  /** Throttled, sequential, with exponential backoff on network errors, 429 and 5xx. */
  private request(url: string): Promise<Response> {
    const run = async () => {
      for (let attempt = 0; ; attempt++) {
        const wait = this.lastStart + MIN_INTERVAL_MS - Date.now();
        if (wait > 0) await this.sleep(wait);
        this.lastStart = Date.now();
        let response: Response | undefined;
        try {
          response = await this.fetchFn(url);
        } catch {
          response = undefined;
        }
        const retryable = !response || response.status === 429 || response.status >= 500;
        if (!retryable) return response!;
        if (attempt >= RETRY_DELAYS_MS.length) {
          throw new CardApiError(response ? `伺服器暫時無法回應（HTTP ${response.status}）` : '無法連線到卡片資料來源（可能離線）');
        }
        await this.sleep(RETRY_DELAYS_MS[attempt]);
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

function isApiCard(value: unknown): value is ApiCard {
  const v = value as ApiCard;
  return typeof v === 'object' && v !== null && Number.isInteger(v.id) && v.id > 0 && typeof v.name === 'string' && typeof v.type === 'string';
}
