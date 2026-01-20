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
 *
 * Backtest services:
 * - OutcomeGeneratorService: Generates actual outcomes from historical data
 * - BacktestRunnerService: Runs backtests comparing scores to outcomes
 * - ConfidenceCalculatorService: Calculates confidence scores
 * - AlertService: Manages confidence alerts
 *
 * Versioning services:
 * - FormulaVersionService: Manages formula versions and rollback
 * - ABTestService: Manages A/B tests for formula comparison
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
import { OutcomeGeneratorService } from './backtest/outcome-generator.service';
import { BacktestRunnerService } from './backtest/backtest-runner.service';
import { ConfidenceCalculatorService } from './backtest/confidence-calculator.service';
import { AlertService } from './backtest/alert.service';
import { FormulaVersionService } from './versioning/formula-version.service';
import { ABTestService } from './versioning/ab-test.service';
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
    // Backtest services
    OutcomeGeneratorService,
    BacktestRunnerService,
    ConfidenceCalculatorService,
    AlertService,
    // Versioning services
    FormulaVersionService,
    ABTestService,
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
    // Backtest services
    OutcomeGeneratorService,
    BacktestRunnerService,
    ConfidenceCalculatorService,
    AlertService,
    // Versioning services
    FormulaVersionService,
    ABTestService,
  ],
})
export class ScoringModule {}
