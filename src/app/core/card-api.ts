import { Injectable, InjectionToken, inject } from '@angular/core';
import { CardKind, CardPool, CardRecord, LINK_MARKERS, LinkMarker } from './models';

// The single place that talks to the network (spec §9.8). Card metadata comes straight from the
// YGOPRODeck API (CORS enabled); card images go through the dev-server proxy in proxy.conf.json
// because images.ygoprodeck.com sends no CORS headers and the app must read image pixels.
export const CARD_API_BASE = 'https://db.ygoprodeck.com/api/v7';
export const CARD_IMAGE_BASE = '/ygo-images';
/** Where card images are fetched from. The browser build uses the dev-server proxy above; the desktop build points straight at the image host (CR-010). */
export const CARD_IMAGE_BASE_URL = new InjectionToken<string>('CARD_IMAGE_BASE_URL', { providedIn: 'root', factory: () => CARD_IMAGE_BASE });
export const CARD_SOURCE = 'YGOPRODeck API v7';

/** Requests per batch of IDs; keeps URLs short. */
const ID_BATCH = 50;
/** Minimum gap between API requests — far below the upstream limit of 20 requests/second. */
const MIN_INTERVAL_MS = 250;
/** Images use their own lane (≤ 10/s) so thumbnails never wait behind a card-data sync. */
const IMAGE_INTERVAL_MS = 100;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

export interface ApiCard {
  id: number;
  name: string;
  type: string;
  frameType?: string;
  desc?: string;
  race?: string;
  attribute?: string;
  level?: number;
  linkval?: number;
  atk?: number | null;
  def?: number | null;
  archetype?: string;
  banlist_info?: { ban_tcg?: string; ban_ocg?: string };
  misc_info?: Array<{ formats?: string[] }>;
  /** Link arrows, e.g. ["Top", "Bottom-Left"] (Link Monsters only). */
  linkmarkers?: string[];
  /** Type tags, e.g. ["Cyberse", "Link", "Effect"]. */
  typeline?: string[];
}

export type ImageVariant = 'small' | 'cropped' | 'full';

const IMAGE_FOLDER: Record<ImageVariant, string> = { small: 'cards_small', cropped: 'cards_cropped', full: 'cards' };

/** Source format name for each pool (`format=masterduel` is rejected by the API). */
const POOL_QUERY: Record<CardPool, string> = { 'master-duel': '&format=master%20duel', all: '' };

export interface DbVersion {
  version: string;
  lastUpdate: string;
}

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
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  const ban = card.banlist_info;
  const formats = card.misc_info?.[0]?.formats?.filter((f) => typeof f === 'string');
  const markers = Array.isArray(card.linkmarkers) ? card.linkmarkers.filter((m): m is LinkMarker => (LINK_MARKERS as readonly string[]).includes(m)) : [];
  const tags = Array.isArray(card.typeline) ? card.typeline.filter((t) => typeof t === 'string' && t.trim()) : [];
  const record: CardRecord = {
    cardId: card.id,
    nameEn: card.name,
    kind,
    isExtraDeckType: EXTRA_FRAMES.has(card.frameType ?? ''),
    frameType: card.frameType,
    source: CARD_SOURCE,
    updatedAt: now,
    typeLine: card.type,
    race: str(card.race),
    attribute: str(card.attribute),
    level: num(card.level),
    linkval: num(card.linkval),
    atk: num(card.atk),
    def: num(card.def),
    archetype: str(card.archetype),
    desc: str(card.desc),
    formats: formats?.length ? formats : undefined,
    banlist: ban && (str(ban.ban_tcg) || str(ban.ban_ocg)) ? { tcg: str(ban.ban_tcg), ocg: str(ban.ban_ocg) } : undefined,
    linkMarkers: markers.length ? markers : undefined,
    typeTags: tags.length ? tags : undefined,
  };
  // Drop absent fields so merging into an existing record never erases data.
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)) as unknown as CardRecord;
}

@Injectable({ providedIn: 'root' })
export class YgoProDeckClient {
  private readonly fetchFn = inject(FETCH_FN);
  private readonly sleep = inject(SLEEP_FN);
  private readonly imageBase = inject(CARD_IMAGE_BASE_URL);
  private readonly lanes = {
    api: { queue: Promise.resolve() as Promise<unknown>, lastStart: 0, interval: MIN_INTERVAL_MS },
    image: { queue: Promise.resolve() as Promise<unknown>, lastStart: 0, interval: IMAGE_INTERVAL_MS },
  };

  /** Version of the upstream card database, used to skip unnecessary full downloads. */
  async checkDbVersion(): Promise<DbVersion> {
    const response = await this.request(`${CARD_API_BASE}/checkDBVer.php`);
    if (!response.ok) throw new CardApiError(`版本檢查失敗（HTTP ${response.status}）`);
    const body = (await response.json().catch(() => null)) as Array<{ database_version?: unknown; last_update?: unknown }> | null;
    const row = Array.isArray(body) ? body[0] : undefined;
    if (!row || typeof row.database_version !== 'string' || !row.database_version) throw new CardApiError('版本資訊格式不符預期');
    return { version: row.database_version, lastUpdate: String(row.last_update ?? '') };
  }

  /** Every card of the pool in one request (≈24 MB); throws instead of returning a partial list. */
  async fetchAll(pool: CardPool): Promise<ApiCard[]> {
    const response = await this.request(`${CARD_API_BASE}/cardinfo.php?misc=yes${POOL_QUERY[pool]}`);
    if (!response.ok) throw new CardApiError(`完整卡片資料下載失敗（HTTP ${response.status}）`);
    const body = (await response.json().catch(() => null)) as { data?: unknown } | null;
    if (!body || !Array.isArray(body.data)) throw new CardApiError('完整卡片資料格式不符預期（缺少 data 陣列）');
    const cards = body.data.filter(isApiCard);
    if (cards.length === 0) throw new CardApiError('完整卡片資料是空的');
    return cards;
  }

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
    const response = await this.request(`${this.imageBase}/${IMAGE_FOLDER[variant]}/${cardId}.jpg`, 'image');
    if (!response.ok) throw new CardApiError(`卡圖下載失敗（HTTP ${response.status}）`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      throw new CardApiError(
        this.imageBase === CARD_IMAGE_BASE
          ? '卡圖下載失敗：伺服器未回傳圖片。卡圖下載需以 npm start 啟動的本機伺服器（含圖片代理）。'
          : '卡圖下載失敗：伺服器未回傳圖片。',
      );
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
  private request(url: string, laneName: 'api' | 'image' = 'api'): Promise<Response> {
    const lane = this.lanes[laneName];
    const run = async () => {
      for (let attempt = 0; ; attempt++) {
        const wait = lane.lastStart + lane.interval - Date.now();
        if (wait > 0) await this.sleep(wait);
        lane.lastStart = Date.now();
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
    const result = lane.queue.then(run, run);
    lane.queue = result.catch(() => undefined);
    return result;
  }
}

function isApiCard(value: unknown): value is ApiCard {
  const v = value as ApiCard;
  return typeof v === 'object' && v !== null && Number.isInteger(v.id) && v.id > 0 && typeof v.name === 'string' && typeof v.type === 'string';
}
