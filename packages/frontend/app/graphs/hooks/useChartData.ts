'use client';

import { useState, useEffect, useMemo } from 'react';
import { ComparisonConfig } from '../types';
import { BaselineConfig, TimeFrame } from './useDashboardState';
import { timeSeriesApi } from '@/lib/api/client';
import { GeoLevel } from '@/app/map/config/metrics';

interface ChartDataItem {
  date: string;
  [key: string]: number | boolean | string | undefined;
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

        // Transform API response to chart format - ensure values are numbers
        const chartData: ChartDataItem[] = primaryResponse.data.map(point => {
          return {
            date: point.date,
            [selectedArea]: Number(point.value) || 0,
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
              const existingPoint = chartData.find(d => d.date === point.date);
              if (existingPoint) {
                existingPoint[comparison.area] = Number(point.value) || 0;
              } else {
                // If the comparison date doesn't exist in primary data, add a new point
                // Note: For simplicity we usually assume same dates, but this is safer
                const newPoint: ChartDataItem = {
                  date: point.date,
                  [comparison.area]: Number(point.value) || 0
                };
                chartData.push(newPoint);
              }
            });
            // Re-sort if we added new dates
            chartData.sort((a, b) => a.date.localeCompare(b.date));
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

            // Merge baseline data - use simple key without special characters
            const baselineKey = `baseline_${baseline.area.replace(/\s+/g, '_')}`;
            console.log('[useChartData] Baseline merge:', {
              baselineKey,
              responseLength: baselineResponse.data.length,
              sampleResponse: baselineResponse.data.slice(0, 2),
            });
            baselineResponse.data.forEach(point => {
              const existingPoint = chartData.find(d => d.date === point.date);
              if (existingPoint) {
                existingPoint[baselineKey] = Number(point.value) || 0;
              } else {
                // If the baseline date doesn't exist in primary data, add a new point
                const newPoint: ChartDataItem = {
                  date: point.date,
                  [baselineKey]: Number(point.value) || 0
                };
                chartData.push(newPoint);
              }
            });
            console.log('[useChartData] After merge, sample chartData:', chartData.slice(0, 3));
            // Re-sort if we added new dates
            chartData.sort((a, b) => a.date.localeCompare(b.date));
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

          if (!isNaN(primaryValue) && !isNaN(prevPrimaryValue)) {
            const growth = (primaryValue - prevPrimaryValue) * 0.8;

            // Generate next date (assuming monthly data)
            const lastDate = new Date(last.date);
            const nextDate = new Date(lastDate);
            nextDate.setMonth(nextDate.getMonth() + 1);
            const nextDateStr = nextDate.toISOString().split('T')[0];

            const forecastItem: ChartDataItem = {
              date: nextDateStr,
              [selectedArea]: Math.round(primaryValue + growth),
              isForecast: 'true', // Use string to match index signature
            };

            if (comparison.enabled && comparison.area) {
              const compValue = (last[comparison.area] as number) || 0;
              forecastItem[comparison.area] = Math.round(compValue + growth * 0.5);
            }

            if (baseline.enabled && baseline.area) {
              const baseKey = `baseline_${baseline.area.replace(/\s+/g, '_')}`;
              const baseValue = (last[baseKey] as number) || 0;
              forecastItem[baseKey] = Math.round(baseValue + growth * 0.3);
            }

            chartData.push(forecastItem);
          }
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
