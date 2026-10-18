import { z } from 'zod';
import { validateCombo } from '../combo';
import { ACTION_LABEL } from '../labels';
import { ACTION_TYPES, CardRecord, ComboRoute, ComboStep, DeckRecord, FIELD_SLOTS, PLAY_ZONES, PlayZone, RouteAnalysisInfo } from '../models';
import { checkRoute, PLAY_ZONE_LABEL } from '../route-check';
import { markupProblem } from '../schemas';
import { countOf } from '../deck';
import { tally } from '../hand';

// CR-004: what the model must return, how it is validated, and how each route becomes an
// ordinary ComboRoute. Nothing the model writes can mark a route verified.

const cardId = z.number().int().positive().max(0xffffffff);
const zone = z.enum(PLAY_ZONES);
const required = z.array(z.object({ cardId, count: z.number().int().min(1).max(3) })).max(20);
// CR-006 fields are optional here so answers in the v1 shape still parse.
const slot = z.enum([...FIELD_SLOTS, '']).optional();
const effectRef = z.string().max(40).optional();
const explored = z
  .array(
    z.object({
      name: z.string(),
      handCardIds: z.array(cardId).max(6),
      extraDeckCardIds: z.array(cardId).max(15),
      finalBoardCardIds: z.array(cardId).max(15),
      routeName: z.string(),
      note: z.string(),
    }),
  )
  .max(30)
  .optional();

export const aiOutputSchema = z.object({
  summary: z.string(),
  starters: z.array(z.object({ cardIds: z.array(cardId).min(1).max(5), kind: z.enum(['single', 'multi']), description: z.string() })).max(40),
  extenders: z.array(z.object({ cardId, requires: z.string(), description: z.string() })).max(40),
  routes: z
    .array(
      z.object({
        name: z.string(),
        handCardIds: z.array(cardId).min(1).max(6),
        starterCardIds: z.array(cardId).min(1).max(5),
        requiredInMain: required,
        requiredInExtra: required,
        preconditions: z.array(z.string()).max(20),
        steps: z
          .array(
            z.object({
              actionType: z.enum(ACTION_TYPES),
              title: z.string(),
              description: z.string(),
              actorCardIds: z.array(cardId).max(10),
              targetCardIds: z.array(cardId).max(10),
              materialCardIds: z.array(cardId).max(10),
              cost: z.string(),
              effect: z.string(),
              result: z.string(),
              uncertainty: z.string(),
              effectRef,
              moves: z.array(z.object({ cardId, from: zone, to: zone, slot })).max(20),
              // CR-008 (v3): non-empty = the model could not work this step out.
              unresolved: z.string().optional(),
            }),
          )
          .max(80),
        endBoard: z.array(z.object({ cardId, zone, count: z.number().int().min(1).max(3), note: z.string() })).max(30),
        pros: z.array(z.string()).max(10),
        cons: z.array(z.string()).max(10),
        // CR-008 (v3) starter roles; all optional so answers in the older shapes still parse.
        alternativeStarters: z.array(z.object({ cardId, instead: z.array(cardId).max(6), note: z.string() })).max(10).optional(),
        extenderCardIds: z.array(cardId).max(10).optional(),
        avoidInHand: z.array(cardId).max(10).optional(),
      }),
    )
    .min(1, 'AI 沒有提出任何路線')
    .max(10),
  explored,
});

export type AiOutput = z.infer<typeof aiOutputSchema>;
export type AiRoute = AiOutput['routes'][number];

// JSON Schema for structured outputs: only keywords every provider accepts (no numeric or
// length limits — those are enforced by `aiOutputSchema` after the response arrives).
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items: unknown) => ({ type: 'array', items });
const str = { type: 'string' };
const int = { type: 'integer' };
const zoneJson = { type: 'string', enum: [...PLAY_ZONES] };
const slotJson = { type: 'string', enum: [...FIELD_SLOTS, ''] };
const requiredJson = arr(obj({ cardId: int, count: int }));

export const AI_OUTPUT_JSON_SCHEMA: Record<string, unknown> = obj({
  summary: str,
  starters: arr(obj({ cardIds: arr(int), kind: { type: 'string', enum: ['single', 'multi'] }, description: str })),
  extenders: arr(obj({ cardId: int, requires: str, description: str })),
  routes: arr(
    obj({
      name: str,
      handCardIds: arr(int),
      starterCardIds: arr(int),
      requiredInMain: requiredJson,
      requiredInExtra: requiredJson,
      preconditions: arr(str),
      steps: arr(
        obj({
          actionType: { type: 'string', enum: [...ACTION_TYPES] },
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
          moves: arr(obj({ cardId: int, from: zoneJson, to: zoneJson, slot: slotJson })),
        }),
      ),
      endBoard: arr(obj({ cardId: int, zone: zoneJson, count: int, note: str })),
      pros: arr(str),
      cons: arr(str),
    }),
  ),
  explored: arr(obj({ name: str, handCardIds: arr(int), extraDeckCardIds: arr(int), finalBoardCardIds: arr(int), routeName: str, note: str })),
});

/**
 * CR-008 (v3): the same schema plus the starter roles per route and "unresolved" per step. Every
 * property is required in the schema sent to the model (strict structured output); the parser above
 * still accepts answers without them.
 */
export const AI_OUTPUT_JSON_SCHEMA_V3: Record<string, unknown> = (() => {
  const schema = JSON.parse(JSON.stringify(AI_OUTPUT_JSON_SCHEMA)) as { properties: { routes: { items: { properties: Record<string, any>; required: string[] } } } };
  const route = schema.properties.routes.items;
  const step = route.properties['steps'].items;
  step.properties['unresolved'] = str;
  step.required.push('unresolved');
  const extra: Record<string, unknown> = { alternativeStarters: arr(obj({ cardId: int, instead: arr(int), note: str })), extenderCardIds: arr(int), avoidInHand: arr(int) };
  for (const [key, value] of Object.entries(extra)) {
    route.properties[key] = value;
    route.required.push(key);
  }
  return schema;
})();

/** Parses the model's text. Throws a readable message on anything but schema-valid JSON. */
export function parseAiOutput(text: string): { ok: true; output: AiOutput } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return { ok: false, error: 'AI 回應不是有效的 JSON' };
  }
  const parsed = aiOutputSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '（根）'}：${i.message}`);
    return { ok: false, error: `AI 回應不符合結構：${first.join('；')}${parsed.error.issues.length > 5 ? `（另有 ${parsed.error.issues.length - 5} 項）` : ''}` };
  }
  return { ok: true, output: parsed.data };
}

/** Model text is rendered as plain text anyway; this only defuses anything the stored-data filter rejects. */
export function cleanText(value: string, max: number): string {
  let text = value.trim().slice(0, max);
  if (markupProblem(text)) text = text.replace(/</g, '＜').replace(/>/g, '＞').replace(/=/g, '＝').replace(/:/g, '：');
  return text;
}

const optional = (value: string, max: number) => {
  const text = cleanText(value, max);
  return text ? text : undefined;
};

export interface RunContext {
  runId: string;
  deck: DeckRecord;
  deckFingerprint: string;
  cardDataVersion: string;
  provider: RouteAnalysisInfo['provider'];
  model: string;
  servedModel?: string;
  promptVersion: string;
  cards: ReadonlyMap<number, CardRecord>;
  now: string;
}

export interface Candidate {
  route: ComboRoute;
  /** Structural problems that keep it from being saved as a Combo (rare: the conversion fills every field). */
  schemaErrors: string[];
  savedComboId?: string;
}

export interface StarterEntry {
  cardIds: number[];
  kind: 'single' | 'multi';
  description: string;
  /** Set when a card is not in the main deck (data check for the starter list). */
  problem?: string;
}

export interface ExtenderEntry {
  cardId: number;
  requires: string;
  description: string;
  problem?: string;
}

/** Lines the model mentions without writing them out (CR-006): kept for the record, never treated as found. */
export function toExplored(output: AiOutput): Array<{ name: string; handCardIds: number[]; extraDeckCardIds: number[]; finalBoardCardIds: number[]; routeName: string; note: string }> {
  return (output.explored ?? []).map((x) => ({
    name: cleanText(x.name, 120),
    handCardIds: x.handCardIds,
    extraDeckCardIds: x.extraDeckCardIds,
    finalBoardCardIds: x.finalBoardCardIds,
    routeName: cleanText(x.routeName, 120),
    note: cleanText(x.note, 500),
  }));
}

/** Single/multi follows the number of cards, not what the model labelled it. */
export function toStarters(output: AiOutput, deck: DeckRecord, name: (id: number) => string): { starters: StarterEntry[]; extenders: ExtenderEntry[] } {
  const notInMain = (ids: number[]) => {
    const missing = [...new Set(ids)].filter((id) => countOf(deck.main, id) === 0);
    if (missing.length) return `${missing.map((id) => `「${name(id)}」`).join('、')}不在主牌組中`;
    const over = [...tally(ids)].find(([id, n]) => n > countOf(deck.main, id));
    return over ? `「${name(over[0])}」需要 ${over[1]} 張，但主牌組只有 ${countOf(deck.main, over[0])} 張` : undefined;
  };
  return {
    starters: output.starters.map((s) => ({
      cardIds: s.cardIds,
      kind: s.cardIds.length === 1 ? 'single' : 'multi',
      description: cleanText(s.description, 1000),
      ...(notInMain(s.cardIds) ? { problem: notInMain(s.cardIds) } : {}),
    })),
    extenders: output.extenders.map((e) => ({
      cardId: e.cardId,
      requires: cleanText(e.requires, 500),
      description: cleanText(e.description, 1000),
      ...(notInMain([e.cardId]) ? { problem: notInMain([e.cardId]) } : {}),
    })),
  };
}

function mergeRequired(list: AiRoute['requiredInMain']): Array<{ cardId: number; count: number }> {
  const merged = new Map<number, number>();
  for (const { cardId, count } of list) merged.set(cardId, Math.max(merged.get(cardId) ?? 0, count));
  return [...merged].map(([id, count]) => ({ cardId: id, count }));
}

function zoneText(moves: AiRoute['steps'][number]['moves'], actors: number[], end: 'from' | 'to'): string | undefined {
  const move = moves.find((m) => actors.includes(m.cardId)) ?? moves[0];
  return move ? PLAY_ZONE_LABEL[move[end] as PlayZone] : undefined;
}

/** Converts one AI route and runs the local data check (which decides draft vs unverified). */
export function toCandidate(r: AiRoute, ctx: RunContext): Candidate {
  const archetypes = r.handCardIds.map((id) => ctx.cards.get(id)?.archetype).filter((a): a is string => !!a);
  const archetype = archetypes.sort((a, b) => archetypes.filter((x) => x === b).length - archetypes.filter((x) => x === a).length)[0];

  const steps: ComboStep[] = r.steps.map((s, i) => {
    const title = cleanText(s.title, 120) || ACTION_LABEL[s.actionType];
    return {
      id: crypto.randomUUID(),
      order: i + 1,
      actionType: s.actionType,
      actorCardIds: s.actorCardIds,
      title,
      description: cleanText(s.description, 4000) || title,
      ...(zoneText(s.moves, s.actorCardIds, 'from') ? { fromZone: zoneText(s.moves, s.actorCardIds, 'from') } : {}),
      ...(zoneText(s.moves, s.actorCardIds, 'to') ? { toZone: zoneText(s.moves, s.actorCardIds, 'to') } : {}),
      ...(s.targetCardIds.length ? { targetCardIds: s.targetCardIds } : {}),
      ...(s.materialCardIds.length ? { materialCardIds: s.materialCardIds } : {}),
      ...(optional(s.cost, 1000) ? { costText: optional(s.cost, 1000) } : {}),
      ...(optional(s.effect, 2000) ? { effectText: optional(s.effect, 2000) } : {}),
      ...(optional(s.result, 1000) ? { resultText: optional(s.result, 1000) } : {}),
      ...(optional(s.uncertainty, 980) ? { warning: `AI 不確定：${optional(s.uncertainty, 980)}` } : {}),
      ...(s.moves.length ? { moves: s.moves.map((m) => ({ cardId: m.cardId, from: m.from, to: m.to, ...(m.slot ? { slot: m.slot } : {}) })) } : {}),
      ...(s.effectRef && /^\d{1,10}#\d{1,2}$/.test(s.effectRef) ? { effectRef: s.effectRef } : {}),
      ...(optional(s.unresolved ?? '', 500) ? { unresolved: optional(s.unresolved ?? '', 500) } : {}),
    };
  });
  // CR-008: a route written with the v3 role fields is a "1–3 card route"; older shapes have no combo info.
  const hasRoles = r.alternativeStarters !== undefined || r.extenderCardIds !== undefined || r.avoidInHand !== undefined;

  const mustRemainInMain = mergeRequired(r.requiredInMain);
  const mustExistInExtra = mergeRequired(r.requiredInExtra);
  const route: ComboRoute = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    version: 1,
    name: cleanText(r.name, 120) || 'AI 候選路線',
    archetype: cleanText(archetype ?? ctx.deck.name, 60) || 'AI 分析',
    format: 'master-duel',
    ...(r.preconditions.length ? { description: cleanText(r.preconditions.join('\n'), 2000) } : {}),
    conditions: {
      handAllOf: [...tally(r.handCardIds)].map(([id, count]) => ({ anyOf: [id], count })),
      ...(mustRemainInMain.length ? { mustRemainInMain } : {}),
      ...(mustExistInExtra.length ? { mustExistInExtra } : {}),
      setup: { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true },
    },
    steps,
    endBoard: r.endBoard.map((e) => ({ cardId: e.cardId, zone: PLAY_ZONE_LABEL[e.zone], count: e.count, ...(optional(e.note, 500) ? { note: optional(e.note, 500) } : {}) })),
    // Never "verified": the data check below decides between draft and unverified.
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
      promptVersion: ctx.promptVersion,
      generatedAt: ctx.now,
      starterCardIds: r.starterCardIds.slice(0, 6),
      preconditions: r.preconditions.slice(0, 20).map((p) => cleanText(p, 500)),
      pros: r.pros.map((p) => cleanText(p, 500)),
      cons: r.cons.map((p) => cleanText(p, 500)),
      ...(hasRoles
        ? {
            combo: {
              required: [...r.handCardIds],
              alternatives: (r.alternativeStarters ?? []).map((a) => ({ cardId: a.cardId, instead: a.instead, ...(optional(a.note, 300) ? { note: optional(a.note, 300) } : {}) })),
              extenders: r.extenderCardIds ?? [],
              avoidInHand: r.avoidInHand ?? [],
            },
          }
        : {}),
      check: { passed: false, checkedAt: ctx.now, deckFingerprint: ctx.deckFingerprint, problems: [] },
    },
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  return withCheck(route, ctx.deck, ctx.cards, ctx.now, ctx.deckFingerprint);
}

/** Runs the data check against `deck` and records it; status follows the result (never verified). */
export function withCheck(route: ComboRoute, deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, now: string, fingerprint: string): Candidate {
  const result = checkRoute(route, deck, { cards });
  const problems = result.problems.map((p) => cleanText(`${p.step ? `第 ${p.step} 步：` : ''}${p.message}`, 1000));
  const next: ComboRoute = {
    ...route,
    verification: route.verification.status === 'verified' || route.verification.status === 'invalidated' ? route.verification : { status: result.passed ? 'unverified' : 'draft' },
    analysis: { ...route.analysis!, check: { passed: result.passed, checkedAt: now, deckFingerprint: fingerprint, problems: problems.slice(0, 200) } },
  };
  const validation = validateCombo(next);
  return { route: next, schemaErrors: validation.ok ? [] : validation.errors };
}
