/**
 * Narrative Insights Types
 *
 * Pre-computed analytical strings that transform raw metrics into
 * "so what" context before they reach the AI model. Instead of
 * sending "cap_rate: 5.2%", we send "~4.1% net yield after vacancy
 * (5%), maintenance (8%), mgmt (10%)".
 */

export interface AnalyticalInsights {
  // Affordability
  monthly_payment_estimate: string;
  dti_at_median_income: string;
  price_vs_national_pct: string;
  price_vs_state_pct: string;
  affordability_verdict: string;

  // Market Position
  market_phase: string;
  buyer_leverage_assessment: string;
  offer_strategy: string;
  waiting_cost_per_month: string;

  // Investment Math
  net_yield_estimate: string;
  cash_on_cash_estimate: string;
  monthly_cash_flow_estimate: string;
  total_return_estimate: string;
  break_even_occupancy: string;

  // Comparative Context
  comparable_markets: string;
  national_percentile: string;

  // Trend Narrative
  appreciation_trajectory: string;
  rent_growth_trajectory: string;

  // Risk Quantification
  downside_scenario: string;
  equity_at_risk: string;
}

/** Default expense assumptions for investment calculations. */
export interface ExpenseAssumptions {
  vacancyRate: number;
  maintenanceRate: number;
  managementRate: number;
  insuranceAnnual: number;
  taxRate: number;
}

export const DEFAULT_EXPENSE_ASSUMPTIONS: ExpenseAssumptions = {
  vacancyRate: 0.05,
  maintenanceRate: 0.08,
  managementRate: 0.1,
  insuranceAnnual: 1800,
  taxRate: 0.012,
};
