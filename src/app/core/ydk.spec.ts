import { ParseResult } from './deck';
import { parseYdk } from './ydk';

function expectOk(result: ParseResult) {
  if (!result.ok) throw new Error(`expected success, got ${JSON.stringify(result.errors)}`);
  return result.deck;
}

function expectErrors(result: ParseResult) {
  if (result.ok) throw new Error('expected failure, got success');
  return result.errors;
}

describe('parseYdk — G1', () => {
  it('splits #main / #extra / !side and counts each line as one copy', () => {
    const deck = expectOk(parseYdk('#created by test\n#main\n100\n100\n200\n#extra\n300\n!side\n400\n400\n400\n'));
    expect(deck.main).toEqual([
      { cardId: 100, count: 2 },
      { cardId: 200, count: 1 },
    ]);
    expect(deck.extra).toEqual([{ cardId: 300, count: 1 }]);
    expect(deck.side).toEqual([{ cardId: 400, count: 3 }]);
  });

  it('merges non-adjacent duplicate IDs into a single row per zone and keeps zones apart', () => {
    const deck = expectOk(parseYdk('#main\n1\n2\n1\n#extra\n1\n!side\n1\n'));
    expect(deck.main).toEqual([
      { cardId: 1, count: 2 },
      { cardId: 2, count: 1 },
    ]);
    expect(deck.extra).toEqual([{ cardId: 1, count: 1 }]);
    expect(deck.side).toEqual([{ cardId: 1, count: 1 }]);
  });

  it('handles UTF-8 BOM, CRLF, lone CR, surrounding whitespace and blank lines', () => {
    const text = '﻿#created by x\r\n\r\n  #main  \r\n  89631139 \r\n\r\n89631139\r#extra\r\n\t45231177\t\r\n!side\r\n';
    const deck = expectOk(parseYdk(text));
    expect(deck.main).toEqual([{ cardId: 89631139, count: 2 }]);
    expect(deck.extra).toEqual([{ cardId: 45231177, count: 1 }]);
    expect(deck.side).toEqual([]);
  });

  it('ignores header comments and never reads them as cards', () => {
    const deck = expectOk(parseYdk('#created by EDOPro 12345\n#tag 2024 deck\n#main\n#note 999\n100\n'));
    expect(deck.main).toEqual([{ cardId: 100, count: 1 }]);
  });

  it('accepts leading zeros as a numeric passcode', () => {
    expect(expectOk(parseYdk('#main\n05405694\n')).main).toEqual([{ cardId: 5405694, count: 1 }]);
  });

  it('is case-insensitive for section markers', () => {
    expect(expectOk(parseYdk('#MAIN\n1\n#Extra\n2\n!SIDE\n3\n')).side).toEqual([{ cardId: 3, count: 1 }]);
  });

  it('allows an empty but well-formed deck (deck rules are checked separately)', () => {
    expect(expectOk(parseYdk('#main\n#extra\n!side\n'))).toEqual({ main: [], extra: [], side: [] });
  });
});

describe('parseYdk — N1 negative cases', () => {
  it('reports every bad line with its line number and does not succeed', () => {
    const errors = expectErrors(parseYdk('#main\n100\n12.5\n-5\nabc\n4294967296\n123abc\n0\n200\n'));
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(errors[0].message).toContain('整數');
    expect(errors[1].message).toContain('負數');
    expect(errors[2].message).toContain('數字');
    expect(errors[3].message).toContain('超出範圍');
    expect(errors[4].message).toContain('數字');
    expect(errors[5].message).toContain('0');
  });

  it('accepts the largest uint32 passcode', () => {
    expect(expectOk(parseYdk('#main\n4294967295\n')).main).toEqual([{ cardId: 4294967295, count: 1 }]);
  });

  it('rejects unknown "!" fields', () => {
    const errors = expectErrors(parseYdk('#main\n1\n!extra\n2\n'));
    expect(errors).toEqual([{ line: 3, text: '!extra', message: '未知的區段標記（只支援 #main、#extra、!side）' }]);
  });

  it('flags misspelled section markers instead of treating them as comments', () => {
    expect(expectErrors(parseYdk('#mian\n1\n'))[0]).toMatchObject({ line: 1, message: expect.stringContaining('#main') });
    expect(expectErrors(parseYdk('#main\n1\n#extar\n2\n'))[0]).toMatchObject({ line: 3, message: expect.stringContaining('#extra') });
    expect(expectErrors(parseYdk('#main\n1\n#side\n2\n'))[0]).toMatchObject({ line: 3, message: expect.stringContaining('!side') });
  });

  it('rejects cards that appear before any section', () => {
    const errors = expectErrors(parseYdk('100\n#main\n200\n'));
    expect(errors[0]).toMatchObject({ line: 1, message: expect.stringContaining('之前') });
  });

  it('rejects text with no section markers at all', () => {
    expect(expectErrors(parseYdk('#just a comment\n')).at(-1)?.message).toContain('找不到');
  });

  it('rejects empty input', () => {
    expect(expectErrors(parseYdk('  \n\n'))[0].message).toBe('內容為空');
  });

  it('rejects an extremely large file before parsing', () => {
    const huge = '#main\n' + '89631139\n'.repeat(40_000);
    expect(expectErrors(parseYdk(huge))[0].message).toContain('過大');
  });
});
