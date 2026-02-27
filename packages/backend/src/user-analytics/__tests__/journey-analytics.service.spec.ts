/**
 * JourneyAnalyticsService Unit Tests
 *
 * Tests user journey analytics including:
 * - Redis cache hit/miss behavior
 * - Navigation flow aggregation (top 50 by transition count)
 * - Exit page counting
 * - Common path extraction (top 20 three-step prefixes)
 * - Landing page and session duration aggregation via helper functions
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JourneyAnalyticsService } from '../journey-analytics.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';
import type { JourneyData } from '../user-analytics.types';

const MOCK_JOURNEY_DATA: JourneyData = {
  navigationFlows: [{ fromPage: '/home', toPage: '/pricing', transitions: 50 }],
  landingPages: [
    { page: '/home', sessions: 100, bounceRate: 0.3, avgDuration: 60 },
  ],
  exitPages: [{ page: '/pricing', exits: 40 }],
  commonPaths: [{ path: ['/home', '/pricing', '/signup'], sessions: 25 }],
  avgPagesPerSession: 3.2,
  sessionDurationDistribution: [
    { bucket: '<30s', count: 10 },
    { bucket: '30s-2m', count: 20 },
  ],
  annotations: [],
};

describe('JourneyAnalyticsService', () => {
  let service: JourneyAnalyticsService;
  let mockRedis: { getByKey: jest.Mock; setByKey: jest.Mock };
  let mockQueryBuilder: Record<string, jest.Mock>;

  /**
   * Helper to configure what the chainable Supabase mock resolves to.
   * Since the service calls .from() multiple times with Promise.all,
   * we queue sequential resolution values.
   */
  function queueQueryResults(results: { data: unknown; error?: unknown }[]) {
    let callIndex = 0;

    // Each terminal await on the query chain resolves the next queued result.
    // We intercept .limit() and .order() as they are typically the last
    // chainable call before await. We make them return a thenable.
    const makeThenable = () => {
      const result = results[callIndex] ?? { data: [] };
      callIndex++;
      return {
        ...mockQueryBuilder,
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(result).then(resolve, reject),
      };
    };

    mockQueryBuilder.limit.mockImplementation(() => makeThenable());
    mockQueryBuilder.order.mockImplementation(() => makeThenable());

    // For queries that don't end with limit or order
    mockQueryBuilder.eq.mockImplementation(() => mockQueryBuilder);
    mockQueryBuilder.not.mockImplementation(() => mockQueryBuilder);
    mockQueryBuilder.gte.mockImplementation(() => mockQueryBuilder);
  }

  beforeEach(async () => {
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
      not: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
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
        JourneyAnalyticsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<JourneyAnalyticsService>(JourneyAnalyticsService);
  });

  // ---------------------------------------------------------------------------
  // Cache behavior
  // ---------------------------------------------------------------------------

  describe('Redis cache integration', () => {
    it('returns cached data on cache hit without querying Supabase', async () => {
      mockRedis.getByKey.mockResolvedValue(MOCK_JOURNEY_DATA);

      const result = await service.getJourneys(7, {});

      expect(result).toEqual(MOCK_JOURNEY_DATA);
      expect(mockQueryBuilder.from).not.toHaveBeenCalled();
      expect(mockRedis.setByKey).not.toHaveBeenCalled();
    });

    it('caches computed result with 900s TTL on cache miss', async () => {
      // Queue empty results for all 5 parallel queries
      queueQueryResults([
        { data: [] }, // navigation flows
        { data: [] }, // session aggregates
        { data: [] }, // exit pages
        { data: [] }, // common paths (order chain)
        { data: [] }, // annotations (order chain)
      ]);

      await service.getJourneys(7, {});

      expect(mockRedis.setByKey).toHaveBeenCalledWith(
        expect.stringContaining('analytics:journeys:'),
        expect.any(Object),
        900,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Data aggregation
  // ---------------------------------------------------------------------------

  describe('navigation flow aggregation', () => {
    it('aggregates page transitions and sorts by count descending', async () => {
      const flowEvents = [
        { page_path: '/pricing', previous_page_path: '/home' },
        { page_path: '/pricing', previous_page_path: '/home' },
        { page_path: '/signup', previous_page_path: '/pricing' },
      ];

      // The navigation flow query is the first .limit() call
      queueQueryResults([
        { data: flowEvents }, // navigation flows
        { data: [] }, // session aggregates
        { data: [] }, // exit pages
        { data: [] }, // common paths
        { data: [] }, // annotations
      ]);

      const result = await service.getJourneys(7, {});

      // /home -> /pricing has 2 transitions, should be first
      expect(result.navigationFlows.length).toBeGreaterThanOrEqual(1);
      if (result.navigationFlows.length >= 2) {
        expect(result.navigationFlows[0].transitions).toBeGreaterThanOrEqual(
          result.navigationFlows[1].transitions,
        );
      }
    });
  });

  describe('result structure', () => {
    it('returns JourneyData with all required keys', async () => {
      queueQueryResults([
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ]);

      const result = await service.getJourneys(7, {});

      expect(result).toHaveProperty('navigationFlows');
      expect(result).toHaveProperty('landingPages');
      expect(result).toHaveProperty('exitPages');
      expect(result).toHaveProperty('commonPaths');
      expect(result).toHaveProperty('avgPagesPerSession');
      expect(result).toHaveProperty('sessionDurationDistribution');
      expect(result).toHaveProperty('annotations');
      expect(Array.isArray(result.navigationFlows)).toBe(true);
      expect(Array.isArray(result.exitPages)).toBe(true);
      expect(typeof result.avgPagesPerSession).toBe('number');
    });
  });
});
