import { ComboRoute, ComboStep, HandClause, RouteBranch } from './models';

// B7: routes may branch after a random step. These helpers walk that tree without knowing anything about the rules.

/** Every step of a list and of all its branches, depth first, in reading order. */
export function allSteps(steps: readonly ComboStep[]): ComboStep[] {
  return steps.flatMap((s) => [s, ...(s.branches ?? []).flatMap((b) => allSteps(b.steps))]);
}

/** Every step list of the route (the main line and each branch's continuation). */
export function stepLists(steps: readonly ComboStep[]): ComboStep[][] {
  return [[...steps], ...steps.flatMap((s) => (s.branches ?? []).flatMap((b) => stepLists(b.steps)))];
}

export const hasBranches = (route: Pick<ComboRoute, 'steps'>) => allSteps(route.steps).some((s) => s.branches?.length);

/** Features only a version 2 route may use: random steps, branches, the FTK block. */
export function usesV2Features(route: Pick<ComboRoute, 'steps' | 'ftk'>): boolean {
  return !!route.ftk || allSteps(route.steps).some((s) => s.random || s.branches?.length || s.actionType === 'draw' || s.actionType === 'excavate' || s.claimedDamage !== undefined);
}

/** Every card id the branch conditions mention. */
export function branchConditionIds(route: Pick<ComboRoute, 'steps'>): number[] {
  return allSteps(route.steps).flatMap((s) => (s.branches ?? []).flatMap((b) => (b.when ?? []).flatMap((c) => c.anyOf)));
}

export function branchesOf(step: ComboStep): readonly RouteBranch[] {
  return step.branches ?? [];
}

export const clauseText = (clauses: readonly HandClause[], name: (id: number) => string): string =>
  clauses.map((c) => `${c.anyOf.map((id) => `「${name(id)}」`).join('或')}${c.count > 1 ? `×${c.count}` : ''}`).join('＋');
