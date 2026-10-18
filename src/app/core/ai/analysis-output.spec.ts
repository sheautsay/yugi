import { validateCombo } from '../combo';
import { deckFingerprint } from '../deck';
import { AI_OUTPUT_JSON_SCHEMA, RunContext, cleanText, parseAiOutput, toCandidate, toStarters } from './analysis-output';
import { mockAiOutput } from './mock-ai.sample';
import { buildPrompt, cardsWithoutText } from './prompt';
import { IDS, testCards, testDeck } from './test-deck.sample';

// CR-004 G23/G24/N19 with MOCKED model output (no AI service is called).
const deck = testDeck();
const cards = testCards(deck);
const ctx: RunContext = {
  runId: 'run-1',
  deck,
  deckFingerprint: deckFingerprint(deck),
  cardDataVersion: 'YGOPRODeck 147.23',
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  servedModel: 'claude-opus-5-5',
  promptVersion: 'deck-analysis-v1',
  cards,
  now: '2026-10-09T01:00:00.000Z',
};
const name = (id: number) => cards.get(id)?.nameEn ?? `ID ${id}`;

function parsed(output: unknown = mockAiOutput(IDS)) {
  const result = parseAiOutput(JSON.stringify(output));
  if (!result.ok) throw new Error(result.error);
  return result.output;
}

describe('parseAiOutput (N19)', () => {
  it('accepts schema-valid JSON, also inside a ```json fence', () => {
    expect(parseAiOutput(JSON.stringify(mockAiOutput(IDS))).ok).toBe(true);
    expect(parseAiOutput('```json\n' + JSON.stringify(mockAiOutput(IDS)) + '\n```').ok).toBe(true);
  });

  it('rejects non-JSON, missing fields, wrong types and an empty route list', () => {
    expect(parseAiOutput('這是一段文字，不是 JSON')).toEqual({ ok: false, error: 'AI 回應不是有效的 JSON' });
    const noRoutes = { ...mockAiOutput(IDS), routes: [] };
    expect(parseAiOutput(JSON.stringify(noRoutes))).toMatchObject({ ok: false, error: expect.stringContaining('AI 沒有提出任何路線') });
    const { summary: _, ...missing } = mockAiOutput(IDS);
    expect(parseAiOutput(JSON.stringify(missing))).toMatchObject({ ok: false, error: expect.stringContaining('summary') });
    const badZone = mockAiOutput(IDS) as { routes: Array<{ steps: Array<{ moves: Array<{ from: string }> }> }> };
    badZone.routes[0].steps[0].moves[0].from = 'graveyard';
    expect(parseAiOutput(JSON.stringify(badZone)).ok).toBe(false);
    const badId = mockAiOutput(IDS) as { routes: Array<{ handCardIds: unknown[] }> };
    badId.routes[0].handCardIds = ['101'];
    expect(parseAiOutput(JSON.stringify(badId)).ok).toBe(false);
  });

  it('the JSON schema sent to providers uses no unsupported keywords and closes every object', () => {
    const text = JSON.stringify(AI_OUTPUT_JSON_SCHEMA);
    for (const k of ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern']) expect(text).not.toContain(`"${k}"`);
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const o = node as Record<string, unknown>;
      if (o['type'] === 'object') {
        expect(o['additionalProperties']).toBe(false);
        expect(o['required']).toEqual(Object.keys(o['properties'] as object));
      }
      Object.values(o).forEach(walk);
    };
    walk(AI_OUTPUT_JSON_SCHEMA);
  });
});

describe('toCandidate (G23/G24/G25)', () => {
  it('converts a consistent route into a valid ComboRoute that is unverified — never verified', () => {
    const output = parsed();
    const c = toCandidate(output.routes[0], ctx);
    expect(c.schemaErrors).toEqual([]);
    expect(validateCombo(c.route, { knownCardIds: new Set(cards.keys()), requireSteps: true }).ok).toBe(true);
    expect(c.route.verification).toEqual({ status: 'unverified' });
    expect(c.route.analysis?.check).toMatchObject({ passed: true, problems: [] });
    expect(c.route.conditions.handAllOf).toEqual([{ anyOf: [IDS.starter], count: 1 }]);
    expect(c.route.conditions.mustRemainInMain).toEqual([{ cardId: IDS.searched, count: 1 }]);
    expect(c.route.steps.map((s) => s.order)).toEqual([1, 2, 3, 4]);
    expect(c.route.steps[3]).toMatchObject({ actionType: 'link-summon', materialCardIds: [IDS.starter, IDS.searched], fromZone: '額外牌組', toZone: '場上' });
    expect(c.route.endBoard).toEqual([{ cardId: IDS.link, zone: '場上', count: 1, note: '終場（mock）' }]);
    expect(c.route.analysis).toMatchObject({ origin: 'ai', provider: 'anthropic', model: 'claude-opus-5-5', deckFingerprint: deckFingerprint(deck), pros: ['只需要一張起手卡（mock）'] });
    expect(JSON.stringify(c.route)).not.toContain('"verifiedBy"');
  });

  it('an inconsistent route is kept as an AI candidate (draft) with every problem listed', () => {
    const c = toCandidate(parsed().routes[1], ctx);
    expect(c.route.verification.status).toBe('draft');
    expect(c.route.analysis?.check.passed).toBe(false);
    const problems = c.route.analysis!.check.problems;
    expect(problems).toContain(`「ID ${IDS.outsider}」（ID ${IDS.outsider}）不在此牌組的主牌或額外牌組中`);
    expect(problems.some((p) => p.startsWith('第 1 步') && p.includes('不在場上'))).toBe(true);
    expect(problems.some((p) => p.includes(`終場列出「Test Card ${IDS.link}」×1`))).toBe(true);
  });

  it('a model claim of "verified" is ignored', () => {
    const output = parsed();
    expect(JSON.stringify(output)).not.toContain('verification');
  });

  it('defuses markup in model text but keeps card names like "<P>"', () => {
    expect(cleanText('Maliss <P> Dormouse', 100)).toBe('Maliss <P> Dormouse');
    const cleaned = cleanText('<script>alert(1)</script> onload=x javascript:y', 200);
    expect(cleaned).not.toMatch(/<script|onload=|javascript:/);
    const output = parsed();
    output.routes[0].steps[0].description = '<img src=x onerror=alert(1)>';
    const c = toCandidate(output.routes[0], ctx);
    expect(c.schemaErrors).toEqual([]);
    expect(validateCombo(c.route).ok).toBe(true);
  });
});

describe('toStarters (G23-1)', () => {
  it('single vs multi follows the number of cards; cards outside the main deck are flagged', () => {
    const { starters, extenders } = toStarters(parsed(), deck, name);
    expect(starters.map((s) => [s.cardIds, s.kind])).toEqual([
      [[IDS.starter], 'single'],
      [[IDS.extender, IDS.filler], 'multi'],
      [[IDS.outsider], 'single'],
    ]);
    expect(starters[0].problem).toBeUndefined();
    expect(starters[2].problem).toBe(`「ID ${IDS.outsider}」不在主牌組中`);
    expect(extenders).toEqual([{ cardId: IDS.extender, requires: '場上有一隻怪獸（mock）', description: '延伸（mock）' }]);
  });
});

describe('buildPrompt (G27-2)', () => {
  it('contains only the deck list and card data — every card once, no side deck, no key', () => {
    const withSide = testDeck({ side: [{ cardId: 777, count: 1 }] });
    const { system, user } = buildPrompt(withSide, cards, { single: true, multi: false, extenders: true, maxRoutes: 3 });
    const lines = user.split('\n').filter((l) => l.startsWith('{'));
    expect(lines).toHaveLength(withSide.main.length + withSide.extra.length);
    expect(user).not.toContain('"id":777');
    expect(user).toContain('Return at most 3 routes');
    expect(user).toContain('Do not include routes that need two or more starter cards.');
    expect(JSON.parse(lines[0])).toMatchObject({ id: IDS.starter, copies: 3, deck: 'main', text: `Effect text of ${IDS.starter}.` });
    expect(system).toContain('Never claim that a route is legal, verified or tested.');
    expect(system + user).not.toMatch(/sk-ant|api[-_ ]?key/i);
  });

  it('lists deck cards without effect text', () => {
    const partial = new Map(cards);
    partial.set(IDS.link, { ...cards.get(IDS.link)!, desc: undefined });
    expect(cardsWithoutText(deck, partial)).toEqual([IDS.link]);
  });
});
