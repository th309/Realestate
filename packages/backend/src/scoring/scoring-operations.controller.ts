/**
 * PropertyIQ Scoring — Operations, Performance & Debug Endpoints
 *
 * Sibling `@Controller('api/scores')` holding the admin calculation/validation
 * writes, performance-tracking reads, and debug helpers. Split out of
 * ScoringController verbatim for file-size compliance. None of these routes are
 * 2-segment GETs, so they never collide with the catch-all
 * `:geography/:locationId` on ScoringController:
 *   - `calculate/:geography` and `validate` are POSTs (AdminGuard),
 *   - `performance` and `alerts` are single-segment GETs,
 *   - `debug/...` routes are 3+ segments.
 *
 * Named ScoringOperationsController (rather than a generic Admin* name) to
 * avoid confusion with the unrelated AdminController, which serves a different
 * prefix (api/admin) — there is no route collision between them.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Header,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import {
  PerformanceTrackingService,
  PerformanceMetrics,
  AlertResult,
} from './performance-tracking.service';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import {
  validateGeography,
  validateScoreType,
} from './scoring-request.helpers';

@ApiTags('scores')
@Controller('api/scores')
export class ScoringOperationsController {
  constructor(
    private readonly scoringService: ScoringService,
    private readonly performanceTrackingService: PerformanceTrackingService,
  ) {}

  // ============================================================================
  // Calculation Endpoints
  // ============================================================================

  /**
   * Trigger score calculation for all locations at a geography level
   *
   * POST /api/scores/calculate/:geography
   */
  @Post('calculate/:geography')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Calculate scores for all locations at a geography level',
  })
  @ApiParam({ name: 'geography', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Period date (YYYY-MM-DD), defaults to latest',
  })
  async calculateScores(
    @Param('geography') geography: string,
    @Query('date') date?: string,
  ): Promise<{
    success: boolean;
    calculated: number;
    errors: number;
    scoreDate: string;
  }> {
    const geoLevel = validateGeography(geography);
    const result = await this.scoringService.calculateAllScores(geoLevel, date);

    return {
      success: result.errors === 0,
      ...result,
    };
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
   *   "formula_version": "PropertyIQ demand signal",
   *   "last_validated": "2025-01-15"
   * }
   */
  @Get('performance')
  @Header('Cache-Control', 'public, max-age=21600')
  @ApiOperation({ summary: 'Get performance metrics for score validation' })
  @ApiQuery({
    name: 'geography',
    required: false,
    enum: ['metro', 'county', 'zip'],
  })
  @ApiQuery({
    name: 'score_type',
    required: false,
    enum: ['propertyiq'],
  })
  async getPerformanceMetrics(
    @Query('geography') geography?: string,
    @Query('score_type') scoreType?: string,
  ): Promise<PerformanceMetrics | PerformanceMetrics[]> {
    // If both are provided, return single metric
    if (geography && scoreType) {
      const geoLevel = validateGeography(geography);
      const validScoreType = validateScoreType(scoreType);
      return this.performanceTrackingService.getPerformanceMetrics(
        geoLevel,
        validScoreType,
      );
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
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Validate predictions from 12 months ago' })
  async validatePredictions() {
    const [result1Y, result3Y] = await Promise.all([
      this.performanceTrackingService.validatePredictions(),
      this.performanceTrackingService.validatePredictions3Y(),
    ]);
    return {
      success: result1Y.errors === 0 && result3Y.errors === 0,
      validated_1y: result1Y.validated,
      validated_3y: result3Y.validated,
      errors: result1Y.errors + result3Y.errors,
      predictionDate_1y: result1Y.predictionDate,
      predictionDate_3y: result3Y.predictionDate,
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
  async getLatestDate(
    @Param('geography') geography: string,
  ): Promise<{ geography: string; latestDate: string | null }> {
    const geoLevel = validateGeography(geography);
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
    const geoLevel = validateGeography(geography);
    const stats = await this.scoringService.debugGetMetricStats(
      geoLevel,
      metric,
      date,
    );
    return { geography, metric, stats };
  }
}
