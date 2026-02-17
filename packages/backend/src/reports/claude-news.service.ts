/**
 * Claude News Scout Service
 *
 * Uses Claude (Anthropic) with web search tool to find news and
 * economic indicators that could impact real estate markets.
 *
 * Replaces the previous Gemini-based news scouting service.
 * Based on: data/reports/propertyiq-gemini-news-scout.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import Anthropic from '@anthropic-ai/sdk';

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
export class ClaudeNewsService {
  private readonly logger = new Logger(ClaudeNewsService.name);
  private readonly anthropicClient: Anthropic | null = null;
  private readonly anthropicApiKey: string | null;
  private readonly claudeModel = 'claude-haiku-4-5-20251001';
  private readonly cacheTtlHours = 24;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.anthropicApiKey =
      this.configService.get<string>('ANTHROPIC_API_KEY') || null;
    if (this.anthropicApiKey) {
      this.anthropicClient = new Anthropic({ apiKey: this.anthropicApiKey });
      this.logger.log('Claude News Service initialized');
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured - news scouting disabled',
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
    if (!this.anthropicClient) {
      this.logger.warn('Anthropic not configured - returning null');
      return null;
    }

    const { forceRefresh = false, ...scoutOptions } = options;

    // Check cache first
    if (!forceRefresh) {
      try {
        const cached = await this.getCachedNews(geographyId, geographyType);
        if (cached) {
          this.logger.log(`Cache hit for ${geographyName}`);
          return cached;
        }
      } catch (cacheError) {
        this.logger.warn(`Cache lookup failed for ${geographyName} (table may not exist): ${cacheError?.message || cacheError}`);
        // Continue to scout fresh data
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

    // Cache the result only if it has actual data (don't cache empty parse failures)
    if (result && (result.local_news.length > 0 || result.economic_indicators.length > 0)) {
      try {
        await this.cacheNewsResult(result);
      } catch (cacheError) {
        this.logger.warn(`Failed to cache news result for ${geographyName}: ${cacheError?.message || cacheError}`);
      }
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
    if (!this.anthropicClient) return null;

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
      // Run local news scouting and national context in parallel
      const newsPromise = this.anthropicClient.messages.create({
        model: this.claudeModel,
        max_tokens: 16384,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 3,
          },
        ],
        messages: [{ role: 'user', content: prompt }],
      });

      const nationalPromise = includeNationalContext
        ? this.fetchNationalContext().catch((err) => {
            this.logger.warn(`National context fetch failed: ${err?.message || err}`);
            return null;
          })
        : Promise.resolve(null);

      const [response, nationalContext] = await Promise.all([newsPromise, nationalPromise]);

      // Extract text from response (may have multiple content blocks due to tool use)
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );

      this.logger.log(`News response for ${geographyName}: ${response.content.length} blocks, ${textBlocks.length} text, stop=${response.stop_reason}`);

      if (response.stop_reason === 'max_tokens') {
        this.logger.warn(`News response TRUNCATED (max_tokens) for ${geographyName}. JSON may be incomplete.`);
      }

      if (textBlocks.length === 0) {
        this.logger.warn(`Empty text response from Claude for ${geographyName}. Stop reason: ${response.stop_reason}.`);
      }

      // Strip <cite> tags from web search responses (they waste tokens and pollute JSON values)
      const stripCitations = (text: string) =>
        text.replace(/<cite[^>]*>/g, '').replace(/<\/cite>/g, '');

      // Try each text block individually, last first (final block has the JSON answer)
      let parsed: any = null;
      for (let i = textBlocks.length - 1; i >= 0; i--) {
        const blockText = stripCitations(textBlocks[i].text);
        const result = this.parseResponse(blockText);
        if (result.local_news?.length || result.economic_indicators?.length || result.market_signals?.length) {
          this.logger.log(`Parsed news from text block ${i + 1}/${textBlocks.length} (${blockText.length} chars)`);
          parsed = result;
          break;
        }
      }
      // Fallback: join all text blocks and try once more
      if (!parsed) {
        const allText = stripCitations(textBlocks.map((b) => b.text).join('\n'));
        parsed = this.parseResponse(allText);
      }

      if (!parsed.local_news?.length && !parsed.economic_indicators?.length && !parsed.market_signals?.length) {
        this.logger.warn(`No news data parsed for ${geographyName}. Text blocks: ${textBlocks.length}. Parsed keys: ${Object.keys(parsed).join(', ')}`);
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
          model_used: this.claudeModel,
          search_queries_used: [],
          total_sources_found:
            (parsed.local_news?.length || 0) +
            (parsed.economic_indicators?.length || 0) +
            (parsed.market_signals?.length || 0),
          processing_time_ms: processingTime,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to scout news for ${geographyName}: ${error?.message || error}`,
        error?.stack,
      );
      if (error?.status) {
        this.logger.error(`Anthropic API status: ${error.status}, type: ${error?.error?.type}`);
      }
      return null;
    }
  }

  /**
   * Fetch national economic context
   */
  private async fetchNationalContext(): Promise<NationalContext | null> {
    if (!this.anthropicClient) return null;

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
      const response = await this.anthropicClient.messages.create({
        model: this.claudeModel,
        max_tokens: 4096,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 3,
          },
        ],
        messages: [{ role: 'user', content: prompt }],
      });

      // Extract text from response - strip citations and try each block (last first)
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );
      const strip = (t: string) => t.replace(/<cite[^>]*>/g, '').replace(/<\/cite>/g, '');
      for (let i = textBlocks.length - 1; i >= 0; i--) {
        const result = this.parseResponse(strip(textBlocks[i].text));
        if (result.fed_rate_news || result.mortgage_rate_trend || result.national_housing_news?.length) {
          return result;
        }
      }
      // Fallback: join all
      const allText = strip(textBlocks.map((b) => b.text).join('\n'));
      return this.parseResponse(allText);
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch national context: ${error?.message || error}`,
        error?.stack,
      );
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

    return `You are a real estate market research analyst. Search for recent news and signals affecting the real estate market in ${locationContext}.

Search for: "${geographyName} real estate housing market ${state}" and "${geographyName} jobs employers development ${state}"

Find the top ${maxItems} most impactful items from the last ${lookbackDays} days across: employer/jobs news, housing development, policy changes, infrastructure projects, climate/insurance events, and market reports.

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
5. CRITICAL: JSON string values must be plain text only — do NOT include <cite>, HTML tags, or any markup inside JSON values. Summaries should be 2-3 sentences of clean prose.

Search and compile results for ${locationContext}:`;
  }

  /**
   * Parse JSON from Claude response text.
   * Handles: code-fenced JSON, raw JSON, and JSON embedded in conversational text.
   */
  private parseResponse(text: string): any {
    const empty = { local_news: [], economic_indicators: [], market_signals: [] };
    if (!text || text.trim().length === 0) return empty;

    // Strategy 1: markdown code block
    const jsonMatches = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/g)];
    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed && typeof parsed === 'object') {
          this.logger.log(`parseResponse: parsed from code fence`);
          return parsed;
        }
      } catch {}
    }

    // Strategy 2: raw JSON (entire text is JSON)
    try {
      const parsed = JSON.parse(text.trim());
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}

    // Strategy 3: Find JSON starting with { and containing our expected keys.
    // Locate the opening brace before "local_news" or other expected key,
    // then use string-aware brace matching to find the closing brace.
    const keyPatterns = ['"local_news"', '"economic_indicators"', '"market_signals"',
                         '"fed_rate_news"', '"mortgage_rate_trend"', '"national_housing_news"'];
    for (const keyPattern of keyPatterns) {
      const keyIdx = text.indexOf(keyPattern);
      if (keyIdx < 0) continue;

      // Walk backwards from the key to find the opening {
      let openBrace = -1;
      for (let i = keyIdx - 1; i >= 0; i--) {
        if (text[i] === '{') { openBrace = i; break; }
        // If we hit something that can't be in JSON before the first key, stop
        if (text[i] === '\n' && i < keyIdx - 5) {
          // Check if what's between here and keyIdx could be valid JSON
          const between = text.substring(i, keyIdx).trim();
          if (between && !between.startsWith('{') && between !== '') continue;
        }
      }
      if (openBrace < 0) continue;

      // String-aware brace matching from openBrace
      const closeBrace = this.findMatchingBrace(text, openBrace);
      if (closeBrace < 0) continue;

      const candidate = text.substring(openBrace, closeBrace + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object') {
          this.logger.log(`parseResponse: parsed via key-search (key=${keyPattern}, length=${candidate.length})`);
          return parsed;
        }
      } catch (e: any) {
        this.logger.warn(`parseResponse: key-search candidate failed: ${e.message?.substring(0, 80)}`);
      }
    }

    this.logger.warn(`Could not parse JSON from response (${text.length} chars). First 300 chars: ${text.substring(0, 300)}`);
    return empty;
  }

  /**
   * Find the matching closing brace for an opening brace, skipping braces inside JSON strings.
   * Returns the index of the closing brace, or -1 if not found.
   */
  private findMatchingBrace(text: string, openIndex: number): number {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = openIndex; i < text.length; i++) {
      const ch = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === '{' || ch === '[') {
        depth++;
      } else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) return i;
      }
    }

    return -1;
  }

  // ---------------------------------------------------------------------------
  // CACHING
  // ---------------------------------------------------------------------------

  private async getCachedNews(
    geographyId: string,
    geographyType: string,
  ): Promise<NewsScoutResult | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('report_news_cache')
      .select('news_data')
      .eq('geography_id', geographyId)
      .eq('geography_type', geographyType)
      .gt('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // PGRST116 = no rows found (normal), other codes = real errors
      if (error.code !== 'PGRST116') {
        this.logger.warn(`Cache query error (${error.code}): ${error.message}`);
      }
      return null;
    }

    return data?.news_data as NewsScoutResult | null;
  }

  private async cacheNewsResult(result: NewsScoutResult): Promise<void> {
    const client = this.supabase.getClient();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.cacheTtlHours);

    const { error } = await client.from('report_news_cache').upsert(
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

    if (error) {
      this.logger.warn(`Failed to cache news (${error.code}): ${error.message}`);
    }
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
    return !!this.anthropicApiKey;
  }
}
