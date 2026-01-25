/**
 * Analytics Chat Module
 *
 * Provides natural language interface for ad-hoc analytics queries.
 * Uses Claude with tool-use to interpret queries and execute analysis.
 */

import { Module } from '@nestjs/common';
import { AnalyticsChatController } from './analytics-chat.controller';
import { AnalyticsChatService } from './analytics-chat.service';
import { AnalyticsToolsService } from './analytics-tools.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [AnalyticsChatController],
  providers: [AnalyticsChatService, AnalyticsToolsService],
  exports: [AnalyticsChatService],
})
export class AnalyticsChatModule {}
