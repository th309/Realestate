import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ScreenerService } from './screener.service';
import { ScreenerController } from './screener.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [ScreenerController],
  providers: [ScreenerService],
  exports: [ScreenerService],
})
export class ScreenerModule {}
