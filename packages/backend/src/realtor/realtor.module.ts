import { Module } from '@nestjs/common';
import { RealtorController } from './realtor.controller';
import { RealtorService } from './realtor.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [RealtorController],
  providers: [RealtorService],
  exports: [RealtorService],
})
export class RealtorModule {}
