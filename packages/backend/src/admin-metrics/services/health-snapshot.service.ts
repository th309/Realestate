/**
 * HealthSnapshotService
 *
 * Queries each registered data source for its most recent period_date,
 * computes availability and freshness, then inserts a row into
 * admin_health_snapshots every 5 minutes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { DATA_SOURCE_TABLE_MAP } from './snapshot-recorder.constants';

export interface HealthSnapshotRow {
  source_name: string;
  available: boolean;
  fresh: boolean;
  days_since_update: number | null;
  response_time_ms: number | null;
  error_message: string | null;
}

@Injectable()
export class HealthSnapshotService {
  private readonly logger = new Logger(HealthSnapshotService.name);

  /**
   * Builds one health snapshot row per registered source.
   * Callers are responsible for persisting the returned rows.
   */
  async buildHealthSnapshotRows(
    client: SupabaseClient,
  ): Promise<HealthSnapshotRow[]> {
    const { data: sources, error: sourcesError } = await client
      .from('data_source_registry')
      .select('source_name, expected_freshness_days');

    if (sourcesError) {
      this.logger.error(
        `[HealthSnapshot] Failed to fetch data_source_registry: ${sourcesError.message}`,
      );
      return [];
    }

    if (!sources?.length) {
      this.logger.warn(
        '[HealthSnapshot] No sources found in data_source_registry',
      );
      return [];
    }

    const rows: HealthSnapshotRow[] = [];

    for (const source of sources) {
      rows.push(await this.buildRowForSource(client, source));
    }

    return rows;
  }

  private async buildRowForSource(
    client: SupabaseClient,
    source: { source_name: string; expected_freshness_days: number | null },
  ): Promise<HealthSnapshotRow> {
    const sourceName = source.source_name;
    const tableConfig = DATA_SOURCE_TABLE_MAP[sourceName];

    if (!tableConfig) {
      this.logger.warn(
        `[HealthSnapshot] No table mapping for source: ${sourceName}`,
      );
      return {
        source_name: sourceName,
        available: false,
        fresh: false,
        days_since_update: null,
        response_time_ms: null,
        error_message: `No table mapping configured for source "${sourceName}"`,
      };
    }

    const expectedFreshnessDays =
      source.expected_freshness_days ?? tableConfig.expectedFreshnessDays;

    const startTime = Date.now();

    try {
      const { data, error } = await client
        .from(tableConfig.table)
        .select(tableConfig.dateColumn)
        .order(tableConfig.dateColumn, { ascending: false })
        .limit(1);

      const responseTimeMs = Date.now() - startTime;

      if (error) {
        return {
          source_name: sourceName,
          available: false,
          fresh: false,
          days_since_update: null,
          response_time_ms: responseTimeMs,
          error_message: error.message,
        };
      }

      const latestDateValue = data?.[0]?.[tableConfig.dateColumn] ?? null;
      const daysSinceUpdate = calculateDaysSinceDate(latestDateValue);
      const fresh =
        daysSinceUpdate !== null && daysSinceUpdate <= expectedFreshnessDays;

      return {
        source_name: sourceName,
        available: true,
        fresh,
        days_since_update: daysSinceUpdate,
        response_time_ms: responseTimeMs,
        error_message: null,
      };
    } catch (err) {
      return {
        source_name: sourceName,
        available: false,
        fresh: false,
        days_since_update: null,
        response_time_ms: Date.now() - startTime,
        error_message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}

/**
 * Calculates the number of calendar days between today and a period date.
 *
 * Handles two date formats used across data sources:
 *  - ISO string "YYYY-MM-DD": treated as the last day of that month.
 *  - Year integer (e.g. 2023): treated as Dec 31 of that year.
 *
 * Returns null when the value is absent or unparseable.
 */
export function calculateDaysSinceDate(
  dateValue: string | number | null | undefined,
): number | null {
  if (dateValue === null || dateValue === undefined) return null;

  try {
    let date: Date;

    if (typeof dateValue === 'number') {
      date = new Date(dateValue, 11, 31); // Dec 31 of the given year
    } else {
      const parts = dateValue.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10); // 1-based
      date = new Date(year, month, 0); // Day 0 of next month == last day of current month
    }

    if (isNaN(date.getTime())) return null;

    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}
