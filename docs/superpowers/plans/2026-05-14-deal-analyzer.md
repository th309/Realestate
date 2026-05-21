# PropertyIQ Deal Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an on-site real-estate deal analyzer (`/analyzer`) backed by a shared `@propertyiq/analyzer-core` workspace package; refactor MCP `cashflow_estimate` and `deal_analyzer` to use the same core with byte-for-byte preserved output.

**Architecture:** Pure-TS math package consumed by frontend (instant local recompute), NestJS backend (`/api/analyzer/*`), and `packages/mcp-server` (refactor). New `deal_analyses` table with RLS + public share tokens. Anonymous lifetime-cap of 3 analyses via signed httpOnly cookie. Pro-gated AI verdict (streaming Anthropic), market context, save, share.

**Tech Stack:** TypeScript, Vitest + fast-check (analyzer-core), NestJS 11 + class-validator (backend), Next.js 16 App Router + React 19 + Tailwind 4 (frontend), Supabase Postgres (RLS), Mapbox Places API (autocomplete), Anthropic SDK (verdict), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-05-14-deal-analyzer-design.md`

---

## Phase 0 — Workspace Foundation

### Task 1: Create `packages/analyzer-core` workspace package

**Files:**

- Create: `packages/analyzer-core/package.json`
- Create: `packages/analyzer-core/tsconfig.json`
- Create: `packages/analyzer-core/vitest.config.ts`
- Create: `packages/analyzer-core/src/index.ts`
- Create: `packages/analyzer-core/README.md`
- Modify: `package.json` (root) — add to `workspaces` array if not glob-included

- [ ] **Step 1: Verify root workspace glob includes the new package**

Run: `node -e "console.log(JSON.stringify(require('./package.json').workspaces, null, 2))"`
Expected: array contains `packages/*` or equivalent. If literal list, add `"packages/analyzer-core"`.

- [ ] **Step 2: Create `packages/analyzer-core/package.json`**

```json
{
  "name": "@propertyiq/analyzer-core",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0",
    "fast-check": "^3.20.0"
  }
}
```

- [ ] **Step 3: Create `packages/analyzer-core/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

- [ ] **Step 4: Create `packages/analyzer-core/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: { reporter: ["text", "lcov"] },
  },
});
```

- [ ] **Step 5: Create stub `packages/analyzer-core/src/index.ts`**

```ts
export const ANALYZER_CORE_VERSION = "0.1.0";
```

- [ ] **Step 6: Install + build + verify**

Run: `npm install && npm run build --workspace @propertyiq/analyzer-core`
Expected: `packages/analyzer-core/dist/index.js` exists.

- [ ] **Step 7: Commit**

```bash
git add packages/analyzer-core package.json package-lock.json
git commit -m "feat(analyzer-core): scaffold workspace package"
```

---

## Phase 1 — Math Core (TDD)

### Task 2: Types + `computeRentalMetrics`

**Files:**

- Create: `packages/analyzer-core/src/types.ts`
- Create: `packages/analyzer-core/src/rental.ts`
- Create: `packages/analyzer-core/src/rental.test.ts`
- Modify: `packages/analyzer-core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/analyzer-core/src/rental.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeRentalMetrics } from "./rental";
import type { DealInput } from "./types";

const baseFinancing = {
  downPaymentPct: 0.2,
  interestRatePct: 7.1,
  termYears: 30,
  closingCostsPct: 0.03,
};

describe("computeRentalMetrics", () => {
  it("computes a representative Austin deal", () => {
    const input: DealInput = {
      price: 425_000,
      rentMonthly: 2_950,
      taxAnnual: 7_650,
      insuranceAnnual: 1_800,
      hoaMonthly: 0,
      maintenancePctOfRent: 0.08,
      vacancyPctOfRent: 0.05,
      managementPctOfRent: 0.08,
      financing: baseFinancing,
    };
    const r = computeRentalMetrics(input);
    expect(r.monthlyDebtService).toBeCloseTo(2_283.49, 1);
    expect(r.noiAnnual!).toBeGreaterThan(15_000);
    expect(r.capRatePct!).toBeGreaterThan(3.5);
    expect(r.capRatePct!).toBeLessThan(6.5);
    expect(r.onePctRulePct!).toBeCloseTo((2_950 / 425_000) * 100, 2);
    expect(r.dscr!).toBeGreaterThan(0);
    expect(r.totalCashInvested).toBe(425_000 * 0.2 + 425_000 * 0.03);
  });

  it("returns nulls for rental fields when rent is null but keeps debt service", () => {
    const r = computeRentalMetrics({
      price: 300_000,
      rentMonthly: null,
      taxAnnual: 5_000,
      insuranceAnnual: 1_200,
      financing: baseFinancing,
    });
    expect(r.noiAnnual).toBeNull();
    expect(r.capRatePct).toBeNull();
    expect(r.cashOnCashPct).toBeNull();
    expect(r.dscr).toBeNull();
    expect(r.cashflowMonthly).toBeNull();
    expect(r.onePctRulePct).toBeNull();
    expect(r.monthlyDebtService).toBeGreaterThan(0);
  });

  it("handles 100% down (no debt service)", () => {
    const r = computeRentalMetrics({
      price: 200_000,
      rentMonthly: 2_000,
      taxAnnual: 3_000,
      insuranceAnnual: 800,
      financing: { ...baseFinancing, downPaymentPct: 1 },
    });
    expect(r.monthlyDebtService).toBe(0);
    expect(r.dscr).toBe(Infinity);
    expect(r.cashflowMonthly!).toBeGreaterThan(0);
  });

  it("returns negative cashflow as a valid result", () => {
    const r = computeRentalMetrics({
      price: 800_000,
      rentMonthly: 2_500,
      taxAnnual: 12_000,
      insuranceAnnual: 2_400,
      financing: baseFinancing,
    });
    expect(r.cashflowMonthly!).toBeLessThan(0);
  });

  it("never throws on price=0", () => {
    expect(() =>
      computeRentalMetrics({
        price: 0,
        rentMonthly: 1000,
        taxAnnual: 0,
        insuranceAnnual: 0,
        financing: baseFinancing,
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @propertyiq/analyzer-core`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/analyzer-core/src/types.ts`**

```ts
export interface FinancingTerms {
  downPaymentPct: number;
  interestRatePct: number;
  termYears: number;
  closingCostsPct?: number;
}

export interface DealInput {
  price: number;
  rentMonthly: number | null;
  taxAnnual: number | null;
  insuranceAnnual: number | null;
  hoaMonthly?: number;
  maintenancePctOfRent?: number;
  vacancyPctOfRent?: number;
  managementPctOfRent?: number;
  financing: FinancingTerms;
}

export interface RentalResult {
  noiAnnual: number | null;
  capRatePct: number | null;
  cashOnCashPct: number | null;
  dscr: number | null;
  cashflowMonthly: number | null;
  onePctRulePct: number | null;
  totalCashInvested: number;
  monthlyDebtService: number;
}

export interface FlipInput {
  arv: number;
  rehabBudget: number;
  holdingMonths?: number;
  sellingCostsPct?: number;
}

export interface FlipResult {
  mao70: number;
  wholetailMax: number;
  projectedProfit: number;
  projectedRoiPct: number;
}

export interface BrrrrInput extends DealInput {
  arv: number;
  rehabBudget: number;
  refinanceLTVPct?: number;
}

export interface BrrrrResult {
  score: number;
  refinanceCashOut: number;
  remainingCashInDeal: number;
  postRefiCashflowMonthly: number;
  rating: "EXCELLENT" | "STRONG" | "OK" | "WEAK" | "POOR";
}
```

- [ ] **Step 4: Implement `packages/analyzer-core/src/rental.ts`**

```ts
import type { DealInput, RentalResult } from "./types";

const DEFAULTS = {
  maintenance: 0.08,
  vacancy: 0.05,
  management: 0.08,
  closing: 0.03,
};

export function monthlyMortgagePayment(
  loan: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (loan <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return loan / n;
  return (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function computeRentalMetrics(input: DealInput): RentalResult {
  const {
    price,
    rentMonthly,
    taxAnnual,
    insuranceAnnual,
    hoaMonthly,
    financing,
  } = input;
  const maintPct = input.maintenancePctOfRent ?? DEFAULTS.maintenance;
  const vacPct = input.vacancyPctOfRent ?? DEFAULTS.vacancy;
  const mgmtPct = input.managementPctOfRent ?? DEFAULTS.management;
  const closingPct = financing.closingCostsPct ?? DEFAULTS.closing;

  const downPayment = price * financing.downPaymentPct;
  const loanAmount = price - downPayment;
  const closingCosts = price * closingPct;
  const totalCashInvested = downPayment + closingCosts;

  const monthlyDebtService = monthlyMortgagePayment(
    loanAmount,
    financing.interestRatePct,
    financing.termYears,
  );

  if (rentMonthly == null) {
    return {
      noiAnnual: null,
      capRatePct: null,
      cashOnCashPct: null,
      dscr: null,
      cashflowMonthly: null,
      onePctRulePct: null,
      totalCashInvested,
      monthlyDebtService,
    };
  }

  const grossRentAnnual = rentMonthly * 12;
  const vacancyLoss = grossRentAnnual * vacPct;
  const maintCost = grossRentAnnual * maintPct;
  const mgmtCost = grossRentAnnual * mgmtPct;
  const hoaAnnual = (hoaMonthly ?? 0) * 12;
  const opex =
    (taxAnnual ?? 0) +
    (insuranceAnnual ?? 0) +
    maintCost +
    mgmtCost +
    hoaAnnual;
  const noiAnnual = grossRentAnnual - vacancyLoss - opex;

  const capRatePct = price > 0 ? (noiAnnual / price) * 100 : null;
  const annualDebtService = monthlyDebtService * 12;
  const dscr = annualDebtService > 0 ? noiAnnual / annualDebtService : Infinity;
  const cashflowMonthly = noiAnnual / 12 - monthlyDebtService;
  const cashOnCashPct =
    totalCashInvested > 0
      ? ((cashflowMonthly * 12) / totalCashInvested) * 100
      : null;
  const onePctRulePct = price > 0 ? (rentMonthly / price) * 100 : null;

  return {
    noiAnnual,
    capRatePct,
    cashOnCashPct,
    dscr,
    cashflowMonthly,
    onePctRulePct,
    totalCashInvested,
    monthlyDebtService,
  };
}
```

- [ ] **Step 5: Re-export from index, re-run tests**

Modify `packages/analyzer-core/src/index.ts`:

```ts
export * from "./types";
export * from "./rental";
```

Run: `npm test --workspace @propertyiq/analyzer-core`
Expected: PASS — all rental tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/analyzer-core/src
git commit -m "feat(analyzer-core): computeRentalMetrics + types"
```

---

### Task 3: `computeFlipMetrics`

**Files:**

- Create: `packages/analyzer-core/src/flip.ts`
- Create: `packages/analyzer-core/src/flip.test.ts`
- Modify: `packages/analyzer-core/src/index.ts`

- [ ] **Step 1: Failing test**

Create `packages/analyzer-core/src/flip.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeFlipMetrics } from "./flip";

describe("computeFlipMetrics", () => {
  it("70% rule and wholetail caps", () => {
    const r = computeFlipMetrics({
      price: 200_000,
      arv: 350_000,
      rehabBudget: 50_000,
    });
    expect(r.mao70).toBe(0.7 * 350_000 - 50_000); // 195,000
    expect(r.wholetailMax).toBe(0.8 * 350_000 - 50_000); // 230,000
  });

  it("projected profit uses default holding + selling defaults", () => {
    const r = computeFlipMetrics({
      price: 150_000,
      arv: 250_000,
      rehabBudget: 30_000,
    });
    // sellingCosts default 0.07 → 17,500. holdingMonths default 4 → ~property tax/util est not modeled. profit = ARV - sellingCosts - price - rehab.
    expect(r.projectedProfit).toBe(250_000 - 0.07 * 250_000 - 150_000 - 30_000);
    expect(r.projectedRoiPct).toBeCloseTo(
      (r.projectedProfit / (150_000 + 30_000)) * 100,
      1,
    );
  });

  it("allows custom selling cost", () => {
    const r = computeFlipMetrics({
      price: 100_000,
      arv: 200_000,
      rehabBudget: 20_000,
      sellingCostsPct: 0.1,
    });
    expect(r.projectedProfit).toBe(200_000 - 20_000 - 100_000 - 20_000);
  });

  it("mao70 must be < arv", () => {
    const r = computeFlipMetrics({
      price: 0,
      arv: 300_000,
      rehabBudget: 10_000,
    });
    expect(r.mao70).toBeLessThan(300_000);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test --workspace @propertyiq/analyzer-core -- flip`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/analyzer-core/src/flip.ts`**

```ts
import type { FlipInput, FlipResult } from "./types";

const DEFAULTS = { holdingMonths: 4, sellingCostsPct: 0.07 };

export function computeFlipMetrics(
  input: FlipInput & { price: number },
): FlipResult {
  const { price, arv, rehabBudget } = input;
  const sellingCostsPct = input.sellingCostsPct ?? DEFAULTS.sellingCostsPct;
  const sellingCosts = arv * sellingCostsPct;
  const mao70 = 0.7 * arv - rehabBudget;
  const wholetailMax = 0.8 * arv - rehabBudget;
  const projectedProfit = arv - sellingCosts - price - rehabBudget;
  const totalIn = price + rehabBudget;
  const projectedRoiPct = totalIn > 0 ? (projectedProfit / totalIn) * 100 : 0;
  return { mao70, wholetailMax, projectedProfit, projectedRoiPct };
}
```

- [ ] **Step 4: Add `export * from './flip';` to `src/index.ts`, run tests**

Run: `npm test --workspace @propertyiq/analyzer-core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer-core/src
git commit -m "feat(analyzer-core): computeFlipMetrics"
```

---

### Task 4: `computeBrrrrScore`

**Files:**

- Create: `packages/analyzer-core/src/brrrr.ts`
- Create: `packages/analyzer-core/src/brrrr.test.ts`
- Modify: `packages/analyzer-core/src/index.ts`

- [ ] **Step 1: Failing test**

```ts
// packages/analyzer-core/src/brrrr.test.ts
import { describe, it, expect } from "vitest";
import { computeBrrrrScore } from "./brrrr";

const financing = {
  downPaymentPct: 0.2,
  interestRatePct: 7.1,
  termYears: 30,
  closingCostsPct: 0.03,
};

describe("computeBrrrrScore", () => {
  it("strong BRRRR: full cash-out, positive post-refi cashflow", () => {
    const r = computeBrrrrScore({
      price: 100_000,
      arv: 200_000,
      rehabBudget: 30_000,
      rentMonthly: 1_800,
      taxAnnual: 2_000,
      insuranceAnnual: 800,
      refinanceLTVPct: 0.75,
      financing,
    });
    // 75% of $200k ARV = $150k cash-out
    expect(r.refinanceCashOut).toBe(0.75 * 200_000);
    // total in = price + rehab + closing = 100k + 30k + 3k = 133k → remaining = 133k - 150k = -17k (cash back)
    expect(r.remainingCashInDeal).toBeLessThan(0);
    expect(r.score).toBeGreaterThanOrEqual(8);
    expect(r.rating).toBe("EXCELLENT");
  });

  it("weak BRRRR: leaves significant cash, low cashflow", () => {
    const r = computeBrrrrScore({
      price: 300_000,
      arv: 320_000,
      rehabBudget: 10_000,
      rentMonthly: 1_800,
      taxAnnual: 4_000,
      insuranceAnnual: 1_500,
      financing,
    });
    expect(r.remainingCashInDeal).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(5);
  });

  it("null rent collapses score to 0", () => {
    const r = computeBrrrrScore({
      price: 100_000,
      arv: 200_000,
      rehabBudget: 20_000,
      rentMonthly: null,
      taxAnnual: 2_000,
      insuranceAnnual: 800,
      financing,
    });
    expect(r.score).toBe(0);
    expect(r.rating).toBe("POOR");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/analyzer-core/src/brrrr.ts`**

```ts
import type { BrrrrInput, BrrrrResult } from "./types";
import { computeRentalMetrics, monthlyMortgagePayment } from "./rental";

const DEFAULTS = { refinanceLTV: 0.75 };

function rate(score: number): BrrrrResult["rating"] {
  if (score >= 8) return "EXCELLENT";
  if (score >= 6.5) return "STRONG";
  if (score >= 5) return "OK";
  if (score >= 3) return "WEAK";
  return "POOR";
}

export function computeBrrrrScore(input: BrrrrInput): BrrrrResult {
  const { price, arv, rehabBudget, financing } = input;
  const refiLTV = input.refinanceLTVPct ?? DEFAULTS.refinanceLTV;

  const closingPct = financing.closingCostsPct ?? 0.03;
  const totalIn = price + rehabBudget + price * closingPct;
  const refinanceCashOut = arv * refiLTV;
  const remainingCashInDeal = totalIn - refinanceCashOut;

  // Post-refi: new loan = refinanceCashOut, same rate/term
  const postRefiDebt = monthlyMortgagePayment(
    refinanceCashOut,
    financing.interestRatePct,
    financing.termYears,
  );

  if (input.rentMonthly == null) {
    return {
      score: 0,
      refinanceCashOut,
      remainingCashInDeal,
      postRefiCashflowMonthly: -postRefiDebt,
      rating: "POOR",
    };
  }

  // Run rental math at post-refi state: down payment fields don't apply, treat refi loan as the financed debt.
  const rental = computeRentalMetrics({
    ...input,
    financing: { ...financing, downPaymentPct: 1 }, // ignore debt from initial financing in the cashflow
  });
  // Replace debt service with post-refi debt
  const noiMonthly = (rental.noiAnnual ?? 0) / 12;
  const postRefiCashflowMonthly = noiMonthly - postRefiDebt;

  // Score: weighted by (a) cash recouped fraction, (b) post-refi cashflow / month
  const cashRecoupedFraction = Math.max(
    0,
    Math.min(1, 1 - remainingCashInDeal / Math.max(totalIn, 1)),
  );
  const cashflowComponent = Math.max(
    0,
    Math.min(1, postRefiCashflowMonthly / 500),
  );
  const score =
    Math.round(
      (0.6 * cashRecoupedFraction + 0.4 * cashflowComponent) * 10 * 10,
    ) / 10;

  return {
    score,
    refinanceCashOut,
    remainingCashInDeal,
    postRefiCashflowMonthly,
    rating: rate(score),
  };
}
```

- [ ] **Step 4: Export, run tests**

Modify `src/index.ts`: add `export * from './brrrr';`
Run: `npm test --workspace @propertyiq/analyzer-core`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer-core/src
git commit -m "feat(analyzer-core): computeBrrrrScore"
```

---

### Task 5: Property-based invariants with fast-check

**Files:**

- Create: `packages/analyzer-core/src/properties.test.ts`

- [ ] **Step 1: Write property tests**

```ts
// packages/analyzer-core/src/properties.test.ts
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  computeRentalMetrics,
  computeFlipMetrics,
  computeBrrrrScore,
} from "./index";

const financingArb = fc.record({
  downPaymentPct: fc.float({ min: 0, max: 1, noNaN: true }),
  interestRatePct: fc.float({ min: 0, max: 15, noNaN: true }),
  termYears: fc.integer({ min: 5, max: 40 }),
  closingCostsPct: fc.float({ min: 0, max: 0.1, noNaN: true }),
});

const dealArb = fc.record({
  price: fc.float({ min: 1, max: 5_000_000, noNaN: true }),
  rentMonthly: fc.option(fc.float({ min: 100, max: 20_000, noNaN: true }), {
    nil: null,
  }),
  taxAnnual: fc.option(fc.float({ min: 0, max: 50_000, noNaN: true }), {
    nil: null,
  }),
  insuranceAnnual: fc.option(fc.float({ min: 0, max: 20_000, noNaN: true }), {
    nil: null,
  }),
  financing: financingArb,
});

describe("rental invariants", () => {
  it("never throws on any valid input", () => {
    fc.assert(
      fc.property(dealArb, (input) => {
        expect(() => computeRentalMetrics(input)).not.toThrow();
      }),
      { numRuns: 500 },
    );
  });

  it("totalCashInvested = price * (down + closing)", () => {
    fc.assert(
      fc.property(dealArb, (input) => {
        const r = computeRentalMetrics(input);
        const expected =
          input.price *
          (input.financing.downPaymentPct +
            (input.financing.closingCostsPct ?? 0.03));
        expect(r.totalCashInvested).toBeCloseTo(expected, 6);
      }),
    );
  });

  it("null rent ⇒ null rental outputs", () => {
    fc.assert(
      fc.property(
        dealArb.filter((d) => d.rentMonthly == null),
        (input) => {
          const r = computeRentalMetrics(input);
          expect(r.capRatePct).toBeNull();
          expect(r.cashflowMonthly).toBeNull();
          expect(r.dscr).toBeNull();
        },
      ),
    );
  });
});

describe("flip invariants", () => {
  const flipArb = fc.record({
    price: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
    arv: fc.float({ min: 1, max: 2_000_000, noNaN: true }),
    rehabBudget: fc.float({ min: 0, max: 500_000, noNaN: true }),
    sellingCostsPct: fc.float({ min: 0, max: 0.2, noNaN: true }),
  });

  it("mao70 < arv when rehab > 0", () => {
    fc.assert(
      fc.property(
        flipArb.filter((f) => f.rehabBudget > 0),
        (input) => {
          const r = computeFlipMetrics(input);
          expect(r.mao70).toBeLessThan(input.arv);
        },
      ),
    );
  });

  it("wholetailMax > mao70", () => {
    fc.assert(
      fc.property(flipArb, (input) => {
        const r = computeFlipMetrics(input);
        expect(r.wholetailMax).toBeGreaterThan(r.mao70);
      }),
    );
  });
});
```

- [ ] **Step 2: Run — expect PASS (all properties hold)**

Run: `npm test --workspace @propertyiq/analyzer-core`
Expected: PASS for all property tests.

If any property fails, fix the math in the appropriate function. The failing input is reported by fast-check; copy it into a fixed unit test in the relevant `*.test.ts` file before fixing the math.

- [ ] **Step 3: Commit**

```bash
git add packages/analyzer-core/src/properties.test.ts
git commit -m "test(analyzer-core): fast-check property invariants"
```

---

## Phase 2 — MCP Refactor (Non-Breakage Gate)

### Task 6: Capture golden fixtures from current MCP behavior

**Files:**

- Create: `packages/mcp-server/src/tools/__tests__/investors.golden.spec.ts`
- Create: `packages/mcp-server/src/tools/__tests__/__fixtures__/investors-golden.json`

**Critical:** This task runs against the CURRENT inline-math implementation. Do NOT modify `investors.ts` until Task 7.

- [ ] **Step 1: Inspect existing test patterns**

Run: `Read packages/mcp-server/src/tools/__tests__/employment.spec.ts`
Note the pattern: how tools are imported, how API mocks are set up.

- [ ] **Step 2: Write the golden capture spec**

```ts
// packages/mcp-server/src/tools/__tests__/investors.golden.spec.ts
import { describe, it, expect, beforeAll, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { investorTools } from "../investors";

vi.mock("../../lib/api-client", () => ({
  fetchApi: vi.fn(async (url: string) => {
    // Return deterministic fake market data; the math we're freezing is INDEPENDENT
    // of these returns (mortgage formula, GRM, cap rate from rent input).
    if (url.includes("/market-snapshot/")) {
      return { home_value: 425_000, rent_index: 2_950, propertyiq_score: 73 };
    }
    if (url.includes("/scores/")) return { score: 73, label: "GOOD" };
    return null;
  }),
}));

const FIXTURE_PATH = path.join(
  __dirname,
  "__fixtures__",
  "investors-golden.json",
);

const cases = [
  {
    tool: "cashflow_estimate",
    args: { zip: "78704", purchase_price: 425_000 },
  },
  {
    tool: "cashflow_estimate",
    args: { zip: "78704", purchase_price: 425_000, down_pct: 25 },
  },
  {
    tool: "cashflow_estimate",
    args: { zip: "90210", purchase_price: 1_500_000, down_pct: 30 },
  },
  {
    tool: "cashflow_estimate",
    args: { zip: "50001", purchase_price: 120_000, down_pct: 100 },
  },
  {
    tool: "deal_analyzer",
    args: {
      geography: "zip",
      geo_id: "78704",
      purchase_price: 425_000,
      monthly_rent: 2_950,
    },
  },
  {
    tool: "deal_analyzer",
    args: {
      geography: "metro",
      geo_id: "35620",
      purchase_price: 600_000,
      monthly_rent: 2_000,
    },
  },
  {
    tool: "deal_analyzer",
    args: {
      geography: "county",
      geo_id: "06037",
      purchase_price: 800_000,
      monthly_rent: 4_500,
      down_pct: 35,
    },
  },
  {
    tool: "deal_analyzer",
    args: {
      geography: "zip",
      geo_id: "50001",
      purchase_price: 100_000,
      monthly_rent: 1_200,
    },
  },
];

function findTool(name: string) {
  const t = investorTools.find((x: any) => x.name === name);
  if (!t) throw new Error(`tool not found: ${name}`);
  return t;
}

describe("MCP investor tools — golden parity", () => {
  let golden: Record<string, any> = {};
  beforeAll(() => {
    if (fs.existsSync(FIXTURE_PATH)) {
      golden = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));
    }
  });

  it.each(cases)("preserves output for $tool $args", async ({ tool, args }) => {
    const handler = findTool(tool).handler;
    const result = await handler(args);
    const key = `${tool}::${JSON.stringify(args)}`;

    if (process.env.UPDATE_GOLDEN === "1") {
      golden[key] = JSON.parse(result);
      fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
      fs.writeFileSync(FIXTURE_PATH, JSON.stringify(golden, null, 2));
      return;
    }

    expect(golden[key]).toBeDefined();
    expect(JSON.parse(result)).toEqual(golden[key]);
  });
});
```

- [ ] **Step 3: Capture fixtures**

Run: `UPDATE_GOLDEN=1 npm test --workspace @propertyiq/mcp-server -- investors.golden`
(On Windows PowerShell: `$env:UPDATE_GOLDEN='1'; npm test ...`)

Expected: `investors-golden.json` created with 8 keyed entries.

- [ ] **Step 4: Verify replay passes**

Run: `npm test --workspace @propertyiq/mcp-server -- investors.golden`
Expected: 8 tests PASS — replaying the just-captured fixture.

- [ ] **Step 5: Commit fixtures + spec**

```bash
git add packages/mcp-server/src/tools/__tests__/investors.golden.spec.ts \
        packages/mcp-server/src/tools/__tests__/__fixtures__/investors-golden.json
git commit -m "test(mcp): golden fixtures for cashflow_estimate + deal_analyzer pre-refactor"
```

---

### Task 7: Refactor `cashflow_estimate` and `deal_analyzer` to use analyzer-core

**Files:**

- Modify: `packages/mcp-server/package.json` (add `@propertyiq/analyzer-core` dep)
- Modify: `packages/mcp-server/src/tools/investors.ts`

**Hard rule:** Golden parity spec must still pass byte-for-byte. The MCP adapter layer keeps the existing string formatting (`"7%"`, `cap_rate: "1.2%"`, `Math.round(...)`), default heuristics (1.5% tax/insurance, 1% maintenance), and the LLM `instructions` field. Only the _arithmetic_ moves.

- [ ] **Step 1: Add workspace dep**

Modify `packages/mcp-server/package.json` — add to `dependencies`:

```json
{
  "@propertyiq/analyzer-core": "*"
}
```

Run: `npm install`
Expected: `node_modules/@propertyiq/analyzer-core` symlinked.

- [ ] **Step 2: Refactor `cashflow_estimate` handler**

In `packages/mcp-server/src/tools/investors.ts`, replace the body of the `cashflow_estimate` handler (lines 27-65 in current file):

```ts
import { monthlyMortgagePayment } from '@propertyiq/analyzer-core';
// ... at top of file, add to existing imports

// Inside cashflow_estimate handler:
handler: async (args: any) => {
  const [snapshot, rents] = await Promise.all([
    fetchApi(`/api/market-snapshot/zip/${args.zip}`).catch(() => null),
    fetchApi(`/api/scores/zip/${args.zip}`).catch(() => null),
  ]);
  const price = args.purchase_price;
  const downPct = (args.down_pct || 20) / 100;
  const downPayment = price * downPct;
  const loanAmount = price - downPayment;
  // analyzer-core: pure P&I formula
  const monthlyMortgage = monthlyMortgagePayment(loanAmount, 7.0, 30);
  const estimatedTaxInsurance = (price * 0.015) / 12;
  const estimatedMaintenance = (price * 0.01) / 12;
  const totalMonthlyExpenses = monthlyMortgage + estimatedTaxInsurance + estimatedMaintenance;

  return JSON.stringify({
    market_data: snapshot,
    purchase_assumptions: {
      purchase_price: price,
      down_payment: downPayment,
      loan_amount: loanAmount,
      estimated_rate: "7%",
      monthly_mortgage: Math.round(monthlyMortgage),
      monthly_tax_insurance: Math.round(estimatedTaxInsurance),
      monthly_maintenance: Math.round(estimatedMaintenance),
      total_monthly_expenses: Math.round(totalMonthlyExpenses),
    },
    instructions:
      "Calculate cashflow using the rent data from market_data. Show: gross rent, total expenses, net monthly cashflow, annual cashflow, cap rate (NOI/price), and cash-on-cash return (annual cashflow/down payment). Include a plain-language verdict.",
  }, null, 2);
},
```

- [ ] **Step 3: Refactor `deal_analyzer` handler**

Replace the body of the `deal_analyzer` handler (current lines 144-181):

```ts
import { computeRentalMetrics } from '@propertyiq/analyzer-core';

handler: async (args: any) => {
  const snapshot = await fetchApi(`/api/market-snapshot/${args.geography}/${args.geo_id}`).catch(() => null);
  const price = args.purchase_price;
  const rent = args.monthly_rent;
  const downPct = (args.down_pct || 20) / 100;

  // analyzer-core: pure math. Match existing semantics exactly (40% expense ratio,
  // 7% rate, no term assumed by old code — derive annualDebtService = loan * 0.07).
  // For golden parity, we keep the OLD model (simple-interest-style annualDebtService),
  // NOT the proper amortization. analyzer-core's computeRentalMetrics does proper
  // amortization, so we synthesize the OLD values from primitives:
  const annualRent = rent * 12;
  const grm = price / annualRent;
  const expenses = annualRent * 0.4;
  const noi = annualRent - expenses;
  const capRatePct = (noi / price) * 100;
  const downPayment = price * downPct;
  const loanAmount = price - downPayment;
  const annualDebtService = loanAmount * 0.07;  // PRESERVE simple-interest model for parity
  const cashflow = noi - annualDebtService;
  const cocReturnPct = (cashflow / downPayment) * 100;

  return JSON.stringify({
    deal_metrics: {
      purchase_price: price,
      monthly_rent: rent,
      annual_rent: annualRent,
      grm: grm.toFixed(1),
      estimated_noi: Math.round(noi),
      cap_rate: capRatePct.toFixed(1) + "%",
      cash_on_cash: cocReturnPct.toFixed(1) + "%",
      annual_cashflow: Math.round(cashflow),
    },
    market_context: snapshot,
    instructions:
      "Analyze this deal. Compare GRM and cap rate to market averages. Give a verdict: Strong Buy, Buy, Hold, or Pass. Explain why in 2-3 sentences.",
  }, null, 2);
},
```

**Note on `deal_analyzer`:** The existing tool uses a simple-interest debt-service model (`loan * 0.07`), NOT proper amortization. To preserve byte parity, we keep that model in the MCP layer. The frontend `/analyzer` page will use analyzer-core's proper amortization via `computeRentalMetrics`. This is a documented divergence — the MCP tool is a back-of-napkin estimator, the on-site analyzer is precise.

For `cashflow_estimate`, the existing tool uses proper amortization (the full P&I formula), so it benefits directly from `monthlyMortgagePayment`.

- [ ] **Step 4: Run golden parity — MUST PASS byte-for-byte**

Run: `npm test --workspace @propertyiq/mcp-server -- investors.golden`
Expected: 8 PASS.

If any FAIL: do NOT update fixtures. Diff the actual vs expected output and bring them back into alignment by adjusting the adapter (the formatting/rounding/string concat layer), not the math.

- [ ] **Step 5: Build MCP server**

Run: `npm run build --workspace @propertyiq/mcp-server`
Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-server/package.json packages/mcp-server/src/tools/investors.ts package-lock.json
git commit -m "refactor(mcp): cashflow_estimate + deal_analyzer use @propertyiq/analyzer-core"
```

---

## Phase 3 — Backend: Database & Analyzer Module

### Task 8: `deal_analyses` migration + RLS + share function

**Files:**

- Create: `packages/backend/src/database/migrations/2026-05-14-create-deal-analyses.sql`
- Modify: nothing else (migrations are auto-applied by existing infra; confirm pattern with the team's existing migration runner)

- [ ] **Step 1: Verify migration runner pattern**

Run: `ls packages/backend/src/database/migrations/ | tail -5`
Expected: existing SQL files in `YYYY-MM-DD-...sql` format (or similar). Match the existing pattern.

- [ ] **Step 2: Write migration**

```sql
-- packages/backend/src/database/migrations/2026-05-14-create-deal-analyses.sql

CREATE TABLE IF NOT EXISTS deal_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token     TEXT NOT NULL UNIQUE,
  label           TEXT,
  address_full    TEXT,
  address_city    TEXT NOT NULL,
  address_state   TEXT NOT NULL,
  address_zip     TEXT,
  lat             NUMERIC(9, 6),
  lon             NUMERIC(9, 6),
  input_snapshot  JSONB NOT NULL,
  result_snapshot JSONB NOT NULL,
  market_context  JSONB,
  ai_verdict      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_analyses_owner ON deal_analyses (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_analyses_share_token ON deal_analyses (share_token);

ALTER TABLE deal_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_analyses_owner_select ON deal_analyses;
CREATE POLICY deal_analyses_owner_select ON deal_analyses FOR SELECT USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS deal_analyses_owner_insert ON deal_analyses;
CREATE POLICY deal_analyses_owner_insert ON deal_analyses FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS deal_analyses_owner_update ON deal_analyses;
CREATE POLICY deal_analyses_owner_update ON deal_analyses FOR UPDATE USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS deal_analyses_owner_delete ON deal_analyses;
CREATE POLICY deal_analyses_owner_delete ON deal_analyses FOR DELETE USING (auth.uid() = owner_id);

-- Per memory note: service_role + authenticated GRANTs required for sb_secret_/JWT access.
GRANT ALL ON deal_analyses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON deal_analyses TO authenticated;

-- Public share access via SECURITY DEFINER function. Strips PII.
CREATE OR REPLACE FUNCTION get_shared_analysis(p_token TEXT)
RETURNS TABLE (
  id              UUID,
  label           TEXT,
  address_city    TEXT,
  address_state   TEXT,
  address_zip     TEXT,
  input_snapshot  JSONB,
  result_snapshot JSONB,
  market_context  JSONB,
  ai_verdict      JSONB,
  created_at      TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, label, address_city, address_state, address_zip,
         input_snapshot, result_snapshot, market_context, ai_verdict, created_at
  FROM deal_analyses
  WHERE share_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_shared_analysis(TEXT) TO anon, authenticated, service_role;
```

- [ ] **Step 3: Apply migration via existing runner**

Run: (use the team's existing migration command; check `packages/backend/package.json` scripts.)
Common pattern: `npm run migration:run --workspace @propertyiq/backend`

Expected: table created, RLS enabled, function created.

- [ ] **Step 4: Smoke check via psql / Supabase SQL**

Run via Supabase SQL editor:

```sql
SELECT tablename FROM pg_tables WHERE tablename = 'deal_analyses';
SELECT policyname FROM pg_policies WHERE tablename = 'deal_analyses';
SELECT proname FROM pg_proc WHERE proname = 'get_shared_analysis';
```

Expected: table exists, 4 policies listed, function exists.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/database/migrations/2026-05-14-create-deal-analyses.sql
git commit -m "feat(backend): deal_analyses table + RLS + share function"
```

---

### Task 9: `AnalyzerModule` + `GET /api/analyzer/market-context`

**Files:**

- Create: `packages/backend/src/analyzer/analyzer.module.ts`
- Create: `packages/backend/src/analyzer/analyzer.controller.ts`
- Create: `packages/backend/src/analyzer/analyzer.service.ts`
- Create: `packages/backend/src/analyzer/dto/market-context.dto.ts`
- Create: `packages/backend/src/analyzer/__tests__/analyzer.service.spec.ts`
- Modify: `packages/backend/src/app.module.ts` (import AnalyzerModule)

- [ ] **Step 1: Read the existing module pattern + MetricResolutionService API**

Run:

```
Read packages/backend/src/metric-resolution/metric-resolution.service.ts (first 80 lines)
Read packages/backend/src/scoring/propertyiq-scores.controller.ts (first 60 lines)
```

Note: the public methods of `MetricResolutionService` (`resolveMetricBatch`, signatures, returned shape).

- [ ] **Step 2: Write service test**

```ts
// packages/backend/src/analyzer/__tests__/analyzer.service.spec.ts
import { Test } from "@nestjs/testing";
import { AnalyzerService } from "../analyzer.service";
import { MetricResolutionService } from "../../metric-resolution/metric-resolution.service";
import { PropertyiqScoresService } from "../../scoring/propertyiq-scores.service";

describe("AnalyzerService.getMarketContext", () => {
  let service: AnalyzerService;
  let metricResolution: { resolveMetricBatch: jest.Mock };
  let piqScores: { findOne: jest.Mock };

  beforeEach(async () => {
    metricResolution = { resolveMetricBatch: jest.fn() };
    piqScores = { findOne: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        AnalyzerService,
        { provide: MetricResolutionService, useValue: metricResolution },
        { provide: PropertyiqScoresService, useValue: piqScores },
      ],
    }).compile();
    service = mod.get(AnalyzerService);
  });

  it("returns full context when all sources resolve", async () => {
    metricResolution.resolveMetricBatch.mockResolvedValue({
      home_value: { value: 425_000, source: "zillow" },
      rent_index: { value: 2_950, source: "zillow" },
      market_heat: { value: 8.2, source: "zillow" },
      net_migration: { value: 2_100, source: "irs" },
    });
    piqScores.findOne.mockResolvedValue({ score: 73, label: "GOOD" });

    const ctx = await service.getMarketContext({ zip: "78704" });
    expect(ctx.home_value).toEqual({ value: 425_000, source: "zillow" });
    expect(ctx.rent_index!.value).toBe(2_950);
    expect(ctx.piq_score).toEqual({ value: 73, label: "GOOD" });
  });

  it("returns nulls per-field when individual sources fail", async () => {
    metricResolution.resolveMetricBatch.mockResolvedValue({
      home_value: { value: 300_000, source: "zillow" },
      rent_index: { value: null, source: null },
      market_heat: { value: null, source: null },
      net_migration: { value: null, source: null },
    });
    piqScores.findOne.mockRejectedValue(new Error("not found"));

    const ctx = await service.getMarketContext({ zip: "99999" });
    expect(ctx.home_value!.value).toBe(300_000);
    expect(ctx.rent_index!.value).toBeNull();
    expect(ctx.piq_score).toBeNull();
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npm test --workspace @propertyiq/backend -- analyzer.service`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement DTO**

```ts
// packages/backend/src/analyzer/dto/market-context.dto.ts
export interface MetricValueDto {
  value: number | null;
  source: string | null;
}

export interface MarketContextDto {
  geo_level: "zip" | "county" | "metro" | "state" | null;
  geo_id: string | null;
  home_value: MetricValueDto | null;
  rent_index: MetricValueDto | null;
  market_heat: MetricValueDto | null;
  net_migration: MetricValueDto | null;
  piq_score: { value: number; label: string } | null;
}
```

- [ ] **Step 5: Implement service**

```ts
// packages/backend/src/analyzer/analyzer.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { MetricResolutionService } from "../metric-resolution/metric-resolution.service";
import { PropertyiqScoresService } from "../scoring/propertyiq-scores.service";
import type { MarketContextDto } from "./dto/market-context.dto";

@Injectable()
export class AnalyzerService {
  private readonly logger = new Logger(AnalyzerService.name);

  constructor(
    private readonly metricResolution: MetricResolutionService,
    private readonly piqScores: PropertyiqScoresService,
  ) {}

  async getMarketContext(params: {
    zip?: string;
    county_fips?: string;
    state?: string;
  }): Promise<MarketContextDto> {
    let geoLevel: MarketContextDto["geo_level"] = null;
    let geoId: string | null = null;
    if (params.zip) {
      geoLevel = "zip";
      geoId = params.zip;
    } else if (params.county_fips) {
      geoLevel = "county";
      geoId = params.county_fips;
    } else if (params.state) {
      geoLevel = "state";
      geoId = params.state;
    }

    if (!geoLevel || !geoId) {
      return {
        geo_level: null,
        geo_id: null,
        home_value: null,
        rent_index: null,
        market_heat: null,
        net_migration: null,
        piq_score: null,
      };
    }

    const metrics = await this.metricResolution
      .resolveMetricBatch(
        ["home_value", "rent_index", "market_heat", "net_migration"],
        geoLevel,
        geoId,
      )
      .catch((err) => {
        this.logger.warn(`metric batch failed: ${err.message}`);
        return {} as Record<
          string,
          { value: number | null; source: string | null }
        >;
      });

    let piq: MarketContextDto["piq_score"] = null;
    try {
      const score = await this.piqScores.findOne(geoLevel, geoId);
      if (score) piq = { value: score.score, label: score.label };
    } catch (err) {
      this.logger.warn(`piq score lookup failed: ${(err as Error).message}`);
    }

    return {
      geo_level: geoLevel,
      geo_id: geoId,
      home_value: metrics.home_value ?? null,
      rent_index: metrics.rent_index ?? null,
      market_heat: metrics.market_heat ?? null,
      net_migration: metrics.net_migration ?? null,
      piq_score: piq,
    };
  }
}
```

- [ ] **Step 6: Implement controller**

```ts
// packages/backend/src/analyzer/analyzer.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import { IsOptional, IsString, Matches } from "class-validator";
import { AnalyzerService } from "./analyzer.service";

class MarketContextQuery {
  @IsOptional() @IsString() @Matches(/^\d{5}$/) zip?: string;
  @IsOptional() @IsString() @Matches(/^\d{5}$/) county_fips?: string;
  @IsOptional() @IsString() @Matches(/^[A-Z]{2}$/) state?: string;
}

@Controller("api/analyzer")
export class AnalyzerController {
  constructor(private readonly service: AnalyzerService) {}

  @Get("market-context")
  getMarketContext(@Query() q: MarketContextQuery) {
    return this.service.getMarketContext(q);
  }
}
```

- [ ] **Step 7: Implement module + register in app.module**

```ts
// packages/backend/src/analyzer/analyzer.module.ts
import { Module } from "@nestjs/common";
import { AnalyzerController } from "./analyzer.controller";
import { AnalyzerService } from "./analyzer.service";
import { MetricResolutionModule } from "../metric-resolution/metric-resolution.module";
import { ScoringModule } from "../scoring/scoring.module";

@Module({
  imports: [MetricResolutionModule, ScoringModule],
  controllers: [AnalyzerController],
  providers: [AnalyzerService],
  exports: [AnalyzerService],
})
export class AnalyzerModule {}
```

In `packages/backend/src/app.module.ts`, add `AnalyzerModule` to the `imports` array.

- [ ] **Step 8: Run tests + start backend**

Run: `npm test --workspace @propertyiq/backend -- analyzer.service`
Expected: PASS.

Run: `npm run start:dev --workspace @propertyiq/backend` (or your dev script)
Then: `curl http://localhost:3001/api/analyzer/market-context?zip=78704`
Expected: 200 with JSON body containing `home_value`, `rent_index`, etc.

- [ ] **Step 9: Commit**

```bash
git add packages/backend/src/analyzer packages/backend/src/app.module.ts
git commit -m "feat(backend): AnalyzerModule + GET /api/analyzer/market-context"
```

---

### Task 10: Free-preview cookie middleware

**Files:**

- Create: `packages/backend/src/analyzer/free-preview.middleware.ts`
- Create: `packages/backend/src/analyzer/__tests__/free-preview.middleware.spec.ts`
- Modify: `packages/backend/src/analyzer/analyzer.module.ts` (apply middleware to `market-context` + `ai-verdict`)
- Modify: `packages/backend/src/main.ts` (ensure `cookie-parser` registered if not already)

- [ ] **Step 1: Failing test**

```ts
// packages/backend/src/analyzer/__tests__/free-preview.middleware.spec.ts
import { FreePreviewMiddleware } from "../free-preview.middleware";

process.env.ANALYZER_PREVIEW_SECRET =
  "test-secret-only-for-tests-do-not-use-anywhere-else";

function makeCtx(cookieVal?: string, authed = false) {
  const req: any = {
    cookies: cookieVal ? { piq_analyzer_uses: cookieVal } : {},
    user: authed ? { id: "u1" } : undefined,
  };
  const setCookie = jest.fn();
  const res: any = {
    cookie: setCookie,
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();
  return { req, res, next, setCookie };
}

describe("FreePreviewMiddleware", () => {
  it('first anonymous use: sets cookie to signed "1", calls next', () => {
    const m = new FreePreviewMiddleware();
    const { req, res, next, setCookie } = makeCtx();
    m.use(req, res, next);
    expect(setCookie).toHaveBeenCalledWith(
      "piq_analyzer_uses",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, signed: false }),
    );
    expect(next).toHaveBeenCalled();
  });

  it("fourth anonymous use: 402 quota exceeded", () => {
    const m = new FreePreviewMiddleware();
    const initial = m.sign(3);
    const { req, res, next } = makeCtx(initial);
    m.use(req, res, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it("authenticated user bypasses", () => {
    const m = new FreePreviewMiddleware();
    const { req, res, next, setCookie } = makeCtx(m.sign(3), true);
    m.use(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("tampered cookie is rejected, counter resets to 1", () => {
    const m = new FreePreviewMiddleware();
    const { req, res, next, setCookie } = makeCtx("not-a-valid-signed-value");
    m.use(req, res, next);
    expect(setCookie).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement middleware**

```ts
// packages/backend/src/analyzer/free-preview.middleware.ts
import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import * as crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const COOKIE = "piq_analyzer_uses";
const LIFETIME_CAP = 3;
const MAX_AGE_MS = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years — "lifetime"

@Injectable()
export class FreePreviewMiddleware implements NestMiddleware {
  private readonly logger = new Logger(FreePreviewMiddleware.name);
  private readonly secret: string;

  constructor() {
    const s = process.env.ANALYZER_PREVIEW_SECRET;
    if (!s) throw new Error("ANALYZER_PREVIEW_SECRET is required"); // per CLAUDE.md §1.2
    this.secret = s;
  }

  sign(count: number): string {
    const payload = String(count);
    const mac = crypto
      .createHmac("sha256", this.secret)
      .update(payload)
      .digest("hex")
      .slice(0, 32);
    return `${payload}.${mac}`;
  }

  verify(cookie: string | undefined): number | null {
    if (!cookie) return null;
    const [payload, mac] = cookie.split(".");
    if (!payload || !mac) return null;
    const expectedMac = crypto
      .createHmac("sha256", this.secret)
      .update(payload)
      .digest("hex")
      .slice(0, 32);
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac)))
      return null;
    const n = parseInt(payload, 10);
    return Number.isFinite(n) ? n : null;
  }

  use(
    req: Request & { user?: { id: string } },
    res: Response,
    next: NextFunction,
  ): void {
    if (req.user?.id) {
      // Authenticated — entitlements layer handles gating downstream.
      return next();
    }

    const current = this.verify(req.cookies?.[COOKIE]) ?? 0;
    if (current >= LIFETIME_CAP) {
      res.status(402).json({
        error: "free_quota_exceeded",
        message: "Sign up for free to continue analyzing.",
        used: current,
        cap: LIFETIME_CAP,
      });
      return;
    }
    const next_count = current + 1;
    res.cookie(COOKIE, this.sign(next_count), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: MAX_AGE_MS,
      path: "/",
    });
    next();
  }
}
```

- [ ] **Step 4: Wire up in module**

```ts
// packages/backend/src/analyzer/analyzer.module.ts
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { AnalyzerController } from "./analyzer.controller";
import { AnalyzerService } from "./analyzer.service";
import { FreePreviewMiddleware } from "./free-preview.middleware";
import { MetricResolutionModule } from "../metric-resolution/metric-resolution.module";
import { ScoringModule } from "../scoring/scoring.module";

@Module({
  imports: [MetricResolutionModule, ScoringModule],
  controllers: [AnalyzerController],
  providers: [AnalyzerService, FreePreviewMiddleware],
  exports: [AnalyzerService],
})
export class AnalyzerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(FreePreviewMiddleware)
      .forRoutes(
        { path: "api/analyzer/market-context", method: RequestMethod.GET },
        { path: "api/analyzer/ai-verdict", method: RequestMethod.POST },
      );
  }
}
```

- [ ] **Step 5: Ensure cookie-parser middleware is enabled**

Check `packages/backend/src/main.ts`. If `app.use(cookieParser())` is not present, add it:

```ts
import * as cookieParser from "cookie-parser";
// ...
app.use(cookieParser());
```

Add dep if missing: `npm install --workspace @propertyiq/backend cookie-parser @types/cookie-parser`

- [ ] **Step 6: Add `ANALYZER_PREVIEW_SECRET` to env**

Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
Add to local `.env`: `ANALYZER_PREVIEW_SECRET=<generated>`
Add to Railway via dashboard (per CLAUDE.md §4.3 — `.env` is local only).

- [ ] **Step 7: Run tests + curl smoke**

Run: `npm test --workspace @propertyiq/backend -- free-preview`
Expected: PASS (4 tests).

Restart backend. Then:

```bash
curl -i http://localhost:3001/api/analyzer/market-context?zip=78704 -c cookies.txt
curl -i http://localhost:3001/api/analyzer/market-context?zip=78704 -b cookies.txt -c cookies.txt
curl -i http://localhost:3001/api/analyzer/market-context?zip=78704 -b cookies.txt -c cookies.txt
curl -i http://localhost:3001/api/analyzer/market-context?zip=78704 -b cookies.txt -c cookies.txt
```

Expected: 3rd succeeds (200), 4th returns 402 quota exceeded.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/analyzer packages/backend/src/main.ts packages/backend/package.json package-lock.json
git commit -m "feat(backend): free-preview cookie middleware (lifetime cap 3)"
```

---

### Task 11: `POST /api/analyzer/ai-verdict` (streaming Anthropic)

**Files:**

- Modify: `packages/backend/src/analyzer/analyzer.controller.ts` (add verdict endpoint)
- Modify: `packages/backend/src/analyzer/analyzer.service.ts` (add `streamAiVerdict`)
- Create: `packages/backend/src/analyzer/dto/ai-verdict.dto.ts`
- Create: `packages/backend/src/analyzer/__tests__/ai-verdict.spec.ts`

This endpoint is Pro-gated AND cookie-gated. Anonymous users hit the middleware cap; logged-in non-Pro users get a 403 from the controller guard.

- [ ] **Step 1: Read existing Anthropic integration pattern**

Run: `Grep "Anthropic|anthropic" packages/backend/src --type ts -l`
Find the existing client. Note its module export.

- [ ] **Step 2: Failing test**

```ts
// packages/backend/src/analyzer/__tests__/ai-verdict.spec.ts
import { AnalyzerService } from "../analyzer.service";

describe("AnalyzerService.buildVerdictPrompt", () => {
  it("includes input, result, market context, and required output schema", () => {
    const svc = new AnalyzerService(null as any, null as any, null as any);
    const prompt = svc.buildVerdictPrompt({
      input: {
        price: 425_000,
        rentMonthly: 2_950,
        taxAnnual: 7_650,
        insuranceAnnual: 1_800,
        financing: { downPaymentPct: 0.2, interestRatePct: 7.1, termYears: 30 },
      } as any,
      result: { capRatePct: 4.2, cashflowMonthly: 284, dscr: 1.18 } as any,
      marketContext: { piq_score: { value: 73, label: "GOOD" } } as any,
    });
    expect(prompt).toContain("425000");
    expect(prompt).toContain("cap rate");
    expect(prompt).toContain("verdict");
    expect(prompt).toContain("buy");
    expect(prompt).toContain("negotiate");
    expect(prompt).toContain("pass");
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

- [ ] **Step 4: Implement DTO**

```ts
// packages/backend/src/analyzer/dto/ai-verdict.dto.ts
import {
  IsNumber,
  IsObject,
  ValidateNested,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";

export class AiVerdictRequestDto {
  @IsObject() input!: Record<string, unknown>;
  @IsObject() result!: Record<string, unknown>;
  @IsOptional() @IsObject() marketContext?: Record<string, unknown>;
}
```

- [ ] **Step 5: Implement service method**

Add to `analyzer.service.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';

// In constructor, inject Anthropic client per the existing pattern in the codebase.
// (If no DI provider exists, instantiate: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
// with hard-fail on missing key per CLAUDE.md §1.2.)

buildVerdictPrompt(payload: { input: any; result: any; marketContext?: any }): string {
  return [
    'You are an experienced real-estate investor evaluating a single deal.',
    'Return ONLY a JSON object with this shape: {"verdict":"buy"|"negotiate"|"pass","target_price":number|null,"strengths":string[],"risks":string[],"reasoning":string}.',
    '',
    'Deal input:',
    JSON.stringify(payload.input),
    '',
    'Computed metrics:',
    JSON.stringify(payload.result),
    payload.marketContext ? `\nMarket context:\n${JSON.stringify(payload.marketContext)}` : '',
    '',
    'Consider: cap rate vs market, DSCR (must be > 1.0), cashflow margin, PropertyIQ score, rent trend.',
    'Be specific. Cite numbers. Output ONLY the JSON object.',
  ].join('\n');
}

async *streamAiVerdict(payload: AiVerdictRequestDto): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required'); // CLAUDE.md §1.2
  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: 'You are a precise, numerate real-estate analyst. Output ONLY valid JSON.',
    messages: [{ role: 'user', content: this.buildVerdictPrompt(payload) }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
```

- [ ] **Step 6: Add controller endpoint (Pro guard + streaming)**

```ts
// in analyzer.controller.ts
import { Body, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AiVerdictRequestDto } from './dto/ai-verdict.dto';
import { ProTierGuard } from '../entitlements/pro-tier.guard'; // verify exact path in repo

@Post('ai-verdict')
@UseGuards(ProTierGuard)
async aiVerdict(@Body() body: AiVerdictRequestDto, @Res() res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  try {
    for await (const chunk of this.service.streamAiVerdict(body)) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
  } finally {
    res.end();
  }
}
```

If `ProTierGuard` does not exist at the assumed path, locate the existing tier-checking guard via:
`Grep "tier|Pro|entitlement" packages/backend/src --type ts | grep -i guard`
and use that.

- [ ] **Step 7: Run tests + smoke**

Run: `npm test --workspace @propertyiq/backend -- ai-verdict`
Expected: PASS (prompt builder test).

Smoke test (requires Pro session token):

```bash
curl -N -X POST http://localhost:3001/api/analyzer/ai-verdict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <pro-jwt>" \
  -d '{"input":{"price":425000,"rentMonthly":2950,"taxAnnual":7650,"insuranceAnnual":1800,"financing":{"downPaymentPct":0.2,"interestRatePct":7.1,"termYears":30}},"result":{"capRatePct":4.2,"cashflowMonthly":284}}'
```

Expected: streaming SSE with JSON chunks ending in `[DONE]`.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/analyzer
git commit -m "feat(backend): POST /api/analyzer/ai-verdict (Pro-gated streaming)"
```

---

### Task 12: Save / list / get / delete / share endpoints

**Files:**

- Modify: `packages/backend/src/analyzer/analyzer.controller.ts`
- Modify: `packages/backend/src/analyzer/analyzer.service.ts`
- Create: `packages/backend/src/analyzer/dto/analysis-snapshot.dto.ts`
- Create: `packages/backend/src/analyzer/__tests__/save-and-share.spec.ts`

- [ ] **Step 1: DTO**

```ts
// packages/backend/src/analyzer/dto/analysis-snapshot.dto.ts
import {
  IsObject,
  IsOptional,
  IsString,
  IsNumber,
  MaxLength,
} from "class-validator";

export class AnalysisSnapshotDto {
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsString() @MaxLength(500) address_full?: string;
  @IsString() @MaxLength(120) address_city!: string;
  @IsString() @MaxLength(2) address_state!: string;
  @IsOptional() @IsString() @MaxLength(10) address_zip?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lon?: number;
  @IsObject() input_snapshot!: Record<string, unknown>;
  @IsObject() result_snapshot!: Record<string, unknown>;
  @IsOptional() @IsObject() market_context?: Record<string, unknown>;
  @IsOptional() @IsObject() ai_verdict?: Record<string, unknown>;
}
```

- [ ] **Step 2: Service methods**

Add to `AnalyzerService`:

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'node:crypto';

// In constructor or injected: get a service-role Supabase client per existing pattern.

async save(ownerId: string, dto: AnalysisSnapshotDto) {
  const shareToken = crypto.randomBytes(16).toString('base64url');
  const { data, error } = await this.supabase
    .from('deal_analyses')
    .insert({ owner_id: ownerId, share_token: shareToken, ...dto })
    .select('id, share_token')
    .single();
  if (error) throw new Error(`save failed: ${error.message}`);
  return data;
}

async list(ownerId: string, opts: { limit: number; cursor?: string } = { limit: 20 }) {
  let q = this.supabase
    .from('deal_analyses')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(opts.limit);
  if (opts.cursor) q = q.lt('created_at', opts.cursor);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

async getOne(ownerId: string, id: string) {
  const { data, error } = await this.supabase
    .from('deal_analyses')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

async remove(ownerId: string, id: string) {
  const { error } = await this.supabase
    .from('deal_analyses')
    .delete()
    .eq('owner_id', ownerId)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

async getShared(token: string) {
  const { data, error } = await this.supabase.rpc('get_shared_analysis', { p_token: token });
  if (error) return null;
  if (!data || data.length === 0) return null;
  return data[0];
}
```

- [ ] **Step 3: Controller endpoints**

```ts
import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard'; // verify exact path
import { ProTierGuard } from '../entitlements/pro-tier.guard';
import { AnalysisSnapshotDto } from './dto/analysis-snapshot.dto';

// ...inside the existing AnalyzerController:

@Post('save')
@UseGuards(AuthGuard, ProTierGuard)
async save(@Req() req: any, @Body() body: AnalysisSnapshotDto) {
  return this.service.save(req.user.id, body);
}

@Get('saved')
@UseGuards(AuthGuard)
async list(@Req() req: any, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
  return this.service.list(req.user.id, { limit: Math.min(parseInt(limit ?? '20', 10), 50), cursor });
}

@Get('saved/:id')
@UseGuards(AuthGuard)
async getOne(@Req() req: any, @Param('id') id: string) {
  const row = await this.service.getOne(req.user.id, id);
  if (!row) {
    return { statusCode: 404, error: 'not_found' };
  }
  return row;
}

@Delete('saved/:id')
@UseGuards(AuthGuard)
async remove(@Req() req: any, @Param('id') id: string) {
  await this.service.remove(req.user.id, id);
  return { ok: true };
}

@Get('share/:token')
async getShared(@Param('token') token: string) {
  const row = await this.service.getShared(token);
  if (!row) return { statusCode: 404, error: 'not_found' };
  return row;
}
```

- [ ] **Step 4: Test**

```ts
// packages/backend/src/analyzer/__tests__/save-and-share.spec.ts
import { AnalyzerService } from "../analyzer.service";

describe("AnalyzerService save & share", () => {
  let svc: AnalyzerService;
  let supabase: any;

  beforeEach(() => {
    supabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "a1", share_token: "tok" },
        error: null,
      }),
      rpc: jest.fn().mockResolvedValue({
        data: [{ id: "a1", label: "shared" }],
        error: null,
      }),
    };
    svc = new AnalyzerService(null as any, null as any, supabase);
  });

  it("save returns id + share_token", async () => {
    const r = await svc.save("owner-1", {
      address_city: "Austin",
      address_state: "TX",
      input_snapshot: {},
      result_snapshot: {},
    });
    expect(r.share_token).toBe("tok");
  });

  it("getShared returns first row from rpc", async () => {
    const r = await svc.getShared("tok");
    expect(r.id).toBe("a1");
  });
});
```

- [ ] **Step 5: Run + smoke**

Run: `npm test --workspace @propertyiq/backend -- save-and-share`
Expected: PASS.

```bash
# With Pro auth:
curl -X POST http://localhost:3001/api/analyzer/save \
  -H "Authorization: Bearer <pro-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"address_city":"Austin","address_state":"TX","input_snapshot":{},"result_snapshot":{}}'
# → { "id": "...", "share_token": "..." }
curl http://localhost:3001/api/analyzer/share/<token>
# → row without owner_id
```

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/analyzer
git commit -m "feat(backend): save/list/get/delete/share analysis endpoints"
```

---

### Task 13: Backend E2E against real Supabase test schema

**Files:**

- Create: `packages/backend/test/analyzer.e2e-spec.ts`

Per `[[feedback_plans-must-include-e2e-tests]]` — uses a real test Supabase project (NOT mocks).

- [ ] **Step 1: Read existing E2E pattern**

Run: `ls packages/backend/test/`. Read one existing `*.e2e-spec.ts` to match the bootstrap (`createTestingModule`, `Test.compileForTesting`, schema cleanup).

- [ ] **Step 2: Write the E2E**

```ts
// packages/backend/test/analyzer.e2e-spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";

describe("Analyzer (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.ANALYZER_PREVIEW_SECRET ||= "e2e-test-secret-" + Date.now();
    const mod: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/analyzer/market-context returns context (1st anonymous call)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/analyzer/market-context?zip=78704")
      .expect(200);
    expect(res.body).toHaveProperty("geo_level", "zip");
    expect(res.body).toHaveProperty("geo_id", "78704");
  });

  it("GET /api/analyzer/market-context blocks after 3 anonymous calls", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get("/api/analyzer/market-context?zip=78704").expect(200);
    await agent.get("/api/analyzer/market-context?zip=78704").expect(200);
    await agent.get("/api/analyzer/market-context?zip=78704").expect(200);
    const res = await agent
      .get("/api/analyzer/market-context?zip=78704")
      .expect(402);
    expect(res.body.error).toBe("free_quota_exceeded");
  });

  it("POST /api/analyzer/save requires auth", async () => {
    await request(app.getHttpServer())
      .post("/api/analyzer/save")
      .send({
        address_city: "Austin",
        address_state: "TX",
        input_snapshot: {},
        result_snapshot: {},
      })
      .expect(401);
  });

  // Auth-required tests rely on a Pro JWT fixture. If absent, mark .skip and document
  // how to enable (set SUPABASE_TEST_PRO_JWT env var pointing at a Pro test user).
});
```

- [ ] **Step 3: Run**

Run: `npm run test:e2e --workspace @propertyiq/backend -- analyzer`
Expected: 3 tests PASS (anonymous paths). Auth-required tests skip with documentation.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/test/analyzer.e2e-spec.ts
git commit -m "test(backend): e2e for analyzer endpoints + quota enforcement"
```

---

## Phase 4 — Frontend: Hooks & Data Layer

### Task 14: `useAddressAutocomplete` (Mapbox Places)

**Files:**

- Create: `packages/frontend/lib/analyzer/useAddressAutocomplete.ts`
- Create: `packages/frontend/lib/analyzer/__tests__/useAddressAutocomplete.test.tsx`
- Create: `packages/frontend/lib/analyzer/types.ts`

- [ ] **Step 1: Types**

```ts
// packages/frontend/lib/analyzer/types.ts
export interface AddressSuggestion {
  id: string;
  full: string;
  street: string;
  city: string;
  state: string;
  postalCode: string | null;
  lat: number;
  lon: number;
}
```

- [ ] **Step 2: Failing test**

```tsx
// packages/frontend/lib/analyzer/__tests__/useAddressAutocomplete.test.tsx
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAddressAutocomplete } from "../useAddressAutocomplete";

const fetchMock = jest.fn();
global.fetch = fetchMock as any;
process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "test.token";

describe("useAddressAutocomplete", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("does not query under 3 chars", async () => {
    const { result } = renderHook(() => useAddressAutocomplete());
    act(() => {
      result.current.setQuery("12");
    });
    await new Promise((r) => setTimeout(r, 300));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("debounces and queries Mapbox places API after 3+ chars", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            id: "addr.1",
            place_name: "123 Main St, Austin, TX 78704",
            text: "123 Main St",
            center: [-97.7, 30.25],
            context: [
              { id: "postcode.1", text: "78704" },
              { id: "place.1", text: "Austin" },
              { id: "region.1", short_code: "US-TX", text: "Texas" },
            ],
          },
        ],
      }),
    });
    const { result } = renderHook(() => useAddressAutocomplete());
    act(() => {
      result.current.setQuery("123 Main");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toContain("mapbox.places");
    expect(fetchMock.mock.calls[0][0]).toContain("types=address");
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
    expect(result.current.suggestions[0].postalCode).toBe("78704");
    expect(result.current.suggestions[0].state).toBe("TX");
  });
});
```

- [ ] **Step 3: Run — FAIL**

- [ ] **Step 4: Implement**

```ts
// packages/frontend/lib/analyzer/useAddressAutocomplete.ts
import { useEffect, useRef, useState } from "react";
import type { AddressSuggestion } from "./types";

interface MapboxFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
  context?: Array<{ id: string; text: string; short_code?: string }>;
}

function parse(feature: MapboxFeature): AddressSuggestion {
  const ctx = feature.context ?? [];
  const postcode = ctx.find((c) => c.id.startsWith("postcode"))?.text ?? null;
  const place = ctx.find((c) => c.id.startsWith("place"))?.text ?? "";
  const region = ctx.find((c) => c.id.startsWith("region"));
  const state = region?.short_code?.replace("US-", "") ?? "";
  return {
    id: feature.id,
    full: feature.place_name,
    street: feature.text,
    city: place,
    state,
    postalCode: postcode,
    lon: feature.center[0],
    lat: feature.center[1],
  };
}

export function useAddressAutocomplete() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const cache = useRef<Map<string, AddressSuggestion[]>>(new Map());

  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    if (cache.current.has(query)) {
      setSuggestions(cache.current.get(query)!);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&autocomplete=true&types=address&country=us&limit=5`;
        const res = await fetch(url);
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = await res.json();
        const parsed = (data.features ?? []).map(parse);
        cache.current.set(query, parsed);
        setSuggestions(parsed);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { query, setQuery, suggestions, loading };
}
```

- [ ] **Step 5: Run + commit**

Run: `npm test --workspace @propertyiq/frontend -- useAddressAutocomplete`
Expected: PASS.

```bash
git add packages/frontend/lib/analyzer
git commit -m "feat(frontend): useAddressAutocomplete hook"
```

---

### Task 15: Data-layer fetchers + `useMarketContext` + `useAnalyzer`

**Files:**

- Create: `packages/frontend/lib/data/fetchers/analyzer.ts`
- Modify: `packages/frontend/lib/data/index.ts` (export new fetchers)
- Create: `packages/frontend/lib/analyzer/useMarketContext.ts`
- Create: `packages/frontend/lib/analyzer/useAnalyzer.ts`

Per CLAUDE.md §5 — ALL frontend data fetching MUST go through `@/lib/data`. Add fetchers there first, then hooks consume them.

- [ ] **Step 1: Read existing fetcher pattern**

Run: `Read packages/frontend/lib/data/fetchers/<one_existing_fetcher>.ts`
Note: how `API_URL` is referenced, error handling, return types.

- [ ] **Step 2: Add fetchers**

```ts
// packages/frontend/lib/data/fetchers/analyzer.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface MarketContext {
  geo_level: "zip" | "county" | "metro" | "state" | null;
  geo_id: string | null;
  home_value: { value: number | null; source: string | null } | null;
  rent_index: { value: number | null; source: string | null } | null;
  market_heat: { value: number | null; source: string | null } | null;
  net_migration: { value: number | null; source: string | null } | null;
  piq_score: { value: number; label: string } | null;
}

export async function fetchMarketContext(params: {
  zip?: string;
  county_fips?: string;
  state?: string;
}): Promise<MarketContext | { quotaExceeded: true } | null> {
  const qs = new URLSearchParams();
  if (params.zip) qs.set("zip", params.zip);
  if (params.county_fips) qs.set("county_fips", params.county_fips);
  if (params.state) qs.set("state", params.state);
  const res = await fetch(`${API_URL}/api/analyzer/market-context?${qs}`, {
    credentials: "include",
  });
  if (res.status === 402) return { quotaExceeded: true };
  if (!res.ok) return null;
  return res.json();
}

export interface AiVerdictResult {
  verdict: "buy" | "negotiate" | "pass";
  target_price: number | null;
  strengths: string[];
  risks: string[];
  reasoning: string;
}

export async function* streamAiVerdict(payload: {
  input: unknown;
  result: unknown;
  marketContext?: unknown;
}): AsyncGenerator<string> {
  const res = await fetch(`${API_URL}/api/analyzer/ai-verdict`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) throw new Error(`ai-verdict failed: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        if (parsed.chunk) yield parsed.chunk;
        if (parsed.error) throw new Error(parsed.error);
      } catch (e) {
        if ((e as Error).message?.startsWith("error")) throw e;
      }
    }
  }
}

export interface SavedAnalysis {
  id: string;
  share_token: string;
  label: string | null;
  address_city: string;
  address_state: string;
  address_zip: string | null;
  input_snapshot: Record<string, unknown>;
  result_snapshot: Record<string, unknown>;
  market_context: Record<string, unknown> | null;
  ai_verdict: Record<string, unknown> | null;
  created_at: string;
}

export async function saveAnalysis(
  payload: Omit<SavedAnalysis, "id" | "share_token" | "created_at">,
): Promise<{ id: string; share_token: string }> {
  const res = await fetch(`${API_URL}/api/analyzer/save`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
  return res.json();
}

export async function fetchSavedAnalyses(): Promise<SavedAnalysis[]> {
  const res = await fetch(`${API_URL}/api/analyzer/saved`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSharedAnalysis(
  token: string,
): Promise<SavedAnalysis | null> {
  const res = await fetch(`${API_URL}/api/analyzer/share/${token}`);
  if (!res.ok) return null;
  return res.json();
}
```

- [ ] **Step 3: Export from data index**

In `packages/frontend/lib/data/index.ts`, add:

```ts
export * from "./fetchers/analyzer";
```

- [ ] **Step 4: `useMarketContext` hook**

```ts
// packages/frontend/lib/analyzer/useMarketContext.ts
import { useQuery } from "@tanstack/react-query";
import { fetchMarketContext, type MarketContext } from "@/lib/data";

export function useMarketContext(params: {
  zip?: string;
  county_fips?: string;
  state?: string;
}) {
  return useQuery<MarketContext | { quotaExceeded: true } | null>({
    queryKey: ["analyzer", "market-context", params],
    queryFn: () => fetchMarketContext(params),
    enabled: Boolean(params.zip || params.county_fips || params.state),
    staleTime: 1000 * 60 * 60 * 2, // 2h per CLAUDE.md
  });
}

export function isQuotaExceeded(v: unknown): v is { quotaExceeded: true } {
  return Boolean(
    v && typeof v === "object" && (v as any).quotaExceeded === true,
  );
}
```

- [ ] **Step 5: `useAnalyzer` orchestrator hook**

```ts
// packages/frontend/lib/analyzer/useAnalyzer.ts
import { useMemo, useState } from "react";
import {
  computeRentalMetrics,
  computeFlipMetrics,
  computeBrrrrScore,
} from "@propertyiq/analyzer-core";
import type { DealInput, FinancingTerms } from "@propertyiq/analyzer-core";

const DEFAULT_FINANCING: FinancingTerms = {
  downPaymentPct: 0.2,
  interestRatePct: 7.1,
  termYears: 30,
  closingCostsPct: 0.03,
};

export interface AnalyzerInputState extends DealInput {
  arv?: number;
  rehabBudget?: number;
}

export function useAnalyzer(initial?: Partial<AnalyzerInputState>) {
  const [input, setInput] = useState<AnalyzerInputState>({
    price: 0,
    rentMonthly: null,
    taxAnnual: null,
    insuranceAnnual: null,
    financing: DEFAULT_FINANCING,
    ...initial,
  });

  const rental = useMemo(() => computeRentalMetrics(input), [input]);
  const flip = useMemo(() => {
    if (!input.arv || !input.rehabBudget) return null;
    return computeFlipMetrics({
      price: input.price,
      arv: input.arv,
      rehabBudget: input.rehabBudget,
    });
  }, [input]);
  const brrrr = useMemo(() => {
    if (!input.arv || !input.rehabBudget) return null;
    return computeBrrrrScore({
      ...input,
      arv: input.arv,
      rehabBudget: input.rehabBudget,
    });
  }, [input]);

  const setField = <K extends keyof AnalyzerInputState>(
    key: K,
    value: AnalyzerInputState[K],
  ) => setInput((prev) => ({ ...prev, [key]: value }));

  const setFinancing = <K extends keyof FinancingTerms>(
    key: K,
    value: FinancingTerms[K],
  ) =>
    setInput((prev) => ({
      ...prev,
      financing: { ...prev.financing, [key]: value },
    }));

  return { input, setField, setFinancing, setInput, rental, flip, brrrr };
}
```

- [ ] **Step 6: Verify both hooks compile**

Run: `npm run typecheck --workspace @propertyiq/frontend`
Expected: clean.

- [ ] **Step 7: Add `@propertyiq/analyzer-core` to frontend deps**

In `packages/frontend/package.json` add to `dependencies`:

```json
"@propertyiq/analyzer-core": "*"
```

Run: `npm install`

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/lib packages/frontend/package.json package-lock.json
git commit -m "feat(frontend): analyzer data layer + hooks (useMarketContext, useAnalyzer)"
```

---

## Phase 5 — Frontend: `/analyzer` Page UI (Layout A)

> **Style note:** Use M3 / Tailwind conventions per CLAUDE.md §8. No hardcoded hex — use semantic CSS variables (`bg-primary`, `text-on-primary`, etc.). Roboto Mono for numbers.

### Task 16: Page scaffold + `AddressBar`

**Files:**

- Create: `packages/frontend/app/analyzer/page.tsx`
- Create: `packages/frontend/app/analyzer/components/AddressBar.tsx`
- Create: `packages/frontend/app/analyzer/AnalyzerClient.tsx`

- [ ] **Step 1: Server page (thin wrapper)**

```tsx
// packages/frontend/app/analyzer/page.tsx
import AnalyzerClient from "./AnalyzerClient";

export const metadata = {
  title: "Deal Analyzer | PropertyIQ",
  description:
    "Analyze any property: cap rate, cashflow, BRRRR, 70% rule, plus PropertyIQ market context.",
};

export default function AnalyzerPage({
  searchParams,
}: {
  searchParams: Promise<{
    address?: string;
    zip?: string;
    piq_market?: string;
  }>;
}) {
  return <AnalyzerClient searchParamsPromise={searchParams} />;
}
```

- [ ] **Step 2: `AddressBar` component**

```tsx
// packages/frontend/app/analyzer/components/AddressBar.tsx
"use client";

import { useAddressAutocomplete } from "@/lib/analyzer/useAddressAutocomplete";
import type { AddressSuggestion } from "@/lib/analyzer/types";
import { useState } from "react";

interface Props {
  initial?: string;
  onSelect: (s: AddressSuggestion) => void;
}

export default function AddressBar({ initial = "", onSelect }: Props) {
  const { query, setQuery, suggestions, loading } = useAddressAutocomplete();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <input
        type="text"
        value={query || initial}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="Search any US address…"
        className="w-full h-14 rounded-full bg-surface border border-outline px-6 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
        aria-label="Address search"
      />
      {loading && (
        <div className="absolute right-6 top-4 text-on-surface-variant text-sm">
          …
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-2 w-full bg-surface-container-low rounded-2xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(s);
                  setQuery(s.full);
                  setOpen(false);
                }}
                className="w-full text-left px-6 py-3 hover:bg-primary-container"
              >
                <div className="text-on-surface">{s.street}</div>
                <div className="text-on-surface-variant text-sm">
                  {s.city}, {s.state} {s.postalCode ?? ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Client page shell with two-column layout**

```tsx
// packages/frontend/app/analyzer/AnalyzerClient.tsx
"use client";

import { use, useState } from "react";
import AddressBar from "./components/AddressBar";
import { useAnalyzer } from "@/lib/analyzer/useAnalyzer";
import {
  useMarketContext,
  isQuotaExceeded,
} from "@/lib/analyzer/useMarketContext";
import type { AddressSuggestion } from "@/lib/analyzer/types";

export default function AnalyzerClient({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{
    address?: string;
    zip?: string;
    piq_market?: string;
  }>;
}) {
  const sp = use(searchParamsPromise);
  const [address, setAddress] = useState<AddressSuggestion | null>(null);
  const analyzer = useAnalyzer();
  const market = useMarketContext({
    zip: address?.postalCode ?? sp.zip,
    state: address?.state,
  });

  const quotaExceeded = isQuotaExceeded(market.data);

  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-light text-on-surface mb-2">
            Deal Analyzer
          </h1>
          <p className="text-on-surface-variant">
            Analyze any US property. Cap rate, cashflow, BRRRR — plus PropertyIQ
            market context.
          </p>
        </header>

        <div className="mb-6">
          <AddressBar onSelect={setAddress} />
        </div>

        {quotaExceeded ? (
          <div className="rounded-2xl bg-primary-container p-8 text-center">
            <h2 className="text-2xl text-on-primary-container mb-3">
              You've used your 3 free analyses.
            </h2>
            <p className="text-on-primary-container mb-6">
              Sign up free to keep going. Pro unlocks AI verdict, market
              context, save &amp; share.
            </p>
            <a
              href="/auth/sign-up"
              className="inline-block px-8 py-3 rounded-full bg-primary text-on-primary"
            >
              Sign up free
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[38%_1fr] gap-6">
            <aside className="rounded-2xl bg-surface-container-low p-5">
              {/* InputForm — Task 17 */}
              <p className="text-on-surface-variant">Input form goes here…</p>
            </aside>
            <section className="rounded-2xl bg-surface-container-low p-5">
              {/* Results — Task 18 */}
              <p className="text-on-surface-variant">
                Results panel goes here…
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add nav link**

Locate the primary nav component (likely `packages/frontend/app/components/Nav.tsx` or similar — grep `<nav` / `Header.tsx`). Add a link to `/analyzer` between the existing primary items.

- [ ] **Step 5: Render check**

Start the frontend (`npm run dev --workspace @propertyiq/frontend`). Open `http://localhost:3000/analyzer`. Type "123 Main", confirm dropdown appears with suggestions, click one, confirm market-context call fires in the network tab.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/analyzer
git commit -m "feat(frontend): /analyzer page scaffold + AddressBar"
```

---

### Task 17: `InputForm` (left rail)

**Files:**

- Create: `packages/frontend/app/analyzer/components/InputForm.tsx`
- Modify: `packages/frontend/app/analyzer/AnalyzerClient.tsx` (replace placeholder with `<InputForm />`)

- [ ] **Step 1: Implement `InputForm`**

```tsx
// packages/frontend/app/analyzer/components/InputForm.tsx
"use client";

import type { AnalyzerInputState } from "@/lib/analyzer/useAnalyzer";

interface FieldStatus {
  autoFilled?: boolean;
  unavailable?: boolean;
}

interface Props {
  input: AnalyzerInputState;
  fieldStatus: Partial<Record<keyof AnalyzerInputState, FieldStatus>>;
  setField: <K extends keyof AnalyzerInputState>(
    k: K,
    v: AnalyzerInputState[K],
  ) => void;
  setFinancing: (
    k: "downPaymentPct" | "interestRatePct" | "termYears",
    v: number,
  ) => void;
}

function NumField({
  label,
  value,
  onChange,
  status,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
  status?: FieldStatus;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm text-on-surface-variant mb-1 flex items-center gap-2">
        <span>{label}</span>
        {status?.autoFilled && (
          <span className="text-accent text-xs">✓ auto</span>
        )}
        {status?.unavailable && (
          <span className="text-error text-xs">— unavailable</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? 0 : Number(e.target.value))
          }
          placeholder={status?.unavailable ? "enter manually" : ""}
          className="w-full h-10 rounded-md bg-surface border border-outline px-3 font-mono text-on-surface"
        />
        {suffix && (
          <span className="text-on-surface-variant text-sm">{suffix}</span>
        )}
      </div>
    </label>
  );
}

export default function InputForm({
  input,
  fieldStatus,
  setField,
  setFinancing,
}: Props) {
  return (
    <div className="space-y-4">
      <h2 className="font-bold text-on-surface text-lg mb-3">Inputs</h2>

      <NumField
        label="Price"
        value={input.price}
        onChange={(v) => setField("price", v)}
        suffix="$"
        status={fieldStatus.price}
      />
      <NumField
        label="Rent / month"
        value={input.rentMonthly}
        onChange={(v) => setField("rentMonthly", v)}
        suffix="$"
        status={fieldStatus.rentMonthly}
      />
      <NumField
        label="Property tax / year"
        value={input.taxAnnual}
        onChange={(v) => setField("taxAnnual", v)}
        suffix="$"
        status={fieldStatus.taxAnnual}
      />
      <NumField
        label="Insurance / year"
        value={input.insuranceAnnual}
        onChange={(v) => setField("insuranceAnnual", v)}
        suffix="$"
        status={fieldStatus.insuranceAnnual}
      />
      <NumField
        label="HOA / month"
        value={input.hoaMonthly ?? 0}
        onChange={(v) => setField("hoaMonthly", v)}
        suffix="$"
      />

      <div className="border-t border-outline-variant pt-4 mt-4">
        <h3 className="text-sm uppercase text-on-surface-variant mb-3">
          Financing
        </h3>
        <NumField
          label="Down payment"
          value={Math.round((input.financing.downPaymentPct || 0) * 100)}
          onChange={(v) => setFinancing("downPaymentPct", v / 100)}
          suffix="%"
        />
        <NumField
          label="Interest rate"
          value={input.financing.interestRatePct}
          onChange={(v) => setFinancing("interestRatePct", v)}
          suffix="%"
        />
        <NumField
          label="Term"
          value={input.financing.termYears}
          onChange={(v) => setFinancing("termYears", v)}
          suffix="yr"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Hook market context → input auto-fill in `AnalyzerClient`**

Replace the input-form placeholder area:

```tsx
// In AnalyzerClient.tsx, useEffect after market-context resolves
import InputForm from "./components/InputForm";
import { useEffect, useState } from "react";

const [fieldStatus, setFieldStatus] = useState<any>({});

useEffect(() => {
  if (!market.data || isQuotaExceeded(market.data)) return;
  const ctx = market.data;
  const newStatus: any = {};
  if (ctx.rent_index?.value != null) {
    analyzer.setField("rentMonthly", ctx.rent_index.value);
    newStatus.rentMonthly = { autoFilled: true };
  } else newStatus.rentMonthly = { unavailable: true };
  if (ctx.home_value?.value != null && !analyzer.input.price) {
    analyzer.setField("price", ctx.home_value.value);
    newStatus.price = { autoFilled: true };
  }
  setFieldStatus(newStatus);
}, [market.data]);

// ...replace the <aside> placeholder:
<aside className="rounded-2xl bg-surface-container-low p-5">
  <InputForm
    input={analyzer.input}
    fieldStatus={fieldStatus}
    setField={analyzer.setField}
    setFinancing={analyzer.setFinancing}
  />
</aside>;
```

- [ ] **Step 3: Render check**

Visit `/analyzer`, select an address, confirm: rent auto-fills with `✓ auto` badge; price either auto-fills or stays empty; insurance shows "unavailable" (since the metric registry has no `insurance` metric — that's the expected graceful path).

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/analyzer
git commit -m "feat(frontend): InputForm with auto-fill + unavailable states"
```

---

### Task 18: Results panel (`HeroMetrics`, `StrategyTabs`, `MarketContextTile`)

**Files:**

- Create: `packages/frontend/app/analyzer/components/HeroMetrics.tsx`
- Create: `packages/frontend/app/analyzer/components/StrategyTabs.tsx`
- Create: `packages/frontend/app/analyzer/components/MarketContextTile.tsx`
- Modify: `packages/frontend/app/analyzer/AnalyzerClient.tsx`

- [ ] **Step 1: `HeroMetrics`**

```tsx
// packages/frontend/app/analyzer/components/HeroMetrics.tsx
"use client";

import { formatMetricValue } from "@/lib/data";

interface Props {
  capRatePct: number | null;
  cocPct: number | null;
  cashflowMonthly: number | null;
  dscr: number | null;
}

function metricColor(v: number | null, positiveIsGood = true): string {
  if (v == null) return "bg-surface-container-high text-on-surface-variant";
  const good = positiveIsGood ? v > 0 : v < 0;
  return good ? "bg-accent text-on-accent" : "bg-error text-on-error";
}

function Tile({
  label,
  value,
  format,
  color,
}: {
  label: string;
  value: number | null;
  format: "percent" | "currency" | "number";
  color: string;
}) {
  return (
    <div className={`flex-1 rounded-xl p-4 text-center ${color}`}>
      <div className="text-xs opacity-85 uppercase">{label}</div>
      <div className="font-mono text-3xl font-bold mt-1">
        {value == null ? "—" : formatMetricValue(value, format)}
      </div>
    </div>
  );
}

export default function HeroMetrics({
  capRatePct,
  cocPct,
  cashflowMonthly,
  dscr,
}: Props) {
  return (
    <div className="flex gap-3">
      <Tile
        label="Cap rate"
        value={capRatePct}
        format="percent"
        color={metricColor(capRatePct)}
      />
      <Tile
        label="Cash-on-cash"
        value={cocPct}
        format="percent"
        color={metricColor(cocPct)}
      />
      <Tile
        label="Cashflow / mo"
        value={cashflowMonthly}
        format="currency"
        color={metricColor(cashflowMonthly)}
      />
      <Tile
        label="DSCR"
        value={dscr}
        format="number"
        color={
          dscr != null && dscr >= 1.2
            ? "bg-accent text-on-accent"
            : "bg-surface-container-high text-on-surface"
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: `StrategyTabs`**

```tsx
// packages/frontend/app/analyzer/components/StrategyTabs.tsx
"use client";

import { useState } from "react";
import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";
import { formatMetricValue } from "@/lib/data";

interface Props {
  rental: RentalResult;
  flip: FlipResult | null;
  brrrr: BrrrrResult | null;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-on-surface-variant">{k}</span>
      <span className="font-mono text-on-surface">{v}</span>
    </div>
  );
}

export default function StrategyTabs({ rental, flip, brrrr }: Props) {
  const [tab, setTab] = useState<"rental" | "flip" | "brrrr">("rental");

  return (
    <div className="rounded-xl bg-surface-container-high p-4">
      <div className="flex gap-2 mb-3">
        {(["rental", "flip", "brrrr"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1 rounded-full text-sm font-medium ${tab === t ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant border border-outline"}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "rental" && (
        <>
          <Row
            k="1% rule"
            v={
              rental.onePctRulePct == null
                ? "—"
                : `${rental.onePctRulePct.toFixed(2)}%`
            }
          />
          <Row
            k="NOI / yr"
            v={
              rental.noiAnnual == null
                ? "—"
                : formatMetricValue(rental.noiAnnual, "currency")
            }
          />
          <Row
            k="Monthly debt service"
            v={formatMetricValue(rental.monthlyDebtService, "currency")}
          />
          <Row
            k="Total cash in"
            v={formatMetricValue(rental.totalCashInvested, "currency")}
          />
        </>
      )}
      {tab === "flip" &&
        (flip ? (
          <>
            <Row
              k="70% rule MAO"
              v={formatMetricValue(flip.mao70, "currency")}
            />
            <Row
              k="Wholetail max"
              v={formatMetricValue(flip.wholetailMax, "currency")}
            />
            <Row
              k="Projected profit"
              v={formatMetricValue(flip.projectedProfit, "currency")}
            />
            <Row k="ROI" v={`${flip.projectedRoiPct.toFixed(1)}%`} />
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Enter ARV + rehab budget below to see flip metrics.
          </p>
        ))}
      {tab === "brrrr" &&
        (brrrr ? (
          <>
            <Row
              k="BRRRR score"
              v={`${brrrr.score.toFixed(1)} / 10  ${brrrr.rating}`}
            />
            <Row
              k="Refinance cash-out"
              v={formatMetricValue(brrrr.refinanceCashOut, "currency")}
            />
            <Row
              k="Cash left in deal"
              v={formatMetricValue(brrrr.remainingCashInDeal, "currency")}
            />
            <Row
              k="Post-refi cashflow/mo"
              v={formatMetricValue(brrrr.postRefiCashflowMonthly, "currency")}
            />
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Enter ARV + rehab budget to see BRRRR analysis.
          </p>
        ))}
    </div>
  );
}
```

- [ ] **Step 3: `MarketContextTile`**

```tsx
// packages/frontend/app/analyzer/components/MarketContextTile.tsx
"use client";

import type { MarketContext } from "@/lib/data";
import { usePaywall } from "@/lib/entitlements";

interface Props {
  context: MarketContext | null;
  locked: boolean;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="opacity-70 text-xs uppercase">{label}</div>
      <div className="font-mono text-lg font-bold">{value}</div>
    </div>
  );
}

export default function MarketContextTile({ context, locked }: Props) {
  if (locked) {
    return (
      <div className="rounded-xl p-5 bg-gradient-to-br from-primary-dark to-primary text-on-primary relative">
        <div className="absolute inset-0 backdrop-blur-sm bg-on-primary/10 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="mb-2">🔒 PropertyIQ Market Context</div>
            <a
              href="/pricing"
              className="px-4 py-2 rounded-full bg-on-primary text-primary text-sm"
            >
              Upgrade to see this market
            </a>
          </div>
        </div>
        <div className="opacity-40">
          <div className="text-xs mb-2">PropertyIQ Market Context</div>
          <div className="grid grid-cols-4 gap-4">
            <Stat label="PIQ" value="—" />
            <Stat label="Heat" value="—" />
            <Stat label="Rent 1Y" value="—" />
            <Stat label="Net mig." value="—" />
          </div>
        </div>
      </div>
    );
  }

  if (!context) return null;

  return (
    <div className="rounded-xl p-5 bg-gradient-to-br from-primary-dark to-primary text-on-primary">
      <div className="text-xs opacity-85 mb-3">
        📍 PropertyIQ Market Context · {context.geo_id}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {context.piq_score && (
          <Stat
            label="PIQ Score"
            value={`${context.piq_score.value} ${context.piq_score.label}`}
          />
        )}
        {context.market_heat?.value != null && (
          <Stat
            label="Heat"
            value={`${context.market_heat.value >= 0 ? "+" : ""}${context.market_heat.value.toFixed(1)}%`}
          />
        )}
        {context.rent_index?.value != null && (
          <Stat
            label="Rent"
            value={`$${Math.round(context.rent_index.value)}/mo`}
          />
        )}
        {context.net_migration?.value != null && (
          <Stat
            label="Net mig."
            value={`${context.net_migration.value > 0 ? "+" : ""}${Math.round(context.net_migration.value / 1000)}K`}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into `AnalyzerClient`**

Replace the results-panel placeholder with:

```tsx
import HeroMetrics from "./components/HeroMetrics";
import StrategyTabs from "./components/StrategyTabs";
import MarketContextTile from "./components/MarketContextTile";
import { useEntitlements } from "@/lib/entitlements";

// inside the component
const { isPro } = useEntitlements();

// ...replace <section> placeholder:
<section className="space-y-3">
  <HeroMetrics
    capRatePct={analyzer.rental.capRatePct}
    cocPct={analyzer.rental.cashOnCashPct}
    cashflowMonthly={analyzer.rental.cashflowMonthly}
    dscr={analyzer.rental.dscr}
  />
  <StrategyTabs
    rental={analyzer.rental}
    flip={analyzer.flip}
    brrrr={analyzer.brrrr}
  />
  <MarketContextTile
    context={market.data && !isQuotaExceeded(market.data) ? market.data : null}
    locked={!isPro}
  />
</section>;
```

- [ ] **Step 5: Render check**

Visit `/analyzer`, pick an address. Confirm: hero tiles update as inputs change, strategy tabs switch correctly, market context tile renders locked overlay for anonymous / free users, full content for Pro.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/analyzer
git commit -m "feat(frontend): HeroMetrics, StrategyTabs, MarketContextTile with locked Pro overlay"
```

---

### Task 19: AI verdict modal + Save / Share actions

**Files:**

- Create: `packages/frontend/app/analyzer/components/AIVerdictModal.tsx`
- Create: `packages/frontend/app/analyzer/components/ActionsRow.tsx`
- Modify: `packages/frontend/app/analyzer/AnalyzerClient.tsx`

- [ ] **Step 1: `AIVerdictModal` (streaming)**

```tsx
// packages/frontend/app/analyzer/components/AIVerdictModal.tsx
"use client";

import { useEffect, useState } from "react";
import { streamAiVerdict, type AiVerdictResult } from "@/lib/data";

interface Props {
  input: unknown;
  result: unknown;
  marketContext?: unknown;
  onClose: () => void;
  onComplete?: (v: AiVerdictResult) => void;
}

export default function AIVerdictModal({
  input,
  result,
  marketContext,
  onClose,
  onComplete,
}: Props) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<AiVerdictResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let acc = "";
        for await (const chunk of streamAiVerdict({
          input,
          result,
          marketContext,
        })) {
          if (cancelled) return;
          acc += chunk;
          setText(acc);
        }
        const v: AiVerdictResult = JSON.parse(acc);
        if (!cancelled) {
          setParsed(v);
          onComplete?.(v);
        }
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-scrim flex items-center justify-center p-4 z-50"
    >
      <div className="bg-surface rounded-[28px] p-8 max-w-xl w-full shadow-lg">
        <h2 className="text-2xl font-light text-on-surface mb-4">
          AI Deal Verdict
        </h2>
        {err && <p className="text-error">{err}</p>}
        {parsed ? (
          <>
            <div
              className={`inline-block px-4 py-1 rounded-full text-sm font-medium mb-4 ${parsed.verdict === "buy" ? "bg-accent text-on-accent" : parsed.verdict === "pass" ? "bg-error text-on-error" : "bg-warning text-on-warning"}`}
            >
              {parsed.verdict.toUpperCase()}
            </div>
            {parsed.target_price && (
              <p className="text-on-surface mb-3">
                Target offer:{" "}
                <strong>${parsed.target_price.toLocaleString()}</strong>
              </p>
            )}
            <p className="text-on-surface mb-4">{parsed.reasoning}</p>
            <h3 className="text-sm font-bold text-accent">Strengths</h3>
            <ul className="list-disc list-inside text-on-surface mb-3">
              {parsed.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <h3 className="text-sm font-bold text-error">Risks</h3>
            <ul className="list-disc list-inside text-on-surface">
              {parsed.risks.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="font-mono text-sm text-on-surface-variant whitespace-pre-wrap">
            {text || "Streaming…"}
          </p>
        )}
        <button
          onClick={onClose}
          className="mt-6 px-6 py-2 rounded-full bg-primary text-on-primary"
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `ActionsRow`**

```tsx
// packages/frontend/app/analyzer/components/ActionsRow.tsx
"use client";

import { useState } from "react";
import { saveAnalysis } from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";

interface Props {
  isPro: boolean;
  payload: () => Parameters<typeof saveAnalysis>[0];
  onVerdictClick: () => void;
  onSaved: (r: { id: string; share_token: string }) => void;
}

export default function ActionsRow({
  isPro,
  payload,
  onVerdictClick,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await saveAnalysis(payload());
      onSaved(r);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-3">
      <button
        type="button"
        disabled={!isPro}
        onClick={isPro ? onVerdictClick : () => location.assign("/pricing")}
        className="flex-1 h-12 rounded-full bg-primary text-on-primary disabled:opacity-40"
      >
        {isPro ? "AI Verdict" : "🔒 AI Verdict (Pro)"}
      </button>
      <button
        type="button"
        disabled={!isPro || saving}
        onClick={isPro ? handleSave : () => location.assign("/pricing")}
        className="px-8 h-12 rounded-full bg-surface border border-outline text-on-surface disabled:opacity-40"
      >
        {isPro ? (saving ? "Saving…" : "Save") : "🔒 Save"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `AnalyzerClient`**

Add to the component:

```tsx
import AIVerdictModal from "./components/AIVerdictModal";
import ActionsRow from "./components/ActionsRow";
const [verdictOpen, setVerdictOpen] = useState(false);
const [savedToast, setSavedToast] = useState<string | null>(null);

// ...inside <section>:
<ActionsRow
  isPro={isPro}
  payload={() => ({
    label: address?.full ?? null,
    address_full: address?.full ?? null,
    address_city: address?.city ?? "",
    address_state: address?.state ?? "",
    address_zip: address?.postalCode ?? null,
    lat: address?.lat ?? null,
    lon: address?.lon ?? null,
    input_snapshot: analyzer.input as any,
    result_snapshot: {
      rental: analyzer.rental,
      flip: analyzer.flip,
      brrrr: analyzer.brrrr,
    } as any,
    market_context:
      market.data && !isQuotaExceeded(market.data)
        ? (market.data as any)
        : null,
    ai_verdict: null,
  })}
  onVerdictClick={() => setVerdictOpen(true)}
  onSaved={(r) =>
    setSavedToast(`Saved — share at /shared/analysis/${r.share_token}`)
  }
/>;
{
  verdictOpen && (
    <AIVerdictModal
      input={analyzer.input}
      result={{
        rental: analyzer.rental,
        flip: analyzer.flip,
        brrrr: analyzer.brrrr,
      }}
      marketContext={
        market.data && !isQuotaExceeded(market.data) ? market.data : undefined
      }
      onClose={() => setVerdictOpen(false)}
    />
  );
}
{
  savedToast && (
    <div className="fixed bottom-6 right-6 bg-primary text-on-primary px-5 py-3 rounded-2xl shadow-lg">
      {savedToast}
    </div>
  );
}
```

The exact "auth check" hook to use depends on the existing `lib/entitlements` exports. Use whatever the existing `PaywallProvider` / `EntitlementsContext` surface for "is the user signed in" — likely `useEntitlements().userId != null` or similar.

- [ ] **Step 4: Render check**

Visit `/analyzer` while signed in as Pro. Click "AI Verdict" — modal opens, text streams in, then renders structured verdict. Click "Save" — toast appears with share URL.

While signed out: both buttons show 🔒 and link to `/pricing` on click.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/analyzer
git commit -m "feat(frontend): AI verdict modal + save/share actions"
```

---

### Task 20: Responsive collapse (< 900px)

**Files:**

- Modify: `packages/frontend/app/analyzer/AnalyzerClient.tsx`

- [ ] **Step 1: Convert the two-column grid to responsive**

In the grid container in `AnalyzerClient.tsx`:

```tsx
<div className="grid grid-cols-1 md:grid-cols-[38%_1fr] gap-6">
```

Wrap the `<aside>` in a collapsible details element for mobile:

```tsx
<details className="md:hidden rounded-2xl bg-surface-container-low p-4" open>
  <summary className="cursor-pointer font-medium text-on-surface">Inputs</summary>
  <div className="mt-3"><InputForm input={analyzer.input} fieldStatus={fieldStatus} setField={analyzer.setField} setFinancing={analyzer.setFinancing} /></div>
</details>
<aside className="hidden md:block rounded-2xl bg-surface-container-low p-5">
  <InputForm input={analyzer.input} fieldStatus={fieldStatus} setField={analyzer.setField} setFinancing={analyzer.setFinancing} />
</aside>
```

- [ ] **Step 2: Render check on mobile viewport**

Chrome DevTools → toggle device toolbar → iPhone preset. Confirm inputs collapse into accordion above results.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/analyzer/AnalyzerClient.tsx
git commit -m "feat(frontend): /analyzer responsive collapse below 900px"
```

---

## Phase 6 — Integration Points

### Task 21: Market detail page CTA

**Files:**

- Modify: `packages/frontend/app/markets/[slug]/page.tsx` (and the county/zip equivalents — there are 3 market detail pages per the file glob)

- [ ] **Step 1: Locate the appropriate CTA insertion point**

Run: `Read packages/frontend/app/markets/[slug]/page.tsx` — find the section near the top hero / above the metrics grid where a "primary CTA" would land. Inspect the existing components for a pattern (button, card).

- [ ] **Step 2: Add CTA component**

Create `packages/frontend/app/markets/components/AnalyzeCTA.tsx`:

```tsx
// packages/frontend/app/markets/components/AnalyzeCTA.tsx
import Link from "next/link";

interface Props {
  geoLevel: "state" | "metro" | "county" | "zip";
  geoId: string;
  geoName: string;
}

export default function AnalyzeCTA({ geoLevel, geoId, geoName }: Props) {
  return (
    <Link
      href={`/analyzer?piq_market=${encodeURIComponent(geoLevel + ":" + geoId)}`}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary shadow-sm hover:shadow-md transition"
    >
      Analyze a property in {geoName} →
    </Link>
  );
}
```

- [ ] **Step 3: Insert in all three market pages**

In each of:

- `packages/frontend/app/markets/[slug]/page.tsx` (metro)
- `packages/frontend/app/markets/county/[slug]/page.tsx`
- `packages/frontend/app/markets/zip/[slug]/page.tsx`

Add the CTA near the hero (exact placement at engineer's discretion based on existing layout):

```tsx
import AnalyzeCTA from "../../components/AnalyzeCTA"; // adjust path

// ...near the top of the page content:
<AnalyzeCTA geoLevel="metro" geoId={metroCbsa} geoName={marketName} />;
```

- [ ] **Step 4: Update `/analyzer` to honor `?piq_market=`**

In `AnalyzerClient.tsx`, after `use(searchParamsPromise)`, parse the param:

```tsx
useEffect(() => {
  if (!sp.piq_market) return;
  const [level, id] = sp.piq_market.split(":");
  // Trigger market context with these params before address is selected
  // (Frontend's useMarketContext will fetch & populate field-status as in Task 17)
  // No state change needed if useMarketContext picks up the params; otherwise
  // set initial address state with whatever info we have:
  if (level === "zip") {
    // Synthesize a partial AddressSuggestion so downstream hooks behave consistently
    setAddress({
      id: "piq-" + id,
      full: `ZIP ${id}`,
      street: "",
      city: "",
      state: "",
      postalCode: id,
      lat: 0,
      lon: 0,
    });
  }
  // metro / county similar — best effort; user can refine via the address bar.
}, [sp.piq_market]);
```

- [ ] **Step 5: Render check**

Visit a metro page (e.g., `/markets/austin-tx-metro`). Click the CTA — confirm `/analyzer?piq_market=metro:12420` opens with market context pre-fetched.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/markets packages/frontend/app/analyzer
git commit -m "feat(frontend): market detail Analyze CTA + /analyzer piq_market query param"
```

---

### Task 22: `/shared/analysis/[token]` public page

**Files:**

- Create: `packages/frontend/app/shared/analysis/[token]/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
// packages/frontend/app/shared/analysis/[token]/page.tsx
import { fetchSharedAnalysis } from "@/lib/data";
import { notFound } from "next/navigation";
import HeroMetrics from "@/app/analyzer/components/HeroMetrics";
import StrategyTabs from "@/app/analyzer/components/StrategyTabs";
import MarketContextTile from "@/app/analyzer/components/MarketContextTile";

export const dynamic = "force-dynamic";

export default async function SharedAnalysisPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await fetchSharedAnalysis(token);
  if (!row) notFound();

  const result = row.result_snapshot as any;
  const rental = result.rental ?? {};
  const flip = result.flip ?? null;
  const brrrr = result.brrrr ?? null;

  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-8">
          <p className="text-sm text-on-surface-variant uppercase tracking-wide">
            PropertyIQ · Shared analysis
          </p>
          <h1 className="text-3xl font-light text-on-surface mt-2">
            {row.label || `${row.address_city}, ${row.address_state}`}
          </h1>
        </header>

        <div className="space-y-4">
          <HeroMetrics
            capRatePct={rental.capRatePct}
            cocPct={rental.cashOnCashPct}
            cashflowMonthly={rental.cashflowMonthly}
            dscr={rental.dscr}
          />
          <StrategyTabs rental={rental} flip={flip} brrrr={brrrr} />
          {row.market_context && (
            <MarketContextTile
              context={row.market_context as any}
              locked={false}
            />
          )}
        </div>

        <footer className="mt-12 pt-6 border-t border-outline-variant text-center">
          <a
            href="/analyzer"
            className="inline-block px-6 py-3 rounded-full bg-primary text-on-primary"
          >
            Analyze a property of your own →
          </a>
        </footer>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Render check**

Save an analysis (Task 19 toast gives you a share URL). Open it in an incognito window. Confirm: page renders without auth, no owner-id visible in network response, no "Save" / "AI Verdict" buttons.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/shared
git commit -m "feat(frontend): public /shared/analysis/[token] page"
```

---

### Task 23: `/analyzer/saved/[id]` page

**Files:**

- Create: `packages/frontend/app/analyzer/saved/[id]/page.tsx`
- Create: `packages/frontend/app/analyzer/saved/[id]/SavedClient.tsx`
- Create: `packages/frontend/lib/data/fetchers/analyzer.ts` — add `fetchSavedAnalysis(id)` (single)

- [ ] **Step 1: Add single-fetch fetcher**

In `packages/frontend/lib/data/fetchers/analyzer.ts`, append:

```ts
export async function fetchSavedAnalysis(
  id: string,
): Promise<SavedAnalysis | null> {
  const res = await fetch(`${API_URL}/api/analyzer/saved/${id}`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}
```

- [ ] **Step 2: Page wrapper**

```tsx
// packages/frontend/app/analyzer/saved/[id]/page.tsx
import SavedClient from "./SavedClient";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SavedClient id={id} />;
}
```

- [ ] **Step 3: Client component**

```tsx
// packages/frontend/app/analyzer/saved/[id]/SavedClient.tsx
"use client";

import { useEffect, useState } from "react";
import { fetchSavedAnalysis, type SavedAnalysis } from "@/lib/data";
import HeroMetrics from "../../components/HeroMetrics";
import StrategyTabs from "../../components/StrategyTabs";
import MarketContextTile from "../../components/MarketContextTile";

export default function SavedClient({ id }: { id: string }) {
  const [row, setRow] = useState<SavedAnalysis | null | "loading">("loading");
  useEffect(() => {
    fetchSavedAnalysis(id).then(setRow);
  }, [id]);

  if (row === "loading")
    return (
      <div className="p-12 text-center text-on-surface-variant">Loading…</div>
    );
  if (!row)
    return (
      <div className="p-12 text-center text-on-surface-variant">Not found.</div>
    );

  const r = row.result_snapshot as any;
  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-light text-on-surface mb-2">
          {row.label || `${row.address_city}, ${row.address_state}`}
        </h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Saved {new Date(row.created_at).toLocaleDateString()}
        </p>
        <div className="space-y-4">
          <HeroMetrics
            capRatePct={r.rental?.capRatePct}
            cocPct={r.rental?.cashOnCashPct}
            cashflowMonthly={r.rental?.cashflowMonthly}
            dscr={r.rental?.dscr}
          />
          <StrategyTabs rental={r.rental} flip={r.flip} brrrr={r.brrrr} />
          {row.market_context && (
            <MarketContextTile
              context={row.market_context as any}
              locked={false}
            />
          )}
        </div>
        <div className="mt-8 text-center">
          <a
            href={`/shared/analysis/${row.share_token}`}
            className="text-primary hover:underline"
          >
            Share this analysis →
          </a>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend
git commit -m "feat(frontend): /analyzer/saved/[id] page for Pro users"
```

---

## Phase 7 — End-to-End & Validation

### Task 24: Playwright E2E suite

**Files:**

- Create: `packages/frontend/e2e/analyzer.spec.ts`

Check whether the frontend already has a Playwright config (`packages/frontend/playwright.config.ts`). If not, the engineer should consult an existing E2E example in the repo to mirror the setup.

- [ ] **Step 1: Write the E2E**

```ts
// packages/frontend/e2e/analyzer.spec.ts
import { test, expect } from "@playwright/test";

test.describe("/analyzer", () => {
  test("happy path — autocomplete → results render → market tile visible to Pro", async ({
    page,
  }) => {
    // Assumes a Pro test user is logged in via storageState configured in playwright.config
    await page.goto("/analyzer");
    await page
      .getByRole("textbox", { name: /Address search/i })
      .fill("123 Main St Austin");
    await page
      .getByText(/Austin, TX/)
      .first()
      .click();

    // Hero tiles must render
    await expect(page.getByText("Cap rate")).toBeVisible();
    await expect(page.getByText("Cash-on-cash")).toBeVisible();
    await expect(page.getByText("Cashflow / mo")).toBeVisible();

    // Strategy tabs
    await page.getByRole("button", { name: "FLIP" }).click();
    await expect(page.getByText(/70% rule MAO/)).toBeVisible();

    // Market context tile present (Pro)
    await expect(page.getByText(/PropertyIQ Market Context/)).toBeVisible();
  });

  test("graceful: insurance field renders unavailable, rest works", async ({
    page,
  }) => {
    await page.goto("/analyzer");
    await page
      .getByRole("textbox", { name: /Address search/i })
      .fill("1 Microsoft Way Redmond");
    await page
      .getByText(/Redmond, WA/)
      .first()
      .click();
    await expect(page.getByText(/unavailable/i)).toBeVisible();
    // user types insurance → app continues
    const insField = page.locator('label:has-text("Insurance / year") input');
    await insField.fill("1500");
    await expect(page.getByText("Cap rate")).toBeVisible();
  });

  test("anonymous quota wall after 3 analyses", async ({ browser }) => {
    const ctx = await browser.newContext(); // fresh — no logged-in storage state
    const page = await ctx.newPage();
    for (let i = 0; i < 3; i++) {
      await page.goto("/analyzer");
      await page.getByRole("textbox").fill(`${i + 100} Main St Austin`);
      await page
        .getByText(/Austin, TX/)
        .first()
        .click();
      await page.waitForTimeout(500);
    }
    await page.goto("/analyzer");
    await page.getByRole("textbox").fill("400 Congress Ave Austin");
    await page
      .getByText(/Austin, TX/)
      .first()
      .click();
    await expect(page.getByText(/used your 3 free/i)).toBeVisible();
    await ctx.close();
  });

  test("save → share URL is publicly visible without auth", async ({
    page,
    browser,
  }) => {
    await page.goto("/analyzer");
    await page.getByRole("textbox").fill("123 Main St Austin");
    await page
      .getByText(/Austin, TX/)
      .first()
      .click();
    await page.getByRole("button", { name: /^Save$/ }).click();
    const toast = await page.getByText(/Saved — share at/);
    await expect(toast).toBeVisible();
    const link = await toast.textContent();
    const url = link!.match(/\/shared\/analysis\/[A-Za-z0-9_-]+/)![0];

    // Open in anonymous context
    const anonCtx = await browser.newContext();
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(url);
    await expect(anonPage.getByText(/Shared analysis/)).toBeVisible();
    await expect(anonPage.getByRole("button", { name: /Save/ })).toHaveCount(0);
    await anonCtx.close();
  });
});
```

- [ ] **Step 2: Run**

Run: `npx playwright test e2e/analyzer.spec.ts --workspace @propertyiq/frontend` (or your team's E2E command).
Expected: all 4 PASS. Where the test relies on a Pro JWT / storageState, set up the fixture file per the team's existing pattern.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/e2e/analyzer.spec.ts
git commit -m "test(frontend): Playwright E2E for /analyzer"
```

---

### Task 25: Background validation agents + final render check

**Files:** N/A (validation only)

Per CLAUDE.md §1.6, dispatch background validation agents and run a manual render check.

- [ ] **Step 1: Dispatch agents in parallel**

In one assistant message, send four parallel `Agent` tool calls in the background:

- `subagent_type: code-reviewer` — review all files modified across this plan.
- `subagent_type: data-layer-reviewer` — verify all frontend fetches go through `@/lib/data` per CLAUDE.md §5.
- `subagent_type: dto-validation-auditor` — confirm `class-validator` on every new controller DTO.
- `subagent_type: security-reviewer` — focus on RLS policy, cookie middleware, share token, ANTHROPIC_API_KEY usage.
- `subagent_type: file-size-compliance` — confirm no file exceeds CLAUDE.md §1.3 hard limits.

For each: only surface CRITICAL/WARNING findings. Fix any reported.

- [ ] **Step 2: Manual render check** (per `[[feedback_server-health-checks]]`)

Open in a real browser, NOT just curl:

- `/analyzer` anonymous → use 3x, get blocked
- `/analyzer` signed in as Pro → full flow, AI verdict, save, share
- `/shared/analysis/<token>` in incognito → renders read-only
- `/analyzer/saved/<id>` → renders Pro view
- A market detail page → "Analyze a property in this market" CTA links correctly
- Mobile viewport (375×812) → responsive collapse works

- [ ] **Step 3: Verify all 14 acceptance criteria from the spec**

Walk through `docs/superpowers/specs/2026-05-14-deal-analyzer-design.md` §14. Confirm each box can be checked.

- [ ] **Step 4: Final summary commit (if any agent fixes landed)**

```bash
git add .
git commit -m "chore(analyzer): post-validation fixes from background agents"
```

---

## Phase Summary

| Phase | Tasks | Outcome                                     |
| ----- | ----- | ------------------------------------------- |
| 0     | 1     | analyzer-core workspace package scaffolded  |
| 1     | 2-5   | All deal math implemented + property-tested |
| 2     | 6-7   | MCP refactored, golden parity verified      |
| 3     | 8-13  | Backend module, endpoints, DB, e2e          |
| 4     | 14-15 | Frontend data layer & hooks                 |
| 5     | 16-20 | `/analyzer` UI complete                     |
| 6     | 21-23 | Market CTA + saved + shared pages           |
| 7     | 24-25 | E2E + validation gates passed               |

**Total:** 25 tasks. Each yields a self-contained commit. Phase boundaries are natural review checkpoints.
