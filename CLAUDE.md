# PropertyIQ Platform

Real estate analytics platform with React/Next.js frontend and NestJS backend.

## 1. CRITICAL BEHAVIORAL STANDARDS

### 1.0 The Hermeneutic Circle (How to Approach All Changes)

Before touching any file, understand the whole system first. Then examine the specific part. After changing, re-evaluate the whole — do imports resolve? Do consumers still work? Do types align? Repeat until the change is fully integrated. Never make changes in isolation.

**The loop:** Understand whole → Examine part → Make change → Re-evaluate whole → Repeat if breakage found.

### 1.1 The "Don'ts" (Strict Constraints)

- **NEVER** duplicate metric names/formats. `config/metrics.ts` is the **ONLY** source of truth.
- **NEVER** hardcode color scale breakpoints; use dynamic min/max calculations.
- **NEVER** create separate API methods for each metric; always use the unified `fetchMetricData`.
- **NEVER** format values manually; use `formatValue()` or `formatTooltipValue()` from utils.
- **NEVER** hardcode zoom levels; use `GEO_ZOOM_LEVELS` from `config/metrics.ts`.
- **NEVER** write ad-hoc metric fallback logic in backend services. All metric source fallbacks and geography inheritance MUST go through `MetricResolutionService`. See **Section 5.1**.

### 1.2 Security & Data Protection (Strict)

- **RLS is Supreme:** NEVER implement row-level security in application layer if it can be done in Supabase RLS policies.
- **Client vs. Server:** NEVER fetch sensitive data (PII, billing) in Client Components (`'use client'`).
- **Trust No One:** Every API endpoint (NestJS) and Server Action (Next.js) MUST validate input using Zod or `class-validator`.
- **No Defaults:** NEVER hardcode fallback values for secrets (e.g., `process.env.KEY || 'default'`). App MUST crash if a secret is missing.
- **Exposure:** NEVER expose `service_role` keys to the client.

### 1.3 Architecture & Modularity (File Size Limits)

| File Type                  | Target     | Hard Limit    | Action            |
| -------------------------- | ---------- | ------------- | ----------------- |
| Logic files (hooks, utils) | <200 lines | **300 lines** | MUST split        |
| React components           | <300 lines | **400 lines** | MUST split        |
| Test files                 | <400 lines | **500 lines** | Split by describe |

At hard limit: analyze logical components → propose refactor plan → execute split. One exported component per file with its local helpers. 2+ exports = must split regardless of line count.

### 1.4 Naming Convention (Human-Readable Names)

**Every name MUST be descriptive and self-explanatory** — files, branches, variables, functions, tests, migrations, everything. If someone sees it 6 months later with no context, they should understand immediately.

| Bad                       | Good                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| `utils2.ts`, `helper.ts`  | `scoring-engine.ts`, `timeseries-region-filter.ts`                |
| `feature-1`, `dev-branch` | `feat/report-share-buttons`                                       |
| `d`, `tmp`, `val`         | `regionScores`, `filteredMetrics`                                 |
| `process()`, `handle()`   | `calculatePercentileRange()`, `formatCurrencyValue()`             |
| `describe('test 1')`      | `describe('ScoreWidget renders confidence badge for each level')` |

### 1.5 Parallel Agents & Agent Teams

**Default to parallelism.** When 2+ independent subtasks exist, dispatch parallel agents. Keep main context clean.

**When:** Multi-file implementations, research across packages, cross-package changes, bulk operations, test+lint+build verification.

**Agent type selection:**
| Task | Agent Type |
|------|-----------|
| File search / exploration | `Explore` |
| Implementation planning | `Plan` |
| Running commands | `Bash` |
| Multi-step coding/research | `general-purpose` |
| Code review | `superpowers:code-reviewer` |

### 1.6 Background Validation Agents

**After implementation, dispatch validation agents in background.** Don't interrupt flow — only surface CRITICAL/WARNING issues.

| Trigger                  | Agent(s)                 |
| ------------------------ | ------------------------ |
| Feature implemented      | `code-reviewer`          |
| Frontend data fetching   | `data-layer-reviewer`    |
| Backend controllers      | `dto-validation-auditor` |
| Auth/payments/secrets    | `security-reviewer`      |
| Large files (>200 lines) | `file-size-compliance`   |

Don't stop mid-implementation, don't ask "should I run validation?", don't report "all passed" unless asked.

### 1.7 Skill Suggestions

After completing a task, suggest relevant skills in ONE line. Don't invoke automatically.

> Might be useful: `/gen-tests` for the new service, `/gen-swagger` to add API docs.

### 1.8 Core Principles

- **Simplicity First:** Make every change as simple as possible. Impact minimal code.
- **No Laziness:** Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact:** Changes should only touch what's necessary. Avoid introducing bugs.

---

## 2. WORKFLOW ORCHESTRATION

### 2.1 Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Write detailed specs upfront to reduce ambiguity

### 2.2 Self-Improvement Loop

- **Read `tasks/lessons.md` at session start** — hard-won rules from past mistakes.
- After ANY correction: update `tasks/lessons.md` with the pattern.

### 2.3 Verification Before Done

- Never mark a task complete without proving it works
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 2.4 Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- Skip this for simple, obvious fixes — don't over-engineer

### 2.5 Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding.
- Zero context switching required from the user.

---

## 3. TASK MANAGEMENT

1. **Plan First:** Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan:** Check in before starting implementation
3. **Track Progress:** Mark items complete as you go
4. **Explain Changes:** High-level summary at each step
5. **Document Results:** Add review section to `tasks/todo.md`
6. **Capture Lessons:** Update `tasks/lessons.md` after corrections

---

## 4. PROJECT ARCHITECTURE & STACK

### 4.1 Technology Stack

| Layer            | Technology               | Version      |
| ---------------- | ------------------------ | ------------ |
| Frontend         | Next.js (App Router)     | 16.1.1       |
| UI Library       | React                    | 19.2.0       |
| Styling          | Tailwind CSS             | 4.0          |
| Mapping          | Mapbox GL + react-map-gl | 3.17.0       |
| Backend          | NestJS                   | 11.0.1       |
| Database         | Supabase (PostgreSQL)    | Cloud-hosted |
| Caching          | Redis (ioredis)          | 5.9.1        |
| State Management | TanStack React Query     | 5.90.7       |

### 4.2 Third-Party Services

Mapbox (tiles/geocoding), Supabase (DB+Auth), Zillow/Realtor/Redfin (RE data), Census/FRED/BLS (economic), Anthropic Claude (AI), Stripe (payments).

### 4.3 Architecture Style: Full-Stack Monorepo

**Pattern:** Modular monolith with clear frontend/backend separation.

**Deployment Targets (STRICT):**

- **Frontend:** Railway — `propertyiq.up.railway.app`
- **Backend:** Railway — `backend-production-ee4d.up.railway.app`
- **Analytics:** Railway — `analytics-production-af35.up.railway.app`
- **Infrastructure Rule:** `.env` changes affect **LOCAL ONLY**. Production/Staging vars via Railway dashboard. **NEVER** assume local `.env` enables production features.

### 4.4 Project Structure

```
packages/
  frontend/           # Next.js App Router
    app/              # Pages and components
    lib/
      data/           # THE data layer - all API calls go here
        fetchers/     # fetch functions
        hooks/        # React hooks
        registry.ts   # Metric configurations
      format/         # Formatting utilities
      entitlements/   # Entitlements system (tier gating)
  backend/            # NestJS API (port 3001)
    src/
      metric-resolution/  # Centralized metric fallback & geo inheritance
      metrics/        # Metric endpoints
      scoring/        # PropertyIQ scores
      markets/        # Market data
scripts/              # Data import pipelines
data/                 # Raw data files
```

**Backend:** NestJS modules with DI (Controllers → Services → Supabase).
**Frontend:** React hooks + React Query for server state; component composition.

### 4.5 Data Flow

```
User selects metric → useMapData hook → API Client → NestJS Controller → Service
→ Supabase query (queryLatestPerRegion) → JSON response
→ React Query cache → useMapLayers → GeoJSON features → Map + Legend render
```

### 4.6 Database Schema (Long Format)

Each geography level has its own table. Schema: `region_id`, `region_name`, `period_date`, `metric_name`, `value`.

| Table         | Region ID Format |
| ------------- | ---------------- |
| zillow_state  | State FIPS       |
| zillow_metro  | CBSA code        |
| zillow_county | County FIPS      |
| zillow_zip    | ZIP code         |

---

## 5. DATA FETCHING - CRITICAL

**ALL frontend data fetching MUST go through `@/lib/data`.**

```typescript
// CORRECT
import { fetchSnapshotData, useSnapshotData } from "@/lib/data";

// WRONG - Never do this outside lib/data
const response = await fetch(`${API_URL}/api/metrics/...`);
```

**The data layer provides:**

- `fetchSnapshotData(metricId, geoLevel, options)` - Current metric values
- `fetchTimeSeriesData(metricId, geoLevel, geoId, options)` - Historical data
- `fetchScore(geoLevel, geoId)` - PropertyIQ Score (single score type: `'propertyiq'`)
- React hooks: `useSnapshotData`, `useTimeSeriesData`, `useScoreData`, `useDataCard`

**If an endpoint doesn't exist:** Add to `lib/data/fetchers/` → export from `lib/data/index.ts` → then use.

**Files to NEVER import from:** `lib/api/client.ts` (deprecated), direct `fetch()` with API_URL.

### Data Binding Hooks

**NEVER** write custom fetch logic. Use unified hooks:

| Hook                  | Use Case                                    |
| --------------------- | ------------------------------------------- |
| `useMetricData`       | Core: fetch any metric for any geography    |
| `useDataCard`         | Cards: formatted values + trend calculation |
| `useMetricOptions`    | Dropdowns: metric/geography options         |
| `useScoreCardMetrics` | Score cards: batch indicators               |

Features: 2-hour React Query caching, auto-filtering by geography, consistent formatting via `formatValue()`, trend calculation (3-month comparison).

### 5.1 BACKEND METRIC RESOLUTION - CRITICAL

**ALL backend metric fallback logic MUST go through `MetricResolutionService`.**

**Module:** `packages/backend/src/metric-resolution/`

```typescript
// CORRECT - Use MetricResolutionService
const resolved = await this.metricResolution.resolveMetricBatch(
  ["home_value", "rent_index", "unemployment_rate"],
  geoLevel,
  geoId,
);

// WRONG - Never write ad-hoc fallback chains
if (zhviValue == null) {
  /* try Census... */
}
```

**Methods:** `resolveMetric()`, `resolveMetricBatch()`, `resolveMetricForAllGeos()`

**Key files:**

| File                           | Purpose                                                |
| ------------------------------ | ------------------------------------------------------ |
| `fallback-registry.ts`         | **THE** source of truth for all metric fallback chains |
| `source-fetcher.service.ts`    | DB table/column routing per (source, geoLevel)         |
| `geography-chain.service.ts`   | Geography parent chain with LRU cache                  |
| `metric-resolution.service.ts` | Public API                                             |

**Adding a new metric fallback:** Add entry to `FALLBACK_REGISTRY` → add source table route if needed → done.

**Geography inheritance:** Set `supportsGeoInheritance: true` in registry. Chain: ZIP → County → Metro → State → National via `geography_crosswalk` table.

---

## 6. METRIC CONFIGURATION (SOURCE OF TRUTH)

**All metric properties defined in ONE place:** `packages/frontend/app/map/config/metrics.ts`

```typescript
export const METRICS: Record<string, MetricConfig> = {
  market_heat: {
    id: "market_heat",
    title: "Market Heat Index",
    format: "index", // currency | percent | percent_abs | number | index | days
    dataSource: "zillow",
    apiEndpoint: "/api/zillow/market-heat/{geo}",
    supportedGeos: ["metro"],
    rangeType: "full",
  },
};
```

### Adding New Metrics

1. Add config to `lib/data/registry.ts` with `supportedGeos`
2. Existing fetchers read from registry automatically
3. Add to category in `config/metric-categories.tsx`
4. Backend: Ensure endpoint exists

### Color Scale Logic

- Palette: 7 colors (Violet #7c3aed to Dark Red #b91c1c)
- `percent`/`percent_abs`: 5th-95th percentile. `currency`/`number`/`days`: Min-95th. `index` (full): Min-Max.

### Formatting Values - CRITICAL

```typescript
import { formatMetricValue, getMetricFormat } from "@/lib/data";
formatMetricValue(499000, "currency"); // "$499K"
formatMetricValue(value, getMetricFormat(metricId)); // Use metric's format
// WRONG: formatMetricValue(metricId, value) — will show "$metricId" literally
```

---

## 7. COMMON PATTERNS

### Check Geography Support

```typescript
import { isMetricSupportedForGeo } from "@/lib/data";
if (isMetricSupportedForGeo("home_value", "zip")) {
  /* Safe to fetch */
}
```

### Report Section Components

```typescript
import { getMetricWithAliases } from '../utils/metricHelpers';
const price = getMetricWithAliases(report, 'zhvi');
if (!price) return <DataUnavailable />;  // Show UI, don't use || 400000
```

### Backend Query Pattern

Use `queryLatestPerRegion()` for most recent data point per region (not a single global date).

---

## 8. BRAND IDENTITY & DESIGN SYSTEM

**Authoritative spec:** `docs/superpowers/specs/2026-03-27-propertyiq-brand-identity.md`
**Brand assets:** `.superpowers/brand-assets/`

### 8.0 Brand Essentials

| Element         | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| **Brand Name**  | PropertyIQ                                                          |
| **Short Name**  | PIQ                                                                 |
| **Tagline**     | The IQ Behind Every Market                                          |
| **Personality** | The Smart Friend — approachable, knowledgeable, M3/Google aesthetic |
| **Audience**    | RE investors & agents (primary), first-time homebuyers (secondary)  |

### 8.1 Core Authority (M3)

- All UI patterns must strictly adhere to [Material Design 3 Guidelines](https://m3.material.io/).
- Do NOT mix generic/Geist aesthetics with Material.
- The PropertyIQ indigo palette maps directly to M3's tonal palette system.

### 8.2 Color Palette (Key Values)

**Use semantic CSS variables (`bg-primary`, `text-on-primary`, `bg-surface`, etc.) mapped in `globals.css`. Do NOT hardcode hex values.**

| Role              | Hex       | Usage                            |
| ----------------- | --------- | -------------------------------- |
| Primary (Indigo)  | `#3949AB` | Buttons, active states, logomark |
| Primary Dark      | `#1A237E` | Headings, dark surfaces          |
| Primary Medium    | `#5C6BC0` | Secondary elements, icons        |
| Primary Light     | `#C5CAE9` | Hover states, backgrounds        |
| Primary Container | `#E8EAF6` | Card backgrounds                 |
| Accent (Green)    | `#00C853` | Positive metrics, growth         |
| Error (Red)       | `#B3261E` | Negative metrics, errors         |
| Warning (Amber)   | `#FF8F00` | Caution states                   |
| Surface           | `#FAFBFF` | Page backgrounds                 |
| On-Surface        | `#1A237E` | Primary text                     |
| Dark Surface      | `#1A1A2E` | Dark mode background             |

### 8.3 Typography

| Role      | Font                     | Usage                    |
| --------- | ------------------------ | ------------------------ |
| Primary   | Roboto (300-700)         | All UI text              |
| Monospace | Roboto Mono (400, 500)   | Numbers, scores, metrics |
| Editorial | Source Serif 4 (400-700) | AI narratives, reports   |

### 8.4 Visual Foundation (Tailwind)

**Shape:** Cards `rounded-xl`, Buttons/Chips `rounded-full`, Dialogs `rounded-[28px]`
**Elevation:** Surface Tones + Shadow, NOT Glassmorphism. Cards: `shadow-sm`, Dialogs: `shadow-lg`
**Motion:** M3 Standard Easing. Short `duration-200`, Medium `duration-400`, Long `duration-600`

### 8.5 M3 Component Mapping

| Concept        | M3 Replacement    | Tailwind                                  |
| -------------- | ----------------- | ----------------------------------------- |
| Sidebar        | Navigation Drawer | `bg-surface-container-low`, rounded-r-2xl |
| Pill Selectors | Filter Chips      | `rounded-lg`, `border-outline`            |
| Stat Cards     | Elevated Card     | `rounded-xl`, `shadow-sm`                 |
| Search Bar     | Search Bar (View) | `rounded-full`, `h-14`                    |

### 8.6 Brand Voice

**Confident, Conversational, Data-First, Accessible, Actionable.** Lead with specifics, not opinions. Like a knowledgeable friend, not a textbook.

| Use This            | Not This                 |
| ------------------- | ------------------------ |
| PropertyIQ Score    | Rating / Grade / Rank    |
| Confidence level    | Accuracy / Trust score   |
| Market intelligence | Market report / Analysis |

---

## 9. SCORE & CONFIDENCE DISPLAY

**All score displays MUST use standardized components in `app/components/scoring/`.** Do NOT create custom score visualizations.

**One score type:** PropertyIQ Score (`score_type = 'propertyiq'`). Measures market demand signal relative to state average.

### Components

| Component           | Use Case                                        |
| ------------------- | ----------------------------------------------- |
| `ScoreWidget`       | **Preferred** — auto-fetches score + confidence |
| `ScoreDisplay`      | Presentation-only score ring                    |
| `ScoreBadge`        | Compact score with trend arrow                  |
| `ScoreCard`         | Expanded view with breakdown and history        |
| `ConfidenceDisplay` | Confidence star rating + percentage             |
| `ScoreHistoryChart` | 3Y/5Y trend with returns overlay                |

### PropertyIQ Score Formula

```
signal = z(sold_above_list) - z(median_dom) - z(months_of_supply)
→ percentile rank within state → re-center at 55.6 → clamp 1-99
```

- **50 = state average** — higher means outperformance
- Scores are relative within each state, not nationally
- Input metrics: % Sold Above List (↑), Median DOM (↓), Months of Supply (↓) — all from Redfin
- **Coverage:** 746 metros, 2,983 counties, 19,880 ZIPs
- **Database:** `propertyiq_scores` table, `score_type = 'propertyiq'`

### Score Labels

| Score | Label     | Score | Label     |
| ----- | --------- | ----- | --------- |
| 90+   | EXCELLENT | 50-59 | AVERAGE   |
| 80-89 | GREAT     | 40-49 | BELOW AVG |
| 70-79 | GOOD      | 20-39 | POOR      |
| 60-69 | FAIR      | <20   | VERY POOR |

### Confidence (A/B/C/F Letter Badge)

Confidence represents **data quality**, NOT a grade of the score. Score and confidence are independent.

| Level | Range   | Meaning                                 |
| ----- | ------- | --------------------------------------- |
| A     | 80-100% | Excellent data coverage and freshness   |
| B     | 65-79%  | Good data, minor gaps                   |
| C     | 45-64%  | Fair data, notable gaps (shows warning) |
| F     | 0-44%   | Insufficient data (shows warning)       |

**Exported utilities:** `getScoreColor()`, `getLetterGrade()`, `getGradeColor()`, `getScoreLabel()`, `MARKET_THRESHOLDS`
