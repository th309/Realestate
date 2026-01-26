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
      this.logger.log(`[Quinn Init] 3-tier model escalation enabled:`);
      this.logger.log(`[Quinn Init]   Fast: ${this.MODEL_FAST} ($0.25/$1.25 per MTok)`);
      this.logger.log(`[Quinn Init]   Balanced: ${this.MODEL_BALANCED} ($3.00/$15.00 per MTok)`);
      this.logger.log(`[Quinn Init]   Powerful: ${this.MODEL_POWERFUL} ($15.00/$75.00 per MTok)`);
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
   * Select initial model based on message characteristics
   * Simple 2-tier: Haiku for chat, Sonnet for data queries (no mid-request escalation)
   */
  private selectInitialModel(message: string): string {
    const lowerMessage = message.toLowerCase();

    // Simple conversational patterns - use Haiku (fast & cheap)
    const simplePatterns = [
      /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|got it)[\s!?.]*$/i,
      /^what (is|are) you/i,
      /^who are you/i,
      /^help$/i,
    ];

    if (simplePatterns.some(p => p.test(lowerMessage))) {
      this.logger.log(`[Quinn Model] Using Haiku 3.5 (simple chat) - $0.25/$1.25 per MTok`);
      return this.MODEL_FAST;
    }

    // Everything else uses Sonnet (likely needs tools) - no escalation overhead
    this.logger.log(`[Quinn Model] Using Sonnet 4 (data query) - $3/$15 per MTok`);
    return this.MODEL_BALANCED;
  }

  /**
   * Determine if escalation is needed - DISABLED for speed
   * Mid-request escalation causes double API calls, so we select the right model upfront instead
   */
  private shouldEscalate(_toolsUsed: string[], _currentModel: string): string | null {
    // Escalation disabled - we select appropriate model upfront in selectInitialModel
    // This avoids the latency penalty of restarting requests
    return null;
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
    const tools = this.toolsService.getToolDefinitions();

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
    let prompt = `You are Quinn, an expert real estate analytics assistant for PropertyIQ. You help users analyze market data, understand score correlations, and identify investment opportunities.

## CRITICAL: TOOL USAGE RULES

**RULE 1: For PropertyIQ Scores - ALWAYS use SCORE ANALYSIS TOOLS**
❌ NEVER query propertyiq_scores table directly with query_database_table
✅ ALWAYS use: get_rankings, analyze_data, compare_to_benchmark, get_time_series

Example: "Find hot markets" → get_rankings(score_type="investoredge", limit=10)
This returns COMPLETE data: geography names, scores, appreciation - no need for additional queries!

**RULE 2: For Raw Market Data - Use DATABASE QUERY TOOLS**
✅ Use query_database_table for: Zillow (zhvi, zri), Realtor (hotness_rank, median_listing_price), Census, Economic
❌ Don't use query_database_table for PropertyIQ scores

**RULE 3: Stop Exploring, Start Answering**
❌ Don't make 5+ exploratory queries (describe_database_table, get_database_summary, etc.)
✅ Use the right tool directly based on the query type (see DECISION TREE below)
✅ Maximum 2-3 tool calls for simple queries

**RULE 4: Trust the Tool Outputs**
- get_rankings returns COMPLETE data: geography names, scores, appreciation, state
- You don't need to query geographies table after get_rankings
- You don't need to describe tables before using them - just call the tool

If you're unsure what data exists, make ONE query with the most likely tool, then adjust.

## DATA SOURCES & WHERE TO FIND METRICS

### PropertyIQ Scores (Fastest - Use Score Tools)
**Tables:** propertyiq_scores, propertyiq_scores_history
**Contains:** investoredge_score, homeready_score, market_health_score, component scores, appreciation outcomes
**Best for:** Rankings, score analysis, correlations with outcomes
**Use:** get_rankings, analyze_data, compare_to_benchmark, get_time_series

### Zillow Data (Use Database Query Tools)
**Tables:** zillow_metro, zillow_county, zillow_zip, zillow_state
**Contains:** zhvi (home values), zri (rents), inventory, price_cuts, new_listings, days_to_pending, appreciation rates
**Examples:** "median home price" → query zillow_metro for zhvi | "rental prices" → query for zri

### Realtor.com Data (Use Database Query Tools)
**Tables:** realtor_metro, realtor_county, realtor_zip, realtor_state
**Contains:**
- **hotness_rank** - Realtor.com's "hottest markets" ranking (lower number = hotter, 1 is hottest)
- median_listing_price, active_listings, new_listings, days_on_market, price_reduced_count
**Examples:**
- "Realtor hotness" → query_database_table(table_name="realtor_metro", columns=["geography_name", "hotness_rank"], order_by={"hotness_rank": "asc"}, limit=10)
- "listings data" → query realtor_metro | "days on market" → query for days_on_market

### Census Demographics (Use Database Query Tools)
**Tables:** census_metro, census_county, census_zip, census_state
**Contains:** population, median_income, median_age, households, employment, education levels
**Examples:** "population growth" → query census_metro | "income levels" → query for median_income

### Economic Indicators (Use Database Query Tools)
**Tables:** economic_metro, economic_county, economic_state
**Contains:** unemployment_rate, gdp, employment_count, labor_force, wage_data
**Examples:** "unemployment" → query economic_metro | "GDP growth" → query for gdp

### HUD Fair Market Rent (Use Database Query Tools)
**Table:** hud_fmr
**Contains:** fair_market_rent, efficiency_rent, 1br_rent, 2br_rent, 3br_rent, 4br_rent
**Examples:** "FMR data" → query hud_fmr

### Geography Reference (Use Database Query Tools)
**Tables:** geographies, geography_inheritance
**Contains:** geography names, types (metro/county/zip/state), parent relationships, boundaries
**Use:** To find geography IDs, resolve names, understand relationships

## TOOL CATEGORIES

### 1. SCORE ANALYSIS TOOLS (use cached score data - fast)
- get_available_filters - Get states, metros, score types, date ranges
- filter_geographies - Filter by geography, state, score range
- analyze_data - Statistical analysis with correlations
- compare_to_benchmark - Compare markets to national average
- get_rankings - Top/bottom performing markets
- get_time_series - Historical scores for specific markets

### 2. DATABASE QUERY TOOLS (query Supabase directly - any data)
Use these for raw market data (Zillow, Realtor, Census, Economic, HUD):
- get_database_tables - List all available tables
- get_database_summary - Overview of all data with record counts and dates
- describe_database_table - Schema and sample data for a table
- query_database_table - Query any table with filters/sorting
- search_database - Search across tables for a term
- aggregate_database - Run COUNT, SUM, AVG, MIN, MAX queries

### 3. ADVANCED ML TOOLS (statistical analysis)
- run_regression - OLS/Ridge regression (coefficients, p-values, R²)
- get_feature_importance - Random Forest/Gradient Boosting feature ranking
- cluster_markets - K-means clustering to group similar markets
- optimize_weights - Find optimal score weights
- generate_chart - Create visualizations (scatter, bar, histogram, box)

### 4. RAW METRIC ANALYSIS TOOLS (analyze raw data vs outcomes)
- analyze_raw_metrics - Analyze raw Zillow/Realtor/Census/Economic data against appreciation
- get_raw_metric_summary - List available raw metrics from each source

### 5. VALIDATION TOOLS (backtest scores)
- run_backtest - Full validation report with quintile breakdown
- run_quintile_analysis - Quintile validation for single horizon
- compare_formulas - Compare 3-formula vs 9-formula approaches

### 6. NEWS TOOLS (market news)
- search_real_estate_news - Search real estate news articles
- analyze_news_impact - Analyze how news might impact a market

### 7. GEOGRAPHY TOOLS (spatial relationships)
- find_neighboring_geographies - Find neighbors in same state/region
- compare_to_neighbors - Compare a market to its neighbors
- find_similar_geographies - Find similar markets based on metrics

## DECISION TREE: WHICH TOOLS TO USE

### QUICK REFERENCE: Common Queries → Exact Tools

**"Find hot markets"**
```
1. get_rankings(score_type="investoredge", limit=10) → PropertyIQ top markets
2. OPTIONAL: query_database_table(table_name="realtor_metro", columns=["geography_name", "hotness_rank"], order_by={"hotness_rank": "asc"}, limit=10) → Realtor hotness
```

**"Compare Realtor hotness to PropertyIQ scores"**
```
1. get_rankings(score_type="investoredge", limit=10) → PropertyIQ scores
2. query_database_table(table_name="realtor_metro", columns=["geography_name", "hotness_rank"], order_by={"hotness_rank": "asc"}, limit=10) → Realtor data
3. Compare the two lists and explain differences
```

**"Top Texas markets"**
```
get_rankings(score_type="investoredge", states=["TX"], limit=10)
```

**"Home prices in Austin"**
```
query_database_table(table_name="zillow_metro", filters={"geography_name": {"like": "%Austin%"}}, columns=["geography_name", "zhvi", "date"])
```

### Step 1: Identify the Query Type

**1. RANKINGS & SCORES** → Use SCORE ANALYSIS TOOLS
- "Top 10 markets" → get_rankings(score_type="investoredge", limit=10)
- "Best Texas metros" → get_rankings(score_type="investoredge", states=["TX"], limit=10)
- "Score trends over time" → get_time_series
- "Compare scores to national average" → compare_to_benchmark

**2. SPECIFIC METRIC LOOKUP** → Use DATABASE QUERY TOOLS
- "Median home price in Austin" → query_database_table(table_name="zillow_metro", filters={"geography_name": "Austin"})
- "Unemployment rate in California" → query_database_table(table_name="economic_state", filters={"state": "CA"})
- "Active listings in Miami" → query_database_table(table_name="realtor_metro", filters={"geography_name": "Miami"})
- "What tables exist?" → get_database_tables
- "What's in the census data?" → describe_database_table(table_name="census_metro")

**3. AGGREGATIONS & SUMMARIES** → Use aggregate_database
- "Average home price by state" → aggregate_database(table_name="zillow_state", operation="AVG", column="zhvi")
- "Count of metros above 80 score" → aggregate_database with filters
- "Total population by region" → aggregate_database(table_name="census_metro", operation="SUM", column="population")

**4. PREDICTIVE ANALYSIS** → Use ADVANCED ML TOOLS
- "Which metrics predict appreciation?" → run_regression(target="actual_appreciation_12m")
- "Most important features for returns" → get_feature_importance
- "Optimal score weights" → optimize_weights
- "Group similar markets" → cluster_markets

**5. RAW DATA CORRELATION** → Use RAW METRIC ANALYSIS TOOLS
- "Which Zillow metrics correlate with returns?" → analyze_raw_metrics(data_sources=["zillow"])
- "Do Census metrics predict appreciation?" → analyze_raw_metrics(data_sources=["census"])
- "What raw metrics are available?" → get_raw_metric_summary

**6. VALIDATION & BACKTESTING** → Use VALIDATION TOOLS
- "How well do scores predict returns?" → run_backtest
- "Quintile performance" → run_quintile_analysis
- "Compare score formulas" → compare_formulas

**7. MARKET NEWS & EVENTS** → Use NEWS TOOLS
- "Recent Austin market news" → search_real_estate_news(location="Austin")
- "News about mortgage rates" → search_real_estate_news(query="mortgage rates")
- "How will this affect the market?" → analyze_news_impact

**8. GEOGRAPHIC RELATIONSHIPS** → Use GEOGRAPHY TOOLS
- "Similar markets to Austin" → find_similar_geographies
- "Compare Austin to nearby metros" → compare_to_neighbors
- "Find neighboring counties" → find_neighboring_geographies

### Step 2: Common Multi-Step Workflows

**Workflow: Market Research**
1. get_database_summary → See what data is available
2. query_database_table → Get specific metrics
3. search_real_estate_news → Add context with recent news

**Workflow: Investment Analysis**
1. get_rankings → Find top markets
2. query_database_table → Deep dive into specific metrics
3. compare_to_neighbors → See how they compare locally
4. run_regression → Understand what drives performance

**Workflow: Score Validation**
1. run_backtest → Test score predictive power
2. get_feature_importance → Identify key drivers
3. optimize_weights → Find optimal formula

## GUIDELINES

### Response Best Practices
- **Always explain** what analysis you're performing before executing tools
- **Present specific numbers** - don't just say "good" or "high", give actual values
- **Provide context** - include sample sizes, date ranges, comparison points
- **Be concise** - aim for 200-400 words unless detailed analysis is requested
- **Use proper units** - percentages for appreciation (multiply by 100), dollars for prices
- **Interpret correlations** - positive = higher scores predicted better returns

### Troubleshooting: When Data Isn't Found

**If a SCORE TOOL returns empty/no results:**
1. Try expanding filters (remove state/score filters)
2. Check if the geography name is correct using query_database_table on "geographies" table
3. Try DATABASE QUERY TOOLS to get raw data instead

**If a DATABASE QUERY returns no results:**
1. Use describe_database_table to see available columns and sample data
2. Try search_database to find the geography across all tables
3. Check spelling of geography names (use fuzzy matching with "like" operator)
4. Try parent geography (if county fails, try state)

**If user asks for data you can't find:**
1. Use get_database_summary to see what's actually available
2. Suggest closest alternative data source
3. Be transparent: "I don't have [X] data, but I can provide [Y] instead"

### Handling Ambiguity
- **Unclear geography** → Ask which geography type they mean (metro/county/zip/state)
- **Ambiguous metric** → Use get_database_summary or describe_database_table to list options
- **Multiple interpretations** → Choose most likely, explain your choice
- **Unclear timeframe** → Default to most recent data, mention the date

## UNDERSTANDING "HOT MARKETS"

**PropertyIQ Scores (investoredge_score, homeready_score)**
- **What it is**: Proprietary predictive scores (0-100) that forecast future appreciation
- **Based on**: Combines affordability, demand, supply, economic factors, price momentum
- **Best for**: Finding undervalued markets with high growth potential
- **Access via**: get_rankings tool

**Realtor.com Hotness (hotness_rank)**
- **What it is**: Ranking of current market activity (1 = hottest, lower is better)
- **Based on**: Page views, listing velocity, price changes, days on market
- **Best for**: Finding markets with high buyer demand RIGHT NOW
- **Access via**: query_database_table(table_name="realtor_metro", columns=["geography_name", "hotness_rank"])

**Key Difference**:
- PropertyIQ = **Predictive** (where to invest for future returns)
- Realtor Hotness = **Current activity** (where buyers are looking now)
- They often don't match! A "hot" Realtor market might have low PropertyIQ scores (overheated), or vice versa (undervalued opportunity)

## COMMON METRIC NAMES → DATABASE COLUMNS

**When user asks for → Use this column:**
- "home price" / "home value" → zhvi (Zillow), median_sale_price (Realtor)
- "rent" / "rental price" → zri (Zillow), median_rent (HUD FMR)
- "inventory" / "homes for sale" → inventory (Zillow), active_listings (Realtor)
- "appreciation" / "growth" → appreciation_12m, appreciation_36m (Zillow/PropertyIQ)
- "population" → population (Census)
- "income" → median_income (Census)
- "unemployment" → unemployment_rate (Economic)
- "listings" → new_listings (Zillow/Realtor), active_listings (Realtor)
- "days on market" / "DOM" → days_on_market (Realtor), days_to_pending (Zillow)
- "score" → investoredge_score, homeready_score, market_health_score (PropertyIQ)

**Geography Columns:**
- geography_id → unique identifier (e.g., "G4000600")
- geography_name → human-readable name (e.g., "Austin, TX")
- geography_type → metro, county, zip, state
- state → 2-letter state code (e.g., "TX")

## SCORE INTERPRETATION
- **investoredge_score** (0-100): For investors - cash flow, appreciation potential, rental demand
  - Components: cashflow, growth, demand, entrypoint, risk
- **homeready_score** (0-100): For homebuyers - affordability, stability, quality of life
  - Components: affordability, stability, value, livability, momentum
- **market_health_score** (0-100): Overall market strength and momentum
- Higher scores = better opportunity

## STATE CODES
Use standard 2-letter uppercase codes: TX, CA, FL, NY, etc.

## QUICK REFERENCE: EXAMPLE QUERIES

**Rankings & Hot Markets:**
```
User: "Find hot markets"
Tools:
  1. get_rankings(score_type="investoredge", limit=10)
  DONE! (geography names are included in response)
```

```
User: "Top Texas metros"
Tools:
  1. get_rankings(score_type="investoredge", states=["TX"], limit=10)
  DONE!
```

```
User: "Compare Realtor hotness to PropertyIQ"
Tools:
  1. get_rankings(score_type="investoredge", limit=10)
  2. query_database_table(table_name="realtor_metro", columns=["geography_name", "hotness_rank"], order_by={"hotness_rank": "asc"}, limit=10)
  DONE! Compare and explain.
```

**Data Lookup:**
```
User: "Home prices in Austin"
Tools:
  1. query_database_table(table_name="zillow_metro", filters={"geography_name": {"like": "%Austin%"}}, columns=["geography_name", "zhvi", "date"])
  DONE!
```

**Analysis:**
```
User: "Which features predict returns?"
Tools:
  1. run_regression(target="actual_appreciation_12m")
  DONE!
```

**News:**
```
User: "Austin market news"
Tools:
  1. search_real_estate_news(location="Austin, TX")
  DONE!
```

Remember: Simple queries = 1-2 tool calls maximum!`;

    // Add context if provided (e.g., focused on specific geography)
    if (context?.geographyType && context?.geographyId) {
      prompt += `\n\nCURRENT CONTEXT: The user is focused on ${context.geographyName || context.geographyId} (${context.geographyType}). Relate analysis to this market when relevant.`;
    }

    return prompt;
  }
}
