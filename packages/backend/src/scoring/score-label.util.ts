/**
 * Canonical PropertyIQ momentum score label — backend mirror of the frontend
 * source of truth `getScoreLabel` in
 * packages/frontend/app/components/scoring/ScoreDisplay.tsx.
 *
 * The PropertyIQ Score is a demand-MOMENTUM / timing signal, NOT a quality
 * grade — the labels describe the market's current demand TREND (where it's
 * heading), not whether it is a "good" or "bad" market. A low score means
 * cooling momentum, not a poor-quality market. 50 = the market's state average
 * ("STEADY"). NEVER reintroduce quality words (EXCELLENT/GOOD/POOR/etc.).
 * See CLAUDE.md §9.
 *
 * Any backend surface that emits a score label (Platform API, content
 * pipeline, MCP content tools) MUST use this util so the ladder stays in one
 * place and cannot drift back to the retired quality-word table.
 */
export function getScoreMomentumLabel(score: number): string {
  if (score >= 90) return 'VERY STRONG';
  if (score >= 80) return 'STRONG';
  if (score >= 70) return 'RISING';
  if (score >= 60) return 'FIRMING';
  if (score >= 50) return 'STEADY';
  if (score >= 40) return 'EASING';
  if (score >= 20) return 'WEAK';
  return 'VERY WEAK';
}

/**
 * Neutral label for a geography with NO score data. A missing score has no
 * momentum to describe, so it must NOT borrow a ladder word (emitting
 * "VERY WEAK" would wrongly imply cooling momentum). Pairs with grade 'N/A'.
 */
export const NO_SCORE_LABEL = 'Unrated';
