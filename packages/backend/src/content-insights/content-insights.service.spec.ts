import { ContentInsightsService } from './content-insights.service';
import type { AnalyticsSnapshotRow } from './insights.types';
import type { SupabaseService } from '../supabase/supabase.service';

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

/** Returns configured rows per table; ignores filters (the service does the
 *  window split + latest-per-post reduction in JS, which is what we test). */
function makeFakeSupabase(tables: {
  analytics_snapshots?: Array<Partial<AnalyticsSnapshotRow>>;
  posts?: Array<Record<string, unknown>>;
}) {
  function builder(table: string) {
    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      gt: () => q,
      gte: () => q,
      lte: () => q,
      order: () => q,
      limit: () => q,
      range: () => q,
      in: () => q,
      not: () => q,
      then: (resolve: (v: unknown) => void) =>
        resolve({
          data: (tables as Record<string, unknown[]>)[table] ?? [],
          error: null,
        }),
    });
    return q;
  }
  return {
    getClient: () => ({ from: (t: string) => builder(t) }),
  } as unknown as SupabaseService;
}

describe('ContentInsightsService', () => {
  describe('getOverview', () => {
    it('returns contract-correct zeros when there is no data', async () => {
      const service = new ContentInsightsService(makeFakeSupabase({}));
      const overview = await service.getOverview(30);

      expect(overview.totals).toEqual({
        reach: 0,
        engagement: 0,
        followersDelta: 0,
        posts: 0,
      });
      expect(overview.priorTotals.reach).toBe(0);
      expect(overview.perPlatform).toEqual([]);
      expect(typeof overview.window.from).toBe('string');
      expect(typeof overview.prior.from).toBe('string');
    });

    it('splits current vs prior windows and takes the latest snapshot per post', async () => {
      const snapshots: Array<Partial<AnalyticsSnapshotRow>> = [
        // postA in the current window, two captures → latest (100) wins
        {
          post_id: 'a',
          platform: 'instagram',
          reach: 80,
          engagement: 8,
          captured_at: daysAgo(2),
        },
        {
          post_id: 'a',
          platform: 'instagram',
          reach: 100,
          engagement: 10,
          captured_at: daysAgo(1),
        },
        // postC in the current window on x
        {
          post_id: 'c',
          platform: 'x',
          reach: 30,
          engagement: 3,
          captured_at: daysAgo(5),
        },
        // postB in the prior window
        {
          post_id: 'b',
          platform: 'instagram',
          reach: 50,
          engagement: 5,
          captured_at: daysAgo(40),
        },
      ];
      const service = new ContentInsightsService(
        makeFakeSupabase({ analytics_snapshots: snapshots }),
      );

      const overview = await service.getOverview(30);

      expect(overview.totals).toEqual({
        reach: 130,
        engagement: 13,
        followersDelta: 0,
        posts: 2,
      });
      expect(overview.priorTotals).toEqual({
        reach: 50,
        engagement: 5,
        followersDelta: 0,
        posts: 1,
      });
      expect(overview.perPlatform).toEqual([
        { platform: 'instagram', reach: 100, engagement: 10, posts: 1 },
        { platform: 'x', reach: 30, engagement: 3, posts: 1 },
      ]);
    });
  });

  describe('getPosts', () => {
    it('joins the latest snapshot and maps to the InsightPost contract', async () => {
      const service = new ContentInsightsService(
        makeFakeSupabase({
          posts: [
            {
              id: 'p1',
              platform: 'instagram',
              post_type: 'single',
              published_at: daysAgo(1),
              platform_post_id: 'https://ig/p1',
              copy: { hook: 'Rates dropped' },
            },
          ],
          analytics_snapshots: [
            {
              post_id: 'p1',
              reach: 100,
              engagement: 10,
              captured_at: daysAgo(1),
            },
          ],
        }),
      );

      const posts = await service.getPosts(30, 50);

      expect(posts).toEqual([
        {
          postId: 'p1',
          platform: 'instagram',
          postType: 'single',
          publishedAt: expect.any(String),
          permalink: 'https://ig/p1',
          reach: 100,
          engagement: 10,
          hook: 'Rates dropped',
        },
      ]);
    });

    it('returns [] when there are no published posts', async () => {
      const service = new ContentInsightsService(
        makeFakeSupabase({ posts: [] }),
      );
      expect(await service.getPosts(30, 50)).toEqual([]);
    });
  });
});
