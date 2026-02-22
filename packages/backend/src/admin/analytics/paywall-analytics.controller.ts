/**
 * Paywall Analytics Controller
 *
 * Admin endpoints for paywall analytics.
 */

import {
  Controller,
  Get,
  Query,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { PaywallAnalyticsService } from './paywall-analytics.service';
import { AdminGuard } from '../../common/guards/admin-auth.guard';

@UseGuards(AdminGuard)
@Controller('api/admin/analytics')
export class PaywallAnalyticsController {
  private readonly logger = new Logger(PaywallAnalyticsController.name);

  constructor(private readonly analyticsService: PaywallAnalyticsService) {}

  /**
   * Get paywall statistics
   * GET /api/admin/analytics/paywall?startDate=&endDate=
   */
  @Get('paywall')
  async getPaywallStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.logger.log('GET /admin/analytics/paywall');

    try {
      const stats = await this.analyticsService.getStats({ startDate, endDate });
      return { success: true, data: stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get conversion funnel data
   * GET /api/admin/analytics/funnel
   */
  @Get('funnel')
  async getFunnel(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.logger.log('GET /admin/analytics/funnel');

    try {
      const funnel = await this.analyticsService.getFunnelData({ startDate, endDate });
      return { success: true, data: funnel };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get recent paywall events
   * GET /api/admin/analytics/events?limit=50&eventType=view
   */
  @Get('events')
  async getEvents(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('eventType') eventType?: string,
    @Query('resourceType') resourceType?: string,
  ) {
    this.logger.log('GET /admin/analytics/events');

    try {
      const result = await this.analyticsService.getRecentEvents({
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
        eventType,
        resourceType,
      });
      return {
        success: true,
        data: result.events,
        total: result.total,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
