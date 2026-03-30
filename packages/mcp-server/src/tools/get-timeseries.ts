import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const getTimeseriesTool = {
  name: "get_market_timeseries",
  description:
    "Get historical time-series data for any metric and region. Use for trend analysis and charting over time.",
  schema: z.object({
    metric: z
      .string()
      .describe(
        "Metric ID (e.g. home_value, rent_index, listing_price, unemployment_rate)",
      ),
    geography: z
      .enum(["state", "metro", "county", "zip"])
      .describe("Geography level"),
    region_id: z.string().describe("Region identifier"),
  }),
  handler: async (args: {
    metric: string;
    geography: string;
    region_id: string;
  }) => {
    const data = await fetchApi(
      `/api/timeseries/${args.metric}/${args.geography}/${args.region_id}`,
    );
    return JSON.stringify(data, null, 2);
  },
};
