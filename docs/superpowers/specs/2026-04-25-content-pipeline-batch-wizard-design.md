# Content Pipeline Batch Wizard — Design

**Date:** 2026-04-25
**Status:** Design — pending implementation plan
**Branch target:** `feat/content-pipeline-p2`
**Scope tier:** Path A (wizard UX only — no orchestrator or template changes)

## 1. Problem

Today the `/admin/content-pipeline/new` wizard creates exactly one run for one market. Operators producing per-zip or per-metro spotlight content (e.g. `grade_reveal` for every zip in a metro, `farm_area_spotlight` for every metro in a state) have to click through the entire wizard once per market — dozens or hundreds of times. The wizard's UX assumes a one-off but the operator's intent is "fan this format out across a list of markets I can describe with a rule."

We need the wizard to support both modes — keep the existing one-off flow intact, add an explicit batch mode that resolves a scope (e.g. "all zips in 12420") to a list of markets and creates one run per checked market.

## 2. Scope

**In scope:**

- Wizard UX changes only — no changes to orchestrator, fetch-data handler, render handler, or templates.
- Single-market formats: `grade_reveal`, `farm_area_spotlight`, `long_form_deep_dive`. These work end-to-end today; batching them is purely a UX win.
- Backend additions: scope resolution endpoint, batch run creation endpoint, `batch_id` column on `content_runs`.
- Submit fan-out: one Submit creates N independent `content_runs` rows, each enqueued as a normal pg-boss job. The orchestrator never knows it's part of a batch.

**Out of scope:**

- Multi-market formats (`top_10_ranking`, `score_mover`, `head_to_head`). FetchDataHandler is single-geo; these formats need data layer work first (deferred to Path B).
- Per-platform-per-format opt-in within a batch.
- Batch cancel / pause / retry as bulk operations.
- A dedicated batch-detail page (just a query-param filter on the runs list).
- Saving and re-using named scopes.
- Per-row platform or approval-mode overrides within a batch.
- Top-N or score-based scope selectors.

## 3. Decisions and Why

| #   | Decision                                                                                                                          | Why                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Path A (wizard UX only)                                                                                                           | Single-market formats already work end-to-end; multi-market data layer work is independent and can land later without wizard rework.                                                       |
| 2   | Hybrid model: scope picker → checklist of resolved markets → one run per checked market                                           | Operator can prune the auto-resolved list before submit, but doesn't have to build it from scratch. Combines the speed of a rule-based picker with the safety of an explicit confirmation. |
| 3   | Apply to single-market formats only (`grade_reveal`, `farm_area_spotlight`, `long_form_deep_dive`)                                | These can be batched safely — each run resolves to one geo, FetchDataHandler is happy. Multi-market formats produce broken videos until Path B lands.                                      |
| 4   | Five scope types: `metros_in_state`, `zips_in_state`, `zips_in_metro`, `single`, `custom`                                         | Covers operator-stated examples ("metros in x state", "zipcodes", "all zips in x metro") plus the long-tail escape hatch (custom paste). Top-N and saved scopes deferred.                  |
| 5   | Tiered batch caps: 1–49 just submits, 50–249 confirm dialog, 250–500 confirm + explicit ack checkbox, >500 blocked at Market step | Catches fat-finger mistakes without nagging on small batches. Extra ack at 250+ acknowledges real cost magnitude. Hard cap at 500 reflects pg-boss queue depth realities.                  |
| 6   | All settings batch-level (one approval_mode + one platform list per batch)                                                        | Per-row controls would dominate visual weight of the checklist and turn it into a spreadsheet. Operators wanting per-market settings split into multiple batches.                          |
| 7   | Batch toggle inside Market step (Approach 3), not a separate step or tab system                                                   | Preserves dominant single-market case unchanged. Batch is opt-in, visually distinct, never tripped into accidentally.                                                                      |

## 4. UX Design

### 4.1 Wizard step structure

Stays at 4 steps: `Format → Market → Style/Voice → Confirm`. All changes live inside the Market and Confirm steps.

### 4.2 Market step

**Top:** M3 segmented button — `Single market` (default) | `Batch`. Switching modes fully swaps the body below; selections in inactive mode are discarded.

**Single mode body:** unchanged from today (autocomplete + geo chips + recent markets).

**Batch mode body** — three rows revealed progressively:

1. **Scope picker** — dropdown with 4 options:
   - All metros in state
   - All zips in state
   - All zips in metro
   - Custom list

2. **Scope input** — depends on type:
   - _State picker_ — searchable typeahead over 50+DC, sourced from `geography_crosswalk` distinct states.
   - _Metro picker_ — autocomplete over CBSAs (reuses today's single-market metro search).
   - _Custom textarea_ — multiline; placeholder `Paste comma- or newline-separated zip codes or CBSA codes. Mix is OK.` Live parse on each change shows `12 valid · 2 unrecognized` caption + chip row of unrecognized values with remove-x.

3. **Resolved markets checklist** — virtualized list (see 4.3).

**Step gating:**

- Single mode: Next enabled when one market is selected (today's rule).
- Batch mode: Next enabled when the resolved checklist has ≥1 checked row AND total checked ≤ 250 (or ≤500 with explicit ack — Section 4.5).

### 4.3 Resolved markets checklist

**Layout:**

- Sticky header: `[✓] Select all` (tri-state) · `42 of 312 selected` (live count) · search input · sort dropdown (Name A→Z default; Population high→low; Score high→low).
- Body: virtualized rows ~44px (M3 list-item) — checkbox, market name, geo type badge + secondary metric (`METRO · pop 2.3M` or `ZIP · score 78`).
- Footer: `Showing 312 of 312` or `Showing 50 of 312 (filtered)`.

**Defaults on resolve:** all rows checked (operator's intent in picking scope is "I want all of these"; checklist's job is to PRUNE not pick from scratch).

**Interactions:**

- Full-row click toggles checkbox.
- `Select all` respects active search filter.
- Keyboard: `Space` toggles focused row; `Cmd/Ctrl+A` triggers Select all when checklist is focused; `↑↓` moves focus.

**Display caps:**

- Up to 500 rows: render fully, virtualized.
- 500–2,500: render fully + banner: `Large scope — 2,743 markets. Tip: use search to narrow before bulk-unchecking.`
- No cap on display; the cap on submit is the 250/500 ack flow.

**Edge states:**

- Search zero matches: `No markets match "atlanta" in this scope.`
- All unchecked: Next disabled, helper text `Check at least one market to continue.`

**Loading:** skeleton (3 stub rows + count placeholder). For >500 markets, subtle progress chip `Resolving 2,743 markets…`.

**Errors:**

- Resolve failed: inline `Couldn't resolve scope. Retry.` button.
- Custom list zero valid: `No valid codes found. Check the format.`

### 4.4 Style/Voice step

Unchanged from today.

### 4.5 Confirm step

**Single mode:** unchanged.

**Batch mode additions:**

- **Header banner** — replaces single market name with: `Batch: 42 markets · grade_reveal` and `← change scope` link back to Market step (preserves checklist state).
- **Markets summary** — collapsed list showing first 5 selected names + `…and 37 more (expand)`. Expanding shows full list (read-only).
- **Approval mode + Platform chips** — same controls, relabeled: `Approval mode for all 42 runs:` and `Publish all 42 runs to:`.
- **Cost/time estimate** — monospace caption: `≈ $4.20 · 42 renders · ~14 min queue`. Math:
  - Cost = `count × per-format render cost` (`format_templates.estimated_cost_usd` if column exists, else hardcoded $0.10 placeholder).
  - Renders = `count` (one render per run).
  - Queue time = `count × ~20s render` ÷ pg-boss concurrency, rounded to nearest minute.
- **Submit button label by batch size:**
  - 1: `Submit run`
  - 2–49: `Submit 42 runs`
  - 50–249: `Review batch (42 runs)` → opens M3Dialog with summary + cost + Cancel/Submit
  - 250–500: same dialog + checkbox `[ ] I understand this will create 312 runs and cost ≈ $31.20.` Submit disabled until checked.
  - > 500: blocked at Market step (Next disabled, helper `Batch cap is 500. Use a narrower scope or pick fewer markets.`).

**Submit flow:**

1. POST `/api/admin/content-pipeline/runs/batch` with `{format, marketIds, approvalMode, platforms}`.
2. Backend creates N rows in `content_runs` with shared `batch_id`, enqueues N pg-boss jobs, returns `{batchId, runIds, created, failed, errors}`.
3. Frontend redirects to `/admin/content-pipeline?batch=<batchId>` — runs list filtered, banner: `Batch of 42 runs queued.`
4. Partial success: toast `38 runs queued · 4 failed (see banner).`, redirect still happens.
5. Network failure: standard retry; backend dedup on `(format, market_id, created_within_5min)` prevents double-creation.

## 5. Backend Design

### 5.1 New endpoint: `GET /api/admin/content-pipeline/scope/resolve`

**Files:**

- `packages/backend/src/content-pipeline/scope/scope.controller.ts` (~80 lines)
- `packages/backend/src/content-pipeline/scope/scope.service.ts` (~150 lines)

**DTO** (discriminated union via `class-validator`):

```typescript
type ResolveScopeDto =
  | { type: "metros_in_state"; state: string }
  | { type: "zips_in_state"; state: string }
  | { type: "zips_in_metro"; cbsaCode: string }
  | { type: "custom"; codes: string[] }; // max 1000
```

**Response:**

```typescript
{
  markets: Array<{
    id: string;                 // cbsa_code or postal_code
    geography: 'metro' | 'zip';
    canonical_name: string;
    population?: number;
    score?: number;
  }>;
  truncated: boolean;           // true if >2500
  unrecognized?: string[];      // for custom type
}
```

**Implementation:** one query per type against `geography_crosswalk` left-joined to `propertyiq_scores` and metadata tables (`cbsa_metadata`, `zip_metadata` if present, else null on population). AdminGuard required.

**Caching:** v1 uses React Query 30-min staleTime on frontend. If backend latency observed >500ms for large scopes, add Redis cache keyed by `(type, state|cbsa|sortedCodes)` with 1h TTL.

### 5.2 New endpoint: `POST /api/admin/content-pipeline/runs/batch`

**File:** `packages/backend/src/content-pipeline/runs/batch-runs.controller.ts` (~60 lines)

**DTO:**

```typescript
{
  format: string;
  markets: Array<{ id: string; geography: 'metro' | 'zip' }>; // max 500
  approvalMode: 'auto' | 'review' | 'draft';
  platforms: string[];
}
```

**Response:**

```typescript
{
  batchId: string;              // UUID
  created: number;
  failed: number;
  runIds: string[];
  errors?: Array<{ marketId: string; message: string }>;
}
```

**Implementation:** generates `batchId = uuid()`, loops `markets`, calls existing `RunsService.createRun()` with the batchId, collects results. No transaction wrapping — partial success is allowed. Validation pipe enforces `markets.length <= 500`.

**Why a separate controller instead of extending single-run POST:** existing `POST /runs` returns a single run object. Changing its response shape breaks `useCreateRun` hook and post-submit navigation. Dedicated endpoint keeps single-run contract pristine and labels batch as a clearly-separate code path.

### 5.3 Schema migration

**File:** `supabase/migrations/20260425000400_content_runs_batch_id.sql`

```sql
ALTER TABLE content_runs ADD COLUMN IF NOT EXISTS batch_id UUID;
CREATE INDEX IF NOT EXISTS idx_content_runs_batch_id
  ON content_runs(batch_id) WHERE batch_id IS NOT NULL;

GRANT ALL ON content_runs TO service_role;
GRANT ALL ON content_runs TO authenticated;
```

Partial index: most runs are single, not batched. Apply via existing `scripts/apply-content-pipeline-migrations.js` — add file to `MIGRATIONS` array.

### 5.4 Existing files modified

| File                                  | Change                                                 | Estimated lines added |
| ------------------------------------- | ------------------------------------------------------ | --------------------- |
| `content-pipeline.module.ts`          | Register two new controllers + scope service           | +6                    |
| `content-pipeline-queries.service.ts` | Add `getBatchRuns(batchId)` for redirect-target filter | +10                   |
| `runs/runs.controller.ts`             | Accept optional `?batchId=` query param                | +5                    |

### 5.5 Orchestrator: zero changes

Each batched run flows through fetch-data → script → render → publish exactly like a single-market run. The orchestrator never knows or cares it's part of a batch.

## 6. Frontend Component Breakdown

All targets respect 200/300 logic-file and 300/400 component-file limits.

### 6.1 New components

Path: `packages/frontend/app/admin/content-pipeline/new/`

| File                        | Purpose                                                                      | Estimated lines |
| --------------------------- | ---------------------------------------------------------------------------- | --------------- |
| `market-step-batch.tsx`     | Batch mode body — owns scope state, renders picker + input + checklist       | ~180            |
| `scope-input.tsx`           | Discriminated input renderer (state picker / metro picker / custom textarea) | ~140            |
| `resolved-markets-list.tsx` | Virtualized checklist with sticky header, search, sort, select-all           | ~220            |
| `batch-confirm-banner.tsx`  | Confirm-step banner with format + count + collapsible markets list           | ~80             |
| `batch-submit-dialog.tsx`   | M3Dialog wrapper for 50+ confirm and 250+ ack flow                           | ~120            |
| `single-market-summary.tsx` | Extracted from current `confirm-step.tsx` to keep it under 300 lines         | ~60             |

### 6.2 Modified components

| File                                                                            | Change                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `market-step.tsx` (existing ~150 lines)                                         | Add mode toggle at top; conditionally render single body or `<MarketStepBatch />`. +40 lines, well under cap.                                                                                                                                             |
| `confirm-step.tsx` (existing ~280 lines, near cap)                              | Branch on `mode === 'batch'`; render `<BatchConfirmBanner />` instead of single summary; swap Submit button label; open `<BatchSubmitDialog />` for ≥50. Extract single-market summary (see above) at same time. Net change ≈ +10 lines, stays under cap. |
| `wizard-state.ts` (or wherever wizard state lives — confirm during exploration) | Add fields: `mode: 'single' \| 'batch'`, `batchScope?`, `resolvedMarkets?`, `checkedMarketIds: Set<string>`.                                                                                                                                              |
| `page.tsx` (wizard shell)                                                       | Pass `mode` to confirm step and submit handler; branch handler on `createRun` (today) vs `createBatchRuns` (new).                                                                                                                                         |
| `format-step.tsx`                                                               | No change — existing `enabled` filter from earlier work already gates which formats appear; batch mode honors the same filter.                                                                                                                            |
| Runs-list page (main pipeline page)                                             | Read `?batch=<id>` from URL, filter `runs` array client-side, render banner if filter active. ~15 lines.                                                                                                                                                  |

### 6.3 New API client functions

Path: `packages/frontend/app/admin/content-pipeline/lib/`

| File                                 | Purpose                                                           | Estimated lines |
| ------------------------------------ | ----------------------------------------------------------------- | --------------- |
| `scope-api.ts`                       | `resolveScope(dto)` fetcher + `useResolvedScope(scope)` hook      | ~60             |
| `content-pipeline-api.ts` (existing) | Add `createBatchRuns(dto)` mutation + `useCreateBatchRuns()` hook | +30             |

### 6.4 React Query hooks

- `useResolvedScope(scope)` — keyed on `JSON.stringify(scope)`, 30-min staleTime, enabled only when scope is fully specified.
- `useCreateBatchRuns()` — invalidates runs list query on success, navigates to `/admin/content-pipeline?batch=<id>`.

## 7. Acceptance Criteria

A reviewer verifies the design is implemented correctly when:

1. **Single mode unchanged:** picking a single market via autocomplete and submitting still creates exactly one run, identical to today's flow. No regression in visual layout, step count, or API contract.
2. **Batch toggle works:** switching to Batch mode swaps the Market step body; switching back discards batch state.
3. **All four scope types resolve:** for each scope type, picking the input produces a checklist of expected markets within ~1s for typical inputs. Resolved counts match `geography_crosswalk` ground truth.
4. **Custom list parsing:** mixed comma/newline/whitespace input dedupes, drops empties, separates valid from unrecognized; unrecognized chips can be removed.
5. **Checklist defaults all-checked, prune works:** unchecking individual rows or using filtered `Select all` updates the live count accurately.
6. **Submit fan-out:** submitting a batch of N markets creates N rows in `content_runs` sharing one `batch_id`, each with the chosen approval mode and platforms; redirect to `/admin/content-pipeline?batch=<id>` filters the runs list correctly.
7. **Tiered confirms:** 1–49 submits without dialog; 50–249 opens confirm dialog; 250–500 dialog requires ack checkbox; >500 blocked at Market step with helper text.
8. **Cost/time estimate:** matches `count × per-format cost` and `count × 20s ÷ concurrency` math; updates live as checkboxes change.
9. **Partial-success handling:** if backend reports `failed > 0`, toast surfaces count and the redirect-target banner lists failed market names.
10. **No orchestrator changes:** existing single-market runs created via the (unchanged) Single mode complete end-to-end identically to before.

## 8. Open Questions

None blocking implementation.

Two non-blocking refinements deferred to v2 if operator feedback warrants:

- Saved scopes (name and reuse a frequently-used selection).
- Top-N selectors (e.g. "top 10 metros nationwide by PropertyIQ score").

## 9. References

- Existing wizard: `packages/frontend/app/admin/content-pipeline/new/`
- Existing single-run controller: `packages/backend/src/content-pipeline/runs/runs.controller.ts`
- Geography crosswalk: `geography_crosswalk` table (state ↔ cbsa ↔ county ↔ zip)
- pg-boss queue: backend `pgboss` schema; current concurrency = 1 render at a time
- Memory: `project_content-pipeline-p2.md` for current P2 status
