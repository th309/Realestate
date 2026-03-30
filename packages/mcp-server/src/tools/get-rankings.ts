import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const getRankingsTool = {
  name: "get_market_rankings",
  description:
    "Get ranked lists of markets by PropertyIQ score. Supports ascending (worst) and descending (best) order with optional state filter.",
  schema: z.object({
    geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
    limit: z.number().min(1).max(100).default(25).optional(),
    order: z
      .enum(["asc", "desc"])
      .default("desc")
      .optional()
      .describe("Sort order: desc = best first, asc = worst first"),
    state: z
      .string()
      .length(2)
      .optional()
      .describe("2-letter state code filter"),
  }),
  handler: async (args: {
    geography: string;
    limit?: number;
    order?: string;
    state?: string;
  }) => {
    const data = await fetchApi(
      `/api/v1/rankings/propertyiq/${args.geography}`,
      {
        limit: args.limit || 25,
        order: args.order || "desc",
        state: args.state,
      },
    );
    return JSON.stringify(data, null, 2);
  },
};
