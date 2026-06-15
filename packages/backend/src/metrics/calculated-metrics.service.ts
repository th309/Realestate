import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeZipKey, calculateCAGR } from '../common/zip';
import { InvestmentMetricsService } from './pipelines/investment-metrics.service';
import {
  CalculatedMetricsInput,
  CalculatedMetricsOutput,
} from './calculated-metrics.types';

// Back-compat: keep these importable from the service path.
export type { CalculatedMetricsInput, CalculatedMetricsOutput };

@Injectable()
export class CalculatedMetricsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly investment: InvestmentMetricsService,
  ) {}

  getInvestmentMetricsForMap = (
    ...args: Parameters<InvestmentMetricsService['getInvestmentMetricsForMap']>
  ) => this.investment.getInvestmentMetricsForMap(...args);

  calculateInvestmentMetricsForMetros = (year?: number) =>
    this.investment.calculateInvestmentMetricsForMetros(year);

  calculateInvestmentMetricsForCounties = (year?: number) =>
    this.investment.calculateInvestmentMetricsForCounties(year);

  calculateInvestmentMetricsForZips = (year?: number) =>
    this.investment.calculateInvestmentMetricsForZips(year);

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

  calculateAllInvestmentMetrics = (year?: number) =>
    this.investment.calculateAllInvestmentMetrics(year);

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
}
