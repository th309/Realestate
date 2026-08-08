# Analyzer Saved-Deal Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a saved deal a resumable working document — persist every user-authored value, reopen `/analyzer/saved/[id]` as the fully editable analyzer, save explicitly then autosave.

**Architecture:** `deal_analyses.input_snapshot` is repurposed from a bare `DealInput` into a versioned `DealStateV2` blob. `result_snapshot` keeps its current shape and lifetime as the frozen share artifact. A new owner-scoped `PATCH /api/analyzer/saved/:id/state` is the cheap autosave target. Hydration seeds `useAnalyzerState` from the blob; all derived analytics recompute locally.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query v5, NestJS 11, Supabase (service-role client), vitest + @testing-library/react (frontend), jest (backend).

**Spec:** `docs/superpowers/specs/2026-08-08-analyzer-saved-deal-persistence-design.md`

## Global Constraints

- **File size (CLAUDE.md §1.3):** logic files <200 lines target / **300 hard**; React components <300 target / **400 hard**; test files <400 target / **500 hard**. `AnalyzerClient.tsx` is at 399/400 — Task 1 exists solely to make room.
- **Data layer (CLAUDE.md §5):** all frontend fetching goes through `@/lib/data`. Never `fetch(${API_URL})` outside `lib/data/fetchers/`. ESLint blocks `lib/api/client*`.
- **Validation (CLAUDE.md §1.2):** every backend endpoint validates input with `class-validator`. No hardcoded fallbacks for config/secrets.
- **Owner scoping:** `this.supabase` in `AnalyzerPersistenceService` is the **service-role client**, so RLS is NOT in effect. `.eq('owner_id', ownerId)` is the actual enforcement on every query. Never omit it.
- **Investor goal (spec §4.6):** `selectedGoal` is a GLOBAL localStorage preference (`analyzer.investorGoal`). Persist `activeGoalAtSave` as a record only. **Never write a saved deal's goal back into `selectedGoal`.**
- **Score labels (CLAUDE.md §9):** momentum words only (VERY STRONG / STRONG / RISING / FIRMING / STEADY / EASING / WEAK / VERY WEAK). Never quality words.
- **Frontend tests:** `npx vitest run <path>` from `packages/frontend`.
- **Backend tests:** `npx jest <path>` from `packages/backend`.
- **Commits:** no `Co-Authored-By` trailer.

---

### Task 1: Extract the analyzer view-model to make room in AnalyzerClient

`AnalyzerClient.tsx` is 399 lines against a 400-line hard limit. This task is a pure refactor — no behavior change — extracting the "raw state → view-ready props" assembly so later tasks have headroom.

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/lib/use-analyzer-view-model.ts`
- Modify: `packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx:105-149,193-209`
- Test: `packages/frontend/app/(app)/analyzer/lib/__tests__/use-analyzer-view-model.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `useAnalyzerViewModel(args): AnalyzerViewModel` with fields `activeStrategy: Strategy`, `engineStrategy: EngineStrategy`, `presetLabel: string`, `displayAddress: string | null`, `lookupErrorMsg: string | null`, `compsView: CompsViewProps`, `cashflow: { grossRentMonthly, debtServiceMonthly, opexAnnual, vacancyMonthly }`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/app/(app)/analyzer/lib/__tests__/use-analyzer-view-model.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  resolvePresetLabel,
  resolveDisplayAddress,
} from "../use-analyzer-view-model";

describe("resolvePresetLabel reports the user's saved rubric, not a hardcoded preset", () => {
  it("returns Balanced when the account has no saved thresholds row", () => {
    expect(resolvePresetLabel(undefined, null)).toBe("Balanced");
  });

  it("title-cases the detected preset name", () => {
    expect(resolvePresetLabel({ minCapRatePct: 6 }, "conservative")).toBe(
      "Conservative",
    );
  });

  it("reads as Custom when saved thresholds match no preset", () => {
    expect(resolvePresetLabel({ minCapRatePct: 6 }, null)).toBe("Custom");
  });
});

describe("resolveDisplayAddress prefers the RentCast-resolved address", () => {
  it("uses the resolved address when present", () => {
    expect(resolveDisplayAddress("123 Main St, Austin, TX", "123 main")).toBe(
      "123 Main St, Austin, TX",
    );
  });

  it("falls back to the trimmed typed address", () => {
    expect(resolveDisplayAddress(undefined, "  123 main  ")).toBe("123 main");
  });

  it("returns null when neither is usable", () => {
    expect(resolveDisplayAddress(undefined, "   ")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/lib/__tests__/use-analyzer-view-model.test.ts"`
Expected: FAIL — `Failed to resolve import "../use-analyzer-view-model"`

- [ ] **Step 3: Create the view-model module**

Move the logic verbatim out of `AnalyzerClient.tsx`. Export the two pure helpers separately so they are unit-testable without rendering.

```ts
// packages/frontend/app/(app)/analyzer/lib/use-analyzer-view-model.ts
import { buildCompsViewProps } from "./comps-view-props";
import { deriveCashflowSummary } from "./cashflow-summary";
import { toEngineStrategy } from "./use-grading-result";
import {
  detectActivePreset,
  type AnyStrategyThresholds,
} from "../components/CustomizeThresholdsDrawer/preset-helpers";
import type { Strategy } from "./strategy-tile-mappers";
import type { AnalysisMode } from "../components/InputPanel/StrategyControls";

/**
 * "Graded against X criteria" must reflect the user's SAVED rubric, not a
 * hardcoded preset name. GET falls back to the Balanced preset when the
 * account has no saved row, so detectActivePreset resolves it correctly;
 * anything off the preset grid reads as Custom.
 */
export function resolvePresetLabel(
  savedThresholds: unknown,
  activePreset: string | null,
): string {
  if (!savedThresholds) return "Balanced";
  if (!activePreset) return "Custom";
  return activePreset.charAt(0).toUpperCase() + activePreset.slice(1);
}

export function resolveDisplayAddress(
  resolvedAddress: string | undefined,
  typedAddress: string,
): string | null {
  return resolvedAddress ?? (typedAddress.trim() || null);
}

export interface AnalyzerViewModelArgs {
  analysisMode: AnalysisMode;
  bestPlay: Strategy;
  focusedStrategy: Strategy;
  savedThresholds: AnyStrategyThresholds | undefined;
  resolvedAddress: string | undefined;
  address: string;
  rentcastData: Parameters<typeof buildCompsViewProps>[0];
  price: number;
  input: Parameters<typeof deriveCashflowSummary>[0];
  rental: Parameters<typeof deriveCashflowSummary>[1];
  lookupError: { message?: string } | null;
}

export function useAnalyzerViewModel(args: AnalyzerViewModelArgs) {
  const activeStrategy: Strategy =
    args.analysisMode === "compare" ? args.bestPlay : args.focusedStrategy;
  const engineStrategy = toEngineStrategy(activeStrategy) ?? "BUY_AND_HOLD";
  const activePreset = detectActivePreset(
    engineStrategy,
    args.savedThresholds ?? null,
  );

  return {
    activeStrategy,
    engineStrategy,
    presetLabel: resolvePresetLabel(args.savedThresholds, activePreset),
    displayAddress: resolveDisplayAddress(args.resolvedAddress, args.address),
    compsView: buildCompsViewProps(args.rentcastData, args.price),
    cashflow: deriveCashflowSummary(args.input, args.rental),
    lookupErrorMsg: args.lookupError
      ? String(args.lookupError.message ?? args.lookupError)
      : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/lib/__tests__/use-analyzer-view-model.test.ts"`
Expected: PASS (6 tests)

- [ ] **Step 5: Rewire AnalyzerClient to consume the view model**

Delete lines 105-122 (activeStrategy + preset block), 124-125 (displayAddress), 148-149 (cashflow), 193-209 (compsView + lookupErrorMsg) and replace with a single call. Keep every JSX consumer name identical so the render body is untouched:

```tsx
const vm = useAnalyzerViewModel({
  analysisMode,
  bestPlay,
  focusedStrategy,
  savedThresholds: savedThresholdsQ.data as AnyStrategyThresholds | undefined,
  resolvedAddress: rentcastData?.resolved_address,
  address,
  rentcastData,
  price: analyzer.input.price ?? 0,
  input: analyzer.input,
  rental,
  lookupError: propertyLookup.error,
});
const {
  activeStrategy,
  engineStrategy,
  presetLabel,
  displayAddress,
  compsView,
  lookupErrorMsg,
} = vm;
const { grossRentMonthly, debtServiceMonthly, opexAnnual, vacancyMonthly } =
  vm.cashflow;
const {
  salesComps,
  rentalComps,
  pricePerSqftValues,
  yourPricePerSqft,
  subjectPrice,
  subjectLat,
  subjectLon,
  mapboxToken,
} = compsView;
```

Note `savedThresholdsQ = useThresholds(engineStrategy)` must stay in `AnalyzerClient` and now reads `engineStrategy` from the view model — reorder so `useThresholds` is called after `useAnalyzerViewModel`, passing `vm.engineStrategy`.

- [ ] **Step 6: Verify no behavior change**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer"`
Expected: PASS — all pre-existing analyzer tests still green.

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

Run: `wc -l "app/(app)/analyzer/AnalyzerClient.tsx"`
Expected: **under 350** — headroom confirmed.

- [ ] **Step 7: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/lib/use-analyzer-view-model.ts" \
        "packages/frontend/app/(app)/analyzer/lib/__tests__/use-analyzer-view-model.test.ts" \
        "packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx"
git commit -m "refactor(analyzer): extract the view-model assembly out of AnalyzerClient

AnalyzerClient sat at 399 lines against the 400-line component limit, so
nothing could be added to it. Pulls the raw-state-to-view-props assembly
(active strategy, preset label, display address, comps view, cashflow
summary, lookup error) into use-analyzer-view-model. No behavior change."
```

---

### Task 2: DealStateV2 types and builder

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/lib/deal-state-types.ts`
- Create: `packages/frontend/app/(app)/analyzer/lib/build-deal-state.ts`
- Test: `packages/frontend/app/(app)/analyzer/lib/__tests__/build-deal-state.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `interface DealStateV2`, `DEAL_STATE_VERSION = 2`, and `buildDealState(args: BuildDealStateArgs): DealStateV2`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/app/(app)/analyzer/lib/__tests__/build-deal-state.test.ts
import { describe, it, expect } from "vitest";
import { buildDealState } from "../build-deal-state";
import { DEFAULT_ASSUMPTIONS } from "../analyzer-assumptions";

const ARGS = {
  input: {
    price: 300_000,
    rentMonthly: 2400,
    taxAnnual: 4200,
    insuranceAnnual: 1500,
    hoaMonthly: 0,
    financing: {
      downPaymentPct: 0.2,
      interestRatePct: 7.1,
      termYears: 30,
      closingCostsPct: 0.03,
    },
  },
  address: "123 Main St, Austin, TX",
  selectedZip: "78701",
  label: "Duplex deal",
  arvLocal: 345_000,
  rehabBudget: 45_000,
  propertyType: "sfh" as const,
  unitCount: 1,
  assumptions: DEFAULT_ASSUMPTIONS,
  analysisMode: "focused" as const,
  activeGoalAtSave: null,
  thresholds: undefined,
  provenance: {},
  rentcastEcho: {
    city: "Austin",
    state: "TX",
    zip: "78701",
    avmValue: 312_000,
  },
  piqByGeo: { zip: 62, county: 58, metro: 61 },
  notes: "Seller motivated",
  shareNotes: false,
  marketCapturedAt: "2026-08-08T00:00:00.000Z",
};

describe("buildDealState produces a versioned, fully-populated deal state", () => {
  it("stamps the version", () => {
    expect(buildDealState(ARGS).v).toBe(2);
  });

  it("round-trips every user-authored field", () => {
    const s = buildDealState(ARGS);
    expect(s.input.price).toBe(300_000);
    expect(s.selectedZip).toBe("78701");
    expect(s.label).toBe("Duplex deal");
    expect(s.arvLocal).toBe(345_000);
    expect(s.assumptions.marginalTaxRate).toBe(0.24);
    expect(s.notes).toBe("Seller motivated");
    expect(s.marketCapturedAt).toBe("2026-08-08T00:00:00.000Z");
  });

  it("omits thresholds when the user is on a stock preset", () => {
    expect(buildDealState(ARGS).thresholds).toBeUndefined();
  });

  it("records the active goal but never a bare selectedGoal (spec 4.6)", () => {
    const s = buildDealState({ ...ARGS, activeGoalAtSave: "cash_flow" });
    expect(s.activeGoalAtSave).toBe("cash_flow");
    expect(s).not.toHaveProperty("selectedGoal");
    expect(s).not.toHaveProperty("goal");
  });

  it("survives a JSON round-trip unchanged (it is stored as JSONB)", () => {
    const s = buildDealState(ARGS);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/lib/__tests__/build-deal-state.test.ts"`
Expected: FAIL — `Failed to resolve import "../build-deal-state"`

- [ ] **Step 3: Write the types**

```ts
// packages/frontend/app/(app)/analyzer/lib/deal-state-types.ts
import type { AnalyzerInputState } from "@/lib/analyzer/useAnalyzer";
import type { AnalyzerAssumptions } from "./analyzer-assumptions";
import type { ProvenanceMap } from "./use-analyzer-state.provenance";
import type { PiqByGeo } from "./use-piq-by-geo";
import type { InvestorGoal } from "./goal-types";
import type { AnalysisMode } from "../components/InputPanel/StrategyControls";
import type { AnyStrategyThresholds } from "../components/CustomizeThresholdsDrawer/preset-helpers";

export const DEAL_STATE_VERSION = 2 as const;

export interface RentcastEcho {
  city: string | null;
  state: string | null;
  zip: string | null;
  avmValue: number | null;
}

/**
 * The complete, resumable state of a saved deal — stored in
 * `deal_analyses.input_snapshot`.
 *
 * Holds ONLY what a recompute cannot reproduce. Derived analytics
 * (projection, sensitivity, after-tax, break-even, BRRRR timeline, grading)
 * are deliberately absent: they are pure functions of the fields below and
 * become a lie the moment an input changes. `result_snapshot` continues to
 * store them because a frozen share artifact has no live input to recompute
 * from.
 */
export interface DealStateV2 {
  v: typeof DEAL_STATE_VERSION;
  input: AnalyzerInputState;
  address: string;
  selectedZip: string | null;
  label: string | null;
  arvLocal: number;
  rehabBudget: number;
  propertyType: "sfh" | "mf";
  unitCount: number | null;
  assumptions: AnalyzerAssumptions;
  /** Per-deal UI state. The investor GOAL is global — see spec §4.6. */
  analysisMode: AnalysisMode;
  /** Audit record of what framed the saved narratives. Never restored. */
  activeGoalAtSave: InvestorGoal | null;
  thresholds?: AnyStrategyThresholds;
  provenance: ProvenanceMap;
  rentcastEcho: RentcastEcho | null;
  piqByGeo: PiqByGeo | null;
  notes: string;
  shareNotes: boolean;
  /** ISO 8601. Staleness clock — NOT bumped by autosave. See spec §4.5. */
  marketCapturedAt: string;
}
```

- [ ] **Step 4: Write the builder**

```ts
// packages/frontend/app/(app)/analyzer/lib/build-deal-state.ts
import { DEAL_STATE_VERSION, type DealStateV2 } from "./deal-state-types";

export type BuildDealStateArgs = Omit<DealStateV2, "v">;

/**
 * Compose a `DealStateV2` for persistence into `input_snapshot`.
 *
 * Deliberately a plain mapping with no derivation: everything here is a
 * value the user authored or a snapshot we are choosing to restore rather
 * than refetch. If you find yourself computing something in this function,
 * it probably belongs in the recompute path instead.
 */
export function buildDealState(args: BuildDealStateArgs): DealStateV2 {
  return { v: DEAL_STATE_VERSION, ...args };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/lib/__tests__/build-deal-state.test.ts"`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/lib/deal-state-types.ts" \
        "packages/frontend/app/(app)/analyzer/lib/build-deal-state.ts" \
        "packages/frontend/app/(app)/analyzer/lib/__tests__/build-deal-state.test.ts"
git commit -m "feat(analyzer): add the DealStateV2 contract for resumable saves"
```

---

### Task 3: migrateDealState — upconvert legacy saves

Existing rows have a flat `DealInput` in `input_snapshot`. They must reopen without crashing, recovering as much state as `result_snapshot` happens to carry.

**Files:**

- Modify: `packages/frontend/app/(app)/analyzer/lib/migrate-snapshot.ts`
- Test: `packages/frontend/app/(app)/analyzer/lib/__tests__/migrate-deal-state.test.ts`

**Interfaces:**

- Consumes: `DealStateV2`, `DEAL_STATE_VERSION` from Task 2.
- Produces: `migrateDealState(row: SavedAnalysisRow): DealStateV2`. Keeps the existing `migrateSnapshot(raw): DealInput` export — `ReadonlyAnalyzerView` still uses it.

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/app/(app)/analyzer/lib/__tests__/migrate-deal-state.test.ts
import { describe, it, expect } from "vitest";
import { migrateDealState } from "../migrate-snapshot";
import { DEFAULT_ASSUMPTIONS } from "../analyzer-assumptions";

const V1_ROW = {
  id: "row-1",
  label: null,
  address_full: "99 Oak Ave, Dallas, TX",
  address_city: "Dallas",
  address_state: "TX",
  address_zip: "75201",
  updated_at: "2026-05-01T00:00:00.000Z",
  input_snapshot: {
    price: 250_000,
    rentMonthly: 2000,
    financing: { interestRatePct: 6.5 },
  },
  result_snapshot: {
    input: { price: 250_000, rentMonthly: 2000 },
    assumptions: { ...DEFAULT_ASSUMPTIONS, marginalTaxRate: 0.32 },
    arvLocal: 300_000,
    rehabBudget: 20_000,
    propertyType: "mf",
    unitCount: 4,
    notes: "legacy note",
    shareNotes: true,
  },
  market_context: null,
};

describe("migrateDealState upconverts a legacy v1 row", () => {
  it("stamps version 2", () => {
    expect(migrateDealState(V1_ROW).v).toBe(2);
  });

  it("harvests panel state out of result_snapshot", () => {
    const s = migrateDealState(V1_ROW);
    expect(s.arvLocal).toBe(300_000);
    expect(s.rehabBudget).toBe(20_000);
    expect(s.propertyType).toBe("mf");
    expect(s.unitCount).toBe(4);
    expect(s.assumptions.marginalTaxRate).toBe(0.32);
    expect(s.notes).toBe("legacy note");
    expect(s.shareNotes).toBe(true);
  });

  it("recovers address and zip from the row columns", () => {
    const s = migrateDealState(V1_ROW);
    expect(s.address).toBe("99 Oak Ave, Dallas, TX");
    expect(s.selectedZip).toBe("75201");
    expect(s.rentcastEcho).toEqual({
      city: "Dallas",
      state: "TX",
      zip: "75201",
      avmValue: null,
    });
  });

  it("clocks staleness off the row's updated_at", () => {
    expect(migrateDealState(V1_ROW).marketCapturedAt).toBe(
      "2026-05-01T00:00:00.000Z",
    );
  });

  it("defaults the fields that genuinely do not exist in v1", () => {
    const s = migrateDealState(V1_ROW);
    expect(s.analysisMode).toBe("focused");
    expect(s.activeGoalAtSave).toBeNull();
    expect(s.thresholds).toBeUndefined();
    expect(s.provenance).toEqual({});
    expect(s.piqByGeo).toBeNull();
  });
});

describe("migrateDealState passes a v2 blob through untouched", () => {
  it("returns the stored state as-is", () => {
    const v2 = {
      ...migrateDealState(V1_ROW),
      label: "renamed",
      notes: "edited",
    };
    const out = migrateDealState({ ...V1_ROW, input_snapshot: v2 });
    expect(out.label).toBe("renamed");
    expect(out.notes).toBe("edited");
  });
});

describe("migrateDealState never throws on malformed input", () => {
  it.each([
    ["empty row", { input_snapshot: {}, result_snapshot: {} }],
    ["null blobs", { input_snapshot: null, result_snapshot: null }],
    ["wrong types", { input_snapshot: "nope", result_snapshot: 42 }],
    ["nothing at all", {}],
  ])("returns a usable default state for %s", (_label, row) => {
    const s = migrateDealState(row as never);
    expect(s.v).toBe(2);
    expect(s.assumptions).toEqual(DEFAULT_ASSUMPTIONS);
    expect(typeof s.marketCapturedAt).toBe("string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/lib/__tests__/migrate-deal-state.test.ts"`
Expected: FAIL — `migrateDealState is not a function`

- [ ] **Step 3: Implement migrateDealState**

Append to `migrate-snapshot.ts` (keep `migrateSnapshot` exported — `ReadonlyAnalyzerView` imports it):

```ts
import { DEAL_STATE_VERSION, type DealStateV2 } from "./deal-state-types";
import {
  DEFAULT_ASSUMPTIONS,
  type AnalyzerAssumptions,
} from "./analyzer-assumptions";

interface LegacyRow {
  label?: string | null;
  address_full?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  updated_at?: string | null;
  input_snapshot?: unknown;
  result_snapshot?: unknown;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * Upconvert a saved row to `DealStateV2`.
 *
 * v1 rows stored a bare `DealInput` in `input_snapshot` and scattered the
 * rest of the user's state through `result_snapshot`'s display extras, so
 * most of it IS recoverable. `analysisMode`, `activeGoalAtSave`,
 * `thresholds`, `provenance` and `piqByGeo` were never written in v1 and
 * fall back to defaults.
 *
 * MUST NOT throw: a corrupt row has to open as an empty analyzer, never as
 * a crash.
 */
export function migrateDealState(row: LegacyRow): DealStateV2 {
  const snap = obj(row?.input_snapshot);
  if (snap.v === DEAL_STATE_VERSION) return snap as unknown as DealStateV2;

  const result = obj(row?.result_snapshot);
  const zip = typeof row?.address_zip === "string" ? row.address_zip : null;

  return {
    v: DEAL_STATE_VERSION,
    input: migrateSnapshot(Object.keys(snap).length > 0 ? snap : result.input),
    address: str(row?.address_full, ""),
    selectedZip: zip,
    label: typeof row?.label === "string" ? row.label : null,
    arvLocal: num(result.arvLocal, 0) ?? 0,
    rehabBudget: num(result.rehabBudget, 45_000) ?? 45_000,
    propertyType: result.propertyType === "mf" ? "mf" : "sfh",
    unitCount: num(result.unitCount, 1),
    assumptions: {
      ...DEFAULT_ASSUMPTIONS,
      ...obj(result.assumptions),
    } as AnalyzerAssumptions,
    analysisMode: "focused",
    activeGoalAtSave: null,
    thresholds: undefined,
    provenance: {},
    rentcastEcho: {
      city: typeof row?.address_city === "string" ? row.address_city : null,
      state: typeof row?.address_state === "string" ? row.address_state : null,
      zip,
      avmValue: null,
    },
    piqByGeo: null,
    notes: str(result.notes, ""),
    shareNotes: result.shareNotes === true,
    marketCapturedAt: str(row?.updated_at, new Date(0).toISOString()),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/lib/__tests__/migrate-deal-state.test.ts"`
Expected: PASS (11 tests)

- [ ] **Step 5: Verify the legacy consumer still compiles**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors — `migrateSnapshot` is still exported for `ReadonlyAnalyzerView`.

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/lib/migrate-snapshot.ts" \
        "packages/frontend/app/(app)/analyzer/lib/__tests__/migrate-deal-state.test.ts"
git commit -m "feat(analyzer): upconvert legacy saved rows to DealStateV2

v1 rows stored a bare DealInput and scattered the rest of the user's state
through result_snapshot's display extras, so most of it is recoverable.
Never throws — a corrupt row opens as an empty analyzer, not a crash."
```

---

### Task 4: Staleness clock

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/lib/deal-staleness.ts`
- Test: `packages/frontend/app/(app)/analyzer/lib/__tests__/deal-staleness.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `STALE_AFTER_DAYS = 60`, `getDealStaleness(marketCapturedAt: string, now?: Date): { stale: boolean; days: number }`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/app/(app)/analyzer/lib/__tests__/deal-staleness.test.ts
import { describe, it, expect } from "vitest";
import { getDealStaleness, STALE_AFTER_DAYS } from "../deal-staleness";

const NOW = new Date("2026-08-08T12:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("getDealStaleness fires only past the threshold", () => {
  it("is not stale the day it was captured", () => {
    expect(getDealStaleness(daysAgo(0), NOW)).toEqual({
      stale: false,
      days: 0,
    });
  });

  it("is not stale one day short of the threshold", () => {
    expect(getDealStaleness(daysAgo(59), NOW).stale).toBe(false);
  });

  it("is not stale exactly at the threshold", () => {
    expect(getDealStaleness(daysAgo(STALE_AFTER_DAYS), NOW).stale).toBe(false);
  });

  it("is stale one day past the threshold", () => {
    expect(getDealStaleness(daysAgo(61), NOW)).toEqual({
      stale: true,
      days: 61,
    });
  });

  it("reports the real age for a long-abandoned deal", () => {
    expect(getDealStaleness(daysAgo(400), NOW)).toEqual({
      stale: true,
      days: 400,
    });
  });
});

describe("getDealStaleness degrades safely on bad input", () => {
  it.each(["", "not-a-date", "2026-13-45T00:00:00Z"])(
    "treats %s as not stale rather than throwing",
    (bad) => {
      expect(getDealStaleness(bad, NOW)).toEqual({ stale: false, days: 0 });
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/lib/__tests__/deal-staleness.test.ts"`
Expected: FAIL — `Failed to resolve import "../deal-staleness"`

- [ ] **Step 3: Implement**

```ts
// packages/frontend/app/(app)/analyzer/lib/deal-staleness.ts

/**
 * 60 days clears two monthly PIQ rescores, so when the notice fires
 * something has almost certainly moved. Tighter than this and the banner
 * cries wolf; looser and a genuinely stale deal reads as current.
 */
export const STALE_AFTER_DAYS = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How old is this deal's MARKET data?
 *
 * Clocked off `DealStateV2.marketCapturedAt`, never `updated_at` — autosave
 * writes `updated_at` on every edit, so a notice keyed off it would be
 * silently disarmed the first time the user touched a 74-day-old deal.
 *
 * An unparseable timestamp reports not-stale: a missing banner is a far
 * smaller failure than a crash on open.
 */
export function getDealStaleness(
  marketCapturedAt: string,
  now: Date = new Date(),
): { stale: boolean; days: number } {
  const captured = new Date(marketCapturedAt).getTime();
  if (!Number.isFinite(captured)) return { stale: false, days: 0 };

  const days = Math.floor((now.getTime() - captured) / MS_PER_DAY);
  if (days <= 0) return { stale: false, days: 0 };
  return { stale: days > STALE_AFTER_DAYS, days };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/lib/__tests__/deal-staleness.test.ts"`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/lib/deal-staleness.ts" \
        "packages/frontend/app/(app)/analyzer/lib/__tests__/deal-staleness.test.ts"
git commit -m "feat(analyzer): add the saved-deal staleness clock

Clocked off marketCapturedAt rather than updated_at, which autosave bumps
on every edit and would silently disarm the notice."
```

---

### Task 5: Backend PATCH /api/analyzer/saved/:id/state

**Files:**

- Create: `packages/backend/src/analyzer/dto/patch-deal-state.dto.ts`
- Modify: `packages/backend/src/analyzer/analyzer.persistence.service.ts`
- Modify: `packages/backend/src/analyzer/analyzer.controller.ts` (beside `@Get('saved/:id')` at :158)
- Test: `packages/backend/src/analyzer/__tests__/patch-deal-state.spec.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `AnalyzerPersistenceService.patchState(ownerId: string, id: string, inputSnapshot: Record<string, unknown>): Promise<{ id: string } | null>` — resolves `null` when the row does not exist or is not owned.

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/analyzer/__tests__/patch-deal-state.spec.ts
import { AnalyzerPersistenceService } from "../analyzer.persistence.service";

function mockSupabase(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown>[] = [];
  const chain = {
    update: (payload: Record<string, unknown>) => {
      calls.push({ update: payload });
      return chain;
    },
    eq: (col: string, val: string) => {
      calls.push({ eq: [col, val] });
      return chain;
    },
    select: () => chain,
    maybeSingle: () => Promise.resolve(result),
  };
  return { client: { from: () => chain } as never, calls };
}

describe("AnalyzerPersistenceService.patchState", () => {
  it("writes only input_snapshot and updated_at", async () => {
    const { client, calls } = mockSupabase({
      data: { id: "row-1" },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.patchState("owner-1", "row-1", { v: 2, price: 300000 });

    const update = calls.find((c) => "update" in c)?.update as Record<
      string,
      unknown
    >;
    expect(Object.keys(update).sort()).toEqual([
      "input_snapshot",
      "updated_at",
    ]);
    expect(update.input_snapshot).toEqual({ v: 2, price: 300000 });
  });

  it("never touches result_snapshot, market_context or share_token", async () => {
    const { client, calls } = mockSupabase({
      data: { id: "row-1" },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.patchState("owner-1", "row-1", { v: 2 });

    const update = calls.find((c) => "update" in c)?.update as Record<
      string,
      unknown
    >;
    expect(update).not.toHaveProperty("result_snapshot");
    expect(update).not.toHaveProperty("market_context");
    expect(update).not.toHaveProperty("share_token");
  });

  it("scopes the write by owner_id AND id — the service-role client bypasses RLS", async () => {
    const { client, calls } = mockSupabase({
      data: { id: "row-1" },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.patchState("owner-1", "row-1", { v: 2 });

    const eqs = calls.filter((c) => "eq" in c).map((c) => c.eq);
    expect(eqs).toContainEqual(["owner_id", "owner-1"]);
    expect(eqs).toContainEqual(["id", "row-1"]);
  });

  it("resolves null when the row is absent or not owned", async () => {
    const { client } = mockSupabase({ data: null, error: null });
    const svc = new AnalyzerPersistenceService(client);
    await expect(
      svc.patchState("owner-1", "row-9", { v: 2 }),
    ).resolves.toBeNull();
  });

  it("throws on a real database error", async () => {
    const { client } = mockSupabase({ data: null, error: { message: "boom" } });
    const svc = new AnalyzerPersistenceService(client);
    await expect(svc.patchState("owner-1", "row-1", { v: 2 })).rejects.toThrow(
      "boom",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/analyzer/__tests__/patch-deal-state.spec.ts`
Expected: FAIL — `svc.patchState is not a function`

- [ ] **Step 3: Add the DTO**

```ts
// packages/backend/src/analyzer/dto/patch-deal-state.dto.ts
import { IsObject } from "class-validator";

/**
 * Payload for PATCH /api/analyzer/saved/:id/state — the autosave target.
 *
 * Deliberately narrow. Autosave persists the user's working state and
 * nothing else: `result_snapshot` is the published share artifact and must
 * only change when the user deliberately shares or exports, and
 * `market_context` is the restore source for a saved deal. Accepting either
 * here would let a keystroke mutate a link already in a client's hands.
 */
export class PatchDealStateDto {
  @IsObject()
  input_snapshot!: Record<string, unknown>;
}
```

- [ ] **Step 4: Add patchState to the persistence service**

```ts
  /**
   * Autosave: overwrite only the working state of a saved deal.
   *
   * Scoped by `owner_id` AND `id`. `this.supabase` is the service-role
   * client (see supabase.module.ts), so the `deal_analyses_owner_update`
   * RLS policy is NOT in effect — the `.eq('owner_id', ...)` IS the
   * enforcement, matching list()/getOne()/remove().
   *
   * Returns null when no row matched, so the controller can 404 without
   * confirming whether the id exists for some other owner.
   */
  async patchState(
    ownerId: string,
    id: string,
    inputSnapshot: Record<string, unknown>,
  ) {
    const { data, error } = await this.supabase
      .from('deal_analyses')
      .update({
        input_snapshot: inputSnapshot,
        updated_at: new Date().toISOString(),
      })
      .eq('owner_id', ownerId)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  }
```

- [ ] **Step 5: Add the controller route**

Place immediately after `@Get('saved/:id')` (currently ends at :169). Import `Patch` from `@nestjs/common` and `PatchDealStateDto`.

```ts
  /**
   * PATCH /api/analyzer/saved/:id/state
   *
   * Autosave target. Persists ONLY the working deal state; the published
   * share artifact (`result_snapshot`) and the restore baseline
   * (`market_context`) are untouched by design — see the persistence spec
   * §4.2. Auth-required and Pro-gated to match POST /save.
   */
  @Patch('saved/:id/state')
  @UseGuards(JwtAuthGuard)
  async patchSavedState(
    @AuthUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PatchDealStateDto,
  ) {
    await this.tierGate.requirePro(userId);
    const row = await this.persistence.patchState(userId, id, body.input_snapshot);
    if (!row) {
      throw new NotFoundException('analysis not found');
    }
    return { ok: true };
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/backend && npx jest src/analyzer/__tests__/patch-deal-state.spec.ts`
Expected: PASS (5 tests)

Run: `cd packages/backend && npx tsc --noEmit`
Expected: no errors. (Plain `tsc --noEmit` — `nest build` excludes spec files and would miss test-only type errors.)

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/analyzer/dto/patch-deal-state.dto.ts \
        packages/backend/src/analyzer/analyzer.persistence.service.ts \
        packages/backend/src/analyzer/analyzer.controller.ts \
        packages/backend/src/analyzer/__tests__/patch-deal-state.spec.ts
git commit -m "feat(analyzer): add PATCH /saved/:id/state as the autosave target

Narrow by design: autosave writes the working state only. result_snapshot
is the published share artifact and market_context is the restore source,
so accepting either here would let a keystroke mutate a link already in a
client's hands."
```

---

### Task 6: Frontend fetcher for autosave

**Files:**

- Modify: `packages/frontend/lib/data/fetchers/analyzer.ts`
- Modify: `packages/frontend/lib/data/index.ts` (export the new fetcher)
- Test: `packages/frontend/lib/data/fetchers/__tests__/patch-deal-state.test.ts`

**Interfaces:**

- Consumes: the `PATCH` route from Task 5.
- Produces: `patchDealState(id: string, inputSnapshot: Record<string, unknown>): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/lib/data/fetchers/__tests__/patch-deal-state.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { patchDealState } from "../analyzer";

vi.mock("../auth-headers", () => ({
  getAuthHeaders: async () => ({ Authorization: "Bearer t" }),
}));

describe("patchDealState", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PATCHes the state-only route with the snapshot", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
    });

    await patchDealState("row-1", { v: 2, price: 300000 });

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(String(url)).toContain("/api/analyzer/saved/row-1/state");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      input_snapshot: { v: 2, price: 300000 },
    });
  });

  it("throws on a non-ok response so the caller can surface a retry", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    });
    await expect(patchDealState("row-1", { v: 2 })).rejects.toThrow("404");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run lib/data/fetchers/__tests__/patch-deal-state.test.ts`
Expected: FAIL — `patchDealState is not a function`

- [ ] **Step 3: Add the fetcher**

Append to `packages/frontend/lib/data/fetchers/analyzer.ts`, matching the existing `saveAnalysis` shape (`analyzer.ts:184-196`). Confirm the auth-header import path used by `saveAnalysis` in that file and reuse it verbatim — the test mock above must match it.

```ts
/**
 * Autosave the working state of a saved deal.
 *
 * Writes `input_snapshot` and nothing else. Never returns a share token —
 * autosave deliberately does not publish, so a link already distributed to
 * a client keeps resolving to the version its owner chose to share.
 */
export async function patchDealState(
  id: string,
  inputSnapshot: Record<string, unknown>,
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/saved/${id}/state`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ input_snapshot: inputSnapshot }),
  });
  if (!res.ok) throw new Error(`autosave failed: ${res.status}`);
}
```

- [ ] **Step 4: Export it from the data layer barrel**

Add `patchDealState` to the analyzer re-exports in `packages/frontend/lib/data/index.ts`. CLAUDE.md §5 requires consumers import from `@/lib/data`, never the fetcher path directly.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run lib/data/fetchers/__tests__/patch-deal-state.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/lib/data/fetchers/analyzer.ts \
        packages/frontend/lib/data/index.ts \
        packages/frontend/lib/data/fetchers/__tests__/patch-deal-state.test.ts
git commit -m "feat(analyzer): add patchDealState fetcher for autosave"
```

---

### Task 7: Hydrate useAnalyzerState from a saved deal

**Files:**

- Modify: `packages/frontend/app/(app)/analyzer/lib/use-analyzer-state.ts:46-78,155-171`
- Modify: `packages/frontend/app/(app)/analyzer/lib/use-analyzer-state.provenance.ts` (add `initialState` to `AnalyzerStateOptions`)
- Test: `packages/frontend/app/(app)/analyzer/lib/__tests__/use-analyzer-state.hydration.test.ts`

**Interfaces:**

- Consumes: `DealStateV2` (Task 2).
- Produces: `useAnalyzerState({ isPro, initialState?, ... })`. When `initialState` is present every `useState` seeds from it and the `?address=` auto-fetch is suppressed.

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/app/(app)/analyzer/lib/__tests__/use-analyzer-state.hydration.test.ts
import { describe, it, expect, vi } from "vitest";
import { shouldAutoFetchProperty } from "../use-analyzer-state";

describe("shouldAutoFetchProperty gates the RentCast lookup on open", () => {
  const base = {
    isPro: true,
    address: "123 Main St, Austin TX",
    paramAddress: "123 Main St, Austin TX",
    alreadyFetched: false,
    isHydrated: false,
  };

  it("fetches for a Pro user deep-linked with ?address=", () => {
    expect(shouldAutoFetchProperty(base)).toBe(true);
  });

  it("does NOT fetch when hydrating a saved deal — RentCast is paid and quota-limited", () => {
    expect(shouldAutoFetchProperty({ ...base, isHydrated: true })).toBe(false);
  });

  it("does not fetch twice", () => {
    expect(shouldAutoFetchProperty({ ...base, alreadyFetched: true })).toBe(
      false,
    );
  });

  it("does not fetch for a free user", () => {
    expect(shouldAutoFetchProperty({ ...base, isPro: false })).toBe(false);
  });

  it("does not fetch without an ?address= param", () => {
    expect(shouldAutoFetchProperty({ ...base, paramAddress: undefined })).toBe(
      false,
    );
  });

  it("does not fetch on a too-short address", () => {
    expect(shouldAutoFetchProperty({ ...base, address: "abc" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/lib/__tests__/use-analyzer-state.hydration.test.ts"`
Expected: FAIL — `shouldAutoFetchProperty is not a function`

- [ ] **Step 3: Extract and export the auto-fetch guard**

Add to `use-analyzer-state.ts`, replacing the inline condition currently at :161-166:

```ts
/**
 * Whether to fire the RentCast lookup automatically on mount.
 *
 * A hydrated saved deal must NOT auto-fetch: RentCast is a paid,
 * quota-limited third-party lookup, and opening a saved deal is a page view.
 * The saved parcel echo renders instead, and the existing "Fetch property"
 * button remains the user's explicit refresh.
 */
export function shouldAutoFetchProperty(args: {
  isPro: boolean;
  address: string;
  paramAddress?: string;
  alreadyFetched: boolean;
  isHydrated: boolean;
}): boolean {
  if (args.alreadyFetched || args.isHydrated) return false;
  return (
    args.isPro && args.address.trim().length > 5 && Boolean(args.paramAddress)
  );
}
```

- [ ] **Step 4: Seed the state from initialState**

Add `initialState?: DealStateV2` to `AnalyzerStateOptions` in `use-analyzer-state.provenance.ts`, then seed each initializer in `useAnalyzerState`:

```ts
export function useAnalyzerState({
  isPro, initialAddress = "", paramAddress, paramZip, initialState,
}: AnalyzerStateOptions) {
  const analyzer = useAnalyzer(
    initialState?.input ?? {
      price: 0, rentMonthly: null, taxAnnual: null, insuranceAnnual: null,
    },
  );

  const [address, setAddress] = useState(initialState?.address ?? initialAddress);
  const [selectedZip, setSelectedZip] = useState<string | null>(
    initialState?.selectedZip ?? null,
  );
  const [arvLocal, setArvLocal] = useState<number>(initialState?.arvLocal ?? 0);
  const [rehabBudget, setRehabBudget] = useState<number>(
    initialState?.rehabBudget ?? 45_000,
  );
  const [propertyType, setPropertyType] = useState<"sfh" | "mf">(
    initialState?.propertyType ?? "sfh",
  );
  const [unitCount, setUnitCount] = useState<number | null>(
    initialState?.unitCount ?? 1,
  );
  const [assumptions, setAssumptionsState] = useState<AnalyzerAssumptions>(
    initialState?.assumptions ?? DEFAULT_ASSUMPTIONS,
  );
  const [provenance, setProvenance] = useState<ProvenanceMap>(
    initialState?.provenance ?? {},
  );
  // …unchanged below…
```

Then replace the auto-fetch effect body at :160-171 with the guard:

```ts
useEffect(() => {
  if (
    !shouldAutoFetchProperty({
      isPro,
      address,
      paramAddress,
      alreadyFetched: autoFetchedRef.current,
      isHydrated: Boolean(initialState),
    })
  )
    return;
  autoFetchedRef.current = true;
  mutate({ address: address.trim() });
}, [isPro, address, paramAddress, mutate, initialState]);
```

Finally extend the hook's return object. `selectedZip` is currently internal state and is **not**
returned — Task 11 needs it to build the deal state, so add it along with the two new fields:

```ts
return {
  // …every existing field, unchanged…
  selectedZip, // NEW — was internal only
  isHydrated: Boolean(initialState), // NEW
  marketCapturedAt: initialState?.marketCapturedAt ?? null, // NEW
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer"`
Expected: PASS — 6 new tests plus all pre-existing analyzer tests.

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/lib/use-analyzer-state.ts" \
        "packages/frontend/app/(app)/analyzer/lib/use-analyzer-state.provenance.ts" \
        "packages/frontend/app/(app)/analyzer/lib/__tests__/use-analyzer-state.hydration.test.ts"
git commit -m "feat(analyzer): hydrate useAnalyzerState from a saved deal

Seeds every field from DealStateV2 and suppresses the ?address= RentCast
auto-fetch when hydrated — RentCast is paid and quota-limited, and opening
a saved deal is a page view."
```

---

### Task 8: Autosave hook

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/lib/use-deal-autosave.ts`
- Test: `packages/frontend/app/(app)/analyzer/lib/__tests__/use-deal-autosave.test.ts`

**Interfaces:**

- Consumes: `patchDealState` (Task 6), `DealStateV2` (Task 2).
- Produces: `useDealAutosave({ dealId, state, enabled }): { status: SaveStatus; retry: () => void }` where `type SaveStatus = "idle" | "saving" | "saved" | "error"`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/app/(app)/analyzer/lib/__tests__/use-deal-autosave.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useDealAutosave,
  AUTOSAVE_DEBOUNCE_MS,
  MAX_CONSECUTIVE_FAILURES,
} from "../use-deal-autosave";

const patchDealState = vi.fn();
vi.mock("@/lib/data", () => ({
  patchDealState: (...a: unknown[]) => patchDealState(...a),
}));

const STATE = { v: 2, input: { price: 300000 } } as never;

describe("useDealAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    patchDealState.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not save on the initial render — hydration is not an edit", () => {
    renderHook(() =>
      useDealAutosave({ dealId: "row-1", state: STATE, enabled: true }),
    );
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 3);
    });
    expect(patchDealState).not.toHaveBeenCalled();
  });

  it("does not save when there is no row yet", () => {
    const { rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: null, state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );
    rerender({ s: { ...STATE, input: { price: 310000 } } as never });
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    expect(patchDealState).not.toHaveBeenCalled();
  });

  it("debounces a burst of edits into one request", () => {
    const { rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: "row-1", state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );
    for (const price of [310000, 320000, 330000]) {
      rerender({ s: { ...STATE, input: { price } } as never });
      act(() => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS / 4);
      });
    }
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(patchDealState).toHaveBeenCalledTimes(1);
    expect(patchDealState.mock.calls[0][1].input.price).toBe(330000);
  });

  it("reports saved after a successful write", async () => {
    const { result, rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: "row-1", state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );
    rerender({ s: { ...STATE, input: { price: 310000 } } as never });
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    await waitFor(() => expect(result.current.status).toBe("saved"));
  });

  it("reports error and stops after MAX_CONSECUTIVE_FAILURES", async () => {
    patchDealState.mockRejectedValue(new Error("500"));
    const { result, rerender } = renderHook(
      ({ s }) => useDealAutosave({ dealId: "row-1", state: s, enabled: true }),
      { initialProps: { s: STATE } },
    );
    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES + 2; i++) {
      rerender({ s: { ...STATE, input: { price: 300000 + i } } as never });
      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      });
    }
    expect(result.current.status).toBe("error");
    expect(patchDealState.mock.calls.length).toBeLessThanOrEqual(
      MAX_CONSECUTIVE_FAILURES,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/lib/__tests__/use-deal-autosave.test.ts"`
Expected: FAIL — `Failed to resolve import "../use-deal-autosave"`

- [ ] **Step 3: Implement the hook**

```ts
// packages/frontend/app/(app)/analyzer/lib/use-deal-autosave.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { patchDealState } from "@/lib/data";
import type { DealStateV2 } from "./deal-state-types";

export const AUTOSAVE_DEBOUNCE_MS = 2000;
/** Stop retrying after this many consecutive failures. A dead endpoint must
 *  not be hammered once per edit for the rest of the session. */
export const MAX_CONSECUTIVE_FAILURES = 3;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Autosave the working state of an already-saved deal.
 *
 * Three rules, each of which is a bug if broken:
 *   1. Never fires on the first render. Hydrating a saved deal sets state,
 *      which would otherwise trigger a write on every page open.
 *   2. Never fires without a `dealId`. A brand-new analysis needs one
 *      explicit save to materialize a row, or every slider fiddle spawns one.
 *   3. Writes state ONLY, via patchDealState. It must never reach the save
 *      path that pre-awaits AI narratives — that would fire an LLM batch
 *      call every couple of seconds.
 */
export function useDealAutosave({
  dealId,
  state,
  enabled,
}: {
  dealId: string | null;
  state: DealStateV2;
  enabled: boolean;
}): { status: SaveStatus; retry: () => void } {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const failuresRef = useRef(0);
  const isFirstRenderRef = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  const flush = useCallback(async () => {
    if (!dealId) return;
    setStatus("saving");
    try {
      await patchDealState(
        dealId,
        stateRef.current as unknown as Record<string, unknown>,
      );
      failuresRef.current = 0;
      setStatus("saved");
    } catch {
      failuresRef.current += 1;
      setStatus("error");
    }
  }, [dealId]);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!enabled || !dealId) return;
    if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) return;

    const t = setTimeout(() => {
      void flush();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state, enabled, dealId, flush]);

  const retry = useCallback(() => {
    failuresRef.current = 0;
    void flush();
  }, [flush]);

  return { status, retry };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/lib/__tests__/use-deal-autosave.test.ts"`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/lib/use-deal-autosave.ts" \
        "packages/frontend/app/(app)/analyzer/lib/__tests__/use-deal-autosave.test.ts"
git commit -m "feat(analyzer): add debounced autosave for saved deals

Never fires on first render (hydration is not an edit), never without a
dealId (or every slider fiddle spawns a row), and writes state only —
routing it through the share-save path would fire an LLM batch call every
couple of seconds."
```

---

### Task 9: Save button

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/components/chrome/SaveButton.tsx`
- Modify: `packages/frontend/app/(app)/analyzer/components/chrome/AnalyzerHeaderActions.tsx:208-213`
- Test: `packages/frontend/app/(app)/analyzer/components/chrome/__tests__/SaveButton.test.tsx`

**Interfaces:**

- Consumes: `SaveStatus` (Task 8).
- Produces: `<SaveButton status={SaveStatus} hasRow={boolean} onClick={() => void} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/analyzer/components/chrome/__tests__/SaveButton.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SaveButton } from "../SaveButton";

// NOTE: `@testing-library/user-event` is NOT a dependency of this repo — only
// `@testing-library/jest-dom` and `@testing-library/react` are installed. Use
// `fireEvent`, which is the established idiom here (see
// app/(app)/activate/__tests__/page.success-links.test.tsx).

describe("SaveButton reports its own save state", () => {
  it("invites the first save when no row exists", () => {
    render(<SaveButton status="idle" hasRow={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /save deal/i })).toBeEnabled();
  });

  it("shows Saving while a write is in flight and blocks re-entry", () => {
    render(<SaveButton status="saving" hasRow onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("confirms Saved once clean", () => {
    render(<SaveButton status="saved" hasRow onClick={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /^saved$/i }),
    ).toBeInTheDocument();
  });

  it("surfaces a retry on failure — a silent autosave failure loses work", () => {
    render(<SaveButton status="error" hasRow onClick={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /retry save/i });
    expect(btn).toBeEnabled();
  });

  it("calls onClick when actionable", async () => {
    const onClick = vi.fn();
    render(<SaveButton status="error" hasRow onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: /retry save/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick while saving", async () => {
    const onClick = vi.fn();
    render(<SaveButton status="saving" hasRow onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: /saving/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/components/chrome/__tests__/SaveButton.test.tsx"`
Expected: FAIL — `Failed to resolve import "../SaveButton"`

- [ ] **Step 3: Implement**

Match the M3 pill treatment used by `ShareButton`/`PdfButton` in the same directory — read one first and reuse its class names rather than inventing new ones.

```tsx
// packages/frontend/app/(app)/analyzer/components/chrome/SaveButton.tsx
"use client";

import { Bookmark, Check, Loader2, RotateCcw } from "lucide-react";
import type { SaveStatus } from "../../lib/use-deal-autosave";

/**
 * The save affordance AND the save indicator.
 *
 * The error state is the point: autosave failing silently is the classic
 * way this feature loses a user's work, so a failure has to surface on the
 * control the user already watches, not only in a modal they may never open.
 */
export function SaveButton({
  status,
  hasRow,
  onClick,
}: {
  status: SaveStatus;
  hasRow: boolean;
  onClick: () => void;
}) {
  const saving = status === "saving";
  const error = status === "error";
  const clean = status === "saved" && hasRow;

  const label = saving
    ? "Saving…"
    : error
      ? "Retry save"
      : clean
        ? "Saved"
        : hasRow
          ? "Saved"
          : "Save deal";

  const Icon = saving ? Loader2 : error ? RotateCcw : clean ? Check : Bookmark;

  return (
    <button
      type="button"
      onClick={saving ? undefined : onClick}
      disabled={saving}
      aria-live="polite"
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-4 h-10 text-sm font-medium",
        "transition-colors duration-200 disabled:cursor-not-allowed",
        error
          ? "bg-error-container text-on-error-container"
          : clean
            ? "bg-surface-container text-on-surface-variant"
            : "bg-primary-container text-on-primary-container hover:bg-primary-container/80",
      ].join(" ")}
    >
      <Icon className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}
```

- [ ] **Step 4: Mount it beside PDF and Share**

In `AnalyzerHeaderActions.tsx`, replace the button row at :210-213:

```tsx
<div className="flex items-center gap-2">
  <SaveButton
    status={saveStatus}
    hasRow={Boolean(dealId)}
    onClick={onSaveClick}
  />
  <PdfButton onClick={handlePdfClick} loading={pdfInProgress} />
  <ShareButton onClick={handleShareClick} />
</div>
```

Add `dealId: string | null`, `saveStatus: SaveStatus` and `onSaveClick: () => void` to the component's `Props` interface, and thread them from `AnalyzerHeader` (which already forwards `state`/`grading`/etc. from `AnalyzerClient`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/components/chrome"`
Expected: PASS — 6 new tests plus the pre-existing `AnalyzerHeaderActions.saved-list-refresh` test.

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/components/chrome/SaveButton.tsx" \
        "packages/frontend/app/(app)/analyzer/components/chrome/__tests__/SaveButton.test.tsx" \
        "packages/frontend/app/(app)/analyzer/components/chrome/AnalyzerHeaderActions.tsx"
git commit -m "feat(analyzer): add a Save button that reports its own state

Saving was previously a side effect of Share or PDF — there was no way to
deliberately save a deal. The error state surfaces on the control the user
already watches, because a silent autosave failure loses work."
```

---

### Task 10: Stale deal notice

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/components/cards/StaleDealNotice.tsx`
- Test: `packages/frontend/app/(app)/analyzer/components/cards/__tests__/StaleDealNotice.test.tsx`

**Interfaces:**

- Consumes: `getDealStaleness` (Task 4).
- Produces: `<StaleDealNotice marketCapturedAt={string | null} onRefresh={() => void} isRefreshing={boolean} />`. Renders nothing when not stale.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/analyzer/components/cards/__tests__/StaleDealNotice.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaleDealNotice } from "../StaleDealNotice";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe("StaleDealNotice", () => {
  it("renders nothing for a fresh deal", () => {
    const { container } = render(
      <StaleDealNotice
        marketCapturedAt={daysAgo(3)}
        onRefresh={vi.fn()}
        isRefreshing={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the deal was never saved", () => {
    const { container } = render(
      <StaleDealNotice
        marketCapturedAt={null}
        onRefresh={vi.fn()}
        isRefreshing={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("states the real age past the threshold", () => {
    render(
      <StaleDealNotice
        marketCapturedAt={daysAgo(74)}
        onRefresh={vi.fn()}
        isRefreshing={false}
      />,
    );
    expect(screen.getByText(/74 days old/i)).toBeInTheDocument();
  });

  it("offers a refresh the user can trigger", async () => {
    const onRefresh = vi.fn();
    render(
      <StaleDealNotice
        marketCapturedAt={daysAgo(74)}
        onRefresh={onRefresh}
        isRefreshing={false}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /update market data/i }),
    );
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("never uses quality words for the market (CLAUDE.md §9)", () => {
    render(
      <StaleDealNotice
        marketCapturedAt={daysAgo(74)}
        onRefresh={vi.fn()}
        isRefreshing={false}
      />,
    );
    const text = document.body.textContent ?? "";
    for (const banned of [
      "excellent",
      "good",
      "poor",
      "bad",
      "worse",
      "better",
    ]) {
      expect(text.toLowerCase()).not.toContain(banned);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/components/cards/__tests__/StaleDealNotice.test.tsx"`
Expected: FAIL — `Failed to resolve import "../StaleDealNotice"`

- [ ] **Step 3: Implement**

```tsx
// packages/frontend/app/(app)/analyzer/components/cards/StaleDealNotice.tsx
"use client";

import { Clock, Loader2 } from "lucide-react";
import { getDealStaleness } from "../../lib/deal-staleness";

/**
 * Offers a refresh when a reopened deal's market data has aged past the
 * threshold. Deliberately says only that the data is OLD — it makes no claim
 * about which way the market moved, because it has not compared anything.
 *
 * Copy is momentum-neutral per CLAUDE.md §9: a PIQ move is timing, never a
 * quality verdict, so this must never imply the market got "worse".
 */
export function StaleDealNotice({
  marketCapturedAt,
  onRefresh,
  isRefreshing,
}: {
  marketCapturedAt: string | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  if (!marketCapturedAt) return null;
  const { stale, days } = getDealStaleness(marketCapturedAt);
  if (!stale) return null;

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
      <Clock className="h-4 w-4 shrink-0 text-on-surface-variant" />
      <p className="min-w-0 flex-1 text-sm text-on-surface">
        This analysis is {days} days old. Market data may have changed since you
        saved it — your own numbers are unchanged.
      </p>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-4 h-9 text-sm font-medium text-on-primary-container transition-colors duration-200 hover:bg-primary-container/80 disabled:cursor-not-allowed"
      >
        {isRefreshing && <Loader2 className="h-4 w-4 animate-spin" />}
        Update market data
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/components/cards/__tests__/StaleDealNotice.test.tsx"`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/components/cards/StaleDealNotice.tsx" \
        "packages/frontend/app/(app)/analyzer/components/cards/__tests__/StaleDealNotice.test.tsx"
git commit -m "feat(analyzer): notify when a reopened deal's market data is stale

Says only that the data is old — it makes no claim about direction, because
it has compared nothing. Momentum-neutral copy per CLAUDE.md section 9."
```

---

### Task 11: Open a saved deal in the editable analyzer

The integration task: `/analyzer/saved/[id]` stops rendering a read-only report and renders the hydrated analyzer.

**Files:**

- Modify: `packages/frontend/app/(app)/analyzer/saved/[id]/page.tsx`
- Create: `packages/frontend/app/(app)/analyzer/saved/[id]/SavedDealLoader.tsx`
- Modify: `packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx`
- Delete: `packages/frontend/app/(app)/analyzer/saved/[id]/SavedClient.tsx`
- Delete: `packages/frontend/app/(app)/analyzer/saved/[id]/__tests__/SavedClient.ai-wiring.test.tsx`
- Test: `packages/frontend/app/(app)/analyzer/saved/[id]/__tests__/SavedDealLoader.test.tsx`

**Interfaces:**

- Consumes: `migrateDealState` (T3), `useDealAutosave` (T8), `SaveButton` (T9), `StaleDealNotice` (T10), `initialState` on `useAnalyzerState` (T7).
- Produces: `AnalyzerClient` accepts `initialState?: DealStateV2` and `dealId?: string`.

**⚠ Do NOT delete `lib/saved-render-builders.ts`.** It is shared — `app/(app)/shared/analysis/[token]/ReadonlyAnalyticsPage.tsx:22` imports `extractMarketContextProps` from it. Only `SavedClient`'s own imports become unused.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/analyzer/saved/[id]/__tests__/SavedDealLoader.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SavedDealLoader from "../SavedDealLoader";

const useSavedAnalysis = vi.fn();
vi.mock("@/lib/analyzer/useSavedAnalysis", () => ({
  useSavedAnalysis: (id: string) => useSavedAnalysis(id),
}));
vi.mock("../../../AnalyzerClient", () => ({
  default: ({
    dealId,
    initialState,
  }: {
    dealId?: string;
    initialState?: { label?: string };
  }) => (
    <div
      data-testid="analyzer"
      data-deal-id={dealId}
      data-label={initialState?.label ?? ""}
    />
  ),
}));

const ROW = {
  id: "row-1",
  label: "Duplex deal",
  address_full: "1 A St",
  address_city: "Austin",
  address_state: "TX",
  address_zip: "78701",
  updated_at: "2026-05-01T00:00:00.000Z",
  input_snapshot: { price: 250000 },
  result_snapshot: {},
  market_context: null,
};

describe("SavedDealLoader hands a hydrated state to the editable analyzer", () => {
  beforeEach(() => useSavedAnalysis.mockReset());

  it("shows a loading state while fetching", () => {
    useSavedAnalysis.mockReturnValue({ data: undefined, isLoading: true });
    render(<SavedDealLoader id="row-1" />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows not-found with a way back when the row is missing", () => {
    useSavedAnalysis.mockReturnValue({ data: null, isLoading: false });
    render(<SavedDealLoader id="row-9" />);
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to analyzer/i }),
    ).toHaveAttribute("href", "/analyzer");
  });

  it("renders the editable analyzer seeded from the migrated row", () => {
    useSavedAnalysis.mockReturnValue({ data: ROW, isLoading: false });
    render(<SavedDealLoader id="row-1" />);
    const el = screen.getByTestId("analyzer");
    expect(el).toHaveAttribute("data-deal-id", "row-1");
    expect(el).toHaveAttribute("data-label", "Duplex deal");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer/saved"`
Expected: FAIL — `Failed to resolve import "../SavedDealLoader"`

- [ ] **Step 3: Write the loader**

```tsx
// packages/frontend/app/(app)/analyzer/saved/[id]/SavedDealLoader.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSavedAnalysis } from "@/lib/analyzer/useSavedAnalysis";
import { migrateDealState } from "../../lib/migrate-snapshot";
import AnalyzerClient from "../../AnalyzerClient";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-12 text-center text-on-surface-variant">
      {children}
      <Link
        href="/analyzer"
        className="mt-4 inline-block text-primary hover:underline"
      >
        ← Back to Analyzer
      </Link>
    </div>
  );
}

/**
 * Loads a saved deal and hands it to the LIVE analyzer as seed state.
 *
 * Replaces the previous read-only report: opening a saved deal now means
 * resuming work on it. The client-facing report still exists at
 * /shared/analysis/[token].
 */
export default function SavedDealLoader({ id }: { id: string }) {
  const { data: row, isLoading } = useSavedAnalysis(id);
  const initialState = useMemo(
    () => (row ? migrateDealState(row) : null),
    [row],
  );

  if (isLoading)
    return (
      <Shell>
        <p>Loading…</p>
      </Shell>
    );
  if (!row || !initialState)
    return (
      <Shell>
        <p>Not found.</p>
      </Shell>
    );

  return (
    <AnalyzerClient
      dealId={id}
      initialState={initialState}
      searchParamsPromise={Promise.resolve({})}
    />
  );
}
```

- [ ] **Step 4: Point the route at it and delete the read-only view**

```tsx
// packages/frontend/app/(app)/analyzer/saved/[id]/page.tsx
import SavedDealLoader from "./SavedDealLoader";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SavedDealLoader id={id} />;
}
```

```bash
git rm "packages/frontend/app/(app)/analyzer/saved/[id]/SavedClient.tsx" \
       "packages/frontend/app/(app)/analyzer/saved/[id]/__tests__/SavedClient.ai-wiring.test.tsx"
```

- [ ] **Step 5: Wire the pieces into AnalyzerClient**

Extend the props and thread the new state through. `buildDealState` is called on every render so autosave sees a fresh object; it is a plain mapping, so this is cheap.

```tsx
export default function AnalyzerClient({
  searchParamsPromise,
  dealId: initialDealId,
  initialState,
}: {
  searchParamsPromise: Promise<{ address?: string; zip?: string }>;
  dealId?: string;
  initialState?: DealStateV2;
}) {
  // …existing body…
  const state = useAnalyzerState({
    isPro,
    initialAddress: params.address ?? "",
    paramAddress: params.address,
    paramZip: params.zip,
    initialState,
  });

  const [dealId, setDealId] = useState<string | null>(initialDealId ?? null);

  const dealState = buildDealState({
    input: analyzer.input, address, selectedZip: state.selectedZip ?? null,
    label: initialState?.label ?? null, arvLocal, rehabBudget,
    propertyType: state.propertyType, unitCount: state.unitCount, assumptions,
    analysisMode, activeGoalAtSave: activeGoal,
    thresholds: presetLabel === "Custom"
      ? (savedThresholdsQ.data as AnyStrategyThresholds | undefined)
      : undefined,
    provenance: state.provenance,
    rentcastEcho: rentcastData?.property_record
      ? {
          city: rentcastData.property_record.city ?? null,
          state: rentcastData.property_record.state ?? null,
          zip: rentcastData.property_record.zip ?? null,
          avmValue: rentcastData.avm?.value ?? null,
        }
      : (initialState?.rentcastEcho ?? null),
    piqByGeo,
    notes: notesState.notes,
    shareNotes: notesState.shareNotes,
    marketCapturedAt: initialState?.marketCapturedAt ?? new Date().toISOString(),
  });

  const autosave = useDealAutosave({ dealId, state: dealState, enabled: isPro });
```

Render `<StaleDealNotice marketCapturedAt={initialState?.marketCapturedAt ?? null} onRefresh={…} isRefreshing={state.marketContextLoading} />` immediately after `<MarketScoreStrip />` (currently :245), and pass `dealId`, `autosave.status` and a save handler down through `AnalyzerHeader` to `AnalyzerHeaderActions`.

**Where the save click is handled.** `AnalyzerHeaderActions` already owns `saveSnapshot()` and
already receives `{ id, share_token }` back from `saveAnalysis` (it currently keeps only the
token, `AnalyzerHeaderActions.tsx:129`). Keep the flow there rather than lifting it — the parent
only needs to learn the id. Add one callback prop:

```tsx
// AnalyzerHeaderActions Props — add:
  /** Fired with the row id after any successful save, so the parent can hold
   *  `dealId` and let autosave take over. */
  onSaved?: (id: string) => void;
  /** Autosave status, rendered by SaveButton. */
  saveStatus: SaveStatus;
  /** True once a row exists — flips SaveButton from "Save deal" to a status. */
  hasRow: boolean;
  /** Retry handler for a failed autosave. */
  onRetryAutosave: () => void;
```

Inside `saveSnapshot()`, after `setShareToken(result.share_token)` at :129, add:

```tsx
onSavedRef.current?.(result.id);
```

(using a live ref alongside the existing `stateRef`/`derivedRef` pattern at :75-82, so the
callback identity cannot go stale).

The SaveButton's own click handler, also inside `AnalyzerHeaderActions`:

```tsx
const handleSaveClick = useCallback(async () => {
  if (saveStatus === "error") {
    onRetryAutosave();
    return;
  }
  if (!isPro) {
    emitAnalyzerEvent("analyzer_share_anonymous_signin_prompt_shown");
    setSaveError("Sign in with a Pro account to save this analysis.");
    setModalOpen(true);
    return;
  }
  await saveSnapshot();
}, [saveStatus, onRetryAutosave, isPro, saveSnapshot]);
```

In `AnalyzerClient`, the parent side is then just:

```tsx
<AnalyzerHeader
  /* …existing props… */
  onSaved={setDealId}
  saveStatus={autosave.status}
  hasRow={Boolean(dealId)}
  onRetryAutosave={autosave.retry}
/>
```

`AnalyzerHeader` forwards all four straight through to `AnalyzerHeaderActions` — it is already a
pass-through for `state`, `grading`, `compsView` and the rest.

- [ ] **Step 6: Verify the whole surface**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer"`
Expected: PASS — all analyzer tests including the 3 new loader tests.

Run: `cd packages/frontend && npx vitest run "app/(app)/shared"`
Expected: PASS — the share view is untouched and `saved-render-builders` still resolves.

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no errors.

Run: `wc -l "app/(app)/analyzer/AnalyzerClient.tsx"`
Expected: under 400 (CLAUDE.md §1.3). If over, extract the `buildDealState` call into `lib/use-current-deal-state.ts`.

- [ ] **Step 7: Manual verification against live data**

Start the dev servers, then in the browser:

1. Analyze a property, click **Save deal** → button reads `Saved`, row appears in Saved analyses.
2. Change the price → button flips to `Saving…` then `Saved` within ~2s.
3. Reload `/analyzer/saved/<id>` → every input, assumption and note is exactly as left; the input panel is editable.
4. Open DevTools Network on that reload → **no RentCast lookup fires**.
5. Click **Share**, copy the link, then edit the price and let autosave run → reopen the share link and confirm the shared report still shows the pre-edit numbers.

- [ ] **Step 8: Commit**

```bash
git add -A "packages/frontend/app/(app)/analyzer"
git commit -m "feat(analyzer): open a saved deal in the editable analyzer

/analyzer/saved/[id] rendered a read-only report, so a saved deal could be
looked at but never resumed. It now hydrates the live analyzer from the
saved DealStateV2 and wires up the Save button, autosave and the staleness
notice. The client-facing report remains at /shared/analysis/[token].

saved-render-builders is deliberately kept — ReadonlyAnalyticsPage imports
extractMarketContextProps from it."
```

---

### Task 12: Id-keyed saves and a nameable deal

Covers spec §7.2, §8 (address collision) and §5.3 (label). Without this, editing a saved deal's
address and pressing Save creates a **second row** instead of renaming the first — the
address-keyed upsert has no idea it is looking at an already-open deal.

**Files:**

- Modify: `packages/backend/src/analyzer/dto/analysis-snapshot.dto.ts`
- Modify: `packages/backend/src/analyzer/analyzer.persistence.service.ts:39-59`
- Modify: `packages/frontend/lib/data/fetchers/analyzer.ts` (`SaveAnalysisPayload`)
- Modify: `packages/frontend/app/(app)/analyzer/lib/build-analyzer-snapshot.ts:111-126`
- Create: `packages/frontend/app/(app)/analyzer/components/chrome/DealLabelField.tsx`
- Test: `packages/backend/src/analyzer/__tests__/save-by-id.spec.ts`
- Test: `packages/frontend/app/(app)/analyzer/components/chrome/__tests__/DealLabelField.test.tsx`

**Interfaces:**

- Consumes: `dealId` from Task 11.
- Produces: `AnalysisSnapshotDto.id?: string`; `buildAnalyzerSnapshot(state, derived, extras, opts?: { id?: string; label?: string | null })`.

- [ ] **Step 1: Write the failing backend test**

```ts
// packages/backend/src/analyzer/__tests__/save-by-id.spec.ts
import { ConflictException } from "@nestjs/common";
import { AnalyzerPersistenceService } from "../analyzer.persistence.service";

function mockSupabase(updateResult: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown>[] = [];
  const chain = {
    update: (p: Record<string, unknown>) => {
      calls.push({ update: p });
      return chain;
    },
    insert: (p: Record<string, unknown>) => {
      calls.push({ insert: p });
      return chain;
    },
    select: () => chain,
    eq: (c: string, v: string) => {
      calls.push({ eq: [c, v] });
      return chain;
    },
    maybeSingle: () => Promise.resolve(updateResult),
    single: () => Promise.resolve(updateResult),
  };
  return { client: { from: () => chain } as never, calls };
}

const DTO = {
  address_full: "2 New St",
  address_city: "Austin",
  address_state: "TX",
  input_snapshot: { v: 2 },
  result_snapshot: {},
} as never;

describe("AnalyzerPersistenceService.save with an id", () => {
  it("updates that row directly instead of looking up by address", async () => {
    const { client, calls } = mockSupabase({
      data: { id: "row-1", share_token: "tok" },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.save("owner-1", { ...DTO, id: "row-1" });

    const eqs = calls.filter((c) => "eq" in c).map((c) => c.eq);
    expect(eqs).toContainEqual(["id", "row-1"]);
    expect(eqs).toContainEqual(["owner_id", "owner-1"]);
    expect(calls.some((c) => "insert" in c)).toBe(false);
  });

  it("never writes the client-supplied id into the row", async () => {
    const { client, calls } = mockSupabase({
      data: { id: "row-1", share_token: "tok" },
      error: null,
    });
    const svc = new AnalyzerPersistenceService(client);

    await svc.save("owner-1", { ...DTO, id: "row-1" });

    const update = calls.find((c) => "update" in c)?.update as Record<
      string,
      unknown
    >;
    expect(update).not.toHaveProperty("id");
    expect(update).not.toHaveProperty("owner_id");
  });

  it("raises 409 when renaming onto an address the owner already saved", async () => {
    const { client } = mockSupabase({
      data: null,
      error: { code: "23505", message: "dup" },
    });
    const svc = new AnalyzerPersistenceService(client);

    await expect(
      svc.save("owner-1", { ...DTO, id: "row-1" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/analyzer/__tests__/save-by-id.spec.ts`
Expected: FAIL — the address lookup path runs and no `eq('id', …)` is recorded.

- [ ] **Step 3: Add `id` to the DTO**

```ts
  /**
   * Existing row to update. Present when the client has an open saved deal;
   * absent for a first save. When set, the row is updated BY ID and the
   * `(owner_id, address_full)` upsert key is bypassed — otherwise editing a
   * saved deal's address would create a second row rather than rename it.
   *
   * Always re-scoped by `owner_id` server-side; a client-supplied id can
   * never reach another owner's row.
   */
  @IsOptional()
  @IsUUID()
  id?: string;
```

Import `IsUUID` alongside the existing `class-validator` imports.

- [ ] **Step 4: Branch save() on the id and map 23505 to 409**

```ts
  async save(ownerId: string, dto: AnalysisSnapshotDto) {
    const { id: targetId, ...fields } = dto;

    // An open saved deal updates in place by id. Going through the address
    // lookup here would create a second row the moment the user corrects a
    // street address on a deal they already saved.
    if (targetId) return this.updateExisting(ownerId, targetId, fields as AnalysisSnapshotDto);

    const existing = await this.findExisting(ownerId, dto.address_full);
    if (existing) return this.updateExisting(ownerId, existing.id, fields as AnalysisSnapshotDto);
    // …existing insert path, unchanged…
  }
```

And in `updateExisting`, translate the unique violation instead of leaking a raw Postgres error:

```ts
if (error) {
  if (error.code === "23505") {
    throw new ConflictException(
      "You already have a saved analysis for that address.",
    );
  }
  throw new Error(`save update failed: ${error.message}`);
}
if (!data) throw new NotFoundException("analysis not found");
return data;
```

`updateExisting` must switch `.single()` → `.maybeSingle()` so a non-matching id yields `null`
rather than a throw, letting the `NotFoundException` above fire. Import `ConflictException` and
`NotFoundException` from `@nestjs/common`.

- [ ] **Step 5: Run backend tests**

Run: `cd packages/backend && npx jest src/analyzer`
Expected: PASS — 3 new tests plus the existing `save-and-share` suite.

- [ ] **Step 6: Thread id and label through the frontend save payload**

In `lib/data/fetchers/analyzer.ts`, add `id?: string` to `SaveAnalysisPayload`.

In `build-analyzer-snapshot.ts`, extend the signature and stop hardcoding `label: null` (:112):

```ts
export function buildAnalyzerSnapshot(
  state: AnalyzerSnapshotState,
  derived: AnalyzerSnapshotDerived,
  extras: AnalyzerSnapshotExtras = {},
  opts: { id?: string; label?: string | null } = {},
): SaveAnalysisPayload {
  // …unchanged body…
  return {
    ...(opts.id ? { id: opts.id } : {}),
    label: opts.label ?? null,
    // …rest unchanged…
  };
}
```

In `AnalyzerHeaderActions`, pass `{ id: dealId ?? undefined, label }` as the fourth argument at
the `buildAnalyzerSnapshot(...)` call (:127).

- [ ] **Step 7: Write the failing label-field test**

```tsx
// packages/frontend/app/(app)/analyzer/components/chrome/__tests__/DealLabelField.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DealLabelField } from "../DealLabelField";

describe("DealLabelField", () => {
  it("falls back to the address when the deal is unnamed", () => {
    render(
      <DealLabelField label={null} fallback="123 Main St" onChange={vi.fn()} />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      "123 Main St",
    );
  });

  it("shows the saved label when present", () => {
    render(
      <DealLabelField
        label="Duplex deal"
        fallback="123 Main St"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Duplex deal");
  });

  it("reports edits so autosave can pick them up", async () => {
    const onChange = vi.fn();
    render(
      <DealLabelField label="" fallback="123 Main St" onChange={onChange} />,
    );
    await userEvent.type(screen.getByRole("textbox"), "Flip");
    expect(onChange).toHaveBeenLastCalledWith("Flip");
  });

  it("caps the label at the DTO limit of 120 characters", async () => {
    const onChange = vi.fn();
    render(<DealLabelField label="" fallback="x" onChange={onChange} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("maxLength", "120");
  });
});
```

- [ ] **Step 8: Implement the label field**

```tsx
// packages/frontend/app/(app)/analyzer/components/chrome/DealLabelField.tsx
"use client";

/**
 * Inline rename for a saved deal.
 *
 * `label` was hardcoded null before this, so every saved analysis was
 * identified only by its address — unusable once an investor is comparing
 * two scenarios on the same street. maxLength matches AnalysisSnapshotDto's
 * @MaxLength(120) so the field cannot compose a payload the API rejects.
 */
export function DealLabelField({
  label,
  fallback,
  onChange,
}: {
  label: string | null;
  fallback: string;
  onChange: (next: string) => void;
}) {
  return (
    <input
      type="text"
      value={label ?? ""}
      placeholder={fallback}
      maxLength={120}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Deal name"
      className="w-full max-w-md rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-medium text-on-surface transition-colors duration-200 hover:border-outline-variant focus:border-primary focus:outline-none"
    />
  );
}
```

Render it in `AnalyzerHeader` in place of the static heading **only when `dealId` is set** — an
unsaved analysis has nothing to name yet. Hold `label` in `AnalyzerClient` state seeded from
`initialState?.label`, and feed it into `buildDealState` so autosave persists renames.

- [ ] **Step 9: Run all tests**

Run: `cd packages/frontend && npx vitest run "app/(app)/analyzer" && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 10: Commit**

```bash
git add packages/backend/src/analyzer packages/frontend/lib/data/fetchers/analyzer.ts \
        "packages/frontend/app/(app)/analyzer"
git commit -m "feat(analyzer): key saves by id and let users name a deal

Editing a saved deal's address and pressing Save created a SECOND row — the
address-keyed upsert had no idea it was looking at an already-open deal. An
optional id on the save payload updates in place instead, re-scoped by
owner server-side. A rename onto an address the owner already saved now
returns 409 rather than leaking a raw Postgres unique violation.

label was hardcoded null, so saved analyses were identified only by their
address. It is now editable inline on a saved deal."
```

---

## Verification Checklist

Run before considering the feature done:

- [ ] `cd packages/frontend && npx tsc --noEmit` — clean
- [ ] `cd packages/backend && npx tsc --noEmit` — clean (plain tsc; `nest build` excludes specs)
- [ ] `cd packages/frontend && npx vitest run "app/(app)/analyzer" "app/(app)/shared" "lib/data"` — green
- [ ] `cd packages/backend && npx jest src/analyzer` — green
- [ ] No file exceeds CLAUDE.md §1.3 limits — check `AnalyzerClient.tsx`, `use-analyzer-state.ts`, `migrate-snapshot.ts`
- [ ] A legacy (pre-v2) saved deal opens without crashing and recovers its assumptions and notes
- [ ] Autosave never calls `fetchBatchedAiInsights` — grep the autosave path
- [ ] `localStorage["analyzer.investorGoal"]` is unchanged after opening a saved deal (spec §4.6)
- [ ] Editing a saved deal's address and pressing Save **renames that row** — it does not create a
      second one. Confirm the saved-analyses count is unchanged.
- [ ] Renaming a deal onto an address already saved by the same owner returns a readable 409, not
      a raw Postgres `23505`.
