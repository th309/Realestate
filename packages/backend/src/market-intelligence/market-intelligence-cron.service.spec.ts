/**
 * MarketIntelligenceCronService Tests
 *
 * Tests that each cron job:
 * - Checks its AppConfig toggle before running
 * - Logs and returns early when disabled
 * - Calls the appropriate service when enabled
 * - Catches and logs errors without crashing
 * - Handles the briefing batch pipeline correctly
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MarketIntelligenceCronService } from './market-intelligence-cron.service';
import { BriefingGeneratorService } from './briefing-generator.service';
import { NewsIngestionService } from './news-ingestion.service';
import { RankingsCacheService } from './rankings-cache.service';
import { AppConfigService } from '../config/app-config.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { SupabaseService } from '../supabase/supabase.service';

// -- Mock Factories ---------------------------------------------------------

function createMockAppConfig(overrides: Record<string, boolean> = {}) {
  return {
    getBool: jest
      .fn()
      .mockImplementation((key: string, defaultValue: boolean) => {
        if (key in overrides) return Promise.resolve(overrides[key]);
        return Promise.resolve(defaultValue);
      }),
    getNumber: jest
      .fn()
      .mockImplementation((_key: string, defaultValue: number) => {
        return Promise.resolve(defaultValue);
      }),
  };
}

function createMockBriefingGenerator() {
  return {
    generateBriefing: jest.fn().mockResolvedValue({ id: 'briefing-1' }),
  };
}

function createMockNewsIngestion() {
  return {
    ingestLatestNews: jest.fn().mockResolvedValue({
      ingested: 5,
      skipped: 2,
      errors: 1,
    }),
  };
}

function createMockRankingsCache() {
  return {
    refreshAll: jest.fn().mockResolvedValue({ succeeded: 30, failed: 0 }),
  };
}

function createMockMetricResolution() {
  return {
    resolveMetricBatch: jest.fn().mockResolvedValue({
      vacancy_rate: { value: 6.5 },
      appreciation_yoy: { value: 4.2 },
      unemployment_rate: { value: 3.8 },
    }),
  };
}

function createMockSupabase(
  geographies: Array<{
    geography_id: string;
    name: string;
    geography_type: string;
  }> = [],
) {
  const mockClient = {
    from: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockImplementation((_col: string, geoType: string) => ({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: geographies.filter((g) => g.geography_type === geoType),
              error: null,
            }),
          }),
        })),
      }),
    })),
  };

  return {
    getClient: jest.fn().mockReturnValue(mockClient),
  };
}

// -- Test Suite --------------------------------------------------------------

describe('MarketIntelligenceCronService', () => {
  let cronService: MarketIntelligenceCronService;
  let appConfig: ReturnType<typeof createMockAppConfig>;
  let briefingGenerator: ReturnType<typeof createMockBriefingGenerator>;
  let newsIngestion: ReturnType<typeof createMockNewsIngestion>;
  let rankingsCache: ReturnType<typeof createMockRankingsCache>;
  let metricResolution: ReturnType<typeof createMockMetricResolution>;
  let supabaseService: ReturnType<typeof createMockSupabase>;

  const sampleGeographies = [
    {
      geography_id: '31080',
      name: 'Los Angeles-Long Beach-Anaheim, CA',
      geography_type: 'metro',
    },
    {
      geography_id: '35620',
      name: 'New York-Newark-Jersey City, NY-NJ-PA',
      geography_type: 'metro',
    },
  ];

  async function buildModule(
    configOverrides: Record<string, boolean> = {},
    geos = sampleGeographies,
  ) {
    appConfig = createMockAppConfig(configOverrides);
    briefingGenerator = createMockBriefingGenerator();
    newsIngestion = createMockNewsIngestion();
    rankingsCache = createMockRankingsCache();
    metricResolution = createMockMetricResolution();
    supabaseService = createMockSupabase(geos);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketIntelligenceCronService,
        { provide: BriefingGeneratorService, useValue: briefingGenerator },
        { provide: NewsIngestionService, useValue: newsIngestion },
        { provide: RankingsCacheService, useValue: rankingsCache },
        { provide: AppConfigService, useValue: appConfig },
        { provide: MetricResolutionService, useValue: metricResolution },
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    cronService = module.get(MarketIntelligenceCronService);
  }

  // -- Weekly Briefings -------------------------------------------------------

  describe('handleWeeklyBriefings', () => {
    it('should skip when BRIEFING_GENERATION_ENABLED is false', async () => {
      await buildModule({ BRIEFING_GENERATION_ENABLED: false });
      await cronService.handleWeeklyBriefings();

      expect(appConfig.getBool).toHaveBeenCalledWith(
        'BRIEFING_GENERATION_ENABLED',
        false,
      );
      expect(briefingGenerator.generateBriefing).not.toHaveBeenCalled();
    });

    it('should generate briefings for all geographies when enabled', async () => {
      await buildModule({ BRIEFING_GENERATION_ENABLED: true });
      await cronService.handleWeeklyBriefings();

      expect(metricResolution.resolveMetricBatch).toHaveBeenCalledWith(
        ['vacancy_rate', 'appreciation_yoy', 'unemployment_rate'],
        'state',
        'US',
      );
      expect(briefingGenerator.generateBriefing).toHaveBeenCalledTimes(2);
      expect(briefingGenerator.generateBriefing).toHaveBeenCalledWith(
        '31080',
        'metro',
        'Los Angeles-Long Beach-Anaheim, CA',
        expect.objectContaining({ vacancy_rate: 6.5 }),
      );
    });

    it('should use default benchmarks when metric resolution fails', async () => {
      await buildModule({ BRIEFING_GENERATION_ENABLED: true });
      metricResolution.resolveMetricBatch.mockRejectedValue(
        new Error('DB down'),
      );

      await cronService.handleWeeklyBriefings();

      // Should still generate briefings with default benchmarks
      expect(briefingGenerator.generateBriefing).toHaveBeenCalledTimes(2);
      expect(briefingGenerator.generateBriefing).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          vacancy_rate: 6.4,
          appreciation_yoy: 3.5,
          unemployment_rate: 3.7,
        }),
      );
    });

    it('should continue processing when individual briefings fail', async () => {
      await buildModule({ BRIEFING_GENERATION_ENABLED: true });
      briefingGenerator.generateBriefing
        .mockRejectedValueOnce(new Error('LLM timeout'))
        .mockResolvedValueOnce({ id: 'briefing-2' });

      await cronService.handleWeeklyBriefings();

      // Both should have been attempted
      expect(briefingGenerator.generateBriefing).toHaveBeenCalledTimes(2);
    });

    it('should not crash when geography fetch returns empty', async () => {
      await buildModule({ BRIEFING_GENERATION_ENABLED: true }, []);
      await cronService.handleWeeklyBriefings();

      expect(briefingGenerator.generateBriefing).not.toHaveBeenCalled();
    });

    it('should not crash when an unexpected error occurs', async () => {
      await buildModule({ BRIEFING_GENERATION_ENABLED: true });
      supabaseService.getClient.mockImplementation(() => {
        throw new Error('Connection refused');
      });

      // Should not throw
      await expect(
        cronService.handleWeeklyBriefings(),
      ).resolves.toBeUndefined();
    });
  });

  // -- Daily News Ingestion ---------------------------------------------------

  describe('handleDailyNewsIngestion', () => {
    it('should skip when NEWS_INGESTION_ENABLED is false', async () => {
      await buildModule({ NEWS_INGESTION_ENABLED: false });
      await cronService.handleDailyNewsIngestion();

      expect(appConfig.getBool).toHaveBeenCalledWith(
        'NEWS_INGESTION_ENABLED',
        false,
      );
      expect(newsIngestion.ingestLatestNews).not.toHaveBeenCalled();
    });

    it('should run news ingestion when enabled', async () => {
      await buildModule({ NEWS_INGESTION_ENABLED: true });
      await cronService.handleDailyNewsIngestion();

      expect(newsIngestion.ingestLatestNews).toHaveBeenCalledTimes(1);
    });

    it('should not crash when news ingestion throws', async () => {
      await buildModule({ NEWS_INGESTION_ENABLED: true });
      newsIngestion.ingestLatestNews.mockRejectedValue(
        new Error('API unreachable'),
      );

      await expect(
        cronService.handleDailyNewsIngestion(),
      ).resolves.toBeUndefined();
    });
  });

  // -- Weekly Rankings --------------------------------------------------------

  describe('handleWeeklyRankings', () => {
    it('should skip when RANKINGS_CACHE_ENABLED is false', async () => {
      await buildModule({ RANKINGS_CACHE_ENABLED: false });
      await cronService.handleWeeklyRankings();

      expect(appConfig.getBool).toHaveBeenCalledWith(
        'RANKINGS_CACHE_ENABLED',
        false,
      );
      expect(rankingsCache.refreshAll).not.toHaveBeenCalled();
    });

    it('should refresh rankings when enabled', async () => {
      await buildModule({ RANKINGS_CACHE_ENABLED: true });
      await cronService.handleWeeklyRankings();

      expect(rankingsCache.refreshAll).toHaveBeenCalledTimes(1);
    });

    it('should not crash when rankings refresh throws', async () => {
      await buildModule({ RANKINGS_CACHE_ENABLED: true });
      rankingsCache.refreshAll.mockRejectedValue(new Error('DB timeout'));

      await expect(cronService.handleWeeklyRankings()).resolves.toBeUndefined();
    });
  });

  // -- Config toggle interaction ----------------------------------------------

  describe('config toggle defaults', () => {
    it('should default all toggles to false (disabled)', async () => {
      await buildModule(); // No overrides -- uses defaults

      await cronService.handleWeeklyBriefings();
      await cronService.handleDailyNewsIngestion();
      await cronService.handleWeeklyRankings();

      expect(briefingGenerator.generateBriefing).not.toHaveBeenCalled();
      expect(newsIngestion.ingestLatestNews).not.toHaveBeenCalled();
      expect(rankingsCache.refreshAll).not.toHaveBeenCalled();
    });
  });
});
