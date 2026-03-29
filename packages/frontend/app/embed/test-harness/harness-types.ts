/** Shared types and constants for the embed test harness */

export interface WidgetConfig {
  id: string;
  label: string;
  category: WidgetCategory;
  src: (token: string) => string;
  height: number;
}

export type WidgetCategory = "score" | "metric" | "map" | "chart" | "report";

export type WidgetStatus = "loading" | "loaded" | "error";

/** Timeout before marking a widget iframe as failed (ms) */
export const LOAD_TIMEOUT_MS = 15_000;

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  score: "Score Widgets",
  metric: "Metric Cards",
  map: "Interactive Map",
  chart: "Charts",
  report: "Report Embed",
};

export const CATEGORY_ORDER: WidgetCategory[] = [
  "score",
  "metric",
  "map",
  "chart",
  "report",
];

/**
 * All embed widgets to render in the test harness.
 * Uses hardcoded geography IDs: metro=31080 (Dallas), county=48201 (Harris).
 */
export const WIDGETS: WidgetConfig[] = [
  // Score widgets
  {
    id: "score-propertyiq-metro",
    label: "PropertyIQ — Metro 31080 (Dallas)",
    category: "score",
    src: (t) => `/embed/score/metro/31080?scoreType=propertyiq&token=${t}`,
    height: 280,
  },
  {
    id: "score-propertyiq-county",
    label: "PropertyIQ — County 48201 (Harris)",
    category: "score",
    src: (t) => `/embed/score/county/48201?scoreType=propertyiq&token=${t}`,
    height: 280,
  },

  // Metric card widgets
  {
    id: "metric-home-value",
    label: "Home Value — Metro 31080 (Dallas)",
    category: "metric",
    src: (t) => `/embed/metric-card/home_value/metro/31080?token=${t}`,
    height: 180,
  },
  {
    id: "metric-rent-index",
    label: "Rent Index — Metro 31080 (Dallas)",
    category: "metric",
    src: (t) => `/embed/metric-card/rent_index/metro/31080?token=${t}`,
    height: 180,
  },
  {
    id: "metric-days-market",
    label: "Days on Market — Metro 31080 (Dallas)",
    category: "metric",
    src: (t) => `/embed/metric-card/days_on_market/metro/31080?token=${t}`,
    height: 180,
  },

  // Interactive map
  {
    id: "map-full",
    label: "Interactive Map — home_value, state level",
    category: "map",
    src: (t) =>
      `/embed/map-full?search=1&legend=1&geo_pills=1&metric_picker=1&metric=home_value&geo=state&token=${t}`,
    height: 600,
  },

  // Chart widgets
  {
    id: "chart-home-value-3y",
    label: "Home Value 3Y — Dallas vs Houston",
    category: "chart",
    src: (t) =>
      `/embed/chart?metric=home_value&geo=metro&ids=31080,26420&range=3y&chart_type=line&show_national=1&token=${t}`,
    height: 400,
  },
  {
    id: "chart-rent-index-5y",
    label: "Rent Index 5Y — Dallas, Houston, Austin",
    category: "chart",
    src: (t) =>
      `/embed/chart?metric=rent_index&geo=metro&ids=31080,26420,12420&range=5y&chart_type=line&show_national=1&token=${t}`,
    height: 400,
  },
];
