import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "packages/backend/.env") });
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  // Count rows per score_type for metros
  for (const t of ["propertyiq", "homeready", "investoredge", "markethealth"]) {
    const { count, error } = await sb
      .from("propertyiq_scores_v2")
      .select("*", { count: "exact", head: true })
      .eq("geography", "metro")
      .eq("score_type", t);
    console.log(`${t}: ${count ?? "error"} rows ${error ? error.message : ""}`);
  }

  // Get Washington rows
  const { data } = await sb
    .from("propertyiq_scores_v2")
    .select("score_type, location_id, location_name, score_date")
    .eq("geography", "metro")
    .ilike("location_name", "%ashington%")
    .order("score_date", { ascending: false })
    .limit(10);

  console.log("\nWashington rows:");
  for (const r of data || []) {
    console.log(`  ${r.score_type.padEnd(15)} id=${r.location_id} name="${r.location_name}" date=${r.score_date}`);
  }
}
main();
