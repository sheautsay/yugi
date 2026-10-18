import { z } from 'zod';
import { validateCombo } from '../combo';
import { ftkInfoOf, checkFtkRoute, isFtkRoute } from '../ftk-check';
import { CardRecord, ComboRoute, ComboStep, DeckRecord, FIELD_SLOTS, FTK_DEFAULT_OPPONENT_EXTRA, FTK_TARGET_LP, HandClause, PLAY_ZONES, RouteBranch } from '../models';
import { cardLine } from './prompt';
import { Candidate, RunContext, cleanText } from './analysis-output';

// B7: the AI side of a first-turn-kill (FTK) deck. The model writes a plan with BRANCHES; the schema is flat (segments that
// point at each other by id) because recursive JSON Schemas are not accepted by every provider. The program turns it into a
// version 2 route, and the local check — never the model — decides the damage, the success of each branch and the chance.

export const FTK_PROMPT_VERSION = 'ftk-plan-v1';

export const FTK_ASSUMPTIONS: readonly string[] = [
  'Yu-Gi-Oh! MASTER DUEL 當期規則',
  '先攻第 1 回合：起手 5 張、不抽牌、不能進入戰鬥階段；勝利條件是用效果傷害讓對手 LP 8000 歸零',
  '假設對手不發動任何效果（無干擾）：對手的手坑可能直接讓計畫失敗，成功率不包含這個風險',
  `假設對手的額外牌組有 ${FTK_DEFAULT_OPPONENT_EXTRA} 張可被除外的卡（較少時傷害會變低）`,
  '抽牌、翻開牌組頂的結果是隨機的：計畫只記錄張數，依實際出現的卡走不同分支',
];

const SYSTEM = `You are an expert Yu-Gi-Oh! MASTER DUEL combo analyst. The deck below is a FIRST-TURN-KILL (FTK) deck: it wins on turn 1 by taking the opponent's Life Points from 8000 to 0 with effect damage. You propose CANDIDATE plans for the exact deck list provided.
A separate program checks every branch of every plan card by card and against part of the rules, computes the damage and the chance of success itself, and a human tests the plans in MASTER DUEL. Never claim that a plan is legal, verified or tested, and never state a probability.

Situation: you go first, turn 1, 5-card opening hand, no draw, no Battle Phase, both fields are empty, and the opponent never responds or interrupts. Use current MASTER DUEL rules. Respect every card's once-per-turn clauses, activation conditions and costs exactly as written in its text. A Trap Card Set this turn cannot be activated this turn unless an effect lets you (the text says "it can be activated this turn").

Random results (very important):
- Drawing cards and excavating (revealing the top of the Deck) have results YOU CANNOT CHOOSE. Write them as a step with actionType "draw" or "excavate", the number of cards in "drawCount" and where they go in "drawTo" ("hand" for draws; "gy" or "banished" for excavated cards). NEVER list the cards that turn up as moves of that step, and never use a card you only hoped to draw.
- Whatever depends on what turns up goes into the segment's "branches". Every branch has a "when" list of conditions — each condition is {anyOf: [card ids], count}, and ALL conditions must be met by different cards among the cards that turned up — and "next", the id of the segment that continues. A branch with an empty "when" list means "otherwise" and must be the LAST branch of the segment. Branches are tried in order and the first whose condition is met is taken, so put the best branches first. EVERY segment that ends with a random step must end with an "otherwise" branch (use outcome "fail" with next "" if nothing can be done).
- A segment with branches must END with the random step they depend on. The first segment of the plan has the id "main".
- Do not draw more cards than a branch condition needs: a condition needs at most drawCount cards.

Rules for every step (same as ordinary routes):
- Use only cards from the deck list, referring to them by their numeric "id". Never invent cards or ids. Never use more copies than the deck has.
- handCardIds: the exact opening-hand cards the plan needs (at most 5; repeat an id for copies).
- steps in order: actionType, actorCardIds (the card whose effect is used), targetCardIds, materialCardIds, cost, effect, result, effectRef (the reference listed in that card's "effects", "<id>#<n>", or "" when the card lists none).
- moves: list EVERY card that changes place in the step, one entry per copy, zones deck, hand, extra, field, gy, banished, overlay (slot "" unless the move involves a field zone). Costs, discards, Set cards, cards banished from the Extra Deck and cards that go to the GY after resolving must all appear as moves.
- Damage: do NOT work out damage. The program counts it from the card effects (effectRef) and the cards you move: for example it counts how many cards the opponent has banished by how many cards you banish from your Extra Deck with "Banquet of Millions". Put the effectRef on every step that deals damage, changes Life Points or banishes the opponent's cards. If an effect is repeated, write EACH use as its own step; never write "repeat N times". "claimedDamage" is optional (-1 = none): the damage you expect from that step; it is only compared, never used.
- Pay attention to Life Point costs and to effects that give the opponent Life Points: they change what is needed.
- If you are not sure about a card's exact effect or a ruling, say so in that step's "uncertainty".
- Write all descriptive text in Traditional Chinese as used in Taiwan; keep card names in English exactly as in the deck list. Keep texts short.
Respond only with JSON that matches the provided schema.`;

export const FTK_SYSTEM_PROMPT = SYSTEM;

export function buildFtkPrompt(deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, options: { plans: number } = { plans: 3 }): { system: string; user: string } {
  const count = (rows: DeckRecord['main']) => rows.reduce((s, r) => s + r.count, 0);
  const user = [
    `Deck: ${deck.name} (Main Deck ${count(deck.main)} cards, Extra Deck ${count(deck.extra)} cards). It is a first-turn-kill deck.`,
    `Goal: find plans that take the opponent from ${FTK_TARGET_LP} Life Points to 0 on turn 1. Return at most ${options.plans} plans with different opening hands or different ways of using the draws; branch on what you draw.`,
    'Deck list (one JSON object per distinct card):',
    ...deck.main.map((r) => cardLine(cards, 'main', r.cardId, r.count)),
    ...deck.extra.map((r) => cardLine(cards, 'extra', r.cardId, r.count)),
  ].join('\n');
  return { system: SYSTEM, user };
}

// ---- the model's answer ------------------------------------------------------------------------------

const cardId = z.number().int().positive().max(0xffffffff);
const zone = z.enum(PLAY_ZONES);
const clause = z.object({ anyOf: z.array(cardId).min(1).max(30), count: z.number().int().min(1).max(6) });

const flatStep = z.object({
  actionType: z.enum(['normal-summon', 'special-summon', 'link-summon', 'synchro-summon', 'xyz-summon', 'fusion-summon', 'ritual-summon', 'activate', 'set', 'search', 'send-to-gy', 'banish', 'add-to-hand', 'select-material', 'draw', 'excavate', 'other']),
  title: z.string(),
  description: z.string(),
  actorCardIds: z.array(cardId).max(10),
  targetCardIds: z.array(cardId).max(10),
  materialCardIds: z.array(cardId).max(10),
  cost: z.string(),
  effect: z.string(),
  result: z.string(),
  uncertainty: z.string(),
  effectRef: z.string().max(40),
  moves: z.array(z.object({ cardId, from: zone, to: zone, slot: z.enum([...FIELD_SLOTS, '']) })).max(30),
  drawCount: z.number().int().min(0).max(10),
  drawTo: z.enum(['hand', 'gy', 'banished', '']),
  claimedDamage: z.number().int().min(-1).max(1_000_000),
});

export const ftkOutputSchema = z.object({
  summary: z.string(),
  plans: z
    .array(
      z.object({
        name: z.string(),
        handCardIds: z.array(cardId).min(1).max(5),
        preconditions: z.array(z.string()).max(20),
        segments: z
          .array(
            z.object({
              id: z.string().min(1).max(40),
              steps: z.array(flatStep).max(80),
              branches: z.array(z.object({ label: z.string(), when: z.array(clause).max(6), outcome: z.enum(['success', 'fail', '']), next: z.string().max(40) })).max(12),
            }),
          )
          .min(1)
          .max(40),
        pros: z.array(z.string()).max(10),
        cons: z.array(z.string()).max(10),
      }),
    )
    .min(1, 'AI 沒有提出任何計畫')
    .max(8),
});

export type FtkOutput = z.infer<typeof ftkOutputSchema>;
export type FtkPlan = FtkOutput['plans'][number];

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items: unknown) => ({ type: 'array', items });
const str = { type: 'string' };
const int = { type: 'integer' };
const zoneJson = { type: 'string', enum: [...PLAY_ZONES] };

export const FTK_JSON_SCHEMA: Record<string, unknown> = obj({
  summary: str,
  plans: arr(
    obj({
      name: str,
      handCardIds: arr(int),
      preconditions: arr(str),
      segments: arr(
        obj({
          id: str,
          steps: arr(
            obj({
              actionType: { type: 'string', enum: [...flatStep.shape.actionType.options] },
              title: str,
              description: str,
              actorCardIds: arr(int),
              targetCardIds: arr(int),
              materialCardIds: arr(int),
              cost: str,
              effect: str,
              result: str,
              uncertainty: str,
              effectRef: str,
              moves: arr(obj({ cardId: int, from: zoneJson, to: zoneJson, slot: { type: 'string', enum: [...FIELD_SLOTS, ''] } })),
              drawCount: int,
              drawTo: { type: 'string', enum: ['hand', 'gy', 'banished', ''] },
              claimedDamage: int,
            }),
          ),
          branches: arr(obj({ label: str, when: arr(obj({ anyOf: arr(int), count: int })), outcome: { type: 'string', enum: ['success', 'fail', ''] }, next: str })),
        }),
      ),
      pros: arr(str),
      cons: arr(str),
    }),
  ),
});

export function parseFtkOutput(text: string): { ok: true; output: FtkOutput } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return { ok: false, error: 'AI 回應不是有效的 JSON' };
  }
  const parsed = ftkOutputSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '（根）'}：${i.message}`);
    return { ok: false, error: `AI 回應不符合結構：${first.join('；')}${parsed.error.issues.length > 5 ? `（另有 ${parsed.error.issues.length - 5} 項）` : ''}` };
  }
  return { ok: true, output: parsed.data };
}

// ---- model answer → version 2 route ------------------------------------------------------------------------

const optional = (value: string, max: number) => {
  const text = cleanText(value, max);
  return text ? text : undefined;
};

/** Builds the route tree from the flat segments. Returns the problems that make the plan unusable (cycles, missing segments). */
export function planToRoute(plan: FtkPlan, ctx: Pick<RunContext, 'deck' | 'deckFingerprint' | 'cardDataVersion' | 'provider' | 'model' | 'servedModel' | 'runId' | 'now'>): { route: ComboRoute; errors: string[] } {
  const errors: string[] = [];
  const segments = new Map(plan.segments.map((s) => [s.id, s]));
  const root = segments.get('main') ?? plan.segments[0];
  if (!segments.has('main')) errors.push('找不到 id 為「main」的第一段');

  const expand = (id: string, trail: readonly string[]): ComboStep[] => {
    const segment = segments.get(id);
    if (!segment) {
      errors.push(`分支指向不存在的段落「${id}」`);
      return [];
    }
    if (trail.includes(id)) {
      errors.push(`段落「${id}」形成了迴圈（計畫必須是沒有迴圈的分支樹）`);
      return [];
    }
    const steps = segment.steps.map((s, i): ComboStep => {
      const random = s.actionType === 'draw' || s.actionType === 'excavate';
      const title = cleanText(s.title, 120) || `步驟 ${i + 1}`;
      return {
        id: crypto.randomUUID(),
        order: i + 1,
        actionType: s.actionType,
        actorCardIds: s.actorCardIds,
        title,
        description: cleanText(s.description, 4000) || title,
        ...(s.targetCardIds.length ? { targetCardIds: s.targetCardIds } : {}),
        ...(s.materialCardIds.length ? { materialCardIds: s.materialCardIds } : {}),
        ...(optional(s.cost, 1000) ? { costText: optional(s.cost, 1000) } : {}),
        ...(optional(s.effect, 2000) ? { effectText: optional(s.effect, 2000) } : {}),
        ...(optional(s.result, 1000) ? { resultText: optional(s.result, 1000) } : {}),
        ...(optional(s.uncertainty, 980) ? { warning: `AI 不確定：${optional(s.uncertainty, 980)}` } : {}),
        ...(s.moves.length ? { moves: s.moves.map((m) => ({ cardId: m.cardId, from: m.from, to: m.to, ...(m.slot ? { slot: m.slot } : {}) })) } : {}),
        ...(/^\d{1,10}#\d{1,2}$/.test(s.effectRef) ? { effectRef: s.effectRef } : {}),
        ...(random ? { random: { count: Math.max(1, s.drawCount), to: s.drawTo || (s.actionType === 'draw' ? 'hand' : 'gy') } } : {}),
        ...(s.claimedDamage >= 0 ? { claimedDamage: s.claimedDamage } : {}),
      };
    });
    if (segment.branches.length) {
      const last = steps.at(-1);
      if (!last) {
        errors.push(`段落「${id}」有分支但沒有任何步驟`);
        return steps;
      }
      last.branches = segment.branches.map((b, j): RouteBranch => {
        const when: HandClause[] | null = b.when.length ? b.when.map((c) => ({ anyOf: [...new Set(c.anyOf)], count: c.count })) : null;
        return {
          id: crypto.randomUUID(),
          label: cleanText(b.label, 120) || (when ? `分支 ${j + 1}` : '否則'),
          when,
          steps: b.next ? expand(b.next, [...trail, id]) : [],
          ...(b.outcome ? { outcome: b.outcome } : {}),
        };
      });
    }
    return steps;
  };

  const steps = root ? expand(root.id, []) : [];
  const counts = new Map<number, number>();
  for (const id of plan.handCardIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const route: ComboRoute = {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    version: 1,
    name: cleanText(plan.name, 120) || 'AI FTK 計畫',
    archetype: cleanText(ctx.deck.name, 60) || 'FTK',
    format: 'master-duel',
    ...(plan.preconditions.length ? { description: cleanText(plan.preconditions.join('\n'), 2000) } : {}),
    conditions: { handAllOf: [...counts].map(([id, count]) => ({ anyOf: [id], count })), setup: { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true } },
    steps,
    endBoard: [],
    ftk: { targetDamage: FTK_TARGET_LP, opponentExtraDeck: FTK_DEFAULT_OPPONENT_EXTRA },
    // Never "verified": the check below decides between draft and unverified.
    verification: { status: 'draft' },
    analysis: {
      origin: 'ai',
      runId: ctx.runId,
      deckId: ctx.deck.id,
      deckName: ctx.deck.name,
      deckVersion: ctx.deck.version,
      deckFingerprint: ctx.deckFingerprint,
      cardDataVersion: cleanText(ctx.cardDataVersion, 60),
      provider: ctx.provider,
      model: ctx.model,
      ...(ctx.servedModel ? { servedModel: ctx.servedModel } : {}),
      promptVersion: FTK_PROMPT_VERSION,
      generatedAt: ctx.now,
      starterCardIds: [...new Set(plan.handCardIds)].slice(0, 6),
      preconditions: plan.preconditions.slice(0, 20).map((p) => cleanText(p, 500)),
      pros: plan.pros.map((p) => cleanText(p, 500)),
      cons: plan.cons.map((p) => cleanText(p, 500)),
      check: { passed: false, checkedAt: ctx.now, deckFingerprint: ctx.deckFingerprint, problems: [] },
    },
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  return { route, errors };
}

/** Runs the FTK check against `deck` and records it; the status follows the result (never verified). */
export function withFtkCheck(route: ComboRoute, deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, now: string, fingerprint: string): Candidate {
  const result = checkFtkRoute(route, deck, { cards });
  const problems = result.problems.map((p) => cleanText(`${p.branch ? `（分支：${p.branch}）` : ''}${p.step ? `第 ${p.step} 步：` : ''}${p.message}`, 1000));
  const next: ComboRoute = {
    ...route,
    verification: route.verification.status === 'verified' || route.verification.status === 'invalidated' ? route.verification : { status: result.passed ? 'unverified' : 'draft' },
    analysis: { ...route.analysis!, check: { passed: result.passed, checkedAt: now, deckFingerprint: fingerprint, problems: problems.slice(0, 200) } },
  };
  const validation = validateCombo(next);
  return { route: next, schemaErrors: validation.ok ? [] : validation.errors };
}

export function toFtkCandidate(plan: FtkPlan, ctx: RunContext): Candidate {
  const { route, errors } = planToRoute(plan, ctx);
  const candidate = withFtkCheck(route, ctx.deck, ctx.cards, ctx.now, ctx.deckFingerprint);
  return errors.length ? { ...candidate, schemaErrors: [...errors, ...candidate.schemaErrors] } : candidate;
}

export { ftkInfoOf, isFtkRoute };
