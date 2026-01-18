import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

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
  calculateCapRate(zori: number | undefined, price: number | undefined): number | null {
    if (!zori || !price || price === 0) return null;
    return (zori * 12 * this.EXPENSE_RATIO) / price * 100;
  }

  /**
   * Calculate Gross Yield: (ZORI × 12) / price × 100
   */
  calculateGrossYield(zori: number | undefined, price: number | undefined): number | null {
    if (!zori || !price || price === 0) return null;
    return (zori * 12) / price * 100;
  }

  /**
   * Calculate Rent-to-Price Ratio: ZORI / price
   */
  calculateRentToPriceRatio(zori: number | undefined, price: number | undefined): number | null {
    if (!zori || !price || price === 0) return null;
    return zori / price;
  }

  /**
   * Calculate Gross Rent Multiplier (GRM): price / (ZORI × 12)
   * Lower GRM indicates potentially better investment value
   * Typical range: 8-20 years
   */
  calculateGRM(price: number | undefined, zori: number | undefined): number | null {
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
  calculateMonthsOfSupply(inventory: number | undefined, monthlySales: number | undefined): number | null {
    if (!inventory || !monthlySales || monthlySales === 0) return null;
    return inventory / monthlySales;
  }

  /**
   * Calculate Absorption Rate: (monthly_sales / inventory) × 100
   * Percentage of available inventory sold per month
   * Higher rate indicates stronger demand
   */
  calculateAbsorptionRate(monthlySales: number | undefined, inventory: number | undefined): number | null {
    if (!monthlySales || !inventory || inventory === 0) return null;
    return (monthlySales / inventory) * 100;
  }

  /**
   * Calculate 5-Year CAGR: (current / past)^(1/5) - 1
   */
  calculate5YearCagr(current: number | undefined, past: number | undefined): number | null {
    if (!current || !past || past === 0) return null;
    return Math.pow(current / past, 1 / 5) - 1;
  }

  /**
   * Calculate Inventory Surplus: Current Inventory - Historical Average Inventory
   * Positive values indicate more homes available than typical (buyer's market)
   * Negative values indicate fewer homes than typical (seller's market)
   */
  calculateInventorySurplus(current: number | undefined, avg: number | undefined): number | null {
    if (!current || !avg) return null;
    return current - avg;
  }

  /**
   * Calculate Overvalued %: (price_to_income - benchmark) / benchmark × 100
   */
  calculateOvervalued(price: number | undefined, income: number | undefined): number | null {
    if (!price || !income || income === 0) return null;
    const priceToIncome = price / income;
    return (priceToIncome - this.PRICE_TO_INCOME_BENCHMARK) / this.PRICE_TO_INCOME_BENCHMARK * 100;
  }

  /**
   * Calculate Market Health Score (0-100)
   * Components: DOM (inverse), inventory, price cuts (inverse), pending ratio
   */
  calculateMarketHealthScore(
    dom: number | undefined,
    inventoryYoy: number | undefined,
    priceCutShare: number | undefined,
    pendingRatio: number | undefined
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
      const inventoryScore = Math.max(0, Math.min(100, 50 + inventoryYoy * 2.5));
      score += inventoryScore - 50;
      factors++;
    }

    // Price cut share (lower is better, typical range 0-30%)
    if (priceCutShare !== undefined && priceCutShare !== null) {
      const priceCutScore = Math.max(0, Math.min(100, 100 - (priceCutShare / 0.30) * 100));
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
    return Math.max(0, Math.min(100, score / factors * 2));
  }

  /**
   * Calculate Investment Score (0-100)
   * Components: cap rate, gross yield, rent growth (if available)
   */
  calculateInvestmentScore(
    capRate: number | null,
    grossYield: number | null,
    rentGrowth?: number
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
    priceYoy: number | undefined
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
    const capRate = this.calculateCapRate(input.zori, input.median_listing_price);
    const grossYield = this.calculateGrossYield(input.zori, input.median_listing_price);
    const rentToPriceRatio = this.calculateRentToPriceRatio(input.zori, input.median_listing_price);
    const grm = this.calculateGRM(input.median_listing_price, input.zori);
    const monthsOfSupply = this.calculateMonthsOfSupply(input.active_listing_count, input.monthly_sales);
    const absorptionRate = this.calculateAbsorptionRate(input.monthly_sales, input.active_listing_count);
    const homeValue5yrCagr = this.calculate5YearCagr(
      input.median_listing_price,
      input.listing_price_5yr_ago
    );
    const inventorySurplusPct = this.calculateInventorySurplus(
      input.active_listing_count,
      input.inventory_5yr_avg
    );
    const overvaluedPct = this.calculateOvervalued(input.median_listing_price, input.median_income);

    const marketHealthScore = this.calculateMarketHealthScore(
      input.median_days_on_market,
      undefined, // inventory YoY would need to be calculated separately
      input.price_reduced_share,
      input.pending_ratio
    );

    const investmentScore = this.calculateInvestmentScore(capRate, grossYield);
    const longTermGrowthScore = this.calculateLongTermGrowthScore(homeValue5yrCagr, undefined);

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
    metrics: CalculatedMetricsOutput
  ): Promise<void> {
    const { error } = await this.supabase
      .from('calculated_metrics')
      .upsert({
        geography_id: input.geography_id,
        geography_type: input.geography_type,
        geography_name: input.geography_name,
        period_date: input.period_date,
        ...metrics,
        calculated_at: new Date().toISOString(),
      }, {
        onConflict: 'geography_id,geography_type,period_date',
      });

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
    periodDate?: string
  ): Promise<CalculatedMetricsOutput | null> {
    let query = this.supabase
      .from('calculated_metrics')
      .select('*')
      .eq('geography_id', geographyId)
      .eq('geography_type', geographyType);

    if (periodDate) {
      query = query.eq('period_date', periodDate);
    } else {
      query = query.order('period_date', { ascending: false }).limit(1);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return null;
    }

    return {
      cap_rate: data.cap_rate,
      gross_yield: data.gross_yield,
      rent_to_price_ratio: data.rent_to_price_ratio,
      grm: data.grm,
      months_of_supply: data.months_of_supply,
      absorption_rate: data.absorption_rate,
      market_health_score: data.market_health_score,
      investment_score: data.investment_score,
      long_term_growth_score: data.long_term_growth_score,
      home_value_5yr_cagr: data.home_value_5yr_cagr,
      inventory_surplus_pct: data.inventory_surplus,
      overvalued_pct: data.overvalued_pct,
    };
  }

  /**
   * Get calculated metrics for multiple geographies (for map display)
   */
  async getMetricsForMap(
    geographyType: string,
    metricName: keyof CalculatedMetricsOutput,
    periodDate?: string
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
  async calculate5YrGrowthForMetros(): Promise<{ processed: number; stored: number }> {
    // Get current date (latest data)
    const { data: latestDateRow } = await this.supabase
      .from('realtor_metro')
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
    const pastDateMax = new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get current data
    const { data: currentData } = await this.supabase
      .from('realtor_metro')
      .select('cbsa_code, cbsa_title, median_listing_price')
      .eq('period_date', targetDate)
      .not('median_listing_price', 'is', null);

    if (!currentData || currentData.length === 0) {
      return { processed: 0, stored: 0 };
    }

    // Get historical data
    const { data: pastData } = await this.supabase
      .from('realtor_metro')
      .select('cbsa_code, median_listing_price')
      .gte('period_date', pastDateStr)
      .lte('period_date', pastDateMax)
      .not('median_listing_price', 'is', null)
      .order('period_date', { ascending: true });

    // Build lookup for past values (earliest available per region)
    const pastByRegion: Record<string, number> = {};
    if (pastData) {
      for (const row of pastData) {
        if (!pastByRegion[row.cbsa_code]) {
          pastByRegion[row.cbsa_code] = row.median_listing_price;
        }
      }
    }

    // Calculate and store
    let stored = 0;
    for (const metro of currentData) {
      const pastValue = pastByRegion[metro.cbsa_code];
      if (!pastValue || pastValue === 0) continue;

      const growthPct = ((metro.median_listing_price - pastValue) / pastValue) * 100;

      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert({
          geography_id: metro.cbsa_code,
          geography_type: 'metro',
          geography_name: metro.cbsa_title,
          period_date: targetDate,
          home_value_5yr_cagr: Math.round(growthPct * 100) / 100,
          calculated_at: new Date().toISOString(),
        }, {
          onConflict: 'geography_id,geography_type,period_date',
        });

      if (!error) stored++;
    }

    return { processed: currentData.length, stored };
  }

  /**
   * Calculate and store 5-year home value growth for all states
   */
  async calculate5YrGrowthForStates(): Promise<{ processed: number; stored: number }> {
    // Get current date
    const { data: latestDateRow } = await this.supabase
      .from('realtor_state')
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
    const pastDateMax = new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

      const growthPct = ((state.median_listing_price - pastValue) / pastValue) * 100;

      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert({
          geography_id: state.state_id,
          geography_type: 'state',
          geography_name: state.state_name,
          period_date: targetDate,
          home_value_5yr_cagr: Math.round(growthPct * 100) / 100,
          calculated_at: new Date().toISOString(),
        }, {
          onConflict: 'geography_id,geography_type,period_date',
        });

      if (!error) stored++;
    }

    return { processed: currentData.length, stored };
  }

  /**
   * Calculate and store 5-year home value growth for all counties (paginated)
   */
  async calculate5YrGrowthForCounties(): Promise<{ processed: number; stored: number }> {
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
    const pastDateMax = new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

      const growthPct = ((county.median_listing_price - pastValue) / pastValue) * 100;
      recordsToUpsert.push({
        geography_id: county.county_fips,
        geography_type: 'county',
        geography_name: county.county_name,
        period_date: targetDate,
        home_value_5yr_cagr: Math.round(growthPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      });

      // Batch upsert
      if (recordsToUpsert.length >= batchSize) {
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
        if (!error) stored += recordsToUpsert.length;
        recordsToUpsert.length = 0;
      }
    }

    // Upsert remaining records
    if (recordsToUpsert.length > 0) {
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
      if (!error) stored += recordsToUpsert.length;
    }

    return { processed: allCurrentData.length, stored };
  }

  /**
   * Calculate and store 5-year home value growth for all zip codes (paginated)
   */
  async calculate5YrGrowthForZips(): Promise<{ processed: number; stored: number }> {
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
    const pastDateMax = new Date(fiveYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
      if (!pastByRegion[row.postal_code]) {
        pastByRegion[row.postal_code] = row.median_listing_price;
      }
    }

    // Batch upsert
    let stored = 0;
    const batchSize = 100;
    const recordsToUpsert: any[] = [];

    for (const zip of allCurrentData) {
      const pastValue = pastByRegion[zip.postal_code];
      if (!pastValue || pastValue === 0) continue;

      const growthPct = ((zip.median_listing_price - pastValue) / pastValue) * 100;
      recordsToUpsert.push({
        geography_id: zip.postal_code,
        geography_type: 'zip',
        geography_name: zip.zip_name,
        period_date: targetDate,
        home_value_5yr_cagr: Math.round(growthPct * 100) / 100,
        calculated_at: new Date().toISOString(),
      });

      if (recordsToUpsert.length >= batchSize) {
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
        if (!error) stored += recordsToUpsert.length;
        recordsToUpsert.length = 0;
      }
    }

    if (recordsToUpsert.length > 0) {
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
      if (!error) stored += recordsToUpsert.length;
    }

    return { processed: allCurrentData.length, stored };
  }

  /**
   * Calculate 5-year growth for all geographies
   */
  async calculate5YrGrowthForAll(): Promise<{
    metros: { processed: number; stored: number };
    states: { processed: number; stored: number };
    counties: { processed: number; stored: number };
    zips: { processed: number; stored: number };
  }> {
    const [metros, states, counties, zips] = await Promise.all([
      this.calculate5YrGrowthForMetros(),
      this.calculate5YrGrowthForStates(),
      this.calculate5YrGrowthForCounties(),
      this.calculate5YrGrowthForZips(),
    ]);

    return { metros, states, counties, zips };
  }

  /**
   * Get pre-calculated 5-year growth data for map display
   */
  async get5YrGrowthForMap(
    geographyType: 'metro' | 'state' | 'county' | 'zip'
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
        .select('geography_id, geography_name, home_value_5yr_cagr, period_date')
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
    const results = allData.map(row => ({
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
  async calculateInvestmentMetricsForMetros(): Promise<{ processed: number; stored: number; errors: string[] }> {
    const errors: string[] = [];

    // Get latest ZORI date from zillow_metro table (long format)
    const { data: zoriDateRow } = await this.supabase
      .from('zillow_metro')
      .select('period_date')
      .eq('metric_name', 'zori')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!zoriDateRow?.period_date) {
      return { processed: 0, stored: 0, errors: ['No ZORI data available'] };
    }

    const targetDate = zoriDateRow.period_date;

    // Get ZORI (rent) data for all metros from zillow_metro table
    const { data: zoriData, error: zoriError } = await this.supabase
      .from('zillow_metro')
      .select('region_id, region_name, value, cbsa_code')
      .eq('metric_name', 'zori')
      .eq('period_date', targetDate)
      .not('value', 'is', null);

    if (zoriError || !zoriData) {
      return { processed: 0, stored: 0, errors: [zoriError?.message || 'Failed to fetch ZORI data'] };
    }

    // Get Realtor listing price data (closest date)
    const { data: realtorDateRow } = await this.supabase
      .from('realtor_metro')
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    const realtorDate = realtorDateRow?.period_date || targetDate;

    const { data: realtorData } = await this.supabase
      .from('realtor_metro')
      .select('cbsa_code, median_listing_price')
      .eq('period_date', realtorDate)
      .not('median_listing_price', 'is', null);

    // Build price lookup by CBSA code
    const priceByCode: Record<string, number> = {};
    if (realtorData) {
      for (const row of realtorData) {
        if (row.cbsa_code && row.median_listing_price) {
          priceByCode[row.cbsa_code] = row.median_listing_price;
        }
      }
    }

    // Calculate and batch upsert
    let stored = 0;
    const batchSize = 100;
    const recordsToUpsert: any[] = [];

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
        rent_to_price_ratio: rentToPriceRatio ? Math.round(rentToPriceRatio * 10000) / 10000 : null,
        grm: grm ? Math.round(grm * 100) / 100 : null,
        calculated_at: new Date().toISOString(),
      });

      if (recordsToUpsert.length >= batchSize) {
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
        if (error) {
          errors.push(error.message);
        } else {
          stored += recordsToUpsert.length;
        }
        recordsToUpsert.length = 0;
      }
    }

    // Upsert remaining
    if (recordsToUpsert.length > 0) {
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
      if (error) {
        errors.push(error.message);
      } else {
        stored += recordsToUpsert.length;
      }
    }

    return { processed: zoriData.length, stored, errors };
  }

  /**
   * Calculate and store overvalued percentage for all metros
   * Uses ZHVI and Census median income data
   */
  async calculateOvervaluedForMetros(): Promise<{ processed: number; stored: number; errors: string[] }> {
    const errors: string[] = [];
    const NATIONAL_MEDIAN_INCOME = 75000;

    // Get latest ZHVI date from zillow_metro table (long format)
    const { data: zhviDateRow } = await this.supabase
      .from('zillow_metro')
      .select('period_date')
      .eq('metric_name', 'zhvi')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!zhviDateRow?.period_date) {
      return { processed: 0, stored: 0, errors: ['No ZHVI data available'] };
    }

    const targetDate = zhviDateRow.period_date;

    // Get ZHVI data for all metros from zillow_metro table
    const { data: zhviData, error: zhviError } = await this.supabase
      .from('zillow_metro')
      .select('region_id, region_name, value, cbsa_code')
      .eq('metric_name', 'zhvi')
      .eq('period_date', targetDate)
      .not('value', 'is', null);

    if (zhviError || !zhviData) {
      return { processed: 0, stored: 0, errors: [zhviError?.message || 'Failed to fetch ZHVI data'] };
    }

    // Get Census median income data
    const { data: incomeData } = await this.supabase
      .from('census_data')
      .select('geography_id, value')
      .eq('geography_type', 'metro')
      .eq('metric_name', 'median_income')
      .order('year', { ascending: false });

    // Build income lookup
    const incomeByGeo: Record<string, number> = {};
    if (incomeData) {
      for (const row of incomeData) {
        if (row.value && !incomeByGeo[row.geography_id]) {
          incomeByGeo[row.geography_id] = Number(row.value);
        }
      }
    }

    // Calculate and batch upsert
    let stored = 0;
    const batchSize = 100;
    const recordsToUpsert: any[] = [];

    for (const metro of zhviData) {
      const cbsaCode = metro.cbsa_code;
      const zhvi = metro.value;
      const medianIncome = (cbsaCode && incomeByGeo[cbsaCode]) || NATIONAL_MEDIAN_INCOME;

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
        const { error } = await this.supabase
          .from('calculated_metrics')
          .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
        if (error) {
          errors.push(error.message);
        } else {
          stored += recordsToUpsert.length;
        }
        recordsToUpsert.length = 0;
      }
    }

    // Upsert remaining
    if (recordsToUpsert.length > 0) {
      const { error } = await this.supabase
        .from('calculated_metrics')
        .upsert(recordsToUpsert, { onConflict: 'geography_id,geography_type,period_date' });
      if (error) {
        errors.push(error.message);
      } else {
        stored += recordsToUpsert.length;
      }
    }

    return { processed: zhviData.length, stored, errors };
  }

  /**
   * Get pre-calculated investment metrics for map display
   */
  async getInvestmentMetricsForMap(
    metricName: 'cap_rate' | 'gross_yield' | 'rent_to_price_ratio' | 'grm' | 'overvalued_pct',
    geographyType: 'metro' = 'metro'
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

    // Get all data for that period
    const { data: allData, error } = await this.supabase
      .from('calculated_metrics')
      .select(`geography_id, geography_name, ${metricName}, period_date`)
      .eq('geography_type', geographyType)
      .eq('period_date', latestRow.period_date)
      .not(metricName, 'is', null);

    if (error || !allData) {
      return { data: [], success: false, source: 'calculated_metrics' };
    }

    // Transform to API format
    const results = allData.map(row => ({
      region_id: row.geography_id,
      region_name: row.geography_name,
      cbsa_code: row.geography_id,
      value: row[metricName],
      [metricName]: row[metricName],
      date: row.period_date,
    }));

    return { data: results, success: true, source: 'calculated_metrics' };
  }

  /**
   * Calculate all investment metrics for all metros (master batch)
   */
  async calculateAllInvestmentMetrics(): Promise<{
    investmentMetrics: { processed: number; stored: number; errors: string[] };
    overvalued: { processed: number; stored: number; errors: string[] };
  }> {
    const [investmentMetrics, overvalued] = await Promise.all([
      this.calculateInvestmentMetricsForMetros(),
      this.calculateOvervaluedForMetros(),
    ]);

    return { investmentMetrics, overvalued };
  }
}
