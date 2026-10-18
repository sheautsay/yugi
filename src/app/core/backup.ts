import { BackupSettings, parseBackupSettings } from './backup-settings';
import type { CardNote } from './card-data.service';
import { validateCombo } from './combo';
import { ComboRoute, DeckRecord, HandLayoutPreset } from './models';
import { cardNoteSchema, deckSchema, issues, layoutSchema } from './schemas';

export const BACKUP_FORMAT = 'ygo-combo-assistant/backup';
export const BACKUP_VERSION = 1;
const MAX_BACKUP_LENGTH = 20 * 1024 * 1024;

export interface UserData {
  decks: DeckRecord[];
  combos: ComboRoute[];
  layouts: HandLayoutPreset[];
}

export interface BackupFile extends UserData {
  format: typeof BACKUP_FORMAT;
  backupVersion: number;
  exportedAt: string;
  /** Optional (CR-002): the user's own card names / aliases / Master Duel ban marks. */
  cardNotes?: CardNote[];
  /** Optional (CR-010): the non-secret settings. Never an API key, token or other credential. */
  settings?: BackupSettings;
}

/** Full user data without card images or the card cache (F11). */
export function buildBackup(data: UserData, now = new Date().toISOString(), cardNotes: CardNote[] = [], settings?: BackupSettings): BackupFile {
  return { format: BACKUP_FORMAT, backupVersion: BACKUP_VERSION, exportedAt: now, ...data, ...(cardNotes.length ? { cardNotes } : {}), ...(settings ? { settings } : {}) };
}

export function parseBackup(json: string): { ok: true; data: UserData; exportedAt: string; cardNotes?: CardNote[]; settings?: BackupSettings } | { ok: false; errors: string[] } {
  if (json.length > MAX_BACKUP_LENGTH) return { ok: false, errors: ['檔案過大（超過 20 MB）'] };
  let raw: Partial<BackupFile>;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['不是有效的 JSON 備份檔'] };
  }
  if (raw?.format !== BACKUP_FORMAT) return { ok: false, errors: ['不是本工具的備份檔'] };
  if (raw.backupVersion !== BACKUP_VERSION) return { ok: false, errors: [`不支援的備份版本 ${String(raw.backupVersion)}（目前支援版本 ${BACKUP_VERSION}）`] };
  if (!Array.isArray(raw.decks) || !Array.isArray(raw.combos) || !Array.isArray(raw.layouts)) return { ok: false, errors: ['備份檔缺少 decks／combos／layouts'] };

  const errors: string[] = [];
  const decks = raw.decks.flatMap((d, i) => {
    const r = deckSchema.safeParse(d);
    if (!r.success) errors.push(...issues(r.error).map((e) => `牌組 ${i + 1}：${e}`));
    return r.success ? [r.data as DeckRecord] : [];
  });
  const combos = raw.combos.flatMap((c, i) => {
    // Card data may not be downloaded yet on a fresh machine, so references are not checked here.
    const r = validateCombo(c);
    if (!r.ok) errors.push(...r.errors.map((e) => `Combo ${i + 1}：${e}`));
    return r.ok ? [r.route!] : [];
  });
  const layouts = raw.layouts.flatMap((l, i) => {
    const r = layoutSchema.safeParse(l);
    if (!r.success) errors.push(...issues(r.error).map((e) => `版型 ${i + 1}：${e}`));
    return r.success ? [r.data as HandLayoutPreset] : [];
  });
  if (raw.cardNotes !== undefined && !Array.isArray(raw.cardNotes)) errors.push('cardNotes 必須是陣列');
  const cardNotes = (Array.isArray(raw.cardNotes) ? raw.cardNotes : []).flatMap((n, i) => {
    const r = cardNoteSchema.safeParse(n);
    if (!r.success) errors.push(...issues(r.error).map((e) => `卡片標註 ${i + 1}：${e}`));
    return r.success ? [r.data as CardNote] : [];
  });
  let settings: BackupSettings | undefined;
  if (raw.settings !== undefined) {
    const r = parseBackupSettings(raw.settings);
    if (r.ok) settings = r.settings;
    else errors.push(...r.errors);
  }
  for (const [label, list] of [
    ['牌組', decks],
    ['Combo', combos],
    ['版型', layouts],
  ] as const) {
    const ids = list.map((x) => x.id);
    if (new Set(ids).size !== ids.length) errors.push(`${label}的 ID 在備份檔中重複`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, data: { decks, combos, layouts }, exportedAt: String(raw.exportedAt ?? ''), ...(cardNotes.length ? { cardNotes } : {}), ...(settings ? { settings } : {}) };
}

export type ConflictStrategy = 'skip' | 'overwrite' | 'keep-both';

export interface RestorePlan {
  writes: UserData;
  added: number;
  overwritten: number;
  copied: number;
  skipped: number;
  unchanged: number;
  renamed: string[];
}

const RESTORED_SUFFIX = '（還原）';

/** Decides what to write: same ID + same content is a no-op; ID conflicts follow `strategy`; duplicate names get a suffix. */
export function planRestore(incoming: UserData, existing: UserData, strategy: ConflictStrategy): RestorePlan {
  const plan: RestorePlan = { writes: { decks: [], combos: [], layouts: [] }, added: 0, overwritten: 0, copied: 0, skipped: 0, unchanged: 0, renamed: [] };

  const handle = <T extends { id: string; name: string }>(items: T[], current: T[], out: T[]) => {
    const byId = new Map(current.map((x) => [x.id, x]));
    const names = new Set(current.map((x) => x.name));
    for (const item of items) {
      const clash = byId.get(item.id);
      let next: T | null = structuredClone(item);
      if (clash) {
        if (JSON.stringify(clash) === JSON.stringify(item)) {
          plan.unchanged++;
          continue;
        }
        if (strategy === 'skip') next = null;
        else if (strategy === 'keep-both') next = { ...next, id: crypto.randomUUID() };
      }
      if (!next) {
        plan.skipped++;
        continue;
      }
      const replacing = clash && strategy === 'overwrite';
      if (!replacing && names.has(next.name)) {
        let name = `${next.name}${RESTORED_SUFFIX}`;
        while (names.has(name)) name += RESTORED_SUFFIX;
        plan.renamed.push(`${next.name} → ${name}`);
        next = { ...next, name };
      }
      names.add(next.name);
      if (replacing) plan.overwritten++;
      else if (clash) plan.copied++;
      else plan.added++;
      out.push(next);
    }
  };
  handle(incoming.decks, existing.decks, plan.writes.decks);
  handle(incoming.combos, existing.combos, plan.writes.combos);
  handle(incoming.layouts, existing.layouts, plan.writes.layouts);
  return plan;
}
