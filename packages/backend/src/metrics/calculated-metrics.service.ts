import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeZipKey, calculateCAGR } from '../common/zip';
import {
  CalculatedMetricsInput,
  CalculatedMetricsOutput,
} from './calculated-metrics.types';
import {
  calculateCapRate,
  calculateGrossYield,
  calculateRentToPriceRatio,
  calculateGRM,
  calculateMonthsOfSupply,
  calculateAbsorptionRate,
  calculateOvervalued,
} from './metric-formulas';

// Back-compat: keep these importable from the service path.
export type { CalculatedMetricsInput, CalculatedMetricsOutput };

@Injectable()
export class CalculatedMetricsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Store calculated metrics to the database
   */
  async storeMetrics(
    input: CalculatedMetricsInput,
    metrics: CalculatedMetricsOutput,
  ): Promise<void> {
    const { error } = await this.supabase.from('calculated_metrics').upsert(
      {
        geography_id: input.geography_id,
        geography_type: input.geography_type,
        geography_name: input.geography_name,
        period_date: input.period_date,
        ...metrics,
        calculated_at: new Date().toISOString(),
      },
      {
        onConflict: 'geography_id,geography_type,period_date',
      },
    );

    if (error) {
      throw new Error(`Failed to store calculated metrics: ${error.message}`);
    }
  }

  /**
   * Get calculated metrics for a geography
   */
  async getMetrics(
    geographyId: string,
    geographyType: string,
    periodDate?: string,
  ): Promise<CalculatedMetricsOutput | null> {
    let query = this.supabase
      .from('calculated_metrics')
      .select('*')
      .eq('geography_id', geographyId)
      .eq('geography_type', geographyType);

    if (periodDate) {
      query = query.eq('period_date', periodDate);
    } else {
      // Get the latest few rows and merge non-null values,
      // since different batch jobs may store metrics at different dates
      query = query.order('period_date', { ascending: false }).limit(3);
    }

    const { data: rows, error } = await query;

    if (error || !rows || rows.length === 0) {
      return null;
    }

    // Merge: latest non-null value for each field wins
    const mergedFields = [
      'cap_rate',
      'gross_yield',
      'rent_to_price_ratio',
      'grm',
      'months_of_supply',
      'absorption_rate',
      'market_health_score',
      'investment_score',
      'long_term_growth_score',
      'home_value_5yr_cagr',
      'zhvi_3y_cagr',
      'zori_yoy',
      'zori_5y_cagr',
      'inventory_surplus',
      'overvalued_pct',
    ] as const;

    const merged: Record<string, any> = {};
    for (const field of mergedFields) {
      for (const row of rows) {
        if (row[field] != null) {
          merged[field] = row[field];
          break;
        }
      }
    }

    return {
      cap_rate: merged.cap_rate ?? null,
      gross_yield: merged.gross_yield ?? null,
      rent_to_price_ratio: merged.rent_to_price_ratio ?? null,
      grm: merged.grm ?? null,
      months_of_supply: merged.months_of_supply ?? null,
      absorption_rate: merged.absorption_rate ?? null,
      market_health_score: merged.market_health_score ?? null,
      investment_score: merged.investment_score ?? null,
      long_term_growth_score: merged.long_term_growth_score ?? null,
      home_value_5yr_cagr: merged.home_value_5yr_cagr ?? null,
      zhvi_3y_cagr: merged.zhvi_3y_cagr ?? null,
      zori_yoy: merged.zori_yoy ?? null,
      zori_5y_cagr: merged.zori_5y_cagr ?? null,
      inventory_surplus_pct: merged.inventory_surplus ?? null,
      overvalued_pct: merged.overvalued_pct ?? null,
    };
  }

  /**
   * Get calculated metrics for multiple geographies (for map display)
   */
  async getMetricsForMap(
    geographyType: string,
    metricName: keyof CalculatedMetricsOutput,
    periodDate?: string,
  ): Promise<Record<string, number>> {
    let query = this.supabase
      .from('calculated_metrics')
      .select(`geography_id, ${metricName}`)
      .eq('geography_type', geographyType)
      .not(metricName, 'is', null);

    if (periodDate) {
      query = query.eq('period_date', periodDate);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {};
    }

    const result: Record<string, number> = {};
    for (const row of data) {
      if (row[metricName] !== null && row[metricName] !== undefined) {
        result[row.geography_id] = Number(row[metricName]);
      }
    }

    return result;
  }

  // ============================================================================
  // 5-YEAR GROWTH BATCH CALCULATION
  // ============================================================================

  private readonly PAGE_SIZE = 1000;

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
   * Calculate and store 5-year home value growth for all counties (paginated)
   */
  async calculate5YrGrowthForCounties(): Promise<{
    processed: number;
    stored: number;
  }> {
    // Get current date
    const { data: latestDateRow } = await this.supabase
      .from('realtor_county')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestDateRow?.period_date) {
      return { processed: 0, stored: 0 };
    }

    const targetDate = latestDateRow.period_date;
    const fiveYearsAgo = new Date(targetDate);
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];
    const pastDateMax = new Date(
      fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .split('T')[0];

    // Get all current data (paginated)
    const allCurrentData: any[] = [];
    let offset = 0;
    while (true) {
      const { data: pageData } = await this.supabase
        .from('realtor_county')
        .select('county_fips, county_name, median_listing_price')
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null)
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (!pageData || pageData.length === 0) break;
      allCurrentData.push(...pageData);
      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    if (allCurrentData.length === 0) {
      return { processed: 0, stored: 0 };
    }

    // Get all historical data (paginated)
    const allPastData: any[] = [];
    offset = 0;
    while (true) {
      const { data: pageData } = await this.supabase
        .from('realtor_county')
        .select('county_fips, median_listing_price')
        .gte('period_date', pastDateStr)
        .lte('period_date', pastDateMax)
        .not('median_listing_price', 'is', null)
        .order('period_date', { ascending: true })
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (!pageData || pageData.length === 0) break;
      allPastData.push(...pageData);
      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    const pastByRegion: Record<string, number> = {};
    for (const row of allPastData) {
      if (!pastByRegion[row.county_fips]) {
        pastByRegion[row.county_fips] = row.median_listing_price;
      }
    }

    // Batch upsert for better performance
    let stored = 0;
    const batchSize = 100;
    const recordsToUpsert: any[] = [];

    for (const county of allCurrentData) {
      const pastValue = pastByRegion[county.county_fips];
      if (!pastValue || pastValue === 0) continue;

      const cagr = calculateCAGR(pastValue, county.median_listing_price, 5);
      recordsToUpsert.push({
        geography_id: county.county_fips,
        geography_type: 'county',
        geography_name: county.county_name,
        period_date: targetDate,
        home_value_5yr_cagr: cagr,
        calculated_at: new Date().toISOString(),
      });

      // Batch upsert
      if (recordsToUpsert.length >= batchSize) {
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, {
            onConflict: 'geography_id,geography_type,period_date',
          });
        if (!error) stored += recordsToUpsert.length;
        recordsToUpsert.length = 0;
      }
    }

    // Upsert remaining records
    if (recordsToUpsert.length > 0) {
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (!error) stored += recordsToUpsert.length;
    }

    return { processed: allCurrentData.length, stored };
  }

  /**
   * Calculate and store 5-year home value growth for all zip codes (paginated)
   */
  async calculate5YrGrowthForZips(): Promise<{
    processed: number;
    stored: number;
  }> {
    // Get current date
    const { data: latestDateRow } = await this.supabase
      .from('realtor_zip')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestDateRow?.period_date) {
      return { processed: 0, stored: 0 };
    }

    const targetDate = latestDateRow.period_date;
    const fiveYearsAgo = new Date(targetDate);
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const pastDateStr = fiveYearsAgo.toISOString().split('T')[0];
    const pastDateMax = new Date(
      fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .split('T')[0];

    // Get all current data (paginated)
    const allCurrentData: any[] = [];
    let offset = 0;
    while (true) {
      const { data: pageData } = await this.supabase
        .from('realtor_zip')
        .select('postal_code, zip_name, median_listing_price')
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null)
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (!pageData || pageData.length === 0) break;
      allCurrentData.push(...pageData);
      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    if (allCurrentData.length === 0) {
      return { processed: 0, stored: 0 };
    }

    // Get all historical data (paginated)
    const allPastData: any[] = [];
    offset = 0;
    while (true) {
      const { data: pageData } = await this.supabase
        .from('realtor_zip')
        .select('postal_code, median_listing_price')
        .gte('period_date', pastDateStr)
        .lte('period_date', pastDateMax)
        .not('median_listing_price', 'is', null)
        .order('period_date', { ascending: true })
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (!pageData || pageData.length === 0) break;
      allPastData.push(...pageData);
      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    const pastByRegion: Record<string, number> = {};
    for (const row of allPastData) {
      const key = normalizeZipKey(String(row.postal_code));
      if (!pastByRegion[key]) {
        pastByRegion[key] = row.median_listing_price;
      }
    }

    // Batch upsert
    let stored = 0;
    const batchSize = 100;
    const recordsToUpsert: any[] = [];

    for (const zip of allCurrentData) {
      const zipKey = normalizeZipKey(String(zip.postal_code));
      const pastValue = pastByRegion[zipKey];
      if (!pastValue || pastValue === 0) continue;

      const cagr = calculateCAGR(pastValue, zip.median_listing_price, 5);
      recordsToUpsert.push({
        geography_id: zipKey,
        geography_type: 'zip',
        geography_name: zip.zip_name,
        period_date: targetDate,
        home_value_5yr_cagr: cagr,
        calculated_at: new Date().toISOString(),
      });

      if (recordsToUpsert.length >= batchSize) {
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, {
            onConflict: 'geography_id,geography_type,period_date',
          });
        if (!error) stored += recordsToUpsert.length;
        recordsToUpsert.length = 0;
      }
    }

    if (recordsToUpsert.length > 0) {
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (!error) stored += recordsToUpsert.length;
    }

    return { processed: allCurrentData.length, stored };
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

  /**
   * Calculate 5-year growth for all geographies
   */
  async calculate5YrGrowthForAll(year?: number): Promise<{
    metros: { processed: number; stored: number };
    states: { processed: number; stored: number };
    counties: { processed: number; stored: number };
    zips: { processed: number; stored: number };
    national: { processed: number; stored: number };
  }> {
    const [metros, states, counties, zips, national] = await Promise.all([
      this.calculate5YrGrowthForMetros(year),
      this.calculate5YrGrowthForStates(year),
      this.calculate5YrGrowthForCounties(),
      this.calculate5YrGrowthForZips(),
      this.calculate5YrGrowthForNational(year),
    ]);

    return { metros, states, counties, zips, national };
  }

  /**
   * Get pre-calculated 5-year growth data for map display
   */
  async get5YrGrowthForMap(
    geographyType: 'metro' | 'state' | 'county' | 'zip' | 'national',
  ): Promise<{ data: any[]; success: boolean; source: string }> {
    // Get the latest period_date for this geography type
    const { data: latestRow } = await this.supabase
      .from('calculated_metrics')
      .select('period_date')
      .eq('geography_type', geographyType)
      .not('home_value_5yr_cagr', 'is', null)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestRow?.period_date) {
      return { data: [], success: false, source: 'calculated_metrics' };
    }

    // Get all data for that period (paginated for large datasets)
    const allData: any[] = [];
    let offset = 0;

    while (true) {
      const { data: pageData } = await this.supabase
        .from('calculated_metrics')
        .select(
          'geography_id, geography_name, home_value_5yr_cagr, period_date',
        )
        .eq('geography_type', geographyType)
        .eq('period_date', latestRow.period_date)
        .not('home_value_5yr_cagr', 'is', null)
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (!pageData || pageData.length === 0) break;
      allData.push(...pageData);
      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

    // Transform to API format
    const results = allData.map((row) => ({
      region_id: row.geography_id,
      region_name: row.geography_name,
      value: row.home_value_5yr_cagr,
      cagr_5yr: row.home_value_5yr_cagr,
      date: row.period_date,
      // Add geo-specific fields for key matching
      ...(geographyType === 'metro' ? { cbsa_code: row.geography_id } : {}),
      ...(geographyType === 'county' ? { county_fips: row.geography_id } : {}),
      ...(geographyType === 'zip' ? { postal_code: row.geography_id } : {}),
    }));

    return { data: results, success: true, source: 'calculated_metrics' };
  }

  // ============================================================================
  // INVESTMENT METRICS BATCH CALCULATION
  // ============================================================================

  /**
   * Months-of-supply proxy inputs from Realtor: active_listing_count and
   * pending_listing_count (pending used as the monthly-sales proxy, since
   * Realtor has no closed-sales column). Returns Map<regionId, {active, pending}>
   * for the latest Realtor period at the given geo level.
   * metro -> realtor_metro keyed by cbsa_code; county -> realtor_county by county_fips;
   * zip -> realtor_zip by postal_code.
   */
  private async fetchRealtorMosInputs(
    geoLevel: 'metro' | 'county' | 'zip',
  ): Promise<Map<string, { active: number; pending: number }>> {
    const table = `realtor_${geoLevel}`;
    const idCol =
      geoLevel === 'metro'
        ? 'cbsa_code'
        : geoLevel === 'county'
          ? 'county_fips'
          : 'postal_code';
    const { data: latest } = await this.supabase
      .from(table)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    const out = new Map<string, { active: number; pending: number }>();
    if (!latest?.period_date) return out;
    let from = 0;
    const page = 1000;
    while (true) {
      const { data, error } = await this.supabase
        .from(table)
        .select(`${idCol}, active_listing_count, pending_listing_count`)
        .eq('period_date', latest.period_date)
        .range(from, from + page - 1);
      if (error)
        throw new Error(`${table} MOS inputs failed: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const r of data as any[]) {
        const id = r[idCol];
        if (!id) continue;
        const active = r.active_listing_count;
        const pending = r.pending_listing_count;
        if (active == null || pending == null) continue;
        out.set(String(id), {
          active: Number(active),
          pending: Number(pending),
        });
      }
      if (data.length < page) break;
      from += page;
    }
    return out;
  }

  /**
   * Calculate and store investment metrics (cap_rate, gross_yield, rent_to_price, grm) for all metros
   * Combines Zillow ZORI data with Realtor median_listing_price
   */
  async calculateInvestmentMetricsForMetros(year?: number): Promise<{
    processed: number;
    stored: number;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Get ALL unique ZORI dates (descending)
    const { data: zoriDates } = await this.supabase
      .from('zillow_metro')
      .select('period_date')
      .eq('metric_name', 'zori')
      .order('period_date', { ascending: false });

    let uniqueDates = Array.from(
      new Set(zoriDates?.map((d) => d.period_date) || []),
    );

    if (year) {
      console.log(
        `[CalculatedMetrics] Filtering investment metrics (metros) for year: ${year}`,
      );
      uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
    }

    let totalProcessed = 0;
    let totalStored = 0;

    // Fetch MOS inputs once for the latest Realtor metro period. MOS/absorption
    // are only stamped onto the latest period's rows (uniqueDates is descending),
    // and only when a real value is computable — never null, never historical —
    // so historical rows and any per-period MOS from other sources are preserved.
    const metroMosInputs = await this.fetchRealtorMosInputs('metro');
    // MOS is stamped only on the newest row per geo; it carries the latest Realtor active/pending (ZORI month-end and Realtor month-start are the same calendar month in practice).
    const latestMosDate = uniqueDates[0];

    for (const targetDate of uniqueDates) {
      // Get ZORI (rent) data for all metros from zillow_metro table
      // Paginated ZORI fetch for metros
      const zoriData: any[] = [];
      let zoriOff = 0;
      while (true) {
        const { data: page, error: zoriError } = await this.supabase
          .from('zillow_metro')
          .select('region_id, region_name, value, cbsa_code')
          .eq('metric_name', 'zori')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(zoriOff, zoriOff + 1999);
        if (zoriError) {
          errors.push(`${targetDate}: ${zoriError.message}`);
          break;
        }
        if (!page || page.length === 0) break;
        zoriData.push(...page);
        if (page.length < 2000) break;
        zoriOff += 2000;
      }

      if (zoriData.length === 0) {
        continue;
      }

      // Get ZHVI (value) data for all metros (paginated)
      const zhviDataAll: any[] = [];
      let zhviOff = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('zillow_metro')
          .select('region_id, value, cbsa_code, region_name')
          .eq('metric_name', 'zhvi')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(zhviOff, zhviOff + 1999);
        if (!page || page.length === 0) break;
        zhviDataAll.push(...page);
        if (page.length < 2000) break;
        zhviOff += 2000;
      }

      // Fallback if exact date match fails (ZHVI might be updated at different cadence)
      const zhviRows: Array<{
        region_id: number;
        value: number;
        cbsa_code: string | null;
        region_name: string | null;
      }> = zhviDataAll;
      if (zhviRows.length === 0) {
        const { data: zhviDateRow } = await this.supabase
          .from('zillow_metro')
          .select('period_date')
          .eq('metric_name', 'zhvi')
          .lte('period_date', targetDate)
          .order('period_date', { ascending: false })
          .limit(1)
          .single();

        if (zhviDateRow?.period_date) {
          let fbOff = 0;
          while (true) {
            const { data: page } = await this.supabase
              .from('zillow_metro')
              .select('region_id, value, cbsa_code, region_name')
              .eq('metric_name', 'zhvi')
              .eq('period_date', zhviDateRow.period_date)
              .not('value', 'is', null)
              .range(fbOff, fbOff + 1999);
            if (!page || page.length === 0) break;
            zhviRows.push(...page);
            if (page.length < 2000) break;
            fbOff += 2000;
          }
        }
      }

      // Build price lookup by CBSA code (from matched or fallback ZHVI date)
      const priceByCode: Record<string, number> = {};
      for (const row of zhviRows) {
        if (row.cbsa_code && row.value) {
          priceByCode[row.cbsa_code] = row.value;
        }
      }

      // ── Fetch ZORI history for YoY and 5yr CAGR ──
      const oneYearAgo = new Date(targetDate);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
      const oneYearAgoMax = new Date(
        oneYearAgo.getTime() + 60 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .split('T')[0];

      const fiveYearsAgo = new Date(targetDate);
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const fiveYearsAgoStr = fiveYearsAgo.toISOString().split('T')[0];
      const fiveYearsAgoMax = new Date(
        fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .split('T')[0];

      // ZORI 1 year ago (for YoY)
      const zoriPast1yr: Record<string, number> = {};
      const { data: zori1yrData } = await this.supabase
        .from('zillow_metro')
        .select('cbsa_code, value')
        .eq('metric_name', 'zori')
        .gte('period_date', oneYearAgoStr)
        .lte('period_date', oneYearAgoMax)
        .not('value', 'is', null)
        .order('period_date', { ascending: false });
      if (zori1yrData) {
        for (const r of zori1yrData) {
          if (r.cbsa_code && !zoriPast1yr[r.cbsa_code])
            zoriPast1yr[r.cbsa_code] = r.value;
        }
      }

      // ZORI 5 years ago (for 5yr CAGR)
      const zoriPast5yr: Record<string, number> = {};
      const { data: zori5yrData } = await this.supabase
        .from('zillow_metro')
        .select('cbsa_code, value')
        .eq('metric_name', 'zori')
        .gte('period_date', fiveYearsAgoStr)
        .lte('period_date', fiveYearsAgoMax)
        .not('value', 'is', null)
        .order('period_date', { ascending: false });
      if (zori5yrData) {
        for (const r of zori5yrData) {
          if (r.cbsa_code && !zoriPast5yr[r.cbsa_code])
            zoriPast5yr[r.cbsa_code] = r.value;
        }
      }

      // Calculate and batch upsert
      let storedInBatch = 0;
      const batchSize = 100;
      let recordsToUpsert: any[] = [];

      for (const metro of zoriData) {
        const cbsaCode = metro.cbsa_code;
        const zori = metro.value;
        const price = cbsaCode ? priceByCode[cbsaCode] : null;

        if (!zori || !price) continue;

        const capRate = calculateCapRate(zori, price);
        const grossYield = calculateGrossYield(zori, price);
        const rentToPriceRatio = calculateRentToPriceRatio(zori, price);
        const grm = calculateGRM(price, zori);

        // Rent growth metrics
        const pastRent1yr = cbsaCode ? zoriPast1yr[cbsaCode] : null;
        const zoriYoy =
          pastRent1yr && pastRent1yr > 0
            ? Math.round(((zori - pastRent1yr) / pastRent1yr) * 10000) / 100
            : null;

        const pastRent5yr = cbsaCode ? zoriPast5yr[cbsaCode] : null;
        const zori5yCagr =
          pastRent5yr && pastRent5yr > 0
            ? Math.round(calculateCAGR(pastRent5yr, zori, 5)! * 100) / 100
            : null;

        const metroRec: any = {
          geography_id: cbsaCode,
          geography_type: 'metro',
          geography_name: metro.region_name,
          period_date: targetDate,
          cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
          gross_yield: grossYield ? Math.round(grossYield * 100) / 100 : null,
          rent_to_price_ratio: rentToPriceRatio
            ? Math.round(rentToPriceRatio * 10000) / 10000
            : null,
          grm: grm ? Math.round(grm * 100) / 100 : null,
          zori_yoy: zoriYoy,
          zori_5y_cagr: zori5yCagr,
          calculated_at: new Date().toISOString(),
        };
        if (latestMosDate != null && targetDate === latestMosDate) {
          const m = metroMosInputs.get(String(cbsaCode));
          const mos = m ? calculateMonthsOfSupply(m.active, m.pending) : null;
          if (m && mos != null) {
            metroRec.months_of_supply = mos;
            metroRec.absorption_rate = calculateAbsorptionRate(
              m.pending,
              m.active,
            );
          }
        }
        recordsToUpsert.push(metroRec);

        if (recordsToUpsert.length >= batchSize) {
          const { error } = await this.supabase
            .from('calculated_metrics')
            .upsert(recordsToUpsert, {
              onConflict: 'geography_id,geography_type,period_date',
            });
          if (error) {
            errors.push(`${targetDate}: ${error.message}`);
          } else {
            storedInBatch += recordsToUpsert.length;
          }
          recordsToUpsert = [];
        }
      }

      // Upsert remaining
      if (recordsToUpsert.length > 0) {
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, {
            onConflict: 'geography_id,geography_type,period_date',
          });
        if (error) {
          errors.push(`${targetDate}: ${error.message}`);
        } else {
          storedInBatch += recordsToUpsert.length;
        }
      }

      totalProcessed += zoriData.length;
      totalStored += storedInBatch;

      // ── HUD FMR FALLBACK for metros without ZORI ──
      // Identify CBSA codes that have ZHVI but were not covered by ZORI
      const zoriCbsas = new Set(
        zoriData.map((m) => m.cbsa_code).filter(Boolean),
      );
      const cbsasWithZhviOnly = Object.keys(priceByCode).filter(
        (cbsa) => !zoriCbsas.has(cbsa),
      );

      if (cbsasWithZhviOnly.length > 0) {
        const targetYear = parseInt(targetDate.substring(0, 4));

        // Get ZHVI metro names for these CBSAs
        const nameByCode: Record<string, string> = {};
        for (const row of zhviRows) {
          if (row.cbsa_code && row.region_name) {
            nameByCode[row.cbsa_code] = row.region_name;
          }
        }

        // Look up component counties for these metros (paginated)
        const countyRows: any[] = [];
        let cOff = 0;
        while (true) {
          const { data: page } = await this.supabase
            .from('geographies')
            .select('cbsa_code, fips_code, population')
            .eq('geography_type', 'county')
            .in('cbsa_code', cbsasWithZhviOnly)
            .not('fips_code', 'is', null)
            .range(cOff, cOff + 1999);
          if (!page || page.length === 0) break;
          countyRows.push(...page);
          if (page.length < 2000) break;
          cOff += 2000;
        }

        if (countyRows.length > 0) {
          // Group counties by CBSA
          const countiesByCbsa: Record<
            string,
            Array<{ fips: string; population: number | null }>
          > = {};
          for (const c of countyRows) {
            if (!c.cbsa_code || !c.fips_code) continue;
            if (!countiesByCbsa[c.cbsa_code]) countiesByCbsa[c.cbsa_code] = [];
            countiesByCbsa[c.cbsa_code].push({
              fips: String(parseInt(c.fips_code, 10)).padStart(5, '0'),
              population: c.population,
            });
          }

          // Fetch HUD FMR for the target year, previous year (YoY), and 5 years ago (CAGR)
          const allFips = countyRows
            .map((c) =>
              c.fips_code
                ? String(parseInt(c.fips_code, 10)).padStart(5, '0')
                : null,
            )
            .filter(Boolean) as string[];

          const fmrYears = [targetYear, targetYear - 1, targetYear - 5];
          const fmrByYearAndFips: Record<number, Record<string, number>> = {};

          for (const fmrYear of fmrYears) {
            fmrByYearAndFips[fmrYear] = {};
            let fmrOff = 0;
            while (true) {
              const { data: page } = await this.supabase
                .from('hud_fmr')
                .select('fips_code, fmr_2br')
                .eq('year', fmrYear)
                .in('fips_code', allFips)
                .not('fmr_2br', 'is', null)
                .range(fmrOff, fmrOff + 1999);
              if (!page || page.length === 0) break;
              for (const r of page) {
                const fips =
                  r.fips_code && /^\d+$/.test(r.fips_code)
                    ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                    : r.fips_code;
                if (fips && r.fmr_2br != null) {
                  fmrByYearAndFips[fmrYear][fips] = r.fmr_2br;
                }
              }
              if (page.length < 2000) break;
              fmrOff += 2000;
            }
          }

          const fmrByFips = fmrByYearAndFips[targetYear];

          if (Object.keys(fmrByFips).length > 0) {
            // Helper: compute population-weighted average FMR for a metro from county FMR data
            const computeWeightedFmr = (
              cbsa: string,
              fmrLookup: Record<string, number>,
            ): number | null => {
              const counties = countiesByCbsa[cbsa];
              if (!counties || counties.length === 0) return null;
              let totalRent = 0;
              let totalWeight = 0;
              for (const county of counties) {
                const fmr = fmrLookup[county.fips];
                if (fmr == null || fmr <= 0) continue;
                const weight = county.population ?? 1;
                totalRent += fmr * weight;
                totalWeight += weight;
              }
              return totalWeight > 0 ? totalRent / totalWeight : null;
            };

            // For each metro without ZORI, compute investment metrics + rent growth proxies
            const hudMetroUpsert: any[] = [];
            for (const cbsa of cbsasWithZhviOnly) {
              const avgRent = computeWeightedFmr(cbsa, fmrByFips);
              if (!avgRent) continue;

              const price = priceByCode[cbsa];
              if (!price) continue;

              const capRate = calculateCapRate(avgRent, price);
              const grossYield = calculateGrossYield(avgRent, price);
              const rentToPriceRatio = calculateRentToPriceRatio(
                avgRent,
                price,
              );
              const grm = calculateGRM(price, avgRent);

              // HUD FMR rent growth proxies
              const avgRentPrevYear = computeWeightedFmr(
                cbsa,
                fmrByYearAndFips[targetYear - 1],
              );
              const hudZoriYoy =
                avgRentPrevYear && avgRentPrevYear > 0
                  ? Math.round(
                      ((avgRent - avgRentPrevYear) / avgRentPrevYear) * 10000,
                    ) / 100
                  : null;

              const avgRent5yrAgo = computeWeightedFmr(
                cbsa,
                fmrByYearAndFips[targetYear - 5],
              );
              const hudZori5yCagr =
                avgRent5yrAgo && avgRent5yrAgo > 0
                  ? Math.round(
                      calculateCAGR(avgRent5yrAgo, avgRent, 5)! * 100,
                    ) / 100
                  : null;

              const hudMetroRec: any = {
                geography_id: cbsa,
                geography_type: 'metro',
                geography_name: nameByCode[cbsa] || `Metro ${cbsa}`,
                period_date: targetDate,
                cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
                gross_yield: grossYield
                  ? Math.round(grossYield * 100) / 100
                  : null,
                rent_to_price_ratio: rentToPriceRatio
                  ? Math.round(rentToPriceRatio * 10000) / 10000
                  : null,
                grm: grm ? Math.round(grm * 100) / 100 : null,
                zori_yoy: hudZoriYoy,
                zori_5y_cagr: hudZori5yCagr,
                calculated_at: new Date().toISOString(),
              };
              if (latestMosDate != null && targetDate === latestMosDate) {
                const m = metroMosInputs.get(String(cbsa));
                const mos = m
                  ? calculateMonthsOfSupply(m.active, m.pending)
                  : null;
                if (m && mos != null) {
                  hudMetroRec.months_of_supply = mos;
                  hudMetroRec.absorption_rate = calculateAbsorptionRate(
                    m.pending,
                    m.active,
                  );
                }
              }
              hudMetroUpsert.push(hudMetroRec);
            }

            if (hudMetroUpsert.length > 0) {
              const { error } = await this.supabase
                .from('calculated_metrics')
                .upsert(hudMetroUpsert, {
                  onConflict: 'geography_id,geography_type,period_date',
                });
              if (error) {
                errors.push(
                  `${targetDate} HUD metro fallback: ${error.message}`,
                );
              } else {
                totalStored += hudMetroUpsert.length;
              }
              console.log(
                `[CalculatedMetrics] HUD FMR metro fallback: ${hudMetroUpsert.length} metros for ${targetDate}`,
              );
            }
          }
        }
      }
    }

    return { processed: totalProcessed, stored: totalStored, errors };
  }

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
   * Get pre-calculated investment metrics for map display
   * Uses pagination to fetch all records (Supabase default limit is 1000)
   */
  async getInvestmentMetricsForMap(
    metricName:
      | 'cap_rate'
      | 'gross_yield'
      | 'rent_to_price_ratio'
      | 'grm'
      | 'overvalued_pct'
      | 'months_of_supply'
      | 'absorption_rate'
      | 'renter_demand_index',
    geographyType: 'metro' | 'county' | 'zip' | 'state' | 'national' = 'metro',
  ): Promise<{ data: any[]; success: boolean; source: string }> {
    // Get the 3 most recent distinct period_dates for this metric
    // (ZORI, ZHVI, Realtor, HUD data may arrive on different dates)
    const uniqueRecentDates: string[] = [];
    let dateCursor: string | null = null;
    for (let i = 0; i < 3; i++) {
      const q = this.supabase
        .from('calculated_metrics')
        .select('period_date')
        .eq('geography_type', geographyType)
        .not(metricName, 'is', null);
      if (dateCursor) q.lt('period_date', dateCursor);
      const { data: dateRow } = await q
        .order('period_date', { ascending: false })
        .limit(1)
        .single();
      if (!dateRow?.period_date) break;
      uniqueRecentDates.push(dateRow.period_date);
      dateCursor = dateRow.period_date;
    }

    if (uniqueRecentDates.length === 0) {
      return { data: [], success: false, source: 'calculated_metrics' };
    }

    // Fetch data from the most recent dates (paginated), keeping latest per geography
    const dataByGeoId: Record<string, any> = {};

    for (const periodDate of uniqueRecentDates) {
      let offset = 0;
      while (true) {
        const { data: pageData, error } = await this.supabase
          .from('calculated_metrics')
          .select(`geography_id, geography_name, ${metricName}, period_date`)
          .eq('geography_type', geographyType)
          .eq('period_date', periodDate)
          .not(metricName, 'is', null)
          .range(offset, offset + this.PAGE_SIZE - 1);

        if (error || !pageData || pageData.length === 0) break;

        for (const row of pageData) {
          // Only keep the latest value per geography (dates are iterated newest-first)
          if (!dataByGeoId[row.geography_id]) {
            dataByGeoId[row.geography_id] = row;
          }
        }

        if (pageData.length < this.PAGE_SIZE) break;
        offset += this.PAGE_SIZE;
      }
    }

    const allData = Object.values(dataByGeoId);

    if (allData.length === 0) {
      return { data: [], success: false, source: 'calculated_metrics' };
    }

    // Transform to API format
    const results = allData.map((row) => ({
      region_id: row.geography_id,
      region_name: row.geography_name,
      value: row[metricName],
      [metricName]: row[metricName],
      date: row.period_date,
      // Add geo-specific fields for key matching
      ...(geographyType === 'metro' ? { cbsa_code: row.geography_id } : {}),
      ...(geographyType === 'county' ? { county_fips: row.geography_id } : {}),
      ...(geographyType === 'zip' ? { postal_code: row.geography_id } : {}),
    }));

    return { data: results, success: true, source: 'calculated_metrics' };
  }

  /**
   * Calculate and store investment metrics (cap_rate, gross_yield, rent_to_price, grm) for all counties
   */
  async calculateInvestmentMetricsForCounties(year?: number): Promise<{
    processed: number;
    stored: number;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Get ALL unique ZORI dates from zillow_county table matches
    const { data: zoriDates } = await this.supabase
      .from('zillow_county')
      .select('period_date')
      .eq('metric_name', 'zori')
      .order('period_date', { ascending: false });

    let uniqueDates = Array.from(
      new Set(zoriDates?.map((d) => d.period_date) || []),
    );

    if (year) {
      uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
    }

    let totalProcessed = 0;
    let totalStored = 0;

    // Fetch MOS inputs once for the latest Realtor county period. MOS/absorption
    // are only stamped onto the latest period's rows (uniqueDates is descending),
    // and only when a real value is computable — never null, never historical —
    // so historical rows and any per-period MOS from other sources are preserved.
    const countyMosInputs = await this.fetchRealtorMosInputs('county');
    // MOS is stamped only on the newest row per geo; it carries the latest Realtor active/pending (ZORI month-end and Realtor month-start are the same calendar month in practice).
    const latestCountyMosDate = uniqueDates[0];

    for (const targetDate of uniqueDates) {
      // Get ZORI (rent) data for all counties (paginated)
      const zoriData: any[] = [];
      let zoriOffset = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('zillow_county')
          .select('region_id, region_name, value, fips_code')
          .eq('metric_name', 'zori')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(zoriOffset, zoriOffset + 1999);
        if (!page || page.length === 0) break;
        zoriData.push(...page);
        if (page.length < 2000) break;
        zoriOffset += 2000;
      }

      if (zoriData.length === 0) {
        // Skip dates with no data (common if ZORI is less frequent)
        continue;
      }

      // Get ZHVI data (property value) for all counties (paginated)
      const zhviData: any[] = [];
      let zhviOffset = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('zillow_county')
          .select('region_id, region_name, value, fips_code')
          .eq('metric_name', 'zhvi')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(zhviOffset, zhviOffset + 1999);
        if (!page || page.length === 0) break;
        zhviData.push(...page);
        if (page.length < 2000) break;
        zhviOffset += 2000;
      }

      // Build price and name lookups by FIPS (5-digit normalized)
      const priceByCode: Record<string, number> = {};
      const nameByCode: Record<string, string> = {};
      const normalizeFips = (f: string | null | undefined) =>
        f && /^\d+$/.test(f) ? String(parseInt(f, 10)).padStart(5, '0') : f;
      if (zhviData) {
        for (const row of zhviData) {
          const fips = normalizeFips(row.fips_code);
          if (fips && row.value) {
            priceByCode[fips] = row.value;
            if (row.region_name) nameByCode[fips] = row.region_name;
          }
        }
      }

      const countyFipsWithZori = new Set(
        zoriData.map((c) => normalizeFips(c.fips_code)).filter(Boolean),
      );

      // Calculate and batch upsert (ZORI-based)
      let storedInBatch = 0;
      const batchSize = 100;
      let recordsToUpsert: any[] = [];
      const processedFipsThisDate = new Set<string>();

      for (const county of zoriData) {
        const fipsCode = normalizeFips(county.fips_code);
        if (!fipsCode || processedFipsThisDate.has(fipsCode)) continue;
        processedFipsThisDate.add(fipsCode);
        const zori = county.value;
        const price = priceByCode[fipsCode];

        if (!zori || !price) continue;

        const capRate = calculateCapRate(zori, price);
        const grossYield = calculateGrossYield(zori, price);
        const rentToPriceRatio = calculateRentToPriceRatio(zori, price);
        const grm = calculateGRM(price, zori);

        const countyRec: any = {
          geography_id: fipsCode,
          geography_type: 'county',
          geography_name: county.region_name,
          period_date: targetDate,
          cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
          gross_yield: grossYield ? Math.round(grossYield * 100) / 100 : null,
          rent_to_price_ratio: rentToPriceRatio
            ? Math.round(rentToPriceRatio * 10000) / 10000
            : null,
          grm: grm ? Math.round(grm * 100) / 100 : null,
          calculated_at: new Date().toISOString(),
        };
        if (latestCountyMosDate != null && targetDate === latestCountyMosDate) {
          const m = countyMosInputs.get(String(fipsCode));
          const mos = m ? calculateMonthsOfSupply(m.active, m.pending) : null;
          if (m && mos != null) {
            countyRec.months_of_supply = mos;
            countyRec.absorption_rate = calculateAbsorptionRate(
              m.pending,
              m.active,
            );
          }
        }
        recordsToUpsert.push(countyRec);

        if (recordsToUpsert.length >= batchSize) {
          const { error } = await this.supabase
            .from('calculated_metrics')
            .upsert(recordsToUpsert, {
              onConflict: 'geography_id,geography_type,period_date',
            });
          if (error) {
            errors.push(`${targetDate}: ${error.message}`);
          } else {
            storedInBatch += recordsToUpsert.length;
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
          errors.push(`${targetDate}: ${error.message}`);
        } else {
          storedInBatch += recordsToUpsert.length;
        }
      }

      // County fallback logic skipped inside loop for brevity unless critical?
      // The original code had HUD FMR fallback. I should include it.
      // But HUD FMR is annual. Doing it for EVERY month in history might be redundant/slow if data doesn't change.
      // However, if we filter by year, we can run it once per year if targetDate is relevant?
      // Or just include it. The original code ran it for the single Latest Date.
      // If I run history, I should ideally match HUD year to targetDate year.
      // Original code Logic: `const { data: latestYearRow } = ... limit(1)`.
      // I will adapt HUD logic to find FMR for `targetDate.getFullYear()`.

      const targetYear = parseInt(targetDate.substring(0, 4));

      const fipsWithZhviOnly = Object.keys(priceByCode).filter(
        (fips) => !countyFipsWithZori.has(fips),
      );

      if (fipsWithZhviOnly.length > 0) {
        // Fetch HUD for targetYear
        // Check if data exists for this year
        const { data: fmrRows } = await this.supabase
          .from('hud_fmr')
          .select('fips_code, fmr_2br, county_name')
          .eq('year', targetYear)
          .not('fmr_2br', 'is', null);

        if (fmrRows && fmrRows.length > 0) {
          const fmrByFips: Record<string, { rent: number; name?: string }> = {};
          for (const r of fmrRows) {
            const fips = normalizeFips(r.fips_code);
            if (fips && r.fmr_2br != null) {
              fmrByFips[fips] = {
                rent: r.fmr_2br,
                name: r.county_name ?? undefined,
              };
            }
          }

          const hudUpsert: any[] = [];
          for (const fips of fipsWithZhviOnly) {
            if (processedFipsThisDate.has(fips)) continue;
            const fmr = fmrByFips[fips];
            const price = priceByCode[fips];
            if (!fmr || !price || fmr.rent <= 0) continue;
            processedFipsThisDate.add(fips);

            const capRate = calculateCapRate(fmr.rent, price);
            const grossYield = calculateGrossYield(fmr.rent, price);
            const rentToPriceRatio = calculateRentToPriceRatio(fmr.rent, price);
            const grm = calculateGRM(price, fmr.rent);

            const hudCountyRec: any = {
              geography_id: fips,
              geography_type: 'county',
              geography_name: fmr.name || nameByCode[fips] || `County ${fips}`,
              period_date: targetDate,
              cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
              gross_yield: grossYield
                ? Math.round(grossYield * 100) / 100
                : null,
              rent_to_price_ratio: rentToPriceRatio
                ? Math.round(rentToPriceRatio * 10000) / 10000
                : null,
              grm: grm ? Math.round(grm * 100) / 100 : null,
              calculated_at: new Date().toISOString(),
            };
            if (
              latestCountyMosDate != null &&
              targetDate === latestCountyMosDate
            ) {
              const m = countyMosInputs.get(String(fips));
              const mos = m
                ? calculateMonthsOfSupply(m.active, m.pending)
                : null;
              if (m && mos != null) {
                hudCountyRec.months_of_supply = mos;
                hudCountyRec.absorption_rate = calculateAbsorptionRate(
                  m.pending,
                  m.active,
                );
              }
            }
            hudUpsert.push(hudCountyRec);
          }

          if (hudUpsert.length > 0) {
            // Batch HUD upsert if large? usually small subset?
            // Counties are ~3000. Just upsert all is fine or batch 1000.
            const { error } = await this.supabase
              .from('calculated_metrics')
              .upsert(hudUpsert, {
                onConflict: 'geography_id,geography_type,period_date',
              });
            if (!error) storedInBatch += hudUpsert.length;
          }
        }
      }

      totalProcessed += zoriData.length;
      totalStored += storedInBatch;
    }

    // ── REALTOR LISTING PRICE FALLBACK for counties without Zillow ZHVI ──
    // Counties that have Realtor median_listing_price + HUD FMR but no Zillow data
    // Use the latest ZORI date as the stored period_date so all data aligns for map queries
    const latestZoriTargetDate = uniqueDates.length > 0 ? uniqueDates[0] : null;
    try {
      // Get latest Realtor county data
      const { data: realtorLatest } = await this.supabase
        .from('realtor_county')
        .select('period_date')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();

      if (realtorLatest?.period_date) {
        const realtorDate = realtorLatest.period_date;
        const realtorYear = parseInt(realtorDate.substring(0, 4));
        // Use ZORI date for storage to align with ZORI-based records on the map
        const storagePeriodDate = latestZoriTargetDate ?? realtorDate;

        // Get all Realtor county listing prices (paginated)
        const realtorCounties: any[] = [];
        let rcOff = 0;
        while (true) {
          const { data: page } = await this.supabase
            .from('realtor_county')
            .select('county_fips, county_name, median_listing_price')
            .eq('period_date', realtorDate)
            .not('median_listing_price', 'is', null)
            .not('county_fips', 'is', null)
            .range(rcOff, rcOff + 1999);
          if (!page || page.length === 0) break;
          realtorCounties.push(...page);
          if (page.length < 2000) break;
          rcOff += 2000;
        }

        if (realtorCounties.length > 0) {
          const normFips = (f: string | null | undefined) =>
            f && /^\d+$/.test(f) ? String(parseInt(f, 10)).padStart(5, '0') : f;

          // Find which FIPS already have calculated_metrics for the target date (paginated)
          const existingRows: any[] = [];
          let exOff = 0;
          while (true) {
            const { data: page } = await this.supabase
              .from('calculated_metrics')
              .select('geography_id')
              .eq('geography_type', 'county')
              .eq('period_date', storagePeriodDate)
              .not('cap_rate', 'is', null)
              .range(exOff, exOff + 1999);
            if (!page || page.length === 0) break;
            existingRows.push(...page);
            if (page.length < 2000) break;
            exOff += 2000;
          }

          const existingFips = new Set(existingRows.map((r) => r.geography_id));

          // Get HUD FMR for the Realtor year (paginated)
          const fmrRows: any[] = [];
          let fmrOff = 0;
          while (true) {
            const { data: page } = await this.supabase
              .from('hud_fmr')
              .select('fips_code, fmr_2br')
              .eq('year', realtorYear)
              .not('fmr_2br', 'is', null)
              .range(fmrOff, fmrOff + 1999);
            if (!page || page.length === 0) break;
            fmrRows.push(...page);
            if (page.length < 2000) break;
            fmrOff += 2000;
          }

          const fmrByFips: Record<string, number> = {};
          if (fmrRows.length > 0) {
            for (const r of fmrRows) {
              const fips = normFips(r.fips_code);
              if (fips && r.fmr_2br != null) fmrByFips[fips] = r.fmr_2br;
            }
          }

          // Also pull county ZORI as another rent option (might be fresher than HUD)
          const { data: latestZoriDate } = await this.supabase
            .from('zillow_county')
            .select('period_date')
            .eq('metric_name', 'zori')
            .order('period_date', { ascending: false })
            .limit(1)
            .single();

          const countyZoriByFips: Record<string, number> = {};
          if (latestZoriDate?.period_date) {
            // Paginated county ZORI fetch
            const zoriRows: any[] = [];
            let zrOff = 0;
            while (true) {
              const { data: page } = await this.supabase
                .from('zillow_county')
                .select('fips_code, value')
                .eq('metric_name', 'zori')
                .eq('period_date', latestZoriDate.period_date)
                .not('value', 'is', null)
                .range(zrOff, zrOff + 1999);
              if (!page || page.length === 0) break;
              zoriRows.push(...page);
              if (page.length < 2000) break;
              zrOff += 2000;
            }

            if (zoriRows.length > 0) {
              for (const r of zoriRows) {
                const fips = normFips(r.fips_code);
                if (fips && r.value) countyZoriByFips[fips] = r.value;
              }
            }
          }

          let realtorUpsert: any[] = [];
          let realtorCount = 0;
          const processedRealtorFips = new Set<string>();

          for (const county of realtorCounties) {
            const fips = normFips(county.county_fips);
            if (
              !fips ||
              existingFips.has(fips) ||
              processedRealtorFips.has(fips)
            )
              continue;
            processedRealtorFips.add(fips);

            const price = county.median_listing_price;
            if (!price || price <= 0) continue;

            // Use ZORI if available, otherwise HUD FMR
            const rent = countyZoriByFips[fips] ?? fmrByFips[fips];
            if (!rent || rent <= 0) continue;

            const capRate = calculateCapRate(rent, price);
            const grossYield = calculateGrossYield(rent, price);
            const rentToPriceRatio = calculateRentToPriceRatio(rent, price);
            const grm = calculateGRM(price, rent);

            const realtorCountyRec: any = {
              geography_id: fips,
              geography_type: 'county',
              geography_name: county.county_name || `County ${fips}`,
              period_date: storagePeriodDate,
              cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
              gross_yield: grossYield
                ? Math.round(grossYield * 100) / 100
                : null,
              rent_to_price_ratio: rentToPriceRatio
                ? Math.round(rentToPriceRatio * 10000) / 10000
                : null,
              grm: grm ? Math.round(grm * 100) / 100 : null,
              calculated_at: new Date().toISOString(),
            };
            if (
              latestCountyMosDate != null &&
              storagePeriodDate === latestCountyMosDate
            ) {
              const m = countyMosInputs.get(String(fips));
              const mos = m
                ? calculateMonthsOfSupply(m.active, m.pending)
                : null;
              if (m && mos != null) {
                realtorCountyRec.months_of_supply = mos;
                realtorCountyRec.absorption_rate = calculateAbsorptionRate(
                  m.pending,
                  m.active,
                );
              }
            }
            realtorUpsert.push(realtorCountyRec);

            if (realtorUpsert.length >= 500) {
              const { error } = await this.supabase
                .from('calculated_metrics')
                .upsert(realtorUpsert, {
                  onConflict: 'geography_id,geography_type,period_date',
                });
              if (!error) realtorCount += realtorUpsert.length;
              else errors.push(`Realtor county fallback: ${error.message}`);
              realtorUpsert = [];
            }
          }

          if (realtorUpsert.length > 0) {
            const { error } = await this.supabase
              .from('calculated_metrics')
              .upsert(realtorUpsert, {
                onConflict: 'geography_id,geography_type,period_date',
              });
            if (!error) realtorCount += realtorUpsert.length;
            else errors.push(`Realtor county fallback: ${error.message}`);
          }

          if (realtorCount > 0) {
            totalStored += realtorCount;
            console.log(
              `[CalculatedMetrics] Realtor county fallback: ${realtorCount} counties added`,
            );
          }
        }
      }
    } catch (e: any) {
      errors.push(`Realtor county fallback error: ${e.message}`);
    }

    return { processed: totalProcessed, stored: totalStored, errors };
  }

  /**
   * Calculate and store investment metrics for all ZIP codes
   */
  async calculateInvestmentMetricsForZips(year?: number): Promise<{
    processed: number;
    stored: number;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Get ALL unique ZORI dates from zillow_metro table as proxy
    const { data: zoriDates } = await this.supabase
      .from('zillow_metro')
      .select('period_date')
      .eq('metric_name', 'zori')
      .order('period_date', { ascending: false });

    let uniqueDates = Array.from(
      new Set(zoriDates?.map((d) => d.period_date) || []),
    );

    if (year) {
      uniqueDates = uniqueDates.filter((d) => d.startsWith(`${year}-`));
    }

    let totalProcessed = 0;
    let totalStored = 0;

    // Fetch MOS inputs once for the latest Realtor zip period. MOS/absorption
    // are only stamped onto the latest period's rows (uniqueDates is descending),
    // and only when a real value is computable — never null, never historical —
    // so historical rows and any per-period MOS from other sources are preserved.
    const zipMosInputs = await this.fetchRealtorMosInputs('zip');
    // MOS is stamped only on the newest row per geo; it carries the latest Realtor active/pending (ZORI month-end and Realtor month-start are the same calendar month in practice).
    const latestZipMosDate = uniqueDates[0];

    for (const targetDate of uniqueDates) {
      // Get ZHVI data for all zips (paginated)
      const zhviData: any[] = [];
      let zhviZipOff = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('zillow_zip')
          .select('region_name, value, county_fips')
          .eq('metric_name', 'zhvi')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(zhviZipOff, zhviZipOff + 4999);
        if (!page || page.length === 0) break;
        zhviData.push(...page);
        if (page.length < 5000) break;
        zhviZipOff += 5000;
      }

      if (zhviData.length === 0) {
        continue;
      }

      const priceByZip: Record<string, number> = {};
      const zipToCounty: Record<string, string> = {};
      const normalizeFipsZip = (f: string | null | undefined) =>
        f && /^\d+$/.test(f)
          ? String(parseInt(f, 10)).padStart(5, '0')
          : (f ?? null);

      for (const row of zhviData) {
        priceByZip[row.region_name] = row.value;
        if (row.county_fips) {
          const fips = normalizeFipsZip(row.county_fips);
          if (fips) zipToCounty[row.region_name] = fips;
        }
      }

      const zipsWithZori = new Set<string>();
      let offset = 0;
      const pageSize = 5000;

      // Fetch ZORI data for this date (paginated)
      while (true) {
        const { data: zoriData } = await this.supabase
          .from('zillow_zip')
          .select('region_id, region_name, value')
          .eq('metric_name', 'zori')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(offset, offset + pageSize - 1);

        if (!zoriData || zoriData.length === 0) break;

        const recordsToUpsert: any[] = [];
        const seenInBatch = new Set<string>();

        for (const zip of zoriData) {
          const zipCode = zip.region_name;
          zipsWithZori.add(zipCode);
          if (seenInBatch.has(zipCode)) continue;
          seenInBatch.add(zipCode);
          const zori = zip.value;
          const price = priceByZip[zipCode];

          if (!zori || !price) continue;

          const capRate = calculateCapRate(zori, price);
          const grossYield = calculateGrossYield(zori, price);
          const rentToPriceRatio = calculateRentToPriceRatio(zori, price);
          const grm = calculateGRM(price, zori);

          const zipRec: any = {
            geography_id: zipCode,
            geography_type: 'zip',
            geography_name: zipCode,
            period_date: targetDate,
            cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
            gross_yield: grossYield ? Math.round(grossYield * 100) / 100 : null,
            rent_to_price_ratio: rentToPriceRatio
              ? Math.round(rentToPriceRatio * 10000) / 10000
              : null,
            grm: grm ? Math.round(grm * 100) / 100 : null,
            calculated_at: new Date().toISOString(),
          };
          if (latestZipMosDate != null && targetDate === latestZipMosDate) {
            const m = zipMosInputs.get(String(zipCode));
            const mos = m ? calculateMonthsOfSupply(m.active, m.pending) : null;
            if (m && mos != null) {
              zipRec.months_of_supply = mos;
              zipRec.absorption_rate = calculateAbsorptionRate(
                m.pending,
                m.active,
              );
            }
          }
          recordsToUpsert.push(zipRec);
        }

        if (recordsToUpsert.length > 0) {
          const { error } = await this.supabase
            .from('calculated_metrics')
            .upsert(recordsToUpsert, {
              onConflict: 'geography_id,geography_type,period_date',
            });
          if (error) {
            errors.push(`${targetDate}: ${error.message}`);
          } else {
            totalStored += recordsToUpsert.length;
          }
        }

        totalProcessed += zoriData.length;

        if (zoriData.length < pageSize) break;
        offset += pageSize;
      }

      // ZIP fallback: estimated cap rate (paginated county ZORI)
      const countyRentByFips: Record<string, number> = {};
      const countyZoriRows: any[] = [];
      let czOff = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('zillow_county')
          .select('fips_code, value')
          .eq('metric_name', 'zori')
          .eq('period_date', targetDate)
          .not('value', 'is', null)
          .range(czOff, czOff + 1999);
        if (!page || page.length === 0) break;
        countyZoriRows.push(...page);
        if (page.length < 2000) break;
        czOff += 2000;
      }

      if (countyZoriRows.length > 0) {
        for (const r of countyZoriRows) {
          const fips = normalizeFipsZip(r.fips_code);
          if (fips && r.value) countyRentByFips[fips] = r.value;
        }
      }

      const targetYear = parseInt(targetDate.substring(0, 4));
      // Paginated HUD FMR fetch
      const fmrRows: any[] = [];
      let fmrZipOff = 0;
      while (true) {
        const { data: page } = await this.supabase
          .from('hud_fmr')
          .select('fips_code, fmr_2br')
          .eq('year', targetYear)
          .not('fmr_2br', 'is', null)
          .range(fmrZipOff, fmrZipOff + 1999);
        if (!page || page.length === 0) break;
        fmrRows.push(...page);
        if (page.length < 2000) break;
        fmrZipOff += 2000;
      }

      if (fmrRows.length > 0) {
        for (const r of fmrRows) {
          const fips = normalizeFipsZip(r.fips_code);
          if (fips && r.fmr_2br && countyRentByFips[fips] == null) {
            countyRentByFips[fips] = r.fmr_2br;
          }
        }
      }

      const zipFallbackBatch: any[] = [];
      for (const [zipCode, price] of Object.entries(priceByZip)) {
        if (zipsWithZori.has(zipCode) || !price) continue;
        const countyFips = zipToCounty[zipCode];
        const countyRent = countyFips ? countyRentByFips[countyFips] : null;
        if (!countyRent) continue;

        const capRate = calculateCapRate(countyRent, price);
        const grossYield = calculateGrossYield(countyRent, price);
        const rentToPriceRatio = calculateRentToPriceRatio(countyRent, price);
        const grm = calculateGRM(price, countyRent);

        const zipFallbackRec: any = {
          geography_id: zipCode,
          geography_type: 'zip',
          geography_name: zipCode,
          period_date: targetDate,
          cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
          gross_yield: grossYield ? Math.round(grossYield * 100) / 100 : null,
          rent_to_price_ratio: rentToPriceRatio
            ? Math.round(rentToPriceRatio * 10000) / 10000
            : null,
          grm: grm ? Math.round(grm * 100) / 100 : null,
          calculated_at: new Date().toISOString(),
        };
        if (latestZipMosDate != null && targetDate === latestZipMosDate) {
          const m = zipMosInputs.get(String(zipCode));
          const mos = m ? calculateMonthsOfSupply(m.active, m.pending) : null;
          if (m && mos != null) {
            zipFallbackRec.months_of_supply = mos;
            zipFallbackRec.absorption_rate = calculateAbsorptionRate(
              m.pending,
              m.active,
            );
          }
        }
        zipFallbackBatch.push(zipFallbackRec);
      }

      if (zipFallbackBatch.length > 0) {
        const zipFallbackChunkSize = 500;
        for (
          let i = 0;
          i < zipFallbackBatch.length;
          i += zipFallbackChunkSize
        ) {
          const chunk = zipFallbackBatch.slice(i, i + zipFallbackChunkSize);
          const { error } = await this.supabase
            .from('calculated_metrics')
            .upsert(chunk, {
              onConflict: 'geography_id,geography_type,period_date',
            });
          if (!error) {
            totalStored += chunk.length;
          } else {
            errors.push(`${targetDate}: ${error.message}`);
          }
        }
      }
    }

    // ── REALTOR LISTING PRICE FALLBACK for zips without Zillow ZHVI ──
    // Zips that have Realtor median_listing_price + HUD FMR but no Zillow data
    // Use the latest ZORI date for storage alignment with ZORI-based records
    const latestZoriTargetDateZip =
      uniqueDates.length > 0 ? uniqueDates[0] : null;
    try {
      // Get latest Realtor zip date
      const { data: realtorZipLatest } = await this.supabase
        .from('realtor_zip')
        .select('period_date')
        .order('period_date', { ascending: false })
        .limit(1)
        .single();

      if (realtorZipLatest?.period_date) {
        const realtorDate = realtorZipLatest.period_date;
        const zipStoragePeriodDate = latestZoriTargetDateZip ?? realtorDate;
        const realtorYear = parseInt(realtorDate.substring(0, 4));

        // Find which zips already have cap_rate in calculated_metrics
        const existingZips = new Set<string>();
        let offset = 0;
        while (true) {
          const { data: existingRows } = await this.supabase
            .from('calculated_metrics')
            .select('geography_id')
            .eq('geography_type', 'zip')
            .not('cap_rate', 'is', null)
            .range(offset, offset + 5000 - 1);

          if (!existingRows || existingRows.length === 0) break;
          for (const r of existingRows) existingZips.add(r.geography_id);
          if (existingRows.length < 5000) break;
          offset += 5000;
        }

        // Get zip-to-county mapping from geographies table
        const zipToCountyMap: Record<string, string> = {};
        offset = 0;
        while (true) {
          const { data: geoRows } = await this.supabase
            .from('geographies')
            .select('geography_id, fips_code')
            .eq('geography_type', 'zip')
            .not('fips_code', 'is', null)
            .range(offset, offset + 5000 - 1);

          if (!geoRows || geoRows.length === 0) break;
          for (const r of geoRows) {
            if (r.fips_code) {
              const fips = /^\d+$/.test(r.fips_code)
                ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                : r.fips_code;
              zipToCountyMap[r.geography_id] = fips;
            }
          }
          if (geoRows.length < 5000) break;
          offset += 5000;
        }

        // Get HUD FMR for rent proxy (paginated)
        const fmrRowsForZip: any[] = [];
        let fzOff = 0;
        while (true) {
          const { data: page } = await this.supabase
            .from('hud_fmr')
            .select('fips_code, fmr_2br')
            .eq('year', realtorYear)
            .not('fmr_2br', 'is', null)
            .range(fzOff, fzOff + 1999);
          if (!page || page.length === 0) break;
          fmrRowsForZip.push(...page);
          if (page.length < 2000) break;
          fzOff += 2000;
        }

        const fmrByFipsForZip: Record<string, number> = {};
        if (fmrRowsForZip.length > 0) {
          for (const r of fmrRowsForZip) {
            const fips =
              r.fips_code && /^\d+$/.test(r.fips_code)
                ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                : r.fips_code;
            if (fips && r.fmr_2br != null) fmrByFipsForZip[fips] = r.fmr_2br;
          }
        }

        // Also get county ZORI as alternative rent
        const countyZoriForZip: Record<string, number> = {};
        const { data: latestZoriDateZip } = await this.supabase
          .from('zillow_county')
          .select('period_date')
          .eq('metric_name', 'zori')
          .order('period_date', { ascending: false })
          .limit(1)
          .single();

        if (latestZoriDateZip?.period_date) {
          // Paginated county ZORI fetch for ZIP fallback
          const zoriRowsZip: any[] = [];
          let zrzOff = 0;
          while (true) {
            const { data: page } = await this.supabase
              .from('zillow_county')
              .select('fips_code, value')
              .eq('metric_name', 'zori')
              .eq('period_date', latestZoriDateZip.period_date)
              .not('value', 'is', null)
              .range(zrzOff, zrzOff + 1999);
            if (!page || page.length === 0) break;
            zoriRowsZip.push(...page);
            if (page.length < 2000) break;
            zrzOff += 2000;
          }

          if (zoriRowsZip.length > 0) {
            for (const r of zoriRowsZip) {
              const fips =
                r.fips_code && /^\d+$/.test(r.fips_code)
                  ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                  : r.fips_code;
              if (fips && r.value) countyZoriForZip[fips] = r.value;
            }
          }
        }

        // Process Realtor zips in pages (can be 28k+)
        let realtorZipCount = 0;
        offset = 0;
        const realtorPageSize = 5000;

        while (true) {
          const { data: realtorZips } = await this.supabase
            .from('realtor_zip')
            .select('postal_code, zip_name, median_listing_price')
            .eq('period_date', realtorDate)
            .not('median_listing_price', 'is', null)
            .not('postal_code', 'is', null)
            .range(offset, offset + realtorPageSize - 1);

          if (!realtorZips || realtorZips.length === 0) break;

          const batch: any[] = [];

          for (const zip of realtorZips) {
            const zipCode = zip.postal_code;
            if (!zipCode || existingZips.has(zipCode)) continue;

            const price = zip.median_listing_price;
            if (!price || price <= 0) continue;

            const countyFips = zipToCountyMap[zipCode];
            if (!countyFips) continue;

            // Use county ZORI if available, otherwise HUD FMR
            const rent =
              countyZoriForZip[countyFips] ?? fmrByFipsForZip[countyFips];
            if (!rent || rent <= 0) continue;

            const capRate = calculateCapRate(rent, price);
            const grossYield = calculateGrossYield(rent, price);
            const rentToPriceRatio = calculateRentToPriceRatio(rent, price);
            const grm = calculateGRM(price, rent);

            const realtorZipRec: any = {
              geography_id: zipCode,
              geography_type: 'zip',
              geography_name: zip.zip_name || zipCode,
              period_date: zipStoragePeriodDate,
              cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
              gross_yield: grossYield
                ? Math.round(grossYield * 100) / 100
                : null,
              rent_to_price_ratio: rentToPriceRatio
                ? Math.round(rentToPriceRatio * 10000) / 10000
                : null,
              grm: grm ? Math.round(grm * 100) / 100 : null,
              calculated_at: new Date().toISOString(),
            };
            if (
              latestZipMosDate != null &&
              zipStoragePeriodDate === latestZipMosDate
            ) {
              const m = zipMosInputs.get(String(zipCode));
              const mos = m
                ? calculateMonthsOfSupply(m.active, m.pending)
                : null;
              if (m && mos != null) {
                realtorZipRec.months_of_supply = mos;
                realtorZipRec.absorption_rate = calculateAbsorptionRate(
                  m.pending,
                  m.active,
                );
              }
            }
            batch.push(realtorZipRec);

            // Mark as existing so we don't double-process
            existingZips.add(zipCode);
          }

          // Upsert in chunks
          for (let i = 0; i < batch.length; i += 500) {
            const chunk = batch.slice(i, i + 500);
            const { error } = await this.supabase
              .from('calculated_metrics')
              .upsert(chunk, {
                onConflict: 'geography_id,geography_type,period_date',
              });
            if (!error) realtorZipCount += chunk.length;
            else errors.push(`Realtor zip fallback: ${error.message}`);
          }

          if (realtorZips.length < realtorPageSize) break;
          offset += realtorPageSize;
        }

        if (realtorZipCount > 0) {
          totalStored += realtorZipCount;
          console.log(
            `[CalculatedMetrics] Realtor zip fallback: ${realtorZipCount} zips added`,
          );
        }
      }
    } catch (e: any) {
      errors.push(`Realtor zip fallback error: ${e.message}`);
    }

    return { processed: totalProcessed, stored: totalStored, errors };
  }

  /**
   * Calculate all investment metrics for all metros (master batch)
   */
  async calculateAllInvestmentMetrics(year?: number): Promise<{
    investmentMetrics: { processed: number; stored: number; errors: string[] };
    overvalued: { processed: number; stored: number; errors: string[] };
  }> {
    // Run investment metrics first (in parallel across geo types)
    const [metroResult, countyResult, zipResult] = await Promise.all([
      this.calculateInvestmentMetricsForMetros(year),
      this.calculateInvestmentMetricsForCounties(year),
      this.calculateInvestmentMetricsForZips(year),
    ]);

    // Then run overvalued AFTER investment metrics are stored,
    // so the upsert preserves cap_rate/gross_yield/grm on existing rows.
    // County and ZIP run latest-period-only (no year loop) for performance.
    const [metroOvervalued, countyOvervalued, zipOvervalued] =
      await Promise.all([
        this.calculateOvervaluedForMetros(year),
        this.calculateOvervaluedForCounties(),
        this.calculateOvervaluedForZips(),
      ]);
    const overvalued = {
      processed:
        metroOvervalued.processed +
        countyOvervalued.processed +
        zipOvervalued.processed,
      stored:
        metroOvervalued.stored + countyOvervalued.stored + zipOvervalued.stored,
      errors: [
        ...metroOvervalued.errors,
        ...countyOvervalued.errors,
        ...zipOvervalued.errors,
      ],
    };

    // Aggregate investment metric results
    const investmentMetrics = {
      processed:
        metroResult.processed + countyResult.processed + zipResult.processed,
      stored: metroResult.stored + countyResult.stored + zipResult.stored,
      errors: [
        ...metroResult.errors,
        ...countyResult.errors,
        ...zipResult.errors,
      ],
    };

    return { investmentMetrics, overvalued };
  }

  /**
   * Single entry point for the monthly calculated_metrics refresh: investment
   * metrics + months_of_supply (all geos), overvalued_pct (all geos), 5-year
   * growth (all geos), and affordability (income_to_buy / affordable_home_price
   * / years_to_save, all geos — mortgage rate from FRED). This is the sole
   * source of truth for the monthly refresh; the old scripts/calculations
   * affordability runner is retired.
   */
  async refreshAllCalculatedMetrics(year?: number): Promise<{
    investment: { processed: number; stored: number; errors: string[] };
    overvalued: { processed: number; stored: number; errors: string[] };
    growth: { processed: number; stored: number; errors: string[] };
    affordability: {
      incomeToBuy: { processed: number; stored: number; errors: string[] };
      affordableHomePrice: {
        processed: number;
        stored: number;
        errors: string[];
      };
      yearsToSave: { processed: number; stored: number; errors: string[] };
    };
  }> {
    const inv = await this.calculateAllInvestmentMetrics(year);
    const growthRaw = await this.calculate5YrGrowthForAll(year);
    // calculate5YrGrowthForAll returns {metros,states,counties,zips,national} each {processed,stored}.
    // Aggregate across all geo levels; no error channel exists on sub-results so errors stays empty.
    const growth = {
      processed:
        growthRaw.metros.processed +
        growthRaw.states.processed +
        growthRaw.counties.processed +
        growthRaw.zips.processed +
        growthRaw.national.processed,
      stored:
        growthRaw.metros.stored +
        growthRaw.states.stored +
        growthRaw.counties.stored +
        growthRaw.zips.stored +
        growthRaw.national.stored,
      errors: [] as string[],
    };
    const affordability = await this.calculateAllAffordabilityMetrics();
    return {
      investment: inv.investmentMetrics,
      overvalued: inv.overvalued,
      growth,
      affordability,
    };
  }

  // ===========================================================================
  // AFFORDABILITY METRICS (income_to_buy, affordable_home_price, years_to_save)
  // Ported from scripts/calculations/{affordability-metrics,years-to-save-metrics}
  // so the monthly refresh is produced entirely by this service. Mortgage rate
  // comes from FRED (MORTGAGE30US); falls back to 7% if the key/API is absent
  // (preserves the prior script behavior — domain default, not a secret).
  // Latest-period only, like the original runner.
  // ===========================================================================

  private readonly AFF = {
    DOWN_PAYMENT_PCT: 0.2,
    DEFAULT_MORTGAGE_RATE: 0.07,
    MORTGAGE_TERM_MONTHS: 360,
    PROPERTY_TAX_RATE: 0.011,
    INSURANCE_RATE: 0.0035,
    FRONT_END_DTI: 0.28,
    SAVINGS_RATE: 0.1,
    DOWN_PAYMENT_RATE: 0.2,
    BATCH_SIZE: 100,
    PAGE_SIZE: 1000,
    FRED_MORTGAGE_SERIES: 'MORTGAGE30US',
  };

  private readonly AFF_REALTOR_GEOS = [
    {
      tableName: 'realtor_national',
      geoType: 'national',
      idField: 'region_id',
      nameField: 'region_name',
    },
    {
      tableName: 'realtor_state',
      geoType: 'state',
      idField: 'state_id',
      nameField: 'state_name',
    },
    {
      tableName: 'realtor_metro',
      geoType: 'metro',
      idField: 'cbsa_code',
      nameField: 'cbsa_title',
    },
    {
      tableName: 'realtor_county',
      geoType: 'county',
      idField: 'county_fips',
      nameField: 'county_name',
    },
    {
      tableName: 'realtor_zip',
      geoType: 'zip',
      idField: 'postal_code',
      nameField: 'postal_code',
    },
  ];

  private readonly AFF_CENSUS_GEOS = [
    {
      tableName: 'census_national',
      geoType: 'national',
      idField: 'id',
      nameField: 'id',
    },
    {
      tableName: 'census_state',
      geoType: 'state',
      idField: 'state_fips',
      nameField: 'state_name',
    },
    {
      tableName: 'census_metro',
      geoType: 'metro',
      idField: 'cbsa_code',
      nameField: 'cbsa_title',
    },
    {
      tableName: 'census_county',
      geoType: 'county',
      idField: 'fips_code',
      nameField: 'county_name',
    },
    {
      tableName: 'census_zip',
      geoType: 'zip',
      idField: 'zcta',
      nameField: 'zcta',
    },
  ];

  private readonly AFF_CENSUS_BY_GEO: Record<
    string,
    { tableName: string; idField: string }
  > = {
    national: { tableName: 'census_national', idField: 'id' },
    state: { tableName: 'census_state', idField: 'state_fips' },
    metro: { tableName: 'census_metro', idField: 'cbsa_code' },
    county: { tableName: 'census_county', idField: 'fips_code' },
    zip: { tableName: 'census_zip', idField: 'zcta' },
  };

  /** Annual income needed to afford the median home (PITI / 28% front-end DTI). */
  private affIncomeToBuy(price: number, mortgageRate: number): number | null {
    if (!price || price === 0) return null;
    const a = this.AFF;
    const loanAmount = price * (1 - a.DOWN_PAYMENT_PCT);
    const monthlyRate = mortgageRate / 12;
    const factor = Math.pow(1 + monthlyRate, a.MORTGAGE_TERM_MONTHS);
    const monthlyMortgage =
      (loanAmount * (monthlyRate * factor)) / (factor - 1);
    const monthlyTaxes = (price * a.PROPERTY_TAX_RATE) / 12;
    const monthlyInsurance = (price * a.INSURANCE_RATE) / 12;
    const monthlyPITI = monthlyMortgage + monthlyTaxes + monthlyInsurance;
    const annualIncome = (monthlyPITI * 12) / a.FRONT_END_DTI;
    return Math.round(annualIncome);
  }

  /** Max affordable home price given local median income. */
  private affAffordableHomePrice(
    annualIncome: number,
    mortgageRate: number,
  ): number | null {
    if (!annualIncome || annualIncome === 0) return null;
    const a = this.AFF;
    const monthlyRate = mortgageRate / 12;
    const factor = Math.pow(1 + monthlyRate, a.MORTGAGE_TERM_MONTHS);
    const pmtFactor = (monthlyRate * factor) / (factor - 1);
    const maxMonthlyPITI = (annualIncome * a.FRONT_END_DTI) / 12;
    const taxInsuranceMonthlyRate =
      (a.PROPERTY_TAX_RATE + a.INSURANCE_RATE) / 12;
    const denominator =
      (1 - a.DOWN_PAYMENT_PCT) * pmtFactor + taxInsuranceMonthlyRate;
    return Math.round(maxMonthlyPITI / denominator);
  }

  /** Years to save a 20% down payment at a 10% savings rate. */
  private affYearsToSave(price: number, income: number): number | null {
    if (!price || price === 0 || !income || income === 0) return null;
    const a = this.AFF;
    const downPayment = price * a.DOWN_PAYMENT_RATE;
    const annualSavings = income * a.SAVINGS_RATE;
    return Math.round((downPayment / annualSavings) * 10) / 10;
  }

  /** Latest 30-yr fixed mortgage rate from FRED; 7% fallback if key/API absent. */
  private async affFetchMortgageRate(): Promise<number> {
    // FRED is an OPTIONAL enrichment source: if the key is absent we degrade to
    // the documented domain-default rate (a business default, not a secret) with
    // a warning, rather than crashing the whole monthly refresh. We never invent
    // a fallback *key* (that's what §1.2 forbids).
    const fredApiKey = process.env.FRED_API_KEY;
    if (!fredApiKey) {
      console.warn(
        '[affordability] FRED_API_KEY not set — using default mortgage rate',
      );
      return this.AFF.DEFAULT_MORTGAGE_RATE;
    }
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${this.AFF.FRED_MORTGAGE_SERIES}&api_key=${fredApiKey}&file_type=json&sort_order=desc&limit=1`;
      const response = await fetch(url);
      if (!response.ok) return this.AFF.DEFAULT_MORTGAGE_RATE;
      const data = await response.json();
      if (data.observations && data.observations.length > 0) {
        const latestRate = parseFloat(data.observations[0].value);
        if (!isNaN(latestRate)) return latestRate / 100;
      }
      return this.AFF.DEFAULT_MORTGAGE_RATE;
    } catch {
      return this.AFF.DEFAULT_MORTGAGE_RATE;
    }
  }

  private async affUpsertBatch(
    records: Record<string, unknown>[],
  ): Promise<{ stored: number; errors: string[] }> {
    const errors: string[] = [];
    let stored = 0;
    for (let i = 0; i < records.length; i += this.AFF.BATCH_SIZE) {
      const batch = records.slice(i, i + this.AFF.BATCH_SIZE);
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(batch, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (error) errors.push(error.message);
      else stored += batch.length;
    }
    return { stored, errors };
  }

  private async affIncomeToBuyForGeo(
    config: {
      tableName: string;
      geoType: string;
      idField: string;
      nameField: string;
    },
    mortgageRate: number,
  ): Promise<{ processed: number; stored: number; errors: string[] }> {
    const errors: string[] = [];
    const { data: latestRow } = await this.supabase
      .from(config.tableName)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();
    if (!latestRow?.period_date) {
      return {
        processed: 0,
        stored: 0,
        errors: [`No data in ${config.tableName}`],
      };
    }
    const targetDate = latestRow.period_date;

    let allData: any[] = [];
    let offset = 0;
    while (true) {
      const selectCols =
        config.geoType === 'national'
          ? 'median_listing_price'
          : `${config.idField}, ${config.nameField}, median_listing_price`;
      const { data, error } = await this.supabase
        .from(config.tableName)
        .select(selectCols)
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null)
        .range(offset, offset + this.AFF.PAGE_SIZE - 1);
      if (error) {
        errors.push(error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < this.AFF.PAGE_SIZE) break;
      offset += data.length;
    }

    if (allData.length === 0) {
      return {
        processed: 0,
        stored: 0,
        errors:
          errors.length > 0 ? errors : [`No data for ${config.tableName}`],
      };
    }

    const records: Record<string, unknown>[] = [];
    for (const row of allData) {
      const incomeToBuy = this.affIncomeToBuy(
        row.median_listing_price,
        mortgageRate,
      );
      if (incomeToBuy === null) continue;
      let geoId: string;
      let geoName: string;
      if (config.geoType === 'national') {
        geoId = 'US';
        geoName = 'United States';
      } else {
        geoId = String(row[config.idField]);
        if (config.geoType === 'zip') geoId = normalizeZipKey(geoId);
        geoName = row[config.nameField] || geoId;
      }
      records.push({
        geography_id: geoId,
        geography_type: config.geoType,
        geography_name: geoName,
        period_date: targetDate,
        income_to_buy: incomeToBuy,
        calculated_at: new Date().toISOString(),
      });
    }

    const { stored, errors: upsertErrors } = await this.affUpsertBatch(records);
    return {
      processed: allData.length,
      stored,
      errors: [...errors, ...upsertErrors],
    };
  }

  private async affAffordableHomePriceForGeo(
    config: {
      tableName: string;
      geoType: string;
      idField: string;
      nameField: string;
    },
    mortgageRate: number,
  ): Promise<{ processed: number; stored: number; errors: string[] }> {
    const errors: string[] = [];
    let allData: any[] = [];
    let offset = 0;
    while (true) {
      const selectCols =
        config.geoType === 'national'
          ? 'year, median_household_income'
          : `${config.idField}, ${config.nameField}, year, median_household_income`;
      const { data, error } = await this.supabase
        .from(config.tableName)
        .select(selectCols)
        .not('median_household_income', 'is', null)
        .order('year', { ascending: false })
        .range(offset, offset + this.AFF.PAGE_SIZE - 1);
      if (error) {
        errors.push(error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < this.AFF.PAGE_SIZE) break;
      offset += data.length;
    }

    if (allData.length === 0) {
      return {
        processed: 0,
        stored: 0,
        errors:
          errors.length > 0
            ? errors
            : [`No income data for ${config.tableName}`],
      };
    }

    const latestByGeo: Record<string, any> = {};
    for (const row of allData) {
      const geoId =
        config.geoType === 'national' ? 'US' : String(row[config.idField]);
      if (!latestByGeo[geoId]) latestByGeo[geoId] = row;
    }

    const { data: latestDateRow } = await this.supabase
      .from('realtor_metro')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();
    const targetDate =
      latestDateRow?.period_date || new Date().toISOString().split('T')[0];

    const records: Record<string, unknown>[] = [];
    for (const [geoId, row] of Object.entries(latestByGeo)) {
      const affordablePrice = this.affAffordableHomePrice(
        row.median_household_income,
        mortgageRate,
      );
      if (affordablePrice === null) continue;
      const finalGeoId =
        config.geoType === 'zip' ? normalizeZipKey(geoId) : geoId;
      let geoName: string;
      if (config.geoType === 'national') geoName = 'United States';
      else if (config.geoType === 'zip') geoName = `ZIP ${finalGeoId}`;
      else geoName = row[config.nameField] || geoId;
      records.push({
        geography_id: finalGeoId,
        geography_type: config.geoType,
        geography_name: geoName,
        period_date: targetDate,
        affordable_home_price: affordablePrice,
        calculated_at: new Date().toISOString(),
      });
    }

    const { stored, errors: upsertErrors } = await this.affUpsertBatch(records);
    return {
      processed: Object.keys(latestByGeo).length,
      stored,
      errors: [...errors, ...upsertErrors],
    };
  }

  private async affYearsToSaveForGeo(config: {
    tableName: string;
    geoType: string;
    idField: string;
    nameField: string;
  }): Promise<{ processed: number; stored: number; errors: string[] }> {
    const errors: string[] = [];
    const censusConfig = this.AFF_CENSUS_BY_GEO[config.geoType];

    const { data: latestDateRow } = await this.supabase
      .from(config.tableName)
      .select('period_date')
      .not('median_listing_price', 'is', null)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();
    if (!latestDateRow?.period_date) {
      return {
        processed: 0,
        stored: 0,
        errors: [`No listing price data for ${config.geoType}`],
      };
    }
    const targetDate = latestDateRow.period_date;

    let realtorData: any[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from(config.tableName)
        .select(`${config.idField}, ${config.nameField}, median_listing_price`)
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null)
        .range(offset, offset + this.AFF.PAGE_SIZE - 1);
      if (error) {
        errors.push(error.message);
        break;
      }
      if (!data || data.length === 0) break;
      realtorData = realtorData.concat(data);
      if (data.length < this.AFF.PAGE_SIZE) break;
      offset += data.length;
    }

    if (realtorData.length === 0) {
      return {
        processed: 0,
        stored: 0,
        errors: [`No Realtor data for ${config.geoType}`],
      };
    }

    const incomeByGeo: Record<string, number> = {};
    offset = 0;
    while (true) {
      const selectCols =
        config.geoType === 'national'
          ? 'year, median_household_income'
          : `${censusConfig.idField}, year, median_household_income`;
      const { data, error } = await this.supabase
        .from(censusConfig.tableName)
        .select(selectCols)
        .not('median_household_income', 'is', null)
        .order('year', { ascending: false })
        .range(offset, offset + this.AFF.PAGE_SIZE - 1);
      if (error) {
        errors.push(error.message);
        break;
      }
      if (!data || data.length === 0) break;
      for (const row of data as any[]) {
        let geoId =
          config.geoType === 'national'
            ? 'US'
            : String(row[censusConfig.idField]);
        if (config.geoType === 'zip') geoId = normalizeZipKey(geoId);
        if (!incomeByGeo[geoId])
          incomeByGeo[geoId] = Number(row.median_household_income);
      }
      offset += data.length;
      if (data.length < this.AFF.PAGE_SIZE) break;
    }

    let stored = 0;
    const records: Record<string, unknown>[] = [];
    for (const row of realtorData) {
      let geoId: string;
      let geoName: string;
      if (config.geoType === 'national') {
        geoId = 'US';
        geoName = 'United States';
      } else if (config.geoType === 'zip') {
        geoId = normalizeZipKey(String(row[config.idField]));
        geoName = `ZIP ${geoId}`;
      } else if (config.geoType === 'state') {
        geoId = row[config.idField];
        geoName = row[config.nameField];
      } else {
        geoId = row[config.idField];
        geoName = row[config.nameField] || geoId;
      }
      const price = row.median_listing_price;
      const income = incomeByGeo[geoId] ?? incomeByGeo[row[config.idField]];
      if (!income) continue;
      const yearsToSave = this.affYearsToSave(price, income);
      if (yearsToSave === null) continue;
      records.push({
        geography_id: geoId,
        geography_type: config.geoType,
        geography_name: geoName,
        period_date: targetDate,
        years_to_save: yearsToSave,
        calculated_at: new Date().toISOString(),
      });
      if (records.length >= this.AFF.BATCH_SIZE) {
        const { error: upsertError } = await this.supabase
          .from('calculated_metrics')
          .upsert(records, {
            onConflict: 'geography_id,geography_type,period_date',
          });
        if (upsertError) errors.push(upsertError.message);
        else stored += records.length;
        records.length = 0;
      }
    }

    if (records.length > 0) {
      const { error: upsertError } = await this.supabase
        .from('calculated_metrics')
        .upsert(records, {
          onConflict: 'geography_id,geography_type,period_date',
        });
      if (upsertError) errors.push(upsertError.message);
      else stored += records.length;
    }

    return { processed: realtorData.length, stored, errors };
  }

  /**
   * Run all three affordability metrics across every geo level. The FRED
   * mortgage rate is fetched ONCE and shared by income_to_buy and
   * affordable_home_price (years_to_save does not use it).
   */
  async calculateAllAffordabilityMetrics(): Promise<{
    incomeToBuy: { processed: number; stored: number; errors: string[] };
    affordableHomePrice: {
      processed: number;
      stored: number;
      errors: string[];
    };
    yearsToSave: { processed: number; stored: number; errors: string[] };
  }> {
    const mortgageRate = await this.affFetchMortgageRate();
    const blank = () => ({ processed: 0, stored: 0, errors: [] as string[] });
    const incomeToBuy = blank();
    const affordableHomePrice = blank();
    const yearsToSave = blank();

    for (const config of this.AFF_REALTOR_GEOS) {
      const r = await this.affIncomeToBuyForGeo(config, mortgageRate);
      incomeToBuy.processed += r.processed;
      incomeToBuy.stored += r.stored;
      incomeToBuy.errors.push(...r.errors);
    }
    for (const config of this.AFF_CENSUS_GEOS) {
      const r = await this.affAffordableHomePriceForGeo(config, mortgageRate);
      affordableHomePrice.processed += r.processed;
      affordableHomePrice.stored += r.stored;
      affordableHomePrice.errors.push(...r.errors);
    }
    for (const config of this.AFF_REALTOR_GEOS) {
      const r = await this.affYearsToSaveForGeo(config);
      yearsToSave.processed += r.processed;
      yearsToSave.stored += r.stored;
      yearsToSave.errors.push(...r.errors);
    }

    return { incomeToBuy, affordableHomePrice, yearsToSave };
  }

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
