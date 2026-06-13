# Citable Market Data on SEO Pages (Backlog #4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put real, server-rendered, source-attributed market data — headline stats **and** the four inputs behind the PropertyIQ Score — into the initial HTML of every `/markets` SEO page, so crawlers and AI engines can cite them.

**Architecture:** Each `page.tsx` (metro/county/zip) is already a React Server Component; the visible content components are `'use client'` and fetch data client-side (invisible to crawlers). We fetch market data **server-side in `page.tsx`** via the existing public `/api/market-snapshot` + `/api/timeseries` endpoints, assemble it with a pure, unit-tested transform, and render it through a **new pure-server `MarketStatsBlock`** (plus a server SVG sparkline and JSON-LD). The score "receipts" come straight from the score's own stored `z_scores` (exposed as `scores.propertyiq.components`), so they cannot drift from the score. State pages get server-rendered top-10 ranked tables; related-markets links switch from alphabetical to same-state-by-score; the AI-insights endpoint degrades to a templated 200; SEO prose is aligned to the new four-input score; and a role-segmented capture block is added.

**Tech Stack:** Next.js 16 App Router (RSC + ISR), React 19, TypeScript, Tailwind v4; NestJS 11 backend; Supabase Postgres. Frontend tests: **vitest** + React Testing Library. Backend tests: **jest** (ts-jest).

**Spec:** `docs/superpowers/specs/2026-06-13-seo-citable-market-data-design.md`

---

## Conventions for every task

- **Branch:** work on `develop` (verify with `git branch --show-current` before each commit). No push unless the user asks.
- **Commit messages:** Conventional Commits, **no `Co-Authored-By` line** (user preference).
- **Frontend test run:** `cd packages/frontend && npm run test:unit -- <path>` (vitest). Single file: append the file path.
- **Backend test run:** `cd packages/backend && npx jest <relativePathFromSrc>` (jest, `rootDir: src`).
- **Data layer rule:** all fetching through `@/lib/data` (add fetchers, export from the barrel). Never `fetch(API_URL...)` in a component.
- **Formatting rule:** values formatted only via `formatMetricValue()` / `getMetricFormat()` from `@/lib/data`.
- After each workstream: `cd packages/frontend && npx tsc --noEmit` (and backend equivalent for backend tasks) before the commit.

---

## File Structure

**Create:**

- `packages/frontend/lib/data/fetchers/market-stats.ts` — pure `assembleMarketStats()` transform + `fetchMarketStats()` server fetcher + `MarketStatsData` types.
- `packages/frontend/lib/data/fetchers/__tests__/market-stats.test.ts` — vitest unit tests for the transform.
- `packages/frontend/lib/data/fetchers/rankings.ts` — `fetchRankings()` + `RankingRow` (wraps `/api/v1/rankings`).
- `packages/frontend/app/markets/components/MarketStatsBlock.tsx` — pure-server stats block.
- `packages/frontend/app/markets/components/StatSparkline.tsx` — pure-server inline SVG sparkline.
- `packages/frontend/app/markets/components/buildStatsJsonLd.ts` — pure JSON-LD builder.
- `packages/frontend/app/markets/components/__tests__/MarketStatsBlock.test.tsx` — vitest render tests.
- `packages/frontend/app/markets/components/StateTopMarketsTables.tsx` — pure-server top-10 tables.
- `packages/frontend/app/markets/components/PersonaCaptureBlock.tsx` — client persona capture island.
- `packages/frontend/app/markets/components/__tests__/PersonaCaptureBlock.test.tsx` — vitest interaction test.
- `packages/backend/src/insights/insights-fallback.ts` — pure deterministic fallback-prose builder.
- `packages/backend/src/insights/__tests__/insights-fallback.spec.ts` — jest unit tests.
- `packages/frontend/app/markets/__tests__/seo-content-score-copy.test.ts` — vitest regression guard for SEO prose.

**Modify:**

- `packages/frontend/lib/data/fetchers/index.ts` (+ `_groups/markets.ts`) — export new fetchers/types.
- `packages/frontend/app/markets/[slug]/page.tsx` — server-fetch + render stats block + move related-markets server-side + JSON-LD + footer.
- `packages/frontend/app/markets/county/[slug]/page.tsx` — same (related-markets already server-side).
- `packages/frontend/app/markets/zip/[slug]/page.tsx` — same.
- `packages/frontend/app/markets/[slug]/MetroPageContent.tsx` — remove client-side related-markets; swap NewsletterSignup → PersonaCaptureBlock.
- `packages/frontend/app/markets/county/[slug]/CountyPageContent.tsx` & `ZipPageContent.tsx` — swap NewsletterSignup → PersonaCaptureBlock.
- `packages/frontend/app/markets/state/[state]/page.tsx` — server-fetch rankings + render tables.
- `packages/frontend/app/markets/[slug]/generate-seo-content.ts` & `zip/[slug]/generate-seo-content.ts` — align score copy to four inputs.
- `packages/frontend/app/api/newsletter/route.ts` — extend `VALID_SOURCES`.
- `packages/backend/src/insights/insights.service.ts` — return templated fallback instead of `null`.

---

## Workstream 0 — Verification gates (do first)

### Task 0.1: Smoke-test the public market-snapshot + score receipts

**Files:** none (verification only).

- [ ] **Step 1: Start the backend and curl the endpoint anonymously**

Run (with the local backend on :3001, or substitute the Railway backend URL):

```bash
curl -s "http://localhost:3001/api/market-snapshot/metro/12420?state=TX" | python -m json.tool | head -60
```

Expected: JSON with `scores.propertyiq.{score, grade, components}` present and `components` containing `zhvi_yoy, zhvi_mom_3m, median_days_on_market, price_reduced_share`; `metrics.home_value`, `metrics.rent_index`, `metrics.days_on_market` present with `{value, date, source}`.

- [ ] **Step 2: Confirm the four receipts match the DB for one geo**

Run (Supabase SQL, project `pysflbhpnqwoczyuaaif`):

```sql
SELECT score, grade, z_scores FROM propertyiq_scores
WHERE score_type='propertyiq' AND geography='metro' AND location_id='12420'
ORDER BY score_date DESC LIMIT 1;
```

Expected: `z_scores` keys equal the curl `components`; values match. **If `components` is absent or stripped for the anonymous curl, STOP** and expose it publicly before proceeding (the design assumes it is public — recon confirms no guard, but verify against the running build).

- [ ] **Step 3: Record the as-of date and one known YoY for the formatting check later**

Run:

```sql
SELECT location_name, z_scores->>'zhvi_yoy' AS zhvi_yoy,
       z_scores->>'median_days_on_market' AS dom, score_date
FROM propertyiq_scores
WHERE score_type='propertyiq' AND geography='metro' AND location_id='12420'
ORDER BY score_date DESC LIMIT 1;
```

Note whether `zhvi_yoy` is a fraction (e.g. `0.04` = 4%) or already a percent. This decides the `×100` in Task 1.1. (Expected: fraction → multiply by 100 for display.)

No commit (verification only).

---

## Workstream 1 — Server data fetcher + pure transform

### Task 1.1: `assembleMarketStats()` pure transform + types (TDD)

**Files:**

- Create: `packages/frontend/lib/data/fetchers/market-stats.ts`
- Test: `packages/frontend/lib/data/fetchers/__tests__/market-stats.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/lib/data/fetchers/__tests__/market-stats.test.ts
import { describe, it, expect } from "vitest";
import { assembleMarketStats } from "../market-stats";
import type { MarketSnapshotResponse } from "../market-snapshot";
import type { TimeSeriesResult } from "../../types";

const snapshot: MarketSnapshotResponse = {
  success: true,
  geography: { id: "12420", name: "Austin, TX", type: "metro" },
  scores: {
    propertyiq: {
      score: 72,
      grade: "B",
      components: {
        zhvi_yoy: 0.021,
        zhvi_mom_3m: 0.008,
        median_days_on_market: 90,
        price_reduced_share: 0.18,
      },
    },
  },
  metrics: {
    home_value: {
      value: 469000,
      date: "2026-04-30",
      source: "zillow",
      sourceGeoId: "12420",
      sourceGeoLevel: "metro",
      isInherited: false,
      isFallback: false,
    },
    rent_index: {
      value: 1604,
      date: "2026-04-30",
      source: "zillow",
      sourceGeoId: "12420",
      sourceGeoLevel: "metro",
      isInherited: false,
      isFallback: false,
    },
    days_on_market: {
      value: 90,
      date: "2026-04-01",
      source: "realtor",
      sourceGeoId: "12420",
      sourceGeoLevel: "metro",
      isInherited: false,
      isFallback: false,
    },
  },
  lastUpdated: "2026-04-30",
};

const timeseries = {
  success: true,
  metric: "home_value",
  geoLevel: "metro",
  regionId: "12420",
  count: 3,
  data: [
    { date: "2025-05-31", value: 480000 },
    { date: "2025-11-30", value: 455000 },
    { date: "2026-04-30", value: 469000 },
  ],
} as unknown as TimeSeriesResult;

describe("assembleMarketStats", () => {
  it("maps headline price/rent from snapshot metrics with source+date", () => {
    const out = assembleMarketStats(snapshot, timeseries);
    expect(out.headline.medianPrice.value).toBe(469000);
    expect(out.headline.medianPrice.source).toBe("zillow");
    expect(out.headline.medianPrice.date).toBe("2026-04-30");
    expect(out.headline.rent.value).toBe(1604);
  });

  it("sources headline YoY and DOM from score components so they match the receipts", () => {
    const out = assembleMarketStats(snapshot, timeseries);
    // 0.021 fraction -> 2.1 percent units
    expect(out.headline.yoy.value).toBeCloseTo(2.1, 5);
    expect(out.headline.daysOnMarket.value).toBe(90);
    const yoyReceipt = out.receipts.find((r) => r.key === "zhvi_yoy");
    expect(yoyReceipt?.value).toBeCloseTo(2.1, 5);
  });

  it("returns all four receipts in fixed order with correct formats", () => {
    const out = assembleMarketStats(snapshot, timeseries);
    expect(out.receipts.map((r) => r.key)).toEqual([
      "zhvi_yoy",
      "zhvi_mom_3m",
      "median_days_on_market",
      "price_reduced_share",
    ]);
    expect(
      out.receipts.find((r) => r.key === "median_days_on_market")?.format,
    ).toBe("days");
    expect(
      out.receipts.find((r) => r.key === "price_reduced_share")?.value,
    ).toBeCloseTo(18, 5);
  });

  it("renders null per-field when a component is missing (low-confidence row)", () => {
    const lowConf = {
      ...snapshot,
      scores: {
        propertyiq: {
          score: 40,
          grade: "F",
          components: {
            zhvi_yoy: 0.01,
            zhvi_mom_3m: 0.002,
            median_days_on_market: null as unknown as number,
            price_reduced_share: null as unknown as number,
          },
        },
      },
    } as MarketSnapshotResponse;
    const out = assembleMarketStats(lowConf, timeseries);
    expect(
      out.receipts.find((r) => r.key === "median_days_on_market")?.value,
    ).toBeNull();
    expect(out.headline.daysOnMarket.value).toBeNull();
  });

  it("extracts a numeric sparkline series from the timeseries", () => {
    const out = assembleMarketStats(snapshot, timeseries);
    expect(out.sparkline).toEqual([480000, 455000, 469000]);
  });

  it("returns null score block when there is no score", () => {
    const noScore = {
      ...snapshot,
      scores: { propertyiq: null },
    } as MarketSnapshotResponse;
    const out = assembleMarketStats(noScore, timeseries);
    expect(out.score).toBeNull();
    expect(out.receipts.every((r) => r.value === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/frontend && npm run test:unit -- lib/data/fetchers/__tests__/market-stats.test.ts`
Expected: FAIL — `assembleMarketStats` is not exported / module not found.

- [ ] **Step 3: Implement the transform + types**

```typescript
// packages/frontend/lib/data/fetchers/market-stats.ts
import {
  fetchMarketSnapshot,
  type MarketSnapshotResponse,
} from "../market-snapshot";
import { fetchTimeSeriesData } from "./timeseries";
import type { TimeSeriesResult } from "../types";

export interface MarketStatField {
  metricId: string;
  label: string;
  value: number | null;
  source: string | null; // 'zillow' | 'realtor' | 'redfin' | 'census' | ...
  date: string | null; // period_date
}

export type ReceiptKey =
  | "zhvi_yoy"
  | "zhvi_mom_3m"
  | "median_days_on_market"
  | "price_reduced_share";

export interface ScoreReceipt {
  key: ReceiptKey;
  label: string;
  value: number | null;
  format: "percent" | "days";
}

export interface MarketStatsData {
  score: number | null;
  grade: string | null;
  headline: {
    medianPrice: MarketStatField;
    rent: MarketStatField;
    daysOnMarket: MarketStatField;
    yoy: MarketStatField;
  };
  receipts: ScoreReceipt[];
  sparkline: number[];
  latestDate: string | null;
}

const RECEIPT_DEFS: {
  key: ReceiptKey;
  label: string;
  format: "percent" | "days";
  scale: number;
}[] = [
  { key: "zhvi_yoy", label: "Home value YoY", format: "percent", scale: 100 },
  { key: "zhvi_mom_3m", label: "3-mo momentum", format: "percent", scale: 100 },
  {
    key: "median_days_on_market",
    label: "Days on market",
    format: "days",
    scale: 1,
  },
  {
    key: "price_reduced_share",
    label: "Price-reduced share",
    format: "percent",
    scale: 100,
  },
];

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function assembleMarketStats(
  snapshot: MarketSnapshotResponse,
  timeseries: TimeSeriesResult | null,
): MarketStatsData {
  const piq = snapshot.scores?.propertyiq ?? null;
  const components = piq?.components ?? {};

  const receipts: ScoreReceipt[] = RECEIPT_DEFS.map((def) => {
    const raw = num(components[def.key]);
    return {
      key: def.key,
      label: def.label,
      format: def.format,
      value: raw === null ? null : raw * def.scale,
    };
  });

  const price = snapshot.metrics?.home_value;
  const rent = snapshot.metrics?.rent_index;
  const yoyReceipt = receipts.find((r) => r.key === "zhvi_yoy")!;
  const domReceipt = receipts.find((r) => r.key === "median_days_on_market")!;

  const dates = [
    price?.date,
    rent?.date,
    snapshot.metrics?.days_on_market?.date,
    snapshot.lastUpdated,
  ]
    .filter((d): d is string => Boolean(d))
    .sort();
  const latestDate = dates.length ? dates[dates.length - 1] : null;

  return {
    score: piq ? Math.round(piq.score) : null,
    grade: piq?.grade ?? null,
    headline: {
      medianPrice: {
        metricId: "home_value",
        label: "Median Price",
        value: num(price?.value),
        source: price?.source ?? null,
        date: price?.date ?? null,
      },
      rent: {
        metricId: "rent_index",
        label: "Rent (ZORI)",
        value: num(rent?.value),
        source: rent?.source ?? null,
        date: rent?.date ?? null,
      },
      // YoY and DOM come from the score's own inputs so the headline can never contradict the receipts strip.
      daysOnMarket: {
        metricId: "days_on_market",
        label: "Median DOM",
        value: domReceipt.value,
        source: "realtor",
        date: snapshot.metrics?.days_on_market?.date ?? null,
      },
      yoy: {
        metricId: "home_value_yoy",
        label: "YoY",
        value: yoyReceipt.value,
        source: "zillow",
        date: price?.date ?? null,
      },
    },
    receipts,
    sparkline: (timeseries?.data ?? [])
      .map((p) => p.value)
      .filter((v): v is number => typeof v === "number"),
    latestDate,
  };
}

export async function fetchMarketStats(
  geoType: "metro" | "county" | "zip",
  geoId: string,
  state?: string,
): Promise<MarketStatsData | null> {
  try {
    const [snapshot, timeseries] = await Promise.all([
      fetchMarketSnapshot(geoType, geoId, state),
      fetchTimeSeriesData("home_value", geoType, geoId, {
        historyMonths: 12,
      }).catch(() => null),
    ]);
    if (!snapshot?.success) return null;
    return assembleMarketStats(snapshot, timeseries);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/frontend && npm run test:unit -- lib/data/fetchers/__tests__/market-stats.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Export from the data-layer barrel**

In `packages/frontend/lib/data/fetchers/_groups/markets.ts`, add:

```typescript
export { fetchMarketStats, assembleMarketStats } from "../market-stats";
export type {
  MarketStatsData,
  MarketStatField,
  ScoreReceipt,
  ReceiptKey,
} from "../market-stats";
```

Verify it re-exports through `lib/data/fetchers/index.ts` → `lib/data/index.ts` (which does `export * from "./fetchers"`). If `_groups/markets.ts` does not exist, add the same two lines to `lib/data/fetchers/index.ts` directly.

- [ ] **Step 6: Typecheck + commit**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no new errors.

```bash
git add packages/frontend/lib/data/fetchers/market-stats.ts packages/frontend/lib/data/fetchers/__tests__/market-stats.test.ts packages/frontend/lib/data/fetchers/_groups/markets.ts
git commit -m "feat(seo): add server-side market-stats assembler reading score receipts from z_scores"
```

---

## Workstream 2 — `MarketStatsBlock` server component

### Task 2.1: Server SVG sparkline (TDD)

**Files:**

- Create: `packages/frontend/app/markets/components/StatSparkline.tsx`
- Test: `packages/frontend/app/markets/components/__tests__/MarketStatsBlock.test.tsx` (shared test file; sparkline assertions added here)

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/markets/components/__tests__/MarketStatsBlock.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatSparkline } from "../StatSparkline";

describe("StatSparkline", () => {
  it("renders an inline svg polyline for >=2 points (no JS needed)", () => {
    const { container } = render(<StatSparkline data={[10, 20, 15, 30]} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(container.querySelector("polyline")).toBeTruthy();
  });

  it("renders nothing for fewer than 2 points", () => {
    const { container } = render(<StatSparkline data={[10]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/frontend && npm run test:unit -- app/markets/components/__tests__/MarketStatsBlock.test.tsx`
Expected: FAIL — cannot find `../StatSparkline`.

- [ ] **Step 3: Implement the sparkline (pure server component)**

```tsx
// packages/frontend/app/markets/components/StatSparkline.tsx
// Pure server component: static inline SVG, no 'use client', no hooks.
interface StatSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function StatSparkline({
  data,
  width = 120,
  height = 32,
  className,
}: StatSparklineProps) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="12-month trend"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      />
    </svg>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/frontend && npm run test:unit -- app/markets/components/__tests__/MarketStatsBlock.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/markets/components/StatSparkline.tsx packages/frontend/app/markets/components/__tests__/MarketStatsBlock.test.tsx
git commit -m "feat(seo): server-rendered SVG sparkline for market stats block"
```

### Task 2.2: `MarketStatsBlock` (TDD)

**Files:**

- Create: `packages/frontend/app/markets/components/MarketStatsBlock.tsx`
- Test: append to `packages/frontend/app/markets/components/__tests__/MarketStatsBlock.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to the existing test file:

```tsx
import { MarketStatsBlock } from "../MarketStatsBlock";
import type { MarketStatsData } from "@/lib/data";

const data: MarketStatsData = {
  score: 72,
  grade: "B",
  headline: {
    medianPrice: {
      metricId: "home_value",
      label: "Median Price",
      value: 469000,
      source: "zillow",
      date: "2026-04-30",
    },
    rent: {
      metricId: "rent_index",
      label: "Rent (ZORI)",
      value: 1604,
      source: "zillow",
      date: "2026-04-30",
    },
    daysOnMarket: {
      metricId: "days_on_market",
      label: "Median DOM",
      value: 90,
      source: "realtor",
      date: "2026-04-01",
    },
    yoy: {
      metricId: "home_value_yoy",
      label: "YoY",
      value: 2.1,
      source: "zillow",
      date: "2026-04-30",
    },
  },
  receipts: [
    { key: "zhvi_yoy", label: "Home value YoY", value: 2.1, format: "percent" },
    {
      key: "zhvi_mom_3m",
      label: "3-mo momentum",
      value: 0.8,
      format: "percent",
    },
    {
      key: "median_days_on_market",
      label: "Days on market",
      value: 90,
      format: "days",
    },
    {
      key: "price_reduced_share",
      label: "Price-reduced share",
      value: null,
      format: "percent",
    },
  ],
  sparkline: [480000, 455000, 469000],
  latestDate: "2026-04-30",
};

describe("MarketStatsBlock", () => {
  it("renders headline values in server HTML", () => {
    const { container } = render(
      <MarketStatsBlock data={data} geoName="Austin, TX" />,
    );
    expect(container.textContent).toContain("Median Price");
    expect(container.textContent).toContain("$469K");
    expect(container.textContent).toContain("90 days");
  });

  it("renders an em-dash for a missing receipt, never 0", () => {
    const { container } = render(
      <MarketStatsBlock data={data} geoName="Austin, TX" />,
    );
    const strip = container.querySelector('[data-testid="score-receipts"]')!;
    expect(strip.textContent).toContain("—"); // price-reduced-share is null
  });

  it("shows a freshness/attribution line with the latest date and sources", () => {
    const { container } = render(
      <MarketStatsBlock data={data} geoName="Austin, TX" />,
    );
    expect(container.textContent?.toLowerCase()).toContain("data through");
    expect(container.textContent?.toLowerCase()).toContain("zillow");
  });

  it("renders gracefully when score is null (stats only, no receipts crash)", () => {
    const noScore = {
      ...data,
      score: null,
      grade: null,
      receipts: data.receipts.map((r) => ({ ...r, value: null })),
    };
    const { container } = render(
      <MarketStatsBlock data={noScore} geoName="Nowhere, TX" />,
    );
    expect(container.textContent).toContain("Median Price");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/frontend && npm run test:unit -- app/markets/components/__tests__/MarketStatsBlock.test.tsx`
Expected: FAIL — cannot find `../MarketStatsBlock`.

- [ ] **Step 3: Implement `MarketStatsBlock` (pure server component)**

Note: do NOT import from `app/components/scoring/*` (those modules are `'use client'`). Use `data.grade`/`data.score` directly and the local color map below. Format with `formatMetricValue`/`getMetricFormat` from `@/lib/data`.

```tsx
// packages/frontend/app/markets/components/MarketStatsBlock.tsx
// Pure server component — values land in initial HTML. No 'use client', no hooks.
import { formatMetricValue } from "@/lib/data";
import type {
  MarketStatsData,
  MarketStatField,
  ScoreReceipt,
} from "@/lib/data";
import { StatSparkline } from "./StatSparkline";

const SOURCE_LABEL: Record<string, string> = {
  zillow: "Zillow",
  realtor: "Realtor.com",
  redfin: "Redfin",
  census: "U.S. Census",
  economic: "FRED",
  calculated: "PropertyIQ",
};

function gradeClasses(grade: string | null): string {
  switch ((grade ?? "").charAt(0)) {
    case "A":
      return "bg-green-600 text-white";
    case "B":
      return "bg-emerald-600 text-white";
    case "C":
      return "bg-yellow-600 text-white";
    case "D":
      return "bg-orange-600 text-white";
    default:
      return "bg-red-600 text-white";
  }
}

function fmtField(f: MarketStatField): string {
  if (f.value === null) return "—";
  if (f.metricId === "home_value_yoy")
    return `${f.value > 0 ? "+" : ""}${f.value.toFixed(1)}%`;
  return formatMetricValue(
    f.value,
    f.metricId === "days_on_market"
      ? "days"
      : f.metricId === "rent_index" || f.metricId === "home_value"
        ? "currency"
        : "number",
  );
}

function fmtReceipt(r: ScoreReceipt): string {
  if (r.value === null) return "—";
  if (r.format === "days") return `${Math.round(r.value)} days`;
  return `${r.value > 0 ? "+" : ""}${r.value.toFixed(1)}%`;
}

function monthYear(date: string | null): string {
  if (!date) return "n/a";
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function MarketStatsBlock({
  data,
  geoName,
}: {
  data: MarketStatsData;
  geoName: string;
}) {
  const { headline, receipts } = data;
  const sources = Array.from(
    new Set(
      [
        headline.medianPrice.source,
        headline.rent.source,
        headline.daysOnMarket.source,
        headline.yoy.source,
      ].filter(Boolean) as string[],
    ),
  ).map((s) => SOURCE_LABEL[s] ?? s);

  return (
    <section
      className="max-w-4xl mx-auto px-4 pt-8"
      aria-label={`${geoName} market statistics`}
    >
      <div className="rounded-xl border border-outline-variant bg-surface-container-low shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant">
          <h2 className="text-base font-medium text-on-surface">
            {geoName} market data
          </h2>
          {data.score !== null && (
            <span className="text-sm text-on-surface-variant">
              PropertyIQ Score{" "}
              <span className="font-mono font-semibold text-on-surface">
                {data.score}
              </span>
              {data.grade && (
                <span
                  className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${gradeClasses(data.grade)}`}
                >
                  {data.grade}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Headline stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-outline-variant">
          {[
            headline.medianPrice,
            headline.rent,
            headline.daysOnMarket,
            headline.yoy,
          ].map((f) => (
            <div key={f.metricId} className="p-4">
              <div className="text-xs text-on-surface-variant">{f.label}</div>
              <div className="text-lg font-mono font-semibold text-on-surface">
                {fmtField(f)}
              </div>
              {f.metricId === "home_value" && data.sparkline.length >= 2 && (
                <StatSparkline
                  data={data.sparkline}
                  className="mt-1 text-primary"
                />
              )}
            </div>
          ))}
        </div>

        {/* Score receipts */}
        <div
          data-testid="score-receipts"
          className="border-t border-outline-variant px-5 py-3"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-on-surface-variant mb-2">
            What drives the score
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {receipts.map((r) => (
              <span key={r.key} className="text-on-surface-variant">
                {r.label}:{" "}
                <span className="font-mono text-on-surface">
                  {fmtReceipt(r)}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Freshness + attribution */}
        <div className="border-t border-outline-variant px-5 py-2 text-xs text-on-surface-variant/70">
          Data through {monthYear(data.latestDate)} · Source:{" "}
          {sources.join(", ") || "PropertyIQ"}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/frontend && npm run test:unit -- app/markets/components/__tests__/MarketStatsBlock.test.tsx`
Expected: PASS (all). If `$469K` formatting differs, align the expectation to `formatMetricValue`'s real output (run the assertion against the actual string).

- [ ] **Step 5: Typecheck + commit**

Run: `cd packages/frontend && npx tsc --noEmit`

```bash
git add packages/frontend/app/markets/components/MarketStatsBlock.tsx packages/frontend/app/markets/components/__tests__/MarketStatsBlock.test.tsx
git commit -m "feat(seo): pure-server MarketStatsBlock (headline stats + score receipts + freshness)"
```

### Task 2.3: Render the block server-side on metro/county/zip pages

**Files:**

- Modify: `packages/frontend/app/markets/[slug]/page.tsx` (insert between L98 and L100)
- Modify: `packages/frontend/app/markets/county/[slug]/page.tsx` (insert between L114 and L116)
- Modify: `packages/frontend/app/markets/zip/[slug]/page.tsx` (insert between L120 and L122)

- [ ] **Step 1: Metro page — fetch + render**

In `app/markets/[slug]/page.tsx`, add the import at top:

```tsx
import { fetchMarketStats } from "@/lib/data";
import { MarketStatsBlock } from "@/app/markets/components/MarketStatsBlock";
```

Inside the async component body (before `return`), after `metro` is resolved:

```tsx
const stats = await fetchMarketStats("metro", metro.cbsaCode, metro.state);
```

In the JSX, immediately after `<MetroPageContent metro={metro} />`:

```tsx
{
  stats && <MarketStatsBlock data={stats} geoName={metro.shortName} />;
}
```

- [ ] **Step 2: County page — fetch + render**

In `app/markets/county/[slug]/page.tsx`, add the same imports. After `county` is resolved:

```tsx
const stats = await fetchMarketStats("county", county.fips, county.state);
```

After `<CountyPageContent ... />`:

```tsx
{
  stats && <MarketStatsBlock data={stats} geoName={county.shortName} />;
}
```

- [ ] **Step 3: ZIP page — fetch + render**

In `app/markets/zip/[slug]/page.tsx`, add the imports. After `zip` is resolved:

```tsx
const stats = await fetchMarketStats("zip", zip.zip, zip.state);
```

After `<ZipPageContent ... />`:

```tsx
{
  stats && <MarketStatsBlock data={stats} geoName={zip.shortName} />;
}
```

- [ ] **Step 4: Verify SSR output contains real numbers (no JS)**

Run (local dev server up): build or `next dev`, then:

```bash
curl -s "http://localhost:3000/markets/austin-tx" | grep -i "market data" -A 5
```

Expected: the stats block markup with a real price/DOM in the HTML (not a loading skeleton). Repeat for one county and one zip slug.

- [ ] **Step 5: Typecheck + commit**

Run: `cd packages/frontend && npx tsc --noEmit`

```bash
git add packages/frontend/app/markets/[slug]/page.tsx packages/frontend/app/markets/county/[slug]/page.tsx packages/frontend/app/markets/zip/[slug]/page.tsx
git commit -m "feat(seo): server-render MarketStatsBlock on metro/county/zip pages"
```

---

## Workstream 3 — Freshness footer + schema.org

### Task 3.1: JSON-LD builder (TDD)

**Files:**

- Create: `packages/frontend/app/markets/components/buildStatsJsonLd.ts`
- Test: append to `packages/frontend/app/markets/components/__tests__/MarketStatsBlock.test.tsx`

- [ ] **Step 1: Add failing test**

```tsx
import { buildStatsJsonLd } from "../buildStatsJsonLd";

describe("buildStatsJsonLd", () => {
  it("emits a Dataset with dateModified = latest period and the stat variables", () => {
    const ld = buildStatsJsonLd(
      data,
      "Austin, TX",
      "https://propertyiq.up.railway.app/markets/austin-tx",
    );
    expect(ld["@type"]).toBe("Dataset");
    expect(ld.dateModified).toBe("2026-04-30");
    expect(JSON.stringify(ld)).toContain("Median Price");
    expect(ld.url).toContain("/markets/austin-tx");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/frontend && npm run test:unit -- app/markets/components/__tests__/MarketStatsBlock.test.tsx`
Expected: FAIL — cannot find `../buildStatsJsonLd`.

- [ ] **Step 3: Implement the builder**

```typescript
// packages/frontend/app/markets/components/buildStatsJsonLd.ts
import type { MarketStatsData } from "@/lib/data";

export function buildStatsJsonLd(
  data: MarketStatsData,
  geoName: string,
  url: string,
): Record<string, unknown> {
  const vars = [
    data.headline.medianPrice,
    data.headline.rent,
    data.headline.daysOnMarket,
    data.headline.yoy,
  ]
    .filter((f) => f.value !== null)
    .map((f) => ({
      "@type": "PropertyValue",
      name: f.label,
      value: f.value,
      ...(f.date ? { observationDate: f.date } : {}),
    }));
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${geoName} Housing Market Data`,
    description: `Median price, rent, days on market, year-over-year change, and the PropertyIQ Score inputs for ${geoName}.`,
    url,
    ...(data.latestDate ? { dateModified: data.latestDate } : {}),
    creator: { "@type": "Organization", name: "PropertyIQ" },
    variableMeasured: vars,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/frontend && npm run test:unit -- app/markets/components/__tests__/MarketStatsBlock.test.tsx`
Expected: PASS.

- [ ] **Step 5: Render the JSON-LD + fix the footer on all three pages**

In each `page.tsx` (metro/county/zip), after the stats fetch, render the script (server) near the existing breadcrumb JSON-LD:

```tsx
{
  stats && (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(
          buildStatsJsonLd(
            stats,
            /* geoName */ metro.shortName,
            `https://propertyiq.up.railway.app/markets/${metro.slug}`,
          ),
        ),
      }}
    />
  );
}
```

(Use the right name/url per page: county `county.shortName` + `/markets/county/${county.slug}`; zip `zip.shortName` + `/markets/zip/${zip.slug}`.)

Replace the misleading footer line in each SEO section (metro page.tsx ~L114) — change:

```tsx
Last updated: {today}. Data from Zillow, Realtor.com, Redfin, U.S. Census Bureau, FRED, BLS, and BEA.
```

to:

```tsx
{stats?.latestDate ? `Market data through ${new Date(stats.latestDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.` : ""} Sourced from Zillow, Realtor.com, Redfin, U.S. Census Bureau, FRED, BLS, and BEA. Per-statistic source and date shown above.
```

Add the import `import { buildStatsJsonLd } from "@/app/markets/components/buildStatsJsonLd";` to each page.

- [ ] **Step 6: Validate schema + commit**

Run: `cd packages/frontend && npx tsc --noEmit`. Then in a browser, paste a rendered page URL into Google Rich Results Test (or validator.schema.org) — expect the `Dataset` to parse with `dateModified` = the real latest period.

```bash
git add packages/frontend/app/markets/components/buildStatsJsonLd.ts packages/frontend/app/markets/components/__tests__/MarketStatsBlock.test.tsx packages/frontend/app/markets/[slug]/page.tsx packages/frontend/app/markets/county/[slug]/page.tsx packages/frontend/app/markets/zip/[slug]/page.tsx
git commit -m "feat(seo): Dataset JSON-LD + honest per-period freshness footer on market pages"
```

---

## Workstream 4 — Rankings fetcher + state-page top-10 tables

### Task 4.1: `fetchRankings()` fetcher (TDD)

**Files:**

- Create: `packages/frontend/lib/data/fetchers/rankings.ts`
- Test: `packages/frontend/lib/data/fetchers/__tests__/rankings.test.ts`

- [ ] **Step 1: Write the failing test** (mock the base fetcher)

```typescript
// packages/frontend/lib/data/fetchers/__tests__/rankings.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.mock("../base", () => ({
  API_URL: "http://test",
  fetchAPIWithParams: (...a: unknown[]) => mockFetch(...a),
  fetchAPI: (...a: unknown[]) => mockFetch(...a),
}));

import { fetchRankings } from "../rankings";

describe("fetchRankings", () => {
  beforeEach(() => mockFetch.mockReset());

  it("maps the rankings response to flat RankingRow[]", async () => {
    mockFetch.mockResolvedValue({
      score_type: "propertyiq",
      geography_level: "metro",
      score_date: "2026-04-30",
      rankings: [
        {
          rank: 1,
          geography: { id: "12420", name: "Austin, TX" },
          score: 88,
          grade: "A",
          confidence: { level: "A", percentage: 100 },
        },
        {
          rank: 2,
          geography: { id: "26420", name: "Houston, TX" },
          score: 71,
          grade: "B",
          confidence: { level: "B", percentage: 75 },
        },
      ],
      count: 2,
    });
    const rows = await fetchRankings("propertyiq", "metro", {
      state: "TX",
      limit: 10,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      rank: 1,
      id: "12420",
      name: "Austin, TX",
      score: 88,
      grade: "A",
    });
  });

  it("returns [] on error", async () => {
    mockFetch.mockRejectedValue(new Error("boom"));
    expect(
      await fetchRankings("propertyiq", "county", { state: "TX" }),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/frontend && npm run test:unit -- lib/data/fetchers/__tests__/rankings.test.ts`
Expected: FAIL — cannot find `../rankings`.

- [ ] **Step 3: Implement (confirm the base helper export names first)**

First confirm the base helper name by reading `packages/frontend/lib/data/fetchers/base.ts` (recon: `fetchAPIWithParams(path, params)` exists). Then:

```typescript
// packages/frontend/lib/data/fetchers/rankings.ts
import { fetchAPIWithParams } from "./base";

export interface RankingRow {
  rank: number;
  id: string;
  name: string;
  score: number;
  grade: string;
}

interface RankingsApiResponse {
  rankings: {
    rank: number;
    geography: { id: string; name: string };
    score: number;
    grade: string;
  }[];
}

export async function fetchRankings(
  scoreType: "propertyiq",
  geoLevel: "metro" | "county" | "zip",
  opts?: { state?: string; limit?: number; order?: "asc" | "desc" },
): Promise<RankingRow[]> {
  try {
    const params: Record<string, string> = {};
    if (opts?.state) params.state = opts.state;
    if (opts?.limit) params.limit = String(opts.limit);
    if (opts?.order) params.order = opts.order;
    const res = await fetchAPIWithParams<RankingsApiResponse>(
      `/api/v1/rankings/${scoreType}/${geoLevel}`,
      Object.keys(params).length ? params : undefined,
    );
    return (res.rankings ?? []).map((r) => ({
      rank: r.rank,
      id: r.geography.id,
      name: r.geography.name,
      score: r.score,
      grade: r.grade,
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/frontend && npm run test:unit -- lib/data/fetchers/__tests__/rankings.test.ts`
Expected: PASS.

- [ ] **Step 5: Export + commit**

Add to `_groups/markets.ts` (or `fetchers/index.ts`):

```typescript
export { fetchRankings } from "../rankings";
export type { RankingRow } from "../rankings";
```

Run: `cd packages/frontend && npx tsc --noEmit`

```bash
git add packages/frontend/lib/data/fetchers/rankings.ts packages/frontend/lib/data/fetchers/__tests__/rankings.test.ts packages/frontend/lib/data/fetchers/_groups/markets.ts
git commit -m "feat(seo): fetchRankings data-layer fetcher over /api/v1/rankings"
```

### Task 4.2: `StateTopMarketsTables` server component + wire into state page

**Files:**

- Create: `packages/frontend/app/markets/components/StateTopMarketsTables.tsx`
- Modify: `packages/frontend/app/markets/state/[state]/page.tsx`

- [ ] **Step 1: Read the state page to find the insertion point**

Read `packages/frontend/app/markets/state/[state]/page.tsx` in full. Confirm it is a server component and locate where `<StatePageContent ... />` is rendered and what identifies the state (`state.abbrev` / `state.name`). The tables render server-side **above** `<StatePageContent>`.

- [ ] **Step 2: Implement the tables (pure server component)**

```tsx
// packages/frontend/app/markets/components/StateTopMarketsTables.tsx
import Link from "next/link";
import type { RankingRow } from "@/lib/data";

function gradeText(grade: string): string {
  return grade || "—";
}

function Table({
  title,
  rows,
  hrefBase,
}: {
  title: string;
  rows: RankingRow[];
  hrefBase: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="flex-1 min-w-[280px]">
      <h3 className="text-base font-medium text-on-surface mb-3">{title}</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-on-surface-variant border-b border-outline-variant">
            <th className="py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-2 font-medium">Market</th>
            <th className="py-2 pr-2 font-medium text-right">Score</th>
            <th className="py-2 font-medium text-right">Grade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-outline-variant/50">
              <td className="py-2 pr-2 text-on-surface-variant font-mono">
                {i + 1}
              </td>
              <td className="py-2 pr-2">
                <Link
                  href={`${hrefBase}/${r.id}`}
                  className="text-primary hover:underline"
                >
                  {r.name}
                </Link>
              </td>
              <td className="py-2 pr-2 text-right font-mono text-on-surface">
                {Math.round(r.score)}
              </td>
              <td className="py-2 text-right font-mono text-on-surface-variant">
                {gradeText(r.grade)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StateTopMarketsTables({
  stateName,
  metros,
  counties,
  metroHrefBase,
  countyHrefBase,
}: {
  stateName: string;
  metros: RankingRow[];
  counties: RankingRow[];
  metroHrefBase: string; // slug-based href is resolved by the caller; see note
  countyHrefBase: string;
}) {
  if (!metros.length && !counties.length) return null;
  return (
    <section
      className="max-w-4xl mx-auto px-4 py-8"
      aria-label={`Top ${stateName} markets by PropertyIQ Score`}
    >
      <h2 className="text-xl font-medium text-on-surface mb-4">
        Top {stateName} markets by PropertyIQ Score
      </h2>
      <div className="flex flex-wrap gap-8">
        <Table title="Top metros" rows={metros} hrefBase={metroHrefBase} />
        <Table title="Top counties" rows={counties} hrefBase={countyHrefBase} />
      </div>
    </section>
  );
}
```

Note on hrefs: rankings rows carry the raw `id` (CBSA / FIPS), but market pages use slugs. In `page.tsx`, map each `RankingRow.id` to its slug via `METRO_SLUG_DATA`/`COUNTY_SLUG_DATA` (already imported on state pages) and pass slug-based rows. Adjust the row link to use a pre-resolved `slug` field: extend `RankingRow` rendering by mapping in the page (build `rows` as `{ ...r, id: slug }`) so `${hrefBase}/${r.id}` yields `/markets/<slug>`. Use `metroHrefBase="/markets"`, `countyHrefBase="/markets/county"`.

- [ ] **Step 3: Wire into the state page (server fetch + slug mapping)**

In `app/markets/state/[state]/page.tsx`, add imports:

```tsx
import { fetchRankings } from "@/lib/data";
import { StateTopMarketsTables } from "@/app/markets/components/StateTopMarketsTables";
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";
import { COUNTY_SLUG_DATA } from "@/lib/data/county-slug-data";
```

In the async body:

```tsx
const [topMetrosRaw, topCountiesRaw] = await Promise.all([
  fetchRankings("propertyiq", "metro", { state: state.abbrev, limit: 10 }),
  fetchRankings("propertyiq", "county", { state: state.abbrev, limit: 10 }),
]);
const metroSlugById = new Map(METRO_SLUG_DATA.map((m) => [m.cbsaCode, m.slug]));
const countySlugById = new Map(COUNTY_SLUG_DATA.map((c) => [c.fips, c.slug]));
const topMetros = topMetrosRaw
  .filter((r) => metroSlugById.has(r.id))
  .map((r) => ({ ...r, id: metroSlugById.get(r.id)! }));
const topCounties = topCountiesRaw
  .filter((r) => countySlugById.has(r.id))
  .map((r) => ({ ...r, id: countySlugById.get(r.id)! }));
```

Render above `<StatePageContent ... />`:

```tsx
<StateTopMarketsTables
  stateName={state.name}
  metros={topMetros}
  counties={topCounties}
  metroHrefBase="/markets"
  countyHrefBase="/markets/county"
/>
```

(Use the actual state field names found in Step 1; `state.abbrev`/`state.name` are placeholders to reconcile.)

- [ ] **Step 4: Verify SSR + typecheck + commit**

Run: `cd packages/frontend && npx tsc --noEmit`. Curl a state page and confirm the ranked table HTML is present with real scores:

```bash
curl -s "http://localhost:3000/markets/state/texas" | grep -i "Top Texas markets" -A 10
```

```bash
git add packages/frontend/app/markets/components/StateTopMarketsTables.tsx packages/frontend/app/markets/state/[state]/page.tsx
git commit -m "feat(seo): server-rendered top-10 ranked tables on state pages"
```

---

## Workstream 5 — Relevance-based related markets

### Task 5.1: County + ZIP related markets → same-state by score

**Files:**

- Modify: `packages/frontend/app/markets/county/[slug]/page.tsx` (replace L70-72 filter; render block L130-147)
- Modify: `packages/frontend/app/markets/zip/[slug]/page.tsx` (replace L75-77 filter; render block L136-153)

- [ ] **Step 1: County — fetch ranked same-state counties (server)**

Replace the alphabetical `nearbyCounties` filter:

```tsx
const nearbyCounties = COUNTY_SLUG_DATA.filter(
  (c) => c.state === county.state && c.fips !== county.fips,
).slice(0, 6);
```

with a ranked fetch + slug/parent-metro mapping:

```tsx
import { fetchRankings } from "@/lib/data";
// ...
const countyRank = await fetchRankings("propertyiq", "county", {
  state: county.state,
  limit: 12,
});
const countyBySlug = new Map(COUNTY_SLUG_DATA.map((c) => [c.fips, c]));
const nearbyCounties = countyRank
  .filter((r) => r.id !== county.fips && countyBySlug.has(r.id))
  .map((r) => countyBySlug.get(r.id)!)
  .slice(0, 6);
```

(Fallback: if `countyRank` is empty, keep the old same-state slice — wrap in `nearbyCounties.length ? nearbyCounties : COUNTY_SLUG_DATA.filter(...).slice(0,6)`.) The existing render block at L130-147 is unchanged (it maps `nearbyCounties`).

- [ ] **Step 2: ZIP — fetch ranked same-state ZIPs (server)**

Replace the `nearbyZips` filter similarly:

```tsx
const zipRank = await fetchRankings("propertyiq", "zip", {
  state: zip.state,
  limit: 12,
});
const zipBySlug = new Map(ZIP_SLUG_DATA.map((z) => [z.zip, z]));
const nearbyZips = zipRank
  .filter((r) => r.id !== zip.zip && zipBySlug.has(r.id))
  .map((r) => zipBySlug.get(r.id)!)
  .slice(0, 6);
const fallbackZips = ZIP_SLUG_DATA.filter(
  (z) => z.state === zip.state && z.zip !== zip.zip,
).slice(0, 6);
const relatedZips = nearbyZips.length ? nearbyZips : fallbackZips;
```

Update the render block (L136-153) to map `relatedZips` instead of `nearbyZips`.

- [ ] **Step 3: Typecheck + verify ordering**

Run: `cd packages/frontend && npx tsc --noEmit`. Curl a county and a zip page; confirm related links are no longer alphabetical (highest-score same-state first), e.g. Austin-area counties are not "Anderson, Andrews, Angelina…".

```bash
curl -s "http://localhost:3000/markets/county/travis-county-tx" | grep -i "Other TX Counties" -A 12
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/markets/county/[slug]/page.tsx packages/frontend/app/markets/zip/[slug]/page.tsx
git commit -m "feat(seo): related markets ranked by PropertyIQ score (county + zip)"
```

### Task 5.2: Metro related markets → move server-side + rank by score

**Files:**

- Modify: `packages/frontend/app/markets/[slug]/MetroPageContent.tsx` (remove L31-33 filter + L130-147 render)
- Modify: `packages/frontend/app/markets/[slug]/page.tsx` (render ranked related markets server-side)

- [ ] **Step 1: Remove the client-side related-markets block from `MetroPageContent.tsx`**

Delete the `nearbyMetros` const (L31-33) and the entire "More Markets in {state}" `<section>` (L130-147). Leave the rest of the client component intact.

- [ ] **Step 2: Render ranked related metros in `page.tsx` (server)**

In `app/markets/[slug]/page.tsx`, after the stats fetch:

```tsx
import { fetchRankings } from "@/lib/data";
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";
// ...
const metroRank = await fetchRankings("propertyiq", "metro", {
  state: metro.state,
  limit: 8,
});
const metroBySlug = new Map(METRO_SLUG_DATA.map((m) => [m.cbsaCode, m]));
const relatedMetros = metroRank
  .filter((r) => r.id !== metro.cbsaCode && metroBySlug.has(r.id))
  .map((r) => metroBySlug.get(r.id)!)
  .slice(0, 5);
```

Render inside the SEO `<section>` (server), after the prose:

```tsx
{
  relatedMetros.length > 0 && (
    <div className="mt-8">
      <h3 className="text-base font-medium text-on-surface mb-3">
        Top markets in {metro.state}
      </h3>
      <div className="flex flex-wrap gap-2">
        {relatedMetros.map((m) => (
          <Link
            key={m.cbsaCode}
            href={`/markets/${m.slug}`}
            className="px-4 py-2 rounded-full bg-surface-container-low text-on-surface text-sm hover:bg-surface-container-high transition-colors"
          >
            {m.shortName}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

Ensure `Link` is imported in `page.tsx`.

- [ ] **Step 3: Typecheck + commit**

Run: `cd packages/frontend && npx tsc --noEmit`. Curl the metro page; confirm related metros are server-rendered and score-ranked.

```bash
git add packages/frontend/app/markets/[slug]/MetroPageContent.tsx packages/frontend/app/markets/[slug]/page.tsx
git commit -m "feat(seo): metro related markets server-rendered and ranked by score"
```

---

## Workstream 6 — AI-insights 404 → 200 templated fallback

### Task 6.1: Deterministic fallback prose builder (TDD, backend)

**Files:**

- Create: `packages/backend/src/insights/insights-fallback.ts`
- Test: `packages/backend/src/insights/__tests__/insights-fallback.spec.ts`

- [ ] **Step 1: Read the insight context shape**

Read `packages/backend/src/insights/insights.service.ts` `buildInsightContext()` and the `InsightContext` type to learn the exact fields available (region name, score, the four inputs, price/dom). The builder below assumes `{ region_name, score, grade, median_price, days_on_market, price_reduced_share, zhvi_yoy }`; reconcile field names to the real `InsightContext`.

- [ ] **Step 2: Write the failing test**

```typescript
// packages/backend/src/insights/__tests__/insights-fallback.spec.ts
import { buildFallbackInsightContent } from "../insights-fallback";

describe("buildFallbackInsightContent", () => {
  const ctx = {
    region_name: "Austin, TX",
    score: 72,
    grade: "B",
    median_price: 469000,
    days_on_market: 90,
    price_reduced_share: 0.18,
    zhvi_yoy: 0.021,
  } as any;

  it("produces plain prose with the real numbers and no markdown/em-dash/identifiers", () => {
    const text = buildFallbackInsightContent(ctx, "market_overview");
    expect(text).toContain("Austin, TX");
    expect(text).toContain("72");
    expect(text).not.toMatch(/[*_#]/); // no markdown
    expect(text).not.toContain("—"); // no em-dash
    expect(text).not.toContain("price_reduced_share"); // no raw identifiers
    expect(text.length).toBeGreaterThan(80);
  });

  it("omits a metric sentence when the value is null", () => {
    const text = buildFallbackInsightContent(
      { ...ctx, days_on_market: null },
      "market_take",
    );
    expect(text).not.toMatch(/days on market/i);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd packages/backend && npx jest insights/__tests__/insights-fallback.spec.ts`
Expected: FAIL — cannot find `../insights-fallback`.

- [ ] **Step 4: Implement the builder**

```typescript
// packages/backend/src/insights/insights-fallback.ts
// Deterministic, data-driven fallback used when AI generation is unavailable.
// Follows the AI-prose rules: no markdown, no em-dashes, no code identifiers.
export interface FallbackContext {
  region_name: string;
  score: number | null;
  grade: string | null;
  median_price: number | null;
  days_on_market: number | null;
  price_reduced_share: number | null; // fraction (0.18 = 18%)
  zhvi_yoy: number | null; // fraction
}

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function buildFallbackInsightContent(
  ctx: FallbackContext,
  _insightType: string,
): string {
  const parts: string[] = [];
  if (ctx.score !== null) {
    const grade = ctx.grade ? ` and a confidence grade of ${ctx.grade}` : "";
    parts.push(
      `${ctx.region_name} has a PropertyIQ Score of ${Math.round(ctx.score)}${grade}. The score is computed across all markets at this geography level and calibrated so 50 represents the state average, which means a score above 50 points to stronger expected performance relative to the state.`,
    );
  } else {
    parts.push(
      `${ctx.region_name} does not have enough recent data for a PropertyIQ Score this period.`,
    );
  }
  if (ctx.median_price !== null) {
    const yoy =
      ctx.zhvi_yoy !== null
        ? ` Home values are ${ctx.zhvi_yoy >= 0 ? "up" : "down"} about ${Math.abs(ctx.zhvi_yoy * 100).toFixed(1)} percent over the past year.`
        : "";
    parts.push(
      `The median home value is around ${money(ctx.median_price)}.${yoy}`,
    );
  }
  if (ctx.days_on_market !== null) {
    parts.push(
      `Homes are taking about ${Math.round(ctx.days_on_market)} days to sell.`,
    );
  }
  if (ctx.price_reduced_share !== null) {
    parts.push(
      `Roughly ${Math.round(ctx.price_reduced_share * 100)} percent of listings have had a price cut, a signal of how much pricing pressure sellers face.`,
    );
  }
  return parts.join(" ");
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd packages/backend && npx jest insights/__tests__/insights-fallback.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/insights/insights-fallback.ts packages/backend/src/insights/__tests__/insights-fallback.spec.ts
git commit -m "feat(insights): deterministic data-driven fallback prose builder"
```

### Task 6.2: Return the fallback (200) instead of null

**Files:**

- Modify: `packages/backend/src/insights/insights.service.ts` (the two `return null` paths at ~L78 and ~L103)

- [ ] **Step 1: Build context before the null paths and return the fallback**

In `getInsight()`, restructure so context is built before bailing out, then on no-AI or empty content, return a non-cached fallback `MarketInsight`. Replace:

```typescript
if (!this.aiClient) return null;
```

and the later:

```typescript
if (!content) return null;
```

with a shared fallback (build context first; `buildInsightContext` does not require the AI client):

```typescript
const context = await this.buildInsightContext(regionId, geoLevel);

const makeFallback = (): MarketInsight =>
  ({
    region_id: regionId,
    geo_level: geoLevel,
    insight_type: insightType,
    content: buildFallbackInsightContent(
      context as unknown as FallbackContext,
      insightType,
    ),
    generated_at: new Date().toISOString(),
    model: "fallback-template",
  }) as MarketInsight;

if (!this.aiClient) return makeFallback();

const content = await this.generateSingleInsight(
  context,
  insightType as InsightType,
);

// Do not cache the fallback — let a future request regenerate with the AI client.
if (!content) return makeFallback();
```

Add the import at top: `import { buildFallbackInsightContent, type FallbackContext } from './insights-fallback';`. Reconcile `MarketInsight` required fields with the real interface; map `context` fields to `FallbackContext` (rename in `makeFallback` if `buildInsightContext` uses different keys, e.g. `context.region_name`).

- [ ] **Step 2: Verify the controller now returns 200**

The controller (`insights.controller.ts` L53-54) only 404s when the service returns `null`; with the fallback it never returns null for valid geos. No controller change needed. Add a focused service spec asserting non-null when `aiClient` is undefined (mock `buildInsightContext` to return a fixed context). Run:

```bash
cd packages/backend && npx jest insights
```

Expected: PASS.

- [ ] **Step 3: Live check + commit**

Run (backend up): `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/insights/metro/12420?type=market_overview"`
Expected: `200` (was `404` when generation unavailable).

```bash
git add packages/backend/src/insights/insights.service.ts
git commit -m "fix(insights): return 200 templated fallback instead of 404 when AI generation unavailable"
```

---

## Workstream 7 — Role-segmented capture block

### Task 7.1: Extend newsletter `source` enum

**Files:**

- Modify: `packages/frontend/app/api/newsletter/route.ts` (L31-46 schema)

- [ ] **Step 1: Add persona-tagged sources**

In `VALID_SOURCES`, add three entries:

```typescript
const VALID_SOURCES = [
  "homepage",
  "city-page",
  "exit-intent",
  "newsletter-page",
  "sticky-bar",
  "seo_conversion_bar",
  "seo-investor",
  "seo-homebuyer",
  "seo-agent",
] as const;
```

No DB migration needed (`source` is `VARCHAR(100)`; the enum only validates the API input).

- [ ] **Step 2: Add a route test for the new enum**

Create `packages/frontend/app/api/newsletter/__tests__/route-sources.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
// The schema is internal; assert via a small exported helper OR validate the constant list.
import * as route from "../route";

describe("newsletter sources", () => {
  it("accepts persona-tagged SEO sources", () => {
    // If VALID_SOURCES is not exported, export it from route.ts for testability.
    expect(route.VALID_SOURCES).toContain("seo-investor");
    expect(route.VALID_SOURCES).toContain("seo-homebuyer");
    expect(route.VALID_SOURCES).toContain("seo-agent");
  });
});
```

Export `VALID_SOURCES` from `route.ts` (`export const VALID_SOURCES = [...]`).

- [ ] **Step 3: Run + commit**

Run: `cd packages/frontend && npm run test:unit -- app/api/newsletter/__tests__/route-sources.test.ts`
Expected: PASS.

```bash
git add packages/frontend/app/api/newsletter/route.ts packages/frontend/app/api/newsletter/__tests__/route-sources.test.ts
git commit -m "feat(seo): newsletter accepts persona-tagged SEO capture sources"
```

### Task 7.2: `PersonaCaptureBlock` client component (TDD)

**Files:**

- Create: `packages/frontend/app/markets/components/PersonaCaptureBlock.tsx`
- Test: `packages/frontend/app/markets/components/__tests__/PersonaCaptureBlock.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/markets/components/__tests__/PersonaCaptureBlock.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PersonaCaptureBlock } from "../PersonaCaptureBlock";

describe("PersonaCaptureBlock", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ success: true }) }),
    );
  });

  it("defaults to the investor tab and posts source=seo-investor", async () => {
    render(<PersonaCaptureBlock geoName="Austin, TX" />);
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /get/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.source).toBe("seo-investor");
    expect(body.email).toBe("a@b.com");
  });

  it("switches persona tab and posts the matching source", async () => {
    render(<PersonaCaptureBlock geoName="Austin, TX" />);
    fireEvent.click(screen.getByRole("tab", { name: /homebuyer/i }));
    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "c@d.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /get/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.source).toBe("seo-homebuyer");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/frontend && npm run test:unit -- app/markets/components/__tests__/PersonaCaptureBlock.test.tsx`
Expected: FAIL — cannot find `../PersonaCaptureBlock`.

- [ ] **Step 3: Implement the component**

```tsx
// packages/frontend/app/markets/components/PersonaCaptureBlock.tsx
"use client";
import { useState } from "react";

type Persona = "investor" | "homebuyer" | "agent";
const TABS: { key: Persona; label: string; source: string; pitch: string }[] = [
  {
    key: "investor",
    label: "Investor",
    source: "seo-investor",
    pitch:
      "Monthly PropertyIQ Score updates and cash-flow signals for this market.",
  },
  {
    key: "homebuyer",
    label: "Homebuyer",
    source: "seo-homebuyer",
    pitch:
      "Affordability and best-time-to-buy signals for this market, monthly.",
  },
  {
    key: "agent",
    label: "Agent",
    source: "seo-agent",
    pitch:
      "Listing-presentation-ready market data and talking points, monthly.",
  },
];

export function PersonaCaptureBlock({ geoName }: { geoName: string }) {
  const [persona, setPersona] = useState<Persona>("investor");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const active = TABS.find((t) => t.key === persona)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: active.source,
          context: "market",
        }),
      });
      setStatus(res.ok ? "ok" : "error");
      if (res.ok) setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
        <div
          role="tablist"
          aria-label="Choose your role"
          className="flex gap-2 mb-3"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={persona === t.key}
              onClick={() => setPersona(t.key)}
              className={`rounded-full px-3 py-1 text-sm ${persona === t.key ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-on-surface-variant mb-3">
          {active.pitch.replace("this market", geoName)}
        </p>
        {status === "ok" ? (
          <p className="text-sm text-primary">
            Please check your email to confirm.
          </p>
        ) : (
          <form onSubmit={submit} className="flex gap-2">
            <input
              type="email"
              required
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-full border border-outline px-4 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50"
            >
              {status === "loading" ? "..." : "Get updates"}
            </button>
          </form>
        )}
        {status === "error" && (
          <p className="text-sm text-error mt-2">
            Something went wrong. Try again.
          </p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/frontend && npm run test:unit -- app/markets/components/__tests__/PersonaCaptureBlock.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Swap into the three content components**

In `MetroPageContent.tsx`, `CountyPageContent.tsx`, `ZipPageContent.tsx`: replace the `<NewsletterSignup ... />` usage with:

```tsx
<PersonaCaptureBlock
  geoName={/* metro.shortName | county.shortName | zip.shortName */}
/>
```

Add `import { PersonaCaptureBlock } from "@/app/markets/components/PersonaCaptureBlock";` and remove the now-unused `NewsletterSignup` import in each.

- [ ] **Step 6: Typecheck + commit**

Run: `cd packages/frontend && npx tsc --noEmit`

```bash
git add packages/frontend/app/markets/components/PersonaCaptureBlock.tsx packages/frontend/app/markets/components/__tests__/PersonaCaptureBlock.test.tsx packages/frontend/app/markets/[slug]/MetroPageContent.tsx packages/frontend/app/markets/county/[slug]/CountyPageContent.tsx packages/frontend/app/markets/zip/[slug]/ZipPageContent.tsx
git commit -m "feat(seo): role-segmented persona capture block on market pages"
```

---

## Workstream 8 — SEO prose: align score copy + regression guard

### Task 8.1: Fix ZIP "three vs four" contradiction + name the four inputs

**Files:**

- Modify: `packages/frontend/app/markets/zip/[slug]/generate-seo-content.ts` (MIDDLE_TEMPLATES L104-111)

- [ ] **Step 1: Rewrite the three ZIP middle templates**

Replace the three MIDDLE_TEMPLATES strings so they (a) consistently say **four** inputs, (b) name them, (c) keep prediction-target framing, (d) never say "ranked within state". Example template 0:

```typescript
`The PropertyIQ Score for ${shortName} is built from four inputs measured at the ZIP-code level: Zillow home-value momentum over twelve months and three months, the median days listings spend on the market, and the share of listings with a price cut (both from Realtor.com). The score is computed across all ZIP codes nationally and calibrated so 50 equals the state average, so a score above 50 points to a micro-market positioned to outperform its state.`;
```

Template 1:

```typescript
`For ${shortName}, PropertyIQ updates a hyperlocal score each month from four signals: Zillow price momentum, median days on market, and the share of price-reduced listings. A score above 50 means this ZIP's demand dynamics read stronger than its state average. ZIP-level analysis captures neighborhood variation that county and metro scores smooth over.`;
```

Template 2:

```typescript
`PropertyIQ distills four housing signals into a single 1 to 99 score for ${shortName} at the most granular geography available. It is not a generic market-health grade; it is a validated predictor of which ZIP codes are positioned to outperform their state. The ZIP-level view often tells a different story than the broader county or metro score.`;
```

- [ ] **Step 2: Align metro templates** in `app/markets/[slug]/generate-seo-content.ts` (MIDDLE_TEMPLATES L128-135) to name the four inputs and the 1–99 / 50 = state-average scale, keeping the existing (correct) "relative to state" prediction framing. Replace the three strings with equivalents that explicitly list: Zillow ZHVI 12-month and 3-month momentum, Realtor.com median days on market, and price-reduced share, and state that the score is computed nationally and calibrated so 50 = the state average.

- [ ] **Step 3: Commit (tested by Task 8.2)**

```bash
git add packages/frontend/app/markets/zip/[slug]/generate-seo-content.ts packages/frontend/app/markets/[slug]/generate-seo-content.ts
git commit -m "fix(seo): market prose names the four score inputs; resolve ZIP three-vs-four contradiction"
```

### Task 8.2: Regression guard for SEO score copy (TDD) + "TX, TX" sweep

**Files:**

- Create: `packages/frontend/app/markets/__tests__/seo-content-score-copy.test.ts`

- [ ] **Step 1: Write the test (drives both copy + double-state correctness)**

```typescript
// packages/frontend/app/markets/__tests__/seo-content-score-copy.test.ts
import { describe, it, expect } from "vitest";
import { generateMetroSeoContent } from "../[slug]/generate-seo-content";
import { generateCountySeoContent } from "../county/[slug]/generate-seo-content";
import { generateZipSeoContent } from "../zip/[slug]/generate-seo-content";

const FORBIDDEN = [
  /ranked within (the )?state/i,
  /relative within each state/i,
  /within[- ]state ranking/i,
];

const metro = {
  cbsaCode: "12420",
  slug: "austin-tx",
  name: "Austin-Round Rock-Georgetown, TX",
  shortName: "Austin, TX",
  state: "TX",
} as any;
const county = {
  fips: "48453",
  slug: "travis-county-tx",
  name: "Travis County",
  shortName: "Travis County, TX",
  state: "TX",
  cbsaCode: "12420",
} as any;
const zip = {
  zip: "78701",
  slug: "78701-austin-tx",
  name: "78701",
  shortName: "78701, Austin, TX",
  state: "TX",
  countyFips: "48453",
  cbsaCode: "12420",
} as any;

function allText(obj: Record<string, string | undefined>): string {
  return Object.values(obj).filter(Boolean).join(" ");
}

describe("SEO score copy", () => {
  it("never describes the score as ranked/relative within state (metro/county/zip)", () => {
    for (const text of [
      allText(generateMetroSeoContent(metro)),
      allText(generateCountySeoContent(county)),
      allText(generateZipSeoContent(zip)),
    ]) {
      for (const rx of FORBIDDEN) expect(text).not.toMatch(rx);
    }
  });

  it("ZIP copy says four inputs, never three", () => {
    const t = allText(generateZipSeoContent(zip));
    expect(t).toMatch(/four/i);
    expect(t).not.toMatch(/three (housing )?(metrics|indicators|inputs)/i);
  });

  it("no double-state suffix like 'TX, TX' in any generated prose", () => {
    for (const text of [
      allText(generateMetroSeoContent(metro)),
      allText(generateCountySeoContent(county)),
      allText(generateZipSeoContent(zip)),
    ]) {
      expect(text).not.toMatch(/,\s*([A-Z]{2}),\s*\1\b/);
    }
  });
});
```

(Reconcile the imported function names with the real exports in each `generate-seo-content.ts`.)

- [ ] **Step 2: Run to verify it passes** (copy already fixed in Task 8.1)

Run: `cd packages/frontend && npm run test:unit -- app/markets/__tests__/seo-content-score-copy.test.ts`
Expected: PASS. If the "TX, TX" assertion fails for any generator, fix that generator (use `.name` not `.shortName` in templates that already append state) and re-run.

- [ ] **Step 3: Full-slug sweep for double-state (belt-and-suspenders)**

Run a one-off node/tsx script (or extend the test) iterating a sample of `COUNTY_SLUG_DATA`/`ZIP_SLUG_DATA` through the generators asserting zero `/,\s*([A-Z]{2}),\s*\1\b/`. Document the count swept.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/markets/__tests__/seo-content-score-copy.test.ts
git commit -m "test(seo): regression guard for score copy framing + double-state suffix"
```

---

## Workstream 9 — End-to-end verification (real DB, real browser — no mocks)

### Task 9.1: Crawler-visibility + data-accuracy E2E

**Files:** none (verification); optionally a Playwright script under `packages/frontend/e2e/`.

- [ ] **Step 1: curl-no-JS proves numbers in initial HTML, matching the DB**

For 5 metro, 3 county, 3 ZIP real slugs, curl the page and confirm the stats block values appear in raw HTML. Cross-check against the DB for each region:

```sql
SELECT score, grade, z_scores, median_price, score_date
FROM propertyiq_scores WHERE score_type='propertyiq' AND geography='metro' AND location_id='12420'
ORDER BY score_date DESC LIMIT 1;
```

Confirm the rendered DOM (days, price-cut %, YoY) equals `z_scores`, and headline YoY/DOM equal the receipts. **This is the formatting gate** (verifies the `×100` decision from Task 0.3 against a known market).

- [ ] **Step 2: Null-handling check**

Pick a low-confidence geo (`confidence_level` C/F with null `median_days_on_market`); confirm the page renders "—" for that receipt and no "0".

- [ ] **Step 3: AI-insights, schema, tables, related, capture checks**

- 20 sampled slugs → `/api/insights/...` returns 200 (no 404s).
- Paste 2 rendered pages into the Rich Results test → `Dataset` validates; `dateModified` = real latest period.
- State page top-10 tables match `fetchRankings` output / the rankings RPC.
- Related markets are score-ranked, not alphabetical.
- Submit each persona tab on a live page → row lands in `newsletter_signups` with `source` = `seo-investor|seo-homebuyer|seo-agent`:

```sql
SELECT email, source, context, created_at FROM newsletter_signups ORDER BY created_at DESC LIMIT 5;
```

- [ ] **Step 4: Build-heap sanity for ISR**

Confirm `generateStaticParams` still pre-renders only top-N popular slugs (the long tail is on-demand ISR). If the metro/county/zip `generateStaticParams` currently returns ALL slugs, cap it to a top-N list and rely on `dynamicParams = true` + `revalidate = 86400`. Watch the frontend Railway build memory (`project_railway-frontend-heap`). Document the chosen N.

- [ ] **Step 5: Final verification summary**

Record results (pass/fail per bullet) in `tasks/todo.md` review section. No commit unless `generateStaticParams` changed in Step 4 — then:

```bash
git add packages/frontend/app/markets/**/page.tsx
git commit -m "perf(seo): cap generateStaticParams to top-N; ISR for the long tail"
```

---

## Self-Review (against the spec)

**Spec coverage:** WS1+WS2 = stats block (§4.1); WS3 = freshness/attribution/confidence/schema.org (§4.2); WS4 = state top-10 tables (§4.3); WS8.2 = "TX, TX" bug (§4.4, now a regression guard since recon shows it fixed); WS6 = AI-insights 404→200 (§4.5); WS5 = relevance-based related markets (§4.6); WS7 = role-segmented capture (§4.7); WS8.1 = score-copy alignment (cross-cutting §5 + metro-copy flag); WS0 + WS9 = verification gates (§2.3, §8). All seven design workstreams + both bug fixes covered.

**Deviations from spec, justified by recon (call out at execution):**

1. **No backend de-gating task** — `/api/market-snapshot` already returns `components` to anonymous callers (no guard), so receipts are public with zero backend change. Replaced with a smoke test (Task 0.1).
2. **Persona via `source` enum, not a new `persona` column** — `source`/`context` are strict enums; extending `VALID_SOURCES` (no migration) is the lighter path the recon revealed. (§4.7 said "source/context field" — honored.)
3. **`MarketStatsBlock` is a new pure-server component, not `StatCard` reuse** — `StatCard` is `'use client'`; reusing it would force hydration and break pure-SSR. Spec §4.2 already allowed "a focused new presentational component."
4. **Confidence:** surface the score's `grade` directly + a tiny local grade-color map; no import from the client `app/components/scoring/*` modules into the server block (would break the server/client boundary). Matches §4.2 "do not invent a parallel grading system."
5. **TX, TX bug already fixed** (recon) → WS8.2 is a regression guard, not a fix.

**Placeholder scan:** the only intentional reconcile-on-execute notes are exact state-page field names (`state.abbrev`/`state.name`), the `InsightContext` field names, and `MarketInsight` required fields — each flagged with a "read first" step because they depend on current code the plan modifies. No "TBD"/"add error handling"/"similar to Task N".

**Type consistency:** `MarketStatsData`/`MarketStatField`/`ScoreReceipt`/`ReceiptKey` (Task 1.1) are reused verbatim in Tasks 2.2/3.1; `RankingRow` (Task 4.1) reused in 4.2/5.1/5.2; `FallbackContext` (Task 6.1) reused in 6.2; receipt order/keys are identical across transform, component, and tests.
