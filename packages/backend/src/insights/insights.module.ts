/**
 * Insights Module
 *
 * Provides AI-generated market insights (market takes, score explanations,
 * trend interpretations, market overviews) and monthly blog posts. AI text
 * generation goes through the centralized AiProviderService (model selectable
 * per purpose via ai_model_config, default DeepSeek). Pulls context from
 * ScoringService and MetricResolutionService.
 */

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ScoringModule } from '../scoring/scoring.module';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';
import { AiProviderModule } from '../ai-provider/ai-provider.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { BlogGeneratorService } from './blog-generator.service';

@Module({
  imports: [
    SupabaseModule,
    ScoringModule,
    MetricResolutionModule,
    AiProviderModule,
  ],
  controllers: [InsightsController],
  providers: [InsightsService, BlogGeneratorService],
  exports: [InsightsService, BlogGeneratorService],
})
export class InsightsModule {}
