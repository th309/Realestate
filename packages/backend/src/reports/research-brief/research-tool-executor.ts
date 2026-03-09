/**
 * Research Tool Executor
 *
 * Dispatches tool calls to the appropriate handler.
 * Called by ResearchBriefService during the Claude tool-use loop.
 * Handlers are in research-tool-handlers.ts.
 */

import { Logger } from '@nestjs/common';
import { ScoringService } from '../../scoring/scoring.service';
import { MetricResolutionService } from '../../metric-resolution/metric-resolution.service';
import { TimeSeriesService } from '../../timeseries/timeseries.service';
import { NewsScoutService } from '../news-scout.service';
import {
  handleGetMarketSnapshot,
  handleCompareMarkets,
  handleGetTimeseries,
  handleGetRankings,
  handleRankByMetric,
  handleSearchNews,
} from './research-tool-handlers';

const logger = new Logger('ResearchToolExecutor');

/**
 * Execute a tool call by name and return the JSON result string.
 */
export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  scoring: ScoringService,
  metricResolution: MetricResolutionService,
  timeSeries: TimeSeriesService,
  newsService: NewsScoutService | null,
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_market_snapshot':
        return await handleGetMarketSnapshot(
          toolInput,
          scoring,
          metricResolution,
        );
      case 'compare_markets':
        return await handleCompareMarkets(toolInput, scoring, metricResolution);
      case 'get_timeseries':
        return await handleGetTimeseries(toolInput, timeSeries);
      case 'get_rankings':
        return await handleGetRankings(toolInput, scoring);
      case 'rank_by_metric':
        return await handleRankByMetric(toolInput, metricResolution);
      case 'search_news':
        return await handleSearchNews(toolInput, newsService);
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error: any) {
    logger.error(`Tool execution failed for ${toolName}: ${error.message}`);
    return JSON.stringify({
      error: `Tool ${toolName} failed: ${error.message}`,
    });
  }
}
