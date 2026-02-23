/** Analytics Chat Cache - cache warming and data digest for LLM prompt injection. */
import { Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { AnalyticsToolsService } from './analytics-tools.service';
import { ConfigService } from '@nestjs/config';

const logger = new Logger('AnalyticsChatCache');

type CacheQuery = { tool: string; params: Record<string, any> };

const ALL_SCORES = ['investoredge_score', 'homeready_score', 'market_health_score'];
const CORE_SCORES = ['investoredge_score', 'homeready_score'];
const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV',
  'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN',
  'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];
const POPULAR_STATES_15 = ['TX', 'CA', 'FL', 'AZ', 'NC', 'GA', 'TN', 'CO', 'WA', 'OH', 'IL', 'NY', 'VA', 'PA', 'OR'];
const POPULAR_STATES_10 = POPULAR_STATES_15.slice(0, 10);
const TOP_5_STATES = ['TX', 'CA', 'FL', 'AZ', 'NC'];

const SCORE_LABELS: Record<string, string> = {
  investoredge_score: 'INVESTOREDGE',
  homeready_score: 'HOMEREADY',
  market_health_score: 'MARKET_HEALTH',
};

/** Build ranking query shorthand. */
function rankingQuery(
  geoType: string, scoreType: string, limit: number,
  options: { ascending?: boolean; states?: string[] } = {},
): CacheQuery {
  return {
    tool: 'get_rankings',
    params: {
      filter: { geography_type: geoType, score_type: scoreType, ...(options.states && { states: options.states }) },
      limit,
      ascending: options.ascending ?? false,
    },
  };
}

/** Build a compact text digest from warm cache results (~5-8 KB). */
export async function buildDataDigest(redisService: RedisService): Promise<string> {
  if (!redisService.isAvailable()) return '';

  const lines: string[] = [
    'CURRENT DATA SNAPSHOT (answer directly from this when possible, no tool call needed):',
    `Data as of: ${new Date().toISOString().slice(0, 10)}`,
    '',
  ];

  const formatRankings = async (params: Record<string, any>, label: string): Promise<string | null> => {
    const cached = await redisService.get('get_rankings', params);
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

  const formatBenchmark = async (params: Record<string, any>): Promise<string | null> => {
    const cached = await redisService.get('compare_to_benchmark', params);
    const comp = cached?.success ? cached.data?.comparison : null;
    if (!comp) return null;
    const parts: string[] = [];
    if (comp.benchmark_avg_score != null) parts.push(`avg score ${comp.benchmark_avg_score.toFixed(1)}`);
    if (comp.benchmark_avg_appreciation_12m != null) parts.push(`avg 12m appr ${(comp.benchmark_avg_appreciation_12m * 100).toFixed(1)}%`);
    if (comp.avg_investoredge_score != null) parts.push(`avg investoredge ${comp.avg_investoredge_score.toFixed(1)}`);
    if (comp.avg_homeready_score != null) parts.push(`avg homeready ${comp.avg_homeready_score.toFixed(1)}`);
    if (comp.avg_market_health_score != null) parts.push(`avg market_health ${comp.avg_market_health_score.toFixed(1)}`);
    return parts.length > 0 ? `NATIONAL BENCHMARK: ${parts.join(', ')}` : null;
  };

  const pushIfPresent = async (params: Record<string, any>, label: string): Promise<void> => {
    const line = await formatRankings(params, label);
    if (line) lines.push(line);
  };

  // Top metros by each score type
  for (const st of ALL_SCORES) {
    await pushIfPresent(
      { filter: { geography_type: 'metro', score_type: st }, limit: 10, ascending: false },
      `TOP 10 METROS BY ${SCORE_LABELS[st]}`,
    );
  }
  // Bottom metros
  for (const st of CORE_SCORES) {
    await pushIfPresent(
      { filter: { geography_type: 'metro', score_type: st }, limit: 10, ascending: true },
      `BOTTOM 10 METROS BY ${SCORE_LABELS[st]}`,
    );
  }
  // State-level rankings
  lines.push('');
  for (const st of CORE_SCORES) {
    await pushIfPresent(
      { filter: { geography_type: 'state', score_type: st }, limit: 10, ascending: false },
      `TOP 10 STATES BY ${SCORE_LABELS[st]}`,
    );
  }
  await pushIfPresent(
    { filter: { geography_type: 'state', score_type: 'investoredge_score' }, limit: 10, ascending: true },
    'BOTTOM 10 STATES BY INVESTOREDGE',
  );
  // Top metros by state
  lines.push('');
  for (const state of POPULAR_STATES_10) {
    for (const st of CORE_SCORES) {
      await pushIfPresent(
        { filter: { geography_type: 'metro', score_type: st, states: [state] }, limit: 10, ascending: false },
        `TOP ${state} METROS (${SCORE_LABELS[st]})`,
      );
    }
  }
  // Top counties
  const counties = await formatRankings(
    { filter: { geography_type: 'county', score_type: 'investoredge_score' }, limit: 10, ascending: false },
    'TOP 10 COUNTIES BY INVESTOREDGE',
  );
  if (counties) { lines.push(''); lines.push(counties); }
  // National benchmarks
  lines.push('');
  for (const st of CORE_SCORES) {
    const benchmark = await formatBenchmark({
      filter: { geography_type: 'metro', score_type: st }, benchmark_type: 'national',
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

/** Build all cache warm-up queries. */
function buildWarmupQueries(): CacheQuery[] {
  const queries: CacheQuery[] = [];

  // Metro rankings at multiple limits
  for (const limit of [5, 10, 15, 20, 25, 30]) {
    for (const st of ALL_SCORES) queries.push(rankingQuery('metro', st, limit));
  }
  // Bottom metros
  for (const st of CORE_SCORES) queries.push(rankingQuery('metro', st, 10, { ascending: true }));
  // State-level rankings
  for (const st of ALL_SCORES) queries.push(rankingQuery('state', st, 10));
  // County rankings
  for (const limit of [10, 20]) {
    for (const st of CORE_SCORES) queries.push(rankingQuery('county', st, limit));
  }
  // All 50 states - metro rankings
  for (const state of ALL_STATES) {
    for (const st of CORE_SCORES) queries.push(rankingQuery('metro', st, 10, { states: [state] }));
  }
  // County rankings by top 15 states
  for (const state of POPULAR_STATES_15) {
    for (const st of CORE_SCORES) queries.push(rankingQuery('county', st, 10, { states: [state] }));
  }
  // ZIP-level rankings for top 5 states
  for (const state of TOP_5_STATES) {
    for (const st of CORE_SCORES) queries.push(rankingQuery('zip', st, 10, { states: [state] }));
  }
  // Benchmark comparisons
  for (const geoType of ['metro', 'state', 'county']) {
    for (const st of CORE_SCORES) {
      queries.push({ tool: 'compare_to_benchmark', params: { filter: { geography_type: geoType, score_type: st }, benchmark_type: 'national' } });
    }
  }
  // Analysis queries
  for (const geoType of ['metro', 'state']) {
    for (const st of CORE_SCORES) {
      queries.push({ tool: 'analyze_data', params: { filter: { geography_type: geoType, score_type: st }, horizons: [12] } });
    }
  }
  return queries;
}

/** Warm cache on startup with most common queries. Returns count of cached queries. */
export async function warmCache(
  redisService: RedisService, toolsService: AnalyticsToolsService, _configService: ConfigService,
): Promise<number> {
  logger.log(`[Quinn Cache] Starting cache warm-up...`);
  const startTime = Date.now();
  const queries = buildWarmupQueries();
  let cached = 0;

  logger.log(`[Quinn Cache] Preparing to warm ${queries.length} queries`);

  const batchSize = 5;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    await Promise.all(batch.map(async ({ tool, params }) => {
      try {
        if (redisService.isAvailable()) {
          const existing = await redisService.get(tool, params);
          if (existing) { cached++; return; }
        }
        const result = await toolsService.executeTool(tool, params);
        if (result.success) {
          cached++;
        } else {
          logger.warn(`[Quinn Cache] Failed to cache ${tool}: ${result.error}`);
        }
      } catch (error) {
        logger.error(`[Quinn Cache] Error warming ${tool}: ${error.message}`);
      }
    }));
    if (i + batchSize < queries.length) await new Promise((r) => setTimeout(r, 100));
  }

  const duration = Date.now() - startTime;
  logger.log(`[Quinn Cache] Warm-up complete: ${cached}/${queries.length} queries cached in ${(duration / 1000).toFixed(1)}s`);
  if (redisService.isAvailable()) {
    const stats = redisService.getStats();
    logger.log(`[Quinn Cache] Redis stats: ${stats.hits} hits, ${stats.misses} misses, ${stats.hitRate.toFixed(1)}% hit rate`);
  }
  return cached;
}
