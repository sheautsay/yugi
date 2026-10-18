import { CardRecord, FieldSlot, LinkMarker } from './models';

// CR-006: the partial rule table used by the rule check (route-check.ts) and the end-board
// evaluation (ai/evaluate.ts). It is written from the cards' English texts for the analysed Maliss
// deck and is NOT a rules engine: it can show that a route breaks a modelled rule, never that a
// route is legal. A card's entry only applies while its current text still contains `guard`.

export type OncePerTurn = 'effect' | 'name' | 'face-up' | 'none';
export type SummonLock = 'no-special-summon' | 'cyberse-only' | 'extra-link-only';
/** Where the card must be when the effect is activated. */
export type EffectZone = 'field' | 'hand' | 'gy' | 'banished' | 'field-or-gy';

export interface EffectRule {
  /** "<cardId>#<n>": the n-th effect of the card in reading order. */
  ref: string;
  /** Short English summary sent to the model next to the full card text. */
  summary: string;
  zone: EffectZone;
  once: OncePerTurn;
  lock?: SummonLock;
  /** The lock covers the whole turn, also Summons made before the effect (Transcode Talker). */
  lockWholeTurn?: boolean;
  /** Monsters Special Summoned by this effect must go to zones this card points to. */
  placeInPointedZones?: boolean;
  requires?: 'cyberse-from-extra' | 'material-for-cyberse-link-2300' | 'link-summoned' | 'summon-to-pointed-zone';
  /** Monsters Special Summoned by this effect have their effects negated (Splash Mage). */
  summonedNegated?: boolean;
  /** Monsters Special Summoned by this effect cannot activate effects this turn (TB-11). */
  summonedCannotActivate?: boolean;
  /** Targets returned to the hand may not exceed the monsters co-linked to this card (Firewall Dragon). */
  returnsUpToCoLinked?: boolean;
}

/** What a card on the final board does on the opponent's turn (end-board evaluation). */
export interface BoardRole {
  kind: 'negate' | 'banish' | 'bounce' | 'trap-negate' | 'set-trap-banish' | 'extension' | 'protection';
  label: string;
  /** Effect that provides it; if it was used while the card stayed face-up and is "face-up" once, it is spent. */
  ref?: string;
  needs?: 'pointed-link' | 'co-linked' | 'banished-maliss' | 'opponent-face-up' | 'maliss-cost-and-link' | 'opponent-trap';
}

export interface CardRule {
  cardId: number;
  name: string;
  guard: string;
  effects: EffectRule[];
  board?: BoardRole[];
}

const e = (cardId: number, n: number, zone: EffectZone, once: OncePerTurn, summary: string, extra: Partial<EffectRule> = {}): EffectRule => ({ ref: `${cardId}#${n}`, zone, once, summary, ...extra });

const BANISHED_SS = 'If banished: pay 300 LP; Special Summon it (for the rest of the turn only Link Monsters can be Special Summoned from the Extra Deck)';

export const CARD_RULES: readonly CardRule[] = [
  {
    cardId: 32061192,
    name: 'Maliss <P> Dormouse',
    guard: 'banish 1 "Maliss" monster from your Deck, also for the rest of this turn',
    effects: [
      e(32061192, 1, 'field', 'effect', 'Main Phase, on the field: banish 1 "Maliss" monster from your Deck; "Maliss" monsters gain 600 ATK this turn'),
      e(32061192, 2, 'banished', 'effect', BANISHED_SS, { lock: 'extra-link-only' }),
    ],
    board: [{ kind: 'protection', label: '指向它的 Maliss 連結怪獸不會被效果破壞' }],
  },
  {
    cardId: 69272449,
    name: 'Maliss <P> White Rabbit',
    guard: 'Set 1 "Maliss" Trap from your Deck with a different name than the cards in your GY',
    effects: [
      e(69272449, 1, 'field', 'effect', 'If Normal or Special Summoned: Set 1 "Maliss" Trap from your Deck with a different name than the cards in your GY'),
      e(69272449, 2, 'banished', 'effect', BANISHED_SS, { lock: 'extra-link-only' }),
    ],
    board: [{ kind: 'protection', label: '指向它的 Maliss 連結怪獸戰鬥不受傷害' }],
  },
  {
    cardId: 96676583,
    name: 'Maliss <P> Chessy Cat',
    guard: 'banish 1 "Maliss" card from your hand, then you can draw 2 cards',
    effects: [
      e(96676583, 1, 'field', 'effect', 'Main Phase, on the field: banish 1 "Maliss" card from your hand, then you can draw 2 cards'),
      e(96676583, 2, 'banished', 'effect', BANISHED_SS, { lock: 'extra-link-only' }),
    ],
  },
  {
    cardId: 20938824,
    name: 'Maliss <P> March Hare',
    guard: 'banish 1 other "Maliss" card from your hand or GY, and if you do, Special Summon this card',
    effects: [
      e(20938824, 1, 'hand', 'effect', 'Main Phase, in hand (Quick Effect): banish 1 other "Maliss" card from your hand or GY; Special Summon this card'),
      e(20938824, 2, 'banished', 'effect', 'If banished: pay 300 LP, target 1 of your banished "Maliss" monsters; add it to your hand'),
    ],
    board: [{ kind: 'protection', label: '指向它的 Maliss 連結怪獸不能被對手效果指定' }],
  },
  {
    cardId: 68337209,
    name: 'Maliss in Underground',
    guard: 'While 3 or more of your "Maliss" Traps with different names are banished',
    effects: [e(68337209, 1, 'hand', 'name', 'Activation: you can banish 1 "Maliss" card from your hand, Deck or GY')],
    board: [{ kind: 'protection', label: '控制 Maliss 連結怪獸時，對手只能攻擊 Maliss 連結怪獸' }],
  },
  {
    cardId: 20726052,
    name: 'Maliss <C> GWC-06',
    guard: 'Special Summon 1 of your "Maliss" monsters that is banished or in your GY',
    effects: [e(20726052, 1, 'field', 'name', 'Activate (also the turn it was Set, by banishing 1 face-up "Maliss" monster you control): Special Summon 1 of your banished or GY "Maliss" monsters')],
    board: [{ kind: 'extension', label: '對手回合可特殊召喚除外或墓地的 Maliss 怪獸' }],
  },
  {
    cardId: 94722358,
    name: 'Maliss <C> MTP-07',
    guard: 'Add 1 "Maliss" monster from your Deck to your hand, then if you control a "Maliss" Link Monster, you can banish 1 card on the field',
    effects: [e(94722358, 1, 'field', 'name', 'Activate (also the turn it was Set, by banishing 1 face-up "Maliss" monster you control): add 1 "Maliss" monster from your Deck to your hand, then if you control a "Maliss" Link Monster you can banish 1 card on the field')],
    board: [{ kind: 'set-trap-banish', label: '蓋放：除外場上 1 張卡', ref: '94722358#1', needs: 'maliss-cost-and-link' }],
  },
  {
    cardId: 57111661,
    name: 'Maliss <C> TB-11',
    guard: 'Special Summon 1 "Maliss" monster from your Deck, or if your opponent controls 3 or more cards',
    effects: [
      e(57111661, 1, 'field', 'name', 'Activate (also the turn it was Set, by banishing 1 face-up "Maliss" monster you control): Special Summon 1 "Maliss" monster from your Deck; it cannot attack and its effects cannot be activated this turn', {
        summonedCannotActivate: true,
      }),
    ],
    board: [{ kind: 'extension', label: '對手回合可從牌組特殊召喚 Maliss 怪獸' }],
  },
  {
    cardId: 95454996,
    name: 'Maliss <Q> White Binder',
    guard: 'You can target up to 3 cards in any GY(s); banish them',
    effects: [
      e(95454996, 1, 'field', 'effect', 'If Special Summoned: target up to 3 cards in any GY(s); banish them'),
      e(95454996, 2, 'field', 'effect', 'Main Phase: Set 1 "Maliss" Trap from your Deck or GY'),
      e(95454996, 3, 'banished', 'effect', 'If banished: pay 900 LP; Special Summon it, then you can draw 1 card'),
    ],
    board: [{ kind: 'extension', label: '被除外時可支付 900 LP 特殊召喚' }],
  },
  {
    cardId: 21848500,
    name: 'Maliss <Q> Hearts Crypter',
    guard: 'shuffle it into the Deck, and if you do, banish 1 card on the field',
    effects: [
      e(21848500, 1, 'field', 'effect', '(Quick Effect): target 1 of your banished "Maliss" cards; shuffle it into the Deck, then banish 1 card on the field'),
      e(21848500, 2, 'banished', 'effect', 'If banished: pay 900 LP; Special Summon it and double its ATK'),
    ],
    board: [{ kind: 'banish', label: '對手回合除外場上 1 張卡', ref: '21848500#1', needs: 'banished-maliss' }],
  },
  {
    cardId: 30118811,
    name: 'Backup @Ignister',
    guard: 'add 1 DARK Cyberse monster from your Deck to your hand, except "Backup @Ignister", then discard 1 card',
    effects: [
      e(30118811, 1, 'hand', 'effect', 'If you control a Cyberse monster Special Summoned from the Extra Deck: Special Summon this card from your hand', { requires: 'cyberse-from-extra' }),
      e(30118811, 2, 'field', 'effect', 'If Normal or Special Summoned: add 1 DARK Cyberse monster (not "Backup @Ignister") from your Deck to your hand, then discard 1 card'),
    ],
  },
  {
    cardId: 3723262,
    name: 'Wizard @Ignister',
    guard: 'Special Summon both this card in your hand and that monster, in Defense Position',
    effects: [
      e(3723262, 1, 'hand', 'effect', 'If you control a Cyberse monster Special Summoned from the Extra Deck: target 1 DARK Cyberse monster in your GY; Special Summon it and this card from your hand in Defense Position (only Cyberse Special Summons for the rest of the turn)', {
        requires: 'cyberse-from-extra',
        lock: 'cyberse-only',
      }),
      e(3723262, 2, 'field-or-gy', 'effect', 'Banish this card from your field or GY, target 1 monster your opponent controls; change its battle position'),
    ],
  },
  {
    cardId: 30342076,
    name: 'Link Decoder',
    guard: 'If this card is sent to the GY as material for a Cyberse Link Monster with 2300 or more original ATK',
    effects: [e(30342076, 1, 'gy', 'effect', 'If sent to the GY as material for a Cyberse Link Monster with 2300+ original ATK: Special Summon this card (banish it when it leaves the field)', { requires: 'material-for-cyberse-link-2300' })],
  },
  {
    cardId: 24842059,
    name: 'Linguriboh',
    guard: 'When your opponent activates a Trap Card (Quick Effect): You can Tribute this card',
    effects: [
      e(24842059, 1, 'field', 'effect', 'When your opponent activates a Trap Card (Quick Effect): Tribute this card; negate that effect and banish the card'),
      e(24842059, 2, 'gy', 'effect', 'In the GY (Quick Effect): Tribute 1 "@Ignister" monster Summoned from the Extra Deck; Special Summon this card'),
    ],
    board: [{ kind: 'trap-negate', label: '只能無效對手的陷阱卡', ref: '24842059#1', needs: 'opponent-trap' }],
  },
  {
    cardId: 60303245,
    name: 'Salamangreat Almiraj',
    guard: "Tribute this card, then target 1 monster you control; it cannot be destroyed by your opponent's card effects this turn",
    effects: [
      e(60303245, 1, 'field', 'none', "(Quick Effect): Tribute this card, then target 1 monster you control; it cannot be destroyed by your opponent's card effects this turn"),
      e(60303245, 2, 'gy', 'effect', 'When a Normal Summoned monster you control is destroyed by battle, while in the GY: Special Summon this card'),
    ],
    board: [{ kind: 'protection', label: '可解放自身保護 1 隻怪獸不被對手效果破壞' }],
  },
  {
    cardId: 52698008,
    name: 'Cyberse Wicckid',
    guard: 'add 1 Cyberse Tuner from your Deck to your hand',
    effects: [e(52698008, 1, 'field', 'effect', 'If a monster is Special Summoned to a zone this card points to: banish 1 Cyberse monster from your GY; add 1 Cyberse Tuner from your Deck to your hand', { requires: 'summon-to-pointed-zone' })],
    board: [{ kind: 'protection', label: '它指向的電子界族怪獸不會被效果破壞' }],
  },
  {
    cardId: 59859086,
    name: 'Splash Mage',
    guard: 'Special Summon it in Defense Position, but negate its effects',
    effects: [e(59859086, 1, 'field', 'effect', 'Target 1 Cyberse monster in your GY; Special Summon it in Defense Position with its effects negated (only Cyberse Special Summons for the rest of the turn)', { lock: 'cyberse-only', summonedNegated: true })],
  },
  {
    cardId: 46947713,
    name: 'Transcode Talker',
    guard: 'Special Summon it to your zone this card points to',
    effects: [
      e(46947713, 1, 'field', 'effect', 'Target 1 Link-3 or lower Cyberse Link Monster in your GY, except "Transcode Talker"; Special Summon it to a zone this card points to (no non-Cyberse Special Summons this turn, also before it)', {
        lock: 'cyberse-only',
        lockWholeTurn: true,
        placeInPointedZones: true,
      }),
    ],
    board: [{ kind: 'protection', label: '相互連結時它與相互連結的怪獸不能被對手效果指定' }],
  },
  {
    cardId: 5043010,
    name: 'Firewall Dragon',
    guard: 'up to the number of monsters co-linked to this card; return them to the hand',
    effects: [
      e(5043010, 1, 'field', 'face-up', 'Once while face-up (Quick Effect): target monsters on the field and/or in the GY up to the number of monsters co-linked to this card; return them to the hand', { returnsUpToCoLinked: true }),
      e(5043010, 2, 'field', 'effect', 'If a monster this card points to is destroyed by battle or sent to the GY: Special Summon 1 Cyberse monster from your hand'),
    ],
    board: [{ kind: 'bounce', label: '對手回合返回卡片到手牌', ref: '5043010#1', needs: 'co-linked' }],
  },
  {
    cardId: 86066372,
    name: 'Accesscode Talker',
    guard: 'destroy 1 card your opponent controls, also for the rest of this turn',
    effects: [
      e(86066372, 1, 'field', 'none', 'If Link Summoned: target 1 Link Monster used as its material; it gains ATK'),
      e(86066372, 2, 'field', 'none', 'Banish 1 Link Monster from your field or GY; destroy 1 card your opponent controls (once per Attribute per turn)'),
    ],
  },
  {
    cardId: 39138610,
    name: 'Allied Code Talker @Ignister',
    guard: 'You can Tribute 1 of your Link Monsters this card points to; negate the activation',
    effects: [
      e(39138610, 1, 'field', 'none', 'If Link Summoned: Special Summon as many Cyberse monsters with 2300 ATK from your GY as possible to zones this card points to (no more Special Summons this turn)', {
        requires: 'link-summoned',
        placeInPointedZones: true,
        lock: 'no-special-summon',
      }),
      e(39138610, 2, 'field', 'effect', 'When your opponent activates a card or effect (Quick Effect): Tribute 1 of your Link Monsters this card points to; negate the activation and banish that card'),
    ],
    board: [{ kind: 'negate', label: '無效對手 1 次發動', ref: '39138610#2', needs: 'pointed-link' }],
  },
  {
    cardId: 29301450,
    name: 'S:P Little Knight',
    guard: 'You can target 2 face-up monsters on the field, including a monster you control; banish both until the End Phase',
    effects: [
      e(29301450, 1, 'field', 'effect', 'If Link Summoned using a Fusion, Synchro, Xyz or Link Monster: target 1 card on the field or in either GY; banish it'),
      e(29301450, 2, 'field', 'effect', 'When your opponent activates a card or effect (Quick Effect): target 2 face-up monsters including one you control; banish both until the End Phase'),
    ],
    board: [{ kind: 'banish', label: '對手回合暫時除外 2 隻表側怪獸', ref: '29301450#2', needs: 'opponent-face-up' }],
  },
  {
    cardId: 58699500,
    name: 'Cherubini, Ebon Angel of the Burning Abyss',
    guard: 'You can send 1 Level 3 monster from your Deck to the GY',
    effects: [e(58699500, 1, 'field', 'effect', 'Send 1 Level 3 monster from your Deck to the GY, then target 1 "Burning Abyss" monster on the field; it gains that ATK/DEF')],
    board: [{ kind: 'protection', label: '它指向的怪獸不會被效果破壞' }],
  },
  {
    cardId: 9763474,
    name: 'Haggard Lizardose',
    guard: 'make its ATK become equal to the original ATK of the monster banished to activate this effect',
    effects: [e(9763474, 1, 'field', 'effect', 'Banish 1 monster with 2000 or less ATK from your field or GY, target 1 face-up monster; its ATK becomes that original ATK')],
  },
  {
    cardId: 75500286,
    name: 'Gold Sarcophagus',
    guard: 'Banish 1 card from your Deck, face-up',
    effects: [e(75500286, 1, 'hand', 'none', 'Banish 1 card from your Deck face-up (it is added to the hand two Standby Phases later)')],
  },
  {
    cardId: 54143349,
    name: 'Radiant Typhoon Eldam',
    guard: 'You can only Special Summon "Radiant Typhoon Eldam" once per turn this way',
    effects: [e(54143349, 1, 'field', 'effect', 'If Normal or Special Summoned: add 1 "Radiant Typhoon" monster (not Eldam) or 1 "Mystical Space Typhoon" from your Deck to your hand')],
  },
  {
    cardId: 80538047,
    name: 'Radiant Typhoon Swen',
    guard: 'You can only Special Summon "Radiant Typhoon Swen" once per turn this way',
    effects: [e(80538047, 1, 'field', 'effect', 'If Normal or Special Summoned: add 1 "Radiant Typhoon" Spell/Trap or 1 "Mystical Space Typhoon" from your Deck to your hand')],
  },
];

const RULES = new Map(CARD_RULES.map((r) => [r.cardId, r]));

/** The table entry of a card, only while the card's current text still matches it. */
export function cardRule(cardId: number, cards: ReadonlyMap<number, CardRecord>): CardRule | null {
  const rule = RULES.get(cardId);
  const text = cards.get(cardId)?.desc;
  return rule && text?.includes(rule.guard) ? rule : null;
}

export function parseEffectRef(ref: string | undefined): { cardId: number; n: number } | null {
  const m = /^(\d{1,10})#(\d{1,2})$/.exec(ref ?? '');
  return m ? { cardId: Number(m[1]), n: Number(m[2]) } : null;
}

export function effectRule(ref: string, cards: ReadonlyMap<number, CardRecord>): EffectRule | null {
  const parsed = parseEffectRef(ref);
  return (parsed && cardRule(parsed.cardId, cards)?.effects.find((x) => x.ref === ref)) ?? null;
}

// ---- card properties ------------------------------------------------------------------------

export function isLinkCard(card: CardRecord | undefined): boolean {
  if (!card) return false;
  return card.frameType === 'link' || !!card.linkMarkers?.length || !!card.typeTags?.includes('Link') || /\bLink Monster\b/.test(card.typeLine ?? '');
}

/** true / false when the data says so; null when it cannot be told (then nothing is claimed). */
export function isEffectMonster(card: CardRecord): boolean | null {
  if (card.kind !== 'monster' && card.kind !== 'unknown') return false;
  if (card.typeTags?.length) return card.typeTags.includes('Effect');
  if (card.frameType === 'normal' || /\bNormal Monster\b/.test(card.typeLine ?? '')) return false;
  if (/\bEffect\b/.test(card.typeLine ?? '') || card.frameType === 'effect') return true;
  return null;
}

/** Level of a monster; Link Monsters have none. undefined = unknown. */
function levelOf(card: CardRecord): number | null | undefined {
  if (isLinkCard(card)) return null;
  return card.level;
}

export function matchesArchetype(card: CardRecord | undefined, archetype: string): boolean {
  return !!card && (card.archetype === archetype || card.nameEn.includes(archetype));
}

// ---- Link Material lines ----------------------------------------------------------------------

const RACES = [
  'Aqua', 'Beast-Warrior', 'Beast', 'Cyberse', 'Dinosaur', 'Divine-Beast', 'Dragon', 'Fairy', 'Fiend', 'Fish', 'Illusion', 'Insect', 'Machine', 'Plant', 'Psychic', 'Pyro', 'Reptile', 'Rock', 'Sea Serpent', 'Spellcaster', 'Thunder', 'Warrior', 'Winged Beast', 'Wyrm', 'Zombie',
];
const ATTRIBUTES = ['DARK', 'DIVINE', 'EARTH', 'FIRE', 'LIGHT', 'WATER', 'WIND'];

export interface MaterialRequirement {
  /** The material line as printed. */
  text: string;
  count: number;
  atLeast: boolean;
  effect?: boolean;
  race?: string;
  attribute?: string;
  level?: number;
  maxLevel?: number;
  maxAtk?: number;
  normalSummoned?: boolean;
  /** Every material must be a "X" monster. */
  archetype?: string;
  /** At least one material must be a "X" monster. */
  including?: string;
  differentNames?: boolean;
}

/** The first line of a Link Monster's text, read completely — or null (then nothing is checked). */
export function parseLinkMaterials(desc: string | undefined): MaterialRequirement | null {
  const text = (desc ?? '').split('\n')[0].trim();
  const head = /^(\d)(\+)?\s+(.+)$/.exec(text);
  if (!head) return null;
  const req: MaterialRequirement = { text, count: Number(head[1]), atLeast: !!head[2] };
  let rest = head[3];
  const take = (re: RegExp, apply: (m: RegExpExecArray) => void) => {
    const m = re.exec(rest);
    if (!m) return;
    apply(m);
    rest = (rest.slice(0, m.index) + rest.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
  };
  take(/,\s*including (?:a|an) "([^"]+)" monster$/, (m) => (req.including = m[1]));
  take(/\s+with different names$/, () => (req.differentNames = true));
  take(/\s+with (\d+) or less ATK$/, (m) => (req.maxAtk = Number(m[1])));
  take(/^Level (\d+) or lower\s+/, (m) => (req.maxLevel = Number(m[1])));
  take(/^Level (\d+)\s+/, (m) => (req.level = Number(m[1])));
  take(/^Normal Summoned\s+/, () => (req.normalSummoned = true));
  take(/^"([^"]+)"\s+/, (m) => (req.archetype = m[1]));
  take(/^Effect Monsters?$/, () => (req.effect = true));
  if (rest) {
    const words = /^(.+?)\s+monsters?$/.exec(rest);
    if (words && RACES.includes(words[1])) req.race = words[1];
    else if (words && ATTRIBUTES.includes(words[1])) req.attribute = words[1];
    else if (!/^monsters?$/.test(rest)) return null;
  }
  return req;
}

export interface MaterialInfo {
  cardId: number;
  card?: CardRecord;
  normalSummoned?: boolean;
}

/**
 * Definite violations of a Link Summon's material line, and what could not be decided. A Link
 * Monster used as material counts as 1 material or as its Link Rating.
 */
export function linkMaterialIssues(target: CardRecord, materials: readonly MaterialInfo[], name: (id: number) => string): { violations: string[]; unverified: string[] } {
  const violations: string[] = [];
  const unverified: string[] = [];
  const q = (id: number) => `「${name(id)}」`;
  const req = parseLinkMaterials(target.desc);
  const rating = target.linkval;
  if (!req || !rating) {
    unverified.push(`${q(target.cardId)}的素材條件無法從卡片文字判讀，未檢查素材`);
    return { violations, unverified };
  }
  const fail = (m: MaterialInfo, why: string) => violations.push(`素材${q(m.cardId)}不符合${q(target.cardId)}的素材條件（${req.text}）：${why}`);
  const unknown = (m: MaterialInfo, what: string) => unverified.push(`素材${q(m.cardId)}的${what}資料不足，無法確認是否符合${q(target.cardId)}的素材條件`);

  for (const m of materials) {
    const card = m.card;
    if (!card) {
      unknown(m, '卡片');
      continue;
    }
    if (req.effect) {
      const effect = isEffectMonster(card);
      if (effect === false) fail(m, '不是效果怪獸');
      else if (effect === null) unknown(m, '效果怪獸');
    }
    if (req.race) {
      if (!card.race) unknown(m, '種族');
      else if (card.race !== req.race) fail(m, `不是 ${req.race} 族（${card.race}）`);
    }
    if (req.attribute) {
      if (!card.attribute) unknown(m, '屬性');
      else if (card.attribute !== req.attribute) fail(m, `不是 ${req.attribute} 屬性`);
    }
    if (req.level !== undefined || req.maxLevel !== undefined) {
      const level = levelOf(card);
      if (level === null) fail(m, '連結怪獸沒有等級');
      else if (level === undefined) unknown(m, '等級');
      else if (req.level !== undefined && level !== req.level) fail(m, `等級 ${level}`);
      else if (req.maxLevel !== undefined && level > req.maxLevel) fail(m, `等級 ${level}`);
    }
    if (req.maxAtk !== undefined) {
      if (card.atk === undefined) unknown(m, '攻擊力');
      else if (card.atk > req.maxAtk) fail(m, `攻擊力 ${card.atk}`);
    }
    if (req.normalSummoned && m.normalSummoned === false) fail(m, '不是通常召喚的怪獸');
    if (req.archetype && !matchesArchetype(card, req.archetype)) fail(m, `不是「${req.archetype}」怪獸`);
  }
  if (req.including && materials.every((m) => m.card) && !materials.some((m) => matchesArchetype(m.card, req.including!))) {
    violations.push(`${q(target.cardId)}的素材必須包含「${req.including}」怪獸（${req.text}）`);
  }
  if (req.differentNames && new Set(materials.map((m) => m.card?.nameEn ?? m.cardId)).size < materials.length) {
    violations.push(`${q(target.cardId)}的素材必須是不同卡名（${req.text}）`);
  }

  // Link arithmetic: every reachable total, each Link material counting 1 or its rating.
  let totals = new Set([0]);
  let ratingKnown = true;
  for (const m of materials) {
    const values = new Set([1]);
    if (isLinkCard(m.card)) {
      if (m.card?.linkval) values.add(m.card.linkval);
      else ratingKnown = false;
    }
    totals = new Set([...totals].flatMap((t) => [...values].map((v) => t + v)));
  }
  if (!totals.has(rating)) {
    if (ratingKnown) violations.push(`${q(target.cardId)}的素材（${materials.length} 張，連結怪獸可算 1 或其 Link 值）湊不出 Link-${rating}`);
    else unverified.push(`素材中有連結怪獸缺少 Link 值，無法確認能否湊出 Link-${rating}`);
  } else if (materials.length === 1 && rating > 1) {
    unverified.push(`只用 1 張連結怪獸當作全部素材召喚 Link-${rating}${q(target.cardId)}的特殊裁定未檢查`);
  }
  return { violations, unverified };
}

// ---- the board ------------------------------------------------------------------------------

const POSITION: Partial<Record<FieldSlot, readonly [number, number]>> = {
  'EMZ-L': [1, 1],
  'EMZ-R': [1, 3],
  M1: [2, 0],
  M2: [2, 1],
  M3: [2, 2],
  M4: [2, 3],
  M5: [2, 4],
};
const DIRECTION: Record<LinkMarker, readonly [number, number]> = {
  'Top-Left': [-1, -1],
  Top: [-1, 0],
  'Top-Right': [-1, 1],
  Left: [0, -1],
  Right: [0, 1],
  'Bottom-Left': [1, -1],
  Bottom: [1, 0],
  'Bottom-Right': [1, 1],
};

export const isMonsterSlot = (slot: FieldSlot) => slot.startsWith('M') || slot.startsWith('EMZ');
export const isExtraMonsterZone = (slot: FieldSlot) => slot.startsWith('EMZ');

/** Your Monster Zones that a Link Monster in `slot` points to (zones on the opponent's side are left out). */
export function pointedSlots(slot: FieldSlot, markers: readonly LinkMarker[] | undefined): FieldSlot[] {
  const at = POSITION[slot];
  if (!at || !markers) return [];
  return markers.flatMap((marker) => {
    const [dr, dc] = DIRECTION[marker];
    const target = (Object.keys(POSITION) as FieldSlot[]).find((s) => POSITION[s]![0] === at[0] + dr && POSITION[s]![1] === at[1] + dc);
    return target ? [target] : [];
  });
}
