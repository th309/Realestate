/**
 * Scheduled jobs for market intelligence: weekly briefings (Sun 2am),
 * daily news ingestion (6am), and weekly rankings refresh (Sun 3am).
 * Each job checks its AppConfig toggle before executing.
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
  name: string;
  geography_type: 'metro' | 'county';
}

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

  /** Weekly: Sunday 2am -- Generate market briefings for all tracked geographies. */
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
      const benchmarks = await this.fetchNationalBenchmarks();
      const geographies = await this.fetchTargetGeographies();
      if (geographies.length === 0) {
        this.logger.warn('No geographies found for briefing generation');
        return;
      }

      this.logger.log(`Generating briefings for ${geographies.length} geographies`);

      const batchSize = await this.appConfig.getNumber('QUINN_BRIEFING_BATCH_SIZE', 10);
      const batchDelay = await this.appConfig.getNumber('QUINN_BRIEFING_BATCH_DELAY_MS', 2000);

      for (let i = 0; i < geographies.length; i += batchSize) {
        const batch = geographies.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(geo =>
            this.briefingGenerator.generateBriefing(
              geo.geography_id,
              geo.geography_type,
              geo.name,
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

        if (i + batchSize < geographies.length) {
          await this.sleep(batchDelay);
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

  /** Fetch national benchmarks; falls back to hardcoded defaults on failure. */
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

  /** Fetch target geographies (up to 900 metros + 500 counties) by population. */
  private async fetchTargetGeographies(): Promise<GeographyRow[]> {
    try {
      const client = this.supabase.getClient();
      const maxMetros = await this.appConfig.getNumber('QUINN_MAX_METROS', 900);
      const maxCounties = await this.appConfig.getNumber('QUINN_MAX_COUNTIES', 500);

      const { data: metros, error: metroError } = await client
        .from('geographies')
        .select('geography_id, name, geography_type')
        .eq('geography_type', 'metro')
        .order('population', { ascending: false })
        .limit(maxMetros);

      if (metroError) {
        this.logger.warn(`Failed to fetch metros: ${metroError.message}`);
      }

      const { data: counties, error: countyError } = await client
        .from('geographies')
        .select('geography_id, name, geography_type')
        .eq('geography_type', 'county')
        .order('population', { ascending: false })
        .limit(maxCounties);

      if (countyError) {
        this.logger.warn(`Failed to fetch counties: ${countyError.message}`);
      }

      return [
        ...((metros ?? []) as GeographyRow[]),
        ...((counties ?? []) as GeographyRow[]),
      ];
    } catch (error: any) {
      this.logger.error(`Failed to fetch target geographies: ${error.message}`);
      return [];
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
