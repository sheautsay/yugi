/**
 * TEST DATA ONLY (B7). Plans for the Banquet FTK reference deck, HAND-WRITTEN from the card texts to exercise the first-turn-kill
 * checks (random steps, branches, damage from the rule table). They are NOT model output and NOT a verified FTK line: the real
 * deck's line is not known here, and the damage cards are Traps that cannot be activated the turn they are Set.
 * Excluded from the app build (`*.sample.ts`).
 */
import { ComboRoute, ComboStep, FtkInfo, HandClause, PlayZone, RouteBranch } from '../../app/core/models';
import { ID } from './banquet-deck.sample';

let counter = 0;
const uid = (p: string) => `${p}-${++counter}`;

export const C = {
  chicken: ID['Chicken Game'],
  contract: ID['Contract with Don Thousand'],
  dealings: ID['Dark World Dealings'],
  banquet: ID['Banquet of Millions'],
  dynamite: ID['D.D. Dynamite'],
  evenly: ID['Evenly Matched'],
  reasoning: ID['Reasoning'],
  trick: ID['Trap Trick'],
  holic: ID['Trap Holic'],
  mallet: ID['Magical Mallet'],
  marrella: ID['Paleozoic Marrella'],
  void: ID['Into the Void'],
};

type Mv = [number, PlayZone, PlayZone];
export const mv = (list: Mv[]) => list.map(([cardId, from, to]) => ({ cardId, from, to }));

export function st(actionType: ComboStep['actionType'], title: string, actors: number[], o: Partial<ComboStep> = {}): ComboStep {
  return { id: uid('s'), order: 0, actionType, actorCardIds: actors, title, description: title, ...o };
}

export const when = (...clauses: Array<[number[], number?]>): HandClause[] => clauses.map(([anyOf, count]) => ({ anyOf, count: count ?? 1 }));

export function branch(label: string, w: HandClause[] | null, steps: ComboStep[], outcome?: 'success' | 'fail'): RouteBranch {
  return { id: uid('b'), label, when: w, steps, ...(outcome ? { outcome } : {}) };
}

/** Gives every step list (the main line and each branch) the orders 1..N the schema demands. */
function numbered(steps: ComboStep[]): ComboStep[] {
  return steps.map((s, i) => ({ ...s, order: i + 1, ...(s.branches ? { branches: s.branches.map((b) => ({ ...b, steps: numbered(b.steps) })) } : {}) }));
}

export function plan(name: string, hand: number[], steps: ComboStep[], o: { ftk?: FtkInfo; schemaVersion?: 1 | 2 } = {}): ComboRoute {
  const counts = new Map<number, number>();
  for (const id of hand) counts.set(id, (counts.get(id) ?? 0) + 1);
  return {
    schemaVersion: o.schemaVersion ?? 2,
    id: uid('plan'),
    version: 1,
    name,
    archetype: 'Banquet FTK',
    format: 'master-duel',
    conditions: { handAllOf: [...counts].map(([id, count]) => ({ anyOf: [id], count })), setup: { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true } },
    steps: numbered(steps),
    endBoard: [],
    ...(o.ftk ? { ftk: o.ftk } : {}),
    verification: { status: 'unverified' },
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  };
}

/** The opening hand of the plans below (Contract with Don Thousand is NOT in it, so it has to be drawn). */
export const HAND = [C.chicken, C.dealings, C.banquet, C.dynamite, C.evenly];

const activateChicken = () => st('activate', '發動 Chicken Game', [C.chicken], { moves: mv([[C.chicken, 'hand', 'field']]) });
const contractKill = () => st('activate', '發動 Contract with Don Thousand（雙方失去 1000 LP）', [C.contract], { effectRef: `${C.contract}#1`, moves: mv([[C.contract, 'hand', 'field']]) });

/**
 * Chicken Game: pay 1000 LP, draw 1. Drew Contract → it takes 1000 from the opponent; otherwise nothing more. With a target of
 * 1000 (not 8000) this is a complete, valid plan: it works exactly when the one Contract in the deck is the card drawn.
 */
export function oneDrawPlan(o: { target?: number; claim?: 'success' | 'fail' } = {}): ComboRoute {
  const draw = st('draw', 'Chicken Game：付 1000 LP 抽 1 張', [C.chicken], { effectRef: `${C.chicken}#1`, random: { count: 1, to: 'hand' } });
  draw.branches = [branch('抽到 Contract with Don Thousand', when([[C.contract]]), [contractKill()], o.claim ?? 'success'), branch('否則', null, [], 'fail')];
  return plan('Chicken Game → Contract', HAND, [activateChicken(), draw], { ftk: { targetDamage: o.target ?? 1000, opponentExtraDeck: 15 } });
}

/** A second draw in the "otherwise" branch (Dark World Dealings): the chance of the one Contract is 1/35 + 34/35 × 1/34 = 2/35. */
export function twoDrawPlan(): ComboRoute {
  const second = st('draw', 'Dark World Dealings：雙方各抽 1 張', [C.dealings], { random: { count: 1, to: 'hand' } });
  second.branches = [branch('抽到 Contract with Don Thousand', when([[C.contract]]), [contractKill()], 'success'), branch('否則', null, [], 'fail')];
  const first = st('draw', 'Chicken Game：付 1000 LP 抽 1 張', [C.chicken], { effectRef: `${C.chicken}#1`, random: { count: 1, to: 'hand' } });
  const dealings = st('activate', '發動 Dark World Dealings（丟 1 張手牌）', [C.dealings], { moves: mv([[C.dealings, 'hand', 'gy'], [C.evenly, 'hand', 'gy']]) });
  first.branches = [branch('抽到 Contract with Don Thousand', when([[C.contract]]), [contractKill()], 'success'), branch('否則', null, [dealings, second], 'fail')];
  return plan('Chicken Game → Dark World Dealings → Contract', HAND, [activateChicken(), first], { ftk: { targetDamage: 1000, opponentExtraDeck: 15 } });
}

// ---- the same plan as a model would answer it (the flat shape of `FTK_JSON_SCHEMA`) ---------------------------------

type FlatMove = { cardId: number; from: PlayZone; to: PlayZone; slot: string };
const flat = (o: Partial<Record<string, unknown>> & { actionType: string; title: string; actorCardIds: number[] }) => ({
  description: o['title'],
  targetCardIds: [],
  materialCardIds: [],
  cost: '',
  effect: '',
  result: '',
  uncertainty: '',
  effectRef: '',
  moves: [] as FlatMove[],
  drawCount: 0,
  drawTo: '',
  claimedDamage: -1,
  ...o,
});
const fm = (cardId: number, from: PlayZone, to: PlayZone): FlatMove => ({ cardId, from, to, slot: '' });

/**
 * A HAND-WRITTEN stand-in for a model answer on the reference deck: Chicken Game draws 1; if it is Contract with Don Thousand
 * the plan activates it and CLAIMS success. The program works out that this takes only 1000 of the 8000 Life Points.
 */
export function banquetAnswer(o: { specifiedDraw?: boolean; cycle?: boolean; missingSegment?: boolean } = {}): Record<string, unknown> {
  const draw = flat({ actionType: 'draw', title: 'Chicken Game：付 1000 LP 抽 1 張', actorCardIds: [C.chicken], effectRef: `${C.chicken}#1`, drawCount: 1, drawTo: 'hand', moves: o.specifiedDraw ? [fm(C.contract, 'deck', 'hand')] : [] });
  return {
    summary: '手寫的測試答案（不是模型輸出）',
    plans: [
      {
        name: 'Chicken Game → Contract',
        handCardIds: HAND,
        preconditions: ['先攻、雙方空場、無干擾'],
        segments: [
          {
            id: 'main',
            steps: [flat({ actionType: 'activate', title: '發動 Chicken Game', actorCardIds: [C.chicken], moves: [fm(C.chicken, 'hand', 'field')] }), draw],
            branches: [
              { label: '抽到 Contract with Don Thousand', when: [{ anyOf: [C.contract], count: 1 }], outcome: 'success', next: o.missingSegment ? 'nowhere' : 'hit' },
              { label: '否則', when: [], outcome: 'fail', next: o.cycle ? 'main' : '' },
            ],
          },
          { id: 'hit', steps: [flat({ actionType: 'activate', title: '發動 Contract with Don Thousand', actorCardIds: [C.contract], effectRef: `${C.contract}#1`, moves: [fm(C.contract, 'hand', 'field')] })], branches: [] },
        ],
        pros: [],
        cons: ['只有 1 張 Contract'],
      },
    ],
  };
}
