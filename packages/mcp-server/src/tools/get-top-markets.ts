import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const getTopMarketsTool = {
  name: "get_top_markets",
  description:
    "Get the highest-ranked markets by PropertyIQ score. Optionally filter by state. Use to answer 'What are the best markets in Texas?' or 'Top 10 metros nationally'.",
  schema: z.object({
    geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
    limit: z.number().min(1).max(100).default(10).optional(),
    state: z
      .string()
      .length(2)
      .optional()
      .describe("2-letter state code to filter (e.g. 'TX')"),
  }),
  handler: async (args: {
    geography: string;
    limit?: number;
    state?: string;
  }) => {
    const data = await fetchApi("/api/scores/top", {
      geography: args.geography,
      score_type: "propertyiq",
      limit: args.limit || 10,
      state: args.state,
    });
    return JSON.stringify(data, null, 2);
  },
};
