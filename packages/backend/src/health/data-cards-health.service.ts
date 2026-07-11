/**
 * Data Cards Health Service
 *
 * Monitors the health of all 54 data card metrics by checking:
 * - Data freshness (latest date vs threshold)
 * - Record counts
 * - Coverage (% of geographies with data)
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { METRIC_DEFINITIONS, getUniqueTables } from './metric-definitions';
import {
  getDateColumn,
  getExpectedRecords,
  formatDate,
  daysSinceDate,
} from './data-cards-health.metadata';

export interface MetricHealthCheck {
  metricId: string;
  metricName: string;
  category: string;
  tableName: string;
  status: 'ok' | 'stale' | 'empty' | 'error';
  latestDate: string | null;
  recordCount: number;
  coverage: number;
  source: string;
  isNew?: boolean;
  isPro?: boolean;
  message?: string;
}

export interface DataCardsHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: MetricHealthCheck[];
  summary: {
    total: number;
    healthy: number;
    stale: number;
    empty: number;
    errors: number;
  };
  checkedAt: string;
}

interface TableHealthInfo {
  latestDate: string | null; // Formatted for display (e.g., "Dec 2025")
  latestDateRaw: string | null; // Raw for calculations (e.g., "2025-12-15")
  recordCount: number; // estimated (planner) for large tables — see checkTableHealth
  coverage: number;
  hasRows: boolean; // real row presence from the limit-1 probe — authoritative for empty
}

@Injectable()
export class DataCardsHealthService {
  private readonly logger = new Logger(DataCardsHealthService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async checkAllMetrics(): Promise<DataCardsHealthResponse> {
    const checks: MetricHealthCheck[] = [];

    // Get unique tables to minimize database queries
    const tables = getUniqueTables();

    // Per-call cache (a local, not an instance field) so concurrent
    // data-summary requests never interleave writes into a shared Map.
    const tableHealthCache = new Map<string, TableHealthInfo>();

    // Check each table's health once — in parallel. Each probe is an
    // independent latest-date + estimated-count query, so running them
    // concurrently turns the cost from sum-of-probes into slowest-probe.
    await Promise.all(
      tables.map(async (tableName) => {
        try {
          const health = await this.checkTableHealth(tableName);
          tableHealthCache.set(tableName, health);
        } catch (error) {
          this.logger.error(`Error checking table ${tableName}:`, error);
          tableHealthCache.set(tableName, {
            latestDate: null,
            latestDateRaw: null,
            recordCount: 0,
            coverage: 0,
            hasRows: false,
          });
        }
      }),
    );

    // Check each metric using cached table health
    for (const metric of METRIC_DEFINITIONS) {
      const tableHealth = tableHealthCache.get(metric.tableName);
      const check = this.evaluateMetricHealth(metric, tableHealth);
      checks.push(check);
    }

    // Calculate summary
    const summary = {
      total: checks.length,
      healthy: checks.filter((c) => c.status === 'ok').length,
      stale: checks.filter((c) => c.status === 'stale').length,
      empty: checks.filter((c) => c.status === 'empty').length,
      errors: checks.filter((c) => c.status === 'error').length,
    };

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (summary.errors > 0 || summary.empty > 5) {
      status = 'unhealthy';
    } else if (summary.stale > 3 || summary.empty > 0) {
      status = 'degraded';
    }

    return {
      status,
      checks,
      summary,
      checkedAt: new Date().toISOString(),
    };
  }

  private async checkTableHealth(tableName: string): Promise<TableHealthInfo> {
    const client = this.supabase.getClient();

    const dateColumn = getDateColumn(tableName);

    try {
      // count:'estimated' not 'exact': an exact COUNT(*) full-scans the
      // multi-million-row tables this probes (propertyiq_scores ~14M, zillow_zip
      // ~10M) and blows statement_timeout (the data-summary timeout). Estimated
      // uses the planner reltuples for big tables (O(1)), exact for small ones.
      const { data, error, count } = await client
        .from(tableName)
        .select(dateColumn ? `${dateColumn}` : '*', { count: 'estimated' })
        .order(dateColumn || 'id', { ascending: false })
        .limit(1);

      if (error) {
        this.logger.warn(`Table ${tableName} query error: ${error.message}`);
        return {
          latestDate: null,
          latestDateRaw: null,
          recordCount: 0,
          coverage: 0,
          hasRows: false,
        };
      }

      // Row presence comes from the limit-1 probe itself (authoritative), so an
      // estimated count of 0 on a not-yet-analyzed large table can't false-empty.
      const hasRows = (data?.length ?? 0) > 0;
      const latestDateRaw =
        dateColumn && data?.[0] ? data[0][dateColumn] : null;
      const recordCount = count || 0;

      // Calculate coverage (simplified - just check record count vs expected)
      const expectedRecords = getExpectedRecords(tableName);
      const coverage =
        expectedRecords > 0
          ? Math.min(100, (recordCount / expectedRecords) * 100)
          : 100;

      return {
        latestDate: formatDate(latestDateRaw),
        latestDateRaw: latestDateRaw ? String(latestDateRaw) : null,
        recordCount,
        coverage,
        hasRows,
      };
    } catch (error) {
      this.logger.error(`Error checking table ${tableName}:`, error);
      return {
        latestDate: null,
        latestDateRaw: null,
        recordCount: 0,
        coverage: 0,
        hasRows: false,
      };
    }
  }

  private evaluateMetricHealth(
    metric: (typeof METRIC_DEFINITIONS)[0],
    tableHealth: TableHealthInfo | undefined,
  ): MetricHealthCheck {
    if (!tableHealth) {
      return {
        ...this.metricToCheck(metric),
        status: 'error',
        latestDate: null,
        recordCount: 0,
        coverage: 0,
        message: 'Table not accessible',
      };
    }

    const { latestDate, latestDateRaw, recordCount, coverage, hasRows } =
      tableHealth;

    // Empty check uses actual row presence (the limit-1 probe), NOT the
    // estimated recordCount — an estimate can read 0 for a freshly-loaded large
    // table before ANALYZE runs, which would falsely flag a populated metric as
    // empty.
    if (!hasRows) {
      return {
        ...this.metricToCheck(metric),
        status: 'empty',
        latestDate: null,
        recordCount: 0,
        coverage: 0,
        message: 'No data available',
      };
    }

    // Check for stale data using raw date for accurate comparison
    const daysSinceUpdate = daysSinceDate(latestDateRaw);
    if (
      daysSinceUpdate !== null &&
      daysSinceUpdate > metric.freshnessThresholdDays
    ) {
      return {
        ...this.metricToCheck(metric),
        status: 'stale',
        latestDate,
        recordCount,
        coverage,
        message: `Data is ${daysSinceUpdate} days old (threshold: ${metric.freshnessThresholdDays})`,
      };
    }

    return {
      ...this.metricToCheck(metric),
      status: 'ok',
      latestDate,
      recordCount,
      coverage,
    };
  }

  private metricToCheck(
    metric: (typeof METRIC_DEFINITIONS)[0],
  ): Omit<
    MetricHealthCheck,
    'status' | 'latestDate' | 'recordCount' | 'coverage' | 'message'
  > {
    return {
      metricId: metric.metricId,
      metricName: metric.metricName,
      category: metric.category,
      tableName: metric.tableName,
      source: metric.source,
      isNew: metric.isNew,
      isPro: metric.isPro,
    };
  }
}
