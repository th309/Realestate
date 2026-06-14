# Address-Prefilled Deal Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user enters a specific property address, prefill the Deal Analyzer's assumption fields from the best data we have for that property, stamping each field with source + as-of date + A/B/C/F confidence, with a non-blocking warning on sharp overrides.

**Architecture:** A single tier-aware backend endpoint (`GET /api/analyzer/prefill`) assembles three layers — geo metrics (all tiers, via `MetricResolutionService`), RentCast parcel data (Pro only, via the existing `lookupProperty` service method), and heuristic estimates for fields with no data source — and returns one self-describing bundle where every field already carries its value, source, as-of, confidence grade, and `kind` (`data` vs `estimate`). The frontend adds a Mapbox street-address autocomplete, applies the bundle to the analyzer input + assumptions plus a parallel provenance map, renders per-field stamps, and warns on >30% overrides. `analyzer-core` is unchanged.

**Tech Stack:** NestJS (backend), Jest (backend unit tests), Next.js App Router + React 19 (frontend), Mapbox Geocoding API, Playwright (live E2E). Source spec: `docs/superpowers/specs/2026-06-14-address-prefilled-analyzer-design.md`.

---

## File structure

**Backend (`packages/backend/src/analyzer/`)**

- Create `prefill-grade.ts` — pure grade derivation (specificity/freshness/fallback → A/B/C/F; estimate grades; `pctToGrade`).
- Create `prefill-estimates.ts` — pure heuristics (insurance, vacancy, rent-growth, free-tier tax).
- Create `dto/analyzer-prefill.dto.ts` — query DTO + response DTOs (`PrefillFieldDto`, `AnalyzerPrefillDto`).
- Modify `analyzer.service.ts` — add `getPrefillBundle(...)`.
- Modify `analyzer.controller.ts` — add `GET /api/analyzer/prefill` route (optional auth).
- Modify `analyzer-tier-gate.service.ts` — add non-throwing `isPro(userId?)`.

**Backend (`packages/backend/src/common/guards/`)**

- Create `optional-jwt-auth.guard.ts` — validates a Bearer token if present, sets `request.userId`, never throws.
- Modify `index.ts` — export the new guard.

**Frontend (`packages/frontend/`)**

- Create `lib/data/fetchers/address-geocode.ts` — Mapbox street-address autocomplete + feature→ZIP parser.
- Create `lib/data/fetchers/analyzer-prefill.ts` — calls `/api/analyzer/prefill`; types mirror the backend DTO.
- Create `lib/data/hooks/useAddressGeocode.ts` and `lib/data/hooks/useAnalyzerPrefill.ts`.
- Modify `lib/data/index.ts` — export the new fetchers/hooks/types.
- Create `app/(app)/analyzer/components/InputPanel/AddressAutocomplete.tsx`.
- Create `app/(app)/analyzer/components/InputPanel/FieldProvenance.tsx`.
- Modify `app/(app)/analyzer/lib/use-analyzer-state.ts` — apply the bundle to input + assumptions + a `provenance` map; track baselines; replace the price/rent-only RentCast sync.
- Modify `app/(app)/analyzer/components/InputPanel/InputPanel.tsx` — swap the address input, render `FieldProvenance` + divergence warnings, update empty-state copy.

**E2E (`packages/frontend/e2e/` — follow the repo's existing Playwright location)**

- Create `analyzer-prefill.spec.ts`.

---

## Task 1: Pure grade derivation (`prefill-grade.ts`)

**Files:**

- Create: `packages/backend/src/analyzer/prefill-grade.ts`
- Test: `packages/backend/src/analyzer/prefill-grade.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/analyzer/prefill-grade.spec.ts
import { gradeDataField, gradeEstimate, pctToGrade } from "./prefill-grade";

describe("pctToGrade", () => {
  it.each([
    [95, "a"],
    [80, "a"],
    [79, "b"],
    [65, "b"],
    [64, "c"],
    [45, "c"],
    [44, "f"],
    [0, "f"],
  ])("maps %i%% to grade %s", (pct, grade) => {
    expect(pctToGrade(pct)).toBe(grade);
  });
});

describe("gradeDataField", () => {
  it("grades fresh parcel data A (100%)", () => {
    expect(
      gradeDataField({ geoLevel: "parcel", monthsStale: 0, isFallback: false }),
    ).toEqual({ grade: "a", pct: 100 });
  });

  it("penalizes ZIP specificity (-5)", () => {
    expect(
      gradeDataField({ geoLevel: "zip", monthsStale: 0, isFallback: false }),
    ).toEqual({ grade: "a", pct: 95 });
  });

  it("penalizes inherited metro specificity (-30) → grade B", () => {
    expect(
      gradeDataField({ geoLevel: "metro", monthsStale: 0, isFallback: false }),
    ).toEqual({ grade: "b", pct: 70 });
  });

  it("penalizes staleness beyond 3 months (-2/mo, capped at -30)", () => {
    // zip(-5) + stale 8mo => (8-3)*2 = -10 => 85
    expect(
      gradeDataField({ geoLevel: "zip", monthsStale: 8, isFallback: false })
        .pct,
    ).toBe(85);
    // cap: 100mo => -30 only
    expect(
      gradeDataField({
        geoLevel: "parcel",
        monthsStale: 100,
        isFallback: false,
      }).pct,
    ).toBe(70);
  });

  it("penalizes fallback source (-10)", () => {
    expect(
      gradeDataField({ geoLevel: "zip", monthsStale: 0, isFallback: true }).pct,
    ).toBe(85);
  });

  it("applies a hard cap (free-tier ZHVI price)", () => {
    // parcel/fresh would be 100, capped to 60 → grade C
    expect(
      gradeDataField({
        geoLevel: "zip",
        monthsStale: 0,
        isFallback: false,
        capPct: 60,
      }),
    ).toEqual({ grade: "c", pct: 60 });
  });

  it("clamps to a 1 floor and treats null geoLevel as state", () => {
    expect(
      gradeDataField({ geoLevel: null, monthsStale: 0, isFallback: false }).pct,
    ).toBe(55);
  });
});

describe("gradeEstimate", () => {
  it("grades constant estimates F (~35%)", () => {
    expect(gradeEstimate("constant")).toEqual({ grade: "f", pct: 35 });
  });
  it("grades market-derived estimates C (~50%)", () => {
    expect(gradeEstimate("market")).toEqual({ grade: "c", pct: 50 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/analyzer/prefill-grade.spec.ts`
Expected: FAIL — "Cannot find module './prefill-grade'".

- [ ] **Step 3: Write the implementation**

```ts
// packages/backend/src/analyzer/prefill-grade.ts
/**
 * Pure confidence-grade derivation for analyzer prefill fields.
 *
 * Grades read identically to the PropertyIQ score grades (A ≥80, B 65–79,
 * C 45–64, F <45 — matching app/components/scoring/ConfidenceDisplay).
 * Kept side-effect-free (no Date) so it is fully unit-testable; the caller
 * computes `monthsStale` from the as-of date.
 */
export type ConfidenceGrade = "a" | "b" | "c" | "f";
export interface GradeResult {
  grade: ConfidenceGrade;
  pct: number;
}

export type PrefillGeoLevel =
  | "parcel"
  | "zip"
  | "county"
  | "metro"
  | "state"
  | null;

const SPECIFICITY_PENALTY: Record<Exclude<PrefillGeoLevel, null>, number> = {
  parcel: 0,
  zip: 5,
  county: 20,
  metro: 30,
  state: 45,
};

const FRESHNESS_GRACE_MONTHS = 3;
const FRESHNESS_PENALTY_PER_MONTH = 2;
const FRESHNESS_PENALTY_CAP = 30;
const FALLBACK_PENALTY = 10;

export function pctToGrade(pct: number): ConfidenceGrade {
  if (pct >= 80) return "a";
  if (pct >= 65) return "b";
  if (pct >= 45) return "c";
  return "f";
}

export function gradeDataField(opts: {
  geoLevel: PrefillGeoLevel;
  monthsStale: number;
  isFallback: boolean;
  /** Optional hard ceiling, e.g. free-tier ZHVI price proxy capped at 60. */
  capPct?: number;
}): GradeResult {
  const specificity =
    opts.geoLevel == null
      ? SPECIFICITY_PENALTY.state
      : SPECIFICITY_PENALTY[opts.geoLevel];
  const freshness = Math.min(
    FRESHNESS_PENALTY_CAP,
    Math.max(0, opts.monthsStale - FRESHNESS_GRACE_MONTHS) *
      FRESHNESS_PENALTY_PER_MONTH,
  );
  const fallback = opts.isFallback ? FALLBACK_PENALTY : 0;

  let pct = 100 - specificity - freshness - fallback;
  if (opts.capPct != null) pct = Math.min(pct, opts.capPct);
  pct = Math.max(1, Math.min(100, Math.round(pct)));
  return { grade: pctToGrade(pct), pct };
}

export function gradeEstimate(kind: "constant" | "market"): GradeResult {
  return kind === "market" ? { grade: "c", pct: 50 } : { grade: "f", pct: 35 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/analyzer/prefill-grade.spec.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/analyzer/prefill-grade.ts packages/backend/src/analyzer/prefill-grade.spec.ts
git commit -m "feat(analyzer): pure confidence-grade derivation for prefill fields"
```

---

## Task 2: Pure estimate heuristics (`prefill-estimates.ts`)

**Files:**

- Create: `packages/backend/src/analyzer/prefill-estimates.ts`
- Test: `packages/backend/src/analyzer/prefill-estimates.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/analyzer/prefill-estimates.spec.ts
import {
  estimateInsuranceAnnual,
  estimateVacancyFraction,
  estimateRentGrowthFraction,
  estimateTaxAnnual,
} from "./prefill-estimates";

describe("estimateInsuranceAnnual", () => {
  it("is 0.55%/yr of price", () => {
    expect(estimateInsuranceAnnual(400_000)).toBe(2200);
  });
  it("returns null for missing/zero price", () => {
    expect(estimateInsuranceAnnual(null)).toBeNull();
    expect(estimateInsuranceAnnual(0)).toBeNull();
  });
});

describe("estimateVacancyFraction", () => {
  it("is a flat 5% fraction", () => {
    expect(estimateVacancyFraction()).toBe(0.05);
  });
});

describe("estimateRentGrowthFraction", () => {
  it("defaults to 3% when appreciation is unknown", () => {
    expect(estimateRentGrowthFraction(null)).toBe(0.03);
  });
  it("tracks appreciation (percent input) clamped to 2–5%", () => {
    expect(estimateRentGrowthFraction(4)).toBe(0.04); // 4% -> 0.04
    expect(estimateRentGrowthFraction(9)).toBe(0.05); // clamp high
    expect(estimateRentGrowthFraction(1)).toBe(0.02); // clamp low
  });
});

describe("estimateTaxAnnual", () => {
  it("is ~1.1% effective rate of price", () => {
    expect(estimateTaxAnnual(300_000)).toBe(3300);
  });
  it("returns null for missing price", () => {
    expect(estimateTaxAnnual(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/analyzer/prefill-estimates.spec.ts`
Expected: FAIL — "Cannot find module './prefill-estimates'".

- [ ] **Step 3: Write the implementation**

```ts
// packages/backend/src/analyzer/prefill-estimates.ts
/**
 * Pure heuristic estimates for analyzer fields that have NO data source in
 * the platform (insurance, vacancy, rent-growth) and property tax for free
 * users (no RentCast parcel access). These are honest assumptions, never
 * dressed up as sourced data — the caller stamps them kind:'estimate'.
 *
 * Unit conventions (verified against analyzer-core + analyzer-assumptions):
 *   - vacancy / rent-growth are FRACTIONS (0.05, 0.03)
 *   - insurance / tax are ANNUAL DOLLARS
 *   - appreciation INPUT here is a PERCENT (home_value_yoy, e.g. 6.2)
 */
export const INSURANCE_RATE_ANNUAL = 0.0055;
export const DEFAULT_VACANCY_FRACTION = 0.05;
export const DEFAULT_RENT_GROWTH_FRACTION = 0.03;
export const RENT_GROWTH_MIN = 0.02;
export const RENT_GROWTH_MAX = 0.05;
export const DEFAULT_EFFECTIVE_TAX_RATE = 0.011;

export function estimateInsuranceAnnual(price: number | null): number | null {
  if (!price || price <= 0) return null;
  return Math.round(price * INSURANCE_RATE_ANNUAL);
}

export function estimateVacancyFraction(): number {
  return DEFAULT_VACANCY_FRACTION;
}

/** `appreciationPercent` is the home_value_yoy percent (e.g. 6.2), not a fraction. */
export function estimateRentGrowthFraction(
  appreciationPercent: number | null,
): number {
  if (appreciationPercent == null) return DEFAULT_RENT_GROWTH_FRACTION;
  const frac = appreciationPercent / 100;
  return Math.min(RENT_GROWTH_MAX, Math.max(RENT_GROWTH_MIN, frac));
}

export function estimateTaxAnnual(price: number | null): number | null {
  if (!price || price <= 0) return null;
  return Math.round(price * DEFAULT_EFFECTIVE_TAX_RATE);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/analyzer/prefill-estimates.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/analyzer/prefill-estimates.ts packages/backend/src/analyzer/prefill-estimates.spec.ts
git commit -m "feat(analyzer): pure estimate heuristics for no-source prefill fields"
```

---

## Task 3: Prefill DTOs (`dto/analyzer-prefill.dto.ts`)

**Files:**

- Create: `packages/backend/src/analyzer/dto/analyzer-prefill.dto.ts`

No test (type/DTO declarations only — exercised by Task 6/7 tests).

- [ ] **Step 1: Write the DTOs**

```ts
// packages/backend/src/analyzer/dto/analyzer-prefill.dto.ts
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import type { ConfidenceGrade, PrefillGeoLevel } from "../prefill-grade";

/** Query params for GET /api/analyzer/prefill. ZIP is the geo anchor; address
 *  (when present + caller is Pro) drives the RentCast parcel layer. */
export class AnalyzerPrefillQueryDto {
  @IsOptional()
  @Matches(/^\d{5}$/, { message: "zip must be 5 digits" })
  zip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

export type PrefillFieldKey =
  | "price"
  | "rentMonthly"
  | "taxAnnual"
  | "insuranceAnnual"
  | "hoaMonthly"
  | "vacancyPctOfRent"
  | "appreciationPct"
  | "rentGrowthPct";

export interface PrefillFieldDto {
  value: number | null;
  source: string | null;
  /** period_date / tax year; null for estimates. */
  asOf: string | null;
  confidence: { grade: ConfidenceGrade; pct: number };
  kind: "data" | "estimate";
  geoLevel: PrefillGeoLevel;
  inherited: boolean;
}

export interface AnalyzerPrefillDto {
  resolvedAddress: string | null;
  geo: {
    zip: string | null;
    countyFips: string | null;
    cbsaCode: string | null;
    state: string | null;
  };
  /** True when the RentCast parcel layer was applied (Pro + quota available). */
  hasParcelData: boolean;
  fields: Record<PrefillFieldKey, PrefillFieldDto>;
  notes: string[];
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/backend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors referencing `analyzer-prefill.dto.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/analyzer/dto/analyzer-prefill.dto.ts
git commit -m "feat(analyzer): prefill bundle DTOs"
```

---

## Task 4: Non-throwing `isPro` on the tier gate

**Files:**

- Modify: `packages/backend/src/analyzer/analyzer-tier-gate.service.ts`
- Test: `packages/backend/src/analyzer/analyzer-tier-gate.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/analyzer/analyzer-tier-gate.spec.ts
import { AnalyzerTierGate } from "./analyzer-tier-gate.service";

function makeGate(tier: string | null) {
  const entitlements = { getUserTier: jest.fn().mockResolvedValue(tier) };
  return new AnalyzerTierGate(entitlements as never);
}

describe("AnalyzerTierGate.isPro", () => {
  it("returns false for undefined userId without calling entitlements", async () => {
    const entitlements = { getUserTier: jest.fn() };
    const gate = new AnalyzerTierGate(entitlements as never);
    expect(await gate.isPro(undefined)).toBe(false);
    expect(entitlements.getUserTier).not.toHaveBeenCalled();
  });

  it.each(["pro", "enterprise", "admin"])(
    "returns true for %s",
    async (tier) => {
      expect(await makeGate(tier).isPro("u1")).toBe(true);
    },
  );

  it.each(["free", null])("returns false for %s", async (tier) => {
    expect(await makeGate(tier as string | null).isPro("u1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/analyzer/analyzer-tier-gate.spec.ts`
Expected: FAIL — `gate.isPro is not a function`.

- [ ] **Step 3: Add the method**

In `packages/backend/src/analyzer/analyzer-tier-gate.service.ts`, add this method to the `AnalyzerTierGate` class (immediately after `requirePro`):

```ts
  /**
   * Non-throwing tier probe for endpoints that serve all tiers from one route
   * (e.g. prefill). Returns false for anonymous callers without hitting
   * EntitlementsService.
   */
  async isPro(userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    const tier = (await this.entitlements.getUserTier(userId)) ?? 'free';
    return PRO_ALLOWED_TIERS.includes(tier);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/analyzer/analyzer-tier-gate.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/analyzer/analyzer-tier-gate.service.ts packages/backend/src/analyzer/analyzer-tier-gate.spec.ts
git commit -m "feat(analyzer): non-throwing isPro tier probe"
```

---

## Task 5: Optional JWT auth guard

**Files:**

- Create: `packages/backend/src/common/guards/optional-jwt-auth.guard.ts`
- Modify: `packages/backend/src/common/guards/index.ts`
- Test: `packages/backend/src/common/guards/__tests__/optional-jwt-auth-guard.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/common/guards/__tests__/optional-jwt-auth-guard.spec.ts
import { OptionalJwtAuthGuard } from "../optional-jwt-auth.guard";

function ctxWith(headers: Record<string, string>) {
  const req: { headers: Record<string, string>; userId?: string } = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    _req: req,
  } as never as {
    switchToHttp: () => { getRequest: () => typeof req };
    _req: typeof req;
  };
}

function makeGuard(getUser: jest.Mock) {
  const supabaseService = { getClient: () => ({ auth: { getUser } }) };
  return new OptionalJwtAuthGuard({} as never, supabaseService as never);
}

describe("OptionalJwtAuthGuard", () => {
  it("allows anonymous (no header) and leaves userId unset", async () => {
    const getUser = jest.fn();
    const guard = makeGuard(getUser);
    const ctx = ctxWith({});
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(ctx._req.userId).toBeUndefined();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("sets userId for a valid Bearer token", async () => {
    const getUser = jest
      .fn()
      .mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const guard = makeGuard(getUser);
    const ctx = ctxWith({ authorization: "Bearer good" });
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(ctx._req.userId).toBe("u1");
  });

  it("allows through (anon) when the token is invalid — never throws", async () => {
    const getUser = jest
      .fn()
      .mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    const guard = makeGuard(getUser);
    const ctx = ctxWith({ authorization: "Bearer bad" });
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(ctx._req.userId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/common/guards/__tests__/optional-jwt-auth-guard.spec.ts`
Expected: FAIL — "Cannot find module '../optional-jwt-auth.guard'".

- [ ] **Step 3: Write the guard**

```ts
// packages/backend/src/common/guards/optional-jwt-auth.guard.ts
/**
 * Optional JWT guard — for endpoints that serve BOTH anonymous and
 * authenticated callers from a single route (e.g. analyzer prefill).
 *
 * If a valid Bearer token is present it sets `request.userId`; otherwise the
 * request proceeds anonymously. It NEVER throws — an invalid/expired token is
 * treated as anonymous, not a 401. (Mirrors JwtAuthGuard's validation, minus
 * the hard requirement.)
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../../supabase/supabase.service";

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return true; // anonymous
    }

    const token = authHeader.substring(7);
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user) {
        request.userId = data.user.id;
      } else {
        this.logger.debug(
          "[OptionalJwtAuth] token present but invalid — proceeding anonymously",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      this.logger.debug(
        `[OptionalJwtAuth] validation error, proceeding anonymously: ${message}`,
      );
    }
    return true;
  }
}
```

- [ ] **Step 4: Export it**

In `packages/backend/src/common/guards/index.ts`, add:

```ts
export * from "./optional-jwt-auth.guard";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/common/guards/__tests__/optional-jwt-auth-guard.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/common/guards/optional-jwt-auth.guard.ts packages/backend/src/common/guards/index.ts packages/backend/src/common/guards/__tests__/optional-jwt-auth-guard.spec.ts
git commit -m "feat(common): optional JWT auth guard for mixed anon/authed routes"
```

---

## Task 6: `getPrefillBundle` service method

**Files:**

- Modify: `packages/backend/src/analyzer/analyzer.service.ts`
- Test: `packages/backend/src/analyzer/analyzer-prefill.service.spec.ts`

This method assembles the bundle. It depends on `MetricResolutionService.resolveMetricBatch`, `GeographyChainService.getInheritanceChain`, and the existing `lookupProperty` (RentCast). It computes `monthsStale` from `ResolvedMetric.date` using an injectable clock for testability.

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/analyzer/analyzer-prefill.service.spec.ts
import { AnalyzerService } from "./analyzer.service";
import type { ResolvedMetric } from "../metric-resolution/metric-resolution.types";

const NOW = new Date("2026-06-14T00:00:00Z");

function metric(partial: Partial<ResolvedMetric>): ResolvedMetric {
  return {
    value: null,
    date: null,
    source: "none",
    sourceGeoId: null,
    sourceGeoLevel: null,
    isInherited: false,
    isFallback: false,
    ...partial,
  };
}

function makeService(opts: {
  metrics: Record<string, ResolvedMetric>;
  chain?: { id: string; level: string }[];
  rentcast?: unknown;
}) {
  const metricResolution = {
    resolveMetricBatch: jest.fn().mockResolvedValue(opts.metrics),
  };
  const geographyChain = {
    getInheritanceChain: jest.fn().mockResolvedValue(opts.chain ?? []),
  };
  const scoringService = { getScore: jest.fn().mockResolvedValue(null) };
  const rentcast = {};
  const aiProvider = {};
  const service = new AnalyzerService(
    metricResolution as never,
    geographyChain as never,
    scoringService as never,
    rentcast as never,
    aiProvider as never,
  );
  // lookupProperty is exercised separately; stub it for the parcel path.
  if (opts.rentcast !== undefined) {
    jest
      .spyOn(service, "lookupProperty")
      .mockResolvedValue(opts.rentcast as never);
  }
  return { service, metricResolution };
}

describe("AnalyzerService.getPrefillBundle", () => {
  it("free tier: geo-layer data + estimates, no parcel, tax is an estimate", async () => {
    const { service } = makeService({
      metrics: {
        rent_index: metric({
          value: 1850,
          date: "2026-04-01",
          source: "zillow",
          sourceGeoLevel: "zip",
        }),
        home_value: metric({
          value: 410000,
          date: "2026-04-01",
          source: "zillow",
          sourceGeoLevel: "zip",
        }),
        home_value_yoy: metric({
          value: 6.2,
          date: "2026-04-01",
          source: "realtor",
          sourceGeoLevel: "zip",
        }),
      },
    });

    const bundle = await service.getPrefillBundle(
      { zip: "78702" },
      { isPro: false, now: NOW },
    );

    expect(bundle.hasParcelData).toBe(false);
    expect(bundle.fields.rentMonthly).toMatchObject({
      value: 1850,
      kind: "data",
      source: "zillow",
    });
    expect(bundle.fields.appreciationPct).toMatchObject({
      value: 6.2,
      kind: "data",
    });
    // free price from ZHVI is capped at grade C
    expect(bundle.fields.price.value).toBe(410000);
    expect(bundle.fields.price.confidence.grade).toBe("c");
    // estimates
    expect(bundle.fields.insuranceAnnual).toMatchObject({
      kind: "estimate",
      source: "Estimate",
    });
    expect(bundle.fields.vacancyPctOfRent).toMatchObject({
      value: 0.05,
      kind: "estimate",
    });
    expect(bundle.fields.taxAnnual.kind).toBe("estimate");
    expect(bundle.fields.taxAnnual.value).toBe(Math.round(410000 * 0.011));
  });

  it("pro tier: parcel tax/rent/hoa override geo, marked data", async () => {
    const { service } = makeService({
      metrics: {
        rent_index: metric({
          value: 1850,
          date: "2026-04-01",
          source: "zillow",
          sourceGeoLevel: "zip",
        }),
        home_value: metric({
          value: 410000,
          date: "2026-04-01",
          source: "zillow",
          sourceGeoLevel: "zip",
        }),
        home_value_yoy: metric({
          value: 6.2,
          date: "2026-04-01",
          source: "realtor",
          sourceGeoLevel: "zip",
        }),
      },
      rentcast: {
        avm: { value: 425000 },
        rent: { value: 1950 },
        property_record: {
          propertyTaxes: [
            { year: 2025, total: 7200 },
            { year: 2024, total: 6900 },
          ],
          hoaFee: 45,
        },
        resolved_address: "123 Main St, Austin, TX 78702",
      },
    });

    const bundle = await service.getPrefillBundle(
      { zip: "78702", address: "123 Main St, Austin, TX 78702" },
      { isPro: true, now: NOW },
    );

    expect(bundle.hasParcelData).toBe(true);
    expect(bundle.resolvedAddress).toBe("123 Main St, Austin, TX 78702");
    expect(bundle.fields.price).toMatchObject({
      value: 425000,
      kind: "data",
      geoLevel: "parcel",
    });
    expect(bundle.fields.rentMonthly).toMatchObject({
      value: 1950,
      kind: "data",
      geoLevel: "parcel",
    });
    expect(bundle.fields.taxAnnual).toMatchObject({
      value: 7200,
      kind: "data",
      source: "RentCast",
      asOf: "2025",
    });
    expect(bundle.fields.hoaMonthly).toMatchObject({ value: 45, kind: "data" });
  });

  it("pro tier: RentCast failure degrades to geo layer with a note", async () => {
    const { service } = makeService({
      metrics: {
        rent_index: metric({
          value: 1850,
          date: "2026-04-01",
          source: "zillow",
          sourceGeoLevel: "zip",
        }),
        home_value: metric({
          value: 410000,
          date: "2026-04-01",
          source: "zillow",
          sourceGeoLevel: "zip",
        }),
        home_value_yoy: metric({
          value: 6.2,
          date: "2026-04-01",
          source: "realtor",
          sourceGeoLevel: "zip",
        }),
      },
    });
    jest
      .spyOn(service, "lookupProperty")
      .mockRejectedValue(new Error("quota exceeded"));

    const bundle = await service.getPrefillBundle(
      { zip: "78702", address: "123 Main St" },
      { isPro: true, now: NOW },
    );

    expect(bundle.hasParcelData).toBe(false);
    expect(bundle.notes.join(" ")).toMatch(/parcel data unavailable/i);
    expect(bundle.fields.rentMonthly.value).toBe(1850); // geo fallback
  });

  it("returns null-valued fields (not a throw) when no geo is identifiable", async () => {
    const { service } = makeService({ metrics: {} });
    const bundle = await service.getPrefillBundle(
      {},
      { isPro: false, now: NOW },
    );
    expect(bundle.geo.zip).toBeNull();
    expect(bundle.fields.rentMonthly.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/analyzer/analyzer-prefill.service.spec.ts`
Expected: FAIL — `service.getPrefillBundle is not a function`.

- [ ] **Step 3: Implement the method**

Add imports near the top of `packages/backend/src/analyzer/analyzer.service.ts`:

```ts
import {
  gradeDataField,
  gradeEstimate,
  type PrefillGeoLevel,
} from "./prefill-grade";
import {
  estimateInsuranceAnnual,
  estimateVacancyFraction,
  estimateRentGrowthFraction,
  estimateTaxAnnual,
} from "./prefill-estimates";
import type {
  AnalyzerPrefillDto,
  AnalyzerPrefillQueryDto,
  PrefillFieldDto,
} from "./dto/analyzer-prefill.dto";
```

Add these module-scope helpers (after `toMetricValueDto`):

```ts
/** Whole months between an as-of date/year and `now` (0 if unparseable). */
function monthsStaleFrom(asOf: string | null, now: Date): number {
  if (!asOf) return 0;
  const asYear = /^\d{4}$/.test(asOf)
    ? new Date(`${asOf}-12-31T00:00:00Z`)
    : new Date(asOf);
  if (Number.isNaN(asYear.getTime())) return 0;
  const months =
    (now.getUTCFullYear() - asYear.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - asYear.getUTCMonth());
  return Math.max(0, months);
}

function asPrefillGeoLevel(level: string | null): PrefillGeoLevel {
  if (
    level === "zip" ||
    level === "county" ||
    level === "metro" ||
    level === "state"
  )
    return level;
  return null;
}

/** Build a data-backed field from a ResolvedMetric. */
function dataField(
  resolved: ResolvedMetric | undefined,
  now: Date,
  sourceLabel: string,
  opts: { capPct?: number } = {},
): PrefillFieldDto {
  if (!resolved || resolved.value == null) {
    return {
      value: null,
      source: null,
      asOf: null,
      confidence: gradeEstimate("constant"),
      kind: "estimate",
      geoLevel: null,
      inherited: false,
    };
  }
  const geoLevel = asPrefillGeoLevel(resolved.sourceGeoLevel);
  return {
    value: resolved.value,
    source: sourceLabel,
    asOf: resolved.date,
    confidence: gradeDataField({
      geoLevel,
      monthsStale: monthsStaleFrom(resolved.date, now),
      isFallback: resolved.isFallback,
      capPct: opts.capPct,
    }),
    kind: "data",
    geoLevel,
    inherited: resolved.isInherited,
  };
}

function estimateField(
  value: number | null,
  kind: "constant" | "market",
): PrefillFieldDto {
  return {
    value,
    source: kind === "market" ? "Estimate (market-based)" : "Estimate",
    asOf: null,
    confidence: gradeEstimate(kind),
    kind: "estimate",
    geoLevel: null,
    inherited: false,
  };
}

function parcelField(
  value: number | null,
  asOf: string | null,
): PrefillFieldDto {
  return {
    value,
    source: "RentCast",
    asOf,
    confidence: gradeDataField({
      geoLevel: "parcel",
      monthsStale: 0,
      isFallback: false,
    }),
    kind: "data",
    geoLevel: "parcel",
    inherited: false,
  };
}
```

Add the public method to the `AnalyzerService` class (after `lookupProperty`):

```ts
  /**
   * Assemble the address-driven prefill bundle. Geo layer is resolved for all
   * tiers; the RentCast parcel layer is added only for Pro callers and
   * overrides geo values where present. Fields with no data source become
   * honest estimates. Never throws — failures degrade to nulls/estimates.
   */
  async getPrefillBundle(
    query: AnalyzerPrefillQueryDto,
    ctx: { isPro: boolean; now?: Date },
  ): Promise<AnalyzerPrefillDto> {
    const now = ctx.now ?? new Date();
    const zip = query.zip ?? null;

    const [metrics, chainSteps] = await Promise.all([
      zip
        ? this.metricResolution
            .resolveMetricBatch(['rent_index', 'home_value', 'home_value_yoy'], 'zip', zip)
            .catch(() => ({}) as Record<string, ResolvedMetric>)
        : Promise.resolve({} as Record<string, ResolvedMetric>),
      zip
        ? this.geographyChain.getInheritanceChain('zip', zip).catch(() => [] as GeoChainStep[])
        : Promise.resolve([] as GeoChainStep[]),
    ]);

    const chain = chainSteps.reduce<Record<string, string>>((acc, s) => {
      acc[s.level] = s.id;
      return acc;
    }, {});

    // Geo-layer fields. Free-tier price proxy (ZHVI) is capped at grade C.
    const appreciation = dataField(metrics.home_value_yoy, now, 'Realtor');
    let price = dataField(metrics.home_value, now, 'Zillow ZHVI', { capPct: 60 });
    let rentMonthly = dataField(metrics.rent_index, now, 'Zillow ZORI');
    let taxAnnual = estimateField(
      estimateTaxAnnual(price.value),
      'market',
    );
    let hoaMonthly = estimateField(0, 'constant');

    const notes: string[] = [];
    let resolvedAddress: string | null = null;
    let hasParcelData = false;

    // Parcel layer (Pro + address only).
    if (ctx.isPro && query.address) {
      try {
        const parcel = await this.lookupProperty(query.address);
        resolvedAddress = parcel.resolved_address ?? null;
        if (parcel.avm?.value != null) price = parcelField(parcel.avm.value, null);
        if (parcel.rent?.value != null) rentMonthly = parcelField(parcel.rent.value, null);
        const taxes = parcel.property_record?.propertyTaxes ?? [];
        const latestTax = taxes.length > 0 ? taxes[0] : null;
        if (latestTax?.total != null) {
          taxAnnual = parcelField(latestTax.total, String(latestTax.year));
        }
        const hoa = parcel.property_record?.hoaFee;
        if (hoa != null) hoaMonthly = parcelField(hoa, null);
        hasParcelData = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`[getPrefillBundle] RentCast parcel layer failed: ${message}`);
        notes.push('Parcel data unavailable — showing market estimates.');
      }
    }

    const insuranceAnnual = estimateField(estimateInsuranceAnnual(price.value), 'constant');
    const vacancyPctOfRent = estimateField(estimateVacancyFraction(), 'constant');
    const rentGrowthPct = estimateField(
      estimateRentGrowthFraction(appreciation.value),
      'market',
    );

    return {
      resolvedAddress,
      geo: {
        zip,
        countyFips: chain.county ?? null,
        cbsaCode: chain.metro ?? null,
        state: chain.state ?? null,
      },
      hasParcelData,
      fields: {
        price,
        rentMonthly,
        taxAnnual,
        insuranceAnnual,
        hoaMonthly,
        vacancyPctOfRent,
        appreciationPct: appreciation,
        rentGrowthPct,
      },
      notes,
    };
  }
```

> Note: `appreciationPct` field carries the raw `home_value_yoy` **percent** (e.g. 6.2). The frontend converts to the assumptions fraction (÷100) at apply time (Task 10).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/analyzer/analyzer-prefill.service.spec.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/analyzer/analyzer.service.ts packages/backend/src/analyzer/analyzer-prefill.service.spec.ts
git commit -m "feat(analyzer): getPrefillBundle assembles tier-aware prefill bundle"
```

---

## Task 7: Wire the controller route

**Files:**

- Modify: `packages/backend/src/analyzer/analyzer.controller.ts`
- Test: `packages/backend/src/analyzer/analyzer-prefill.controller.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/analyzer/analyzer-prefill.controller.spec.ts
import { AnalyzerController } from "./analyzer.controller";

function makeController(isPro: boolean) {
  const service = {
    getPrefillBundle: jest
      .fn()
      .mockResolvedValue({ hasParcelData: isPro, fields: {}, notes: [] }),
  };
  const tierGate = {
    isPro: jest.fn().mockResolvedValue(isPro),
    requirePro: jest.fn(),
  };
  const controller = new AnalyzerController(
    service as never,
    {} as never,
    tierGate as never,
    {} as never,
  );
  return { controller, service, tierGate };
}

describe("AnalyzerController.getPrefill", () => {
  it("passes isPro=false for anonymous requests", async () => {
    const { controller, service, tierGate } = makeController(false);
    const req = { userId: undefined } as never;
    await controller.getPrefill(req, { zip: "78702" } as never);
    expect(tierGate.isPro).toHaveBeenCalledWith(undefined);
    expect(service.getPrefillBundle).toHaveBeenCalledWith(
      { zip: "78702" },
      { isPro: false },
    );
  });

  it("passes isPro=true when the authed user is Pro", async () => {
    const { controller, service } = makeController(true);
    const req = { userId: "u1" } as never;
    await controller.getPrefill(req, {
      zip: "78702",
      address: "1 Main St",
    } as never);
    expect(service.getPrefillBundle).toHaveBeenCalledWith(
      { zip: "78702", address: "1 Main St" },
      { isPro: true },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/analyzer/analyzer-prefill.controller.spec.ts`
Expected: FAIL — `controller.getPrefill is not a function`.

- [ ] **Step 3: Add the route**

In `packages/backend/src/analyzer/analyzer.controller.ts`:

Add to the imports — extend the `@nestjs/common` import with `Req`, add `express` `Request`, the new guard, and the query DTO:

```ts
import { Req } from "@nestjs/common";
import type { Request } from "express";
import { OptionalJwtAuthGuard } from "../common/guards";
import { AnalyzerPrefillQueryDto } from "./dto/analyzer-prefill.dto";
```

(`import type { Response } from 'express';` already exists — change it to `import type { Request, Response } from 'express';` instead of adding a duplicate.)

Add the route method to the class (right after `getMarketContext`):

```ts
  /**
   * GET /api/analyzer/prefill?zip=78702&address=<string>
   *
   * Address-driven prefill bundle. Serves ALL tiers from one route via the
   * optional JWT guard: anonymous/free get the geo layer + estimates; Pro
   * callers additionally get the RentCast parcel layer. Each field carries
   * source + as-of + A/B/C/F confidence. Never 401s.
   */
  @Get('prefill')
  @UseGuards(OptionalJwtAuthGuard)
  async getPrefill(
    @Req() req: Request & { userId?: string },
    @Query() query: AnalyzerPrefillQueryDto,
  ) {
    const isPro = await this.tierGate.isPro(req.userId);
    return this.service.getPrefillBundle(query, { isPro });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/analyzer/analyzer-prefill.controller.spec.ts`
Expected: PASS.

- [ ] **Step 5: Full backend type-check + analyzer suite**

Run: `cd packages/backend && npx tsc --noEmit -p tsconfig.json && npx jest src/analyzer`
Expected: no type errors; all analyzer specs pass.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/analyzer/analyzer.controller.ts packages/backend/src/analyzer/analyzer-prefill.controller.spec.ts
git commit -m "feat(analyzer): GET /api/analyzer/prefill route (optional auth, all tiers)"
```

---

## Task 8: Mapbox address-geocode fetcher + ZIP parser

**Files:**

- Create: `packages/frontend/lib/data/fetchers/address-geocode.ts`
- Test: `packages/frontend/lib/data/fetchers/address-geocode.spec.ts`

The pure `featureToSuggestion` parser is unit-tested; the network call is thin.

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/lib/data/fetchers/address-geocode.spec.ts
import { featureToSuggestion } from "./address-geocode";

describe("featureToSuggestion", () => {
  it("extracts label, center, and ZIP from a Mapbox address feature", () => {
    const feature = {
      id: "address.1",
      place_type: ["address"],
      place_name: "123 Main St, Austin, Texas 78702, United States",
      text: "Main St",
      center: [-97.72, 30.26],
      context: [
        { id: "postcode.1", text: "78702" },
        { id: "place.1", text: "Austin" },
        { id: "region.1", text: "Texas", short_code: "US-TX" },
      ],
    };
    expect(featureToSuggestion(feature as never)).toEqual({
      id: "address.1",
      label: "123 Main St, Austin, Texas 78702, United States",
      lng: -97.72,
      lat: 30.26,
      zip: "78702",
    });
  });

  it("reads ZIP from a postcode-type feature itself", () => {
    const feature = {
      id: "postcode.2",
      place_type: ["postcode"],
      place_name: "78702, Texas, United States",
      text: "78702",
      center: [-97.7, 30.25],
      context: [{ id: "region.1", text: "Texas" }],
    };
    expect(featureToSuggestion(feature as never).zip).toBe("78702");
  });

  it("returns null zip when none present", () => {
    const feature = {
      id: "address.3",
      place_type: ["address"],
      place_name: "Somewhere",
      text: "x",
      center: [0, 0],
      context: [],
    };
    expect(featureToSuggestion(feature as never).zip).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx jest lib/data/fetchers/address-geocode.spec.ts`
Expected: FAIL — "Cannot find module './address-geocode'".

- [ ] **Step 3: Write the fetcher**

```ts
// packages/frontend/lib/data/fetchers/address-geocode.ts
/**
 * Street-address geocoding for the Deal Analyzer's address autocomplete.
 *
 * Uses Mapbox Geocoding (types=address,postcode) — the platform already ships
 * a public Mapbox token for the map. This is the ONLY place the analyzer
 * resolves a typed address to a ZIP for free-tier geo prefill (RentCast does
 * its own geocoding for Pro parcel lookups). Markets are deliberately excluded
 * (types is address+postcode only) so the analyzer stays property-entry.
 */

export interface AddressSuggestion {
  id: string;
  label: string;
  lng: number;
  lat: number;
  zip: string | null;
}

interface MapboxFeature {
  id: string;
  place_type: string[];
  place_name: string;
  text: string;
  center: [number, number];
  context?: { id: string; text: string; short_code?: string }[];
}

/** Pure: map a Mapbox feature to our suggestion shape (unit-tested). */
export function featureToSuggestion(feature: MapboxFeature): AddressSuggestion {
  const zipFromSelf = feature.place_type.includes("postcode")
    ? feature.text
    : null;
  const zipFromContext =
    feature.context?.find((c) => c.id.startsWith("postcode"))?.text ?? null;
  const zipRaw = zipFromSelf ?? zipFromContext;
  const zip = zipRaw && /^\d{5}$/.test(zipRaw) ? zipRaw : null;
  return {
    id: feature.id,
    label: feature.place_name,
    lng: feature.center[0],
    lat: feature.center[1],
    zip,
  };
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export async function geocodeAddress(
  query: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 4 || !MAPBOX_TOKEN) return [];
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json` +
    `?access_token=${MAPBOX_TOKEN}&country=us&types=address,postcode&autocomplete=true&limit=5`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: MapboxFeature[] };
    return (data.features ?? []).map(featureToSuggestion);
  } catch {
    return [];
  }
}
```

> Verify the env var name: confirm the existing map uses `NEXT_PUBLIC_MAPBOX_TOKEN` (grep `NEXT_PUBLIC_MAPBOX` in `packages/frontend`). If the project uses `mapboxgl.accessToken` set from a differently-named var, use that exact name here.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx jest lib/data/fetchers/address-geocode.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/data/fetchers/address-geocode.ts packages/frontend/lib/data/fetchers/address-geocode.spec.ts
git commit -m "feat(analyzer): Mapbox street-address geocode fetcher + ZIP parser"
```

---

## Task 9: Prefill fetcher + hooks + data-layer exports

**Files:**

- Create: `packages/frontend/lib/data/fetchers/analyzer-prefill.ts`
- Create: `packages/frontend/lib/data/hooks/useAnalyzerPrefill.ts`
- Create: `packages/frontend/lib/data/hooks/useAddressGeocode.ts`
- Modify: `packages/frontend/lib/data/index.ts`

- [ ] **Step 1: Write the prefill fetcher**

```ts
// packages/frontend/lib/data/fetchers/analyzer-prefill.ts
/**
 * Fetcher for the address-driven prefill bundle (GET /api/analyzer/prefill).
 * Types mirror the backend AnalyzerPrefillDto. Auth headers are sent when
 * available so Pro callers get the parcel layer; anonymous calls still work.
 */
import { API_URL } from "./base";
import { getAuthHeaders } from "./auth-headers";

export type PrefillConfidenceGrade = "a" | "b" | "c" | "f";

export type PrefillFieldKey =
  | "price"
  | "rentMonthly"
  | "taxAnnual"
  | "insuranceAnnual"
  | "hoaMonthly"
  | "vacancyPctOfRent"
  | "appreciationPct"
  | "rentGrowthPct";

export interface PrefillField {
  value: number | null;
  source: string | null;
  asOf: string | null;
  confidence: { grade: PrefillConfidenceGrade; pct: number };
  kind: "data" | "estimate";
  geoLevel: "parcel" | "zip" | "county" | "metro" | "state" | null;
  inherited: boolean;
}

export interface AnalyzerPrefillBundle {
  resolvedAddress: string | null;
  geo: {
    zip: string | null;
    countyFips: string | null;
    cbsaCode: string | null;
    state: string | null;
  };
  hasParcelData: boolean;
  fields: Record<PrefillFieldKey, PrefillField>;
  notes: string[];
}

export interface AnalyzerPrefillParams {
  zip?: string;
  address?: string;
}

export async function fetchAnalyzerPrefill(
  params: AnalyzerPrefillParams,
): Promise<AnalyzerPrefillBundle | null> {
  const qs = new URLSearchParams();
  if (params.zip) qs.set("zip", params.zip);
  if (params.address) qs.set("address", params.address);

  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/analyzer/prefill?${qs}`, {
    credentials: "include",
    headers: { ...authHeaders },
  });
  if (!res.ok) return null;
  return res.json();
}
```

- [ ] **Step 2: Write the prefill hook**

```ts
// packages/frontend/lib/data/hooks/useAnalyzerPrefill.ts
import { useMutation } from "@tanstack/react-query";
import {
  fetchAnalyzerPrefill,
  type AnalyzerPrefillBundle,
  type AnalyzerPrefillParams,
} from "../fetchers/analyzer-prefill";

/**
 * Mutation-style hook: prefill fires on an explicit address selection, not on
 * every keystroke. Returns the bundle (or null) for the caller to apply.
 */
export function useAnalyzerPrefill() {
  return useMutation<
    AnalyzerPrefillBundle | null,
    Error,
    AnalyzerPrefillParams
  >({
    mutationFn: (params) => fetchAnalyzerPrefill(params),
  });
}
```

- [ ] **Step 3: Write the geocode hook**

```ts
// packages/frontend/lib/data/hooks/useAddressGeocode.ts
import { useEffect, useRef, useState } from "react";
import {
  geocodeAddress,
  type AddressSuggestion,
} from "../fetchers/address-geocode";

/**
 * Debounced street-address autocomplete. Aborts the in-flight request when the
 * query changes so suggestions never arrive out of order.
 */
export function useAddressGeocode(query: string, debounceMs = 250) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      geocodeAddress(query, controller.signal)
        .then((next) => setSuggestions(next))
        .finally(() => setLoading(false));
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [query, debounceMs]);

  return { suggestions, loading };
}
```

- [ ] **Step 4: Export from the data layer**

In `packages/frontend/lib/data/index.ts`, add (match the file's existing export style):

```ts
export {
  fetchAnalyzerPrefill,
  type AnalyzerPrefillBundle,
  type AnalyzerPrefillParams,
  type PrefillField,
  type PrefillFieldKey,
  type PrefillConfidenceGrade,
} from "./fetchers/analyzer-prefill";
export {
  geocodeAddress,
  type AddressSuggestion,
} from "./fetchers/address-geocode";
export { useAnalyzerPrefill } from "./hooks/useAnalyzerPrefill";
export { useAddressGeocode } from "./hooks/useAddressGeocode";
```

- [ ] **Step 5: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no new errors in the added files.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/lib/data/fetchers/analyzer-prefill.ts packages/frontend/lib/data/hooks/useAnalyzerPrefill.ts packages/frontend/lib/data/hooks/useAddressGeocode.ts packages/frontend/lib/data/index.ts
git commit -m "feat(analyzer): prefill + address-geocode fetchers and hooks"
```

---

## Task 10: Apply the bundle in `use-analyzer-state.ts`

**Files:**

- Modify: `packages/frontend/app/(app)/analyzer/lib/use-analyzer-state.ts`

This replaces the RentCast price/rent-only sync (lines ~134–150) with bundle application, builds a provenance map, and records baselines for divergence detection. The provenance map keys match `PrefillFieldKey` plus the assumption fields we write.

- [ ] **Step 1: Add the provenance type + apply logic**

Add imports at the top of `use-analyzer-state.ts`:

```ts
import {
  useAnalyzerPrefill,
  type AnalyzerPrefillBundle,
  type PrefillField,
} from "@/lib/data";
```

Add this exported type and helper near the top (after `extractZip`):

```ts
/** Provenance for one prefilled field, kept beside the plain-number input. */
export interface FieldProvenance extends PrefillField {
  /** The prefilled value we set, used to detect user overrides (>30%). */
  baseline: number | null;
}

export type ProvenanceMap = Partial<Record<string, FieldProvenance>>;

/** True when `current` diverges from `baseline` by more than 30%. */
export function isDivergent(
  baseline: number | null,
  current: number | null,
): boolean {
  if (baseline == null || baseline === 0 || current == null) return false;
  return Math.abs(current - baseline) / Math.abs(baseline) > 0.3;
}
```

Inside `useAnalyzerState`, add state for provenance and the prefill mutation (near the existing `usePropertyLookup()` call):

```ts
const [provenance, setProvenance] = useState<ProvenanceMap>({});
const prefill = useAnalyzerPrefill();
```

Add this function inside the hook (before the `return`):

```ts
/**
 * Apply a prefill bundle: write data/estimate values into the analyzer input
 * and assumptions, and record provenance + baselines. appreciationPct comes
 * back as a PERCENT (e.g. 6.2) and is stored as a FRACTION in assumptions.
 */
const applyPrefillBundle = (bundle: AnalyzerPrefillBundle) => {
  const f = bundle.fields;
  analyzer.setInput((prev) => ({
    ...prev,
    price: f.price.value ?? prev.price,
    rentMonthly: f.rentMonthly.value ?? prev.rentMonthly,
    taxAnnual: f.taxAnnual.value ?? prev.taxAnnual,
    insuranceAnnual: f.insuranceAnnual.value ?? prev.insuranceAnnual,
    hoaMonthly: f.hoaMonthly.value ?? prev.hoaMonthly,
    vacancyPctOfRent: f.vacancyPctOfRent.value ?? prev.vacancyPctOfRent,
  }));
  setAssumptionsState((prev) => ({
    ...prev,
    appreciationPct:
      f.appreciationPct.value != null
        ? f.appreciationPct.value / 100
        : prev.appreciationPct,
    rentGrowthPct: f.rentGrowthPct.value ?? prev.rentGrowthPct,
  }));
  setProvenance({
    price: { ...f.price, baseline: f.price.value },
    rentMonthly: { ...f.rentMonthly, baseline: f.rentMonthly.value },
    taxAnnual: { ...f.taxAnnual, baseline: f.taxAnnual.value },
    insuranceAnnual: {
      ...f.insuranceAnnual,
      baseline: f.insuranceAnnual.value,
    },
    hoaMonthly: { ...f.hoaMonthly, baseline: f.hoaMonthly.value },
    vacancyPctOfRent: {
      ...f.vacancyPctOfRent,
      baseline: f.vacancyPctOfRent.value,
    },
    appreciationPct: {
      ...f.appreciationPct,
      baseline: f.appreciationPct.value,
    },
    rentGrowthPct: { ...f.rentGrowthPct, baseline: f.rentGrowthPct.value },
  });
};
```

- [ ] **Step 2: Replace the RentCast-only sync**

Replace the existing RentCast sync effect (the block at ~lines 134–150 that sets only `price`/`rentMonthly` and ARV) with one that defers field prefill to the bundle but keeps the ARV convenience default:

```ts
// RentCast still seeds ARV for flip/BRRRR; field prefill now flows through
// the prefill bundle (applyPrefillBundle), so we no longer set price/rent here.
const lastSyncedRef = useRef<PropertyLookupResult | null>(null);
useEffect(() => {
  if (!rentcastData || rentcastData === lastSyncedRef.current) return;
  lastSyncedRef.current = rentcastData;
  if (rentcastData.avm?.value && arvLocal === 0) {
    setArvLocal(Math.round(rentcastData.avm.value * 1.15));
  }
}, [rentcastData, arvLocal]);
```

- [ ] **Step 3: Export the new values from the hook**

Add to the `return { ... }` object of `useAnalyzerState`:

```ts
    provenance,
    applyPrefillBundle,
    prefill,
```

- [ ] **Step 4: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/lib/use-analyzer-state.ts"
git commit -m "feat(analyzer): apply prefill bundle to input + assumptions with provenance"
```

---

## Task 11: `FieldProvenance` stamp component

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/components/InputPanel/FieldProvenance.tsx`

Renders the per-field `source · as of {date} · grade` stamp, reusing `ConfidenceDisplay`. Estimates render muted with an "Estimate" tag.

- [ ] **Step 1: Write the component**

```tsx
// packages/frontend/app/(app)/analyzer/components/InputPanel/FieldProvenance.tsx
"use client";

import { ConfidenceDisplay } from "@/app/components/scoring";
import type { FieldProvenance as FieldProvenanceData } from "../../lib/use-analyzer-state";

interface FieldProvenanceProps {
  data: FieldProvenanceData | undefined;
  /** Current field value, for the divergence warning. */
  current: number | null;
  divergent: boolean;
}

function freshnessDays(asOf: string | null): number {
  if (!asOf) return 999;
  const d = /^\d{4}$/.test(asOf) ? new Date(`${asOf}-12-31`) : new Date(asOf);
  if (Number.isNaN(d.getTime())) return 999;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}

export function FieldProvenance({
  data,
  current,
  divergent,
}: FieldProvenanceProps) {
  if (!data) return null;
  const isEstimate = data.kind === "estimate";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
      <ConfidenceDisplay
        level={data.confidence.grade}
        percentage={data.confidence.pct}
        metricsAvailable={data.value == null ? 0 : 1}
        metricsTotal={1}
        freshnessInDays={freshnessDays(data.asOf)}
        size="sm"
      />
      <span
        className={
          isEstimate
            ? "text-on-surface-variant italic"
            : "text-on-surface-variant"
        }
      >
        {isEstimate ? "Estimate" : data.source}
        {data.asOf && !isEstimate ? ` · as of ${data.asOf}` : ""}
        {data.inherited ? " · inherited" : ""}
      </span>
      {divergent && (
        <span className="text-warning font-medium">
          {data.baseline != null
            ? `${Math.abs((current ?? 0) / data.baseline).toFixed(1)}× the ${
                isEstimate ? "estimate" : "market value"
              }`
            : "differs sharply from market"}
        </span>
      )}
    </div>
  );
}
```

> Confirm the `ConfidenceDisplay` import path resolves from this file (the scoring barrel is `app/components/scoring/index.ts`). If `ConfidenceDisplay` isn't re-exported there, import it directly from `@/app/components/scoring/ConfidenceDisplay`.

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/components/InputPanel/FieldProvenance.tsx"
git commit -m "feat(analyzer): per-field source/as-of/confidence stamp component"
```

---

## Task 12: `AddressAutocomplete` component

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/components/InputPanel/AddressAutocomplete.tsx`

- [ ] **Step 1: Write the component**

```tsx
// packages/frontend/app/(app)/analyzer/components/InputPanel/AddressAutocomplete.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useAddressGeocode, type AddressSuggestion } from "@/lib/data";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
}

/**
 * Street-address autocomplete for the Deal Analyzer. Styled to match the map's
 * SearchWidget but resolves ADDRESSES (not markets) via Mapbox, keeping the
 * analyzer strictly property-entry.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter a property address",
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const { suggestions, loading } = useAddressGeocode(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full h-12 rounded-full border border-outline bg-surface px-4 text-sm text-on-surface focus:border-primary focus:outline-none"
      />
      {open && (loading || suggestions.length > 0) && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-lg">
          {loading && suggestions.length === 0 && (
            <li className="px-4 py-2 text-sm text-on-surface-variant">
              Searching…
            </li>
          )}
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(s.label);
                  onSelect(s);
                  setOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-primary-container"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/components/InputPanel/AddressAutocomplete.tsx"
git commit -m "feat(analyzer): Mapbox street-address autocomplete component"
```

---

## Task 13: Wire the input panel — autocomplete, stamps, divergence, copy

**Files:**

- Modify: `packages/frontend/app/(app)/analyzer/components/InputPanel/InputPanel.tsx`
- Modify: `packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx` (pass new props through)

This wires the new pieces together. Exact line numbers vary; the steps describe the edits precisely.

- [ ] **Step 1: Thread the new state from `AnalyzerClient` into `InputPanel`**

In `AnalyzerClient.tsx`, destructure the new values from `useAnalyzerState(...)`:

```ts
const {
  /* ...existing... */
  provenance,
  applyPrefillBundle,
  prefill,
} = state;
```

Add an address-select handler that fires prefill and applies the bundle:

```ts
const handleAddressSelect = async (s: {
  label: string;
  zip: string | null;
}) => {
  setAddress(s.label);
  const bundle = await prefill.mutateAsync({
    zip: s.zip ?? undefined,
    address: isPro ? s.label : undefined,
  });
  if (bundle) applyPrefillBundle(bundle);
};
```

Pass `provenance` and `handleAddressSelect` (and `address`, `setAddress` if not already) into `<InputPanel ... />`.

- [ ] **Step 2: Replace the address input in `InputPanel`**

At the top of `InputPanel.tsx`, import the two new components and the divergence helper:

```ts
import { AddressAutocomplete } from "./AddressAutocomplete";
import { FieldProvenance } from "./FieldProvenance";
import { isDivergent, type ProvenanceMap } from "../../lib/use-analyzer-state";
import type { AddressSuggestion } from "@/lib/data";
```

Extend the `InputPanel` props interface with:

```ts
  provenance: ProvenanceMap;
  onAddressSelect: (s: AddressSuggestion) => void;
```

Replace the existing plain address `<input>` (the "Enter a property address" text box + its fetch button) with:

```tsx
<AddressAutocomplete
  value={address}
  onChange={onAddressChange}
  onSelect={onAddressSelect}
/>
```

(Keep the existing `onAddressChange`/`address` props; the explicit "Fetch from RentCast" button may remain for Pro manual re-fetch, but selection now auto-prefills.)

- [ ] **Step 3: Render `FieldProvenance` under each prefilled field**

For each of `price`, `rentMonthly`, `taxAnnual`, `insuranceAnnual` in the main grid (and `vacancyPctOfRent`, `appreciationPct`, `rentGrowthPct` in Advanced Assumptions), add directly below the field's `NumField`:

```tsx
<FieldProvenance
  data={provenance.price}
  current={input.price}
  divergent={isDivergent(provenance.price?.baseline ?? null, input.price)}
/>
```

Repeat with the matching key/value for each field (e.g. `provenance.rentMonthly` + `input.rentMonthly`, `provenance.taxAnnual` + `input.taxAnnual`, etc.). For assumptions-backed fields use the assumptions value (e.g. `assumptions.appreciationPct * 100` is NOT needed for divergence — compare against the stored fraction baseline; the provenance baseline for `appreciationPct` is the percent, so compare `assumptions.appreciationPct * 100`).

> Consistency note: `appreciationPct` provenance baseline is a PERCENT; the assumptions value is a FRACTION. Pass `current={assumptions.appreciationPct * 100}` for that one field so divergence math matches units.

- [ ] **Step 4: Update the empty-state copy**

Replace the analyzer empty-state primary instruction (currently the Pro-only RentCast CTA) with the value-prop line. Find the empty-state text in `InputPanel.tsx` (or the empty-state section component) and set it to:

```tsx
<p className="text-sm text-on-surface-variant">
  2-minute analysis, zero spreadsheet — enter an address and we’ll fill in the
  market data.
</p>
```

- [ ] **Step 5: Verify it renders (local dev, live)**

Per team rule (no mock UI verification): start the dev servers (use the `local-dev-servers` skill), open `http://localhost:3000/analyzer`, and confirm the page renders with the new address box and empty-state copy, with no console errors.

Run (type-check gate first): `cd packages/frontend && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/components/InputPanel/InputPanel.tsx" "packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx"
git commit -m "feat(analyzer): wire address autocomplete, field stamps, divergence, entry copy"
```

---

## Task 14: Live E2E across tiers (real DB, no mocks)

**Files:**

- Create: `packages/frontend/e2e/analyzer-prefill.spec.ts` (use the repo's existing Playwright dir/config — confirm location first)

This validates the backlog acceptance criteria against live data. It requires the dev servers running (or the deployed env) and real test accounts for free + Pro.

- [ ] **Step 1: Confirm the Playwright setup**

Find the existing Playwright config and a sample spec: `grep -rl "@playwright/test" packages/frontend` and note the test directory + how auth/session is established for free vs Pro accounts (reuse the existing pattern — do not invent a new auth flow).

- [ ] **Step 2: Write the E2E spec**

```ts
// packages/frontend/e2e/analyzer-prefill.spec.ts
import { test, expect } from "@playwright/test";

const ADDRESS = "2502 E 5th St, Austin, TX 78702";

test.describe("analyzer address prefill", () => {
  test("anonymous: geo prefill with stamps; estimates labeled", async ({
    page,
  }) => {
    await page.goto("/analyzer");
    await page.getByPlaceholder("Enter a property address").fill(ADDRESS);
    await page.getByRole("button", { name: /78702/ }).first().click();

    // Rent prefilled with a non-null value + a source stamp.
    const rent = page.getByLabel(/monthly rent/i);
    await expect(rent).not.toHaveValue("");
    await expect(page.getByText(/as of/i).first()).toBeVisible();

    // Insurance is an estimate.
    await expect(page.getByText("Estimate").first()).toBeVisible();
  });

  test("anonymous: prefilled rent matches the live metric layer", async ({
    page,
    request,
  }) => {
    // Direct API call = the resolveMetricBatch source of truth for this geo.
    const api = await request.get("/api/analyzer/prefill?zip=78702");
    const bundle = await api.json();
    const expectedRent = String(bundle.fields.rentMonthly.value);

    await page.goto("/analyzer");
    await page.getByPlaceholder("Enter a property address").fill(ADDRESS);
    await page.getByRole("button", { name: /78702/ }).first().click();
    await expect(page.getByLabel(/monthly rent/i)).toHaveValue(expectedRent);
  });

  test("override prefilled rent by 2x shows divergence flag", async ({
    page,
  }) => {
    await page.goto("/analyzer");
    await page.getByPlaceholder("Enter a property address").fill(ADDRESS);
    await page.getByRole("button", { name: /78702/ }).first().click();
    const rent = page.getByLabel(/monthly rent/i);
    const current = Number(await rent.inputValue());
    await rent.fill(String(current * 2));
    await expect(
      page.getByText(/× the (market value|estimate)/i),
    ).toBeVisible();
  });

  test("all tiers: analyzer page renders without crashing", async ({
    page,
  }) => {
    await page.goto("/analyzer");
    await expect(page.getByText(/2-minute analysis/i)).toBeVisible();
  });
});
```

> Add a Pro-authenticated variant (reusing the repo's existing storageState/login fixture) asserting `taxAnnual` is sourced from RentCast (source text "RentCast") and carries a year as-of — mirroring the anonymous test but with the Pro session.

- [ ] **Step 3: Run the E2E suite**

Run: `cd packages/frontend && npx playwright test e2e/analyzer-prefill.spec.ts`
Expected: PASS against the running dev servers / live DB. Debug failures against real data — do not mock.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/e2e/analyzer-prefill.spec.ts
git commit -m "test(analyzer): live E2E for address prefill across tiers"
```

---

## Task 15: Final verification sweep

- [ ] **Step 1: Backend** — `cd packages/backend && npx jest src/analyzer src/common/guards && npx tsc --noEmit -p tsconfig.json` → all pass, no type errors.
- [ ] **Step 2: Frontend** — `cd packages/frontend && npx tsc --noEmit && npx jest lib/data/fetchers/address-geocode.spec.ts` → pass.
- [ ] **Step 3: Live render** — with dev servers up, load `/analyzer` as anonymous, free, and Pro; confirm prefill fires, stamps render, estimates are labeled, divergence warns, and there is no `analyzer-core` dist crash (per acceptance criteria).
- [ ] **Step 4: Acceptance-criteria checklist** — tick each box in spec §12 with evidence (screenshots / API diffs).
- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore(analyzer): address-prefill verification fixes"
```

---

## Self-review notes (author)

- **Spec coverage:** §5 architecture → Tasks 6/7; §6 contract → Task 3; §7 field mapping → Task 6; §8 grades → Task 1; estimates (§4.2) → Task 2; §9 UX (autocomplete/stamps/divergence/copy) → Tasks 8–13; §10 error handling → Task 6 (quota fallback, null geo) + Task 5 (never-401); §11 testing → Tasks 1–7 unit + Task 14 E2E; §12 acceptance → Task 15.
- **Type consistency:** `ConfidenceGrade`/`PrefillGeoLevel` originate in `prefill-grade.ts` and are reused by the DTO and frontend mirror; `PrefillField`/`AnalyzerPrefillBundle` field names match between backend DTO (Task 3) and frontend fetcher (Task 9); `applyPrefillBundle`/`provenance`/`isDivergent` names are consistent across Tasks 10–13.
- **Unit conventions:** vacancy stored as fraction (0.05); appreciation stored as fraction in assumptions but transported as percent in the bundle — conversion (÷100) is explicit in Task 10 apply + Task 13 divergence.
- **Open verification flags for the implementer:** (a) confirm `NEXT_PUBLIC_MAPBOX_TOKEN` env var name (Task 8); (b) confirm `ConfidenceDisplay` is re-exported from the scoring barrel (Task 11); (c) confirm the Playwright dir + Pro-auth fixture (Task 14).
