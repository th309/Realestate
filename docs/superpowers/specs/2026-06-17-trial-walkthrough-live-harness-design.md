# Live 14-Day Trial Walkthrough Harness (+ trial-email targeting fix)

- **Date:** 2026-06-17
- **Status:** Approved design — ready for implementation plan
- **Branch:** develop
- **Owner:** th309

## 1. Problem & Motivation

We want a way to experience and **prove, live**, that the entire 14-day trial works end to
end: a real signup, the reverse Pro trial grant, the product tour, real feature-usage
tracking that **survives logout/login**, "what to try next" suggestions that update from
prior activity, the full email drip landing in a real inbox, and finally trial expiry with a
personalized post-trial state. Waiting 14 real days is not viable, so the trial clock must be
compressed by backdating the timestamps the email/expiry jobs query.

### 1.1 Confirmed bug discovered during design (this is why the walkthrough matters)

A reverse-trial user (the default for **every** signup) receives an almost-empty trial inbox:

- The onboarding drip (`packages/backend/src/email/drip.service.ts:185-198`) **explicitly
  skips** anyone with an active `user_trials` row — comment: _"they get behavioral emails
  instead."_
- The trial countdown emails — "4 days left" / "last chance" / "expired"
  (`packages/backend/src/email/behavioral-trigger.service.ts:120-125`) — only query
  `user_subscriptions WHERE status='trialing'`. That row is written **only by Stripe
  webhooks** (`billing-webhook.service.ts`, `billing-user-sync.service.ts`,
  `stripe.service.ts`). A plain reverse-trial signup never gets it.

Net effect: a normal trial user is skipped by the drip **and** invisible to the countdown
emails. During their 14 days they receive essentially only the welcome email (and possibly
`inactive_24h`). The whole countdown sequence reaches only people who entered a card for a
Stripe trial.

Therefore this work has two coupled parts: **(A) fix the email targeting** so reverse-trial
users actually receive the lifecycle emails, and **(B) build the live walkthrough harness**
that proves it. We implement red→green: assert the missing emails against current code
(red, documenting the bug), land the fix, re-run (green, emails arrive in the inbox).

## 2. Goals / Non-Goals

### Goals

- One-command, re-runnable hybrid harness: an automated driver that also pauses (headed) at
  each milestone with a printed assertion checklist so a human can eyeball the real UI/emails.
- Exercise the real signup → OTP confirmation → tour → per-day feature usage → logout/login
  persistence → suggestion updates → full email cadence → expiry → post-trial.
- Fix trial-email targeting to the canonical `user_trials`, with de-duped drip + countdown.
- Real emails delivered to a real inbox; delivery asserted (Resend status + inbox read).

### Non-Goals

- No change to the score engine, billing/Stripe trial flows, or entitlement tiers themselves.
- No new analytics surfaces; we assert against existing tables/endpoints.
- Not a load test; a single test user per run.
- Resend webhook/open/click tracking remains out of scope (still unimplemented).

## 3. Part A — Email-targeting fix

### 3a. Countdown emails read `user_trials`

In `behavioral-trigger.service.ts`, `sendToTrialingUsers()` switches its source from
`user_subscriptions (status='trialing')` to the canonical `user_trials`:
`converted_at IS NULL AND cancelled_at IS NULL AND expires_at` within the day window, joined
to `user_profiles` for `email`. Keep the per-user `email_triggers` dedup.

- `trial_day_10` → `expires_at` in **4 days** (`getFutureDayBoundaries(4)`)
- `trial_day_13` → `expires_at` **tomorrow** (`getFutureDayBoundaries(1)`)
- `trial_expired` → `expires_at` **yesterday** (`getPastDayBoundaries(1)`)

`behavioral-trigger.utils.ts` gains a `user_trials` extraction helper analogous to
`extractUsersFromSubscriptions`. Stripe-trial users also have a `user_trials` row from
signup, so they remain covered; implementation must confirm no double-send (single source =
`user_trials`).

### 3b. Drip: stop skipping trial users, suppress overlap

Remove the active-trial skip at `drip.service.ts:185-198` so reverse-trial users receive the
nurture emails. To avoid stacking two emails near trial-end, **suppress drip day-10 and
day-14 for users with an active trial** and let the countdown own days 10/13/15.

Resulting sequence for a reverse-trial user:

| Trial day       | Email                                                            | Source                                           |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| 0               | Welcome                                                          | engagement-trigger (already works)               |
| 0,1,3,5,7       | Onboarding drip (score → meaning → compare → movers → Pro value) | drip (skip removed)                              |
| ~10             | "4 days left"                                                    | countdown (now `user_trials`)                    |
| ~13             | "Last chance — ends tomorrow"                                    | countdown                                        |
| ~15             | "Trial has ended"                                                | countdown                                        |
| +7 after expiry | "Free report credit waiting"                                     | engagement-trigger (already reads `user_trials`) |

## 4. Part B — Harness components

### 4.1 `DevWalkthroughModule` (backend, new: `packages/backend/src/admin/dev-walkthrough/`)

Thin controller + service that **wrap existing services** (no business-logic duplication).
**Triple-gated:** `AdminGuard` + env `DEV_WALKTHROUGH_ENABLED=true` + hard refuse when
`NODE_ENV === 'production'`. The module is not imported into `AppModule` unless the flag is on.

Endpoints (prefix `/api/admin/dev/trial-walkthrough`):

- `POST /advance` `{ userId, toDay }` — backdate `user_profiles.created_at` and
  `user_trials.started_at`/`expires_at` so "today" == trial day `toDay`; clear that user's
  `email_log` + `email_triggers` rows for the jobs about to be re-run.
- `POST /fire` `{ job }` — invoke the real method on demand:
  `DripService.processOnboardingDrip()`, `BehavioralTriggerService.fireTrialDay10/13/Expired()`,
  `EngagementTriggerService.processAll()` (welcome). Fires only the requested job — never the
  full hourly/daily sweep — to bound blast radius.
- `DELETE /user/:id` — teardown via the existing admin delete path (FK-cascade migration
  `20260611205155`).

### 4.2 Playwright spec (`packages/frontend/tests/e2e/trial-walkthrough.spec.ts`)

The orchestrator + assertions; run **headed** with milestone pauses that print what was
asserted. Reuses tour selectors from the existing `tests/e2e/tour-repro.spec.ts` where
possible. Uses a Supabase service-role client for DB reads/teardown helpers and calls the dev
endpoints for time-travel + email firing.

### 4.3 Email verification (two layers)

- **Committed/self-contained:** assert Resend send/delivered status via the Resend API
  (`RESEND_API_KEY`) — `list-emails`/`get-email`.
- **Live session:** additionally confirm real arrival in the test Gmail inbox and read the
  6-digit OTP for signup (alias `troyhouston76+test4@gmail.com` delivers to the main inbox).

## 5. Data flow — day-by-day loop

**Day 0 — onboarding:**

```
Playwright fills signup form
  → backend emails a 6-digit OTP → read code from Gmail → Playwright types code into verify field → confirmed
  → walk the product tour to completion
  → assert: user_trials row (Pro, 14d), entitlements tier=pro daysRemaining≈14, welcome email arrives
  → try ONE feature (explore a metro/county/zip on the map)
  → assert tracked: user_events feature.*, usage_stats, /api/usage/coverage
  → logout
```

**Each email day D ∈ {1,3,5,7,10,13,15}** (one login/logout == one day):

```
POST /advance {toDay: D}      # backdate clock
POST /fire {job for day D}    # fire that day's email
  → assert email arrives in Gmail + Resend "delivered"
login (fresh session)
  → assert PERSISTENCE: usage_stats / checklist / coverage survived the new session
  → assert SUGGESTIONS UPDATED: NextBestAction recommends the next UNUSED feature,
    reflecting everything tried in prior sessions
try ONE new feature this session → assert it is now tracked
logout
```

**Day mapping (one feature per session):**

| Day | Feature tried                   | Email                           |
| --- | ------------------------------- | ------------------------------- |
| 0   | Explore map (metro/county/zip)  | Welcome                         |
| 1   | Market deep-dive (markets page) | Onboarding day1 (score meaning) |
| 3   | Graphs page                     | Onboarding day3 (compare)       |
| 5   | Screen markets                  | Onboarding day5 (movers)        |
| 7   | Analyze a deal                  | Onboarding day7 (Pro value)     |
| 10  | Create a deep-dive report       | Countdown "4 days left"         |
| 13  | Integrate PIQ with Claude (MCP) | Countdown "last chance"         |
| 15  | (login only) → trial expired    | Countdown "trial has ended"     |

At day 15: assert entitlements dropped to `tier=free`, and the PostTrial overlay
(`usePostTrialState` / PostTrialOverlay) personalizes to the features actually used. Then
teardown deletes the test user.

Sessions land on email days only; the clock jumps between them. (Can extend to all 14 days
later if desired.) Feature-to-day assignment is the default; adjustable per run.

## 6. Key existing references

- Trial grant: trigger `supabase/migrations/20260616213835_*`; idempotent fallback
  `OnboardingService.ensureTrialStarted()` + `lib/data/fetchers/onboarding.ts:99-121`.
- Tier/expiry: `tier-resolver.service.ts:87-125` (computes `daysRemaining`);
  `scheduling/trial-expiration.cron.ts`.
- Usage + suggestions: `usage_stats` JSONB on `user_profiles`; `/api/usage/coverage`
  (`usage-coverage.controller/service.ts`); `lib/feature-coverage/feature-coverage.ts`
  (`deriveCoverage`); `dashboard/components/NextBestActionCard.tsx`; beacons in
  `app/components/beacons/BeaconProvider.tsx`; `lib/entitlements/usePostTrialState.ts`.
- Email infra: `email.service.ts` (Resend), `drip.service.ts`, `behavioral-trigger.service.ts`,
  `engagement-trigger.service.ts`, templates in `packages/emails/`, dedup tables `email_log`
  - `email_triggers`.

## 7. Testing & validation strategy

- **Red→green:** run the day-10/13/15 email assertions against current code first (they fail
  = bug documented), land Part A, re-run (green, emails land in the inbox).
- Real data only, real browser, real inbox — no mocks. Verify actual page render and actual
  inbox arrival, per project rules.
- Existing email unit tests (drip/behavioral) updated to reflect the `user_trials` source and
  the drip suppression rule.

## 8. Risks & mitigations

- **Prod-Supabase blast radius:** the test user is real in prod; backdating `created_at`
  could nudge other date-keyed crons (winback/nps). Mitigate by firing only the specific job
  per step (never the full sweep) and tight teardown.
- **Dev endpoint safety:** triple-gate (AdminGuard + env flag + refuse in production); module
  unimported when the flag is off.
- **Local backend needs `RESEND_API_KEY`** set for the session or nothing sends.
- **Double-send check:** confirm Stripe-trial users (who also have a `user_trials` row) don't
  receive duplicate countdown emails after the source switch.
- **OTP timing/retries:** OTP email may lag; harness polls Gmail with a bounded retry and can
  trigger `signup_otp_resent` if needed.

## 9. Configuration

- `DEV_WALKTHROUGH_ENABLED=true` (local session only).
- `RESEND_API_KEY` present in the local backend session for real sends.
- Test account: `troyhouston76+test4@gmail.com` (delivers to the Gmail inbox the session can read).

## 10. Open questions / future

- Whether to extend sessions to all 14 days (currently email-days only).
- Optional: a small admin "features used vs not yet tried" matrix view (currently frontend-only).
