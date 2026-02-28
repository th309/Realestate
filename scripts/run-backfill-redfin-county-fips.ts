/**
 * Backfill fips_code in redfin_county using geography_crosswalk + manual mappings.
 *
 * WHY THIS EXISTS:
 * The Redfin import pipeline doesn't populate fips_code. The backtest outcome
 * generator queries redfin_county by fips_code, so this column must be filled.
 *
 * HOW IT WORKS (two passes):
 *
 * Pass 1 — Crosswalk join (handles ~95% of rows):
 *   Redfin stores county_name as "County Name, ST" (e.g., "Autauga County, AL").
 *   The geography_crosswalk stores county_name WITHOUT the state suffix
 *   (e.g., "Autauga County"). We construct the Redfin format from the crosswalk
 *   and match directly. Runs state-by-state via a server-side function to avoid
 *   HTTP/statement timeouts on the 1M+ row table.
 *
 * Pass 2 — Manual mappings (handles ~5% of rows):
 *   65 counties can't match via crosswalk due to naming differences:
 *   - VA independent cities: Redfin "Alexandria, VA" → FIPS 51510
 *   - CT dissolved counties: crosswalk doesn't have them (dissolved 2022)
 *   - Apostrophes: "O'Brien County" vs crosswalk with no apostrophe
 *   - Spacing: "LaSalle" vs "La Salle", "DeKalb" vs "De Kalb"
 *   - Ampersands: "Lewis & Clark" vs "Lewis and Clark"
 *   - AK quirks: Unicode dashes, junk suffixes in crosswalk data
 *   - City-county: "Baltimore City County" → "Baltimore city" FIPS
 *
 * CONNECTION:
 *   Uses direct pg connection (NOT Supabase REST API) because the REST API
 *   has a ~30s HTTP timeout that can't handle bulk updates on this table.
 *   Connection goes through the Supabase pooler (aws-1-us-east-1).
 *
 * IDEMPOTENT: Safe to re-run. Only updates rows where fips_code IS NULL.
 *
 * Usage: npx tsx scripts/run-backfill-redfin-county-fips.ts
 */

import pg from "pg";

const DB_CONFIG = {
  host: "aws-1-us-east-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.pysflbhpnqwoczyuaaif",
  password: "IHatedoingpt12",
  ssl: { rejectUnauthorized: false },
};

/**
 * Manual FIPS mappings for counties the crosswalk can't resolve.
 * Key = Redfin county_name (exact, including ", ST" suffix).
 */
const MANUAL_FIPS_MAPPINGS: Record<string, string> = {
  // Connecticut — dissolved counties in 2022, FIPS codes still valid
  "Fairfield County, CT": "09001",
  "Hartford County, CT": "09003",
  "Litchfield County, CT": "09005",
  "Middlesex County, CT": "09007",
  "New Haven County, CT": "09009",
  "New London County, CT": "09011",
  "Tolland County, CT": "09013",
  "Windham County, CT": "09015",

  // Alaska — crosswalk has unicode dashes, junk suffixes, or different names
  "Denali Borough, AK": "02068",
  "Hoonah-Angoon Census Area, AK": "02105",
  "Prince of Wales-Hyder Census Area, AK": "02198",
  "Skagway Borough, AK": "02230",
  "Wrangell Borough, AK": "02275",

  // Florida — crosswalk stores as "Miami-Dade" (no "County" suffix)
  "Miami-Dade County, FL": "12086",

  // Apostrophe / possessive mismatches
  "O'Brien County, IA": "19141",
  "Prince George's County, MD": "24033",
  "Queen Anne's County, MD": "24035",
  "St. Mary's County, MD": "24037",

  // Spacing differences (LaSalle vs La Salle, etc.)
  "LaSalle County, IL": "17099",
  "DeKalb County, IN": "18033",
  "LaPorte County, IN": "18091",
  "De Baca County, NM": "35011",
  "McKean County, PA": "42083",

  // Independent city naming (Redfin: "X City County", crosswalk: "X city")
  "Baltimore City County, MD": "24510",
  "St. Louis City County, MO": "29510",

  // Ampersand vs "and"
  "Lewis & Clark County, MT": "30049",
  "King & Queen County, VA": "51097",

  // Virginia independent cities — Redfin: "CityName, VA", FIPS: independent city code
  "Alexandria, VA": "51510",
  "Bristol, VA": "51520",
  "Buena Vista, VA": "51530",
  "Charlottesville, VA": "51540",
  "Chesapeake, VA": "51550",
  "Colonial Heights, VA": "51570",
  "Covington, VA": "51580",
  "Danville, VA": "51590",
  "Emporia, VA": "51595",
  "Fairfax City County, VA": "51600",
  "Falls Church, VA": "51610",
  "Franklin City County, VA": "51620",
  "Fredericksburg, VA": "51630",
  "Galax, VA": "51640",
  "Hampton, VA": "51650",
  "Harrisonburg, VA": "51660",
  "Hopewell, VA": "51670",
  "Lexington, VA": "51678",
  "Lynchburg, VA": "51680",
  "Manassas Park, VA": "51685",
  "Manassas, VA": "51683",
  "Martinsville, VA": "51690",
  "Newport News, VA": "51700",
  "Norfolk, VA": "51710",
  "Norton, VA": "51720",
  "Petersburg, VA": "51730",
  "Poquoson, VA": "51735",
  "Portsmouth, VA": "51740",
  "Radford, VA": "51750",
  "Richmond City County, VA": "51760",
  "Roanoke City County, VA": "51770",
  "Salem, VA": "51775",
  "Staunton, VA": "51790",
  "Suffolk, VA": "51800",
  "Virginia Beach, VA": "51810",
  "Waynesboro, VA": "51820",
  "Williamsburg, VA": "51830",
  "Winchester, VA": "51840",
};

const STATES = [
  "AK",
  "AL",
  "AR",
  "AZ",
  "CA",
  "CO",
  "CT",
  "DC",
  "DE",
  "FL",
  "GA",
  "HI",
  "IA",
  "ID",
  "IL",
  "IN",
  "KS",
  "KY",
  "LA",
  "MA",
  "MD",
  "ME",
  "MI",
  "MN",
  "MO",
  "MS",
  "MT",
  "NC",
  "ND",
  "NE",
  "NH",
  "NJ",
  "NM",
  "NV",
  "NY",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VA",
  "VT",
  "WA",
  "WI",
  "WV",
  "WY",
];

async function main() {
  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  console.log("Connected to PostgreSQL.\n");

  await client.query("SET statement_timeout = '300s'");

  const { rows: before } = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE fips_code IS NOT NULL) AS populated,
      COUNT(*) FILTER (WHERE fips_code IS NULL) AS null_count,
      COUNT(*) AS total
    FROM redfin_county
  `);

  console.log("=".repeat(60));
  console.log("  Backfill redfin_county FIPS codes");
  console.log("=".repeat(60));
  console.log(
    `\n  Before: ${before[0].populated} populated, ${before[0].null_count} null, ${before[0].total} total\n`,
  );

  if (parseInt(before[0].null_count) === 0) {
    console.log("  All rows already have FIPS codes. Nothing to do.");
    await client.end();
    return;
  }

  // ── Pass 1: Crosswalk join (state by state) ──────────────────────────

  console.log("  Pass 1: Crosswalk join...\n");

  // Create temp function for state-by-state processing
  await client.query(`
    CREATE OR REPLACE FUNCTION _backfill_county_fips_temp(target_state TEXT)
    RETURNS INT AS $$
    DECLARE rows_updated INT;
    BEGIN
      UPDATE redfin_county rc
      SET fips_code = gc.county_fips
      FROM (
        SELECT DISTINCT
          county_name || ', ' || state_abbrev AS redfin_format_name,
          county_fips
        FROM geography_crosswalk
        WHERE county_fips IS NOT NULL
          AND county_name IS NOT NULL
          AND state_abbrev = target_state
      ) gc
      WHERE rc.county_name = gc.redfin_format_name
        AND rc.state_code = target_state
        AND rc.fips_code IS NULL;
      GET DIAGNOSTICS rows_updated = ROW_COUNT;
      RETURN rows_updated;
    END;
    $$ LANGUAGE plpgsql
  `);

  let crosswalkTotal = 0;
  for (const state of STATES) {
    try {
      const { rows } = await client.query(
        "SELECT _backfill_county_fips_temp($1) AS n",
        [state],
      );
      const n = rows[0]?.n ?? 0;
      crosswalkTotal += n;
      if (n > 0) console.log(`    ${state}: ${n} rows`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ERROR ${state}: ${msg}`);
    }
  }

  await client.query(
    "DROP FUNCTION IF EXISTS _backfill_county_fips_temp(TEXT)",
  );
  console.log(`\n  Pass 1 total: ${crosswalkTotal} rows\n`);

  // ── Pass 2: Manual mappings ──────────────────────────────────────────

  console.log("  Pass 2: Manual mappings...\n");

  let manualTotal = 0;
  for (const [redfinName, fips] of Object.entries(MANUAL_FIPS_MAPPINGS)) {
    try {
      const result = await client.query(
        "UPDATE redfin_county SET fips_code = $1 WHERE county_name = $2 AND fips_code IS NULL",
        [fips, redfinName],
      );
      const n = result.rowCount ?? 0;
      manualTotal += n;
      if (n > 0) console.log(`    ${redfinName} -> ${fips}: ${n} rows`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    ERROR ${redfinName}: ${msg}`);
    }
  }

  console.log(`\n  Pass 2 total: ${manualTotal} rows\n`);

  // ── Results ──────────────────────────────────────────────────────────

  const { rows: after } = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE fips_code IS NOT NULL) AS populated,
      COUNT(*) FILTER (WHERE fips_code IS NULL) AS null_count,
      COUNT(*) AS total
    FROM redfin_county
  `);

  console.log("=".repeat(60));
  console.log("  Results");
  console.log("=".repeat(60));
  console.log(
    `  Before:  ${before[0].populated} populated, ${before[0].null_count} null`,
  );
  console.log(
    `  After:   ${after[0].populated} populated, ${after[0].null_count} null`,
  );
  console.log(
    `  Fixed:   ${crosswalkTotal + manualTotal} rows (${crosswalkTotal} crosswalk + ${manualTotal} manual)`,
  );

  if (parseInt(after[0].null_count) > 0) {
    console.log(
      `\n  WARNING: ${after[0].null_count} rows still null. Sampling:`,
    );
    const { rows: remaining } = await client.query(`
      SELECT DISTINCT county_name, state_code
      FROM redfin_county WHERE fips_code IS NULL
      ORDER BY state_code, county_name LIMIT 30
    `);
    for (const r of remaining) {
      console.log(`    ${r.state_code} | ${r.county_name}`);
    }
    console.log(
      "\n  Add missing counties to MANUAL_FIPS_MAPPINGS in this script.",
    );
  } else {
    console.log("\n  All rows populated.");
  }

  await client.end();
  console.log("  Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
