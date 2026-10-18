import { TestBed } from '@angular/core/testing';
import { malissCards, malissDeck } from '../../../testing/ai/maliss-deck.sample';
import { SampleRoute, routeAllied, routeAlliedTooFewMaterials, routeFirewall, routeMalissOnly, sampleAnswer } from '../../../testing/ai/maliss-routes.sample';
import { ComboRepository } from '../combo-repository';
import { AppDb, DB_NAME } from '../db';
import { deckFingerprint } from '../deck';
import { AiRunStore } from './ai-run-store.service';
import { RunContext, parseAiOutput, toCandidate } from './analysis-output';
import { AnalysisRun } from './analysis-types';
import { CandidateService } from './candidate.service';
import { STAGED_PROMPT_VERSION } from './staged';

// B2: "save all" — counts, no duplicates on a second press, and all-or-nothing writes.
const deck = malissDeck();
const cards = malissCards();
const ctx: RunContext = { runId: 'run-bulk', deck, deckFingerprint: deckFingerprint(deck), cardDataVersion: 'test', provider: 'anthropic', model: 'mock', promptVersion: STAGED_PROMPT_VERSION, cards, now: '2026-10-18T00:00:00.000Z' };

function candidate(r: SampleRoute) {
  const parsed = parseAiOutput(JSON.stringify(sampleAnswer([r])));
  if (!parsed.ok) throw new Error(parsed.error);
  return toCandidate(parsed.output.routes[0], ctx);
}

async function setup() {
  TestBed.configureTestingModule({ providers: [{ provide: DB_NAME, useValue: `bulk-${crypto.randomUUID()}` }] });
  const db = await TestBed.inject(AppDb).db();
  for (const card of cards.values()) await db.put('cards', card);
  const run = {
    id: 'run-bulk',
    deckId: deck.id,
    deckName: deck.name,
    deckVersion: deck.version,
    deckFingerprint: ctx.deckFingerprint,
    scope: { single: true, multi: true, extenders: true, maxRoutes: 5, candidates: 6 },
    startedAt: '2026-10-18T00:00:00.000Z',
    status: 'succeeded',
    candidates: [candidate(routeMalissOnly()), candidate(routeAllied()), candidate(routeAllied()), candidate(routeFirewall()), candidate(routeAlliedTooFewMaterials())],
  } as unknown as AnalysisRun;
  await TestBed.inject(AiRunStore).saveRun(run);
  return { service: TestBed.inject(CandidateService), combos: TestBed.inject(ComboRepository), store: TestBed.inject(AiRunStore), run };
}

describe('save all candidates (B2)', () => {
  it('counts what it would save and what it skips, and each skip reason separately', async () => {
    const { service, run } = await setup();
    const plan = await service.planBulkSave(run, deck);
    expect(plan.toSave.length + plan.alreadySaved + plan.invalid + plan.sameEndBoard).toBe(run.candidates!.length);
    expect(plan.sameEndBoard).toBeGreaterThanOrEqual(1); // the second copy of the Allied route
    expect(plan.invalid).toBeGreaterThanOrEqual(1); // too few materials fails the data check
    expect(plan.toSave.length).toBeGreaterThanOrEqual(2);
    expect(plan.alreadySaved).toBe(0);
  });

  it('saves them as unverified Combos and marks the candidates; pressing again saves nothing more', async () => {
    const { service, combos, store, run } = await setup();
    const first = await service.saveAllCandidates(run, deck);
    expect(first.saved.length).toBe(first.plan.toSave.length);
    const stored = await combos.list();
    expect(stored).toHaveLength(first.saved.length);
    expect(stored.every((c) => c.verification.status !== 'verified')).toBe(true);
    expect(run.candidates!.filter((c) => c.savedComboId)).toHaveLength(first.saved.length);
    expect((await store.getRun(run.id))!.candidates!.filter((c) => c.savedComboId)).toHaveLength(first.saved.length);

    const again = await service.saveAllCandidates(run, deck);
    expect(again.saved).toEqual([]);
    expect(again.plan.alreadySaved).toBe(first.saved.length);
    expect(await combos.list()).toHaveLength(stored.length);
  });

  it('skips a candidate whose end board is already a saved Combo', async () => {
    const { service, combos, run } = await setup();
    await service.saveCandidate(run, 1); // the Allied route
    const plan = await service.planBulkSave(run, deck);
    expect(plan.alreadySaved).toBe(1);
    expect(plan.sameEndBoard).toBeGreaterThanOrEqual(1); // its copy at index 2
    const before = (await combos.list()).length;
    await service.saveAllCandidates(run, deck);
    expect((await combos.list()).length).toBe(before + plan.toSave.length);
  });

  it('a failure while writing leaves the Combos, the stored run and the in-memory run exactly as they were', async () => {
    const { service, combos, store, run } = await setup();
    const before = JSON.stringify(await store.getRun(run.id));
    let puts = 0;
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      if (++puts === 2) throw new Error('disk full');
      return original.apply(this, args);
    });
    await expect(service.saveAllCandidates(run, deck)).rejects.toThrow('disk full');
    vi.restoreAllMocks();
    expect(await combos.list()).toEqual([]);
    expect(JSON.stringify(await store.getRun(run.id))).toBe(before);
    expect(run.candidates!.some((c) => c.savedComboId)).toBe(false);
  });
});
