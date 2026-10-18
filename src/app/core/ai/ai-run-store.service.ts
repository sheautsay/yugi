import { Injectable, inject } from '@angular/core';
import { AppDb } from '../db';
import type { AnalysisRun } from './analysis-types';

const RUN_PREFIX = 'aiRun:';

/** The `meta` key a run is stored under (also used by writes that must be atomic with other stores). */
export const runKey = (id: string) => RUN_PREFIX + id;

/** Analysis runs as recorded (G22-6): stored in the meta store, never in backups. */
@Injectable({ providedIn: 'root' })
export class AiRunStore {
  private readonly appDb = inject(AppDb);

  async listRuns(deckId?: string): Promise<AnalysisRun[]> {
    const db = await this.appDb.db();
    const entries = await db.getAll('meta', IDBKeyRange.bound(RUN_PREFIX, `${RUN_PREFIX}￿`));
    return entries
      .map((e) => e.value as AnalysisRun)
      .filter((r) => r && typeof r.id === 'string' && (!deckId || r.deckId === deckId))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getRun(id: string): Promise<AnalysisRun | undefined> {
    return (await (await this.appDb.db()).get('meta', runKey(id)))?.value as AnalysisRun | undefined;
  }

  async saveRun(run: AnalysisRun): Promise<void> {
    await (await this.appDb.db()).put('meta', { key: runKey(run.id), value: run });
  }

  async deleteRun(id: string): Promise<void> {
    await (await this.appDb.db()).delete('meta', runKey(id));
  }
}
