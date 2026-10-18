import { TestBed } from '@angular/core/testing';
import { AppDb, DB_NAME } from '../db';
import { analyzeCandidates, evaluateRoute, groupBySize } from './evaluate';
import { AiAnalysisService, DEFAULT_AI_SETTINGS } from './analysis.service';
import { anthropicSse } from '../../../testing/ai/mock-ai.sample';
import { malissCards, malissDeck } from '../../../testing/ai/maliss-deck.sample';
import { C, combo, routeAllied, routeAlliedPlusTrap, routeAlliedPlusTwoTraps, routeFirewallIntoAllied, sampleAnswer, samplePlan, withRoles } from '../../../testing/ai/maliss-routes.sample';
import { AI_FETCH, FetchLike } from './providers';
import { DEFAULT_STAGED, StagedSettings } from './staged';

// CR-008 G48 with a FAKE network: every "model" answer below is a MOCKED answer built from
// HAND-WRITTEN routes (maliss-routes.sample.ts). No real or paid AI service is ever contacted.
const deck = malissDeck();
const cards = malissCards();
const sse = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
const usage = (inputTokens: number, outputTokens: number) => ({ inputTokens, outputTokens });

const MESSY_PLAN = samplePlan([
  combo([C.dormouse], 1),
  combo([C.impermanence, C.dormouse], 2),
  combo([C.dormouse, C.impermanence, C.impermanence], 3),
  combo([C.dormouse, C.impermanence], 4), // same cards as #2
  combo([C.whiteBinder], 5), // Extra Deck monster
  combo([C.dormouse, C.dormouse], 6), // one Dormouse in the deck
  combo([C.ash, C.ash, C.ash, C.ash], 7), // four cards
  combo([C.impermanence, C.impermanence, C.impermanence], 8), // legal, but over the limit of 3
]);
const ANSWER_1 = sampleAnswer([withRoles(routeAllied()), withRoles(routeFirewallIntoAllied())]);
const ANSWER_2 = sampleAnswer([withRoles(routeAlliedPlusTrap())]);
const ANSWER_3 = sampleAnswer([withRoles(routeAlliedPlusTwoTraps())]);

interface Reply {
  body: unknown;
  stopReason?: string;
  tokens?: { inputTokens: number; outputTokens: number };
  /** Never answers until the request is aborted. */
  hang?: boolean;
}

async function setup(replies: Reply[], staged: Partial<StagedSettings> = {}, extra: Parameters<AiAnalysisService['updateSettings']>[0] = {}) {
  sessionStorage.clear();
  const requests: Array<{ body: string }> = [];
  const fetch: FetchLike = async (_input, init = {}) => {
    const reply = replies[requests.length] ?? replies.at(-1)!;
    requests.push({ body: String(init.body ?? '') });
    if (reply.hang) return new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    return sse(anthropicSse(JSON.stringify(reply.body), { ...(reply.stopReason ? { stopReason: reply.stopReason } : {}), ...(reply.tokens ?? usage(12000, 3000)) }));
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DB_NAME, useValue: `staged-${crypto.randomUUID()}` },
      { provide: AI_FETCH, useValue: fetch },
    ],
  });
  const db = await TestBed.inject(AppDb).db();
  for (const card of cards.values()) await db.put('cards', card);
  await db.put('decks', deck);
  const service = TestBed.inject(AiAnalysisService);
  await service.ready;
  service.setApiKey('test-key-not-real');
  await service.updateSettings({ mode: 'staged', scope: { ...DEFAULT_AI_SETTINGS.scope, triple: true }, staged: { ...DEFAULT_STAGED, maxCombos: 3, routesPerCombo: 2, ...staged }, ...extra });
  return { service, db, requests };
}

const snapshot = async (db: Awaited<ReturnType<AppDb['db']>>) => JSON.stringify([await db.getAll('decks'), await db.getAll('combos')]);

describe('startStaged — the whole flow (G47 / G48)', () => {
  it('A plans, B expands each accepted combination, C/D check and classify; rejected combinations cost no request', async () => {
    const { service, db, requests } = await setup([{ body: MESSY_PLAN, tokens: usage(14000, 2000) }, { body: ANSWER_1 }, { body: ANSWER_2 }, { body: ANSWER_3 }]);
    const before = await snapshot(db);
    const run = await service.startStaged(deck);

    // one request for A, one per accepted combination — nothing for the 5 rejected ones
    expect(requests).toHaveLength(4);
    expect(requests[0].body).toContain('Card roles');
    expect(requests[1].body).toContain('Starter combination');
    expect(requests[1].body).toContain(`Maliss <P> Dormouse (id ${C.dormouse})`);
    expect(requests[2].body).toContain(`Infinite Impermanence (id ${C.impermanence})`);
    expect(requests[3].body).toMatch(/Infinite Impermanence \(id 10045474\).*Infinite Impermanence \(id 10045474\)/s);
    for (const r of requests) expect(r.body.match(/\{\\"id\\":\d+,/g)).toHaveLength(41);

    expect(run.status).toBe('succeeded');
    expect(run.promptVersion).toBe('deck-analysis-v3.1-staged');
    expect(run.scope).toMatchObject({ single: true, multi: true });
    const staged = run.staged!;
    expect(staged.combos.map((c) => [c.size, c.status, c.routes])).toEqual([[1, 'done', 2], [2, 'done', 1], [3, 'done', 1]]);
    expect(staged.rejected).toHaveLength(5);
    expect(staged.rejected.some((r) => r.reason.includes('最大候選起手組合數'))).toBe(true);
    expect(staged.budget).toMatchObject({ requests: 4, stoppedBy: null });
    expect(staged.notAnalyzed).toBe(0);
    expect(staged.exhaustive).toBe(false);
    expect(staged.plan?.roles.length).toBeGreaterThan(0);

    expect(run.candidates).toHaveLength(4);
    const sizes = run.candidates!.map((c) => c.route.analysis?.combo?.required.length);
    expect(sizes).toEqual([1, 1, 2, 3]);
    for (const c of run.candidates!) expect(['draft', 'unverified']).toContain(c.route.verification.status); // never "verified"
    const evals = run.candidates!.map((c, index) => ({ index, evaluation: evaluateRoute(c.route, deck, cards) }));
    expect(Object.fromEntries(Object.entries(groupBySize(evals)).map(([k, v]) => [k, v.length]))).toEqual({ single: 2, double: 1, triple: 1, other: 0 });
    expect(run.usage?.inputTokens).toBeGreaterThan(14000);
    expect(await snapshot(db)).toBe(before); // analysis alone never writes decks or combos
    expect((await service.usageToday()).requests).toBe(4);
  });

  it('the same deck and settings reuse the result; another budget is another analysis', async () => {
    const { service, requests } = await setup([{ body: MESSY_PLAN }, { body: ANSWER_1 }, { body: ANSWER_2 }, { body: ANSWER_3 }]);
    const first = await service.startStaged(deck);
    expect((await service.startStaged(deck)).id).toBe(first.id);
    expect(requests).toHaveLength(4);
    await service.updateSettings({ staged: { ...DEFAULT_STAGED, maxCombos: 3, routesPerCombo: 3 } });
    await service.startStaged(deck);
    expect(requests.length).toBeGreaterThan(4);
  });
});

describe('one size at a time, and the preferred monsters (G47-1 / G50-3)', () => {
  it.each([
    [1, [ANSWER_1], 2],
    [2, [ANSWER_2], 2],
    [3, [ANSWER_3, ANSWER_3], 3],
  ] as const)('only %i-card combinations are analysed when only that size is ticked', async (size, answers, requests) => {
    const { service, requests: sent } = await setup([{ body: MESSY_PLAN }, ...answers.map((body) => ({ body }))], {}, { scope: { ...DEFAULT_AI_SETTINGS.scope, single: size === 1, multi: size === 2, triple: size === 3 } });
    const run = await service.startStaged(deck);
    expect(run.staged!.combos.length).toBeGreaterThan(0);
    expect(run.staged!.combos.every((c) => c.size === size && c.status === 'done')).toBe(true);
    expect(sent).toHaveLength(requests);
    expect(run.candidates!.every((c) => c.route.analysis?.combo?.required.length === size)).toBe(true);
  });

  it('Allied Code Talker and Firewall Dragon are searched for (in both prompts), and what was found is reported without any guarantee', async () => {
    const goal = { kind: 'targets' as const, preferredExtraIds: [C.allied, C.firewall, C.transcode] };
    const { service, requests } = await setup([{ body: MESSY_PLAN }, { body: ANSWER_1 }, { body: ANSWER_2 }, { body: ANSWER_3 }], {}, { goal });
    const run = await service.startStaged(deck);
    for (const r of requests) {
      expect(r.body).toContain(`Allied Code Talker @Ignister (id ${C.allied})`);
      expect(r.body).toContain(`Firewall Dragon (id ${C.firewall})`);
      expect(r.body).toContain('a preference, not a requirement');
    }
    expect(run.goal?.preferredExtraIds).toEqual(goal.preferredExtraIds);
    const { coverage } = analyzeCandidates(run, deck, cards);
    const byCard = Object.fromEntries(coverage.map((t) => [t.cardId, t]));
    expect(byCard[C.allied].found).toBe(true);
    expect(byCard[C.firewall].found).toBe(false); // only used on the way (Firewall Dragon → Allied Code Talker)
    expect(byCard[C.firewall].message).toContain('未找到已驗證路線');
    expect(byCard[C.firewall].message).toContain('中途');
    expect(byCard[C.transcode].message).toContain('未找到已驗證路線'); // nobody proposed it
    expect(JSON.stringify(coverage)).not.toMatch(/不可能|無法達成/);
  });
});

describe('budgets — never an unbounded number of requests; completed work is kept (G48-5/6/7, N39 / N40)', () => {
  it('the request limit (which includes phase A) caps the requests; the rest is listed as not analysed', async () => {
    const { service, requests } = await setup([{ body: MESSY_PLAN }, { body: ANSWER_1 }, { body: ANSWER_2 }, { body: ANSWER_3 }], { maxRequests: 2 });
    const run = await service.startStaged(deck);
    expect(requests).toHaveLength(2);
    const staged = run.staged!;
    expect(staged.combos.map((c) => c.status)).toEqual(['done', 'skipped', 'skipped']);
    expect(staged.combos.slice(1).every((c) => c.skippedBy === 'requests')).toBe(true);
    expect(staged.notAnalyzed).toBe(2);
    expect(staged.budget.stoppedBy).toBe('requests');
    expect(run.candidates).toHaveLength(2); // the finished combination is kept
    expect(run.summary).toContain('未分析 2 個組合');
    expect(run.summary).toContain('不代表已窮舉');
  });

  it('the token budget is checked before every request, with the actual usage once it is known', async () => {
    const { service, requests } = await setup([{ body: MESSY_PLAN, tokens: usage(14000, 4000) }, { body: ANSWER_1 }], { tokenBudget: 30_000 });
    const run = await service.startStaged(deck);
    expect(requests).toHaveLength(1); // 18,000 used; the next request would not fit in the other 12,000
    expect(run.staged!.combos.every((c) => c.status === 'skipped' && c.skippedBy === 'tokens')).toBe(true);
    expect(run.staged!.budget).toMatchObject({ requests: 1, stoppedBy: 'tokens' });
    expect(run.staged!.budget.tokens).toBeGreaterThanOrEqual(18_000);
    expect(run.status).toBe('succeeded');
    expect(run.candidates).toEqual([]);
    expect(run.summary).toContain('未分析 3 個組合');
  });

  it('a budget that cannot even pay for phase A sends nothing', async () => {
    const { service, requests } = await setup([{ body: MESSY_PLAN }], { tokenBudget: 10_000 });
    await expect(service.startStaged(deck)).rejects.toThrow(/Token 預算/);
    expect(requests).toHaveLength(0);
  });

  it('the daily request limit stops the loop as well', async () => {
    const { service, requests } = await setup([{ body: MESSY_PLAN }, { body: ANSWER_1 }, { body: ANSWER_2 }], {}, { dailyRequestLimit: 2 });
    const run = await service.startStaged(deck);
    expect(requests).toHaveLength(2);
    expect(run.staged!.budget.stoppedBy).toBe('daily-limit');
    expect(run.staged!.notAnalyzed).toBe(2);
  });

  it('a truncated answer fails that combination only: no incomplete route or step is kept', async () => {
    const { service } = await setup([{ body: MESSY_PLAN }, { body: ANSWER_1 }, { body: ANSWER_2, stopReason: 'max_tokens' }, { body: ANSWER_3 }]);
    const run = await service.startStaged(deck);
    expect(run.staged!.combos.map((c) => c.status)).toEqual(['done', 'truncated', 'done']);
    expect(run.staged!.combos[1].error).toContain('截斷');
    expect(run.staged!.combos[1].routes).toBe(0);
    expect(run.candidates).toHaveLength(3);
    expect(run.candidates!.some((c) => c.route.analysis?.combo?.required.length === 2)).toBe(false);
    expect(run.summary).toContain('失敗 1 個組合');
  });

  it('a malformed answer for one combination does not stop the others', async () => {
    const { service } = await setup([{ body: MESSY_PLAN }, { body: { nonsense: true } }, { body: ANSWER_2 }, { body: ANSWER_3 }]);
    const run = await service.startStaged(deck);
    expect(run.staged!.combos.map((c) => c.status)).toEqual(['failed', 'done', 'done']);
    expect(run.candidates).toHaveLength(2);
  });

  it('cancelling keeps the finished combinations; the running one is "cancelled", the rest "skipped"', async () => {
    const { service, requests } = await setup([{ body: MESSY_PLAN }, { body: ANSWER_1 }, { body: ANSWER_2, hang: true }, { body: ANSWER_3 }]);
    const pending = service.startStaged(deck);
    await vi.waitFor(() => expect(requests).toHaveLength(3));
    service.cancel();
    const run = await pending;
    expect(requests).toHaveLength(3);
    expect(run.status).toBe('cancelled');
    expect(run.staged!.combos.map((c) => c.status)).toEqual(['done', 'cancelled', 'skipped']);
    expect(run.staged!.combos[2].skippedBy).toBe('cancelled');
    expect(run.candidates).toHaveLength(2);
    expect(run.staged!.budget.stoppedBy).toBe('cancelled');
  });
});

describe('phase A failures and preflight (G48-1, N38)', () => {
  it('an unusable phase-A answer fails the run before any phase B request', async () => {
    const { service, requests } = await setup([{ body: { summary: 'x', roles: [], combos: 'none' } }]);
    const run = await service.startStaged(deck);
    expect([run.status, run.error?.code]).toEqual(['failed', 'bad-format']);
    expect(requests).toHaveLength(1);
    expect(run.candidates).toBeUndefined();
  });

  it('when no proposed combination is usable, it says so and sends no phase B request', async () => {
    const { service, requests } = await setup([{ body: samplePlan([combo([C.whiteBinder], 1), combo([C.dormouse, C.dormouse], 2)]) }]);
    const run = await service.startStaged(deck);
    expect(requests).toHaveLength(1);
    expect(run.status).toBe('succeeded');
    expect(run.staged!.combos).toEqual([]);
    expect(run.staged!.rejected).toHaveLength(2);
    expect(run.summary).toContain('沒有可分析的起手組合');
  });

  it('needs at least one size, and the request limit has a floor of 2 (phase A + one combination)', async () => {
    const { service, requests } = await setup([{ body: MESSY_PLAN }], { maxRequests: 1 });
    expect(service.settings().staged.maxRequests).toBe(2);
    await service.updateSettings({ scope: { ...DEFAULT_AI_SETTINGS.scope, single: false, multi: false, triple: false } });
    await expect(service.startStaged(deck)).rejects.toThrow('請至少選擇一種起手張數');
    expect(requests).toHaveLength(0);
  });

  it('the one-shot mode is untouched: it still makes exactly one request and uses the v2 prompt', async () => {
    const { service, requests } = await setup([{ body: sampleAnswer([routeAllied()]) }], {}, { mode: 'one-shot' });
    const run = await service.start(deck);
    expect(requests).toHaveLength(1);
    expect(run.promptVersion).toBe('deck-analysis-v2');
    expect(run.staged).toBeUndefined();
    expect(DEFAULT_AI_SETTINGS.mode).toBe('one-shot');
  });
});
