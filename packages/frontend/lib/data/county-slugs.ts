export interface CountySlugEntry {
  fips: string; // 5-digit county FIPS, e.g., "17031"
  slug: string; // URL slug, e.g., "cook-county-il"
  name: string; // Full: "Cook County"
  shortName: string; // Display: "Cook County, IL"
  state: string; // "IL"
  cbsaCode: string | null; // Parent metro CBSA code, null if unmetropolitan
}

/**
 * Generate a URL-friendly slug from a county name and state.
 * "Cook" + "IL" → "cook-county-il"
 */
export function generateCountySlug(countyName: string, state: string): string {
  const base = `${countyName} county ${state}`;
  return base
    .toLowerCase()
    .replace(/[,.'()/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
