/**
 * Pure confidence % → star-count mapping.
 *
 * Extracted from ConfidenceDisplay.tsx (a "use client" component) so
 * non-React consumers — the Playwright fixture helpers in
 * tests/fixtures/mock-api-responses.ts — can import the SAME thresholds
 * instead of maintaining a hand-copied duplicate that silently drifts.
 * ConfidenceDisplay.tsx re-exports this unchanged, so every existing import
 * site keeps working (SSOT preserved, zero behavior change). Same pattern as
 * score-labels.ts for ScoreDisplay.tsx.
 */

/** Get the number of filled stars (1-5) for a confidence percentage (0-100). */
export function getStarCount(percentage: number): number {
  if (percentage >= 90) return 5;
  if (percentage >= 80) return 4;
  if (percentage >= 70) return 3;
  if (percentage >= 55) return 2;
  return 1;
}
