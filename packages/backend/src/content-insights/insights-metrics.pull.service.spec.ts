import { InsightsMetricsPullService } from './insights-metrics.pull.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { LateClientService } from '../social-connect/late-client.service';

function makeFakeSupabase(opts: {
  conns?: Array<{ brand_id: string }>;
  posts?: Array<Record<string, unknown>>;
  inserted: Array<Record<string, unknown>>;
}) {
  function builder(table: string) {
    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      in: () => q,
      not: () => q,
      gte: () => q,
      upsert: (row: Record<string, unknown>) => {
        opts.inserted.push(row);
        return Promise.resolve({ error: null });
      },
      then: (resolve: (v: unknown) => void) => {
        const data =
          table === 'platform_connections'
            ? (opts.conns ?? [])
            : table === 'posts'
              ? (opts.posts ?? [])
              : [];
        resolve({ data, error: null });
      },
    });
    return q;
  }
  return {
    getClient: () => ({ from: (t: string) => builder(t) }),
  } as unknown as SupabaseService;
}

describe('InsightsMetricsPullService', () => {
  it('no-ops (never calls Late) when LATE_API_KEY is missing', async () => {
    const late = {
      isConfigured: () => false,
      getAnalytics: jest.fn(),
    } as unknown as LateClientService;
    const service = new InsightsMetricsPullService(
      makeFakeSupabase({ inserted: [] }),
      late,
    );

    const result = await service.pullAll();

    expect(result).toEqual({ captured: 0, failed: 0 });
    expect(late.getAnalytics).not.toHaveBeenCalled();
  });

  it('pulls Late analytics per post and writes a snapshot row', async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const late = {
      isConfigured: () => true,
      getAnalytics: jest.fn().mockResolvedValue({
        analytics: { reach: 100, likes: 5, comments: 2 },
      }),
    } as unknown as LateClientService;
    const service = new InsightsMetricsPullService(
      makeFakeSupabase({
        conns: [{ brand_id: 'b1' }],
        posts: [{ id: 'p1', platform: 'instagram', platform_post_id: 'ext1' }],
        inserted,
      }),
      late,
    );

    const result = await service.pullAll();

    expect(result).toEqual({ captured: 1, failed: 0 });
    expect(late.getAnalytics).toHaveBeenCalledWith({ postId: 'ext1' });
    expect(inserted).toEqual([
      {
        post_id: 'p1',
        brand_id: 'b1',
        platform: 'instagram',
        reach: 100,
        engagement: 7,
        followers_delta: null,
        captured_at: expect.any(String),
        captured_date: expect.any(String),
      },
    ]);
  });

  it('counts a failed pull without writing a snapshot', async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const late = {
      isConfigured: () => true,
      getAnalytics: jest.fn().mockRejectedValue(new Error('late 500')),
    } as unknown as LateClientService;
    const service = new InsightsMetricsPullService(
      makeFakeSupabase({
        conns: [{ brand_id: 'b1' }],
        posts: [{ id: 'p1', platform: 'instagram', platform_post_id: 'ext1' }],
        inserted,
      }),
      late,
    );

    const result = await service.pullAll();

    expect(result).toEqual({ captured: 0, failed: 1 });
    expect(inserted).toHaveLength(0);
  });
});
