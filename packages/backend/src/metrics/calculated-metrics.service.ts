import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.module';

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
  // From Zillow
  zori?: number;
  zhvi?: number;
  // Historical for CAGR
  listing_price_5yr_ago?: number;
  inventory_5yr_avg?: number;
  // For overvalued
  median_income?: number;
}

export interface CalculatedMetricsOutput {
  cap_rate: number | null;
  gross_yield: number | null;
  rent_to_price_ratio: number | null;
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
  ) {}

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
   * Calculate 5-Year CAGR: (current / past)^(1/5) - 1
   */
  calculate5YearCagr(current: number | undefined, past: number | undefined): number | null {
    if (!current || !past || past === 0) return null;
    return Math.pow(current / past, 1 / 5) - 1;
  }

  /**
   * Calculate Inventory Surplus %: (current - avg) / avg × 100
   */
  calculateInventorySurplus(current: number | undefined, avg: number | undefined): number | null {
    if (!current || !avg || avg === 0) return null;
    return (current - avg) / avg * 100;
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
      market_health_score: data.market_health_score,
      investment_score: data.investment_score,
      long_term_growth_score: data.long_term_growth_score,
      home_value_5yr_cagr: data.home_value_5yr_cagr,
      inventory_surplus_pct: data.inventory_surplus_pct,
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
}
