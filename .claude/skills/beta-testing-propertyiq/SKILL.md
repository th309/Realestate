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
5. Only ask the user for help if bootstrap still fails after the retry.

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

| Skill Severity | API Severity | When |
|---------------|-------------|------|
| P0 | `critical` | Broken, security, data loss |
| P1 | `high` | Major UX broken, misleading data, gating bypassed, missing CTA |
| P2 | `medium` | Inconsistent, awkward workflows |
| P3 | `low` | Polish, edge cases |

### Category Mapping

| Testing Phase | API Category | When |
|--------------|-------------|------|
| Phase 1 (Data Provenance) | `bug` | Wrong source shown, missing provenance |
| Phase 2 (Data Consistency) | `bug` | Format mismatch, wrong values |
| Phase 3-4 (Anonymous/Auth) | `workflow` | Broken flow, dead ends |
| Phase 5 (Gating) | `bug` | Gate broken, wrong access |
| Phase 6 (CTAs) | `ux_ui` | Missing or misplaced CTA |
| Phase 7 (Payment) | `bug` | Checkout broken, entitlements not refreshing |
| Phase 8 (Admin) | `bug` | Propagation failure, admin access control |
| Phase 9 (Navigation) | `workflow` | Dead ends, broken flows |
| Phase 10 (Responsive) | `ux_ui` | Layout broken at breakpoint |
| Performance issues | `performance` | Slow loads, timeouts |
| Feature suggestions | `feature_request` | Improvements identified |

### Submitting Known Code-Level Issues

At the **start** of each testing session, submit all items from the Known Issues table (at the bottom of this skill) that haven't been submitted yet. Use `category: 'bug'` and the severity from the table.

---

## Phase 0: Dynamic Discovery

**Run this FIRST every testing session.** Builds the current inventory of testable surfaces.

### 0.1 Discover All Routes

```
Glob: packages/frontend/app/**/page.tsx
```

Derive URL path from directory structure. Categorize as public / auth-gated / admin / dynamic. Flag NEW pages since last run.

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

Populated by git hook. Prioritize testing recently changed areas.

### 0.7 Generate Test Plan Summary

Output discovered surfaces + priorities + gaps before proceeding.

---

## Phase 1: Data Provenance & Source Transparency

**Highest priority. Every metric value must communicate its source honestly.**

### 1.1 Info Icons on Metric Cards

For EVERY card discovered in Phase 0 that shows a metric value, verify an info indicator exists showing:

| Required | Example |
|----------|---------|
| **Data source** | "Source: Zillow ZHVI" |
| **Fallback indicator** | "Primary unavailable — using Census ACS" |
| **Geography inheritance** | "ZIP unavailable — showing County average" |
| **Data freshness** | "Updated: Jan 2026" |

Click/hover each info icon → snapshot → verify fields. **Submit P1 for each missing element.**

### 1.2 Fallback Source Testing

Read `fallback-registry.ts` chains from Phase 0.3. For each metric with fallbacks:
1. Navigate to geography where primary is sparse (rural ZIPs)
2. Check displayed value indicates fallback usage
3. Verify info icon shows actual source, not primary source

### 1.3 Geographic Inheritance

`/map` → ZIP level → small/rural ZIP → check right panel. Each metric from parent geo must show `InheritedBadge` with source level and name.

### 1.4 Data Freshness

Every metric display: date visible. Score widgets: freshness in confidence. Reports: generation date + data vintage.

---

## Phase 2: Data Consistency

### 2.1 Value Formatting

| Format | Expected | Submit Bug If |
|--------|----------|--------------|
| Currency | `$445K` | Raw `445000` |
| Percent | `+3.2%` | Bare `3.2` |
| Null | `—` (em-dash) | `--`, `...`, blank |

Check ALL metric displays from Phase 0.

### 2.2 Loading States

Consistent within each page (all skeleton OR all text placeholder, never mixed).

### 2.3 Empty & Error States

Every component with possible empty data: must show message, not silently disappear.

### 2.4 Score Consistency

Scores 0-100 only. Confidence A/B/C/F only. Badge = confidence, not score grade. Labels match thresholds.

### 2.5 Cross-Page Consistency

Same market, same metric → same value on every page that displays it (`/map`, `/market/[id]`, `/reports/[id]`, `/graphs`).

---

## Phase 3: Anonymous Visitor Flow

Landing page loads with CTAs. All public pages accessible. Auth-gated pages redirect. After 3+ market views, `SignupPromptBanner` appears.

---

## Phase 4: Account Creation & Auth

Sign-up: form validation, OAuth, email verification. Sign-in: password + magic link + OAuth. Password reset: full flow. Post-auth: header updates, session persists, protected pages accessible.

---

## Phase 5: Tier Gating Verification

### Free Tier
Every feature in the entitlements matrix assigned to Pro/Enterprise → must show paywall with CTA. **Missing CTA = P1.**

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

### Dead Ends
Every page has a clear next action. Empty states, error states, post-action screens, gated content all have CTAs.

---

## Phase 7: Upgrade & Payment

Pricing page: 3 cards, toggle, badges. Stripe checkout: redirect → success → entitlements refresh. Account subscription tab: plan, usage, manage/upgrade.

---

## Phase 8: Admin Functions & Tier Propagation

### 8.1 Access Control

| Test | Expected | If Fails |
|------|----------|----------|
| `/admin` as free | Blocked | **P0** |
| `/admin` as pro | Blocked | **P0** |
| `/api/admin/*` no admin token | 401/403 | **P0** |

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

| When | Mechanism |
|------|-----------|
| On refresh | Context reloads (cache invalidated) |
| 30 min max | Redis TTL |

**Submit P1 if:** change doesn't appear after refresh, `/pricing` stale, paywalls don't update, takes >30 min.

#### Bulk Operations

Move 3+ features at once → all persist. Move ALL to Free → entire site ungated. Move ALL to Enterprise → Free/Pro fully gated.

### 8.4 User Overrides

Add override: free user gets specific Pro feature. Expiry works. Remove restores tier access. Override takes precedence. Other features still gated.

### 8.5 Trial Management

Trials list, extend, cancel, banner with days remaining, post-expiry fallback to free.

### 8.6 Analytics

Paywall views, CTR, top blocked, conversion funnel, date filter.

### 8.7 Data Pipelines (`/admin/data`)

Source freshness, run status/duration/records, manual trigger, alerts with ack/resolve. **Post-pipeline:** verify `/map` data updates.

### 8.8 Score Management (`/admin/propertyiq-scores`)

Score cards, formula editor, version activation, A/B testing, ML validation, alerts. **Post-formula change:** verify scores update on `/map`.

### 8.9 Score Validation (`/admin/score-validation`)

Filters, summary cards (correlation, hit rate, excess return), quintile chart, scatter plot.

### 8.10 ML Workflow (`/admin/ml-workflow`)

6 sequential steps, progress bars, analytics health, cache status.

### 8.11 Feedback (`/admin/feedback`)

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
**C:** Hit paywall → CTA → `/pricing` → Stripe → Unlocked
**D:** Avatar → Settings → Profile → Subscription → Tabs

### Navigation

Header links, breadcrumbs, browser back, deep links, mobile hamburger.

### Map Transitions

State → Metro → County → ZIP: data, legend, colors update correctly.

---

## Phase 10: Responsive Design

`browser_resize` at 375x812, 768x1024, 1280x800. Every page readable, navigable, no overflow.

---

## Known Code-Level Issues

**Submit ALL of these as `category: 'bug'` at the start of each testing session if not already tracked.**

Check `.claude/beta-test/change-log.md` for additional issues discovered by the sync process.

| Issue | Sev | Category | Where |
|-------|-----|----------|-------|
| Admin routes unprotected (no middleware/guards) | P0 / critical | bug | `/admin/*` as non-admin |
| `MetricTitle` info icon shows primary source only, not actual source used | P1 / high | bug | Any metric tooltip |
| `InheritedBadge` exists but never rendered anywhere | P1 / high | bug | ZIP/county metrics |
| Backend `ResolvedMetric` metadata not passed in API responses | P1 / high | bug | All metric displays |
| No fallback indicator shown when secondary source provides data | P1 / high | ux_ui | Metric cards with fallback values |
| `formatMetricValue()` returns `—` but components hardcode `--` | P2 / medium | bug | Null metrics across site |
| `useDataCardBatch` silently filters null values | P2 / medium | bug | Card grids showing fewer items |
| No retry on failed API calls | P2 / medium | bug | Network blips → permanent error |
| Inconsistent loading (skeleton vs `...` vs `--`) | P2 / medium | ux_ui | Slow network testing |
| Report `metricHelpers.ts` duplicates backend fallback logic | P2 / medium | bug | Report values may differ from map |
| No WebSocket push for admin tier changes | P2 / medium | feature_request | Stale user sessions |
| System health status is mocked (always healthy) | P3 / low | bug | `/admin` banner |

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
