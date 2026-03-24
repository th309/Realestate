# Adaptive State Label Positioning

**Date:** 2026-03-24
**Status:** Approved
**Scope:** `packages/frontend/app/map/hooks/useMapLayers.ts` + new utilities

## Problem

State labels on the choropleth map are positioned at bounding-box centroids, which causes:

1. **Irregular states** (Florida, Michigan, Louisiana) have labels in the ocean or on water
2. **Small NE states** (MD, DE, CT, RI, NJ, MA, NH) have labels hidden by Mapbox collision detection
3. **Maryland** label is completely invisible at overview zoom

**Why `text-variable-anchor` isn't enough:** The existing `geo-labels` layer already uses `text-variable-anchor: ['center', 'top', 'bottom', 'left', 'right']` to shift labels to alternate positions. However, Mapbox still hides labels entirely rather than showing them at poor anchors when the feature is too small on screen. For clustered NE states, there is simply no valid anchor position within the polygon that avoids collision — so the labels disappear.

## Solution

Three-part approach: better centroid algorithm + screen-space small-state detection + leader-line callouts with color-matched pills.

### 1. Polylabel Centroid Algorithm

Replace `calculateCentroid()` (bounding-box midpoint) with the **polylabel** algorithm (pole of inaccessibility). Polylabel finds the point inside a polygon that is farthest from any edge — guaranteeing the label anchor is always visually inside the state, even for irregular shapes.

**Dependency:** `@mapbox/polylabel@^1.0.2` — tiny library authored by the Mapbox team. Used internally by Mapbox Studio for label placement.

**What it fixes:**

- Florida: label moves from Gulf to inland central Florida
- Michigan: label lands on the lower peninsula instead of Lake Michigan
- Louisiana: label stays on land instead of drifting into the Gulf

**MultiPolygon handling:** States like Michigan (Upper + Lower Peninsula) are MultiPolygon geometries. `@mapbox/polylabel` operates on a single polygon ring. For MultiPolygons, compute the area of each polygon and run polylabel on the **largest polygon by area**. This ensures Michigan's label lands on the Lower Peninsula (the larger one), not the Upper Peninsula.

### 2. Screen-Space Small State Detection

On each `zoomend` event, calculate each state's **screen-space width**:

1. Get the polygon's bounding box (min/max lng/lat)
2. Project both corners to pixel coordinates using `map.project()`
3. Calculate pixel width = `abs(projectedMaxLng.x - projectedMinLng.x)`
4. Estimate label text width (character count × approximate font width at current size)
5. Compute `screenSpaceRatio = labelPixelWidth / statePixelWidth`
6. If `screenSpaceRatio > 1.0` → state needs a leader line

This is recalculated on zoom changes only (not on every frame). The `screenSpaceRatio` is stored as a numeric property on each feature for use in opacity interpolation.

**Behavior across zoom:**

- Zoom 3-4 (full US view): ~8-12 NE states flagged as small
- Zoom 5-6 (regional): fewer states flagged as they grow on screen
- Zoom 7+ (close-up): all states large enough — no leader lines needed

### 3. Leader Lines + Color-Matched Callout Labels

For states where `screenSpaceRatio > 1.0`:

#### Visual Design

- **Anchor dot:** Small circle (3-4px) at the state's polylabel point, semi-transparent white
- **Leader line:** Dashed line (1px, `rgba(255,255,255,0.5)`, dash pattern `[3, 2]`) from anchor to callout position. Rendered as a Mapbox `line` layer.
- **Callout pill:** Rendered as **HTML `mapboxgl.Marker` elements** (NOT a Mapbox symbol layer — see rationale below):
  - **Background:** Same color as the state's choropleth fill, computed using the same color scale function as `geo-fills`
  - **Text:** White, two lines — state name (bold, ~10px) + compact metric value (~9px)
  - **Border:** Subtle `rgba(255,255,255,0.2)` for definition against the ocean
  - **Border radius:** 6px (pill shape)
  - **Pointer events:** `pointer-events: none` — clicks pass through to the map/state polygons beneath

**Why HTML Markers instead of a symbol layer:** Mapbox GL symbol layers do not support data-driven background rectangles. There is no `text-background-color` paint property. Options considered:

| Approach                      | Pros                               | Cons                                                                                                 |
| ----------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Symbol layer + SDF icon       | All WebGL, fast                    | `icon-color` only tints monochrome — can't do colored bg + white text                                |
| Symbol layer + canvas sprites | All WebGL                          | Must generate and register a unique image per color value via `map.addImage()` — complex and fragile |
| **HTML Markers**              | Full CSS control, trivial to style | DOM elements, not WebGL. Acceptable for 8-12 elements.                                               |

With only 8-12 callout markers at most, the DOM overhead of HTML Markers is negligible. They automatically reposition on pan/zoom via Mapbox's internal Marker tracking.

#### Callout Positioning

Callout labels are positioned **east** of the NE states (over the Atlantic):

1. Start with a base longitude offset (e.g., polylabel lng + 3-5 degrees east)
2. Sort small states by latitude (north to south)
3. Space callouts vertically with a minimum gap (~0.8 degrees latitude) to prevent overlap
4. All callouts share the same longitude (aligned in a column) for visual cleanliness

The offset longitude and vertical spacing are computed dynamically from the set of small states at the current zoom — not hardcoded per state.

**Viewport edge behavior (known limitation for v1):** Callout positions are computed in geographic coordinates, not screen coordinates. If the user pans significantly west, callouts may move off the right edge of the viewport. This is acceptable for v1 because:

- The primary use case is the default US overview zoom where the Atlantic is visible
- Users who pan west are looking at western states, not NE callouts
- A v2 enhancement could recompute callout positions on `moveend` to keep them in-viewport

#### Zoom Transitions

- `screenSpaceRatio` is stored as a numeric property on each feature
- **Leader line + anchor dot opacity:** Mapbox `interpolate` expression:
  - `screenSpaceRatio >= 1.0` → opacity 1 (fully visible)
  - `screenSpaceRatio <= 0.8` → opacity 0 (fully hidden)
  - Between 0.8-1.0 → linear fade
- **Callout Markers:** JavaScript-managed opacity. On `zoomend`, iterate markers:
  - `screenSpaceRatio >= 1.0` → show marker (opacity 1)
  - `screenSpaceRatio <= 0.8` → hide marker (opacity 0, `display: none`)
  - Between 0.8-1.0 → CSS `opacity` transition
- **Centered labels (geo-labels):** Mapbox filter expression `['<=', ['get', 'screenSpaceRatio'], 1.0]` — shows centered labels only for states where the label fits
- This creates a smooth crossfade: as you zoom in, leader lines fade out while centered labels fade in

### 4. Mapbox Layer Structure

Current layers (bottom to top):

1. `geo-fills` — Choropleth polygon fills
2. `geo-borders` — White boundary lines
3. `geo-highlight` — Purple highlight for searched geography
4. `geo-labels` — Text labels (state name + value)

New layer structure:

1. `geo-fills` — Unchanged
2. `geo-borders` — Unchanged
3. `geo-highlight` — Unchanged
4. `leader-lines` — **NEW:** Line layer for dashed connector lines (Mapbox GL layer)
5. `leader-dots` — **NEW:** Circle layer for anchor points on small states (Mapbox GL layer)
6. `geo-labels` — Modified: adds filter `['<=', ['get', 'screenSpaceRatio'], 1.0]`
7. Callout pills — **NEW:** HTML `mapboxgl.Marker` elements (NOT a Mapbox layer — managed in JS)

**Source strategy:** Use a **single `geo-labels-data` source** with `screenSpaceRatio` as a property on each feature. Both `geo-labels` and `leader-dots` read from the same source with different filter expressions. This avoids duplicating source data and prevents the overhead of `setData()` on multiple sources per zoom change. Only the feature properties are updated on `zoomend` (via `source.setData()`), not the source structure.

`leader-lines` uses a separate `leader-line-data` source (LineString features) because it's a different geometry type.

### 5. Data Flow

```
GeoJSON state features loaded
  → calculatePolylabel(geometry) for each feature (replaces calculateCentroid)
  → Store polylabel point + bbox per feature

  → On zoomend (and initial load):
    → For each state: project bbox to pixels, compute screenSpaceRatio
    → Update geo-labels-data source with screenSpaceRatio property per feature
    → Identify states where screenSpaceRatio > 1.0
    → Compute callout positions (offset lng, stacked lat sorted N→S)
    → Update leader-line-data source (LineString features: polylabel → callout)
    → Create/update/remove HTML Markers for callout pills
    → Update marker opacity based on screenSpaceRatio (0.8-1.0 fade range)
```

### 6. Zoomend Listener Lifecycle

The `zoomend` listener must be carefully managed to avoid stale closures and memory leaks:

1. **Attachment:** Registered inside the label-layout module, called from `addMapLayers()`. Receives the map instance and current GeoJSON features as arguments.
2. **Cleanup on geo-level change:** When the user switches away from `state` view (to county, metro, etc.), the listener is removed via `map.off('zoomend', handler)` and all HTML Markers are removed. This happens in `removeExistingLayers()`.
3. **Cleanup on data update:** When new map data arrives (metric change, etc.), the old listener is removed and a new one is registered with fresh feature data. Uses the existing `updateIdRef` pattern to prevent race conditions.
4. **Cleanup on unmount:** The hook's cleanup function removes the listener and markers.

### 7. Layer Cleanup

The existing `removeExistingLayers()` function (and the duplicate removal block at ~line 140) must be updated to include:

**Layers to remove:** `['geo-fills', 'geo-borders', 'geo-labels', 'geo-highlight', 'leader-lines', 'leader-dots']`

**Sources to remove:** `['geo-data', 'geo-labels-data', 'leader-line-data']`

**HTML Markers:** All callout `mapboxgl.Marker` instances must be tracked in an array and `.remove()`d during cleanup. Both removal paths (the early-return cleanup at ~line 140 and `removeExistingLayers` at ~line 242) must handle this.

### 8. Edge Cases

| Case                    | Handling                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hawaii                  | Excluded — not visible at contiguous US zoom levels                                                                                                                      |
| Alaska                  | Excluded — separate viewport region, always large enough                                                                                                                 |
| DC                      | Treated as a small state — gets leader line at overview zoom                                                                                                             |
| Florida                 | Polylabel alone fixes this — label moves inland, no leader line needed                                                                                                   |
| West Virginia           | Narrow but tall — screen-space width check catches this correctly                                                                                                        |
| Michigan (MultiPolygon) | Polylabel runs on largest polygon by area (Lower Peninsula)                                                                                                              |
| National geo level      | Single centered label at US center (Kansas) — unchanged                                                                                                                  |
| `text-allow-overlap`    | Set `true` on `leader-dots` layer. `geo-labels` keeps existing collision behavior. Callout Markers are DOM elements and don't participate in Mapbox collision detection. |

### 9. Performance

- Polylabel runs once per GeoJSON load (50 states, ~1ms total)
- Screen-space calculation runs on `zoomend` only (not continuous), 50 states × simple projection = negligible
- No additional network requests — all computed client-side from existing GeoJSON
- HTML Markers: 8-12 DOM elements at most — negligible overhead
- One new Mapbox line layer + one circle layer: minimal rendering overhead

### 10. File Decomposition Plan

`useMapLayers.ts` is currently 759 lines — 2.5x the 300-line hard limit for logic files. This feature would add more. **The implementation must decompose the file as part of this work.**

#### Extraction Plan

| New File                            | What Moves There                                                                                                                                | Est. Lines |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `utils/polylabel.ts`                | `calculatePolylabel()` wrapper, MultiPolygon handling, type defs                                                                                | ~40        |
| `utils/label-layout.ts`             | Screen-space detection, callout position stacking, leader line geometry generation, `screenSpaceRatio` computation                              | ~120       |
| `utils/callout-markers.ts`          | HTML Marker creation, update, removal, opacity management, cleanup                                                                              | ~80        |
| `utils/map-layer-config.ts`         | Layer/source configuration objects (paint properties, layout properties, filter expressions) — extracted from the inline `map.addLayer()` calls | ~150       |
| `utils/value-format-expressions.ts` | The Mapbox value formatting expression builder (currently lines ~537-574)                                                                       | ~50        |

#### What Stays in `useMapLayers.ts`

- The React hook structure (`useCallback`, `useRef`, cleanup)
- `addMapLayers()` orchestration (calls into extracted utilities)
- `removeExistingLayers()` (updated for new layers)
- Feature enrichment loop (setting properties on GeoJSON features)
- Target: **~250-300 lines** after extraction

### 11. Dependencies

| Package             | Version  | Size | Purpose                           |
| ------------------- | -------- | ---- | --------------------------------- |
| `@mapbox/polylabel` | `^1.0.2` | ~3KB | Pole of inaccessibility algorithm |

Turf.js `area()` is NOT needed — screen-space pixel width is a better signal than geographic area. For MultiPolygon largest-polygon detection, a simple bounding-box area comparison suffices (no library needed).

### 12. Not In Scope

- Metro/county/ZIP labels (these geo levels don't show labels)
- Callout pill click interaction (pointer events pass through to state polygons via `pointer-events: none`)
- Viewport-relative callout repositioning on pan (v2 enhancement — see Section 3 note)
- Mobile-specific label sizing (future enhancement)
