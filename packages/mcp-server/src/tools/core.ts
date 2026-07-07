import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const coreTools = [
  {
    name: "search_markets",
    description:
      "Search for US real estate markets by name. Returns geography IDs needed for all other tools.",
    schema: {
      query: z
        .string()
        .describe("Market name (e.g. 'Austin', 'Cook County', '90210')"),
      geography_type: z
        .enum(["metro", "county", "zip", "city"])
        .optional()
        .describe("Filter by type"),
      limit: z.number().optional().describe("Max results (default 10)"),
    },
    handler: async (args: any) => {
      const data = await fetchApi("/api/geography/search", {
        query: args.query,
        type: args.geography_type,
        limit: args.limit || 10,
      });
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "get_propertyiq_score",
    description:
      "Get PropertyIQ score (0-100), grade, confidence, and 3-month trend for a market. 50 = state average.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      location_id: z.string().describe("Geography ID (CBSA, FIPS, or ZIP)"),
      history_months: z
        .number()
        .optional()
        .describe("Months of trend history (default 3)"),
    },
    handler: async (args: any) => {
      const data = await fetchApi(
        `/api/scores/${args.geography}/${args.location_id}`,
        { historyMonths: args.history_months ?? 3 },
      );
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "get_top_markets",
    description:
      "Get highest-ranked markets by PropertyIQ score. Optionally filter by state.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      limit: z.number().optional().describe("Number of results (default 10)"),
      state: z.string().optional().describe("2-letter state code (e.g. 'TX')"),
    },
    handler: async (args: any) => {
      const data = await fetchApi("/api/scores/top", {
        geography: args.geography,
        score_type: "propertyiq",
        limit: args.limit || 10,
        state: args.state,
      });
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "get_market_snapshot",
    description:
      "Get ALL metrics for a single market: home values, rents, economic, census, scores. Most efficient for full analysis.",
    schema: {
      geography: z
        .enum(["state", "metro", "county", "zip"])
        .describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
    },
    handler: async (args: any) => {
      const data = await fetchApi(
        `/api/market-snapshot/${args.geography}/${args.geo_id}`,
      );
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "get_home_values",
    description:
      "Get median home values (Zillow ZHVI) for all markets at a geography level.",
    schema: {
      geography: z
        .enum(["national", "state", "metro", "county", "zip", "city"])
        .describe("Geography level"),
      state: z
        .string()
        .optional()
        .describe("Required for zip/city. 2-letter code."),
    },
    handler: async (args: any) => {
      const geoMap: Record<string, string> = {
        national: "national",
        state: "states",
        metro: "metros",
        county: "counties",
        zip: "zips",
        city: "cities",
      };
      const data = await fetchApi(`/api/zillow/${geoMap[args.geography]}`, {
        state: args.state,
      });
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "get_rent_data",
    description:
      "Get rent index data (Zillow ZORI) showing median rents. Essential for cap rate and yield analysis.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      state: z.string().optional().describe("Required for zip level"),
    },
    handler: async (args: any) => {
      const geoMap: Record<string, string> = {
        metro: "metros",
        county: "counties",
        zip: "zips",
      };
      const data = await fetchApi(
        `/api/zillow/rent/${geoMap[args.geography]}`,
        { state: args.state },
      );
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "get_home_value_forecast",
    description:
      "Get Zillow home value forecasts at 3-month and 12-month horizons.",
    schema: {
      geography: z.enum(["metro", "zip"]).describe("Geography level"),
      state: z.string().optional().describe("Required for zip level"),
    },
    handler: async (args: any) => {
      const geoMap: Record<string, string> = { metro: "metros", zip: "zips" };
      const data = await fetchApi(
        `/api/zillow/forecast/${geoMap[args.geography]}`,
        { state: args.state },
      );
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "get_economic_indicators",
    description: "Get economic data: unemployment, job growth, GDP growth.",
    schema: {
      metric: z
        .enum(["unemployment", "job-growth", "gdp-growth"])
        .describe("Economic metric"),
      geography: z
        .enum(["national", "state", "metro", "county"])
        .describe("Geography level"),
    },
    handler: async (args: any) => {
      const geoMap: Record<string, string> = {
        national: "national",
        state: "states",
        metro: "metros",
        county: "counties",
      };
      const data = await fetchApi(
        `/api/economic/${args.metric}/${geoMap[args.geography]}`,
      );
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "get_census_demographics",
    description:
      "Get Census data: population, income, age, homeownership rate.",
    schema: {
      metric: z
        .enum([
          "population",
          "population-growth",
          "median-income",
          "income-growth",
          "median-age",
          "homeownership-rate",
        ])
        .describe("Demographic metric"),
      geography: z
        .enum(["national", "state", "metro", "county", "zip"])
        .describe("Geography level"),
      state: z.string().optional().describe("2-letter state filter"),
    },
    handler: async (args: any) => {
      const geoMap: Record<string, string> = {
        national: "national",
        state: "states",
        metro: "metros",
        county: "counties",
        zip: "zips",
      };
      const data = await fetchApi(
        `/api/census/${args.metric}/${geoMap[args.geography]}`,
        { state: args.state },
      );
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "get_market_timeseries",
    description:
      "Get historical time-series data for any metric and region. For trend analysis.",
    schema: {
      metric: z
        .string()
        .describe(
          "Metric ID (e.g. home_value, rent_index, unemployment_rate; Redfin Data Center: sold_above_list_share, listings_delisted_share, pending_cancellation_share, investor_market_share, all_cash_share)",
        ),
      geography: z
        .enum(["state", "metro", "county", "zip"])
        .describe("Geography level"),
      region_id: z.string().describe("Region identifier"),
    },
    handler: async (args: any) => {
      const data = await fetchApi(
        `/api/timeseries/${args.metric}/${args.geography}/${args.region_id}`,
      );
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "compare_market_benchmarks",
    description:
      "Compare a market's metrics against parent geography (e.g. county vs state, metro vs national).",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
      metrics: z
        .string()
        .describe("Comma-separated metrics (e.g. 'cap_rate,gross_yield')"),
    },
    handler: async (args: any) => {
      const data = await fetchApi(
        `/api/benchmarks/${args.geography}/${args.geo_id}`,
        { metrics: args.metrics },
      );
      return JSON.stringify(data, null, 2);
    },
  },
  {
    name: "get_market_rankings",
    description:
      "Get ranked market lists by PropertyIQ score. desc = best first, asc = worst first.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      limit: z.number().optional().describe("Number of results (default 25)"),
      order: z
        .enum(["asc", "desc"])
        .optional()
        .describe("Sort order (default desc)"),
      state: z.string().optional().describe("2-letter state filter"),
    },
    handler: async (args: any) => {
      // Public /api/scores/top already supports worst-first via sort=asc; the
      // key-gated /api/v1/rankings surface rejects the MCP's session auth (401).
      const data = await fetchApi("/api/scores/top", {
        geography: args.geography,
        score_type: "propertyiq",
        limit: args.limit || 25,
        sort: args.order || "desc",
        state: args.state,
      });
      return JSON.stringify(data, null, 2);
    },
  },
];
