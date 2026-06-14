/**
 * Pure heuristic estimates for analyzer fields that have NO data source in
 * the platform (insurance, vacancy, rent-growth) and property tax for free
 * users (no RentCast parcel access). These are honest assumptions, never
 * dressed up as sourced data — the caller stamps them kind:'estimate'.
 *
 * Unit conventions (verified against analyzer-core + analyzer-assumptions):
 *   - vacancy / rent-growth are FRACTIONS (0.05, 0.03)
 *   - insurance / tax are ANNUAL DOLLARS
 *   - appreciation INPUT here is a PERCENT (home_value_yoy, e.g. 6.2)
 */
export const INSURANCE_RATE_ANNUAL = 0.0055;
export const DEFAULT_VACANCY_FRACTION = 0.05;
export const DEFAULT_RENT_GROWTH_FRACTION = 0.03;
export const RENT_GROWTH_MIN = 0.02;
export const RENT_GROWTH_MAX = 0.05;
export const DEFAULT_EFFECTIVE_TAX_RATE = 0.011;

export function estimateInsuranceAnnual(price: number | null): number | null {
  if (!price || price <= 0) return null;
  return Math.round(price * INSURANCE_RATE_ANNUAL);
}

export function estimateVacancyFraction(): number {
  return DEFAULT_VACANCY_FRACTION;
}

/** `appreciationPercent` is the home_value_yoy percent (e.g. 6.2), not a fraction. */
export function estimateRentGrowthFraction(
  appreciationPercent: number | null,
): number {
  if (appreciationPercent == null) return DEFAULT_RENT_GROWTH_FRACTION;
  const frac = appreciationPercent / 100;
  return Math.min(RENT_GROWTH_MAX, Math.max(RENT_GROWTH_MIN, frac));
}

export function estimateTaxAnnual(price: number | null): number | null {
  if (!price || price <= 0) return null;
  return Math.round(price * DEFAULT_EFFECTIVE_TAX_RATE);
}
