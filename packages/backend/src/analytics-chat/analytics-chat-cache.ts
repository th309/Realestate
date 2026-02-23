/** Analytics Chat Cache - cache warming and data digest for LLM prompt injection. */
import { Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { AnalyticsToolsService } from './analytics-tools.service';
import { ConfigService } from '@nestjs/config';

const logger = new Logger('AnalyticsChatCache');

/** Build a compact text digest from warm cache results (~5-8 KB). */
export async function buildDataDigest(redisService: RedisService): Promise<string> {
  const lines: string[] = [];
  lines.push('CURRENT DATA SNAPSHOT (answer directly from this when possible, no tool call needed):');
  lines.push(`Data as of: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');

  // Helper: extract ranking lines from a cached tool result
  const formatRankings = async (toolName: string, params: Record<string, any>, label: string): Promise<string | null> => {
    if (!redisService.isAvailable()) return null;

    const cached = await redisService.get(toolName, params);
    if (!cached?.success) return null;

    const rankings = cached.data?.rankings;
    if (!Array.isArray(rankings) || rankings.length === 0) return null;

    const items = rankings.map((r: any) => {
      const name = (r.geography_name || r.name || r.geography_id || '').replace(/,/g, '');
      const score = r.score != null ? r.score.toFixed(1) : '';
      const appr = r.appreciation_12m != null ? ` (${(r.appreciation_12m * 100).toFixed(1)}%)` : '';
      return `${name} ${score}${appr}`;
    });

    return `${label}: ${items.join(', ')}`;
  };

  // Helper: extract benchmark data
  const formatBenchmark = async (params: Record<string, any>): Promise<string | null> => {
    if (!redisService.isAvailable()) return null;

    const cached = await redisService.get('compare_to_benchmark', params);
    if (!cached?.success) return null;

    const comp = cached.data?.comparison;
    if (!comp) return null;

    const parts: string[] = [];
    if (comp.benchmark_avg_score != null) parts.push(`avg score ${comp.benchmark_avg_score.toFixed(1)}`);
    if (comp.benchmark_avg_appreciation_12m != null) parts.push(`avg 12m appr ${(comp.benchmark_avg_appreciation_12m * 100).toFixed(1)}%`);
    if (comp.avg_investoredge_score != null) parts.push(`avg investoredge ${comp.avg_investoredge_score.toFixed(1)}`);
    if (comp.avg_homeready_score != null) parts.push(`avg homeready ${comp.avg_homeready_score.toFixed(1)}`);
    if (comp.avg_market_health_score != null) parts.push(`avg market_health ${comp.avg_market_health_score.toFixed(1)}`);

    return parts.length > 0 ? `NATIONAL BENCHMARK: ${parts.join(', ')}` : null;
  };

  const scoreLabels: Record<string, string> = {
    investoredge_score: 'INVESTOREDGE',
    homeready_score: 'HOMEREADY',
    market_health_score: 'MARKET_HEALTH',
  };

  // --- TOP METROS BY EACH SCORE TYPE (top 10 from cached top-20) ---
  for (const scoreType of ['investoredge_score', 'homeready_score', 'market_health_score'] as const) {
    const label = scoreLabels[scoreType];
    const top = await formatRankings('get_rankings', {
      filter: { geography_type: 'metro', score_type: scoreType }, limit: 10, ascending: false,
    }, `TOP 10 METROS BY ${label}`);
    if (top) lines.push(top);
  }

  // --- BOTTOM METROS ---
  for (const scoreType of ['investoredge_score', 'homeready_score'] as const) {
    const label = scoreLabels[scoreType];
    const bottom = await formatRankings('get_rankings', {
      filter: { geography_type: 'metro', score_type: scoreType }, limit: 10, ascending: true,
    }, `BOTTOM 10 METROS BY ${label}`);
    if (bottom) lines.push(bottom);
  }

  // --- STATE-LEVEL RANKINGS ---
  lines.push('');
  for (const scoreType of ['investoredge_score', 'homeready_score'] as const) {
    const label = scoreLabels[scoreType];
    const top = await formatRankings('get_rankings', {
      filter: { geography_type: 'state', score_type: scoreType }, limit: 10, ascending: false,
    }, `TOP 10 STATES BY ${label}`);
    if (top) lines.push(top);
  }
  const bottomStates = await formatRankings('get_rankings', {
    filter: { geography_type: 'state', score_type: 'investoredge_score' }, limit: 10, ascending: true,
  }, 'BOTTOM 10 STATES BY INVESTOREDGE');
  if (bottomStates) lines.push(bottomStates);

  // --- TOP METROS BY STATE (InvestorEdge + HomeReady) ---
  lines.push('');
  const popularStates = ['TX', 'CA', 'FL', 'AZ', 'NC', 'GA', 'TN', 'CO', 'WA', 'OH'];
  for (const state of popularStates) {
    const ie = await formatRankings('get_rankings', {
      filter: { geography_type: 'metro', score_type: 'investoredge_score', states: [state] }, limit: 10, ascending: false,
    }, `TOP ${state} METROS (INVESTOREDGE)`);
    if (ie) lines.push(ie);

    const hr = await formatRankings('get_rankings', {
      filter: { geography_type: 'metro', score_type: 'homeready_score', states: [state] }, limit: 10, ascending: false,
    }, `TOP ${state} METROS (HOMEREADY)`);
    if (hr) lines.push(hr);
  }

  // --- TOP COUNTIES ---
  const counties = await formatRankings('get_rankings', {
    filter: { geography_type: 'county', score_type: 'investoredge_score' }, limit: 10, ascending: false,
  }, 'TOP 10 COUNTIES BY INVESTOREDGE');
  if (counties) { lines.push(''); lines.push(counties); }

  // --- NATIONAL BENCHMARKS ---
  lines.push('');
  for (const scoreType of ['investoredge_score', 'homeready_score'] as const) {
    const benchmark = await formatBenchmark({
      filter: { geography_type: 'metro', score_type: scoreType }, benchmark_type: 'national',
    });
    if (benchmark) lines.push(benchmark);
  }

  if (lines.length > 3) {
    const digest = lines.join('\n');
    logger.log(`[Quinn Digest] Built data digest: ${digest.length} bytes, ${lines.length} lines`);
    return digest;
  }
  return '';
}

/** Warm cache on startup with most common queries. Returns count of cached queries. */
export async function warmCache(
  redisService: RedisService,
  toolsService: AnalyticsToolsService,
  configService: ConfigService,
): Promise<number> {
  logger.log(`[Quinn Cache] Starting cache warm-up...`);
  const startTime = Date.now();
  let cached = 0;

  // All 50 states
  const allStates = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

  const commonQueries: Array<{ tool: string; params: Record<string, any> }> = [];

  // === METRO RANKINGS - MULTIPLE LIMIT VALUES ===
  const limits = [5, 10, 15, 20, 25, 30];
  const scoreTypes = ['investoredge_score', 'homeready_score', 'market_health_score'];

  for (const limit of limits) {
    for (const scoreType of scoreTypes) {
      commonQueries.push({
        tool: 'get_rankings',
        params: { filter: { geography_type: 'metro', score_type: scoreType }, limit, ascending: false },
      });
    }
  }

  // Bottom metros (limit 10 only)
  for (const scoreType of ['investoredge_score', 'homeready_score']) {
    commonQueries.push({
      tool: 'get_rankings',
      params: { filter: { geography_type: 'metro', score_type: scoreType }, limit: 10, ascending: true },
    });
  }

  // === STATE-LEVEL RANKINGS ===
  for (const scoreType of scoreTypes) {
    commonQueries.push({
      tool: 'get_rankings',
      params: { filter: { geography_type: 'state', score_type: scoreType }, limit: 10, ascending: false },
    });
  }

  // === COUNTY LEVEL ===
  for (const limit of [10, 20]) {
    for (const scoreType of ['investoredge_score', 'homeready_score']) {
      commonQueries.push({
        tool: 'get_rankings',
        params: { filter: { geography_type: 'county', score_type: scoreType }, limit, ascending: false },
      });
    }
  }

  // === ALL 50 STATES - METRO RANKINGS ===
  for (const state of allStates) {
    for (const scoreType of ['investoredge_score', 'homeready_score']) {
      commonQueries.push({
        tool: 'get_rankings',
        params: { filter: { geography_type: 'metro', score_type: scoreType, states: [state] }, limit: 10, ascending: false },
      });
    }
  }

  // === COUNTY RANKINGS BY STATE (TOP 15 STATES) ===
  const popularStates = ['TX', 'CA', 'FL', 'AZ', 'NC', 'GA', 'TN', 'CO', 'WA', 'OH', 'IL', 'NY', 'VA', 'PA', 'OR'];
  for (const state of popularStates) {
    for (const scoreType of ['investoredge_score', 'homeready_score']) {
      commonQueries.push({
        tool: 'get_rankings',
        params: { filter: { geography_type: 'county', score_type: scoreType, states: [state] }, limit: 10, ascending: false },
      });
    }
  }

  // === ZIP-LEVEL RANKINGS FOR TOP 5 STATES ===
  for (const state of ['TX', 'CA', 'FL', 'AZ', 'NC']) {
    for (const scoreType of ['investoredge_score', 'homeready_score']) {
      commonQueries.push({
        tool: 'get_rankings',
        params: { filter: { geography_type: 'zip', score_type: scoreType, states: [state] }, limit: 10, ascending: false },
      });
    }
  }

  // === BENCHMARK COMPARISONS ===
  for (const geoType of ['metro', 'state', 'county']) {
    for (const scoreType of ['investoredge_score', 'homeready_score']) {
      commonQueries.push({
        tool: 'compare_to_benchmark',
        params: { filter: { geography_type: geoType, score_type: scoreType }, benchmark_type: 'national' },
      });
    }
  }

  // === ANALYSIS QUERIES ===
  for (const geoType of ['metro', 'state']) {
    for (const scoreType of ['investoredge_score', 'homeready_score']) {
      commonQueries.push({
        tool: 'analyze_data',
        params: { filter: { geography_type: geoType, score_type: scoreType }, horizons: [12] },
      });
    }
  }

  logger.log(`[Quinn Cache] Preparing to warm ${commonQueries.length} queries`);

  // Execute queries in parallel batches to avoid overwhelming the Python service
  const batchSize = 5;
  for (let i = 0; i < commonQueries.length; i += batchSize) {
    const batch = commonQueries.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async ({ tool, params }) => {
        try {
          // Skip if already cached (from previous run or background refresh)
          if (redisService.isAvailable()) {
            const existing = await redisService.get(tool, params);
            if (existing) {
              logger.debug(`[Quinn Cache] Skipping ${tool} - already cached`);
              cached++;
              return;
            }
          }

          logger.log(`[Quinn Cache] Warming ${tool} (${i + 1}/${commonQueries.length})`);

          const result = await toolsService.executeTool(tool, params);

          if (result.success) {
            cached++;
            logger.log(`[Quinn Cache] Cached ${tool} (${cached}/${commonQueries.length})`);
          } else {
            logger.warn(`[Quinn Cache] Failed to cache ${tool}: ${result.error}`);
          }
        } catch (error) {
          logger.error(`[Quinn Cache] Error warming ${tool}: ${error.message}`);
        }
      }),
    );

    // Small delay between batches to avoid overwhelming the service
    if (i + batchSize < commonQueries.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const duration = Date.now() - startTime;
  logger.log(`[Quinn Cache] Warm-up complete: ${cached}/${commonQueries.length} queries cached in ${(duration / 1000).toFixed(1)}s`);

  // Get cache stats from Redis
  if (redisService.isAvailable()) {
    const stats = redisService.getStats();
    logger.log(`[Quinn Cache] Redis stats: ${stats.hits} hits, ${stats.misses} misses, ${stats.hitRate.toFixed(1)}% hit rate`);
  }

  return cached;
}
