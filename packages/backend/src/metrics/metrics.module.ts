import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CalculatedMetricsService } from './calculated-metrics.service';
import { InventorySurplusService } from './inventory-surplus.service';
import { MetricsController } from './metrics.controller';
import { InventorySurplusController } from './inventory-surplus.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [MetricsController, InventorySurplusController],
  providers: [CalculatedMetricsService, InventorySurplusService],
  exports: [CalculatedMetricsService, InventorySurplusService],
})
export class MetricsModule {}
