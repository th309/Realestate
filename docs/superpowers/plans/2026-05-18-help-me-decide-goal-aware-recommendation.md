# Help Me Decide — Goal-Aware Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-goal investor profile picker (Cash flow / Long-term wealth / Fast cash / Recycle capital) to the existing compare mode of `/analyzer`. The picked goal drives a goal-aware scoring function that overrides `pickBestPlay()` and reframes the AI recommendation narrative.

**Architecture:** New pure-function library (`goal-scoring.ts`) computes per-goal scores for all three strategies; new chip-row component (`GoalPicker.tsx`) lives inside `StrategyCompare`; `AnalyzerClient` owns selected-goal state with localStorage persistence and threads it to both `pickBestPlayForGoal()` and `useSectionAiInsights()`. Backend gets a small optional `goal` field on the AI payload + a short goal-aware block in the recommendation prompt + goal in the cache key.

**Tech Stack:** TypeScript, React, vitest, NestJS, class-validator, Tailwind, React Query, Redis (existing).

**Spec:** `docs/superpowers/specs/2026-05-18-help-me-decide-goal-aware-recommendation-design.md`

---

## File Structure

**New files (frontend):**

- `packages/frontend/app/analyzer/lib/goal-types.ts` — `InvestorGoal` union + `GOAL_LABEL` + `GOAL_DESCRIPTION` maps
- `packages/frontend/app/analyzer/lib/goal-scoring.ts` — pure scoring fns, `pickBestPlayForGoal`, `inferDefaultGoal`
- `packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts` — unit tests for all scoring fns
- `packages/frontend/app/analyzer/components/StrategyCompare/GoalPicker.tsx` — chip-row UI
- `packages/frontend/app/analyzer/components/StrategyCompare/__tests__/GoalPicker.test.tsx` — component tests

**Modified files (frontend):**

- `packages/frontend/app/analyzer/AnalyzerClient.tsx` — `selectedGoal` state + localStorage, replace `computeBestPlay` call with goal-aware version, thread `goal` to `useSectionAiInsights`
- `packages/frontend/app/analyzer/components/StrategyCompare/StrategyCompare.tsx` — render `<GoalPicker>` above the existing winner block
- `packages/frontend/app/analyzer/components/cards/BestPlayCallout.tsx` — optional `goal` prop for tagline copy
- `packages/frontend/app/analyzer/lib/use-section-ai-insights.ts` — accept + forward `goal`; include in discriminator
- `packages/frontend/lib/data/fetchers/ai-insights.ts` — add optional `goal` field on `AiInsightPayload`

**Modified files (backend):**

- `packages/backend/src/analyzer/dto/ai-insights.dto.ts` — optional `goal` enum on inner payload
- `packages/backend/src/analyzer/ai-insights.service.ts` — render GOAL block in `assemblePrompt` when present
- `packages/backend/src/analyzer/prompts/section-prompts.ts` — append goal-aware paragraph to `recommendation_analysis`
- `packages/backend/src/analyzer/ai-insights.cache.ts` — embed `goal` in cache key, bump `PROMPT_REVISION` v4 → v5

---

## Task 1: Goal types + labels

**Files:**

- Create: `packages/frontend/app/analyzer/lib/goal-types.ts`

This is type-only — no tests needed. Other tasks depend on these imports.

- [ ] **Step 1: Create the types file**

```typescript
// packages/frontend/app/analyzer/lib/goal-types.ts

/**
 * The 4 investor goals the "Help me decide" recommender ranks strategies
 * against. Each goal is paired with a scoring function in goal-scoring.ts
 * that translates strategy results into a numeric fit score for THIS goal.
 *
 * Wire-stable identifiers — also sent to the backend as the `goal` field on
 * the AI-insights payload, so renames here require a corresponding DTO + AI
 * cache PROMPT_REVISION bump.
 */
export type InvestorGoal =
  | "cash_flow"
  | "long_term_wealth"
  | "fast_cash"
  | "recycle_capital";

export const GOAL_LABEL: Record<InvestorGoal, string> = {
  cash_flow: "Cash flow",
  long_term_wealth: "Long-term wealth",
  fast_cash: "Fast cash",
  recycle_capital: "Recycle capital",
};

/** One-sentence descriptions for the chip tooltip. Keep tight — these are
 *  surfaced on hover, not in body copy. */
export const GOAL_DESCRIPTION: Record<InvestorGoal, string> = {
  cash_flow: "Maximize monthly recurring income from this deal.",
  long_term_wealth:
    "Maximize total equity 30 years out (compounding + appreciation).",
  fast_cash: "Maximize lump-sum cash within 12 months.",
  recycle_capital:
    "Minimize trapped capital so you can buy the next deal sooner.",
};

export const ALL_GOALS: InvestorGoal[] = [
  "cash_flow",
  "long_term_wealth",
  "fast_cash",
  "recycle_capital",
];
```

- [ ] **Step 2: Verify typecheck**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: PASS (or only pre-existing errors unrelated to this file)

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/analyzer/lib/goal-types.ts
git commit -m "feat(analyzer): InvestorGoal types + label maps for Help Me Decide"
```

---

## Task 2: Cash-flow scoring function (TDD)

**Files:**

- Create: `packages/frontend/app/analyzer/lib/goal-scoring.ts`
- Create: `packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts
import { describe, expect, it } from "vitest";
import type {
  BrrrrResult,
  FlipResult,
  RentalResult,
} from "@propertyiq/analyzer-core";
import { scoreForGoal } from "../goal-scoring";

/** Minimal fixture builder — only the fields scoring functions actually read. */
function makeFixtures(over: {
  rentalCashflowMonthly?: number;
  flipProfit?: number;
  flipHoldMonths?: number;
  brrrrPostRefiCashflow?: number;
}) {
  const rental = {
    cashflowMonthly: over.rentalCashflowMonthly ?? 0,
    noiAnnual: 0,
    capRatePct: 0,
    cashOnCashPct: 0,
    dscr: 1,
    onePctRulePct: 0,
    totalCashInvested: 80_000,
    monthlyDebtService: 0,
  } as RentalResult;
  const flip = {
    mao70: 0,
    wholetailMax: 0,
    projectedProfit: over.flipProfit ?? 0,
    projectedRoiPct: 0,
  } as FlipResult;
  const brrrr = {
    score: 0,
    refinanceCashOut: 0,
    remainingCashInDeal: 0,
    postRefiCashflowMonthly: over.brrrrPostRefiCashflow ?? 0,
    rating: "OK",
  } as BrrrrResult;
  const holdMonths = over.flipHoldMonths ?? 4;
  return { rental, flip, brrrr, projection: undefined, holdMonths };
}

describe("scoreForGoal — cash_flow", () => {
  it("B&H score equals rental monthly cashflow", () => {
    const f = makeFixtures({ rentalCashflowMonthly: 300 });
    const s = scoreForGoal("cash_flow", f);
    expect(s.buyAndHold).toBe(300);
  });

  it("BRRRR score equals post-refi monthly cashflow", () => {
    const f = makeFixtures({ brrrrPostRefiCashflow: 250 });
    const s = scoreForGoal("cash_flow", f);
    expect(s.brrrr).toBe(250);
  });

  it("F&F gets the soft-penalty proxy: (profit / months) × 0.4", () => {
    const f = makeFixtures({ flipProfit: 50_000, flipHoldMonths: 5 });
    // 50_000 / 5 = 10_000; × 0.4 = 4_000 per "month-equivalent"
    const s = scoreForGoal("cash_flow", f);
    expect(s.flip).toBeCloseTo(4_000, 1);
  });

  it("F&F floors at 0 when profit is negative (degenerate flip)", () => {
    const f = makeFixtures({ flipProfit: -10_000, flipHoldMonths: 4 });
    const s = scoreForGoal("cash_flow", f);
    expect(s.flip).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: FAIL with "Cannot find module '../goal-scoring'"

- [ ] **Step 3: Create the minimal goal-scoring.ts**

```typescript
// packages/frontend/app/analyzer/lib/goal-scoring.ts
import type {
  BrrrrResult,
  FlipResult,
  RentalResult,
  ProjectionResult,
} from "@propertyiq/analyzer-core";
import type { InvestorGoal } from "./goal-types";

/**
 * Goal-aware strategy scoring. For each (goal × strategy) pair we return a
 * positive number representing the strategy's fit for THIS goal on THIS
 * deal. The orchestrator (`pickBestPlayForGoal`) then picks argmax.
 *
 * All scoring functions are pure, take a normalized `ScoringInput` bundle,
 * and never return null/-Infinity — soft penalties keep all 3 strategies
 * scorable per the design spec.
 */

export interface ScoringInput {
  rental: RentalResult | null | undefined;
  flip: FlipResult | null | undefined;
  brrrr: BrrrrResult | null | undefined;
  projection: ProjectionResult | null | undefined;
  /** Hold months from the flip's assumptions block. Used by both cash_flow
   *  (F&F proxy) and recycle_capital (F&F velocity). Default 4. */
  holdMonths?: number;
  /** Refi seasoning months from BRRRR assumptions. Used by recycle_capital
   *  (BRRRR velocity). Default 6. */
  refiSeasoningMonths?: number;
}

export interface GoalScores {
  buyAndHold: number;
  flip: number;
  brrrr: number;
}

/** F&F profit haircut for the cash_flow proxy. 0.4 = capital-gains tax
 *  (~25%) compounded with an opportunity-cost discount (~50%). Documented
 *  in the design spec. */
const FLIP_CASHFLOW_PROXY_MULTIPLIER = 0.4;

export function scoreForGoal(
  goal: InvestorGoal,
  input: ScoringInput,
): GoalScores {
  switch (goal) {
    case "cash_flow":
      return scoreCashFlow(input);
    default:
      // Other goals filled in by later tasks.
      return { buyAndHold: 0, flip: 0, brrrr: 0 };
  }
}

function scoreCashFlow(input: ScoringInput): GoalScores {
  const bnh = input.rental?.cashflowMonthly ?? 0;
  const brrrr = input.brrrr?.postRefiCashflowMonthly ?? 0;
  const profit = input.flip?.projectedProfit ?? 0;
  const months = input.holdMonths ?? 4;
  const flip =
    profit > 0
      ? (profit / Math.max(1, months)) * FLIP_CASHFLOW_PROXY_MULTIPLIER
      : 0;
  return { buyAndHold: bnh, flip, brrrr };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/analyzer/lib/goal-scoring.ts packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts
git commit -m "feat(analyzer): cash_flow goal scoring fn + tests"
```

---

## Task 3: Long-term wealth scoring (TDD)

**Files:**

- Modify: `packages/frontend/app/analyzer/lib/goal-scoring.ts`
- Modify: `packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts`

- [ ] **Step 1: Add failing tests**

Append to the test file:

```typescript
describe("scoreForGoal — long_term_wealth", () => {
  it("B&H score reads projection.horizons.y30.equity", () => {
    const f = makeFixtures({});
    f.projection = {
      yearly: [],
      horizons: {
        y1: { equity: 0, irr: 0, cashflow: 0 },
        y3: { equity: 0, irr: 0, cashflow: 0 },
        y5: { equity: 0, irr: 0, cashflow: 0 },
        y10: { equity: 0, irr: 0, cashflow: 0 },
        y20: { equity: 0, irr: 0, cashflow: 0 },
        y30: { equity: 425_000, irr: 0, cashflow: 0 },
      },
    } as ProjectionResult;
    const s = scoreForGoal("long_term_wealth", f);
    expect(s.buyAndHold).toBe(425_000);
  });

  it("F&F score compounds projectedProfit at 7% over 30 years", () => {
    const f = makeFixtures({ flipProfit: 50_000 });
    const s = scoreForGoal("long_term_wealth", f);
    // 50_000 × 1.07^30 ≈ 380_612
    expect(s.flip).toBeCloseTo(50_000 * Math.pow(1.07, 30), 0);
  });

  it("BRRRR score uses postRefiProjection.horizons.y30.equity when present", () => {
    const f = makeFixtures({});
    f.brrrr = {
      ...f.brrrr,
      postRefiProjection: {
        yearly: [],
        horizons: {
          y1: { equity: 0, irr: 0, cashflow: 0 },
          y3: { equity: 0, irr: 0, cashflow: 0 },
          y5: { equity: 0, irr: 0, cashflow: 0 },
          y10: { equity: 0, irr: 0, cashflow: 0 },
          y20: { equity: 0, irr: 0, cashflow: 0 },
          y30: { equity: 500_000, irr: 0, cashflow: 0 },
        },
      },
    } as BrrrrResult;
    const s = scoreForGoal("long_term_wealth", f);
    expect(s.brrrr).toBe(500_000);
  });

  it("BRRRR falls back to B&H y30 equity when postRefiProjection is absent", () => {
    const f = makeFixtures({});
    f.projection = {
      yearly: [],
      horizons: {
        y1: { equity: 0, irr: 0, cashflow: 0 },
        y3: { equity: 0, irr: 0, cashflow: 0 },
        y5: { equity: 0, irr: 0, cashflow: 0 },
        y10: { equity: 0, irr: 0, cashflow: 0 },
        y20: { equity: 0, irr: 0, cashflow: 0 },
        y30: { equity: 425_000, irr: 0, cashflow: 0 },
      },
    } as ProjectionResult;
    const s = scoreForGoal("long_term_wealth", f);
    expect(s.brrrr).toBe(425_000);
  });
});
```

Also add the `ProjectionResult` import at the top of the test file:

```typescript
import type {
  BrrrrResult,
  FlipResult,
  ProjectionResult,
  RentalResult,
} from "@propertyiq/analyzer-core";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: 4 long_term_wealth tests FAIL (currently returns 0)

- [ ] **Step 3: Implement scoreLongTermWealth**

Update `goal-scoring.ts` switch arm + add the function:

```typescript
export function scoreForGoal(
  goal: InvestorGoal,
  input: ScoringInput,
): GoalScores {
  switch (goal) {
    case "cash_flow":
      return scoreCashFlow(input);
    case "long_term_wealth":
      return scoreLongTermWealth(input);
    default:
      return { buyAndHold: 0, flip: 0, brrrr: 0 };
  }
}

/** 7% annualized compounding mirror an S&P-ish index alternative for the
 *  F&F one-shot profit. Held flat for 30 years (no rolling-flip multiplier).
 *  Documented in the design spec. */
const INDEX_FUND_GROWTH_RATE = 0.07;
const HORIZON_YEARS = 30;

function scoreLongTermWealth(input: ScoringInput): GoalScores {
  const bnhY30 = input.projection?.horizons.y30.equity ?? 0;
  const brrrrY30 =
    input.brrrr?.postRefiProjection?.horizons.y30.equity ?? bnhY30;
  const profit = input.flip?.projectedProfit ?? 0;
  const flip =
    profit > 0
      ? profit * Math.pow(1 + INDEX_FUND_GROWTH_RATE, HORIZON_YEARS)
      : 0;
  return { buyAndHold: bnhY30, flip, brrrr: brrrrY30 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/analyzer/lib/goal-scoring.ts packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts
git commit -m "feat(analyzer): long_term_wealth goal scoring fn + tests"
```

---

## Task 4: Fast-cash scoring (TDD)

**Files:**

- Modify: `packages/frontend/app/analyzer/lib/goal-scoring.ts`
- Modify: `packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts`

- [ ] **Step 1: Add failing tests**

```typescript
describe("scoreForGoal — fast_cash", () => {
  it("F&F score equals projectedProfit", () => {
    const f = makeFixtures({ flipProfit: 65_000 });
    const s = scoreForGoal("fast_cash", f);
    expect(s.flip).toBe(65_000);
  });

  it("BRRRR score equals refinanceCashOut − totalCashInvested, floored at 0", () => {
    const f = makeFixtures({});
    f.brrrr = {
      ...f.brrrr,
      refinanceCashOut: 100_000,
    } as BrrrrResult;
    // rental.totalCashInvested defaults to 80_000 in the fixture; net = 20k
    const s = scoreForGoal("fast_cash", f);
    expect(s.brrrr).toBe(20_000);
  });

  it("BRRRR floors at 0 when refi doesn't cover the cash put in", () => {
    const f = makeFixtures({});
    f.brrrr = { ...f.brrrr, refinanceCashOut: 50_000 } as BrrrrResult;
    const s = scoreForGoal("fast_cash", f);
    expect(s.brrrr).toBe(0);
  });

  it("B&H uses the year-1 equity proxy when projection is present", () => {
    const f = makeFixtures({});
    f.projection = {
      yearly: [],
      horizons: {
        y1: { equity: 100_000, irr: 0, cashflow: 0 },
        y3: { equity: 0, irr: 0, cashflow: 0 },
        y5: { equity: 0, irr: 0, cashflow: 0 },
        y10: { equity: 0, irr: 0, cashflow: 0 },
        y20: { equity: 0, irr: 0, cashflow: 0 },
        y30: { equity: 0, irr: 0, cashflow: 0 },
      },
    } as ProjectionResult;
    // initialEquity defaults to rental.totalCashInvested (80k) when no
    // separate down-payment field is on the input; helper picks 70% of the
    // delta as HELOC-able. (100k − 80k) × 0.7 = 14_000
    const s = scoreForGoal("fast_cash", f);
    expect(s.buyAndHold).toBeCloseTo(14_000, 0);
  });

  it("B&H falls back to soft proxy when projection is absent", () => {
    const f = makeFixtures({});
    const s = scoreForGoal("fast_cash", f);
    // totalCashInvested × 0.05 = 80_000 × 0.05 = 4_000 (consistent with the
    // Recycle Capital B&H proxy — small but never zero)
    expect(s.buyAndHold).toBe(4_000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: 5 fast_cash tests FAIL

- [ ] **Step 3: Implement scoreFastCash**

Append to `goal-scoring.ts`:

```typescript
const HELOC_LTV = 0.7;
const BNH_NO_PROJECTION_PROXY = 0.05;

function scoreFastCash(input: ScoringInput): GoalScores {
  const flipProfit = Math.max(0, input.flip?.projectedProfit ?? 0);

  const refiCash = input.brrrr?.refinanceCashOut ?? 0;
  const cashIn = input.rental?.totalCashInvested ?? 0;
  const brrrrNet = Math.max(0, refiCash - cashIn);

  // B&H: HELOC against year-1 appreciated equity (70% LTV less the
  // cash already in). When projection is missing, fall back to a flat
  // soft-penalty so this strategy is never disqualified.
  const y1Equity = input.projection?.horizons.y1.equity ?? null;
  const bnh =
    y1Equity != null
      ? Math.max(0, (y1Equity - cashIn) * HELOC_LTV)
      : cashIn * BNH_NO_PROJECTION_PROXY;

  return { buyAndHold: bnh, flip: flipProfit, brrrr: brrrrNet };
}
```

Update the switch:

```typescript
case "fast_cash":
  return scoreFastCash(input);
```

- [ ] **Step 4: Run tests**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: 13 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/analyzer/lib/goal-scoring.ts packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts
git commit -m "feat(analyzer): fast_cash goal scoring fn + tests"
```

---

## Task 5: Recycle-capital scoring (TDD)

**Files:**

- Modify: `packages/frontend/app/analyzer/lib/goal-scoring.ts`
- Modify: `packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts`

- [ ] **Step 1: Add failing tests**

```typescript
describe("scoreForGoal — recycle_capital", () => {
  it("B&H proxy = totalCashInvested × 0.05", () => {
    const f = makeFixtures({});
    const s = scoreForGoal("recycle_capital", f);
    // 80_000 × 0.05 = 4_000 — small, never zero
    expect(s.buyAndHold).toBe(4_000);
  });

  it("F&F velocity = (totalCashInvested / holdMonths) × 12", () => {
    const f = makeFixtures({ flipHoldMonths: 5 });
    const s = scoreForGoal("recycle_capital", f);
    // 80_000 / 5 = 16_000; × 12 = 192_000 (cash recovered per year)
    expect(s.flip).toBeCloseTo(192_000, 0);
  });

  it("BRRRR velocity rewards low remainingCashInDeal", () => {
    const f = makeFixtures({});
    f.brrrr = {
      ...f.brrrr,
      remainingCashInDeal: 5_000,
    } as BrrrrResult;
    f.refiSeasoningMonths = 6;
    const s = scoreForGoal("recycle_capital", f);
    // (80_000 − 5_000) / 6 × 12 = 150_000
    expect(s.brrrr).toBeCloseTo(150_000, 0);
  });

  it("BRRRR floors at 0 when remainingCashInDeal exceeds totalCashInvested", () => {
    const f = makeFixtures({});
    f.brrrr = {
      ...f.brrrr,
      remainingCashInDeal: 100_000,
    } as BrrrrResult;
    const s = scoreForGoal("recycle_capital", f);
    expect(s.brrrr).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: 4 recycle_capital tests FAIL

- [ ] **Step 3: Implement scoreRecycleCapital**

Append to `goal-scoring.ts`:

```typescript
const DEFAULT_REFI_SEASONING_MONTHS = 6;

function scoreRecycleCapital(input: ScoringInput): GoalScores {
  const cashIn = input.rental?.totalCashInvested ?? 0;

  // B&H: dollar-years trapped earn a flat 5% proxy. Tiny but non-zero so
  // B&H is never disqualified — its real strength is on other goals.
  const bnh = cashIn * BNH_NO_PROJECTION_PROXY;

  // F&F: total cash recovered per year via sale + redeployment.
  const months = input.holdMonths ?? 4;
  const flip = (cashIn / Math.max(1, months)) * 12;

  // BRRRR: cash recovered at refi per year. The lower remainingCashInDeal
  // is, the higher this score gets.
  const remaining = input.brrrr?.remainingCashInDeal ?? cashIn;
  const recovered = Math.max(0, cashIn - remaining);
  const seasoning = input.refiSeasoningMonths ?? DEFAULT_REFI_SEASONING_MONTHS;
  const brrrr = (recovered / Math.max(1, seasoning)) * 12;

  return { buyAndHold: bnh, flip, brrrr };
}
```

Update the switch:

```typescript
case "recycle_capital":
  return scoreRecycleCapital(input);
```

Remove the now-unreachable `default` branch (all 4 cases handled).

- [ ] **Step 4: Run tests**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: 17 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/analyzer/lib/goal-scoring.ts packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts
git commit -m "feat(analyzer): recycle_capital goal scoring fn + tests"
```

---

## Task 6: pickBestPlayForGoal orchestrator (TDD)

**Files:**

- Modify: `packages/frontend/app/analyzer/lib/goal-scoring.ts`
- Modify: `packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts`

- [ ] **Step 1: Add failing tests**

```typescript
import { pickBestPlayForGoal } from "../goal-scoring";

describe("pickBestPlayForGoal", () => {
  it("cash_flow goal → strong B&H wins over weak F&F and BRRRR", () => {
    const f = makeFixtures({
      rentalCashflowMonthly: 400,
      flipProfit: 5_000,
      flipHoldMonths: 4,
      brrrrPostRefiCashflow: 50,
    });
    expect(pickBestPlayForGoal("cash_flow", f)).toBe("buyAndHold");
  });

  it("fast_cash goal → strong F&F wins over decent B&H rental", () => {
    const f = makeFixtures({
      rentalCashflowMonthly: 200,
      flipProfit: 75_000,
    });
    expect(pickBestPlayForGoal("fast_cash", f)).toBe("flip");
  });

  it("recycle_capital goal → strong BRRRR with low cash-left wins", () => {
    const f = makeFixtures({});
    f.brrrr = {
      ...f.brrrr,
      remainingCashInDeal: 2_000,
    } as BrrrrResult;
    f.refiSeasoningMonths = 6;
    // BRRRR velocity: (80k − 2k)/6 × 12 ≈ 156_000
    // F&F velocity: 80k / 4 × 12 = 240_000 — wait, F&F still wins here
    // Force F&F to be slower so BRRRR wins:
    f.holdMonths = 18;
    // F&F: 80k / 18 × 12 ≈ 53_333; BRRRR: ≈ 156k → BRRRR
    expect(pickBestPlayForGoal("recycle_capital", f)).toBe("brrrr");
  });

  it("ties broken in declaration order (buyAndHold > flip > brrrr)", () => {
    const f = makeFixtures({
      rentalCashflowMonthly: 100,
      flipProfit: 1_000,
      flipHoldMonths: 4,
      brrrrPostRefiCashflow: 100,
    });
    // cash_flow: bnh=100, flip≈100, brrrr=100. Ties go to first in object
    // iteration order (buyAndHold).
    expect(pickBestPlayForGoal("cash_flow", f)).toBe("buyAndHold");
  });

  it("returns null when ALL three strategies score 0 (no usable data)", () => {
    const f = makeFixtures({});
    expect(pickBestPlayForGoal("cash_flow", f)).toBe(null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: 5 pickBestPlayForGoal tests FAIL with "pickBestPlayForGoal is not defined"

- [ ] **Step 3: Implement pickBestPlayForGoal**

Append to `goal-scoring.ts`:

```typescript
/** Strategy identifier as used by the rest of the analyzer (matches
 *  `Strategy` in strategy-tile-mappers.ts). Kept inline to avoid an import
 *  cycle. */
type StrategyKey = "buyAndHold" | "flip" | "brrrr";

/**
 * Argmax over scoreForGoal. Ties resolve in declaration order
 * (buyAndHold > flip > brrrr) — deterministic so the same deal always
 * produces the same recommendation.
 *
 * Returns null when every strategy scores 0 (no usable data) so callers
 * can fall through to the deterministic pickBestPlay() and avoid a
 * meaningless "winner."
 */
export function pickBestPlayForGoal(
  goal: InvestorGoal,
  input: ScoringInput,
): StrategyKey | null {
  const scores = scoreForGoal(goal, input);
  const ordered: Array<[StrategyKey, number]> = [
    ["buyAndHold", scores.buyAndHold],
    ["flip", scores.flip],
    ["brrrr", scores.brrrr],
  ];
  let best: [StrategyKey, number] | null = null;
  for (const entry of ordered) {
    if (entry[1] <= 0) continue;
    if (best === null || entry[1] > best[1]) {
      best = entry;
    }
  }
  return best?.[0] ?? null;
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: 22 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/analyzer/lib/goal-scoring.ts packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts
git commit -m "feat(analyzer): pickBestPlayForGoal orchestrator + cross-goal winner tests"
```

---

## Task 7: inferDefaultGoal helper (TDD)

**Files:**

- Modify: `packages/frontend/app/analyzer/lib/goal-scoring.ts`
- Modify: `packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts`

- [ ] **Step 1: Add failing tests**

```typescript
import { inferDefaultGoal } from "../goal-scoring";

describe("inferDefaultGoal", () => {
  it("strong rental property → cash_flow default", () => {
    const f = makeFixtures({
      rentalCashflowMonthly: 500,
      flipProfit: 5_000,
      flipHoldMonths: 4,
    });
    expect(inferDefaultGoal(f)).toBe("cash_flow");
  });

  it("strong flip → fast_cash default", () => {
    const f = makeFixtures({
      rentalCashflowMonthly: 100,
      flipProfit: 80_000,
    });
    expect(inferDefaultGoal(f)).toBe("fast_cash");
  });

  it("strong BRRRR with low cash-left → recycle_capital default", () => {
    const f = makeFixtures({});
    f.brrrr = {
      ...f.brrrr,
      remainingCashInDeal: 2_000,
      postRefiCashflowMonthly: 100,
    } as BrrrrResult;
    f.holdMonths = 18; // pin F&F velocity low
    expect(inferDefaultGoal(f)).toBe("recycle_capital");
  });

  it("falls back to cash_flow when all four goals normalize to ≤0", () => {
    const f = makeFixtures({});
    expect(inferDefaultGoal(f)).toBe("cash_flow");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: 4 inferDefaultGoal tests FAIL

- [ ] **Step 3: Implement inferDefaultGoal**

Append to `goal-scoring.ts`:

```typescript
import { ALL_GOALS } from "./goal-types";

/** Normalization anchors — score=1.0 lands at a typical Balanced-preset
 *  A-grade outcome on each goal. Documented in the design spec. */
const NORMALIZATION_ANCHOR: Record<InvestorGoal, number> = {
  cash_flow: 500, // $500/door/month
  long_term_wealth: 500_000, // $500k at year 30
  fast_cash: 80_000, // $80k in year 1
  recycle_capital: 40_000, // $40k/year cash redeployed
};

/**
 * Pre-selects the goal that fits this deal best. For each of the 4 goals
 * we find the top-strategy score, normalize against the goal-specific
 * anchor, and pick the goal with the highest normalized value.
 *
 * Falls back to `cash_flow` when every goal normalizes to ≤0 (typically
 * means insufficient input data for projections; the user can still pick
 * a different goal once they fill in more fields).
 */
export function inferDefaultGoal(input: ScoringInput): InvestorGoal {
  let bestGoal: InvestorGoal = "cash_flow";
  let bestNormalized = -Infinity;
  for (const goal of ALL_GOALS) {
    const s = scoreForGoal(goal, input);
    const topRaw = Math.max(s.buyAndHold, s.flip, s.brrrr);
    const normalized = topRaw / NORMALIZATION_ANCHOR[goal];
    if (normalized > bestNormalized) {
      bestNormalized = normalized;
      bestGoal = goal;
    }
  }
  return bestGoal;
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts`
Expected: 26 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/analyzer/lib/goal-scoring.ts packages/frontend/app/analyzer/lib/__tests__/goal-scoring.test.ts
git commit -m "feat(analyzer): inferDefaultGoal helper + normalization anchor tests"
```

---

## Task 8: GoalPicker component (TDD)

**Files:**

- Create: `packages/frontend/app/analyzer/components/StrategyCompare/GoalPicker.tsx`
- Create: `packages/frontend/app/analyzer/components/StrategyCompare/__tests__/GoalPicker.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/app/analyzer/components/StrategyCompare/__tests__/GoalPicker.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GoalPicker } from "../GoalPicker";

describe("GoalPicker", () => {
  it("renders 4 chip buttons in fixed order", () => {
    render(<GoalPicker selectedGoal="cash_flow" onChange={() => {}} />);
    const chips = screen.getAllByRole("radio");
    expect(chips.map((c) => c.getAttribute("data-goal"))).toEqual([
      "cash_flow",
      "long_term_wealth",
      "fast_cash",
      "recycle_capital",
    ]);
  });

  it("marks the selected chip with aria-checked=true", () => {
    render(<GoalPicker selectedGoal="fast_cash" onChange={() => {}} />);
    const selected = screen.getByRole("radio", { name: /fast cash/i });
    expect(selected.getAttribute("aria-checked")).toBe("true");
  });

  it("fires onChange with the goal key when a chip is clicked", () => {
    const onChange = vi.fn();
    render(<GoalPicker selectedGoal="cash_flow" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /recycle capital/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("recycle_capital");
  });

  it("renders nothing when selectedGoal is null AND no inferredGoal provided", () => {
    const { container } = render(
      <GoalPicker selectedGoal={null} onChange={() => {}} />,
    );
    // Empty state: chips render but none are selected — discoverable but
    // not pre-committed
    const chips = screen.getAllByRole("radio");
    chips.forEach((c) =>
      expect(c.getAttribute("aria-checked")).toBe("false"),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/analyzer/components/StrategyCompare/__tests__/GoalPicker.test.tsx`
Expected: FAIL with "Cannot find module '../GoalPicker'"

- [ ] **Step 3: Implement GoalPicker**

```typescript
// packages/frontend/app/analyzer/components/StrategyCompare/GoalPicker.tsx
"use client";

/**
 * Goal selector row for "Help me decide" (compare) mode. 4 chips:
 * Cash flow / Long-term wealth / Fast cash / Recycle capital.
 *
 * Owned by AnalyzerClient (selectedGoal state lives there + persists to
 * localStorage). This component is presentation-only — receives the
 * current selection + onChange callback.
 */

import {
  ALL_GOALS,
  GOAL_DESCRIPTION,
  GOAL_LABEL,
  type InvestorGoal,
} from "../../lib/goal-types";

interface GoalPickerProps {
  selectedGoal: InvestorGoal | null;
  onChange: (goal: InvestorGoal) => void;
}

export function GoalPicker({ selectedGoal, onChange }: GoalPickerProps) {
  return (
    <div
      data-goal-picker
      role="radiogroup"
      aria-label="What's your investment goal for this deal?"
      className="flex flex-col gap-2"
    >
      <div className="text-xs uppercase tracking-wider font-semibold text-on-surface-variant">
        Your goal for this deal
      </div>
      <div className="inline-flex flex-wrap gap-2">
        {ALL_GOALS.map((goal) => {
          const isActive = goal === selectedGoal;
          return (
            <button
              key={goal}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={GOAL_LABEL[goal]}
              data-goal={goal}
              title={GOAL_DESCRIPTION[goal]}
              onClick={() => onChange(goal)}
              className={
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors border " +
                (isActive
                  ? "bg-[var(--md-primary)] text-[var(--md-on-primary)] border-[var(--md-primary)]"
                  : "bg-transparent text-on-surface-variant border-outline-variant hover:text-on-surface hover:border-outline")
              }
            >
              {GOAL_LABEL[goal]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/frontend && npx vitest run app/analyzer/components/StrategyCompare/__tests__/GoalPicker.test.tsx`
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/analyzer/components/StrategyCompare/GoalPicker.tsx packages/frontend/app/analyzer/components/StrategyCompare/__tests__/GoalPicker.test.tsx
git commit -m "feat(analyzer): GoalPicker chip-row component + tests"
```

---

## Task 9: Wire selectedGoal state in AnalyzerClient

**Files:**

- Modify: `packages/frontend/app/analyzer/AnalyzerClient.tsx`

This task adds the `selectedGoal` state with localStorage persistence and computes a `bestPlayForGoal` value that overrides the existing `bestPlay`. It does NOT yet render the picker UI — that's Task 10.

- [ ] **Step 1: Read the current state of AnalyzerClient.tsx around the bestPlay line**

Run: `cd packages/frontend && grep -n "bestPlay\|computeBestPlay" app/analyzer/AnalyzerClient.tsx`
Expected output should show the import, the variable assignment, and the `activeStrategy` derivation.

- [ ] **Step 2: Add the new imports**

In `AnalyzerClient.tsx`, find the existing imports section and add:

```typescript
import { useEffect, useMemo, useState } from "react";
// (extend the existing `import { use, useState } from "react";` line —
// either replace it with the line above, or add the missing `useMemo` and
// `useEffect` to the existing destructure)
import {
  inferDefaultGoal,
  pickBestPlayForGoal,
  type ScoringInput,
} from "./lib/goal-scoring";
import type { InvestorGoal } from "./lib/goal-types";
```

- [ ] **Step 3: Add selectedGoal state + localStorage rehydration**

Find the existing state declarations (around `const [analysisMode, setAnalysisMode]`). Add immediately after:

```typescript
const [selectedGoal, setSelectedGoal] = useState<InvestorGoal | null>(null);

// Rehydrate from localStorage on mount; never on the server.
useEffect(() => {
  if (typeof window === "undefined") return;
  const saved = window.localStorage.getItem("analyzer.investorGoal");
  if (
    saved === "cash_flow" ||
    saved === "long_term_wealth" ||
    saved === "fast_cash" ||
    saved === "recycle_capital"
  ) {
    setSelectedGoal(saved);
  }
}, []);

// Persist on change.
useEffect(() => {
  if (typeof window === "undefined") return;
  if (selectedGoal == null) return;
  window.localStorage.setItem("analyzer.investorGoal", selectedGoal);
}, [selectedGoal]);
```

- [ ] **Step 4: Build the ScoringInput bundle + override bestPlay in compare mode**

Find the existing `const bestPlay = computeBestPlay(...)` line. Replace with:

```typescript
const scoringInput: ScoringInput = useMemo(
  () => ({
    rental,
    flip,
    brrrr,
    projection,
    holdMonths: assumptions.holdingMonths,
    refiSeasoningMonths: assumptions.seasoningMonths,
  }),
  [
    rental,
    flip,
    brrrr,
    projection,
    assumptions.holdingMonths,
    assumptions.seasoningMonths,
  ],
);

const defaultBestPlay = computeBestPlay(rental, flip, brrrr, projection);

// When a goal is selected AND we're in compare mode, override the
// deterministic best-play with the goal-aware winner. Falls back to the
// deterministic pick when goal is null (first load) or the goal-aware
// scorer returns null (all 3 strategies have 0 fit).
const goalBestPlay =
  analysisMode === "compare" && selectedGoal
    ? pickBestPlayForGoal(selectedGoal, scoringInput)
    : null;

const bestPlay: Strategy = (goalBestPlay as Strategy | null) ?? defaultBestPlay;

// Auto-pick a default goal once the deal becomes gradable, but only if the
// user hasn't picked one yet. Runs once per session per (deal change).
useEffect(() => {
  if (analysisMode !== "compare") return;
  if (selectedGoal != null) return;
  if (!hasGradableInput) return;
  const inferred = inferDefaultGoal(scoringInput);
  setSelectedGoal(inferred);
}, [analysisMode, selectedGoal, hasGradableInput, scoringInput]);
```

- [ ] **Step 5: Typecheck**

Run: `cd packages/frontend && npx tsc --noEmit 2>&1 | grep -v "DirectionalBarsTooltip\|newsletter/page\|org/\[slug\]/admin/embeds\|app/page.tsx\|currency-exact" | head -10`
Expected: no NEW errors (only the pre-existing ones).

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/analyzer/AnalyzerClient.tsx
git commit -m "feat(analyzer): selectedGoal state + goal-aware bestPlay override

Threads goal-aware scoring into AnalyzerClient. State persists to
localStorage and pre-selects the inferred best-fit goal on first
render in compare mode. Default deterministic bestPlay is preserved
as the fallback when no goal is selected or when goal scoring returns
null (all 3 strategies have 0 fit)."
```

---

## Task 10: Render GoalPicker inside StrategyCompare

**Files:**

- Modify: `packages/frontend/app/analyzer/components/StrategyCompare/StrategyCompare.tsx`
- Modify: `packages/frontend/app/analyzer/AnalyzerClient.tsx`

- [ ] **Step 1: Read StrategyCompare.tsx for its current props**

Run: `cd packages/frontend && grep -n "StrategyCompareProps\|interface\|export function" app/analyzer/components/StrategyCompare/StrategyCompare.tsx`

- [ ] **Step 2: Add goal props to StrategyCompare's interface**

In `StrategyCompare.tsx`, extend the existing props interface with:

```typescript
import { GoalPicker } from "./GoalPicker";
import type { InvestorGoal } from "../../lib/goal-types";

// ...inside the existing props interface:
selectedGoal?: InvestorGoal | null;
onGoalChange?: (goal: InvestorGoal) => void;
```

- [ ] **Step 3: Render GoalPicker above the existing content**

Find where the component returns its JSX (likely starts with the `BestPlayCallout`). Insert just above it:

```typescript
{selectedGoal !== undefined && onGoalChange && (
  <div className="mb-4">
    <GoalPicker selectedGoal={selectedGoal} onChange={onGoalChange} />
  </div>
)}
```

The `selectedGoal !== undefined` check (not `!= null`) lets us render the picker even when no goal is selected yet, because `null` is a valid "not selected" state.

- [ ] **Step 4: Wire the props from AnalyzerClient**

In `AnalyzerClient.tsx`, find the `<StrategyCompare {...strategyProps} ... />` call. Add the two new props:

```typescript
<StrategyCompare
  {...strategyProps}
  isDealViable={
    hasGradableInput && verdict !== "bad" && verdict !== "avoid"
  }
  selectedGoal={selectedGoal}
  onGoalChange={setSelectedGoal}
/>
```

- [ ] **Step 5: Typecheck**

Run: `cd packages/frontend && npx tsc --noEmit 2>&1 | grep -v "DirectionalBarsTooltip\|newsletter/page\|org/\[slug\]/admin/embeds\|app/page.tsx\|currency-exact" | head -10`
Expected: no new errors.

- [ ] **Step 6: Verify the page renders in the browser**

Open the analyzer page in your dev browser (`localhost:3000/analyzer`), switch to "Help me decide" mode, and confirm:

- 4 goal chips appear above the Best Play callout
- One is pre-selected (whichever fits the entered deal best)
- Clicking another chip selects it
- Selection persists across page reloads (localStorage)

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/analyzer/components/StrategyCompare/StrategyCompare.tsx packages/frontend/app/analyzer/AnalyzerClient.tsx
git commit -m "feat(analyzer): render GoalPicker in StrategyCompare with parent state wiring"
```

---

## Task 11: BestPlayCallout — show goal context in the tagline

**Files:**

- Modify: `packages/frontend/app/analyzer/components/cards/BestPlayCallout.tsx`
- Modify: `packages/frontend/app/analyzer/components/StrategyCompare/StrategyCompare.tsx`

- [ ] **Step 1: Read BestPlayCallout's current props + JSX**

Run: `cd packages/frontend && cat app/analyzer/components/cards/BestPlayCallout.tsx`

- [ ] **Step 2: Add optional `goal` prop to BestPlayCallout**

In `BestPlayCallout.tsx`, extend the props interface:

```typescript
import { GOAL_LABEL, type InvestorGoal } from "../../lib/goal-types";

interface BestPlayCalloutProps {
  // ...existing props
  /** When provided, the tagline reframes to "Best for <goal>: <strategy>"
   *  instead of the generic "Best play: <strategy>". */
  goal?: InvestorGoal | null;
}
```

- [ ] **Step 3: Update the tagline copy**

Find the existing tagline text in the JSX (likely something like `Best play` or similar). Replace with a conditional:

```typescript
const taglinePrefix = goal ? `Best for ${GOAL_LABEL[goal]}` : "Best play";
// ...and use {taglinePrefix} where the old fixed string was
```

- [ ] **Step 4: Pass goal through from StrategyCompare**

In `StrategyCompare.tsx`, find the `<BestPlayCallout ... />` call and add:

```typescript
<BestPlayCallout
  // ...existing props
  goal={selectedGoal}
/>
```

- [ ] **Step 5: Typecheck**

Run: `cd packages/frontend && npx tsc --noEmit 2>&1 | grep -v "DirectionalBarsTooltip\|newsletter/page\|org/\[slug\]/admin/embeds\|app/page.tsx\|currency-exact" | head -10`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/analyzer/components/cards/BestPlayCallout.tsx packages/frontend/app/analyzer/components/StrategyCompare/StrategyCompare.tsx
git commit -m "feat(analyzer): BestPlayCallout tagline reframes by selected goal"
```

---

## Task 12: Backend DTO — accept optional goal field

**Files:**

- Modify: `packages/backend/src/analyzer/dto/ai-insights.dto.ts`

- [ ] **Step 1: Read the current DTO to see where the payload shape is declared**

Run: `cd packages/backend && cat src/analyzer/dto/ai-insights.dto.ts`

- [ ] **Step 2: Add the `goal` field to the inline payload type**

In `AiInsightsBodyDto`, add a new optional field on the inner `payload` type:

```typescript
@IsObject()
payload!: {
  input: any;
  result: any;
  rentcast: any;
  piq: any;
  grading?: any;
  strategy?: 'BUY_AND_HOLD' | 'FIX_AND_FLIP' | 'BRRRR' | null;
  piqByGeo?: {
    zip?: number | null;
    county?: number | null;
    metro?: number | null;
  };
  /** Investor goal for the "Help me decide" recommender. Optional —
   *  focused-mode and saved/shared routes leave this null. */
  goal?:
    | 'cash_flow'
    | 'long_term_wealth'
    | 'fast_cash'
    | 'recycle_capital'
    | null;
};
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: same pre-existing errors as before (ai-verdict.spec, scoring-pipeline, etc.). No new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/analyzer/dto/ai-insights.dto.ts
git commit -m "feat(backend): accept optional goal field on AI insights payload"
```

---

## Task 13: Backend prompt — append goal-aware block to recommendation_analysis

**Files:**

- Modify: `packages/backend/src/analyzer/prompts/section-prompts.ts`
- Modify: `packages/backend/src/analyzer/ai-insights.service.ts`

- [ ] **Step 1: Read both files**

Run: `cd packages/backend && cat src/analyzer/prompts/section-prompts.ts src/analyzer/ai-insights.service.ts | head -200`

- [ ] **Step 2: Append the goal-aware paragraph to recommendation_analysis**

In `section-prompts.ts`, find the `recommendation_analysis` entry and append (concatenated to the existing string):

```typescript
  recommendation_analysis:
    'Write 3 to 5 conversational sentences that explain the grade...' +
    /* ... existing prompt body unchanged ... */
    ' If a USER GOAL block is provided (one of: cash flow, long-term wealth, fast cash, recycle capital), frame the verdict around that goal. If a strategy with a lower overall grade is actually the better fit for THIS goal, say so explicitly with a concrete number comparison (e.g. "Fix & Flip grades higher overall but delivers no monthly income; for a cash-flow goal the B&H\\\'s $312/mo beats the F&F lump sum"). If no strategy fits the goal well on this deal, say so plainly — "this deal isn\\\'t a cash-flow play; the least-bad option is the BRRRR\\\'s $50/mo, but consider passing on the property."',
```

Note: keep the existing prompt text exactly as it currently is and ONLY append the new sentence cluster. Use string concatenation with `+` so the diff is small and the prior text is unchanged.

- [ ] **Step 3: Render the GOAL block in assemblePrompt**

In `ai-insights.service.ts`, find the `assemblePrompt` method. Add a small GOAL block right after the existing STRATEGY block (or right before the TASK block — the exact location doesn't matter as long as it precedes the section prompt):

```typescript
// Inside assemblePrompt, before the TASK line:
...(payload.goal
  ? [
      'USER GOAL:',
      `- The user picked "${humanizeGoal(payload.goal)}" as their goal for this deal.`,
      '',
    ]
  : []),
```

Add a small helper at the bottom of the file (or top — same file):

```typescript
function humanizeGoal(goal: string): string {
  const labels: Record<string, string> = {
    cash_flow: "Maximize monthly cash flow",
    long_term_wealth: "Maximize long-term (30-year) wealth",
    fast_cash: "Maximize fast cash within 12 months",
    recycle_capital: "Recycle capital into the next deal as fast as possible",
  };
  return labels[goal] ?? goal;
}
```

- [ ] **Step 4: Extend InsightPayload to include `goal`**

In `ai-insights.service.ts`, find the `InsightPayload` interface and add:

```typescript
goal?:
  | 'cash_flow'
  | 'long_term_wealth'
  | 'fast_cash'
  | 'recycle_capital'
  | null;
```

- [ ] **Step 5: Typecheck**

Run: `cd packages/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: same pre-existing errors. No new errors.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/analyzer/prompts/section-prompts.ts packages/backend/src/analyzer/ai-insights.service.ts
git commit -m "feat(backend): goal-aware block in recommendation_analysis prompt"
```

---

## Task 14: Backend cache key — include goal + bump PROMPT_REVISION

**Files:**

- Modify: `packages/backend/src/analyzer/ai-insights.cache.ts`

- [ ] **Step 1: Read the current cache.ts**

Run: `cd packages/backend && cat src/analyzer/ai-insights.cache.ts`

- [ ] **Step 2: Bump PROMPT_REVISION to v5 and add a changelog entry**

Find the existing `PROMPT_REVISION` constant and update its block comment + value:

```typescript
/**
 * Prompt revision tag. Bump this whenever a prompt template change should
 * invalidate all existing cached AI responses. The cache key includes it so
 * a bump guarantees a fresh regeneration across every user/section without a
 * manual Redis flush.
 *
 *   v5 (2026-05-18): goal-aware recommendation_analysis prompt; cache key
 *                    now includes the user's investor goal so each goal
 *                    gets its own cached narrative per deal.
 *   v4 (2026-05-18): reapplied PIQ probability framing (rolled back in v3,
 *                    restored in v4). [...remaining history kept as-is...]
 */
const PROMPT_REVISION = "v5";
```

- [ ] **Step 3: Embed goal in the cache key**

Find the `computeKey` method. Add the goal between `strategy` and `inputHash`:

```typescript
computeKey(payload: any, sectionId: string): string {
  // ...existing setup...
  const strategy = payload.strategy ?? 'none';
  const goal = payload.goal ?? 'none';
  return `ai-insights:${PROMPT_REVISION}:${sectionId}:${strategy}:${goal}:${inputHash}:${rcHash}:${piqHash}`;
}
```

- [ ] **Step 4: Typecheck**

Run: `cd packages/backend && npx tsc --noEmit 2>&1 | head -10`
Expected: same pre-existing errors. No new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/analyzer/ai-insights.cache.ts
git commit -m "feat(backend): include goal in AI cache key + bump PROMPT_REVISION to v5"
```

---

## Task 15: Frontend — thread goal through to AI fetcher

**Files:**

- Modify: `packages/frontend/lib/data/fetchers/ai-insights.ts`
- Modify: `packages/frontend/app/analyzer/lib/use-section-ai-insights.ts`
- Modify: `packages/frontend/app/analyzer/AnalyzerClient.tsx`

- [ ] **Step 1: Add `goal` field to AiInsightPayload**

In `packages/frontend/lib/data/fetchers/ai-insights.ts`, extend the `AiInsightPayload` interface:

```typescript
export interface AiInsightPayload {
  input: unknown;
  result: unknown;
  rentcast: unknown;
  piq: unknown;
  grading?: unknown;
  strategy?: "BUY_AND_HOLD" | "FIX_AND_FLIP" | "BRRRR" | null;
  piqByGeo?: {
    zip?: number | null;
    county?: number | null;
    metro?: number | null;
  };
  /** Investor goal for the "Help me decide" recommender. Optional. */
  goal?:
    | "cash_flow"
    | "long_term_wealth"
    | "fast_cash"
    | "recycle_capital"
    | null;
}
```

- [ ] **Step 2: Thread goal through useSectionAiInsights**

In `packages/frontend/app/analyzer/lib/use-section-ai-insights.ts`:

a) Add `goal` to `UseSectionAiInsightsArgs`:

```typescript
export interface UseSectionAiInsightsArgs {
  // ...existing fields
  goal?: import("./goal-types").InvestorGoal | null;
}
```

b) Destructure `goal` in the function signature and add to the payload:

```typescript
const payload: AiInsightPayload = {
  input,
  result: { rental, flip, brrrr },
  rentcast,
  piq,
  grading: grading ?? undefined,
  strategy,
  piqByGeo: {
    zip: piqByGeo.zip,
    county: piqByGeo.county,
    metro: piqByGeo.metro,
  },
  goal: goal ?? null,
};
```

c) Extend `piqDiscriminator` to include `goal` so React Query's queryKey re-runs on goal switches:

```typescript
const piqDiscriminator = [
  piqByGeo.metro ?? "",
  piqByGeo.county ?? "",
  piqByGeo.zip ?? "",
  // ... existing entries ...
  grading?.letter ?? "",
  strategy ?? "",
  goal ?? "",
].join("|");
```

- [ ] **Step 3: Pass goal from AnalyzerClient**

In `AnalyzerClient.tsx`, find the existing `useSectionAiInsights({ ... })` call and add `goal: selectedGoal,` to the args object.

- [ ] **Step 4: Typecheck**

Run: `cd packages/frontend && npx tsc --noEmit 2>&1 | grep -v "DirectionalBarsTooltip\|newsletter/page\|org/\[slug\]/admin/embeds\|app/page.tsx\|currency-exact" | head -10`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/data/fetchers/ai-insights.ts packages/frontend/app/analyzer/lib/use-section-ai-insights.ts packages/frontend/app/analyzer/AnalyzerClient.tsx
git commit -m "feat(analyzer): thread selectedGoal through to AI insights fetcher"
```

---

## Task 16: End-to-end verification

**Files:**

- No code changes — verification + capture of any follow-ups

- [ ] **Step 1: Build analyzer-core (no changes there but the script also bumps frontend's dependency hash)**

Run: `cd packages/analyzer-core && npm run build`
Expected: clean build.

- [ ] **Step 2: Run all goal-scoring tests**

Run: `cd packages/frontend && npx vitest run app/analyzer/lib/__tests__/goal-scoring.test.ts app/analyzer/components/StrategyCompare/__tests__/GoalPicker.test.tsx`
Expected: 26 + 4 = 30 tests pass.

- [ ] **Step 3: Run the full frontend analyzer test suite**

Run: `cd packages/frontend && npx vitest run app/analyzer`
Expected: all existing analyzer tests still pass (no regressions).

- [ ] **Step 4: Full typecheck**

Run: `cd packages/frontend && npx tsc --noEmit 2>&1 | grep -v "DirectionalBarsTooltip\|newsletter/page\|org/\[slug\]/admin/embeds\|app/page.tsx\|currency-exact" | head -10`
Expected: empty output (only pre-existing errors which are filtered).

Run: `cd packages/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: same pre-existing errors only.

- [ ] **Step 5: Live verification in the browser**

Open the analyzer at `http://localhost:3000/analyzer`. Enter a deal with rent + ARV + rehab so all 3 strategies grade. Toggle to "Help me decide" mode and verify each of the following:

1. **4 goal chips appear** above the Best Play callout, in order Cash flow / Long-term wealth / Fast cash / Recycle capital.
2. **One chip is pre-selected** (inferred default — log it to console if needed: `localStorage.getItem("analyzer.investorGoal")`).
3. **Switching goals changes the winner** — pick a goal where you'd expect a different strategy to win and verify the Best Play callout updates accordingly.
4. **Tagline reframes** — should now read "Best for Cash flow: Buy & Hold" (or similar) instead of generic "Best play".
5. **AI narrative regenerates** — open browser DevTools Network tab; toggling goals should fire fresh `POST /api/analyzer/ai-insights/section` requests with goal in the payload, and the rendered narrative should reference the goal.
6. **localStorage persists** — refresh the page; same goal stays selected.

If any of these fail, log the specific failure under each step's checkbox and address before moving on.

- [ ] **Step 6: Commit verification notes (if any)**

If verification surfaced bugs:

```bash
# Fix forward, then:
git add <changed files>
git commit -m "fix(analyzer): <specific issue> uncovered during Help Me Decide e2e"
```

If verification passed clean, no commit needed.

---

## Self-review

**Spec coverage check:**

| Spec section                                                                      | Plan task(s)                                                                      |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 4 goals (Cash flow / Long-term wealth / Fast cash / Recycle capital)              | Task 1 (types), Tasks 2-5 (scoring), Task 8 (UI)                                  |
| Pick best play by goal (replace `pickBestPlay()`)                                 | Task 6 (`pickBestPlayForGoal`), Task 9 (wire)                                     |
| Pre-select goal that best fits deal                                               | Task 7 (`inferDefaultGoal`), Task 9 (auto-pick effect)                            |
| GoalPicker above BestPlayCallout in compare mode only                             | Task 8 (component), Task 10 (placement + compare-mode gate)                       |
| AI narrative reframes around goal                                                 | Task 13 (prompt block + assembler), Task 15 (frontend wiring)                     |
| Cache key includes goal + PROMPT_REVISION bump                                    | Task 14                                                                           |
| localStorage persistence                                                          | Task 9                                                                            |
| Soft-penalty scoring (never disqualify)                                           | Tasks 2-5 (each scoring fn floors at 0, no -Infinity)                             |
| Goal-specific tagline on BestPlayCallout                                          | Task 11                                                                           |
| Backend DTO accepts optional goal                                                 | Task 12                                                                           |
| Testing — scoring unit tests, inference test, cross-table, component, integration | Tasks 2-7 (unit + cross-table), Task 8 (component), Task 16 (integration browser) |

All spec sections have task coverage.

**Placeholder scan:** no TBD / TODO / "fill in later" / "similar to Task N" patterns. Each step contains actual code or actual commands.

**Type consistency:**

- `InvestorGoal` union used identically in Task 1 (declaration) and Tasks 8, 9, 10, 11, 15 (consumers).
- `ScoringInput` declared in Task 2, used in Tasks 3-7, 9.
- `GoalScores` declared in Task 2, used in Tasks 3-7.
- `pickBestPlayForGoal(goal, input)` signature in Task 6 matches the call site in Task 9.
- `inferDefaultGoal(input)` signature in Task 7 matches the call site in Task 9.
- `StrategyKey` is declared inline in Task 6; AnalyzerClient uses `Strategy` from `strategy-tile-mappers.ts`. Task 9 explicitly casts via `as Strategy` because both unions are `"buyAndHold" | "flip" | "brrrr"` (subset of Strategy which also has `"multifamily"`). Cast is safe — the four values that can actually win are all in both unions.

No inconsistencies.
