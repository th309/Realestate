/**
 * HealthSnapshotService
 *
 * Iterates through DATA_SOURCE_TABLE_MAP (the hardcoded source-of-truth for
 * data source table mappings), checks each source's most recent period_date,
 * computes availability and freshness, then returns rows for insertion into
 * admin_health_snapshots every 5 minutes.
 *
 * Previously this queried a `data_source_registry` Supabase table that was
 * never created, resulting in 0 rows being recorded. Fixed to use the
 * hardcoded DATA_SOURCE_TABLE_MAP which already contains all 9 sources.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  DATA_SOURCE_TABLE_MAP,
  DataSourceTableConfig,
} from './snapshot-recorder.constants';

export interface HealthSnapshotRow {
  source_name: string;
  available: boolean;
  fresh: boolean;
  /** 0 when unavailable (column is NOT NULL with default 0 in DB). */
  days_since_update: number;
  /** 0 when unavailable (column is NOT NULL with default 0 in DB). */
  response_time_ms: number;
  error_message: string | null;
}

@Injectable()
export class HealthSnapshotService {
  private readonly logger = new Logger(HealthSnapshotService.name);

  /**
   * Builds one health snapshot row per source in DATA_SOURCE_TABLE_MAP.
   * Callers are responsible for persisting the returned rows.
   */
  async buildHealthSnapshotRows(
    client: SupabaseClient,
  ): Promise<HealthSnapshotRow[]> {
    const sourceEntries = Object.entries(DATA_SOURCE_TABLE_MAP);

    if (!sourceEntries.length) {
      this.logger.warn(
        '[HealthSnapshot] DATA_SOURCE_TABLE_MAP is empty — no sources to check',
      );
      return [];
    }

    const rows: HealthSnapshotRow[] = [];

    for (const [sourceName, tableConfig] of sourceEntries) {
      rows.push(await this.buildRowForSource(client, sourceName, tableConfig));
    }

    return rows;
  }

  private async buildRowForSource(
    client: SupabaseClient,
    sourceName: string,
    tableConfig: DataSourceTableConfig,
  ): Promise<HealthSnapshotRow> {
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
          days_since_update: 0,
          response_time_ms: responseTimeMs,
          error_message: error.message,
        };
      }

      const latestDateValue = data?.[0]?.[tableConfig.dateColumn] ?? null;
      const daysSinceUpdate = calculateDaysSinceDate(latestDateValue) ?? 0;
      const fresh =
        daysSinceUpdate > 0 &&
        daysSinceUpdate <= tableConfig.expectedFreshnessDays;

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
        days_since_update: 0,
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
