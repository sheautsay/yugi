import { isDeckCard, inPool } from './card-search';
import { ParseIssue, ParsedDeck } from './deck';
import { CardCount, CardRecord, DeckZone } from './models';

// G21: Master Duel deck codes are resolved by the user on the official Yu-Gi-Oh! Neuron site
// (its terms forbid automated retrieval without written consent). The app only builds the search
// link, then parses the deck list text the user copies from the English deck page.

const DECK_SEARCH_URL = 'https://www.db.yugioh-card.com/yugiohdb/deck_search.action';

export function deckCodeError(code: string): string | null {
  const c = code.trim();
  if (!c) return '請輸入 Master Duel 牌組代碼（例如 2962ut6）。';
  if (!/^[0-9A-Za-z]+$/.test(c)) return '牌組代碼只能包含英文字母與數字（例如 2962ut6）。';
  if (c.length < 4 || c.length > 20) return '牌組代碼長度應為 4～20 個字元。';
  return null;
}

/** Official public Deck Search for a code (English page, so card names match the local data). */
export function officialDeckSearchUrl(code: string): string {
  return `${DECK_SEARCH_URL}?ope=1&deck_code=${encodeURIComponent(code.trim())}&request_locale=en`;
}

const SECTION_ZONE: Record<string, DeckZone> = {
  'monster cards': 'main',
  'spell cards': 'main',
  'trap cards': 'main',
  'extra deck': 'extra',
  'side deck': 'side',
};
const BAN_LINE = /^(forbidden|limited|semi-limited|unlimited)( cards)?$/i;

export interface NeuronSection {
  title: string;
  zone: DeckZone;
  /** The section total printed on the page. */
  declared: number;
  rows: Array<{ name: string; count: number }>;
}

export function isNeuronDeckText(text: string): boolean {
  return text.split(/\r\n|\r|\n/).some((l) => SECTION_ZONE[l.trim().toLowerCase()] !== undefined);
}

/**
 * Parses the deck list copied from the English deck page: section header, section total, then
 * rows of "row number ⇥ / card name / [ban status] / count" (one or several lines per row).
 * Every section's rows must add up to its printed total, so a partial copy is caught.
 */
export function parseNeuronDeckText(text: string): { ok: true; sections: NeuronSection[] } | { ok: false; errors: ParseIssue[] } {
  const sections: NeuronSection[] = [];
  const errors: ParseIssue[] = [];
  let current: NeuronSection | null = null;
  let expectTotal = false;
  let row: { line: number; name?: string } | null = null;

  const addRow = (name: string, count: number, line: number) => {
    if (count < 1 || count > 3) errors.push({ line, message: `「${name}」的張數 ${count} 不在 1～3 之間` });
    current!.rows.push({ name, count });
  };
  const finishRow = () => {
    if (row?.name !== undefined) errors.push({ line: row.line, message: `「${row.name}」缺少張數` });
    row = null;
  };

  text
    .replace(/^﻿/, '')
    .split(/\r\n|\r|\n/)
    .forEach((raw, index) => {
      const line = raw.trim();
      const lineNo = index + 1;
      const zone = SECTION_ZONE[line.toLowerCase()];
      if (zone) {
        finishRow();
        if (sections.some((s) => s.title.toLowerCase() === line.toLowerCase())) errors.push({ line: lineNo, message: `區段「${line}」重複出現（可能複製了兩次）` });
        current = { title: line, zone, declared: Number.NaN, rows: [] };
        sections.push(current);
        expectTotal = true;
        return;
      }
      if (!current || !line) return; // text before the first section, blank lines
      const start = /^\s*\d+\t(.*)$/.exec(raw); // row numbers carry a tab; totals and counts do not
      if (expectTotal) {
        expectTotal = false;
        if (!start && /^\d+$/.test(line)) {
          current.declared = Number(line);
          return;
        }
      }
      if (start) {
        finishRow();
        const cells = start[1].split('\t').map((c) => c.trim()).filter(Boolean);
        if (cells.length === 0) row = { line: lineNo }; // name on the next line, or an empty row
        else if (cells.length >= 2 && /^\d+$/.test(cells.at(-1)!)) addRow(cells[0], Number(cells.at(-1)), lineNo);
        else row = { line: lineNo, name: cells[0] };
        return;
      }
      if (!row) return;
      if (row.name === undefined) {
        row.name = line;
      } else if (/^\d+$/.test(line)) {
        addRow(row.name, Number(line), row.line);
        row = null;
      } else if (!BAN_LINE.test(line)) {
        errors.push({ line: lineNo, message: `「${row.name}」後面應為張數，卻是「${line}」` });
        row = null;
      }
    });
  finishRow();

  if (sections.length === 0) errors.push({ message: '找不到官方牌表的區段（Monster Cards、Spell Cards、Trap Cards、Extra Deck、Side Deck）' });
  for (const s of sections) {
    const sum = s.rows.reduce((total, r) => total + r.count, 0);
    if (Number.isNaN(s.declared)) errors.push({ message: `「${s.title}」後面缺少區段合計張數` });
    else if (sum !== s.declared) errors.push({ message: `「${s.title}」標示 ${s.declared} 張，但讀到 ${sum} 張（可能沒有完整複製）` });
  }
  return errors.length ? { ok: false, errors } : { ok: true, sections };
}

const normName = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Maps card names to passcodes with the local card database. Cards stay in the zone the page lists
 * them in; names the database does not know are returned instead of being dropped.
 */
export function resolveNeuronDeck(sections: readonly NeuronSection[], cards: readonly CardRecord[]): { deck: ParsedDeck; unknownNames: string[] } {
  const byName = new Map<string, CardRecord[]>();
  for (const card of cards) {
    const key = normName(card.nameEn);
    byName.set(key, [...(byName.get(key) ?? []), card]);
  }
  const pick = (name: string) => {
    const matches = byName.get(normName(name)) ?? [];
    return matches.find((c) => isDeckCard(c) && inPool(c, 'master-duel')) ?? matches.find(isDeckCard) ?? matches[0];
  };

  const rows: Record<DeckZone, CardCount[]> = { main: [], extra: [], side: [] };
  const unknown = new Set<string>();
  for (const section of sections) {
    for (const { name, count } of section.rows) {
      const card = pick(name);
      if (!card) {
        unknown.add(name);
        continue;
      }
      const zone = rows[section.zone];
      const existing = zone.find((r) => r.cardId === card.cardId);
      if (existing) existing.count += count;
      else zone.push({ cardId: card.cardId, count });
    }
  }
  return { deck: rows, unknownNames: [...unknown] };
}
