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

One further sub-task is **verify-only** (code already covers it): (g) `signup_start`/`signup_complete` instrumentation (already firing into `user_events`). One is **reconciliation** (f): recon confirmed no overlap with the shipped 2026-04-10/04-12 activation-funnel tracks. Sub-task (e) OAuth/email-confirmation messaging is **deferred** (see Scope).

## 2. Scope

**In scope:** fixes a–d (email-signup path); verification of g; reconciliation f.

**Non-goals (deferred):**

- **Google OAuth signup flow** — deferred for now per decision 2026-06-11. The Google button's ToS-enable (§3.1) still ships for UI consistency, but the OAuth callback skip-tour wiring, OAuth E2E coverage, and sub-task (e) OAuth/email-confirmation messaging are **out of scope for this task** and tracked as a follow-up.
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

`checkoutIntent` in sessionStorage is the single "purchase intent / skip-tour" signal.

- **Email path** (`sign-up/page.tsx` success branch, `:134-174`): if `sessionStorage.getItem("checkoutIntent")` exists, `router.push` directly to the explicit redirect (`/pricing?from=…`), bypassing the `/tour` wrapper. Otherwise keep the normal `redirectTo` (`/tour…`).
- The existing `/pricing` auto-checkout effect (`pricing/page.tsx:68-96`) then reads `checkoutIntent` + `user` and fires `startCheckout`.
- **OAuth path is deferred** with the rest of the Google OAuth flow. When OAuth ships, the same signal applies in `auth/callback/page.tsx` (destination logic `:201-207`): if `checkoutIntent` exists, prefer `next` over the `needsOnboarding → /tour` branch.

No new URL contract; the signal drives the email path now and the OAuth path when it lands.

### 3.4 Fix D — report dead-end → minimal signup CTA

File: `reports/page.tsx` (~`:599`)

- Replace the flat `setError("You must be signed in…")` with a dedicated inline state: a card reading **"Sign up free to generate your {market} report"** with a CTA → `/auth/sign-up?redirect=<reports URL that preserves the selected market>`.
- Selected market must survive the redirect: serialize the current selection into the redirect URL so the user lands back ready to generate. Confirm during implementation how the reports page holds selection (URL param vs component state) and serialize accordingly.
- This is the **minimal** CTA only; the blurred-preview treatment is item #8.

### 3.5 Verify-only

- **(g) Instrumentation:** `conversion.signup_start` (`sign-up/page.tsx:93`) and `conversion.signup_complete` (email `:135`) already fire and land in `user_events` via `/api/usage/events`. The E2E asserts the rows; add instrumentation only if a gap surfaces.

_(Sub-task (e) OAuth/email-confirmation messaging is deferred with the Google OAuth flow — see Scope.)_

## 4. Testing & acceptance (production E2E)

1. **Local smoke** first: `dev:fresh` (1 frontend + 1 backend) against the real cloud Supabase — iterate, catch breakage.
2. **Deploy to production** — triggered by the user (no push/deploy without explicit ask). The authoritative E2E can only run against deployed code.
3. **Production Playwright E2E** (acceptance gate). A fresh anonymous user, with a disposable email:
   - Completes **email** signup (Google OAuth deferred).
   - From **homepage**, **pricing** ("Get Pro Access" → sign-up → checkout resumes via `checkoutIntent`), and the **report-builder dead-end**.
   - ToS unchecked → clicking Create Account shows the inline error; the button is never silently disabled.
   - Assert: row in `auth.users` + `user_profiles`; `conversion.signup_complete` visible in `user_events`.
4. **Cleanup**: delete the test accounts created in production after the run.

### Acceptance criteria (from backlog item #1, OAuth deferred)

- [x] E2E (prod, 2026-06-11): anonymous **email** signup creates an `auth.users` row from the sign-up page; report-builder and pricing entry points reach sign-up. (Profile row + activation complete on email confirmation — see §6.)
- [x] ToS unchecked → inline error on click; button never silently disabled.
- [x] Pricing "Get Pro Access" anonymous click lands on sign-up.
- [~] `signup_complete` in `user_events` — **not auto-verifiable on prod**: prod requires email confirmation, so the event fires only after the user clicks the emailed link (via `/auth/callback`), which automation can't do. See §6.
- [ ] _(Deferred)_ Google OAuth signup completes from the same entry points.

## 5. Risks & mitigations

- **Prod test accounts pollute real data** → disposable email + explicit cleanup step.
- **Deploy dependency** → "done" lags a user-triggered deploy; local smoke de-risks before deploy.
- **Market preservation through the report redirect** → covered by serializing selection into the redirect URL; verified in the E2E from the report dead-end.
- **Google OAuth deferred** → the Google button still enables on ToS-check (UI parity), but the OAuth signup flow, callback skip-tour wiring, and OAuth E2E are a separate follow-up. Avoids the Playwright/Google bot-detection problem for now and keeps this task fully automatable end-to-end.

## 6. Production verification & findings (2026-06-11)

Deployed via `develop` → `main` (merge `63b8abd0`); full Playwright suite run against `https://www.propertyiq.app` (clean `next build`). **5/5 pass.** All four fix-verification tests are green, confirming the four defects are repaired in production. The earlier local-dev failures were a `next dev --webpack` stale-client-bundle artifact (server rendered the fix; client served the old bundle), not a code issue — it does not exist in a production build.

Two prod behaviors surfaced during verification, both **outside this task's code** but worth tracking:

1. **Prod requires email confirmation (autoconfirm is OFF).** Email signup creates the `auth.users` row and lands on "Check your email" — it does **not** issue a session or fire `conversion.signup_complete` until the user clicks the emailed link (which routes through `/auth/callback`, where the event fires). The sign-up code comment ("With autoconfirm enabled…") is therefore wrong for prod. **This is a strong candidate for the "11 starts / 0 completes" funnel symptom** — if confirmation emails aren't delivered/clicked, signups never complete. Recommend a follow-up: verify prod Supabase email-confirmation + SMTP deliverability, and reconcile with deferred sub-task (e) (OAuth/confirmation messaging). The E2E was made confirmation-aware to assert account creation either way.

2. **Prod rejects leaked passwords (HaveIBeenPwned).** `StrongPass1` was rejected as "known to be weak." Not a defect — good security — but test fixtures must use unique, non-breached passwords (the E2E now generates one per run).

**Test hygiene:** the email test creates a real prod user and deletes it in `finally`; `tests/e2e/helpers/cleanup-test-users.mjs` purges any `piq-e2e-*` stragglers. Post-run sweep confirmed 0 leftover users.
