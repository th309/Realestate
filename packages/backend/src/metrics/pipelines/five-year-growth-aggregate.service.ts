import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { calculateCAGR } from '../../common/zip';

@Injectable()
export class FiveYearGrowthAggregateService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Calculate and store 5-year home value growth for all states
   */
  async calculate5YrGrowthForStates(year?: number): Promise<{
    processed: number;
    stored: number;
  }> {
    // Get ALL unique dates (descending)
    const { data: allDates } = await this.supabase
      .from('realtor_state')
      .select('period_date')
      .order('period_date', { ascending: false });

    let uniqueDates = Array.from(
      new Set(allDates?.map((d) => d.period_date) || []),
    );

    if (year) {
      console.log(
        `[CalculatedMetrics] Filtering 5yr growth (states) for year: ${year}`,
      );
      uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
    }

    let totalProcessed = 0;
    let totalStored = 0;

    for (const dateStr of uniqueDates) {
      const targetDate = dateStr;
      const fiveYearsAgo = new Date(targetDate);
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];
      const pastDateMax = new Date(
        fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .split('T')[0];

      // Get current data
      const { data: currentData } = await this.supabase
        .from('realtor_state')
        .select('state_id, state_name, median_listing_price')
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null);

      if (!currentData || currentData.length === 0) {
        return { processed: 0, stored: 0 };
      }

      // Get historical data
      const { data: pastData } = await this.supabase
        .from('realtor_state')
        .select('state_id, median_listing_price')
        .gte('period_date', pastDateStr)
        .lte('period_date', pastDateMax)
        .not('median_listing_price', 'is', null)
        .order('period_date', { ascending: true });

      const pastByRegion: Record<string, number> = {};
      if (pastData) {
        for (const row of pastData) {
          if (!pastByRegion[row.state_id]) {
            pastByRegion[row.state_id] = row.median_listing_price;
          }
        }
      }

      let stored = 0;
      for (const state of currentData) {
        const pastValue = pastByRegion[state.state_id];
        if (!pastValue || pastValue === 0) continue;

        const cagr = calculateCAGR(pastValue, state.median_listing_price, 5);

        const { error } = await this.supabase.from('calculated_metrics').upsert(
          {
            geography_id: state.state_id,
            geography_type: 'state',
            geography_name: state.state_name,
            period_date: targetDate,
            home_value_5yr_cagr: cagr,
            calculated_at: new Date().toISOString(),
          },
          {
            onConflict: 'geography_id,geography_type,period_date',
          },
        );

        if (!error) stored++;
      }

      totalProcessed += currentData.length;
      totalStored += stored;
    }

    return { processed: totalProcessed, stored: totalStored };
  }

  /**
   * Calculate and store 5-year home value growth for national level
   */
  async calculate5YrGrowthForNational(year?: number): Promise<{
    processed: number;
    stored: number;
  }> {
    // Get ALL unique dates (descending)
    const { data: allDates } = await this.supabase
      .from('realtor_national')
      .select('period_date')
      .order('period_date', { ascending: false });

    let uniqueDates = Array.from(
      new Set(allDates?.map((d) => d.period_date) || []),
    );

    if (year) {
      console.log(
        `[CalculatedMetrics] Filtering 5yr growth (national) for year: ${year}`,
      );
      uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
    }

    let totalProcessed = 0;
    let totalStored = 0;

    for (const dateStr of uniqueDates) {
      const targetDate = dateStr;
      const fiveYearsAgo = new Date(targetDate);
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];
      const pastDateMax = new Date(
        fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .split('T')[0];

      // Get current data
      const { data: currentData } = await this.supabase
        .from('realtor_national')
        .select('median_listing_price')
        .eq('period_date', targetDate)
        .eq('country', 'United States')
        .single();

      if (!currentData) {
        return { processed: 0, stored: 0 };
      }

      // Get historical data
      const { data: pastData } = await this.supabase
        .from('realtor_national')
        .select('median_listing_price')
        .eq('country', 'United States')
        .gte('period_date', pastDateStr)
        .lte('period_date', pastDateMax)
        .not('median_listing_price', 'is', null)
        .order('period_date', { ascending: true })
        .limit(1)
        .single();

      if (!pastData || !pastData.median_listing_price) {
        return { processed: 1, stored: 0 };
      }

      const pastValue = pastData.median_listing_price;
      const cagr = calculateCAGR(
        pastValue,
        currentData.median_listing_price,
        5,
      );

      const { error } = await this.supabase.from('calculated_metrics').upsert(
        {
          geography_id: 'usa', // Standardize ID for National
          geography_type: 'national',
          geography_name: 'United States',
          period_date: targetDate,
          home_value_5yr_cagr: cagr,
          calculated_at: new Date().toISOString(),
        },
        {
          onConflict: 'geography_id,geography_type,period_date',
        },
      );

      totalProcessed++;
      if (!error) totalStored++;
    }

    return { processed: totalProcessed, stored: totalStored };
  }
}
