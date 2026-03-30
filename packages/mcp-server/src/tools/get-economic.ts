import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const getEconomicTool = {
  name: "get_economic_indicators",
  description:
    "Get economic indicators (unemployment rate, job growth, GDP growth) at various geography levels. Economic fundamentals drive real estate markets.",
  schema: z.object({
    metric: z
      .enum(["unemployment", "job-growth", "gdp-growth"])
      .describe("Economic metric"),
    geography: z
      .enum(["national", "state", "metro", "county"])
      .describe("Geography level"),
  }),
  handler: async (args: { metric: string; geography: string }) => {
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
};
