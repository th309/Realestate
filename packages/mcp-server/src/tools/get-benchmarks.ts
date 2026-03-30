import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const getBenchmarksTool = {
  name: "compare_market_benchmarks",
  description:
    "Compare a market's metrics against its parent geography benchmarks (e.g. county vs state, metro vs national). Useful for contextualizing data: 'Austin's cap rate is X% above the national average'.",
  schema: z.object({
    geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
    geo_id: z.string().describe("Geography ID"),
    metrics: z
      .string()
      .describe(
        "Comma-separated metric IDs (e.g. 'cap_rate,gross_yield,home_value')",
      ),
  }),
  handler: async (args: {
    geography: string;
    geo_id: string;
    metrics: string;
  }) => {
    const data = await fetchApi(
      `/api/benchmarks/${args.geography}/${args.geo_id}`,
      {
        metrics: args.metrics,
      },
    );
    return JSON.stringify(data, null, 2);
  },
};
