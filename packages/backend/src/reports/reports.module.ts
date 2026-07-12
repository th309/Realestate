/**
 * PropertyIQ Reports Module
 *
 * Provides services for AI-powered report generation:
 * - ReportsService: Report CRUD and generation pipeline
 * - ReportAiService: AI-powered analysis & narratives (model-agnostic)
 * - NewsScoutService: Provider-agnostic real-time news scouting
 * - ResearchBriefService: Custom research brief generation (Claude tool-use + DeepSeek narrative)
 */

import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ResearchBriefController } from './research-brief/research-brief.controller';
import { ReportAiService } from './report-ai.service';
import { NewsScoutService } from './news-scout.service';
import { ResearchBriefService } from './research-brief/research-brief.service';
import { ReportGenerationV2Service } from './report-generation-v2.service';
import { ReportsRetentionCron } from './reports-retention.cron';
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
    ReportAiService,
    NewsScoutService,
    ResearchBriefService,
    ReportGenerationV2Service,
    ReportsRetentionCron,
    ReportFollowUpService,
  ],
  controllers: [
    ReportsController,
    ResearchBriefController,
    ReportFollowUpController,
  ],
  exports: [
    ReportsService,
    ReportAiService,
    NewsScoutService,
    ResearchBriefService,
    ReportGenerationV2Service,
    ReportFollowUpService,
  ],
})
export class ReportsModule {}
