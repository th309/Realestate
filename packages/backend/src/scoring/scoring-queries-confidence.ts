/**
 * Scoring Queries — Confidence Normalization
 *
 * Shared internal helper for scoring-queries modules. Maps legacy
 * confidence_level values stored on older DB rows to the current A/B/C/F
 * format. Used by both the single-location assembly and paginated reads.
 */

import { ConfidenceLevel } from './formula-weights';

/**
 * Normalize confidence_level from DB to the current A/B/C/F format.
 * Handles legacy values (HIGH/MEDIUM/LOW/INSUFFICIENT) from rows
 * calculated before the confidence formula was updated.
 */
const LEGACY_CONFIDENCE_MAP: Record<string, ConfidenceLevel> = {
  HIGH: 'A',
  MEDIUM: 'B',
  LOW: 'C',
  INSUFFICIENT: 'F',
};

export function normalizeConfidenceLevel(
  raw: string | null | undefined,
): ConfidenceLevel {
  if (!raw) return 'F';
  // Already new format
  if (raw === 'A' || raw === 'B' || raw === 'C' || raw === 'F') return raw;
  // Legacy format
  return LEGACY_CONFIDENCE_MAP[raw] ?? 'F';
}
