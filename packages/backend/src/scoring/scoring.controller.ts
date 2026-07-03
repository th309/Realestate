/**
 * PropertyIQ Scoring Controller — route declarations only; handler bodies live
 * in scoring-score-handlers.helper.ts and scoring-map-handlers.helper.ts.
 *
 * ROUTE-ORDERING HAZARD — READ BEFORE ADDING ROUTES:
 * `getScoreByPath` (`GET :geography/:locationId`) is a 2-segment CATCH-ALL and
 * MUST stay declared LAST in this class. Every other 2-segment GET on
 * `api/scores` (`all/:geography`, `ids/:geography`, `batch/:geography`) is kept
 * IN THIS SAME CLASS on purpose so their relative declaration order — and thus
 * NestJS route precedence — is fixed intra-class and immune to controller-array
 * ordering. This controller MUST be registered LAST in ScoringModule. Non-
 * colliding routes live in ScoringMarketsController / ScoringOperationsController.
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Header,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import type { Response } from 'express';
import { ScoringService, ScoreResult } from './scoring.service';
import { ScoreAccessService } from './scoring.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { SCORE_HISTORY_MONTHS_MAX } from './scoring.types';
import { AllScoresResponse, ScoredIdsResponse } from './scoring-response.types';
import {
  getScoresHandler,
  getBatchScoresHandler,
  getScoreByPathHandler,
} from './scoring-score-handlers.helper';
import {
  getAllScoresHandler,
  streamAllScoresHandler,
  getScoredIdsHandler,
  getScorePeriodsHandler,
} from './scoring-map-handlers.helper';

@ApiTags('scores')
@Controller('api/scores')
export class ScoringController {
  constructor(
    private readonly scoringService: ScoringService,
    private readonly scoreAccessService: ScoreAccessService,
  ) {}

  // ============================================================================
  // Main Score Endpoints (matching spec)
  // ============================================================================

  /**
   * Get scores for a specific location.
   * GET /api/scores?geography=metro&location_id=12420
   * (response shape documented on getScoresHandler)
   */
  @Get()
  // Sets `request.userId` from a validated JWT (anonymous allowed) so the
  // breakdown gate resolves the caller's real tier. `private` cache: the body
  // varies by tier (paid users get `components`), so shared caches must not
  // serve one caller's breakdown to another.
  @UseGuards(OptionalJwtAuthGuard)
  @Header('Cache-Control', 'private, max-age=21600')
  @ApiOperation({ summary: 'Get PropertyIQ scores for a location' })
  @ApiQuery({
    name: 'geography',
    required: true,
    enum: ['metro', 'county', 'zip'],
  })
  @ApiQuery({
    name: 'location_id',
    required: true,
    description: 'Location identifier (cbsa_code, fips, or zip)',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Score date (YYYY-MM-DD), defaults to latest',
  })
  @ApiQuery({
    name: 'historyMonths',
    required: false,
    description: `0-${SCORE_HISTORY_MONTHS_MAX}; include history for real-time calculations`,
  })
  async getScores(
    @Query('geography') geography: string,
    @Query('location_id') locationId: string,
    @Query('date') date?: string,
    @Query('historyMonths') historyMonths?: string,
    @Req() request?: any,
  ): Promise<ScoreResult> {
    return getScoresHandler(
      this.scoringService,
      this.scoreAccessService,
      geography,
      locationId,
      date,
      historyMonths,
      request,
    );
  }

  // ============================================================================
  // Map Display Endpoints (must come before generic routes)
  // ============================================================================

  /**
   * Get all scores for a geography level (for map display).
   *
   * NOTE: This route must come BEFORE @Get(':geography/:locationId') to avoid route conflicts
   */
  @Get('all/:geography')
  @Header('Cache-Control', 'public, max-age=21600')
  @ApiOperation({ summary: 'Get all scores for a geography level (paginated)' })
  @ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({
    name: 'score_type',
    required: true,
    description: 'propertyiq or all',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Score date (YYYY-MM-DD), defaults to latest',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (0-indexed)',
    type: Number,
  })
  @ApiQuery({
    name: 'page_size',
    required: false,
    description: 'Page size (default 1000, max 1000)',
    type: Number,
  })
  @ApiQuery({
    name: 'all',
    required: false,
    description: 'Fetch all rows (server will batch internally)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'concurrency',
    required: false,
    description: 'Batch concurrency when all=true (default 4, max 8)',
    type: Number,
  })
  async getAllScores(
    @Param('geography') geography: string,
    @Query('score_type') scoreType: string,
    @Query('date') date?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('all') all?: string,
    @Query('concurrency') concurrency?: string,
  ): Promise<AllScoresResponse> {
    return getAllScoresHandler(
      this.scoringService,
      geography,
      scoreType,
      date,
      page,
      pageSize,
      all,
      concurrency,
    );
  }

  @Get('all/:geography/stream')
  @ApiOperation({ summary: 'Stream all scores as NDJSON (one row per line)' })
  @ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({
    name: 'score_type',
    required: true,
    description: 'propertyiq or all',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Score date (YYYY-MM-DD), defaults to latest',
  })
  @ApiQuery({
    name: 'page_size',
    required: false,
    description: 'Page size (default 1000, max 1000)',
    type: Number,
  })
  async streamAllScores(
    @Param('geography') geography: string,
    @Query('score_type') scoreType: string,
    @Query('date') date: string | undefined,
    @Res() res: Response,
    @Query('page_size') pageSize?: string,
  ): Promise<void> {
    return streamAllScoresHandler(
      this.scoringService,
      geography,
      scoreType,
      date,
      res,
      pageSize,
    );
  }

  /**
   * List all scored location IDs for a geography (latest period).
   *
   * NOTE: must be declared BEFORE @Get(':geography/:locationId') so "ids" is
   * not swallowed as a geography path param.
   */
  @Get('ids/:geography')
  @Header('Cache-Control', 'public, max-age=21600')
  @ApiOperation({ summary: 'List all scored location IDs for a geography' })
  @ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({
    name: 'score_type',
    required: false,
    description: 'propertyiq (default)',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Score date (YYYY-MM-DD), defaults to latest',
  })
  async getScoredIds(
    @Param('geography') geography: string,
    @Query('score_type') scoreType?: string,
    @Query('date') date?: string,
  ): Promise<ScoredIdsResponse> {
    return getScoredIdsHandler(this.scoringService, geography, scoreType, date);
  }

  /**
   * List recent distinct score_dates for a geography.
   *
   * NOTE: declared BEFORE @Get(':geography/:locationId') via its sibling
   * @Get('ids/:geography') — no additional ordering concern here.
   */
  @Get('ids/:geography/periods')
  @Header('Cache-Control', 'public, max-age=21600')
  @ApiOperation({ summary: 'List recent distinct score_dates for a geography' })
  @ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({
    name: 'score_type',
    required: false,
    description: 'propertyiq (default)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max periods returned (default 6, max 24)',
  })
  async getScorePeriods(
    @Param('geography') geography: string,
    @Query('score_type') scoreType = 'propertyiq',
    @Query('limit') limit = '6',
  ): Promise<{ geography: string; score_type: string; periods: string[] }> {
    return getScorePeriodsHandler(
      this.scoringService,
      geography,
      scoreType,
      limit,
    );
  }

  /**
   * Get scores for multiple locations (batch).
   *
   * NOTE: must be declared BEFORE @Get(':geography/:locationId') so "batch" is
   * not swallowed as a geography path param (Express matches in declaration
   * order). Previously declared after it, which made every call 400 with
   * "Invalid geography: batch".
   */
  @Get('batch/:geography')
  // Tier-gated breakdown — validate JWT for real tier; `private` cache (see @Get()).
  @UseGuards(OptionalJwtAuthGuard)
  @Header('Cache-Control', 'private, max-age=21600')
  @ApiOperation({ summary: 'Get scores for multiple locations' })
  @ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({
    name: 'ids',
    required: true,
    description: 'Comma-separated location IDs',
  })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({
    name: 'historyMonths',
    required: false,
    description: `0-${SCORE_HISTORY_MONTHS_MAX}; include history per location`,
  })
  async getBatchScores(
    @Param('geography') geography: string,
    @Query('ids') ids: string,
    @Query('date') date?: string,
    @Query('historyMonths') historyMonths?: string,
    @Req() request?: any,
  ): Promise<{
    geography: string;
    scores: (ScoreResult | { location_id: string; error: string })[];
  }> {
    return getBatchScoresHandler(
      this.scoringService,
      this.scoreAccessService,
      geography,
      ids,
      date,
      historyMonths,
      request,
    );
  }

  // ============================================================================
  // Legacy Compatibility Endpoints
  // ============================================================================

  /**
   * Get score by path (legacy format).
   *
   * CATCH-ALL — MUST remain the LAST route declared in this class (see the
   * route-ordering hazard note at the top of the file).
   */
  @Get(':geography/:locationId')
  // Tier-gated breakdown — validate JWT for real tier; `private` cache (see @Get()).
  @UseGuards(OptionalJwtAuthGuard)
  @Header('Cache-Control', 'private, max-age=21600')
  @ApiOperation({ summary: 'Get scores for a location (path format)' })
  @ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
  @ApiParam({ name: 'locationId', description: 'Location identifier' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({
    name: 'historyMonths',
    required: false,
    description: `0-${SCORE_HISTORY_MONTHS_MAX}; include history for real-time calculations`,
  })
  @ApiQuery({
    name: 'historyYears',
    required: false,
    description: '3 or 5; include extended history with outcomes',
  })
  @ApiQuery({
    name: 'includeOutcomes',
    required: false,
    description: 'true to include actual returns and benchmarks',
  })
  async getScoreByPath(
    @Param('geography') geography: string,
    @Param('locationId') locationId: string,
    @Query('date') date?: string,
    @Query('historyMonths') historyMonths?: string,
    @Query('historyYears') historyYears?: string,
    @Query('includeOutcomes') includeOutcomes?: string,
    @Req() request?: any,
  ): Promise<ScoreResult> {
    return getScoreByPathHandler(
      this.scoringService,
      this.scoreAccessService,
      geography,
      locationId,
      date,
      historyMonths,
      historyYears,
      includeOutcomes,
      request,
    );
  }
}
