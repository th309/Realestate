import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CalculatedMetricsService } from './calculated-metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [MetricsController],
  providers: [CalculatedMetricsService],
  exports: [CalculatedMetricsService],
})
export class MetricsModule {}
