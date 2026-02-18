import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { BenchmarksService } from './benchmarks.service';
import { BenchmarksController } from './benchmarks.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [BenchmarksController],
  providers: [BenchmarksService],
  exports: [BenchmarksService],
})
export class BenchmarksModule {}
