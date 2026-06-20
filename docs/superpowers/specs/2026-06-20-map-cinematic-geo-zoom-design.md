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

**No fake 3D.** We only tilt where there is genuine geometry to catch the light. Tilting a
flat satellite image to fake depth looks cheap, so metro/county stay near-flat and ZIP gets
_real_ 3D (extruded buildings, plus terrain relief where the land is actually hilly).

| Level      | Camera                                      | Tilt / 3D                                                                        | Satellite payoff                  | The star                                     |
| ---------- | ------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------- |
| **Metro**  | `fitBounds`, generous padding (lands ~z7–9) | **near-zero tilt (~0–5°), flat** — nothing reads in 3D this far out              | weak — backdrop only              | Spotlight + outline — the _shape_ carries it |
| **County** | `fitBounds`, medium padding                 | **minimal tilt (~0–10°), flat**                                                  | decent                            | Outline + satellite together                 |
| **ZIP**    | `fitBounds`, tight padding (lands ~z13–15)  | **real 3D** — extruded buildings + terrain (if hilly); meaningful tilt (~50–60°) | strong — crisp rooftops, the hero | Full cinematic 3D                            |

Rationale: satellite "wow" and _real_ 3D both scale with how tightly we can zoom. A ZIP
fits at zoom ~13–15, where extruded buildings render and satellite is crisp — so ZIP is
where we spend the 3D budget. A metro spans so much area we land at zoom ~7–9, where neither
buildings nor terrain read; tilting there only produces the cheap flat-image fake-3D we are
explicitly avoiding. So metro/county stay near-flat and lean on the spotlight + outline
(which work identically at every level); ZIP gets the genuine 3D moment. See §5.4 for the
terrain-vs-buildings detail.

### Trigger

**Same selection event as today — no new affordance.** When the user picks a geo (the
existing `handleFeatureClick` that already opens the right panel), that selection _is_ the
trigger to zoom. Selecting a geo always flies the camera; there is no separate "focus" or
"zoom in" button. (Search-result selection routes through the same path — see §5.6.)

### Sequence on selection (single fly)

1. User selects a region → existing `handleFeatureClick` sets `selectedGeography`.
2. New effect detects the change, looks up the matched feature in the in-memory
   `"geo-data"` source, computes its bbox via `getGeometryBbox()`.
3. Choropleth metric fill is removed (faded out) for the moment; the metric value is shown
   in the right panel instead (see §5.1). Satellite raster layer's opacity fades in (0 → ~1).
4. `fitBounds(bbox, { padding, pitch, duration })` runs — one curved move (real 3D tilt at
   ZIP; near-flat at county/metro per §4).
5. Spotlight mask (everything-but-this-polygon, semi-opaque dark fill) dims the surroundings
   so the **inside of the selected region shows clean satellite with no tint**, and the
   glowing outline renders on the boundary.
6. On deselect / selecting a different geo: outline + mask + camera update; on full deselect,
   satellite fades out and the choropleth fill fades back in.

## 5. Technical Design

### 5.1 Satellite: raster layer, NOT `setStyle`

**Decision:** Do **not** call `map.setStyle("…/satellite-streets…")`. A full style swap
tears down and re-adds every source and layer (the `geo-data` choropleth, labels, the new
outline/mask), which flashes and is error-prone. Instead, add a raster layer from the
`mapbox://mapbox.satellite` tileset positioned **beneath** the existing vector layers, and
animate its `raster-opacity` via `setPaintProperty`. Existing layers survive untouched;
the transition is a smooth fade. This is the single most important implementation choice
for the effect feeling premium vs. janky.

**Choropleth ↔ satellite blend (decided):** when satellite fades in, the choropleth metric
fill is **dropped entirely** (faded to 0) — there is **no metric color tint inside the
selected region**; the user sees clean satellite there. The metric value moves to the right
panel. The only "tint" is the dark spotlight mask _around_ the region (§5.2). On full
deselect, satellite fades out and the choropleth fill returns.

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

### 5.4 Real 3D at ZIP, flat elsewhere (no fake-3D)

**Principle:** only tilt where there is genuine 3D geometry to reveal. A tilted _flat_
satellite image looks cheap, so we do **not** fake depth with pitch. Two real-3D mechanisms,
both native to Mapbox GL v3.17, applied **at ZIP zoom only**:

1. **3D buildings (extrusion)** — extruded building footprints from the vector `building`
   data (present in the `light-v11` style we already load) via a `fill-extrusion` layer with
   `fill-extrusion-height`. Renders at high zoom (~z15+), i.e. ZIP scale. Works **anywhere
   there are buildings** — this is the dependable "city in 3D" payoff.
2. **3D terrain (DEM relief)** — `map.addSource('mapbox-dem', { type:'raster-dem',
url:'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize:512, maxzoom:14 })` +
   `map.setTerrain({ source:'mapbox-dem', exaggeration })`. Drapes the satellite raster over
   real elevation. **Only visible where the land is actually hilly** — adds nothing in flat
   metros, so it composes harmlessly: on everywhere at ZIP, visible only where there's relief.

Behavior by level (matches §4):

- **ZIP:** enable 3D buildings + terrain; tilt to ~50–60° so the geometry reads. The real
  cinematic moment.
- **County / Metro:** near-flat (tilt ~0–10°), no buildings/terrain (they don't render at
  that zoom). Disable terrain/extrusion to keep the camera flat and the frame clean.

Cost note: terrain warps every layer each frame and adds DEM tile fetches; both are gated to
ZIP-level selections and torn down on deselect / when zooming back out, so metro/county and
first load pay nothing. If ZIP performance disappoints on low-end mobile, buildings-only
(skip terrain) is the fallback — buildings are the cheaper, more reliable half.

### 5.5 Where it attaches

- New hook `app/(app)/map/hooks/useSelectedGeoCinematic.ts` (keep separate from
  `useMapCamera` for clean responsibility split, per CLAUDE.md §1.3).
  - Inputs: `mapRef`, `selectedGeography`, the in-memory `geo-data` features, geoLevel.
  - Effects: on `selectedGeography` change → compute bbox → drop choropleth fill + fade
    satellite in → `fitBounds` with level-scaled tilt/padding → update `"selected-geo"`
    source + mask → **at ZIP only**, enable 3D buildings (`fill-extrusion`) + terrain.
  - Cleanup: on deselect → fade satellite out, restore choropleth fill, clear mask/outline,
    and **tear down terrain/extrusion** (so they never persist into metro/county or idle).
- Reuse existing constants in `app/(app)/map/config/constants.ts`
  (`MAP_PADDING`, `ANIMATION_DURATIONS.MAP_FLY`); add per-level tilt + padding values,
  satellite fade duration, and the premium fly duration (§6) there (no magic numbers).
- `page.tsx` wires the hook near `useMapSelection` / `useMapCamera`.

### 5.6 Coexistence with existing camera control

`useMapCamera` already flies on geoLevel/state change, and `useMapSearch` flies on search
selection. The new hook must not fight them. Rule: a _feature selection_ fly (this spec)
takes precedence over the geoLevel-change fly; search-result selection should route through
the same cinematic path so behavior is consistent. Define one ownership order so two
`flyTo`s never run at once.

## 6. Motion & Accessibility

**Premium feel (decided).** The motion is deliberately cinematic, not snappy — a slower,
well-eased fly that reads as high-end. We accept the small beat of delay before the camera
settles as the cost of the premium feel.

- Easing: M3 standard `cubic-bezier(0.2, 0, 0, 1)`. Fly duration longer than the current
  `MAP_FLY` (~1000ms) — target ~1400–1800ms for the cinematic move (tune in QA); satellite
  fade ~500–700ms, timed to overlap the fly so imagery is present as the camera arrives.
  At ZIP, ease the tilt in over the fly rather than starting tilted.
- `prefers-reduced-motion: reduce` → no curved/tilted animation: jump-cut with `jumpTo`,
  tilt 0, satellite off or instant, no terrain. Outline + dim still render so the selection
  stays legible. (Premium feel never overrides accessibility.)
- Mobile: ZIP tilt at the lower end of the range (tilt + small viewport = disorienting);
  confirm satellite/DEM tile cost is acceptable on cellular (loads only on interaction).

## 7. Performance

- Nothing here runs at initial load — satellite tiles, mask, outline, pitch all trigger on
  the first selection. First paint is unchanged → no LCP/INP regression.
- Satellite raster tiles are cached by Mapbox after first fetch.
- No new heavy dependency (turf avoided; we reuse `getGeometryBbox` + `@mapbox/polylabel`).
- Heap: we already run Mapbox GL and the frontend has `--max-old-space-size=4096`. Adding a
  raster source + two small GeoJSON layers is negligible vs. the existing choropleth.

## 8. Decisions (resolved) & Remaining Questions

**Resolved in brainstorm:**

1. **Choropleth ↔ satellite blend** → drop the metric fill entirely; clean satellite inside
   the selected region, dark spotlight mask around it, metric value in the panel. (§5.1)
2. **3D approach** → real 3D only: extruded buildings + terrain at ZIP; near-flat (minimal
   tilt) at county/metro; no fake-3D pitch on flat imagery. (§4, §5.4)
3. **Trigger** → the existing geo-selection event; no separate focus/zoom affordance. (§4)
4. **Motion** → premium/cinematic (slower, well-eased), accessibility overrides it. (§6)
5. **Satellite persistence** → revert on deselect (satellite + 3D are part of the selected
   moment, not a persistent mode).

**Remaining (smaller, can settle in implementation/QA):**

- **Terrain on flat ZIPs / low-end mobile:** buildings-only fallback if terrain underperforms
  (terrain is the optional half; buildings are the reliable half). (§5.4)
- **Outline style on satellite:** exact glow color/width for legibility over imagery — tune
  in QA (brand indigo vs. light halo).
- **Exact durations/tilt angles:** ranges given in §4/§6; final values tuned against the real
  map.

## 9. Acceptance Criteria

- [ ] Selecting a metro/county/ZIP (the existing selection event) centers it via a single premium fly-to; no separate affordance.
- [ ] Satellite imagery fades in beneath existing layers with no full-style-swap flash.
- [ ] Choropleth metric fill is dropped inside the selected region (clean satellite, no tint); metric shows in the panel.
- [ ] Surroundings are dimmed by the spotlight mask; the selected geography shows a glowing outline.
- [ ] ZIP gets real 3D (extruded buildings + terrain where hilly) with meaningful tilt; county/metro stay near-flat (no fake-3D pitch).
- [ ] Terrain + extrusion are enabled only at ZIP and torn down on deselect / zoom-out — never persist into county/metro or idle.
- [ ] Tilt, padding, and durations scale by geo level per §4/§6; motion reads as premium/cinematic.
- [ ] Deselecting restores the choropleth fill and fades satellite + 3D out.
- [ ] `prefers-reduced-motion` jump-cuts (no tilt/terrain/curved fly) but keeps selection legible.
- [ ] No regression to first-load LCP/INP (satellite/mask/3D are interaction-only).
- [ ] No new heavy dependency added; reuses `getGeometryBbox` and existing constants.
- [ ] Verified against the real map with live data (not mocks), desktop + mobile.
