/**
 * UNIFIED METRIC DATA FETCHING
 *
 * Re-exports from the unified data layer at @/lib/data.
 * This file maintains backward compatibility for existing imports.
 *
 * @deprecated Import directly from '@/lib/data' for new code.
 */

// Re-export types
export type {
  SnapshotEntry as MetricDataEntry,
  SnapshotData as MetricData,
} from '@/lib/data';

// Re-export fetchers
export {
  fetchSnapshotData as fetchMetricData,
  toHomeValues,
} from '@/lib/data';
