import { getMetricTitle, getMetricFormat } from "@/lib/data";

export type ExplorerGeoLevel = "state" | "metro" | "county" | "zip";
export type ExplorerMetricId =
  | "score"
  | "hotness"
  | "home_value_yoy"
  | "rent_yield"
  | "dom"
  | "supply";
export type ViewMode = "bubbles" | "map";
export type RangePreset = 6 | 12 | 24 | 60 | 120;

export interface PathCrumb {
  level: ExplorerGeoLevel;
  id: string;
  name: string;
  /** 2-letter state code of the drilled-into region. Populated at DRILL time
   * from the region's own `state` field — used by useGeoBoundaries to resolve
   * the per-state ZIP boundary endpoint when the user drills county -> zip. */
  state?: string;
}

export interface ExplorerState {
  path: PathCrumb[]; // [] = national
  selectedId: string | null;
  pinnedIds: string[]; // up to 3
  metric: ExplorerMetricId;
  monthIndex: number; // index into the fetched `dates` axis
  view: ViewMode; // 'bubbles' or 'map' — map works at every drilled scope
  /** Geo level shown at the national root (path === []). Independent of
   * `view` — Bubbles/Map is just a rendering toggle within whichever root
   * level (State/Metro) is selected; only meaningful when `path` is empty. */
  rootLevel: ExplorerGeoLevel;
  range: RangePreset;
  playing: boolean;
  includeNearby: boolean;
}

/** The 8 timeseries metrics fetched once per scope; everything else is derived. */
export const FETCHED_METRICS = [
  "propertyiq_score",
  "home_value",
  "rent_index",
  "for_sale_inventory",
  "days_on_market",
  "hotness_score",
  "new_listings",
  "home_sales",
] as const;
export type FetchedMetric = (typeof FETCHED_METRICS)[number];

export type MetricSource =
  | { kind: "fetched"; series: FetchedMetric }
  | { kind: "derived"; deriver: "yoy" | "yield" | "supply" };

export type ExplorerFormat =
  | "index"
  | "percent"
  | "percent_abs"
  | "days"
  | "months";

export interface ExplorerMetricConfig {
  id: ExplorerMetricId;
  label: string;
  axis: string;
  format: ExplorerFormat;
  betterHigh: boolean;
  source: MetricSource;
}

export const EXPLORER_METRICS: ExplorerMetricConfig[] = [
  {
    id: "score",
    label: getMetricTitle("propertyiq_score"),
    axis: "Momentum score (1–99)",
    format: getMetricFormat("propertyiq_score") as ExplorerFormat,
    betterHigh: true,
    source: { kind: "fetched", series: "propertyiq_score" },
  },
  {
    id: "hotness",
    label: getMetricTitle("hotness_score"),
    axis: "Hotness (0–100)",
    format: getMetricFormat("hotness_score") as ExplorerFormat,
    betterHigh: true,
    source: { kind: "fetched", series: "hotness_score" },
  },
  {
    id: "home_value_yoy",
    label: "Home Value YoY",
    axis: "ZHVI year-over-year %",
    format: "percent",
    betterHigh: true,
    source: { kind: "derived", deriver: "yoy" },
  },
  {
    id: "rent_yield",
    label: "Rent Yield",
    axis: "Gross rent yield %",
    format: "percent_abs",
    betterHigh: true,
    source: { kind: "derived", deriver: "yield" },
  },
  {
    id: "dom",
    label: getMetricTitle("days_on_market"),
    axis: "Median days on market",
    format: getMetricFormat("days_on_market") as ExplorerFormat,
    betterHigh: false,
    source: { kind: "fetched", series: "days_on_market" },
  },
  {
    id: "supply",
    label: "Months of Supply",
    axis: "Months of supply (derived: active ÷ pending)",
    format: "months",
    betterHigh: false,
    source: { kind: "derived", deriver: "supply" },
  },
];

export const RANGE_PRESETS: { months: RangePreset; label: string }[] = [
  { months: 6, label: "6M" },
  { months: 12, label: "1Y" },
  { months: 24, label: "2Y" },
  { months: 60, label: "5Y" },
  { months: 120, label: "10Y" },
];

/** US state tile grid [col,row] — ported verbatim from the prototype `this.tiles`. */
export const US_STATE_TILES: Record<string, [number, number]> = {
  AK: [0, 0],
  ME: [11, 0],
  VT: [10, 1],
  NH: [11, 1],
  WA: [1, 2],
  ID: [2, 2],
  MT: [3, 2],
  ND: [4, 2],
  MN: [5, 2],
  WI: [6, 2],
  MI: [8, 2],
  NY: [9, 2],
  MA: [10, 2],
  RI: [11, 2],
  OR: [1, 3],
  NV: [2, 3],
  WY: [3, 3],
  SD: [4, 3],
  IA: [5, 3],
  IL: [6, 3],
  IN: [7, 3],
  OH: [8, 3],
  PA: [9, 3],
  NJ: [10, 3],
  CT: [11, 3],
  CA: [1, 4],
  UT: [2, 4],
  CO: [3, 4],
  NE: [4, 4],
  MO: [5, 4],
  KY: [6, 4],
  WV: [7, 4],
  VA: [8, 4],
  MD: [9, 4],
  DE: [10, 4],
  AZ: [2, 5],
  NM: [3, 5],
  KS: [4, 5],
  AR: [5, 5],
  TN: [6, 5],
  NC: [7, 5],
  SC: [8, 5],
  DC: [9, 5],
  OK: [3, 6],
  LA: [4, 6],
  MS: [5, 6],
  AL: [6, 6],
  GA: [7, 6],
  HI: [0, 7],
  TX: [3, 7],
  FL: [8, 7],
};

/** The child level shown when scoped at `scopeLevel` (null = national). */
export function childGeoLevel(
  scopeLevel: ExplorerGeoLevel | null,
): ExplorerGeoLevel {
  if (scopeLevel === "county") return "zip";
  if (scopeLevel === "metro") return "county";
  return "metro"; // national or state → metros
}
