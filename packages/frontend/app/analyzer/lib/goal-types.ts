// packages/frontend/app/analyzer/lib/goal-types.ts

/**
 * The 4 investor goals the "Help me decide" recommender ranks strategies
 * against. Each goal is paired with a scoring function in goal-scoring.ts
 * that translates strategy results into a numeric fit score for THIS goal.
 *
 * Wire-stable identifiers — also sent to the backend as the `goal` field on
 * the AI-insights payload, so renames here require a corresponding DTO + AI
 * cache PROMPT_REVISION bump.
 */
export type InvestorGoal =
  | "cash_flow"
  | "long_term_wealth"
  | "fast_cash"
  | "recycle_capital";

export const GOAL_LABEL: Record<InvestorGoal, string> = {
  cash_flow: "Cash flow",
  long_term_wealth: "Long-term wealth",
  fast_cash: "Fast cash",
  recycle_capital: "Recycle capital",
};

/** One-sentence descriptions for the chip tooltip. Keep tight — these are
 *  surfaced on hover, not in body copy. */
export const GOAL_DESCRIPTION: Record<InvestorGoal, string> = {
  cash_flow: "Maximize monthly recurring income from this deal.",
  long_term_wealth:
    "Maximize total equity 30 years out (compounding + appreciation).",
  fast_cash: "Maximize lump-sum cash within 12 months.",
  recycle_capital:
    "Minimize trapped capital so you can buy the next deal sooner.",
};

export const ALL_GOALS: InvestorGoal[] = [
  "cash_flow",
  "long_term_wealth",
  "fast_cash",
  "recycle_capital",
];
