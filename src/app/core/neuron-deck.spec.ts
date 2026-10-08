import { toCardRecord } from './card-api';
import { checkDeck, countOf, totalCount } from './deck';
import { detectDeckFormat } from './deck-import';
import { CardRecord } from './models';
import { deckCodeError, isNeuronDeckText, officialDeckSearchUrl, parseNeuronDeckText, resolveNeuronDeck } from './neuron-deck';
import { EDGE_SAMPLE, EDGE_SAMPLE_CARDS } from './neuron-deck.sample';

const CARDS: CardRecord[] = EDGE_SAMPLE_CARDS.map((c) => ({ ...toCardRecord(c, 'test'), formats: ['Master Duel'] }));
const idOf = (name: string) => CARDS.find((c) => c.nameEn === name)!.cardId;

function parse(text: string) {
  const result = parseNeuronDeckText(text);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.sections;
}

describe('deck code — G21-1/2, N17', () => {
  it('accepts alphanumeric codes and builds the official English Deck Search URL', () => {
    expect(deckCodeError('2962ut6')).toBeNull();
    expect(deckCodeError('  2962ut6 ')).toBeNull();
    expect(officialDeckSearchUrl(' 2962ut6 ')).toBe('https://www.db.yugioh-card.com/yugiohdb/deck_search.action?ope=1&deck_code=2962ut6&request_locale=en');
  });

  it('rejects empty, spaced, symbol, too short and too long codes', () => {
    expect(deckCodeError('')).toContain('請輸入');
    expect(deckCodeError('29 62')).toContain('只能包含');
    expect(deckCodeError('2962ut6!')).toContain('只能包含');
    expect(deckCodeError('abc')).toContain('長度');
    expect(deckCodeError('a'.repeat(21))).toContain('長度');
  });
});

describe('parseNeuronDeckText — the user\'s Edge sample (G21-4/5/10)', () => {
  it('is detected as an official deck list, not YDK / ydke / unknown', () => {
    expect(isNeuronDeckText(EDGE_SAMPLE)).toBe(true);
    expect(detectDeckFormat(EDGE_SAMPLE)).toBe('neuron');
    expect(detectDeckFormat('#main\n1\n')).toBe('ydk');
  });

  it('reads every section with its printed total and every row\'s count', () => {
    const sections = parse(EDGE_SAMPLE);
    expect(sections.map((s) => [s.title, s.zone, s.declared, s.rows.length])).toEqual([
      ['Monster Cards', 'main', 27, 16],
      ['Spell Cards', 'main', 7, 6],
      ['Trap Cards', 'main', 6, 4],
      ['Extra Deck', 'extra', 15, 15],
    ]);
    expect(sections[0].rows.slice(0, 4)).toEqual([
      { name: 'Droll & Lock Bird', count: 2 },
      { name: 'Maxx "C"', count: 1 },
      { name: 'Ash Blossom & Joyous Spring', count: 3 },
      { name: 'Ghost Belle & Haunted Mansion', count: 2 },
    ]);
  });

  it('maps all 41 names to passcodes: main 40 / extra 15 / side 0, a valid deck', () => {
    const { deck, unknownNames } = resolveNeuronDeck(parse(EDGE_SAMPLE), CARDS);
    expect(unknownNames).toEqual([]);
    expect([totalCount(deck.main), totalCount(deck.extra), totalCount(deck.side)]).toEqual([40, 15, 0]);
    expect(deck.main).toHaveLength(26);
    expect(deck.extra).toHaveLength(15);
    expect(countOf(deck.main, idOf('Ash Blossom & Joyous Spring'))).toBe(3);
    expect(countOf(deck.main, idOf('Infinite Impermanence'))).toBe(3);
    expect(countOf(deck.main, idOf('Radiant Typhoon Chant'))).toBe(2);
    expect(countOf(deck.extra, idOf('S:P Little Knight'))).toBe(1);
    expect(checkDeck(deck, new Map(CARDS.map((c) => [c.cardId, c]))).queryable).toBe(true);
  });

  it('handles LF line endings and a one-line-per-row layout', () => {
    expect(parse(EDGE_SAMPLE.replace(/\r\n/g, '\n'))).toEqual(parse(EDGE_SAMPLE));
    const oneLine = ['Monster Cards', '4', '1\tAsh Blossom & Joyous Spring\tSemi-Limited Cards\t3', '2\tMaxx "C"\t1', 'Extra Deck', '1', '1\tLinguriboh\t1'].join('\n');
    const { deck } = resolveNeuronDeck(parse(oneLine), CARDS);
    expect(deck.main).toEqual([
      { cardId: idOf('Ash Blossom & Joyous Spring'), count: 3 },
      { cardId: idOf('Maxx "C"'), count: 1 },
    ]);
    expect(deck.extra).toEqual([{ cardId: idOf('Linguriboh'), count: 1 }]);
  });

  it('merges the same card listed twice in a zone and ignores text before the first section', () => {
    const text = ['Deck Code 2962ut6', 'Total in Main Deck 40', 'Spell Cards', '3', '1\t\t', 'Gold Sarcophagus', '1', '2\t\t', 'Gold Sarcophagus', '2'].join('\n');
    expect(resolveNeuronDeck(parse(text), CARDS).deck.main).toEqual([{ cardId: idOf('Gold Sarcophagus'), count: 3 }]);
  });
});

describe('parseNeuronDeckText — N18 incomplete or wrong text never imports', () => {
  const errorsOf = (text: string) => {
    const result = parseNeuronDeckText(text);
    if (result.ok) throw new Error('expected failure');
    return result.errors.map((e) => e.message).join(' / ');
  };

  it('a section whose rows do not add up to its printed total (partial copy)', () => {
    const cut = EDGE_SAMPLE.split('\r\n').filter((l) => l !== 'Bystial Druiswurm').join('\r\n');
    expect(errorsOf(cut)).toContain('「Monster Cards」標示 27 張');
  });

  it('a row without a count, a count of 4, a missing section total, a duplicated section', () => {
    expect(errorsOf('Monster Cards\n1\n1\t\t\nMaxx "C"\nExtra Deck\n0')).toContain('缺少張數');
    expect(errorsOf('Monster Cards\n4\n1\t\t\nMaxx "C"\n4')).toContain('不在 1～3 之間');
    expect(errorsOf('Monster Cards\n1\t\t\nMaxx "C"\n1')).toContain('缺少區段合計');
    expect(errorsOf('Spell Cards\n0\nSpell Cards\n0')).toContain('重複出現');
    expect(errorsOf('Monster Cards\n1\n1\t\t\nMaxx "C"\nsomething else')).toContain('應為張數');
  });

  it('unknown card names are listed, not dropped', () => {
    const text = ['Monster Cards', '2', '1\t\t', 'Maxx "C"', '1', '2\t\t', 'Not A Real Card', '1'].join('\n');
    expect(resolveNeuronDeck(parse(text), CARDS)).toEqual({ deck: { main: [{ cardId: idOf('Maxx "C"'), count: 1 }], extra: [], side: [] }, unknownNames: ['Not A Real Card'] });
  });

  it('non-English page text is not mistaken for an official English list', () => {
    expect(isNeuronDeckText('モンスターカード\n27\n1\t\t\n増殖するG\n1')).toBe(false);
    expect(detectDeckFormat('モンスターカード\n27')).toBe('unknown');
  });
});
