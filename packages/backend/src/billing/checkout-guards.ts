import type { SupabaseClient } from '@supabase/supabase-js';
import { StripeService, PortalProduct } from './stripe.service';
import { BillingUserSyncService } from './billing-user-sync.service';

/**
 * Checkout-time guards for `BillingService.startCheckout`, extracted to a
 * sibling file to keep `billing.service.ts` within the 300-line hard limit
 * (CLAUDE.md §1.3). Both guards prevent double-charging or double-trialing a
 * user whose Stripe state has drifted from, or already precedes, the DB.
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

/**
 * Task 8 — checkout drift guard. A customer may already carry a live
 * (active/trialing) Stripe subscription that the DB doesn't know about
 * (e.g. `stripe_subscription_id` is null because a webhook was missed).
 * When that happens, re-sync the DB from Stripe and route the user to the
 * billing portal instead of starting a second, concurrent subscription.
 *
 * Returns the billing portal URL when a live subscription was found and
 * handled, or null when the caller should proceed with a normal checkout.
 */
export async function guardDriftedCheckout(params: {
  stripeCustomerId: string;
  userId: string;
  stripeService: StripeService;
  userSync: BillingUserSyncService;
  getBillingPortalUrl: (userId: string) => Promise<string>;
}): Promise<string | null> {
  const {
    stripeCustomerId,
    userId,
    stripeService,
    userSync,
    getBillingPortalUrl,
  } = params;

  const liveSubscriptions =
    await stripeService.listActiveSubscriptionsForCustomer(stripeCustomerId);
  if (liveSubscriptions.length === 0) return null;

  await userSync.syncFromCustomerId(stripeCustomerId, liveSubscriptions[0]);
  return getBillingPortalUrl(userId);
}

/**
 * Shapes `subscription_tiers` rows into the `PortalProduct[]` structure
 * Stripe's portal-configuration API expects, dropping tiers with no Stripe
 * product or no configured prices. Moved here (from `getBillingPortalUrl`)
 * to keep `billing.service.ts` within the 300-line hard limit.
 */
export function buildPortalProducts(
  tiers: {
    stripe_product_id: string | null;
    stripe_price_monthly_id: string | null;
    stripe_price_yearly_id: string | null;
  }[],
): PortalProduct[] {
  return tiers
    .filter((t) => t.stripe_product_id)
    .map((t) => ({
      productId: t.stripe_product_id as string,
      priceIds: [t.stripe_price_monthly_id, t.stripe_price_yearly_id].filter(
        Boolean,
      ) as string[],
    }))
    .filter((p) => p.priceIds.length > 0);
}
