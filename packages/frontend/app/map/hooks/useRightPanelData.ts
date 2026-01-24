import { useMemo } from 'react';
import { useDataCard, useDataCardBatch, DataCardResult } from './useDataCard';
import type { GeoLevel, ViewMode, SelectedGeography } from '../types';
import type { ScoreType, ConfidenceLevel } from './useScoreData';
import type { ScoreIndicator } from '../components/RightDetailPanel/ScoreGaugeCard';

// Component Metric Constants
const INDICATORS = {
  homeready: ['listing_price', 'days_on_market', 'for_sale_inventory'],
  investoredge: ['cap_rate', 'rent_index', 'pending_ratio'],
  markethealth: ['hotness_score', 'inventory_yoy', 'new_listings_yoy'],
};

interface UseRightPanelDataReturn {
  score: number | null;
  trend: {
    direction: 'up' | 'down' | 'flat' | null;
    label: string | null;
  } | null;
  indicators: ScoreIndicator[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch data for the right detail panel using the data binding layer
 */
export function useRightPanelData(
  geography: SelectedGeography | null,
  geoLevel: GeoLevel,
  viewMode: ViewMode
): UseRightPanelDataReturn {
  const regionId = geography?.id || '';
  const scoreMetricId = viewMode === 'homebuyer' ? 'homeready' : 'investoredge';
  const indicatorIds = viewMode === 'homebuyer' ? INDICATORS.homeready : INDICATORS.investoredge;

  // 1. Fetch Main Score
  const mainScore = useDataCard({
    metricId: scoreMetricId,
    geoLevel,
    regionId,
    showTrend: true,
  });

  // 2. Fetch Indicator Metrics
  const indicatorResults = useDataCardBatch(
    indicatorIds,
    geoLevel,
    regionId,
    true
  );

  // 3. Transform indicator results
  const indicators = useMemo((): ScoreIndicator[] => {
    return indicatorIds.map(id => {
      const res = indicatorResults[id];
      return {
        metricId: id,
        label: id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        formattedValue: res?.formattedValue || '--',
        trend: {
          direction: res?.trend?.direction || null,
          label: res?.trend?.label || null,
        }
      };
    });
  }, [indicatorIds, indicatorResults]);

  return {
    score: mainScore.value,
    trend: mainScore.trend,
    indicators,
    isLoading: mainScore.loading,
    error: mainScore.error,
  };
}


