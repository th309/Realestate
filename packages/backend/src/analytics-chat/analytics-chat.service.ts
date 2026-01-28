/**
 * Analytics Chat Service - v1.0.2
 *
 * Orchestrates natural language analytics queries using Claude tool-use.
 * Handles conversation state and tool execution loop.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AnalyticsToolsService } from './analytics-tools.service';
import { SupabaseService } from '../supabase/supabase.service';
import { QUINN_BASE_SYSTEM_PROMPT } from './quinn-system-prompt';

export interface ChatMessage {
  role: 'user' | 'assistant';
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
  private client: Anthropic | null = null;

  // Model tiers for dynamic escalation - optimized for cost/performance
  // Pricing: Haiku 3.5 ($0.25/$1.25) < Sonnet 4 ($3/$15) < Opus 4.5 ($15/$75)
  private readonly MODEL_FAST = 'claude-3-5-haiku-20241022';     // Cheapest - simple queries, basic tools
  private readonly MODEL_BALANCED = 'claude-sonnet-4-20250514';  // Balanced - multi-tool, analysis
  private readonly MODEL_POWERFUL = 'claude-opus-4-5-20251101';  // Premium - complex reasoning, 4+ tools

  // In-memory conversation store (for MVP - consider Redis/DB for production)
  private conversations: Map<string, ConversationState> = new Map();

  // Tool result cache with TTL (5 minutes default)
  private toolCache: Map<string, { result: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly toolsService: AnalyticsToolsService,
    private readonly supabase: SupabaseService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.logger.log(`[Quinn Init] ANTHROPIC_API_KEY present: ${!!apiKey}`);
    
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('[Quinn Init] Analytics Chat Service initialized with Claude');
      this.logger.log(`[Quinn Init] Using ${this.MODEL_BALANCED} for all queries ($3/$15 per MTok)`);
      this.logger.log(`[Quinn Init] Model escalation DISABLED for optimal performance`);
      this.logger.log(`[Quinn Init] Tool result caching enabled (TTL: ${this.CACHE_TTL_MS / 1000}s)`);

      // Clean cache every 10 minutes
      setInterval(() => this.cleanExpiredCache(), 10 * 60 * 1000);
      // Warm tool result cache in background (most common queries)
      this.warmCache().catch((err) => this.logger.error(`[Quinn Cache] Warm-up error: ${err.message}`));
    } else {
      this.logger.error('[Quinn Init] ANTHROPIC_API_KEY not configured - chat DISABLED');
      this.logger.error('[Quinn Init] Set ANTHROPIC_API_KEY in environment variables');
    }
  }

  /**
   * Check if the service is available
   */
  isAvailable(): boolean {
    return !!this.client;
  }

  /**
   * Select model - ALWAYS use Sonnet for consistent performance
   * No escalation overhead, no model switching delays
   */
  private selectInitialModel(_message: string): string {
    this.logger.log(`[Quinn Model] Using Sonnet 4 - $3/$15 per MTok`);
    return this.MODEL_BALANCED;
  }

  /** Query intent for tool selection and iteration limits */
  private getQueryIntent(message: string): 'ranking' | 'filtering' | 'comparison' | 'analysis' | 'raw_data' | 'ml_analysis' | 'news' | 'geography' {
    const lower = message.toLowerCase();

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
    if (/\b(similar|neighbor|nearby|like|around)\b/.test(lower)) return 'geography';

    return 'analysis';
  }

  /**
   * Max allowed tool iterations by intent (prevents over-thinking simple queries).
   */
  private getMaxIterations(intent: 'ranking' | 'filtering' | 'comparison' | 'analysis' | 'raw_data' | 'ml_analysis' | 'news' | 'geography'): number {
    switch (intent) {
      case 'ranking': return 1;
      case 'filtering': case 'comparison': case 'raw_data': return 2;
      case 'analysis': case 'ml_analysis': case 'news': case 'geography': return 3;
      default: return 3;
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
   * Warm cache on startup with most common queries
   * Covers ~90% of typical user queries
   */
  private async warmCache(): Promise<void> {
    this.logger.log(`[Quinn Cache] Starting cache warm-up...`);
    const startTime = Date.now();
    let cached = 0;

    // API expects filter object for get_rankings, compare_to_benchmark, analyze_data
    const commonQueries: Array<{ tool: string; params: Record<string, any> }> = [
      // Top markets (InvestorEdge - most common)
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score' }, limit: 10, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score' }, limit: 20, ascending: false } },
      // Other score types
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'homeready_score' }, limit: 10, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'market_health_score' }, limit: 10, ascending: false } },
      // County level
      { tool: 'get_rankings', params: { filter: { geography_type: 'county', score_type: 'investoredge_score' }, limit: 10, ascending: false } },
      // Bottom performers
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score' }, limit: 10, ascending: true } },
      // Top by state (popular states)
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score', states: ['TX'] }, limit: 10, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score', states: ['CA'] }, limit: 10, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score', states: ['FL'] }, limit: 10, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score', states: ['AZ'] }, limit: 10, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score', states: ['NC'] }, limit: 10, ascending: false } },
      { tool: 'get_rankings', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score', states: ['GA'] }, limit: 10, ascending: false } },
      // Realtor hotness (order_by: asc = low rank first). realtor_metro has no geography_name column.
      { tool: 'query_database_table', params: { table_name: 'realtor_metro', columns: ['hotness_rank', 'median_listing_price'], order_by: 'hotness_rank', limit: 10 } },
      // Benchmark & analysis
      { tool: 'compare_to_benchmark', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score' }, benchmark_type: 'national' } },
      { tool: 'analyze_data', params: { filter: { geography_type: 'metro', score_type: 'investoredge_score' }, horizons: [12, 36] } },
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
  }

  /**
   * Process a chat message with streaming response
   * Yields text chunks as they're generated
   */
  async *chatStream(
    conversationId: string,
    userMessage: string,
    context?: Record<string, any>,
  ): AsyncGenerator<{ type: 'text' | 'tool' | 'done'; content: any }> {
    if (!this.client) {
      throw new Error('Claude client not initialized - check ANTHROPIC_API_KEY');
    }

    // Get or create conversation
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

    // Detect query intent for tool filtering
    const queryIntent = this.getQueryIntent(userMessage);
    this.logger.log(`[Quinn Stream Intent] Detected intent: ${queryIntent}`);

    const userMode = (conversation.context?.userMode as 'homebuyer' | 'investor') || 'homebuyer';
    const userPreferences = conversation.context as Record<string, unknown> | undefined;
    const userProfilePrompt = this.buildUserProfilePrompt(userMode, userPreferences);
    const systemBlocks = [
      { type: 'text' as const, text: QUINN_BASE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: userProfilePrompt, cache_control: { type: 'ephemeral' as const } },
    ];
    const tools = this.getRelevantTools(userMessage);
    this.logger.log(`[Quinn Stream Tools] Providing ${tools.length} tools`);

    conversation.messages.push({ role: 'user', content: userMessage });
    conversation.lastMessageAt = new Date().toISOString();

    const apiMessages = conversation.messages.slice(-40).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const toolsUsed: string[] = [];
    let fullResponse = '';
    const currentModel = this.selectInitialModel(userMessage);

    try {
      this.logger.log(`[Quinn Stream] Starting streaming response for ${queryIntent} query`);

      // Use streaming API (cached system blocks match non-streaming chat for cost/latency)
      const stream = await this.client.messages.stream({
        model: currentModel,
        max_tokens: 2048,
        system: systemBlocks as any,
        tools: tools as any,
        messages: apiMessages,
      });

      // Stream text deltas
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text;
          fullResponse += text;
          yield { type: 'text', content: text };
        }
      }

      // Get final message
      const finalMessage = await stream.finalMessage();

      // Handle tool calls (non-streaming for now)
      if (finalMessage.stop_reason === 'tool_use') {
        const toolUseBlocks = finalMessage.content.filter((b) => b.type === 'tool_use');
        const toolResultsForFollowUp: Array<{ id: string; content: string }> = [];

        for (const toolUse of toolUseBlocks) {
          if (toolUse.type !== 'tool_use') continue;

          toolsUsed.push(toolUse.name);
          yield { type: 'tool', content: { name: toolUse.name, status: 'executing' } };

          // Check cache
          const cachedResult = this.getCachedResult(toolUse.name, toolUse.input as Record<string, any>);
          const result = cachedResult || await this.toolsService.executeTool(
            toolUse.name,
            toolUse.input as Record<string, any>,
          );

          if (!cachedResult && result.success) {
            this.cacheResult(toolUse.name, toolUse.input as Record<string, any>, result);
          }

          const toolResultContent =
            result.success && result.data?.error
              ? JSON.stringify({
                  ...result.data,
                  note: `Service reported an error. Tell the user: ${result.data.error}`,
                })
              : JSON.stringify(result.success ? result : { error: result.error });
          toolResultsForFollowUp.push({ id: toolUse.id, content: toolResultContent });

          yield { type: 'tool', content: { name: toolUse.name, status: 'complete' } };
        }

        // Continue with tool results - stream the follow-up response
        yield { type: 'text', content: '\n\n' };

        const followUpStream = await this.client.messages.stream({
          model: currentModel,
          max_tokens: 2048,
          system: systemBlocks as any,
          tools: tools as any,
          messages: [
            ...apiMessages,
            { role: 'assistant', content: finalMessage.content },
            {
              role: 'user',
              content: toolResultsForFollowUp.map((tr) => ({
                type: 'tool_result' as const,
                tool_use_id: tr.id,
                content: tr.content,
              })),
            },
          ],
        });

        for await (const chunk of followUpStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text;
            fullResponse += text;
            yield { type: 'text', content: text };
          }
        }
      }

      // Save to conversation history
      conversation.messages.push({ role: 'assistant', content: fullResponse });

      yield {
        type: 'done',
        content: {
          toolsUsed,
          modelUsed: currentModel,
        },
      };
    } catch (error) {
      this.logger.error(`[Quinn Stream] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a chat message and return response (non-streaming)
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
    if (!this.client) {
      throw new Error('Claude client not initialized - check ANTHROPIC_API_KEY');
    }

    // Get or create conversation
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

    // Update context if provided
    if (context) {
      conversation.context = { ...conversation.context, ...context };
    }

    // Detect query intent for tool filtering and iteration limits
    const queryIntent = this.getQueryIntent(userMessage);
    const maxIterations = this.getMaxIterations(queryIntent);
    this.logger.log(`[Quinn Intent] Detected: ${queryIntent}, max iterations: ${maxIterations}`);

    // Get relevant tools based on intent
    const tools = this.getRelevantTools(userMessage);
    this.logger.log(`[Quinn Tools] Providing ${tools.length} tools`);

    // Add user message to history
    conversation.messages.push({ role: 'user', content: userMessage });
    conversation.lastMessageAt = new Date().toISOString();

    // Extract user mode and preferences for profile
    const userMode = (conversation.context?.userMode as 'homebuyer' | 'investor') || 'homebuyer';
    const userPreferences = conversation.context as Record<string, unknown> | undefined;

    // Build cached user profile section
    const userProfilePrompt = this.buildUserProfilePrompt(userMode, userPreferences);

    // Build dynamic context (conversation history only - changes per message)
    const dynamicContext = this.buildDynamicContext(conversation.messages);
    const userMessageWithContext = `${dynamicContext}\n${userMessage}`;

    // Prepare messages for API (last 20 exchanges); inject dynamic context into latest user message
    const apiMessages = conversation.messages.slice(-40).map((m, i, arr) => {
      const isLastUser = arr.length - 1 === i && m.role === 'user';
      return {
        role: m.role as 'user' | 'assistant',
        content: isLastUser ? userMessageWithContext : m.content,
      };
    });

    const toolsUsed: string[] = [];
    const toolResultsData: Array<{ toolName: string; data: any }> = [];
    const responseTextParts: string[] = [];
    const chatStartTime = Date.now();

    let currentModel = this.selectInitialModel(userMessage);

    try {
      this.logger.log(`[Quinn Chat] Processing in ${conversationId}, tools: ${tools.length}`);

      const apiStartTime = Date.now();

      // Add timeout wrapper to prevent hanging (60 second timeout)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Claude API call timed out after 60 seconds')), 60000)
      );

      let response = await Promise.race([
        this.client.messages.create({
          model: currentModel,
          max_tokens: 2048,
          system: [
            {
              type: 'text' as const,
              text: QUINN_BASE_SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' as const },
            },
            {
              type: 'text' as const,
              text: userProfilePrompt,
              cache_control: { type: 'ephemeral' as const },
            },
          ],
          tools: tools as any,
          messages: apiMessages,
        }),
        timeoutPromise
      ]) as Anthropic.Messages.Message;

      const apiDuration = Date.now() - apiStartTime;
      this.logger.log(`[Quinn Chat] Claude API responded in ${apiDuration}ms`);
      this.logger.log(`[Quinn Chat] Stop reason: ${response.stop_reason}`);
      this.logger.log(`[Quinn Chat] Content blocks: ${response.content.length}`);

      // Extract text from initial response (if any)
      const initialTextBlock = response.content.find((block) => block.type === 'text');
      if (initialTextBlock && 'text' in initialTextBlock) {
        responseTextParts.push(initialTextBlock.text);
        this.logger.log(`[Quinn Chat] Initial response text length: ${initialTextBlock.text.length}`);
      }

      // Process tool calls in a loop with intent-based iteration limits.
      // Accumulate (assistant, user) turns so multi-turn tool use sees prior results.
      let iterations = 0;
      const messagesWithToolTurns: Anthropic.Messages.MessageParam[] = [...apiMessages];

      this.logger.log(`[Quinn Chat] Max iterations for ${queryIntent}: ${maxIterations}`);

      while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
        iterations++;
        this.logger.log(`[Quinn Chat] Tool use iteration ${iterations}/${maxIterations}`);

        const toolUseBlocks = response.content.filter(
          (block) => block.type === 'tool_use',
        );

        const toolResults: any[] = [];

        for (const toolUse of toolUseBlocks) {
          if (toolUse.type !== 'tool_use') continue;

          this.logger.log(`[Quinn Chat] Executing tool: ${toolUse.name}`);
          this.logger.log(`[Quinn Chat] Tool input: ${JSON.stringify(toolUse.input).slice(0, 200)}`);
          toolsUsed.push(toolUse.name);

          // Check cache first
          const cachedResult = this.getCachedResult(toolUse.name, toolUse.input as Record<string, any>);
          let result: any;

          if (cachedResult) {
            // Use cached result
            result = cachedResult;
          } else {
            // Execute tool and cache result
            result = await this.toolsService.executeTool(
              toolUse.name,
              toolUse.input as Record<string, any>,
            );

            // Cache successful results
            if (result.success) {
              this.cacheResult(toolUse.name, toolUse.input as Record<string, any>, result);
            }
          }

          this.logger.log(`[Quinn Chat] Tool ${toolUse.name} result: success=${result.success}`);
          if (!result.success) {
            this.logger.error(`[Quinn Chat] Tool ${toolUse.name} error: ${result.error}`);
          }

          // Store every tool result (success or failure) so we can show errorMessage when ranking fails
          toolResultsData.push({ toolName: toolUse.name, data: result });

          let toolResultContent: string;
          if (result.success && result.data?.error) {
            toolResultContent = JSON.stringify({
              ...result.data,
              note: `Service reported an error. Tell the user: ${result.data.error}`,
            });
          } else {
            toolResultContent = JSON.stringify(result.success ? result : { error: result.error });
          }
          this.logger.log(`[Quinn Chat] Tool result content length: ${toolResultContent.length}`);

          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: toolResultContent,
          });
        }
        
        this.logger.log(`[Quinn Chat] Sending ${toolResults.length} tool results back to Claude...`);

        // Append this turn so next round sees prior tool use and results (multi-turn comparisons)
        messagesWithToolTurns.push(
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults },
        );

        // Continue conversation with tool results (with timeout)
        const followUpTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Claude follow-up API call timed out after 60 seconds')), 60000)
        );

        response = await Promise.race([
          this.client.messages.create({
            model: currentModel,
            max_tokens: 2048,
            system: [
              {
                type: 'text' as const,
                text: QUINN_BASE_SYSTEM_PROMPT,
                cache_control: { type: 'ephemeral' as const },
              },
              {
                type: 'text' as const,
                text: userProfilePrompt,
                cache_control: { type: 'ephemeral' as const },
              },
            ],
            tools: tools as any,
            messages: messagesWithToolTurns,
          }),
          followUpTimeoutPromise
        ]) as Anthropic.Messages.Message;

        // Extract text from this response iteration (if any)
        const iterationTextBlock = response.content.find((block) => block.type === 'text');
        if (iterationTextBlock && 'text' in iterationTextBlock) {
          responseTextParts.push(iterationTextBlock.text);
          this.logger.log(`[Quinn Chat] Iteration ${iterations} text length: ${iterationTextBlock.text.length}`);
        }

        // Early termination for ranking queries after first successful tool call
        if (queryIntent === 'ranking' && iterations === 1 && toolResultsData.length > 0) {
          this.logger.log(`[Quinn Chat] Ranking query complete in 1 iteration with ${toolResultsData.length} tool results - terminating early`);
          break;
        }
      }

      if (iterations >= maxIterations) {
        this.logger.warn('Max tool iterations reached');
      }

      let finalResponse = responseTextParts.length > 0
        ? responseTextParts.join('\n\n').trim()
        : '';

      this.logger.log(`[Quinn Chat] Extracting structured data from ${toolResultsData.length} tool results...`);
      const structuredData = this.extractStructuredData(toolResultsData, userMessage);
      this.logger.log(`[Quinn Chat] Structured data extracted: ${structuredData ? JSON.stringify(Object.keys(structuredData)) : 'undefined'}`);
      if (structuredData?.rankings) {
        this.logger.log(`[Quinn Chat] Rankings found: ${structuredData.rankings.items?.length || 0} items`);
      }

      // When we have tool results but no (or empty) model text, build a fallback so the user always gets an answer
      if (!finalResponse && structuredData) {
        finalResponse = this.buildFallbackResponseFromStructuredData(structuredData);
        this.logger.log(`[Quinn Chat] Using fallback response (${finalResponse.length} chars) from structured data`);
      }
      if (!finalResponse) {
        finalResponse = 'I was unable to generate a response. Please try again.';
      }

      // When structuredData.rankings is present, the client renders the table from structuredData—do not append the list to response text (keeps reply short for quality checks).
      if (structuredData?.rankings?.items?.length) {
        this.logger.log(`[Quinn Chat] Rankings in structuredData (${structuredData.rankings.items.length} items)—client will render table; leaving response as intro only`);
      }

      // When ranking tool failed (e.g. timeout), append a clear, actionable message so the user isn’t left with “try again”
      if (
        queryIntent === 'ranking' &&
        structuredData?.errorMessage &&
        !structuredData?.rankings?.items?.length
      ) {
        const friendly =
          /aborted|timeout|timed out/i.test(structuredData.errorMessage)
            ? "The request timed out. Zip-level appreciation rankings are slow; try \"top metros in [state] by appreciation\" for a faster result, or try again in a moment."
            : `Unable to retrieve rankings: ${structuredData.errorMessage}`;
        if (!finalResponse.trim().toLowerCase().includes('unable') && !finalResponse.includes(structuredData.errorMessage)) {
          finalResponse = finalResponse.trimEnd() + "\n\n" + friendly;
        }
      }

      conversation.messages.push({ role: 'assistant', content: finalResponse });
      const totalExecutionTime = Date.now() - chatStartTime;

      this.logger.log(
        `[Quinn Chat] Done in ${totalExecutionTime}ms, ${toolsUsed.length} tools, ${currentModel}`,
      );

      return {
        response: finalResponse,
        toolsUsed,
        structuredData,
        modelUsed: currentModel,
        metadata: {
          intent: queryIntent,
          toolCallCount: toolsUsed.length,
          totalExecutionTime,
        },
      };
    } catch (error) {
      this.logger.error(`[Quinn Chat] === CHAT ERROR ===`);
      this.logger.error(`[Quinn Chat] Error type: ${error.constructor?.name}`);
      this.logger.error(`[Quinn Chat] Error message: ${error.message}`);
      this.logger.error(`[Quinn Chat] Error stack: ${error.stack}`);

      // Check for specific Anthropic API errors
      if (error.status) {
        this.logger.error(`[Quinn Chat] API status code: ${error.status}`);
      }
      if (error.error) {
        this.logger.error(`[Quinn Chat] API error details: ${JSON.stringify(error.error)}`);
      }

      // If we have any partial response text, return it with an error notice
      if (responseTextParts.length > 0) {
        const partialResponse = responseTextParts.join('\n\n');
        const errorMessage = `\n\n---\n\n⚠️ I encountered an error while completing this response: ${error.message}. The information above may be incomplete.`;
        const finalResponse = partialResponse + errorMessage;

        this.logger.warn(`[Quinn Chat] Returning partial response (${partialResponse.length} chars) due to error`);
        conversation.messages.push({ role: 'assistant', content: finalResponse });

        return {
          response: finalResponse,
          toolsUsed,
          structuredData: this.extractStructuredData(toolResultsData, userMessage),
          modelUsed: currentModel,
          metadata: {
            intent: queryIntent,
            toolCallCount: toolsUsed.length,
            totalExecutionTime: Date.now() - chatStartTime,
          },
        };
      }

      // No partial response available, throw the error
      throw error;
    }
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
      this.logger.debug(`[Quinn Extract] Processing tool: ${toolName}, data keys: ${JSON.stringify(Object.keys(data || {}))}`);

      // Unwrap if data is nested under data.data (analytics service wraps responses)
      const actualData = data.data || data;
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
            score: item.score,
            appreciation: item.appreciation_12m,
            state: item.state,
          }));
          // "Compare A and B" (any geography): show only the requested geographies, not a generic top-N
          if (compareNames && compareNames.length === 2) {
            const [na, nb] = compareNames.map((s) => s.toLowerCase());
            items = items.filter(
              (it: { name: string }) =>
                (it.name || '').toLowerCase().includes(na) || (it.name || '').toLowerCase().includes(nb),
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
- ALWAYS ask about geography level for broad market queries (1 sentence question)`;

    // Add context if provided (e.g., focused on specific geography)
    if (context?.geographyType && context?.geographyId) {
      prompt += `\n\nCURRENT CONTEXT: The user is focused on ${context.geographyName || context.geographyId} (${context.geographyType}). Relate analysis to this market when relevant.`;
    }

    return prompt;
  }
}
