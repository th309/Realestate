// Run with: npx tsx scripts/generate-county-slugs.ts
//
// Fetches all counties from the backend API and the geography_crosswalk table
// to generate packages/frontend/lib/data/county-slug-data.json.
// The TypeScript wrapper (county-slug-data.ts) imports this JSON and exports typed maps.

const API_URL = process.env.API_URL || "http://localhost:3001";

// Use Supabase directly to get the full crosswalk data including cbsa_code
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface CountyRow {
  fips: string;
  name: string;
  state: string;
}

interface CrosswalkRow {
  county_fips: string;
  county_name: string;
  state_abbrev: string;
  cbsa_code: string | null;
}

function generateSlug(countyName: string, state: string): string {
  const base = `${countyName} county ${state}`;
  return base
    .toLowerCase()
    .replace(/[,.'()/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  // Approach 1: Try backend API
  const endpoint = `${API_URL}/api/markets/counties`;
  console.log(`Fetching counties from ${endpoint}...`);

  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`API returned ${res.status}: ${await res.text()}`);
  }

  const counties: CountyRow[] = await res.json();
  console.log(`Fetched ${counties.length} counties.`);

  // Try to get crosswalk data for CBSA codes
  let crosswalkMap = new Map<string, string | null>();
  if (SUPABASE_URL && SUPABASE_KEY) {
    console.log("Fetching crosswalk data for CBSA codes...");
    const crosswalkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/geography_crosswalk?select=county_fips,cbsa_code`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      },
    );
    if (crosswalkRes.ok) {
      const crosswalk: { county_fips: string; cbsa_code: string | null }[] =
        await crosswalkRes.json();
      for (const row of crosswalk) {
        crosswalkMap.set(row.county_fips, row.cbsa_code);
      }
      console.log(`Loaded ${crosswalkMap.size} crosswalk entries.`);
    } else {
      console.warn("Could not fetch crosswalk data, CBSA codes will be null.");
    }
  }

  const entries = counties.map((c) => ({
    fips: c.fips,
    slug: generateSlug(c.name, c.state),
    name: `${c.name} County`,
    shortName: `${c.name} County, ${c.state}`,
    state: c.state,
    cbsaCode: crosswalkMap.get(c.fips) || null,
  }));

  // Check for duplicate slugs
  const slugMap = new Map<string, string>();
  let duplicateCount = 0;
  for (const entry of entries) {
    if (slugMap.has(entry.slug)) {
      console.warn(
        `WARNING: Duplicate slug "${entry.slug}" -- ${entry.shortName} vs ${slugMap.get(entry.slug)}`,
      );
      duplicateCount++;
    }
    slugMap.set(entry.slug, entry.shortName);
  }

  if (duplicateCount > 0) {
    console.warn(
      `\nFound ${duplicateCount} duplicate slug(s). Review the output for conflicts.`,
    );
  }

  const fs = await import("fs");
  const path = await import("path");
  const jsonPath = path.join(
    "packages",
    "frontend",
    "lib",
    "data",
    "county-slug-data.json",
  );
  fs.writeFileSync(jsonPath, JSON.stringify(entries, null, 2) + "\n");
  console.log(`\nWritten to ${jsonPath}`);
  console.log(`Total entries: ${entries.length}`);
  console.log(`Unique slugs: ${slugMap.size}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
