import { Injectable, inject } from '@angular/core';
import { AppDb } from './db';
import { HandLayoutPreset } from './models';

/** Saved hand-box layouts (relative coordinates only — never screenshot content). */
@Injectable({ providedIn: 'root' })
export class LayoutRepository {
  private readonly appDb = inject(AppDb);

  async list(): Promise<HandLayoutPreset[]> {
    return (await (await this.appDb.db()).getAll('layouts')).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  }

  async save(preset: HandLayoutPreset): Promise<void> {
    await (await this.appDb.db()).put('layouts', preset);
  }

  async delete(id: string): Promise<void> {
    await (await this.appDb.db()).delete('layouts', id);
  }
}
