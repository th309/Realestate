/**
 * Journeys assembly, with regression guards for the defects that were live on
 * /admin/analytics → Journeys:
 *
 *  1. Every panel was reduced in Node from `.select()` rows behind
 *     `.limit(5000)` / `.limit(10000)`. Both exceed PostgREST's 1,000-row
 *     max-rows ceiling, so neither applied: each request returned a well-formed
 *     1,000-row array and the JS aggregated it correctly — over ~1% of a
 *     ~112,000-event window, with no error anywhere to say so.
 *  2. The device filter resolved session ids with `.limit(20000)` (capped the
 *     same way) and filtered events in memory, so "mobile" meant "whichever
 *     1,000 session ids came back first".
 *  3. The Redis key omitted the traffic segment, so a cached bot view could be
 *     served under a human label.
 *
 * None of these is visible to a test that only asserts the response shape,
 * which is what the previous version of this file did.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JourneyAnalyticsService } from '../journey-analytics.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';

/**
 * PostgREST serialises bigint as JSON — depending on the column and driver a
 * count can arrive as a number or a string. Fixtures deliberately mix both so
 * the mapping cannot pass by accidentally forwarding whatever it was given.
 */
const RPC_FIXTURES: Record<string, unknown[]> = {
  analytics_navigation_flows: [
    { from_path: '/', to_path: '/map', transitions: '21', visitors: 17 },
    { from_path: '/', to_path: '/pricing', transitions: 8, visitors: '8' },
  ],
  analytics_journey_landing_pages: [
    { page: '/', sessions: '120', bounce_rate: '0.6696', avg_duration: '41.5' },
  ],
  analytics_exit_pages: [{ page: '/pricing', exits: '40' }],
  analytics_common_paths: [{ path: ['/', '/map', '/'], sessions: '13' }],
  analytics_session_duration_buckets: [
    { bucket: '0s', bucket_order: 1, sessions: '45675' },
    { bucket: '1-4s', bucket_order: 2, sessions: '62' },
    { bucket: '5s', bucket_order: 3, sessions: '2062' },
    { bucket: '6-29s', bucket_order: 4, sessions: '455' },
    { bucket: '30s-2m', bucket_order: 5, sessions: '82' },
    { bucket: '2-5m', bucket_order: 6, sessions: '27' },
    { bucket: '5-10m', bucket_order: 7, sessions: '19' },
    { bucket: '10m+', bucket_order: 8, sessions: '76' },
  ],
  analytics_outbound_destinations: [
    {
      domain: 'www.zillow.com',
      clicks: '12',
      sessions: '9',
      top_url: 'https://www.zillow.com/homes/austin-tx',
      from_page: '/markets/metro/austin-tx',
    },
  ],
  analytics_overview_kpis: [{ pages_per_session: '3.83' }],
};

describe('JourneyAnalyticsService', () => {
  let service: JourneyAnalyticsService;
  let mockRedis: { getByKey: jest.Mock; setByKey: jest.Mock };
  let rpc: jest.Mock;
  let from: jest.Mock;

  /**
   * `jest.Mock` records its calls as `any[]`. Naming the argument tuples once
   * here keeps every assertion below type-checked instead of silently comparing
   * `any` to `any`.
   */
  type RpcCall = [fn: string, params: Record<string, unknown>];
  type CacheWrite = [key: string, value: unknown, ttl: number];

  const rpcCalls = (): RpcCall[] => rpc.mock.calls as RpcCall[];
  const tablesRead = (): string[] =>
    (from.mock.calls as [string][]).map(([table]) => table);
  const cacheWrites = (): CacheWrite[] =>
    mockRedis.setByKey.mock.calls as CacheWrite[];
  const cacheReads = (): [string][] =>
    mockRedis.getByKey.mock.calls as [string][];

  /** Params the service passed to a given RPC. */
  function paramsFor(fn: string): Record<string, unknown> {
    const call = rpcCalls().find(([name]) => name === fn);
    if (!call) throw new Error(`${fn} was never called`);
    return call[1];
  }

  beforeEach(async () => {
    mockRedis = {
      getByKey: jest.fn().mockResolvedValue(null),
      setByKey: jest.fn().mockResolvedValue(undefined),
    };

    rpc = jest.fn((fn: string) =>
      Promise.resolve({ data: RPC_FIXTURES[fn] ?? [], error: null }),
    );

    // Annotations are the one panel still read as rows — a handful of editorial
    // markers, not an aggregate.
    const annotationChain = {
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    from = jest.fn(() => annotationChain);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JourneyAnalyticsService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ rpc, from }) },
        },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<JourneyAnalyticsService>(JourneyAnalyticsService);
  });

  describe('no panel is aggregated from a row array', () => {
    it('sources every metric from a SQL aggregate rather than a capped select', async () => {
      await service.getJourneys(30, {});

      const called = rpcCalls()
        .map(([fn]) => fn)
        .sort();
      expect(called).toEqual([
        'analytics_common_paths',
        'analytics_exit_pages',
        'analytics_journey_landing_pages',
        'analytics_navigation_flows',
        'analytics_outbound_destinations',
        'analytics_overview_kpis',
        'analytics_session_duration_buckets',
      ]);
    });

    it('never reads user_events or user_sessions rows, where max-rows silently truncated', async () => {
      await service.getJourneys(30, {});

      const tables = tablesRead();
      expect(tables).not.toContain('user_events');
      expect(tables).not.toContain('user_sessions');
      expect(tables).toEqual(['analytics_annotations']);
    });
  });

  describe('filters reach the database', () => {
    it('passes device as an RPC parameter instead of filtering session ids in memory', async () => {
      await service.getJourneys(30, { device: 'mobile' });

      for (const [, params] of rpcCalls()) {
        expect(params).toMatchObject({ p_device: 'mobile' });
      }
    });

    it('applies the same traffic segment and tier to every panel', async () => {
      await service.getJourneys(30, { traffic: 'bot', tier: 'pro' });

      for (const [, params] of rpcCalls()) {
        expect(params).toMatchObject({ p_traffic: 'bot', p_tier: 'pro' });
      }
    });

    it('defaults an absent segment to human rather than leaving it undefined', async () => {
      await service.getJourneys(30, {});
      expect(paramsFor('analytics_navigation_flows')).toMatchObject({
        p_traffic: 'human',
        p_tier: null,
        p_device: null,
      });
    });

    it('derives p_start from the requested window', async () => {
      await service.getJourneys(7, {});
      const { p_start } = paramsFor('analytics_navigation_flows');
      const ageDays = (Date.now() - Date.parse(p_start as string)) / 86400000;
      expect(ageDays).toBeGreaterThan(6.9);
      expect(ageDays).toBeLessThan(7.1);
    });
  });

  describe('cache key isolates the traffic segment', () => {
    it('writes different keys for the human and bot segments', async () => {
      await service.getJourneys(30, { traffic: 'human' });
      await service.getJourneys(30, { traffic: 'bot' });

      const [humanKey] = cacheWrites()[0];
      const [botKey] = cacheWrites()[1];

      expect(humanKey).not.toEqual(botKey);
      expect(humanKey).toContain('human');
      expect(botKey).toContain('bot');
    });

    it('reads the segment-specific key, so a cached bot view cannot serve a human request', async () => {
      await service.getJourneys(30, { traffic: 'bot' });
      const [botReadKey] = cacheReads()[0];

      mockRedis.getByKey.mockClear();
      await service.getJourneys(30, { traffic: 'human' });
      const [humanReadKey] = cacheReads()[0];

      expect(botReadKey).not.toEqual(humanReadKey);
    });

    it('caches with a 900s TTL and skips the database on a hit', async () => {
      await service.getJourneys(30, {});
      expect(mockRedis.setByKey).toHaveBeenCalledWith(
        expect.stringContaining('analytics:journeys:'),
        expect.any(Object),
        900,
      );

      rpc.mockClear();
      mockRedis.getByKey.mockResolvedValue({ navigationFlows: [] });
      await service.getJourneys(30, {});
      expect(rpc).not.toHaveBeenCalled();
    });
  });

  describe('row mapping', () => {
    it('coerces bigint counts to numbers whether they arrive as string or number', async () => {
      const { navigationFlows, exitPages, avgPagesPerSession } =
        await service.getJourneys(30, {});

      expect(navigationFlows[0]).toEqual({
        fromPage: '/',
        toPage: '/map',
        transitions: 21,
        visitors: 17,
      });
      expect(navigationFlows[1].transitions).toBe(8);
      expect(navigationFlows[1].visitors).toBe(8);
      expect(exitPages[0]).toEqual({ page: '/pricing', exits: 40 });
      expect(avgPagesPerSession).toBe(3.83);
    });

    it('keeps the 5s heartbeat artifact in its own bucket, in SQL order', async () => {
      const { sessionDurationDistribution } = await service.getJourneys(30, {});

      expect(sessionDurationDistribution.map((b) => b.bucket)).toEqual([
        '0s',
        '1-4s',
        '5s',
        '6-29s',
        '30s-2m',
        '2-5m',
        '5-10m',
        '10m+',
      ]);
      // The spike must remain attributable rather than absorbed by a neighbour.
      expect(sessionDurationDistribution[2]).toEqual({
        bucket: '5s',
        count: 2062,
      });
    });

    it('returns JourneyData with every key the frontend contract requires', async () => {
      const result = await service.getJourneys(30, {});

      expect(Object.keys(result).sort()).toEqual([
        'annotations',
        'avgPagesPerSession',
        'commonPaths',
        'exitPages',
        'landingPages',
        'navigationFlows',
        'outboundDestinations',
        'sessionDurationDistribution',
      ]);
      expect(result.landingPages[0]).toEqual({
        page: '/',
        sessions: 120,
        bounceRate: 0.6696,
        avgDuration: 41.5,
      });
      expect(result.commonPaths[0]).toEqual({
        path: ['/', '/map', '/'],
        sessions: 13,
      });
      expect(result.outboundDestinations[0].clicks).toBe(12);
    });
  });

  describe('failure handling', () => {
    it('empties the failing panel only, rather than blanking the tab', async () => {
      rpc.mockImplementation((fn: string) =>
        fn === 'analytics_navigation_flows'
          ? Promise.resolve({ data: null, error: { message: 'boom' } })
          : Promise.resolve({ data: RPC_FIXTURES[fn] ?? [], error: null }),
      );

      const result = await service.getJourneys(30, {});

      expect(result.navigationFlows).toEqual([]);
      expect(result.exitPages).toHaveLength(1);
      expect(result.sessionDurationDistribution).toHaveLength(8);
    });
  });
});
