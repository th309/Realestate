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
  latestDate: string | null;
  recordCount: number;
  coverage: number;
}

@Injectable()
export class DataCardsHealthService {
  private readonly logger = new Logger(DataCardsHealthService.name);
  private tableHealthCache: Map<string, TableHealthInfo> = new Map();

  constructor(private readonly supabase: SupabaseService) {}

  async checkAllMetrics(): Promise<DataCardsHealthResponse> {
    const checks: MetricHealthCheck[] = [];

    // Get unique tables to minimize database queries
    const tables = getUniqueTables();

    // Check each table's health once
    for (const tableName of tables) {
      try {
        const health = await this.checkTableHealth(tableName);
        this.tableHealthCache.set(tableName, health);
      } catch (error) {
        this.logger.error(`Error checking table ${tableName}:`, error);
        this.tableHealthCache.set(tableName, {
          latestDate: null,
          recordCount: 0,
          coverage: 0,
        });
      }
    }

    // Check each metric using cached table health
    for (const metric of METRIC_DEFINITIONS) {
      const tableHealth = this.tableHealthCache.get(metric.tableName);
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

    // Handle different table structures
    const dateColumn = this.getDateColumn(tableName);
    const geoColumn = this.getGeoColumn(tableName);

    try {
      // Get latest date and count
      const { data, error, count } = await client
        .from(tableName)
        .select(dateColumn ? `${dateColumn}` : '*', { count: 'exact' })
        .order(dateColumn || 'id', { ascending: false })
        .limit(1);

      if (error) {
        this.logger.warn(`Table ${tableName} query error: ${error.message}`);
        return { latestDate: null, recordCount: 0, coverage: 0 };
      }

      const latestDate = dateColumn && data?.[0] ? data[0][dateColumn] : null;
      const recordCount = count || 0;

      // Calculate coverage (simplified - just check record count vs expected)
      const expectedRecords = this.getExpectedRecords(tableName);
      const coverage = expectedRecords > 0 ? Math.min(100, (recordCount / expectedRecords) * 100) : 100;

      return {
        latestDate: this.formatDate(latestDate),
        recordCount,
        coverage,
      };
    } catch (error) {
      this.logger.error(`Error checking table ${tableName}:`, error);
      return { latestDate: null, recordCount: 0, coverage: 0 };
    }
  }

  private evaluateMetricHealth(
    metric: typeof METRIC_DEFINITIONS[0],
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

    const { latestDate, recordCount, coverage } = tableHealth;

    // Check for empty data
    if (recordCount === 0) {
      return {
        ...this.metricToCheck(metric),
        status: 'empty',
        latestDate: null,
        recordCount: 0,
        coverage: 0,
        message: 'No data available',
      };
    }

    // Check for stale data
    const daysSinceUpdate = this.daysSinceDate(latestDate);
    if (daysSinceUpdate !== null && daysSinceUpdate > metric.freshnessThresholdDays) {
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

  private metricToCheck(metric: typeof METRIC_DEFINITIONS[0]): Omit<MetricHealthCheck, 'status' | 'latestDate' | 'recordCount' | 'coverage' | 'message'> {
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

  private getDateColumn(tableName: string): string | null {
    const dateColumns: Record<string, string> = {
      zillow_zip: 'period_date',
      zillow_county: 'period_date',
      zillow_metro: 'period_date',
      zillow_state: 'period_date',
      realtor_zip: 'period_date',
      realtor_county: 'period_date',
      realtor_metro: 'period_date',
      realtor_state: 'period_date',
      census_zip: 'year',
      census_county: 'year',
      economic_county: 'period_date',
      economic_metro: 'period_date',
      permits_county: 'period_date',
      permits_state: 'period_date',
      calculated_metrics: 'period_date',
      propertyiq_scores: 'created_at',
    };
    return dateColumns[tableName] || null;
  }

  private getGeoColumn(tableName: string): string {
    if (tableName.includes('zip')) return 'zip';
    if (tableName.includes('county')) return 'county_fips';
    if (tableName.includes('metro')) return 'cbsa';
    if (tableName.includes('state')) return 'state_fips';
    return 'id';
  }

  private getExpectedRecords(tableName: string): number {
    // Approximate expected record counts per geography type
    const expectedCounts: Record<string, number> = {
      zillow_zip: 33000,
      zillow_county: 3100,
      zillow_metro: 400,
      zillow_state: 51,
      realtor_zip: 30000,
      realtor_county: 3000,
      realtor_metro: 400,
      realtor_state: 51,
      census_zip: 33000,
      census_county: 3143,
      economic_county: 3143,
      economic_metro: 384,
      permits_county: 3143,
      calculated_metrics: 33000,
      propertyiq_scores: 30000,
    };
    return expectedCounts[tableName] || 1000;
  }

  private formatDate(date: string | number | null): string | null {
    if (!date) return null;
    if (typeof date === 'number') return String(date);
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return String(date);
    }
  }

  private daysSinceDate(dateStr: string | null): number | null {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  }
}
