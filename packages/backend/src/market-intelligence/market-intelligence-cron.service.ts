/**
 * Market Intelligence Cron Service
 *
 * Scheduled jobs for batch processing market intelligence data:
 *
 * 1. Weekly briefings (Sunday 2am) -- Generate briefings for top metros/counties
 * 2. Daily news ingestion (6am)    -- Fetch and classify real estate news
 * 3. Weekly rankings (Sunday 3am)  -- Refresh pre-computed rankings cache
 *
 * Each job checks its AppConfig toggle before executing. Errors within
 * individual markets or articles never crash the overall job.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppConfigService } from '../config/app-config.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { SupabaseService } from '../supabase/supabase.service';
import { BriefingGeneratorService } from './briefing-generator.service';
import { NewsIngestionService } from './news-ingestion.service';
import { RankingsCacheService } from './rankings-cache.service';
import { NationalBenchmarks, DEFAULT_NATIONAL_BENCHMARKS } from './market-intelligence.types';

/** A geography row from the geographies table */
interface GeographyRow {
  geography_id: string;
  geography_name: string;
  geography_type: 'metro' | 'county';
}

/** Batch size for briefing generation to avoid overwhelming the LLM API */
const BRIEFING_BATCH_SIZE = 10;

@Injectable()
export class MarketIntelligenceCronService {
  private readonly logger = new Logger(MarketIntelligenceCronService.name);

  constructor(
    private readonly briefingGenerator: BriefingGeneratorService,
    private readonly newsIngestion: NewsIngestionService,
    private readonly rankingsCache: RankingsCacheService,
    private readonly appConfig: AppConfigService,
    private readonly metricResolution: MetricResolutionService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Weekly: Sunday 2am -- Generate market briefings for all tracked geographies.
   *
   * Pipeline:
   * 1. Fetch national benchmarks via MetricResolutionService
   * 2. Query top metros + counties from geographies table
   * 3. Generate briefings in batches with per-market error handling
   * 4. Log summary
   */
  @Cron('0 2 * * 0')
  async handleWeeklyBriefings(): Promise<void> {
    const enabled = await this.appConfig.getBool('BRIEFING_GENERATION_ENABLED', false);
    if (!enabled) {
      this.logger.log('Briefing generation disabled -- skipping');
      return;
    }

    this.logger.log('Starting weekly briefing generation...');
    const startTime = Date.now();
    let succeeded = 0;
    let failed = 0;

    try {
      // 1. Fetch national benchmarks
      const benchmarks = await this.fetchNationalBenchmarks();

      // 2. Fetch target geographies (top metros + counties by population)
      const geographies = await this.fetchTargetGeographies();
      if (geographies.length === 0) {
        this.logger.warn('No geographies found for briefing generation');
        return;
      }

      this.logger.log(`Generating briefings for ${geographies.length} geographies`);

      // 3. Process in batches to avoid overwhelming the LLM API
      for (let i = 0; i < geographies.length; i += BRIEFING_BATCH_SIZE) {
        const batch = geographies.slice(i, i + BRIEFING_BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(geo =>
            this.briefingGenerator.generateBriefing(
              geo.geography_id,
              geo.geography_type,
              geo.geography_name,
              benchmarks,
            ),
          ),
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            succeeded++;
          } else {
            failed++;
            this.logger.warn(`Briefing generation failed: ${result.reason?.message ?? 'unknown'}`);
          }
        }

        // Brief pause between batches to respect rate limits
        if (i + BRIEFING_BATCH_SIZE < geographies.length) {
          await this.sleep(2000);
        }
      }
    } catch (error: any) {
      this.logger.error(`Weekly briefing generation crashed: ${error.message}`);
    }

    const elapsed = Date.now() - startTime;
    this.logger.log(
      `Weekly briefing generation complete in ${elapsed}ms: ` +
      `${succeeded} succeeded, ${failed} failed`,
    );
  }

  /**
   * Daily: 6am -- Ingest latest real estate news articles.
   */
  @Cron('0 6 * * *')
  async handleDailyNewsIngestion(): Promise<void> {
    const enabled = await this.appConfig.getBool('NEWS_INGESTION_ENABLED', false);
    if (!enabled) {
      this.logger.log('News ingestion disabled -- skipping');
      return;
    }

    this.logger.log('Starting daily news ingestion...');
    try {
      const result = await this.newsIngestion.ingestLatestNews();
      this.logger.log(
        `News ingestion complete: ${result.ingested} ingested, ` +
        `${result.skipped} skipped, ${result.errors} errors`,
      );
    } catch (error: any) {
      this.logger.error(`Daily news ingestion crashed: ${error.message}`);
    }
  }

  /**
   * Weekly: Sunday 3am (after briefings) -- Refresh rankings cache.
   */
  @Cron('0 3 * * 0')
  async handleWeeklyRankings(): Promise<void> {
    const enabled = await this.appConfig.getBool('RANKINGS_CACHE_ENABLED', false);
    if (!enabled) {
      this.logger.log('Rankings cache disabled -- skipping');
      return;
    }

    this.logger.log('Starting weekly rankings cache refresh...');
    try {
      const result = await this.rankingsCache.refreshAll();
      this.logger.log(
        `Rankings cache refresh complete: ${result.succeeded} succeeded, ${result.failed} failed`,
      );
    } catch (error: any) {
      this.logger.error(`Weekly rankings cache refresh crashed: ${error.message}`);
    }
  }

  // ==========================================================================
  // Private: National Benchmarks
  // ==========================================================================

  /**
   * Fetch national-level benchmarks via MetricResolutionService.
   * Falls back to hardcoded defaults if resolution fails.
   */
  private async fetchNationalBenchmarks(): Promise<NationalBenchmarks> {
    try {
      const resolved = await this.metricResolution.resolveMetricBatch(
        ['vacancy_rate', 'appreciation_yoy', 'unemployment_rate'],
        'state',
        'US',
      );

      return {
        vacancy_rate: resolved.vacancy_rate?.value ?? DEFAULT_NATIONAL_BENCHMARKS.vacancy_rate,
        appreciation_yoy: resolved.appreciation_yoy?.value ?? DEFAULT_NATIONAL_BENCHMARKS.appreciation_yoy,
        unemployment_rate: resolved.unemployment_rate?.value ?? DEFAULT_NATIONAL_BENCHMARKS.unemployment_rate,
      };
    } catch (error: any) {
      this.logger.warn(
        `Failed to fetch national benchmarks, using defaults: ${error.message}`,
      );
      return { ...DEFAULT_NATIONAL_BENCHMARKS };
    }
  }

  // ==========================================================================
  // Private: Geography Fetching
  // ==========================================================================

  /**
   * Fetch target geographies for briefing generation.
   * Returns up to 900 metros + 500 counties, ordered by population descending.
   */
  private async fetchTargetGeographies(): Promise<GeographyRow[]> {
    try {
      const client = this.supabase.getClient();

      // Fetch metros
      const { data: metros, error: metroError } = await client
        .from('geographies')
        .select('geography_id, geography_name, geography_type')
        .eq('geography_type', 'metro')
        .order('population', { ascending: false })
        .limit(900);

      if (metroError) {
        this.logger.warn(`Failed to fetch metros: ${metroError.message}`);
      }

      // Fetch counties
      const { data: counties, error: countyError } = await client
        .from('geographies')
        .select('geography_id, geography_name, geography_type')
        .eq('geography_type', 'county')
        .order('population', { ascending: false })
        .limit(500);

      if (countyError) {
        this.logger.warn(`Failed to fetch counties: ${countyError.message}`);
      }

      const allGeos: GeographyRow[] = [
        ...((metros ?? []) as GeographyRow[]),
        ...((counties ?? []) as GeographyRow[]),
      ];

      return allGeos;
    } catch (error: any) {
      this.logger.error(`Failed to fetch target geographies: ${error.message}`);
      return [];
    }
  }

  // ==========================================================================
  // Private: Utilities
  // ==========================================================================

  /** Sleep for the given number of milliseconds */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
