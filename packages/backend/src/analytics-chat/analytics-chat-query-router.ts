/**
 * Analytics Chat Query Router
 *
 * Pure functions for classifying user query intent and selecting relevant tools.
 * No class, no `this` - dependencies are passed as arguments.
 */

import { Logger } from '@nestjs/common';
import { QueryIntent } from './analytics-chat.types';

const logger = new Logger('AnalyticsChatQueryRouter');

const FOLLOW_UP_PATTERN = /\b(?:out of those|of those|from that list|among those|which of those|which of these|of these)\b/i;
const PRICE_TREND_PATTERN = /\b(price|drop|appreciation|trend|year|growth|drastic)\b/i;

/** Classify the user message into a query intent category using regex patterns. */
export function getQueryIntent(message: string): QueryIntent {
  const lower = message.toLowerCase().trim();

  if (/^(hi|hello|hey|thanks|thank you|ok|okay|got it|cool|great)\b/i.test(lower)) return 'conversational';
  if (/^(help|what can you do|what do you do)\b/i.test(lower)) return 'conversational';
  if (/\b(how does|how do).*(scor|rating|algorithm|methodology|work)\b/.test(lower)) return 'conversational';
  if (/\bwhat('s| is) a good (score|rating)\b/.test(lower)) return 'conversational';

  if (FOLLOW_UP_PATTERN.test(lower) && PRICE_TREND_PATTERN.test(lower)) return 'comparison';

  if (/\b(compare|versus|vs|against|benchmark)\b/.test(lower)) return 'comparison';
  if (/\bhow does\b.*\b(compare|stack|rank)\b/.test(lower)) return 'comparison';
  if (/\b(difference|delta|gap)\b.*\bbetween\b/.test(lower)) return 'comparison';

  if ([
    /\b(hot|best|top|worst|bottom|highest|lowest|leading|trailing)\b.*\b(market|area|city|metro|state|county|zip|place|location)\b/,
    /\b(show|give|list|find).*\b(top|best|worst|bottom|hot|cold)\b/,
    /\b(rank|ranking|ranked|score|scored)\b/,
    /\bwhat are the\b.*\b(best|worst|top|bottom)\b/,
    /\bwhich\b.*(zip|metro|county|state|city|market).*(highest|lowest|best|worst|most|least)\b/,
    /\bwhich\b.*(highest|lowest|best|worst|most|least).*(zip|metro|county|state|city|market)\b/,
    /\b(highest|lowest|most|least).*(growth|appreciation|return|gain|loss)\b/,
  ].some((p) => p.test(lower))) return 'ranking';

  if ([
    /\b(in|within|around)\b.*\b(texas|california|florida|state|region)\b/,
    /\b(above|below|over|under|greater|less)\b.*\b(score|price|value)\b/,
    /\b(filter|where|with)\b/,
    /\b(affordable|expensive|cheap|pricey)\b.*\b(market|area)\b/,
  ].some((p) => p.test(lower))) return 'filtering';

  if ([
    /\b(raw|actual|database|table|records|query)\b/,
    /\b(show me|get|pull|fetch|retrieve|extract)\b.*\b(data|table|records|rows)\b/,
    /\b(zillow|realtor|census)\b.*\b(data|table)\b/,
  ].some((p) => p.test(lower))) return 'raw_data';
  if (/\b(price|rent|value|zhvi|zri|unemployment|population|income)\b/.test(lower) &&
    !/\b(compare|rank|best|top)\b/.test(lower)) return 'raw_data';

  if (/\b(predict|regression|cluster|correlat|feature.*importance|optim.*weight|backtest|validat)\b/.test(lower)) return 'ml_analysis';
  if (/\b(news|article|happening|recent.*event)\b/.test(lower)) return 'news';
  if (/\b(similar|neighbors?|nearby|like|around)\b/.test(lower)) return 'geography';

  return 'analysis';
}

/** Max allowed tool iterations by intent (prevents over-thinking simple queries). */
export function getMaxIterations(intent: QueryIntent): number {
  switch (intent) {
    case 'conversational': return 1;
    case 'ranking': return 2;
    case 'filtering': case 'raw_data': return 3;
    default: return 5;
  }
}

/** Tool name allowlists by intent. Excludes raw DB tools from cached-only intents. */
const TOOLS_BY_INTENT: Record<string, string[] | null> = {
  conversational: [],
  ranking: ['get_rankings'],
  filtering: ['filter_geographies', 'get_rankings', 'analyze_data'],
  comparison: ['compare_to_benchmark', 'analyze_data', 'get_rankings', 'filter_geographies', 'get_time_series'],
  raw_data: ['query_database_table', 'describe_database_table', 'aggregate_database', 'search_database'],
  ml_analysis: ['run_regression', 'get_feature_importance', 'cluster_markets', 'optimize_weights', 'analyze_raw_metrics', 'get_raw_metric_summary'],
  news: ['get_rankings', 'get_time_series', 'compare_to_benchmark'],
  geography: ['find_similar_geographies', 'compare_to_neighbors', 'find_neighboring_geographies'],
};

const DB_TOOLS_TO_EXCLUDE = new Set([
  'query_database_table', 'search_database', 'aggregate_database',
  'get_database_summary', 'get_database_tables', 'describe_database_table',
]);

const DEFAULT_TOOLS = ['get_rankings', 'filter_geographies', 'analyze_data', 'compare_to_benchmark'];

/** Filter tools strictly based on query intent. Fewer tools = faster LLM decisions. */
export function getRelevantTools(message: string, allTools: any[]): any[] {
  const intent = getQueryIntent(message);
  logger.log(`[Quinn Router] Intent: ${intent}`);

  if (intent === 'analysis') {
    return allTools.filter((t) => !DB_TOOLS_TO_EXCLUDE.has(t.name));
  }

  const allowList = TOOLS_BY_INTENT[intent];
  if (allowList) return allTools.filter((t) => allowList.includes(t.name));
  return allTools.filter((t) => DEFAULT_TOOLS.includes(t.name));
}
