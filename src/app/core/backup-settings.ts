import type { AiSettings } from './ai/analysis.service';
import { DEFAULT_AI_SETTINGS, normalizeSettings } from './ai/analysis.service';
import { CARD_LANGUAGES, CardLanguage, DEFAULT_CARD_LANGUAGE } from './card-names';
import type { AppSettings } from './settings.service';

/**
 * CR-010 (decision D7): the non-secret settings that travel with a backup, so a reinstall or a move to another
 * machine does not mean setting everything up again. Secrets are structurally impossible here: only the fields
 * of `AppSettings` and `AiSettings` are copied (neither has a place for a key or token), and a file that
 * carries anything that looks like a credential is rejected as a whole.
 */
export interface BackupSettings {
  app: AppSettings;
  ai: AiSettings;
}

// Compared as a whole name (so budgets such as `maxOutputTokens` or `tokenBudget` are not mistaken for credentials).
const SECRET_NAMES = new Set(['apikey', 'token', 'accesstoken', 'refreshtoken', 'idtoken', 'authtoken', 'bearer', 'authorization', 'credential', 'credentials', 'clientid', 'authjson']);
const isSecretName = (name: string) => {
  const n = name.toLowerCase().replace(/[-_ ]/g, '');
  return SECRET_NAMES.has(n) || n.includes('secret') || n.includes('password') || n.includes('passwd');
};
const SECRET_VALUE = /\bsk-[A-Za-z0-9_-]{16,}|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./;

/** Names the backup must never carry, found anywhere in a value (objects, arrays, strings). */
export function findSecretLike(value: unknown, path = 'settings'): string[] {
  if (typeof value === 'string') return SECRET_VALUE.test(value) ? [`${path}（內容像金鑰或 Token）`] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findSecretLike(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [...(isSecretName(k) ? [`${path}.${k}（欄位名稱像金鑰或 Token）`] : []), ...findSecretLike(v, `${path}.${k}`)]);
  }
  return [];
}

export function snapshotSettings(app: AppSettings, ai: AiSettings): BackupSettings {
  return { app: sanitizeApp(app), ai: sanitizeAi(ai) };
}

function sanitizeApp(raw: Partial<AppSettings>): AppSettings {
  const cardLanguage = CARD_LANGUAGES.includes(raw.cardLanguage as CardLanguage) ? (raw.cardLanguage as CardLanguage) : DEFAULT_CARD_LANGUAGE;
  return {
    cardPool: raw.cardPool === 'all' ? 'all' : 'master-duel',
    autoThumbnails: typeof raw.autoThumbnails === 'boolean' ? raw.autoThumbnails : true,
    cardLanguage,
  };
}

/** Normalised, then reduced to exactly the known fields (normalizeSettings keeps unknown keys). */
function sanitizeAi(raw: Partial<AiSettings>): AiSettings {
  const normalized = normalizeSettings(raw) as unknown as Record<string, unknown>;
  return Object.fromEntries(Object.keys(DEFAULT_AI_SETTINGS).map((key) => [key, normalized[key]])) as unknown as AiSettings;
}

export function parseBackupSettings(raw: unknown): { ok: true; settings: BackupSettings } | { ok: false; errors: string[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['設定必須是物件'] };
  const secrets = findSecretLike(raw);
  if (secrets.length) return { ok: false, errors: [`備份檔的設定含有疑似機密的內容，整份拒絕：${secrets.slice(0, 3).join('、')}`] };
  const { app, ai } = raw as { app?: unknown; ai?: unknown };
  if (!app || typeof app !== 'object' || !ai || typeof ai !== 'object') return { ok: false, errors: ['設定缺少 app 或 ai'] };
  return { ok: true, settings: snapshotSettings(app as Partial<AppSettings> as AppSettings, ai as Partial<AiSettings> as AiSettings) };
}
