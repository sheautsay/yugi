import { AnalysisGoal } from './ai/analysis-goal';
import { RouteEvaluation, compare, evaluateRoute, goalScore, targetCounts } from './ai/evaluate';
import { ParsedDeck } from './deck';
import { handRequirement, RouteResult } from './matcher';
import { CardRecord, ComboRoute } from './models';

// B1: the order of the battle mode. Only routes that match the hand (`available` = tested by the user on this deck,
// `unverified` = candidate or not tested yet) are ranked, by how strong their end board is for the chosen goal.
// Tested and untested routes are mixed; a test only wins a tie. The score is the one the analysis page uses
// (`goalScore`), never a second copy. Everything here is a static estimate, not a rules-engine result.

export type BattleKind = 'available' | 'unverified';

export interface BattleItem {
  route: ComboRoute;
  kind: BattleKind;
  evaluation: RouteEvaluation;
}

export interface BattleEntry extends BattleItem {
  /** The goal score list the order is based on (bigger is better, compared left to right). */
  score: number[];
  /** Tested by the user on this deck (shown as 「已實測」); otherwise an untested route / AI candidate. */
  verified: boolean;
  /** Opening cards the route needs. */
  handNeeded: number;
  /** How many other routes end on exactly the same board and were folded into this one. */
  sameEndBoard: number;
  /** The ids of the folded routes, best first. */
  foldedRouteIds: string[];
}

const nameOf = (r: ComboRoute) => r.name ?? '';

/** Ranks already evaluated routes; pure. Valid routes come first, then: score → tested (ties only) → fewer hand cards → name. */
export function rankEvaluated(items: readonly BattleItem[], goal: AnalysisGoal): BattleEntry[] {
  const rows = items.map((item) => {
    const { onBoard, intermediate } = targetCounts(item.evaluation, goal.preferredExtraIds);
    return {
      ...item,
      score: [item.evaluation.valid ? 1 : 0, ...goalScore(item.evaluation, goal, onBoard, intermediate)],
      verified: item.kind === 'available',
      handNeeded: handRequirement(item.route),
    };
  });
  rows.sort(
    (a, b) =>
      compare(a.score, b.score) ||
      Number(b.verified) - Number(a.verified) ||
      a.handNeeded - b.handNeeded ||
      nameOf(a.route).localeCompare(nameOf(b.route), 'zh-Hant') ||
      a.route.id.localeCompare(b.route.id),
  );

  const kept: BattleEntry[] = [];
  const bySignature = new Map<string, BattleEntry>();
  for (const row of rows) {
    const entry: BattleEntry = { ...row, sameEndBoard: 0, foldedRouteIds: [] };
    // A route whose checks failed, or whose end board is unknown (no card moves), is never folded into another.
    const signature = row.evaluation.valid ? row.evaluation.signature : '';
    const first = signature ? bySignature.get(signature) : undefined;
    if (first) {
      first.sameEndBoard += 1;
      first.foldedRouteIds.push(row.route.id);
      continue;
    }
    if (signature) bySignature.set(signature, entry);
    kept.push(entry);
  }
  return kept;
}

/** Ranks the routes that match the hand (from `matchRoutes()`); other kinds are ignored. */
export function rankForBattle(
  results: readonly RouteResult[],
  deck: Pick<ParsedDeck, 'main' | 'extra'>,
  cards: ReadonlyMap<number, CardRecord>,
  goal: AnalysisGoal,
  name?: (id: number) => string,
): BattleEntry[] {
  const items: BattleItem[] = results
    .filter((r): r is RouteResult & { match: { kind: BattleKind } } => r.match.kind === 'available' || r.match.kind === 'unverified')
    .map((r) => ({ route: r.route, kind: r.match.kind, evaluation: evaluateRoute(r.route, deck, cards, undefined, name) }));
  return rankEvaluated(items, goal);
}
