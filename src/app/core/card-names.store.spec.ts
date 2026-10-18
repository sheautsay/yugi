import { TestBed } from '@angular/core/testing';
import { CardNameEntry } from './card-names';
import { CARD_NAMES_DB, CardNameStore } from './card-names.store';

// rev9 G63, G64, N48, N50 — the translation table's own IndexedDB database. Names below are test fixtures ("測試用").

const entry = (cardId: number, translationStatus: CardNameEntry['translationStatus'], nameZhTw = `測試用${cardId}`): CardNameEntry => ({
  cardId,
  nameZhTw,
  aliases: [],
  translationSource: 'test-fixture',
  translationStatus,
  updatedAt: '2026-10-09T00:00:00.000Z',
});
const NOTE = { importedAt: '2026-10-09T00:00:00.000Z', count: 1 };

function setup(name: string): CardNameStore {
  TestBed.configureTestingModule({ providers: [{ provide: CARD_NAMES_DB, useValue: name }] });
  return TestBed.inject(CardNameStore);
}

describe('CardNameStore — atomic and ranked writes (G63, G64, N48, N50)', () => {
  it('starts empty and stores what it is given', async () => {
    const store = setup(`names-${crypto.randomUUID()}`);
    expect((await store.all()).size).toBe(0);
    expect(await store.lastImport()).toBeNull();
    await store.write([entry(1, 'community'), entry(2, 'official')], NOTE);
    expect([...(await store.all()).keys()].sort()).toEqual([1, 2]);
    expect(await store.lastImport()).toEqual(NOTE);
  });

  it('N50: a provisional entry does not replace an official one; an official one replaces a provisional one', async () => {
    const store = setup(`names-${crypto.randomUUID()}`);
    await store.write([entry(1, 'official', '正式')], NOTE);
    expect(await store.write([entry(1, 'provisional', '暫定')], NOTE)).toEqual({ applied: 0, kept: 1 });
    expect((await store.all()).get(1)?.nameZhTw).toBe('正式');
    await store.write([entry(2, 'provisional', '暫定')], NOTE);
    expect(await store.write([entry(2, 'official', '正式二')], NOTE)).toEqual({ applied: 1, kept: 0 });
    expect((await store.all()).get(2)?.nameZhTw).toBe('正式二');
  });

  it('N48: when a write fails half-way, every change of that write is rolled back and the note is unchanged', async () => {
    const store = setup(`names-${crypto.randomUUID()}`);
    await store.write([entry(1, 'official', '原本的正式名稱')], NOTE);
    // A value that cannot be stored (a function) makes put() throw after the first entry was already written.
    const broken = { ...entry(3, 'community', '不會寫入'), bad: () => 1 } as unknown as CardNameEntry;
    await expect(store.write([entry(2, 'community', '不會寫入'), broken], { importedAt: 'later', count: 2 })).rejects.toBeDefined();

    const after = await store.all();
    expect([...after.keys()]).toEqual([1]);
    expect(after.get(1)?.nameZhTw).toBe('原本的正式名稱');
    expect(await store.lastImport()).toEqual(NOTE);
  });

  it('G63: a failed write of a first import leaves the table empty, as before', async () => {
    const store = setup(`names-${crypto.randomUUID()}`);
    const broken = { ...entry(7, 'official'), bad: () => 1 } as unknown as CardNameEntry;
    await expect(store.write([broken], NOTE)).rejects.toBeDefined();
    expect((await store.all()).size).toBe(0);
    expect(await store.lastImport()).toBeNull();
  });
});
