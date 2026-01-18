/**
 * PropertyIQ Reports Module
 *
 * Provides services for AI-powered report generation:
 * - ReportsService: Report CRUD and generation pipeline
 * - ClaudeService: Anthropic Claude API for analysis & narratives
 * - GeminiNewsService: Google Gemini for real-time news with Search grounding
 */

import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ClaudeService } from './claude.service';
import { GeminiNewsService } from './gemini-news.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { ScoringModule } from '../scoring/scoring.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [SupabaseModule, ScoringModule, MetricsModule],
  providers: [ReportsService, ClaudeService, GeminiNewsService],
  controllers: [ReportsController],
  exports: [ReportsService, ClaudeService, GeminiNewsService],
})
export class ReportsModule {}
