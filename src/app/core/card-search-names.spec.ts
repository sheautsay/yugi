import { TestBed } from '@angular/core/testing';
import { CardNameEntry } from './card-names';
import { CardNamesService } from './card-names.service';
import { CARD_NAMES_DB } from './card-names.store';
import { CardQuery, EMPTY_QUERY, searchCards } from './card-search';
import { DB_NAME } from './db';
import { CardRecord } from './models';

// rev9 G56, G57 — one card, many names, one result. Names are TEST FIXTURES ("測試用…").

const card = (cardId: number, nameEn: string, extra: Partial<CardRecord> = {}): CardRecord => ({ cardId, nameEn, kind: 'monster', source: 'test', updatedAt: '2026-10-09T00:00:00.000Z', ...extra });
const DORMOUSE = card(32061192, 'Maliss <P> Dormouse');
const RABBIT = card(69272449, 'Maliss <P> White Rabbit');
const CARDS: CardRecord[] = [DORMOUSE, RABBIT];

const q = (text: string): CardQuery => ({ ...EMPTY_QUERY, text, pool: 'all' });
const ids = (cards: readonly CardRecord[]) => cards.map((c) => c.cardId);

const entry: CardNameEntry = {
  cardId: 32061192,
  nameZhTw: '測試用睡鼠',
  nameZhCn: '测试用睡鼠',
  aliases: ['測試俗稱'],
  translationSource: 'test-fixture',
  translationStatus: 'community',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

/** A fresh service on its own empty databases, so no test sees another test's table. */
function freshService(): CardNamesService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: DB_NAME, useValue: `app-${crypto.randomUUID()}` },
      { provide: CARD_NAMES_DB, useValue: `names-${crypto.randomUUID()}` },
    ],
  });
  return TestBed.inject(CardNamesService);
}

describe('search finds one card by every name form (G56, G57)', () => {
  it('Traditional, Simplified, English, alias and the ID each return the same single card', () => {
    const extraFor = (c: CardRecord) => (c.cardId === 32061192 ? { names: ['測試用睡鼠', '测试用睡鼠'], aliases: ['測試俗稱'] } : undefined);
    for (const text of ['測試用睡鼠', '测试用睡鼠', 'maliss <p> dormouse', '測試俗稱', '32061192']) {
      expect(ids(searchCards(CARDS, q(text), extraFor)), text).toEqual([32061192]);
    }
  });

  it('a Simplified-only name is found, but is never displayed as the Traditional name (N51)', () => {
    const service = freshService();
    service.entries.set(new Map([[32061192, { ...entry, nameZhTw: undefined }]]));
    expect(ids(service.search(CARDS, q('测试用睡鼠')))).toEqual([32061192]);
    expect(service.labelOf(32061192, DORMOUSE)).toBe('Maliss <P> Dormouse');
  });

  it('the service search uses the translation table; one card appears once however many of its names match', () => {
    const service = freshService();
    service.entries.set(new Map([[32061192, entry]]));
    expect(ids(service.search(CARDS, q('測試'))).length).toBe(1);
    expect(ids(service.search(CARDS, q('測試用睡鼠')))).toEqual([32061192]);
    expect(ids(service.search(CARDS, q('dormouse')))).toEqual([32061192]);
  });
});
