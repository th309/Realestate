# Monthly Market Newsletter Delivery — Design

**Date:** 2026-07-11
**Status:** Approved (design), pending implementation plan
**Author:** brainstormed with the team

## Problem

Newsletter signups are captured (`newsletter_signups` table), mirrored into a Resend
contact/segment, and sent a double opt-in confirmation email — but **no recurring
newsletter is ever sent to them**. The two existing digest crons (`DigestService`
weekly, `MonthlyDigestService` monthly) are deeply personalized: they build content
from a registered user's watchlist, alerts, and quiz preferences and are keyed on
`user_id`. Newsletter subscribers have no account, so those digests produce empty
content and never send to this audience.

As of 2026-07-11 there are 12 genuine subscribers, 5 of them confirmed (double
opt-in complete). All 5 came through the exit-intent capture and have received
nothing since signing up (some ~3 months ago). The confirmation flow even promises
"Weekly Market Insights," which is never delivered.

## Goal

Ship a fully automated **monthly market newsletter** sent to confirmed newsletter
subscribers, built from **national PIQ data** that is identical for every recipient
(no personalization, no account required). Reuse the existing email sender, logging,
and unsubscribe infrastructure; add only the recipient source, the national content
queries, and a generic template.

### Non-goals (YAGNI)

- No per-subscriber personalization (subscribers have no account/watchlist/quiz).
- No re-engagement campaign for the 7 unconfirmed signups (separate effort).
- No cadence preference center — a single monthly stream.
- No A/B subject-line testing.
- No immediate one-off first send — the first issue rides the next monthly cron run.

## Chosen approach

**Dedicated monthly newsletter cron + generic template** (Approach 1 of 3 considered).

Rejected alternatives:

- **Genericize the existing monthly-digest cron** — tangles generic and personalized
  logic in a deliberately focused service, and the `monthly-digest.tsx` template is
  built around personalized props (would be forked anyway). Worse separation for
  little savings.
- **Manual / Resend broadcast** — near-zero code but not automated, not driven by PIQ
  data, and not reproducible/version-controlled. This is the status quo we're escaping.

## Architecture

### New units (all small, single-purpose)

| File                                                       | Purpose                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/backend/src/email/newsletter.service.ts`         | `NewsletterService` — the `@Cron` entry point + per-run orchestration                    |
| `packages/backend/src/email/newsletter-data.service.ts`    | `NewsletterDataService` — national content queries (top movers, top markets, blog fetch) |
| `packages/backend/src/email/newsletter.types.ts`           | Shared types for the newsletter content payload                                          |
| `packages/emails/emails/market-newsletter.tsx`             | Generic, non-personalized email template (exported from `packages/emails/index.ts`)      |
| `supabase/migrations/<ts>_newsletter_delivery_columns.sql` | Adds `unsubscribed_at`, `last_newsletter_sent_at` to `newsletter_signups`                |

### Reused, not forked

- `EmailService.sendEmail()` — `userId` is optional, so account-less sends work; it
  logs to `email_log` and handles Resend + dev-mode.
- `RedisLockService` — single-fire lock across instances.
- `MonthlyDigestDataService.pickMarketToWatch()` and its score-lookup helpers
  (`lookupLatestPiqScores`, `lookupPreviousPiqScores`, `lookupRegionNames`) — already
  national/generic; injected into `NewsletterDataService`.
- The first-party `/backend/api/email/unsubscribe` proxy + `UnsubscribeController` +
  `List-Unsubscribe` header builder.

### Data flow (per monthly run)

```
@Cron('0 13 1 * *')
  → acquire Redis lock 'cron:market-newsletter'
  → NewsletterDataService builds the shared national content ONCE:
        marketToWatch  = pickMarketToWatch([])
        topMovers      = top 5 metros by |ΔPIQ| MoM (risers + fallers)
        topMarkets     = top N metros by latest PIQ score
        blogPosts      = GET {FRONTEND_URL}/api/blog/metadata → newest 3
  → select recipients:
        newsletter_signups WHERE confirmed = true
                           AND unsubscribed_at IS NULL
                           AND (last_newsletter_sent_at IS NULL
                                OR last_newsletter_sent_at < month_start)
  → for each recipient:
        unsubscribeUrl = signed newsletter-stream token (keyed on row id)
        EmailService.sendEmail({ to, react: <MarketNewsletter/>, emailType: 'market_newsletter' })
        on success: set last_newsletter_sent_at = now()
  → release lock
```

The national content is identical for all recipients, so it is computed once per run;
only `unsubscribeUrl` varies per recipient.

## Recipient selection & idempotency

Add two nullable columns to `newsletter_signups` (migration):

- `unsubscribed_at TIMESTAMPTZ` — set when a subscriber opts out.
- `last_newsletter_sent_at TIMESTAMPTZ` — set after each successful send.

Recipients are `confirmed = true AND unsubscribed_at IS NULL`. Idempotency: skip any
row with `last_newsletter_sent_at >= current-month start`, and stamp it to `now()`
after a successful send. This makes the run safe against cron retries and blue-green
double-fire **without** relying on an email column in `email_log` (which does not
exist — `logEmail` stores only `user_id`, `email_type`, `subject`, `metadata`).

## Content blocks (national, built once per run)

1. **Market to Watch** — the single metro with the biggest PIQ score jump this month,
   with a one-line reason. Reuses `MonthlyDigestDataService.pickMarketToWatch([])`.
2. **Top Movers** — the 5 metros with the largest absolute month-over-month PIQ score
   change, **including both risers and fallers** (direction indicated). Same two-date
   score-diff pattern as `pickMarketToWatch`.
3. **Top Markets** — the current top 5–10 metros by latest PIQ score (a leaderboard).
4. **Latest from the blog** — the newest 3 posts fetched from the existing
   `GET {FRONTEND_URL}/api/blog/metadata` endpoint. (The implementation plan will
   confirm the endpoint returns posts newest-first with title/url/excerpt/date; the
   `blog/rss.xml` route is a fallback source.)

New generic queries (`getTopMovers`, `getTopMarkets`) live in `NewsletterDataService`;
the market-to-watch and score-lookup helpers are reused from `MonthlyDigestDataService`
by injection to avoid duplication.

## Email template

`packages/emails/emails/market-newsletter.tsx`

- Props: `{ marketToWatch, topMovers, topMarkets, blogPosts, unsubscribeUrl }`.
- Follows the existing M3 / Roboto email design system and reuses the shared
  header/footer used by the other templates.
- No personalization (no recipient name).
- Footer includes a physical mailing address and the one-click unsubscribe link
  (CAN-SPAM compliance).

## Unsubscribe & compliance

Extend the **existing signed-token unsubscribe** rather than build a parallel system:

- Add a `newsletter` value to `UnsubscribeStream` and allow `signUnsubscribeToken` /
  `buildUnsubscribe` to key on the `newsletter_signups.id` for that stream.
- `UnsubscribeController` handles the `newsletter` stream by setting
  `newsletter_signups.unsubscribed_at = now()` (instead of touching `email_preferences`).
- This preserves a single first-party unsubscribe path with the proper
  `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers
  (RFC 8058) required for Gmail/Yahoo bulk-sender compliance.

Rejected alternative: a separate `/api/newsletter/unsubscribe?token=<uuid>` frontend
route mirroring the confirm flow — simpler in isolation, but duplicates the header
logic and creates a second unsubscribe system.

## Scheduling

- `@Cron('0 13 1 * *')` — 1st of the month, 13:00 UTC, one hour after the noon
  monthly-digest to avoid load/lock overlap.
- Registered behind `RUN_CRONS === 'true'` in `cron-schedule.imports.ts`, like the
  other digest crons.
- Guarded by a Redis lock (`cron:market-newsletter`) for single-fire across instances.

## Copy alignment

Fix the cadence-mismatch copy so the promise matches reality:

- `packages/frontend/app/api/newsletter/confirm/route.ts:74` — "Weekly Market
  Insights" → "Monthly Market Insights."
- `packages/emails/emails/newsletter-confirmation.tsx` and any signup UI that promises
  "weekly" — align to "monthly."

## Testing (real DB, no mocks — per project standards)

**Unit**

- Recipient filter (confirmed AND not unsubscribed AND not already-sent-this-month).
- Month idempotency guard (a row sent this month is skipped).
- Each content query returns the expected shape (top movers ordering incl. fallers,
  top markets ordering, blog fetch mapping).
- Unsubscribe token round-trip (sign → verify → correct row id + stream).

**E2E vs real Supabase (dev mode)**

- Run the send function against the live DB; assert it selects exactly the current
  confirmed, non-unsubscribed subscribers and builds all four blocks from real PIQ
  data. In dev mode `EmailService` logs "would send" instead of dispatching.
- Round-trip a real unsubscribe token through `UnsubscribeController`; assert the
  row's `unsubscribed_at` is set and the row drops from the next run's recipients.
- Confirm the blog fetch returns real posts from the running frontend.

**Manual**

- One real send to a seeded confirmed test inbox; eyeball rendering in Gmail (desktop
  and mobile); click the one-click unsubscribe and confirm opt-out.

## Rollout

1. Migration adds the two columns (backward compatible; existing rows get NULLs).
2. Deploy backend with the cron gated behind `RUN_CRONS`; it fires on the next 1st.
3. First issue goes to the 5 confirmed subscribers on that run; no manual one-off send.
