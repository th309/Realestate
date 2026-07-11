# Conversion Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the paid funnel measurable (GA events), give the free trial a real decision-point at expiry, recover failed payments, and prevent double-charge on DB/Stripe drift.

**Architecture:** Reuse existing infra. GA uses the existing `gtagEvent()` helper. Dunning mirrors the existing `TrialEndingNotificationService` (idempotent via `email_triggers`) and reuses the existing Stripe billing portal. The trial paywall wires the already-built-but-orphaned `PersonalizedPaywall` at the app shell, gated on the existing `usePostTrialState()`. The checkout guard reuses `syncFromCustomerId`.

**Tech Stack:** Next.js 16 (frontend, `packages/frontend`), NestJS 11 (backend, `packages/backend`), Stripe SDK, Supabase, Resend (email), Jest (backend tests), Vitest (frontend tests, local-only).

## Global Constraints

- Branch: `develop`. Verify with `git branch --show-current` before every commit. Never push without explicit user approval.
- Commit with explicit pathspec (`git commit -- <paths>`); never sweep unrelated WIP already in the working tree.
- No `Co-Authored-By` (configured via `attribution.commit=""`).
- Data fetching (frontend) only through `@/lib/data`. Backend metric/fallback logic only through `MetricResolutionService` (not relevant here but do not violate).
- GA4 helper is `gtagEvent(name, params)` from `@/lib/analytics/tracker` — distinct from the internal `trackEvent()`. Only `gtagEvent` reaches GA4.
- Money in Stripe is in cents; divide by 100 for display/`value`.
- Email idempotency uses `email_triggers` UNIQUE(user_id, trigger_name) — claim-before-send, release on failure (see `TrialEndingNotificationService`).
- Verify each workstream end-to-end (real DB / Stripe test mode / real browser) — no mock-only "done".

---

## Workstream 1 — GA4 conversion events

### Task 1: Fire `trial_start` at signup

**Files:**

- Modify: `packages/frontend/app/(app)/auth/sign-up/complete-signup.ts` (near line 33, right after the existing `gtagEvent("sign_up", ...)`)
- Modify: `packages/frontend/app/(app)/auth/callback/page.tsx` (near line 229, right after the existing `gtagEvent("sign_up", ...)`)

**Interfaces:**

- Consumes: `gtagEvent(name: string, params?: Record<string, unknown>): void` from `@/lib/analytics/tracker`.
- Produces: GA4 `trial_start` event (no code consumers).

- [ ] **Step 1: Add `trial_start` in `complete-signup.ts`.** Immediately after the existing `gtagEvent("sign_up", { method: opts.method })` call, add:

```ts
gtagEvent("trial_start", { tier: "pro" });
```

(The reverse Pro trial is granted 1:1 at signup, so this is the correct, once-per-user location. Do NOT add it in `startOnboardingTrial()` call sites — `tour/page.tsx` re-runs on every market change.)

- [ ] **Step 2: Add `trial_start` in `auth/callback/page.tsx`.** Immediately after the existing `gtagEvent("sign_up", { method: isEmailConfirm ? "email" : "oauth" })` call, add the identical line:

```ts
gtagEvent("trial_start", { tier: "pro" });
```

Confirm `gtagEvent` is already imported in both files (it is — it powers the adjacent `sign_up`). If not, import from `@/lib/analytics/tracker`.

- [ ] **Step 3: Verify (real browser).** Run the frontend locally (`local-dev-servers` skill / `npm run dev` in `packages/frontend`). Complete a fresh signup with a throwaway email. In DevTools, confirm a `gtag('event','trial_start',{tier:'pro'})` call fires exactly once (Network → `google-analytics.com/g/collect?...en=trial_start`, or a `window.gtag` breakpoint). Confirm `sign_up` still fires too.
      Expected: exactly one `trial_start` and one `sign_up` per signup.

- [ ] **Step 4: Commit.**

```bash
git branch --show-current   # must print: develop
git add "packages/frontend/app/(app)/auth/sign-up/complete-signup.ts" "packages/frontend/app/(app)/auth/callback/page.tsx"
git commit -m "feat(ga): fire trial_start GA4 event at signup"
```

### Task 2: Fire `purchase` on the Stripe return page

**Files:**

- Modify: `packages/backend/src/billing/billing.service.ts` (checkout `successUrl` build, ~line 138) — append the plan amount to the return URL.
- Modify: `packages/frontend/app/(app)/upgrade/success/page.tsx` (add a purchase-fire effect in `SuccessContent`)

**Interfaces:**

- Consumes: `gtagEvent` from `@/lib/analytics/tracker`; `useSearchParams` (already imported); `tier` from `useEntitlements()` (already in scope).
- Produces: GA4 `purchase` event with `{ transaction_id, value, currency:"USD", items:[{item_id: tier}] }`.

- [ ] **Step 1: Pass the amount through `successUrl` (backend).** In `billing.service.ts` `startCheckout`, where `successUrl` is built (currently `${baseUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}&returnContext=...`), append `&value=<dollars>` where `<dollars>` is the selected plan's price for the chosen interval. The price is available from the `subscription_tiers` row already loaded for the tier (columns `price_monthly` / `price_yearly`); if not currently loaded in this method, select it alongside the existing `trial_config` read. Result URL shape:

```
${baseUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}&returnContext=<ctx>&value=39
```

Keep `{CHECKOUT_SESSION_ID}` as the literal Stripe placeholder (Stripe substitutes it).

- [ ] **Step 2: Fire `purchase` (frontend).** In `SuccessContent` (`upgrade/success/page.tsx`), add an effect that fires once per `session_id`. Add imports at top: `import { gtagEvent } from "@/lib/analytics/tracker"; import { useRef } from "react";`. Inside `SuccessContent`, add:

```tsx
const purchaseFiredRef = useRef(false);
const sessionId = searchParams.get("session_id");
const purchaseValue = Number(searchParams.get("value") ?? "0");

useEffect(() => {
  if (purchaseFiredRef.current || !sessionId) return;
  purchaseFiredRef.current = true;
  gtagEvent("purchase", {
    transaction_id: sessionId,
    value: Number.isFinite(purchaseValue) ? purchaseValue : 0,
    currency: "USD",
    items: [{ item_id: tier }],
  });
}, [sessionId, purchaseValue, tier]);
```

The `useRef` guard prevents React StrictMode double-invoke and refresh double-count; `transaction_id = session_id` gives GA server-side dedup as a backstop.

- [ ] **Step 3: Verify (real browser, Stripe test mode).** With a Stripe test card (`4242 4242 4242 4242`), complete a checkout from `/pricing`. On landing at `/upgrade/success`, confirm one `purchase` event fires with a non-zero `value` and `transaction_id` = the `session_id` (Network → `.../g/collect?...en=purchase`). Refresh the page; confirm `purchase` does NOT fire again.
      Expected: exactly one `purchase` with correct value; no double-fire on refresh.

- [ ] **Step 4: Commit.**

```bash
git branch --show-current   # develop
git add packages/backend/src/billing/billing.service.ts "packages/frontend/app/(app)/upgrade/success/page.tsx"
git commit -m "feat(ga): fire purchase GA4 event on checkout return with plan value"
```

> **Owner manual step (record in handoff, not code):** In GA4 Admin, mark `sign_up`, `trial_start`, `purchase` as Key Events. Confirm `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set on the Railway frontend service.

---

## Workstream 2 — Dunning (failed-payment recovery)

### Task 3: Failed-payment email + notification service

**Files:**

- Modify: `packages/backend/src/email/behavioral-trigger-emails.ts` (add `buildPaymentFailedEmail`)
- Create: `packages/backend/src/billing/payment-failed-notification.service.ts`
- Modify: `packages/backend/src/billing/billing.module.ts` (register the new provider)
- Modify: `packages/backend/src/billing/billing-webhook.service.ts` (inject + call the notifier from the `invoice.payment_failed` case)
- Test: `packages/backend/src/billing/payment-failed-notification.service.spec.ts`

**Interfaces:**

- Consumes: `EmailService.sendEmail(options)`, `SupabaseService.getClient()`, `ConfigService`, `getEmailLinkBaseUrl(config)`, `buildUnsubscribe(config, userId)` — all exactly as used in `trial-ending-notification.service.ts`.
- Produces: `PaymentFailedNotificationService.handlePaymentFailed(invoice: Stripe.Invoice): Promise<void>` — idempotent, keyed `payment_failed:${invoice.id}`.

- [ ] **Step 1: Add the email template.** In `behavioral-trigger-emails.ts`, add `buildPaymentFailedEmail(firstName: string, updateCardUrl: string, unsubscribeUrl: string): string` following the structure of the existing `buildTrialWillEndEmail` (same wrapper/branding). Copy: subject-less HTML body reading "Your PropertyIQ payment didn't go through. Update your card to keep your Pro access." with a primary button linking to `updateCardUrl`.

- [ ] **Step 2: Write the failing test.** Create `payment-failed-notification.service.spec.ts`. Mock `SupabaseService` (returns a profile `{ id, email }` for the customer, and an `email_triggers` insert that succeeds once then conflicts) and `EmailService`. Test:

```ts
it("sends exactly one payment-failed email and is idempotent on redelivery", async () => {
  const invoice = { id: "in_1", customer: "cus_1" } as any;
  await service.handlePaymentFailed(invoice);
  await service.handlePaymentFailed(invoice); // Stripe redelivery
  expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Run it, expect fail.** `npm test -- payment-failed-notification` in `packages/backend`. Expected: FAIL (service/method missing).

- [ ] **Step 4: Implement the service** by mirroring `TrialEndingNotificationService` (`packages/backend/src/billing/trial-ending-notification.service.ts`) — same constructor deps, same claim-before-send idempotency, same release-on-failure. Differences: resolve user by `invoice.customer` (string or `.id`); trigger name `payment_failed:${invoice.id}`; `emailType: 'payment_failed'`; body from `buildPaymentFailedEmail(email.split('@')[0], `${appUrl}/account/billing`, unsub?.url ?? ...)`; subject `Action needed: your PropertyIQ payment failed`.

- [ ] **Step 5: Register + wire.** Add `PaymentFailedNotificationService` to `billing.module.ts` providers. In `billing-webhook.service.ts`, inject it (optional, like `trialEndingNotifier`) and in the existing `case 'invoice.payment_failed':` block, after `await this.handlePaymentFailed(invoice)`, add `await this.paymentFailedNotifier?.handlePaymentFailed(invoice);`. (Keep the existing `past_due` status flip in `handlePaymentFailed`.)

- [ ] **Step 6: Run tests, expect pass.** `npm test -- payment-failed-notification`. Expected: PASS. Also run `nest build` (from `packages/backend`) — zero errors.

- [ ] **Step 7: Commit.**

```bash
git branch --show-current   # develop
git add packages/backend/src/email/behavioral-trigger-emails.ts packages/backend/src/billing/payment-failed-notification.service.ts packages/backend/src/billing/payment-failed-notification.service.spec.ts packages/backend/src/billing/billing.module.ts packages/backend/src/billing/billing-webhook.service.ts
git commit -m "feat(billing): email + update-card prompt on invoice.payment_failed"
```

### Task 4: Payment-recovered handler

**Files:**

- Modify: `packages/backend/src/billing/billing-webhook.service.ts` (add `invoice.payment_succeeded` case + `handlePaymentRecovered`)
- Test: extend `packages/backend/src/billing/billing-webhook.service.spec.ts` (create if absent)

**Interfaces:**

- Consumes: `SupabaseService.getClient()`, `McpEntitlementsInvalidator.invalidate([userId])`, optionally `PaymentFailedNotificationService` pattern for a confirmation email.
- Produces: `handlePaymentRecovered(invoice: Stripe.Invoice): Promise<void>` — clears `past_due`→`active` only when currently `past_due`.

- [ ] **Step 1: Write the failing test.** Assert that given a profile with `subscription_status='past_due'`, `handlePaymentRecovered({customer:'cus_1'})` updates it to `'active'` and invalidates MCP; and that a profile already `'active'` is left unchanged (no redundant confirmation email).

- [ ] **Step 2: Run it, expect fail.** `npm test -- billing-webhook` in `packages/backend`. Expected: FAIL.

- [ ] **Step 3: Implement.** Add to the switch (after the `invoice.payment_failed` case):

```ts
case 'invoice.payment_succeeded': {
  await this.handlePaymentRecovered(event.data.object);
  break;
}
```

Implement `handlePaymentRecovered` mirroring `handlePaymentFailed`: resolve profile by `invoice.customer`; select `id, subscription_status`; if `subscription_status === 'past_due'`, update to `'active'`, invalidate MCP, and (optional) send a one-line "payment received, you're all set" email via the same idempotent pattern (trigger `payment_recovered:${invoice.id}`). If not `past_due`, return (avoids emailing on every normal renewal).

- [ ] **Step 4: Run tests, expect pass + `nest build` clean.**

- [ ] **Step 5: Commit.**

```bash
git branch --show-current   # develop
git add packages/backend/src/billing/billing-webhook.service.ts packages/backend/src/billing/billing-webhook.service.spec.ts
git commit -m "feat(billing): clear past_due on invoice.payment_succeeded recovery"
```

> **Owner manual step:** In the Stripe Dashboard, enable Smart Retries and add `invoice.payment_succeeded` to the webhook endpoint's subscribed events (it already subscribes `invoice.payment_failed`).

---

## Workstream 3 — Trial decision-point (free trial + hard paywall)

### Task 5: No second (Stripe) trial for already-trialed users

**Files:**

- Modify: `packages/backend/src/billing/billing.service.ts` (`startCheckout`, trial-config block ~lines 120-148)
- Test: `packages/backend/src/billing/billing.service.spec.ts` (create/extend)

**Interfaces:**

- Consumes: `SupabaseService` (`user_trials` lookup), existing `trial_config` read.
- Produces: checkout session with `trial_period_days = 0` when the user already has a `user_trials` row.

- [ ] **Step 1: Write the failing test.** Given a user with an existing `user_trials` row, assert `startCheckout` calls Stripe checkout creation with `trialPeriodDays === 0` (no second free trial). Given a user with no `user_trials` row, assert it uses `trial_config.duration_days`.

- [ ] **Step 2: Run it, expect fail.** `npm test -- billing.service` in `packages/backend`.

- [ ] **Step 3: Implement.** In `startCheckout`, after computing `trialPeriodDays` from `trial_config`, query `user_trials` for the user (`select id ... eq user_id`); if a row exists, set `trialPeriodDays = 0`. Enterprise already skips trials — leave that path unchanged.

- [ ] **Step 4: Run tests, expect pass + `nest build` clean.**

- [ ] **Step 5: Commit.**

```bash
git branch --show-current   # develop
git add packages/backend/src/billing/billing.service.ts packages/backend/src/billing/billing.service.spec.ts
git commit -m "feat(billing): no second free trial for users who used the reverse trial"
```

### Task 6: App-wide pre-expiry nudge

**Files:**

- Create: `packages/frontend/app/components/paywall/TrialEndingBanner.tsx` (app-shell banner; reuse `TrialExpirationBanner`'s logic/copy)
- Modify: `packages/frontend/app/providers.tsx` (mount under `PaywallProvider`, ~lines 174-178)

**Interfaces:**

- Consumes: `useEntitlements().trial` → `{ active, daysRemaining }`.
- Produces: an app-wide banner rendered only when `trial?.active && trial.daysRemaining <= 4`.

- [ ] **Step 1: Build the banner.** Create `TrialEndingBanner.tsx` (client component) that reads `useEntitlements().trial`, returns `null` unless `trial?.active && trial.daysRemaining <= 4`, and renders a slim top bar: `Your Pro trial ends in {daysRemaining} day(s)` + a "Keep Pro" link to `/pricing?from=trial_ending`. Match M3 styling (`bg-primary-container`, `text-on-primary-container`, `rounded-none`, dismiss stored in `sessionStorage` so it can be closed but reappears next session). Reuse copy from the existing `dashboard/components/TrialExpirationBanner.tsx`.

- [ ] **Step 2: Mount app-wide.** In `providers.tsx`, render `<TrialEndingBanner />` just inside `PaywallProvider` (alongside where `FreeUserUpgradeModal` is injected), so it shows on every route, not just the dashboard.

- [ ] **Step 3: Verify (real browser, real DB).** Set a test user's `user_trials.expires_at` to 2 days out. Log in; confirm the banner appears on `/map`, `/reports`, etc. Set `expires_at` 10 days out; confirm it does NOT show.
      Expected: banner shows app-wide only within 4 days of expiry.

- [ ] **Step 4: Commit.**

```bash
git branch --show-current   # develop
git add "packages/frontend/app/components/paywall/TrialEndingBanner.tsx" packages/frontend/app/providers.tsx
git commit -m "feat(trial): app-wide pre-expiry nudge banner"
```

### Task 7: At-expiry hard paywall

**Files:**

- Create: `packages/frontend/app/components/paywall/PostTrialPaywallGate.tsx` (mount wrapper deciding when to show the modal)
- Modify: `packages/frontend/app/providers.tsx` (mount under `PaywallProvider`)
- Reuse (no change unless copy tweak): `packages/frontend/app/components/paywall/PersonalizedPaywall.tsx`
- Read before editing: `PersonalizedPaywall.tsx` (props/CTA), `lib/entitlements/PaywallProvider.tsx` (how `FreeUserUpgradeModal` is mounted), and the Pro-surface route list.

**Interfaces:**

- Consumes: `usePostTrialState().isPostTrial`; `usePathname()` (Next) to detect Pro-gated routes.
- Produces: a blocking `PersonalizedPaywall` shown when `isPostTrial && onProSurface`.

- [ ] **Step 1: Define Pro surfaces.** In `PostTrialPaywallGate.tsx`, define the Pro-gated path prefixes: `['/reports', '/scores', '/screener', '/analyzer']` plus metro/county/ZIP map/market detail routes (`/market`, and `/map` when a sub-national geo is selected). Free surfaces (`/`, national/state `/map`, `/pricing`, `/account`, `/auth`, `/dashboard`) must NOT trigger the block.

- [ ] **Step 2: Build the gate.** The component reads `usePostTrialState().isPostTrial` and `usePathname()`. When `isPostTrial === true` AND the current path matches a Pro surface, render `<PersonalizedPaywall />` (the orphaned modal, CTA → `/pricing?from=trial_expired`) as a blocking overlay; otherwise render `null`. Do not trap the user — the modal's only actions are "Choose a plan" (→ pricing) and a close/back affordance that returns them to a free surface.

- [ ] **Step 3: Mount.** In `providers.tsx`, render `<PostTrialPaywallGate />` under `PaywallProvider` (same location as Task 6's banner).

- [ ] **Step 4: Verify (real browser, real DB states).**
  - Post-trial free user WITH usage history (expired `user_trials`, `converted_at` null, `markets_viewed>0`): visiting `/reports` → modal blocks; visiting `/` or national `/map` → no modal, content loads.
  - Active-trial user: no modal anywhere.
  - Brand-new free user, no usage history: no modal (guards against gating never-trialed users).
  - Active Pro user: no modal.
    Expected: modal appears only for post-trial users on Pro surfaces.

- [ ] **Step 5: Commit.**

```bash
git branch --show-current   # develop
git add "packages/frontend/app/components/paywall/PostTrialPaywallGate.tsx" packages/frontend/app/providers.tsx
git commit -m "feat(trial): hard paywall on Pro surfaces after trial expiry"
```

---

## Workstream 4 — Checkout drift guard

### Task 8: Block a second checkout when a live Stripe sub exists

**Files:**

- Modify: `packages/backend/src/billing/stripe.service.ts` (add `listActiveSubscriptionsForCustomer(customerId): Promise<Stripe.Subscription[]>`)
- Modify: `packages/backend/src/billing/billing.service.ts` (`startCheckout` guard)
- Test: `packages/backend/src/billing/billing.service.spec.ts`

**Interfaces:**

- Consumes: `StripeService.listActiveSubscriptionsForCustomer`; `BillingUserSyncService.syncFromCustomerId(customerId, subscription)` (re-sync drifted DB); existing `getBillingPortalUrl`.
- Produces: `startCheckout` returns the portal URL (not a new checkout) when the customer already has an `active`/`trialing` Stripe subscription.

- [ ] **Step 1: Write the failing test.** Given a user whose `user_profiles.stripe_customer_id` is set and whose Stripe customer has an `active` subscription (but `stripe_subscription_id` is null in the DB — the drift case), assert `startCheckout` does NOT create a new Stripe Checkout session, instead returns the billing-portal URL, and calls `syncFromCustomerId` to repair the DB.

- [ ] **Step 2: Run it, expect fail.** `npm test -- billing.service` in `packages/backend`.

- [ ] **Step 3: Implement `listActiveSubscriptionsForCustomer`** in `stripe.service.ts` using the private client (pattern already present at `stripe.service.ts:313`): `this.getStripeClient().subscriptions.list({ customer, status: 'all', limit: 10 })` then filter to `status === 'active' || status === 'trialing'`.

- [ ] **Step 4: Implement the guard** in `startCheckout`: if the user has a `stripe_customer_id`, call `listActiveSubscriptionsForCustomer`; if any live sub exists, call `syncFromCustomerId(customerId, sub)` to repair `stripe_subscription_id`/tier, then return `{ url: await this.getBillingPortalUrl(userId) }` instead of creating a checkout session. Preserve the existing happy path when no live sub exists.

- [ ] **Step 5: Run tests, expect pass + `nest build` clean.**

- [ ] **Step 6: Commit.**

```bash
git branch --show-current   # develop
git add packages/backend/src/billing/stripe.service.ts packages/backend/src/billing/billing.service.ts packages/backend/src/billing/billing.service.spec.ts
git commit -m "fix(billing): route drifted paid users to portal, prevent double-charge"
```

---

## Final verification (after all tasks)

- [ ] `nest build` in `packages/backend` — zero errors.
- [ ] `npm test` in `packages/backend` — all billing/email specs green.
- [ ] Frontend: `npm run build` in `packages/frontend` — compiles clean.
- [ ] End-to-end smoke (Stripe test mode + real local DB): fresh signup → `trial_start` in GA Realtime; force `expires_at` past → paywall on `/reports`; checkout with test card → `purchase` in GA Realtime + DB tier `pro`; trigger a failing renewal (test clock) → payment-failed email in `email_log`; recover → status back to `active`.
- [ ] Confirm the three owner manual steps are recorded in the completion handoff (GA Key Events, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, Stripe Smart Retries + `invoice.payment_succeeded` subscription).
