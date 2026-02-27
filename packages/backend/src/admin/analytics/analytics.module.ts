import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaywallAnalyticsController } from './paywall-analytics.controller';
import { PaywallAnalyticsService } from './paywall-analytics.service';
import { AiInsightsController } from './ai-insights.controller';
import { AiInsightsService } from './ai-insights.service';
import { AiProviderService } from './ai-provider.service';
import { AiInsightsPersistenceController } from './ai-insights-persistence.controller';
import { AiInsightsPersistenceService } from './ai-insights-persistence.service';
import { SupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [SupabaseModule, ConfigModule],
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
  ],
  exports: [PaywallAnalyticsService, AiInsightsService],
})
export class AnalyticsModule {}
