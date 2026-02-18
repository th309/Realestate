/**
 * Alerts Controller
 *
 * REST endpoints for user metric alerts (user_alerts / alert_history).
 * User ID is extracted from the x-user-id header.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AlertsService, CreateAlertDto, UpdateAlertDto } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  private readonly logger = new Logger(AlertsController.name);

  constructor(private readonly alertsService: AlertsService) {}

  /**
   * List user's alerts with recent history
   * GET /api/alerts
   */
  @Get()
  async listAlerts(@Headers('x-user-id') userId: string) {
    this.logger.log(`GET /alerts for user ${userId}`);

    if (!userId) {
      throw new HttpException('x-user-id header is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const alerts = await this.alertsService.listAlerts(userId);
      return {
        success: true,
        data: alerts,
        count: alerts.length,
      };
    } catch (error) {
      this.logger.error(`Failed to list alerts: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a new alert
   * POST /api/alerts
   */
  @Post()
  async createAlert(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateAlertDto,
  ) {
    this.logger.log('POST /alerts');

    if (!userId) {
      throw new HttpException('x-user-id header is required', HttpStatus.BAD_REQUEST);
    }

    if (!dto.geography_type || !dto.geography_id || !dto.metric_id || !dto.condition || dto.threshold == null) {
      throw new HttpException(
        'geography_type, geography_id, metric_id, condition, and threshold are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const alert = await this.alertsService.createAlert(userId, dto);
      return {
        success: true,
        data: alert,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to create alert: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update an alert
   * PATCH /api/alerts/:id
   */
  @Patch(':id')
  async updateAlert(
    @Headers('x-user-id') userId: string,
    @Param('id') alertId: string,
    @Body() dto: UpdateAlertDto,
  ) {
    this.logger.log(`PATCH /alerts/${alertId}`);

    if (!userId) {
      throw new HttpException('x-user-id header is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const alert = await this.alertsService.updateAlert(userId, alertId, dto);
      return {
        success: true,
        data: alert,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to update alert: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete an alert
   * DELETE /api/alerts/:id
   */
  @Delete(':id')
  async deleteAlert(
    @Headers('x-user-id') userId: string,
    @Param('id') alertId: string,
  ) {
    this.logger.log(`DELETE /alerts/${alertId}`);

    if (!userId) {
      throw new HttpException('x-user-id header is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.alertsService.deleteAlert(userId, alertId);
      return {
        success: true,
        deleted: true,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to delete alert: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get triggered alert history with unread count
   * GET /api/alerts/history?limit=50&offset=0
   */
  @Get('history')
  async getHistory(
    @Headers('x-user-id') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.logger.log(`GET /alerts/history for user ${userId}`);

    if (!userId) {
      throw new HttpException('x-user-id header is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.alertsService.getHistory(userId, {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      });
      return {
        success: true,
        data: result.entries,
        unread_count: result.unread_count,
        count: result.entries.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get alert history: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mark a history entry as read
   * PATCH /api/alerts/history/:id/read
   */
  @Patch('history/:id/read')
  async markRead(
    @Headers('x-user-id') userId: string,
    @Param('id') historyId: string,
  ) {
    this.logger.log(`PATCH /alerts/history/${historyId}/read`);

    if (!userId) {
      throw new HttpException('x-user-id header is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.alertsService.markRead(userId, historyId);
      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to mark history as read: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
