import { Injectable, inject, signal } from '@angular/core';
import { CARD_LANGUAGES, CardLanguage, DEFAULT_CARD_LANGUAGE } from './card-names';
import { AppDb } from './db';
import { CardPool } from './models';

export interface AppSettings {
  cardPool: CardPool;
  /** Download a card's thumbnail when it appears on screen (CR-002). */
  autoThumbnails: boolean;
  /** How card names are shown: Traditional Chinese (default), English or both (CR-009, G66). */
  cardLanguage: CardLanguage;
}

const DEFAULTS: AppSettings = { cardPool: 'master-duel', autoThumbnails: true, cardLanguage: DEFAULT_CARD_LANGUAGE };
const KEY = 'settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly appDb = inject(AppDb);

  readonly settings = signal<AppSettings>(DEFAULTS);
  /** Resolves once stored settings are loaded (defaults stay in place if storage is unavailable). */
  readonly ready: Promise<void> = this.load();

  async update(patch: Partial<AppSettings>): Promise<void> {
    const next = { ...this.settings(), ...patch };
    this.settings.set(next);
    await (await this.appDb.db()).put('meta', { key: KEY, value: next });
  }

  private async load(): Promise<void> {
    try {
      const entry = await (await this.appDb.db()).get('meta', KEY);
      if (entry) {
        const stored = entry.value as Partial<AppSettings>;
        const cardLanguage = CARD_LANGUAGES.includes(stored.cardLanguage as CardLanguage) ? stored.cardLanguage : DEFAULT_CARD_LANGUAGE;
        this.settings.set({ ...DEFAULTS, ...stored, cardLanguage: cardLanguage as CardLanguage });
      }
    } catch {
      // keep defaults
    }
  }
}
