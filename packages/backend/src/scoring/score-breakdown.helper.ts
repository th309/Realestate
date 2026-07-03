/**
 * PropertyIQ Scoring — Breakdown Access Gate
 *
 * Extracted verbatim from ScoringController.stripBreakdownIfNeeded. The only
 * dependency is the injected ScoreAccessService, which is now passed as an
 * explicit parameter so every scoring controller can share one implementation.
 */

import { ScoreResult } from './scoring.service';
import { ScoreAccessService } from './scoring.guard';

/**
 * Strip score component breakdowns from response for users without access.
 * Scores (number, grade, confidence) are always visible — only `components` is gated.
 */
export async function stripBreakdownIfNeeded(
  result: ScoreResult,
  request: any,
  scoreAccessService: ScoreAccessService,
): Promise<ScoreResult> {
  const userTier = await scoreAccessService.resolveUserTier(request);
  const canBreakdown = await scoreAccessService.canAccessBreakdown(userTier);

  if (canBreakdown) return result;

  // User can't see breakdowns — strip components from all score types
  const scoreTypeKeys = [
    'homeready',
    'investoredge',
    'markethealth',
    'propertyiq',
  ] as const;
  const hasComponents = scoreTypeKeys.some(
    (st) => result.scores?.[st]?.components,
  );
  if (!hasComponents) return result;

  // Shallow-clone to avoid mutating cached service objects
  const stripped: ScoreResult = { ...result, scores: { ...result.scores } };
  for (const scoreType of scoreTypeKeys) {
    const scoreData = stripped.scores[scoreType];
    if (scoreData?.components) {
      stripped.scores[scoreType] = { ...scoreData };
      delete stripped.scores[scoreType].components;
    }
  }

  return stripped;
}
