/**
 * Cache Refresh Job
 *
 * Runs every 6 hours to keep cache warm with popular queries
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AnalyticsChatService } from '../analytics-chat/analytics-chat.service';

@Injectable()
export class CacheRefreshJob {
  private readonly logger = new Logger(CacheRefreshJob.name);
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly chatService: AnalyticsChatService,
  ) {
    this.enabled = this.configService.get<string>('QUINN_CACHE_ENABLED', 'true') === 'true';
    if (this.enabled) {
      this.logger.log('[Cache Refresh] Job enabled - will run every 6 hours');
    } else {
      this.logger.warn('[Cache Refresh] Job disabled via QUINN_CACHE_ENABLED=false');
    }
  }

  /**
   * Run cache refresh every 6 hours
   * Cron expression: '0 star-slash-6 star star star' (at minute 0 past every 6th hour)
   */
  @Cron('0 */6 * * *')
  async handleCacheRefresh() {
    if (!this.enabled) {
      return;
    }

    this.logger.log('[Cache Refresh] Starting scheduled cache refresh...');
    const startTime = Date.now();

    try {
      // The warmCache method is already implemented in AnalyticsChatService
      // It will re-cache all popular queries
      await this.chatService['warmCache']();

      const duration = Date.now() - startTime;
      this.logger.log(`[Cache Refresh] ✓ Complete in ${duration}ms`);
    } catch (error) {
      this.logger.error(`[Cache Refresh] Failed: ${error.message}`);
    }
  }

  /**
   * Manual trigger for cache refresh (can be called via admin endpoint)
   */
  async triggerManualRefresh(): Promise<void> {
    this.logger.log('[Cache Refresh] Manual trigger requested');
    await this.handleCacheRefresh();
  }
}
