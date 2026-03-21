const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "packages/backend/.env" });
const s = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);
async function run() {
  let r;
  r = await s.from("redfin_county").select("fips_code, county_name").limit(1);
  console.log("redfin_county fips_code:", JSON.stringify(r.data?.[0]));
  r = await s.from("redfin_county").select("county_fips").limit(1);
  console.log(
    "redfin_county county_fips?",
    r.error ? "NO: " + r.error.message : "YES",
  );
  r = await s.from("redfin_zip").select("zip_code").limit(1);
  console.log("redfin_zip zip_code:", JSON.stringify(r.data?.[0]));
  r = await s.from("redfin_zip").select("postal_code").limit(1);
  console.log(
    "redfin_zip postal_code?",
    r.error ? "NO: " + r.error.message : "YES",
  );
  r = await s.from("zillow_county").select("fips_code, region_name").limit(1);
  console.log("zillow_county fips_code:", JSON.stringify(r.data?.[0]));
  r = await s.from("zillow_county").select("county_fips").limit(1);
  console.log(
    "zillow_county county_fips?",
    r.error ? "NO: " + r.error.message : "YES",
  );
  r = await s.from("zillow_zip").select("region_name, county_fips").limit(2);
  console.log("zillow_zip samples:", JSON.stringify(r.data));
  r = await s.from("zillow_zip").select("postal_code").limit(1);
  console.log(
    "zillow_zip postal_code?",
    r.error ? "NO: " + r.error.message : "YES: " + JSON.stringify(r.data),
  );
  r = await s.from("zillow_zip").select("zip_code").limit(1);
  console.log(
    "zillow_zip zip_code?",
    r.error ? "NO: " + r.error.message : "YES: " + JSON.stringify(r.data),
  );
}
run().then(() => process.exit(0));
