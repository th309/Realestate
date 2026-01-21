/**
 * Backtest Runs Module Exports
 *
 * Exports service, controller, and types for backtest run management.
 */

export { BacktestRunsService } from './backtest-runs.service';
export { BacktestRunsController } from './backtest-runs.controller';

export type {
  BacktestRunConfig,
  BacktestMetrics,
  ConfidenceResult,
  BacktestCellResult,
  BacktestRun,
  BacktestSample,
  ListBacktestRunsParams,
  TriggerBacktestParams,
  TriggerResult,
} from './backtest-runs.service';
