// CR-010 (decisions D6, D7, D8): backup settings without secrets, a restore that is provably consistent,
// and the automatic backup rules (once a day, only when changed, newest 10, verified after writing).
import { TestBed } from '@angular/core/testing';
import { AiAnalysisService, DEFAULT_AI_SETTINGS } from './ai/analysis.service';
import { AUTO_BACKUP_KEEP, AutoBackupService, BACKUP_FILE, BACKUP_SINK, BackupSink, backupFileName } from './auto-backup.service';
import { UserData, buildBackup, parseBackup, planRestore } from './backup';
import { findSecretLike, parseBackupSettings, snapshotSettings } from './backup-settings';
import { BackupService } from './backup.service';
import { CardDataService } from './card-data.service';
import { newCombo, newStep } from './combo';
import { DB_NAME } from './db';
import { newDeck } from './deck';
import { DeckRecord } from './models';
import { SettingsService } from './settings.service';
import { UserDataService } from './user-data.service';

const NOW = '2026-10-08T00:00:00.000Z';

function sample(): UserData {
  const deck: DeckRecord = { ...newDeck('我的碼莉絲', NOW, 'deck-1'), main: [{ cardId: 32061192, count: 3 }] };
  const combo = {
    ...newCombo(NOW, 'combo-1'),
    name: '路線一',
    conditions: { ...newCombo().conditions, handAllOf: [{ anyOf: [32061192], count: 1 }] },
    steps: [{ ...newStep(1), id: 'step-1', title: '召喚', description: '說明' }],
    endBoard: [{ cardId: 68059897, zone: 'EMZ', count: 1 }],
  };
  const layout = { schemaVersion: 1 as const, id: 'layout-1', name: '1080p', handSize: 5 as const, aspectRatio: 16 / 9, regions: [{ x: 0.2, y: 0.7, w: 0.1, h: 0.2 }], createdAt: NOW };
  return { decks: [deck], combos: [combo], layouts: [layout] };
}

/** An in-memory folder that behaves like the desktop one. */
function memorySink(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial));
  const sink: BackupSink & { files: Map<string, string>; failWrite: boolean; corruptOnWrite: boolean } = {
    files,
    failWrite: false,
    corruptOnWrite: false,
    directory: async () => 'C:\\Users\\test\\Documents\\YGO Combo 助手\\backups',
    list: async () => [...files.keys()],
    read: async (name) => {
      const text = files.get(name);
      if (text === undefined) throw new Error(`missing ${name}`);
      return text;
    },
    write: async (name, text) => {
      if (sink.failWrite) throw new Error('disk full');
      files.set(name, sink.corruptOnWrite ? text.slice(0, text.length / 2) : text);
    },
    remove: async (name) => void files.delete(name),
  };
  return sink;
}

function setup(sink: BackupSink | null = null) {
  TestBed.configureTestingModule({ providers: [{ provide: DB_NAME, useValue: `bd-${crypto.randomUUID()}` }, { provide: BACKUP_SINK, useValue: sink }] });
  return {
    userData: TestBed.inject(UserDataService),
    backups: TestBed.inject(BackupService),
    auto: TestBed.inject(AutoBackupService),
    ai: TestBed.inject(AiAnalysisService),
    app: TestBed.inject(SettingsService),
    cards: TestBed.inject(CardDataService),
  };
}

describe('D7 backup settings carry no secrets', () => {
  it('round-trips the non-secret settings and still reads backups without them', () => {
    const settings = snapshotSettings({ cardPool: 'all', autoThumbnails: false, cardLanguage: 'both' }, { ...DEFAULT_AI_SETTINGS, provider: 'ollama', ollamaModel: 'qwen3:8b' });
    const parsed = parseBackup(JSON.stringify(buildBackup(sample(), NOW, [], settings)));
    expect(parsed).toMatchObject({ ok: true, settings });
    const old = parseBackup(JSON.stringify(buildBackup(sample(), NOW)));
    expect(old.ok && 'settings' in old).toBe(false);
  });

  it('a snapshot of the real settings contains no credential-looking name or value', () => {
    const settings = snapshotSettings({ cardPool: 'master-duel', autoThumbnails: true, cardLanguage: 'zh-TW' }, DEFAULT_AI_SETTINGS);
    expect(findSecretLike(settings)).toEqual([]);
    const text = JSON.stringify(settings);
    for (const needle of ['apiKey', 'api-key', 'sk-', 'refresh_token', 'access_token', 'Bearer']) expect(text).not.toContain(needle);
  });

  it('budgets named like tokens (maxOutputTokens, tokenBudget) are not mistaken for credentials', () => {
    expect(findSecretLike({ maxOutputTokens: 32000, staged: { tokenBudget: 100000 } })).toEqual([]);
  });

  it('drops unknown fields instead of carrying them along', () => {
    const r = parseBackupSettings({ app: { cardPool: 'master-duel', autoThumbnails: true, cardLanguage: 'zh-TW', extra: 'x' }, ai: { ...DEFAULT_AI_SETTINGS, surprise: 1 } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.settings.app).sort()).toEqual(['autoThumbnails', 'cardLanguage', 'cardPool']);
      expect(Object.keys(r.settings.ai).sort()).toEqual(Object.keys(DEFAULT_AI_SETTINGS).sort());
    }
  });

  it('rejects the whole file when settings carry a key, a token, or a secret-looking value', () => {
    const ok = { app: { cardPool: 'master-duel', autoThumbnails: true, cardLanguage: 'zh-TW' }, ai: { ...DEFAULT_AI_SETTINGS } };
    for (const tampered of [
      { ...ok, ai: { ...ok.ai, apiKey: 'x' } },
      { ...ok, ai: { ...ok.ai, refresh_token: 'x' } },
      { ...ok, ai: { ...ok.ai, ollamaModel: 'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUV' } },
      { ...ok, app: { ...ok.app, note: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig' } },
    ]) {
      expect(parseBackupSettings(tampered).ok).toBe(false);
      const file = { ...buildBackup(sample(), NOW), settings: tampered };
      const result = parseBackup(JSON.stringify(file));
      expect(result.ok).toBe(false);
    }
  });
});

describe('D8 restore consistency (export → clear → import → export)', () => {
  it('the second export equals the first, field by field, except for the export time', async () => {
    const a = setup();
    await a.userData.write(sample());
    await a.app.update({ cardLanguage: 'both', autoThumbnails: false });
    await a.ai.updateSettings({ provider: 'ollama', ollamaModel: 'qwen3:8b', dailyRequestLimit: 7 });
    const first = await a.backups.snapshot('2026-10-11T00:00:00.000Z');
    expect(first.settings?.ai.provider).toBe('ollama'); // non-default values really are in the backup
    expect(first.settings?.app.cardLanguage).toBe('both');
    const text = JSON.stringify(first);

    // A completely new database: nothing from the first one is left.
    TestBed.resetTestingModule();
    const b = setup();
    expect(await b.userData.readAll()).toEqual({ decks: [], combos: [], layouts: [] });
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.errors.join(';'));
    const plan = planRestore(parsed.data, await b.userData.readAll(), 'skip');
    await b.userData.write(plan.writes);
    await b.app.update(parsed.settings!.app);
    await b.ai.updateSettings(parsed.settings!.ai);

    const second = await b.backups.snapshot('2026-10-11T00:00:00.000Z');
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(text);
  });

  it('a truncated or tampered file is rejected as a whole', async () => {
    const a = setup();
    await a.userData.write(sample());
    const good = JSON.stringify(await a.backups.snapshot(NOW));
    expect(parseBackup(good).ok).toBe(true);
    const tampered = [
      good.slice(0, good.length - 40), // cut off
      good.replace('"id": "deck-1"', '"id": ""').replace('"id":"deck-1"', '"id":""'), // empty identifier
      good.replace('"format"', '"fmt"'), // not our file
      good.replace('"backupVersion":1', '"backupVersion":99'),
    ];
    for (const bad of tampered) {
      expect(bad).not.toBe(good);
      expect(parseBackup(bad).ok).toBe(false);
    }
  });
});

describe('D6 automatic backup', () => {
  const day = (d: number, h = 10) => new Date(2026, 9, d, h, 30, 0);

  it('does nothing in the browser (no sink)', async () => {
    const { auto } = setup(null);
    expect(auto.enabled).toBe(false);
    expect(await auto.run()).toEqual({ status: 'skipped', reason: 'disabled' });
  });

  it('writes nothing for an empty database', async () => {
    const sink = memorySink();
    const { auto } = setup(sink);
    expect(await auto.run({ now: day(1) })).toEqual({ status: 'skipped', reason: 'no-data' });
    expect(sink.files.size).toBe(0);
  });

  it('creates one backup, verifies it by reading it back, and it restores to the same data', async () => {
    const sink = memorySink();
    const { auto, userData } = setup(sink);
    await userData.write(sample());
    const result = await auto.run({ now: day(1) });
    expect(result).toMatchObject({ status: 'created', file: backupFileName(day(1)), removed: [] });
    expect(BACKUP_FILE.test((result as { file: string }).file)).toBe(true);
    const parsed = parseBackup(sink.files.get(backupFileName(day(1)))!);
    expect(parsed).toMatchObject({ ok: true, data: sample() });
    expect(auto.entries().map((e) => e.at)).toEqual(['2026-10-01 10:30:00']);
    expect(auto.directory()).toContain('YGO Combo');
  });

  it('only when the data changed, and at most one per day', async () => {
    const sink = memorySink();
    const { auto, userData } = setup(sink);
    await userData.write(sample());
    expect((await auto.run({ now: day(1, 9) })).status).toBe('created');
    // Same data, same day and later days: nothing changed → nothing new.
    expect(await auto.run({ now: day(1, 20) })).toEqual({ status: 'skipped', reason: 'unchanged' });
    expect(await auto.run({ now: day(2) })).toEqual({ status: 'skipped', reason: 'unchanged' });
    // Changed data, but a backup already exists for today → wait for tomorrow.
    const data = sample();
    await userData.write({ ...data, decks: [{ ...data.decks[0], name: '改名了' }] });
    expect(await auto.run({ now: day(2, 11) })).toMatchObject({ status: 'created' });
    await userData.write({ ...data, decks: [{ ...data.decks[0], name: '又改名' }] });
    expect(await auto.run({ now: day(2, 22) })).toEqual({ status: 'skipped', reason: 'already-today' });
    expect((await auto.run({ now: day(3) })).status).toBe('created');
    expect(sink.files.size).toBe(3);
  });

  it('"back up now" ignores the daily rule and the unchanged check', async () => {
    const sink = memorySink();
    const { auto, userData } = setup(sink);
    await userData.write(sample());
    await auto.run({ now: day(1, 9) });
    expect((await auto.run({ now: day(1, 9), force: true })).status).toBe('created');
    expect(sink.files.size).toBe(1); // same second → same name, replaced rather than duplicated
    expect((await auto.run({ now: new Date(2026, 9, 1, 9, 31, 0), force: true })).status).toBe('created');
    expect(sink.files.size).toBe(2);
  });

  it('keeps only the newest 10 and never touches other files', async () => {
    const stranger = { 'my-notes.txt': 'hello', 'ygo-backup-notes.json': '{}', 'other.json': '{}' };
    const sink = memorySink(stranger);
    const { auto, userData } = setup(sink);
    await userData.write(sample());
    for (let i = 1; i <= 13; i++) {
      const d = sample();
      await userData.write({ ...d, decks: [{ ...d.decks[0], name: `版本 ${i}` }] });
      await auto.run({ now: day(i) });
    }
    const mine = [...sink.files.keys()].filter((n) => BACKUP_FILE.test(n)).sort();
    expect(mine).toHaveLength(AUTO_BACKUP_KEEP);
    expect(mine[0]).toBe(backupFileName(day(4)));
    expect(mine[9]).toBe(backupFileName(day(13)));
    for (const name of Object.keys(stranger)) expect(sink.files.has(name)).toBe(true);
  });

  it('a failed write is reported, keeps the previous backups, and is retried the next time', async () => {
    const sink = memorySink();
    const { auto, userData } = setup(sink);
    await userData.write(sample());
    await auto.run({ now: day(1) });
    const d = sample();
    await userData.write({ ...d, decks: [{ ...d.decks[0], name: '新內容' }] });
    sink.failWrite = true;
    expect(await auto.run({ now: day(2) })).toEqual({ status: 'failed', error: 'disk full' });
    expect(auto.lastError()).toBe('disk full');
    expect(sink.files.size).toBe(1);
    sink.failWrite = false;
    expect((await auto.run({ now: day(2, 12) })).status).toBe('created');
    expect(auto.lastError()).toBe('');
  });

  it('a backup that cannot be read back is deleted and reported, not kept as if it were good', async () => {
    const sink = memorySink();
    const { auto, userData } = setup(sink);
    await userData.write(sample());
    sink.corruptOnWrite = true;
    const result = await auto.run({ now: day(1) });
    expect(result.status).toBe('failed');
    expect(sink.files.size).toBe(0);
  });

  it('refuses to read anything that is not one of its own file names (no path escape)', async () => {
    const sink = memorySink({ 'secret.txt': 'x' });
    const { auto } = setup(sink);
    for (const name of ['secret.txt', '..\\..\\Windows\\win.ini', 'ygo-backup-20261001-103000.json\\..\\x']) await expect(auto.read(name)).rejects.toThrow('備份檔名稱');
  });
});
