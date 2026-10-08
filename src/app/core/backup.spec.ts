import { TestBed } from '@angular/core/testing';
import { BACKUP_FORMAT, UserData, buildBackup, parseBackup, planRestore } from './backup';
import { newCombo, newStep } from './combo';
import { DB_NAME, openAppDb } from './db';
import { newDeck } from './deck';
import { DeckRecord } from './models';
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
    verification: {
      status: 'verified' as const,
      verifiedAt: '2026-10-08',
      verifiedBy: '使用者',
      evidenceNote: '錄影',
      deckFingerprint: 'fp1-0123456789abcd',
    },
  };
  const layout = { schemaVersion: 1 as const, id: 'layout-1', name: '1080p', handSize: 5 as const, aspectRatio: 16 / 9, regions: [{ x: 0.2, y: 0.7, w: 0.1, h: 0.2 }], createdAt: NOW };
  return { decks: [deck], combos: [combo], layouts: [layout] };
}

describe('backup — G9', () => {
  it('builds a backup with user data only and parses it back unchanged (verified kept: it is the user\'s own data)', () => {
    const data = sample();
    const file = buildBackup(data, NOW);
    expect(Object.keys(file).sort()).toEqual(['backupVersion', 'combos', 'decks', 'exportedAt', 'format', 'layouts']);
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed).toEqual({ ok: true, data, exportedAt: NOW });
  });

  it('rejects foreign files, unknown versions and invalid records without partial results', () => {
    expect(parseBackup('nope')).toEqual({ ok: false, errors: ['不是有效的 JSON 備份檔'] });
    expect(parseBackup(JSON.stringify({ format: 'other' }))).toEqual({ ok: false, errors: ['不是本工具的備份檔'] });
    expect(parseBackup(JSON.stringify({ ...buildBackup(sample()), backupVersion: 2 })).ok).toBe(false);
    const bad = buildBackup(sample());
    bad.decks[0] = { ...bad.decks[0], name: '<script>x</script>' };
    const result = parseBackup(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('牌組 1：name');
  });

  it('plans a restore: unchanged, skip, overwrite and keep-both with renaming of duplicate names', () => {
    const backup = sample();
    const existing = sample();
    expect(planRestore(backup, existing, 'skip')).toMatchObject({ unchanged: 3, added: 0, writes: { decks: [], combos: [], layouts: [] } });

    existing.decks[0] = { ...existing.decks[0], version: 5 };
    expect(planRestore(backup, existing, 'skip')).toMatchObject({ skipped: 1, unchanged: 2 });
    expect(planRestore(backup, existing, 'overwrite').writes.decks).toEqual(backup.decks);

    const both = planRestore(backup, existing, 'keep-both');
    expect(both.copied).toBe(1);
    expect(both.writes.decks[0].id).not.toBe('deck-1');
    expect(both.writes.decks[0].name).toBe('我的碼莉絲（還原）');
    expect(both.renamed).toEqual(['我的碼莉絲 → 我的碼莉絲（還原）']);
  });

  it('renames a restored record whose name is already used by a different record', () => {
    const backup = sample();
    const existing: UserData = { decks: [{ ...backup.decks[0], id: 'other-deck' }], combos: [], layouts: [] };
    const plan = planRestore(backup, existing, 'skip');
    expect(plan.added).toBe(3);
    expect(plan.writes.decks[0]).toMatchObject({ id: 'deck-1', name: '我的碼莉絲（還原）' });
  });
});

describe('UserDataService — atomic writes (N6)', () => {
  it('writes everything in one transaction', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: DB_NAME, useValue: `ud-${crypto.randomUUID()}` }] });
    const service = TestBed.inject(UserDataService);
    await service.write(sample());
    expect(await service.readAll()).toEqual(sample());
  });

  it('a failure in the middle leaves no half-written data', async () => {
    const name = `ud-${crypto.randomUUID()}`;
    TestBed.configureTestingModule({ providers: [{ provide: DB_NAME, useValue: name }] });
    const service = TestBed.inject(UserDataService);
    const data = sample();
    const broken = { ...data, combos: [...data.combos, { name: 'no key path' } as never] };
    await expect(service.write(broken)).rejects.toBeTruthy();
    const db = await openAppDb(name);
    expect(await db.count('decks')).toBe(0);
    expect(await db.count('combos')).toBe(0);
    expect(await db.count('layouts')).toBe(0);
    db.close();
    expect(BACKUP_FORMAT).toBe('ygo-combo-assistant/backup');
  });
});

describe('backup card notes — CR-002', () => {
  it('round-trips the user\'s card notes and still reads backups without them', () => {
    const notes = [{ cardId: 32061192, nameZhTw: '睡鼠', aliases: ['鼠'], mdBan: 'Limited' as const }];
    const parsed = parseBackup(JSON.stringify(buildBackup(sample(), NOW, notes)));
    expect(parsed).toMatchObject({ ok: true, cardNotes: notes });
    const old = parseBackup(JSON.stringify(buildBackup(sample(), NOW)));
    expect(old.ok && 'cardNotes' in old).toBe(false);
  });

  it('rejects invalid notes without partial results', () => {
    const bad = { ...buildBackup(sample(), NOW), cardNotes: [{ cardId: -1 }, { cardId: 5, mdBan: 'Banned' }, { cardId: 6, nameZhTw: '<script>x</script>' }] };
    const result = parseBackup(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(3);
  });
});
