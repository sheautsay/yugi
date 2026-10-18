import { z } from 'zod';
import { CardRecord } from './models';

// rev9 card-name rules (G55–G68). Pure functions: no storage, no Angular, no network. The translation table
// is a supplement keyed by the same cardId as the card database; it never changes an ID, the English name,
// effect text or any rule. Every screen that shows a card name goes through `labelFor` (via CardNamesService).

/** Where a Traditional Chinese name came from. `user` = the user corrected it on the card (never imported). */
export const NAME_STATUSES = ['user', 'official', 'community', 'provisional'] as const;
export type NameStatus = (typeof NAME_STATUSES)[number];

/** The statuses a file may carry. `user` is reserved for manual corrections (N52). */
export const IMPORT_STATUSES = ['official', 'community', 'provisional'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/** `zh-TW` = Traditional Chinese (default), `en` = English, `both` = Traditional with the English in brackets. */
export const CARD_LANGUAGES = ['zh-TW', 'en', 'both'] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];
export const DEFAULT_CARD_LANGUAGE: CardLanguage = 'zh-TW';

export const CARD_LANGUAGE_LABEL: Record<CardLanguage, string> = {
  'zh-TW': '繁體中文（預設）',
  en: 'English',
  both: '中英文並列',
};

export const STATUS_LABEL: Record<NameStatus, string> = {
  user: '使用者修正',
  official: '正式名稱',
  community: '社群通用名稱',
  provisional: '暫定（簡體轉換）',
};

/** Lower rank = higher priority: user correction > official > community > provisional. */
const STATUS_RANK: Record<NameStatus, number> = { user: 0, official: 1, community: 2, provisional: 3 };

/** One imported translation for one card ID. Simplified names are stored for search only (N51). */
export interface CardNameEntry {
  cardId: number;
  /** Reference copy of the English name at import time; the card database stays the source of truth. */
  nameEn?: string;
  nameZhTw?: string;
  nameZhCn?: string;
  aliases: string[];
  translationSource: string;
  translationStatus: ImportStatus;
  updatedAt?: string;
}

/** A new entry may replace the stored one only when its rank is the same or higher (G64, N50). */
export function mayReplace(existing: CardNameEntry | undefined, incoming: CardNameEntry): boolean {
  if (!existing) return true;
  return STATUS_RANK[incoming.translationStatus] <= STATUS_RANK[existing.translationStatus];
}

export interface ZhTwName {
  text: string;
  status: NameStatus;
  source?: string;
}

/** The Traditional Chinese name to show: the user's own correction first, then the imported entry (G64). */
export function zhTwName(card: Pick<CardRecord, 'nameZhTw'> | undefined, entry: CardNameEntry | undefined): ZhTwName | null {
  const userName = card?.nameZhTw?.trim();
  if (userName) return { text: userName, status: 'user' };
  const imported = entry?.nameZhTw?.trim();
  if (imported && entry) return { text: imported, status: entry.translationStatus, source: entry.translationSource };
  return null;
}

/**
 * The text a screen shows for one card. A card that is not in the local database is "未識別" (the wording the
 * existing gates assert; see CR-009); a missing Traditional name falls back to the English name (G58); a provisional
 * name always carries 暫定 (G67); `both` puts the English in brackets.
 */
export function labelFor(cardId: number, card: CardRecord | undefined, entry: CardNameEntry | undefined, lang: CardLanguage): string {
  if (!card) return '未識別';
  const en = card.nameEn || `ID ${cardId}`;
  const zh = zhTwName(card, entry);
  const zhLabel = zh ? (zh.status === 'provisional' ? `${zh.text}（暫定）` : zh.text) : null;
  if (lang === 'en') return en;
  if (lang === 'both') return zhLabel ? `${zhLabel}（${en}）` : en;
  return zhLabel ?? en;
}

/** Comparable form for search and identification: NFKC, lower case, trimmed. */
export const normalizeName = (s: string): string => s.normalize('NFKC').toLowerCase().trim();

/** Every name that can find this card: English, Traditional, Simplified (search only) and the aliases. */
export function searchNames(card: CardRecord, entry: CardNameEntry | undefined): { names: string[]; aliases: string[] } {
  const names = [card.nameEn, card.nameZhTw, entry?.nameEn, entry?.nameZhTw, entry?.nameZhCn].filter((n): n is string => !!n?.trim());
  const aliases = [...(card.aliases ?? []), ...(entry?.aliases ?? [])].filter((a) => !!a.trim());
  return { names: [...new Set(names.map(normalizeName))], aliases: [...new Set(aliases.map(normalizeName))] };
}

export type IdentifyResult = { status: 'matched'; cardId: number } | { status: 'pending'; candidates: number[] };

const MAX_CANDIDATES = 5;

/**
 * Identify a name typed or returned by the AI (G62, N46). Only an exact match (after normalising) on one card,
 * or an ID that exists, counts. Zero or several matches are "pending" with the candidates listed; nothing is guessed.
 */
export function identifyCardName(input: string, cards: ReadonlyMap<number, CardRecord>, entries: ReadonlyMap<number, CardNameEntry>): IdentifyResult {
  const q = normalizeName(input);
  if (!q) return { status: 'pending', candidates: [] };
  if (/^\d+$/.test(q)) {
    const id = Number(q);
    return cards.has(id) ? { status: 'matched', cardId: id } : { status: 'pending', candidates: [] };
  }
  const found: number[] = [];
  for (const [id, card] of cards) {
    const terms = searchNames(card, entries.get(id));
    if (terms.names.includes(q) || terms.aliases.includes(q)) found.push(id);
  }
  found.sort((a, b) => a - b);
  if (found.length === 1) return { status: 'matched', cardId: found[0] };
  return { status: 'pending', candidates: found.slice(0, MAX_CANDIDATES) };
}

export interface CoverageStats {
  total: number;
  translated: number;
  untranslated: number;
  byStatus: Record<NameStatus, number>;
  /** Whole percent of the cards with a Traditional Chinese name. 0 for an empty database. */
  percent: number;
}

/** Counts over the cards given (the caller decides the pool). IDs without a card are ignored. */
export function coverage(cards: readonly CardRecord[], entries: ReadonlyMap<number, CardNameEntry>): CoverageStats {
  const byStatus: Record<NameStatus, number> = { user: 0, official: 0, community: 0, provisional: 0 };
  let translated = 0;
  for (const card of cards) {
    const zh = zhTwName(card, entries.get(card.cardId));
    if (!zh) continue;
    translated++;
    byStatus[zh.status]++;
  }
  const total = cards.length;
  return { total, translated, untranslated: total - translated, byStatus, percent: total ? Math.round((translated / total) * 100) : 0 };
}

const nameText = z.string().trim().min(1).max(80);

const importEntrySchema = z
  .strictObject({
    cardId: z.number().int().positive(),
    nameEn: z.string().trim().min(1).max(200).optional(),
    nameZhTw: nameText.optional(),
    nameZhCn: nameText.optional(),
    aliases: z.array(nameText).max(20).optional(),
    translationSource: z.string().trim().min(1).max(200),
    translationStatus: z.enum(IMPORT_STATUSES),
    updatedAt: z.string().max(40).optional(),
  })
  .refine((e) => !!e.nameZhTw || !!e.nameZhCn, { message: '至少要有繁體或簡體中文名稱之一' });

const importFileSchema = z.array(importEntrySchema).max(50_000);

export type ImportParse = { ok: true; entries: CardNameEntry[] } | { ok: false; errors: string[] };

/**
 * Validates a whole file before anything is written (G68, N47, N52). One bad entry rejects the file; a card ID
 * repeated in the file is rejected too, so the file can never be applied half-way or in an unclear order.
 */
export function parseNameImport(text: string): ImportParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['檔案不是有效的 JSON'] };
  }
  const parsed = importFileSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 10).map((issue) => {
      const at = typeof issue.path[0] === 'number' ? `第 ${issue.path[0] + 1} 筆：` : '';
      return `${at}${issue.message}`;
    });
    return { ok: false, errors: errors.length ? errors : ['檔案格式不符'] };
  }
  const seen = new Set<number>();
  for (const e of parsed.data) {
    if (seen.has(e.cardId)) return { ok: false, errors: [`同一個檔案中卡片 ID ${e.cardId} 重複`] };
    seen.add(e.cardId);
  }
  return { ok: true, entries: parsed.data.map((e) => ({ ...e, aliases: e.aliases ?? [] })) };
}
