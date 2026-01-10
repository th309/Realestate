import { Module } from '@nestjs/common';
import { ZillowController } from './zillow.controller';
import { ZillowService } from './zillow.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ZillowController],
  providers: [ZillowService],
  exports: [ZillowService],
})
export class ZillowModule {}
