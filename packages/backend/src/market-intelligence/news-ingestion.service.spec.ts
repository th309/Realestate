/**
 * NewsIngestionService Tests
 *
 * Tests the full news ingestion pipeline: News API fetch, deduplication,
 * geo-tagging, LLM classification, and database insertion.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NewsIngestionService } from './news-ingestion.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AppConfigService } from '../config/app-config.service';
import { GeoTaggerService, GeoTagResult } from './geo-tagger.service';
import { BriefingGeneratorService } from './briefing-generator.service';

// -- Mock OpenAI SDK --------------------------------------------------------

const mockChatCompletionsCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCompletionsCreate } },
  }));
});

// -- Mock global fetch ------------------------------------------------------

const mockFetch = jest.fn();
global.fetch = mockFetch;

// -- Test Data --------------------------------------------------------------

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

const LLM_CLASSIFICATION_JSON = JSON.stringify({
  summary: 'Denver home prices continue to rise significantly.',
  tags: ['housing', 'prices', 'denver'],
  sentiment: 'positive',
});

// -- Mock Supabase ----------------------------------------------------------

function createMockSupabaseClient(existingUrls: string[] = []) {
  const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
  const mockSelectIn = jest.fn().mockResolvedValue({
    data: existingUrls.map(url => ({ url })),
    error: null,
  });

  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'market_news') {
        return {
          select: jest.fn().mockReturnValue({ in: mockSelectIn }),
          insert: mockInsert,
        };
      }
      return { select: jest.fn().mockReturnValue({ in: mockSelectIn }) };
    }),
    _mockInsert: mockInsert,
    _mockSelectIn: mockSelectIn,
  };
}

// -- Mock GeoTagger ---------------------------------------------------------

function createMockGeoTagger(): jest.Mocked<GeoTaggerService> {
  return {
    tagArticle: jest.fn().mockImplementation(
      async (headline: string): Promise<GeoTagResult[]> => {
        if (headline.toLowerCase().includes('denver')) {
          return [{ geography_id: '19740', geography_name: 'Denver-Aurora-Lakewood, CO', confidence: 0.95 }];
        }
        if (headline.toLowerCase().includes('tampa')) {
          return [{ geography_id: '45300', geography_name: 'Tampa-St. Petersburg-Clearwater, FL', confidence: 0.95 }];
        }
        return [];
      },
    ),
    clearCache: jest.fn(),
  } as any;
}

// -- Mock AppConfig ---------------------------------------------------------

function createMockAppConfig() {
  return {
    get: jest.fn().mockImplementation((key: string, defaultValue = '') => {
      const config: Record<string, string> = {
        NEWS_API_PROVIDER: 'newsapi',
        NEWS_API_KEY: 'test-news-api-key',
        AI_BASE_URL: 'https://api.deepseek.com',
        AI_MODEL: 'deepseek-chat',
        DEEPSEEK_API_KEY: 'test-deepseek-key',
      };
      return Promise.resolve(config[key] ?? defaultValue);
    }),
  } as any;
}

// -- Test Suite -------------------------------------------------------------

describe('NewsIngestionService', () => {
  let service: NewsIngestionService;
  let mockClient: ReturnType<typeof createMockSupabaseClient>;
  let mockGeoTagger: jest.Mocked<GeoTaggerService>;
  let mockAppConfig: ReturnType<typeof createMockAppConfig>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockClient = createMockSupabaseClient();
    mockGeoTagger = createMockGeoTagger();
    mockAppConfig = createMockAppConfig();

    // Default: News API returns sample articles
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_NEWSAPI_RESPONSE,
    });

    // Default: LLM returns valid classification
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: LLM_CLASSIFICATION_JSON } }],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsIngestionService,
        { provide: SupabaseService, useValue: { getClient: () => mockClient } },
        { provide: AppConfigService, useValue: mockAppConfig },
        { provide: GeoTaggerService, useValue: mockGeoTagger },
        { provide: BriefingGeneratorService, useValue: { generateBriefing: jest.fn(), generateBriefingOnDemand: jest.fn() } },
      ],
    }).compile();

    service = module.get<NewsIngestionService>(NewsIngestionService);
  });

  describe('successful ingestion pipeline', () => {
    it('processes articles from News API and returns correct counts', async () => {
      const result = await service.ingestLatestNews();

      expect(result.ingested).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('calls fetch with NewsAPI URL including query and API key', async () => {
      await service.ingestLatestNews();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain('newsapi.org');
      expect(fetchUrl).toContain('real%20estate');
      expect(fetchUrl).toContain('apiKey=test-news-api-key');
    });

    it('inserts articles into market_news table', async () => {
      await service.ingestLatestNews();

      expect(mockClient._mockInsert).toHaveBeenCalledTimes(3);
    });
  });

  describe('geo-tagging integration', () => {
    it('calls geo-tagger for each article', async () => {
      await service.ingestLatestNews();

      expect(mockGeoTagger.tagArticle).toHaveBeenCalledTimes(3);
    });

    it('stores geography_ids from geo-tagger results', async () => {
      await service.ingestLatestNews();

      // Denver article should get geography_ids=['19740']
      const firstInsertCall = mockClient._mockInsert.mock.calls[0][0];
      expect(firstInsertCall.geography_ids).toEqual(['19740']);
      expect(firstInsertCall.geo_tag_confidence).toBe(0.95);
    });

    it('stores empty geography_ids for non-matching articles', async () => {
      await service.ingestLatestNews();

      // "National housing trends" should have no geo tags
      const thirdInsertCall = mockClient._mockInsert.mock.calls[2][0];
      expect(thirdInsertCall.geography_ids).toEqual([]);
      expect(thirdInsertCall.geo_tag_confidence).toBe(0);
    });
  });

  describe('LLM classification', () => {
    it('calls LLM for each article', async () => {
      await service.ingestLatestNews();

      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(3);
    });

    it('stores LLM-generated summary and tags', async () => {
      await service.ingestLatestNews();

      const firstInsert = mockClient._mockInsert.mock.calls[0][0];
      expect(firstInsert.summary).toBe('Denver home prices continue to rise significantly.');
      expect(firstInsert.tags).toEqual(['housing', 'prices', 'denver']);
      expect(firstInsert.sentiment).toBe('positive');
    });

    it('falls back to headline as summary when LLM fails', async () => {
      mockChatCompletionsCreate.mockRejectedValue(new Error('LLM rate limit'));

      const result = await service.ingestLatestNews();

      expect(result.ingested).toBe(3);
      const firstInsert = mockClient._mockInsert.mock.calls[0][0];
      expect(firstInsert.summary).toBe('Denver housing market surges');
      expect(firstInsert.tags).toEqual([]);
      expect(firstInsert.sentiment).toBe('neutral');
    });

    it('falls back when LLM returns invalid JSON', async () => {
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [{ message: { content: 'This is not JSON' } }],
      });

      const result = await service.ingestLatestNews();

      expect(result.ingested).toBe(3);
      const firstInsert = mockClient._mockInsert.mock.calls[0][0];
      expect(firstInsert.summary).toBe('Denver housing market surges');
      expect(firstInsert.sentiment).toBe('neutral');
    });
  });

  describe('deduplication by URL', () => {
    it('skips articles whose URLs already exist in market_news', async () => {
      const clientWithExisting = createMockSupabaseClient([
        'https://example.com/denver-housing',
        'https://example.com/tampa-real-estate',
      ]);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NewsIngestionService,
          { provide: SupabaseService, useValue: { getClient: () => clientWithExisting } },
          { provide: AppConfigService, useValue: mockAppConfig },
          { provide: GeoTaggerService, useValue: mockGeoTagger },
          { provide: BriefingGeneratorService, useValue: { generateBriefing: jest.fn(), generateBriefingOnDemand: jest.fn() } },
        ],
      }).compile();

      const dedupService = module.get<NewsIngestionService>(NewsIngestionService);
      const result = await dedupService.ingestLatestNews();

      expect(result.skipped).toBe(2);
      expect(result.ingested).toBe(1);
      expect(clientWithExisting._mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('News API failure handling', () => {
    it('returns zeros when News API returns non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const result = await service.ingestLatestNews();

      expect(result).toEqual({ ingested: 0, skipped: 0, errors: 0 });
    });

    it('returns zeros when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.ingestLatestNews();

      expect(result).toEqual({ ingested: 0, skipped: 0, errors: 0 });
    });

    it('returns zeros when NEWS_API_KEY is not configured', async () => {
      mockAppConfig.get.mockImplementation((key: string, defaultValue = '') => {
        if (key === 'NEWS_API_KEY') return Promise.resolve('');
        return Promise.resolve(defaultValue);
      });

      const result = await service.ingestLatestNews();

      expect(result).toEqual({ ingested: 0, skipped: 0, errors: 0 });
    });
  });

  describe('individual article error handling', () => {
    it('counts insert failures as errors and continues', async () => {
      let callCount = 0;
      mockClient._mockInsert.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve({
            data: null,
            error: { message: 'unique constraint violation' },
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const result = await service.ingestLatestNews();

      expect(result.ingested).toBe(2);
      expect(result.errors).toBe(1);
    });

    it('counts articles with null title as errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          totalResults: 1,
          articles: [{ title: null, description: 'Some desc', url: 'https://example.com/x', source: null, publishedAt: '2026-02-20T10:00:00Z' }],
        }),
      });

      const result = await service.ingestLatestNews();

      expect(result.errors).toBe(1);
      expect(result.ingested).toBe(0);
    });
  });

  describe('article data is stored correctly', () => {
    it('populates all required fields in the insert payload', async () => {
      await service.ingestLatestNews();

      const firstInsert = mockClient._mockInsert.mock.calls[0][0];
      expect(firstInsert).toMatchObject({
        url: 'https://example.com/denver-housing',
        headline: 'Denver housing market surges',
        source_name: 'Reuters',
        published_at: '2026-02-20T10:00:00Z',
        raw_description: 'Home prices in the Denver metro area continue to climb.',
        geography_type: 'metro',
      });
      expect(firstInsert.ingested_at).toBeDefined();
    });

    it('sets geography_type to null when no geo tags found', async () => {
      await service.ingestLatestNews();

      const thirdInsert = mockClient._mockInsert.mock.calls[2][0];
      expect(thirdInsert.geography_type).toBeNull();
    });
  });

  describe('unsupported provider handling', () => {
    it('returns zeros for unsupported news provider', async () => {
      mockAppConfig.get.mockImplementation((key: string, defaultValue = '') => {
        const config: Record<string, string> = {
          NEWS_API_PROVIDER: 'unsupported_provider',
          NEWS_API_KEY: 'some-key',
        };
        return Promise.resolve(config[key] ?? defaultValue);
      });

      const result = await service.ingestLatestNews();

      expect(result).toEqual({ ingested: 0, skipped: 0, errors: 0 });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
