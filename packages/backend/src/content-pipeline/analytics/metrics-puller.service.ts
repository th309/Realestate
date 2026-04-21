import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { YouTubeMetricsService } from './youtube-metrics.service';

/**
 * Pulls post-publish metrics for platform posts within a given window and
 * writes the normalized numbers into the content_metrics table. P1 only
 * supports YouTube (shorts + long form); other platforms are skipped
 * silently and will be added in later phases.
 */
@Injectable()
export class MetricsPullerService {
  private readonly logger = new Logger(MetricsPullerService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly youtube: YouTubeMetricsService,
  ) {}

  async pullWindow(window: '24h' | '7d' | '30d'): Promise<number> {
    const hoursBack = window === '24h' ? 24 : window === '7d' ? 168 : 720;
    const lowerBound = new Date(Date.now() - (hoursBack + 12) * 3600 * 1000);
    const upperBound = new Date(Date.now() - (hoursBack - 12) * 3600 * 1000);

    const client = this.supabase.getClient();
    const { data: posts } = await client
      .from('platform_posts')
      .select('id, platform, external_id, created_at, short_link_id')
      .eq('status', 'posted')
      .gte('created_at', lowerBound.toISOString())
      .lt('created_at', upperBound.toISOString());
    if (!posts) return 0;

    let count = 0;
    for (const post of posts) {
      const existing = await client
        .from('content_metrics')
        .select('id')
        .eq('platform_post_id', post.id)
        .eq('pulled_at_window', window)
        .maybeSingle();
      if (existing.data) continue;

      if (
        post.platform === 'youtube_shorts' ||
        post.platform === 'youtube_long'
      ) {
        try {
          const metrics = await this.youtube.fetchMetrics(
            post.external_id,
            window,
          );
          const clickCount = post.short_link_id
            ? ((
                await client
                  .from('short_links')
                  .select('click_count')
                  .eq('id', post.short_link_id)
                  .single()
              ).data?.click_count ?? 0)
            : 0;
          await client.from('content_metrics').insert({
            platform_post_id: post.id,
            pulled_at_window: window,
            ...metrics,
            short_link_clicks: clickCount,
          });
          count++;
        } catch (err) {
          this.logger.warn(
            `failed to pull metrics for post ${post.id}: ${(err as Error).message}`,
          );
        }
      }
    }
    return count;
  }
}
