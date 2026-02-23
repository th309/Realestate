/**
 * Analytics Chat Query Router
 *
 * Pure functions for classifying user query intent and selecting relevant tools.
 * No class, no `this` - dependencies are passed as arguments.
 */

import { Logger } from '@nestjs/common';
import { QueryIntent } from './analytics-chat.types';

const logger = new Logger('AnalyticsChatQueryRouter');

/** Classify the user message into a query intent category using regex patterns. */
export function getQueryIntent(message: string): QueryIntent {
  const lower = message.toLowerCase().trim();

  // CONVERSATIONAL - no tools needed, answer from digest/context/knowledge
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|got it|cool|great)\b/i.test(lower)) return 'conversational';
  if (/^(help|what can you do|what do you do)\b/i.test(lower)) return 'conversational';
  if (/\b(how does|how do).*(scor|rating|algorithm|methodology|work)\b/.test(lower)) return 'conversational';
  if (/\bwhat('s| is) a good (score|rating)\b/.test(lower)) return 'conversational';

  // FOLLOW-UP: "out of those / of those / from that list" + price/trend -> comparison so get_time_series is available
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

/** Max allowed tool iterations by intent (prevents over-thinking simple queries). */
export function getMaxIterations(intent: QueryIntent): number {
  switch (intent) {
    case 'conversational': return 1;
    case 'ranking': return 2;
    case 'filtering': return 3;
    case 'comparison': return 5;
    case 'raw_data': return 3;
    case 'analysis': case 'ml_analysis': case 'news': case 'geography': return 5;
    default: return 5;
  }
}

/**
 * Filter tools strictly based on query intent.
 * Fewer tools = faster Claude decisions.
 * @param message - The user message (used to determine intent)
 * @param allTools - All available tool definitions from the tools service
 */
export function getRelevantTools(message: string, allTools: any[]): any[] {
  const intent = getQueryIntent(message);

  logger.log(`[Quinn Intent] Detected: ${intent}`);

  switch (intent) {
    case 'conversational':
      logger.log(`[Quinn Tools] Conversational - NO tools (direct answer from digest/context)`);
      return [];

    case 'ranking':
      logger.log(`[Quinn Tools] Ranking - ONLY get_rankings (1 tool)`);
      return allTools.filter((t) => t.name === 'get_rankings');

    case 'filtering':
      logger.log(`[Quinn Tools] Filtering - filter_geographies + get_rankings + analyze_data`);
      return allTools.filter((t) =>
        ['filter_geographies', 'get_rankings', 'analyze_data'].includes(t.name),
      );

    case 'comparison':
      logger.log(`[Quinn Tools] Comparison - benchmark + ranking/filter + time_series`);
      return allTools.filter((t) =>
        ['compare_to_benchmark', 'analyze_data', 'get_rankings', 'filter_geographies', 'get_time_series'].includes(t.name),
      );

    case 'analysis':
      logger.log(`[Quinn Tools] Analysis - cached tools only (no raw DB)`);
      return allTools.filter((t) =>
        !['query_database_table', 'search_database', 'aggregate_database', 'get_database_summary', 'get_database_tables', 'describe_database_table'].includes(t.name),
      );

    case 'raw_data':
      logger.log(`[Quinn Tools] Raw data - database tools`);
      return allTools.filter((t) =>
        ['query_database_table', 'describe_database_table', 'aggregate_database', 'search_database'].includes(t.name),
      );

    case 'ml_analysis':
      logger.log(`[Quinn Tools] ML query - analysis tools`);
      return allTools.filter((t) =>
        ['run_regression', 'get_feature_importance', 'cluster_markets',
          'optimize_weights', 'analyze_raw_metrics', 'get_raw_metric_summary'].includes(t.name),
      );

    case 'news':
      logger.log(`[Quinn Tools] News - using ranking/trend tools (news tools disabled)`);
      return allTools.filter((t) =>
        ['get_rankings', 'get_time_series', 'compare_to_benchmark'].includes(t.name),
      );

    case 'geography':
      logger.log(`[Quinn Tools] Geography - location tools`);
      return allTools.filter((t) =>
        ['find_similar_geographies', 'compare_to_neighbors', 'find_neighboring_geographies'].includes(t.name),
      );

    default:
      logger.log(`[Quinn Tools] Default - core tools`);
      return allTools.filter((t) =>
        ['get_rankings', 'filter_geographies', 'analyze_data', 'compare_to_benchmark'].includes(t.name),
      );
  }
}
