import { RunContext, toCandidate } from './ai/analysis-output';
import { mockAiOutput } from './ai/mock-ai.sample';
import { aiOutputSchema } from './ai/analysis-output';
import { IDS, testCards, testDeck } from './ai/test-deck.sample';
import { parseBackup, buildBackup } from './backup';
import { comboCardIds, exportCombos, prepareComboImport, validateCombo } from './combo';
import { deckFingerprint } from './deck';
import { matchRoute } from './matcher';
import { ComboRoute } from './models';

// CR-004 G25-1 / G26-3: the optional fields are backward compatible, and AI routes that no
// longer fit the deck are never offered in the opening-hand query.
const deck = testDeck();
const cards = testCards(deck);
const ctx: RunContext = {
  runId: 'run-1',
  deck,
  deckFingerprint: deckFingerprint(deck),
  cardDataVersion: 'test',
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  promptVersion: 'deck-analysis-v1',
  cards,
  now: '2026-10-09T01:00:00.000Z',
};
const aiRoute = (): ComboRoute => toCandidate(aiOutputSchema.parse(mockAiOutput(IDS)).routes[0], ctx).route;
const FIRST = { turnOrder: 'first' as const, emptyBoard: true, normalSummonAvailable: true, noInterruption: true };
const hand = [IDS.starter, 201, 202, 203, 204];

describe('CR-004 backward compatibility', () => {
  it('routes without the new fields validate exactly as before', () => {
    const { analysis: _, ...old } = aiRoute();
    const plain = { ...old, steps: old.steps.map(({ moves: __, ...s }) => s) };
    expect(validateCombo(plain).ok).toBe(true);
  });

  it('AI fields are strict: unknown keys, bad fingerprints or providers are rejected', () => {
    const r = aiRoute();
    expect(validateCombo(r).ok).toBe(true);
    expect(validateCombo({ ...r, analysis: { ...r.analysis, engineVerified: true } }).ok).toBe(false);
    expect(validateCombo({ ...r, analysis: { ...r.analysis, deckFingerprint: 'nope' } }).ok).toBe(false);
    expect(validateCombo({ ...r, analysis: { ...r.analysis, provider: 'someone-else' } }).ok).toBe(false);
    expect(validateCombo({ ...r, steps: [{ ...r.steps[0], moves: [{ cardId: 1, from: 'hand', to: 'void' }] }] }).ok).toBe(false);
  });

  it('export → import keeps the AI fields; a "verified" claim in a file is still downgraded', () => {
    const r = { ...aiRoute(), verification: { status: 'verified' as const, verifiedAt: '2026-10-09', verifiedBy: 'x', evidenceNote: 'y', deckFingerprint: deckFingerprint(deck) } };
    const result = prepareComboImport(exportCombos([r]), { knownCardIds: new Set(cards.keys()), existingIds: new Set() });
    expect(result.ok).toBe(true);
    const imported = result.ok ? result.items[0].route : null;
    expect(imported?.verification.status).toBe('unverified');
    expect(imported?.analysis).toEqual(r.analysis);
    expect(imported?.steps[0].moves).toEqual(r.steps[0].moves);
  });

  it('backups with AI routes restore; backups never contain AI settings, runs or keys', () => {
    const backup = buildBackup({ decks: [deck], combos: [aiRoute()], layouts: [] });
    expect(Object.keys(backup).sort()).toEqual(['backupVersion', 'combos', 'decks', 'exportedAt', 'format', 'layouts']);
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(true);
  });

  it('comboCardIds includes cards that only appear in moves', () => {
    const r = aiRoute();
    r.steps[0].moves = [...(r.steps[0].moves ?? []), { cardId: 205, from: 'deck', to: 'gy' }];
    expect(comboCardIds(r)).toContain(205);
  });
});

describe('opening-hand query with AI routes (G26-3)', () => {
  it('a consistent AI route is offered as unverified', () => {
    const m = matchRoute(aiRoute(), deck, hand, FIRST);
    expect(m.kind).toBe('unverified');
  });

  it('after the deck changes, an AI route that no longer fits is unavailable with the reason', () => {
    const changed = { ...deck, extra: deck.extra.filter((r) => r.cardId !== IDS.link).concat({ cardId: 499, count: 1 }) };
    const m = matchRoute(aiRoute(), changed, hand, FIRST, { name: (id) => `#${id}` });
    expect(m.kind).toBe('unavailable');
    expect(m.reasons.map((r) => r.code)).toContain('DECK_MISMATCH');
    expect(m.reasons.map((r) => r.textZhTw)).toContain(`AI 路線不適用於目前牌組：「#${IDS.link}」（ID ${IDS.link}）不在此牌組的主牌或額外牌組中`);
  });

  it('a hand-written route with the same cards is unaffected (no new check for non-AI routes)', () => {
    const { analysis: _, ...manual } = aiRoute();
    const changed = { ...deck, extra: deck.extra.filter((r) => r.cardId !== IDS.link).concat({ cardId: 499, count: 1 }) };
    const m = matchRoute(manual, changed, hand, FIRST);
    expect(m.reasons.map((r) => r.code)).not.toContain('DECK_MISMATCH');
  });
});
