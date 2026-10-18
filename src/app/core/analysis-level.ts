import { ParsedDeck } from './deck';
import { verificationProblem } from './matcher';
import { AnalysisLevel, ComboRoute } from './models';
import { RouteCheckOptions, checkRoute } from './route-check';

/**
 * CR-004 trust level of a route against a deck, always recomputed (stored check results and
 * imported files cannot raise it). "engine-verified" is never returned: the rules engine is
 * not integrated. Returns null for a hand-written route that is not human-verified for `deck`.
 */
export function analysisLevel(route: ComboRoute, deck: Pick<ParsedDeck, 'main' | 'extra'> | null, options: RouteCheckOptions = {}): AnalysisLevel | null {
  if (deck && route.verification.status === 'verified' && verificationProblem(route, deck) === null) return 'md-confirmed';
  if (!route.analysis) return null;
  if (!deck) return 'ai-candidate';
  return checkRoute(route, deck, options).passed ? 'data-checked' : 'ai-candidate';
}
