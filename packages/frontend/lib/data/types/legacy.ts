/**
 * LEGACY TYPE ALIASES (for backward compatibility)
 */

import type { SnapshotEntry, SnapshotData } from "./snapshot";
import type { TimeSeriesPoint, TimeSeriesResult } from "./timeseries";

/**
 * @deprecated Use SnapshotEntry instead
 */
export type MetricDataEntry = SnapshotEntry;

/**
 * @deprecated Use SnapshotData instead
 */
export type MetricData = SnapshotData;

/**
 * @deprecated Use SnapshotEntry instead
 */
export type HomeValueEntry = number | SnapshotEntry;

/**
 * @deprecated Use SnapshotData instead
 */
export type HomeValues = Record<string, HomeValueEntry>;

/**
 * @deprecated Use SnapshotData instead
 */
export type MapDataEntry = number | SnapshotEntry;

/**
 * @deprecated Use SnapshotData instead
 */
export type MapData = Record<string, MapDataEntry>;

// Re-export TimeSeriesDataPoint alias for backward compatibility
export type TimeSeriesDataPoint = TimeSeriesPoint;
export type TimeSeriesResponse = TimeSeriesResult;
