/**
 * MARKET EXPLORER FETCHER
 * One metric across all child regions of a scope, aligned to a shared monthly axis.
 * GET /api/market-explorer/scope/:geoLevel
 */
import { fetchAPIWithParams } from "./base";

export type ScopeGeoLevel = "state" | "metro" | "county" | "zip";

export interface ScopeRegion {
  id: string;
  name: string;
  state: string;
  population: number | null;
  nearby?: boolean;
}

export interface ScopeSeriesResponse {
  success: true;
  geoLevel: string;
  metric: string;
  months: number;
  dates: string[];
  regions: ScopeRegion[];
  series: Record<string, (number | null)[]>;
}

export interface ScopeQuery {
  parentLevel?: "state" | "metro" | "county";
  parentId?: string;
  metric: string;
  months: number;
  includeNearby?: boolean;
}

export async function fetchScopeSeries(
  geoLevel: ScopeGeoLevel,
  query: ScopeQuery,
): Promise<ScopeSeriesResponse> {
  return fetchAPIWithParams<ScopeSeriesResponse>(
    `/api/market-explorer/scope/${geoLevel}`,
    {
      parentLevel: query.parentLevel,
      parentId: query.parentId,
      metric: query.metric,
      months: query.months,
      includeNearby: query.includeNearby ? "true" : undefined,
    },
  );
}
