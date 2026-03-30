import { z } from "zod";
import { fetchApi } from "../lib/api-client";

export const getDemographicsTool = {
  name: "get_census_demographics",
  description:
    "Get Census demographic data: population, population growth, median income, income growth, median age, homeownership rate. Demographic trends drive housing demand.",
  schema: z.object({
    metric: z
      .enum([
        "population",
        "population-growth",
        "median-income",
        "income-growth",
        "median-age",
        "homeownership-rate",
      ])
      .describe("Demographic metric"),
    geography: z
      .enum(["national", "state", "metro", "county", "zip"])
      .describe("Geography level"),
    state: z
      .string()
      .length(2)
      .optional()
      .describe("2-letter state code filter"),
  }),
  handler: async (args: {
    metric: string;
    geography: string;
    state?: string;
  }) => {
    const geoMap: Record<string, string> = {
      national: "national",
      state: "states",
      metro: "metros",
      county: "counties",
      zip: "zips",
    };
    const data = await fetchApi(
      `/api/census/${args.metric}/${geoMap[args.geography]}`,
      {
        state: args.state,
      },
    );
    return JSON.stringify(data, null, 2);
  },
};
