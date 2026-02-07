/**
 * Trial Controller
 *
 * Admin endpoints for trial management.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TrialService } from './trial.service';

@Controller('api/admin/trial')
export class TrialController {
  private readonly logger = new Logger(TrialController.name);

  constructor(private readonly trialService: TrialService) {}

  /**
   * Get trial configuration
   * GET /api/admin/trial/config
   */
  @Get('config')
  async getConfig() {
    this.logger.log('GET /admin/trial/config');

    try {
      const config = await this.trialService.getConfig();
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update trial configuration
   * PUT /api/admin/trial/config
   */
  @Put('config')
  async updateConfig(
    @Body() body: {
      is_enabled?: boolean;
      duration_days?: number;
      trial_tier?: string;
      show_banner?: boolean;
    },
  ) {
    this.logger.log('PUT /admin/trial/config');

    try {
      const config = await this.trialService.updateConfig(body);
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get trial statistics
   * GET /api/admin/trial/stats
   */
  @Get('stats')
  async getStats() {
    this.logger.log('GET /admin/trial/stats');

    try {
      const stats = await this.trialService.getStats();
      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all trials
   * GET /api/admin/trial/users?status=active&limit=20&offset=0
   */
  @Get('users')
  async getTrials(
    @Query('status') status?: 'active' | 'expired' | 'converted' | 'cancelled',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.logger.log('GET /admin/trial/users');

    try {
      const result = await this.trialService.getAllTrials({
        status,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });
      return {
        success: true,
        data: result.trials,
        total: result.total,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Start a trial for a user
   * POST /api/admin/trial/users/:userId/start
   */
  @Post('users/:userId/start')
  async startTrial(
    @Param('userId') userId: string,
    @Body() body: { tier?: string },
  ) {
    this.logger.log(`POST /admin/trial/users/${userId}/start`);

    try {
      const trial = await this.trialService.startTrial(userId, body.tier);
      return { success: true, data: trial };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Extend a user's trial
   * PUT /api/admin/trial/users/:userId/extend
   */
  @Put('users/:userId/extend')
  async extendTrial(
    @Param('userId') userId: string,
    @Body() body: { days: number },
  ) {
    this.logger.log(`PUT /admin/trial/users/${userId}/extend`);

    if (!body.days || body.days <= 0) {
      throw new HttpException('days must be a positive number', HttpStatus.BAD_REQUEST);
    }

    try {
      const trial = await this.trialService.extendTrial(userId, body.days);
      return { success: true, data: trial };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel a user's trial
   * DELETE /api/admin/trial/users/:userId
   */
  @Delete('users/:userId')
  async cancelTrial(@Param('userId') userId: string) {
    this.logger.log(`DELETE /admin/trial/users/${userId}`);

    try {
      await this.trialService.cancelTrial(userId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark trial as converted
   * PUT /api/admin/trial/users/:userId/convert
   */
  @Put('users/:userId/convert')
  async convertTrial(@Param('userId') userId: string) {
    this.logger.log(`PUT /admin/trial/users/${userId}/convert`);

    try {
      await this.trialService.convertTrial(userId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
