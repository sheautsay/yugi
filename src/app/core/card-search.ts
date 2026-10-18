import { CardKind, CardPool, CardRecord } from './models';

// Local card search over the synced database (G18). Pure functions: no I/O, no network.

export const PAGE_SIZE = 24;
const MAX_QUERY = 100;

export interface CardQuery {
  text: string;
  kind: CardKind | 'any';
  zone: 'any' | 'main' | 'extra';
  archetype: string;
  attribute: string;
  race: string;
  /** Level or rank; null = any. */
  level: number | null;
  pool: CardPool;
}

export const EMPTY_QUERY: CardQuery = { text: '', kind: 'any', zone: 'any', archetype: '', attribute: '', race: '', level: null, pool: 'master-duel' };

export function inPool(card: CardRecord, pool: CardPool): boolean {
  return pool === 'all' || !!card.formats?.includes('Master Duel');
}

/** Skill and Token cards are listed but never go into a deck (N16). */
export function isDeckCard(card: CardRecord): boolean {
  return card.frameType !== 'skill' && card.frameType !== 'token' && card.kind !== 'unknown';
}

const norm = (s: string) => s.normalize('NFKC').toLowerCase().trim();

/** Extra searchable names of a card from the translation table (CR-009); already normalised by searchNames(). */
export type ExtraNames = (card: CardRecord) => { names: string[]; aliases: string[] } | undefined;

/** 0 = best. Exact ID, exact name, prefix, contained; Infinity = no match. */
function textRank(card: CardRecord, q: string, extra?: ExtraNames): number {
  if (!q) return 3;
  if (/^\d+$/.test(q)) return String(card.cardId) === q ? 0 : Infinity;
  const more = extra?.(card);
  const names = [card.nameEn, card.nameZhTw, ...(more?.names ?? [])].filter((n): n is string => !!n).map(norm);
  const aliases = [...(card.aliases ?? []).map(norm), ...(more?.aliases ?? [])];
  if (names.includes(q) || aliases.includes(q)) return 1;
  if (names.some((n) => n.startsWith(q))) return 2;
  if (names.some((n) => n.includes(q))) return 3;
  if (aliases.some((a) => a.includes(q))) return 4;
  return Infinity;
}

export function searchCards(cards: readonly CardRecord[], query: CardQuery, extra?: ExtraNames): CardRecord[] {
  const q = norm(query.text.slice(0, MAX_QUERY));
  const archetype = norm(query.archetype);
  const ranked: Array<{ card: CardRecord; rank: number }> = [];
  for (const card of cards) {
    if (!inPool(card, query.pool)) continue;
    if (query.kind !== 'any' && card.kind !== query.kind) continue;
    if (query.zone === 'extra' && !card.isExtraDeckType) continue;
    if (query.zone === 'main' && (card.isExtraDeckType || card.kind === 'unknown')) continue;
    if (archetype && norm(card.archetype ?? '') !== archetype) continue;
    if (query.attribute && card.attribute !== query.attribute) continue;
    if (query.race && card.race !== query.race) continue;
    if (query.level !== null && card.level !== query.level) continue;
    const rank = textRank(card, q, extra);
    if (rank !== Infinity) ranked.push({ card, rank });
  }
  return ranked.sort((a, b) => a.rank - b.rank || a.card.nameEn.localeCompare(b.card.nameEn)).map((r) => r.card);
}

export interface Facets {
  archetypes: string[];
  attributes: string[];
  races: string[];
  levels: number[];
}

/** Values offered by the filter controls, taken from the cards actually in the pool. */
export function facets(cards: readonly CardRecord[], pool: CardPool): Facets {
  const archetypes = new Set<string>();
  const attributes = new Set<string>();
  const races = new Set<string>();
  const levels = new Set<number>();
  for (const c of cards) {
    if (!inPool(c, pool)) continue;
    if (c.archetype) archetypes.add(c.archetype);
    if (c.attribute) attributes.add(c.attribute);
    if (c.race) races.add(c.race);
    if (c.level !== undefined) levels.add(c.level);
  }
  const sorted = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b));
  return { archetypes: sorted(archetypes), attributes: sorted(attributes), races: sorted(races), levels: [...levels].sort((a, b) => a - b) };
}

export function pageOf<T>(items: readonly T[], page: number, size = PAGE_SIZE): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(pages, Math.max(1, Math.trunc(page) || 1));
  return { items: items.slice((current - 1) * size, current * size), page: current, pages };
}
