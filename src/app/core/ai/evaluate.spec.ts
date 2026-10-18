import { deckFingerprint } from '../deck';
import { CardRecord, ComboRoute } from '../models';
import { checkRoute } from '../route-check';
import { RunContext, parseAiOutput, toCandidate } from './analysis-output';
import { AnalysisGoal } from './analysis-goal';
import { evaluateRoute, rankCandidates, targetCoverage } from './evaluate';
import { malissCards, malissDeck } from '../../../testing/ai/maliss-deck.sample';
import { C, SampleRoute, routeAllied, routeAlliedTooFewMaterials, routeFirewall, routeFirewallIntoAllied, routeMalissOnly, sampleAnswer } from '../../../testing/ai/maliss-routes.sample';

// CR-006 G36 / G37 / G39 on the user's real deck. Routes are HAND-WRITTEN test data (not model output).
const deck = malissDeck();
const cards = malissCards();
const ctx: RunContext = { runId: 'run-eval', deck, deckFingerprint: deckFingerprint(deck), cardDataVersion: 'test', provider: 'anthropic', model: 'mock', promptVersion: 'deck-analysis-v2', cards, now: '2026-10-09T00:00:00.000Z' };

function toRoute(r: SampleRoute): ComboRoute {
  const parsed = parseAiOutput(JSON.stringify(sampleAnswer([r])));
  if (!parsed.ok) throw new Error(parsed.error);
  return toCandidate(parsed.output.routes[0], ctx).route;
}
const evaluate = (r: SampleRoute | ComboRoute, c: ReadonlyMap<number, CardRecord> = cards) => evaluateRoute('conditions' in r ? r : toRoute(r), deck, c);
const goal = (kind: AnalysisGoal['kind'], preferredExtraIds: number[] = []): AnalysisGoal => ({ kind, preferredExtraIds });

describe('evaluateRoute — the end board and real interruptions (G37)', () => {
  it('Allied Code Talker pointing to White Binder: one effective negate; Splash Mage was only used on the way', () => {
    const e = evaluate(routeAllied());
    expect(e.valid).toBe(true);
    expect(e.startKind).toBe('single');
    expect(e.finalMonsters.sort()).toEqual([C.allied, C.whiteBinder].sort());
    expect(e.extraUsed).toEqual(
      expect.arrayContaining([
        { cardId: C.splashMage, onFinalBoard: false },
        { cardId: C.whiteBinder, onFinalBoard: true },
        { cardId: C.allied, onFinalBoard: true },
      ]),
    );
    const negate = e.interruptions.find((i) => i.cardId === C.allied)!;
    expect(negate.status).toBe('effective');
    expect(e.effective).toBe(1);
  });

  it('summoned is not the same as an interruption: Hearts Crypter with no banished "Maliss" card to target', () => {
    const e = evaluate(routeMalissOnly());
    expect(e.finalMonsters.sort()).toEqual([C.whiteBinder, C.heartsCrypter].sort());
    const banish = e.interruptions.find((i) => i.cardId === C.heartsCrypter)!;
    expect(banish.status).toBe('inactive');
    expect(banish.reason).toContain('除外');
    expect(e.effective).toBe(0);
  });

  it('Firewall Dragon co-linked with White Binder can return 1 card; used only as material it is "intermediate"', () => {
    const f = evaluate(routeFirewall());
    const bounce = f.interruptions.find((i) => i.cardId === C.firewall)!;
    expect(bounce.status).toBe('effective');
    expect(bounce.reason).toContain('1');
    const af = evaluate(routeFirewallIntoAllied());
    expect(af.extraUsed).toContainEqual({ cardId: C.firewall, onFinalBoard: false });
    expect(af.finalMonsters).not.toContain(C.firewall);
  });

  it('without zone data an arrow-based interruption is "conditional", never counted as effective', () => {
    const route = toRoute(routeAllied());
    route.steps = route.steps.map((s) => ({ ...s, moves: s.moves?.map(({ cardId, from, to }) => ({ cardId, from, to })) }));
    const e = evaluate(route);
    expect(e.interruptions.find((i) => i.cardId === C.allied)?.status).toBe('conditional');
    expect(e.effective).toBe(0);
    expect(e.conditional).toBe(1);
  });

  it('a route that breaks a rule is not valid, whatever its end board', () => {
    const e = evaluate(routeAlliedTooFewMaterials());
    expect(e.valid).toBe(false);
    expect(e.problemCount).toBeGreaterThan(0);
  });

  it('two-card starts and kept hand cards are reported', () => {
    const e = evaluate({ ...routeAllied(), handCardIds: [C.dormouse, C.ash] });
    expect(e.startKind).toBe('double');
    expect(e.handLeft).toBe(1);
  });
});

describe('rankCandidates (G36-3 / G37-3)', () => {
  const routes = [routeMalissOnly(), routeAllied(), routeFirewall(), routeFirewallIntoAllied(), routeAlliedTooFewMaterials()];
  const items = (c: ReadonlyMap<number, CardRecord> = cards) => routes.map((r, index) => ({ index, evaluation: evaluate(r, c) }));
  const order = (g: AnalysisGoal, c?: ReadonlyMap<number, CardRecord>) => rankCandidates(items(c), g).map((x) => x.index);

  it('A — interruptions: the 0-interruption Maliss-only board comes after boards with a real interruption; invalid last', () => {
    const o = order(goal('interruptions'));
    expect(o.at(-1)).toBe(4);
    expect(o.indexOf(0)).toBe(3);
  });

  it('ATK and Link Rating never change the order', () => {
    // Legality comes from the real data; only the evaluation and ranking see the inflated values
    // (a different Link Rating would legitimately change whether a Link Summon is legal).
    const inflated = new Map([...cards].map(([id, c]) => [id, { ...c, atk: id === C.heartsCrypter || id === C.whiteBinder ? 9999 : c.atk, linkval: id === C.heartsCrypter ? 9 : c.linkval }]));
    const evaluations = routes.map((r, index) => {
      const route = toRoute(r);
      return { index, evaluation: evaluateRoute(route, deck, inflated, checkRoute(route, deck, { cards })) };
    });
    expect(rankCandidates(evaluations, goal('interruptions')).map((x) => x.index)).toEqual(order(goal('interruptions')));
  });

  it('B — preferred Allied Code Talker: routes ending on it first', () => {
    const o = order(goal('targets', [C.allied]));
    expect(o.slice(0, 2).sort()).toEqual([1, 3]);
    expect(o.at(-1)).toBe(4);
  });

  it('B — preferred Firewall Dragon: on the end board first, then used only as material', () => {
    expect(order(goal('targets', [C.firewall])).slice(0, 2)).toEqual([2, 3]);
  });

  it('C — resources: the route that keeps a card in hand comes first', () => {
    const withHand = [...routes.slice(0, 4), { ...routeMalissOnly(), handCardIds: [C.dormouse, C.ash] }];
    const ranked = rankCandidates(
      withHand.map((r, index) => ({ index, evaluation: evaluate(r) })),
      goal('resources'),
    );
    expect(ranked[0].index).toBe(4);
  });

  it('D — diverse: different end boards first; the same end board is marked as such', () => {
    const ranked = rankCandidates(items(), goal('diverse'));
    const valid = ranked.filter((r) => r.evaluation.valid);
    const firstThree = valid.slice(0, 3).map((r) => r.evaluation.signature);
    expect(new Set(firstThree).size).toBe(3);
    const dup = ranked.find((r) => r.sameEndBoardAs !== undefined);
    expect(dup?.index).toBe(3);
    expect(dup?.sameEndBoardAs).toBe(1);
  });
});

describe('targetCoverage — "未找到已驗證路線" (G39 / N29)', () => {
  const cover = (rs: SampleRoute[], ids: number[], explored: Array<{ extraDeckCardIds: number[]; finalBoardCardIds: number[] }> = []) =>
    targetCoverage(
      rs.map((r, index) => ({ index, evaluation: evaluate(r) })),
      ids,
      explored,
    );

  it('found: counts only valid routes that END with the monster', () => {
    const [act] = cover([routeAllied(), routeFirewallIntoAllied(), routeAlliedTooFewMaterials()], [C.allied]);
    expect(act).toMatchObject({ cardId: C.allied, found: true, onFinalBoard: 2, failedChecks: 1 });
  });

  it('not proposed at all', () => {
    const [act] = cover([routeMalissOnly()], [C.allied]);
    expect(act.found).toBe(false);
    expect(act.message).toContain('未找到已驗證路線');
  });

  it('proposed but failing the checks', () => {
    const [act] = cover([routeAlliedTooFewMaterials()], [C.allied]);
    expect(act.found).toBe(false);
    expect(act.message).toContain('未找到已驗證路線');
    expect(act.message).toContain('未通過');
  });

  it('only used on the way', () => {
    const [fw] = cover([routeFirewallIntoAllied()], [C.firewall]);
    expect(fw.found).toBe(false);
    expect(fw.message).toContain('未找到已驗證路線');
    expect(fw.message).toContain('中途');
  });

  it('only mentioned by the model without a written-out route', () => {
    const [act] = cover([routeMalissOnly()], [C.allied], [{ extraDeckCardIds: [C.allied], finalBoardCardIds: [C.allied] }]);
    expect(act.found).toBe(false);
    expect(act.message).toContain('未找到已驗證路線');
    expect(act.message).toContain('沒有展開');
  });

  it('never claims impossibility', () => {
    const all = cover([routeMalissOnly(), routeAlliedTooFewMaterials()], [C.allied, C.firewall, C.transcode]);
    for (const c of all) expect(c.message).not.toMatch(/不可能|無法達成|做不到/);
  });
});
