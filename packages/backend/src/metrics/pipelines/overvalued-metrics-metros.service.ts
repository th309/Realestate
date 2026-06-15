import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { calculateOvervalued } from '../metric-formulas';

@Injectable()
export class OvervaluedMetricsMetrosService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Calculate and store overvalued percentage for all metros
   * Uses ZHVI and Census median income data
   */
  async calculateOvervaluedForMetros(year?: number): Promise<{
    processed: number;
    stored: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    const NATIONAL_MEDIAN_INCOME = 75000;

    // Get ALL unique ZHVI dates
    const { data: zhviDates } = await this.supabase
      .from('zillow_metro')
      .select('period_date')
      .eq('metric_name', 'zhvi')
      .order('period_date', { ascending: false });

    let uniqueDates = Array.from(
      new Set(zhviDates?.map((d) => d.period_date) || []),
    );

    if (year) {
      uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
    }

    let totalProcessed = 0;
    let totalStored = 0;

    // Pre-fetch all census income data to avoid fetching in loop
    const { data: incomeData } = await this.supabase
      .from('census_data')
      .select('geography_id, value, year')
      .eq('geography_type', 'metro')
      .eq('metric_name', 'median_income')
      .order('year', { ascending: false });

    // Group income by year (year -> cbsa -> income)
    const incomeByYearAndGeo: Record<number, Record<string, number>> = {};
    if (incomeData) {
      for (const row of incomeData) {
        const y = row.year;
        if (!incomeByYearAndGeo[y]) incomeByYearAndGeo[y] = {};
        // Assuming row.value is numeric string
        if (row.value)
          incomeByYearAndGeo[y][row.geography_id] = Number(row.value);
      }
    }
    const availableIncomeYears = Object.keys(incomeByYearAndGeo)
      .map(Number)
      .sort((a, b) => b - a);

    for (const targetDate of uniqueDates) {
      // Get ZHVI data for all metros for this date
      const { data: zhviData, error: zhviError } = await this.supabase
        .from('zillow_metro')
        .select('region_id, region_name, value, cbsa_code')
        .eq('metric_name', 'zhvi')
        .eq('period_date', targetDate)
        .not('value', 'is', null);

      if (zhviError || !zhviData) {
        errors.push(`${targetDate}: ${zhviError?.message}`);
        continue;
      }

      // Determine efficient income year for this targetDate
      const targetYear = parseInt(targetDate.substring(0, 4));
      // Find closest year <= targetYear
      let bestIncomeYear = availableIncomeYears.find((y) => y <= targetYear);
      // If none found (targetYear is older than oldest census data), use oldest available?
      // Or if targetYear is newer than newest census, use newest.
      if (!bestIncomeYear) {
        if (availableIncomeYears.length > 0)
          bestIncomeYear = availableIncomeYears[0]; // Newest
      }

      const incomeMap = bestIncomeYear
        ? incomeByYearAndGeo[bestIncomeYear]
        : {};

      let storedInBatch = 0;
      const batchSize = 100;
      let recordsToUpsert: any[] = [];

      for (const metro of zhviData) {
        const cbsaCode = metro.cbsa_code;
        const zhvi = metro.value;
        const medianIncome =
          (cbsaCode && incomeMap[cbsaCode]) || NATIONAL_MEDIAN_INCOME;

        const overvaluedPct = calculateOvervalued(zhvi, medianIncome);

        if (overvaluedPct === null) continue;

        recordsToUpsert.push({
          geography_id: cbsaCode,
          geography_type: 'metro',
          geography_name: metro.region_name,
          period_date: targetDate,
          overvalued_pct: Math.round(overvaluedPct * 10) / 10,
          calculated_at: new Date().toISOString(),
        });

        if (recordsToUpsert.length >= batchSize) {
          storedInBatch += await this.upsertOvervalued(
            recordsToUpsert,
            targetDate,
            errors,
          );
          recordsToUpsert = [];
        }
      }

      if (recordsToUpsert.length > 0) {
        storedInBatch += await this.upsertOvervalued(
          recordsToUpsert,
          targetDate,
          errors,
        );
      }

      totalProcessed += zhviData.length;
      totalStored += storedInBatch;
    }

    return { processed: totalProcessed, stored: totalStored, errors };
  }

  /**
   * Upsert overvalued_pct preserving existing investment metric columns.
   * Uses update for existing rows, insert for new ones.
   */
  private async upsertOvervalued(
    records: Array<{
      geography_id: string;
      geography_type: string;
      geography_name: string;
      period_date: string;
      overvalued_pct: number;
      calculated_at: string;
    }>,
    targetDate: string,
    errors: string[],
  ): Promise<number> {
    if (records.length === 0) return 0;

    const validRecords = records.filter((r) => r.geography_id != null);
    if (validRecords.length === 0) return 0;

    let stored = 0;

    // Batch update existing rows (only updates overvalued_pct, preserves other columns)
    for (const r of validRecords) {
      const { data, error: updateErr } = await this.supabase
        .from('calculated_metrics')
        .update({
          overvalued_pct: r.overvalued_pct,
          geography_name: r.geography_name,
          calculated_at: r.calculated_at,
        })
        .eq('geography_id', r.geography_id)
        .eq('geography_type', r.geography_type)
        .eq('period_date', r.period_date)
        .select('geography_id');

      if (!updateErr && data && data.length > 0) {
        stored++;
      } else {
        // Row doesn't exist — insert new row
        const { error: insertErr } = await this.supabase
          .from('calculated_metrics')
          .insert(r);
        if (!insertErr) {
          stored++;
        }
      }
    }

    if (stored < validRecords.length) {
      errors.push(
        `${targetDate}: Partial overvalued upsert (${stored}/${validRecords.length})`,
      );
    }

    return stored;
  }
}
