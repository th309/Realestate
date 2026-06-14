import type { ZipSlugEntry } from "@/lib/data/zip-slugs";

/**
 * State-to-region mapping for content variation.
 */
const STATE_REGIONS: Record<string, string> = {
  CT: "New England",
  ME: "New England",
  MA: "New England",
  NH: "New England",
  RI: "New England",
  VT: "New England",
  NJ: "Mid-Atlantic",
  NY: "Mid-Atlantic",
  PA: "Mid-Atlantic",
  IL: "Midwest",
  IN: "Midwest",
  MI: "Midwest",
  OH: "Midwest",
  WI: "Midwest",
  IA: "Midwest",
  KS: "Midwest",
  MN: "Midwest",
  MO: "Midwest",
  NE: "Midwest",
  ND: "Midwest",
  SD: "Midwest",
  DE: "South Atlantic",
  FL: "South Atlantic",
  GA: "South Atlantic",
  MD: "South Atlantic",
  NC: "South Atlantic",
  SC: "South Atlantic",
  VA: "South Atlantic",
  DC: "South Atlantic",
  WV: "South Atlantic",
  AL: "Southeast",
  KY: "Southeast",
  MS: "Southeast",
  TN: "Southeast",
  AR: "South Central",
  LA: "South Central",
  OK: "South Central",
  TX: "South Central",
  AZ: "Mountain West",
  CO: "Mountain West",
  ID: "Mountain West",
  MT: "Mountain West",
  NV: "Mountain West",
  NM: "Mountain West",
  UT: "Mountain West",
  WY: "Mountain West",
  AK: "Pacific",
  CA: "Pacific",
  HI: "Pacific",
  OR: "Pacific",
  WA: "Pacific",
  PR: "Caribbean",
  GU: "Pacific",
};

const REGIONAL_CONTEXT: Record<string, string> = {
  "New England":
    "ZIP-level analysis in New England uncovers hyperlocal affordability pockets that county and metro averages obscure. PropertyIQ scores each ZIP code to reveal where demand signals within individual neighborhoods suggest outperformance relative to the state benchmark, giving investors granularity that broader geographic analyses miss.",
  "Mid-Atlantic":
    "Mid-Atlantic ZIP codes range from dense urban blocks to suburban cul-de-sacs, each with distinct demand dynamics. PropertyIQ's ZIP-level scores help investors and agents identify which specific neighborhoods within metro areas offer the strongest demand-to-supply ratios and near-term appreciation potential.",
  Midwest:
    "Midwestern ZIP codes frequently offer entry prices far below national medians, but performance varies dramatically even within the same city. PropertyIQ scores individual ZIP codes to identify which neighborhoods show the demand signals — fast sales, rising price momentum, few price cuts — that predict near-term appreciation.",
  "South Atlantic":
    "South Atlantic ZIP codes benefit from sustained migration inflows, but hyperlocal performance varies widely between neighborhoods. PropertyIQ's ZIP-level scoring helps distinguish between ZIP codes riding a temporary wave and those with durable, block-by-block demand fundamentals.",
  Southeast:
    "Southeastern ZIP codes combine affordability with economic diversification across manufacturing, logistics, and services sectors. ZIP-level PropertyIQ scores reveal which specific neighborhoods within this fast-growing region are positioned to outperform their state peers in home price appreciation.",
  "South Central":
    "South Central ZIP codes span energy-driven rural communities and rapidly urbanizing suburban subdivisions. PropertyIQ's ZIP-level scores identify demand hotspots within Texas, Oklahoma, Louisiana, and Arkansas at a neighborhood granularity that metro and county data cannot provide.",
  "Mountain West":
    "Mountain West ZIP codes experienced explosive growth through 2022, with dramatic variation in post-boom performance. PropertyIQ's ZIP-level scores separate neighborhoods with sustained demand from those experiencing corrections, providing the hyperlocal precision investors need in volatile markets.",
  Pacific:
    "Pacific Coast ZIP codes feature extreme price variation from coastal enclaves to inland communities, often within the same city. PropertyIQ scores at the ZIP level reveal neighborhood-specific opportunities that are completely masked when analyzing broader metro or county areas.",
  Caribbean:
    "Puerto Rico's ZIP codes offer distinct investment profiles shaped by Act 60 incentives, rebuilding efforts, and neighborhood-level migration patterns. PropertyIQ's ZIP-level scores provide data-driven comparison across these hyperlocal markets where block-by-block conditions vary significantly.",
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

const OPENING_TEMPLATES = [
  (shortName: string, zip: string, state: string) =>
    `${shortName} is one of nearly 20,000 U.S. ZIP codes that PropertyIQ analyzes with AI-powered demand signal scoring. ZIP-level analysis provides the most hyperlocal view of housing market dynamics available, measuring how demand within ${zip} compares to the ${state} state average and identifying outperformance potential before it appears in price data.`,
  (shortName: string, zip: string, state: string) =>
    `PropertyIQ provides ZIP-code-level market intelligence for ${shortName} — going deeper than metro or county averages to reveal neighborhood-specific demand dynamics. By tracking Zillow home-value momentum alongside Realtor.com market-flow signals — median days on market and the share of listings with price cuts — specifically within ZIP code ${zip}, PropertyIQ predicts which micro-markets within ${state} are positioned to outperform.`,
  (shortName: string, zip: string, state: string) =>
    `Understanding the housing market in ZIP code ${zip} requires hyperlocal data that metro and county analyses simply cannot provide. PropertyIQ's demand signal scoring — validated across more than two decades of housing data (2001–2023) — extends to ZIP-code granularity for ${shortName}, giving investors and agents a competitive edge in ${state}'s most specific market segments.`,
  (shortName: string, zip: string, state: string) =>
    `The ${shortName} housing market operates at a level of granularity that broader geographic analyses miss entirely. PropertyIQ's ZIP-level scoring for ${zip} captures neighborhood-specific demand patterns within ${state}, revealing micro-market trends that metro and county data average away. This hyperlocal intelligence is critical for making precise investment and homebuying decisions.`,
];

const MIDDLE_TEMPLATES = [
  (shortName: string) =>
    `The PropertyIQ Score for ${shortName} is built from four inputs measured at the ZIP-code level: Zillow home-value momentum over twelve months, Zillow home-value momentum over three months, the median days listings spend on the market (Realtor.com), and the share of listings with a price cut (Realtor.com). The score runs on a 1 to 99 scale computed across all ZIP codes nationally and calibrated so 50 equals the state average, so a score above 50 points to a micro-market positioned to outperform its state.`,
  (shortName: string) =>
    `For ${shortName}, PropertyIQ updates a hyperlocal score each month from four signals: twelve-month and three-month Zillow home-value momentum, Realtor.com median days on market, and the Realtor.com share of price-reduced listings. The score is computed across all ZIP codes nationally and calibrated so 50 equals the state average, so a value above 50 means this ZIP's demand dynamics read stronger than its state. ZIP-level analysis captures neighborhood variation that county and metro scores smooth over.`,
  (shortName: string) =>
    `PropertyIQ distills four housing signals into a single 1 to 99 score for ${shortName} at the most granular geography available: Zillow twelve-month and three-month home-value momentum, Realtor.com median days on market, and the Realtor.com price-reduced share. It is not a generic market-health grade; it is a validated predictor of which ZIP codes are positioned to outperform their state. The ZIP-level view often tells a different story than the broader county or metro score.`,
];

const CLOSING_TEMPLATES = [
  (shortName: string) =>
    `Explore ${shortName}'s full market profile including ZIP-level score trends, home value data, and comparisons with neighboring ZIP codes. Use the interactive map to visualize demand signals across the area and identify hyperlocal investment opportunities.`,
  (shortName: string) =>
    `View ${shortName}'s PropertyIQ Score and compare it against other ZIP codes in the state. Generate a free AI market report for this ZIP code or explore historical trends on the interactive map to understand how this micro-market has evolved.`,
  (shortName: string) =>
    `Use PropertyIQ's analytics tools to evaluate ${shortName} alongside other ZIP codes and investment opportunities. The interactive map, ZIP-level rankings, and AI-generated reports provide the hyperlocal market intelligence that separates informed decisions from guesswork.`,
];

export interface ZipSeoContent {
  opening: string;
  regional: string;
  middle: string;
  closing: string;
}

export function generateZipSeoContent(zip: ZipSlugEntry): ZipSeoContent {
  const hash = hashString(zip.zip + zip.slug);
  const region = STATE_REGIONS[zip.state] || "United States";
  const regionContext = REGIONAL_CONTEXT[region] || REGIONAL_CONTEXT["Midwest"];

  const openingIdx = hash % OPENING_TEMPLATES.length;
  const middleIdx = (hash >> 3) % MIDDLE_TEMPLATES.length;
  const closingIdx = (hash >> 6) % CLOSING_TEMPLATES.length;

  return {
    opening: OPENING_TEMPLATES[openingIdx](zip.shortName, zip.zip, zip.state),
    regional: regionContext,
    middle: MIDDLE_TEMPLATES[middleIdx](zip.shortName),
    closing: CLOSING_TEMPLATES[closingIdx](zip.shortName),
  };
}
