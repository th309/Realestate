# CalculatedMetricsService Refactor — Design Spec

**Date:** 2026-06-15
**Status:** Approved design, pending spec review
**Scope:** Structural refactor of `packages/backend/src/metrics/calculated-metrics.service.ts` (3,928 lines) to meet CLAUDE.md §1.3 file-size limits.
**Rule #1:** Do not break any functionality. All behavior must be retained.

---

## 1. Goal & Constraints

`calculated-metrics.service.ts` is a single `@Injectable()` god class of 3,928 lines — ~13x over CLAUDE.md's 300-line hard limit for logic files. It does six distinct jobs. This refactor splits it into focused modules **without changing any logic and without changing the public API consumers depend on.**

**Hard constraints:**

- **No behavior change.** Method bodies move verbatim (byte-for-byte). The only edits to logic are: (a) `this.<formula>()` → imported function call, (b) `this.<otherService>()` → injected-service call, (c) `this.PAGE_SIZE`/`this.AFF*` → imported constant or local field. Nothing else.
- **No consumer changes.** `metrics.controller.ts` (~30 call sites), `scripts/refresh-calculated-metrics.ts`, and any other importer keep calling the same `CalculatedMetricsService` methods with the same signatures.
- **No merging of per-geo pipelines.** The metro/county/zip calculators stay separate methods even though they look similar — merging them would be a logic change and a behavioral risk.

**Stance on the size limit (pragmatic, per user):** Clean responsibility split first (verbatim bodies) → geo-tier sibling-file splits → internal private-helper extraction **only** where a single method exceeds the limit _and_ the extraction is low-risk and obvious. Where compliance would require risky intra-method surgery, leave the file slightly over with a documented exception comment rather than gamble on behavior.

---

## 2. Current State

### 2.1 Responsibilities (the six seams)

| #   | Responsibility         | Key methods                                                                                                                                                                                                                                                                                                                      | Lines (approx.)              | DB? |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --- |
| 1   | **Pure formulas**      | `calculateCapRate`, `calculateGrossYield`, `calculateRentToPriceRatio`, `calculateGRM`, `calculateMonthsOfSupply`, `calculateAbsorptionRate`, `calculate5YearCagr`, `calculateInventorySurplus`, `calculateOvervalued`, `calculateMarketHealthScore`, `calculateInvestmentScore`, `calculateLongTermGrowthScore`, `calculateAll` | 61–362 (~300)                | No  |
| 2   | **Persistence**        | `storeMetrics`, `getMetrics`, `getMetricsForMap`                                                                                                                                                                                                                                                                                 | 363–499 (~140)               | Yes |
| 3   | **5-Year Growth**      | `calculate5YrGrowthFor{Metros,States,Counties,Zips,National,All}`, `get5YrGrowthForMap`                                                                                                                                                                                                                                          | 505–1196 (~690)              | Yes |
| 4   | **Investment metrics** | `fetchRealtorMosInputs`, `calculateInvestmentMetricsFor{Metros,Counties,Zips}`, `getInvestmentMetricsForMap`, `calculateAllInvestmentMetrics`, `refreshAllCalculatedMetrics`                                                                                                                                                     | 1197–3053 (~1,750)           | Yes |
| 5   | **Affordability**      | `AFF*` config, `affIncomeToBuy`/`affAffordableHomePrice`/`affYearsToSave`, `affFetchMortgageRate`, `affUpsertBatch`, `aff*ForGeo`, `calculateAllAffordabilityMetrics`                                                                                                                                                            | 3054–3601 (~550)             | Yes |
| 6   | **Overvalued (geo)**   | `calculateOvervaluedForMetros` (currently in the investment block, 1729–1858), `calculateOvervaluedFor{Counties,Zips}`, `upsertOvervalued`                                                                                                                                                                                       | 1729–1858 + 3602–3928 (~450) | Yes |

### 2.2 Internal coupling (from the `this.*` call graph)

- **Pure formulas are the shared foundation.** Every investment calculator calls `calculateCapRate/GrossYield/RentToPrice/GRM/MonthsOfSupply/AbsorptionRate` (~8 sites each); all three overvalued methods call `calculateOvervalued`; `calculateAll` calls all twelve. → Formulas must be importable by every pipeline.
- **`PAGE_SIZE`** (field, line 500) is used by persistence, 5yr, and investment pagination loops. → Shared constant.
- **`AFF*` config + `affIncomeToBuy/affAffordableHomePrice/affYearsToSave`** are used _only_ by affordability. → Stay local to the affordability service.
- **Overvalued is one concern split across the file:** `calculateOvervaluedForMetros` (1729, physically inside the investment block) shares the private `upsertOvervalued` (3874) with the county (3602) and zip (3740) overvalued methods. → Consolidate the three + helper into one service.
- **`fetchRealtorMosInputs`** (private, 1197) is called only by the three investment calculators. → Lives inside the investment service.
- **`calculateAllInvestmentMetrics`** (2946) calls the three investment calculators **and** the three overvalued methods. → Investment orchestrator depends on the overvalued service.
- **`refreshAllCalculatedMetrics`** (3003) calls `calculateAllInvestmentMetrics` + `calculate5YrGrowthForAll` + `calculateAllAffordabilityMetrics`. → It is the master orchestrator; it stays on the facade.

### 2.3 Public API contract (must be preserved exactly)

- **`metrics.controller.ts`** → `getInvestmentMetricsForMap` (~20 sites), `getMetrics`, `calculateAllInvestmentMetrics`, `calculate5YrGrowthFor{All,Metros,States,Counties,Zips,National}`, `get5YrGrowthForMap`.
- **`scripts/refresh-calculated-metrics.ts`** → `app.get(CalculatedMetricsService).refreshAllCalculatedMetrics(year)`.
- **`metrics.module.ts`** → provides + exports `CalculatedMetricsService`.
- **Unit tests** (`__tests__/months-of-supply-proxy.spec.ts`, `__tests__/overvalued-geo.spec.ts`) → construct `new CalculatedMetricsService({} as any)` (single arg) and call pure `calculateMonthsOfSupply`/`calculateAbsorptionRate`/`calculateOvervalued`, plus the **private** `fetchRealtorMosInputs` via `(svc as any)`. These are the only callers that block a multi-arg facade constructor, so the tests get repointed (see §6).

---

## 3. Target Architecture

A **facade** preserves the public API; implementation moves into focused, DI-wired sub-services; pure math becomes a standalone function module.

```
metrics/
  calculated-metrics.types.ts          # CalculatedMetricsInput / CalculatedMetricsOutput
  metric-formulas.ts                    # PURE exported functions: the 12 calcs + calculateAll (+ EXPENSE_RATIO, PRICE_TO_INCOME_BENCHMARK)
  metric-pagination.constants.ts        # PAGE_SIZE
  calculated-metrics.service.ts         # FACADE: injects sub-services, delegates, hosts refreshAllCalculatedMetrics
  pipelines/
    metrics-persistence.service.ts      # storeMetrics, getMetrics, getMetricsForMap
    five-year-growth.service.ts         # orchestrator (calculate5YrGrowthForAll, get5YrGrowthForMap) + injected calculators
    five-year-growth-*.service.ts       # per-geo-tier calculators (split to land <300; boundaries finalized in plan)
    investment-metrics.service.ts       # orchestrator (calculateAllInvestmentMetrics, getInvestmentMetricsForMap) + fetchRealtorMosInputs + injected calculators
    investment-metrics-*.service.ts     # per-geo calculators (metros/counties/zips — each ~480–505 lines; documented exceptions unless cheap helper extraction lands them <300)
    affordability-metrics.service.ts    # AFF config + aff* methods + calculateAllAffordabilityMetrics (split config/pipeline to land <300)
    overvalued-metrics.service.ts       # calculateOvervaluedFor{Metros,Counties,Zips} + upsertOvervalued (split if needed)
```

### 3.1 Module dependency graph

```
metric-formulas.ts (pure)  ◄── imported by all pipelines
metric-pagination.constants.ts (PAGE_SIZE) ◄── persistence, 5yr, investment

MetricsPersistenceService      → supabase
FiveYearGrowthService          → supabase (self-contained)
OvervaluedMetricsService       → supabase, formulas
InvestmentMetricsService       → supabase, formulas, OvervaluedMetricsService
AffordabilityMetricsService    → supabase (self-contained; own sub-formulas + config)

CalculatedMetricsService (facade)
  → injects: Persistence, FiveYearGrowth, Investment, Affordability, Overvalued
  → delegates public methods; hosts refreshAllCalculatedMetrics orchestration
```

No cycles: the facade depends on everything; investment depends on overvalued; nothing depends back on the facade.

### 3.2 The facade contract

`CalculatedMetricsService` retains exactly the methods consumers call, each a one-line delegate to the owning sub-service:

- `getInvestmentMetricsForMap(...)` → `investment.getInvestmentMetricsForMap(...)`
- `calculateAllInvestmentMetrics(year)` → `investment.calculateAllInvestmentMetrics(year)`
- `getMetrics(...)` / `storeMetrics(...)` / `getMetricsForMap(...)` → `persistence.*`
- `calculate5YrGrowthFor{All,Metros,States,Counties,Zips,National}(...)` / `get5YrGrowthForMap(...)` → `fiveYear.*`
- `refreshAllCalculatedMetrics(year)` → orchestrates `investment.calculateAllInvestmentMetrics` + `fiveYear.calculate5YrGrowthForAll` + `affordability.calculateAllAffordabilityMetrics` (body moved verbatim from current method).

Pure formula methods (`calculateCapRate`, etc.) are **not** called by the controller or script — only by `calculateAll` (internal) and the two tests. They do not need to remain on the facade; tests repoint to `metric-formulas.ts`. (If a stray external caller surfaces during implementation, the facade re-exposes them as thin delegates — zero cost.)

---

## 4. Secondary splits (to land oversized services <300)

Top-level split alone leaves 5yr (~690) and investment (~1,750) over. Pragmatic plan:

- **5-Year Growth (~690):** orchestrator file (`calculate5YrGrowthForAll` + `get5YrGrowthForMap`, ~110) + per-geo-tier calculator file(s). Candidate split: aggregate (states ~97 + national ~93), metro (~172), granular (counties ~119 + zips ~119). All land <300. Exact grouping finalized in the plan.
- **Investment (~1,750):** orchestrator file (`calculateAllInvestmentMetrics` ~56 + `getInvestmentMetricsForMap` ~88 + `fetchRealtorMosInputs` ~49) + one file per geo calculator (`...-metros` ~481, `...-counties` ~491, `...-zips` ~505). Each per-geo calculator is a **single cohesive method that exceeds 300 on its own** → attempt cheap helper extraction (e.g. pull the per-region compute loop into a private method); if not low-risk, leave as a documented exception. This is the explicit pragmatic carve-out.
- **Affordability (~550):** split config (`AFF*`, ~91) into a constants file; service keeps sub-formulas + `aff*ForGeo` pipelines + orchestrator. Likely lands one file near/under 300.
- **Overvalued (~450):** three independent ~130-line methods + ~54-line helper → split into two files (e.g. metros+counties / zips+helper) if needed to clear 300.

`refreshAllCalculatedMetrics` orchestration stays on the facade (the script calls it there; it ties three pipelines together).

---

## 5. DI / module wiring

`metrics.module.ts` registers every new sub-service as a provider; continues to provide + export `CalculatedMetricsService`. The CLI module in `scripts/refresh-calculated-metrics.ts` resolves `CalculatedMetricsService` from the same module, so as long as the providers are registered, `app.get(CalculatedMetricsService)` still resolves and `refreshAllCalculatedMetrics` works unchanged. Sub-services are constructor-injected (`@Inject(SUPABASE_CLIENT)` where they touch the DB).

---

## 6. Test strategy (repointing + safety net)

- **`overvalued-geo.spec.ts`** → import `calculateOvervalued` from `metric-formulas.ts`, call it directly. Assertions unchanged.
- **`months-of-supply-proxy.spec.ts`** → `calculateMonthsOfSupply`/`calculateAbsorptionRate` from `metric-formulas.ts`; the `fetchRealtorMosInputs` null-skip regression targets the **InvestmentMetricsService** (`new InvestmentMetricsService(fakeSupabase as any)`, call `(svc as any).fetchRealtorMosInputs('metro')`). The fake-supabase stub and assertions move verbatim.
- **New:** add focused unit tests for the remaining extracted formulas (cap rate, gross yield, GRM, CAGR, inventory surplus, the three scores) — this is where extraction risk concentrates and the tests are cheap and mock-free (pure functions).

---

## 7. Verification (proving no behavior change)

1. **`nest build` clean** — the compiler catches every severed `this.`/import/DI binding. Zero errors before claiming done.
2. **Unit tests green** — repointed existing tests + new formula tests.
3. **Smoke run** — execute `refresh-calculated-metrics.ts` (or a single geo-tier calculator) against the real DB and diff computed output against a pre-refactor snapshot of the same rows. Live data only, no mocks for the pipeline check.

---

## 8. Non-goals

- No logic/algorithm changes; no formula tweaks; no SQL changes.
- No merging or de-duplication of the per-geo pipeline methods (separate by design here).
- No changes to `metrics.controller.ts` behavior or routes.
- No touching unrelated metrics code (`InventorySurplusService`, scoring, etc.).
- No new metrics, no new endpoints.

---

## 9. Risks & mitigations

| Risk                                            | Mitigation                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Severed `this.` reference after a move          | Verbatim bodies + `nest build` gate; the call-graph map in §2.2 is the checklist.               |
| DI not registered → runtime resolution failure  | Register all providers in `metrics.module.ts`; smoke-run the CLI script (which uses `app.get`). |
| Private `fetchRealtorMosInputs` test breaks     | Repoint to `InvestmentMetricsService` (§6).                                                     |
| Giant per-geo method can't hit <300 safely      | Documented exception comment; do not perform risky intra-method surgery (pragmatic stance).     |
| Hidden external caller of a pure formula method | Facade re-exposes formula delegates if grep finds one during implementation.                    |
