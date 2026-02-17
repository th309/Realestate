import { Module } from '@nestjs/common';
import { MarketSnapshotController } from './market-snapshot.controller';
import { MarketSnapshotService } from './market-snapshot.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [SupabaseModule, ScoringModule],
  controllers: [MarketSnapshotController],
  providers: [MarketSnapshotService],
  exports: [MarketSnapshotService],
})
export class MarketSnapshotModule {}
