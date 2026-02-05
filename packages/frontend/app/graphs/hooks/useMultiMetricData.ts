'use client';

import { useState, useEffect, useMemo } from 'react';
import { timeSeriesApi, type GeoLevel } from '@/lib/data';

export interface MetricDataPoint {
  regionId: string;
  regionName: string;
  metrics: Record<string, number>;
}

export interface ScatterDataPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  size?: number;
  color?: number;
  category?: string;
}

export interface BoxPlotDataPoint {
  category: string;
  values: number[];
}

export interface HeatmapDataPoint {
  x: string;
  y: string;
  value: number;
}

export interface CorrelationMetric {
  id: string;
  label: string;
  values: number[];
}

export interface TreemapNode {
  name: string;
  value?: number;
  children?: TreemapNode[];
  colorValue?: number;
}

interface UseMultiMetricDataParams {
  geoLevel: GeoLevel;
  metrics: string[];
  regions?: string[];
  dateRange?: { start: string; end: string };
}

interface MultiMetricResult {
  data: MetricDataPoint[];
  loading: boolean;
  error: string | null;
}

// Hook for fetching multiple metrics across regions
export function useMultiMetricData({
  geoLevel,
  metrics,
  regions,
  dateRange,
}: UseMultiMetricDataParams): MultiMetricResult {
  const [data, setData] = useState<MetricDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (metrics.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get default date range (last year)
        const endDate = dateRange?.end || new Date().toISOString().split('T')[0];
        const startDate = dateRange?.start || (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() - 1);
          return d.toISOString().split('T')[0];
        })();

        // Use provided regions or a default set for demo
        const regionList = regions && regions.length > 0 ? regions : [];

        // If no regions provided, skip fetching (will use sample data)
        if (regionList.length === 0) {
          if (isMounted) {
            setData([]);
            setLoading(false);
          }
          return;
        }

        // Fetch data for each region and metric combination
        const dataMap = new Map<string, MetricDataPoint>();

        for (const regionId of regionList) {
          const point: MetricDataPoint = {
            regionId,
            regionName: regionId, // Will be updated if we have display names
            metrics: {},
          };

          for (const metric of metrics) {
            try {
              const response = await timeSeriesApi.getTimeSeries(
                metric,
                geoLevel,
                regionId,
                startDate,
                endDate
              );

              // Use the most recent value
              if (response.data.length > 0) {
                const latestValue = response.data[response.data.length - 1].value;
                point.metrics[metric] = Number(latestValue) || 0;
              }
            } catch (e) {
              // Skip regions that fail
              console.warn(`Failed to fetch ${metric} for ${regionId}`, e);
            }
          }

          // Only include if we got at least some metrics
          if (Object.keys(point.metrics).length > 0) {
            dataMap.set(regionId, point);
          }
        }

        if (isMounted) {
          setData(Array.from(dataMap.values()));
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch multi-metric data:', err);
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
  }, [geoLevel, JSON.stringify(metrics), JSON.stringify(regions), dateRange?.start, dateRange?.end]);

  return { data, loading, error };
}

// Transform multi-metric data for scatter plot
export function transformToScatterData(
  data: MetricDataPoint[],
  xMetric: string,
  yMetric: string,
  sizeMetric?: string,
  colorMetric?: string
): ScatterDataPoint[] {
  return data
    .filter(d => d.metrics[xMetric] !== undefined && d.metrics[yMetric] !== undefined)
    .map(d => ({
      id: d.regionId,
      label: d.regionName,
      x: d.metrics[xMetric],
      y: d.metrics[yMetric],
      size: sizeMetric ? d.metrics[sizeMetric] : undefined,
      color: colorMetric ? d.metrics[colorMetric] : undefined,
    }));
}

// Transform for box plot - group by category
export function transformToBoxPlotData(
  data: MetricDataPoint[],
  metric: string,
  categoryFn: (d: MetricDataPoint) => string
): BoxPlotDataPoint[] {
  const grouped = new Map<string, number[]>();

  data.forEach(d => {
    const category = categoryFn(d);
    const value = d.metrics[metric];
    if (value !== undefined) {
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(value);
    }
  });

  return Array.from(grouped.entries()).map(([category, values]) => ({
    category,
    values,
  }));
}

// Transform for heatmap - regions × metrics
export function transformToHeatmapData(
  data: MetricDataPoint[],
  metrics: string[]
): HeatmapDataPoint[] {
  const result: HeatmapDataPoint[] = [];

  data.forEach(d => {
    metrics.forEach(metric => {
      const value = d.metrics[metric];
      if (value !== undefined) {
        result.push({
          x: metric,
          y: d.regionName,
          value,
        });
      }
    });
  });

  return result;
}

// Transform for correlation matrix
export function transformToCorrelationData(
  data: MetricDataPoint[],
  metrics: string[],
  metricLabels: Record<string, string>
): CorrelationMetric[] {
  return metrics.map(metric => ({
    id: metric,
    label: metricLabels[metric] || metric,
    values: data.map(d => d.metrics[metric] ?? 0),
  }));
}

// Transform for treemap - hierarchical by category
export function transformToTreemapData(
  data: MetricDataPoint[],
  valueMetric: string,
  colorMetric?: string,
  categoryFn?: (d: MetricDataPoint) => string
): TreemapNode {
  if (!categoryFn) {
    // Flat structure
    return {
      name: 'root',
      children: data.map(d => ({
        name: d.regionName,
        value: d.metrics[valueMetric] ?? 0,
        colorValue: colorMetric ? d.metrics[colorMetric] : undefined,
      })),
    };
  }

  // Group by category
  const grouped = new Map<string, MetricDataPoint[]>();
  data.forEach(d => {
    const category = categoryFn(d);
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(d);
  });

  return {
    name: 'root',
    children: Array.from(grouped.entries()).map(([category, items]) => ({
      name: category,
      children: items.map(d => ({
        name: d.regionName,
        value: d.metrics[valueMetric] ?? 0,
        colorValue: colorMetric ? d.metrics[colorMetric] : undefined,
      })),
    })),
  };
}

// Generate sample data for demo purposes when API data is limited
export function generateSampleScatterData(count: number = 30): ScatterDataPoint[] {
  const metros = [
    'Austin, TX', 'Phoenix, AZ', 'Dallas, TX', 'Miami, FL', 'Denver, CO',
    'Seattle, WA', 'Atlanta, GA', 'Tampa, FL', 'Nashville, TN', 'Charlotte, NC',
    'Portland, OR', 'San Diego, CA', 'Las Vegas, NV', 'Orlando, FL', 'Raleigh, NC',
    'Salt Lake City, UT', 'Jacksonville, FL', 'San Antonio, TX', 'Columbus, OH', 'Indianapolis, IN',
    'Kansas City, MO', 'Oklahoma City, OK', 'Tucson, AZ', 'Richmond, VA', 'Louisville, KY',
    'Sacramento, CA', 'Minneapolis, MN', 'Cleveland, OH', 'Pittsburgh, PA', 'St. Louis, MO',
  ];

  return metros.slice(0, count).map((label, i) => ({
    id: label.toLowerCase().replace(/[^a-z]/g, '-'),
    label,
    x: 150000 + Math.random() * 400000, // Median price
    y: 2 + Math.random() * 15, // Appreciation %
    size: 5000 + Math.random() * 50000, // Market size
    color: -5 + Math.random() * 20, // YoY change
    category: i % 3 === 0 ? 'Hot Market' : i % 3 === 1 ? 'Stable' : 'Emerging',
  }));
}

export function generateSampleBoxPlotData(): BoxPlotDataPoint[] {
  const categories = ['Hot Markets', 'Stable Markets', 'Emerging Markets', 'Cooling Markets'];

  return categories.map(category => ({
    category,
    values: Array.from({ length: 20 + Math.floor(Math.random() * 30) }, () =>
      100000 + Math.random() * 500000
    ),
  }));
}

export function generateSampleHeatmapData(): HeatmapDataPoint[] {
  const regions = ['Austin', 'Phoenix', 'Dallas', 'Miami', 'Denver', 'Seattle', 'Atlanta'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const result: HeatmapDataPoint[] = [];
  regions.forEach(region => {
    months.forEach(month => {
      result.push({
        x: month,
        y: region,
        value: Math.random() * 100,
      });
    });
  });

  return result;
}

export function generateSampleTreemapData(): TreemapNode {
  return {
    name: 'US Housing Market',
    children: [
      {
        name: 'Southwest',
        children: [
          { name: 'Phoenix', value: 45000, colorValue: 12.5 },
          { name: 'Las Vegas', value: 28000, colorValue: 8.2 },
          { name: 'Tucson', value: 12000, colorValue: 6.1 },
        ],
      },
      {
        name: 'Southeast',
        children: [
          { name: 'Miami', value: 52000, colorValue: 15.3 },
          { name: 'Tampa', value: 38000, colorValue: 11.7 },
          { name: 'Atlanta', value: 41000, colorValue: 9.8 },
          { name: 'Charlotte', value: 25000, colorValue: 7.5 },
        ],
      },
      {
        name: 'Texas',
        children: [
          { name: 'Austin', value: 35000, colorValue: 18.2 },
          { name: 'Dallas', value: 48000, colorValue: 10.4 },
          { name: 'Houston', value: 55000, colorValue: 7.9 },
          { name: 'San Antonio', value: 22000, colorValue: 6.3 },
        ],
      },
      {
        name: 'West Coast',
        children: [
          { name: 'Seattle', value: 32000, colorValue: 5.2 },
          { name: 'Portland', value: 18000, colorValue: 3.1 },
          { name: 'San Diego', value: 28000, colorValue: 4.8 },
        ],
      },
    ],
  };
}

export function generateSampleCorrelationData(): CorrelationMetric[] {
  const metrics = [
    { id: 'median_price', label: 'Median Price' },
    { id: 'price_appreciation', label: 'Price Appreciation' },
    { id: 'inventory_level', label: 'Inventory Level' },
    { id: 'days_on_market', label: 'Days on Market' },
    { id: 'sales_volume', label: 'Sales Volume' },
    { id: 'rental_yield', label: 'Rental Yield' },
  ];

  // Generate correlated data
  const baseValues = Array.from({ length: 50 }, () => Math.random());

  return metrics.map(({ id, label }, idx) => ({
    id,
    label,
    values: baseValues.map(base => {
      // Add some correlation structure
      const noise = Math.random() * 0.3;
      const correlation = idx % 2 === 0 ? base : 1 - base;
      return correlation + noise;
    }),
  }));
}
