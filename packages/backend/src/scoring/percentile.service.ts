/**
 * Percentile Calculation Service
 *
 * Calculates and stores metric percentiles for score normalization.
 * Uses Realtor tables (wide format) as the primary data source.
 *
 * This service is a thin orchestrator: the per-source calculation logic lives
 * in dedicated helpers (percentile-*-calculator.helper.ts), the pure percentile
 * math in percentile-calculation.helper.ts, persistence in
 * percentile-persistence.helper.ts, and shared config/types in
 * percentile.types.ts.
 */

import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { GeographyType } from './scoring.types';
import { getTableForGeography } from './percentile.types';
import { calculateRealtorPercentilesForDate } from './percentile-realtor-calculator.helper';
import { calculateZillowPercentilesForDate } from './percentile-zillow-calculator.helper';
import { calculateDerivedPercentilesForDate } from './percentile-derived-calculator.helper';
import { debugTestSave } from './percentile-debug-save.helper';
import { debugInspectData } from './percentile-debug-inspect.helper';

// Re-export types/config for backward compatibility with existing importers
export type { PercentileStats } from './percentile.types';
export {
  REALTOR_TO_INTERNAL_METRIC,
  COMMON_METRICS,
  SUB_STATE_METRICS,
} from './percentile.types';

@Injectable()
export class PercentileService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Calculate percentiles for all Realtor metrics for a given geography type and date
   * Works with wide-format Realtor tables where metrics are columns
   */
  async calculatePercentilesForDate(
    geographyType: GeographyType,
    periodDate: string,
  ): Promise<{ calculated: number; errors: number; errorDetails?: string[] }> {
    return calculateRealtorPercentilesForDate(
      this.supabase,
      geographyType,
      periodDate,
    );
  }

  /**
   * Calculate percentiles for all metrics across all dates (full recalculation)
   */
  async calculateAllPercentiles(
    geographyType: GeographyType,
  ): Promise<{ calculated: number; errors: number; dates: number }> {
    const table = getTableForGeography(geographyType);

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

    return {
      calculated: totalCalculated,
      errors: totalErrors,
      dates: uniqueDates.length,
    };
  }

  /**
   * Calculate percentiles for the latest available date
   */
  async calculateLatestPercentiles(
    geographyType: GeographyType,
  ): Promise<{ calculated: number; errors: number }> {
    const table = getTableForGeography(geographyType);

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
   * Calculate percentiles for Zillow metrics (zhvi, zhvi_yoy, zori, zori_yoy)
   */
  async calculateZillowPercentilesForDate(
    geographyType: GeographyType,
    periodDate: string,
  ): Promise<{ calculated: number; errors: number }> {
    return calculateZillowPercentilesForDate(
      this.supabase,
      geographyType,
      periodDate,
    );
  }

  /**
   * Calculate percentiles for calculated metrics (grm, cap_rate, gross_yield, months_of_supply)
   */
  async calculateDerivedPercentilesForDate(
    geographyType: GeographyType,
    periodDate: string,
  ): Promise<{ calculated: number; errors: number }> {
    return calculateDerivedPercentilesForDate(
      this.supabase,
      geographyType,
      periodDate,
    );
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
    const realtor = await this.calculatePercentilesForDate(
      geographyType,
      periodDate,
    );
    totalCalculated += realtor.calculated;
    totalErrors += realtor.errors;

    // 2. Zillow metrics
    const zillow = await this.calculateZillowPercentilesForDate(
      geographyType,
      periodDate,
    );
    totalCalculated += zillow.calculated;
    totalErrors += zillow.errors;

    // 3. Derived/Calculated metrics
    const derived = await this.calculateDerivedPercentilesForDate(
      geographyType,
      periodDate,
    );
    totalCalculated += derived.calculated;
    totalErrors += derived.errors;

    console.log(
      `Total percentiles for ${geographyType}/${periodDate}: ${totalCalculated} calculated, ${totalErrors} errors`,
    );
    return { calculated: totalCalculated, errors: totalErrors };
  }

  /**
   * Debug endpoint to test saving a single percentile record
   * Returns the exact error message if upsert fails
   */
  async debugTestSave(
    geographyType: GeographyType,
  ): Promise<Record<string, unknown>> {
    return debugTestSave(this.supabase, geographyType);
  }

  /**
   * Debug endpoint to inspect raw data structure
   */
  async debugInspectData(
    geographyType: GeographyType,
  ): Promise<Record<string, unknown>> {
    return debugInspectData(this.supabase, geographyType);
  }
}
