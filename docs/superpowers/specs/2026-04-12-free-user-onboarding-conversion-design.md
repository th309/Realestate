# Free-User Onboarding & Conversion System

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Guided onboarding flow, reverse trial, dashboard engagement, conversion architecture

## Problem

Free-tier users can access `/map` and `/market` but have no clear path to the "aha moment" — seeing a PropertyIQ Score and AI report for a market they care about. The existing onboarding (4-screen Welcome Wizard + 9-step passive tour) shows features but never guides users to _do_ anything valuable. The result is poor feature visibility, zero free-to-Pro conversion, and high early churn.

## Goal

Get free users to experience core value in under 2 minutes, then convert them to Pro via a 14-day reverse trial backed by personalized paywall psychology. Target: 2-3% free-to-Pro conversion (from current 0%).

## Design Decisions (from brainstorming)

| Decision                            | Choice                                                                               | Rationale                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Relationship to existing onboarding | Replace tour, keep quiz                                                              | Quiz captures valuable preference data; wizard+tour are the weak link          |
| When does quiz happen               | Woven in (single persona question up front, full quiz deferred to post-first-report) | One question personalizes tone without adding friction before aha moment       |
| Sample report content               | Hybrid (user's market if available, Rochester NY fallback)                           | Personalized when possible, sensible default when not                          |
| Free report depth                   | Full report with embedded upgrade CTAs                                               | Maximum value delivered; CTAs educate on Pro benefits naturally                |
| Flow delivery architecture          | Hybrid (/get-started + spotlight on real pages)                                      | Controlled entry funnel + real-product credibility                             |
| Reverse trial + free report         | Both (14-day trial, then 1 free report credit post-downgrade)                        | Trial is primary conversion mechanism; free report is re-engagement safety net |

---

## Section 1: The Guided Flow

### Architecture

Hybrid approach: self-contained `/get-started` route for the entry point, then spotlight overlay on real app pages for the interactive steps.

### Flow Steps

**Step 0 — Persona + Search** (`/get-started`)

- Full-screen page, no navigation chrome
- Single question: "What brings you here?" — 4 options as tappable cards:
  - First-time Homebuyer
  - Real Estate Investor
  - Agent / Broker
  - Market Researcher
- Answer stored in `user_profiles.user_type` (reuses existing column)
- After selection, search bar auto-focuses with personalized placeholder:
  - Investor: "Search for your first investment market..."
  - Homebuyer: "Search for a city you'd like to live in..."
  - Agent: "Search for your farm area..."
  - Researcher: "Search for any market to analyze..."
- User types and selects a market from autocomplete
- Selection triggers auto-navigation to `/market/{geoLevel}/{geoId}`

**Step 1 — See the Score** (`/market` with spotlight overlay)

- Breathing spotlight highlights the PropertyIQ Score card
- Score animates in: ring fill + number count-up (M3 duration-400 standard easing)
- Connected tooltip with pointer arrow: "This is {marketName}'s market strength — {scoreLabel}"
- Tooltip copy adapts to persona (investor sees "investment signal", homebuyer sees "market opportunity")
- **Action-gated:** User clicks the score card to advance (no "Next" button)
- "Do this later" appears after 10 seconds of inactivity (replaces "Skip")

**Step 2 — Generate Report** (`/reports/builder` with spotlight overlay)

- Auto-navigate to report builder with market pre-filled from Step 0
- Spotlight on "Generate Report" button
- Connected tooltip: "Get your free AI market report for {marketName}"
- **Action-gated:** User clicks Generate to advance
- On generation: confetti burst celebration + "Nice!" toast notification
- Report begins generating in background

**Step 3 — Upgrade CTA** (modal overlay on report page)

- Appears after report generation starts
- Content: "Your report is generating. You have 14 days of full Pro access."
- Shows 3-4 Pro features with icons: unlimited reports, ZIP-level data, market alerts, AI chat
- Two CTAs: "Explore Pro Features" (primary, routes to dashboard) / "Maybe Later" (dismisses, stays on reports)
- No hard sell — frames Pro as something they already have, not something to buy

### UI Refinements

**Breathing Spotlight:**

- Replace `box-shadow: 0 0 0 9999px rgba(0,0,0,0.6)` with `backdrop-filter: blur(4px)` + gradient mask
- Soft indigo glow that pulses gently (CSS animation, 2s cycle, ease-in-out)
- Spotlight shape matches target element's border-radius
- Smooth morphing between targets using FLIP animation pattern (duration-400)

**Connected Tooltip:**

- Pointer arrow (8px CSS triangle) anchored to target element edge
- Spring entrance animation: scale(0.95) + opacity(0) → scale(1) + opacity(1), cubic-bezier(0.34, 1.56, 0.64, 1)
- Max-width: 360px. Roboto 400 body, 500 title. M3 surface-container-high background
- Action-oriented copy throughout ("Try it", "Click here", not "This feature allows...")

**Progress Indicator:**

- Thin (3px) animated progress bar at top of viewport (replaces 9 dot indicators)
- Fills proportionally across 4 steps (25% per step)
- Indigo-to-green gradient fill
- Persists across page navigations during flow

**Transitions:**

- Between steps: spotlight morphs smoothly to new target position (FLIP, duration-400)
- Tooltip: cross-fade with 200ms overlap
- Page transitions: shared-element motion where possible (Next.js View Transitions API)
- All motion uses M3 standard easing curve

### What Gets Removed

- `WelcomeWizard.tsx` — replaced by `/get-started` page
- `TourOverlay.tsx` — replaced by new `BreathingSpotlight` component
- `TourTooltip.tsx` — replaced by new `ConnectedTooltip` component
- `tour-steps.ts` — 9 passive steps replaced by 4 action-gated steps
- The `TourProvider.tsx` orchestration is refactored but the provider pattern is preserved

### What Gets Kept

- `useTourState.ts` — state management hook (reads/writes `onboarding_completed_at`)
- `MarketPicker.tsx` — reused in the deferred quiz
- `WizardPreferences` type — still used for storing user preferences
- All `data-tour` attributes on target elements (repurposed for new selectors)

---

## Section 2: Reverse Trial

### Trial Lifecycle

**Signup (Day 0):**

- All new users automatically receive 14 days of full Pro access
- No opt-in prompt, no credit card required
- New column: `user_profiles.trial_started_at` (timestamp, set on first login)
- New column: `user_profiles.trial_ends_at` (timestamp, trial_started_at + 14 days)
- Entitlements system checks `trial_ends_at` to determine active trial status
- Subtle "Pro Trial — 14 days left" badge in navigation bar (not intrusive)

**During Trial (Days 1-14):**

- Full Pro feature access: unlimited markets, full reports, AI chat, ZIP-level data, market alerts
- Badge updates daily: "Pro Trial — X days left"
- Usage tracking: markets viewed, scores checked, reports generated, features used (for personalized paywall later)

**Notifications:**

- Day 10: In-app banner + email — "You've analyzed X markets and generated Y reports this week. Pro access ends in 4 days."
- Day 13: In-app modal + email — "Last day tomorrow. Here's everything you've used:" + personalized value counter
- Day 14 (expiration): In-app modal — "Your Pro trial has ended. Here's what you built:" + usage summary + upgrade CTA with personalized paywall

**Post-Trial Downgrade:**

- Entitlements revert to free tier limits
- Features user actually used during trial appear greyed-out with "Unlock" badges (not features they never touched)
- 1 free report credit remains (stored in `user_profiles.free_report_credits`, default 1)
- Dashboard shows the sample report card prominently

### Entitlements Changes

Current free tier entitlements are modified:

- `feature_reports`: remains `true` but limited to `free_report_credits` count (default 1, decremented on use)
- Trial status: new check in entitlements — if `trial_ends_at > now()`, grant Pro-level access regardless of subscription
- After trial + after free report used: standard free tier limits apply

---

## Section 3: Dashboard & Ongoing Engagement

### Sample Report Card

**Placement:** First card on dashboard for post-trial free users (above any existing content). During the 14-day reverse trial, this card is hidden (users have full Pro access). It surfaces after trial expiration or for users who somehow bypassed the trial.

**Content Logic:**

1. If user completed guided flow → show teaser for the market they searched (stored in `user_profiles.onboarding_market`)
2. If no onboarding market → show Rochester, NY (Score 99) as high-impact fallback

**Report Content:**

- Full AI narrative visible (not blurred)
- Key metrics section visible
- Score + confidence visible
- Embedded upgrade CTAs within the report body:
  - After key metrics: "Pro users get monthly trend updates for this market"
  - After AI narrative: "Unlock ZIP-level analysis for {marketName}"
  - After score breakdown: "Compare {marketName} against any market with Pro"
- These CTAs are styled as subtle inline cards (M3 outlined card, primary border), not banners

### Persistent Progress Checklist

**Widget:** Collapsible card on dashboard sidebar (or bottom-right floating on mobile).

**Tasks (5 items):**

1. Create account — auto-completed on signup (starts at 20%)
2. Search your first market — completed when onboarding Step 0 finishes
3. View a PropertyIQ Score — completed when onboarding Step 1 finishes
4. Compare two markets — completed when user visits `/market` for a second unique market
5. Generate a market report — completed when onboarding Step 2 finishes or any report is generated

**Progress bar:** Thin green bar, fills 20% per task. Starts at 20% ("Account created!").

**Micro-celebrations:** Checkmark bloom animation (scale bounce + color fill) on task completion. Progress bar animates smoothly.

**Lifecycle:** Appears immediately after signup. Disappears (with a "Congrats! You're all set" animation) when all 5 tasks complete. Can be manually dismissed via X button.

**State:** Tracked per-user in `user_profiles.onboarding_checklist` (JSONB — array of completed task IDs).

### Contextual Beacons

**Trigger Logic:** Beacons appear based on user behavior, not on a schedule:

| After User Does...  | Beacon Appears On...     | Tooltip Text                                   |
| ------------------- | ------------------------ | ---------------------------------------------- |
| Views a score       | "Compare Markets" button | "See how this market stacks up against others" |
| Views the map       | Time-series chart toggle | "Track how this metric has changed over time"  |
| Views a report      | Share / Export button    | "Share this report with your team or clients"  |
| Completes checklist | Market Alerts setup      | "Get notified when this market moves"          |

**UI:** 12px pulsing indigo dot (CSS animation: scale 1→1.3→1, opacity 0.6→1→0.6, 2s cycle). On hover: tooltip appears with description. On click: beacon dismisses permanently, navigates to feature.

**State:** Tracked in `user_profiles.dismissed_beacons` (JSONB array of beacon IDs).

### In-Product Social Proof

**Data Source:** Aggregated anonymous analytics counts, updated daily via a scheduled backend job.

**Placement:**

| Location           | Format                        | Example                                           |
| ------------------ | ----------------------------- | ------------------------------------------------- |
| Market page header | Subtle text below market name | "1,247 investors tracking this market"            |
| Score card         | Small text below score        | "Viewed 342 times this month"                     |
| Upgrade modal      | Supporting stat               | "87% of users tracking 5+ markets upgrade to Pro" |
| Report builder     | Below market selector         | "156 reports generated for Austin this month"     |

**Implementation:** New backend endpoint `GET /api/analytics/social-proof/:geoLevel/:geoId` returning aggregated counts. Frontend displays as subtle `text-on-surface-variant` text. Numbers are real aggregated counts, not fabricated.

**New DB table:** `market_engagement_stats` — daily aggregated counts per market (views, score checks, reports generated, users tracking). Populated by a nightly cron job from analytics events.

---

## Section 4: Conversion Architecture

### Personalized Paywall

**When it appears:** Workflow-triggered, at the moment the user hits a natural limit:

- Free user (post-trial) tries to view a market beyond their limit
- Free user tries to access ZIP-level data
- Free user tries to generate a report with 0 credits remaining
- Free user tries to use AI chat

**Content:** Dynamic, personalized to user's actual usage:

```
Your PropertyIQ Activity
━━━━━━━━━━━━━━━━━━━━━━━━
6 markets analyzed | 23 scores viewed | 3 reports generated

Keep your market intelligence flowing — $29/mo
[Upgrade to Pro]   [Maybe Later]
```

**Data source:** Usage counters tracked in `user_profiles.usage_stats` (JSONB — markets_viewed, scores_checked, reports_generated, updated in real-time).

**Design:** M3 dialog (rounded-[28px], shadow-lg). Usage stats displayed as a horizontal row of metric cards. Primary CTA is "Upgrade to Pro" (filled button). Secondary is "Maybe Later" (text button). No countdown timers or fake urgency.

### Milestone Celebrations

**Celebration Events:**

| Event                  | Animation                                                | Bridge Action                                       |
| ---------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| First score viewed     | Score ring fill + number count-up (duration-600)         | "See how this compares → Compare Markets"           |
| First report generated | Confetti burst (canvas-confetti library) + "Nice!" toast | "Want unlimited reports? → Explore Pro"             |
| Checklist complete     | All checkmarks bloom simultaneously + "You're all set!"  | "Set up market alerts → Alerts page"                |
| 5th market viewed      | Subtle achievement badge                                 | "You're building serious intel → Generate a report" |

**Implementation:** Lightweight — CSS animations for score ring/checkmarks, `canvas-confetti` (3KB) for confetti, M3 snackbar for toasts. No heavy animation library.

**Bridge CTA:** Each celebration includes a single, contextual next-action link. The link may point to a premium feature — this is the upsell bridge. The CTA is subtle (text link or outlined button), never a hard paywall.

### Behavioral Email Triggers

**Replace** the existing calendar-based drip (Day 0, 1, 3, 5, 7, 10, 14 emails) with behavior-triggered emails.

**Trigger Definitions:**

| Trigger            | Condition                                                | Email Content                                                         | Timing                           |
| ------------------ | -------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------- |
| `welcome`          | Signup complete                                          | Welcome + guided flow reminder                                        | Immediate                        |
| `inactive_24h`     | No search/score view within 24h of signup                | "Here are this week's top 5 trending markets"                         | 24h after signup, if no activity |
| `active_explorer`  | 3+ scores viewed in one session                          | "How investors use PropertyIQ scores to time purchases"               | 1h after session ends            |
| `report_generated` | First report generated                                   | "Your {market} report is ready — here's how to read it"               | Immediate                        |
| `paywall_hit`      | User encountered an upgrade prompt                       | Personalized email with the specific feature they tried + usage stats | 2h after paywall encounter       |
| `trial_day_10`     | 4 days before trial ends                                 | "You've analyzed X markets. Pro ends in 4 days."                      | Day 10                           |
| `trial_day_13`     | 1 day before trial ends                                  | "Last day. Here's what you'll lose:" + feature list they used         | Day 13                           |
| `trial_expired`    | Trial ended, user did not convert                        | "Your Pro access ended. You still have 1 free report."                | Day 14                           |
| `post_trial_7d`    | 7 days post-trial, not converted, has free report credit | "Your free report credit is waiting — use it for {onboarding_market}" | Day 21                           |

**Implementation:** Backend service listens to analytics events (existing event infrastructure). New `email_triggers` table tracks which triggers have fired per user (prevents duplicates). Emails sent via Resend (existing integration).

**Existing drip emails to retire:** `onboarding-day0-welcome.tsx` through `onboarding-day14-report.tsx` — replaced by behavioral templates.

---

## Data Model Changes

### user_profiles (modified)

| Column                 | Type               | Purpose                                                       |
| ---------------------- | ------------------ | ------------------------------------------------------------- |
| `trial_started_at`     | timestamp          | When 14-day Pro trial began                                   |
| `trial_ends_at`        | timestamp          | When trial expires (trial_started_at + 14 days)               |
| `free_report_credits`  | integer, default 1 | Remaining free report credits post-trial                      |
| `onboarding_market`    | jsonb              | Market selected during guided flow: `{geoLevel, geoId, name}` |
| `onboarding_checklist` | jsonb              | Array of completed checklist task IDs                         |
| `dismissed_beacons`    | jsonb              | Array of dismissed beacon IDs                                 |
| `usage_stats`          | jsonb              | `{markets_viewed, scores_checked, reports_generated}`         |

Existing columns preserved: `onboarding_completed_at`, `user_type`, `investment_goal`, `experience_level`, `preferred_markets`.

### New Tables

**market_engagement_stats:**
| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid, PK | |
| `geo_level` | text | metro, county, zip |
| `geo_id` | text | CBSA/FIPS/postal code |
| `date` | date | Aggregation date |
| `view_count` | integer | Total page views |
| `score_check_count` | integer | Score views |
| `report_count` | integer | Reports generated |
| `tracking_user_count` | integer | Unique users who visited 2+ times |

Populated by nightly cron job. RLS: read access for authenticated users.

**email_triggers:**
| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid, PK | |
| `user_id` | uuid, FK | |
| `trigger_name` | text | e.g., `trial_day_10` |
| `fired_at` | timestamp | When email was sent |
| `metadata` | jsonb | Trigger-specific data (market name, usage stats at time of send) |

Unique constraint on `(user_id, trigger_name)` to prevent duplicate sends.

---

## Phasing

**Phase 1 (This spec):**

- Guided flow (hybrid /get-started + spotlight)
- UI refinements (breathing spotlight, connected tooltip, fluid transitions, progress bar)
- Reverse trial (14-day Pro for all signups)
- Sample report on dashboard
- Persistent progress checklist
- Milestone celebrations
- Personalized paywall
- Contextual beacons
- In-product social proof (requires `market_engagement_stats` table + nightly cron)
- Behavioral email triggers (requires `email_triggers` table + event listener service)

**Phase 2 (Future):**

- Quinn AI concierge onboarding

**Implementation sequencing note:** Within Phase 1, the guided flow + reverse trial + checklist + celebrations form the core bundle (can ship together). Social proof, beacons, and behavioral emails each require independent backend infrastructure and can be built and shipped incrementally after the core bundle lands.

---

## Success Metrics

| Metric                         | Current                       | Target                              |
| ------------------------------ | ----------------------------- | ----------------------------------- |
| Free-to-Pro conversion rate    | ~0%                           | 2-3%                                |
| Guided flow completion rate    | ~16% (9-step tour)            | >70% (4-step action flow)           |
| Time to first score view       | Unknown (many never reach it) | <90 seconds                         |
| Reverse trial activation rate  | N/A                           | >60% use a Pro feature during trial |
| Post-trial report credit usage | N/A                           | >40% use their free report          |

---

## Out of Scope

- Changes to the 5-step preference quiz (kept as-is, just moved to post-first-report timing)
- Pricing changes (Pro remains $29/mo)
- Enterprise onboarding (separate system at `/team/setup`)
- Landing page / marketing site changes
- Mobile app onboarding (web only)
