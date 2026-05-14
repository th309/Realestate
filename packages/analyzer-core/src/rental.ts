import type { DealInput, RentalResult } from "./types";

const DEFAULTS = {
  maintenance: 0.08,
  vacancy: 0.05,
  management: 0.08,
  closing: 0.03,
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

export function computeRentalMetrics(input: DealInput): RentalResult {
  const {
    price,
    rentMonthly,
    taxAnnual,
    insuranceAnnual,
    hoaMonthly,
    financing,
  } = input;
  const maintPct = input.maintenancePctOfRent ?? DEFAULTS.maintenance;
  const vacPct = input.vacancyPctOfRent ?? DEFAULTS.vacancy;
  const mgmtPct = input.managementPctOfRent ?? DEFAULTS.management;
  const closingPct = financing.closingCostsPct ?? DEFAULTS.closing;

  const downPayment = price * financing.downPaymentPct;
  const loanAmount = price - downPayment;
  const closingCosts = price * closingPct;
  const totalCashInvested = downPayment + closingCosts;

  const monthlyDebtService = monthlyMortgagePayment(
    loanAmount,
    financing.interestRatePct,
    financing.termYears,
  );

  if (rentMonthly == null) {
    return {
      noiAnnual: null,
      capRatePct: null,
      cashOnCashPct: null,
      dscr: null,
      cashflowMonthly: null,
      onePctRulePct: null,
      totalCashInvested,
      monthlyDebtService,
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
    hoaAnnual;
  const noiAnnual = grossRentAnnual - vacancyLoss - opex;

  const capRatePct = price > 0 ? (noiAnnual / price) * 100 : null;
  const annualDebtService = monthlyDebtService * 12;
  const dscr = annualDebtService > 0 ? noiAnnual / annualDebtService : null;
  const cashflowMonthly = noiAnnual / 12 - monthlyDebtService;
  const cashOnCashPct =
    totalCashInvested > 0
      ? ((cashflowMonthly * 12) / totalCashInvested) * 100
      : null;
  const onePctRulePct = price > 0 ? (rentMonthly / price) * 100 : null;

  return {
    noiAnnual,
    capRatePct,
    cashOnCashPct,
    dscr,
    cashflowMonthly,
    onePctRulePct,
    totalCashInvested,
    monthlyDebtService,
  };
}
