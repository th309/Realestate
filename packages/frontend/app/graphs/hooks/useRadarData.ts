'use client';

/**
 * RADAR DATA HOOK
 *
 * Transforms snapshot metric data into percentile-ranked RadarDataSets
 * for the RadarChart component. For each dimension in the selected preset,
 * fetches ALL regions at the given geoLevel, computes percentile rank for
 * each selected market, and optionally inverts the percentile for metrics
 * where lower is better (e.g., days_on_market).
 *
 * All data fetching goes through @/lib/data (useSnapshotData).
 */

import { useMemo } from 'react';
import { useSnapshotData } from '@/lib/data';
import type { GeoLevel, SnapshotData, SnapshotEntry } from '@/lib/data';
import type { RadarDataSet, RadarDimension } from '@/lib/visualizations/d3/RadarChart';
import { RADAR_PROFILES } from '../constants/radarProfiles';
import type { RadarPreset, RadarDimensionConfig } from '../constants/radarProfiles';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = ['#0891b2', '#3b82f6', '#ea580c'];

/**
 * Maximum number of dimensions supported. This must be a fixed upper bound
 * because we call useSnapshotData once per dimension slot, and React hooks
 * must be called unconditionally in the same order every render.
 */
const MAX_DIMENSIONS = 8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseRadarDataResult {
  datasets: RadarDataSet[];
  dimensions: RadarDimension[];
  isLoading: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a numeric value from a SnapshotEntry.
 * Entries may be plain numbers (legacy) or { value, date?, name? } objects.
 */
function extractValue(entry: SnapshotEntry | number | undefined | null): number | null {
  if (entry == null) return null;
  if (typeof entry === 'number') return isNaN(entry) ? null : entry;
  if (typeof entry === 'object' && entry.value != null) {
    return isNaN(entry.value) ? null : entry.value;
  }
  return null;
}

/**
 * Collect all valid numeric values from a snapshot dataset.
 */
function collectAllValues(allData: SnapshotData): number[] {
  const values: number[] = [];
  for (const key of Object.keys(allData)) {
    const v = extractValue(allData[key]);
    if (v !== null) {
      values.push(v);
    }
  }
  return values;
}

/**
 * Compute the percentile rank of `target` within `sortedValues`.
 * Returns 0-100. Uses the "percentage of values below" method:
 *   percentile = (count of values strictly less than target) / total * 100
 *
 * If `invert` is true, the result is flipped (100 - percentile) so that
 * lower raw values score higher on the radar.
 */
function computePercentile(
  target: number,
  sortedValues: number[],
  invert: boolean,
): number {
  if (sortedValues.length === 0) return 50; // neutral fallback

  // Binary-search-style count of values strictly less than target
  let low = 0;
  let high = sortedValues.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sortedValues[mid] < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  const countBelow = low;

  const percentile = (countBelow / sortedValues.length) * 100;
  return invert ? 100 - percentile : percentile;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches snapshot data for every dimension in the selected radar preset,
 * then computes per-market percentile rankings for each dimension.
 *
 * @param preset       - One of the built-in presets or 'custom'
 * @param geoLevel     - Geography level to query (e.g., 'metro')
 * @param markets      - Up to 3 markets to compare
 * @param customMetricIds - Metric IDs when preset is 'custom'
 */
export function useRadarData(
  preset: RadarPreset,
  geoLevel: GeoLevel,
  markets: { id: string; name: string; state?: string }[],
  customMetricIds?: string[],
): UseRadarDataResult {
  // ── 1. Resolve dimension configs ─────────────────────────────────────
  const dimensionConfigs: RadarDimensionConfig[] = useMemo(() => {
    if (preset !== 'custom') {
      return RADAR_PROFILES[preset].dimensions;
    }
    // Build minimal dimension configs from custom metric IDs
    return (customMetricIds ?? []).slice(0, MAX_DIMENSIONS).map((metricId) => ({
      key: metricId,
      label: metricId,
      metricId,
    }));
  }, [preset, customMetricIds]);

  // Pad to MAX_DIMENSIONS so hook calls are stable across preset changes.
  // Unused slots get a dummy metricId and will be disabled via `enabled: false`.
  const paddedConfigs = useMemo(() => {
    const padded = [...dimensionConfigs];
    while (padded.length < MAX_DIMENSIONS) {
      padded.push({ key: `__pad_${padded.length}`, label: '', metricId: '' });
    }
    return padded;
  }, [dimensionConfigs]);

  // ── 2. Fetch snapshot data for each dimension slot ───────────────────
  // Each useSnapshotData call fetches ALL regions (no regionId) so we can
  // compute percentiles from the full distribution.
  //
  // IMPORTANT: We always call exactly MAX_DIMENSIONS hooks to satisfy the
  // Rules of Hooks. Unused slots are disabled via `enabled: false`.

  const snap0 = useSnapshotData(paddedConfigs[0].metricId || '__noop', geoLevel, undefined, { enabled: !!paddedConfigs[0].metricId });
  const snap1 = useSnapshotData(paddedConfigs[1].metricId || '__noop', geoLevel, undefined, { enabled: !!paddedConfigs[1].metricId });
  const snap2 = useSnapshotData(paddedConfigs[2].metricId || '__noop', geoLevel, undefined, { enabled: !!paddedConfigs[2].metricId });
  const snap3 = useSnapshotData(paddedConfigs[3].metricId || '__noop', geoLevel, undefined, { enabled: !!paddedConfigs[3].metricId });
  const snap4 = useSnapshotData(paddedConfigs[4].metricId || '__noop', geoLevel, undefined, { enabled: !!paddedConfigs[4].metricId });
  const snap5 = useSnapshotData(paddedConfigs[5].metricId || '__noop', geoLevel, undefined, { enabled: !!paddedConfigs[5].metricId });
  const snap6 = useSnapshotData(paddedConfigs[6].metricId || '__noop', geoLevel, undefined, { enabled: !!paddedConfigs[6].metricId });
  const snap7 = useSnapshotData(paddedConfigs[7].metricId || '__noop', geoLevel, undefined, { enabled: !!paddedConfigs[7].metricId });

  const allSnapshots = [snap0, snap1, snap2, snap3, snap4, snap5, snap6, snap7];

  // Only consider the active (non-padded) slots
  const activeSnapshots = allSnapshots.slice(0, dimensionConfigs.length);

  const isLoading = activeSnapshots.some((s) => s.isLoading);
  const error = activeSnapshots.find((s) => s.error)?.error ?? null;

  // ── 3. Build RadarDimension[] for the chart ──────────────────────────
  const dimensions: RadarDimension[] = useMemo(
    () =>
      dimensionConfigs.map((cfg) => ({
        key: cfg.key,
        label: cfg.label,
        description: cfg.description,
      })),
    [dimensionConfigs],
  );

  // ── 4. Compute percentiles and build RadarDataSet[] ──────────────────
  const datasets: RadarDataSet[] = useMemo(() => {
    // Don't compute while data is still loading
    if (isLoading || markets.length === 0) return [];

    // Pre-compute sorted value arrays for each dimension (for percentile lookups)
    const sortedValuesByDim: number[][] = dimensionConfigs.map((_, dimIdx) => {
      const snap = activeSnapshots[dimIdx];
      if (!snap || !snap.allData) return [];
      const vals = collectAllValues(snap.allData);
      vals.sort((a, b) => a - b);
      return vals;
    });

    return markets.map((market, mktIdx) => {
      const values: Record<string, number> = {};

      for (let dimIdx = 0; dimIdx < dimensionConfigs.length; dimIdx++) {
        const cfg = dimensionConfigs[dimIdx];
        const snap = activeSnapshots[dimIdx];
        const sortedVals = sortedValuesByDim[dimIdx];

        if (!snap || !snap.allData) {
          values[cfg.key] = 50; // neutral fallback
          continue;
        }

        const rawEntry = snap.allData[market.id];
        const rawValue = extractValue(rawEntry);

        if (rawValue === null) {
          values[cfg.key] = 50; // no data for this market; neutral
          continue;
        }

        values[cfg.key] = computePercentile(rawValue, sortedVals, !!cfg.invert);
      }

      return {
        label: market.name,
        color: COLORS[mktIdx % COLORS.length],
        values,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    markets,
    dimensionConfigs,
    // Include allData references to recompute when data changes
    snap0.allData, snap1.allData, snap2.allData, snap3.allData,
    snap4.allData, snap5.allData, snap6.allData, snap7.allData,
  ]);

  return { datasets, dimensions, isLoading, error };
}

export default useRadarData;
