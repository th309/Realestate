/**
 * Cross-strategy primitive math helpers.
 *
 * Every function here takes primitive arguments or a narrow plain-object
 * opts bag — NO strategy-specific input types (no DealInput, no
 * FixAndFlipInput). This keeps the helpers reusable across buy-and-hold,
 * fix-and-flip, BRRRR, and any future strategy.
 *
 * Single-responsibility, pure functions only. Each formula is documented
 * with its math and units. Degenerate inputs return either 0 or Infinity
 * with explicit handling — never NaN.
 *
 * Unit conventions matching analyzer-core throughout:
 *   - `annualRatePct` is in PERCENT form (7 = 7%, NOT 0.07)
 *   - `*Pct` opts fields are DECIMAL fractions (0.05 = 5%, NOT 5)
 *   - All dollar amounts are nominal USD
 *   - "annual" suffix = per-year totals; "monthly" suffix = per-month
 */

// ---- Financing primitives --------------------------------------------------

/**
 * Standard amortizing P&I monthly payment.
 *
 * Formula:  M = L · r·(1+r)^n / ((1+r)^n − 1)
 *           where L = principal, r = monthly rate, n = total months
 *
 * Degenerate cases:
 *   - principal ≤ 0 → 0 (no loan, no payment)
 *   - termYears ≤ 0 → 0
 *   - annualRatePct = 0 → straight-line principal / total months (no interest)
 *
 * @param principal      Loan amount in dollars
 * @param annualRatePct  Annual interest rate in PERCENT units (7 = 7%)
 * @param termYears      Amortization period in years
 * @returns              Monthly principal + interest payment in dollars
 */
export function monthlyPI(
  principal: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (principal <= 0 || termYears <= 0) return 0;
  const n = termYears * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Monthly interest portion of an interest-only loan, or the first-month
 * interest component of an amortizing loan.
 *
 * Formula:  I = balance · (annualRatePct / 100) / 12
 *
 * @param loanBalance    Current loan balance in dollars
 * @param annualRatePct  Annual interest rate in PERCENT units (7 = 7%)
 * @returns              Monthly interest in dollars
 */
export function monthlyLoanInterest(
  loanBalance: number,
  annualRatePct: number,
): number {
  if (loanBalance <= 0 || annualRatePct <= 0) return 0;
  return (loanBalance * (annualRatePct / 100)) / 12;
}

// ---- Rental cashflow primitives -------------------------------------------

/**
 * Annual operating expenses for a rental property — EXCLUDING vacancy loss.
 * Vacancy is modeled as a top-line gross-rent reduction in `noiAnnual`.
 *
 * Formula:  opex = taxAnnual + insuranceAnnual + (hoaMonthly · 12)
 *                + (grossRentAnnual · maintenancePct)
 *                + (grossRentAnnual · pmPct)
 *                + (grossRentAnnual · capexPct)
 *
 * Maintenance, capex, and PM are expressed as fractions of GROSS RENT
 * (a residential underwriting convention). Capex is optional — pass 0 if
 * already buried in maintenance.
 */
export function operatingExpensesAnnual(opts: {
  monthlyRent: number;
  maintenancePct: number;
  capexPct: number;
  pmPct: number;
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  hoaMonthly: number;
}): number {
  const grossRentAnnual = opts.monthlyRent * 12;
  const maint = grossRentAnnual * opts.maintenancePct;
  const capex = grossRentAnnual * opts.capexPct;
  const pm = grossRentAnnual * opts.pmPct;
  const hoa = opts.hoaMonthly * 12;
  return (
    opts.propertyTaxAnnual + opts.insuranceAnnual + maint + capex + pm + hoa
  );
}

/**
 * Annual NOI (Net Operating Income).
 *
 * Formula:  NOI = (grossRentAnnual · (1 − vacancyPct)) − opex
 *
 * Vacancy is treated as a top-line reduction. Opex is computed via
 * `operatingExpensesAnnual` from the same opts so both stay consistent.
 */
export function noiAnnual(opts: {
  monthlyRent: number;
  vacancyPct: number;
  maintenancePct: number;
  capexPct: number;
  pmPct: number;
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  hoaMonthly: number;
}): number {
  const grossRentAnnual = opts.monthlyRent * 12;
  const effectiveGross = grossRentAnnual * (1 - opts.vacancyPct);
  const opex = operatingExpensesAnnual(opts);
  return effectiveGross - opex;
}

// ---- Underwriting ratios ---------------------------------------------------

/**
 * Debt Service Coverage Ratio: NOI ÷ annual debt service.
 *
 * Returns Infinity when debt service is 0 (no loan = infinite coverage).
 * Lenders typically require ≥ 1.2 for residential, ≥ 1.25 for commercial.
 */
export function dscr(
  noiAnnualValue: number,
  debtServiceAnnual: number,
): number {
  if (debtServiceAnnual === 0) return Number.POSITIVE_INFINITY;
  return noiAnnualValue / debtServiceAnnual;
}

/**
 * Cap rate: NOI ÷ property value, as a decimal fraction.
 *
 * Returns 0 when value is non-positive (cap rate is undefined without a price).
 * To display as a percentage, multiply by 100.
 */
export function capRate(noiAnnualValue: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0;
  return noiAnnualValue / propertyValue;
}

/**
 * Monthly cash flow per door (per rental unit).
 *
 * Formula:  cfPerDoor = annualPretaxCashFlow / 12 / doors
 *
 * Zero doors is treated as 1 (defensive) to avoid division-by-zero — a
 * deal with no doors shouldn't reach this helper, but we don't want a NaN
 * propagating through the grade pipeline if it does.
 */
export function cashFlowPerDoorMonthly(
  annualPretaxCashFlow: number,
  doors: number,
): number {
  const safeDoors = doors > 0 ? doors : 1;
  return annualPretaxCashFlow / 12 / safeDoors;
}

/**
 * Break-even occupancy: the fraction of full rent collection needed to
 * cover opex + debt service. Lower is better — a value > 1.0 means the
 * deal can't break even even at 100% occupancy.
 *
 * Formula:  beOcc = (opex + ds) / grossRentAnnual
 *
 * Returns Infinity when grossRentAnnual is 0 (deal has no rent — can never
 * break even on rental income).
 */
export function breakEvenOccupancy(
  operatingExpensesAnnualValue: number,
  debtServiceAnnual: number,
  grossRentAnnual: number,
): number {
  if (grossRentAnnual <= 0) return Number.POSITIVE_INFINITY;
  return (operatingExpensesAnnualValue + debtServiceAnnual) / grossRentAnnual;
}

// ---- Flip-side carry costs ------------------------------------------------

/**
 * Total monthly carrying cost during a flip's hold period.
 *
 * Formula:  carry = propertyTaxAnnual/12 + insuranceAnnual/12
 *                 + utilitiesMonthly + hoaMonthly + monthlyLoanInterest
 *
 * Loan interest is folded in here (rather than as a separate "financing
 * costs" line) so callers don't have to remember to add it. Pass 0 for
 * cash deals.
 */
export function monthlyHoldingCosts(opts: {
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  utilitiesMonthly: number;
  hoaMonthly: number;
  monthlyLoanInterest: number;
}): number {
  return (
    opts.propertyTaxAnnual / 12 +
    opts.insuranceAnnual / 12 +
    opts.utilitiesMonthly +
    opts.hoaMonthly +
    opts.monthlyLoanInterest
  );
}
