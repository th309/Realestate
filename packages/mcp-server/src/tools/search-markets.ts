import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const searchMarketsTool = {
  name: "search_markets",
  description:
    "Search for US real estate markets by name. Returns geography IDs (CBSA codes, FIPS codes, ZIP codes) needed for all other tools. Use this first to resolve human-readable names to IDs.",
  schema: z.object({
    query: z
      .string()
      .describe(
        "Market name to search (e.g. 'Austin', 'Cook County', '90210')",
      ),
    geography_type: z
      .enum(["metro", "county", "zip", "city"])
      .optional()
      .describe("Filter by geography type"),
    limit: z.number().min(1).max(50).default(10).optional(),
  }),
  handler: async (args: {
    query: string;
    geography_type?: string;
    limit?: number;
  }) => {
    const data = await fetchApi<any[]>("/api/geography/search", {
      query: args.query,
      type: args.geography_type,
      limit: args.limit || 10,
    });
    return JSON.stringify(data, null, 2);
  },
};
