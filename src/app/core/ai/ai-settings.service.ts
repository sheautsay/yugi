import { Injectable, inject, signal } from '@angular/core';
import { AppDb } from '../db';
import { localDate } from '../time';
import { AiSettings, DEFAULT_AI_SETTINGS, normalizeSettings } from './ai-settings';
import { OllamaCheck, checkOllama } from './ollama-check';
import { AI_FETCH, AI_PROVIDERS } from './providers';

export interface UsageDay {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

const SETTINGS_KEY = 'aiSettings';
const USAGE_KEY = 'aiUsage';
/** Per-tab only: never IndexedDB, backups, exports or source code (G27-2). */
export const API_KEY_STORAGE = 'ygo-combo-assistant.claude-api-key';

/** The daily request count follows the local calendar day. */
const today = () => localDate();

function readKey(): string {
  try {
    return sessionStorage.getItem(API_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

/** The user's AI settings, the per-tab API key, the daily usage counter and the Ollama check. */
@Injectable({ providedIn: 'root' })
export class AiSettingsService {
  private readonly appDb = inject(AppDb);
  private readonly fetchFn = inject(AI_FETCH);

  /** The model services this build offers (the Windows app: ChatGPT only). */
  readonly providers = inject(AI_PROVIDERS);
  readonly settings = signal<AiSettings>(this.restrict(DEFAULT_AI_SETTINGS));
  readonly apiKey = signal(readKey());
  /** CR-010: the last explicit "check Ollama" result (null until the user asks). The pre-flight never uses it. */
  readonly ollamaCheck = signal<OllamaCheck | null>(null);
  readonly ollamaChecking = signal(false);
  readonly ready: Promise<void> = this.loadSettings();

  async updateSettings(patch: Partial<AiSettings>): Promise<void> {
    const next = this.restrict(normalizeSettings({ ...this.settings(), ...patch }));
    this.settings.set(next);
    await (await this.appDb.db()).put('meta', { key: SETTINGS_KEY, value: next });
  }

  /** User-started: is the Ollama service up and is the chosen model installed? */
  async checkOllama(): Promise<OllamaCheck> {
    this.ollamaChecking.set(true);
    try {
      const { ollamaBaseUrl, ollamaModel } = this.settings();
      const result = await checkOllama({ baseUrl: ollamaBaseUrl, model: ollamaModel }, this.fetchFn);
      this.ollamaCheck.set(result);
      return result;
    } finally {
      this.ollamaChecking.set(false);
    }
  }

  setApiKey(key: string): void {
    this.apiKey.set(key);
    try {
      if (key) sessionStorage.setItem(API_KEY_STORAGE, key);
      else sessionStorage.removeItem(API_KEY_STORAGE);
    } catch {
      // storage unavailable: the key stays in memory for this page only
    }
  }

  async usageToday(): Promise<UsageDay> {
    const entry = await (await this.appDb.db()).get('meta', USAGE_KEY);
    const usage = entry?.value as UsageDay | undefined;
    return usage?.date === today() ? usage : { date: today(), requests: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
  }

  async addUsage(patch: Partial<Omit<UsageDay, 'date'>>): Promise<void> {
    const u = await this.usageToday();
    const next: UsageDay = {
      date: u.date,
      requests: u.requests + (patch.requests ?? 0),
      inputTokens: u.inputTokens + (patch.inputTokens ?? 0),
      outputTokens: u.outputTokens + (patch.outputTokens ?? 0),
      estimatedCostUsd: u.estimatedCostUsd + (patch.estimatedCostUsd ?? 0),
    };
    await (await this.appDb.db()).put('meta', { key: USAGE_KEY, value: next });
  }

  /** A provider this build does not offer is replaced by the first one it does (that is also the default). */
  private restrict(settings: AiSettings): AiSettings {
    return this.providers.includes(settings.provider) ? settings : { ...settings, provider: this.providers[0] };
  }

  private async loadSettings(): Promise<void> {
    try {
      const entry = await (await this.appDb.db()).get('meta', SETTINGS_KEY);
      if (entry) this.settings.set(this.restrict(normalizeSettings(entry.value as Partial<AiSettings>)));
    } catch {
      // keep defaults
    }
  }
}
