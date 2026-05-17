/**
 * Preferences Controller
 *
 * REST endpoints for reading and writing user quiz preferences
 * and personalized market match scores.
 *
 * All routes require JWT authentication via JwtAuthGuard.
 *
 * GET  /api/preferences                        — fetch current user's preferences
 * PUT  /api/preferences                        — upsert preferences
 * GET  /api/preferences/match/:geoLevel/:regionId — single region match score
 * GET  /api/preferences/match/:geoLevel/top    — top N matches
 */

import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { PreferencesService } from './preferences.service';
import { MarketMatchService } from './market-match.service';
import { UpsertPreferencesDto } from './upsert-preferences.dto';
import { AnalyzerDefaultsDto } from './analyzer-defaults.dto';
import { AnalyzerDefaults } from './preferences.types';

@UseGuards(JwtAuthGuard)
@Controller('api/preferences')
export class PreferencesController {
  private readonly logger = new Logger(PreferencesController.name);

  constructor(
    private readonly preferencesService: PreferencesService,
    private readonly marketMatchService: MarketMatchService,
  ) {}

  /**
   * Get the authenticated user's preferences.
   * Returns null (with 200) if no preferences exist yet.
   */
  @Get()
  async getPreferences(@AuthUserId() userId: string) {
    try {
      const preferences = await this.preferencesService.getPreferences(userId);

      return {
        success: true,
        data: preferences,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get preferences: ${error.message}`);
      throw new HttpException(
        'Failed to fetch preferences',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Upsert the authenticated user's preferences.
   * Validates input via class-validator (UpsertPreferencesDto).
   * Computes archetype_id and sets quiz_completed_at when complete.
   */
  @Put()
  async upsertPreferences(
    @AuthUserId() userId: string,
    @Body() dto: UpsertPreferencesDto,
  ) {
    try {
      const preferences = await this.preferencesService.upsertPreferences(
        userId,
        dto,
      );

      return {
        success: true,
        data: preferences,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to upsert preferences: ${error.message}`);
      throw new HttpException(
        'Failed to save preferences',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==========================================================================
  // Analyzer Defaults Endpoints
  // ==========================================================================

  /**
   * GET /api/preferences/analyzer-defaults
   *
   * Returns the user's saved analyzer form defaults, or `{}` when none are
   * saved. Empty object signals "use built-in analyzer defaults" to the
   * frontend.
   */
  @Get('analyzer-defaults')
  async getAnalyzerDefaults(
    @AuthUserId() userId: string,
  ): Promise<AnalyzerDefaults> {
    try {
      const saved = await this.preferencesService.getAnalyzerDefaults(userId);
      return saved ?? {};
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get analyzer defaults: ${error.message}`);
      throw new HttpException(
        'Failed to fetch analyzer defaults',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /api/preferences/analyzer-defaults
   *
   * Upsert the user's analyzer form defaults. Body validated by
   * AnalyzerDefaultsDto; service preserves other preferences columns.
   */
  @Put('analyzer-defaults')
  async putAnalyzerDefaults(
    @AuthUserId() userId: string,
    @Body() body: AnalyzerDefaultsDto,
  ): Promise<AnalyzerDefaults> {
    try {
      return await this.preferencesService.upsertAnalyzerDefaults(userId, body);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to upsert analyzer defaults: ${error.message}`);
      throw new HttpException(
        'Failed to save analyzer defaults',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==========================================================================
  // Market Match Endpoints
  // ==========================================================================

  /**
   * Get the top N markets matching the user's preferences at a geo level.
   * Must be registered BEFORE the :regionId route to avoid "top" being
   * captured as a regionId parameter.
   */
  @Get('match/:geoLevel/top')
  async getTopMatches(
    @AuthUserId() userId: string,
    @Param('geoLevel') geoLevel: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    try {
      const matches = await this.marketMatchService.getTopMatches(
        userId,
        geoLevel,
        Math.min(limit, 100),
      );

      return {
        success: true,
        data: matches,
        meta: { geoLevel, limit, count: matches.length },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get top matches: ${error.message}`);
      throw new HttpException(
        'Failed to compute market matches',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get the match score for a single region against the user's preferences.
   */
  @Get('match/:geoLevel/:regionId')
  async getMatchScore(
    @AuthUserId() userId: string,
    @Param('geoLevel') geoLevel: string,
    @Param('regionId') regionId: string,
  ) {
    try {
      const match = await this.marketMatchService.calculateMatchScore(
        userId,
        geoLevel,
        regionId,
      );

      return {
        success: true,
        data: match,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get match score: ${error.message}`);
      throw new HttpException(
        'Failed to compute match score',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
