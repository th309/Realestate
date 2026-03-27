/**
 * MetricsQueryService
 *
 * Read-only query layer for all admin dashboard endpoints.
 * Hero stat aggregation is delegated to HeroStatsService.
 *
 * Public API:
 *   getHeroStats()       — 5 hero cards with sparklines (delegates to HeroStatsService)
 *   queryTimeSeries()    — time-series rows from any whitelisted admin table
 *   getAlerts()          — filtered alert rows
 *   acknowledgeAlert()   — mark alert acknowledged
 *   resolveAlert()       — mark alert resolved
 *   getCoverage()        — region coverage counts per geo level
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { HeroStats, AlertRow } from '../admin-metrics.types';
import { HeroStatsService } from './hero-stats.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tables that may be queried via queryTimeSeries(). */
const ALLOWED_TIMESERIES_TABLES = new Set([
  'admin_health_snapshots',
  'admin_api_metrics',
  'admin_cache_metrics',
  'admin_alerts',
  'admin_score_snapshots',
  'admin_user_snapshots',
  'admin_page_views',
]);

/** admin_alerts uses triggered_at; all other admin tables use timestamp. */
const TIMESTAMP_COLUMN: Record<string, string> = {
  admin_alerts: 'triggered_at',
};

const GEO_COVERAGE_TABLES: Record<string, string[]> = {
  metro: ['zillow_metro', 'realtor_metro', 'census_acs_metro'],
  county: ['zillow_county', 'census_acs_county'],
  zip: ['zillow_zip', 'census_acs_zip'],
  state: ['zillow_state', 'census_acs_state'],
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class MetricsQueryService {
  private readonly logger = new Logger(MetricsQueryService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly heroStats: HeroStatsService,
  ) {}

  // -------------------------------------------------------------------------
  // Hero Stats
  // -------------------------------------------------------------------------

  async getHeroStats(): Promise<HeroStats> {
    return this.heroStats.getHeroStats(this.supabase.getClient());
  }

  // -------------------------------------------------------------------------
  // Time Series
  // -------------------------------------------------------------------------

  async queryTimeSeries(
    table: string,
    from?: string,
    to?: string,
    filters?: Record<string, string>,
    limit = 1000,
  ): Promise<unknown[]> {
    if (!ALLOWED_TIMESERIES_TABLES.has(table)) {
      throw new BadRequestException(`Table "${table}" is not queryable`);
    }

    const tsCol = TIMESTAMP_COLUMN[table] ?? 'timestamp';
    let query = this.supabase.getClient().from(table).select('*');

    if (from) query = query.gte(tsCol, from);
    if (to) query = query.lte(tsCol, to);

    if (filters) {
      for (const [col, val] of Object.entries(filters)) {
        query = query.eq(col, val);
      }
    }

    query = query.order(tsCol, { ascending: false }).limit(limit);

    const { data, error } = await query;

    if (error) {
      this.logger.error(`[queryTimeSeries] ${table}: ${error.message}`);
      throw new Error(`Failed to query ${table}: ${error.message}`);
    }

    return data ?? [];
  }

  // -------------------------------------------------------------------------
  // Alerts
  // -------------------------------------------------------------------------

  async getAlerts(options?: {
    severity?: string;
    status?: 'active' | 'resolved';
    from?: string;
    to?: string;
  }): Promise<AlertRow[]> {
    let query = this.supabase
      .getClient()
      .from('admin_alerts')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(100);

    if (options?.severity) query = query.eq('severity', options.severity);

    if (options?.status === 'active') {
      query = query.is('resolved_at', null);
    } else if (options?.status === 'resolved') {
      query = query.not('resolved_at', 'is', null);
    }

    if (options?.from) query = query.gte('triggered_at', options.from);
    if (options?.to) query = query.lte('triggered_at', options.to);

    const { data, error } = await query;

    if (error) {
      this.logger.error(`[getAlerts] ${error.message}`);
      throw new Error(`Failed to query alerts: ${error.message}`);
    }

    return (data ?? []) as AlertRow[];
  }

  async acknowledgeAlert(id: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('admin_alerts')
      .update({ acknowledged: true })
      .eq('id', id);

    if (error) {
      this.logger.error(`[acknowledgeAlert] id=${id}: ${error.message}`);
      throw new Error(`Failed to acknowledge alert: ${error.message}`);
    }
  }

  async resolveAlert(id: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('admin_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      this.logger.error(`[resolveAlert] id=${id}: ${error.message}`);
      throw new Error(`Failed to resolve alert: ${error.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Coverage
  // -------------------------------------------------------------------------

  async getCoverage(): Promise<Record<string, Record<string, number>>> {
    const client = this.supabase.getClient();
    const result: Record<string, Record<string, number>> = {};

    await Promise.all(
      Object.entries(GEO_COVERAGE_TABLES).map(async ([geoLevel, tables]) => {
        result[geoLevel] = {};

        await Promise.all(
          tables.map(async (table) => {
            const { count, error } = await client
              .from(table)
              .select('region_id', { count: 'exact', head: true });

            if (error) {
              this.logger.warn(
                `[getCoverage] ${table}: ${error.message} — defaulting to 0`,
              );
              result[geoLevel][table] = 0;
            } else {
              result[geoLevel][table] = count ?? 0;
            }
          }),
        );
      }),
    );

    return result;
  }
}
