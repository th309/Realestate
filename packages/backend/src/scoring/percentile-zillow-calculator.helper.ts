/**
 * Zillow Percentile Calculator (I/O)
 *
 * Calculates percentiles for Zillow metrics (zhvi, zhvi_yoy, zori, zori_yoy).
 * Takes the SupabaseClient as an explicit parameter.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyType } from './scoring.types';
import {
  getZillowIdColumn,
  getZillowTableForGeography,
} from './percentile.types';
import { calculateMetricPercentilesFromRows } from './percentile-calculation.helper';
import { savePercentiles } from './percentile-persistence.helper';

export async function calculateZillowPercentilesForDate(
  supabase: SupabaseClient,
  geographyType: GeographyType,
  periodDate: string,
): Promise<{ calculated: number; errors: number }> {
  const zillowTable = getZillowTableForGeography(geographyType);
  const zoriTable = 'zillow_zori';
  const idColumn = getZillowIdColumn(geographyType);

  console.log(
    `Calculating Zillow percentiles for ${geographyType} on ${periodDate}`,
  );

  let calculated = 0;
  let errors = 0;

  // Fetch ZHVI data
  const { data: zhviRows } = await supabase
    .from(zillowTable)
    .select('*')
    .eq('period_date', periodDate);

  if (zhviRows && zhviRows.length > 0) {
    // Calculate zhvi percentiles
    const zhviStats = calculateMetricPercentilesFromRows(
      zhviRows,
      'zhvi',
      geographyType,
      periodDate,
    );
    if (zhviStats) {
      try {
        await savePercentiles(supabase, zhviStats);
        calculated++;
      } catch {
        errors++;
      }
    }

    // Calculate zhvi_yoy percentiles
    const zhviYoyStats = calculateMetricPercentilesFromRows(
      zhviRows,
      'zhvi_yoy',
      geographyType,
      periodDate,
    );
    if (zhviYoyStats) {
      try {
        await savePercentiles(supabase, zhviYoyStats);
        calculated++;
      } catch {
        errors++;
      }
    }
  }

  // Fetch ZORI data
  const { data: zoriRows } = await supabase
    .from(zoriTable)
    .select('*')
    .eq('period_date', periodDate);

  if (zoriRows && zoriRows.length > 0) {
    // Filter by geography type
    const filteredRows = zoriRows.filter((row: Record<string, unknown>) => {
      switch (geographyType) {
        case 'state':
          return row.state_abbrev != null;
        case 'metro':
          return row.cbsa_code != null;
        case 'county':
          return row.county_fips != null;
        case 'zip':
          return row.zip_code != null;
        default:
          return true;
      }
    });

    // Calculate zori percentiles
    const zoriStats = calculateMetricPercentilesFromRows(
      filteredRows,
      'zori',
      geographyType,
      periodDate,
    );
    if (zoriStats) {
      try {
        await savePercentiles(supabase, zoriStats);
        calculated++;
      } catch {
        errors++;
      }
    }

    // Calculate zori_yoy percentiles
    const zoriYoyStats = calculateMetricPercentilesFromRows(
      filteredRows,
      'zori_yoy',
      geographyType,
      periodDate,
    );
    if (zoriYoyStats) {
      try {
        await savePercentiles(supabase, zoriYoyStats);
        calculated++;
      } catch {
        errors++;
      }
    }
  }

  console.log(`Zillow percentiles: calculated ${calculated}, errors ${errors}`);
  return { calculated, errors };
}
