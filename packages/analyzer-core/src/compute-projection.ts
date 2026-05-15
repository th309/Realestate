import type { DealInput, ProjectionResult } from "./types";

/**
 * 30-year (or N-year) cashflow / equity / IRR projection. Pure function.
 * No IO, no Date.now(), no Math.random(). Identical inputs → identical outputs.
 */
export function computeProjection(
  input: DealInput,
  opts?: {
    years?: number;
    appreciationPct?: number;
    rentGrowthPct?: number;
    expenseGrowthPct?: number;
  },
): ProjectionResult {
  const years = opts?.years ?? 30;
  const appreciation = opts?.appreciationPct ?? 0.03;
  const rentGrowth = opts?.rentGrowthPct ?? 0.03;
  const expenseGrowth = opts?.expenseGrowthPct ?? 0.025;

  const loanAmount = input.price * (1 - input.financing.downPaymentPct);
  const monthlyRate = input.financing.interestRatePct / 100 / 12;
  const termMonths = input.financing.termYears * 12;
  const monthlyPI =
    monthlyRate === 0
      ? loanAmount / termMonths
      : (loanAmount * monthlyRate) /
        (1 - Math.pow(1 + monthlyRate, -termMonths));

  const closingCosts = input.price * (input.financing.closingCostsPct ?? 0.03);
  const initialCash =
    input.price * input.financing.downPaymentPct + closingCosts;

  let balance = loanAmount;
  let propertyValue = input.price;
  let cumulativeEquity = 0;
  let cumulativeCashflow = 0;
  let cumulativePrincipal = 0;

  const baseRent = input.rentMonthly ?? 0;
  const baseTax = input.taxAnnual ?? 0;
  const baseInsurance = input.insuranceAnnual ?? 0;
  const baseHoa = input.hoaMonthly ?? 0;
  const vacancy = input.vacancyPctOfRent ?? 0.05;
  const maintenance = input.maintenancePctOfRent ?? 0.08;
  const management = input.managementPctOfRent ?? 0.08;

  const yearly: ProjectionResult["yearly"] = [];

  for (let year = 1; year <= years; year++) {
    const yearRent = baseRent * Math.pow(1 + rentGrowth, year - 1) * 12;
    const yearTax = baseTax * Math.pow(1 + expenseGrowth, year - 1);
    const yearInsurance = baseInsurance * Math.pow(1 + expenseGrowth, year - 1);
    const yearHoa = baseHoa * 12 * Math.pow(1 + expenseGrowth, year - 1);
    const vacancyLoss = yearRent * vacancy;
    const maintCost = yearRent * maintenance;
    const mgmtCost = yearRent * management;
    const expenses =
      yearTax + yearInsurance + yearHoa + vacancyLoss + maintCost + mgmtCost;
    const debtService = monthlyPI * 12;
    const cashflow = yearRent - expenses - debtService;

    let yearPrincipal = 0;
    for (let m = 0; m < 12; m++) {
      const interest = balance * monthlyRate;
      const principal = monthlyPI - interest;
      yearPrincipal += principal;
      balance = Math.max(0, balance - principal);
    }
    cumulativePrincipal += yearPrincipal;

    propertyValue *= 1 + appreciation;
    const appreciationGain = propertyValue - input.price;
    cumulativeEquity =
      input.price * input.financing.downPaymentPct +
      cumulativePrincipal +
      appreciationGain;
    cumulativeCashflow += cashflow;

    const irrToDate = solveIRR(
      initialCash,
      cumulativeCashflow,
      cumulativeEquity,
      year,
    );
    const coCToDate =
      initialCash > 0 ? cumulativeCashflow / initialCash / year : 0;

    yearly.push({
      year,
      grossRent: yearRent,
      expenses,
      cashflow,
      principalPaydown: yearPrincipal,
      appreciationGain,
      cumulativeEquity,
      cumulativeCashflow,
      irrToDate,
      coCToDate,
    });
  }

  const at = (n: number) => {
    const row = yearly[n - 1];
    return row
      ? {
          equity: row.cumulativeEquity,
          irr: row.irrToDate,
          cashflow: row.cashflow,
        }
      : { equity: 0, irr: 0, cashflow: 0 };
  };

  return {
    yearly,
    horizons: {
      y1: at(1),
      y3: at(3),
      y5: at(5),
      y10: at(10),
      y20: at(20),
      y30: at(30),
    },
  };
}

function solveIRR(
  initialCashOut: number,
  cumulativeCashflow: number,
  cumulativeEquity: number,
  years: number,
): number {
  if (initialCashOut <= 0 || years <= 0) return 0;
  const totalReturn = cumulativeCashflow + cumulativeEquity;
  if (totalReturn <= 0) return -1;
  return Math.pow(totalReturn / initialCashOut, 1 / years) - 1;
}
