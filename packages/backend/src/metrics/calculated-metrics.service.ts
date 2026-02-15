import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeZipKey, calculateCAGR } from '../common/zip';

export interface CalculatedMetricsInput {
  geography_id: string;
  geography_type: string;
  geography_name?: string;
  period_date: string;
  // From Realtor
  median_listing_price?: number;
  active_listing_count?: number;
  median_days_on_market?: number;
  price_reduced_share?: number;
  pending_ratio?: number;
  pending_listing_count?: number;
  new_listing_count?: number;
  // From Zillow
  zori?: number;
  zhvi?: number;
  // Historical for CAGR
  listing_price_5yr_ago?: number;
  inventory_5yr_avg?: number;
  // For overvalued
  median_income?: number;
  // For months of supply
  monthly_sales?: number;
}

export interface CalculatedMetricsOutput {
  cap_rate: number | null;
  gross_yield: number | null;
  rent_to_price_ratio: number | null;
  grm: number | null;
  months_of_supply: number | null;
  absorption_rate: number | null;
  market_health_score: number | null;
  investment_score: number | null;
  long_term_growth_score: number | null;
  home_value_5yr_cagr: number | null;
  inventory_surplus_pct: number | null;
  overvalued_pct: number | null;
}

@Injectable()
export class CalculatedMetricsService {
  private readonly EXPENSE_RATIO = 0.6; // 60% NOI for cap rate calculation
  private readonly PRICE_TO_INCOME_BENCHMARK = 3.5; // Traditional affordability benchmark

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) { }

  /**
   * Calculate Cap Rate: (ZORI × 12 × expense_ratio) / price × 100
   */
  calculateCapRate(
    zori: number | undefined,
    price: number | undefined,
  ): number | null {
    if (!zori || !price || price === 0) return null;
    return ((zori * 12 * this.EXPENSE_RATIO) / price) * 100;
  }

  /**
   * Calculate Gross Yield: (ZORI × 12) / price × 100
   */
  calculateGrossYield(
    zori: number | undefined,
    price: number | undefined,
  ): number | null {
    if (!zori || !price || price === 0) return null;
    return ((zori * 12) / price) * 100;
  }

  /**
   * Calculate Rent-to-Price Ratio: ZORI / price
   */
  calculateRentToPriceRatio(
    zori: number | undefined,
    price: number | undefined,
  ): number | null {
    if (!zori || !price || price === 0) return null;
    return zori / price;
  }

  /**
   * Calculate Gross Rent Multiplier (GRM): price / (ZORI × 12)
   * Lower GRM indicates potentially better investment value
   * Typical range: 8-20 years
   */
  calculateGRM(
    price: number | undefined,
    zori: number | undefined,
  ): number | null {
    if (!price || !zori || zori === 0) return null;
    const annualRent = zori * 12;
    return price / annualRent;
  }

  /**
   * Calculate Months of Supply: inventory / monthly_sales
   * Balanced market: 4-6 months
   * Seller's market: < 4 months
   * Buyer's market: > 6 months
   */
  calculateMonthsOfSupply(
    inventory: number | undefined,
    monthlySales: number | undefined,
  ): number | null {
    if (!inventory || !monthlySales || monthlySales === 0) return null;
    return inventory / monthlySales;
  }

  /**
   * Calculate Absorption Rate: (monthly_sales / inventory) × 100
   * Percentage of available inventory sold per month
   * Higher rate indicates stronger demand
   */
  calculateAbsorptionRate(
    monthlySales: number | undefined,
    inventory: number | undefined,
  ): number | null {
    if (!monthlySales || !inventory || inventory === 0) return null;
    return (monthlySales / inventory) * 100;
  }

  /**
   * Calculate 5-Year CAGR: (current / past)^(1/5) - 1
   */
  calculate5YearCagr(
    current: number | undefined,
    past: number | undefined,
  ): number | null {
    if (!current || !past || past === 0) return null;
    return Math.pow(current / past, 1 / 5) - 1;
  }

  /**
   * Calculate Inventory Surplus: Current Inventory - Historical Average Inventory
   * Positive values indicate more homes available than typical (buyer's market)
   * Negative values indicate fewer homes than typical (seller's market)
   */
  calculateInventorySurplus(
    current: number | undefined,
    avg: number | undefined,
  ): number | null {
    if (!current || !avg) return null;
    return current - avg;
  }

  /**
   * Calculate Overvalued %: (price_to_income - benchmark) / benchmark × 100
   */
  calculateOvervalued(
    price: number | undefined,
    income: number | undefined,
  ): number | null {
    if (!price || !income || income === 0) return null;
    const priceToIncome = price / income;
    return (
      ((priceToIncome - this.PRICE_TO_INCOME_BENCHMARK) /
        this.PRICE_TO_INCOME_BENCHMARK) *
      100
    );
  }

  /**
   * Calculate Market Health Score (0-100)
   * Components: DOM (inverse), inventory, price cuts (inverse), pending ratio
   */
  calculateMarketHealthScore(
    dom: number | undefined,
    inventoryYoy: number | undefined,
    priceCutShare: number | undefined,
    pendingRatio: number | undefined,
  ): number | null {
    let score = 50; // Base score
    let factors = 0;

    // DOM component (lower is better, national avg ~40-60 days)
    if (dom !== undefined && dom !== null) {
      const domScore = Math.max(0, Math.min(100, 100 - (dom / 90) * 100));
      score += domScore - 50;
      factors++;
    }

    // Inventory YoY (moderate increase is healthy, but not too much)
    if (inventoryYoy !== undefined && inventoryYoy !== null) {
      // -20% to +20% is healthy zone
      const inventoryScore = Math.max(
        0,
        Math.min(100, 50 + inventoryYoy * 2.5),
      );
      score += inventoryScore - 50;
      factors++;
    }

    // Price cut share (lower is better, typical range 0-30%)
    if (priceCutShare !== undefined && priceCutShare !== null) {
      const priceCutScore = Math.max(
        0,
        Math.min(100, 100 - (priceCutShare / 0.3) * 100),
      );
      score += priceCutScore - 50;
      factors++;
    }

    // Pending ratio (higher is better, indicates buyer demand)
    if (pendingRatio !== undefined && pendingRatio !== null) {
      const pendingScore = Math.max(0, Math.min(100, pendingRatio * 100));
      score += pendingScore - 50;
      factors++;
    }

    if (factors === 0) return null;
    return Math.max(0, Math.min(100, (score / factors) * 2));
  }

  /**
   * Calculate Investment Score (0-100)
   * Components: cap rate, gross yield, rent growth (if available)
   */
  calculateInvestmentScore(
    capRate: number | null,
    grossYield: number | null,
    rentGrowth?: number,
  ): number | null {
    let score = 0;
    let factors = 0;

    // Cap rate component (higher is better, typical range 3-8%)
    if (capRate !== null) {
      const capRateScore = Math.max(0, Math.min(100, (capRate / 8) * 100));
      score += capRateScore;
      factors++;
    }

    // Gross yield component (higher is better, typical range 5-12%)
    if (grossYield !== null) {
      const yieldScore = Math.max(0, Math.min(100, (grossYield / 12) * 100));
      score += yieldScore;
      factors++;
    }

    // Rent growth component (positive growth is good)
    if (rentGrowth !== undefined && rentGrowth !== null) {
      const growthScore = Math.max(0, Math.min(100, 50 + rentGrowth * 10));
      score += growthScore;
      factors++;
    }

    if (factors === 0) return null;
    return score / factors;
  }

  /**
   * Calculate Long-Term Growth Score (0-100)
   * Components: 5yr CAGR, price appreciation trends
   */
  calculateLongTermGrowthScore(
    cagr5yr: number | null,
    priceYoy: number | undefined,
  ): number | null {
    let score = 0;
    let factors = 0;

    // 5-year CAGR component (typical range -5% to +15%)
    if (cagr5yr !== null) {
      const cagrScore = Math.max(0, Math.min(100, 50 + cagr5yr * 500));
      score += cagrScore;
      factors++;
    }

    // Price YoY component
    if (priceYoy !== undefined && priceYoy !== null) {
      const yoyScore = Math.max(0, Math.min(100, 50 + priceYoy * 500));
      score += yoyScore;
      factors++;
    }

    if (factors === 0) return null;
    return score / factors;
  }

  /**
   * Calculate all metrics for a geography
   */
  calculateAll(input: CalculatedMetricsInput): CalculatedMetricsOutput {
    const capRate = this.calculateCapRate(
      input.zori,
      input.median_listing_price,
    );
    const grossYield = this.calculateGrossYield(
      input.zori,
      input.median_listing_price,
    );
    const rentToPriceRatio = this.calculateRentToPriceRatio(
      input.zori,
      input.median_listing_price,
    );
    const grm = this.calculateGRM(input.median_listing_price, input.zori);
    const monthsOfSupply = this.calculateMonthsOfSupply(
      input.active_listing_count,
      input.monthly_sales,
    );
    const absorptionRate = this.calculateAbsorptionRate(
      input.monthly_sales,
      input.active_listing_count,
    );
    const homeValue5yrCagr = this.calculate5YearCagr(
      input.median_listing_price,
      input.listing_price_5yr_ago,
    );
    const inventorySurplusPct = this.calculateInventorySurplus(
      input.active_listing_count,
      input.inventory_5yr_avg,
    );
    const overvaluedPct = this.calculateOvervalued(
      input.median_listing_price,
      input.median_income,
    );

    const marketHealthScore = this.calculateMarketHealthScore(
      input.median_days_on_market,
      undefined, // inventory YoY would need to be calculated separately
      input.price_reduced_share,
      input.pending_ratio,
    );

    const investmentScore = this.calculateInvestmentScore(capRate, grossYield);
    const longTermGrowthScore = this.calculateLongTermGrowthScore(
      homeValue5yrCagr,
      undefined,
    );

    return {
      cap_rate: capRate,
      gross_yield: grossYield,
      rent_to_price_ratio: rentToPriceRatio,
      grm,
      months_of_supply: monthsOfSupply,
      absorption_rate: absorptionRate,
      market_health_score: marketHealthScore,
      investment_score: investmentScore,
      long_term_growth_score: longTermGrowthScore,
      home_value_5yr_cagr: homeValue5yrCagr,
      inventory_surplus_pct: inventorySurplusPct,
      overvalued_pct: overvaluedPct,
    };
  }

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
      'cap_rate', 'gross_yield', 'rent_to_price_ratio', 'grm',
      'months_of_supply', 'absorption_rate', 'market_health_score',
      'investment_score', 'long_term_growth_score', 'home_value_5yr_cagr',
      'inventory_surplus', 'overvalued_pct',
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
      console.log(`[CalculatedMetrics] Filtering 5yr growth (metros) for year: ${year}`);
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
        .from('realtor_metro')
        .select('cbsa_code, cbsa_title, median_listing_price')
        .eq('period_date', targetDate)
        .not('median_listing_price', 'is', null);

      if (!currentData || currentData.length === 0) continue;

      // Get historical data
      const { data: pastData } = await this.supabase
        .from('realtor_metro')
        .select('cbsa_code, median_listing_price')
        .gte('period_date', pastDateStr)
        .lte('period_date', pastDateMax)
        .not('median_listing_price', 'is', null)
        .order('period_date', { ascending: true });

      // Build lookup
      const pastByRegion: Record<string, number> = {};
      if (pastData) {
        for (const row of pastData) {
          if (!pastByRegion[row.cbsa_code]) {
            pastByRegion[row.cbsa_code] = row.median_listing_price;
          }
        }
      }

      let recordsToUpsert: any[] = [];

      for (const metro of currentData) {
        const pastValue = pastByRegion[metro.cbsa_code];
        if (!pastValue || pastValue === 0) continue;

        const cagr = calculateCAGR(pastValue, metro.median_listing_price, 5);

        recordsToUpsert.push({
          geography_id: metro.cbsa_code,
          geography_type: 'metro',
          geography_name: metro.cbsa_title,
          period_date: targetDate,
          home_value_5yr_cagr: cagr,
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
      const cagr = calculateCAGR(pastValue, currentData.median_listing_price, 5);

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

    for (const targetDate of uniqueDates) {
      // Get ZORI (rent) data for all metros from zillow_metro table
      const { data: zoriData, error: zoriError } = await this.supabase
        .from('zillow_metro')
        .select('region_id, region_name, value, cbsa_code')
        .eq('metric_name', 'zori')
        .eq('period_date', targetDate)
        .not('value', 'is', null);

      if (zoriError || !zoriData) {
        errors.push(
          `${targetDate}: ${zoriError?.message || 'Failed to fetch ZORI data'}`,
        );
        continue;
      }

      // Get ZHVI (value) data for all metros from zillow_metro table
      // Use same date as ZORI if possible, or latest available at that time
      const { data: zhviData, error: zhviError } = await this.supabase
        .from('zillow_metro')
        .select('region_id, value, cbsa_code, region_name')
        .eq('metric_name', 'zhvi')
        .eq('period_date', targetDate) // Ideally matched
        .not('value', 'is', null);

      // Fallback if exact date match fails (ZHVI might be updated at different cadence than ZORI)
      let zhviRows: Array<{
        region_id: number;
        value: number;
        cbsa_code: string | null;
        region_name: string | null;
      }> = zhviData ?? [];
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
          const { data: zhviDataFallback } = await this.supabase
            .from('zillow_metro')
            .select('region_id, value, cbsa_code, region_name')
            .eq('metric_name', 'zhvi')
            .eq('period_date', zhviDateRow.period_date)
            .not('value', 'is', null);

          if (zhviDataFallback && zhviDataFallback.length > 0) {
            zhviRows = zhviDataFallback;
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

      // Calculate and batch upsert
      let storedInBatch = 0;
      const batchSize = 100;
      let recordsToUpsert: any[] = [];

      for (const metro of zoriData) {
        const cbsaCode = metro.cbsa_code;
        const zori = metro.value;
        const price = cbsaCode ? priceByCode[cbsaCode] : null;

        if (!zori || !price) continue;

        const capRate = this.calculateCapRate(zori, price);
        const grossYield = this.calculateGrossYield(zori, price);
        const rentToPriceRatio = this.calculateRentToPriceRatio(zori, price);
        const grm = this.calculateGRM(price, zori);

        recordsToUpsert.push({
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
          calculated_at: new Date().toISOString(),
        });

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

        // Look up component counties for these metros from geographies table
        const { data: countyRows } = await this.supabase
          .from('geographies')
          .select('cbsa_code, fips_code, population')
          .eq('geography_type', 'county')
          .in('cbsa_code', cbsasWithZhviOnly)
          .not('fips_code', 'is', null);

        if (countyRows && countyRows.length > 0) {
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

          // Fetch HUD FMR for the target year
          const allFips = countyRows
            .map((c) =>
              c.fips_code
                ? String(parseInt(c.fips_code, 10)).padStart(5, '0')
                : null,
            )
            .filter(Boolean) as string[];

          const { data: fmrRows } = await this.supabase
            .from('hud_fmr')
            .select('fips_code, fmr_2br')
            .eq('year', targetYear)
            .in('fips_code', allFips)
            .not('fmr_2br', 'is', null);

          if (fmrRows && fmrRows.length > 0) {
            const fmrByFips: Record<string, number> = {};
            for (const r of fmrRows) {
              const fips =
                r.fips_code && /^\d+$/.test(r.fips_code)
                  ? String(parseInt(r.fips_code, 10)).padStart(5, '0')
                  : r.fips_code;
              if (fips && r.fmr_2br != null) {
                fmrByFips[fips] = r.fmr_2br;
              }
            }

            // For each metro without ZORI, compute population-weighted average FMR
            let hudMetroUpsert: any[] = [];
            for (const cbsa of cbsasWithZhviOnly) {
              const counties = countiesByCbsa[cbsa];
              if (!counties || counties.length === 0) continue;

              let totalRent = 0;
              let totalWeight = 0;
              for (const county of counties) {
                const fmr = fmrByFips[county.fips];
                if (fmr == null || fmr <= 0) continue;
                const weight = county.population ?? 1; // fallback to equal weight
                totalRent += fmr * weight;
                totalWeight += weight;
              }

              if (totalWeight === 0) continue;
              const avgRent = totalRent / totalWeight;
              const price = priceByCode[cbsa];
              if (!price) continue;

              const capRate = this.calculateCapRate(avgRent, price);
              const grossYield = this.calculateGrossYield(avgRent, price);
              const rentToPriceRatio = this.calculateRentToPriceRatio(
                avgRent,
                price,
              );
              const grm = this.calculateGRM(price, avgRent);

              hudMetroUpsert.push({
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
                calculated_at: new Date().toISOString(),
              });
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
        if (row.value) incomeByYearAndGeo[y][row.geography_id] = Number(row.value);
      }
    }
    const availableIncomeYears = Object.keys(incomeByYearAndGeo).map(Number).sort((a, b) => b - a);

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
      let bestIncomeYear = availableIncomeYears.find(y => y <= targetYear);
      // If none found (targetYear is older than oldest census data), use oldest available?
      // Or if targetYear is newer than newest census, use newest.
      if (!bestIncomeYear) {
        if (availableIncomeYears.length > 0) bestIncomeYear = availableIncomeYears[0]; // Newest
      }

      const incomeMap = bestIncomeYear ? incomeByYearAndGeo[bestIncomeYear] : {};

      let storedInBatch = 0;
      const batchSize = 100;
      let recordsToUpsert: any[] = [];

      for (const metro of zhviData) {
        const cbsaCode = metro.cbsa_code;
        const zhvi = metro.value;
        const medianIncome = (cbsaCode && incomeMap[cbsaCode]) || NATIONAL_MEDIAN_INCOME;

        const overvaluedPct = this.calculateOvervalued(zhvi, medianIncome);

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
          storedInBatch += await this.upsertOvervalued(recordsToUpsert, targetDate, errors);
          recordsToUpsert = [];
        }
      }

      if (recordsToUpsert.length > 0) {
        storedInBatch += await this.upsertOvervalued(recordsToUpsert, targetDate, errors);
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
      | 'renter_demand_index',
    geographyType: 'metro' | 'county' | 'zip' | 'state' | 'national' = 'metro',
  ): Promise<{ data: any[]; success: boolean; source: string }> {
    // Get latest period_date for this metric
    const { data: latestRow } = await this.supabase
      .from('calculated_metrics')
      .select('period_date')
      .eq('geography_type', geographyType)
      .not(metricName, 'is', null)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestRow?.period_date) {
      return { data: [], success: false, source: 'calculated_metrics' };
    }

    // Get all data for that period (paginated to avoid Supabase 1000 row limit)
    const allData: any[] = [];
    let offset = 0;

    while (true) {
      const { data: pageData, error } = await this.supabase
        .from('calculated_metrics')
        .select(`geography_id, geography_name, ${metricName}, period_date`)
        .eq('geography_type', geographyType)
        .eq('period_date', latestRow.period_date)
        .not(metricName, 'is', null)
        .range(offset, offset + this.PAGE_SIZE - 1);

      if (error || !pageData || pageData.length === 0) break;
      allData.push(...pageData);
      if (pageData.length < this.PAGE_SIZE) break;
      offset += this.PAGE_SIZE;
    }

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

    for (const targetDate of uniqueDates) {
      // Get ZORI (rent) data for all counties
      const { data: zoriData } = await this.supabase
        .from('zillow_county')
        .select('region_id, region_name, value, fips_code')
        .eq('metric_name', 'zori')
        .eq('period_date', targetDate)
        .not('value', 'is', null);

      if (!zoriData || zoriData.length === 0) {
        // Skip dates with no data (common if ZORI is less frequent)
        continue;
      }

      // Get ZHVI data (property value) for all counties
      const { data: zhviData } = await this.supabase
        .from('zillow_county')
        .select('region_id, region_name, value, fips_code')
        .eq('metric_name', 'zhvi')
        .eq('period_date', targetDate)
        .not('value', 'is', null);

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

        const capRate = this.calculateCapRate(zori, price);
        const grossYield = this.calculateGrossYield(zori, price);
        const rentToPriceRatio = this.calculateRentToPriceRatio(zori, price);
        const grm = this.calculateGRM(price, zori);

        recordsToUpsert.push({
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
        });

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
              fmrByFips[fips] = { rent: r.fmr_2br, name: r.county_name ?? undefined };
            }
          }

          let hudUpsert: any[] = [];
          for (const fips of fipsWithZhviOnly) {
            if (processedFipsThisDate.has(fips)) continue;
            const fmr = fmrByFips[fips];
            const price = priceByCode[fips];
            if (!fmr || !price || fmr.rent <= 0) continue;
            processedFipsThisDate.add(fips);

            const capRate = this.calculateCapRate(fmr.rent, price);
            const grossYield = this.calculateGrossYield(fmr.rent, price);
            const rentToPriceRatio = this.calculateRentToPriceRatio(fmr.rent, price);
            const grm = this.calculateGRM(price, fmr.rent);

            hudUpsert.push({
              geography_id: fips,
              geography_type: 'county',
              geography_name: fmr.name || nameByCode[fips] || `County ${fips}`,
              period_date: targetDate,
              cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
              gross_yield: grossYield ? Math.round(grossYield * 100) / 100 : null,
              rent_to_price_ratio: rentToPriceRatio ? Math.round(rentToPriceRatio * 10000) / 10000 : null,
              grm: grm ? Math.round(grm * 100) / 100 : null,
              calculated_at: new Date().toISOString(),
            });
          }

          if (hudUpsert.length > 0) {
            // Batch HUD upsert if large? usually small subset? 
            // Counties are ~3000. Just upsert all is fine or batch 1000.
            const { error } = await this.supabase.from('calculated_metrics').upsert(hudUpsert, { onConflict: 'geography_id,geography_type,period_date' });
            if (!error) storedInBatch += hudUpsert.length;
          }
        }
      }

      totalProcessed += zoriData.length;
      totalStored += storedInBatch;
    }

    // ── REALTOR LISTING PRICE FALLBACK for counties without Zillow ZHVI ──
    // Counties that have Realtor median_listing_price + HUD FMR but no Zillow data
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

        // Get all Realtor county listing prices
        const { data: realtorCounties } = await this.supabase
          .from('realtor_county')
          .select('county_fips, county_name, median_listing_price')
          .eq('period_date', realtorDate)
          .not('median_listing_price', 'is', null)
          .not('county_fips', 'is', null);

        if (realtorCounties && realtorCounties.length > 0) {
          const normFips = (f: string | null | undefined) =>
            f && /^\d+$/.test(f) ? String(parseInt(f, 10)).padStart(5, '0') : f;

          // Find which FIPS already have calculated_metrics (from ZHVI-based passes)
          const { data: existingRows } = await this.supabase
            .from('calculated_metrics')
            .select('geography_id')
            .eq('geography_type', 'county')
            .not('cap_rate', 'is', null);

          const existingFips = new Set(
            (existingRows || []).map((r) => r.geography_id),
          );

          // Get HUD FMR for the Realtor year
          const { data: fmrRows } = await this.supabase
            .from('hud_fmr')
            .select('fips_code, fmr_2br')
            .eq('year', realtorYear)
            .not('fmr_2br', 'is', null);

          const fmrByFips: Record<string, number> = {};
          if (fmrRows) {
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
            const { data: zoriRows } = await this.supabase
              .from('zillow_county')
              .select('fips_code, value')
              .eq('metric_name', 'zori')
              .eq('period_date', latestZoriDate.period_date)
              .not('value', 'is', null);

            if (zoriRows) {
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
            if (!fips || existingFips.has(fips) || processedRealtorFips.has(fips)) continue;
            processedRealtorFips.add(fips);

            const price = county.median_listing_price;
            if (!price || price <= 0) continue;

            // Use ZORI if available, otherwise HUD FMR
            const rent = countyZoriByFips[fips] ?? fmrByFips[fips];
            if (!rent || rent <= 0) continue;

            const capRate = this.calculateCapRate(rent, price);
            const grossYield = this.calculateGrossYield(rent, price);
            const rentToPriceRatio = this.calculateRentToPriceRatio(rent, price);
            const grm = this.calculateGRM(price, rent);

            realtorUpsert.push({
              geography_id: fips,
              geography_type: 'county',
              geography_name: county.county_name || `County ${fips}`,
              period_date: realtorDate,
              cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
              gross_yield: grossYield ? Math.round(grossYield * 100) / 100 : null,
              rent_to_price_ratio: rentToPriceRatio
                ? Math.round(rentToPriceRatio * 10000) / 10000
                : null,
              grm: grm ? Math.round(grm * 100) / 100 : null,
              calculated_at: new Date().toISOString(),
            });

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

    for (const targetDate of uniqueDates) {
      // Get ZHVI data for all zips in the same period
      // Limit to 50k to prevent OOM, though zips are ~33k usually.
      const { data: zhviData } = await this.supabase
        .from('zillow_zip')
        .select('region_name, value, county_fips')
        .eq('metric_name', 'zhvi')
        .eq('period_date', targetDate)
        .not('value', 'is', null)
        .limit(50000);

      if (!zhviData || zhviData.length === 0) {
        continue;
      }

      const priceByZip: Record<string, number> = {};
      const zipToCounty: Record<string, string> = {};
      const normalizeFipsZip = (f: string | null | undefined) =>
        f && /^\d+$/.test(f) ? String(parseInt(f, 10)).padStart(5, '0') : f ?? null;

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

          const capRate = this.calculateCapRate(zori, price);
          const grossYield = this.calculateGrossYield(zori, price);
          const rentToPriceRatio = this.calculateRentToPriceRatio(zori, price);
          const grm = this.calculateGRM(price, zori);

          recordsToUpsert.push({
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
          });
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

      // ZIP fallback: estimated cap rate
      const countyRentByFips: Record<string, number> = {};
      const { data: countyZoriRows } = await this.supabase
        .from('zillow_county')
        .select('fips_code, value')
        .eq('metric_name', 'zori')
        .eq('period_date', targetDate)
        .not('value', 'is', null);

      if (countyZoriRows) {
        for (const r of countyZoriRows) {
          const fips = normalizeFipsZip(r.fips_code);
          if (fips && r.value) countyRentByFips[fips] = r.value;
        }
      }

      const targetYear = parseInt(targetDate.substring(0, 4));
      const { data: fmrRows } = await this.supabase
        .from('hud_fmr')
        .select('fips_code, fmr_2br')
        .eq('year', targetYear)
        .not('fmr_2br', 'is', null);

      if (fmrRows) {
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

        const capRate = this.calculateCapRate(countyRent, price);
        const grossYield = this.calculateGrossYield(countyRent, price);
        const rentToPriceRatio = this.calculateRentToPriceRatio(countyRent, price);
        const grm = this.calculateGRM(price, countyRent);

        zipFallbackBatch.push({
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
        });
      }

      if (zipFallbackBatch.length > 0) {
        const zipFallbackChunkSize = 500;
        for (let i = 0; i < zipFallbackBatch.length; i += zipFallbackChunkSize) {
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

        // Get HUD FMR for rent proxy
        const { data: fmrRowsForZip } = await this.supabase
          .from('hud_fmr')
          .select('fips_code, fmr_2br')
          .eq('year', realtorYear)
          .not('fmr_2br', 'is', null);

        const fmrByFipsForZip: Record<string, number> = {};
        if (fmrRowsForZip) {
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
          const { data: zoriRowsZip } = await this.supabase
            .from('zillow_county')
            .select('fips_code, value')
            .eq('metric_name', 'zori')
            .eq('period_date', latestZoriDateZip.period_date)
            .not('value', 'is', null);

          if (zoriRowsZip) {
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
            const rent = countyZoriForZip[countyFips] ?? fmrByFipsForZip[countyFips];
            if (!rent || rent <= 0) continue;

            const capRate = this.calculateCapRate(rent, price);
            const grossYield = this.calculateGrossYield(rent, price);
            const rentToPriceRatio = this.calculateRentToPriceRatio(rent, price);
            const grm = this.calculateGRM(price, rent);

            batch.push({
              geography_id: zipCode,
              geography_type: 'zip',
              geography_name: zip.zip_name || zipCode,
              period_date: realtorDate,
              cap_rate: capRate ? Math.round(capRate * 100) / 100 : null,
              gross_yield: grossYield
                ? Math.round(grossYield * 100) / 100
                : null,
              rent_to_price_ratio: rentToPriceRatio
                ? Math.round(rentToPriceRatio * 10000) / 10000
                : null,
              grm: grm ? Math.round(grm * 100) / 100 : null,
              calculated_at: new Date().toISOString(),
            });

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
    // so the update-only upsert preserves cap_rate/gross_yield/grm
    const overvalued = await this.calculateOvervaluedForMetros(year);

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
