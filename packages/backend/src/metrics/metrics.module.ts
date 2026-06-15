import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CalculatedMetricsService } from './calculated-metrics.service';
import { InventorySurplusService } from './inventory-surplus.service';
import { MetricsController } from './metrics.controller';
import { InventorySurplusController } from './inventory-surplus.controller';
import { RealtorMosInputsService } from './pipelines/realtor-mos-inputs.service';

@Module({
  imports: [SupabaseModule],
  controllers: [MetricsController, InventorySurplusController],
  providers: [
    CalculatedMetricsService,
    InventorySurplusService,
    RealtorMosInputsService,
  ],
  exports: [CalculatedMetricsService, InventorySurplusService],
})
export class MetricsModule {}
