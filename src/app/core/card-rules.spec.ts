import { cardRule, effectRule, isEffectMonster, parseLinkMaterials, pointedSlots } from './card-rules';
import { malissCards } from '../../testing/ai/maliss-deck.sample';
import { C } from '../../testing/ai/maliss-routes.sample';
import { testCards } from '../../testing/ai/test-deck.sample';

// CR-006 G38: the rule table and its helpers, on the user's real card data (fixed, no network).
const cards = malissCards();
const desc = (id: number) => cards.get(id)!.desc;

describe('parseLinkMaterials (G38-1)', () => {
  it('reads every material line of the deck\'s 15 Link Monsters', () => {
    expect(parseLinkMaterials(desc(C.allied))).toMatchObject({ count: 3, atLeast: true, effect: true });
    expect(parseLinkMaterials(desc(C.firewall))).toMatchObject({ count: 2, atLeast: true });
    expect(parseLinkMaterials(desc(C.firewall))?.effect).toBeUndefined();
    expect(parseLinkMaterials(desc(C.transcode))).toMatchObject({ count: 2, atLeast: true, effect: true });
    expect(parseLinkMaterials(desc(C.accesscode))).toMatchObject({ count: 2, atLeast: true, effect: true });
    expect(parseLinkMaterials(desc(C.wicckid))).toMatchObject({ count: 2, atLeast: false, race: 'Cyberse' });
    expect(parseLinkMaterials(desc(C.splashMage))).toMatchObject({ count: 2, atLeast: false, race: 'Cyberse' });
    expect(parseLinkMaterials(desc(C.linkDecoder))).toMatchObject({ count: 1, race: 'Cyberse', maxLevel: 4 });
    expect(parseLinkMaterials(desc(C.linguriboh))).toMatchObject({ count: 1, race: 'Cyberse', maxLevel: 4 });
    expect(parseLinkMaterials(desc(C.almiraj))).toMatchObject({ count: 1, normalSummoned: true, maxAtk: 1000 });
    expect(parseLinkMaterials(desc(C.cherubini))).toMatchObject({ count: 2, level: 3 });
    expect(parseLinkMaterials(desc(9763474))).toMatchObject({ count: 2, differentNames: true });
    expect(parseLinkMaterials(desc(C.littleKnight))).toMatchObject({ count: 2, effect: true });
    expect(parseLinkMaterials(desc(39341885))).toMatchObject({ count: 2, archetype: 'Radiant Typhoon' });
    expect(parseLinkMaterials(desc(C.whiteBinder))).toMatchObject({ count: 2, atLeast: true, including: 'Maliss' });
    expect(parseLinkMaterials(desc(C.heartsCrypter))).toMatchObject({ count: 3, atLeast: false, including: 'Maliss' });
  });

  it('returns null for anything it cannot read completely (then nothing is claimed)', () => {
    expect(parseLinkMaterials('Effect text of 301.')).toBeNull();
    expect(parseLinkMaterials(undefined)).toBeNull();
    expect(parseLinkMaterials('2+ monsters with a strange new condition\nText.')).toBeNull();
  });
});

describe('pointedSlots — Link arrows on the board (G37/G38-2)', () => {
  const arrows = (id: number) => cards.get(id)!.linkMarkers!;
  it('uses the real arrows of each card', () => {
    expect(arrows(C.allied)).toEqual(['Left', 'Right', 'Bottom-Left', 'Bottom', 'Bottom-Right']);
    expect(pointedSlots('EMZ-L', arrows(C.allied))).toEqual(['M1', 'M2', 'M3']);
    expect(pointedSlots('EMZ-R', arrows(C.allied))).toEqual(['M3', 'M4', 'M5']);
    expect(pointedSlots('M3', arrows(C.allied))).toEqual(['M2', 'M4']);
    expect(pointedSlots('EMZ-L', arrows(C.firewall))).toEqual(['M2']);
    expect(pointedSlots('M2', arrows(C.whiteBinder))).toEqual(['EMZ-L', 'M1', 'M3']);
    expect(pointedSlots('EMZ-R', arrows(C.heartsCrypter))).toEqual(['M3', 'M5']);
    expect(pointedSlots('EMZ-L', arrows(C.splashMage))).toEqual(['M3']);
    expect(pointedSlots('M1', arrows(C.linkDecoder))).toEqual([]);
    expect(pointedSlots('S1', arrows(C.allied))).toEqual([]);
  });
});

describe('rule table guard (G38-8)', () => {
  it('applies a card\'s rules only while its current text matches the table', () => {
    expect(cardRule(C.dormouse, cards)?.effects.map((e) => e.ref)).toEqual([`${C.dormouse}#1`, `${C.dormouse}#2`]);
    expect(effectRule(`${C.allied}#2`, cards)).toMatchObject({ zone: 'field', once: 'effect' });
    expect(effectRule(`${C.tb11}#1`, cards)).toMatchObject({ once: 'name' });
    expect(effectRule(`${C.firewall}#1`, cards)).toMatchObject({ once: 'face-up' });
    const changed = new Map(cards).set(C.dormouse, { ...cards.get(C.dormouse)!, desc: 'Maliss <P> Dormouse 的測試效果文字（fixture）。' });
    expect(cardRule(C.dormouse, changed)).toBeNull();
    expect(effectRule(`${C.dormouse}#1`, changed)).toBeNull();
    expect(effectRule('999#1', cards)).toBeNull();
  });

  it('Effect Monster status comes from the type tags; unknown stays unknown', () => {
    expect(isEffectMonster(cards.get(C.allied)!)).toBe(true);
    expect(isEffectMonster(cards.get(C.dormouse)!)).toBe(true);
    expect(isEffectMonster({ ...cards.get(C.allied)!, typeTags: ['Cyberse', 'Link'] })).toBe(false);
    expect(isEffectMonster({ ...cards.get(C.dormouse)!, typeTags: undefined, frameType: 'normal', typeLine: 'Normal Monster' })).toBe(false);
    const abstractLink = [...testCards().values()].find((c) => c.isExtraDeckType)!;
    expect(isEffectMonster({ ...abstractLink, typeTags: undefined, typeLine: 'Link Monster' })).toBeNull();
  });
});
