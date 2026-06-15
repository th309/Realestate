# CalculatedMetricsService Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 3,928-line `calculated-metrics.service.ts` god class into a thin facade plus focused sub-services and a pure-functions module, with zero behavior change and zero consumer-code change.

**Architecture:** `CalculatedMetricsService` becomes a thin `@Injectable()` facade that delegates to constructor-injected sub-services (`MetricsPersistenceService`, `FiveYearGrowthService`, `InvestmentMetricsService`, `AffordabilityMetricsService`, `OvervaluedMetricsService`). Pure math moves to a standalone `metric-formulas.ts` function module imported by every pipeline. Method bodies move **verbatim** — the only logic edits are rebinding `this.<formula>` → imported function, `this.<otherService>` → injected service, and `this.PAGE_SIZE` → imported constant.

**Tech Stack:** NestJS 11, TypeScript, Jest, Supabase client (DI token `SUPABASE_CLIENT`).

**Design spec:** `docs/superpowers/specs/2026-06-15-calculated-metrics-service-refactor-design.md`

---

## Ground Rules (apply to EVERY task)

1. **Move verbatim.** When a step says "move method X", cut the existing body and paste it unchanged. Do NOT retype or "improve" it. The only allowed edits are the explicit rebind lists in each task.
2. **Build is the gate.** After every task: `cd packages/backend && npm run build` must finish with **zero** TypeScript errors before committing. The compiler is what catches a severed `this.` reference.
3. **Tests stay green.** After every task: `cd packages/backend && npx jest src/metrics/__tests__` must pass.
4. **No consumer edits** to `metrics.controller.ts` or `scripts/refresh-calculated-metrics.ts`. The facade preserves their API. (`metrics.module.ts` is updated to register new providers — that is expected.)
5. **Branch:** work on `develop`. Commit after each task. Do NOT push (the user pushes).
6. **Verify branch before each commit:** `git branch --show-current` → expect `develop`.
7. **Stage explicitly.** `git add <exact files>` — never `git add .` (the repo has many untracked files).

**Line references** (e.g. `lines 1247–1728`) are the pre-refactor positions and will drift as earlier tasks shrink the file. Locate methods by **name**, not line number, when they have moved.

---

## Task 1: Extract the type interfaces

**Files:**

- Create: `packages/backend/src/metrics/calculated-metrics.types.ts`
- Modify: `packages/backend/src/metrics/calculated-metrics.service.ts` (lines 6–47, the two `export interface` blocks)

- [ ] **Step 1: Create the types file**

```typescript
// packages/backend/src/metrics/calculated-metrics.types.ts
export interface CalculatedMetricsInput {
  geography_id: string;
  geography_type: string;
  geography_name?: string;
  period_date: string;
  // From Realtor
  median_listing_price?: number;
  active_listing_count?: number;
  median_days_on_market?: number;
  price_reduced_share?: number;
  pending_ratio?: number;
  pending_listing_count?: number;
  new_listing_count?: number;
  // From Zillow
  zori?: number;
  zhvi?: number;
  // Historical for CAGR
  listing_price_5yr_ago?: number;
  inventory_5yr_avg?: number;
  // For overvalued
  median_income?: number;
  // For months of supply
  monthly_sales?: number;
}

export interface CalculatedMetricsOutput {
  cap_rate: number | null;
  gross_yield: number | null;
  rent_to_price_ratio: number | null;
  grm: number | null;
  months_of_supply: number | null;
  absorption_rate: number | null;
  market_health_score: number | null;
  investment_score: number | null;
  long_term_growth_score: number | null;
  home_value_5yr_cagr: number | null;
  zhvi_3y_cagr: number | null;
  zori_yoy: number | null;
  zori_5y_cagr: number | null;
  inventory_surplus_pct: number | null;
  overvalued_pct: number | null;
}
```

(Copy the field bodies verbatim from the current `calculated-metrics.service.ts` lines 6–47 to guarantee byte-identical types.)

- [ ] **Step 2: Replace the interface definitions in the service with an import + re-export**

In `calculated-metrics.service.ts`, delete the two `export interface` blocks (lines 6–47) and add near the top (after the existing imports):

```typescript
import {
  CalculatedMetricsInput,
  CalculatedMetricsOutput,
} from "./calculated-metrics.types";

// Back-compat: keep these importable from the service path.
export type { CalculatedMetricsInput, CalculatedMetricsOutput };
```

- [ ] **Step 3: Build**

Run: `cd packages/backend && npm run build`
Expected: zero errors.

- [ ] **Step 4: Tests**

Run: `cd packages/backend && npx jest src/metrics/__tests__`
Expected: all pass (unchanged).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # expect: develop
git add packages/backend/src/metrics/calculated-metrics.types.ts packages/backend/src/metrics/calculated-metrics.service.ts
git commit -m "refactor(metrics): extract CalculatedMetrics types into calculated-metrics.types.ts"
```

---

## Task 2: Extract pure formulas into `metric-formulas.ts` (keystone)

**Files:**

- Create: `packages/backend/src/metrics/metric-formulas.ts`
- Modify: `packages/backend/src/metrics/calculated-metrics.service.ts` (remove the 13 methods + 2 constant fields; rebind remaining callers)
- Modify: `packages/backend/src/metrics/__tests__/overvalued-geo.spec.ts`
- Modify: `packages/backend/src/metrics/__tests__/months-of-supply-proxy.spec.ts`
- Create: `packages/backend/src/metrics/__tests__/metric-formulas.spec.ts`

The pure methods to move (verbatim bodies, converting `this.EXPENSE_RATIO`/`this.PRICE_TO_INCOME_BENCHMARK` to module constants, and inside `calculateAll` converting `this.calculateX(` → `calculateX(`):
`calculateCapRate`, `calculateGrossYield`, `calculateRentToPriceRatio`, `calculateGRM`, `calculateMonthsOfSupply`, `calculateAbsorptionRate`, `calculate5YearCagr`, `calculateInventorySurplus`, `calculateOvervalued`, `calculateMarketHealthScore`, `calculateInvestmentScore`, `calculateLongTermGrowthScore`, `calculateAll`.

- [ ] **Step 1: Create the formulas module**

Create `packages/backend/src/metrics/metric-formulas.ts` with module-level constants and one exported function per current method. Signatures (paste the current method bodies verbatim into each):

```typescript
// packages/backend/src/metrics/metric-formulas.ts
import {
  CalculatedMetricsInput,
  CalculatedMetricsOutput,
} from "./calculated-metrics.types";

const EXPENSE_RATIO = 0.6; // 60% NOI for cap rate calculation
const PRICE_TO_INCOME_BENCHMARK = 3.5; // Traditional affordability benchmark

export function calculateCapRate(
  zori: number | undefined,
  price: number | undefined,
): number | null {
  if (!zori || !price || price === 0) return null;
  return ((zori * 12 * EXPENSE_RATIO) / price) * 100;
}

export function calculateGrossYield(
  zori: number | undefined,
  price: number | undefined,
): number | null {
  if (!zori || !price || price === 0) return null;
  return ((zori * 12) / price) * 100;
}

export function calculateRentToPriceRatio(
  zori: number | undefined,
  price: number | undefined,
): number | null {
  if (!zori || !price || price === 0) return null;
  return zori / price;
}

export function calculateGRM(
  price: number | undefined,
  zori: number | undefined,
): number | null {
  if (!price || !zori || zori === 0) return null;
  const annualRent = zori * 12;
  return price / annualRent;
}

export function calculateMonthsOfSupply(
  inventory: number | undefined,
  monthlySales: number | undefined,
): number | null {
  if (!inventory || !monthlySales || monthlySales === 0) return null;
  return inventory / monthlySales;
}

export function calculateAbsorptionRate(
  monthlySales: number | undefined,
  inventory: number | undefined,
): number | null {
  if (!monthlySales || !inventory || inventory === 0) return null;
  return (monthlySales / inventory) * 100;
}

export function calculate5YearCagr(
  current: number | undefined,
  past: number | undefined,
): number | null {
  if (!current || !past || past === 0) return null;
  return Math.pow(current / past, 1 / 5) - 1;
}

export function calculateInventorySurplus(
  current: number | undefined,
  avg: number | undefined,
): number | null {
  if (!current || !avg) return null;
  return current - avg;
}

export function calculateOvervalued(
  price: number | undefined,
  income: number | undefined,
): number | null {
  if (!price || !income || income === 0) return null;
  const priceToIncome = price / income;
  return (
    ((priceToIncome - PRICE_TO_INCOME_BENCHMARK) / PRICE_TO_INCOME_BENCHMARK) *
    100
  );
}

export function calculateMarketHealthScore(
  dom: number | undefined,
  inventoryYoy: number | undefined,
  priceCutShare: number | undefined,
  pendingRatio: number | undefined,
): number | null {
  // ... paste verbatim from current calculateMarketHealthScore body (lines 182–221) ...
}

export function calculateInvestmentScore(
  capRate: number | null,
  grossYield: number | null,
  rentGrowth?: number,
): number | null {
  // ... paste verbatim from current calculateInvestmentScore body (lines 233–258) ...
}

export function calculateLongTermGrowthScore(
  cagr5yr: number | null,
  priceYoy: number | undefined,
): number | null {
  // ... paste verbatim from current calculateLongTermGrowthScore body (lines 269–287) ...
}

export function calculateAll(
  input: CalculatedMetricsInput,
): CalculatedMetricsOutput {
  // paste verbatim from current calculateAll body (lines 294–357),
  // changing every `this.calculateX(` → `calculateX(`
}
```

> **Note:** The `// ... paste verbatim ...` markers above mean: copy the exact existing body from `calculated-metrics.service.ts`. Do not rewrite the logic. `calculateMarketHealthScore`/`calculateInvestmentScore`/`calculateLongTermGrowthScore` use no `this.` references, so they paste unchanged. `calculateAll` is the only one needing `this.` → bare-call edits.

- [ ] **Step 2: Add formula unit tests**

Create `packages/backend/src/metrics/__tests__/metric-formulas.spec.ts`:

```typescript
import {
  calculateCapRate,
  calculateGrossYield,
  calculateGRM,
  calculate5YearCagr,
  calculateInventorySurplus,
  calculateOvervalued,
  calculateMonthsOfSupply,
  calculateAbsorptionRate,
  calculateMarketHealthScore,
  calculateInvestmentScore,
  calculateLongTermGrowthScore,
} from "../metric-formulas";

describe("metric-formulas pure functions", () => {
  it("calculateCapRate: (zori*12*0.6)/price*100", () => {
    expect(calculateCapRate(2000, 400000)).toBeCloseTo(3.6, 5);
    expect(calculateCapRate(0, 400000)).toBeNull();
    expect(calculateCapRate(2000, 0)).toBeNull();
  });

  it("calculateGrossYield: (zori*12)/price*100", () => {
    expect(calculateGrossYield(2000, 400000)).toBeCloseTo(6.0, 5);
    expect(calculateGrossYield(undefined, 400000)).toBeNull();
  });

  it("calculateGRM: price/(zori*12)", () => {
    expect(calculateGRM(480000, 2000)).toBeCloseTo(20, 5);
    expect(calculateGRM(480000, 0)).toBeNull();
  });

  it("calculate5YearCagr: (cur/past)^(1/5)-1", () => {
    expect(calculate5YearCagr(160000, 100000)).toBeCloseTo(
      Math.pow(1.6, 1 / 5) - 1,
      6,
    );
    expect(calculate5YearCagr(100000, 0)).toBeNull();
  });

  it("calculateInventorySurplus: current-avg", () => {
    expect(calculateInventorySurplus(1200, 1000)).toBe(200);
    expect(calculateInventorySurplus(undefined, 1000)).toBeNull();
  });

  it("calculateOvervalued: 0% at benchmark, +50% above", () => {
    expect(calculateOvervalued(350000, 100000)).toBeCloseTo(0, 5);
    expect(calculateOvervalued(525000, 100000)).toBeCloseTo(50, 5);
    expect(calculateOvervalued(350000, 0)).toBeNull();
  });

  it("calculateMonthsOfSupply + calculateAbsorptionRate", () => {
    expect(calculateMonthsOfSupply(600, 200)).toBeCloseTo(3.0, 5);
    expect(calculateMonthsOfSupply(600, 0)).toBeNull();
    expect(calculateAbsorptionRate(200, 600)).toBeCloseTo(33.33, 1);
  });

  it("score functions return null when no factors present", () => {
    expect(
      calculateMarketHealthScore(undefined, undefined, undefined, undefined),
    ).toBeNull();
    expect(calculateInvestmentScore(null, null)).toBeNull();
    expect(calculateLongTermGrowthScore(null, undefined)).toBeNull();
  });
});
```

- [ ] **Step 3: Run new formula tests against the NEW module (should pass immediately)**

Run: `cd packages/backend && npx jest src/metrics/__tests__/metric-formulas.spec.ts`
Expected: PASS (the module already contains the moved logic).

- [ ] **Step 4: Remove the moved methods + constants from the service and rebind callers**

In `calculated-metrics.service.ts`:

1. Delete the 13 methods listed above (lines 61–358) and the two fields `EXPENSE_RATIO` (line 51) and `PRICE_TO_INCOME_BENCHMARK` (line 52).
2. Add to the import block:

```typescript
import {
  calculateCapRate,
  calculateGrossYield,
  calculateRentToPriceRatio,
  calculateGRM,
  calculateMonthsOfSupply,
  calculateAbsorptionRate,
  calculateOvervalued,
} from "./metric-formulas";
```

3. In the remaining methods still in the file (the investment + overvalued blocks), replace every `this.calculateCapRate(` → `calculateCapRate(`, and likewise for `this.calculateGrossYield`, `this.calculateRentToPriceRatio`, `this.calculateGRM`, `this.calculateMonthsOfSupply`, `this.calculateAbsorptionRate`, `this.calculateOvervalued`. (These occur in `calculateInvestmentMetricsFor*`, `calculateOvervaluedFor*` — current lines 1435–1475, 1636–1691, 1817, 2055–2080, 2160–2193, 2359–2392, 2539–2564, 2650–2678, 2868–2901, 3705, 3839.)

> Tip: use an editor find-and-replace scoped to the file, one formula name at a time, then re-scan for any residual `this.calculate` referencing a moved formula.

- [ ] **Step 5: Repoint the two existing unit tests' formula assertions**

`__tests__/overvalued-geo.spec.ts` — replace the whole file with:

```typescript
import { calculateOvervalued } from "../metric-formulas";

describe("overvalued % formula", () => {
  it("0% at benchmark", () => {
    expect(calculateOvervalued(350000, 100000)).toBeCloseTo(0, 5);
  });
  it("+50% above benchmark", () => {
    expect(calculateOvervalued(525000, 100000)).toBeCloseTo(50, 5);
  });
  it("null on missing/zero income", () => {
    expect(calculateOvervalued(350000, 0)).toBeNull();
  });
  it("null on missing price", () => {
    expect(calculateOvervalued(0, 100000)).toBeNull();
  });
  it("null on undefined inputs", () => {
    expect(calculateOvervalued(undefined, undefined)).toBeNull();
  });
});
```

`__tests__/months-of-supply-proxy.spec.ts` — change ONLY the first `describe` block to use the formula module. Replace its top:

```typescript
import { CalculatedMetricsService } from "../calculated-metrics.service";
import {
  calculateMonthsOfSupply,
  calculateAbsorptionRate,
} from "../metric-formulas";

describe("months-of-supply Realtor proxy", () => {
  it("computes MOS = active / pending", () => {
    expect(calculateMonthsOfSupply(600, 200)).toBeCloseTo(3.0);
  });
  it("returns null when pending is missing or zero", () => {
    expect(calculateMonthsOfSupply(600, 0)).toBeNull();
    expect(calculateMonthsOfSupply(600, undefined)).toBeNull();
  });
  it("absorption is the reciprocal percentage", () => {
    expect(calculateAbsorptionRate(200, 600)).toBeCloseTo(33.33, 1);
  });
});
```

Leave the second `describe('fetchRealtorMosInputs null-skip regression', ...)` block UNCHANGED for now (it still uses `new CalculatedMetricsService(...)`; it gets repointed in Task 3 when `fetchRealtorMosInputs` moves). The `CalculatedMetricsService` import stays because that block still needs it.

- [ ] **Step 6: Build**

Run: `cd packages/backend && npm run build`
Expected: zero errors. (If you see `Property 'calculateX' does not exist`, you missed a `this.` → bare-call rebind in Step 4.)

- [ ] **Step 7: Tests**

Run: `cd packages/backend && npx jest src/metrics/__tests__`
Expected: all pass (formula spec + overvalued + MoS).

- [ ] **Step 8: Commit**

```bash
git branch --show-current   # expect: develop
git add packages/backend/src/metrics/metric-formulas.ts \
        packages/backend/src/metrics/calculated-metrics.service.ts \
        packages/backend/src/metrics/__tests__/metric-formulas.spec.ts \
        packages/backend/src/metrics/__tests__/overvalued-geo.spec.ts \
        packages/backend/src/metrics/__tests__/months-of-supply-proxy.spec.ts
git commit -m "refactor(metrics): extract pure formulas into metric-formulas.ts; repoint formula tests"
```

---

## Task 3: Extract InvestmentMetricsService (first injecting task; frees the MoS test)

**Why this order:** This is the first task that gives the facade an injected dependency, which turns its constructor multi-arg and would break `new CalculatedMetricsService({} as any)` in the MoS test. We move `fetchRealtorMosInputs` here and repoint that test in the SAME commit, so after this task **no test instantiates `CalculatedMetricsService` with a single arg.**

**Files:**

- Create: `packages/backend/src/metrics/metric-pagination.constants.ts`
- Create: `packages/backend/src/metrics/pipelines/investment-metrics.service.ts`
- Create: `packages/backend/src/metrics/pipelines/investment-metrics-metros.service.ts`
- Create: `packages/backend/src/metrics/pipelines/investment-metrics-counties.service.ts`
- Create: `packages/backend/src/metrics/pipelines/investment-metrics-zips.service.ts`
- Modify: `packages/backend/src/metrics/calculated-metrics.service.ts`
- Modify: `packages/backend/src/metrics/metrics.module.ts`
- Modify: `packages/backend/src/metrics/__tests__/months-of-supply-proxy.spec.ts`

**Methods moved into the investment services** (verbatim bodies; rebind `this.calculateX` → imported formula, `this.PAGE_SIZE` → imported `PAGE_SIZE`, `this.fetchRealtorMosInputs` → `this.fetchRealtorMosInputs` (stays on orchestrator), `this.calculateInvestmentMetricsForMetros` etc. → injected per-geo services):

- Orchestrator service: `fetchRealtorMosInputs` (1197–1246), `getInvestmentMetricsForMap` (1859–1947). (NOT `calculateAllInvestmentMetrics` yet — it stays in the facade until Task 4, because it also calls overvalued methods still in the facade.)
- Per-geo services: `calculateInvestmentMetricsForMetros` (1247–1728), `calculateInvestmentMetricsForCounties` (1948–2439), `calculateInvestmentMetricsForZips` (2440–2945).

- [ ] **Step 1: Create the pagination constant**

```typescript
// packages/backend/src/metrics/metric-pagination.constants.ts
/** Supabase PostgREST read window. Reads truncate at ~1000 rows. */
export const PAGE_SIZE = 1000;
```

- [ ] **Step 2: Create the three per-geo investment services**

Each is an `@Injectable()` that injects the Supabase client and imports formulas + `PAGE_SIZE`. Skeleton (repeat per geo, pasting the matching method verbatim):

```typescript
// packages/backend/src/metrics/pipelines/investment-metrics-metros.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.service";
import { normalizeZipKey, calculateCAGR } from "../../common/zip";
import { PAGE_SIZE } from "../metric-pagination.constants";
import {
  calculateCapRate,
  calculateGrossYield,
  calculateRentToPriceRatio,
  calculateGRM,
  calculateMonthsOfSupply,
  calculateAbsorptionRate,
} from "../metric-formulas";

@Injectable()
export class InvestmentMetricsMetrosService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // paste calculateInvestmentMetricsForMetros body verbatim;
  // rebind this.calculateX → calculateX, this.PAGE_SIZE → PAGE_SIZE.
  // It also calls this.fetchRealtorMosInputs — see Step 3 note.
  async calculateInvestmentMetricsForMetros(year?: number): Promise<{
    /* keep the exact return type from the original signature */
  }> {
    // ...
  }
}
```

> **`fetchRealtorMosInputs` dependency:** the three per-geo calculators call `this.fetchRealtorMosInputs(...)`. Keep one copy of `fetchRealtorMosInputs` as a **public** method on the orchestrator `InvestmentMetricsService`, and have each per-geo service inject the orchestrator? That creates a cycle (orchestrator → per-geo → orchestrator). To avoid the cycle, put `fetchRealtorMosInputs` in its OWN tiny provider:
>
> - Create `packages/backend/src/metrics/pipelines/realtor-mos-inputs.service.ts` exporting `RealtorMosInputsService` with the single public method `fetchRealtorMosInputs(geoLevel)` (body verbatim, `this.PAGE_SIZE` → `PAGE_SIZE`).
> - Each per-geo service injects `RealtorMosInputsService` and calls `this.mosInputs.fetchRealtorMosInputs(...)`.
> - The MoS regression test repoints to `RealtorMosInputsService` (Step 6).

Adjust Step 2 skeletons to inject `private readonly mosInputs: RealtorMosInputsService` and replace `this.fetchRealtorMosInputs(` → `this.mosInputs.fetchRealtorMosInputs(`. Create `realtor-mos-inputs.service.ts`:

```typescript
// packages/backend/src/metrics/pipelines/realtor-mos-inputs.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.service";
import { PAGE_SIZE } from "../metric-pagination.constants";

@Injectable()
export class RealtorMosInputsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // paste fetchRealtorMosInputs body verbatim (was private; now public).
  // rebind this.PAGE_SIZE → PAGE_SIZE.
  async fetchRealtorMosInputs(
    geoLevel: string,
  ): Promise<Map<string, { active: number; pending: number }>> {
    // ...
  }
}
```

- [ ] **Step 3: Create the investment orchestrator service**

```typescript
// packages/backend/src/metrics/pipelines/investment-metrics.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.service";
import { PAGE_SIZE } from "../metric-pagination.constants";
import { InvestmentMetricsMetrosService } from "./investment-metrics-metros.service";
import { InvestmentMetricsCountiesService } from "./investment-metrics-counties.service";
import { InvestmentMetricsZipsService } from "./investment-metrics-zips.service";

@Injectable()
export class InvestmentMetricsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly metros: InvestmentMetricsMetrosService,
    private readonly counties: InvestmentMetricsCountiesService,
    private readonly zips: InvestmentMetricsZipsService,
  ) {}

  // paste getInvestmentMetricsForMap body verbatim (rebind this.PAGE_SIZE → PAGE_SIZE).
  async getInvestmentMetricsForMap(/* exact original signature */) {
    // ...
  }

  // thin pass-throughs so the facade has a single investment entry point:
  calculateInvestmentMetricsForMetros(year?: number) {
    return this.metros.calculateInvestmentMetricsForMetros(year);
  }
  calculateInvestmentMetricsForCounties(year?: number) {
    return this.counties.calculateInvestmentMetricsForCounties(year);
  }
  calculateInvestmentMetricsForZips(year?: number) {
    return this.zips.calculateInvestmentMetricsForZips(year);
  }
}
```

- [ ] **Step 4: Update the facade to delegate + remove moved methods**

In `calculated-metrics.service.ts`:

1. Delete `fetchRealtorMosInputs`, `getInvestmentMetricsForMap`, `calculateInvestmentMetricsForMetros/Counties/Zips`, and the `PAGE_SIZE` field IF no remaining method uses it (the 5yr methods still do — so KEEP the `PAGE_SIZE` field for now).
2. Inject `InvestmentMetricsService` and add delegates:

```typescript
constructor(
  @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  private readonly investment: InvestmentMetricsService,
) {}

getInvestmentMetricsForMap = (...args: Parameters<InvestmentMetricsService['getInvestmentMetricsForMap']>) =>
  this.investment.getInvestmentMetricsForMap(...args);
calculateInvestmentMetricsForMetros = (year?: number) =>
  this.investment.calculateInvestmentMetricsForMetros(year);
calculateInvestmentMetricsForCounties = (year?: number) =>
  this.investment.calculateInvestmentMetricsForCounties(year);
calculateInvestmentMetricsForZips = (year?: number) =>
  this.investment.calculateInvestmentMetricsForZips(year);
```

> Use explicit method signatures matching the originals if the `Parameters<>` helper is awkward — the requirement is that the facade's public methods accept and return exactly what they did before. `calculateAllInvestmentMetrics` STAYS in the facade for now (it calls overvalued methods still in the facade); leave its body, but change its internal `this.calculateInvestmentMetricsForMetros(...)` calls to `this.investment.calculateInvestmentMetricsForMetros(...)`.

- [ ] **Step 5: Register providers in the module**

In `metrics.module.ts`, import and add to `providers`:

```typescript
import { RealtorMosInputsService } from './pipelines/realtor-mos-inputs.service';
import { InvestmentMetricsMetrosService } from './pipelines/investment-metrics-metros.service';
import { InvestmentMetricsCountiesService } from './pipelines/investment-metrics-counties.service';
import { InvestmentMetricsZipsService } from './pipelines/investment-metrics-zips.service';
import { InvestmentMetricsService } from './pipelines/investment-metrics.service';
// ...
providers: [
  CalculatedMetricsService,
  InventorySurplusService,
  RealtorMosInputsService,
  InvestmentMetricsMetrosService,
  InvestmentMetricsCountiesService,
  InvestmentMetricsZipsService,
  InvestmentMetricsService,
],
```

(No need to export the sub-services unless another module needs them; the facade stays exported.)

- [ ] **Step 6: Repoint the MoS regression test**

In `__tests__/months-of-supply-proxy.spec.ts`, change the second `describe` block to target `RealtorMosInputsService`. Replace `new CalculatedMetricsService(fakeSupabase as any)` with `new RealtorMosInputsService(fakeSupabase as any)` and `(svcWithFake as any).fetchRealtorMosInputs('metro')` with `svcWithFake.fetchRealtorMosInputs('metro')` (now public). Update the import:

```typescript
import { RealtorMosInputsService } from "../pipelines/realtor-mos-inputs.service";
```

Remove the now-unused `import { CalculatedMetricsService } ...` line. The fake-supabase stub and all assertions stay byte-identical.

- [ ] **Step 7: Build**

Run: `cd packages/backend && npm run build`
Expected: zero errors.

- [ ] **Step 8: Tests**

Run: `cd packages/backend && npx jest src/metrics/__tests__`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git branch --show-current   # expect: develop
git add packages/backend/src/metrics/metric-pagination.constants.ts \
        packages/backend/src/metrics/pipelines/ \
        packages/backend/src/metrics/calculated-metrics.service.ts \
        packages/backend/src/metrics/metrics.module.ts \
        packages/backend/src/metrics/__tests__/months-of-supply-proxy.spec.ts
git commit -m "refactor(metrics): extract InvestmentMetricsService (+ per-geo + MoS inputs); repoint MoS test"
```

---

## Task 4: Extract OvervaluedMetricsService + move the investment orchestrator into InvestmentMetricsService

**Files:**

- Create: `packages/backend/src/metrics/pipelines/overvalued-metrics.service.ts`
- Modify: `packages/backend/src/metrics/pipelines/investment-metrics.service.ts`
- Modify: `packages/backend/src/metrics/calculated-metrics.service.ts`
- Modify: `packages/backend/src/metrics/metrics.module.ts`

**Methods moved (verbatim, rebind `this.calculateOvervalued` → imported formula, `this.upsertOvervalued` stays internal):** `calculateOvervaluedForMetros` (1729–1858), `calculateOvervaluedForCounties` (3602–3739), `calculateOvervaluedForZips` (3740–3873), `upsertOvervalued` (3874–3928). Plus relocate `calculateAllInvestmentMetrics` (2946–3002) from the facade into `InvestmentMetricsService`.

- [ ] **Step 1: Create the overvalued service**

```typescript
// packages/backend/src/metrics/pipelines/overvalued-metrics.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.service";
import { normalizeZipKey } from "../../common/zip";
import { PAGE_SIZE } from "../metric-pagination.constants";
import { calculateOvervalued } from "../metric-formulas";

@Injectable()
export class OvervaluedMetricsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // paste calculateOvervaluedForMetros / ...ForCounties / ...ForZips verbatim
  // (rebind this.calculateOvervalued → calculateOvervalued, this.upsertOvervalued → this.upsertOvervalued).
  // paste upsertOvervalued verbatim (private). this.PAGE_SIZE → PAGE_SIZE where present.
}
```

> Check which imports each pasted body actually uses (`normalizeZipKey`, `PAGE_SIZE`, etc.) and include only those — remove unused imports so the build's `noUnusedLocals` (if on) stays clean.

- [ ] **Step 2: Move `calculateAllInvestmentMetrics` into `InvestmentMetricsService`**

Add to `InvestmentMetricsService`: inject `OvervaluedMetricsService` and paste `calculateAllInvestmentMetrics` body verbatim, rebinding `this.calculateInvestmentMetricsForMetros` → `this.metros.calculateInvestmentMetricsForMetros` (and counties/zips), and `this.calculateOvervaluedForMetros` → `this.overvalued.calculateOvervaluedForMetros` (and counties/zips).

```typescript
constructor(
  @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  private readonly metros: InvestmentMetricsMetrosService,
  private readonly counties: InvestmentMetricsCountiesService,
  private readonly zips: InvestmentMetricsZipsService,
  private readonly overvalued: OvervaluedMetricsService,
) {}

async calculateAllInvestmentMetrics(year?: number): Promise<{ /* exact original return type */ }> {
  // paste verbatim with the rebinds above
}
```

- [ ] **Step 3: Update the facade**

In `calculated-metrics.service.ts`: delete `calculateOvervaluedForMetros/Counties/Zips`, `upsertOvervalued`, and `calculateAllInvestmentMetrics`. Add a delegate:

```typescript
calculateAllInvestmentMetrics = (year?: number) =>
  this.investment.calculateAllInvestmentMetrics(year);
```

(`calculateOvervaluedFor*` and `upsertOvervalued` were never part of the consumer-facing API — controller/script don't call them — so they do not need facade delegates. Confirm with a repo grep: `\.(calculateOvervaluedForMetros|calculateOvervaluedForCounties|calculateOvervaluedForZips|upsertOvervalued)\(` returns only internal hits.)

- [ ] **Step 4: Register `OvervaluedMetricsService` in the module** (add to `providers`).

- [ ] **Step 5: Build** → `cd packages/backend && npm run build` → zero errors.

- [ ] **Step 6: Tests** → `cd packages/backend && npx jest src/metrics/__tests__` → all pass.

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # expect: develop
git add packages/backend/src/metrics/pipelines/overvalued-metrics.service.ts \
        packages/backend/src/metrics/pipelines/investment-metrics.service.ts \
        packages/backend/src/metrics/calculated-metrics.service.ts \
        packages/backend/src/metrics/metrics.module.ts
git commit -m "refactor(metrics): extract OvervaluedMetricsService; move investment orchestrator into InvestmentMetricsService"
```

---

## Task 5: Extract MetricsPersistenceService

**Files:**

- Create: `packages/backend/src/metrics/pipelines/metrics-persistence.service.ts`
- Modify: `packages/backend/src/metrics/calculated-metrics.service.ts`
- Modify: `packages/backend/src/metrics/metrics.module.ts`

**Methods moved (verbatim):** `storeMetrics` (363–388), `getMetrics` (389–464), `getMetricsForMap` (465–499). These use `this.supabase` and the types only — no formula/PAGE_SIZE dependency.

- [ ] **Step 1: Create the service**

```typescript
// packages/backend/src/metrics/pipelines/metrics-persistence.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.service";
import {
  CalculatedMetricsInput,
  CalculatedMetricsOutput,
} from "../calculated-metrics.types";

@Injectable()
export class MetricsPersistenceService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // paste storeMetrics, getMetrics, getMetricsForMap verbatim (this.supabase → this.supabase).
}
```

- [ ] **Step 2: Facade delegates**

In `calculated-metrics.service.ts`, delete the three methods, inject `MetricsPersistenceService`, add delegates:

```typescript
getMetrics = (...args: Parameters<MetricsPersistenceService["getMetrics"]>) =>
  this.persistence.getMetrics(...args);
storeMetrics = (
  ...args: Parameters<MetricsPersistenceService["storeMetrics"]>
) => this.persistence.storeMetrics(...args);
getMetricsForMap = (
  ...args: Parameters<MetricsPersistenceService["getMetricsForMap"]>
) => this.persistence.getMetricsForMap(...args);
```

- [ ] **Step 3: Register in module** (add `MetricsPersistenceService` to `providers`).

- [ ] **Step 4: Build** → zero errors. **Step 5: Tests** → pass.

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # expect: develop
git add packages/backend/src/metrics/pipelines/metrics-persistence.service.ts \
        packages/backend/src/metrics/calculated-metrics.service.ts \
        packages/backend/src/metrics/metrics.module.ts
git commit -m "refactor(metrics): extract MetricsPersistenceService"
```

---

## Task 6: Extract FiveYearGrowthService (+ geo-tier sub-splits)

**Files:**

- Create: `packages/backend/src/metrics/pipelines/five-year-growth.service.ts` (orchestrator + map reader)
- Create: `packages/backend/src/metrics/pipelines/five-year-growth-metro.service.ts`
- Create: `packages/backend/src/metrics/pipelines/five-year-growth-aggregate.service.ts` (states + national)
- Create: `packages/backend/src/metrics/pipelines/five-year-growth-granular.service.ts` (counties + zips)
- Modify: `packages/backend/src/metrics/calculated-metrics.service.ts`
- Modify: `packages/backend/src/metrics/metrics.module.ts`

**Methods moved (verbatim, rebind `this.PAGE_SIZE` → `PAGE_SIZE`, `this.calculate5YrGrowthForX` → injected per-geo service):**

- `five-year-growth-metro.service.ts`: `calculate5YrGrowthForMetros` (505–677, ~172 lines).
- `five-year-growth-aggregate.service.ts`: `calculate5YrGrowthForStates` (678–775), `calculate5YrGrowthForNational` (1016–1109).
- `five-year-growth-granular.service.ts`: `calculate5YrGrowthForCounties` (776–895), `calculate5YrGrowthForZips` (896–1015).
- `five-year-growth.service.ts` (orchestrator): `calculate5YrGrowthForAll` (1110–1130), `get5YrGrowthForMap` (1131–1196). Injects the three per-geo services; `calculate5YrGrowthForAll` rebinds its internal calls to them.

- [ ] **Step 1: Create the per-geo services.** Skeleton per file (include only the imports each body uses):

```typescript
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.service";
import { normalizeZipKey, calculateCAGR } from "../../common/zip";
import { PAGE_SIZE } from "../metric-pagination.constants";

@Injectable()
export class FiveYearGrowthMetroService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}
  // paste calculate5YrGrowthForMetros verbatim; this.PAGE_SIZE → PAGE_SIZE
}
```

(Repeat for `FiveYearGrowthAggregateService` with states+national, `FiveYearGrowthGranularService` with counties+zips.)

- [ ] **Step 2: Create the orchestrator service**

```typescript
// packages/backend/src/metrics/pipelines/five-year-growth.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.service";
import { PAGE_SIZE } from "../metric-pagination.constants";
import { FiveYearGrowthMetroService } from "./five-year-growth-metro.service";
import { FiveYearGrowthAggregateService } from "./five-year-growth-aggregate.service";
import { FiveYearGrowthGranularService } from "./five-year-growth-granular.service";

@Injectable()
export class FiveYearGrowthService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly metro: FiveYearGrowthMetroService,
    private readonly aggregate: FiveYearGrowthAggregateService,
    private readonly granular: FiveYearGrowthGranularService,
  ) {}

  calculate5YrGrowthForMetros = (year?: number) =>
    this.metro.calculate5YrGrowthForMetros(year);
  calculate5YrGrowthForStates = (year?: number) =>
    this.aggregate.calculate5YrGrowthForStates(year);
  calculate5YrGrowthForNational = (year?: number) =>
    this.aggregate.calculate5YrGrowthForNational(year);
  calculate5YrGrowthForCounties = () =>
    this.granular.calculate5YrGrowthForCounties();
  calculate5YrGrowthForZips = () => this.granular.calculate5YrGrowthForZips();

  // paste calculate5YrGrowthForAll verbatim, rebinding its internal
  // this.calculate5YrGrowthForMetros(...) → this.metro.calculate5YrGrowthForMetros(...), etc.
  async calculate5YrGrowthForAll(year?: number): Promise<{
    /* exact original return type */
  }> {
    // ...
  }

  // paste get5YrGrowthForMap verbatim (this.PAGE_SIZE → PAGE_SIZE)
  async get5YrGrowthForMap(/* exact original signature */) {
    // ...
  }
}
```

> Verify the exact original signatures of `calculate5YrGrowthForCounties`/`...ForZips` — they take no `year` arg (the controller calls them with none). Match exactly.

- [ ] **Step 3: Facade delegates.** Delete the seven 5yr methods AND the now-unused `PAGE_SIZE` field from the facade (the facade no longer paginates). Inject `FiveYearGrowthService`; add delegates for the six public methods the controller calls (`calculate5YrGrowthForAll/Metros/States/Counties/Zips/National`, `get5YrGrowthForMap`):

```typescript
calculate5YrGrowthForAll = (year?: number) =>
  this.fiveYear.calculate5YrGrowthForAll(year);
calculate5YrGrowthForMetros = (year?: number) =>
  this.fiveYear.calculate5YrGrowthForMetros(year);
calculate5YrGrowthForStates = (year?: number) =>
  this.fiveYear.calculate5YrGrowthForStates(year);
calculate5YrGrowthForCounties = () =>
  this.fiveYear.calculate5YrGrowthForCounties();
calculate5YrGrowthForZips = () => this.fiveYear.calculate5YrGrowthForZips();
calculate5YrGrowthForNational = (year?: number) =>
  this.fiveYear.calculate5YrGrowthForNational(year);
get5YrGrowthForMap = (
  ...args: Parameters<FiveYearGrowthService["get5YrGrowthForMap"]>
) => this.fiveYear.get5YrGrowthForMap(...args);
```

- [ ] **Step 4: Register all four 5yr services in the module** (add to `providers`).

- [ ] **Step 5: Build** → zero errors. **Step 6: Tests** → pass.

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # expect: develop
git add packages/backend/src/metrics/pipelines/five-year-growth*.service.ts \
        packages/backend/src/metrics/calculated-metrics.service.ts \
        packages/backend/src/metrics/metrics.module.ts
git commit -m "refactor(metrics): extract FiveYearGrowthService with geo-tier sub-services"
```

---

## Task 7: Extract AffordabilityMetricsService

**Files:**

- Create: `packages/backend/src/metrics/pipelines/affordability-metrics.config.ts` (the `AFF*` constants)
- Create: `packages/backend/src/metrics/pipelines/affordability-metrics.service.ts`
- Modify: `packages/backend/src/metrics/calculated-metrics.service.ts`
- Modify: `packages/backend/src/metrics/metrics.module.ts`

**Moved (verbatim):** config `AFF`, `AFF_REALTOR_GEOS`, `AFF_CENSUS_GEOS`, `AFF_CENSUS_BY_GEO` (3054–3145) → config file as exported consts; pure helpers `affIncomeToBuy`/`affAffordableHomePrice`/`affYearsToSave` (3146–3188); DB helpers `affFetchMortgageRate`/`affUpsertBatch` (3189–3233); geo pipelines `affIncomeToBuyForGeo`/`affAffordableHomePriceForGeo`/`affYearsToSaveForGeo` (3234–3560); orchestrator `calculateAllAffordabilityMetrics` (3561–3601). All `this.AFF*` references rebind to the imported consts; `this.affX` references stay internal to the service.

- [ ] **Step 1: Create the config file.** Move the four `AFF*` declarations verbatim as `export const`s, preserving their exact shapes/types:

```typescript
// packages/backend/src/metrics/pipelines/affordability-metrics.config.ts
export const AFF = { /* verbatim from line 3054 */ } as const;
export const AFF_REALTOR_GEOS = [ /* verbatim from 3068 */ ];
export const AFF_CENSUS_GEOS = [ /* verbatim from 3101 */ ];
export const AFF_CENSUS_BY_GEO: Record</* verbatim type from 3134 */> = { /* verbatim */ };
```

- [ ] **Step 2: Create the service**

```typescript
// packages/backend/src/metrics/pipelines/affordability-metrics.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../../supabase/supabase.service";
import { normalizeZipKey } from "../../common/zip";
import {
  AFF,
  AFF_REALTOR_GEOS,
  AFF_CENSUS_GEOS,
  AFF_CENSUS_BY_GEO,
} from "./affordability-metrics.config";

@Injectable()
export class AffordabilityMetricsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // paste affIncomeToBuy, affAffordableHomePrice, affYearsToSave,
  // affFetchMortgageRate, affUpsertBatch, affIncomeToBuyForGeo,
  // affAffordableHomePriceForGeo, affYearsToSaveForGeo,
  // calculateAllAffordabilityMetrics — all verbatim,
  // rebinding this.AFF* → AFF / AFF_REALTOR_GEOS / AFF_CENSUS_GEOS / AFF_CENSUS_BY_GEO.
}
```

> Trim imports to what's actually used inside the pasted bodies.

- [ ] **Step 3: Facade delegate.** Delete the affordability config + methods from the facade. Inject `AffordabilityMetricsService` and delegate the one consumer-relevant method (`calculateAllAffordabilityMetrics`, called by `refreshAllCalculatedMetrics` in Task 8):

```typescript
calculateAllAffordabilityMetrics = () =>
  this.affordability.calculateAllAffordabilityMetrics();
```

- [ ] **Step 4: Register in module** (add `AffordabilityMetricsService` to `providers`).

- [ ] **Step 5: Build** → zero errors. **Step 6: Tests** → pass.

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # expect: develop
git add packages/backend/src/metrics/pipelines/affordability-metrics.config.ts \
        packages/backend/src/metrics/pipelines/affordability-metrics.service.ts \
        packages/backend/src/metrics/calculated-metrics.service.ts \
        packages/backend/src/metrics/metrics.module.ts
git commit -m "refactor(metrics): extract AffordabilityMetricsService + config"
```

---

## Task 8: Finalize the facade

**Files:**

- Modify: `packages/backend/src/metrics/calculated-metrics.service.ts`

At this point the only substantive method left in the facade is `refreshAllCalculatedMetrics` (3003–3053), which orchestrates the three pipelines. Everything else is a delegate.

- [ ] **Step 1: Confirm `refreshAllCalculatedMetrics` delegates correctly.** Its body calls `this.calculateAllInvestmentMetrics`, `this.calculate5YrGrowthForAll`, `this.calculateAllAffordabilityMetrics` — these are now facade delegates that forward to the sub-services, so the body works unchanged. Leave it verbatim. (Optionally rebind directly to `this.investment.calculateAllInvestmentMetrics` / `this.fiveYear.calculate5YrGrowthForAll` / `this.affordability.calculateAllAffordabilityMetrics` for clarity — behavior is identical.)

- [ ] **Step 2: Remove dead state.** Delete the facade's `private readonly supabase` injection IF no remaining facade method references `this.supabase` (grep the file for `this.supabase` — expected: none after all pipelines moved). If `refreshAllCalculatedMetrics` and all delegates are supabase-free, drop the `@Inject(SUPABASE_CLIENT)` param. Keep the unused-but-retained `calculateAll` delegate (see Step 3).

- [ ] **Step 3: Re-expose `calculateAll`** (pure, currently dead but retained per rule #1). Add to the facade:

```typescript
import { calculateAll } from "./metric-formulas";
// ...
calculateAll = (input: CalculatedMetricsInput) => calculateAll(input);
```

(Name clash: import as `calculateAllMetrics` if the arrow-prop name collides — `import { calculateAll as calculateAllMetrics }` then `calculateAll = (input) => calculateAllMetrics(input)`.)

- [ ] **Step 4: Confirm facade size + shape.** Run: `wc -l packages/backend/src/metrics/calculated-metrics.service.ts` → expect well under 300. The file should now be: imports, the type re-export, the `@Injectable()` class with a constructor injecting the 5 sub-services, the delegate properties, and `refreshAllCalculatedMetrics`.

- [ ] **Step 5: Build** → zero errors. **Step 6: Tests** → pass.

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # expect: develop
git add packages/backend/src/metrics/calculated-metrics.service.ts
git commit -m "refactor(metrics): reduce CalculatedMetricsService to a thin facade"
```

---

## Task 9: Verification & size-compliance sweep

**Files:** (possible small edits) any new file still over the line limit.

- [ ] **Step 1: Full backend build**

Run: `cd packages/backend && npm run build`
Expected: zero errors.

- [ ] **Step 2: Full metrics test run**

Run: `cd packages/backend && npx jest src/metrics`
Expected: all pass.

- [ ] **Step 3: Line-count audit**

Run: `find packages/backend/src/metrics -name '*.ts' -not -path '*__tests__*' | xargs wc -l | sort -n`
For each file > 300 lines, apply the **pragmatic stance**:

- If a cheap, obvious private-helper extraction (e.g. pulling a per-region compute loop out of `calculateInvestmentMetricsForMetros`) lands it under 300 without changing behavior, do it (verbatim sub-block move into a `private` method called in place), then rebuild + retest.
- If not low-risk, add a one-line exception comment at the top of the file:
  `// FILE-SIZE EXCEPTION (CLAUDE.md §1.3): single cohesive DB pipeline method; splitting further risks behavior. See 2026-06-15 refactor spec.`
  Expected post-split: per-geo investment calculators may remain ~300–500 lines (documented); all other files < 300.

- [ ] **Step 4: Live-DB behavioral equivalence (heavyweight gate)**

This is the real proof that the verbatim moves preserved behavior. Run against the dev/local DB (the monthly pipeline does this routinely; the upsert is idempotent):

1. Snapshot a sample BEFORE rerun (via Supabase MCP `execute_sql`):
   ```sql
   SELECT geography_id, metric_name, value
   FROM calculated_metrics
   WHERE geography_type = 'metro'
   ORDER BY geography_id, metric_name
   LIMIT 500;
   ```
   Save the result.
2. Run the refresh script the same way the monthly cron does (single year to bound runtime):
   Run: `cd packages/backend && npx ts-node src/scripts/refresh-calculated-metrics.ts --year=2026`
   (If the repo runs it via a compiled `dist/` or a dedicated npm script, use that path instead — match how `.github/workflows` invokes it.)
   Expected: exits 0, logs `TOTAL: <n> calculated_metrics rows stored ...`.
3. Re-run the same SELECT and diff against the saved snapshot. Expected: **identical values** (no logic changed → recomputed values match). Any non-trivial diff is a regression — stop and locate the severed binding.

- [ ] **Step 5: Confirm consumers untouched**

Run: `git diff --stat <first-task-commit>..HEAD -- packages/backend/src/metrics/metrics.controller.ts packages/backend/src/scripts/refresh-calculated-metrics.ts`
Expected: **no changes** to either file (the facade preserved their API).

- [ ] **Step 6: Final commit (if Step 3 made edits)**

```bash
git branch --show-current   # expect: develop
git add packages/backend/src/metrics/
git commit -m "refactor(metrics): size-compliance sweep + documented exceptions"
```

---

## Self-Review (completed during planning)

**Spec coverage:**

- §3 target structure → Tasks 1–7 create every listed file; Task 8 finalizes the facade. ✓
- §3.2 facade contract (exact public methods) → delegates added in Tasks 3 (`getInvestmentMetricsForMap`, `calculateInvestmentMetricsFor*`), 4 (`calculateAllInvestmentMetrics`), 5 (`getMetrics`/`storeMetrics`/`getMetricsForMap`), 6 (`calculate5YrGrowthFor*`, `get5YrGrowthForMap`), 7 (`calculateAllAffordabilityMetrics`), 8 (`refreshAllCalculatedMetrics`, `calculateAll`). ✓
- §4 secondary splits → Task 3 (investment per-geo), Task 6 (5yr geo-tier), Task 7 (aff config split), Task 9 (overvalued/aff size audit). ✓
- §5 DI/module wiring → every extraction task registers providers; `app.get(CalculatedMetricsService)` still resolves. ✓
- §6 test strategy → Task 2 (formula tests + repoint overvalued/MoS-block-1), Task 3 (repoint MoS fetchRealtorMosInputs block). ✓
- §7 verification → Task 9 (build + tests + live-DB diff + consumer no-diff check). ✓

**Placeholder scan:** The `// ... paste verbatim ...` markers are deliberate relocation instructions (the code already exists and must not be retyped), not unfinished work — each is paired with exact source line ranges. No `TODO`/`TBD`/"handle edge cases".

**Type/name consistency:** Service names are consistent across tasks (`InvestmentMetricsService`, `RealtorMosInputsService`, `InvestmentMetrics{Metros,Counties,Zips}Service`, `OvervaluedMetricsService`, `MetricsPersistenceService`, `FiveYearGrowth{Service,MetroService,AggregateService,GranularService}`, `AffordabilityMetricsService`). The DI token `SUPABASE_CLIENT` and shared `PAGE_SIZE`/formula imports match across files.

**Known deviation from the spec, by design:** the spec sketched `fetchRealtorMosInputs` living inside `InvestmentMetricsService`; the plan isolates it in a tiny `RealtorMosInputsService` to avoid an orchestrator↔per-geo dependency cycle and to keep the MoS regression test cleanly targetable. Same behavior, cleaner DI.
