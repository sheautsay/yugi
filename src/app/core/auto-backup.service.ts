import { Injectable, InjectionToken, Injector, inject, signal } from '@angular/core';
import { AppDb } from './db';
import { localDate, localDateTime } from './time';

/**
 * Where automatic backups are written (CR-010, decisions D6/D7). The browser build has none; the desktop build
 * provides a folder under the user's Documents folder obtained from Windows. Implementations must write a file
 * atomically (write a temporary name, then rename) so a crash never leaves a half-written backup.
 */
export interface BackupSink {
  directory(): Promise<string>;
  list(): Promise<string[]>;
  read(name: string): Promise<string>;
  write(name: string, text: string): Promise<void>;
  remove(name: string): Promise<void>;
}

export const BACKUP_SINK = new InjectionToken<BackupSink | null>('BACKUP_SINK', { providedIn: 'root', factory: () => null });

/** Newest 10 files are kept (decision D6). */
export const AUTO_BACKUP_KEEP = 10;
export const BACKUP_FILE = /^ygo-backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json$/;
const META_KEY = 'autoBackup';

interface AutoBackupMeta {
  lastDay: string;
  lastHash: string;
  lastFile: string;
  lastAt: string;
}

export type AutoBackupResult =
  | { status: 'created'; file: string; removed: string[] }
  | { status: 'skipped'; reason: 'disabled' | 'no-data' | 'unchanged' | 'already-today' }
  | { status: 'failed'; error: string };

export interface BackupEntry {
  name: string;
  /** Local "YYYY-MM-DD HH:mm:ss" taken from the file name. */
  at: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function backupFileName(now: Date): string {
  return `ygo-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
}

async function contentHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

@Injectable({ providedIn: 'root' })
export class AutoBackupService {
  private readonly sink = inject(BACKUP_SINK);
  private readonly injector = inject(Injector);
  private readonly appDb = inject(AppDb);

  readonly enabled = this.sink !== null;
  readonly directory = signal('');
  readonly entries = signal<BackupEntry[]>([]);
  readonly lastAt = signal('');
  readonly lastError = signal('');

  private running: Promise<AutoBackupResult> | null = null;
  private timer?: ReturnType<typeof setInterval>;

  /** Starts the background schedule (desktop only): shortly after start, then every 30 minutes and when the window is hidden. */
  start(): void {
    if (!this.sink || this.timer) return;
    setTimeout(() => void this.run(), 5000);
    this.timer = setInterval(() => void this.run(), 30 * 60 * 1000);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void this.run();
      });
    }
  }

  /**
   * Creates a backup when the data changed and none was made today. `force` (the "back up now" button) skips the
   * once-a-day rule and the unchanged check; nothing is ever written for an empty database.
   */
  run(options: { force?: boolean; now?: Date } = {}): Promise<AutoBackupResult> {
    this.running ??= this.runOnce(options).finally(() => (this.running = null));
    return this.running;
  }

  async refresh(): Promise<void> {
    if (!this.sink) return;
    try {
      this.directory.set(await this.sink.directory());
      this.entries.set(await this.listEntries());
      const meta = await this.meta();
      this.lastAt.set(meta ? localDateTime(meta.lastAt) : '');
    } catch (error) {
      this.lastError.set(describe(error));
    }
  }

  async read(name: string): Promise<string> {
    if (!this.sink || !BACKUP_FILE.test(name)) throw new Error('不是本 App 的備份檔名稱');
    return this.sink.read(name);
  }

  private async runOnce({ force = false, now = new Date() }: { force?: boolean; now?: Date }): Promise<AutoBackupResult> {
    const sink = this.sink;
    if (!sink) return { status: 'skipped', reason: 'disabled' };
    try {
      // Loaded on demand: the app shell creates this service at start-up, and the backup code pulls in the whole AI
      // analysis module, which must stay out of the initial bundle (the build has a size budget).
      const [{ BackupService }, { parseBackup }] = await Promise.all([import('./backup.service'), import('./backup')]);
      const snapshot = await this.injector.get(BackupService).snapshot(now.toISOString());
      const empty = !snapshot.decks.length && !snapshot.combos.length && !snapshot.layouts.length && !snapshot.cardNotes?.length;
      if (empty) return { status: 'skipped', reason: 'no-data' };

      // Everything except the export time, so "did anything change" is an exact comparison.
      const { exportedAt: _exportedAt, ...content } = snapshot;
      const hash = await contentHash(JSON.stringify(content));
      const meta = await this.meta();
      if (!force) {
        if (meta?.lastHash === hash) return { status: 'skipped', reason: 'unchanged' };
        if (meta?.lastDay === localDate(now)) return { status: 'skipped', reason: 'already-today' };
      }

      const name = backupFileName(now);
      await sink.write(name, JSON.stringify(snapshot, null, 2));
      // Read it back: a backup that cannot be parsed again is worse than none.
      const check = parseBackup(await sink.read(name));
      if (!check.ok) {
        await sink.remove(name).catch(() => undefined);
        throw new Error(`寫入後驗證失敗：${check.errors[0] ?? '未知原因'}`);
      }
      const record: AutoBackupMeta = { lastDay: localDate(now), lastHash: hash, lastFile: name, lastAt: now.toISOString() };
      await (await this.appDb.db()).put('meta', { key: META_KEY, value: record });
      const removed = await this.prune(name);
      this.lastError.set('');
      await this.refresh();
      return { status: 'created', file: name, removed };
    } catch (error) {
      this.lastError.set(describe(error));
      return { status: 'failed', error: describe(error) };
    }
  }

  /** Deletes the oldest app-made backups beyond the newest {@link AUTO_BACKUP_KEEP}; other files are never touched. */
  private async prune(justWritten: string): Promise<string[]> {
    const names = (await this.sink!.list()).filter((n) => BACKUP_FILE.test(n)).sort().reverse();
    const removed: string[] = [];
    for (const name of names.slice(AUTO_BACKUP_KEEP)) {
      if (name === justWritten) continue;
      await this.sink!.remove(name);
      removed.push(name);
    }
    return removed;
  }

  private async listEntries(): Promise<BackupEntry[]> {
    return (await this.sink!.list())
      .map((name) => ({ name, m: BACKUP_FILE.exec(name) }))
      .filter((x): x is { name: string; m: RegExpExecArray } => x.m !== null)
      .sort((a, b) => b.name.localeCompare(a.name))
      .map(({ name, m }) => ({ name, at: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` }));
  }

  private async meta(): Promise<AutoBackupMeta | undefined> {
    return (await (await this.appDb.db()).get('meta', META_KEY))?.value as AutoBackupMeta | undefined;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
