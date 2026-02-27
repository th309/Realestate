/**
 * Backtest Services
 *
 * Services for backtesting PropertyIQ scores and tracking confidence.
 */

export { OutcomeGeneratorService } from './outcome-generator.service';
export { OutcomeDataSourceService } from './outcome-data-source.service';
export { OutcomeBenchmarkService } from './outcome-benchmark.service';
export type {
  OutcomeMetrics,
  OutcomeRecord,
  BenchmarkReturns,
  HistoricalDataPoint,
} from './outcome-generator.types';

export { BacktestRunnerService } from './backtest-runner.service';
export type { BacktestParams, BacktestResult } from './backtest-runner.service';

export { ConfidenceCalculatorService } from './confidence-calculator.service';
export type { ConfidenceScore } from './confidence-calculator.service';

export { AlertService } from './alert.service';
export type { Alert, DiagnosticSignal } from './alert.service';
