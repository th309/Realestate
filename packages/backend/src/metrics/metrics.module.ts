import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CalculatedMetricsService } from './calculated-metrics.service';

@Module({
  imports: [SupabaseModule],
  providers: [CalculatedMetricsService],
  exports: [CalculatedMetricsService],
})
export class MetricsModule {}
