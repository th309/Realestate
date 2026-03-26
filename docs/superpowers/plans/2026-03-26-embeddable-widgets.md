# Embeddable Widgets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 5 live-data embeddable widgets (score, metric card, full interactive map, chart, report), a configuration wizard, a test harness, and a demo brokerage site.

**Architecture:** Each widget is a Next.js page under `/embed/` wrapped by the existing `EmbedShell` (token auth + branding). The map embed reuses hooks from `/app/map/`. The chart embed uses Recharts with `fetchTimeSeriesData`. The report embed wraps `ReportViewer`. A configuration wizard in the org admin portal generates iframe embed codes with live previews. A test harness and demo site use real iframes against production APIs — zero mockups.

**Tech Stack:** Next.js 16 App Router, Mapbox GL, Recharts, React Query, Supabase, existing embed token auth system

**Spec:** `docs/superpowers/specs/2026-03-26-embeddable-widgets-design.md`

---

## File Structure

### New files to create:

```
packages/frontend/app/embed/
├── chart/page.tsx                          — Chart embed (time series + comparison)
├── map-full/page.tsx                       — Full interactive map embed
├── map-full/useEmbedMapConfig.ts           — Parse URL params into map config
├── map-full/EmbedMapToolbar.tsx            — Metric dropdown + geo pills for map embed
├── report/[reportId]/page.tsx              — Report embed (read-only ReportViewer)
├── test-harness/page.tsx                   — All 5 widgets with live data, status indicators
├── demo-site/layout.tsx                    — Demo brokerage site layout (own styling)
├── demo-site/page.tsx                      — Demo homepage (hero + metric cards + score)
├── demo-site/market-data/page.tsx          — Demo market data (map + charts)
├── demo-site/report/page.tsx               — Demo report page
├── demo-site/components/DemoNav.tsx        — Fake brokerage navigation
├── demo-site/components/DemoHero.tsx       — Fake brokerage hero section
├── demo-site/components/DemoSection.tsx    — Reusable section wrapper

packages/frontend/app/org/[slug]/admin/embeds/
├── WidgetConfigurator.tsx                  — Main config wizard (replaces WidgetGallery)
├── configurator/ScoreConfigurator.tsx      — Score widget config form
├── configurator/MetricConfigurator.tsx     — Metric card config form
├── configurator/MapConfigurator.tsx        — Map feature toggles
├── configurator/ChartConfigurator.tsx      — Chart config (metric + geos + range)
├── configurator/ReportConfigurator.tsx     — Report picker
├── configurator/GeographySearch.tsx        — Shared geography autocomplete
├── configurator/EmbedPreview.tsx           — Live iframe preview + embed code
├── configurator/ShapeSizeSelector.tsx      — Shape/size picker (reuse from gallery)
```

### Files to modify:

```
packages/frontend/app/org/[slug]/admin/embeds/page.tsx  — Replace WidgetGallery with WidgetConfigurator
packages/frontend/lib/data/fetchers/org-embeds.ts       — Add widget_types: 'chart', 'map_full', 'report'
packages/backend/src/org-embeds/org-embeds.service.ts    — Add new widget types to validation
```

---

## Task 1: Chart Embed Route

**Files:**

- Create: `packages/frontend/app/embed/chart/page.tsx`

- [ ] **Step 1: Create the chart embed page**

Client component that reads URL params (`metric`, `geo`, `ids`, `range`, `chart_type`, `show_national`), fetches time series data for each geography ID, and renders a Recharts `LineChart` or `AreaChart`.

URL pattern: `/embed/chart?token=emb_xxx&metric=home_value&geo=metro&ids=31080,35620&range=3y&chart_type=line&show_national=1`

Key logic:

- Parse `ids` as comma-separated string → array (max 3)
- Fetch `fetchTimeSeriesData(metric, geo, id)` for each ID in parallel
- If `show_national=1`, fetch national benchmark: `fetchTimeSeriesData(metric, 'state', 'US')`
- Compute date range from `range` param: `1y`=12mo, `3y`=36mo, `5y`=60mo, `10y`=120mo
- Render Recharts `LineChart` (or `AreaChart` if `chart_type=area`) with:
  - One `<Line>` per geography, color-coded (blue, green, orange)
  - Optional dashed gray `<Line>` for national benchmark
  - `<XAxis>` with date formatting, `<YAxis>` with metric formatting
  - `<Tooltip>` showing all values at hovered date
  - `<Legend>` with geography names
- Use `formatMetricValue` from `@/lib/data` for Y-axis and tooltip formatting
- Use `getMetricTitle` from the metric registry for the chart title
- Responsive: `<ResponsiveContainer width="100%" height="100%">`

- [ ] **Step 2: Verify with tsc and commit**

```bash
git add packages/frontend/app/embed/chart/
git commit -m "feat: chart embed route — time series with multi-geography comparison"
```

---

## Task 2: Full Interactive Map Embed Route

**Files:**

- Create: `packages/frontend/app/embed/map-full/page.tsx`
- Create: `packages/frontend/app/embed/map-full/useEmbedMapConfig.ts`
- Create: `packages/frontend/app/embed/map-full/EmbedMapToolbar.tsx`

- [ ] **Step 1: Create useEmbedMapConfig hook**

Parses all URL params into a typed config object:

```typescript
interface EmbedMapConfig {
  showSidebar: boolean;
  showSearch: boolean;
  showLegend: boolean;
  showScores: boolean;
  showGeoPills: boolean;
  showMetricPicker: boolean;
  showDetailPanel: boolean;
  initialMetric: string;
  initialGeoLevel: GeoLevel;
  initialCenter: [number, number];
  initialZoom: number;
  token: string;
}
```

Parse from `useSearchParams()`: `sidebar=0|1`, `search=0|1`, `legend=0|1`, `scores=0|1`, `geo_pills=0|1`, `metric_picker=0|1`, `detail_panel=0|1`, `metric=string`, `geo=string`, `center=lng,lat`, `zoom=number`.

- [ ] **Step 2: Create EmbedMapToolbar**

A compact toolbar rendered above the map. Conditionally shows:

- Metric dropdown (from metric registry, filtered by current geo level)
- Geography level pills (State/Metro/County/ZIP)
- Search widget

All controlled by the config flags.

- [ ] **Step 3: Create the full map embed page**

This page replicates the core map experience from `/app/map/page.tsx` but without the app chrome. It:

- Initializes Mapbox GL with the same token, style, and config
- Uses `useMapData()` and `useMapLayers()` from `@/app/map/hooks/`
- Conditionally renders: SearchWidget, GeoLevelPills, Legend, Sidebar, RightDetailPanel
- Wraps in EmbedShell (inherited from layout) for branding bar
- State management: geoLevel, selectedMetric, selectedState, selectedGeography, mapData, mapLoaded

The page imports from `@/app/map/` — it does NOT duplicate the hooks or components.

```typescript
import { useMapData } from "@/app/map/hooks/useMapData";
import { useMapLayers } from "@/app/map/hooks/useMapLayers";
import { SearchWidget } from "@/app/map/components/SearchWidget";
import { GeoLevelPills } from "@/app/map/components/GeoLevelPills";
import { Legend } from "@/app/map/components/Legend";
import { Sidebar } from "@/app/map/components/Sidebar";
import { RightDetailPanel } from "@/app/map/components/RightDetailPanel/RightDetailPanel";
```

Keep the file under 400 lines by extracting toolbar and config into separate files.

- [ ] **Step 4: Verify and commit**

```bash
git add packages/frontend/app/embed/map-full/
git commit -m "feat: full interactive map embed — configurable features via URL params"
```

---

## Task 3: Report Embed Route

**Files:**

- Create: `packages/frontend/app/embed/report/[reportId]/page.tsx`

- [ ] **Step 1: Create the report embed page**

Client component that wraps `ReportViewer` with minimal chrome:

```typescript
"use client";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { ReportViewer } from "@/app/reports/[id]/ReportViewer";
import { EmbedLoadingSkeleton } from "../../components";
```

Key differences from the main report page:

- NO `EntitlementGate` wrapper (embed token controls access)
- NO `ConversationPanel` (no AI chat in embed mode)
- NO navigation breadcrumbs
- Import report theme CSS: `@/app/reports/styles/report-theme.css`
- `ReportViewer` handles polling and section rendering internally

The page is simple — just extract `reportId` from params and render `<ReportViewer reportId={reportId} />`.

- [ ] **Step 2: Verify and commit**

```bash
git add packages/frontend/app/embed/report/
git commit -m "feat: report embed route — read-only branded report viewer"
```

---

## Task 4: Backend — Add New Widget Types

**Files:**

- Modify: `packages/backend/src/org-embeds/org-embeds.service.ts`
- Modify: `packages/backend/src/org-embeds/dto/create-embed-token.dto.ts`

- [ ] **Step 1: Update widget type validation**

Add `'chart'`, `'map_full'`, `'report'` to the allowed widget types. Find where widget_types are validated in the DTO or service and add the new values.

Currently allowed: `'score'`, `'metric_card'`, `'map'`
New: `'score'`, `'metric_card'`, `'map'`, `'chart'`, `'map_full'`, `'report'`

- [ ] **Step 2: Verify and commit**

```bash
git add packages/backend/src/org-embeds/
git commit -m "feat: add chart, map_full, report to embed widget types"
```

---

## Task 5: Geography Search Component for Wizard

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/embeds/configurator/GeographySearch.tsx`

- [ ] **Step 1: Create geography search autocomplete**

A reusable component for the configuration wizard. When the user types a location name, it searches across all geography levels and returns `{ id, name, geoLevel }`.

Use `fetchGeographySearch` from `@/lib/data` (same as the map's search widget).

Props:

```typescript
interface GeographySearchProps {
  onSelect: (result: { id: string; name: string; geoLevel: string }) => void;
  geoLevelFilter?: string; // Optional: restrict to one level
  placeholder?: string;
}
```

Renders: text input with dropdown results showing geography name + level badge.

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/org/[slug]/admin/embeds/configurator/
git commit -m "feat: geography search autocomplete for embed config wizard"
```

---

## Task 6: Embed Preview + Code Component

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/embeds/configurator/EmbedPreview.tsx`
- Create: `packages/frontend/app/org/[slug]/admin/embeds/configurator/ShapeSizeSelector.tsx`

- [ ] **Step 1: Create ShapeSizeSelector**

Reuse the pill toggle pattern from the existing WidgetGallery. Returns `{ width, height }` based on shape (square/horizontal/vertical) and size (small/medium/large).

- [ ] **Step 2: Create EmbedPreview**

Two sections:

1. **Live preview** — actual `<iframe>` pointing to the configured embed URL with the user's token
2. **Embed code** — generated `<iframe src="..." width="X" height="Y">` in a copyable code block with a "Copy Code" button

Props:

```typescript
interface EmbedPreviewProps {
  embedUrl: string; // Full URL (e.g., /embed/score/metro/31080?...)
  width: number;
  height: number;
  token: string;
}
```

The iframe src combines `window.location.origin + embedUrl + &token=xxx`.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/org/[slug]/admin/embeds/configurator/
git commit -m "feat: embed preview with live iframe and copy-paste code generation"
```

---

## Task 7: Widget Configurators (5 types)

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/embeds/configurator/ScoreConfigurator.tsx`
- Create: `packages/frontend/app/org/[slug]/admin/embeds/configurator/MetricConfigurator.tsx`
- Create: `packages/frontend/app/org/[slug]/admin/embeds/configurator/MapConfigurator.tsx`
- Create: `packages/frontend/app/org/[slug]/admin/embeds/configurator/ChartConfigurator.tsx`
- Create: `packages/frontend/app/org/[slug]/admin/embeds/configurator/ReportConfigurator.tsx`

- [ ] **Step 1: ScoreConfigurator**

Form with:

- Score type dropdown: HomeReady, InvestorEdge, Market Health
- Geography search (using GeographySearch component)
- Outputs embed URL: `/embed/score/${geoLevel}/${geoId}?scoreType=${type}`

- [ ] **Step 2: MetricConfigurator**

Form with:

- Metric dropdown (populated from metric registry, filtered by selected geo level)
- Geography search
- Outputs embed URL: `/embed/metric-card/${metricId}/${geoLevel}/${geoId}`

- [ ] **Step 3: MapConfigurator**

Form with toggles for each URL param:

- Sidebar (checkbox, default off)
- Search bar (checkbox, default on)
- Legend (checkbox, default on)
- Score cards (checkbox, default off)
- Geo level pills (checkbox, default on)
- Metric picker (checkbox, default on)
- Detail panel (checkbox, default on)
- Initial metric dropdown
- Initial geo level dropdown
- Outputs embed URL: `/embed/map-full?sidebar=0&search=1&...`

- [ ] **Step 4: ChartConfigurator**

Form with:

- Metric dropdown
- Geography search (add up to 3 with + button)
- Time range selector: 1Y, 3Y, 5Y, 10Y
- Chart type: Line / Area
- National benchmark toggle
- Outputs embed URL: `/embed/chart?metric=X&geo=Y&ids=A,B,C&range=3y&chart_type=line&show_national=1`

- [ ] **Step 5: ReportConfigurator**

Form with:

- Report picker (dropdown of user's generated reports, fetched via `fetchReportList`)
- Outputs embed URL: `/embed/report/${reportId}`

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/org/[slug]/admin/embeds/configurator/
git commit -m "feat: 5 widget configurators — score, metric, map, chart, report"
```

---

## Task 8: Main Widget Configurator + Page Integration

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/embeds/WidgetConfigurator.tsx`
- Modify: `packages/frontend/app/org/[slug]/admin/embeds/page.tsx`

- [ ] **Step 1: Create WidgetConfigurator**

Top-level wizard component with:

1. Widget type selector (5 cards: Score, Metric Card, Map, Chart, Report)
2. Active configurator (renders the selected type's configurator)
3. Shape/size selector
4. Live preview (EmbedPreview with iframe)

State management: `selectedType`, `embedUrl` (built by configurator), `shape`, `size`.

Requires an active embed token — reads from the token list on the page. If no tokens exist, shows "Create a token first" message.

- [ ] **Step 2: Replace WidgetGallery on the embeds page**

In `page.tsx`, replace `<WidgetGallery>` with `<WidgetConfigurator>`. Pass the first active token as a prop.

Remove the old `WidgetGallery.tsx` and `WidgetMockups.tsx` files.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/org/[slug]/admin/embeds/
git commit -m "feat: widget configurator wizard with live preview — replaces static gallery"
```

---

## Task 9: Test Harness

**Files:**

- Create: `packages/frontend/app/embed/test-harness/page.tsx`

- [ ] **Step 1: Create test harness page**

A full-page layout with ALL 5 widget types embedded as real iframes. Each iframe uses hardcoded geography IDs for known-good data:

- Score: HomeReady for Dallas metro (31080)
- Score: InvestorEdge for Harris County (48201)
- Metric Card: home_value for Dallas metro (31080)
- Metric Card: rent_index for ZIP 75201
- Map: Full interactive with all features enabled
- Chart: home_value 3Y for Dallas (31080) vs Houston (26420)
- Chart: rent_index 5Y for 3 metros + national
- Report: sample report (if available)

Each iframe has a status indicator that listens for the `load` event and shows ✅ or ❌.

The page also shows the embed token being used and a timestamp.

No mockups. Every widget loads live production data.

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/embed/test-harness/
git commit -m "feat: embed test harness — all 5 widgets with live data, status indicators"
```

---

## Task 10: Demo Brokerage Site

**Files:**

- Create: `packages/frontend/app/embed/demo-site/layout.tsx`
- Create: `packages/frontend/app/embed/demo-site/page.tsx`
- Create: `packages/frontend/app/embed/demo-site/market-data/page.tsx`
- Create: `packages/frontend/app/embed/demo-site/report/page.tsx`
- Create: `packages/frontend/app/embed/demo-site/components/DemoNav.tsx`
- Create: `packages/frontend/app/embed/demo-site/components/DemoHero.tsx`
- Create: `packages/frontend/app/embed/demo-site/components/DemoSection.tsx`

- [ ] **Step 1: Create demo site layout**

Standalone layout with its own styling — NOT the PropertyIQ design system. Use:

- White/navy color scheme
- Serif headings (Georgia or Playfair Display)
- Clean professional brokerage look
- Navigation: Home, Market Data, Market Report
- Footer: "Powered by PropertyIQ"

This is a SEPARATE layout from the embed layout — it's a fake brokerage site that CONTAINS embed iframes.

- [ ] **Step 2: Create demo homepage**

"Acme Real Estate Group" homepage with:

- Hero section with brokerage branding
- "Market Snapshot" section with 3 metric card iframes (home value, rent, days on market for a Dallas metro)
- "Market Health" section with score widget iframe (market health for Dallas metro)

- [ ] **Step 3: Create demo market data page**

- Full interactive map embed iframe (with search, legend, metric picker, geo pills)
- Two chart iframes below: home value trends (Dallas vs Houston), rent comparison (3 metros)

- [ ] **Step 4: Create demo report page**

- Embedded report viewer iframe showing a sample report

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/embed/demo-site/
git commit -m "feat: demo brokerage site — Acme Real Estate with embedded PropertyIQ widgets"
```

---

## Task 11: Playwright E2E Tests (Live Data)

**Files:**

- Create: `packages/frontend/tests/e2e/embed-widgets.spec.ts`

- [ ] **Step 1: Write live Playwright tests**

NO MOCKS. Hit production. Tests:

1. Load test harness page — verify all 5 widget sections render
2. Score iframe loads — check iframe is not empty, contains score number
3. Metric card iframe loads — check iframe contains formatted value
4. Map iframe loads — check iframe contains Mapbox canvas
5. Chart iframe loads — check iframe contains SVG paths (Recharts)
6. Report iframe loads (if sample available) — check iframe contains report content
7. Demo site homepage loads — verify metric cards and score widget render
8. Demo site market data page — verify map and charts render
9. Configuration wizard loads — verify widget type selector is visible
10. Configuration wizard generates embed code — select score, pick geography, verify iframe preview and code block

Use `page.frameLocator('iframe')` to inspect iframe contents.

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/tests/e2e/embed-widgets.spec.ts
git commit -m "test: Playwright E2E for all embed widgets — live data, no mocks"
```

---

## Summary

| Task | Feature                  | Files      | Parallel?          |
| ---- | ------------------------ | ---------- | ------------------ |
| 1    | Chart embed route        | 1 new      | Yes (with 2, 3, 4) |
| 2    | Full map embed route     | 3 new      | Yes (with 1, 3, 4) |
| 3    | Report embed route       | 1 new      | Yes (with 1, 2, 4) |
| 4    | Backend widget types     | 2 modified | Yes (with 1, 2, 3) |
| 5    | Geography search         | 1 new      | Yes (with 6)       |
| 6    | Embed preview + code     | 2 new      | Yes (with 5)       |
| 7    | Widget configurators (5) | 5 new      | Depends on 5, 6    |
| 8    | Main wizard + page       | 2 files    | Depends on 7       |
| 9    | Test harness             | 1 new      | Depends on 1, 2, 3 |
| 10   | Demo brokerage site      | 7 new      | Depends on 1, 2, 3 |
| 11   | Playwright tests         | 1 new      | Depends on 9, 10   |

**Total: 11 tasks. Tasks 1-4 are fully parallel. Tasks 5-6 are parallel. Tasks 7-8 are sequential. Tasks 9-10 are parallel after 1-3. Task 11 is last.**
