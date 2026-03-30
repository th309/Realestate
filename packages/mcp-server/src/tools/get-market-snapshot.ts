import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const getMarketSnapshotTool = {
  name: "get_market_snapshot",
  description:
    "Get a comprehensive snapshot of ALL metrics for a single market in one call. Returns home values, rents, economic indicators, census data, and PropertyIQ scores. Most efficient tool for full market analysis.",
  schema: z.object({
    geography: z
      .enum(["state", "metro", "county", "zip"])
      .describe("Geography level"),
    geo_id: z.string().describe("Geography ID"),
  }),
  handler: async (args: { geography: string; geo_id: string }) => {
    const data = await fetchApi(
      `/api/market-snapshot/${args.geography}/${args.geo_id}`,
    );
    return JSON.stringify(data, null, 2);
  },
};
