/**
 * RADAR CHART PROFILE PRESETS
 *
 * Defines the available radar chart presets and their dimension configurations.
 * Each preset maps a set of metric dimensions to a radar polygon:
 * - homebuyer: Affordability, growth, inventory, jobs, population, market speed
 * - investor: Cap rate, rent level, appreciation, demand/supply, population
 * - market_health: Speed, demand, hotness, price stability, pending, inventory, sales, appreciation
 *
 * Dimensions with `invert: true` flip the percentile so that lower raw values
 * produce higher radar scores (e.g., fewer days on market = faster = better).
 */

export type RadarPreset =
  | "propertyiq"
  | "homebuyer"
  | "investor"
  | "market_health"
  | "custom";

export interface RadarDimensionConfig {
  key: string;
  label: string;
  metricId: string;
  /** Override metric ID for race mode time series (when the primary metricId lacks time series data) */
  raceMetricId?: string;
  /** When true, lower raw values produce higher percentile scores */
  invert?: boolean;
  description?: string;
}

export interface RadarProfileConfig {
  id: RadarPreset;
  title: string;
  dimensions: RadarDimensionConfig[];
}

export const RADAR_PROFILES: Record<
  Exclude<RadarPreset, "custom">,
  RadarProfileConfig
> = {
  propertyiq: {
    id: "propertyiq",
    title: "PropertyIQ",
    dimensions: [
      {
        key: "sold_above",
        label: "% Sold Above List",
        metricId: "sold_above_list",
        description: "Percentage of homes sold above list price",
      },
      {
        key: "dom",
        label: "Market Speed",
        metricId: "days_on_market",
        invert: true,
        description: "Fewer days on market = faster",
      },
      {
        key: "supply",
        label: "Low Supply",
        metricId: "months_of_supply",
        invert: true,
        description: "Lower months of supply = tighter market",
      },
      {
        key: "demand",
        label: "Demand",
        metricId: "demand_score",
        description: "Realtor.com demand score",
      },
      {
        key: "appreciation",
        label: "Appreciation",
        metricId: "home_value_yoy",
        description: "Year-over-year price change",
      },
      {
        key: "population",
        label: "Pop. Growth",
        metricId: "population_growth",
        raceMetricId: "population",
        description: "Year-over-year",
      },
    ],
  },
  homebuyer: {
    id: "homebuyer",
    title: "Homebuyer Profile",
    dimensions: [
      {
        key: "affordability",
        label: "Affordability",
        metricId: "years_to_save",
        invert: true,
        description: "Fewer years to save = better",
      },
      {
        key: "appreciation",
        label: "Price Growth",
        metricId: "home_value_5yr",
        raceMetricId: "home_value_yoy",
        description: "5-year CAGR",
      },
      {
        key: "inventory",
        label: "Inventory",
        metricId: "for_sale_inventory",
        description: "Available homes",
      },
      {
        key: "jobs",
        label: "Job Growth",
        metricId: "job_growth",
        description: "Year-over-year",
      },
      {
        key: "population",
        label: "Pop. Growth",
        metricId: "population_growth",
        raceMetricId: "population",
        description: "Year-over-year",
      },
      {
        key: "dom",
        label: "Market Speed",
        metricId: "days_on_market",
        invert: true,
        description: "Fewer DOM = faster market",
      },
    ],
  },
  investor: {
    id: "investor",
    title: "Investor Profile",
    dimensions: [
      {
        key: "cap_rate",
        label: "Cap Rate",
        metricId: "cap_rate",
        description: "Net operating income / price",
      },
      {
        key: "rent_growth",
        label: "Rent Level",
        metricId: "rent_index",
        description: "Zillow Observed Rent Index",
      },
      {
        key: "appreciation",
        label: "Appreciation",
        metricId: "home_value_5yr",
        raceMetricId: "home_value_yoy",
        description: "5-year CAGR",
      },
      {
        key: "demand",
        label: "Demand",
        metricId: "demand_score",
        description: "Realtor.com demand score",
      },
      {
        key: "supply",
        label: "Low Supply",
        metricId: "supply_score",
        invert: true,
        description: "Lower supply = better for investors",
      },
      {
        key: "population",
        label: "Pop. Growth",
        metricId: "population_growth",
        raceMetricId: "population",
        description: "Year-over-year",
      },
    ],
  },
  market_health: {
    id: "market_health",
    title: "Market Health",
    dimensions: [
      {
        key: "dom",
        label: "Speed",
        metricId: "days_on_market",
        invert: true,
        description: "Fewer days on market = faster",
      },
      {
        key: "demand",
        label: "Demand",
        metricId: "demand_score",
        description: "Realtor.com demand score",
      },
      {
        key: "hotness",
        label: "Hotness",
        metricId: "hotness_score",
        description: "Realtor.com hotness rank",
      },
      {
        key: "price_cuts",
        label: "Price Stability",
        metricId: "price_cut_pct",
        invert: true,
        description: "Fewer price cuts = stable",
      },
      {
        key: "pending",
        label: "Pending Ratio",
        metricId: "pending_ratio",
        description: "Pending sales vs active listings",
      },
      {
        key: "inventory",
        label: "Inventory",
        metricId: "for_sale_inventory",
        description: "Active listings count",
      },
      {
        key: "sales",
        label: "Sales Volume",
        metricId: "home_sales",
        description: "Monthly closed transactions",
      },
      {
        key: "appreciation",
        label: "Appreciation",
        metricId: "home_value_yoy",
        description: "Year-over-year price change",
      },
    ],
  },
};

/** Ordered list of preset IDs for UI rendering (excludes 'custom') */
export const RADAR_PRESET_ORDER: Exclude<RadarPreset, "custom">[] = [
  "propertyiq",
  "homebuyer",
  "investor",
  "market_health",
];

/** Get all unique metric IDs used by a given preset (useful for prefetch / availability checks) */
export function getRadarPresetMetrics(
  preset: Exclude<RadarPreset, "custom">,
): string[] {
  return RADAR_PROFILES[preset].dimensions.map((d) => d.metricId);
}
