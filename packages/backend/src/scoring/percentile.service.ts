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

// Metrics to calculate percentiles for (from Realtor wide-format tables)
// These are actual column names in realtor_state, realtor_metro, realtor_county, realtor_zip
const REALTOR_METRICS = [
  // Price metrics
  'median_listing_price',
  'median_listing_price_yy',
  'median_listing_price_mm',
  'median_listing_price_per_sqft',
  'median_listing_price_per_sqft_yy',
  // Inventory metrics
  'active_listing_count',
  'active_listing_count_yy',
  'active_listing_count_mm',
  // Days on market
  'median_days_on_market',
  'median_days_on_market_yy',
  'median_days_on_market_mm',
  'average_listing_age',
  // Listing activity
  'new_listing_count',
  'new_listing_count_yy',
  'new_listing_count_mm',
  'pending_listing_count',
  'pending_listing_count_yy',
  'pending_listing_count_mm',
  'pending_ratio',
  // Price reductions
  'price_reduced_count',
  'price_reduced_count_yy',
  'price_reduced_count_mm',
  // Hotness/Market scores
  'hotness_score',
  'hotness_rank',
  'supply_score',
  'demand_score',
  // Sale metrics
  'total_listing_count',
  'total_listing_count_yy',
  'total_listing_count_mm',
];

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
  ): Promise<{ calculated: number; errors: number }> {
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

    let calculated = 0;
    let errors = 0;

    // Calculate percentiles for each metric column
    for (const metricName of REALTOR_METRICS) {
      try {
        const stats = await this.calculateMetricPercentilesFromRows(
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
        console.error(`Error calculating percentiles for ${metricName}:`, err);
        errors++;
      }
    }

    return { calculated, errors };
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
      if (val !== null && val !== undefined && typeof val === 'number' && !isNaN(val)) {
        values.push(val);
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
    const { error } = await this.supabase.from('metric_percentiles').upsert(
      {
        metric_name: stats.metricName,
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
}
