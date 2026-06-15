// URL <-> screener state serialisation. Kept out of ScreenerPageInner so the
// page component stays focused (and under the file-size limit). The screener's
// full view (geo, state, preset, filters, sort, page) round-trips through the
// query string so preset/state URLs are shareable.
import type { ScreenerQuery, ScreenerGeoLevel } from "@/lib/data";
import type { PresetId } from "../components/PresetChips";

export type SortBy = NonNullable<ScreenerQuery["sortBy"]>;

const VALID_SORT: SortBy[] = [
  "score",
  "median_price",
  "cap_rate",
  "gross_yield",
  "rent_to_price_ratio",
  "grm",
  "months_of_supply",
  "overvalued_pct",
  "region_name",
];

const FILTER_KEYS: (keyof ScreenerQuery)[] = [
  "scoreMin",
  "scoreMax",
  "medianPriceMin",
  "medianPriceMax",
  "capRateMin",
  "capRateMax",
  "monthsOfSupplyMin",
  "monthsOfSupplyMax",
  "overvaluedMin",
  "overvaluedMax",
];

export function readGeo(params: URLSearchParams): ScreenerGeoLevel {
  const v = params.get("geo");
  if (v === "metro" || v === "county" || v === "zip") return v;
  return "metro";
}

export function readState(params: URLSearchParams): string {
  return (params.get("state") ?? "").toUpperCase();
}

export function readPreset(params: URLSearchParams): PresetId | null {
  const v = params.get("preset");
  if (v === "hottest" || v === "undervalued" || v === "cashflow") return v;
  return null;
}

function readNum(params: URLSearchParams, key: string): number | undefined {
  const v = params.get(key);
  if (!v) return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

export function readSortBy(params: URLSearchParams): SortBy {
  const v = params.get("sortBy") as SortBy | null;
  return v && VALID_SORT.includes(v) ? v : "score";
}

export function readSortOrder(params: URLSearchParams): "asc" | "desc" {
  return params.get("sortOrder") === "asc" ? "asc" : "desc";
}

export function readPage(params: URLSearchParams): number {
  const v = parseInt(params.get("page") ?? "0", 10);
  return isNaN(v) || v < 0 ? 0 : v;
}

export function readFilters(params: URLSearchParams): Partial<ScreenerQuery> {
  const out: Partial<ScreenerQuery> = {};
  for (const k of FILTER_KEYS) {
    const n = readNum(params, k);
    if (n !== undefined) (out as Record<string, number>)[k] = n;
  }
  return out;
}

export function buildScreenerUrl(
  geo: ScreenerGeoLevel,
  stateFilter: string,
  preset: PresetId | null,
  filters: Partial<ScreenerQuery>,
  sortBy: SortBy,
  sortOrder: "asc" | "desc",
  page: number,
): string {
  const p = new URLSearchParams();
  p.set("geo", geo);
  if (stateFilter) p.set("state", stateFilter);
  if (preset) p.set("preset", preset);
  if (sortBy !== "score") p.set("sortBy", sortBy);
  if (sortOrder !== "desc") p.set("sortOrder", sortOrder);
  if (page > 0) p.set("page", String(page));
  for (const k of FILTER_KEYS) {
    const v = filters[k];
    if (v !== undefined) p.set(k, String(v));
  }
  return p.toString();
}
