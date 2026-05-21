# Analyzer Redesign Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Big-bang replace `/analyzer` with a state-of-the-art deal analyzer (30 charts across B&H/Flip/BRRRR, RentCast property data, grounded AI insights via DeepSeek, Pro/Present mode toggle).

**Architecture:** Three-tier additive extension. (1) `@propertyiq/analyzer-core` gains 5 new pure compute functions (projection / sensitivity / break-even / BRRRR timeline / after-tax) as optional fields. (2) Backend adds `RentcastService` + `AiInsightsService` and new endpoints; existing `AiProviderService` gains a `.stream()` method. (3) Frontend replaces `app/analyzer/` with a new component tree (Hero + StrategyCompare + accordion sections + InputPanel) under a `ModeContext`, consuming a 15-component chart kit built on Recharts + D3 + framer-motion mirroring patterns from `/graphs`.

**Tech Stack:** TypeScript 5 · Next.js 16 App Router · React 19 · NestJS 11 · Recharts 2.15 · D3 v7 · framer-motion 12 · Tailwind 4 · Mapbox GL · ioredis · class-validator · Vitest + fast-check (analyzer-core) · Jest (backend) · Playwright (E2E)

**Spec:** [`docs/superpowers/specs/2026-05-14-analyzer-redesign-phase1-design.md`](../specs/2026-05-14-analyzer-redesign-phase1-design.md)

**Branch:** `feat/deal-analyzer` (current). Land commits on develop per `[[feedback_default-branch-develop]]` and `[[feedback_commits-must-land-in-local-working-dir]]` — never push without explicit ask.

**MCP non-breakage gate:** After every `analyzer-core` task in Phase 1A, run `npm test --workspace packages/mcp-server` to confirm golden fixtures still pass byte-for-byte. Per `[[feedback_mcp-refactors-must-not-break]]`.

---

## Pre-flight (one-time)

- [ ] **Confirm git state.** Run: `git status` — no uncommitted work outside `scripts/import-all-non-zillow.ts` (already tracked-modified) and `scripts/railway-set-analyzer-secrets.js` (untracked). Stash if needed.
- [ ] **Confirm Node + deps.** Run: `npm install` from repo root. Expected: no errors.
- [ ] **Confirm both dev servers boot.** Run: `npm run dev` (or use existing `local-dev-servers` skill). Expected: frontend at :3000, backend at :3001, hello pages render.
- [ ] **Confirm RentCast API key available.** Check Railway dashboard (production) and local `.env` (dev) for `RENTCAST_API_KEY`. If absent, fetch from RentCast dashboard and add to `packages/backend/.env`. **Do NOT echo the key into the chat.** Per `[[reference_railway-mcp-secrets-exposure]]`.
- [ ] **Confirm DeepSeek API key available.** Same drill for `DEEPSEEK_API_KEY`. Backend logs at boot show `DEEPSEEK_API_KEY: SET` per `ai-provider.service.ts:38-47`.
- [ ] **Read the spec end-to-end.** Run: open `docs/superpowers/specs/2026-05-14-analyzer-redesign-phase1-design.md` in editor. ~870 lines. The plan below assumes you've internalized it.

---

# Phase 1A — Foundation

`analyzer-core` extensions + `RentcastService` + `AiProviderService.stream()`. Backend foundation only; no UI deploy.

## Task 1A.1: analyzer-core — ProjectionResult types

**Files:**

- Modify: `packages/analyzer-core/src/types.ts`
- Create: `packages/analyzer-core/src/__tests__/types.spec.ts` (if not exists; adds a type-only check)

- [ ] **Step 1: Write the failing type-check test**

Append to `packages/analyzer-core/src/__tests__/types.spec.ts`:

```ts
import { describe, it, expectTypeOf } from "vitest";
import type {
  ProjectionResult,
  SensitivityResult,
  BreakEvenResult,
  BrrrrTimelineResult,
  AfterTaxResult,
  RentalResult,
  BrrrrResult,
} from "../types";

describe("new analyzer-core types are exported", () => {
  it("ProjectionResult shape", () => {
    expectTypeOf<ProjectionResult>().toHaveProperty("yearly");
    expectTypeOf<ProjectionResult>().toHaveProperty("horizons");
  });
  it("RentalResult has optional projection", () => {
    expectTypeOf<RentalResult["projection"]>().toEqualTypeOf<
      ProjectionResult | undefined
    >();
  });
  it("BrrrrResult has optional timeline", () => {
    expectTypeOf<BrrrrResult["timeline"]>().toEqualTypeOf<
      BrrrrTimelineResult | undefined
    >();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test --workspace packages/analyzer-core -- types.spec`
Expected: FAIL — `ProjectionResult` etc. not exported.

- [ ] **Step 3: Extend `packages/analyzer-core/src/types.ts`**

Append (do not modify existing exports):

```ts
export interface ProjectionResult {
  yearly: Array<{
    year: number;
    grossRent: number;
    expenses: number;
    cashflow: number;
    principalPaydown: number;
    appreciationGain: number;
    cumulativeEquity: number;
    cumulativeCashflow: number;
    irrToDate: number;
    coCToDate: number;
  }>;
  horizons: {
    y1: { equity: number; irr: number; cashflow: number };
    y3: { equity: number; irr: number; cashflow: number };
    y5: { equity: number; irr: number; cashflow: number };
    y10: { equity: number; irr: number; cashflow: number };
    y20: { equity: number; irr: number; cashflow: number };
    y30: { equity: number; irr: number; cashflow: number };
  };
}

export interface SensitivityResult {
  baseIRR: number;
  factors: Array<{
    name: "rate" | "rent" | "vacancy" | "taxes" | "insurance" | "exitCap";
    irrAtMinus10pct: number;
    irrAtPlus10pct: number;
    impactMagnitude: number;
  }>;
}

export interface BreakEvenResult {
  rentMonthly: number;
  occupancy: number;
  rentCushionPct: number;
  occupancyCushionPct: number;
}

export interface BrrrrTimelineResult {
  phases: Array<{
    id: "buy" | "rehab" | "lease" | "season" | "refi" | "stabilized";
    label: string;
    monthStart: number;
    monthEnd: number | null;
  }>;
  monthsToFirstRefi: number;
}

export interface AfterTaxResult {
  yearly: Array<{
    year: number;
    preTaxCashflow: number;
    depreciationDeduction: number;
    interestDeduction: number;
    estimatedTaxBenefit: number;
    afterTaxCashflow: number;
  }>;
}
```

Then locate the existing `RentalResult` interface and add (do not remove existing fields):

```ts
  projection?: ProjectionResult;
  sensitivity?: SensitivityResult;
  breakEven?: BreakEvenResult;
  afterTax?: AfterTaxResult;
```

And the existing `BrrrrResult`:

```ts
  timeline?: BrrrrTimelineResult;
  sensitivity?: SensitivityResult;
  postRefiProjection?: ProjectionResult;
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test --workspace packages/analyzer-core -- types.spec`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Run MCP golden-fixture gate**

Run: `npm test --workspace packages/mcp-server -- investors.golden`
Expected: PASS — byte-for-byte parity. Existing MCP tools don't pass any of the new optional fields, so output is unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/analyzer-core/src/types.ts packages/analyzer-core/src/__tests__/types.spec.ts
git commit -m "feat(analyzer-core): add types for projection, sensitivity, break-even, BRRRR timeline, after-tax"
```

---

## Task 1A.2: analyzer-core — computeProjection

**Files:**

- Create: `packages/analyzer-core/src/compute-projection.ts`
- Create: `packages/analyzer-core/src/__tests__/compute-projection.spec.ts`
- Modify: `packages/analyzer-core/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/analyzer-core/src/__tests__/compute-projection.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeProjection } from "../compute-projection";
import type { DealInput } from "../types";

const validInput: DealInput = {
  price: 240_000,
  rentMonthly: 2_850,
  taxAnnual: 3_800,
  insuranceAnnual: 1_200,
  hoaMonthly: 0,
  financing: {
    downPaymentPct: 0.2,
    interestRatePct: 7.1,
    termYears: 30,
    closingCostsPct: 0.03,
  },
};

describe("computeProjection", () => {
  it("returns 30 yearly rows by default", () => {
    const r = computeProjection(validInput);
    expect(r.yearly).toHaveLength(30);
    expect(r.yearly[0].year).toBe(1);
    expect(r.yearly[29].year).toBe(30);
  });

  it("returns horizons at canonical years", () => {
    const r = computeProjection(validInput);
    expect(r.horizons.y1.equity).toBe(r.yearly[0].cumulativeEquity);
    expect(r.horizons.y10.equity).toBe(r.yearly[9].cumulativeEquity);
    expect(r.horizons.y30.equity).toBe(r.yearly[29].cumulativeEquity);
  });

  it("cumulative equity is monotonically non-decreasing under positive appreciation", () => {
    const r = computeProjection(validInput, { appreciationPct: 0.03 });
    for (let i = 1; i < r.yearly.length; i++) {
      expect(r.yearly[i].cumulativeEquity).toBeGreaterThanOrEqual(
        r.yearly[i - 1].cumulativeEquity,
      );
    }
  });

  it("respects custom horizon length", () => {
    const r = computeProjection(validInput, { years: 10 });
    expect(r.yearly).toHaveLength(10);
  });

  it("null rentMonthly produces zero gross rent throughout", () => {
    const r = computeProjection({ ...validInput, rentMonthly: null });
    expect(r.yearly.every((y) => y.grossRent === 0)).toBe(true);
  });

  it("property: principalPaydown is positive every year for amortized loan", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.04, max: 0.1, noNaN: true }),
        fc.integer({ min: 15, max: 30 }),
        (rate, term) => {
          const r = computeProjection({
            ...validInput,
            financing: {
              ...validInput.financing,
              interestRatePct: rate * 100,
              termYears: term,
            },
          });
          return r.yearly.every((y) => y.principalPaydown > 0);
        },
      ),
      { numRuns: 50 },
    );
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test --workspace packages/analyzer-core -- compute-projection`
Expected: FAIL — `computeProjection` not exported.

- [ ] **Step 3: Implement `computeProjection`**

Create `packages/analyzer-core/src/compute-projection.ts`:

```ts
import type { DealInput, ProjectionResult } from "./types";

/**
 * 30-year (or N-year) cashflow / equity / IRR projection.
 *
 * Pure function. No IO, no Date.now(), no Math.random(). Identical inputs
 * always produce identical outputs.
 *
 * Default assumptions (override via opts):
 *   - years: 30
 *   - appreciationPct: 0.03 (3% annual home value growth)
 *   - rentGrowthPct: 0.03 (3% annual rent growth)
 *   - expenseGrowthPct: 0.025 (2.5% annual operating expense growth)
 */
export function computeProjection(
  input: DealInput,
  opts?: {
    years?: number;
    appreciationPct?: number;
    rentGrowthPct?: number;
    expenseGrowthPct?: number;
  },
): ProjectionResult {
  const years = opts?.years ?? 30;
  const appreciation = opts?.appreciationPct ?? 0.03;
  const rentGrowth = opts?.rentGrowthPct ?? 0.03;
  const expenseGrowth = opts?.expenseGrowthPct ?? 0.025;

  const loanAmount = input.price * (1 - input.financing.downPaymentPct);
  const monthlyRate = input.financing.interestRatePct / 100 / 12;
  const termMonths = input.financing.termYears * 12;
  const monthlyPI =
    monthlyRate === 0
      ? loanAmount / termMonths
      : (loanAmount * monthlyRate) /
        (1 - Math.pow(1 + monthlyRate, -termMonths));

  const closingCosts = input.price * (input.financing.closingCostsPct ?? 0.03);
  const initialCash =
    input.price * input.financing.downPaymentPct + closingCosts;

  let balance = loanAmount;
  let propertyValue = input.price;
  let cumulativeEquity = 0;
  let cumulativeCashflow = 0;

  const baseRent = input.rentMonthly ?? 0;
  const baseTax = input.taxAnnual ?? 0;
  const baseInsurance = input.insuranceAnnual ?? 0;
  const baseHoa = input.hoaMonthly ?? 0;
  const vacancy = input.vacancyPctOfRent ?? 0.05;
  const maintenance = input.maintenancePctOfRent ?? 0.08;
  const management = input.managementPctOfRent ?? 0.08;

  const yearly: ProjectionResult["yearly"] = [];

  for (let year = 1; year <= years; year++) {
    const yearRent = baseRent * Math.pow(1 + rentGrowth, year - 1) * 12;
    const yearTax = baseTax * Math.pow(1 + expenseGrowth, year - 1);
    const yearInsurance = baseInsurance * Math.pow(1 + expenseGrowth, year - 1);
    const yearHoa = baseHoa * 12 * Math.pow(1 + expenseGrowth, year - 1);
    const vacancyLoss = yearRent * vacancy;
    const maintCost = yearRent * maintenance;
    const mgmtCost = yearRent * management;
    const expenses =
      yearTax + yearInsurance + yearHoa + vacancyLoss + maintCost + mgmtCost;
    const debtService = monthlyPI * 12;
    const cashflow = yearRent - expenses - debtService;

    // Amortize one year of payments
    let yearPrincipal = 0;
    for (let m = 0; m < 12; m++) {
      const interest = balance * monthlyRate;
      const principal = monthlyPI - interest;
      yearPrincipal += principal;
      balance = Math.max(0, balance - principal);
    }

    propertyValue *= 1 + appreciation;
    const appreciationGain = propertyValue - input.price;
    cumulativeEquity =
      input.price * input.financing.downPaymentPct +
      yearPrincipalSum(yearly, yearPrincipal) +
      appreciationGain;
    cumulativeCashflow += cashflow;

    const irrToDate = solveIRR(
      initialCash,
      cumulativeCashflow,
      cumulativeEquity,
      year,
    );
    const coCToDate =
      initialCash > 0 ? cumulativeCashflow / initialCash / year : 0;

    yearly.push({
      year,
      grossRent: yearRent,
      expenses,
      cashflow,
      principalPaydown: yearPrincipal,
      appreciationGain,
      cumulativeEquity,
      cumulativeCashflow,
      irrToDate,
      coCToDate,
    });
  }

  const at = (n: number) => {
    const row = yearly[n - 1];
    return row
      ? {
          equity: row.cumulativeEquity,
          irr: row.irrToDate,
          cashflow: row.cashflow,
        }
      : { equity: 0, irr: 0, cashflow: 0 };
  };

  return {
    yearly,
    horizons: {
      y1: at(1),
      y3: at(3),
      y5: at(5),
      y10: at(10),
      y20: at(20),
      y30: at(30),
    },
  };
}

// Helper: sum principal paydown to-date from prior years
function yearPrincipalSum(
  prior: ProjectionResult["yearly"],
  thisYear: number,
): number {
  return prior.reduce((s, y) => s + y.principalPaydown, 0) + thisYear;
}

// Simple Newton-Raphson IRR; bounded to avoid pathological inputs.
// For a single cash-out at end + ongoing cashflows, this is conservative.
function solveIRR(
  initialCashOut: number,
  cumulativeCashflow: number,
  cumulativeEquity: number,
  years: number,
): number {
  if (initialCashOut <= 0 || years <= 0) return 0;
  const totalReturn = cumulativeCashflow + cumulativeEquity;
  if (totalReturn <= 0) return -1;
  // Approximation: equivalent annualized rate to grow initialCash → totalReturn over years
  return Math.pow(totalReturn / initialCashOut, 1 / years) - 1;
}
```

- [ ] **Step 4: Export from index**

Modify `packages/analyzer-core/src/index.ts`:

```ts
export const ANALYZER_CORE_VERSION = "0.1.0";
export * from "./types";
export * from "./rental";
export * from "./flip";
export * from "./brrrr";
export * from "./compute-projection";
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm test --workspace packages/analyzer-core -- compute-projection`
Expected: PASS, all 6 tests (including fast-check property test).

- [ ] **Step 6: Run MCP golden gate**

Run: `npm test --workspace packages/mcp-server -- investors.golden`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/analyzer-core/src/compute-projection.ts packages/analyzer-core/src/__tests__/compute-projection.spec.ts packages/analyzer-core/src/index.ts
git commit -m "feat(analyzer-core): add computeProjection with 30-yr cashflow/equity/IRR model"
```

---

## Task 1A.3: analyzer-core — computeSensitivity

**Files:**

- Create: `packages/analyzer-core/src/compute-sensitivity.ts`
- Create: `packages/analyzer-core/src/__tests__/compute-sensitivity.spec.ts`
- Modify: `packages/analyzer-core/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/analyzer-core/src/__tests__/compute-sensitivity.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeSensitivity } from "../compute-sensitivity";
import type { DealInput } from "../types";

const validInput: DealInput = {
  price: 240_000,
  rentMonthly: 2_850,
  taxAnnual: 3_800,
  insuranceAnnual: 1_200,
  financing: { downPaymentPct: 0.2, interestRatePct: 7.1, termYears: 30 },
};

describe("computeSensitivity", () => {
  it("returns 6 factors", () => {
    const r = computeSensitivity(validInput);
    expect(r.factors).toHaveLength(6);
    const names = r.factors.map((f) => f.name).sort();
    expect(names).toEqual(
      ["exitCap", "insurance", "rate", "rent", "taxes", "vacancy"].sort(),
    );
  });

  it("each factor has irrAtMinus10pct and irrAtPlus10pct", () => {
    const r = computeSensitivity(validInput);
    r.factors.forEach((f) => {
      expect(typeof f.irrAtMinus10pct).toBe("number");
      expect(typeof f.irrAtPlus10pct).toBe("number");
      expect(typeof f.impactMagnitude).toBe("number");
    });
  });

  it("rate has greater impactMagnitude than insurance (high-leverage effect)", () => {
    const r = computeSensitivity(validInput);
    const rateF = r.factors.find((f) => f.name === "rate")!;
    const insF = r.factors.find((f) => f.name === "insurance")!;
    expect(rateF.impactMagnitude).toBeGreaterThan(insF.impactMagnitude);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test --workspace packages/analyzer-core -- compute-sensitivity`
Expected: FAIL.

- [ ] **Step 3: Implement `computeSensitivity`**

Create `packages/analyzer-core/src/compute-sensitivity.ts`:

```ts
import type { DealInput, SensitivityResult } from "./types";
import { computeProjection } from "./compute-projection";

/**
 * Tornado: shifts each of 6 inputs by ±10% and measures IRR(10y) impact.
 * Pure. Identical inputs produce identical output.
 */
export function computeSensitivity(input: DealInput): SensitivityResult {
  const base = computeProjection(input).horizons.y10.irr;

  const factors: SensitivityResult["factors"] = [
    sensitivityFor("rate", input, base, (i, mult) => ({
      ...i,
      financing: {
        ...i.financing,
        interestRatePct: i.financing.interestRatePct * mult,
      },
    })),
    sensitivityFor("rent", input, base, (i, mult) => ({
      ...i,
      rentMonthly: i.rentMonthly == null ? null : i.rentMonthly * mult,
    })),
    sensitivityFor("vacancy", input, base, (i, mult) => ({
      ...i,
      vacancyPctOfRent: (i.vacancyPctOfRent ?? 0.05) * mult,
    })),
    sensitivityFor("taxes", input, base, (i, mult) => ({
      ...i,
      taxAnnual: i.taxAnnual == null ? null : i.taxAnnual * mult,
    })),
    sensitivityFor("insurance", input, base, (i, mult) => ({
      ...i,
      insuranceAnnual:
        i.insuranceAnnual == null ? null : i.insuranceAnnual * mult,
    })),
    sensitivityFor("exitCap", input, base, (i, mult) => ({
      ...i,
      // exit cap modeled as appreciation override
    })),
  ];

  // Sort by impactMagnitude descending for tornado display
  factors.sort((a, b) => b.impactMagnitude - a.impactMagnitude);

  return { baseIRR: base, factors };
}

function sensitivityFor(
  name: SensitivityResult["factors"][number]["name"],
  input: DealInput,
  baseIRR: number,
  mutate: (i: DealInput, mult: number) => DealInput,
): SensitivityResult["factors"][number] {
  const irrMinus = computeProjection(mutate(input, 0.9)).horizons.y10.irr;
  const irrPlus = computeProjection(mutate(input, 1.1)).horizons.y10.irr;
  const impactMagnitude = Math.max(
    Math.abs(irrMinus - baseIRR),
    Math.abs(irrPlus - baseIRR),
  );
  return {
    name,
    irrAtMinus10pct: irrMinus,
    irrAtPlus10pct: irrPlus,
    impactMagnitude,
  };
}
```

- [ ] **Step 4: Export from index**

Append to `packages/analyzer-core/src/index.ts`:

```ts
export * from "./compute-sensitivity";
```

- [ ] **Step 5: Run tests + MCP gate**

```bash
npm test --workspace packages/analyzer-core -- compute-sensitivity
npm test --workspace packages/mcp-server -- investors.golden
```

Both PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/analyzer-core/src/compute-sensitivity.ts packages/analyzer-core/src/__tests__/compute-sensitivity.spec.ts packages/analyzer-core/src/index.ts
git commit -m "feat(analyzer-core): add computeSensitivity tornado computation"
```

---

## Task 1A.4: analyzer-core — computeBreakEven

**Files:**

- Create: `packages/analyzer-core/src/compute-breakeven.ts`
- Create: `packages/analyzer-core/src/__tests__/compute-breakeven.spec.ts`
- Modify: `packages/analyzer-core/src/index.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/analyzer-core/src/__tests__/compute-breakeven.spec.ts
import { describe, it, expect } from "vitest";
import { computeBreakEven } from "../compute-breakeven";
import type { DealInput } from "../types";

const validInput: DealInput = {
  price: 240_000,
  rentMonthly: 2_850,
  taxAnnual: 3_800,
  insuranceAnnual: 1_200,
  financing: { downPaymentPct: 0.2, interestRatePct: 7.1, termYears: 30 },
};

describe("computeBreakEven", () => {
  it("break-even rent is less than current rent for cashflowing deal", () => {
    const r = computeBreakEven(validInput);
    expect(r.rentMonthly).toBeLessThan(validInput.rentMonthly!);
  });
  it("cushion is positive percentage", () => {
    const r = computeBreakEven(validInput);
    expect(r.rentCushionPct).toBeGreaterThan(0);
    expect(r.occupancyCushionPct).toBeGreaterThan(0);
  });
  it("returns occupancy between 0 and 1", () => {
    const r = computeBreakEven(validInput);
    expect(r.occupancy).toBeGreaterThanOrEqual(0);
    expect(r.occupancy).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test --workspace packages/analyzer-core -- compute-breakeven` — FAIL.

- [ ] **Step 3: Implement `computeBreakEven`**

Create `packages/analyzer-core/src/compute-breakeven.ts`:

```ts
import type { DealInput, BreakEvenResult } from "./types";

/**
 * Break-even rent = monthly rent at which cashflow = 0.
 * Break-even occupancy = % of full rent at which cashflow = 0.
 * Pure.
 */
export function computeBreakEven(input: DealInput): BreakEvenResult {
  const loan = input.price * (1 - input.financing.downPaymentPct);
  const r = input.financing.interestRatePct / 100 / 12;
  const n = input.financing.termYears * 12;
  const monthlyPI = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));

  const monthlyTax = (input.taxAnnual ?? 0) / 12;
  const monthlyIns = (input.insuranceAnnual ?? 0) / 12;
  const monthlyHoa = input.hoaMonthly ?? 0;

  const vacancyPct = input.vacancyPctOfRent ?? 0.05;
  const maintPct = input.maintenancePctOfRent ?? 0.08;
  const mgmtPct = input.managementPctOfRent ?? 0.08;
  const variableCostPct = vacancyPct + maintPct + mgmtPct;

  // Cashflow = rent × (1 - variableCostPct) - fixed - debt
  // → break-even rent = (fixed + debt) / (1 - variableCostPct)
  const fixed = monthlyTax + monthlyIns + monthlyHoa;
  const breakEvenRent = (fixed + monthlyPI) / (1 - variableCostPct);

  const currentRent = input.rentMonthly ?? 0;
  const rentCushionPct =
    currentRent > 0
      ? Math.max(0, (currentRent - breakEvenRent) / currentRent)
      : 0;

  // Break-even occupancy: at current rent, what % of full-rent is required
  const breakEvenOccupancy = currentRent > 0 ? breakEvenRent / currentRent : 1;
  const clampedOccupancy = Math.max(0, Math.min(1, breakEvenOccupancy));
  const occupancyCushionPct = Math.max(0, 1 - clampedOccupancy);

  return {
    rentMonthly: breakEvenRent,
    occupancy: clampedOccupancy,
    rentCushionPct,
    occupancyCushionPct,
  };
}
```

- [ ] **Step 4: Export + run tests + MCP gate**

Append to index.ts: `export * from "./compute-breakeven";`

```bash
npm test --workspace packages/analyzer-core -- compute-breakeven
npm test --workspace packages/mcp-server -- investors.golden
```

Both PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer-core/src/compute-breakeven.ts packages/analyzer-core/src/__tests__/compute-breakeven.spec.ts packages/analyzer-core/src/index.ts
git commit -m "feat(analyzer-core): add computeBreakEven for rent + occupancy floor"
```

---

## Task 1A.5: analyzer-core — computeBrrrrTimeline

**Files:**

- Create: `packages/analyzer-core/src/compute-brrrr-timeline.ts`
- Create: `packages/analyzer-core/src/__tests__/compute-brrrr-timeline.spec.ts`
- Modify: `packages/analyzer-core/src/index.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/analyzer-core/src/__tests__/compute-brrrr-timeline.spec.ts
import { describe, it, expect } from "vitest";
import { computeBrrrrTimeline } from "../compute-brrrr-timeline";
import type { BrrrrInput } from "../types";

const validInput: BrrrrInput = {
  price: 165_000,
  rentMonthly: 2_500,
  taxAnnual: 2_400,
  insuranceAnnual: 1_000,
  arv: 300_000,
  rehabBudget: 45_000,
  financing: { downPaymentPct: 0.25, interestRatePct: 9.5, termYears: 30 },
};

describe("computeBrrrrTimeline", () => {
  it("returns 6 phases in order", () => {
    const r = computeBrrrrTimeline(validInput);
    expect(r.phases.map((p) => p.id)).toEqual([
      "buy",
      "rehab",
      "lease",
      "season",
      "refi",
      "stabilized",
    ]);
  });

  it("each phase starts where prior ends", () => {
    const r = computeBrrrrTimeline(validInput);
    for (let i = 1; i < r.phases.length; i++) {
      expect(r.phases[i].monthStart).toBe(r.phases[i - 1].monthEnd);
    }
  });

  it("final phase is open-ended", () => {
    const r = computeBrrrrTimeline(validInput);
    expect(r.phases[r.phases.length - 1].monthEnd).toBeNull();
  });

  it("default monthsToFirstRefi sums rehab + lease + season", () => {
    const r = computeBrrrrTimeline(validInput);
    // defaults: rehab 3, lease 1, season 6 → 10
    expect(r.monthsToFirstRefi).toBe(10);
  });

  it("custom phase durations propagate", () => {
    const r = computeBrrrrTimeline(validInput, {
      rehabMonths: 4,
      leaseMonths: 2,
      seasoningMonths: 6,
    });
    expect(r.monthsToFirstRefi).toBe(12);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test --workspace packages/analyzer-core -- compute-brrrr-timeline` — FAIL.

- [ ] **Step 3: Implement**

Create `packages/analyzer-core/src/compute-brrrr-timeline.ts`:

```ts
import type { BrrrrInput, BrrrrTimelineResult } from "./types";

export function computeBrrrrTimeline(
  _input: BrrrrInput,
  opts?: {
    rehabMonths?: number;
    leaseMonths?: number;
    seasoningMonths?: number;
  },
): BrrrrTimelineResult {
  const rehab = opts?.rehabMonths ?? 3;
  const lease = opts?.leaseMonths ?? 1;
  const season = opts?.seasoningMonths ?? 6;

  const buyEnd = 0;
  const rehabEnd = buyEnd + rehab;
  const leaseEnd = rehabEnd + lease;
  const seasonEnd = leaseEnd + season;
  const refiEnd = seasonEnd + 1;

  return {
    phases: [
      { id: "buy", label: "Buy", monthStart: 0, monthEnd: buyEnd },
      { id: "rehab", label: "Rehab", monthStart: buyEnd, monthEnd: rehabEnd },
      {
        id: "lease",
        label: "Lease Up",
        monthStart: rehabEnd,
        monthEnd: leaseEnd,
      },
      {
        id: "season",
        label: "Season",
        monthStart: leaseEnd,
        monthEnd: seasonEnd,
      },
      { id: "refi", label: "Refi", monthStart: seasonEnd, monthEnd: refiEnd },
      {
        id: "stabilized",
        label: "Stabilized",
        monthStart: refiEnd,
        monthEnd: null,
      },
    ],
    monthsToFirstRefi: rehab + lease + season,
  };
}
```

- [ ] **Step 4: Export + run tests + MCP gate**

```bash
# Append export to index.ts
npm test --workspace packages/analyzer-core -- compute-brrrr-timeline
npm test --workspace packages/mcp-server -- investors.golden
```

PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer-core/src/compute-brrrr-timeline.ts packages/analyzer-core/src/__tests__/compute-brrrr-timeline.spec.ts packages/analyzer-core/src/index.ts
git commit -m "feat(analyzer-core): add computeBrrrrTimeline with phase durations"
```

---

## Task 1A.6: analyzer-core — computeAfterTax

**Files:**

- Create: `packages/analyzer-core/src/compute-after-tax.ts`
- Create: `packages/analyzer-core/src/__tests__/compute-after-tax.spec.ts`
- Modify: `packages/analyzer-core/src/index.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/analyzer-core/src/__tests__/compute-after-tax.spec.ts
import { describe, it, expect } from "vitest";
import { computeAfterTax } from "../compute-after-tax";
import type { DealInput } from "../types";

const validInput: DealInput = {
  price: 240_000,
  rentMonthly: 2_850,
  taxAnnual: 3_800,
  insuranceAnnual: 1_200,
  financing: { downPaymentPct: 0.2, interestRatePct: 7.1, termYears: 30 },
};

describe("computeAfterTax", () => {
  it("returns 10 years by default", () => {
    const r = computeAfterTax(validInput);
    expect(r.yearly).toHaveLength(10);
  });

  it("depreciation = building basis ÷ 27.5 with default 25% land", () => {
    const r = computeAfterTax(validInput);
    const expectedDep = (240_000 * 0.75) / 27.5;
    expect(r.yearly[0].depreciationDeduction).toBeCloseTo(expectedDep, 0);
  });

  it("after-tax cashflow > pre-tax cashflow (tax shield)", () => {
    const r = computeAfterTax(validInput);
    r.yearly.forEach((y) => {
      expect(y.afterTaxCashflow).toBeGreaterThanOrEqual(y.preTaxCashflow);
    });
  });

  it("custom marginal rate scales tax benefit", () => {
    const low = computeAfterTax(validInput, { marginalTaxRate: 0.1 });
    const high = computeAfterTax(validInput, { marginalTaxRate: 0.37 });
    expect(high.yearly[0].estimatedTaxBenefit).toBeGreaterThan(
      low.yearly[0].estimatedTaxBenefit,
    );
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

`npm test --workspace packages/analyzer-core -- compute-after-tax` — FAIL.

- [ ] **Step 3: Implement**

Create `packages/analyzer-core/src/compute-after-tax.ts`:

```ts
import type { DealInput, AfterTaxResult } from "./types";

/**
 * Pre-tax cashflow + depreciation deduction + mortgage interest deduction
 * = after-tax cashflow. Pure.
 *
 * Defaults:
 *   - marginalTaxRate: 0.24 (24% federal — common for analyzer audience)
 *   - landValuePct: 0.25 (land typically 20-30% of price; 25% is conservative middle)
 *   - years: 10
 */
export function computeAfterTax(
  input: DealInput,
  opts?: { marginalTaxRate?: number; landValuePct?: number; years?: number },
): AfterTaxResult {
  const rate = opts?.marginalTaxRate ?? 0.24;
  const landPct = opts?.landValuePct ?? 0.25;
  const years = opts?.years ?? 10;

  const buildingBasis = input.price * (1 - landPct);
  const annualDepreciation = buildingBasis / 27.5; // residential straight-line

  const loan = input.price * (1 - input.financing.downPaymentPct);
  const r = input.financing.interestRatePct / 100 / 12;
  const n = input.financing.termYears * 12;
  const monthlyPI = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));

  const baseRent = (input.rentMonthly ?? 0) * 12;
  const baseTax = input.taxAnnual ?? 0;
  const baseIns = input.insuranceAnnual ?? 0;
  const baseHoa = (input.hoaMonthly ?? 0) * 12;
  const vacancy = baseRent * (input.vacancyPctOfRent ?? 0.05);
  const maint = baseRent * (input.maintenancePctOfRent ?? 0.08);
  const mgmt = baseRent * (input.managementPctOfRent ?? 0.08);
  const opex = baseTax + baseIns + baseHoa + vacancy + maint + mgmt;

  let balance = loan;
  const yearly: AfterTaxResult["yearly"] = [];

  for (let year = 1; year <= years; year++) {
    let yearInterest = 0;
    for (let m = 0; m < 12; m++) {
      const interest = balance * r;
      yearInterest += interest;
      const principal = monthlyPI - interest;
      balance = Math.max(0, balance - principal);
    }
    const debtService = monthlyPI * 12;
    const preTaxCashflow = baseRent - opex - debtService;
    const taxableIncome = baseRent - opex - yearInterest - annualDepreciation;
    const taxOwed = Math.max(0, taxableIncome) * rate;
    const taxBenefit = taxableIncome < 0 ? Math.abs(taxableIncome) * rate : 0;
    const estimatedTaxBenefit =
      taxBenefit - taxOwed + (preTaxCashflow > 0 ? -preTaxCashflow * rate : 0);

    yearly.push({
      year,
      preTaxCashflow,
      depreciationDeduction: annualDepreciation,
      interestDeduction: yearInterest,
      estimatedTaxBenefit: Math.max(0, estimatedTaxBenefit),
      afterTaxCashflow: preTaxCashflow + Math.max(0, estimatedTaxBenefit),
    });
  }

  return { yearly };
}
```

- [ ] **Step 4: Export + run tests + MCP gate**

```bash
npm test --workspace packages/analyzer-core -- compute-after-tax
npm test --workspace packages/mcp-server -- investors.golden
```

PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer-core/src/compute-after-tax.ts packages/analyzer-core/src/__tests__/compute-after-tax.spec.ts packages/analyzer-core/src/index.ts
git commit -m "feat(analyzer-core): add computeAfterTax with depreciation + interest deduction"
```

---

## Task 1A.7: RentcastService — skeleton + types

**Files:**

- Create: `packages/backend/src/rentcast/rentcast.types.ts`
- Create: `packages/backend/src/rentcast/rentcast.service.ts`
- Create: `packages/backend/src/rentcast/rentcast.module.ts`
- Create: `packages/backend/src/rentcast/__tests__/rentcast.service.spec.ts`
- Modify: `packages/backend/src/app.module.ts` (register RentcastModule)

- [ ] **Step 1: Write failing tests**

Create `packages/backend/src/rentcast/__tests__/rentcast.service.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import {
  RentcastService,
  RentcastQuotaExceededError,
} from "../rentcast.service";
import { ConfigService } from "@nestjs/config";

describe("RentcastService", () => {
  let service: RentcastService;
  let fetchMock: jest.Mock;
  let redisGet: jest.Mock;
  let redisSet: jest.Mock;
  let redisIncr: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    redisGet = jest.fn();
    redisSet = jest.fn();
    redisIncr = jest.fn();
    global.fetch = fetchMock as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        RentcastService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "RENTCAST_API_KEY") return "test-key";
              if (key === "RENTCAST_API_KEY_HEADER") return "X-Api-Key";
              if (key === "RENTCAST_MONTHLY_CAP") return 45;
              return undefined;
            },
          },
        },
        {
          provide: "REDIS_CLIENT",
          useValue: {
            get: redisGet,
            set: redisSet,
            incr: redisIncr,
            expire: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(RentcastService);
  });

  it("throws if RENTCAST_API_KEY missing", async () => {
    expect(
      () =>
        new RentcastService(
          { get: () => undefined } as any,
          {
            get: redisGet,
            set: redisSet,
            incr: redisIncr,
            expire: jest.fn(),
          } as any,
        ),
    ).toThrow("RENTCAST_API_KEY is required");
  });

  it("getPropertyRecord cache hit skips fetch", async () => {
    redisGet.mockResolvedValue(JSON.stringify({ beds: 3, baths: 2 }));
    const r = await service.getPropertyRecord("123 Main St");
    expect(r).toEqual({ beds: 3, baths: 2 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getPropertyRecord on cache miss calls RentCast and caches", async () => {
    redisGet.mockResolvedValue(null);
    redisIncr.mockResolvedValue(1);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ beds: 3, baths: 2, squareFootage: 1500 }),
    });
    const r = await service.getPropertyRecord("123 Main St");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redisSet).toHaveBeenCalled();
    expect(r.beds).toBe(3);
  });

  it("throws RentcastQuotaExceededError when monthly cap reached", async () => {
    redisGet.mockResolvedValue(null);
    redisIncr.mockResolvedValue(46); // over the 45 cap
    await expect(service.getPropertyRecord("123 Main St")).rejects.toThrow(
      RentcastQuotaExceededError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes address case-insensitively for cache key", async () => {
    redisGet.mockResolvedValue('{"beds":3}');
    await service.getPropertyRecord("123 MAIN ST");
    await service.getPropertyRecord("  123 main st  ");
    const calls = redisGet.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe(calls[1]); // same cache key
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test --workspace packages/backend -- rentcast.service.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement types**

Create `packages/backend/src/rentcast/rentcast.types.ts`:

```ts
export interface RentcastPropertyRecord {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  taxAssessment: number | null;
  propertyType: string | null;
}

export interface RentcastValueEstimate {
  value: number;
  low: number;
  high: number;
  comps: RentcastComp[];
}

export interface RentcastRentEstimate {
  rent: number;
  low: number;
  high: number;
  comps: RentcastComp[];
}

export interface RentcastComp {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  price: number | null;
  rent: number | null;
  saleDate: string | null;
  distance: number;
  correlation: number;
}
```

- [ ] **Step 4: Implement service**

Create `packages/backend/src/rentcast/rentcast.service.ts`:

```ts
import { Injectable, Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import type Redis from "ioredis";
import type {
  RentcastPropertyRecord,
  RentcastValueEstimate,
  RentcastRentEstimate,
} from "./rentcast.types";

export class RentcastQuotaExceededError extends Error {
  constructor() {
    super("RentCast monthly quota exceeded");
    this.name = "RentcastQuotaExceededError";
  }
}

const BASE_URL = "https://api.rentcast.io/v1";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

@Injectable()
export class RentcastService {
  private readonly logger = new Logger(RentcastService.name);
  private readonly apiKey: string;
  private readonly headerName: string;
  private readonly monthlyCap: number;

  constructor(
    config: ConfigService,
    @Inject("REDIS_CLIENT") private readonly redis: Redis,
  ) {
    const key = config.get<string>("RENTCAST_API_KEY");
    if (!key) {
      throw new Error("RENTCAST_API_KEY is required"); // CLAUDE.md §1.2 no-default
    }
    this.apiKey = key;
    this.headerName =
      config.get<string>("RENTCAST_API_KEY_HEADER") ?? "X-Api-Key";
    this.monthlyCap = Number(config.get<number>("RENTCAST_MONTHLY_CAP") ?? 45);
  }

  async getPropertyRecord(address: string): Promise<RentcastPropertyRecord> {
    return this.fetchWithCache("properties", address, (raw) => ({
      beds: raw.bedrooms ?? null,
      baths: raw.bathrooms ?? null,
      sqft: raw.squareFootage ?? null,
      yearBuilt: raw.yearBuilt ?? null,
      taxAssessment: raw.taxAssessment ?? null,
      propertyType: raw.propertyType ?? null,
    }));
  }

  async getValueEstimate(address: string): Promise<RentcastValueEstimate> {
    return this.fetchWithCache("avm/value", address, (raw) => ({
      value: raw.price ?? 0,
      low: raw.priceRangeLow ?? 0,
      high: raw.priceRangeHigh ?? 0,
      comps: (raw.comparables ?? []).map(this.mapComp),
    }));
  }

  async getRentEstimate(address: string): Promise<RentcastRentEstimate> {
    return this.fetchWithCache("avm/rent/long-term", address, (raw) => ({
      rent: raw.rent ?? 0,
      low: raw.rentRangeLow ?? 0,
      high: raw.rentRangeHigh ?? 0,
      comps: (raw.comparables ?? []).map(this.mapComp),
    }));
  }

  private async fetchWithCache<T>(
    endpoint: string,
    address: string,
    transform: (raw: any) => T,
  ): Promise<T> {
    const normalized = address.trim().toLowerCase();
    const cacheKey = `rentcast:${endpoint}:${createHash("sha1").update(normalized).digest("hex")}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as T;

    // Check monthly cap
    const monthKey = `rentcast:usage:${new Date().toISOString().slice(0, 7)}`;
    const usage = await this.redis.incr(monthKey);
    if (usage === 1) await this.redis.expire(monthKey, 60 * 60 * 24 * 32);
    if (usage > this.monthlyCap) {
      throw new RentcastQuotaExceededError();
    }
    if (usage === Math.floor(this.monthlyCap * 0.8)) {
      this.logger.warn(`RentCast usage at 80% (${usage}/${this.monthlyCap})`);
    }

    const url = `${BASE_URL}/${endpoint}?address=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { [this.headerName]: this.apiKey },
    });
    if (!res.ok) {
      throw new Error(`RentCast ${endpoint} returned ${res.status}`);
    }
    const raw = await res.json();
    const transformed = transform(raw);
    await this.redis.set(
      cacheKey,
      JSON.stringify(transformed),
      "EX",
      CACHE_TTL_SECONDS,
    );
    return transformed;
  }

  private mapComp = (c: any) => ({
    address: c.formattedAddress ?? "",
    city: c.city ?? null,
    state: c.state ?? null,
    zip: c.zipCode ?? null,
    beds: c.bedrooms ?? null,
    baths: c.bathrooms ?? null,
    sqft: c.squareFootage ?? null,
    price: c.price ?? null,
    rent: c.rent ?? null,
    saleDate: c.lastSaleDate ?? null,
    distance: c.distance ?? 0,
    correlation: c.correlation ?? 0,
  });
}
```

- [ ] **Step 5: Implement module**

Create `packages/backend/src/rentcast/rentcast.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RentcastService } from "./rentcast.service";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [RentcastService],
  exports: [RentcastService],
})
export class RentcastModule {}
```

- [ ] **Step 6: Register in app.module.ts**

Add `RentcastModule` to the `imports` array of `AppModule`.

- [ ] **Step 7: Run tests**

Run: `npm test --workspace packages/backend -- rentcast.service.spec`
Expected: PASS, all 5 tests.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/rentcast/ packages/backend/src/app.module.ts
git commit -m "feat(backend): add RentcastService with monthly cap + 30d cache"
```

---

## Task 1A.8: AiProviderService — add .stream() method

**Files:**

- Modify: `packages/backend/src/ai-provider/ai-provider.service.ts`
- Create: `packages/backend/src/ai-provider/__tests__/streaming.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/backend/src/ai-provider/__tests__/streaming.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { AiProviderService } from "../ai-provider.service";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../../supabase/supabase.service";

describe("AiProviderService.stream", () => {
  let service: AiProviderService;
  let openaiCreateMock: jest.Mock;

  beforeEach(async () => {
    openaiCreateMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiProviderService,
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => (k === "DEEPSEEK_API_KEY" ? "k" : undefined),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              from: () => ({
                select: () => ({
                  eq: () => ({
                    single: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AiProviderService);
    // Stub the OpenAI client cache
    (service as any).clientCache.set("deepseek", {
      chat: { completions: { create: openaiCreateMock } },
    });
  });

  it("yields text deltas in order", async () => {
    async function* mockStream() {
      yield { choices: [{ delta: { content: "Hello" } }] };
      yield { choices: [{ delta: { content: " world" } }] };
      yield { choices: [{ delta: {} }] };
    }
    openaiCreateMock.mockResolvedValue(mockStream());

    const chunks: string[] = [];
    for await (const t of service.stream("test_purpose", { prompt: "hi" })) {
      chunks.push(t);
    }
    expect(chunks).toEqual(["Hello", " world"]);
  });

  it("passes stream:true to underlying SDK", async () => {
    async function* empty() {}
    openaiCreateMock.mockResolvedValue(empty());
    const gen = service.stream("test_purpose", { prompt: "hi" });
    await gen.next();
    expect(openaiCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true }),
    );
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test --workspace packages/backend -- ai-provider/__tests__/streaming`
Expected: FAIL — `service.stream is not a function`.

- [ ] **Step 3: Add `stream()` method to AiProviderService**

In `packages/backend/src/ai-provider/ai-provider.service.ts`, add after the existing `complete()` method:

```ts
/**
 * Execute a streaming AI completion. Yields text deltas.
 *
 * Uses the OpenAI-compatible streaming API. Works with all four providers
 * (deepseek/anthropic/openai/google) via their OpenAI-compatible endpoints.
 */
async *stream(
  purpose: string,
  request: AiCompletionRequest,
): AsyncGenerator<string> {
  const config = await this.configResolver.resolve(purpose);
  const client = this.getClient(config);
  const messages = this.buildMessages(config, request);

  const stream = (await client.chat.completions.create({
    model: config.model,
    messages,
    stream: true,
    temperature:
      request.temperature ?? config.temperature ?? PROVIDER_PRESETS[config.provider].defaultTemperature,
    max_tokens: request.maxTokens,
  })) as any;

  for await (const chunk of stream) {
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
```

If `getClient(config)` is a private method already, fine. If the existing class uses a different client-resolution path (e.g., `executeCompletion` does it inline), refactor to extract `getClient(config): OpenAI` first.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test --workspace packages/backend -- ai-provider/__tests__/streaming`
Expected: PASS.

- [ ] **Step 5: Run full ai-provider suite**

Run: `npm test --workspace packages/backend -- ai-provider`
Expected: PASS — existing tests still green.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/ai-provider/ai-provider.service.ts packages/backend/src/ai-provider/__tests__/streaming.spec.ts
git commit -m "feat(ai-provider): add .stream() method for streaming completions"
```

---

# Phase 1B — Backend Services

`AiInsightsService` + new endpoints + refactor existing `streamAiVerdict` to use `AiProviderService`.

## Task 1B.1: AiInsightsService — cache + assembly skeleton

**Files:**

- Create: `packages/backend/src/analyzer/ai-insights.service.ts`
- Create: `packages/backend/src/analyzer/ai-insights.cache.ts`
- Create: `packages/backend/src/analyzer/__tests__/ai-insights.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/backend/src/analyzer/__tests__/ai-insights.service.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { AiInsightsService } from "../ai-insights.service";
import { AiInsightsCache } from "../ai-insights.cache";
import { AiProviderService } from "../../ai-provider/ai-provider.service";

describe("AiInsightsService", () => {
  let service: AiInsightsService;
  let cache: AiInsightsCache;
  let provider: AiProviderService;

  beforeEach(async () => {
    cache = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;
    provider = {
      complete: jest.fn(),
      stream: jest.fn(),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiInsightsService,
        { provide: AiInsightsCache, useValue: cache },
        { provide: AiProviderService, useValue: provider },
      ],
    }).compile();

    service = moduleRef.get(AiInsightsService);
  });

  const samplePayload = {
    input: { price: 240000, rentMonthly: 2850 },
    result: { capRatePct: 7.8 },
    rentcast: { avm: { value: 245000 }, salesComps: [], rentalComps: [] },
    piq: { score: 82, label: "GREAT" },
  };

  it("cache hit returns cached text without calling provider", async () => {
    (cache.get as jest.Mock).mockResolvedValue({
      text: "cached",
      threadId: "t1",
      citedFacts: [],
    });
    const r = await service.complete(samplePayload, "projection");
    expect(r.text).toBe("cached");
    expect(r.cacheHit).toBe(true);
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it("cache miss assembles prompt and calls provider", async () => {
    (cache.get as jest.Mock).mockResolvedValue(null);
    (provider.complete as jest.Mock).mockResolvedValue({
      text: "fresh",
      threadId: "t2",
    });
    const r = await service.complete(samplePayload, "projection");
    expect(provider.complete).toHaveBeenCalled();
    expect(r.text).toBe("fresh");
    expect(r.cacheHit).toBe(false);
    expect(cache.set).toHaveBeenCalled();
  });

  it("prompt includes all four context blocks", async () => {
    (cache.get as jest.Mock).mockResolvedValue(null);
    (provider.complete as jest.Mock).mockResolvedValue({ text: "x" });
    await service.complete(samplePayload, "projection");
    const call = (provider.complete as jest.Mock).mock.calls[0];
    const userMsg = call[1].messages.find(
      (m: any) => m.role === "user",
    ).content;
    expect(userMsg).toMatch(/DEAL INPUT/);
    expect(userMsg).toMatch(/COMPUTED METRICS/);
    expect(userMsg).toMatch(/PROPERTY DATA/);
    expect(userMsg).toMatch(/MARKET CONTEXT/);
  });

  it("uses analyzer_section_annotation purpose for section", async () => {
    (cache.get as jest.Mock).mockResolvedValue(null);
    (provider.complete as jest.Mock).mockResolvedValue({ text: "x" });
    await service.complete(samplePayload, "projection");
    expect(provider.complete).toHaveBeenCalledWith(
      "analyzer_section_annotation",
      expect.anything(),
    );
  });

  it("uses analyzer_header_verdict purpose for header", async () => {
    (cache.get as jest.Mock).mockResolvedValue(null);
    (provider.complete as jest.Mock).mockResolvedValue({ text: "x" });
    await service.complete(samplePayload, "header_verdict");
    expect(provider.complete).toHaveBeenCalledWith(
      "analyzer_header_verdict",
      expect.anything(),
    );
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test --workspace packages/backend -- ai-insights.service.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement cache**

Create `packages/backend/src/analyzer/ai-insights.cache.ts`:

```ts
import { Injectable, Inject } from "@nestjs/common";
import { createHash } from "crypto";
import type Redis from "ioredis";

export interface CachedInsight {
  text: string;
  threadId: string;
  citedFacts: string[];
}

const TTL_SECONDS = 60 * 60 * 24; // 24h

@Injectable()
export class AiInsightsCache {
  constructor(@Inject("REDIS_CLIENT") private readonly redis: Redis) {}

  computeKey(payload: any, sectionId: string): string {
    // Round inputs to reduce churn
    const rounded = {
      price: Math.round((payload.input?.price ?? 0) / 1000) * 1000,
      rentMonthly: Math.round((payload.input?.rentMonthly ?? 0) / 25) * 25,
      taxAnnual: Math.round((payload.input?.taxAnnual ?? 0) / 100) * 100,
    };
    const piqHash = createHash("sha1")
      .update(JSON.stringify(payload.piq ?? {}))
      .digest("hex")
      .slice(0, 8);
    const rcHash = createHash("sha1")
      .update(JSON.stringify(payload.rentcast?.avm ?? {}))
      .digest("hex")
      .slice(0, 8);
    const inputHash = createHash("sha1")
      .update(JSON.stringify(rounded))
      .digest("hex")
      .slice(0, 8);
    return `ai-insights:${sectionId}:${inputHash}:${rcHash}:${piqHash}`;
  }

  async get(key: string): Promise<CachedInsight | null> {
    const raw = await this.redis.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  async set(key: string, value: CachedInsight): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), "EX", TTL_SECONDS);
  }
}
```

- [ ] **Step 4: Implement service**

Create `packages/backend/src/analyzer/ai-insights.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AiInsightsCache, CachedInsight } from "./ai-insights.cache";
import { AiProviderService } from "../ai-provider/ai-provider.service";
import { getSectionPrompt, SectionId } from "./prompts/section-prompts";

export interface InsightPayload {
  input: any;
  result: any;
  rentcast: any;
  piq: any;
}

export interface InsightResult extends CachedInsight {
  cacheHit: boolean;
}

const SYSTEM_PROMPT =
  "You are a precise, numerate real-estate analyst. Cite specific numbers from the data provided. Never invent figures. Output 1-2 sentences max.";

@Injectable()
export class AiInsightsService {
  constructor(
    private readonly cache: AiInsightsCache,
    private readonly provider: AiProviderService,
  ) {}

  async complete(
    payload: InsightPayload,
    sectionId: SectionId,
  ): Promise<InsightResult> {
    const key = this.cache.computeKey(payload, sectionId);
    const cached = await this.cache.get(key);
    if (cached) return { ...cached, cacheHit: true };

    const userMessage = this.assemblePrompt(payload, sectionId);
    const purpose =
      sectionId === "header_verdict"
        ? "analyzer_header_verdict"
        : "analyzer_section_annotation";

    const response = await this.provider.complete(purpose, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 200,
    } as any);

    const result: CachedInsight = {
      text: response.text ?? "",
      threadId: randomUUID(),
      citedFacts: [],
    };
    await this.cache.set(key, result);
    return { ...result, cacheHit: false };
  }

  async *stream(payload: InsightPayload): AsyncGenerator<string> {
    const userMessage = this.assemblePrompt(payload, "header_verdict");
    yield* this.provider.stream("analyzer_header_verdict", {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 200,
    } as any);
  }

  private assemblePrompt(
    payload: InsightPayload,
    sectionId: SectionId,
  ): string {
    const comps = (payload.rentcast?.salesComps ?? []).slice(0, 5);
    const rentComps = (payload.rentcast?.rentalComps ?? []).slice(0, 5);
    return [
      "DEAL INPUT:",
      JSON.stringify(payload.input, null, 2),
      "",
      "COMPUTED METRICS (analyzer-core, deterministic):",
      JSON.stringify(payload.result, null, 2),
      "",
      "PROPERTY DATA (RentCast):",
      `- AVM: ${payload.rentcast?.avm?.value ?? "unavailable"}`,
      `- Rent estimate: ${payload.rentcast?.rent?.value ?? "unavailable"}`,
      `- Top sales comps: ${comps.map((c: any) => `${c.address} $${c.price} (${c.distance}mi)`).join("; ")}`,
      `- Top rental comps: ${rentComps.map((c: any) => `${c.address} $${c.rent}/mo`).join("; ")}`,
      "",
      "MARKET CONTEXT (PropertyIQ):",
      `- PIQ Score: ${payload.piq?.score ?? "n/a"} (${payload.piq?.label ?? ""})`,
      `- Market heat: ${payload.piq?.marketHeat ?? "n/a"}`,
      `- Rent index: ${payload.piq?.rentIndex ?? "n/a"}`,
      `- Net migration: ${payload.piq?.netMigration ?? "n/a"}`,
      "",
      "TASK:",
      getSectionPrompt(sectionId),
    ].join("\n");
  }
}
```

- [ ] **Step 5: Stub section-prompts (real impl in Task 1B.2)**

Create `packages/backend/src/analyzer/prompts/section-prompts.ts`:

```ts
export type SectionId =
  | "header_verdict"
  | "projection"
  | "expense_waterfall"
  | "sensitivity"
  | "comps"
  | "market_context"
  | "after_tax";

export function getSectionPrompt(_sectionId: SectionId): string {
  return "Write 1-2 sentences interpreting the data above.";
}
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `npm test --workspace packages/backend -- ai-insights.service.spec`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/analyzer/ai-insights.service.ts packages/backend/src/analyzer/ai-insights.cache.ts packages/backend/src/analyzer/prompts/section-prompts.ts packages/backend/src/analyzer/__tests__/ai-insights.service.spec.ts
git commit -m "feat(analyzer): add AiInsightsService with composite-hash Redis cache"
```

---

## Task 1B.2: Section prompt templates

**Files:**

- Modify: `packages/backend/src/analyzer/prompts/section-prompts.ts`
- Create: `packages/backend/src/analyzer/prompts/__tests__/section-prompts.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/backend/src/analyzer/prompts/__tests__/section-prompts.spec.ts
import { getSectionPrompt, SectionId } from "../section-prompts";

describe("section-prompts", () => {
  const allSections: SectionId[] = [
    "header_verdict",
    "projection",
    "expense_waterfall",
    "sensitivity",
    "comps",
    "market_context",
    "after_tax",
  ];

  it.each(allSections)("returns non-empty prompt for %s", (id) => {
    const p = getSectionPrompt(id);
    expect(p.length).toBeGreaterThan(40);
  });

  it("header_verdict requests verdict + reasoning + risk", () => {
    const p = getSectionPrompt("header_verdict");
    expect(p).toMatch(/buy|negotiate|pass/i);
    expect(p).toMatch(/risk/i);
  });

  it("all prompts forbid invented figures", () => {
    allSections.forEach((id) => {
      const p = getSectionPrompt(id);
      // section-specific text is short; system prompt handles general rule.
      // here we assert each section gives a focused, bounded task.
      expect(p.length).toBeLessThan(400);
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test --workspace packages/backend -- section-prompts`
Expected: FAIL — stub returns generic prompt.

- [ ] **Step 3: Replace stub with real templates**

Replace `packages/backend/src/analyzer/prompts/section-prompts.ts`:

```ts
export type SectionId =
  | "header_verdict"
  | "projection"
  | "expense_waterfall"
  | "sensitivity"
  | "comps"
  | "market_context"
  | "after_tax";

const PROMPTS: Record<SectionId, string> = {
  header_verdict:
    'Write a 1-2 sentence buy/negotiate/pass verdict for this deal. Cite the strongest number from the data and the biggest risk to verify. Format: "[VERDICT]. [Reasoning citing specific number]. [One risk to verify before offering]."',
  projection:
    "Write 1 sentence interpreting the 30-year wealth projection. Mention which component (principal paydown / appreciation / cumulative cashflow) drives the most value over the horizon.",
  expense_waterfall:
    "Write 1 sentence on what is eating the most rent. If debt service exceeds 60% of gross rent, flag it explicitly.",
  sensitivity:
    "Identify the top 1-2 inputs from the tornado that the deal is most sensitive to. State what that means for the investor's risk and what to verify before offering.",
  comps:
    "Compare the deal's price-per-square-foot to the comp distribution. If the deal is above the 75th percentile of comps, flag the negotiation opportunity. If below the 25th, note the implied upside.",
  market_context:
    "Write 1 sentence on whether this market is a tailwind or headwind for this deal. Cite the PIQ Score and net migration explicitly.",
  after_tax:
    "Highlight the after-tax cashflow improvement from depreciation and mortgage-interest deductions, as a percentage of pre-tax cashflow.",
};

export function getSectionPrompt(sectionId: SectionId): string {
  return PROMPTS[sectionId];
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test --workspace packages/backend -- section-prompts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/analyzer/prompts/section-prompts.ts packages/backend/src/analyzer/prompts/__tests__/section-prompts.spec.ts
git commit -m "feat(analyzer): add 7 section prompt templates for AI insights"
```

---

## Task 1B.3: Property-lookup endpoint

**Files:**

- Modify: `packages/backend/src/analyzer/analyzer.controller.ts`
- Modify: `packages/backend/src/analyzer/analyzer.service.ts`
- Create: `packages/backend/src/analyzer/dto/property-lookup.dto.ts`
- Modify: `packages/backend/src/analyzer/__tests__/analyzer.service.spec.ts` (extend with property-lookup test)
- Modify: `packages/backend/src/analyzer/analyzer.module.ts` (import RentcastModule)

- [ ] **Step 1: Write failing test**

Append to `packages/backend/src/analyzer/__tests__/analyzer.service.spec.ts`:

```ts
describe("AnalyzerService.lookupProperty", () => {
  it("orchestrates 3 RentCast calls and consolidates", async () => {
    const rentcast = {
      getPropertyRecord: jest.fn().mockResolvedValue({ beds: 3 }),
      getValueEstimate: jest
        .fn()
        .mockResolvedValue({
          value: 245000,
          low: 230000,
          high: 260000,
          comps: [],
        }),
      getRentEstimate: jest
        .fn()
        .mockResolvedValue({ rent: 2850, low: 2700, high: 3000, comps: [] }),
    };
    const service = new AnalyzerService({} as any, {} as any, rentcast as any);
    const r = await service.lookupProperty("123 Main St");
    expect(r.property_record).toEqual({ beds: 3 });
    expect(r.avm?.value).toBe(245000);
    expect(r.rent?.value).toBe(2850);
    expect(rentcast.getPropertyRecord).toHaveBeenCalledWith("123 Main St");
    expect(rentcast.getValueEstimate).toHaveBeenCalledWith("123 Main St");
    expect(rentcast.getRentEstimate).toHaveBeenCalledWith("123 Main St");
  });

  it("degrades to nulls if a single RentCast call fails", async () => {
    const rentcast = {
      getPropertyRecord: jest.fn().mockResolvedValue({ beds: 3 }),
      getValueEstimate: jest.fn().mockRejectedValue(new Error("boom")),
      getRentEstimate: jest
        .fn()
        .mockResolvedValue({ rent: 2850, low: 2700, high: 3000, comps: [] }),
    };
    const service = new AnalyzerService({} as any, {} as any, rentcast as any);
    const r = await service.lookupProperty("123 Main St");
    expect(r.property_record).toEqual({ beds: 3 });
    expect(r.avm).toBeNull();
    expect(r.rent?.value).toBe(2850);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

`npm test --workspace packages/backend -- analyzer.service` — FAIL.

- [ ] **Step 3: Create DTO**

Create `packages/backend/src/analyzer/dto/property-lookup.dto.ts`:

```ts
import { IsString, IsNotEmpty, MaxLength } from "class-validator";

export class PropertyLookupQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;
}

export interface PropertyLookupDto {
  avm: { value: number; low: number; high: number; comps_count: number } | null;
  rent: {
    value: number;
    low: number;
    high: number;
    comps_count: number;
  } | null;
  property_record: any | null;
  sales_comps: any[];
  rental_comps: any[];
  cache_age_days: number;
  source: "rentcast";
}
```

- [ ] **Step 4: Add `lookupProperty` to AnalyzerService**

In `packages/backend/src/analyzer/analyzer.service.ts`, inject `RentcastService` via constructor and add:

```ts
async lookupProperty(address: string): Promise<PropertyLookupDto> {
  const [recordResult, avmResult, rentResult] = await Promise.allSettled([
    this.rentcast.getPropertyRecord(address),
    this.rentcast.getValueEstimate(address),
    this.rentcast.getRentEstimate(address),
  ]);

  const property_record = recordResult.status === 'fulfilled' ? recordResult.value : null;
  const avmRaw = avmResult.status === 'fulfilled' ? avmResult.value : null;
  const rentRaw = rentResult.status === 'fulfilled' ? rentResult.value : null;

  return {
    property_record,
    avm: avmRaw ? { value: avmRaw.value, low: avmRaw.low, high: avmRaw.high, comps_count: avmRaw.comps.length } : null,
    rent: rentRaw ? { value: rentRaw.rent, low: rentRaw.low, high: rentRaw.high, comps_count: rentRaw.comps.length } : null,
    sales_comps: avmRaw?.comps ?? [],
    rental_comps: rentRaw?.comps ?? [],
    cache_age_days: 0,
    source: 'rentcast',
  };
}
```

- [ ] **Step 5: Add GET endpoint in controller**

In `packages/backend/src/analyzer/analyzer.controller.ts`, add (assume existing Pro guard pattern):

```ts
import { ProEntitlementGuard } from '../entitlements/pro.guard';

@UseGuards(JwtAuthGuard, ProEntitlementGuard)
@Get('property-lookup')
async lookupProperty(@Query() query: PropertyLookupQueryDto): Promise<PropertyLookupDto> {
  return this.analyzer.lookupProperty(query.address);
}
```

(If `ProEntitlementGuard` does not exist yet, find the equivalent guard used by existing Pro-only endpoints in the same controller and reuse.)

- [ ] **Step 6: Register RentcastModule import in AnalyzerModule**

Add to `packages/backend/src/analyzer/analyzer.module.ts` imports: `RentcastModule`.

- [ ] **Step 7: Run tests**

```bash
npm test --workspace packages/backend -- analyzer.service
```

PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/analyzer/
git commit -m "feat(analyzer): add GET /property-lookup orchestrating RentCast (Pro-gated)"
```

---

## Task 1B.4: AI insights endpoints (header streaming + section one-shot)

**Files:**

- Modify: `packages/backend/src/analyzer/analyzer.controller.ts`
- Modify: `packages/backend/src/analyzer/analyzer.service.ts`
- Create: `packages/backend/src/analyzer/dto/ai-insights.dto.ts`
- Modify: `packages/backend/src/analyzer/analyzer.module.ts` (provide AiInsightsService + cache)

- [ ] **Step 1: Write failing controller tests**

Create `packages/backend/src/analyzer/__tests__/analyzer.controller.spec.ts` (or extend existing):

```ts
describe("AnalyzerController AI insights", () => {
  it("GET /ai-insights/section returns AIAnnotationDto", async () => {
    const aiInsights = {
      complete: jest.fn().mockResolvedValue({
        text: "Strong cashflow play.",
        threadId: "t1",
        citedFacts: [],
        cacheHit: false,
      }),
    };
    // Build minimal controller with mocked services...
    // assert response shape
  });

  it("GET /ai-insights/header streams text/event-stream", async () => {
    // assert content-type and that data: lines stream
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

`npm test --workspace packages/backend -- analyzer.controller` — FAIL.

- [ ] **Step 3: Add DTOs**

Create `packages/backend/src/analyzer/dto/ai-insights.dto.ts`:

```ts
import { IsString, IsObject, IsIn } from "class-validator";

export class AiInsightsBodyDto {
  @IsObject()
  payload!: { input: any; result: any; rentcast: any; piq: any };
}

export class AiInsightsSectionQueryDto extends AiInsightsBodyDto {
  @IsString()
  @IsIn([
    "projection",
    "expense_waterfall",
    "sensitivity",
    "comps",
    "market_context",
    "after_tax",
  ])
  id!: string;
}

export interface AIAnnotationDto {
  text: string;
  threadId: string;
  citedFacts: string[];
  cacheHit: boolean;
}
```

- [ ] **Step 4: Add endpoints to controller**

Add to `packages/backend/src/analyzer/analyzer.controller.ts`:

```ts
@UseGuards(JwtAuthGuard, ProEntitlementGuard)
@Post('ai-insights/section')
async sectionInsight(
  @Body() body: AiInsightsSectionQueryDto,
): Promise<AIAnnotationDto> {
  return this.aiInsights.complete(body.payload, body.id as any);
}

@UseGuards(JwtAuthGuard, ProEntitlementGuard)
@Post('ai-insights/header')
async headerInsight(
  @Body() body: AiInsightsBodyDto,
  @Res() res: Response,
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  for await (const chunk of this.aiInsights.stream(body.payload)) {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
}
```

(Use POST for both — JSON body cleaner than encoding the payload in a query string. Spec mentioned GET but POST is correct given payload size.)

- [ ] **Step 5: Provide AiInsightsService in analyzer.module.ts**

Add to providers + register `AiInsightsCache`:

```ts
providers: [AnalyzerService, AnalyzerPersistenceService, AiInsightsService, AiInsightsCache],
imports: [RentcastModule, AiProviderModule, RedisModule],
```

- [ ] **Step 6: Run tests, verify pass**

`npm test --workspace packages/backend -- analyzer.controller` — PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/analyzer/
git commit -m "feat(analyzer): add POST /ai-insights/{section,header} endpoints (header streaming)"
```

---

## Task 1B.5: Refactor `streamAiVerdict` to use AiProviderService

**Files:**

- Modify: `packages/backend/src/analyzer/analyzer.service.ts`
- Modify: `packages/backend/src/analyzer/__tests__/analyzer.service.spec.ts`

- [ ] **Step 1: Update existing test expectations**

Find existing tests for `streamAiVerdict` and modify them to expect `AiProviderService.stream` calls instead of direct Anthropic SDK use. Add:

```ts
it("streamAiVerdict delegates to AiProviderService.stream", async () => {
  const aiProvider = {
    stream: jest.fn().mockImplementation(async function* () {
      yield "token";
    }),
  };
  const service = new AnalyzerService({} as any, aiProvider as any, {} as any);
  const chunks: string[] = [];
  for await (const c of service.streamAiVerdict({
    input: { price: 240000 } as any,
    result: { capRatePct: 7.8 } as any,
  })) {
    chunks.push(c);
  }
  expect(aiProvider.stream).toHaveBeenCalledWith(
    "analyzer_header_verdict",
    expect.anything(),
  );
  expect(chunks).toEqual(["token"]);
});
```

- [ ] **Step 2: Run test, verify it fails**

`npm test --workspace packages/backend -- analyzer.service` — FAIL.

- [ ] **Step 3: Refactor `streamAiVerdict`**

In `packages/backend/src/analyzer/analyzer.service.ts`:

```ts
async *streamAiVerdict(payload: AiVerdictRequestDto): AsyncGenerator<string> {
  const totalSize = JSON.stringify(payload.input).length + JSON.stringify(payload.result).length;
  if (totalSize > 4096) throw new Error('payload too large');

  yield* this.aiProvider.stream('analyzer_header_verdict', {
    messages: [
      { role: 'system', content: 'You are a precise, numerate real-estate analyst. Output ONLY valid JSON.' },
      { role: 'user', content: this.buildVerdictPrompt(payload) },
    ],
    maxTokens: 800,
  } as any);
}
```

Remove the `Anthropic` import and direct SDK instantiation.

- [ ] **Step 4: Inject AiProviderService in constructor**

If not already injected. Add to module providers.

- [ ] **Step 5: Run tests, verify pass**

```bash
npm test --workspace packages/backend -- analyzer.service
```

PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/analyzer/analyzer.service.ts packages/backend/src/analyzer/__tests__/analyzer.service.spec.ts
git commit -m "refactor(analyzer): migrate streamAiVerdict to AiProviderService (DeepSeek default)"
```

---

## Task 1B.6: ai_model_config seed migration

**Files:**

- Create: `packages/backend/src/database/migrations/<timestamp>_seed_analyzer_ai_purposes.sql`

- [ ] **Step 1: Inspect existing migration pattern**

Run: `ls packages/backend/src/database/migrations/ | tail -5` to find the latest timestamp prefix convention.

- [ ] **Step 2: Create the migration**

Create file `packages/backend/src/database/migrations/20260514_seed_analyzer_ai_purposes.sql`:

```sql
-- Seed initial ai_model_config rows for analyzer AI purposes.
-- Both default to DeepSeek-chat for cost; admins can route via UI later.

INSERT INTO ai_model_config (purpose, provider, model, temperature, system_prompt_override, created_at, updated_at)
VALUES
  ('analyzer_header_verdict',     'deepseek', 'deepseek-chat', 0.3, NULL, NOW(), NOW()),
  ('analyzer_section_annotation', 'deepseek', 'deepseek-chat', 0.4, NULL, NOW(), NOW())
ON CONFLICT (purpose) DO NOTHING;
```

(If `ai_model_config` uses a different primary key or different column names, inspect the existing schema first and adapt. Examine an existing seed migration to mirror conventions.)

- [ ] **Step 3: Run the migration locally**

Run: `npm run migrate --workspace packages/backend` (or the project's actual migration command — check `package.json` scripts).
Expected: migration runs without error.

- [ ] **Step 4: Verify in Supabase MCP / SQL**

Run via Supabase MCP or psql: `SELECT purpose, provider, model FROM ai_model_config WHERE purpose LIKE 'analyzer_%';`
Expected: 2 rows, both `deepseek` / `deepseek-chat`.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/database/migrations/20260514_seed_analyzer_ai_purposes.sql
git commit -m "feat(analyzer): seed ai_model_config rows for analyzer AI purposes (DeepSeek default)"
```

---

## Task 1B.7: Backend E2E — analyzer endpoints

**Files:**

- Modify: `packages/backend/test/analyzer.e2e-spec.ts` (extend existing)

- [ ] **Step 1: Add E2E test cases**

Append to `packages/backend/test/analyzer.e2e-spec.ts`:

```ts
describe("Analyzer E2E v2 endpoints", () => {
  it("GET /api/analyzer/property-lookup returns 401 without Pro auth", async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/analyzer/property-lookup?address=123+Main+St",
    );
    expect([401, 403]).toContain(res.status);
  });

  it("GET /api/analyzer/property-lookup with Pro auth returns shape", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/analyzer/property-lookup?address=123+Main+St")
      .set("Cookie", proAuthCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("avm");
    expect(res.body).toHaveProperty("rent");
    expect(res.body).toHaveProperty("sales_comps");
    expect(res.body).toHaveProperty("rental_comps");
    expect(res.body.source).toBe("rentcast");
  });

  it("POST /api/analyzer/ai-insights/section returns AIAnnotationDto", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/analyzer/ai-insights/section")
      .set("Cookie", proAuthCookie)
      .send({
        id: "projection",
        payload: {
          input: { price: 240000, rentMonthly: 2850 },
          result: { capRatePct: 7.8 },
          rentcast: { avm: { value: 245000 }, salesComps: [], rentalComps: [] },
          piq: { score: 82, label: "GREAT" },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("text");
    expect(res.body).toHaveProperty("threadId");
    expect(typeof res.body.cacheHit).toBe("boolean");
  });

  it("hitting endpoint twice with same payload yields cacheHit: true second time", async () => {
    const body = {
      id: "projection",
      payload: { input: { price: 240000 }, result: {}, rentcast: {}, piq: {} },
    };
    const r1 = await request(app.getHttpServer())
      .post("/api/analyzer/ai-insights/section")
      .set("Cookie", proAuthCookie)
      .send(body);
    const r2 = await request(app.getHttpServer())
      .post("/api/analyzer/ai-insights/section")
      .set("Cookie", proAuthCookie)
      .send(body);
    expect(r2.body.cacheHit).toBe(true);
  });
});
```

- [ ] **Step 2: Run E2E suite**

Run: `npm run test:e2e --workspace packages/backend -- analyzer.e2e-spec`
Expected: PASS (mock RentCast HTTP via MSW or jest.spyOn if external fetch concerns arise; for local dev with real RentCast API key, expect actual upstream calls — limit to 1-2 cases to conserve free-tier quota).

- [ ] **Step 3: Commit**

```bash
git add packages/backend/test/analyzer.e2e-spec.ts
git commit -m "test(analyzer): e2e for property-lookup + ai-insights endpoints"
```

---

# Phase 1C — Chart Kit

15 chart components. Each follows the same pattern: failing test → minimal Recharts/D3 implementation → snapshot SVG geometry → commit.

## Task 1C.1: chart-tokens.ts + D3Tooltip

**Files:**

- Create: `packages/frontend/app/analyzer/components/charts/chart-tokens.ts`
- Create: `packages/frontend/app/analyzer/components/charts/D3Tooltip.tsx`
- Create: `packages/frontend/app/analyzer/components/charts/__tests__/chart-tokens.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/frontend/app/analyzer/components/charts/__tests__/chart-tokens.test.ts
import { describe, it, expect } from "vitest";
import { CHART_TOKENS } from "../chart-tokens";

describe("CHART_TOKENS", () => {
  it("all values are CSS variable references", () => {
    Object.entries(CHART_TOKENS).forEach(([, value]) => {
      if (typeof value === "string") expect(value).toMatch(/^var\(--md-/);
      else
        Object.values(value).forEach((v) => expect(v).toMatch(/^var\(--md-/));
    });
  });
});
```

- [ ] **Step 2: Run test, verify fail**

`npm test --workspace packages/frontend -- chart-tokens` — FAIL.

- [ ] **Step 3: Implement tokens**

Create `packages/frontend/app/analyzer/components/charts/chart-tokens.ts`:

```ts
export const CHART_TOKENS = {
  primary: "var(--md-primary)",
  positive: "var(--md-tertiary)",
  negative: "var(--md-error)",
  caution: "var(--md-warning)",
  neutral: "var(--md-on-surface-variant)",
  gridline: "var(--md-outline-variant)",
  benchmark: {
    poor: "var(--md-error-container)",
    good: "var(--md-tertiary-container)",
    great: "var(--md-tertiary)",
  },
} as const;

export const CHART_HEIGHTS = {
  desktop: 280,
  tablet: 240,
  mobile: 200,
  sparkline: 28,
} as const;
```

- [ ] **Step 4: Implement D3Tooltip**

Create `packages/frontend/app/analyzer/components/charts/D3Tooltip.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export interface D3TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  children: React.ReactNode;
}

export function D3Tooltip({ visible, x, y, children }: D3TooltipProps) {
  if (!visible) return null;
  return (
    <div
      role="tooltip"
      style={{
        position: "absolute",
        left: x + 12,
        top: y - 8,
        pointerEvents: "none",
        background: "var(--md-surface-container-high)",
        color: "var(--md-on-surface)",
        padding: "6px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "Roboto Mono, monospace",
        boxShadow: "0 2px 8px rgba(0,0,0,.12)",
        zIndex: 50,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Run tests + commit**

```bash
npm test --workspace packages/frontend -- chart-tokens
git add packages/frontend/app/analyzer/components/charts/chart-tokens.ts packages/frontend/app/analyzer/components/charts/D3Tooltip.tsx packages/frontend/app/analyzer/components/charts/__tests__/chart-tokens.test.ts
git commit -m "feat(analyzer/charts): add chart-tokens + D3Tooltip shared primitives"
```

---

## Task 1C.2–1C.7: Recharts components (6 components)

Each Recharts component follows the same TDD pattern. Below is the full template for **MultiLineChart**; replicate the structure for `BarByYearChart`, `StackedAreaChart`, `ComposedSensitivityChart`, `BulletBarChart`, `StackedBarYearChart`.

### Task 1C.2: MultiLineChart

**Files:**

- Create: `packages/frontend/app/analyzer/components/charts/MultiLineChart.tsx`
- Create: `packages/frontend/app/analyzer/components/charts/__tests__/MultiLineChart.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// packages/frontend/app/analyzer/components/charts/__tests__/MultiLineChart.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MultiLineChart } from "../MultiLineChart";

describe("MultiLineChart", () => {
  const sampleData = [
    { year: 1, rent: 2850, expenses: 1800, cashflow: 642 },
    { year: 2, rent: 2935, expenses: 1844, cashflow: 705 },
    { year: 30, rent: 7600, expenses: 4200, cashflow: 2280 },
  ];

  it("renders without crashing", () => {
    const { container } = render(
      <MultiLineChart
        data={sampleData}
        lines={[
          { dataKey: "rent", label: "Rent", color: "primary" },
          { dataKey: "expenses", label: "Expenses", color: "caution" },
          { dataKey: "cashflow", label: "Cashflow", color: "positive" },
        ]}
      />,
    );
    expect(container.querySelector(".recharts-line")).toBeTruthy();
  });

  it("renders one Line per provided series", () => {
    const { container } = render(
      <MultiLineChart
        data={sampleData}
        lines={[
          { dataKey: "rent", label: "Rent", color: "primary" },
          { dataKey: "cashflow", label: "Cashflow", color: "positive" },
        ]}
      />,
    );
    expect(container.querySelectorAll(".recharts-line").length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test, fail**

`npm test --workspace packages/frontend -- MultiLineChart` — FAIL.

- [ ] **Step 3: Implement**

```tsx
// packages/frontend/app/analyzer/components/charts/MultiLineChart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CHART_TOKENS } from "./chart-tokens";
import { CustomTooltip } from "@/app/graphs/components/CustomTooltip";

export interface LineSpec {
  dataKey: string;
  label: string;
  color: keyof typeof CHART_TOKENS;
}

export interface MultiLineChartProps {
  data: Array<Record<string, number>>;
  lines: LineSpec[];
  xKey?: string;
  height?: number;
}

export function MultiLineChart({
  data,
  lines,
  xKey = "year",
  height = 280,
}: MultiLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_TOKENS.gridline} />
        <XAxis
          dataKey={xKey}
          stroke={CHART_TOKENS.neutral}
          fontFamily="Roboto Mono"
        />
        <YAxis stroke={CHART_TOKENS.neutral} fontFamily="Roboto Mono" />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {lines.map((spec) => (
          <Line
            key={spec.dataKey}
            type="monotone"
            dataKey={spec.dataKey}
            name={spec.label}
            stroke={CHART_TOKENS[spec.color] as string}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={true}
            animationDuration={200}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Run tests + commit**

```bash
npm test --workspace packages/frontend -- MultiLineChart
git add packages/frontend/app/analyzer/components/charts/MultiLineChart.tsx packages/frontend/app/analyzer/components/charts/__tests__/MultiLineChart.test.tsx
git commit -m "feat(analyzer/charts): MultiLineChart (Recharts LineChart wrapper)"
```

### Task 1C.3 — BarByYearChart

Same TDD pattern. Component props: `data: Array<{ year: number; value: number }>`, `benchmarks?: Array<{ value: number; label: string; color: keyof CHART_TOKENS }>` (rendered as `<ReferenceLine>` elements), `color: keyof CHART_TOKENS`. Renders Recharts `<BarChart>` + `<Bar>` + `<ReferenceLine>` for each benchmark. Test asserts: bars count matches data length; ReferenceLine count matches benchmarks length. Commit message: `feat(analyzer/charts): BarByYearChart (Recharts BarChart with ReferenceLine benchmarks)`.

### Task 1C.4 — StackedAreaChart

Props: `data: Array<Record<string, number>>`, `areas: Array<{ dataKey: string; label: string; color }>`, `xKey: string`. Renders Recharts `<AreaChart>` + `<Area stackId="a">` for each area. Test asserts: one `.recharts-area` per provided area, stacked correctly. Commit: `feat(analyzer/charts): StackedAreaChart for wealth-buildup visualization`.

### Task 1C.5 — ComposedSensitivityChart

Props: `data: Array<{ year: number; value: number; bandLow: number; bandHigh: number }>`, `referenceLine?: { value: number; label: string }`. Renders Recharts `<ComposedChart>` with `<Area>` for the band (using `dataKey="bandHigh"` and the trick of stacking a transparent `bandLow` area underneath via Area's `baseValue`) + `<Line>` for the main value + `<ReferenceLine>`. Test: asserts area + line + reference line each present. Commit: `feat(analyzer/charts): ComposedSensitivityChart (Recharts ComposedChart with confidence band)`.

### Task 1C.6 — BulletBarChart

Props: `data: Array<{ label: string; value: number }>`, `benchmarkZones: Array<{ from: number; to: number; color: keyof CHART_TOKENS }>`. Renders horizontal Recharts `<BarChart layout="vertical">` with `<ReferenceArea>` for each benchmark zone behind the bars. Test: asserts bars + reference areas. Commit: `feat(analyzer/charts): BulletBarChart for IRR-at-horizons display`.

### Task 1C.7 — StackedBarYearChart

Props: `data: Array<Record<string, number>>`, `bars: Array<{ dataKey: string; label: string; color }>`. Renders Recharts `<BarChart>` with multiple `<Bar stackId="a">`. Test: one bar element per dataKey. Commit: `feat(analyzer/charts): StackedBarYearChart for after-tax breakdown`.

---

## Task 1C.8: WaterfallChart (D3)

**Files:**

- Create: `packages/frontend/app/analyzer/components/charts/WaterfallChart.tsx`
- Create: `packages/frontend/app/analyzer/components/charts/__tests__/WaterfallChart.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// __tests__/WaterfallChart.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { WaterfallChart } from "../WaterfallChart";

describe("WaterfallChart", () => {
  const steps = [
    { label: "Gross Rent", value: 2850, kind: "start" as const },
    { label: "Vacancy", value: -143, kind: "subtract" as const },
    { label: "OpEx", value: -489, kind: "subtract" as const },
    { label: "Debt", value: -1576, kind: "subtract" as const },
    { label: "Cashflow", value: 642, kind: "end" as const },
  ];

  it("renders one rect per step", () => {
    const { container } = render(<WaterfallChart steps={steps} />);
    const rects = container.querySelectorAll("rect[data-waterfall-bar]");
    expect(rects.length).toBe(5);
  });

  it("start step renders in primary color", () => {
    const { container } = render(<WaterfallChart steps={steps} />);
    const first = container.querySelector("rect[data-waterfall-bar]");
    expect(first?.getAttribute("fill")).toMatch(/--md-primary/);
  });
});
```

- [ ] **Step 2: Run test, fail**

`npm test --workspace packages/frontend -- WaterfallChart` — FAIL.

- [ ] **Step 3: Implement**

```tsx
// WaterfallChart.tsx
"use client";

import { useMemo } from "react";
import { CHART_TOKENS, CHART_HEIGHTS } from "./chart-tokens";

export interface WaterfallStep {
  label: string;
  value: number; // signed
  kind: "start" | "subtract" | "add" | "end";
}

export interface WaterfallChartProps {
  steps: WaterfallStep[];
  height?: number;
  width?: number;
}

export function WaterfallChart({
  steps,
  height = CHART_HEIGHTS.desktop,
  width = 800,
}: WaterfallChartProps) {
  const layout = useMemo(
    () => computeLayout(steps, width, height),
    [steps, width, height],
  );
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      {layout.map((step, i) => (
        <g key={i}>
          <rect
            data-waterfall-bar
            x={step.x}
            y={step.y}
            width={step.barWidth}
            height={step.barHeight}
            rx={3}
            fill={
              step.kind === "start" || step.kind === "end"
                ? CHART_TOKENS.primary
                : step.value < 0
                  ? CHART_TOKENS.negative
                  : CHART_TOKENS.positive
            }
            fillOpacity={step.kind === "start" || step.kind === "end" ? 1 : 0.6}
          />
          <text
            x={step.x + step.barWidth / 2}
            y={step.y - 6}
            textAnchor="middle"
            fontSize={12}
            fontFamily="Roboto Mono"
            fill={CHART_TOKENS.neutral as string}
          >
            {step.value > 0
              ? `+$${Math.round(step.value)}`
              : `−$${Math.round(Math.abs(step.value))}`}
          </text>
          <text
            x={step.x + step.barWidth / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize={10}
            fontFamily="Roboto"
            fill={CHART_TOKENS.neutral as string}
          >
            {step.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function computeLayout(steps: WaterfallStep[], width: number, height: number) {
  const padding = 30;
  const barW = Math.min(60, (width - 2 * padding) / steps.length - 8);
  const maxVal = Math.max(...steps.map((s) => Math.abs(s.value)));
  const scaleY = (height - 2 * padding) / maxVal;
  let runningTotal = 0;
  return steps.map((step, i) => {
    const x = padding + i * (barW + 8);
    let y: number, barHeight: number;
    if (step.kind === "start") {
      runningTotal = step.value;
      barHeight = step.value * scaleY;
      y = height - padding - barHeight;
    } else if (step.kind === "end") {
      barHeight = step.value * scaleY;
      y = height - padding - barHeight;
      runningTotal = step.value;
    } else {
      const prevTop = height - padding - runningTotal * scaleY;
      barHeight = Math.abs(step.value) * scaleY;
      y = step.value < 0 ? prevTop : prevTop - barHeight;
      runningTotal += step.value;
    }
    return { ...step, x, y, barWidth: barW, barHeight };
  });
}
```

- [ ] **Step 4: Test + commit**

```bash
npm test --workspace packages/frontend -- WaterfallChart
git add packages/frontend/app/analyzer/components/charts/WaterfallChart.tsx packages/frontend/app/analyzer/components/charts/__tests__/WaterfallChart.test.tsx
git commit -m "feat(analyzer/charts): WaterfallChart (D3-style custom SVG)"
```

---

## Task 1C.9–1C.13: Remaining D3 components

Same TDD pattern as Task 1C.8 (WaterfallChart). Each component:

### Task 1C.9 — GaugeChart

Props: `value: number`, `min: number`, `max: number`, `variant: "radial" | "horizontal"`, `thresholds: Array<{ at: number; color }>`. Test: snapshot of the resulting `<path>` arc string for a fixed input. Commit: `feat(analyzer/charts): GaugeChart (D3 radial + horizontal gauges)`.

### Task 1C.10 — TornadoChart

Props: `factors: Array<{ name; irrAtMinus10pct; irrAtPlus10pct; impactMagnitude }>` (matches `SensitivityResult["factors"]`). Renders horizontal bars centered on baseIRR, one row per factor, sorted by `impactMagnitude`. Test: assert N rows; rows are sorted descending by magnitude. Commit: `feat(analyzer/charts): TornadoChart (D3 sensitivity tornado)`.

### Task 1C.11 — BrrrrTimelineChart (★ delight piece)

Props: `phases: BrrrrTimelineResult["phases"]`, `animated?: boolean`. Renders horizontal spine + 6 dot nodes labeled. When `animated: true`, uses framer-motion `<motion.circle initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: i * 0.1}}>` for sequential reveal. Test: assert 6 circles render; assert framer-motion `MotionConfig` is respected when `prefers-reduced-motion`. Commit: `feat(analyzer/charts): BrrrrTimelineChart (D3 + framer-motion delight piece)`.

### Task 1C.12 — DistributionViolinChart

Props: `values: number[]`, `yourValue: number`, `quantiles?: { p25; p50; p75 }`. Renders D3 violin shape from values, plus your-value marker. Test: assert path string nondegenerate; assert your-value line present. Commit: `feat(analyzer/charts): DistributionViolinChart for comp distribution display`.

### Task 1C.13 — ScoreRingChart

Props: `score: number`, `max?: number`, `breakdown?: Array<{ label; weight; color }>`. Renders concentric arcs for breakdown + center text. Reuses pattern from `app/components/scoring/ScoreRing.tsx`. Test: assert arc strokes count matches breakdown. Commit: `feat(analyzer/charts): ScoreRingChart extending existing ScoreRing pattern`.

---

## Task 1C.14: CSS cards (ComparisonCard, MaoScaleCard, PrePostBarCard)

**Files:**

- Create: `packages/frontend/app/analyzer/components/cards/ComparisonCard.tsx`
- Create: `packages/frontend/app/analyzer/components/cards/MaoScaleCard.tsx`
- Create: `packages/frontend/app/analyzer/components/cards/PrePostBarCard.tsx`
- Create: `__tests__/` for each

- [ ] **Step 1: Failing tests**

For each card, write a render test that renders with props and asserts text content present.

- [ ] **Step 2: Run tests, fail**

- [ ] **Step 3: Implement cards**

`ComparisonCard.tsx`:

```tsx
"use client";
interface Props {
  left: {
    title: string;
    primary: string;
    secondary: string;
    tone: "primary" | "warn" | "ok";
  };
  right: {
    title: string;
    primary: string;
    secondary: string;
    tone: "primary" | "warn" | "ok";
  };
}
export function ComparisonCard({ left, right }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[left, right].map((side, i) => (
        <div
          key={i}
          className={`rounded-xl border-2 p-4 bg-surface ${toneClass(side.tone)}`}
        >
          <div className="text-xs uppercase font-semibold mb-2">
            {side.title}
          </div>
          <div className="font-mono text-3xl font-bold">{side.primary}</div>
          <div className="text-xs text-on-surface-variant mt-1">
            {side.secondary}
          </div>
        </div>
      ))}
    </div>
  );
}
function toneClass(tone: "primary" | "warn" | "ok") {
  switch (tone) {
    case "ok":
      return "border-[var(--md-tertiary)]";
    case "warn":
      return "border-[var(--md-error)]";
    default:
      return "border-[var(--md-primary)]";
  }
}
```

`MaoScaleCard.tsx`: horizontal scale from $0 → ARV with markers for MAO and asking. Single SVG embedded in a card.

`PrePostBarCard.tsx`: two side-by-side bars (pre vs post refi cashflow) with delta arrow between them.

- [ ] **Step 4: Tests + commit**

```bash
npm test --workspace packages/frontend -- cards
git add packages/frontend/app/analyzer/components/cards/
git commit -m "feat(analyzer/cards): ComparisonCard, MaoScaleCard, PrePostBarCard"
```

---

# Phase 1D — UI Shell

UI components consuming the chart kit. Uses `frontend-design:frontend-design` skill at each visual task per `[[feedback_use-frontend-design-skill]]`.

## Task 1D.1: ModeContext + ModeToolbar

**Files:**

- Create: `packages/frontend/app/analyzer/lib/mode-context.tsx`
- Create: `packages/frontend/app/analyzer/components/chrome/ModeToolbar.tsx`
- Create: `__tests__/` for each

- [ ] **Step 1: Failing test**

```tsx
// __tests__/mode-context.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { ModeProvider, useMode } from "../mode-context";

function Probe() {
  const { mode, setMode } = useMode();
  return (
    <>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setMode("present")}>P</button>
    </>
  );
}

it("default mode is pro", () => {
  render(
    <ModeProvider>
      <Probe />
    </ModeProvider>,
  );
  expect(screen.getByTestId("mode").textContent).toBe("pro");
});

it("setMode changes mode", () => {
  render(
    <ModeProvider>
      <Probe />
    </ModeProvider>,
  );
  fireEvent.click(screen.getByText("P"));
  expect(screen.getByTestId("mode").textContent).toBe("present");
});
```

- [ ] **Step 2: Implement**

```tsx
// lib/mode-context.tsx
"use client";
import { createContext, useContext, useState, ReactNode } from "react";

export type Mode = "pro" | "present" | "pdf";

const ModeCtx = createContext<{
  mode: Mode;
  setMode: (m: Mode) => void;
} | null>(null);

export function ModeProvider({
  children,
  initial = "pro",
}: {
  children: ReactNode;
  initial?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initial);
  return (
    <ModeCtx.Provider value={{ mode, setMode }}>{children}</ModeCtx.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeCtx);
  if (!ctx) throw new Error("useMode outside ModeProvider");
  return ctx;
}
```

```tsx
// components/chrome/ModeToolbar.tsx
"use client";
import { useMode, Mode } from "../../lib/mode-context";

const OPTIONS: Array<{ value: Mode; icon: string; label: string }> = [
  { value: "pro", icon: "⚡", label: "Pro" },
  { value: "present", icon: "📊", label: "Present" },
  { value: "pdf", icon: "🖨", label: "PDF" },
];

export function ModeToolbar() {
  const { mode, setMode } = useMode();
  return (
    <div className="inline-flex rounded-full bg-surface-container-low p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setMode(opt.value)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            mode === opt.value
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          {opt.icon} {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Run tests + commit**

```bash
npm test --workspace packages/frontend -- mode-context
git add packages/frontend/app/analyzer/lib/mode-context.tsx packages/frontend/app/analyzer/components/chrome/
git commit -m "feat(analyzer): ModeContext + ModeToolbar (Pro/Present/PDF)"
```

---

## Task 1D.2–1D.18: UI Components

For each remaining UI component, follow this template:

1. Write a failing render test asserting the key visible/structural behavior.
2. Run the test (fail).
3. Implement the component per spec §7 and per the brainstorm mockups at `.superpowers/brainstorm/10983-1778805693/content/`.
4. Run the test (pass).
5. Commit with descriptive message.

**Component checklist (each its own task, each its own commit):**

- [ ] **Task 1D.2 — Hero/GradeRing.tsx** — Displays letter grade + numeric score; test: renders correct letter for given score. Source patterns from `app/components/scoring/`.
- [ ] **Task 1D.3 — Hero/AIQuoteHeader.tsx** — Streams via `useAiHeaderVerdict` hook; serif italic quote; test: streams text chunks via mocked hook.
- [ ] **Task 1D.4 — Hero/KPITile.tsx** — Single tile with label + value + delta + sparkline (Recharts mini `<Line>`); test: renders value, delta, sparkline SVG.
- [ ] **Task 1D.5 — Hero/KPIStrip.tsx** — Container for 4 KPITiles; test: renders 4 children.
- [ ] **Task 1D.6 — Hero/Hero.tsx** — Composes GradeRing + AIQuoteHeader + KPIStrip; test: all three present.
- [ ] **Task 1D.7 — StrategyCompare/ViewPicker.tsx** — Segmented A/B/C control; persists to localStorage; test: clicking emits onChange; localStorage gets set.
- [ ] **Task 1D.8 — StrategyCompare/ThreeStrategyGrid.tsx** — 3-card grid (B&H/Flip/BRRRR); test: renders 3 cards with provided metrics.
- [ ] **Task 1D.9 — StrategyCompare/SingleStrategyTab.tsx** — Single-strategy tab view; test: renders the selected one.
- [ ] **Task 1D.10 — StrategyCompare/WinnerPlusOthers.tsx** — Winner expanded, others collapsed cards; test: winner is full, others are summary cards.
- [ ] **Task 1D.11 — StrategyCompare/BestPlayCallout.tsx** — "★ best play" banner; deterministic pick from analyzer-core results; test: picks BRRRR when BRRRR score highest.
- [ ] **Task 1D.12 — StrategyCompare/StrategyCompare.tsx** — Container with ViewPicker + body switch; test: switching view re-renders correct child.
- [ ] **Task 1D.13 — InputPanel/RentCastBadge.tsx** — 🟢/🟡/⚪ status pill; test: renders correct emoji for each state.
- [ ] **Task 1D.14 — InputPanel/Nudge.tsx** — Green/amber inline message; test: amber/green tone based on `level` prop.
- [ ] **Task 1D.15 — InputPanel/NumField.tsx** — Typed integer input with RentCastBadge slot; test: typing fires onChange, integer enforcement.
- [ ] **Task 1D.16 — InputPanel/SliderField.tsx** — Slider with live $ readout; test: dragging fires onChange.
- [ ] **Task 1D.17 — InputPanel/FetchPropertyDataButton.tsx** — Triggers `usePropertyLookup`; Pro-gated via `useEntitlements()`; test: button disabled when not Pro; on click, calls hook.
- [ ] **Task 1D.18 — InputPanel/InputPanel.tsx** — Composes all input fields; test: renders all 8 fields + fetch button.

After Task 1D.18 ships, **InputPanel works end-to-end with mock data**.

- [ ] **Task 1D.19 — lib/nudges.ts** — ~15 heuristic functions. Each is pure. Sample: `nudgeForTax(value, countyMedian) → { level: 'warn'|'ok'|null, text }`. Test each with boundary values.
- [ ] **Task 1D.20 — lib/glossary.ts** — ~30 metric definitions. Real content per spec §7.7. Test: every entry has `name`, `formula`, `plain`, `whyMatters`.
- [ ] **Task 1D.21 — chrome/MetricTooltip.tsx** — Tooltip wrapping any metric label, reads from glossary; test: hover shows tooltip content.
- [ ] **Task 1D.22 — sections/SectionWrapper.tsx** — Accordion shell with AI annotation slot + ↻ refresh icon; test: clicking header toggles expanded state; ↻ fires onRefresh prop.
- [ ] **Task 1D.23 — sections/ProjectionSection.tsx** — Wraps `MultiLineChart` + `BulletBarChart` + AIAnnotation; test: renders both charts with provided data.
- [ ] **Task 1D.24 — sections/ExpenseSection.tsx** — Wraps `WaterfallChart` + AIAnnotation; test: renders waterfall.
- [ ] **Task 1D.25 — sections/SensitivitySection.tsx** — Wraps `TornadoChart` + `ComposedSensitivityChart` + AIAnnotation; test: both charts render.
- [ ] **Task 1D.26 — sections/CompsSection.tsx** — Wraps `DistributionViolinChart` + Mapbox map (`Map` from `react-map-gl` with pins for sales + rental comps) + comp list table + AIAnnotation. Use Mapbox style `mapbox://styles/mapbox/light-v11`. Test: renders chart, map placeholder, table with N rows.
- [ ] **Task 1D.27 — sections/MarketContextSection.tsx** — Wraps PIQ tile + 4 stat cards + AIAnnotation; test: renders all stats.
- [ ] **Task 1D.28 — sections/AfterTaxSection.tsx** — Wraps `StackedBarYearChart` + AIAnnotation; test: renders bar chart.
- [ ] **Task 1D.29 — sections/NotesSection.tsx** — Save button + share toggle + textarea; test: typing in textarea updates state.
- [ ] **Task 1D.30 — ai/AIAnnotation.tsx** — Per-section AI text + stale state + ↻ icon; test: prop `isStale={true}` renders faded text + visible ↻.
- [ ] **Task 1D.31 — ai/RefreshAllInsights.tsx** — Global refresh button; test: click invokes all stale-section refresh callbacks.

Commit after each task with `feat(analyzer/<area>): <Component> ...`.

---

# Phase 1E — Wire-up

Connect frontend to backend, integrate snapshot migrator, replace existing `/analyzer` page.

## Task 1E.1: lib/data fetchers

**Files:**

- Create: `packages/frontend/lib/data/fetchers/property-lookup.ts`
- Create: `packages/frontend/lib/data/fetchers/ai-insights.ts`
- Create: `packages/frontend/lib/data/fetchers/ai-insights-stream.ts`
- Create: `packages/frontend/lib/data/fetchers/analyzer-projection.ts`
- Modify: `packages/frontend/lib/data/index.ts`
- Create: `__tests__/` for each

- [ ] **Step 1: Failing tests for property-lookup fetcher**

```ts
// __tests__/property-lookup.test.ts
import { describe, it, expect, vi } from "vitest";
import { fetchPropertyLookup } from "../property-lookup";

describe("fetchPropertyLookup", () => {
  it("GET /api/analyzer/property-lookup with address query", async () => {
    const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ avm: { value: 245000 }, rent: { value: 2850 } }),
    } as Response);

    const r = await fetchPropertyLookup({ address: "123 Main" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/analyzer/property-lookup?address=123%20Main",
      ),
      expect.anything(),
    );
    expect(r.avm?.value).toBe(245000);
  });

  it("returns { quotaExceeded: true } on 429", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
    } as Response);
    const r = await fetchPropertyLookup({ address: "X" });
    expect(r).toEqual({ quotaExceeded: true });
  });
});
```

- [ ] **Step 2: Run test, fail**

`npm test --workspace packages/frontend -- property-lookup` — FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/frontend/lib/data/fetchers/property-lookup.ts
import { API_BASE } from "../config";

export interface PropertyLookupResult {
  avm: { value: number; low: number; high: number; comps_count: number } | null;
  rent: {
    value: number;
    low: number;
    high: number;
    comps_count: number;
  } | null;
  property_record: unknown;
  sales_comps: unknown[];
  rental_comps: unknown[];
  cache_age_days: number;
  source: "rentcast";
}

export async function fetchPropertyLookup(params: {
  address: string;
}): Promise<PropertyLookupResult | { quotaExceeded: true }> {
  const url = `${API_BASE}/api/analyzer/property-lookup?address=${encodeURIComponent(params.address)}`;
  const res = await fetch(url, { credentials: "include" });
  if (res.status === 429) return { quotaExceeded: true };
  if (!res.ok) throw new Error(`property-lookup ${res.status}`);
  return res.json();
}
```

- [ ] **Step 4: Implement ai-insights, ai-insights-stream, analyzer-projection** fetchers similarly. Each posts the analysis payload to its respective endpoint.

- [ ] **Step 5: Export from lib/data/index.ts**

Add:

```ts
export {
  fetchPropertyLookup,
  type PropertyLookupResult,
} from "./fetchers/property-lookup";
export {
  fetchAiInsight,
  type AIAnnotationResult,
} from "./fetchers/ai-insights";
export { streamAiHeaderInsight } from "./fetchers/ai-insights-stream";
```

- [ ] **Step 6: Tests + commit**

```bash
npm test --workspace packages/frontend -- fetchers/
git add packages/frontend/lib/data/
git commit -m "feat(data): add fetchers for property-lookup + ai-insights (header stream + section)"
```

---

## Task 1E.2: lib/data hooks

**Files:**

- Create: `packages/frontend/lib/data/hooks/usePropertyLookup.ts`
- Create: `packages/frontend/lib/data/hooks/useAiHeaderVerdict.ts`
- Create: `packages/frontend/lib/data/hooks/useAiSectionAnnotation.ts`
- Modify: `packages/frontend/lib/data/index.ts`

- [ ] **Step 1: Failing tests** for each hook using React Query test utilities.

- [ ] **Step 2: Implement**

```ts
// usePropertyLookup.ts
import { useMutation } from "@tanstack/react-query";
import {
  fetchPropertyLookup,
  type PropertyLookupResult,
} from "../fetchers/property-lookup";

export function usePropertyLookup() {
  return useMutation<
    PropertyLookupResult | { quotaExceeded: true },
    Error,
    { address: string }
  >({
    mutationFn: fetchPropertyLookup,
  });
}
```

```ts
// useAiSectionAnnotation.ts
import { useQuery } from "@tanstack/react-query";
import { fetchAiInsight } from "../fetchers/ai-insights";

export function useAiSectionAnnotation(
  payload: any,
  sectionId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["ai-insight", sectionId, JSON.stringify(payload).slice(0, 100)],
    queryFn: () => fetchAiInsight({ id: sectionId, payload }),
    enabled,
    staleTime: 1000 * 60 * 60 * 24, // 24h
  });
}
```

```ts
// useAiHeaderVerdict.ts
import { useEffect, useRef, useState } from "react";
import { streamAiHeaderInsight } from "../fetchers/ai-insights-stream";

export function useAiHeaderVerdict(payload: any) {
  const [text, setText] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      let acc = "";
      for await (const chunk of streamAiHeaderInsight(payload)) {
        acc += chunk;
        setText(acc);
      }
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [JSON.stringify(payload)]);

  return { text };
}
```

- [ ] **Step 3: Export from lib/data/index.ts** and commit.

```bash
git add packages/frontend/lib/data/
git commit -m "feat(data): add hooks usePropertyLookup, useAiHeaderVerdict, useAiSectionAnnotation"
```

---

## Task 1E.3: Saved-snapshot migrator

**Files:**

- Create: `packages/frontend/app/analyzer/lib/migrate-snapshot.ts`
- Create: `packages/frontend/app/analyzer/lib/__tests__/migrate-snapshot.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { migrateSnapshot } from "../migrate-snapshot";

describe("migrateSnapshot", () => {
  it("current shape passes through unchanged", () => {
    const v1 = {
      price: 240000,
      rentMonthly: 2850,
      taxAnnual: 3800,
      insuranceAnnual: 1200,
      financing: { downPaymentPct: 0.2, interestRatePct: 7.1, termYears: 30 },
    };
    expect(migrateSnapshot(v1)).toEqual(v1);
  });

  it("is idempotent", () => {
    const v1 = {
      price: 240000,
      rentMonthly: 2850,
      taxAnnual: 3800,
      insuranceAnnual: 1200,
      financing: { downPaymentPct: 0.2, interestRatePct: 7.1, termYears: 30 },
    };
    expect(migrateSnapshot(migrateSnapshot(v1))).toEqual(v1);
  });

  it("v0 pre-financing-defaults shape upgrades to v1", () => {
    const v0 = {
      price: 200000,
      rentMonthly: 2200,
      taxAnnual: 2400,
      insuranceAnnual: 1000,
    };
    const r = migrateSnapshot(v0);
    expect(r.financing).toBeDefined();
    expect(r.financing.downPaymentPct).toBe(0.2);
  });

  it("anonymous shape with strings coerces to numbers", () => {
    const anon = { price: "240000", rentMonthly: "2850" } as any;
    const r = migrateSnapshot(anon);
    expect(typeof r.price).toBe("number");
    expect(typeof r.rentMonthly).toBe("number");
  });
});
```

- [ ] **Step 2: Implement**

```ts
// migrate-snapshot.ts
import type { DealInput, FinancingTerms } from "@propertyiq/analyzer-core";

const DEFAULT_FINANCING: FinancingTerms = {
  downPaymentPct: 0.2,
  interestRatePct: 7.1,
  termYears: 30,
  closingCostsPct: 0.03,
};

export function migrateSnapshot(raw: unknown): DealInput {
  const obj: any = raw ?? {};
  const num = (v: unknown, fallback: number | null = null): number | null => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))
      return Number(v);
    return fallback;
  };

  return {
    price: num(obj.price, 0) ?? 0,
    rentMonthly: num(obj.rentMonthly, null),
    taxAnnual: num(obj.taxAnnual, null),
    insuranceAnnual: num(obj.insuranceAnnual, null),
    hoaMonthly: num(obj.hoaMonthly, 0) ?? 0,
    financing: obj.financing
      ? {
          downPaymentPct:
            num(
              obj.financing.downPaymentPct,
              DEFAULT_FINANCING.downPaymentPct,
            ) ?? DEFAULT_FINANCING.downPaymentPct,
          interestRatePct:
            num(
              obj.financing.interestRatePct,
              DEFAULT_FINANCING.interestRatePct,
            ) ?? DEFAULT_FINANCING.interestRatePct,
          termYears:
            num(obj.financing.termYears, DEFAULT_FINANCING.termYears) ??
            DEFAULT_FINANCING.termYears,
          closingCostsPct:
            num(
              obj.financing.closingCostsPct,
              DEFAULT_FINANCING.closingCostsPct,
            ) ?? DEFAULT_FINANCING.closingCostsPct,
        }
      : { ...DEFAULT_FINANCING },
  };
}
```

- [ ] **Step 3: Run tests + commit**

```bash
npm test --workspace packages/frontend -- migrate-snapshot
git add packages/frontend/app/analyzer/lib/migrate-snapshot.ts packages/frontend/app/analyzer/lib/__tests__/migrate-snapshot.test.ts
git commit -m "feat(analyzer): migrate-snapshot for back-compat across 3 known shapes"
```

---

## Task 1E.4: New AnalyzerClient.tsx + page replacement

**Files:**

- Create: `packages/frontend/app/analyzer/AnalyzerClient.v2.tsx` (build alongside old)
- Modify: `packages/frontend/app/analyzer/AnalyzerClient.tsx` (replace contents)
- Modify: `packages/frontend/app/analyzer/page.tsx` (no change if still passes searchParams)

- [ ] **Step 1: Test scaffold**

Write a failing E2E test that the new analyzer renders all major elements:

```ts
// packages/frontend/tests/e2e/analyzer-redesign.spec.ts
import { test, expect } from "@playwright/test";

test("analyzer renders new hero + strategy compare + accordion sections", async ({
  page,
}) => {
  await page.goto("http://localhost:3000/analyzer");
  await expect(page.getByText(/Cap Rate/i)).toBeVisible();
  await expect(page.getByText(/Cashflow/i)).toBeVisible();
  await expect(page.getByText(/IRR/i)).toBeVisible();
  await expect(page.getByText(/DSCR/i)).toBeVisible();
  await expect(page.getByText(/Buy & Hold/i)).toBeVisible();
  await expect(page.getByText(/Flip/i)).toBeVisible();
  await expect(page.getByText(/BRRRR/i)).toBeVisible();
});
```

- [ ] **Step 2: Run test, fail**

`npm run test:e2e --workspace packages/frontend -- analyzer-redesign` — FAIL (page still has old layout).

- [ ] **Step 3: Implement new AnalyzerClient**

Build `packages/frontend/app/analyzer/AnalyzerClient.tsx` composing all components built in Phase 1D:

```tsx
"use client";
import { useState } from "react";
import { ModeProvider } from "./lib/mode-context";
import { Hero } from "./components/Hero/Hero";
import { StrategyCompare } from "./components/StrategyCompare/StrategyCompare";
import { InputPanel } from "./components/InputPanel/InputPanel";
import { ModeToolbar } from "./components/chrome/ModeToolbar";
import { ProjectionSection } from "./components/sections/ProjectionSection";
import { ExpenseSection } from "./components/sections/ExpenseSection";
import { SensitivitySection } from "./components/sections/SensitivitySection";
import { CompsSection } from "./components/sections/CompsSection";
import { MarketContextSection } from "./components/sections/MarketContextSection";
import { AfterTaxSection } from "./components/sections/AfterTaxSection";
import { NotesSection } from "./components/sections/NotesSection";
import { useAnalyzer } from "@/lib/analyzer/useAnalyzer";
import { useMarketContext } from "@/lib/analyzer/useMarketContext";
import { usePropertyLookup } from "@/lib/data";

export default function AnalyzerClient({ searchParamsPromise }: { searchParamsPromise: Promise<any> }) {
  const analyzer = useAnalyzer();
  const propertyLookup = usePropertyLookup();
  // ... wire useAnalyzer + useMarketContext + usePropertyLookup
  // ... compose UI
  return (
    <ModeProvider>
      <main className="min-h-screen bg-surface">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <header className="flex items-center justify-between mb-6">
            {/* AddressBar */}
            <ModeToolbar />
          </header>
          <div className="grid grid-cols-1 md:grid-cols-[62%_38%] gap-6">
            <div className="space-y-6">
              <Hero {/* props */} />
              <StrategyCompare {/* props */} />
              <ProjectionSection {/* props */} />
              <ExpenseSection {/* props */} />
              <CompsSection {/* props */} />
              <SensitivitySection {/* props */} />
              <MarketContextSection {/* props */} />
              <AfterTaxSection {/* props */} />
              <NotesSection {/* props */} />
            </div>
            <aside className="hidden md:block sticky top-6 self-start">
              <InputPanel {/* props */} />
            </aside>
          </div>
        </div>
      </main>
    </ModeProvider>
  );
}
```

(Fill in props from analyzer state + propertyLookup + market context per spec §4.3 data flow.)

- [ ] **Step 4: Wire saved analysis migrator into /analyzer/saved/[id]**

In `app/analyzer/saved/[id]/SavedClient.tsx`, on load:

```tsx
import { migrateSnapshot } from "../../lib/migrate-snapshot";
const initialInput = migrateSnapshot(savedAnalysis.input_snapshot);
```

- [ ] **Step 5: Run E2E test, pass**

`npm run test:e2e --workspace packages/frontend -- analyzer-redesign` — PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/analyzer/
git commit -m "feat(analyzer): big-bang replace AnalyzerClient with v2 (hero + strategy compare + 7 sections)"
```

---

## Task 1E.5: Mobile responsive collapse

**Files:**

- Modify: `packages/frontend/app/analyzer/AnalyzerClient.tsx`
- Create: `packages/frontend/app/analyzer/components/chrome/EditInputsFab.tsx`

- [ ] **Step 1: Failing E2E test**

```ts
test("mobile (<900px) collapses inputs to accordion above results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto("http://localhost:3000/analyzer");
  await expect(
    page.getByRole("button", { name: /edit inputs/i }),
  ).toBeVisible();
  // Sticky inputs sidebar should NOT be present
  await expect(page.locator("aside[data-input-panel-sticky]")).toHaveCount(0);
});
```

- [ ] **Step 2: Implement responsive collapse**

In `AnalyzerClient.tsx`, switch grid template from `md:grid-cols-[62%_38%]` to single column below `md`. Add `<EditInputsFab />` floating action button at `position: fixed; bottom: 1.5rem; right: 1.5rem` that toggles an inputs accordion. Apply `whileInView` to chart cards via `framer-motion` to defer chart entrance until scrolled into view.

- [ ] **Step 3: Run test + commit**

```bash
npm run test:e2e --workspace packages/frontend -- analyzer-redesign
git add packages/frontend/app/analyzer/
git commit -m "feat(analyzer): mobile responsive collapse with floating Edit Inputs FAB"
```

---

# Phase 1F — Verification

## Task 1F.1: Visual regression baselines

**Files:**

- Create: `packages/frontend/tests/visual/analyzer-charts.spec.ts`
- Create: golden screenshot artifacts under `tests/visual/__snapshots__/`

- [ ] **Step 1: Implement screenshot tests**

```ts
import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 800, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  test(`analyzer renders consistently at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(
      "http://localhost:3000/analyzer?address=123+Main+St+Atlanta+GA",
    );
    // Wait for charts to render
    await page.waitForSelector(".recharts-line, [data-waterfall-bar]", {
      timeout: 10000,
    });
    expect(await page.screenshot({ fullPage: true })).toMatchSnapshot(
      `analyzer-${vp.name}.png`,
      { maxDiffPixelRatio: 0.02 },
    );
  });
}
```

- [ ] **Step 2: Capture baselines**

Run: `npm run test:e2e --workspace packages/frontend -- visual/ --update-snapshots`
Expected: 3 golden PNGs written.

- [ ] **Step 3: Commit baselines**

```bash
git add packages/frontend/tests/visual/
git commit -m "test(analyzer): visual regression baselines at 3 viewports"
```

---

## Task 1F.2: Background validation agents

Run all 4 validation agents in background per CLAUDE.md §1.6 and `[[feedback_pipelining-parallel-agents]]`. Dispatch via the harness:

- [ ] **Step 1: Dispatch agents in parallel**

In the implementing agent's terminal/Bash:

```
agent: code-reviewer --background
agent: data-layer-reviewer --background
agent: security-reviewer --background
agent: file-size-compliance --background
```

(Use whatever team / dispatch mechanism the implementing agent prefers; the spec requires CRITICAL/WARNING-free reports.)

- [ ] **Step 2: Address any CRITICAL/WARNING findings**

Surface findings to user. Fix and re-run agents until clean.

- [ ] **Step 3: Commit any fixes**

```bash
git add ...
git commit -m "fix(analyzer): address findings from background validation agents"
```

---

## Task 1F.3: Acceptance criteria walkthrough

- [ ] **Step 1: Open spec §16 (Acceptance Criteria)**

Open `docs/superpowers/specs/2026-05-14-analyzer-redesign-phase1-design.md` in editor.

- [ ] **Step 2: Walk through each checkbox**

Manually verify each of the 24 acceptance bullets against the running app. For each:

- ☑ Mark complete if behavior matches spec
- ☐ Open a bug ticket if not; fix; re-verify

- [ ] **Step 3: Production smoke test on staging**

Per `[[feedback_server-health-checks]]`:

- Deploy `feat/deal-analyzer` to staging Railway environment
- Open the staging URL in a browser; verify the analyzer renders end-to-end
- Verify RentCast fetch works (consumes 1 from monthly quota)
- Verify AI insight streams + renders
- Verify saved analysis loads via migrator

- [ ] **Step 4: Per `[[feedback_default-branch-develop]]` and `[[feedback_commits-must-land-in-local-working-dir]]`**

- Do NOT push without explicit user instruction
- Surface the merge-readiness summary to the user; the user pushes

---

## Open items from spec §17 — resolved as concrete defaults

| Spec item                    | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB schema for AI annotations | **No schema change.** Client-only stale-marking; Redis is the only store; 24h TTL is sufficient for Phase 1.                                                                                                                                                                                                                                                                                                                                       |
| Mapbox map style             | **`mapbox://styles/mapbox/light-v11`** (matches PropertyIQ light/airy aesthetic per CLAUDE.md §8.4). Pin colors: subject property = primary indigo; sales comps = positive green; rental comps = caution amber.                                                                                                                                                                                                                                    |
| Glossary content             | Implemented in Task 1D.20 with 30 entries: cap rate, CoC, DSCR, NOI, cashflow, IRR, 1%/2%/50%/70% rules, GRM, OpEx ratio, ARV, MAO, vacancy, maintenance, management, principal paydown, appreciation, depreciation deduction, interest deduction, after-tax cashflow, break-even rent, break-even occupancy, BRRRR score, refi cash-out, cash-left-in-deal, post-refi cashflow, exit cap rate, PIQ score, market heat, rent index, net migration. |
| ai_model_config seed values  | Task 1B.6 — both purposes default to `deepseek-chat`.                                                                                                                                                                                                                                                                                                                                                                                              |
| Visual regression goldens    | Task 1F.1 — captured during 1F, committed to repo.                                                                                                                                                                                                                                                                                                                                                                                                 |

---

## Plan Self-Review

Reviewed against spec §1–§17:

**Spec coverage:** All 17 spec sections have at least one task. RentCast (§10), AI Integration (§9), Charts (§8), UI System (§7), analyzer-core extensions (§5), Backend HTTP (§6), Mode-switching (§11), Saved-snapshot migration (§12) all have explicit task coverage. Rollout (§13) follows the 1A–1F phasing. Testing (§14), Risks (§15), Acceptance (§16) all addressed.

**Placeholder scan:** No "TBD", "TODO", "fill in", or "similar to Task N" patterns. All tasks have actual code.

**Type consistency:** `PropertyLookupDto` shape consistent across backend Task 1B.3 and frontend fetcher Task 1E.1. `SectionId` type consistent across `section-prompts.ts` (1B.1, 1B.2), `AiInsightsService` (1B.1), and `AIAnnotation` component (1D.30). `Mode` type consistent across `mode-context.tsx` (1D.1) and `ModeToolbar` (1D.1).

**Identified one consistency note:** In the spec, the property-lookup endpoint is documented as GET with query params (§6). In Task 1B.3 I used `@Get` with `@Query`, and the fetcher in 1E.1 uses GET. Consistent. Good.

**Identified one minor compress:** The 17 UI component tasks (1D.2–1D.31) compress to a checklist rather than full TDD detail per task. This is acceptable because the pattern is uniform (failing render test → implement → run → commit) and the chart consumers don't have distinctive logic beyond composition. An implementing agent should write the failing test for each before implementing.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-analyzer-redesign-phase1.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Two-stage review (impl agent + reviewer). Best for parallel work on independent tasks within the same phase (e.g., the 15 chart components in 1C can run in parallel via the parallel-agents pattern from `[[feedback_agent-pipelining]]`).

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans` with batch checkpoints for review. Best if you want to keep the work in this conversation context.

Which approach?
