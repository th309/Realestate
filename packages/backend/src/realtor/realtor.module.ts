import { Module } from '@nestjs/common';
import { RealtorHomeValueController } from './realtor-home-value.controller';
import { RealtorPriceController } from './realtor-price.controller';
import { RealtorPriceChangeController } from './realtor-price-change.controller';
import { RealtorInventoryController } from './realtor-inventory.controller';
import { RealtorListingsController } from './realtor-listings.controller';
import { RealtorActivityController } from './realtor-activity.controller';
import { RealtorScoresController } from './realtor-scores.controller';
import { RealtorService } from './realtor.service';
import { RealtorFetchService } from './realtor-fetch.service';
import { RealtorDataService } from './realtor-data.service';
import { RealtorNationalService } from './realtor-national.service';
import { RealtorBenchmarkService } from './realtor-benchmark.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [
    RealtorHomeValueController,
    RealtorPriceController,
    RealtorPriceChangeController,
    RealtorInventoryController,
    RealtorListingsController,
    RealtorActivityController,
    RealtorScoresController,
  ],
  providers: [
    RealtorService,
    RealtorFetchService,
    RealtorDataService,
    RealtorNationalService,
    RealtorBenchmarkService,
  ],
  exports: [RealtorService],
})
export class RealtorModule {}
