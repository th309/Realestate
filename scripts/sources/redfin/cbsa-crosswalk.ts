/**
 * CBSA code crosswalk for Redfin metro ingest.
 *
 * Redfin's metro TSV reports ~13 large metros under their pre-2023
 * metropolitan-DIVISION codes (e.g. New York = 35614), while the platform's
 * scoring, geography, and map layers key on the 2023 OMB MSA delineation
 * (New York = 35620). Left un-normalized, scores and metrics for these metros
 * land under a code nothing else joins to, so they silently fall back to the
 * last matching period.
 *
 * Mirrors packages/frontend/lib/data/cbsa-crosswalk.ts (OLD_TO_NEW). Kept as a
 * separate scripts-side copy because the ingest pipeline can't import from the
 * frontend package. The 2023 delineation is stable until the next OMB revision.
 */

/** Pre-2023 (Redfin/TIGER) → 2023 delineation (system canonical) CBSA codes. */
export const OLD_TO_NEW_CBSA: Record<string, string> = {
  "14454": "14460", // Boston
  "16984": "16980", // Chicago
  "17460": "17410", // Cleveland
  "19124": "19100", // Dallas
  "19804": "19820", // Detroit
  "30100": "30150", // Lebanon, NH
  "31084": "31080", // Los Angeles
  "33124": "33100", // Miami
  "35614": "35620", // New York
  "37964": "37980", // Philadelphia
  "41884": "41860", // San Francisco
  "42644": "42660", // Seattle
  "47894": "47900", // Washington, DC
};

/**
 * Normalize a raw Redfin metro CBSA code to the system's canonical 2023 code.
 * Returns the input unchanged when no remap is needed.
 */
export function toCanonicalCbsa(code: string | null): string | null {
  if (!code) return code;
  return OLD_TO_NEW_CBSA[code] ?? code;
}
