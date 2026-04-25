# Content Pipeline — Head-to-Head Wizard Design

**Status:** Approved 2026-04-25
**Owner:** th309
**Format:** `head_to_head` (existing format key, already wired in renderer + prompt + DB enum)

## Background

The `head_to_head` format is implemented end-to-end in the renderer and prompt:

- `packages/video-template/src/layouts/HeadToHeadLayout.tsx` accepts `bundle.markets[]` or `bundle.primary` + `bundle.secondary`.
- `packages/backend/src/content-pipeline/prompts/head_to_head.md` instructs Claude to compare "the two markets present in the data bundle."
- `head_to_head` exists in the format enum, `format-durations.ts`, and the format-template seed migration.

But the path that _creates_ a run only handles one market:

- `MarketStep` in the new-run wizard accepts a single market.
- `CreateRunDto.marketQuery` is one string.
- `fetch-data.handler.ts` calls `getMarketSnapshot` once and stores one snapshot.

Picking `head_to_head` in the wizard today produces a video comparing Market A to nothing.

## Goal

Make `head_to_head` runnable end-to-end from the admin UI, with a wizard that helps the operator pick a _good_ opponent — not just any second market — using the data we already have. A "good" opponent is one whose comparison reveals something interesting (biggest gap on a chosen metric) or is a defensible apples-to-apples peer (same state, similar size).

Single-run only in v1; batch is deferred.

## Non-goals (v1)

- Batch mode for `head_to_head`. The format is editorially sensitive (the comparison has to land); bulk-generating with a rule risks shipping forced contrasts. Will revisit after watching the format perform.
- Migration-narrative intent. Requires Census county-to-county flow ingestion that doesn't exist.
- Strategy-contrast intent (cashflow market vs appreciation market). Requires a market-type classifier that doesn't exist.
- Cashflow contrast metric. The `cashflow` metric is exposed by `top-cashflow-markets` queries but not as a per-market value in the metric registry; adding it as a contrast-sort axis would require new backend work.

## UX

### Wizard structure

`packages/frontend/app/admin/content-pipeline/new/page.tsx` becomes a 4-step state machine **only when** `format === 'head_to_head'`:

```
Format ▸ Primary market ▸ Opponent ▸ Confirm
```

Other formats remain 3 steps. The transition is driven by the `format` value carried in `NewRunPage` state — the existing `step` union expands to `'format' | 'market' | 'opponent' | 'confirm'`, with `'opponent'` skipped when format isn't head-to-head.

### Single/Batch toggle

When `format === 'head_to_head'`, `MarketStep` hides its Single/Batch ModeToggle and forces single mode. (The toggle remains visible and functional for every other format.)

### New file: `opponent-step.tsx`

Sized like `format-step.tsx` (~200 LOC max). Receives the resolved primary market and emits the chosen opponent's `marketQuery` (canonical name).

Layout:

- Back button (returns to market step) and header `Pick the opponent for {primaryMarketName}`.
- **Intent chips** (radio): `Biggest contrast` (default) / `Similar peer` / `Search`.
- **Sub-controls per intent:**
  - `Biggest contrast`: secondary metric chip (`PIQ Score` default / `YoY Appreciation` / `Affordability`) and geo toggle (`National` default / `In-state only`).
  - `Similar peer`: no sub-controls (rule is fixed: same state AND ±25% population).
  - `Search`: reuses the `SingleMarketBody` text input from `market-step.tsx` (extracted to a small shared component, e.g. `market-search-input.tsx`).
- **Suggestion list** (Contrast or Similar): 5 cards from the new `/api/content-pipeline/opponents` endpoint. Each card shows market name and the contrast value (e.g. `Cleveland, OH · −23` for PIQ score gap). Click ✓ to pick. Selected card gets primary fill (`bg-primary text-on-primary`).
- Next button: enabled only when an opponent is picked. On click, sets opponent state and advances to `confirm`.

### Confirm step

`confirm-step.tsx` shows a second market line beneath the primary when `format === 'head_to_head'`. `SingleMarketSummary` extends to take an optional `opponentMarket` prop and renders it as a second market chip.

### Display polish (deferred but noted)

The run detail page (`packages/frontend/app/admin/content-pipeline/runs/[id]/page.tsx`) currently doesn't render two-market metadata. Out of scope for v1; the run will still produce and publish correctly, the detail page will just show the primary market name only. Tracked as a v2 polish item.

## Backend

### DTO

`packages/backend/src/content-pipeline/dto/create-run.dto.ts`:

```ts
@IsOptional()
@IsString()
@MinLength(2)
@ValidateIf((o) => o.format === 'head_to_head')
opponentMarketQuery?: string;
```

`@ValidateIf` makes the field required _only_ when format is head-to-head. Other formats ignore it.

The discriminated-union alternative (split DTO by format) is cleaner long-term but touches every controller and handler that consumes `CreateRunDto`. Deferred until a second multi-market format ships.

### Migration

`supabase/migrations/<timestamp>_content_pipeline_head_to_head_run_columns.sql`:

```sql
ALTER TABLE content_runs
  ADD COLUMN opponent_market_query TEXT NULL,
  ADD COLUMN resolved_opponent_geo JSONB NULL;
```

Both nullable. No backfill needed.

### Suggestion endpoint

**Route:** `GET /api/content-pipeline/opponents`

**Query params:**

| Param              | Type                                                           | Required                     | Notes                                                                              |
| ------------------ | -------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| `primaryGeoId`     | string                                                         | yes                          | e.g. CBSA code, county FIPS, ZIP                                                   |
| `primaryGeography` | `'metro' \| 'county' \| 'zip' \| 'state'`                      | yes                          | matches `geography_crosswalk` shape                                                |
| `intent`           | `'contrast' \| 'similar'`                                      | yes                          |                                                                                    |
| `metric`           | `'piq_score' \| 'home_value_yoy' \| 'homeowner_affordability'` | for `contrast` only          | `similar` ignores this and always uses `piq_score` for the displayed `value`/`gap` |
| `geoFilter`        | `'national' \| 'state'`                                        | optional, default `national` | applies to `contrast`                                                              |
| `limit`            | int                                                            | optional, default 5, max 20  |                                                                                    |

**Response:**

```ts
{
  primary: { id, geography, canonicalName, value },
  candidates: Array<{
    id: string;
    geography: string;
    canonicalName: string;
    value: number;        // the metric value for this candidate
    gap: number;          // value - primary.value (signed)
    population: number | null;
  }>
}
```

**Service:** new `OpponentSuggestionService` in `packages/backend/src/content-pipeline/opponents/`.

**Contrast ranking:**

1. Look up the primary's value for the chosen metric in `propertyiq_scores` (for `piq_score`) or the appropriate `zillow_*` / metric source (for `home_value_yoy`, `homeowner_affordability`). If not found, return empty candidates with `primary.value: null`.
2. Query the same source for all geos at the same geography level. If `geoFilter === 'state'`, join `geography_crosswalk` and filter to the primary's state.
3. Exclude the primary itself.
4. Order by `ABS(value - primary.value) DESC`, limit to 5.
5. Compute signed `gap = value - primary.value` per row before returning.

This sorts by absolute distance (so picks both extremes) but the UI surface naturally highlights the _opposite-direction_ extreme via the gap sign — drama wins by design.

**Similar-peer ranking:**

1. Look up the primary's `cbsa_population` (or county/zip population) and `state_abbrev` from `geography_crosswalk`.
2. Query `geography_crosswalk` for geos at the same level where:
   - `state_abbrev === primary.state_abbrev`
   - `population BETWEEN primary.population × 0.75 AND primary.population × 1.25`
   - Geo ID ≠ primary
3. Order by `ABS(population - primary.population) ASC`, limit 5.
4. Attach the PIQ score for each row (always, for similar intent) so the UI can display `value` and `gap`. The `metric` query param is ignored when `intent === 'similar'`.

If fewer than the limit return (small state, narrow band), return what we have — empty list is allowed. UI handles the empty case by showing "no similar peers — try Biggest contrast or Search."

### Fetch handler

`packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.ts`:

- Read `opponent_market_query` from the `content_runs` row (already pulled in the existing `select`).
- If non-null:
  - Call `data.resolveMarket(opponent_market_query)` and snapshot the first match.
  - Persist `resolved_opponent_geo` on the run row alongside `resolved_geo`.
  - Build the `mcp_payload` `metadata` as `{ primary: snapshotA, secondary: snapshotB }` instead of `snapshotA` alone.
- If null: existing behavior unchanged.

The Remotion `HeadToHeadLayout` already accepts the `{ primary, secondary }` shape (`HeadToHeadLayout.tsx:14-18`), so no renderer change.

The prompt template `prompts/head_to_head.md` already references "the two markets present in the data bundle," so no prompt change.

## Testing

**Unit:**

- `OpponentSuggestionService.rankContrast` — mock `propertyiq_scores` rows, assert correct ordering by absolute gap.
- `OpponentSuggestionService.rankSimilar` — mock `geography_crosswalk`, assert state + ±25% filter.
- `fetch-data.handler` — `head_to_head` with non-null opponent persists `{primary, secondary}` payload; non-head-to-head unchanged.
- DTO validation — `head_to_head` rejects empty `opponentMarketQuery`; other formats accept it absent.

**E2E (Playwright):** walks the 4-step flow (`head_to_head` → primary "Tampa, FL" → opponent intent=contrast metric=piq_score, pick Cleveland → submit) and waits until the run reaches a successful state with a rendered video. Asserts the `content_assets` row of kind `mcp_payload` contains both `primary` and `secondary`. Per `feedback_e2e-validation-real-output`, "done" means a real rendered video on disk, not just DB rows.

## Estimated work

Order of approximate cost:

1. `OpponentSuggestionService` + endpoint — moderate (new service, two SQL paths, tests). ~1 day.
2. `opponent-step.tsx` + intent chips + suggestion fetch — moderate. ~1 day.
3. DTO + migration + fetch-handler change — small. ~3 hours.
4. `confirm-step.tsx` two-market display — small. ~1 hour.
5. E2E test + verification run on staging — ~3 hours.

Total: ~3 days focused work. No new infra, no new data ingestion, no renderer or prompt changes.

## Open items

None blocking. The display polish on the run detail page is acknowledged as a v2 follow-up.
