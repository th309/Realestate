/**
 * Align PropertyIQ v4 score CBSA codes with the rest of the system.
 *
 * The v4 scores (score_type='propertyiq') use Redfin CBSA codes which differ
 * from the codes used by zillow/realtor/economic tables for ~20 metros.
 * This script updates the v4 scores to use the same codes as the legacy scores,
 * which are already consistent with all other tables.
 *
 * Usage: npx tsx scripts/update-cbsa-codes-2023.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "packages/backend/.env") });

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const DRY_RUN = process.argv.includes("--dry-run");

function metroKey(name: string): string {
  // "Washington-Arlington-Alexandria, DC-VA-MD-WV" → "washington|dc"
  // "Washington, DC metro area" → "washington|dc"
  const city = name.split(",")[0].split("-")[0].trim().toLowerCase();
  const state =
    (name
      .split(",")
      .slice(1)
      .join(",")
      .match(/([A-Z]{2})/) || [])[1] || "";
  return `${city}|${state.toLowerCase()}`;
}

async function paginate(
  table: string,
  select: string,
  filters: Record<string, string>,
) {
  const all: any[] = [];
  let offset = 0;
  while (true) {
    let q = supabase
      .from(table)
      .select(select)
      .range(offset, offset + 999);
    for (const [c, v] of Object.entries(filters)) q = q.eq(c, v);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

async function main() {
  console.log(`=== Align v4 CBSA codes ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  // Get distinct v4 (propertyiq) metro codes
  const v4Rows = await paginate(
    "propertyiq_scores_v2",
    "location_id, location_name",
    { geography: "metro", score_type: "propertyiq" },
  );
  const v4ById = new Map<string, string>();
  for (const r of v4Rows) v4ById.set(r.location_id, r.location_name);
  const v4ByKey = new Map<string, { id: string; name: string }>();
  for (const [id, name] of v4ById) v4ByKey.set(metroKey(name), { id, name });

  // Get distinct legacy (homeready) metro codes — these match the rest of the system
  const legacyRows = await paginate(
    "propertyiq_scores_v2",
    "location_id, location_name",
    { geography: "metro", score_type: "homeready" },
  );
  const legById = new Map<string, string>();
  for (const r of legacyRows) legById.set(r.location_id, r.location_name);
  // For cities with multiple codes, prefer the code NOT in v4 set (the "system" code)
  const legByKey = new Map<string, { id: string; name: string }>();
  for (const [id, name] of legById) {
    const key = metroKey(name);
    const existing = legByKey.get(key);
    if (!existing || v4ById.has(existing.id)) {
      legByKey.set(key, { id, name });
    }
  }

  console.log(`  v4 distinct metros: ${v4ById.size}`);
  console.log(`  Legacy distinct metros: ${legById.size}\n`);

  // Build crosswalk: v4 code → legacy/system code
  const updates: Array<{ v4Code: string; sysCode: string; name: string }> = [];
  for (const [key, v4] of v4ByKey) {
    const leg = legByKey.get(key);
    if (leg && leg.id !== v4.id) {
      updates.push({ v4Code: v4.id, sysCode: leg.id, name: v4.name });
    }
  }

  console.log(`Found ${updates.length} v4 codes to realign:\n`);
  console.log("  Redfin    System   Metro");
  console.log("  " + "-".repeat(60));
  for (const u of updates.sort((a, b) => a.v4Code.localeCompare(b.v4Code))) {
    console.log(
      `  ${u.v4Code}  ->  ${u.sysCode}    ${u.name.substring(0, 40)}`,
    );
  }

  if (updates.length === 0) {
    console.log("\nNothing to update.");
    return;
  }

  // Apply updates to propertyiq_scores_v2 (only v4 scores need fixing)
  console.log("\nUpdating propertyiq_scores_v2 (score_type=propertyiq)...\n");
  let ok = 0,
    errs = 0;
  for (const u of updates) {
    if (DRY_RUN) {
      ok++;
      continue;
    }
    const { error } = await supabase
      .from("propertyiq_scores_v2")
      .update({ location_id: u.sysCode })
      .eq("location_id", u.v4Code)
      .eq("geography", "metro")
      .eq("score_type", "propertyiq");
    if (error) {
      console.log(`  ERR ${u.v4Code}: ${error.message}`);
      errs++;
    } else {
      ok++;
    }
  }
  console.log(`  ${ok} codes updated, ${errs} errors`);
  console.log(
    `\n${DRY_RUN ? "DRY RUN complete. Re-run without --dry-run to apply." : "Done."}`,
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
