/**
 * Pure confidence-grade derivation for analyzer prefill fields.
 *
 * Grades read identically to the PropertyIQ score grades (A ≥80, B 65–79,
 * C 45–64, F <45 — matching app/components/scoring/ConfidenceDisplay).
 * Kept side-effect-free (no Date) so it is fully unit-testable; the caller
 * computes `monthsStale` from the as-of date.
 */
export type ConfidenceGrade = 'a' | 'b' | 'c' | 'f';
export interface GradeResult {
  grade: ConfidenceGrade;
  pct: number;
}

export type PrefillGeoLevel =
  | 'parcel'
  | 'zip'
  | 'county'
  | 'metro'
  | 'state'
  | null;

const SPECIFICITY_PENALTY: Record<Exclude<PrefillGeoLevel, null>, number> = {
  parcel: 0,
  zip: 5,
  county: 20,
  metro: 30,
  state: 45,
};

const FRESHNESS_GRACE_MONTHS = 3;
const FRESHNESS_PENALTY_PER_MONTH = 2;
const FRESHNESS_PENALTY_CAP = 30;
const FALLBACK_PENALTY = 10;

export function pctToGrade(pct: number): ConfidenceGrade {
  if (pct >= 80) return 'a';
  if (pct >= 65) return 'b';
  if (pct >= 45) return 'c';
  return 'f';
}

export function gradeDataField(opts: {
  geoLevel: PrefillGeoLevel;
  monthsStale: number;
  isFallback: boolean;
  /** Optional hard ceiling, e.g. free-tier ZHVI price proxy capped at 60. */
  capPct?: number;
}): GradeResult {
  const specificity =
    opts.geoLevel == null
      ? SPECIFICITY_PENALTY.state
      : SPECIFICITY_PENALTY[opts.geoLevel];
  const freshness = Math.min(
    FRESHNESS_PENALTY_CAP,
    Math.max(0, opts.monthsStale - FRESHNESS_GRACE_MONTHS) *
      FRESHNESS_PENALTY_PER_MONTH,
  );
  const fallback = opts.isFallback ? FALLBACK_PENALTY : 0;

  let pct = 100 - specificity - freshness - fallback;
  if (opts.capPct != null) pct = Math.min(pct, opts.capPct);
  pct = Math.max(1, Math.min(100, Math.round(pct)));
  return { grade: pctToGrade(pct), pct };
}

export function gradeEstimate(kind: 'constant' | 'market'): GradeResult {
  return kind === 'market' ? { grade: 'c', pct: 50 } : { grade: 'f', pct: 35 };
}
