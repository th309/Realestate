# Top 10 / Bottom 10 Ranking Format — Design

**Date:** 2026-04-25
**Branch:** `feat/content-pipeline-p2` (initial work) → likely a follow-on `feat/content-pipeline-p3-ranking` branch
**Status:** Design approved by operator; ready for implementation plan

---

## Goal

Add two new content-pipeline formats — `top_10_ranking` (already partially scaffolded) and `bottom_10_ranking` (new) — that produce data-driven, multi-market ranking videos parameterized by:

- **Direction** (top vs bottom — implied by the format card itself)
- **Metric** (any metric in the existing PropertyIQ registry, dynamic selector — no hardcoded enum)
- **Geo level** (metro / county / zip)
- **Scope** (national / a specific state / a specific metro)

A single run produces a single video that ranks 5–10 markets within the chosen scope by the chosen metric. Resolved markets are frozen at create time; the renderer is a pure function of the run's params.

## Non-goals

- Per-metric magnet variants (single PDF template per direction in v1)
- A/B testing magnet copy
- Drip email sequences after lead capture
- Branded co-marketing magnets
- Live-preview ranking as wizard inputs change (separate preview step instead)
- Per-metric icons or visual variants in the renderer
- Renaming the existing `top_10_ranking` enum value

---

## 1. Format catalog & cards

Two `format_templates` rows, each surfaced as its own card on the wizard's format-step:

| Format key          | Card title                       | Tagline                                                                    | Accent                  |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------- | ----------------------- |
| `top_10_ranking`    | **Top 10 Markets**               | Celebrate the leaders by any metric. National, state, or metro scope. 60s. | Accent green `#00C853`  |
| `bottom_10_ranking` | **Bottom 10 — Markets to Avoid** | Spot the landmines on any metric you care about. 60s.                      | Warning amber `#FF8F00` |

The existing `top_10_ranking` row is reused (not renamed). Its hardcoded "top cashflow markets" wiring is replaced by the new dynamic-metric path. `bottom_10_ranking` is a new sibling row.

---

## 2. Wizard flow

Four-step flow mirroring grade_reveal's shape:

```
Step 1 — format-step          (existing; gets two new cards)
Step 2 — ranking-params-step  (NEW)
Step 3 — ranking-preview-step (NEW)
Step 4 — submit               (existing; calls POST /runs with frozen resolved_markets)
```

### Step 2 — ranking-params-step

```
What metric?
  [MetricSelect ▼]   ← sourced from registry; filtered by metric.supportedGeos for chosen level

What level?
  ( ) Metros  ( ) Counties  ( ) ZIP Codes

Where?
  [ National ] [ State ] [ Metro ]
    contextual picker swaps based on selection:
      • National  → no further input
      • State     → <Select> 50 states + DC
      • Metro     → <MarketSearch> autocomplete (reuse grade_reveal component)

                                       [Back]   [Preview →]
```

**Validity matrix** (drives picker enable/disable; invalid combos are HIDDEN, not disabled-with-tooltip):

| Scope ↓ \ Level → | Metros                       | Counties                                           | ZIPs |
| ----------------- | ---------------------------- | -------------------------------------------------- | ---- |
| National          | ✓                            | ✓                                                  | ✓    |
| State             | ✓                            | ✓                                                  | ✓    |
| Metro             | ✗ (no metros within a metro) | ✗ (most metros have ≤4 counties — too few to rank) | ✓    |

Additional gate: **metric × level coverage** — if metric.supportedGeos doesn't include a level, that level radio collapses out. Same `isMetricSupportedForGeo` helper used elsewhere in the platform.

### Step 3 — ranking-preview-step

```
┌─────────────────────────────────────────────────────────┐
│ Top 10 Counties in California by Cashflow Yield         │
│ As of 2026-04-01                                        │
│                                                         │
│  #1  Lassen County, CA            12.4%                 │
│  #2  Modoc County, CA             11.8%                 │
│  ⋮                                                      │
│  #10 Tehama County, CA             8.6%                 │
│                                                         │
│ ⓘ 12 counties in California had insufficient data for   │
│   Cashflow Yield and were excluded. Final ranking shows │
│   top 10 of 247 eligible.                               │
│                                                         │
│              [← Back]    [Submit Run →]                 │
└─────────────────────────────────────────────────────────┘
```

**Rules:**

- **Insufficient-data exclusion is silent and absolute.** Any region where the chosen metric is NULL, stale (per-metric threshold from registry), or below coverage threshold is dropped from candidates _before_ ranking. The rendered list is reranked 1..N where N ≤ 10. No placeholder rows.
- **Minimum N to allow submit: 5.** If fewer than 5 markets meet the threshold, Submit is disabled and the preview shows a "broaden your scope" message.
- The "X excluded" copy is informational only and never affects the ranked list.

---

## 3. Backend resolve endpoint & run shape

### New endpoint

`POST /api/admin/content-pipeline/ranking/resolve` (AdminGuard). Stateless — does not create a run. Called by the wizard between params-step and preview-step, and again at submit-time as a drift safety check.

**Request:**

```ts
{
  format: 'top_10_ranking' | 'bottom_10_ranking',
  metric_id: string,
  geo_level: 'metro' | 'county' | 'zip',
  scope_type: 'national' | 'state' | 'metro',
  scope_id: string | null,    // state abbr (e.g. "CA") or cbsa_code; null for national
  limit?: number              // default 10; magnet PDF path passes 50
}
```

**Response (200):**

```ts
{
  metric:    { id, label, unit, format },     // pulled from metric registry
  scope:     { type, id, label },             // human label e.g. "California"
  geo_level: string,
  direction: 'top' | 'bottom',                // derived from format key
  as_of:     '2026-04-01',                    // freshest period across the eligible set
  eligible_count: 247,                        // regions that passed the threshold
  excluded_count: 12,                         // regions dropped (NULL/stale/below coverage)
  rankings: [
    { rank: 1, region_id, region_name, state, value: 0.124, value_formatted: '12.4%' },
    ...
  ],
  insufficient_data: false                    // true when rankings.length < 5
}
```

### New service: `RankingResolverService`

Lives in `packages/backend/src/content-pipeline/ranking/`.

```
1. Look up metric in registry (label, unit, format, source table, staleness threshold)
2. Build scope filter:
     national → no filter
     state    → join geography_crosswalk to filter regions within state
     metro    → join geography_crosswalk to filter regions within cbsa
3. Query latest value per region for metric_id within scope (queryLatestPerRegion pattern)
4. Drop rows where value IS NULL or period_date older than metric.staleness_threshold
5. Sort: DESC for top_10_ranking, ASC for bottom_10_ranking
6. Slice top `limit` (default 10)
7. Format each value via format-utils (uses metric.format)
8. Hydrate region_name + state via geography lookup
9. If rankings.length < 5 → insufficient_data: true, rankings: []
10. Return shaped response
```

**Per-metric staleness threshold** comes from the metric registry (e.g. `metric.update_cadence_days`). Census/demographic metrics will have a much longer threshold than Zillow weekly metrics.

### Reuse vs new

| Existing                                   | Reused for?                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `ScopeResolverService` (batch fan-out)     | No — different purpose (fan-out vs ranking-within).                            |
| `MetricResolutionService` (CLAUDE.md §5.1) | Indirectly — for resolving metric source table + per-geo column. Don't bypass. |
| `geography_crosswalk` table                | Yes — scope filtering.                                                         |
| `format/format-utils.ts`                   | Yes — `value_formatted` comes from these.                                      |
| `queryLatestPerRegion` pattern             | Yes — same "latest per region" semantics.                                      |

### Run params shape

Persisted to `runs.params` jsonb on submit. **The entire resolve response goes in here** — not just metric+scope+level inputs:

```ts
{
  format: 'top_10_ranking',                   // or 'bottom_10_ranking'
  direction: 'top',                           // implicit but stored for renderer convenience
  metric:    { id, label, unit, format },
  scope:     { type, id, label },
  geo_level: 'county',
  as_of:     '2026-04-01',
  eligible_count: 247,
  excluded_count: 12,
  resolved_markets: [ ...10 ranked entries... ]   // FROZEN at create time
}
```

**Why freeze the resolved list:**

1. Render is hours later than create — underlying data may have refreshed mid-flight. The video must match what the operator approved.
2. Replayability — re-rendering produces the same video.
3. Audit — what was approved is what was published.

### Submit-time drift check

Before persisting the run, the controller calls `RankingResolverService` server-side once more with the submitted params and verifies the operator-supplied `resolved_markets` matches the freshly-resolved list (same rank order, same region_ids).

If the verify fails → return **409 Conflict** with `{ error: 'data_drift', message: 'Data shifted while you were reviewing — please re-run preview.' }`. Wizard surfaces this as a banner with a "Refresh preview" button.

Adds ~200ms to submit but eliminates the stale-snapshot footgun.

---

## 4. Renderer adaptation

The existing `Top10Layout.tsx` is the starting point. Five focused changes:

### 4a. Single source of truth for input data

Component reads `params.resolved_markets`, `params.metric`, `params.scope` only. **Never queries metric data itself.** Removes the `dataBundle.top_cashflow_markets` dependency. Renderer becomes a pure function of frozen run params.

### 4b. Variable composition duration

```
Intro card        →  3.0s
Row reveals       →  N × 5.0s    (N = 5..10)
Outro / CTA card  →  4.5s
                     ─────────
Total             →  7.5 + 5N seconds   (37.5s @ N=5  →  57.5s @ N=10)
```

Implemented via Remotion's `calculateMetadata` so `durationInFrames` is derived from `inputProps.params.resolved_markets.length`. No padding or stretching. If N=5 the video is 32.5s (975 frames), full stop.

### 4c. Top vs Bottom visual treatment

Same layout component; theme variant per format:

| Element                     | `top_10_ranking`                    | `bottom_10_ranking`                 |
| --------------------------- | ----------------------------------- | ----------------------------------- |
| Intro card subhead          | "Top markets"                       | "Markets to avoid"                  |
| Accent color                | Accent green `#00C853`              | Warning amber `#FF8F00`             |
| Rank number color           | Gold gradient                       | Amber → muted-red gradient          |
| Background gradient overlay | Dark surface + faint green vignette | Dark surface + faint amber vignette |
| Logo card outro             | "Find your next market →"           | "Skip these. Find better →"         |

**Reveal cadence stays #10 → #1 in both directions** — universal countdown rhythm; saves the punchline for last regardless of direction.

### 4d. RankingRow generalization

```
┌─────────────────────────────────┐
│  #07                            │
│                                 │
│  Lassen County                  │   ← region_name
│  California                     │   ← state
│                                 │
│  12.4%                          │   ← value_formatted (already shaped at resolve)
└─────────────────────────────────┘
```

Single `<MetricValue>` sub-component reads `metric.format` and applies font-sizing rules so `$1.2M`, `12.4%`, and `28 days` get equal visual weight without overflow. **No per-metric icons in v1.**

### 4e. Voiceover

Single continuous VO track synthesized via `edge-tts` from the prompt-generated script (Section 5). Script is structured as N+2 lines (intro + N rows + outro). The Remotion sequencer aligns each row's reveal animation to the corresponding VO chunk's start frame.

VO synthesis must handle variable line count (existing path is fixed-10).

### Breaking change

Input prop shape changes from the current Top10Layout reads to the new `params.*` shape. Existing `top-10.test.tsx` snapshots regenerated against the new component as part of the work.

---

## 5. Prompt template & voiceover script

### Files

```
packages/backend/src/content-pipeline/prompts/top_10_ranking.md      (rewrite)
packages/backend/src/content-pipeline/prompts/bottom_10_ranking.md   (new)
```

Each is a Claude prompt parameterized over `{ direction, metric, scope, geo_level, resolved_markets[] }`.

### Output schema (structured JSON)

```ts
{
  hooks: [                           // exactly 2 hook variants — operator picks in review queue
    { id: 'data-led',     intro_vo: '...', subhead_text: '...' },
    { id: 'surprise-led', intro_vo: '...', subhead_text: '...' }
  ],
  rows: [                            // length === resolved_markets.length
    { rank: 10, vo: 'Number ten. Lassen County, California. Twelve point four percent.', emphasis: 'name' },
    ...
    { rank: 1,  vo: '...', emphasis: 'name' }
  ],
  outro_vo:    'PropertyIQ. Now you know.',
  outro_cta:   'Top 10 [metric] report — link below.'
}
```

### Number-formatting in VO

Claude does it inline (not the resolver):

| Format         | Display | Spoken                          |
| -------------- | ------- | ------------------------------- |
| percent        | `12.4%` | "twelve point four percent"     |
| currency       | `$1.2M` | "one point two million dollars" |
| days           | `28`    | "twenty-eight days"             |
| number / score | `87`    | "eighty-seven"                  |

Reasoning: TTS handles plain text well; pushing the speech form into the resolver means writing a number-to-words library and dealing with locale edges. Claude is reliable at this with a 2-shot example in the prompt.

### Brand voice constraints

Drawn from `docs/content-pipeline/propertyiq_explainer_videos.md`:

- Apple keynote — declarative, confident
- 110–120 wpm target → ~25 syllables/row max (5s per row at 5 syll/s)
- No filler ("amazing", "incredible")
- No causal claims ("because of population growth, X is winning") — only what the data says
- Honor the punchline cadence — #1 reveal gets a beat of silence before VO

### Hook variants per direction

| Direction           | Variant A                                                                        | Variant B                                                         |
| ------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `top_10_ranking`    | **Data-led** — "Ten counties in California by cashflow yield. Top to bottom."    | **Surprise-led** — "Two of these you've probably never heard of." |
| `bottom_10_ranking` | **Warning-led** — "These ten markets carry the highest vacancy risk in America." | **Stakes-led** — "Don't put your money in any of these."          |

### Validation rules (Zod, before passing to TTS)

1. `rows.length === resolved_markets.length`
2. Each `rows[i].rank === resolved_markets[i].rank`
3. VO mentions exact `region_name` from resolved_markets (no hallucinated names)
4. Total estimated VO duration (syllable-count × 0.18s sum) within 10% of Section 4's allotted row time
5. No mention of excluded markets — script only sees `resolved_markets`, never `excluded_count`

If any rule fails → retry with feedback. After 2 failed retries → mark run as `script_failed` in state machine; surface to review queue with the failure reason.

---

## 6. DB & migration

One new migration file:

```
supabase/migrations/20260425000XXX_content_pipeline_top_bottom_10.sql
```

### Operations

1. **INSERT into `format_templates`** — new row for `bottom_10_ranking`:
   - `enabled: false` (flipped on via Settings UI when ready)
   - `platforms: ['youtube_shorts', 'tiktok', 'instagram_reels', 'facebook_reels']`
   - `script_prompt_path: 'bottom_10_ranking.md'`
   - `duration_frames: 1800` (kept as max ceiling; actual duration is dynamic per-run)

2. **UPDATE `format_templates`** — refresh `top_10_ranking`:
   - Card title/tagline updated to Section 1
   - Rebind `default_magnet` to new `top_markets_intelligence_report` magnet
   - Deprecate the existing `top_50_cashflow_report` binding

3. **INSERT into `format_magnet_bindings`** — two new rows:

| Format              | Magnet slug                       | CTA in outro                        | Landing-page hook                                     |
| ------------------- | --------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `top_10_ranking`    | `top_markets_intelligence_report` | "Free report — link below."         | "Get the full top 50 list and the data behind it."    |
| `bottom_10_ranking` | `markets_to_avoid_briefing`       | "Avoid the landmines — link below." | "See every high-risk market and what makes it risky." |

4. **GRANTs** — `GRANT ALL ON format_templates, format_magnet_bindings TO service_role, authenticated` (per Supabase memory note).

Migration is idempotent (`INSERT ... ON CONFLICT DO UPDATE`).

### Rollout sequence

| Step                                                    | State                                        |
| ------------------------------------------------------- | -------------------------------------------- |
| 1. Apply migration → `bottom_10_ranking` enabled=false  | Format hidden from wizard                    |
| 2. Ship all code (resolver, renderer, wizard steps)     | Top still shows existing card; Bottom hidden |
| 3. Run dev smoke (Section 8) for both formats           | Confirms full path                           |
| 4. Toggle Settings → `bottom_10_ranking.enabled = true` | New card appears in production wizard        |
| 5. Operator runs first prod publish                     | Real video on YouTube                        |

No new tables, no schema changes beyond seed rows + an update. Backward-compatible.

---

## 7. Magnet PDFs & lead capture

PDFs are **dynamic per-video** — the magnet for _this_ run shows the top 50 by _this_ metric/scope/direction. The video CTA promises specific value tied to what was just shown.

### Architecture

```
Video CTA  →  short URL (propertyiq.app/r/[shortcode])
          →  /reports/[magnet-slug]?run=[run_id]
              shows: "Free Top 50 Cashflow Counties in California — Enter email"
          →  POST /api/magnets/capture { run_id, magnet_slug, email }
              ├─ create lead row, subscribe to Resend audience
              ├─ enqueue PDF render job (pg-boss — same queue as video pipeline)
              └─ Resend transactional email with download link (signed URL, 30-day expiry)

PDF render job:
  ├─ Pull run.params (frozen metric/scope/direction)
  ├─ RankingResolverService.resolve({ ...params, limit: 50 })   ← same service, larger N
  ├─ Render via report-rendering pipeline (likely Puppeteer-on-Next.js)
  └─ Upload to Supabase storage; return signed URL
```

### PDF templates (one per direction, both parameterized)

```
packages/frontend/app/reports/ranking-50/[direction]/page.tsx
```

Page reads URL params → renders printable HTML. Same page is what the PDF service rasterizes.

```
COVER          PropertyIQ logo · "Top 50 {Metric} {Level}s in {Scope}" · As of {date}
INTRO          What it shows · methodology summary · how to read · disclaimer (1 page)
THE LIST       50-row table (rank · region · state · value · 12mo trend arrow) — 3 pages
HIGHLIGHTS     Top 10 with one-line commentary per market — 1 page
METHODOLOGY    Data sources · freshness · scoring formula · confidence — 1 page
CTA            QR to live report URL · "Get monthly updates" — 1 page
```

Same template for top and bottom — direction flips page-1 framing ("Markets to consider" vs "Markets to avoid") and the highlight pages' tone.

### Reuse vs new

| Component                                       | Reuse?                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| Magnet binding table (`format_magnet_bindings`) | ✓ (rows in §6)                                                               |
| Lead capture endpoint pattern                   | ✓ — extend existing `market_snapshot_pdf` flow used by grade_reveal          |
| Resend audience subscription                    | ✓ — same audience IDs                                                        |
| Short URL service                               | ✓ — existing `/r/` short-link infra                                          |
| PDF generation pipeline                         | **Investigate during implementation** — see deferred decisions               |
| `RankingResolverService`                        | ✓ — extended with optional `limit` param (default 10, magnet path passes 50) |

### New work in this section

1. PDF templates (2 directions) — Next.js print-stylesheet pages
2. PDF generation worker job (pg-boss) — renders + uploads
3. Lead-capture landing page (templated by magnet slug; reads `?run=` for context)
4. `POST /api/magnets/capture` endpoint
5. Resend transactional email template ("Your PropertyIQ Top 50 report is ready")
6. Two new Resend audience IDs (or reuse existing PropertyIQ Updates audience)

### Out of scope

- Per-metric magnet variants (one PDF template per direction in v1)
- A/B testing magnet copy
- Drip sequences after capture (single welcome email only)
- Branded co-marketing magnets (agent-customized)

---

## 8. Tests & smoke

### Unit

| Target                        | What to verify                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RankingResolverService`      | Scope filter (national/state/metro), sort direction, per-metric staleness exclusion, `<5` returns `insufficient_data: true`, `limit` param (10 vs 50) |
| Wizard validity-matrix helper | `scope=metro` hides counties + metros; `metric.supportedGeos` collapses level options; metric × level coverage gates                                  |
| `Top10Layout` duration calc   | N=5 → 975 frames (32.5s); N=10 → 1725 frames (57.5s); intro/outro constants                                                                           |
| Script JSON validator (Zod)   | rows.length matches, ranks match, region_names match exact, no excluded markets referenced, syllable budget per row                                   |
| Number-formatter prompt       | 2-shot fixture: `12.4%` → "twelve point four percent", `$1.2M` → "one point two million dollars", `28` (days) → "twenty-eight days"                   |

### Integration (NestJS test harness, real Supabase test branch)

| Test                                      | What it proves                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST /ranking/resolve` × matrix          | 6 combos: {top, bottom} × {national, state-CA, metro-Tampa}. Returns shaped response with rankings. |
| `POST /ranking/resolve` insufficient-data | Pick a deliberately sparse metric × scope → `insufficient_data: true`, `rankings: []`               |
| `POST /runs` submit-time re-resolve       | Submit with stale resolved_markets snapshot → 409 with drift message                                |
| `POST /magnets/capture`                   | Lead row created, PDF job enqueued, Resend mock receives transactional payload                      |

### Render snapshot tests (Remotion)

`top-10.test.tsx` rewritten + new `bottom-10.test.tsx`. Fixtures:

1. `top_10_ranking` × cashflow × CA × counties (N=10, percent format)
2. `top_10_ranking` × PIQ score × national × metros (N=10, score format)
3. `top_10_ranking` × home_value × CA × counties (N=10, currency format) — verify `$1.2M` renders without overflow
4. `bottom_10_ranking` × vacancy_risk × national × counties (N=10, amber theme)
5. Edge case: N=5 (composition shortens correctly)

Frame samples per fixture: `[0, intro_end, row1_start, row5_mid, row10_start, outro_start, last]`.

### E2E Playwright (extends destination-gate validation runner from commit 49af8e0f)

| Flow                     | Assertion                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Wizard happy path top    | format → params (PIQ × metro × CA) → preview shows 10 markets → submit → run lands in queue     |
| Wizard validity matrix   | Scope=metro picker → only "ZIPs" radio enabled                                                  |
| Wizard insufficient-data | Force a sparse pairing → preview shows refusal copy, Submit disabled                            |
| Drift detection          | Click Submit after artificially aging the snapshot → 409 surfaces with re-preview prompt        |
| Magnet capture           | Open landing page with `?run=` → submit email → email received in inbox harness, PDF link valid |

### Live smoke (gate)

Same pattern as grade_reveal's destination-gate validator:

```
1. Run wizard end-to-end in the dedicated dev account
   - top_10_ranking × PIQ × CA × counties → preview → submit
2. Wait for state machine through render → publish
3. Assert YouTube Shorts (dev channel) shows the video
4. Open the magnet capture URL with run_id, submit email
5. Assert PDF arrives, top 50 rows match the resolved set
6. Repeat steps 1–5 with bottom_10_ranking × vacancy_risk × national × counties
```

Both smoke runs must pass before the format flips `enabled: true` in production settings (§6 step 4).

---

## Acceptance criteria

- [ ] `POST /ranking/resolve` returns valid shape for all 6 scope×direction combos in integration test
- [ ] Wizard renders all 4 steps for both formats; preview list matches resolver output
- [ ] Hide-invalid-combos works (no path to submit an invalid scope×level)
- [ ] Insufficient-data refuses submit at <5 markets
- [ ] Submit-time re-resolve catches a forced drift (returns 409)
- [ ] Top10Layout renders both directions with correct theme + variable duration
- [ ] Script validation catches a deliberately wrong region_name
- [ ] Live YouTube smoke for both formats lands on the dev channel
- [ ] Magnet PDF for one live run shows the expected top 50 with matching ranks/values

---

## Deferred decisions (resolved during implementation plan)

1. **PDF rendering tech** — Puppeteer-on-Next.js (renders the `/reports/...` page server-side, screenshots to PDF) vs `@react-pdf/renderer` (lighter, but separate layout primitives). Implementation plan should probe the existing repo for any PDF infra before deciding.
2. **Lead capture endpoint location** — new `MagnetsModule` (own module, customer-facing, different rate-limiting, no AdminGuard) vs extending the content-pipeline controller. Implementation plan resolves after surveying the existing magnet flow for `market_snapshot_pdf`.

---

## Files touched (preview — implementation plan will enumerate fully)

**New:**

- `packages/backend/src/content-pipeline/ranking/ranking-resolver.service.ts`
- `packages/backend/src/content-pipeline/ranking/ranking-resolver.controller.ts`
- `packages/backend/src/content-pipeline/ranking/dto/resolve-ranking.dto.ts`
- `packages/backend/src/content-pipeline/prompts/bottom_10_ranking.md`
- `packages/frontend/app/admin/content-pipeline/new/ranking-params-step.tsx`
- `packages/frontend/app/admin/content-pipeline/new/ranking-preview-step.tsx`
- `packages/frontend/app/reports/ranking-50/[direction]/page.tsx`
- `packages/backend/src/magnets/*` (or extension to existing magnet flow)
- `supabase/migrations/20260425000XXX_content_pipeline_top_bottom_10.sql`
- Test files for each new service/component

**Modified:**

- `packages/backend/src/content-pipeline/video-template/Top10Layout.tsx` (generalized)
- `packages/backend/src/content-pipeline/video-template/PropertyIQVideo.tsx` (route bottom_10_ranking → Top10Layout with theme=bottom)
- `packages/backend/src/content-pipeline/video-template/types.ts` (FORMAT_CONFIGS, VideoPropsSchema)
- `packages/backend/src/content-pipeline/prompts/top_10_ranking.md` (rewrite)
- `packages/frontend/app/admin/content-pipeline/lib/format-previews.ts` (FORMAT_META updates)
- `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts` (new `resolveRanking`, `createRankingRun` helpers)
- `packages/backend/src/content-pipeline/content-runs.service.ts` (submit-time re-resolve check)
- `packages/backend/test/integration/*` (new ranking-resolve and drift tests)
- `packages/backend/src/content-pipeline/video-template/__tests__/top-10.test.tsx` (rewrite for new prop shape)
