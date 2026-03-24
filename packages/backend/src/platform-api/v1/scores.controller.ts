/**
 * Platform API v1 - Scores Controller
 *
 * Exposes PropertyIQ scores (HomeReady, InvestorEdge, MarketHealth) to
 * external consumers via API-key-authenticated endpoints.
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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyAuthGuard } from '../../org-api-keys/api-key-auth.guard';
import { ApiThrottleGuard } from '../api-throttle.guard';
import { ApiResponseInterceptor } from '../api-response.interceptor';
import { ApiKeyValidatorService } from '../../org-api-keys/api-key-validator.service';
import { ScoringService } from '../../scoring/scoring.service';
import type { GeographyLevel, ScoreType } from '../../scoring/formula-weights';

const VALID_GEO_LEVELS: GeographyLevel[] = ['metro', 'county', 'zip'];
const VALID_SCORE_TYPES: ScoreType[] = [
  'homeready',
  'investoredge',
  'markethealth',
];

/** Map score number to human-readable label. */
function scoreToLabel(score: number): string {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 80) return 'GREAT';
  if (score >= 70) return 'GOOD';
  if (score >= 60) return 'FAIR';
  if (score >= 50) return 'AVERAGE';
  if (score >= 40) return 'BELOW AVG';
  if (score >= 20) return 'POOR';
  return 'VERY POOR';
}

@Controller('api/v1/scores')
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
    this.validateScoreType(scoreType);

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

    const singleScore = result.scores[scoreType as ScoreType];
    if (!singleScore) {
      throw new NotFoundException({
        code: 'SCORE_TYPE_NOT_FOUND',
        message: `No ${scoreType} score found for ${geoLevel} ${geoId}`,
      });
    }

    return {
      geography: {
        level: geoLevel,
        id: geoId,
        name: result.location_name,
      },
      scores: {
        [scoreType]: this.formatSingleScore(singleScore, result.score_date),
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

  private validateScoreType(scoreType: string): void {
    if (!VALID_SCORE_TYPES.includes(scoreType as ScoreType)) {
      throw new BadRequestException({
        code: 'INVALID_SCORE_TYPE',
        message: `Invalid score type '${scoreType}'. Must be one of: ${VALID_SCORE_TYPES.join(', ')}`,
      });
    }
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
      label: scoreToLabel(scoreData.score),
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
