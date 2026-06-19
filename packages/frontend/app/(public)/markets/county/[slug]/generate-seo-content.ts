import type { CountySlugEntry } from "@/lib/data/county-slugs";
import type { MarketStatsData } from "@/lib/data";
import { buildMarketDataSummary } from "@/lib/seo/market-metadata";

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
    "County-level analysis in New England reveals pockets of affordability amid some of the nation's highest price points. PropertyIQ scores each county to identify where demand signals suggest outperformance relative to the state benchmark.",
  "Mid-Atlantic":
    "Mid-Atlantic counties range from dense urban centers to exurban growth corridors. PropertyIQ's county scores help investors pinpoint which specific counties within major metro areas offer the strongest demand-to-supply dynamics.",
  Midwest:
    "Midwestern counties often offer entry prices well below national medians. PropertyIQ scores identify which counties show demand signals — fast sales, rising price momentum, and few price cuts — that predict near-term appreciation.",
  "South Atlantic":
    "South Atlantic counties benefit from sustained migration inflows and job growth. PropertyIQ scores help distinguish between counties riding a temporary wave and those with durable demand fundamentals.",
  Southeast:
    "Southeastern counties combine affordability with economic diversification from manufacturing and logistics. County-level PropertyIQ scores reveal which specific areas within this fast-growing region are positioned to outperform.",
  "South Central":
    "South Central counties span energy-driven economies and rapidly urbanizing suburbs. PropertyIQ county scores identify demand hotspots within Texas, Oklahoma, Louisiana, and Arkansas at a granularity that metro-level data misses.",
  "Mountain West":
    "Mountain West counties saw explosive growth through 2022, with significant variation in performance since. PropertyIQ county scores help separate markets with sustained demand from those experiencing post-boom corrections.",
  Pacific:
    "Pacific Coast counties feature extreme price variation from coastal to inland areas. PropertyIQ scores at the county level reveal opportunities that get masked when analyzing entire metro statistical areas.",
  Caribbean:
    "Puerto Rico's municipios (county equivalents) offer distinct investment profiles shaped by Act 60 incentives, rebuilding efforts, and migration patterns. PropertyIQ scores provide data-driven comparison across these markets.",
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
  (name: string, state: string) =>
    `${name}, ${state} is one of over 3,100 U.S. counties that PropertyIQ analyzes with AI-powered demand signal scoring. The PropertyIQ Score for this county measures how local housing demand compares to the state average, helping investors and homebuyers identify outperformance potential before it shows up in price data.`,
  (name: string, state: string) =>
    `PropertyIQ provides county-level market intelligence for ${name}, ${state} — going deeper than metro-area averages to reveal local demand dynamics. By tracking Zillow home-value momentum alongside Realtor.com market-flow signals — median days on market and the share of listings with price cuts — at the county level, PropertyIQ predicts which markets within ${state} are positioned to outperform.`,
  (name: string, state: string) =>
    `Understanding the ${name}, ${state} housing market at the county level reveals patterns invisible in metro-wide data. PropertyIQ's demand signal scoring — validated across more than two decades of housing data (2001–2023) — now extends to county-level granularity, giving investors and agents a competitive edge in ${state}.`,
];

const MIDDLE_TEMPLATES = [
  (name: string) =>
    `The PropertyIQ Score for ${name} blends four proven demand indicators. When home values are gaining momentum, homes sell quickly, and few sellers cut prices, the score rises — signaling a market positioned to outperform its state. Historically, top-scored markets delivered significantly higher 3-year excess returns than bottom-scored markets.`,
  (name: string) =>
    `For ${name}, PropertyIQ calculates a demand signal score updated monthly using the latest housing data. A score above 50 means this county's demand dynamics are stronger than the state average. Scores in the 80+ range have historically corresponded with meaningful outperformance in home price appreciation.`,
  (name: string) =>
    `PropertyIQ's county-level score for ${name} distills three housing metrics into a single 1-99 number. This isn't a generic market health grade — it's a validated predictor of which counties within a state will see the strongest home price growth over the next one to three years.`,
];

const CLOSING_TEMPLATES = [
  (name: string) =>
    `Explore ${name}'s full market profile including score trends, home value data, and comparisons with neighboring counties. Use the interactive map to visualize demand signals across the region.`,
  (name: string) =>
    `View ${name}'s PropertyIQ Score and compare it against other counties in the state. Generate a free AI market report or explore historical trends on the interactive map.`,
  (name: string) =>
    `Use PropertyIQ's analytics tools to evaluate ${name} alongside other investment opportunities. The interactive map, county rankings, and AI-generated reports provide comprehensive market intelligence at the county level.`,
];

export interface CountySeoContent {
  /** Real per-geo numbers in prose — the data-distinct lead paragraph. */
  dataSummary: string | null;
  opening: string;
  regional: string;
  middle: string;
  closing: string;
}

export function generateCountySeoContent(
  county: CountySlugEntry,
  stats: MarketStatsData | null = null,
): CountySeoContent {
  const hash = hashString(county.fips + county.slug);
  const region = STATE_REGIONS[county.state] || "United States";
  const regionContext = REGIONAL_CONTEXT[region] || REGIONAL_CONTEXT["Midwest"];

  const openingIdx = hash % OPENING_TEMPLATES.length;
  const middleIdx = (hash >> 3) % MIDDLE_TEMPLATES.length;
  const closingIdx = (hash >> 6) % CLOSING_TEMPLATES.length;

  return {
    dataSummary: buildMarketDataSummary(county.shortName, stats),
    opening: OPENING_TEMPLATES[openingIdx](county.name, county.state),
    regional: regionContext,
    middle: MIDDLE_TEMPLATES[middleIdx](county.shortName),
    closing: CLOSING_TEMPLATES[closingIdx](county.shortName),
  };
}
