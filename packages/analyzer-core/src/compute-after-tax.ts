import type { DealInput, AfterTaxResult } from "./types";

/**
 * Pre-tax cashflow + depreciation deduction + mortgage interest deduction
 * = after-tax cashflow. Pure.
 *
 * Rent compounds by rentGrowthPct per year (vacancy/maintenance/management
 * scale with it, being %-of-rent); tax/insurance/HOA compound by
 * expenseGrowthPct. Depreciation stays flat (fixed basis). Defaults keep the
 * historical flat behavior (0 growth).
 *
 * Defaults: marginalTaxRate 0.24, landValuePct 0.25, years 10
 */
export function computeAfterTax(
  input: DealInput,
  opts?: {
    marginalTaxRate?: number;
    landValuePct?: number;
    years?: number;
    rentGrowthPct?: number;
    expenseGrowthPct?: number;
  },
): AfterTaxResult {
  const rate = opts?.marginalTaxRate ?? 0.24;
  const landPct = opts?.landValuePct ?? 0.25;
  const years = opts?.years ?? 10;
  const rentGrowth = opts?.rentGrowthPct ?? 0;
  const expenseGrowth = opts?.expenseGrowthPct ?? 0;

  const buildingBasis = input.price * (1 - landPct);
  const annualDepreciation = buildingBasis / 27.5;

  const loan = input.price * (1 - input.financing.downPaymentPct);
  const r = input.financing.interestRatePct / 100 / 12;
  const n = input.financing.termYears * 12;
  const monthlyPI = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));

  const baseRent = (input.rentMonthly ?? 0) * 12;
  const baseFixed =
    (input.taxAnnual ?? 0) +
    (input.insuranceAnnual ?? 0) +
    (input.hoaMonthly ?? 0) * 12;
  const pctOfRent =
    (input.vacancyPctOfRent ?? 0.05) +
    (input.maintenancePctOfRent ?? 0.08) +
    (input.managementPctOfRent ?? 0.08);

  let balance = loan;
  const yearly: AfterTaxResult["yearly"] = [];

  for (let year = 1; year <= years; year++) {
    let yearInterest = 0;
    for (let m = 0; m < 12; m++) {
      const interest = balance * r;
      yearInterest += interest;
      const principal = monthlyPI - interest;
      balance = Math.max(0, balance - principal);
    }
    const rent = baseRent * Math.pow(1 + rentGrowth, year - 1);
    const opex =
      baseFixed * Math.pow(1 + expenseGrowth, year - 1) + rent * pctOfRent;
    const debtService = monthlyPI * 12;
    const preTaxCashflow = rent - opex - debtService;
    const taxableIncome = rent - opex - yearInterest - annualDepreciation;
    const taxOwed = Math.max(0, taxableIncome) * rate;
    // Passive-loss tax benefit when shields drive taxable income negative.
    const taxBenefit = taxableIncome < 0 ? Math.abs(taxableIncome) * rate : 0;
    // When pre-tax cashflow is positive, the shield's value = the difference
    // between naive tax (rate × pre-tax CF) and actual tax owed.
    const estimatedTaxBenefit =
      taxBenefit - taxOwed + (preTaxCashflow > 0 ? preTaxCashflow * rate : 0);

    yearly.push({
      year,
      preTaxCashflow,
      depreciationDeduction: annualDepreciation,
      interestDeduction: yearInterest,
      estimatedTaxBenefit: Math.max(0, estimatedTaxBenefit),
      afterTaxCashflow: preTaxCashflow + Math.max(0, estimatedTaxBenefit),
    });
  }

  return { yearly };
}
