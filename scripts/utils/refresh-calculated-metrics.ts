/**
 * Refresh Calculated Metrics - Backward-compatible re-export.
 *
 * The calculation logic has been split into focused modules under scripts/calculations/.
 * This file re-exports refreshCalculatedMetrics so existing import paths continue to work:
 *
 *   import { refreshCalculatedMetrics } from './utils/refresh-calculated-metrics';
 *   await refreshCalculatedMetrics(supabase);
 *
 * New code should import directly from:
 *   import { refreshCalculatedMetrics } from './calculations/calculated-metrics-runner';
 */

export { refreshCalculatedMetrics, type RefreshResult } from '../calculations/calculated-metrics-runner';
