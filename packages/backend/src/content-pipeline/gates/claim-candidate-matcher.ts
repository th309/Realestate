// packages/backend/src/content-pipeline/gates/claim-candidate-matcher.ts
import type { NumericClaim } from './gate.types';

// Categories whose sign is normally carried by the surrounding prose
// ("down 2.28%", "fell 5 points") rather than by the number itself.
const SIGN_AGNOSTIC_CATEGORIES: ReadonlySet<NumericClaim['category']> = new Set(
  ['count', 'duration', 'percentage', 'score'],
);

/**
 * The first bundle value a claim can legitimately be quoting, or `undefined`
 * when nothing in the data lands within tolerance.
 */
export function findMatchingCandidate(
  claim: NumericClaim,
  candidates: number[],
  tolerance: number,
): number | undefined {
  return candidates.find((n) => {
    if (Math.abs(n - claim.value) <= tolerance) return true;
    if (SIGN_AGNOSTIC_CATEGORIES.has(claim.category)) {
      return Math.abs(Math.abs(n) - Math.abs(claim.value)) <= tolerance;
    }
    return false;
  });
}
