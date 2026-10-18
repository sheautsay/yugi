import { Injectable, inject } from '@angular/core';
import { CardDataService } from '../../core/card-data.service';
import { ComboRepository } from '../../core/combo-repository';
import { prepareComboImport } from '../../core/combo';
import { CurrentDeckService } from '../../core/current-deck.service';
import { checkDeck, deckCardIds, newDeck } from '../../core/deck';
import { parseDeckText } from '../../core/deck-import';
import { DeckRepository } from '../../core/deck-repository';
import { DeckRecord } from '../../core/models';

export type SampleResult = { ok: true; message: string } | { ok: false; message: string };

const SAMPLE_DECK_ID = 'sample-maliss-deck';

/**
 * Loads the bundled Maliss sample (one deck and a few hand-written routes). It uses the same checks as a
 * normal import: the deck must parse, its cards must exist locally, and the routes go through the Combo
 * import validation, so they always arrive as "unverified". Loading twice never duplicates anything.
 */
@Injectable({ providedIn: 'root' })
export class SampleLoader {
  private readonly cardData = inject(CardDataService);
  private readonly decks = inject(DeckRepository);
  private readonly combos = inject(ComboRepository);
  private readonly current = inject(CurrentDeckService);

  async load(): Promise<SampleResult> {
    const sample = await import('./maliss-sample.data');
    const parsed = parseDeckText(sample.SAMPLE_DECK_YDKE);
    if (!parsed.result.ok) return { ok: false, message: '範例牌組資料無法讀取。' };
    const parsedDeck = parsed.result.deck;

    // Explicit user action: fetches only the sample's own cards when they are not stored yet.
    const download = await this.cardData.downloadMissing(deckCardIds(parsedDeck));
    if (download.error) return { ok: false, message: download.error };
    const cards = await this.cardData.getMany(deckCardIds(parsedDeck));

    const existingDeck = await this.decks.get(SAMPLE_DECK_ID);
    let deck: DeckRecord | undefined = existingDeck;
    if (!deck) {
      deck = { ...newDeck(sample.SAMPLE_DECK_NAME, new Date().toISOString(), SAMPLE_DECK_ID), main: parsedDeck.main, extra: parsedDeck.extra, side: parsedDeck.side, source: { type: 'ydke' } };
      await this.decks.save(deck);
    }

    const existingIds = new Set((await this.combos.list()).map((c) => c.id));
    const known = await this.cardData.getMany(deckCardIds(parsedDeck));
    const prepared = prepareComboImport(sample.SAMPLE_COMBOS_JSON, { knownCardIds: new Set(known.keys()), existingIds });
    if (!prepared.ok) return { ok: false, message: `範例 Combo 檢查未通過：${prepared.errors[0]}` };
    const fresh = prepared.items.filter((i) => !i.conflict).map((i) => i.route);
    if (fresh.length) await this.combos.saveAll(fresh);

    await this.current.use(deck.id);
    this.cardData.version.update((v) => v + 1);
    const queryable = checkDeck(deck, cards).queryable;
    return {
      ok: true,
      message: `已載入範例牌組與 ${fresh.length} 條範例 Combo（皆為「未驗證」，僅供認識功能）。${queryable ? '' : '範例牌組尚未通過牌表檢核。'}`,
    };
  }
}
