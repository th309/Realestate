# Market Explorer: Real-Boundary Tile Maps + Population-Ranked Caps + Combined-Metric Caching

**Date:** 2026-07-15
**Status:** Design approved, ready for implementation planning

## Problem

Market Explorer's "Map" view (`StateTileMap.tsx`) only exists at the national state level — it's a fixed 50-tile grid that doesn't generalize to Metro, County, or ZIP scope. Two concrete issues surfaced this:

1. **Tile visibility is wrongly gated on PropertyIQ Score.** `StateTileMap`'s `hasData` check requires `scoreByRegion[id] != null`, even when the user has a different metric selected (Home Value YoY, Hotness, Days on Market, Months of Supply). Since PropertyIQ Score is metro-aggregated and many states genuinely lack it, states with real data for the _selected_ metric render as empty gray tiles.
2. **No tile map exists below state scope.** The user wants to drill into Metro → County → ZIP the way the bubble chart already allows, but see it as a real geographic shape at every level, not just nationally.

## Design

### 1. Real-boundary tiles replace the fixed state grid, at every scope level

Boundary geometry already exists in the repo as static files — no new backend geometry work needed:

- `packages/frontend/public/geojson/states.json`
- `packages/frontend/public/geojson/metros.json` (CBSA boundaries, `LSAD` field distinguishes true metro `M1` from micropolitan `M2`)
- `packages/frontend/public/geojson/counties.json`

The frontend filters these client-side by parent region (state FIPS, CBSA code) and joins by region ID to the score/metric data the scope endpoint already returns. A single generalized tile-map component replaces `StateTileMap.tsx` and renders whatever shapes are relevant to the current scope (all US states nationally, all metros within a state, all counties within a metro, all ZIPs within a county). `StateTileMap.tsx` and its test are deleted, not kept alongside the new component — the national state view becomes one case of the general renderer, not a separate one-off.

Real boundaries tile the parent shape with no gaps or overlaps by definition, so unlike the bubble chart or a dot-marker map, there is no "too many regions, they collide" failure mode — a region too small to hold a label just renders color-only.

### 2. Region counts differ by tier — two different reasons to cap

**Metro tier (national roster, and state → metro drill): fetch uncapped, cap only the bubble-chart rendering.**

`resolveChildRegions`'s national-metro branch reads `screener_snapshot` filtered to `geo_level='metro'` with no further type filter, so the real roster includes micropolitan statistical areas alongside true CBSA metros — confirmed live against the running backend (Texas's state→metro scope returns 50 regions including micropolitan-only areas like "Sulphur Springs, TX" and "Bonham, TX", not just its handful of major metros). CLAUDE.md's independently-validated score coverage figure (935 scored metros, `validation-claims.ts`) corroborates this at the national level. **The uncapped national roster is therefore ~935, not the ~383 true-CBSA-only figure an early mockup used** — the tile map renders the full ~935, deliberately including micropolitan areas, not a filtered subset. The bubble chart (log-scale scatter) then takes the first 70 entries (already population-sorted) **client-side** for its own rendering — no separate fetch, no separate cache entry. The tile map and bubble chart read the same fetched/cached data; they just render different slices of it.

**ZIP tier (county → ZIP drill): cap the fetch itself at top 70 by population.**

This tier is different because of aggregate scale, not per-scope size: there are ~3,143 possible county parent-scopes nationally, and a handful of outlier counties (LA County, Cook County, Harris County) have 130–140 ZIPs each. Fetching every ZIP for every county that ever gets visited is the dominant contributor to Redis memory pressure (see §4) — verified against real production Redis, which is already at 181MB/256MB. So unlike the metro tier, the ZIP-tier fetch itself is capped at the top 70 ZIPs by population per county, and both the tile map and bubble chart at ZIP scope only ever see that capped set.

**County tier (metro → county drill): fetch uncapped**, same reasoning as the metro tier — even the largest metro's county count is small (~3,143 counties spread across ~935 metro/micro areas), and there's no equivalent aggregate-scale problem the way there is with ~3,143 _independent_ county parent-scopes at the ZIP tier.

Cap constants live in `packages/backend/src/market-explorer/resolve-child-regions.ts`, replacing the current single `CHILD_CAP = 60` / `NATIONAL_METRO_CAP = 40`:

- `BUBBLE_METRO_CAP = 70` (frontend-side slice, not a fetch cap)
- `ZIP_FETCH_CAP = 70` (backend fetch cap)
- Metro and county rosters: no cap constant: return every resolved child.

**Every capped view must disclose the cap and provide a way to reach what's excluded.**

- **Metro bubbles**: no new affordance needed. The tile map at the same scope is uncapped (all 383), so switching to "Map" view already surfaces every metro — the existing Bubbles/Map toggle _is_ the escape hatch. Still worth a light "top 70 of 383 by population — see all in Map view" notice on the bubble view itself so it's discoverable without trial and error.
- **ZIP tier (both bubbles and tiles, since the fetch itself is capped)**: this is the real case that needs a new mechanism, since the excluded ZIPs are absent from the data entirely, not just from one view. Add a notice ("Showing top 70 of N ZIP codes in {county}, by population") plus a search-to-jump affordance for any ZIP not in the capped set. Reuse the existing pattern from the main `/map` page (`useMapSearch.ts`, wrapping `useUniversalSearch` + Mapbox Geocoding fallback) rather than building a new search component — it already does exactly this job (fly to/highlight any region by name, independent of what's currently rendered) and is proven in production.

### 3. Backend combines all 8 metrics into one response per scope

Today the frontend fires 8 separate requests per scope (`FETCHED_METRICS.map(...)` in `useExplorerScopeData.ts`), each hitting `GET /api/market-explorer/scope/:geoLevel?metric=X` and each duplicating the `dates` + `regions` payload. The existing client-side merge logic (`mergeScopeResponses` in `useExplorerScopeData.ts`) that aligns per-metric responses onto one shared date axis moves server-side into `MarketExplorerService.getScopeSeries`: it fetches all 8 metrics, aligns them, and returns one combined `{dates, regions, series: {metric1: [...], metric2: [...], ...}}` payload. One HTTP request per scope instead of 8; one Redis entry instead of 8. The `metric` query param is dropped from `ScopeQueryDto` (or made optional/ignored) since a scope request now always returns every metric.

### 4. Redis caching: pipeline-aligned TTL, not a flat window

Reuse the existing `ttlUntilNextRefresh()` helper (`packages/backend/src/market-snapshot/market-snapshot-ttl.helper.ts`), already built and proven for exactly this purpose in `MarketSnapshotService`'s `snapshot:v1` cache. It computes seconds until the next monthly-pipeline boundary (17th, 21:00 UTC) rather than a flat N-day window, so a cache entry stays warm for the entire inter-refresh period regardless of when it was written, and staleness is bounded to a few hours past each real data import — not up to a month, which a flat 30-day TTL could allow depending on write timing.

`MarketExplorerService` gets `RedisService` injected (same DI pattern as `MarketSnapshotService`):

- Cache key: `market-explorer:v2:${geoLevel}:${parentLevel}:${parentId}:${includeNearby}` (no `metric` segment — the combined response covers all of them; `v2` because the payload shape is changing from today's per-metric, capped-at-60 format, so any old cached entries are naturally bypassed rather than served stale).
- Read: `redis.getByKey(key)` → return on hit.
- Miss: run resolve + fetch + align (as today, adapted for the combined-metric response), `redis.setByKey(key, result, ttlUntilNextRefresh())`.
- Redis unavailable (local dev without it running) → both calls no-op automatically, already built into `RedisService`; behavior is unchanged from today, just uncached.
- Consider reusing `MarketSnapshotService`'s inflight-request de-dupe pattern (`inflightSnapshots` map) if cold-cache builds for the larger combined payload prove slow enough that concurrent identical requests (e.g., React double-invoke, multiple users loading the same scope at once) are worth coalescing. Not required for initial implementation — verify with real timing first.

**Verified against production**, not assumed: Redis is at 181MB/256MB used (`allkeys-lru` eviction policy) as of this design's writing. The capped/combined design above keeps the worst-case "every possible scope ever cached simultaneously" total to roughly 174MB (national metro at the corrected ~935-region roster from §2 adds a few MB over the earlier 383-based estimate; the ZIP tier's ~155MB remains the dominant term either way) — still more than the ~66MB free headroom in that worst case, but `allkeys-lru` means the actual footprint tracks real usage (a small fraction of all 3,143 possible county scopes will ever be visited in one ~30-day cache cycle) rather than the combinatorial maximum, evicting cold entries automatically rather than erroring.

### 5. Existing bug to verify during implementation

During initial investigation (separate from this design), clicking the "Metro" scope tab while the state-level map view was active did not reset back to the bubble/metro view in one browser session, though it could not be reproduced in a second, simpler repro. Since this design replaces the map/bubble toggle logic (`explorer-reducer.ts`'s `SET_VIEW`/`RESET_NATIONAL`/`NAVIGATE_CRUMB` cases, `explorer-navigation.ts`'s `buildLevelTabs`) to work at every scope level rather than being state-view-specific, implementation should include verifying this transition works correctly at each level, not just carry the old behavior forward unexamined.

## File-level impact (informational — not a task breakdown)

**Backend** (`packages/backend/src/market-explorer/`):

- `resolve-child-regions.ts` — replace `CHILD_CAP`/`NATIONAL_METRO_CAP` with the tier-specific caps in §2; metro/county rosters become uncapped.
- `market-explorer.service.ts` — combined-metric fetch/align (moving `mergeScopeResponses` logic in from the frontend), Redis read-through wrapper.
- `market-explorer.dto.ts` — drop/relax the `metric` param.
- New/adapted: Redis injection, cache key builder.

**Frontend**:

- `app/(app)/market/explorer/components/StateTileMap.tsx` and its test — deleted, replaced by a new generalized tile-map component (name TBD in planning, e.g. `GeoTileMap.tsx`) that consumes real geojson + the scope response.
- `app/(app)/market/explorer/lib/useExplorerScopeData.ts` — simplifies once merge logic moves server-side (single query instead of `useQueries` over `FETCHED_METRICS`).
- `lib/data/fetchers/market-explorer.ts` — response shape changes to the combined-metric format.
- `app/(app)/market/explorer/MarketExplorer.tsx` — `heroChart` selection logic generalizes beyond the current state-only `StateTileMap` special case.
- `app/(app)/market/explorer/lib/explorer-reducer.ts`, `explorer-navigation.ts` — verify/fix the map↔bubbles transition per §5.
- `app/(app)/market/explorer/components/BubbleChart.tsx` — client-side top-70 slice for metro-tier bubble rendering, plus a "top 70 of N — see all in Map view" notice.
- New (ZIP tier only): a "showing top N of M" notice and a search-to-jump control, reusing `app/(app)/map/hooks/useMapSearch.ts` (or extracting its shared search logic if it isn't already geo-level-agnostic) rather than a new component.

## Verification requirement

Per project convention, the implementation plan must include end-to-end verification against real data (real Supabase queries, real Redis where available, real geojson files) — no mocked data layer. Concretely: drilling State → Metro → County → ZIP in a live browser session, at each level confirming both the tile map (real shapes, correct region count per §2) and bubble view render correctly, that switching metrics doesn't hide valid non-score data, and that a second request for the same scope hits the Redis cache (verified via logs, matching the `[Snapshot Cache] SET` pattern already used by `MarketSnapshotService`).
