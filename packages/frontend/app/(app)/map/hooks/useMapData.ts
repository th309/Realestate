'use client';

/**
 * MAP DATA HOOK
 *
 * Provides map data fetching functionality using the unified data layer.
 * All metric routing is handled by the METRICS registry - no switch statements needed.
 */

import { useState, useEffect, useCallback } from 'react';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, MapData } from '../types';
import {
  fetchSnapshotData,
  fetchMarketStats,
  toHomeValues,
  getMetricConfig,
  isMetricSupportedForGeo,
  type MarketStats,
} from '@/lib/data';

interface UseMapDataReturn {
  mapData: MapData;
  stats: MarketStats | null;
  dataLoading: boolean;
  fetchMapData: (
    level: GeoLevel,
    state?: string,
    metric?: string,
    horizon?: ForecastHorizon,
    rentType?: RentIndexType,
    demandType?: RenterDemandType
  ) => Promise<void>;
}

export function useMapData(): UseMapDataReturn {
  const [mapData, setMapData] = useState<MapData>({});
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  /**
   * Fetch map data based on geo level and metric.
   * Uses the unified data layer - routing is handled by METRICS config.
   */
  const fetchMapData = useCallback(async (
    level: GeoLevel,
    state?: string,
    metric?: string,
    _horizon?: ForecastHorizon,
    _rentType: RentIndexType = 'all',
    _demandType: RenterDemandType = 'all'
  ) => {
    setDataLoading(true);
    try {
      const currentMetric = metric || 'home_value';
      const config = getMetricConfig(currentMetric);

      // Check if metric is supported at this geo level
      if (!isMetricSupportedForGeo(currentMetric, level)) {
        setMapData({});
        return;
      }

      // Use unified data layer for all metrics
      // The registry config determines the correct endpoint and key field
      const metricData = await fetchSnapshotData(currentMetric, level, {
        state,
      });

      // Convert to MapData format (handles both simple numbers and SnapshotEntry)
      const data = toHomeValues(metricData);
      setMapData(data);
    } catch (err) {
      console.error('Error loading data for metric:', metric, err);
      setMapData({});
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Load stats on mount
  useEffect(() => {
    fetchMarketStats().then(setStats).catch(console.error);
  }, []);

  return {
    mapData,
    stats,
    dataLoading,
    fetchMapData,
  };
}
