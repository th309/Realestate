import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const getHomeValuesTool = {
  name: "get_home_values",
  description:
    "Get current median home values (Zillow ZHVI) for all markets at a geography level. Returns region_id, region_name, value, and date. Optionally filter by state for ZIP/city levels.",
  schema: z.object({
    geography: z
      .enum(["national", "state", "metro", "county", "zip", "city"])
      .describe("Geography level"),
    state: z
      .string()
      .length(2)
      .optional()
      .describe("Required for zip/city. 2-letter state code (e.g. 'CA')"),
  }),
  handler: async (args: { geography: string; state?: string }) => {
    const geoMap: Record<string, string> = {
      national: "national",
      state: "states",
      metro: "metros",
      county: "counties",
      zip: "zips",
      city: "cities",
    };
    const data = await fetchApi(`/api/zillow/${geoMap[args.geography]}`, {
      state: args.state,
    });
    return JSON.stringify(data, null, 2);
  },
};
