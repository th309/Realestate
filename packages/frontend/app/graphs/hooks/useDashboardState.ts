'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { GeoLevel, MetricType, ComparisonConfig } from '../types';
import { STATES } from '../constants';

export interface BaselineConfig {
  enabled: boolean;
  level: GeoLevel;
  area: string;
}

export type TimeFrame = '1Y' | '3Y' | '5Y' | '10Y' | 'Max';
export type ChartType = 'area' | 'line' | 'bar';

export function useDashboardState() {
  const [geoLevel, setGeoLevel] = useState<GeoLevel>(GeoLevel.STATE);
  const [selectedArea, setSelectedArea] = useState('Florida');
  const [metric, setMetric] = useState<MetricType>(MetricType.INVENTORY);
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
    level: GeoLevel.NATIONAL,
    area: 'United States',
  });

  const [showMilestones, setShowMilestones] = useState(true);
  const [showForecast, setShowForecast] = useState(false);

  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    primary: true,
    comparison: true,
    baseline: true,
  });

  const getOptionsForLevel = useCallback((level: GeoLevel) => {
    switch (level) {
      case GeoLevel.NATIONAL:
        return ['United States'];
      case GeoLevel.STATE:
        return STATES;
      case GeoLevel.METRO:
        return [
          'Miami-Fort Lauderdale',
          'New York-Newark',
          'Los Angeles-Long Beach',
          'Chicago-Naperville',
          'Dallas-Fort Worth',
        ];
      case GeoLevel.COUNTY:
        return ['Miami-Dade', 'Los Angeles', 'Cook', 'Harris', 'Maricopa'];
      case GeoLevel.CITY:
        return ['Miami', 'San Francisco', 'Austin', 'Seattle', 'Nashville'];
      case GeoLevel.ZIP:
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
    if (geoLevel === GeoLevel.NATIONAL) {
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
  };
}
