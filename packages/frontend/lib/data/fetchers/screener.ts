/**
 * SCREENER FETCHER
 *
 * Fetches ranked market data from GET /api/screener/:geo.
 * Supports filtering by score, price, cap rate, months of supply,
 * overvaluation, plus sorting and pagination.
 */

import { fetchAPIWithParams } from "./base";

export type ScreenerGeoLevel = "metro" | "county" | "zip";
export type MoverWindow = "1m" | "3m" | "6m" | "1y" | "3y" | "5y";

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
    | "region_name"
    | "score_chg_1m"
    | "score_chg_3m"
    | "score_chg_6m"
    | "score_chg_1y"
    | "score_chg_3y"
    | "score_chg_5y";
  sortOrder?: "asc" | "desc";
  changeWindow?: MoverWindow;
  changeMin?: number;
  changeMax?: number;
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
  score_chg_1m: number | null;
  score_chg_3m: number | null;
  score_chg_6m: number | null;
  score_chg_1y: number | null;
  score_chg_3y: number | null;
  score_chg_5y: number | null;
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
    changeWindow: query.changeWindow,
    changeMin: query.changeMin,
    changeMax: query.changeMax,
    page: query.page,
    pageSize: query.pageSize,
  };

  return fetchAPIWithParams<ScreenerResult>(
    `/api/screener/${geoLevel}`,
    params,
  );
}

export interface ScreenerMoversResult {
  window: MoverWindow;
  gainers: ScreenerRow[];
  losers: ScreenerRow[];
}

export interface ScreenerMoversQuery {
  window: MoverWindow;
  state?: string;
  limit?: number;
}

export async function fetchScreenerMovers(
  geoLevel: ScreenerGeoLevel,
  query: ScreenerMoversQuery,
): Promise<ScreenerMoversResult> {
  const params: Record<string, string | number | undefined> = {
    window: query.window,
    state: query.state,
    limit: query.limit,
  };
  return fetchAPIWithParams<ScreenerMoversResult>(
    `/api/screener/${geoLevel}/movers`,
    params,
  );
}
