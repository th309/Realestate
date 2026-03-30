import { z } from "zod";
import { fetchApi } from "../lib/api-client";

async function getMarketData(geography: string, geoId: string) {
  const [snapshot, score] = await Promise.all([
    fetchApi(`/api/market-snapshot/${geography}/${geoId}`).catch(() => null),
    fetchApi(`/api/scores/${geography}/${geoId}`, { historyMonths: 3 }).catch(
      () => null,
    ),
  ]);
  return { snapshot, score };
}

export const propertyManagerTools = [
  {
    name: "rent_pricing_analysis",
    description:
      "Current rent index, trends, and suggested pricing context for a unit going to market.",
    schema: {
      zip: z.string().describe("ZIP code"),
      state: z.string().describe("2-letter state code"),
    },
    handler: async (args: any) => {
      const [snapshot, rents, timeseries] = await Promise.all([
        fetchApi(`/api/market-snapshot/zip/${args.zip}`).catch(() => null),
        fetchApi("/api/zillow/rent/zips", { state: args.state }).catch(
          () => null,
        ),
        fetchApi(`/api/timeseries/rent_index/zip/${args.zip}`).catch(
          () => null,
        ),
      ]);
      return JSON.stringify(
        {
          zip_snapshot: snapshot,
          area_rents: rents,
          rent_history: timeseries,
          instructions:
            "Analyze rent pricing for this ZIP. Show: current median rent, rent trend (rising/falling/flat), how this ZIP compares to surrounding ZIPs, and a suggested pricing range (5th to 95th percentile of area rents). Note seasonal patterns if visible in history.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "owner_monthly_report_narrative",
    description:
      "Ghostwritten market update paragraph a PM can paste into monthly owner statements.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
    },
    handler: async (args: any) => {
      const { snapshot, score } = await getMarketData(
        args.geography,
        args.geo_id,
      );
      return JSON.stringify(
        {
          market_data: snapshot,
          score_data: score,
          instructions:
            "Write a 2-3 paragraph market update for a property owner's monthly statement. Professional, reassuring tone. Cover: rent trends, vacancy conditions, home value changes, and market outlook. End with 'Please don't hesitate to reach out with questions.' Keep under 200 words.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "vacancy_risk_score",
    description:
      "Demand-side signal for how hard it will be to fill a vacancy: DOM trends, population flow, rent absorption.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
    },
    handler: async (args: any) => {
      const [snapshot, score, demographics] = await Promise.all([
        fetchApi(`/api/market-snapshot/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(`/api/scores/${args.geography}/${args.geo_id}`, {
          historyMonths: 3,
        }).catch(() => null),
        fetchApi(
          `/api/census/population-growth/${args.geography === "zip" ? "zips" : "metros"}`,
        ).catch(() => null),
      ]);
      return JSON.stringify(
        {
          market_data: snapshot,
          score_data: score,
          population_data: demographics,
          instructions:
            "Assess vacancy risk. Consider: rental demand (DOM for rentals), population growth (positive = more demand), rent trend (rising = healthy demand), and inventory levels. Rate as Low/Medium/High risk with 2-3 sentence explanation. Suggest pricing strategy if risk is elevated.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "portfolio_market_health",
    description:
      "Single dashboard view across all markets in a PM's portfolio, flagging any that are deteriorating.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_ids: z
        .string()
        .describe("Comma-separated geography IDs in portfolio"),
    },
    handler: async (args: any) => {
      const ids = args.geo_ids.split(",").map((s: string) => s.trim());
      const results = await Promise.all(
        ids.map(async (id: string) => ({
          geo_id: id,
          ...(await getMarketData(args.geography, id)),
        })),
      );
      return JSON.stringify(
        {
          portfolio_markets: results,
          market_count: ids.length,
          instructions:
            "Create a portfolio health dashboard. For each market: name, rent trend, vacancy risk (inferred from DOM + inventory), PropertyIQ score, and status flag (Green/Yellow/Red). Highlight any markets needing attention. Add portfolio-level summary: average score, markets improving, markets declining.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "rent_vs_own_analysis",
    description:
      "Compare renting vs buying costs in a market. Useful for retaining tenants considering purchasing.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
    },
    handler: async (args: any) => {
      const [snapshot, affordability] = await Promise.all([
        fetchApi(`/api/market-snapshot/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(
          `/api/metrics/income-to-buy/${args.geography === "zip" ? "zips" : "metros"}`,
        ).catch(() => null),
      ]);
      return JSON.stringify(
        {
          market_data: snapshot,
          affordability_data: affordability,
          instructions:
            "Compare rent vs own costs. Calculate: monthly rent vs estimated mortgage (at 7% rate, 20% down), total monthly ownership cost (mortgage + tax + insurance + maintenance), and the premium/discount of owning vs renting. Include down payment requirement and income needed to qualify. Frame for a tenant audience — honest but retention-minded.",
        },
        null,
        2,
      );
    },
  },
];
