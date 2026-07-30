/**
 * Revenue metrics for the Conversion tab.
 *
 * Split out of conversion-panel-queries.ts at the 300-line hard limit
 * (CLAUDE.md §1.3). Revenue is its own concern anyway — it is the only panel on
 * that tab sourced from billing state rather than from user_events.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { TierCount } from './user-analytics.types';

const logger = new Logger('ConversionRevenueQueries');

/** The only tiers that carry a price. `admin` and `free` are not revenue. */
const PAID_TIERS = ['pro', 'enterprise'];

/**
 * Statuses that mean "Stripe is still trying to bill this subscription".
 *
 * Mirrors LIVE_PAID_STATUSES in billing.service.ts:77, minus `trialing`: a
 * trial has a subscription but has not been billed, so it is not MRR. In
 * practice `trialing` never reaches user_profiles for a Stripe subscriber
 * anyway — BillingUserSyncService.syncUserTier hardcodes
 * `subscription_status: 'active'` for both the active and trialing webhook
 * paths, so an app-level no-card trial is the only thing that stores it, and
 * that has no stripe_subscription_id.
 */
const BILLED_STATUSES = ['active', 'past_due', 'unpaid'];

/**
 * Live subscription, failing payment. billing-webhook.service.ts:155 writes
 * these on `customer.subscription.updated` and :226 writes `past_due` on
 * `invoice.payment_failed` — in both cases WITHOUT clearing
 * stripe_subscription_id, so the row still describes a real subscription.
 */
const DUNNING_STATUSES = ['past_due', 'unpaid'];

export interface RevenueMetrics {
  /**
   * Billed subscriptions only — Stripe subscription present.
   *
   * UPPER BOUND, not an exact figure: every subscriber is priced at
   * `subscription_tiers.price_monthly` because nothing records their billing
   * interval. See the ANNUAL BILLING note on queryRevenueMetrics.
   */
  mrr: number;
  /** null when nobody is billed — 0/0 is undefined, not zero. */
  arpu: number | null;
  tierDistribution: TierCount[];
  /** Active paid tiers with no Stripe subscription: comped, not revenue. */
  compedCount: number;
  /**
   * Billed subscribers whose payment is currently failing (`past_due` /
   * `unpaid`). A SUBSET of the population behind `mrr`, not a separate group:
   * they are counted in MRR because the subscription is live, and surfaced
   * here because MRR that is not being collected should not look identical to
   * MRR that is.
   */
  dunningCount: number;
}

/**
 * MRR / ARPU / tier split, counting only subscriptions that are actually billed.
 *
 * This previously multiplied list price by a count of profiles with
 * `subscription_status = 'active'`. That status is not a billing fact:
 * `applyUserTierUpdate` (admin/users/users-mutations.helper.ts) forces it to
 * 'active' on every manual tier grant, and gives enterprise a 30-day
 * pre-billing grace window. So comped and admin-granted accounts were counted
 * at full list price.
 *
 * It was firing: the single 'pro'/'active' profile in the database has a NULL
 * `stripe_subscription_id` AND a NULL `stripe_customer_id`, and the panel
 * rendered MRR $39 / ARPU $39 for revenue nobody has ever paid. Same class of
 * defect as the "Est. LTV" card that multiplied ARPU by a hardcoded churn
 * constant — a modelled number presented beside measured ones.
 *
 * `stripe_subscription_id IS NOT NULL` is the billing fact. Comped accounts are
 * still returned, separately, because "1 person on Pro who isn't paying" is
 * worth knowing — it just isn't revenue.
 *
 * DUNNING: the billed query used to also require `subscription_status =
 * 'active'` while the comped query required a NULL stripe_subscription_id, so a
 * subscriber mid-dunning — `past_due`/`unpaid` WITH a live subscription id —
 * matched neither predicate and vanished from the panel entirely. They are now
 * in `billed` (the subscription is live and Stripe is still collecting) and
 * counted again in `dunningCount` so a failing payment is visible instead of
 * quietly propping up MRR.
 *
 * ANNUAL BILLING — KNOWN OVERSTATEMENT, NOT FIXABLE FROM THIS DATA:
 * every subscriber is priced at `subscription_tiers.price_monthly`, but both
 * paid tiers have a live `stripe_price_yearly_id`, so annual plans are sellable
 * today and an annual subscriber is charged the yearly price. Against live
 * `subscription_tiers` rows the error per annual subscriber is:
 *
 *   pro         $39.00/mo list vs $399/yr  =  $33.25/mo  → MRR over by  $5.75 (17.3%)
 *   enterprise $149.00/mo list vs $999/yr  =  $83.25/mo  → MRR over by $65.75 (79.0%)
 *
 * There is NO cheap way to detect the interval here, and none was invented:
 *   - `user_profiles` has no interval column and does not store the Stripe
 *     price id. `BillingUserSyncService.tierFromPriceId` resolves the price id
 *     to a tier slug and then discards the id, which is the only moment the
 *     interval is known.
 *   - `billing_period_start` / `billing_period_end` DATE columns exist on
 *     user_profiles (scripts/migrations/030-create-new-schema.sql:529-530) and
 *     would give the interval as a date difference — but NO code path writes
 *     them. They are null on every row, so they cannot be used.
 *   - `subscription_started_at` / `subscription_ends_at` are likewise never
 *     written by the backend.
 *   - Asking Stripe would mean one API call per subscriber inside an analytics
 *     read, which is not a query this panel can afford.
 *
 * Guessing the interval, or spreading list price over 12, would both be
 * fabrication. `mrr` is therefore documented and typed as an UPPER BOUND. The
 * real fix is upstream: persist the interval (or the price id) on user_profiles
 * in BillingUserSyncService.syncUserTier, then price each row from its own
 * plan. Current exposure is zero — there are no billed subscribers yet — which
 * is exactly why the column should be added before there are.
 */
export async function queryRevenueMetrics(
  client: SupabaseClient,
): Promise<RevenueMetrics> {
  const [
    { data: billedRows, error: billedError },
    { data: compedRows, error: compedError },
    { count: dunningCount, error: dunningError },
    { count: paidTierTotal, error: totalError },
    { data: priceRows, error: priceError },
  ] = await Promise.all([
    client
      .from('user_profiles')
      .select('subscription_tier')
      .in('subscription_tier', PAID_TIERS)
      .in('subscription_status', BILLED_STATUSES)
      .not('stripe_subscription_id', 'is', null),
    client
      .from('user_profiles')
      .select('subscription_tier')
      .in('subscription_tier', PAID_TIERS)
      .eq('subscription_status', 'active')
      .is('stripe_subscription_id', null),
    // Counted, not fetched: this only ever needs a number, and a head count is
    // not subject to the 1,000-row PostgREST ceiling.
    client
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .in('subscription_tier', PAID_TIERS)
      .in('subscription_status', DUNNING_STATUSES)
      .not('stripe_subscription_id', 'is', null),
    // Every paid-tier profile, whatever its status. Only used to prove the two
    // buckets above account for all of them — see the reconciliation below.
    client
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .in('subscription_tier', PAID_TIERS),
    client
      .from('subscription_tiers')
      .select('slug, price_monthly')
      .in('slug', PAID_TIERS),
  ]);

  // Previously destructured without checking `error`, so a failed query and a
  // genuine zero were indistinguishable — $0 MRR reads as a fact either way.
  if (billedError || compedError || dunningError || totalError || priceError) {
    logger.error(
      `Revenue metrics query failed: ${
        billedError?.message ??
        compedError?.message ??
        dunningError?.message ??
        totalError?.message ??
        priceError?.message
      }`,
    );
    return {
      mrr: 0,
      arpu: null,
      tierDistribution: [],
      compedCount: 0,
      dunningCount: 0,
    };
  }

  const billedCount = (billedRows ?? []).length;
  const compedCount = (compedRows ?? []).length;

  // The dunning defect was invisible because nothing checked that the buckets
  // covered the population. They are still not provably exhaustive — a paid
  // tier with, say, `cancelled` status and a lingering subscription id would
  // fall outside both — so the gap is measured and logged rather than assumed
  // away. Loud in the log beats absent from the panel.
  const unbucketed = (paidTierTotal ?? 0) - billedCount - compedCount;
  if (unbucketed > 0) {
    logger.warn(
      `${unbucketed} of ${paidTierTotal} paid-tier profiles are in neither the ` +
        `billed nor the comped bucket (statuses outside ` +
        `${BILLED_STATUSES.join('/')} with no NULL-subscription match). ` +
        `They are excluded from MRR and from compedCount.`,
    );
  }

  // The Supabase client is untyped here, so these rows arrive as `any`. Narrowed
  // to the columns actually selected above rather than indexed off `any` — the
  // shapes are asserted in one place instead of implied at each use.
  const prices = (priceRows ?? []) as {
    slug: string;
    price_monthly: number | string | null;
  }[];
  const billed = (billedRows ?? []) as { subscription_tier: string | null }[];

  const tierPrices: Record<string, number> = {};
  for (const t of prices) {
    tierPrices[t.slug] = Number(t.price_monthly) || 0;
  }

  const tierCounts: Record<string, number> = {};
  for (const row of billed) {
    const tier = row.subscription_tier ?? 'unknown';
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
  }

  const tierDistribution: TierCount[] = Object.entries(tierCounts).map(
    ([tier, count]) => ({
      tier,
      count,
      // Monthly list price × headcount. Overstated for anyone on an annual
      // plan — see the ANNUAL BILLING note above.
      revenue: count * (tierPrices[tier] || 0),
    }),
  );

  const mrr = tierDistribution.reduce((sum, t) => sum + t.revenue, 0);
  const totalPaid = tierDistribution.reduce((sum, t) => sum + t.count, 0);

  return {
    mrr,
    // null, not 0, when nobody is billed. 0/0 is undefined, and "$0 average
    // revenue per user" asserts something measured; the UI renders a dash.
    // MRR $0 with 0 subscribers IS a true statement, so it stays a number.
    arpu: totalPaid > 0 ? mrr / totalPaid : null,
    tierDistribution,
    compedCount,
    dunningCount: dunningCount ?? 0,
  };
}
