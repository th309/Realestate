# Trial Churn Reason Survey — Design

**Date:** 2026-07-19
**Status:** Approved by user, pending spec review

## Problem

New signups get a 14-day reverse Pro trial (`user_trials`, gated by `trial_config.is_enabled`). Today, everyone who goes quiet gets one of two things depending on how much they used the product:

- The full onboarding drip (day 0/1/3/5/7/10/14) regardless of activity.
- A single generic re-engagement email at day 14 (`winback_day14`, "Markets have moved since you last checked in") — but only for users who had 3+ sessions and then stopped.

Nobody who signs up and disappears is ever asked _why_. We want a "why did you leave" flow that adapts to how much the person actually did before going dark, captured as structured data (not just a reply-to-email), and surfaced somewhere actionable rather than just sitting in a table.

## Cohorts & Trigger Timing

Three cohorts on one spectrum, based on lifetime session count in `user_sessions`:

| Cohort             | Definition                                 | Fires                      | Email type                |
| ------------------ | ------------------------------------------ | -------------------------- | ------------------------- |
| Zero-session       | ≤1 session ever (just the signup moment)   | Day 4 since signup         | `churn_why_zero_session`  |
| Tried-once         | Exactly 2 sessions total, no session since | Day 7 since signup         | `churn_why_tried_once`    |
| Engaged-then-quiet | 3+ sessions, then 14 days silent           | Day 14 since last activity | `churn_why_engaged_quiet` |

The engaged-then-quiet check reuses the existing session-counting query from `drip-winback.helper.ts`. **This flow replaces the win-back email entirely** — `drip-winback.helper.ts` and its cron entry in `drip.service.ts` are removed; a new `drip-churn-why.helper.ts` runs all three cohort checks under one cron lock (`cron:churn-why-drip`), each cohort a small internal function.

Zero-session and tried-once are day-since-signup snapshots (same pattern as the existing onboarding drip's `getDayBoundariesUTC(day)` — checks users whose `created_at` falls in that day's 24h window), not rolling dormancy checks. Engaged-then-quiet keeps today's rolling-dormancy pattern (14 days since last activity, any calendar day). Implementation must first confirm whether `user_sessions` gets a row from the signup moment itself or only from a distinct first login/activity — that determines whether "≤1" or "0" is the correct zero-session threshold.

Suppression reuses existing helpers unchanged: `getAlreadySentUserIds(supabase, userIds, emailType)` and `getMarketingOptOutIds(supabase, userIds)`, keyed per cohort's email type.

## Email Content

One-click reason buttons as tracked links: `${appUrl}/why-did-you-leave?token=...&reason=<code>`. Draft reason sets (editable — product judgment call, not fixed):

**Zero-session:** Got busy (`busy`) / Wasn't sure what to do next (`unsure`) / Just curious, not actively looking (`curious`) / Couldn't find my market (`missing_market`) / Other (`other`)

**Tried-once:** Didn't find what I needed (`not_found`) / Confusing or unclear (`confusing`) / Too expensive (`too_expensive`) / Missing my market or property (`missing_market`) / Other (`other`)

**Engaged-then-quiet:** Found what I needed, done for now (`got_what_needed`) / Switched to another tool (`switched_tools`) / Not enough new information to keep checking (`not_enough_new`) / Got busy (`busy`) / Other (`other`)

### Landing page & no-auto-submit

The `/why-did-you-leave` page pre-highlights the reason from the URL (same pattern as the existing `/survey` NPS page's `preselectedScore`) but does **not** auto-submit on load. Email link-scanners and inbox prefetchers (Outlook Safe Links, Gmail image/link proxying) fire GET requests against email links before a human clicks — recording on GET would silently corrupt the data. The user sees the reason pre-selected, can change it or add an optional detail textbox, and must hit Submit.

## Data Model & Token

New table `churn_survey_responses`: `id`, `user_id` (references `user_profiles`), `cohort` (enum: `zero_session`/`tried_once`/`engaged_quiet`), `email_type`, `reason_code`, `detail` (nullable text), `created_at`. Unique on `(user_id, email_type)` — same upsert-on-conflict pattern as `user_surveys`.

Token: reuse `signNpsToken`/`verifyNpsToken` from `nps-token.util.ts` as-is (already generic — `{userId, surveyType, exp}` — `surveyType` becomes the cohort's `email_type`). No new token infrastructure needed.

New endpoint `POST /api/surveys/churn` (parallel to the existing `/api/surveys` NPS endpoint): verifies token, upserts into `churn_survey_responses`.

## Admin Visibility — `/admin/entitlements/trial`

This is the existing Trial Settings admin page (`TrialController`/`TrialService`, backed by real `user_trials` data — confirmed via direct query: `is_enabled=true`, 18 trials, 5 active/13 expired/0 converted/0 cancelled). The user reports it "isn't populating," but the DB has real data, so this is a frontend fetch/render bug, not a missing dataset — root cause to be diagnosed live (check network/console on the actual page) during implementation, not guessed at here.

Changes to this page:

1. **Fix the populating bug.** Diagnose against the real 18-row dataset; verify live in-browser, not just via API response shape.
2. **Widen the trial table to all statuses**, not just currently-active — most churn responders will already be past their trial's `expires_at` by the time they answer. Fix `TrialStatusBadge` to handle Expired/Converted/Cancelled explicitly (today it only buckets by `daysRemaining`, which would mislabel an already-expired trial).
3. **Add a "Why they left" column.** `TrialService.getAllTrials` left-joins each trial's `user_id` against `churn_survey_responses` (most recent row) and includes `reasonCode`/`reasonLabel`/`detail` on the `UserTrial` shape. The frontend renders a reason badge per row; `—` when no response yet; hover/expand shows the optional detail text (matches the approved preview: reason inline, detail as a wrapped sub-line).

## Testing

- Unit tests for each cohort's eligibility query (session-count boundaries: 0/1 vs 2 vs 3+) and for suppression (already-sent, opted-out).
- E2E against a real (non-production) DB: seed three users matching each cohort, run the drip, confirm the right email/reason-set fires for each, submit a response via the landing page, confirm it lands in `churn_survey_responses` and appears on the admin page — no mocks, per existing project testing standard.
- Manually verify the admin page in-browser after the fix, with the real 18-trial dataset, before calling the populating bug resolved.

## Out of scope

- Redesigning `/admin/entitlements/trial`'s config panel or the extend/cancel actions — untouched.
- A dedicated analytics dashboard for churn reasons — this data lives in the trial table for now; revisit if/when volume justifies more.
