/**
 * User Features Controller
 *
 * Endpoints for resolving and managing user feature access.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UserFeaturesService } from './user-features.service';
import { AdminGuard } from '../../common/guards/admin-auth.guard';

@UseGuards(AdminGuard)
@Controller('api/features')
export class UserFeaturesController {
  private readonly logger = new Logger(UserFeaturesController.name);

  constructor(private readonly userFeaturesService: UserFeaturesService) {}

  /**
   * Get all resolved features for a user
   * GET /api/features/user/:userId?tier=pro
   */
  @Get('user/:userId')
  async getUserFeatures(
    @Param('userId') userId: string,
    @Query('tier') tier?: string,
  ) {
    this.logger.log(`GET /features/user/${userId}`);

    try {
      const resolved = await this.userFeaturesService.getUserFeatures(userId, tier);
      return {
        success: true,
        data: resolved,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if user has a specific feature
   * GET /api/features/user/:userId/check/:featureSlug
   */
  @Get('user/:userId/check/:featureSlug')
  async checkFeature(
    @Param('userId') userId: string,
    @Param('featureSlug') featureSlug: string,
    @Query('tier') tier?: string,
  ) {
    this.logger.log(`GET /features/user/${userId}/check/${featureSlug}`);

    try {
      const hasAccess = await this.userFeaturesService.hasFeature(userId, featureSlug, tier);
      return {
        success: true,
        feature: featureSlug,
        hasAccess,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get feature limit for a user
   * GET /api/features/user/:userId/limit/:featureSlug
   */
  @Get('user/:userId/limit/:featureSlug')
  async getFeatureLimit(
    @Param('userId') userId: string,
    @Param('featureSlug') featureSlug: string,
    @Query('tier') tier?: string,
  ) {
    this.logger.log(`GET /features/user/${userId}/limit/${featureSlug}`);

    try {
      const limit = await this.userFeaturesService.getFeatureLimit(userId, featureSlug, tier);
      return {
        success: true,
        feature: featureSlug,
        limit,
        unlimited: limit === -1,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user's overrides
   * GET /api/features/user/:userId/overrides
   */
  @Get('user/:userId/overrides')
  async getUserOverrides(@Param('userId') userId: string) {
    this.logger.log(`GET /features/user/${userId}/overrides`);

    try {
      const overrides = await this.userFeaturesService.getUserOverrides(userId);
      return {
        success: true,
        data: overrides,
        count: overrides.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a user override (admin)
   * POST /api/features/user/:userId/override
   */
  @Post('user/:userId/override')
  async createOverride(
    @Param('userId') userId: string,
    @Body() body: {
      featureSlug: string;
      value: unknown;
      reason?: string;
      grantedBy?: string;
      expiresAt?: string;
    },
  ) {
    this.logger.log(`POST /features/user/${userId}/override`);

    if (!body.featureSlug || body.value === undefined) {
      throw new HttpException(
        'featureSlug and value are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.userFeaturesService.createOverride(
        userId,
        body.featureSlug,
        body.value,
        {
          reason: body.reason,
          grantedBy: body.grantedBy,
          expiresAt: body.expiresAt,
        },
      );
      return {
        success: true,
        created: {
          userId,
          feature: body.featureSlug,
          value: body.value,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Remove a user override (admin)
   * DELETE /api/features/user/:userId/override/:featureSlug
   */
  @Delete('user/:userId/override/:featureSlug')
  async removeOverride(
    @Param('userId') userId: string,
    @Param('featureSlug') featureSlug: string,
  ) {
    this.logger.log(`DELETE /features/user/${userId}/override/${featureSlug}`);

    try {
      await this.userFeaturesService.removeOverride(userId, featureSlug);
      return {
        success: true,
        deleted: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
