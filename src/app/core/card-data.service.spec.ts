import { TestBed } from '@angular/core/testing';
import { FETCH_FN, SLEEP_FN } from './card-api';
import { CardDataService } from './card-data.service';
import { AppDb, DB_NAME } from './db';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function setup(responder: (url: string) => Response | Promise<Response>) {
  const urls: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      { provide: DB_NAME, useValue: `cards-${crypto.randomUUID()}` },
      { provide: SLEEP_FN, useValue: async () => undefined },
      {
        provide: FETCH_FN,
        useValue: async (url: string) => {
          urls.push(url);
          return responder(url);
        },
      },
    ],
  });
  return { service: TestBed.inject(CardDataService), db: TestBed.inject(AppDb), urls };
}

describe('CardDataService', () => {
  it('downloads only missing IDs, caches them and reports unknown IDs separately', async () => {
    const { service, urls } = setup(() => json(200, { data: [{ id: 1, name: 'Maliss <P> Dormouse', type: 'Effect Monster', frameType: 'effect' }] }));
    const result = await service.downloadMissing([1, 999]);
    expect(result).toEqual({ added: 1, unknownIds: [999] });
    expect((await service.getMany([1, 999])).get(1)?.nameEn).toBe('Maliss <P> Dormouse');

    urls.length = 0;
    await service.downloadMissing([1]);
    expect(urls).toEqual([]); // already cached: no request
  });

  it('distinguishes an unreachable source from unknown IDs and leaves the cache intact', async () => {
    const { service } = setup(() => {
      throw new TypeError('offline');
    });
    const result = await service.downloadMissing([1]);
    expect(result.added).toBe(0);
    expect(result.unknownIds).toEqual([]);
    expect(result.error).toContain('已快取的資料不受影響');
    expect(await service.count()).toBe(0);
  });

  it('searches the local cache by passcode and by name, case-insensitively', async () => {
    const { service } = setup(() =>
      json(200, {
        data: [
          { id: 32061192, name: 'Maliss <P> Dormouse', type: 'Effect Monster' },
          { id: 68337209, name: 'Maliss in Underground', type: 'Spell Card' },
        ],
      }),
    );
    await service.downloadMissing([32061192, 68337209]);
    expect((await service.search('dormouse')).map((c) => c.cardId)).toEqual([32061192]);
    expect((await service.search('68337209')).map((c) => c.cardId)).toEqual([68337209]);
    expect((await service.search('maliss')).length).toBe(2);
    expect(await service.search('  ')).toEqual([]);
  });

  it('keeps a locally stored zh-TW name when refreshing upstream data', async () => {
    const { service, db } = setup(() => json(200, { data: [{ id: 5, name: 'Upstream', type: 'Spell Card' }] }));
    await service.downloadMissing([5]);
    const stored = (await (await db.db()).get('cards', 5))!;
    await (await db.db()).put('cards', { ...stored, nameZhTw: '本機譯名' });
    await service.refreshAll();
    expect((await service.getMany([5])).get(5)).toMatchObject({ nameEn: 'Upstream', nameZhTw: '本機譯名' });
  });

  it('requires at least two characters for online search', async () => {
    const { service, urls } = setup(() => json(200, { data: [] }));
    expect((await service.searchOnline('a')).error).toContain('2 個字元');
    expect(urls).toEqual([]);
  });
});
