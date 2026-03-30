import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const getRentDataTool = {
  name: "get_rent_data",
  description:
    "Get current rent index data (Zillow ZORI) showing median rents for markets. Essential for investment analysis (cap rates, yields).",
  schema: z.object({
    geography: z.enum(["metro", "county", "zip"]).describe("Geography level"),
    state: z.string().length(2).optional().describe("Required for zip level"),
  }),
  handler: async (args: { geography: string; state?: string }) => {
    const geoMap: Record<string, string> = {
      metro: "metros",
      county: "counties",
      zip: "zips",
    };
    const data = await fetchApi(`/api/zillow/rent/${geoMap[args.geography]}`, {
      state: args.state,
    });
    return JSON.stringify(data, null, 2);
  },
};
