/**
 * ConversionAnalyticsService Unit Tests
 *
 * Tests conversion analytics including:
 * - Redis cache hit/miss behavior
 * - Full funnel step rate calculation (Visit -> Signup -> Active -> Trial -> Paid)
 * - Paywall effectiveness metrics grouped by resource
 * - Tier migration flow derivation from event properties
 * - Revenue metrics computation (MRR, ARPU, tier distribution)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConversionAnalyticsService } from '../conversion-analytics.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';
import type { ConversionData } from '../user-analytics.types';

const MOCK_CONVERSION_DATA: ConversionData = {
  fullFunnel: [
    { name: 'Visit', count: 1000, rateFromPrevious: 1, rateFromFirst: 1 },
    {
      name: 'Signup',
      count: 200,
      rateFromPrevious: 0.2,
      rateFromFirst: 0.2,
    },
  ],
  customFunnels: [],
  paywallEffectiveness: [],
  featureCorrelation: [],
  revenueMetrics: { mrr: 0, arpu: 0, tierDistribution: [] },
  tierMigration: [],
  annotations: [],
};

/**
 * Creates a deeply chainable Supabase mock where every method returns a
 * thenable proxy. The resolved { data, error } is controlled by calling
 * `setNextResult()` before the query chain is awaited.
 *
 * This avoids the fragile queue-index approach by letting us set up results
 * per `.from()` call via `onFrom` callback.
 */
function createChainableMock() {
  let pendingResult: { data: unknown; error?: unknown } = { data: [] };

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      // Make the chain awaitable: when JS awaits, it checks `.then`
      if (prop === 'then') {
        const result = pendingResult;
        // Reset for next query
        pendingResult = { data: [] };
        return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(result).then(resolve, reject);
      }
      // Every other property call returns the proxy itself (chainable)
      return (..._args: unknown[]) => proxy;
    },
  };

  const proxy = new Proxy({} as Record<string, unknown>, handler);

  return {
    proxy,
    setNextResult(result: { data: unknown; error?: unknown }) {
      pendingResult = result;
    },
  };
}

describe('ConversionAnalyticsService', () => {
  let service: ConversionAnalyticsService;
  let mockRedis: { getByKey: jest.Mock; setByKey: jest.Mock };
  let chainMock: ReturnType<typeof createChainableMock>;
  let fromSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockRedis = {
      getByKey: jest.fn().mockResolvedValue(null),
      setByKey: jest.fn().mockResolvedValue(undefined),
    };

    chainMock = createChainableMock();

    // Wrap the proxy's from method to intercept table names for per-test setup
    fromSpy = jest.fn((..._args: unknown[]) => chainMock.proxy);
    const wrappedProxy = new Proxy(chainMock.proxy, {
      get(target, prop) {
        if (prop === 'from') return fromSpy;
        return Reflect.get(target, prop);
      },
    });

    const mockSupabaseService = {
      getClient: jest.fn(() => wrappedProxy),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversionAnalyticsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ConversionAnalyticsService>(
      ConversionAnalyticsService,
    );
  });

  // ---------------------------------------------------------------------------
  // Cache behavior
  // ---------------------------------------------------------------------------

  describe('Redis cache integration', () => {
    it('returns cached data on cache hit without querying Supabase', async () => {
      mockRedis.getByKey.mockResolvedValue(MOCK_CONVERSION_DATA);

      const result = await service.getConversion(30, {});

      expect(result).toEqual(MOCK_CONVERSION_DATA);
      expect(fromSpy).not.toHaveBeenCalled();
      expect(mockRedis.setByKey).not.toHaveBeenCalled();
    });

    it('caches computed result with 600s TTL on cache miss', async () => {
      // Default chainMock returns { data: [] } for everything
      await service.getConversion(30, {});

      expect(mockRedis.setByKey).toHaveBeenCalledWith(
        expect.stringContaining('analytics:conversion:'),
        expect.any(Object),
        600,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Funnel step rate calculation
  // ---------------------------------------------------------------------------

  describe('funnel step rate calculation', () => {
    it('calculates rateFromPrevious and rateFromFirst for each step', async () => {
      // We configure fromSpy to return specific data based on the table
      let sessionQueryCount = 0;
      let eventQueryCount = 0;

      fromSpy.mockImplementation((table: string) => {
        if (table === 'user_sessions') {
          sessionQueryCount++;
          // buildFullFunnel sessions
          chainMock.setNextResult({
            data: [
              { visitor_id: 'v1' },
              { visitor_id: 'v2' },
              { visitor_id: 'v3' },
              { visitor_id: 'v4' },
              { visitor_id: 'v1' }, // 2nd session for v1
              { visitor_id: 'v2' }, // 2nd session for v2
            ],
          });
        } else if (table === 'user_events') {
          eventQueryCount++;
          // Return different data based on call order for event queries
          if (eventQueryCount === 1) {
            // signup_complete
            chainMock.setNextResult({
              data: [{ visitor_id: 'v1' }, { visitor_id: 'v2' }],
            });
          } else if (eventQueryCount === 2) {
            // trial_start
            chainMock.setNextResult({ data: [{ visitor_id: 'v1' }] });
          } else if (eventQueryCount === 3) {
            // upgrade_complete
            chainMock.setNextResult({ data: [{ visitor_id: 'v1' }] });
          } else {
            chainMock.setNextResult({ data: [] });
          }
        } else {
          chainMock.setNextResult({ data: [] });
        }
        return chainMock.proxy;
      });

      const result = await service.getConversion(30, {});

      expect(result.fullFunnel.length).toBe(5);

      // Visit step should always have rateFromPrevious = 1
      const visitStep = result.fullFunnel.find((s) => s.name === 'Visit');
      expect(visitStep).toBeDefined();
      expect(visitStep!.rateFromPrevious).toBe(1);
      expect(visitStep!.rateFromFirst).toBe(1);

      // Each subsequent step should have rates between 0 and 1
      for (const step of result.fullFunnel) {
        expect(step.rateFromFirst).toBeLessThanOrEqual(1);
        expect(step.rateFromFirst).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Paywall effectiveness
  // ---------------------------------------------------------------------------

  describe('paywall effectiveness', () => {
    it('groups paywall events by resource and computes CTR', async () => {
      const paywallEvents = [
        { event_action: 'paywall_view', event_label: 'scores' },
        { event_action: 'paywall_view', event_label: 'scores' },
        { event_action: 'upgrade_click', event_label: 'scores' },
        { event_action: 'upgrade_complete', event_label: 'scores' },
        { event_action: 'paywall_view', event_label: 'reports' },
        { event_action: 'paywall_dismiss', event_label: 'reports' },
      ];

      let eventQueryCount = 0;
      fromSpy.mockImplementation((table: string) => {
        if (table === 'user_events') {
          eventQueryCount++;
          // The paywall query uses .in('event_action', [...]) which is
          // distinguishable. We serve paywall data on a specific call.
          // Since buildFullFunnel runs in parallel with buildPaywallEffectiveness,
          // we can't predict exact order. Instead return paywallEvents for
          // all event queries and let the service filter.
          chainMock.setNextResult({ data: paywallEvents });
        } else {
          chainMock.setNextResult({ data: [] });
        }
        return chainMock.proxy;
      });

      const result = await service.getConversion(30, {});

      // The paywall effectiveness should have at least the 'scores' resource
      expect(result.paywallEffectiveness.length).toBeGreaterThanOrEqual(1);

      const scoresMetric = result.paywallEffectiveness.find(
        (p) => p.resource === 'scores',
      );
      expect(scoresMetric).toBeDefined();
      expect(scoresMetric!.views).toBe(2);
      expect(scoresMetric!.clicks).toBe(1);
      expect(scoresMetric!.ctr).toBeCloseTo(0.5, 2);
      expect(scoresMetric!.conversions).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Tier migration
  // ---------------------------------------------------------------------------

  describe('tier migration flows', () => {
    it('derives tier flows from upgrade_complete event properties', async () => {
      const upgradeEvents = [
        { properties: { previous_tier: 'free', current_tier: 'pro' } },
        { properties: { previous_tier: 'free', current_tier: 'pro' } },
        { properties: { previous_tier: 'pro', current_tier: 'enterprise' } },
      ];

      let eventQueryCount = 0;
      fromSpy.mockImplementation((table: string) => {
        if (table === 'user_events') {
          eventQueryCount++;
          // The tier migration query selects 'properties' and
          // uses .eq('event_action', 'upgrade_complete').
          // We return upgradeEvents for all event queries.
          chainMock.setNextResult({ data: upgradeEvents });
        } else {
          chainMock.setNextResult({ data: [] });
        }
        return chainMock.proxy;
      });

      const result = await service.getConversion(30, {});

      expect(result.tierMigration.length).toBeGreaterThanOrEqual(2);

      const freeToProFlow = result.tierMigration.find(
        (f) => f.fromTier === 'free' && f.toTier === 'pro',
      );
      expect(freeToProFlow).toBeDefined();
      expect(freeToProFlow!.count).toBe(2);

      const proToEntFlow = result.tierMigration.find(
        (f) => f.fromTier === 'pro' && f.toTier === 'enterprise',
      );
      expect(proToEntFlow).toBeDefined();
      expect(proToEntFlow!.count).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Result structure
  // ---------------------------------------------------------------------------

  describe('result structure', () => {
    it('returns ConversionData with all required keys', async () => {
      const result = await service.getConversion(30, {});

      expect(result).toHaveProperty('fullFunnel');
      expect(result).toHaveProperty('customFunnels');
      expect(result).toHaveProperty('paywallEffectiveness');
      expect(result).toHaveProperty('featureCorrelation');
      expect(result).toHaveProperty('revenueMetrics');
      expect(result).toHaveProperty('tierMigration');
      expect(result).toHaveProperty('annotations');
      expect(Array.isArray(result.fullFunnel)).toBe(true);
      expect(result.revenueMetrics).toHaveProperty('mrr');
      expect(result.revenueMetrics).toHaveProperty('arpu');
      expect(result.revenueMetrics).toHaveProperty('tierDistribution');
    });
  });
});
