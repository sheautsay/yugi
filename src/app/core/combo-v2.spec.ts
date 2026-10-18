import { SAMPLE_COMBOS_JSON, SAMPLE_DECK_YDKE } from './sample/maliss-sample.data';
import { oneDrawPlan, twoDrawPlan, st, plan, branch, C, HAND } from '../../testing/ftk/banquet-plans.sample';
import { banquetCards } from '../../testing/ftk/banquet-deck.sample';
import { BACKUP_VERSION, BACKUP_VERSION_V2, buildBackup, parseBackup } from './backup';
import { COMBO_EXPORT_FORMAT, comboCardIds, exportCombos, prepareComboImport, validateCombo } from './combo';
import { ComboRoute } from './models';
import { allSteps } from './route-tree';
import { parseDeckText } from './deck-import';
import { newDeck } from './deck';
import { testComboV1 } from '../../testing/ftk/v1-route.sample';

// B7 changes the route format: schemaVersion 2 may have random steps, branches and `ftk`. Everything written before
// (schemaVersion 1) must still import, restore and be checked exactly as before.
const known = new Set(banquetCards().keys());

describe('route format version 2 (B7)', () => {
  it('a version 2 plan with branches validates, round-trips through export / import, and keeps its branches', () => {
    const route = twoDrawPlan();
    expect(validateCombo(route, { knownCardIds: known }).errors).toEqual([]);
    const prepared = prepareComboImport(exportCombos([route]), { knownCardIds: known, existingIds: new Set() });
    if (!prepared.ok) throw new Error(prepared.errors.join());
    expect(prepared.items[0].route).toEqual(route);
    expect(allSteps(prepared.items[0].route.steps).length).toBe(allSteps(route.steps).length);
  });

  it('references inside branches count: the branch condition cards and the branch steps are card references', () => {
    const ids = comboCardIds(oneDrawPlan());
    expect(ids).toContain(C.contract);
    const withUnknown = validateCombo(oneDrawPlan(), { knownCardIds: new Set([...known].filter((id) => id !== C.contract)) });
    expect(withUnknown.ok).toBe(false);
    expect(withUnknown.errors.join()).toContain('引用未知卡片');
  });

  it('a version 1 route cannot use random steps, branches or the FTK block', () => {
    const asV1: ComboRoute = { ...oneDrawPlan(), schemaVersion: 1 };
    const r = validateCombo(asV1);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain('schemaVersion 2');
  });

  it('structure rules: a branching step is a random step and the last of its list, with exactly one "otherwise" at the end', () => {
    const bad = (mutate: (r: ComboRoute) => void) => {
      const r = oneDrawPlan();
      mutate(r);
      return validateCombo(r).errors.join('\n');
    };
    expect(bad((r) => (r.steps[1].branches = r.steps[1].branches!.slice(0, 1)))).toContain('缺少「否則」');
    expect(bad((r) => r.steps[1].branches!.reverse())).toContain('「否則」分支必須放在最後');
    expect(bad((r) => r.steps[1].branches!.push(branch('又一個否則', null, [])))).toContain('只能有一個「否則」');
    expect(bad((r) => delete r.steps[1].random)).toContain('需要填寫張數');
    expect(bad((r) => (r.steps[1].actionType = 'activate'))).toContain('動作類型不是抽牌');
    expect(bad((r) => r.steps.push({ ...st('activate', '多出來', [C.chicken]), order: 3 }))).toContain('必須是該段的最後一個步驟');
    expect(bad((r) => (r.steps[1].branches![1].id = r.steps[1].branches![0].id))).toContain('分支 ID 重複');
    expect(bad((r) => (r.steps[1].branches![0].steps[0].order = 5))).toContain('步驟順序必須是 1..N');
  });

  it('a deck marked as an FTK deck validates, and a deck without the mark (every older deck) still does', () => {
    const parsed = parseBackup(JSON.stringify(buildBackup({ decks: [{ ...newDeck('舊牌組'), main: [], extra: [] }, { ...newDeck('FTK'), ftk: true }], combos: [], layouts: [] })));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.decks.map((d) => d.ftk)).toEqual([undefined, true]);
  });
});

describe('older data still works (B7)', () => {
  it('the sample routes bundled in P1 (written before version 2) import unchanged', () => {
    const parsed = parseDeckText(SAMPLE_DECK_YDKE);
    expect(parsed.result.ok).toBe(true);
    const prepared = prepareComboImport(SAMPLE_COMBOS_JSON, { knownCardIds: new Set(JSON.parse(SAMPLE_COMBOS_JSON).combos.flatMap((c: ComboRoute) => comboCardIds(c))), existingIds: new Set() });
    if (!prepared.ok) throw new Error(prepared.errors.join());
    expect(prepared.items).toHaveLength(3);
    expect(prepared.items.every((i) => i.route.schemaVersion === 1 && i.route.verification.status === 'unverified')).toBe(true);
  });

  it('a Combo JSON file written by an earlier version (schemaVersion 1, no new fields) imports as before', () => {
    const v1 = testComboV1();
    const json = JSON.stringify({ format: COMBO_EXPORT_FORMAT, exportedAt: '2026-10-09T00:00:00.000Z', combos: [v1] });
    const prepared = prepareComboImport(json, { knownCardIds: new Set(comboCardIds(v1)), existingIds: new Set() });
    if (!prepared.ok) throw new Error(prepared.errors.join());
    expect(prepared.items[0].route).toEqual(v1);
    expect(prepared.items[0].route.schemaVersion).toBe(1);
  });

  it('a backup file from before (backupVersion 1, version 1 routes) restores, and a new backup says version 2 only when it has a plan', () => {
    const v1 = testComboV1();
    const old = JSON.stringify({ format: 'ygo-combo-assistant/backup', backupVersion: 1, exportedAt: '2026-10-09T00:00:00.000Z', decks: [], combos: [v1], layouts: [] });
    const parsed = parseBackup(old);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.combos).toEqual([v1]);

    expect(buildBackup({ decks: [], combos: [v1], layouts: [] }).backupVersion).toBe(BACKUP_VERSION);
    const withPlan = buildBackup({ decks: [], combos: [v1, oneDrawPlan()], layouts: [] });
    expect(withPlan.backupVersion).toBe(BACKUP_VERSION_V2);
    const back = parseBackup(JSON.stringify(withPlan));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.data.combos).toEqual(withPlan.combos);
    expect(parseBackup(JSON.stringify({ ...withPlan, backupVersion: 3 })).ok).toBe(false);
  });

  it('a plain version 2 route without branches or ftk is allowed too, and a version 1 route with a draw step is refused', () => {
    const plain = { ...plan('plain', HAND, [st('activate', '發動 Chicken Game', [C.chicken])], { schemaVersion: 2 }), endBoard: [{ cardId: C.chicken, zone: '場上', count: 1 }] };
    expect(validateCombo(plain).errors).toEqual([]);
    const draw = plan('draw', HAND, [st('draw', '抽牌', [C.chicken], { random: { count: 1, to: 'hand' } })], { schemaVersion: 1 });
    expect(validateCombo(draw).errors.join()).toContain('schemaVersion 2');
  });
});
