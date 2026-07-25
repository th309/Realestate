import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { SocialConnectModule } from '../social-connect/social-connect.module';
import { ContentInsightsController } from './content-insights.controller';
import { ContentInsightsService } from './content-insights.service';
import { InsightsMetricsPullService } from './insights-metrics.pull.service';
import { InsightsMetricsCron } from './insights-metrics.cron';

/**
 * Phase 6: content-pipeline social insights dashboard backend. Aggregates
 * analytics_snapshots into the frozen /insights contract and runs the daily
 * Late metrics pull. Distinct from src/insights/ (AI market narratives).
 *
 * Imports SocialConnectModule for LateClientService (the analytics client).
 *
 * WIRING TODO (team lead): add `ContentInsightsModule` to app.module.ts imports.
 * The controller self-registers `api/admin/content-pipeline/insights/*`; the
 * daily cron only fires when RUN_CRONS=true and no-ops without LATE_API_KEY.
 */
@Module({
  imports: [SupabaseModule, ConfigModule, SocialConnectModule],
  controllers: [ContentInsightsController],
  providers: [
    ContentInsightsService,
    InsightsMetricsPullService,
    InsightsMetricsCron,
  ],
  exports: [ContentInsightsService],
})
export class ContentInsightsModule {}
