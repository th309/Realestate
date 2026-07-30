/**
 * ConversionAnalyticsService — assembly + full-funnel contract.
 *
 * The panel builders (paywall, feature correlation, tier migration, revenue)
 * moved to conversion-panel-queries.ts when this file passed the 300-line hard
 * limit, so they are mocked here and the service is tested for what it now
 * actually does: assemble the response and compute the funnel via SQL.
 *
 * Behaviour these tests pin, all of which was broken:
 *  - The funnel's first stage was `sessionRows.length` from an unranged
 *    `.select()`, i.e. the 1,000-row PostgREST cap rather than a visitor count.
 *  - Stages `Trial` and `Paid` matched `trial_start` and `upgrade_complete`,
 *    neither of which has ever been emitted, so both read 0 forever.
 *  - `tierMigration` derived flows from `upgrade_complete` properties. With no
 *    such event and no tier-change audit table, an empty array is the honest
 *    answer rather than a bug to chase.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConversionAnalyticsService } from '../conversion-analytics.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';

jest.mock('../conversion-panel-queries', () => ({
  queryPaywallEffectiveness: jest.fn().mockResolvedValue([]),
  queryFeatureCorrelation: jest.fn().mockResolvedValue([]),
  queryTierMigration: jest.fn().mockReturnValue([]),
  queryRevenueMetrics: jest
    .fn()
    .mockResolvedValue({ mrr: 240, arpu: 120, tierDistribution: [] }),
  queryConversionAnnotations: jest.fn().mockResolvedValue([]),
}));

const mockClient: any = {
  rpc: jest.fn(),
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  eq: jest.fn(),
};

const mockSupabase = { getClient: jest.fn(() => mockClient) };
const mockRedis = {
  getByKey: jest.fn().mockResolvedValue(null),
  setByKey: jest.fn().mockResolvedValue(undefined),
};

/** Wire the three awaited calls inside buildFullFunnel. */
function primeFunnel(opts: {
  visitors?: number;
  signups?: number;
  proFeature?: number;
  paidCount?: number;
}) {
  mockClient.rpc.mockImplementation((fn: string) => {
    if (fn === 'analytics_overview_kpis') {
      return Promise.resolve({
        data: [{ unique_visitors: opts.visitors ?? 0 }],
        error: null,
      });
    }
    return Promise.resolve({
      data: [
        { event_action: 'signup_complete', visitors: opts.signups ?? 0 },
        { event_action: 'pro_feature_used', visitors: opts.proFeature ?? 0 },
      ],
      error: null,
    });
  });
  mockClient.eq.mockResolvedValue({ count: opts.paidCount ?? 0, error: null });
}

describe('ConversionAnalyticsService', () => {
  let service: ConversionAnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.getByKey.mockResolvedValue(null);
    mockClient.from.mockReturnThis();
    mockClient.select.mockReturnThis();
    mockClient.in.mockReturnThis();

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ConversionAnalyticsService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = mod.get(ConversionAnalyticsService);
  });

  describe('full funnel', () => {
    it('takes the first stage from the SQL aggregate, not a fetched array length', async () => {
      primeFunnel({ visitors: 670, signups: 8, proFeature: 40, paidCount: 2 });

      const result = await service.getConversion(30, {});

      expect(mockClient.rpc).toHaveBeenCalledWith(
        'analytics_overview_kpis',
        expect.objectContaining({ p_traffic: 'human' }),
      );
      expect(result.fullFunnel[0]).toMatchObject({
        name: 'Visited',
        count: 670,
      });
    });

    it('builds stages only from events that exist, ending in a real paid count', async () => {
      primeFunnel({ visitors: 670, signups: 8, proFeature: 40, paidCount: 2 });

      const { fullFunnel } = await service.getConversion(30, {});

      expect(fullFunnel.map((s) => s.name)).toEqual([
        'Visited',
        'Signed up',
        'Used a Pro feature',
        'Paid',
      ]);
      expect(fullFunnel[1].count).toBe(8);
      expect(fullFunnel[2].count).toBe(40);
      // From user_profiles subscription state — there is no paid EVENT to read.
      expect(fullFunnel[3].count).toBe(2);
    });

    it('computes rateFromPrevious and rateFromFirst per stage', async () => {
      primeFunnel({
        visitors: 1000,
        signups: 200,
        proFeature: 100,
        paidCount: 50,
      });

      const { fullFunnel } = await service.getConversion(30, {});

      expect(fullFunnel[0].rateFromPrevious).toBe(1);
      expect(fullFunnel[1].rateFromPrevious).toBeCloseTo(0.2);
      expect(fullFunnel[1].rateFromFirst).toBeCloseTo(0.2);
      expect(fullFunnel[2].rateFromPrevious).toBeCloseTo(0.5);
      expect(fullFunnel[3].rateFromFirst).toBeCloseTo(0.05);
    });

    it('returns an empty funnel when the aggregate fails, rather than a plausible zero', async () => {
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'boom' },
      });
      mockClient.eq.mockResolvedValue({ count: 0, error: null });

      const { fullFunnel } = await service.getConversion(30, {});
      expect(fullFunnel).toEqual([]);
    });
  });

  describe('assembly', () => {
    it('reports no tier flows, because no tier-change event or audit exists', async () => {
      primeFunnel({ visitors: 10 });
      const result = await service.getConversion(30, {});
      expect(result.tierMigration).toEqual([]);
    });

    it('passes through the genuinely-sourced revenue metrics', async () => {
      primeFunnel({ visitors: 10 });
      const result = await service.getConversion(30, {});
      expect(result.revenueMetrics).toEqual({
        mrr: 240,
        arpu: 120,
        tierDistribution: [],
      });
    });

    it('separates cache entries per traffic segment', async () => {
      primeFunnel({ visitors: 10 });

      await service.getConversion(30, { traffic: 'human' });
      await service.getConversion(30, { traffic: 'bot' });

      const [humanKey] = mockRedis.setByKey.mock.calls[0];
      const [botKey] = mockRedis.setByKey.mock.calls[1];
      expect(humanKey).not.toEqual(botKey);
    });

    it('returns cached data without querying', async () => {
      mockRedis.getByKey.mockResolvedValue({ fullFunnel: [] });
      await service.getConversion(30, {});
      expect(mockClient.rpc).not.toHaveBeenCalled();
    });
  });
});
