/**
 * PropertyIQ Scoring — Point / Batch / Path Score Read Handlers
 *
 * The tier-gated score-read handler bodies extracted verbatim from
 * ScoringController (getScores, getBatchScores, getScoreByPath). Only the
 * `this.<service>` references became explicit parameters — no logic, error
 * message, or response shape changed. The controller methods keep their route
 * decorators and delegate straight to these functions.
 */

import { HttpException, HttpStatus } from '@nestjs/common';
import { ScoringService, ScoreResult } from './scoring.service';
import { ScoreAccessService } from './scoring.guard';
import { parseHistoryMonths } from '../common/history.constants';
import { validateGeography } from './scoring-request.helpers';
import { stripBreakdownIfNeeded } from './score-breakdown.helper';

/**
 * Get scores for a specific location.
 *
 * Response format (from spec):
 * {
 *   "location_id": "12420",
 *   "location_name": "Austin-Round Rock, TX",
 *   "geography": "metro",
 *   "median_price": 420644,
 *   "scores": {
 *     "homeready": { "score": 13, "grade": "F", "confidence": 86, "confidence_level": "HIGH" },
 *     "investoredge": { "score": 32, "grade": "F", "confidence": 90, "confidence_level": "HIGH" },
 *     "markethealth": { "score": 8, "grade": "F", "confidence": 79, "confidence_level": "MEDIUM" }
 *   }
 * }
 */
export async function getScoresHandler(
  scoringService: ScoringService,
  scoreAccessService: ScoreAccessService,
  geography: string,
  locationId: string,
  date?: string,
  historyMonths?: string,
  request?: any,
): Promise<ScoreResult> {
  if (!geography) {
    throw new HttpException(
      'geography query parameter is required',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!locationId) {
    throw new HttpException(
      'location_id query parameter is required',
      HttpStatus.BAD_REQUEST,
    );
  }

  const geoLevel = validateGeography(geography);
  const options =
    historyMonths != null
      ? { historyMonths: parseHistoryMonths(historyMonths) }
      : undefined;
  const score = await scoringService.getScore(
    locationId,
    geoLevel,
    date,
    options,
  );

  if (!score) {
    throw new HttpException(
      `No scores found for ${geography}/${locationId}. Try triggering a calculation first.`,
      HttpStatus.NOT_FOUND,
    );
  }

  return await stripBreakdownIfNeeded(score, request, scoreAccessService);
}

/**
 * Get scores for multiple locations (batch). Each ID resolves independently;
 * failures degrade to a per-ID error entry rather than failing the whole batch.
 */
export async function getBatchScoresHandler(
  scoringService: ScoringService,
  scoreAccessService: ScoreAccessService,
  geography: string,
  ids: string,
  date?: string,
  historyMonths?: string,
  request?: any,
): Promise<{
  geography: string;
  scores: (ScoreResult | { location_id: string; error: string })[];
}> {
  if (!ids) {
    throw new HttpException(
      'ids query parameter is required',
      HttpStatus.BAD_REQUEST,
    );
  }

  const geoLevel = validateGeography(geography);
  const locationIds = ids
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id);
  const options =
    historyMonths != null
      ? { historyMonths: parseHistoryMonths(historyMonths) }
      : undefined;

  if (locationIds.length === 0) {
    throw new HttpException(
      'At least one location ID is required',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (locationIds.length > 100) {
    throw new HttpException(
      'Maximum 100 locations per batch',
      HttpStatus.BAD_REQUEST,
    );
  }

  const scores = await Promise.all(
    locationIds.map(async (id) => {
      try {
        const score = await scoringService.getScore(
          id,
          geoLevel,
          date,
          options,
        );
        if (!score) return { location_id: id, error: 'Score not found' };
        return await stripBreakdownIfNeeded(score, request, scoreAccessService);
      } catch {
        return { location_id: id, error: 'Failed to retrieve score' };
      }
    }),
  );

  return { geography, scores };
}

/**
 * Get score by path (legacy format).
 *
 * Query params:
 * - historyMonths: 0-6 for short-term trend data
 * - historyYears: 3 or 5 for extended history with outcomes
 * - includeOutcomes: true to include actual returns and benchmark comparisons
 */
export async function getScoreByPathHandler(
  scoringService: ScoringService,
  scoreAccessService: ScoreAccessService,
  geography: string,
  locationId: string,
  date?: string,
  historyMonths?: string,
  historyYears?: string,
  includeOutcomes?: string,
  request?: any,
): Promise<ScoreResult> {
  const geoLevel = validateGeography(geography);

  // If extended history requested, use the new method
  if (historyYears && parseInt(historyYears, 10) > 0) {
    const years = Math.min(Math.max(parseInt(historyYears, 10), 1), 5);
    const score = await scoringService.getScoreWithExtendedHistory(
      locationId,
      geoLevel,
      {
        historyYears: years,
        includeOutcomes: includeOutcomes === 'true',
      },
    );

    if (!score) {
      throw new HttpException(
        `No scores found for ${geography}/${locationId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    return await stripBreakdownIfNeeded(score, request, scoreAccessService);
  }

  // Otherwise use standard method
  const options =
    historyMonths != null
      ? { historyMonths: parseHistoryMonths(historyMonths) }
      : undefined;
  const score = await scoringService.getScore(
    locationId,
    geoLevel,
    date,
    options,
  );

  if (!score) {
    throw new HttpException(
      `No scores found for ${geography}/${locationId}`,
      HttpStatus.NOT_FOUND,
    );
  }

  return await stripBreakdownIfNeeded(score, request, scoreAccessService);
}
