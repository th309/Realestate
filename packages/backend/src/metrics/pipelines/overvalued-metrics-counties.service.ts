import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { calculateOvervalued } from '../metric-formulas';

@Injectable()
export class OvervaluedMetricsCountiesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Calculate and store overvalued percentage for all counties (latest period only).
   * Uses ZHVI from zillow_county and median_household_income from census_county.
   */
  async calculateOvervaluedForCounties(): Promise<{
    processed: number;
    stored: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    const NATIONAL_MEDIAN_INCOME = 75000;
    const CHUNK_SIZE = 1000;

    // Latest ZHVI date for counties only
    const { data: latestDateRow } = await this.supabase
      .from('zillow_county')
      .select('period_date')
      .eq('metric_name', 'zhvi')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestDateRow?.period_date) {
      return {
        processed: 0,
        stored: 0,
        errors: ['No ZHVI data found for counties'],
      };
    }
    const targetDate = latestDateRow.period_date;
    const targetYear = parseInt(targetDate.substring(0, 4));

    // Fetch all county ZHVI for the latest date (paginated)
    const zhviData: any[] = [];
    let zhviOffset = 0;
    while (true) {
      const { data: page } = await this.supabase
        .from('zillow_county')
        .select('region_name, fips_code, value')
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
        errors: [`No county ZHVI for ${targetDate}`],
      };
    }

    // Normalize FIPS to 5-digit string
    const normalizeFips = (f: string | null | undefined) =>
      f && /^\d+$/.test(f) ? String(parseInt(f, 10)).padStart(5, '0') : f;

    // Build ZHVI lookup keyed by normalized FIPS
    const zhviByFips: Record<string, { value: number; name: string }> = {};
    for (const row of zhviData) {
      const fips = normalizeFips(row.fips_code);
      if (fips && row.value) {
        zhviByFips[fips] = { value: row.value, name: row.region_name ?? fips };
      }
    }

    // Fetch census income for closest year <= targetYear (paginated)
    const { data: latestCensusYearRow } = await this.supabase
      .from('census_county')
      .select('year')
      .lte('year', targetYear)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    const censusYear = latestCensusYearRow?.year;
    const incomeByFips: Record<string, number> = {};

    if (censusYear) {
      let censusOffset = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('census_county')
          .select('fips_code, median_household_income')
          .eq('year', censusYear)
          .not('median_household_income', 'is', null)
          .range(censusOffset, censusOffset + 999);
        if (!page || page.length === 0) break;
        for (const row of page) {
          const fips = normalizeFips(row.fips_code);
          if (fips && row.median_household_income) {
            incomeByFips[fips] = Number(row.median_household_income);
          }
        }
        if (page.length < 1000) break;
        censusOffset += 1000;
      }
    }

    // Compute overvalued_pct and build records
    const records: any[] = [];
    for (const [fips, zhvi] of Object.entries(zhviByFips)) {
      const income = incomeByFips[fips] || NATIONAL_MEDIAN_INCOME;
      const overvaluedPct = calculateOvervalued(zhvi.value, income);
      if (overvaluedPct === null) continue;
      records.push({
        geography_id: fips,
        geography_type: 'county',
        geography_name: zhvi.name,
        period_date: targetDate,
        overvalued_pct: Math.round(overvaluedPct * 10) / 10,
        calculated_at: new Date().toISOString(),
      });
    }

    // Batched upsert in chunks of CHUNK_SIZE (non-clobbering: only overvalued_pct + name + calculated_at)
    let stored = 0;
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(chunk, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (error) {
        errors.push(`county chunk ${i}-${i + chunk.length}: ${error.message}`);
      } else {
        stored += chunk.length;
      }
    }

    return { processed: zhviData.length, stored, errors };
  }
}
