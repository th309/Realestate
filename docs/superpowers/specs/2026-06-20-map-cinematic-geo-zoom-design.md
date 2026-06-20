# Cinematic Geo Zoom — Satellite Spotlight on Selection

**Date:** 2026-06-20
**Status:** Design — approved in brainstorm, pending spec review
**Surface:** `/map` (the main interactive map)
**Related:** [Landing narrative scroll](./2026-06-20-landing-narrative-scroll-design.md) reuses this as its "see it on the map" beat.

---

## 1. Summary

When a user selects a metro, county, or ZIP on the map, the camera performs a cinematic
fly-to that centers the geography, fades in real satellite imagery beneath the existing
vector layers, dims everything outside the selected boundary (a "spotlight"), draws a
glowing outline of the geography's footprint, and tilts the camera for a 3D feel. The
effect is interaction-triggered only — it costs nothing at initial load and does not
touch LCP/INP on first paint.

This is the one place where a "3D moment" genuinely fits PropertyIQ: it reinforces
spatial intelligence, doubles as a product demo, and is built entirely on native
Mapbox GL primitives we already ship — no three.js, no GSAP, no WebGL we hand-roll.

## 2. Goals / Non-Goals

**Goals**

- Selecting a geo flies the camera to center it, with motion that reads as cinematic (curved arc + pitch).
- Real satellite imagery appears for the selected geo without a jarring full-style swap.
- The selected geography is unmistakable: dimmed surroundings + glowing boundary outline.
- The drama scales by geo level (ZIP = full cinematic, metro = restrained).
- Zero regression to first-load Core Web Vitals; satellite tiles load lazily on interaction.
- Respects `prefers-reduced-motion`.

**Non-Goals**

- No GSAP / three.js / custom WebGL. (That is the Hubtown approach we are explicitly rejecting.)
- No persistent "satellite mode" toggle in this spec (could be a later addition; here satellite is part of the selection moment only).
- No change to how metric choropleths, the legend, or search currently behave.
- No change to data fetching or the data layer.

## 3. Why This Is Feasible (codebase grounding)

A read-only investigation confirmed all four hard pieces already exist:

| Piece                             | Status                                             | Location                                                                 |
| --------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| Map library                       | react-map-gl 8.1.0 + mapbox-gl 3.17.0              | `app/(app)/map/hooks/useMapInstance.ts:29`                               |
| **Boundary polygons client-side** | **Yes — full GeoJSON in memory**, not vector tiles | `useMapLayers.ts:153` `addSource("geo-data", { type: "geojson", data })` |
| Camera animation                  | `flyTo` + `fitBounds` already used                 | `useMapCamera.ts:63`, `useMapSearch.ts:84`                               |
| Bbox utility                      | `getGeometryBbox()` already in use                 | `app/(app)/map/utils/polylabel.ts:46`                                    |
| Selection state                   | `SelectedGeography`                                | `types.ts:82`, `useMapSelection` in `page.tsx:80`                        |

The make-or-break question was whether boundary geometry is available client-side. It is:
geometry is loaded from `/public/geojson/*.json` (national → county) and per-state API
endpoints (`/geojson/{county,city,zip}/{STATE}`) into the `"geo-data"` GeoJSON source.
Because we hold the actual polygon coordinates, both the outline and the spotlight mask
are trivial. There is currently **no** satellite style and **no** pitch/bearing usage —
those are the genuinely new pieces.

## 4. The Experience

The constant across all geo levels — the part that carries the moment — is the trio:
**curved fly-to + spotlight mask + glowing outline.** Satellite is the variable layer
whose payoff scales with how tightly we can zoom.

### Per-level behavior

| Level      | Camera                                      | Pitch                         | Satellite payoff                     | The star                                     |
| ---------- | ------------------------------------------- | ----------------------------- | ------------------------------------ | -------------------------------------------- |
| **Metro**  | `fitBounds`, generous padding (lands ~z7–9) | low (~20°)                    | weak — blurry terrain; backdrop only | Spotlight + outline — the _shape_ carries it |
| **County** | `fitBounds`, medium padding                 | medium (~40°)                 | decent                               | Outline + satellite together                 |
| **ZIP**    | `fitBounds`, tight padding (lands ~z13–15)  | full (~55°), optional terrain | strong — crisp rooftops, the hero    | Full cinematic                               |

Rationale: satellite "wow" scales _inversely_ with geo size. A ZIP fits at zoom ~14+
where satellite is stunning; a metro spans so much area we land at zoom ~7–9 where
satellite reads as generic terrain. And a tilted _flat_ satellite image (low zoom, no
terrain) does not look 3D — pitch only reads as depth when there is height to catch light.
So we scale pitch and satellite ambition by level, and let the spotlight+outline (which
work identically at every level) do the heavy lifting where satellite is weak.

### Sequence on selection (single fly)

1. User clicks a region → existing `handleFeatureClick` sets `selectedGeography`.
2. New effect detects the change, looks up the matched feature in the in-memory
   `"geo-data"` source, computes its bbox via `getGeometryBbox()`.
3. Satellite raster layer's opacity begins fading in (0 → ~1).
4. `fitBounds(bbox, { padding, pitch, duration })` runs — one curved, tilted move.
5. Spotlight mask layer (everything-but-this-polygon, semi-opaque dark fill) and the
   glowing outline line layer render for the selected feature.
6. On deselect / selecting a different geo: outline + mask update; satellite fades back
   out if nothing is selected.

## 5. Technical Design

### 5.1 Satellite: raster layer, NOT `setStyle`

**Decision:** Do **not** call `map.setStyle("…/satellite-streets…")`. A full style swap
tears down and re-adds every source and layer (the `geo-data` choropleth, labels, the new
outline/mask), which flashes and is error-prone. Instead, add a raster layer from the
`mapbox://mapbox.satellite` tileset positioned **beneath** the existing vector layers, and
animate its `raster-opacity` via `setPaintProperty`. Existing layers survive untouched;
the transition is a smooth fade. This is the single most important implementation choice
for the effect feeling premium vs. janky.

The choropleth fill sits above satellite — so when satellite is visible we likely lower
the choropleth fill-opacity (or keep only the selected region's metric tint) so the
imagery shows through. Exact blend is an open decision (§8).

### 5.2 Spotlight mask

Build a polygon covering the world (or current viewport bounds) with the selected
geography's polygon as a hole, rendered as a dark semi-transparent `fill` layer. Because
we hold the polygon coordinates client-side, this is a small geometry transform. Two
implementation options:

- Hand-rolled: world-ring outer + selected polygon as inner ring(s) in a single Feature.
- `@turf/turf`'s `mask()` (≈10 lines) — **but turf is not currently a dependency.**

**Recommendation:** hand-roll the mask to avoid adding the full turf dependency for one
function; we already have `getGeometryBbox` and `@mapbox/polylabel` for geometry needs.
(Open decision §8 if a richer geometry toolkit is wanted later.)

### 5.3 Outline

A `line` layer bound to the selected feature only, styled as a glowing boundary
(brand indigo or a light halo against satellite). Source can be a dedicated
`"selected-geo"` GeoJSON source holding just the selected feature, kept in sync by the
selection effect. Keeping it separate from `"geo-data"` avoids re-styling the whole
choropleth on every selection.

### 5.4 Pitch & optional terrain

Pitch is passed to `fitBounds`/`flyTo` (`pitch: 20|40|55` by level). Real relief (hills
catching light) requires `map.setTerrain({ source: dem })` with a `mapbox-dem` raster-dem
source. Recommendation: **ship pitch-only first.** Add terrain later, ZIP-only, behind a
check that it earns its cost — it is pointless and slow at metro scale.

### 5.5 Where it attaches

- New hook `app/(app)/map/hooks/useSelectedGeoCinematic.ts` (keep separate from
  `useMapCamera` for clean responsibility split, per CLAUDE.md §1.3).
  - Inputs: `mapRef`, `selectedGeography`, the in-memory `geo-data` features, geoLevel.
  - Effects: on `selectedGeography` change → compute bbox → fade satellite → `fitBounds`
    with level-scaled pitch/padding → update `"selected-geo"` source + mask.
  - Cleanup: on deselect, fade satellite out, clear mask/outline.
- Reuse existing constants in `app/(app)/map/config/constants.ts`
  (`MAP_PADDING`, `ANIMATION_DURATIONS.MAP_FLY`); add level-scaled pitch + padding values
  and satellite fade duration there (no magic numbers in the hook).
- `page.tsx` wires the hook near `useMapSelection` / `useMapCamera`.

### 5.6 Coexistence with existing camera control

`useMapCamera` already flies on geoLevel/state change, and `useMapSearch` flies on search
selection. The new hook must not fight them. Rule: a _feature selection_ fly (this spec)
takes precedence over the geoLevel-change fly; search-result selection should route through
the same cinematic path so behavior is consistent. Define one ownership order so two
`flyTo`s never run at once.

## 6. Motion & Accessibility

- Easing: M3 standard `cubic-bezier(0.2, 0, 0, 1)`. Durations from constants
  (`MAP_FLY` ~1000ms today); satellite fade ~400–600ms.
- `prefers-reduced-motion: reduce` → no curved/tilted animation: jump-cut with `jumpTo`
  (or `essential: false` / minimal duration), pitch 0, satellite either off or instant.
  The outline + dim still render so the selection is still legible.
- Mobile: lower default pitch (tilt + small viewport = disorienting); confirm satellite
  tile cost is acceptable on cellular (it loads only on interaction).

## 7. Performance

- Nothing here runs at initial load — satellite tiles, mask, outline, pitch all trigger on
  the first selection. First paint is unchanged → no LCP/INP regression.
- Satellite raster tiles are cached by Mapbox after first fetch.
- No new heavy dependency (turf avoided; we reuse `getGeometryBbox` + `@mapbox/polylabel`).
- Heap: we already run Mapbox GL and the frontend has `--max-old-space-size=4096`. Adding a
  raster source + two small GeoJSON layers is negligible vs. the existing choropleth.

## 8. Open Decisions (for the user)

1. **Choropleth vs. satellite blend.** When satellite is faded in, do we (a) keep the full
   metric choropleth tint over it, (b) drop choropleth to just the selected region, or
   (c) hide choropleth entirely for the selected moment and show metric only in the panel?
   Recommendation: (b) — tint the selected region, let satellite show outside it under the
   dim mask.
2. **Terrain at ZIP.** Ship pitch-only everywhere first, add DEM terrain for ZIP later — or
   include ZIP terrain in v1? Recommendation: defer terrain.
3. **Persisted satellite toggle.** Out of scope here, but should selecting satellite be
   "sticky" once shown, or always revert on deselect? Recommendation: revert on deselect
   for v1.

## 9. Acceptance Criteria

- [ ] Selecting a metro/county/ZIP centers it via a single curved, tilted fly-to.
- [ ] Satellite imagery fades in beneath existing layers with no full-style-swap flash.
- [ ] Selected geography shows a glowing outline; everything outside it is dimmed.
- [ ] Pitch and padding scale by geo level per §4.
- [ ] Deselecting / reselecting updates outline + mask and fades satellite appropriately.
- [ ] `prefers-reduced-motion` disables the animation but keeps selection legible.
- [ ] No regression to first-load LCP/INP (satellite/mask/pitch are interaction-only).
- [ ] No new heavy dependency added; reuses `getGeometryBbox` and existing constants.
- [ ] Verified against the real map with live data (not mocks).
