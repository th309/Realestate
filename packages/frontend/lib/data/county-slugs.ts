export interface CountySlugEntry {
  fips: string; // 5-digit county FIPS, e.g., "17031"
  slug: string; // URL slug, e.g., "cook-county-il"
  name: string; // Full: "Cook County" (or "Richmond City" for an independent city)
  shortName: string; // Display: "Cook County, IL"
  state: string; // "IL"
  cbsaCode: string | null; // Parent metro CBSA code, null if unmetropolitan
  isCity: boolean; // True for an independent city (Census county-equivalent); see scripts/lib/independent-cities.ts
}
