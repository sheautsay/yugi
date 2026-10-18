import { IDS, testCards, testDeck } from '../../testing/ai/test-deck.sample';
import { analysisLevel } from './analysis-level';
import { deckFingerprint } from './deck';
import { ComboRoute, ComboStep, PlayZone } from './models';
import { checkRoute, endZone } from './route-check';

// CR-004 G23-3 / G24: local data check. Abstract IDs (see test-deck.sample.ts).
const { starter: S, searched: T, extender: E, link: L, link2: L2, outsider: X } = IDS;
const deck = testDeck();
const cards = testCards(deck);

let n = 0;
function step(actionType: ComboStep['actionType'], actors: number[], moves: Array<[number, PlayZone, PlayZone]>, extra: Partial<ComboStep> = {}): ComboStep {
  n++;
  return { id: `s${n}`, order: 0, actionType, actorCardIds: actors, title: 't', description: 'd', moves: moves.map(([cardId, from, to]) => ({ cardId, from, to })), ...extra };
}

/** The consistent single-card line: NS S → search T → SS T → Link L with S+T. */
function goodRoute(patch: Partial<ComboRoute> = {}): ComboRoute {
  const steps = [
    step('normal-summon', [S], [[S, 'hand', 'field']]),
    step('search', [S], [[T, 'deck', 'hand']], { targetCardIds: [T] }),
    step('special-summon', [T], [[T, 'hand', 'field']]),
    step('link-summon', [L], [[S, 'field', 'gy'], [T, 'field', 'gy'], [L, 'extra', 'field']], { materialCardIds: [S, T] }),
  ];
  return {
    schemaVersion: 1,
    id: 'r1',
    version: 1,
    name: 'AI 路線',
    archetype: 'Testers',
    format: 'master-duel',
    conditions: {
      handAllOf: [{ anyOf: [S], count: 1 }],
      mustRemainInMain: [{ cardId: T, count: 1 }],
      mustExistInExtra: [{ cardId: L, count: 1 }],
      setup: { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true },
    },
    steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
    endBoard: [{ cardId: L, zone: '場上', count: 1 }],
    verification: { status: 'unverified' },
    analysis: {
      origin: 'ai',
      runId: 'run-1',
      deckId: deck.id,
      deckName: deck.name,
      deckVersion: deck.version,
      deckFingerprint: deckFingerprint(deck),
      cardDataVersion: 'test',
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      promptVersion: 'deck-analysis-v1',
      generatedAt: '2026-10-09T00:00:00.000Z',
      starterCardIds: [S],
      preconditions: [],
      pros: [],
      cons: [],
      check: { passed: true, checkedAt: '2026-10-09T00:00:00.000Z', deckFingerprint: deckFingerprint(deck), problems: [] },
    },
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
    ...patch,
  };
}

const messages = (r: ComboRoute, d = deck) => checkRoute(r, d, { cards }).problems.map((p) => `${p.step ?? '-'}:${p.message}`);

describe('checkRoute (CR-004 data check)', () => {
  it('passes a consistent route and reports resources after every step and at the end', () => {
    const result = checkRoute(goodRoute(), deck, { cards });
    expect(result.problems).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.start.hand).toEqual([{ cardId: S, count: 1 }]);
    expect(result.start.deckCount).toBe(39);
    expect(result.afterStep).toHaveLength(4);
    expect(result.afterStep[1].hand).toEqual([{ cardId: T, count: 1 }]);
    expect(result.afterStep[1].deckCount).toBe(38);
    expect(result.final.field).toEqual([{ cardId: L, count: 1 }]);
    expect(result.final.gy).toEqual([
      { cardId: S, count: 1 },
      { cardId: T, count: 1 },
    ]);
    expect(result.final.extraCount).toBe(14);
    expect(result.final.normalSummons).toBe(1);
  });

  it('a: rejects any card outside the main and extra deck (side deck included)', () => {
    const r = goodRoute({ endBoard: [{ cardId: L, zone: '場上', count: 1 }, { cardId: X, zone: '墓地', count: 1 }] });
    expect(messages(r).some((m) => m.includes(`ID ${X}`) && m.includes('不在此牌組'))).toBe(true);
    const sideOnly = { ...deck, extra: deck.extra.filter((x) => x.cardId !== L), side: [{ cardId: L, count: 1 }] };
    expect(messages(goodRoute(), sideOnly).some((m) => m.includes(`Test Card ${L}`) && m.includes('不在此牌組'))).toBe(true);
  });

  it('b: same-name copies — hand and moves never exceed the copies in that zone', () => {
    const r = goodRoute({ conditions: { ...goodRoute().conditions, handAllOf: [{ anyOf: [L2], count: 1 }] } });
    expect(messages(r)).toContain(`-:起手需要「Test Card ${L2}」×1，但主牌組只有 0 張`);
    const twice = goodRoute();
    twice.steps = [...twice.steps, { ...step('link-summon', [L], [[L, 'extra', 'field']]), order: 5 }];
    expect(messages(twice)).toContain(`5:「Test Card ${L}」不在額外牌組，不能移到場上`);
    const fourthCopy = goodRoute({ conditions: { ...goodRoute().conditions, handAllOf: [{ anyOf: [T], count: 3 }], mustRemainInMain: [{ cardId: T, count: 1 }] } });
    expect(messages(fourthCopy)).toContain(`-:主牌組需仍有「Test Card ${T}」×1，扣除起手後只剩 0 張`);
  });

  it('c: required cards must still be in the main deck after the hand, and in the extra deck', () => {
    const r = goodRoute({ conditions: { ...goodRoute().conditions, mustRemainInMain: [{ cardId: T, count: 4 }], mustExistInExtra: [{ cardId: L, count: 2 }] } });
    expect(messages(r)).toEqual([`-:主牌組需仍有「Test Card ${T}」×4，扣除起手後只剩 3 張`, `-:額外牌組需要「Test Card ${L}」×2，目前有 1 張`]);
  });

  it('d: a route needs steps and an end board', () => {
    expect(messages(goodRoute({ steps: [], endBoard: [] }))).toEqual(expect.arrayContaining(['-:路線沒有步驟', '-:路線沒有預計終場']));
  });

  it('e: actors, materials and extra deck summons must match the simulated positions', () => {
    const r = goodRoute();
    r.steps = [
      { ...step('activate', [T], []), order: 1 },
      { ...step('link-summon', [L], [[L, 'extra', 'field']], { materialCardIds: [S] }), order: 2 },
      { ...step('xyz-summon', [S], [[S, 'hand', 'field']]), order: 3 },
    ];
    r.endBoard = [{ cardId: L, zone: '場上', count: 1 }];
    const m = messages(r);
    expect(m).toContain(`1:執行卡「Test Card ${T}」在此步之前不在手牌、場上、墓地或除外，且此步沒有移動它`);
    expect(m).toContain(`2:素材「Test Card ${S}」×1沒有對應的移動紀錄（素材必須離開原本的位置）`);
    expect(m).toContain('3:從額外牌組召喚的步驟，必須有一張卡從額外牌組移到場上');
  });

  it('e: a main deck card cannot be summoned from the extra deck even if the moves claim it', () => {
    const notExtra = new Map(cards).set(L, { ...cards.get(L)!, isExtraDeckType: false });
    const result = checkRoute(goodRoute(), deck, { cards: notExtra });
    expect(result.problems.map((p) => p.message)).toContain(`「Test Card ${L}」不是額外牌組怪獸，不能從額外牌組召喚`);
  });

  it('f: the end board must match the final simulated state', () => {
    const r = goodRoute({ endBoard: [{ cardId: L, zone: '場上', count: 1 }, { cardId: S, zone: '場上', count: 1 }] });
    expect(messages(r)).toEqual([`-:終場列出「Test Card ${S}」×1（場上），但模擬結束時只有 0 張`]);
    expect(endZone('主要怪獸區')).toBe('field');
    const unknownZone = checkRoute(goodRoute({ endBoard: [{ cardId: L, zone: '外太空', count: 1 }] }), deck, { cards });
    expect(unknownZone.passed).toBe(true);
    expect(unknownZone.warnings.map((w) => w.message)).toContain(`終場位置「外太空」無法對應到模擬的位置，「Test Card ${L}」未檢查`);
  });

  it('g: at most 5 opening cards going first, and OR clauses cannot be checked', () => {
    const six = goodRoute({ conditions: { ...goodRoute().conditions, handAllOf: [{ anyOf: [S], count: 3 }, { anyOf: [E], count: 3 }] } });
    expect(messages(six)).toContain('-:起手需要 6 張，超過先攻的 5 張');
    const or = goodRoute({ conditions: { ...goodRoute().conditions, handAllOf: [{ anyOf: [S, E], count: 1 }] } });
    expect(messages(or)[0]).toContain('起手條件含「或」選項');
  });

  it('a second normal summon is a warning, not a data contradiction', () => {
    const r = goodRoute();
    r.steps = [
      { ...step('normal-summon', [S], [[S, 'hand', 'field']]), order: 1 },
      { ...step('search', [S], [[T, 'deck', 'hand']]), order: 2 },
      { ...step('normal-summon', [T], [[T, 'hand', 'field']]), order: 3 },
      { ...step('link-summon', [L], [[S, 'field', 'gy'], [T, 'field', 'gy'], [L, 'extra', 'field']], { materialCardIds: [S, T] }), order: 4 },
    ];
    const result = checkRoute(r, deck, { cards });
    expect(result.passed).toBe(true);
    expect(result.warnings).toContainEqual({ step: 3, message: '通常召喚超過 1 次：除非有卡片效果給予額外的召喚權，否則不可行' });
  });

  it('is pure: the route and deck are not modified', () => {
    const r = goodRoute();
    const before = JSON.stringify([r, deck]);
    checkRoute(r, deck, { cards });
    expect(JSON.stringify([r, deck])).toBe(before);
  });
});

describe('analysisLevel (CR-004 G24)', () => {
  it('data-checked only when the check passes now; never engine-verified', () => {
    expect(analysisLevel(goodRoute(), deck, { cards })).toBe('data-checked');
    const broken = goodRoute({ endBoard: [] });
    expect(analysisLevel(broken, deck, { cards })).toBe('ai-candidate');
    expect(analysisLevel(goodRoute(), null)).toBe('ai-candidate');
  });

  it('a stored "passed" check cannot raise the level: it is recomputed', () => {
    const forged = goodRoute({ steps: [] });
    forged.analysis!.check = { passed: true, checkedAt: '2026-10-09T00:00:00.000Z', deckFingerprint: deckFingerprint(deck), problems: [] };
    expect(analysisLevel(forged, deck, { cards })).toBe('ai-candidate');
  });

  it('md-confirmed only through the existing human verification for this deck list', () => {
    const fp = deckFingerprint(deck);
    const human = goodRoute({ verification: { status: 'verified', verifiedAt: '2026-10-09', verifiedBy: '玩家', evidenceNote: '錄影 00:42', deckFingerprint: fp } });
    expect(analysisLevel(human, deck, { cards })).toBe('md-confirmed');
    const otherDeck = { ...deck, main: deck.main.map((r) => (r.cardId === S ? { ...r, count: 2 } : r)) };
    expect(analysisLevel(human, otherDeck, { cards })).toBe('data-checked');
  });

  it('hand-written routes have no AI level', () => {
    expect(analysisLevel(goodRoute({ analysis: undefined }), deck)).toBeNull();
  });
});
