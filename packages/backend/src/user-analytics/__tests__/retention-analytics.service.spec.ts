/**
 * RetentionAnalyticsService, with regression guards for the defects that were
 * live on /admin/analytics?tab=retention:
 *
 *  1. Every panel was built from `client.from('user_sessions').select(...)` with
 *     no `.range()`. PostgREST caps that at 1,000 rows silently, so DAU/WAU/MAU
 *     described at most 1,000 of ~48,000 trailing-30-day sessions.
 *  2. The churn query carried no date predicate at all — a bug independent of
 *     the cap. It scanned all history, so accounts that went quiet long ago were
 *     reported as fresh churn signals.
 *  3. The Redis key omitted the traffic segment, so a cached bot view could be
 *     served under a human label.
 *
 * None of these are visible to a test that only checks the response shape, which
 * is what the previous version of this file did.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RetentionAnalyticsService } from '../retention-analytics.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';
import type { RetentionData } from '../user-analytics.types';

const DAY_MS = 86_400_000;

const MOCK_RETENTION_DATA: RetentionData = {
  cohortMatrix: [],
  dauWauMau: { dau: 10, wau: 50, mau: 200, stickiness: 0.05 },
  retentionCurves: [],
  churnSignals: [],
  engagementTrend: [],
  annotations: [],
};

/** The live human-segment shape: numeric columns arrive as strings. */
const ACTIVE_USERS_ROW = {
  dau: 34,
  wau: 285,
  mau: 678,
  stickiness: '0.0501',
};

/** A cohort as the RPC emits it: leading counts padded to the 12-week matrix. */
const cohort = (
  tier: string,
  cohortWeek: string,
  cohortSize: number,
  active: number[],
) => ({
  tier,
  cohort_week: cohortWeek,
  cohort_size: cohortSize,
  weekly_active: [...active, ...Array(12 - active.length).fill(0)],
});

const COHORT_ROWS = [
  cohort('__all__', '2026-06-22', 4, [4, 3, 1]),
  cohort('__all__', '2026-06-15', 2, [2]),
];

const TIER_COHORT_ROWS = [
  cohort('pro', '2026-06-22', 4, [4, 2]),
  cohort('free', '2026-06-22', 10, [10, 1]),
];

const CHURN_ROWS = [
  {
    user_id: '29509790-b00e-4e14-9d5b-644c311c5437',
    last_seen: '2026-07-07T02:00:00.495Z',
    session_count: '3',
    tier: 'pro',
  },
  {
    user_id: '206a9531-68d5-463a-9805-29ec2ca77994',
    last_seen: '2026-07-03T02:00:00.272Z',
    session_count: 4,
    tier: null,
  },
];

const DAILY_VISITOR_ROWS = [
  { day: '2026-07-27', visitors: '10', sessions: 12 },
  { day: '2026-07-28', visitors: 20, sessions: 25 },
];

describe('RetentionAnalyticsService', () => {
  let service: RetentionAnalyticsService;
  let mockRedis: { getByKey: jest.Mock; setByKey: jest.Mock };
  let rpc: jest.Mock;
  let from: jest.Mock;
  let rpcResponses: Record<string, { data: unknown; error?: unknown }>;

  /** Args the service passed to a given RPC. Fails loudly if never called. */
  function argsFor(fn: string): Record<string, any> {
    const call = rpc.mock.calls.find(([name]) => name === fn);
    if (!call) {
      throw new Error(
        `rpc('${fn}') was never called. Called: ${rpc.mock.calls
          .map(([n]) => n)
          .join(', ')}`,
      );
    }
    return call[1];
  }

  beforeEach(async () => {
    rpcResponses = {
      analytics_active_users: { data: [ACTIVE_USERS_ROW], error: null },
      analytics_cohort_retention: { data: [], error: null },
      analytics_churn_risk_users: { data: [], error: null },
      analytics_daily_visitors: { data: [], error: null },
    };

    rpc = jest.fn((fn: string) =>
      Promise.resolve(rpcResponses[fn] ?? { data: [], error: null }),
    );

    // Only `analytics_annotations` is still read as a table — a small curated
    // list, not a session firehose.
    const annotationsBuilder: Record<string, jest.Mock> = {
      select: jest.fn(() => annotationsBuilder),
      gte: jest.fn(() => annotationsBuilder),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    from = jest.fn(() => annotationsBuilder);

    mockRedis = {
      getByKey: jest.fn().mockResolvedValue(null),
      setByKey: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionAnalyticsService,
        {
          provide: SupabaseService,
          useValue: { getClient: jest.fn(() => ({ rpc, from })) },
        },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<RetentionAnalyticsService>(RetentionAnalyticsService);
  });

  // ---------------------------------------------------------------------------
  // The truncation bug itself
  // ---------------------------------------------------------------------------

  describe('no panel is built from an unranged table read', () => {
    it('never selects from user_sessions or visitor_identities', async () => {
      await service.getRetention(30, {});

      const tables = from.mock.calls.map(([t]) => t);
      expect(tables).not.toContain('user_sessions');
      expect(tables).not.toContain('visitor_identities');
      expect(tables).toEqual(['analytics_annotations']);
    });

    it('sources all five data panels from SQL aggregates', async () => {
      await service.getRetention(30, {});

      const called = rpc.mock.calls.map(([fn]) => fn);
      expect(called).toContain('analytics_active_users');
      expect(called).toContain('analytics_churn_risk_users');
      expect(called).toContain('analytics_daily_visitors');
      // Once for the matrix, once split by tier.
      expect(
        called.filter((f) => f === 'analytics_cohort_retention'),
      ).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // DAU / WAU / MAU
  // ---------------------------------------------------------------------------

  describe('DAU / WAU / MAU', () => {
    it('reads the aggregate rather than counting fetched sessions, coercing the numerics that arrive as strings', async () => {
      const result = await service.getRetention(30, {});

      expect(result.dauWauMau).toEqual({
        dau: 34,
        wau: 285,
        mau: 678,
        stickiness: 0.0501,
      });
    });

    it('defaults the segment to human, since visitor_id counts are meaningless with crawlers in them', async () => {
      await service.getRetention(30, {});
      expect(argsFor('analytics_active_users').p_traffic).toBe('human');
    });

    it('passes the requested segment and tier through', async () => {
      await service.getRetention(30, { traffic: 'bot', tier: 'pro' });

      expect(argsFor('analytics_active_users')).toEqual({
        p_traffic: 'bot',
        p_tier: 'pro',
      });
    });

    it('returns zeros rather than a partial figure when the rpc fails', async () => {
      rpcResponses.analytics_active_users = {
        data: null,
        error: { message: 'boom' },
      };

      const { dauWauMau } = await service.getRetention(30, {});
      expect(dauWauMau).toEqual({ dau: 0, wau: 0, mau: 0, stickiness: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // Cohort matrix
  // ---------------------------------------------------------------------------

  describe('cohort matrix', () => {
    beforeEach(() => {
      rpcResponses.analytics_cohort_retention = {
        data: COHORT_ROWS,
        error: null,
      };
    });

    it('asks for the unsplit matrix over a 12-week window', async () => {
      await service.getRetention(30, {});

      const args = argsFor('analytics_cohort_retention');
      expect(args.p_weeks).toBe(12);
      expect(args.p_by_tier).toBe(false);
      expect(args.p_tier).toBeNull();
      expect(Date.parse(args.p_start)).not.toBeNaN();
    });

    it('turns weekly counts into percentages with week 0 pinned at 100', async () => {
      const { cohortMatrix } = await service.getRetention(30, {});

      const cohort = cohortMatrix.find((c) => c.cohort === '2026-06-22')!;
      expect(cohort.cohortSize).toBe(4);
      expect(cohort.weeks).toEqual([100, 75, 25]);
    });

    it('stops a cohort at its first empty week instead of trailing zeros', async () => {
      const { cohortMatrix } = await service.getRetention(30, {});

      expect(
        cohortMatrix.find((c) => c.cohort === '2026-06-15')!.weeks,
      ).toEqual([100]);
    });

    it('orders cohorts oldest first regardless of rpc row order', async () => {
      const { cohortMatrix } = await service.getRetention(30, {});
      expect(cohortMatrix.map((c) => c.cohort)).toEqual([
        '2026-06-15',
        '2026-06-22',
      ]);
    });

    it('is empty, not partial, when the rpc fails', async () => {
      rpcResponses.analytics_cohort_retention = {
        data: null,
        error: { message: 'boom' },
      };

      const { cohortMatrix, retentionCurves } = await service.getRetention(
        30,
        {},
      );
      expect(cohortMatrix).toEqual([]);
      expect(retentionCurves).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Retention curves by tier
  // ---------------------------------------------------------------------------

  describe('retention curves by tier', () => {
    it('requests the tier split and builds one curve per tier', async () => {
      rpcResponses.analytics_cohort_retention = {
        data: TIER_COHORT_ROWS,
        error: null,
      };

      const { retentionCurves } = await service.getRetention(30, {});

      const byTier = rpc.mock.calls.filter(
        ([fn, args]) => fn === 'analytics_cohort_retention' && args.p_by_tier,
      );
      expect(byTier).toHaveLength(1);

      expect(retentionCurves).toEqual(
        expect.arrayContaining([
          { tier: 'pro', curve: [100, 50] },
          { tier: 'free', curve: [100, 10] },
        ]),
      );
    });

    it('never surfaces the unsplit sentinel tier as a curve', async () => {
      rpcResponses.analytics_cohort_retention = {
        data: COHORT_ROWS,
        error: null,
      };

      const { retentionCurves } = await service.getRetention(30, {});
      expect(retentionCurves.map((c) => c.tier)).not.toContain('__all__');
      expect(retentionCurves).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Churn signals — the missing date bound
  // ---------------------------------------------------------------------------

  describe('churn signals', () => {
    beforeEach(() => {
      rpcResponses.analytics_churn_risk_users = {
        data: CHURN_ROWS,
        error: null,
      };
    });

    it('bounds the scan by date instead of reading all history', async () => {
      const before = Date.now();
      await service.getRetention(30, {});

      const start = Date.parse(argsFor('analytics_churn_risk_users').p_start);
      expect(start).toBeGreaterThan(before - 91 * DAY_MS);
      expect(start).toBeLessThanOrEqual(before);
    });

    it('still looks back a quarter on a 7-day view, so the panel is not empty by construction', async () => {
      const before = Date.now();
      await service.getRetention(7, {});

      // 7 days back would sit inside the 14-day inactivity threshold, making
      // "active recently AND silent for 14 days" unsatisfiable.
      const start = Date.parse(argsFor('analytics_churn_risk_users').p_start);
      expect(before - start).toBeGreaterThanOrEqual(89 * DAY_MS);
    });

    it('widens to the selected window when that window is longer', async () => {
      const before = Date.now();
      await service.getRetention(365, {});

      const start = Date.parse(argsFor('analytics_churn_risk_users').p_start);
      expect(before - start).toBeGreaterThanOrEqual(364 * DAY_MS);
    });

    it('sends the churn thresholds and a bounded row limit', async () => {
      await service.getRetention(30, { tier: 'pro' });

      const args = argsFor('analytics_churn_risk_users');
      expect(args.p_inactive_days).toBe(14);
      expect(args.p_min_sessions).toBe(3);
      expect(args.p_limit).toBe(100);
      expect(args.p_tier).toBe('pro');
    });

    it('maps rows onto ChurnRiskUser, coercing the count and keeping a null tier null', async () => {
      const { churnSignals } = await service.getRetention(30, {});

      expect(churnSignals).toEqual([
        {
          userId: '29509790-b00e-4e14-9d5b-644c311c5437',
          lastSeen: '2026-07-07T02:00:00.495Z',
          sessionCount: 3,
          tier: 'pro',
          topFeatures: [],
        },
        {
          userId: '206a9531-68d5-463a-9805-29ec2ca77994',
          lastSeen: '2026-07-03T02:00:00.272Z',
          sessionCount: 4,
          tier: null,
          topFeatures: [],
        },
      ]);
    });

    it('is empty when the rpc fails', async () => {
      rpcResponses.analytics_churn_risk_users = {
        data: null,
        error: { message: 'boom' },
      };

      const { churnSignals } = await service.getRetention(30, {});
      expect(churnSignals).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Engagement trend
  // ---------------------------------------------------------------------------

  describe('engagement trend', () => {
    it('uses the daily rollup and honours the segment instead of hardcoding humans', async () => {
      rpcResponses.analytics_daily_visitors = {
        data: DAILY_VISITOR_ROWS,
        error: null,
      };

      const { engagementTrend } = await service.getRetention(30, {
        traffic: 'unclassified',
      });

      expect(argsFor('analytics_daily_visitors').p_traffic).toBe(
        'unclassified',
      );
      expect(engagementTrend).toEqual([
        { date: '2026-07-27', value: 10 },
        { date: '2026-07-28', value: 20 },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // Cache
  // ---------------------------------------------------------------------------

  describe('Redis cache', () => {
    it('returns cached data without issuing a query', async () => {
      mockRedis.getByKey.mockResolvedValue(MOCK_RETENTION_DATA);

      const result = await service.getRetention(30, {});

      expect(result).toEqual(MOCK_RETENTION_DATA);
      expect(rpc).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
      expect(mockRedis.setByKey).not.toHaveBeenCalled();
    });

    it('caches the computed result for 900s', async () => {
      await service.getRetention(30, {});

      expect(mockRedis.setByKey).toHaveBeenCalledWith(
        expect.stringContaining('analytics:retention:'),
        expect.any(Object),
        900,
      );
    });

    it('writes different keys per traffic segment', async () => {
      await service.getRetention(30, { traffic: 'human' });
      await service.getRetention(30, { traffic: 'bot' });

      const [humanKey] = mockRedis.setByKey.mock.calls[0];
      const [botKey] = mockRedis.setByKey.mock.calls[1];

      expect(humanKey).not.toEqual(botKey);
      expect(humanKey).toContain('human');
      expect(botKey).toContain('bot');
    });

    it('reads the segment-specific key, so a cached bot view cannot serve a human request', async () => {
      await service.getRetention(30, { traffic: 'bot' });
      const [botReadKey] = mockRedis.getByKey.mock.calls[0];

      mockRedis.getByKey.mockClear();
      await service.getRetention(30, { traffic: 'human' });
      const [humanReadKey] = mockRedis.getByKey.mock.calls[0];

      expect(botReadKey).not.toEqual(humanReadKey);
    });

    it('labels an unsegmented request with the default rather than leaving it blank', async () => {
      await service.getRetention(30, {});

      const [key] = mockRedis.setByKey.mock.calls[0];
      expect(key).toContain(':human:');
    });
  });

  // ---------------------------------------------------------------------------
  // Result structure
  // ---------------------------------------------------------------------------

  describe('result structure', () => {
    it('returns RetentionData with all required keys', async () => {
      const result = await service.getRetention(30, {});

      expect(result).toHaveProperty('cohortMatrix');
      expect(result).toHaveProperty('dauWauMau');
      expect(result).toHaveProperty('retentionCurves');
      expect(result).toHaveProperty('churnSignals');
      expect(result).toHaveProperty('engagementTrend');
      expect(result).toHaveProperty('annotations');
      expect(Array.isArray(result.cohortMatrix)).toBe(true);
      expect(Array.isArray(result.retentionCurves)).toBe(true);
      expect(Array.isArray(result.churnSignals)).toBe(true);
    });
  });
});
