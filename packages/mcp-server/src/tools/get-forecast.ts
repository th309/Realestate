import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const getForecastTool = {
  name: "get_home_value_forecast",
  description:
    "Get Zillow home value forecasts showing projected price changes at 3-month and 12-month horizons. Forward-looking data for investment decisions.",
  schema: z.object({
    geography: z
      .enum(["metro", "zip"])
      .describe("Geography level (metro or zip only)"),
    state: z.string().length(2).optional().describe("Required for zip level"),
  }),
  handler: async (args: { geography: string; state?: string }) => {
    const geoMap: Record<string, string> = { metro: "metros", zip: "zips" };
    const data = await fetchApi(
      `/api/zillow/forecast/${geoMap[args.geography]}`,
      {
        state: args.state,
      },
    );
    return JSON.stringify(data, null, 2);
  },
};
