import { ParseResult } from './deck';
import { isNeuronDeckText } from './neuron-deck';
import { parseYdk } from './ydk';
import { parseYdke } from './ydke';

/** 'neuron' = deck list text copied from the official Yu-Gi-Oh! Neuron deck page (G21). */
export type DeckTextFormat = 'ydke' | 'ydk' | 'neuron' | 'unknown';

export const UNKNOWN_FORMAT_MESSAGE =
  '無法辨識的牌組格式。目前支援 ydke:// 代碼、YDK 牌組檔，以及從官方牌組頁（英文）複製的牌表文字。' +
  'Master Duel 遊戲內牌組代碼無法直接解碼：請在上方輸入代碼開啟官方牌組頁後貼上牌表，或改用 ydke:// 或 YDK。';

export function detectDeckFormat(text: string): DeckTextFormat {
  const trimmed = text.replace(/^﻿/, '').trim();
  if (/^ydke:\/\//i.test(trimmed)) return 'ydke';
  if (isNeuronDeckText(trimmed)) return 'neuron';
  const lines = trimmed.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.some((l) => l.startsWith('#') || l.startsWith('!'))) return 'ydk';
  return 'unknown';
}

/** rev1 R2: one input box; the detected format is handed to the matching strict parser. */
export function parseDeckText(text: string): { format: DeckTextFormat; result: ParseResult } {
  const format = detectDeckFormat(text);
  if (format === 'ydke') return { format, result: parseYdke(text) };
  if (format === 'ydk') return { format, result: parseYdk(text) };
  if (format === 'neuron') {
    return { format, result: { ok: false, errors: [{ message: '官方牌組頁的牌表需要以本機卡片資料庫對應卡名，請使用牌組匯入面板解析。' }] } };
  }
  return { format, result: { ok: false, errors: [{ message: text.trim() ? UNKNOWN_FORMAT_MESSAGE : '內容為空' }] } };
}
