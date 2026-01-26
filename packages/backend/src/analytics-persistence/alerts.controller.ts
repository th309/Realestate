/**
 * Alerts Controller
 *
 * REST endpoints for managing user alerts.
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
import { AlertsService, CreateAlertDto, UpdateAlertDto } from './alerts.service';

@Controller('analytics/alerts')
export class AlertsController {
  private readonly logger = new Logger(AlertsController.name);

  constructor(private readonly alertsService: AlertsService) {}

  /**
   * Get all alerts for a user
   * GET /api/analytics/alerts?userId=xxx&active=true
   */
  @Get()
  async getAll(
    @Query('userId') userId: string,
    @Query('active') active?: string,
  ) {
    this.logger.log(`GET /analytics/alerts for user ${userId}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const alerts = active === 'true'
        ? await this.alertsService.getActive(userId)
        : await this.alertsService.getAll(userId);
      return {
        success: true,
        data: alerts,
        count: alerts.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get alert by ID
   * GET /api/analytics/alerts/:id?userId=xxx
   */
  @Get(':id')
  async getById(@Param('id') id: string, @Query('userId') userId: string) {
    this.logger.log(`GET /analytics/alerts/${id}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const alert = await this.alertsService.getById(userId, id);
      if (!alert) {
        return {
          success: false,
          error: 'Alert not found',
        };
      }
      return {
        success: true,
        data: alert,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a new alert
   * POST /api/analytics/alerts
   */
  @Post()
  async create(@Body() body: CreateAlertDto & { userId: string }) {
    this.logger.log('POST /analytics/alerts');

    const { userId, ...dto } = body;

    if (!userId || !dto.name || !dto.alert_type || !dto.condition) {
      throw new HttpException(
        'userId, name, alert_type, and condition are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const alert = await this.alertsService.create(userId, dto);
      return {
        success: true,
        data: alert,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update an alert
   * PUT /api/analytics/alerts/:id
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAlertDto & { userId: string },
  ) {
    this.logger.log(`PUT /analytics/alerts/${id}`);

    const { userId, ...dto } = body;

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const alert = await this.alertsService.update(userId, id, dto);
      return {
        success: true,
        data: alert,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Toggle alert active status
   * PUT /api/analytics/alerts/:id/toggle
   */
  @Put(':id/toggle')
  async toggle(@Param('id') id: string, @Body() body: { userId: string }) {
    this.logger.log(`PUT /analytics/alerts/${id}/toggle`);

    if (!body.userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const alert = await this.alertsService.toggle(body.userId, id);
      return {
        success: true,
        data: alert,
        is_active: alert.is_active,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete an alert
   * DELETE /api/analytics/alerts/:id?userId=xxx
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @Query('userId') userId: string) {
    this.logger.log(`DELETE /analytics/alerts/${id}`);

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.alertsService.delete(userId, id);
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

  /**
   * Get alert count
   * GET /api/analytics/alerts/count?userId=xxx
   */
  @Get('count')
  async getCount(@Query('userId') userId: string) {
    this.logger.log('GET /analytics/alerts/count');

    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const count = await this.alertsService.getCount(userId);
      return {
        success: true,
        count,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
