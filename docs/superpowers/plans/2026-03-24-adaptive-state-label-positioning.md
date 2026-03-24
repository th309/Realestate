# Adaptive State Label Positioning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix state labels that appear in the ocean (Florida, Michigan) and disappear for small NE states (Maryland, Delaware, etc.) by using polylabel for centroid calculation, screen-space detection for small states, and leader-line callouts with color-matched pills.

**Architecture:** Replace bounding-box centroid with polylabel (pole of inaccessibility). On each zoom change, compute screen-space width per state. States where the label doesn't fit get HTML Marker callouts over the Atlantic with dashed leader lines. The existing 759-line `useMapLayers.ts` is decomposed into focused utility modules as part of this work.

**Tech Stack:** `@mapbox/polylabel`, Mapbox GL JS `mapboxgl.Marker`, Mapbox expressions

**Spec:** `docs/superpowers/specs/2026-03-24-adaptive-state-label-positioning-design.md`

---

## File Structure

### New Files

| File                                        | Responsibility                                                    | Est. Lines |
| ------------------------------------------- | ----------------------------------------------------------------- | ---------- |
| `app/map/utils/polylabel.d.ts`              | Type declarations for `@mapbox/polylabel`                         | ~5         |
| `app/map/utils/polylabel.ts`                | Polylabel wrapper with MultiPolygon handling                      | ~40        |
| `app/map/utils/label-layout.ts`             | Screen-space detection, callout positioning, leader line geometry | ~120       |
| `app/map/utils/callout-markers.ts`          | HTML Marker lifecycle: create, update, remove, opacity            | ~80        |
| `app/map/utils/map-layer-config.ts`         | Extracted layer/source config objects from `addMapLayers()`       | ~150       |
| `app/map/utils/value-format-expressions.ts` | Mapbox value formatting expression builder                        | ~50        |

### Modified Files

| File                             | Changes                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `app/map/hooks/useMapLayers.ts`  | Import new utils, remove extracted code, add leader-line layers + zoomend listener. Target: ~250-300 lines |
| `app/map/utils/index.ts`         | Add barrel exports for new utils                                                                           |
| `packages/frontend/package.json` | Add `@mapbox/polylabel` dependency                                                                         |

All paths relative to `packages/frontend/`.

---

## Task 1: Install polylabel dependency

**Files:**

- Modify: `packages/frontend/package.json`

- [ ] **Step 1: Install the package**

```bash
cd packages/frontend && npm install @mapbox/polylabel@^1.0.2
```

- [ ] **Step 2: Check for type definitions**

```bash
npm list @mapbox/polylabel && ls node_modules/@mapbox/polylabel/index.d.ts 2>/dev/null || echo "no types"
```

If no built-in types, we'll add a declaration in the polylabel wrapper.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/package.json packages/frontend/package-lock.json
git commit -m "deps: add @mapbox/polylabel for label positioning"
```

---

## Task 2: Create polylabel utility

**Files:**

- Create: `app/map/utils/polylabel.ts`

- [ ] **Step 1: Create the polylabel wrapper**

This replaces `calculateCentroid()` (lines 383-414 of `useMapLayers.ts`). Key difference: for MultiPolygon geometries (Michigan, Hawaii), run polylabel on the **largest polygon by area** so Michigan's label lands on the Lower Peninsula.

```typescript
/**
 * Polylabel-based centroid calculation for map labels.
 * Uses "pole of inaccessibility" — the point farthest from any polygon edge.
 * Guarantees the label point is always inside the polygon.
 */

// @mapbox/polylabel has no built-in TS types
// eslint-disable-next-line @typescript-eslint/no-var-requires
import polylabel from "@mapbox/polylabel";

/**
 * Calculate the visual center (pole of inaccessibility) of a GeoJSON geometry.
 * For MultiPolygon, uses the largest polygon by bounding-box area.
 * Returns [lng, lat] or null if geometry is invalid.
 */
export function calculatePolylabel(geometry: any): [number, number] | null {
  if (!geometry || !geometry.coordinates) return null;

  let ring: number[][][] | null = null;

  if (geometry.type === "Polygon") {
    ring = geometry.coordinates;
  } else if (geometry.type === "MultiPolygon") {
    // Find the largest polygon by bounding-box area
    ring = getLargestPolygon(geometry.coordinates);
  }

  if (!ring || ring.length === 0 || ring[0].length === 0) return null;

  try {
    const result = polylabel(ring, 1.0); // precision = 1.0 degree (sufficient for states)
    return [result[0], result[1]];
  } catch {
    // Fallback: bounding-box center of the ring
    return bboxCenter(ring[0]);
  }
}

/**
 * Get the bounding box of a geometry as [minLng, minLat, maxLng, maxLat].
 */
export function getGeometryBbox(
  geometry: any,
): [number, number, number, number] | null {
  if (!geometry || !geometry.coordinates) return null;

  let allCoords: number[][] = [];

  if (geometry.type === "Polygon") {
    allCoords = geometry.coordinates[0] || [];
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      if (polygon[0]) allCoords = allCoords.concat(polygon[0]);
    }
  }

  if (allCoords.length === 0) return null;

  let minLng = Infinity,
    maxLng = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;

  for (const [lng, lat] of allCoords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLng, minLat, maxLng, maxLat];
}

/** Find the largest polygon (by bbox area) in a MultiPolygon coordinates array. */
function getLargestPolygon(multiCoords: number[][][][]): number[][][] {
  let largest: number[][][] = multiCoords[0];
  let largestArea = 0;

  for (const polygon of multiCoords) {
    const exterior = polygon[0];
    if (!exterior || exterior.length === 0) continue;

    let minLng = Infinity,
      maxLng = -Infinity;
    let minLat = Infinity,
      maxLat = -Infinity;
    for (const [lng, lat] of exterior) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    const area = (maxLng - minLng) * (maxLat - minLat);
    if (area > largestArea) {
      largestArea = area;
      largest = polygon;
    }
  }

  return largest;
}

/** Bounding box center as fallback. */
function bboxCenter(coords: number[][]): [number, number] | null {
  if (coords.length === 0) return null;

  let minLng = Infinity,
    maxLng = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}
```

- [ ] **Step 2: Create type declarations**

`@mapbox/polylabel` does not ship TypeScript types. Create `app/map/utils/polylabel.d.ts`:

```typescript
declare module "@mapbox/polylabel" {
  function polylabel(polygon: number[][][], precision?: number): number[];
  export default polylabel;
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd packages/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/map/utils/polylabel.ts app/map/utils/polylabel.d.ts
git commit -m "feat: add polylabel utility for visual-center label placement"
```

---

## Task 3: Create value format expressions utility

**Files:**

- Create: `app/map/utils/value-format-expressions.ts`

Extracts the switch block at lines 537-574 of `useMapLayers.ts`.

- [ ] **Step 1: Create the utility**

```typescript
/**
 * Mapbox GL expression builders for formatting metric values on map labels.
 * Extracted from useMapLayers to keep the hook focused on orchestration.
 */
import type { MetricFormat } from "./metricUtils";

/** Mapbox expression type */
type MapboxExpression = any;

/**
 * Build a Mapbox format expression for displaying a metric value on a label.
 * Returns a Mapbox expression that reads 'value' from feature properties
 * and formats it based on the metric format type.
 */
export function buildValueFormatExpression(
  metricFormat: MetricFormat,
): MapboxExpression {
  switch (metricFormat) {
    case "percent":
      return [
        "concat",
        ["case", [">", ["get", "value"], 0], "+", ""],
        [
          "number-format",
          ["get", "value"],
          { "min-fraction-digits": 1, "max-fraction-digits": 1 },
        ],
        "%",
      ];

    case "percent_abs":
      return [
        "concat",
        [
          "number-format",
          ["get", "value"],
          { "min-fraction-digits": 1, "max-fraction-digits": 1 },
        ],
        "%",
      ];

    case "number":
    case "index":
      return [
        "number-format",
        ["round", ["get", "value"]],
        { "min-fraction-digits": 0, "max-fraction-digits": 0 },
      ];

    case "days":
      return [
        "concat",
        [
          "number-format",
          ["round", ["get", "value"]],
          { "min-fraction-digits": 0, "max-fraction-digits": 0 },
        ],
        " days",
      ];

    case "currency":
    default:
      return [
        "concat",
        "$",
        [
          "number-format",
          ["round", ["get", "value"]],
          { "min-fraction-digits": 0, "max-fraction-digits": 0 },
        ],
      ];
  }
}

/**
 * Format a metric value as a compact string for callout labels.
 * Used by HTML Marker callouts (not Mapbox expressions).
 */
export function formatCompactValue(
  value: number,
  metricFormat: MetricFormat,
): string {
  switch (metricFormat) {
    case "percent":
      return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
    case "percent_abs":
      return `${value.toFixed(1)}%`;
    case "number":
    case "index":
      return Math.round(value).toLocaleString();
    case "days":
      return `${Math.round(value).toLocaleString()} days`;
    case "currency":
    default:
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
      return `$${Math.round(value).toLocaleString()}`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/map/utils/value-format-expressions.ts
git commit -m "refactor: extract value format expressions from useMapLayers"
```

---

## Task 4: Create map layer config utility

**Files:**

- Create: `app/map/utils/map-layer-config.ts`

Extracts the `addMapLayers()` function (lines 461-601) and related layer configuration from `useMapLayers.ts`.

- [ ] **Step 1: Create the utility**

```typescript
/**
 * Mapbox GL layer and source configuration.
 * Extracted from useMapLayers to keep the hook focused on orchestration.
 */
import mapboxgl from "mapbox-gl";
import type { GeoLevel, SearchResult } from "../types";
import type { MetricFormat } from "./metricUtils";
import { getColorScale } from "./colorScale";
import { buildValueFormatExpression } from "./value-format-expressions";

/** All layer IDs managed by the map, in render order (bottom to top). */
export const MANAGED_LAYER_IDS = [
  "geo-fills",
  "geo-borders",
  "geo-highlight",
  "leader-lines",
  "leader-dots",
  "geo-labels",
] as const;

/** All source IDs managed by the map. */
export const MANAGED_SOURCE_IDS = [
  "geo-data",
  "geo-labels-data",
  "leader-line-data",
] as const;

/**
 * Remove all managed layers and sources from the map.
 * Safe to call even if layers/sources don't exist.
 */
export function removeAllManagedLayers(map: mapboxgl.Map): void {
  for (const layerId of MANAGED_LAYER_IDS) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  for (const sourceId of MANAGED_SOURCE_IDS) {
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  }
}

/** Border line width by geo level. */
function getBorderWidth(geoLevel: GeoLevel): number {
  switch (geoLevel) {
    case "tract":
      return 0.2;
    case "zip":
      return 0.3;
    case "city":
      return 0.4;
    case "county":
      return 0.5;
    case "metro":
      return 0.8;
    default:
      return 1.5; // state, national
  }
}

/** Build highlight filter for searched geography. */
function calculateHighlightFilter(
  feature: SearchResult,
  geoLevel: GeoLevel,
): any {
  const searchName = feature.name;
  const searchId = feature.id.replace(/.*?\./, "");

  if (geoLevel === "metro") {
    return [
      "any",
      ["==", ["get", "name"], searchName],
      ["in", searchName, ["get", "name"]],
      ["==", ["get", "id"], searchName],
    ];
  } else if (geoLevel === "zip") {
    return ["==", ["get", "id"], searchName];
  } else {
    return [
      "any",
      ["==", ["get", "name"], searchName],
      ["==", ["get", "id"], searchName],
      ["==", ["get", "id"], searchId],
      ["in", searchName, ["get", "displayName"]],
    ];
  }
}

interface AddMapLayersOptions {
  map: mapboxgl.Map;
  geoLevel: GeoLevel;
  metricFormat: MetricFormat;
  minVal: number;
  maxVal: number;
  labelPointsGeojson?: any;
  highlightedFeature?: SearchResult | null;
}

/**
 * Add all map layers (fills, borders, highlight, labels) to the map.
 * Assumes sources 'geo-data' and optionally 'geo-labels-data' are already added.
 */
export function addMapLayers(opts: AddMapLayersOptions): void {
  const {
    map,
    geoLevel,
    metricFormat,
    minVal,
    maxVal,
    labelPointsGeojson,
    highlightedFeature,
  } = opts;

  // Fill layer
  map.addLayer({
    id: "geo-fills",
    type: "fill",
    source: "geo-data",
    paint: {
      "fill-color": getColorScale(minVal, maxVal) as any,
      "fill-opacity": 0.6,
    },
  });

  // Border layer
  const lineWidth = getBorderWidth(geoLevel);
  map.addLayer({
    id: "geo-borders",
    type: "line",
    source: "geo-data",
    paint: {
      "line-color": "#ffffff",
      "line-width": lineWidth,
      "line-opacity": 0.8,
    },
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
  });

  // Highlight layer
  if (highlightedFeature) {
    const filter = calculateHighlightFilter(highlightedFeature, geoLevel);
    map.addLayer({
      id: "geo-highlight",
      type: "line",
      source: "geo-data",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#8b5cf6",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          lineWidth * 3,
          10,
          lineWidth * 6,
          15,
          lineWidth * 12,
        ],
        "line-opacity": 1,
        "line-blur": 0.4,
      },
      filter,
    });
  }

  // Label layers for state and national
  if ((geoLevel === "state" || geoLevel === "national") && labelPointsGeojson) {
    map.addSource("geo-labels-data", {
      type: "geojson",
      data: labelPointsGeojson,
    });

    const valueFormat = buildValueFormatExpression(metricFormat);

    map.addLayer({
      id: "geo-labels",
      type: "symbol",
      source: "geo-labels-data",
      layout: {
        "text-field": [
          "format",
          ["get", "name"],
          {
            "font-scale": 0.9,
            "text-font": [
              "literal",
              ["Roboto Medium", "DIN Pro Medium", "Arial Unicode MS Bold"],
            ],
          },
          "\n",
          {},
          valueFormat,
          {
            "font-scale": 0.8,
            "text-font": [
              "literal",
              ["Roboto Regular", "DIN Pro Regular", "Arial Unicode MS Regular"],
            ],
          },
        ],
        "text-size": 15,
        "text-variable-anchor": ["center", "top", "bottom", "left", "right"],
        "text-radial-offset": 0.5,
        "text-max-width": 8,
        "text-letter-spacing": 0.02,
      },
      paint: {
        "text-color": "#1d1b20",
        "text-halo-color": "rgba(255, 255, 255, 0.95)",
        "text-halo-width": 2,
      },
      // Filter: only show labels for states where the label fits (screenSpaceRatio <= 1.0)
      // If screenSpaceRatio is not set yet, show all (fallback for initial render before zoomend fires)
      filter:
        geoLevel === "state"
          ? [
              "any",
              ["!", ["has", "screenSpaceRatio"]],
              ["<=", ["get", "screenSpaceRatio"], 1.0],
            ]
          : undefined,
    });
  }
}

/**
 * Add leader line and dot layers for small state callouts.
 * Call AFTER addMapLayers() so these render above borders but below labels.
 */
export function addLeaderLineLayers(map: mapboxgl.Map, lineGeojson: any): void {
  // Guard: insert before geo-labels if it exists, otherwise append
  const beforeLayer = map.getLayer("geo-labels") ? "geo-labels" : undefined;

  // Source for leader lines
  if (map.getSource("leader-line-data")) {
    (map.getSource("leader-line-data") as mapboxgl.GeoJSONSource).setData(
      lineGeojson,
    );
  } else {
    map.addSource("leader-line-data", { type: "geojson", data: lineGeojson });
  }

  // Leader lines (dashed) — opacity is static since line features don't carry screenSpaceRatio
  // The lines are added/removed by syncCalloutMarkers based on which states need callouts
  if (!map.getLayer("leader-lines")) {
    map.addLayer(
      {
        id: "leader-lines",
        type: "line",
        source: "leader-line-data",
        paint: {
          "line-color": "rgba(255, 255, 255, 0.5)",
          "line-width": 1,
          "line-dasharray": [3, 2],
        },
        layout: {
          "line-cap": "round",
        },
      },
      beforeLayer,
    );
  }

  // Anchor dots on the state polylabel point
  // Circle layers do NOT participate in Mapbox symbol collision detection,
  // so text-allow-overlap is not needed (circles always render).
  // Opacity is driven by screenSpaceRatio: fade in the 0.8-1.0 range.
  if (!map.getLayer("leader-dots")) {
    map.addLayer(
      {
        id: "leader-dots",
        type: "circle",
        source: "geo-labels-data",
        filter: [">=", ["get", "screenSpaceRatio"], 0.8],
        paint: {
          "circle-radius": 3,
          "circle-color": "rgba(255, 255, 255, 0.6)",
          "circle-stroke-width": 0,
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["get", "screenSpaceRatio"],
            0.8,
            0,
            1.0,
            1,
          ],
        },
      },
      beforeLayer,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/map/utils/map-layer-config.ts
git commit -m "refactor: extract map layer configuration from useMapLayers"
```

---

## Task 5: Create label layout utility

**Files:**

- Create: `app/map/utils/label-layout.ts`

Screen-space detection, callout positioning, and leader line geometry.

- [ ] **Step 1: Create the utility**

```typescript
/**
 * Label layout engine for state map labels.
 * Computes screen-space ratios, callout positions, and leader line geometries.
 */
import mapboxgl from "mapbox-gl";
import { getGeometryBbox } from "./polylabel";

/** Approximate character width in pixels at font size 15 (Roboto Medium). */
const CHAR_WIDTH_PX = 8.5;

/** Font size for state labels. */
const LABEL_FONT_SIZE = 15;

/** How far east (in degrees) to offset callout labels from the easternmost NE state. */
const CALLOUT_LNG_OFFSET = 4;

/** Minimum latitude gap between stacked callout labels (degrees). */
const CALLOUT_LAT_GAP = 0.7;

/** Fade range: leader lines start fading at this ratio and are gone by 0.8. */
export const FADE_THRESHOLD_START = 0.8;

export interface LabelFeature {
  name: string;
  value: number;
  polylabel: [number, number];
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  screenSpaceRatio: number;
  fillColor: string;
}

export interface CalloutPosition {
  name: string;
  value: number;
  fillColor: string;
  anchorLngLat: [number, number]; // polylabel point on the state
  calloutLngLat: [number, number]; // offset position for the callout label
}

/**
 * Compute the screen-space ratio for each label feature.
 * ratio = estimated label pixel width / state pixel width on screen.
 * ratio > 1.0 means the label doesn't fit inside the state.
 */
export function computeScreenSpaceRatios(
  features: LabelFeature[],
  map: mapboxgl.Map,
): void {
  for (const feature of features) {
    const [minLng, , maxLng] = feature.bbox;

    // Project bbox corners to screen pixels
    const leftPx = map.project([minLng, feature.polylabel[1]]);
    const rightPx = map.project([maxLng, feature.polylabel[1]]);
    const stateWidthPx = Math.abs(rightPx.x - leftPx.x);

    // Estimate label width: name is the longest line
    const labelText = feature.name;
    const labelWidthPx =
      labelText.length * CHAR_WIDTH_PX * (LABEL_FONT_SIZE / 15);

    feature.screenSpaceRatio =
      stateWidthPx > 0 ? labelWidthPx / stateWidthPx : 999;
  }
}

/**
 * Compute callout positions for states that need leader lines.
 * Positions are stacked vertically off the east coast, sorted north to south.
 */
export function computeCalloutPositions(
  features: LabelFeature[],
): CalloutPosition[] {
  // Filter to states that need callouts
  const needsCallout = features.filter((f) => f.screenSpaceRatio > 1.0);

  if (needsCallout.length === 0) return [];

  // Sort north to south (highest latitude first)
  needsCallout.sort((a, b) => b.polylabel[1] - a.polylabel[1]);

  // Find the easternmost bbox edge among all callout states for the column position
  const maxEastLng = Math.max(...needsCallout.map((f) => f.bbox[2]));
  const calloutLng = maxEastLng + CALLOUT_LNG_OFFSET;

  // Stack callouts vertically starting from the northernmost state's latitude
  const startLat = needsCallout[0].polylabel[1] + 0.5;

  return needsCallout.map((feature, index) => ({
    name: feature.name,
    value: feature.value,
    fillColor: feature.fillColor,
    anchorLngLat: feature.polylabel,
    calloutLngLat: [calloutLng, startLat - index * CALLOUT_LAT_GAP] as [
      number,
      number,
    ],
  }));
}

/**
 * Build a GeoJSON FeatureCollection of LineString features for leader lines.
 * Each line connects a state's polylabel point to its callout position.
 */
export function buildLeaderLineGeojson(callouts: CalloutPosition[]): any {
  return {
    type: "FeatureCollection",
    features: callouts.map((c) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [c.anchorLngLat, c.calloutLngLat],
      },
      properties: { name: c.name },
    })),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/map/utils/label-layout.ts
git commit -m "feat: add label layout engine for screen-space detection and callout positioning"
```

---

## Task 6: Create callout markers utility

**Files:**

- Create: `app/map/utils/callout-markers.ts`

HTML Marker lifecycle management for color-matched callout pills.

- [ ] **Step 1: Create the utility**

```typescript
/**
 * Callout marker management for small state labels.
 * Creates, updates, and removes HTML mapboxgl.Marker elements
 * with color-matched pill backgrounds positioned over the Atlantic.
 */
import mapboxgl from "mapbox-gl";
import type { MetricFormat } from "./metricUtils";
import { formatCompactValue } from "./value-format-expressions";
import type { CalloutPosition } from "./label-layout";

/**
 * Marker store type — managed via useRef in the hook, passed into these functions.
 * This avoids module-level singletons that can leak across React mount/unmount cycles.
 */
export type MarkerStore = Map<string, mapboxgl.Marker>;

/**
 * Create the HTML element for a callout pill marker.
 */
function createPillElement(
  name: string,
  value: number,
  fillColor: string,
  metricFormat: MetricFormat,
): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    background: ${fillColor};
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 6px;
    padding: 3px 8px;
    pointer-events: none;
    white-space: nowrap;
    line-height: 1.3;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    transition: opacity 0.3s ease;
  `;

  const nameSpan = document.createElement("div");
  nameSpan.style.cssText =
    "color: white; font-size: 10px; font-weight: 600; font-family: Roboto, sans-serif;";
  nameSpan.textContent = name;

  const valueSpan = document.createElement("div");
  valueSpan.style.cssText =
    "color: rgba(255, 255, 255, 0.85); font-size: 9px; font-family: Roboto, sans-serif;";
  valueSpan.textContent = formatCompactValue(value, metricFormat);

  el.appendChild(nameSpan);
  el.appendChild(valueSpan);

  return el;
}

/**
 * Sync callout markers with the current set of callout positions.
 * Creates new markers, updates existing ones, and removes stale ones.
 */
export function syncCalloutMarkers(
  markers: MarkerStore,
  map: mapboxgl.Map,
  callouts: CalloutPosition[],
  metricFormat: MetricFormat,
): void {
  const newNames = new Set(callouts.map((c) => c.name));

  // Remove markers for states that no longer need callouts
  for (const [name, marker] of markers) {
    if (!newNames.has(name)) {
      marker.remove();
      markers.delete(name);
    }
  }

  // Create or update markers
  for (const callout of callouts) {
    // Always remove old marker and recreate (Mapbox Marker has no setElement)
    const existing = markers.get(callout.name);
    if (existing) existing.remove();

    const el = createPillElement(
      callout.name,
      callout.value,
      callout.fillColor,
      metricFormat,
    );
    const marker = new mapboxgl.Marker({ element: el, anchor: "left" })
      .setLngLat(callout.calloutLngLat)
      .addTo(map);
    markers.set(callout.name, marker);
  }
}

/**
 * Update opacity of all callout markers based on screen-space ratio.
 * Markers fade in/out in the 0.8-1.0 ratio range.
 */
export function updateCalloutOpacity(
  markers: MarkerStore,
  features: { name: string; screenSpaceRatio: number }[],
): void {
  for (const feature of features) {
    const marker = markers.get(feature.name);
    if (!marker) continue;

    const el = marker.getElement();
    if (feature.screenSpaceRatio > 1.0) {
      el.style.opacity = "1";
      el.style.display = "";
    } else if (feature.screenSpaceRatio >= 0.8) {
      // Fade zone: 0.8 → 1.0 maps to 0 → 1 opacity
      const opacity = (feature.screenSpaceRatio - 0.8) / 0.2;
      el.style.opacity = String(opacity);
      el.style.display = "";
    } else {
      el.style.opacity = "0";
      el.style.display = "none";
    }
  }
}

/**
 * Remove all callout markers from the map.
 * Call during layer cleanup or geo level change.
 */
export function removeAllCalloutMarkers(markers: MarkerStore): void {
  for (const [, marker] of markers) {
    marker.remove();
  }
  markers.clear();
}
```

- [ ] **Step 2: Commit**

```bash
git add app/map/utils/callout-markers.ts
git commit -m "feat: add callout marker management for small state labels"
```

---

## Task 7: Update barrel exports

**Files:**

- Modify: `app/map/utils/index.ts`

- [ ] **Step 1: Add exports for new utilities**

```typescript
// Map utilities barrel exports
export * from "./colorScale";
export * from "./metricUtils";
export * from "./polylabel";
export * from "./label-layout";
export * from "./callout-markers";
export * from "./value-format-expressions";
export * from "./map-layer-config";

// Re-export key config items for convenience
export { fetchMetricData, toHomeValues } from "../config";
```

- [ ] **Step 2: Commit**

```bash
git add app/map/utils/index.ts
git commit -m "refactor: add barrel exports for new map utilities"
```

---

## Task 8: Refactor useMapLayers to use new utilities

**Files:**

- Modify: `app/map/hooks/useMapLayers.ts`

This is the core integration step. Replace extracted code with imports, add leader line + callout logic, add zoomend listener.

- [ ] **Step 1: Update imports**

Replace the top of the file. Remove the local `calculateCentroid`, `calculateHighlightFilter`, `removeExistingLayers`, `addMapLayers` functions and the value format switch block. Import from new utils instead.

Add these imports:

```typescript
import {
  calculatePolylabel,
  getGeometryBbox,
  computeScreenSpaceRatios,
  computeCalloutPositions,
  buildLeaderLineGeojson,
  syncCalloutMarkers,
  updateCalloutOpacity,
  removeAllCalloutMarkers,
  removeAllManagedLayers,
  addMapLayers,
  addLeaderLineLayers,
  computeFillColor,
  type LabelFeature,
  type MarkerStore,
} from "../utils";
```

- [ ] **Step 2: Replace `calculateCentroid` in `createLabelPoints`**

In `createLabelPoints()`, replace `calculateCentroid(feature.geometry)` with `calculatePolylabel(feature.geometry)`. Also store `bbox` and `polylabel` as feature properties for use by the label layout engine:

```typescript
function createLabelPoints(geojson: any, geoLevel: GeoLevel): any {
  if (geoLevel === "national") {
    const firstFeature = geojson.features[0];
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-98.5795, 39.8283] },
          properties: firstFeature
            ? { ...firstFeature.properties }
            : { name: "United States", value: 0 },
        },
      ],
    };
  }

  const labelFeatures = geojson.features
    .map((feature: any) => {
      const centroid = calculatePolylabel(feature.geometry);
      if (!centroid) return null;

      const bbox = getGeometryBbox(feature.geometry);

      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: centroid },
        properties: {
          ...feature.properties,
          polylabelLng: centroid[0],
          polylabelLat: centroid[1],
          bboxMinLng: bbox ? bbox[0] : centroid[0],
          bboxMinLat: bbox ? bbox[1] : centroid[1],
          bboxMaxLng: bbox ? bbox[2] : centroid[0],
          bboxMaxLat: bbox ? bbox[3] : centroid[1],
        },
      };
    })
    .filter(Boolean);

  return { type: "FeatureCollection", features: labelFeatures };
}
```

- [ ] **Step 3: Replace `removeExistingLayers` and `addMapLayers`**

Delete the local `removeExistingLayers` function (lines 242-255). Replace all calls with `removeAllManagedLayers(map)`.

Delete the local `addMapLayers` function (lines 461-601) and `calculateHighlightFilter` (lines 208-240). Replace the call in `updateMapLayers` with:

```typescript
addMapLayers({
  map: map.current!,
  geoLevel,
  metricFormat,
  minVal,
  maxVal,
  labelPointsGeojson,
  highlightedFeature,
});
```

Also update the duplicate removal block (lines 139-150) to use `removeAllManagedLayers`:

```typescript
removeAllManagedLayers(map.current!);
```

- [ ] **Step 4: Add the zoomend listener and callout logic**

After the `addMapLayers` call in `updateMapLayers`, add the leader line + callout logic for state level:

```typescript
// Leader lines + callout labels for small states at state level
if (geoLevel === "state" && labelPointsGeojson) {
  const colorScale = getColorScale(minVal, maxVal);

  // Build LabelFeature array from the label points
  const labelFeatures: LabelFeature[] = labelPointsGeojson.features.map(
    (f: any) => ({
      name: f.properties.name,
      value: f.properties.value,
      polylabel: [f.properties.polylabelLng, f.properties.polylabelLat] as [
        number,
        number,
      ],
      bbox: [
        f.properties.bboxMinLng,
        f.properties.bboxMinLat,
        f.properties.bboxMaxLng,
        f.properties.bboxMaxLat,
      ] as [number, number, number, number],
      screenSpaceRatio: 0,
      fillColor: "", // Will be computed from color scale
    }),
  );

  // Compute fill colors for each state (matching geo-fills)
  for (const lf of labelFeatures) {
    lf.fillColor = computeFillColor(lf.value, minVal, maxVal);
  }

  // Function to update labels on zoom
  const updateLabelsForZoom = () => {
    if (!map.current) return;

    // Compute screen-space ratios
    computeScreenSpaceRatios(labelFeatures, map.current);

    // Update geo-labels-data with screenSpaceRatio
    const source = map.current.getSource("geo-labels-data") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      const updatedData = {
        ...labelPointsGeojson,
        features: labelPointsGeojson.features.map((f: any, i: number) => ({
          ...f,
          properties: {
            ...f.properties,
            screenSpaceRatio: labelFeatures[i]?.screenSpaceRatio ?? 0,
          },
        })),
      };
      source.setData(updatedData);
    }

    // Compute callout positions and leader lines
    const callouts = computeCalloutPositions(labelFeatures);
    const lineGeojson = buildLeaderLineGeojson(callouts);

    // Update leader line layers
    addLeaderLineLayers(map.current, lineGeojson);

    // Sync HTML markers (pass markersRef.current as the store)
    syncCalloutMarkers(markersRef.current, map.current, callouts, metricFormat);
    updateCalloutOpacity(markersRef.current, labelFeatures);
  };

  // Run once immediately, then on zoom changes
  updateLabelsForZoom();
  map.current!.on("zoomend", updateLabelsForZoom);

  // Store handler ref for cleanup
  zoomHandlerRef.current = updateLabelsForZoom;
}
```

- [ ] **Step 5: Add refs and cleanup for the zoomend listener and markers**

Add refs at the top of the hook (next to `updateIdRef`):

```typescript
const zoomHandlerRef = useRef<(() => void) | null>(null);
const markersRef = useRef<MarkerStore>(new Map());
```

Update the cleanup at the beginning of `updateMapLayers` (before removing layers):

```typescript
// Clean up previous zoomend listener and callout markers
if (zoomHandlerRef.current && map.current) {
  map.current.off("zoomend", zoomHandlerRef.current);
  zoomHandlerRef.current = null;
}
removeAllCalloutMarkers(markersRef.current);
```

Add a **useEffect for unmount cleanup** (required by spec Section 6, item 4):

```typescript
useEffect(() => {
  return () => {
    if (zoomHandlerRef.current && map.current) {
      map.current.off("zoomend", zoomHandlerRef.current);
    }
    removeAllCalloutMarkers(markersRef.current);
  };
}, []);
```

- [ ] **Step 6: Add `computeFillColor` to `map-layer-config.ts`**

Add this exported helper to `app/map/utils/map-layer-config.ts`. It mirrors the `getColorScale` step function but returns a JS string instead of a Mapbox expression. Keep it co-located with `getColorScale` usage to prevent drift:

```typescript
// In map-layer-config.ts — add this import at the top:
import { COLOR_SCALE } from "./metricUtils";

// Add this exported function (mirrors getColorScale's step logic for JS-side use):
/**
 * Compute the fill color for a given value using the same step function as geo-fills.
 * JS-side mirror of the Mapbox getColorScale() expression — keep in sync.
 */
export function computeFillColor(
  value: number,
  min: number,
  max: number,
): string {
  if (value == null || min === max) return COLOR_SCALE[3];
  const range = max - min;
  const step = range / 7;
  const index = Math.min(6, Math.max(0, Math.floor((value - min) / step)));
  return COLOR_SCALE[index];
}
```

- [ ] **Step 7: Delete all extracted functions from useMapLayers**

Remove these functions that are now in utility files:

- `calculateCentroid` (lines 383-414)
- `calculateHighlightFilter` (lines 208-240)
- `removeExistingLayers` (lines 242-255)
- `addMapLayers` (lines 461-601, including the value format switch block)

- [ ] **Step 8: Verify the file compiles**

```bash
cd packages/frontend && npx tsc --noEmit 2>&1 | head -30
```

Fix any type errors.

- [ ] **Step 9: Commit**

```bash
git add app/map/hooks/useMapLayers.ts
git commit -m "feat: integrate polylabel, leader lines, and callout markers for state labels"
```

---

## Task 9: Manual visual verification

- [ ] **Step 1: Start the dev server**

```bash
cd packages/frontend && npm run dev
```

- [ ] **Step 2: Visual checks at zoom 3-4 (full US view)**

Open http://localhost:3000/map, select state level, and verify:

1. **Florida** label is inland (not in the Gulf)
2. **Michigan** label is on the Lower Peninsula (not in Lake Michigan)
3. **Small NE states** (MD, DE, CT, RI, NJ, MA, NH) have callout labels over the Atlantic with leader lines
4. Callout pills match their state's choropleth color
5. Leader lines connect from each state to its callout
6. Large states (TX, CA, PA, NY) still have normal centered labels

- [ ] **Step 3: Visual checks at zoom 5-6 (regional)**

Zoom into the Northeast and verify:

1. Some callout labels disappear as states grow on screen
2. Centered labels fade in for those states
3. Transitions are smooth (no harsh pop)

- [ ] **Step 4: Visual checks at zoom 7+ (close-up)**

Zoom further in and verify:

1. All callout labels are gone
2. All states show normal centered labels
3. No leader lines visible

- [ ] **Step 5: Metric switching**

Switch between several metrics (Home Value, Rent Index, etc.) and verify:

1. Callout pill colors update to match the new choropleth scale
2. Values update correctly
3. No stale markers remain

- [ ] **Step 6: Geography level switching**

Switch to county, metro, zip levels and back to state:

1. No errors in console when switching away from state
2. Callout markers disappear on non-state levels
3. Coming back to state level re-creates callouts correctly

- [ ] **Step 7: Commit final adjustments**

If any tuning is needed (label offsets, font sizes, opacity thresholds), make the changes and commit:

```bash
git add -A
git commit -m "fix: tune state label callout positioning and transitions"
```

---

## Task 10: Line count verification

- [ ] **Step 1: Check file sizes**

```bash
wc -l packages/frontend/app/map/hooks/useMapLayers.ts
wc -l packages/frontend/app/map/utils/polylabel.ts
wc -l packages/frontend/app/map/utils/label-layout.ts
wc -l packages/frontend/app/map/utils/callout-markers.ts
wc -l packages/frontend/app/map/utils/map-layer-config.ts
wc -l packages/frontend/app/map/utils/value-format-expressions.ts
```

Expected:

- `useMapLayers.ts`: 250-300 lines (down from 759)
- All utility files: under 200 lines each

- [ ] **Step 2: If any file exceeds limits, split further**

The CLAUDE.md hard limit is 300 lines for logic files. If `map-layer-config.ts` exceeds 200 lines, split into `map-layer-config.ts` (fills/borders/highlight) and `label-layer-config.ts` (labels/leader lines).

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "refactor: verify file size compliance after useMapLayers decomposition"
```
