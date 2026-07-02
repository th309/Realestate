/**
 * Realtor Percentile Calculator (I/O)
 *
 * Calculates percentiles for all Realtor metrics for a given geography type and
 * date. Works with wide-format Realtor tables where metrics are columns.
 * Takes the SupabaseClient as an explicit parameter.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyType } from './scoring.types';
import {
  getMetricsForGeography,
  getTableForGeography,
} from './percentile.types';
import { calculateMetricPercentilesFromRows } from './percentile-calculation.helper';
import { savePercentiles } from './percentile-persistence.helper';

export async function calculateRealtorPercentilesForDate(
  supabase: SupabaseClient,
  geographyType: GeographyType,
  periodDate: string,
): Promise<{ calculated: number; errors: number; errorDetails?: string[] }> {
  const table = getTableForGeography(geographyType);
  console.log(
    `Calculating percentiles for ${geographyType} on ${periodDate} from table ${table}`,
  );

  // Fetch all rows for this date - wide format means each row has all metrics as columns
  const { data: rows, error: fetchError } = await supabase
    .from(table)
    .select('*')
    .eq('period_date', periodDate);

  if (fetchError) {
    console.error(
      `Error fetching data from ${table}:`,
      fetchError.message,
      fetchError.details,
    );
    return { calculated: 0, errors: 1 };
  }

  if (!rows || rows.length === 0) {
    console.log(`No data found in ${table} for date ${periodDate}`);
    return { calculated: 0, errors: 0 };
  }

  console.log(
    `Found ${rows.length} rows for ${geographyType} on ${periodDate}`,
  );

  // Debug: Log first row columns to understand data structure
  if (rows.length > 0) {
    const firstRow = rows[0];
    const sampleCols = Object.keys(firstRow).slice(0, 10);
    console.log(`Sample columns: ${sampleCols.join(', ')}`);
    // Log a specific metric value to check type
    const mlp = firstRow['median_listing_price'];
    console.log(`median_listing_price value: ${mlp}, type: ${typeof mlp}`);
  }

  let calculated = 0;
  let errors = 0;

  // Get metrics appropriate for this geography level
  const metricsToCalculate = getMetricsForGeography(geographyType);
  console.log(
    `Calculating percentiles for ${metricsToCalculate.length} metrics`,
  );

  // Calculate percentiles for each metric column
  const errorDetails: string[] = [];
  for (const metricName of metricsToCalculate) {
    try {
      const stats = calculateMetricPercentilesFromRows(
        rows,
        metricName,
        geographyType,
        periodDate,
      );
      if (stats) {
        await savePercentiles(supabase, stats);
        calculated++;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error calculating percentiles for ${metricName}:`, errMsg);
      errorDetails.push(`${metricName}: ${errMsg}`);
      errors++;
    }
  }

  // Log error details if any
  if (errorDetails.length > 0) {
    console.error(
      `Error details for ${geographyType}/${periodDate}:`,
      errorDetails.slice(0, 3),
    );
  }

  return {
    calculated,
    errors,
    errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
  };
}
