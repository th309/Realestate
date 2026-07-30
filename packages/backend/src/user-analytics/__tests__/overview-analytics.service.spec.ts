/**
 * Overview assembly, with regression guards for two defects that were live on
 * /admin/analytics:
 *
 *  1. All six KPI sparklines were the same array (daily unique visitors), so
 *     the chart under "Bounce Rate" plotted visitor counts and every tile drew
 *     an identical shape.
 *  2. The Redis key did not include the traffic segment, so switching between
 *     human and bot views would serve whichever was cached first — bot figures
 *     under a "human" label.
 *
 * Both are invisible to a smoke test that only checks the response shape, which
 * is what the previous version of this file did.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OverviewAnalyticsService } from '../overview-analytics.service';
import { OverviewDataFetcherService } from '../overview-data-fetcher.service';
import { RedisService } from '../../redis/redis.service';

const KPI_ROW = {
  unique_visitors: 670,
  total_sessions: 790,
  avg_session_duration: 412.5,
  bounce_rate: 0.6696,
  pages_per_session: 3.83,
  converted_visitors: 8,
  conversion_rate: 0.0119,
};

// Deliberately different per column, so a test asserting the series differ
// cannot pass by accident.
const DAILY = [
  {
    day: '2026-07-27',
    visitors: 10,
    sessions: 12,
    avg_duration: 300,
    bounce_rate: 0.5,
    pages_per_session: 2.5,
  },
  {
    day: '2026-07-28',
    visitors: 20,
    sessions: 25,
    avg_duration: 450,
    bounce_rate: 0.7,
    pages_per_session: 3.1,
  },
];

const SEGMENTS = {
  human: 790,
  bot: 1568,
  unclassified: 46285,
  internal: 99,
  total: 48742,
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
      fetchKpis: jest.fn().mockResolvedValue(KPI_ROW),
      fetchDailySeries: jest.fn().mockResolvedValue(DAILY),
      fetchTrafficSegments: jest.fn().mockResolvedValue(SEGMENTS),
      fetchQuickFunnelStageCounts: jest.fn().mockResolvedValue([]),
      fetchTopPages: jest.fn().mockResolvedValue([]),
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

  describe('sparklines describe their own metric', () => {
    it('gives each KPI a distinct series rather than reusing the visitor counts', async () => {
      const { sparklines } = await service.getOverview(7, {});

      expect(sparklines.uniqueVisitors).toEqual([10, 20]);
      expect(sparklines.totalSessions).toEqual([12, 25]);
      expect(sparklines.avgSessionDuration).toEqual([300, 450]);
      expect(sparklines.bounceRate).toEqual([0.5, 0.7]);
      expect(sparklines.pagesPerSession).toEqual([2.5, 3.1]);
    });

    it('does not plot two different metrics with identical data', async () => {
      const { sparklines } = await service.getOverview(7, {});

      expect(sparklines.uniqueVisitors).not.toEqual(sparklines.totalSessions);
      expect(sparklines.bounceRate).not.toEqual(sparklines.uniqueVisitors);
      expect(sparklines.avgSessionDuration).not.toEqual(
        sparklines.pagesPerSession,
      );
    });

    it('leaves conversion empty rather than inventing a daily trend for ~8 signups a month', async () => {
      const { sparklines } = await service.getOverview(7, {});
      expect(sparklines.conversionRate).toEqual([]);
    });
  });

  describe('cache key isolates the traffic segment', () => {
    it('writes different keys for the human and bot segments', async () => {
      await service.getOverview(7, { traffic: 'human' });
      await service.getOverview(7, { traffic: 'bot' });

      // `mock.calls` is typed `any[]`; narrowed at the read.
      const [humanKey] = mockRedis.setByKey.mock.calls[0] as string[];
      const [botKey] = mockRedis.setByKey.mock.calls[1] as string[];

      expect(humanKey).not.toEqual(botKey);
      expect(humanKey).toContain('human');
      expect(botKey).toContain('bot');
    });

    it('reads the segment-specific key, so a cached bot view cannot serve a human request', async () => {
      await service.getOverview(7, { traffic: 'bot' });
      const [botReadKey] = mockRedis.getByKey.mock.calls[0] as string[];

      mockRedis.getByKey.mockClear();
      await service.getOverview(7, { traffic: 'human' });
      const [humanReadKey] = mockRedis.getByKey.mock.calls[0] as string[];

      expect(botReadKey).not.toEqual(humanReadKey);
    });
  });

  describe('assembly', () => {
    it('maps the KPI row onto the six tiles with trend comparison', async () => {
      const { kpis } = await service.getOverview(7, {});

      expect(kpis.uniqueVisitors.current).toBe(670);
      expect(kpis.totalSessions.current).toBe(790);
      expect(kpis.pagesPerSession.current).toBe(3.83);
      expect(kpis.conversionRate.current).toBe(0.0119);
      for (const kpi of Object.values(kpis)) {
        expect(kpi).toHaveProperty('previous');
        expect(kpi).toHaveProperty('changePercent');
      }
    });

    it('surfaces the segment counts so the UI can state what it excluded', async () => {
      const result = await service.getOverview(7, {});
      expect(result.trafficSegments).toEqual(SEGMENTS);
    });

    it('returns cached data without touching the fetcher', async () => {
      mockRedis.getByKey.mockResolvedValue({ kpis: {}, sparklines: {} });

      await service.getOverview(7, {});

      expect(mockFetcher.fetchKpis).not.toHaveBeenCalled();
      expect(mockRedis.setByKey).not.toHaveBeenCalled();
    });
  });
});
