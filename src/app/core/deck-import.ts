import { ParseResult } from './deck';
import { parseYdk } from './ydk';
import { parseYdke } from './ydke';

export type DeckTextFormat = 'ydke' | 'ydk' | 'unknown';

export const UNKNOWN_FORMAT_MESSAGE =
  '無法辨識的牌組格式。目前支援 ydke:// 代碼與 YDK 牌組檔。' +
  '若這是 Master Duel 遊戲內牌組代碼：此格式仍在研究中，尚不支援直接匯入，請改用 ydke:// 或 YDK。';

export function detectDeckFormat(text: string): DeckTextFormat {
  const trimmed = text.replace(/^﻿/, '').trim();
  if (/^ydke:\/\//i.test(trimmed)) return 'ydke';
  const lines = trimmed.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.some((l) => l.startsWith('#') || l.startsWith('!'))) return 'ydk';
  return 'unknown';
}

/** rev1 R2: one input box; the detected format is handed to the matching strict parser. */
export function parseDeckText(text: string): { format: DeckTextFormat; result: ParseResult } {
  const format = detectDeckFormat(text);
  if (format === 'ydke') return { format, result: parseYdke(text) };
  if (format === 'ydk') return { format, result: parseYdk(text) };
  return { format, result: { ok: false, errors: [{ message: text.trim() ? UNKNOWN_FORMAT_MESSAGE : '內容為空' }] } };
}
