import { cardRule, isLinkCard } from '../card-rules';
import { CardRecord, DeckRecord } from '../models';
import { AnalysisGoal, DEFAULT_GOAL, GOAL_PROMPT, goalForDeck } from './analysis-goal';

// CR-004: the only data sent to a model is the deck list and the public card data below.
// CR-006 (v2): Link arrows, type tags and effect references are added, plus the board layout,
// the end-board rules and the analysis goal.

export const PROMPT_VERSION = 'deck-analysis-v2';

/** Master Duel environment and rule assumptions recorded with every analysis (G22-6). */
export const MD_ASSUMPTIONS: readonly string[] = [
  'Yu-Gi-Oh! MASTER DUEL 當期規則（2020 年 4 月修訂的大師規則：額外牌組怪獸除連結怪獸與從額外牌組特殊召喚的靈擺怪獸外，可直接召喚到主要怪獸區）',
  '先攻第 1 回合：起手 5 張、不抽牌、不能攻擊',
  '雙方場上為空；假設對手不發動任何效果（無干擾）',
  '每回合 1 次通常召喚（卡片效果另外給予者除外）',
  '只使用此牌組的主牌組與額外牌組；備牌不使用',
];

export interface AnalysisScope {
  single: boolean;
  multi: boolean;
  /** CR-008: three-card starters (absent = off, so older settings and prompts are unchanged). */
  triple?: boolean;
  extenders: boolean;
  /** Routes shown (CR-006: display only). */
  maxRoutes: number;
  /** Routes the model is asked to write out (CR-006); older records do not have it. */
  candidates?: number;
}

/** How many routes the model is asked for. */
export const generatedRoutes = (scope: AnalysisScope) => scope.candidates ?? scope.maxRoutes;

/** Deck cards whose effect text is not in the local card data (the model would have to guess). */
export function cardsWithoutText(deck: Pick<DeckRecord, 'main' | 'extra'>, cards: ReadonlyMap<number, CardRecord>): number[] {
  return [...deck.main, ...deck.extra].map((r) => r.cardId).filter((id) => !cards.get(id)?.desc?.trim());
}

/** Deck Link Monsters without arrows (card data synced before CR-006): zones cannot be planned or checked. */
export function linkCardsWithoutArrows(deck: Pick<DeckRecord, 'main' | 'extra'>, cards: ReadonlyMap<number, CardRecord>): number[] {
  return [...deck.main, ...deck.extra].map((r) => r.cardId).filter((id) => {
    const card = cards.get(id);
    return !!card && isLinkCard(card) && !card.linkMarkers?.length;
  });
}

const SYSTEM = `You are an expert Yu-Gi-Oh! MASTER DUEL combo analyst. You propose CANDIDATE combo routes for the exact deck list provided by the user.
A separate program checks every route against the deck list card by card and against part of the rules, and a human tests the routes in MASTER DUEL. Never claim that a route is legal, verified or tested.

Rules for every route:
- Use only cards from the deck list, referring to them by their numeric "id". Never invent cards or ids. Never use more copies of a card than the deck has. Side Deck cards are not available.
- Situation: you go first, turn 1, 5-card opening hand, no draw, both fields are empty, and the opponent never responds or interrupts. Use current MASTER DUEL rules (Master Rule, April 2020 revision). One Normal Summon per turn unless a card grants more. Respect every card's once-per-turn clauses, summoning conditions, Link Material requirements and summoning restrictions exactly as written in its text.
- handCardIds: the exact opening-hand cards the route needs (at most 5; repeat an id for multiple copies). starterCardIds: the cards in handCardIds that start the combo.
- requiredInMain: cards the route takes from the Main Deck (searched, sent, summoned or otherwise used from the deck) with how many copies must still be in the deck. requiredInExtra: Extra Deck monsters the route summons.
- steps, in order: actionType, actorCardIds (the card that performs the action or whose effect is used), targetCardIds, materialCardIds, cost, effect, result.
- moves: list EVERY card that changes place in the step, one entry per copy, with zones deck, hand, extra, field, gy, banished, overlay (attached as Xyz Material). Costs, materials, searched cards, summoned monsters and Spells/Traps that go to the GY after resolving must all appear as moves. Cards drawn by an effect are random: do not add them as moves and never use them later.
- effectRef: for a step that uses a card effect, the reference listed in that card's "effects" (format "<id>#<n>"); use "" for Normal Summons, Link Summons and other game actions, or when the card lists no references.
- If you are not sure about a card's exact effect or a ruling, say so in that step's "uncertainty" (otherwise use an empty string). Do not hide uncertainty.
- endBoard: the cards on the field at the end (and any relevant cards left in hand, GY or banished), with zone and count. It must match the moves.
- pros: strengths (interruptions, resilience, follow-up). cons: weaknesses (choke points, cards it needs, what breaks it).
- starters: single-card starters (kind "single") and two-card starters (kind "multi") found in this deck. extenders: cards that extend a combo, with what they require.
- Write all descriptive text (summary, route names, titles, descriptions, notes, preconditions, pros, cons) in Traditional Chinese as used in Taiwan. Keep card names in English exactly as in the deck list. Keep texts short: a title of at most 20 characters, a description of at most 2 sentences.

Board and Link arrows:
- Your Monster Zones are the Extra Monster Zones "EMZ-L" (above M2) and "EMZ-R" (above M4) and the Main Monster Zones "M1" to "M5" from left to right. Spell & Trap Zones are "S1" to "S5"; the Field Zone is "FZ".
- A Link Monster's "arrows" point to the zone in that direction: from EMZ-L, Bottom-Left/Bottom/Bottom-Right point to M1/M2/M3; from M2, Top points to EMZ-L; Left/Right point to the neighbouring Main Monster Zone. Two Link Monsters are co-linked when each points to the other.
- A monster Special Summoned from the Extra Deck must go to an Extra Monster Zone (you may use only one, unless the other one is pointed to by your Link Monster) or to a Main Monster Zone that a Link Monster you control points to. Other monsters go to Main Monster Zones only. Materials leave the field before the new monster is placed.
- In every move to or from the field, set "slot" to the exact zone; use "" only for moves that do not involve the field.

Goal and end board:
- The end board is ONLY what is on the field when the turn ends (plus Set Spells/Traps). Monsters used as material or sent away during the route are not part of the end board.
- Judge end boards by interruptions that really work on the opponent's turn and by resources kept, not by ATK or Link Rating. An interruption only counts if its condition is met on the final board (for example Allied Code Talker @Ignister needs one of your Link Monsters in a zone it points to; Firewall Dragon returns at most as many cards as monsters co-linked to it; Maliss <Q> Hearts Crypter needs one of your banished "Maliss" cards to target).
- Consider every Extra Deck monster in the list, including generic monsters that are not part of the deck's archetype (for example generic Cyberse Link Monsters). Do not limit yourself to the archetype's Extra Deck monsters.
- Return routes with clearly different end boards. Variants of one line are welcome when they make different trade-offs (for example keeping a monster on the final board versus using it only as material).
- explored: every distinct line you considered, also those you did not write out as a route, with the Extra Deck monsters it uses and its final board; "routeName" is the name of the route that writes it out, or "". If you could not find a line that reaches a preferred monster, say so in "note". Never claim a line works if you did not write it out.
Respond only with JSON that matches the provided schema.`;

/** The shared rules of every route (CR-008 builds the phased prompts on it). */
export const SYSTEM_PROMPT = SYSTEM;

/** One line of the deck list: the card's data as sent to the model (every card, with its full text). */
export function cardLine(cards: ReadonlyMap<number, CardRecord>, zone: 'main' | 'extra', cardId: number, copies: number): string {
  const c = cards.get(cardId);
  const effects = cardRule(cardId, cards)?.effects.map((e) => `${e.ref}: ${e.summary}`);
  return JSON.stringify({
    id: cardId,
    name: c?.nameEn,
    copies,
    deck: zone,
    type: c?.typeLine,
    typeTags: c?.typeTags,
    attribute: c?.attribute,
    race: c?.race,
    level: c?.level,
    link: c?.linkval,
    arrows: c?.linkMarkers,
    atk: c?.atk,
    def: c?.def,
    text: c?.desc,
    effects,
  });
}

/** "Name (id n)" as used in the prompts. */
export const namedCard = (cards: ReadonlyMap<number, CardRecord>, id: number) => `${cards.get(id)?.nameEn ?? `ID ${id}`} (id ${id})`;

/** The goal and preferred-monster lines of a prompt (same wording in the one-shot and phased prompts). */
export function goalLines(deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, goal: AnalysisGoal): string[] {
  const forDeck = goalForDeck(goal, deck);
  return [
    `Analysis goal: ${GOAL_PROMPT[forDeck.kind]}.`,
    forDeck.preferredExtraIds.length
      ? `Preferred Extra Deck monsters (a preference, not a requirement): ${forDeck.preferredExtraIds.map((id) => namedCard(cards, id)).join('; ')}. Where the rules and the deck's resources allow it, include routes that end with each of them on the field, and variants that use them only on the way; if you find no such line, do not invent one — say so in "explored".`
      : '',
  ];
}

export function buildPrompt(deck: DeckRecord, cards: ReadonlyMap<number, CardRecord>, scope: AnalysisScope, goal: AnalysisGoal = DEFAULT_GOAL): { system: string; user: string } {
  const wanted = [scope.single && 'single-card starters', scope.multi && 'two-card starters', scope.triple && 'three-card starters', scope.extenders && 'common extenders'].filter(Boolean).join(', ');
  const count = (rows: DeckRecord['main']) => rows.reduce((s, r) => s + r.count, 0);
  const user = [
    `Deck: ${deck.name} (Main Deck ${count(deck.main)} cards, Extra Deck ${count(deck.extra)} cards; ${deck.main.length + deck.extra.length} distinct cards, all listed below).`,
    `Analysis scope: ${wanted}. Return at most ${generatedRoutes(scope)} routes, ordered by the goal.`,
    scope.single ? '' : 'Do not include routes that start from a single card.',
    scope.multi ? '' : scope.triple ? 'Do not include routes that need exactly two starter cards.' : 'Do not include routes that need two or more starter cards.',
    scope.extenders ? '' : 'Leave "extenders" empty.',
    ...goalLines(deck, cards, goal),
    'Deck list (one JSON object per distinct card):',
    ...deck.main.map((r) => cardLine(cards, 'main', r.cardId, r.count)),
    ...deck.extra.map((r) => cardLine(cards, 'extra', r.cardId, r.count)),
  ]
    .filter(Boolean)
    .join('\n');
  return { system: SYSTEM, user };
}
