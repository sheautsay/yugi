import { TestBed } from '@angular/core/testing';
import { CardApiError, FETCH_FN, SLEEP_FN, YgoProDeckClient, toCardRecord } from './card-api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(responses: Array<Response | Error>) {
  const urls: string[] = [];
  const sleeps: number[] = [];
  TestBed.configureTestingModule({
    providers: [
      {
        provide: FETCH_FN,
        useValue: async (url: string) => {
          urls.push(url);
          const next = responses.shift();
          if (!next) throw new Error('no more responses');
          if (next instanceof Error) throw next;
          return next;
        },
      },
      { provide: SLEEP_FN, useValue: async (ms: number) => void sleeps.push(ms) },
    ],
  });
  return { client: TestBed.inject(YgoProDeckClient), urls, sleeps };
}

describe('toCardRecord', () => {
  it('maps kinds and extra-deck frames', () => {
    const now = '2026-10-08T00:00:00.000Z';
    expect(toCardRecord({ id: 1, name: 'A', type: 'Effect Monster', frameType: 'effect' }, now)).toMatchObject({ kind: 'monster', isExtraDeckType: false });
    expect(toCardRecord({ id: 2, name: 'B', type: 'Link Monster', frameType: 'link' }, now)).toMatchObject({ kind: 'monster', isExtraDeckType: true });
    expect(toCardRecord({ id: 3, name: 'C', type: 'Spell Card', frameType: 'spell' }, now)).toMatchObject({ kind: 'spell', isExtraDeckType: false });
    expect(toCardRecord({ id: 4, name: 'D', type: 'Trap Card', frameType: 'trap' }, now)).toMatchObject({ kind: 'trap', source: 'YGOPRODeck API v7', updatedAt: now });
    expect(toCardRecord({ id: 5, name: 'E', type: 'Skill Card' }, now).kind).toBe('unknown');
  });
});

describe('YgoProDeckClient', () => {
  it('requests IDs in batches of 50 and returns only known cards', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => i + 1);
    const { client, urls } = setup([
      json(200, { data: [{ id: 1, name: 'A', type: 'Spell Card' }] }),
      json(400, { error: 'No card matching your query was found in the database.' }),
      json(200, { data: [{ id: 101, name: 'B', type: 'Trap Card' }, { bogus: true }] }),
    ]);
    const cards = await client.fetchByIds(ids);
    expect(cards.map((c) => c.id)).toEqual([1, 101]);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${ids.slice(0, 50).join(',')}`);
  });

  it('retries network errors, 429 and 5xx with exponential backoff, then succeeds', async () => {
    const { client, sleeps } = setup([new TypeError('offline'), json(429, {}), json(503, {}), json(200, { data: [{ id: 7, name: 'X', type: 'Spell Card' }] })]);
    expect((await client.fetchByIds([7])).map((c) => c.id)).toEqual([7]);
    expect(sleeps.filter((ms) => ms >= 1000)).toEqual([1000, 2000, 4000]);
  });

  it('gives up after the retry budget with a CardApiError (no endless loop)', async () => {
    const { client, urls } = setup([json(500, {}), json(500, {}), json(500, {}), json(500, {}), json(500, {})]);
    await expect(client.fetchByIds([7])).rejects.toBeInstanceOf(CardApiError);
    expect(urls).toHaveLength(4);
  });

  it('does not retry client errors other than 429', async () => {
    const { client, urls } = setup([json(404, {})]);
    await expect(client.fetchByIds([7])).rejects.toThrow('HTTP 404');
    expect(urls).toHaveLength(1);
  });

  it('spaces consecutive requests by at least 250 ms', async () => {
    const { client, sleeps } = setup([json(200, { data: [] }), json(200, { data: [] })]);
    await client.searchByName('Maliss');
    await client.searchByName('Maliss');
    expect(sleeps.some((ms) => ms > 0 && ms <= 250)).toBe(true);
  });

  it('fetches images through the same-origin proxy and rejects non-image answers', async () => {
    const { client, urls } = setup([
      new Response('jpeg-bytes', { status: 200, headers: { 'Content-Type': 'image/jpeg' } }),
      new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    ]);
    expect((await client.fetchImage(32061192, 'cropped')).type).toBe('image/jpeg');
    expect(urls[0]).toBe('/ygo-images/cards_cropped/32061192.jpg');
    await expect(client.fetchImage(1, 'small')).rejects.toThrow('未回傳圖片');
  });
});
