// packages/frontend/app/analyzer/lib/goal-scoring.ts
import type {
  BrrrrResult,
  FlipResult,
  RentalResult,
  ProjectionResult,
} from "@propertyiq/analyzer-core";
import type { InvestorGoal } from "./goal-types";

/**
 * Goal-aware strategy scoring. For each (goal × strategy) pair we return a
 * positive number representing the strategy's fit for THIS goal on THIS
 * deal. The orchestrator (`pickBestPlayForGoal`) then picks argmax.
 *
 * All scoring functions are pure, take a normalized `ScoringInput` bundle,
 * and never return null/-Infinity — soft penalties keep all 3 strategies
 * scorable per the design spec.
 */

export interface ScoringInput {
  rental: RentalResult | null | undefined;
  flip: FlipResult | null | undefined;
  brrrr: BrrrrResult | null | undefined;
  projection: ProjectionResult | null | undefined;
  /** Hold months from the flip's assumptions block. Used by both cash_flow
   *  (F&F proxy) and recycle_capital (F&F velocity). Default 4. */
  holdMonths?: number;
  /** Refi seasoning months from BRRRR assumptions. Used by recycle_capital
   *  (BRRRR velocity). Default 6. */
  refiSeasoningMonths?: number;
}

export interface GoalScores {
  buyAndHold: number;
  flip: number;
  brrrr: number;
}

/** F&F profit haircut for the cash_flow proxy. 0.4 = capital-gains tax
 *  (~25%) compounded with an opportunity-cost discount (~50%). Documented
 *  in the design spec. */
const FLIP_CASHFLOW_PROXY_MULTIPLIER = 0.4;

export function scoreForGoal(
  goal: InvestorGoal,
  input: ScoringInput,
): GoalScores {
  switch (goal) {
    case "cash_flow":
      return scoreCashFlow(input);
    case "long_term_wealth":
      return scoreLongTermWealth(input);
    case "fast_cash":
      return scoreFastCash(input);
    case "recycle_capital":
      return scoreRecycleCapital(input);
  }
}

function scoreCashFlow(input: ScoringInput): GoalScores {
  const bnh = input.rental?.cashflowMonthly ?? 0;
  const brrrr = input.brrrr?.postRefiCashflowMonthly ?? 0;
  const profit = input.flip?.projectedProfit ?? 0;
  const months = input.holdMonths ?? 4;
  const flip =
    profit > 0
      ? (profit / Math.max(1, months)) * FLIP_CASHFLOW_PROXY_MULTIPLIER
      : 0;
  return { buyAndHold: bnh, flip, brrrr };
}

/** 7% annualized compounding mirror an S&P-ish index alternative for the
 *  F&F one-shot profit. Held flat for 30 years (no rolling-flip multiplier).
 *  Documented in the design spec. */
const INDEX_FUND_GROWTH_RATE = 0.07;
const HORIZON_YEARS = 30;

function scoreLongTermWealth(input: ScoringInput): GoalScores {
  const bnhY30 = input.projection?.horizons.y30.equity ?? 0;
  const brrrrY30 =
    input.brrrr?.postRefiProjection?.horizons.y30.equity ?? bnhY30;
  const profit = input.flip?.projectedProfit ?? 0;
  const flip =
    profit > 0
      ? profit * Math.pow(1 + INDEX_FUND_GROWTH_RATE, HORIZON_YEARS)
      : 0;
  return { buyAndHold: bnhY30, flip, brrrr: brrrrY30 };
}

const HELOC_LTV = 0.7;
const BNH_NO_PROJECTION_PROXY = 0.05;

function scoreFastCash(input: ScoringInput): GoalScores {
  const flipProfit = Math.max(0, input.flip?.projectedProfit ?? 0);

  const refiCash = input.brrrr?.refinanceCashOut ?? 0;
  const cashIn = input.rental?.totalCashInvested ?? 0;
  const brrrrNet = Math.max(0, refiCash - cashIn);

  // B&H: HELOC against year-1 appreciated equity (70% LTV less the
  // cash already in). When projection is missing, fall back to a flat
  // soft-penalty so this strategy is never disqualified.
  const y1Equity = input.projection?.horizons.y1.equity ?? null;
  const bnh =
    y1Equity != null
      ? Math.max(0, (y1Equity - cashIn) * HELOC_LTV)
      : cashIn * BNH_NO_PROJECTION_PROXY;

  return { buyAndHold: bnh, flip: flipProfit, brrrr: brrrrNet };
}

const DEFAULT_REFI_SEASONING_MONTHS = 6;

function scoreRecycleCapital(input: ScoringInput): GoalScores {
  const cashIn = input.rental?.totalCashInvested ?? 0;

  // B&H: dollar-years trapped earn a flat 5% proxy. Tiny but non-zero so
  // B&H is never disqualified — its real strength is on other goals.
  const bnh = cashIn * BNH_NO_PROJECTION_PROXY;

  // F&F: total cash recovered per year via sale + redeployment.
  const months = input.holdMonths ?? 4;
  const flip = (cashIn / Math.max(1, months)) * 12;

  // BRRRR: cash recovered at refi per year. The lower remainingCashInDeal
  // is, the higher this score gets.
  const remaining = input.brrrr?.remainingCashInDeal ?? cashIn;
  const recovered = Math.max(0, cashIn - remaining);
  const seasoning = input.refiSeasoningMonths ?? DEFAULT_REFI_SEASONING_MONTHS;
  const brrrr = (recovered / Math.max(1, seasoning)) * 12;

  return { buyAndHold: bnh, flip, brrrr };
}
