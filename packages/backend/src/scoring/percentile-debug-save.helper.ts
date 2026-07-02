/**
 * Percentile Debug: Save (I/O)
 *
 * Debug utility to test saving a single percentile record, returning the exact
 * error message if the upsert fails. Takes the SupabaseClient as a parameter.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyType } from './scoring.types';

export async function debugTestSave(
  supabase: SupabaseClient,
  geographyType: GeographyType,
): Promise<Record<string, unknown>> {
  const testData = {
    metric_name: 'test_metric', // Column is metric_name per migration 030
    geography_type: geographyType,
    period_date: '2024-01-01',
    p10: 10,
    p20: 20,
    p30: 30,
    p40: 40,
    p50: 50,
    p60: 60,
    p70: 70,
    p80: 80,
    p90: 90,
    min_value: 0,
    max_value: 100,
    count_values: 100,
    mean_value: 50,
    stddev_value: 20,
    calculated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('metric_percentiles')
    .upsert(testData, {
      onConflict: 'metric_name,geography_type,period_date',
    })
    .select();

  if (error) {
    return {
      success: false,
      error: {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      },
      attemptedData: testData,
    };
  }

  // Clean up test data
  await supabase
    .from('metric_percentiles')
    .delete()
    .eq('metric_name', 'test_metric')
    .eq('geography_type', geographyType)
    .eq('period_date', '2024-01-01');

  return {
    success: true,
    message: 'Test save succeeded',
    data,
  };
}
