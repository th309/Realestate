/**
 * Shared building blocks for backend data-ingestion services.
 *
 * Source services (zillow, realtor, fred, census) own their download +
 * parse + transform logic; everything else (validation, batching,
 * logging, status reporting) flows through these helpers so the four
 * services stay consistent without inheritance.
 */

export {
  reportPipelineStatus,
  determineOverallStatus,
  buildErrorSummary,
} from './pipeline-reporter';
export type {
  PipelineStatus,
  GeographyStatus,
  PipelineGeographyReport,
} from './pipeline-reporter';

export { IngestionLogger } from './ingestion-logger';
export type { IngestionLogPayload } from './ingestion-logger';

export {
  VALID_RANGES_BY_SOURCE,
  validateMetricValue,
} from './metric-validation';
export type { ValidationRange } from './metric-validation';

export { batchUpsertWithRetry } from './batch-upsert';
export type { BatchUpsertOptions, BatchUpsertResult } from './batch-upsert';
