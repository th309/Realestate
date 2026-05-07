# Billing schema map (for Content Pipeline revenue attribution)

This document maps the **existing** billing schema in Supabase/Postgres and how it links to PropertyIQ users. It is the source of truth for Phase 4 Tasks **4.6** and **4.7** (RevenueAttributionService).

## Identity & linking (auth → billing)

- **Canonical user id**: `auth.users.id` (UUID)
- **Profile row**: `public.user_profiles.id` (UUID) — matches `auth.users.id`
- **Billing linkage columns (on `public.user_profiles`)**
  - `stripe_customer_id` (text): Stripe customer id (e.g. `cus_...`)
  - `stripe_subscription_id` (text|null): Stripe subscription id (e.g. `sub_...`)
  - `subscription_tier` (text): current tier slug (e.g. `free`, `pro`, `enterprise`)
  - `subscription_status` (text): Stripe-ish status (`active`, `trialing`, `past_due`, `unpaid`, `cancelled`, `none`)

**Where these are written**

- `packages/backend/src/billing/billing.service.ts`
  - Creates/updates `user_profiles.stripe_customer_id`
  - Reads `subscription_tier`/`subscription_status` to prevent duplicate checkout
- `packages/backend/src/billing/billing-webhook.service.ts`
  - On subscription update/delete/payment_failed updates `user_profiles.subscription_*` fields
- `packages/backend/src/billing/billing-user-sync.service.ts`
  - Central helper that updates `user_profiles.subscription_tier`, `subscription_status`, `stripe_subscription_id`
  - Skips `admin_users` (admin tier is not Stripe-driven)

## Tier representation

- **Tier slug (human-facing + authorization)**: `public.user_profiles.subscription_tier`
- **Tier configuration / price mapping**: `public.subscription_tiers`
  - `slug` (text): tier id (e.g. `pro`)
  - `stripe_product_id` (text)
  - `stripe_price_monthly_id` (text)
  - `stripe_price_yearly_id` (text)

**How tier is resolved**

- Stripe webhooks arrive with a `price.id` (monthly/yearly).
- `BillingUserSyncService.tierFromPriceId(priceId)` resolves `subscription_tiers.slug` by checking:
  - `stripe_price_monthly_id == priceId`, else
  - `stripe_price_yearly_id == priceId`

## Tier change events / history

There is **no dedicated `stripe_subscriptions` table** currently used for persistence of subscription rows/history.

Tier changes are persisted as *current state* on `public.user_profiles` and broadcast via Supabase realtime:

- Migration: `supabase/migrations/20260324001028_add_tier_change_broadcast_trigger.sql`
  - Broadcasts only when `user_profiles.subscription_tier` changes.

Separately, trial conversions are tracked via:

- `public.user_trials` (used by `TrialConversionService`)
  - `user_id` (UUID)
  - `tier` (text)
  - `started_at`, `expires_at`, `converted_at`, `cancelled_at` (timestamps)

## Content-pipeline attribution table (run → signup)

- `public.signup_attributions` (created in `supabase/migrations/20260421000300_content_pipeline_attribution.sql`)
  - `user_id` → `auth.users.id`
  - `attributed_run_id` → `content_runs.id`
  - `signup_at` timestamp
  - `tier_at_signup` (text, default `free`)

This is the “money table” used to tie *content runs* to *new accounts*.

## SQL templates

### Current tier snapshot for a user

```sql
select
  id as user_id,
  email,
  subscription_tier,
  subscription_status,
  stripe_customer_id,
  stripe_subscription_id
from public.user_profiles
where id = :user_id;
```

### Tier history proxy (trial → current tier)

Because billing state is stored on `user_profiles` (current) and `user_trials` (trial lifecycle), a pragmatic “tier history” query is:

```sql
with trial as (
  select
    user_id,
    tier as trial_tier,
    started_at as trial_started_at,
    converted_at as trial_converted_at,
    cancelled_at as trial_cancelled_at,
    expires_at as trial_expires_at
  from public.user_trials
  where user_id = :user_id
  order by expires_at desc
  limit 1
),
profile as (
  select
    id as user_id,
    subscription_tier as current_tier,
    subscription_status as current_status,
    stripe_customer_id,
    stripe_subscription_id
  from public.user_profiles
  where id = :user_id
)
select
  p.user_id,
  t.trial_tier,
  t.trial_started_at,
  t.trial_converted_at,
  t.trial_cancelled_at,
  t.trial_expires_at,
  p.current_tier,
  p.current_status,
  p.stripe_customer_id,
  p.stripe_subscription_id
from profile p
left join trial t on t.user_id = p.user_id;
```

## Notes for RevenueAttributionService (Task 4.7)

- Revenue attribution should **join `signup_attributions.user_id` → `user_profiles`** to get the current tier and Stripe subscription id.
- If/when we need **actual paid amount**, the current codebase does **not** store Stripe invoice amounts in Postgres — we’ll need either:
  - Stripe API lookup by `stripe_subscription_id`, or
  - a new persistence table populated by webhooks (future migration).

