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

export const contentSeoTools = [
  {
    name: "generate_reddit_post",
    description:
      "Assemble live market data for a Reddit post. Returns structured data (score, metrics, trends) with subreddit context. The calling LLM writes the actual post.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
      subreddit: z
        .string()
        .optional()
        .describe(
          "Target subreddit (e.g. 'realestateinvesting', 'FirstTimeHomeBuyer')",
        ),
      angle: z
        .enum(["bullish", "bearish", "neutral", "data_dump", "question"])
        .optional()
        .describe("Post tone/angle"),
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
          subreddit: args.subreddit || "realestateinvesting",
          angle: args.angle || "neutral",
          instructions:
            "Use this data to write a Reddit post. Match the subreddit's tone. Lead with a specific data point, not opinions.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "generate_linkedin_post",
    description:
      "Assemble market data for a LinkedIn post. Returns data with format guidance (single insight, carousel outline, or building-in-public).",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
      format: z
        .enum(["single_insight", "carousel", "building_in_public"])
        .optional()
        .describe("Post format"),
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
          format: args.format || "single_insight",
          instructions:
            "Write a LinkedIn post using this data. Professional but not dry. Include a specific metric as the hook.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "generate_seo_page_brief",
    description:
      "Generate SEO page structure for a market page: title tag, meta description, H1/H2 outline, target keywords. Uses live data for specificity.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
    },
    handler: async (args: any) => {
      const [snapshot, score, demographics] = await Promise.all([
        fetchApi(`/api/market-snapshot/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(`/api/scores/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(
          `/api/census/population/${args.geography === "zip" ? "zips" : args.geography === "county" ? "counties" : "metros"}`,
        ).catch(() => null),
      ]);
      return JSON.stringify(
        {
          market_data: snapshot,
          score_data: score,
          demographics,
          instructions:
            "Generate SEO brief: title tag (<60 chars), meta description (<155 chars), H1, 4-6 H2s, and 10 target keywords. Include the market name and current data points.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "generate_market_narrative",
    description:
      "Assemble comprehensive data for a full market narrative/report. Returns snapshot, scores, trends, and demographics.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
    },
    handler: async (args: any) => {
      const [snapshot, score, timeseries] = await Promise.all([
        fetchApi(`/api/market-snapshot/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(`/api/scores/${args.geography}/${args.geo_id}`, {
          historyMonths: 6,
        }).catch(() => null),
        fetchApi(
          `/api/timeseries/home_value/${args.geography}/${args.geo_id}`,
        ).catch(() => null),
      ]);
      return JSON.stringify(
        {
          market_data: snapshot,
          score_data: score,
          price_history: timeseries,
          instructions:
            "Write a comprehensive market narrative in prose. Include current conditions, trends, score interpretation, and outlook. Suitable for a report or landing page.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "compare_markets_for_content",
    description:
      "Assemble side-by-side data for two markets. Great for 'City A vs City B' content that performs well on Reddit and Google.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id_1: z.string().describe("First market ID"),
      geo_id_2: z.string().describe("Second market ID"),
    },
    handler: async (args: any) => {
      const [data1, data2] = await Promise.all([
        getMarketData(args.geography, args.geo_id_1),
        getMarketData(args.geography, args.geo_id_2),
      ]);
      return JSON.stringify(
        {
          market_1: data1,
          market_2: data2,
          instructions:
            "Write a comparison piece. Structure as: intro hook, key metrics table, winner in each category, verdict. Be specific with numbers.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "get_trending_markets",
    description:
      "Find markets with the biggest PropertyIQ score movement. Inherently newsworthy for timely content.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      direction: z
        .enum(["rising", "falling", "both"])
        .optional()
        .describe("Score movement direction"),
      limit: z
        .number()
        .optional()
        .describe("Number of results per direction (default 20)"),
      state: z.string().optional().describe("Filter by state"),
    },
    handler: async (args: any) => {
      const direction = args.direction || "both";
      const wantRising = direction !== "falling";
      const wantFalling = direction !== "rising";
      const limit = args.limit || 20;
      // Both lists come from the public /api/scores/top endpoint: sort=desc
      // yields the highest current scores (momentum leaders), sort=asc the
      // lowest (cooling laggards). The key-gated /api/v1/rankings surface 401s
      // against the MCP's session auth, which previously left falling always [].
      // Only fetch the side(s) the caller asked for.
      const [rising, falling] = await Promise.all([
        wantRising
          ? fetchApi("/api/scores/top", {
              geography: args.geography,
              score_type: "propertyiq",
              limit,
              sort: "desc",
              state: args.state,
            }).catch(() => [])
          : Promise.resolve([]),
        wantFalling
          ? fetchApi("/api/scores/top", {
              geography: args.geography,
              score_type: "propertyiq",
              limit,
              sort: "asc",
              state: args.state,
            }).catch(() => [])
          : Promise.resolve([]),
      ]);
      return JSON.stringify(
        {
          rising_markets: rising,
          falling_markets: falling,
          direction,
          instructions:
            "rising_markets are the highest current PropertyIQ scores (momentum leaders); falling_markets are the lowest (cooling / at-risk). These reflect current standings, not score deltas — do not claim a specific amount of movement. Frame leaders as strengthening demand and laggards as cooling markets or warning signs.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "generate_cold_email",
    description:
      "Assemble market data for an outreach email to an agent or investor. Uses live local data as the hook.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
      persona: z
        .enum(["agent", "investor", "broker", "property_manager"])
        .describe("Target recipient type"),
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
          persona: args.persona,
          instructions: `Write a cold email to a ${args.persona}. Open with a specific, surprising data point about their market. Keep under 150 words. End with a clear CTA.`,
        },
        null,
        2,
      );
    },
  },
];
