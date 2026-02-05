/**
 * PropertyIQ Scoring Controller
 *
 * API endpoints for the PropertyIQ scoring system.
 * Implements the simple z-score based scoring methodology.
 *
 * Endpoints:
 * - GET /api/scores?geography=metro&location_id=12420 - Get scores for a location
 * - GET /api/scores/top?geography=metro&score_type=homeready&limit=10 - Top markets
 * - GET /api/scores/search?q=austin&geography=zip - Search markets
 * - POST /api/scores/calculate/:geography - Trigger recalculation
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ScoringService, ScoreResult } from './scoring.service';
import { PerformanceTrackingService, PerformanceMetrics, AlertResult } from './performance-tracking.service';
import { GeographyLevel, ScoreType } from './formula-weights';
import { parseHistoryMonths } from '../common/history.constants';
import { SCORE_HISTORY_MONTHS_MAX } from './scoring.types';

@ApiTags('scores')
@Controller('api/scores')
export class ScoringController {
  constructor(
    private readonly scoringService: ScoringService,
    private readonly performanceTrackingService: PerformanceTrackingService,
  ) {}

  // ============================================================================
  // Main Score Endpoints (matching spec)
  // ============================================================================

  /**
   * Get scores for a specific location
   *
   * GET /api/scores?geography=metro&location_id=12420
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
  @Get()
  @ApiOperation({ summary: 'Get PropertyIQ scores for a location' })
  @ApiQuery({ name: 'geography', required: true, enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'location_id', required: true, description: 'Location identifier (cbsa_code, fips, or zip)' })
  @ApiQuery({ name: 'date', required: false, description: 'Score date (YYYY-MM-DD), defaults to latest' })
  @ApiQuery({ name: 'historyMonths', required: false, description: `0-${SCORE_HISTORY_MONTHS_MAX}; include history for real-time calculations` })
  async getScores(
    @Query('geography') geography: string,
    @Query('location_id') locationId: string,
    @Query('date') date?: string,
    @Query('historyMonths') historyMonths?: string,
  ): Promise<ScoreResult> {
    if (!geography) {
      throw new HttpException('geography query parameter is required', HttpStatus.BAD_REQUEST);
    }
    if (!locationId) {
      throw new HttpException('location_id query parameter is required', HttpStatus.BAD_REQUEST);
    }

    const geoLevel = this.validateGeography(geography);
    const options = historyMonths != null
      ? { historyMonths: parseHistoryMonths(historyMonths) }
      : undefined;
    const score = await this.scoringService.getScore(locationId, geoLevel, date, options);

    if (!score) {
      throw new HttpException(
        `No scores found for ${geography}/${locationId}. Try triggering a calculation first.`,
        HttpStatus.NOT_FOUND,
      );
    }

    return score;
  }

  /**
   * Get top markets by score
   *
   * GET /api/scores/top?geography=metro&score_type=homeready&limit=10
   */
  @Get('top')
  @ApiOperation({ summary: 'Get top markets by score' })
  @ApiQuery({ name: 'geography', required: true, enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'score_type', required: true, enum: ['homeready', 'investoredge', 'markethealth'] })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results (default 10, max 100)' })
  @ApiQuery({ name: 'date', required: false, description: 'Score date (YYYY-MM-DD), defaults to latest' })
  async getTopMarkets(
    @Query('geography') geography: string,
    @Query('score_type') scoreType: string,
    @Query('limit') limitStr?: string,
    @Query('date') date?: string,
  ): Promise<{ location_id: string; location_name: string; score: number; grade: string }[]> {
    if (!geography) {
      throw new HttpException('geography query parameter is required', HttpStatus.BAD_REQUEST);
    }
    if (!scoreType) {
      throw new HttpException('score_type query parameter is required', HttpStatus.BAD_REQUEST);
    }

    const geoLevel = this.validateGeography(geography);
    const validScoreType = this.validateScoreType(scoreType);
    const limit = Math.min(Math.max(parseInt(limitStr || '10', 10), 1), 100);

    return this.scoringService.getTopMarkets(geoLevel, validScoreType, limit, date);
  }

  /**
   * Search markets by name
   *
   * GET /api/scores/search?q=austin&geography=zip
   */
  @Get('search')
  @ApiOperation({ summary: 'Search markets by name' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'geography', required: false, enum: ['metro', 'county', 'zip'], description: 'Filter by geography type' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results (default 20, max 100)' })
  async searchMarkets(
    @Query('q') query: string,
    @Query('geography') geography?: string,
    @Query('limit') limitStr?: string,
  ): Promise<{ location_id: string; location_name: string; geography: string }[]> {
    if (!query || query.trim().length < 2) {
      throw new HttpException('q query parameter must be at least 2 characters', HttpStatus.BAD_REQUEST);
    }

    const geoLevel = geography ? this.validateGeography(geography) : undefined;
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10), 1), 100);

    return this.scoringService.searchMarkets(query.trim(), geoLevel, limit);
  }

  // ============================================================================
  // Calculation Endpoints
  // ============================================================================

  /**
   * Trigger score calculation for all locations at a geography level
   *
   * POST /api/scores/calculate/:geography
   */
  @Post('calculate/:geography')
  @ApiOperation({ summary: 'Calculate scores for all locations at a geography level' })
  @ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'date', required: false, description: 'Period date (YYYY-MM-DD), defaults to latest' })
  async calculateScores(
    @Param('geography') geography: string,
    @Query('date') date?: string,
  ): Promise<{ success: boolean; calculated: number; errors: number; scoreDate: string }> {
    const geoLevel = this.validateGeography(geography);
    const result = await this.scoringService.calculateAllScores(geoLevel, date);

    return {
      success: result.errors === 0,
      ...result,
    };
  }

  // ============================================================================
  // Map Display Endpoints (must come before generic routes)
  // ============================================================================

  /**
   * Get all scores for a geography level (for map display)
   * 
   * GET /api/scores/all/:geography?score_type=homeready&page=0&page_size=1000
   * 
   * NOTE: This route must come BEFORE @Get(':geography/:locationId') to avoid route conflicts
   */
  @Get('all/:geography')
  @ApiOperation({ summary: 'Get all scores for a geography level (paginated)' })
  @ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'score_type', required: true, enum: ['homeready', 'investoredge', 'markethealth'] })
  @ApiQuery({ name: 'date', required: false, description: 'Score date (YYYY-MM-DD), defaults to latest' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (0-indexed)', type: Number })
  @ApiQuery({ name: 'page_size', required: false, description: 'Page size (default 1000, max 1000)', type: Number })
  async getAllScores(
    @Param('geography') geography: string,
    @Query('score_type') scoreType: string,
    @Query('date') date?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ): Promise<{
    success: boolean;
    count: number;
    data: Array<{
      region_id: string;
      region_name: string;
      value: number;
      grade: string;
      confidence: number;
      confidence_level: string;
      date?: string;
    }>;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const geoLevel = this.validateGeography(geography);
    const validScoreType = this.validateScoreType(scoreType);
    const pageNum = page ? Math.max(0, parseInt(page, 10)) : 0;
    // Allow up to 1000 records per page (Supabase limit)
    const pageSizeNum = pageSize ? Math.min(Math.max(parseInt(pageSize, 10), 1), 1000) : 1000;

    const result = await this.scoringService.getAllScoresForGeography(
      geoLevel,
      validScoreType,
      date,
      pageNum,
      pageSizeNum,
    );

    return {
      success: true,
      count: result.data.length,
      data: result.data.map(item => ({
        region_id: item.location_id,
        region_name: item.location_name,
        value: item.score,
        grade: item.grade,
        confidence: item.confidence,
        confidence_level: item.confidence_level,
        date: date || undefined,
      })),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasMore: result.hasMore,
      },
    };
  }

  // ============================================================================
  // Legacy Compatibility Endpoints
  // ============================================================================

  /**
   * Get score by path (legacy format)
   *
   * GET /api/scores/:geography/:locationId
   *
   * Query params:
   * - historyMonths: 0-6 for short-term trend data
   * - historyYears: 3 or 5 for extended history with outcomes
   * - includeOutcomes: true to include actual returns and benchmark comparisons
   */
  @Get(':geography/:locationId')
  @ApiOperation({ summary: 'Get scores for a location (path format)' })
  @ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
  @ApiParam({ name: 'locationId', description: 'Location identifier' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'historyMonths', required: false, description: `0-${SCORE_HISTORY_MONTHS_MAX}; include history for real-time calculations` })
  @ApiQuery({ name: 'historyYears', required: false, description: '3 or 5; include extended history with outcomes' })
  @ApiQuery({ name: 'includeOutcomes', required: false, description: 'true to include actual returns and benchmarks' })
  async getScoreByPath(
    @Param('geography') geography: string,
    @Param('locationId') locationId: string,
    @Query('date') date?: string,
    @Query('historyMonths') historyMonths?: string,
    @Query('historyYears') historyYears?: string,
    @Query('includeOutcomes') includeOutcomes?: string,
  ): Promise<ScoreResult> {
    const geoLevel = this.validateGeography(geography);

    // If extended history requested, use the new method
    if (historyYears && parseInt(historyYears, 10) > 0) {
      const years = Math.min(Math.max(parseInt(historyYears, 10), 1), 5);
      const score = await this.scoringService.getScoreWithExtendedHistory(
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

      return score;
    }

    // Otherwise use standard method
    const options = historyMonths != null
      ? { historyMonths: parseHistoryMonths(historyMonths) }
      : undefined;
    const score = await this.scoringService.getScore(locationId, geoLevel, date, options);

    if (!score) {
      throw new HttpException(
        `No scores found for ${geography}/${locationId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    return score;
  }

  /**
   * Get scores for multiple locations (batch)
   *
   * GET /api/scores/batch/:geography?ids=id1,id2,id3
   */
  @Get('batch/:geography')
  @ApiOperation({ summary: 'Get scores for multiple locations' })
  @ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'ids', required: true, description: 'Comma-separated location IDs' })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'historyMonths', required: false, description: `0-${SCORE_HISTORY_MONTHS_MAX}; include history per location` })
  async getBatchScores(
    @Param('geography') geography: string,
    @Query('ids') ids: string,
    @Query('date') date?: string,
    @Query('historyMonths') historyMonths?: string,
  ): Promise<{ geography: string; scores: (ScoreResult | { location_id: string; error: string })[] }> {
    if (!ids) {
      throw new HttpException('ids query parameter is required', HttpStatus.BAD_REQUEST);
    }

    const geoLevel = this.validateGeography(geography);
    const locationIds = ids.split(',').map(id => id.trim()).filter(id => id);
    const options = historyMonths != null
      ? { historyMonths: parseHistoryMonths(historyMonths) }
      : undefined;

    if (locationIds.length === 0) {
      throw new HttpException('At least one location ID is required', HttpStatus.BAD_REQUEST);
    }
    if (locationIds.length > 100) {
      throw new HttpException('Maximum 100 locations per batch', HttpStatus.BAD_REQUEST);
    }

    const scores = await Promise.all(
      locationIds.map(async (id) => {
        try {
          const score = await this.scoringService.getScore(id, geoLevel, date, options);
          return score || { location_id: id, error: 'Score not found' };
        } catch {
          return { location_id: id, error: 'Failed to retrieve score' };
        }
      }),
    );

    return { geography, scores };
  }

  // ============================================================================
  // Performance Tracking Endpoints
  // ============================================================================

  /**
   * Get performance metrics for a geography and score type
   *
   * GET /api/scores/performance?geography=metro&score_type=homeready
   *
   * Response format (from spec):
   * {
   *   "geography": "metro",
   *   "score_type": "homeready",
   *   "validation_period": "2024-01 to 2024-12",
   *   "metrics": {
   *     "top_quintile_beat_rate": 89.2,
   *     "bottom_quintile_beat_rate": 11.8,
   *     "spread": 4.21,
   *     "correlation": 0.67,
   *     "predictions_validated": 367
   *   },
   *   "status": "healthy",
   *   "formula_version": "v1.0",
   *   "last_validated": "2025-01-15"
   * }
   */
  @Get('performance')
  @ApiOperation({ summary: 'Get performance metrics for score validation' })
  @ApiQuery({ name: 'geography', required: false, enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'score_type', required: false, enum: ['homeready', 'investoredge', 'markethealth'] })
  async getPerformanceMetrics(
    @Query('geography') geography?: string,
    @Query('score_type') scoreType?: string,
  ): Promise<PerformanceMetrics | PerformanceMetrics[]> {
    // If both are provided, return single metric
    if (geography && scoreType) {
      const geoLevel = this.validateGeography(geography);
      const validScoreType = this.validateScoreType(scoreType);
      return this.performanceTrackingService.getPerformanceMetrics(geoLevel, validScoreType);
    }

    // Otherwise return all metrics
    return this.performanceTrackingService.getAllPerformanceMetrics();
  }

  /**
   * Get active performance alerts
   *
   * GET /api/scores/alerts
   */
  @Get('alerts')
  @ApiOperation({ summary: 'Get active performance alerts' })
  async getAlerts(): Promise<AlertResult[]> {
    return this.performanceTrackingService.getActiveAlerts();
  }

  /**
   * Trigger validation of predictions from 12 months ago
   *
   * POST /api/scores/validate
   */
  @Post('validate')
  @ApiOperation({ summary: 'Validate predictions from 12 months ago' })
  async validatePredictions(): Promise<{ success: boolean; validated: number; errors: number; predictionDate: string }> {
    const result = await this.performanceTrackingService.validatePredictions();
    return {
      success: result.errors === 0,
      ...result,
    };
  }

  // ============================================================================
  // Debug Endpoints
  // ============================================================================

  /**
   * Get latest data date for a geography
   */
  @Get('debug/latest-date/:geography')
  @ApiOperation({ summary: 'Get latest data date for a geography' })
  async getLatestDate(@Param('geography') geography: string): Promise<{ geography: string; latestDate: string | null }> {
    const geoLevel = this.validateGeography(geography);
    const latestDate = await this.scoringService.debugGetLatestDate(geoLevel);
    return { geography, latestDate };
  }

  /**
   * Get metric statistics
   */
  @Get('debug/metric-stats/:geography/:metric')
  @ApiOperation({ summary: 'Get statistics for a metric' })
  async getMetricStats(
    @Param('geography') geography: string,
    @Param('metric') metric: string,
    @Query('date') date?: string,
  ) {
    const geoLevel = this.validateGeography(geography);
    const stats = await this.scoringService.debugGetMetricStats(geoLevel, metric, date);
    return { geography, metric, stats };
  }

  // ============================================================================
  // Validation Helpers
  // ============================================================================

  private validateGeography(geography: string): GeographyLevel {
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

  private validateScoreType(scoreType: string): ScoreType {
    const validTypes: ScoreType[] = ['homeready', 'investoredge', 'markethealth'];
    const lower = scoreType.toLowerCase() as ScoreType;

    if (!validTypes.includes(lower)) {
      throw new HttpException(
        `Invalid score_type: ${scoreType}. Valid values: ${validTypes.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return lower;
  }
}
