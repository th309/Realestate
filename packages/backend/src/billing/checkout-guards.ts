import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Checkout-time guards for `BillingService.startCheckout`, extracted to a
 * sibling file to keep `billing.service.ts` within the 300-line hard limit
 * (CLAUDE.md §1.3).
 */

/**
 * Task 5 — no second free trial. Users who already have a `user_trials` row
 * (the app-level reverse trial granted at signup) must not also receive a
 * fresh Stripe subscription trial at checkout. Returns 0 when a row exists
 * for the user (any row — expired, converted, or cancelled all count as
 * "already used"); otherwise passes the candidate trial length through
 * unchanged.
 */
export async function resolveTrialDaysForCheckout(
  client: SupabaseClient,
  userId: string,
  candidateTrialDays: number | undefined,
): Promise<number | undefined> {
  if (!candidateTrialDays) return candidateTrialDays;

  const { data: existingTrial } = await client
    .from('user_trials')
    .select('id')
    .eq('user_id', userId)
    .single();

  return existingTrial ? 0 : candidateTrialDays;
}
