/**
 * Platform API v1 - Rankings Controller
 *
 * Returns ranked lists of geographies by PropertyIQ score type.
 * Queries the propertyiq_scores table for the latest scores, ordered
 * by overall_score.
 *
 * Endpoint:
 *   GET /api/v1/rankings/:scoreType/:geoLevel
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Inject,
  UseGuards,
  UseInterceptors,
  UseFilters,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { ApiKeyAuthGuard } from '../../org-api-keys/api-key-auth.guard';
import { ApiThrottleGuard } from '../api-throttle.guard';
import { ApiResponseInterceptor } from '../api-response.interceptor';
import { PlatformApiExceptionFilter } from '../platform-api-exception.filter';
import { ApiKeyValidatorService } from '../../org-api-keys/api-key-validator.service';
import type { GeographyLevel, ScoreType } from '../../scoring/formula-weights';

const VALID_GEO_LEVELS: GeographyLevel[] = ['metro', 'county', 'zip'];
const VALID_SCORE_TYPES: ScoreType[] = ['propertyiq'];

/** Old score types accepted for backward compatibility, mapped to 'propertyiq'. */
const LEGACY_SCORE_TYPE_MAP: Record<string, ScoreType> = {
  homeready: 'propertyiq',
  investoredge: 'propertyiq',
  markethealth: 'propertyiq',
};

const DEFAULT_RANKING_LIMIT = 25;
const MAX_RANKING_LIMIT = 100;

@Controller('api/v1/rankings')
@UseFilters(PlatformApiExceptionFilter)
@UseGuards(ApiKeyAuthGuard, ApiThrottleGuard)
@UseInterceptors(ApiResponseInterceptor)
export class RankingsV1Controller {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly apiKeyValidator: ApiKeyValidatorService,
  ) {}

  /**
   * GET /api/v1/rankings/:scoreType/:geoLevel
   *
   * Returns a ranked list of geographies sorted by score.
   *
   * Query params:
   *   limit - Number of results (default 25, max 100)
   *   order - Sort direction: 'asc' or 'desc' (default 'desc')
   *   state - Optional state abbreviation filter (e.g. 'TX')
   */
  @Get(':scoreType/:geoLevel')
  async getRankings(
    @Param('scoreType') scoreType: string,
    @Param('geoLevel') geoLevel: string,
    @Query('limit') limitParam: string | undefined,
    @Query('order') orderParam: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: any,
  ) {
    this.apiKeyValidator.checkScope(request.apiKeyOrg.scopes, 'rankings:read');
    const normalizedScoreType = this.validateScoreType(scoreType);
    this.validateGeoLevel(geoLevel);

    const limit = this.parseLimit(limitParam);
    const ascending = orderParam === 'asc';

    // Get latest score date for this geography level
    const { data: dateRow } = await this.supabase
      .from('propertyiq_scores')
      .select('score_date')
      .eq('geography', geoLevel)
      .eq('score_type', normalizedScoreType)
      .order('score_date', { ascending: false })
      .limit(1);

    const latestDate = dateRow?.[0]?.score_date;
    if (!latestDate) {
      return {
        score_type: normalizedScoreType,
        geography_level: geoLevel,
        score_date: null,
        rankings: [],
        count: 0,
      };
    }

    let query = this.supabase
      .from('propertyiq_scores')
      .select(
        'location_id, location_name, score, grade, confidence, confidence_level',
      )
      .eq('geography', geoLevel)
      .eq('score_type', normalizedScoreType)
      .eq('score_date', latestDate)
      .order('score', { ascending })
      .limit(limit);

    // Optional state filter via name pattern (e.g. "%, TX" or ", TX")
    if (state) {
      const stateUpper = state.toUpperCase();
      query = query.ilike('location_name', `%, ${stateUpper}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException({
        code: 'QUERY_ERROR',
        message: `Failed to fetch rankings: ${error.message}`,
      });
    }

    const rows = data ?? [];

    return {
      score_type: normalizedScoreType,
      geography_level: geoLevel,
      score_date: latestDate,
      rankings: rows.map((row: any, index: number) => ({
        rank: index + 1,
        geography: {
          id: row.location_id,
          name: row.location_name,
        },
        score: row.score,
        grade: row.grade,
        confidence: {
          level: row.confidence_level,
          percentage: row.confidence,
        },
      })),
      count: rows.length,
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
    if (VALID_SCORE_TYPES.includes(scoreType as ScoreType))
      return scoreType as ScoreType;
    const mapped = LEGACY_SCORE_TYPE_MAP[scoreType];
    if (mapped) return mapped;
    throw new BadRequestException({
      code: 'INVALID_SCORE_TYPE',
      message: `Invalid score type '${scoreType}'. Must be one of: propertyiq`,
    });
  }

  private parseLimit(raw: string | undefined): number {
    if (!raw) return DEFAULT_RANKING_LIMIT;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 1) return DEFAULT_RANKING_LIMIT;
    return Math.min(parsed, MAX_RANKING_LIMIT);
  }
}
