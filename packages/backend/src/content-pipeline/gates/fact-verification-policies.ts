/**
 * Policies for Gate A when not every sentence can be backed solely by MCP JSON.
 *
 * MCP remains the source of truth for PropertyIQ-specific metrics (scores,
 * rents, HUD-style fields present in the bundle).
 *
 * Other verification layers you can add later without changing handler shape:
 * - Census / ACS API lookup for demographic claims
 * - Curated allowlist CSV (metro_id → canonical sentence IDs)
 * - Secondary LLM judge: "flag only claims that contradict the bundle"
 *
 * Those plug in beside {@link waiveUnmatchedLongFormGeneralKnowledge} —
 * compose waivers explicitly and record them on {@link GateResult}.
 */
import type { GateViolation } from './gate.types';

/** Options passed from verify-data handler into DataVerifierService.verify(). */
export interface DataVerifierVerifyOptions {
  /** `content_runs.format` — drives format-specific waiver + numeric helpers. */
  contentFormat?: string;
}

/**
 * Derived numbers so script phrases like "9.3 million people" match bundle
 * integers such as 9300000 without loosening tolerance heuristics globally.
 */
export function augmentCandidatesWithPopulationScales(nums: number[]): number[] {
  const extra: number[] = [];
  for (const n of nums) {
    if (typeof n === 'number' && Number.isFinite(n)) {
      if (Math.abs(n) >= 100_000) {
        extra.push(n / 1_000_000);
        extra.push(Math.round((n / 1_000_000) * 10) / 10);
      }
    }
  }
  return [...nums, ...extra];
}

/**
 * Waive Gate A failures for narrowly-scoped unmatched claims that commonly
 * reference US-wide metro stature — facts that intentionally do not appear in
 * the PIQ MCP snapshot.
 *
 * Only unmatched violations; never waives contradictory or tolerance failures.
 */
export function waiveUnmatchedLongFormGeneralKnowledge(
  v: GateViolation,
): boolean {
  if (v.reason !== 'unmatched') return false;

  const q = v.claim.quote;
  const cat = v.claim.category;

  const usOrCountryContext =
    /\b(U\.S\.|US|United\s+States|America|nationwide|national|the\s+country|this\s+country|nation)\b/i;
  const usMetroOrdinal =
    usOrCountryContext.test(q) &&
    /\b(1st|2nd|3rd|4th|5th|first|second|third|fourth|fifth)\b/i.test(q) &&
    /\b(largest|biggest)\b/i.test(q) &&
    /\b(metro|MSA|metropolitan(\s+area)?)\b/i.test(q);

  if (cat === 'ranking' && usMetroOrdinal) return true;

  return false;
}
