export const EXPENSE_RATIO = 0.6; // 60% NOI for cap rate calculation
export const PRICE_TO_INCOME_BENCHMARK = 3.5; // Traditional affordability benchmark

/**
 * Calculate Cap Rate: (ZORI × 12 × expense_ratio) / price × 100
 */
export function calculateCapRate(
  zori: number | undefined,
  price: number | undefined,
): number | null {
  if (!zori || !price || price === 0) return null;
  return ((zori * 12 * EXPENSE_RATIO) / price) * 100;
}

/**
 * Calculate Gross Yield: (ZORI × 12) / price × 100
 */
export function calculateGrossYield(
  zori: number | undefined,
  price: number | undefined,
): number | null {
  if (!zori || !price || price === 0) return null;
  return ((zori * 12) / price) * 100;
}

/**
 * Calculate Rent-to-Price Ratio: ZORI / price
 */
export function calculateRentToPriceRatio(
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
export function calculateGRM(
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
export function calculateMonthsOfSupply(
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
export function calculateAbsorptionRate(
  monthlySales: number | undefined,
  inventory: number | undefined,
): number | null {
  if (!monthlySales || !inventory || inventory === 0) return null;
  return (monthlySales / inventory) * 100;
}

/**
 * Calculate 5-Year CAGR: (current / past)^(1/5) - 1
 */
export function calculate5YearCagr(
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
export function calculateInventorySurplus(
  current: number | undefined,
  avg: number | undefined,
): number | null {
  if (!current || !avg) return null;
  return current - avg;
}

/**
 * Calculate Overvalued %: (price_to_income - benchmark) / benchmark × 100
 */
export function calculateOvervalued(
  price: number | undefined,
  income: number | undefined,
): number | null {
  if (!price || !income || income === 0) return null;
  const priceToIncome = price / income;
  return (
    ((priceToIncome - PRICE_TO_INCOME_BENCHMARK) / PRICE_TO_INCOME_BENCHMARK) *
    100
  );
}
