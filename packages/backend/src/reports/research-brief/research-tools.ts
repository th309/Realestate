/**
 * Research Brief Tool Definitions
 *
 * Defines the Anthropic tool-use schema for the research agent.
 * Each tool maps to a backend data-fetching operation that the
 * Claude research agent can invoke during the tool-use loop.
 */

import Anthropic from '@anthropic-ai/sdk';

// Re-export the tool type for consumers
export type ResearchTool = Anthropic.Messages.Tool;

/**
 * Tool: get_market_snapshot
 * Fetches PropertyIQ scores + key metrics for a single region.
 */
const GET_MARKET_SNAPSHOT: ResearchTool = {
  name: 'get_market_snapshot',
  description:
    'Get PropertyIQ scores (HomeReady, InvestorEdge, MarketHealth) and key metrics for a specific region. Use this to understand the current state of a market.',
  input_schema: {
    type: 'object' as const,
    properties: {
      region_id: {
        type: 'string',
        description:
          'The region identifier (CBSA code for metro, FIPS for county, ZIP code for zip)',
      },
      geography_level: {
        type: 'string',
        enum: ['metro', 'county', 'zip'],
        description: 'The geography level of the region',
      },
      metrics: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional list of specific metric IDs to fetch (e.g., home_value, rent_index, unemployment_rate). If omitted, fetches core metrics.',
      },
    },
    required: ['region_id', 'geography_level'],
  },
};

/**
 * Tool: compare_markets
 * Fetches scores for multiple regions side-by-side.
 */
const COMPARE_MARKETS: ResearchTool = {
  name: 'compare_markets',
  description:
    'Compare PropertyIQ scores across 2-5 regions. Returns scores and key metrics for each region side-by-side.',
  input_schema: {
    type: 'object' as const,
    properties: {
      regions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            region_id: { type: 'string' },
            geography_level: {
              type: 'string',
              enum: ['metro', 'county', 'zip'],
            },
          },
          required: ['region_id', 'geography_level'],
        },
        description: 'Array of regions to compare (2-5 regions)',
        minItems: 2,
        maxItems: 5,
      },
    },
    required: ['regions'],
  },
};

/**
 * Tool: get_timeseries
 * Fetches historical time series for a specific metric/region.
 */
const GET_TIMESERIES: ResearchTool = {
  name: 'get_timeseries',
  description:
    'Get historical time series data for a specific metric in a specific region. Use this to analyze trends over time.',
  input_schema: {
    type: 'object' as const,
    properties: {
      metric_id: {
        type: 'string',
        description:
          'The metric identifier (e.g., home_value, rent_index, days_on_market)',
      },
      region_id: {
        type: 'string',
        description: 'The region identifier',
      },
      geography_level: {
        type: 'string',
        enum: ['metro', 'county', 'zip'],
        description: 'The geography level',
      },
      last_points: {
        type: 'number',
        description:
          'Number of most recent data points to return (default: 24 for ~2 years)',
      },
    },
    required: ['metric_id', 'region_id', 'geography_level'],
  },
};

/**
 * Tool: get_rankings
 * Gets top/bottom markets by a specific score type.
 */
const GET_RANKINGS: ResearchTool = {
  name: 'get_rankings',
  description:
    'Get top or bottom ranked markets by PropertyIQ score type. Use this to find the best/worst markets for a given strategy.',
  input_schema: {
    type: 'object' as const,
    properties: {
      score_type: {
        type: 'string',
        enum: ['homeready', 'investoredge', 'markethealth'],
        description: 'Which score to rank by',
      },
      geography_level: {
        type: 'string',
        enum: ['metro', 'county', 'zip'],
        description: 'Geography level to rank',
      },
      limit: {
        type: 'number',
        description: 'Number of results (default: 10, max: 25)',
      },
      state: {
        type: 'string',
        description:
          'Optional: filter to a specific state (2-letter code, e.g., "TX")',
      },
    },
    required: ['score_type', 'geography_level'],
  },
};

/**
 * Tool: search_news
 * Searches for recent real estate news for a region.
 * Delegates to ClaudeNewsService if available, otherwise returns a stub.
 */
const SEARCH_NEWS: ResearchTool = {
  name: 'search_news',
  description:
    'Search for recent real estate news and market developments for a specific region. Returns headlines, summaries, and market signals.',
  input_schema: {
    type: 'object' as const,
    properties: {
      region_name: {
        type: 'string',
        description:
          'Human-readable region name (e.g., "Dallas-Fort Worth, TX")',
      },
      geography_level: {
        type: 'string',
        enum: ['metro', 'county', 'zip'],
        description: 'The geography level',
      },
      state: {
        type: 'string',
        description: 'State name or abbreviation',
      },
    },
    required: ['region_name', 'geography_level'],
  },
};

/**
 * Tool: rank_by_metric
 * Ranks all markets at a geography level by any metric in the database.
 * Uses MetricResolutionService (all sources via fallback registry).
 */
const RANK_BY_METRIC: ResearchTool = {
  name: 'rank_by_metric',
  description:
    'Rank ALL markets at a geography level by any metric (not just scores). Returns top/bottom markets sorted by the metric value. Use this to find markets with highest appreciation, lowest inventory, best rental yield, etc. Pulls from ALL data sources (Zillow, Realtor, Redfin, Census, etc.) via the fallback registry.',
  input_schema: {
    type: 'object' as const,
    properties: {
      metric_id: {
        type: 'string',
        description:
          'The metric to rank by. Common metrics: home_value, home_value_yoy, rent_index, days_on_market, for_sale_inventory, inventory_yoy, price_cut_pct, listing_price, home_price_forecast, home_sales, sale_to_list, market_heat, hotness_score, new_listings, pending_ratio, cap_rate, gross_yield, rent_to_price_ratio, population_growth, unemployment_rate, job_growth, median_income, sf_permits, mf_permits, permits_yoy, years_to_save, income_to_rent, overvalued_pct',
      },
      geography_level: {
        type: 'string',
        enum: ['metro', 'county', 'zip'],
        description: 'Geography level to rank',
      },
      order: {
        type: 'string',
        enum: ['desc', 'asc'],
        description:
          'Sort order: "desc" for highest first (default), "asc" for lowest first',
      },
      limit: {
        type: 'number',
        description: 'Number of results to return (default: 10, max: 25)',
      },
    },
    required: ['metric_id', 'geography_level'],
  },
};

/**
 * All research tools available to the Claude research agent.
 */
export const RESEARCH_TOOLS: ResearchTool[] = [
  GET_MARKET_SNAPSHOT,
  COMPARE_MARKETS,
  GET_TIMESERIES,
  GET_RANKINGS,
  RANK_BY_METRIC,
  SEARCH_NEWS,
];
