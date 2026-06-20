# Cinematic Geo Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user selects a metro/county/ZIP on `/map`, fly the camera to center it with a premium cinematic motion, fade in satellite imagery, dim everything outside the boundary (spotlight) with a glowing outline, and apply real 3D (extruded buildings + terrain) at ZIP only — all behind an OFF-by-default env flag so it is fully reversible.

**Architecture:** Purely additive. A new flag-gated hook (`useSelectedGeoCinematic`) watches the existing `selectedGeography` state and drives new Mapbox layers/sources (satellite raster, spotlight mask, outline) plus camera `fitBounds` with per-level pitch. Existing camera/selection/layer logic is unchanged. The selected feature's polygon is read from the already-fetched `geo-data` GeoJSON via a shared ref. No new runtime dependencies.

**Tech Stack:** Next.js (App Router) + React 19, mapbox-gl 3.17.0, TypeScript, Vitest (unit), Playwright (e2e). `@mapbox/polylabel` already present; **no `@turf/turf`**.

## Global Constraints

- **Env kill switch:** `NEXT_PUBLIC_CINEMATIC_ZOOM`, **default OFF**. With it off/unset the map MUST behave byte-for-byte identically to today.
- **Additive only:** Do NOT modify the behavior of `useMapCamera`, `useMapSelection`, `useMapLayers` (beyond storing a ref), `map-interactions` (beyond adding `export`), or the selection→panel flow.
- **Native Mapbox only:** No GSAP, no three.js, no hand-rolled WebGL. No new heavy dependency (no turf — hand-roll the mask).
- **No first-load cost:** Satellite tiles, mask, outline, terrain, extrusion all trigger on selection only — never at initial paint (no LCP/INP regression).
- **Real 3D or flat:** ZIP gets extruded buildings + terrain + meaningful tilt; county/metro stay near-flat (no fake-3D pitch on flat imagery).
- **Drop the choropleth tint inside the selected region** (clean satellite); metric stays in the existing right panel; spotlight mask is the only surrounding tint.
- **`prefers-reduced-motion`:** jump-cut (no curved/tilted fly, no terrain), but selection still legible (outline + dim shown).
- **Satellite via raster layer, NOT `setStyle`** (no full-style-swap flash).
- **Reuse** `getGeometryBbox()` (`utils/polylabel.ts`) and existing constants; brand color for outline glow is `#3949AB`.
- **Verification:** pure logic via Vitest; map/visual behavior via real browser (`npm run dev:fresh`, localhost:3000/map) — no mock-based UI assertions.
- **Branch:** work on `develop`. Commit per task; do not push without explicit ask.

## File Structure

**Create:**

- `packages/frontend/app/(app)/map/utils/cinematic-config.ts` — `isCinematicZoomEnabled()` + `getCinematicConfig(geoLevel)` (pure)
- `packages/frontend/app/(app)/map/utils/spotlight-mask.ts` — `buildSpotlightMask(geometry)` (pure)
- `packages/frontend/app/(app)/map/utils/find-feature.ts` — `findFeatureById(fc, id)` (pure)
- `packages/frontend/app/(app)/map/utils/cinematic-layers.ts` — satellite + mask + outline + choropleth-dim helpers (imperative)
- `packages/frontend/app/(app)/map/utils/cinematic-3d.ts` — `enable3D` / `disable3D` (imperative)
- `packages/frontend/app/(app)/map/hooks/useSelectedGeoCinematic.ts` — flag-gated orchestrator hook
- `packages/frontend/app/(app)/map/utils/__tests__/cinematic-config.test.ts`
- `packages/frontend/app/(app)/map/utils/__tests__/spotlight-mask.test.ts`
- `packages/frontend/app/(app)/map/utils/__tests__/find-feature.test.ts`
- `packages/frontend/tests/e2e/map-cinematic-zoom.spec.ts`

**Modify:**

- `packages/frontend/app/(app)/map/config/constants.ts` — add `CINEMATIC` constants
- `packages/frontend/app/(app)/map/utils/map-interactions.ts` — `export` `extractFeatureId`
- `packages/frontend/app/(app)/map/hooks/useMapLayers.ts` — accept + populate `geoDataRef`
- `packages/frontend/app/(app)/map/page.tsx` — create `geoDataRef`, wire the hook

---

### Task 1: Cinematic constants, env flag, and per-level config

**Files:**

- Modify: `packages/frontend/app/(app)/map/config/constants.ts` (append after the existing `MAP_PADDING` block)
- Create: `packages/frontend/app/(app)/map/utils/cinematic-config.ts`
- Test: `packages/frontend/app/(app)/map/utils/__tests__/cinematic-config.test.ts`

**Interfaces:**

- Produces: `CINEMATIC` (const object), `isCinematicZoomEnabled(): boolean`, `getCinematicConfig(geoLevel: GeoLevel): CinematicConfig` where `interface CinematicConfig { pitch: number; padding: number; enable3D: boolean }`.

- [ ] **Step 1: Add the constants** — append to `constants.ts`:

```typescript
// ============================================================================
// CINEMATIC GEO ZOOM (flag-gated; see utils/cinematic-config.ts)
// ============================================================================

export const CINEMATIC = {
  FLY_DURATION: 1600, // premium/cinematic; longer than MAP_FLY
  SATELLITE_FADE_MS: 600,
  MASK_OPACITY: 0.55,
  MASK_COLOR: "#0b1020",
  OUTLINE_COLOR: "#ffffff",
  OUTLINE_GLOW_COLOR: "#3949AB", // brand indigo
  OUTLINE_WIDTH: 3,
  CHOROPLETH_DEFAULT_OPACITY: 0.6, // matches geo-fills default
  BUILDINGS_MIN_ZOOM: 15,
  TERRAIN_EXAGGERATION: 1.3,
} as const;
```

- [ ] **Step 2: Write the failing test** — create `__tests__/cinematic-config.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import {
  isCinematicZoomEnabled,
  getCinematicConfig,
} from "../cinematic-config";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CINEMATIC_ZOOM;
});

describe("isCinematicZoomEnabled", () => {
  it("is off when the env var is unset", () => {
    expect(isCinematicZoomEnabled()).toBe(false);
  });
  it("is on only for the exact string 'true'", () => {
    process.env.NEXT_PUBLIC_CINEMATIC_ZOOM = "true";
    expect(isCinematicZoomEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_CINEMATIC_ZOOM = "1";
    expect(isCinematicZoomEnabled()).toBe(false);
  });
});

describe("getCinematicConfig", () => {
  it("enables real 3D and full tilt for zip", () => {
    const c = getCinematicConfig("zip");
    expect(c.enable3D).toBe(true);
    expect(c.pitch).toBeGreaterThanOrEqual(45);
  });
  it("keeps metro flat with no 3D", () => {
    const c = getCinematicConfig("metro");
    expect(c.enable3D).toBe(false);
    expect(c.pitch).toBeLessThanOrEqual(5);
  });
  it("keeps county near-flat with no 3D", () => {
    const c = getCinematicConfig("county");
    expect(c.enable3D).toBe(false);
    expect(c.pitch).toBeLessThanOrEqual(15);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:unit -- "app/(app)/map/utils/__tests__/cinematic-config.test.ts"`
Expected: FAIL — cannot resolve `../cinematic-config`.

- [ ] **Step 4: Implement** — create `utils/cinematic-config.ts`:

```typescript
import type { GeoLevel } from "@/lib/data";

/** Build-time kill switch. Default OFF — map behaves as today unless set to "true". */
export function isCinematicZoomEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CINEMATIC_ZOOM === "true";
}

export interface CinematicConfig {
  pitch: number;
  padding: number;
  enable3D: boolean;
}

// Real 3D only at the granular end (zip/tract); flat elsewhere — no fake-3D.
const CONFIG_BY_LEVEL: Record<GeoLevel, CinematicConfig> = {
  national: { pitch: 0, padding: 80, enable3D: false },
  state: { pitch: 0, padding: 80, enable3D: false },
  metro: { pitch: 0, padding: 80, enable3D: false },
  county: { pitch: 10, padding: 80, enable3D: false },
  city: { pitch: 20, padding: 70, enable3D: false },
  zip: { pitch: 55, padding: 60, enable3D: true },
  tract: { pitch: 55, padding: 60, enable3D: true },
};

export function getCinematicConfig(geoLevel: GeoLevel): CinematicConfig {
  return CONFIG_BY_LEVEL[geoLevel] ?? CONFIG_BY_LEVEL.metro;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- "app/(app)/map/utils/__tests__/cinematic-config.test.ts"`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/map/config/constants.ts" "packages/frontend/app/(app)/map/utils/cinematic-config.ts" "packages/frontend/app/(app)/map/utils/__tests__/cinematic-config.test.ts"
git commit -m "feat(map): cinematic zoom constants, env flag, per-level config"
```

---

### Task 2: Spotlight mask geometry builder

**Files:**

- Create: `packages/frontend/app/(app)/map/utils/spotlight-mask.ts`
- Test: `packages/frontend/app/(app)/map/utils/__tests__/spotlight-mask.test.ts`

**Interfaces:**

- Produces: `buildSpotlightMask(geometry: Polygon | MultiPolygon): Feature<Polygon>` — a world-rectangle polygon with the selected geography's outer ring(s) cut out as holes (used as the dark dimming fill around the selection).

- [ ] **Step 1: Write the failing test** — create `__tests__/spotlight-mask.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { Polygon, MultiPolygon } from "geojson";
import { buildSpotlightMask } from "../spotlight-mask";

const square: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ],
  ],
};

describe("buildSpotlightMask", () => {
  it("wraps a polygon as a hole inside a world rectangle", () => {
    const mask = buildSpotlightMask(square);
    expect(mask.geometry.type).toBe("Polygon");
    expect(mask.geometry.coordinates[0]).toEqual([
      [-180, -85],
      [180, -85],
      [180, 85],
      [-180, 85],
      [-180, -85],
    ]);
    expect(mask.geometry.coordinates[1]).toEqual(square.coordinates[0]);
  });

  it("cuts every sub-polygon of a MultiPolygon as its own hole", () => {
    const multi: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
        ],
        [
          [
            [5, 5],
            [5, 6],
            [6, 6],
            [6, 5],
            [5, 5],
          ],
        ],
      ],
    };
    const mask = buildSpotlightMask(multi);
    expect(mask.geometry.coordinates.length).toBe(3); // world + 2 holes
    expect(mask.geometry.coordinates[1]).toEqual(multi.coordinates[0][0]);
    expect(mask.geometry.coordinates[2]).toEqual(multi.coordinates[1][0]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- "app/(app)/map/utils/__tests__/spotlight-mask.test.ts"`
Expected: FAIL — cannot resolve `../spotlight-mask`.

- [ ] **Step 3: Implement** — create `utils/spotlight-mask.ts`:

```typescript
import type { Feature, Polygon, MultiPolygon, Position } from "geojson";

// Covers the whole web-mercator-visible world; Mapbox renders later rings as holes.
const WORLD_RING: Position[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

/**
 * Build a dark "spotlight" fill: a world rectangle with the selected geography
 * cut out, so everything OUTSIDE the selection is dimmed and the selection shows
 * clean imagery. Holes = each sub-polygon's outer ring.
 */
export function buildSpotlightMask(
  geometry: Polygon | MultiPolygon,
): Feature<Polygon> {
  const holes: Position[][] = [];
  if (geometry.type === "Polygon") {
    if (geometry.coordinates[0]) holes.push(geometry.coordinates[0]);
  } else {
    for (const poly of geometry.coordinates) {
      if (poly[0]) holes.push(poly[0]);
    }
  }
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [WORLD_RING, ...holes],
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- "app/(app)/map/utils/__tests__/spotlight-mask.test.ts"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/map/utils/spotlight-mask.ts" "packages/frontend/app/(app)/map/utils/__tests__/spotlight-mask.test.ts"
git commit -m "feat(map): spotlight mask geometry builder"
```

---

### Task 3: Feature lookup by id (+ export extractFeatureId)

**Files:**

- Modify: `packages/frontend/app/(app)/map/utils/map-interactions.ts` (add `export` to `extractFeatureId`)
- Create: `packages/frontend/app/(app)/map/utils/find-feature.ts`
- Test: `packages/frontend/app/(app)/map/utils/__tests__/find-feature.test.ts`

**Interfaces:**

- Consumes: `extractFeatureId(props, id?)` from `map-interactions.ts` (same id logic the click handler uses).
- Produces: `findFeatureById(fc: FeatureCollection | null, id: string): Feature | null`.

- [ ] **Step 1: Export the helper** — in `utils/map-interactions.ts`, find the declaration of `extractFeatureId` (currently used internally by the `map.on("click", "geo-fills", …)` handler) and prefix it with `export` so it can be reused. Example:

```typescript
// before:  function extractFeatureId(props: ..., id?: string): string { ... }
// after:
export function extractFeatureId(props: ..., id?: string): string { ... }
```

(If it is an arrow const, change `const extractFeatureId = …` to `export const extractFeatureId = …`. Do not change its body.)

- [ ] **Step 2: Write the failing test** — create `__tests__/find-feature.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import type { FeatureCollection } from "geojson";

// Isolate the lookup/iteration logic from the real id-extraction internals.
vi.mock("../map-interactions", () => ({
  extractFeatureId: (props: Record<string, unknown> | null) =>
    String(props?.id ?? ""),
}));

import { findFeatureById } from "../find-feature";

const fc: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "A" },
      geometry: { type: "Point", coordinates: [0, 0] },
    },
    {
      type: "Feature",
      properties: { id: "B" },
      geometry: { type: "Point", coordinates: [1, 1] },
    },
  ],
};

describe("findFeatureById", () => {
  it("returns the feature whose extracted id matches", () => {
    expect(findFeatureById(fc, "B")?.properties?.id).toBe("B");
  });
  it("returns null when nothing matches", () => {
    expect(findFeatureById(fc, "Z")).toBeNull();
  });
  it("returns null for a null collection", () => {
    expect(findFeatureById(null, "A")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:unit -- "app/(app)/map/utils/__tests__/find-feature.test.ts"`
Expected: FAIL — cannot resolve `../find-feature`.

- [ ] **Step 4: Implement** — create `utils/find-feature.ts`:

```typescript
import type { Feature, FeatureCollection } from "geojson";
import { extractFeatureId } from "./map-interactions";

/** Find the feature in the loaded geo-data collection whose id matches the
 *  selection, using the SAME id extraction as the click handler. */
export function findFeatureById(
  fc: FeatureCollection | null,
  id: string,
): Feature | null {
  if (!fc) return null;
  for (const feature of fc.features) {
    const fid = extractFeatureId(
      (feature.properties as Record<string, unknown> | null) ?? {},
      typeof feature.id === "string" ? feature.id : undefined,
    );
    if (fid === id) return feature;
  }
  return null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- "app/(app)/map/utils/__tests__/find-feature.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/map/utils/map-interactions.ts" "packages/frontend/app/(app)/map/utils/find-feature.ts" "packages/frontend/app/(app)/map/utils/__tests__/find-feature.test.ts"
git commit -m "feat(map): findFeatureById helper; export extractFeatureId"
```

---

### Task 4: Expose the loaded geo-data collection via a shared ref

**Files:**

- Modify: `packages/frontend/app/(app)/map/hooks/useMapLayers.ts`
- Modify: `packages/frontend/app/(app)/map/page.tsx`

**Interfaces:**

- Produces: a `geoDataRef: MutableRefObject<FeatureCollection | null>` created in `page.tsx`, populated by `useMapLayers` whenever it loads geojson, consumed by the cinematic hook (Task 7/8).

This task is behavior-preserving — it only stores a reference. No new behavior with the flag off.

- [ ] **Step 1: Add `geoDataRef` to `useMapLayers` options** — in `hooks/useMapLayers.ts`, add to the hook's options interface/type and to the destructured parameters:

```typescript
// in the options interface (add this field):
geoDataRef: import("react").MutableRefObject<
  import("geojson").FeatureCollection | null
>;
```

```typescript
// in the destructured params of the hook, add geoDataRef alongside map, popup, geoLevel, ...
```

- [ ] **Step 2: Populate the ref when geojson loads** — in the effect that loads geojson, immediately BEFORE this existing line:

```typescript
map.current!.addSource("geo-data", { type: "geojson", data: geojson });
```

add:

```typescript
geoDataRef.current = geojson as import("geojson").FeatureCollection;
```

- [ ] **Step 3: Create the ref and pass it in `page.tsx`** — add the import near the top:

```typescript
import type { FeatureCollection } from "geojson";
```

Create the ref next to the other map state (after the `useMapInstance` call around line 76):

```typescript
const geoDataRef = useRef<FeatureCollection | null>(null);
```

(Ensure `useRef` is in the `react` import.) Then add `geoDataRef` to the existing `useMapLayers({ ... })` call object:

```typescript
useMapLayers({
  map,
  popup,
  geoLevel,
  selectedState,
  selectedMetric: effectiveMetric,
  forecastHorizon,
  mapData: activeMapData,
  mapLoaded,
  dataLoading: effectiveDataLoading,
  highlightedFeature,
  onFeatureClick: handleFeatureClick,
  onFeatureContextMenu: handleFeatureContextMenu,
  geoDataRef,
});
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 5: Verify the map still works unchanged**

Run `npm run dev:fresh` (single instance — kill stray node first per project rule), open `http://localhost:3000/map`, confirm regions render and selecting one still opens the panel exactly as before (nothing visual changed).

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/map/hooks/useMapLayers.ts" "packages/frontend/app/(app)/map/page.tsx"
git commit -m "feat(map): expose loaded geo-data FeatureCollection via shared ref"
```

---

### Task 5: Cinematic layer helpers (satellite, mask, outline, choropleth dim)

**Files:**

- Create: `packages/frontend/app/(app)/map/utils/cinematic-layers.ts`

**Interfaces:**

- Consumes: `CINEMATIC` from `../config/constants`.
- Produces: `ensureCinematicLayers(map)`, `fadeSatellite(map, visible)`, `setSelectedFeature(map, feature, maskFeature)`, `clearSelectedFeature(map)`, `setChoroplethDimmed(map, dimmed)`, and the exported layer/source id constants.

These are imperative Mapbox ops (verified via build + manual, per the no-mock-UI rule).

- [ ] **Step 1: Implement** — create `utils/cinematic-layers.ts`:

```typescript
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { Feature, FeatureCollection } from "geojson";
import { CINEMATIC } from "../config/constants";

export const SAT_SOURCE = "cinematic-satellite-src";
export const SAT_LAYER = "cinematic-satellite";
export const SEL_SOURCE = "cinematic-selected-src";
export const MASK_SOURCE = "cinematic-mask-src";
export const MASK_LAYER = "cinematic-mask";
export const OUTLINE_GLOW_LAYER = "cinematic-outline-glow";
export const OUTLINE_LAYER = "cinematic-outline";

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

/** Idempotently add satellite (beneath choropleth), mask + outline (on top).
 *  Only called from the flag-gated hook, after a region click (so geo-fills exists). */
export function ensureCinematicLayers(map: MapboxMap): void {
  if (!map.getSource(SAT_SOURCE)) {
    map.addSource(SAT_SOURCE, {
      type: "raster",
      url: "mapbox://mapbox.satellite",
      tileSize: 256,
    });
  }
  if (!map.getLayer(SAT_LAYER)) {
    const beforeId = map.getLayer("geo-fills") ? "geo-fills" : undefined;
    map.addLayer(
      {
        id: SAT_LAYER,
        type: "raster",
        source: SAT_SOURCE,
        paint: {
          "raster-opacity": 0,
          "raster-opacity-transition": {
            duration: CINEMATIC.SATELLITE_FADE_MS,
          },
        },
      },
      beforeId,
    );
  }
  if (!map.getSource(MASK_SOURCE)) {
    map.addSource(MASK_SOURCE, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getSource(SEL_SOURCE)) {
    map.addSource(SEL_SOURCE, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getLayer(MASK_LAYER)) {
    map.addLayer({
      id: MASK_LAYER,
      type: "fill",
      source: MASK_SOURCE,
      paint: {
        "fill-color": CINEMATIC.MASK_COLOR,
        "fill-opacity": 0,
        "fill-opacity-transition": { duration: CINEMATIC.SATELLITE_FADE_MS },
      },
    });
  }
  if (!map.getLayer(OUTLINE_GLOW_LAYER)) {
    map.addLayer({
      id: OUTLINE_GLOW_LAYER,
      type: "line",
      source: SEL_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": CINEMATIC.OUTLINE_GLOW_COLOR,
        "line-width": CINEMATIC.OUTLINE_WIDTH * 3,
        "line-opacity": 0.5,
        "line-blur": 3,
      },
    });
  }
  if (!map.getLayer(OUTLINE_LAYER)) {
    map.addLayer({
      id: OUTLINE_LAYER,
      type: "line",
      source: SEL_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": CINEMATIC.OUTLINE_COLOR,
        "line-width": CINEMATIC.OUTLINE_WIDTH,
        "line-opacity": 1,
      },
    });
  }
}

export function fadeSatellite(map: MapboxMap, visible: boolean): void {
  if (map.getLayer(SAT_LAYER)) {
    map.setPaintProperty(SAT_LAYER, "raster-opacity", visible ? 1 : 0);
  }
  if (map.getLayer(MASK_LAYER)) {
    map.setPaintProperty(
      MASK_LAYER,
      "fill-opacity",
      visible ? CINEMATIC.MASK_OPACITY : 0,
    );
  }
}

export function setSelectedFeature(
  map: MapboxMap,
  feature: Feature,
  maskFeature: Feature,
): void {
  (map.getSource(SEL_SOURCE) as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: [feature],
  });
  (map.getSource(MASK_SOURCE) as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: [maskFeature],
  });
}

export function clearSelectedFeature(map: MapboxMap): void {
  (map.getSource(SEL_SOURCE) as GeoJSONSource | undefined)?.setData(EMPTY_FC);
  (map.getSource(MASK_SOURCE) as GeoJSONSource | undefined)?.setData(EMPTY_FC);
}

/** Drop the metric tint inside the selected moment; restore on deselect. */
export function setChoroplethDimmed(map: MapboxMap, dimmed: boolean): void {
  if (map.getLayer("geo-fills")) {
    map.setPaintProperty(
      "geo-fills",
      "fill-opacity",
      dimmed ? 0 : CINEMATIC.CHOROPLETH_DEFAULT_OPACITY,
    );
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS. (If mapbox-gl's paint types reject a `*-transition` key, move that transition to a `map.setPaintProperty(SAT_LAYER, "raster-opacity-transition", { duration: CINEMATIC.SATELLITE_FADE_MS })` call right after the `addLayer`, and likewise for the mask — same effect.)

- [ ] **Step 3: Commit**

```bash
git add "packages/frontend/app/(app)/map/utils/cinematic-layers.ts"
git commit -m "feat(map): cinematic layer helpers (satellite, mask, outline, dim)"
```

---

### Task 6: 3D buildings + terrain helpers (ZIP only)

**Files:**

- Create: `packages/frontend/app/(app)/map/utils/cinematic-3d.ts`

**Interfaces:**

- Consumes: `CINEMATIC` from `../config/constants`.
- Produces: `enable3D(map)`, `disable3D(map)`, and ids `DEM_SOURCE`, `BUILDINGS_LAYER`.

- [ ] **Step 1: Implement** — create `utils/cinematic-3d.ts`:

```typescript
import type { Map as MapboxMap } from "mapbox-gl";
import { CINEMATIC } from "../config/constants";

export const DEM_SOURCE = "cinematic-dem";
export const BUILDINGS_LAYER = "cinematic-3d-buildings";

/** Real 3D: extruded buildings (from the light-v11 composite "building" layer)
 *  + draped terrain relief. Only meaningful at high zoom (ZIP). */
export function enable3D(map: MapboxMap): void {
  if (!map.getSource(DEM_SOURCE)) {
    map.addSource(DEM_SOURCE, {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({
    source: DEM_SOURCE,
    exaggeration: CINEMATIC.TERRAIN_EXAGGERATION,
  });

  if (!map.getLayer(BUILDINGS_LAYER)) {
    map.addLayer({
      id: BUILDINGS_LAYER,
      type: "fill-extrusion",
      source: "composite",
      "source-layer": "building",
      minzoom: CINEMATIC.BUILDINGS_MIN_ZOOM,
      filter: ["==", ["get", "extrude"], "true"],
      paint: {
        "fill-extrusion-color": "#c9ccd6",
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": ["get", "min_height"],
        "fill-extrusion-opacity": 0.85,
      },
    });
  }
}

export function disable3D(map: MapboxMap): void {
  map.setTerrain(null);
  if (map.getLayer(BUILDINGS_LAYER)) {
    map.removeLayer(BUILDINGS_LAYER);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "packages/frontend/app/(app)/map/utils/cinematic-3d.ts"
git commit -m "feat(map): 3D buildings + terrain enable/disable helpers"
```

---

### Task 7: The flag-gated orchestrator hook

**Files:**

- Create: `packages/frontend/app/(app)/map/hooks/useSelectedGeoCinematic.ts`

**Interfaces:**

- Consumes: `isCinematicZoomEnabled`, `getCinematicConfig` (Task 1); `buildSpotlightMask` (Task 2); `findFeatureById` (Task 3); `getGeometryBbox` (`utils/polylabel.ts`); all helpers from `cinematic-layers.ts` (Task 5) and `cinematic-3d.ts` (Task 6); `CINEMATIC` (constants); `SelectedGeography` (`../types`); `GeoLevel` (`@/lib/data`).
- Produces: `useSelectedGeoCinematic(options): void`.

- [ ] **Step 1: Implement** — create `hooks/useSelectedGeoCinematic.ts`:

```typescript
import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import type { GeoLevel } from "@/lib/data";
import type { SelectedGeography } from "../types";
import {
  isCinematicZoomEnabled,
  getCinematicConfig,
} from "../utils/cinematic-config";
import { buildSpotlightMask } from "../utils/spotlight-mask";
import { findFeatureById } from "../utils/find-feature";
import { getGeometryBbox } from "../utils/polylabel";
import { CINEMATIC } from "../config/constants";
import {
  ensureCinematicLayers,
  fadeSatellite,
  setSelectedFeature,
  clearSelectedFeature,
  setChoroplethDimmed,
} from "../utils/cinematic-layers";
import { enable3D, disable3D } from "../utils/cinematic-3d";

interface UseSelectedGeoCinematicOptions {
  mapRef: MutableRefObject<MapboxMap | null>;
  mapLoaded: boolean;
  geoLevel: GeoLevel;
  selectedGeography: SelectedGeography | null;
  geoDataRef: MutableRefObject<FeatureCollection | null>;
  searchNavigatedRef: MutableRefObject<number>;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useSelectedGeoCinematic({
  mapRef,
  mapLoaded,
  geoLevel,
  selectedGeography,
  geoDataRef,
  searchNavigatedRef,
}: UseSelectedGeoCinematicOptions): void {
  useEffect(() => {
    // KILL SWITCH: default off → no layers, no camera change, behaves as today.
    if (!isCinematicZoomEnabled()) return;

    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Deselect → restore today's view (helpers are no-ops if layers absent).
    if (!selectedGeography) {
      fadeSatellite(map, false);
      setChoroplethDimmed(map, false);
      clearSelectedFeature(map);
      disable3D(map);
      return;
    }

    const feature = findFeatureById(geoDataRef.current, selectedGeography.id);
    const geometry = feature?.geometry;
    if (
      !geometry ||
      (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")
    ) {
      return; // panel still opens; we just don't animate without a polygon
    }
    const bbox = getGeometryBbox(geometry);
    if (!bbox) return;

    const config = getCinematicConfig(geoLevel);
    const reduced = prefersReducedMotion();

    ensureCinematicLayers(map);
    setChoroplethDimmed(map, true);
    fadeSatellite(map, true);
    setSelectedFeature(
      map,
      feature,
      buildSpotlightMask(geometry as Polygon | MultiPolygon),
    );
    if (config.enable3D && !reduced) enable3D(map);
    else disable3D(map);

    // Backstop so an incidental geoLevel-change fly can't fight this one.
    searchNavigatedRef.current = Date.now();

    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      {
        padding: config.padding,
        pitch: reduced ? 0 : config.pitch,
        duration: reduced ? 0 : CINEMATIC.FLY_DURATION,
      },
    );
  }, [
    selectedGeography,
    mapLoaded,
    geoLevel,
    mapRef,
    geoDataRef,
    searchNavigatedRef,
  ]);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS. (If `getGeometryBbox` types complain about the geometry arg, pass `geometry as never` is NOT allowed — instead confirm its param is `any`; it is, per `polylabel.ts`.)

- [ ] **Step 3: Commit**

```bash
git add "packages/frontend/app/(app)/map/hooks/useSelectedGeoCinematic.ts"
git commit -m "feat(map): flag-gated useSelectedGeoCinematic orchestrator hook"
```

---

### Task 8: Wire the hook into the map page

**Files:**

- Modify: `packages/frontend/app/(app)/map/page.tsx`

**Interfaces:**

- Consumes: `useSelectedGeoCinematic` (Task 7); the in-scope `map`, `mapLoaded`, `geoLevel`, `selectedGeography`, `geoDataRef` (Task 4), `searchNavigatedRef`.

- [ ] **Step 1: Import the hook** — add near the other hook imports in `page.tsx`:

```typescript
import { useSelectedGeoCinematic } from "./hooks/useSelectedGeoCinematic";
```

- [ ] **Step 2: Call the hook** — immediately AFTER the existing `useMapCamera({ ... })` call (around line 220), add (the hook is always called; it no-ops internally when the flag is off):

```typescript
useSelectedGeoCinematic({
  mapRef: map,
  mapLoaded,
  geoLevel,
  selectedGeography,
  geoDataRef,
  searchNavigatedRef,
});
```

- [ ] **Step 3: Verify it compiles and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Verify FLAG-OFF behavior (the rollback guarantee)**

With no `NEXT_PUBLIC_CINEMATIC_ZOOM` set, run `npm run dev:fresh` (single instance), open `http://localhost:3000/map`, select a metro/county/ZIP. Expected: behaves exactly like today — panel opens, NO satellite, NO dimming, NO camera fly, NO tilt. Check the browser console for errors (none).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/map/page.tsx"
git commit -m "feat(map): wire flag-gated cinematic zoom hook into map page"
```

---

### Task 9: E2E smoke + manual verification (flag on) + final checks

**Files:**

- Create: `packages/frontend/tests/e2e/map-cinematic-zoom.spec.ts`

- [ ] **Step 1: Write the e2e smoke test** — create `tests/e2e/map-cinematic-zoom.spec.ts`. (This guards against runtime crashes in the new path; visual correctness is verified manually in Step 3 — canvas pixels can't be asserted reliably.)

```typescript
import { test, expect } from "@playwright/test";

// Runs against the dev server (playwright webServer starts `npm run dev`).
// NOTE: enable the feature for this run with NEXT_PUBLIC_CINEMATIC_ZOOM=true.
test.describe("Map cinematic zoom", () => {
  test("map loads and selecting a region does not crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/map");
    const canvas = page.locator("canvas.mapboxgl-canvas");
    await expect(canvas).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000); // let layers settle

    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(2500); // allow the cinematic fly
    }

    await expect(canvas).toBeVisible();
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the e2e smoke (feature ON)**

Run (PowerShell): `$env:NEXT_PUBLIC_CINEMATIC_ZOOM="true"; npm run test:e2e -- tests/e2e/map-cinematic-zoom.spec.ts`
Expected: PASS (map loads, click causes no uncaught page errors).

- [ ] **Step 3: Manual verification with live data (the real acceptance gate)**

Enable the flag and start a single dev instance:

- PowerShell: `$env:NEXT_PUBLIC_CINEMATIC_ZOOM="true"; npm run dev:fresh` (kill stray node first; one frontend + one backend only).
- Open `http://localhost:3000/map`.

Verify each:

- [ ] **Metro:** at metro level, click a metro → smooth premium fly to center, satellite fades in, surroundings dim, white glowing outline, camera stays **flat** (no/low tilt).
- [ ] **County:** click a county → same, near-flat.
- [ ] **ZIP:** pick a state + ZIP level, click a ZIP → fly tilts (~55°), **3D buildings** extrude, terrain relief where hilly, crisp satellite inside; metric tint gone inside the region (value shows in the panel).
- [ ] **Deselect:** close the panel / click empty → satellite + mask + 3D fade/tear down, choropleth tint returns; metro/county show no leftover tilt/terrain.
- [ ] **Reduced motion:** enable OS "reduce motion", reselect → instant jump (no curved fly, no tilt, no terrain), but outline + dim still render.
- [ ] **Console:** no errors throughout.

- [ ] **Step 4: Full build + unit suite**

Run: `npx tsc --noEmit && npm run lint && npm run build && npm run test:unit`
Expected: all PASS (build clean per project rule — fix any error before finishing).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/tests/e2e/map-cinematic-zoom.spec.ts"
git commit -m "test(map): e2e smoke for cinematic geo zoom"
```

---

## Rollout Note

Ship with `NEXT_PUBLIC_CINEMATIC_ZOOM` **unset** (feature dark). To enable in an environment, set `NEXT_PUBLIC_CINEMATIC_ZOOM=true` in Railway and redeploy (Next.js inlines `NEXT_PUBLIC_*` at build). To roll back, set it to `false`/unset and redeploy — the map returns to today's behavior with no code revert.

## Spec Coverage Check

- Satellite via raster layer not setStyle → Task 5 (`ensureCinematicLayers`).
- Spotlight mask + outline → Task 2 + Task 5/7.
- Drop choropleth tint inside region; metric in panel → Task 5 (`setChoroplethDimmed`) + existing panel.
- Real 3D (buildings + terrain) at ZIP; flat metro/county; no fake-3D → Task 1 config + Task 6 + Task 7.
- Trigger = existing selection event → Task 7 (watches `selectedGeography`).
- Premium motion + `prefers-reduced-motion` → Task 1 (`FLY_DURATION`) + Task 7.
- Terrain/extrusion gated to ZIP + torn down on deselect → Task 7 (`enable3D`/`disable3D`).
- Coexistence with `useMapCamera` (searchNavigatedRef backstop) → Task 7/8.
- Env kill switch, default OFF, additive, behavior-preserving → Tasks 1, 4, 7, 8 + flag-off verification (Task 8 Step 4).
- No heavy dependency (turf avoided) → Tasks 2, all.
- No first-load cost (interaction-only) → layers ensured inside the hook on selection.
- Verified on real map with live data → Task 9.
- Search-path unification → explicitly deferred (spec Non-Goals).
