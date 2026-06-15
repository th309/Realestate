/**
 * SCREENER FETCHER
 *
 * Fetches ranked market data from GET /api/screener/:geo.
 * Supports filtering by score, price, cap rate, months of supply,
 * overvaluation, plus sorting and pagination.
 */

import { fetchAPIWithParams } from "./base";

export type ScreenerGeoLevel = "metro" | "county" | "zip";

export interface ScreenerQuery {
  state?: string;
  scoreMin?: number;
  scoreMax?: number;
  capRateMin?: number;
  capRateMax?: number;
  monthsOfSupplyMin?: number;
  monthsOfSupplyMax?: number;
  overvaluedMin?: number;
  overvaluedMax?: number;
  medianPriceMin?: number;
  medianPriceMax?: number;
  sortBy?:
    | "score"
    | "median_price"
    | "cap_rate"
    | "gross_yield"
    | "rent_to_price_ratio"
    | "grm"
    | "months_of_supply"
    | "overvalued_pct"
    | "region_name";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ScreenerRow {
  geo_level: ScreenerGeoLevel;
  region_id: string;
  region_name: string;
  state_code: string;
  score: number | null;
  grade: string | null;
  confidence: number | null;
  median_price: number | null;
  home_value: number | null;
  rent: number | null;
  cap_rate: number | null;
  gross_yield: number | null;
  rent_to_price_ratio: number | null;
  grm: number | null;
  months_of_supply: number | null;
  overvalued_pct: number | null;
  as_of: string | null;
  refreshed_at: string | null;
}

export interface ScreenerResult {
  data: ScreenerRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export async function fetchScreener(
  geoLevel: ScreenerGeoLevel,
  query: ScreenerQuery = {},
): Promise<ScreenerResult> {
  // Build params, dropping undefined so fetchAPIWithParams omits them
  const params: Record<string, string | number | undefined> = {
    state: query.state,
    scoreMin: query.scoreMin,
    scoreMax: query.scoreMax,
    capRateMin: query.capRateMin,
    capRateMax: query.capRateMax,
    monthsOfSupplyMin: query.monthsOfSupplyMin,
    monthsOfSupplyMax: query.monthsOfSupplyMax,
    overvaluedMin: query.overvaluedMin,
    overvaluedMax: query.overvaluedMax,
    medianPriceMin: query.medianPriceMin,
    medianPriceMax: query.medianPriceMax,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    page: query.page,
    pageSize: query.pageSize,
  };

  return fetchAPIWithParams<ScreenerResult>(
    `/api/screener/${geoLevel}`,
    params,
  );
}
