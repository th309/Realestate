/**
 * Score Validation Controller
 *
 * API endpoints for the score validation dashboard.
 *
 * Endpoints:
 * - GET /api/admin/scores/validation/summary - Overall validation metrics
 * - GET /api/admin/scores/validation/quintile-analysis - Performance by score quintile
 * - GET /api/admin/scores/validation/scatter - Score vs return scatter data
 * - GET /api/admin/scores/validation/time-series - Accuracy over time
 * - GET /api/admin/scores/validation/geography-breakdown - Performance by geography type
 */

import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import {
  ValidationService,
  ValidationSummary,
  QuintileData,
  ScatterPoint,
  TimeSeriesAccuracy,
  GeographyBreakdown,
} from './validation.service';
import type { GeographyType, ScoreType } from '../scoring.types';

@ApiTags('score-validation')
@Controller('api/admin/scores/validation')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  /**
   * Get overall validation summary
   *
   * GET /api/admin/scores/validation/summary
   */
  @Get('summary')
  @ApiOperation({ summary: 'Get score validation summary metrics' })
  @ApiQuery({ name: 'geography', required: false, enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'score_type', required: false, enum: ['homeready', 'investoredge', 'markethealth'] })
  async getSummary(
    @Query('geography') geography?: string,
    @Query('score_type') scoreType?: string,
  ): Promise<ValidationSummary> {
    const geoType = geography ? this.validateGeography(geography) : undefined;
    const sType = scoreType ? this.validateScoreType(scoreType) : undefined;

    return this.validationService.getValidationSummary(geoType, sType);
  }

  /**
   * Get quintile analysis - performance by score bucket
   *
   * GET /api/admin/scores/validation/quintile-analysis
   */
  @Get('quintile-analysis')
  @ApiOperation({ summary: 'Get score performance by quintile' })
  @ApiQuery({ name: 'geography', required: false, enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'score_type', required: false, enum: ['homeready', 'investoredge', 'markethealth'] })
  @ApiQuery({ name: 'horizon', required: false, enum: ['1y', '3y'], description: 'Return horizon to analyze' })
  async getQuintileAnalysis(
    @Query('geography') geography?: string,
    @Query('score_type') scoreType?: string,
    @Query('horizon') horizon?: string,
  ): Promise<QuintileData[]> {
    const geoType = geography ? this.validateGeography(geography) : undefined;
    const sType = scoreType ? this.validateScoreType(scoreType) : undefined;
    const h = horizon === '3y' ? '3y' : '1y';

    return this.validationService.getQuintileAnalysis(geoType, sType, h);
  }

  /**
   * Get scatter plot data (score vs return)
   *
   * GET /api/admin/scores/validation/scatter
   */
  @Get('scatter')
  @ApiOperation({ summary: 'Get score vs return scatter data' })
  @ApiQuery({ name: 'geography', required: false, enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'score_type', required: false, enum: ['homeready', 'investoredge', 'markethealth'] })
  @ApiQuery({ name: 'limit', required: false, description: 'Max points to return (default 500)' })
  async getScatterData(
    @Query('geography') geography?: string,
    @Query('score_type') scoreType?: string,
    @Query('limit') limitStr?: string,
  ): Promise<ScatterPoint[]> {
    const geoType = geography ? this.validateGeography(geography) : undefined;
    const sType = scoreType ? this.validateScoreType(scoreType) : undefined;
    const limit = Math.min(Math.max(parseInt(limitStr || '500', 10), 10), 2000);

    return this.validationService.getScatterData(geoType, sType, limit);
  }

  /**
   * Get time series accuracy - correlation over time
   *
   * GET /api/admin/scores/validation/time-series
   */
  @Get('time-series')
  @ApiOperation({ summary: 'Get prediction accuracy over time' })
  @ApiQuery({ name: 'geography', required: false, enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'score_type', required: false, enum: ['homeready', 'investoredge', 'markethealth'] })
  async getTimeSeriesAccuracy(
    @Query('geography') geography?: string,
    @Query('score_type') scoreType?: string,
  ): Promise<TimeSeriesAccuracy[]> {
    const geoType = geography ? this.validateGeography(geography) : undefined;
    const sType = scoreType ? this.validateScoreType(scoreType) : undefined;

    return this.validationService.getTimeSeriesAccuracy(geoType, sType);
  }

  /**
   * Get breakdown by geography type
   *
   * GET /api/admin/scores/validation/geography-breakdown
   */
  @Get('geography-breakdown')
  @ApiOperation({ summary: 'Get validation breakdown by geography type' })
  @ApiQuery({ name: 'score_type', required: false, enum: ['homeready', 'investoredge', 'markethealth'] })
  async getGeographyBreakdown(
    @Query('score_type') scoreType?: string,
  ): Promise<GeographyBreakdown[]> {
    const sType = scoreType ? this.validateScoreType(scoreType) : undefined;

    return this.validationService.getGeographyBreakdown(sType);
  }

  // ========================================================================
  // Validation Helpers
  // ========================================================================

  private validateGeography(geography: string): GeographyType {
    const validLevels: GeographyType[] = ['metro', 'county', 'zip'];
    const lower = geography.toLowerCase() as GeographyType;

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
