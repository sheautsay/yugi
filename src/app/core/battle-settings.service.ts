import { Injectable, inject, signal } from '@angular/core';
import { AppDb } from './db';
import { HandSize } from './models';

const KEY = 'battleSettings';
export const BATTLE_TOP_N = [3, 4, 5] as const;
export type BattleTopN = (typeof BATTLE_TOP_N)[number];

/** B4: the default system-wide capture shortcut (Tauri accelerator syntax). */
export const DEFAULT_CAPTURE_SHORTCUT = 'Ctrl+Shift+Space';

/** B4: the saved hand layout (a `layouts` entry) used for the Master Duel window, per hand size. */
export type GameLayouts = Partial<Record<HandSize, string>>;

/** A shortcut needs at least one modifier and one other key, e.g. `Ctrl+Shift+Space`. */
export function isValidShortcut(value: string): boolean {
  const parts = value.split('+').map((p) => p.trim());
  if (parts.length < 2 || parts.some((p) => !p)) return false;
  const modifiers = new Set(['ctrl', 'control', 'shift', 'alt', 'option', 'super', 'cmd', 'command', 'commandorcontrol', 'cmdorctrl']);
  const keys = parts.filter((p) => !modifiers.has(p.toLowerCase()));
  return keys.length === 1 && keys.length < parts.length;
}

/**
 * B3: whether the battle mode is switched on, and how many routes it lists. The mode is OFF until the user turns it on in
 * 設定 (the screenshot-based parts of it depend on the game's terms, which the user has to weigh themselves).
 * B4: the capture shortcut and the hand layouts used for the game window.
 * Stored on this device only (meta store); not part of backups.
 */
@Injectable({ providedIn: 'root' })
export class BattleSettingsService {
  private readonly appDb = inject(AppDb);

  readonly enabled = signal(false);
  readonly topN = signal<BattleTopN>(5);
  readonly shortcut = signal(DEFAULT_CAPTURE_SHORTCUT);
  readonly gameLayouts = signal<GameLayouts>({});
  readonly ready: Promise<void> = this.load();

  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled.set(enabled);
    await this.save();
  }

  async setTopN(topN: number): Promise<void> {
    this.topN.set(BATTLE_TOP_N.includes(topN as BattleTopN) ? (topN as BattleTopN) : 5);
    await this.save();
  }

  /** Returns false (and keeps the old one) when the text is not a usable shortcut. */
  async setShortcut(value: string): Promise<boolean> {
    const shortcut = value.trim();
    if (!isValidShortcut(shortcut)) return false;
    this.shortcut.set(shortcut);
    await this.save();
    return true;
  }

  async setGameLayout(handSize: HandSize, layoutId: string | null): Promise<void> {
    this.gameLayouts.update((current) => {
      const next = { ...current };
      if (layoutId) next[handSize] = layoutId;
      else delete next[handSize];
      return next;
    });
    await this.save();
  }

  private async save(): Promise<void> {
    await (await this.appDb.db()).put('meta', {
      key: KEY,
      value: { enabled: this.enabled(), topN: this.topN(), shortcut: this.shortcut(), gameLayouts: this.gameLayouts() },
    });
  }

  /** Re-reads the stored values (another window may have changed them). */
  async reload(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const entry = await (await this.appDb.db()).get('meta', KEY);
      const value = entry?.value as { enabled?: unknown; topN?: unknown; shortcut?: unknown; gameLayouts?: unknown } | undefined;
      this.enabled.set(value?.enabled === true);
      if (BATTLE_TOP_N.includes(value?.topN as BattleTopN)) this.topN.set(value!.topN as BattleTopN);
      if (typeof value?.shortcut === 'string' && isValidShortcut(value.shortcut)) this.shortcut.set(value.shortcut);
      const layouts = value?.gameLayouts as Record<string, unknown> | undefined;
      const next: GameLayouts = {};
      for (const size of [5, 6] as const) if (typeof layouts?.[size] === 'string') next[size] = layouts[size] as string;
      this.gameLayouts.set(next);
    } catch {
      // keep the defaults (off, 5, default shortcut, no layouts)
    }
  }
}
