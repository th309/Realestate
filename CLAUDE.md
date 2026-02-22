# PropertyIQ Platform

Real estate analytics platform with React/Next.js frontend and NestJS backend.

## 1. CRITICAL BEHAVIORAL STANDARDS

### 1.0 The Hermeneutic Circle (How to Approach All Changes)

Approach all changes through the Hermeneutic Circle. Before touching any file or function, first develop an understanding of the whole system's architecture, intent, and interdependencies. Then examine how the specific part you're changing fits within that whole. After making a change, cycle back to re-evaluate the whole — does the system still cohere? Do assumptions elsewhere still hold? Repeat this part-to-whole interpretation loop until the change is fully integrated. Never make changes in isolation without this contextual pass.

**The loop:**
1. **Understand the whole** — Read related files, trace data flow, understand why things exist before changing them.
2. **Examine the part** — Focus on the specific file/function, understanding its role in the system.
3. **Make the change** — Implement with full awareness of upstream and downstream effects.
4. **Re-evaluate the whole** — After changing, verify: Do imports still resolve? Do consumers of this code still work? Do types still align? Are assumptions in other files still valid?
5. **Repeat** — If re-evaluation reveals breakage or drift, address it before considering the task done.

### 1.1 The "Don'ts" (Strict Constraints)
* **NEVER** duplicate metric names/formats. `config/metrics.ts` is the **ONLY** source of truth.
* **NEVER** hardcode color scale breakpoints; use dynamic min/max calculations.
* **NEVER** create separate API methods for each metric; always use the unified `fetchMetricData`.
* **NEVER** format values manually; use `formatValue()` or `formatTooltipValue()` from utils.
* **NEVER** hardcode zoom levels; use `GEO_ZOOM_LEVELS` from `config/metrics.ts`.
* **NEVER** write ad-hoc metric fallback logic in backend services. All metric source fallbacks and geography inheritance MUST go through `MetricResolutionService`. See **Section 3.1**.

### 1.2 Security & Data Protection (Strict)
* **Authentication & Authorization:**
    * **RLS is Supreme:** NEVER implement row-level security logic in the application layer if it can be done in Supabase RLS policies. Do not manually filter by `user_id` in the frontend.
    * **Client vs. Server:** NEVER fetch sensitive data (PII, billing) in Client Components (`'use client'`). Always fetch in Server Components or via the NestJS backend.
* **Input Validation:**
    * **Trust No One:** Every API endpoint (NestJS) and Server Action (Next.js) MUST validate input using Zod or `class-validator`.
* **Secrets Management:**
    * **No Defaults:** NEVER hardcode fallback values for secrets (e.g., `process.env.KEY || 'default'`). The app MUST crash if a secret is missing.
    * **Exposure:** NEVER expose `service_role` keys to the client.

### 1.3 Architecture & Modularity (File Size Limits)
* **Modular by Default:** Prefer small, single-purpose files.
* **File Size Limits (by file type):**

| File Type | Target | Hard Limit | Action at Hard Limit |
|-----------|--------|------------|---------------------|
| Logic files (hooks, utils, helpers, services, types) | Under 200 lines | **300 lines** | MUST split |
| React components (single responsibility, JSX-heavy) | Under 300 lines | **400 lines** | MUST split |
| Test files (e2e, unit) | Under 400 lines | **500 lines** | MUST split by describe block |

* **At the hard limit, you MUST:**
    1. **Analyze** logical components (sub-components, helpers, constants, types).
    2. **Propose** a refactor plan.
    3. **Execute** the split into `/utils/`, `/hooks/`, or sub-components.
* **What counts as "single responsibility":** One exported component with its local helpers. A file with 2+ exported components must be split regardless of line count.
* **Colocation:** Keep related utils/types in the same feature folder.

### 1.4 Naming Convention (Human-Readable Names)

**Every name you create MUST be descriptive and self-explanatory.** This applies to EVERYTHING — files, folders, branches, variables, functions, classes, constants, plan files, agent tasks, audit outputs, screenshots, migrations, services, modules, test descriptions, worktrees, commit messages, PR titles, database columns, environment variables, config keys, and anything else that gets a name. No exceptions. Random, generic, or auto-generated names are never acceptable.

**The rule:** If someone sees the name 6 months from now with no other context, they should immediately understand what it is and what it does. If not, rename it.

**Examples of good vs. bad naming:**

| Context | Bad | Good |
|---------|-----|------|
| File | `utils2.ts`, `helper.ts` | `scoring-engine.ts`, `timeseries-region-filter.ts` |
| Branch | `feature-1`, `dev-branch` | `feat/report-share-buttons` |
| Plan | `plan.md`, `plan-001.md` | `plan-add-stripe-webhook-handling.md` |
| Agent task | "Update file" | "Add auth guard to billing controller" |
| Output | `output.txt` | `audit-rls-policies-missing.txt` |
| Screenshot | `screenshot-3.png` | `report-ai-narrative-clean.png` |
| Test | `describe('test 1')` | `describe('ScoreWidget renders grade badge for each threshold')` |
| Migration | `migration_20260220` | `add_user_watchlist_table` |
| Variable | `d`, `tmp`, `val` | `regionScores`, `filteredMetrics` |
| Function | `process()`, `handle()` | `calculatePercentileRange()`, `formatCurrencyValue()` |

### 1.5 Parallel Agents & Agent Teams

**Default to parallelism.** When a task involves 2+ independent subtasks, dispatch them as parallel agents rather than working sequentially. This applies to implementation, research, and testing.

**When to use parallel agents:**
* **Multi-file implementations** — e.g., frontend component + backend endpoint + tests can each be a separate agent.
* **Research & exploration** — searching across packages, reading multiple files, or investigating independent questions.
* **Cross-package changes** — frontend and backend changes that don't depend on each other.
* **Bulk operations** — updating multiple similar files (e.g., adding auth guards to several controllers, updating imports across modules).
* **Test + lint + build** — run verification steps concurrently after implementation.

**How to structure agent teams:**
1. **Identify independent work streams.** If task B doesn't need output from task A, they're independent.
2. **Launch all independent agents in a single message** using multiple Task tool calls.
3. **Use sequential agents only when there's a true data dependency** — e.g., "generate types" must finish before "use types in component."
4. **Assign clear, scoped prompts** — each agent should know exactly what files to touch and what constraints to follow (reference this CLAUDE.md).
5. **Aggregate results** — after agents complete, synthesize their outputs and handle any cross-cutting concerns.

**Agent type selection:**
| Task | Agent Type |
|------|-----------|
| File search / codebase exploration | `Explore` |
| Implementation planning | `Plan` |
| Running commands (build, test, git) | `Bash` |
| Multi-step coding or research | `general-purpose` |
| Code review after major step | `superpowers:code-reviewer` |

**Example — Adding a new API endpoint with frontend integration:**
```
Agent 1 (general-purpose): Create NestJS controller + service + DTO in packages/backend
Agent 2 (general-purpose): Create fetcher + hook + types in packages/frontend/lib/data
Agent 3 (general-purpose): Write unit tests for the backend service
→ All three launch in parallel
→ After completion: Agent 4 wires up the frontend component using the new hook
```

---

## 2. PROJECT ARCHITECTURE & STACK

### 2.1 Technology Stack

| Layer | Technology | Version |
| :--- | :--- | :--- |
| **Frontend** | Next.js (App Router) | 16.1.1 |
| **UI Library** | React | 19.2.0 |
| **Styling** | Tailwind CSS | 4.0 |
| **Mapping** | Mapbox GL + react-map-gl | 3.17.0 |
| **Backend** | NestJS | 11.0.1 |
| **Database** | Supabase (PostgreSQL) | Cloud-hosted |
| **Caching** | Redis (ioredis) | 5.9.1 |
| **State Management** | TanStack React Query | 5.90.7 |

### 2.2 Third-Party Services
* **Mapbox:** Map tiles and geocoding.
* **Supabase:** Database + Auth.
* **Zillow/Realtor/Redfin:** Real estate data feeds.
* **Census/FRED/BLS:** Economic indicators.
* **Anthropic Claude:** AI integration (backend SDK).
* **Stripe:** Payments (Phase 1).

### 2.3 Architecture Style: Full-Stack Monorepo
**Pattern:** Modular monolith with clear frontend/backend separation.

**Deployment Targets (STRICT):**
* **Frontend:** Railway (Production/Staging) — `propertyiq.up.railway.app`
* **Backend:** Railway (Production/Staging) — `backend-production-ee4d.up.railway.app`
* **Analytics:** Railway (Production/Staging) — `analytics-production-af35.up.railway.app`
* **Infrastructure Rule:** Code changes to `.env` files affect **LOCAL ONLY**. Production/Staging variables must be updated in the Railway cloud dashboard. **NEVER** assume a local `.env` change enables a feature in production.

### 2.4 Project Structure

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

**Backend Pattern:** NestJS modules with dependency injection (Controllers → Services → Supabase).
**Frontend Pattern:** React hooks + React Query for server state; component composition.

### 2.5 Data Flow

```
User selects metric → triggers useMapData hook
→ API Client sends GET request to backend
→ NestJS Controller routes to appropriate service
→ Service queries Supabase with filters (queryLatestPerRegion) → returns JSON
→ React Query caches response; transforms to HomeValues format
→ useMapLayers applies data to GeoJSON features
→ Map + Legend render with consistent color scales
```

### 2.6 Database Schema (Long Format)
Each geography level has its own table. All follow the same schema pattern: `region_id`, `region_name`, `period_date`, `metric_name`, `value`.

| Table | Region ID Format |
|-------|-----------------|
| zillow_state | State FIPS |
| zillow_metro | CBSA code |
| zillow_county | County FIPS |
| zillow_zip | ZIP code |

---

## 3. DATA FETCHING - CRITICAL

**ALL frontend data fetching MUST go through `@/lib/data`.**

```typescript
// CORRECT - Use the data layer
import { fetchSnapshotData, fetchTimeSeriesData, useSnapshotData } from '@/lib/data';

// WRONG - Never do this outside lib/data
const response = await fetch(`${API_URL}/api/metrics/...`);
```

**Why this matters:**
- Unified error handling, caching, and retry logic
- Consistent data transformation and normalization
- Single source of truth for API contracts
- Easier to debug and maintain

**The data layer provides:**
- `fetchSnapshotData(metricId, geoLevel, options)` - Current metric values
- `fetchTimeSeriesData(metricId, geoLevel, geoId, options)` - Historical data
- `fetchScore(geoLevel, geoId, scoreType)` - PropertyIQ scores
- React hooks: `useSnapshotData`, `useTimeSeriesData`, `useScoreData`, `useDataCard`

**If an endpoint doesn't exist in lib/data:**
1. Add it to `lib/data/fetchers/`
2. Export from `lib/data/index.ts`
3. THEN use it in your component

### Files to NEVER import from
- `lib/api/client.ts` - Deprecated, will be removed
- Direct `fetch()` with `API_URL` or `NEXT_PUBLIC_API_URL`

### Data Binding Hooks

**NEVER** write custom fetch logic for cards, dropdowns, or selectors. Use the unified data binding hooks:

| Hook | Use Case | Location |
|------|----------|----------|
| `useMetricData` | Core: fetch any metric for any geography | `app/map/hooks/useMetricData.ts` |
| `useDataCard` | Cards: formatted values + trend calculation | `app/map/hooks/useDataCard.ts` |
| `useMetricOptions` | Dropdowns: metric/geography options | `app/map/hooks/useMetricOptions.ts` |
| `useScoreCardMetrics` | Score cards: batch indicators | `app/graphs/hooks/useScoreCardMetrics.ts` |

**Card Example:**
```typescript
import { useDataCard } from '@/app/map/hooks';

const { formattedValue, trend, loading } = useDataCard({
  metricId: 'home_value',
  geoLevel: 'metro',
  regionId: '31080',
  showTrend: true,
});
```

**Dropdown Example:**
```typescript
import { useAllMetricOptions } from '@/app/map/hooks';

const { options } = useAllMetricOptions(geoLevel);
// Returns: [{ label: 'Home Value', value: 'home_value', disabled: false }, ...]
```

**Features:**
- 2-hour React Query caching (automatic deduplication)
- Auto-filtering by geography support
- Consistent formatting via `formatValue()`
- Trend calculation (3-month comparison)

### 3.1 BACKEND METRIC RESOLUTION - CRITICAL

**ALL backend metric fallback logic MUST go through `MetricResolutionService`.**

**Module:** `packages/backend/src/metric-resolution/`

When a backend service needs a metric value (e.g., `home_value`, `rent_index`, `unemployment_rate`) and the primary data source might be missing, it MUST NOT write its own if/else fallback chain. Instead, it calls `MetricResolutionService`, which consults the centralized `fallback-registry.ts` — the **single source of truth** for which data sources to try and in what order.

```typescript
// CORRECT - Use MetricResolutionService
const resolved = await this.metricResolution.resolveMetricBatch(
  ['home_value', 'rent_index', 'unemployment_rate'],
  geoLevel, geoId,
);
const homeValue = resolved.home_value.value; // Resolved via ZHVI → Census ACS → Realtor

// WRONG - Never write ad-hoc fallback chains
if (zhviValue == null) {
  // try Census...
  if (censusValue == null) {
    // try Realtor...
  }
}
```

**Why this matters:**
- Every consumer gets the same answer for the same geography — no more bugs where one page shows data and another doesn't
- Adding or changing a fallback source is a one-line change in `fallback-registry.ts`, not a hunt across 4+ files
- Geography inheritance (ZIP → County → Metro → State) is handled automatically via `GeographyChainService`
- Source provenance is tracked: `ResolvedMetric` tells you which source provided the value and whether it was inherited

**The module provides:**

| Method | Use Case |
|--------|----------|
| `resolveMetric(metricId, geoLevel, geoId)` | Single metric for one geography |
| `resolveMetricBatch(metricIds, geoLevel, geoId)` | Multiple metrics for one geography (market snapshots, reports) |
| `resolveMetricForAllGeos(metricId, geoLevel)` | One metric across all geographies at a level (scoring batch) |

**`ResolvedMetric` return type:**
```typescript
interface ResolvedMetric {
  value: number | null;
  date: string | null;
  source: string;            // Which data source provided the value
  sourceGeoId: string | null;
  sourceGeoLevel: string | null;
  isInherited: boolean;      // Was this inherited from a parent geography?
  isFallback: boolean;       // Was this from a non-primary source?
}
```

**Key files:**

| File | Purpose |
|------|---------|
| `fallback-registry.ts` | **THE** source of truth for all metric fallback chains |
| `source-fetcher.service.ts` | DB table/column routing per (source, geoLevel) |
| `geography-chain.service.ts` | Geography parent chain with LRU cache |
| `metric-resolution.service.ts` | Public API (the 3 methods above) |

**Adding a new metric fallback:**
1. Add the entry to `FALLBACK_REGISTRY` in `fallback-registry.ts`
2. If the source table doesn't exist in `source-fetcher.service.ts`, add its route
3. Done — all consumers automatically get the new fallback

**Adding a new data source:**
1. Add the source type to `DataSource` in `metric-resolution.types.ts`
2. Add the fetch logic in `source-fetcher.service.ts`
3. Reference it in the relevant `FALLBACK_REGISTRY` entries

**Geography inheritance** (for metrics like `unemployment_rate` where ZIP data may be missing):
- Set `supportsGeoInheritance: true` in the registry entry
- `GeographyChainService` walks up: ZIP → County → Metro → State → National
- Uses `geography_crosswalk` table with LRU-cached lookups

---

## 4. METRIC CONFIGURATION (SOURCE OF TRUTH)

**IMPORTANT:** All metric properties are defined in ONE place.

**File:** `packages/frontend/app/map/config/metrics.ts`

```typescript
export const METRICS: Record<string, MetricConfig> = {
  market_heat: {
    id: 'market_heat',
    title: 'Market Heat Index',      // Display name everywhere
    format: 'index',                 // currency | percent | percent_abs | number | index | days
    dataSource: 'zillow',            // zillow | realtor | calculated | census | fred
    apiEndpoint: '/api/zillow/market-heat/{geo}',
    keyField: 'auto',                // How to match to GeoJSON
    supportedGeos: ['metro'],        // Which geo levels have data
    rangeType: 'full',               // Color scale calculation
  },
  // ... all other metrics
};
```

**Key Configuration Files:**

| File | Purpose | Gets from METRICS |
|------|---------|-------------------|
| `config/metrics.ts` | THE source of truth | N/A - defines everything |
| `config/metric-categories.tsx` | Sidebar category organization | title, dataSource |
| `config/fetchMetricData.ts` | Unified API fetching | apiEndpoint, keyField, asPercent |
| `lib/api/client.ts` | API Client | N/A |
| `utils/metricUtils.ts` | Formatting & color scale | format, rangeType |
| `components/Legend.tsx` | Map legend display | via getMetricFormat(), getMetricTitle() |
| `hooks/useMapLayers.ts` | Map rendering | via calculateValueRange() |

### Adding New Metrics

1. Add metric config to `lib/data/registry.ts`
2. Set `supportedGeos` to specify which geography levels support it
3. Use existing fetchers - they read from registry automatically
4. Add to category in `config/metric-categories.tsx`:
   ```typescript
   metric('new_metric', { isPremium: true, isNew: true }),
   ```
5. Backend: Ensure the endpoint exists

### Color Scale Logic
* Palette: 7 colors (Violet #7c3aed to Dark Red #b91c1c).
* Range Calculation:
  - `percent`: 5th to 95th percentile
  - `percent_abs`: 5th to 95th percentile (positive values)
  - `currency / number / days`: Min to 95th percentile
  - `index` (with rangeType: 'full'): Actual Min to Max

### Formatting Values - CRITICAL
```typescript
import { formatMetricValue, getMetricFormat } from '@/lib/data';

// CORRECT: formatMetricValue(value, format)
formatMetricValue(499000, 'currency');  // "$499K"
formatMetricValue(value, getMetricFormat(metricId));  // Use metric's format

// WRONG: formatMetricValue(metricId, value) - will show "$metricId" literally
```

---

## 5. COMMON PATTERNS

### Check Geography Support
```typescript
import { isMetricSupportedForGeo } from '@/lib/data';

if (isMetricSupportedForGeo('home_value', 'zip')) {
  // Safe to fetch
}
```

### Report Section Components
```typescript
import { getMetricWithAliases } from '../utils/metricHelpers';

// Use for report data access - handles aliases (zhvi → median_listing_price)
const price = getMetricWithAliases(report, 'zhvi');

// Always check data availability - never use hardcoded fallbacks
if (!price) {
  return <DataUnavailable />;  // Show UI, don't use || 400000
}
```

### Backend Query Pattern (NestJS)
Use `queryLatestPerRegion()` to get the most recent data point for each region, rather than a single global date.
```typescript
const data = await queryMarketIndicatorLatest(supabase, table, geography);
// Returns rows with: region_id, value, period_date
```

---

## 6. DESIGN SYSTEM: MATERIAL DESIGN 3 (M3)

### 6.1 Core Authority
* **Source of Truth:** All UI patterns must strictly adhere to [Material Design 3 Guidelines](https://m3.material.io/).
* **Strict Adherence:** Do NOT mix generic/Geist aesthetics with Material. If a pattern exists in M3 (e.g., Navigation Drawer), use it instead of a custom sidebar.

### 6.2 Visual Foundation (Tailwind Implementation)

**Typography (M3 Type Scale)**
* **Font Family:** Use `Roboto` (via `next/font/google`) for all text.
* **Scale Implementation:**
    * **Display:** `text-4xl` to `text-6xl` (tracking-tight)
    * **Headline:** `text-2xl` to `text-3xl`
    * **Title:** `text-lg` to `text-xl` (font-medium)
    * **Body:** `text-base` (tracking-wide)
    * **Label:** `text-sm` (font-medium, tracking-wide)

**Color System (Semantic Roles)**
Do NOT use hex codes directly. Use Semantic CSS Variables mapped to Tailwind colors:
* **Primary:** Key actions (FABs, Active States) → `bg-primary` / `text-on-primary`
* **Surface:**
    * `bg-surface` (Main background)
    * `bg-surface-container-low` (Sidebar/Drawer)
    * `bg-surface-container-high` (Modals/Dialogs)
* **Outline:** `border-outline` (dividers) and `border-outline-variant`.

**Shape & Elevation**
* **Corner Radius:**
    * **Cards:** `rounded-xl` (M3 Medium) or `rounded-3xl` (M3 Large)
    * **Buttons/Chips:** `rounded-full` (M3 Full)
    * **Dialogs:** `rounded-[28px]` (M3 Extra Large)
* **Elevation (Shadows):**
    * Use Surface Tones + Shadow, NOT Glassmorphism.
    * Level 1 (Cards): `shadow-sm bg-surface-container-low`
    * Level 3 (Dialogs/FABs): `shadow-lg bg-surface-container-high`

### 6.3 UI Components (M3 Mapping)

| Current Concept | Material 3 Replacement | Tailwind Spec |
| :--- | :--- | :--- |
| **Sidebar** | **Navigation Drawer** (Standard) | Fixed left, `bg-surface-container-low`, rounded-r-2xl |
| **Pill Selectors** | **Filter Chips** | `rounded-lg`, `border-outline`, `bg-surface` |
| **Stat Cards** | **Elevated Card** | `bg-surface-container-low`, `rounded-xl`, `shadow-sm` |
| **Search Bar** | **Search Bar (View)** | `rounded-full`, `h-14`, `bg-surface-container-high` |
| **Benchmark Panel** | **Standard Side Sheet** | Fixed right, `bg-surface-container-low`, `border-l` |
| **Floating Map Details** | **Bottom Sheet** | `rounded-t-xl`, `bg-surface-container` |

### 6.4 Iconography
* **Set:** Material Symbols (Rounded or Sharp).
* **Implementation:** Use a consistent SVG set that matches Material Symbols.

### 6.5 Motion
* **Easing:** Use M3 Standard Easing (`ease-[0.2, 0.0, 0, 1.0]`).
* **Durations:**
    * Short: `duration-200` (icons, selection)
    * Medium: `duration-400` (sheets, dialogs)
    * Long: `duration-600` (page transitions)

---

## 7. SCORE & CONFIDENCE DISPLAY (Standardized Components)

**CRITICAL:** All score displays (HomeReady, InvestorEdge, Market Health) MUST use the standardized score components. Do NOT create custom score visualizations.

**All components:** `app/components/scoring/`

| Component | Use Case | Data Source |
|-----------|----------|-------------|
| `ScoreWidget` | **Preferred** - Auto-fetches score + confidence | Uses `useScoreData` internally |
| `ScoreDisplay` | Presentation-only score ring | Score value passed as prop |
| `ScoreBadge` | Compact score with trend arrow | Score + trend passed as props |
| `ScoreCard` | Expanded view with breakdown, history, validation | Full score data as props |
| `ConfidenceDisplay` | Confidence star rating + percentage | Confidence data as props |
| `ScoreHistoryChart` | 3Y/5Y score trend with returns overlay | Fetches from API |
| `ComponentBar` | Score component breakdown bar | Component data as props |

### Two Concepts: Score (Number) and Confidence (Letter)

The system has two distinct measurements displayed together in the score widget:

1. **Score (0-100 number):** How good a market is for a given strategy. Displayed as a **number** inside a color-gradient ring, with a descriptor label (EXCELLENT to VERY POOR).

2. **Confidence (A/B/C/F letter):** How much we trust that score, based on data quality. Displayed as the **letter badge** on the score widget.

**CRITICAL:** The letter badge (A/B/C/F) shown in the ScoreWidget represents **confidence**, NOT a grade derived from the score number. A score of 78 with a "B" badge means "score is 78, and we have B-level confidence in that number." Do NOT confuse this with academic-style grading of the score itself.

These are independent — a market can have a high score with low confidence (good on paper but insufficient data) or a low score with high confidence (reliably bad).

### Score Display

**Component:** `ScoreDisplay` (`app/components/scoring/ScoreDisplay.tsx`)

The base presentation component. Note: `ScoreDisplay` has internal `getLetterGrade()` and `showGrade` props that derive a letter from the score value — these are **internal utilities** and should not be confused with the confidence letter. When used inside `ScoreWidget`, the confidence letter badge (from the data layer) takes precedence as the displayed letter.

**Visual Spec:**
* **Ring:** SVG circular progress with HSL gradient (red at 0 → green at 100)
* **Tick marks:** At 33% and 66% positions (market threshold indicators)
* **Score Number:** Bold, centered in ring
* **Letter Badge:** Confidence level (A/B/C/F) — comes from data layer, NOT from the score number
* **Label:** Uppercase descriptor (EXCELLENT, GOOD, etc.) — derived from the score number

**Score → Grade Utility Thresholds** (internal `getLetterGrade()` — NOT the displayed confidence letter):

| Score | Grade |
|-------|-------|
| 97+ | A+ |
| 93-96 | A |
| 90-92 | A- |
| 87-89 | B+ |
| 83-86 | B |
| 80-82 | B- |
| 77-79 | C+ |
| 73-76 | C |
| 70-72 | C- |
| 67-69 | D+ |
| 63-66 | D |
| 60-62 | D- |
| <60 | F |

**Score → Label Thresholds:**

| Score | Label |
|-------|-------|
| 90+ | EXCELLENT |
| 80-89 | GREAT |
| 70-79 | GOOD |
| 60-69 | FAIR |
| 50-59 | AVERAGE |
| 40-49 | BELOW AVG |
| 20-39 | POOR |
| <20 | VERY POOR |

**Grade Badge Colors:**
* A grades: `bg-green-500`
* B grades: `bg-emerald-500`
* C grades: `bg-yellow-500`
* D grades: `bg-orange-500`
* F grade: `bg-red-500`

**Exported Utilities:**
- `getScoreColor(value)` - Returns HSL color string
- `getLetterGrade(score)` - Returns letter grade string
- `getGradeColor(grade)` - Returns `{ bg, text }` Tailwind classes
- `getScoreLabel(score)` - Returns descriptor string
- `MARKET_THRESHOLDS` - `{ sellersMax: 33, balancedMax: 66 }` for tick marks

### Confidence Display

**Component:** `ConfidenceDisplay` (`app/components/scoring/ConfidenceDisplay.tsx`)

Confidence uses a **letter grade system (A/B/C/F)** — NOT "HIGH/MED/LOW".

**Confidence Level Thresholds:**

| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| A | 80-100% | Emerald (green) | Excellent data coverage and freshness |
| B | 65-79% | Amber | Good data, minor gaps |
| C | 45-64% | Rose | Fair data, notable gaps — shows warning |
| F | 0-44% | Red | Insufficient data — shows warning |

**Star Rating (visual indicator):**

| Percentage | Stars |
|------------|-------|
| 90%+ | 5 stars |
| 80-89% | 4 stars |
| 70-79% | 3 stars |
| 55-69% | 2 stars |
| <55% | 1 star |

**Props:**
```typescript
interface ConfidenceDisplayProps {
  level: 'a' | 'b' | 'c' | 'f';       // Letter grade
  percentage: number;                   // 0-100
  metricsAvailable: number;             // How many metrics had data
  metricsTotal: number;                 // Total metrics needed
  freshnessInDays: number;              // Age of newest data
  warning?: string;                     // Shown for C/F levels
  size?: 'sm' | 'md';
  showDetails?: boolean;                // Show percentage + warning icon
}
```

**Backend Confidence Formula** (calculated in `confidence-calculator.service.ts`):
```
Confidence = (R² × 0.5) + (Sample Size Score × 0.3) + (Recency Score × 0.2)
```

### ScoreWidget (Connected Component)

**Component:** `app/components/scoring/ScoreWidget.tsx`

Auto-fetches score + confidence from the data layer. The number shown is the score; the letter badge is the confidence level:
```typescript
import { ScoreWidget } from '@/app/components/scoring/ScoreWidget';

<ScoreWidget
  geographyType="metro"
  geographyId="31080"
  scoreType="homeready"
  showConfidence  // Shows confidence letter badge (A/B/C/F) — this is data quality, not score grade
/>
// Result: "82" (score) with "A" badge (confidence in that score)
```

### ScoreBadge (Compact Display)

**Component:** `app/components/scoring/ScoreBadge.tsx`

Compact score ring with trend arrow, used in dashboards and lists:
```typescript
import { ScoreBadge } from '@/app/components/scoring';

<ScoreBadge
  type="market_health"
  label="Market Health"
  score={72}
  trend="up"
  trendChange={3.2}
  access="full"        // 'full' | 'teaser' (gated breakdown)
  status="complete"    // 'complete' | 'partial' | 'unavailable'
  size="md"            // 'sm' | 'md' | 'lg'
/>
```

### ScoreCard (Expanded View)

**Component:** `app/components/scoring/ScoreCard.tsx`

Full expanded view with component breakdown, sparkline history, confidence, and validation:
- **Header:** ScoreBadge + label + validation badge + data completeness
- **History:** Sparkline + "View History" button for extended chart
- **Confidence:** Inline `ConfidenceDisplay` with star rating
- **Components:** Breakdown bars (gated to Pro+ via entitlements)
- **Upgrade CTA:** Shown when `access === 'teaser'`

### ScoreHistoryChart (Extended Trends)

**Component:** `app/components/scoring/ScoreHistoryChart.tsx`

3Y/5Y score trend with actual returns overlay (dual Y-axis):
- Left axis: Score (0-100)
- Right axis: Returns (%)
- Lines: Score, Actual Return, State Benchmark (dashed)
- Toggle between 3Y and 5Y views
- Validation badge when 3Y+ of return data exists
