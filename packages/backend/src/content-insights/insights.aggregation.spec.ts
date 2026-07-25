import {
  computePerPlatform,
  computeTotals,
  computeWindows,
  latestSnapshotPerPost,
} from './insights.aggregation';
import type { AnalyticsSnapshotRow } from './insights.types';

function snap(over: Partial<AnalyticsSnapshotRow>): AnalyticsSnapshotRow {
  return {
    post_id: 'p1',
    brand_id: 'b1',
    platform: 'instagram',
    reach: 0,
    engagement: 0,
    followers_delta: null,
    captured_at: '2026-07-01T00:00:00.000Z',
    ...over,
  };
}

describe('insights aggregation', () => {
  describe('computeWindows', () => {
    it('splits current (now-days, now] and prior (now-2days, now-days]', () => {
      const now = new Date('2026-07-31T00:00:00.000Z');
      const { current, prior } = computeWindows(now, 30);
      expect(current.to).toBe('2026-07-31T00:00:00.000Z');
      expect(current.from).toBe('2026-07-01T00:00:00.000Z');
      expect(prior.to).toBe('2026-07-01T00:00:00.000Z');
      expect(prior.from).toBe('2026-06-01T00:00:00.000Z');
    });
  });

  describe('latestSnapshotPerPost', () => {
    it('keeps each post’s most recent snapshot', () => {
      const rows = [
        snap({ post_id: 'p1', reach: 80, captured_at: '2026-07-01T00:00:00Z' }),
        snap({
          post_id: 'p1',
          reach: 100,
          captured_at: '2026-07-02T00:00:00Z',
        }),
        snap({ post_id: 'p2', reach: 40, captured_at: '2026-07-01T00:00:00Z' }),
      ];
      const latest = latestSnapshotPerPost(rows);
      const p1 = latest.find((r) => r.post_id === 'p1');
      expect(latest).toHaveLength(2);
      expect(p1?.reach).toBe(100);
    });
  });

  describe('computeTotals', () => {
    it('sums reach/engagement/followers and counts distinct posts', () => {
      const totals = computeTotals([
        snap({ post_id: 'p1', reach: 100, engagement: 10, followers_delta: 5 }),
        snap({
          post_id: 'p2',
          reach: 40,
          engagement: 4,
          followers_delta: null,
        }),
      ]);
      expect(totals).toEqual({
        reach: 140,
        engagement: 14,
        followersDelta: 5,
        posts: 2,
      });
    });

    it('returns zeros for empty input', () => {
      expect(computeTotals([])).toEqual({
        reach: 0,
        engagement: 0,
        followersDelta: 0,
        posts: 0,
      });
    });
  });

  describe('computePerPlatform', () => {
    it('rolls up by platform, sorted by reach desc', () => {
      const perPlatform = computePerPlatform([
        snap({
          post_id: 'p1',
          platform: 'instagram',
          reach: 100,
          engagement: 10,
        }),
        snap({
          post_id: 'p2',
          platform: 'instagram',
          reach: 50,
          engagement: 5,
        }),
        snap({ post_id: 'p3', platform: 'x', reach: 200, engagement: 20 }),
      ]);
      expect(perPlatform).toEqual([
        { platform: 'x', reach: 200, engagement: 20, posts: 1 },
        { platform: 'instagram', reach: 150, engagement: 15, posts: 2 },
      ]);
    });
  });
});
