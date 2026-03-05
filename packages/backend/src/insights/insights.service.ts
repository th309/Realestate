/**
 * Insights Service
 *
 * Generates, caches, and serves AI-powered market insights using DeepSeek
 * via the OpenAI SDK. Assembles context from ScoringService and
 * MetricResolutionService, then feeds prompt templates to the AI model.
 *
 * Method bodies are stubs — full implementation is in Task 3.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ScoringService } from '../scoring/scoring.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { MarketInsight, InsightContext, InsightType } from './insights.types';

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);
  private aiClient: OpenAI | null = null;
  private readonly aiModel: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
    private readonly scoringService: ScoringService,
    private readonly metricResolution: MetricResolutionService,
  ) {
    const deepseekKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    this.aiModel =
      this.configService.get<string>('AI_MODEL') || 'deepseek-chat';

    if (deepseekKey) {
      this.aiClient = new OpenAI({
        apiKey: deepseekKey,
        baseURL:
          this.configService.get<string>('AI_BASE_URL') ||
          'https://api.deepseek.com/v1',
      });
      this.logger.log(
        `DeepSeek initialized for insights (model: ${this.aiModel})`,
      );
    } else {
      this.logger.warn(
        'DEEPSEEK_API_KEY not configured - insight generation disabled',
      );
    }
  }

  /**
   * Retrieve a cached insight or generate a fresh one for the given region.
   */
  async getInsight(
    regionId: string,
    geoLevel: string,
    insightType: string,
    archetypeId?: string,
  ): Promise<MarketInsight | null> {
    throw new Error('Not implemented - see Task 3');
  }

  /**
   * Generate insights for all regions at a given geography level.
   * Intended for batch/cron usage.
   */
  async generateBatchInsights(
    geoLevel: string,
  ): Promise<{ generated: number; failed: number; duration_ms: number }> {
    throw new Error('Not implemented - see Task 3');
  }

  /**
   * Assemble the InsightContext for a single region by fetching scores,
   * metrics, and benchmarks.
   */
  async buildInsightContext(
    regionId: string,
    geoLevel: string,
  ): Promise<InsightContext> {
    throw new Error('Not implemented - see Task 3');
  }

  /**
   * Call the AI model with the appropriate prompt template and return
   * the generated text.
   */
  async generateSingleInsight(
    context: InsightContext,
    insightType: InsightType,
  ): Promise<string> {
    throw new Error('Not implemented - see Task 3');
  }
}
