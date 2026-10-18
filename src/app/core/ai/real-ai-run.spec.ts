import { analysisLevel } from '../analysis-level';
import { ComboRoute } from '../models';
import { checkRoute } from '../route-check';
import { AnalysisGoal } from './analysis-goal';
import { addedValue, evaluateRoute, groupBySize, handText, rankCandidates, targetCoverage } from './evaluate';
import { C } from '../../../testing/ai/maliss-routes.sample';
import { malissCards, malissDeck } from '../../../testing/ai/maliss-deck.sample';
import { REAL_RUN_RECORD } from '../../../testing/ai/real-ai-run.sample';

// CR-007 G43 / G44. PROVENANCE: the fixture is the RECORDED output of ONE REAL model run — provider
// "ChatGPT account" through the local bridge, model gpt-6.1-sol, 2026-10-09 — on the user's real
// Maliss 40+15 deck. It is AI-GENERATED data: not hand-written (maliss-routes.sample.ts) and not a
// mocked answer (mock-ai.sample.ts). This spec only re-checks and re-evaluates it with the current
// local code; it makes no network call and no AI call.
//
// Passing here means: structure + deck consistency + the PARTIAL rule check find no violation, and the
// static end-board estimate. It does NOT mean the routes are legal in Master Duel.
const run = REAL_RUN_RECORD;
const deck = malissDeck();
const cards = malissCards();
const name = (id: number) => cards.get(id)?.nameEn ?? `ID ${id}`;
const goal: AnalysisGoal = run.goal;
const routes: ComboRoute[] = run.candidates.map((c: { route: ComboRoute }) => c.route);
const clone = (r: ComboRoute): ComboRoute => JSON.parse(JSON.stringify(r));
const check = (r: ComboRoute) => checkRoute(r, deck, { cards });
const ruleProblems = (r: ComboRoute) => check(r).problems.filter((p) => p.message.startsWith('規則檢查'));
const step = (r: ComboRoute, order: number) => r.steps.find((s) => s.order === order)!;

describe('G43 — the recorded run is a real, single, unmodified model run', () => {
  it('provider, model, request count and scope are what the evidence document states', () => {
    expect(run.status).toBe('succeeded');
    expect(run.provider).toBe('chatgpt');
    expect(run.model).toBe('gpt-6.1-sol');
    expect(run.servedModel).toBe('gpt-6.1-sol');
    expect(run.params).toMatchObject({ store: false, stream: true, structuredOutput: true });
    expect(run.scope).toMatchObject({ single: true, multi: true, extenders: true, candidates: 6, maxRoutes: 5 });
    expect(run.goal).toEqual({ kind: 'interruptions', preferredExtraIds: [C.firewall, C.allied] });
    expect(run.usage).toEqual({ inputTokens: 10408, outputTokens: 13082 });
    expect(routes).toHaveLength(3);
    for (const r of routes) expect(r.analysis).toMatchObject({ origin: 'ai', provider: 'chatgpt', model: 'gpt-6.1-sol', promptVersion: 'deck-analysis-v2' });
  });

  it('the recorded routes use only cards of this 40+15 deck', () => {
    for (const r of routes) {
      const ids = new Set(r.steps.flatMap((s) => [...s.actorCardIds, ...(s.materialCardIds ?? []), ...(s.moves ?? []).map((m) => m.cardId)]));
      for (const id of ids) expect(cards.has(id), `${id} is a card of the deck`).toBe(true);
    }
  });
});

describe('G44 — local checks of the real routes (not a legality proof)', () => {
  it('structure, deck consistency and the partial rule check find no violation; the partial rule check really ran', () => {
    for (const r of routes) {
      const c = check(r);
      expect(c.problems, r.name).toEqual([]);
      expect(c.rules?.checked.length, r.name).toBeGreaterThanOrEqual(4);
      expect(c.rules?.board.layoutKnown, r.name).toBe(true);
    }
  });

  it('no level above "data-checked": nothing here is rules-engine verified or tested in Master Duel', () => {
    for (const r of routes) expect(analysisLevel(r, deck, { cards, name })).toBe('data-checked');
  });

  it('end boards: Firewall Dragon + Hearts Crypter / Allied Code Talker + Transcode Talker + White Binder + Set GWC-06 / Hearts Crypter + Link Decoder', () => {
    const [a, b, c] = routes.map((r) => evaluateRoute(r, deck, cards));
    expect(a.finalMonsters.sort()).toEqual([C.firewall, C.heartsCrypter].sort());
    expect(a.extraUsed.filter((u) => !u.onFinalBoard).map((u) => u.cardId).sort()).toEqual([C.linkDecoder, C.transcode, C.whiteBinder].sort());
    expect(b.finalMonsters.sort()).toEqual([C.allied, C.transcode, C.whiteBinder].sort());
    expect(b.finalBacks).toEqual([C.gwc06]);
    expect(c.finalMonsters.sort()).toEqual([C.heartsCrypter, C.linkDecoder].sort());
    expect([a, b, c].map((e) => e.startKind)).toEqual(['double', 'double', 'single']);
  });

  it('interruptions are static estimates only; nothing is verified', () => {
    const evals = routes.map((r) => evaluateRoute(r, deck, cards));
    expect(evals.map((e) => e.effective)).toEqual([2, 1, 1]);
    expect(evals.map((e) => e.verified)).toEqual([0, 0, 0]);
    expect(evals[0].interruptions.map((i) => `${name(i.cardId)}:${i.status}`).sort()).toEqual(['Firewall Dragon:effective', 'Maliss <Q> Hearts Crypter:effective']);
    expect(evals[1].interruptions.map((i) => `${name(i.cardId)}:${i.status}`)).toEqual(['Allied Code Talker @Ignister:effective']);
  });

  it('the unlisted opening cards are reported as untracked, never as "0"', () => {
    const hands = routes.map((r) => evaluateRoute(r, deck, cards).hand);
    expect(hands.map((h) => h.untracked.min)).toEqual([3, 3, 4]);
    for (const h of hands) expect(handText(h)).toContain('未追蹤');
  });

  it('preferred monsters: each has a locally checked route that ends with it, but this is not verification', () => {
    const items = routes.map((r, index) => ({ index, evaluation: evaluateRoute(r, deck, cards) }));
    const cover = targetCoverage(items, goal.preferredExtraIds, run.explored);
    expect(cover.map((t) => [name(t.cardId), t.found])).toEqual([
      ['Firewall Dragon', true],
      ['Allied Code Talker @Ignister', true],
    ]);
    expect(rankCandidates(items, goal).map((x) => x.index)).toEqual([0, 1, 2]);
  });

  it('the model considered the non-Maliss Extra Deck monsters too (explored lists them), but expanded only the 3 routes', () => {
    const mentioned = new Set<number>(run.explored.flatMap((x: { extraDeckCardIds: number[] }) => x.extraDeckCardIds));
    for (const id of [C.wicckid, C.splashMage, C.almiraj, C.linguriboh, C.littleKnight, C.cherubini]) expect(mentioned.has(id), name(id)).toBe(true);
    expect(run.explored.filter((x: { routeName: string }) => x.routeName).length).toBe(3);
    expect(run.explored.length).toBe(13);
  });
});

describe('G52 — what the second starter card brings, on the recorded real routes (local comparison, not verification)', () => {
  const items = routes.map((r, index) => ({ index, evaluation: evaluateRoute(r, deck, cards, undefined, name) }));

  it('the three routes are one single-card and two double-card routes', () => {
    const g = groupBySize(items);
    expect([g.single.length, g.double.length, g.triple.length]).toEqual([1, 2, 0]);
  });

  it('Dormouse + Backup @Ignister (Firewall Dragon + Hearts Crypter) over Dormouse alone (Hearts Crypter + Link Decoder)', () => {
    const v = addedValue(items[0], items, name)!;
    expect(v.baseIndex).toBe(2);
    expect(v.addedStarters).toEqual([C.backup]);
    expect(v.addedOnBoard).toContain(C.firewall);
    expect(v.removedFromBoard).toContain(C.linkDecoder);
    expect([v.effectiveDelta, v.followUpDelta, v.verdict]).toEqual([1, 0, 'better']);
    expect(v.summary).toContain('加入「Backup @Ignister」');
  });

  it('the Allied Code Talker line: the same number of interruptions, one more follow-up resource — and it says so', () => {
    const v = addedValue(items[1], items, name)!;
    expect(v.baseIndex).toBe(2);
    expect([v.effectiveDelta, v.followUpDelta, v.verdict]).toEqual([0, 1, 'better']);
    expect(v.summary).toContain('有效干擾沒有增加');
  });

  it('the single-card route has nothing smaller to be compared with', () => {
    expect(addedValue(items[2], items, name)).toBeNull();
  });
});

describe('G44 — the same checks do catch broken variants of the real routes (so "0 problems" means something)', () => {
  it('Firewall Dragon with too few materials (Backup @Ignister removed): Link-4 cannot be reached', () => {
    const r = clone(routes[0]);
    step(r, 17).materialCardIds = [C.whiteBinder];
    expect(ruleProblems(r).some((p) => p.message.includes('湊不出 Link-4'))).toBe(true);
  });

  it('Transcode Talker placed in a zone no Link arrow points to', () => {
    const r = clone(routes[0]);
    const m = step(r, 18).moves!.find((x) => x.cardId === C.transcode && x.to === 'field')!;
    m.slot = 'M1';
    expect(ruleProblems(r).length).toBeGreaterThan(0);
  });

  it('Allied Code Talker with only 4 of the 5 Link Rating it needs (Dormouse removed)', () => {
    const r = clone(routes[1]);
    step(r, 19).materialCardIds = [C.transcode, C.wizard];
    expect(ruleProblems(r).some((p) => p.message.includes('湊不出 Link-5'))).toBe(true);
  });

  it('a once-per-turn effect used twice (Maliss <P> Dormouse banish effect, a copy of step 2 appended)', () => {
    const r = clone(routes[2]);
    const again = JSON.parse(JSON.stringify(step(r, 2)));
    r.steps.push({ ...again, id: 'dup', order: r.steps.length + 1 });
    expect(ruleProblems(r).some((p) => p.message.includes('每回合只能使用 1 次'))).toBe(true);
  });

  it('a card outside the deck cannot be smuggled in (the OCG reference line needs Maliss <Q> Red Ransom)', () => {
    const r = clone(routes[2]);
    step(r, 10).actorCardIds = [C.redRansom];
    expect(check(r).passed).toBe(false);
  });
});
