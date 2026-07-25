import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  computePerPlatform,
  computeTotals,
  computeWindows,
  latestSnapshotPerPost,
} from './insights.aggregation';
import type {
  AnalyticsSnapshotRow,
  InsightPost,
  InsightsOverview,
  InsightsWindow,
} from './insights.types';

const SNAP = 'analytics_snapshots';
const POSTS = 'posts';
const PAGE = 1000;

interface PublishedPostRow {
  id: string;
  platform: string;
  post_type: string;
  published_at: string;
  platform_post_id: string | null;
  copy: Record<string, unknown> | null;
}

/**
 * Reads the content-pipeline insights contract from analytics_snapshots (+
 * posts). Aggregation is done in-process (see insights.aggregation.ts) so it
 * stays unit-testable; at large scale the window rollup should move to a
 * Postgres RPC. Empty data yields contract-correct zeros/[] — the frontend
 * renders its empty state.
 */
@Injectable()
export class ContentInsightsService {
  private readonly logger = new Logger(ContentInsightsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Reach/engagement/follower totals for the last `days`, plus the prior window. */
  async getOverview(days: number, brandId?: string): Promise<InsightsOverview> {
    const { current, prior } = computeWindows(new Date(), days);
    // One fetch spans both windows (prior.from → current.to); split in JS.
    const rows = await this.fetchSnapshots(prior.from, current.to, brandId);
    const curLatest = latestSnapshotPerPost(
      rows.filter((r) => inWindow(r, current)),
    );
    const priorLatest = latestSnapshotPerPost(
      rows.filter((r) => inWindow(r, prior)),
    );

    return {
      window: current,
      prior,
      totals: computeTotals(curLatest),
      priorTotals: computeTotals(priorLatest),
      perPlatform: computePerPlatform(curLatest),
    };
  }

  /** Per-post performance for the last `days`, newest first. */
  async getPosts(
    days: number,
    limit: number,
    brandId?: string,
  ): Promise<InsightPost[]> {
    const { current } = computeWindows(new Date(), days);
    const posts = await this.fetchPublishedPosts(
      current.from,
      current.to,
      limit,
      brandId,
    );
    if (posts.length === 0) return [];

    const snaps = await this.fetchSnapshotsForPosts(posts.map((p) => p.id));
    const latestByPost = new Map<string, AnalyticsSnapshotRow>();
    for (const s of latestSnapshotPerPost(snaps)) {
      if (s.post_id) latestByPost.set(s.post_id, s);
    }

    return posts.map((p) => {
      const s = latestByPost.get(p.id);
      return {
        postId: p.id,
        platform: p.platform,
        postType: p.post_type,
        publishedAt: p.published_at,
        permalink: p.platform_post_id ?? null,
        reach: s?.reach ?? 0,
        engagement: s?.engagement ?? 0,
        hook: (p.copy?.hook as string) ?? (p.copy?.body as string) ?? null,
      };
    });
  }

  private async fetchSnapshots(
    from: string,
    to: string,
    brandId?: string,
  ): Promise<AnalyticsSnapshotRow[]> {
    const all: AnalyticsSnapshotRow[] = [];
    for (let offset = 0; ; offset += PAGE) {
      let q = this.supabase
        .getClient()
        .from(SNAP)
        .select(
          'post_id, brand_id, platform, reach, engagement, followers_delta, captured_at',
        )
        .gt('captured_at', from)
        .lte('captured_at', to)
        .order('captured_at', { ascending: false })
        .order('id', { ascending: false }) // deterministic page boundaries
        .range(offset, offset + PAGE - 1);
      if (brandId) q = q.eq('brand_id', brandId);

      const { data, error } = await q;
      if (error) {
        this.logger.error(`snapshot fetch failed: ${error.message}`);
        throw new Error(`Failed to read analytics: ${error.message}`);
      }
      const batch = (data ?? []) as AnalyticsSnapshotRow[];
      all.push(...batch);
      if (batch.length < PAGE) break;
    }
    return all;
  }

  private async fetchPublishedPosts(
    from: string,
    to: string,
    limit: number,
    brandId?: string,
  ): Promise<PublishedPostRow[]> {
    let q = this.supabase
      .getClient()
      .from(POSTS)
      .select('id, platform, post_type, published_at, platform_post_id, copy')
      .eq('status', 'published')
      .gt('published_at', from)
      .lte('published_at', to)
      .order('published_at', { ascending: false })
      .limit(limit);
    if (brandId) q = q.eq('brand_id', brandId);

    const { data, error } = await q;
    if (error) {
      this.logger.error(`published-posts fetch failed: ${error.message}`);
      throw new Error(`Failed to read posts: ${error.message}`);
    }
    return (data ?? []) as PublishedPostRow[];
  }

  private async fetchSnapshotsForPosts(
    postIds: string[],
  ): Promise<AnalyticsSnapshotRow[]> {
    if (postIds.length === 0) return [];
    // Paginate + id tiebreaker like fetchSnapshots — without this, a post set
    // whose snapshots exceed one 1000-row page silently truncates and
    // latest-per-post goes stale (the documented Supabase max-rows gotcha).
    const all: AnalyticsSnapshotRow[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await this.supabase
        .getClient()
        .from(SNAP)
        .select(
          'post_id, brand_id, platform, reach, engagement, followers_delta, captured_at',
        )
        .in('post_id', postIds)
        .order('captured_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (error) {
        this.logger.error(`post-snapshot fetch failed: ${error.message}`);
        throw new Error(`Failed to read analytics: ${error.message}`);
      }
      const batch = (data ?? []) as AnalyticsSnapshotRow[];
      all.push(...batch);
      if (batch.length < PAGE) break;
    }
    return all;
  }
}

function inWindow(row: AnalyticsSnapshotRow, w: InsightsWindow): boolean {
  return row.captured_at > w.from && row.captured_at <= w.to;
}
