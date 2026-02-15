'use client';

import { useMemo } from 'react';
import { useSnapshotData } from '@/lib/data';
import type { GeoLevel, SnapshotData } from '@/lib/data';
import type { ScatterDataPoint } from '@/lib/visualizations/d3/ScatterPlot';
import type { ScatterScope } from './useGraphsState';
import { STATE_TO_CENSUS_REGION, getRegionStates } from '../constants';

interface UseScatterDataOptions {
  /** Primary market ID to highlight */
  primaryId?: string;
  /** State abbreviation of the primary market (for scope filtering) */
  primaryState?: string;
  /** Scope: 'state' = same state, 'region' = same census region, 'national' = all */
  scope: ScatterScope;
}

interface UseScatterDataResult {
  data: ScatterDataPoint[];
  isLoading: boolean;
  error: Error | null;
}

/** Extract state abbreviation from metro name (e.g., "Austin-Round Rock, TX" → "TX") */
function parseStateFromName(name: string): string | null {
  const match = name.match(/,\s*([A-Z]{2})(?:\s*-\s*[A-Z]{2})*\s*$/);
  return match ? match[1] : null;
}

/**
 * Hook to produce ScatterDataPoint[] from two snapshot datasets.
 * Joins X-metric and Y-metric by regionId, filters by scope.
 */
export function useScatterData(
  xMetricId: string,
  yMetricId: string,
  geoLevel: GeoLevel,
  options: UseScatterDataOptions
): UseScatterDataResult {
  const { primaryId, primaryState, scope } = options;

  const xSnap = useSnapshotData(xMetricId, geoLevel);
  const ySnap = useSnapshotData(yMetricId, geoLevel);

  const isLoading = xSnap.isLoading || ySnap.isLoading;
  const error = xSnap.error || ySnap.error;

  const data = useMemo(() => {
    if (isLoading || !xSnap.allData || !ySnap.allData) return [];

    const xData = xSnap.allData;
    const yData = ySnap.allData;

    // Determine allowed states for filtering
    let allowedStates: Set<string> | null = null;
    if (scope === 'state' && primaryState) {
      allowedStates = new Set([primaryState]);
    } else if (scope === 'region' && primaryState) {
      allowedStates = new Set(getRegionStates(primaryState));
    }
    // scope === 'national' → no filtering

    const points: ScatterDataPoint[] = [];

    for (const regionId of Object.keys(xData)) {
      const xEntry = xData[regionId];
      const yEntry = yData[regionId];
      if (!xEntry || !yEntry) continue;

      const xVal = typeof xEntry === 'number' ? xEntry : xEntry.value;
      const yVal = typeof yEntry === 'number' ? yEntry : yEntry.value;
      if (xVal == null || yVal == null || isNaN(xVal) || isNaN(yVal)) continue;

      // Get name for label + state filtering
      const name = (typeof xEntry === 'object' && xEntry.name) || regionId;

      // Filter by state scope
      if (allowedStates) {
        const state = parseStateFromName(name);
        if (!state || !allowedStates.has(state)) continue;
      }

      const isPrimary = regionId === primaryId;

      points.push({
        id: regionId,
        label: name,
        x: xVal,
        y: yVal,
        size: isPrimary ? 14 : 8,
        category: isPrimary ? 'primary' : (parseStateFromName(name) || 'other'),
      });
    }

    return points;
  }, [xSnap.allData, ySnap.allData, isLoading, scope, primaryState, primaryId]);

  return { data, isLoading, error };
}
