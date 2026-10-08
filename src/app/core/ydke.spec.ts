import { ParseResult, ParsedDeck, totalCount } from './deck';
import { parseYdke, toYdke } from './ydke';

function expectOk(result: ParseResult): ParsedDeck {
  if (!result.ok) throw new Error(`expected success, got ${JSON.stringify(result.errors)}`);
  return result.deck;
}

function expectError(result: ParseResult): string {
  if (result.ok) throw new Error('expected failure, got success');
  return result.errors.map((e) => e.message).join(' / ');
}

describe('parseYdke — G2 specification vectors (acceptance §6.2)', () => {
  it('Y1: single card in main, empty extra and side', () => {
    expect(expectOk(parseYdke('ydke://o6lXBQ==!!!'))).toEqual({ main: [{ cardId: 89631139, count: 1 }], extra: [], side: [] });
  });

  it('Y2: cards across all three sections', () => {
    expect(expectOk(parseYdke('ydke://o6lXBQbqRAQ=!SSyyAg==!rvTMAg==!'))).toEqual({
      main: [
        { cardId: 89631139, count: 1 },
        { cardId: 71625222, count: 1 },
      ],
      extra: [{ cardId: 45231177, count: 1 }],
      side: [{ cardId: 46986414, count: 1 }],
    });
  });
});

describe('parseYdke — G2 behaviour', () => {
  it('reads uint32 little-endian, including IDs above 2^31', () => {
    expect(toYdke({ main: [{ cardId: 89631139, count: 1 }], extra: [], side: [] })).toBe('ydke://o6lXBQ==!!!');
    const big = { main: [{ cardId: 4294967295, count: 1 }, { cardId: 2147483648, count: 1 }], extra: [], side: [] };
    expect(expectOk(parseYdke(toYdke(big)))).toEqual(big);
  });

  it('counts repeated IDs and keeps zones separate', () => {
    const deck = expectOk(parseYdke('ydke://o6lXBaOpVwWjqVcF!o6lXBQ==!!'));
    expect(deck.main).toEqual([{ cardId: 89631139, count: 3 }]);
    expect(deck.extra).toEqual([{ cardId: 89631139, count: 1 }]);
    expect(deck.side).toEqual([]);
  });

  it('allows empty extra and side sections', () => {
    expect(expectOk(parseYdke('ydke://o6lXBQ==!!!')).extra).toEqual([]);
  });

  it('round-trips a full 40/15/15 deck with identical per-zone counts after import', () => {
    const original: ParsedDeck = {
      main: Array.from({ length: 14 }, (_, i) => ({ cardId: 10_000_000 + i, count: i < 12 ? 3 : 2 })),
      extra: Array.from({ length: 15 }, (_, i) => ({ cardId: 20_000_000 + i, count: 1 })),
      side: Array.from({ length: 5 }, (_, i) => ({ cardId: 30_000_000 + i, count: 3 })),
    };
    const imported = expectOk(parseYdke(toYdke(original)));
    expect(imported).toEqual(original);
    expect([totalCount(imported.main), totalCount(imported.extra), totalCount(imported.side)]).toEqual([40, 15, 15]);
  });

  it('N11: tolerates surrounding whitespace and newlines', () => {
    expect(expectOk(parseYdke('  \n ydke://o6lXBQ==!!! \r\n')).main).toEqual([{ cardId: 89631139, count: 1 }]);
  });
});

describe('parseYdke — N2 negative cases', () => {
  it('rejects an empty string', () => {
    expect(expectError(parseYdke(''))).toBe('內容為空');
  });

  it('rejects a non-ydke scheme', () => {
    expect(expectError(parseYdke('https://example.com/o6lXBQ==!!!'))).toContain('ydke://');
  });

  it('rejects missing or extra separators', () => {
    expect(expectError(parseYdke('ydke://'))).toContain('分隔符');
    expect(expectError(parseYdke('ydke://o6lXBQ==!!'))).toContain('分隔符');
    expect(expectError(parseYdke('ydke://o6lXBQ==!!!!'))).toContain('分隔符');
    expect(expectError(parseYdke('ydke://o6lXBQ==!!!x'))).toContain('分隔符');
  });

  it('rejects invalid base64', () => {
    expect(expectError(parseYdke('ydke://@@@@!!!'))).toContain('base64');
    expect(expectError(parseYdke('ydke://o6lXBQ=!!!'))).toContain('base64');
    expect(expectError(parseYdke('ydke://o6l XBQ==!!!'))).toContain('base64');
    expect(expectError(parseYdke('ydke://!SSy-Ag==!!'))).toContain('額外');
  });

  it('rejects data whose length is not a multiple of 4 bytes', () => {
    expect(expectError(parseYdke('ydke://AAAA!!!'))).toContain('不是 4 的倍數');
    expect(expectError(parseYdke('ydke://!!o6lXBQA=!'))).toContain('備牌');
  });

  it('rejects a zero passcode', () => {
    expect(expectError(parseYdke('ydke://AAAAAA==!!!'))).toContain('ID 為 0');
  });
});
