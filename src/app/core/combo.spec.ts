import { deckFingerprint } from './deck';
import { COMBO_EXPORT_FORMAT, exportCombos, newCombo, newStep, prepareComboImport, renumber, validateCombo } from './combo';
import { ComboRoute } from './models';
import { markupProblem, sourceUrlProblem } from './schemas';

const KNOWN = new Set([32061192, 69272449, 68059897]);

function valid(overrides: Partial<ComboRoute> = {}): ComboRoute {
  const base = newCombo('2026-10-08T00:00:00.000Z', 'route-1');
  return {
    ...base,
    name: '單卡 Dormouse',
    conditions: { ...base.conditions, handAllOf: [{ anyOf: [32061192], count: 1 }] },
    steps: renumber([
      { ...newStep(1), id: 'step-a', title: '通常召喚 Maliss <P> Dormouse', description: '從手牌通常召喚。', actorCardIds: [32061192] },
      { ...newStep(2), id: 'step-b', title: '除外 Maliss <P> White Rabbit', description: '發動效果。', actorCardIds: [69272449] },
    ]),
    endBoard: [{ cardId: 68059897, zone: '額外怪獸區', count: 1 }],
    verification: { status: 'unverified' },
    ...overrides,
  };
}

const verified = (): ComboRoute =>
  valid({
    verification: {
      status: 'verified',
      verifiedAt: '2026-10-08',
      verifiedBy: '使用者',
      evidenceNote: '錄影 00:12–01:40',
      deckFingerprint: deckFingerprint({ main: [{ cardId: 1, count: 3 }], extra: [] }),
    },
  });

describe('validateCombo — G8 structure', () => {
  it('accepts a complete route; card names with <P> are fine as plain text', () => {
    expect(validateCombo(valid(), { knownCardIds: KNOWN })).toMatchObject({ ok: true, errors: [] });
  });

  it('N5: empty steps are rejected for non-draft routes and on import', () => {
    expect(validateCombo(valid({ steps: [] })).errors).toContain('步驟不可為空');
    expect(validateCombo(valid({ steps: [], verification: { status: 'draft' } })).ok).toBe(true); // work in progress
    expect(validateCombo(valid({ steps: [], verification: { status: 'draft' } }), { requireSteps: true }).errors).toContain('步驟不可為空');
  });

  it('N5: duplicate step IDs and broken order are rejected', () => {
    const r = valid();
    expect(validateCombo({ ...r, steps: [r.steps[0], { ...r.steps[1], id: 'step-a' }] }).errors).toContain('步驟 ID 重複');
    expect(validateCombo({ ...r, steps: [{ ...r.steps[0], order: 2 }, { ...r.steps[1], order: 1 }] }).errors).toContain('步驟順序必須是 1..N 且連續');
  });

  it('N5: missing required fields are rejected', () => {
    const r = valid();
    expect(validateCombo({ ...r, name: '  ' }).errors.join()).toContain('name：必填');
    expect(validateCombo({ ...r, steps: [{ ...r.steps[0], title: '' }, r.steps[1]] }).errors.join()).toContain('steps.0.title：必填');
    const { archetype: _drop, ...noArchetype } = r;
    expect(validateCombo(noArchetype).ok).toBe(false);
    expect(validateCombo(valid({ endBoard: [] })).errors).toContain('非草稿路線需要填寫預計終場');
  });

  it('N5: references to unknown cards are rejected', () => {
    const r = valid({ endBoard: [{ cardId: 12345, zone: 'EMZ', count: 1 }] });
    expect(validateCombo(r, { knownCardIds: KNOWN }).errors).toEqual(['引用未知卡片（ID：12345），請先下載卡片資料或修正 ID']);
  });

  it('N5: malicious or non-whitelisted source URLs are rejected', () => {
    for (const url of ['javascript:alert(1)', 'http://www.youtube.com/watch?v=x', 'https://evil.example.com/v', 'data:text/html,<b>x</b>', 'not a url']) {
      expect(validateCombo(valid({ source: { url } })).ok).toBe(false);
    }
    expect(validateCombo(valid({ source: { url: 'https://www.youtube.com/watch?v=abc', timeSeconds: 75, title: '教學' } })).ok).toBe(true);
    expect(sourceUrlProblem('https://youtu.be/abc')).toBeNull();
  });

  it('rejects scripts, HTML and unknown executable fields', () => {
    expect(markupProblem('Maliss <P> Dormouse')).toBeNull();
    expect(markupProblem('<script>alert(1)</script>')).toBe('不可包含 HTML 標籤');
    expect(markupProblem('<img src=x onerror=alert(1)>')).toBe('不可包含 HTML 標籤');
    expect(markupProblem('<b onclick="x">')).toBe('不可包含 HTML 標籤');
    expect(markupProblem('click onmouseover=steal()')).toBe('不可包含可執行的程式碼');
    expect(markupProblem('see javascript:void(0)')).toBe('不可包含可執行的程式碼');
    const r = valid();
    expect(validateCombo({ ...r, steps: [{ ...r.steps[0], description: '<iframe src="x"></iframe>' }, r.steps[1]] }).ok).toBe(false);
    expect(validateCombo({ ...r, script: 'alert(1)' }).ok).toBe(false);
    expect(validateCombo({ ...r, steps: [{ ...r.steps[0], onload: 'x' }, r.steps[1]] }).ok).toBe(false);
  });

  it('rejects an unknown schemaVersion', () => {
    expect(validateCombo({ ...valid(), schemaVersion: 2 }).ok).toBe(false);
  });
});

describe('validateCombo — G8 verification status', () => {
  it('"verified" requires date, verifier, evidence, deck fingerprint and steps', () => {
    expect(validateCombo(verified()).ok).toBe(true);
    const errors = validateCombo(valid({ verification: { status: 'verified' } })).errors;
    expect(errors).toEqual(expect.arrayContaining(['已驗證需要實測日期（YYYY-MM-DD）', '已驗證需要驗證者', '已驗證需要驗證證據說明（例如影片或截圖位置）', '已驗證需要實測所用牌表識別碼']));
    expect(validateCombo({ ...verified(), steps: [] }).errors).toContain('沒有步驟的路線不能設為已驗證');
    expect(validateCombo({ ...verified(), verification: { ...verified().verification, verifiedAt: '昨天' } }).ok).toBe(false);
  });

  it('draft, unverified and invalidated need no evidence', () => {
    for (const status of ['unverified', 'invalidated'] as const) expect(validateCombo(valid({ verification: { status } })).ok).toBe(true);
  });
});

describe('prepareComboImport — G8 / N6', () => {
  const opts = { knownCardIds: KNOWN, existingIds: new Set(['route-1']) };

  it('round-trips an export, flags ID conflicts and never imports as verified', () => {
    const result = prepareComboImport(exportCombos([verified(), { ...valid(), id: 'route-2' }]), opts);
    if (!result.ok) throw new Error(result.errors.join());
    expect(result.items.map((i) => [i.route.id, i.conflict, i.route.verification.status])).toEqual([
      ['route-1', true, 'unverified'],
      ['route-2', false, 'unverified'],
    ]);
    expect(result.items[0].notes[0]).toContain('需在本機重新實測');
    expect(result.items[0].route.verification.evidenceNote).toContain('錄影 00:12–01:40');
    expect(JSON.parse(exportCombos([valid()])).format).toBe(COMBO_EXPORT_FORMAT);
  });

  it('accepts a single route object or a plain array', () => {
    expect(prepareComboImport(JSON.stringify(valid()), opts).ok).toBe(true);
    expect(prepareComboImport(JSON.stringify([valid()]), opts).ok).toBe(true);
  });

  it('rejects the whole file when any route is invalid (nothing partial)', () => {
    const result = prepareComboImport(JSON.stringify([valid(), { ...valid(), id: 'bad', steps: [] }]), opts);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual(['第 2 條「單卡 Dormouse」：步驟不可為空']);
  });

  it('rejects invalid JSON, empty files, duplicate IDs within the file and oversize input', () => {
    expect(prepareComboImport('{oops', opts)).toEqual({ ok: false, errors: ['不是有效的 JSON'] });
    expect(prepareComboImport('[]', opts)).toEqual({ ok: false, errors: ['檔案中沒有任何 Combo'] });
    expect(prepareComboImport(JSON.stringify([valid(), valid()]), opts).ok).toBe(false);
    expect(prepareComboImport(' '.repeat(2 * 1024 * 1024 + 1), opts).ok).toBe(false);
  });
});
