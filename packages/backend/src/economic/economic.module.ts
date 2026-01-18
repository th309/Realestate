import { Module } from '@nestjs/common';
import { EconomicController } from './economic.controller';
import { EconomicService } from './economic.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [EconomicController],
  providers: [EconomicService],
  exports: [EconomicService],
})
export class EconomicModule {}
