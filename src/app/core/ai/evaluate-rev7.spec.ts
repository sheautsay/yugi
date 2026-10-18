import { deckFingerprint } from '../deck';
import { CardRecord, ComboRoute } from '../models';
import { RunContext, parseAiOutput, toCandidate } from './analysis-output';
import { AnalysisGoal } from './analysis-goal';
import { evaluateRoute, handText, interruptionText, rankCandidates } from './evaluate';
import { malissCards, malissDeck } from './maliss-deck.sample';
import { C, SampleRoute, mv, routeAllied, routeFirewall, routeMalissOnly, sampleAnswer, st } from './maliss-routes.sample';

// CR-007 G41 / G42 on the user's real deck. Routes are HAND-WRITTEN test data (not model output).
const deck = malissDeck();
const cards = malissCards();
const ctx: RunContext = { runId: 'run-rev7', deck, deckFingerprint: deckFingerprint(deck), cardDataVersion: 'test', provider: 'anthropic', model: 'mock', promptVersion: 'deck-analysis-v2', cards, now: '2026-10-09T00:00:00.000Z' };

function toRoute(r: SampleRoute): ComboRoute {
  const parsed = parseAiOutput(JSON.stringify(sampleAnswer([r])));
  if (!parsed.ok) throw new Error(parsed.error);
  return toCandidate(parsed.output.routes[0], ctx).route;
}
const evaluate = (r: SampleRoute | ComboRoute, c: ReadonlyMap<number, CardRecord> = cards) => evaluateRoute('conditions' in r ? r : toRoute(r), deck, c);
const goal = (kind: AnalysisGoal['kind']): AnalysisGoal => ({ kind, preferredExtraIds: [] });

describe('G41 — remaining hand: confirmed vs. untracked', () => {
  it('a single-card first-turn start leaves 0 CONFIRMED but 4 UNTRACKED cards — never a bare 0', () => {
    const e = evaluate(routeAllied());
    expect(e.handLeft).toBe(0);
    expect(e.hand).toEqual({ confirmed: 0, untracked: { min: 4, max: 4 }, complete: false });
    const text = handText(e.hand);
    expect(text).toContain('已確認 0 張');
    expect(text).toContain('未追蹤 4 張');
    expect(text).toContain('內容未知');
    expect(text).not.toBe('0 張');
  });

  it('going second: 5 untracked; unspecified turn order: a range', () => {
    const second = toRoute(routeAllied());
    second.conditions.setup.turnOrder = 'second';
    expect(evaluate(second).hand.untracked).toEqual({ min: 5, max: 5 });
    const either = toRoute(routeAllied());
    either.conditions.setup.turnOrder = 'either';
    const e = evaluate(either);
    expect(e.hand.untracked).toEqual({ min: 4, max: 5 });
    expect(handText(e.hand)).toContain('未追蹤 4～5 張');
  });

  it('listed cards are confirmed; the rest of the opening hand stays untracked', () => {
    const e = evaluate({ ...routeAllied(), handCardIds: [C.dormouse, C.ash] });
    expect(e.startKind).toBe('double');
    expect(e.hand).toEqual({ confirmed: 1, untracked: { min: 3, max: 3 }, complete: false });
  });

  it('a cost paid from "any" hand cards comes out of the untracked cards, not the confirmed ones', () => {
    const r = toRoute(routeAllied());
    r.conditions.unallocatedHandMin = 1;
    expect(evaluate(r).hand).toMatchObject({ confirmed: 0, untracked: { min: 3, max: 3 } });
  });

  it('cards the route draws into hand are confirmed', () => {
    const base = routeMalissOnly();
    const drawn: SampleRoute = { ...base, steps: [...base.steps, st('search', '檢索 Ash Blossom', [C.dormouse], [mv(C.ash, 'deck', 'hand')])] };
    expect(evaluate(drawn).hand).toMatchObject({ confirmed: 1, untracked: { min: 4, max: 4 } });
  });

  it('when every opening card is listed nothing is untracked and the text says so', () => {
    const r = toRoute(routeAllied());
    r.conditions.handAllOf = [C.dormouse, C.ash, C.whiteRabbit, C.chessyCat, C.tb11].map((id) => ({ anyOf: [id], count: 1 }));
    const e = evaluate(r);
    expect(e.hand.untracked).toEqual({ min: 0, max: 0 });
    expect(e.hand.complete).toBe(true);
    expect(handText(e.hand)).not.toContain('未追蹤');
  });

  it('an opening hand with "or" options cannot be confirmed — no number is shown', () => {
    const r = toRoute(routeAllied());
    r.conditions.handAllOf = [{ anyOf: [C.dormouse, C.ash], count: 1 }];
    const e = evaluate(r);
    expect(e.hand.confirmed).toBeNull();
    expect(e.hand.complete).toBe(false);
    expect(handText(e.hand)).toContain('無法確認');
    expect(handText(e.hand)).not.toMatch(/已確認 \d/);
  });

  it('goal C ranks by confirmed + untracked, so a single-card start is not "worse" for hiding its other cards; ties prefer confirmed cards', () => {
    const single = evaluate(routeAllied());
    const double = evaluate({ ...routeAllied(), handCardIds: [C.dormouse, C.ash] });
    const total = (e: typeof single) => (e.hand.confirmed ?? 0) + e.hand.untracked.min;
    expect(total(single)).toBe(total(double));
    const order = rankCandidates(
      [
        { index: 0, evaluation: single },
        { index: 1, evaluation: double },
      ],
      goal('resources'),
    ).map((x) => x.index);
    expect(order).toEqual([1, 0]);
  });
});

describe('G42 — interruptions: static estimate vs. verified; on the field is not the same as effective', () => {
  it('every interruption is a static estimate and nothing is verified', () => {
    for (const r of [routeAllied(), routeFirewall(), routeMalissOnly()]) {
      const e = evaluate(r);
      expect(e.interruptions.length).toBeGreaterThan(0);
      expect(e.interruptions.every((i) => i.basis === 'static-estimate')).toBe(true);
      expect(e.verified).toBe(0);
    }
    const text = interruptionText(evaluate(routeAllied()));
    expect(text).toContain('靜態估算 1 項');
    expect(text).toContain('已驗證 0 項');
  });

  it('Allied Code Talker on the end board but with no Link monster in its pointed zones: not counted', () => {
    const base = routeAllied();
    const noWb: SampleRoute = { ...base, steps: base.steps.slice(0, -1), endBoard: [{ cardId: C.allied, zone: 'field', count: 1, note: '' }] };
    const e = evaluate(noWb);
    expect(e.finalMonsters).toContain(C.allied);
    const act = e.interruptions.find((i) => i.cardId === C.allied)!;
    expect(act.status).toBe('inactive');
    expect(e.effective).toBe(0);
    expect(interruptionText(e)).toContain('靜態估算 0 項');
  });

  it('Firewall Dragon on the end board but nothing co-linked: not counted', () => {
    const base = routeFirewall();
    const alone: SampleRoute = { ...base, steps: base.steps.slice(0, -1), endBoard: [{ cardId: C.firewall, zone: 'field', count: 1, note: '' }] };
    const e = evaluate(alone);
    expect(e.finalMonsters).toContain(C.firewall);
    expect(e.interruptions.find((i) => i.cardId === C.firewall)?.status).toBe('inactive');
    expect(e.effective).toBe(0);
  });

  it('a monster whose effect needs the opponent board (S:P Little Knight) is "conditional" and not counted', () => {
    const base = routeMalissOnly();
    const lk: SampleRoute = {
      ...base,
      steps: [
        st('normal-summon', '通常召喚 Dormouse', [C.dormouse], [mv(C.dormouse, 'hand', 'field', 'M3')]),
        st('special-summon', '特召 Chessy Cat', [C.chessyCat], [mv(C.chessyCat, 'deck', 'field', 'M4')]),
        st('link-summon', '連結召喚 S:P Little Knight', [C.littleKnight], [mv(C.dormouse, 'field', 'gy', 'M3'), mv(C.chessyCat, 'field', 'gy', 'M4'), mv(C.littleKnight, 'extra', 'field', 'EMZ-L')], { materials: [C.dormouse, C.chessyCat] }),
      ],
      endBoard: [{ cardId: C.littleKnight, zone: 'field', count: 1, note: '' }],
    };
    const e = evaluate(lk);
    expect(e.finalMonsters).toContain(C.littleKnight);
    const knight = e.interruptions.find((i) => i.cardId === C.littleKnight)!;
    expect(knight.status).toBe('conditional');
    expect(knight.reason).toContain('對手');
    expect(e.effective).toBe(0);
    expect(e.conditional).toBe(1);
  });

  it('goal A orders by the static estimate; a card merely on the field does not move a route up', () => {
    const items = [routeMalissOnly(), routeAllied()].map((r, index) => ({ index, evaluation: evaluate(r) }));
    expect(rankCandidates(items, goal('interruptions')).map((x) => x.index)).toEqual([1, 0]);
  });
});
