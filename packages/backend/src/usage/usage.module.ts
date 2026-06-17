import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { UsageCoverageService } from './usage-coverage.service';
import { UsageCoverageController } from './usage-coverage.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [UsageCoverageController],
  providers: [UsageCoverageService],
  exports: [UsageCoverageService],
})
export class UsageModule {}
