/**
 * Grandfathering Controller
 *
 * Admin endpoints for managing grandfathered users and policies.
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
import {
  GrandfatheringService,
  CreateGrandfatherDto,
  GrandfatherPolicy,
} from './grandfathering.service';

@Controller('admin/grandfathering')
export class GrandfatheringController {
  private readonly logger = new Logger(GrandfatheringController.name);

  constructor(private readonly grandfatheringService: GrandfatheringService) {}

  // ========================================================================
  // GRANDFATHERED RECORDS
  // ========================================================================

  /**
   * Get grandfathering for a user
   * GET /api/admin/grandfathering/user/:userId
   */
  @Get('user/:userId')
  async getUserGrandfathering(@Param('userId') userId: string) {
    this.logger.log(`GET /admin/grandfathering/user/${userId}`);

    try {
      const records = await this.grandfatheringService.getUserGrandfathering(userId);
      return {
        success: true,
        data: records,
        count: records.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all active grandfathering records
   * GET /api/admin/grandfathering
   */
  @Get()
  async getAllActive() {
    this.logger.log('GET /admin/grandfathering');

    try {
      const records = await this.grandfatheringService.getAllActiveGrandfathering();
      return {
        success: true,
        data: records,
        count: records.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a grandfathered record (manual)
   * POST /api/admin/grandfathering
   */
  @Post()
  async create(@Body() body: CreateGrandfatherDto) {
    this.logger.log('POST /admin/grandfathering');

    if (!body.user_id || !body.grandfathered_type || !body.reason) {
      throw new HttpException(
        'user_id, grandfathered_type, and reason are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const record = await this.grandfatheringService.createGrandfathering(body);
      return {
        success: true,
        data: record,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Revoke a grandfathered record
   * DELETE /api/admin/grandfathering/:id
   */
  @Delete(':id')
  async revoke(
    @Param('id') id: string,
    @Body() body: { revokedBy?: string; reason?: string },
  ) {
    this.logger.log(`DELETE /admin/grandfathering/${id}`);

    try {
      await this.grandfatheringService.revokeGrandfathering(
        id,
        body.revokedBy,
        body.reason,
      );
      return {
        success: true,
        revoked: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Extend grandfathering expiration
   * PUT /api/admin/grandfathering/:id/extend
   */
  @Put(':id/extend')
  async extend(
    @Param('id') id: string,
    @Body() body: { expiresAt: string },
  ) {
    this.logger.log(`PUT /admin/grandfathering/${id}/extend`);

    if (!body.expiresAt) {
      throw new HttpException('expiresAt is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.grandfatheringService.extendGrandfathering(id, body.expiresAt);
      return {
        success: true,
        extended: true,
        expiresAt: body.expiresAt,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Apply tier change policies manually
   * POST /api/admin/grandfathering/apply-tier-change
   */
  @Post('apply-tier-change')
  async applyTierChange(
    @Body() body: {
      userId: string;
      fromTier: string;
      toTier: string;
      grantedBy?: string;
    },
  ) {
    this.logger.log('POST /admin/grandfathering/apply-tier-change');

    if (!body.userId || !body.fromTier || !body.toTier) {
      throw new HttpException(
        'userId, fromTier, and toTier are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const records = await this.grandfatheringService.applyPoliciesOnTierChange(
        body.userId,
        body.fromTier,
        body.toTier,
        body.grantedBy,
      );
      return {
        success: true,
        data: records,
        count: records.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ========================================================================
  // POLICIES
  // ========================================================================

  /**
   * Get all policies
   * GET /api/admin/grandfathering/policies
   */
  @Get('policies')
  async getPolicies(@Query('active') active?: string) {
    this.logger.log('GET /admin/grandfathering/policies');

    try {
      const policies = active === 'true'
        ? await this.grandfatheringService.getActivePolicies()
        : await this.grandfatheringService.getPolicies();
      return {
        success: true,
        data: policies,
        count: policies.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a policy
   * POST /api/admin/grandfathering/policies
   */
  @Post('policies')
  async createPolicy(@Body() body: Omit<GrandfatherPolicy, 'id'>) {
    this.logger.log('POST /admin/grandfathering/policies');

    if (!body.name || !body.trigger_type || !body.grandfather_type || !body.duration_type) {
      throw new HttpException(
        'name, trigger_type, grandfather_type, and duration_type are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const policy = await this.grandfatheringService.createPolicy(body);
      return {
        success: true,
        data: policy,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update a policy
   * PUT /api/admin/grandfathering/policies/:id
   */
  @Put('policies/:id')
  async updatePolicy(
    @Param('id') id: string,
    @Body() body: Partial<GrandfatherPolicy>,
  ) {
    this.logger.log(`PUT /admin/grandfathering/policies/${id}`);

    try {
      const policy = await this.grandfatheringService.updatePolicy(id, body);
      return {
        success: true,
        data: policy,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete a policy
   * DELETE /api/admin/grandfathering/policies/:id
   */
  @Delete('policies/:id')
  async deletePolicy(@Param('id') id: string) {
    this.logger.log(`DELETE /admin/grandfathering/policies/${id}`);

    try {
      await this.grandfatheringService.deletePolicy(id);
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
