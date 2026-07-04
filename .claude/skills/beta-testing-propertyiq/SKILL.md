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

**IMPORTANT:** Store the `feedback.id` from each successful POST response. This ID is used by the Auto-Remediation phase to update tracker status automatically. Keep a mapping of `{ finding_title → feedback_id }` throughout the session.

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

### 0.7 Pre-Flight Smoke Probes

Quick HTTP checks before walking the UI. Failures here usually indicate environment / branch issues, not code bugs.

- [ ] `curl -i http://localhost:3000/tour` → 200 (NOT 404 — 404 means the local repo is on a branch without the tour code; common after `git checkout` shuffles)
- [ ] `curl -X POST http://localhost:3001/api/anonymous/listing-presentation -H 'content-type: application/json' -d '{}'` → 403 (rate-limit guard active; not 500 / Failed to fetch)
- [ ] `curl http://localhost:3001/api/markets/peers/metro/16740` → 200 with JSON `{source, peers: [...]}`
- [ ] After visiting `/tour`, browser DevTools shows cookie `piq_tour_session` with `HttpOnly`, `samesite=Lax`, `Secure` ONLY on https
- [ ] Browser DevTools console has no `Cannot update a component while rendering` errors (React 19 violation regression check)
- [ ] If extensions block requests with `ERR_BLOCKED_BY_CLIENT`, retest in incognito — adblockers commonly kill `/api/usage/*` (renamed from `/api/analytics/*`) and gtag. NOTE: browser→backend now flows through a same-origin `/backend` proxy for ad-blocker resilience.
- [ ] `curl -s http://localhost:3001/api/screener/metro | head -c 200` → JSON `{data:[...],total,page,pageSize,hasMore}` (screener snapshot populated; empty `data:[]` = stale/never-refreshed snapshot, a P2 first-run gap)
- [ ] `curl -s http://localhost:3001/api/analyzer/market-context?geo_level=metro&geo_id=16740 | head -c 200` → JSON (anon free-preview; 4th anon call → 402)
- [ ] `curl -sI -H "Accept: text/markdown" http://localhost:3000/pricing | grep -i "content-type\|vary"` → `text/markdown` + `Vary: Accept` (agent markdown negotiation)
- [ ] `curl -s http://localhost:3000/.well-known/mcp/server-card.json | head -c 200` → JSON server card (agent discovery rewrite working)

### 0.7b Feature-Flag Awareness (CRITICAL — read before testing landing/map)

Two surfaces are **flag-gated OFF by default**. A tester on a clean env sees the OLD experience and will wrongly report the new ones as "missing":

| Flag                         | Default | Enables                                                                                                             | Where        |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- | ------------ |
| `LANDING_EXPERIMENT`         | OFF     | 8-beat landing funnel (`/` → `/home-v2` rewrite). `off`\|`preview`\|`ab:<n>`\|`on`. `?landing=v2` forces variant B. | frontend env |
| `NEXT_PUBLIC_CINEMATIC_ZOOM` | OFF     | satellite/3D/spotlight map zoom on geo selection (must equal `"true"`)                                              | frontend env |
| `RUN_CRONS`                  | OFF     | all scheduled jobs (don't expect drip emails / revalidation locally without it)                                     | backend env  |

To test the new landing: set `LANDING_EXPERIMENT=on` (or visit `/home-v2` / `/?landing=v2` directly). To test cinematic zoom: `NEXT_PUBLIC_CINEMATIC_ZOOM=true`. If you can't set env, test variant B at `/home-v2` (always noindex).

### 0.8 Generate Test Plan Summary

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

**⚠️ Redfin Data Center cards (NEW 2026-07-04) — known provenance gap, confirm live:** the 5 new Pro-gated cards (`sold_above_list_share` "Sold Above List %", `listings_delisted_share` "Delisting Share %", `pending_cancellation_share` "Sale Cancellation %" under _Pricing & Deals_; `investor_market_share` "Investor Market Share %", `all_cash_share` "All-Cash Purchase %" under _Cash Flow_) have **no `METRIC_DEFINITIONS` entry**, so `MetricTitle` likely renders **no info icon at all**. Confirm on `/map` (Pro tier) whether each of the 5 shows an info icon; if none appears, that's the expected gap (submit/confirm the P1 in Known Issues). If an icon DOES appear, verify the "As of" date is current (~May 2026 monthly / Q1 2026 quarterly) and not the stale "Dec 2025" from `DATA_DATES.redfin`.

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

**Reports "missing data" re-verify (fixed 2026-07-04, `d18b37f8`):** on `/reports/[id]` for a metro/county/zip with known data, confirm **Months of Supply**, **Sale-to-List Ratio**, and **Net Migration** now render **real values** — NOT "Data Unavailable" or narrative prose like "Insufficient data to classify market phase." Root cause was these three never being resolved through `MetricResolutionService`. Also spot-check **Sale-to-List reads as a sane percentage (~90-105%), not a fraction (~0.9-1.05)** — a ×100 unit bug was fixed alongside the sourcing fix.

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
- `/about` — Company info
- `/contact` — Contact form
- `/help` — FAQ and support

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

## Phase 3.5: Activation Tour (NEW — replaces /get-started)

**The canonical anonymous activation entry.** Anonymous-friendly through step 4; signup happens inline at the end. Spec: `docs/superpowers/specs/2026-05-03-activation-tour-redesign-design.md`. State machine spans 5 tiers (URL params + cookie + localStorage + Redis + reports DB).

### 3.5.1 Persona Selection (`/tour`)

- Navigate to `/tour` (no params, no auth)
- 3 persona cards render: "I'm an agent / broker" (with green "For you" badge), "I'm an investor", "I'm a homebuyer"
- Each card: title, 3 bullet points, "Continue as <persona> →" button
- Click any persona → URL updates to `/tour?persona=<x>&phase=market`, market picker renders
- Verify cookie `piq_tour_session=<uuid>` is set (HttpOnly, samesite=Lax; Secure ONLY when on https)
- Verify `localStorage.piq_tour` is populated

### 3.5.2 Market Picker

- Search input has autofocus, placeholder "Type a city, ZIP, or metro…"
- Typeahead uses `useUniversalSearch` — search "Cary" returns results within ~300ms
- Each result row shows a colored PIQ Score chip (green ≥80, amber 50-79, red <50) — uses standardized `getScoreColor()`
- 3 fallback chips visible below: Charlotte, NC / Phoenix, AZ / Tampa, FL
- Picking a result advances to step1 — URL: `/map?tour=step1&persona=<x>&market=<level>-<id>&sessionId=<uuid>`
- **State filter:** if user types a state name, state-typed results must NOT appear in the listbox (filtered out — only metro/county/city/zip pass through)

### 3.5.3 Spotlight Tour (Steps 1-3)

| Step | Lands on                            | Spotlight target                 | Continue advances to              |
| ---- | ----------------------------------- | -------------------------------- | --------------------------------- |
| 1    | `/map?tour=step1&...`               | `[data-tour="search-bar"]`       | `/market/<geoId>?tour=step2&...`  |
| 2    | `/market/[id]?tour=step2&...`       | `[data-tour="propertyiq-score"]` | `/compare/markets?tour=step3&...` |
| 3    | `/compare/markets?tour=step3&a=...` | `[data-tour="compare-grid"]`     | `/tour?phase=step4&...`           |

For each step:

- `BreathingSpotlight` overlay with cutout on the target element
- `ConnectedTooltip` with persona-specific copy (agent/investor/homebuyer)
- Click target OR Continue button advances; ✕ dismisses tour to `/`
- Mobile (≤768px): renders `TourBottomSheet` instead of floating tooltip

### 3.5.4 Listing Presentation (Step 4 — the "aha")

`/tour?phase=step4&...` triggers `useAnonymousListingPresentation` mutation.

- `ListingPresentationLoading` shows spinner + rotating message every 2.8s through 4 messages
- After 15s, "stuck banner" appears: "Still working on it. Larger markets take a bit longer."
- On success (~5-10s), 10-section listing presentation renders:
  1. **Executive summary** with `ScoreRing` + confidence badge (A/B/C/F) + 3-paragraph thesis + recommendation pull-quote
  2. **The market right now** — 8-stat grid (median price, DOM, % sold above list, months supply, rent, sale-to-list, $/sqft, est. listings)
  3. **12-month trajectory** — `TrajectoryChart` with 3 series (target / parent metro / state)
  4. **Forward forecast** — `ForecastChart` with 80% CI shading + NOW marker + 3 forecast cards
  5. **Comparable peers** — peer comparison grid (top-3 from `/api/markets/peers`)
  6. **Migration & demographics** — top in-migration sources (IRS) + buyer affordability (Census ACS)
  7. **Affordability** — 2 `Gauge` components (affordability index + rent-vs-buy break-even)
  8. **Economic drivers** — `EmploymentBars` (BLS QCEW) + labor signals
  9. **Validated track record** — score validation accuracy + 3Y excess return
  10. **AI strategy** — Source Serif 4 narrative + 3 numbered action cards
- **Cover** above section 1: indigo gradient with marketName + "Listing Presentation" + geography meta + generated date
- **Demo banner** below cover (subtle amber `bg-warning-container`): "Demo report — sign up free to save…"
- **Sources footer** cites: Zillow ZHVI, Redfin Market Tracker, U.S. Census ACS, FRED/BEA, BLS QCEW, IRS migration, PropertyIQ Score (NO version number — the score is a single unversioned PropertyIQ Score; flag any "v4"/"v3" naming in the footer as a P1 per Known Issues)
- All charts are hand-rolled SVG (no chart library)
- All colors use M3 semantic tokens — no hex literals (regex-asserted in tour tests)

### 3.5.5 Limited-Data Resilience

For each section, simulate `limitedData=true` (or fetch a tiny ZIP that has no data):

- Each section's `Section` wrapper still renders title + numbered chip
- Body shows graceful "Limited data available for this market" message
- No layout break, no React error
- AiStrategy uses `fallbackUsed` instead of `limitedData` — verify both

### 3.5.6 Inline Signup + Claim

- `InlineSignupForm` renders below the report (NOT a modal — keeps report visible above)
- Headline: "Save <market>. Make another. Share with your client."
- Email + password inputs + "Save my report →" submit button
- ✕ collapses form to a "Sign up to save" sticky pill at top-right
- Submit fires `POST /api/anonymous/sign-up-with-tour` with `{email, password, tourSessionId}`
- **Dev (`NODE_ENV !== 'production'`):** auto-confirm + magic link returned; redirect to `/tour?phase=celebrate&sessionId=<uuid>`
- **Prod (real email-confirm):** "check your email" inline message; user clicks email link → `/auth/callback` → `POST /api/anonymous/claim` → `/tour?phase=celebrate&sessionId=<uuid>`
- After claim: `reports` table has new row with `user_id`, `report_type='listing_presentation'`, `source='tour_anonymous_claim'`, `anon_session_id`, `payload` JSON
- Redis row marked `claimedBy: <userId>` (audit trail)
- `user_profiles.onboarding_market` upserted

### 3.5.7 Celebrate Screen (`?phase=celebrate`)

- `PostSignupCelebrate` renders: indigo gradient + green tertiary check badge + "Your <market> report is saved"
- Saved-report card preview with market name + Listing Presentation label
- 3 CTAs: Open my report (`/dashboard?openReport=latest`) / Try another market (`/tour?resume=fresh`, calls `reset()`) / Go to dashboard (`/dashboard`)

### 3.5.8 Edge Cases

- `/tour?resume=fresh` → wipes localStorage + cookie in lazy useState initializer; strips `resume=fresh` from URL via `router.replace`; mints new sessionId
- Rate limit (1 generation per IP per 24h): second `POST /api/anonymous/listing-presentation` returns `TourRateLimitError` (with `Retry-After` header). `ListingPresentationError` shows rate-limit branch with "Sign up free →" CTA.
- 308 redirect: `/get-started?next=/reports` MUST land on `/tour?next=/reports` (middleware preserves query params). NOTE: `?next=` is currently inert past the market step — Phase 03/04 TODO.
- `cbsa-39580` URL alias: `parseMarket('cbsa-39580')` normalizes to `geoLevel: 'metro'` via `GEO_LEVEL_ALIAS`. Invalid prefix (`bogus-39580`) → null market, falls back to picker.
- Print: `Ctrl+P` from listing presentation hides demo banner + signup-cta via `[data-print-hide="true"]`; only `<article>` prints; clean section breaks (`break-inside: avoid`).
- Mobile (≤768px): TourBottomSheet replaces tooltip; cover H1 shrinks to `text-[28px]`; Section padding `px-5 py-8 md:px-12 md:py-10`.

### 3.5.9 Re-Tour for Existing Users

- Click "Take the tour" anchor in `/dashboard` — opens `/tour?resume=fresh`
- Old `app/onboarding/TourProvider.tsx` `restartTour` also routes to `/tour?resume=fresh`

### Failure Modes — Submit as P1

- 404 on `/tour` (likely dev server reading wrong branch — common after a checkout)
- "Cannot update component while rendering" React error (router call inside setState updater — see Known Issues)
- Persona cards render but click does nothing (state machine breakage)
- Step 4 `Failed to fetch` (backend /api/anonymous/listing-presentation down OR ad blocker — verify in DevTools Network tab)
- Listing presentation renders but a section is missing (data layer issue or `pickSection` returned null)

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
- **Redfin Data Center metrics (NEW 2026-07-04):** the 5 new Pro-gated cards (`sold_above_list_share`, `listings_delisted_share`, `pending_cancellation_share`, `investor_market_share`, `all_cash_share`) — as **free**, all 5 locked/blurred with `PaywallCard`; as **pro/enterprise/admin**, all unlocked. **Critically, verify an admin session sees all 5 (not zero)** — this confirms they gated to Pro and did NOT silently land at `level: "none"` (the hidden-even-from-admin footgun). County/ZIP additionally gated by `geo_county`/`geo_zip` (the 2 metro-only ones are absent at county/zip). Bust the 30-min entitlements cache with `?tier=pro`.
- Map quick actions: Lock icon on Favorite + Report buttons for free users
- Graphs AI insights: EntitlementGate + InsightsPaywall
- Score cards: ScorePaywall when scores locked
- Score breakdown/component view: `ScoreBreakdownGate` (NEW 2026-07 sync) — verify gating on the per-input z-score breakdown
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

**Display-bug regression checks (fixed 2026-07-04, `bd804081`):** Cache "Hit Rate" reads a sane 0-100% (NOT "4284.8%"); Score Health shows an **em-dash for genuine no-data** (NOT a misleading "0%"); Data Feeds "days since" is never negative (the "HUD FMR -182d" annual-source bug — should clamp to 0). Re-file if any regress.

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
**G:** Map → Search → Click favorites dropdown → Select saved market → Map navigates to it
**H:** Graphs → Search → Favorites dropdown appears → Select saved market → Slot populates

### Navigation

Header links (including Blog + the "Compare" link in the More dropdown), browser back, deep links.

**Mobile nav overhaul (since 2026-05-04):**

- The old bottom tab bar (`MobileNav`) is **deleted**. Mobile nav is now a right slide-out **drawer** (`MobileMenu`, hamburger): verify focus-trap, Esc + scrim close, pinned account/sign-out, drawer covers the score ticker (z-60).
- **GlobalBreadcrumbs** render once below the header on all non-full-screen routes (excluded: `/map`, `/embed/*`, `/auth/*`, `/tour`, onboarding, `/reports/builder`, `/market/*`, `/home-v2`, `/`). Verify the trail is correct, numeric IDs are skipped, and it's hidden on the excluded routes.
- **Scroll-lock:** opening the drawer OR the analyzer mobile input sheet locks body scroll; both-open must not prematurely unlock (ref-counted).

### Comparison Report v3 (`/reports/[id]`)

Build a 2–3 market comparison from `/reports` (like-geo restriction filters the dropdown after the first pick; max 5; `>1` → comparison). Verify `ComparisonReportV3`: scoreboard shows **all** markets' live scores (no "—"/"No Score"), winner Trophy correct, synthesis references all markets, verdict badge + actions render (never "insufficient data"), all-market news grouped top-3 each, per-market PillTabs each render a full single-market report.

**NEW 2026-07 sync:** the old `ComparisonSummaryV3.tsx` was deleted and replaced by three components — `ComparisonDeepDiveAccordion.tsx`, `ComparisonMetricTable.tsx`, `ComparisonVerdictHeader.tsx` — plus a new parallel "flash" report generation path and a seeded AI purpose `report_narrative_comparison`. Spot-check that the accordion/metric-table/verdict-header render correctly and that flash generation doesn't regress the synthesis quality checks above.

### Tour Persona Finales

`/tour` final step renders one of three persona finales (agent / investor / homebuyer) with distinct section order + hero label + AI-strategy framing. **Check for persona leakage** (agent finale must not say "cashflow/appreciation"; investor/homebuyer must not say "listing/farming/seller positioning"). Authed → PersonaSpringboard (Connect Claude + 4 workflow cards, unwatermarked report); anon → InlineSignupForm + watermark.

### Map Transitions

State → Metro → County → ZIP: data, legend, colors update correctly. If `NEXT_PUBLIC_CINEMATIC_ZOOM=true`: per-level pitch escalates, satellite fades in, ZIP shows 3D buildings + terrain, camera restores exactly on panel close; `prefers-reduced-motion` → instant, no 3D. Flag OFF = normal zoom (default).

---

## Phase 10: Responsive Design

`browser_resize` at 375x812, 768x1024, 1280x800. Every page readable, navigable, no overflow. Mobile breakpoint is `md:` (768px). Include new surfaces: `/analyzer` (collapses below 900px → mobile FAB input sheet), `/screener` (table horizontal-scroll / filter rail), `/compare` (RankingMatrix horizontal-scroll), `/home-v2` (8-beat funnel single-column at 375px, two-column desktop), `/blog`, `/markets`, `/compare/*`, `/about/terms`. On `/map` mobile, a region tap must open `RightDetailPanel` with the PropertyIQ score visible (mobile-only; desktop shows it in the left sidebar).

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
  - PropertyIQ ScoreWidget with label
  - NO floating confidence badges
  - "View on Interactive Map" CTA → `/map?geo=metro&region=[cbsaCode]`
  - "Full Market Dashboard" → `/market/[cbsaCode]?type=metro`
  - "More Markets in [State]" section
  - Newsletter signup
- Invalid slug returns 404

### 11.3 Competitor Comparison Pages + Hub

- **`/compare` hub** (NEW): 6 ranked tool cards + horizontal-scroll `RankingMatrix` (11 feature rows × 6 tools, PropertyIQ #1). **MCP/Claude row must show PropertyIQ=yes (green), competitors=no/partial** — this is PIQ's top differentiator; submit P1 if it's buried or missing.
- All 4 detail slugs load: `propertyiq-vs-biggerpockets`, `propertyiq-vs-mashvisor`, `propertyiq-vs-neighborhoodscout`, `propertyiq-vs-reventure` (static-generated)
- Feature comparison table highlights winners; MCP mentioned in prose
- Pricing table shows live DB prices (not hardcoded $39/$149)
- FAQ section renders correctly
- CTA button → `/pricing`; nav "Compare" link works
- Invalid slug returns 404

### 11.4 SEO Artifacts

- `/robots.txt` loads (generated dynamically by `app/robots.ts`), blocks `/admin`, `/auth`, `/api`, `/account`, `/dev`, `/betatest`
- `/robots.txt` includes AI bot rules for GPTBot, ClaudeBot, PerplexityBot
- `/sitemap.xml` generates valid XML with all routes (static + metros + blog + compare)
- `/blog/rss.xml` returns valid RSS XML
- OG image loads at `/og-image.png`
- Each public page has unique title + description metadata
- **`/blog` page must have metadata export** (currently missing — P1)
- Protected routes (`/dashboard`, `/alerts`, `/reports`, `/account`) must have `robots: { index: false }` metadata
- JSON-LD schema valid on blog posts (Article), metro pages (Place), comparison pages (FAQ), homepage (Organization + SoftwareApplication + WebSite), about (WebPage), contact (ContactPage)
- No `propertyiq.com` references in page source (should all be `propertyiq.app`)

### 11.5 AI Readiness & Security

- `/llms.txt` loads with summary guidance for AI crawlers
- `/llms-full.txt` loads with detailed guidance
- `/.well-known/security.txt` loads with contact info
- CSP headers configured correctly (check `next.config.mjs`)

### 11.6 Google Analytics

- `gtag('config', 'G-...')` fires on page load
- Page view events tracked on navigation

### 11.7 Programmatic SEO Pages (43,700+ pages — sample-based)

Full coverage is impractical. Sample-based smoke covering each route type:

| Slug type   | Sample URL                                                       | Verify                                              |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| Metro       | `/markets/[slug]` (e.g. `/markets/charlotte-nc`)                 | SSG renders, ScoreWidget loads, JSON-LD Place valid |
| County      | `/markets/county/[slug]` (e.g. `/markets/county/mecklenburg-nc`) | SSG renders, county-level scores, canonical present |
| ZIP         | `/markets/zip/[slug]` (e.g. `/markets/zip/28202`)                | SSG renders, ZIP-level data or graceful fallback    |
| State       | `/markets/state/[state]` (e.g. `/markets/state/north-carolina`)  | SSG renders, list of metros in that state           |
| State index | `/markets/state`                                                 | SSG renders, links to all 50 state pages            |

For each sample:

- Page renders without React error / 500
- `<title>` and `<meta name="description">` populated and unique
- JSON-LD schema validates (use `https://search.google.com/test/rich-results` or `<script type="application/ld+json">` regex check)
- No `metro-slug-data.ts` bundle bloat — page weight should be reasonable (<1MB JS)
- Internal links to other markets / national reports work

**Spot-check NEW programmatic SEO additions** (post-sync) by reading recent commits to `app/markets/`.

### 11.8 Newsletter & Lead-Magnet Pages

| Route                             | Verify                                                      |
| --------------------------------- | ----------------------------------------------------------- |
| `/newsletter`                     | Signup form, double opt-in flow (currently missing — P2)    |
| `/grade-reveal-signup`            | Signup-gated reveal screen renders, CTA works               |
| `/farm-area-audit`                | Form renders, submit returns success state                  |
| `/movers-report`                  | Form renders, MCP `monthly_market_update_email` integration |
| `/top-cashflow-report`            | Form renders, list rendering                                |
| `/dashboard/magnets` (auth-gated) | Lead-magnet library loads, downloads work                   |

---

## Phase 12: Enterprise Features & Data Export

Enterprise features are gated to Enterprise tier (or org-level access). Test with `?tier=enterprise` simulation or a real Enterprise account. Organization features require an org to be created first.

### 12.1 Data Export (Pro/Enterprise Gated)

Test the `export_csv` entitlement across all export surfaces. Switch tiers to verify gating.

**Map Table View Export:**

- Navigate to `/map` → select any metric → click "Table View" FAB (bottom-right)
- Modal shows sortable data table with search
- **Enterprise/Pro:** Footer shows "Export CSV" button with Download icon → click triggers `.csv` download
- **Free:** Footer shows "Export CSV" with Lock icon, button is visually muted and non-functional
- CSV contents: geography name, formatted value, raw numeric value, date
- Filename format: `{metric-name}-{geoLevel}-data.csv`
- Verify: CSV values match the table display values

**Top Markets Export:**

- Navigate to `/market` → "Top Markets" section
- **Enterprise/Pro:** Export button appears in section header → click triggers CSV download of current rankings
- **Free:** Export button shows Lock icon → click opens PaywallCard modal with "Unlock Data Export" title
- PaywallCard dismisses when clicking backdrop
- CSV includes: Rank, Location, Score, Grade, Geography columns
- Filename format: `top-markets-{scoreType}-{geography}[-{state}].csv`
- Change geo/score/state/limit filters → export reflects current filters

**Market Dashboard Share & Download:**

- Navigate to `/market/{id}` (e.g., `/market/31080?type=metro`)
- **Share button** (Share2 icon): Click copies current URL to clipboard (all tiers)
- **Download button:**
  - **Enterprise/Pro:** Download icon → opens browser print dialog (Save as PDF)
  - **Free:** Lock icon shown, no action on click
- Verify clipboard actually contains the correct URL after Share click

**Reports Share & Export Modal:**

- Navigate to `/reports` → open any report
- Click Share button (Share2 icon) → ShareReportModal opens
- **Copy share link:** Creates share token → copies URL → shows "Link copied!" → footer shows shared URL
- **Download PDF:** Triggers browser print / PDF download → modal closes
- **Export CSV:** Currently disabled (`reportData` not wired) — button should show but be non-functional
  - **Free:** Shows Lock icon + "Upgrade to Pro to export CSV"
  - **Enterprise/Pro:** Shows FileSpreadsheet icon but disabled (no data wired yet)
- **Print:** Opens browser print dialog → modal closes
- Re-opening modal shows previously generated share URL in footer
- Share link works when opened in incognito (public view-only)

### 12.2 Platform API v1

**API Documentation Page:**

- Navigate to `/docs/api` — page loads without errors
- Endpoint reference section lists all 7 platform API endpoints
- Code examples section shows valid request/response examples
- Verify endpoint descriptions match actual API behavior

**Platform API Endpoints (test via curl or Bash):**

All endpoints live at `/platform-api/v1/` and require an API key header.

```bash
# Test without auth → expect 401
curl -s http://localhost:3001/platform-api/v1/metrics/home_value/metro/31080 | head -c 200

# Test with valid API key → expect 200 with envelope response
curl -s -H "X-API-Key: {key}" http://localhost:3001/platform-api/v1/metrics/home_value/metro/31080 | head -c 500
```

**Endpoints to verify:**
| Endpoint | Expected |
|---|---|
| `GET /platform-api/v1/metrics/:metricId/:geoLevel/:geoId` | Metric value + metadata |
| `GET /platform-api/v1/metrics/bulk/:metricId/:geoLevel` | Array of all geos |
| `GET /platform-api/v1/timeseries/:metricId/:geoLevel/:geoId` | Historical data array |
| `GET /platform-api/v1/scores/:geoLevel/:geoId` | Score + confidence |
| `GET /platform-api/v1/rankings/:metricId/:geoLevel` | Ranked list |
| `GET /platform-api/v1/reports/:reportId` | Report data |
| `GET /platform-api/v1/watchlist/:userId` | Watchlist items |

**Rate Limiting:**

- Send 25+ rapid requests → should get 429 after rate limit exceeded
- Response should include rate limit headers

**Response Envelope:**

- All responses wrapped in `{ success: true, data: {...}, meta: {...} }` format
- Error responses: `{ success: false, error: { code, message } }`

**Score label check (RESOLVED 2026-07-04 — confirm the fix held):** Call `GET /platform-api/v1/scores/:geoLevel/:geoId` and inspect the `label` field. It should now return the canonical **momentum ladder** (VERY STRONG/STRONG/RISING/FIRMING/STEADY/EASING/WEAK/VERY WEAK), and a no-data/unrated market should return **`Unrated`** — NOT the old quality-word ladder (EXCELLENT/GREAT/GOOD/FAIR/AVERAGE/BELOW AVG/POOR/VERY POOR). The local `scoreToLabel()` was deleted (commit `b376e763`); the controller now calls shared `getScoreMomentumLabel()` from `packages/backend/src/scoring/score-label.util.ts`. Also spot-check generated content-pipeline copy — `content-data-adapters.ts` was fixed the same way. **If any quality word reappears, re-file as P1** (CLAUDE.md §9 violation).

### 12.3 API Key Management

**Prerequisites:** Create an organization first or use an existing one.

**Navigate to:** `/org/{slug}/admin/api-keys`

**Key Lifecycle:**

1. Click "Create API Key" → dialog opens
2. Enter name, select scopes (metrics, scores, reports, watchlist)
3. Submit → key displayed ONCE in a copy-able field
4. Verify: Key starts with `piq_` prefix
5. Copy the key → close dialog → key is no longer visible (one-time reveal)
6. Key appears in list with name, scopes, created date, last used

**Scope Enforcement:**

- Create key with only "metrics" scope
- Use key to call `/platform-api/v1/metrics/...` → 200
- Use key to call `/platform-api/v1/scores/...` → 403 (out of scope)

**Key Revocation:**

- Click revoke on a key → confirm → key removed from list
- Use revoked key → 401

**Auth Guard:**

- Invalid key format → 401
- Missing header → 401
- Expired/revoked key → 401

### 12.4 Embeddable Widgets

**Prerequisites:** Organization with branding configured.

**Embed Token Management (`/org/{slug}/admin/embeds`):**

1. Create embed token → dialog with type selection (score, metric-card, map)
2. Token created → code snippet shown (copy-able `<iframe>` or `<script>` tag)
3. Token appears in list with type, creation date, status

**Widget Rendering (test in browser):**

| Widget      | URL                                                              | Verify                                |
| ----------- | ---------------------------------------------------------------- | ------------------------------------- |
| Score       | `/embed/score/{geoLevel}/{geoId}?token={token}`                  | Score ring renders with correct value |
| Metric Card | `/embed/metric-card/{metricId}/{geoLevel}/{geoId}?token={token}` | Metric value + formatting correct     |
| Mini Map    | `/embed/map/{geoLevel}?token={token}`                            | Mapbox map renders with controls      |

**For each widget:**

- Valid token → widget renders with data
- Invalid/missing token → error state shown (not a crash)
- Custom branding applied (logo, accent color from org branding)
- Widget is self-contained (no navigation links to PropertyIQ app)

**CORS Verification:**

- Widget must be loadable in an `<iframe>` on a different domain
- Check response headers for `Access-Control-Allow-Origin`

### 12.5 Organization Branding

**Navigate to:** `/org/{slug}/admin/branding`

**Logo Upload:**

- Upload PNG/JPG → preview updates → logo appears in branding preview
- Upload SVG → should be REJECTED (XSS prevention)
- Upload oversized file → should show error
- Delete logo → preview reverts to default

**Accent Color:**

- Select color via picker → preview updates in real-time
- Color applies to: embed widgets, branded report headers

**Branding on Reports:**

- Generate a report while org branding is configured
- Report header should show custom logo and accent color
- Shared report (via token) should also show branding

### 12.6 Organization Admin Portal

**Navigate through each sub-page and verify access control:**

| Page      | URL                          | Auth Required | Verify                                    |
| --------- | ---------------------------- | ------------- | ----------------------------------------- |
| Dashboard | `/org/{slug}/admin`          | Org admin     | Loads, shows org overview                 |
| Billing   | `/org/{slug}/admin/billing`  | Org admin     | Shows plan, checkout, portal links        |
| Members   | `/org/{slug}/admin/members`  | Org admin     | Lists members, invite button, role change |
| Branding  | `/org/{slug}/admin/branding` | Org admin     | Logo + color + preview (see 12.5)         |
| API Keys  | `/org/{slug}/admin/api-keys` | Org admin     | Key list + create (see 12.3)              |
| Audit     | `/org/{slug}/admin/audit`    | Org admin     | Activity log with timestamps              |
| Embeds    | `/org/{slug}/admin/embeds`   | Org admin     | Token list + create (see 12.4)            |

**Access Control Checks:**

- Non-member accessing `/org/{slug}/admin` → should be blocked (403 or redirect)
- Org member (non-admin) → can view branding but NOT create keys, invite members, or modify billing
- Org admin → full access to all sub-pages

**Member Management:**

- Invite by email → invitation record created
- Accept invite at `/org/invite/{token}` → user added to org
- Change member role (admin ↔ member) → permissions update immediately
- Remove member → member loses access

**Organization Billing:**

- View current plan
- Checkout flow → Stripe (same pattern as individual billing)
- Portal link → Stripe customer portal

### 12.7 Enterprise Tier Gating Summary

Verify these features are ONLY available at the correct tiers:

| Feature                   | Free      | Pro                  | Enterprise           |
| ------------------------- | --------- | -------------------- | -------------------- |
| CSV Export (map, markets) | Lock icon | Works                | Works                |
| Market Dashboard Download | Lock icon | Print dialog         | Print dialog         |
| Report Share Link         | Works     | Works                | Works                |
| Report PDF Download       | Works     | Works                | Works                |
| Report CSV Export         | Disabled  | Shows but disabled\* | Shows but disabled\* |
| Platform API v1           | N/A       | N/A                  | Via API keys         |
| API Key Management        | N/A       | N/A                  | Via org admin        |
| Embeddable Widgets        | N/A       | N/A                  | Via org admin        |
| Organization Branding     | N/A       | N/A                  | Via org admin        |
| Organization Admin Portal | N/A       | N/A                  | Via org admin        |

\*Report CSV disabled in V1 — `reportData` not yet wired. Verify button renders but does nothing.

### 12.8 MCP Server + Personal API Keys (Pro tier — NEW since 2026-04)

Personal API keys are distinct from org-level keys (12.3). They live on the user account at `/account/api-keys` and gate access to `/api/v1/*` plus the MCP server.

**Personal API key CRUD (`/account/api-keys`):**

- Free tier: PaywallCard with "Upgrade to Pro" CTA
- Pro/Enterprise: full key management
- Create key: dialog appears with scope checkboxes; on submit, key shown ONCE in plaintext (one-time reveal), masked after dismiss
- Key prefix `piq_live_` is human-recognizable
- Revoke key: confirmation dialog → DELETE → key disabled within 30s (Redis-cached tier checks)
- List page: shows last-4 of each key + last-used timestamp + scopes

**Two-table validation:**

- `user_api_keys` table for personal Pro keys
- `org_api_keys` table for org Enterprise keys
- Both validated against same `/api/v1/*` endpoints; tier check via Redis cache (30s TTL)
- Submit P0 if a Free user can call `/api/v1/*` with any key

**MCP device-code OAuth flow:**

- User runs MCP client (Claude Desktop, Codex, etc.) → client requests device code
- `POST /api/auth/device-code/start` returns `device_code` + `user_code` + verification URL
- User visits `/activate` (UI for entering `user_code`) OR `/auth/mcp-authorize` (consent screen)
- After consent, MCP client polls `/api/auth/device-code/poll` with device_code → returns Bearer token once approved
- Verify: token grants MCP server access; revoking from `/account/api-keys` invalidates within 30s
- Verify: device-code expiry — unused codes expire (default 10 min); poll after expiry returns 410

**MCP server smoke (separate process):**

- `packages/mcp-server` runs as standalone process with HTTP transport (Railway-deployed)
- 12+ tools registered (search_markets, get_propertyiq_score, deal_analyzer, etc.)
- Free tier: most tools return `tier_required: pro` error
- Pro/Enterprise tier: all tools functional
- Verify: response schema matches MCP spec; tool descriptions accurate

**Routes for this section:**

- `/account/api-keys` (Pro auth-gated)
- `/activate` (user enters MCP `user_code`)
- `/auth/mcp-authorize` (consent screen)
- `/docs/mcp` (public setup docs)

**API endpoints:**

- `POST /api/auth/device-code/start` — anon
- `POST /api/auth/device-code/poll` — anon (rate-limited)
- `POST /api/auth/device-code/approve` — auth-gated (consent)
- `GET/POST/DELETE /api/user/api-keys` — Pro auth-gated

---

## Phase 13: Deal Analyzer v2 (NEW — flagship rebuild since 2026-05-04)

The analyzer was **rebuilt from scratch**. Frontend `app/(app)/analyzer/`; shared compute `packages/analyzer-core/`; backend `packages/backend/src/analyzer/`. It is **address/ZIP-driven** — market pages do NOT route into it (memory rule: Geos never enter the Deal Analyzer). There is **no `?piq_market=` param**; the only deep link is `?address=` (set by the analyzer on itself) and `?zip=`.

### 13.1 Routes & Free-Preview Cap

| Route                      | Auth          | Verify                                                                                                                  |
| -------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/analyzer`                | optional      | Loads anon; free works; Pro unlocks RentCast + AI                                                                       |
| `/analyzer?address=<addr>` | optional      | Auto-fires RentCast **only if Pro**; free sees prefilled field + must click Fetch (verify empty-state CTA points there) |
| `/analyzer/saved/[id]`     | JWT (NOT Pro) | Read-only saved snapshot                                                                                                |
| `/shared/analysis/[token]` | public        | PII stripped via RPC (no owner, no full address/lat-lon); org branding; `?print=1` = PDF source                         |
| `/analyzer/dev/*`          | optional      | Dev chart playgrounds — **publicly routable in prod (P3)**, flag if reachable                                           |

**Free-preview cap:** anon lifetime **3** on `GET /api/analyzer/market-context` (HMAC `piq_analyzer_uses` cookie). 4th anon call → **HTTP 402** `{error:"free_quota_exceeded"}`. Any authed user (incl. admin) bypasses via `Authorization: Bearer` header. Tampered cookie → resets to 0. **Submit P1 if an authed/Pro/admin user is ever blocked by the quota** (the middleware-runs-before-guards bug class). **HARDENED 2026-07-04 (`bd804081`):** the bearer bypass now requires a **JWT-shaped** token (`looksLikeJwt()` — 3 base64url segments, middle decodes to JSON with a string `sub`). Regression check: anon `Authorization: Bearer garbage` (not JWT-shaped) must now **count against the cap** (402 on the 4th call), not bypass it. A well-formed-but-forged JWT still bypasses — that's a documented, accepted residual, not a bug to file.

### 13.2 Strategies & A–F Grading

- **4 strategies:** Buy&Hold, Fix&Flip, BRRRR, Commercial MF (5+ units → buy&hold only; flip/BRRRR chips hidden).
- **2 modes** (`StrategyControls`): "I know my strategy" (focused inputs) vs "Help me decide" (compare + GoalPicker + StrategyCompare).
- **A–F grader:** per-metric letter → GPA → **PIQ market band adjustment** (±0.25/±0.50) → floors + auto-kills. Verify auto-kills fire (B&H: neg CF + DSCR<1.0, break-even >100%; Flip: profit <$5k, hold >24mo; BRRRR: refi can't cover hard-money balloon).
- **4 goals** (compare mode): cash_flow, long_term_wealth, fast_cash, recycle_capital. Verify:
  - GoalPicker chips (localStorage-persisted), BestPlayCallout reframes "Best for <goal>".
  - **"No fit for <goal>" warning** when no strategy scores, and **BEST ★ badge suppressed** (B&H scores 0 on recycle_capital by design).
  - StrategyCompare 3 view modes (3-up grid / single tab / winner+others).
  - Presets Conservative/Balanced/Aggressive (+ "Custom" badge when hand-edited + overwrite confirm modal).
  - Per-metric **upgrade paths** (only when grade ≠ A): smallest single-lever move per failing metric ("Reduce price by $18,500 (hard)"), clicking applies + re-grades.

### 13.3 The 7 Sections

Order: Projection → Expense (waterfall) → Sensitivity (tornado) → Comps (Mapbox + violin) → MarketContext (PIQ ring + geo pills) → AfterTax → Notes.

- **Comps** 3-level graceful degrade: ≥3 sqft comps → $/sqft violin; <3 sqft but ≥3 price → price-only histogram + warning; else empty diagnostic. Map hides when Mapbox token undefined OR coords null (degrade, never crash).
- **MarketContext** geo pills (Metro/County/ZIP) drop when geo unavailable; per-geo AI.
- **⚠️ Notes section is NOT persisted** (Known Issue P2): "Save" shows "Saved ✓" but notes + "Share with client" toggle are dead local state. Submit/confirm this.
- Every chart guards empty/NaN data (violin skips empty KDE; waterfall floors maxVal at 1). Verify no React error on a no-data ZIP.

### 13.4 AI Insights & Verdict

- Page load fires **ONE** `/ai-insights/batch` (all 6 sections), NOT 6 calls (the 429-storm fix). Verify only one request in DevTools.
- Per-section streaming annotations (blue italic, "Generating insight…", stale + refresh ↻ on cache hit). Gated `isPro && hasGradableInput` — no empty lightbulb shells.
- Header verdict (serif italic, animated caret, SSE). RefreshAllInsights batches stale.
- Goal change busts cache (`PROMPT_REVISION=v6`; goal in key for batch + recommendation_analysis).
- Provider default DeepSeek (`deepseek-v4-pro`), configurable via `ai_model_config`.
- **PIQ framing (enforce):** AI must say "probability signal / higher-or-lower CHANCE vs state average", and **must NOT cite a specific % outperformance** or treat ZHVI as a subject-property valuation (ZHVI = area index). Spot-check AI prose for violations → P2.
- **AI-verdict/header SSE status lies:** returns 200 the instant the stream opens; errors arrive as `data:{"error":...}` mid-stream. Don't treat 200 as success — read the stream body.

### 13.5 Prefill & Provenance

- Mapbox address autocomplete (250ms debounce, US-only, shows house number). Select → `/api/analyzer/prefill` → fields populate.
- **Per-field provenance stamps** (price, rentMonthly, taxAnnual, insuranceAnnual, hoaMonthly, vacancy, appreciation, rentGrowth): source name + "as of YYYY" + confidence grade/% + "inherited" badge when rolled up from a wider geo. Estimates omit the as-of.
- **Divergence:** field >30% off baseline shows a warning ("1.4× the market value"). RentCast resolved-address-mismatch banner when normalized resolved ≠ typed input. Free-tier ZHVI capped at confidence C.

### 13.6 Export / Share / Modes

- The old **Pro/Present/PDF 3-mode toolbar is GONE** — now two header pills: **PDF** + **Share** (both Pro-only; free → "sign in with Pro" prompt).
- Share modal: live iframe preview (~40vh), 3 channels (copy `{origin}/shared/analysis/{token}` / email / white-label PDF). Copy says recipients see branding + analysis but NOT the full address.
- PDF = Puppeteer render of `?print=1` with org branding (`DealAnalysis-<label>.pdf`).
- Backend caps to verify: ai-verdict payload >4KB → "payload too large" (500); RentCast ~45/mo cap → quota banner; 30d Redis cache.

### 13.7 Backend Endpoint Gating (curl)

- `GET /api/analyzer/property-lookup` / `POST /ai-verdict` / `/ai-insights/*` / `/save` → **Pro** (401/403 for free).
- `GET /api/analyzer/prefill`, `POST /grade*` → optional-auth (all tiers).
- `GET /api/analyzer/share/:token{,/branding}`, `POST /pdf/:token` → token, no auth.

---

## Phase 14: Market Screener (NEW since 2026-05-04)

Route `/screener` (in `(app)` group → **auth required**; any signed-in user, free or Pro). It is now a key **activation surface** (email drip Day 3/5 + onboarding checklist land here), so the first-run experience is load-bearing.

### 14.1 Gating (two surgical gates, NOT a full paywall)

- Free = full ranked table, all filters/sort/presets, **movers tab**, Metro + County. Pro adds **ZIP geography** + **CSV export**.
- **ZIP lock:** free user selecting ZIP → `GeoLockCard` ("ZIP Markets Require Pro"); query disabled.
- **RESOLVED 2026-07-02 — ZIP gate is now Pro-enforced server-side** via `assertGeoAllowed()` + `PRO_TIERS` check in `screener.controller.ts`. Verify `curl http://localhost:3001/api/screener/zip` as a free/anon user now returns 401/403, not data.
- **RESOLVED 2026-07-04 (live-DB verified) — the direct-Supabase ZIP-leak residual is CLOSED.** Queried prod (`pysflbhpnqwoczyuaaif`): `screener_snapshot` has RLS **enabled** with **0 policies**, so despite the `GRANT SELECT TO anon` (migration `20260615111801`) the table **fails closed** — empirically `SET ROLE anon; SELECT count(*)` returns **0 rows (0 ZIP)** of 33,781. A direct anon-key Supabase client cannot read ZIP screener data. The grant is inert/redundant. (No further probe needed unless a `CREATE POLICY ... FOR anon` is ever added, which would re-open the surface.)
- **CSV export** gated on `export_csv` entitlement — free sees disabled button + Lock; Pro downloads `screener-{geo}.csv` (12 cols incl. active-window `Score Δ`).

### 14.2 Table & Movers

- Columns sortable EXCEPT **Rent** (intentional — document so testers don't file it as a bug). Sort icon cycles, `aria-sort` set, table dims to `opacity-60` while fetching.
- Presets: hottest (auto-selected first mount), undervalued, cashflow, gainers, losers.
- Empty-state: 0 rows + active filters → active-filter summary chips + "Clear filters". Test the impossible-filter path (scoreMin 99 + scoreMax 1).
- **Movers tab:** window selector (1m/3m/6m/1y/3y/5y, default 3m), Top Gainers / Top Losers leaderboards (top 25), Δ with ▲/▼ + color. NULL-Δ regions excluded → verify 1m/3m lists aren't unexpectedly sparse. Reload-stability (deterministic tie-break Δ→score→name).

### 14.3 URL State & Deep-Links

`screener-url-state.ts` persists geo/tab/window/state/preset/sort/page/filter bounds (defaults omitted, `router.replace`). Verify the email deep-links restore: `/screener?scoreMin=70` (Day 3) and `/screener?sortBy=score&sortOrder=desc` (Day 5); test back-button + share-URL round-trips.

### 14.4 Data Freshness

- `screener_snapshot` refreshed monthly AFTER rescoring (each row carries `as_of` + `refreshed_at`). **No UI freshness indicator** beyond the CSV's "As Of" column (P2). If the snapshot is empty/stale, the UI shows a bare empty state with no warning — **the #1 first-run risk** since this is an activation landing. Submit P2 and recommend a "data as of <date>" stamp + a populated-or-fallback guarantee.

### 14.5 Activation Wiring

- `screener` is a coverage feature (`screener_filter` event → `user_events` → `GET /api/usage/coverage`). Dashboard `NextBestActionCard` ("Find your next market" → `/screener`).
- **⚠️ P3:** onboarding checklist `screen_markets` is NOT auto-completed by `screener_filter` (unlike `compare_markets`); needs a manual `POST /api/onboarding/checklist/screen_markets`. Verify whether using the screener actually checks the box.

---

## Phase 15: Agent-Readiness / Discovery Surface (NEW — zero prior coverage)

Makes PropertyIQ consumable by AI agents (Claude, ChatGPT, MCP clients, crawlers). Two origins: `www.propertyiq.app` (Next.js; frontend well-known paths are `/api/agent-discovery/*` handlers exposed at `/.well-known/*` via `next.config.mjs` rewrites) and `mcp.propertyiq.app` (Express MCP server; canonical, host-aware). **Test against production** (markdown methodology depends on file tracing that can differ from dev). MCP/Claude is PIQ's top differentiator — treat breakage here as high priority.

### 15.1 Well-Known Discovery Docs (both origins)

```bash
curl -s https://www.propertyiq.app/.well-known/api-catalog            # RFC 9727 linkset, application/linkset+json
curl -s https://www.propertyiq.app/.well-known/mcp/server-card.json   # SEP-1649 card
curl -s https://www.propertyiq.app/.well-known/oauth-authorization-server  # RFC 8414 + agent_auth block
curl -s https://www.propertyiq.app/.well-known/oauth-protected-resource    # RFC 9728
curl -s https://www.propertyiq.app/.well-known/agent-card.json             # NEW 2026-07 sync — A2A card
curl -s https://www.propertyiq.app/.well-known/agent-skills/index.json    # NEW 2026-07 sync — agent skills index
curl -s https://www.propertyiq.app/agent-skills/{name}/SKILL.md            # NEW 2026-07 sync — per-skill markdown
```

Verify:

- All four original endpoints return 200 + correct content-type (the rewrite for dot-prefixed paths works).
- `server-card.json` on www == on mcp host for `serverInfo`, `transport.endpoint`, `authentication.metadata`.
- **`agent_auth` block present** in BOTH `oauth-authorization-server` docs (www + mcp), all four sub-fields, `skill` → `https://www.propertyiq.app/auth.md`. The `agent_auth` anonymous method is now WorkOS-backed — verify the flow still resolves.
- On mcp host, `issuer` EXACTLY equals `https://mcp.propertyiq.app` (no trailing slash/port).
- **⚠️ Version drift (P2 — mitigated but not eliminated):** www card `version` (`manifest.ts`) and mcp `SERVER_INFO.version` (`server-info.ts`) are independently hardcoded `0.2.0` — confirm they match; flag if they've drifted. A `version-sync.test.ts` now catches divergence locally, but frontend tests aren't in CI, so a live curl check is still worthwhile.
- **NEW 2026-07 sync:** `/.well-known/agent-card.json` (A2A protocol) and `/.well-known/agent-skills/index.json` + per-skill `/agent-skills/:name/SKILL.md` — verify 200 + correct content-type, and that listed skills resolve.
- **NEW 2026-07-04 (`bd804081`):** the **short-path aliases** `/agent-skills/index.json` and `/agent-skills/:name/SKILL.md` (WITHOUT the `/.well-known/` prefix) now also return 200 (previously 404) — byte-identical to their `/.well-known/agent-skills/*` counterparts (routing-only `next.config.mjs` rewrites; no content change). Curl both path forms; they should match.
- **NEW 2026-07 sync:** client-side `WebMcpProvider` is mounted in the root `layout.tsx` — verify it doesn't throw or block hydration on any page.

### 15.2 `/auth.md` + Link header

```bash
curl -s https://www.propertyiq.app/auth.md | head -3        # text/markdown; H1 MUST literally contain "auth.md"
curl -sI https://www.propertyiq.app/ | grep -i ^link        # rel="api-catalog" + rel="service-doc"
```

The H1 containing "auth.md" is an audit-checker target — submit P1 if missing.

### 15.3 Markdown Content Negotiation

```bash
# Should return markdown (starts with "# "):
curl -s -H "Accept: text/markdown" https://www.propertyiq.app/pricing
curl -s -H "Accept: text/markdown" https://www.propertyiq.app/scores/methodology   # full validation-report.md
curl -s -H "Accept: text/markdown" https://www.propertyiq.app/blog/<real-slug>
# Negative control — NO header → HTML (<!DOCTYPE html>):
curl -s https://www.propertyiq.app/scores | head -1
# Headers on markdown responses:
curl -sI -H "Accept: text/markdown" https://www.propertyiq.app/pricing | grep -iE "content-type|vary|x-markdown-tokens"
```

Honored routes: `/blog/[slug]`, `/scores/methodology`, and curated `/`, `/markets`, `/pricing`, `/scores`. Must carry `Vary: Accept`. Test methodology markdown in **prod** (file-tracing dependency → could 404 in prod while HTML still renders).

### 15.4 robots.txt + MCP host

```bash
curl -s https://www.propertyiq.app/robots.txt | grep -i "content-signal"   # search=yes, ai-input=yes, ai-train=no (in * group only)
curl -s https://mcp.propertyiq.app/health                                   # {status:"healthy"}
curl -s https://mcp.propertyiq.app/mcp                                       # unauth JSON-RPC discovery probe
curl -s https://mcp.propertyiq.app/api/openapi.json | head -c 200           # single invoke_tool + list_tools op
curl -sI -H "Host: bogus.example" https://mcp.propertyiq.app/api/tools      # expect 421 (host allowlist; /health exempt)
```

Also: bare apex `propertyiq.app/...` and the Railway alias should 301/308 → `www`.

---

## Known Code-Level Issues

**Submit ALL of these as `category: 'bug'` at the start of each testing session if not already tracked.**

Check `.claude/beta-test/change-log.md` for additional issues discovered by the sync process.

### Security (P0)

No outstanding P0 security issues (re-verified 2026-07-04). **A live P0 was found AND fixed inside the 2026-07-02→07-04 window:** the `/api/admin/*` **Next.js API route handlers** had **no auth at all** — the page-level `/admin` middleware guard matched `/admin` but not `/api/admin`, so an anonymous caller could read every beta-tester token and read/mutate/delete feedback via the service-role client (these are the exact `/api/admin/testers` + `/api/admin/feedback` endpoints THIS skill uses). Fixed by an `isAdminUser()` middleware guard in `packages/frontend/middleware.ts` returning JSON 401 (unauth) / 403 (non-admin), plus a `/api/admin/:path*` matcher entry closing a static-suffix bypass (`.../feedback/<id>.json`). Commit `b376e763`. **Regression check (add to Phase 8.1):** anon `GET /api/admin/testers/<id>` and `/api/admin/feedback/<id>.json` → 401; authed non-admin → 403; authed admin unaffected.

The 4 previously-unguarded backend admin routes (`ml-workflow`, `scores/validation`, `backtest-runs`, `ml-validation`) all still have `@UseGuards(AdminGuard)`. Three endpoints _look_ unguarded but are correct by design — do NOT add a guard to these (it would break the flow) and do NOT file them:

- `GET /api/admin/content-pipeline/platforms/:platform/oauth-callback` (OAuth redirect URI, protected by HMAC-signed `verifyState()` with nonce + 10-min TTL)
- `GET /api/admin/content-pipeline/platforms/:platform/oauth-callback`'s sibling under the same controller — confirmed same protection
- `GET /api/internal/short-links/*` (public redirect resolver by design, non-PII)

### Discovered 2026-07-04 (Redfin Data Center metrics + remediation residue)

| Severity   | Issue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Where                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| P1/P2      | **The 5 new Redfin Data Center metric cards have no provenance tooltip.** None of the 5 IDs (`sold_above_list_share`, `listings_delisted_share`, `pending_cancellation_share`, `investor_market_share`, `all_cash_share`) have a `METRIC_DEFINITIONS` entry in `lib/data/definitions.ts`, so `MetricTitle` renders **no info icon at all** (`hasTooltip = showTooltip && !!metricDef`). This violates Phase 1's "every number traceable" principle. Even if a tooltip rendered, the "As of" date would read **"Dec 2025"** (`DATA_DATES.redfin = "2025-12-01"`) while the data was refreshed to 2026-05-31 (monthly) / Q1-2026 (quarterly) — unless `useMetricFreshness` overrides with the live resolved date. **Test:** click the info icon on each of the 5 cards on `/map` (Pro tier) — confirm whether an icon appears at all, and if so whether the date is current.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `packages/frontend/lib/data/definitions.ts` (missing entries), `packages/frontend/lib/data/registry.ts:64` (`DATA_DATES.redfin`) |
| P3         | **Latent landmine — retired quality-word ladder still lives in the video template.** `scoreTierLabel()` returns EXCELLENT/GREAT/GOOD/FAIR/AVERAGE/BELOW AVG/POOR/VERY POOR for a PropertyIQ-score input. It's imported into `ScoreReveal.tsx` + `Comparison.tsx` but is a **dead import** in both (never invoked — only `scoreTierColor()` is used), so not user-facing today. Reintroduces the CLAUDE.md §9 violation the instant anyone wires it to a caption. Redirect to `getScoreMomentumLabel` or delete.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `packages/video-template/src/constants.ts:59-68`                                                                                 |
| P2 (watch) | **Dual category-wiring for map metrics.** A new map metric must be registered in BOTH `app/map/config/metric-categories.tsx` (sidebar) AND the hardcoded `getMetricCategory()` in `app/(app)/map/components/MetricSelector.tsx` (graphs page + map `RightDetailPanel` selector). The Redfin DC set updated both correctly, but it's an easy one-and-miss-the-other bug — verify both surfaces when new metrics land.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `metric-categories.tsx`, `MetricSelector.tsx`                                                                                    |
| P1/P2      | **Redfin DC data is mis-keyed to the wrong CBSA for ~8 major metros (live-DB + live-MCP verified 2026-07-04).** The `redfin_dc_housing_market_metro` (+ sibling) tables store some metros under a numeric `region_id` that the platform maps to a **different city**, so the 5 Redfin DC cards silently vanish on the correct metro's page and appear (mislabeled) on the collision metro's page. **Confirmed live via prod MCP:** Charlotte NC (`16740`) → **no** Redfin DC cards; Charlottesville VA (`16820`) serves them (Redfin filed "Charlotte, NC" under `16820`, which is Charlottesville's CBSA). Same class: Detroit→`19810` (Detroit Lakes MN), Kansas City→`11680` (Arkansas City KS), Philadelphia→`35420` (New Philadelphia OH), Portland OR→`38860` (Portland ME), Washington DC→`47920` (Washington Court House OH), Frederick MD→`23240`, Warren MI→`49660`. Plus 5 `REDFIN-METRO-*` string-keyed divisions (Gary IN, Lake County IL, Montgomery County PA, Nassau County NY, New Brunswick NJ) with no served CBSA → silently blank. **Test:** on `/map` + `/markets` (Pro tier), confirm Charlotte / Detroit / Philadelphia / DC / Kansas City / Portland-OR show the 5 cards — today they are blank. **Fix:** correct the Redfin DC metro import crosswalk (Redfin region → canonical CBSA) before upsert. Extends the known `redfin_dc` mis-key note (Charleston `16620`) to the live display metrics. | `redfin_dc_housing_market_metro` + siblings (DB); Redfin DC metro import crosswalk                                               |

**Resolved 2026-07-04 (verified fixed — do not re-file):**

- ~~P1 Score labels emit old quality-word ladder on 2 backend surfaces~~ — both `platform-api/v1/scores.controller.ts` and `content-pipeline/data/content-data-adapters.ts` now call shared `getScoreMomentumLabel()` (`scoring/score-label.util.ts`); no-data default `'VERY POOR'` → neutral `'Unrated'` (commit `b376e763`). Confirm via Phase 12.2.
- ~~P0 `/api/admin/*` Next.js route handlers unguarded~~ — `isAdminUser()` middleware guard added (`b376e763`); see Security (P0) above.
- ~~P2 DTO validation missing on `entitlements/events` + `data-ingestion` POSTs~~ — `TrackEventDto` + 5 `Import*Dto` added (`bd804081`); malformed bodies now 400 from the global `ValidationPipe`.
- ~~Analyzer free-preview `Bearer <anything>` bypass~~ — now requires a JWT-shaped bearer (`looksLikeJwt()`); `Bearer garbage` counts against the 3-use cap (`bd804081`). See Phase 13.1.
- ~~Admin Command Center display bugs~~ — cache "4284.8%" clamped, Score Health no-data now em-dash, HUD FMR "-182d" clamped (`bd804081`). See Phase 8.2.
- ~~Reports show real data as "Data Unavailable"~~ — `months_of_supply`, `sale_to_list`, `net_migration` now resolved via `MetricResolutionService`; `sale_to_list` ×100 unit fix (`d18b37f8`). See Phase 2.5.
- ~~Stale `propertyiq_score` source copy ("3 Redfin indicators" / "PropertyIQ v4 (Redfin)")~~ — corrected to "PropertyIQ (Zillow ZHVI + Realtor.com)" in `definitions.ts` (`df1465ae`); consumed by ~15 frontend files.
- ~~Agent-skills short paths 404~~ — `/agent-skills/index.json` + `/agent-skills/:name/SKILL.md` now 200 (`bd804081`); byte-identical to `/.well-known/agent-skills/*`. See Phase 15.1.

### Discovered 2026-07-02 (Score Label Consistency — RESOLVED 2026-07-04)

| Severity        | Issue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Where                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~P1~~ RESOLVED | **~~Score labels show the old quality-word ladder on two live surfaces~~** — FIXED 2026-07-04 (commit `b376e763`). Both the public **Platform API v1** `GET /api/v1/scores/:geoLevel/:geoId` (`scoreToLabel()` deleted) and AI-generated content-pipeline copy (`scoreLabel()` deleted) now call shared `getScoreMomentumLabel()` from `packages/backend/src/scoring/score-label.util.ts` — momentum ladder (VERY STRONG…VERY WEAK); no-data default `'VERY POOR'` → neutral `'Unrated'`. Confirm still fixed via Phase 12.2. | `packages/backend/src/scoring/score-label.util.ts`, `platform-api/v1/scores.controller.ts`, `content-pipeline/data/content-data-adapters.ts` |
| P3 (still open) | Cosmetic-only, no user impact: `ScoreDisplay-utilities.test.ts:99-139` still asserts the old quality-word labels (would fail if the suite ran — frontend tests aren't in CI, so this fails silently; **neither remediation commit touched it**); `EmbedScoreRing.tsx:52` has a stale JSDoc comment only (the actual render is correct). See also the new video-template landmine in the 2026-07-04 section above.                                                                                                             | `app/components/scoring/__tests__/ScoreDisplay-utilities.test.ts`, `app/embed/components/EmbedScoreRing.tsx`                                 |

### Discovered 2026-06-26 (Analyzer v2 / Screener / Scoring / Agent-Discovery)

| Severity | Issue                                                                                                                                        | Where                                                                   | Status                                                                                                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2       | **Agent-discovery version drift risk** — www card + MCP server-info both hardcode `0.2.0` independently; www can report a stale MCP version. | `lib/agent-discovery/manifest.ts` + `mcp-server/src/lib/server-info.ts` | Mitigated 2026-07-02: `lib/agent-discovery/version-sync.test.ts` now fails the build if the two diverge — but frontend tests aren't wired into CI, so this is a local safety net, not a hard guarantee. Still worth a periodic manual diff. |
| P3       | **Analyzer dev playground routes** (`/analyzer/dev/*`) shipped + publicly routable in prod.                                                  | `app/(app)/analyzer/dev/*`                                              | Still open, unchanged.                                                                                                                                                                                                                      |
| P3       | **`screen_markets` checklist not auto-completed** by `screener_filter` (needs manual `POST /api/onboarding/checklist/screen_markets`).       | onboarding checklist                                                    | Still open, unchanged.                                                                                                                                                                                                                      |
| P3       | Files near limit: `analyzer.service.ts` 295/300, `InputPanel.tsx` 376/400, `CompsSection.tsx` 392/400, `lib/data/index.ts` 285/300           | various                                                                 | `ScreenerPageInner.tsx` improved 390→379 (dropped off this list); `lib/data/index.ts` grew slightly (281→285), still under hard limit.                                                                                                      |

**Resolved 2026-07-02 (beta-test backlog closeout — verified, no longer needs testing focus):**

- ~~Screener ZIP gate frontend-only~~ — now Pro-enforced server-side via `assertGeoAllowed()` + `PRO_TIERS` in `screener.controller.ts`. **Residual CLOSED 2026-07-04 (live-DB verified):** `screener_snapshot` RLS is enabled with 0 policies → `SET ROLE anon` returns 0 rows; the `GRANT SELECT TO anon` is inert (fails closed). No live ZIP leak.
- ~~Stale scoring version naming (`FORMULA_VERSION='v3.0'`)~~ — now `FORMULA_VERSION = 'PropertyIQ demand signal'` (`formula-weights.ts:645`); example payload in post-split `scoring-operations.controller.ts:108` also fixed.
- ~~Analyzer NotesSection not persisted~~ — `onSave` now wired to `onNotesChange()`/`onSaveNotes()` in `AnalyzerSections.tsx:184-187`.
- ~~Two file-size hard-limit violations (reports)~~ — `reports/page.tsx` 1104→283 lines, `ReportViewer.tsx` 477→336 lines (9 components extracted).
- ~~Screener has no UI freshness indicator~~ — new `ScreenerHeader.tsx` renders "Data as of {date}".
- ~~Tour `?next=` post-signup redirect not honored~~ — `PostSignupCelebrate.tsx` now reads and validates `?next=` before routing.

**Document-don't-file (intentional behaviors that look like bugs):** Screener Rent column is not sortable; analyzer/screener public market endpoints are non-PII by design; AI-verdict/header SSE return 200 before the upstream call (status is not a health signal); robots Content-Signal is only in the `*` group.

### Data Provenance (P1) — All Resolved

- MetricTitle info icon now shows actual source, fallback, and inheritance data on all data-display surfaces (graph QuickCards wired, MarketSnapshot, RightDetailPanel, reports already wired)
- `InheritedBadge` is actively rendered in 7 files
- Backend `ResolvedMetric` metadata IS passed via market-snapshot API
- AI insights `execute` endpoint does NOT exist — system is advisory-only (copy prompt, dismiss, mark implemented)

### SEO & Metadata (P1) — All Resolved

- `/blog` page.tsx now has full metadata export (title, description, OG, Twitter)
- Protected routes now have `robots: { index: false }` via layout files

### Enterprise Features (P2)

| Issue                                                                   | Where                        | Status                     |
| ----------------------------------------------------------------------- | ---------------------------- | -------------------------- |
| `CreateApiKeyDialog.tsx` is 382 lines (approaching 400-line hard limit) | `/org/[slug]/admin/api-keys` | Monitor                    |
| `CreateEmbedDialog.tsx` is 374 lines (approaching 400-line hard limit)  | `/org/[slug]/admin/embeds`   | Monitor                    |
| `MarketDashboard.tsx` is ~715 lines (over 400-line component limit)     | `/market/[id]`               | Header extraction deferred |
| Report CSV export disabled — `reportData={null}` needs data flattening  | ShareReportModal             | Follow-up task             |
| Report share link expiry UI deferred (backend supports `expiresInDays`) | ShareReportModal             | Follow-up task             |
| Platform API v1 rate limit response headers not documented              | `/docs/api`                  | Add docs                   |

### Data Consistency (P2)

| Issue                                                          | Where                             | Status                |
| -------------------------------------------------------------- | --------------------------------- | --------------------- |
| `useDataCardBatch` silently filters null values                | Card grids showing fewer items    | Needs design decision |
| No retry on failed API calls                                   | Network blips → permanent error   | Needs design decision |
| Inconsistent loading (skeleton vs `...` vs `--`)               | Slow network testing              | Needs design decision |
| Report `metricHelpers.ts` duplicates backend fallback logic    | Report values may differ from map | Needs consolidation   |
| Blog category filter uses anchor links that don't filter       | `/blog` page                      | Needs UX redesign     |
| `metro-slug-data.json` is oversized (6,500+ entries in bundle) | `/markets/[slug]` bundle          | Needs data split      |
| Newsletter has no double opt-in / email verification           | Newsletter signup flow            | Needs email infra     |
| Compare page `withLivePricing()` regex replacement is fragile  | `/compare/[slug]`                 | Low risk, monitor     |
| Some POST endpoints lack DTO validation                        | `data-ingestion`, `entitlements`  | Add DTOs              |

**Resolved consistency items:**

- Hardcoded `"--"` null placeholders replaced with `"—"` (em-dash) across DataTable, CompositeResults, HistoryTab
- Compare page catch block now logs with context prefix
- Sitemap `lastModified` now uses fixed date instead of `new Date()`
- Newsletter API route already has rate limiting implemented
- Backend API rate limiting enabled via ThrottlerModule (20/sec, 100/min, 500/10min)

### Polish (P3)

| Issue                                           | Where                 |
| ----------------------------------------------- | --------------------- |
| No WebSocket push for admin tier changes        | Stale user sessions   |
| System health status is mocked (always healthy) | `/admin` banner       |
| GA measurement ID hardcoded as fallback         | `GoogleAnalytics.tsx` |

### Activation Tour (P1-P3) — Discovered 2026-05-04

| Severity | Issue                                                                                                                                                                 | Where                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| P1       | `primary-dark` Tailwind class undefined; `bg-primary-dark` / `text-primary-dark` silently render no color                                                             | `app/globals.css` (missing token) — referenced in CLAUDE.md §8.2 brand spec and many components                                 |
| P1       | New hooks must be re-exported in BOTH `lib/data/hooks/index.ts` AND top-level `lib/data/index.ts`                                                                     | `lib/data/index.ts` — caught `useTourSignup` miss in this sync (commit `24477f56`)                                              |
| P1       | Calling `router.*` from inside a `setState` updater throws React 19 "Cannot update component while rendering" — pattern to forbid                                     | Audit pattern: `setSession((prev) => { router.replace(...); ... })` is a defect — fixed in `ee20ae4e`                           |
| P2       | `SeoTourCta` shipped with full test coverage but NOT integrated into blog `/blog/[slug]` MDX layout                                                                   | `components/tour/SeoTourCta.tsx` + `app/blog/[slug]/BlogPostContent.tsx` — frontmatter schema needs `geoId/geoLevel/marketName` |
| P2       | `ReportSection.data` is `unknown`-typed; `ListingPresentation` uses `as React.ComponentProps<typeof X>` casts to compile                                              | `lib/data/fetchers/anonymous-listing-presentation.ts` (root) + `app/tour/components/ListingPresentation.tsx` (workaround)       |
| P2       | `?next=` query param is preserved through persona/market steps but NOT consumed past `step1`                                                                          | `app/tour/page.tsx` — Phase 03/04 TODO comment in code                                                                          |
| P3       | Tour migrations applied via direct `psql` against pooler with hardcoded credentials in `scripts/run-backtest-*.sh`                                                    | Convention works but credentials are committed; not using Supabase CLI / dashboard                                              |
| P3       | `lib/data/index.ts` is 242 lines (target 200, hard 300)                                                                                                               | Needs split before adding more hooks                                                                                            |
| P3       | Step4Aha uses `window.location.href` (not `router.push`) for rate-limit signup redirect — intentional (clears RQ cache + cookies) but undocumented for casual readers | `app/tour/components/Step4Aha.tsx:65`                                                                                           |

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

| Field         | Source                                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | Sequential (F-001, F-002, ...)                                                                                                                                                      |
| `feedback_id` | The UUID returned by the POST `/api/betatest/feedback` response during submission. If not available (standalone fix), set to `null` — fuzzy matching resolves it later (see below). |
| `severity`    | P0 / P1 / P2 / P3                                                                                                                                                                   |
| `title`       | Short description from feedback submission                                                                                                                                          |
| `category`    | bug / workflow / ux_ui / performance                                                                                                                                                |
| `where`       | File path or component name                                                                                                                                                         |
| `phase`       | Which testing phase discovered it                                                                                                                                                   |
| `risk_level`  | `safe` / `needs_confirmation` (see Safety Gates)                                                                                                                                    |
| `description` | Full description including steps to reproduce                                                                                                                                       |

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

**Update Feedback Tracker:** Before invoking systematic debugging for each finding, update its feedback status to `in_progress`. This signals on `/admin/feedback` that the item is actively being worked on.

```bash
# If feedback_id is known (from session submission):
curl -s -X PATCH http://localhost:${TEST_PORT}/api/admin/feedback/{feedback_id} \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

**If `feedback_id` is null** (standalone fix outside a full testing session), resolve it via fuzzy matching before updating:

1. Fetch open feedback: `curl -s http://localhost:${TEST_PORT}/api/admin/feedback`
2. Filter to actionable statuses: `submitted`, `triaged`, `in_progress`. Exclude `fixed`, `deployed`, `wont_fix`, `duplicate`.
3. Score each item against the finding's title + description using keyword overlap on `title` (highest weight), `description`, `page_url`, `affected_component`.
4. Pick the best match. Ties broken by oldest `created_at` (first reported = canonical entry).
5. Announce: _"Matched to feedback: [title] (id: [id], status: [current_status])"_
6. If no match scores above threshold, skip the tracker update silently — the fix isn't feedback-related.
7. Assign the resolved `feedback_id` and PATCH to `in_progress` as above.

If the PATCH fails (404, 500), log the error and continue — do NOT block the fix on a tracker update failure.

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

**Update Feedback Tracker:** For each successfully fixed finding, update its feedback status to `fixed` with a commit reference and admin note:

```bash
curl -s -X PATCH http://localhost:${TEST_PORT}/api/admin/feedback/{feedback_id} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "fixed",
    "fix_reference": "{commit_sha}",
    "admin_notes": "Auto-fixed: {one-line root cause summary}"
  }'
```

**Status update rules:**

| Finding Outcome                   | Tracker Update                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| Fixed automatically               | `status: "fixed"`, `fix_reference: "<sha>"`, `admin_notes: "Auto-fixed: <root cause>"` |
| Fixed after confirmation          | Same as above                                                                          |
| Deferred (user declined)          | No update — leave current status                                                       |
| Unfixable (needs design decision) | No update — leave current status                                                       |

Get the commit SHA via `git rev-parse --short HEAD` after the fix is committed.

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

=== Feedback Tracker Updates ===
Updated to in_progress: X
Updated to fixed: X
  - [feedback_id]: [title] → fixed (ref: abc1234)
  - [feedback_id]: [title] → fixed (ref: def5678)
Unmatched (no tracker item found): X
Unchanged (deferred/unfixable): X
```

### Step 6: Verification Pass

After all fixes are applied:

1. Run the project's linter and type checker (`npm run lint && npm run type-check` in both packages)
2. Run existing tests (`npm test` in both packages)
3. If any fix broke something, apply the systematic debugging process to the regression — do NOT revert blindly
4. Summarize: "All X fixes verified — lint clean, types clean, tests passing"

**If verification fails on a `safe` fix:** That fix was misclassified. Revert it, reclassify as `needs_confirmation`, and present to the user.

---

## Fix from Tracker Mode

**Use when:** You want to work through open feedback items from `/admin/feedback` without running a full testing session. Invoke by saying "fix the open feedback items", "work through the tracker", or similar.

### Procedure

1. **Fetch all open feedback:**

   ```bash
   curl -s http://localhost:${TEST_PORT}/api/admin/feedback
   ```

   Filter to actionable statuses: `submitted`, `triaged`, `in_progress`.

2. **Sort by priority:**
   - Severity: `critical` → `high` → `medium` → `low`
   - Within same severity: oldest `created_at` first

3. **Present summary:**
   Output: _"Found X open feedback items: Y critical, Z high, W medium, V low"_

4. **Work through items in priority order.** For each item:

   a. PATCH status to `in_progress`:

   ```bash
   curl -s -X PATCH http://localhost:${TEST_PORT}/api/admin/feedback/{id} \
     -H "Content-Type: application/json" \
     -d '{"status": "in_progress"}'
   ```

   b. Invoke `superpowers:systematic-debugging` with full context from the feedback item:
   - Title as the bug description
   - `steps_to_reproduce` as reproduction steps
   - `page_url` as where to look
   - `affected_component` as starting point for code investigation
   - `description` as full context

   c. Apply the same Safety Gates from Auto-Remediation Step 2: Classify Risk Level (`safe` vs `needs_confirmation`)

   d. On fix verified:

   ```bash
   curl -s -X PATCH http://localhost:${TEST_PORT}/api/admin/feedback/{id} \
     -H "Content-Type: application/json" \
     -d '{
       "status": "fixed",
       "fix_reference": "{commit_sha}",
       "admin_notes": "Auto-fixed: {root cause summary}"
     }'
   ```

   e. On deferred or unfixable: leave status unchanged (still `in_progress` — admin can triage)

5. **Output remediation report** using the same format from Step 5 above, including the Feedback Tracker Updates section.

### Batching

Same rule as auto-remediation: if multiple feedback items share a root cause, investigate once and fix the root cause. Update ALL matched items to `fixed` with the same `fix_reference`.
