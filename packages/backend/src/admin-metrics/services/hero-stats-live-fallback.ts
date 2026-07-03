/**
 * Hero Stats Live Fallback Queries
 *
 * When admin_* snapshot tables are empty (cron hasn't populated them),
 * these functions query the real source tables to provide accurate data
 * for the hero stat cards. Each mirrors the logic of an existing
 * production service:
 *
 *   - freshness  → DataSourcesHealthService.checkAllSources
 *   - users      → UsersService.getStats
 *   - scores     → ValidationService.getValidationSummary
 *   - alerts     → DataAlertsService.getAlerts
 *   - uptime     → HealthController.healthCheck
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { HeroStats } from '../admin-metrics.types';
import { buildDailyCountSparkline } from './sparkline-utils';

// -------------------------------------------------------------------------
// Freshness source configs (mirrors DataSourcesHealthService.DATA_SOURCES)
// -------------------------------------------------------------------------

interface FreshnessSource {
  name: string;
  table: string;
  dateColumn: string;
  expectedFreshnessDays: number;
  excludeFilter?: { column: string; value: string };
}

const FRESHNESS_SOURCES: FreshnessSource[] = [
  {
    name: 'Zillow',
    table: 'zillow_zip',
    dateColumn: 'period_date',
    expectedFreshnessDays: 60,
    excludeFilter: { column: 'metric_name', value: 'zhvf' },
  },
  {
    name: 'Realtor',
    table: 'realtor_zip',
    dateColumn: 'period_date',
    expectedFreshnessDays: 60,
  },
  {
    name: 'Census ACS',
    table: 'census_county',
    dateColumn: 'year',
    expectedFreshnessDays: 900,
  },
  {
    name: 'BLS',
    table: 'economic_county',
    dateColumn: 'period_date',
    expectedFreshnessDays: 95,
  },
  {
    name: 'FRED',
    table: 'economic_national',
    dateColumn: 'period_date',
    expectedFreshnessDays: 60,
  },
  {
    name: 'HUD FMR',
    table: 'hud_fmr',
    dateColumn: 'year',
    expectedFreshnessDays: 438,
  },
  {
    name: 'Building Permits',
    table: 'permits_county',
    dateColumn: 'period_date',
    expectedFreshnessDays: 60,
  },
  {
    name: 'Redfin Sales',
    table: 'redfin_metro',
    dateColumn: 'period_end',
    expectedFreshnessDays: 60,
  },
  {
    name: 'Redfin Rental',
    table: 'redfin_rental_metro',
    dateColumn: 'period_date',
    expectedFreshnessDays: 60,
  },
];

// -------------------------------------------------------------------------
// Public fallback functions
// -------------------------------------------------------------------------

/** Check DB reachability as a proxy for system uptime. */
export async function fallbackUptimeStats(
  client: SupabaseClient,
): Promise<HeroStats['system_health']> {
  const { error } = await client.from('markets').select('id').limit(1);
  return { uptime_pct: error ? 0 : 100, sparkline: [] };
}

/** Query data_ingest_alerts for real alert counts. */
export async function fallbackAlertStats(
  client: SupabaseClient,
  since: Date,
): Promise<HeroStats['active_alerts']> {
  const { data: realAlerts } = await client
    .from('data_ingest_alerts')
    .select('created_at, severity, status')
    .gte('created_at', since.toISOString());

  if (!realAlerts || realAlerts.length === 0) {
    return { count: 0, critical: 0, warning: 0, sparkline: [] };
  }

  const active = realAlerts.filter(
    (r) => r.status === 'active' || r.status === 'open',
  );
  return {
    count: active.length,
    critical: active.filter((r) => r.severity === 'critical').length,
    warning: active.filter((r) => r.severity === 'warning').length,
    sparkline: buildDailyCountSparkline(
      realAlerts as Array<Record<string, unknown>>,
      'created_at',
      7,
    ),
  };
}

/** Check freshness by querying each real data source table. */
export async function fallbackFreshnessStats(
  client: SupabaseClient,
): Promise<HeroStats['data_freshness']> {
  const results = await Promise.allSettled(
    FRESHNESS_SOURCES.map((src) => checkSingleSourceFreshness(client, src)),
  );

  let freshCount = 0;
  let totalCount = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalCount++;
      if (result.value) freshCount++;
    }
  }

  return { fresh: freshCount, total: totalCount, sparkline: [] };
}

/** Count users directly from user_profiles. */
export async function fallbackUserStats(
  client: SupabaseClient,
): Promise<HeroStats['total_users']> {
  const { count: totalCount } = await client
    .from('user_profiles')
    .select('*', { count: 'exact', head: true });

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: newThisWeek } = await client
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo.toISOString());

  return {
    count: totalCount ?? 0,
    new_this_week: newThisWeek ?? 0,
    sparkline: [],
  };
}

/** Compute hit rate from propertyiq_backtest_outcomes. */
export async function fallbackScoreStats(
  client: SupabaseClient,
): Promise<HeroStats['score_health']> {
  const { data: outcomes } = await client
    .from('propertyiq_backtest_outcomes')
    .select('score_value, excess_vs_state_1y')
    .not('score_value', 'is', null)
    .not('excess_vs_state_1y', 'is', null);

  if (!outcomes || outcomes.length === 0) {
    return { hit_rate_1y: null, sparkline: [] };
  }

  const highScores = outcomes.filter((d) => d.score_value >= 70);
  // hit_rate_1y is a fraction (0..1) — matching admin_score_snapshots and the
  // hero card's `* 100` display. With no high-score outcomes there is nothing
  // to measure, so return null (no data) rather than a misleading 0.
  const hit_rate_1y =
    highScores.length > 0
      ? highScores.filter((d) => d.excess_vs_state_1y > 0).length /
        highScores.length
      : null;

  return { hit_rate_1y, sparkline: [] };
}

// -------------------------------------------------------------------------
// Private helpers
// -------------------------------------------------------------------------

async function checkSingleSourceFreshness(
  client: SupabaseClient,
  source: FreshnessSource,
): Promise<boolean> {
  let query = client.from(source.table).select(source.dateColumn);

  if (source.excludeFilter) {
    query = query.neq(source.excludeFilter.column, source.excludeFilter.value);
  }

  const { data, error } = await query
    .order(source.dateColumn, { ascending: false })
    .limit(1);

  if (error || !data?.[0]) return false;

  const latestRaw = data[0][source.dateColumn];
  const daysSince = calculateDaysSince(latestRaw);
  if (daysSince === null) return false;
  return daysSince <= source.expectedFreshnessDays * 1.25;
}

function calculateDaysSince(dateValue: string | number | null): number | null {
  if (!dateValue) return null;
  try {
    let date: Date;
    if (typeof dateValue === 'number') {
      date = new Date(dateValue, 11, 31);
    } else {
      const parts = dateValue.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      date = new Date(year, month, 0);
    }
    if (isNaN(date.getTime())) return null;
    const diffMs = Date.now() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}
