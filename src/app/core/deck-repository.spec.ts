import { TestBed } from '@angular/core/testing';
import { DB_NAME, openAppDb } from './db';
import { newDeck } from './deck';
import { DeckRepository } from './deck-repository';

function setup(dbName = `test-${crypto.randomUUID()}`) {
  TestBed.configureTestingModule({ providers: [{ provide: DB_NAME, useValue: dbName }] });
  return { repo: TestBed.inject(DeckRepository), dbName };
}

describe('IndexedDB schema', () => {
  it('creates every object store on a fresh install', async () => {
    const db = await openAppDb(`schema-${crypto.randomUUID()}`);
    expect([...db.objectStoreNames].sort()).toEqual(['cards', 'combos', 'decks', 'images', 'layouts', 'meta']);
    db.close();
  });
});

describe('DeckRepository', () => {
  it('creates, reads, updates and deletes a deck', async () => {
    const { repo } = setup();
    const deck = newDeck('我的碼莉絲', '2026-10-08T00:00:00.000Z', 'deck-1');
    await repo.save(deck);
    expect(await repo.get('deck-1')).toEqual(deck);

    await repo.save({ ...deck, name: '改名', main: [{ cardId: 1, count: 3 }] });
    expect((await repo.get('deck-1'))?.name).toBe('改名');
    expect((await repo.get('deck-1'))?.main).toEqual([{ cardId: 1, count: 3 }]);

    await repo.delete('deck-1');
    expect(await repo.get('deck-1')).toBeUndefined();
    expect(await repo.list()).toEqual([]);
  });

  it('lists decks newest first', async () => {
    const { repo } = setup();
    await repo.save(newDeck('舊', '2026-01-01T00:00:00.000Z', 'a'));
    await repo.save(newDeck('新', '2026-02-01T00:00:00.000Z', 'b'));
    expect((await repo.list()).map((d) => d.name)).toEqual(['新', '舊']);
  });

  it('keeps data after the database connection is closed and reopened', async () => {
    const dbName = `persist-${crypto.randomUUID()}`;
    const first = await openAppDb(dbName);
    await first.put('decks', newDeck('保留', '2026-10-08T00:00:00.000Z', 'keep'));
    first.close();

    const reopened = await openAppDb(dbName);
    expect((await reopened.get('decks', 'keep'))?.name).toBe('保留');
    reopened.close();
  });
});
