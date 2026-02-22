import { fetchAPI } from './base';

export type FreshnessGeoLevel = 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip';
export type FreshnessEconomicMetric = 'unemployment_rate' | 'employment_yoy' | 'gdp_yoy' | 'rpp_all_items';

export interface DataFreshnessResponse {
  generatedAt: string;
  tableDates: Record<string, string | null>;
  sourceDates: Record<string, string | null>;
  zillowDates: {
    historicalByGeo: Record<'state' | 'metro' | 'county' | 'city' | 'zip', string | null>;
    forecastByGeo: Partial<Record<'state' | 'metro' | 'county' | 'city' | 'zip', string | null>>;
  };
  economicMetricDates: Record<FreshnessEconomicMetric, Partial<Record<FreshnessGeoLevel, string | null>>>;
}

export async function fetchDataFreshness(): Promise<DataFreshnessResponse> {
  return fetchAPI<DataFreshnessResponse>('/api/health/data-freshness');
}

