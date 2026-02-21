/**
 * PropertyIQ Reports Module
 *
 * Provides services for AI-powered report generation:
 * - ReportsService: Report CRUD and generation pipeline
 * - ClaudeService: Anthropic Claude API for analysis & narratives
 * - ClaudeNewsService: Claude with web search for real-time news scouting
 */

import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ClaudeService } from './claude.service';
import { ClaudeNewsService } from './claude-news.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { ScoringModule } from '../scoring/scoring.module';
import { MetricsModule } from '../metrics/metrics.module';
import { TimeSeriesModule } from '../timeseries/timeseries.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { PartnersModule } from '../partners/partners.module';
import { EconomicModule } from '../economic/economic.module';
import { MarketSnapshotModule } from '../market-snapshot/market-snapshot.module';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';

@Module({
  imports: [SupabaseModule, ScoringModule, MetricsModule, TimeSeriesModule, EntitlementsModule, PartnersModule, EconomicModule, MarketSnapshotModule, MetricResolutionModule],
  providers: [ReportsService, ClaudeService, ClaudeNewsService],
  controllers: [ReportsController],
  exports: [ReportsService, ClaudeService, ClaudeNewsService],
})
export class ReportsModule {}
