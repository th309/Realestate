/**
 * NewsIngestionService Tests
 *
 * Tests the full news ingestion pipeline: RSS feed fetch, deduplication,
 * geo-tagging, LLM classification, and database insertion.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NewsIngestionService } from './news-ingestion.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AppConfigService } from '../config/app-config.service';
import { GeoTaggerService, GeoTagResult } from './geo-tagger.service';
import { BriefingGeneratorService } from './briefing-generator.service';

// -- Mock rss-parser ----------------------------------------------------------

const mockParseURL = jest.fn();

jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: mockParseURL,
  }));
});

// -- Mock OpenAI SDK ----------------------------------------------------------

const mockChatCompletionsCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCompletionsCreate } },
  }));
});

// -- Mock local-news-fetcher --------------------------------------------------

jest.mock('./local-news-fetcher', () => ({
  loadTargetGeographies: jest.fn().mockResolvedValue([]),
  fetchLocalNews: jest.fn().mockResolvedValue([]),
}));

// -- Mock high-severity-detector ----------------------------------------------

jest.mock('./high-severity-detector', () => ({
  triggerHighSeverityBriefingRefresh: jest.fn().mockResolvedValue(undefined),
}));

// -- Test Data ----------------------------------------------------------------

const SAMPLE_RSS_ITEMS = [
  {
    title: 'Denver housing market surges',
    contentSnippet: 'Home prices in the Denver metro area continue to climb.',
    link: 'https://example.com/denver-housing',
    isoDate: '2026-02-20T10:00:00Z',
  },
  {
    title: 'Tampa real estate booms',
    contentSnippet: 'Tampa Bay area sees record buyer activity.',
    link: 'https://example.com/tampa-real-estate',
    isoDate: '2026-02-19T14:00:00Z',
  },
  {
    title: 'National housing trends for 2026',
    contentSnippet: 'Nationwide analysis of the housing market.',
    link: 'https://example.com/national-trends',
    isoDate: '2026-02-18T09:00:00Z',
  },
];

const LLM_CLASSIFICATION_JSON = JSON.stringify({
  summary: 'Denver home prices continue to rise significantly.',
  tags: ['housing', 'prices', 'denver'],
  sentiment: 'positive',
});

// -- Mock Supabase ------------------------------------------------------------

function createMockSupabaseClient(existingUrls: string[] = []) {
  // processAndStoreArticle writes via .upsert(payload, { onConflict: 'url' }),
  // so the write spy mirrors upsert — not insert.
  const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
  // findExistingUrlsBatched: .select('url').in('url', chunk)
  const mockSelectIn = jest.fn().mockResolvedValue({
    data: existingUrls.map((url) => ({ url })),
    error: null,
  });
  // findExistingHeadlines: .select('headline').gte('published_at', cutoff)
  const mockSelectGte = jest.fn().mockResolvedValue({ data: [], error: null });
  const selectChain = { in: mockSelectIn, gte: mockSelectGte };

  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'market_news') {
        return {
          select: jest.fn().mockReturnValue(selectChain),
          upsert: mockUpsert,
        };
      }
      return { select: jest.fn().mockReturnValue(selectChain) };
    }),
    _mockUpsert: mockUpsert,
    _mockSelectIn: mockSelectIn,
    _mockSelectGte: mockSelectGte,
  };
}

// -- Mock GeoTagger -----------------------------------------------------------

function createMockGeoTagger(): jest.Mocked<GeoTaggerService> {
  return {
    tagArticle: jest
      .fn()
      .mockImplementation(async (headline: string): Promise<GeoTagResult[]> => {
        if (headline.toLowerCase().includes('denver')) {
          return [
            {
              geography_id: '19740',
              geography_name: 'Denver-Aurora-Lakewood, CO',
              confidence: 0.95,
            },
          ];
        }
        if (headline.toLowerCase().includes('tampa')) {
          return [
            {
              geography_id: '45300',
              geography_name: 'Tampa-St. Petersburg-Clearwater, FL',
              confidence: 0.95,
            },
          ];
        }
        return [];
      }),
    clearCache: jest.fn(),
  } as any;
}

// -- Mock AppConfig -----------------------------------------------------------

function createMockAppConfig() {
  return {
    get: jest.fn().mockImplementation((key: string, defaultValue = '') => {
      const config: Record<string, string> = {
        AI_BASE_URL: 'https://api.deepseek.com',
        AI_MODEL: 'deepseek-v4-pro',
        DEEPSEEK_API_KEY: 'test-deepseek-key',
      };
      return Promise.resolve(config[key] ?? defaultValue);
    }),
    getNumber: jest.fn().mockImplementation((key: string, defaultValue = 0) => {
      const config: Record<string, number> = {
        QUINN_MAX_METROS: 900,
        QUINN_MAX_COUNTIES: 500,
        QUINN_BRIEFING_BATCH_SIZE: 10,
        QUINN_BRIEFING_BATCH_DELAY_MS: 2000,
      };
      return Promise.resolve(config[key] ?? defaultValue);
    }),
  } as any;
}

// -- Test Suite ---------------------------------------------------------------

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

    // Default: RSS parser returns sample items for every feed
    mockParseURL.mockResolvedValue({ items: SAMPLE_RSS_ITEMS });

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
        {
          provide: BriefingGeneratorService,
          useValue: {
            generateBriefing: jest.fn(),
            generateBriefingOnDemand: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NewsIngestionService>(NewsIngestionService);
  });

  describe('successful ingestion from RSS feeds', () => {
    it('processes articles from RSS feeds and returns correct counts', async () => {
      // Only the first feed returns articles; the rest return the same (deduped by URL)
      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });

      const result = await service.ingestLatestNews();

      expect(result.ingested).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('calls rss-parser for each configured feed', async () => {
      mockParseURL.mockResolvedValue({ items: [] });

      await service.ingestLatestNews();

      // Should be called once per feed (5 default feeds)
      expect(mockParseURL.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('inserts articles into market_news table', async () => {
      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });

      await service.ingestLatestNews();

      expect(mockClient._mockUpsert).toHaveBeenCalledTimes(3);
    });
  });

  describe('geo-tagging integration', () => {
    it('calls geo-tagger for each article', async () => {
      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });

      await service.ingestLatestNews();

      expect(mockGeoTagger.tagArticle).toHaveBeenCalledTimes(3);
    });

    it('stores geography_ids from geo-tagger results', async () => {
      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });

      await service.ingestLatestNews();

      const firstInsertCall = mockClient._mockUpsert.mock.calls[0][0];
      expect(firstInsertCall.geography_ids).toEqual(['19740']);
      expect(firstInsertCall.geo_tag_confidence).toBe(0.95);
    });

    it('stores empty geography_ids for non-matching articles', async () => {
      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });

      await service.ingestLatestNews();

      const thirdInsertCall = mockClient._mockUpsert.mock.calls[2][0];
      expect(thirdInsertCall.geography_ids).toEqual([]);
      expect(thirdInsertCall.geo_tag_confidence).toBe(0);
    });
  });

  describe('LLM classification', () => {
    it('calls LLM for each article', async () => {
      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });

      await service.ingestLatestNews();

      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(3);
    });

    it('stores LLM-generated summary and tags', async () => {
      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });

      await service.ingestLatestNews();

      const firstInsert = mockClient._mockUpsert.mock.calls[0][0];
      expect(firstInsert.summary).toBe(
        'Denver home prices continue to rise significantly.',
      );
      expect(firstInsert.tags).toEqual(['housing', 'prices', 'denver']);
      expect(firstInsert.sentiment).toBe('positive');
    });

    it('falls back to headline as summary when LLM fails', async () => {
      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });
      mockChatCompletionsCreate.mockRejectedValue(new Error('LLM rate limit'));

      const result = await service.ingestLatestNews();

      expect(result.ingested).toBe(3);
      const firstInsert = mockClient._mockUpsert.mock.calls[0][0];
      expect(firstInsert.summary).toBe('Denver housing market surges');
      expect(firstInsert.tags).toEqual([]);
      expect(firstInsert.sentiment).toBe('neutral');
    });
  });

  describe('deduplication by URL', () => {
    it('skips articles whose URLs already exist in market_news', async () => {
      const clientWithExisting = createMockSupabaseClient([
        'https://example.com/denver-housing',
        'https://example.com/tampa-real-estate',
      ]);

      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NewsIngestionService,
          {
            provide: SupabaseService,
            useValue: { getClient: () => clientWithExisting },
          },
          { provide: AppConfigService, useValue: mockAppConfig },
          { provide: GeoTaggerService, useValue: mockGeoTagger },
          {
            provide: BriefingGeneratorService,
            useValue: {
              generateBriefing: jest.fn(),
              generateBriefingOnDemand: jest.fn(),
            },
          },
        ],
      }).compile();

      const dedupService =
        module.get<NewsIngestionService>(NewsIngestionService);
      const result = await dedupService.ingestLatestNews();

      expect(result.skipped).toBe(2);
      expect(result.ingested).toBe(1);
      expect(clientWithExisting._mockUpsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('RSS feed failure handling', () => {
    it('returns zeros when all RSS feeds fail', async () => {
      mockParseURL.mockRejectedValue(new Error('Network error'));

      const result = await service.ingestLatestNews();

      expect(result).toEqual({ ingested: 0, skipped: 0, errors: 0 });
    });

    it('continues when some feeds fail and others succeed', async () => {
      mockParseURL
        .mockRejectedValueOnce(new Error('Feed 1 timeout'))
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockRejectedValue(new Error('Feed 3+ timeout'));

      const result = await service.ingestLatestNews();

      expect(result.ingested).toBe(3);
    });
  });

  describe('individual article error handling', () => {
    it('counts insert failures as errors and continues', async () => {
      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });

      let callCount = 0;
      mockClient._mockUpsert.mockImplementation(() => {
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

    it('silently filters articles with null title at RSS parse stage', async () => {
      mockParseURL
        .mockResolvedValueOnce({
          items: [
            {
              title: null,
              contentSnippet: 'Desc',
              link: 'https://example.com/x',
              isoDate: '2026-02-20T10:00:00Z',
            },
          ],
        })
        .mockResolvedValue({ items: [] });

      const result = await service.ingestLatestNews();

      // Null-title articles are filtered out during RSS parsing, not counted as errors
      expect(result.errors).toBe(0);
      expect(result.ingested).toBe(0);
    });
  });

  describe('article data is stored correctly', () => {
    it('populates all required fields in the insert payload', async () => {
      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });

      await service.ingestLatestNews();

      const firstInsert = mockClient._mockUpsert.mock.calls[0][0];
      expect(firstInsert).toMatchObject({
        url: 'https://example.com/denver-housing',
        headline: 'Denver housing market surges',
        published_at: '2026-02-20T10:00:00Z',
        raw_description:
          'Home prices in the Denver metro area continue to climb.',
        geography_type: 'metro',
      });
      expect(firstInsert.source_name).toBeDefined();
      expect(firstInsert.ingested_at).toBeDefined();
    });

    it('sets geography_type to null when no geo tags found', async () => {
      mockParseURL
        .mockResolvedValueOnce({ items: SAMPLE_RSS_ITEMS })
        .mockResolvedValue({ items: [] });

      await service.ingestLatestNews();

      const thirdInsert = mockClient._mockUpsert.mock.calls[2][0];
      expect(thirdInsert.geography_type).toBeNull();
    });
  });
});
