# Activation Funnel Initiative — Scoping Doc

**Date:** 2026-04-14
**Type:** Multi-track initiative charter (not a design spec — it points at design specs)
**Status:** In scoping. Live 30-day data pulled 2026-04-14 — see "Live Data Snapshot" below. Priority reordered: **FIX SIGNUP COMPLETION FIRST** (hard evidence of a broken chain), then SEO-page conversion, then onboarding reachability, then MCP/homepage.

---

## Live Data Snapshot (pulled 2026-04-14 from `user_events` + `user_sessions` + `admin_user_snapshots`)

**Pipeline note:** The "new" `analytics_events` table has 0 rows. The real events table is `user_events` (3,533 rows total). The frontend tracker at `lib/analytics/tracker.ts` writes to `POST /api/analytics/events` → `analytics_events` — that path appears broken or deprecated. Events that ARE landing are coming from a different ingestion path (likely the backend `user-analytics/event-ingestion.service.ts` via a different frontend call). **This mismatch is itself an open investigation.**

### 30-day top-line

- 1,880 sessions / 1,853 visitors / 2,081 pageviews / 6 authenticated-session events
- 9 total `user_profiles` (includes test/dev accounts)

### Signup funnel — BROKEN

| Event                        | Count | Sessions | Visitors |
| ---------------------------- | ----- | -------- | -------- |
| `conversion.signup_start`    | 11    | 6        | **4**    |
| `conversion.signup_complete` | **0** | 0        | 0        |

**11 starts / 4 visitors = 2.75 retries per visitor, 0 completions.** Either signup form fails silently or the `signup_complete` event (fired in `app/auth/sign-up/page.tsx:118`) is swallowed by the post-signup redirect before `sendBeacon` flushes. NEEDS IMMEDIATE DEBUG.

### Landing page distribution — `/` is NOT the primary door

| Page                              | Pageviews     | Sessions      | % of traffic |
| --------------------------------- | ------------- | ------------- | ------------ |
| `/`                               | 128           | 108           | **~5.8%**    |
| `/map`                            | 38            | 26            | 1.4%         |
| `/reports`                        | 20            | 14            | 0.7%         |
| `/markets/zip/*` (many)           | combined 100+ | combined 100+ | significant  |
| `/markets/county/*` (many)        | combined 30+  | combined 30+  | significant  |
| `/blog/*-real-estate-market-2026` | 13+           | 13+           | significant  |

**Actual doorways are programmatic SEO pages.** Apr 10 homepage fix optimizes ~5.8% of traffic. The other 94% arrives on `/markets/zip/{zip}-{city}-{state}` or `/blog/*` pages and bounces with no CTA pull.

### Apr 9–10 traffic spike (unexplained — likely external share)

| Day            | Sessions | Home PV | Signups |
| -------------- | -------- | ------- | ------- |
| 2026-04-14     | 7        | 2       | 0       |
| 2026-04-13     | 53       | 8       | 0       |
| 2026-04-12     | 33       | 2       | 0       |
| 2026-04-11     | 16       | 3       | 0       |
| **2026-04-10** | **857**  | **8**   | 0       |
| **2026-04-09** | **658**  | **19**  | 0       |
| 2026-04-08     | 92       | 6       | 0       |
| 2026-04-07     | 35       | 16      | 1 start |

1,515 sessions in 48 hours, of which 27 saw `/`, zero converted. Likely HN/Reddit/X share to a specific blog post or market page.

### `/get-started` reachability — ZERO

|                          | Sessions (30d) |
| ------------------------ | -------------- |
| `/get-started` visits    | **0**          |
| Any `onboarding.*` event | **0**          |

The Apr 12 onboarding flow (`PersonaCards`, `OnboardingSearch`, spotlight tour, reverse trial, beacons) has never been reached. Either (a) signup_complete never fires so nobody gets redirected, (b) post-signup redirect points somewhere else, or (c) both.

### Paywall — silent in recent weeks

- `paywall_events` table: 650 rows historically, but **0 paywall events in user_events for last 21 days**
- `admin_user_snapshots.paywall_views`: 0 on most days, 4 on 2026-04-14 only

### Reverse trial — never started

- `user_trials` table: **0 rows**
- `admin_user_snapshots.active_trials`: 0 every snapshot
- `admin_user_snapshots.conversions`: 0
- `admin_user_snapshots.mrr_cents`: 0

### MCP usage — the 125 tokens are the Paperclip agent, not real users

- `mcp_oauth_tokens`: 125 rows
- Distinct users: **1**
- User ID: `1c5853f5-a1fb-4d0a-a67a-279cbc5b0952` — matches Paperclip CMO agent per memory `project_paperclip-agent.md`

**Real external MCP users: zero.** MCP is not a distribution channel today. Track D's urgency drops accordingly.

### Existing funnel definitions in `funnel_definitions`

1. **"Signup Funnel"** — pageview.view → conversion.signup_start → conversion.signup_complete (fails at step 3)
2. **"Conversion Funnel"** — signup_complete → trial_start → upgrade_complete (can't start; step 1 never fires)

### Tier distribution (from latest admin_user_snapshot)

- tier_free: 6
- tier_starter: 0
- tier_pro: 2
- tier_enterprise: 1

(9 users total; remember these include test/dev accounts)

---

---

## Problem (from user, 2026-04-14)

> "People don't intuitively know what to do with my site. I think it's pretty powerful, especially when tied with the Claude MCP. I'm seeing visitors, but no signups even for free accounts. They never explore and certainly never discover what is going on with the MCP. I've updated the onboarding flow, but it doesn't seem to work great — I have no tracking to see when it fires and what people complete or leave."

Three overlapping failures:

1. **Top of funnel:** Visitors land on `/` and don't convert to free signups.
2. **Onboarding:** Users who do sign up don't seem to activate, but there's no instrumentation to confirm where they drop.
3. **MCP invisibility:** The most differentiated surface of the product — a 35-tool MCP server — is not surfaced to users anywhere on the marketing site or in-product.

---

## Target Personas (user-selected, Q2 of 2026-04-14 brainstorm)

Two personas, different conversion playbooks:

| Agent                                                      | MCP Power-User                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| "Win more listings with data your seller can't argue with" | "Authoritative US real-estate data for your Claude workflows" |
| Lands on testimonials, sample PDFs, screenshots            | Lands on `curl` examples, tool list, setup walkthrough        |
| Buys because it makes them look smart                      | Buys because it unlocks their LLM workflow                    |
| Channel: LinkedIn, Facebook groups, RE newsletters         | Channel: HackerNews, X devs, MCP directory                    |

**Working hypothesis:** MCP power-user is the **wedge** (differentiated, self-evangelizing, low-CAC). Agents are the **scale** (bigger wallet, crowded market). The default `/` hero should pick ONE. A secondary door (`/for-agents` or `/for-claude`) serves the other.

**Unresolved:** Which persona owns the primary `/` hero. This decision is parked until Track A data arrives; the decision is also partly retroactive because Track B shipped without picking one.

---

## Prior Work Already Shipped (CRITICAL CONTEXT)

Three design specs shipped before this brainstorm. They cover what we were about to design — but were shipped **without instrumentation**, so their effect is unknown.

### 1. `docs/superpowers/specs/2026-04-10-homepage-conversion-fix-design.md`

Shipped ~April 10. Evidence:

- `packages/frontend/app/components/home/ScoreTeaser.tsx` — exists, wired into `app/page.tsx`
- `packages/frontend/app/components/home/StickyScoreBar.tsx` — exists, wired into `app/page.tsx`
- `packages/frontend/app/components/home/HeroSection.tsx` — CTA swap (to `/map` + `/reports/sample`)

### 2. `docs/superpowers/specs/2026-04-10-funnel-fix-blog-redesign-design.md`

Shipped ~April 10. Evidence:

- `packages/frontend/app/blog/[slug]/BlogMarketCTA.tsx` — exists
- Hero search score preview: in `HeroSearchBar.tsx` (needs verification it matches spec)
- Blog index redesign: needs verification

### 3. `docs/superpowers/specs/2026-04-12-free-user-onboarding-conversion-design.md`

Marked **Approved** in frontmatter. Shipped. Evidence:

- `packages/frontend/app/get-started/page.tsx` + `PersonaCards.tsx` + `OnboardingSearch.tsx` — exists
- `trial_started_at`, `trial_ends_at`, `free_report_credits` — referenced in:
  - `packages/backend/src/onboarding/onboarding.service.ts`
  - `packages/backend/src/email/engagement-trigger.service.ts`
  - `packages/backend/src/email/behavioral-trigger.service.ts`
- Recent commits fixing onboarding wiring (checklist, usage stats, beacon dismiss, spotlight click-through) confirm it's active

### Known Data (stale — pre-shipped-fixes baseline)

From the 2026-04-10 homepage spec:

- **94.8% bounce rate** on `/`
- **53-second average session** on `/`
- **0 signups from 988 organic visitors** (pre-fix)
- `/map` retains users for **~15 minutes**
- `/reports/sample` bounces at **~50%** (half the site average)

These numbers are a month old and represent the baseline _before_ the homepage + onboarding fixes shipped. Current numbers are unknown because there's no event instrumentation.

---

## The Four Tracks

## Pre-Existing Analytics Stack (discovered 2026-04-14, mid-brainstorm)

**This is not a "no tracking" situation.** PropertyIQ already has a homegrown product-analytics platform. Do not design new infrastructure — leverage what exists.

### Frontend event tracker

`packages/frontend/lib/analytics/tracker.ts` — `trackEvent(name, properties)` with:

- Category.action naming (e.g., `onboarding.quiz_step_complete`)
- Auto-attached visitor_id, session_id, user_id, user_tier, page_path
- Batched emit via `navigator.sendBeacon` (5s interval, 50-event batch, flush on visibilitychange + beforeunload)
- Opt-out via `setTrackingExcluded()` (for admin/dev testing)
- Helpers: `pageview-tracker.ts`, `scroll-depth-tracker.ts`
- Exempt from the `@/lib/data` data-layer rule (fire-and-forget)

### Backend ingestion + analysis

`packages/backend/src/analytics-events/analytics-events.controller.ts` — `POST /api/analytics/events` writes batches to `analytics_events` Supabase table. `packages/backend/src/user-analytics/` contains:

- `event-ingestion.service.ts` (+ tests)
- `identity-stitching.service.ts` — anon → authenticated (+ tests)
- `session-manager.service.ts`
- `page-classifier.service.ts`
- `funnel-engine.service.ts` — arbitrary funnel definitions + analysis
- `acquisition-analytics.service.ts` (+ tests) — UTM, referrer
- `conversion-analytics.service.ts` (+ tests) — conversion analysis
- `journey-analytics.service.ts` (+ tests) — journey mapping
- `overview-analytics.service.ts` (+ tests) — top-level KPIs
- `retention-analytics.service.ts` (+ tests) — cohort + curves
- `daily-rollup.service.ts` — aggregation

### Events already firing (36+ call sites, partial list)

- `pageview.view`, `engagement.scroll_depth`
- `conversion.signup_start`, `conversion.signup_complete`
- `conversion.pricing_page_view`, `conversion.pricing_tier_click`, `conversion.pricing_cta_click`
- `conversion.market_limit_hit`, `conversion.upgrade_prompt_shown/dismissed/clicked`
- `feature.search`, `feature.region_select`, `feature.score_view`, `feature.score_expand`, `feature.map_filter`, `feature.report_view`, `feature.report_export`, `feature.alert_create`, `feature.market_save`
- `paywall.view`, `paywall.upgrade_click`
- `onboarding.quiz_start`, `onboarding.quiz_step_complete`, `onboarding.quiz_skip`, `onboarding.quiz_complete` (old `/onboarding` flow — NOT the new `/get-started`)
- `ab_test.assigned`
- `frustration.error_shown`

### Admin dashboard — `/admin/analytics`

5-tab dashboard with date-range picker, filters (tier/device/source), drill-down chips, compare mode, CSV export, annotation creation, and an `AiInsightsPanel` that generates LLM recommendations scoped to the active tab:

| Tab         | Key widgets                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Overview    | GrowthProgressWidget, KpiCardRow + sparklines, QuickFunnel, DauChart (with annotations), TopPagesTable                                    |
| Journeys    | LandingPagesTable, ExitPagesTable, ProgressiveFlow, CommonPathsTable, SessionDurationDist                                                 |
| Retention   | EngagementHealth (DAU/WAU/MAU/stickiness), CohortMatrix, RetentionByCurve, ChurnRiskTable                                                 |
| Acquisition | TrafficSourcesChart, ChannelTrendChart, AttributionTable, LandingPerfTable                                                                |
| Conversion  | **FullFunnel** (drop-off per step), FeatureCorrelationChart, PaywallEffectiveness, TierMigrationFlow, RevenueMetrics (MRR/ARPU/tier dist) |

Backend controllers: see `packages/backend/src/user-analytics/user-analytics.controller.ts` and the admin-analytics module (paywall-analytics, ai-insights, growth-progress).

### Events that are NOT firing (the real Track A work)

Specific gaps found via grep; these are the instrumentation holes in otherwise-strong coverage:

1. **`/get-started` persona card clicks** — `PersonaCards.tsx` has no `trackEvent`. The old `/onboarding/useQuiz.ts` is well-instrumented; the new `/get-started` flow (shipped Apr 12) is not.
2. **Spotlight / guided-flow step progression** — no `onboarding.step_*` or `onboarding.spotlight_*` events for the 4-step guided tour from the Apr 12 spec.
3. **Beacon interactions** — no `beacon.shown`, `beacon.dismissed`, `beacon.clicked` events.
4. **Hero CTA clicks** — `HeroSection.tsx` doesn't fire `cta.click` or `hero.cta_click`. Can't distinguish between "Explore Map" vs. "Sample Report" pull.
5. **ScoreTeaser / StickyScoreBar clicks** — shipped Apr 10 with zero instrumentation.
6. **Reverse trial lifecycle** — no `trial.started`, `trial.pro_feature_used`, `trial.expired`, `trial.converted` events. `admin_user_snapshots.active_trials` exists at the aggregate level but per-user journey through the trial is not event-tracked.
7. **MCP connection + tool usage** — `mcp.propertyiq.app` is a separate service; currently invisible to the main analytics pipeline. Needs backend-side instrumentation in `packages/mcp-server`.

---

## Track A — Audit, Read the Dashboard, Gap-Fill (URGENT — brainstorm next)

**Why first (reframed):** Tracks B, C, D require data to iterate. The data mostly exists already — but (a) nobody has recently walked the dashboard with the shipped-fix dates annotated, and (b) 7 specific events aren't firing at moments we care about.

**Scope (to be designed in full spec):**

### A-1: Read what's already there

- Annotate `2026-04-10` (homepage fix ship date) and `2026-04-12` (onboarding v2 ship date) in the admin dashboard using the existing AnnotationPopover.
- Walk all 5 tabs with a 30-day window:
  - **Overview QuickFunnel** — is there signup drop-off data? Numbers?
  - **Conversion FullFunnel** — end-to-end view: landing → signup → quiz_start → quiz_complete → score_view → paywall.view → conversion.signup_complete → trial → upgrade. Where does it cliff?
  - **Journeys LandingPages** — what's `/`'s real bounce rate today (vs. the stale 94.8% from Apr 10)?
  - **Acquisition TrafficSources** — where are visitors actually coming from? (Answers "agent vs. MCP-dev" question empirically.)
  - **Retention CohortMatrix** — are post-Apr-10/12 cohorts retaining better than before?
- Read the `AiInsightsPanel` output on the Conversion tab. It has likely already generated relevant insights.
- Capture numbers worth tracking as baselines for Track B/C/D iterations.

### A-2: Gap-fill the 7 missing events

Add `trackEvent` calls at the specific missing moments (enumerated above). Naming convention stays `category.action`:

- `onboarding.persona_selected` (from PersonaCards)
- `onboarding.spotlight_step_viewed`, `onboarding.spotlight_step_completed`, `onboarding.spotlight_dismissed`
- `beacon.shown`, `beacon.clicked`, `beacon.dismissed` (with beacon_id property)
- `hero.cta_click` (with cta_id property — distinguishes map vs. sample report)
- `home.score_teaser_click` (with rank + geography), `home.sticky_bar_interaction` (with action: shown/clicked/dismissed/email_submit)
- `trial.started`, `trial.pro_feature_used`, `trial.expired`, `trial.converted` (server-side, fired from backend trial lifecycle)
- MCP-side: separate sub-project — instrument `packages/mcp-server` to emit connection + tool-call events back into the main analytics pipeline (or a parallel table if cross-service calls are heavy)

### A-3: Add a saved funnel definition

`funnel-engine.service.ts` exists; define the canonical activation funnel as a saved definition so it's queryable on demand:

```
/ → hero.cta_click → /get-started → onboarding.persona_selected
→ onboarding.spotlight_step_completed[step=score]
→ onboarding.spotlight_step_completed[step=report]
→ conversion.signup_complete → trial.started
→ trial.pro_feature_used → trial.converted
```

**Dependencies:** A-1 is a 1–2 hour user-driven walkthrough; A-2 is ~2 days of straightforward instrumentation; A-3 is ~0.5 day.

**Open questions for brainstorm:**

- For trial lifecycle events: fire from frontend (client-side trial expiration check) or backend (server-side cron + ingestion)? Recommend backend for correctness.
- MCP instrumentation approach: call `POST /api/analytics/events` from the MCP server with a synthetic visitor_id, or a separate mcp_events table? Needs design.
- Should gap-fill instrumentation be feature-flagged? (Recommend no — events are fire-and-forget safe.)
- Does `setTrackingExcluded()` need admin-user auto-exclusion wired? (Affects whether the user's own testing skews numbers.)

**Output:** `docs/superpowers/specs/2026-04-14-funnel-instrumentation-gap-fill-design.md`

---

### Track B — Homepage Verify & Iterate (parked — needs Track A data)

**Current state:** April 10 spec shipped. Effect unknown.

**What to verify once data lands:**

- Did hero CTA swap (`→ /map` + `→ /reports/sample`) lift click-through? What's the new bounce rate?
- Does `ScoreTeaser` create downstream engagement (does seeing top/bottom markets make users click through)?
- Does `StickyScoreBar` convert email signups? Dismissal rate?
- Reports sample conversion — does the 50% bounce hold? Is there CTA pull from the sample to signup?

**Open strategic questions that April 10 spec didn't resolve:**

- **Persona picking.** The shipped homepage tries to serve all six personas — the root framing problem from this brainstorm. Revisit after data.
- **Placeholder tokens:** `[ALPHA_PP]%`, `[METROS_VALIDATED]`, `[BACKTEST_YEARS]`, `[DOLLAR_GAP]` — verify whether these still render as tokens on the live site. If so, that's a trust-killing bug regardless of Track A data.
- **Sign-up CTA visibility.** The hero points to `/map` and `/reports/sample` (product tours), not to signup. By design — but tracking should tell us whether this trades away too many direct conversions.

**Dependencies:** Track A must run ≥1–2 weeks before iteration decisions are data-informed.

---

### Track C — Onboarding Verify & Iterate (parked — needs Track A data)

**Current state:** April 12 spec shipped. User report: "doesn't seem to work great." No data to confirm.

**What to verify once data lands:**

- `/get-started` persona card selection rate — are all 4 cards roughly used, or does one dominate?
- Market search → score view completion rate (Step 0 → Step 1).
- Score view → report generation rate (Step 1 → Step 2).
- Reverse trial: how many trial users use a Pro feature? Trial → Pro conversion rate?
- Checklist: which items get completed? Which are ignored?
- Beacons: dismissal rate vs. click-through rate per beacon.
- Behavioral email triggers: delivery, open, click rates per trigger.

**Open strategic questions:**

- The onboarding assumes the user knows what a "PropertyIQ Score" is. Does the pre-signup experience actually set that expectation? (Tied to Track B.)
- Does the 14-day reverse trial feel too long / too short? (Known unknown — industry norms vary.)
- Are the 4 persona cards the right 4? (Investor, Homebuyer, Agent, Researcher.) Today's brainstorm said MCP-power-user is a top persona — they're missing from `/get-started`.

**Dependencies:** Track A must run ≥1–2 weeks before iteration decisions are data-informed.

---

### Track D — MCP Visibility (genuinely new — not addressed by prior specs)

**Current state:** Neither April 10 nor April 12 specs surface the MCP. The 35-tool MCP server is invisible to users.

**Why it's a distinct track:** The MCP is the wedge persona's entire reason to care. Surfacing it is a different design problem from "landing page conversion" — it's a developer-experience + docs problem on top of marketing.

**Open questions for brainstorm (later):**

- Where does the MCP live in the site IA? `/for-claude`? `/mcp`? Navigation inclusion?
- Setup walkthrough: what's the first-5-minutes experience for a Claude Code or Claude Desktop user connecting to `mcp.propertyiq.app`?
- Tool catalog: is it a page, a Storybook-style explorer, or a read-the-docs-style reference?
- Auth story: MCP uses OAuth 2.1 + PKCE (per `2026-04-02-mcp-oauth-21-design.md` and `2026-04-04-mcp-oauth-only-design.md`) — is that UX good enough for cold-traffic developers, or do we need an MCP-specific free-tier API key path?
- Should the main `/` hero have an "Also available for Claude" treatment, or does MCP get its own top-level sibling landing page?

**Existing artifacts (for reference):**

- `packages/mcp-server/` — 35 tools across investor / agent / brokerage / PM / content categories
- `mcp.propertyiq.app` — deployed
- `docs/superpowers/specs/2026-04-02-mcp-oauth-21-design.md`
- `docs/superpowers/specs/2026-04-04-mcp-oauth-only-design.md`
- `docs/superpowers/specs/2026-03-30-tier-gated-api-mcp-embeds-design.md`

**Dependencies:** None strictly. Could brainstorm in parallel with Track A. Strategically cleaner to do it after Track A has validated that MCP interest is real (or designed in a way that Track A will measure MCP-related events).

---

## Sequencing

```
Track A (instrument)  ──────────────────►  [1–2 wk data collection]  ───► Track B iterate
                                                                    ╲
                                                                     ──►  Track C iterate

Track D (MCP visibility)  — can parallelize after Track A; spec independently
```

**Strict order:** Track A first. Everything else queues behind it.

---

## Outstanding Decisions (user input required)

| #   | Decision                                                                                                                                                                                                                                                                    | Why it matters                                                                                     | Owner                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1   | **Walk `/admin/analytics`** with `2026-04-10` and `2026-04-12` annotated. Report what the FullFunnel (Conversion tab), LandingPagesTable (Journeys tab, bounce on `/`), TrafficSourcesChart (Acquisition tab), and AiInsightsPanel recommendations actually show.           | Determines what's measurable today with zero new work; answers 80% of "is it working?" immediately | User                         |
| 2   | Primary `/` hero persona: MCP power-user OR Agent                                                                                                                                                                                                                           | Shapes Track B iteration and Track D placement                                                     | User                         |
| 3   | GA4 credentials file missing at `C:\Users\troyh\Downloads\propertyiq-488415-4d2207193602.json` — re-download or relocate. **Lower priority now** — the homegrown stack is the primary source of truth; GA4 is complementary for external channel/campaign attribution only. | Only blocks external-channel analysis, not core funnel analysis                                    | User                         |
| 4   | `/get-started` persona cards: add "Developer / Claude user" as 5th card?                                                                                                                                                                                                    | Ties MCP discovery into existing onboarding                                                        | User + Track D brainstorm    |
| 5   | For Track A-2 trial lifecycle events: fire from frontend or backend (cron on `trial_ends_at`)?                                                                                                                                                                              | Correctness vs. implementation simplicity                                                          | Track A brainstorm           |
| 6   | For Track A-2 MCP instrumentation: reuse `/api/analytics/events` endpoint or separate `mcp_events` table?                                                                                                                                                                   | Cross-service analytics architecture                                                               | Track A + Track D brainstorm |

---

## Success Metrics for the Initiative as a Whole

Tied to the existing 2026-04-12 onboarding spec targets:

| Metric                                                     | Baseline (pre-fix, Apr 10) | Target                              |
| ---------------------------------------------------------- | -------------------------- | ----------------------------------- |
| Visitor → signup conversion                                | 0% (0 / 988)               | ≥1% short-term, ≥3% after iteration |
| Homepage bounce rate                                       | 94.8%                      | <75%                                |
| Signup → first meaningful action (score view)              | unknown                    | >70%                                |
| Free-to-Pro trial conversion                               | ~0%                        | 2–3%                                |
| MCP activation (connections from cold MCP-persona traffic) | 0 tracked                  | Measurable baseline in Track D      |

---

## Links

- Original brainstorm this came from: this conversation, 2026-04-14
- Related shipped specs:
  - `docs/superpowers/specs/2026-04-10-homepage-conversion-fix-design.md`
  - `docs/superpowers/specs/2026-04-10-funnel-fix-blog-redesign-design.md`
  - `docs/superpowers/specs/2026-04-12-free-user-onboarding-conversion-design.md`
- MCP-related specs:
  - `docs/superpowers/specs/2026-04-02-mcp-oauth-21-design.md`
  - `docs/superpowers/specs/2026-04-04-mcp-oauth-only-design.md`
  - `docs/superpowers/specs/2026-03-30-tier-gated-api-mcp-embeds-design.md`
