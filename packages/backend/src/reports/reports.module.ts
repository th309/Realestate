/**
 * PropertyIQ Reports Module
 *
 * Provides services for AI-powered report generation:
 * - ReportsService: Report CRUD and generation pipeline
 * - ClaudeService: Anthropic Claude API for analysis & narratives
 * - ClaudeNewsService: Claude with web search for real-time news scouting
 * - ResearchBriefService: Custom research brief generation (Claude tool-use + DeepSeek narrative)
 */

import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ResearchBriefController } from './research-brief/research-brief.controller';
import { ClaudeService } from './claude.service';
import { ClaudeNewsService } from './claude-news.service';
import { ResearchBriefService } from './research-brief/research-brief.service';
import { ReportGenerationV2Service } from './report-generation-v2.service';
import { ReportFollowUpService } from './report-follow-up.service';
import { ReportFollowUpController } from './report-follow-up.controller';
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
  imports: [
    SupabaseModule,
    ScoringModule,
    MetricsModule,
    TimeSeriesModule,
    EntitlementsModule,
    PartnersModule,
    EconomicModule,
    MarketSnapshotModule,
    MetricResolutionModule,
  ],
  providers: [
    ReportsService,
    ClaudeService,
    ClaudeNewsService,
    ResearchBriefService,
    ReportGenerationV2Service,
    ReportFollowUpService,
  ],
  controllers: [
    ReportsController,
    ResearchBriefController,
    ReportFollowUpController,
  ],
  exports: [
    ReportsService,
    ClaudeService,
    ClaudeNewsService,
    ResearchBriefService,
    ReportGenerationV2Service,
    ReportFollowUpService,
  ],
})
export class ReportsModule {}
