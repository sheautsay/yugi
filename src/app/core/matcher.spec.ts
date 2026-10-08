import { ParsedDeck, deckFingerprint } from './deck';
import { MatchContext, allocateHand, conditionErrors, matchRoute, matchRoutes } from './matcher';
import { ComboRoute, RouteConditions } from './models';

// Abstract test card IDs (acceptance §6.1): A..F; X is an extra-deck card.
const [A, B, C, D, E, F, X] = [1, 2, 3, 4, 5, 6, 7];

const deck: ParsedDeck = {
  main: [
    { cardId: A, count: 3 },
    { cardId: B, count: 3 },
    { cardId: C, count: 3 },
    { cardId: D, count: 3 },
    { cardId: E, count: 3 },
    { cardId: F, count: 3 },
  ],
  extra: [{ cardId: X, count: 1 }],
  side: [],
};

const FIRST: MatchContext = { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true };
const SECOND: MatchContext = { ...FIRST, turnOrder: 'second' };

function conditions(partial: Partial<RouteConditions>): RouteConditions {
  return {
    handAllOf: [{ anyOf: [A], count: 1 }],
    setup: { turnOrder: 'either', emptyBoard: true, normalSummonAvailable: true, noInterruption: true },
    ...partial,
  };
}

/** A route verified against `forDeck`, so a full match is `available`. */
function route(partial: Partial<RouteConditions> = {}, extra: Partial<ComboRoute> = {}, forDeck: ParsedDeck = deck): ComboRoute {
  return {
    schemaVersion: 1,
    id: extra.id ?? 'r1',
    version: 1,
    name: extra.name ?? '測試路線',
    archetype: 'Test',
    format: 'master-duel',
    conditions: conditions(partial),
    steps: [{ id: 's1', order: 1, actionType: 'other', actorCardIds: [], title: '一步', description: '說明' }],
    endBoard: [],
    verification: { status: 'verified', verifiedAt: '2026-10-08', verifiedBy: 'tester', evidenceNote: 'video', deckFingerprint: deckFingerprint(forDeck) },
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
    ...extra,
  };
}

const codes = (m: ReturnType<typeof matchRoute>) => m.reasons.map((r) => r.code);

describe('matcher — acceptance §6.1 fixed examples (G5)', () => {
  it('M1: A×1 with A+B+C+D+E → hand condition met', () => {
    const m = matchRoute(route(), deck, [A, B, C, D, E], FIRST);
    expect(m.kind).toBe('available');
    expect(m.matchedHandAllocation).toEqual([{ clauseIndex: 0, cardIds: [A] }]);
  });

  it('M2: A×2 with A+B+C+D+E → not met, one A missing', () => {
    const m = matchRoute(route({ handAllOf: [{ anyOf: [A], count: 2 }] }), deck, [A, B, C, D, E], FIRST);
    expect(m.kind).toBe('unavailable');
    expect(codes(m)).toEqual(['HAND_MISSING']);
    expect(m.reasons[0].textZhTw).toContain('目前手牌只有 1 張');
  });

  it('M3: (A or B)×1 + A×1 with A+B+C+D+E → met using one A and one B', () => {
    const m = matchRoute(route({ handAllOf: [{ anyOf: [A, B], count: 1 }, { anyOf: [A], count: 1 }] }), deck, [A, B, C, D, E], FIRST);
    expect(m.kind).toBe('available');
    expect(m.matchedHandAllocation).toEqual([
      { clauseIndex: 0, cardIds: [B] },
      { clauseIndex: 1, cardIds: [A] },
    ]);
  });

  it('M4: (A or B)×1 + A×1 with A+C+D+E+F → not met, one A cannot be allocated twice', () => {
    const m = matchRoute(route({ handAllOf: [{ anyOf: [A, B], count: 1 }, { anyOf: [A], count: 1 }] }), deck, [A, C, D, E, F], FIRST);
    expect(m.kind).toBe('unavailable');
    expect(m.reasons).toEqual([{ code: 'HAND_MISSING', textZhTw: '手牌無法同時滿足所有起手條件：同一張卡不能同時分配給兩個條件' }]);
  });

  it('M5: A×1 and 1 spare cost card with A+B+C+D+E → met', () => {
    expect(matchRoute(route({ unallocatedHandMin: 1 }), deck, [A, B, C, D, E], FIRST).kind).toBe('available');
  });

  it('M6: A×1 and 5 spare cost cards with A+B+C+D+E → not met', () => {
    const m = matchRoute(route({ unallocatedHandMin: 5 }), deck, [A, B, C, D, E], FIRST);
    expect(m.kind).toBe('unavailable');
    expect(codes(m)).toEqual(['HAND_COST_MISSING']);
    expect(m.reasons[0].textZhTw).toContain('剩 4 張');
  });

  it('M7: B×1 must remain in the main deck but the hand took the last B → not met', () => {
    const oneB: ParsedDeck = { ...deck, main: deck.main.map((c) => (c.cardId === B ? { ...c, count: 1 } : c)) };
    const m = matchRoute(route({ mustRemainInMain: [{ cardId: B, count: 1 }] }, {}, oneB), oneB, [A, B, C, D, E], FIRST);
    expect(m.kind).toBe('unavailable');
    expect(codes(m)).toEqual(['REMAINING_DECK_MISSING']);
  });

  it('M8: extra deck needs C×1 but has none → not met', () => {
    const m = matchRoute(route({ mustExistInExtra: [{ cardId: C, count: 1 }] }), deck, [A, B, C, D, E], FIRST);
    expect(m.kind).toBe('unavailable');
    expect(codes(m)).toEqual(['EXTRA_MISSING']);
  });
});

describe('matcher — §4.3 allocation rule', () => {
  const clauses = [
    { anyOf: [A, B], count: 1 },
    { anyOf: [A], count: 1 },
  ];
  it('one A alone does not satisfy both clauses', () => {
    expect(allocateHand([A, C, D, E, F], clauses)).toBeNull();
  });
  it('[A, B] satisfies them', () => {
    expect(allocateHand([A, B, C, D, E], clauses)).not.toBeNull();
  });
  it('[A, A] satisfies them when the deck has two A', () => {
    expect(allocateHand([A, A, C, D, E], clauses)).toEqual([
      { clauseIndex: 0, cardIds: [A] },
      { clauseIndex: 1, cardIds: [A] },
    ]);
    expect(matchRoute(route({ handAllOf: clauses }), deck, [A, A, C, D, E], FIRST).kind).toBe('available');
  });
  it('needs backtracking when a greedy first choice would block a later clause', () => {
    // Greedy would give A to clause 0 and leave clause 1 (A only) unsatisfied.
    expect(allocateHand([A, B, C, D, E], [{ anyOf: [A, B], count: 1 }, { anyOf: [A], count: 1 }, { anyOf: [C], count: 1 }])).not.toBeNull();
    expect(allocateHand([A, B, B, D, E], [{ anyOf: [A, B], count: 2 }, { anyOf: [B], count: 1 }])).toEqual([
      { clauseIndex: 0, cardIds: [A, B] },
      { clauseIndex: 1, cardIds: [B] },
    ]);
  });
  it('N4: two OR groups competing for the same single card do not both match', () => {
    expect(allocateHand([A, C, D, E, F], [{ anyOf: [A, B], count: 1 }, { anyOf: [A, X], count: 1 }])).toBeNull();
  });
  it('the cost requirement does not reuse cards already allocated', () => {
    const m = matchRoute(route({ handAllOf: [{ anyOf: [A], count: 1 }, { anyOf: [B], count: 1 }], unallocatedHandMin: 4 }), deck, [A, B, C, D, E], FIRST);
    expect(codes(m)).toEqual(['HAND_COST_MISSING']);
  });
});

describe('matcher — G5 other conditions and purity', () => {
  it('reports forbidden cards in hand', () => {
    const m = matchRoute(route({ forbiddenInHand: [E] }), deck, [A, B, C, D, E], FIRST);
    expect(codes(m)).toEqual(['FORBIDDEN_IN_HAND']);
  });

  it('remaining main copies = deck.main − hand, not the imported total (N4)', () => {
    const r = route({ mustRemainInMain: [{ cardId: A, count: 2 }] });
    expect(matchRoute(r, deck, [A, B, C, D, E], FIRST).kind).toBe('available');
    expect(codes(matchRoute(r, deck, [A, A, C, D, E], FIRST))).toEqual(['REMAINING_DECK_MISSING']);
  });

  it('compares extra requirements against the extra deck only', () => {
    const r = route({ mustExistInExtra: [{ cardId: A, count: 1 }] });
    expect(codes(matchRoute(r, deck, [A, B, C, D, E], FIRST))).toEqual(['EXTRA_MISSING']);
  });

  it('checks each setup assumption against the context', () => {
    const r = route();
    expect(codes(matchRoute(r, deck, [A, B, C, D, E], { ...FIRST, emptyBoard: false }))).toEqual(['CONTEXT_MISMATCH']);
    expect(codes(matchRoute(r, deck, [A, B, C, D, E], { ...FIRST, normalSummonAvailable: false }))).toEqual(['CONTEXT_MISMATCH']);
    expect(codes(matchRoute(r, deck, [A, B, C, D, E], { ...FIRST, noInterruption: false }))).toEqual(['CONTEXT_MISMATCH']);
    const relaxed = route({ setup: { turnOrder: 'either', emptyBoard: false, normalSummonAvailable: false, noInterruption: false } });
    expect(matchRoute(relaxed, deck, [A, B, C, D, E], { ...FIRST, emptyBoard: false, normalSummonAvailable: false, noInterruption: false }).kind).toBe('available');
  });

  it('is pure: inputs are not mutated and repeated calls give equal results', () => {
    const r = route({ handAllOf: [{ anyOf: [B, A], count: 1 }, { anyOf: [A], count: 1 }], mustRemainInMain: [{ cardId: C, count: 1 }] });
    const frozen = <T>(o: T): T => {
      Object.values(o as object).forEach((v) => typeof v === 'object' && v !== null && frozen(v));
      return Object.freeze(o);
    };
    const d = frozen(structuredClone(deck));
    const rr = frozen(structuredClone(r));
    const hand = Object.freeze([A, B, C, D, E]);
    const first = matchRoute(rr, d, hand, FIRST);
    expect(matchRoute(rr, d, hand, FIRST)).toEqual(first);
    expect(rr).toEqual(r);
    expect(d).toEqual(deck);
  });
});

describe('matcher — G6 statuses never fake "available"', () => {
  const hand = [A, B, C, D, E];

  it('draft and unverified routes that match are "unverified"', () => {
    for (const status of ['draft', 'unverified'] as const) {
      const m = matchRoute(route({}, { verification: { status } }), deck, hand, FIRST);
      expect(m.kind).toBe('unverified');
      expect(codes(m)).toEqual(['UNVERIFIED']);
    }
  });

  it('invalidated routes are not offered', () => {
    const m = matchRoute(route({}, { verification: { status: 'invalidated' } }), deck, hand, FIRST);
    expect(m.kind).toBe('unavailable');
    expect(m.reasons[0].textZhTw).toContain('失效');
  });

  it('a route verified on a different deck list is "unverified" for this deck', () => {
    const otherDeck: ParsedDeck = { ...deck, main: [...deck.main.slice(1), { cardId: A, count: 2 }] };
    const m = matchRoute(route({}, {}, otherDeck), deck, hand, FIRST);
    expect(m.kind).toBe('unverified');
    expect(m.reasons[0].textZhTw).toContain('另一份牌表');
  });

  it('"verified" without complete evidence or without steps is "unverified"', () => {
    const noEvidence = route({}, { verification: { status: 'verified', deckFingerprint: deckFingerprint(deck) } });
    expect(matchRoute(noEvidence, deck, hand, FIRST).kind).toBe('unverified');
    expect(matchRoute(route({}, { steps: [] }), deck, hand, FIRST).kind).toBe('unverified');
  });

  it('missing card data makes a matching route "unknown"', () => {
    const m = matchRoute(route(), deck, hand, FIRST, { knownCardIds: new Set([B, C]) });
    expect(m.kind).toBe('unknown');
    expect(codes(m)).toEqual(['MISSING_CARD_DATA']);
  });

  it('structurally invalid routes are "unknown" with INVALID_ROUTE', () => {
    const m = matchRoute(route({ handAllOf: [{ anyOf: [], count: 1 }] }), deck, hand, FIRST);
    expect(m.kind).toBe('unknown');
    expect(codes(m)).toEqual(['INVALID_ROUTE']);
    expect(conditionErrors(conditions({ handAllOf: [] }))).toContain('起手條件至少需要一個群組');
    expect(conditionErrors(conditions({ handAllOf: [{ anyOf: [A, A], count: 1 }] }))[0]).toContain('重複');
    expect(conditionErrors(conditions({ handAllOf: [{ anyOf: [A], count: 7 }] })).length).toBeGreaterThan(0);
  });

  it('sorts: available → weight → fewer hand cards → name', () => {
    const results = matchRoutes(
      [
        route({}, { id: 'unverified', name: 'Z', verification: { status: 'unverified' } }),
        route({ handAllOf: [{ anyOf: [A], count: 1 }, { anyOf: [B], count: 1 }] }, { id: 'two-cards', name: 'A' }),
        route({}, { id: 'light', name: 'B', rankingWeight: 1 }),
        route({}, { id: 'heavy', name: 'C', rankingWeight: 5 }),
        route({}, { id: 'one-card', name: 'A' }),
        route({ handAllOf: [{ anyOf: [F], count: 3 }] }, { id: 'no-match', name: 'A' }),
      ],
      deck,
      hand,
      FIRST,
    );
    expect(results.map((r) => r.route.id)).toEqual(['heavy', 'light', 'one-card', 'two-cards', 'unverified', 'no-match']);
  });
});

describe('matcher — G16 six-card hands', () => {
  it('counts spare cost cards from the actual hand size', () => {
    const r = route({ unallocatedHandMin: 5 });
    expect(matchRoute(r, deck, [A, B, C, D, E, F], SECOND).kind).toBe('available');
    expect(matchRoute(r, deck, [A, B, C, D, E], FIRST).kind).toBe('unavailable'); // M6 unchanged
  });

  it('turn-order-specific routes mismatch the other turn order; "either" fits both', () => {
    const firstOnly = route({ setup: { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true } });
    const secondOnly = route({ setup: { turnOrder: 'second', emptyBoard: true, normalSummonAvailable: true, noInterruption: true } });
    expect(matchRoute(firstOnly, deck, [A, B, C, D, E, F], SECOND).reasons[0]).toEqual({ code: 'CONTEXT_MISMATCH', textZhTw: '此路線限先攻（5 張起手）' });
    expect(matchRoute(secondOnly, deck, [A, B, C, D, E], FIRST).reasons[0].code).toBe('CONTEXT_MISMATCH');
    expect(matchRoute(firstOnly, deck, [A, B, C, D, E], FIRST).kind).toBe('available');
    expect(matchRoute(secondOnly, deck, [A, B, C, D, E, F], SECOND).kind).toBe('available');
    expect(matchRoute(route(), deck, [A, B, C, D, E, F], SECOND).kind).toBe('available');
  });
});
