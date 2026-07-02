/**
 * Percentile Debug: Inspect (I/O)
 *
 * Debug utility to inspect the raw data structure for a geography type,
 * reporting per-metric presence and non-null value counts. Takes the
 * SupabaseClient as a parameter.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyType } from './scoring.types';
import {
  getMetricsForGeography,
  getTableForGeography,
} from './percentile.types';

export async function debugInspectData(
  supabase: SupabaseClient,
  geographyType: GeographyType,
): Promise<Record<string, unknown>> {
  const table = getTableForGeography(geographyType);
  const metricsToCalculate = getMetricsForGeography(geographyType);

  // Get latest date
  const { data: latestData } = await supabase
    .from(table)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1);

  const latestDate = latestData?.[0]?.period_date;
  if (!latestDate) {
    return { error: 'No data found', table };
  }

  // Fetch rows for this date
  const { data: rows, error } = await supabase
    .from(table)
    .select('*')
    .eq('period_date', latestDate)
    .limit(5);

  if (error) {
    return { error: error.message, table, latestDate };
  }

  if (!rows || rows.length === 0) {
    return { error: 'No rows found', table, latestDate };
  }

  // Inspect first row
  const firstRow = rows[0];
  const allColumns = Object.keys(firstRow);

  // Check each metric we're trying to calculate
  const metricInspection: Record<string, unknown> = {};
  for (const metric of metricsToCalculate) {
    const val = firstRow[metric];
    metricInspection[metric] = {
      exists: metric in firstRow,
      value: val,
      type: typeof val,
      isNull: val === null,
    };
  }

  // Count non-null values across all rows for each metric
  const valueCounts: Record<string, number> = {};
  for (const metric of metricsToCalculate) {
    let count = 0;
    for (const row of rows) {
      const val = row[metric];
      if (val !== null && val !== undefined) {
        const numVal = typeof val === 'number' ? val : parseFloat(String(val));
        if (!isNaN(numVal) && isFinite(numVal)) {
          count++;
        }
      }
    }
    valueCounts[metric] = count;
  }

  return {
    table,
    latestDate,
    rowCount: rows.length,
    totalColumns: allColumns.length,
    sampleColumns: allColumns.slice(0, 20),
    metricsToCalculate,
    metricInspection,
    valueCounts,
  };
}
