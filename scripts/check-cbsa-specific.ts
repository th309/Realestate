import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), "packages/backend/.env") });
const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

async function check(city: string) {
  // Get one row per score_type by querying each separately
  console.log(`\n${city}:`);
  for (const st of ["propertyiq", "homeready"]) {
    const { data } = await sb
      .from("propertyiq_scores_v2")
      .select("score_type, location_id, location_name")
      .eq("geography", "metro")
      .eq("score_type", st)
      .ilike("location_name", `${city}%`)
      .order("score_date", { ascending: false })
      .limit(3);
    // Dedupe by location_id
    const seen = new Set<string>();
    for (const r of data || []) {
      if (seen.has(r.location_id)) continue;
      seen.add(r.location_id);
      console.log(
        `  ${r.score_type.padEnd(15)} ${r.location_id}  ${r.location_name}`,
      );
    }
  }
}

async function main() {
  for (const city of [
    "Los Angeles",
    "Chicago",
    "Miami",
    "Dallas",
    "San Francisco",
  ]) {
    await check(city);
  }
}
main();
