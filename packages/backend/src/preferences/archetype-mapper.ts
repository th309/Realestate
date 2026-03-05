/**
 * Archetype Mapper
 *
 * Maps quiz answers (goal, priorities, budget) to a deterministic archetype ID.
 * The archetype ID format is: `{goal}_{primary_priority}_{budget_tier}`
 * e.g., `investor_rental_cashflow_200_400k`
 *
 * Archetype IDs are used by InsightsService to generate personalized
 * AI narratives tailored to the user's investment strategy and budget.
 */

import { UserGoal } from './preferences.types';

/** Budget tier labels derived from budgetMax */
export type BudgetTier =
  | 'under_200k'
  | '200_400k'
  | '400_600k'
  | '600k_1m'
  | 'over_1m'
  | 'unspecified';

/**
 * Maps a budget maximum value to a human-readable tier string.
 */
export function getBudgetTier(
  budgetMax: number | null | undefined,
): BudgetTier {
  if (budgetMax == null) return 'unspecified';
  if (budgetMax < 200_000) return 'under_200k';
  if (budgetMax < 400_000) return '200_400k';
  if (budgetMax < 600_000) return '400_600k';
  if (budgetMax < 1_000_000) return '600k_1m';
  return 'over_1m';
}

/**
 * Computes a deterministic archetype ID from quiz answers.
 *
 * @param goal - The user's selected goal (e.g., 'investor_rental')
 * @param priorities - Ordered list of priorities; first element is primary
 * @param budgetMax - Upper bound of the user's budget range (nullable)
 * @returns Archetype ID string, e.g. `investor_rental_cashflow_200_400k`
 */
export function computeArchetypeId(
  goal: UserGoal | null | undefined,
  priorities: string[] | null | undefined,
  budgetMax: number | null | undefined,
): string {
  const goalSegment = goal || 'exploring';
  const primaryPriority = priorities?.[0] || 'general';
  const budgetTier = getBudgetTier(budgetMax);

  return `${goalSegment}_${primaryPriority}_${budgetTier}`;
}
