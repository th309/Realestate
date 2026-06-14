import { Module } from '@nestjs/common';
import { RealtorController } from './realtor.controller';
import { RealtorService } from './realtor.service';
import { RealtorFetchService } from './realtor-fetch.service';
import { RealtorDataService } from './realtor-data.service';
import { RealtorNationalService } from './realtor-national.service';
import { RealtorBenchmarkService } from './realtor-benchmark.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [RealtorController],
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
