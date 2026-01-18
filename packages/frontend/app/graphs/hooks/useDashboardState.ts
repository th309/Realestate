'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ComparisonConfig } from '../types';
import { GeoLevel } from '@/app/map/config/metrics';
import { STATES, UNIQUE_METRICS } from '../constants';

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

  // Get metric options for dropdown (unique metrics only)
  const metricOptions = useMemo(() => UNIQUE_METRICS, []);

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

  useEffect(() => {
    if (geoLevel === 'national') {
      setSelectedArea('United States');
      setComparison((prev) => ({ ...prev, enabled: false }));
    } else if (!primaryOptions.includes(selectedArea)) {
      setSelectedArea(primaryOptions[0]);
    }
  }, [geoLevel, primaryOptions, selectedArea]);

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
