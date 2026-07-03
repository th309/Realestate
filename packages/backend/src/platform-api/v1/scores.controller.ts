/**
 * Platform API v1 - Scores Controller
 *
 * Exposes the unified PropertyIQ Score to external consumers via
 * API-key-authenticated endpoints. Old score types (homeready, investoredge,
 * markethealth) are accepted for backward compatibility and mapped to
 * 'propertyiq'.
 *
 * Endpoints:
 *   GET /api/v1/scores/:geoLevel/:geoId          - All scores for a geography
 *   GET /api/v1/scores/:geoLevel/:geoId/:scoreType - Single score type
 */

import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UseFilters,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyAuthGuard } from '../../org-api-keys/api-key-auth.guard';
import { ApiThrottleGuard } from '../api-throttle.guard';
import { ApiResponseInterceptor } from '../api-response.interceptor';
import { PlatformApiExceptionFilter } from '../platform-api-exception.filter';
import { ApiKeyValidatorService } from '../../org-api-keys/api-key-validator.service';
import { ScoringService } from '../../scoring/scoring.service';
import { getScoreMomentumLabel } from '../../scoring/score-label.util';
import type { GeographyLevel, ScoreType } from '../../scoring/formula-weights';

const VALID_GEO_LEVELS: GeographyLevel[] = ['metro', 'county', 'zip'];
const VALID_SCORE_TYPES: ScoreType[] = ['propertyiq'];

/** Old score types accepted for backward compatibility, mapped to 'propertyiq'. */
const LEGACY_SCORE_TYPE_MAP: Record<string, ScoreType> = {
  homeready: 'propertyiq',
  investoredge: 'propertyiq',
  markethealth: 'propertyiq',
};

/** Normalize a score type param, supporting legacy names. */
function normalizeScoreType(raw: string): ScoreType | null {
  if (VALID_SCORE_TYPES.includes(raw as ScoreType)) return raw as ScoreType;
  return LEGACY_SCORE_TYPE_MAP[raw] ?? null;
}

@Controller('api/v1/scores')
@UseFilters(PlatformApiExceptionFilter)
@UseGuards(ApiKeyAuthGuard, ApiThrottleGuard)
@UseInterceptors(ApiResponseInterceptor)
export class ScoresV1Controller {
  constructor(
    private readonly apiKeyValidator: ApiKeyValidatorService,
    private readonly scoringService: ScoringService,
  ) {}

  /**
   * GET /api/v1/scores/:geoLevel/:geoId
   *
   * Returns all score types for a single geography.
   */
  @Get(':geoLevel/:geoId')
  async getScores(
    @Param('geoLevel') geoLevel: string,
    @Param('geoId') geoId: string,
    @Req() request: any,
  ) {
    this.apiKeyValidator.checkScope(request.apiKeyOrg.scopes, 'scores:read');
    this.validateGeoLevel(geoLevel);

    const result = await this.scoringService.getScore(
      geoId,
      geoLevel as GeographyLevel,
      undefined,
      { components: true },
    );

    if (!result) {
      throw new NotFoundException({
        code: 'SCORE_NOT_FOUND',
        message: `No scores found for ${geoLevel} ${geoId}`,
      });
    }

    return this.formatScoreResponse(result, geoLevel, geoId);
  }

  /**
   * GET /api/v1/scores/:geoLevel/:geoId/:scoreType
   *
   * Returns a single score type for a geography.
   */
  @Get(':geoLevel/:geoId/:scoreType')
  async getScoreByType(
    @Param('geoLevel') geoLevel: string,
    @Param('geoId') geoId: string,
    @Param('scoreType') scoreType: string,
    @Req() request: any,
  ) {
    this.apiKeyValidator.checkScope(request.apiKeyOrg.scopes, 'scores:read');
    this.validateGeoLevel(geoLevel);
    const normalized = this.validateScoreType(scoreType);

    const result = await this.scoringService.getScore(
      geoId,
      geoLevel as GeographyLevel,
      undefined,
      { components: true },
    );

    if (!result) {
      throw new NotFoundException({
        code: 'SCORE_NOT_FOUND',
        message: `No scores found for ${geoLevel} ${geoId}`,
      });
    }

    const singleScore = result.scores[normalized];
    if (!singleScore) {
      throw new NotFoundException({
        code: 'SCORE_TYPE_NOT_FOUND',
        message: `No ${normalized} score found for ${geoLevel} ${geoId}`,
      });
    }

    return {
      geography: {
        level: geoLevel,
        id: geoId,
        name: result.location_name,
      },
      scores: {
        [normalized]: this.formatSingleScore(singleScore, result.score_date),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private validateGeoLevel(geoLevel: string): void {
    if (!VALID_GEO_LEVELS.includes(geoLevel as GeographyLevel)) {
      throw new BadRequestException({
        code: 'INVALID_GEO_LEVEL',
        message: `Invalid geography level '${geoLevel}'. Must be one of: ${VALID_GEO_LEVELS.join(', ')}`,
      });
    }
  }

  private validateScoreType(scoreType: string): ScoreType {
    const normalized = normalizeScoreType(scoreType);
    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_SCORE_TYPE',
        message: `Invalid score type '${scoreType}'. Must be one of: propertyiq`,
      });
    }
    return normalized;
  }

  private formatScoreResponse(result: any, geoLevel: string, geoId: string) {
    const scores: Record<string, any> = {};

    for (const type of VALID_SCORE_TYPES) {
      const scoreData = result.scores[type];
      if (scoreData) {
        scores[type] = this.formatSingleScore(scoreData, result.score_date);
      }
    }

    return {
      geography: {
        level: geoLevel,
        id: geoId,
        name: result.location_name,
      },
      scores,
    };
  }

  private formatSingleScore(scoreData: any, scoreDate: string) {
    return {
      value: scoreData.score,
      label: getScoreMomentumLabel(scoreData.score),
      grade: scoreData.grade,
      confidence: {
        level: scoreData.confidence_level,
        percentage: scoreData.confidence,
      },
      components: scoreData.components ?? null,
      updated_at: scoreDate,
    };
  }
}
