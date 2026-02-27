/**
 * OverviewAnalyticsService Unit Tests
 *
 * Tests the overview analytics dashboard data assembly:
 * - Redis cache hit returns cached data without querying
 * - Redis cache miss fetches data, caches it, and returns correct structure
 * - Returned OverviewData has all required top-level keys
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OverviewAnalyticsService } from '../overview-analytics.service';
import { OverviewDataFetcherService } from '../overview-data-fetcher.service';
import { RedisService } from '../../redis/redis.service';
import type { OverviewData } from '../user-analytics.types';

// Pre-built mock overview data that matches the OverviewData shape
const MOCK_OVERVIEW_DATA: OverviewData = {
  kpis: {
    uniqueVisitors: { current: 500, previous: 400, changePercent: 25 },
    totalSessions: { current: 800, previous: 700, changePercent: 14.3 },
    avgSessionDuration: { current: 120, previous: 110, changePercent: 9.1 },
    bounceRate: { current: 0.35, previous: 0.4, changePercent: -12.5 },
    pagesPerSession: { current: 3.2, previous: 2.8, changePercent: 14.3 },
    conversionRate: { current: 0.05, previous: 0.04, changePercent: 25 },
  },
  sparklines: {
    uniqueVisitors: [10, 20, 30],
    totalSessions: [10, 20, 30],
    avgSessionDuration: [10, 20, 30],
    bounceRate: [10, 20, 30],
    pagesPerSession: [10, 20, 30],
    conversionRate: [10, 20, 30],
  },
  quickFunnel: [
    { name: 'Visited', count: 500, rateFromPrevious: 1, rateFromFirst: 1 },
    {
      name: 'Signed Up',
      count: 50,
      rateFromPrevious: 0.1,
      rateFromFirst: 0.1,
    },
  ],
  topPages: [
    {
      pagePath: '/home',
      views: 200,
      bounceRate: 0.3,
      avgTimeSeconds: 60,
      conversionRate: 0.02,
    },
  ],
  activeUsersChart: [
    { date: '2025-02-01', value: 100 },
    { date: '2025-02-02', value: 120 },
  ],
  goalProgress: [],
  annotations: [],
};

describe('OverviewAnalyticsService', () => {
  let service: OverviewAnalyticsService;
  let mockRedis: { getByKey: jest.Mock; setByKey: jest.Mock };
  let mockFetcher: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRedis = {
      getByKey: jest.fn().mockResolvedValue(null),
      setByKey: jest.fn().mockResolvedValue(undefined),
    };

    mockFetcher = {
      fetchSessionRows: jest.fn().mockResolvedValue([
        {
          visitor_id: 'v1',
          duration_seconds: 120,
          is_bounce: false,
          page_count: 3,
          converted: false,
          started_at: '2025-02-01T10:00:00Z',
        },
        {
          visitor_id: 'v2',
          duration_seconds: 60,
          is_bounce: true,
          page_count: 1,
          converted: false,
          started_at: '2025-02-02T10:00:00Z',
        },
      ]),
      fetchQuickFunnelStageCounts: jest
        .fn()
        .mockResolvedValue(MOCK_OVERVIEW_DATA.quickFunnel),
      fetchTopPages: jest.fn().mockResolvedValue(MOCK_OVERVIEW_DATA.topPages),
      fetchAnnotations: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OverviewAnalyticsService,
        { provide: OverviewDataFetcherService, useValue: mockFetcher },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<OverviewAnalyticsService>(OverviewAnalyticsService);
  });

  // ---------------------------------------------------------------------------
  // Cache behavior
  // ---------------------------------------------------------------------------

  describe('Redis cache integration', () => {
    it('returns cached data on cache hit without querying fetcher', async () => {
      mockRedis.getByKey.mockResolvedValue(MOCK_OVERVIEW_DATA);

      const result = await service.getOverview(7, {});

      expect(result).toEqual(MOCK_OVERVIEW_DATA);
      // Fetcher should NOT have been called on a cache hit
      expect(mockFetcher.fetchSessionRows).not.toHaveBeenCalled();
      expect(mockFetcher.fetchQuickFunnelStageCounts).not.toHaveBeenCalled();
      expect(mockRedis.setByKey).not.toHaveBeenCalled();
    });

    it('queries fetcher and caches result on cache miss', async () => {
      mockRedis.getByKey.mockResolvedValue(null);

      const result = await service.getOverview(7, {});

      // Fetcher should have been called
      expect(mockFetcher.fetchSessionRows).toHaveBeenCalled();
      expect(mockFetcher.fetchQuickFunnelStageCounts).toHaveBeenCalled();
      expect(mockFetcher.fetchTopPages).toHaveBeenCalled();
      expect(mockFetcher.fetchAnnotations).toHaveBeenCalled();

      // Result should have been cached with the 300s TTL
      expect(mockRedis.setByKey).toHaveBeenCalledWith(
        expect.stringContaining('analytics:overview:'),
        expect.any(Object),
        300,
      );

      // Returned structure should have all required keys
      expect(result).toHaveProperty('kpis');
      expect(result).toHaveProperty('sparklines');
      expect(result).toHaveProperty('quickFunnel');
      expect(result).toHaveProperty('topPages');
      expect(result).toHaveProperty('activeUsersChart');
      expect(result).toHaveProperty('goalProgress');
      expect(result).toHaveProperty('annotations');
    });
  });

  // ---------------------------------------------------------------------------
  // KPI computation
  // ---------------------------------------------------------------------------

  describe('KPI computation on cache miss', () => {
    it('computes KPI metrics with trend comparison', async () => {
      const result = await service.getOverview(7, {});

      // kpis should have the 6 standard metrics
      expect(result.kpis).toHaveProperty('uniqueVisitors');
      expect(result.kpis).toHaveProperty('totalSessions');
      expect(result.kpis).toHaveProperty('avgSessionDuration');
      expect(result.kpis).toHaveProperty('bounceRate');
      expect(result.kpis).toHaveProperty('pagesPerSession');
      expect(result.kpis).toHaveProperty('conversionRate');

      // Each KPI should have current, previous, changePercent
      for (const kpi of Object.values(result.kpis)) {
        expect(kpi).toHaveProperty('current');
        expect(kpi).toHaveProperty('previous');
        expect(kpi).toHaveProperty('changePercent');
      }
    });

    it('includes sparkline arrays in result', async () => {
      const result = await service.getOverview(7, {});

      expect(result.sparklines).toBeDefined();
      expect(Array.isArray(result.sparklines.uniqueVisitors)).toBe(true);
    });
  });
});
