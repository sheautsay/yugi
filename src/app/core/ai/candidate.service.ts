import { Injectable, inject } from '@angular/core';
import { CardDataService } from '../card-data.service';
import { validateCombo } from '../combo';
import { ComboRepository } from '../combo-repository';
import { deckFingerprint } from '../deck';
import { ComboRoute, DeckRecord } from '../models';
import { AppDb } from '../db';
import { AiRunStore, runKey } from './ai-run-store.service';
import { Candidate, withCheck } from './analysis-output';
import type { AnalysisRun } from './analysis-types';
import { analyzeCandidates, evaluateRoute } from './evaluate';

/** B2: what "save all as Combos" would do, in numbers (the candidates that are not saved are listed by index). */
export interface BulkSavePlan {
  /** Candidate indexes that would be saved, best first. */
  toSave: number[];
  /** Already saved as a Combo that still exists. */
  alreadySaved: number;
  /** Failed the local data check (or cannot be stored as a Combo). */
  invalid: number;
  /** Same end board as a better candidate of this run, or as a Combo that is already saved. */
  sameEndBoard: number;
}

/** What the user does with the candidate routes of a run: save as a Combo, re-check, delete. */
@Injectable({ providedIn: 'root' })
export class CandidateService {
  private readonly cardData = inject(CardDataService);
  private readonly combos = inject(ComboRepository);
  private readonly runs = inject(AiRunStore);
  private readonly appDb = inject(AppDb);

  /** Saves a candidate as an ordinary Combo (draft or unverified — never verified). */
  async saveCandidate(run: AnalysisRun, index: number): Promise<ComboRoute> {
    const candidate = run.candidates?.[index];
    if (!candidate) throw new Error('找不到此候選路線');
    if (candidate.savedComboId) {
      const existing = await this.combos.get(candidate.savedComboId);
      if (existing) return existing;
    }
    const result = validateCombo(candidate.route);
    if (!result.ok) throw new Error(`無法存成 Combo：${result.errors.join('；')}`);
    const now = new Date().toISOString();
    const route: ComboRoute = { ...result.route!, id: crypto.randomUUID(), version: 1, createdAt: now, updatedAt: now };
    await this.combos.save(route);
    candidate.savedComboId = route.id;
    await this.runs.saveRun(run);
    return route;
  }

  /** Re-runs the data check of a candidate against the deck as it is now (G25-4). */
  async recheckCandidate(run: AnalysisRun, index: number, deck: DeckRecord): Promise<Candidate> {
    const candidate = run.candidates?.[index];
    if (!candidate) throw new Error('找不到此候選路線');
    const cards = await this.cardData.getMany([...deck.main, ...deck.extra].map((r) => r.cardId));
    const next = { ...withCheck(candidate.route, deck, cards, new Date().toISOString(), deckFingerprint(deck)), ...(candidate.savedComboId ? { savedComboId: candidate.savedComboId } : {}) };
    run.candidates![index] = next;
    await this.runs.saveRun(run);
    return next;
  }

  async deleteCandidate(run: AnalysisRun, index: number): Promise<void> {
    run.candidates = (run.candidates ?? []).filter((_, i) => i !== index);
    await this.runs.saveRun(run);
  }

  /** Re-checks a saved AI Combo against `deck` and stores the new check record (status unchanged). */
  async recheckCombo(route: ComboRoute, deck: DeckRecord): Promise<ComboRoute> {
    if (!route.analysis) throw new Error('這不是 AI 產生的路線');
    const cards = await this.cardData.getMany([...deck.main, ...deck.extra].map((r) => r.cardId));
    const checked = withCheck(route, deck, cards, new Date().toISOString(), deckFingerprint(deck)).route;
    const next: ComboRoute = { ...route, analysis: checked.analysis, version: route.version + 1, updatedAt: new Date().toISOString() };
    const result = validateCombo(next);
    if (!result.ok) throw new Error(result.errors.join('；'));
    await this.combos.save(next);
    return next;
  }

  /**
   * B2: which candidates "save all" would store. Skipped, each counted separately: already saved (and the Combo still
   * exists), failed the data check, and the same end board as a better candidate or as a saved Combo. Pure reading.
   */
  async planBulkSave(run: AnalysisRun, deck: DeckRecord): Promise<BulkSavePlan> {
    const cards = await this.cardData.getMany([...deck.main, ...deck.extra].map((r) => r.cardId));
    const existing = await this.combos.list();
    const existingIds = new Set(existing.map((c) => c.id));
    const savedSignatures = new Set(
      existing
        .map((c) => evaluateRoute(c, deck, cards))
        .filter((e) => e.valid && e.signature)
        .map((e) => e.signature),
    );
    const { ranked } = analyzeCandidates(run, deck, cards, run.goal, undefined, { fold: true });
    const plan: BulkSavePlan = { toSave: [], alreadySaved: 0, invalid: 0, sameEndBoard: 0 };
    const taken = new Set<string>();
    for (const r of ranked) {
      const candidate = run.candidates![r.index];
      if (candidate.savedComboId && existingIds.has(candidate.savedComboId)) plan.alreadySaved++;
      else if (!r.evaluation.valid || candidate.schemaErrors.length || !r.evaluation.signature) plan.invalid++;
      else if (r.sameEndBoardAs !== undefined || savedSignatures.has(r.evaluation.signature) || taken.has(r.evaluation.signature)) plan.sameEndBoard++;
      else {
        taken.add(r.evaluation.signature);
        plan.toSave.push(r.index);
      }
    }
    return plan;
  }

  /**
   * B2: saves every candidate in {@link planBulkSave} as an ordinary Combo. The Combos and the run's "saved" marks are
   * written in ONE IndexedDB transaction, so a failure writes nothing, and pressing again never makes duplicates
   * (the marked candidates are skipped).
   */
  async saveAllCandidates(run: AnalysisRun, deck: DeckRecord): Promise<{ saved: ComboRoute[]; plan: BulkSavePlan }> {
    const plan = await this.planBulkSave(run, deck);
    const now = new Date().toISOString();
    const saved: ComboRoute[] = [];
    const next: AnalysisRun = structuredClone(run);
    for (const index of plan.toSave) {
      const result = validateCombo(run.candidates![index].route);
      if (!result.ok) throw new Error(`無法存成 Combo：${result.errors.join('；')}`);
      const route: ComboRoute = { ...result.route!, id: crypto.randomUUID(), version: 1, createdAt: now, updatedAt: now };
      next.candidates![index].savedComboId = route.id;
      saved.push(route);
    }
    if (!saved.length) return { saved, plan };
    const db = await this.appDb.db();
    const tx = db.transaction(['combos', 'meta'], 'readwrite');
    const done = tx.done;
    try {
      for (const route of saved) await tx.objectStore('combos').put(route);
      await tx.objectStore('meta').put({ key: runKey(next.id), value: next });
      await done;
    } catch (error) {
      try {
        tx.abort(); // nothing of this batch stays written
      } catch {
        // already aborted by the failing request
      }
      await done.catch(() => undefined);
      throw error;
    }
    run.candidates = next.candidates;
    return { saved, plan };
  }
}
