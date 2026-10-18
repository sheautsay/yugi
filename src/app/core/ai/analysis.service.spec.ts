import { TestBed } from '@angular/core/testing';
import { ComboRepository } from '../combo-repository';
import { AppDb, DB_NAME } from '../db';
import { deckFingerprint } from '../deck';
import { ComboRoute } from '../models';
import { AiAnalysisService, API_KEY_STORAGE, DEFAULT_AI_SETTINGS } from './analysis.service';
import { anthropicSse, mockAiOutput, ollamaNdjson } from '../../../testing/ai/mock-ai.sample';
import { AI_FETCH, FetchLike } from './providers';
import { IDS, testCards, testDeck } from '../../../testing/ai/test-deck.sample';

// CR-004 G22 / G27 with a FAKE network: every "AI" answer below is a mocked response.
const deck = testDeck();
const cards = testCards(deck);
const goodText = JSON.stringify(mockAiOutput(IDS));
const sse = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });

const existingCombo: ComboRoute = {
  schemaVersion: 1,
  id: 'existing',
  version: 4,
  name: '既有路線',
  archetype: 'Testers',
  format: 'master-duel',
  conditions: { handAllOf: [{ anyOf: [IDS.starter], count: 1 }], setup: { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true } },
  steps: [],
  endBoard: [],
  verification: { status: 'draft' },
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

async function setup(respond: (init: RequestInit) => Response | Promise<Response>) {
  sessionStorage.clear();
  const requests: Array<{ url: string; body: string }> = [];
  const fetch: FetchLike = async (input, init = {}) => {
    requests.push({ url: String(input), body: String(init.body ?? '') });
    return respond(init);
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DB_NAME, useValue: `ai-${crypto.randomUUID()}` },
      { provide: AI_FETCH, useValue: fetch },
    ],
  });
  const db = await TestBed.inject(AppDb).db();
  for (const card of cards.values()) await db.put('cards', card);
  await db.put('decks', deck);
  await db.put('combos', existingCombo);
  const service = TestBed.inject(AiAnalysisService);
  await service.ready;
  service.setApiKey('test-key-not-real');
  return { service, db, requests };
}

const snapshot = async (db: Awaited<ReturnType<AppDb['db']>>) => JSON.stringify([await db.getAll('decks'), await db.getAll('combos')]);

describe('AiAnalysisService', () => {
  it('G22/G23: runs one request, validates, converts and records everything about the run', async () => {
    const { service, db, requests } = await setup(() => sse(anthropicSse(goodText, { inputTokens: 20000, outputTokens: 5000 })));
    const before = await snapshot(db);
    const run = await service.start(deck);

    expect(requests).toHaveLength(1);
    expect(run.status).toBe('succeeded');
    expect(run).toMatchObject({
      deckId: deck.id,
      deckName: deck.name,
      deckVersion: 3,
      deckFingerprint: deckFingerprint(deck),
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      servedModel: 'claude-opus-5-5',
      params: { effort: 'high', maxOutputTokens: 32000, timeoutSeconds: 900 },
      promptVersion: 'deck-analysis-v2', // CR-006: the prompt changed (v1 → v2)
      usage: { inputTokens: 20000, outputTokens: 5000, estimatedCostUsd: (20000 * 4 + 5000 * 20) / 1e6 },
    });
    expect(run.cardDataVersion).toContain('未完整同步');
    expect(run.assumptions.join()).toContain('先攻第 1 回合');
    expect(run.candidates?.map((c) => c.route.verification.status)).toEqual(['unverified', 'draft']);
    expect(run.starters?.map((s) => s.kind)).toEqual(['single', 'multi', 'single']);
    expect(service.state().phase).toBe('done');
    expect(await snapshot(db)).toBe(before); // analysis alone never writes decks or combos
    expect((await service.listRuns(deck.id)).map((r) => r.id)).toEqual([run.id]);
    expect((await service.usageToday()).requests).toBe(1);
  });

  it('G22-5: the same deck and settings reuse the cached result without a request; force re-runs', async () => {
    const { service, requests } = await setup(() => sse(anthropicSse(goodText)));
    const first = await service.start(deck);
    const cached = await service.start(deck);
    expect(cached.id).toBe(first.id);
    expect(service.state().fromCache).toBe(true);
    expect(requests).toHaveLength(1);
    await service.updateSettings({ effort: 'max' });
    await service.start(deck);
    expect(requests).toHaveLength(2);
    await service.start(deck, { force: true });
    expect(requests).toHaveLength(3);
  });

  it('G22-2: nothing is sent when the deck, card text, key, scope or daily limit is not OK', async () => {
    const { service, db, requests } = await setup(() => sse(anthropicSse(goodText)));
    const reasons = async (d = deck) => (await service.start(d).catch((e: Error) => e.message)) as string;

    expect(await reasons({ ...deck, main: deck.main.slice(1) })).toContain('牌組未通過牌表檢核');
    service.setApiKey('');
    expect(await reasons()).toContain('請輸入 Claude API Key');
    service.setApiKey('test-key-not-real');
    await service.updateSettings({ scope: { single: false, multi: false, extenders: false, maxRoutes: 5 } });
    expect(await reasons()).toContain('請至少選擇一種分析範圍');
    await service.updateSettings({ scope: DEFAULT_AI_SETTINGS.scope });
    await db.put('cards', { ...cards.get(IDS.link)!, desc: undefined });
    expect(await reasons()).toContain('沒有效果文字');
    await db.put('cards', cards.get(IDS.link)!);
    await service.updateSettings({ dailyRequestLimit: 1 });
    await service.start(deck);
    expect(requests).toHaveLength(1);
    expect(await reasons()).toContain('達到每日上限 1 次');
    expect(requests).toHaveLength(1);
  });

  it('N20/G27-1: errors, bad format, refusal and truncation fail the run and leave decks and combos untouched', async () => {
    const cases: Array<[() => Response | Promise<Response>, string]> = [
      [() => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'bad key' } }), { status: 401 }), 'auth'],
      [() => new Response(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }), { status: 429 }), 'rate-limit'],
      [() => new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'oops' } }), { status: 500 }), 'server'],
      [() => Promise.reject(new TypeError('Failed to fetch')), 'network'],
      [() => sse(anthropicSse('不是 JSON')), 'bad-format'],
      [() => sse(anthropicSse(JSON.stringify({ ...mockAiOutput(IDS), routes: [] }))), 'bad-format'],
      [() => sse(anthropicSse('', { stopReason: 'refusal' })), 'refusal'],
      [() => sse(anthropicSse(goodText.slice(0, 200), { stopReason: 'max_tokens' })), 'truncated'],
    ];
    for (const [respond, code] of cases) {
      TestBed.resetTestingModule();
      const { service, db } = await setup(respond);
      const before = await snapshot(db);
      const run = await service.start(deck);
      expect([run.status, run.error?.code]).toEqual(['failed', code]);
      expect(run.candidates).toBeUndefined();
      expect(service.state().phase).toBe('failed');
      expect(await snapshot(db)).toBe(before);
    }
  });

  it('G22-4: cancel and timeout abort the request and are recorded as such', async () => {
    const hang = (init: RequestInit) => new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    const { service } = await setup(hang);
    const pending = service.start(deck);
    await vi.waitFor(() => expect(service.state().phase).toBe('requesting'));
    service.cancel();
    const cancelled = await pending;
    expect([cancelled.status, cancelled.error?.code]).toEqual(['cancelled', 'cancelled']);
    expect(service.state().phase).toBe('cancelled');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await service.updateSettings({ timeoutSeconds: 30 });
      const slow = service.start(deck, { force: true });
      await vi.waitFor(() => expect(service.state().phase).toBe('requesting'));
      await vi.advanceTimersByTimeAsync(30_000);
      const timedOut = await slow;
      expect([timedOut.status, timedOut.error?.code]).toEqual(['failed', 'timeout']);
      expect(timedOut.error?.message).toContain('超過 30 秒');
    } finally {
      vi.useRealTimers();
    }
  });

  it('G25: saving a candidate creates an ordinary Combo (never verified); recheck and delete work', async () => {
    const { service, db } = await setup(() => sse(anthropicSse(goodText)));
    const run = await service.start(deck);
    const saved = await service.saveCandidate(run, 0);
    expect(saved.verification.status).toBe('unverified');
    expect(saved.analysis?.origin).toBe('ai');
    expect(await TestBed.inject(ComboRepository).get(saved.id)).toEqual(saved);
    expect((await service.saveCandidate(run, 0)).id).toBe(saved.id); // saving twice does not duplicate
    expect((await service.getRun(run.id))?.candidates?.[0].savedComboId).toBe(saved.id);

    const changed = { ...deck, version: 4, extra: deck.extra.filter((r) => r.cardId !== IDS.link).concat({ cardId: 499, count: 1 }) };
    const rechecked = await service.recheckCandidate(run, 0, changed);
    expect(rechecked.route.analysis?.check.passed).toBe(false);
    expect(rechecked.route.verification.status).toBe('draft');
    expect(rechecked.savedComboId).toBe(saved.id);

    const combo = await service.recheckCombo(saved, changed);
    expect(combo.analysis?.check).toMatchObject({ passed: false, deckFingerprint: deckFingerprint(changed) });
    expect(combo.verification.status).toBe('unverified'); // status is the user's; matcher and level use the live check
    expect(combo.version).toBe(2);

    await service.deleteCandidate(run, 1);
    expect((await service.getRun(run.id))?.candidates).toHaveLength(1);
    await service.deleteRun(run.id);
    expect(await service.listRuns(deck.id)).toEqual([]);
    expect((await db.getAll('combos')).map((c) => c.id).sort()).toEqual(['existing', saved.id].sort());
  });

  it('G27-2: the key lives only in this tab: never in IndexedDB', async () => {
    const { service, db } = await setup(() => sse(anthropicSse(goodText)));
    service.setApiKey('sk-ant-secret-for-test');
    await service.start(deck);
    expect(sessionStorage.getItem(API_KEY_STORAGE)).toBe('sk-ant-secret-for-test');
    const everything = JSON.stringify(await Promise.all(['decks', 'combos', 'cards', 'layouts', 'meta'].map((s) => db.getAll(s as 'meta'))));
    expect(everything).not.toContain('sk-ant-secret-for-test');
  });

  it('local Ollama provider works the same way (mocked local server)', async () => {
    const { service, requests } = await setup(() => new Response(ollamaNdjson(goodText, { model: 'qwen-test' }), { status: 200 }));
    await service.updateSettings({ provider: 'ollama', ollamaModel: 'qwen-test' });
    service.setApiKey('');
    const run = await service.start(deck);
    expect(run).toMatchObject({ status: 'succeeded', provider: 'ollama', model: 'qwen-test', params: { temperature: 0 }, usage: { inputTokens: 9000, outputTokens: 2500 } });
    expect(run.usage?.estimatedCostUsd).toBeUndefined();
    expect(requests[0].url).toBe('http://localhost:11434/api/chat');
  });
});
