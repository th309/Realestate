/**
 * AlertThresholdRulesService
 *
 * Evaluates the four admin alert threshold rules by querying live metric
 * tables and delegating alert creation/resolution to AlertPersistenceService.
 *
 * Rules:
 *   1. data_source_stale       (warning)  — any source with fresh=false
 *   2. high_api_error_rate     (critical) — overall error rate > 5% last 5 min
 *   3. cache_low_hit_rate      (warning)  — latest hit_rate < 0.7
 *   4. data_source_unavailable (critical) — any source with available=false
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AlertPersistenceService } from './alert-persistence.service';

interface HealthSnapshotRow {
  source_name: string;
  fresh?: boolean;
  available?: boolean;
  timestamp: string;
}

interface NormalizedHealthRow {
  source_name: string;
  fresh: boolean;
  available: boolean;
  timestamp: string;
}

@Injectable()
export class AlertThresholdRulesService {
  private readonly logger = new Logger(AlertThresholdRulesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly alertPersistence: AlertPersistenceService,
  ) {}

  async evaluateDataSourceStaleness(): Promise<void> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('admin_health_snapshots')
      .select('source_name, fresh, available, timestamp')
      .order('source_name', { ascending: true })
      .order('timestamp', { ascending: false });

    if (error) {
      this.logger.error(
        `[ThresholdRules] data_source_stale query failed: ${error.message}`,
      );
      return;
    }

    const latestPerSource = pickLatestPerSource(data ?? []);
    const staleSources = latestPerSource
      .filter((row) => !row.fresh)
      .map((row) => row.source_name);

    if (staleSources.length > 0) {
      await this.alertPersistence.ensureAlertExists(
        'data_source_stale',
        'warning',
        'admin-metrics',
        `Data sources with stale data: ${staleSources.join(', ')}`,
        { stale_sources: staleSources },
      );
    } else {
      await this.alertPersistence.autoResolveAlert('data_source_stale');
    }
  }

  async evaluateHighApiErrorRate(): Promise<void> {
    const client = this.supabase.getClient();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await client
      .from('admin_api_metrics')
      .select('request_count, error_count')
      .gte('timestamp', fiveMinutesAgo);

    if (error) {
      this.logger.error(
        `[ThresholdRules] high_api_error_rate query failed: ${error.message}`,
      );
      return;
    }

    const rows = data ?? [];
    const totalRequests = rows.reduce(
      (sum, r) => sum + (r.request_count ?? 0),
      0,
    );
    const totalErrors = rows.reduce((sum, r) => sum + (r.error_count ?? 0), 0);

    if (totalRequests === 0) {
      // No traffic in the window — can't evaluate, leave alert state unchanged.
      return;
    }

    const overallErrorRate = totalErrors / totalRequests;

    if (overallErrorRate > 0.05) {
      const errorRatePct = (overallErrorRate * 100).toFixed(1);
      await this.alertPersistence.ensureAlertExists(
        'high_api_error_rate',
        'critical',
        'admin-metrics',
        `API error rate is ${errorRatePct}% (threshold: 5%)`,
        {
          error_rate: overallErrorRate,
          total_requests: totalRequests,
          total_errors: totalErrors,
          window_minutes: 5,
        },
      );
    } else {
      await this.alertPersistence.autoResolveAlert('high_api_error_rate');
    }
  }

  async evaluateCacheLowHitRate(): Promise<void> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('admin_cache_metrics')
      .select('hit_rate, timestamp')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error) {
      this.logger.error(
        `[ThresholdRules] cache_low_hit_rate query failed: ${error.message}`,
      );
      return;
    }

    const latestRow = data?.[0];
    if (!latestRow) return;

    const hitRate: number = latestRow.hit_rate ?? 1;

    if (hitRate < 0.7) {
      const hitRatePct = (hitRate * 100).toFixed(1);
      await this.alertPersistence.ensureAlertExists(
        'cache_low_hit_rate',
        'warning',
        'admin-metrics',
        `Cache hit rate is ${hitRatePct}% (threshold: 70%)`,
        { hit_rate: hitRate, threshold: 0.7 },
      );
    } else {
      await this.alertPersistence.autoResolveAlert('cache_low_hit_rate');
    }
  }

  async evaluateDataSourceUnavailability(): Promise<void> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('admin_health_snapshots')
      .select('source_name, available, timestamp')
      .order('source_name', { ascending: true })
      .order('timestamp', { ascending: false });

    if (error) {
      this.logger.error(
        `[ThresholdRules] data_source_unavailable query failed: ${error.message}`,
      );
      return;
    }

    const latestPerSource = pickLatestPerSource(data ?? []);
    const unavailableSources = latestPerSource
      .filter((row) => !row.available)
      .map((row) => row.source_name);

    if (unavailableSources.length > 0) {
      await this.alertPersistence.ensureAlertExists(
        'data_source_unavailable',
        'critical',
        'admin-metrics',
        `Unavailable data sources: ${unavailableSources.join(', ')}`,
        { unavailable_sources: unavailableSources },
      );
    } else {
      await this.alertPersistence.autoResolveAlert('data_source_unavailable');
    }
  }
}

/**
 * Deduplicates snapshot rows by source_name, keeping only the most recent row
 * per source. Assumes input is ordered by source_name ASC, timestamp DESC so
 * the first occurrence per source is always the latest.
 */
function pickLatestPerSource(rows: HealthSnapshotRow[]): NormalizedHealthRow[] {
  const seen = new Set<string>();
  const result: NormalizedHealthRow[] = [];

  for (const row of rows) {
    if (!seen.has(row.source_name)) {
      seen.add(row.source_name);
      result.push({
        source_name: row.source_name,
        fresh: row.fresh ?? true,
        available: row.available ?? true,
        timestamp: row.timestamp,
      });
    }
  }

  return result;
}
