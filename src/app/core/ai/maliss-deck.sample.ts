/**
 * TEST DATA ONLY (CR-006). The user's real Maliss deck — built from their own Neuron paste
 * ({@link EDGE_SAMPLE}, 40 main + 15 extra) and the real card data in {@link MALISS_DECK_API_CARDS}.
 * Hand-written routes for it are in `maliss-routes.sample.ts`. Excluded from the app build (`*.sample.ts`).
 */
import { toCardRecord } from '../card-api';
import { CardRecord, DeckRecord } from '../models';
import { parseNeuronDeckText, resolveNeuronDeck } from '../neuron-deck';
import { EDGE_SAMPLE } from '../neuron-deck.sample';
import { MALISS_DECK_API_CARDS } from './maliss-deck-cards.sample';

export function malissCards(): Map<number, CardRecord> {
  return new Map(MALISS_DECK_API_CARDS.map((c) => [c.id, { ...toCardRecord(c, '2026-10-09T00:00:00.000Z'), source: 'test' }] as const));
}

/** The deck exactly as the user's Neuron paste resolves (G21 path), as a stored deck record. */
export function malissDeck(): DeckRecord {
  const parsed = parseNeuronDeckText(EDGE_SAMPLE);
  if (!parsed.ok) throw new Error('sample does not parse');
  const { deck, unknownNames } = resolveNeuronDeck(parsed.sections, [...malissCards().values()]);
  if (unknownNames.length) throw new Error(`unknown names: ${unknownNames.join(', ')}`);
  return { schemaVersion: 1, id: 'maliss-deck', name: '瑪麗絲', format: 'master-duel', version: 1, ...deck, createdAt: '2026-10-09T00:00:00.000Z', updatedAt: '2026-10-09T00:00:00.000Z' };
}

