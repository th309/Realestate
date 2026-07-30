# Per-User Behaviour Tracking on `/admin/entitlements/users`

**Date:** 2026-07-29
**Status:** Design — approved scope, pending spec review
**Primary goal:** See what each individual user actually does.

---

## 1. Problem

`/admin/entitlements/users` shows who a user _is_ (tier, trial, org, Stripe ids) and six
usage counters, but nothing about what they _did_. Its "Last active" column is
`user_profiles.last_login_at || updated_at || created_at`
(`packages/backend/src/admin/users/users-list.helper.ts:111-112`) — a login timestamp,
not a session-derived one. There is **no read of `user_sessions` or `user_events` anywhere
in the `/api/admin/users` path.**

Meanwhile a complete first-party session/event pipeline already exists and has been
collecting since 2026-04-02. The gap is not capture. It is that nothing surfaces the data
per user.

## 2. Verified current state

Measured live against project `pysflbhpnqwoczyuaaif` on 2026-07-29, not inferred from code.

| Fact                                           | Value                                                   |
| ---------------------------------------------- | ------------------------------------------------------- |
| `user_sessions` rows                           | 56,528                                                  |
| …carrying a `user_id`                          | **230**                                                 |
| `user_events` rows                             | 129,088                                                 |
| …carrying a `user_id`                          | **11,255**                                              |
| Distinct identified users                      | **28** (of 34 registered)                               |
| Authenticated session split                    | **154 internal** (2 users) / **76 external** (26 users) |
| Distinct event types for logged-in users       | **36**                                                  |
| `properties` populated on authenticated events | **100%**                                                |
| Window                                         | 2026-04-02 → 2026-07-30                                 |

### 2.1 The event payloads are narratable

`properties` carries enough detail to render plain-English behaviour, which is what makes
a timeline worth building at all:

| Event                         | Sample `properties`                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `feature.region_select`       | `{geo_level: metro, region_id: 39660, region_name: "Rapid City, SD"}`                                       |
| `feature.report_view`         | `{geography: "Arlington County, VA", report_type: universal, report_id: …}`                                 |
| `feature.search`              | `{query: "princ", result_name: "Prince William County, VA", result_type: county}`                           |
| `feature.analyzer_grade`      | `{strategy: buyAndHold, hasRent: true}`                                                                     |
| `feature.map_filter`          | `{geo_level: metro, metric_id: overvalued_pct}`                                                             |
| `frustration.error_shown`     | `{error_message: "Cannot read properties of undefined (reading 'replace')", page_path: "/admin/analytics"}` |
| `paywall.view`                | `{geoLevel: zip}` on `/screener`                                                                            |
| `conversion.market_limit_hit` | `{limit: 5, usage_count: 5}`                                                                                |
| `trial.pro_feature_used`      | `{resource: "feature:mcp_access", access_level: full}`                                                      |

Top authenticated events by volume: `trial.pro_feature_used` (5,826 / 13 users),
`pageview.view` (2,495 / 22), `feature.region_select` (789 / 10),
`frustration.error_shown` (552 / 2), `feature.mcp_connected` (411 / 2),
`feature.report_view` (280 / 6), `feature.analyzer_grade` (231 / 5),
`feature.score_view` (125 / 9), `feature.search` (79 / 10).

### 2.2 Identity-stitching bug — sessions orphaned from their user

252 sessions contain events carrying a `user_id`. Only **203** of the matching
`user_sessions` rows have `user_id` set. **43 (~17%) are orphaned**, plus 6 event
`session_id`s with no session row at all.

Root cause, confirmed by reading both write paths:

- **INSERT** — `session-manager.service.ts:79` writes `user_id: firstEvent?.user_id ?? null`.
  A session normally opens anonymous, because `pageview.view` fires before auth hydrates,
  so this is `null`.
- **UPDATE** — `buildSessionUpdatePlan` (`session-update-payload.ts:66-115`) never writes
  `user_id` into the payload at all. The `select` at `session-manager.service.ts:31-33`
  does not even fetch the column, so the decision could not be made.
- `identity-stitching.service.ts` backfills, but only fires on `conversion/signup_complete`
  — once, at signup. Every later session is on its own.

The correct pattern is already implemented one field over. `session-update-payload.ts:98-103`
promotes `is_internal` one-way, with the comment _"A session commonly starts anonymous and
acquires a user_id partway through, so the flag has to be promotable after insert."_
Line 90 already reads `events[0]?.user_id` as bot-evidence. `user_id` simply never received
the same treatment.

### 2.3 Assets available for reuse

- `analytics_visitor_timeline` / `analytics_visitor_list` RPCs and the
  `VisitorJourneyPanel` / `VisitorTimelineSession` component tree — keyed on `visitor_id`.
- `getSessionCountsForUsers()` (`common/user-sessions-count.util.ts:4`) — per-`user_id`
  lifetime session counts. Already exists, unused by this page.
- `visitor_identities` — `(visitor_id, user_id)` bridge with `first_seen_at` and
  `sessions_before_identification`, for pre-signup history.
- `ai-insights.controller.ts` + `useAiInsights` — LLM-over-analytics pattern.
- 28 `analytics_*` RPCs establishing the server-side-aggregation convention.

### 2.4 Two constraints inherited from the current code

- **Admin paths are untracked.** `pageview-tracker.ts:56` returns early on any path
  starting with `/admin`. Admin usage is invisible to the timeline.
- **A PII-suppression policy exists and this design reverses it.**
  `lib/data/fetchers/admin-analytics-visitors.types.ts` states visitor and user ids are
  opaque and must _"never [be presented] as a person's identity."_ That rule is right for
  `/admin/analytics`; it is wrong for the entitlements admin view, where identity is the
  point. Precedent exists: `analytics_churn_risk_users` already joins `auth.users` for
  email.

## 3. Goals / non-goals

**Goals**

1. For any single user, see their complete session and behaviour history, narrated.
2. Scan and sort the whole user base by real behaviour, not login timestamps.
3. AI narrative summarising what a user does and where they are blocked.
4. Session replay of an individual session.
5. Cross-user behaviour rollups derived from the same per-user data.

**Non-goals**

- Replacing `/admin/analytics`. That answers aggregate traffic questions; this answers
  per-person ones.
- Statistical inference. At 26 external users these are readable facts, and must be
  labelled as such with explicit denominators.
- Changing the ingest pipeline's shape. Only the `user_id` promotion bug is touched.

## 4. Architecture

Extend `packages/backend/src/user-analytics/` with a **user dimension alongside the existing
visitor dimension**. New `analytics_user_*` RPCs sit beside `analytics_visitor_*`; new routes
under `/api/admin/analytics/users/*`; frontend reads through `lib/data` per CLAUDE.md §5.

This inherits traffic-segment/bot/internal filtering and the server-side-aggregation
discipline established by the `/admin/analytics` rebuild (`1319e25c`) rather than
re-deriving them.

Everything keys on **`user_id`**, never `visitor_id`: one user has many `visitor_id`s
because `piq-visitor-id` lives in per-browser localStorage. `visitor_identities` is the
bridge when pre-signup history is wanted.

**Rejected alternatives**

- _Extend `/api/admin/users`._ Would duplicate every bot/internal filter and sits in a
  module with no analytics context.
- _Nightly materialised `user_activity_profiles`._ Premature at 34 users and introduces
  staleness. Revisit past ~1,000 users; the RPC boundary makes that swap local.

---

## 5. §1 — Data integrity (prerequisite)

Everything downstream under-reports by ~17% until this lands.

1. **Promote `user_id` on update.** In `buildSessionUpdatePlan`, mirror the `is_internal`
   rule exactly: one-way, written only when some event in the batch carries a `user_id`
   **and** the existing row is still null. Never overwrite a set value — a shared browser
   must not reassign a session.
2. Add `user_id` to the select at `session-manager.service.ts:31-33`.
3. **Backfill migration.** For every `user_sessions` row with `user_id is null`, adopt the
   `user_id` of any event in that session. Guard with a row-count log before/after.
4. **Start tracking admin pageviews.** Remove the `/admin` early return in
   `pageview-tracker.ts:56`. Internal traffic is already `is_internal`-flagged and
   filterable at read time, so the flag — not a capture hole — is the right mechanism.
   Without this, the timeline is blank for exactly the heaviest users.

**Tests:** unit tests on `buildSessionUpdatePlan` for (null → set), (set → unchanged on
anonymous batch), (set → unchanged on _different_ user_id). Backfill verified by
re-running the 246-session join and asserting 0 orphans.

## 6. §2 — Read layer: three RPCs

All aggregate server-side. No `.select()` without `.range()`, no population statistic
derived from a PostgREST array — the systemic bug catalogued in `tasks/todo.md` §0.8.

| RPC                               | Signature                                                         | Returns                                                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `analytics_user_activity_rollup`  | `(p_user_ids uuid[], p_days int)`                                 | Per user: `last_seen_at`, `session_count`, `event_count`, `unique_features`, `top_feature`, `frustration_count`, `paywall_count`, `device_mix jsonb`, `daily_counts int[]` |
| `analytics_user_timeline`         | `(p_user_id uuid, p_days int, p_limit int, p_before timestamptz)` | Sessions with nested event arrays, keyset-paginated on `started_at`                                                                                                        |
| `analytics_user_feature_adoption` | `(p_days int)`                                                    | Feature × tier matrix, engagement-segment counts, friction leaderboard                                                                                                     |

`analytics_user_activity_rollup` takes an array so the list page makes **one** call for all
rows, never N+1. All three accept the traffic-segment convention already used by
`analytics_in_segment`.

## 7. §3 — Backend API

New `user-activity.controller.ts`, `@UseGuards(AdminGuard)`,
`@Controller('api/admin/analytics/users')`:

| Route                           | Purpose                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST rollup`                   | Batch rollup for a set of user ids (POST because the id array can exceed a sane query string) |
| `GET :userId/timeline`          | Paginated session + event timeline                                                            |
| `GET :userId/narrative`         | Cached AI summary                                                                             |
| `GET :userId/replay/:sessionId` | Signed Storage URL for a replay bundle                                                        |
| `GET adoption`                  | Cross-user rollup                                                                             |

Full `class-validator` DTOs in `user-analytics/dto/user-activity-query.dto.ts`
(`UserRollupDto` with `@IsArray() @IsUUID('4', {each:true}) @ArrayMaxSize(500)`,
`UserTimelineQueryDto`, `UserIdParamDto`). Per CLAUDE.md §1.2 every input is validated;
the ingest path's hand-rolled validation is not the precedent to follow here.

Service split to respect the 300-line logic limit:
`user-activity-rollup.service.ts`, `user-activity-timeline.service.ts`,
`user-activity-narrative.service.ts`.

**Amend** the docblock in `admin-analytics-visitors.types.ts` to scope the
no-identity rule to the `/visitors` endpoints, so the codebase does not contradict itself.

## 8. §4 — The per-user page

Route: `app/(app)/admin/entitlements/users/[userId]/page.tsx`. A real route, not an
in-place expansion: deep-linkable, and the existing list file is already 3× its line limit.

```
◐ Sarah Chen · sarah@acme.com                    ⬤ last seen 2h ago
  pro · trial ends 4d · Acme Corp (admin) · joined Apr 12   [Manage ▸]
─────────────────────────────────────────────────────────────────────
┌─ WHAT THIS USER DOES ── AI ────────────┐ ┌─ VITALS ──────────────┐
│ Lives in the map. 41 of 58 events are  │ │ Sessions        12    │
│ region selects, nearly all metro-level │ │ Events         340    │
│ in the mid-Atlantic. Never opened a    │ │ Features   7 of 14    │
│ report despite 3 pricing visits. Hit   │ │ Avg session     8m    │
│ the ZIP paywall 4x, then left on       │ │ Frustration      2 ⚠  │
│ /pricing.                  [↻]         │ │ Engagement  ACTIVE    │
└────────────────────────────────────────┘ └───────────────────────┘
  ▁▃█▂▁▁▅█▇▃▁▁▁▂▅ 30d                        desktop 9 · mobile 3

┌─ FEATURE FOOTPRINT ────────────────────────────────────────────────┐
│ map        ████████████████████ 41   reports   ░ 0  never used     │
│ search     ████ 8                    screener  ░ 0  paywall-blocked│
└────────────────────────────────────────────────────────────────────┘

┌─ SESSIONS ──────────── [ all · with friction · converting ] ───────┐
│ ▾ Jul 28 2:14pm · 14m32s · Chrome/macOS · 9 events · ⚠  [▶ replay] │
│    2:14 → landed /  (google.com, organic)                          │
│    2:17 ⌕ searched "princ" ↳ Prince William County, VA             │
│    2:19 ▪ report · Arlington County, VA (universal)                │
│    2:26 ⚠ PAYWALL · /screener · zip                                │
│    2:27 ✗ error: Cannot read properties of undefined…              │
│    2:28 ← exit /pricing                                            │
│ ▸ Jul 24 9:02am · 3m11s · Safari/iOS · 3 events                    │
└────────────────────────────────────────────────────────────────────┘
```

Design follows M3 per CLAUDE.md §8: cards `rounded-xl shadow-sm`, semantic colour tokens
only, Roboto Mono for counts, filter chips `rounded-full`. Frustration uses `Error (Red)`,
paywall `Warning (Amber)`, conversions `Accent (Green)`.

**"Features 7 of 14" — the denominator is defined, not decorative.** 14 is the count of
features the user is **entitled to** for their tier, from `feature_definitions` joined to
`tier_features` — the same registry that gates access. The numerator is distinct
`feature.*` actions they have actually fired. So the tile reads "used 7 of the 14 things
they are paying for", which is directly actionable, rather than a ratio against an
arbitrary list. `FeatureFootprint` renders the unused remainder explicitly, distinguishing
**never used** from **paywall-blocked** (a `paywall.view` or `conversion.market_limit_hit`
exists for that surface) — the difference between an adoption problem and a packaging one.

### 8.1 The narration engine

`app/(app)/admin/entitlements/users/[userId]/event-narration.ts` — one pure registry
mapping `(event_category, event_action)` → `{ icon, severity, narrate(properties) }`,
in the spirit of `metrics.ts` as single source of truth.

Rules:

- Unknown events degrade to `category.action` plus raw properties. New events appear in the
  timeline without a code change; nothing is ever silently dropped.
- Narration is a pure function of the row, so it is unit-testable per event type against
  the real samples in §2.1.
- Brand voice per CLAUDE.md §8.6 — "the map", not `feature.region_select`.

### 8.2 Component split (CLAUDE.md §1.3)

`page.tsx` (server shell), `UserActivityHeader.tsx`, `UserVitalsCard.tsx`,
`UserNarrativeCard.tsx`, `FeatureFootprint.tsx`, `SessionTimeline.tsx`,
`SessionTimelineRow.tsx`, `EventLine.tsx`. Each under 300 lines.

Data access: `lib/data/fetchers/admin-user-activity.ts` +
`lib/data/hooks/useUserActivity.ts`, `useUserTimeline.ts`, exported from `lib/data/index.ts`.

## 9. §5 — List signals, and the refactor that comes with them

Add sortable columns fed by `analytics_user_activity_rollup`: **last seen (session-derived)**,
**sessions**, **features used**, **friction**, **activity sparkline**, **top feature**.
Retire the `last_login_at`-based `lastActive`.

`app/(app)/admin/entitlements/users/page.tsx` is **1,325 lines** against a 400-line hard
limit, is a single `"use client"` file, and fetches with raw `useState`/`useEffect` +
`fetchAPIRaw` instead of React Query. Adding columns to it as-is is not defensible, so the
split is part of this work, not a follow-up:

`page.tsx` (shell) · `UserList.tsx` · `UserCard.tsx` · `UserFilters.tsx` ·
`UserActivityColumns.tsx` · `UserEntitlementActions.tsx` · `hooks/useAdminUsers.ts` ·
`hooks/useUserActivityRollup.ts` · `types.ts`

Behaviour is preserved exactly; this is a mechanical extraction plus a React Query swap.
Characterisation tests on the existing rendered output go in **before** the split.

## 10. §6 — AI narrative

Reuses the existing `ai-insights` pattern. Routed through `AiConfigResolver`, DeepSeek as
project default. Input is the user's rollup plus a narrated event digest capped at the
**200 most recent events**, already run through `event-narration.ts` — never raw JSONB,
which wastes tokens and invites the model to quote identifiers. When the cap truncates, the
digest says so explicitly, so the model never describes a partial history as a complete one.

Cached in a `user_activity_narratives` table keyed on `(user_id, latest_event_at)`, so it
regenerates only when the user has actually done something new. This is the guardrail that
matters given the DeepSeek cost-spike precedent: no fan-out, one call per user per change,
plus the existing daily cap.

Prompt rules: no markdown, no em-dashes, no code identifiers, no invented causation. Below
**10 events** the endpoint does not call the model at all and returns
`"Not enough activity yet — N events across M sessions."` A narrative generated from three
pageviews reads as confident insight while being pure invention, which is the exact failure
this threshold exists to prevent.

## 11. §7 — Session replay (last, gated)

- `rrweb` recorder, **dynamically imported**, mounted in `AnalyticsProvider` behind
  `NEXT_PUBLIC_SESSION_REPLAY_ENABLED`. Never in the initial bundle.
- `maskAllInputs: true`, plus `blockClass` on billing, auth, and account surfaces.
- Chunks gzipped and `PUT` to Supabase Storage `session-replay/{session_id}/{seq}.json.gz`
  via a backend-issued signed upload URL. Never through Postgres.
- 30-day TTL purge alongside `analytics_purge_old_events`.
- `rrweb-player` lazy-loaded into the timeline row.

**Blocking prerequisite:** the privacy policy must disclose session recording before this is
enabled for anyone but internal users. Ship with the flag on for `is_internal` only.

**Honest limitation:** captures nothing retroactively. It adds zero value against the four
months of history already collected, which is why it is sequenced last.

## 12. §8 — Cross-user behaviour

A `Behavior` tab on the users page, from `analytics_user_feature_adoption`:

- Feature adoption × tier.
- Engagement segments (see §13).
- Friction leaderboard — which errors and paywalls hit the most **distinct users**.

Every panel renders its denominator inline ("7 of 26 external users"). At this sample size
these are facts to read, not statistics to infer from, and labelling them that way is what
prevents a repeat of the six-identical-sparklines failure.

## 13. Open decision — engagement classification

`engagement-classifier.ts` will be scaffolded with its signature, types, and tests in place,
for Troy to write the thresholds. Proposed starting point, to be overridden:

| Segment   | Proposed rule                                  |
| --------- | ---------------------------------------------- |
| `POWER`   | ≥3 sessions in 7d **and** ≥3 distinct features |
| `ACTIVE`  | any session in 14d                             |
| `AT RISK` | last seen 14–30d                               |
| `DORMANT` | last seen >30d                                 |

This drives the default sort order admins work from, so the thresholds are a business
judgment, not an implementation detail.

## 14. Sequencing

| Phase | Content                      | Gate                                          |
| ----- | ---------------------------- | --------------------------------------------- |
| 1     | §1 data integrity + backfill | 0 orphaned sessions                           |
| 2     | §2 RPCs                      | Counts reconcile against direct SQL           |
| 3     | §3 API + DTOs                | `npx tsc --noEmit` clean; 401 without admin   |
| 4     | §4 per-user page + narration | Real user's timeline renders from live data   |
| 5     | §5 list signals + split      | Every file within limits; behaviour unchanged |
| 6     | §6 AI narrative              | Cache hit on unchanged user                   |
| 7     | §8 behaviour tab             | Denominators present on every panel           |
| 8     | §7 replay                    | Privacy policy updated first                  |

Phases 1–5 are the substance. 6–8 are additive and independently shippable.

## 15. Verification

Per CLAUDE.md §2.3 and the project's verification rules, "done" requires:

- RPC output reconciled against direct SQL counts, not assumed.
- The page rendering a **real** user's live history, checked in the browser — HTTP 200 is
  not evidence of a rendered timeline.
- `npx tsc --noEmit` clean in `packages/backend` (plain tsc, not `nest build`).
- Narration unit-tested against the §2.1 samples.
- Line-limit compliance confirmed on every touched file.
