import { z } from 'zod';
import { ACTION_TYPES, ComboStep, FIELD_SLOTS, PLAY_ZONES, RouteBranch } from './models';

// Runtime validation for everything that enters storage from outside (JSON import, backup
// restore). Every object is `.strict()`: unknown keys — e.g. "script", "onload" — are rejected.

/** Hosts a combo source link may point to (F09 whitelist); links open in a new tab only. */
export const SOURCE_URL_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.bilibili.com',
  'ygoprodeck.com',
  'www.masterduelmeta.com',
  'masterduelmeta.com',
  'www.db.yugioh-card.com',
];

// Card names legitimately contain "<P>", "<C>", "<Q>" (e.g. "Maliss <P> Dormouse"), so only
// markup that could execute or load something is rejected. All text is rendered as plain text.
const DANGEROUS_TAG = /<\s*\/?\s*(script|iframe|object|embed|svg|img|style|link|meta|base|form|input|button|textarea|a|html|body|head|math|template|frame|frameset|applet|video|audio|source)\b/i;
const TAG_WITH_ATTRIBUTES = /<\s*[a-z][\w-]*\s+[^>]*=/i;
const EVENT_HANDLER = /\bon[a-z]+\s*=/i;
const SCRIPT_SCHEME = /\b(?:javascript|vbscript|livescript)\s*:|data\s*:\s*text\/html/i;

export function markupProblem(text: string): string | null {
  if (DANGEROUS_TAG.test(text) || TAG_WITH_ATTRIBUTES.test(text)) return '不可包含 HTML 標籤';
  if (EVENT_HANDLER.test(text) || SCRIPT_SCHEME.test(text)) return '不可包含可執行的程式碼';
  return null;
}

const text = (max: number) =>
  z
    .string()
    .max(max, `長度不可超過 ${max} 字`)
    .superRefine((value, ctx) => {
      const problem = markupProblem(value);
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    });
const required = (max: number) => text(max).refine((v) => v.trim().length > 0, '必填');

export function sourceUrlProblem(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return '不是有效的網址';
  }
  if (parsed.protocol !== 'https:') return '只接受 https:// 網址';
  if (!SOURCE_URL_HOSTS.includes(parsed.hostname)) return `不在允許的來源網站清單內（${SOURCE_URL_HOSTS.join('、')}）`;
  return null;
}

const cardId = z.number().int('卡片 ID 必須是整數').positive('卡片 ID 必須大於 0').max(0xffffffff);
const count = z.number().int().min(1, '張數至少 1');
const isoDateTime = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), '日期格式不正確');
const id = z.string().min(1).max(100).regex(/^[\w-]+$/, 'ID 只能包含英數字、底線與連字號');

export const cardCountSchema = z.strictObject({ cardId, count });

export const deckSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id,
  name: required(80),
  format: z.literal('master-duel'),
  version: z.number().int().min(1),
  main: z.array(cardCountSchema).max(60),
  extra: z.array(cardCountSchema).max(60),
  side: z.array(cardCountSchema).max(60),
  source: z.strictObject({ type: z.enum(['manual', 'ydk', 'ydke', 'deck-code', 'url']), ref: text(300).optional() }).optional(),
  ftk: z.boolean().optional(),
  importWarnings: z.array(text(500)).max(200).optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const handClause = z.strictObject({ anyOf: z.array(cardId).min(1, '候選卡不可為空').max(30), count: z.number().int().min(1).max(6) });

const stepBase = {
  id,
  order: z.number().int().min(1),
  actionType: z.enum(ACTION_TYPES),
  actorCardIds: z.array(cardId).max(20),
  title: required(120),
  description: required(4000),
  fromZone: text(60).optional(),
  toZone: text(60).optional(),
  targetCardIds: z.array(cardId).max(20).optional(),
  materialCardIds: z.array(cardId).max(20).optional(),
  costText: text(1000).optional(),
  effectText: text(2000).optional(),
  resultText: text(1000).optional(),
  reason: text(1000).optional(),
  warning: text(1000).optional(),
  moves: z.array(z.strictObject({ cardId, from: z.enum(PLAY_ZONES), to: z.enum(PLAY_ZONES), slot: z.enum(FIELD_SLOTS).optional() })).max(40).optional(),
  effectRef: z.string().regex(/^\d{1,10}#\d{1,2}$/, '效果代號格式不正確').optional(),
  /** CR-008: why the step could not be worked out (non-empty = unfinished). */
  unresolved: text(500).optional(),
  /** B7 (schemaVersion 2): random result, branches and the author's own damage claim (never used). */
  random: z.strictObject({ count: z.number().int().min(1).max(10), to: z.enum(['hand', 'gy', 'banished']) }).optional(),
  claimedDamage: z.number().int().min(0).max(1_000_000).optional(),
};

/** Steps nest through `branches` (B7), so the schema is recursive; the depth and width are limited. */
const stepSchema: z.ZodType<ComboStep> = z.lazy(() => z.strictObject({ ...stepBase, branches: z.array(branchSchema).max(12).optional() })) as unknown as z.ZodType<ComboStep>;
const branchSchema: z.ZodType<RouteBranch> = z.lazy(() =>
  z.strictObject({
    id,
    label: required(120),
    when: z.array(handClause).min(1).max(6).nullable(),
    steps: z.array(stepSchema).max(100),
    outcome: z.enum(['success', 'fail']).optional(),
  }),
) as unknown as z.ZodType<RouteBranch>;

const fingerprint = z.string().regex(/^fp1-[0-9a-f]{14}$/, '牌表識別碼格式不正確');

/** CR-004: provenance of an AI route. Nothing here can raise a route's trust level. */
const analysisSchema = z.strictObject({
  origin: z.literal('ai'),
  runId: id,
  deckId: id,
  deckName: required(80),
  deckVersion: z.number().int().min(1),
  deckFingerprint: fingerprint,
  cardDataVersion: text(60),
  provider: z.enum(['anthropic', 'ollama', 'chatgpt']),
  model: required(100),
  servedModel: text(100).optional(),
  promptVersion: required(40),
  generatedAt: isoDateTime,
  starterCardIds: z.array(cardId).max(6),
  preconditions: z.array(text(500)).max(20),
  pros: z.array(text(500)).max(20),
  cons: z.array(text(500)).max(20),
  /** CR-008: who the starters are (only routes written in the 1–3 card format have it). */
  combo: z
    .strictObject({
      required: z.array(cardId).min(1).max(6),
      alternatives: z.array(z.strictObject({ cardId, instead: z.array(cardId).max(6), note: text(300).optional() })).max(10),
      extenders: z.array(cardId).max(10),
      avoidInHand: z.array(cardId).max(10),
    })
    .optional(),
  check: z.strictObject({ passed: z.boolean(), checkedAt: isoDateTime, deckFingerprint: fingerprint, problems: z.array(text(1000)).max(200) }),
});

export const comboSchema = z.strictObject({
  /** 1 = linear route; 2 (B7) = may have random steps, branches and `ftk`. Both are valid. */
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  id,
  version: z.number().int().min(1),
  name: required(120),
  archetype: required(60),
  format: z.literal('master-duel'),
  description: text(2000).optional(),
  conditions: z.strictObject({
    handAllOf: z.array(z.strictObject({ anyOf: z.array(cardId).min(1, '候選卡不可為空').max(30), count: z.number().int().min(1).max(6) })).min(1, '至少需要一個起手條件').max(6),
    unallocatedHandMin: z.number().int().min(0).max(6).optional(),
    mustRemainInMain: z.array(cardCountSchema).max(30).optional(),
    mustExistInExtra: z.array(cardCountSchema).max(30).optional(),
    forbiddenInHand: z.array(cardId).max(30).optional(),
    setup: z.strictObject({
      turnOrder: z.enum(['first', 'second', 'either']),
      emptyBoard: z.boolean(),
      normalSummonAvailable: z.boolean(),
      noInterruption: z.boolean(),
    }),
  }),
  steps: z.array(stepSchema).max(200),
  endBoard: z.array(z.strictObject({ cardId, zone: required(60), count, note: text(500).optional() })).max(30),
  ftk: z.strictObject({ targetDamage: z.number().int().min(1).max(100_000), opponentExtraDeck: z.number().int().min(0).max(15) }).optional(),
  rankingWeight: z.number().int().min(-1000).max(1000).optional(),
  notes: text(4000).optional(),
  source: z
    .strictObject({
      title: text(200).optional(),
      url: z
        .string()
        .max(500)
        .superRefine((value, ctx) => {
          const problem = sourceUrlProblem(value);
          if (problem) ctx.addIssue({ code: 'custom', message: problem });
        })
        .optional(),
      timeSeconds: z.number().int().min(0).max(86400).optional(),
    })
    .optional(),
  verification: z.strictObject({
    status: z.enum(['draft', 'unverified', 'verified', 'invalidated']),
    verifiedAt: text(40).optional(),
    deckFingerprint: text(40).optional(),
    verifiedBy: text(80).optional(),
    evidenceNote: text(2000).optional(),
  }),
  analysis: analysisSchema.optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const regionSchema = z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) });

export const layoutSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id,
  name: required(40),
  handSize: z.union([z.literal(5), z.literal(6)]),
  aspectRatio: z.number().positive().max(20),
  regions: z.array(regionSchema).max(6),
  createdAt: isoDateTime,
});

/** User annotations on a card (zh-TW name, aliases, Master Duel ban mark). */
export const cardNoteSchema = z.strictObject({
  cardId,
  nameZhTw: text(80).optional(),
  aliases: z.array(text(40)).max(20).optional(),
  mdBan: z.enum(['Forbidden', 'Limited', 'Semi-Limited']).optional(),
});

/** Human-readable messages: "path: message". */
export function issues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.length ? `${i.path.join('.')}：` : ''}${i.message}`);
}
