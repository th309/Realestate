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

  constructor(private readonly configService: ConfigService) {
    this.analyticsBaseUrl =
      this.configService.get<string>('ANALYTICS_SERVICE_URL') ||
      'http://localhost:8000';
    this.logger.log(`Analytics service URL: ${this.analyticsBaseUrl}`);
  }

  /**
   * Execute a tool call against the analytics service
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<ToolResult> {
    this.logger.log(`Executing tool: ${toolName}`);
    this.logger.debug(`Arguments: ${JSON.stringify(args)}`);

    try {
      const endpoint = this.getToolEndpoint(toolName);
      const method = toolName === 'get_available_filters' ? 'GET' : 'POST';

      const url = `${this.analyticsBaseUrl}${endpoint}`;
      this.logger.debug(`Calling ${method} ${url}`);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(args) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`API error: ${response.status} - ${errorText}`);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      this.logger.debug(`Tool ${toolName} succeeded`);
      return { success: true, data };
    } catch (error) {
      this.logger.error(`Tool execution failed: ${error.message}`);
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
    };

    const endpoint = endpoints[toolName];
    if (!endpoint) {
      this.logger.warn(`Unknown tool: ${toolName}, defaulting to analyze`);
      return '/api/v1/adhoc/analyze';
    }
    return endpoint;
  }

  /**
   * Get tool definitions for Claude
   */
  getToolDefinitions(): any[] {
    return [
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
        description:
          'Filter the analytics dataset by geography, state, score range, or date. Returns count of matching records. Use this to preview how many results match your criteria.',
        input_schema: {
          type: 'object',
          properties: {
            geography_type: {
              type: 'string',
              enum: ['state', 'metro', 'county', 'zip'],
              description: 'Type of geography to analyze (default: metro)',
            },
            states: {
              type: 'array',
              items: { type: 'string' },
              description:
                'State codes to include, e.g., ["TX", "CA"]. Use 2-letter uppercase codes.',
            },
            min_score: {
              type: 'number',
              description: 'Minimum score threshold (0-100)',
            },
            max_score: {
              type: 'number',
              description: 'Maximum score threshold (0-100)',
            },
            score_type: {
              type: 'string',
              enum: [
                'investoredge_score',
                'homeready_score',
                'market_health_score',
              ],
              description: 'Which score to filter/analyze (default: investoredge_score)',
            },
          },
          required: [],
        },
      },
      {
        name: 'analyze_data',
        description:
          'Run full statistical analysis on filtered data. Returns summary stats, correlations with actual appreciation outcomes, and top/bottom 10 performers.',
        input_schema: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              description: 'Filter criteria to apply before analysis',
              properties: {
                geography_type: {
                  type: 'string',
                  enum: ['state', 'metro', 'county', 'zip'],
                },
                states: {
                  type: 'array',
                  items: { type: 'string' },
                },
                min_score: { type: 'number' },
                max_score: { type: 'number' },
                score_type: { type: 'string' },
              },
            },
            horizons: {
              type: 'array',
              items: { type: 'integer' },
              description:
                'Time horizons in months to analyze, e.g., [12, 36] for 1-year and 3-year',
            },
          },
          required: ['filter'],
        },
      },
      {
        name: 'compare_to_benchmark',
        description:
          'Compare filtered markets to a benchmark (national average). Returns how the filtered group performs vs the benchmark for scores and appreciation.',
        input_schema: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              description: 'Filter criteria for the markets to compare',
              properties: {
                geography_type: { type: 'string' },
                states: { type: 'array', items: { type: 'string' } },
                score_type: { type: 'string' },
              },
            },
            benchmark_type: {
              type: 'string',
              enum: ['national', 'regional'],
              description: 'Benchmark to compare against (default: national)',
            },
          },
          required: ['filter', 'benchmark_type'],
        },
      },
      {
        name: 'get_rankings',
        description:
          'Get a ranked list of top or bottom performing markets based on score. Use ascending=true for bottom performers.',
        input_schema: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              description: 'Filter criteria',
              properties: {
                geography_type: { type: 'string' },
                states: { type: 'array', items: { type: 'string' } },
                score_type: { type: 'string' },
              },
            },
            limit: {
              type: 'integer',
              description: 'Number of results to return (default: 10, max: 100)',
            },
            ascending: {
              type: 'boolean',
              description: 'If true, returns bottom performers instead of top',
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
    ];
  }
}
