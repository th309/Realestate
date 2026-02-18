import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AnalyticsEventsController } from './analytics-events.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [AnalyticsEventsController],
})
export class AnalyticsEventsModule {}
