# Activation Tour Redesign — Phase 03: Sandbox

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user's first three "this works" moments. Steps 1-3 of the tour rendered as overlays on the real product (`/map`, `/market/[id]`, `/compare/markets`), each with a spotlight cutout, a connected tooltip, and an auto-advance handler that navigates to the next step.

**Architecture:** A new `TourSpotlight` component renders portal-style on top of any page, reading its step config from the URL `?tour=stepN` query param. It reuses the existing `BreathingSpotlight` and `ConnectedTooltip` UI primitives (built last session), wraps them in a desktop-vs-mobile branch (bottom-sheet on small viewports), and exposes `onAdvance` / `onDismiss`. The `/tour` page detects `phase: step1` and navigates to `/map?tour=step1&persona=…&market=…&sessionId=…`. Step transitions happen via plain URL navigation — no global tour context required on the product pages.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, framer-motion (already in repo), existing `BreathingSpotlight` + `ConnectedTooltip` from `packages/frontend/app/onboarding/`.

**Spec:** [../specs/2026-05-03-activation-tour-redesign-design.md](../specs/2026-05-03-activation-tour-redesign-design.md)

**Depends on:** Phase 02 (`/tour` route + state plumbing). Reuses `BreathingSpotlight`, `ConnectedTooltip` (UI components only — does NOT couple to the legacy `TourProvider` from `app/onboarding/`).

---

## File structure

**New (frontend):**

- `packages/frontend/app/tour/step-content.ts` — content + persona copy for steps 1-3
- `packages/frontend/app/tour/components/TourSpotlight.tsx` — desktop spotlight wrapper
- `packages/frontend/app/tour/components/TourBottomSheet.tsx` — mobile variant
- `packages/frontend/app/tour/hooks/useTourFromUrl.ts` — reads tour params from any page
- `packages/frontend/app/tour/__tests__/step-content.test.ts`
- `packages/frontend/app/tour/__tests__/useTourFromUrl.test.ts`
- `packages/frontend/app/compare/markets/page.tsx` — new market-vs-market route
- `packages/frontend/app/compare/markets/MarketComparisonView.tsx`

**Modify:**

- `packages/frontend/app/tour/page.tsx` — phase `step1` → redirect to `/map?tour=step1&...`
- `packages/frontend/app/map/page.tsx` — render `<TourSpotlight />` when `?tour=step1`
- `packages/frontend/app/market/[id]/page.tsx` — render `<TourSpotlight />` when `?tour=step2`

---

### Task 1: Step content (config-driven)

**Files:**

- Create: `packages/frontend/app/tour/step-content.ts`
- Create: `packages/frontend/app/tour/__tests__/step-content.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/app/tour/__tests__/step-content.test.ts
import { describe, it, expect } from "vitest";
import { getStepContent } from "../step-content";

describe("getStepContent", () => {
  it("returns persona-specific body for agent", () => {
    const c = getStepContent("step2", "agent");
    expect(c.body).toMatch(/score|client|listing/i);
  });

  it("falls back to default body when persona variant missing", () => {
    const c = getStepContent("step1", "investor");
    expect(c.body).toBeTruthy();
  });

  it("throws on unknown step id", () => {
    expect(() => getStepContent("step99" as any, "agent")).toThrow();
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm run test -w packages/frontend -- step-content`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement step content**

```typescript
// packages/frontend/app/tour/step-content.ts
import type { Persona } from "@/lib/data";

export type SandboxStepId = "step1" | "step2" | "step3";

interface StepContent {
  id: SandboxStepId;
  targetSelector: string;
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right";
  personaBody?: Partial<Record<Persona, string>>;
}

const CONTENT: Record<SandboxStepId, StepContent> = {
  step1: {
    id: "step1",
    targetSelector: '[data-tour="search-bar"]',
    title: "You picked your market — let's go",
    body: "PropertyIQ has loaded real data for your market. Click anywhere to continue.",
    placement: "bottom",
    personaBody: {
      agent:
        "PropertyIQ has loaded real data for your farm. Click anywhere to keep going.",
      investor:
        "PropertyIQ has loaded real cashflow + demand data for this market. Click anywhere to keep going.",
      homebuyer:
        "PropertyIQ has loaded real prices + trends for this market. Click anywhere to keep going.",
    },
  },
  step2: {
    id: "step2",
    targetSelector: '[data-tour="propertyiq-score"]',
    title: "Your market's PropertyIQ Score",
    body: "A 0-100 signal of market demand relative to the state average. Higher is stronger.",
    placement: "right",
    personaBody: {
      agent:
        "A 0-100 score you can put in front of a client. Higher means the market is moving — listings sell faster, often above ask.",
      investor:
        "Your investment signal. Higher scores mean stronger demand and competition for inventory.",
      homebuyer:
        "A quick read on how competitive this market is right now. Higher means more competition for buyers.",
    },
  },
  step3: {
    id: "step3",
    targetSelector: '[data-tour="compare-grid"]',
    title: "How your market stacks up",
    body: "PropertyIQ auto-picked the closest peer market for a side-by-side. Click Continue when ready.",
    placement: "top",
    personaBody: {
      agent:
        "PropertyIQ auto-picked the closest peer for a side-by-side — useful when positioning a listing or briefing a buyer client. Click Continue when ready.",
    },
  },
};

export function getStepContent(
  stepId: SandboxStepId,
  persona: Persona | null,
): StepContent & { body: string } {
  const c = CONTENT[stepId];
  if (!c) throw new Error(`Unknown step id: ${stepId}`);
  const body = (persona && c.personaBody?.[persona]) ?? c.body;
  return { ...c, body };
}

export const SANDBOX_STEP_ORDER: SandboxStepId[] = ["step1", "step2", "step3"];

export function nextSandboxStep(current: SandboxStepId): SandboxStepId | null {
  const i = SANDBOX_STEP_ORDER.indexOf(current);
  return i >= 0 && i < SANDBOX_STEP_ORDER.length - 1
    ? SANDBOX_STEP_ORDER[i + 1]
    : null;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test -w packages/frontend -- step-content`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/tour/step-content.ts \
  packages/frontend/app/tour/__tests__/step-content.test.ts
git commit -m "feat(tour): add step-content config for sandbox steps 1-3"
```

---

### Task 2: useTourFromUrl hook

**Files:**

- Create: `packages/frontend/app/tour/hooks/useTourFromUrl.ts`
- Create: `packages/frontend/app/tour/__tests__/useTourFromUrl.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/app/tour/__tests__/useTourFromUrl.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTourFromUrl } from "../hooks/useTourFromUrl";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(globalThis.__params__ ?? ""),
  useRouter: () => ({ push: vi.fn() }),
}));

describe("useTourFromUrl", () => {
  it("returns null when no tour param", () => {
    globalThis.__params__ = "";
    const { result } = renderHook(() => useTourFromUrl());
    expect(result.current.active).toBe(null);
  });

  it("reads stepId, persona, market when tour param present", () => {
    globalThis.__params__ =
      "tour=step1&persona=agent&market=metro-39580&sessionId=abc";
    const { result } = renderHook(() => useTourFromUrl());
    expect(result.current.active?.stepId).toBe("step1");
    expect(result.current.active?.persona).toBe("agent");
    expect(result.current.active?.market.geoId).toBe("39580");
    expect(result.current.active?.sessionId).toBe("abc");
  });
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npm run test -w packages/frontend -- useTourFromUrl`
Expected: FAIL.

- [ ] **Step 3: Implement hook**

```typescript
// packages/frontend/app/tour/hooks/useTourFromUrl.ts
"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MarketRef, Persona } from "@/lib/data";
import {
  type SandboxStepId,
  nextSandboxStep,
  SANDBOX_STEP_ORDER,
} from "../step-content";

export interface ActiveTour {
  stepId: SandboxStepId;
  persona: Persona | null;
  market: MarketRef;
  sessionId: string;
}

function parseMarket(raw: string | null): MarketRef | null {
  if (!raw) return null;
  const m = raw.match(/^([a-z]+)-(.+)$/);
  if (!m) return null;
  return { geoLevel: m[1] as MarketRef["geoLevel"], geoId: m[2], name: "" };
}

export function useTourFromUrl() {
  const sp = useSearchParams();
  const router = useRouter();

  const active = useMemo<ActiveTour | null>(() => {
    const stepId = sp?.get("tour") as SandboxStepId | null;
    if (!stepId || !SANDBOX_STEP_ORDER.includes(stepId)) return null;
    const market = parseMarket(sp.get("market"));
    const sessionId = sp.get("sessionId");
    if (!market || !sessionId) return null;
    return {
      stepId,
      persona: (sp.get("persona") as Persona | null) ?? null,
      market,
      sessionId,
    };
  }, [sp]);

  function buildStepUrl(target: SandboxStepId, route: string): string {
    if (!active) return route;
    const params = new URLSearchParams();
    params.set("tour", target);
    params.set("persona", active.persona ?? "agent");
    params.set("market", `${active.market.geoLevel}-${active.market.geoId}`);
    params.set("sessionId", active.sessionId);
    return `${route}?${params}`;
  }

  function advance() {
    if (!active) return;
    const next = nextSandboxStep(active.stepId);
    if (!next) return;
    const route =
      next === "step2"
        ? `/market/${active.market.geoId}`
        : next === "step3"
          ? `/compare/markets`
          : "/map";
    router.push(buildStepUrl(next, route));
  }

  function dismiss() {
    router.push("/"); // exit tour back to homepage
  }

  function advanceToStep4() {
    if (!active) return;
    const params = new URLSearchParams();
    params.set("persona", active.persona ?? "agent");
    params.set("market", `${active.market.geoLevel}-${active.market.geoId}`);
    params.set("sessionId", active.sessionId);
    params.set("phase", "step4");
    router.push(`/tour?${params}`);
  }

  return { active, advance, dismiss, advanceToStep4 };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test -w packages/frontend -- useTourFromUrl`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/tour/hooks/useTourFromUrl.ts \
  packages/frontend/app/tour/__tests__/useTourFromUrl.test.ts
git commit -m "feat(tour): add useTourFromUrl hook for cross-page step routing"
```

---

### Task 3: TourSpotlight (desktop wrapper)

**Files:**

- Create: `packages/frontend/app/tour/components/TourSpotlight.tsx`

- [ ] **Step 1: Implement the wrapper**

```tsx
// packages/frontend/app/tour/components/TourSpotlight.tsx
"use client";

import { useEffect, useState } from "react";
import { BreathingSpotlight } from "@/app/onboarding/BreathingSpotlight";
import { ConnectedTooltip } from "@/app/onboarding/ConnectedTooltip";
import type { OnboardingStep } from "@/app/onboarding/onboarding-steps";
import {
  getStepContent,
  SANDBOX_STEP_ORDER,
  type SandboxStepId,
} from "../step-content";
import { useTourFromUrl } from "../hooks/useTourFromUrl";
import type { Persona } from "@/lib/data";
import { TourBottomSheet } from "./TourBottomSheet";

export function TourSpotlight({ stepId }: { stepId: SandboxStepId }) {
  const { active, advance, dismiss, advanceToStep4 } = useTourFromUrl();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!active || active.stepId !== stepId) return null;

  const content = getStepContent(stepId, active.persona);
  const isLast = stepId === SANDBOX_STEP_ORDER[SANDBOX_STEP_ORDER.length - 1];
  const onContinue = isLast ? advanceToStep4 : advance;

  if (isMobile) {
    return (
      <TourBottomSheet
        title={content.title}
        body={content.body}
        progress={
          (SANDBOX_STEP_ORDER.indexOf(stepId) + 1) /
          (SANDBOX_STEP_ORDER.length + 1)
        }
        onContinue={onContinue}
        onDismiss={dismiss}
        targetSelector={content.targetSelector}
      />
    );
  }

  // Desktop: BreathingSpotlight + ConnectedTooltip from existing onboarding lib
  const stepForTooltip: OnboardingStep = {
    id: content.id,
    route: null,
    targetSelector: content.targetSelector,
    title: content.title,
    body: content.body,
    placement: content.placement,
    allowManualAdvance: true,
  };

  return (
    <>
      <BreathingSpotlight
        targetSelector={content.targetSelector}
        visible
        onClick={onContinue}
      />
      <ConnectedTooltip
        step={stepForTooltip}
        currentIndex={SANDBOX_STEP_ORDER.indexOf(stepId) + 1}
        totalSteps={SANDBOX_STEP_ORDER.length + 1}
        onDismiss={dismiss}
        onContinue={onContinue}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/TourSpotlight.tsx
git commit -m "feat(tour): add TourSpotlight wrapper (desktop)"
```

---

### Task 4: TourBottomSheet (mobile variant)

**Files:**

- Create: `packages/frontend/app/tour/components/TourBottomSheet.tsx`

- [ ] **Step 1: Implement bottom sheet**

```tsx
// packages/frontend/app/tour/components/TourBottomSheet.tsx
"use client";

import { useEffect, useState } from "react";

interface Props {
  title: string;
  body: string;
  progress: number;
  onContinue: () => void;
  onDismiss: () => void;
  targetSelector: string;
}

export function TourBottomSheet({
  title,
  body,
  progress,
  onContinue,
  onDismiss,
  targetSelector,
}: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 80);
    const el =
      typeof document !== "undefined"
        ? document.querySelector(targetSelector)
        : null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => clearTimeout(t);
  }, [targetSelector]);

  return (
    <>
      {/* Dim layer; lets the spotlit element receive a soft glow without an SVG mask */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[1px]"
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-bs-title"
        className={[
          "fixed inset-x-0 bottom-0 z-[9999] rounded-t-3xl bg-surface-container-high p-5 pb-7 shadow-[0_-12px_32px_rgba(0,0,0,0.18)]",
          "transition-transform duration-300 ease-out",
          show ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div
          className="mx-auto mb-4 h-1 w-12 rounded-full bg-outline-variant"
          aria-hidden="true"
        />
        <h3
          id="tour-bs-title"
          className="text-base font-semibold text-on-surface"
        >
          {title}
        </h3>
        <p className="mt-1.5 text-sm text-on-surface-variant">{body}</p>

        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-outline-variant/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-[#00C853] transition-all duration-400"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-on-surface-variant/70"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary"
          >
            Continue →
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/TourBottomSheet.tsx
git commit -m "feat(tour): add TourBottomSheet mobile variant"
```

---

### Task 5: /tour redirects to /map when phase=step1

**Files:**

- Modify: `packages/frontend/app/tour/page.tsx`

- [ ] **Step 1: Update phase handler**

Replace the placeholder switch case for `step1` in `app/tour/page.tsx` with a redirect-effect:

```tsx
// Inside TourPhaseSwitch:
case 'step1': {
  // The tour body renders on /map. Redirect there with the tour params attached.
  // This component is client-only so we use router.replace in an effect.
  return <RedirectToStep step="step1" route="/map" />;
}
```

Add the helper component above:

```tsx
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTour } from "./TourStateProvider";

function RedirectToStep({ step, route }: { step: "step1"; route: string }) {
  const router = useRouter();
  const { session } = useTour();
  useEffect(() => {
    if (!session.market || !session.persona) return;
    const params = new URLSearchParams();
    params.set("tour", step);
    params.set("persona", session.persona);
    params.set("market", `${session.market.geoLevel}-${session.market.geoId}`);
    params.set("sessionId", session.sessionId);
    router.replace(`${route}?${params}`);
  }, [router, step, route, session]);
  return (
    <div className="flex min-h-screen items-center justify-center text-on-surface-variant">
      Loading your market…
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/page.tsx
git commit -m "feat(tour): /tour phase=step1 redirects to /map?tour=step1"
```

---

### Task 6: Render TourSpotlight on /map for ?tour=step1

**Files:**

- Modify: `packages/frontend/app/map/page.tsx`

- [ ] **Step 1: Import and render**

Near the existing imports in `app/map/page.tsx`, add:

```tsx
import { TourSpotlight } from "@/app/tour/components/TourSpotlight";
```

Find the JSX root that wraps the page (after the early returns, inside the main `return`). Add the spotlight at the end of the wrapper, just before the closing tag:

```tsx
<TourSpotlight stepId="step1" />
```

The component renders `null` unless the URL contains `?tour=step1`, so it has zero impact when the user is using `/map` normally.

- [ ] **Step 2: Smoke test**

```bash
npm run dev:fresh
# Visit /tour, complete persona + market.
# Expected: redirect to /map?tour=step1&persona=...&market=cbsa-39580&sessionId=...
# Spotlight renders on the [data-tour="search-bar"] element.
# Click anywhere → URL updates to /market/<geoId>?tour=step2&...
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/map/page.tsx
git commit -m "feat(tour): render TourSpotlight step1 on /map"
```

---

### Task 7: Render TourSpotlight on /market/[id] for ?tour=step2

**Files:**

- Modify: `packages/frontend/app/market/[id]/page.tsx`

- [ ] **Step 1: Import and render**

Same pattern as Task 6 — import and place near end of root JSX:

```tsx
import { TourSpotlight } from "@/app/tour/components/TourSpotlight";
// ...
<TourSpotlight stepId="step2" />;
```

The existing `[data-tour="propertyiq-score"]` selector at `packages/frontend/app/market/[id]/components/ScoreColumn.tsx:30` is what gets spotlighted.

- [ ] **Step 2: Smoke test**

Walk through /tour → step1 → click search bar → arrive at /market/[id]?tour=step2.
Expected: Spotlight on the score card. Click → URL goes to `/compare/markets?tour=step3&...`.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/market/[id]/page.tsx
git commit -m "feat(tour): render TourSpotlight step2 on /market/[id]"
```

---

### Task 8: New /compare/markets route with auto-suggested peer

**Files:**

- Create: `packages/frontend/app/compare/markets/page.tsx`
- Create: `packages/frontend/app/compare/markets/MarketComparisonView.tsx`

- [ ] **Step 1: Add a peers fetcher to @/lib/data**

In `packages/frontend/lib/data/fetchers/markets.ts`, add:

```typescript
import { API_URL } from "./base";

export interface PeerCandidate {
  geoLevel: "metro" | "county" | "city" | "zip";
  geoId: string;
  name: string;
  score: number;
  householdCount: number;
}

export interface PeersResponse {
  source: { geoLevel: string; geoId: string; name: string; score: number };
  peers: PeerCandidate[];
}

export async function fetchPeers(
  geoLevel: string,
  geoId: string,
): Promise<PeersResponse> {
  const res = await fetch(`${API_URL}/api/markets/peers/${geoLevel}/${geoId}`);
  if (!res.ok) throw new Error(`Peers fetch failed: ${res.status}`);
  return res.json();
}
```

Re-export from `lib/data/fetchers/index.ts` and `lib/data/index.ts`.

- [ ] **Step 2: Implement the comparison page**

```tsx
// packages/frontend/app/compare/markets/page.tsx
"use client";

import { Suspense } from "react";
import { MarketComparisonView } from "./MarketComparisonView";

export default function CompareMarketsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading comparison…
        </div>
      }
    >
      <MarketComparisonView />
    </Suspense>
  );
}
```

```tsx
// packages/frontend/app/compare/markets/MarketComparisonView.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  fetchPeers,
  useScoreData,
  useDataCard,
  type PeerCandidate,
} from "@/lib/data";
import { TourSpotlight } from "@/app/tour/components/TourSpotlight";

function parseMarket(
  raw: string | null,
): { geoLevel: string; geoId: string } | null {
  if (!raw) return null;
  const m = raw.match(/^([a-z]+)-(.+)$/);
  return m ? { geoLevel: m[1], geoId: m[2] } : null;
}

export function MarketComparisonView() {
  const sp = useSearchParams();
  const a = parseMarket(sp?.get("a") ?? sp?.get("market") ?? null);
  const [peer, setPeer] = useState<PeerCandidate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!a) {
      setLoading(false);
      return;
    }
    fetchPeers(a.geoLevel, a.geoId)
      .then((res) => setPeer(res.peers[0] ?? null))
      .catch(() => setPeer(null))
      .finally(() => setLoading(false));
  }, [a]);

  if (!a)
    return (
      <div className="p-8 text-center text-on-surface-variant">
        Pick a market first.
      </div>
    );
  if (loading)
    return (
      <div className="p-8 text-center text-on-surface-variant">
        Finding closest peer…
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-on-surface">
          How your market stacks up
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Side-by-side against the closest peer market we could find.
        </p>
      </header>

      <div
        data-tour="compare-grid"
        className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr]"
      >
        <ComparisonSide geoLevel={a.geoLevel} geoId={a.geoId} winner />
        <div className="flex items-center justify-center text-sm font-semibold text-on-surface-variant">
          VS
        </div>
        {peer ? (
          <ComparisonSide geoLevel={peer.geoLevel} geoId={peer.geoId} />
        ) : (
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5 text-center text-sm text-on-surface-variant">
            No peer market available — your market is one-of-a-kind!
          </div>
        )}
      </div>

      <TourSpotlight stepId="step3" />
    </div>
  );
}

function ComparisonSide({
  geoLevel,
  geoId,
  winner,
}: {
  geoLevel: string;
  geoId: string;
  winner?: boolean;
}) {
  const { data: score } = useScoreData(geoLevel, geoId);
  const price = useDataCard("home_value", geoLevel, geoId);
  const dom = useDataCard("dom_median", geoLevel, geoId);
  const trend = useDataCard("zhvi_yoy", geoLevel, geoId);

  return (
    <div
      className={[
        "rounded-2xl border p-5",
        winner
          ? "border-[#00C853] bg-gradient-to-b from-white to-[#f0fff4]"
          : "border-outline-variant bg-white",
      ].join(" ")}
    >
      <p className="text-sm font-semibold text-on-surface">
        {score?.geoName ?? `${geoLevel}/${geoId}`}
      </p>
      <p className="text-xs text-on-surface-variant">
        PropertyIQ {score?.score ?? "—"} · {score?.label ?? "—"}
      </p>
      <dl className="mt-3 space-y-1.5 text-xs">
        <Stat label="Median price" value={price.formattedValue} />
        <Stat label="12-mo trend" value={trend.formattedValue} />
        <Stat label="Days on market" value={dom.formattedValue} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between border-b border-outline-variant/30 py-1 last:border-b-0">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="font-mono font-semibold text-on-surface">
        {value ?? "—"}
      </dd>
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

Walk through tour: persona → market → step1 → step2 → step3.
Expected: lands on `/compare/markets?tour=step3&...`. Comparison grid renders with two cards. Spotlight on the grid. Continue advances to `/tour?phase=step4`.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/compare/markets/ \
  packages/frontend/lib/data/fetchers/markets.ts \
  packages/frontend/lib/data/fetchers/index.ts \
  packages/frontend/lib/data/index.ts
git commit -m "feat(tour): add /compare/markets route with auto-suggested peer + step3 spotlight"
```

---

### Task 9: Manual end-to-end smoke walk

- [ ] **Step 1: Restart dev**

```bash
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
npm run dev:fresh
```

- [ ] **Step 2: Walk the full path on desktop**

1. Open `http://localhost:3000/tour`
2. Click "Continue as agent"
3. Type "Cary" — pick the result
4. Should redirect to `/map?tour=step1&...` with spotlight on search bar
5. Click anywhere → `/market/<geoId>?tour=step2&...` with spotlight on score card
6. Click anywhere → `/compare/markets?tour=step3&...` with spotlight on the comparison grid
7. Click Continue → `/tour?phase=step4` (Phase 04 placeholder; the listing presentation lands here)

- [ ] **Step 3: Walk the same path on mobile viewport**

Open Chrome DevTools, toggle mobile (≤768px width). Walk steps 1-3 again. Verify the bottom-sheet renders instead of the floating tooltip.

- [ ] **Step 4: Commit any tweaks**

```bash
git add ...
git commit -m "fix(tour): <observation>"
```

---

## Acceptance criteria for Phase 03 done

- [ ] Step 1 spotlight renders on `/map` when URL has `?tour=step1`.
- [ ] Step 2 spotlight renders on `/market/[id]` when URL has `?tour=step2`.
- [ ] Step 3 spotlight renders on `/compare/markets` with the auto-suggested peer.
- [ ] Click on the spotlit element OR the Continue button advances.
- [ ] Mobile (≤768px) renders the bottom sheet variant; desktop renders the floating tooltip.
- [ ] Step 3 Continue advances to `/tour?phase=step4` (Phase 04 placeholder).
- [ ] All Phase 03 vitest specs pass.
- [ ] No new TypeScript errors in changed files.
- [ ] No new console errors during a full tour walk-through.
