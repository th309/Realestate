'use client';

import { useState, useEffect, useMemo } from 'react';
import { ComparisonConfig } from '../types';
import { BaselineConfig, TimeFrame } from './useDashboardState';
import { timeSeriesApi } from '@/lib/api/client';
import { GeoLevel } from '@/app/map/config/metrics';

interface ChartDataItem {
  year: number;
  [key: string]: number | boolean | undefined;
}

interface UseChartDataParams {
  metric: string;
  geoLevel: GeoLevel;
  timeFrame: TimeFrame;
  selectedArea: string;
  comparison: ComparisonConfig;
  baseline: BaselineConfig;
  showForecast: boolean;
}

export function useChartData({
  metric,
  geoLevel,
  timeFrame,
  selectedArea,
  comparison,
  baseline,
  showForecast,
}: UseChartDataParams): { data: ChartDataItem[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Calculate date range based on timeFrame
        const endDate = new Date();
        const startDate = new Date();

        switch (timeFrame) {
          case '1Y':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
          case '3Y':
            startDate.setFullYear(endDate.getFullYear() - 3);
            break;
          case '5Y':
            startDate.setFullYear(endDate.getFullYear() - 5);
            break;
          case '10Y':
            startDate.setFullYear(endDate.getFullYear() - 10);
            break;
          default: // 'Max'
            startDate.setFullYear(2000); // Fetch all available data
        }

        const formatDate = (date: Date) => date.toISOString().split('T')[0];

        // Fetch primary series
        const primaryResponse = await timeSeriesApi.getTimeSeries(
          metric,
          geoLevel,
          selectedArea,
          formatDate(startDate),
          formatDate(endDate),
        );

        if (!isMounted) return;

        // Transform API response to chart format
        const chartData: ChartDataItem[] = primaryResponse.data.map(point => {
          const year = new Date(point.date).getFullYear();
          return {
            year,
            [selectedArea]: point.value,
          };
        });

        // Fetch comparison data if enabled
        if (comparison.enabled && comparison.area) {
          try {
            const comparisonResponse = await timeSeriesApi.getTimeSeries(
              metric,
              geoLevel,
              comparison.area,
              formatDate(startDate),
              formatDate(endDate),
            );

            // Merge comparison data
            comparisonResponse.data.forEach(point => {
              const year = new Date(point.date).getFullYear();
              const existingPoint = chartData.find(d => d.year === year);
              if (existingPoint) {
                existingPoint[comparison.area] = point.value;
              }
            });
          } catch (err) {
            console.error('Failed to fetch comparison data:', err);
          }
        }

        // Fetch baseline data if enabled
        if (baseline.enabled && baseline.area) {
          try {
            const baselineResponse = await timeSeriesApi.getTimeSeries(
              metric,
              baseline.level,
              baseline.area,
              formatDate(startDate),
              formatDate(endDate),
            );

            // Merge baseline data
            const baselineKey = `Baseline: ${baseline.area}`;
            baselineResponse.data.forEach(point => {
              const year = new Date(point.date).getFullYear();
              const existingPoint = chartData.find(d => d.year === year);
              if (existingPoint) {
                existingPoint[baselineKey] = point.value;
              }
            });
          } catch (err) {
            console.error('Failed to fetch baseline data:', err);
          }
        }

        // Add forecast if enabled (simple linear projection)
        if (showForecast && chartData.length >= 2) {
          const last = chartData[chartData.length - 1];
          const prev = chartData[chartData.length - 2];
          const primaryValue = last[selectedArea] as number;
          const prevPrimaryValue = prev[selectedArea] as number;
          const growth = (primaryValue - prevPrimaryValue) * 0.8;

          const forecastItem: ChartDataItem = {
            year: last.year + 1,
            [selectedArea]: Math.round(primaryValue + growth),
            isForecast: true,
          };

          if (comparison.enabled && comparison.area) {
            const compValue = (last[comparison.area] as number) || 0;
            forecastItem[comparison.area] = Math.round(compValue + growth * 0.5);
          }

          if (baseline.enabled) {
            const baseKey = `Baseline: ${baseline.area}`;
            const baseValue = (last[baseKey] as number) || 0;
            forecastItem[baseKey] = Math.round(baseValue + growth * 0.3);
          }

          chartData.push(forecastItem);
        }

        if (isMounted) {
          setData(chartData);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch chart data:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch data');
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [metric, geoLevel, timeFrame, selectedArea, comparison.enabled, comparison.area, baseline.enabled, baseline.area, baseline.level, showForecast]);

  return { data, loading, error };
}
