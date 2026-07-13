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

export const agentTools = [
  {
    name: "buyer_consultation_brief",
    description:
      "Prep sheet for a buyer meeting: affordability, competition level, days on market, inventory, and what to expect. Saves agents 30 min of research.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
      budget: z.number().optional().describe("Buyer's budget in dollars"),
    },
    handler: async (args: any) => {
      const [snapshot, score, affordability] = await Promise.all([
        fetchApi(`/api/market-snapshot/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(`/api/scores/${args.geography}/${args.geo_id}`, {
          historyMonths: 3,
        }).catch(() => null),
        fetchApi(
          `/api/metrics/income-to-buy/${args.geography === "zip" ? "zips" : args.geography === "county" ? "counties" : "metros"}`,
        ).catch(() => null),
      ]);
      return JSON.stringify(
        {
          market_data: snapshot,
          score_data: score,
          affordability_data: affordability,
          buyer_budget: args.budget || null,
          instructions:
            "Create a buyer consultation brief. Include: market temperature, median price vs budget, DOM expectations, competition level (sold above list %), and 3-month trend. Plain language. Data note: every metric carries its own source field (zillow, realtor, or census) — check market_data.metrics.home_value.source before labeling it. Only call it 'Zillow Home Value Index (ZHVI)' (a smoothed regional index of typical home values, not a per-property valuation) when source is zillow; if it's realtor or census instead, cite that source by name (e.g. 'Realtor.com median listing price', 'Census median home value'). Never call any of these 'estimate' or 'Zestimate.' Apply the same source check to trend figures (home_value_yoy/home_value_mom) rather than assuming they're Zillow's.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "listing_presentation_data",
    description:
      "Hyperlocal stats an agent can drop into a listing presentation to demonstrate market expertise.",
    schema: {
      zip: z.string().describe("ZIP code"),
      state: z.string().describe("2-letter state code"),
    },
    handler: async (args: any) => {
      const [snapshot, score, homeValues, rents] = await Promise.all([
        fetchApi(`/api/market-snapshot/zip/${args.zip}`).catch(() => null),
        fetchApi(`/api/scores/zip/${args.zip}`, { historyMonths: 3 }).catch(
          () => null,
        ),
        fetchApi("/api/zillow/zips", { state: args.state }).catch(() => null),
        fetchApi("/api/zillow/rent/zips", { state: args.state }).catch(
          () => null,
        ),
      ]);
      return JSON.stringify(
        {
          zip_snapshot: snapshot,
          score_data: score,
          area_home_values: homeValues,
          area_rents: rents,
          instructions:
            "Format as a listing presentation data sheet. Include: median price, price trend, DOM, inventory, sold above list %, and how this ZIP compares to surrounding areas.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "neighborhood_comparison",
    description:
      "Side-by-side comparison of 2-3 neighborhoods (ZIPs) for buyers deciding between areas.",
    schema: {
      zip_1: z.string().describe("First ZIP code"),
      zip_2: z.string().describe("Second ZIP code"),
      zip_3: z.string().optional().describe("Third ZIP code (optional)"),
    },
    handler: async (args: any) => {
      const zips = [args.zip_1, args.zip_2, args.zip_3].filter(Boolean);
      const results = await Promise.all(
        zips.map(async (zip: string) => ({
          zip,
          ...(await getMarketData("zip", zip)),
        })),
      );
      return JSON.stringify(
        {
          neighborhoods: results,
          instructions:
            "Create a comparison table with: median price, price trend, DOM, schools proximity, walkability signals, and PropertyIQ score. End with a recommendation based on buyer priorities.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "relocation_package",
    description:
      "Full narrative comparing two metros for a relocating client. Covers cost of living, market conditions, and lifestyle factors.",
    schema: {
      origin_geography: z
        .enum(["metro", "county"])
        .describe("Origin geography type"),
      origin_id: z.string().describe("Origin market ID"),
      destination_geography: z
        .enum(["metro", "county"])
        .describe("Destination geography type"),
      destination_id: z.string().describe("Destination market ID"),
    },
    handler: async (args: any) => {
      const [origin, destination] = await Promise.all([
        getMarketData(args.origin_geography, args.origin_id),
        getMarketData(args.destination_geography, args.destination_id),
      ]);
      return JSON.stringify(
        {
          origin,
          destination,
          instructions:
            "Write a relocation comparison. Cover: cost of living difference, housing affordability, market competitiveness, economic outlook, and quality of life indicators. Format for email delivery to a client.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "monthly_market_update_email",
    description:
      "Draft a client newsletter or drip email using current market data. Ready to paste into a CRM.",
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
            "Write a monthly market update email (200-300 words). Conversational but professional. Lead with the most notable change. Include 3-4 key metrics. End with a CTA to reach out. No jargon.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "price_reduction_analysis",
    description:
      "Data to support a price reduction conversation with a seller. Shows what the market is telling us.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
    },
    handler: async (args: any) => {
      const [snapshot, score] = await Promise.all([
        fetchApi(`/api/market-snapshot/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(`/api/scores/${args.geography}/${args.geo_id}`, {
          historyMonths: 3,
        }).catch(() => null),
      ]);
      return JSON.stringify(
        {
          market_data: snapshot,
          score_data: score,
          instructions:
            "Create a price reduction analysis. Focus on: current DOM vs area average, % of listings with price cuts, months of supply, and sold-to-list ratio. Frame data empathetically — the market is the reason, not the seller's fault.",
        },
        null,
        2,
      );
    },
  },
  {
    name: "first_time_buyer_explainer",
    description:
      "Plain-language market brief stripped of jargon, designed for clients who have never bought before.",
    schema: {
      geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
      geo_id: z.string().describe("Geography ID"),
    },
    handler: async (args: any) => {
      const [snapshot, score, affordability] = await Promise.all([
        fetchApi(`/api/market-snapshot/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(`/api/scores/${args.geography}/${args.geo_id}`).catch(
          () => null,
        ),
        fetchApi(
          `/api/metrics/years-to-save/${args.geography === "zip" ? "zips" : "metros"}`,
        ).catch(() => null),
      ]);
      return JSON.stringify(
        {
          market_data: snapshot,
          score_data: score,
          affordability_data: affordability,
          instructions:
            "Write a first-time buyer explainer. NO jargon (define DOM, list price, etc. in plain English). Cover: what homes cost here, how competitive it is, how long homes take to sell, and whether prices are rising or falling. Encouraging but honest tone.",
        },
        null,
        2,
      );
    },
  },
];
