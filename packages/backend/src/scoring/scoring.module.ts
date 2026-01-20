/**
 * PropertyIQ Scoring Module
 *
 * Provides services for calculating PropertyIQ scores:
 * - ScoringService: Calculates HomeReady, InvestorEdge, and Market Health scores
 * - PercentileService: Calculates metric percentiles for normalization
 * - NormalizationService: Normalizes metrics to 0-100 scale
 * - InheritanceService: Handles geographic data inheritance
 * - MarketHealthService: Calculates Market Health Index (free tier)
 * - MissingMetricsService: Handles missing data scenarios
 */

import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { PercentileService } from './percentile.service';
import { NormalizationService } from './normalization.service';
import { InheritanceService } from './inheritance.service';
import { MarketHealthService } from './market-health.service';
import { MissingMetricsService } from './missing-metrics.service';
import { ScoreAccessService, ScoreAccessGuard } from './scoring.guard';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [
    ScoringService,
    PercentileService,
    NormalizationService,
    InheritanceService,
    MarketHealthService,
    MissingMetricsService,
    ScoreAccessService,
    ScoreAccessGuard,
  ],
  controllers: [ScoringController],
  exports: [
    ScoringService,
    PercentileService,
    NormalizationService,
    InheritanceService,
    MarketHealthService,
    MissingMetricsService,
    ScoreAccessService,
    ScoreAccessGuard,
  ],
})
export class ScoringModule {}
