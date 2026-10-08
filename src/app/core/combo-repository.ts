import { Injectable, inject } from '@angular/core';
import { AppDb } from './db';
import { ComboRoute } from './models';

@Injectable({ providedIn: 'root' })
export class ComboRepository {
  private readonly appDb = inject(AppDb);

  async list(): Promise<ComboRoute[]> {
    const combos = await (await this.appDb.db()).getAll('combos');
    return combos.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  }

  async get(id: string): Promise<ComboRoute | undefined> {
    return (await this.appDb.db()).get('combos', id);
  }

  async save(route: ComboRoute): Promise<void> {
    await (await this.appDb.db()).put('combos', route);
  }

  /** All-or-nothing write of several routes (one IndexedDB transaction). */
  async saveAll(routes: readonly ComboRoute[]): Promise<void> {
    const tx = (await this.appDb.db()).transaction('combos', 'readwrite');
    await Promise.all([...routes.map((r) => tx.store.put(r)), tx.done]);
  }

  async delete(id: string): Promise<void> {
    await (await this.appDb.db()).delete('combos', id);
  }
}
