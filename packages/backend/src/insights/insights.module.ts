/**
 * Insights Module
 *
 * Provides AI-generated market insights (market takes, score explanations,
 * trend interpretations, market overviews). Uses DeepSeek via the OpenAI
 * SDK for text generation, and pulls context from ScoringService and
 * MetricResolutionService.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { ScoringModule } from '../scoring/scoring.module';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { BlogGeneratorService } from './blog-generator.service';

@Module({
  imports: [
    SupabaseModule,
    ConfigModule,
    ScoringModule,
    MetricResolutionModule,
  ],
  controllers: [InsightsController],
  providers: [InsightsService, BlogGeneratorService],
  exports: [InsightsService, BlogGeneratorService],
})
export class InsightsModule {}
