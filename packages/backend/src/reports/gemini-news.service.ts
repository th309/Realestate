/**
 * Gemini News Scout Service
 *
 * Uses Gemini 2.0 Flash with Google Search grounding to find news and
 * economic indicators that could impact real estate markets.
 *
 * Based on: data/reports/propertyiq-gemini-news-scout.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export type NewsCategory =
  // Employer & Jobs
  | 'employer_expansion'
  | 'employer_hiring'
  | 'employer_layoffs'
  | 'employer_relocation'
  | 'employer_new_facility'
  // Development
  | 'development_residential'
  | 'development_commercial'
  | 'development_industrial'
  // Policy
  | 'policy_zoning'
  | 'policy_taxes'
  | 'policy_housing'
  | 'policy_short_term'
  // Infrastructure
  | 'infrastructure_transit'
  | 'infrastructure_roads'
  | 'infrastructure_utilities'
  | 'infrastructure_airport'
  // Climate
  | 'climate_disaster'
  | 'climate_risk'
  | 'climate_insurance'
  // Community
  | 'crime_trends'
  | 'education_schools'
  | 'education_university'
  | 'healthcare'
  // Market
  | 'market_report'
  | 'market_investment'
  | 'demographic_migration'
  | 'demographic_growth'
  | 'other';

export interface LocalNewsItem {
  headline: string;
  summary: string;
  source: string;
  url: string | null;
  published_date: string;
  relevance: 'high' | 'medium' | 'low';
  category: NewsCategory;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact_on_real_estate: string;
}

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

export interface SignalSummary {
  overall: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  high_confidence_signals: MarketSignal[];
}

// Category groupings for filtering
export const CATEGORY_GROUPS = {
  employer: [
    'employer_expansion',
    'employer_hiring',
    'employer_layoffs',
    'employer_relocation',
    'employer_new_facility',
  ],
  development: [
    'development_residential',
    'development_commercial',
    'development_industrial',
  ],
  policy: [
    'policy_zoning',
    'policy_taxes',
    'policy_housing',
    'policy_short_term',
  ],
  infrastructure: [
    'infrastructure_transit',
    'infrastructure_roads',
    'infrastructure_utilities',
    'infrastructure_airport',
  ],
  climate: ['climate_disaster', 'climate_risk', 'climate_insurance'],
  community: [
    'crime_trends',
    'education_schools',
    'education_university',
    'healthcare',
  ],
  market: [
    'market_report',
    'market_investment',
    'demographic_migration',
    'demographic_growth',
  ],
} as const;

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

@Injectable()
export class GeminiNewsService {
  private readonly logger = new Logger(GeminiNewsService.name);
  private readonly geminiApiKey: string | null;
  private readonly geminiModel = 'gemini-2.0-flash';
  private readonly cacheTtlHours = 24;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.geminiApiKey =
      this.configService.get<string>('GOOGLE_AI_API_KEY') || null;
    if (this.geminiApiKey) {
      this.logger.log('Gemini News Service initialized');
    } else {
      this.logger.warn(
        'GOOGLE_AI_API_KEY not configured - news scouting disabled',
      );
    }
  }

  /**
   * Get news for geography (from cache or fresh scout)
   */
  async getOrScoutNews(
    geographyId: string,
    geographyType: 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip',
    geographyName: string,
    state: string,
    options: {
      forceRefresh?: boolean;
      includeNationalContext?: boolean;
      maxNewsItems?: number;
      lookbackDays?: number;
    } = {},
  ): Promise<NewsScoutResult | null> {
    if (!this.geminiApiKey) {
      this.logger.warn('Gemini not configured - returning null');
      return null;
    }

    const { forceRefresh = false, ...scoutOptions } = options;

    // Check cache first
    if (!forceRefresh) {
      const cached = await this.getCachedNews(geographyId, geographyType);
      if (cached) {
        this.logger.log(`Cache hit for ${geographyName}`);
        return cached;
      }
    }

    this.logger.log(`Scouting fresh news for ${geographyName}...`);

    // Scout fresh data
    const result = await this.scoutNewsForGeography(
      geographyId,
      geographyType,
      geographyName,
      state,
      scoutOptions,
    );

    // Cache the result
    if (result) {
      await this.cacheNewsResult(result);
    }

    return result;
  }

  /**
   * Scout news for a specific geography
   */
  async scoutNewsForGeography(
    geographyId: string,
    geographyType: 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip',
    geographyName: string,
    state: string,
    options: {
      includeNationalContext?: boolean;
      maxNewsItems?: number;
      lookbackDays?: number;
    } = {},
  ): Promise<NewsScoutResult | null> {
    if (!this.geminiApiKey) return null;

    const startTime = Date.now();
    const {
      includeNationalContext = true,
      maxNewsItems = 10,
      lookbackDays = 90,
    } = options;

    const prompt = this.buildScoutPrompt(
      geographyName,
      state,
      geographyType,
      lookbackDays,
      maxNewsItems,
    );

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.3,
            },
            tools: [{ googleSearch: {} }],
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${error}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = this.parseGeminiResponse(text);

      // Fetch national context separately if requested
      let nationalContext: NationalContext | null = null;
      if (includeNationalContext) {
        nationalContext = await this.fetchNationalContext();
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
          model_used: this.geminiModel,
          search_queries_used: [],
          total_sources_found:
            (parsed.local_news?.length || 0) +
            (parsed.economic_indicators?.length || 0) +
            (parsed.market_signals?.length || 0),
          processing_time_ms: processingTime,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to scout news for ${geographyName}:`, error);
      return null;
    }
  }

  /**
   * Fetch national economic context
   */
  private async fetchNationalContext(): Promise<NationalContext | null> {
    if (!this.geminiApiKey) return null;

    const prompt = `Search for the most recent national economic and housing news affecting US real estate:

1. Federal Reserve interest rate decisions or commentary (last 30 days)
2. Current mortgage rate trends
3. National housing market news (inventory, prices, sales)
4. Overall economic outlook

Return as JSON:
{
  "fed_rate_news": "Summary of most recent Fed decision or commentary",
  "mortgage_rate_trend": "Current 30-year rate and recent trend",
  "national_housing_news": ["2-3 relevant national headlines"],
  "economic_outlook": "1-2 sentence summary"
}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
            tools: [{ googleSearch: {} }],
          }),
        },
      );

      if (!response.ok) return null;

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return this.parseGeminiResponse(text);
    } catch (error) {
      this.logger.error('Failed to fetch national context:', error);
      return null;
    }
  }

  /**
   * Build the comprehensive scout prompt
   */
  private buildScoutPrompt(
    geographyName: string,
    state: string,
    geographyType: string,
    lookbackDays: number,
    maxItems: number,
  ): string {
    const locationContext =
      geographyType === 'zip'
        ? `the ${geographyName} ZIP code area in ${state}`
        : geographyType === 'county'
          ? `${geographyName} County, ${state}`
          : `the ${geographyName} metropolitan area`;

    return `You are a real estate market research analyst. Search for recent news, economic indicators, and market signals that could impact the real estate market in ${locationContext}.

## SEARCH FOCUS (Last ${lookbackDays} days)

### 1. EMPLOYER & JOBS NEWS (High Impact)
- Company expansions, new headquarters, hiring announcements
- New manufacturing plants, data centers, distribution centers
- Layoffs, plant closures, companies leaving
- Search: "${geographyName} ${state} jobs hiring", "${geographyName} company expansion", "${geographyName} layoffs"

### 2. DEVELOPMENT NEWS
- New housing developments, apartments, townhomes
- Commercial projects, mixed-use developments
- Industrial/warehouse facilities
- Search: "${geographyName} housing development", "${geographyName} apartments construction"

### 3. POLICY & REGULATION
- Zoning changes, rent control, property tax changes
- Housing policy, ADU laws, short-term rental rules
- Search: "${geographyName} zoning", "${geographyName} property tax", "${geographyName} housing policy"

### 4. INFRASTRUCTURE
- Transit expansions, highway projects, airport improvements
- Search: "${geographyName} transit", "${geographyName} infrastructure"

### 5. CLIMATE & ENVIRONMENT
- Recent weather events, flood zones, wildfire risk, insurance issues
- Search: "${geographyName} flood", "${geographyName} insurance"

### 6. ECONOMIC INDICATORS
- Unemployment rate, job growth, building permits
- Search: "${state} unemployment", "${geographyName} job growth"

### 7. MARKET SIGNALS
- Real estate market reports, investor activity, migration trends
- Search: "${geographyName} real estate market", "${geographyName} housing market"

## OUTPUT FORMAT (JSON)

\`\`\`json
{
  "local_news": [
    {
      "headline": "Exact headline",
      "summary": "2-3 sentence summary",
      "source": "Publication name",
      "url": "https://...",
      "published_date": "2025-01-15",
      "relevance": "high|medium|low",
      "category": "employer_expansion|employer_layoffs|development_residential|etc",
      "sentiment": "positive|negative|neutral",
      "impact_on_real_estate": "How this affects housing demand/prices"
    }
  ],
  "economic_indicators": [
    {
      "indicator_name": "Unemployment Rate",
      "geography_level": "local|state|national",
      "current_value": "3.2%",
      "previous_value": "3.5%",
      "change_description": "Decreased 0.3 points",
      "release_date": "2025-01-10",
      "source": "BLS",
      "source_url": "https://...",
      "impact_on_housing": "positive|negative|neutral",
      "impact_explanation": "Lower unemployment supports housing demand"
    }
  ],
  "market_signals": [
    {
      "signal_type": "bullish|bearish|neutral",
      "headline": "Signal headline",
      "description": "What this signal means",
      "source": "Source name",
      "source_url": "https://...",
      "confidence": "high|medium|low"
    }
  ]
}
\`\`\`

## CATEGORY VALUES
- Employer: employer_expansion, employer_hiring, employer_layoffs, employer_relocation, employer_new_facility
- Development: development_residential, development_commercial, development_industrial
- Policy: policy_zoning, policy_taxes, policy_housing, policy_short_term
- Infrastructure: infrastructure_transit, infrastructure_roads, infrastructure_utilities, infrastructure_airport
- Climate: climate_disaster, climate_risk, climate_insurance
- Community: crime_trends, education_schools, education_university, healthcare
- Market: market_report, market_investment, demographic_migration, demographic_growth

## GUIDELINES
1. Quality over quantity - max ${maxItems} news items
2. Include source URLs when available
3. Use actual publication dates
4. Only report factual news, no speculation

Search and compile results for ${locationContext}:`;
  }

  /**
   * Parse JSON from Gemini response
   */
  private parseGeminiResponse(text: string): any {
    // Try markdown code block
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {}
    }

    // Try raw JSON
    try {
      return JSON.parse(text);
    } catch {}

    // Try to find JSON object
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {}
    }

    return { local_news: [], economic_indicators: [], market_signals: [] };
  }

  // ---------------------------------------------------------------------------
  // CACHING
  // ---------------------------------------------------------------------------

  private async getCachedNews(
    geographyId: string,
    geographyType: string,
  ): Promise<NewsScoutResult | null> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('report_news_cache')
      .select('news_data')
      .eq('geography_id', geographyId)
      .eq('geography_type', geographyType)
      .gt('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    return data?.news_data as NewsScoutResult | null;
  }

  private async cacheNewsResult(result: NewsScoutResult): Promise<void> {
    const client = this.supabase.getClient();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.cacheTtlHours);

    await client.from('report_news_cache').upsert(
      {
        geography_id: result.geography_id,
        geography_type: result.geography_type,
        geography_name: result.geography_name,
        news_data: result,
        fetched_at: result.scout_metadata.search_timestamp,
        expires_at: expiresAt.toISOString(),
        model_used: result.scout_metadata.model_used,
        local_news_count: result.local_news.length,
        indicators_count: result.economic_indicators.length,
        signals_count: result.market_signals.length,
      },
      { onConflict: 'geography_id,geography_type' },
    );
  }

  // ---------------------------------------------------------------------------
  // UTILITY FUNCTIONS
  // ---------------------------------------------------------------------------

  /**
   * Summarize market signals
   */
  summarizeSignals(result: NewsScoutResult): SignalSummary {
    const signals = result.market_signals;
    const bullish = signals.filter((s) => s.signal_type === 'bullish');
    const bearish = signals.filter((s) => s.signal_type === 'bearish');
    const neutral = signals.filter((s) => s.signal_type === 'neutral');

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
      high_confidence_signals: signals.filter((s) => s.confidence === 'high'),
    };
  }

  /**
   * Format news for Claude prompt context
   */
  formatNewsForPrompt(
    result: NewsScoutResult,
    options: {
      maxNewsItems?: number;
      includeIndicators?: boolean;
      includeSignals?: boolean;
      includeNational?: boolean;
    } = {},
  ): string {
    const {
      maxNewsItems = 5,
      includeIndicators = true,
      includeSignals = true,
      includeNational = true,
    } = options;

    const parts: string[] = [];

    // Local news
    const news = result.local_news
      .filter((n) => n.relevance !== 'low')
      .slice(0, maxNewsItems);

    if (news.length > 0) {
      parts.push('## RECENT LOCAL NEWS\n');
      news.forEach((item) => {
        parts.push(
          `**${item.headline}** (${item.source}, ${item.published_date})`,
        );
        parts.push(`${item.summary}`);
        parts.push(`Impact: ${item.impact_on_real_estate}`);
        parts.push(
          `Sentiment: ${item.sentiment} | Category: ${item.category}\n`,
        );
      });
    }

    // Economic indicators
    if (includeIndicators && result.economic_indicators.length > 0) {
      parts.push('\n## ECONOMIC INDICATORS\n');
      result.economic_indicators.forEach((ind) => {
        parts.push(
          `**${ind.indicator_name}** (${ind.geography_level}): ${ind.current_value}`,
        );
        parts.push(`${ind.change_description}`);
        parts.push(
          `Housing impact: ${ind.impact_on_housing} - ${ind.impact_explanation}\n`,
        );
      });
    }

    // Market signals
    if (includeSignals && result.market_signals.length > 0) {
      const summary = this.summarizeSignals(result);
      parts.push(
        `\n## MARKET SIGNALS (Overall: ${summary.overall.toUpperCase()})\n`,
      );
      result.market_signals.forEach((signal) => {
        const emoji =
          signal.signal_type === 'bullish'
            ? '📈'
            : signal.signal_type === 'bearish'
              ? '📉'
              : '➡️';
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
    }

    return parts.join('\n');
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!this.geminiApiKey;
  }
}
