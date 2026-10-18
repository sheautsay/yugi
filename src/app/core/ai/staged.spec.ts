import { DEFAULT_GOAL } from './analysis-goal';
import { malissCards, malissDeck } from '../../../testing/ai/maliss-deck.sample';
import { C, combo, samplePlan } from '../../../testing/ai/maliss-routes.sample';
import { AnalysisScope } from './prompt';
import { CARD_ROLES, DEFAULT_STAGED, STAGED_LIMITS, STAGED_PROMPT_VERSION, buildComboPrompt, buildPlanPrompt, normalizeStaged, parsePlan, selectCombos, selectedSizes, stopReason } from './staged';

// CR-008 G47 / G48 on the user's real deck. Every answer here is a MOCKED model answer built from
// HAND-WRITTEN data (maliss-routes.sample.ts), never model output.
const deck = malissDeck();
const cards = malissCards();
const scope = (o: Partial<AnalysisScope> = {}): AnalysisScope => ({ single: true, multi: true, triple: true, extenders: true, maxRoutes: 5, candidates: 6, ...o });
const plan = (combos: ReturnType<typeof combo>[]) => {
  const parsed = parsePlan(JSON.stringify(samplePlan(combos)));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.plan;
};
const cardLines = (text: string) => text.split('\n').filter((l) => l.startsWith('{"id"'));

describe('selectedSizes (G47-1)', () => {
  it('follows the three check boxes, in order', () => {
    expect(selectedSizes(scope())).toEqual([1, 2, 3]);
    expect(selectedSizes(scope({ single: false }))).toEqual([2, 3]);
    expect(selectedSizes(scope({ single: false, multi: false }))).toEqual([3]);
    expect(selectedSizes(scope({ single: false, multi: false, triple: false }))).toEqual([]);
    expect(selectedSizes({ single: true, multi: true, extenders: true, maxRoutes: 5 })).toEqual([1, 2]);
  });
});

describe('normalizeStaged (G48-5)', () => {
  it('has separate, bounded budgets', () => {
    expect(normalizeStaged()).toEqual(DEFAULT_STAGED);
    const n = normalizeStaged({ maxCombos: 99, routesPerCombo: 0, maxRequests: 1, tokenBudget: 5, totalTimeoutSeconds: 1 });
    expect(n).toEqual({ maxCombos: STAGED_LIMITS.maxCombos[1], routesPerCombo: STAGED_LIMITS.routesPerCombo[0], maxRequests: STAGED_LIMITS.maxRequests[0], tokenBudget: STAGED_LIMITS.tokenBudget[0], totalTimeoutSeconds: STAGED_LIMITS.totalTimeoutSeconds[0] });
    expect(normalizeStaged({ maxCombos: Number.NaN }).maxCombos).toBe(STAGED_LIMITS.maxCombos[0]);
  });

  it('the default whole-run time limit leaves room over the one recorded real run (1,699 s of the former 1,800 s default)', () => {
    expect(DEFAULT_STAGED.totalTimeoutSeconds).toBe(2700);
    expect(DEFAULT_STAGED.totalTimeoutSeconds).toBeGreaterThan(1699 * 1.5);
    expect(DEFAULT_STAGED.totalTimeoutSeconds).toBeLessThanOrEqual(STAGED_LIMITS.totalTimeoutSeconds[1]);
  });
});

describe('phase A prompt and plan (G47 / G48-1)', () => {
  it('sends every card of the 40+15 deck and asks for roles and combinations — not for step-by-step routes', () => {
    const p = buildPlanPrompt(deck, cards, scope(), { kind: 'interruptions', preferredExtraIds: [C.firewall, C.allied] }, DEFAULT_STAGED);
    expect(cardLines(p.user)).toHaveLength(41);
    for (const id of [C.dormouse, C.allied, C.firewall, C.transcode, C.wicckid, C.splashMage]) expect(p.user).toContain(`"id":${id},`);
    for (const role of ['Starter', 'Extender', 'Searcher', 'Combo Piece', 'Garnet', 'Hand Trap']) expect(p.system + p.user).toContain(role);
    expect(p.user).toContain('single-card, two-card and three-card');
    expect(p.user).toContain(`at most ${DEFAULT_STAGED.maxCombos} starter combinations`);
    expect(p.user).toContain(`Firewall Dragon (id ${C.firewall})`);
    expect(p.user).toContain('a preference, not a requirement');
    expect(p.system).toMatch(/do not write (out )?(any )?(step|route)/i);
    expect(p.system).toContain('not rules-verified');
  });

  it('names only the selected sizes', () => {
    const p = buildPlanPrompt(deck, cards, scope({ multi: false, triple: false }), DEFAULT_GOAL, DEFAULT_STAGED);
    expect(p.user).toContain('single-card');
    expect(p.user).not.toContain('three-card');
    expect(p.user).not.toContain('two-card');
  });

  it('parsePlan accepts the schema and rejects anything else', () => {
    expect(parsePlan(JSON.stringify(samplePlan([combo([C.dormouse], 1)])))).toMatchObject({ ok: true });
    expect(parsePlan('not json')).toMatchObject({ ok: false });
    expect(parsePlan(JSON.stringify({ summary: 'x', roles: [{ cardId: 1, roles: ['boss'], note: '' }], combos: [] }))).toMatchObject({ ok: false });
    expect(CARD_ROLES).toEqual(['starter', 'extender', 'searcher', 'combo-piece', 'garnet', 'hand-trap', 'other']);
  });
});

describe('selectCombos — the local part of phase A (G47-5 / G48-2, N38 / N39)', () => {
  const messy = plan([
    combo([C.dormouse], 1),
    combo([C.dormouse, C.impermanence], 2),
    combo([C.impermanence, C.dormouse], 3), // same cards, other order
    combo([C.dormouse, C.impermanence, C.impermanence], 4),
    combo([C.whiteBinder], 5), // Extra Deck monster
    combo([C.dormouse, C.dormouse], 6), // the deck has one Dormouse
    combo([C.impermanence, C.impermanence, C.impermanence], 7), // 3 copies exist
    combo([C.ash, C.ash, C.ash, C.ash], 8), // four cards
    combo([999999999], 9), // not in the deck
  ]);
  const hands = (r: ReturnType<typeof selectCombos>) => r.combos.map((c) => [...c.cardIds].sort((a, b) => a - b));

  it('keeps legal, distinct combinations of the selected sizes, best priority first', () => {
    const r = selectCombos(messy, deck, [1, 2, 3], 10);
    expect(hands(r)).toEqual([[C.dormouse], [C.dormouse, C.impermanence].sort((a, b) => a - b), [C.dormouse, C.impermanence, C.impermanence].sort((a, b) => a - b), [C.impermanence, C.impermanence, C.impermanence]]);
    expect(r.combos.map((c) => c.size)).toEqual([1, 2, 3, 3]);
    expect(r.combos.map((c) => c.priority)).toEqual([1, 2, 4, 7]);
  });

  it('drops and explains: duplicate, Extra Deck card, too many copies, too many cards, unknown card', () => {
    const r = selectCombos(messy, deck, [1, 2, 3], 10);
    const why = (ids: number[]) => r.rejected.find((x) => [...x.cardIds].sort().join() === [...ids].sort().join())?.reason ?? '';
    expect(why([C.impermanence, C.dormouse])).toContain('重複');
    expect(why([C.whiteBinder])).toContain('不在主牌組');
    expect(why([C.dormouse, C.dormouse])).toContain('超過');
    expect(why([C.ash, C.ash, C.ash, C.ash])).toMatch(/1～3|張數/);
    expect(why([999999999])).toContain('不在主牌組');
    expect(r.rejected).toHaveLength(5);
  });

  it('only the selected sizes; the rest says so', () => {
    const r = selectCombos(messy, deck, [1, 2], 10);
    expect(r.combos.map((c) => c.size)).toEqual([1, 2]);
    expect(r.rejected.find((x) => x.cardIds.length === 3 && x.cardIds.includes(C.dormouse))?.reason).toContain('未勾選');
  });

  it('never more combinations than the limit (N39)', () => {
    const r = selectCombos(messy, deck, [1, 2, 3], 2);
    expect(r.combos).toHaveLength(2);
    expect(r.rejected.some((x) => x.reason.includes('最大候選起手組合數'))).toBe(true);
  });

  it('ties go to the smaller combination', () => {
    const r = selectCombos(plan([combo([C.dormouse, C.impermanence], 1), combo([C.dormouse], 1)]), deck, [1, 2, 3], 5);
    expect(r.combos.map((c) => c.size)).toEqual([1, 2]);
  });
});

describe('phase B prompt (G47 / G48-3)', () => {
  const planned = selectCombos(plan([combo([C.dormouse, C.impermanence], 1, [C.allied])]), deck, [2], 3).combos[0];
  const p = buildComboPrompt(deck, cards, planned, scope(), { kind: 'targets', preferredExtraIds: [C.allied] }, { ...DEFAULT_STAGED, routesPerCombo: 3 });

  it('names the starter combination and asks every required card to take part', () => {
    expect(p.user).toContain(`Maliss <P> Dormouse (id ${C.dormouse})`);
    expect(p.user).toContain(`Infinite Impermanence (id ${C.impermanence})`);
    expect(p.user).toMatch(/every one of them must take part/i);
    expect(p.user).toContain('at most 3 routes');
    expect(p.user).toMatch(/do not add a card .* does not take part/i);
    expect(p.system).toContain('alternativeStarters');
    expect(p.system).toContain('extenderCardIds');
    expect(p.system).toContain('avoidInHand');
    expect(p.system).toContain('unresolved');
  });

  it('asks for different lines, not one line with two endings — and allows returning fewer routes', () => {
    expect(p.system).toMatch(/different LINES, not one line with two endings/);
    expect(p.system).toMatch(/first half is identical step by step count as ONE line/);
    expect(p.system).toMatch(/return only ONE route/);
    expect(p.system).toMatch(/differ only in the order of their steps/);
  });

  it('still sends the whole deck, the goal and the preferred monsters', () => {
    expect(cardLines(p.user)).toHaveLength(41);
    expect(p.user).toContain(`Allied Code Talker @Ignister (id ${C.allied})`);
    expect(p.user).toContain('Analysis goal:');
  });

  it('has its own prompt version', () => {
    expect(STAGED_PROMPT_VERSION).toBe('deck-analysis-v3.1-staged');
  });
});

describe('stopReason — the budget guard (G48-5/6, N39)', () => {
  const base = { maxRequests: 4, tokenBudget: 100_000, requests: 0, tokens: 0, startedAt: 1_000, totalTimeoutMs: 600_000 };
  const now = 2_000;

  it('is null while everything is within limits', () => {
    expect(stopReason(base, { tokens: 20_000 }, now, 10)).toBeNull();
  });

  it('stops at the request limit, the token budget, the total time and the daily limit', () => {
    expect(stopReason({ ...base, requests: 4 }, { tokens: 1 }, now, 10)).toBe('requests');
    expect(stopReason({ ...base, tokens: 90_000 }, { tokens: 20_000 }, now, 10)).toBe('tokens');
    expect(stopReason(base, { tokens: 1 }, 1_000 + 600_000, 10)).toBe('time');
    expect(stopReason(base, { tokens: 1 }, now, 0)).toBe('daily-limit');
  });

  it('a request that exactly fits the remaining tokens is allowed', () => {
    expect(stopReason({ ...base, tokens: 80_000 }, { tokens: 20_000 }, now, 1)).toBeNull();
  });
});
