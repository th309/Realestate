/**
 * Analytics Chat Service - v1.0.2
 *
 * Orchestrates natural language analytics queries using Claude tool-use.
 * Handles conversation state and tool execution loop.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AnalyticsToolsService } from './analytics-tools.service';
import { SupabaseService } from '../supabase/supabase.service';
import { QUINN_BASE_SYSTEM_PROMPT } from './quinn-system-prompt';
import { AIProvider } from './interfaces/ai-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ConversationState {
  id: string;
  messages: ChatMessage[];
  context?: Record<string, any>;
  createdAt: string;
  lastMessageAt: string;
}

/** Structured data for visual rendering in frontend */
export interface StructuredData {
  chart?: ChartConfig;
  table?: TableConfig;
  comparison?: ComparisonConfig;
  rankings?: RankingsData;
  /** When the analytics service returns an error in the body (e.g. no data for filter) */
  errorMessage?: string;
}

interface ChartConfig {
  type: 'bar' | 'line' | 'scatter' | 'distribution';
  title?: string;
  xLabel?: string;
  yLabel?: string;
  data: Array<{ name: string; value: number; label?: string }>;
  colorScale?: 'score' | 'appreciation' | 'neutral';
  referenceLine?: number;
  referenceLabel?: string;
}

interface TableConfig {
  title?: string;
  columns: Array<{
    key: string;
    label: string;
    type?: 'text' | 'number' | 'score' | 'percent' | 'rank';
  }>;
  rows: Array<Record<string, string | number | null>>;
  maxRows?: number;
  highlightTop?: number;
  highlightBottom?: number;
}

interface ComparisonConfig {
  title?: string;
  filteredLabel: string;
  benchmarkLabel: string;
  metrics: Array<{
    label: string;
    filtered: number | null;
    benchmark: number | null;
    unit?: 'score' | 'percent' | 'number';
    higherIsBetter?: boolean;
  }>;
}

interface RankingsData {
  title?: string;
  direction: 'top' | 'bottom';
  items: Array<{
    rank: number;
    name: string;
    score?: number;
    appreciation?: number;
    state?: string;
  }>;
}

@Injectable()
export class AnalyticsChatService {
  private readonly logger = new Logger(AnalyticsChatService.name);

  // Clients
  private anthropicClient: Anthropic | null = null;
  private openaiClient: OpenAI | null = null;

  // Configuration
  private provider: 'anthropic' | 'openai' = 'anthropic';
  private modelName: string = '';
  private providers: Map<string, AIProvider> = new Map();

  // Model tiers for dynamic escalation (Anthropic)
  private readonly MODEL_FAST = 'claude-3-haiku-20240307';
  private readonly MODEL_BALANCED = 'claude-3-5-sonnet-20241022';
  private readonly MODEL_POWERFUL = 'claude-3-opus-20240229';

  // In-memory conversation store (for MVP - consider Redis/DB for production)
  private conversations: Map<string, ConversationState> = new Map();

  // Tool result cache with TTL (5 minutes default)
  private toolCache: Map<string, { result: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Compact text digest of warm cache data — injected into LLM prompt for direct answers
  private dataDigest: string = '';

  constructor(
    private readonly configService: ConfigService,
    private readonly toolsService: AnalyticsToolsService,
    private readonly supabase: SupabaseService,
  ) {
    // Determine Provider
    const rawProvider = this.configService.get<string>('AI_PROVIDER', 'anthropic').toLowerCase();
    this.provider = (['openai', 'novita', 'groq', 'deepseek'].includes(rawProvider) ? 'openai' : 'anthropic') as any;

    // Load API Keys - Prioritize DeepSeek key if explicitly requested
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    const isDeepSeekRequest = rawProvider === 'deepseek' || rawProvider === 'novita';

    const openaiKey = isDeepSeekRequest
      ? (this.configService.get<string>('DEEPSEEK_API_KEY') || this.configService.get<string>('OPENAI_API_KEY'))
      : (this.configService.get<string>('OPENAI_API_KEY') || this.configService.get<string>('DEEPSEEK_API_KEY'));

    const baseURL = this.configService.get<string>('AI_BASE_URL');

    // Model Selection
    this.modelName = this.configService.get<string>('AI_MODEL') ||
      (this.provider === 'openai' ? 'deepseek-chat' : this.MODEL_BALANCED);

    this.logger.log(`[Quinn Init] Configured Provider: ${this.provider.toUpperCase()}`);
    this.logger.log(`[Quinn Init] Model: ${this.modelName}`);

    // Initialize OpenAI Client & Provider
    if (openaiKey) {
      try {
        const client = new OpenAI({ apiKey: openaiKey, baseURL: baseURL });
        this.openaiClient = client; // Keep for legacy if needed
        this.providers.set('openai', new OpenAIProvider(client, this.toolsService));
        this.logger.log(`[Quinn Init] OpenAI provider initialized (BaseURL: ${baseURL || 'default'})`);
      } catch (e) {
        this.logger.error(`[Quinn Init] Failed to initialize OpenAI provider: ${e.message}`);
      }
    }

    // Initialize Anthropic Client & Provider
    if (anthropicKey) {
      try {
        const client = new Anthropic({ apiKey: anthropicKey });
        this.anthropicClient = client;
        this.providers.set('anthropic', new AnthropicProvider(client, this.toolsService));
        this.logger.log('[Quinn Init] Anthropic provider initialized');
      } catch (e) {
        this.logger.error(`[Quinn Init] Failed to initialize Anthropic provider: ${e.message}`);
      }
    }

    // Initialize Anthropic Client
    if (anthropicKey) {
      if (anthropicKey.includes(' ') || anthropicKey.length < 10) {
        this.logger.error(`[Quinn Init] Invalid Anthropic API Key detected in .env: "${anthropicKey}".`);
      } else {
        try {
          this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
          this.logger.log('[Quinn Init] Anthropic client initialized');
        } catch (e) {
          this.logger.error(`[Quinn Init] Failed to initialize Anthropic client: ${e.message}`);
        }
      }
    }

    if (!this.openaiClient && !this.anthropicClient) {
      this.logger.error('[Quinn Init] No valid API keys found!');
    }

    if (this.isAvailable()) {
      // Warm cache
      this.logger.log(`[Quinn Init] Tool result caching enabled (TTL: ${this.CACHE_TTL_MS / 1000}s)`);
      setInterval(() => this.cleanExpiredCache(), 10 * 60 * 1000);
      this.warmCache().catch((err) => this.logger.error(`[Quinn Cache] Warm-up error: ${err.message}`));
    }
  }

  /**
   * Check if the service is available
   */
  isAvailable(): boolean {
    return !!this.anthropicClient || !!this.openaiClient;
  }

  /**
   * Select model - Can be overridden by AI_MODEL env var
   */
  private selectInitialModel(_message: string): string {
    return this.modelName;
  }

  /** Query intent for tool selection and iteration limits */
  private getQueryIntent(message: string): 'conversational' | 'ranking' | 'filtering' | 'comparison' | 'analysis' | 'raw_data' | 'ml_analysis' | 'news' | 'geography' {
    const lower = message.toLowerCase().trim();

    // CONVERSATIONAL - no tools needed, answer from digest/context/knowledge
    if (/^(hi|hello|hey|thanks|thank you|ok|okay|got it|cool|great)\b/i.test(lower)) return 'conversational';
    if (/^(help|what can you do|what do you do)\b/i.test(lower)) return 'conversational';
    if (/\b(how does|how do).*(scor|rating|algorithm|methodology|work)\b/.test(lower)) return 'conversational';
    if (/\bwhat('s| is) a good (score|rating)\b/.test(lower)) return 'conversational';

    // FOLLOW-UP: "out of those / of those / from that list" + price/trend → comparison so get_time_series is available
    const followUpRef = /\b(?:out of those|of those|from that list|among those|which of those|which of these|of these)\b/i.test(lower);
    const priceOrTrend = /\b(price|drop|appreciation|trend|year|growth|drastic)\b/i.test(lower);
    if (followUpRef && priceOrTrend) return 'comparison';

    // COMPARISON - check before ranking so "compare top in A to top in B" gets multiple tools/iterations
    if (/\b(compare|versus|vs|against|benchmark)\b/.test(lower)) return 'comparison';
    if (/\bhow does\b.*\b(compare|stack|rank)\b/.test(lower)) return 'comparison';
    if (/\b(difference|delta|gap)\b.*\bbetween\b/.test(lower)) return 'comparison';

    // RANKING - most common, fastest path
    const rankingPatterns = [
      /\b(hot|best|top|worst|bottom|highest|lowest|leading|trailing)\b.*\b(market|area|city|metro|state|county|zip|place|location)\b/,
      /\b(show|give|list|find).*\b(top|best|worst|bottom|hot|cold)\b/,
      /\b(rank|ranking|ranked|score|scored)\b/,
      /\bwhat are the\b.*\b(best|worst|top|bottom)\b/,
      /\bwhich\b.*(zip|metro|county|state|city|market).*(highest|lowest|best|worst|most|least)\b/,
      /\bwhich\b.*(highest|lowest|best|worst|most|least).*(zip|metro|county|state|city|market)\b/,
      /\b(highest|lowest|most|least).*(growth|appreciation|return|gain|loss)\b/,
    ];
    if (rankingPatterns.some((p) => p.test(lower))) return 'ranking';

    // FILTERING
    const filteringPatterns = [
      /\b(in|within|around)\b.*\b(texas|california|florida|state|region)\b/,
      /\b(above|below|over|under|greater|less)\b.*\b(score|price|value)\b/,
      /\b(filter|where|with)\b/,
      /\b(affordable|expensive|cheap|pricey)\b.*\b(market|area)\b/,
    ];
    if (filteringPatterns.some((p) => p.test(lower))) return 'filtering';

    // RAW DATA
    const rawPatterns = [
      /\b(raw|actual|database|table|records|query)\b/,
      /\b(show me|get|pull|fetch|retrieve|extract)\b.*\b(data|table|records|rows)\b/,
      /\b(zillow|realtor|census)\b.*\b(data|table)\b/,
    ];
    if (rawPatterns.some((p) => p.test(lower))) return 'raw_data';
    if (/\b(price|rent|value|zhvi|zri|unemployment|population|income)\b/.test(lower) &&
      !/\b(compare|rank|best|top)\b/.test(lower)) {
      return 'raw_data';
    }

    // ML/analysis
    if (/\b(predict|regression|cluster|correlat|feature.*importance|optim.*weight|backtest|validat)\b/.test(lower)) {
      return 'ml_analysis';
    }

    // News
    if (/\b(news|article|happening|recent.*event)\b/.test(lower)) return 'news';

    // Geography
    if (/\b(similar|neighbors?|nearby|like|around)\b/.test(lower)) return 'geography';

    return 'analysis';
  }

  /**
   * Max allowed tool iterations by intent (prevents over-thinking simple queries).
   */
  private getMaxIterations(intent: 'conversational' | 'ranking' | 'filtering' | 'comparison' | 'analysis' | 'raw_data' | 'ml_analysis' | 'news' | 'geography'): number {
    switch (intent) {
      case 'conversational': return 1; // No tools, direct answer
      case 'ranking': return 2; // Allow 1 retry or refinement
      case 'filtering': return 3;
      case 'comparison': return 5; // Comparison often needs multiple lookups
      case 'raw_data': return 3;
      case 'analysis': case 'ml_analysis': case 'news': case 'geography': return 5;
      default: return 5;
    }
  }

  /**
   * Build user profile section for system prompt (cached).
   * This contains stable user information that rarely changes.
   */
  private buildUserProfilePrompt(
    userMode: 'homebuyer' | 'investor',
    userPreferences?: Record<string, unknown>,
  ): string {
    const modeDescription = userMode === 'homebuyer'
      ? 'HomeReady (Homebuyer/Renter)'
      : 'InvestorEdge (Investor)';

    const primaryScore = userMode === 'homebuyer' ? 'homeready_score' : 'investoredge_score';

    // Build profile sections
    const profileSections: string[] = [];

    profileSections.push(`User Mode: ${modeDescription}`);
    profileSections.push(`Primary Score: ${primaryScore}`);
    profileSections.push(`Default Score for Queries: Use ${primaryScore} unless user specifies otherwise`);

    // Geographic preferences
    if (userPreferences?.location) {
      profileSections.push(`\nGEOGRAPHIC PREFERENCES:`);
      profileSections.push(`- Home Location: ${userPreferences.location}`);
      profileSections.push(`- When user asks for "local markets" or "my area", prioritize this location`);
    }
    if (userPreferences?.preferredStates && Array.isArray(userPreferences.preferredStates)) {
      profileSections.push(`- Preferred States: ${(userPreferences.preferredStates as string[]).join(', ')}`);
      profileSections.push(`- Consider these states when providing recommendations`);
    }

    // Financial preferences
    if (userPreferences?.budget || userPreferences?.priceRange) {
      profileSections.push(`\nFINANCIAL PREFERENCES:`);
      if (userPreferences?.budget) {
        profileSections.push(`- Budget: ${userPreferences.budget}`);
      }
      if (userPreferences?.priceRange) {
        profileSections.push(`- Price Range: ${userPreferences.priceRange}`);
      }
    }

    // Investment preferences (for investors)
    if (userMode === 'investor') {
      profileSections.push(`\nINVESTMENT PREFERENCES:`);
      if (userPreferences?.investmentStrategy) {
        profileSections.push(`- Strategy: ${userPreferences.investmentStrategy}`);
      }
      if (userPreferences?.riskTolerance) {
        profileSections.push(`- Risk Tolerance: ${userPreferences.riskTolerance}`);
      }
      if (userPreferences?.timeHorizon) {
        profileSections.push(`- Time Horizon: ${userPreferences.timeHorizon}`);
      }
      if (userPreferences?.propertyTypes && Array.isArray(userPreferences.propertyTypes)) {
        profileSections.push(`- Property Types: ${(userPreferences.propertyTypes as string[]).join(', ')}`);
      }
    }

    // Homebuyer preferences
    if (userMode === 'homebuyer') {
      profileSections.push(`\nHOMEBUYER PREFERENCES:`);
      if (userPreferences?.householdSize) {
        profileSections.push(`- Household Size: ${userPreferences.householdSize}`);
      }
      if (userPreferences?.priorities && Array.isArray(userPreferences.priorities)) {
        profileSections.push(`- Priorities: ${(userPreferences.priorities as string[]).join(', ')}`);
      }
    }

    // Saved searches / watchlist
    if (userPreferences?.watchlist && Array.isArray(userPreferences.watchlist)) {
      profileSections.push(`\nWATCHLIST:`);
      (userPreferences.watchlist as any[]).forEach((item: any) => {
        profileSections.push(`- ${item.name || item.geography_name} (${item.geography_type})`);
      });
      profileSections.push(`- Consider these markets when providing recommendations`);
    }

    return `
═══════════════════════════════════════════════════════════════════
USER PROFILE
═══════════════════════════════════════════════════════════════════

${profileSections.join('\n')}

IMPORTANT:
- Use this profile to personalize responses and default assumptions
- When user asks general queries without specifying location, consider their preferences
- When choosing which score to use by default, use the Primary Score above
- This profile persists across the conversation session
`;
  }

  /**
   * Build dynamic context sent per-query (session-only, not cached).
   * Only includes information that changes frequently (conversation history).
   * When the latest user message refers to "those/them/from that list", include
   * more of the previous assistant reply so "those" is unambiguous.
   */
  private buildDynamicContext(
    conversationHistory: ChatMessage[],
  ): string {
    const recentHistory = conversationHistory.slice(-4);
    const lastMsg = recentHistory[recentHistory.length - 1];
    const lastIsUser = lastMsg?.role === 'user';
    const lastContent = typeof lastMsg?.content === 'string' ? lastMsg.content : '';
    const followUpRef = /\b(?:out of those|of those|from that list|among those|which of those|which of these|of these)\b/i.test(lastContent);

    const historyContext = recentHistory.length > 0
      ? recentHistory
        .map((msg) => {
          const content = typeof msg.content === 'string' ? msg.content.substring(0, 150) : '[Tool usage]';
          return `${msg.role}: ${content}`;
        })
        .join('\n')
      : 'First query in conversation';

    let refBlock = '';
    if (followUpRef && lastIsUser && conversationHistory.length >= 2) {
      const prevAssistant = [...conversationHistory].reverse().find((m) => m.role === 'assistant');
      if (prevAssistant && typeof prevAssistant.content === 'string') {
        const excerpt = prevAssistant.content.substring(0, 800);
        refBlock = `\n\nREFERENCE (what "those" / "that list" refers to — from your previous reply):\n${excerpt}${prevAssistant.content.length > 800 ? '...' : ''}\n\n`;
      }
    }

    return `RECENT CONVERSATION HISTORY:
${historyContext}${refBlock}
USER QUERY:`;
  }

  /**
   * Filter tools STRICTLY based on query intent
   * This is the key to fast responses - Claude sees fewer tools = faster decisions
   */
  private getRelevantTools(message: string): any[] {
    const allTools = this.toolsService.getToolDefinitions();
    const intent = this.getQueryIntent(message);

    this.logger.log(`[Quinn Intent] Detected: ${intent}`);

    switch (intent) {
      case 'conversational':
        this.logger.log(`[Quinn Tools] Conversational - NO tools (direct answer from digest/context)`);
        return [];

      case 'ranking':
        this.logger.log(`[Quinn Tools] Ranking - ONLY get_rankings (1 tool)`);
        return allTools.filter((t) => t.name === 'get_rankings');

      case 'filtering':
        this.logger.log(`[Quinn Tools] Filtering - filter_geographies + get_rankings + analyze_data`);
        return allTools.filter((t) =>
          ['filter_geographies', 'get_rankings', 'analyze_data'].includes(t.name)
        );

      case 'comparison':
        this.logger.log(`[Quinn Tools] Comparison - benchmark + ranking/filter + time_series`);
        return allTools.filter((t) =>
          ['compare_to_benchmark', 'analyze_data', 'get_rankings', 'filter_geographies', 'get_time_series'].includes(t.name)
        );

      case 'analysis':
        this.logger.log(`[Quinn Tools] Analysis - cached tools only (no raw DB)`);
        return allTools.filter((t) =>
          !['query_database_table', 'search_database', 'aggregate_database', 'get_database_summary', 'get_database_tables', 'describe_database_table'].includes(t.name)
        );

      case 'raw_data':
        this.logger.log(`[Quinn Tools] Raw data - database tools`);
        return allTools.filter((t) =>
          ['query_database_table', 'describe_database_table', 'aggregate_database', 'search_database'].includes(t.name)
        );

      case 'ml_analysis':
        this.logger.log(`[Quinn Tools] ML query - analysis tools`);
        return allTools.filter((t) =>
          ['run_regression', 'get_feature_importance', 'cluster_markets',
            'optimize_weights', 'analyze_raw_metrics', 'get_raw_metric_summary'].includes(t.name)
        );

      case 'news':
        this.logger.log(`[Quinn Tools] News - news tools`);
        return allTools.filter((t) =>
          ['search_real_estate_news', 'analyze_news_impact'].includes(t.name)
        );

      case 'geography':
        this.logger.log(`[Quinn Tools] Geography - location tools`);
        return allTools.filter((t) =>
          ['find_similar_geographies', 'compare_to_neighbors', 'find_neighboring_geographies'].includes(t.name)
        );

      default:
        this.logger.log(`[Quinn Tools] Default - core tools`);
        return allTools.filter((t) =>
          ['get_rankings', 'filter_geographies', 'analyze_data', 'compare_to_benchmark'].includes(t.name)
        );
    }
  }

  /**
   * Generate cache key from tool name and input parameters
   */
  private getCacheKey(toolName: string, input: Record<string, any>): string {
    return `${toolName}::${JSON.stringify(input)}`;
  }

  /**
   * Get cached tool result if available and not expired
   */
  private getCachedResult(toolName: string, input: Record<string, any>): any | null {
    const cacheKey = this.getCacheKey(toolName, input);
    const cached = this.toolCache.get(cacheKey);

    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL_MS) {
      // Expired - remove from cache
      this.toolCache.delete(cacheKey);
      return null;
    }

    this.logger.log(`[Quinn Cache] HIT for ${toolName} (age: ${Math.round(age / 1000)}s)`);
    return cached.result;
  }

  /**
   * Store tool result in cache
   */
  private cacheResult(toolName: string, input: Record<string, any>, result: any): void {
    const cacheKey = this.getCacheKey(toolName, input);
    this.toolCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clean up expired cache entries (called periodically)
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.toolCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        this.toolCache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.log(`[Quinn Cache] Cleaned ${removed} expired entries`);
    }
  }

  /**
   * Build a compact text digest from warm cache results.
   * Injected into the LLM system prompt so it can answer common queries
   * directly without tool calls. ~5-8 KB of dense text.
   */
  private buildDataDigest(): void {
    const lines: string[] = [];
    lines.push('CURRENT DATA SNAPSHOT (answer directly from this when possible, no tool call needed):');
    lines.push(`Data as of: ${new Date().toISOString().slice(0, 10)}`);
    lines.push('');

    // Helper: extract ranking lines from a cached tool result
    const formatRankings = (toolName: string, params: Record<string, any>, label: string): string | null => {
      const cacheKey = this.getCacheKey(toolName, params);
      const cached = this.toolCache.get(cacheKey);
      if (!cached?.result?.success) return null;

      const rankings = cached.result.data?.rankings;
      if (!Array.isArray(rankings) || rankings.length === 0) return null;

      const items = rankings.map((r: any) => {
        const name = (r.geography_name || r.name || r.geography_id || '').replace(/,/g, '');
        const score = r.score != null ? r.score.toFixed(1) : '';
        const appr = r.appreciation_12m != null ? ` (${(r.appreciation_12m * 100).toFixed(1)}%)` : '';
        return `${name} ${score}${appr}`;
      });

      return `${label}: ${items.join(', ')}`;
    };

    // Helper: extract benchmark data
    const formatBenchmark = (params: Record<string, any>): string | null => {
      const cacheKey = this.getCacheKey('compare_to_benchmark', params);
      const cached = this.toolCache.get(cacheKey);
      if (!cached?.result?.success) return null;

      const comp = cached.result.data?.comparison;
      if (!comp) return null;

      const parts: string[] = [];
      if (comp.benchmark_avg_score != null) parts.push(`avg score ${comp.benchmark_avg_score.toFixed(1)}`);
      if (comp.benchmark_avg_appreciation_12m != null) parts.push(`avg 12m appr ${(comp.benchmark_avg_appreciation_12m * 100).toFixed(1)}%`);
      if (comp.avg_investoredge_score != null) parts.push(`avg investoredge ${comp.avg_investoredge_score.toFixed(1)}`);
      if (comp.avg_homeready_score != null) parts.push(`avg homeready ${comp.avg_homeready_score.toFixed(1)}`);
      if (comp.avg_market_health_score != null) parts.push(`avg market_health ${comp.avg_market_health_score.toFixed(1)}`);

      return parts.length > 0 ? `NATIONAL BENCHMARK: ${parts.join(', ')}` : null;
    };

    const scoreLabels: Record<string, string> = {
      investoredge_score: 'INVESTOREDGE',
      homeready_score: 'HOMEREADY',
      market_health_score: 'MARKET_HEALTH',
    };

    // --- TOP METROS BY EACH SCORE TYPE (top 10 from cached top-20) ---
    for (const scoreType of ['investoredge_score', 'homeready_score', 'market_health_score'] as const) {
      const label = scoreLabels[scoreType];
      const top = formatRankings('get_rankings', {
        filter: { geography_type: 'metro', score_type: scoreType }, limit: 10, ascending: false,
      }, `TOP 10 METROS BY ${label}`);
      if (top) lines.push(top);
    }

    // --- BOTTOM METROS ---
    for (const scoreType of ['investoredge_score', 'homeready_score'] as const) {
      const label = scoreLabels[scoreType];
      const bottom = formatRankings('get_rankings', {
        filter: { geography_type: 'metro', score_type: scoreType }, limit: 10, ascending: true,
      }, `BOTTOM 10 METROS BY ${label}`);
      if (bottom) lines.push(bottom);
    }

    // --- STATE-LEVEL RANKINGS ---
    lines.push('');
    for (const scoreType of ['investoredge_score', 'homeready_score'] as const) {
      const label = scoreLabels[scoreType];
      const top = formatRankings('get_rankings', {
        filter: { geography_type: 'state', score_type: scoreType }, limit: 10, ascending: false,
      }, `TOP 10 STATES BY ${label}`);
      if (top) lines.push(top);
    }
    const bottomStates = formatRankings('get_rankings', {
      filter: { geography_type: 'state', score_type: 'investoredge_score' }, limit: 10, ascending: true,
    }, 'BOTTOM 10 STATES BY INVESTOREDGE');
    if (bottomStates) lines.push(bottomStates);

    // --- TOP METROS BY STATE (InvestorEdge + HomeReady) ---
    lines.push('');
    const popularStates = ['TX', 'CA', 'FL', 'AZ', 'NC', 'GA', 'TN', 'CO', 'WA', 'OH'];
    for (const state of popularStates) {
      const ie = formatRankings('get_rankings', {
        filter: { geography_type: 'metro', score_type: 'investoredge_score', states: [state] }, limit: 10, ascending: false,
      }, `TOP ${state} METROS (INVESTOREDGE)`);
      if (ie) lines.push(ie);

      const hr = formatRankings('get_rankings', {
        filter: { geography_type: 'metro', score_type: 'homeready_score', states: [state] }, limit: 10, ascending: false,
      }, `TOP ${state} METROS (HOMEREADY)`);
      if (hr) lines.push(hr);
    }

    // --- TOP COUNTIES ---
    const counties = formatRankings('get_rankings', {
      filter: { geography_type: 'county', score_type: 'investoredge_score' }, limit: 10, ascending: false,
    }, 'TOP 10 COUNTIES BY INVESTOREDGE');
    if (counties) { lines.push(''); lines.push(counties); }

    // --- NATIONAL BENCHMARKS ---
    lines.push('');
    for (const scoreType of ['investoredge_score', 'homeready_score'] as const) {
      const benchmark = formatBenchmark({
        filter: { geography_type: 'metro', score_type: scoreType }, benchmark_type: 'national',
      });
      if (benchmark) lines.push(benchmark);
    }

    // Only set digest if we got meaningful content (more than just the header)
    if (lines.length > 3) {
      this.dataDigest = lines.join('\n');
      this.logger.log(`[Quinn Digest] Built data digest: ${this.dataDigest.length} bytes, ${lines.length} lines`);
    } else {
      this.dataDigest = '';
      this.logger.warn('[Quinn Digest] No cached data available for digest');
    }
  }

  /**
   * Warm cache on startup with most common queries
   * Covers ~90% of typical user queries
   */
  private async warmCache(): Promise<void> {
    this.logger.log(`[Quinn Cache] Starting cache warm-up...`);
    const startTime = Date.now();
    let cached = 0;

    // API expects filter object for get_rankings, compare_to_benchmark, analyze_data
    // Queries are driven by test prompt patterns — see scripts/quinn-test/
    const popularStates = ['TX', 'CA', 'FL', 'AZ', 'NC', 'GA', 'TN', 'CO', 'WA', 'OH'];
    const commonQueries: Array<{ tool: string; params: Record<string, any> }> = [
      // === TOP/BOTTOM METROS BY EACH SCORE TYPE ===
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score' }, limit: 10, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score' }, limit: 20, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'homeready_score' }, limit: 10, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'homeready_score' }, limit: 20, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'market_health_score' }, limit: 10, ascending: false } },
      // Bottom performers
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score' }, limit: 10, ascending: true } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'homeready_score' }, limit: 10, ascending: true } },

      // === STATE-LEVEL RANKINGS (test: "best states for investing") ===
      { tool: 'get_rankings', params: { filter: { geography_type: 'state', score_type: 'investoredge_score' }, limit: 10, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'state', score_type: 'homeready_score' }, limit: 10, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'state', score_type: 'investoredge_score' }, limit: 10, ascending: true } },

      // === COUNTY LEVEL ===
      { tool: 'get_rankings', params: { filter: { geography_type: 'county', score_type: 'investoredge_score' }, limit: 10, ascending: false } },

      // === TOP METROS BY STATE — InvestorEdge + HomeReady for popular states ===
      ...popularStates.map(st => ({
        tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score', states: [st] }, limit: 10, ascending: false },
      })),
      ...popularStates.map(st => ({
        tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'homeready_score', states: [st] }, limit: 10, ascending: false },
      })),

      // === BENCHMARK & ANALYSIS ===
      { tool: 'compare_to_benchmark', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score' }, benchmark_type: 'national' } },
      { tool: 'compare_to_benchmark', params: { filter: { geography_type: 'metro', score_type: 'homeready_score' }, benchmark_type: 'national' } },
      { tool: 'analyze_data', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score' }, horizons: [12, 36] } },

      // === REALTOR HOTNESS ===
      { tool: 'query_database_table', params: { table_name: 'realtor_metro', columns: ['hotness_rank', 'median_listing_price'], order_by: 'hotness_rank', limit: 10 } },
    ];

    // Execute queries in parallel batches to avoid overwhelming the Python service
    const batchSize = 5;
    for (let i = 0; i < commonQueries.length; i += batchSize) {
      const batch = commonQueries.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async ({ tool, params }) => {
          try {
            this.logger.log(`[Quinn Cache] Warming ${tool} with params: ${JSON.stringify(params).slice(0, 100)}`);

            const result = await this.toolsService.executeTool(tool, params);

            if (result.success) {
              this.cacheResult(tool, params, result);
              cached++;
              this.logger.log(`[Quinn Cache] ✓ Cached ${tool}`);
            } else {
              this.logger.warn(`[Quinn Cache] ✗ Failed to cache ${tool}: ${result.error}`);
            }
          } catch (error) {
            this.logger.error(`[Quinn Cache] Error warming ${tool}: ${error.message}`);
          }
        }),
      );

      // Small delay between batches to avoid overwhelming the service
      if (i + batchSize < commonQueries.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(`[Quinn Cache] ✓ Warm-up complete: ${cached}/${commonQueries.length} queries cached in ${duration}ms`);
    this.logger.log(`[Quinn Cache] Cache now contains ${this.toolCache.size} entries`);

    // Build compact text digest from cached results for LLM prompt injection
    this.buildDataDigest();
  }



  /**
   * Process a chat message with streaming response
   * Yields text chunks as they're generated
   */
  async * chatStream(
    conversationId: string,
    userMessage: string,
    context?: Record<string, any>,
  ): AsyncGenerator<{ type: 'text' | 'tool' | 'done'; content: any }> {
    if (!this.providers.size) throw new Error('AI Provider not initialized - check API Keys');

    let conversation = this.conversations.get(conversationId);
    if (!conversation) {
      conversation = {
        id: conversationId,
        messages: [],
        context,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
      };
      this.conversations.set(conversationId, conversation);
    }
    if (context) {
      conversation.context = { ...conversation.context, ...context };
    }

    const queryIntent = this.getQueryIntent(userMessage);
    const maxIterations = this.getMaxIterations(queryIntent);
    this.logger.log(`[Quinn Stream Intent] Detected intent: ${queryIntent}`);

    const rawTools = this.getRelevantTools(userMessage);
    this.logger.log(`[Quinn Stream Tools] Providing ${rawTools.length} tools`);

    const userMode = (conversation.context?.userMode as 'homebuyer' | 'investor') || 'homebuyer';
    const userProfilePrompt = this.buildUserProfilePrompt(userMode, conversation.context as any);
    // Only inject data digest for intents that benefit from it (saves tokens for ML/news/raw_data/geography)
    const digestIntents = new Set(['conversational', 'ranking', 'filtering', 'comparison']);
    const systemPrompt = this.dataDigest && digestIntents.has(queryIntent)
      ? `${userProfilePrompt}\n${this.dataDigest}`
      : userProfilePrompt;

    conversation.messages.push({ role: 'user', content: userMessage });
    conversation.lastMessageAt = new Date().toISOString();

    const initialModel = this.selectInitialModel(userMessage);
    const providerOrder = this.provider === 'anthropic' ? ['anthropic', 'openai'] : ['openai', 'anthropic'];

    let successful = false;
    let lastError: Error | null = null;
    let accumulatedText = '';

    for (const providerId of providerOrder) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      let loopModel = initialModel;
      if (providerId !== this.provider) {
        loopModel = providerId === 'anthropic' ? this.MODEL_BALANCED : 'deepseek-chat';
      }

      try {
        this.logger.log(`[Quinn Stream] Starting via ${providerId.toUpperCase()} (${loopModel})...`);

        const stream = provider.chatStream({
          conversationId,
          messages: conversation.messages,
          tools: rawTools,
          systemPrompt,
          model: loopModel,
          maxIterations
        });

        for await (const chunk of stream) {
          if (chunk.type === 'text') accumulatedText += chunk.content;
          yield chunk;
        }

        successful = true;
        break;

      } catch (e) {
        this.logger.warn(`[Quinn Stream] Provider ${providerId} failed: ${e.message}`);
        lastError = e;
      }
    }

    if (!successful) throw lastError || new Error('No AI provider available');

    conversation.messages.push({ role: 'assistant', content: accumulatedText });
  }


  /**
   * Process a chat message and return response (non-streaming)
   */
  /**
   * Process a chat message and return response (non-streaming)
   * Using configured AI Providers with fallback support.
   */
  async chat(
    conversationId: string,
    userMessage: string,
    context?: Record<string, any>,
  ): Promise<{
    response: string;
    toolsUsed: string[];
    structuredData?: StructuredData;
    modelUsed?: string;
    metadata?: { intent: string; toolCallCount: number; totalExecutionTime: number };
  }> {
    if (!this.providers.size) throw new Error('AI Provider not initialized - check API Keys');

    let conversation = this.conversations.get(conversationId);
    if (!conversation) {
      conversation = {
        id: conversationId,
        messages: [],
        context,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
      };
      this.conversations.set(conversationId, conversation);
      this.logger.log(`Created new conversation: ${conversationId}`);
    }

    if (context) {
      conversation.context = { ...conversation.context, ...context };
    }

    const queryIntent = this.getQueryIntent(userMessage);
    const maxIterations = this.getMaxIterations(queryIntent);
    this.logger.log(`[Quinn Intent] Detected: ${queryIntent}, max iterations: ${maxIterations}`);

    const rawTools = this.getRelevantTools(userMessage);
    this.logger.log(`[Quinn Tools] Providing ${rawTools.length} tools`);

    // Add user message to history (Provider will use this history)
    conversation.messages.push({ role: 'user', content: userMessage });
    conversation.lastMessageAt = new Date().toISOString();

    const userMode = (conversation.context?.userMode as 'homebuyer' | 'investor') || 'homebuyer';
    const userProfilePrompt = this.buildUserProfilePrompt(userMode, conversation.context as any);
    // Only inject data digest for intents that benefit from it (saves tokens for ML/news/raw_data/geography)
    const digestIntents = new Set(['conversational', 'ranking', 'filtering', 'comparison']);
    const systemPrompt = this.dataDigest && digestIntents.has(queryIntent)
      ? `${userProfilePrompt}\n${this.dataDigest}`
      : userProfilePrompt;
    const dynamicContext = this.buildDynamicContext(conversation.messages);

    // Initial Model Selection
    const initialModel = this.selectInitialModel(userMessage);
    const providerOrder = this.provider === 'anthropic' ? ['anthropic', 'openai'] : ['openai', 'anthropic'];

    let successful = false;
    let lastError: Error | null = null;
    let finalResult: any = null;
    let usedModel = '';
    const chatStartTime = Date.now();
    let accumulatedToolsUsed: string[] = [];

    for (const providerId of providerOrder) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      let loopModel = initialModel;
      if (providerId !== this.provider) {
        loopModel = providerId === 'anthropic' ? this.MODEL_BALANCED : 'deepseek-chat';
      }

      try {
        this.logger.log(`[Quinn Chat] Processing via ${providerId} (${loopModel})`);

        // Inject dynamic context into the last message for the provider call
        // We clone messages to avoid mutating conversation persistence permanently with verbose context
        const messagesForProvider = conversation.messages.map((m, i, arr) => {
          if (i === arr.length - 1 && m.role === 'user') {
            return { ...m, content: `${dynamicContext}\n${m.content}` };
          }
          return m;
        });

        const result = await provider.chat({
          conversationId,
          messages: messagesForProvider,
          tools: rawTools,
          systemPrompt,
          model: loopModel,
          maxIterations
        });

        conversation.messages.push({ role: 'assistant', content: result.content });
        finalResult = result;
        usedModel = loopModel;
        accumulatedToolsUsed = result.toolsUsed;
        successful = true;
        break;

      } catch (e) {
        this.logger.warn(`[Quinn Chat] Provider ${providerId} failed: ${e.message}`);
        lastError = e;
      }
    }

    if (!successful) throw lastError || new Error('No AI provider available');

    // Extract structured data fallback logic
    this.logger.debug(`[Quinn Chat] Mapping ${finalResult.toolResults.length} tool results for extraction`);
    const toolResultsData = finalResult.toolResults.map((r: any, idx: number) => {
      this.logger.debug(`[Quinn Chat] Result ${idx}: toolName=${r.toolName || 'MISSING'}, dataKeys=${JSON.stringify(Object.keys(r.data || {}))}`);
      return {
        toolName: r.toolName || 'unknown',
        data: r.data
      };
    });

    this.logger.debug(`[Quinn Chat] Starting structured data extraction for message: "${userMessage?.slice(0, 50)}..."`);
    const structuredData = this.extractStructuredData(toolResultsData, userMessage);
    if (structuredData) {
      this.logger.log(`[Quinn Chat] Extraction SUCCESS: ${JSON.stringify(Object.keys(structuredData))}`);
    } else {
      this.logger.warn(`[Quinn Chat] Extraction returned UNDEFINED`);
    }

    // Fallback response generation
    if (!finalResult.content && structuredData) {
      finalResult.content = this.buildFallbackResponseFromStructuredData(structuredData);
      // correction in history
      conversation.messages[conversation.messages.length - 1].content = finalResult.content;
    }

    const processingTime = Date.now() - chatStartTime;
    this.logger.log(`[Quinn Chat] Completed. Tools: ${accumulatedToolsUsed.length}, Time: ${processingTime}ms`);

    return {
      response: finalResult.content || (finalResult.toolsUsed && finalResult.toolsUsed.length > 0 ?
        'Here are the results from your request.' :
        'I processed that but have no text response.'),
      toolsUsed: accumulatedToolsUsed,
      structuredData,
      modelUsed: usedModel,
      metadata: {
        intent: queryIntent,
        toolCallCount: accumulatedToolsUsed.length,
        totalExecutionTime: processingTime
      }
    };
  }

  /**
   * Parse "tell me about [geo]" / "market in [geo]" for single-geography focus. Returns geography name or null.
   * When present, get_rankings table is filtered to only that geography (no state-wide list).
   */
  private parseSingleGeographyFocus(userMessage: string): string | null {
    const m = userMessage.trim();
    let match = m.match(/\btell\s+me\s+(?:everything\s+)?about\s+(?:the\s+)?(?:market\s+in\s+)?([^,.?!]+?)(?:\s+market|\s+metro|\s+county|$|\.|\?|,)/i);
    if (match) return match[1].trim();
    match = m.match(/(?:market|metro|area)\s+in\s+([^,.?!]+?)(?:\s+market|\s+metro|$|\.|\?|,)/i);
    if (match) return match[1].trim();
    match = m.match(/\b(?:analyze|profile|report\s+on)\s+(?:the\s+)?([^,.?!]+?)(?:\s+market|$|\.|\?|,)/i);
    if (match) return match[1].trim();
    return null;
  }

  /**
   * Parse "compare A and B" / "A vs B" from user message. Returns [nameA, nameB] or null.
   * Works for any geography level (metros, counties, zips, states).
   */
  private parseCompareTwoGeographies(userMessage: string): [string, string] | null {
    const m = userMessage.trim();
    // "compare zip codes 21701 and 22309" / "compare zip code X and Y" / "compare zips X and Y"
    const zipMatch = m.match(/\bcompare\s+(?:zip\s*codes?|zips?)\s+(\d{5})\s+and\s+(\d{5})/i)
      || m.match(/\bcompare\s+.+?\s+(\d{5})\s+and\s+(\d{5})/i);
    if (zipMatch) return [zipMatch[1], zipMatch[2]];

    let match = m.match(/\bcompare\s+(.+?)\s+and\s+(.+?)(?:\s+as|\s+using|$|,|\.)/i);
    if (match) {
      const a = match[1].trim().replace(/\s+as\s+.*$/i, '').trim();
      const b = match[2].trim().replace(/\s+as\s+.*$/i, '').trim();
      if (a && b) return [a, b];
    }
    match = m.match(/(.+?)\s+vs\.?\s+(.+?)(?:\s+as|\s+using|$|,|\.)/i);
    if (match) {
      const a = match[1].trim();
      const b = match[2].trim();
      if (a && b && a.length > 1 && b.length > 1) return [a, b];
    }
    match = m.match(/(.+?)\s+and\s+(.+?)\s+as\s+(investment|homebuyer|market)/i);
    if (match) {
      const a = match[1].trim();
      const b = match[2].trim();
      if (a && b) return [a, b];
    }
    return null;
  }

  /**
   * Extract structured data from tool results for visual rendering.
   * When user asked to "compare A and B" (any geography), filters get_rankings to only those geographies.
   */
  private extractStructuredData(
    toolResults: Array<{ toolName: string; data: any }>,
    userMessage?: string,
  ): StructuredData | undefined {
    if (toolResults.length === 0) return undefined;

    const structured: StructuredData = {};
    const compareNames = userMessage ? this.parseCompareTwoGeographies(userMessage) : null;
    const singleGeoFocus = userMessage && !compareNames ? this.parseSingleGeographyFocus(userMessage) : null;

    for (const { toolName, data } of toolResults) {
      if (!data) {
        this.logger.warn(`[Quinn Extract] Skipping tool ${toolName} due to null data`);
        continue;
      }
      this.logger.debug(`[Quinn Extract] Processing tool: ${toolName}, data keys: ${JSON.stringify(Object.keys(data || {}))}`);

      // Unwrap if data is nested under data.data (analytics service wraps responses)
      const actualData = data.data || data;
      if (!actualData) {
        this.logger.warn(`[Quinn Extract] Skipping tool ${toolName} due to null actualData`);
        continue;
      }
      this.logger.debug(`[Quinn Extract] Actual data keys: ${JSON.stringify(Object.keys(actualData || {}))}`);

      // Handle rankings from get_rankings tool (including failed calls: data = { success, data, error })
      if (toolName === 'get_rankings') {
        const isFailed = data?.success === false && data?.error;
        if (isFailed) {
          structured.errorMessage = data.error;
        } else if (actualData?.error && (!actualData.rankings || actualData.rankings.length === 0)) {
          structured.errorMessage = actualData.error;
        }
        if (actualData?.rankings?.length) {
          let items = actualData.rankings.map((item: any) => ({
            rank: item.rank,
            name: item.geography_name || item.geography_id,
            id: item.geography_id,
            score: item.score,
            appreciation: (Math.abs(item.appreciation_12m) > 100)
              ? item.appreciation_12m / 100
              : item.appreciation_12m,
            state: item.state,
          }));
          // "Compare A and B" (any geography): show only the requested geographies, not a generic top-N
          if (compareNames && compareNames.length === 2) {
            const [na, nb] = compareNames.map((s) => s.toLowerCase().trim());
            items = items.filter(
              (it: { name: string; id?: string }) => {
                const name = (it.name || '').toLowerCase();
                const id = (it.id ?? '').toString().toLowerCase();
                return name.includes(na) || id.includes(na) || name.includes(nb) || id.includes(nb);
              },
            );
            if (items.length > 0) {
              this.logger.log(`[Quinn Extract] Filtered to ${items.length} items for "compare ${compareNames[0]} and ${compareNames[1]}"`);
            }
          } else if (singleGeoFocus) {
            // "Tell me about [geo]" / "market in [geo]": show only that geography, not full state list
            const focus = singleGeoFocus.toLowerCase();
            items = items.filter((it: { name: string }) => (it.name || '').toLowerCase().includes(focus));
            if (items.length > 0) {
              this.logger.log(`[Quinn Extract] Filtered to ${items.length} item(s) for single-geo focus "${singleGeoFocus}"`);
            }
          }
          this.logger.debug(`[Quinn Extract] Found rankings: ${items.length} items`);
          structured.rankings = {
            title: compareNames ? 'Comparison' : singleGeoFocus ? `${singleGeoFocus} — Performance` : (actualData.direction === 'bottom' ? 'Bottom Performers' : 'Top Performers'),
            direction: actualData.direction || 'top',
            items,
          };
        }
      }

      // Handle comparison from compare_to_benchmark tool
      if (toolName === 'compare_to_benchmark' && actualData.comparison) {
        const comp = actualData.comparison;
        structured.comparison = {
          title: 'Benchmark Comparison',
          filteredLabel: 'Selected Markets',
          benchmarkLabel: comp.benchmark_name || 'National',
          metrics: [],
        };

        if (comp.score) {
          structured.comparison.metrics.push({
            label: 'Average Score',
            filtered: comp.score.filtered_mean,
            benchmark: comp.score.benchmark_mean,
            unit: 'score',
            higherIsBetter: true,
          });
        }

        if (comp.appreciation_12m) {
          structured.comparison.metrics.push({
            label: '1-Year Appreciation',
            filtered: comp.appreciation_12m.filtered_mean_pct,
            benchmark: comp.appreciation_12m.benchmark_mean_pct,
            unit: 'percent',
            higherIsBetter: true,
          });
        }

        if (comp.appreciation_36m) {
          structured.comparison.metrics.push({
            label: '3-Year Appreciation',
            filtered: comp.appreciation_36m.filtered_mean_pct,
            benchmark: comp.appreciation_36m.benchmark_mean_pct,
            unit: 'percent',
            higherIsBetter: true,
          });
        }
      }

      // Handle analysis results from analyze_data tool
      if (toolName === 'analyze_data' && actualData.top_performers) {
        // Create a table for top performers
        structured.table = {
          title: 'Top Performers',
          columns: [
            { key: 'rank', label: '#', type: 'rank' },
            { key: 'name', label: 'Market', type: 'text' },
            { key: 'score', label: 'Score', type: 'score' },
            { key: 'appreciation', label: '12M Return', type: 'percent' },
          ],
          rows: actualData.top_performers.slice(0, 10).map((p: any, i: number) => ({
            rank: i + 1,
            name: p.geography_name || p.geography_id,
            score: p.score,
            appreciation: p.appreciation_12m,
          })),
          highlightTop: 3,
        };

        // Create distribution chart if available
        if (actualData.chart_data?.distribution) {
          const dist = actualData.chart_data.distribution;
          structured.chart = {
            type: 'distribution',
            title: 'Score Distribution',
            xLabel: 'Score',
            yLabel: 'Count',
            data: dist.bins.slice(0, -1).map((bin: number, i: number) => ({
              name: `${bin.toFixed(0)}-${dist.bins[i + 1].toFixed(0)}`,
              value: dist.counts[i],
              label: `${bin.toFixed(0)}-${dist.bins[i + 1].toFixed(0)}: ${dist.counts[i]} markets`,
            })),
            colorScale: 'score',
          };
        }
      }
    }

    // Return undefined if no structured data was extracted
    return Object.keys(structured).length > 0 ? structured : undefined;
  }

  /**
   * Format rankings for inclusion in the response text (intro + list).
   */
  private formatRankingsForResponse(rankings: StructuredData['rankings']): string {
    if (!rankings?.items?.length) return '';
    const label = rankings.direction === 'bottom' ? 'Bottom' : 'Top';
    const top = rankings.items.slice(0, 10);
    const lines = top.map(
      (i) => `${i.rank}. ${i.name}${i.score != null ? ` (${i.score})` : ''}${i.state ? `, ${i.state}` : ''}`,
    );
    return `${label} markets:\n${lines.join('\n')}`;
  }

  /**
   * Build a short fallback text from structured data when the model returned no text.
   * Ensures the user always receives an answer when tools succeeded.
   */
  private buildFallbackResponseFromStructuredData(structured: StructuredData): string {
    const parts: string[] = [];
    if (structured.errorMessage) {
      parts.push(`Unable to retrieve rankings: ${structured.errorMessage}`);
    }
    if (structured.rankings?.items?.length) {
      const label = structured.rankings.direction === 'bottom' ? 'bottom' : 'top';
      parts.push(`Here are the ${label} markets.`);
    }
    if (structured.comparison) {
      parts.push('Comparison to benchmark is available in the data.');
    }
    if (structured.table) {
      parts.push('Analysis results are available in the data.');
    }
    return parts.length > 0 ? parts.join('\n\n') : '';
  }

  /**
   * Get conversation history
   */
  getConversation(conversationId: string): ConversationState | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Clear conversation history
   */
  clearConversation(conversationId: string): boolean {
    const existed = this.conversations.has(conversationId);
    this.conversations.delete(conversationId);
    if (existed) {
      this.logger.log(`Cleared conversation: ${conversationId}`);
    }
    return existed;
  }

  /**
   * List all active conversations (for debugging)
   */
  listConversations(): string[] {
    return Array.from(this.conversations.keys());
  }

  private buildSystemPrompt(context?: Record<string, any>): string {
    let prompt = `You are Quinn, PropertyIQ's real estate analytics assistant. Answer concisely using the right tools.

## CRITICAL RULES - FOLLOW EXACTLY

1. **NEVER EXPLORE** - Don't call get_available_filters, describe_database_table, or get_database_summary first
   - Just call the action tool directly
   - If it fails, THEN try alternatives

2. **ASK ABOUT GEOGRAPHY LEVEL** when the query could apply to multiple levels:
   - PropertyIQ has data for: metro (MSA), county, ZIP code, and state levels
   - For broad queries like "hot markets", "best places to invest", "top performers":
     * If user doesn't specify, ASK: "Would you like me to analyze metros (major metropolitan areas), counties, ZIP codes, or states?"
     * Explain briefly: metros=large urban areas, counties=local markets, ZIPs=neighborhood-level, states=broad regional trends
   - If user specifies a level (e.g., "top counties"), use that directly
   - Default to metro ONLY when user explicitly says "metros" or "MSAs" or for questions about specific named metros

3. **"Hot markets" or "Top markets" → ASK about geography level first, THEN get_rankings**
   - ASK the user which geography level they want
   - get_rankings supports: geography_type="metro", "county", "zip", or "state"
   - Returns COMPLETE data (names, scores, appreciation)

4. **PropertyIQ Scores → get_rankings ONLY**
   - ❌ NEVER query_database_table on propertyiq_scores
   - ✅ ALWAYS get_rankings, analyze_data, compare_to_benchmark

5. **Raw Data → query_database_table**
   - Zillow: zhvi, zri, inventory
   - Realtor: hotness_rank, median_listing_price
   - Census: population, median_income

6. **Efficiency: 1-2 tool calls maximum for simple queries**

## GEOGRAPHY LEVEL GUIDE

| Level | Best For | Example |
|-------|----------|---------|
| metro | Major urban markets, MSA comparisons | "Austin-Round Rock, TX" |
| county | Local market analysis, suburban areas | "Travis County, TX" |
| zip | Neighborhood-level precision | "Austin, TX 78701" |
| state | Broad regional trends | "Texas" |

## COMMON QUERIES

**"Find hot markets"** → First ASK which geography level, then get_rankings(geography_type=USER_CHOICE, score_type="investoredge", limit=10)

**"Top Texas metros"** → get_rankings(geography_type="metro", score_type="investoredge", states=["TX"], limit=10)

**"Best counties for investment"** → get_rankings(geography_type="county", score_type="investoredge", limit=10)

**"Realtor hotness"** → query_database_table(table_name="realtor_metro", columns=["geography_name","hotness_rank"], order_by={"hotness_rank":"asc"}, limit=10)

**"Austin home prices"** → query_database_table(table_name="zillow_metro", filters={"geography_name":{"like":"%Austin%"}})

## METRIC MAPPINGS
- "home price" → zhvi (Zillow) or median_listing_price (Realtor)
- "rent" → zri (Zillow)
- "hottest markets" → hotness_rank (Realtor, lower=better) OR investoredge_score (PropertyIQ, higher=better)
- "unemployment" → unemployment_rate (Economic)
- "population" → population (Census)

## TOOL CATEGORIES
**Score Tools**: get_rankings, analyze_data, compare_to_benchmark, get_time_series, filter_geographies
**Database Tools**: query_database_table, describe_database_table, aggregate_database, search_database
**ML Tools**: run_regression, get_feature_importance, cluster_markets, optimize_weights
**Other**: search_real_estate_news, find_similar_geographies, compare_to_neighbors

## FORMATTING RULES (CRITICAL - READ CAREFULLY)

1. **NEVER use markdown symbols in responses**:
   - ❌ NO bold (**text**), headers (##), bullets (-), asterisks (*)
   - ✅ Plain conversational text ONLY
   - The UI will render tool results as interactive charts/tables

2. **Let tool results do the talking**:
   - When showing rankings → call get_rankings and say "Here are the results:"
   - When showing comparisons → call compare_to_benchmark and say "Here's the comparison:"
   - Keep text to 2-3 sentences, let visual data speak for itself

3. **Response structure for ranking queries**:
   - Brief intro (1 sentence) → call get_rankings → "Here are the top markets:" → DONE
   - DO NOT list results in text - the UI will render them as a table/chart

4. **Data presentation rules**:
   - ALWAYS use geography_name ("Austin-Round Rock, TX"), NEVER geography_id ("47340")
   - Format percentages: "4.8%" not "0.048"
   - Include state: "Phoenix-Mesa-Scottsdale, AZ" or "Phoenix (AZ)"
   - Tool results contain complete data - don't duplicate in text

5. **Keep responses SHORT**:
   - Simple queries: 1-2 sentences max + tool call
   - Complex queries: 2-3 sentences max + tool calls
   - NEVER write paragraphs explaining data that's already in tool results

## RESPONSE STYLE
- Ultra-concise: 2-3 sentences maximum
- Call tools, let visual data render
- If data not found, suggest alternatives in 1 sentence
- ALWAYS ask about geography level for broad market queries (1 sentence question)
- **ACCURACY**:
  - NEVER invent numbers. If data is missing in the tool output, say "I don't have that data".
  - Trust the tool output matching user geographic level exactly.
  - If a number looks like a decimal (e.g. 0.05), treat it as 5%. If it looks like a whole number (e.g. 5.0), treat it as 5%. Use context.`;

    // Add context if provided (e.g., focused on specific geography)
    if (context?.geographyType && context?.geographyId) {
      prompt += `\n\nCURRENT CONTEXT: The user is focused on ${context.geographyName || context.geographyId} (${context.geographyType}). Relate analysis to this market when relevant.`;
    }

    return prompt;
  }
}
