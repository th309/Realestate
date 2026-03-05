/**
 * Preferences Controller
 *
 * REST endpoints for reading and writing user quiz preferences.
 * All routes require JWT authentication via JwtAuthGuard.
 *
 * GET  /api/preferences  — fetch current user's preferences
 * PUT  /api/preferences  — upsert preferences (partial or complete quiz)
 */

import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { PreferencesService } from './preferences.service';
import { UpsertPreferencesDto } from './upsert-preferences.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/preferences')
export class PreferencesController {
  private readonly logger = new Logger(PreferencesController.name);

  constructor(private readonly preferencesService: PreferencesService) {}

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
}
