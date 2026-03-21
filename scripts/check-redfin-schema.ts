import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(__dirname, "../packages/backend/.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  "redfin_metro",
  "redfin_county",
  "redfin_zip",
  "zillow_metro",
  "zillow_county",
  "zillow_zip",
  "census_metro",
  "census_county",
  "census_zip",
  "economic_metro",
  "economic_county",
  "geography_crosswalk",
];

async function main() {
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.log(`\n=== ${table} === ERROR: ${error.message}`);
      continue;
    }
    if (!data || data.length === 0) {
      console.log(`\n=== ${table} === (no rows)`);
      continue;
    }
    const columns = Object.keys(data[0]);
    console.log(`\n=== ${table} === (${columns.length} columns)`);
    console.log(columns.join(", "));
  }
}

main().catch(console.error);
