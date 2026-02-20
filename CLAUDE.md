# PropertyIQ Platform

Real estate analytics platform with React/Next.js frontend and NestJS backend.

## 1. CRITICAL BEHAVIORAL STANDARDS

### 1.1 The "Don'ts" (Strict Constraints)
* **NEVER** duplicate metric names/formats. `config/metrics.ts` is the **ONLY** source of truth.
* **NEVER** hardcode color scale breakpoints; use dynamic min/max calculations.
* **NEVER** create separate API methods for each metric; always use the unified `fetchMetricData`.
* **NEVER** format values manually; use `formatValue()` or `formatTooltipValue()` from utils.
* **NEVER** hardcode zoom levels; use `GEO_ZOOM_LEVELS` from `config/metrics.ts`.

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
* **Frontend:** Vercel (Production/Staging).
* **Backend:** Railway (Production/Staging).
* **Infrastructure Rule:** Code changes to `.env` files affect **LOCAL ONLY**. Production/Staging variables must be updated in the respective cloud dashboards (Vercel/Railway). **NEVER** assume a local `.env` change enables a feature in production.

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
* **Strict Adherence:** Do NOT mix "Vercel/Geist" aesthetics with Material. If a pattern exists in M3 (e.g., Navigation Drawer), use it instead of a custom sidebar.

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

## 7. SCORE DISPLAY (Standardized Components)

**CRITICAL:** All score displays (HomeReady, InvestorEdge, Market Health) MUST use the standardized score components. Do NOT create custom score visualizations.

**Two Components Available:**

| Component | Use Case | Data Source |
|-----------|----------|-------------|
| `ScoreWidget` | **Preferred** - Auto-fetches data | Uses `useScoreData` internally |
| `ScoreDisplay` | When you already have the score value | Passed as prop |

### ScoreWidget (Connected Component)
**Component:** `app/components/scoring/ScoreWidget.tsx`

Fetches score and confidence from the data binding layer automatically:
```typescript
import { ScoreWidget } from '@/app/components/scoring/ScoreWidget';

<ScoreWidget
  geographyType="metro"
  geographyId="31080"
  scoreType="homeready"
  showConfidence  // Optional: shows confidence badge
/>
```

**ScoreWidget Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `geographyType` | GeographyType | required | state, metro, county, etc. |
| `geographyId` | string | required | FIPS code, CBSA code, etc. |
| `scoreType` | ScoreType | required | homeready, investoredge, market_health |
| `showConfidence` | boolean | false | Show confidence badge (HIGH/MED/LOW) |
| `size` | number | 100 | Component size in pixels |
| `showGrade` | boolean | true | Show letter grade badge |
| `showLabel` | boolean | true | Show descriptor label |

### ScoreDisplay (Presentation Component)
**Component:** `app/components/scoring/ScoreDisplay.tsx`

Use when you already have score data (e.g., from a parent component):
```typescript
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';

<ScoreDisplay value={85} size={100} />
```

**Visual Spec:**
* **Ring:** SVG circular progress with HSL gradient (red→green based on 0-100 score)
* **Score Number:** Bold, centered in ring
* **Letter Grade Badge:** A+ to F with color-coded background:
  - A grades: `bg-green-500`
  - B grades: `bg-emerald-500`
  - C grades: `bg-yellow-500`
  - D grades: `bg-orange-500`
  - F grade: `bg-red-500`
* **Label:** Uppercase descriptor (EXCELLENT, GREAT, GOOD, FAIR, AVERAGE, BELOW AVG, POOR, VERY POOR)

**Grade Thresholds:**

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

**Label Thresholds:**

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

**Exported Utilities:** The component exports helper functions for use in other contexts:
- `getScoreColor(value)` - Returns HSL color string
- `getLetterGrade(score)` - Returns letter grade string
- `getGradeColor(grade)` - Returns `{ bg, text }` Tailwind classes
- `getScoreLabel(score)` - Returns descriptor string
