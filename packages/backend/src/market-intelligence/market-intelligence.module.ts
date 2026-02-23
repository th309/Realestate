/**
 * Market Intelligence Module
 *
 * Wires together all market intelligence services: briefing generation,
 * news ingestion with geo-tagging, rankings cache, and the cron service
 * that schedules recurring batch jobs.
 *
 * Exports:
 * - BriefingGeneratorService  -- Generates market briefings (used by API controllers)
 * - NewsIngestionService      -- Ingests and classifies news articles
 * - RankingsCacheService      -- Pre-computed top/bottom 10 rankings
 */

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';
import { AppConfigModule } from '../config/app-config.module';
import { BriefingGeneratorService } from './briefing-generator.service';
import { NewsIngestionService } from './news-ingestion.service';
import { GeoTaggerService } from './geo-tagger.service';
import { RankingsCacheService } from './rankings-cache.service';
import { MarketIntelligenceCronService } from './market-intelligence-cron.service';

@Module({
  imports: [
    SupabaseModule,
    MetricResolutionModule,
    AppConfigModule,
  ],
  providers: [
    BriefingGeneratorService,
    NewsIngestionService,
    GeoTaggerService,
    RankingsCacheService,
    MarketIntelligenceCronService,
  ],
  exports: [
    BriefingGeneratorService,
    NewsIngestionService,
    RankingsCacheService,
  ],
})
export class MarketIntelligenceModule {}
