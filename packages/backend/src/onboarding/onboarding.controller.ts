/**
 * Onboarding Controller
 *
 * REST endpoints for the reverse-trial onboarding flow.
 * All routes require JWT authentication and receive userId from x-user-id header.
 *
 * POST /api/onboarding/start-trial        — start or return existing trial
 * POST /api/onboarding/save-market        — save selected market
 * POST /api/onboarding/checklist/:taskId  — mark checklist task complete
 * POST /api/onboarding/usage/:stat        — increment usage stat
 * POST /api/onboarding/beacon/:beaconId/dismiss — dismiss a UI beacon
 * GET  /api/onboarding/state              — fetch all onboarding state
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { OnboardingService, OnboardingMarket } from './onboarding.service';

@UseGuards(JwtAuthGuard)
@Controller('api/onboarding')
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('start-trial')
  async startTrial(@Headers('x-user-id') userId: string) {
    try {
      const trial = await this.onboardingService.ensureTrialStarted(userId);
      return { success: true, data: trial };
    } catch (error) {
      this.logger.error(
        `start-trial failed for user ${userId}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to start trial',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('save-market')
  async saveMarket(
    @Headers('x-user-id') userId: string,
    @Body() market: OnboardingMarket,
  ) {
    try {
      await this.onboardingService.saveOnboardingMarket(userId, market);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `save-market failed for user ${userId}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to save market',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('checklist/:taskId')
  async completeChecklistTask(
    @Headers('x-user-id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    try {
      await this.onboardingService.updateChecklist(userId, taskId);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `checklist update failed for user ${userId}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to update checklist',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('usage/:stat')
  async incrementUsage(
    @Headers('x-user-id') userId: string,
    @Param('stat')
    stat: 'markets_viewed' | 'scores_checked' | 'reports_generated',
  ) {
    try {
      await this.onboardingService.incrementUsageStat(userId, stat);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `usage increment failed for user ${userId}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to increment usage stat',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('beacon/:beaconId/dismiss')
  async dismissBeacon(
    @Headers('x-user-id') userId: string,
    @Param('beaconId') beaconId: string,
  ) {
    try {
      await this.onboardingService.dismissBeacon(userId, beaconId);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `beacon dismiss failed for user ${userId}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to dismiss beacon',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('state')
  async getState(@Headers('x-user-id') userId: string) {
    try {
      const state = await this.onboardingService.getOnboardingState(userId);
      return { success: true, data: state };
    } catch (error) {
      this.logger.error(
        `get-state failed for user ${userId}: ${error.message}`,
      );
      throw new HttpException(
        'Failed to fetch onboarding state',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
