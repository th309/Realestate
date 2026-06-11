/**
 * BriefingGeneratorService Tests
 *
 * Tests the core briefing generation pipeline: metric resolution,
 * stance/risk computation, LLM narrative generation, and DB storage.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BriefingGeneratorService } from './briefing-generator.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AppConfigService } from '../config/app-config.service';
import { NationalBenchmarks } from './market-intelligence.types';
import { ResolvedMetric } from '../metric-resolution/metric-resolution.types';

// -- Mock OpenAI SDK --------------------------------------------------------

const mockChatCompletionsCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCompletionsCreate } },
  }));
});

// -- Test Helpers -----------------------------------------------------------

function makeResolvedMetric(
  value: number | null,
  source = 'zillow',
  date = '2026-01-15',
): ResolvedMetric {
  return {
    value,
    date,
    source,
    sourceGeoId: '31080',
    sourceGeoLevel: 'metro',
    isInherited: false,
    isFallback: false,
  };
}

function buildFullResolvedBatch(): Record<string, ResolvedMetric> {
  return {
    home_value: makeResolvedMetric(450000),
    appreciation_yoy: makeResolvedMetric(4.2),
    rent_index: makeResolvedMetric(1800),
    rent_growth_yoy: makeResolvedMetric(2.5),
    cap_rate: makeResolvedMetric(5.8),
    vacancy_rate: makeResolvedMetric(4.3),
    population: makeResolvedMetric(2100000),
    population_growth: makeResolvedMetric(1.1),
    unemployment_rate: makeResolvedMetric(3.5),
    median_income: makeResolvedMetric(72000),
    dom: makeResolvedMetric(28),
    inventory: makeResolvedMetric(15000),
    price_to_rent: makeResolvedMetric(20.8),
    permits_growth: makeResolvedMetric(3.2),
    price_to_income: makeResolvedMetric(6.25),
  };
}

const BENCHMARKS: NationalBenchmarks = {
  vacancy_rate: 5.1,
  appreciation_yoy: 3.0,
  unemployment_rate: 3.7,
};

// -- Mock Supabase ----------------------------------------------------------

const mockSupabaseInsert = jest.fn();
const mockSupabaseUpdate = jest.fn();

function createMockSupabaseClient() {
  const chainable: Record<string, jest.Mock> = {
    select: jest.fn(),
    insert: mockSupabaseInsert,
    update: mockSupabaseUpdate,
    eq: jest.fn(),
    contains: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    gte: jest.fn(),
  };
  for (const fn of Object.values(chainable)) fn.mockReturnValue(chainable);

  chainable.select.mockReturnValue({
    ...chainable,
    then: (resolve: Function) => resolve({ data: [], error: null }),
  });
  mockSupabaseInsert.mockReturnValue({
    ...chainable,
    select: jest.fn().mockResolvedValue({
      data: [{ id: 'briefing-uuid-123' }],
      error: null,
    }),
  });
  mockSupabaseUpdate.mockReturnValue({
    ...chainable,
    eq: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  });

  return { from: jest.fn().mockReturnValue(chainable) };
}

// -- Test Suite -------------------------------------------------------------

describe('BriefingGeneratorService', () => {
  let service: BriefingGeneratorService;
  let mockMetricResolution: jest.Mocked<MetricResolutionService>;
  let mockAppConfig: jest.Mocked<AppConfigService>;
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockClient = createMockSupabaseClient();

    mockMetricResolution = {
      resolveMetricBatch: jest.fn().mockResolvedValue(buildFullResolvedBatch()),
      resolveMetric: jest.fn(),
      resolveMetricForAllGeos: jest.fn(),
    } as any;

    mockAppConfig = {
      get: jest.fn().mockImplementation((key: string, defaultValue = '') => {
        const config: Record<string, string> = {
          AI_BASE_URL: 'https://api.deepseek.com',
          AI_MODEL: 'deepseek-v4-pro',
          DEEPSEEK_API_KEY: 'test-api-key',
        };
        return Promise.resolve(config[key] ?? defaultValue);
      }),
      getNumber: jest
        .fn()
        .mockImplementation((_key: string, defaultValue = 0) => {
          return Promise.resolve(defaultValue);
        }),
    } as any;

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'LA shows bullish momentum with 4.2% appreciation.',
          },
        },
      ],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BriefingGeneratorService,
        { provide: MetricResolutionService, useValue: mockMetricResolution },
        { provide: SupabaseService, useValue: { getClient: () => mockClient } },
        { provide: AppConfigService, useValue: mockAppConfig },
      ],
    }).compile();

    service = module.get<BriefingGeneratorService>(BriefingGeneratorService);
  });

  describe('generateBriefing returns a complete MarketBriefing', () => {
    it('populates all required fields', async () => {
      const briefing = await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles-Long Beach-Anaheim, CA',
        BENCHMARKS,
      );

      expect(briefing.geography_id).toBe('31080');
      expect(briefing.geography_type).toBe('metro');
      expect(briefing.geography_name).toBe(
        'Los Angeles-Long Beach-Anaheim, CA',
      );
      expect(briefing.generated_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(briefing.metrics_snapshot).toBeDefined();
      expect(briefing.market_stance).toBeDefined();
      expect(briefing.stance_signals).toBeInstanceOf(Array);
      expect(briefing.risk_flags).toBeInstanceOf(Array);
      expect(briefing.narrative_summary).toBeTruthy();
      expect(briefing.suggested_questions).toBeInstanceOf(Array);
      expect(briefing.news_snapshot).toBeInstanceOf(Array);
      expect(briefing.metrics_count).toBeGreaterThan(0);
      expect(briefing.data_freshness_days).toBeGreaterThanOrEqual(0);
      expect(briefing.generation_time_ms).toBeGreaterThanOrEqual(0);
      expect(briefing.id).toBe('briefing-uuid-123');
    });
  });

  describe('metrics are fetched via resolveMetricBatch', () => {
    it('calls resolveMetricBatch with BRIEFING_METRIC_IDS', async () => {
      await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );

      expect(mockMetricResolution.resolveMetricBatch).toHaveBeenCalledTimes(1);
      const [metricIds, geoLevel, geoId] =
        mockMetricResolution.resolveMetricBatch.mock.calls[0];
      expect(metricIds).toContain('home_value');
      expect(metricIds).toContain('vacancy_rate');
      expect(metricIds).toContain('unemployment_rate');
      expect(geoLevel).toBe('metro');
      expect(geoId).toBe('31080');
    });
  });

  describe('market stance is computed from resolved metrics', () => {
    it('produces a valid stance with bullish signals', async () => {
      const briefing = await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );
      expect([
        'strong_bullish',
        'weak_bullish',
        'neutral',
        'weak_bearish',
        'strong_bearish',
      ]).toContain(briefing.market_stance);
      expect(briefing.stance_signals.length).toBeGreaterThan(0);
    });
  });

  describe('risk flags are computed from resolved metrics', () => {
    it('flags affordability squeeze when price_to_income > 6', async () => {
      const briefing = await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );
      const flag = briefing.risk_flags.find(
        (f) => f.flag === 'affordability_squeeze',
      );
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe('medium');
    });
  });

  describe('briefing is stored in market_briefings table', () => {
    it('calls Supabase from market_briefings', async () => {
      await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );
      expect(mockClient.from).toHaveBeenCalledWith('market_briefings');
    });

    it('sets previous is_latest to false before inserting new', async () => {
      await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );
      expect(mockSupabaseUpdate).toHaveBeenCalledWith({ is_latest: false });
    });
  });

  describe('LLM narrative generation', () => {
    it('calls LLM with prompt containing stance and metrics', async () => {
      await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );

      expect(mockChatCompletionsCreate).toHaveBeenCalled();
      const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
      const sysMsg = callArgs.messages.find((m: any) => m.role === 'system');
      expect(sysMsg.content).toContain('Los Angeles');
      expect(sysMsg.content).toContain('MARKET STANCE');
      expect(sysMsg.content).toContain('KEY METRICS');
    });

    it('reads LLM config from AppConfigService', async () => {
      await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );
      expect(mockAppConfig.get).toHaveBeenCalledWith(
        'AI_BASE_URL',
        'https://api.deepseek.com',
      );
      expect(mockAppConfig.get).toHaveBeenCalledWith(
        'AI_MODEL',
        'deepseek-v4-pro',
      );
      expect(mockAppConfig.get).toHaveBeenCalledWith('DEEPSEEK_API_KEY');
    });
  });

  describe('handles LLM failure gracefully', () => {
    it('falls back to template summary when LLM throws', async () => {
      mockChatCompletionsCreate.mockRejectedValue(new Error('API rate limit'));

      const briefing = await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );
      expect(briefing).toBeDefined();
      expect(briefing.narrative_summary).toContain('Los Angeles');
    });
  });

  describe('handles metric resolution failure gracefully', () => {
    it('generates briefing with partial data when some metrics null', async () => {
      const partial = buildFullResolvedBatch();
      partial.cap_rate = makeResolvedMetric(null);
      partial.permits_growth = makeResolvedMetric(null);
      partial.population = makeResolvedMetric(null);
      mockMetricResolution.resolveMetricBatch.mockResolvedValue(partial);

      const briefing = await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );
      expect(briefing.metrics_count).toBeLessThan(15);
      expect(briefing.market_stance).toBeDefined();
      expect(briefing.narrative_summary).toBeTruthy();
    });

    it('generates briefing even when metric batch throws', async () => {
      mockMetricResolution.resolveMetricBatch.mockRejectedValue(
        new Error('DB connection timeout'),
      );
      const briefing = await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );
      expect(briefing.metrics_count).toBe(0);
      expect(briefing.narrative_summary).toBeTruthy();
    });
  });

  describe('generation_time_ms is tracked', () => {
    it('records non-negative generation time', async () => {
      const briefing = await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );
      expect(briefing.generation_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('suggested questions generation', () => {
    it('returns an array of suggested questions', async () => {
      mockChatCompletionsCreate
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Strong bullish narrative.' } }],
        })
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content:
                  '1. How does LA compare to national trends?\n2. What are the top risk factors?\n3. Is now a good time to invest?',
              },
            },
          ],
        });

      const briefing = await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );
      expect(briefing.suggested_questions).toBeInstanceOf(Array);
    });

    it('returns empty array when LLM for questions fails', async () => {
      mockChatCompletionsCreate
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Narrative text.' } }],
        })
        .mockRejectedValueOnce(new Error('LLM timeout'));

      const briefing = await service.generateBriefing(
        '31080',
        'metro',
        'Los Angeles',
        BENCHMARKS,
      );
      expect(briefing.suggested_questions).toEqual([]);
    });
  });
});
