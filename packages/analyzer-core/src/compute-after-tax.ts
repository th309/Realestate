import type { DealInput, AfterTaxResult } from "./types";

/**
 * Pre-tax cashflow + depreciation deduction + mortgage interest deduction
 * = after-tax cashflow. Pure.
 *
 * Defaults: marginalTaxRate 0.24, landValuePct 0.25, years 10
 */
export function computeAfterTax(
  input: DealInput,
  opts?: { marginalTaxRate?: number; landValuePct?: number; years?: number },
): AfterTaxResult {
  const rate = opts?.marginalTaxRate ?? 0.24;
  const landPct = opts?.landValuePct ?? 0.25;
  const years = opts?.years ?? 10;

  const buildingBasis = input.price * (1 - landPct);
  const annualDepreciation = buildingBasis / 27.5;

  const loan = input.price * (1 - input.financing.downPaymentPct);
  const r = input.financing.interestRatePct / 100 / 12;
  const n = input.financing.termYears * 12;
  const monthlyPI = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));

  const baseRent = (input.rentMonthly ?? 0) * 12;
  const baseTax = input.taxAnnual ?? 0;
  const baseIns = input.insuranceAnnual ?? 0;
  const baseHoa = (input.hoaMonthly ?? 0) * 12;
  const vacancy = baseRent * (input.vacancyPctOfRent ?? 0.05);
  const maint = baseRent * (input.maintenancePctOfRent ?? 0.08);
  const mgmt = baseRent * (input.managementPctOfRent ?? 0.08);
  const opex = baseTax + baseIns + baseHoa + vacancy + maint + mgmt;

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
    const debtService = monthlyPI * 12;
    const preTaxCashflow = baseRent - opex - debtService;
    const taxableIncome = baseRent - opex - yearInterest - annualDepreciation;
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
