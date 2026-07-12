# User-Editable Auto-Kill Criteria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users toggle and tune the analyzer's auto-kill rules (per strategy), persisted to their account, edited from a new "Auto-Kill" drawer tab reachable from the Auto-Kill banner and the Advanced Assumptions section.

**Architecture:** An optional `autoKills` block is added to each strategy's thresholds object in `@propertyiq/analyzer-core`. It persists through the existing `user_thresholds` JSONB + `PUT /api/analyzer/thresholds/:strategy` pipeline and reaches the engine via the existing `resolveThresholds()` path. `collect*AutoKills()` reads the config with defaults equal to today's literals — absent config is behavior-identical. The Customize drawer gains a fourth tab; the banner and Advanced Assumptions deep-link to it.

**Tech Stack:** TypeScript, analyzer-core (vitest), NestJS + class-validator (jest), Next.js + React (vitest), Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-07-12-analyzer-autokill-criteria-editing-design.md`

## Global Constraints

- Branch: `develop`. Never push without being asked. Run `git branch --show-current` before every commit. Commit with explicit pathspecs only (`git commit -- <paths>`).
- Absent/partial `autoKills` config must produce **behavior-identical results to today** (messages included).
- Auto-kill rule **codes never change** (`DSCR_BELOW_1`, etc.) — they are stable identifiers.
- Numeric limit resolution order inside the engine: `config.value ?? context override ?? DEFAULT`. Enabled resolution: `config.enabled ?? true`. Deal-level acknowledgment flags (`rehabRiskAccepted`, etc.) keep suppressing exactly as today.
- Validation bounds (same in frontend validators and backend DTO): DSCR floors **0.3–2.0**; shares/percent **0.05–1.0**; dollars **0–500 000**; DOM multiplier **1–10**.
- `packages/frontend/app/(app)/analyzer/lib/use-grading-result.ts` is **NOT modified**.
- Preset switching must **never modify** the draft's `autoKills` block; preset detection must **ignore** it.
- File size limits (CLAUDE.md §1.3): logic files hard limit 300 lines, components 400. New tab goes in its own file.
- After any analyzer-core change: `npm run build -w @propertyiq/analyzer-core` (frontend + backend consume `dist/`).
- If a build shows ANY error — including pre-existing — fix all of them before committing (tasks/lessons.md rule).

---

### Task 1: analyzer-core — shared auto-kill config types, defaults, resolver

**Files:**

- Create: `packages/analyzer-core/src/grading/shared/autokill-config.ts`
- Create: `packages/analyzer-core/src/grading/shared/autokill-config.test.ts`
- Modify: `packages/analyzer-core/src/grading/index.ts` (add exports)

**Interfaces:**

- Consumes: nothing new.
- Produces: `AutoKillRuleConfig`, `BuyAndHoldAutoKillConfig`, `FixAndFlipAutoKillConfig`, `BrrrrAutoKillConfig`, `AUTOKILL_DEFAULTS`, `ruleEnabled(cfg?: AutoKillRuleConfig): boolean`, `ruleValue(cfg: AutoKillRuleConfig | undefined, fallback: number): number` — all exported from `@propertyiq/analyzer-core`.

- [ ] **Step 1: Write the failing test**

Create `packages/analyzer-core/src/grading/shared/autokill-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AUTOKILL_DEFAULTS, ruleEnabled, ruleValue } from "./autokill-config";

describe("auto-kill config resolver", () => {
  it("ruleEnabled defaults to true when config or field is absent", () => {
    expect(ruleEnabled(undefined)).toBe(true);
    expect(ruleEnabled({})).toBe(true);
    expect(ruleEnabled({ enabled: true })).toBe(true);
    expect(ruleEnabled({ enabled: false })).toBe(false);
  });

  it("ruleValue falls back when config or value is absent", () => {
    expect(ruleValue(undefined, 1.0)).toBe(1.0);
    expect(ruleValue({}, 1.0)).toBe(1.0);
    expect(ruleValue({ value: 0.85 }, 1.0)).toBe(0.85);
    expect(ruleValue({ enabled: false, value: 0.85 }, 1.0)).toBe(0.85);
  });

  it("AUTOKILL_DEFAULTS mirror today's hardcoded literals", () => {
    expect(AUTOKILL_DEFAULTS.BUY_AND_HOLD).toEqual({
      dscrFloor: 1.0,
      taxInsShareOfRent: 0.4,
    });
    expect(AUTOKILL_DEFAULTS.FIX_AND_FLIP).toEqual({
      minNetProfit: 10_000,
      rehabContingency: 0.1,
      extremeHold: 2,
    });
    expect(AUTOKILL_DEFAULTS.BRRRR).toEqual({
      refiDscrFloor: 1.0,
      rehabContingency: 0.1,
      maxCashLeft: 10_000,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/projects/rei-platform && npx vitest run src/grading/shared/autokill-config.test.ts --root packages/analyzer-core`
Expected: FAIL — `Cannot find module './autokill-config'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `packages/analyzer-core/src/grading/shared/autokill-config.ts`:

```ts
/**
 * Auto-kill rule configuration — the user-tunable layer over the strategy
 * engines' automatic disqualification checks.
 *
 * Every rule resolves as:
 *   enabled = config.enabled ?? true
 *   value   = config.value ?? <per-request context override> ?? DEFAULT
 *
 * Absent or partial config is behavior-identical to the pre-config engine.
 * Rule KEYS here are stable API surface (persisted in user_thresholds JSONB);
 * rule CODES (DSCR_BELOW_1, ...) in the grade helpers never change either.
 */

export interface AutoKillRuleConfig {
  /** Rule runs unless explicitly disabled. */
  enabled?: boolean;
  /** Numeric limit for rules that have one; ignored for toggle-only rules. */
  value?: number;
}

export interface BuyAndHoldAutoKillConfig {
  dscrFloor?: AutoKillRuleConfig;
  taxInsShareOfRent?: AutoKillRuleConfig;
  floodNoInsurance?: AutoKillRuleConfig;
  negativeCashflowNoAck?: AutoKillRuleConfig;
}

export interface FixAndFlipAutoKillConfig {
  projectLoss?: AutoKillRuleConfig;
  minNetProfit?: AutoKillRuleConfig;
  rehabContingency?: AutoKillRuleConfig;
  extremeHold?: AutoKillRuleConfig;
}

export interface BrrrrAutoKillConfig {
  refiDscrFloor?: AutoKillRuleConfig;
  negativePostRefiCashflow?: AutoKillRuleConfig;
  rehabContingency?: AutoKillRuleConfig;
  maxCashLeft?: AutoKillRuleConfig;
}

/** Default numeric limits — MUST mirror the engines' historical literals. */
export const AUTOKILL_DEFAULTS = {
  BUY_AND_HOLD: {
    dscrFloor: 1.0,
    taxInsShareOfRent: 0.4,
  },
  FIX_AND_FLIP: {
    minNetProfit: 10_000,
    rehabContingency: 0.1,
    extremeHold: 2,
  },
  BRRRR: {
    refiDscrFloor: 1.0,
    rehabContingency: 0.1,
    maxCashLeft: 10_000,
  },
} as const;

export function ruleEnabled(cfg: AutoKillRuleConfig | undefined): boolean {
  return cfg?.enabled ?? true;
}

export function ruleValue(
  cfg: AutoKillRuleConfig | undefined,
  fallback: number,
): number {
  return cfg?.value ?? fallback;
}
```

- [ ] **Step 4: Export from the grading barrel**

In `packages/analyzer-core/src/grading/index.ts`, after the `./shared/types` export block (line 36), add:

```ts
export {
  AUTOKILL_DEFAULTS,
  ruleEnabled,
  ruleValue,
} from "./shared/autokill-config";
export type {
  AutoKillRuleConfig,
  BuyAndHoldAutoKillConfig,
  BrrrrAutoKillConfig,
  FixAndFlipAutoKillConfig,
} from "./shared/autokill-config";
```

Verify the grading barrel is re-exported from the package root: `packages/analyzer-core/src/index.ts` must contain `export * from "./grading"` (or explicit re-exports — if explicit, add these names there too).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd D:/projects/rei-platform && npx vitest run src/grading/shared/autokill-config.test.ts --root packages/analyzer-core`
Expected: PASS (3 tests).

- [ ] **Step 6: Build + commit**

```bash
cd D:/projects/rei-platform && npm run build -w @propertyiq/analyzer-core
git branch --show-current   # must print: develop
git add packages/analyzer-core/src/grading/shared/autokill-config.ts packages/analyzer-core/src/grading/shared/autokill-config.test.ts packages/analyzer-core/src/grading/index.ts
git commit -m "feat(analyzer-core): auto-kill config types, defaults, resolver" -- packages/analyzer-core/src/grading/shared/autokill-config.ts packages/analyzer-core/src/grading/shared/autokill-config.test.ts packages/analyzer-core/src/grading/index.ts
```

---

### Task 2: analyzer-core — config-driven Buy & Hold auto-kills

**Files:**

- Modify: `packages/analyzer-core/src/grading/buy-and-hold/types.ts` (add `autoKills` to `UserThresholds`)
- Modify: `packages/analyzer-core/src/grading/buy-and-hold/grade-helpers.ts:130-174` (`collectAutoKills`)
- Modify: `packages/analyzer-core/src/grading/buy-and-hold/grade.ts:114-119` (pass config)
- Create: `packages/analyzer-core/src/grading/buy-and-hold/autokill-config.test.ts`

**Interfaces:**

- Consumes: `BuyAndHoldAutoKillConfig`, `AUTOKILL_DEFAULTS`, `ruleEnabled`, `ruleValue` from `../shared/autokill-config` (Task 1).
- Produces: `collectAutoKills(input, context, dscrValue, annualPretaxCashFlow, config?: BuyAndHoldAutoKillConfig)`; `UserThresholds.autoKills?: BuyAndHoldAutoKillConfig`.

- [ ] **Step 1: Write the failing test**

Create `packages/analyzer-core/src/grading/buy-and-hold/autokill-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { DealInput } from "../../types";
import { BUY_AND_HOLD_DEFAULTS } from "./thresholds";
import { gradeBuyAndHoldDeal } from "./grade";

/**
 * Frederick-style failing deal: DSCR < 1.0, negative cash flow, and
 * tax+insurance > 40% of rent — trips 3 of the 4 B&H auto-kills.
 */
const KILLED_DEAL: DealInput = {
  price: 695_000,
  rentMonthly: 3_320,
  taxAnnual: 8_941,
  insuranceAnnual: 3_823,
  financing: {
    downPaymentPct: 0.2,
    interestRatePct: 7.1,
    termYears: 30,
    closingCostsPct: 0.03,
  },
};

const codes = (r: ReturnType<typeof gradeBuyAndHoldDeal>) =>
  r.autoKills.map((k) => k.code).sort();

describe("B&H auto-kill config", () => {
  it("no config is behavior-identical to explicit default config", () => {
    const bare = gradeBuyAndHoldDeal(KILLED_DEAL, {});
    const configured = gradeBuyAndHoldDeal(
      KILLED_DEAL,
      {},
      {
        ...BUY_AND_HOLD_DEFAULTS,
        autoKills: {
          dscrFloor: { enabled: true, value: 1.0 },
          taxInsShareOfRent: { enabled: true, value: 0.4 },
          floodNoInsurance: { enabled: true },
          negativeCashflowNoAck: { enabled: true },
        },
      },
    );
    expect(configured).toEqual(bare);
  });

  it("custom DSCR floor below actual DSCR suppresses DSCR_BELOW_1", () => {
    const r = gradeBuyAndHoldDeal(
      KILLED_DEAL,
      {},
      {
        ...BUY_AND_HOLD_DEFAULTS,
        autoKills: { dscrFloor: { value: 0.1 } },
      },
    );
    expect(codes(r)).not.toContain("DSCR_BELOW_1");
  });

  it("custom DSCR floor message reflects the configured value", () => {
    const r = gradeBuyAndHoldDeal(
      KILLED_DEAL,
      {},
      {
        ...BUY_AND_HOLD_DEFAULTS,
        autoKills: { dscrFloor: { value: 0.85 } },
      },
    );
    const kill = r.autoKills.find((k) => k.code === "DSCR_BELOW_1");
    expect(kill?.message).toContain("0.85");
  });

  it("disabling every rule yields zero auto-kills (letter no longer forced F)", () => {
    const r = gradeBuyAndHoldDeal(
      KILLED_DEAL,
      {},
      {
        ...BUY_AND_HOLD_DEFAULTS,
        autoKills: {
          dscrFloor: { enabled: false },
          taxInsShareOfRent: { enabled: false },
          floodNoInsurance: { enabled: false },
          negativeCashflowNoAck: { enabled: false },
        },
      },
    );
    expect(r.autoKills).toEqual([]);
  });

  it("custom tax+ins share message reflects the configured percent", () => {
    const r = gradeBuyAndHoldDeal(
      KILLED_DEAL,
      {},
      {
        ...BUY_AND_HOLD_DEFAULTS,
        autoKills: { taxInsShareOfRent: { value: 0.25 } },
      },
    );
    const kill = r.autoKills.find((k) => k.code === "TAX_INS_OVER_40");
    expect(kill?.message).toContain("25%");
  });

  it("default message text is byte-identical to the historical literals", () => {
    const r = gradeBuyAndHoldDeal(KILLED_DEAL, {});
    const dscr = r.autoKills.find((k) => k.code === "DSCR_BELOW_1");
    const taxIns = r.autoKills.find((k) => k.code === "TAX_INS_OVER_40");
    expect(dscr?.message).toBe(
      "DSCR below 1.0 — property cannot service its own debt.",
    );
    expect(taxIns?.message).toBe(
      "Taxes + insurance exceed 40% of gross annual rent.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/projects/rei-platform && npx vitest run src/grading/buy-and-hold/autokill-config.test.ts --root packages/analyzer-core`
Expected: FAIL — messages don't reflect config / disabled rules still fire (TS may also fail on the unknown `autoKills` property, which is the point).

- [ ] **Step 3: Extend `UserThresholds`**

In `packages/analyzer-core/src/grading/buy-and-hold/types.ts`, add the import at the top and the field inside `UserThresholds` (after the `weights` block, line 26):

```ts
import type { BuyAndHoldAutoKillConfig } from "../shared/autokill-config";
```

```ts
  /** Optional per-user auto-kill overrides. Absent = engine defaults. */
  autoKills?: BuyAndHoldAutoKillConfig;
```

- [ ] **Step 4: Rewrite `collectAutoKills` config-driven**

In `packages/analyzer-core/src/grading/buy-and-hold/grade-helpers.ts`, add imports:

```ts
import {
  AUTOKILL_DEFAULTS,
  ruleEnabled,
  ruleValue,
  type BuyAndHoldAutoKillConfig,
} from "../shared/autokill-config";
```

Replace the whole `collectAutoKills` function (lines 130-174) with:

```ts
/** "1.00" reads worse than the historical "1.0"; trim ONE trailing zero. */
function formatFloor(value: number): string {
  return value.toFixed(2).replace(/0$/, "");
}

export function collectAutoKills(
  input: DealInput,
  context: GradingContext,
  dscrValue: number,
  annualPretaxCashFlow: number,
  config?: BuyAndHoldAutoKillConfig,
): AutoKillFlag[] {
  const kills: AutoKillFlag[] = [];
  const D = AUTOKILL_DEFAULTS.BUY_AND_HOLD;

  const dscrFloor = ruleValue(config?.dscrFloor, D.dscrFloor);
  if (ruleEnabled(config?.dscrFloor) && dscrValue < dscrFloor) {
    kills.push({
      code: "DSCR_BELOW_1",
      message: `DSCR below ${formatFloor(dscrFloor)} — property cannot service its own debt.`,
    });
  }

  const zone = context.floodZone;
  if (
    ruleEnabled(config?.floodNoInsurance) &&
    (zone === "AE" || zone === "VE" || zone === "A") &&
    !context.floodInsuranceQuoted
  ) {
    kills.push({
      code: "FLOOD_NO_INSURANCE",
      message: `Property in flood zone ${zone} without quoted flood insurance.`,
    });
  }

  const rentMonthly = input.rentMonthly ?? 0;
  const taxIns = (input.taxAnnual ?? 0) + (input.insuranceAnnual ?? 0);
  const taxInsShare = ruleValue(config?.taxInsShareOfRent, D.taxInsShareOfRent);
  if (
    ruleEnabled(config?.taxInsShareOfRent) &&
    taxIns > taxInsShare * rentMonthly * 12
  ) {
    kills.push({
      code: "TAX_INS_OVER_40",
      message: `Taxes + insurance exceed ${Math.round(taxInsShare * 100)}% of gross annual rent.`,
    });
  }

  if (
    ruleEnabled(config?.negativeCashflowNoAck) &&
    annualPretaxCashFlow < 0 &&
    !context.appreciationPlayAccepted
  ) {
    kills.push({
      code: "NEG_CF_NO_APPRECIATION_ACK",
      message:
        "Negative pretax cash flow without an explicit appreciation-play acknowledgment.",
    });
  }

  return kills;
}
```

- [ ] **Step 5: Pass config at the call site**

In `packages/analyzer-core/src/grading/buy-and-hold/grade.ts`, change the call (lines 114-119) to:

```ts
const autoKills = collectAutoKills(
  input,
  context,
  dscrValue,
  annualPretaxCashFlow,
  thresholds.autoKills,
);
```

- [ ] **Step 6: Run the new test + full analyzer-core suite**

Run: `cd D:/projects/rei-platform && npm run test -w @propertyiq/analyzer-core`
Expected: ALL PASS — including the pre-existing `grade.test.ts` (proves default behavior unchanged).

- [ ] **Step 7: Build + commit**

```bash
cd D:/projects/rei-platform && npm run build -w @propertyiq/analyzer-core
git branch --show-current   # develop
git add packages/analyzer-core/src/grading/buy-and-hold
git commit -m "feat(analyzer-core): config-driven buy-and-hold auto-kill rules" -- packages/analyzer-core/src/grading/buy-and-hold
```

---

### Task 3: analyzer-core — config-driven Fix & Flip auto-kills

**Files:**

- Modify: `packages/analyzer-core/src/grading/fix-and-flip/types.ts` (add `autoKills` to `FixAndFlipThresholds`, line 129-142)
- Modify: `packages/analyzer-core/src/grading/fix-and-flip/grade-helpers.ts:66-111` (`collectFlipAutoKills`)
- Modify: `packages/analyzer-core/src/grading/fix-and-flip/grade.ts:138` (pass config)
- Create: `packages/analyzer-core/src/grading/fix-and-flip/autokill-config.test.ts`

**Interfaces:**

- Consumes: `FixAndFlipAutoKillConfig`, `AUTOKILL_DEFAULTS`, `ruleEnabled`, `ruleValue` (Task 1).
- Produces: `collectFlipAutoKills(input, context, config?: FixAndFlipAutoKillConfig)`; `FixAndFlipThresholds.autoKills?: FixAndFlipAutoKillConfig`.

- [ ] **Step 1: Write the failing test**

Create `packages/analyzer-core/src/grading/fix-and-flip/autokill-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { FIX_AND_FLIP_DEFAULTS } from "./thresholds";
import type { FixAndFlipThresholds } from "./types";
import { gradeFixAndFlipDeal } from "./grade";
import type { FixAndFlipInput } from "./types";

/** Thin-profit flip: profit > 0 but < $10k — trips PROFIT_BELOW_FLOOR only. */
const THIN_FLIP: FixAndFlipInput = {
  price: 200_000,
  arv: 260_000,
  rehabBudget: 30_000,
  holdingMonths: 6,
  sellingCostsPct: 0.07,
  financingType: "cash",
};

const withAutoKills = (
  autoKills: FixAndFlipThresholds["autoKills"],
): FixAndFlipThresholds => ({ ...FIX_AND_FLIP_DEFAULTS, autoKills });

describe("F&F auto-kill config", () => {
  it("no config equals explicit default config", () => {
    const bare = gradeFixAndFlipDeal(THIN_FLIP, {});
    const configured = gradeFixAndFlipDeal(
      THIN_FLIP,
      {},
      withAutoKills({
        projectLoss: { enabled: true },
        minNetProfit: { enabled: true, value: 10_000 },
        rehabContingency: { enabled: true, value: 0.1 },
        extremeHold: { enabled: true, value: 2 },
      }),
    );
    expect(configured).toEqual(bare);
  });

  it("lower minNetProfit floor clears PROFIT_BELOW_FLOOR", () => {
    const bare = gradeFixAndFlipDeal(THIN_FLIP, {});
    expect(bare.autoKills.map((k) => k.code)).toContain("PROFIT_BELOW_FLOOR");

    const r = gradeFixAndFlipDeal(
      THIN_FLIP,
      {},
      withAutoKills({ minNetProfit: { value: 0 } }),
    );
    expect(r.autoKills.map((k) => k.code)).not.toContain("PROFIT_BELOW_FLOOR");
  });

  it("config value takes precedence over context.minimumNetProfit", () => {
    const r = gradeFixAndFlipDeal(
      THIN_FLIP,
      { minimumNetProfit: 50_000 },
      withAutoKills({ minNetProfit: { value: 0 } }),
    );
    expect(r.autoKills.map((k) => k.code)).not.toContain("PROFIT_BELOW_FLOOR");
  });

  it("disabling minNetProfit suppresses the kill entirely", () => {
    const r = gradeFixAndFlipDeal(
      THIN_FLIP,
      {},
      withAutoKills({ minNetProfit: { enabled: false } }),
    );
    expect(r.autoKills.map((k) => k.code)).not.toContain("PROFIT_BELOW_FLOOR");
  });
});
```

If `THIN_FLIP` doesn't produce a positive-but-below-10k profit at these numbers, adjust `rehabBudget` up/down until `PROJECT_LOSS` is absent and `PROFIT_BELOW_FLOOR` fires in the first bare run (the first assertion of the second test pins this).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/projects/rei-platform && npx vitest run src/grading/fix-and-flip/autokill-config.test.ts --root packages/analyzer-core`
Expected: FAIL (TS: unknown `autoKills` property / config ignored).

- [ ] **Step 3: Extend `FixAndFlipThresholds`**

In `packages/analyzer-core/src/grading/fix-and-flip/types.ts`, add the import and field inside `FixAndFlipThresholds` (after `weights`, line 141):

```ts
import type { FixAndFlipAutoKillConfig } from "../shared/autokill-config";
```

```ts
  /** Optional per-user auto-kill overrides. Absent = engine defaults. */
  autoKills?: FixAndFlipAutoKillConfig;
```

- [ ] **Step 4: Rewrite `collectFlipAutoKills` config-driven**

In `packages/analyzer-core/src/grading/fix-and-flip/grade-helpers.ts`, add imports:

```ts
import {
  AUTOKILL_DEFAULTS,
  ruleEnabled,
  ruleValue,
  type FixAndFlipAutoKillConfig,
} from "../shared/autokill-config";
```

Delete the `const DEFAULT_MIN_NET_PROFIT = 10_000;` constant (line 27 — now lives in `AUTOKILL_DEFAULTS`). Keep `DEFAULT_MARKET_AVG_RATE_PCT`. Replace `collectFlipAutoKills` (lines 66-111) with:

```ts
export function collectFlipAutoKills(
  input: FixAndFlipInput,
  context: FixAndFlipContext,
  config?: FixAndFlipAutoKillConfig,
): AutoKillFlag[] {
  const kills: AutoKillFlag[] = [];
  const D = AUTOKILL_DEFAULTS.FIX_AND_FLIP;
  const profit = netProfit(input);
  // Config wins over the per-request context override, which wins over default.
  const minProfit = ruleValue(
    config?.minNetProfit,
    context.minimumNetProfit ?? D.minNetProfit,
  );

  if (ruleEnabled(config?.projectLoss) && profit < 0) {
    kills.push({
      code: "PROJECT_LOSS",
      message: `Projected net loss of ${formatDollars(profit)} — exit does not cover total project costs.`,
    });
  } else if (
    ruleEnabled(config?.minNetProfit) &&
    profit >= 0 &&
    profit < minProfit
  ) {
    kills.push({
      code: "PROFIT_BELOW_FLOOR",
      message: `Projected profit ${formatDollars(profit)} is below the ${formatDollars(minProfit)} minimum-profit floor.`,
    });
  }

  // Rehab unverified + insufficient contingency = high blow-up risk.
  const contingencyFloor = ruleValue(
    config?.rehabContingency,
    D.rehabContingency,
  );
  if (
    ruleEnabled(config?.rehabContingency) &&
    context.rehabVerification === "estimate" &&
    effectiveContingencyPct(input) < contingencyFloor &&
    !context.rehabRiskAccepted
  ) {
    kills.push({
      code: "REHAB_UNVERIFIED_NO_CONTINGENCY",
      message: `Rehab is an estimate (not a contractor bid or itemized scope) and contingency is below ${Math.round(contingencyFloor * 100)}% — high risk of cost overruns.`,
    });
  }

  // Hold materially longer than market DOM signals an illiquid exit.
  const domMultiple = ruleValue(config?.extremeHold, D.extremeHold);
  if (
    ruleEnabled(config?.extremeHold) &&
    context.marketDomDays != null &&
    !context.extendedHoldAccepted
  ) {
    const holdDays = effectiveHoldMonths(input) * 30;
    if (holdDays > context.marketDomDays * domMultiple) {
      kills.push({
        code: "EXTREME_HOLD",
        message: `Planned hold of ${Math.round(holdDays)} days is more than ${domMultiple}× market DOM (${context.marketDomDays}) — exit liquidity is suspect.`,
      });
    }
  }

  return kills;
}
```

**Behavior-preservation caveats:** the original code had `if (profit < 0) {...} else if (profit < minProfit)`. The rewrite keeps `PROJECT_LOSS` and `PROFIT_BELOW_FLOOR` mutually exclusive AND makes a disabled `projectLoss` NOT let a losing deal fall through into `PROFIT_BELOW_FLOOR` with a negative profit — that's why the `else if` also guards `profit >= 0`. Default messages: `2× market DOM` renders identically (`${2}×` → `2×`) and `below 10%` (`Math.round(0.1*100)` → `10`) — both byte-identical.

- [ ] **Step 5: Pass config at the call site**

In `packages/analyzer-core/src/grading/fix-and-flip/grade.ts` line 138:

```ts
const autoKills = collectFlipAutoKills(input, context, thresholds.autoKills);
```

(The `thresholds` parameter is already in scope in `gradeFixAndFlipDeal` — confirm its parameter name and use it.)

- [ ] **Step 6: Run full analyzer-core suite**

Run: `cd D:/projects/rei-platform && npm run test -w @propertyiq/analyzer-core`
Expected: ALL PASS.

- [ ] **Step 7: Build + commit**

```bash
cd D:/projects/rei-platform && npm run build -w @propertyiq/analyzer-core
git branch --show-current   # develop
git add packages/analyzer-core/src/grading/fix-and-flip
git commit -m "feat(analyzer-core): config-driven fix-and-flip auto-kill rules" -- packages/analyzer-core/src/grading/fix-and-flip
```

---

### Task 4: analyzer-core — config-driven BRRRR auto-kills

**Files:**

- Modify: `packages/analyzer-core/src/grading/brrrr/types.ts` (add `autoKills` to `BrrrrThresholds`, line 104-117)
- Modify: `packages/analyzer-core/src/grading/brrrr/grade-helpers.ts:76-128` (`collectBrrrrAutoKills`)
- Modify: `packages/analyzer-core/src/grading/brrrr/grade.ts:149` (pass config)
- Create: `packages/analyzer-core/src/grading/brrrr/autokill-config.test.ts`

**Interfaces:**

- Consumes: `BrrrrAutoKillConfig`, `AUTOKILL_DEFAULTS`, `ruleEnabled`, `ruleValue` (Task 1).
- Produces: `collectBrrrrAutoKills(input, context, config?: BrrrrAutoKillConfig)`; `BrrrrThresholds.autoKills?: BrrrrAutoKillConfig`.

- [ ] **Step 1: Write the failing test**

Create `packages/analyzer-core/src/grading/brrrr/autokill-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BRRRR_DEFAULTS } from "./thresholds";
import type { BrrrrGradingInput, BrrrrThresholds } from "./types";
import { gradeBrrrrDeal } from "./grade";

/** Weak BRRRR: low rent vs refi debt → post-refi DSCR < 1 + negative CF. */
const WEAK_BRRRR: BrrrrGradingInput = {
  purchasePrice: 200_000,
  arv: 280_000,
  rehabCost: 40_000,
  holdMonthsBeforeRefi: 6,
  initialFinancingType: "cash",
  propertyTaxAnnual: 3_600,
  insuranceAnnual: 1_800,
  refiLtvPct: 0.75,
  refiRate: 7.5,
  refiTermYears: 30,
  monthlyRent: 1_200,
};

const withAutoKills = (
  autoKills: BrrrrThresholds["autoKills"],
): BrrrrThresholds => ({ ...BRRRR_DEFAULTS, autoKills });

describe("BRRRR auto-kill config", () => {
  it("no config equals explicit default config", () => {
    const bare = gradeBrrrrDeal(WEAK_BRRRR, {});
    const configured = gradeBrrrrDeal(
      WEAK_BRRRR,
      {},
      withAutoKills({
        refiDscrFloor: { enabled: true, value: 1.0 },
        negativePostRefiCashflow: { enabled: true },
        rehabContingency: { enabled: true, value: 0.1 },
        maxCashLeft: { enabled: true, value: 10_000 },
      }),
    );
    expect(configured).toEqual(bare);
  });

  it("bare run trips the refi-financeability kill (fixture sanity)", () => {
    const bare = gradeBrrrrDeal(WEAK_BRRRR, {});
    expect(bare.autoKills.map((k) => k.code)).toContain("REFI_NOT_FINANCEABLE");
  });

  it("lower refi DSCR floor suppresses REFI_NOT_FINANCEABLE", () => {
    const r = gradeBrrrrDeal(
      WEAK_BRRRR,
      {},
      withAutoKills({ refiDscrFloor: { value: 0.1 } }),
    );
    expect(r.autoKills.map((k) => k.code)).not.toContain(
      "REFI_NOT_FINANCEABLE",
    );
  });

  it("disabling all four rules yields zero auto-kills", () => {
    const r = gradeBrrrrDeal(
      WEAK_BRRRR,
      {},
      withAutoKills({
        refiDscrFloor: { enabled: false },
        negativePostRefiCashflow: { enabled: false },
        rehabContingency: { enabled: false },
        maxCashLeft: { enabled: false },
      }),
    );
    expect(r.autoKills).toEqual([]);
  });

  it("config maxCashLeft wins over context.maximumCashToLeave", () => {
    const r = gradeBrrrrDeal(
      WEAK_BRRRR,
      { maximumCashToLeave: 1 },
      withAutoKills({ maxCashLeft: { value: 10_000_000 } }),
    );
    expect(r.autoKills.map((k) => k.code)).not.toContain(
      "CASH_LEFT_EXCEEDS_MAXIMUM",
    );
  });
});
```

If the fixture doesn't trip `REFI_NOT_FINANCEABLE` at these numbers, lower `monthlyRent` until the sanity test passes in the bare run.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/projects/rei-platform && npx vitest run src/grading/brrrr/autokill-config.test.ts --root packages/analyzer-core`
Expected: FAIL.

- [ ] **Step 3: Extend `BrrrrThresholds`**

In `packages/analyzer-core/src/grading/brrrr/types.ts`, add after `weights` (line 116):

```ts
  /** Optional per-user auto-kill overrides. Absent = engine defaults. */
  autoKills?: import("../shared/autokill-config").BrrrrAutoKillConfig;
```

(Inline `import()` type matches this file's existing style for `MetricThreshold`.)

- [ ] **Step 4: Rewrite `collectBrrrrAutoKills` config-driven**

In `packages/analyzer-core/src/grading/brrrr/grade-helpers.ts`, add imports:

```ts
import {
  AUTOKILL_DEFAULTS,
  ruleEnabled,
  ruleValue,
  type BrrrrAutoKillConfig,
} from "../shared/autokill-config";
```

Delete `const DEFAULT_MAX_CASH_TO_LEAVE = 10_000;` (line 29). Replace `collectBrrrrAutoKills` (lines 76-128) with:

```ts
/** "1.00" reads worse than the historical "1.0"; trim ONE trailing zero. */
function formatFloor(value: number): string {
  return value.toFixed(2).replace(/0$/, "");
}

export function collectBrrrrAutoKills(
  input: BrrrrGradingInput,
  context: BrrrrContext,
  config?: BrrrrAutoKillConfig,
): AutoKillFlag[] {
  const kills: AutoKillFlag[] = [];
  const D = AUTOKILL_DEFAULTS.BRRRR;

  // REFI_NOT_FINANCEABLE — lenders cap conventional refi at DSCR ≥ 1.0 (some
  // even 1.1+). Below that, the refi simply doesn't close and BRRRR breaks.
  const dscr = postRefiDSCR(input);
  const refiFloor = ruleValue(config?.refiDscrFloor, D.refiDscrFloor);
  if (
    ruleEnabled(config?.refiDscrFloor) &&
    dscr < refiFloor &&
    !context.negativeCashFlowAccepted
  ) {
    kills.push({
      code: "REFI_NOT_FINANCEABLE",
      message: `Post-refi DSCR of ${formatRatio(dscr)} is below ${formatFloor(refiFloor)} — most lenders will not refinance this deal.`,
    });
  }

  // NEGATIVE_POST_REFI_CASHFLOW — even if the refi closes, bleeding cash month
  // after month makes the long-term hold untenable.
  const monthlyCF = postRefiCashFlowMonthly(input);
  if (
    ruleEnabled(config?.negativePostRefiCashflow) &&
    monthlyCF < 0 &&
    !context.negativeCashFlowAccepted
  ) {
    kills.push({
      code: "NEGATIVE_POST_REFI_CASHFLOW",
      message: `Post-refi cash flow of ${formatDollars(monthlyCF)}/mo is negative — long-term hold is unsustainable.`,
    });
  }

  // REHAB_UNVERIFIED_NO_CONTINGENCY — BRRRR rehabs are heavier than F&F (full
  // gut, not paint-and-flooring), so contingency discipline matters MORE.
  const contingencyFloor = ruleValue(
    config?.rehabContingency,
    D.rehabContingency,
  );
  if (
    ruleEnabled(config?.rehabContingency) &&
    context.rehabVerification === "estimate" &&
    effectiveContingencyPct(input) < contingencyFloor &&
    !context.rehabRiskAccepted
  ) {
    kills.push({
      code: "REHAB_UNVERIFIED_NO_CONTINGENCY",
      message: `Rehab is an estimate (not a contractor bid or itemized scope) and contingency is below ${Math.round(contingencyFloor * 100)}% — high risk of cost overruns invalidating the refi appraisal.`,
    });
  }

  // CASH_LEFT_EXCEEDS_MAXIMUM — capital trapping. Config wins over the
  // per-request context override, which wins over the default.
  const left = cashLeftInDeal(input);
  const maxLeft = ruleValue(
    config?.maxCashLeft,
    context.maximumCashToLeave ?? D.maxCashLeft,
  );
  if (
    ruleEnabled(config?.maxCashLeft) &&
    left > maxLeft &&
    !context.capitalTrappingAccepted
  ) {
    kills.push({
      code: "CASH_LEFT_EXCEEDS_MAXIMUM",
      message: `Cash left in deal (${formatDollars(left)}) exceeds the ${formatDollars(maxLeft)} maximum — capital recovery objective is missed.`,
    });
  }

  return kills;
}
```

**Message caveat:** the original REFI message hardcoded "below 1.0"; `formatFloor(1.0)` renders "1.0" so the default is byte-identical. The rehab message's "below 10%" → `Math.round(0.1*100)` = "10" — identical.

- [ ] **Step 5: Pass config at the call site**

In `packages/analyzer-core/src/grading/brrrr/grade.ts` line 149:

```ts
const autoKills = collectBrrrrAutoKills(input, context, thresholds.autoKills);
```

(Confirm the in-scope thresholds parameter name in `gradeBrrrrDeal` and use it.)

- [ ] **Step 6: Run full analyzer-core suite**

Run: `cd D:/projects/rei-platform && npm run test -w @propertyiq/analyzer-core`
Expected: ALL PASS.

- [ ] **Step 7: Build + commit**

```bash
cd D:/projects/rei-platform && npm run build -w @propertyiq/analyzer-core
git branch --show-current   # develop
git add packages/analyzer-core/src/grading/brrrr
git commit -m "feat(analyzer-core): config-driven brrrr auto-kill rules" -- packages/analyzer-core/src/grading/brrrr
```

---

### Task 5: backend — auto-kill DTO validation on the thresholds endpoints

**Files:**

- Create: `packages/backend/src/analyzer/dto/auto-kill-config.dto.ts`
- Create: `packages/backend/src/analyzer/dto/auto-kill-config.dto.spec.ts`
- Modify: `packages/backend/src/analyzer/dto/user-thresholds.dto.ts` (add optional field to `UserThresholdsDto`, line 94-119)
- Modify: `packages/backend/src/analyzer/dto/fix-and-flip-thresholds.dto.ts` (add optional field to its top-level DTO class)
- Modify: `packages/backend/src/analyzer/dto/brrrr-thresholds.dto.ts` (add optional field to its top-level DTO class)

**Interfaces:**

- Consumes: nothing from earlier tasks at runtime (pure validation shapes mirroring Task 1's config interfaces).
- Produces: `BuyAndHoldAutoKillsDto`, `FixAndFlipAutoKillsDto`, `BrrrrAutoKillsDto`; each strategy thresholds DTO gains `autoKills?: <StrategyAutoKillsDto>`.

**Why this matters even though unknown keys already pass through:** `ThresholdsController.validateThresholdsForStrategy` runs `validateSync` with `whitelist: false`, so an `autoKills` block already round-trips unvalidated. This task makes out-of-bounds values a 400 instead of silently persisted garbage.

- [ ] **Step 1: Write the failing test**

Create `packages/backend/src/analyzer/dto/auto-kill-config.dto.spec.ts`:

```ts
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import {
  BrrrrAutoKillsDto,
  BuyAndHoldAutoKillsDto,
  FixAndFlipAutoKillsDto,
} from "./auto-kill-config.dto";

const errorsFor = (cls: new () => object, body: object) =>
  validateSync(plainToInstance(cls, body));

describe("auto-kill config DTOs", () => {
  it("accepts a full valid B&H block", () => {
    expect(
      errorsFor(BuyAndHoldAutoKillsDto, {
        dscrFloor: { enabled: true, value: 0.9 },
        taxInsShareOfRent: { enabled: false, value: 0.5 },
        floodNoInsurance: { enabled: false },
        negativeCashflowNoAck: {},
      }),
    ).toHaveLength(0);
  });

  it("accepts an empty block and partial blocks", () => {
    expect(errorsFor(BuyAndHoldAutoKillsDto, {})).toHaveLength(0);
    expect(
      errorsFor(FixAndFlipAutoKillsDto, { minNetProfit: { value: 5000 } }),
    ).toHaveLength(0);
  });

  it("rejects DSCR floor outside 0.3-2.0", () => {
    expect(
      errorsFor(BuyAndHoldAutoKillsDto, { dscrFloor: { value: 0.1 } }).length,
    ).toBeGreaterThan(0);
    expect(
      errorsFor(BrrrrAutoKillsDto, { refiDscrFloor: { value: 2.5 } }).length,
    ).toBeGreaterThan(0);
  });

  it("rejects share outside 0.05-1.0", () => {
    expect(
      errorsFor(BuyAndHoldAutoKillsDto, {
        taxInsShareOfRent: { value: 0.01 },
      }).length,
    ).toBeGreaterThan(0);
  });

  it("rejects dollars outside 0-500000 and multiplier outside 1-10", () => {
    expect(
      errorsFor(FixAndFlipAutoKillsDto, {
        minNetProfit: { value: 600_000 },
      }).length,
    ).toBeGreaterThan(0);
    expect(
      errorsFor(FixAndFlipAutoKillsDto, { extremeHold: { value: 0.5 } }).length,
    ).toBeGreaterThan(0);
  });

  it("rejects non-boolean enabled", () => {
    expect(
      errorsFor(BuyAndHoldAutoKillsDto, {
        dscrFloor: { enabled: "yes" },
      }).length,
    ).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/projects/rei-platform/packages/backend && npx jest src/analyzer/dto/auto-kill-config.dto.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the DTO**

Create `packages/backend/src/analyzer/dto/auto-kill-config.dto.ts`:

```ts
/**
 * Validation DTOs for the optional `autoKills` block on user thresholds.
 * Mirrors the *AutoKillConfig shapes in @propertyiq/analyzer-core.
 *
 * Bounds (shared with the frontend drawer validators):
 *   DSCR floors 0.3-2.0 · shares 0.05-1.0 · dollars 0-500 000 · DOM multiple 1-10
 */
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

class ToggleRuleDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
}

class DscrFloorRuleDto extends ToggleRuleDto {
  @IsOptional() @IsNumber(NUM_OPTS) @Min(0.3) @Max(2) value?: number;
}

class ShareRuleDto extends ToggleRuleDto {
  @IsOptional() @IsNumber(NUM_OPTS) @Min(0.05) @Max(1) value?: number;
}

class DollarsRuleDto extends ToggleRuleDto {
  @IsOptional() @IsNumber(NUM_OPTS) @Min(0) @Max(500_000) value?: number;
}

class MultiplierRuleDto extends ToggleRuleDto {
  @IsOptional() @IsNumber(NUM_OPTS) @Min(1) @Max(10) value?: number;
}

export class BuyAndHoldAutoKillsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DscrFloorRuleDto)
  dscrFloor?: DscrFloorRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShareRuleDto)
  taxInsShareOfRent?: ShareRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ToggleRuleDto)
  floodNoInsurance?: ToggleRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ToggleRuleDto)
  negativeCashflowNoAck?: ToggleRuleDto;
}

export class FixAndFlipAutoKillsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ToggleRuleDto)
  projectLoss?: ToggleRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DollarsRuleDto)
  minNetProfit?: DollarsRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShareRuleDto)
  rehabContingency?: ShareRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MultiplierRuleDto)
  extremeHold?: MultiplierRuleDto;
}

export class BrrrrAutoKillsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DscrFloorRuleDto)
  refiDscrFloor?: DscrFloorRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ToggleRuleDto)
  negativePostRefiCashflow?: ToggleRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShareRuleDto)
  rehabContingency?: ShareRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DollarsRuleDto)
  maxCashLeft?: DollarsRuleDto;
}
```

- [ ] **Step 4: Wire into the three strategy thresholds DTOs**

In `packages/backend/src/analyzer/dto/user-thresholds.dto.ts`, add to imports: `IsOptional` from `class-validator`, and:

```ts
import { BuyAndHoldAutoKillsDto } from "./auto-kill-config.dto";
```

Add as the last field of `class UserThresholdsDto`:

```ts
  @IsOptional()
  @ValidateNested()
  @Type(() => BuyAndHoldAutoKillsDto)
  autoKills?: BuyAndHoldAutoKillsDto;
```

In `packages/backend/src/analyzer/dto/fix-and-flip-thresholds.dto.ts`, same pattern on its top-level thresholds class (read the file first to get the class name — it mirrors `UserThresholdsDto`):

```ts
  @IsOptional()
  @ValidateNested()
  @Type(() => FixAndFlipAutoKillsDto)
  autoKills?: FixAndFlipAutoKillsDto;
```

In `packages/backend/src/analyzer/dto/brrrr-thresholds.dto.ts`, same:

```ts
  @IsOptional()
  @ValidateNested()
  @Type(() => BrrrrAutoKillsDto)
  autoKills?: BrrrrAutoKillsDto;
```

Add the matching imports (`IsOptional` if absent, the DTO class) to both files.

- [ ] **Step 5: Run tests + backend build**

Run: `cd D:/projects/rei-platform/packages/backend && npx jest src/analyzer/dto/auto-kill-config.dto.spec.ts && npm run build -w backend --prefix D:/projects/rei-platform`
Expected: jest PASS; `nest build` clean (zero errors — fix any that appear).

- [ ] **Step 6: Commit**

```bash
cd D:/projects/rei-platform && git branch --show-current   # develop
git add packages/backend/src/analyzer/dto/auto-kill-config.dto.ts packages/backend/src/analyzer/dto/auto-kill-config.dto.spec.ts packages/backend/src/analyzer/dto/user-thresholds.dto.ts packages/backend/src/analyzer/dto/fix-and-flip-thresholds.dto.ts packages/backend/src/analyzer/dto/brrrr-thresholds.dto.ts
git commit -m "feat(backend): validate optional autoKills block on thresholds DTOs" -- packages/backend/src/analyzer/dto
```

---

### Task 6: frontend — auto-kill row metadata + validation helpers

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer/autokill-rows.ts`
- Create: `packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer/__tests__/autokill-rows.test.ts`

**Interfaces:**

- Consumes: `AUTOKILL_DEFAULTS`, `AutoKillRuleConfig`, `Strategy` from `@propertyiq/analyzer-core` (Task 1; requires the Task 1 build).
- Produces:
  - `interface AutoKillRowMeta { key: string; label: string; description: string; unit: "ratio" | "percent" | "dollars" | "multiplier" | null; defaultValue: number | null; min?: number; max?: number; }`
  - `autoKillRowsForStrategy(strategy: Strategy): AutoKillRowMeta[]`
  - `getAutoKillConfig(thresholds: object | null): Record<string, AutoKillRuleConfig>`
  - `validateAutoKills(strategy: Strategy, config: Record<string, AutoKillRuleConfig> | undefined): Record<string, string | null>`
  - `hasAnyAutoKillError(errors: Record<string, string | null>): boolean`

- [ ] **Step 1: Write the failing test**

Create `__tests__/autokill-rows.test.ts` (same directory conventions as `__tests__/validators.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import {
  autoKillRowsForStrategy,
  getAutoKillConfig,
  hasAnyAutoKillError,
  validateAutoKills,
} from "../autokill-rows";

describe("autoKillRowsForStrategy", () => {
  it("returns 4 rows per strategy with stable keys", () => {
    expect(autoKillRowsForStrategy("BUY_AND_HOLD").map((r) => r.key)).toEqual([
      "dscrFloor",
      "taxInsShareOfRent",
      "floodNoInsurance",
      "negativeCashflowNoAck",
    ]);
    expect(autoKillRowsForStrategy("FIX_AND_FLIP").map((r) => r.key)).toEqual([
      "projectLoss",
      "minNetProfit",
      "rehabContingency",
      "extremeHold",
    ]);
    expect(autoKillRowsForStrategy("BRRRR").map((r) => r.key)).toEqual([
      "refiDscrFloor",
      "negativePostRefiCashflow",
      "rehabContingency",
      "maxCashLeft",
    ]);
  });

  it("numeric rows carry engine defaults; toggle-only rows carry null", () => {
    const bh = autoKillRowsForStrategy("BUY_AND_HOLD");
    expect(bh.find((r) => r.key === "dscrFloor")?.defaultValue).toBe(1.0);
    expect(bh.find((r) => r.key === "floodNoInsurance")?.defaultValue).toBe(
      null,
    );
  });
});

describe("getAutoKillConfig", () => {
  it("returns {} for null or missing block", () => {
    expect(getAutoKillConfig(null)).toEqual({});
    expect(getAutoKillConfig({ weights: {} })).toEqual({});
  });
  it("returns the block when present", () => {
    expect(
      getAutoKillConfig({ autoKills: { dscrFloor: { value: 0.9 } } }),
    ).toEqual({ dscrFloor: { value: 0.9 } });
  });
});

describe("validateAutoKills", () => {
  it("passes an empty config", () => {
    const errs = validateAutoKills("BUY_AND_HOLD", undefined);
    expect(hasAnyAutoKillError(errs)).toBe(false);
  });
  it("flags out-of-bounds values with the row bounds", () => {
    const errs = validateAutoKills("BUY_AND_HOLD", {
      dscrFloor: { value: 0.1 },
    });
    expect(errs.dscrFloor).toMatch(/0\.3/);
    expect(hasAnyAutoKillError(errs)).toBe(true);
  });
  it("accepts in-bounds values and toggle-only rules", () => {
    const errs = validateAutoKills("FIX_AND_FLIP", {
      minNetProfit: { value: 5_000 },
      projectLoss: { enabled: false },
    });
    expect(hasAnyAutoKillError(errs)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/projects/rei-platform/packages/frontend && npx vitest run "app/(app)/analyzer/components/CustomizeThresholdsDrawer/__tests__/autokill-rows.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `autokill-rows.ts`:

```ts
/**
 * Auto-Kill tab metadata + validation — mirrors the engine's rule inventory
 * (analyzer-core shared/autokill-config.ts) and the backend DTO bounds
 * (auto-kill-config.dto.ts). Keys are the persisted JSONB keys; do not rename.
 *
 * Bounds: DSCR 0.3-2.0 · shares 0.05-1.0 · dollars 0-500 000 · multiplier 1-10
 */
import {
  AUTOKILL_DEFAULTS,
  type AutoKillRuleConfig,
  type Strategy,
} from "@propertyiq/analyzer-core";

export interface AutoKillRowMeta {
  key: string;
  label: string;
  description: string;
  /** null = toggle-only rule (no numeric limit). */
  unit: "ratio" | "percent" | "dollars" | "multiplier" | null;
  defaultValue: number | null;
  min?: number;
  max?: number;
}

const BH_ROWS: AutoKillRowMeta[] = [
  {
    key: "dscrFloor",
    label: "DSCR floor",
    description: "Kills the deal when DSCR falls below this value.",
    unit: "ratio",
    defaultValue: AUTOKILL_DEFAULTS.BUY_AND_HOLD.dscrFloor,
    min: 0.3,
    max: 2,
  },
  {
    key: "taxInsShareOfRent",
    label: "Tax + insurance share of rent",
    description:
      "Kills when taxes + insurance exceed this share of gross annual rent.",
    unit: "percent",
    defaultValue: AUTOKILL_DEFAULTS.BUY_AND_HOLD.taxInsShareOfRent,
    min: 0.05,
    max: 1,
  },
  {
    key: "floodNoInsurance",
    label: "Flood zone without insurance",
    description:
      "Kills when the property sits in flood zone AE/VE/A with no flood insurance quoted.",
    unit: null,
    defaultValue: null,
  },
  {
    key: "negativeCashflowNoAck",
    label: "Negative cash flow",
    description:
      "Kills on negative pretax cash flow unless you accept the deal as an appreciation play.",
    unit: null,
    defaultValue: null,
  },
];

const FF_ROWS: AutoKillRowMeta[] = [
  {
    key: "projectLoss",
    label: "Projected loss",
    description: "Kills any flip whose exit doesn't cover total project costs.",
    unit: null,
    defaultValue: null,
  },
  {
    key: "minNetProfit",
    label: "Minimum net profit",
    description: "Kills when projected profit lands below this floor.",
    unit: "dollars",
    defaultValue: AUTOKILL_DEFAULTS.FIX_AND_FLIP.minNetProfit,
    min: 0,
    max: 500_000,
  },
  {
    key: "rehabContingency",
    label: "Rehab contingency floor",
    description:
      "Kills estimate-based rehabs whose contingency sits below this share.",
    unit: "percent",
    defaultValue: AUTOKILL_DEFAULTS.FIX_AND_FLIP.rehabContingency,
    min: 0.05,
    max: 1,
  },
  {
    key: "extremeHold",
    label: "Extreme hold (× market DOM)",
    description:
      "Kills when the planned hold exceeds this multiple of market days-on-market.",
    unit: "multiplier",
    defaultValue: AUTOKILL_DEFAULTS.FIX_AND_FLIP.extremeHold,
    min: 1,
    max: 10,
  },
];

const BRRRR_ROWS: AutoKillRowMeta[] = [
  {
    key: "refiDscrFloor",
    label: "Post-refi DSCR floor",
    description: "Kills when post-refi DSCR falls below this value.",
    unit: "ratio",
    defaultValue: AUTOKILL_DEFAULTS.BRRRR.refiDscrFloor,
    min: 0.3,
    max: 2,
  },
  {
    key: "negativePostRefiCashflow",
    label: "Negative post-refi cash flow",
    description: "Kills when the post-refi hold bleeds cash monthly.",
    unit: null,
    defaultValue: null,
  },
  {
    key: "rehabContingency",
    label: "Rehab contingency floor",
    description:
      "Kills estimate-based rehabs whose contingency sits below this share.",
    unit: "percent",
    defaultValue: AUTOKILL_DEFAULTS.BRRRR.rehabContingency,
    min: 0.05,
    max: 1,
  },
  {
    key: "maxCashLeft",
    label: "Max cash left in deal",
    description: "Kills when cash trapped after the refi exceeds this amount.",
    unit: "dollars",
    defaultValue: AUTOKILL_DEFAULTS.BRRRR.maxCashLeft,
    min: 0,
    max: 500_000,
  },
];

const ROWS_BY_STRATEGY: Record<Strategy, AutoKillRowMeta[]> = {
  BUY_AND_HOLD: BH_ROWS,
  FIX_AND_FLIP: FF_ROWS,
  BRRRR: BRRRR_ROWS,
};

export function autoKillRowsForStrategy(strategy: Strategy): AutoKillRowMeta[] {
  return ROWS_BY_STRATEGY[strategy] ?? BH_ROWS;
}

/** Extract the autoKills block from an opaque thresholds object. */
export function getAutoKillConfig(
  thresholds: object | null,
): Record<string, AutoKillRuleConfig> {
  const block = (thresholds as { autoKills?: unknown } | null)?.autoKills;
  return block && typeof block === "object"
    ? (block as Record<string, AutoKillRuleConfig>)
    : {};
}

const fmtBound = (row: AutoKillRowMeta, v: number): string =>
  row.unit === "percent" ? `${Math.round(v * 100)}%` : String(v);

export function validateAutoKills(
  strategy: Strategy,
  config: Record<string, AutoKillRuleConfig> | undefined,
): Record<string, string | null> {
  const errors: Record<string, string | null> = {};
  for (const row of autoKillRowsForStrategy(strategy)) {
    const value = config?.[row.key]?.value;
    if (
      row.unit != null &&
      value != null &&
      (value < (row.min ?? -Infinity) || value > (row.max ?? Infinity))
    ) {
      errors[row.key] =
        `Must be between ${fmtBound(row, row.min ?? 0)} and ${fmtBound(row, row.max ?? 0)}`;
    } else {
      errors[row.key] = null;
    }
  }
  return errors;
}

export function hasAnyAutoKillError(
  errors: Record<string, string | null>,
): boolean {
  return Object.values(errors).some((e) => e != null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/projects/rei-platform/packages/frontend && npx vitest run "app/(app)/analyzer/components/CustomizeThresholdsDrawer/__tests__/autokill-rows.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd D:/projects/rei-platform && git branch --show-current   # develop
git add "packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer/autokill-rows.ts" "packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer/__tests__/autokill-rows.test.ts"
git commit -m "feat(analyzer): auto-kill row metadata + validation for customize drawer" -- "packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer/autokill-rows.ts" "packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer/__tests__/autokill-rows.test.ts"
```

---

### Task 7: frontend — AutoKillTab component + drawer/state integration

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer/AutoKillTab.tsx`
- Create: `packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer/__tests__/AutoKillTab.test.tsx`
- Modify: `packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer/useDrawerState.ts` (tab id union line 39, autoKill errors, canSave line 127-134, applyPreset line 169-174)
- Modify: `packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer/preset-helpers.ts` (`detectActivePreset` line 191-204)
- Modify: `packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer/CustomizeThresholdsDrawer.tsx` (TABS line 41-45, tabpanel line 199-229, `initialTab` prop)

**Interfaces:**

- Consumes: everything from Task 6; `AnyStrategyThresholds` from `./preset-helpers`.
- Produces:
  - `AutoKillTab({ strategy, thresholds, onChange, errors })` — same parent-owns-state contract as `ThresholdsTab`.
  - `ThresholdsTabId = "thresholds" | "weights" | "autokill" | "assumptions"` (exported from `useDrawerState.ts`).
  - `useDrawerState(...)` return gains `autoKillErrors: Record<string, string | null>`.
  - `CustomizeThresholdsDrawerProps` gains `initialTab?: ThresholdsTabId`.

- [ ] **Step 1: Write the failing component test**

Create `__tests__/AutoKillTab.test.tsx` (mirror the render setup used in `__tests__/tabs.test.tsx` — read that file for the shared test scaffolding/imports and reuse its patterns):

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BALANCED_THRESHOLDS } from "@propertyiq/analyzer-core";
import { AutoKillTab } from "../AutoKillTab";

const noErrors = {
  dscrFloor: null,
  taxInsShareOfRent: null,
  floodNoInsurance: null,
  negativeCashflowNoAck: null,
};

describe("AutoKillTab", () => {
  it("renders one row per B&H rule with switches", () => {
    render(
      <AutoKillTab
        strategy="BUY_AND_HOLD"
        thresholds={BALANCED_THRESHOLDS}
        onChange={() => {}}
        errors={noErrors}
      />,
    );
    expect(screen.getAllByRole("switch")).toHaveLength(4);
    expect(screen.getByTestId("autokill-row-dscrFloor")).toBeTruthy();
    expect(
      screen.getByTestId("autokill-row-negativeCashflowNoAck"),
    ).toBeTruthy();
  });

  it("toggle writes enabled=false into the autoKills block", () => {
    const onChange = vi.fn();
    render(
      <AutoKillTab
        strategy="BUY_AND_HOLD"
        thresholds={BALANCED_THRESHOLDS}
        onChange={onChange}
        errors={noErrors}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: /DSCR floor/i }));
    const next = onChange.mock.calls[0][0] as {
      autoKills: { dscrFloor: { enabled: boolean } };
    };
    expect(next.autoKills.dscrFloor.enabled).toBe(false);
  });

  it("editing a numeric limit writes value (percent rows convert display→decimal)", () => {
    const onChange = vi.fn();
    render(
      <AutoKillTab
        strategy="BUY_AND_HOLD"
        thresholds={BALANCED_THRESHOLDS}
        onChange={onChange}
        errors={noErrors}
      />,
    );
    fireEvent.change(
      screen.getByLabelText("Tax + insurance share of rent limit"),
      { target: { value: "25" } },
    );
    const next = onChange.mock.calls[0][0] as {
      autoKills: { taxInsShareOfRent: { value: number } };
    };
    expect(next.autoKills.taxInsShareOfRent.value).toBeCloseTo(0.25);
  });

  it("renders a validation error under the offending row", () => {
    render(
      <AutoKillTab
        strategy="BUY_AND_HOLD"
        thresholds={BALANCED_THRESHOLDS}
        onChange={() => {}}
        errors={{ ...noErrors, dscrFloor: "Must be between 0.3 and 2" }}
      />,
    );
    expect(screen.getByTestId("autokill-error-dscrFloor").textContent).toMatch(
      /0\.3/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/projects/rei-platform/packages/frontend && npx vitest run "app/(app)/analyzer/components/CustomizeThresholdsDrawer/__tests__/AutoKillTab.test.tsx"`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `AutoKillTab.tsx`**

```tsx
"use client";

/**
 * AutoKillTab — per-rule enable switch + editable numeric limit for the
 * active strategy's auto-kill rules. Presentation-only: parent owns the
 * thresholds object; edits come back as a fresh object via onChange with
 * the autoKills block merged in (same contract as ThresholdsTab).
 */

import type { Strategy } from "@propertyiq/analyzer-core";
import type { AnyStrategyThresholds } from "./preset-helpers";
import {
  autoKillRowsForStrategy,
  getAutoKillConfig,
  type AutoKillRowMeta,
} from "./autokill-rows";

interface AutoKillTabProps {
  strategy: Strategy;
  thresholds: AnyStrategyThresholds;
  onChange: (next: AnyStrategyThresholds) => void;
  errors: Record<string, string | null>;
}

const toDisplay = (row: AutoKillRowMeta, v: number): number =>
  row.unit === "percent" ? Math.round(v * 1000) / 10 : v;
const fromDisplay = (row: AutoKillRowMeta, v: number): number =>
  row.unit === "percent" ? v / 100 : v;
const suffixFor = (row: AutoKillRowMeta): string =>
  row.unit === "percent"
    ? "%"
    : row.unit === "dollars"
      ? "$"
      : row.unit === "multiplier"
        ? "×"
        : "";

export function AutoKillTab({
  strategy,
  thresholds,
  onChange,
  errors,
}: AutoKillTabProps) {
  const config = getAutoKillConfig(thresholds);

  function patchRule(
    key: string,
    patch: { enabled?: boolean; value?: number },
  ) {
    onChange({
      ...(thresholds as object),
      autoKills: {
        ...config,
        [key]: { ...config[key], ...patch },
      },
    } as unknown as AnyStrategyThresholds);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-on-surface-variant">
        Auto-kill rules force a deal straight to an F grade. Disable a rule or
        tune its limit — saved to your account and applied to every analysis.
      </p>
      {autoKillRowsForStrategy(strategy).map((row) => {
        const rule = config[row.key] ?? {};
        const enabled = rule.enabled ?? true;
        const value = rule.value ?? row.defaultValue;
        const err = errors[row.key];
        return (
          <div
            key={row.key}
            data-testid={`autokill-row-${row.key}`}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-on-surface">
                  {row.label}
                </div>
                <div className="text-[11px] text-on-surface-variant">
                  {row.description}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${row.label} rule`}
                onClick={() => patchRule(row.key, { enabled: !enabled })}
                className={
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 " +
                  (enabled
                    ? "bg-primary"
                    : "bg-surface-container-highest border border-outline-variant")
                }
              >
                <span
                  className={
                    "absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-transform duration-200 " +
                    (enabled ? "translate-x-[22px]" : "translate-x-0.5")
                  }
                />
              </button>
            </div>
            {row.unit != null && value != null && (
              <div className="relative w-36">
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  disabled={!enabled}
                  value={toDisplay(row, value)}
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value);
                    if (Number.isNaN(raw)) return;
                    patchRule(row.key, { value: fromDisplay(row, raw) });
                  }}
                  aria-label={`${row.label} limit`}
                  className="w-full font-mono tabular-nums text-sm bg-surface-container rounded-md px-2 py-1.5 border border-outline-variant focus:outline-none focus:ring-2 focus:ring-[var(--md-primary)] disabled:opacity-50"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant pointer-events-none">
                  {suffixFor(row)}
                </span>
              </div>
            )}
            {row.defaultValue != null && (
              <div className="text-[11px] text-on-surface-variant">
                Default: {toDisplay(row, row.defaultValue)}
                {suffixFor(row)}
              </div>
            )}
            {err && (
              <div
                role="alert"
                className="text-xs text-[var(--md-error)]"
                data-testid={`autokill-error-${row.key}`}
              >
                {err}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Integrate state — `useDrawerState.ts`**

Four edits:

(a) Line 39, extend the union (order matters for nothing, but keep tab order):

```ts
export type ThresholdsTabId =
  | "thresholds"
  | "weights"
  | "autokill"
  | "assumptions";
```

(b) Add imports from `./autokill-rows`:

```ts
import {
  getAutoKillConfig,
  hasAnyAutoKillError,
  validateAutoKills,
} from "./autokill-rows";
```

(c) After the `weightsCheck` memo (line 112), add:

```ts
const autoKillErrors = useMemo(
  () =>
    validateAutoKills(
      strategy,
      draftThresholds ? getAutoKillConfig(draftThresholds) : undefined,
    ),
  [draftThresholds, strategy],
);
```

Include `autoKillErrors` in the returned object (after `assumptionErrors`), and extend `canSave`:

```ts
    !hasAnyAutoKillError(autoKillErrors) &&
```

(d) `applyPreset` (line 169-174) must preserve the draft's autoKills block:

```ts
const applyPreset = useCallback(
  (preset: GradingPresetName) => {
    setDraftThresholds((prev) => {
      const next = presetForStrategy(strategy, preset);
      const autoKills = (prev as { autoKills?: unknown } | null)?.autoKills;
      return autoKills
        ? ({ ...(next as object), autoKills } as AnyStrategyThresholds)
        : next;
    });
  },
  [strategy],
);
```

- [ ] **Step 5: Integrate preset detection — `preset-helpers.ts`**

In `detectActivePreset` (line 191-204), strip `autoKills` before comparing:

```ts
export function detectActivePreset(
  strategy: Strategy,
  current: AnyStrategyThresholds | null | undefined,
): GradingPresetName | null {
  if (!current) return null;
  const presets = PRESETS_BY_STRATEGY[strategy];
  if (!presets) return null;
  // autoKills is orthogonal to presets — ignore it for matching.
  const { autoKills: _ignored, ...rubric } =
    current as AnyStrategyThresholds & {
      autoKills?: unknown;
    };
  const keys: GradingPresetName[] = ["conservative", "balanced", "aggressive"];
  const currentJson = JSON.stringify(rubric);
  for (const name of keys) {
    if (JSON.stringify(presets[name]) === currentJson) return name;
  }
  return null;
}
```

- [ ] **Step 6: Integrate drawer — `CustomizeThresholdsDrawer.tsx`**

(a) Props (line 35-39):

```ts
interface CustomizeThresholdsDrawerProps {
  open: boolean;
  onClose: () => void;
  strategy: Strategy;
  /** Tab to show when the drawer opens (deep-link from banner / input panel). */
  initialTab?: ThresholdsTabId;
}
```

(b) TABS (line 41-45):

```ts
const TABS: Array<{ id: ThresholdsTabId; label: string }> = [
  { id: "thresholds", label: "Thresholds" },
  { id: "weights", label: "Weights" },
  { id: "autokill", label: "Auto-Kill" },
  { id: "assumptions", label: "Assumptions" },
];
```

(c) Destructure `initialTab` in the function signature; replace `const [tab, setTab] = useState<ThresholdsTabId>("thresholds");` (line 59) with:

```ts
const [tab, setTab] = useState<ThresholdsTabId>(initialTab ?? "thresholds");

// Re-sync the tab each time the drawer opens (open may deep-link a tab).
useEffect(() => {
  if (open) setTab(initialTab ?? "thresholds");
}, [open, initialTab]);
```

(d) In the tabpanel chain (line 199-229), add the autokill branch before the assumptions fallback, and import `AutoKillTab`:

```tsx
          ) : tab === "autokill" ? (
            <AutoKillTab
              strategy={strategy}
              thresholds={state.draftThresholds}
              onChange={state.setDraftThresholds}
              errors={state.autoKillErrors}
            />
```

```ts
import { AutoKillTab } from "./AutoKillTab";
```

- [ ] **Step 7: Run drawer test suites**

Run: `cd D:/projects/rei-platform/packages/frontend && npx vitest run "app/(app)/analyzer/components/CustomizeThresholdsDrawer"`
Expected: ALL PASS — new AutoKillTab tests plus the pre-existing drawer/tabs/validators suites (preset detection with an autoKills block now passes because it's stripped).

- [ ] **Step 8: Commit**

```bash
cd D:/projects/rei-platform && git branch --show-current   # develop
git add "packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer"
git commit -m "feat(analyzer): Auto-Kill tab in customize drawer with per-rule toggles and limits" -- "packages/frontend/app/(app)/analyzer/components/CustomizeThresholdsDrawer"
```

---

### Task 8: frontend — banner "Edit criteria" button + AnalyzerClient deep-link wiring

**Files:**

- Modify: `packages/frontend/app/(app)/analyzer/components/cards/AutoKillBanner.tsx` (header row + button)
- Modify: `packages/frontend/app/(app)/analyzer/components/cards/GradingResultPanel.tsx` (new prop, forward at line 116)
- Modify: `packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx` (drawer tab state line 86, prop pass-through lines 296, 385-389)
- Modify: `packages/frontend/app/(app)/analyzer/components/cards/__tests__/AutoKillBanner.test.tsx` (new cases)

**Interfaces:**

- Consumes: `ThresholdsTabId` from `../CustomizeThresholdsDrawer/useDrawerState` (Task 7); `initialTab` drawer prop (Task 7).
- Produces: `AutoKillBannerProps.onEditCriteria?: () => void`; `GradingResultPanelProps.onEditAutoKillCriteria?: () => void`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/frontend/app/(app)/analyzer/components/cards/__tests__/AutoKillBanner.test.tsx` (mirror its existing imports/render style):

```tsx
it("renders an Edit criteria button top-right when onEditCriteria is provided", () => {
  const onEdit = vi.fn();
  render(
    <AutoKillBanner
      autoKills={[{ code: "DSCR_BELOW_1", message: "DSCR below 1.0" }]}
      onEditCriteria={onEdit}
    />,
  );
  const btn = screen.getByRole("button", {
    name: /edit auto-kill criteria/i,
  });
  fireEvent.click(btn);
  expect(onEdit).toHaveBeenCalledTimes(1);
});

it("renders no button when onEditCriteria is absent", () => {
  render(
    <AutoKillBanner
      autoKills={[{ code: "DSCR_BELOW_1", message: "DSCR below 1.0" }]}
    />,
  );
  expect(
    screen.queryByRole("button", { name: /edit auto-kill criteria/i }),
  ).toBeNull();
});
```

(Add `vi` / `fireEvent` to the test file imports if not present.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/projects/rei-platform/packages/frontend && npx vitest run "app/(app)/analyzer/components/cards/__tests__/AutoKillBanner.test.tsx"`
Expected: FAIL — unknown prop / button not found.

- [ ] **Step 3: Add the button to `AutoKillBanner.tsx`**

Extend the props interface (lines 3-5):

```ts
interface AutoKillBannerProps {
  autoKills: AutoKillFlag[];
  /** Renders a top-right "Edit criteria" button that opens the Auto-Kill settings. */
  onEditCriteria?: () => void;
}
```

Replace the `<h3>` block (lines 51-58) with a flex header row:

```tsx
<div className="flex items-start justify-between gap-3">
  <h3
    data-auto-kill-heading
    className="text-base font-bold flex items-center"
    style={{ color: "#E53935" }}
  >
    <WarningIcon />
    Auto-Kill Triggered
  </h3>
  {onEditCriteria && (
    <button
      type="button"
      onClick={onEditCriteria}
      aria-label="Edit auto-kill criteria"
      data-testid="autokill-edit-criteria"
      className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-200 hover:bg-[rgba(229,57,53,0.12)]"
      style={{ color: "#E53935", borderColor: "#E53935" }}
    >
      Edit criteria
    </button>
  )}
</div>
```

And destructure `onEditCriteria` in the component signature (line 37).

- [ ] **Step 4: Forward through `GradingResultPanel.tsx`**

Add to the props interface (after `onCustomizeClick`, line 62):

```ts
  /** Opens the Auto-Kill tab of the Customize drawer from the banner. */
  onEditAutoKillCriteria?: () => void;
```

Destructure it, and change line 116 to:

```tsx
<AutoKillBanner
  autoKills={result.autoKills}
  onEditCriteria={onEditAutoKillCriteria}
/>
```

- [ ] **Step 5: Wire `AnalyzerClient.tsx`**

(a) Add import:

```ts
import type { ThresholdsTabId } from "./components/CustomizeThresholdsDrawer/useDrawerState";
```

(b) Replace `const [drawerOpen, setDrawerOpen] = useState(false);` (line 86) with:

```ts
const [drawerOpen, setDrawerOpen] = useState(false);
const [drawerTab, setDrawerTab] = useState<ThresholdsTabId>("thresholds");
const openDrawer = (tab: ThresholdsTabId) => {
  setDrawerTab(tab);
  setDrawerOpen(true);
};
```

(c) In the `GradingResultPanel` props (line 296), change `onCustomizeClick={() => setDrawerOpen(true)}` to:

```tsx
                onCustomizeClick={() => openDrawer("thresholds")}
                onEditAutoKillCriteria={() => openDrawer("autokill")}
```

(d) Pass the tab to the drawer (line 385-389):

```tsx
<CustomizeThresholdsDrawer
  open={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  strategy={toEngineStrategy(activeStrategy) ?? "BUY_AND_HOLD"}
  initialTab={drawerTab}
/>
```

- [ ] **Step 6: Run cards test suite**

Run: `cd D:/projects/rei-platform/packages/frontend && npx vitest run "app/(app)/analyzer/components/cards/__tests__"`
Expected: ALL PASS (pre-existing GradingResultPanel tests still pass — new props optional).

- [ ] **Step 7: Commit**

```bash
cd D:/projects/rei-platform && git branch --show-current   # develop
git add "packages/frontend/app/(app)/analyzer/components/cards/AutoKillBanner.tsx" "packages/frontend/app/(app)/analyzer/components/cards/GradingResultPanel.tsx" "packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx" "packages/frontend/app/(app)/analyzer/components/cards/__tests__/AutoKillBanner.test.tsx"
git commit -m "feat(analyzer): Edit criteria button on auto-kill banner deep-links drawer tab" -- "packages/frontend/app/(app)/analyzer/components/cards/AutoKillBanner.tsx" "packages/frontend/app/(app)/analyzer/components/cards/GradingResultPanel.tsx" "packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx" "packages/frontend/app/(app)/analyzer/components/cards/__tests__/AutoKillBanner.test.tsx"
```

---

### Task 9: frontend — Advanced Assumptions link row + InputPanel threading

**Files:**

- Modify: `packages/frontend/app/(app)/analyzer/components/InputPanel/AdvancedAssumptions.tsx` (new prop + link row at bottom of open section)
- Modify: `packages/frontend/app/(app)/analyzer/components/InputPanel/InputPanel.tsx` (new prop line 37-75, forward at line 364-373)
- Modify: `packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx` (pass in the shared `inputPanel` const, line 183-225)
- Create: `packages/frontend/app/(app)/analyzer/components/InputPanel/__tests__/AdvancedAssumptions.test.tsx`

**Interfaces:**

- Consumes: `openDrawer("autokill")` from Task 8's AnalyzerClient wiring.
- Produces: `AdvancedAssumptionsProps.onCustomizeClick?: () => void`; `InputPanelProps.onCustomizeClick?: () => void`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/AdvancedAssumptions.test.tsx` (there is no existing AdvancedAssumptions test — net-new; use `DEFAULT_ASSUMPTIONS` from `../../../lib/analyzer-assumptions` for props, mirroring how `InputPanel.commercial.test.tsx` builds them):

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdvancedAssumptions } from "../AdvancedAssumptions";
import { DEFAULT_ASSUMPTIONS } from "../../../lib/analyzer-assumptions";

const baseProps = {
  assumptions: DEFAULT_ASSUMPTIONS,
  onChange: vi.fn(),
  input: { price: 300_000, rentMonthly: 2_000, financing: {} } as never,
  onInputChange: vi.fn(),
  onFinancingChange: vi.fn(),
};

function openSection() {
  fireEvent.click(
    screen.getByRole("button", { name: /advanced assumptions/i }),
  );
}

describe("AdvancedAssumptions customize row", () => {
  it("renders the auto-kill & grading row when onCustomizeClick is provided", () => {
    const onCustomize = vi.fn();
    render(
      <AdvancedAssumptions {...baseProps} onCustomizeClick={onCustomize} />,
    );
    openSection();
    const row = screen.getByTestId("autokill-grading-customize");
    expect(row.textContent).toMatch(/auto-kill & grading criteria/i);
    fireEvent.click(row);
    expect(onCustomize).toHaveBeenCalledTimes(1);
  });

  it("renders no row when the callback is absent", () => {
    render(<AdvancedAssumptions {...baseProps} />);
    openSection();
    expect(screen.queryByTestId("autokill-grading-customize")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/projects/rei-platform/packages/frontend && npx vitest run "app/(app)/analyzer/components/InputPanel/__tests__/AdvancedAssumptions.test.tsx"`
Expected: FAIL — unknown prop / testid not found.

- [ ] **Step 3: Add the row to `AdvancedAssumptions.tsx`**

Extend the props interface (line 10-21):

```ts
  /** Opens the Customize drawer (Auto-Kill tab). Renders the link row when provided. */
  onCustomizeClick?: () => void;
```

Destructure `onCustomizeClick` in the signature (line 42-49). Then, inside the `{open && ( <div className="space-y-4 mt-2"> ... )}` body, add as the LAST child (after the Growth group, before the closing `</div>`):

```tsx
{
  onCustomizeClick && (
    <button
      type="button"
      onClick={onCustomizeClick}
      data-testid="autokill-grading-customize"
      className="w-full flex items-center justify-between gap-2 rounded-lg border border-outline-variant px-3 py-2 text-left transition-colors duration-200 hover:bg-surface-container"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-on-surface">
          ⚙ Auto-kill &amp; grading criteria
        </span>
        <span className="block text-[11px] text-on-surface-variant">
          Edit thresholds, weights, and auto-kill rules
        </span>
      </span>
      <span className="shrink-0 text-xs font-medium text-primary">
        Customize
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Thread through `InputPanel.tsx`**

Add to `InputPanelProps` (line 37-75):

```ts
  /** Opens the Customize drawer (Auto-Kill tab) from Advanced Assumptions. */
  onCustomizeClick?: () => void;
```

Destructure in the signature (lines 80-109) and forward inside the `AdvancedAssumptions` render (line 364-373):

```tsx
onCustomizeClick = { onCustomizeClick };
```

- [ ] **Step 5: Pass from `AnalyzerClient.tsx`**

In the shared `inputPanel` const (line 183-225), add alongside the other props:

```tsx
      onCustomizeClick={() => openDrawer("autokill")}
```

(This flows to BOTH the desktop sidebar and the mobile sheet — `MobileInputSheet` needs no change.)

- [ ] **Step 6: Run InputPanel test suites**

Run: `cd D:/projects/rei-platform/packages/frontend && npx vitest run "app/(app)/analyzer/components/InputPanel/__tests__"`
Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
cd D:/projects/rei-platform && git branch --show-current   # develop
git add "packages/frontend/app/(app)/analyzer/components/InputPanel/AdvancedAssumptions.tsx" "packages/frontend/app/(app)/analyzer/components/InputPanel/InputPanel.tsx" "packages/frontend/app/(app)/analyzer/components/InputPanel/__tests__/AdvancedAssumptions.test.tsx" "packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx"
git commit -m "feat(analyzer): auto-kill & grading criteria entry in Advanced Assumptions" -- "packages/frontend/app/(app)/analyzer/components/InputPanel/AdvancedAssumptions.tsx" "packages/frontend/app/(app)/analyzer/components/InputPanel/InputPanel.tsx" "packages/frontend/app/(app)/analyzer/components/InputPanel/__tests__/AdvancedAssumptions.test.tsx" "packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx"
```

---

### Task 10: E2E — real backend + DB round-trip, and full verification

**Files:**

- Create: `packages/frontend/tests/e2e/analyzer-autokill-settings.spec.ts`
- Read first: `packages/frontend/tests/e2e/analyzer.spec.ts` and `packages/frontend/tests/harness/flows.ts` — reuse their login/auth + navigation helpers verbatim; the code below marks the two places to substitute the harness's real helper names.

**Interfaces:**

- Consumes: the running dev stack (`npm run dev:fresh`, frontend :3000 + backend :3001 + real Supabase), all UI from Tasks 7-9.

- [ ] **Step 1: Write the E2E spec**

Create `packages/frontend/tests/e2e/analyzer-autokill-settings.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
// SUBSTITUTE: import the login/auth fixture exactly as analyzer.spec.ts does.

const ANALYZER_URL =
  "/analyzer?address=123%20S%20Market%20St%2C%20Frederick%2C%20MD%2021701";

test.describe("auto-kill criteria settings (real backend + DB)", () => {
  // SUBSTITUTE: apply the same authenticated-context setup analyzer.spec.ts uses.

  test("disable DSCR rule → save → regrade drops the DSCR kill → persists", async ({
    page,
  }) => {
    await page.goto(ANALYZER_URL);

    // Deal must load with the DSCR auto-kill visible (cached RentCast data).
    const banner = page.locator("[data-auto-kill-banner]");
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner.locator('[data-code="DSCR_BELOW_1"]')).toBeVisible();

    // Banner button opens the drawer directly on the Auto-Kill tab.
    await page.getByTestId("autokill-edit-criteria").click();
    const drawer = page.getByTestId("customize-thresholds-drawer");
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("tab", { name: "Auto-Kill", selected: true }),
    ).toBeVisible();

    // Disable the DSCR floor rule and save (real PUT to the real DB).
    await drawer.getByRole("switch", { name: /DSCR floor/i }).click();
    await drawer.getByRole("button", { name: /^save$/i }).click();
    await expect(drawer.getByText("Saved")).toBeVisible();
    await drawer.getByRole("button", { name: /close drawer/i }).click();

    // Regrade (reload re-fires the grade call with saved settings applied
    // server-side) — the DSCR kill line must be gone.
    await page.reload();
    await expect(page.locator("[data-grading-result-panel]")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-code="DSCR_BELOW_1"]')).toHaveCount(0);

    // Setting persisted: reopen the drawer (via Advanced Assumptions this
    // time — covers the second entry point) and verify the switch is off.
    await page.getByRole("button", { name: /advanced assumptions/i }).click();
    await page.getByTestId("autokill-grading-customize").click();
    await expect(
      drawer.getByRole("switch", { name: /DSCR floor/i }),
    ).toHaveAttribute("aria-checked", "false");

    // Cleanup: Reset All restores engine defaults for the next run.
    await drawer.getByRole("button", { name: /reset all/i }).click();
  });
});
```

Adapt the two SUBSTITUTE comments and any selector the harness already standardizes (e.g. drawer footer button names — read `DrawerFooter.tsx` for the exact "Save" / "Reset All" labels and match them). Do not mock anything.

- [ ] **Step 2: Start the stack and run the spec**

```bash
cd D:/projects/rei-platform && npm run dev:fresh   # background; wait for 3000+3001 to answer
cd packages/frontend && npx playwright test tests/e2e/analyzer-autokill-settings.spec.ts
```

Expected: PASS against the real backend and real Supabase. If the deal doesn't trip DSCR on load, the RentCast cache may have expired — click "Fetch property + comps from RentCast" once, then re-run.

- [ ] **Step 3: Full verification sweep**

```bash
cd D:/projects/rei-platform
npm run test -w @propertyiq/analyzer-core          # all engine tests
cd packages/backend && npx jest src/analyzer       # analyzer backend suites
cd ../frontend && npx vitest run "app/(app)/analyzer"   # all analyzer FE suites
npm run build -w backend                            # zero errors required
NEXT_DIST_DIR=.next-verify npm run build -w web     # zero errors required (never .next-dev)
```

Expected: everything green. Fix ALL errors including pre-existing ones before the final commit.

- [ ] **Step 4: Live visual check**

Open `http://localhost:3000/analyzer?address=123 S Market St, Frederick, MD 21701` in a real browser: banner shows the top-right "Edit criteria" button; Advanced Assumptions shows the customize row; drawer opens on the Auto-Kill tab from both; toggles + limits render for all three strategies (switch strategy chips to check F&F/BRRRR).

- [ ] **Step 5: Commit**

```bash
cd D:/projects/rei-platform && git branch --show-current   # develop
git add packages/frontend/tests/e2e/analyzer-autokill-settings.spec.ts
git commit -m "test(analyzer): e2e auto-kill settings round-trip against real DB" -- packages/frontend/tests/e2e/analyzer-autokill-settings.spec.ts
```
