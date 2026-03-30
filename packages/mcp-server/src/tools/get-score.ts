import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const getScoreTool = {
  name: "get_propertyiq_score",
  description:
    "Get the PropertyIQ composite score (0-100), letter grade, confidence level, and 3-month trend for a specific market. Score 50 = state average; higher = outperforming. Confidence (A-F) indicates data quality.",
  schema: z.object({
    geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
    location_id: z
      .string()
      .describe("Geography ID (CBSA code, FIPS code, or ZIP code)"),
    history_months: z
      .number()
      .min(0)
      .max(6)
      .default(3)
      .optional()
      .describe("Months of history for trend (default 3)"),
  }),
  handler: async (args: {
    geography: string;
    location_id: string;
    history_months?: number;
  }) => {
    const data = await fetchApi(
      `/api/scores/${args.geography}/${args.location_id}`,
      {
        historyMonths: args.history_months ?? 3,
      },
    );
    return JSON.stringify(data, null, 2);
  },
};
