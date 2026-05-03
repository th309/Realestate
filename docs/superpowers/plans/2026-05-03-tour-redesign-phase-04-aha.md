# Activation Tour Redesign — Phase 04: Aha (the listing presentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the 10-section rock-star listing presentation at step 4 of the tour. Generate the report by calling the Phase 01 backend endpoint, show a loading state with rotating progress messages, then unfold the report with watermark, brand-token styling, real SVG charts, and mobile + print layouts.

**Architecture:** A `Step4Aha` component drives generation: triggers the `useAnonymousListingPresentation` mutation on mount, displays `ListingPresentationLoading` while pending, renders `ListingPresentation` on success. The presentation is decomposed into 10 section components (one per spec section) plus a cover, watermark banner, sources footer. Charts (`TrajectoryChart`, `ForecastChart`, `EmploymentChart`) are pure SVG components with no chart library to keep bundle size down. Print styles via dedicated `print.css`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, hand-rolled SVG charts (no recharts/d3 — too heavy for the unauth wire budget of <200KB).

**Spec:** [../specs/2026-05-03-activation-tour-redesign-design.md](../specs/2026-05-03-activation-tour-redesign-design.md), section "Step 4 — The rock-star listing presentation"

**Visual reference:** `.superpowers/brainstorm/2528-1777823013/content/listing-preso-rockstar.html` — every visual element in this plan exists in that mockup. Treat the mockup as the source of truth for spacing, colors, and layout. Use M3 indigo (#3949AB), accent green (#00C853), Roboto/Roboto Mono.

**Depends on:** Phase 01 (API endpoint, fetcher, hook), Phase 02 (`/tour` route, state), Phase 03 (step navigation lands here).

---

## File structure

**New (frontend):**

- `packages/frontend/app/tour/components/Step4Aha.tsx` — orchestrator
- `packages/frontend/app/tour/components/ListingPresentation.tsx` — root component
- `packages/frontend/app/tour/components/ListingPresentationLoading.tsx` — rotating loader
- `packages/frontend/app/tour/components/ListingPresentationError.tsx` — failure state
- `packages/frontend/app/tour/components/ListingPresentationCover.tsx`
- `packages/frontend/app/tour/components/listing-sections/ExecutiveSummary.tsx`
- `packages/frontend/app/tour/components/listing-sections/MarketNow.tsx`
- `packages/frontend/app/tour/components/listing-sections/Trajectory.tsx`
- `packages/frontend/app/tour/components/listing-sections/Forecast.tsx`
- `packages/frontend/app/tour/components/listing-sections/Peers.tsx`
- `packages/frontend/app/tour/components/listing-sections/Migration.tsx`
- `packages/frontend/app/tour/components/listing-sections/Affordability.tsx`
- `packages/frontend/app/tour/components/listing-sections/Employment.tsx`
- `packages/frontend/app/tour/components/listing-sections/Validation.tsx`
- `packages/frontend/app/tour/components/listing-sections/AiStrategy.tsx`
- `packages/frontend/app/tour/components/charts/TrajectoryChart.tsx`
- `packages/frontend/app/tour/components/charts/ForecastChart.tsx`
- `packages/frontend/app/tour/components/charts/EmploymentBars.tsx`
- `packages/frontend/app/tour/components/charts/Gauge.tsx`
- `packages/frontend/app/tour/components/charts/ScoreRing.tsx`
- `packages/frontend/app/tour/print.css`
- Tests for each section (one happy path + one limited-data path per section)

**Modify:**

- `packages/frontend/app/tour/page.tsx` — wire `phase=step4` to render `<Step4Aha />`

---

### Task 1: ScoreRing chart primitive

**Files:**

- Create: `packages/frontend/app/tour/components/charts/ScoreRing.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/charts/ScoreRing.tsx
"use client";

interface Props {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreRing({ score, size = "md" }: Props) {
  const px = size === "lg" ? 130 : size === "md" ? 88 : 60;
  const inset = size === "lg" ? 12 : size === "md" ? 8 : 6;
  const fontSize =
    size === "lg" ? "text-[42px]" : size === "md" ? "text-[28px]" : "text-base";
  const angle = Math.max(0, Math.min(360, (score / 100) * 360));
  return (
    <div
      className="relative grid place-items-center rounded-full"
      style={{
        width: px,
        height: px,
        background: `conic-gradient(#00C853 0deg ${angle}deg, #C7CAD7 ${angle}deg 360deg)`,
      }}
      aria-label={`PropertyIQ Score ${score} of 100`}
    >
      <div
        className="absolute rounded-full bg-white"
        style={{ inset }}
        aria-hidden="true"
      />
      <span
        className={`relative font-mono font-semibold text-primary-dark ${fontSize}`}
      >
        {score}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/charts/ScoreRing.tsx
git commit -m "feat(tour): ScoreRing chart primitive"
```

---

### Task 2: TrajectoryChart (12-mo line chart, target vs metro vs state)

**Files:**

- Create: `packages/frontend/app/tour/components/charts/TrajectoryChart.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/charts/TrajectoryChart.tsx
"use client";

interface Series {
  label: string;
  values: number[];
  color: string;
}
interface Props {
  series: Series[];
  height?: number;
}

export function TrajectoryChart({ series, height = 140 }: Props) {
  if (series.length === 0 || series[0].values.length === 0) {
    return (
      <p className="text-xs text-on-surface-variant">
        Limited data — chart unavailable.
      </p>
    );
  }
  const all = series.flatMap((s) => s.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(1, max - min);
  const w = 800;
  const points = (s: Series) =>
    s.values
      .map((v, i) => {
        const x = (i / (s.values.length - 1)) * (w - 40) + 20;
        const y = height - 10 - ((v - min) / span) * (height - 30);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <div className="rounded-2xl bg-surface-container px-6 py-5">
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        className="h-[140px] w-full"
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={0}
            x2={w}
            y1={height * g}
            y2={height * g}
            stroke="#E0E0E0"
            strokeDasharray="3,3"
            strokeWidth={0.5}
          />
        ))}
        {series.map((s) => (
          <polyline
            key={s.label}
            points={points(s)}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
          />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-on-surface-variant">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/charts/TrajectoryChart.tsx
git commit -m "feat(tour): TrajectoryChart SVG line chart"
```

---

### Task 3: ForecastChart (line + 80% CI shading + NOW marker)

**Files:**

- Create: `packages/frontend/app/tour/components/charts/ForecastChart.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/charts/ForecastChart.tsx
"use client";

interface Props {
  historic: number[]; // past 12 months
  forecast: number[]; // next 12 months (median projection)
  ciLow: number[]; // lower bound (same length as forecast)
  ciHigh: number[]; // upper bound
}

export function ForecastChart({ historic, forecast, ciLow, ciHigh }: Props) {
  if (historic.length === 0 && forecast.length === 0) {
    return (
      <p className="text-xs text-on-surface-variant">Forecast unavailable.</p>
    );
  }
  const all = [...historic, ...forecast, ...ciLow, ...ciHigh];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(1, max - min);
  const w = 800;
  const h = 140;
  const totalPts = historic.length + forecast.length;
  const xAt = (i: number) => (i / (totalPts - 1)) * (w - 40) + 20;
  const yAt = (v: number) => h - 10 - ((v - min) / span) * (h - 30);

  const histPath = historic.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  const fcPath = forecast
    .map((v, i) => `${xAt(historic.length + i)},${yAt(v)}`)
    .join(" ");
  const ciPolygon = [
    ...ciHigh.map((v, i) => `${xAt(historic.length + i)},${yAt(v)}`),
    ...ciLow.map(
      (v, i) =>
        `${xAt(historic.length + ciLow.length - 1 - i)},${yAt(ciLow[ciLow.length - 1 - i])}`,
    ),
  ].join(" ");
  const nowX = xAt(historic.length - 0.5);

  return (
    <div className="rounded-2xl bg-surface-container px-5 py-4">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-[140px] w-full"
      >
        <polygon points={ciPolygon} fill="#3949AB" opacity={0.15} />
        <polyline
          points={histPath}
          fill="none"
          stroke="#3949AB"
          strokeWidth={2.5}
        />
        <polyline
          points={fcPath}
          fill="none"
          stroke="#3949AB"
          strokeWidth={2.5}
          strokeDasharray="5,4"
        />
        <line
          x1={nowX}
          x2={nowX}
          y1={0}
          y2={h}
          stroke="#FF8F00"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
        <text
          x={nowX + 4}
          y={14}
          fill="#FF8F00"
          fontSize="10"
          fontFamily="Roboto Mono"
        >
          NOW
        </text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/charts/ForecastChart.tsx
git commit -m "feat(tour): ForecastChart with 80% CI shading"
```

---

### Task 4: EmploymentBars + Gauge primitives

**Files:**

- Create: `packages/frontend/app/tour/components/charts/EmploymentBars.tsx`
- Create: `packages/frontend/app/tour/components/charts/Gauge.tsx`

- [ ] **Step 1: EmploymentBars**

```tsx
// packages/frontend/app/tour/components/charts/EmploymentBars.tsx
"use client";

interface Bar {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}
interface Props {
  rows: Bar[];
}

export function EmploymentBars({ rows }: Props) {
  if (rows.length === 0)
    return (
      <p className="text-xs text-on-surface-variant">
        Sector data unavailable for this market.
      </p>
    );
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = Math.max(0, Math.min(100, (r.value / r.max) * 100));
        return (
          <div key={r.label} className="flex items-center gap-2.5 text-xs">
            <span className="w-24 truncate text-on-surface-variant">
              {r.label}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-primary-container">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-primary to-primary-dark"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="w-12 text-right font-mono font-medium text-on-surface">
              {r.value}
              {r.suffix ?? "%"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Gauge**

```tsx
// packages/frontend/app/tour/components/charts/Gauge.tsx
"use client";

interface Props {
  title: string;
  value: string;
  meta: string;
  markerPercent: number;
  scale: [string, string, string];
}

export function Gauge({ title, value, meta, markerPercent, scale }: Props) {
  const left = `${Math.max(0, Math.min(100, markerPercent))}%`;
  return (
    <div className="rounded-2xl bg-surface-container p-5 text-center">
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      <p className="mt-3 font-mono text-[38px] font-semibold text-primary-dark">
        {value}
      </p>
      <p className="text-xs text-on-surface-variant">{meta}</p>
      <div className="relative my-4 h-3 rounded-full bg-gradient-to-r from-[#B3261E] via-[#FF8F00] to-[#00C853]">
        <span
          className="absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-sm bg-on-surface"
          style={{ left }}
          aria-hidden="true"
        />
      </div>
      <div className="flex justify-between text-[10px] text-on-surface-variant">
        <span>{scale[0]}</span>
        <span>{scale[1]}</span>
        <span>{scale[2]}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/tour/components/charts/
git commit -m "feat(tour): EmploymentBars + Gauge chart primitives"
```

---

### Task 5: ListingPresentationLoading (rotating progress messages)

**Files:**

- Create: `packages/frontend/app/tour/components/ListingPresentationLoading.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/ListingPresentationLoading.tsx
"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Pulling 14 market signals…",
  "Comparing against peer markets…",
  "Building 12-month forecast…",
  "Drafting strategy synthesis…",
];
const ROTATE_MS = 2800;

export function ListingPresentationLoading({
  marketName,
}: {
  marketName: string;
}) {
  const [idx, setIdx] = useState(0);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const t = setInterval(
      () => setIdx((i) => Math.min(i + 1, MESSAGES.length - 1)),
      ROTATE_MS,
    );
    const stickT = setTimeout(() => setStuck(true), 15_000);
    return () => {
      clearInterval(t);
      clearTimeout(stickT);
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-primary-light border-t-primary" />
      <p className="mt-5 text-base font-medium text-on-surface">
        Building your {marketName} listing presentation
      </p>
      <p className="mt-1 text-sm text-on-surface-variant">{MESSAGES[idx]}</p>
      {stuck && (
        <p className="mt-4 text-xs text-on-surface-variant/80">
          Still working on it. Larger markets take a bit longer.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/ListingPresentationLoading.tsx
git commit -m "feat(tour): ListingPresentationLoading with rotating progress + stuck banner"
```

---

### Task 6: ListingPresentationError + retry

**Files:**

- Create: `packages/frontend/app/tour/components/ListingPresentationError.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/ListingPresentationError.tsx
"use client";

interface Props {
  error: Error;
  onRetry: () => void;
  onSignupRedirect?: () => void;
}

export function ListingPresentationError({
  error,
  onRetry,
  onSignupRedirect,
}: Props) {
  const isRateLimit =
    error.message === "rate_limited" || (error as any).retryAfter != null;

  if (isRateLimit) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-2xl font-semibold text-on-surface">
          You've used today's free demo
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          Sign up free to generate unlimited reports — and your first one is
          saved and waiting.
        </p>
        <button
          type="button"
          onClick={onSignupRedirect}
          className="mt-6 rounded-full bg-primary-dark px-6 py-3 text-sm font-medium text-white"
        >
          Sign up free →
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <p className="text-xl font-semibold text-on-surface">
        We couldn't build that report.
      </p>
      <p className="mt-2 text-sm text-on-surface-variant">{error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary"
      >
        Try again
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/ListingPresentationError.tsx
git commit -m "feat(tour): ListingPresentationError with rate-limit + retry branches"
```

---

### Task 7: ListingPresentationCover

**Files:**

- Create: `packages/frontend/app/tour/components/ListingPresentationCover.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/ListingPresentationCover.tsx
"use client";

interface Props {
  marketName: string;
  geographyDescription: string;
  households?: number;
  generatedAt: string;
}

export function ListingPresentationCover({
  marketName,
  geographyDescription,
  households,
  generatedAt,
}: Props) {
  return (
    <header className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-primary-dark via-primary to-[#5C6BC0] px-12 pt-14 pb-12 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)",
        }}
      />
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-80">
        PropertyIQ Market Intelligence
      </p>
      <h1 className="mt-3 text-[38px] font-semibold leading-[1.15] tracking-tight">
        {marketName}
        <br />
        Listing Presentation
      </h1>
      <p className="mt-1 text-base opacity-85">
        Pre-listing market analysis ·{" "}
        {new Date(generatedAt).toLocaleString("en-US", {
          month: "long",
          year: "numeric",
        })}
      </p>
      <dl className="mt-8 flex gap-8 border-t border-white/20 pt-5 text-xs">
        <Meta label="Geography" value={geographyDescription} />
        <Meta
          label="Households"
          value={households ? `~${households.toLocaleString()}` : "—"}
        />
        <Meta
          label="Generated"
          value={new Date(generatedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })}
        />
      </dl>
    </header>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.08em] opacity-65">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] font-medium">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/ListingPresentationCover.tsx
git commit -m "feat(tour): ListingPresentationCover"
```

---

### Task 8: ExecutiveSummary section

**Files:**

- Create: `packages/frontend/app/tour/components/listing-sections/ExecutiveSummary.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/listing-sections/ExecutiveSummary.tsx
"use client";

import { ScoreRing } from "../charts/ScoreRing";
import { Section } from "./Section";

interface Props {
  score?: {
    score: number;
    label: string;
    confidenceLetter: string;
    confidencePercent: number;
    quarterChange?: number;
  };
  thesisParagraphs: string[];
  recommendation: string;
  limitedData: boolean;
}

export function ExecutiveSummary({
  score,
  thesisParagraphs,
  recommendation,
  limitedData,
}: Props) {
  if (limitedData || !score) {
    return (
      <Section num="01" title="Executive summary">
        <p className="text-sm text-on-surface-variant">
          Limited data available for this market — full executive summary
          unavailable. The structured signals below remain accurate.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num="01"
      title="Executive summary"
      subtitle="The 60-second story you'd tell a seller across a kitchen table."
    >
      <div className="grid grid-cols-1 gap-7 md:grid-cols-[220px_1fr]">
        <div className="rounded-2xl bg-surface-container p-6 text-center">
          <ScoreRing score={score.score} size="lg" />
          <p className="mt-3 text-base font-semibold text-on-surface">
            {score.label}
          </p>
          <p className="mt-1 text-[11.5px] text-on-surface-variant">
            Confidence:{" "}
            <strong className="text-primary-dark">
              {score.confidenceLetter} · {score.confidencePercent}%
            </strong>
            {typeof score.quarterChange === "number" && (
              <>
                <br />
                {score.quarterChange >= 0 ? "↑" : "↓"}{" "}
                {Math.abs(score.quarterChange)} since last quarter
              </>
            )}
          </p>
        </div>
        <div className="text-[15px] leading-[1.65] text-on-surface">
          {thesisParagraphs.map((p, i) => (
            <p key={i} className="mb-3 last:mb-0">
              {p}
            </p>
          ))}
          <div className="mt-4 rounded-r-xl border-l-[3px] border-[#00C853] bg-gradient-to-b from-[#f8f9ff] to-white px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#00C853]">
              The recommendation
            </p>
            <p className="mt-1 text-sm font-medium text-on-surface">
              {recommendation}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Add the shared Section wrapper**

```tsx
// packages/frontend/app/tour/components/listing-sections/Section.tsx
"use client";

import type { ReactNode } from "react";

interface Props {
  num: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Section({ num, title, subtitle, children }: Props) {
  return (
    <section className="border-b border-outline-variant/40 px-12 py-10 last:border-b-0">
      <header className="mb-4">
        <span className="mr-2.5 inline-grid h-7 w-7 place-items-center rounded-lg bg-primary-container font-mono text-[13px] font-semibold text-primary-dark align-middle">
          {num}
        </span>
        <h2 className="inline align-middle text-[22px] font-semibold text-on-surface">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 pl-9 text-[13px] text-on-surface-variant">
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/tour/components/listing-sections/
git commit -m "feat(tour): ExecutiveSummary section + shared Section wrapper"
```

---

### Task 9: MarketNow stat grid

**Files:**

- Create: `packages/frontend/app/tour/components/listing-sections/MarketNow.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/listing-sections/MarketNow.tsx
"use client";

import { Section } from "./Section";

interface Stat {
  lbl: string;
  val: string;
  delta?: string;
  deltaDir?: "up" | "down" | "flat";
}
interface Props {
  stats: Stat[];
  limitedData: boolean;
}

export function MarketNow({ stats, limitedData }: Props) {
  if (limitedData || stats.length === 0) {
    return (
      <Section num="02" title="The market right now">
        <p className="text-sm text-on-surface-variant">
          Limited data available for this market. Try a nearby metro for richer
          signals.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num="02"
      title="The market right now"
      subtitle="Where this market stands as of today, with one-quarter momentum."
    >
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.lbl} className="rounded-xl bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              {s.lbl}
            </p>
            <p className="mt-1 font-mono text-[22px] font-semibold text-on-surface">
              {s.val}
            </p>
            {s.delta && (
              <p
                className={`mt-0.5 text-[11.5px] font-medium ${
                  s.deltaDir === "up"
                    ? "text-[#00C853]"
                    : s.deltaDir === "down"
                      ? "text-[#B3261E]"
                      : "text-on-surface-variant"
                }`}
              >
                {s.delta}
              </p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/listing-sections/MarketNow.tsx
git commit -m "feat(tour): MarketNow 8-stat grid section"
```

---

### Task 10: Trajectory + Forecast sections (use chart primitives)

**Files:**

- Create: `packages/frontend/app/tour/components/listing-sections/Trajectory.tsx`
- Create: `packages/frontend/app/tour/components/listing-sections/Forecast.tsx`

- [ ] **Step 1: Trajectory**

```tsx
// packages/frontend/app/tour/components/listing-sections/Trajectory.tsx
"use client";

import { Section } from "./Section";
import { TrajectoryChart } from "../charts/TrajectoryChart";

interface Props {
  marketName: string;
  parentMetroName: string;
  stateName: string;
  marketSeries: number[];
  parentSeries: number[];
  stateSeries: number[];
  marketYoy: number;
  parentYoy: number;
  stateYoy: number;
  limitedData: boolean;
}

export function Trajectory({
  marketName,
  parentMetroName,
  stateName,
  marketSeries,
  parentSeries,
  stateSeries,
  marketYoy,
  parentYoy,
  stateYoy,
  limitedData,
}: Props) {
  if (limitedData)
    return (
      <Section num="03" title="12-month trajectory">
        <p className="text-sm text-on-surface-variant">
          Trajectory unavailable for this market.
        </p>
      </Section>
    );
  return (
    <Section
      num="03"
      title="12-month trajectory"
      subtitle="How prices, demand, and supply have moved over the past year."
    >
      <p className="mb-3 text-[13px] font-semibold text-on-surface">
        Median home value · indexed (start = 100)
      </p>
      <TrajectoryChart
        series={[
          {
            label: `${marketName} (${marketYoy >= 0 ? "+" : ""}${marketYoy.toFixed(1)}%)`,
            values: marketSeries,
            color: "#3949AB",
          },
          {
            label: `${parentMetroName} (${parentYoy >= 0 ? "+" : ""}${parentYoy.toFixed(1)}%)`,
            values: parentSeries,
            color: "#5C6BC0",
          },
          {
            label: `${stateName} (${stateYoy >= 0 ? "+" : ""}${stateYoy.toFixed(1)}%)`,
            values: stateSeries,
            color: "#9E9E9E",
          },
        ]}
      />
    </Section>
  );
}
```

- [ ] **Step 2: Forecast**

```tsx
// packages/frontend/app/tour/components/listing-sections/Forecast.tsx
"use client";

import { Section } from "./Section";
import { ForecastChart } from "../charts/ForecastChart";

interface Props {
  historic: number[];
  forecast: number[];
  ciLow: number[];
  ciHigh: number[];
  projectedPrice: string;
  projectedRange: string;
  projectedRent: string;
  projectedRentChange: string;
  riskFactor: string;
  limitedData: boolean;
}

export function Forecast(p: Props) {
  if (p.limitedData)
    return (
      <Section num="04" title="Forward forecast">
        <p className="text-sm text-on-surface-variant">Forecast unavailable.</p>
      </Section>
    );
  return (
    <Section
      num="04"
      title="Forward forecast · next 6-12 months"
      subtitle="PropertyIQ's modeled outlook with 80% confidence interval."
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[2fr_1fr]">
        <ForecastChart
          historic={p.historic}
          forecast={p.forecast}
          ciLow={p.ciLow}
          ciHigh={p.ciHigh}
        />
        <div className="space-y-3">
          <ForecastCard
            label="12-month projected price"
            value={p.projectedPrice}
            meta={p.projectedRange}
          />
          <ForecastCard
            label="12-month projected rent"
            value={p.projectedRent}
            meta={p.projectedRentChange}
          />
          <ForecastCard
            label="Risk factor"
            value="Mortgage rates"
            meta={p.riskFactor}
            risk
          />
        </div>
      </div>
    </Section>
  );
}

function ForecastCard({
  label,
  value,
  meta,
  risk,
}: {
  label: string;
  value: string;
  meta: string;
  risk?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 ${risk ? "border-l-4 border-l-[#FF8F00] border-outline-variant" : "border-outline-variant"}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 font-mono text-base font-semibold text-on-surface">
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-on-surface-variant">{meta}</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/tour/components/listing-sections/Trajectory.tsx \
  packages/frontend/app/tour/components/listing-sections/Forecast.tsx
git commit -m "feat(tour): Trajectory + Forecast sections"
```

---

### Task 11: Peers, Migration, Affordability, Employment, Validation sections

**Files:**

- Create: `packages/frontend/app/tour/components/listing-sections/Peers.tsx`
- Create: `packages/frontend/app/tour/components/listing-sections/Migration.tsx`
- Create: `packages/frontend/app/tour/components/listing-sections/Affordability.tsx`
- Create: `packages/frontend/app/tour/components/listing-sections/Employment.tsx`
- Create: `packages/frontend/app/tour/components/listing-sections/Validation.tsx`

These follow the same pattern: import `Section`, render the visual layout from the brainstorm mockup (`.superpowers/brainstorm/2528-1777823013/content/listing-preso-rockstar.html`), and accept a `limitedData: boolean` prop.

- [ ] **Step 1: Peers (3-column highlight grid)**

```tsx
// packages/frontend/app/tour/components/listing-sections/Peers.tsx
"use client";

import { Section } from "./Section";

interface Peer {
  name: string;
  scoreLabel: string;
  medianPrice: string;
  yoyGrowth: string;
  dom: string;
  soldAboveList: string;
  isSource?: boolean;
}
interface Props {
  peers: Peer[];
  limitedData: boolean;
}

export function Peers({ peers, limitedData }: Props) {
  if (limitedData || peers.length === 0)
    return (
      <Section num="05" title="Where this market sits vs. its peers">
        <p className="text-sm text-on-surface-variant">
          No comparable peer markets available.
        </p>
      </Section>
    );
  return (
    <Section
      num="05"
      title="Where this market sits vs. its peers"
      subtitle="PropertyIQ-matched comparables — same metro tier, similar demographics + size."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {peers.map((p) => (
          <div
            key={p.name}
            className={`rounded-xl p-4 ${p.isSource ? "border border-[#b8e0c2] bg-gradient-to-b from-[#f0fff4] to-surface-container" : "bg-surface-container"}`}
          >
            <p className="text-[13px] font-semibold text-on-surface">
              {p.name}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              {p.scoreLabel}
            </p>
            <dl className="mt-2.5 space-y-1 text-[11.5px]">
              <Row lbl="Median price" val={p.medianPrice} />
              <Row lbl="12-mo growth" val={p.yoyGrowth} />
              <Row lbl="Days on market" val={p.dom} />
              <Row lbl="Sold above list" val={p.soldAboveList} />
            </dl>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Row({ lbl, val }: { lbl: string; val: string }) {
  return (
    <div className="flex justify-between border-t border-outline-variant/30 py-1 first:border-t-0">
      <span className="text-on-surface-variant">{lbl}</span>
      <span className="font-mono font-semibold text-on-surface">{val}</span>
    </div>
  );
}
```

- [ ] **Step 2: Migration (top-5 inflows + buyer-affordability column)**

```tsx
// packages/frontend/app/tour/components/listing-sections/Migration.tsx
"use client";

import { Section } from "./Section";

interface Inflow {
  fromName: string;
  count: number;
}
interface DemoRow {
  lbl: string;
  val: string;
}
interface Props {
  inflows: Inflow[];
  demographics: DemoRow[];
  limitedData: boolean;
}

export function Migration({ inflows, demographics, limitedData }: Props) {
  if (limitedData) {
    return (
      <Section num="06" title="Who lives here · who's moving here">
        <p className="text-sm text-on-surface-variant">
          Migration data is limited for this market. Try a larger metro or
          county.
        </p>
      </Section>
    );
  }
  return (
    <Section
      num="06"
      title="Who lives here · who's moving here"
      subtitle="Demographics + migration patterns. Where buyers come from, what they earn, what they want."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-outline-variant bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
            Top 5 in-migration sources · last 12 months
          </p>
          <ul className="mt-2 divide-y divide-outline-variant/30">
            {inflows.map((f) => (
              <li
                key={f.fromName}
                className="flex items-center justify-between py-1.5 text-[12.5px]"
              >
                <span className="font-medium text-on-surface">
                  {f.fromName}
                </span>
                <span className="font-mono font-semibold text-primary-dark">
                  +{f.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-outline-variant bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
            Demographics
          </p>
          <ul className="mt-2 divide-y divide-outline-variant/30">
            {demographics.map((d) => (
              <li
                key={d.lbl}
                className="flex items-center justify-between py-1.5 text-[12.5px]"
              >
                <span className="font-medium text-on-surface">{d.lbl}</span>
                <span className="font-mono font-semibold text-primary-dark">
                  {d.val}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Affordability (two gauges)**

```tsx
// packages/frontend/app/tour/components/listing-sections/Affordability.tsx
"use client";

import { Section } from "./Section";
import { Gauge } from "../charts/Gauge";

interface Props {
  affordabilityIndex: number;
  affordabilityMeta: string;
  affordabilityMarker: number;
  rentVsBuyYears: number;
  rentVsBuyMeta: string;
  rentVsBuyMarker: number;
  limitedData: boolean;
}

export function Affordability(p: Props) {
  if (p.limitedData)
    return (
      <Section num="07" title="Affordability snapshot">
        <p className="text-sm text-on-surface-variant">
          Affordability data unavailable.
        </p>
      </Section>
    );
  return (
    <Section
      num="07"
      title="Affordability snapshot"
      subtitle="How affordable is this market for the typical buyer at today's rates?"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Gauge
          title="Affordability index"
          value={String(p.affordabilityIndex)}
          meta={p.affordabilityMeta}
          markerPercent={p.affordabilityMarker}
          scale={["Unaffordable", "Stretched", "Affordable"]}
        />
        <Gauge
          title="Rent-vs-buy break-even"
          value={`${p.rentVsBuyYears.toFixed(1)} yrs`}
          meta={p.rentVsBuyMeta}
          markerPercent={p.rentVsBuyMarker}
          scale={["2 yrs", "5 yrs", "10+ yrs"]}
        />
      </div>
    </Section>
  );
}
```

- [ ] **Step 4: Employment (sector bars + labor signals)**

```tsx
// packages/frontend/app/tour/components/listing-sections/Employment.tsx
"use client";

import { Section } from "./Section";
import { EmploymentBars } from "../charts/EmploymentBars";

interface Bar {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}
interface Props {
  sectors: Bar[];
  signals: Bar[];
  limitedData: boolean;
}

export function Employment({ sectors, signals, limitedData }: Props) {
  if (limitedData)
    return (
      <Section num="08" title="Economic drivers">
        <p className="text-sm text-on-surface-variant">
          Sector breakdown unavailable for this market.
        </p>
      </Section>
    );
  return (
    <Section
      num="08"
      title="Economic drivers"
      subtitle="The job market, wage growth, and structural employer mix that anchor demand."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-surface-container p-4">
          <p className="text-[12px] font-semibold text-on-surface">
            Employment by sector
          </p>
          <div className="mt-2">
            <EmploymentBars rows={sectors} />
          </div>
        </div>
        <div className="rounded-xl bg-surface-container p-4">
          <p className="text-[12px] font-semibold text-on-surface">
            Labor market signals
          </p>
          <div className="mt-2">
            <EmploymentBars rows={signals} />
          </div>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 5: Validation (green-accent badge)**

```tsx
// packages/frontend/app/tour/components/listing-sections/Validation.tsx
"use client";

import { Section } from "./Section";

interface Props {
  directionalAccuracy: number;
  observations: number;
  excessReturn3y: number;
  vsLabel: string;
  averageOutperformance: number;
  limitedData: boolean;
}

export function Validation(p: Props) {
  if (p.limitedData)
    return (
      <Section num="09" title="PropertyIQ's track record here">
        <p className="text-sm text-on-surface-variant">
          Validation data unavailable.
        </p>
      </Section>
    );
  return (
    <Section
      num="09"
      title="PropertyIQ's track record here"
      subtitle="How accurate has the score been historically?"
    >
      <div className="rounded-2xl border border-[#b8e0c2] bg-gradient-to-br from-[#f0fff4] to-white p-6">
        <div className="flex items-center gap-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#00C853] text-3xl text-white">
            ✓
          </div>
          <div>
            <p className="text-[15px] font-semibold text-on-surface">
              Validated against 3 years of outcomes
            </p>
            <p className="mt-1 text-[13px] leading-snug text-on-surface">
              Markets scored 80+ have outperformed the state median price growth
              by an average of{" "}
              <strong className="font-mono text-[#00C853]">
                +{p.averageOutperformance.toFixed(1)}%/yr
              </strong>{" "}
              over 36 months. Directional accuracy in this metro:{" "}
              <strong className="font-mono text-[#00C853]">
                {p.directionalAccuracy}%
              </strong>{" "}
              across {p.observations} observations.{" "}
              <strong className="font-mono text-[#00C853]">
                3-year excess return: {p.excessReturn3y > 0 ? "+" : ""}
                {p.excessReturn3y.toFixed(1)}%
              </strong>{" "}
              vs {p.vsLabel}.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/tour/components/listing-sections/
git commit -m "feat(tour): Peers, Migration, Affordability, Employment, Validation sections"
```

---

### Task 12: AiStrategy section + actions

**Files:**

- Create: `packages/frontend/app/tour/components/listing-sections/AiStrategy.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/listing-sections/AiStrategy.tsx
"use client";

import { Section } from "./Section";

interface Action {
  title: string;
  desc: string;
}
interface Props {
  thesis: string;
  strategyParagraphs: string[];
  actions: Action[];
  fallbackUsed: boolean;
}

export function AiStrategy({
  thesis,
  strategyParagraphs,
  actions,
  fallbackUsed,
}: Props) {
  return (
    <Section
      num="10"
      title="Recommended seller strategy"
      subtitle="PropertyIQ's AI synthesizes the data above into a positioning playbook."
    >
      <div className="relative rounded-2xl border border-primary-light bg-gradient-to-b from-[#f8f9ff] to-white px-7 py-6">
        <span className="absolute -top-2.5 left-6 bg-white px-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
          ✦ AI Strategy{fallbackUsed && " (fallback)"}
        </span>
        <div className="font-serif text-[14px] leading-[1.75] text-on-surface">
          {thesis && (
            <p className="mb-3.5">
              <strong className="font-semibold text-primary-dark">
                {thesis}
              </strong>
            </p>
          )}
          {strategyParagraphs.map((p, i) => (
            <p key={i} className="mb-3.5 last:mb-0">
              {p}
            </p>
          ))}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {actions.map((a, i) => (
            <div
              key={i}
              className="relative rounded-xl border-[1.5px] border-primary-container bg-white p-4"
            >
              <span className="absolute -top-2.5 left-4 rounded-md bg-primary-dark px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-[13px] font-semibold text-on-surface">
                {a.title}
              </p>
              <p className="mt-1.5 text-[12px] leading-snug text-on-surface-variant">
                {a.desc}
              </p>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/listing-sections/AiStrategy.tsx
git commit -m "feat(tour): AiStrategy section with action cards"
```

---

### Task 13: ListingPresentation root component (assembles everything)

**Files:**

- Create: `packages/frontend/app/tour/components/ListingPresentation.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/ListingPresentation.tsx
"use client";

import type { AnonReportResponse } from "@/lib/data";
import { ListingPresentationCover } from "./ListingPresentationCover";
import { ExecutiveSummary } from "./listing-sections/ExecutiveSummary";
import { MarketNow } from "./listing-sections/MarketNow";
import { Trajectory } from "./listing-sections/Trajectory";
import { Forecast } from "./listing-sections/Forecast";
import { Peers } from "./listing-sections/Peers";
import { Migration } from "./listing-sections/Migration";
import { Affordability } from "./listing-sections/Affordability";
import { Employment } from "./listing-sections/Employment";
import { Validation } from "./listing-sections/Validation";
import { AiStrategy } from "./listing-sections/AiStrategy";

interface Props {
  report: AnonReportResponse;
  marketName: string;
  geographyDescription: string;
  households?: number;
  showWatermark: boolean;
}

function pickSection(sections: any[], id: string) {
  return sections.find((s) => s.id === id);
}

export function ListingPresentation({
  report,
  marketName,
  geographyDescription,
  households,
  showWatermark,
}: Props) {
  const sections = report.report.sections;

  // Each section component reads its own slice. The orchestration here just
  // unpacks the API response into props the sections expect. Mapping logic
  // for shape transforms (e.g., raw Redfin metric → display label) lives in
  // the section component, NOT here, to keep this assembly file thin.
  const exec = pickSection(sections, "executive-summary");
  const market = pickSection(sections, "market-now");
  const traj = pickSection(sections, "trajectory-12mo");
  const fc = pickSection(sections, "forecast");
  const peers = pickSection(sections, "peers");
  const mig = pickSection(sections, "migration");
  const aff = pickSection(sections, "affordability");
  const emp = pickSection(sections, "employment");
  const val = pickSection(sections, "validation");
  const ai = pickSection(sections, "ai-strategy");

  return (
    <article className="mx-auto max-w-4xl overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(57,73,171,0.18)] ring-1 ring-primary-light">
      <ListingPresentationCover
        marketName={marketName}
        geographyDescription={geographyDescription}
        households={households}
        generatedAt={new Date().toISOString()}
      />

      {showWatermark && (
        <div className="flex items-center justify-between border-b border-[#ffd591] bg-[#fff7e6] px-12 py-2.5 text-[12px] text-[#874d00]">
          <span>
            <strong>Demo report</strong> — sign up free below to save, share,
            brand it with your photo, and remove this banner.
          </span>
          <a
            href="#signup-cta"
            className="font-semibold text-primary-dark no-underline"
          >
            Save my report →
          </a>
        </div>
      )}

      <ExecutiveSummary
        {...(exec?.data ?? {})}
        limitedData={!!exec?.limitedData}
      />
      <MarketNow
        {...(market?.data ?? {})}
        limitedData={!!market?.limitedData}
      />
      <Trajectory {...(traj?.data ?? {})} limitedData={!!traj?.limitedData} />
      <Forecast {...(fc?.data ?? {})} limitedData={!!fc?.limitedData} />
      <Peers {...(peers?.data ?? {})} limitedData={!!peers?.limitedData} />
      <Migration {...(mig?.data ?? {})} limitedData={!!mig?.limitedData} />
      <Affordability {...(aff?.data ?? {})} limitedData={!!aff?.limitedData} />
      <Employment {...(emp?.data ?? {})} limitedData={!!emp?.limitedData} />
      <Validation {...(val?.data ?? {})} limitedData={!!val?.limitedData} />
      <AiStrategy
        {...(ai?.data ?? {})}
        fallbackUsed={!!ai?.data?.fallbackUsed}
      />

      <footer className="border-t border-outline-variant/40 bg-surface-container px-12 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Data sources &amp; methodology
        </p>
        <p className="mt-1.5 text-[11px] leading-[1.7] text-on-surface-variant">
          <strong className="text-on-surface">Zillow ZHVI</strong>,{" "}
          <strong className="text-on-surface">Redfin Market Tracker</strong>,{" "}
          <strong className="text-on-surface">U.S. Census ACS 5-Year</strong>,{" "}
          <strong className="text-on-surface">FRED / BEA</strong>,{" "}
          <strong className="text-on-surface">BLS QCEW</strong>,{" "}
          <strong className="text-on-surface">
            IRS Statistics of Income migration data
          </strong>
          , <strong className="text-on-surface">PropertyIQ Score v4</strong>{" "}
          (proprietary, validated quarterly). Forecasts use PropertyIQ's
          time-series model with 80% confidence intervals. Validation
          methodology at /scores/accuracy.
        </p>
      </footer>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/ListingPresentation.tsx
git commit -m "feat(tour): ListingPresentation root component (assembles all 10 sections)"
```

---

### Task 14: Step4Aha orchestrator

**Files:**

- Create: `packages/frontend/app/tour/components/Step4Aha.tsx`

- [ ] **Step 1: Implement**

```tsx
// packages/frontend/app/tour/components/Step4Aha.tsx
"use client";

import { useEffect } from "react";
import {
  useAnonymousListingPresentation,
  TourRateLimitError,
} from "@/lib/data";
import { useTour } from "../TourStateProvider";
import { ListingPresentation } from "./ListingPresentation";
import { ListingPresentationLoading } from "./ListingPresentationLoading";
import { ListingPresentationError } from "./ListingPresentationError";

export function Step4Aha() {
  const { session } = useTour();
  const mutation = useAnonymousListingPresentation();

  useEffect(() => {
    if (mutation.isIdle && session.persona && session.market) {
      mutation.mutate({
        sessionId: session.sessionId,
        persona: session.persona,
        market: session.market,
      });
    }
  }, [mutation, session]);

  if (!session.persona || !session.market) {
    return (
      <p className="p-8 text-center text-on-surface-variant">
        Pick a persona and market first.
      </p>
    );
  }

  if (mutation.isPending || mutation.isIdle) {
    return (
      <ListingPresentationLoading
        marketName={session.market.name || "your market"}
      />
    );
  }

  if (mutation.isError) {
    return (
      <ListingPresentationError
        error={mutation.error as Error}
        onRetry={() =>
          mutation.mutate({
            sessionId: session.sessionId,
            persona: session.persona!,
            market: session.market!,
          })
        }
        onSignupRedirect={() => {
          window.location.href = "/auth/sign-up?from=tour-rate-limit";
        }}
      />
    );
  }

  if (mutation.isSuccess && mutation.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ListingPresentation
          report={mutation.data}
          marketName={session.market.name}
          geographyDescription={session.market.name}
          showWatermark={true}
        />
        {/* Phase 05 mounts the inline signup form here, anchored at #signup-cta */}
        <div id="signup-cta" />
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/Step4Aha.tsx
git commit -m "feat(tour): Step4Aha orchestrator (loading → report → error)"
```

---

### Task 15: Wire Step4Aha into /tour page

**Files:**

- Modify: `packages/frontend/app/tour/page.tsx`

- [ ] **Step 1: Update phase switch**

Replace the placeholder for `step4`:

```tsx
case 'step4':
  return <Step4Aha />;
```

Add the import: `import { Step4Aha } from './components/Step4Aha';`

- [ ] **Step 2: Smoke test**

Walk: `/tour` → persona → market → step1 → step2 → step3 → Continue → `/tour?phase=step4`.
Expected: Loading screen with rotating messages → listing presentation renders with cover, demo banner, all 10 sections.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/tour/page.tsx
git commit -m "feat(tour): wire Step4Aha into /tour phase=step4"
```

---

### Task 16: Mobile responsive tuning

**Files:**

- Modify: each section component to ensure mobile breakpoint is correct

- [ ] **Step 1: Mobile audit**

Test the full flow on Chrome DevTools mobile viewport (375×667).

For each section, verify:

- [ ] Cover meta wraps cleanly (might need flex-wrap added)
- [ ] Stat grids drop from 4 → 2 columns (already in MarketNow via `md:grid-cols-4`)
- [ ] Charts shrink appropriately (SVG has preserveAspectRatio="none" + width 100%)
- [ ] Peers grid stacks vertically (already `md:grid-cols-3`)
- [ ] Migration two-column → vertical stack (already `md:grid-cols-2`)
- [ ] Affordability gauges stack (already `md:grid-cols-2`)
- [ ] Action cards single column on mobile (already `md:grid-cols-3`)

- [ ] **Step 2: Reduce cover horizontal padding on mobile**

In `ListingPresentationCover.tsx`, change `px-12` to `px-6 md:px-12` for the header and update the meta block to `flex-wrap gap-4 md:gap-8`.

In `Section.tsx`, change `px-12 py-10` to `px-5 py-8 md:px-12 md:py-10`.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/tour/components/
git commit -m "fix(tour): mobile responsive tuning for listing presentation"
```

---

### Task 17: Print-friendly CSS

**Files:**

- Create: `packages/frontend/app/tour/print.css`
- Modify: `packages/frontend/app/tour/page.tsx` — `import './print.css';`

- [ ] **Step 1: Print stylesheet**

```css
/* packages/frontend/app/tour/print.css */
@media print {
  /* Hide everything except the listing presentation */
  body * {
    visibility: hidden;
  }
  article,
  article * {
    visibility: visible;
  }
  article {
    position: absolute;
    inset: 0;
    box-shadow: none !important;
  }

  /* Hide the demo banner + signup CTA in print */
  [class*="bg-[#fff7e6]"],
  #signup-cta {
    display: none !important;
  }

  /* Page break per section */
  section {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* No animations in print */
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 2: Smoke test**

In Chrome, open the listing presentation, hit Ctrl+P. Verify only the article prints, with clean section breaks.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/tour/print.css packages/frontend/app/tour/page.tsx
git commit -m "feat(tour): print-friendly CSS for listing presentation"
```

---

### Task 18: Manual end-to-end test

- [ ] **Step 1: Restart dev**

```bash
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
npm run dev:fresh
```

- [ ] **Step 2: Walk the full path**

1. `http://localhost:3000/tour` → persona → market (Cary, NC)
2. Steps 1-3 spotlight → Continue
3. Loading screen rotates messages for 5-8s
4. Listing presentation renders with all 10 sections
5. Cover shows market name + generated date
6. Demo banner visible (subtle amber)
7. SVG charts render in §3 trajectory + §4 forecast + §8 employment
8. AI strategy section has serif typeface + 3 action cards
9. Sources footer cites Zillow / Redfin / Census / FRED / BLS / IRS / PropertyIQ
10. Print preview clean

- [ ] **Step 3: Limited-data smoke**

Try a tiny ZIP (e.g., `zip-99999`). Verify the report still renders, but affected sections show "Limited data available" without breaking layout.

- [ ] **Step 4: Commit any tweaks**

```bash
git add ...
git commit -m "fix(tour): <observation>"
```

---

## Acceptance criteria for Phase 04 done

- [ ] `/tour?phase=step4` triggers `useAnonymousListingPresentation` mutation on mount.
- [ ] Loading state rotates through 4 messages over ~12s.
- [ ] On success, all 10 sections render in order with brand-token styling.
- [ ] Score ring, trajectory chart, forecast chart with CI shading, employment bars, gauges all render as SVG.
- [ ] Demo watermark banner shows below the cover.
- [ ] AI strategy section uses serif typeface and shows 3 action cards (or fallback message).
- [ ] Limited-data sections show graceful empty-state messages instead of broken layouts.
- [ ] Mobile (≤768px): stat grid 2-col, peers stack, gauges stack, no horizontal scroll.
- [ ] Print preview renders the article only, with clean section breaks.
- [ ] Wire weight on first generation: <200KB on the unauth report (excluding API payload).
- [ ] No new TypeScript errors in changed files.
