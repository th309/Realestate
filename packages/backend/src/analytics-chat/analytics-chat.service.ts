/**
 * Analytics Chat Service
 *
 * Orchestrates natural language analytics queries using Claude tool-use.
 * Handles conversation state and tool execution loop.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AnalyticsToolsService } from './analytics-tools.service';
import { SupabaseService } from '../supabase/supabase.service';

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

  constructor(
    private readonly configService: ConfigService,
    private readonly toolsService: AnalyticsToolsService,
    private readonly supabase: SupabaseService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.logger.log(`[Quinn Init] Checking ANTHROPIC_API_KEY...`);
    this.logger.log(`[Quinn Init] API key present: ${!!apiKey}`);
    this.logger.log(`[Quinn Init] API key length: ${apiKey?.length || 0}`);
    this.logger.log(`[Quinn Init] API key prefix: ${apiKey?.slice(0, 10) || 'N/A'}...`);
    
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('[Quinn Init] Analytics Chat Service initialized with Claude');
      this.logger.log(`[Quinn Init] Using ${this.MODEL_BALANCED} for all queries ($3/$15 per MTok)`);
      this.logger.log(`[Quinn Init] Model escalation DISABLED for optimal performance`);
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

  /**
   * Filter tools based on query type - only show relevant tools
   * This dramatically reduces Claude's processing overhead
   */
  private getRelevantTools(message: string): any[] {
    const allTools = this.toolsService.getToolDefinitions();
    const lowerMessage = message.toLowerCase();

    // Score/ranking queries - most common
    if (/\b(top|best|rank|score|hot|perform|invest|compare.*score)/i.test(lowerMessage)) {
      this.logger.log(`[Quinn Tools] Score query detected - providing Score Analysis tools`);
      return allTools.filter(t =>
        ['get_rankings', 'analyze_data', 'compare_to_benchmark', 'get_time_series',
         'filter_geographies', 'get_available_filters'].includes(t.name)
      );
    }

    // Market data queries (Zillow, Realtor, Census, Economic)
    if (/\b(price|rent|value|zillow|realtor|listing|inventory|sale|hotness|zhvi|zri)/i.test(lowerMessage)) {
      this.logger.log(`[Quinn Tools] Market data query detected - providing Database Query tools`);
      return allTools.filter(t =>
        ['query_database_table', 'describe_database_table', 'aggregate_database',
         'search_database', 'get_database_summary'].includes(t.name)
      );
    }

    // Demographics/economic data
    if (/\b(population|income|unemployment|demographic|census|economic|gdp)/i.test(lowerMessage)) {
      this.logger.log(`[Quinn Tools] Demographics query detected - providing Database Query tools`);
      return allTools.filter(t =>
        ['query_database_table', 'describe_database_table', 'aggregate_database'].includes(t.name)
      );
    }

    // ML/analysis queries
    if (/\b(predict|regression|feature|importance|cluster|correlat|optim|weight|machine learning|ml)/i.test(lowerMessage)) {
      this.logger.log(`[Quinn Tools] ML analysis query detected - providing ML tools`);
      return allTools.filter(t =>
        ['run_regression', 'get_feature_importance', 'cluster_markets', 'optimize_weights',
         'analyze_raw_metrics', 'get_raw_metric_summary'].includes(t.name)
      );
    }

    // Validation/backtest queries
    if (/\b(backtest|validat|quintile|test|verify|check|perform)/i.test(lowerMessage)) {
      this.logger.log(`[Quinn Tools] Validation query detected - providing Validation tools`);
      return allTools.filter(t =>
        ['run_backtest', 'run_quintile_analysis', 'compare_formulas'].includes(t.name)
      );
    }

    // News queries
    if (/\b(news|article|recent|happening|event|announcement)/i.test(lowerMessage)) {
      this.logger.log(`[Quinn Tools] News query detected - providing News tools`);
      return allTools.filter(t =>
        ['search_real_estate_news', 'analyze_news_impact'].includes(t.name)
      );
    }

    // Geography/comparison queries
    if (/\b(similar|neighbor|compar|nearby|surrounding|like|near)/i.test(lowerMessage)) {
      this.logger.log(`[Quinn Tools] Geography query detected - providing Geography tools`);
      return allTools.filter(t =>
        ['find_similar_geographies', 'compare_to_neighbors', 'find_neighboring_geographies',
         'get_rankings', 'query_database_table'].includes(t.name)
      );
    }

    // Discovery/exploration queries
    if (/\b(what|show|available|list|data|table|have|exist)/i.test(lowerMessage)) {
      this.logger.log(`[Quinn Tools] Discovery query detected - providing Database Query tools`);
      return allTools.filter(t =>
        ['get_database_summary', 'get_database_tables', 'describe_database_table',
         'query_database_table', 'get_available_filters'].includes(t.name)
      );
    }

    // Default: provide core tools (Score + Database)
    this.logger.log(`[Quinn Tools] General query - providing core tools`);
    return allTools.filter(t =>
      ['get_rankings', 'query_database_table', 'describe_database_table',
       'analyze_data', 'search_database'].includes(t.name)
    );
  }

  /**
   * Process a chat message and return response
   */
  async chat(
    conversationId: string,
    userMessage: string,
    context?: Record<string, any>,
  ): Promise<{
    response: string;
    toolsUsed: string[];
    structuredData?: StructuredData;
    modelUsed?: string; // Track which model was ultimately used
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

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(conversation.context);

    // Get relevant tools based on query (dynamic filtering)
    const tools = this.getRelevantTools(userMessage);
    this.logger.log(`[Quinn Tools] Providing ${tools.length} tools (filtered from 27 total)`);

    // Add user message to history
    conversation.messages.push({ role: 'user', content: userMessage });
    conversation.lastMessageAt = new Date().toISOString();

    // Prepare messages for API (limit to last 20 exchanges = 40 messages)
    const apiMessages = conversation.messages.slice(-40).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const toolsUsed: string[] = [];
    const toolResultsData: Array<{ toolName: string; data: any }> = [];
    const responseTextParts: string[] = []; // Collect text from all responses

    // Select initial model based on query characteristics
    let currentModel = this.selectInitialModel(userMessage);

    try {
      this.logger.log(`[Quinn Chat] Processing message in conversation ${conversationId}`);
      this.logger.log(`[Quinn Chat] User message: "${userMessage.slice(0, 100)}..."`);
      this.logger.log(`[Quinn Chat] Conversation history length: ${apiMessages.length} messages`);
      this.logger.log(`[Quinn Chat] Available tools: ${tools.length}`);
      this.logger.log(`[Quinn Chat] System prompt length: ${systemPrompt.length} chars`);

      // Initial request
      this.logger.log(`[Quinn Chat] Calling Claude API (model: ${currentModel})...`);
      const apiStartTime = Date.now();

      // Add timeout wrapper to prevent hanging (60 second timeout)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Claude API call timed out after 60 seconds')), 60000)
      );

      let response = await Promise.race([
        this.client.messages.create({
          model: currentModel,
          max_tokens: 2048,
          system: systemPrompt,
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

      // Process tool calls in a loop (max 10 iterations to prevent infinite loops)
      let iterations = 0;
      const maxIterations = 10;

      while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
        iterations++;
        this.logger.log(`[Quinn Chat] Tool use iteration ${iterations}`);

        const toolUseBlocks = response.content.filter(
          (block) => block.type === 'tool_use',
        );

        const toolResults: any[] = [];

        for (const toolUse of toolUseBlocks) {
          if (toolUse.type !== 'tool_use') continue;

          this.logger.log(`[Quinn Chat] Executing tool: ${toolUse.name}`);
          this.logger.log(`[Quinn Chat] Tool input: ${JSON.stringify(toolUse.input).slice(0, 200)}`);
          toolsUsed.push(toolUse.name);

          const result = await this.toolsService.executeTool(
            toolUse.name,
            toolUse.input as Record<string, any>,
          );

          this.logger.log(`[Quinn Chat] Tool ${toolUse.name} result: success=${result.success}`);
          if (!result.success) {
            this.logger.error(`[Quinn Chat] Tool ${toolUse.name} error: ${result.error}`);
          }

          // Store tool result for structured data extraction
          if (result.success && result.data) {
            toolResultsData.push({ toolName: toolUse.name, data: result.data });
          }

          const toolResultContent = JSON.stringify(result.success ? result.data : { error: result.error });
          this.logger.log(`[Quinn Chat] Tool result content length: ${toolResultContent.length}`);

          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: toolResultContent,
          });
        }
        
        this.logger.log(`[Quinn Chat] Sending ${toolResults.length} tool results back to Claude...`);

        // Continue conversation with tool results (with timeout)
        const followUpTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Claude follow-up API call timed out after 60 seconds')), 60000)
        );

        response = await Promise.race([
          this.client.messages.create({
            model: currentModel,
            max_tokens: 2048,
            system: systemPrompt,
            tools: tools as any,
            messages: [
              ...apiMessages,
              { role: 'assistant', content: response.content },
              { role: 'user', content: toolResults },
            ],
          }),
          followUpTimeoutPromise
        ]) as Anthropic.Messages.Message;

        // Extract text from this response iteration (if any)
        const iterationTextBlock = response.content.find((block) => block.type === 'text');
        if (iterationTextBlock && 'text' in iterationTextBlock) {
          responseTextParts.push(iterationTextBlock.text);
          this.logger.log(`[Quinn Chat] Iteration ${iterations} text length: ${iterationTextBlock.text.length}`);
        }
      }

      if (iterations >= maxIterations) {
        this.logger.warn('Max tool iterations reached');
      }

      // Combine all text parts from all responses
      const finalResponse = responseTextParts.length > 0
        ? responseTextParts.join('\n\n')
        : 'I was unable to generate a response. Please try again.';

      this.logger.log(`[Quinn Chat] Final response combined from ${responseTextParts.length} text parts, total length: ${finalResponse.length}`);

      // Save assistant response to history
      conversation.messages.push({ role: 'assistant', content: finalResponse });

      // Extract structured data from tool results
      const structuredData = this.extractStructuredData(toolResultsData);

      this.logger.log(
        `[Quinn Chat] Completed with ${currentModel}, used ${toolsUsed.length} tools`,
      );

      return {
        response: finalResponse,
        toolsUsed,
        structuredData,
        modelUsed: currentModel,
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
          structuredData: this.extractStructuredData(toolResultsData),
          modelUsed: currentModel,
        };
      }

      // No partial response available, throw the error
      throw error;
    }
  }

  /**
   * Extract structured data from tool results for visual rendering
   */
  private extractStructuredData(
    toolResults: Array<{ toolName: string; data: any }>,
  ): StructuredData | undefined {
    if (toolResults.length === 0) return undefined;

    const structured: StructuredData = {};

    for (const { toolName, data } of toolResults) {
      // Handle rankings from get_rankings tool
      if (toolName === 'get_rankings' && data.rankings) {
        structured.rankings = {
          title: data.direction === 'bottom' ? 'Bottom Performers' : 'Top Performers',
          direction: data.direction || 'top',
          items: data.rankings.map((item: any) => ({
            rank: item.rank,
            name: item.geography_name || item.geography_id,
            score: item.score,
            appreciation: item.appreciation_12m,
            state: item.state,
          })),
        };
      }

      // Handle comparison from compare_to_benchmark tool
      if (toolName === 'compare_to_benchmark' && data.comparison) {
        const comp = data.comparison;
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
      if (toolName === 'analyze_data' && data.top_performers) {
        // Create a table for top performers
        structured.table = {
          title: 'Top Performers',
          columns: [
            { key: 'rank', label: '#', type: 'rank' },
            { key: 'name', label: 'Market', type: 'text' },
            { key: 'score', label: 'Score', type: 'score' },
            { key: 'appreciation', label: '12M Return', type: 'percent' },
          ],
          rows: data.top_performers.slice(0, 10).map((p: any, i: number) => ({
            rank: i + 1,
            name: p.geography_name || p.geography_id,
            score: p.score,
            appreciation: p.appreciation_12m,
          })),
          highlightTop: 3,
        };

        // Create distribution chart if available
        if (data.chart_data?.distribution) {
          const dist = data.chart_data.distribution;
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

## CRITICAL RULES

1. **PropertyIQ Scores → get_rankings ONLY**
   - ❌ NEVER: query_database_table on propertyiq_scores
   - ✅ ALWAYS: get_rankings, analyze_data, compare_to_benchmark
   - Returns COMPLETE data (names, scores, appreciation) - no follow-up queries needed!

2. **Raw Data → query_database_table**
   - Zillow: zhvi (prices), zri (rents), inventory
   - Realtor: hotness_rank (lower=hotter), median_listing_price, days_on_market
   - Census: population, median_income
   - Economic: unemployment_rate, gdp

3. **Efficiency Rules**
   - Maximum 1-3 tool calls for simple queries
   - Don't explore schemas - just call the tool
   - Trust tool outputs - they include all needed data

## COMMON QUERIES

**"Find hot markets"** → get_rankings(score_type="investoredge", limit=10)

**"Realtor hotness"** → query_database_table(table_name="realtor_metro", columns=["geography_name","hotness_rank"], order_by={"hotness_rank":"asc"}, limit=10)

**"Compare PropertyIQ vs Realtor"**
- get_rankings(score_type="investoredge", limit=10)
- query_database_table(table_name="realtor_metro", ...) for hotness_rank
- Explain: PropertyIQ=predictive future value, Realtor=current buyer activity

**"Top Texas metros"** → get_rankings(score_type="investoredge", states=["TX"], limit=10)

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

## RESPONSE STYLE
- Be direct and concise (200-400 words)
- Present specific numbers, not vague terms
- Explain what you're analyzing before calling tools
- If data not found, suggest alternatives`;

    // Add context if provided (e.g., focused on specific geography)
    if (context?.geographyType && context?.geographyId) {
      prompt += `\n\nCURRENT CONTEXT: The user is focused on ${context.geographyName || context.geographyId} (${context.geographyType}). Relate analysis to this market when relevant.`;
    }

    return prompt;
  }
}
