import { z } from "zod";
import { fetchApi } from "../lib/api-client";

/**
 * The 11 BLS QCEW supersector metric IDs registered in
 * `packages/backend/src/metric-resolution/fallback-registry.ts`.
 */
export const EMPLOYMENT_SECTOR_METRICS = [
  "employment_natural_resources_mining",
  "employment_construction",
  "employment_manufacturing",
  "employment_trade_transport_utilities",
  "employment_information",
  "employment_financial_activities",
  "employment_professional_business_services",
  "employment_education_health_services",
  "employment_leisure_hospitality",
  "employment_other_services",
  "employment_public_administration",
] as const;

const SUPPORTED_GEO_LEVELS = ["state", "metro", "county"] as const;
type SupportedGeoLevel = (typeof SUPPORTED_GEO_LEVELS)[number];

interface GetEmploymentBySectorArgs {
  geoLevel: string;
  geoId: string;
}

/**
 * Fan out 11 metric calls (one per QCEW supersector) and collect the values
 * into a single sector-keyed object. Used by the `get_employment_by_sector`
 * MCP tool.
 */
export async function handleGetEmploymentBySector(
  args: GetEmploymentBySectorArgs,
): Promise<string> {
  if (!SUPPORTED_GEO_LEVELS.includes(args.geoLevel as SupportedGeoLevel)) {
    throw new Error(
      `Unsupported geoLevel '${args.geoLevel}'. Sector employment is only available for: ${SUPPORTED_GEO_LEVELS.join(
        ", ",
      )}.`,
    );
  }

  const results = await Promise.all(
    EMPLOYMENT_SECTOR_METRICS.map((metricId) =>
      fetchApi(`/api/metrics/${metricId}/${args.geoLevel}/${args.geoId}`).catch(
        () => null,
      ),
    ),
  );

  const sectors: Record<string, unknown> = {};
  EMPLOYMENT_SECTOR_METRICS.forEach((metricId, idx) => {
    sectors[metricId] = results[idx];
  });

  return JSON.stringify(
    {
      geoLevel: args.geoLevel,
      geoId: args.geoId,
      sectors,
    },
    null,
    2,
  );
}

export const employmentTools = [
  {
    name: "get_employment_by_sector",
    description:
      "Get employment counts by industry supersector (11 BLS QCEW sectors: construction, manufacturing, financial activities, etc.) for a state, metro, or county. Useful for economic diversity and concentration analysis.",
    schema: {
      geoLevel: z
        .enum(["state", "metro", "county"])
        .describe("Geography level (zip not supported)"),
      geoId: z
        .string()
        .describe(
          "Geography ID: state code (e.g. 'CA'), CBSA (e.g. '31080'), or 5-digit county FIPS",
        ),
    },
    handler: async (args: any) =>
      handleGetEmploymentBySector(args as GetEmploymentBySectorArgs),
  },
];
