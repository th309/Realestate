/**
 * Percentile Calculation Service
 *
 * Calculates and stores metric percentiles for score normalization.
 * This service should be run after new Zillow data is imported.
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

@Injectable()
export class PercentileService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) { }

  /**
   * Calculate percentiles for all metrics for a given geography type and date
   */
  async calculatePercentilesForDate(
    geographyType: GeographyType,
    periodDate: string,
  ): Promise<{ calculated: number; errors: number }> {
    const table = this.getTableForGeography(geographyType);

    // Get all unique metric names for this date
    const { data: metrics, error: metricsError } = await this.supabase
      .from(table)
      .select('metric_name')
      .eq('period_date', periodDate)
      .not('value', 'is', null);

    if (metricsError || !metrics) {
      console.error('Error fetching metrics:', metricsError);
      return { calculated: 0, errors: 1 };
    }

    const uniqueMetrics = [...new Set(metrics.map(m => m.metric_name))];
    console.log(`Found ${uniqueMetrics.length} unique metrics for ${geographyType} on ${periodDate}`);

    let calculated = 0;
    let errors = 0;

    for (const metricName of uniqueMetrics) {
      try {
        const stats = await this.calculateMetricPercentiles(table, metricName, geographyType, periodDate);
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
  async calculateAllPercentiles(geographyType: GeographyType): Promise<{ calculated: number; errors: number }> {
    const table = this.getTableForGeography(geographyType);

    // Get all unique dates
    const { data: dates } = await this.supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false });

    if (!dates) return { calculated: 0, errors: 0 };

    const uniqueDates = [...new Set(dates.map(d => d.period_date))];
    console.log(`Found ${uniqueDates.length} unique dates for ${geographyType}`);

    let totalCalculated = 0;
    let totalErrors = 0;

    for (const periodDate of uniqueDates) {
      const { calculated, errors } = await this.calculatePercentilesForDate(geographyType, periodDate);
      totalCalculated += calculated;
      totalErrors += errors;
    }

    return { calculated: totalCalculated, errors: totalErrors };
  }

  /**
   * Calculate percentiles for the latest available date
   */
  async calculateLatestPercentiles(geographyType: GeographyType): Promise<{ calculated: number; errors: number }> {
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

  private async calculateMetricPercentiles(
    table: string,
    metricName: string,
    geographyType: GeographyType,
    periodDate: string,
  ): Promise<PercentileStats | null> {
    // Fetch all values for this metric/date combination
    const { data: values, error } = await this.supabase
      .from(table)
      .select('value')
      .eq('metric_name', metricName)
      .eq('period_date', periodDate)
      .not('value', 'is', null)
      .order('value', { ascending: true });

    if (error || !values || values.length < 10) {
      // Need at least 10 values for meaningful percentiles
      return null;
    }

    const numericValues = values.map(v => v.value as number);
    const count = numericValues.length;

    // Calculate percentiles
    const getPercentile = (arr: number[], percentile: number): number => {
      const index = Math.floor((percentile / 100) * arr.length);
      return arr[Math.min(index, arr.length - 1)];
    };

    // Calculate mean
    const sum = numericValues.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    // Calculate standard deviation
    const squaredDiffs = numericValues.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / count;
    const stddev = Math.sqrt(avgSquaredDiff);

    return {
      metricName,
      geographyType,
      periodDate,
      p10: getPercentile(numericValues, 10),
      p20: getPercentile(numericValues, 20),
      p30: getPercentile(numericValues, 30),
      p40: getPercentile(numericValues, 40),
      p50: getPercentile(numericValues, 50),
      p60: getPercentile(numericValues, 60),
      p70: getPercentile(numericValues, 70),
      p80: getPercentile(numericValues, 80),
      p90: getPercentile(numericValues, 90),
      min: numericValues[0],
      max: numericValues[count - 1],
      count,
      mean,
      stddev,
    };
  }

  private async savePercentiles(stats: PercentileStats): Promise<void> {
    const { error } = await this.supabase
      .from('metric_percentiles')
      .upsert({
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
      }, {
        onConflict: 'metric_name,geography_type,period_date',
      });

    if (error) {
      console.error('Error saving percentiles:', error);
      throw error;
    }
  }

  private getTableForGeography(geographyType: GeographyType): string {
    switch (geographyType) {
      case 'state': return 'zillow_state';
      case 'metro': return 'zillow_metro';
      case 'county': return 'zillow_county';
      case 'zip': return 'zillow_zip';
      default: return 'zillow_metro';
    }
  }
}
