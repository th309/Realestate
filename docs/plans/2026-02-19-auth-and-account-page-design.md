# Auth Pages & Account Profile Page Design

**Date:** 2026-02-19
**Status:** Approved

## Overview

Build a complete authentication flow (login, registration, password reset) and a unified account profile page where users can view and manage all aspects of their account: personal info, subscription, watchlist, alerts, notifications, and support.

## Auth Pages

### Routes

- `/auth/sign-in` — Login
- `/auth/sign-up` — Registration
- `/auth/forgot-password` — Password reset request
- `/auth/callback` — OAuth / magic link / password reset callback handler

### Sign-In Methods (5 total)

1. **Email + password** — Primary form
2. **Magic link** — Toggle on sign-in page swaps password field for "Send link" button
3. **Passkey** — "Sign in with passkey" button, WebAuthn API via Supabase
4. **Google OAuth** — Social login button
5. **Apple OAuth** — Social login button
6. **GitHub OAuth** — Social login button

### Sign-In Page

- Email + password form (primary)
- "Sign in with magic link" toggle
- OAuth buttons: Google, Apple, GitHub
- Passkey button
- "Forgot password?" link
- "Don't have an account? Sign up" link
- Error handling for all auth methods

### Sign-Up Page

- Email + password form with password strength indicator
- OAuth buttons (same set — creates account on first use)
- "Already have an account? Sign in" link
- Terms of service / privacy policy checkbox

### Password Reset Flow

1. User enters email on `/auth/forgot-password`
2. Supabase sends reset link
3. `/auth/callback` handles the token
4. User sets new password

### Post-Auth Redirect

- After successful login, redirect to the page the user was trying to access
- Store intended destination in URL search params (`?redirect=/market/123`)
- Default redirect: `/dashboard`

## Account Page

### Route

`/account` — Single page with tabbed sections

### Profile Header (Always Visible Above Tabs)

- Avatar (uploadable via Supabase Storage) + display name + email
- Tier badge (Free / Pro / Enterprise) with color indicator
- Member since date

### Tab 1: Profile

**Personal Info:**
- Editable display name
- Email (read-only, from Supabase Auth)
- Avatar upload (drag-and-drop or click, stored in Supabase Storage)

**Security:**
- Change password button/form
- Manage passkeys (register/remove)
- Connected OAuth accounts (Google/Apple/GitHub) with connect/disconnect

**Account Actions:**
- Delete account button with confirmation modal explaining data loss

**Save behavior:** Individual save buttons per section, not one big form. Optimistic UI with error rollback.

### Tab 2: Subscription

**Current Plan Card:**
- Tier name, price, billing cycle (monthly/annual), next billing date

**Usage Meters (progress bars against entitlement limits):**
- Reports generated this month (e.g., 3/5)
- AI analyses used this month (e.g., 7/20)
- Saved markets count vs limit (e.g., 5/10)
- Active alerts count vs limit (e.g., 2/5)
- Any other entitlement-gated features with limits

**Plan Comparison:**
- Side-by-side cards: Free vs Pro vs Enterprise
- Feature highlights per tier
- "Current" badge on active tier

**Actions:**
- "Upgrade" button → `/pricing` page (free users) or Stripe checkout (plan changes)
- "Manage Subscription" → Stripe customer portal (update payment, cancel, downgrade)

**Trial Status:**
- If on trial, show days remaining with prominent countdown

All usage data sourced from `useEntitlements()` context (`getUsage(featureSlug)`).

### Tab 3: Activity

**Watchlist Section:**
- Reuses `WatchlistDashboard` component (grid of saved markets with score sparklines)
- Remove button per card, bulk "Clear all" option
- Count vs limit display ("5 of 10 markets saved")
- Empty state with CTA to explore markets

**Alerts Section:**
- Reuses existing alert components (`AlertFeed`, alert list with toggle/delete)
- Active alert count vs limit ("2 of 5 alerts")
- "Create Alert" button (links to `/alerts` or inline form)
- Recent trigger history

**Notification Preferences Section:**
- Email toggles: weekly digest, alert emails, marketing
- Same API calls as existing `/account/notifications` page

### Tab 4: Support

- Contact form with fields:
  - Issue type dropdown (Bug report, Feature request, Billing question, General question)
  - Description textarea
  - Optional email override
- Submits to Supabase `support_tickets` table (or sends email)
- "Thanks, we'll get back to you" confirmation message
- Link to FAQ/docs if available

## Existing Infrastructure Leveraged

- **Supabase Auth** — Already integrated (client, server, admin SDKs)
- **EntitlementsContext** — Provides tier, `canAccess()`, `getUsage()`, `isMetricGated()`
- **WatchlistDashboard** — Existing component for saved markets grid
- **AlertFeed** — Existing component for alert history
- **Billing fetchers** — `startCheckout()`, `getBillingPortalUrl()` already in data layer
- **Email preferences API** — `GET/PATCH /api/email/preferences` already working

## Consolidation

The existing `/account/billing` and `/account/notifications` sub-pages will be superseded by the unified `/account` page. Old routes should redirect to `/account` with the appropriate tab selected via query param (`/account?tab=subscription`, `/account?tab=activity`).

## Testing Strategy

### E2E Test Suite (Playwright)

**Account creation flow:**
- Simulate sign-up with email/password
- Verify email confirmation handling
- Test OAuth redirect flows
- Passkey registration

**Login flow:**
- Test all 5 auth methods (email/password, magic link, passkey, Google, Apple, GitHub)
- Forgot password flow
- Invalid credentials error handling
- Post-login redirect to intended page

### Per-Tier Testing (Free, Pro, Enterprise, Admin)

Each tier gets a full pass through every tab with live data:

**Profile tab:**
- Edit name, upload avatar, change password
- Connect/disconnect OAuth providers

**Subscription tab:**
- Verify correct plan card displays
- Usage meters reflect real limits per tier
- Upgrade CTAs appear for correct tiers only
- Stripe portal link works for paid tiers

**Activity tab:**
- Watchlist respects tier limits (add beyond limit → blocked)
- Alerts gating (Pro+ only)
- Notification preference saves persist across reload

**Support tab:**
- Form submission with validation
- Confirmation message display

### Tier Transition Testing

- **Free → Pro upgrade:** Usage meters update, gated features unlock, limits increase
- **Pro → Free downgrade:** Graceful degradation, over-limit items handled
- **Trial expiration:** Correct fallback behavior

### Live Data Validation

- Real Supabase auth (create test users, clean up after)
- Real entitlements resolution against database
- Real Stripe portal redirects (test mode)
- Real watchlist/alert CRUD operations

### Test Matrix

| Feature                  | Free    | Pro | Enterprise | Admin |
|--------------------------|---------|-----|------------|-------|
| Sign up / Sign in        | x       | x   | x          | x     |
| Edit profile             | x       | x   | x          | x     |
| View plan & usage        | x       | x   | x          | x     |
| Usage limits correct     | x       | x   | x          | x     |
| Upgrade CTA visible      | x       | x   | -          | -     |
| Stripe portal access     | -       | x   | x          | -     |
| Watchlist (limit enforced)| x      | x   | x          | x     |
| Alerts (gated)           | blocked | x   | x          | x     |
| Notifications            | x       | x   | x          | x     |
| Support form             | x       | x   | x          | x     |
