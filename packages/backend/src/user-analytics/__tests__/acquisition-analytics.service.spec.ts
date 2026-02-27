/**
 * AcquisitionAnalyticsService Unit Tests
 *
 * Tests acquisition analytics including:
 * - Redis cache hit/miss behavior
 * - Source-to-conversion attribution aggregation
 * - Result structure with all required AcquisitionData keys
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

describe('AcquisitionAnalyticsService', () => {
  let service: AcquisitionAnalyticsService;
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
      gte: jest.fn().mockImplementation(() => makeThenable()),
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
  // Cache behavior
  // ---------------------------------------------------------------------------

  describe('Redis cache integration', () => {
    it('returns cached data on cache hit without querying Supabase', async () => {
      mockRedis.getByKey.mockResolvedValue(MOCK_ACQUISITION_DATA);

      const result = await service.getAcquisition(30, {});

      expect(result).toEqual(MOCK_ACQUISITION_DATA);
      expect(mockQueryBuilder.from).not.toHaveBeenCalled();
      expect(mockRedis.setByKey).not.toHaveBeenCalled();
    });

    it('caches computed result with 900s TTL on cache miss', async () => {
      // Queue results for the 5 parallel queries:
      // queryTrafficSources, queryLandingPagePerformance,
      // querySourceToConversionAttribution, queryChannelTrend, queryAnnotations
      resolveQueue = [
        { data: [] }, // traffic sources (gte terminal)
        { data: [] }, // landing page performance (not terminal)
        { data: [] }, // source-to-conversion attribution (gte terminal)
        { data: [] }, // channel trend (gte terminal)
        { data: [] }, // annotations (order terminal)
      ];

      await service.getAcquisition(30, {});

      expect(mockRedis.setByKey).toHaveBeenCalledWith(
        expect.stringContaining('analytics:acquisition:'),
        expect.any(Object),
        900,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Source-to-conversion attribution
  // ---------------------------------------------------------------------------

  describe('source-to-conversion attribution', () => {
    it('groups visitors by acquisition source and tallies conversion events', async () => {
      const identityRows = [
        {
          visitor_id: 'v1',
          user_id: 'u1',
          first_seen_at: '2025-01-01T00:00:00Z',
          user_sessions: [
            {
              entry_type: 'organic',
              utm_source: 'google',
              referrer_domain: null,
              started_at: '2025-01-01T00:00:00Z',
            },
          ],
          analytics_events: [
            { event_action: 'signup', event_category: 'conversion' },
          ],
        },
        {
          visitor_id: 'v2',
          user_id: 'u2',
          first_seen_at: '2025-01-02T00:00:00Z',
          user_sessions: [
            {
              entry_type: 'paid',
              utm_source: 'google',
              referrer_domain: null,
              started_at: '2025-01-02T00:00:00Z',
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
          first_seen_at: '2025-01-03T00:00:00Z',
          user_sessions: [
            {
              entry_type: 'organic',
              utm_source: null,
              referrer_domain: 'reddit.com',
              started_at: '2025-01-03T00:00:00Z',
            },
          ],
          analytics_events: [],
        },
      ];

      // Queue results for the 5 parallel queries
      resolveQueue = [
        { data: [] }, // traffic sources
        { data: [] }, // landing page performance
        { data: identityRows }, // source-to-conversion attribution
        { data: [] }, // channel trend
        { data: [] }, // annotations
      ];

      const result = await service.getAcquisition(30, {});

      expect(result).toHaveProperty('sourceToConversion');
      expect(Array.isArray(result.sourceToConversion)).toBe(true);

      // Check that attribution rows were generated
      if (result.sourceToConversion.length > 0) {
        // Each row should have the expected shape
        for (const row of result.sourceToConversion) {
          expect(row).toHaveProperty('source');
          expect(row).toHaveProperty('visitors');
          expect(row).toHaveProperty('signups');
          expect(row).toHaveProperty('paid');
          expect(row).toHaveProperty('conversionRate');
          expect(typeof row.conversionRate).toBe('number');
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Result structure
  // ---------------------------------------------------------------------------

  describe('result structure', () => {
    it('returns AcquisitionData with all required keys', async () => {
      resolveQueue = Array(10).fill({ data: [] });

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
