import type { BrrrrInput, BrrrrResult } from "./types";
import { computeRentalMetrics, monthlyMortgagePayment } from "./rental";

const DEFAULTS = { refinanceLTV: 0.75 };

function rate(score: number): BrrrrResult["rating"] {
  if (score >= 8) return "EXCELLENT";
  if (score >= 6.5) return "STRONG";
  if (score >= 5) return "OK";
  if (score >= 3) return "WEAK";
  return "POOR";
}

export function computeBrrrrScore(input: BrrrrInput): BrrrrResult {
  const { price, arv, rehabBudget, financing } = input;
  const refiLTV = input.refinanceLTVPct ?? DEFAULTS.refinanceLTV;

  const closingPct = financing.closingCostsPct ?? 0.03;
  const totalIn = price + rehabBudget + price * closingPct;
  const refinanceCashOut = arv * refiLTV;
  const remainingCashInDeal = totalIn - refinanceCashOut;

  // Post-refi: new loan = refinanceCashOut, same rate/term
  const postRefiDebt = monthlyMortgagePayment(
    refinanceCashOut,
    financing.interestRatePct,
    financing.termYears,
  );

  if (input.rentMonthly == null) {
    return {
      score: 0,
      refinanceCashOut,
      remainingCashInDeal,
      postRefiCashflowMonthly: -postRefiDebt,
      rating: "POOR",
    };
  }

  // Run rental math at post-refi state: down payment fields don't apply, treat refi loan as the financed debt.
  const rental = computeRentalMetrics({
    ...input,
    financing: { ...financing, downPaymentPct: 1 }, // ignore debt from initial financing in the cashflow
  });
  // Replace debt service with post-refi debt
  const noiMonthly = (rental.noiAnnual ?? 0) / 12;
  const postRefiCashflowMonthly = noiMonthly - postRefiDebt;

  // Score: weighted by (a) cash recouped fraction, (b) post-refi cashflow / month
  const cashRecoupedFraction = Math.max(
    0,
    Math.min(1, 1 - remainingCashInDeal / Math.max(totalIn, 1)),
  );
  // Saturation $250/mo cashflow — community BRRRR benchmark for "great" cashflow.
  const cashflowComponent = Math.max(
    0,
    Math.min(1, postRefiCashflowMonthly / 250),
  );
  const score =
    Math.round(
      (0.6 * cashRecoupedFraction + 0.4 * cashflowComponent) * 10 * 10,
    ) / 10;

  return {
    score,
    refinanceCashOut,
    remainingCashInDeal,
    postRefiCashflowMonthly,
    rating: rate(score),
  };
}
