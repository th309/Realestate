import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchApi } from "./lib/api-client";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "propertyiq",
    version: "0.1.0",
  });

  // Helper to wrap tool handlers with error handling
  function handle(fn: (args: any) => Promise<string>) {
    return async (args: any) => {
      try {
        const text = await fn(args);
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${msg}` }],
          isError: true,
        };
      }
    };
  }

  // 1. Search markets
  server.tool(
    "search_markets",
    "Search for US real estate markets by name. Returns geography IDs needed for all other tools.",
    {
      query: z
        .string()
        .describe("Market name (e.g. 'Austin', 'Cook County', '90210')"),
      geography_type: z
        .enum(["metro", "county", "zip", "city"])
        .optional()
        .describe("Filter by type"),
      limit: z.number().optional().describe("Max results (default 10)"),
    },
    handle(async (args) => {
      const data = await fetchApi("/api/geography/search", {
        query: args.query,
        type: args.geography_type,
        limit: args.limit || 10,
      });
      return JSON.stringify(data, null, 2);
    }),
  );

  // 2. PropertyIQ score
  server.tool(
    "get_propertyiq_score",
    "Get PropertyIQ score (0-100), grade, confidence, and 3-month trend for a market. 50 = state average.",
    {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      location_id: z.string().describe("Geography ID (CBSA, FIPS, or ZIP)"),
      history_months: z
        .number()
        .optional()
        .describe("Months of trend history (default 3)"),
    },
    handle(async (args) => {
      const data = await fetchApi(
        `/api/scores/${args.geography}/${args.location_id}`,
        {
          historyMonths: args.history_months ?? 3,
        },
      );
      return JSON.stringify(data, null, 2);
    }),
  );

  // 3. Top markets
  server.tool(
    "get_top_markets",
    "Get highest-ranked markets by PropertyIQ score. Optionally filter by state.",
    {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      limit: z.number().optional().describe("Number of results (default 10)"),
      state: z.string().optional().describe("2-letter state code (e.g. 'TX')"),
    },
    handle(async (args) => {
      const data = await fetchApi("/api/scores/top", {
        geography: args.geography,
        score_type: "propertyiq",
        limit: args.limit || 10,
        state: args.state,
      });
      return JSON.stringify(data, null, 2);
    }),
  );

  // 4. Market snapshot
  server.tool(
    "get_market_snapshot",
    "Get ALL metrics for a single market: home values, rents, economic, census, scores. Most efficient for full analysis.",
    {
      geography: z
        .enum(["state", "metro", "county", "zip"])
        .describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
    },
    handle(async (args) => {
      const data = await fetchApi(
        `/api/market-snapshot/${args.geography}/${args.geo_id}`,
      );
      return JSON.stringify(data, null, 2);
    }),
  );

  // 5. Home values
  server.tool(
    "get_home_values",
    "Get median home values (Zillow ZHVI) for all markets at a geography level.",
    {
      geography: z
        .enum(["national", "state", "metro", "county", "zip", "city"])
        .describe("Geography level"),
      state: z
        .string()
        .optional()
        .describe("Required for zip/city. 2-letter code."),
    },
    handle(async (args) => {
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
    }),
  );

  // 6. Rent data
  server.tool(
    "get_rent_data",
    "Get rent index data (Zillow ZORI) showing median rents. Essential for cap rate and yield analysis.",
    {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      state: z.string().optional().describe("Required for zip level"),
    },
    handle(async (args) => {
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
    }),
  );

  // 7. Forecast
  server.tool(
    "get_home_value_forecast",
    "Get Zillow home value forecasts at 3-month and 12-month horizons.",
    {
      geography: z.enum(["metro", "zip"]).describe("Geography level"),
      state: z.string().optional().describe("Required for zip level"),
    },
    handle(async (args) => {
      const geoMap: Record<string, string> = { metro: "metros", zip: "zips" };
      const data = await fetchApi(
        `/api/zillow/forecast/${geoMap[args.geography]}`,
        { state: args.state },
      );
      return JSON.stringify(data, null, 2);
    }),
  );

  // 8. Economic indicators
  server.tool(
    "get_economic_indicators",
    "Get economic data: unemployment, job growth, GDP growth.",
    {
      metric: z
        .enum(["unemployment", "job-growth", "gdp-growth"])
        .describe("Economic metric"),
      geography: z
        .enum(["national", "state", "metro", "county"])
        .describe("Geography level"),
    },
    handle(async (args) => {
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
    }),
  );

  // 9. Census demographics
  server.tool(
    "get_census_demographics",
    "Get Census data: population, income, age, homeownership rate.",
    {
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
    handle(async (args) => {
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
    }),
  );

  // 10. Time series
  server.tool(
    "get_market_timeseries",
    "Get historical time-series data for any metric and region. For trend analysis.",
    {
      metric: z
        .string()
        .describe("Metric ID (e.g. home_value, rent_index, unemployment_rate)"),
      geography: z
        .enum(["state", "metro", "county", "zip"])
        .describe("Geography level"),
      region_id: z.string().describe("Region identifier"),
    },
    handle(async (args) => {
      const data = await fetchApi(
        `/api/timeseries/${args.metric}/${args.geography}/${args.region_id}`,
      );
      return JSON.stringify(data, null, 2);
    }),
  );

  // 11. Benchmarks
  server.tool(
    "compare_market_benchmarks",
    "Compare a market's metrics against parent geography (e.g. county vs state, metro vs national).",
    {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
      metrics: z
        .string()
        .describe("Comma-separated metrics (e.g. 'cap_rate,gross_yield')"),
    },
    handle(async (args) => {
      const data = await fetchApi(
        `/api/benchmarks/${args.geography}/${args.geo_id}`,
        { metrics: args.metrics },
      );
      return JSON.stringify(data, null, 2);
    }),
  );

  // 12. Rankings
  server.tool(
    "get_market_rankings",
    "Get ranked market lists by PropertyIQ score. desc = best first, asc = worst first.",
    {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      limit: z.number().optional().describe("Number of results (default 25)"),
      order: z
        .enum(["asc", "desc"])
        .optional()
        .describe("Sort order (default desc)"),
      state: z.string().optional().describe("2-letter state filter"),
    },
    handle(async (args) => {
      const data = await fetchApi(
        `/api/v1/rankings/propertyiq/${args.geography}`,
        {
          limit: args.limit || 25,
          order: args.order || "desc",
          state: args.state,
        },
      );
      return JSON.stringify(data, null, 2);
    }),
  );

  return server;
}
