/**
 * PropertyIQ Scoring Module
 *
 * Provides services for calculating PropertyIQ scores:
 * - ScoringService: Calculates HomeReady and InvestorEdge scores
 * - PercentileService: Calculates metric percentiles for normalization
 */

import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { PercentileService } from './percentile.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [ScoringService, PercentileService],
  controllers: [ScoringController],
  exports: [ScoringService, PercentileService],
})
export class ScoringModule {}
