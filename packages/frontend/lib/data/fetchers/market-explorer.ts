/**
 * MARKET EXPLORER FETCHER
 * All 8 core metrics across all child regions of a scope, aligned to one
 * shared monthly axis, in a single request.
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
  months: number;
  dates: string[];
  regions: ScopeRegion[];
  /** series[metric][regionId] = aligned monthly values */
  series: Record<string, Record<string, (number | null)[]>>;
  /** Present only when the roster was capped below the true count (ZIP tier). */
  totalAvailable?: number;
}

export interface ScopeQuery {
  parentLevel?: "state" | "metro" | "county";
  parentId?: string;
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
      months: query.months,
      includeNearby: query.includeNearby ? "true" : undefined,
    },
  );
}
