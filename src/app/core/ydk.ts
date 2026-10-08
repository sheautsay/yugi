import { ParseIssue, ParseResult, countsFromIds, parseCardId } from './deck';
import { DeckZone } from './models';

/** A real YDK is ~1 KB; anything this large is not a deck file. */
export const MAX_YDK_LENGTH = 256 * 1024;

const SECTIONS: Record<string, DeckZone> = { '#main': 'main', '#extra': 'extra', '!side': 'side' };

/** Parses YDK text (`#main` / `#extra` / `!side`, one passcode per line). */
export function parseYdk(text: string): ParseResult {
  if (!text.trim()) return { ok: false, errors: [{ message: '內容為空' }] };
  if (text.length > MAX_YDK_LENGTH) {
    return { ok: false, errors: [{ message: '內容過大（超過 256 KB），不像是 YDK 牌組檔' }] };
  }

  const ids: Record<DeckZone, number[]> = { main: [], extra: [], side: [] };
  const errors: ParseIssue[] = [];
  let zone: DeckZone | undefined;
  let sawSection = false;

  text
    .replace(/^﻿/, '')
    .split(/\r\n|\r|\n/)
    .forEach((raw, index) => {
      const line = raw.trim();
      const issue = (message: string) => errors.push({ line: index + 1, text: raw, message });
      if (!line) return;

      const section = SECTIONS[line.toLowerCase()];
      if (section) {
        zone = section;
        sawSection = true;
        return;
      }
      if (line.startsWith('#')) {
        const typo = sectionTypo(line.slice(1));
        if (typo) issue(typo);
        return; // other "#..." lines are header comments
      }
      if (line.startsWith('!')) {
        issue('未知的區段標記（只支援 #main、#extra、!side）');
        return;
      }
      const id = parseCardId(line);
      if (typeof id === 'string') {
        issue(id);
      } else if (!zone) {
        issue('卡片出現在任何區段（#main、#extra、!side）之前');
      } else {
        ids[zone].push(id);
      }
    });

  if (!sawSection) errors.push({ message: '找不到 #main、#extra 或 !side 區段標記' });
  if (errors.length) return { ok: false, errors };
  return { ok: true, deck: { main: countsFromIds(ids.main), extra: countsFromIds(ids.extra), side: countsFromIds(ids.side) } };
}

/** A one-word "#..." comment that is (almost) a section name is far more likely a typo than a header. */
function sectionTypo(word: string): string | undefined {
  const w = word.trim().toLowerCase();
  if (!w || /\s/.test(w)) return undefined;
  if (w === 'side') return '備牌區段標記應為 !side';
  for (const target of ['main', 'extra', 'side']) {
    if (osaDistance(w, target) === 1) {
      return `疑似區段標記拼字錯誤（是否為 ${target === 'side' ? '!side' : `#${target}`}？）`;
    }
  }
  return undefined;
}

/** Optimal string alignment distance (Levenshtein + adjacent transposition). */
function osaDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
