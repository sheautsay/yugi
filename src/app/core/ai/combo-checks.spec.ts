import { analysisLevel } from '../analysis-level';
import { deckFingerprint } from '../deck';
import { ComboRoute } from '../models';
import { checkRoute } from '../route-check';
import { RunContext, parseAiOutput, toCandidate } from './analysis-output';
import { malissCards, malissDeck } from '../../../testing/ai/maliss-deck.sample';
import { C, SampleRoute, mv, routeAllied, routeAlliedPlusTrap, routeAlliedPlusTwoTraps, routeAlliedWithIdleThirdCard, sampleAnswer, st, withRoles } from '../../../testing/ai/maliss-routes.sample';
import { STAGED_PROMPT_VERSION } from './staged';

// CR-008 G47-3/4, G49-1/2/3, G53, N37 / N41 / N43. All routes are HAND-WRITTEN test data run through
// the real conversion and the real checks — none is model output.
const deck = malissDeck();
const cards = malissCards();
const ctx: RunContext = { runId: 'run-rev8', deck, deckFingerprint: deckFingerprint(deck), cardDataVersion: 'test', provider: 'anthropic', model: 'mock', promptVersion: STAGED_PROMPT_VERSION, cards, now: '2026-10-09T00:00:00.000Z' };
const name = (id: number) => cards.get(id)?.nameEn ?? `ID ${id}`;

function convert(r: SampleRoute): ComboRoute {
  const parsed = parseAiOutput(JSON.stringify(sampleAnswer([r])));
  if (!parsed.ok) throw new Error(parsed.error);
  return toCandidate(parsed.output.routes[0], ctx).route;
}
const problems = (r: SampleRoute | ComboRoute) => checkRoute('conditions' in r ? r : convert(r), deck, { cards }).problems.map((p) => p.message);
const level = (r: SampleRoute) => analysisLevel(convert(r), deck, { cards, name });

describe('role fields (G47-3)', () => {
  it('a v3 route keeps who is required, what can replace it, the extenders, and what must stay in the Deck', () => {
    const r = convert(
      withRoles(routeAlliedPlusTrap(), {
        alternativeStarters: [{ cardId: C.impermanence, instead: [C.ash], note: '同為手坑／蓋牌（AI 標示，未驗證）' }],
        extenderCardIds: [C.backup],
        avoidInHand: [C.whiteRabbit, C.tb11, C.chessyCat],
      }),
    );
    expect(r.analysis?.combo).toEqual({
      required: [C.dormouse, C.impermanence],
      alternatives: [{ cardId: C.impermanence, instead: [C.ash], note: '同為手坑／蓋牌（AI 標示，未驗證）' }],
      extenders: [C.backup],
      avoidInHand: [C.whiteRabbit, C.tb11, C.chessyCat],
    });
    expect(r.conditions.mustRemainInMain?.map((x) => x.cardId)).toEqual(expect.arrayContaining([C.whiteRabbit, C.tb11, C.chessyCat]));
    expect(problems(r)).toEqual([]);
  });

  it('an older-shaped answer (no role fields) has no combo info', () => {
    expect(convert(routeAlliedPlusTrap()).analysis?.combo).toBeUndefined();
  });

  it('the combo info survives the stored-data schema (so it can be saved as a Combo)', () => {
    const parsed = parseAiOutput(JSON.stringify(sampleAnswer([withRoles(routeAlliedPlusTrap())])));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(toCandidate(parsed.output.routes[0], ctx).schemaErrors).toEqual([]);
  });
});

describe('every required starter card must take part (G47-4, N37)', () => {
  it('1, 2 and 3 required cards that are all used pass the checks', () => {
    for (const r of [routeAllied(), routeAlliedPlusTrap(), routeAlliedPlusTwoTraps()]) {
      const route = convert(withRoles(r));
      expect(problems(route)).toEqual([]);
      expect(level(withRoles(r))).toBe('data-checked');
    }
  });

  it('a third required card that no step uses is rejected and named — it cannot be a three-card route', () => {
    const r = withRoles(routeAlliedWithIdleThirdCard());
    const found = problems(r);
    expect(found.some((m) => m.includes('Ash Blossom') && m.includes('沒有參與'))).toBe(true);
    expect(level(r)).toBe('ai-candidate');
  });

  it('two copies of the same required card: both copies must be used', () => {
    const base = routeAlliedPlusTwoTraps();
    const oneSet: SampleRoute = { ...base, steps: base.steps.slice(0, -1) };
    expect(problems(withRoles(oneSet)).some((m) => m.includes('Infinite Impermanence') && m.includes('2'))).toBe(true);
    expect(problems(withRoles(base))).toEqual([]);
  });

  it('routes without role fields are judged exactly as before (G49-3)', () => {
    expect(problems(routeAlliedWithIdleThirdCard())).toEqual([]);
  });
});

describe('complete steps (G49-1/2, N41)', () => {
  it('a step marked unresolved makes the route fail and says which step', () => {
    const base = withRoles(routeAllied());
    const steps = base.steps.map((s, i) => (i === 3 ? { ...s, unresolved: '無法確定要選哪一張卡' } : s));
    const found = problems({ ...base, steps });
    expect(found.some((m) => m.includes('未完成') && m.includes('無法確定要選哪一張卡'))).toBe(true);
    expect(level({ ...base, steps })).toBe('ai-candidate');
    const route = convert({ ...base, steps });
    expect(route.steps[3].unresolved).toBe('無法確定要選哪一張卡');
    expect(checkRoute(route, deck, { cards }).problems.find((p) => p.message.includes('未完成'))?.step).toBe(4);
  });

  it('a step that moves no card cannot be checked, so the route fails', () => {
    const base = withRoles(routeAllied());
    const steps = [...base.steps.slice(0, 5), st('other', '接著正常展開', [C.dormouse], []), ...base.steps.slice(5)];
    expect(problems({ ...base, steps }).some((m) => m.includes('沒有任何卡片移動'))).toBe(true);
  });

  it('old-shaped routes with such steps are not affected', () => {
    const base = routeAllied();
    const steps = [...base.steps.slice(0, 5), st('other', '接著正常展開', [C.dormouse], []), ...base.steps.slice(5)];
    expect(problems({ ...base, steps }).some((m) => m.includes('沒有任何卡片移動'))).toBe(false);
  });
});

describe('components that must stay in the Deck (G47-3, N43)', () => {
  it('a card marked "do not draw" must not be among the required starters', () => {
    const r = withRoles(routeAlliedPlusTrap(), { avoidInHand: [C.impermanence, C.whiteRabbit] });
    expect(problems(r).some((m) => m.includes('Infinite Impermanence') && m.includes('不希望抽上手'))).toBe(true);
  });

  it('it must also be listed as "must stay in the Deck"', () => {
    const r = withRoles(routeAlliedPlusTrap(), { avoidInHand: [C.ash] });
    expect(problems(r).some((m) => m.includes('Ash Blossom') && m.includes('必須留在牌組'))).toBe(true);
  });

  it('a substitute card has to be in the Main Deck', () => {
    const r = withRoles(routeAlliedPlusTrap(), { alternativeStarters: [{ cardId: C.impermanence, instead: [C.whiteBinder], note: '' }] });
    expect(problems(r).some((m) => m.includes('White Binder') && m.includes('替代'))).toBe(true);
  });

  it('the copies left in the Deck after the opening hand are counted (N38)', () => {
    // The deck has three Infinite Impermanence: two in hand leaves one, so the route cannot also need two in the Deck.
    const base = withRoles(routeAlliedPlusTwoTraps());
    const r: SampleRoute = { ...base, requiredInMain: [...base.requiredInMain, { cardId: C.impermanence, count: 2 }] };
    expect(problems(r).some((m) => m.includes('Infinite Impermanence') && m.includes('只剩 1 張'))).toBe(true);
    expect(problems({ ...base, requiredInMain: [...base.requiredInMain, { cardId: C.impermanence, count: 1 }] })).toEqual([]);
  });

  it('more than three required cards is not a 1–3 card route', () => {
    const base = withRoles(routeAlliedPlusTwoTraps());
    const r: SampleRoute = { ...base, handCardIds: [...base.handCardIds, C.maxx], steps: [...base.steps, st('set', '蓋放（佔位）', [C.maxx], [mv(C.maxx, 'hand', 'gy')])] };
    expect(problems(r).some((m) => m.includes('1～3'))).toBe(true);
  });
});
