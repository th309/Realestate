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

export const brokerageTools = [
  {
    name: "farm_area_analysis",
    description:
      "Aggregate analysis across a defined geographic farm (multiple ZIPs). Useful for territory planning and agent coaching.",
    schema: {
      zip_codes: z
        .string()
        .describe("Comma-separated ZIP codes in the farm area"),
    },
    handler: async (args: any) => {
      const zips = args.zip_codes.split(",").map((s: string) => s.trim());
      const results = await Promise.all(
        zips.map(async (zip: string) => ({
          zip,
          ...(await getMarketData("zip", zip)),
        })),
      );
      return JSON.stringify(
        {
          farm_zips: results,
          zip_count: zips.length,
          instructions:
            "Create a farm area analysis. Aggregate: average home value, price range, average DOM, average score. Identify the strongest and weakest ZIPs. Suggest which areas to focus listing efforts and which to prospect for buyers.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "referral_network_finder",
    description:
      "Identify top-scoring markets that are logical referral targets from a given metro. Find where your clients are moving to/from.",
    schema: {
      origin_geography: z
        .enum(["metro", "county"])
        .describe("Origin geography type"),
      origin_id: z.string().describe("Origin market ID"),
      limit: z.number().optional().describe("Number of targets (default 10)"),
    },
    handler: async (args: any) => {
      const [originData, topMarkets] = await Promise.all([
        getMarketData(args.origin_geography, args.origin_id),
        fetchApi("/api/scores/top", {
          geography: "metro",
          score_type: "propertyiq",
          limit: args.limit || 15,
        }).catch(() => []),
      ]);
      return JSON.stringify(
        {
          origin_market: originData,
          top_markets: topMarkets,
          instructions:
            "Identify referral network opportunities. Find markets that pair well with the origin: similar price range but different state (relocation corridors), nearby metros (regional moves), or markets with opposite seasonality. For each, suggest a data point to lead with when reaching out to an agent there.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "agent_recruitment_pitch",
    description:
      "Data-driven pitch for recruiting agents in a specific market. Shows why your tools give an edge.",
    schema: {
      geography: z.enum(["metro", "county"]).describe("Geography level"),
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
            "Write an agent recruitment pitch. Lead with a surprising market insight that demonstrates data advantage. Show how PropertyIQ tools help agents win listings and serve buyers better. Include specific metrics from this market as proof points. Keep under 200 words.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "brokerage_market_coverage_report",
    description:
      "Executive brief summarizing market health across all markets a brokerage operates in.",
    schema: {
      geography: z.enum(["metro", "county"]).describe("Geography level"),
      geo_ids: z
        .string()
        .describe("Comma-separated geography IDs for all brokerage markets"),
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
          markets: results,
          market_count: ids.length,
          instructions:
            "Create an executive market coverage report. For each market: name, PropertyIQ score, score trend, and 1-line status (e.g. 'Strong and rising', 'Cooling but stable'). Add a summary: strongest market, weakest market, biggest mover, and overall portfolio health assessment.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "market_opportunity_alert",
    description:
      "Surface emerging markets in a state before competitors identify them. Useful for expansion planning.",
    schema: {
      state: z.string().describe("2-letter state code"),
      geography: z
        .enum(["metro", "county"])
        .optional()
        .describe("Geography level (default metro)"),
    },
    handler: async (args: any) => {
      const geo = args.geography || "metro";
      const [topMarkets, allScores] = await Promise.all([
        fetchApi("/api/scores/top", {
          geography: geo,
          score_type: "propertyiq",
          limit: 20,
          state: args.state,
        }).catch(() => []),
        fetchApi("/api/scores/top", {
          geography: geo,
          score_type: "propertyiq",
          limit: 50,
          sort: "desc",
          state: args.state,
        }).catch(() => []),
      ]);
      return JSON.stringify(
        {
          top_markets: topMarkets,
          all_rankings: allScores,
          state: args.state,
          instructions:
            "Identify emerging market opportunities. Look for: markets with high scores but low population (under-the-radar), markets with rising scores (momentum), and markets adjacent to hot metros (spillover effect). Present as an 'opportunities to watch' brief for leadership.",
        },
        null,
        2,
      );
    },
  },
];
