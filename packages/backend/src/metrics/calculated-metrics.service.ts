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
  zhvi_3y_cagr: number | null;
  zori_yoy: number | null;
  zori_5y_cagr: number | null;
  inventory_surplus_pct: number | null;
  overvalued_pct: number | null;
}

@Injectable()
export class CalculatedMetricsService {
  private readonly EXPENSE_RATIO = 0.6; // 60% NOI for cap rate calculation
  private readonly PRICE_TO_INCOME_BENCHMARK = 3.5; // Traditional affordability benchmark

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

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
      zhvi_3y_cagr: null,
      zori_yoy: null,
      zori_5y_cagr: null,
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
        out.set(String(id), {
          active: Number(r.active_listing_count),
          pending: Number(r.pending_listing_count),
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

        const capRate = this.calculateCapRate(zori, price);
        const grossYield = this.calculateGrossYield(zori, price);
        const rentToPriceRatio = this.calculateRentToPriceRatio(zori, price);
        const grm = this.calculateGRM(price, zori);

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
        if (targetDate === latestMosDate) {
          const m = metroMosInputs.get(String(cbsaCode));
          const mos = m
            ? this.calculateMonthsOfSupply(m.active, m.pending)
            : null;
          if (m && mos != null) {
            metroRec.months_of_supply = mos;
            metroRec.absorption_rate = this.calculateAbsorptionRate(
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

              const capRate = this.calculateCapRate(avgRent, price);
              const grossYield = this.calculateGrossYield(avgRent, price);
              const rentToPriceRatio = this.calculateRentToPriceRatio(
                avgRent,
                price,
              );
              const grm = this.calculateGRM(price, avgRent);

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
              if (targetDate === latestMosDate) {
                const m = metroMosInputs.get(String(cbsa));
                const mos = m
                  ? this.calculateMonthsOfSupply(m.active, m.pending)
                  : null;
                if (m && mos != null) {
                  hudMetroRec.months_of_supply = mos;
                  hudMetroRec.absorption_rate = this.calculateAbsorptionRate(
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

        const capRate = this.calculateCapRate(zori, price);
        const grossYield = this.calculateGrossYield(zori, price);
        const rentToPriceRatio = this.calculateRentToPriceRatio(zori, price);
        const grm = this.calculateGRM(price, zori);

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
        if (targetDate === latestCountyMosDate) {
          const m = countyMosInputs.get(String(fipsCode));
          const mos = m
            ? this.calculateMonthsOfSupply(m.active, m.pending)
            : null;
          if (m && mos != null) {
            countyRec.months_of_supply = mos;
            countyRec.absorption_rate = this.calculateAbsorptionRate(
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

            const capRate = this.calculateCapRate(fmr.rent, price);
            const grossYield = this.calculateGrossYield(fmr.rent, price);
            const rentToPriceRatio = this.calculateRentToPriceRatio(
              fmr.rent,
              price,
            );
            const grm = this.calculateGRM(price, fmr.rent);

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
            if (targetDate === latestCountyMosDate) {
              const m = countyMosInputs.get(String(fips));
              const mos = m
                ? this.calculateMonthsOfSupply(m.active, m.pending)
                : null;
              if (m && mos != null) {
                hudCountyRec.months_of_supply = mos;
                hudCountyRec.absorption_rate = this.calculateAbsorptionRate(
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

            const capRate = this.calculateCapRate(rent, price);
            const grossYield = this.calculateGrossYield(rent, price);
            const rentToPriceRatio = this.calculateRentToPriceRatio(
              rent,
              price,
            );
            const grm = this.calculateGRM(price, rent);

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
            if (storagePeriodDate === latestCountyMosDate) {
              const m = countyMosInputs.get(String(fips));
              const mos = m
                ? this.calculateMonthsOfSupply(m.active, m.pending)
                : null;
              if (m && mos != null) {
                realtorCountyRec.months_of_supply = mos;
                realtorCountyRec.absorption_rate = this.calculateAbsorptionRate(
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

          const capRate = this.calculateCapRate(zori, price);
          const grossYield = this.calculateGrossYield(zori, price);
          const rentToPriceRatio = this.calculateRentToPriceRatio(zori, price);
          const grm = this.calculateGRM(price, zori);

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
          if (targetDate === latestZipMosDate) {
            const m = zipMosInputs.get(String(zipCode));
            const mos = m
              ? this.calculateMonthsOfSupply(m.active, m.pending)
              : null;
            if (m && mos != null) {
              zipRec.months_of_supply = mos;
              zipRec.absorption_rate = this.calculateAbsorptionRate(
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

        const capRate = this.calculateCapRate(countyRent, price);
        const grossYield = this.calculateGrossYield(countyRent, price);
        const rentToPriceRatio = this.calculateRentToPriceRatio(
          countyRent,
          price,
        );
        const grm = this.calculateGRM(price, countyRent);

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
        if (targetDate === latestZipMosDate) {
          const m = zipMosInputs.get(String(zipCode));
          const mos = m
            ? this.calculateMonthsOfSupply(m.active, m.pending)
            : null;
          if (m && mos != null) {
            zipFallbackRec.months_of_supply = mos;
            zipFallbackRec.absorption_rate = this.calculateAbsorptionRate(
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

            const capRate = this.calculateCapRate(rent, price);
            const grossYield = this.calculateGrossYield(rent, price);
            const rentToPriceRatio = this.calculateRentToPriceRatio(
              rent,
              price,
            );
            const grm = this.calculateGRM(price, rent);

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
            if (zipStoragePeriodDate === latestZipMosDate) {
              const m = zipMosInputs.get(String(zipCode));
              const mos = m
                ? this.calculateMonthsOfSupply(m.active, m.pending)
                : null;
              if (m && mos != null) {
                realtorZipRec.months_of_supply = mos;
                realtorZipRec.absorption_rate = this.calculateAbsorptionRate(
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
        .range(zhviOffset, zhviOffset + 1999);
      if (!page || page.length === 0) break;
      zhviData.push(...page);
      if (page.length < 2000) break;
      zhviOffset += 2000;
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
      const overvaluedPct = this.calculateOvervalued(zhvi.value, income);
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
        .range(zhviOffset, zhviOffset + 4999);
      if (!page || page.length === 0) break;
      zhviData.push(...page);
      if (page.length < 5000) break;
      zhviOffset += 5000;
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
          .range(censusOffset, censusOffset + 1999);
        if (!page || page.length === 0) break;
        for (const row of page) {
          if (row.zcta && row.median_household_income) {
            // Normalize ZCTA to 5-digit padded string to match zillow_zip region_name
            const zcta = String(row.zcta).padStart(5, '0');
            incomeByZcta[zcta] = Number(row.median_household_income);
          }
        }
        if (page.length < 2000) break;
        censusOffset += 2000;
      }
    }

    // Compute overvalued_pct and build records
    const records: any[] = [];
    for (const [zipCode, zhvi] of Object.entries(zhviByZip)) {
      const income = incomeByZcta[zipCode] || NATIONAL_MEDIAN_INCOME;
      const overvaluedPct = this.calculateOvervalued(zhvi, income);
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
