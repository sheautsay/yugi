import { TestBed } from '@angular/core/testing';
import { AppDb, DB_NAME } from '../db';
import { AiAnalysisService, DEFAULT_AI_SETTINGS } from './analysis.service';
import { analyzeCandidates } from './evaluate';
import { malissCards, malissDeck } from '../../../testing/ai/maliss-deck.sample';
import { C, routeAllied, routeAlliedTooFewMaterials, routeFirewall, routeFirewallIntoAllied, routeMalissOnly, sampleAnswer } from '../../../testing/ai/maliss-routes.sample';
import { anthropicSse } from '../../../testing/ai/mock-ai.sample';
import { PROMPT_VERSION, buildPrompt, linkCardsWithoutArrows } from './prompt';
import { AI_FETCH, FetchLike } from './providers';

// CR-006 G34 / G35 / G36 / G39 on the user's real deck (fixed card data) with a FAKE network:
// every "AI" answer here is a mocked response built from hand-written routes.
const deck = malissDeck();
const cards = malissCards();
const scope = { single: true, multi: true, extenders: true, maxRoutes: 5, candidates: 8 };
const cardLines = (user: string) => user.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as Record<string, unknown>);

describe('G34 — the full 40 + 15 deck reaches the analyser', () => {
  it('the deck is the user\'s 40/15 list', () => {
    expect(deck.main.reduce((s, r) => s + r.count, 0)).toBe(40);
    expect(deck.extra.reduce((s, r) => s + r.count, 0)).toBe(15);
    expect(deck.main.length + deck.extra.length).toBe(41);
  });

  it('one line per card with copies, full text, type tags and — for Link Monsters — the arrows', () => {
    const { user } = buildPrompt(deck, cards, scope);
    const lines = cardLines(user);
    expect(lines).toHaveLength(41);
    expect(lines.filter((l) => l['deck'] === 'main').reduce((s, l) => s + (l['copies'] as number), 0)).toBe(40);
    expect(lines.filter((l) => l['deck'] === 'extra').reduce((s, l) => s + (l['copies'] as number), 0)).toBe(15);
    for (const l of lines) {
      const card = cards.get(l['id'] as number)!;
      expect(l['text']).toBe(card.desc);
      expect(l['typeTags']).toEqual(card.typeTags);
      if (card.frameType === 'link') expect(l['arrows']).toEqual(card.linkMarkers);
    }
    expect(lines.find((l) => l['id'] === C.allied)?.['arrows']).toEqual(['Left', 'Right', 'Bottom-Left', 'Bottom', 'Bottom-Right']);
    expect(lines.find((l) => l['id'] === C.dormouse)?.['effects']).toEqual(expect.arrayContaining([expect.stringContaining(`${C.dormouse}#1`)]));
  });

  it('N30: Link Monsters without arrows are listed (data synced before this change)', () => {
    const old = new Map([...cards].map(([id, c]) => [id, { ...c, linkMarkers: undefined }]));
    expect(linkCardsWithoutArrows(deck, old)).toHaveLength(15);
    expect(linkCardsWithoutArrows(deck, cards)).toEqual([]);
  });
});

describe('G35 / G36 — goal, preferred monsters, generation vs display, generic Extra Deck', () => {
  it('the goal and the preferred monsters are a preference in the prompt; ids outside the Extra Deck are ignored', () => {
    const { system, user } = buildPrompt(deck, cards, scope, { kind: 'targets', preferredExtraIds: [C.allied, C.firewall, C.redRansom] });
    expect(PROMPT_VERSION).toBe('deck-analysis-v2');
    const preferred = user.split('\n').find((l) => l.startsWith('Preferred Extra Deck monsters'))!;
    expect(preferred).toContain('Allied Code Talker @Ignister');
    expect(preferred).toContain('Firewall Dragon');
    expect(preferred).not.toContain(String(C.redRansom));
    expect(preferred).toContain('not a requirement');
    expect(user).toContain('Return at most 8 routes');
    expect(system).toContain('generic');
    expect(system).toContain('end board is ONLY');
    expect(system).toContain('not by ATK or Link Rating');
    expect(system).toContain('Never claim that a route is legal, verified or tested.');
  });

  it('each goal has its own instruction', () => {
    const goalLine = (kind: 'interruptions' | 'targets' | 'resources' | 'diverse') => buildPrompt(deck, cards, scope, { kind, preferredExtraIds: [] }).user.split('\n').find((l) => l.startsWith('Analysis goal'))!;
    expect(new Set((['interruptions', 'targets', 'resources', 'diverse'] as const).map(goalLine)).size).toBe(4);
  });
});

async function setup(answer: Record<string, unknown>) {
  sessionStorage.clear();
  const requests: Array<{ url: string; body: string }> = [];
  const fetch: FetchLike = async (input, init = {}) => {
    requests.push({ url: String(input), body: String(init.body ?? '') });
    return new Response(anthropicSse(JSON.stringify(answer)), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DB_NAME, useValue: `goals-${crypto.randomUUID()}` },
      { provide: AI_FETCH, useValue: fetch },
    ],
  });
  const db = await TestBed.inject(AppDb).db();
  for (const card of cards.values()) await db.put('cards', card);
  await db.put('decks', deck);
  const service = TestBed.inject(AiAnalysisService);
  await service.ready;
  service.setApiKey('test-key-not-real');
  return { service, db, requests };
}

describe('AiAnalysisService with the real deck (mocked model answers only)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('G34-4: the single request carries all 41 cards; the run records goal, preferences and display/generation counts', async () => {
    const { service, requests } = await setup(sampleAnswer([routeMalissOnly(), routeAllied()]));
    await service.updateSettings({ goal: { kind: 'targets', preferredExtraIds: [C.allied, C.redRansom] }, scope: { ...DEFAULT_AI_SETTINGS.scope, maxRoutes: 3, candidates: 6 } });
    const run = await service.start(deck);
    expect(run.status).toBe('succeeded');
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain('api.anthropic.com');
    for (const id of [...deck.main, ...deck.extra].map((r) => r.cardId)) expect(requests[0].body).toContain(`\\"id\\":${id},`);
    expect(run.promptVersion).toBe('deck-analysis-v2');
    expect(run.goal).toEqual({ kind: 'targets', preferredExtraIds: [C.allied] });
    expect(run.scope).toMatchObject({ maxRoutes: 3, candidates: 6 });
  });

  it('G35-3: a different goal is a different cache key (new request); the same goal reuses the cache', async () => {
    const { service, requests } = await setup(sampleAnswer([routeMalissOnly()]));
    await service.start(deck);
    await service.start(deck);
    expect(requests).toHaveLength(1);
    await service.updateSettings({ goal: { kind: 'diverse', preferredExtraIds: [] } });
    await service.start(deck);
    expect(requests).toHaveLength(2);
    await service.updateSettings({ goal: { kind: 'diverse', preferredExtraIds: [C.firewall] } });
    await service.start(deck);
    expect(requests).toHaveLength(3);
  });

  it('N30: no request while Link Monsters lack arrows', async () => {
    const { service, db, requests } = await setup(sampleAnswer([routeAllied()]));
    await db.put('cards', { ...cards.get(C.firewall)!, linkMarkers: undefined });
    const error = await service.start(deck).catch((e: Error) => e.message);
    expect(error).toContain('連結箭頭');
    expect(error).toContain('強制重新下載');
    expect(requests).toHaveLength(0);
  });

  it('G36 / G39: Allied Code Talker preferred — the answer is checked, ranked and covered; nothing is invented', async () => {
    const { service } = await setup(sampleAnswer([routeMalissOnly(), routeAlliedTooFewMaterials(), routeFirewall(), routeAllied(), routeFirewallIntoAllied()]));
    await service.updateSettings({ goal: { kind: 'targets', preferredExtraIds: [C.allied, C.firewall, C.transcode] }, scope: { ...DEFAULT_AI_SETTINGS.scope, maxRoutes: 3, candidates: 5 } });
    const run = await service.start(deck);
    const result = analyzeCandidates(run, deck, cards);
    // Shown (max 3): the three valid routes that end on a preferred monster; the rest are kept, not dropped.
    expect(result.shown.map((r) => run.candidates![r.index].route.name).sort()).toEqual(
      ['Dormouse → Allied Code Talker＋White Binder', 'Dormouse → Firewall Dragon → Allied Code Talker', 'Dormouse → Firewall Dragon＋White Binder'].sort(),
    );
    expect(result.more.map((r) => r.index)).toEqual([0, 1]);
    const byId = new Map(result.coverage.map((c) => [c.cardId, c]));
    expect(byId.get(C.allied)).toMatchObject({ found: true, onFinalBoard: 2, failedChecks: 1 });
    expect(byId.get(C.firewall)).toMatchObject({ found: true, onFinalBoard: 1, intermediate: 1 });
    expect(byId.get(C.transcode)).toMatchObject({ found: false });
    expect(byId.get(C.transcode)!.message).toContain('未找到已驗證路線');
  });

  it('G39-3 / N29: a summary claiming success does not count; only the Maliss-only board → not found', async () => {
    const { service } = await setup(
      sampleAnswer([routeMalissOnly()], {
        summary: '已找到 Allied Code Talker @Ignister 與 Firewall Dragon 的完整路線（模擬的錯誤宣稱）',
        explored: [{ name: 'ACT 構想', handCardIds: [C.dormouse], extraDeckCardIds: [C.allied], finalBoardCardIds: [C.allied], routeName: '', note: '未展開' }],
      }),
    );
    await service.updateSettings({ goal: { kind: 'targets', preferredExtraIds: [C.allied, C.firewall] } });
    const run = await service.start(deck);
    expect(run.explored).toHaveLength(1);
    const { coverage } = analyzeCandidates(run, deck, cards);
    expect(coverage.every((c) => !c.found && c.message.includes('未找到已驗證路線'))).toBe(true);
    expect(coverage.find((c) => c.cardId === C.allied)!.message).toContain('沒有展開');
  });
});
