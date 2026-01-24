'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ComparisonConfig } from '../types';
import { GeoLevel } from '@/app/map/config/metrics';
import { STATES } from '../constants';
import { useAllMetricOptions } from '@/app/map/hooks/useMetricOptions';

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
  const [selectedArea, setSelectedArea] = useState('Florida');
  const [metric, setMetric] = useState('listing_price'); // Default to listing_price
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('Max');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const [comparison, setComparison] = useState<ComparisonConfig>({
    enabled: false,
    area: 'Texas',
  });
  const [baseline, setBaseline] = useState<BaselineConfig>({
    enabled: false,
    level: 'national',
    area: 'United States',
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
    // Only reset selectedArea when geoLevel actually changes
    if (geoLevel !== prevGeoLevel) {
      setPrevGeoLevel(geoLevel);

      if (geoLevel === 'national') {
        setSelectedArea('United States');
        setComparison((prev) => ({ ...prev, enabled: false }));
      } else if (geoLevel === 'state') {
        // For state, use dropdown options
        if (!primaryOptions.includes(selectedArea)) {
          setSelectedArea(primaryOptions[0]);
        }
      } else {
        // For metro, county, city, zip - clear the area so user can search
        // Set a placeholder that prompts search
        setSelectedArea('');
      }
    }
  }, [geoLevel, prevGeoLevel, primaryOptions, selectedArea]);

  useEffect(() => {
    if (!baselineOptions.includes(baseline.area)) {
      setBaseline((prev) => ({ ...prev, area: baselineOptions[0] }));
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
