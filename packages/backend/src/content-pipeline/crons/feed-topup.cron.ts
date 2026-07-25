import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FeedService } from '../feed/feed.service';

/**
 * Keeps the content feed topped up with pending_review drafts. Runs every 30
 * minutes; FeedService.topUp() no-ops when already at target, paused, or over
 * budget, so a frequent schedule is safe. Set CONTENT_FEED_CRON_DISABLED=true
 * to disable (e.g. in environments without DeepSeek credentials).
 */
@Injectable()
export class FeedTopUpCron {
  private readonly logger = new Logger(FeedTopUpCron.name);

  constructor(private readonly feed: FeedService) {}

  @Cron('*/30 * * * *')
  async run(): Promise<void> {
    if (process.env.CONTENT_FEED_CRON_DISABLED === 'true') return;
    try {
      await this.feed.topUp();
    } catch (err) {
      this.logger.error(`feed top-up cron failed: ${(err as Error).message}`);
    }
  }
}
