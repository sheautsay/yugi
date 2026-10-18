import { Injectable, inject } from '@angular/core';
import { CardDataService } from '../card-data.service';
import { validateCombo } from '../combo';
import { ComboRepository } from '../combo-repository';
import { deckFingerprint } from '../deck';
import { ComboRoute, DeckRecord } from '../models';
import { AiRunStore } from './ai-run-store.service';
import { Candidate, withCheck } from './analysis-output';
import type { AnalysisRun } from './analysis-types';

/** What the user does with the candidate routes of a run: save as a Combo, re-check, delete. */
@Injectable({ providedIn: 'root' })
export class CandidateService {
  private readonly cardData = inject(CardDataService);
  private readonly combos = inject(ComboRepository);
  private readonly runs = inject(AiRunStore);

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
}
