import { analysisLevel } from '../analysis-level';
import { ComboRoute } from '../models';
import { checkRoute } from '../route-check';
import { endSnapshot } from './board-snapshot';
import { addedValue, evaluateRoute, foldDuplicates, groupBySize, handText, rankCandidates, sharedPrefix, siblingOverlap } from './evaluate';
import { malissCards, malissDeck } from './maliss-deck.sample';
import { C } from './maliss-routes.sample';
import { REAL_STAGED_RUN } from './real-ai-staged-run.sample';

// CR-008 G47–G54. PROVENANCE: the fixture is the RECORDED output of ONE REAL phased (staged) analysis —
// provider "ChatGPT account" through the local bridge, model gpt-6.1-sol, 2026-10-09 — on the user's real
// Maliss 40+15 deck (goal A, Allied Code Talker @Ignister + Firewall Dragon preferred, sizes 1+2+3, default
// budgets). It is AI-GENERATED data: not hand-written (maliss-routes.sample.ts) and not a mocked answer
// (mock-ai.sample.ts). This spec only re-checks and re-evaluates it with the current local code; it makes
// no network call and no AI call.
//
// Passing here means: structure + deck consistency + the PARTIAL rule check find no violation, the combo
// checks (every required card takes part, no unfinished step) hold, and the static end-board estimate.
// It does NOT mean the routes are legal in Master Duel.
const run = REAL_STAGED_RUN;
const deck = malissDeck();
const cards = malissCards();
const name = (id: number) => cards.get(id)?.nameEn ?? `ID ${id}`;
const routes: ComboRoute[] = run.candidates.map((c: { route: ComboRoute }) => c.route);
const items = routes.map((r, index) => ({ index, evaluation: evaluateRoute(r, deck, cards, undefined, name) }));
const clone = (r: ComboRoute): ComboRoute => JSON.parse(JSON.stringify(r));
const check = (r: ComboRoute) => checkRoute(r, deck, { cards, name });
const ruleProblems = (r: ComboRoute) => check(r).problems.filter((p) => p.message.startsWith('規則檢查'));
const step = (r: ComboRoute, order: number) => r.steps.find((s) => s.order === order)!;
const board = (r: ComboRoute) => {
  const s = endSnapshot(r, deck, cards, check(r))!;
  return [...s.emz, ...s.mmz, ...s.spellTrap, s.fieldZone].filter((x): x is NonNullable<typeof x> => !!x).map((x) => `${x.slot}:${name(x.cardId)}${x.coLinked.length ? '*' : ''}`);
};

describe('G47 — the recorded run is a real, single, unmodified phased model run', () => {
  it('provider, model, budgets and scope are what the evidence document states', () => {
    expect(run.status).toBe('succeeded');
    expect(run.provider).toBe('chatgpt');
    expect(run.model).toBe('gpt-6.1-sol');
    expect(run.promptVersion).toBe('deck-analysis-v3-staged');
    expect(run.params).toMatchObject({ store: false, stream: true, structuredOutput: true });
    expect(run.scope).toMatchObject({ single: true, multi: true, triple: true, extenders: true });
    expect(run.goal).toEqual({ kind: 'interruptions', preferredExtraIds: [C.firewall, C.allied] });
    expect(run.usage).toEqual({ inputTokens: 53221, outputTokens: 65626 });
    expect(run.staged.budget).toMatchObject({ maxRequests: 6, tokenBudget: 150000, requests: 5, tokens: 118847, stoppedBy: null });
  });

  it('phase A proposed 4 combos (3+2+1+3 cards), phase B expanded every one, nothing was left out', () => {
    expect(run.staged.rejected).toEqual([]);
    expect(run.staged.combos.map((c: { size: number }) => c.size)).toEqual([3, 2, 1, 3]);
    expect(run.staged.combos.map((c: { status: string }) => c.status)).toEqual(['done', 'done', 'done', 'done']);
    expect(run.staged.combos.map((c: { routes: number }) => c.routes)).toEqual([2, 2, 2, 2]);
    expect(run.summary).toContain('不代表已窮舉');
  });

  it('every route carries origin ai, the model, the staged prompt version and its combo roles; only cards of this deck are used', () => {
    expect(routes).toHaveLength(8);
    for (const r of routes) {
      expect(r.analysis).toMatchObject({ origin: 'ai', provider: 'chatgpt', model: 'gpt-6.1-sol', promptVersion: 'deck-analysis-v3-staged' });
      expect(r.analysis?.combo?.required.length).toBeGreaterThanOrEqual(1);
      const ids = new Set(r.steps.flatMap((s) => [...s.actorCardIds, ...(s.materialCardIds ?? []), ...(s.moves ?? []).map((m) => m.cardId)]));
      for (const id of ids) expect(cards.has(id), `${id} is a card of the deck`).toBe(true);
    }
  });
});

describe('G48 — local checks of the real routes (not a legality proof)', () => {
  it('7 of 8 routes: structure, deck consistency, combo checks and the partial rule check find no violation; the rule check really ran', () => {
    routes.forEach((r, i) => {
      if (i === 3) return;
      const c = check(r);
      expect(c.problems, r.name).toEqual([]);
      expect(c.rules?.checked.length, r.name).toBeGreaterThanOrEqual(4);
      expect(c.rules?.board.layoutKnown, r.name).toBe(true);
      expect(c.rules?.steps?.length, r.name).toBe(r.steps.length);
    });
  });

  it('route 4 is NOT data-checked: the model itself marked step 20 unfinished (no card moves), and the app refuses to treat it as complete', () => {
    const c = check(routes[3]);
    expect(c.problems).toHaveLength(1);
    expect(c.problems[0].step).toBe(20);
    expect(c.problems[0].message).toContain('未完成');
    expect(step(routes[3], 20).unresolved).toBeTruthy();
    expect(analysisLevel(routes[3], deck, { cards, name })).toBe('ai-candidate');
  });

  it('no level above "data-checked": nothing here is rules-engine verified or tested in Master Duel', () => {
    const levels = routes.map((r) => analysisLevel(r, deck, { cards, name }));
    expect(levels).toEqual(['data-checked', 'data-checked', 'data-checked', 'ai-candidate', 'data-checked', 'data-checked', 'data-checked', 'data-checked']);
  });
});

describe('G49 / G50 — end boards rebuilt from the last step state (positions are the model\'s; the board is not independently verified)', () => {
  it('the boards, with * for co-linked monsters', () => {
    expect(routes.map(board)).toEqual([
      ['EMZ-L:Allied Code Talker @Ignister*', 'M1:Transcode Talker*', 'M2:Firewall Dragon*', 'M3:Maliss <Q> White Binder*'],
      ['EMZ-L:Allied Code Talker @Ignister*', 'M1:Maliss <Q> White Binder', 'M2:Maliss <Q> Hearts Crypter*', 'M3:Transcode Talker'],
      ['EMZ-L:Firewall Dragon*', 'M2:Maliss <Q> White Binder*', 'FZ:Maliss in Underground'],
      ['EMZ-L:Allied Code Talker @Ignister*', 'M1:Transcode Talker*', 'M2:Maliss <Q> White Binder*', 'FZ:Maliss in Underground'],
      ['EMZ-L:Maliss <Q> Hearts Crypter', 'S2:Maliss <C> MTP-07'],
      ['EMZ-L:Allied Code Talker @Ignister*', 'M2:Maliss <Q> White Binder*', 'S2:Maliss <C> MTP-07'],
      ['EMZ-L:Firewall Dragon*', 'M2:Maliss <Q> White Binder*', 'M3:Maliss <Q> Hearts Crypter', 'M5:Backup @Ignister', 'S2:Maliss <C> GWC-06'],
      ['EMZ-L:Allied Code Talker @Ignister', 'M1:Maliss <Q> White Binder', 'M3:Maliss <Q> Hearts Crypter', 'S2:Maliss <C> GWC-06'],
    ]);
  });

  it('every card of the end board is placed (nothing left "unplaced"), and the preferred monsters appear where the model put them', () => {
    for (const r of routes) expect(endSnapshot(r, deck, cards, check(r))!.unplaced).toEqual([]);
    const withFirewall = items.filter((x) => x.evaluation.finalMonsters.includes(C.firewall)).map((x) => x.index + 1);
    const withAllied = items.filter((x) => x.evaluation.finalMonsters.includes(C.allied)).map((x) => x.index + 1);
    expect(withFirewall).toEqual([1, 3, 7]);
    expect(withAllied).toEqual([1, 2, 4, 6, 8]);
  });
});

describe('G51 — evaluation of the real routes: static estimates only', () => {
  it('interruptions are static estimates; nothing is verified; the unlisted opening cards are "untracked", never "0"', () => {
    expect(items.map((x) => x.evaluation.effective)).toEqual([2, 2, 1, 1, 1, 1, 2, 2]);
    expect(items.map((x) => x.evaluation.verified)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    for (const x of items) expect(handText(x.evaluation.hand)).toContain('未追蹤');
  });

  it('route 5 and 6: the Set Maliss <C> MTP-07 is counted as inactive (it needs a Maliss monster to banish and a Maliss Link afterwards)', () => {
    for (const i of [4, 5]) {
      const mtp = items[i].evaluation.interruptions.find((x) => x.cardId === C.mtp07)!;
      expect(mtp.status).toBe('inactive');
    }
  });

  it('start sizes and size groups: 2 single-card, 2 double-card, 4 triple-card routes', () => {
    expect(items.map((x) => x.evaluation.startKind)).toEqual(['triple', 'triple', 'double', 'double', 'single', 'single', 'triple', 'triple']);
    const g = groupBySize(items);
    expect([g.single.length, g.double.length, g.triple.length, g.other.length]).toEqual([2, 2, 4, 0]);
  });

  it('goal A ranking puts the two routes that keep the preferred Firewall Dragon / Allied Code Talker plus Transcode Talker/Binder first; the Set-trap lines come after', () => {
    const ranked = rankCandidates(items, run.goal).map((x) => x.index + 1);
    expect(ranked).toEqual([2, 1, 8, 7, 3, 5, 6, 4]);
    expect(foldDuplicates(rankCandidates(items, run.goal)).folded).toEqual([]);
  });
});

describe('G52 — what the extra starter cards bring (local comparison, not verification)', () => {
  it('routes 1 and 2 (Dormouse + Backup + March Hare) over the single-card route 5: one more interruption, two fewer follow-up resources — "mixed", not "better"', () => {
    for (const i of [0, 1]) {
      const v = addedValue(items[i], items, name)!;
      expect(v.baseIndex).toBe(4);
      expect([...v.addedStarters].sort()).toEqual([C.backup, C.marchHare].sort());
      expect([v.effectiveDelta, v.followUpDelta, v.verdict]).toEqual([1, -2, 'mixed']);
      expect(v.summary).toContain('各有取捨');
    }
  });

  it('the other routes have no valid proper subset to be compared with, so no claim is made', () => {
    for (const i of [2, 3, 4, 5, 6, 7]) expect(addedValue(items[i], items, name), `route ${i + 1}`).toBeNull();
  });
});

describe('G53 — the same checks do catch broken variants of the real routes (so "0 problems" means something)', () => {
  it('a required starter card that takes no part in the route', () => {
    const r = clone(routes[5]);
    r.analysis!.combo!.required = [C.maxx];
    expect(check(r).problems.some((p) => p.message.includes('沒有參與展開'))).toBe(true);
  });

  it('four required starter cards are refused', () => {
    const r = clone(routes[0]);
    r.analysis!.combo!.required.push(C.maxx);
    expect(check(r).problems.some((p) => p.message.includes('最多 3 張'))).toBe(true);
  });

  it('a card both required and "avoid in hand"', () => {
    const r = clone(routes[4]);
    r.analysis!.combo!.avoidInHand.push(C.dormouse);
    expect(check(r).problems.some((p) => p.message.includes('同時被列為必要起手牌'))).toBe(true);
  });

  it('a step with no card moves, or one marked unfinished, is refused (and the route drops to ai-candidate)', () => {
    const noMoves = clone(routes[5]);
    step(noMoves, 14).moves = [];
    expect(check(noMoves).problems.some((p) => p.step === 14 && p.message.includes('沒有任何卡片移動'))).toBe(true);
    const open = clone(routes[5]);
    step(open, 14).unresolved = '尚未決定';
    expect(check(open).problems.some((p) => p.step === 14 && p.message.includes('未完成'))).toBe(true);
    expect(analysisLevel(open, deck, { cards, name })).toBe('ai-candidate');
  });

  it('White Binder with too few materials (Link-3 cannot be reached)', () => {
    const r = clone(routes[5]);
    step(r, 8).materialCardIds = [C.linkDecoder, C.dormouse];
    expect(ruleProblems(r).some((p) => p.message.includes('湊不出 Link-3'))).toBe(true);
  });

  it('Firewall Dragon with too few materials (Link-4 cannot be reached)', () => {
    const r = clone(routes[6]);
    step(r, 23).materialCardIds = [C.splashMage, C.linkDecoder];
    expect(ruleProblems(r).some((p) => p.message.includes('湊不出 Link-4'))).toBe(true);
  });

  it('Allied Code Talker\'s revived monster placed in a zone its arrows do not point to', () => {
    const r = clone(routes[7]);
    const m = step(r, 29).moves!.find((x) => x.cardId === C.whiteBinder && x.to === 'field')!;
    m.slot = 'M4';
    expect(ruleProblems(r).length).toBeGreaterThan(0);
  });

  it('a once-per-turn effect used twice (a copy of the Dormouse banish effect appended)', () => {
    const r = clone(routes[5]);
    const again = JSON.parse(JSON.stringify(step(r, 2)));
    r.steps.push({ ...again, id: 'dup', order: r.steps.length + 1 });
    expect(ruleProblems(r).some((p) => p.message.includes('每回合只能使用 1 次'))).toBe(true);
  });
});

describe('G52 supplement — the two routes of each combination are one line with two endings (a note, never a fold)', () => {
  it('measures how long each route repeats its sibling from the start: 22, 16, 12 and 26 steps', () => {
    const rows = routes.map((_, i) => {
      const o = siblingOverlap(i, routes)!;
      return [i + 1, o.otherIndex + 1, o.shared, o.sameLine];
    });
    expect(rows).toEqual([
      [1, 2, 22, true],
      [2, 1, 22, true],
      [3, 4, 16, true],
      [4, 3, 16, true],
      [5, 6, 12, true],
      [6, 5, 12, true],
      [7, 8, 26, true],
      [8, 7, 26, true],
    ]);
    expect(sharedPrefix(routes[0], routes[6])).toBe(0);
  });

  it('nothing is folded: the end boards differ, so all 8 routes are kept (rev8 duplicate rule)', () => {
    const ranked = rankCandidates(items, run.goal);
    expect(foldDuplicates(ranked).kept).toHaveLength(8);
  });

  it('a route whose opening differs is not called the same line, and routes of other starter cards or without combo info have no sibling', () => {
    const other = clone(routes[1]);
    other.steps[0].actorCardIds = [C.maxx];
    const diff = siblingOverlap(0, [routes[0], other])!;
    expect([diff.shared, diff.sameLine]).toEqual([0, false]);

    const elsewhere = clone(routes[1]);
    elsewhere.analysis!.combo!.required = [C.maxx];
    expect(siblingOverlap(0, [routes[0], elsewhere])).toBeNull();

    const plain = clone(routes[0]);
    delete plain.analysis!.combo;
    expect(siblingOverlap(0, [plain, routes[1]])).toBeNull();
  });
});
