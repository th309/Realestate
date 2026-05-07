/**
 * MIGRATION FLOWS FETCHER
 *
 * Fetches county/metro migration flows (top origins/destinations) from the
 * backend `/api/migration/flows/:source/:fips` endpoint.
 *
 * Supports two sources:
 * - 'irs'    — IRS county-to-county tax-return migration (county level)
 * - 'redfin' — Redfin metro-to-metro home-search flows (metro level)
 *
 * The shape of each flow row varies by source. Both shapes are unioned in
 * `MigrationFlow` and discriminated by which `*_fips` / `*_cbsa` field is
 * present. Callers can narrow with the `source` field on `MigrationFlowsResult`.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAPIWithParams } from "./base";

// --- Types -------------------------------------------------------------------

export type MigrationSource = "irs" | "redfin";
export type MigrationDirection = "in" | "out";
export type MigrationGeoLevel = "county" | "metro";

/**
 * IRS migration flow row. The `direction` parameter on the request controls
 * whether `origin_fips` (direction='in') or `destination_fips` (direction='out')
 * is populated.
 */
export interface IrsMigrationFlow {
  origin_fips?: string;
  origin_name?: string | null;
  destination_fips?: string;
  destination_name?: string | null;
  num_returns: number;
  num_exemptions: number;
  avg_agi: number | null;
}

/**
 * Redfin home-search migration flow row.
 */
export interface RedfinMigrationFlow {
  origin_cbsa?: string;
  origin_name?: string | null;
  destination_cbsa?: string;
  destination_name?: string | null;
  share_pct: number;
  net_searches: number;
}

export type MigrationFlow = IrsMigrationFlow | RedfinMigrationFlow;

export interface MigrationFlowsResult {
  geography: {
    fips: string;
    name: string | null;
    level: MigrationGeoLevel;
  };
  source: MigrationSource;
  direction: MigrationDirection;
  as_of: string | null;
  flows: MigrationFlow[];
}

// --- Constants ---------------------------------------------------------------

/** 2 hours — matches the data layer convention for snapshot/insight fetches. */
const STALE_TIME_MS = 2 * 60 * 60 * 1000;

// --- Fetcher -----------------------------------------------------------------

/**
 * Fetch top migration flows for a county (IRS) or metro (Redfin).
 *
 * @param fips      5-digit county FIPS for IRS, CBSA code for Redfin.
 * @param source    'irs' | 'redfin'.
 * @param direction 'in' (inflow) or 'out' (outflow). Defaults to 'in'.
 * @param limit     Max number of flows to return. Defaults to 5.
 */
export async function fetchMigrationFlows(
  fips: string,
  source: MigrationSource,
  direction: MigrationDirection = "in",
  limit: number = 5,
): Promise<MigrationFlowsResult> {
  return fetchAPIWithParams<MigrationFlowsResult>(
    `/api/migration/flows/${source}/${fips}`,
    { direction, limit },
  );
}

// --- Hook --------------------------------------------------------------------

/**
 * React Query hook for migration flows.
 *
 * Cache key: `['migration-flows', source, fips, direction, limit]` so changing
 * any argument fetches a new entry while identical args reuse the cache.
 */
export function useMigrationFlows(
  fips: string | null | undefined,
  source: MigrationSource,
  direction: MigrationDirection = "in",
  limit: number = 5,
) {
  return useQuery<MigrationFlowsResult>({
    queryKey: ["migration-flows", source, fips, direction, limit],
    queryFn: () => fetchMigrationFlows(fips!, source, direction, limit),
    enabled: !!fips,
    staleTime: STALE_TIME_MS,
    gcTime: STALE_TIME_MS,
  });
}
