/**
 * SQL Helper Utilities
 */

import { createFredImportClient } from "./db-client";

/**
 * Escape value for SQL
 */
export function escapeSQL(value: any): string {
  if (value === null || value === undefined) return "NULL";

  if (typeof value === "number") {
    if (!isFinite(value) || isNaN(value)) return "NULL";
    const maxSafe = 999999999999;
    const minSafe = -999999999999;
    let safeValue = value;
    if (value > maxSafe) safeValue = maxSafe;
    else if (value < minSafe) safeValue = minSafe;
    if (Math.abs(safeValue) < 0.000001 && safeValue !== 0) return "0";
    if (Number.isInteger(safeValue)) {
      return safeValue.toString();
    } else {
      const fixed = safeValue.toFixed(10);
      return parseFloat(fixed).toString();
    }
  }

  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";

  if (value instanceof Date) {
    return `'${value.toISOString().split("T")[0]}'`;
  }

  return `'${value.toString().replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

/**
 * Batch upsert using the native Supabase JS client `.upsert()`.
 *
 * Previously used a `supabase.rpc('exec_sql', { query })` call, but that
 * RPC was never deployed to the database — every batch failed with
 * "Could not find the function public.exec_sql(query) in the schema cache".
 * The same operation is expressible with the standard client method, which
 * also handles parameter escaping (no more hand-rolled SQL strings).
 */
export async function batchUpsertSQL(
  table: string,
  records: any[],
  conflictColumn: string,
): Promise<{ inserted: number; error?: string }> {
  if (records.length === 0) {
    return { inserted: 0 };
  }

  const supabase = createFredImportClient();

  try {
    const { error } = await supabase.from(table).upsert(records, {
      onConflict: conflictColumn,
      ignoreDuplicates: false,
    });

    if (error) {
      return { inserted: 0, error: error.message };
    }

    return { inserted: records.length };
  } catch (err: any) {
    return { inserted: 0, error: err.message };
  }
}

/**
 * Ensure geographic unit exists
 */
export async function ensureGeographicUnitExists(
  geoid: string,
  level: string,
  name: string,
): Promise<void> {
  const supabase = createFredImportClient();

  const { data: existing } = await supabase
    .from("geographic_units")
    .select("geoid")
    .eq("geoid", geoid)
    .maybeSingle();

  if (!existing) {
    await batchUpsertSQL("geographic_units", [{ geoid, level, name }], "geoid");
    await batchUpsertSQL(
      "markets",
      [
        {
          region_id: geoid,
          region_name: name,
          region_type: level,
          geoid,
        },
      ],
      "region_id",
    );
  }
}

/**
 * Get geographic units by level
 */
export async function getGeographicUnits(
  geography: "state" | "county" | "msa",
): Promise<Array<{ geoid: string; [key: string]: any }>> {
  const supabase = createFredImportClient();

  const levelMap: Record<string, string> = {
    state: "state",
    county: "county",
    msa: "cbsa",
  };

  const { data, error } = await supabase
    .from("geographic_units")
    .select("*")
    .eq("level", levelMap[geography]);

  if (error) {
    console.warn(
      `   ⚠️  Could not fetch ${geography} GEOIDs: ${error.message}`,
    );
    return [];
  }

  return (data || []).map((row) => ({ geoid: row.geoid, ...row }));
}
