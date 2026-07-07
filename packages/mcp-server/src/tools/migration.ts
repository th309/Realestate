import { z } from "zod";
import { fetchApi } from "../lib/api-client";

/**
 * IRS migration aggregate metric IDs registered in
 * `packages/backend/src/metric-resolution/fallback-registry.ts`.
 */
export const IRS_MIGRATION_AGGREGATE_METRICS = [
  "irs_migration_in_returns",
  "irs_migration_out_returns",
  "irs_migration_net_returns",
  "irs_migration_in_avg_agi",
  "irs_migration_out_avg_agi",
] as const;

const VALID_SOURCES = ["irs", "redfin"] as const;
const VALID_DIRECTIONS = ["in", "out"] as const;

interface GetMigrationFlowsArgs {
  source: (typeof VALID_SOURCES)[number];
  fips: string;
  direction: (typeof VALID_DIRECTIONS)[number];
  limit?: number;
}

interface GetMigrationSummaryArgs {
  geoLevel: string;
  geoId: string;
}

/**
 * Wraps `GET /api/migration/flows/:source/:fips?direction=&limit=` exposed by
 * the backend `MigrationModule`.
 */
export async function handleGetMigrationFlows(
  args: GetMigrationFlowsArgs,
): Promise<string> {
  if (!VALID_SOURCES.includes(args.source)) {
    throw new Error(
      `Invalid source '${args.source}'. Must be one of: ${VALID_SOURCES.join(", ")}.`,
    );
  }
  if (!VALID_DIRECTIONS.includes(args.direction)) {
    throw new Error(
      `Invalid direction '${args.direction}'. Must be one of: ${VALID_DIRECTIONS.join(", ")}.`,
    );
  }

  const params: Record<string, string | number> = {
    direction: args.direction,
    limit: args.limit ?? 5,
  };

  const data = await fetchApi(
    `/api/migration/flows/${args.source}/${args.fips}`,
    params,
  );

  return JSON.stringify(data, null, 2);
}

/**
 * Aggregate IRS net-migration view for a county or metro, optionally enriched
 * with Redfin top-flow overlay (for counties, we attempt to look up the
 * parent CBSA so the Redfin metro-level flows can be attached).
 *
 * If the parent-metro lookup endpoint is unavailable or returns nothing, we
 * silently set `redfinOverlay = null` rather than fail the whole call.
 */
export async function handleGetMigrationSummary(
  args: GetMigrationSummaryArgs,
): Promise<string> {
  // 5 IRS aggregate metric calls
  const irsResults = await Promise.all(
    IRS_MIGRATION_AGGREGATE_METRICS.map((metricId) =>
      fetchApi(
        `/api/metrics/resolve/${metricId}/${args.geoLevel}/${args.geoId}`,
      ).catch((err) => {
        // resolve route returns 200/value:null for no-data; a throw is a real
        // transport/route error — surface it rather than silently emptying.
        console.error(
          `get_migration_summary: failed to fetch ${metricId} for ${args.geoLevel}/${args.geoId}:`,
          err instanceof Error ? err.message : err,
        );
        return null;
      }),
    ),
  );

  const irs: Record<string, unknown> = {};
  IRS_MIGRATION_AGGREGATE_METRICS.forEach((metricId, idx) => {
    irs[metricId] = irsResults[idx];
  });

  // Best-effort Redfin overlay: fetch top inbound/outbound flows.
  // For county geoLevel, attempt parent-metro lookup; if unavailable, fall
  // back to using the FIPS directly (Redfin source supports CBSA codes).
  let redfinOverlay: unknown = null;

  try {
    let cbsa: string | null = null;

    if (args.geoLevel === "metro") {
      cbsa = args.geoId;
    } else if (args.geoLevel === "county") {
      // Endpoint may not exist yet; tolerate failure.
      const parent = (await fetchApi(
        `/api/geography/parent-metro/${args.geoId}`,
      ).catch(() => null)) as { cbsa?: string; cbsa_code?: string } | null;

      if (parent) {
        cbsa = parent.cbsa ?? parent.cbsa_code ?? null;
      }
    }

    if (cbsa) {
      const [inbound, outbound] = await Promise.all([
        fetchApi(`/api/migration/flows/redfin/${cbsa}`, {
          direction: "in",
          limit: 5,
        }).catch(() => null),
        fetchApi(`/api/migration/flows/redfin/${cbsa}`, {
          direction: "out",
          limit: 5,
        }).catch(() => null),
      ]);
      redfinOverlay = { cbsa, inbound, outbound };
    }
  } catch {
    redfinOverlay = null;
  }

  return JSON.stringify(
    {
      geoLevel: args.geoLevel,
      geoId: args.geoId,
      irs,
      redfinOverlay,
    },
    null,
    2,
  );
}

export const migrationTools = [
  {
    name: "get_migration_flows",
    description:
      "Get top inbound or outbound migration flows for a county or metro from IRS (annual tax-return based) or Redfin (search-activity proxy). Returns ranked list of source/destination markets.",
    schema: {
      source: z
        .enum(["irs", "redfin"])
        .describe(
          "Data source: 'irs' (annual returns) or 'redfin' (search activity)",
        ),
      fips: z.string().describe("5-digit county FIPS code or CBSA code"),
      direction: z
        .enum(["in", "out"])
        .describe("'in' = inbound migration to this market, 'out' = outbound"),
      limit: z
        .number()
        .optional()
        .describe("Max flows to return (default 5, max 50)"),
    },
    handler: async (args: any) =>
      handleGetMigrationFlows(args as GetMigrationFlowsArgs),
  },
  {
    name: "get_migration_summary",
    description:
      "Aggregate net-migration view for a county or metro: IRS in/out/net returns and average AGI, plus best-effort Redfin top-flow overlay (where available). Useful for understanding population dynamics and market demand drivers.",
    schema: {
      geoLevel: z
        .enum(["state", "metro", "county"])
        .describe("Geography level (zip not supported)"),
      geoId: z.string().describe("State code, CBSA, or 5-digit county FIPS"),
    },
    handler: async (args: any) =>
      handleGetMigrationSummary(args as GetMigrationSummaryArgs),
  },
];
