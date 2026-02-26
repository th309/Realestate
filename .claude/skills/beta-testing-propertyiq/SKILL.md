---
name: beta-testing-propertyiq
description: Use when performing QA, beta testing, or acceptance testing on PropertyIQ - dynamically discovers all testable surfaces, tests user journeys across tiers, audits data provenance and source transparency, verifies entitlement gating and admin tier propagation, checks CTA placement, and automatically submits all discovered issues to the beta feedback tracking system
---

# Beta Testing PropertyIQ

## Overview

Systematic browser-driven QA for PropertyIQ. This skill **self-discovers** what to test by scanning the live codebase, then applies structured testing across every surface. **All discovered issues are automatically submitted to the feedback tracking system** via the `/api/betatest/feedback` API.

**Three-layer update system keeps coverage current:**

1. **Phase 0 (this skill)** — Dynamically discovers routes, APIs, components, and config at runtime
2. **`sync-beta-test-coverage` skill** — Deep git history + codebase analysis, updates this skill periodically
3. **Git hook** (`scripts/hooks/beta-test-change-tracker.sh`) — Tracks changes per commit in `.claude/beta-test/change-log.md`

**Core principles:**

1. Every number shown to a user must be traceable — source, fallback status, freshness.
2. Every gated feature must have a clear path to unlock it.
3. Admin tier changes must propagate correctly to every surface.
4. Every issue found gets submitted to the tracking system — nothing gets lost.

## Prerequisites

- Playwright MCP tools available
- Git + npm available in terminal
- Working repo env files at `packages/backend/.env.local` and `packages/frontend/.env.local`
- Admin account for Phase 8

---

## MANDATORY: Run Sync Before Testing

**Before ANY browser testing, you MUST run the `sync-beta-test-coverage` skill.** This is not optional. The sync analyzes git history, discovers new routes/APIs/components, identifies what changed since the last session, and updates the change log and surface inventory that this skill depends on.

**How:**

1. Invoke the `sync-beta-test-coverage` skill via the Skill tool
2. Follow its 7-step process (codebase scan → git analysis → diff → update outputs)
3. Read the updated `.claude/beta-test/change-log.md` for priority areas
4. Read `.claude/beta-test/surface-inventory.json` for the full surface map
5. Only THEN proceed to Session Bootstrap below

**When the sync must run:**

- Before every beta testing session (no exceptions)
- After merging a feature branch
- After significant refactors
- If it's been more than 1 week since last sync

**Skip condition:** Only if the sync was run earlier in the SAME conversation and no new commits have been made since.

---

## Session Bootstrap (Required, No User Intervention)

If the user says "run betatest skill" (or equivalent), do this first and do not ask them to start services manually:

1. Resolve repo root via `git rev-parse --show-toplevel`.
2. Run `scripts/bootstrap-worktree.ps1` (path relative to this skill directory):

```powershell
powershell -ExecutionPolicy Bypass -File "<skill_dir>/scripts/bootstrap-worktree.ps1" -RepoRoot "<repo_root>"
```

3. Use the returned JSON values for this session:
   - `WORKTREE_ROOT=.claude/worktrees/beta-test`
   - `TEST_PORT=3002`
   - `API_PORT=3003`
   - `TESTER_ID`
   - `TESTER_TOKEN`
4. Retry bootstrap once automatically on failure.
5. **Fallback:** If the worktree fails (e.g., branch already checked out), test against the running dev servers on ports 3000/3001 instead.
6. Only ask the user for help if bootstrap still fails after the retry AND no dev servers are running.

## Setup: Isolated Test Instance (Default)

All testing in this skill runs against an isolated worktree instance:

- Frontend: `http://localhost:3002`
- Backend: `http://localhost:3003`
- Worktree path: `.claude/worktrees/beta-test`
- Frontend dev command: `NEXT_DIST_DIR=.next-test npx next dev --webpack -p 3002`
- Backend dev command: `PORT=3003 npm run start:dev`

Manual startup commands are fallback-only if the bootstrap script is unavailable.

### Tier Simulation

Append `?tier=free|pro|enterprise` to any URL, or use the Dev Toolbar that appears at the bottom of the page.

---

## Setup: Issue Tracking Integration

**Before testing, establish the feedback submission pipeline.**

### Get or Create a Tester Token

Option A — Use existing token:

```
browser_navigate → /admin/feedback → Testers tab → copy token for "Test Agent"
```

Option B — Create new tester via API:

```bash
curl -X POST http://localhost:${TEST_PORT}/api/admin/testers \
  -H "Content-Type: application/json" \
  -d '{"name": "Claude Beta Tester", "email": "claude@propertyiq.test"}'
```

Response returns `{ tester: { id, token } }`. Save both values.

### Submitting Issues During Testing

Every time you find an issue during any phase, **immediately submit it**:

```bash
curl -X POST http://localhost:${TEST_PORT}/api/betatest/feedback \
  -H "Content-Type: application/json" \
  -H "X-Tester-Token: {TESTER_TOKEN}" \
  -d '{
    "tester_id": "{TESTER_ID}",
    "category": "{see mapping below}",
    "severity": "{see mapping below}",
    "title": "{short description}",
    "description": "{detailed description}",
    "steps_to_reproduce": "1. ...\n2. ...\n3. ...",
    "expected_behavior": "{what should happen}",
    "actual_behavior": "{what actually happens}",
    "page_url": "{URL where issue appears}",
    "affected_component": "{component name if known}"
  }'
```

**With screenshots** — upload first, then attach:

```bash
# 1. Take screenshot during testing
browser_take_screenshot → saves to file

# 2. Upload to get attachment URL
curl -X POST http://localhost:${TEST_PORT}/api/betatest/upload \
  -H "X-Tester-Token: {TOKEN}" \
  -F "file=@{screenshot_path}"

# 3. Include attachment in feedback submission
"attachments": [{"url": "{signed_url}", "filename": "{name}", "type": "image/png", "size": {bytes}}]
```

### Severity Mapping

| Skill Severity | API Severity | When                                                           |
| -------------- | ------------ | -------------------------------------------------------------- |
| P0             | `critical`   | Broken, security, data loss                                    |
| P1             | `high`       | Major UX broken, misleading data, gating bypassed, missing CTA |
| P2             | `medium`     | Inconsistent, awkward workflows                                |
| P3             | `low`        | Polish, edge cases                                             |

### Category Mapping

| Testing Phase              | API Category      | When                                         |
| -------------------------- | ----------------- | -------------------------------------------- |
| Phase 1 (Data Provenance)  | `bug`             | Wrong source shown, missing provenance       |
| Phase 2 (Data Consistency) | `bug`             | Format mismatch, wrong values                |
| Phase 3-4 (Anonymous/Auth) | `workflow`        | Broken flow, dead ends                       |
| Phase 5 (Gating)           | `bug`             | Gate broken, wrong access                    |
| Phase 6 (CTAs)             | `ux_ui`           | Missing or misplaced CTA                     |
| Phase 7 (Payment)          | `bug`             | Checkout broken, entitlements not refreshing |
| Phase 8 (Admin)            | `bug`             | Propagation failure, admin access control    |
| Phase 9 (Navigation)       | `workflow`        | Dead ends, broken flows                      |
| Phase 10 (Responsive)      | `ux_ui`           | Layout broken at breakpoint                  |
| Phase 11 (Content/SEO)     | `bug`             | Broken pages, missing schema, dead links     |
| Performance issues         | `performance`     | Slow loads, timeouts                         |
| Feature suggestions        | `feature_request` | Improvements identified                      |

### Submitting Known Code-Level Issues

At the **start** of each testing session, submit all items from the Known Issues table (at the bottom of this skill) that haven't been submitted yet. Use `category: 'bug'` and the severity from the table.

---

## Phase 0: Dynamic Discovery

**Run this FIRST every testing session.** Builds the current inventory of testable surfaces.

### 0.1 Discover All Routes

```
Glob: packages/frontend/app/**/page.tsx
```

Derive URL path from directory structure. Categorize as public / auth-gated / admin / dynamic. Flag NEW pages since last run by comparing against `.claude/beta-test/surface-inventory.json`.

### 0.2 Discover All API Endpoints

```
Grep: @Controller in packages/backend/src/**/*.controller.ts
Grep: @Get|@Post|@Put|@Delete|@Patch in same files
```

Build endpoint map. Check for `@UseGuards` — unprotected admin endpoints = P0.

### 0.3 Discover Metric Registry

```
Read: packages/frontend/lib/data/registry.ts
Read: packages/frontend/app/map/config/metrics.ts
Read: packages/backend/src/metric-resolution/fallback-registry.ts
```

All metric IDs, formats, supported geos, fallback chains. New metrics need full testing.

### 0.4 Discover Entitlements

```
Read: packages/frontend/lib/entitlements/types.ts
Glob: packages/frontend/components/entitlements/*.tsx
```

If site is up: snapshot `/admin/entitlements/tiers` for current tier matrix.

### 0.5 Discover Data Layer

```
Glob: packages/frontend/lib/data/fetchers/*.ts → all fetchers
Glob: packages/frontend/lib/data/hooks/*.ts → all hooks
Read: packages/backend/src/metric-resolution/metric-resolution.types.ts → ResolvedMetric structure
```

New fetchers/hooks = new data flows needing consistency tests.

### 0.6 Check Change Log

```
Read: .claude/beta-test/change-log.md
```

Populated by sync skill. **Prioritize testing recently changed areas listed here.**

### 0.7 Generate Test Plan Summary

Output discovered surfaces + priorities + gaps before proceeding.

---

## Phase 1: Data Provenance & Source Transparency

**Highest priority. Every metric value must communicate its source honestly.**

### 1.1 Info Icons on Metric Cards

For EVERY card discovered in Phase 0 that shows a metric value, verify an info indicator exists showing:

| Required                  | Example                                    |
| ------------------------- | ------------------------------------------ |
| **Data source**           | "Source: Zillow ZHVI"                      |
| **Fallback indicator**    | "Primary unavailable — using Census ACS"   |
| **Geography inheritance** | "ZIP unavailable — showing County average" |
| **Data freshness**        | "Updated: Jan 2026"                        |

Click/hover each info icon → snapshot → verify fields. **Submit P1 for each missing element.**

### 1.2 Fallback Source Testing

Read `fallback-registry.ts` chains from Phase 0.3. For each metric with fallbacks:

1. Navigate to geography where primary is sparse (rural ZIPs)
2. Check displayed value indicates fallback usage
3. Verify info icon shows actual source, not primary source

### 1.3 Geographic Inheritance

`/map` → ZIP level → small/rural ZIP → check right panel. Each metric from parent geo must show `InheritedBadge` with source level and name.

### 1.4 Data Freshness

Every metric display: date visible. Score widgets: freshness in confidence. Reports: generation date + data vintage. Check `/api/health/data-freshness` endpoint returns valid data.

---

## Phase 2: Data Consistency

### 2.1 Value Formatting

| Format   | Expected      | Submit Bug If      |
| -------- | ------------- | ------------------ |
| Currency | `$445K`       | Raw `445000`       |
| Percent  | `+3.2%`       | Bare `3.2`         |
| Null     | `—` (em-dash) | `--`, `...`, blank |

Check ALL metric displays from Phase 0.

### 2.2 Loading States

Consistent within each page (all skeleton OR all text placeholder, never mixed).

### 2.3 Empty & Error States

Every component with possible empty data: must show message, not silently disappear.

### 2.4 Score Consistency

Scores 0-100 only. Confidence A/B/C/F only. Badge = confidence, not score grade. Labels match thresholds.

### 2.5 Cross-Page Consistency

Same market, same metric → same value on every page that displays it (`/map`, `/market/[id]`, `/markets/[slug]`, `/reports/[id]`, `/graphs`).

### 2.6 Pricing Consistency

All pricing displays must pull from `subscription_tiers` DB table — no hardcoded dollar amounts. Check:

- `/pricing` page
- `/compare/[slug]` comparison tables
- `UpgradePrompt` components
- `HeadToHead` on `/scores/accuracy`
- `CTABanner` on `/scores/accuracy`
- Homepage pricing section

---

## Phase 3: Anonymous Visitor Flow

Landing page loads with CTAs. All public pages accessible. Auth-gated pages redirect.

### 3.1 Public Page Access

All routes in `surface-inventory.json → routes.public` must load without auth. Verify:

- `/` — Landing with hero, search, pricing section
- `/blog` — Blog index with 4+ posts
- `/blog/[slug]` — Individual blog post with MDX rendering
- `/markets` — Markets listing with 925+ metros grouped by state
- `/markets/[slug]` — Metro detail with 3 ScoreWidgets
- `/compare/[slug]` — Competitor comparison with feature/pricing tables
- `/pricing` — 3 tier cards with live prices from DB
- `/about/terms` — Full Terms of Service
- `/scores`, `/scores/methodology`, `/scores/accuracy`
- `/data` — Data sources page

### 3.2 Anonymous Paywall

After 5+ product page views, `AnonPaywallOverlay` must appear:

- Non-dismissible hard block
- Shows PropertyIQ logo, "Create your free account to continue"
- 3 value props (MapPin, BarChart3, Sparkles)
- "Sign Up Free" primary button → `/auth/sign-up`
- "Already have an account? Log in" secondary link

### 3.3 Newsletter Signup

Test on blog posts and metro pages:

- Form appears with email input + Subscribe button
- Valid email → "Thanks! You're subscribed."
- Invalid email → client-side rejection
- Duplicate email → upserts without error

---

## Phase 4: Account Creation & Auth

### 4.1 Sign-Up Flow

- Form shows ToS checkbox; form won't submit without it checked
- Google OAuth button disabled until ToS is accepted
- Successful email signup shows "Check your email" confirmation screen
- `tos_accepted_at` recorded in user metadata
- Post-auth redirects to `/map` (NOT `/dashboard`)

### 4.2 Sign-In Flow

- Password + magic link + OAuth
- Post-auth redirects to `/map`
- Session persists across navigation

### 4.3 Password Reset

- Full flow: forgot password → email → reset → sign in

### 4.4 Terms of Service

- `/about/terms` loads with all 26 sections including analytics tracking + cookie policy
- Footer and about page link to `/about/terms`

---

## Phase 5: Tier Gating Verification

### Free Tier

Every feature in the entitlements matrix assigned to Pro/Enterprise → must show paywall with CTA. **Missing CTA = P1.**

Key paywall surfaces to check:

- Map geo level pills: PaywallCard for county/zip/tract
- Map metric selector: PaywallCard for premium metrics
- Map sidebar metric items: Lock icons on gated metrics
- Map quick actions: Lock icon on Favorite + Report buttons for free users
- Graphs AI insights: EntitlementGate + InsightsPaywall
- Score cards: ScorePaywall when scores locked
- Markets to Watch: ContextualUpgradeCTA for recommendations
- Save Market button: ContextualUpgradeCTA for watchlist limit

### Free User Upgrade Modal

After 5 minutes on product pages, `FreeUserUpgradeModal` appears:

- Dismissible (X button)
- Shows feature comparison table (Free vs Pro)
- "Upgrade to Pro" button triggers Stripe checkout
- "View all plans" links to `/pricing`
- Reappears after 5 minutes if dismissed

### Pro Tier (`?tier=pro`)

All free features work. Every Pro feature unlocked, no residual paywalls. **Residual paywall = P1.**

### Enterprise Features

Still gated for Pro users.

---

## Phase 6: CTA Completeness

### Anonymous → Signed Up

Landing hero, pricing, header, signup banner — all lead to sign-up.

### Free → Paid

EVERY gated feature has CTA → `/pricing`. Check all paywall components from Phase 0.4.
PaywallCard passes `?from=` pathname for return-to-context after upgrade.

### Dead Ends

Every page has a clear next action. Empty states, error states, post-action screens, gated content all have CTAs.

---

## Phase 7: Upgrade & Payment

### 7.1 Pricing Page

3 cards with live DB prices, toggle (monthly/annual), badges. No hardcoded dollar amounts.

### 7.2 Stripe Checkout

Redirect → success → entitlements refresh. Verify:

- `returnContext` threads through checkout so user returns to originating page
- Success page at `/upgrade/success` loads correctly
- Entitlements refresh after payment (user gains Pro access immediately)

### 7.3 Duplicate Subscription Guard

Users with active subscription for a tier cannot create a duplicate checkout session.

### 7.4 Account Subscription Tab

Plan, usage, manage/upgrade buttons work.

---

## Phase 8: Admin Functions & Tier Propagation

### 8.1 Access Control

| Test                          | Expected | If Fails |
| ----------------------------- | -------- | -------- |
| `/admin` as free              | Blocked  | **P0**   |
| `/admin` as pro               | Blocked  | **P0**   |
| `/api/admin/*` no admin token | 401/403  | **P0**   |

**Known unguarded admin API routes (P0):**

- `api/admin/ml-workflow` — NO AdminGuard
- `api/admin/scores/validation` — NO AdminGuard
- `api/admin/backtest-runs` — NO AdminGuard
- `api/admin/ml-validation` — NO AdminGuard

### 8.2 Command Center (`/admin`)

All widgets load: Data Feeds, Pipeline Runs, Score Health, ML Ops, Feedback Queue. Refresh updates all.

### 8.3 Tier Feature Matrix — Propagation Test

**The critical admin test. Tier changes must propagate site-wide.**

#### Move Feature Pro → Free

1. Drag Pro feature (e.g., `geo_county`) to Free → Save
2. Verify API calls succeed
3. Refresh admin → persisted
4. **New tab as free user** → feature accessible, no paywall
5. **`/pricing`** → feature list updated
6. **All paywall instances** for that feature → gone

#### Move Feature Back Free → Pro

7. Drag back → Save
8. Free user → gated again with paywall + CTA

#### Propagation Timing

| When       | Mechanism                           |
| ---------- | ----------------------------------- |
| On refresh | Context reloads (cache invalidated) |
| 30 min max | Redis TTL                           |

**Submit P1 if:** change doesn't appear after refresh, `/pricing` stale, paywalls don't update, takes >30 min.

#### Bulk Operations

Move 3+ features at once → all persist. Move ALL to Free → entire site ungated. Move ALL to Enterprise → Free/Pro fully gated.

### 8.4 User Management (`/admin/entitlements/users`)

- Create user with email/password/tier
- Delete user (cascading cleanup of 12 tables)
- Change user tier
- Start trial for user
- View user activity stats

### 8.5 User Overrides

Add override: free user gets specific Pro feature. Expiry works. Remove restores tier access. Override takes precedence. Other features still gated.

### 8.6 Trial Management

Trials list, extend, cancel, banner with days remaining, post-expiry fallback to free.

### 8.7 Tester Management (`/admin/feedback`)

- Deactivate tester (soft-delete)
- Reactivate tester
- Regenerate invite link + email
- Resend invite email
- Invite emails send correctly (or log to console in dev)

### 8.8 Analytics (`/admin/entitlements/analytics`)

Paywall views, CTR, top blocked, conversion funnel, date filter. Verify `?days=` param works (was previously broken).

### 8.9 AI Marketing Insights (`/admin/entitlements/analytics`)

- SSE stream works with provider toggle (DeepSeek vs Claude)
- Follow-up prompts maintain conversation history
- Growth progress widget shows correct milestones
- Save, load, update, delete insights workflow
- Recommendation status transitions (pending → implemented, pending → dismissed)
- Implementation plan generation streams correctly

### 8.10 Data Pipelines (`/admin/data`)

Source freshness, run status/duration/records, manual trigger, alerts with ack/resolve. **Post-pipeline:** verify `/map` data updates.

### 8.11 Score Management (`/admin/propertyiq-scores`)

Score cards, formula editor, version activation, A/B testing, ML validation, alerts. **Post-formula change:** verify scores update on `/map`.

### 8.12 Score Validation (`/admin/score-validation`)

Filters, summary cards (correlation, hit rate, excess return), quintile chart, scatter plot.

### 8.13 ML Workflow (`/admin/ml-workflow`)

6 sequential steps, progress bars, analytics health, cache status.

### 8.14 Feedback (`/admin/feedback`)

All issues submitted during this test session should appear here. Verify:

- Issues show with correct category, severity, title
- Screenshots attached correctly
- Status workflow works (submitted → triaged → in_progress → fixed)
- Filters work (status, category, tester)
- Export works

---

## Phase 9: Navigation & Workflows

### End-to-End

**A:** `/` → Map → Search → Click → Market detail → Report
**B:** `/reports` → 2 markets → Generate → Comparison
**C:** Hit paywall → CTA → `/pricing` → Stripe → Unlocked → returned to originating page
**D:** Avatar → Settings → Profile → Subscription → Tabs
**E:** `/` → Blog → Post → Newsletter signup → Markets → Metro detail → "View on Map" → Map
**F:** `/markets/[slug]` → "Full Market Dashboard" → `/market/[id]` → data loads

### Navigation

Header links (including Blog), breadcrumbs, browser back, deep links, mobile hamburger.

### Map Transitions

State → Metro → County → ZIP: data, legend, colors update correctly.

---

## Phase 10: Responsive Design

`browser_resize` at 375x812, 768x1024, 1280x800. Every page readable, navigable, no overflow. Include new pages: `/blog`, `/markets`, `/compare/*`, `/about/terms`.

---

## Phase 11: Content Pages & SEO

### 11.1 Blog

- `/blog` index lists all posts sorted by date descending
- Each `/blog/[slug]` renders MDX content (code blocks, tables, blockquotes)
- Blog post breadcrumbs: Home > Blog > Post Title
- Category chips displayed (note: category filter may not work — anchor links only)
- Author shows "PropertyIQ Research + AI"
- Reading time displayed

### 11.2 Markets Pages

- `/markets` lists 925+ metros grouped alphabetically by state
- Each `/markets/[slug]` shows:
  - Metro name + state
  - 3 ScoreWidgets (HomeReady, InvestorEdge, Market Health) with labels
  - NO floating confidence badges
  - "View on Interactive Map" CTA → `/map?geo=metro&region=[cbsaCode]`
  - "Full Market Dashboard" → `/market/[cbsaCode]?type=metro`
  - "More Markets in [State]" section
  - Newsletter signup
- Invalid slug returns 404

### 11.3 Competitor Comparison Pages

- All 3 slugs load: `propertyiq-vs-reventure`, `propertyiq-vs-mashvisor`, `propertyiq-vs-neighborhoodscout`
- Feature comparison table highlights winners
- Pricing table shows live DB prices (not hardcoded $39/$149)
- FAQ section renders correctly
- CTA button → `/pricing`
- Invalid slug returns 404

### 11.4 SEO Artifacts

- `/robots.txt` loads, blocks `/admin`, `/auth`, `/api`
- `/sitemap.xml` generates valid XML with all routes (static + metros + blog + compare)
- `/blog/rss.xml` returns valid RSS XML
- OG image loads at `/og-image.png`
- Each public page has unique title + description metadata
- JSON-LD schema valid on blog posts (Article), metro pages (Place), comparison pages (FAQ)
- No `propertyiq.com` references in page source (should all be `propertyiq.app`)

### 11.5 Google Analytics

- `gtag('config', 'G-...')` fires on page load
- Page view events tracked on navigation

---

## Known Code-Level Issues

**Submit ALL of these as `category: 'bug'` at the start of each testing session if not already tracked.**

Check `.claude/beta-test/change-log.md` for additional issues discovered by the sync process.

### Security (P0)

| Issue                                           | Where                         |
| ----------------------------------------------- | ----------------------------- |
| `ml-workflow.controller.ts` has NO AdminGuard   | `api/admin/ml-workflow`       |
| `validation.controller.ts` has NO AdminGuard    | `api/admin/scores/validation` |
| `backtest-runs.controller.ts` has NO AdminGuard | `api/admin/backtest-runs`     |
| `ml-validation.controller.ts` has NO AdminGuard | `api/admin/ml-validation`     |

### Data Provenance (P1)

| Issue                                                                     | Where                                      |
| ------------------------------------------------------------------------- | ------------------------------------------ |
| `MetricTitle` info icon shows primary source only, not actual source used | Any metric tooltip                         |
| `InheritedBadge` exists but never rendered anywhere                       | ZIP/county metrics                         |
| Backend `ResolvedMetric` metadata not passed in API responses             | All metric displays                        |
| No fallback indicator shown when secondary source provides data           | Metric cards with fallback values          |
| AI insights `execute` endpoint allows arbitrary DB changes                | `api/admin/analytics/insights/.../execute` |

### Data Consistency (P2)

| Issue                                                           | Where                             |
| --------------------------------------------------------------- | --------------------------------- |
| `formatMetricValue()` returns `—` but components hardcode `--`  | Null metrics across site          |
| `useDataCardBatch` silently filters null values                 | Card grids showing fewer items    |
| No retry on failed API calls                                    | Network blips → permanent error   |
| Inconsistent loading (skeleton vs `...` vs `--`)                | Slow network testing              |
| Report `metricHelpers.ts` duplicates backend fallback logic     | Report values may differ from map |
| Blog category filter uses anchor links that don't filter        | `/blog` page                      |
| `metro-slug-data.ts` is 6,564 lines (file size limit violation) | `/markets/[slug]` bundle          |
| Newsletter API route has no rate limiting                       | `POST /api/newsletter`            |
| Newsletter has no double opt-in / email verification            | Newsletter signup flow            |
| Compare page `withLivePricing()` regex replacement is fragile   | `/compare/[slug]`                 |
| Compare page catches pricing fetch failures silently            | `/compare/[slug]`                 |
| Sitemap lastModified changes on every build                     | `/sitemap.xml`                    |

### Polish (P3)

| Issue                                                        | Where                 |
| ------------------------------------------------------------ | --------------------- |
| No WebSocket push for admin tier changes                     | Stale user sessions   |
| System health status is mocked (always healthy)              | `/admin` banner       |
| GA measurement ID hardcoded as fallback                      | `GoogleAnalytics.tsx` |
| Pricing page shows `...` briefly while loading dynamic price | `/pricing`            |

---

## End of Session: Verify Submissions

After completing all phases:

1. Navigate to `/admin/feedback`
2. Filter by your tester name
3. Verify ALL issues submitted during this session appear
4. Verify screenshots are attached and viewable
5. Verify categories and severities are correct
6. Count: total issues found, by severity breakdown

Output a session summary:

```
=== Beta Test Session Complete ===
Date: [date]
Phases Run: [list]
Issues Submitted: X total (P0: _, P1: _, P2: _, P3: _)
Screenshots Attached: X
Phases with Zero Issues: [list] (these may need deeper testing)
Coverage: [X of Y discovered surfaces tested]
```

Then proceed directly to **Auto-Remediation** below.

---

## Auto-Remediation: Systematic Debugging Handoff

**After the session summary is output, this phase runs automatically.** Do NOT ask the user whether to proceed — just do it. The only exception is when a fix could cause significant damage (see Safety Gates below).

### Step 1: Build the Findings Manifest

Collect ALL issues discovered during the session into a single structured list, ordered by priority:

```
Priority order: P0 (critical) → P1 (high) → P2 (medium) → P3 (low)
Within same priority: Known Code-Level Issues first, then newly discovered issues
```

For each finding, capture:

| Field         | Source                                           |
| ------------- | ------------------------------------------------ |
| `id`          | Sequential (F-001, F-002, ...)                   |
| `severity`    | P0 / P1 / P2 / P3                                |
| `title`       | Short description from feedback submission       |
| `category`    | bug / workflow / ux_ui / performance             |
| `where`       | File path or component name                      |
| `phase`       | Which testing phase discovered it                |
| `risk_level`  | `safe` / `needs_confirmation` (see Safety Gates) |
| `description` | Full description including steps to reproduce    |

### Step 2: Classify Risk Level (Safety Gates)

Each finding gets classified as `safe` (auto-fix) or `needs_confirmation` (pause and ask).

**`needs_confirmation` — STOP and ask the user before fixing:**

| Condition                                                             | Why                                   |
| --------------------------------------------------------------------- | ------------------------------------- |
| Database schema changes (migrations, RLS policies, table alterations) | Irreversible in production            |
| Auth/security changes (guards, middleware, token handling, RLS)       | Could lock out users or expose data   |
| Payment/billing logic (Stripe integration, subscription handling)     | Could charge users incorrectly        |
| Deleting files, removing exports, or changing public API signatures   | Could break consumers                 |
| Environment variable or secrets changes                               | Could break deployments               |
| Changes to admin access control                                       | Could expose admin surfaces           |
| Any P0 security issue fix                                             | High blast radius, needs human review |

**`safe` — fix automatically:**

| Condition                                    | Examples                                  |
| -------------------------------------------- | ----------------------------------------- |
| Formatting fixes                             | `--` → `—`, missing `$`, bare numbers     |
| Adding missing UI indicators                 | Info icons, badges, loading states        |
| Adding missing imports or re-exports         | `InheritedBadge` not rendered             |
| CSS/layout fixes                             | Responsive breakpoints, overflow          |
| Adding missing null/empty state handling     | Components that silently disappear        |
| Consistency fixes                            | Same value shown differently on two pages |
| Adding missing error messages                | Silent failures → user-visible errors     |
| File size violations (splitting large files) | Refactoring only, no behavior change      |
| Adding rate limiting to unprotected routes   | Additive security, no behavior change     |

### Step 3: Invoke Systematic Debugging

For each finding (in priority order), invoke the `superpowers:systematic-debugging` skill workflow:

1. **Phase 1 (Root Cause):** Trace the issue to its source. Read the relevant files, check git history, understand why the bug exists — not just where it manifests.
2. **Phase 2 (Pattern Analysis):** Find working examples of similar correct behavior in the codebase. Identify what's different.
3. **Phase 3 (Hypothesis):** Form a single clear hypothesis. Test minimally.
4. **Phase 4 (Implementation):** Fix the root cause. One fix at a time.

**Batch similar findings.** If multiple findings share the same root cause (e.g., "missing provenance info" across 4 components all caused by backend not passing `ResolvedMetric` metadata), investigate once and fix the root cause rather than patching each symptom independently.

**Parallelism:** Use parallel agents for independent fixes. Group findings by file/module and dispatch separate agents for each independent group. For example:

```
Agent 1: Fix formatting inconsistencies (P2, safe, frontend utils)
Agent 2: Add missing InheritedBadge rendering (P1, safe, frontend components)
Agent 3: Add AdminGuard to unprotected controllers (P0, needs_confirmation, backend)
→ Agents 1 & 2 run immediately; Agent 3 pauses for user confirmation first
```

### Step 4: Confirmation Gate (for `needs_confirmation` items)

When reaching a `needs_confirmation` finding:

1. **Present the finding** with full context (what, where, why it's risky)
2. **Present the proposed fix** (specific code changes, not vague descriptions)
3. **Ask:** "This fix touches [security/payments/schema/etc.]. Proceed? (y/n)"
4. If approved → fix it
5. If denied → skip it, note as "deferred" in the remediation report
6. **Continue** to the next finding regardless

### Step 5: Remediation Report

After all findings have been processed, output:

```
=== Auto-Remediation Report ===
Date: [date]
Total findings: X

Fixed automatically: X
  - F-001: [title] — root cause: [one line], fix: [one line]
  - F-003: [title] — root cause: [one line], fix: [one line]

Fixed after confirmation: X
  - F-005: [title] — root cause: [one line], fix: [one line]

Deferred (user declined): X
  - F-007: [title] — reason declined

Unfixable (requires design decision): X
  - F-009: [title] — why it can't be auto-fixed

Batched (shared root cause): X findings → Y fixes
  - F-002, F-004, F-006 all caused by [root cause] → single fix in [file]
```

### Step 6: Verification Pass

After all fixes are applied:

1. Run the project's linter and type checker (`npm run lint && npm run type-check` in both packages)
2. Run existing tests (`npm test` in both packages)
3. If any fix broke something, apply the systematic debugging process to the regression — do NOT revert blindly
4. Summarize: "All X fixes verified — lint clean, types clean, tests passing"

**If verification fails on a `safe` fix:** That fix was misclassified. Revert it, reclassify as `needs_confirmation`, and present to the user.
