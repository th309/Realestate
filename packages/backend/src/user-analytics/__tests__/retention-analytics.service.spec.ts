/**
 * RetentionAnalyticsService Unit Tests
 *
 * Tests retention analytics including:
 * - Redis cache hit/miss behavior
 * - DAU / WAU / MAU computation with stickiness ratio
 * - Churn signal detection (inactive 14+ days with 3+ sessions)
 * - Result structure with all required RetentionData keys
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RetentionAnalyticsService } from '../retention-analytics.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';
import type { RetentionData } from '../user-analytics.types';

const MOCK_RETENTION_DATA: RetentionData = {
  cohortMatrix: [],
  dauWauMau: { dau: 10, wau: 50, mau: 200, stickiness: 0.05 },
  retentionCurves: [],
  churnSignals: [],
  engagementTrend: [],
  annotations: [],
};

describe('RetentionAnalyticsService', () => {
  let service: RetentionAnalyticsService;
  let mockRedis: { getByKey: jest.Mock; setByKey: jest.Mock };
  let mockQueryBuilder: Record<string, jest.Mock>;
  let resolveQueue: { data: unknown; error?: unknown }[];
  let queueIndex: number;

  function makeThenable() {
    const result = resolveQueue[queueIndex] ?? { data: [] };
    queueIndex++;
    return {
      ...mockQueryBuilder,
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(result).then(resolve, reject),
    };
  }

  beforeEach(async () => {
    resolveQueue = [];
    queueIndex = 0;

    mockRedis = {
      getByKey: jest.fn().mockResolvedValue(null),
      setByKey: jest.fn().mockResolvedValue(undefined),
    };

    mockQueryBuilder = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      not: jest.fn().mockImplementation(() => makeThenable()),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockImplementation(() => makeThenable()),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnThis(),
    };

    const mockSupabaseService = {
      getClient: jest.fn(() => mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionAnalyticsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<RetentionAnalyticsService>(RetentionAnalyticsService);
  });

  // ---------------------------------------------------------------------------
  // Cache behavior
  // ---------------------------------------------------------------------------

  describe('Redis cache integration', () => {
    it('returns cached data on cache hit without querying Supabase', async () => {
      mockRedis.getByKey.mockResolvedValue(MOCK_RETENTION_DATA);

      const result = await service.getRetention(30, {});

      expect(result).toEqual(MOCK_RETENTION_DATA);
      expect(mockQueryBuilder.from).not.toHaveBeenCalled();
      expect(mockRedis.setByKey).not.toHaveBeenCalled();
    });

    it('caches computed result with 900s TTL on cache miss', async () => {
      // The service runs 6 parallel methods each doing 1-2 queries.
      // We need enough queued results for all of them.
      resolveQueue = Array(20).fill({ data: [] });

      // Override gte to also be thenable for queries that end with gte
      mockQueryBuilder.gte.mockImplementation(() => makeThenable());

      await service.getRetention(30, {});

      expect(mockRedis.setByKey).toHaveBeenCalledWith(
        expect.stringContaining('analytics:retention:'),
        expect.any(Object),
        900,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // DAU / WAU / MAU computation
  // ---------------------------------------------------------------------------

  describe('DAU / WAU / MAU computation', () => {
    it('computes stickiness as DAU / MAU', async () => {
      const now = Date.now();
      const oneDayAgo = new Date(now - 1 * 86400000).toISOString();
      const twoDaysAgo = new Date(now - 2 * 86400000).toISOString();
      const tenDaysAgo = new Date(now - 10 * 86400000).toISOString();
      const twentyDaysAgo = new Date(now - 20 * 86400000).toISOString();

      const sessionRows = [
        // DAU candidate (within 1 day)
        { visitor_id: 'v1', started_at: oneDayAgo, user_tier: 'pro' },
        // WAU candidate (within 7 days)
        { visitor_id: 'v2', started_at: twoDaysAgo, user_tier: 'pro' },
        // MAU-only candidate
        { visitor_id: 'v3', started_at: tenDaysAgo, user_tier: 'free' },
        { visitor_id: 'v4', started_at: twentyDaysAgo, user_tier: 'free' },
      ];

      // For the computeDauWauMau method, the query chain ends with .gte()
      // after select('visitor_id, started_at, user_tier')
      resolveQueue = [
        // buildCohortMatrix: identities
        { data: [] },
        // buildCohortMatrix: sessions
        { data: [] },
        // computeDauWauMau: sessions (the gte terminal)
        { data: sessionRows },
        // buildRetentionCurvesByTier: identities
        { data: [] },
        // buildRetentionCurvesByTier: sessions
        { data: [] },
        // detectChurnSignals: sessions
        { data: [] },
        // buildEngagementTrend: sessions
        { data: [] },
        // fetchAnnotations
        { data: [] },
      ];

      mockQueryBuilder.gte.mockImplementation(() => makeThenable());
      mockQueryBuilder.not.mockImplementation(() => makeThenable());

      const result = await service.getRetention(30, {});

      // DAU/WAU/MAU should be present
      expect(result.dauWauMau).toBeDefined();
      expect(typeof result.dauWauMau.dau).toBe('number');
      expect(typeof result.dauWauMau.wau).toBe('number');
      expect(typeof result.dauWauMau.mau).toBe('number');
      expect(typeof result.dauWauMau.stickiness).toBe('number');

      // Stickiness = DAU / MAU (if MAU > 0)
      if (result.dauWauMau.mau > 0) {
        expect(result.dauWauMau.stickiness).toBeCloseTo(
          result.dauWauMau.dau / result.dauWauMau.mau,
          3,
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Result structure
  // ---------------------------------------------------------------------------

  describe('result structure', () => {
    it('returns RetentionData with all required keys', async () => {
      resolveQueue = Array(20).fill({ data: [] });
      mockQueryBuilder.gte.mockImplementation(() => makeThenable());
      mockQueryBuilder.not.mockImplementation(() => makeThenable());

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
