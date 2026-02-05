'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ComparisonConfig } from '../types';
import type { GeoLevel } from '@/lib/data';
import { STATES } from '../constants';
import { useAllMetricOptions } from '@/app/map/hooks/useMetricOptions';
import { isMetricAvailableForGeo } from '@/app/map/config/metric-availability';

export interface BaselineConfig {
  enabled: boolean;
  level: GeoLevel;
  area: string;
}

export type TimeFrame = '1Y' | '3Y' | '5Y' | '10Y' | 'Max';
export type ChartType = 'area' | 'line' | 'bar';

// GeoLevel display names for the dropdown
export const GEO_LEVEL_OPTIONS: { value: GeoLevel; label: string }[] = [
  { value: 'national', label: 'National' },
  { value: 'state', label: 'State' },
  { value: 'metro', label: 'Metro' },
  { value: 'county', label: 'County' },
  { value: 'city', label: 'City' },
  { value: 'zip', label: 'ZIP' },
];

// Baseline levels are limited to National and State only
// (metros, counties, cities, ZIPs have too many options for dropdown)
export const BASELINE_GEO_LEVELS: { value: GeoLevel; label: string }[] = [
  { value: 'national', label: 'National' },
  { value: 'state', label: 'State' },
];

export function useDashboardState() {
  const [geoLevel, setGeoLevel] = useState<GeoLevel>('state');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState(''); // Empty until user selects (matches metro/county/city/zip)
  const [metric, setMetric] = useState('listing_price'); // Default to listing_price
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('Max');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const [comparison, setComparison] = useState<ComparisonConfig>({
    enabled: false,
    area: '',
  });
  const [baseline, setBaseline] = useState<BaselineConfig>({
    enabled: false,
    level: 'national',
    area: '',
  });

  const [showMilestones, setShowMilestones] = useState(true);
  const [showForecast, setShowForecast] = useState(false);

  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    primary: true,
    comparison: true,
    baseline: true,
  });

  // Get metric options for dropdown using the new data binding hook
  // Filters metrics by geoLevel so only available metrics are enabled
  const { options: metricOptionsList } = useAllMetricOptions(geoLevel);

  // Transform to the format expected by downstream components
  const metricOptions = useMemo(() =>
    metricOptionsList.map(opt => ({
      id: opt.value,
      name: opt.label,
      category: 'general',
      isPremium: opt.isPremium,
      disabled: opt.disabled,
    })), [metricOptionsList]);

  const getOptionsForLevel = useCallback((level: GeoLevel) => {
    switch (level) {
      case 'national':
        return ['United States'];
      case 'state':
        return STATES;
      case 'metro':
        return [
          'Miami-Fort Lauderdale',
          'New York-Newark',
          'Los Angeles-Long Beach',
          'Chicago-Naperville',
          'Dallas-Fort Worth',
        ];
      case 'county':
        return ['Miami-Dade', 'Los Angeles', 'Cook', 'Harris', 'Maricopa'];
      case 'city':
        return ['Miami', 'San Francisco', 'Austin', 'Seattle', 'Nashville'];
      case 'zip':
        return ['33139', '90210', '10001', '60611', '78701'];
      default:
        return STATES;
    }
  }, []);

  const primaryOptions = useMemo(
    () => getOptionsForLevel(geoLevel),
    [geoLevel, getOptionsForLevel]
  );

  const baselineOptions = useMemo(
    () => getOptionsForLevel(baseline.level),
    [baseline.level, getOptionsForLevel]
  );

  // Track previous geoLevel to detect changes
  const [prevGeoLevel, setPrevGeoLevel] = useState<GeoLevel>(geoLevel);

  useEffect(() => {
    // Only reset selectedArea when geoLevel actually changes; keep empty until user selects (match metro/county/city/zip)
    if (geoLevel !== prevGeoLevel) {
      setPrevGeoLevel(geoLevel);
      setSelectedArea('');
      setSelectedAreaId('');
      if (geoLevel !== 'national') {
        setComparison((prev) => ({ ...prev, enabled: false }));
      }

      // Validate current metric is available at new geo level
      // If not, switch to first available metric
      if (!isMetricAvailableForGeo(metric, geoLevel)) {
        // Find the first enabled metric option
        const firstAvailable = metricOptionsList.find((opt) => !opt.disabled);
        if (firstAvailable) {
          setMetric(firstAvailable.value);
        }
      }
    }
  }, [geoLevel, prevGeoLevel, metric, metricOptionsList]);

  useEffect(() => {
    // Only reset baseline area when level changes and current area not in new options; allow empty
    if (baseline.area && baselineOptions.length > 0 && !baselineOptions.includes(baseline.area)) {
      setBaseline((prev) => ({ ...prev, area: '' }));
    }
  }, [baselineOptions, baseline.area]);

  useEffect(() => {
    setIsDataLoading(true);
    const timer = setTimeout(() => setIsDataLoading(false), 400);
    return () => clearTimeout(timer);
  }, [selectedArea, metric, comparison, baseline, timeFrame, showForecast, chartType]);

  const toggleSeries = useCallback((key: string) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return {
    geoLevel,
    setGeoLevel,
    selectedArea,
    setSelectedArea,
    metric,
    setMetric,
    timeFrame,
    setTimeFrame,
    chartType,
    setChartType,
    aiInsight,
    setAiInsight,
    isInsightLoading,
    setIsInsightLoading,
    isDataLoading,
    selectedAreaId,
    setSelectedAreaId,
    comparison,
    setComparison,
    baseline,
    setBaseline,
    showMilestones,
    setShowMilestones,
    showForecast,
    setShowForecast,
    visibleSeries,
    toggleSeries,
    primaryOptions,
    baselineOptions,
    metricOptions,
  };
}
