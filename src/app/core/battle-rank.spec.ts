import { AnalysisGoalKind } from './ai/analysis-goal';
import { RouteEvaluation } from './ai/evaluate';
import { BattleItem, rankEvaluated, rankForBattle } from './battle-rank';
import { RouteResult } from './matcher';
import { ComboRoute } from './models';

const goal = (kind: AnalysisGoalKind, preferredExtraIds: number[] = []) => ({ kind, preferredExtraIds });

function ev(o: Partial<RouteEvaluation> & { signature: string }): RouteEvaluation {
  return {
    valid: true,
    problemCount: 0,
    startKind: 'single',
    handSize: 1,
    starters: [1],
    starterKey: '1',
    finalMonsters: [],
    finalBacks: [],
    extraUsed: [],
    interruptions: [],
    effective: 0,
    verified: 0,
    conditional: 0,
    protections: [],
    extensions: [],
    handLeft: 0,
    hand: { confirmed: 0, untracked: { min: 0, max: 0 }, complete: true },
    followUp: { hand: 0, backrow: 0, recoverable: 0, total: 0, basis: [] },
    layoutKnown: true,
    ...o,
  };
}

function item(id: string, evaluation: RouteEvaluation, o: { kind?: 'available' | 'unverified'; hand?: number; name?: string } = {}): BattleItem {
  const route = { id, name: o.name ?? id, conditions: { handAllOf: [{ anyOf: [1], count: o.hand ?? 1 }] } } as unknown as ComboRoute;
  return { route, kind: o.kind ?? 'unverified', evaluation };
}

const ids = (items: BattleItem[], g = goal('interruptions')) => rankEvaluated(items, g).map((e) => e.route.id);

describe('battle ranking (B1)', () => {
  it('A: more effective interruptions first, then fewer conditional ones', () => {
    const items = [item('two', ev({ signature: 'a', effective: 2 })), item('four', ev({ signature: 'b', effective: 4 })), item('four-cond', ev({ signature: 'c', effective: 4, conditional: 2 }))];
    expect(ids(items)).toEqual(['four-cond', 'four', 'two']);
    // the first two have the same effective count; the one with more conditional (unverifiable) interruptions comes first only by the score order
  });

  it('B: preferred Extra Deck monsters on the final board beat interruptions; ones only used on the way count after', () => {
    const items = [
      item('strong', ev({ signature: 'a', effective: 5 })),
      item('target', ev({ signature: 'b', effective: 1, finalMonsters: [900] })),
      item('passing', ev({ signature: 'c', effective: 3, extraUsed: [{ cardId: 900, onFinalBoard: false }] })),
    ];
    expect(ids(items, goal('targets', [900]))).toEqual(['target', 'strong', 'passing']);
  });

  it('C: cards kept in hand (confirmed plus untracked) come first', () => {
    const items = [
      item('few', ev({ signature: 'a', effective: 6, hand: { confirmed: 0, untracked: { min: 0, max: 0 }, complete: true } })),
      item('many', ev({ signature: 'b', effective: 1, hand: { confirmed: 2, untracked: { min: 1, max: 1 }, complete: false } })),
      item('listed', ev({ signature: 'c', effective: 1, hand: { confirmed: 3, untracked: { min: 0, max: 0 }, complete: true } })),
    ];
    // 3 = 2 + 1 = 3 + 0: at equal totals the confirmed (listed) cards come first
    expect(ids(items, goal('resources'))).toEqual(['listed', 'many', 'few']);
  });

  it('D: exploration uses the interruption score in battle (no variety grouping)', () => {
    const items = [item('a', ev({ signature: 'a', effective: 1 })), item('b', ev({ signature: 'b', effective: 3 }))];
    expect(ids(items, goal('diverse'))).toEqual(['b', 'a']);
  });

  it('E: interruptions plus follow-up resources', () => {
    const fu = (total: number) => ({ hand: total, backrow: 0, recoverable: 0, total, basis: [] });
    const items = [item('ints', ev({ signature: 'a', effective: 4, followUp: fu(0) })), item('both', ev({ signature: 'b', effective: 3, followUp: fu(2) })), item('res', ev({ signature: 'c', effective: 1, followUp: fu(1) }))];
    expect(ids(items, goal('balanced'))).toEqual(['both', 'ints', 'res']);
  });

  it('a tested route wins only on an equal score; untested stronger routes stay ahead', () => {
    const items = [
      item('untested-same', ev({ signature: 'a', effective: 3 }), { kind: 'unverified' }),
      item('tested-same', ev({ signature: 'b', effective: 3 }), { kind: 'available' }),
      item('untested-stronger', ev({ signature: 'c', effective: 4 }), { kind: 'unverified' }),
      item('tested-weaker', ev({ signature: 'd', effective: 2 }), { kind: 'available' }),
    ];
    const ranked = rankEvaluated(items, goal('interruptions'));
    expect(ranked.map((e) => e.route.id)).toEqual(['untested-stronger', 'tested-same', 'untested-same', 'tested-weaker']);
    expect(ranked.map((e) => e.verified)).toEqual([false, true, false, true]);
  });

  it('equal score and tested state: fewer opening cards first, then name', () => {
    const items = [
      item('z-two', ev({ signature: 'a', effective: 3 }), { hand: 2, name: 'Z' }),
      item('b-one', ev({ signature: 'b', effective: 3 }), { hand: 1, name: 'B' }),
      item('a-one', ev({ signature: 'c', effective: 3 }), { hand: 1, name: 'A' }),
    ];
    expect(ids(items)).toEqual(['a-one', 'b-one', 'z-two']);
  });

  it('routes with exactly the same end board are folded into the best one and counted', () => {
    const items = [
      item('weak-hand', ev({ signature: 'same', effective: 3 }), { hand: 3 }),
      item('best', ev({ signature: 'same', effective: 3 }), { hand: 1, kind: 'available' }),
      item('mid', ev({ signature: 'same', effective: 3 }), { hand: 2 }),
      item('other', ev({ signature: 'different', effective: 1 })),
    ];
    const ranked = rankEvaluated(items, goal('interruptions'));
    expect(ranked.map((e) => e.route.id)).toEqual(['best', 'other']);
    expect(ranked[0].sameEndBoard).toBe(2);
    expect(ranked[0].foldedRouteIds).toEqual(['mid', 'weak-hand']);
    expect(ranked[1].sameEndBoard).toBe(0);
  });

  it('routes with unknown end boards or failed checks are never folded, and failed ones come last', () => {
    const items = [
      item('unknown-1', ev({ signature: '', effective: 1 })),
      item('unknown-2', ev({ signature: '', effective: 1 })),
      item('failed-1', ev({ signature: 'x', valid: false, effective: 9 })),
      item('failed-2', ev({ signature: 'x', valid: false, effective: 9 })),
      item('ok', ev({ signature: 'y', effective: 2 })),
    ];
    expect(ids(items)).toEqual(['ok', 'unknown-1', 'unknown-2', 'failed-1', 'failed-2']);
  });

  it('is deterministic and does not change its input', () => {
    const items = [item('b', ev({ signature: 'a', effective: 1 })), item('a', ev({ signature: 'b', effective: 1 }))];
    const copy = [...items];
    expect(ids(items)).toEqual(ids([...items].reverse()));
    expect(items).toEqual(copy);
  });

  it('rankForBattle ignores routes that do not match the hand', () => {
    const route = { id: 'r', name: 'r', conditions: { handAllOf: [{ anyOf: [1], count: 1 }], setup: {} }, steps: [], endBoard: [], verification: { status: 'unverified' } } as unknown as ComboRoute;
    const results: RouteResult[] = [
      { route, match: { routeId: 'r', kind: 'unavailable', reasons: [] } },
      { route, match: { routeId: 'r', kind: 'unknown', reasons: [] } },
    ];
    expect(rankForBattle(results, { main: [], extra: [] }, new Map(), goal('interruptions'))).toEqual([]);
  });
});
