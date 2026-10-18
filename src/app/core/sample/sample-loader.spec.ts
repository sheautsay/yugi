import { TestBed } from '@angular/core/testing';
import { FETCH_FN, SLEEP_FN, toCardRecord } from '../card-api';
import { MALISS_DECK_API_CARDS } from '../../../testing/ai/maliss-deck-cards.sample';
import { ComboRepository } from '../combo-repository';
import { CurrentDeckService } from '../current-deck.service';
import { AppDb, DB_NAME } from '../db';
import { DeckRepository } from '../deck-repository';
import { SampleLoader } from './sample-loader';

async function setup(options: { seedCards: boolean }) {
  TestBed.configureTestingModule({
    providers: [
      { provide: DB_NAME, useValue: `sample-${crypto.randomUUID()}` },
      { provide: SLEEP_FN, useValue: async () => undefined },
      { provide: FETCH_FN, useValue: async () => Promise.reject(new TypeError('offline')) },
    ],
  });
  if (options.seedCards) {
    const db = await TestBed.inject(AppDb).db();
    for (const card of MALISS_DECK_API_CARDS) await db.put('cards', toCardRecord(card, '2026-10-18T00:00:00.000Z'));
  }
  return { loader: TestBed.inject(SampleLoader), decks: TestBed.inject(DeckRepository), combos: TestBed.inject(ComboRepository), current: TestBed.inject(CurrentDeckService) };
}

describe('SampleLoader (P1.3)', () => {
  it('adds the sample deck and its routes, all unverified, and makes the deck current', async () => {
    const { loader, decks, combos, current } = await setup({ seedCards: true });
    const result = await loader.load();
    expect(result.ok).toBe(true);
    expect(await decks.list()).toHaveLength(1);
    const routes = await combos.list();
    expect(routes).toHaveLength(3);
    expect(routes.every((r) => r.verification.status === 'unverified')).toBe(true);
    expect(current.deck()?.id).toBe('sample-maliss-deck');
  });

  it('loading twice does not duplicate the deck or the routes', async () => {
    const { loader, decks, combos } = await setup({ seedCards: true });
    await loader.load();
    await loader.load();
    expect(await decks.list()).toHaveLength(1);
    expect(await combos.list()).toHaveLength(3);
  });

  it('writes nothing when the cards cannot be obtained', async () => {
    const { loader, decks, combos } = await setup({ seedCards: false });
    const result = await loader.load();
    expect(result.ok).toBe(false);
    expect(await decks.list()).toHaveLength(0);
    expect(await combos.list()).toHaveLength(0);
  });
});
