/**
 * Shares Controller
 *
 * REST endpoints for shareable links.
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
import { SharesService, CreateShareDto } from './shares.service';

@Controller('analytics/shares')
export class SharesController {
  private readonly logger = new Logger(SharesController.name);

  constructor(private readonly sharesService: SharesService) {}

  /**
   * Get all shares for a user
   * GET /api/analytics/shares?userId=xxx
   */
  @Get()
  async getAll(@Query('userId') userId: string) {
    this.logger.log(`GET /analytics/shares for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
   * Access a share by token (public)
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
      const result = await this.sharesService.access(token, { password, email });
      
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
   * GET /api/analytics/shares/:id?userId=xxx
   */
  @Get(':id')
  async getById(@Param('id') id: string, @Query('userId') userId: string) {
    this.logger.log(`GET /analytics/shares/${id}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
  @Post()
  async create(@Body() body: CreateShareDto & { userId: string }) {
    this.logger.log('POST /analytics/shares');

    const { userId, ...dto } = body;

    if (!userId || !dto.content_type || !dto.content) {
      throw new HttpException(
        'userId, content_type, and content are required',
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
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { userId: string } & Partial<{
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

    const { userId, ...updates } = body;

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
   * DELETE /api/analytics/shares/:id?userId=xxx
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @Query('userId') userId: string) {
    this.logger.log(`DELETE /analytics/shares/${id}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

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
