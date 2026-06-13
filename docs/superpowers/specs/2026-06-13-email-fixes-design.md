# Email Fixes — Design

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
- **Issue #1** is independent: the score-explainer copy is frozen at a retired methodology (the "v4 demand signal" 3-metric Redfin formula). The copy hardcodes methodology-specific statistics that have now gone stale across at least three score re-tunes (v3 → v4 → current).

## Decisions (from brainstorming)

| Decision             | Choice                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture         | Keep emails code-driven. **No** migration to Resend-managed templates/broadcasts.                                                          |
| Stop dev sending     | **Env-gate the email crons** behind a single `EMAIL_CRONS_ENABLED` flag; set `true` on prod only.                                          |
| Score-copy stats     | **Describe the 4 inputs + link to the live `/scores/accuracy` page.** Do **not** hardcode volatile stats ($/hit-rate/years) in email copy. |
| Copy maintainability | **Centralize all onboarding/marketing drip copy** into a single `email-copy.ts` so future edits are one-liners.                            |

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

### Item A — Env-gate email crons (fixes duplicates + dev links)

**Goal:** Only the production environment may run user-facing email cron jobs. Every other environment (dev, local, future preview envs) stays silent by default.

**Mechanism:**

1. New config flag `EMAIL_CRONS_ENABLED` (string `"true"` to enable; default off / unset = disabled).
2. New shared helper, e.g. `packages/backend/src/email/email-crons.util.ts`:
   ```ts
   export function areEmailCronsEnabled(config: ConfigService): boolean {
     return config.get<string>("EMAIL_CRONS_ENABLED") === "true";
   }
   ```
3. At the **top** of every user-facing email cron handler, before any DB work:
   ```ts
   if (!areEmailCronsEnabled(this.config)) {
     this.logger.log(
       "Email crons disabled (EMAIL_CRONS_ENABLED!=true); skipping <name>",
     );
     return;
   }
   ```

**Crons to gate** (every `@Cron` that enumerates users and calls `emailService.sendEmail`):

| Service                               | Method                  | Cron          |
| ------------------------------------- | ----------------------- | ------------- |
| `email/drip.service.ts`               | `processOnboardingDrip` | `0 9 * * *`   |
| `email/drip.service.ts`               | `processWinbackDrip`    | `0 9 * * *`   |
| `email/drip.service.ts`               | `processNpsDrip`        | `0 9 * * *`   |
| `email/behavioral-trigger.service.ts` | `processTriggersHourly` | `0 * * * *`   |
| `email/digest.service.ts`             | `sendWeeklyDigests`     | `0 8 * * MON` |
| `email/monthly-digest.service.ts`     | `sendMonthlyDigests`    | `0 12 1 * *`  |
| `alerts/threshold-alert.service.ts`   | (monthly alert email)   | `0 14 1 * *`  |

> Implementation note: `DigestService` does not currently inject `ConfigService` — add it. Also audit `alerts/alert-processor.service.ts` (`EVERY_DAY_AT_6AM`); gate it **only if** it sends user-facing email. The gate is applied to email-sending crons only — internal data-job crons (snapshots, rollups, content-pipeline, etc.) are out of scope.

**Rollout (critical ordering):**

- Set `EMAIL_CRONS_ENABLED=true` on the **prod** Railway backend service **before/at** the deploy. Until set, prod also pauses cron emails (acceptable: better than continuing duplicate/wrong sends; pausing is reversible).
- Leave it unset on dev/local.
- Add to `packages/backend/.env.example` with an explanatory comment.

**Why not gate at `EmailService.sendEmail`:** that path also serves transactional emails (verification codes) which dev legitimately sends for its own signups. Gating at the cron entry is the precise boundary and also skips the expensive enumeration in non-prod.

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
- **Cron gate unit test:** `areEmailCronsEnabled` returns false when unset/`"false"`, true when `"true"`.
- **Cron gate behavior (real DB):** with `EMAIL_CRONS_ENABLED` unset, invoking a drip cron method logs the skip and performs **zero** sends (no Resend call); with it set, it proceeds.
- **Post-deploy duplicate check:** after prod deploy + prod var set, confirm via Resend send log that each recipient gets exactly **one** copy and all links use `www.propertyiq.app`. Confirm dev produces no cron sends at the next scheduled time.

## Risks & Mitigations

- **Prod var not set → prod stops sending.** Mitigation: set `EMAIL_CRONS_ENABLED=true` on prod as part of the deploy; call it out explicitly in rollout.
- **A missed email cron keeps double-sending.** Mitigation: gate is derived from "every `@Cron` that calls `emailService.sendEmail` on enumerated users"; verify by grepping all `sendEmail` callers reachable from a `@Cron`.
- **Copy centralization breaks template rendering across ~17 files.** Mitigation: render each touched template; rely on TS types for the copy object; rebuild `dist/`.

## Out of Scope / Follow-ups

- Migrating any email to Resend-managed templates/broadcasts.
- The broader infrastructure risk that the **dev backend shares the production Supabase DB and runs all (non-email) data-job crons against it** (e.g. trial-expiration, snapshots, market-intelligence). This is a real concern surfaced during investigation but is not an email fix; recommend a separate follow-up.
- Centralizing transactional/digest copy.
