import { Injectable, computed, inject, signal } from '@angular/core';
import { CardLanguage, CardNameEntry, CoverageStats, STATUS_LABEL, ZhTwName, coverage, labelFor, parseNameImport, searchNames, zhTwName } from './card-names';
import { CardNameStore } from './card-names.store';
import { CardQuery, searchCards } from './card-search';
import { CardRecord } from './models';
import { SettingsService } from './settings.service';

export type ImportOutcome =
  | { status: 'applied'; applied: number; kept: number; unknownIds: number[] }
  | { status: 'rejected'; errors: string[] }
  | { status: 'failed'; error: string };

/**
 * The one place that turns a card into the text a screen shows (CR-009). Components call `labelOf` and
 * `search`; none of them builds a translation or a fallback itself. Reads are signals, so every view that
 * calls these re-renders when the language or the translation table changes.
 */
@Injectable({ providedIn: 'root' })
export class CardNamesService {
  private readonly store = inject(CardNameStore);
  private readonly settings = inject(SettingsService);

  /** The imported translation table keyed by card ID (the user's own corrections live on the card). */
  readonly entries = signal<ReadonlyMap<number, CardNameEntry>>(new Map());
  readonly language = computed<CardLanguage>(() => this.settings.settings().cardLanguage);
  /** Resolves once the stored table is read (empty until then; English names show meanwhile). */
  readonly ready: Promise<void> = this.reload();

  async reload(): Promise<void> {
    try {
      this.entries.set(await this.store.all());
    } catch {
      // keep what is shown
    }
  }

  /** The text for one card in the current language. Unknown cards are "待確認", never guessed. */
  labelOf(cardId: number, card: CardRecord | undefined): string {
    return labelFor(cardId, card, this.entries().get(cardId), this.language());
  }

  /** `labelOf` bound for callbacks such as checkDeck, checkHand and checkRoute. */
  readonly nameLabel = (cardId: number, card: CardRecord | undefined): string => this.labelOf(cardId, card);

  /** The Traditional Chinese name and where it came from, or null (the detail view shows the status). */
  zhOf(card: CardRecord | undefined): ZhTwName | null {
    return card ? zhTwName(card, this.entries().get(card.cardId)) : null;
  }

  /** Short status for the detail view: 使用者修正／正式名稱／社群通用名稱／暫定（簡體轉換）／無（顯示英文）。 */
  statusOf(card: CardRecord): string {
    const zh = this.zhOf(card);
    return zh ? STATUS_LABEL[zh.status] : '無（顯示英文）';
  }

  /** Local search over the card database that also knows the translations and aliases (G56, G57). */
  search(cards: readonly CardRecord[], query: CardQuery): CardRecord[] {
    const entries = this.entries();
    return searchCards(cards, query, (card) => searchNames(card, entries.get(card.cardId)));
  }

  coverageOf(cards: readonly CardRecord[]): CoverageStats {
    return coverage(cards, this.entries());
  }

  async setLanguage(language: CardLanguage): Promise<void> {
    await this.settings.update({ cardLanguage: language });
  }

  /**
   * Explicit user action (G68, G63): the whole file is validated first; a bad file changes nothing. The write is
   * one transaction, so a failure keeps the previous table exactly as it was. `knownCardIds` only reports IDs that
   * are not in the local card database; they are still stored (they show once the card is synced).
   */
  async importText(text: string, knownCardIds: ReadonlySet<number>): Promise<ImportOutcome> {
    const parsed = parseNameImport(text);
    if (!parsed.ok) return { status: 'rejected', errors: parsed.errors };
    const now = new Date().toISOString();
    const entries = parsed.entries.map((e) => ({ ...e, updatedAt: e.updatedAt ?? now }));
    try {
      const outcome = await this.store.write(entries, { importedAt: now, count: entries.length });
      await this.reload();
      return { status: 'applied', ...outcome, unknownIds: entries.filter((e) => !knownCardIds.has(e.cardId)).map((e) => e.cardId) };
    } catch (error) {
      return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
    }
  }

  lastImport(): Promise<{ importedAt: string; count: number } | null> {
    return this.store.lastImport();
  }
}
