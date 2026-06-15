import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { calculateOvervalued } from '../metric-formulas';

@Injectable()
export class OvervaluedMetricsZipsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Calculate and store overvalued percentage for all ZIP codes (latest period only).
   * Uses ZHVI from zillow_zip and median_household_income from census_zip.
   */
  async calculateOvervaluedForZips(): Promise<{
    processed: number;
    stored: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    const NATIONAL_MEDIAN_INCOME = 75000;
    const CHUNK_SIZE = 1000;

    // Latest ZHVI date for ZIPs only
    const { data: latestDateRow } = await this.supabase
      .from('zillow_zip')
      .select('period_date')
      .eq('metric_name', 'zhvi')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestDateRow?.period_date) {
      return {
        processed: 0,
        stored: 0,
        errors: ['No ZHVI data found for ZIPs'],
      };
    }
    const targetDate = latestDateRow.period_date;
    const targetYear = parseInt(targetDate.substring(0, 4));

    // Fetch all ZIP ZHVI for the latest date (paginated)
    const zhviData: any[] = [];
    let zhviOffset = 0;
    while (true) {
      const { data: page } = await this.supabase
        .from('zillow_zip')
        .select('region_name, value')
        .eq('metric_name', 'zhvi')
        .eq('period_date', targetDate)
        .not('value', 'is', null)
        .range(zhviOffset, zhviOffset + 999);
      if (!page || page.length === 0) break;
      zhviData.push(...page);
      if (page.length < 1000) break;
      zhviOffset += 1000;
    }

    if (zhviData.length === 0) {
      return {
        processed: 0,
        stored: 0,
        errors: [`No ZIP ZHVI for ${targetDate}`],
      };
    }

    // Build ZHVI lookup keyed by ZIP (region_name)
    const zhviByZip: Record<string, number> = {};
    for (const row of zhviData) {
      if (row.region_name && row.value) {
        zhviByZip[row.region_name] = row.value;
      }
    }

    // Fetch census income for closest year <= targetYear
    const { data: latestCensusYearRow } = await this.supabase
      .from('census_zip')
      .select('year')
      .lte('year', targetYear)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    const censusYear = latestCensusYearRow?.year;
    const incomeByZcta: Record<string, number> = {};

    if (censusYear) {
      let censusOffset = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('census_zip')
          .select('zcta, median_household_income')
          .eq('year', censusYear)
          .not('median_household_income', 'is', null)
          .range(censusOffset, censusOffset + 999);
        if (!page || page.length === 0) break;
        for (const row of page) {
          if (row.zcta && row.median_household_income) {
            // Normalize ZCTA to 5-digit padded string to match zillow_zip region_name
            const zcta = String(row.zcta).padStart(5, '0');
            incomeByZcta[zcta] = Number(row.median_household_income);
          }
        }
        if (page.length < 1000) break;
        censusOffset += 1000;
      }
    }

    // Compute overvalued_pct and build records
    const records: any[] = [];
    for (const [zipCode, zhvi] of Object.entries(zhviByZip)) {
      const income = incomeByZcta[zipCode] || NATIONAL_MEDIAN_INCOME;
      const overvaluedPct = calculateOvervalued(zhvi, income);
      if (overvaluedPct === null) continue;
      records.push({
        geography_id: zipCode,
        geography_type: 'zip',
        geography_name: zipCode,
        period_date: targetDate,
        overvalued_pct: Math.round(overvaluedPct * 10) / 10,
        calculated_at: new Date().toISOString(),
      });
    }

    // Batched upsert in chunks of CHUNK_SIZE (non-clobbering)
    let stored = 0;
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(chunk, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (error) {
        errors.push(`zip chunk ${i}-${i + chunk.length}: ${error.message}`);
      } else {
        stored += chunk.length;
      }
    }

    return { processed: zhviData.length, stored, errors };
  }
}
