// packages/frontend/app/analyzer/lib/goal-scoring.ts
import type {
  BrrrrResult,
  FlipResult,
  RentalResult,
  ProjectionResult,
} from "@propertyiq/analyzer-core";
import type { InvestorGoal } from "./goal-types";
import { ALL_GOALS } from "./goal-types";

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

/** F&F cash-flow proxy: treat flip profit as if reinvested into a rental
 *  at a 6% annual cap rate, expressed monthly. 0.06 / 12 = 0.005. This is
 *  conceptually correct (lump-sum profit -> implied monthly income) instead
 *  of the prior "(profit/months) * 0.4" which mistakenly treated one-time
 *  profit as recurring monthly cashflow. Documented in the design spec. */
const FLIP_CASHFLOW_IMPLIED_MONTHLY_YIELD = 0.005;

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
  const flip = profit > 0 ? profit * FLIP_CASHFLOW_IMPLIED_MONTHLY_YIELD : 0;
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

  // B&H is by definition NOT a capital-recycling play — it traps cash in
  // equity for 30 years. Score it at 0 so it never wins this goal. When
  // both F&F and BRRRR also fail to recycle, the orchestrator returns null
  // and the UI surfaces a "no strategy fits this goal" state instead of
  // falling back to a misleading B&H winner.
  const bnh = 0;

  // F&F: total cash recovered per year via sale + redeployment.
  // Gated on positive profit — a money-losing flip doesn't "recycle"
  // capital, it burns it. Without this gate, recycle_capital would
  // crown unprofitable flips as the best play just because they cycle
  // capital fast.
  const flipProfit = input.flip?.projectedProfit ?? 0;
  const months = input.holdMonths ?? 4;
  const flip = flipProfit > 0 ? (cashIn / Math.max(1, months)) * 12 : 0;

  // BRRRR: cash recovered at refi per year. The lower remainingCashInDeal
  // is, the higher this score gets.
  const remaining = input.brrrr?.remainingCashInDeal ?? cashIn;
  const recovered = Math.max(0, cashIn - remaining);
  const seasoning = input.refiSeasoningMonths ?? DEFAULT_REFI_SEASONING_MONTHS;
  const brrrr = (recovered / Math.max(1, seasoning)) * 12;

  return { buyAndHold: bnh, flip, brrrr };
}

/** Normalization anchors — score=1.0 lands at a typical Balanced-preset
 *  A-grade outcome on each goal. Documented in the design spec. */
const NORMALIZATION_ANCHOR: Record<InvestorGoal, number> = {
  cash_flow: 500, // $500/door/month
  long_term_wealth: 1_000_000, // $1M at year 30 (covers compounded flip-profit alt)
  fast_cash: 80_000, // $80k in year 1
  recycle_capital: 240_000, // canonical 4-mo flip of $80k cycles $240k/yr
};

/**
 * Pre-selects the goal that fits this deal best. For each of the 4 goals
 * we find the top-strategy score, normalize against the goal-specific
 * anchor, and pick the goal with the highest normalized value.
 *
 * Ties are broken by ALL_GOALS iteration order (cash_flow first), so the
 * fallback when every goal normalizes to 0 is cash_flow — sensible when
 * the user hasn't entered enough data to make any goal stand out.
 */
export function inferDefaultGoal(input: ScoringInput): InvestorGoal {
  let bestGoal: InvestorGoal = "cash_flow";
  let bestNormalized = -Infinity;
  for (const goal of ALL_GOALS) {
    const s = scoreForGoal(goal, input);
    const topRaw = Math.max(s.buyAndHold, s.flip, s.brrrr);
    const normalized = topRaw / NORMALIZATION_ANCHOR[goal];
    if (normalized > bestNormalized) {
      bestNormalized = normalized;
      bestGoal = goal;
    }
  }
  return bestGoal;
}

/** Strategy identifier as used by the rest of the analyzer (matches
 *  `Strategy` in strategy-tile-mappers.ts). Kept inline to avoid an import
 *  cycle. */
type StrategyKey = "buyAndHold" | "flip" | "brrrr";

/**
 * Argmax over scoreForGoal. Ties resolve in declaration order
 * (buyAndHold > flip > brrrr) — deterministic so the same deal always
 * produces the same recommendation.
 *
 * Returns null when every strategy scores 0 (no usable data) so callers
 * can fall through to the deterministic pickBestPlay() and avoid a
 * meaningless "winner."
 */
export function pickBestPlayForGoal(
  goal: InvestorGoal,
  input: ScoringInput,
): StrategyKey | null {
  const scores = scoreForGoal(goal, input);
  const ordered: Array<[StrategyKey, number]> = [
    ["buyAndHold", scores.buyAndHold],
    ["flip", scores.flip],
    ["brrrr", scores.brrrr],
  ];
  let best: [StrategyKey, number] | null = null;
  for (const entry of ordered) {
    if (entry[1] <= 0) continue;
    if (best === null || entry[1] > best[1]) {
      best = entry;
    }
  }
  return best?.[0] ?? null;
}
