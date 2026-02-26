/**
 * Shares Controller
 *
 * REST endpoints for shareable links.
 * Protected by JwtAuthGuard — userId is extracted from the validated JWT.
 * Exception: The access/:token endpoint is public (share viewers don't need auth).
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
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { SharesService, CreateShareDto } from './shares.service';

@Controller('analytics/shares')
export class SharesController {
  private readonly logger = new Logger(SharesController.name);

  constructor(private readonly sharesService: SharesService) {}

  /**
   * Get all shares for the authenticated user
   * GET /api/analytics/shares
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAll(@AuthUserId() userId: string) {
    this.logger.log(`GET /analytics/shares for user ${userId}`);

    try {
      const shares = await this.sharesService.getAll(userId);
      return {
        success: true,
        data: shares,
        count: shares.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Access a share by token (public — no auth required)
   * GET /api/analytics/shares/access/:token
   */
  @Get('access/:token')
  async access(
    @Param('token') token: string,
    @Query('password') password?: string,
    @Query('email') email?: string,
  ) {
    this.logger.log(`GET /analytics/shares/access/${token}`);

    try {
      const result = await this.sharesService.access(token, {
        password,
        email,
      });

      if (!result.accessGranted) {
        return {
          success: false,
          error: result.reason,
          requiresPassword: result.reason === 'Password required',
          requiresEmail: result.reason === 'Email not authorized',
        };
      }

      return {
        success: true,
        data: result.share,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get share by ID (owner)
   * GET /api/analytics/shares/:id
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string, @AuthUserId() userId: string) {
    this.logger.log(`GET /analytics/shares/${id}`);

    try {
      const share = await this.sharesService.getById(userId, id);
      if (!share) {
        return {
          success: false,
          error: 'Share not found',
        };
      }
      return {
        success: true,
        data: share,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a shareable link
   * POST /api/analytics/shares
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@AuthUserId() userId: string, @Body() dto: CreateShareDto) {
    this.logger.log('POST /analytics/shares');

    if (!dto.content_type || !dto.content) {
      throw new HttpException(
        'content_type and content are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const share = await this.sharesService.create(userId, dto);
      return {
        success: true,
        data: share,
        shareUrl: `/share/${share.share_token}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update share settings
   * PUT /api/analytics/shares/:id
   */
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @AuthUserId() userId: string,
    @Body()
    updates: Partial<{
      title: string;
      description: string;
      is_public: boolean;
      password: string;
      allowed_emails: string[];
      expires_at: string;
      max_views: number;
    }>,
  ) {
    this.logger.log(`PUT /analytics/shares/${id}`);

    try {
      const share = await this.sharesService.update(userId, id, updates);
      return {
        success: true,
        data: share,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete a share
   * DELETE /api/analytics/shares/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @AuthUserId() userId: string) {
    this.logger.log(`DELETE /analytics/shares/${id}`);

    try {
      await this.sharesService.delete(userId, id);
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
