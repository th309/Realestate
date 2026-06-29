/**
 * comparisonSections — the SINGLE source of truth for what a market comparison
 * compares. Each section mirrors a section of the single-market report, but as
 * a side-by-side table (markets across, metrics down). The same metric IDs,
 * labels and formats the single-market sections use are reused here verbatim, so
 * the comparison reads like the real report — just comparative.
 *
 * `direction` drives winner highlighting:
 *   higher  → the largest value wins (e.g. job growth, appreciation)
 *   lower   → the smallest value wins (e.g. days on market, price cuts)
 *   neutral → an absolute LEVEL where "better" depends on the reader's goal
 *             (home price, rent, income, inventory) — shown, never crowned.
 *
 * Winner logic lives next to the config so a new row gets correct highlighting
 * for free. Values are read from each market's own `current` block (assembled by
 * the same backend path the primary uses), with alias fallback per row.
 */

import { Activity, Briefcase, Gauge, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MetricFormat } from "@/lib/data";
import { type MarketBundle, metricNum } from "./marketBundles";

export type WinDirection = "higher" | "lower" | "neutral";

export interface ComparisonRow {
  /** Primary metric key in `current`. */
  metricId: string;
  /** Alternate keys to try if the primary is absent. */
  aliases?: string[];
  /** Human label — matches the single-market report's wording. */
  label: string;
  /** Display format, fed straight to `formatMetricValue`. */
  format: MetricFormat;
  /** Which direction wins for highlighting. */
  direction: WinDirection;
}

export interface ComparisonSectionDef {
  id: string;
  title: string;
  icon: LucideIcon;
  /** Optional one-liner under the title. */
  blurb?: string;
  rows: ComparisonRow[];
}

/**
 * The four PropertyIQ score drivers, side by side — answers "why is one market's
 * score higher?" These are the raw inputs to the demand-momentum formula:
 * +z(home value 12-mo) +z(3-mo momentum) −z(days on market) −z(price cuts).
 */
export const SCORE_DRIVER_SECTION: ComparisonSectionDef = {
  id: "score-drivers",
  title: "What's driving the scores",
  icon: Activity,
  blurb:
    "The four demand signals behind each PropertyIQ score — rising values and fast sales push a score up; long days on market and frequent price cuts pull it down.",
  rows: [
    {
      metricId: "home_value_yoy",
      aliases: ["zhvi_yoy"],
      label: "Home Value Momentum, 12-mo (Zillow)",
      format: "percent",
      direction: "higher",
    },
    {
      metricId: "zhvi_mom_3m",
      aliases: ["home_value_mom_3m", "zhvi_3m_momentum"],
      label: "Home Value Momentum, 3-mo (Zillow)",
      format: "percent",
      direction: "higher",
    },
    {
      metricId: "days_on_market",
      aliases: ["median_days_on_market", "median_dom", "dom"],
      label: "Days on Market (Realtor)",
      format: "days",
      direction: "lower",
    },
    {
      metricId: "price_reduced_share",
      aliases: ["price_cut_pct", "price_reduced_pct", "pct_price_reduced"],
      label: "Listings with Price Cuts (Realtor)",
      format: "percent_abs",
      direction: "lower",
    },
  ],
};

/** Report-mirroring comparison sections, in reading order. */
export const COMPARISON_SECTIONS: ComparisonSectionDef[] = [
  {
    id: "price-value",
    title: "Price & Value",
    icon: TrendingUp,
    rows: [
      {
        metricId: "zhvi",
        aliases: ["home_value", "median_listing_price"],
        label: "Typical Home Value (Zillow)",
        format: "currency",
        direction: "neutral",
      },
      {
        metricId: "home_value_yoy",
        aliases: ["zhvi_yoy", "median_listing_price_yoy"],
        label: "Home Value Change, YoY (Zillow)",
        format: "percent",
        direction: "higher",
      },
      {
        metricId: "price_per_sqft",
        aliases: ["median_ppsf", "ppsf", "price_sqft"],
        label: "Price / Sq Ft (Realtor)",
        format: "currency",
        direction: "neutral",
      },
      {
        metricId: "median_rent",
        aliases: ["zori", "rent_index", "median_gross_rent"],
        label: "Typical Rent (Zillow)",
        format: "currency",
        direction: "neutral",
      },
      {
        metricId: "rent_yoy",
        aliases: ["zori_yoy", "rent_growth_yoy"],
        label: "Rent Change, YoY (Zillow)",
        format: "percent",
        direction: "higher",
      },
    ],
  },
  {
    id: "market-conditions",
    title: "Market Conditions",
    icon: Gauge,
    blurb: "How fast homes sell and how much leverage buyers have.",
    rows: [
      {
        metricId: "days_on_market",
        aliases: ["median_days_on_market", "median_dom", "dom"],
        label: "Days on Market (Realtor)",
        format: "days",
        direction: "lower",
      },
      {
        metricId: "for_sale_inventory",
        aliases: ["active_listing_count", "inventory", "active_listings"],
        label: "Active Listings (Realtor)",
        format: "number",
        direction: "neutral",
      },
      {
        metricId: "pending_ratio",
        aliases: ["pending_to_active_ratio", "pending_listing_ratio"],
        label: "Pending-to-Active Ratio (Realtor)",
        format: "percent_abs",
        direction: "higher",
      },
      {
        metricId: "hotness_score",
        aliases: ["market_hotness", "heat_index", "market_heat"],
        label: "Market Hotness (Realtor)",
        format: "index",
        direction: "higher",
      },
      {
        metricId: "price_reduced_share",
        aliases: ["price_cut_pct", "price_reduced_pct", "pct_price_reduced"],
        label: "Listings with Price Cuts (Realtor)",
        format: "percent_abs",
        direction: "lower",
      },
    ],
  },
  {
    id: "economy",
    title: "Economy & Affordability",
    icon: Briefcase,
    rows: [
      {
        metricId: "median_household_income",
        aliases: ["median_income"],
        label: "Median Household Income (Census)",
        format: "currency",
        direction: "neutral",
      },
      {
        metricId: "unemployment_rate",
        aliases: ["unemployment"],
        label: "Unemployment Rate (BLS)",
        format: "percent_abs",
        direction: "lower",
      },
      {
        metricId: "job_growth_yoy",
        aliases: ["job_growth"],
        label: "Job Growth, YoY (BLS)",
        format: "percent",
        direction: "higher",
      },
      {
        metricId: "population_growth_yoy",
        aliases: ["population_growth", "population_yoy"],
        label: "Population Growth, YoY (Census)",
        format: "percent",
        direction: "higher",
      },
      {
        metricId: "income_growth_yoy",
        aliases: ["income_growth"],
        label: "Income Growth, YoY (Census)",
        format: "percent",
        direction: "higher",
      },
    ],
  },
];

/** Read a row's value for one market: primary id, then aliases. */
export function rowValue(
  bundle: MarketBundle,
  row: ComparisonRow,
): number | null {
  for (const key of [row.metricId, ...(row.aliases ?? [])]) {
    const n = metricNum(bundle.current, key);
    if (n !== null) return n;
  }
  return null;
}

/**
 * Indices of the winning market(s) for a row. Empty when:
 *  - direction is neutral (a level, not a contest),
 *  - fewer than two markets have a value (nothing to compare),
 *  - every present value ties (no standout to crown).
 */
export function winningIndices(
  values: (number | null)[],
  direction: WinDirection,
): number[] {
  if (direction === "neutral") return [];
  const present = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null);
  if (present.length < 2) return [];

  const best =
    direction === "higher"
      ? Math.max(...present.map((x) => x.v))
      : Math.min(...present.map((x) => x.v));
  const winners = present.filter((x) => x.v === best);
  if (winners.length === present.length) return []; // all tied → no winner
  return winners.map((x) => x.i);
}
