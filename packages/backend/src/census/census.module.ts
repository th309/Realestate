import { Module } from '@nestjs/common';
import { CensusController } from './census.controller';
import { CensusService } from './census.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CensusController],
  providers: [CensusService],
  exports: [CensusService],
})
export class CensusModule {}
