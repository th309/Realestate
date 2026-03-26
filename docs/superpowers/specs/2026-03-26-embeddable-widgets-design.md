# Embeddable Widgets System — Design Spec

**Date:** 2026-03-26
**Status:** Draft
**Scope:** 5 live-data embeddable widgets, configuration wizard, test harness, demo brokerage site

---

## Overview

Enterprise users can embed live PropertyIQ widgets on their websites via iframe. Each widget is configured through a visual wizard in the org admin portal, shows a live data preview, and generates a copy-paste embed code. A test harness and demo brokerage site verify all widgets render correctly with live production data.

---

## 1. Widget Types

### 1a. Score Widget

**URL:** `/embed/score/:geoLevel/:geoId?scoreType=homeready&token=emb_xxx`
**Status:** Exists — needs configuration wizard integration
**Displays:** Score ring (0-100) with confidence badge, grade label, location name
**Configurable:** Score type (HomeReady, InvestorEdge, Market Health), geography

### 1b. Metric Card Widget

**URL:** `/embed/metric-card/:metricId/:geoLevel/:geoId?token=emb_xxx`
**Status:** Exists — needs configuration wizard integration
**Displays:** Metric value, trend badge, sparkline, location, data freshness date
**Configurable:** Metric (home value, rent, unemployment, etc.), geography

### 1c. Interactive Map Widget

**URL:** `/embed/map-full?token=emb_xxx&sidebar=0&search=1&legend=1&scores=0&metric=home_value&geo=state`
**Status:** New — full interactive map, not the existing mini map
**Displays:** Full Mapbox GL map with choropleth, click-to-explore, metric switching
**Configurable via URL params:**

| Param           | Default      | Description                   |
| --------------- | ------------ | ----------------------------- |
| `sidebar`       | `0`          | Show metric category sidebar  |
| `search`        | `1`          | Show geography search bar     |
| `legend`        | `1`          | Show color scale legend       |
| `scores`        | `0`          | Show score cards              |
| `geo_pills`     | `1`          | Show geography level toggles  |
| `metric_picker` | `1`          | Show metric dropdown          |
| `detail_panel`  | `1`          | Show right-click detail panel |
| `metric`        | `home_value` | Initial metric                |
| `geo`           | `state`      | Initial geography level       |
| `center`        | `-98.5,39.8` | Initial map center (lng,lat)  |
| `zoom`          | `4`          | Initial zoom level            |

### 1d. Chart Widget (Time Series + Comparison)

**URL:** `/embed/chart?token=emb_xxx&metric=home_value&geo=metro&ids=31080,35620,12420&range=5y`
**Status:** New
**Displays:** Line/area chart showing metric over time for 1-3 geographies
**Configurable:**

| Param           | Default  | Description                         |
| --------------- | -------- | ----------------------------------- |
| `metric`        | required | Metric ID                           |
| `geo`           | required | Geography level                     |
| `ids`           | required | Comma-separated geography IDs (1-3) |
| `range`         | `3y`     | Time range: `1y`, `3y`, `5y`, `10y` |
| `chart_type`    | `line`   | `line` or `area`                    |
| `show_national` | `1`      | Show national benchmark line        |

### 1e. Report Widget

**URL:** `/embed/report/:reportId?token=emb_xxx`
**Status:** New
**Displays:** Full branded market report in read-only mode
**Notes:** Uses existing `ReportViewer` wrapped in embed layout. Polling handles "generating" state. No conversation panel or personalization in embed mode. Report must be pre-generated and shared via the report's share_token or embed token.

---

## 2. Configuration Wizard

Replaces the static widget gallery on the embed tokens page. Lives in the org admin portal at `/org/:slug/admin/embeds`.

### Wizard Flow

1. **Select widget type** — 5 cards (Score, Metric Card, Map, Chart, Report)
2. **Configure data** — type-specific form:
   - Score: score type dropdown + geography search (level + autocomplete)
   - Metric Card: metric dropdown + geography search
   - Map: feature toggles (sidebar, search, legend, etc.) + initial metric + geo level
   - Chart: metric dropdown + geography search (add up to 3) + range + chart type
   - Report: select from generated reports list
3. **Select shape/size** — square, horizontal, vertical + small/medium/large (generates pixel dimensions)
4. **Live preview** — actual `<iframe>` loading the real embed URL with the user's token. No mockups.
5. **Copy embed code** — `<iframe src="..." width="X" height="Y" frameborder="0"></iframe>` with a copy button

### Geography Search in Wizard

Reuse the existing `SearchWidget` pattern or `useUniversalSearch` hook. Autocomplete dropdown that returns `{ id, name, geoLevel }`. The wizard needs to search across all geography levels to let the user find their market.

### Live Preview

The preview section renders an actual `<iframe>` element pointing to the configured embed URL. The iframe is sized according to the selected shape/size. This proves the widget works before the user copies the code.

```tsx
<iframe
  src={`${window.location.origin}/embed/score/metro/31080?scoreType=homeready&token=${activeToken}`}
  width={dimensions.width}
  height={dimensions.height}
  frameBorder="0"
  style={{ borderRadius: 8 }}
/>
```

---

## 3. Full Interactive Map Embed

### Architecture

New route: `/embed/map-full/page.tsx` (client component)

This is NOT the existing `EmbedMiniMap` (static choropleth). This is the full PropertyIQ map experience rendered without the app header/footer, with configurable UI elements.

### Components to reuse from `/app/map/`:

| Component                | Reuse                      | Notes                           |
| ------------------------ | -------------------------- | ------------------------------- |
| Mapbox GL initialization | Copy pattern from map page | Same token, tiles, config       |
| `useMapData`             | Direct import              | Fetches choropleth data         |
| `useMapLayers`           | Direct import              | Renders GeoJSON layers          |
| `SearchWidget`           | Conditional render         | Controlled by `?search=1`       |
| `GeoLevelPills`          | Conditional render         | Controlled by `?geo_pills=1`    |
| `Legend`                 | Conditional render         | Controlled by `?legend=1`       |
| `Sidebar`                | Conditional render         | Controlled by `?sidebar=1`      |
| `RightDetailPanel`       | Conditional render         | Controlled by `?detail_panel=1` |

### What's different from the main map page:

1. No app header, footer, or breadcrumbs
2. No paywall overlays (embed token controls access)
3. No tour/onboarding
4. No analytics tracking (or minimal embed-specific tracking)
5. URL params control visible UI elements
6. Wrapped in `EmbedShell` for branding bar
7. No score view mode (homebuyer/investor toggle) unless `?scores=1`

### Layout structure:

```
EmbedShell (branding bar)
  └─ EmbedMapFull
       ├─ [if sidebar=1] Sidebar (left panel)
       ├─ MapContainer (Mapbox GL)
       │   ├─ [if search=1] SearchWidget (top overlay)
       │   ├─ [if geo_pills=1] GeoLevelPills (top bar)
       │   ├─ [if metric_picker=1] MetricDropdown (top bar)
       │   └─ [if legend=1] Legend (bottom overlay)
       └─ [if detail_panel=1] RightDetailPanel (right slide-out)
```

---

## 4. Chart Embed

### Architecture

New route: `/embed/chart/page.tsx` (client component)

Renders a time series line/area chart for 1-3 geographies with an optional national benchmark.

### Data flow:

1. Parse URL params: `metric`, `geo`, `ids` (comma-separated), `range`, `chart_type`, `show_national`
2. Fetch time series data for each geography ID using `fetchTimeSeriesData(metricId, geoLevel, geoId)`
3. If `show_national=1`, fetch national benchmark via `fetchTimeSeriesData(metricId, 'state', 'national')`
4. Render using `AnimatedTimeSeriesChart` from graphs components, or a simplified Recharts chart

### Chart component:

- Recharts `LineChart` or `AreaChart`
- One line per geography, color-coded
- Legend showing geography names
- X-axis: dates, Y-axis: metric values (formatted)
- Optional: national benchmark as dashed gray line
- Responsive: fills container width
- Tooltip: shows all values at hovered date

### Configurable via URL:

```
/embed/chart?token=emb_xxx&metric=home_value&geo=metro&ids=31080,35620&range=3y&chart_type=line&show_national=1
```

---

## 5. Report Embed

### Architecture

New route: `/embed/report/:reportId/page.tsx` (client component)

Wraps the existing `ReportViewer` in the embed layout with minimal chrome.

### What's included:

- Full report rendering (all sections based on template)
- Branding (org logo, accent color via EmbedShell)
- Polling for "generating" status
- Print-friendly styles

### What's excluded:

- Conversation panel (AI chat about the report)
- Personalization panel
- Agent mode toggle
- Report regeneration controls
- Navigation breadcrumbs

### Access control:

- Report must have `share_access_level = 'public'` OR be accessed with a valid embed token that belongs to the report's organization
- The embed token's `widget_types` must include `'report'`

---

## 6. Test Harness

### Purpose

A standalone page that embeds ALL 5 widget types with live production data. No mockups. Proves every widget renders correctly.

### Location

`/embed/test-harness` — only accessible in dev/staging or with admin auth

### Content

A full-page layout with:

```
┌─────────────────────────────────────────────────────────┐
│  PropertyIQ Embed Test Harness                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SCORE WIDGET (3 variants)                              │
│  ┌──────────┐ ┌────────────────┐ ┌──────┐              │
│  │ HomeReady│ │ InvestorEdge   │ │Market│              │
│  │ Metro    │ │ County         │ │Health│              │
│  │ 31080    │ │ 48113          │ │State │              │
│  └──────────┘ └────────────────┘ └──────┘              │
│                                                         │
│  METRIC CARD (3 variants)                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │Home Value│ │Rent Index│ │Days on   │               │
│  │Metro     │ │ZIP       │ │Market    │               │
│  └──────────┘ └──────────┘ └──────────┘               │
│                                                         │
│  INTERACTIVE MAP (full width)                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  [Full interactive map with all features]        │   │
│  │  search=1 legend=1 geo_pills=1 metric_picker=1  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  CHART (2 variants)                                     │
│  ┌──────────────────────┐ ┌──────────────────────┐     │
│  │ Home Value 3Y        │ │ Rent 5Y comparison   │     │
│  │ Dallas vs Houston    │ │ 3 metros + national  │     │
│  └──────────────────────┘ └──────────────────────┘     │
│                                                         │
│  REPORT (if available)                                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  [Embedded report viewer]                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  STATUS: ✅ All 5 widgets rendering with live data      │
└─────────────────────────────────────────────────────────┘
```

Each widget is an actual `<iframe>` hitting the real embed URLs. A status indicator shows whether each iframe loaded successfully (listen for load/error events).

---

## 7. Demo Brokerage Site

### Purpose

A polished fake brokerage website ("Acme Real Estate Group") that demonstrates how enterprise clients would embed PropertyIQ widgets. This is a sales/demo tool.

### Location

`/embed/demo-site` — public, shows the embed experience

### Pages:

**Homepage:**

- Hero section with brokerage branding
- "Market Snapshot" section with 3 metric cards (home value, rent, days on market)
- Score widget showing market health for their area

**Market Data page:**

- Full interactive map embed (with search, legend, metric picker)
- Two chart widgets below showing home value trends and rent comparisons

**Market Report page:**

- Embedded report viewer showing a sample report

### Styling:

- Clean, professional brokerage look (NOT PropertyIQ design system)
- White/navy color scheme, serif headings
- Demonstrates that widgets blend into the host site's design via the accent color branding

---

## 8. Implementation Order

1. **Chart embed route** — new `/embed/chart/` with time series + comparison
2. **Full map embed route** — new `/embed/map-full/` with configurable features
3. **Report embed route** — new `/embed/report/:reportId/`
4. **Configuration wizard** — replace static gallery with live-data config + preview
5. **Test harness** — `/embed/test-harness` with all 5 widgets
6. **Demo brokerage site** — `/embed/demo-site` with polished presentation

Steps 1-3 are independent and can be built in parallel. Step 4 depends on 1-3. Steps 5-6 depend on 4.

---

## 9. Backend Changes

### New endpoints needed:

None for score, metric card, or mini map (already exist).

**Chart data:** Use existing `fetchTimeSeriesData` from the data layer. No new backend endpoint — the embed chart page calls the same API the main app uses, authenticated via the embed token's org-level access.

**Report access:** Add `widget_types` check for `'report'` in the `EmbedTokenGuard`. Add report ID validation — the report must belong to the same org as the token.

**Full map:** Uses the same GeoJSON tile endpoints and metric data APIs as the main map. No new backend endpoints.

### Embed token guard updates:

Add `'chart'`, `'map_full'`, `'report'` to the allowed `widget_types` enum. Currently supports: `'score'`, `'metric_card'`, `'map'`.

---

## 10. Testing

### Automated (Playwright against production):

1. Load test harness page
2. Verify all 5 iframe widgets load (no error states)
3. For each widget: check that the iframe's content is not empty and contains expected text/elements
4. Interactive tests: click on map features, hover on chart data points
5. Verify embed code copy button produces valid HTML

### Manual verification:

1. Create embed token in org admin
2. Configure each widget type in the wizard
3. Verify live preview shows real data
4. Copy embed code, paste into a standalone HTML file, open in browser
5. Verify data matches what's shown on the main PropertyIQ site

---

## 11. Out of Scope

- Embed analytics dashboard (tracking how many times widgets are viewed)
- Custom CSS injection for widgets
- Real-time data push (widgets refresh on page load, not live-updating)
- Mobile-specific embed layouts
- D3 visualization embeds (scatter, radar, waterfall — future phase)
- Embed token scoping by geography (all tokens have full geo access)
