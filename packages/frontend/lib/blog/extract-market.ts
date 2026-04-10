/**
 * Extract city name and state from blog post tags.
 * Returns null if no city can be identified (e.g., methodology posts).
 */

const GENERIC_TAGS = new Set([
  "2026",
  "2025",
  "market-analysis",
  "real-estate-market",
  "investment",
  "methodology",
  "news",
  "sun-belt",
  "midwest",
  "northeast",
  "southeast",
  "market-recovery",
  "market-comparison",
  "state-roundup",
  "scoring",
  "data-science",
  "real-estate-analytics",
  "demand-signal",
  "affordable",
  "rental-market",
  "PropertyIQ Score",
  "housing-market",
]);

const US_STATES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new-hampshire": "NH",
  "new-jersey": "NJ",
  "new-mexico": "NM",
  "new-york": "NY",
  "north-carolina": "NC",
  "north-dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode-island": "RI",
  "south-carolina": "SC",
  "south-dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west-virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

export interface ExtractedMarket {
  city: string; // Title-cased: "Atlanta"
  state: string; // Full name: "Georgia"
  stateAbbrev: string; // "GA"
  slug: string; // "atlanta-ga" for /markets/ links
}

export function extractMarketFromTags(tags: string[]): ExtractedMarket | null {
  if (!tags || tags.length === 0) return null;

  const candidateTags = tags.filter((t) => !GENERIC_TAGS.has(t));

  let stateTag: string | null = null;
  let stateAbbrev: string | null = null;
  let cityTag: string | null = null;

  for (const tag of candidateTags) {
    const lower = tag.toLowerCase();
    if (US_STATES[lower] && !stateTag) {
      stateTag = tag;
      stateAbbrev = US_STATES[lower];
    } else if (!cityTag) {
      cityTag = tag;
    }
  }

  if (!cityTag) return null;

  // Title-case the city: "atlanta" -> "Atlanta", "san-antonio" -> "San Antonio"
  const city = cityTag
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const state = stateTag
    ? stateTag
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : "";

  const abbrev = stateAbbrev || "";
  const slug = abbrev ? `${cityTag}-${abbrev.toLowerCase()}` : cityTag;

  return { city, state, stateAbbrev: abbrev, slug };
}
