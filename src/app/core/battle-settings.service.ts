import { Injectable, inject, signal } from '@angular/core';
import { AppDb } from './db';

const KEY = 'battleSettings';
export const BATTLE_TOP_N = [3, 4, 5] as const;
export type BattleTopN = (typeof BATTLE_TOP_N)[number];

/**
 * B3: whether the battle mode is switched on, and how many routes it lists. The mode is OFF until the user turns it on in
 * 設定 (the screenshot-based parts of it depend on the game's terms, which the user has to weigh themselves).
 * Stored on this device only (meta store); not part of backups.
 */
@Injectable({ providedIn: 'root' })
export class BattleSettingsService {
  private readonly appDb = inject(AppDb);

  readonly enabled = signal(false);
  readonly topN = signal<BattleTopN>(5);
  readonly ready: Promise<void> = this.load();

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled.set(enabled);
    await this.save();
  }

  async setTopN(topN: number): Promise<void> {
    this.topN.set(BATTLE_TOP_N.includes(topN as BattleTopN) ? (topN as BattleTopN) : 5);
    await this.save();
  }

  private async save(): Promise<void> {
    await (await this.appDb.db()).put('meta', { key: KEY, value: { enabled: this.enabled(), topN: this.topN() } });
  }

  private async load(): Promise<void> {
    try {
      const entry = await (await this.appDb.db()).get('meta', KEY);
      const value = entry?.value as { enabled?: unknown; topN?: unknown } | undefined;
      if (value?.enabled === true) this.enabled.set(true);
      if (BATTLE_TOP_N.includes(value?.topN as BattleTopN)) this.topN.set(value!.topN as BattleTopN);
    } catch {
      // keep the defaults (off, 5)
    }
  }
}
