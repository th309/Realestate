import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaywallAnalyticsController } from './paywall-analytics.controller';
import { PaywallAnalyticsService } from './paywall-analytics.service';
import { AiInsightsController } from './ai-insights.controller';
import { AiInsightsService } from './ai-insights.service';
import { AiProviderService } from './ai-provider.service';
import { AiInsightsPersistenceController } from './ai-insights-persistence.controller';
import { AiInsightsPersistenceService } from './ai-insights-persistence.service';
import { InsightsDataFetcherService } from './insights-data-fetcher.service';
import { InsightsSupabaseQueriesService } from './insights-supabase-queries.service';
import { GrowthProgressService } from './growth-progress.service';
import { SupabaseModule } from '../../supabase/supabase.module';
import { UserAnalyticsModule } from '../../user-analytics/user-analytics.module';

@Module({
  imports: [SupabaseModule, ConfigModule, UserAnalyticsModule],
  controllers: [
    PaywallAnalyticsController,
    AiInsightsController,
    AiInsightsPersistenceController,
  ],
  providers: [
    PaywallAnalyticsService,
    AiInsightsService,
    AiProviderService,
    AiInsightsPersistenceService,
    InsightsDataFetcherService,
    InsightsSupabaseQueriesService,
    GrowthProgressService,
  ],
  exports: [PaywallAnalyticsService, AiInsightsService],
})
export class AnalyticsModule {}
