# Analyzer — Full Deal Persistence & Resumable Editing Spec

**Date:** 2026-08-08
**Status:** Draft for review
**Area:** `/analyzer`, `deal_analyses`

---

## 1. Summary

Saving a deal today persists a render-shaped summary, and opening a saved deal renders a
read-only report. This spec makes a saved deal a **resumable working document**: everything the
user tuned is persisted, and opening one lands them back in the live analyzer, fully editable.

Three changes carry it:

1. `input_snapshot` becomes a **versioned deal state** (`DealStateV2`) holding every user-authored
   value, not just the analyzer-core input.
2. `/analyzer/saved/[id]` renders the **hydrated analyzer** instead of a read-only report.
3. An explicit **Save** button joins Share and PDF; after the first save, edits **autosave**.

Market data is restored as saved, never silently refreshed. A notice offers a refresh once the
data is older than 60 days.

---

## 2. Goals & Non-Goals

### Goals

- Persist the complete editable state of a deal — nothing the user tuned is lost.
- Reopening a saved deal is indistinguishable from the state they left it in.
- An explicit, visible Save affordance that reports its own status.
- Autosave after the first deliberate save, so work is never lost.
- Tell the user when restored market data is old enough to be worth refreshing.
- Existing saved deals keep working and recover as much state as is recoverable.

### Non-Goals

- **Scenario/versioning.** Saves overwrite in place. One row per saved deal.
- **Live market refresh on open.** Restore is faithful; refresh is user-initiated.
- **Changing the public share/PDF artifact.** `result_snapshot` keeps its current shape and
  lifetime.
- **Auto-refetching RentCast.** It is paid and quota-limited; the existing "Fetch property"
  button stays the only trigger.
- **Diffing saved vs live market values.** Considered and dropped in favour of an age-based
  notice (see §4.5).

---

## 3. Current Behavior

### 3.1 What is saved

`buildAnalyzerSnapshot()` (`app/(app)/analyzer/lib/build-analyzer-snapshot.ts`) writes:

- `input_snapshot` — `state.analyzer.input` only (the analyzer-core `DealInput`).
- `result_snapshot` — a rich, render-shaped blob (`RichResultSnapshot`) that incidentally carries
  `assumptions`, `arvLocal`, `rehabBudget`, `propertyType`, `unitCount`, `grading`, `comps`,
  `aiNarratives`, `notes`.
- `market_context`, `ai_verdict` — as captured at save time.

Never persisted anywhere: `selectedZip`, `provenance`, `rentcastData`, `selectedGoal`,
`analysisMode`, custom thresholds. `label` is hardcoded `null`
(`build-analyzer-snapshot.ts:112`).

### 3.2 How saves are triggered

There is **no Save button.** `saveSnapshot()` runs only via `ensureToken()` from the Share or PDF
buttons (`components/chrome/AnalyzerHeaderActions.tsx:146`), or the Notes section's Save through
the `onRegisterSave` handle. Saving is a side effect of sharing or exporting.

The save also pre-awaits `fetchBatchedAiInsights()` (`AnalyzerHeaderActions.tsx:107`) so the
frozen artifact captures real prose rather than placeholders.

### 3.3 How saved deals open

`app/(app)/analyzer/saved/[id]/SavedClient.tsx` is a 126-line read-only report: `Hero`,
`ThreeStrategyGrid`, `MarketContextSection`, notes. It never mounts `useAnalyzerState` or
`AnalyzerInputPanel` and never recomputes. It is structurally the same artifact as the public
share view.

### 3.4 Why `input_snapshot` can be repurposed safely

Its only production read is a **fallback** in
`app/(app)/shared/analysis/[token]/ReadonlyAnalyzerView.tsx:72,83`:

```ts
snap.input ?? (row.input_snapshot as Record<string, unknown>) ?? {};
```

`result_snapshot.input` is preferred whenever present. Every other reference is a `{}` test
fixture. New rows satisfy the preferred branch; legacy rows keep their old flat shape and satisfy
the fallback branch. The two shapes never meet, so no share-path change is required.

---

## 4. Architecture

### 4.1 Storage contract

`input_snapshot` holds a versioned deal state. New file:
`app/(app)/analyzer/lib/deal-state-types.ts`.

```ts
export interface DealStateV2 {
  v: 2;

  // analyzer-core input (price, rentMonthly, taxAnnual, insuranceAnnual,
  // hoaMonthly, financing, arv, rehabBudget, propertyClass, unitCount,
  // marketCapRatePct, targetDSCR, capexReserveAnnualPerUnit, …)
  input: AnalyzerInputState;

  // identity & market geography
  address: string;
  selectedZip: string | null;
  label: string | null;

  // panel state not carried on analyzer.input
  arvLocal: number;
  rehabBudget: number;
  propertyType: "sfh" | "mf";
  unitCount: number | null;
  assumptions: AnalyzerAssumptions;

  // per-deal UI state. analysisMode ONLY — the investor goal is a global
  // standing preference and is deliberately NOT restored per deal. See §4.6.
  analysisMode: AnalysisMode;
  /** Recorded for the audit trail (the AI narratives were framed by it).
   *  Written on save, never read back into state. See §4.6. */
  activeGoalAtSave: InvestorGoal | null;

  thresholds?: AnyStrategyThresholds; // omitted unless detectActivePreset() === custom
  provenance: ProvenanceMap; // preserves RentCast-vs-typed divergence badges

  // restored, not refetched
  rentcastEcho: {
    city: string | null;
    state: string | null;
    zip: string | null;
    avmValue: number | null;
  } | null;
  piqByGeo: PiqByGeo | null;

  // owner content
  notes: string;
  shareNotes: boolean;

  // staleness clock — see §4.5
  marketCapturedAt: string; // ISO 8601
}
```

**Not persisted.** Every one of these is a pure function of the above and is recomputed on
hydration — persisting them would make them a lie the moment an input changes:

| Recomputed                                                            | By                                                                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `projection`, `sensitivity`, `afterTax`, `breakEven`, `brrrrTimeline` | `useDerivedAnalytics(input, assumptions, arvLocal, rehabBudget)`                                               |
| `grading`                                                             | `useGradingResult`                                                                                             |
| `propertyClass`                                                       | `derivePropertyClass(propertyType, unitCount)`                                                                 |
| `rental`, `flip`, `brrrr`                                             | `useAnalyzer` on hydrated input                                                                                |
| `aiNarratives`                                                        | `useSectionAiInsights` — served from the `analyzer_ai_insights` durable cache; an unedited deal is a cache hit |

### 4.2 Write model

Three columns, three different lifetimes. Keeping them separate is what lets autosave be cheap
and frequent without disturbing the published artifact or the staleness clock.

| Column            | Written by                                   | Contains                                                       |
| ----------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `input_snapshot`  | explicit Save **and** autosave               | `DealStateV2`                                                  |
| `result_snapshot` | Share / PDF **only**                         | frozen render artifact (`RichResultSnapshot`, shape unchanged) |
| `market_context`  | first Save and _Update market data_ **only** | `MarketContext` as captured                                    |

Consequences worth stating explicitly:

- **Autosave never calls the AI batch endpoint.** `fetchBatchedAiInsights()` stays on the
  Share/PDF path. An autosave that pre-awaited narratives would fire an LLM batch call every
  couple of seconds.
- **A shared link is stable while its owner keeps editing.** `result_snapshot` becomes "the
  version you published" rather than "the latest", so a client reading a shared report does not
  watch it mutate mid-read.
- **Autosave must not touch `market_context`.** That column is the restore source; rewriting it
  on every edit would quietly re-baseline the deal.

### 4.3 Save & autosave flow

```
New analysis
  └─ user clicks [Save deal]
       ├─ POST /api/analyzer/save  → creates row, returns { id, share_token }
       └─ dealId held in AnalyzerClient state

Saved deal (dealId != null)
  └─ any state change
       └─ debounce 2000ms idle
            └─ PATCH /api/analyzer/saved/:id/state  { input_snapshot }
                 └─ button reflects Saving… → Saved

Share / PDF
  └─ existing saveSnapshot() path
       ├─ pre-awaits AI narratives
       └─ writes result_snapshot + market_context (+ bumps marketCapturedAt)
```

**Hydration must not trigger autosave.** Populating state from a saved deal is a state change and
would otherwise fire an immediate write on every open. Guard with a `hydratedRef` that suppresses
the autosave effect until after the first committed render.

**Autosave engages only once a row exists.** A brand-new analysis requires one explicit Save.
Without this guard, every slider fiddle would spawn rows. (The backend already rejects a blank
`address_full`, so numbers-only scratch work cannot be saved at all.)

### 4.4 Open / hydration flow

`/analyzer/saved/[id]` renders `AnalyzerClient` hydrated from the saved row.

```
useSavedAnalysis(id)
  └─ migrateDealState(row) → DealStateV2
       └─ useAnalyzerState({ isPro, initialState })
            ├─ useAnalyzer(state.input)            // useAnalyzer already accepts initial input
            ├─ restore panel state + assumptions + analysisMode + thresholds
            │  + provenance  (NOT the investor goal — see §4.6)
            ├─ restore marketContext / piqByGeo from row.market_context + state.piqByGeo
            └─ recompute derived analytics locally
```

`useAnalyzerState` gains an optional `initialState?: DealStateV2` parameter. When present it seeds
every `useState` initializer and **suppresses the `?address=` auto-fetch effect**
(`use-analyzer-state.ts:158`) — a hydrated deal must not fire a RentCast lookup on open.

### 4.5 Staleness notice

```
lib/deal-staleness.ts
  export const STALE_AFTER_DAYS = 60;
  export function getDealStaleness(marketCapturedAt: string):
    { stale: boolean; days: number }
```

Rendered by `components/cards/StaleDealNotice.tsx`, shown only when hydrated from a saved deal and
`stale === true`:

> This analysis is 74 days old. Market data may have changed since you saved it.
> **[Update market data]**

_Update market data_ refetches market context + PIQ, recomputes the grade, writes
`market_context`, and sets a fresh `marketCapturedAt`. The user saves (or autosave does) to keep
it.

**Why `marketCapturedAt` and not `updated_at`.** Autosave writes `updated_at` on every edit. A
notice keyed off `updated_at` would be silently disarmed by autosave — a 74-day-old deal edited
once looks freshly written while its market data is untouched. `marketCapturedAt` tracks when the
market data was captured, which is the thing actually going stale. It lives inside the state blob,
so no migration is required.

60 days clears two monthly rescores, so when the notice fires something has almost certainly
moved.

---

### 4.6 The investor goal is NOT per-deal state

`selectedGoal` looks like deal state and is not. `use-selected-goal.ts:21,63-79` persists it
globally to `localStorage["analyzer.investorGoal"]`, deliberately:

> a goal is a standing investing preference, so carrying "I'm optimizing for cash flow" onto the
> next deal you compare is the desired behavior.

The same docstring records the bug that motivated the rule: an auto-inferred `fast_cash` persisted
from one compare session, then framed every later focused-mode analysis, because the AI payload
read `selectedGoal` unconditionally. Buy-and-hold analyses opened with "your goal is fast cash
within 12 months" — a goal the user could neither see nor change on that screen. The fix was
`activeGoal` (= `selectedGoal` in compare mode, `null` everywhere else), and the hook states that
anything user-facing — **the AI payload and the saved snapshot explicitly named** — must read
`activeGoal`.

Therefore:

- **Persist `analysisMode`.** It is genuine per-deal state (plain `useState` in
  `AnalyzerClient.tsx:87`, not localStorage) and decides whether the user sees focused or compare.
- **Persist `activeGoalAtSave` as a record only.** It documents what framed the saved narratives.
  Never write it back into `selectedGoal`.
- **Never restore the goal.** Writing a saved deal's goal into `selectedGoal` would fire the
  persistence effect at `use-selected-goal.ts:105-109` and overwrite the user's global standing
  preference with one deal's goal — the leak the `activeGoal` split exists to prevent.

Consequence, and it is the correct behavior: reopening a compare-mode deal shows the user's
_current_ standing goal, not the one in force when they saved. The goal is a preference about the
investor, not an input of the deal.

---

## 5. UI Changes

### 5.1 Save button

New `components/chrome/SaveButton.tsx`, placed beside `PdfButton` and `ShareButton` in
`AnalyzerHeaderActions`. It is status-bearing — the button _is_ the save indicator:

| State                   | Label        | Treatment             |
| ----------------------- | ------------ | --------------------- |
| No row yet              | `Save deal`  | filled tonal, enabled |
| Save in flight          | `Saving…`    | spinner, disabled     |
| Saved, no pending edits | `Saved`      | check icon, subdued   |
| Edits pending autosave  | `Saving…`    | spinner, subdued      |
| Save failed             | `Retry save` | error color, enabled  |

The failure state matters: a silent autosave failure is the classic way this feature loses work.
Errors surface on the button, not only in a modal.

Gating matches the existing Share/PDF behavior — non-Pro users get the sign-in prompt rather than
a save.

### 5.2 Routing

`/analyzer/saved/[id]` renders the hydrated, editable analyzer. `SavedClient.tsx`'s read-only
report is retired; the client-facing report remains at `/shared/analysis/[token]`, reachable via
the existing "Share this analysis →" affordance.

`SavedAnalysesPanel` continues to link to `/analyzer/saved/[id]`; no change needed.

### 5.3 Label

`label` becomes user-settable (it is currently hardcoded `null`). Editable inline on a saved deal;
`resolveSavedAnalysisLabel()` already falls back to the address when it is null, so the saved list
needs no change.

---

## 6. Back-Compat

`lib/migrate-snapshot.ts` widens from `migrateSnapshot(raw) → DealInput` to
`migrateDealState(row) → DealStateV2`, keeping the existing numeric coercion helpers.

```
if (input_snapshot.v === 2)  → use as-is
else                         → build V2 by harvesting a legacy row
```

Legacy harvest — most of the state is recoverable because `result_snapshot` already carries it:

| V2 field                                                                   | Recovered from                                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `input`                                                                    | `result_snapshot.input ?? input_snapshot` (flat legacy `DealInput`)        |
| `assumptions`, `arvLocal`, `rehabBudget`, `propertyType`, `unitCount`      | `result_snapshot.*`                                                        |
| `notes`, `shareNotes`                                                      | `result_snapshot.*`                                                        |
| `address`, `label`                                                         | `row.address_full`, `row.label`                                            |
| `selectedZip`                                                              | `row.address_zip`                                                          |
| `rentcastEcho`                                                             | `row.address_city/state/zip` (AVM unavailable — `null`)                    |
| `marketCapturedAt`                                                         | `row.updated_at`                                                           |
| `analysisMode`, `activeGoalAtSave`, `thresholds`, `provenance`, `piqByGeo` | defaults — genuinely absent in v1 (`analysisMode` defaults to `"focused"`) |

Legacy rows are **not** bulk-migrated. They upconvert on read and are written back as v2 on the
next save.

---

## 7. Backend Changes

### 7.1 New endpoint

`PATCH /api/analyzer/saved/:id/state` — autosave target.

- Body: `{ input_snapshot: Record<string, unknown> }` only.
- Owner-scoped: updates only where `owner_id = req.user.id`. A patch against another user's row
  returns 404 (not 403 — do not confirm the row exists).
- Does not touch `result_snapshot`, `market_context`, or `share_token`.
- New DTO `PatchDealStateDto` with `@IsObject() input_snapshot`.

### 7.2 Existing save endpoint

`POST /api/analyzer/save` gains an optional `id`. When present, update that row by id
(owner-scoped) instead of upserting on `(owner_id, address_full)`.

**Address collision.** Migration `20260722120000` put a unique constraint on
`(owner_id, address_full)`. Editing a saved deal's address to match another saved deal violates
it. Catch the unique-violation and return **409** with a clear message ("You already have a saved
analysis for that address") rather than surfacing a raw Postgres error.

### 7.3 Response shape — no change required

`POST /api/analyzer/save` **already returns `{ id, share_token }`**
(`lib/data/fetchers/analyzer.ts:186`). The client can hold `dealId` straight from the existing
response to enable autosave. Verified 2026-08-08; no backend change needed here.

---

## 8. Error Handling

| Failure                             | Behavior                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Autosave request fails              | Button → `Retry save`. State kept in memory. Retry on next edit or click.                                       |
| Autosave fails repeatedly           | Stop the debounce loop after 3 consecutive failures; leave `Retry save` until clicked. Do not hammer.           |
| Save with blank address             | Existing guard (`AnalyzerHeaderActions.tsx:92`) — friendly message, no request.                                 |
| Address collision on save           | 409 → inline message on the Save button.                                                                        |
| `migrateDealState` receives garbage | Return a defaults-filled `DealStateV2`; never throw. A corrupt row must open as an empty analyzer, not a crash. |
| Saved deal not found / not owned    | 404 → existing "Not found" view with a link back to `/analyzer`.                                                |
| Market refresh fails                | Notice stays, inline error. Restored data untouched.                                                            |

---

## 9. Testing

**`migrateDealState`** — v2 passthrough; v1 harvest with a full `result_snapshot`; v1 with a
minimal `result_snapshot`; `{}`; `null`; malformed types. Never throws.

**Round-trip** — build `DealStateV2` from a populated analyzer state, persist, hydrate, assert the
rebuilt state is field-for-field identical.

**Autosave** — does not fire before hydration completes; debounces multiple rapid edits into one
request; never calls `fetchBatchedAiInsights`; never writes `result_snapshot` or `market_context`;
halts after 3 consecutive failures.

**Staleness** — boundary at exactly 60 days; `marketCapturedAt` unchanged by autosave; changed by
_Update market data_.

**Share artifact** — an autosave following a Share leaves `result_snapshot` byte-identical.

**Backend** — `PATCH` rejects a non-owner with 404; rejects a payload carrying `result_snapshot`;
address collision returns 409.

**Hydration** — a hydrated deal does not fire the `?address=` RentCast auto-fetch.

**Investor goal (§4.6)** — hydrating a saved deal whose `activeGoalAtSave` is `fast_cash`, while
`localStorage["analyzer.investorGoal"]` holds `cash_flow`, leaves localStorage as `cash_flow` and
leaves `selectedGoal` as `cash_flow`. This is the regression test for the goal-leak bug; assert on
localStorage directly, not just on rendered output.

---

## 10. File Impact

New:

- `app/(app)/analyzer/lib/deal-state-types.ts`
- `app/(app)/analyzer/lib/build-deal-state.ts`
- `app/(app)/analyzer/lib/use-deal-autosave.ts`
- `app/(app)/analyzer/lib/deal-staleness.ts`
- `app/(app)/analyzer/components/chrome/SaveButton.tsx`
- `app/(app)/analyzer/components/cards/StaleDealNotice.tsx`
- `packages/backend/src/analyzer/dto/patch-deal-state.dto.ts`

Modified:

- `lib/migrate-snapshot.ts` — widen to `migrateDealState`
- `lib/build-analyzer-snapshot.ts` — emit `DealStateV2` as `input_snapshot`
- `lib/use-analyzer-state.ts` — accept `initialState`, suppress auto-fetch when hydrated
- `AnalyzerClient.tsx` — hold `dealId`, wire autosave + Save button + stale notice
- `components/chrome/AnalyzerHeaderActions.tsx` — add Save button, expose save status
- `app/(app)/analyzer/saved/[id]/page.tsx` — render hydrated `AnalyzerClient`
- `lib/data/fetchers/analyzer.ts` — add `patchDealState()`, add optional `id` to the save payload
- `packages/backend/src/analyzer/analyzer.controller.ts` + `analyzer.persistence.service.ts`

Retired:

- `app/(app)/analyzer/saved/[id]/SavedClient.tsx` and its read-only render path

**Explicitly kept:** `lib/saved-render-builders.ts`. It is **shared with the public share view** —
`app/(app)/shared/analysis/[token]/ReadonlyAnalyticsPage.tsx:22` imports
`extractMarketContextProps` from it. Deleting it alongside `SavedClient` would break the share
page. Only `SavedClient`'s own imports (`buildKpiTilesFromRental`, `buildStrategyCardsFromResult`)
become unused; leave the module and its tests in place.

`AnalyzerClient.tsx` is already 399 lines against a 400-line hard limit (CLAUDE.md §1.3). The
autosave wiring must land in `use-deal-autosave.ts`, not inline, and the file needs a split
regardless — see §11.

---

## 11. Open Items for the Implementation Plan

- `AnalyzerClient.tsx` is at 399/400 lines and this work adds `dealId` state, autosave wiring, the
  Save button and the stale notice. It must be split first. Propose the split in the plan.

**Resolved during spec review** (previously open, verified against the tree):

- `POST /api/analyzer/save` **already returns `{ id, share_token }`**
  (`lib/data/fetchers/analyzer.ts:186`). §7.3 requires no backend change — the client can hold
  `dealId` from the existing response.
- `lib/saved-render-builders.ts` **is** shared with the share view and must not be retired. See
  §10.
