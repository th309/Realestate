import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CalculatedMetricsService } from './calculated-metrics.service';
import { InventorySurplusService } from './inventory-surplus.service';
import { MetricsController } from './metrics.controller';
import { InventorySurplusController } from './inventory-surplus.controller';
import { RealtorMosInputsService } from './pipelines/realtor-mos-inputs.service';
import { InvestmentMetricsService } from './pipelines/investment-metrics.service';
import { InvestmentMetricsMetrosService } from './pipelines/investment-metrics-metros.service';
import { InvestmentMetricsCountiesService } from './pipelines/investment-metrics-counties.service';
import { InvestmentMetricsZipsService } from './pipelines/investment-metrics-zips.service';

@Module({
  imports: [SupabaseModule],
  controllers: [MetricsController, InventorySurplusController],
  providers: [
    CalculatedMetricsService,
    InventorySurplusService,
    RealtorMosInputsService,
    InvestmentMetricsMetrosService,
    InvestmentMetricsCountiesService,
    InvestmentMetricsZipsService,
    InvestmentMetricsService,
  ],
  exports: [CalculatedMetricsService, InventorySurplusService],
})
export class MetricsModule {}
