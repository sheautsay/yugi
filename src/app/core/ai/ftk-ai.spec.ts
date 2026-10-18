import { banquetCards, banquetDeck } from '../../../testing/ftk/banquet-deck.sample';
import { banquetAnswer } from '../../../testing/ftk/banquet-plans.sample';
import { deckFingerprint } from '../deck';
import { checkFtkRoute } from '../ftk-check';
import { validateCombo } from '../combo';
import { ACTION_TYPES, LINEAR_ACTION_TYPES } from '../models';
import { allSteps } from '../route-tree';
import { AI_OUTPUT_JSON_SCHEMA, RunContext, parseAiOutput } from './analysis-output';
import { FTK_JSON_SCHEMA, FTK_PROMPT_VERSION, FTK_SYSTEM_PROMPT, buildFtkPrompt, parseFtkOutput, toFtkCandidate } from './ftk-ai';

const deck = banquetDeck();
const cards = banquetCards();
const ctx: RunContext = { runId: 'ftk-run', deck, deckFingerprint: deckFingerprint(deck), cardDataVersion: 'test', provider: 'anthropic', model: 'mock', promptVersion: FTK_PROMPT_VERSION, cards, now: '2026-10-18T00:00:00.000Z' };

function candidate(answer: Record<string, unknown>) {
  const parsed = parseFtkOutput(JSON.stringify(answer));
  if (!parsed.ok) throw new Error(parsed.error);
  return toFtkCandidate(parsed.output.plans[0], ctx);
}

describe('FTK analysis answers (B7)', () => {
  it('the plan of the reference deck becomes a version 2 route with branches, a random step and no card named for the draw', () => {
    const { route, schemaErrors } = candidate(banquetAnswer());
    expect(schemaErrors).toEqual([]);
    expect(route.schemaVersion).toBe(2);
    expect(route.ftk).toEqual({ targetDamage: 8000, opponentExtraDeck: 15 });
    const draw = allSteps(route.steps).find((s) => s.actionType === 'draw')!;
    expect(draw.random).toEqual({ count: 1, to: 'hand' });
    expect(draw.moves).toBeUndefined();
    expect(draw.branches!.map((b) => [b.when === null, b.outcome])).toEqual([[false, 'success'], [true, 'fail']]);
    expect(validateCombo(route).errors).toEqual([]);
    expect(route.verification.status).not.toBe('verified');
    expect(route.analysis?.origin).toBe('ai');
  });

  it('the damage is the program\'s: Contract only takes 1000, so the branch the plan calls a success is refused and the plan stays a draft', () => {
    const { route } = candidate(banquetAnswer());
    expect(route.verification.status).toBe('draft');
    const problems = route.analysis!.check.problems.join('\n');
    expect(problems).toContain('標為成功，但依規則表計算對手 LP 還剩 7000');
    const check = checkFtkRoute(route, deck, { cards });
    expect(check.leaves.every((l) => !l.success)).toBe(true);
    expect(check.probability).toEqual({ ok: true, p: 0 });
    // the chance is still computed and shown: here the plan simply cannot win
  });

  it('a plan that names the card it draws is refused', () => {
    const { route } = candidate(banquetAnswer({ specifiedDraw: true }));
    expect(route.analysis!.check.problems.join('\n')).toContain('不能寫出抽到的卡');
    expect(route.verification.status).toBe('draft');
  });

  it('a plan whose segments loop or point nowhere is reported instead of looping forever', () => {
    expect(candidate(banquetAnswer({ cycle: true })).schemaErrors.join('\n')).toContain('形成了迴圈');
    expect(candidate(banquetAnswer({ missingSegment: true })).schemaErrors.join('\n')).toContain('不存在的段落');
  });

  it('answers that do not match the structure are rejected with the reason', () => {
    expect(parseFtkOutput('not json').ok).toBe(false);
    const bad = parseFtkOutput(JSON.stringify({ summary: '', plans: [] }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('AI 沒有提出任何計畫');
  });

  it('the prompt tells the model never to pick the drawn card, to branch, and not to count damage itself', () => {
    const prompt = buildFtkPrompt(deck, cards);
    expect(prompt.system).toContain('NEVER list the cards that turn up as moves');
    expect(prompt.system).toContain('"otherwise"');
    expect(prompt.system).toContain('do NOT work out damage');
    expect(prompt.system).toContain('write EACH use as its own step');
    expect(prompt.system).toBe(FTK_SYSTEM_PROMPT);
    expect(prompt.user).toContain('first-turn-kill deck');
    expect(prompt.user).toContain('D.D. Dynamite');
    expect(prompt.user).toContain('"effects"'); // the rule references the plan has to use for damage
    expect(prompt.system).not.toMatch(/interruption count|interruptions that really work/); // the ordinary goal is not used
  });

  it('the schema sent to the model is flat (no references) and the ordinary analysis cannot ask for random steps', () => {
    expect(JSON.stringify(FTK_JSON_SCHEMA)).not.toContain('$ref');
    expect(JSON.stringify(AI_OUTPUT_JSON_SCHEMA)).not.toContain('"draw"');
    expect(JSON.stringify(FTK_JSON_SCHEMA)).toContain('"draw"');
    expect(LINEAR_ACTION_TYPES).not.toContain('draw');
    expect(ACTION_TYPES).toContain('excavate');
    // an ordinary answer that tries to use a draw step does not parse
    const ordinary = {
      summary: '',
      starters: [],
      extenders: [],
      routes: [{ name: 'x', handCardIds: [1], starterCardIds: [1], requiredInMain: [], requiredInExtra: [], preconditions: [], steps: [{ actionType: 'draw', title: '', description: '', actorCardIds: [1], targetCardIds: [], materialCardIds: [], cost: '', effect: '', result: '', uncertainty: '', effectRef: '', moves: [] }], endBoard: [], pros: [], cons: [] }],
    };
    expect(parseAiOutput(JSON.stringify(ordinary)).ok).toBe(false);
  });
});
