/**
 * Acquisition assembly, with regression guards for two defects that were live
 * on /admin/analytics:
 *
 *  1. Traffic sources, landing pages and the channel trend were each aggregated
 *     in Node from an unranged `from('user_sessions').select(...)`. PostgREST
 *     caps that at 1,000 rows without erroring, so every percentage was a
 *     correct calculation over ~2% of a ~48,000-session window. The fix is a
 *     SQL aggregate per panel; these tests assert the RPC is what gets called,
 *     with the requested traffic segment, and that shares are computed against
 *     the full grouped total.
 *  2. The Redis key omitted the traffic segment, so a cached bot view could be
 *     served under a human label.
 *
 * Both are invisible to a smoke test that only checks the response shape, which
 * is what the previous version of this file did.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AcquisitionAnalyticsService } from '../acquisition-analytics.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';
import type { AcquisitionData } from '../user-analytics.types';

const MOCK_ACQUISITION_DATA: AcquisitionData = {
  trafficSources: [
    { source: 'google', entryType: 'organic', sessions: 100, percentage: 50 },
  ],
  landingPagePerformance: [],
  sourceToConversion: [],
  channelTrend: [],
  annotations: [],
};

type SupabaseResult = { data: unknown; error: { message: string } | null };

describe('AcquisitionAnalyticsService', () => {
  let service: AcquisitionAnalyticsService;
  let mockRedis: { getByKey: jest.Mock; setByKey: jest.Mock };
  let mockClient: { from: jest.Mock; rpc: jest.Mock };
  let rpcResults: Record<string, SupabaseResult>;
  let tableResults: Record<string, SupabaseResult>;

  /** Chainable, awaitable stand-in for a PostgREST query builder. */
  function makeTableBuilder(table: string) {
    const result = tableResults[table] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {};
    for (const method of [
      'select',
      'eq',
      'in',
      'gte',
      'lt',
      'lte',
      'not',
      'is',
      'order',
      'limit',
    ]) {
      builder[method] = jest.fn(() => builder);
    }
    builder.then = (
      resolve: (v: unknown) => void,
      reject?: (e: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject);
    return builder;
  }

  type RpcCall = [string, Record<string, unknown>];

  /** Params the named RPC was called with. */
  function rpcParams(name: string): Record<string, unknown> {
    const call = (mockClient.rpc.mock.calls as RpcCall[]).find(
      ([fn]) => fn === name,
    );
    expect(call).toBeDefined();
    return call![1];
  }

  function rpcNamesCalled(): string[] {
    return (mockClient.rpc.mock.calls as RpcCall[]).map(([name]) => name);
  }

  function tablesRead(): string[] {
    return (mockClient.from.mock.calls as [string][]).map(([table]) => table);
  }

  beforeEach(async () => {
    rpcResults = {};
    tableResults = {};

    mockRedis = {
      getByKey: jest.fn().mockResolvedValue(null),
      setByKey: jest.fn().mockResolvedValue(undefined),
    };

    mockClient = {
      from: jest.fn((table: string) => makeTableBuilder(table)),
      rpc: jest.fn((name: string) =>
        Promise.resolve(rpcResults[name] ?? { data: [], error: null }),
      ),
    };

    const mockSupabaseService = { getClient: jest.fn(() => mockClient) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcquisitionAnalyticsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AcquisitionAnalyticsService>(
      AcquisitionAnalyticsService,
    );
  });

  // ---------------------------------------------------------------------------
  // Session panels come from SQL aggregates, never a truncated row fetch
  // ---------------------------------------------------------------------------

  describe('session panels aggregate in SQL', () => {
    it('calls one aggregate RPC per panel instead of selecting user_sessions', async () => {
      await service.getAcquisition(30, {});

      expect(rpcNamesCalled()).toEqual(
        expect.arrayContaining([
          'analytics_traffic_sources',
          'analytics_landing_performance',
          'analytics_channel_trend',
        ]),
      );

      // The 1,000-row cap applies to `from('user_sessions').select(...)`. No
      // panel may reach for session rows again.
      expect(tablesRead()).not.toContain('user_sessions');
    });

    it('passes the window start as p_start and leaves p_end open', async () => {
      const before = Date.now();
      await service.getAcquisition(30, {});
      const after = Date.now();

      const params = rpcParams('analytics_traffic_sources');
      const start = new Date(params.p_start as string).getTime();

      expect(params.p_end).toBeNull();
      expect(start).toBeGreaterThanOrEqual(before - 30 * 86400_000 - 5_000);
      expect(start).toBeLessThanOrEqual(after - 30 * 86400_000 + 5_000);
    });
  });

  // ---------------------------------------------------------------------------
  // Traffic segment threading
  // ---------------------------------------------------------------------------

  describe('traffic segment reaches every RPC', () => {
    it('defaults to the human segment when no filter is supplied', async () => {
      await service.getAcquisition(30, {});

      for (const fn of [
        'analytics_traffic_sources',
        'analytics_landing_performance',
        'analytics_channel_trend',
      ]) {
        expect(rpcParams(fn).p_traffic).toBe('human');
      }
    });

    it.each(['bot', 'unclassified', 'all'] as const)(
      'forwards the %s segment rather than hardcoding is_bot = false',
      async (segment) => {
        await service.getAcquisition(30, { traffic: segment });

        for (const fn of [
          'analytics_traffic_sources',
          'analytics_landing_performance',
          'analytics_channel_trend',
        ]) {
          expect(rpcParams(fn).p_traffic).toBe(segment);
        }
      },
    );
  });

  // ---------------------------------------------------------------------------
  // Panel shaping
  // ---------------------------------------------------------------------------

  describe('traffic sources', () => {
    it('computes each share against the full grouped session total', async () => {
      rpcResults['analytics_traffic_sources'] = {
        data: [
          {
            entry_type: 'organic',
            source: 'google',
            sessions: 30000,
            visitors: 21000,
          },
          {
            entry_type: 'direct',
            source: 'direct',
            sessions: 10000,
            visitors: 9000,
          },
        ],
        error: null,
      };

      const { trafficSources } = await service.getAcquisition(30, {});

      expect(trafficSources).toEqual([
        {
          source: 'google',
          entryType: 'organic',
          sessions: 30000,
          percentage: 75,
        },
        {
          source: 'direct',
          entryType: 'direct',
          sessions: 10000,
          percentage: 25,
        },
      ]);
    });

    it('returns an empty panel when the RPC errors instead of a fabricated one', async () => {
      rpcResults['analytics_traffic_sources'] = {
        data: null,
        error: { message: 'function does not exist' },
      };

      const { trafficSources } = await service.getAcquisition(30, {});
      expect(trafficSources).toEqual([]);
    });
  });

  describe('landing page performance', () => {
    it('maps the aggregate row onto LandingPerf without recomputing rates', async () => {
      rpcResults['analytics_landing_performance'] = {
        data: [
          {
            page: '/market/austin-tx',
            sessions: '4210',
            bounce_rate: '0.6712',
            avg_time: '184.4',
            signups: '7',
            conversion_rate: '0.0017',
          },
        ],
        error: null,
      };

      const { landingPagePerformance } = await service.getAcquisition(30, {});

      expect(landingPagePerformance).toEqual([
        {
          page: '/market/austin-tx',
          sessions: 4210,
          bounceRate: 0.6712,
          avgTime: 184,
          signups: 7,
          conversionRate: 0.0017,
        },
      ]);
    });

    it('asks for a page limit large enough to cover every landing page', async () => {
      await service.getAcquisition(30, {});
      expect(rpcParams('analytics_landing_performance').p_limit).toBe(50);
    });
  });

  describe('channel trend', () => {
    it('splits the day/entry_type grid into one date-sorted series per channel', async () => {
      rpcResults['analytics_channel_trend'] = {
        data: [
          { day: '2026-07-28', entry_type: 'organic', sessions: 120 },
          { day: '2026-07-28', entry_type: 'direct', sessions: 40 },
          { day: '2026-07-27', entry_type: 'organic', sessions: 90 },
        ],
        error: null,
      };

      const { channelTrend } = await service.getAcquisition(30, {});

      const organic = channelTrend.find((c) => c.channel === 'organic');
      const direct = channelTrend.find((c) => c.channel === 'direct');

      expect(organic?.data).toEqual([
        { date: '2026-07-27', value: 90 },
        { date: '2026-07-28', value: 120 },
      ]);
      expect(direct?.data).toEqual([{ date: '2026-07-28', value: 40 }]);
    });

    it('labels sessions with no entry_type as unknown', async () => {
      rpcResults['analytics_channel_trend'] = {
        data: [{ day: '2026-07-28', entry_type: null, sessions: 5 }],
        error: null,
      };

      const { channelTrend } = await service.getAcquisition(30, {});
      expect(channelTrend[0].channel).toBe('unknown');
    });

    it('returns an empty panel when the RPC errors', async () => {
      rpcResults['analytics_channel_trend'] = {
        data: null,
        error: { message: 'permission denied' },
      };

      const { channelTrend } = await service.getAcquisition(30, {});
      expect(channelTrend).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Cache behavior
  // ---------------------------------------------------------------------------

  describe('Redis cache integration', () => {
    it('returns cached data on cache hit without querying Supabase', async () => {
      mockRedis.getByKey.mockResolvedValue(MOCK_ACQUISITION_DATA);

      const result = await service.getAcquisition(30, {});

      expect(result).toEqual(MOCK_ACQUISITION_DATA);
      expect(mockClient.rpc).not.toHaveBeenCalled();
      expect(mockClient.from).not.toHaveBeenCalled();
      expect(mockRedis.setByKey).not.toHaveBeenCalled();
    });

    it('caches computed result with 900s TTL on cache miss', async () => {
      await service.getAcquisition(30, {});

      expect(mockRedis.setByKey).toHaveBeenCalledWith(
        expect.stringContaining('analytics:acquisition:'),
        expect.any(Object),
        900,
      );
    });
  });

  describe('cache key isolates the traffic segment', () => {
    it('writes different keys for the human and bot segments', async () => {
      await service.getAcquisition(30, { traffic: 'human' });
      await service.getAcquisition(30, { traffic: 'bot' });

      const [humanKey] = mockRedis.setByKey.mock.calls[0];
      const [botKey] = mockRedis.setByKey.mock.calls[1];

      expect(humanKey).not.toEqual(botKey);
      expect(humanKey).toContain('human');
      expect(botKey).toContain('bot');
    });

    it('reads the segment-specific key, so a cached bot view cannot serve a human request', async () => {
      await service.getAcquisition(30, { traffic: 'bot' });
      const [botReadKey] = mockRedis.getByKey.mock.calls[0];

      mockRedis.getByKey.mockClear();
      await service.getAcquisition(30, { traffic: 'human' });
      const [humanReadKey] = mockRedis.getByKey.mock.calls[0];

      expect(botReadKey).not.toEqual(humanReadKey);
    });
  });

  // ---------------------------------------------------------------------------
  // Source-to-conversion attribution (still a row fetch — see service comment)
  // ---------------------------------------------------------------------------

  describe('source-to-conversion attribution', () => {
    it('groups visitors by acquisition source and tallies conversion events', async () => {
      tableResults['visitor_identities'] = {
        data: [
          {
            visitor_id: 'v1',
            user_id: 'u1',
            first_seen_at: '2026-07-01T00:00:00Z',
            user_sessions: [
              {
                entry_type: 'organic',
                utm_source: 'google',
                referrer_domain: null,
                started_at: '2026-07-01T00:00:00Z',
              },
            ],
            analytics_events: [
              { event_action: 'signup', event_category: 'conversion' },
            ],
          },
          {
            visitor_id: 'v2',
            user_id: 'u2',
            first_seen_at: '2026-07-02T00:00:00Z',
            user_sessions: [
              {
                entry_type: 'paid',
                utm_source: 'google',
                referrer_domain: null,
                started_at: '2026-07-02T00:00:00Z',
              },
            ],
            analytics_events: [
              { event_action: 'signup', event_category: 'conversion' },
              { event_action: 'paid_conversion', event_category: 'conversion' },
            ],
          },
          {
            visitor_id: 'v3',
            user_id: 'u3',
            first_seen_at: '2026-07-03T00:00:00Z',
            user_sessions: [
              {
                entry_type: 'organic',
                utm_source: null,
                referrer_domain: 'reddit.com',
                started_at: '2026-07-03T00:00:00Z',
              },
            ],
            analytics_events: [],
          },
        ],
        error: null,
      };

      const { sourceToConversion } = await service.getAcquisition(30, {});

      const google = sourceToConversion.find((r) => r.source === 'google');
      const reddit = sourceToConversion.find((r) => r.source === 'reddit.com');

      expect(google).toMatchObject({
        visitors: 2,
        signups: 2,
        paid: 1,
        conversionRate: 100,
      });
      expect(reddit).toMatchObject({ visitors: 1, signups: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // Result structure
  // ---------------------------------------------------------------------------

  describe('result structure', () => {
    it('returns AcquisitionData with all required keys', async () => {
      const result = await service.getAcquisition(30, {});

      expect(result).toHaveProperty('trafficSources');
      expect(result).toHaveProperty('landingPagePerformance');
      expect(result).toHaveProperty('sourceToConversion');
      expect(result).toHaveProperty('channelTrend');
      expect(result).toHaveProperty('annotations');
      expect(Array.isArray(result.trafficSources)).toBe(true);
      expect(Array.isArray(result.channelTrend)).toBe(true);
    });
  });
});
