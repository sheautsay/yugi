// Normative data model — spec §4 and rev1 R9. Card IDs are numeric passcodes everywhere.

export type CardKind = 'monster' | 'spell' | 'trap' | 'unknown';

export interface CardRecord {
  cardId: number;
  nameEn: string;
  nameZhTw?: string;
  aliases?: string[];
  kind: CardKind;
  /** Display/validation only — never used to rewrite the imported deck zone. */
  isExtraDeckType?: boolean;
  /** Upstream frame type (e.g. "effect", "effect_pendulum"); used to locate the artwork box. */
  frameType?: string;
  imageCacheKey?: string;
  source: string;
  updatedAt: string;

  // Full card data (rev2 sync) — all optional so older records stay valid.
  /** Upstream card type, e.g. "Effect Monster", "Spell Card". */
  typeLine?: string;
  /** Monster type (e.g. "Spellcaster") or spell/trap kind (e.g. "Quick-Play"). */
  race?: string;
  attribute?: string;
  /** Level or rank. */
  level?: number;
  linkval?: number;
  atk?: number;
  def?: number;
  archetype?: string;
  /** English card text as provided by the source. */
  desc?: string;
  /** Formats the source lists the card in, e.g. "Master Duel", "TCG". */
  formats?: string[];
  /** Reference ban status from the source (no Master Duel list is published there). */
  banlist?: { tcg?: string; ocg?: string };
  /** Link arrows of a Link Monster (CR-006), as the source lists them. */
  linkMarkers?: LinkMarker[];
  /** Upstream type tags, e.g. ["Cyberse", "Link", "Effect"] (CR-006: "Effect Monster" checks). */
  typeTags?: string[];

  // User annotations — never produced by the program, kept across syncs.
  /** Master Duel ban status marked by the user. */
  mdBan?: MdBan;
}

export type MdBan = 'Forbidden' | 'Limited' | 'Semi-Limited';

export const LINK_MARKERS = ['Top-Left', 'Top', 'Top-Right', 'Left', 'Right', 'Bottom-Left', 'Bottom', 'Bottom-Right'] as const;

export type LinkMarker = (typeof LINK_MARKERS)[number];

/**
 * Zones on your side of the field (CR-006). "EMZ-L" is above M2 and "EMZ-R" above M4; M1–M5 and
 * S1–S5 run left to right; "FZ" is the Field Zone.
 */
export const FIELD_SLOTS = ['EMZ-L', 'EMZ-R', 'M1', 'M2', 'M3', 'M4', 'M5', 'S1', 'S2', 'S3', 'S4', 'S5', 'FZ'] as const;

export type FieldSlot = (typeof FIELD_SLOTS)[number];

/** Card data scope: Master Duel pool (default) or every card. */
export type CardPool = 'master-duel' | 'all';

export interface CardCount {
  cardId: number;
  count: number;
}

export type DeckZone = 'main' | 'extra' | 'side';

export type DeckSourceType = 'manual' | 'ydk' | 'ydke' | 'deck-code' | 'url';

export interface DeckRecord {
  schemaVersion: 1;
  id: string;
  name: string;
  format: 'master-duel';
  version: number;
  main: CardCount[];
  extra: CardCount[];
  side: CardCount[];
  source?: { type: DeckSourceType; ref?: string };
  importWarnings?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface HandClause {
  /** OR: candidate card IDs, non-empty. */
  anyOf: number[];
  /** Total cards needed from the candidates. */
  count: number;
}

export interface RequiredCard {
  cardId: number;
  count: number;
}

export type TurnOrder = 'first' | 'second';

export interface RouteSetup {
  turnOrder: TurnOrder | 'either';
  emptyBoard: boolean;
  normalSummonAvailable: boolean;
  noInterruption: boolean;
}

export interface RouteConditions {
  /** AND: every clause must hold, sharing one allocation of hand cards. */
  handAllOf: HandClause[];
  /** Cards that must remain in hand after the allocation above (free costs). */
  unallocatedHandMin?: number;
  mustRemainInMain?: RequiredCard[];
  mustExistInExtra?: RequiredCard[];
  forbiddenInHand?: number[];
  setup: RouteSetup;
}

export type RouteVerification = 'draft' | 'unverified' | 'verified' | 'invalidated';

export const ACTION_TYPES = [
  'normal-summon',
  'special-summon',
  'link-summon',
  'synchro-summon',
  'xyz-summon',
  'fusion-summon',
  'ritual-summon',
  'activate',
  'set',
  'search',
  'send-to-gy',
  'banish',
  'add-to-hand',
  'select-material',
  'other',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** Where a card is during a combo (CR-004 data check). "overlay" = attached as Xyz material. */
export const PLAY_ZONES = ['deck', 'hand', 'extra', 'field', 'gy', 'banished', 'overlay'] as const;

export type PlayZone = (typeof PLAY_ZONES)[number];

/** One card changing place in a step (CR-004, optional). */
export interface CardMove {
  cardId: number;
  from: PlayZone;
  to: PlayZone;
  /** The zone at the field end of the move (CR-006, optional): needed for Link arrow checks. */
  slot?: FieldSlot;
}

export interface ComboStep {
  id: string;
  order: number;
  actionType: ActionType;
  actorCardIds: number[];
  title: string;
  description: string;
  fromZone?: string;
  toZone?: string;
  targetCardIds?: number[];
  materialCardIds?: number[];
  costText?: string;
  effectText?: string;
  resultText?: string;
  reason?: string;
  warning?: string;
  /** Every card that changes place in this step, in order (CR-004). */
  moves?: CardMove[];
  /** The card effect used in this step, "<cardId>#<n>" from the rule table (CR-006, optional). */
  effectRef?: string;
  /** CR-008: the model could not work this step out (non-empty = unfinished; the route cannot pass the data check). */
  unresolved?: string;
}

export interface EndBoardEntry {
  cardId: number;
  zone: string;
  count: number;
  note?: string;
}

export interface RouteVerificationInfo {
  status: RouteVerification;
  verifiedAt?: string;
  deckFingerprint?: string;
  verifiedBy?: string;
  evidenceNote?: string;
}

export interface ComboRoute {
  schemaVersion: 1;
  id: string;
  version: number;
  name: string;
  archetype: string;
  format: 'master-duel';
  description?: string;
  conditions: RouteConditions;
  steps: ComboStep[];
  endBoard: EndBoardEntry[];
  rankingWeight?: number;
  notes?: string;
  source?: { title?: string; url?: string; timeSeconds?: number };
  verification: RouteVerificationInfo;
  /** Present only on routes produced by the AI deck analysis (CR-004). */
  analysis?: RouteAnalysisInfo;
  createdAt: string;
  updatedAt: string;
}

/** Stored snapshot of the last local data check; the displayed level is always recomputed. */
export interface RouteCheckRecord {
  passed: boolean;
  checkedAt: string;
  deckFingerprint: string;
  problems: string[];
}

/** Provenance of an AI-generated route (CR-004). Never makes a route "verified". */
export interface RouteAnalysisInfo {
  origin: 'ai';
  runId: string;
  deckId: string;
  deckName: string;
  deckVersion: number;
  deckFingerprint: string;
  cardDataVersion: string;
  provider: AiProviderId;
  model: string;
  servedModel?: string;
  promptVersion: string;
  generatedAt: string;
  starterCardIds: number[];
  preconditions: string[];
  pros: string[];
  cons: string[];
  /** CR-008: the starter roles of a route written in the 1–3 card format. */
  combo?: ComboInfo;
  check: RouteCheckRecord;
}

/** CR-008: the roles of the cards in the opening hand and the Deck for one route. */
export interface ComboInfo {
  /** The REQUIRED starter cards (1–3; repeat an id for copies). Every one must take part in the route. */
  required: number[];
  /** Cards that could stand in for a required card (labelled by the model, not verified). */
  alternatives: Array<{ cardId: number; instead: number[]; note?: string }>;
  /** Extra or extender cards that make the route better but are not required. */
  extenders: number[];
  /** Components the route fetches from the Deck itself; having them in hand would change the route. */
  avoidInHand: number[];
}

export type AiProviderId = 'anthropic' | 'ollama' | 'chatgpt';

/**
 * CR-004 trust levels, lowest to highest. "engine-verified" is defined but nothing can set it
 * (rules engine BLOCKED); "md-confirmed" is the existing human "verified" with evidence.
 */
export type AnalysisLevel = 'ai-candidate' | 'data-checked' | 'engine-verified' | 'md-confirmed';

export type MatchKind = 'available' | 'unavailable' | 'unverified' | 'unknown';

export type MatchReasonCode =
  | 'HAND_MISSING'
  | 'HAND_COST_MISSING'
  | 'REMAINING_DECK_MISSING'
  | 'EXTRA_MISSING'
  | 'FORBIDDEN_IN_HAND'
  | 'CONTEXT_MISMATCH'
  | 'UNVERIFIED'
  | 'INVALID_ROUTE'
  | 'MISSING_CARD_DATA'
  | 'DECK_MISMATCH';

export interface RouteMatch {
  routeId: string;
  kind: MatchKind;
  matchedHandAllocation?: Array<{ clauseIndex: number; cardIds: number[] }>;
  reasons: Array<{ code: MatchReasonCode; textZhTw: string }>;
}

/** rev1 R3: hand size follows turn order — first 5, second 6. */
export type HandSize = 5 | 6;

export const HAND_SIZE: Record<TurnOrder, HandSize> = { first: 5, second: 6 };

/** Relative (0..1) rectangle on a screenshot. */
export interface HandRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type RecognitionStatus = 'confident' | 'uncertain' | 'unrecognized' | 'user-selected';

/** UI state only — never persisted (rev1 R5). */
export interface HandRecognitionSlot {
  index: number;
  region: HandRegion;
  candidates: Array<{ cardId: number; score: number }>;
  chosenCardId?: number;
  status: RecognitionStatus;
}

export interface HandLayoutPreset {
  schemaVersion: 1;
  id: string;
  name: string;
  handSize: HandSize;
  aspectRatio: number;
  regions: HandRegion[];
  createdAt: string;
}
