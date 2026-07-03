/**
 * PropertyIQ Scoring — Map-Display Row Mapper
 *
 * The byte-identical row projection shared by getAllScores (all=true) and
 * streamAllScores. Extracted verbatim to de-dup one mapper; the produced shape
 * and key order are unchanged, so the JSON emitted by both callers is identical.
 */

import { ScoreType } from './formula-weights';
import { ScorePageRow } from './scoring-queries-pagination';
import { AllScoresRow } from './scoring-response.types';

export function mapScoreRow(
  item: ScorePageRow,
  date: string | undefined,
  type: ScoreType,
): AllScoresRow {
  return {
    region_id: item.location_id,
    region_name: item.location_name,
    value: item.score,
    grade: item.grade,
    confidence: item.confidence,
    confidence_level: item.confidence_level,
    date: date || undefined,
    score_type: type,
  };
}
