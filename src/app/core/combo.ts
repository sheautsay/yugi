import { conditionErrors } from './matcher';
import { ComboRoute, ComboStep } from './models';
import { comboSchema, issues } from './schemas';

export const COMBO_EXPORT_FORMAT = 'ygo-combo-assistant/combos';
export const MAX_IMPORT_LENGTH = 2 * 1024 * 1024;

export function newCombo(now = new Date().toISOString(), id: string = crypto.randomUUID()): ComboRoute {
  return {
    schemaVersion: 1,
    id,
    version: 1,
    name: '',
    archetype: 'Maliss',
    format: 'master-duel',
    conditions: {
      handAllOf: [{ anyOf: [], count: 1 }],
      setup: { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true },
    },
    steps: [],
    endBoard: [],
    verification: { status: 'draft' },
    createdAt: now,
    updatedAt: now,
  };
}

export function newStep(order: number): ComboStep {
  return { id: crypto.randomUUID(), order, actionType: 'other', actorCardIds: [], title: '', description: '' };
}

/** Steps keep their permanent IDs; `order` always follows array position 1..N. */
export function renumber(steps: readonly ComboStep[]): ComboStep[] {
  return steps.map((s, i) => ({ ...s, order: i + 1 }));
}

export function comboCardIds(route: ComboRoute): number[] {
  const c = route.conditions;
  return [
    ...new Set([
      ...c.handAllOf.flatMap((cl) => cl.anyOf),
      ...(c.mustRemainInMain ?? []).map((r) => r.cardId),
      ...(c.mustExistInExtra ?? []).map((r) => r.cardId),
      ...(c.forbiddenInHand ?? []),
      ...route.steps.flatMap((s) => [...s.actorCardIds, ...(s.targetCardIds ?? []), ...(s.materialCardIds ?? []), ...(s.moves ?? []).map((m) => m.cardId)]),
      ...route.endBoard.map((e) => e.cardId),
    ]),
  ];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  route?: ComboRoute;
}

/**
 * All rules a stored route must satisfy (G8). `knownCardIds` enables the reference check —
 * every card ID used anywhere in the route must exist in the local card data.
 */
export function validateCombo(input: unknown, options: { knownCardIds?: ReadonlySet<number>; requireSteps?: boolean } = {}): ValidationResult {
  const parsed = comboSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issues(parsed.error) };
  const route = parsed.data as ComboRoute;
  const errors = conditionErrors(route.conditions).filter((e) => !e.includes('前置情境'));

  const ids = route.steps.map((s) => s.id);
  if (new Set(ids).size !== ids.length) errors.push('步驟 ID 重複');
  if (route.steps.some((s, i) => s.order !== i + 1)) errors.push('步驟順序必須是 1..N 且連續');

  const status = route.verification.status;
  if ((status !== 'draft' || options.requireSteps) && route.steps.length === 0) errors.push('步驟不可為空');
  if (status !== 'draft' && route.endBoard.length === 0) errors.push('非草稿路線需要填寫預計終場');
  if (status === 'verified') errors.push(...verificationErrors(route));

  if (options.knownCardIds) {
    const unknown = comboCardIds(route).filter((id) => !options.knownCardIds!.has(id));
    if (unknown.length) errors.push(`引用未知卡片（ID：${unknown.join('、')}），請先下載卡片資料或修正 ID`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, errors: [], route };
}

/** F09: "verified" needs evidence, a test date, the deck fingerprint, the verifier and steps. */
export function verificationErrors(route: ComboRoute): string[] {
  const v = route.verification;
  const errors: string[] = [];
  if (route.steps.length === 0) errors.push('沒有步驟的路線不能設為已驗證');
  if (!v.verifiedAt || !/^\d{4}-\d{2}-\d{2}$/.test(v.verifiedAt) || Number.isNaN(Date.parse(v.verifiedAt))) errors.push('已驗證需要實測日期（YYYY-MM-DD）');
  if (!v.verifiedBy?.trim()) errors.push('已驗證需要驗證者');
  if (!v.evidenceNote?.trim()) errors.push('已驗證需要驗證證據說明（例如影片或截圖位置）');
  if (!v.deckFingerprint || !/^fp1-[0-9a-f]{14}$/.test(v.deckFingerprint)) errors.push('已驗證需要實測所用牌表的指紋');
  return errors;
}

/** True when what was verified (conditions, steps, end board) differs between two versions. */
export function routeContentChanged(a: ComboRoute, b: ComboRoute): boolean {
  const content = (r: ComboRoute) => JSON.stringify([r.conditions, r.steps, r.endBoard]);
  return content(a) !== content(b);
}

/** A copy is a new route: it starts as a draft, never inheriting the original's verification. */
export function copyCombo(route: ComboRoute, now = new Date().toISOString()): ComboRoute {
  return {
    ...structuredClone(route),
    id: crypto.randomUUID(),
    name: `${route.name}（複本）`.slice(0, 120),
    version: 1,
    verification: { status: 'draft' },
    createdAt: now,
    updatedAt: now,
  };
}

export function exportCombos(routes: readonly ComboRoute[], now = new Date().toISOString()): string {
  return JSON.stringify({ format: COMBO_EXPORT_FORMAT, exportedAt: now, combos: routes }, null, 2);
}

export interface ImportItem {
  route: ComboRoute;
  notes: string[];
  conflict: boolean;
}

/**
 * Validates a Combo JSON file completely before anything is written (N6). Imported routes never
 * arrive as "verified": verification must happen locally (F09), so they become "unverified".
 */
export function prepareComboImport(
  json: string,
  options: { knownCardIds: ReadonlySet<number>; existingIds: ReadonlySet<string> },
): { ok: true; items: ImportItem[] } | { ok: false; errors: string[] } {
  if (json.length > MAX_IMPORT_LENGTH) return { ok: false, errors: ['檔案過大（超過 2 MB）'] };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['不是有效的 JSON'] };
  }
  const list = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && (data as { format?: unknown }).format === COMBO_EXPORT_FORMAT
      ? (data as { combos?: unknown }).combos
      : [data];
  if (!Array.isArray(list) || list.length === 0) return { ok: false, errors: ['檔案中沒有任何 Combo'] };
  if (list.length > 500) return { ok: false, errors: ['一次最多匯入 500 條 Combo'] };

  const errors: string[] = [];
  const items: ImportItem[] = [];
  const seen = new Set<string>();
  list.forEach((raw, i) => {
    const label = `第 ${i + 1} 條${typeof (raw as { name?: unknown })?.name === 'string' ? `「${(raw as { name: string }).name.slice(0, 40)}」` : ''}`;
    const result = validateCombo(raw, { knownCardIds: options.knownCardIds, requireSteps: true });
    if (!result.ok) {
      errors.push(...result.errors.map((e) => `${label}：${e}`));
      return;
    }
    const route = result.route!;
    if (seen.has(route.id)) errors.push(`${label}：與檔案中其他路線的 ID 重複`);
    seen.add(route.id);
    const notes: string[] = [];
    if (route.verification.status === 'verified') {
      const v = route.verification;
      notes.push('原檔標示為已驗證，匯入後改為「未驗證」，需在本機重新實測確認');
      route.verification = {
        status: 'unverified',
        evidenceNote: `匯入前的驗證紀錄：${v.verifiedAt} 由 ${v.verifiedBy} 以牌表 ${v.deckFingerprint} 驗證；證據：${v.evidenceNote}`.slice(0, 2000),
      };
    }
    items.push({ route, notes, conflict: options.existingIds.has(route.id) });
  });
  return errors.length ? { ok: false, errors } : { ok: true, items };
}
