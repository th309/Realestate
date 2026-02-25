export interface MetroSlugEntry {
  cbsaCode: string;
  slug: string;
  name: string; // Full: "Austin-Round Rock-Georgetown, TX"
  shortName: string; // Display: "Austin, TX"
  state: string; // "TX"
}

/**
 * Generate a URL-friendly slug from a metro name.
 * "Austin-Round Rock-Georgetown, TX" → "austin-round-rock-georgetown-tx"
 */
export function generateMetroSlug(metroName: string): string {
  return metroName
    .toLowerCase()
    .replace(/[,.'()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract a short display name from a full metro name.
 * "Austin-Round Rock-Georgetown, TX" → "Austin, TX"
 */
export function getMetroShortName(fullName: string): string {
  const commaIndex = fullName.indexOf(',');
  if (commaIndex === -1) return fullName;

  const cityPart = fullName.substring(0, commaIndex);
  const statePart = fullName.substring(commaIndex + 1).trim();

  const firstCity = cityPart.split('-')[0].trim();
  const firstState = statePart.split('-')[0].trim();

  return `${firstCity}, ${firstState}`;
}

/**
 * Extract state abbreviation from metro name.
 * "Austin-Round Rock-Georgetown, TX" → "TX"
 */
export function getMetroState(fullName: string): string {
  const commaIndex = fullName.indexOf(',');
  if (commaIndex === -1) return '';
  const statePart = fullName.substring(commaIndex + 1).trim();
  return statePart.split('-')[0].trim();
}
