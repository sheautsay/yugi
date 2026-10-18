import { deckFingerprint } from '../deck';
import { ComboRoute } from '../models';
import { checkRoute } from '../route-check';
import { RunContext, parseAiOutput, toCandidate } from './analysis-output';
import { endSnapshot } from './board-snapshot';
import { evaluateRoute } from './evaluate';
import { malissCards, malissDeck } from './maliss-deck.sample';
import { C, SampleRoute, routeAlliedPlusTrap, routeMalissOnly, sampleAnswer, withRoles } from './maliss-routes.sample';
import { REAL_RUN_RECORD } from './real-ai-run.sample';
import { STAGED_PROMPT_VERSION } from './staged';

// CR-008 G51 / G49-4. The snapshot is computed from the simulation of the route up to its LAST step.
// Routes 1 and 2 below are the RECORDED output of the one real model run (AI-generated, see
// real-ai-run.sample.ts); the others are HAND-WRITTEN test data.
const deck = malissDeck();
const cards = malissCards();
const real: ComboRoute[] = REAL_RUN_RECORD.candidates.map((c: { route: ComboRoute }) => c.route);
const ctx: RunContext = { runId: 'run-rev8', deck, deckFingerprint: deckFingerprint(deck), cardDataVersion: 'test', provider: 'anthropic', model: 'mock', promptVersion: STAGED_PROMPT_VERSION, cards, now: '2026-10-09T00:00:00.000Z' };
const clone = (r: ComboRoute): ComboRoute => JSON.parse(JSON.stringify(r));

function handRoute(r: SampleRoute): ComboRoute {
  const parsed = parseAiOutput(JSON.stringify(sampleAnswer([withRoles(r)])));
  if (!parsed.ok) throw new Error(parsed.error);
  return toCandidate(parsed.output.routes[0], ctx).route;
}
const ids = (cells: Array<{ cardId: number } | null>) => cells.map((c) => c?.cardId ?? null);

describe('endSnapshot of a recorded real route (Firewall Dragon + Hearts Crypter)', () => {
  const route = real[0];
  const s = endSnapshot(route, deck, cards)!;
  const check = checkRoute(route, deck, { cards });

  it('has the 2 Extra Monster Zones, 5 Main Monster Zones and 5 Spell/Trap Zones', () => {
    expect(s.emz).toHaveLength(2);
    expect(s.mmz).toHaveLength(5);
    expect(s.spellTrap).toHaveLength(5);
    expect(ids(s.emz)).toEqual([C.firewall, null]);
    expect(ids(s.mmz)).toEqual([null, C.heartsCrypter, null, null, null]);
    expect(ids(s.spellTrap)).toEqual([null, null, null, null, null]);
    expect(s.fieldZone).toBeNull();
    expect(s.unplaced).toEqual([]);
    expect(s.layoutKnown).toBe(true);
  });

  it('is the state after the LAST step, identical to what the data check ends with (G51-1, N42)', () => {
    expect(s.step).toBe(route.steps.length);
    const last = check.rules!.steps.at(-1)!;
    expect(last.order).toBe(route.steps.length);
    expect(last.board.monsters.map((m) => [m.cardId, m.slot])).toEqual(check.rules!.board.monsters.map((m) => [m.cardId, m.slot]));
    const placed = [...s.emz, ...s.mmz].filter((c) => c).map((c) => [c!.cardId, c!.slot]);
    expect(placed.sort()).toEqual(check.rules!.board.monsters.map((m) => [m.cardId, m.slot]).sort());
    expect(s.gy).toEqual(check.final.gy);
    expect(s.banished).toEqual(check.final.banished);
    expect(s.hand).toEqual(check.final.hand);
    expect([s.deckCount, s.extraCount]).toEqual([check.final.deckCount, check.final.extraCount]);
    expect([s.deckCount, s.extraCount]).toEqual([33, 10]);
  });

  it('has Link arrows from the card data, and marks the two co-linked monsters (G51-3)', () => {
    const fd = s.emz[0]!;
    const hc = s.mmz[1]!;
    expect(fd).toMatchObject({ isLink: true, slot: 'EMZ-L', arrows: ['Top', 'Left', 'Right', 'Bottom'] });
    expect(fd.pointsTo).toEqual(['M2']);
    expect(hc.pointsTo).toEqual(['EMZ-L']);
    expect(fd.coLinked).toEqual(['M2']);
    expect(hc.coLinked).toEqual(['EMZ-L']);
    expect(s.links).toEqual(expect.arrayContaining([{ from: 'EMZ-L', to: 'M2', mutual: true }, { from: 'M2', to: 'EMZ-L', mutual: true }]));
  });

  it('shows the graveyard, the banished zone, the hand and the interruptions with their basis', () => {
    expect(s.gy.map((g) => g.cardId).sort()).toEqual([C.dormouse, C.mtp07, C.whiteRabbit, C.whiteBinder, C.backup, C.wizard, C.gwc06, C.transcode].sort());
    expect(s.banished.map((g) => g.cardId).sort()).toEqual([C.marchHare, C.linkDecoder].sort());
    expect(s.evaluation.effective).toBe(2);
    expect(s.evaluation.verified).toBe(0);
    expect(s.evaluation.interruptions.every((i) => i.basis === 'static-estimate')).toBe(true);
    expect(s.evaluation.hand.untracked.min).toBe(3);
  });

  it('agrees with the evaluation of the same route', () => {
    const e = evaluateRoute(route, deck, cards, check);
    expect(s.evaluation.effective).toBe(e.effective);
    expect(s.evaluation.followUp).toEqual(e.followUp);
  });
});

describe('endSnapshot of a recorded real route (Allied Code Talker)', () => {
  const s = endSnapshot(real[1], deck, cards)!;

  it('places the three monsters and the Set Trap', () => {
    expect(ids(s.emz)).toEqual([C.allied, null]);
    expect(ids(s.mmz)).toEqual([C.transcode, C.whiteBinder, null, null, null]);
    expect(ids(s.spellTrap)).toEqual([C.gwc06, null, null, null, null]);
  });

  it('Allied Code Talker points at M1, M2 and M3; only White Binder points back (co-linked), Transcode Talker and White Binder are co-linked', () => {
    const [act] = s.emz;
    expect(act!.pointsTo).toEqual(['M1', 'M2', 'M3']);
    expect(act!.coLinked).toEqual(['M2']);
    expect(s.mmz[0]!.coLinked).toEqual(['M2']);
    expect(s.mmz[1]!.coLinked.sort()).toEqual(['EMZ-L', 'M1']);
    expect(s.spellTrap[0]).toMatchObject({ isLink: false, arrows: [], coLinked: [] });
  });
});

describe('endSnapshot — edge cases (G51-5, N42)', () => {
  it('a hand-written route with a Set Trap shows it in its Spell/Trap Zone', () => {
    const s = endSnapshot(handRoute(routeAlliedPlusTrap()), deck, cards)!;
    expect(s.spellTrap[1]).toMatchObject({ cardId: C.impermanence, slot: 'S2' });
    expect(ids(s.emz)).toEqual([C.allied, null]);
    expect(s.mmz[0]).toMatchObject({ cardId: C.whiteBinder, slot: 'M1' });
  });

  it('no card moves → no snapshot (the end board stays text only)', () => {
    const route = clone(real[2]);
    route.steps = route.steps.map((st) => ({ ...st, moves: undefined }));
    expect(endSnapshot(route, deck, cards)).toBeNull();
    const old = clone(handRoute(routeMalissOnly()));
    old.steps = [];
    expect(endSnapshot(old, deck, cards)).toBeNull();
  });

  it('a monster without a zone is listed as "unplaced" and the layout is not claimed to be known', () => {
    const route = clone(real[2]);
    for (const st of route.steps) for (const m of st.moves ?? []) if (m.cardId === C.linkDecoder && m.to === 'field') delete m.slot;
    const s = endSnapshot(route, deck, cards)!;
    expect(s.unplaced).toEqual([C.linkDecoder]);
    expect(s.layoutKnown).toBe(false);
    expect(ids(s.emz)).toEqual([C.heartsCrypter, null]);
  });

  it('is deterministic, and never changes the route', () => {
    const route = clone(real[0]);
    const before = JSON.stringify(route);
    expect(endSnapshot(route, deck, cards)).toEqual(endSnapshot(route, deck, cards));
    expect(JSON.stringify(route)).toBe(before);
  });
});

describe('step states — effects used this turn and the standing summon restrictions (G49-4)', () => {
  const check = checkRoute(real[0], deck, { cards });
  const steps = check.rules!.steps;
  const text = (order: number) => steps.find((x) => x.order === order)!;

  it('has one state per step', () => {
    expect(steps.map((x) => x.order)).toEqual(real[0].steps.map((x) => x.order));
  });

  it('counts each effect as it is used', () => {
    expect(text(1).used).toEqual([]);
    expect(text(2).used).toContainEqual({ ref: `${C.dormouse}#1`, count: 1 });
    expect(text(22).used.length).toBeGreaterThan(text(2).used.length);
    expect(text(22).used.every((u) => u.count >= 1)).toBe(true);
  });

  it('lists the restrictions that apply from then on', () => {
    expect(text(1).locks).toEqual([]);
    expect(text(3).locks.some((l) => l.includes('連結怪獸'))).toBe(true);
    expect(text(15).locks.every((l) => !l.includes('只能特殊召喚電子界族'))).toBe(true);
    expect(text(16).locks.some((l) => l.includes('只能特殊召喚電子界族') && l.includes('Wizard @Ignister'))).toBe(true);
  });
});
