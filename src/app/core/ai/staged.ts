import { z } from 'zod';
import { countOf } from '../deck';
import { tally } from '../hand';
import { CardRecord, DeckRecord } from '../models';
import { AnalysisGoal, DEFAULT_GOAL } from './analysis-goal';
import { AnalysisScope, SYSTEM_PROMPT, cardLine, goalLines, namedCard } from './prompt';

// CR-008: the phased analysis of 1–3 card starters. Phase A (one request) labels the cards and
// proposes starter combinations; phase B (one request per accepted combination) writes the routes;
// phases C and D are local (checks, comparison). Everything here is pure: prompts, parsing, the
// local part of phase A, and the budget guard. The orchestration lives in AiAnalysisService.

export const STAGED_PROMPT_VERSION = 'deck-analysis-v3.1-staged';

/** Card roles are AI candidate labels — never rules-verified facts. */
export const CARD_ROLES = ['starter', 'extender', 'searcher', 'combo-piece', 'garnet', 'hand-trap', 'other'] as const;
export type CardRole = (typeof CARD_ROLES)[number];
export const ROLE_LABEL: Record<CardRole, string> = {
  starter: 'Starter',
  extender: 'Extender',
  searcher: 'Searcher',
  'combo-piece': 'Combo Piece',
  garnet: 'Garnet / Brick',
  'hand-trap': 'Hand Trap',
  other: '其他',
};

// ---- settings ---------------------------------------------------------------------------------

/** The phased analysis' own budgets (G48-5). The per-request timeout and the daily limit stay in AiSettings. */
export interface StagedSettings {
  /** Starter combinations kept after phase A. */
  maxCombos: number;
  /** Routes asked for per combination. */
  routesPerCombo: number;
  /** Requests including phase A. */
  maxRequests: number;
  /** Estimated input + output tokens over the whole analysis (the actual usage replaces the estimate once known). */
  tokenBudget: number;
  /** Wall-clock limit for the whole analysis. */
  totalTimeoutSeconds: number;
}

export const DEFAULT_STAGED: StagedSettings = { maxCombos: 4, routesPerCombo: 2, maxRequests: 6, tokenBudget: 150_000, totalTimeoutSeconds: 2700 };
export const STAGED_LIMITS = {
  maxCombos: [1, 10],
  routesPerCombo: [1, 4],
  maxRequests: [2, 40],
  tokenBudget: [10_000, 2_000_000],
  totalTimeoutSeconds: [60, 14_400],
} as const;

const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.trunc(Number.isFinite(n) ? n : lo)));

export function normalizeStaged(s: Partial<StagedSettings> = {}): StagedSettings {
  const m = { ...DEFAULT_STAGED, ...s };
  return {
    maxCombos: clamp(m.maxCombos, STAGED_LIMITS.maxCombos),
    routesPerCombo: clamp(m.routesPerCombo, STAGED_LIMITS.routesPerCombo),
    maxRequests: clamp(m.maxRequests, STAGED_LIMITS.maxRequests),
    tokenBudget: clamp(m.tokenBudget, STAGED_LIMITS.tokenBudget),
    totalTimeoutSeconds: clamp(m.totalTimeoutSeconds, STAGED_LIMITS.totalTimeoutSeconds),
  };
}

/** The starter sizes the user ticked, in order. */
export function selectedSizes(scope: AnalysisScope): Array<1 | 2 | 3> {
  return ([scope.single && 1, scope.multi && 2, scope.triple && 3] as const).filter((x): x is 1 | 2 | 3 => !!x);
}

// ---- phase A: roles and combinations ---------------------------------------------------------------

const cardId = z.number().int().positive().max(0xffffffff);

export const planSchema = z.object({
  summary: z.string(),
  roles: z.array(z.object({ cardId, roles: z.array(z.enum(CARD_ROLES)).min(1).max(7), note: z.string() })).max(80),
  combos: z
    .array(
      z.object({
        cardIds: z.array(cardId).min(1).max(6),
        priority: z.number().int().min(1).max(999),
        reason: z.string(),
        targetExtraIds: z.array(cardId).max(15),
        target: z.string(),
      }),
    )
    .max(60),
});
export type PlanOutput = z.infer<typeof planSchema>;

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items: unknown) => ({ type: 'array', items });
const str = { type: 'string' };
const int = { type: 'integer' };

/** JSON Schema sent with the phase-A request (limits are enforced by `planSchema` afterwards). */
export const PLAN_JSON_SCHEMA: Record<string, unknown> = obj({
  summary: str,
  roles: arr(obj({ cardId: int, roles: arr({ type: 'string', enum: [...CARD_ROLES] }), note: str })),
  combos: arr(obj({ cardIds: arr(int), priority: int, reason: str, targetExtraIds: arr(int), target: str })),
});

export function parsePlan(text: string): { ok: true; plan: PlanOutput } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return { ok: false, error: 'AI 回應不是有效的 JSON' };
  }
  const parsed = planSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '（根）'}：${i.message}`);
    return { ok: false, error: `AI 的階段 A 回應不符合結構：${first.join('；')}` };
  }
  return { ok: true, plan: parsed.data };
}

const SIZE_WORD = { 1: 'single-card', 2: 'two-card', 3: 'three-card' } as const;
const sizeWords = (sizes: ReadonlyArray<1 | 2 | 3>) => {
  const w = sizes.map((s) => SIZE_WORD[s]);
  return w.length <= 1 ? (w[0] ?? '') : `${w.slice(0, -1).join(', ')} and ${w.at(-1)}`;
};

const PLAN_SYSTEM = `You are an expert Yu-Gi-Oh! MASTER DUEL combo analyst. This is PHASE A of a phased analysis of the exact deck list the user provides: you do not write routes yet.
A separate program checks everything you say against the deck list; later requests will ask for the full routes of the combinations you propose. A human tests the routes in MASTER DUEL. Never claim that anything is legal, verified or tested.

Your tasks:
1. roles: label EVERY distinct card of the deck list with one or more roles: starter (Starter: begins a combo), extender (Extender: continues one), searcher (Searcher), combo-piece (Combo Piece: needed by a combo but weak alone), garnet (Garnet / Brick: bad or dead in hand), hand-trap (Hand Trap: best kept for the opponent's turn), other. These labels are your candidate labels, not rules-verified facts; add a short note.
2. combos: propose starter combinations worth analysing — sets of cards from the MAIN DECK that you could hold in the opening hand — ordered by "priority" (1 = analyse first). A combination has 1, 2 or 3 cards; repeat an id for copies, never more copies than the deck has. Prefer combinations whose cards have a clear effect synergy. Do NOT propose a combination that includes a card that would not take part or would not improve the result (for example a third card that only sits in hand). For each combination give the reason, the Extra Deck monsters it is aimed at (targetExtraIds) and the target end board in words.
3. Use only cards from the deck list, referring to them by their numeric "id". Situation: you go first, turn 1, 5-card opening hand, no draw, both fields are empty, the opponent never responds. Use current MASTER DUEL rules.
Do not write out any steps or routes in this phase.
Write all descriptive text in Traditional Chinese as used in Taiwan; keep card names in English exactly as in the deck list. Keep texts short.
Respond only with JSON that matches the provided schema.`;

export function buildPlanPrompt(deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, scope: AnalysisScope, goal: AnalysisGoal = DEFAULT_GOAL, staged: StagedSettings = DEFAULT_STAGED): { system: string; user: string } {
  const count = (rows: DeckRecord['main']) => rows.reduce((s, r) => s + r.count, 0);
  const user = [
    `Deck: ${deck.name} (Main Deck ${count(deck.main)} cards, Extra Deck ${count(deck.extra)} cards; ${deck.main.length + deck.extra.length} distinct cards, all listed below).`,
    'Phase A request: Card roles for every card of the deck list, then the starter combinations worth analysing.',
    `Analysis scope: ${sizeWords(selectedSizes(scope))} starters. Propose at most ${staged.maxCombos} starter combinations in "combos", best first.`,
    ...goalLines(deck, cards, goal),
    'Deck list (one JSON object per distinct card):',
    ...deck.main.map((r) => cardLine(cards, 'main', r.cardId, r.count)),
    ...deck.extra.map((r) => cardLine(cards, 'extra', r.cardId, r.count)),
  ]
    .filter(Boolean)
    .join('\n');
  return { system: PLAN_SYSTEM, user };
}

export interface PlannedCombo {
  cardIds: number[];
  size: 1 | 2 | 3;
  priority: number;
  reason: string;
  targetExtraIds: number[];
  target: string;
}

export interface RejectedCombo {
  cardIds: number[];
  reason: string;
}

/**
 * The local part of phase A (G48-2): drops what cannot be analysed and says why — a card outside the
 * Main Deck, more copies than the deck has, a size that was not ticked, a repeat, more than the limit —
 * and orders the rest by priority (smaller combination first on a tie).
 */
export function selectCombos(plan: Pick<PlanOutput, 'combos'>, deck: Pick<DeckRecord, 'main' | 'extra'>, sizes: readonly number[], maxCombos: number, name: (id: number) => string = (id) => `ID ${id}`): { combos: PlannedCombo[]; rejected: RejectedCombo[] } {
  const combos: PlannedCombo[] = [];
  const rejected: RejectedCombo[] = [];
  const extra = new Set(deck.extra.filter((r) => r.count > 0).map((r) => r.cardId));
  const seen = new Set<string>();
  const ordered = plan.combos.map((c, i) => ({ c, i })).sort((a, b) => a.c.priority - b.c.priority || a.c.cardIds.length - b.c.cardIds.length || a.i - b.i);

  for (const { c } of ordered) {
    const size = c.cardIds.length;
    const reject = (reason: string) => rejected.push({ cardIds: [...c.cardIds], reason });
    if (size < 1 || size > 3) {
      reject(`張數 ${size} 不在 1～3 張的範圍`);
      continue;
    }
    const outside = c.cardIds.find((id) => countOf(deck.main, id) === 0);
    if (outside !== undefined) {
      reject(`「${name(outside)}」不在主牌組（額外牌組或牌組外的卡不能當起手牌）`);
      continue;
    }
    const over = [...tally(c.cardIds)].find(([id, n]) => n > countOf(deck.main, id));
    if (over) {
      reject(`「${name(over[0])}」需要 ${over[1]} 張，但牌組只有 ${countOf(deck.main, over[0])} 張（超過牌組張數）`);
      continue;
    }
    const key = [...c.cardIds].sort((a, b) => a - b).join('+');
    if (seen.has(key)) {
      reject('與前面的組合重複（同樣的牌，不計順序）');
      continue;
    }
    if (!sizes.includes(size)) {
      reject(`${size} 卡展開未勾選`);
      continue;
    }
    if (combos.length >= maxCombos) {
      reject(`超過最大候選起手組合數（${maxCombos}）`);
      continue;
    }
    seen.add(key);
    combos.push({ cardIds: [...c.cardIds], size: size as 1 | 2 | 3, priority: c.priority, reason: c.reason.trim().slice(0, 500), targetExtraIds: c.targetExtraIds.filter((id) => extra.has(id)), target: c.target.trim().slice(0, 500) });
  }
  return { combos, rejected };
}

// ---- phase B: the routes of one combination ----------------------------------------------------------

const COMBO_SYSTEM_EXTRA = `

Starter combination mode (phase B of a phased analysis):
- The user names ONE starter combination of 1 to 3 cards. handCardIds must list exactly those cards (repeat an id for copies); starterCardIds are the same cards.
- alternativeStarters: for a required card, other Main Deck cards that could play the same role: { "cardId": the required card, "instead": [ids], "note": why }. Use [] when there is none. These are your labels, not verified facts.
- extenderCardIds: cards that are NOT required but would make the route better when they are also in hand. Use [] when there is none.
- avoidInHand: components the route fetches from the Deck itself (searched, sent or summoned from the Deck) that would change the route if they were already in the opening hand. Each of them must also be listed in requiredInMain and must not be in handCardIds. Use [] when there is none.
- unresolved: when you could not work a step out, still give the step with your best moves and write the reason here; use "" for a finished step. Never replace a step by a vague description ("continue as usual", "make a Link Monster"): every step names the card, the effect, the target, the materials, the cost and moves every card with its zone and slot.
- Return different LINES, not one line with two endings. Two routes of this combination must differ in their early or middle steps (a different search target, a different first Link Material, a different Extra Deck monster as the second Link Summon) and in their end boards; routes whose first half is identical step by step count as ONE line. If you cannot find a second genuinely different line, return only ONE route: fewer routes are better than a variant. Do not return two routes that differ only in the order of their steps.`;

export function buildComboPrompt(deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, combo: PlannedCombo, scope: AnalysisScope, goal: AnalysisGoal = DEFAULT_GOAL, staged: StagedSettings = DEFAULT_STAGED): { system: string; user: string } {
  const count = (rows: DeckRecord['main']) => rows.reduce((s, r) => s + r.count, 0);
  const user = [
    `Deck: ${deck.name} (Main Deck ${count(deck.main)} cards, Extra Deck ${count(deck.extra)} cards; ${deck.main.length + deck.extra.length} distinct cards, all listed below).`,
    `Starter combination (${combo.size} card${combo.size === 1 ? '' : 's'}): ${combo.cardIds.map((id) => namedCard(cards, id)).join('; ')}.`,
    'Every one of them must take part in the route (as an actor, a target, a material, or by leaving the hand). Do not add a card to handCardIds that does not take part in the route.',
    `Return at most ${staged.routesPerCombo} routes for this combination, ordered by the goal.`,
    combo.reason ? `Why this combination was proposed: ${combo.reason}` : '',
    combo.target ? `Intended end board: ${combo.target}` : '',
    combo.targetExtraIds.length ? `Extra Deck monsters it is aimed at: ${combo.targetExtraIds.map((id) => namedCard(cards, id)).join('; ')} (a preference, not a requirement).` : '',
    ...goalLines(deck, cards, goal),
    'Deck list (one JSON object per distinct card):',
    ...deck.main.map((r) => cardLine(cards, 'main', r.cardId, r.count)),
    ...deck.extra.map((r) => cardLine(cards, 'extra', r.cardId, r.count)),
  ]
    .filter(Boolean)
    .join('\n');
  return { system: SYSTEM_PROMPT + COMBO_SYSTEM_EXTRA, user };
}

// ---- budget ---------------------------------------------------------------------------------------

export type StopReason = 'requests' | 'tokens' | 'time' | 'daily-limit' | 'cancelled' | 'error';

export interface Budget {
  maxRequests: number;
  tokenBudget: number;
  requests: number;
  tokens: number;
  startedAt: number;
  totalTimeoutMs: number;
}

/** Output tokens assumed for the phase-A request when the guard decides whether it fits. */
export const ESTIMATED_PLAN_OUTPUT = 4000;
/** Lower bound of one written-out route (see TOKENS_PER_ROUTE): the guard blocks only when even this does not fit. */
export const ESTIMATED_ROUTE_OUTPUT = 3000;

/** Why the next request must not be sent (null = go ahead). Checked before every request, so none can exceed a limit. */
export function stopReason(b: Budget, next: { tokens: number }, now: number, dailyRemaining: number): StopReason | null {
  if (dailyRemaining <= 0) return 'daily-limit';
  if (b.requests >= b.maxRequests) return 'requests';
  if (now - b.startedAt >= b.totalTimeoutMs) return 'time';
  if (b.tokens + next.tokens > b.tokenBudget) return 'tokens';
  return null;
}

export const STOP_LABEL: Record<StopReason, string> = {
  requests: '請求次數用完',
  tokens: 'Token 預算用完',
  time: '整體逾時',
  'daily-limit': '每日請求上限',
  cancelled: '使用者取消',
  error: 'AI 服務錯誤（登入、權限或用量），不再送出後續請求',
};

// ---- the record of a phased run -----------------------------------------------------------------------

export type StagedStatus = 'done' | 'failed' | 'truncated' | 'cancelled' | 'skipped';

export interface StagedCombo extends PlannedCombo {
  status: StagedStatus;
  /** Why it was not analysed (status "skipped" / "cancelled"). */
  skippedBy?: StopReason;
  /** Routes it produced. */
  routes: number;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface StagedRecord {
  plan?: { summary: string; roles: Array<{ cardId: number; roles: CardRole[]; note: string }> };
  combos: StagedCombo[];
  rejected: RejectedCombo[];
  budget: { maxRequests: number; tokenBudget: number; requests: number; tokens: number; stoppedBy: StopReason | null };
  /** Accepted combinations that were not analysed (skipped or cancelled). */
  notAnalyzed: number;
  /** Accepted combinations whose answer failed or was cut off. */
  failed: number;
  /** Always false: a phased analysis covers the combinations the model proposed, never every possible line. */
  exhaustive: false;
}
