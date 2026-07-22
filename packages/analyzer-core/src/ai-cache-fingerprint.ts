import type { BrrrrResult, DealInput, FlipResult, RentalResult } from "./types";

/**
 * Canonical rounding + serialization rules for the analyzer's AI-insights
 * cache/refetch discriminator.
 *
 * The frontend's react-query discriminator
 * (`app/(app)/analyzer/lib/use-section-ai-insights.ts`) and the backend's
 * Redis cache key (`ai-insights.cache.ts` `computeKey()`) both need to bucket
 * the SAME set of numeric deal/grading figures into the SAME coarse buckets
 * — fine enough that a user-perceptible change (a different cashflow
 * bracket, a new auto-kill) invalidates the cache/refetches, coarse enough
 * that cosmetic jitter (a $4 cashflow swing) doesn't force a refetch or a
 * cache miss.
 *
 * Scope: `assemblePrompt` (`packages/backend/src/analyzer/prompts/
 * assemble-prompt.ts`) JSON-stringifies the ENTIRE `DealInput` and the
 * ENTIRE `{ rental, flip, brrrr }` result object verbatim into the prompt —
 * so any field on any of those shapes can change the narrative the AI
 * writes. This fingerprint covers the full surface of `DealInput`,
 * `RentalResult`, `FlipResult`, and `BrrrrResult`, not just the handful of
 * headline figures a first pass might reach for. Previously each side
 * hand-rolled its own partial, drifting rounding formulas (the frontend
 * rounded price to "thousands" while the backend rounded to the nearest
 * thousand DOLLARS — same intended bucket width, different literal
 * formulas — and neither tracked financing terms, property class, or any
 * flip/BRRRR figures at all, so editing those could silently keep serving a
 * stale 24h-cached narrative that cites the old numbers). This module is the
 * single source of truth so the two layers can't independently diverge, and
 * so a new DealInput/result field doesn't quietly fall through the cracks
 * again — add it here once and both call sites pick it up.
 */

export interface AiInsightsFingerprintInput {
  /** Full deal input. `assemblePrompt` JSON-stringifies this verbatim. */
  input: DealInput | null | undefined;
  /** Whichever strategy result(s) the payload carries. `assemblePrompt`
   *  JSON-stringifies `payload.result` as a whole (`{ rental, flip, brrrr }`),
   *  so all three are captured here regardless of which strategy is active. */
  rental?: RentalResult | null;
  flip?: FlipResult | null;
  brrrr?: BrrrrResult | null;
  /** Grading snapshot driving the recommendation narrative. */
  finalGpa: number | null | undefined;
  letter: string | null | undefined;
  autoKillCodes: readonly string[] | null | undefined;
  /** Active strategy and investor goal, which frame the prompt. */
  strategy: string | null | undefined;
  goal: string | null | undefined;
  /** 30-year wealth-projection headline figure the projection section cites. */
  projectionFinalEquity: number | null | undefined;
  /** PIQ scores by geography level the AI is shown. */
  piqByGeo:
    | { metro?: number | null; county?: number | null; zip?: number | null }
    | null
    | undefined;
  /** Resolved geography level (e.g. "metro", "county", "zip"). */
  geoLevel: string | null | undefined;
}

/**
 * Round `value` to the nearest multiple of `bucket`. `null`/`undefined`
 * default to 0 so callers don't need to guard optional numeric fields before
 * passing them in.
 */
export function roundToBucket(
  value: number | null | undefined,
  bucket: number,
): number {
  return Math.round((value ?? 0) / bucket) * bucket;
}

/** Fixed-precision string for a ratio/percent/score field. Defaults to 0. */
function fixed(value: number | null | undefined, digits: number): string {
  return (value ?? 0).toFixed(digits);
}

/**
 * Every field of `DealInput` that can move the narrative: dollar figures are
 * bucket-rounded (via `roundToBucket`, sized to the field's typical
 * magnitude); percentages/ratios are fixed-precision (matching the existing
 * dscr/finalGpa pattern below); small-domain fields (term years, unit count,
 * property class) are included as-is since they only take a handful of
 * discrete values.
 */
function dealInputFingerprint(input: DealInput | null | undefined): string {
  if (!input) return "";
  const financing = input.financing ?? ({} as DealInput["financing"]);
  return [
    roundToBucket(input.price, 1000),
    roundToBucket(input.rentMonthly, 25),
    roundToBucket(input.taxAnnual, 100),
    roundToBucket(input.insuranceAnnual, 100),
    roundToBucket(input.hoaMonthly, 25),
    fixed(input.maintenancePctOfRent, 2),
    fixed(input.vacancyPctOfRent, 2),
    fixed(input.managementPctOfRent, 2),
    fixed(financing.downPaymentPct, 2),
    fixed(financing.interestRatePct, 2),
    financing.termYears ?? 0,
    fixed(financing.closingCostsPct, 2),
    financing.amortizationYears ?? 0,
    input.propertyClass ?? "",
    input.unitCount ?? 0,
    fixed(input.marketCapRatePct, 2),
    fixed(input.targetDSCR, 2),
    roundToBucket(input.capexReserveAnnualPerUnit, 50),
  ].join(",");
}

/**
 * Every field of `RentalResult`, including the commercial-underwriting
 * sub-object (present only for `propertyClass === "commercial_mf"`).
 */
function rentalResultFingerprint(
  rental: RentalResult | null | undefined,
): string {
  if (!rental) return "";
  const commercial = rental.commercial;
  return [
    roundToBucket(rental.noiAnnual, 500),
    fixed(rental.capRatePct, 2),
    fixed(rental.cashOnCashPct, 2),
    fixed(rental.dscr, 2),
    roundToBucket(rental.cashflowMonthly, 50),
    fixed(rental.onePctRulePct, 2),
    roundToBucket(rental.totalCashInvested, 1000),
    roundToBucket(rental.monthlyDebtService, 25),
    commercial ? roundToBucket(commercial.effectiveLoan, 1000) : "",
    commercial ? commercial.bindingConstraint : "",
    commercial ? roundToBucket(commercial.balloonBalance, 1000) : "",
  ].join(",");
}

/** Every field of `FlipResult`. */
function flipResultFingerprint(flip: FlipResult | null | undefined): string {
  if (!flip) return "";
  return [
    roundToBucket(flip.mao70, 500),
    roundToBucket(flip.wholetailMax, 500),
    roundToBucket(flip.projectedProfit, 500),
    fixed(flip.projectedRoiPct, 2),
  ].join(",");
}

/** Every top-level field of `BrrrrResult` (nested timeline/sensitivity/
 *  postRefiProjection detail isn't cited verbatim by the narrative — the
 *  headline score/cashflow/cash-out figures are). */
function brrrrResultFingerprint(brrrr: BrrrrResult | null | undefined): string {
  if (!brrrr) return "";
  return [
    fixed(brrrr.score, 1),
    roundToBucket(brrrr.refinanceCashOut, 1000),
    roundToBucket(brrrr.remainingCashInDeal, 1000),
    roundToBucket(brrrr.postRefiCashflowMonthly, 50),
    brrrr.rating ?? "",
  ].join(",");
}

/**
 * Build the canonical fingerprint string for a set of analyzer AI-insights
 * inputs. Deterministic and order-stable — the same inputs always produce
 * the same string. Field order and bucket widths are the contract between
 * the two call sites; don't change them without updating both (and, on the
 * backend, bumping `PROMPT_REVISION` if the change should force a fresh
 * regeneration of already-cached responses).
 */
export function buildAiInsightsFingerprint(
  input: AiInsightsFingerprintInput,
): string {
  return [
    input.piqByGeo?.metro ?? "",
    input.piqByGeo?.county ?? "",
    input.piqByGeo?.zip ?? "",
    input.geoLevel ?? "",
    input.letter ?? "",
    input.strategy ?? "",
    input.goal ?? "",
    roundToBucket(input.projectionFinalEquity, 1000),
    fixed(input.finalGpa, 1),
    (input.autoKillCodes ?? []).join(","),
    dealInputFingerprint(input.input),
    rentalResultFingerprint(input.rental),
    flipResultFingerprint(input.flip),
    brrrrResultFingerprint(input.brrrr),
  ].join("|");
}
