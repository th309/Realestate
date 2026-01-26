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
   * 3-tier system: Haiku 3.5 (fast) → Sonnet 4 (balanced) → Opus 4.5 (powerful)
   */
  private selectInitialModel(message: string): string {
    const lowerMessage = message.toLowerCase();

    // Complex patterns - start with Sonnet (balanced) to avoid escalation overhead
    const complexPatterns = [
      /(optimize|regression|cluster|feature importance)/i,
      /(predict|correlation|statistical|significance)/i,
      /(raw.*metric|zillow.*data|realtor.*data|census.*data)/i,
      /(backtest|validation|test.*strategy|quintile)/i,
      /compare.*across.*and.*and/i, // Multi-geography comparisons
      /(machine learning|ml|model.*weight)/i,
    ];

    // Check for complex queries - start with Sonnet
    if (complexPatterns.some(p => p.test(lowerMessage))) {
      this.logger.log(`[Quinn Model] Starting with Sonnet 4 (detected complex/ML query) - $3/$15 per MTok`);
      return this.MODEL_BALANCED;
    }

    // Default: Start with Haiku 3.5 (cheapest), escalate if needed
    this.logger.log(`[Quinn Model] Starting with Haiku 3.5 (default) - $0.25/$1.25 per MTok`);
    return this.MODEL_FAST;
  }

  /**
   * Determine if escalation is needed based on tools used
   * 3-tier escalation: Haiku 3.5 (fast) → Sonnet 4 (balanced) → Opus 4.5 (powerful)
   * Returns the target model to escalate to, or null if no escalation needed
   */
  private shouldEscalate(toolsUsed: string[], currentModel: string): string | null {
    const moderateTools = [
      'analyze_data',
      'compare_to_benchmark',
      'get_geographic_comparison',
      'compare_states',
      'get_metro_scores',
      'search_database',
      'query_database_table',
    ];

    const complexTools = [
      'run_regression',
      'get_feature_importance',
      'cluster_markets',
      'optimize_weights',
      'generate_chart',
      'analyze_raw_metrics',
      'get_raw_metric_summary',
      'run_backtest',
      'run_quintile_analysis',
      'compare_formulas',
      'aggregate_database',
    ];

    const hasComplexTools = toolsUsed.some(t => complexTools.includes(t));
    const hasModerateTools = toolsUsed.some(t => moderateTools.includes(t));
    const toolCount = toolsUsed.length;

    // Haiku 3.5 (fast) - escalate to Sonnet if complex tools or multiple tools
    if (currentModel === this.MODEL_FAST) {
      if (hasComplexTools) {
        this.logger.log(`[Quinn Escalation] Haiku 3.5 → Sonnet 4 (complex tools: ${toolsUsed.filter(t => complexTools.includes(t)).join(', ')}) - Cost: $0.25 → $3/MTok`);
        return this.MODEL_BALANCED;
      }
      if (hasModerateTools && toolCount >= 2) {
        this.logger.log(`[Quinn Escalation] Haiku 3.5 → Sonnet 4 (${toolCount} moderate tools) - Cost: $0.25 → $3/MTok`);
        return this.MODEL_BALANCED;
      }
      if (toolCount >= 3) {
        this.logger.log(`[Quinn Escalation] Haiku 3.5 → Sonnet 4 (${toolCount} tools) - Cost: $0.25 → $3/MTok`);
        return this.MODEL_BALANCED;
      }
    }

    // Sonnet 4 (balanced) - escalate to Opus only for very complex multi-tool scenarios
    if (currentModel === this.MODEL_BALANCED) {
      if (hasComplexTools && toolCount >= 4) {
        this.logger.log(`[Quinn Escalation] Sonnet 4 → Opus 4.5 (${toolCount} complex tools - heavy reasoning needed) - Cost: $3 → $15/MTok`);
        return this.MODEL_POWERFUL;
      }
    }

    // Opus 4.5 (powerful) - no further escalation possible
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
    let finalResponse = '';

    // Select initial model based on query characteristics
    let currentModel = this.selectInitialModel(userMessage);
    let hasEscalated = false;

    try {
      this.logger.log(`[Quinn Chat] Processing message in conversation ${conversationId}`);
      this.logger.log(`[Quinn Chat] User message: "${userMessage.slice(0, 100)}..."`);
      this.logger.log(`[Quinn Chat] Conversation history length: ${apiMessages.length} messages`);
      this.logger.log(`[Quinn Chat] Available tools: ${tools.length}`);
      this.logger.log(`[Quinn Chat] System prompt length: ${systemPrompt.length} chars`);

      // Initial request
      this.logger.log(`[Quinn Chat] Calling Claude API (model: ${currentModel})...`);
      const apiStartTime = Date.now();

      let response = await this.client.messages.create({
        model: currentModel,
        max_tokens: 2048,
        system: systemPrompt,
        tools: tools as any,
        messages: apiMessages,
      });

      const apiDuration = Date.now() - apiStartTime;
      this.logger.log(`[Quinn Chat] Claude API responded in ${apiDuration}ms`);
      this.logger.log(`[Quinn Chat] Stop reason: ${response.stop_reason}`);
      this.logger.log(`[Quinn Chat] Content blocks: ${response.content.length}`);

      // Process tool calls in a loop (max 10 iterations to prevent infinite loops)
      let iterations = 0;
      const maxIterations = 10;

      while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
        iterations++;
        this.logger.debug(`Tool use iteration ${iterations}`);

        const toolUseBlocks = response.content.filter(
          (block) => block.type === 'tool_use',
        );

        // Check for escalation on first tool use iteration
        if (iterations === 1 && !hasEscalated) {
          const requestedTools = toolUseBlocks
            .filter((b) => b.type === 'tool_use')
            .map((b) => b.name);

          const escalationTarget = this.shouldEscalate(requestedTools, currentModel);

          if (escalationTarget) {
            // Escalate: restart with more powerful model
            hasEscalated = true;
            currentModel = escalationTarget;

            this.logger.log(`[Quinn Chat] Restarting with ${currentModel}...`);
            const escalationStartTime = Date.now();

            response = await this.client.messages.create({
              model: currentModel,
              max_tokens: 2048,
              system: systemPrompt,
              tools: tools as any,
              messages: apiMessages,
            });

            const escalationDuration = Date.now() - escalationStartTime;
            this.logger.log(`[Quinn Chat] Escalated model responded in ${escalationDuration}ms`);

            // Reset iteration counter for escalated attempt
            iterations = 0;
            continue;
          }
        }

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

        // Continue conversation with tool results
        response = await this.client.messages.create({
          model: currentModel,
          max_tokens: 2048,
          system: systemPrompt,
          tools: tools as any,
          messages: [
            ...apiMessages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: toolResults },
          ],
        });
      }

      if (iterations >= maxIterations) {
        this.logger.warn('Max tool iterations reached');
      }

      // Extract final text response
      const textBlock = response.content.find((block) => block.type === 'text');
      finalResponse =
        textBlock?.text ||
        'I was unable to generate a response. Please try again.';

      // Save assistant response to history
      conversation.messages.push({ role: 'assistant', content: finalResponse });

      // Extract structured data from tool results
      const structuredData = this.extractStructuredData(toolResultsData);

      this.logger.log(
        `[Quinn Chat] Completed with ${currentModel}, used ${toolsUsed.length} tools${hasEscalated ? ' (escalated)' : ''}`,
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
    let prompt = `You are an expert real estate analytics assistant for PropertyIQ. You help users analyze market data, understand score correlations, and identify investment opportunities.

## BASIC TOOLS
1. get_available_filters - Get states, metros, score types, date ranges
2. filter_geographies - Filter by geography, state, score range
3. analyze_data - Run statistical analysis with correlations
4. compare_to_benchmark - Compare markets to national average
5. get_rankings - Top/bottom performing markets
6. get_time_series - Historical data for specific markets

## ADVANCED ML TOOLS (use cached score data)
7. run_regression - OLS/Ridge regression to find which metrics predict outcomes. Returns coefficients, p-values, R².
8. get_feature_importance - Random Forest/Gradient Boosting feature ranking. Shows which features matter most.
9. cluster_markets - K-means clustering to group similar markets.
10. optimize_weights - Find optimal score weights to maximize correlation with outcomes.
11. generate_chart - Create Plotly visualizations (scatter, bar, histogram, box).

## RAW DATA TOOLS (query database directly - may take 2-5 seconds)
12. analyze_raw_metrics - Analyze RAW Zillow, Realtor, Census, Economic data against outcomes. Finds which raw metrics best predict appreciation.
13. get_raw_metric_summary - List available raw metrics from each data source.

## WHEN TO USE ADVANCED TOOLS
- "Which metrics predict appreciation?" → run_regression or get_feature_importance
- "What are the optimal score weights?" → optimize_weights
- "Group similar markets" → cluster_markets
- "Show me a chart of score vs appreciation" → generate_chart with chart_type="scatter"
- "What's the distribution of scores?" → generate_chart with chart_type="histogram"

## WHEN TO USE RAW DATA TOOLS
- "Which raw Zillow metrics predict returns?" → analyze_raw_metrics with data_sources=["zillow"]
- "What raw data is available?" → get_raw_metric_summary
- "Do unemployment rates predict appreciation?" → analyze_raw_metrics with data_sources=["economic"]
- "Which features matter most for 3-year returns?" → analyze_raw_metrics with target="actual_appreciation_36m"

## GUIDELINES
- Always explain what analysis you're performing
- Present results with specific numbers
- For correlations: positive = higher scores predicted better returns
- Use percentages for appreciation (multiply by 100)
- Keep responses concise (200-400 words)
- Provide sample sizes for statistical results

## SCORE INTERPRETATION
- investoredge_score: For investors (cash flow, appreciation)
- homeready_score: For homebuyers (affordability, conditions)
- Scores: 0-100, higher is better
- Score components: affordability, stability, value, livability, momentum (homeready) or cashflow, growth, demand, entrypoint, risk (investoredge)

## STATE CODES
Use standard 2-letter uppercase codes: TX, CA, FL, NY, etc.

## EXAMPLE QUERIES
- "Texas metros" → filter states=["TX"], geography_type="metro", then analyze
- "What predicts returns?" → run_regression with target="actual_appreciation_12m"
- "Feature importance for 3-year returns" → get_feature_importance with target="actual_appreciation_36m"
- "Optimal investoredge weights" → optimize_weights with score_type="investoredge"
- "Top 10 in California" → get_rankings with states=["CA"]`;

    // Add context if provided (e.g., focused on specific geography)
    if (context?.geographyType && context?.geographyId) {
      prompt += `\n\nCURRENT CONTEXT: The user is focused on ${context.geographyName || context.geographyId} (${context.geographyType}). Relate analysis to this market when relevant.`;
    }

    return prompt;
  }
}
