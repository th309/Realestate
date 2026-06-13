# Email & Cron Fixes — Design

**Date:** 2026-06-13
**Status:** Approved (pending spec review)
**Author:** brainstorming session
**Branch:** develop

## Problem

Three problems were reported with the emails sent via Resend:

1. **Stale score copy.** The score-explainer email says the PropertyIQ Score is "built from **3** demand-signal metrics: % Sold Above List Price, Median Days on Market, and Months of Supply." The current score uses **4** inputs and a different data source. A second email (`active_explorer`) makes the same stale claim and additionally names "Redfin data," which the score no longer uses.
2. **Dev-site links.** Some emails link to `https://devpropertyiq.up.railway.app/...` instead of the live `https://www.propertyiq.app/...`.
3. **Duplicate emails.** Recipients receive two copies of the same email at the same time.

## Root Cause

Investigation via the Resend MCP (send logs) plus the codebase established:

- **All emails are sent from backend code**, not Resend-managed templates/broadcasts/automations (the Resend dashboard has zero templates/broadcasts/automations). Email bodies are built in `packages/emails` (React Email) and `packages/backend/src/email/behavioral-trigger-emails.ts` (hand-rolled HTML), then sent through Resend purely as a delivery transport. **This architecture is being kept** (no migration).
- **Issues #2 and #3 share one root cause:** the **dev** backend (`FRONTEND_URL=https://devpropertyiq.up.railway.app`) runs the **same scheduled email cron jobs** as prod, against the **same shared production Supabase database**. Each environment independently enumerates the same users and sends its own copy — prod with `www` links, dev with `devpropertyiq` links. Proof: the two copies of each duplicate differ only by link host (one `www`, one `devpropertyiq`), sent within the same second. The in-code dedup (Redis locks + `email_log`/`email_triggers`) does not prevent this: the Redis locks are per-environment (separate Redis instances) and the DB dedup loses a same-second race between the two environments.
- **This is not limited to email.** The same mechanism affects **every** `@Cron` in the backend: the dev Railway service **and local dev** (whose `.env` points at the prod `SUPABASE_URL`) run `trial-expiration` (mutating real trials), `snapshot-recorder`, `market-intelligence`, daily rollups, content-pipeline jobs, etc. against production. Email duplicates were simply the visible symptom. The fix therefore gates **all** crons, not just email crons.
- **Issue #1** is independent: the score-explainer copy is frozen at a retired methodology (the "v4 demand signal" 3-metric Redfin formula). The copy hardcodes methodology-specific statistics that have now gone stale across at least three score re-tunes (v3 → v4 → current).

## Decisions (from brainstorming)

| Decision                 | Choice                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture             | Keep emails code-driven. **No** migration to Resend-managed templates/broadcasts.                                                          |
| Stop dev cron collisions | **Gate all crons** behind a single global `RUN_CRONS` flag (gates `ScheduleModule.forRoot()`); set `true` on exactly one prod service.     |
| Score-copy stats         | **Describe the 4 inputs + link to the live `/scores/accuracy` page.** Do **not** hardcode volatile stats ($/hit-rate/years) in email copy. |
| Copy maintainability     | **Centralize all onboarding/marketing drip copy** into a single `email-copy.ts` so future edits are one-liners.                            |

## Current PropertyIQ Score formula (source of truth: CLAUDE.md §9)

Four inputs, re-centered to a percentile rank within state where **50 = state average**:

| #   | Input                                | Source  | Direction |
| --- | ------------------------------------ | ------- | --------- |
| 1   | Home-value momentum, 12-month (ZHVI) | Zillow  | ↑         |
| 2   | Home-value momentum, 3-month (ZHVI)  | Zillow  | ↑         |
| 3   | Median Days on Market                | Realtor | ↓         |
| 4   | Price-Reduced Share                  | Realtor | ↓         |

No Redfin. Stats (IC, hit rate, dollar impact) live on `/scores/accuracy` and are intentionally **not** duplicated into email copy.

---

## Design

### Item A — Global cron gate (fixes duplicates + dev links, and all dev↔prod cron collisions)

**Goal:** Exactly one designated production instance runs scheduled jobs. Every other environment — dev Railway, local dev, future preview envs, all of which currently point at the production Supabase DB — runs **no** cron jobs at all.

**Mechanism:** Gate the single global `ScheduleModule.forRoot()` registration in `packages/backend/src/app.module.ts` behind one env var:

```ts
// app.module.ts imports
imports: [
  // ...
  ...(process.env.RUN_CRONS === 'true' ? [ScheduleModule.forRoot()] : []),
  // ...
],
```

When `RUN_CRONS !== 'true'`, NestJS never loads the schedule explorer, so **no** `@Cron` is registered — email crons **and** data-job crons (`trial-expiration`, `snapshot-recorder`, `market-intelligence`, daily rollups, content-pipeline, alerts, etc.), including any cron added in the future. Providers still instantiate normally; only scheduling is suppressed.

**Why this is safe:** `ScheduleModule.forRoot()` is registered in exactly one place (`app.module.ts:77`); `SchedulingModule` and all feature modules rely on that global registration and do **not** import `ScheduleModule` themselves; nothing in the codebase injects `SchedulerRegistry` (no dynamic job scheduling that would break without the module).

**Why an explicit flag, not `NODE_ENV`:** the dev Railway service and local dev almost certainly run the production build (`NODE_ENV=production`) and point at the prod Supabase DB, so `NODE_ENV` cannot distinguish the single instance that should own the crons. `RUN_CRONS`, set on exactly one service, makes cron ownership a deliberate, visible decision.

**Rollout (single highest-risk step):**

- Set `RUN_CRONS=true` on **exactly one** prod service — the canonical backend (`backend-production-ee4d`) — **before/at** the deploy.
- Do **not** set it on the dev backend, local, or any other service. In particular, if `analytics-production` runs this same backend image it must **not** get `RUN_CRONS=true` (that would reintroduce prod-vs-prod double-runs).
- Add `RUN_CRONS` to `packages/backend/.env.example` with an explanatory comment.
- ⚠️ Until `RUN_CRONS=true` is set on prod, **all** prod background jobs are paused (emails, snapshots, rollups, trial expiration, content pipeline). This is the entire blast radius of the change, concentrated in one variable — set it as part of the deploy.

**Why gate the module, not each handler:** one gate at the single registration point covers all ~35 current crons and every future one, with no per-service edits to drift out of sync. Transactional emails (verification codes) are unaffected — they are action-triggered, not scheduled, and never run through `ScheduleModule`.

### Item B — Correct the stale score copy

Two locations carry the retired methodology:

1. `packages/emails/emails/onboarding-day1-scores.tsx` (lines ~34–43): "3 demand-signal metrics… 13 years… 100% year hit rate… $18,100".
2. `packages/backend/src/email/behavioral-trigger-emails.ts` (`buildActiveExplorerEmail`, line ~176): "sold-above-list rate, days on market, and months of supply — updated monthly from Redfin data".

**Replacement copy** (sourced from the centralized copy file in Item C; describes the 4 inputs, drops hardcoded stats, links to `/scores/accuracy`). Indicative wording:

> The PropertyIQ Score blends four demand signals: home-value momentum over the last 12 and 3 months (Zillow), how fast homes sell (median days on market), and the share of listings with price cuts (Realtor). Score 50 = state average; higher predicts outperformance. See the full track record and methodology: `{appUrl}/scores/accuracy`.

The `/scores/accuracy` link uses the template's existing base-URL prop (`loginUrl` / `appUrl`) so it always resolves to the sending environment's host (which, after Item A, is only ever prod).

### Item C — Centralize onboarding/marketing drip copy

**Goal:** one file where all lifecycle/marketing email wording lives, so edits are one-liners and the same string can't drift across templates (the drift that caused Issue #1).

**New file:** `packages/emails/copy/email-copy.ts` (exported from the `@propertyiq/emails` package).

- Shape: a typed, namespaced object — one key per email, values are the headline/body/CTA strings (and bullet arrays). A shared `scoreDescription` constant holds the single canonical score-explainer paragraph used by both `onboarding-day1` and `active_explorer`.
- React Email templates import their strings from this file instead of inlining JSX text.
- The backend HTML builders in `behavioral-trigger-emails.ts` import from the same file (backend already depends on `@propertyiq/emails`).

**In scope** (the "marketing/lifecycle drip"):

- React drip templates: `onboarding-day0-welcome`, `onboarding-day1-scores`, `onboarding-day3-compare`, `onboarding-day5-upgrade`, `onboarding-day7-profile`, `onboarding-day10-zillow`, `onboarding-day14-report`, `winback-day14`.
- Backend HTML builders: `buildWelcomeEmail`, `buildActiveExplorerEmail`, `buildReportGeneratedEmail`, `buildPaywallHitEmail`, `buildPostTrial7dEmail`, `buildInactive24hEmail`, `buildTrialDay10Email`, `buildTrialDay13Email`, `buildTrialExpiredEmail`.

**Out of scope** (not "marketing drip"): transactional (verification, password reset, OTP), digests (weekly/monthly), threshold-alert, NPS survey, contact-form, newsletter, beta-invite, lead-magnet. These keep their copy inline for now (the pattern can be extended later).

> Constraint: `@propertyiq/emails` builds to `dist/`; the backend consumes the built package. Adding `email-copy.ts` + new exports requires rebuilding the emails package in the same change so the backend resolves the new exports at runtime.

---

## Verification

- **Build:** TypeScript build of `packages/emails` and `packages/backend` passes; emails package rebuilt to `dist/`.
- **Render check (real, not mocked):** render `onboarding-day1-scores` and `active_explorer` and confirm: says four inputs, names Zillow + Realtor, contains **no** "Redfin"/"months of supply"/"% sold above list", includes a working `/scores/accuracy` link, and no hardcoded $/hit-rate/years stats.
- **Cron gate (boot test):** boot the app with `RUN_CRONS` unset → `ScheduleModule` is absent from the module graph and zero scheduled jobs are registered; boot with `RUN_CRONS=true` → jobs are registered. Assert the scheduled-job count both ways.
- **Cron gate (behavior, real):** with `RUN_CRONS` unset, no cron fires — no Resend sends at the next scheduled time and no data-job DB writes; with it set on prod only, exactly one instance runs them.
- **Post-deploy duplicate check:** after prod deploy + `RUN_CRONS=true` on prod, confirm via Resend send log that each recipient gets exactly **one** copy and all links use `www.propertyiq.app`. Confirm dev/local produce no cron sends at the next scheduled time.

## Risks & Mitigations

- **Prod var not set → ALL prod background jobs stop** (not just emails — snapshots, rollups, trial expiration, content pipeline). Mitigation: set `RUN_CRONS=true` on the prod backend as part of the deploy; this is the single highest-risk step, called out in rollout.
- **`RUN_CRONS` set on a second prod service → prod-vs-prod double-runs.** Mitigation: set on exactly one service; document which one (`backend-production-ee4d`).
- **Copy centralization breaks template rendering across ~17 files.** Mitigation: render each touched template; rely on TS types for the copy object; rebuild `dist/`.

## Out of Scope / Follow-ups

- Migrating any email to Resend-managed templates/broadcasts.
- **Multi-replica prod hardening:** if the prod backend runs more than one replica, the non-email data-job crons (which mostly lack Redis locks) could double-run across replicas. The `RUN_CRONS` gate fixes cross-environment collisions but not intra-prod multi-replica; recommend a follow-up (single dedicated cron worker, or add locks) if prod scales beyond one replica.
- **Separate dev database:** dev/local pointing at the prod Supabase DB is the underlying reason crons there are dangerous. `RUN_CRONS` neutralizes the cron vector; a true fix (isolated dev DB) is a larger, separate effort.
- Centralizing transactional/digest copy.
