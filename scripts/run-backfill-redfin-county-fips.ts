/**
 * Backfill fips_code in redfin_county using geography_crosswalk data.
 *
 * Strategy: Fetch all crosswalk mappings, then for each (county, state) pair,
 * issue an UPDATE to redfin_county. ~3,200 UPDATE calls instead of scanning
 * 1.165M rows to find unique counties.
 *
 * Usage: npx tsx scripts/run-backfill-redfin-county-fips.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../packages/backend/.env") });
dotenv.config({
  path: path.resolve(__dirname, "../packages/backend/.env.local"),
});
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "public" },
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface CrosswalkEntry {
  county_name: string;
  state_abbrev: string;
  county_fips: string;
}

/** Fetch all crosswalk rows, paginating past the 1000-row default limit */
async function fetchAllCrosswalkEntries(): Promise<CrosswalkEntry[]> {
  console.log("  Fetching geography_crosswalk mappings...");
  const all: CrosswalkEntry[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("geography_crosswalk")
      .select("county_name, state_abbrev, county_fips")
      .not("county_fips", "is", null)
      .not("county_name", "is", null)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Crosswalk fetch error: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as CrosswalkEntry[]));
    offset += pageSize;
    if (data.length < pageSize) break;
  }

  console.log(`  Fetched ${all.length} crosswalk rows`);
  return all;
}

/** Deduplicate crosswalk to unique (county_name, state) → fips mappings */
function buildUniqueMappings(
  entries: CrosswalkEntry[],
): Map<string, { countyName: string; state: string; fips: string }> {
  const map = new Map<
    string,
    { countyName: string; state: string; fips: string }
  >();
  for (const e of entries) {
    const key = `${e.county_name.toLowerCase().trim()}|${e.state_abbrev.trim()}`;
    if (!map.has(key)) {
      map.set(key, {
        countyName: e.county_name.trim(),
        state: e.state_abbrev.trim(),
        fips: e.county_fips,
      });
    }
  }
  return map;
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Backfill FIPS codes in redfin_county");
  console.log("=".repeat(60));

  const { count: nullBefore } = await supabase
    .from("redfin_county")
    .select("*", { count: "exact", head: true })
    .is("fips_code", null);

  const { count: populatedBefore } = await supabase
    .from("redfin_county")
    .select("*", { count: "exact", head: true })
    .not("fips_code", "is", null);

  console.log(
    `\n  Before: ${populatedBefore ?? 0} populated, ${nullBefore ?? 0} null\n`,
  );

  // Step 1: Load crosswalk
  const entries = await fetchAllCrosswalkEntries();
  const mappings = buildUniqueMappings(entries);
  console.log(`  ${mappings.size} unique county/state → FIPS mappings\n`);

  // Step 2: For each mapping, update redfin_county rows
  let updated = 0;
  let errors = 0;
  const total = mappings.size;
  const startTime = Date.now();

  for (const [i, [, mapping]] of [...mappings.entries()].entries()) {
    // Try exact match first (crosswalk county_name matches redfin county_name)
    const { error } = await supabase
      .from("redfin_county")
      .update({ fips_code: mapping.fips })
      .eq("state_code", mapping.state)
      .is("fips_code", null)
      .ilike("county_name", mapping.countyName);

    if (error) {
      console.error(
        `  ERROR: ${mapping.countyName}, ${mapping.state}: ${error.message}`,
      );
      errors++;
    } else {
      updated++;
    }

    // Also try without suffix (e.g., crosswalk has "Autauga County", Redfin has "Autauga")
    const stripped = mapping.countyName
      .replace(/\s+(County|Parish|Borough|Census Area|Municipality)$/i, "")
      .trim();
    if (stripped !== mapping.countyName) {
      await supabase
        .from("redfin_county")
        .update({ fips_code: mapping.fips })
        .eq("state_code", mapping.state)
        .is("fips_code", null)
        .ilike("county_name", stripped);
    }

    if ((i + 1) % 200 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(
        `  Progress: ${i + 1}/${total} mappings applied (${elapsed}s elapsed)...`,
      );
    }

    // Throttle slightly to avoid overwhelming Supabase
    if ((i + 1) % 100 === 0) {
      await delay(300);
    }
  }

  // Step 3: Check results
  const { count: nullAfter } = await supabase
    .from("redfin_county")
    .select("*", { count: "exact", head: true })
    .is("fips_code", null);

  const { count: populatedAfter } = await supabase
    .from("redfin_county")
    .select("*", { count: "exact", head: true })
    .not("fips_code", "is", null);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(60));
  console.log("  Results");
  console.log("=".repeat(60));
  console.log(
    `  Before: ${populatedBefore ?? 0} populated, ${nullBefore ?? 0} null`,
  );
  console.log(
    `  After:  ${populatedAfter ?? 0} populated, ${nullAfter ?? 0} null`,
  );
  console.log(
    `  Filled: ${(populatedAfter ?? 0) - (populatedBefore ?? 0)} rows`,
  );
  console.log(`  Mappings applied: ${updated}, errors: ${errors}`);
  console.log(`  Duration: ${elapsed}s`);

  if ((nullAfter ?? 0) > 0) {
    console.log(`\n  WARNING: ${nullAfter} rows still have null fips_code.`);
    console.log("  Sampling unmatched counties...");
    const { data: unmatched } = await supabase
      .from("redfin_county")
      .select("county_name, state_code")
      .is("fips_code", null)
      .limit(50);

    if (unmatched && unmatched.length > 0) {
      const unique = [
        ...new Map(
          unmatched.map((r) => [`${r.county_name}|${r.state_code}`, r]),
        ).values(),
      ];
      for (const r of unique.slice(0, 20)) {
        console.log(`    - ${r.county_name}, ${r.state_code}`);
      }
    }
  }

  console.log("\n  Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
