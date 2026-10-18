import { DeckRecord } from '../models';

// CR-006: what the analysis should prefer. A goal is a search preference — never a requirement
// that every route must meet, and never a reason to bend a rule or the deck's resources.

export const GOAL_KINDS = ['interruptions', 'targets', 'resources', 'diverse', 'balanced'] as const;

export type AnalysisGoalKind = (typeof GOAL_KINDS)[number];

export interface AnalysisGoal {
  kind: AnalysisGoalKind;
  /** Extra Deck monsters to evaluate first (only those in the analysed deck's Extra Deck count). */
  preferredExtraIds: number[];
}

export const DEFAULT_GOAL: AnalysisGoal = { kind: 'interruptions', preferredExtraIds: [] };

export const GOAL_LABEL: Record<AnalysisGoalKind, string> = {
  interruptions: 'A 最大化終場有效干擾能力',
  targets: 'B 優先達成指定終場怪獸',
  resources: 'C 保留最多手牌及後續資源',
  diverse: 'D 探索不同類型的可行終場',
  balanced: 'E 兼顧干擾與續航',
};

/** Instruction for the model (English, like the rest of the prompt). */
export const GOAL_PROMPT: Record<AnalysisGoalKind, string> = {
  interruptions: 'maximise the number of interruptions that really work on the opponent\'s turn with the final board',
  targets: 'reach end boards that keep the preferred Extra Deck monsters on the field (when the rules and the deck\'s resources allow it); other strong end boards are still welcome',
  resources: 'keep as many cards in hand and as many follow-up resources as possible while still ending on a playable board',
  diverse: 'explore different kinds of end boards; prefer variety over small variations of the same board',
  balanced: 'balance the interruptions that really work on the opponent\'s turn with the resources kept for the following turns (cards in hand, Set Spells/Traps, cards that can act again from the Graveyard or banished zone)',
};

export function normalizeGoal(goal: Partial<AnalysisGoal> | undefined): AnalysisGoal {
  const kind = GOAL_KINDS.includes(goal?.kind as AnalysisGoalKind) ? (goal!.kind as AnalysisGoalKind) : DEFAULT_GOAL.kind;
  const ids = Array.isArray(goal?.preferredExtraIds) ? goal!.preferredExtraIds.filter((id) => Number.isInteger(id) && id > 0) : [];
  return { kind, preferredExtraIds: [...new Set(ids)].slice(0, 15) };
}

/** The goal as it applies to `deck`: preferred monsters outside its Extra Deck are dropped. */
export function goalForDeck(goal: AnalysisGoal, deck: Pick<DeckRecord, 'extra'>): AnalysisGoal {
  const extra = new Set(deck.extra.filter((r) => r.count > 0).map((r) => r.cardId));
  return { kind: goal.kind, preferredExtraIds: goal.preferredExtraIds.filter((id) => extra.has(id)) };
}
