/**
 * PropertyIQ Scoring Module
 *
 * Provides services for the simplified fixed-formula scoring system:
 * - ScoringService: Calculates HomeReady, InvestorEdge, and MarketHealth scores
 *   using z-score standardization with ML-derived weights
 *
 * Backtest services (for performance tracking):
 * - OutcomeGeneratorService: Generates actual outcomes from historical data
 * - BacktestRunnerService: Runs backtests comparing scores to outcomes
 * - ConfidenceCalculatorService: Calculates confidence scores
 * - AlertService: Manages performance alerts
 *
 * ML Validation services:
 * - MLValidationService: Validates formula performance against AutoGluon
 */

import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { SupabaseModule } from '../supabase/supabase.module';

// Import backtest services (for performance tracking)
import { OutcomeGeneratorService } from './backtest/outcome-generator.service';
import { BacktestRunnerService } from './backtest/backtest-runner.service';
import { ConfidenceCalculatorService } from './backtest/confidence-calculator.service';
import { AlertService } from './backtest/alert.service';

// Import versioning services
import { FormulaVersionService } from './versioning/formula-version.service';
import { ABTestService } from './versioning/ab-test.service';

// Import ML validation services
import { MLValidationService, MLValidationController } from './ml-validation';
import { BacktestRunsService, BacktestRunsController } from './backtest-runs';

// Legacy services (may still be imported elsewhere)
// These are now simplified or merged into ScoringService
import { InheritanceService } from './inheritance.service';

// Performance tracking service (new)
import { PerformanceTrackingService } from './performance-tracking.service';

@Module({
  imports: [SupabaseModule],
  providers: [
    // Core scoring service (simplified z-score formula system)
    ScoringService,

    // Legacy service kept for backward compatibility
    InheritanceService,

    // Performance tracking service (for monitoring formula performance)
    PerformanceTrackingService,

    // Backtest services (for performance tracking per spec)
    OutcomeGeneratorService,
    BacktestRunnerService,
    ConfidenceCalculatorService,
    AlertService,

    // Versioning services (for future Option B retraining)
    FormulaVersionService,
    ABTestService,

    // ML Validation services
    MLValidationService,

    // Backtest runs services
    BacktestRunsService,
  ],
  controllers: [
    ScoringController,
    MLValidationController,
    BacktestRunsController,
  ],
  exports: [
    ScoringService,
    InheritanceService,
    PerformanceTrackingService,

    // Backtest services
    OutcomeGeneratorService,
    BacktestRunnerService,
    ConfidenceCalculatorService,
    AlertService,

    // Versioning services
    FormulaVersionService,
    ABTestService,

    // ML Validation services
    MLValidationService,

    // Backtest runs services
    BacktestRunsService,
  ],
})
export class ScoringModule {}
