import { UNKNOWN_FORMAT_MESSAGE, detectDeckFormat, parseDeckText } from './deck-import';
import { parseYdk } from './ydk';
import { parseYdke } from './ydke';

describe('detectDeckFormat — G13 unified import box', () => {
  it('detects ydke:// codes, including surrounding whitespace', () => {
    expect(detectDeckFormat('ydke://o6lXBQ==!!!')).toBe('ydke');
    expect(detectDeckFormat('\n  ydke://o6lXBQ==!!! \n')).toBe('ydke');
  });

  it('detects YDK text', () => {
    expect(detectDeckFormat('#created by x\n#main\n1\n')).toBe('ydk');
    expect(detectDeckFormat('﻿!side\n1')).toBe('ydk');
  });

  it('reports anything else as unknown', () => {
    expect(detectDeckFormat('ABCD1234')).toBe('unknown');
    expect(detectDeckFormat('89631139\n89631139')).toBe('unknown');
    expect(detectDeckFormat('')).toBe('unknown');
  });
});

describe('parseDeckText — G13 equivalence with the strict parsers', () => {
  const ydkInputs = ['#main\n1\n1\n#extra\n2\n!side\n3\n', '﻿#main\r\n100\r\n', '#main\n12.5\n', '#mian\n1\n', '!foo\n'];
  const ydkeInputs = ['ydke://o6lXBQbqRAQ=!SSyyAg==!rvTMAg==!', ' ydke://o6lXBQ==!!! ', 'ydke://o6lXBQ==!!', 'ydke://AAAA!!!', 'ydke://@@@@!!!'];

  it.each(ydkInputs)('YDK input %j gives the same result as parseYdk', (input) => {
    expect(parseDeckText(input)).toEqual({ format: 'ydk', result: parseYdk(input) });
  });

  it.each(ydkeInputs)('YDKE input %j gives the same result as parseYdke', (input) => {
    expect(parseDeckText(input)).toEqual({ format: 'ydke', result: parseYdke(input) });
  });

  it('never turns a G1/G2 negative case into success', () => {
    const negatives = ['#main\n-5\n', '#main\nabc\n', '100\n#main\n', '#main\n4294967296\n', 'ydke://', 'ydke://o6lXBQ=!!!', 'ydke://AAAAAA==!!!'];
    for (const input of negatives) expect(parseDeckText(input).result.ok).toBe(false);
  });
});

describe('parseDeckText — N11 unknown formats', () => {
  it('does not guess: an in-game style code yields the "still researching" message and no deck', () => {
    const { format, result } = parseDeckText('MDXK-7F3Q-9ZPA');
    expect(format).toBe('unknown');
    expect(result).toEqual({ ok: false, errors: [{ message: UNKNOWN_FORMAT_MESSAGE }] });
    expect(UNKNOWN_FORMAT_MESSAGE).toContain('遊戲內牌組代碼無法直接解碼'); // CR-003
  });

  it('treats gibberish and empty input as failures', () => {
    expect(parseDeckText('!!@@##').result.ok).toBe(false);
    expect(parseDeckText('   ').result).toEqual({ ok: false, errors: [{ message: '內容為空' }] });
  });
});
