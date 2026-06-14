/**
 * Shared affordability / PITI calculation utilities.
 *
 * Consolidates the duplicate mortgage math that previously lived in:
 *   - usePersonalization.ts  (calculateAffordability)
 *   - AffordabilityDeepDive.tsx (estimatePITI)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PITIParams {
  price: number;
  /** Absolute dollar amount for down payment. Takes precedence over downPaymentPct. */
  downPayment?: number;
  /** Down payment as a fraction of price (0-1). Default 0.2 (20%). */
  downPaymentPct?: number;
  /** Annual interest rate as a decimal. Default 0.07 (7%). */
  interestRate?: number;
  /** Loan term in years. Default 30. */
  termYears?: number;
  /** Annual property tax rate as a decimal. Default 0.012 (1.2%). */
  taxRate?: number;
  /** Annual homeowner insurance rate as a decimal. Default 0.005 (0.5%). */
  insuranceRate?: number;
}

export interface PITIResult {
  monthlyMortgage: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPITI: number;
  loanAmount: number;
  downPaymentAmount: number;
  downPaymentPct: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_DOWN_PAYMENT_PCT = 0.2;
const DEFAULT_INTEREST_RATE = 0.07;
const DEFAULT_TERM_YEARS = 30;
const DEFAULT_TAX_RATE = 0.012;
const DEFAULT_INSURANCE_RATE = 0.005;

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Standard amortisation formula for monthly payment.
 *
 *   M = P * [ r(1+r)^n ] / [ (1+r)^n - 1 ]
 */
function monthlyPayment(
  principal: number,
  monthlyRate: number,
  numPayments: number,
): number {
  if (monthlyRate === 0) return principal / numPayments;
  const factor = Math.pow(1 + monthlyRate, numPayments);
  return principal * (monthlyRate * factor) / (factor - 1);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate full PITI breakdown for a given home price.
 *
 * If both `downPayment` (dollar) and `downPaymentPct` are supplied, the
 * dollar amount wins.  If neither is supplied, 20% of price is assumed.
 */
export function calculatePITI(params: PITIParams): PITIResult {
  const {
    price,
    interestRate = DEFAULT_INTEREST_RATE,
    termYears = DEFAULT_TERM_YEARS,
    taxRate = DEFAULT_TAX_RATE,
    insuranceRate = DEFAULT_INSURANCE_RATE,
  } = params;

  // Resolve down payment
  const downPaymentAmount =
    params.downPayment != null
      ? params.downPayment
      : price * (params.downPaymentPct ?? DEFAULT_DOWN_PAYMENT_PCT);

  const downPaymentPct = price > 0 ? downPaymentAmount / price : 0;
  const loanAmount = price - downPaymentAmount;

  const monthlyRate = interestRate / 12;
  const numPayments = termYears * 12;

  const monthlyMortgage = monthlyPayment(loanAmount, monthlyRate, numPayments);
  const monthlyTax = (price * taxRate) / 12;
  const monthlyInsurance = (price * insuranceRate) / 12;
  const monthlyPITI = monthlyMortgage + monthlyTax + monthlyInsurance;

  return {
    monthlyMortgage,
    monthlyTax,
    monthlyInsurance,
    monthlyPITI,
    loanAmount,
    downPaymentAmount,
    downPaymentPct,
  };
}

/**
 * Calculate the maximum home price affordable at a 28% front-end DTI ratio.
 *
 * Optionally accepts the same rate / term / tax / insurance overrides as
 * `calculatePITI`.  The caller may supply a fixed `downPayment` dollar
 * amount; if omitted the function falls back to 25% of the computed max
 * loan as the assumed down payment (matching the original behaviour in
 * usePersonalization).
 */
export function calculateMaxAffordablePrice(
  monthlyIncome: number,
  params?: Omit<PITIParams, 'price'>,
): number {
  const {
    interestRate = DEFAULT_INTEREST_RATE,
    termYears = DEFAULT_TERM_YEARS,
    taxRate = DEFAULT_TAX_RATE,
    insuranceRate = DEFAULT_INSURANCE_RATE,
    downPayment,
  } = params ?? {};

  const monthlyRate = interestRate / 12;
  const numPayments = termYears * 12;

  // Target: 28% of gross monthly income for housing
  const targetMonthly = monthlyIncome * 0.28;

  // The target monthly payment covers P&I + tax + insurance.
  // Tax and insurance are proportional to the home price, so we need to
  // solve for the price.  However the original implementation approximated
  // by computing a max *loan* from the target payment and then adding the
  // down payment.  We preserve that behaviour here for parity.
  const factor = Math.pow(1 + monthlyRate, numPayments);
  const paymentPerDollarLoan = (monthlyRate * factor) / (factor - 1);
  const maxLoan = targetMonthly / paymentPerDollarLoan;

  const dp = downPayment ?? maxLoan * 0.25;
  return Math.round(maxLoan + dp);
}
