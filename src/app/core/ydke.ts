import { DECK_ZONES, ParseIssue, ParseResult, ParsedDeck, ZONE_LABEL, countsFromIds } from './deck';
import { CardCount } from './models';

const SCHEME = /^ydke:\/\//i;

/** Parses `ydke://<main>!<extra>!<side>!` — each section base64 of uint32 little-endian passcodes. */
export function parseYdke(text: string): ParseResult {
  const input = text.trim();
  if (!input) return { ok: false, errors: [{ message: '內容為空' }] };
  if (!SCHEME.test(input)) return { ok: false, errors: [{ message: '不是 ydke:// 格式' }] };

  const parts = input.replace(SCHEME, '').split('!');
  if (parts.length !== 4 || parts[3] !== '') {
    return { ok: false, errors: [{ message: '分隔符不正確：格式應為 ydke://主牌!額外!備牌!（共 3 個「!」）' }] };
  }

  const errors: ParseIssue[] = [];
  const [main, extra, side] = DECK_ZONES.map((zone, i) => {
    const decoded = decodeSection(parts[i]);
    if (typeof decoded === 'string') {
      errors.push({ message: `${ZONE_LABEL[zone]}區段：${decoded}` });
      return [];
    }
    return decoded;
  });

  if (errors.length) return { ok: false, errors };
  return { ok: true, deck: { main: countsFromIds(main), extra: countsFromIds(extra), side: countsFromIds(side) } };
}

function decodeSection(b64: string): number[] | string {
  if (b64 === '') return [];
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length % 4 !== 0) return 'base64 編碼不合法';
  let bytes: string;
  try {
    bytes = atob(b64);
  } catch {
    return 'base64 編碼不合法';
  }
  if (bytes.length % 4 !== 0) return `資料長度 ${bytes.length} 位元組不是 4 的倍數`;

  const ids: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    const id =
      (bytes.charCodeAt(i) | (bytes.charCodeAt(i + 1) << 8) | (bytes.charCodeAt(i + 2) << 16) | (bytes.charCodeAt(i + 3) << 24)) >>> 0;
    if (id === 0) return `第 ${i / 4 + 1} 張卡片 ID 為 0（無效）`;
    ids.push(id);
  }
  return ids;
}

/** Inverse of {@link parseYdke}; used for export and round-trip tests. */
export function toYdke(deck: ParsedDeck): string {
  const encode = (cards: readonly CardCount[]) => {
    let bytes = '';
    for (const { cardId, count } of cards) {
      for (let n = 0; n < count; n++) {
        bytes += String.fromCharCode(cardId & 0xff, (cardId >>> 8) & 0xff, (cardId >>> 16) & 0xff, (cardId >>> 24) & 0xff);
      }
    }
    return btoa(bytes);
  };
  return `ydke://${encode(deck.main)}!${encode(deck.extra)}!${encode(deck.side)}!`;
}
