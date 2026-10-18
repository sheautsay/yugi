/**
 * TEST DATA ONLY (B7). The "Banquet FTK" reference deck from the battle-mode spec (Master Duel Meta, brandon, 2026-10-12,
 * Master V): 40 main + 15 extra, with the card texts exactly as YGOPRODeck API v7 returned them on 2026-10-18.
 * The plans built on it (`banquet-plans.sample.ts`) are HAND-WRITTEN to exercise the checks; they are not model output and
 * not a verified first-turn-kill line. Excluded from the app build (`*.sample.ts`).
 */
import type { ApiCard } from '../../app/core/card-api';
import { toCardRecord } from '../../app/core/card-api';
import { CardRecord, DeckRecord } from '../../app/core/models';

export const BANQUET_API_CARDS: ApiCard[] = [
  {
    "id": 48814566,
    "name": "Banquet of Millions",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "Banish any number of cards from your Extra Deck face-down, and banish the same number of random face-down cards from your opponent's Extra Deck, face-up, until the End Phase. You can only activate 1 \"Banquet of Millions\" per turn.",
    "race": "Normal"
  },
  {
    "id": 74191528,
    "name": "Card of Fate",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "Each player chooses 1 card from their Deck, then each player combines it with 4 additional random cards chosen from their Deck by their opponent, then randomly selects 1 of those 5 cards to reveal and add to their hand. Shuffle the rest back into the Decks. You can only activate 1 \"Card of Fate\" per turn.",
    "race": "Normal"
  },
  {
    "id": 67616300,
    "name": "Chicken Game",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "The player with the lowest LP takes no damage. Once per turn, during the Main Phase: The turn player can pay 1000 LP, then activate 1 of these effects;\n● Draw 1 card.\n● Destroy this card.\n● Your opponent gains 1000 LP.\nNeither player can activate cards or effects in response to this effect's activation.",
    "race": "Field"
  },
  {
    "id": 56673480,
    "name": "Contract with Don Thousand",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "When this card is activated: Both players lose 1000 LP, and if they do, each draws 1 card. All cards that are drawn while this card's effect is applied must remain revealed. While a player's Spell Card in their hand is revealed by this effect, that player cannot Normal Summon/Set monsters. You can only activate 1 \"Contract with Don Thousand\" per turn.",
    "race": "Continuous"
  },
  {
    "id": 8628798,
    "name": "D.D. Dynamite",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "Inflict 300 damage to your opponent for each of their removed from play cards.",
    "race": "Normal",
    "archetype": "D.D."
  },
  {
    "id": 74117290,
    "name": "Dark World Dealings",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "Each player draws 1 card, then each player discards 1 card.",
    "race": "Normal",
    "archetype": "Dark World"
  },
  {
    "id": 15693423,
    "name": "Evenly Matched",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "At the end of the Battle Phase, if your opponent controls more cards than you do: You can make your opponent banish cards from their field face-down so they control the same number of cards as you do. If you control no cards, you can activate this card from your hand.",
    "race": "Normal"
  },
  {
    "id": 11765832,
    "name": "Garura, Wings of Resonant Life",
    "type": "Fusion Monster",
    "frameType": "fusion",
    "desc": "2 monsters with the same Type and Attribute, but different names\r\nAny battle damage your opponent takes from battles involving this card is doubled. If this card is sent to the GY: You can draw 1 card. You can only use this effect of \"Garura, Wings of Resonant Life\" once per turn.",
    "race": "Winged Beast",
    "attribute": "DARK",
    "level": 6,
    "atk": 1500,
    "def": 2400
  },
  {
    "id": 93946239,
    "name": "Into the Void",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "If you have 3 or more cards in your hand: Draw 1 card, and if you do, during the End Phase of this turn, discard your entire hand.",
    "race": "Normal"
  },
  {
    "id": 98954106,
    "name": "Jar of Avarice",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "Target 5 cards in your GY, except \"Jar of Avarice\"; shuffle all 5 into the Deck, then draw 1 card. You can only activate 1 \"Jar of Avarice\" per turn.",
    "race": "Normal",
    "archetype": "Greed"
  },
  {
    "id": 23898021,
    "name": "Lilith, Lady of Lament",
    "type": "Effect Monster",
    "frameType": "effect",
    "desc": "If this card is Normal Summoned, its original ATK becomes 1000. (Quick Effect): You can Tribute 1 DARK monster; reveal 3 Normal Traps from your Deck, your opponent randomly chooses 1 for you to Set on your field, and you shuffle the rest back into your Deck. You can only use this effect of \"Lilith, Lady of Lament\" once per turn.",
    "race": "Fiend",
    "attribute": "DARK",
    "level": 3,
    "atk": 2000,
    "def": 0,
    "archetype": "Lady of Lament"
  },
  {
    "id": 85852291,
    "name": "Magical Mallet",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "Shuffle any number of cards from your hand into the Deck, then draw that same number of cards.",
    "race": "Normal"
  },
  {
    "id": 9940036,
    "name": "Mereologic Aggregator",
    "type": "XYZ Monster",
    "frameType": "xyz",
    "desc": "2+ Level 9 monsters\r\nIf this card is Xyz Summoned: You can send 1 monster from your Extra Deck to the GY. You can target monsters in your GY, up to the number of materials this card has; detach materials from this card equal to the number of those targets in the GY, and if you do, attach those targets to this card. If this card is sent to the GY: You can target 1 face-up card on the field; negate its effects until the end of this turn. You can only use each effect of \"Mereologic Aggregator\" once per turn.",
    "race": "Cyberse",
    "attribute": "DARK",
    "level": 9,
    "atk": 2600,
    "def": 3000
  },
  {
    "id": 15232745,
    "name": "Number 1: Numeron Gate Ekam",
    "type": "XYZ Monster",
    "frameType": "xyz",
    "desc": "3 Level 1 monsters\r\nCannot be destroyed by battle. At the end of the Damage Step, if this card battled an opponent's monster: You can detach 1 material from this card; double the ATK of all \"Numeron\" monsters you currently control, until the end of this turn.",
    "race": "Machine",
    "attribute": "LIGHT",
    "level": 1,
    "atk": 1000,
    "def": 100,
    "archetype": "Numeron"
  },
  {
    "id": 42230449,
    "name": "Number 2: Numeron Gate Dve",
    "type": "XYZ Monster",
    "frameType": "xyz",
    "desc": "3 Level 1 monsters\r\nCannot be destroyed by battle. At the end of the Damage Step, if this card battled an opponent's monster: You can detach 1 material from this card; double the ATK of all \"Numeron\" monsters you currently control, until the end of this turn.",
    "race": "Machine",
    "attribute": "LIGHT",
    "level": 1,
    "atk": 1000,
    "def": 100,
    "archetype": "Numeron"
  },
  {
    "id": 78625448,
    "name": "Number 3: Numeron Gate Trini",
    "type": "XYZ Monster",
    "frameType": "xyz",
    "desc": "3 Level 1 monsters\r\nCannot be destroyed by battle. At the end of the Damage Step, if this card battled an opponent's monster: You can detach 1 material from this card; double the ATK of all \"Numeron\" monsters you currently control, until the end of this turn.",
    "race": "Machine",
    "attribute": "LIGHT",
    "level": 1,
    "atk": 1000,
    "def": 100,
    "archetype": "Numeron"
  },
  {
    "id": 4019153,
    "name": "Number 4: Numeron Gate Catvari",
    "type": "XYZ Monster",
    "frameType": "xyz",
    "desc": "3 Level 1 monsters\r\nCannot be destroyed by battle. At the end of the Damage Step, if this card battled an opponent's monster: You can detach 1 material from this card; double the ATK of all \"Numeron\" monsters you currently control, until the end of this turn.",
    "race": "Machine",
    "attribute": "LIGHT",
    "level": 1,
    "atk": 1000,
    "def": 100,
    "archetype": "Numeron"
  },
  {
    "id": 64765016,
    "name": "Paleozoic Marrella",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "Send 1 Trap from your Deck to the GY. Once per Chain, when a Trap Card is activated while this card is in your GY: You can Special Summon this card as a Normal Monster (Aqua/WATER/Level 2/ATK 1200/DEF 0). (This card is NOT treated as a Trap.) If Summoned this way, this card is unaffected by monster effects, also banish it when it leaves the field.",
    "race": "Normal",
    "archetype": "Paleozoic"
  },
  {
    "id": 11481610,
    "name": "Performapal Popperup",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "Send up to 3 cards from your hand to the GY; draw that many cards, then you can Special Summon up to that many monsters from your hand, with different names, that are \"Performapal\" monsters, \"Magician\" Pendulum Monsters, and/or \"Odd-Eyes\" monsters, each with a Level between the Pendulum Scales of the 2 cards in your Pendulum Zones. If you did not Special Summon by this effect, you lose 1000 LP for each card in your hand. You can only activate 1 \"Performapal Popperup\" per turn.",
    "race": "Normal",
    "archetype": "Performapal"
  },
  {
    "id": 58577036,
    "name": "Reasoning",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "Your opponent declares a monster Level from 1 to 12. Excavate cards from the top of your Deck until you excavate a monster that can be Normal Summoned/Set, then, if that monster is the same Level as the one declared by your opponent, send all excavated cards to the GY. If not, Special Summon the excavated monster, also send the remaining cards to the GY.",
    "race": "Normal"
  },
  {
    "id": 93039339,
    "name": "Super Starslayer TY-PHON - Sky Crisis",
    "type": "XYZ Monster",
    "frameType": "xyz",
    "desc": "2 Level 12 monsters\r\nDuring the turn, or turn after, your opponent Special Summoned 2 or more monsters from the Extra Deck, you can also Xyz Summon this card by using 1 monster you control with the highest ATK (your choice, if tied). (Transfer its materials to this card.) If you do, you cannot Normal or Special Summon monsters for the rest of this turn. While this Xyz Summoned monster is on the field, neither player can activate the effects of monsters with 3000 or more ATK. Once per turn: You can detach 1 material from this card; return 1 monster from the field to the hand.",
    "race": "Fiend",
    "attribute": "DARK",
    "level": 12,
    "atk": 2900,
    "def": 2900
  },
  {
    "id": 6351147,
    "name": "Transaction Rollback",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "Pay half your LP, then target 1 Normal Trap in your opponent's GY, except \"Transaction Rollback\"; this effect becomes that card's activation effect. You can banish this card from your GY and pay half your LP, then target 1 Normal Trap in your GY, except \"Transaction Rollback\"; this effect becomes that card's activation effect. You can only use 1 \"Transaction Rollback\" effect per turn, and only once that turn.",
    "race": "Normal"
  },
  {
    "id": 22377092,
    "name": "Trap Holic",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "Target 1 Spell/Trap you control; destroy it, and if you do, Set 1 Normal Trap from your Deck, except \"Trap Holic\". It can be activated this turn, while you have 3 or more Traps in your GY. You can only activate 1 \"Trap Holic\" per turn.",
    "race": "Normal"
  },
  {
    "id": 80101899,
    "name": "Trap Trick",
    "type": "Trap Card",
    "frameType": "trap",
    "desc": "Banish 1 Normal Trap from your Deck, except \"Trap Trick\", and Set 1 card with the same name directly from your Deck, also it can be activated this turn. You can only activate 1 Trap Card for the rest of this turn after this card resolves. You can only activate 1 \"Trap Trick\" per turn.",
    "race": "Normal"
  },
  {
    "id": 48805472,
    "name": "Traptantalizing Tune",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "Discard 1 Level 4 Insect or Plant monster, or 1 Normal Trap; draw 2 cards. You can banish this card from your GY, then target 1 of your banished Level 4 Insect or Plant monsters, or Normal Traps; place it on the bottom of the Deck. You can only use each effect of \"Traptantalizing Tune\" once per turn.",
    "race": "Normal"
  },
  {
    "id": 35269904,
    "name": "Triple Tactics Thrust",
    "type": "Spell Card",
    "frameType": "spell",
    "desc": "If your opponent has activated a monster effect during this turn: Set 1 Normal Spell/Trap directly from your Deck, except \"Triple Tactics Thrust\", or if your opponent controls a monster, you can add it to your hand instead. That Set card cannot be activated this turn. You can only activate 1 \"Triple Tactics Thrust\" per turn.",
    "race": "Normal"
  }
];

export const ID: Record<string, number> = {
  "Banquet of Millions": 48814566,
  "Card of Fate": 74191528,
  "Chicken Game": 67616300,
  "Contract with Don Thousand": 56673480,
  "D.D. Dynamite": 8628798,
  "Dark World Dealings": 74117290,
  "Evenly Matched": 15693423,
  "Garura, Wings of Resonant Life": 11765832,
  "Into the Void": 93946239,
  "Jar of Avarice": 98954106,
  "Lilith, Lady of Lament": 23898021,
  "Magical Mallet": 85852291,
  "Mereologic Aggregator": 9940036,
  "Number 1: Numeron Gate Ekam": 15232745,
  "Number 2: Numeron Gate Dve": 42230449,
  "Number 3: Numeron Gate Trini": 78625448,
  "Number 4: Numeron Gate Catvari": 4019153,
  "Paleozoic Marrella": 64765016,
  "Performapal Popperup": 11481610,
  "Reasoning": 58577036,
  "Super Starslayer TY-PHON - Sky Crisis": 93039339,
  "Transaction Rollback": 6351147,
  "Trap Holic": 22377092,
  "Trap Trick": 80101899,
  "Traptantalizing Tune": 48805472,
  "Triple Tactics Thrust": 35269904
};

const MAIN: Array<[string, number]> = [["Lilith, Lady of Lament", 2], ["Reasoning", 3], ["Magical Mallet", 1], ["Dark World Dealings", 2], ["Into the Void", 3], ["Card of Fate", 1], ["Performapal Popperup", 1], ["Traptantalizing Tune", 1], ["Triple Tactics Thrust", 1], ["Chicken Game", 3], ["Contract with Don Thousand", 1], ["Transaction Rollback", 3], ["D.D. Dynamite", 2], ["Jar of Avarice", 1], ["Paleozoic Marrella", 3], ["Evenly Matched", 3], ["Trap Trick", 3], ["Banquet of Millions", 3], ["Trap Holic", 3]];
const EXTRA: Array<[string, number]> = [["Garura, Wings of Resonant Life", 1], ["Number 1: Numeron Gate Ekam", 3], ["Number 2: Numeron Gate Dve", 3], ["Number 3: Numeron Gate Trini", 3], ["Number 4: Numeron Gate Catvari", 3], ["Mereologic Aggregator", 1], ["Super Starslayer TY-PHON - Sky Crisis", 1]];

export function banquetCards(): Map<number, CardRecord> {
  return new Map(BANQUET_API_CARDS.map((c) => [c.id, { ...toCardRecord(c, '2026-10-18T00:00:00.000Z'), source: 'test' }] as const));
}

export function banquetDeck(overrides: Partial<DeckRecord> = {}): DeckRecord {
  return {
    schemaVersion: 1,
    id: 'banquet-ftk',
    name: 'Banquet FTK',
    format: 'master-duel',
    version: 1,
    ftk: true,
    main: MAIN.map(([n, count]) => ({ cardId: ID[n], count })),
    extra: EXTRA.map(([n, count]) => ({ cardId: ID[n], count })),
    side: [],
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
    ...overrides,
  };
}
