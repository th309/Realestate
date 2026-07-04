/**
 * Post-import sanity guard for Redfin Data Center metro keys.
 *
 * Redfin labels metro rows by NAME ("Charlotte, NC metro area"), not by CBSA
 * code, and the row is then keyed to a canonical CBSA geoid by the metro
 * crosswalk. A resolver regression (the legacy state-blind `%name%` substring
 * match) once filed "Charlotte, NC" under CBSA 16820 (Charlottesville, VA).
 * That mis-key does not error — it silently points a metro at the wrong CBSA,
 * so downstream metric cards blank out with no signal that anything is wrong.
 *
 * This guard makes that failure LOUD: after the import, it asserts that every
 * distinct (region_id, region_name) in redfin_dc_housing_market_metro has a
 * stored region_name whose state agrees with the canonical CBSA state for its
 * region_id. The canonical state comes from tiger_cbsa — the COMPLETE Census
 * CBSA gazetteer — NOT `geographies`, which is missing ~11 CBSAs Redfin uses
 * (e.g. the 3 valid CT metros Bridgeport/Hartford/New Haven live in tiger_cbsa
 * and must pass). Any violation throws, so the monthly import job exits
 * non-zero instead of publishing a silently-broken metro.
 *
 * housing_market is the metro superset across the redfin_dc_* dashboards
 * (tied for the most distinct region_ids), so validating it alone covers the
 * whole metro key space.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** The metro table whose keys are validated (superset of all redfin_dc metros). */
export const METRO_TABLE = "redfin_dc_housing_market_metro";

/** Why a metro key is a violation (mirrors the reason label in the detection SQL). */
export type MetroKeyViolationReason =
  | "NON_NUMERIC_KEY"
  | "NO_CANONICAL_CBSA"
  | "STATE_MISMATCH";

/** A distinct Redfin metro row as stored (region_id keyed, region_name labelled). */
export interface RedfinMetroRow {
  region_id: string;
  region_name: string;
}

/** A single metro-key violation, with the canonical CBSA name for context. */
export interface MetroKeyViolation {
  region_id: string;
  region_name: string;
  canonical_name: string | null;
  reason: MetroKeyViolationReason;
}

/** First `, XX` two-letter state token in a Redfin region_name ("Charlotte, NC ..." -> "NC"). */
function redfinStateOf(regionName: string): string | null {
  return regionName.match(/,\s*([A-Z]{2})/)?.[1] ?? null;
}

/**
 * All two-letter state tokens in a canonical CBSA name's state suffix.
 * Takes the text from the last comma on ("Allentown-Bethlehem-Easton, PA-NJ"
 * -> ", PA-NJ") and extracts every [A-Z]{2} token (-> ["PA","NJ"]).
 */
function canonicalStatesOf(canonicalName: string | null): string[] {
  if (canonicalName == null) return [];
  const stateSuffix = canonicalName.match(/,[^,]*$/)?.[0] ?? "";
  return stateSuffix.match(/[A-Z]{2}/g) ?? [];
}

/**
 * Pure detection: given the distinct Redfin metros and a geoid->canonical-name
 * map (from tiger_cbsa), return the metro keys whose stored region_name state
 * disagrees with the canonical CBSA state. Empty array = clean.
 *
 * A metro is a violation when ANY of:
 *   - region_id is not all digits            -> NON_NUMERIC_KEY
 *   - region_id has no tiger_cbsa entry      -> NO_CANONICAL_CBSA
 *   - region_name state ∉ canonical states   -> STATE_MISMATCH (also when the
 *                                               region_name has no parseable state)
 * The reason is reported in that priority order, matching the detection SQL.
 */
export function detectMetroKeyViolations(
  metros: RedfinMetroRow[],
  cbsaNameByGeoid: Map<string, string>,
): MetroKeyViolation[] {
  const violations: MetroKeyViolation[] = [];
  for (const { region_id, region_name } of metros) {
    const key = String(region_id);
    const canonical_name = cbsaNameByGeoid.get(key) ?? null;
    const redfinState = redfinStateOf(region_name);
    const canonicalStates = canonicalStatesOf(canonical_name);

    const nonNumericKey = !/^[0-9]+$/.test(key);
    const noCanonical = canonical_name == null;
    const stateMismatch =
      redfinState == null || !canonicalStates.includes(redfinState);

    if (!nonNumericKey && !noCanonical && !stateMismatch) continue;

    const reason: MetroKeyViolationReason = nonNumericKey
      ? "NON_NUMERIC_KEY"
      : noCanonical
        ? "NO_CANONICAL_CBSA"
        : "STATE_MISMATCH";
    violations.push({ region_id: key, region_name, canonical_name, reason });
  }
  return violations;
}

/** Page size for reading rows over the PostgREST 1000-row cap. */
const PAGE = 1000;

/** Read every row of `columns` from `table` (range-paginated, ordered for stable paging). */
async function readAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  orderColumn: string,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderColumn)
      .range(from, from + PAGE - 1);
    if (error) {
      throw new Error(
        `redfin-dc metro key validation: failed reading ${table}: ${error.message}`,
      );
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

/** Dedupe metro rows to DISTINCT (region_id, region_name). */
function distinctMetros(rows: RedfinMetroRow[]): RedfinMetroRow[] {
  const seen = new Set<string>();
  const out: RedfinMetroRow[] = [];
  for (const r of rows) {
    const key = `${r.region_id}|${r.region_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ region_id: String(r.region_id), region_name: r.region_name });
  }
  return out;
}

/**
 * Validate that every imported metro's stored state agrees with its CBSA's
 * canonical state. Logs each violation and THROWS if any exist (so the import
 * job exits non-zero); logs a one-line pass otherwise.
 */
export async function validateRedfinDcMetroKeys(
  supabase: SupabaseClient,
): Promise<void> {
  const metroRows = await readAllRows<RedfinMetroRow>(
    supabase,
    METRO_TABLE,
    "region_id, region_name",
    "region_id",
  );
  const cbsaRows = await readAllRows<{ geoid: string; name: string }>(
    supabase,
    "tiger_cbsa",
    "geoid, name",
    "geoid",
  );
  const cbsaNameByGeoid = new Map<string, string>(
    cbsaRows.map((c) => [String(c.geoid), c.name]),
  );

  const metros = distinctMetros(metroRows);
  const violations = detectMetroKeyViolations(metros, cbsaNameByGeoid);

  if (violations.length > 0) {
    console.error(
      `  [redfin-dc] METRO KEY VALIDATION FAILED: ${violations.length} metro(s) mis-keyed`,
    );
    for (const v of violations) {
      console.error(
        `    ✗ ${v.reason}: region_id=${v.region_id} region_name="${v.region_name}" canonical_cbsa="${v.canonical_name ?? "(none)"}"`,
      );
    }
    throw new Error(
      `redfin-dc metro key validation failed: ${violations.length} metro(s) have a region_id whose canonical CBSA state disagrees with the stored region_name (see log above). A CBSA mis-key silently blanks metric cards; failing the import.`,
    );
  }

  console.log(
    `  [redfin-dc] metro key validation passed (${metros.length} metros).`,
  );
}
