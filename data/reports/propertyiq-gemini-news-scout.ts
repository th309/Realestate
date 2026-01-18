// ============================================================================
// PROPERTYIQ - GEMINI NEWS SCOUT SERVICE
// ============================================================================
// Uses Gemini 2.5 with Google Search grounding to find news and economic
// indicators that could impact real estate markets.
// ============================================================================

import { GoogleGenerativeAI, GoogleSearchRetrievalTool } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Cache settings
const CACHE_TTL_HOURS = 24;
const CACHE_TTL_HOURS_NATIONAL = 12; // National news refreshes more often

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface NewsScoutResult {
  geography_id: string;
  geography_type: string;
  geography_name: string;
  state: string;
  local_news: LocalNewsItem[];
  economic_indicators: EconomicIndicator[];
  market_signals: MarketSignal[];
  national_context: NationalContext | null;
  scout_metadata: ScoutMetadata;
}

export interface LocalNewsItem {
  headline: string;
  summary: string;
  source: string;
  url: string;
  published_date: string;
  relevance: 'high' | 'medium' | 'low';
  category: NewsCategory;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact_on_real_estate: string;
}

export type NewsCategory = 
  // Employer & Jobs (high impact on housing demand)
  | 'employer_expansion'    // New HQ, new offices, company moving in
  | 'employer_hiring'       // Major hiring announcements, job fairs
  | 'employer_layoffs'      // Layoffs, downsizing, plant closures
  | 'employer_relocation'   // Company relocating to/from area
  | 'employer_new_facility' // New plants, warehouses, data centers
  
  // Development & Construction
  | 'development_residential'  // New housing developments, apartments
  | 'development_commercial'   // Office, retail, mixed-use projects
  | 'development_industrial'   // Warehouses, manufacturing facilities
  
  // Policy & Regulation
  | 'policy_zoning'         // Zoning changes, land use decisions
  | 'policy_taxes'          // Property tax changes, incentives
  | 'policy_housing'        // Rent control, tenant protections, ADU laws
  | 'policy_short_term'     // Airbnb/VRBO regulations
  
  // Infrastructure
  | 'infrastructure_transit'   // New transit lines, bus routes
  | 'infrastructure_roads'     // Highway expansions, traffic improvements
  | 'infrastructure_utilities' // Water, power, broadband expansion
  | 'infrastructure_airport'   // Airport expansions, new routes
  
  // Environment & Climate
  | 'climate_disaster'      // Recent floods, fires, storms
  | 'climate_risk'          // New flood zones, fire risk assessments
  | 'climate_insurance'     // Insurance availability, rate changes
  
  // Community
  | 'crime_trends'          // Crime rate changes, safety initiatives
  | 'education_schools'     // School ratings, new schools
  | 'education_university'  // University expansions, student housing
  | 'healthcare'            // New hospitals, medical centers
  
  // Market & Demographics
  | 'market_report'         // Local RE market reports, forecasts
  | 'market_investment'     // Investor activity, institutional buying
  | 'demographic_migration' // Population shifts, migration patterns
  | 'demographic_growth'    // Population milestones, census data
  
  | 'other';

export interface EconomicIndicator {
  indicator_name: string;
  geography_level: 'local' | 'state' | 'national';
  current_value: string;
  previous_value: string | null;
  change_description: string;
  release_date: string;
  source: string;
  source_url: string | null;
  impact_on_housing: 'positive' | 'negative' | 'neutral';
  impact_explanation: string;
}

export interface MarketSignal {
  signal_type: 'bullish' | 'bearish' | 'neutral';
  headline: string;
  description: string;
  source: string;
  source_url: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface NationalContext {
  fed_rate_news: string | null;
  mortgage_rate_trend: string | null;
  national_housing_news: string[];
  economic_outlook: string;
}

export interface ScoutMetadata {
  search_timestamp: string;
  model_used: string;
  search_queries_used: string[];
  total_sources_found: number;
  processing_time_ms: number;
}

// -----------------------------------------------------------------------------
// MAIN SCOUT FUNCTION
// -----------------------------------------------------------------------------

export async function scoutNewsForGeography(
  geographyId: string,
  geographyType: 'metro' | 'county' | 'zip',
  geographyName: string,
  state: string,
  options: {
    includeNationalContext?: boolean;
    maxNewsItems?: number;
    lookbackDays?: number;
  } = {}
): Promise<NewsScoutResult> {
  const startTime = Date.now();
  
  const {
    includeNationalContext = true,
    maxNewsItems = 10,
    lookbackDays = 90
  } = options;

  // Initialize Gemini model with search grounding
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-05-20',
    tools: [{
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: 'MODE_DYNAMIC',
          dynamicThreshold: 0.3 // Lower threshold = more likely to search
        }
      }
    }]
  });

  // Build the search prompt
  const prompt = buildScoutPrompt(geographyName, state, geographyType, lookbackDays, maxNewsItems);

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Extract grounding metadata if available
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const searchQueries = groundingMetadata?.webSearchQueries || [];
    
    // Parse the JSON response
    const parsed = parseGeminiResponse(text);
    
    // Fetch national context separately if requested
    let nationalContext: NationalContext | null = null;
    if (includeNationalContext) {
      nationalContext = await fetchNationalContext(model);
    }

    const processingTime = Date.now() - startTime;

    return {
      geography_id: geographyId,
      geography_type: geographyType,
      geography_name: geographyName,
      state,
      local_news: parsed.local_news || [],
      economic_indicators: parsed.economic_indicators || [],
      market_signals: parsed.market_signals || [],
      national_context: nationalContext,
      scout_metadata: {
        search_timestamp: new Date().toISOString(),
        model_used: 'gemini-2.5-flash-preview-05-20',
        search_queries_used: searchQueries,
        total_sources_found: (parsed.local_news?.length || 0) + 
                            (parsed.economic_indicators?.length || 0) + 
                            (parsed.market_signals?.length || 0),
        processing_time_ms: processingTime
      }
    };
  } catch (error) {
    console.error('Gemini scout error:', error);
    throw new Error(`Failed to scout news for ${geographyName}: ${error.message}`);
  }
}

// -----------------------------------------------------------------------------
// PROMPT BUILDERS
// -----------------------------------------------------------------------------

function buildScoutPrompt(
  geographyName: string,
  state: string,
  geographyType: string,
  lookbackDays: number,
  maxItems: number
): string {
  const locationContext = geographyType === 'zip' 
    ? `the ${geographyName} ZIP code area in ${state}`
    : geographyType === 'county'
    ? `${geographyName} County, ${state}`
    : `the ${geographyName} metropolitan area`;

  return `
You are a real estate market research analyst. Your task is to search for and compile recent news, economic indicators, and market signals that could impact the real estate market in ${locationContext}.

## SEARCH INSTRUCTIONS

Search for news and data from the last ${lookbackDays} days. Focus on finding information that would be relevant to:
- Homebuyers deciding whether to purchase in this area
- Real estate investors evaluating the market
- People considering relocating to this area

## CATEGORIES TO SEARCH

### 1. LOCAL NEWS (search for each category)

**Employers & Jobs (CRITICAL - high impact on housing demand):**

*Expansion & Hiring:*
- Major employers announcing expansions or new facilities
- Large hiring announcements (100+ jobs)
- New company headquarters or regional offices
- Tech companies, manufacturers, or large employers moving in
- Search: "${geographyName} ${state} new jobs hiring" "${geographyName} company expansion" "${geographyName} new headquarters"

*New Facilities:*
- New manufacturing plants or factories
- Data centers being built
- Distribution centers or warehouses
- Research facilities or labs
- Search: "${geographyName} new plant" "${geographyName} data center" "${geographyName} warehouse facility" "${geographyName} manufacturing"

*Layoffs & Closures:*
- Layoff announcements
- Plant or office closures
- Companies leaving the area
- Bankruptcy affecting local employment
- Search: "${geographyName} layoffs" "${geographyName} plant closure" "${geographyName} job cuts"

*Relocations:*
- Companies relocating TO the area (positive)
- Companies relocating FROM the area (negative)
- Corporate headquarters moves
- Search: "${geographyName} company relocation" "${geographyName} headquarters move"

**Development & Construction:**

*Residential:*
- New housing developments approved or under construction
- Apartment complexes, townhomes
- Master-planned communities
- Search: "${geographyName} new homes" "${geographyName} housing development" "${geographyName} apartments construction"

*Commercial & Mixed-Use:*
- Office buildings, retail centers
- Mixed-use developments
- Downtown revitalization projects
- Search: "${geographyName} commercial development" "${geographyName} mixed use project"

*Industrial:*
- Warehouse and logistics facilities
- Industrial parks
- Search: "${geographyName} industrial development" "${geographyName} logistics facility"

**Policy & Regulation:**
- Zoning changes affecting housing density
- Rent control or tenant protection laws
- Property tax changes or reassessments
- Short-term rental (Airbnb) regulations
- Affordable housing mandates
- ADU (accessory dwelling unit) laws
- Search: "${geographyName} zoning change" "${geographyName} property tax" "${geographyName} rent control" "${geographyName} housing policy"

**Infrastructure:**
- New transit lines, light rail, bus rapid transit
- Highway expansions or new interchanges
- Airport improvements or new routes
- Utility infrastructure (water, power, broadband)
- Search: "${geographyName} transit expansion" "${geographyName} highway project" "${geographyName} infrastructure"

**Climate & Environment:**
- Recent weather events (floods, fires, hurricanes, storms)
- New flood zone designations or FEMA updates
- Wildfire risk assessments
- Insurance availability issues or rate hikes
- Search: "${geographyName} flood" "${geographyName} wildfire risk" "${geographyName} home insurance"

**Safety & Crime:**
- Significant crime trend changes (improving or worsening)
- New safety initiatives
- Police/public safety changes
- Search: "${geographyName} crime rate trend" "${geographyName} public safety"

**Education:**
- School rating changes or awards
- New schools opening
- University expansions
- Major education investments
- Search: "${geographyName} schools rating" "${geographyName} university expansion"

**Healthcare:**
- New hospitals or medical centers
- Major healthcare employer news
- Search: "${geographyName} new hospital" "${geographyName} medical center"

### 2. ECONOMIC INDICATORS

Search for the most recent releases of:
- Local/metro unemployment rate
- Job growth numbers (BLS, local sources)
- Building permits issued
- Consumer confidence (regional if available)
- Any state-specific economic reports

Search: "${state} unemployment rate" "${geographyName} job growth" "${geographyName} building permits"

### 3. MARKET SIGNALS

Search for:
- Local real estate market reports
- Agent/broker commentary on the market
- Investor activity news
- Migration trends
- Affordability concerns in local press

Search: "${geographyName} real estate market" "${geographyName} housing market" "${geographyName} home prices"

## OUTPUT FORMAT

Return a JSON object with this exact structure. Be precise and include source URLs when available:

\`\`\`json
{
  "local_news": [
    {
      "headline": "Exact headline or clear title",
      "summary": "2-3 sentence summary of the news",
      "source": "Publication name (e.g., Phoenix Business Journal)",
      "url": "https://source-url.com/article",
      "published_date": "2025-01-15",
      "relevance": "high",
      "category": "employer_expansion",
      "sentiment": "positive",
      "impact_on_real_estate": "This could increase housing demand as 500 new jobs are created in the tech sector."
    },
    {
      "headline": "Example layoff news",
      "summary": "Company X announced 200 layoffs at their manufacturing facility",
      "source": "Local News",
      "url": "https://...",
      "published_date": "2025-01-10",
      "relevance": "high",
      "category": "employer_layoffs",
      "sentiment": "negative",
      "impact_on_real_estate": "Could reduce housing demand in the immediate area as workers relocate for new jobs."
    }
  ],
  "economic_indicators": [
    {
      "indicator_name": "Unemployment Rate",
      "geography_level": "local",
      "current_value": "3.2%",
      "previous_value": "3.5%",
      "change_description": "Decreased 0.3 percentage points from previous month",
      "release_date": "2025-01-10",
      "source": "Bureau of Labor Statistics",
      "source_url": "https://bls.gov/...",
      "impact_on_housing": "positive",
      "impact_explanation": "Lower unemployment supports housing demand and buyer confidence."
    }
  ],
  "market_signals": [
    {
      "signal_type": "bullish",
      "headline": "Investors increasingly targeting Phoenix metro",
      "description": "Multiple reports indicate institutional investors are expanding purchases in the Phoenix area, citing strong rent growth and population inflows.",
      "source": "Arizona Republic",
      "source_url": "https://...",
      "confidence": "medium"
    }
  ]
}
\`\`\`

## CATEGORY VALUES

For the "category" field, use one of these exact values:
- Employer news: "employer_expansion", "employer_hiring", "employer_layoffs", "employer_relocation", "employer_new_facility"
- Development: "development_residential", "development_commercial", "development_industrial"
- Policy: "policy_zoning", "policy_taxes", "policy_housing", "policy_short_term"
- Infrastructure: "infrastructure_transit", "infrastructure_roads", "infrastructure_utilities", "infrastructure_airport"
- Climate: "climate_disaster", "climate_risk", "climate_insurance"
- Community: "crime_trends", "education_schools", "education_university", "healthcare"
- Market: "market_report", "market_investment", "demographic_migration", "demographic_growth"
- Other: "other"

## IMPORTANT GUIDELINES

1. **Quality over quantity**: Only include genuinely relevant items. Max ${maxItems} news items.
2. **Verify relevance**: Each item must plausibly impact real estate (housing demand, prices, desirability).
3. **Be specific**: Include actual numbers, dates, and company names when available.
4. **Include URLs**: Always include source URLs when you can find them.
5. **Date accuracy**: Use actual publication dates, not today's date.
6. **No speculation**: Only report what's actually in the news, don't predict.
7. **If nothing found**: It's okay to return empty arrays if there's no relevant news.

Now search and compile the results for ${locationContext}:
`;
}

async function fetchNationalContext(model: any): Promise<NationalContext> {
  const prompt = `
Search for the most recent national economic and housing news that would affect real estate markets across the US. Focus on:

1. Federal Reserve interest rate decisions or commentary (last 30 days)
2. Current mortgage rate trends
3. National housing market news (inventory, prices, sales)
4. Overall economic outlook

Return as JSON:
\`\`\`json
{
  "fed_rate_news": "Summary of most recent Fed decision or commentary, or null if nothing recent",
  "mortgage_rate_trend": "Current 30-year rate and recent trend (e.g., '6.8%, down from 7.0% last month')",
  "national_housing_news": ["Array of 2-3 relevant national housing headlines/summaries"],
  "economic_outlook": "1-2 sentence summary of current economic conditions affecting housing"
}
\`\`\`
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseGeminiResponse(text);
  } catch (error) {
    console.error('Failed to fetch national context:', error);
    return {
      fed_rate_news: null,
      mortgage_rate_trend: null,
      national_housing_news: [],
      economic_outlook: 'Unable to fetch current economic outlook.'
    };
  }
}

// -----------------------------------------------------------------------------
// RESPONSE PARSING
// -----------------------------------------------------------------------------

function parseGeminiResponse(text: string): any {
  // Try to extract JSON from the response
  // Handle markdown code blocks
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      console.error('Failed to parse JSON from code block:', e);
    }
  }

  // Try parsing the entire response as JSON
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse response as JSON:', e);
  }

  // Try to find JSON object in the text
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (e) {
      console.error('Failed to parse extracted object:', e);
    }
  }

  // Return empty structure if all parsing fails
  console.warn('Could not parse Gemini response, returning empty result');
  return {
    local_news: [],
    economic_indicators: [],
    market_signals: []
  };
}

// -----------------------------------------------------------------------------
// CACHING LAYER
// -----------------------------------------------------------------------------

export async function getOrScoutNews(
  geographyId: string,
  geographyType: 'metro' | 'county' | 'zip',
  geographyName: string,
  state: string,
  options: {
    forceRefresh?: boolean;
    includeNationalContext?: boolean;
    maxNewsItems?: number;
  } = {}
): Promise<NewsScoutResult> {
  const { forceRefresh = false, ...scoutOptions } = options;

  if (!forceRefresh) {
    // Check cache
    const cached = await getCachedNews(geographyId, geographyType);
    if (cached) {
      console.log(`Cache hit for ${geographyName}`);
      return cached;
    }
  }

  console.log(`Scouting fresh news for ${geographyName}...`);
  
  // Fetch fresh data
  const result = await scoutNewsForGeography(
    geographyId,
    geographyType,
    geographyName,
    state,
    scoutOptions
  );

  // Cache the result
  await cacheNewsResult(result);

  return result;
}

async function getCachedNews(
  geographyId: string,
  geographyType: string
): Promise<NewsScoutResult | null> {
  const { data, error } = await supabase
    .from('report_news_cache')
    .select('news_data')
    .eq('geography_id', geographyId)
    .eq('geography_type', geographyType)
    .gt('expires_at', new Date().toISOString())
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.news_data as NewsScoutResult;
}

async function cacheNewsResult(result: NewsScoutResult): Promise<void> {
  const ttlHours = result.geography_type === 'national' 
    ? CACHE_TTL_HOURS_NATIONAL 
    : CACHE_TTL_HOURS;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);

  const { error } = await supabase
    .from('report_news_cache')
    .upsert({
      geography_id: result.geography_id,
      geography_type: result.geography_type,
      geography_name: result.geography_name,
      news_data: result,
      fetched_at: result.scout_metadata.search_timestamp,
      expires_at: expiresAt.toISOString(),
      model_used: result.scout_metadata.model_used,
      local_news_count: result.local_news.length,
      indicators_count: result.economic_indicators.length,
      signals_count: result.market_signals.length
    }, {
      onConflict: 'geography_id,geography_type'
    });

  if (error) {
    console.error('Failed to cache news result:', error);
  }
}

// -----------------------------------------------------------------------------
// UTILITY FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Category groupings for easier filtering
 */
export const CATEGORY_GROUPS = {
  employer: [
    'employer_expansion',
    'employer_hiring', 
    'employer_layoffs',
    'employer_relocation',
    'employer_new_facility'
  ],
  development: [
    'development_residential',
    'development_commercial',
    'development_industrial'
  ],
  policy: [
    'policy_zoning',
    'policy_taxes',
    'policy_housing',
    'policy_short_term'
  ],
  infrastructure: [
    'infrastructure_transit',
    'infrastructure_roads',
    'infrastructure_utilities',
    'infrastructure_airport'
  ],
  climate: [
    'climate_disaster',
    'climate_risk',
    'climate_insurance'
  ],
  community: [
    'crime_trends',
    'education_schools',
    'education_university',
    'healthcare'
  ],
  market: [
    'market_report',
    'market_investment',
    'demographic_migration',
    'demographic_growth'
  ]
} as const;

/**
 * Get employer-related news (high impact on housing demand)
 */
export function getEmployerNews(result: NewsScoutResult): {
  positive: LocalNewsItem[];  // Expansions, hiring, new facilities
  negative: LocalNewsItem[];  // Layoffs, closures, relocations out
  net_impact: 'positive' | 'negative' | 'neutral' | 'mixed';
  job_impact_estimate: string;
} {
  const employerCategories = CATEGORY_GROUPS.employer;
  const employerNews = result.local_news.filter(
    item => employerCategories.includes(item.category as any)
  );

  const positive = employerNews.filter(
    item => ['employer_expansion', 'employer_hiring', 'employer_new_facility'].includes(item.category) ||
            (item.category === 'employer_relocation' && item.sentiment === 'positive')
  );

  const negative = employerNews.filter(
    item => item.category === 'employer_layoffs' ||
            (item.category === 'employer_relocation' && item.sentiment === 'negative')
  );

  // Determine net impact
  let net_impact: 'positive' | 'negative' | 'neutral' | 'mixed';
  if (positive.length > 0 && negative.length === 0) {
    net_impact = 'positive';
  } else if (negative.length > 0 && positive.length === 0) {
    net_impact = 'negative';
  } else if (positive.length === 0 && negative.length === 0) {
    net_impact = 'neutral';
  } else {
    net_impact = 'mixed';
  }

  // Try to estimate job impact from summaries
  let job_impact_estimate = 'Unable to estimate';
  const allNews = [...positive, ...negative];
  const jobNumbers = allNews
    .map(n => {
      const match = n.summary.match(/(\d{1,3}(?:,\d{3})*)\s*(?:jobs?|positions?|employees?|workers?)/i);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    })
    .filter(n => n > 0);

  if (jobNumbers.length > 0) {
    const total = jobNumbers.reduce((a, b) => a + b, 0);
    const netPositive = positive.length > negative.length;
    job_impact_estimate = `Approximately ${total.toLocaleString()} jobs ${netPositive ? 'added' : 'affected'}`;
  }

  return {
    positive,
    negative,
    net_impact,
    job_impact_estimate
  };
}

/**
 * Filter news items by relevance and category
 */
export function filterNews(
  result: NewsScoutResult,
  options: {
    minRelevance?: 'high' | 'medium' | 'low';
    categories?: NewsCategory[];
    categoryGroups?: (keyof typeof CATEGORY_GROUPS)[];
    sentiment?: ('positive' | 'negative' | 'neutral')[];
    maxItems?: number;
  } = {}
): LocalNewsItem[] {
  const {
    minRelevance = 'low',
    categories,
    categoryGroups,
    sentiment,
    maxItems
  } = options;

  const relevanceOrder = { high: 3, medium: 2, low: 1 };
  const minRelevanceValue = relevanceOrder[minRelevance];

  // Build full category list from groups if provided
  let allowedCategories: NewsCategory[] | undefined = categories;
  if (categoryGroups && categoryGroups.length > 0) {
    const fromGroups = categoryGroups.flatMap(g => CATEGORY_GROUPS[g] as unknown as NewsCategory[]);
    allowedCategories = categories 
      ? [...categories, ...fromGroups]
      : fromGroups;
  }

  let filtered = result.local_news.filter(item => {
    // Filter by relevance
    if (relevanceOrder[item.relevance] < minRelevanceValue) {
      return false;
    }

    // Filter by category
    if (allowedCategories && !allowedCategories.includes(item.category)) {
      return false;
    }

    // Filter by sentiment
    if (sentiment && !sentiment.includes(item.sentiment)) {
      return false;
    }

    return true;
  });

  // Sort by relevance (high first)
  filtered.sort((a, b) => relevanceOrder[b.relevance] - relevanceOrder[a.relevance]);

  // Limit results
  if (maxItems) {
    filtered = filtered.slice(0, maxItems);
  }

  return filtered;
}

/**
 * Get a summary of market signals
 */
export function summarizeSignals(result: NewsScoutResult): {
  overall: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  high_confidence_signals: MarketSignal[];
} {
  const signals = result.market_signals;
  
  const bullish = signals.filter(s => s.signal_type === 'bullish');
  const bearish = signals.filter(s => s.signal_type === 'bearish');
  const neutral = signals.filter(s => s.signal_type === 'neutral');

  let overall: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  
  if (bullish.length > bearish.length + 1) {
    overall = 'bullish';
  } else if (bearish.length > bullish.length + 1) {
    overall = 'bearish';
  } else if (bullish.length === 0 && bearish.length === 0) {
    overall = 'neutral';
  } else {
    overall = 'mixed';
  }

  return {
    overall,
    bullish_count: bullish.length,
    bearish_count: bearish.length,
    neutral_count: neutral.length,
    high_confidence_signals: signals.filter(s => s.confidence === 'high')
  };
}

/**
 * Format news for inclusion in Claude prompts
 */
export function formatNewsForPrompt(
  result: NewsScoutResult,
  options: {
    maxNewsItems?: number;
    includeIndicators?: boolean;
    includeSignals?: boolean;
    includeNational?: boolean;
  } = {}
): string {
  const {
    maxNewsItems = 5,
    includeIndicators = true,
    includeSignals = true,
    includeNational = true
  } = options;

  const parts: string[] = [];

  // Local news
  const news = filterNews(result, { minRelevance: 'medium', maxItems: maxNewsItems });
  if (news.length > 0) {
    parts.push('## RECENT LOCAL NEWS\n');
    news.forEach(item => {
      parts.push(`**${item.headline}** (${item.source}, ${item.published_date})`);
      parts.push(`${item.summary}`);
      parts.push(`Impact: ${item.impact_on_real_estate}`);
      parts.push(`Sentiment: ${item.sentiment} | Category: ${item.category}\n`);
    });
  }

  // Economic indicators
  if (includeIndicators && result.economic_indicators.length > 0) {
    parts.push('\n## ECONOMIC INDICATORS\n');
    result.economic_indicators.forEach(ind => {
      parts.push(`**${ind.indicator_name}** (${ind.geography_level}): ${ind.current_value}`);
      parts.push(`${ind.change_description}`);
      parts.push(`Housing impact: ${ind.impact_on_housing} - ${ind.impact_explanation}\n`);
    });
  }

  // Market signals
  if (includeSignals && result.market_signals.length > 0) {
    const summary = summarizeSignals(result);
    parts.push(`\n## MARKET SIGNALS (Overall: ${summary.overall.toUpperCase()})\n`);
    result.market_signals.forEach(signal => {
      const emoji = signal.signal_type === 'bullish' ? '📈' : 
                    signal.signal_type === 'bearish' ? '📉' : '➡️';
      parts.push(`${emoji} **${signal.headline}**`);
      parts.push(`${signal.description}`);
      parts.push(`Confidence: ${signal.confidence}\n`);
    });
  }

  // National context
  if (includeNational && result.national_context) {
    const nat = result.national_context;
    parts.push('\n## NATIONAL CONTEXT\n');
    if (nat.fed_rate_news) {
      parts.push(`**Fed Policy:** ${nat.fed_rate_news}`);
    }
    if (nat.mortgage_rate_trend) {
      parts.push(`**Mortgage Rates:** ${nat.mortgage_rate_trend}`);
    }
    if (nat.economic_outlook) {
      parts.push(`**Economic Outlook:** ${nat.economic_outlook}`);
    }
    if (nat.national_housing_news.length > 0) {
      parts.push('**National Housing News:**');
      nat.national_housing_news.forEach(item => parts.push(`- ${item}`));
    }
  }

  return parts.join('\n');
}

// -----------------------------------------------------------------------------
// BATCH OPERATIONS
// -----------------------------------------------------------------------------

/**
 * Scout news for multiple geographies (with rate limiting)
 */
export async function batchScoutNews(
  geographies: Array<{
    id: string;
    type: 'metro' | 'county' | 'zip';
    name: string;
    state: string;
  }>,
  options: {
    concurrency?: number;
    delayMs?: number;
  } = {}
): Promise<Map<string, NewsScoutResult>> {
  const { concurrency = 2, delayMs = 1000 } = options;
  const results = new Map<string, NewsScoutResult>();

  // Process in batches
  for (let i = 0; i < geographies.length; i += concurrency) {
    const batch = geographies.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(geo => 
        getOrScoutNews(geo.id, geo.type, geo.name, geo.state)
          .catch(err => {
            console.error(`Failed to scout ${geo.name}:`, err);
            return null;
          })
      )
    );

    batchResults.forEach((result, idx) => {
      if (result) {
        results.set(batch[idx].id, result);
      }
    });

    // Rate limiting delay between batches
    if (i + concurrency < geographies.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// -----------------------------------------------------------------------------
// CACHE MAINTENANCE
// -----------------------------------------------------------------------------

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  const { data, error } = await supabase
    .from('report_news_cache')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('Failed to clear expired cache:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  total_entries: number;
  expired_entries: number;
  avg_news_items: number;
  oldest_entry: string | null;
  newest_entry: string | null;
}> {
  const { data, error } = await supabase
    .from('report_news_cache')
    .select('fetched_at, expires_at, local_news_count');

  if (error || !data) {
    return {
      total_entries: 0,
      expired_entries: 0,
      avg_news_items: 0,
      oldest_entry: null,
      newest_entry: null
    };
  }

  const now = new Date();
  const expired = data.filter(d => new Date(d.expires_at) < now);
  const avgNews = data.reduce((sum, d) => sum + (d.local_news_count || 0), 0) / data.length;
  const dates = data.map(d => new Date(d.fetched_at)).sort((a, b) => a.getTime() - b.getTime());

  return {
    total_entries: data.length,
    expired_entries: expired.length,
    avg_news_items: Math.round(avgNews * 10) / 10,
    oldest_entry: dates[0]?.toISOString() || null,
    newest_entry: dates[dates.length - 1]?.toISOString() || null
  };
}

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------

export default {
  scoutNewsForGeography,
  getOrScoutNews,
  filterNews,
  getEmployerNews,
  summarizeSignals,
  formatNewsForPrompt,
  batchScoutNews,
  clearExpiredCache,
  getCacheStats,
  CATEGORY_GROUPS
};
