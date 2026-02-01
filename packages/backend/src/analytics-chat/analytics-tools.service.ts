/**
 * Analytics Tools Service
 *
 * Executes tool calls against the Python analytics service.
 * Defines the tools available for Claude to use.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
}

@Injectable()
export class AnalyticsToolsService {
  private readonly logger = new Logger(AnalyticsToolsService.name);
  private readonly analyticsBaseUrl: string;
  /** Cached tool definitions to avoid rebuilding on every request */
  private toolDefinitionsCache: any[] | null = null;

  constructor(private readonly configService: ConfigService) {
    this.analyticsBaseUrl =
      this.configService.get<string>('ANALYTICS_SERVICE_URL') ||
      'http://localhost:8000';
    this.logger.log(`[Analytics Tools] Service URL: ${this.analyticsBaseUrl}`);

    // Test connectivity on startup
    this.testConnectivity();
  }

  /**
   * Test connectivity to analytics service on startup
   */
  private async testConnectivity(): Promise<void> {
    try {
      this.logger.log(`[Analytics Tools] Testing connectivity to ${this.analyticsBaseUrl}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.analyticsBaseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        this.logger.log(`[Analytics Tools] ✓ Connected successfully (status: ${response.status})`);
      } else {
        this.logger.warn(`[Analytics Tools] ⚠ Service responded with status: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`[Analytics Tools] ✗ Failed to connect: ${error.message}`);
      this.logger.error(`[Analytics Tools] Tools will fail until Analytics service is reachable at ${this.analyticsBaseUrl}`);
    }
  }

  /**
   * Execute a tool call against the analytics service
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<ToolResult> {
    const startTime = Date.now();
    this.logger.log(`[Tool ${toolName}] === EXECUTING ===`);
    this.logger.log(`[Tool ${toolName}] Analytics base URL: ${this.analyticsBaseUrl}`);
    this.logger.log(`[Tool ${toolName}] Arguments: ${JSON.stringify(args)}`);

    try {
      let endpoint = this.getToolEndpoint(toolName);
      let method = 'POST';

      // Handle special cases
      if (toolName === 'get_available_filters' || toolName === 'get_database_tables' || toolName === 'get_database_summary') {
        method = 'GET';
      } else if (toolName === 'describe_database_table' && args.table_name) {
        // Append table name to URL for describe endpoint
        endpoint = `${endpoint}/${args.table_name}`;
        method = 'GET';
      }

      const url = `${this.analyticsBaseUrl}${endpoint}`;
      this.logger.log(`[Tool ${toolName}] Calling ${method} ${url}`);

      const fetchStart = Date.now();
      // Zip-level rankings (especially appreciation) can take 30–60s; use longer timeout for get_rankings
      const timeoutMs = toolName === 'get_rankings' ? 90000 : 60000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response;
      try {
        response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: method === 'POST' ? JSON.stringify(args) : undefined,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      const fetchDuration = Date.now() - fetchStart;

      this.logger.log(`[Tool ${toolName}] Response status: ${response.status} (${fetchDuration}ms)`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`[Tool ${toolName}] API error: ${response.status} - ${errorText.slice(0, 500)}`);
        throw new Error(`API error: ${response.status} - ${errorText.slice(0, 200)}`);
      }

      const responseText = await response.text();
      this.logger.log(`[Tool ${toolName}] Raw response (first 1000 chars): ${responseText.slice(0, 1000)}`);
      this.logger.log(`[Tool ${toolName}] Response size: ${responseText.length} bytes`);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        this.logger.error(`[Tool ${toolName}] JSON parse error: ${parseError.message}`);
        this.logger.error(`[Tool ${toolName}] Raw response: ${responseText.slice(0, 500)}`);
        throw new Error(`Invalid JSON from analytics service`);
      }

      const totalDuration = Date.now() - startTime;
      this.logger.log(`[Tool ${toolName}] === SUCCESS === (${totalDuration}ms total)`);
      this.logger.debug(`[Tool ${toolName}] Final data keys: ${JSON.stringify(Object.keys(data || {}))}`);

      return { success: true, data };
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.logger.error(`[Tool ${toolName}] === FAILED === (${totalDuration}ms)`);
      this.logger.error(`[Tool ${toolName}] Error: ${error.message}`);
      this.logger.error(`[Tool ${toolName}] Stack: ${error.stack}`);
      return { success: false, data: null, error: error.message };
    }
  }

  private getToolEndpoint(toolName: string): string {
    const endpoints: Record<string, string> = {
      // Basic adhoc tools
      get_available_filters: '/api/v1/adhoc/metadata',
      filter_geographies: '/api/v1/adhoc/filter',
      analyze_data: '/api/v1/adhoc/analyze',
      compare_to_benchmark: '/api/v1/adhoc/compare',
      get_rankings: '/api/v1/adhoc/rank',
      get_time_series: '/api/v1/adhoc/history',
      // Advanced ML tools
      run_regression: '/api/v1/advanced/regression',
      get_feature_importance: '/api/v1/advanced/feature-importance',
      cluster_markets: '/api/v1/advanced/cluster',
      optimize_weights: '/api/v1/advanced/optimize-weights',
      generate_chart: '/api/v1/advanced/chart',
      // Raw metric tools (query DB directly)
      analyze_raw_metrics: '/api/v1/advanced/raw-metrics/analyze',
      get_raw_metric_summary: '/api/v1/advanced/raw-metrics/summary',
      // Backtest / Quintile validation tools
      run_backtest: '/api/v1/advanced/backtest',
      run_quintile_analysis: '/api/v1/advanced/quintile-analysis',
      compare_formulas: '/api/v1/advanced/formula-comparison',
      // Database query tools (direct access to real estate data)
      get_database_tables: '/api/v1/database/tables',
      describe_database_table: '/api/v1/database/tables',
      query_database_table: '/api/v1/database/query',
      search_database: '/api/v1/database/search',
      aggregate_database: '/api/v1/database/aggregate',
      get_database_summary: '/api/v1/database/summary',
      // News analysis tools
      search_real_estate_news: '/api/v1/news/search',
      analyze_news_impact: '/api/v1/news/analyze-impact',
      // Geography relationship tools
      find_neighboring_geographies: '/api/v1/geography/neighbors',
      compare_to_neighbors: '/api/v1/geography/compare-to-neighbors',
      find_similar_geographies: '/api/v1/geography/find-similar',
    };

    const endpoint = endpoints[toolName];
    if (!endpoint) {
      this.logger.warn(`Unknown tool: ${toolName}, defaulting to analyze`);
      return '/api/v1/adhoc/analyze';
    }
    return endpoint;
  }

  /**
   * Get tool definitions for Claude (cached after first build).
   */
  getToolDefinitions(): any[] {
    if (this.toolDefinitionsCache) {
      return this.toolDefinitionsCache;
    }
    this.toolDefinitionsCache = [
      {
        name: 'get_available_filters',
        description:
          'Get metadata about available filter options including states, metros, score types, and date ranges. Use this first to understand what data is available.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'filter_geographies',
        description: `Filter PropertyIQ scored data by geography type, state, or score range.

FAST - uses cached data (<150ms). Use this as STEP 1 before get_rankings when filtering is needed.

═══════════════════════════════════════════════════════════════════
WHEN TO USE THIS TOOL:
═══════════════════════════════════════════════════════════════════

Use when query includes filtering criteria:
  ✓ "markets in Texas" → filter by state
  ✓ "metros with score above 80" → filter by score threshold
  ✓ "affordable high-scoring areas" → filter by score range
  ✓ "counties in the Southeast" → filter by multiple states
  ✓ "zips with InvestorEdge over 90" → filter by score

DO NOT use if:
  ✗ Simple ranking query without filters → just use get_rankings
  ✗ User asking for appreciation data → use get_rankings with sort_by

TYPICAL WORKFLOW:
  Step 1: Call filter_geographies to narrow dataset
  Step 2: Call get_rankings to sort the filtered results

═══════════════════════════════════════════════════════════════════
PARAMETER REFERENCE:
═══════════════════════════════════════════════════════════════════

geography_type (REQUIRED):
  - "metro" = Metropolitan areas
  - "county" = Counties
  - "zip" = ZIP codes
  - "state" = States
  - This determines what level of geography to filter

states (OPTIONAL):
  - Array of 2-letter uppercase state codes
  - Examples: ["TX"], ["CA", "FL", "TX"], ["NY", "NJ", "CT"]
  - Use for queries like "markets in Texas" or "metros in the Southeast"

score_type (REQUIRED):
  - "investoredge_score" = Filter by InvestorEdge score
  - "homeready_score" = Filter by HomeReady score
  - "market_health_score" = Filter by Market Health score
  - This determines WHICH score to apply min/max filters to

min_score (OPTIONAL):
  - Minimum score threshold (0-100)
  - Use for queries like "scores above 80"
  - Can be combined with max_score for range

max_score (OPTIONAL):
  - Maximum score threshold (0-100)
  - Use for queries like "scores below 60"
  - Can be combined with min_score for range

═══════════════════════════════════════════════════════════════════
RETURNS:
═══════════════════════════════════════════════════════════════════

{
  "filtered_count": 25,              // Number of records after filtering
  "geography_count": 25,             // Number of unique geographies
  "filter_applied": {
    "geography_type": "metro",
    "states": ["TX"],
    "score_type": "investoredge_score",
    "min_score": 80
  },
  "summary": "Filtered to 25 metros in Texas with InvestorEdge score >= 80"
}

NOTE: This tool ONLY returns counts, not the actual data.
You MUST follow up with get_rankings to retrieve the actual ranked results.

═══════════════════════════════════════════════════════════════════
USAGE EXAMPLES:
═══════════════════════════════════════════════════════════════════

Example 1: "Show me metros in Texas"
Step 1 - Filter:
{
  "geography_type": "metro",
  "states": ["TX"],
  "score_type": "investoredge_score"
}

Step 2 - Rank (use same filter):
get_rankings({
  "filter": {
    "geography_type": "metro",
    "states": ["TX"],
    "score_type": "investoredge_score"
  },
  "limit": 10,
  "ascending": false
})

Example 2: "Find counties with HomeReady score above 80"
Step 1 - Filter:
{
  "geography_type": "county",
  "score_type": "homeready_score",
  "min_score": 80
}

Step 2 - Rank (use same filter):
get_rankings({
  "filter": {
    "geography_type": "county",
    "score_type": "homeready_score",
    "min_score": 80
  },
  "limit": 10,
  "ascending": false
})`,
        input_schema: {
          type: 'object',
          properties: {
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
              description: 'REQUIRED. Type of geography to filter: metro, county, zip, or state',
            },
            states: {
              type: 'array',
              items: { type: 'string' },
              description: 'OPTIONAL. State codes to include. Must be 2-letter uppercase codes like ["TX", "CA"]',
            },
            min_score: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'OPTIONAL. Minimum score threshold (0-100). Use for "scores above X" queries',
            },
            max_score: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'OPTIONAL. Maximum score threshold (0-100). Use for "scores below X" queries',
            },
            score_type: {
              type: 'string',
              enum: [
                'investoredge_score',
                'homeready_score',
                'market_health_score',
              ],
              description: 'REQUIRED. Which score to filter by: investoredge_score (investors), homeready_score (homebuyers), market_health_score (overall)',
            },
          },
          required: ['geography_type', 'score_type'],
        },
      },
      {
        name: 'analyze_data',
        description: `Perform statistical analysis of PropertyIQ scored data.

FAST - uses cached data (<250ms). Returns summary statistics, correlations, and top/bottom performers.

═══════════════════════════════════════════════════════════════════
WHEN TO USE THIS TOOL:
═══════════════════════════════════════════════════════════════════

Use for analytical queries that need statistical insights:
  ✓ "what drives high scores" → correlation analysis
  ✓ "correlation between score and appreciation" → correlation analysis
  ✓ "statistical summary of top markets" → summary stats
  ✓ "analyze metro performance" → comprehensive analysis
  ✓ "how do scores correlate with outcomes" → correlation analysis

DO NOT use for:
  ✗ Simple rankings → use get_rankings instead
  ✗ Filtering only → use filter_geographies instead
  ✗ Comparing to benchmark → use compare_to_benchmark instead

═══════════════════════════════════════════════════════════════════
PARAMETER REFERENCE:
═══════════════════════════════════════════════════════════════════

filter (REQUIRED):
  - MUST include geography_type: "metro", "county", "zip", or "state"
  - MUST include score_type: which score to analyze
  - OPTIONAL: states array to filter by state
  - OPTIONAL: min_score/max_score to filter by score range

  Example:
  {
    "geography_type": "metro",
    "score_type": "investoredge_score",
    "states": ["TX", "CA"],
    "min_score": 70
  }

horizons (OPTIONAL):
  - Array of time horizons in months: [12, 36, 60]
  - Default: [12, 36] (1-year and 3-year)
  - Used to analyze correlation between scores and future appreciation
  - Example: [12] for just 1-year forward appreciation

═══════════════════════════════════════════════════════════════════
RETURNS:
═══════════════════════════════════════════════════════════════════

{
  "summary_stats": {
    "count": 50,                           // Number of geographies analyzed
    "mean_score": 85.2,                    // Average score
    "median_score": 84.5,                  // Median score
    "std_dev": 3.8,                        // Standard deviation
    "min_score": 78.1,                     // Minimum score
    "max_score": 95.7                      // Maximum score
  },
  "correlations": {
    "score_vs_appreciation_12m": 0.72,     // Correlation with 12-month appreciation
    "score_vs_appreciation_36m": 0.68,     // Correlation with 36-month appreciation
    "p_value_12m": 0.001,                  // Statistical significance
    "p_value_36m": 0.003
  },
  "top_performers": [                      // Top 5 geographies by score
    {
      "geography_name": "Austin, TX",
      "score": 95.7,
      "appreciation_12m": 18.5
    },
    ...
  ],
  "bottom_performers": [                   // Bottom 5 geographies by score
    ...
  ],
  "filter_applied": {
    "geography_type": "metro",
    "score_type": "investoredge_score",
    "count_before_filter": 384,
    "count_after_filter": 50
  }
}

Interpretation:
  - Correlation values range from -1 to 1
  - 0.7 to 1.0 = Strong positive correlation (score predicts appreciation well)
  - 0.3 to 0.7 = Moderate correlation
  - -0.3 to 0.3 = Weak/no correlation
  - p_value < 0.05 = Statistically significant

═══════════════════════════════════════════════════════════════════
USAGE EXAMPLES:
═══════════════════════════════════════════════════════════════════

Example 1: "What drives high InvestorEdge scores in Texas?"
{
  "filter": {
    "geography_type": "metro",
    "score_type": "investoredge_score",
    "states": ["TX"]
  },
  "horizons": [12, 36]
}

Example 2: "Statistical summary of top scoring metros"
{
  "filter": {
    "geography_type": "metro",
    "score_type": "investoredge_score",
    "min_score": 80
  },
  "horizons": [12]
}

Example 3: "Analyze all counties"
{
  "filter": {
    "geography_type": "county",
    "score_type": "homeready_score"
  }
}`,
        input_schema: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              description: 'REQUIRED. Filter criteria to apply before analysis. Must include geography_type and score_type.',
              properties: {
                geography_type: {
                  type: 'string',
                  enum: ['state', 'metro', 'county', 'zip'],
                  description: 'REQUIRED. Geography level to analyze',
                },
                states: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'OPTIONAL. Filter to specific states: ["TX", "CA"]',
                },
                min_score: {
                  type: 'number',
                  description: 'OPTIONAL. Minimum score threshold (0-100)',
                },
                max_score: {
                  type: 'number',
                  description: 'OPTIONAL. Maximum score threshold (0-100)',
                },
                score_type: {
                  type: 'string',
                  enum: ['investoredge_score', 'homeready_score', 'market_health_score'],
                  description: 'REQUIRED. Which score to analyze',
                },
              },
              required: ['geography_type', 'score_type'],
            },
            horizons: {
              type: 'array',
              items: { type: 'integer' },
              description: 'OPTIONAL. Time horizons in months for correlation analysis: [12, 36, 60]. Default: [12, 36]',
            },
          },
          required: ['filter'],
        },
      },
      {
        name: 'compare_to_benchmark',
        description: `Compare specific geographies to national or regional benchmarks.

FAST - uses cached data (<200ms). Returns comparison showing how markets perform vs average.

═══════════════════════════════════════════════════════════════════
WHEN TO USE THIS TOOL:
═══════════════════════════════════════════════════════════════════

Use for comparison queries:
  ✓ "compare Austin to national average"
  ✓ "how does Miami benchmark"
  ✓ "is Denver above or below average"
  ✓ "Austin vs national average"
  ✓ "how do Texas metros compare to the US"

DO NOT use for:
  ✗ Simple rankings → use get_rankings
  ✗ Comparing two specific markets → use get_rankings for both
  ✗ Statistical analysis → use analyze_data

═══════════════════════════════════════════════════════════════════
PARAMETER REFERENCE:
═══════════════════════════════════════════════════════════════════

filter (REQUIRED):
  - Defines which geographies to compare
  - MUST include geography_type
  - MUST include score_type
  - Can include states to filter specific geographies
  - Can include specific geography names (if backend supports)

  Example:
  {
    "geography_type": "metro",
    "score_type": "investoredge_score",
    "states": ["TX"]
  }

benchmark_type (REQUIRED):
  - "national" = Compare to US national average (most common)
  - "regional" = Compare to regional average (same geographic region)
  - Default: "national"

═══════════════════════════════════════════════════════════════════
RETURNS:
═══════════════════════════════════════════════════════════════════

{
  "comparisons": [
    {
      "geography_id": "12345",
      "geography_name": "Austin, TX",
      "score": 95.2,                       // Market's score
      "benchmark_score": 68.5,             // Benchmark average score
      "difference": 26.7,                  // Absolute difference
      "percent_difference": 39.0,          // Percentage difference
      "percentile": 98.5,                  // Percentile rank nationally
      "interpretation": "significantly above average"
    },
    {
      "geography_name": "El Paso, TX",
      "score": 62.1,
      "benchmark_score": 68.5,
      "difference": -6.4,
      "percent_difference": -9.3,
      "percentile": 42.3,
      "interpretation": "slightly below average"
    },
    ...
  ],
  "benchmark_type": "national",
  "benchmark_score": 68.5,                 // Overall benchmark value
  "score_type": "investoredge_score",
  "geography_type": "metro"
}

Interpretation:
  - Positive difference = above benchmark (good)
  - Negative difference = below benchmark (needs attention)
  - Percentile shows ranking: 90+ = top tier, <50 = below average
  - Interpretation provides human-readable assessment

═══════════════════════════════════════════════════════════════════
USAGE EXAMPLES:
═══════════════════════════════════════════════════════════════════

Example 1: "Compare Austin to national average"
{
  "filter": {
    "geography_type": "metro",
    "score_type": "investoredge_score",
    "states": ["TX"]
  },
  "benchmark_type": "national"
}
Note: If you need just Austin, may need to filter results or use geography name filter

Example 2: "How do Texas metros compare nationally?"
{
  "filter": {
    "geography_type": "metro",
    "score_type": "investoredge_score",
    "states": ["TX"]
  },
  "benchmark_type": "national"
}

Example 3: "Is Miami above or below average?"
{
  "filter": {
    "geography_type": "metro",
    "score_type": "homeready_score",
    "states": ["FL"]
  },
  "benchmark_type": "national"
}`,
        input_schema: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              description: 'REQUIRED. Defines which geographies to compare. Must include geography_type and score_type.',
              properties: {
                geography_type: {
                  type: 'string',
                  enum: ['state', 'metro', 'county', 'zip'],
                  description: 'REQUIRED. Geography level to compare',
                },
                states: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'OPTIONAL. Filter to specific states: ["TX", "FL"]',
                },
                score_type: {
                  type: 'string',
                  enum: ['investoredge_score', 'homeready_score', 'market_health_score'],
                  description: 'REQUIRED. Which score to compare',
                },
              },
              required: ['geography_type', 'score_type'],
            },
            benchmark_type: {
              type: 'string',
              enum: ['national', 'regional'],
              description: 'REQUIRED. Benchmark to compare against. "national" = US average (most common), "regional" = regional average',
            },
          },
          required: ['filter', 'benchmark_type'],
        },
      },
      {
        name: 'get_rankings',
        description: `Get ranked list of top or bottom geographies by SCORE or by APPRECIATION.

FASTEST TOOL - cached data (<100ms). This is your PRIMARY TOOL for most queries.

═══════════════════════════════════════════════════════════════════
WHEN TO USE THIS TOOL:
═══════════════════════════════════════════════════════════════════

Use for ANY query asking for "best", "worst", "top", "bottom", "hot", "highest", "lowest" markets/cities/metros/counties/zips.

Examples:
  ✓ "show me hot markets" → get_rankings
  ✓ "best cities for investors" → get_rankings
  ✓ "top 10 metros" → get_rankings
  ✓ "worst performing areas" → get_rankings
  ✓ "highest scored markets" → get_rankings
  ✓ "top zip codes by appreciation" → get_rankings
  ✓ "fastest growing counties" → get_rankings

═══════════════════════════════════════════════════════════════════
TWO MODES OF OPERATION:
═══════════════════════════════════════════════════════════════════

MODE 1: SCORE-BASED RANKINGS (Most Common)
  - Use when query asks about "best markets", "high scores", "investment opportunities"
  - MUST include score_type in filter
  - Valid score_types: "investoredge_score", "homeready_score", "market_health_score"
  - Omit or set sort_by to "score"

  Example Call:
  {
    "filter": {
      "geography_type": "metro",
      "score_type": "investoredge_score"
    },
    "limit": 10,
    "ascending": false
  }

MODE 2: APPRECIATION-BASED RANKINGS
  - Use when query asks about "appreciation", "growth", "YoY price growth", "price increase"
  - DO NOT include score_type in filter
  - MUST set sort_by to "appreciation_12m"
  - This ranks by ACTUAL PRICE CHANGES, not PropertyIQ scores

  Example Call:
  {
    "filter": {
      "geography_type": "zip"
    },
    "sort_by": "appreciation_12m",
    "limit": 10,
    "ascending": false
  }

═══════════════════════════════════════════════════════════════════
PARAMETER REFERENCE:
═══════════════════════════════════════════════════════════════════

filter.geography_type (REQUIRED):
  - "metro" = Metropolitan areas (cities)
  - "county" = Counties
  - "zip" = ZIP codes
  - "state" = States

filter.score_type (REQUIRED for score rankings, OMIT for appreciation rankings):
  - "investoredge_score" = For investors (cash flow, appreciation, momentum)
  - "homeready_score" = For homebuyers (affordability, appreciation, quality of life)
  - "market_health_score" = Overall market condition
  - INVALID VALUES: "yoy_price_growth", "appreciation", etc. (use sort_by instead)

filter.states (OPTIONAL):
  - Array of 2-letter uppercase state codes: ["TX", "CA", "FL"]
  - Use to filter results to specific states

limit (OPTIONAL, default: 10):
  - Number of results to return
  - Range: 1-100

ascending (OPTIONAL, default: false):
  - false = highest first (top performers)
  - true = lowest first (bottom performers)

sort_by (OPTIONAL, default: "score"):
  - "score" = Sort by PropertyIQ score (default)
  - "appreciation_12m" = Sort by 12-month price appreciation
  - Use "appreciation_12m" ONLY for appreciation queries
  - Do NOT use score_type when using appreciation_12m

═══════════════════════════════════════════════════════════════════
RETURNS:
═══════════════════════════════════════════════════════════════════

{
  "rankings": [
    {
      "geography_id": "12345",
      "geography_name": "Austin, TX",
      "geography_type": "metro",
      "investoredge_score": 95.2,         // If score ranking
      "appreciation_12m": 15.3,           // If appreciation ranking
      "rank": 1
    },
    ...
  ],
  "count": 10,
  "geography_type": "metro",
  "sorted_by": "investoredge_score" or "appreciation_12m"
}

═══════════════════════════════════════════════════════════════════
COMMON MISTAKES TO AVOID:
═══════════════════════════════════════════════════════════════════

❌ Using score_type for appreciation: {"score_type": "yoy_price_growth"}
✅ Use sort_by instead: {"sort_by": "appreciation_12m"}

❌ Including score_type when using appreciation: {"score_type": "investoredge_score", "sort_by": "appreciation_12m"}
✅ Omit score_type for appreciation: {"sort_by": "appreciation_12m"}

❌ Forgetting geography_type: {"score_type": "investoredge_score"}
✅ Always include geography_type: {"geography_type": "metro", "score_type": "investoredge_score"}`,
        input_schema: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              description: 'Filter criteria. MUST include geography_type. For score rankings add score_type. For appreciation rankings do NOT add score_type.',
              properties: {
                geography_type: {
                  type: 'string',
                  enum: ['state', 'metro', 'county', 'zip'],
                  description: 'REQUIRED. Type of geography to rank.',
                },
                states: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'OPTIONAL. Filter to specific states using 2-letter uppercase codes: ["TX", "CA"]',
                },
                score_type: {
                  type: 'string',
                  enum: ['investoredge_score', 'homeready_score', 'market_health_score'],
                  description: 'REQUIRED for score rankings. MUST BE OMITTED for appreciation rankings. Valid values: investoredge_score, homeready_score, market_health_score',
                },
              },
              required: ['geography_type'],
            },
            limit: {
              type: 'integer',
              description: 'Number of results to return. Default: 10, Max: 100',
              minimum: 1,
              maximum: 100,
            },
            ascending: {
              type: 'boolean',
              description: 'Sort direction. false = highest first (default), true = lowest first',
            },
            sort_by: {
              type: 'string',
              enum: ['score', 'appreciation_12m'],
              description: 'What to sort by. "score" (default) = sort by PropertyIQ score. "appreciation_12m" = sort by 12-month price appreciation. When using appreciation_12m, DO NOT include score_type in filter.',
            },
          },
          required: ['filter'],
        },
      },
      {
        name: 'get_time_series',
        description:
          'Get historical time series data for a specific geography. Useful for seeing how a market has changed over time.',
        input_schema: {
          type: 'object',
          properties: {
            geography_id: {
              type: 'string',
              description: 'The ID of the geography (e.g., CBSA code for metros)',
            },
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
              description: 'Type of geography',
            },
            metrics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Metrics to retrieve, e.g., ["investoredge_score", "homeready_score"]',
            },
            months: {
              type: 'integer',
              description: 'Number of months of history (default: 24)',
            },
          },
          required: ['geography_id', 'geography_type'],
        },
      },
      // === Advanced ML Tools ===
      {
        name: 'run_regression',
        description:
          'Run regression analysis to find which features predict outcomes. Returns coefficients, p-values, R-squared, and ranked features. Use this to understand which metrics drive appreciation.',
        input_schema: {
          type: 'object',
          properties: {
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
              description: 'Geography level (default: metro)',
            },
            target: {
              type: 'string',
              description: 'Target variable: actual_appreciation_12m, actual_appreciation_36m, or actual_appreciation_60m',
            },
            features: {
              type: 'array',
              items: { type: 'string' },
              description: 'Feature columns to use. If not specified, auto-detects available score components.',
            },
            model_type: {
              type: 'string',
              enum: ['ols', 'ridge'],
              description: 'Model type: ols (with p-values) or ridge (regularized)',
            },
            states: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional state filter',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_feature_importance',
        description:
          'Calculate feature importance using Random Forest or Gradient Boosting. Returns ranked list of features by predictive power. More robust than regression for non-linear relationships.',
        input_schema: {
          type: 'object',
          properties: {
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
            },
            target: {
              type: 'string',
              description: 'Target variable to predict',
            },
            features: {
              type: 'array',
              items: { type: 'string' },
              description: 'Features to evaluate (None = auto-detect)',
            },
            method: {
              type: 'string',
              enum: ['random_forest', 'gradient_boosting'],
              description: 'ML method to use (default: random_forest)',
            },
            states: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: [],
        },
      },
      {
        name: 'cluster_markets',
        description:
          'Cluster markets into groups based on similarity using K-means. Returns cluster assignments and summary stats. Use to find similar markets or identify market segments.',
        input_schema: {
          type: 'object',
          properties: {
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
            },
            features: {
              type: 'array',
              items: { type: 'string' },
              description: 'Features to cluster on (None = auto)',
            },
            n_clusters: {
              type: 'integer',
              description: 'Number of clusters (2-20, default: 5)',
            },
            states: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: [],
        },
      },
      {
        name: 'optimize_weights',
        description:
          'Find optimal weights for score components to maximize correlation with outcomes. Compares baseline (equal weights) vs optimized. Use to evaluate if current weights are optimal.',
        input_schema: {
          type: 'object',
          properties: {
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
            },
            score_type: {
              type: 'string',
              enum: ['investoredge', 'homeready'],
              description: 'Which score to optimize',
            },
            target: {
              type: 'string',
              description: 'Target variable to optimize for',
            },
            states: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: [],
        },
      },
      {
        name: 'generate_chart',
        description:
          'Generate a Plotly chart for visualization. Returns HTML and JSON for rendering. Use for scatter plots, histograms, bar charts, box plots.',
        input_schema: {
          type: 'object',
          properties: {
            chart_type: {
              type: 'string',
              enum: ['scatter', 'bar', 'histogram', 'box'],
              description: 'Type of chart to generate',
            },
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
            },
            x_column: {
              type: 'string',
              description: 'X-axis column (defaults based on chart type)',
            },
            y_column: {
              type: 'string',
              description: 'Y-axis column',
            },
            color_column: {
              type: 'string',
              description: 'Column for color grouping',
            },
            title: {
              type: 'string',
              description: 'Chart title',
            },
            states: {
              type: 'array',
              items: { type: 'string' },
            },
            limit: {
              type: 'integer',
              description: 'Max data points (10-500, default: 100)',
            },
          },
          required: ['chart_type'],
        },
      },
      // === Raw Metric Tools (query DB directly for raw data analysis) ===
      {
        name: 'analyze_raw_metrics',
        description:
          'Analyze RAW metrics from Zillow, Realtor, Census, Economic data against outcomes. Queries database directly (not cache). Use this to discover which raw data metrics best predict appreciation. Returns correlations, regression, and feature importance. May take 2-5 seconds.',
        input_schema: {
          type: 'object',
          properties: {
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
              description: 'Geography level',
            },
            target: {
              type: 'string',
              description: 'Target: actual_appreciation_12m, actual_appreciation_36m, or actual_appreciation_60m',
            },
            data_sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Sources to include: zillow, realtor, census, economic, calculated. Default: all.',
            },
            states: {
              type: 'array',
              items: { type: 'string' },
              description: 'State filter',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_raw_metric_summary',
        description:
          'Get list of available raw metrics from each data source (Zillow, Realtor, Census, Economic, Calculated). Use this to see what raw data is available for analysis.',
        input_schema: {
          type: 'object',
          properties: {
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
            },
          },
          required: [],
        },
      },
      // === Backtest / Quintile Validation Tools ===
      {
        name: 'run_backtest',
        description:
          'Run comprehensive backtest analysis with quintile validation. Returns the complete validation report including: quintile breakdown with beat rates, top/bottom quintile excess returns, SPREAD (top - bottom), T-test p-values, Spearman correlation, and confidence grade (A-F). Use this for full validation reports across multiple time horizons.',
        input_schema: {
          type: 'object',
          properties: {
            score_type: {
              type: 'string',
              enum: ['investoredge', 'homeready', 'market_health'],
              description: 'Score type to validate (default: investoredge)',
            },
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
              description: 'Geography level (default: metro)',
            },
            benchmark_type: {
              type: 'string',
              enum: ['national', 'regional', 'peer'],
              description: 'Benchmark type (default: national)',
            },
            horizons: {
              type: 'array',
              items: { type: 'integer' },
              description: 'Time horizons in months to test, e.g., [12, 36, 60]. Default: [12, 36, 60]',
            },
            use_cache: {
              type: 'boolean',
              description: 'Use cached data for faster results (default: true)',
            },
          },
          required: [],
        },
      },
      {
        name: 'run_quintile_analysis',
        description:
          'Run quintile validation analysis for a single score and time horizon. Returns detailed quintile breakdown with beat rates in the exact format needed for validation summary tables: Top Quintile Excess Return, Bottom Quintile Excess Return, SPREAD, T-test p-value, Spearman Correlation, and beat rates. Faster than full backtest if you only need one horizon. Use this when the user asks about quintile performance or validation metrics.',
        input_schema: {
          type: 'object',
          properties: {
            score_type: {
              type: 'string',
              enum: ['investoredge', 'homeready', 'market_health'],
              description: 'Score type to validate',
            },
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
              description: 'Geography level (default: metro)',
            },
            horizon_months: {
              type: 'integer',
              description: 'Time horizon in months: 12, 36, or 60 (default: 36)',
            },
            use_cache: {
              type: 'boolean',
              description: 'Use cached data (default: true)',
            },
          },
          required: [],
        },
      },
      {
        name: 'compare_formulas',
        description:
          'Compare 3-formula vs 9-formula approach. Analyzes whether to use 3 formulas (one per score type) or 9 formulas (one per score type × geography level). Returns validation metrics for each geography level, spread consistency analysis, and a recommendation with reasoning. Use this when the user asks whether they need different formulas for different geography levels.',
        input_schema: {
          type: 'object',
          properties: {
            geography_types: {
              type: 'array',
              items: { type: 'string' },
              description: 'Geography levels to analyze, e.g., ["metro", "county", "zip"]. Default: ["metro", "county", "zip"]',
            },
            score_types: {
              type: 'array',
              items: { type: 'string' },
              description: 'Score types to compare, e.g., ["investoredge", "homeready", "market_health"]. Default: all three',
            },
            horizon_months: {
              type: 'integer',
              description: 'Time horizon for comparison in months (default: 36)',
            },
          },
          required: [],
        },
      },
      // === Database Query Tools (Direct Access to Real Estate Data) ===
      {
        name: 'get_database_tables',
        description:
          'Get list of all accessible real estate data tables in the database. Returns table names, row counts, and column information. Use this to discover what data is available. Only returns real estate tables (Zillow, Realtor, Census, Economic, Scores) plus user\'s own saved queries, watchlist, alerts, and conversation history.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'describe_database_table',
        description:
          'Get detailed schema information about a specific table. Returns column names, data types, sample values, and statistics. Use this to understand the structure of a table before querying it. Works with any real estate data table.',
        input_schema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Name of the table to describe (e.g., "zillow_metro", "realtor_county", "propertyiq_scores")',
            },
          },
          required: ['table_name'],
        },
      },
      {
        name: 'query_database_table',
        description:
          'Query raw database tables (Zillow, Realtor, Census, Economic). SLOWER - 200-500ms. Use ONLY when user explicitly asks for "raw data", "database query", "table records", or specific non-score tables. AVOID for score-based queries - use get_rankings, analyze_data, compare_to_benchmark instead.',
        input_schema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Table to query',
            },
            columns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Columns to select (omit for all columns)',
            },
            filters: {
              type: 'object',
              description: 'Filters to apply. Simple: {"column": "value"}. Range: {"column": {"gte": 100, "lte": 200}}. List: {"column": ["val1", "val2"]}. Pattern: {"column": {"like": "%pattern%"}}',
            },
            order_by: {
              type: 'string',
              description: 'Column to sort by. Prefix with - for descending (e.g., "-period_date")',
            },
            limit: {
              type: 'integer',
              description: 'Max rows to return (default: 100, max: 1000)',
            },
            offset: {
              type: 'integer',
              description: 'Number of rows to skip for pagination (default: 0)',
            },
          },
          required: ['table_name'],
        },
      },
      {
        name: 'search_database',
        description:
          'Search across multiple tables for a text term. Searches in name, title, and description columns. Returns matching rows from each table. Example: Search for "Austin" to find all Austin-related data across geographies, scores, and market data.',
        input_schema: {
          type: 'object',
          properties: {
            search_term: {
              type: 'string',
              description: 'Text to search for',
            },
            tables: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tables to search (omit to search common tables: geographies, zillow_metro, realtor_metro, propertyiq_scores)',
            },
            columns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific columns to search in (omit to search name/title/description columns)',
            },
            limit_per_table: {
              type: 'integer',
              description: 'Max results per table (default: 10, max: 100)',
            },
          },
          required: ['search_term'],
        },
      },
      {
        name: 'aggregate_database',
        description:
          'Run aggregation queries (COUNT, SUM, AVG, MIN, MAX) on tables. Use for analytics like "average score by state", "total metros per state", "min/max prices". Supports grouping and filtering. Examples: Count metros by state, Average InvestorEdge score, Sum of population by region.',
        input_schema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Table to aggregate',
            },
            aggregations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  function: {
                    type: 'string',
                    enum: ['count', 'sum', 'avg', 'mean', 'min', 'max'],
                  },
                  column: {
                    type: 'string',
                  },
                  alias: {
                    type: 'string',
                  },
                },
              },
              description: 'List of aggregations like [{"function": "avg", "column": "investoredge_score", "alias": "avg_score"}]',
            },
            group_by: {
              type: 'array',
              items: { type: 'string' },
              description: 'Columns to group by (e.g., ["parent_geography_id"] to group by state)',
            },
            filters: {
              type: 'object',
              description: 'Filters to apply before aggregating',
            },
            limit: {
              type: 'integer',
              description: 'Max groups to return (default: 100, max: 1000)',
            },
          },
          required: ['table_name', 'aggregations'],
        },
      },
      {
        name: 'get_database_summary',
        description:
          'Get high-level summary of all real estate data in the database. Returns record counts for each data source (Zillow, Realtor, Census, Economic, Scores), latest data dates, and user analytics stats. Use this to understand what data is available and how current it is.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      // === News Analysis Tools ===
      {
        name: 'search_real_estate_news',
        description:
          'Search real estate news articles. Returns matching articles from the news cache. Can filter by search terms (e.g., "housing market", "mortgage rates"), geography (e.g., "Austin", "Texas"), and date range. Use this when the user asks about news, current events, or what\'s happening in the market. Examples: "What\'s the latest news about Austin?", "Any news about mortgage rates?", "What\'s happening in the housing market?"',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search term (e.g., "housing market", "mortgage rates", "recession")',
            },
            geography_name: {
              type: 'string',
              description: 'Specific geography to search for (e.g., "Austin", "Texas", "California")',
            },
            geography_type: {
              type: 'string',
              enum: ['metro', 'state', 'national'],
              description: 'Type of geography',
            },
            days_back: {
              type: 'integer',
              description: 'Number of days to search back (default: 30, max: 365)',
            },
            limit: {
              type: 'integer',
              description: 'Max articles to return (default: 20, max: 100)',
            },
          },
          required: [],
        },
      },
      {
        name: 'analyze_news_impact',
        description:
          'Analyze how a news article might impact a specific market. Takes a news article and geography, returns detailed analysis of relevance, impact direction (positive/negative/neutral), magnitude (high/medium/low), affected factors (prices, demand, supply), specific metrics that might be affected (ZHVI, listings, etc.), time horizon (immediate/short-term/long-term), and confidence level. Use this after searching news to determine if articles are relevant to user\'s markets and how they might be affected. Critical for understanding market impact of current events.',
        input_schema: {
          type: 'object',
          properties: {
            article_id: {
              type: 'string',
              description: 'Article ID from news search results',
            },
            article_title: {
              type: 'string',
              description: 'Article title (if not using ID)',
            },
            article_content: {
              type: 'string',
              description: 'Article content or summary',
            },
            article_url: {
              type: 'string',
              description: 'Article URL',
            },
            article_source: {
              type: 'string',
              description: 'Article source (e.g., "Wall Street Journal")',
            },
            article_date: {
              type: 'string',
              description: 'Published date (ISO format)',
            },
            geography_id: {
              type: 'string',
              description: 'Geography ID to analyze impact for (e.g., CBSA code)',
            },
            geography_name: {
              type: 'string',
              description: 'Geography name (e.g., "Austin, TX")',
            },
            geography_type: {
              type: 'string',
              enum: ['metro', 'county', 'zip', 'state', 'national'],
              description: 'Geography type (default: metro)',
            },
          },
          required: ['geography_id', 'geography_name'],
        },
      },
      // === Geographic Relationship Tools ===
      {
        name: 'find_neighboring_geographies',
        description:
          'Find neighboring or surrounding geographies. Returns geographies in the same state/region. Use when user asks about "surrounding counties", "neighboring metros", "counties around McLean County", etc. Methods: same_state (all in same state - most reliable), adjacent (bordering - requires adjacency data), nearby (within radius).',
        input_schema: {
          type: 'object',
          properties: {
            geography_id: {
              type: 'string',
              description: 'Geography ID (e.g., FIPS code for counties, CBSA code for metros)',
            },
            geography_type: {
              type: 'string',
              enum: ['county', 'metro', 'zip', 'state'],
              description: 'Type of geography (default: county)',
            },
            method: {
              type: 'string',
              enum: ['same_state', 'adjacent', 'nearby'],
              description: 'Method to find neighbors: same_state (all in state), adjacent (bordering), nearby (within radius). Default: same_state',
            },
          },
          required: ['geography_id'],
        },
      },
      {
        name: 'compare_to_neighbors',
        description:
          'Compare a geography to its neighboring geographies across all key metrics (InvestorEdge, HomeReady, MarketHealth scores). Returns detailed comparison showing how the target ranks vs neighbors, percentile rankings, and whether it performs better/worse than average. Includes overall assessment and human-readable summary. Use when user asks: "How does McLean County compare to surrounding counties?", "Is Austin better than neighboring metros?", "Compare this market to nearby markets".',
        input_schema: {
          type: 'object',
          properties: {
            geography_id: {
              type: 'string',
              description: 'Geography ID to analyze',
            },
            geography_name: {
              type: 'string',
              description: 'Geography name (e.g., "McLean County, IL", "Austin, TX")',
            },
            geography_type: {
              type: 'string',
              enum: ['county', 'metro', 'zip'],
              description: 'Type of geography (default: county)',
            },
            metrics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Metrics to compare (omit for default: investoredge_score, homeready_score, market_health_score)',
            },
          },
          required: ['geography_id', 'geography_name'],
        },
      },
      {
        name: 'find_similar_geographies',
        description:
          'Find geographies similar to the target based on scores and metrics. Uses Euclidean distance to calculate similarity across specified metrics. Returns ranked list of most similar markets (1.0 = identical, 0.0 = very different). Use when user asks: "What counties are similar to McLean County?", "Find metros like Austin", "Show me markets similar to this one".',
        input_schema: {
          type: 'object',
          properties: {
            geography_id: {
              type: 'string',
              description: 'Target geography ID',
            },
            geography_type: {
              type: 'string',
              enum: ['county', 'metro', 'zip'],
              description: 'Type of geography (default: county)',
            },
            limit: {
              type: 'integer',
              description: 'Max similar geographies to return (default: 10, max: 50)',
            },
            similarity_metrics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Metrics to use for similarity (omit for scores: investoredge_score, homeready_score, market_health_score)',
            },
          },
          required: ['geography_id'],
        },
      },
    ];
    this.logger.debug(`Cached ${this.toolDefinitionsCache.length} tool definitions`);
    return this.toolDefinitionsCache;
  }
}
