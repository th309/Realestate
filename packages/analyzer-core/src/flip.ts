import type { FlipInput, FlipResult } from "./types";

const DEFAULTS = { holdingMonths: 4, sellingCostsPct: 0.07 };

export function computeFlipMetrics(
  input: FlipInput & { price: number },
): FlipResult {
  const { price, arv, rehabBudget } = input;
  const sellingCostsPct = input.sellingCostsPct ?? DEFAULTS.sellingCostsPct;
  const sellingCosts = arv * sellingCostsPct;
  const mao70 = 0.7 * arv - rehabBudget;
  const wholetailMax = 0.8 * arv - rehabBudget;
  const projectedProfit = arv - sellingCosts - price - rehabBudget;
  const totalIn = price + rehabBudget;
  const projectedRoiPct = totalIn > 0 ? (projectedProfit / totalIn) * 100 : 0;
  return { mao70, wholetailMax, projectedProfit, projectedRoiPct };
}
