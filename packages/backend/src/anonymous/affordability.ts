/**
 * Affordability section computation for the listing-presentation report.
 *
 * Pure functions — no DB, no DI. Computes two standard, widely-used affordability
 * indicators from metrics already fetched in the report's metric batch:
 *   1. a price-to-income affordability index (0-100, higher = more affordable)
 *   2. a price-to-rent ratio (home value ÷ annual rent)
 *
 * Both are RATIO-based, so no mortgage-rate assumption is baked in — nothing here
 * is fabricated or hidden behind an undisclosed rate. Calibration thresholds are
 * documented constants drawn from common housing-economics rules of thumb.
 */

export interface AffordabilityData {
  /** 0-100, higher = more affordable (derived from price-to-income) */
  affordabilityIndex: number;
  /** home value ÷ median household income (e.g. 4.2) */
  priceToIncome: number;
  /** gauge position 0-100 for the affordability index */
  affordabilityMarker: number;
  /** home value ÷ annual rent (e.g. 18.5); 0 when rent is unavailable */
  priceToRent: number;
  /** gauge position 0-100 (higher = more rent-favorable) */
  priceToRentMarker: number;
  /** true when rent data was available to compute price-to-rent */
  hasPriceToRent: boolean;
  limitedData: boolean;
}

// Price-to-income calibration: 2.5x = very affordable (index 100),
// 8x = severely unaffordable (index 0). US long-run norm is ~3-5x.
const PTI_AFFORDABLE = 2.5;
const PTI_UNAFFORDABLE = 8;

// Price-to-rent calibration (years of rent to buy outright): a widely-cited rule
// of thumb — <=15 favors buying, >=21 favors renting. Marker maps 10 -> 0
// (strongly buy) through 25 -> 100 (strongly rent).
const PTR_BUY = 10;
const PTR_RENT = 25;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeAffordability(
  homeValue: number | null,
  medianHouseholdIncome: number | null,
  rentIndexMonthly: number | null,
): AffordabilityData {
  const empty: AffordabilityData = {
    affordabilityIndex: 0,
    priceToIncome: 0,
    affordabilityMarker: 0,
    priceToRent: 0,
    priceToRentMarker: 0,
    hasPriceToRent: false,
    limitedData: true,
  };

  const hasIncome =
    homeValue != null &&
    homeValue > 0 &&
    medianHouseholdIncome != null &&
    medianHouseholdIncome > 0;
  if (!hasIncome) return empty;

  const priceToIncome = round1(homeValue / medianHouseholdIncome);
  const affordabilityIndex = Math.round(
    clamp(
      (100 * (PTI_UNAFFORDABLE - priceToIncome)) /
        (PTI_UNAFFORDABLE - PTI_AFFORDABLE),
      0,
      100,
    ),
  );
  // Gauge scale is [Unaffordable, Stretched, Affordable] left -> right, so the
  // marker IS the index (higher = further right = more affordable).
  const affordabilityMarker = affordabilityIndex;

  let priceToRent = 0;
  let priceToRentMarker = 0;
  let hasPriceToRent = false;
  if (rentIndexMonthly != null && rentIndexMonthly > 0) {
    priceToRent = round1(homeValue / (rentIndexMonthly * 12));
    priceToRentMarker = Math.round(
      clamp((100 * (priceToRent - PTR_BUY)) / (PTR_RENT - PTR_BUY), 0, 100),
    );
    hasPriceToRent = true;
  }

  return {
    affordabilityIndex,
    priceToIncome,
    affordabilityMarker,
    priceToRent,
    priceToRentMarker,
    hasPriceToRent,
    limitedData: false,
  };
}
