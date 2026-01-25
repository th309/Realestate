# Design and Data Flow Reference

Reference derived from the PropertyIQ Maps dashboard (current UI). Use this when aligning design elements and data flow.

---

## 1. Layout Structure

| Zone | Description | M3 / Notes |
|------|-------------|------------|
| **Top header** | Logo (PropertyIQ), primary nav (Home, Maps, Graphs, Reports, About us, Pricing), Log in / Get Started | Nav rail or top app bar; "Maps" active state (light purple). |
| **Search bar** | Full-width below header: magnifier, "Search city, zip, or county", hamburger left | M3 Search Bar (View): `rounded-full`, `h-14`, `bg-surface-container-high`. |
| **Left sidebar** | Vertically: nav icons (Home, Maps, Graphs, Reports, About us, Pricing) + Market Trends panel | M3 Navigation Drawer: `bg-surface-container-low`, fixed left. |
| **Main map** | Choropleth US map (county/state), legend bottom-left, "Table View" FAB bottom-right | Mapbox; legend uses metric gradient; "No data available" option. |
| **Right panel** | "Analysis View" for selected location (e.g. McLean, IL), closable | M3 Standard Side Sheet: `bg-surface-container-low`, `border-l`. |
| **Footer** | Single disclaimer line across bottom | Informational only. |

---

## 2. Left Sidebar – Market Trends Panel

- **User type tabs:** "Homebuyer/Renter" (active) | "Investor" → M3 **Filter Chips** or tab strip.
- **HomeReady Score card:**
  - Circular gauge with numeric score (e.g. 75), label "C GOOD".
  - 3-month change (e.g. "0.0 pts").
  - PRO badge.
  - Carousel cues (arrows/dots) for multiple scores.
- **Collapsible sections:**
  - **Affordability** – "Can I afford to live here?"  
    Metrics (examples): Listing Price (New), Income to Buy (New), Affordable Home Price (New), Price Per Sq Ft (New), Years to Save (PRO), Home Value YoY, 5-Year Growth (PRO). Each with optional info icon.
  - **Market Competition** – "Should I act fast?"
  - **Pricing & Deals** – "Are prices going up or down?"
- **Design cues:** "New" labels, "PRO" badges, small (i) for tooltips.

---

## 3. Map Area

- **Content:** US choropleth; state/county boundaries; place labels (cities, states).
- **Legend:** "HomeReady Score" gradient (e.g. 0 → 100), checkbox "No data available."
- **Controls:** Mapbox branding; "Table View" FAB (purple) bottom-right.
- **Data flow:** Metric selection (e.g. HomeReady Score) drives fill color; geography level from app state; "No data" drives which regions are shown/grayed.

---

## 4. Right Panel – Analysis View

- **Header:** "ANALYSIS VIEW", location name (e.g. "McLean, IL"), close (X).
- **Geo scope chips:** National | State | Metro | **County** (active) | City | Zip → same as `GeoLevel` / `supportedGeos`.
- **Scores:**
  - **HomeReady Score:** Large circular gauge (e.g. 75 GOOD, green), "+0.0%" change, short description.
  - **InvestorEdge:** Smaller gauge (e.g. 69, orange), "0% vs prev".
  - **Market Health:** Smaller gauge (e.g. 59, red), "0% vs prev".
- **Home Buyer/Renter Insight:** Text block (e.g. "McLean, IL is currently a buyer-friendly market…").
- **Market Factors:** "Key elements influencing the score" – cards for APPRECIATION, UNEMPLOYMENT, PRICE FORECAST, INVENTORY (value placeholders "--" when empty).
- **Data flow:** Selection (search or map click) sets location → panel shows scores and insight for that geography; scope chips filter or reload by geo level.

---

## 5. Data Flow Summary (from UI)

1. **Search** ("city, zip, or county") → sets current location/region → updates Analysis View and may recenter map.
2. **Metric/category in sidebar** (e.g. Affordability, Market Competition) → drives which metric(s) the map and legend show; PRO/New affects visibility or gating.
3. **Map click or scope change** (National/State/Metro/County/City/Zip) → updates right-panel geography and refetches scores + insight.
4. **Scores:** HomeReady, InvestorEdge, Market Health (and optionally carousel) come from backend for current `geographyType` + `geographyId`; use `ScoreWidget` / `ScoreDisplay` and existing hooks.
5. **Market Factors** and insight text are either derived from same scores or separate API payload; "Double click to edit" suggests editable or placeholder content in current build.

---

## 6. Design Tokens / Consistency

- **Active state:** Light purple (e.g. Maps nav, County chip).
- **Primary actions:** Purple ("Get Started", "Table View" FAB).
- **Score colors:** Green (good), orange (mid), red (lower) – align with `ScoreDisplay` / `getScoreColor()`.
- **Cards:** Elevated surfaces for score card and factor cards; collapsible sections for sidebar groups.
- **Badges:** "New", "PRO" – tier/feature visibility; align with feature gating and metric config.

Use this reference when changing layout, adding components, or tracing where data (metrics, geography, scores) enters and updates each part of the Maps page.
