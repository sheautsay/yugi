import { deckFingerprint } from './deck';
import { RunContext, parseAiOutput, toCandidate } from './ai/analysis-output';
import { STAGED_PROMPT_VERSION } from './ai/staged';
import { malissCards, malissDeck } from '../../testing/ai/maliss-deck.sample';
import { SampleRoute, routeAllied, routeFirewall, routeMalissOnly, sampleAnswer } from '../../testing/ai/maliss-routes.sample';
import { rankForBattle } from './battle-rank';
import { matchRoutes } from './matcher';
import { ComboRoute } from './models';

// The real Maliss routes (hand-written test data) through the real matcher, evaluation and ranking.
const deck = malissDeck();
const cards = malissCards();
const ctx: RunContext = { runId: 'battle', deck, deckFingerprint: deckFingerprint(deck), cardDataVersion: 'test', provider: 'anthropic', model: 'mock', promptVersion: STAGED_PROMPT_VERSION, cards, now: '2026-10-18T00:00:00.000Z' };

function convert(r: SampleRoute, id: string): ComboRoute {
  const parsed = parseAiOutput(JSON.stringify(sampleAnswer([r])));
  if (!parsed.ok) throw new Error(parsed.error);
  const route = toCandidate(parsed.output.routes[0], ctx).route;
  return { ...route, id, verification: { status: 'unverified' } };
}

const context = { turnOrder: 'first' as const, emptyBoard: true, normalSummonAvailable: true, noInterruption: true };
// Dormouse plus four cards none of the routes needs to keep in the deck.
const hand = [32061192, 23434538, 14558127, 10045474, 24842059];

describe('battle ranking with the Maliss sample routes (B1)', () => {
  const routes = [convert(routeMalissOnly(), 'maliss-only'), convert(routeAllied(), 'allied'), convert(routeFirewall(), 'firewall'), convert(routeAllied(), 'allied-copy')];
  const results = matchRoutes(routes, deck, hand, context, { cards });
  const goal = { kind: 'interruptions' as const, preferredExtraIds: [] };

  it('only matching routes are ranked, best score first, and the identical end board is folded', () => {
    const ranked = rankForBattle(results, deck, cards, goal);
    expect(ranked.map((e) => e.route.id).sort()).toEqual(expect.arrayContaining(['allied', 'firewall', 'maliss-only']));
    for (let i = 1; i < ranked.length; i++) {
      const [a, b] = [ranked[i - 1].score, ranked[i].score];
      const firstDiff = a.findIndex((v, k) => v !== b[k]);
      expect(firstDiff === -1 || a[firstDiff] > b[firstDiff]).toBe(true);
    }
    const allied = ranked.filter((e) => e.route.id === 'allied' || e.route.id === 'allied-copy');
    expect(allied).toHaveLength(1);
    expect(allied[0].sameEndBoard).toBe(1);
    expect(ranked.every((e) => !e.verified)).toBe(true);
  });

  it('a route not matching the hand is left out', () => {
    const noDormouse = matchRoutes(routes, deck, [23434538, 14558127, 10045474, 24842059, 3723262], context, { cards });
    expect(rankForBattle(noDormouse, deck, cards, goal)).toEqual([]);
  });
});
