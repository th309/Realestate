import { extractPostMetrics } from './insights-metrics.helpers';

describe('extractPostMetrics', () => {
  it('reads reach and sums the interaction metrics', () => {
    const metrics = extractPostMetrics({
      analytics: {
        reach: 1000,
        impressions: 1500,
        likes: 10,
        comments: 4,
        shares: 2,
        saves: 1,
        clicks: 99,
        engagementRate: 0.5,
      },
    });
    // reach prefers reach over impressions; engagement = likes+comments+shares+saves
    expect(metrics).toEqual({ reach: 1000, engagement: 17 });
  });

  it('falls back to impressions when reach is absent', () => {
    expect(extractPostMetrics({ analytics: { impressions: 500 } })).toEqual({
      reach: 500,
      engagement: 0,
    });
  });

  it('is defensive against missing/empty payloads', () => {
    expect(extractPostMetrics(undefined)).toEqual({ reach: 0, engagement: 0 });
    expect(extractPostMetrics({})).toEqual({ reach: 0, engagement: 0 });
    expect(extractPostMetrics({ analytics: {} })).toEqual({
      reach: 0,
      engagement: 0,
    });
  });
});
