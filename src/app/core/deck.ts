import { CardCount, CardRecord, DeckRecord, DeckZone } from './models';

export const DECK_ZONES: readonly DeckZone[] = ['main', 'extra', 'side'];

export const ZONE_LABEL: Record<DeckZone, string> = { main: '主牌', extra: '額外', side: '備牌' };

/** Largest passcode a YDKE uint32 can carry. */
export const MAX_CARD_ID = 0xffffffff;

export interface ParsedDeck {
  main: CardCount[];
  extra: CardCount[];
  side: CardCount[];
}

export interface ParseIssue {
  line?: number;
  text?: string;
  message: string;
}

export type ParseResult = { ok: true; deck: ParsedDeck } | { ok: false; errors: ParseIssue[] };

export function newDeck(name: string, now = new Date().toISOString(), id: string = crypto.randomUUID()): DeckRecord {
  return {
    schemaVersion: 1,
    id,
    name,
    format: 'master-duel',
    version: 1,
    main: [],
    extra: [],
    side: [],
    source: { type: 'manual' },
    createdAt: now,
    updatedAt: now,
  };
}

export function totalCount(cards: readonly CardCount[]): number {
  return cards.reduce((sum, c) => sum + c.count, 0);
}

/** One row per card ID, first-seen order; each occurrence adds one copy. */
export function countsFromIds(ids: readonly number[]): CardCount[] {
  const counts = new Map<number, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([cardId, count]) => ({ cardId, count }));
}

export function countOf(cards: readonly CardCount[], cardId: number): number {
  return cards.find((c) => c.cardId === cardId)?.count ?? 0;
}

export function deckCardIds(deck: ParsedDeck): number[] {
  return [...new Set(DECK_ZONES.flatMap((zone) => deck[zone].map((c) => c.cardId)))];
}

/** Returns an error message, or the passcode when the token is a valid card ID. */
export function parseCardId(token: string): number | string {
  if (/^-\d+$/.test(token)) return '卡片 ID 不可為負數';
  if (/^-?\d+[.,]\d+$/.test(token)) return '卡片 ID 必須是整數';
  if (!/^\d+$/.test(token)) return '不是有效的卡片 ID（只能包含數字）';
  const id = Number(token);
  if (id === 0) return '卡片 ID 不可為 0';
  if (id > MAX_CARD_ID) return `卡片 ID 超出範圍（最大 ${MAX_CARD_ID}）`;
  return id;
}

/**
 * Identifies a deck list (main + extra, order-independent) so a verified route records exactly
 * which list it was tested with. Side deck and name do not affect it.
 */
export function deckFingerprint(deck: Pick<ParsedDeck, 'main' | 'extra'>): string {
  const canonical = (rows: readonly CardCount[]) =>
    [...rows]
      .filter((r) => r.count > 0)
      .sort((a, b) => a.cardId - b.cardId)
      .map((r) => `${r.cardId}x${r.count}`)
      .join(',');
  return `fp1-${cyrb53(`m:${canonical(deck.main)}|e:${canonical(deck.extra)}`).toString(16).padStart(14, '0')}`;
}

/** cyrb53 string hash (public domain) — stable, synchronous, 53-bit. */
function cyrb53(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function displayName(card: CardRecord | undefined): string {
  return card?.nameZhTw ?? card?.nameEn ?? '未識別';
}

export interface DeckCheck {
  totals: Record<DeckZone, number>;
  errors: string[];
  unresolvedIds: number[];
  /** Only a fully resolved, rule-valid deck may enter the normal opening-hand query. */
  queryable: boolean;
}

export function checkDeck(deck: ParsedDeck, cards: ReadonlyMap<number, CardRecord>): DeckCheck {
  const totals = { main: totalCount(deck.main), extra: totalCount(deck.extra), side: totalCount(deck.side) };
  const errors: string[] = [];

  if (totals.main < 40 || totals.main > 60) errors.push(`主牌 ${totals.main} 張（需 40–60 張）`);
  if (totals.extra > 15) errors.push(`額外 ${totals.extra} 張（最多 15 張）`);

  for (const zone of DECK_ZONES) {
    const seen = new Set<number>();
    for (const { cardId, count } of deck[zone]) {
      if (seen.has(cardId)) errors.push(`${ZONE_LABEL[zone]}中 ID ${cardId} 有重複資料列`);
      seen.add(cardId);
      if (!Number.isInteger(count) || count < 1) errors.push(`${ZONE_LABEL[zone]}中 ID ${cardId} 的張數無效（${count}）`);
    }
  }

  const perCard = new Map<number, number>();
  for (const zone of DECK_ZONES) {
    for (const { cardId, count } of deck[zone]) perCard.set(cardId, (perCard.get(cardId) ?? 0) + count);
  }
  for (const [cardId, count] of perCard) {
    if (count > 3) errors.push(`「${displayName(cards.get(cardId))}」（ID ${cardId}）共 ${count} 張（同名卡最多 3 張）`);
  }

  const unresolvedIds = [...perCard.keys()].filter((id) => !cards.has(id));
  if (unresolvedIds.length) errors.push(`${unresolvedIds.length} 種卡片尚未識別（ID：${unresolvedIds.join('、')}）`);

  for (const { cardId } of deck.main) {
    if (cards.get(cardId)?.isExtraDeckType) errors.push(`主牌含額外牌組怪獸「${displayName(cards.get(cardId))}」`);
  }
  for (const { cardId } of deck.extra) {
    const card = cards.get(cardId);
    if (card && card.isExtraDeckType === false) errors.push(`額外牌組含非額外牌組卡「${displayName(card)}」`);
  }

  return { totals, errors, unresolvedIds, queryable: errors.length === 0 };
}
