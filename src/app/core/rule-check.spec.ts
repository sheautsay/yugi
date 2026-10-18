import { analysisLevel } from './analysis-level';
import { deckFingerprint } from './deck';
import { matchRoutes } from './matcher';
import { ComboRoute } from './models';
import { checkRoute } from './route-check';
import { RunContext, parseAiOutput, toCandidate } from './ai/analysis-output';
import { malissCards, malissDeck } from '../../testing/ai/maliss-deck.sample';
import {
  C,
  SampleRoute,
  mv,
  routeAllied,
  routeAlliedTooFewMaterials,
  routeFirewall,
  routeFirewallIntoAllied,
  routeMalissOnly,
  routeOcgReference,
  sampleAnswer,
  st,
} from '../../testing/ai/maliss-routes.sample';

// CR-006 G38 / N27 / N28: the partial rule check on the user's real deck and card texts.
// Every route here is HAND-WRITTEN test data run through the normal AI conversion.
const deck = malissDeck();
const cards = malissCards();
const name = (id: number) => cards.get(id)?.nameEn ?? `ID ${id}`;
const ctx: RunContext = { runId: 'run-rules', deck, deckFingerprint: deckFingerprint(deck), cardDataVersion: 'test', provider: 'anthropic', model: 'mock', promptVersion: 'deck-analysis-v2', cards, now: '2026-10-09T00:00:00.000Z' };

function toRoute(r: SampleRoute): ComboRoute {
  const parsed = parseAiOutput(JSON.stringify(sampleAnswer([r])));
  if (!parsed.ok) throw new Error(parsed.error);
  return toCandidate(parsed.output.routes[0], ctx).route;
}
const check = (r: SampleRoute | ComboRoute) => checkRoute('steps' in r && 'conditions' in r ? r : toRoute(r as SampleRoute), deck, { cards, name });
const ruleProblems = (r: SampleRoute) => check(r).problems.filter((p) => p.message.startsWith('規則檢查：'));
const withSteps = (base: SampleRoute, steps: SampleRoute['steps'], patch: Partial<SampleRoute> = {}): SampleRoute => ({ ...base, steps, ...patch });

describe('rule check — hand-written routes that follow the modelled rules (G38)', () => {
  for (const make of [routeMalissOnly, routeAllied, routeFirewall, routeFirewallIntoAllied]) {
    it(`${make().name}: no violation, still only "data-checked" (never engine-verified)`, () => {
      const result = check(make());
      expect(result.problems).toEqual([]);
      expect(result.rules?.checked.length).toBeGreaterThan(0);
      expect(analysisLevel(toRoute(make()), deck, { cards, name })).toBe('data-checked');
    });
  }

  it('slots and effect references survive the AI conversion and the Combo schema', () => {
    const route = toRoute(routeAllied());
    expect(route.steps[0].moves?.[0]).toEqual({ cardId: C.dormouse, from: 'hand', to: 'field', slot: 'M3' });
    expect(route.steps[1].effectRef).toBe(`${C.dormouse}#1`);
    expect(route.steps[0].effectRef).toBeUndefined();
  });

  it('lists what it could not check instead of guessing', () => {
    const noSlots = toRoute(routeAllied());
    noSlots.steps = noSlots.steps.map((s) => ({ ...s, moves: s.moves?.map(({ cardId, from, to }) => ({ cardId, from, to })) }));
    const result = check(noSlots);
    expect(result.passed).toBe(true);
    expect(result.rules?.unverified.map((u) => u.message).join()).toContain('格子');
  });

  it('does not apply the rule table to cards whose text differs from it (e.g. test fixtures)', () => {
    const fixtureCards = new Map([...cards].map(([id, c]) => [id, { ...c, desc: `${c.nameEn} 的測試效果文字（fixture）。` }]));
    const result = checkRoute(toRoute(routeAlliedTooFewMaterials()), deck, { cards: fixtureCards, name });
    expect(result.problems).toEqual([]);
    expect(result.rules?.unverified.length).toBeGreaterThan(0);
  });
});

describe('rule check — violations never pass (N27)', () => {
  it('Allied Code Talker from two non-Link monsters cannot make Link-5', () => {
    const problems = ruleProblems(routeAlliedTooFewMaterials());
    expect(problems.some((p) => p.message.includes('Allied Code Talker @Ignister') && p.message.includes('Link-5'))).toBe(true);
    expect(analysisLevel(toRoute(routeAlliedTooFewMaterials()), deck, { cards, name })).toBe('ai-candidate');
  });

  it('Link Decoder from a non-Cyberse monster breaks its material line', () => {
    const r = withSteps(routeAllied(), [
      st('special-summon', '特召 Eldam', [C.eldam], [mv(C.eldam, 'hand', 'field', 'M1')]),
      st('link-summon', '連結召喚 Link Decoder', [C.linkDecoder], [mv(C.eldam, 'field', 'gy', 'M1'), mv(C.linkDecoder, 'extra', 'field', 'EMZ-L')], { materials: [C.eldam] }),
    ], { handCardIds: [C.eldam], starterCardIds: [C.eldam], requiredInMain: [], requiredInExtra: [{ cardId: C.linkDecoder, count: 1 }], endBoard: [{ cardId: C.linkDecoder, zone: 'field', count: 1, note: '' }] });
    expect(ruleProblems(r).some((p) => p.message.includes('Radiant Typhoon Eldam') && p.message.includes('Cyberse'))).toBe(true);
  });

  it('an Extra Deck monster in a Main Monster Zone no Link arrow points to', () => {
    const r = routeAllied();
    r.steps[11].moves[3].slot = 'M5';
    expect(ruleProblems(r).some((p) => p.step === 12 && p.message.includes('M5') && p.message.includes('額外牌組'))).toBe(true);
  });

  it('a second Extra Monster Zone that is not pointed to', () => {
    const base = routeMalissOnly();
    const r = withSteps(base, [
      ...base.steps.slice(0, 14),
      st('link-summon', '連結召喚 Link Decoder', [C.linkDecoder], [mv(C.chessyCat, 'field', 'gy', 'M5'), mv(C.linkDecoder, 'extra', 'field', 'EMZ-L')], { materials: [C.chessyCat] }),
      st('link-summon', '連結召喚 Linguriboh', [C.linguriboh], [mv(C.whiteRabbit, 'field', 'gy', 'M4'), mv(C.linguriboh, 'extra', 'field', 'EMZ-R')], { materials: [C.whiteRabbit] }),
    ], { endBoard: [{ cardId: C.linguriboh, zone: 'field', count: 1, note: '' }] });
    expect(ruleProblems(r).some((p) => p.step === 16 && p.message.includes('EMZ-R'))).toBe(true);
  });

  it('Allied Code Talker can only Special Summon to zones it points to', () => {
    const r = routeAllied();
    r.steps[12].moves[0].slot = 'M4';
    expect(ruleProblems(r).some((p) => p.step === 13 && p.message.includes('M4') && p.message.includes('指向'))).toBe(true);
  });

  it('no Special Summon after Allied Code Talker\'s effect resolves', () => {
    const base = routeAllied();
    const r = withSteps(base, [...base.steps, st('special-summon', '再特召 White Rabbit', [C.whiteRabbit], [mv(C.whiteRabbit, 'banished', 'field', 'M5')])]);
    expect(ruleProblems(r).some((p) => p.step === 14 && p.message.includes('Allied Code Talker @Ignister') && p.message.includes('不能再特殊召喚'))).toBe(true);
  });

  it('only Cyberse monsters after Splash Mage\'s effect', () => {
    const base = routeAllied();
    const r = withSteps(base, [...base.steps.slice(0, 6), st('special-summon', '特召 Eldam', [C.eldam], [mv(C.eldam, 'hand', 'field', 'M1')])], {
      handCardIds: [C.dormouse, C.eldam],
      endBoard: [{ cardId: C.eldam, zone: 'field', count: 1, note: '' }],
    });
    expect(ruleProblems(r).some((p) => p.step === 7 && p.message.includes('Splash Mage') && p.message.includes('電子界族'))).toBe(true);
  });

  it('a "Maliss" Trap name can only be activated once per turn', () => {
    const base = routeAllied();
    const r = withSteps(base, [
      ...base.steps.slice(0, 11),
      st('activate', 'White Binder 蓋放 TB-11', [C.whiteBinder], [mv(C.tb11, 'gy', 'field', 'S1')], { ref: `${C.whiteBinder}#2`, targets: [C.tb11] }),
      st('activate', '再發動 TB-11', [C.tb11], [mv(C.dormouse, 'field', 'banished', 'M2'), mv(C.tb11, 'field', 'gy', 'S1'), mv(C.marchHare, 'deck', 'field', 'M5')], { ref: `${C.tb11}#1` }),
    ], { endBoard: [{ cardId: C.marchHare, zone: 'field', count: 1, note: '' }] });
    expect(ruleProblems(r).some((p) => p.step === 13 && p.message.includes('Maliss <C> TB-11') && p.message.includes('1 次'))).toBe(true);
  });

  it('the same once-per-turn effect cannot be used twice', () => {
    const base = routeAllied();
    const twice = st('activate', '再用 Dormouse 效果', [C.dormouse], [mv(C.marchHare, 'deck', 'banished')], { ref: `${C.dormouse}#1`, targets: [C.marchHare] });
    const r = withSteps(base, [...base.steps.slice(0, 2), twice, ...base.steps.slice(2)]);
    expect(ruleProblems(r).some((p) => p.step === 3 && p.message.includes('Maliss <P> Dormouse') && p.message.includes('1 次'))).toBe(true);
  });

  it('Firewall Dragon returns at most as many cards as monsters co-linked to it', () => {
    const base = routeFirewall();
    const r = withSteps(base, [
      ...base.steps,
      st('activate', 'Firewall Dragon 返回 2 張', [C.firewall], [mv(C.chessyCat, 'gy', 'hand'), mv(C.whiteBinder, 'field', 'hand', 'M2')], { ref: `${C.firewall}#1`, targets: [C.chessyCat, C.whiteBinder] }),
    ], { endBoard: [{ cardId: C.firewall, zone: 'field', count: 1, note: '' }] });
    expect(ruleProblems(r).some((p) => p.step === 15 && p.message.includes('Firewall Dragon') && p.message.includes('相互連結'))).toBe(true);
  });

  it('Backup @Ignister needs a Cyberse monster Special Summoned from the Extra Deck', () => {
    const r: SampleRoute = {
      ...routeAllied(),
      handCardIds: [C.backup],
      starterCardIds: [C.backup],
      requiredInMain: [],
      requiredInExtra: [],
      steps: [st('special-summon', 'Backup 自身特召', [C.backup], [mv(C.backup, 'hand', 'field', 'M1')], { ref: `${C.backup}#1` })],
      endBoard: [{ cardId: C.backup, zone: 'field', count: 1, note: '' }],
    };
    expect(ruleProblems(r).some((p) => p.step === 1 && p.message.includes('Backup @Ignister') && p.message.includes('額外牌組'))).toBe(true);
  });

  it('a monster summoned by TB-11 cannot activate its effects this turn', () => {
    const base = routeAllied();
    const r = withSteps(base, [...base.steps.slice(0, 10), st('activate', 'Chessy Cat 效果', [C.chessyCat], [], { ref: `${C.chessyCat}#1` }), ...base.steps.slice(10)]);
    expect(ruleProblems(r).some((p) => p.step === 11 && p.message.includes('Maliss <P> Chessy Cat') && p.message.includes('TB-11'))).toBe(true);
  });

  it('an effect is used from the place its text requires', () => {
    const base = routeAllied();
    const r = withSteps(base, [...base.steps.slice(0, 7), st('special-summon', 'Dormouse 從墓地特召', [C.dormouse], [mv(C.dormouse, 'gy', 'field', 'M2')], { ref: `${C.dormouse}#2` })], {
      endBoard: [{ cardId: C.whiteBinder, zone: 'field', count: 1, note: '' }],
    });
    expect(ruleProblems(r).some((p) => p.step === 8 && p.message.includes('Maliss <P> Dormouse') && p.message.includes('除外'))).toBe(true);
  });
});

describe('cards outside the deck and end-board claims (N28 / N31)', () => {
  it('the OCG reference route needs Red Ransom, Maliss in the Mirror, G Golem and Heatsoul: it cannot pass for this deck', () => {
    const result = check(routeOcgReference());
    const text = result.problems.map((p) => p.message).join('\n');
    for (const id of [C.redRansom, C.mirror, C.gGolem, C.heatsoul]) expect(text).toContain(`ID ${id}`);
    expect(analysisLevel(toRoute(routeOcgReference()), deck, { cards, name })).toBe('ai-candidate');
  });

  it('a monster used as material cannot be listed on the end board', () => {
    const r = routeAllied();
    r.endBoard.push({ cardId: C.splashMage, zone: 'field', count: 1, note: '' });
    expect(check(r).problems.map((p) => p.message)).toContain('終場列出「Splash Mage」×1（場上），但模擬結束時只有 0 張');
  });
});

describe('opening-hand query uses the rule check when card data is available (G26-3 / G38)', () => {
  it('an AI route that breaks a rule is unavailable, with the reason', () => {
    const bad = toRoute(routeAlliedTooFewMaterials());
    const hand = [C.dormouse, C.ash, C.ash, C.ash, C.fuwalos];
    const context = { turnOrder: 'first' as const, emptyBoard: true, normalSummonAvailable: true, noInterruption: true };
    const [result] = matchRoutes([bad], deck, hand, context, { name, cards });
    expect(result.match.kind).toBe('unavailable');
    expect(result.match.reasons.map((r) => r.textZhTw).join()).toContain('規則檢查');
    const [good] = matchRoutes([toRoute(routeAllied())], deck, hand, context, { name, cards });
    expect(good.match.kind).toBe('unverified');
  });
});
