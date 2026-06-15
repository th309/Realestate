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
  calculate5YearCagr,
  calculateInventorySurplus,
  calculateOvervalued,
} from './metric-primitive-formulas';

/**
 * Calculate Market Health Score (0-100)
 * Components: DOM (inverse), inventory, price cuts (inverse), pending ratio
 */
export function calculateMarketHealthScore(
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
    const inventoryScore = Math.max(0, Math.min(100, 50 + inventoryYoy * 2.5));
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
export function calculateInvestmentScore(
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
export function calculateLongTermGrowthScore(
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
export function calculateAll(
  input: CalculatedMetricsInput,
): CalculatedMetricsOutput {
  const capRate = calculateCapRate(input.zori, input.median_listing_price);
  const grossYield = calculateGrossYield(
    input.zori,
    input.median_listing_price,
  );
  const rentToPriceRatio = calculateRentToPriceRatio(
    input.zori,
    input.median_listing_price,
  );
  const grm = calculateGRM(input.median_listing_price, input.zori);
  const monthsOfSupply = calculateMonthsOfSupply(
    input.active_listing_count,
    input.monthly_sales,
  );
  const absorptionRate = calculateAbsorptionRate(
    input.monthly_sales,
    input.active_listing_count,
  );
  const homeValue5yrCagr = calculate5YearCagr(
    input.median_listing_price,
    input.listing_price_5yr_ago,
  );
  const inventorySurplusPct = calculateInventorySurplus(
    input.active_listing_count,
    input.inventory_5yr_avg,
  );
  const overvaluedPct = calculateOvervalued(
    input.median_listing_price,
    input.median_income,
  );

  const marketHealthScore = calculateMarketHealthScore(
    input.median_days_on_market,
    undefined, // inventory YoY would need to be calculated separately
    input.price_reduced_share,
    input.pending_ratio,
  );

  const investmentScore = calculateInvestmentScore(capRate, grossYield);
  const longTermGrowthScore = calculateLongTermGrowthScore(
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
