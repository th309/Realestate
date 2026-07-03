/**
 * PropertyIQ Scoring — Request Validators
 *
 * Pure request-parameter validators extracted verbatim from ScoringController.
 * They take no injected dependencies (only throw HttpException on bad input),
 * so they live here as free functions shared by every scoring controller.
 */

import { HttpException, HttpStatus } from '@nestjs/common';
import { GeographyLevel, ScoreType } from './formula-weights';

export function validateGeography(geography: string): GeographyLevel {
  const validLevels: GeographyLevel[] = ['metro', 'county', 'zip'];
  const lower = geography.toLowerCase() as GeographyLevel;

  if (!validLevels.includes(lower)) {
    throw new HttpException(
      `Invalid geography: ${geography}. Valid values: ${validLevels.join(', ')}`,
      HttpStatus.BAD_REQUEST,
    );
  }

  return lower;
}

export function validateScoreType(scoreType: string): ScoreType {
  const lower = scoreType.toLowerCase();

  // Map legacy score type names to propertyiq for backward compat
  const legacyMapping: Record<string, ScoreType> = {
    homeready: 'propertyiq',
    investoredge: 'propertyiq',
    markethealth: 'propertyiq',
    market_health: 'propertyiq',
    propertyiq: 'propertyiq',
  };

  const mapped = legacyMapping[lower];
  if (!mapped) {
    throw new HttpException(
      `Invalid score_type: ${scoreType}. Valid value: propertyiq`,
      HttpStatus.BAD_REQUEST,
    );
  }

  return mapped;
}

export function parseScoreTypes(scoreType: string): ScoreType[] {
  if (!scoreType) {
    throw new HttpException(
      'score_type query parameter is required',
      HttpStatus.BAD_REQUEST,
    );
  }
  const raw = scoreType.toLowerCase();
  if (raw === 'all') {
    return ['propertyiq'];
  }
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const valid = parts.map((p) => validateScoreType(p));
  // Deduplicate (legacy types all map to propertyiq)
  const unique = [...new Set(valid)];
  if (unique.length === 0) {
    throw new HttpException(
      'score_type must be propertyiq (or legacy: homeready, investoredge, markethealth)',
      HttpStatus.BAD_REQUEST,
    );
  }
  return unique;
}
