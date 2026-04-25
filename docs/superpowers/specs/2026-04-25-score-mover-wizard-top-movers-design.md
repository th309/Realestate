# Score Mover Wizard — Top Movers Picker

**Date:** 2026-04-25
**Status:** Design — pending user review
**Branch (target):** `feat/content-pipeline-p2` (or successor)
**Related specs:**

- `2026-04-25-content-pipeline-batch-wizard-design.md` (existing batch flow we extend)
- `2026-04-25-top-bottom-10-ranking-design.md` (sibling format that uses precomputed leaderboards)

---

## Goal

Replace the manual "type one market name" workflow for the **Score Mover** format with a data-driven leaderboard picker. The operator picks a time window and geography level, sees the top movers (gainers and losers) ranked by score delta, checks the rows worth telling stories about, and submits one Score Mover video per row.

**Success looks like:** an operator can sit down and produce a curated batch of "biggest score movers this quarter" videos in well under a minute, without typing market names, with full confidence that each rendered video matches the window they picked.

## Non-goals

- Not a new format. Score Mover already exists; this is a new way to populate it.
- Not available for other formats yet (Top 10, Grade Reveal, etc.). Extending later is straightforward.
- Not a scheduled/automated runner — this is an operator-driven wizard step.
- Not a new score type. Uses existing `propertyiq_scores` table, `score_type = 'propertyiq'`.
- No data backfills. We use whatever score history exists.

---

## Locked design decisions

These were confirmed during brainstorming and are the input to this spec:

| Decision                            | Value                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Direction                           | Both gainers AND losers, side-by-side; operator picks per row                  |
| Geography level                     | Operator picks per run: Metro / County / ZIP (radio)                           |
| Time windows                        | 1mo / 90d / 6mo / 12mo (single-pick chips, default 90d)                        |
| List size                           | Top 25 each direction, with population floor baked in                          |
| Population floor                    | Metro 50k · County 10k · ZIP 1k (hardcoded constants)                          |
| Integration shape                   | New top-level mode `Top movers` alongside `Single` / `Batch`, score_mover-only |
| Default selection                   | Top 10 each direction pre-checked (20 default)                                 |
| Window propagation                  | Full: data bundle + script prompt + Remotion overlay all reflect chosen window |
| Single-mode also gets window picker | Yes — chip row added to single-market score_mover flow                         |

---

## Architecture overview

```
[Format step]  →  format = score_mover
   ↓
[Market step]  three-way toggle: Single | Batch | Top movers
                              ─────────────────────────
                              "Top movers" only renders when format = score_mover

[Top movers panel]
   ┌─ Window chips: 1mo · 90d · 6mo · 12mo (single-pick, default = 90d)
   ├─ Geo radio:    Metro · County · ZIP    (single-pick, default = Metro)
   ├─ Two columns: Gainers (top 25) | Losers (top 25)
   │     each row: [✓] Market name · current ← prior · signed delta · pop pill
   │     top 10 each side pre-checked on load
   └─ "Next ({n} runs)" → existing Confirm step (batch flow), submits N runs
```

**Backend additions:**

- `GET /api/admin/content-pipeline/movers/resolve?geo=metro&windowDays=90` → dual-list response
- `ContentDataService.fetchScoreMoverContext(geoId, geoLevel, windowDays)` — returns delta computed over chosen window for the orchestration path (data bundle for the Anthropic prompt and the Remotion props)
- `score_mover.md` accepts a new `{{window_label}}` token
- New JSONB column `content_runs.format_options` carries `windowDays`, `priorDate`, `windowLabel` per run

**Data flow at submit:**

1. Operator clicks Submit. Frontend calls `createBatchRuns({ format: 'score_mover', markets: [...checked rows], formatOptions: { windowDays: 30 } })`.
2. Backend snapshots `priorDate` (the actual score date used for the delta) into each run's `format_options` JSONB.
3. Each run is enqueued like any other batch run.
4. Orchestrator calls `fetchScoreMoverContext(market, windowDays)` keyed by the snapshotted date — re-renders are deterministic.
5. Prompt template renders with `window_label` token populated from the canonical map.
6. Remotion `score-mover.tsx` reads `windowCaption` from props, shows "Last 30 days" / "Year over year" caption above the delta number.

---

## UI design

### Top movers panel layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Back                                                                  │
│  Pick a market                                                           │
│                                                                          │
│  ┌─────────┬───────┬─────────────┐                                       │
│  │ Single  │ Batch │ Top movers  │                                       │
│  └─────────┴───────┴─────────────┘                                       │
│                                                                          │
│  Window           [1mo]  [90d●]  [6mo]  [12mo]                           │
│  Geography level  ( ) Metro   (○) County   ( ) ZIP                       │
│                                                                          │
│  Comparing Apr 25 2026 vs Jan 25 2026 · 712 metros qualify               │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                          │
│  ▲ GAINERS (top 25)                  ▼ LOSERS (top 25)                   │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────────┐ │
│  │ ✓  Tampa, FL                    │ │ ✓  Boise City, ID               │ │
│  │      78 ← 66    +12   pop 1.6M  │ │      42 ← 58    -16   pop 320K  │ │
│  │ ✓  Charlotte, NC                │ │ ✓  Las Vegas, NV                │ │
│  │      81 ← 71    +10   pop 1.1M  │ │      48 ← 62    -14   pop 970K  │ │
│  │ ✓  Raleigh, NC                  │ │ ✓  Phoenix, AZ                  │ │
│  │      75 ← 67     +8   pop 580K  │ │      51 ← 64    -13   pop 1.7M  │ │
│  │ ...10 pre-checked, 15 unchecked │ │ ...10 pre-checked, 15 unchecked │ │
│  └─────────────────────────────────┘ └─────────────────────────────────┘ │
│                                                                          │
│  20 selected (10 ▲ · 10 ▼)              [ Next (20 runs) ]               │
└──────────────────────────────────────────────────────────────────────────┘
```

**Per-row content** (compact, three lines max so 25 rows fit on screen without heavy scrolling):

- Line 1: bold canonical name (`Tampa, FL`)
- Line 2: `current ← prior` scores · signed delta · population pill

**Header strip above the columns:**
"Comparing {latestDate} vs {priorDate} · {n} {geo}s qualify" — operator can sanity-check the window resolved as expected and see how many markets passed the population floor.

**Selection counter footer:**
Live count, broken out by direction. Same `Next (N runs)` button used by Batch mode → routes to existing Confirm step unchanged.

### Single-mode window chip row

When `format = score_mover` AND `mode = single`, add a small chip row above the search input:

```
Window  [1mo]  [90d●]  [6mo]  [12mo]
[ search input ]
```

Default 90d. Threads through `formatOptions.windowDays` on `createRun`.

### Wizard mode toggle

`market-step.tsx` mode toggle becomes:

- `Single | Batch` for all formats
- `Single | Batch | Top movers` for `score_mover`

Switching format away from `score_mover` while in `Top movers` mode auto-reverts to `single` and clears any checked rows.

### Empty / sparse states

- `priorDate` missing for the chosen window+geo → block: _"No score history within ~{N} days at {geo} level. Try a longer window."_
- A column has < 10 rows → still pre-check what's there, show _"Only {k} markets qualified."_
- Both columns < 5 rows → muted warning above lists: _"Sparse coverage at this window/geo. Consider widening."_

---

## Backend API

### New endpoint

`GET /api/admin/content-pipeline/movers/resolve`

**Query params:**

- `geo`: `'metro' | 'county' | 'zip'` (required)
- `windowDays`: `30 | 90 | 180 | 365` (required, validated against allow-list)

**Response:**

```ts
{
  data: {
    window: {
      latestDate: '2026-04-25',
      priorDate:  '2026-01-25',
      windowDays: 90,
      requestedGeo: 'metro'
    } | null,                   // null when no prior date found
    qualifiedCount: 712,        // markets passing the pop floor with both scores
    up:   ScoreMoverItem[],     // top 25 by signed delta (descending)
    down: ScoreMoverItem[]      // top 25 by signed delta (most negative first)
  }
}

interface ScoreMoverItem {
  id: string                    // location_id
  canonical_name: string
  geography: 'metro' | 'county' | 'zip'
  current_score: number
  previous_score: number
  delta: number                 // current - previous
  population: number | null
}
```

Auth: `AdminGuard` (matches sibling endpoints in `content-pipeline.controller.ts`).

### `formatOptions` flow

`POST /api/admin/content-pipeline/runs` — DTO gains optional `formatOptions: { windowDays?: 30 | 90 | 180 | 365 }`. Validated only when `format === 'score_mover'`. Default 90 if absent.

`POST /api/admin/content-pipeline/batch-runs` — same field; applied to every run in the batch.

### Snapshot behavior

When a run row is created with `formatOptions.windowDays`, the run-creation service resolves the actual `priorDate` (closest-on-or-before in `propertyiq_scores`) at create-time and saves the resolved tuple into the run's `format_options` JSONB:

```json
{
  "windowDays": 90,
  "priorDate": "2026-01-25",
  "windowLabel": "this quarter"
}
```

Reason: scores refresh on cadence; if a top-movers run sits in the queue and a new score date lands, re-resolving prior at render time would shift the delta and the script no longer matches what the operator approved. Snapshot at create-time → re-renders are deterministic.

---

## Window labels

Single source of truth:

```ts
// packages/backend/src/content-pipeline/data/score-mover-config.ts
export const SCORE_MOVER_WINDOWS = {
  30: { days: 30, label: "this month", caption: "Last 30 days" },
  90: { days: 90, label: "this quarter", caption: "Last 90 days" },
  180: { days: 180, label: "over six months", caption: "Last 6 months" },
  365: { days: 365, label: "year over year", caption: "Year over year" },
} as const;

export const POPULATION_FLOOR = {
  metro: 50_000,
  county: 10_000,
  zip: 1_000,
} as const;
```

The `label` field feeds `{{window_label}}` in the script prompt. The `caption` field feeds the Remotion overlay text. Both come from the same map so the prompt template, the Remotion props, and the data bundle are reading the same string. Zero drift risk.

---

## Prompt template change

`packages/backend/src/content-pipeline/prompts/score_mover.md` gets two surgical edits:

```diff
- Write a {{video_duration_seconds}}-second Score Mover script for {{canonical_name}}.
+ Write a {{video_duration_seconds}}-second Score Mover script for {{canonical_name}}.
+ The score change you are reporting is the move {{window_label}} (e.g. "this month", "year over year"). Reference that window naturally in the hook and body.

- Hook A leads with the delta itself, using the actual number from the data bundle (e.g. "{{canonical_name}}'s PropertyIQ Score jumped [N] points this month.").
+ Hook A leads with the delta itself, using the actual number from the data bundle (e.g. "{{canonical_name}}'s PropertyIQ Score jumped [N] points {{window_label}}.").
```

Hook B (direction-reversal) is window-agnostic and unchanged.

---

## Remotion template change

`packages/video-template/src/scenes/score-mover.tsx` accepts a new prop `windowCaption: string` and renders it as a small label above the delta number (e.g., "Last 6 months · +8 points"). The prop threads through:

- `packages/video-template/src/types.ts` — `ScoreMoverProps` gains `windowCaption: string`
- `packages/video-template/src/PropertyIQVideo.tsx` — passes `windowCaption` to the Score Mover scene
- Render service constructs `windowCaption` from `format_options.windowLabel` → `caption` field of `SCORE_MOVER_WINDOWS`

Existing snapshot tests get extended: each of the four windows produces a new snapshot at the same render frames so the caption rendering is regression-tested.

---

## Data layer

### `fetchTopMovers` (was `fetchTrendingMarkets`)

Refactor `packages/backend/src/content-pipeline/data/content-data-queries.ts:fetchTrendingMarkets` →

- Take `windowDays: 30 | 90 | 180 | 365` parameter (was hardcoded 90).
- Return both directions in one call: `{ window, up, down, qualifiedCount }`.
- Apply population floor via `geographies.population` join. Null population → row dropped.
- Tie-break: secondary sort `population DESC`, tertiary `canonical_name ASC` for deterministic output.

### `fetchScoreMoverContext`

New helper in `data/score-mover-context.queries.ts`:

```ts
async function fetchScoreMoverContext(
  client: SupabaseClient,
  geoId: string,
  geoLevel: ScoringGeo,
  windowDays: 30 | 90 | 180 | 365,
): Promise<{
  current: { score: number; scoreDate: string };
  prior: { score: number; scoreDate: string };
  delta: number;
  windowDays: number;
  windowLabel: string;
  supportingMetrics: SupportingMetric[];
} | null>;
```

Returns `null` if no prior score within the window. The orchestrator surfaces a clear error (run fails with `status_reason = 'no_prior_score_for_window'`) rather than silently rendering a generic video.

The two supporting metrics that drive the script body (currently the existing logic in `ContentDataService`) remain unchanged — they describe the latest state of the market, not the move itself.

---

## Database migration

```sql
-- supabase/migrations/20260425000200_content_runs_format_options.sql
ALTER TABLE content_runs
  ADD COLUMN IF NOT EXISTS format_options JSONB NOT NULL DEFAULT '{}';
```

No GRANT changes — inherits `service_role` and `authenticated` from the existing table. No index — read in lockstep with the run row.

The same migration also applies to any sibling tables that mirror run state (e.g., a future `content_run_snapshots` table). To verify during implementation:

- `content_run_jobs` (if it exists) — does it need to mirror format_options? Likely no, jobs read from parent run.
- `batch_runs` (if it exists) — might want format_options as the batch-level default. Defer until checked.

---

## Edge cases & fail modes

1. **Snapshot the prior date.** As above — deterministic re-renders.
2. **Format switch drops Top movers mode.** If operator goes back to format step and picks anything other than `score_mover`, wizard `mode` auto-reverts to `single` and any checked top-mover rows are cleared. The `Top movers` toggle button only renders for `score_mover`.
3. **Ranking ties.** Two markets with identical delta → secondary sort `population DESC`, tertiary `canonical_name ASC`. Bigger market wins the slot at ties (better video subject).
4. **Null population row.** Treat as fail (drop row). `geographies.population` is filled for every real metro/county/ZIP; null = data quality issue we don't want surfaced as a Score Mover video.
5. **No prior date found at requested window.** Endpoint returns `{ window: null, qualifiedCount: 0, up: [], down: [] }`. UI renders the blocking message, no partial state, no silent degradation.
6. **Sparse one side, full other side.** Render both columns. Pre-check top 10 of the full side + all rows of the sparse side (don't pad). Counter footer reports actual counts.
7. **Batch dialog at 50+.** Top movers tops out at 50 (25+25); the existing 50-mark `BatchSubmitDialog` engages if operator checks them all.
8. **Single-mode score_mover with no prior at chosen window.** Confirm step's submit fails gracefully with toast: _"No score history for {market} within ~{N} days. Pick a longer window or a different market."_
9. **Idempotency.** Existing batch idempotency handles duplicate submissions of the same top-movers list.

---

## Files to create / modify

### New files (10)

```
supabase/migrations/
  20260425000200_content_runs_format_options.sql

packages/backend/src/content-pipeline/
  data/score-mover-config.ts                       # window labels + pop floors
  data/score-mover-context.queries.ts              # fetchScoreMoverContext, fetchTopMovers
  dto/movers-resolve.dto.ts                        # GET query DTO
  dto/format-options.dto.ts                        # nested DTO used by create-run + create-batch-runs

packages/frontend/app/admin/content-pipeline/new/
  market-step-top-movers.tsx                       # the new mode panel
  top-movers-list.tsx                              # two-column ranked list
  window-chip-picker.tsx                           # reusable: 1mo/90d/6mo/12mo chips
  geo-level-radio.tsx                              # reusable: Metro/County/ZIP radio

packages/frontend/app/admin/content-pipeline/lib/
  movers-api.ts                                    # client: useTopMovers query hook
```

### Modified files (15)

```
packages/backend/src/content-pipeline/
  data/content-data-queries.ts                     # generalize fetchTrendingMarkets → fetchTopMovers
  data/content-data.service.ts                     # facade: getTopMovers, extend score-mover context
  content-pipeline.controller.ts                   # GET /movers/resolve with AdminGuard
  dto/create-run.dto.ts                            # optional formatOptions
  dto/create-batch-runs.dto.ts                     # optional formatOptions
  prompts/score_mover.md                           # add {{window_label}} token (two surgical edits)
  format-durations.ts                              # export SCORE_MOVER_WINDOWS map
  orchestration/script-generation.service.ts       # thread formatOptions.windowDays into prompt + data bundle
  orchestration/run-creation.service.ts            # snapshot priorDate at create-time → format_options

packages/video-template/src/
  PropertyIQVideo.tsx                              # accept windowCaption prop, route to score-mover scene
  types.ts                                         # ScoreMoverProps gets windowCaption: string
  scenes/score-mover.tsx                           # render windowCaption above delta number

packages/frontend/app/admin/content-pipeline/new/
  page.tsx                                         # WizardMode = "single" | "batch" | "top_movers"; format-aware reset
  market-step.tsx                                  # add Top movers tab gated on format === 'score_mover'
  confirm-step.tsx                                 # accept + display formatOptions, pass through createRun/createBatchRuns
```

### Test files (8)

```
packages/backend/src/content-pipeline/data/
  score-mover-context.queries.spec.ts              # window resolution, pop floor, tie-break, sparse
  content-data.service.spec.ts                     # extended

packages/backend/src/content-pipeline/
  content-pipeline.controller.spec.ts              # /movers/resolve happy + sparse + invalid params
  prompts/score_mover.prompt.spec.ts               # window_label substitution

packages/video-template/tests/
  score-mover.test.tsx                             # extend snapshot tests with each window caption

packages/frontend/app/admin/content-pipeline/new/
  market-step-top-movers.spec.tsx                  # render, check/uncheck, submit shape
  top-movers-list.spec.tsx
  movers-api.spec.ts
```

---

## Acceptance criteria (gates, not advisory)

Per project memory: all means ALL. No phase advances while any criterion is unproven.

1. Operator picks `score_mover` → `Top movers` → window=6mo → geo=Metro → sees two ranked lists with up to 25 rows each (or sparse-state), top 10 each side pre-checked.
2. Submit with 20 markets creates 20 batch runs in `content_runs`, each with `format_options = { windowDays: 180, priorDate: '<resolved date>', windowLabel: 'over six months' }`.
3. One rendered video viewed end-to-end shows the window caption ("Last 6 months") above the delta and the script narrates "over six months" naturally in the hook.
4. Switching format away from `score_mover` collapses the Top movers tab and clears selection.
5. Single-mode score_mover with the new window chip end-to-end renders with the chosen window.
6. Sparse window (e.g., 1mo + ZIP at current data state) shows the blocking message; no empty render produced.
7. Endpoint `/api/admin/content-pipeline/movers/resolve?geo=metro&windowDays=90` returns deterministic results (same call twice → same ranking, same tie-breaking).
8. All new + extended tests pass. Existing score_mover snapshot tests are regenerated to include the default 90d caption (since the caption is now rendered for every window, including 90d). Each of the four windows has its own snapshot row.
9. Migration `20260425000200` applied and verified on local Supabase.

---

## Risks & mitigations

| Risk                                                            | Mitigation                                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Window-label drift between prompt, props, and data bundle       | Single source `SCORE_MOVER_WINDOWS` map; prompt and Remotion both read `format_options.windowLabel` snapshotted on the run row |
| Score data cadence varies by geo level (1mo + ZIP often empty)  | Sparse-state UI; endpoint returns `null` window cleanly; single-mode submit fails with toast                                   |
| Run sits in queue, score date refreshes, delta shifts on render | `priorDate` snapshotted at create-time; orchestrator reads from `format_options.priorDate`, not "latest prior"                 |
| Operator submits 50 runs and burns budget                       | Pre-check defaults at top 10 each (20 default) not all 50; existing `BatchSubmitDialog` confirmation step at 50                |
| Population data missing on some geographies                     | Null-pop rows dropped from leaderboard; surfaced via `qualifiedCount` so operator sees the filter is working                   |
| Tie ordering non-deterministic across calls                     | Secondary `population DESC`, tertiary `canonical_name ASC`; verified in test                                                   |

---

## Open questions for plan-writing phase

These don't block the design; they get resolved when writing the implementation plan.

1. Does `batch_runs` table (if it exists) need to mirror `format_options` at the batch level, or is per-run sufficient?
2. Should the `Top movers` toggle button be visually disabled (with a tooltip "score_mover format only") for other formats, or fully hidden? (Hidden is simpler; disabled+tooltip is more discoverable. Lean: fully hidden, but we'll see when implementing.)
3. Single-mode window chip default: 90d to match Top movers default, or carry over from the operator's most recent Top movers pick? (Lean: 90d static — predictable beats clever.)

---

## Out of scope for this spec

- Scheduled/cron-driven Top movers runs (would be a separate routine).
- Other formats consuming `format_options` (Top 10 already has its own ranking inputs; Grade Reveal etc. have no time-window framing).
- A second leaderboard ordering (e.g., "biggest movers in cashflow ratio") — different format territory.
- Cross-window comparisons in a single video (e.g., "1mo and YoY both moved up").
