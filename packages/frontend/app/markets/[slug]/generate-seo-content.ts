import type { MetroSlugEntry } from "@/lib/data/metro-slugs";

/**
 * State-to-region mapping for content variation.
 * Each state maps to a Census-style region for contextual descriptions.
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

/** Regional economic context snippets — unique per region */
const REGIONAL_CONTEXT: Record<string, string> = {
  "New England":
    "New England's housing market is shaped by historic density, prestigious universities, and a mature healthcare and biotech economy. Markets here tend toward stability, with slower but steady appreciation driven by constrained supply and strong institutional demand.",
  "Mid-Atlantic":
    "The Mid-Atlantic corridor benefits from proximity to major financial centers and government institutions. Housing markets in this region balance urban density with suburban expansion, creating varied opportunities from walkable city neighborhoods to rapidly growing exurbs.",
  Midwest:
    "Midwestern housing markets are characterized by affordability and economic diversification. From manufacturing hubs undergoing tech-sector transitions to university towns with stable demand, the region offers value-oriented opportunities with lower entry costs than coastal markets.",
  "South Atlantic":
    "The South Atlantic region continues to attract domestic migration with its combination of job growth, favorable tax environments, and year-round climate. Markets range from rapidly appreciating tech corridors to established retirement destinations with strong rental demand.",
  Southeast:
    "Southeastern markets benefit from manufacturing investment, logistics infrastructure, and relative affordability compared to national averages. The region's population growth — driven by both domestic migration and natural increase — supports sustained housing demand across metro and suburban areas.",
  "South Central":
    "South Central housing markets are propelled by energy sector economics, corporate relocations, and rapid population growth. Texas metros in particular have seen explosive expansion, though affordability pressures are emerging in the fastest-growing areas.",
  "Mountain West":
    "Mountain West markets combine outdoor lifestyle appeal with booming tech and remote-work migration. Cities across Colorado, Utah, Arizona, and Nevada have experienced some of the nation's fastest appreciation, though rising interest rates have introduced new dynamics to these previously red-hot markets.",
  Pacific:
    "Pacific Coast housing markets feature the nation's highest price points alongside strong wage growth from technology, entertainment, and trade sectors. Supply constraints from geographic barriers and regulatory environments create persistent affordability challenges but also strong long-term appreciation potential.",
  Caribbean:
    "Puerto Rico's housing market presents unique opportunities with lower price points, tax incentives under Acts 20/22, and a distinct economic profile shaped by the island's relationship with the US mainland. Recent rebuilding efforts and migration patterns create evolving market dynamics.",
};

/** State-specific context for the largest states */
const STATE_CONTEXT: Record<string, string> = {
  TX: "Texas continues to be one of America's top relocation destinations, with no state income tax and a business-friendly regulatory environment driving corporate headquarters relocations and population growth.",
  CA: "California's housing market is defined by extreme supply-demand imbalance, with CEQA regulations and geographic constraints limiting new construction. Despite affordability challenges, strong wage growth in tech and entertainment sectors sustains prices.",
  FL: "Florida's zero state income tax, warm climate, and retirement appeal maintain strong population inflows. The state's insurance market dynamics and hurricane risk are important context for reading how individual Florida metros are positioned relative to the state.",
  NY: "New York's housing landscape spans from the nation's most expensive urban neighborhoods to affordable upstate markets with university-driven stability. The post-pandemic remote work shift has redistributed demand across the state.",
  GA: "Georgia's housing market is anchored by metro Atlanta's emergence as a major corporate and logistics hub. Film industry growth and port expansion in Savannah add economic diversification beyond traditional sectors.",
  NC: "North Carolina's Research Triangle and Charlotte financial corridor drive two distinct housing economies, with university and healthcare employment providing stability across smaller metro areas.",
  AZ: "Arizona's housing market experienced a dramatic boom-bust-recovery cycle, making it a useful proving ground for PropertyIQ's price-momentum and market-flow signals. The state's population growth from California migration continues to drive demand.",
  CO: "Colorado's housing market reflects the state's appeal to remote workers and outdoor enthusiasts. Denver's tech sector growth has pushed prices into new territory while mountain communities face their own supply challenges.",
  WA: "Washington state's housing market is heavily influenced by Seattle's tech economy, with Amazon, Microsoft, and Boeing employment driving both price appreciation and demand volatility as hiring cycles fluctuate.",
  TN: "Tennessee's no-income-tax status and central location have fueled Nashville's rise as a corporate relocation destination, while Memphis and Knoxville offer more affordable alternatives with their own economic drivers.",
  OH: "Ohio's housing market offers some of the Midwest's strongest value propositions, with affordable entry points and diversifying economies. Columbus leads state growth while Cleveland and Cincinnati undergo downtown revitalization.",
  PA: "Pennsylvania's housing market spans from Philadelphia's dense urban neighborhoods to Pittsburgh's tech-driven renaissance and rural communities in between, offering diverse investment profiles at various price points.",
};

/**
 * Generate opening paragraph variations based on metro name hash.
 * Uses a simple hash to deterministically select from templates.
 */
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
    `The ${name} metropolitan area represents a distinct segment of ${state}'s housing landscape. The PropertyIQ Score combines price momentum — how Zillow home values have trended over the past 3 and 12 months — with market-flow signals from Realtor.com that track how fast homes sell and how often sellers cut prices. The result is a single measure of how this market is positioned to outperform or lag its state over the next three years.`,
  (name: string, state: string) =>
    `Understanding the ${name} housing market requires looking beyond headline price figures. The PropertyIQ Score reads both sides of market strength: Zillow price momentum across 3- and 12-month windows, and Realtor.com flow signals — days on market and the share of listings with price cuts. Together they predict how this ${state} metro is set to perform relative to the rest of its state.`,
  (name: string, state: string) =>
    `Whether you're considering buying a home, investing in rental property, or weighing entry timing in the ${name} area, the PropertyIQ Score gives you a single, data-first read on relative market strength. It is validated against actual market outcomes from 2001 to 2023, with a positive score-to-return relationship in every validated year across ${state} and every other US state.`,
  (name: string, _state: string) =>
    `The ${name} metro area is one of roughly 935 US metropolitan markets that PropertyIQ scores each month. A single PropertyIQ Score blends Zillow price momentum with Realtor.com market-flow signals to estimate 3-year excess appreciation versus the market's state — showing not just where prices stand today, but how the market is positioned relative to its peers.`,
  (name: string, state: string) =>
    `PropertyIQ tracks the ${name} housing market through two complementary lenses: price momentum from Zillow home-value trends over 3 and 12 months, and demand pressure from how quickly homes sell and how often sellers cut prices, drawn from Realtor.com. The PropertyIQ Score distills these into one number that predicts how this ${state} market is set to perform against its state benchmark.`,
];

const MIDDLE_TEMPLATES = [
  (name: string) =>
    `The PropertyIQ Score for the ${name} market measures excess return versus the state, not raw price growth. A market can rise in absolute terms yet score low if it lags its state, and a market in a flat state can score high by holding up better than its peers. The score reads price momentum (Zillow) alongside how quickly homes sell and how often sellers cut prices (Realtor.com), giving one view of relative market strength rather than a single headline metric.`,
  (name: string) =>
    `For the ${name} market, PropertyIQ calculates a single score updated monthly. It predicts 3-year appreciation in excess of the market's state. Across the validation history, metro markets in the top score band have outperformed their state by roughly 1.7 percentage points more per year than bottom-band markets. The score combines Zillow price momentum with Realtor.com flow signals — days on market and the share of listings with price cuts — that flag cooling before it shows up in prices.`,
  (name: string) =>
    `Each month, PropertyIQ updates its score for ${name} using the latest Zillow home-value trends and Realtor.com listing data. Zillow supplies 3- and 12-month price momentum; Realtor.com supplies median days on market and the share of listings with price cuts. Combined into one PropertyIQ Score, these inputs predict how the market is positioned to perform relative to its state — a relative read that no single price metric can offer.`,
];

const CLOSING_TEMPLATES = [
  (name: string) =>
    `Explore the interactive map to see how ${name} compares to neighboring metros, or view the full market dashboard for detailed analytics including time-series trends, score breakdowns, and AI-generated market reports.`,
  (name: string) =>
    `Use PropertyIQ's interactive analytics to compare ${name} against any other US metro on its PropertyIQ Score and underlying metrics. Generate a free AI market report, explore historical trends on the graphs page, or see how this market ranks on the scores dashboard.`,
  (name: string) =>
    `View ${name}'s complete market profile including historical price trends, score history, and AI-generated analysis. Compare this market against any other US metro to find the best opportunities for your investment strategy.`,
];

export interface MarketSeoContent {
  opening: string;
  regional: string;
  stateContext: string | null;
  middle: string;
  closing: string;
}

/**
 * Generate unique, server-rendered SEO content for a market page.
 * Content is deterministic (same metro always produces same content)
 * but unique across markets due to name, state, and region variation.
 */
export function generateMarketSeoContent(
  metro: MetroSlugEntry,
): MarketSeoContent {
  const hash = hashString(metro.cbsaCode + metro.slug);
  const region = STATE_REGIONS[metro.state] || "United States";
  const regionContext = REGIONAL_CONTEXT[region] || REGIONAL_CONTEXT["Midwest"];

  const openingIdx = hash % OPENING_TEMPLATES.length;
  const middleIdx = (hash >> 3) % MIDDLE_TEMPLATES.length;
  const closingIdx = (hash >> 6) % CLOSING_TEMPLATES.length;

  return {
    opening: OPENING_TEMPLATES[openingIdx](metro.shortName, metro.state),
    regional: regionContext,
    stateContext: STATE_CONTEXT[metro.state] || null,
    middle: MIDDLE_TEMPLATES[middleIdx](metro.shortName),
    closing: CLOSING_TEMPLATES[closingIdx](metro.shortName),
  };
}
