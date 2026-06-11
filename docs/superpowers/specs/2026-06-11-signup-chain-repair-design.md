# Signup Chain Repair — Design Spec

**Date:** 2026-06-11
**Backlog item:** #1 — "Repair the signup chain end-to-end so every CTA reaches a working account creation"
**Source audit:** `docs/superpowers/results/2026-06-10-piq-product-audit.md` §1 (Rec #1)
**Evidence:** 11 signup starts / 0 completes in 30 days.

---

## 1. Problem

Anonymous visitors cannot reliably create an account. Four confirmed defects break the path:

| #   | Defect                                                                                                                                                                                     | Location (verified)                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| a   | Create Account + Google buttons are silently disabled until the ToS box is checked; the inline "you must accept ToS" error is dead code because the disabled button never fires the click. | `packages/frontend/app/auth/sign-up/page.tsx:382`, `:404` (handlers at `:100-103`, `:182-185`) |
| b   | Pricing "Get Pro Access" for anonymous users routes to **sign-in**, not sign-up.                                                                                                           | `packages/frontend/app/pricing/page.tsx:138`                                                   |
| c   | The Free-tier card shows a dead **"Current Plan"** button + green badge to anonymous users, because the page treats anonymous as logged-in free (`effectiveTier ?? "free"`).               | `pricing/page.tsx:190`; `pricing/components/PricingCards.tsx:120`, `:153-157`, `:249-254`      |
| d   | The anonymous report-builder dead-ends on a flat "You must be signed in" error string with no signup CTA.                                                                                  | `packages/frontend/app/reports/page.tsx:~599`                                                  |

Two further sub-tasks are **verify-only** (code already covers them): (e) OAuth/email-confirmation messaging, (g) `signup_start`/`signup_complete` instrumentation (already firing into `user_events`). One is **reconciliation** (f): recon confirmed no overlap with the shipped 2026-04-10/04-12 activation-funnel tracks.

## 2. Scope

**In scope:** fixes a–d; verification of e, g; reconciliation f.

**Non-goals (explicitly deferred to their own backlog items):**

- Full blurred first-section report preview → item #8.
- Single dismissible-paywall refactor / server-side redaction → item #19.
- Pricing-architecture, annual-first toggle, fair-billing → item #18.

This spec only repairs the _path to a created account_.

## 3. Design

### 3.1 Fix A — ToS: enabled-by-default + inline error

File: `auth/sign-up/page.tsx`

- Remove `!tosAccepted` from the `disabled` expression on the Create Account button (`:382`) and the Google button (`:404`); keep `disabled={loading}`.
- The existing handler guards (`handleSignUp` `:100-103`, `handleOAuth` `:182-185`) already `setError(...)` and `return` when ToS is unchecked — enabling the buttons makes that inline error reachable.
- Polish: when the error is the ToS error, emphasize the ToS checkbox (ring) and scroll it into view (error banner is top of form, checkbox is bottom).
- UI change goes through the `frontend-design:frontend-design` skill per team convention.

### 3.2 Fix B + C — pricing anonymous handling

Files: `pricing/page.tsx`, `pricing/components/PricingCards.tsx`

- Root cause: anonymous is indistinguishable from logged-in free. Thread a new `isAuthenticated={!!user}` prop: `PricingPage → PricingCards → PricingCard → CardCTA`.
- The "Current Plan" badge (`PricingCard:153`) and the dead "Current Plan" div (`CardCTA:249`) render **only when `isCurrentPlan && isAuthenticated`**.
- Anonymous **Free** card CTA → **"Sign up free"** → `/auth/sign-up`.
- Anonymous **Pro/paid** card → `handleUpgrade(slug)`.
- `handleUpgrade` (`pricing/page.tsx:128-140`) for the `!user` branch: keep writing `checkoutIntent` to sessionStorage; change the redirect from `/auth/sign-in?...` to **`/auth/sign-up?redirect=/pricing?from=<returnContext>`**.

### 3.3 Resume checkout without the tour — Approach A (approved)

`checkoutIntent` in sessionStorage is the single "purchase intent / skip-tour" signal. It already persists across the OAuth round-trip (same tab).

- **Email path** (`sign-up/page.tsx` success branch, `:134-174`): if `sessionStorage.getItem("checkoutIntent")` exists, `router.push` directly to the explicit redirect (`/pricing?from=…`), bypassing the `/tour` wrapper. Otherwise keep the normal `redirectTo` (`/tour…`).
- **OAuth path** (`auth/callback/page.tsx` destination logic `:201-207`): if `checkoutIntent` exists in sessionStorage, prefer `next` over the `needsOnboarding → /tour` branch.
- The existing `/pricing` auto-checkout effect (`pricing/page.tsx:68-96`) then reads `checkoutIntent` + `user` and fires `startCheckout`.

No new URL contract; one signal drives both signup paths.

### 3.4 Fix D — report dead-end → minimal signup CTA

File: `reports/page.tsx` (~`:599`)

- Replace the flat `setError("You must be signed in…")` with a dedicated inline state: a card reading **"Sign up free to generate your {market} report"** with a CTA → `/auth/sign-up?redirect=<reports URL that preserves the selected market>`.
- Selected market must survive the redirect: serialize the current selection into the redirect URL so the user lands back ready to generate. Confirm during implementation how the reports page holds selection (URL param vs component state) and serialize accordingly.
- This is the **minimal** CTA only; the blurred-preview treatment is item #8.

### 3.5 Verify-only

- **(e) OAuth/email-confirmation:** Confirm the live Supabase email-confirmation setting. Email signup uses autoconfirm (immediate session) and already has a `confirmationSent` "Check your email" fallback; Google pre-verifies email. If autoconfirm is on → (e) is a documented no-op. If off → the existing `confirmationSent` UI + callback `otp_expired`/error handling (`auth/callback/page.tsx:72-79`) already cover it; verify in the E2E.
- **(g) Instrumentation:** `conversion.signup_start` (`sign-up/page.tsx:93`) and `conversion.signup_complete` (email `:135`, OAuth `auth/callback/page.tsx:188`) already fire and land in `user_events` via `/api/usage/events`. The E2E asserts the rows; add instrumentation only if a gap surfaces.

## 4. Testing & acceptance (production E2E)

1. **Local smoke** first: `dev:fresh` (1 frontend + 1 backend) against the real cloud Supabase — iterate, catch breakage.
2. **Deploy to production** — triggered by the user (no push/deploy without explicit ask). The authoritative E2E can only run against deployed code.
3. **Production Playwright E2E** (acceptance gate). A fresh anonymous user, with a disposable email:
   - Completes **email** signup and **Google OAuth** signup.
   - From **homepage**, **pricing** ("Get Pro Access" → sign-up → checkout resumes via `checkoutIntent`), and the **report-builder dead-end**.
   - ToS unchecked → clicking Create Account shows the inline error; the button is never silently disabled.
   - Assert: row in `auth.users` + `user_profiles`; `conversion.signup_complete` visible in `user_events`.
4. **Cleanup**: delete the test accounts created in production after the run.

### Acceptance criteria (from backlog item #1)

- [ ] E2E: fresh anonymous user completes email **and** Google OAuth signup from (a) homepage, (b) pricing, (c) report-builder dead-end — account row in `auth.users` + profile created.
- [ ] ToS unchecked → inline error on click; button never silently disabled.
- [ ] Pricing "Get Pro Access" anonymous click lands on sign-up.
- [ ] `signup_complete` events visible in `user_events` after the E2E run.

## 5. Risks & mitigations

- **Prod test accounts pollute real data** → disposable email + explicit cleanup step.
- **sessionStorage persistence across the Google OAuth round-trip** is the riskiest assumption → the OAuth path is explicitly exercised in the E2E.
- **Deploy dependency** → "done" lags a user-triggered deploy; local smoke de-risks before deploy.
- **Market preservation through the report redirect** → covered by serializing selection into the redirect URL; verified in the E2E from the report dead-end.
- **Google OAuth is hard to automate in Playwright** (Google bot-detects headless logins). Mitigation options to decide at plan time: (1) a dedicated test Google account with a stored/reused auth state, (2) a `storageState` seeded from a one-time manual login, or (3) assert the OAuth _handoff_ (correct `signInWithOAuth` redirect to Google with the right `callbackUrl`/`tos=1`/`next`) automatically and verify the post-callback landing with a manually-completed login. The email-signup path remains fully automatable end-to-end regardless.
