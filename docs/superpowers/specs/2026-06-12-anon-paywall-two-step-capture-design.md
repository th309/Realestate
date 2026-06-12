# Design: Replace the Undismissable 5-Page Wall with Reventure-Style Two-Step Capture

**Date:** 2026-06-12
**Backlog item:** #2 (`tasks/piq-improvement-backlog-2026-06-10.md`)
**Source audit:** `docs/superpowers/results/2026-06-10-piq-product-audit.md` (Rec #2)
**Status:** Design approved; pending implementation plan.

---

## 1. Problem

Anonymous users hit a **non-dismissible full-screen wall** (`AnonPaywallOverlay`) after viewing 5 product pages (`/map`, `/graphs`, `/market`, `/scores`, `/reports`). It has no X, no Escape, no backdrop dismiss (`components/entitlements/AnonPaywallOverlay.tsx`, mounted via `lib/entitlements/PaywallProvider.tsx:46,90`). This contradicts the audit's own principle — **"lock the premium layer, never the front door"** — and sits at the top of a funnel measuring **11 signup starts / 0 completes in 30 days**.

### What the original audit assumed vs. what the code actually shows

The audit (written 2026-06-10) overstated several sub-problems. Verified against the codebase 2026-06-12:

| Audit claim                                                            | Reality                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wall traps 94% of SEO traffic; poisons crawlability                    | **False.** The wall counts only `/map`, `/graphs`, `/market`, `/scores`, `/reports` (`usePaywallPageTracking.ts:16`). SEO pages live at `/markets/*` and are excluded. The wall is client-JS-only, so crawlers never hit it. |
| Need feature-level locks instead of a page wall                        | **Already exist** on map metrics: `MetricItem.tsx:43-71` locks gated metrics and opens a dismissible `PaywallCard` modal (click-outside, `z-50`).                                                                            |
| Add "Get monthly score updates" capture on SEO pages                   | **Already shipped** — `components/newsletter/NewsletterSignup.tsx`, used on market pages.                                                                                                                                    |
| `next`/redirect post-signup is an unimplemented TODO (per backlog #14) | **False.** Signup reads `?redirect=` (`auth/sign-up/page.tsx:35`); OAuth callback reads `?next=` and honors it (`auth/callback/page.tsx:57,209`).                                                                            |
| Server-side redaction needed here                                      | **Item #19's job.** Map gated metrics are locked in the _selector_ and never fetched/rendered — no CSS-blur leak on /map. (`PaywallOverlay`'s `blur-sm` leak is real but unused on /map.)                                    |

The genuinely-broken core is therefore narrow: **the anonymous page-count wall is a hard front-door block**, and the anon locked-feature modal routes to `/pricing` instead of capturing an email.

### The decisive entitlements finding (the reason §5.0 exists)

`tier-resolver.service.ts:43-50` returns tier `'free'` when there is no `userId`. **Anonymous and free-tier users therefore have identical entitlements** (`scripts/migrations/100-add-resource-gating-features.sql`): both can see only home value, population, PIQ score, and median income; everything else on the map (cap rate, rental yield, rent index, DOM, inventory, price cuts, county/ZIP geos, reports, AI insights) is **Pro**. So a plain free account does **not** unlock the clicked metric — "create a free account to unlock cap rate" would be a lie.

A **reverse-trial system already exists** (`onboarding.service.ts:33` `ensureTrialStarted` → inserts a `user_trials` row from `trial_config`, idempotent via existing-check + `23505` race handling), granting new users temporary Pro. But it is **only invoked inside the tour** (`app/tour/page.tsx:136`), so users who don't finish the tour's market-selection step get no trial. Making the capture's promise honest requires granting that trial reliably **at signup**, decoupled from the tour (§5.0). This also de-risks item #14 (killing the tour), which would otherwise drop the only trial-grant call site.

## 2. Goals

- Anonymous users browse `/map` (and other product pages) freely, unlimited pages, with **no undismissable overlay**.
- Premium **features** remain gated; clicking one fires a **dismissible, email-first capture modal** (one field + Google), with the payment pitch deferred until after login.
- Capture hands off cleanly to the **existing (item #1) signup chain** — no duplicated OTP/signup logic — returning the user to the exact map state they wanted, where the clicked Pro feature is now unlocked by the **reverse Pro trial granted at signup** (§5.0).

## 3. Non-Goals (deferred, with reasons)

- **Server-side redaction of gated values** → item #19. Map gating is already leak-free.
- **SEO-page email-capture blocks** → already shipped (`NewsletterSignup`); verify only.
- **Crawler bypass logic** → unnecessary; wall is client-only and SEO routes are excluded. Removing the wall only improves crawlability.
- **Killing the /tour redirect / forwarding `next` out of tour** → item #14. This work carries the redirect param through; it does not rebuild tour.
- **Pricing-page CTA routing / pricing redesign** → items #1 and #18.

## 4. Decisions (resolved in brainstorming)

1. **Scope:** Full Reventure-style fix (retire the front door; gate the premium edge) — not a closeable-wall quick win.
2. **Trigger model:** **Reactive only** — capture fires solely when an anon user clicks a locked premium feature. No proactive prompts. Verified there is enough anon premium surface for this to fire: 6 Pro-gated metrics (cap rate, rental yield, rent index, days on market, inventory, price cuts), county/ZIP geo gating, and feature gates (reports, AI insights, watchlist, export).
3. **Handoff:** Capture modal hands off to the existing fixed signup (`/auth/sign-up?email=…&redirect=…`; Google via OAuth `next=…`). No OTP logic duplicated into a modal.
4. **Capture promise:** **Reverse-trial unlock.** The modal promises "Create a free account — your first 14 days of Pro are on us," and the reverse Pro trial is granted reliably at signup (§5.0) so the clicked Pro feature genuinely unlocks on return.

## 5. Architecture

### 5.0 Guarantee the reverse Pro trial at signup (makes the capture promise honest)

- **Goal:** every completed signup gets a `user_trials` Pro row, independent of the tour.
- There are **two** post-signup funnels; both must call the (idempotent) trial grant:
  - **Email OTP** → `app/auth/sign-up/complete-signup.ts` (`completeSignup`, the shared helper invoked from the autoconfirm and OTP-verified paths).
  - **OAuth + email-confirm-link** → `handlePostSignup()` in `app/auth/callback/page.tsx:249`.
- Call the existing `startOnboardingTrial()` fetcher (`lib/data/fetchers/onboarding.ts:98` → `POST /api/onboarding/start-trial` → `ensureTrialStarted`) from both, best-effort (never block/break signup on failure). The existing tour call site stays — `ensureTrialStarted` is idempotent, so duplicate calls are safe.
- **No new trial mechanism**; this only adds reliable invocation. Respects `trial_config.is_enabled` (if disabled, no trial is granted and the modal copy must degrade — see §8).

### 5.1 Retire the front-door wall

- `lib/entitlements/PaywallProvider.tsx`: remove the `showAnonBlock` computation (line 46) and its render (line 90). Stop consuming `isOverThreshold`.
- **Delete** `components/entitlements/AnonPaywallOverlay.tsx` (delete-stale-don't-port).
- Leave the free-tier 5-minute nag (`FreeUserUpgradeModal`) and `isOnProductPage` intact. `usePaywallPageTracking` may keep `isOnProductPage`; the anon view-counting/threshold path becomes dead and should be removed if nothing else consumes it.

### 5.2 New component: `AnonCaptureModal`

- **Location:** `components/entitlements/AnonCaptureModal.tsx`.
- **Props:** `featureName: string` (what they tried to unlock), `returnTo: string` (URL to come back to), `onDismiss: () => void`.
- **UI (M3, matches `FreeUserUpgradeModal`):** Extra-Large dialog, `rounded-[28px]`, `bg-surface-container-high`. Heading "Unlock {featureName} — free for 14 days." One email input + a Google button. Sub-copy: "Create a free account and your first 14 days of Pro are on us. No card required." Frames a trial, not a price (honest per §5.0).
- **Dismiss:** X button + backdrop click + **Escape** (see shared hook 5.5).
- **Submit:**
  - Email → navigate to `/auth/sign-up?email=<encoded>&redirect=<encoded returnTo>`.
  - Google → existing OAuth start with `next=<returnTo>` (same call MetricItem/signup uses today).
- **Tracking:** reuse `trackPaywallEvent` with a new source label (e.g. `anon-capture`) for view/dismiss/submit, consistent with existing modals.

### 5.3 Route anon premium-clicks to the capture modal

- `app/map/components/sidebar-components/MetricItem.tsx`: branch on auth. If **anonymous**, a locked-metric click opens `AnonCaptureModal` (with `featureName = metric.name`, `returnTo` from 5.4). If **free authed**, keep the existing `PaywallCard` (upgrade-to-Pro).
- `app/map/components/RightDetailPanel/QuickActions.tsx`: for anon, gated buttons (reports / AI insights / watchlist / export) open the same `AnonCaptureModal`.
- `components/entitlements/PaywallCard.tsx`: fix the anon CTA destination — when unauthenticated, "Sign Up Free" routes to `/auth/sign-up?redirect=<pathname>` instead of `/pricing?from=…`. Keeps every other anon paywall surface funneling into signup rather than pricing.

### 5.4 `returnTo` URL builder (shapeable detail — flagged for user input at build time)

- A small helper builds the return URL preserving map state so the unlocked feature is visible on return. Minimum: current pathname + the locked `metric` id. Open question to settle at build: also preserve geo level / selected region / zoom (`piq_market`-style param) vs. just the metric. Keep it a single focused function so the tradeoff is easy to adjust.

### 5.5 Signup prefill + shared dismiss hook

- `app/auth/sign-up/page.tsx`: read `searchParams.get("email")` and initialize the email state (currently absent). Preserve the existing `redirect` handling.
- New `useDismissable({ onDismiss })` hook (Escape keydown + backdrop helper) used by `AnonCaptureModal` and backfilled into `FreeUserUpgradeModal` (which today has X + backdrop but no Escape).

## 6. Data Flow (anon clicks a locked metric)

```
Anon on /map → clicks locked "Cap Rate" metric (MetricItem)
  → isAnon? yes → open AnonCaptureModal(featureName="Cap Rate", returnTo="/map?metric=cap_rate&…")
    → user submits email  → /auth/sign-up?email=…&redirect=/map?metric=cap_rate…
       → existing OTP signup (item #1) → account created in auth.users
       → completeSignup grants reverse Pro trial (§5.0) + redirect → eventually returnTo
       → user is now on a Pro trial; cap_rate is UNLOCKED on return; captured + logged in
    → OR user clicks Google → OAuth(next=returnTo) → callback handlePostSignup grants trial → honors next
    → OR user dismisses (X/Esc/backdrop) → modal closes, stays anon, keeps browsing
```

## 7. Testing (live, real DB — no mocks)

Playwright against live/dev with a real Supabase backend:

- Anon browses **10+ pages** across `/map` and `/scores` — assert **no** overlay element ever blocks the page (no `AnonPaywallOverlay`).
- Click a locked metric (cap rate) → `AnonCaptureModal` appears. Assert **Escape**, **X**, and **backdrop click** each close it.
- Submit email → lands on `/auth/sign-up` with the email field **prefilled** and a `redirect` param present.
- Complete the real OTP signup → an `auth.users` row exists; user returns toward the originating map state.
- Click Google path → OAuth URL carries `next`.
- Crawl check: `curl` (no JS) of a `/markets/[slug]` SEO page still returns full public content (regression guard on the removal).

## 8. Risks / Open Questions

- **Removing the wall = unlimited anon access to free product surface.** Intended (Reventure model); premium features remain gated. Reports/analyzer dead-ends are separate items (#8).
- **Email signup still routes through `/tour`** even with `redirect` (item #1/#14 behavior). This work carries the param; perfect return-to-origin depends on #14. Acceptable: the user is captured, logged in, and trial-granted regardless.
- **`returnTo` fidelity** (§5.4) — decide preserved state at build.
- **`QuickActions` anon branch** — confirm current anon behavior for those buttons (silent vs. paywall) before wiring, to avoid double-modals.
- **`trial_config.is_enabled = false`** would mean no trial is granted despite the modal's promise. The plan must check `trial_config` state and, if trials are disabled, fall back to neutral copy ("Create a free account to continue") rather than a false 14-day-Pro promise. Verify the live `trial_config` row before shipping the trial copy.
- **Trial economics** — auto-granting a Pro trial to every captured email widens trial volume vs. the tour-gated status quo. Intended per the §4.4 decision, but worth watching conversion/abuse after launch.
