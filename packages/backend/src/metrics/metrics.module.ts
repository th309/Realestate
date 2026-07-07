import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { CalculatedMetricsService } from './calculated-metrics.service';
import { InventorySurplusService } from './inventory-surplus.service';
import { MetricsYieldController } from './metrics-yield.controller';
import { MetricsRentRatiosController } from './metrics-rent-ratios.controller';
import { MetricsMapPrecalcController } from './metrics-map-precalc.controller';
import { MetricsGrowthController } from './metrics-growth.controller';
import { MetricsBatchController } from './metrics-batch.controller';
import { MetricsAffordabilityController } from './metrics-affordability.controller';
import { InventorySurplusController } from './inventory-surplus.controller';
import { RealtorMosInputsService } from './pipelines/realtor-mos-inputs.service';
import { InvestmentMetricsService } from './pipelines/investment-metrics.service';
import { InvestmentMetricsMetrosService } from './pipelines/investment-metrics-metros.service';
import { InvestmentMetricsCountiesService } from './pipelines/investment-metrics-counties.service';
import { InvestmentMetricsZipsService } from './pipelines/investment-metrics-zips.service';
import { OvervaluedMetricsService } from './pipelines/overvalued-metrics.service';
import { OvervaluedMetricsMetrosService } from './pipelines/overvalued-metrics-metros.service';
import { OvervaluedMetricsCountiesService } from './pipelines/overvalued-metrics-counties.service';
import { OvervaluedMetricsZipsService } from './pipelines/overvalued-metrics-zips.service';
import { MetricsPersistenceService } from './pipelines/metrics-persistence.service';
import { FiveYearGrowthMetroService } from './pipelines/five-year-growth-metro.service';
import { FiveYearGrowthAggregateService } from './pipelines/five-year-growth-aggregate.service';
import { FiveYearGrowthGranularService } from './pipelines/five-year-growth-granular.service';
import { FiveYearGrowthService } from './pipelines/five-year-growth.service';
import { AffordabilityMetricsService } from './pipelines/affordability-metrics.service';
import { RedfinDcSnapshotController } from './redfin-dc-snapshot.controller';
import { RedfinDcSnapshotService } from './redfin-dc-snapshot.service';
import { MetricsResolveController } from './metrics-resolve.controller';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';

@Module({
  imports: [SupabaseModule, MetricResolutionModule],
  controllers: [
    MetricsYieldController,
    MetricsRentRatiosController,
    MetricsMapPrecalcController,
    MetricsGrowthController,
    MetricsBatchController,
    MetricsAffordabilityController,
    InventorySurplusController,
    RedfinDcSnapshotController,
    MetricsResolveController,
  ],
  providers: [
    CalculatedMetricsService,
    InventorySurplusService,
    RealtorMosInputsService,
    InvestmentMetricsMetrosService,
    InvestmentMetricsCountiesService,
    InvestmentMetricsZipsService,
    InvestmentMetricsService,
    OvervaluedMetricsMetrosService,
    OvervaluedMetricsCountiesService,
    OvervaluedMetricsZipsService,
    OvervaluedMetricsService,
    MetricsPersistenceService,
    FiveYearGrowthMetroService,
    FiveYearGrowthAggregateService,
    FiveYearGrowthGranularService,
    FiveYearGrowthService,
    AffordabilityMetricsService,
    RedfinDcSnapshotService,
  ],
  exports: [CalculatedMetricsService, InventorySurplusService],
})
export class MetricsModule {}
