import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LateClientService } from '../social-connect/late-client.service';
import { SOCIAL_PLATFORMS } from '../social-connect/late-client.types';
import { extractPostMetrics } from './insights-metrics.helpers';

const SNAP = 'analytics_snapshots';
const POSTS = 'posts';
const CONN = 'platform_connections';
/** Refresh metrics for posts published within this lookback (Late's default is 90d). */
const PULL_LOOKBACK_DAYS = 90;

interface RefreshablePost {
  id: string;
  platform: string;
  platform_post_id: string | null;
}

/**
 * Pulls per-post metrics from Late's analytics API and appends point-in-time
 * rows to analytics_snapshots. Env-gated: no-ops (logs once) without LATE_API_KEY.
 *
 * YouTube is NOT covered in v1 — the existing youtube-metrics service targets
 * the video pipeline's run model, not feed posts. YouTube post metrics are a
 * documented follow-up; only the 5 Late platforms are refreshed here.
 * followers_delta is left null (brand-level follower tracking is a follow-up too;
 * the frontend renders "New"/em-dash for null).
 */
@Injectable()
export class InsightsMetricsPullService {
  private readonly logger = new Logger(InsightsMetricsPullService.name);
  private loggedNotConfigured = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly late: LateClientService,
  ) {}

  async pullAll(): Promise<{ captured: number; failed: number }> {
    if (!this.late.isConfigured()) {
      if (!this.loggedNotConfigured) {
        this.logger.warn(
          'LATE_API_KEY not set — insights metrics pull is paused.',
        );
        this.loggedNotConfigured = true;
      }
      return { captured: 0, failed: 0 };
    }
    this.loggedNotConfigured = false;

    let captured = 0;
    let failed = 0;
    for (const brandId of await this.connectedBrandIds()) {
      for (const post of await this.postsToRefresh(brandId)) {
        try {
          const raw = await this.late.getAnalytics({
            postId: post.platform_post_id ?? undefined,
          });
          const { reach, engagement } = extractPostMetrics(raw);
          await this.writeSnapshot(post, brandId, reach, engagement);
          captured += 1;
        } catch (err) {
          this.logger.warn(
            `analytics pull failed for post ${post.id}: ${String(err)}`,
          );
          failed += 1;
        }
      }
    }
    return { captured, failed };
  }

  private async connectedBrandIds(): Promise<string[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from(CONN)
      .select('brand_id')
      .eq('provider', 'late')
      .eq('status', 'connected');
    if (error) {
      this.logger.error(`connected-brands fetch failed: ${error.message}`);
      return [];
    }
    const ids = new Set<string>();
    for (const row of (data ?? []) as Array<{ brand_id: string }>) {
      if (row.brand_id) ids.add(row.brand_id);
    }
    return [...ids];
  }

  private async postsToRefresh(brandId: string): Promise<RefreshablePost[]> {
    const since = new Date(
      Date.now() - PULL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from(POSTS)
      .select('id, platform, platform_post_id')
      .eq('brand_id', brandId)
      .eq('status', 'published')
      .in('platform', SOCIAL_PLATFORMS as unknown as string[])
      .not('platform_post_id', 'is', null)
      .gte('published_at', since);
    if (error) {
      this.logger.error(`refreshable-posts fetch failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as RefreshablePost[];
  }

  private async writeSnapshot(
    post: RefreshablePost,
    brandId: string,
    reach: number,
    engagement: number,
  ): Promise<void> {
    const { error } = await this.supabase.getClient().from(SNAP).insert({
      post_id: post.id,
      brand_id: brandId,
      platform: post.platform,
      reach,
      engagement,
      followers_delta: null,
      captured_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
}
