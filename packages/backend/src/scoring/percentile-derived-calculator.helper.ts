/**
 * Derived Percentile Calculator (I/O)
 *
 * Calculates percentiles for calculated metrics (grm, cap_rate, gross_yield,
 * months_of_supply, ...) sourced from the calculated_metrics table.
 * Takes the SupabaseClient as an explicit parameter.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyType } from './scoring.types';
import { calculateMetricPercentilesFromRows } from './percentile-calculation.helper';
import { savePercentiles } from './percentile-persistence.helper';

export async function calculateDerivedPercentilesForDate(
  supabase: SupabaseClient,
  geographyType: GeographyType,
  periodDate: string,
): Promise<{ calculated: number; errors: number }> {
  console.log(
    `Calculating derived metric percentiles for ${geographyType} on ${periodDate}`,
  );

  // Fetch calculated_metrics data
  const { data: rows } = await supabase
    .from('calculated_metrics')
    .select('*')
    .eq('geography_type', geographyType)
    .eq('period_date', periodDate);

  if (!rows || rows.length === 0) {
    console.log(
      `No calculated_metrics found for ${geographyType} on ${periodDate}`,
    );
    return { calculated: 0, errors: 0 };
  }

  console.log(`Found ${rows.length} calculated_metrics rows`);

  let calculated = 0;
  let errors = 0;

  // Metrics to calculate from calculated_metrics table
  const derivedMetrics = [
    'grm',
    'cap_rate_proxy', // Will be saved as 'cap_rate'
    'annual_rent_price_ratio', // Will be saved as 'gross_yield'
    'months_of_supply',
    'zhvi_yoy_change',
    'zori_yoy_change',
  ];

  // Metric name mapping for derived metrics
  const derivedMetricMapping: Record<string, string> = {
    cap_rate_proxy: 'cap_rate',
    annual_rent_price_ratio: 'gross_yield',
    zhvi_yoy_change: 'zhvi_yoy',
    zori_yoy_change: 'zori_yoy',
  };

  for (const metric of derivedMetrics) {
    const stats = calculateMetricPercentilesFromRows(
      rows,
      metric,
      geographyType,
      periodDate,
    );
    if (stats) {
      // Map to internal metric name if needed
      stats.metricName = derivedMetricMapping[metric] || metric;
      try {
        await savePercentiles(supabase, stats);
        calculated++;
      } catch {
        errors++;
      }
    }
  }

  console.log(
    `Derived percentiles: calculated ${calculated}, errors ${errors}`,
  );
  return { calculated, errors };
}
