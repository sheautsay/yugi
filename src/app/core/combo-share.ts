import { COMBO_EXPORT_FORMAT, MAX_IMPORT_LENGTH, exportCombos } from './combo';
import { cyrb53 } from './deck';
import { ComboRoute } from './models';

// B6: a Combo as a short text code that fits in a chat message. The code is only a compact way to carry the same
// JSON the Combo export already uses; pasting it goes through the normal import check (`prepareComboImport`), so
// nothing arrives as "verified" and nothing is written before the user confirms.

export const SHARE_PREFIX = 'YGOCOMBO1';
const SEPARATOR = '.';
const CHECK_LENGTH = 6;

export type ShareDecode = { ok: true; routes: unknown[] } | { ok: false; error: string };

const toBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

const checkOf = (payload: string) => cyrb53(payload).toString(36).padStart(CHECK_LENGTH, '0').slice(-CHECK_LENGTH);

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // A refused or broken stream rejects the write too; the read below reports that, so this one stays quiet.
  void writer.write(bytes as BufferSource).then(() => writer.close()).catch(() => undefined);
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new Error('too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export const canShare = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/** `YGOCOMBO1.<base64url of the deflated JSON>.<6-character check>` for one Combo. */
export async function encodeShareCode(route: ComboRoute): Promise<string> {
  const json = new TextEncoder().encode(exportCombos([route], '1970-01-01T00:00:00.000Z'));
  const payload = toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
  return `${SHARE_PREFIX}${SEPARATOR}${payload}${SEPARATOR}${checkOf(payload)}`;
}

/** Whether the pasted text consists of share codes (one per line), so the import knows to decode it first. */
export const looksLikeShareCode = (text: string) => text.trim().startsWith(`${SHARE_PREFIX}${SEPARATOR}`);

/** Reads one or more share codes (a code per line, spaces and line breaks inside a code are ignored). */
export async function decodeShareCodes(text: string): Promise<ShareDecode> {
  if (!canShare()) return { ok: false, error: '這個環境不支援分享碼的解壓縮' };
  const codes = text
    .split(/\s*(?=YGOCOMBO1\.)/)
    .map((c) => c.replace(/\s+/g, ''))
    .filter(Boolean);
  if (!codes.length) return { ok: false, error: '沒有找到分享碼' };
  if (codes.length > 50) return { ok: false, error: '一次最多貼上 50 個分享碼' };
  const routes: unknown[] = [];
  for (const [i, code] of codes.entries()) {
    const label = codes.length > 1 ? `第 ${i + 1} 個分享碼` : '分享碼';
    const [prefix, payload, check, ...rest] = code.split(SEPARATOR);
    if (prefix !== SHARE_PREFIX || !payload || !check || rest.length) return { ok: false, error: `${label}格式不正確（應為 ${SHARE_PREFIX}.…）` };
    if (!/^[A-Za-z0-9_-]+$/.test(payload)) return { ok: false, error: `${label}含有不屬於分享碼的字元` };
    if (checkOf(payload) !== check) return { ok: false, error: `${label}不完整或被改過（檢查碼不符），請重新複製完整的代碼` };
    let data: unknown;
    try {
      const json = new TextDecoder().decode(await pipe(fromBase64Url(payload), new DecompressionStream('deflate-raw'), MAX_IMPORT_LENGTH));
      data = JSON.parse(json);
    } catch (error) {
      return { ok: false, error: `${label}無法解開${error instanceof Error && error.message === 'too large' ? '（內容過大）' : ''}` };
    }
    const combos = (data as { format?: unknown; combos?: unknown } | null)?.format === COMBO_EXPORT_FORMAT ? (data as { combos?: unknown }).combos : null;
    if (!Array.isArray(combos) || combos.length !== 1) return { ok: false, error: `${label}的內容不是一條 Combo` };
    routes.push(combos[0]);
  }
  return { ok: true, routes };
}

/** The shared codes turned into the JSON text of a normal Combo export, ready for `prepareComboImport`. */
export async function shareCodesToImportJson(text: string): Promise<{ ok: true; json: string } | { ok: false; error: string }> {
  const decoded = await decodeShareCodes(text);
  if (!decoded.ok) return decoded;
  return { ok: true, json: JSON.stringify({ format: COMBO_EXPORT_FORMAT, exportedAt: new Date().toISOString(), combos: decoded.routes }) };
}
