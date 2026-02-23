/**
 * Market Intelligence Integration Tests: Flows 1-3
 *
 * 1. Briefing generation -> storage -> Quinn lookup
 * 2. Rankings cache refresh -> retrieval
 * 3. News ingestion -> geo-tagging -> storage
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BriefingGeneratorService } from './briefing-generator.service';
import { RankingsCacheService } from './rankings-cache.service';
import { NewsIngestionService } from './news-ingestion.service';
import { GeoTaggerService } from './geo-tagger.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AppConfigService } from '../config/app-config.service';
import { ResolvedMetric } from '../metric-resolution/metric-resolution.types';
import {
  makeResolvedMetric, buildFullResolvedBatch, BENCHMARKS,
  createIntegrationSupabaseClient, createMockMetricResolution,
  createMockAppConfig, createMockGeoTagger,
} from './integration-test-helpers';

// ---------------------------------------------------------------------------
// Mock OpenAI SDK (used by BriefingGenerator + NewsIngestion for LLM calls)
// ---------------------------------------------------------------------------

const mockChatCompletionsCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCompletionsCreate } },
  }));
});

// ---------------------------------------------------------------------------
// Mock global fetch (used by NewsIngestionService)
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ===========================================================================
// Flow 1: Briefing Generation -> Storage -> Quinn Lookup
// ===========================================================================

describe('Flow 1: Briefing generation -> storage -> lookup', () => {
  let briefingService: BriefingGeneratorService;
  let supabaseClient: ReturnType<typeof createIntegrationSupabaseClient>;
  let mockMetricResolution: jest.Mocked<MetricResolutionService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    supabaseClient = createIntegrationSupabaseClient();
    mockMetricResolution = createMockMetricResolution();

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'LA shows bullish momentum with 4.2% appreciation.' } }],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BriefingGeneratorService,
        { provide: MetricResolutionService, useValue: mockMetricResolution },
        { provide: SupabaseService, useValue: { getClient: () => supabaseClient } },
        { provide: AppConfigService, useValue: createMockAppConfig() },
      ],
    }).compile();

    briefingService = module.get<BriefingGeneratorService>(BriefingGeneratorService);
  });

  it('generates a briefing, stores it, and it becomes queryable by geography_id', async () => {
    const briefing = await briefingService.generateBriefing(
      '31080', 'metro', 'Los Angeles-Long Beach-Anaheim, CA', BENCHMARKS,
    );

    expect(briefing.geography_id).toBe('31080');
    expect(briefing.geography_type).toBe('metro');
    expect(briefing.market_stance).toBeDefined();
    expect(briefing.narrative_summary).toContain('LA');
    expect(briefing.metrics_count).toBeGreaterThan(0);

    const storedBriefings = supabaseClient._tables.market_briefings;
    expect(storedBriefings.length).toBe(1);
    expect(storedBriefings[0].geography_id).toBe('31080');
    expect(storedBriefings[0].is_latest).toBe(true);
    expect(storedBriefings[0].metrics_snapshot).toBeDefined();
    expect(storedBriefings[0].market_stance).toBeDefined();
  });

  it('marks previous briefing as not latest before inserting new one', async () => {
    await briefingService.generateBriefing('31080', 'metro', 'Los Angeles', BENCHMARKS);

    const fromCalls = supabaseClient.from.mock.calls;
    const briefingTableCalls = fromCalls.filter(
      (call: any[]) => call[0] === 'market_briefings',
    );
    // At least 2 calls: one update (mark old), one insert (new briefing)
    expect(briefingTableCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('stores stance signals and risk flags in the briefing', async () => {
    const briefing = await briefingService.generateBriefing(
      '31080', 'metro', 'Los Angeles', BENCHMARKS,
    );

    // With appreciation_yoy=4.2 > 3, we expect a bullish signal
    expect(briefing.stance_signals.length).toBeGreaterThan(0);
    const bullishSignal = briefing.stance_signals.find(s => s.direction === 'bullish');
    expect(bullishSignal).toBeDefined();

    // With price_to_income=6.25 > 6.0, we expect an affordability_squeeze flag
    const affordabilityFlag = briefing.risk_flags.find(f => f.flag === 'affordability_squeeze');
    expect(affordabilityFlag).toBeDefined();
    expect(affordabilityFlag!.severity).toBe('medium');
  });

  it('includes suggested questions from LLM', async () => {
    mockChatCompletionsCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Strong bullish narrative for LA.' } }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '1. How does LA compare to national trends?\n2. What are the top risk factors?\n3. Is now a good time to invest?',
          },
        }],
      });

    const briefing = await briefingService.generateBriefing(
      '31080', 'metro', 'Los Angeles', BENCHMARKS,
    );

    expect(briefing.suggested_questions).toBeInstanceOf(Array);
    expect(briefing.suggested_questions.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Flow 2: Rankings Cache Refresh -> Retrieval
// ===========================================================================

describe('Flow 2: Rankings cache refresh -> retrieval', () => {
  let rankingsService: RankingsCacheService;
  let supabaseClient: ReturnType<typeof createIntegrationSupabaseClient>;
  let mockMetricResolution: jest.Mocked<MetricResolutionService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    supabaseClient = createIntegrationSupabaseClient();
    mockMetricResolution = createMockMetricResolution();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankingsCacheService,
        { provide: MetricResolutionService, useValue: mockMetricResolution },
        { provide: SupabaseService, useValue: { getClient: () => supabaseClient } },
      ],
    }).compile();

    rankingsService = module.get<RankingsCacheService>(RankingsCacheService);
  });

  it('refreshes a single metric and stores top/bottom rankings', async () => {
    const resolvedMap = new Map<string, ResolvedMetric>();
    for (let i = 1; i <= 12; i++) {
      resolvedMap.set(`GEO_${i}`, makeResolvedMetric(i * 100000));
    }
    mockMetricResolution.resolveMetricForAllGeos.mockResolvedValue(resolvedMap);

    await rankingsService.refreshMetric('home_value', 'metro');

    const storedRankings = supabaseClient._tables.rankings_cache;
    expect(storedRankings.length).toBe(2);

    const topRanking = storedRankings.find((r: any) => r.direction === 'top');
    const bottomRanking = storedRankings.find((r: any) => r.direction === 'bottom');

    expect(topRanking).toBeDefined();
    expect(bottomRanking).toBeDefined();
    expect(topRanking.is_latest).toBe(true);
    expect(topRanking.metric_id).toBe('home_value');
    expect(topRanking.geography_type).toBe('metro');

    // Top 10 sorted descending, bottom 10 sorted ascending
    expect(topRanking.rank_count).toBe(10);
    expect(topRanking.rankings[0].value).toBe(1200000);
    expect(topRanking.rankings[9].value).toBe(300000);
    expect(bottomRanking.rank_count).toBe(10);
    expect(bottomRanking.rankings[0].value).toBe(100000);
    expect(bottomRanking.rankings[9].value).toBe(1000000);
  });

  it('formats currency values correctly in ranking entries', async () => {
    const resolvedMap = new Map<string, ResolvedMetric>();
    resolvedMap.set('31080', makeResolvedMetric(500000));
    mockMetricResolution.resolveMetricForAllGeos.mockResolvedValue(resolvedMap);

    await rankingsService.refreshMetric('home_value', 'metro');

    const topRanking = supabaseClient._tables.rankings_cache.find(
      (r: any) => r.direction === 'top',
    );
    expect(topRanking.rankings[0].formatted).toBe('$500,000');
  });

  it('formats percent values correctly in ranking entries', async () => {
    const resolvedMap = new Map<string, ResolvedMetric>();
    resolvedMap.set('31080', makeResolvedMetric(4.25));
    mockMetricResolution.resolveMetricForAllGeos.mockResolvedValue(resolvedMap);

    await rankingsService.refreshMetric('appreciation_yoy', 'metro');

    const topRanking = supabaseClient._tables.rankings_cache.find(
      (r: any) => r.direction === 'top',
    );
    expect(topRanking.rankings[0].formatted).toBe('4.25%');
  });

  it('refreshAll processes all metric x geo combinations', async () => {
    const spy = jest.spyOn(rankingsService, 'refreshMetric').mockResolvedValue();
    const result = await rankingsService.refreshAll();

    // 12 metrics x 3 geo levels = 36 combinations
    expect(spy).toHaveBeenCalledTimes(36);
    expect(result.succeeded).toBe(36);
    expect(result.failed).toBe(0);
  });

  it('refreshAll counts failures without aborting remaining metrics', async () => {
    const spy = jest.spyOn(rankingsService, 'refreshMetric');
    spy.mockRejectedValueOnce(new Error('DB timeout'));
    spy.mockResolvedValue();

    const result = await rankingsService.refreshAll();
    expect(result.succeeded).toBe(35);
    expect(result.failed).toBe(1);
  });
});

// ===========================================================================
// Flow 3: News Ingestion -> Geo-Tagging -> Storage
// ===========================================================================

describe('Flow 3: News ingestion -> geo-tagging -> storage', () => {
  let newsService: NewsIngestionService;
  let supabaseClient: ReturnType<typeof createIntegrationSupabaseClient>;
  let mockGeoTagger: jest.Mocked<GeoTaggerService>;
  let mockBriefingGenerator: jest.Mocked<BriefingGeneratorService>;

  const SAMPLE_NEWSAPI_RESPONSE = {
    status: 'ok',
    totalResults: 3,
    articles: [
      {
        title: 'Denver housing market surges',
        description: 'Home prices in the Denver metro area continue to climb.',
        url: 'https://example.com/denver-housing',
        source: { name: 'Reuters' },
        publishedAt: '2026-02-20T10:00:00Z',
      },
      {
        title: 'Tampa real estate booms',
        description: 'Tampa Bay area sees record buyer activity.',
        url: 'https://example.com/tampa-real-estate',
        source: { name: 'Bloomberg' },
        publishedAt: '2026-02-19T14:00:00Z',
      },
      {
        title: 'National housing trends for 2026',
        description: 'Nationwide analysis of the housing market.',
        url: 'https://example.com/national-trends',
        source: { name: 'CNBC' },
        publishedAt: '2026-02-18T09:00:00Z',
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    supabaseClient = createIntegrationSupabaseClient();
    mockGeoTagger = createMockGeoTagger();
    mockBriefingGenerator = {
      generateBriefing: jest.fn().mockResolvedValue({}),
      generateBriefingOnDemand: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_NEWSAPI_RESPONSE,
    });

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: 'Market continues to show strength.',
            tags: ['housing', 'prices'],
            sentiment: 'positive',
          }),
        },
      }],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsIngestionService,
        { provide: SupabaseService, useValue: { getClient: () => supabaseClient } },
        { provide: AppConfigService, useValue: createMockAppConfig() },
        { provide: GeoTaggerService, useValue: mockGeoTagger },
        { provide: BriefingGeneratorService, useValue: mockBriefingGenerator },
      ],
    }).compile();

    newsService = module.get<NewsIngestionService>(NewsIngestionService);
  });

  it('fetches articles, geo-tags them, and stores in market_news', async () => {
    const result = await newsService.ingestLatestNews();

    expect(result.ingested).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
    expect(mockGeoTagger.tagArticle).toHaveBeenCalledTimes(3);

    const storedNews = supabaseClient._tables.market_news;
    expect(storedNews.length).toBe(3);
  });

  it('assigns correct geography_ids based on geo-tagger results', async () => {
    await newsService.ingestLatestNews();

    const storedNews = supabaseClient._tables.market_news;

    const denverArticle = storedNews.find((n: any) => n.headline.includes('Denver'));
    expect(denverArticle.geography_ids).toEqual(['19740']);
    expect(denverArticle.geo_tag_confidence).toBe(0.95);
    expect(denverArticle.geography_type).toBe('metro');

    const tampaArticle = storedNews.find((n: any) => n.headline.includes('Tampa'));
    expect(tampaArticle.geography_ids).toEqual(['45300']);

    const nationalArticle = storedNews.find((n: any) => n.headline.includes('National'));
    expect(nationalArticle.geography_ids).toEqual([]);
    expect(nationalArticle.geography_type).toBeNull();
  });

  it('stores LLM classification results with each article', async () => {
    await newsService.ingestLatestNews();

    const storedNews = supabaseClient._tables.market_news;
    expect(storedNews[0].summary).toBe('Market continues to show strength.');
    expect(storedNews[0].tags).toEqual(['housing', 'prices']);
    expect(storedNews[0].sentiment).toBe('positive');
  });

  it('falls back gracefully when LLM classification fails', async () => {
    mockChatCompletionsCreate.mockRejectedValue(new Error('LLM timeout'));

    const result = await newsService.ingestLatestNews();
    expect(result.ingested).toBe(3);

    const storedNews = supabaseClient._tables.market_news;
    expect(storedNews[0].summary).toBe('Denver housing market surges');
    expect(storedNews[0].tags).toEqual([]);
    expect(storedNews[0].sentiment).toBe('neutral');
  });

  it('deduplicates articles by URL', async () => {
    const mockSelectIn = jest.fn().mockResolvedValue({
      data: [{ url: 'https://example.com/denver-housing' }],
      error: null,
    });
    const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });

    const dedupClient = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnValue({ in: mockSelectIn }),
        insert: mockInsert,
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          contains: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      })),
    };

    const dedupModule: TestingModule = await Test.createTestingModule({
      providers: [
        NewsIngestionService,
        { provide: SupabaseService, useValue: { getClient: () => dedupClient } },
        { provide: AppConfigService, useValue: createMockAppConfig() },
        { provide: GeoTaggerService, useValue: mockGeoTagger },
        { provide: BriefingGeneratorService, useValue: mockBriefingGenerator },
      ],
    }).compile();

    const dedupService = dedupModule.get<NewsIngestionService>(NewsIngestionService);
    const result = await dedupService.ingestLatestNews();

    expect(result.skipped).toBe(1);
    expect(result.ingested).toBe(2);
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
