import type { CommercialUnderwriting, DealInput, RentalResult } from "./types";

const DEFAULTS = {
  maintenance: 0.08,
  vacancy: 0.05,
  management: 0.08,
  closing: 0.03,
};

/**
 * Commercial defaults applied automatically when propertyClass === "commercial_mf"
 * and the user hasn't overridden the value. Tighter vacancy + lower mgmt fee
 * (commercial professional mgmt is ~6% vs residential ~8%) + always-present
 * capex reserves. Commercial loans have higher minimum DSCR and lower max LTV.
 */
const COMMERCIAL_DEFAULTS = {
  vacancy: 0.07,
  management: 0.06,
  capexPerUnit: 300,
  targetDSCR: 1.25,
};

export function monthlyMortgagePayment(
  loan: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (loan <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return loan / n;
  return (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Back-solve the maximum loan amount whose annual debt service stays at or
 * below `noiAnnual / targetDSCR`. Loan = (allowableDS / 12) ÷ amortizationFactor
 * where amortizationFactor = r ÷ (1 − (1+r)^−n).
 *
 * Returns 0 when NOI or DSCR are non-positive (no debt service capacity).
 */
export function maxLoanForDSCR(
  noiAnnual: number,
  targetDSCR: number,
  annualRatePct: number,
  amortizationYears: number,
): number {
  if (noiAnnual <= 0 || targetDSCR <= 0) return 0;
  const allowableAnnualDS = noiAnnual / targetDSCR;
  const monthlyAllowable = allowableAnnualDS / 12;
  const r = annualRatePct / 100 / 12;
  const n = amortizationYears * 12;
  if (r === 0) return monthlyAllowable * n;
  // monthlyPI = loan × (r / (1 − (1+r)^−n))  →  loan = monthlyPI × (1 − (1+r)^−n) / r
  return (monthlyAllowable * (1 - Math.pow(1 + r, -n))) / r;
}

/**
 * Remaining balance on an amortizing loan after `monthsPaid` months. Used to
 * compute the balloon payment when the loan term is shorter than the amort
 * period. Standard amortization formula: B_k = L × ((1+r)^n − (1+r)^k) / ((1+r)^n − 1)
 */
export function remainingBalance(
  loan: number,
  annualRatePct: number,
  amortizationYears: number,
  monthsPaid: number,
): number {
  if (loan <= 0 || monthsPaid <= 0) return loan;
  const r = annualRatePct / 100 / 12;
  const n = amortizationYears * 12;
  if (monthsPaid >= n) return 0;
  if (r === 0) return loan * (1 - monthsPaid / n);
  const num = Math.pow(1 + r, n) - Math.pow(1 + r, monthsPaid);
  const den = Math.pow(1 + r, n) - 1;
  return loan * (num / den);
}

export function computeRentalMetrics(input: DealInput): RentalResult {
  const {
    price,
    rentMonthly,
    taxAnnual,
    insuranceAnnual,
    hoaMonthly,
    financing,
  } = input;
  const isCommercial = input.propertyClass === "commercial_mf";

  // Commercial properties default to tighter vacancy + lower mgmt fee. User
  // overrides on the input win; nullish-coalesce lets explicit-zero through.
  const maintPct = input.maintenancePctOfRent ?? DEFAULTS.maintenance;
  const vacPct =
    input.vacancyPctOfRent ??
    (isCommercial ? COMMERCIAL_DEFAULTS.vacancy : DEFAULTS.vacancy);
  const mgmtPct =
    input.managementPctOfRent ??
    (isCommercial ? COMMERCIAL_DEFAULTS.management : DEFAULTS.management);
  const closingPct = financing.closingCostsPct ?? DEFAULTS.closing;

  // Commercial capex reserves are per-unit per-year, added to opex. Residential
  // already buries this in maintenancePctOfRent (rule of thumb), so we only add
  // an explicit reserve line item in commercial mode.
  const unitCount = input.unitCount ?? 1;
  const capexPerUnit =
    input.capexReserveAnnualPerUnit ??
    (isCommercial ? COMMERCIAL_DEFAULTS.capexPerUnit : 0);
  const capexReserveAnnual = isCommercial ? capexPerUnit * unitCount : 0;

  // Loan sizing: residential is pure LTV. Commercial takes min(LTV, DSCR).
  // The DSCR constraint requires NOI, so we must compute NOI BEFORE debt
  // service can be sized — order of operations matters.
  const maxLtvLoan = Math.max(0, price * (1 - financing.downPaymentPct));

  // Amortization basis for monthly P&I. When unset OR equal to termYears, it's
  // a fully amortizing loan. When greater, a balloon is due at termYears.
  const amortYears = financing.amortizationYears ?? financing.termYears;

  if (rentMonthly == null) {
    // No rent yet → can't compute NOI or DSCR → fall back to LTV-only loan
    // sizing and skip cashflow math.
    const fallbackDebtService = monthlyMortgagePayment(
      maxLtvLoan,
      financing.interestRatePct,
      amortYears,
    );
    const downPayment = price * financing.downPaymentPct;
    const closingCosts = price * closingPct;
    return {
      noiAnnual: null,
      capRatePct: null,
      cashOnCashPct: null,
      dscr: null,
      cashflowMonthly: null,
      onePctRulePct: null,
      totalCashInvested: downPayment + closingCosts,
      monthlyDebtService: fallbackDebtService,
    };
  }

  const grossRentAnnual = rentMonthly * 12;
  const vacancyLoss = grossRentAnnual * vacPct;
  const maintCost = grossRentAnnual * maintPct;
  const mgmtCost = grossRentAnnual * mgmtPct;
  const hoaAnnual = (hoaMonthly ?? 0) * 12;
  const opex =
    (taxAnnual ?? 0) +
    (insuranceAnnual ?? 0) +
    maintCost +
    mgmtCost +
    hoaAnnual +
    capexReserveAnnual;
  const noiAnnual = grossRentAnnual - vacancyLoss - opex;

  // Resolve effective loan + which constraint binds (commercial only).
  let effectiveLoan = maxLtvLoan;
  let maxDscrLoan: number | null = null;
  let bindingConstraint: CommercialUnderwriting["bindingConstraint"] = "ltv";
  if (isCommercial) {
    const targetDSCR = input.targetDSCR ?? COMMERCIAL_DEFAULTS.targetDSCR;
    maxDscrLoan = maxLoanForDSCR(
      noiAnnual,
      targetDSCR,
      financing.interestRatePct,
      amortYears,
    );
    if (maxDscrLoan < maxLtvLoan) {
      effectiveLoan = maxDscrLoan;
      bindingConstraint = "dscr";
    } else if (Math.abs(maxDscrLoan - maxLtvLoan) < 1) {
      bindingConstraint = "neither"; // both at the cap
    }
  }

  const downPayment = price - effectiveLoan;
  const closingCosts = price * closingPct;
  const totalCashInvested = downPayment + closingCosts;

  const monthlyDebtService = monthlyMortgagePayment(
    effectiveLoan,
    financing.interestRatePct,
    amortYears,
  );

  const capRatePct = price > 0 ? (noiAnnual / price) * 100 : null;
  const annualDebtService = monthlyDebtService * 12;
  const dscr = annualDebtService > 0 ? noiAnnual / annualDebtService : null;
  const cashflowMonthly = noiAnnual / 12 - monthlyDebtService;
  const cashOnCashPct =
    totalCashInvested > 0
      ? ((cashflowMonthly * 12) / totalCashInvested) * 100
      : null;
  const onePctRulePct = price > 0 ? (rentMonthly / price) * 100 : null;

  let commercial: CommercialUnderwriting | undefined;
  if (isCommercial) {
    const impliedValueAtMarketCap =
      input.marketCapRatePct && input.marketCapRatePct > 0
        ? noiAnnual / (input.marketCapRatePct / 100)
        : null;
    const balloonBalance = remainingBalance(
      effectiveLoan,
      financing.interestRatePct,
      amortYears,
      financing.termYears * 12,
    );
    commercial = {
      impliedValueAtMarketCap,
      maxLtvLoan,
      maxDscrLoan,
      effectiveLoan,
      bindingConstraint,
      balloonBalance,
      capexReserveAnnual,
    };
  }

  return {
    noiAnnual,
    capRatePct,
    cashOnCashPct,
    dscr,
    cashflowMonthly,
    onePctRulePct,
    totalCashInvested,
    monthlyDebtService,
    commercial,
  };
}
