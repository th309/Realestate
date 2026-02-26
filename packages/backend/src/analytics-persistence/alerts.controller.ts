/**
 * Alerts Controller
 *
 * REST endpoints for managing user alerts.
 * Protected by JwtAuthGuard — userId is extracted from the validated JWT.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import {
  AlertsService,
  CreateAlertDto,
  UpdateAlertDto,
} from './alerts.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics/alerts')
export class AlertsController {
  private readonly logger = new Logger(AlertsController.name);

  constructor(private readonly alertsService: AlertsService) {}

  /**
   * Get all alerts for the authenticated user
   * GET /api/analytics/alerts?active=true
   */
  @Get()
  async getAll(@AuthUserId() userId: string) {
    this.logger.log(`GET /analytics/alerts for user ${userId}`);

    try {
      const alerts = await this.alertsService.getAll(userId);
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
   * Get alert count
   * GET /api/analytics/alerts/count
   *
   * NOTE: This route MUST be defined before :id to avoid "count" being captured as an id param.
   */
  @Get('count')
  async getCount(@AuthUserId() userId: string) {
    this.logger.log('GET /analytics/alerts/count');

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

  /**
   * Get alert by ID
   * GET /api/analytics/alerts/:id
   */
  @Get(':id')
  async getById(@Param('id') id: string, @AuthUserId() userId: string) {
    this.logger.log(`GET /analytics/alerts/${id}`);

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
  async create(@AuthUserId() userId: string, @Body() dto: CreateAlertDto) {
    this.logger.log('POST /analytics/alerts');

    if (!dto.name || !dto.alert_type || !dto.condition) {
      throw new HttpException(
        'name, alert_type, and condition are required',
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
    @AuthUserId() userId: string,
    @Body() dto: UpdateAlertDto,
  ) {
    this.logger.log(`PUT /analytics/alerts/${id}`);

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
  async toggle(@Param('id') id: string, @AuthUserId() userId: string) {
    this.logger.log(`PUT /analytics/alerts/${id}/toggle`);

    try {
      const alert = await this.alertsService.toggle(userId, id);
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
   * DELETE /api/analytics/alerts/:id
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @AuthUserId() userId: string) {
    this.logger.log(`DELETE /analytics/alerts/${id}`);

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
}
