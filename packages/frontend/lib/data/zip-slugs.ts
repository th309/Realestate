export interface ZipSlugEntry {
  zip: string; // 5-digit ZIP, e.g., "90210"
  slug: string; // URL slug, e.g., "90210-beverly-hills-ca"
  name: string; // Display: "90210 (Beverly Hills)"
  shortName: string; // "90210, Beverly Hills, CA"
  state: string; // "CA"
  countyFips: string | null; // Parent county FIPS code, null if unknown
  cbsaCode: string | null; // Parent metro CBSA code, null if unmetropolitan
}

/**
 * Generate a URL-friendly slug from a ZIP code, city name, and state.
 * "90210" + "Beverly Hills" + "CA" -> "90210-beverly-hills-ca"
 */
export function generateZipSlug(
  zip: string,
  cityName: string,
  state: string,
): string {
  const base = `${zip} ${cityName} ${state}`;
  return base
    .toLowerCase()
    .replace(/[,.'()/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
