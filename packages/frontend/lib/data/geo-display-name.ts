/**
 * Canonical display formatting for geographic names and US state abbreviations.
 *
 * Some pipeline-built sources (notably ZIP rows in `propertyiq_scores_v2` and
 * `screener_snapshot`) store names lowercase ("frederick, md"), while metros and
 * counties — and the canonical `geographies` table — are already proper-cased.
 * Rendering must look right regardless of which source a value came from, so all
 * geo-name display flows through these helpers.
 *
 * Design choice — we capitalize the first letter of each word segment but DO NOT
 * force the remainder of a word to lowercase. Force-lowercasing is what corrupts
 * deliberately mixed-case names: "DeKalb County" -> "Dekalb County" and
 * "Winston-Salem" -> "Winston-salem". By only adding capitalization at word
 * boundaries we fix lowercase source data ("frederick" -> "Frederick") while
 * passing already-correct names through untouched.
 */

/**
 * Title-case a bare location name (no state component).
 * "frederick" -> "Frederick", "winston-salem" -> "Winston-Salem".
 * Already-correct names ("DeKalb County", "St. Louis") are preserved.
 */
export function titleCaseLocationName(name: string): string {
  if (!name) return name;
  // \b[a-z] matches a lowercase letter at a word boundary: the start of the
  // string, or immediately after a space, hyphen, slash, or period. We never
  // touch letters that are not at a boundary, so interior caps (the "K" in
  // "DeKalb") survive.
  return name.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

/**
 * Format a combined "City, State" display string: title-case the city and
 * uppercase the state abbreviation(s). Handles multi-state metros
 * ("washington-arlington-alexandria, dc-va-md-wv" -> "Washington-Arlington-Alexandria, DC-VA-MD-WV"),
 * a missing state (bare city), and empty input.
 *
 * Empty / nullish input returns "" so callers can apply their own fallback
 * (e.g. the ZIP code when a name has not been backfilled yet).
 */
export function formatGeoDisplayName(name: string | null | undefined): string {
  if (!name) return "";
  const trimmed = name.trim();
  // Split on the LAST comma so a city containing a comma still keeps its state
  // segment intact.
  const lastComma = trimmed.lastIndexOf(",");
  if (lastComma === -1) return titleCaseLocationName(trimmed);

  const city = titleCaseLocationName(trimmed.slice(0, lastComma).trim());
  const state = trimmed
    .slice(lastComma + 1)
    .trim()
    .toUpperCase();
  return state ? `${city}, ${state}` : city;
}
