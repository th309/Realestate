/**
 * Percentile Calculation Service
 *
 * Calculates and stores metric percentiles for score normalization.
 * Uses Realtor tables (wide format) as the primary data source.
 */

import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { GeographyType } from './scoring.types';

interface PercentileStats {
  metricName: string;
  geographyType: GeographyType;
  periodDate: string;
  p10: number;
  p20: number;
  p30: number;
  p40: number;
  p50: number;
  p60: number;
  p70: number;
  p80: number;
  p90: number;
  min: number;
  max: number;
  count: number;
  mean: number;
  stddev: number;
}

// Mapping from Realtor column names to scoring component metric names
// IMPORTANT: These must match the metric names in scoring.types.ts component definitions
// Some metrics keep original Realtor names, others use scoring service internal names
const REALTOR_TO_INTERNAL_METRIC: Record<string, string> = {
  // These metrics keep their Realtor names (used directly in component definitions)
  'median_listing_price': 'median_listing_price',
  'median_listing_price_yy': 'median_listing_price_yy',
  'median_listing_price_mm': 'median_listing_price_mm',
  'median_listing_price_per_square_foot': 'median_listing_price_per_square_foot',
  'active_listing_count': 'inventory',  // Component uses 'inventory'
  'active_listing_count_yy': 'active_listing_count_yy',  // Component uses this exact name
  'median_days_on_market': 'median_days_on_market',  // Component uses this exact name
  'new_listing_count': 'new_listings',  // Component uses 'new_listings'
  'new_listing_count_yy': 'new_listing_count_yy',  // Component uses this exact name
  'pending_listing_count': 'pending_sales',  // Component uses 'pending_sales'
  'pending_listing_count_yy': 'pending_listing_count_yy',  // Component uses this exact name
  'pending_ratio': 'pending_ratio',
  'price_reduced_share': 'price_reduced_share',
  'price_increased_share': 'price_increased_share',
  'hotness_score': 'hotness_score',
  'hotness_rank': 'hotness_rank',
  'supply_score': 'supply_score',
  'demand_score': 'demand_score',
};

// Metrics available at ALL geography levels (state, metro, county, zip)
const COMMON_METRICS = [
  // Price metrics
  'median_listing_price',
  'median_listing_price_yy',
  'median_listing_price_mm',
  'median_listing_price_per_square_foot', // correct column name
  // Inventory metrics
  'active_listing_count',
  'active_listing_count_yy',
  // Days on market
  'median_days_on_market',
  // Listing activity
  'new_listing_count',
  'new_listing_count_yy',
  'pending_listing_count',
  'pending_listing_count_yy',
  // Ratios
  'pending_ratio',
  'price_reduced_share',
  'price_increased_share',
];

// Metrics only available at metro/county/zip levels (NOT state)
const SUB_STATE_METRICS = [
  'hotness_score',
  'hotness_rank',
  'supply_score',
  'demand_score',
];

// Get metrics for a geography type
function getMetricsForGeography(geographyType: GeographyType): string[] {
  if (geographyType === 'state') {
    return COMMON_METRICS;
  }
  return [...COMMON_METRICS, ...SUB_STATE_METRICS];
}

// Convert Realtor column name to internal metric name
function toInternalMetricName(realtorColumn: string): string {
  return REALTOR_TO_INTERNAL_METRIC[realtorColumn] || realtorColumn;
}

@Injectable()
export class PercentileService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Calculate percentiles for all metrics for a given geography type and date
   * Works with wide-format Realtor tables where metrics are columns
   */
  async calculatePercentilesForDate(
    geographyType: GeographyType,
    periodDate: string,
  ): Promise<{ calculated: number; errors: number; errorDetails?: string[] }> {
    const table = this.getTableForGeography(geographyType);
    console.log(`Calculating percentiles for ${geographyType} on ${periodDate} from table ${table}`);

    // Fetch all rows for this date - wide format means each row has all metrics as columns
    const { data: rows, error: fetchError } = await this.supabase
      .from(table)
      .select('*')
      .eq('period_date', periodDate);

    if (fetchError) {
      console.error(`Error fetching data from ${table}:`, fetchError.message, fetchError.details);
      return { calculated: 0, errors: 1 };
    }

    if (!rows || rows.length === 0) {
      console.log(`No data found in ${table} for date ${periodDate}`);
      return { calculated: 0, errors: 0 };
    }

    console.log(`Found ${rows.length} rows for ${geographyType} on ${periodDate}`);

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
    console.log(`Calculating percentiles for ${metricsToCalculate.length} metrics`);

    // Calculate percentiles for each metric column
    const errorDetails: string[] = [];
    for (const metricName of metricsToCalculate) {
      try {
        const stats = this.calculateMetricPercentilesFromRows(
          rows,
          metricName,
          geographyType,
          periodDate,
        );
        if (stats) {
          await this.savePercentiles(stats);
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
      console.error(`Error details for ${geographyType}/${periodDate}:`, errorDetails.slice(0, 3));
    }

    return { calculated, errors, errorDetails: errorDetails.length > 0 ? errorDetails : undefined };
  }

  /**
   * Calculate percentiles for all metrics across all dates (full recalculation)
   */
  async calculateAllPercentiles(
    geographyType: GeographyType,
  ): Promise<{ calculated: number; errors: number; dates: number }> {
    const table = this.getTableForGeography(geographyType);

    // Get all unique dates
    const { data: dates } = await this.supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false });

    if (!dates) return { calculated: 0, errors: 0, dates: 0 };

    const uniqueDates = [...new Set(dates.map((d) => d.period_date))];
    console.log(
      `Found ${uniqueDates.length} unique dates for ${geographyType}`,
    );

    let totalCalculated = 0;
    let totalErrors = 0;

    for (const periodDate of uniqueDates) {
      const { calculated, errors } = await this.calculatePercentilesForDate(
        geographyType,
        periodDate,
      );
      totalCalculated += calculated;
      totalErrors += errors;
    }

    return { calculated: totalCalculated, errors: totalErrors, dates: uniqueDates.length };
  }

  /**
   * Calculate percentiles for the latest available date
   */
  async calculateLatestPercentiles(
    geographyType: GeographyType,
  ): Promise<{ calculated: number; errors: number }> {
    const table = this.getTableForGeography(geographyType);

    // Get latest date
    const { data: latestData } = await this.supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    if (!latestData || latestData.length === 0) {
      return { calculated: 0, errors: 0 };
    }

    const latestDate = latestData[0].period_date;
    return this.calculatePercentilesForDate(geographyType, latestDate);
  }

  /**
   * Calculate percentiles from wide-format rows where metrics are columns
   */
  private calculateMetricPercentilesFromRows(
    rows: Record<string, unknown>[],
    metricName: string,
    geographyType: GeographyType,
    periodDate: string,
  ): PercentileStats | null {
    // Extract values for this metric column from all rows
    const values: number[] = [];
    for (const row of rows) {
      const val = row[metricName];
      if (val === null || val === undefined) continue;

      // Handle both number and string values (database may store as text)
      let numVal: number;
      if (typeof val === 'number') {
        numVal = val;
      } else if (typeof val === 'string') {
        numVal = parseFloat(val);
      } else {
        continue;
      }

      if (!isNaN(numVal) && isFinite(numVal)) {
        values.push(numVal);
      }
    }

    if (values.length < 5) {
      // Need at least 5 values for meaningful percentiles (reduced from 10 for states)
      console.log(`Skipping ${metricName}: only ${values.length} non-null values`);
      return null;
    }

    // Sort values for percentile calculation
    values.sort((a, b) => a - b);
    const count = values.length;

    // Calculate percentiles
    const getPercentile = (arr: number[], percentile: number): number => {
      const index = Math.floor((percentile / 100) * arr.length);
      return arr[Math.min(index, arr.length - 1)];
    };

    // Calculate mean
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    // Calculate standard deviation
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / count;
    const stddev = Math.sqrt(avgSquaredDiff);

    return {
      metricName,
      geographyType,
      periodDate,
      p10: getPercentile(values, 10),
      p20: getPercentile(values, 20),
      p30: getPercentile(values, 30),
      p40: getPercentile(values, 40),
      p50: getPercentile(values, 50),
      p60: getPercentile(values, 60),
      p70: getPercentile(values, 70),
      p80: getPercentile(values, 80),
      p90: getPercentile(values, 90),
      min: values[0],
      max: values[count - 1],
      count,
      mean,
      stddev,
    };
  }

  private async savePercentiles(stats: PercentileStats): Promise<void> {
    // Convert Realtor column name to internal scoring metric name
    const internalMetricName = toInternalMetricName(stats.metricName);

    const { error } = await this.supabase.from('metric_percentiles').upsert(
      {
        metric_name: internalMetricName,  // Use internal scoring metric names
        geography_type: stats.geographyType,
        period_date: stats.periodDate,
        p10: stats.p10,
        p20: stats.p20,
        p30: stats.p30,
        p40: stats.p40,
        p50: stats.p50,
        p60: stats.p60,
        p70: stats.p70,
        p80: stats.p80,
        p90: stats.p90,
        min_value: stats.min,
        max_value: stats.max,
        count_values: stats.count,
        mean_value: stats.mean,
        stddev_value: stats.stddev,
        calculated_at: new Date().toISOString(),
      },
      {
        onConflict: 'metric_name,geography_type,period_date',
      },
    );

    if (error) {
      console.error('Error saving percentiles:', error);
      throw error;
    }
  }

  private getTableForGeography(geographyType: GeographyType): string {
    // Use Realtor tables as primary source (wide format with metric columns)
    switch (geographyType) {
      case 'state':
        return 'realtor_state';
      case 'metro':
        return 'realtor_metro';
      case 'county':
        return 'realtor_county';
      case 'zip':
        return 'realtor_zip';
      default:
        return 'realtor_metro';
    }
  }

  /**
   * Calculate percentiles for Zillow metrics (zhvi, zhvi_yoy, zori, zori_yoy)
   */
  async calculateZillowPercentilesForDate(
    geographyType: GeographyType,
    periodDate: string,
  ): Promise<{ calculated: number; errors: number }> {
    const zillowTable = this.getZillowTableForGeography(geographyType);
    const zoriTable = 'zillow_zori';
    const idColumn = this.getZillowIdColumn(geographyType);

    console.log(`Calculating Zillow percentiles for ${geographyType} on ${periodDate}`);

    let calculated = 0;
    let errors = 0;

    // Fetch ZHVI data
    const { data: zhviRows } = await this.supabase
      .from(zillowTable)
      .select('*')
      .eq('period_date', periodDate);

    if (zhviRows && zhviRows.length > 0) {
      // Calculate zhvi percentiles
      const zhviStats = this.calculateMetricPercentilesFromRows(zhviRows, 'zhvi', geographyType, periodDate);
      if (zhviStats) {
        try {
          await this.savePercentiles(zhviStats);
          calculated++;
        } catch { errors++; }
      }

      // Calculate zhvi_yoy percentiles
      const zhviYoyStats = this.calculateMetricPercentilesFromRows(zhviRows, 'zhvi_yoy', geographyType, periodDate);
      if (zhviYoyStats) {
        try {
          await this.savePercentiles(zhviYoyStats);
          calculated++;
        } catch { errors++; }
      }
    }

    // Fetch ZORI data
    const { data: zoriRows } = await this.supabase
      .from(zoriTable)
      .select('*')
      .eq('period_date', periodDate);

    if (zoriRows && zoriRows.length > 0) {
      // Filter by geography type
      const filteredRows = zoriRows.filter((row: Record<string, unknown>) => {
        switch (geographyType) {
          case 'state': return row.state_abbrev != null;
          case 'metro': return row.cbsa_code != null;
          case 'county': return row.county_fips != null;
          case 'zip': return row.zip_code != null;
          default: return true;
        }
      });

      // Calculate zori percentiles
      const zoriStats = this.calculateMetricPercentilesFromRows(filteredRows, 'zori', geographyType, periodDate);
      if (zoriStats) {
        try {
          await this.savePercentiles(zoriStats);
          calculated++;
        } catch { errors++; }
      }

      // Calculate zori_yoy percentiles
      const zoriYoyStats = this.calculateMetricPercentilesFromRows(filteredRows, 'zori_yoy', geographyType, periodDate);
      if (zoriYoyStats) {
        try {
          await this.savePercentiles(zoriYoyStats);
          calculated++;
        } catch { errors++; }
      }
    }

    console.log(`Zillow percentiles: calculated ${calculated}, errors ${errors}`);
    return { calculated, errors };
  }

  /**
   * Calculate percentiles for calculated metrics (grm, cap_rate, gross_yield, months_of_supply)
   */
  async calculateDerivedPercentilesForDate(
    geographyType: GeographyType,
    periodDate: string,
  ): Promise<{ calculated: number; errors: number }> {
    console.log(`Calculating derived metric percentiles for ${geographyType} on ${periodDate}`);

    // Fetch calculated_metrics data
    const { data: rows } = await this.supabase
      .from('calculated_metrics')
      .select('*')
      .eq('geography_type', geographyType)
      .eq('period_date', periodDate);

    if (!rows || rows.length === 0) {
      console.log(`No calculated_metrics found for ${geographyType} on ${periodDate}`);
      return { calculated: 0, errors: 0 };
    }

    console.log(`Found ${rows.length} calculated_metrics rows`);

    let calculated = 0;
    let errors = 0;

    // Metrics to calculate from calculated_metrics table
    const derivedMetrics = [
      'grm',
      'cap_rate_proxy',  // Will be saved as 'cap_rate'
      'annual_rent_price_ratio',  // Will be saved as 'gross_yield'
      'months_of_supply',
      'zhvi_yoy_change',
      'zori_yoy_change',
    ];

    // Metric name mapping for derived metrics
    const derivedMetricMapping: Record<string, string> = {
      'cap_rate_proxy': 'cap_rate',
      'annual_rent_price_ratio': 'gross_yield',
      'zhvi_yoy_change': 'zhvi_yoy',
      'zori_yoy_change': 'zori_yoy',
    };

    for (const metric of derivedMetrics) {
      const stats = this.calculateMetricPercentilesFromRows(rows, metric, geographyType, periodDate);
      if (stats) {
        // Map to internal metric name if needed
        stats.metricName = derivedMetricMapping[metric] || metric;
        try {
          await this.savePercentiles(stats);
          calculated++;
        } catch { errors++; }
      }
    }

    console.log(`Derived percentiles: calculated ${calculated}, errors ${errors}`);
    return { calculated, errors };
  }

  /**
   * Calculate ALL percentiles (Realtor + Zillow + Derived) for a date
   */
  async calculateAllSourcePercentilesForDate(
    geographyType: GeographyType,
    periodDate: string,
  ): Promise<{ calculated: number; errors: number }> {
    let totalCalculated = 0;
    let totalErrors = 0;

    // 1. Realtor metrics
    const realtor = await this.calculatePercentilesForDate(geographyType, periodDate);
    totalCalculated += realtor.calculated;
    totalErrors += realtor.errors;

    // 2. Zillow metrics
    const zillow = await this.calculateZillowPercentilesForDate(geographyType, periodDate);
    totalCalculated += zillow.calculated;
    totalErrors += zillow.errors;

    // 3. Derived/Calculated metrics
    const derived = await this.calculateDerivedPercentilesForDate(geographyType, periodDate);
    totalCalculated += derived.calculated;
    totalErrors += derived.errors;

    console.log(`Total percentiles for ${geographyType}/${periodDate}: ${totalCalculated} calculated, ${totalErrors} errors`);
    return { calculated: totalCalculated, errors: totalErrors };
  }

  private getZillowTableForGeography(geographyType: GeographyType): string {
    switch (geographyType) {
      case 'state': return 'zillow_state';
      case 'metro': return 'zillow_metro';
      case 'county': return 'zillow_county';
      case 'zip': return 'zillow_zip';
      default: return 'zillow_metro';
    }
  }

  private getZillowIdColumn(geographyType: GeographyType): string {
    switch (geographyType) {
      case 'state': return 'state_abbrev';
      case 'metro': return 'cbsa_code';
      case 'county': return 'county_fips';
      case 'zip': return 'zip_code';
      default: return 'cbsa_code';
    }
  }

  /**
   * Debug endpoint to test saving a single percentile record
   * Returns the exact error message if upsert fails
   */
  async debugTestSave(geographyType: GeographyType): Promise<Record<string, unknown>> {
    const testData = {
      metric_name: 'test_metric',  // Column is metric_name per migration 030
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

    const { data, error } = await this.supabase
      .from('metric_percentiles')
      .upsert(testData, { onConflict: 'metric_name,geography_type,period_date' })
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
    await this.supabase
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

  /**
   * Debug endpoint to inspect raw data structure
   */
  async debugInspectData(geographyType: GeographyType): Promise<Record<string, unknown>> {
    const table = this.getTableForGeography(geographyType);
    const metricsToCalculate = getMetricsForGeography(geographyType);

    // Get latest date
    const { data: latestData } = await this.supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1);

    const latestDate = latestData?.[0]?.period_date;
    if (!latestDate) {
      return { error: 'No data found', table };
    }

    // Fetch rows for this date
    const { data: rows, error } = await this.supabase
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
}
