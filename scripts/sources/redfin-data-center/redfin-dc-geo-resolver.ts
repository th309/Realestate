/**
 * Resolve Redfin Data Center region names to our standard geo IDs.
 *
 * Delegates the heavy lifting to the legacy resolveRedfinGeoid (tiger tables +
 * markets fallback), after normalizing the new format's name quirks. Reports
 * whether the ID is a real match or a generated REDFIN-… fallback so callers
 * can enforce an unresolved-rate threshold.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRedfinGeoid } from "../redfin/redfin-geoid-lookup";

/** Remove the " metro area" suffix the DC format appends to metro names. */
export function stripMetroSuffix(name: string): string {
  return name.replace(/\s+metro area$/i, "").trim();
}

/** Pull a trailing ", XX" 2-letter state code, or null. */
export function extractStateCode(name: string): string | null {
  const m = name.match(/,\s*([A-Z]{2})(?:\s+metro area)?$/);
  return m ? m[1] : null;
}

export interface ResolvedGeo {
  regionId: string;
  /** False when resolveRedfinGeoid fell back to a generated REDFIN-… id. */
  resolved: boolean;
}

/**
 * Resolve a (geoLevel, regionName) to a standard geo id.
 * For 'country' there is one fixed id ('US').
 */
export async function resolveDcGeo(
  supabase: SupabaseClient,
  geoLevel: string,
  regionName: string,
): Promise<ResolvedGeo> {
  if (geoLevel === "country") return { regionId: "US", resolved: true };
  if (geoLevel === "census_region") {
    return { regionId: regionName.trim(), resolved: true };
  }

  const stateCode = extractStateCode(regionName) ?? undefined;
  const cleanName =
    geoLevel === "metro" ? stripMetroSuffix(regionName) : regionName;

  const regionId = await resolveRedfinGeoid(
    supabase,
    geoLevel,
    cleanName,
    stateCode,
  );
  return { regionId, resolved: !regionId.startsWith("REDFIN-") };
}
