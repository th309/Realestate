import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { calculateCAGR } from '../../common/zip';

@Injectable()
export class FiveYearGrowthMetroService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Calculate and store 5-year home value growth for all metros
   */
  async calculate5YrGrowthForMetros(year?: number): Promise<{
    processed: number;
    stored: number;
    debug?: any;
  }> {
    // Get ALL unique dates (descending)
    const { data: allDates } = await this.supabase
      .from('realtor_metro')
      .select('period_date')
      .order('period_date', { ascending: false });

    let uniqueDates = Array.from(
      new Set(allDates?.map((d) => d.period_date) || []),
    );

    if (year) {
      console.log(
        `[CalculatedMetrics] Filtering 5yr growth (metros) for year: ${year}`,
      );
      uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
    }

    let totalProcessed = 0;
    let totalStored = 0;
    const allUpsertErrors: string[] = [];
    const BATCH_SIZE = 100;

    console.log(
      `[CalculatedMetrics] Backfilling 5yr growth (metros) for ${uniqueDates.length} dates...`,
    );

    for (const dateStr of uniqueDates) {
      const targetDate = dateStr;

      // 5-year lookback
      const fiveYearsAgo = new Date(targetDate);
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const pastDate5Str = fiveYearsAgo.toISOString().split('T')[0];
      const pastDate5Max = new Date(
        fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .split('T')[0];

      // 3-year lookback
      const threeYearsAgo = new Date(targetDate);
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      const pastDate3Str = threeYearsAgo.toISOString().split('T')[0];
      const pastDate3Max = new Date(
        threeYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .split('T')[0];

      // Get current data
      const { data: currentData } = await this.supabase
        .from('realtor_metro')
        .select('cbsa_code, cbsa_title, median_listing_price')
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null);

      if (!currentData || currentData.length === 0) continue;

      // Get 5yr historical data
      const { data: pastData5 } = await this.supabase
        .from('realtor_metro')
        .select('cbsa_code, median_listing_price')
        .gte('period_date', pastDate5Str)
        .lte('period_date', pastDate5Max)
        .not('median_listing_price', 'is', null)
        .order('period_date', { ascending: true });

      const past5ByRegion: Record<string, number> = {};
      if (pastData5) {
        for (const row of pastData5) {
          if (!past5ByRegion[row.cbsa_code]) {
            past5ByRegion[row.cbsa_code] = row.median_listing_price;
          }
        }
      }

      // Get 3yr historical data
      const { data: pastData3 } = await this.supabase
        .from('realtor_metro')
        .select('cbsa_code, median_listing_price')
        .gte('period_date', pastDate3Str)
        .lte('period_date', pastDate3Max)
        .not('median_listing_price', 'is', null)
        .order('period_date', { ascending: true });

      const past3ByRegion: Record<string, number> = {};
      if (pastData3) {
        for (const row of pastData3) {
          if (!past3ByRegion[row.cbsa_code]) {
            past3ByRegion[row.cbsa_code] = row.median_listing_price;
          }
        }
      }

      let recordsToUpsert: any[] = [];

      for (const metro of currentData) {
        const pastValue5 = past5ByRegion[metro.cbsa_code];
        const pastValue3 = past3ByRegion[metro.cbsa_code];

        // Need at least one historical value
        if (
          (!pastValue5 || pastValue5 === 0) &&
          (!pastValue3 || pastValue3 === 0)
        )
          continue;

        const cagr5 =
          pastValue5 && pastValue5 > 0
            ? calculateCAGR(pastValue5, metro.median_listing_price, 5)
            : null;
        const cagr3 =
          pastValue3 && pastValue3 > 0
            ? calculateCAGR(pastValue3, metro.median_listing_price, 3)
            : null;

        recordsToUpsert.push({
          geography_id: metro.cbsa_code,
          geography_type: 'metro',
          geography_name: metro.cbsa_title,
          period_date: targetDate,
          home_value_5yr_cagr: cagr5,
          zhvi_3y_cagr: cagr3,
          calculated_at: new Date().toISOString(),
        });

        if (recordsToUpsert.length >= BATCH_SIZE) {
          const { error } = await this.supabase
            .from('calculated_metrics')
            .upsert(recordsToUpsert, {
              onConflict: 'geography_id,geography_type,period_date',
            });
          if (error) {
            allUpsertErrors.push(`${dateStr}: ${error.message}`);
          } else {
            totalStored += recordsToUpsert.length;
          }
          recordsToUpsert = [];
        }
      }

      if (recordsToUpsert.length > 0) {
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, {
            onConflict: 'geography_id,geography_type,period_date',
          });
        if (error) {
          allUpsertErrors.push(`${dateStr} (last batch): ${error.message}`);
        } else {
          totalStored += recordsToUpsert.length;
        }
      }
      totalProcessed += currentData.length;
    }

    return {
      processed: totalProcessed,
      stored: totalStored,
      debug: {
        errors: allUpsertErrors.length > 0 ? allUpsertErrors : undefined,
      },
    };
  }
}
