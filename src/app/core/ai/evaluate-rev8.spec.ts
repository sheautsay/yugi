import { deckFingerprint } from '../deck';
import { ComboRoute } from '../models';
import { RunContext, parseAiOutput, toCandidate } from './analysis-output';
import { AnalysisGoal } from './analysis-goal';
import { RouteEvaluation, addedValue, evaluateRoute, foldDuplicates, groupBySize, rankCandidates } from './evaluate';
import { malissCards, malissDeck } from './maliss-deck.sample';
import { C, SampleRoute, routeAllied, routeAlliedPlusTrap, routeAlliedPlusTwoTraps, routeAlliedTooFewMaterials, routeFirewallIntoAllied, routeMalissOnly, routeMalissPlusMtp, routeMalissPlusMtpUnderground, sampleAnswer, withRoles } from './maliss-routes.sample';
import { REAL_RUN_RECORD } from './real-ai-run.sample';
import { STAGED_PROMPT_VERSION } from './staged';

// CR-008 G50 / G52 on the user's real deck. Routes are HAND-WRITTEN test data (not model output).
// A few cases below modify a real evaluation's numbers on purpose, to test the comparison logic alone.
const deck = malissDeck();
const cards = malissCards();
const ctx: RunContext = { runId: 'run-rev8', deck, deckFingerprint: deckFingerprint(deck), cardDataVersion: 'test', provider: 'anthropic', model: 'mock', promptVersion: STAGED_PROMPT_VERSION, cards, now: '2026-10-09T00:00:00.000Z' };
const name = (id: number) => cards.get(id)?.nameEn ?? `ID ${id}`;

function toRoute(r: SampleRoute): ComboRoute {
  const parsed = parseAiOutput(JSON.stringify(sampleAnswer([r])));
  if (!parsed.ok) throw new Error(parsed.error);
  return toCandidate(parsed.output.routes[0], ctx).route;
}
const evaluate = (r: SampleRoute): RouteEvaluation => evaluateRoute(toRoute(withRoles(r)), deck, cards, undefined, name);
const goal = (kind: AnalysisGoal['kind'], preferredExtraIds: number[] = []): AnalysisGoal => ({ kind, preferredExtraIds });
const item = (index: number, evaluation: RouteEvaluation) => ({ index, evaluation });

describe('starter size and follow-up resources (G50 / G52)', () => {
  it('1, 2 and 3 required cards are single / double / triple, by the cards the route really lists', () => {
    const [a, b, c] = [routeAllied(), routeAlliedPlusTrap(), routeAlliedPlusTwoTraps()].map(evaluate);
    expect([a.startKind, b.startKind, c.startKind]).toEqual(['single', 'double', 'triple']);
    expect(a.starters).toEqual([C.dormouse]);
    expect(c.starters).toEqual([C.impermanence, C.impermanence, C.dormouse].sort((x, y) => x - y));
    expect(b.starterKey).toBe([C.dormouse, C.impermanence].sort((x, y) => x - y).join('+'));
  });

  it('follow-up resources are shown with their basis; spending a hand card to Set a trap is not a gain', () => {
    const base = evaluate(routeAllied());
    const plus = evaluate(routeAlliedPlusTrap());
    expect(base.followUp).toMatchObject({ hand: 4, backrow: 0 });
    expect(plus.followUp).toMatchObject({ hand: 3, backrow: 1 });
    expect(plus.followUp.total).toBe(base.followUp.total);
    expect(plus.followUp.basis.join('；')).toContain('蓋放');
    expect(base.followUp.basis.join('；')).toContain('手牌');
  });

  it('cards in the Graveyard or banished zone count only when the rule table gives them an effect that works there', () => {
    // Recorded real route (AI-generated): Maliss <P> March Hare ends banished, and it has an "if banished" effect.
    const real = evaluateRoute(REAL_RUN_RECORD.candidates[0].route, deck, cards, undefined, name);
    expect(real.followUp.recoverable).toBeGreaterThanOrEqual(1);
    expect(real.followUp.basis.some((b) => b.includes('除外') && b.includes('Maliss <P> March Hare'))).toBe(true);
    expect(real.followUp.total).toBe(real.followUp.hand + real.followUp.backrow + real.followUp.recoverable);
    // Hand-written route: its Maliss monsters end in the Graveyard, where they have no effect of their own.
    expect(evaluate(routeMalissOnly()).followUp.recoverable).toBe(0);
  });
});

describe('rankCandidates — balanced goal and no preference for more cards (G50-1/4, N44)', () => {
  const base = evaluate(routeAllied());
  const tweak = (e: RouteEvaluation, effective: number, total: number, startKind = e.startKind): RouteEvaluation => ({ ...e, effective, startKind, followUp: { ...e.followUp, total } });

  it('E — balanced: interruptions plus follow-up first, interruptions break ties', () => {
    const items = [item(0, tweak(base, 1, 8)), item(1, tweak(base, 2, 5)), item(2, tweak(base, 3, 6)), item(3, tweak(base, 1, 9))];
    // sums: 9, 7, 9, 10 → 3 first; the two 9s are ordered by interruptions (3 before 1); 7 last
    expect(rankCandidates(items, goal('balanced')).map((r) => r.index)).toEqual([3, 2, 0, 1]);
  });

  it('the number of required cards never decides the order', () => {
    const one = evaluate(routeAllied());
    const three = evaluate(routeAlliedPlusTwoTraps());
    // (Goal "resources" is left out on purpose: it ranks by the hand cards kept, which a route that
    // spends more cards really does lose. That is the result, not the number of cards.)
    for (const kind of ['interruptions', 'targets', 'diverse', 'balanced'] as const) {
      expect(rankCandidates([item(0, one), item(1, three)], goal(kind)).map((r) => r.index), kind).toEqual([0, 1]);
      expect(rankCandidates([item(0, three), item(1, one)], goal(kind)).map((r) => r.index), kind).toEqual([0, 1]);
    }
    const weaker = tweakEffective(three, 0);
    expect(rankCandidates([item(0, weaker), item(1, one)], goal('interruptions')).map((r) => r.index)).toEqual([1, 0]);
  });

  it('ATK, Link Rating and the number of monsters on the end board are not part of the score', () => {
    const many = { ...base, finalMonsters: [...base.finalMonsters, ...base.finalMonsters, ...base.finalMonsters] };
    expect(rankCandidates([item(0, base), item(1, many)], goal('balanced')).map((r) => r.index)).toEqual([0, 1]);
  });

  it('a preferred monster used only on the way is "intermediate", not on the end board (G50-5)', () => {
    const viaFirewall = evaluate(routeFirewallIntoAllied());
    expect(viaFirewall.extraUsed).toContainEqual({ cardId: C.firewall, onFinalBoard: false });
    const ranked = rankCandidates([item(0, viaFirewall)], goal('targets', [C.firewall]));
    expect(ranked[0].targetsOnBoard).toBe(0);
    expect(ranked[0].targetsIntermediate).toBe(1);
  });
});

function tweakEffective(e: RouteEvaluation, effective: number): RouteEvaluation {
  return { ...e, effective };
}

describe('foldDuplicates (G52-6)', () => {
  const allied = evaluate(routeAllied());
  const viaFirewall = evaluate(routeFirewallIntoAllied());
  const malissOnly = evaluate(routeMalissOnly());
  const plus = evaluate(routeAlliedPlusTrap());
  const plusReordered = evaluate({ ...routeAlliedPlusTrap(), handCardIds: [C.impermanence, C.dormouse] });

  it('same starter cards and same end board fold into the first, whatever the step order', () => {
    expect(allied.signature).toBe(viaFirewall.signature);
    const ranked = rankCandidates([item(0, allied), item(1, malissOnly), item(2, viaFirewall)], goal('interruptions'));
    const { kept, folded } = foldDuplicates(ranked);
    expect(folded).toEqual([{ index: 2, into: 0 }]);
    expect(kept.map((r) => r.index)).toEqual([0, 1]);
  });

  it('the order of the starter cards does not matter', () => {
    const { folded } = foldDuplicates(rankCandidates([item(0, plus), item(1, plusReordered)], goal('interruptions')));
    expect(folded).toEqual([{ index: 1, into: 0 }]);
  });

  it('different starters with the same board, or the same starters with different boards, are all kept', () => {
    const { kept, folded } = foldDuplicates(rankCandidates([item(0, allied), item(1, plus), item(2, malissOnly)], goal('interruptions')));
    expect(folded).toEqual([]);
    expect(kept).toHaveLength(3);
  });

  it('a route that failed its checks is never folded into anything', () => {
    const broken = { ...allied, valid: false };
    const { folded } = foldDuplicates(rankCandidates([item(0, allied), item(1, broken)], goal('interruptions')));
    expect(folded).toEqual([]);
  });
});

describe('addedValue — what the extra cards bring (G52-4, N44)', () => {
  const one = evaluate(routeAllied());
  const two = evaluate(routeAlliedPlusTrap());
  const three = evaluate(routeAlliedPlusTwoTraps());

  it('compares with the nearest route whose starters are a proper subset', () => {
    const v = addedValue(item(2, three), [item(0, one), item(1, two), item(2, three)], name)!;
    expect(v.baseIndex).toBe(1);
    expect(v.addedStarters).toEqual([C.impermanence]);
    expect(v.addedOnBoard).toEqual([C.impermanence]);
    expect(v.removedFromBoard).toEqual([]);
  });

  it('two cards over one: an extra Set trap, one hand card fewer — no net gain, said plainly', () => {
    const v = addedValue(item(1, two), [item(0, one), item(1, two)], name)!;
    expect(v.baseIndex).toBe(0);
    expect(v.effectiveDelta).toBe(0);
    expect(v.followUpDelta).toBe(0);
    expect(v.verdict).toBe('same');
    expect(v.summary).toContain('Infinite Impermanence');
    expect(v.summary).toContain('蓋放');
    expect(v.summary).toMatch(/手牌.*少 1|少.*手牌/);
  });

  it('verdicts: better, worse, mixed', () => {
    const plus = (effective: number, total: number) => ({ ...two, effective, followUp: { ...two.followUp, total } });
    const verdict = (e: RouteEvaluation) => addedValue(item(1, e), [item(0, one), item(1, e)], name)!.verdict;
    expect(verdict(plus(one.effective + 1, one.followUp.total))).toBe('better');
    expect(verdict(plus(one.effective, one.followUp.total + 2))).toBe('better');
    expect(verdict(plus(one.effective - 1, one.followUp.total))).toBe('worse');
    expect(verdict(plus(one.effective + 1, one.followUp.total - 2))).toBe('mixed');
  });

  it('the conclusion names what did NOT improve, so "better" is never read as more than it is', () => {
    const summary = (effective: number, total: number) => addedValue(item(1, { ...two, effective, followUp: { ...two.followUp, total } }), [item(0, one), item(1, two)], name)!.summary;
    expect(summary(one.effective, one.followUp.total + 2)).toContain('結論：較好（靜態估算的有效干擾沒有增加');
    expect(summary(one.effective + 1, one.followUp.total)).toContain('結論：較好（後續資源沒有增加）');
    expect(summary(one.effective, one.followUp.total - 1)).toContain('結論：較差（有效干擾沒有增加');
    expect(summary(one.effective + 1, one.followUp.total - 2)).toContain('結論：各有取捨（有效干擾 +1，後續資源 -2）');
    expect(summary(one.effective, one.followUp.total)).toMatch(/結論：相同$/);
  });

  it('nothing to compare with: single-card routes, no smaller route, a different card, or a smaller route that failed its checks', () => {
    expect(addedValue(item(0, one), [item(0, one), item(1, two)], name)).toBeNull();
    expect(addedValue(item(1, two), [item(1, two)], name)).toBeNull();
    const other = evaluate({ ...routeAlliedPlusTrap(), handCardIds: [C.dormouse, C.ash] });
    expect(addedValue(item(1, other), [item(0, evaluate(routeMalissOnly())), item(1, other)], name)).not.toBeNull(); // Dormouse alone is a subset
    expect(addedValue(item(1, two), [item(0, other), item(1, two)], name)).toBeNull(); // [Dormouse, Ash] is not a subset of [Dormouse, Impermanence]
    const broken = evaluate(routeAlliedTooFewMaterials());
    expect(broken.valid).toBe(false);
    expect(addedValue(item(1, two), [item(0, broken), item(1, two)], name)).toBeNull();
  });
});

describe('one, two, three required cards: what each one adds (G47 / G52, hand-written routes)', () => {
  const one = evaluate(routeMalissOnly());
  const two = evaluate(routeMalissPlusMtp());
  const three = evaluate(routeMalissPlusMtpUnderground());
  const all = [item(0, one), item(1, two), item(2, three)];

  it('all three are valid routes of their size', () => {
    expect([one, two, three].map((e) => [e.valid, e.startKind])).toEqual([[true, 'single'], [true, 'double'], [true, 'triple']]);
  });

  it('the second card (a Set MTP-07) adds a real interruption: it banishes with Maliss Link Monsters on the board', () => {
    expect(one.effective).toBe(0);
    expect(two.effective).toBe(1);
    const v = addedValue(all[1], all, name)!;
    expect([v.baseIndex, v.effectiveDelta, v.verdict]).toEqual([0, 1, 'better']);
    expect(v.addedOnBoard).toEqual([C.mtp07]);
  });

  it('the third card (a Field Spell that banishes a Maliss card) gives Hearts Crypter the target it was missing: one more real interruption', () => {
    const hc = (e: RouteEvaluation) => e.interruptions.find((i) => i.cardId === C.heartsCrypter)!;
    expect(hc(two).status).toBe('inactive'); // nothing banished to target
    expect(hc(three).status).toBe('effective');
    expect(hc(three).reason).toContain('Maliss <P> March Hare');
    const v = addedValue(all[2], all, name)!;
    expect(v.baseIndex).toBe(1);
    expect(v.addedStarters).toEqual([C.underground]);
    expect([v.effectiveDelta, v.verdict]).toEqual([1, 'better']);
    expect(v.addedOnBoard).toContain(C.underground);
  });
});

describe('groupBySize (G52-1)', () => {
  it('splits into single / double / triple, keeping the given order', () => {
    const items = [routeAlliedPlusTwoTraps(), routeAllied(), routeAlliedPlusTrap(), routeMalissOnly()].map((r, i) => item(i, evaluate(r)));
    const groups = groupBySize(items);
    expect(groups.single.map((x) => x.index)).toEqual([1, 3]);
    expect(groups.double.map((x) => x.index)).toEqual([2]);
    expect(groups.triple.map((x) => x.index)).toEqual([0]);
    expect(groups.other).toEqual([]);
  });
});
