/**
 * Build YouTube Shorts description hashtags + tags for a published run.
 *
 * Inputs: the resolved market (canonical_name like "Cleveland-Elyria, OH"),
 * optional PropertyIQ score, and the run id (used as a seed so different
 * runs pick different rotating hashtags deterministically — the YouTube
 * algorithm seems to downrank repetitive tag lists across a channel).
 *
 * Output:
 *   - `hashtags`: for the end of the description; the first 3 show as
 *     clickable chips above the video title. Target ~12 hashtags total.
 *   - `tags`: YouTube API `snippet.tags[]` — SEO keywords (no `#` prefix).
 *     Max ~40 entries; keep well under the 500-char total limit.
 */

export interface BuildYouTubeTagsInput {
  runId: string;
  resolvedMarket: { canonical_name: string };
  score?: number;
}

export interface YouTubeTagsOutput {
  hashtags: string[];
  tags: string[];
}

const CORE_HASHTAGS = ['#Shorts', '#PropertyIQ', '#RealEstate'];

/**
 * Investing pool — 20 options; 6 get selected per run via runId seed.
 * Curated for real-estate-investor audience discoverability; avoids
 * low-signal generic tags like `#Money` that attract noise.
 */
const INVESTING_POOL = [
  '#RealEstateInvesting',
  '#REInvestor',
  '#REIMarket',
  '#RealEstateMarket',
  '#CashFlowInvesting',
  '#BuyAndHold',
  '#RentalProperty',
  '#PassiveIncome',
  '#WealthBuilding',
  '#HousingMarket',
  '#HousingTrends',
  '#PropertyInvesting',
  '#InvestorInsights',
  '#MarketIntel',
  '#MarketData',
  '#REIStrategy',
  '#RealEstateData',
  '#SmartMoney',
  '#WhereToInvest',
  '#MarketAnalysis',
];

const INVESTING_POOL_PICK = 6;

/**
 * Common US state abbreviation → full name. Used to expand two-letter
 * state codes ("OH" → "Ohio") into hashtag-friendly words. Fallback to
 * the raw code if a state isn't mapped — means a hashtag like `#CARealEstate`
 * instead of `#CaliforniaRealEstate`, still useful but less natural.
 */
const STATE_FULL_NAME: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'NewHampshire',
  NJ: 'NewJersey',
  NM: 'NewMexico',
  NY: 'NewYork',
  NC: 'NorthCarolina',
  ND: 'NorthDakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'RhodeIsland',
  SC: 'SouthCarolina',
  SD: 'SouthDakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'WestVirginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'DC',
};

/**
 * Parse a metro canonical_name like "Chicago-Naperville-Elgin, IL-IN"
 * into its primary city (first hyphenated segment before the comma) and
 * primary state code (first segment after the comma). Returns empty
 * strings when parsing fails so the caller degrades gracefully rather
 * than throwing mid-publish.
 */
export function parseCanonicalName(canonical: string): {
  primaryCity: string;
  primaryState: string;
} {
  const parts = canonical.split(',').map((s) => s.trim());
  if (parts.length < 2) return { primaryCity: '', primaryState: '' };
  const primaryCity = (parts[0].split('-')[0] ?? '').trim();
  const primaryState = (parts[1].split('-')[0] ?? '').trim().toUpperCase();
  return { primaryCity, primaryState };
}

function stripSpaces(s: string): string {
  return s.replace(/[^A-Za-z0-9]/g, '');
}

/**
 * Score-aware contextual hashtags. Connects the market's PropertyIQ
 * score label to a short pair of algorithm-friendly hashtags so videos
 * about hot markets get different discovery than contrarian picks.
 */
function scoreHashtags(score?: number): string[] {
  if (typeof score !== 'number' || !Number.isFinite(score)) return [];
  if (score >= 80) return ['#HotMarket', '#TopMarket'];
  if (score >= 70) return ['#StrongMarket', '#GrowingMarket'];
  if (score >= 50) return ['#EmergingMarket', '#MarketWatch'];
  if (score >= 30) return ['#ValueOpportunity', '#MarketWatch'];
  return ['#ContrarianPlay', '#UndervaluedMarket'];
}

/**
 * Deterministic pseudo-random sample. Seeds a djb2-ish hash from the
 * seed string and walks the pool to pick `n` distinct items. Same seed
 * always picks the same subset — tests can assert that, and two runs in
 * close succession with different ids get meaningfully different tags.
 */
export function seededPick<T>(pool: T[], n: number, seed: string): T[] {
  if (n >= pool.length) return [...pool];
  let h = 5381;
  for (let i = 0; i < seed.length; i++)
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  const used = new Set<number>();
  const picks: T[] = [];
  let step = 0;
  while (picks.length < n && used.size < pool.length) {
    const idx = Math.abs((h + step * 31) % pool.length);
    if (!used.has(idx)) {
      used.add(idx);
      picks.push(pool[idx]);
    }
    step++;
  }
  return picks;
}

export function buildYouTubeShortsMeta(
  input: BuildYouTubeTagsInput,
): YouTubeTagsOutput {
  const { primaryCity, primaryState } = parseCanonicalName(
    input.resolvedMarket.canonical_name,
  );
  const cityCompact = stripSpaces(primaryCity);
  const stateFull = STATE_FULL_NAME[primaryState] ?? primaryState;
  const stateCompact = stripSpaces(stateFull);

  const locationHashtags: string[] = [];
  if (cityCompact) {
    locationHashtags.push(`#${cityCompact}`, `#${cityCompact}RealEstate`);
  }
  if (stateCompact) {
    locationHashtags.push(
      `#${stateCompact}RealEstate`,
      `#${stateCompact}Investors`,
    );
  }

  const investingPicks = seededPick(
    INVESTING_POOL,
    INVESTING_POOL_PICK,
    input.runId,
  );
  const scoreTagged = scoreHashtags(input.score);

  // Hashtag order matters — first 3 become clickable chips above the
  // video title on YouTube mobile. Put #Shorts first (eligibility),
  // then the location so it's a discoverability bump.
  const hashtags = [
    CORE_HASHTAGS[0], // #Shorts
    locationHashtags[0] ?? CORE_HASHTAGS[2], // #<City> or #RealEstate fallback
    CORE_HASHTAGS[1], // #PropertyIQ
    ...locationHashtags.slice(1),
    ...investingPicks,
    ...scoreTagged,
  ];

  // Deduplicate while preserving order.
  const seen = new Set<string>();
  const hashtagsUnique = hashtags.filter((h) => {
    const k = h.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Tags field: human-readable SEO keywords (no `#`). Keep short/clean
  // so the combined length stays well under YouTube's 500-char total.
  const tags: string[] = [
    'real estate',
    'property investing',
    'housing market',
    'real estate investor',
    'market analysis',
    'PropertyIQ',
  ];
  if (primaryCity) {
    tags.push(primaryCity, `${primaryCity} real estate`);
  }
  if (stateFull) {
    tags.push(`${stateFull} real estate`);
  }
  if (input.resolvedMarket.canonical_name) {
    tags.push(input.resolvedMarket.canonical_name);
  }

  return { hashtags: hashtagsUnique, tags };
}
