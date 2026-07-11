# Conversion Wiring — GA Events, Dunning, Trial Decision-Point, Checkout Guard

**Date:** 2026-07-11
**Status:** Approved (design), pending implementation
**Author:** Claude + Troy

## Problem

The PropertyIQ funnel leaks at every paid stage, and the instrumentation to see it is missing:

- **No conversion visibility in GA4.** `sign_up` fires, but `trial_start` and `purchase` do not, so GA cannot report trial-starts or paid conversions by source/page.
- **Trials convert at ~0%.** A free (no-card) reverse trial silently downgrades to Free at day 14 with no "pick a plan" moment. There is no forced decision point.
- **Failed payments are silent.** `invoice.payment_failed` flips the user to `past_due` but sends no email and offers no recovery prompt — the likely cause of losing the one real paying customer (GT / Gustavo) after a single month.
- **DB can drift from Stripe.** A real payment whose webhook never landed (pre-2026-07-07 fix) leaves `stripe_subscription_id` null, so status endpoints report `none` and a drifted paid user could start a second checkout (double-charge risk).

## Goal

Wire the four pieces so the funnel is measurable, trials have a real decision point, failed payments are recoverable, and drift cannot double-charge. Reuse existing infrastructure; do not rebuild it.

## Current State (verified 2026-07-11)

### GA4

- Loader: `packages/frontend/app/components/analytics/GoogleAnalytics.tsx` (env `NEXT_PUBLIC_GA_MEASUREMENT_ID`), mounted in `AppShell.tsx:42`.
- Helper: `gtagEvent()` at `packages/frontend/lib/analytics/tracker.ts:98` (calls `window.gtag`). Distinct from the first-party `trackEvent()` pipeline (`/api/usage/events` → `user_events`).
- `sign_up` already fires: `app/(app)/auth/sign-up/complete-signup.ts:33` and `app/(app)/auth/callback/page.tsx:229`.

### Stripe billing

- Webhook `POST /api/billing/webhook` → `billing-webhook.service.ts:45-76`. Handles `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`, `customer.subscription.trial_will_end`.
- `handlePaymentFailed` (`billing-webhook.service.ts:200-224`) sets `user_profiles.subscription_status='past_due'` + invalidates MCP entitlements. **No email, no recovery handler.**
- Billing portal EXISTS: `GET /api/billing/portal` (`billing.controller.ts:73-78`), `payment_method_update` enabled (`stripe.service.ts:183-185`), returns to `${FRONTEND_URL}/account/billing`.
- Email infra: `EmailService.sendEmail` (`packages/backend/src/email/email.service.ts:61`), Resend, from `EMAIL_FROM` (default `PropertyIQ <noreply@propertyiq.app>`). Templates in `packages/backend/src/email/behavioral-trigger-emails.ts`.
- Proven idempotent billing-email pattern: `TrialEndingNotificationService` (`packages/backend/src/billing/trial-ending-notification.service.ts`), idempotency via `email_triggers` UNIQUE(user_id, trigger_name).
- Checkout: `POST /api/billing/checkout` → `billing.service.ts:46-149`; `successUrl = ${baseUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}&returnContext=...` (`billing.service.ts:138`). Trials are card-required (Stripe default `payment_method_collection='always'`); `trial_period_days` from `trial_config`.

### Trial lifecycle

- Reverse trial created at signup by DB trigger `handle_new_user()` (`supabase/migrations/20260616213835_...sql:56-67`): `user_trials(user_id, tier='pro', expires_at=now+14d)`. Idempotent backend fallback `OnboardingService.ensureTrialStarted` (`onboarding.service.ts:33`).
- Tier source of truth: `TierResolverService.resolve()` (`packages/backend/src/entitlements/tier-resolver.service.ts:40-171`). Active-trial query filters `expires_at > now` (`:94`); once past, silently falls through to `free` (`:134`). **Silent downgrade confirmed.**
- Cron `TrialExpirationCron.expireTrials()` (`trial-expiration.cron.ts:78`) emits `trial.expired` analytics/email only — no UI gate.
- Frontend signals: `useEntitlements().trial` (`{active, daysRemaining, tier}`) and `usePostTrialState().isPostTrial` (`lib/entitlements/usePostTrialState.ts:36` — `tier==='free' && !trial.active && has-usage-history`).
- Components: `TrialExpirationBanner` (dashboard-only, `daysRemaining<=4`, CTA `/pricing?from=trial_expiration`); `PersonalizedPaywall` (`app/components/paywall/PersonalizedPaywall.tsx`) — full-screen blocking modal, **orphaned/rendered nowhere**; `PostTrialGate`/`PostTrialOverlay` (reports page only). App-wide mount point: `packages/frontend/app/providers.tsx:174-178` (`EntitlementsProvider` → `PaywallProvider` → children). No `/upgrade` page (only `/upgrade/success`).

### Data model

- Billing columns on `user_profiles`: `subscription_tier`, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_started_at/ends_at`. `user_trials`: `tier`, `expires_at`, `converted_at`, `cancelled_at`.
- Sync helpers reusable: `BillingUserSyncService.syncUserTier / syncFromCustomerId` (`billing-user-sync.service.ts:22-88`); `TrialConversionService.handleSubscriptionCreated` sets `user_trials.converted_at` (`trial-conversion.service.ts:56-63`).
- Drift surfaces: `BillingService.getSubscriptionStatus` short-circuits to `none` when `stripe_subscription_id` null (`billing.service.ts:229-235`); `startCheckout` treats null `stripe_subscription_id` as "no live sub" (`billing.service.ts:74-83`) → second-checkout risk.
- **No reconcile-against-Stripe job exists** (webhook-reactive only).

## Design

### Workstream 1 — GA4 conversion events

**1a. `trial_start`.** Add `gtagEvent("trial_start", { tier: "pro" })` immediately after each existing `sign_up` call: `complete-signup.ts:33`, `auth/callback/page.tsx:229`. Rationale: the reverse trial is granted 1:1 at signup; firing at `startOnboardingTrial()` call sites is unreliable (`tour/page.tsx:164` runs on every market change; the fetcher discards the created flag).

**1b. `purchase`.** Append the plan amount + tier to the checkout `success_url` in `billing.service.ts` (we know tier/interval at checkout creation; look up amount from `subscription_tiers`). In `app/(app)/upgrade/success/page.tsx`, fire `gtagEvent("purchase", { transaction_id: session_id, value, currency: "USD", items: [{ item_id: tier }] })` inside the existing effect, guarded by a `session_id`-keyed ref so refresh/StrictMode cannot double-count.

**Acceptance:** In a local run, `trial_start` fires exactly once on a fresh signup and `purchase` fires exactly once on the Stripe return (verified via `window.gtag` calls in console/network + GA Realtime). No double-fire on refresh.

### Workstream 2 — Dunning (failed-payment recovery)

**2a. `PaymentFailedNotificationService`** (new, mirrors `TrialEndingNotificationService`): on `invoice.payment_failed`, resolve user by `stripe_customer_id`, claim idempotency via `email_triggers`, send the failed-payment email. Preserve the existing `past_due` flip in `handlePaymentFailed`.

**2b. Email template** `buildPaymentFailedEmail` in `behavioral-trigger-emails.ts` — "your payment didn't go through, update your card," CTA to `${appUrl}/account/billing` (portal).

**2c. `invoice.payment_succeeded` recovery handler** in the webhook switch: if the user was `past_due`, set back to `active` and send a brief "you're all set" confirmation (idempotent). Wire both handlers into `billing-webhook.service.ts:45-76`.

**Acceptance:** Simulated `invoice.payment_failed` sends one email (idempotent on redelivery) and leaves status `past_due`; a subsequent `invoice.payment_succeeded` restores `active` and sends one confirmation. Verified via integration test (mocked Resend) + a Stripe test-clock/failing-card run showing a real `email_log` row.

### Workstream 3 — Trial decision-point (free trial + hard paywall)

**3a. At-expiry hard paywall.** Mount `PersonalizedPaywall` (currently orphaned) at the app shell (`providers.tsx`, under `PaywallProvider`), rendered when `usePostTrialState().isPostTrial` AND the user is on a Pro-gated surface (ZIP/county maps, reports, scores, screener, analyzer). Free-tier content (national/state) stays browsable so the user is gated, not trapped. CTA → `/pricing?from=trial_expired`.

**3b. App-wide pre-expiry nudge.** Promote `TrialExpirationBanner` logic (`trial.active && daysRemaining <= 4`) from dashboard-only to an app-shell banner under `PaywallProvider` so it appears everywhere.

**3c. No double-trial.** In `startCheckout`, if the user already consumed a reverse trial (a `user_trials` row exists for them), set Stripe `trial_period_days = 0` so upgrade charges immediately — making the resulting `purchase` a real paid conversion rather than a second free trial.

**Acceptance (E2E, real DB states):** a post-trial free user with usage history sees the blocking modal on a Pro page and free content still loads; a trial user with `daysRemaining<=4` sees the app-wide nudge; an active-Pro user and a brand-new free user (no trial history) see neither; an already-trialed user's upgrade checkout has no second trial (`trial_period_days=0`).

### Workstream 4 — Checkout drift guard (minimal)

In `startCheckout`, before creating a session, look up the customer's live Stripe subscriptions; if an active/trialing sub exists, do not create a second checkout — return the billing-portal URL instead (and, opportunistically, re-sync `stripe_subscription_id` via `syncFromCustomerId`). This closes the double-charge gap without a full reconcile job.

**Acceptance:** a user whose DB `stripe_subscription_id` is null but who has an active Stripe sub is routed to the portal, not a new checkout; DB is re-synced.

## Testing

Per project standard, every workstream is verified end-to-end against the real DB / real Stripe test mode — no mock-only "done." Backend gets integration tests (webhook handlers, idempotency); frontend gets E2E against real entitlement states; GA is verified by observing real `gtag` calls + GA Realtime.

## Manual steps (owner-only, outside code)

1. GA4 Admin → mark `sign_up`, `trial_start`, `purchase` as **Key Events**.
2. Confirm `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set on the Railway **frontend** service.
3. Stripe Dashboard → enable **Smart Retries**; ensure the webhook endpoint subscribes to `invoice.payment_succeeded` (in addition to the already-subscribed `invoice.payment_failed`).

## Out of scope (deferred)

- Full Stripe→DB reconcile/backfill job (historical cleanup). GT is cancelled; the webhook is fixed, so future sales record correctly. Its own spec if wanted.
- GT win-back outreach (owner decision, deferred).
- Org/team (`org-billing`) purchase instrumentation.

## Sequence

1. GA events (small, safe)
2. Dunning (isolated backend)
3. Trial paywall (biggest conversion lever)
4. Checkout drift guard
