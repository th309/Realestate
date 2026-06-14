import type { ToolCategory } from "./mcp-docs-data";

export const CORE_TOOLS: ToolCategory = {
  id: "core",
  name: "Core Market Analysis",
  emoji: "\u{1F4CA}",
  description:
    "Search markets, get scores, snapshots, home values, and rankings",
  toolCount: 12,
  tools: [
    {
      name: "search_markets",
      description:
        "The starting point for everything. Converts a market name, ZIP code, or city into geography IDs that all other tools use. Your AI calls this automatically — you just say the name.",
      parameters: [
        {
          name: "query",
          type: "string",
          required: true,
          description:
            'Any market name, ZIP, or city (e.g., "Austin", "90210", "Cook County")',
        },
        {
          name: "geography_type",
          type: "string",
          required: false,
          description: "Filter: metro, county, zip, or city",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Max results",
          default: "10",
        },
      ],
    },
    {
      name: "get_propertyiq_score",
      description:
        "Get the PropertyIQ score (0-100), grade, confidence, and 3-month trend. 50 = state average.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "location_id",
          type: "string",
          required: true,
          description: "Auto-resolved from market name via search_markets",
        },
        {
          name: "history_months",
          type: "number",
          required: false,
          description: "Months of trend history",
          default: "3",
        },
      ],
    },
    {
      name: "get_top_markets",
      description:
        "Get highest-ranked markets by PropertyIQ score with optional state filtering.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Number of results",
          default: "10",
        },
        {
          name: "state",
          type: "string",
          required: false,
          description: "2-letter state code filter",
        },
      ],
    },
    {
      name: "get_market_snapshot",
      description:
        "Get ALL available metrics for a single market: home values, rents, economic, census, and scores.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "state, metro, county, or zip",
        },
        {
          name: "geo_id",
          type: "string",
          required: true,
          description: "Auto-resolved from market name",
        },
      ],
    },
    {
      name: "get_home_values",
      description:
        "Get median home values (Zillow ZHVI) for all markets at a geography level.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "national, state, metro, county, zip, or city",
        },
        {
          name: "state",
          type: "string",
          required: false,
          description: "Required for zip/city level",
        },
      ],
    },
    {
      name: "get_rent_data",
      description:
        "Get rent index data (Zillow ZORI) showing median rents for cap rate and yield analysis.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "state",
          type: "string",
          required: false,
          description: "Required for zip level",
        },
      ],
    },
    {
      name: "get_home_value_forecast",
      description:
        "Get Zillow home value forecasts at 3-month and 12-month horizons.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro or zip",
        },
        {
          name: "state",
          type: "string",
          required: false,
          description: "Required for zip level",
        },
      ],
    },
    {
      name: "get_economic_indicators",
      description:
        "Get economic data: unemployment rate, job growth, GDP growth.",
      parameters: [
        {
          name: "metric",
          type: "string",
          required: true,
          description: "unemployment, job-growth, or gdp-growth",
        },
        {
          name: "geography",
          type: "string",
          required: true,
          description: "national, state, metro, or county",
        },
      ],
    },
    {
      name: "get_census_demographics",
      description:
        "Get Census data: population, income, age, homeownership rate.",
      parameters: [
        {
          name: "metric",
          type: "string",
          required: true,
          description:
            "population, population-growth, median-income, income-growth, median-age, or homeownership-rate",
        },
        {
          name: "geography",
          type: "string",
          required: true,
          description: "national, state, metro, county, or zip",
        },
        {
          name: "state",
          type: "string",
          required: false,
          description: "Filter by state",
        },
      ],
    },
    {
      name: "get_market_timeseries",
      description:
        "Get historical time-series data for any metric and region for trend analysis.",
      parameters: [
        {
          name: "metric",
          type: "string",
          required: true,
          description: "e.g., home_value, rent_index, unemployment_rate",
        },
        {
          name: "geography",
          type: "string",
          required: true,
          description: "state, metro, county, or zip",
        },
        {
          name: "region_id",
          type: "string",
          required: true,
          description: "Auto-resolved from market name",
        },
      ],
    },
    {
      name: "compare_market_benchmarks",
      description:
        "Compare a market's metrics against its parent geography (e.g., county vs state).",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "geo_id",
          type: "string",
          required: true,
          description: "Auto-resolved from market name",
        },
        {
          name: "metrics",
          type: "string",
          required: true,
          description: "Comma-separated metric list",
        },
      ],
    },
    {
      name: "get_market_rankings",
      description:
        "Get ranked market lists by PropertyIQ score. desc = best first, asc = worst first.",
      parameters: [
        {
          name: "geography",
          type: "string",
          required: true,
          description: "metro, county, or zip",
        },
        {
          name: "limit",
          type: "number",
          required: false,
          description: "Number of results",
          default: "25",
        },
        {
          name: "order",
          type: "string",
          required: false,
          description: "asc or desc",
          default: "desc",
        },
        {
          name: "state",
          type: "string",
          required: false,
          description: "Filter by state",
        },
      ],
    },
  ],
};
