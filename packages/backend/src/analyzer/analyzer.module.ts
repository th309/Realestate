import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AnalyzerController } from './analyzer.controller';
import { AnalyzerAiController } from './analyzer-ai.controller';
import { AnalyzerService } from './analyzer.service';
import { AnalyzerPersistenceService } from './analyzer.persistence.service';
import { AnalyzerTierGate } from './analyzer-tier-gate.service';
import { AiInsightsService } from './ai-insights.service';
import { AiInsightsCache } from './ai-insights.cache';
import { FreePreviewMiddleware } from './free-preview.middleware';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';
import { ScoringModule } from '../scoring/scoring.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { RentcastModule } from '../rentcast/rentcast.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';

@Module({
  imports: [
    MetricResolutionModule,
    ScoringModule,
    SupabaseModule,
    EntitlementsModule,
    RentcastModule,
    AiProviderModule,
  ],
  controllers: [AnalyzerController, AnalyzerAiController],
  providers: [
    AnalyzerService,
    AnalyzerPersistenceService,
    AnalyzerTierGate,
    AiInsightsService,
    AiInsightsCache,
    FreePreviewMiddleware,
  ],
  exports: [AnalyzerService, AnalyzerPersistenceService],
})
export class AnalyzerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // FreePreviewMiddleware is only useful for routes that allow anonymous
    // access with a quota cap. `ai-verdict` is JWT-guarded + Pro-gated, so
    // the middleware would never engage there (it skips authenticated users
    // and the guard rejects anonymous ones first). Apply it only to the
    // genuinely-anonymous-permitted `market-context` route.
    consumer.apply(FreePreviewMiddleware).forRoutes({
      path: 'api/analyzer/market-context',
      method: RequestMethod.GET,
    });
  }
}
