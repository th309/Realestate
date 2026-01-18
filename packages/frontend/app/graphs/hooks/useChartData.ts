'use client';

import { useMemo } from 'react';
import { ComparisonConfig } from '../types';
import { MOCK_INVENTORY_DATA, MOCK_COMPARISON_DATA, NATIONAL_AVG_DATA } from '../constants';
import { BaselineConfig, TimeFrame } from './useDashboardState';

interface ChartDataItem {
  year: number;
  [key: string]: number | boolean | undefined;
}

interface UseChartDataParams {
  timeFrame: TimeFrame;
  selectedArea: string;
  comparison: ComparisonConfig;
  baseline: BaselineConfig;
  showForecast: boolean;
}

export function useChartData({
  timeFrame,
  selectedArea,
  comparison,
  baseline,
  showForecast,
}: UseChartDataParams): ChartDataItem[] {
  return useMemo(() => {
    const latestYear = MOCK_INVENTORY_DATA[MOCK_INVENTORY_DATA.length - 1].year;
    let threshold = 0;

    switch (timeFrame) {
      case '1Y':
        threshold = latestYear - 1;
        break;
      case '3Y':
        threshold = latestYear - 3;
        break;
      case '5Y':
        threshold = latestYear - 5;
        break;
      case '10Y':
        threshold = latestYear - 10;
        break;
      default:
        threshold = 0;
    }

    const filtered = MOCK_INVENTORY_DATA.filter((d) => d.year >= threshold).map((d, i) => {
      const jitter = (selectedArea.length % 10) / 100 + 1;
      const item: ChartDataItem = {
        year: d.year,
        [selectedArea]: Math.round(d.value * jitter),
      };

      if (comparison.enabled) {
        item[comparison.area] = MOCK_COMPARISON_DATA[i]?.value || 0;
      }

      if (baseline.enabled) {
        const offset = baseline.area.length * 500;
        item[`Baseline: ${baseline.area}`] = (NATIONAL_AVG_DATA[i]?.value || 0) + offset;
      }

      return item;
    });

    if (showForecast && filtered.length >= 2) {
      const last = filtered[filtered.length - 1];
      const prev = filtered[filtered.length - 2];
      const primaryValue = last[selectedArea] as number;
      const prevPrimaryValue = prev[selectedArea] as number;
      const growth = (primaryValue - prevPrimaryValue) * 0.8;

      const forecastItem: ChartDataItem = {
        year: 2026,
        [selectedArea]: Math.round(primaryValue + growth),
        isForecast: true,
      };

      if (comparison.enabled) {
        const compValue = (last[comparison.area] as number) || 0;
        forecastItem[comparison.area] = Math.round(compValue + growth * 0.5);
      }

      if (baseline.enabled) {
        const baseKey = `Baseline: ${baseline.area}`;
        const baseValue = (last[baseKey] as number) || 0;
        forecastItem[baseKey] = Math.round(baseValue + growth * 0.3);
      }

      filtered.push(forecastItem);
    }

    return filtered;
  }, [timeFrame, selectedArea, comparison, baseline, showForecast]);
}
