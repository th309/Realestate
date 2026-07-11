# Market Momentum Map — Standalone US Score Heatmap Widget

**Date:** 2026-07-11
**Status:** Approved design, pre-implementation
**Component name:** `MarketMomentumMap`

## 1. Purpose

A self-contained, drop-anywhere React widget that visualizes PropertyIQ scores for every scored US metro as a population-scaled dot map, with monthly time-series playback across the full score history (Jan 2001 → latest month). It gives forecast/marketing pages a live, premium visual proof point ("this is what the data shows") instead of text-only stats, and supports the "Will Home Prices Crash?" narrative by letting visitors scrub through the 2008 crash, the pandemic frenzy, the Fed hiking cycle, and today's cooldown.

The PIQ score is a demand-momentum signal, not a price forecast. All copy in the widget uses momentum language (RISING / STEADY / EASING), never quality or price-target language, per CLAUDE.md §9.

## 2. Decisions (locked during brainstorming)

| Decision           | Choice                                                                              |
| ------------------ | ----------------------------------------------------------------------------------- |
| Visual form        | Population-scaled dot map (NYT/FT style), NOT polygon choropleth, NOT Mapbox        |
| Time range         | Full history: Jan 2001 → latest scored month (~305 months)                          |
| Gating             | Fully public — no auth, no tier gate, works for anonymous visitors                  |
| Interactivity      | Hover tooltip + click-through to metro market pages                                 |
| Era context labels | Yes — curated timeline annotations (crashes, rate moves) on scrubber + live caption |
| Sizes              | Two: `hero` (≤960px) and `card` (≤480px), both fluid below the cap                  |
| Geography level    | Metro (CBSA) only for v1                                                            |

## 3. Data foundation (verified against live DB, 2026-07-11)

- `propertyiq_scores_v2`: 305 months of metro history (2001-01-31 → 2026-05-31), 935 metros in the latest month, ~926 average since 2023. Columns used: `geography`, `location_id` (CBSA), `location_name`, `score_type='propertyiq'`, `score`, `confidence_level`, `score_date`. READ via the `propertyiq_scores` view.
- `tiger_cbsa`: PostGIS geometry + population for **all 935** scored metros (925 have population; population-less metros get a minimum dot radius). Centroids computed server-side (`ST_PointOnSurface` to stay inside odd shapes).
- 10 scored metros are in Puerto Rico. `d3.geoAlbersUsa` cannot project them; they are excluded from the map and covered by the footnote. No new projection dependency.
- Scores are 1–99 integers → the full matrix (935 × 305) packs small; measured expectation ~200KB gzipped JSON.

## 4. Backend

### 4.1 SQL function `get_metro_score_heatmap()`

One RPC returning the packed payload:

```jsonc
{
  "months": ["2001-01-31", "...", "2026-05-31"], // ordered ascending, ~305
  "metros": [
    {
      "id": "19780", // CBSA code
      "name": "Des Moines-West Des Moines, IA",
      "lat": 41.6,
      "lon": -93.7, // ST_PointOnSurface centroid
      "pop": 737164, // nullable
      "conf": "A", // latest-month confidence_level
    },
  ],
  "scores": [[0, 0, 41, 44, "..."]], // scores[metroIdx][monthIdx], 0 = no data
}
```

- Dense matrix aligned to the global `months` index; missing metro-months are `0`.
- Built with `array_agg` ordered by month; runs in seconds (well under the PostgREST 60s gateway limit). If it ever approaches the limit, fall back to a direct `pg` client per the established pattern.

### 4.2 Endpoint `GET /api/scores/heatmap/metro`

- New `ScoringHeatmapController` + `ScoringHeatmapService` in `packages/backend/src/scoring/`.
- **Route ordering:** registered in `scoring.module.ts` BEFORE `ScoringController` (whose 2-segment catch-all `/:geography/:locationId` must stay last — known hazard documented in `scoring.controller.ts`).
- **Public:** no auth guard, no tier gate. This is marketing-grade data, deliberately ungated (decision §2).
- **Caching:** Redis 24h TTL (scores update monthly) + `Cache-Control: public, max-age=21600, stale-while-revalidate=86400`. Redis absence must not break the endpoint (Redis is optional locally).
- Geography is a path segment (`/metro`) so county/zip variants can be added later without a new route shape; v1 rejects anything but `metro` with 400.

## 5. Frontend data layer

Per the mandatory pattern (CLAUDE.md §5), all fetching goes through `@/lib/data`:

- `lib/data/fetchers/score-heatmap.ts` — `fetchScoreHeatmap(geoLevel)`, validates/types the payload.
- `lib/data/hooks/useScoreHeatmap.ts` — React Query, `staleTime` 24h, no refetch-on-focus. Fetched once per session; the single payload drives all frames (no per-month requests during playback).
- Both exported from `lib/data/index.ts`.

## 6. Widget architecture

```
packages/frontend/app/components/widgets/market-momentum-map/
  MarketMomentumMap.tsx        // exported shell: card chrome, header, size variants, composition
  MomentumMapCanvas.tsx        // SVG basemap + dots + tooltip + hover/click handling
  MomentumMapTimeline.tsx      // playback controls wrapper + era ticks + summary strip
  useMomentumPlayback.ts       // frame state, play/pause/speed, reduced-motion handling
  momentum-map-projection.ts   // geoAlbersUsa setup, centroid projection, radius scale
  momentum-map-colors.ts       // score → color (diverging around 50), bucket labels, legend stops
  market-eras.ts               // curated era annotations (editable content file)
  index.ts                     // single export: MarketMomentumMap
```

Each file stays under the CLAUDE.md size limits (logic ≤300, components ≤400). One exported component per file.

### 6.1 Rendering

- Pure SVG using the already-installed `d3` (`geoAlbersUsa`, `geoPath`, `scaleSqrt`). **No Mapbox, no new dependencies.**
- Basemap: state outlines from the existing static `/geojson/states.json` (browser-cached), rendered as soft neutral fills + subtle borders (theme-aware).
- Dots: one `<circle>` per projectable metro (~925), radius = `scaleSqrt(population)` clamped to [min, max] per size variant; metros sorted by population descending so small dots render on top.
- Playback updates dot fills via direct attribute transitions (~150ms tween), not React re-renders, at ~8 months/sec base speed with the existing speed multiplier UI.
- `prefers-reduced-motion`: no tweening, no autoplay ever; scrubbing snaps.

### 6.2 Color scale

- Diverging scale centered at **50 = STEADY (state average)**, aligned to the canonical score-label buckets (CLAUDE.md §9): reds for VERY WEAK→EASING, neutral at STEADY, greens for FIRMING→VERY STRONG. Brand semantics: green = positive momentum, red = weak.
- `0` (no data) renders as low-opacity neutral grey — visually "off", never mistaken for a low score.
- Exact hues finalized at implementation time using the `dataviz` and `frontend-design` skills, validated in light AND dark themes, using semantic CSS variables (no hardcoded hexes in components; scale stops live in `momentum-map-colors.ts` as the single source).
- No hardcoded breakpoints beyond the canonical label buckets; legend renders from the same stops array.

### 6.3 Era context labels (`market-eras.ts`)

Curated, code-reviewed editorial content — an array of `{ from, to, label, caption }`:

| Period            | Label                                       |
| ----------------- | ------------------------------------------- |
| 2001-03 → 2001-11 | Dot-com recession                           |
| 2004-01 → 2006-06 | Housing boom peak                           |
| 2007-12 → 2009-06 | Global financial crisis — home prices crash |
| 2012-01 → 2012-12 | Market bottom, recovery begins              |
| 2020-03 → 2020-05 | COVID — Fed cuts rates to zero              |
| 2020-06 → 2022-05 | Pandemic housing frenzy                     |
| 2022-03 → 2023-07 | Fastest Fed hiking cycle in 40 years        |
| 2024-01 → present | High-rate cooldown                          |

Surfaced two ways:

1. Tick markers on the scrubber track at era boundaries (hoverable for the label).
2. A caption beside the month readout that updates when the playhead enters an era.

Editing eras never requires touching widget logic.

### 6.4 Chrome & size variants (`size` prop)

**`hero` (default)** — fluid to `max-width: 960px`:

- Header: title ("U.S. Market Momentum"), large Roboto Mono month readout, era caption.
- Map (fixed aspect ≈ 975:610 viewBox).
- Live summary strip: % Firming-or-rising / % Steady / % Easing-or-weak, recomputed per frame from the current month's scores (mirrors the forecast-page stat cards; buckets: ≥60 / 50–59 / <50).
- Gradient legend with momentum labels (WEAK ← EASING ← STEADY → FIRMING → STRONG).
- Playback controls: play/pause, speed (reuse `lib/visualizations/d3/PlaybackControls.tsx` if it fits the M3 chrome; otherwise a thin local wrapper with the same API), scrubber with era ticks.
- Footnote: "{N} metros scored monthly · Map shows contiguous US, AK & HI · Pre-2016 history is momentum-only data" — **{N} is computed from the payload (`metros.length`), never hardcoded** (CLAUDE.md coverage-copy rule); the loading skeleton uses the `COVERAGE_COPY` floor ("900+ metros") until data arrives.

**`card`** — fluid to `max-width: 480px`:

- Condensed header (title + month readout), map, mini legend, play button + scrubber, era caption. No summary strip, no speed control.

Both: M3 card (`rounded-xl`, `shadow-sm`, `bg-surface` semantic vars), Roboto Mono for all numbers, light/dark theme aware.

### 6.5 Interaction & accessibility

- Hover (pointer): tooltip with metro name, current score, momentum label + arrow, and — only when viewing the latest month — the confidence letter. Dots are pointer-only and `aria-hidden` (935 tab stops would be hostile); the keyboard story is the scrubber (←/→/Home/End), month readout, and summary strip. (Decided 2026-07-11.) Historical months omit confidence (not in payload; keeps it ~200KB).
- Click / Enter: navigate (Next `Link`-equivalent behavior) to `/markets/[slug]` (the metro market-page route), slug resolved from the precomputed `CBSA_TO_METRO` map in `@/lib/data`. Metros without a live market page are non-clickable but still hoverable.
- Scrubber keyboard support: ←/→ steps one month, Home/End jump to first/latest.
- ARIA: widget is `role="figure"` with a live-region month announcement while playing is OFF by default (announce only on manual scrub, to avoid screen-reader spam).

## 7. Error & edge handling

- **Loading:** shimmer skeleton in the widget's exact footprint (no layout shift).
- **Fetch failure:** compact error state with retry button; never a blank card.
- **Sparse early history:** early-2000s months have fewer scored metros; no-data dots grey out rather than disappear (dot count is stable; only color changes).
- **Population null (10 metros):** minimum radius.
- **PR metros (10):** excluded (projection), footnoted.
- **Redis down:** endpoint computes from DB directly (slower, still correct).

## 8. Testing (E2E against the real DB — no mocks)

1. **Backend unit:** payload packing (dense alignment, 0-fill), geography param validation.
2. **Backend E2E (real DB):** `GET /api/scores/heatmap/metro` returns ≥900 metros, ≥300 months, matrix dimensions consistent, gzipped size within budget (<400KB), spot-check one known metro's latest score against `propertyiq_scores`.
3. **Frontend unit:** score→color buckets (49 vs 50 vs 60 boundaries), era lookup (boundary months), summary-strip percentages.
4. **Playwright (live data):** render the demo page against the real backend; assert dots painted, scrub changes month readout + at least one dot color, tooltip appears, click navigates; verify both sizes and dark mode.

## 9. Verification & demo placement

- Demo page at `app/dev/widgets/momentum-map/page.tsx` (or the existing embed test-harness if a cleaner fit) rendering both sizes, used for Playwright checks. The user then places `<MarketMomentumMap size="hero" />` wherever desired.
- "Done" = real widget rendering live DB data in a browser, both sizes, light + dark, playback smooth.

## 10. Out of scope (v1)

- County/ZIP geography levels (route shape reserves room).
- Iframe/third-party embed variant (the existing `app/embed` system can wrap this later).
- Historical per-month confidence in the payload.
- Autoplay-on-scroll-into-view (can be added as an `autoPlay` prop later).
- Any score formula/label changes.
