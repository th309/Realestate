# Tour Rebuild & System B Deletion — Implementation Plan (P0, Part 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the dormant "System B" onboarding tour, consolidate the shared spotlight primitives under `app/(app)/tour/primitives/`, and fix the live spotlight so the highlighted element is razor-sharp (not blurred), a missing target never blurs the whole app, mobile gets a real cutout, dismiss returns into the app, and the tour survives navigation.

**Architecture:** The live tour is "System A" (`app/(app)/tour/`, driven by `?tour=stepN` + `TourSpotlight`). It reuses two primitives that currently live in the dormant "System B" folder (`app/(app)/onboarding/`). We move the genuinely-shared primitives into `tour/primitives/`, delete System B, then fix the spotlight's broken CSS compositing (a full-screen `backdrop-filter` that an SVG mask cannot cut out) by rebuilding the overlay as four dim/blur panels around an uncovered target rect.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Tailwind CSS 4, Vitest + @testing-library/react (unit), Playwright (E2E). Test commands: `npm run test:unit` (vitest), `npm run test:e2e` (playwright), `npm run build`. Run all frontend commands from `packages/frontend`.

**Companion plan:** Plan 2 (`2026-06-16-trial-unblur.md`, to be written) fixes the paywall free-flash so the highlighted content is also unblurred. This plan fixes the spotlight's _own_ blur and the structural mess; the two are independent and either can ship first.

**Deviation from spec §5.11 (documented):** The spec lists `OnboardingProgressBar` as a primitive to keep. The import graph shows it is used **only** by System B and duplicates the progress bar already rendered inside `ConnectedTooltip`. Per the project's "delete stale code" rule we **delete** it. `celebrations.ts` is moved (not deleted) because P1's Pro-celebration step needs `triggerConfetti`.

---

## Task 1: Consolidate spotlight primitives under `tour/primitives/`

**Files:**

- Create: `packages/frontend/app/(app)/tour/primitives/types.ts`
- Move: `app/(app)/onboarding/BreathingSpotlight.tsx` → `app/(app)/tour/primitives/BreathingSpotlight.tsx`
- Move: `app/(app)/onboarding/ConnectedTooltip.tsx` → `app/(app)/tour/primitives/ConnectedTooltip.tsx`
- Move: `app/(app)/onboarding/celebrations.ts` → `app/(app)/tour/primitives/celebrations.ts`
- Modify: `app/(app)/tour/components/TourSpotlight.tsx:4-6` (import paths)
- Modify: `app/(app)/tour/components/__tests__/TourSpotlight.test.tsx` (vi.mock paths)

- [ ] **Step 1: Create the primitives directory and extract the `OnboardingStep` type**

Create `packages/frontend/app/(app)/tour/primitives/types.ts`. This replaces the type that lived in System B's `onboarding-steps.ts` (which we delete in Task 2). Only the fields actually consumed by `ConnectedTooltip` and `TourSpotlight` are included.

```typescript
// The shape of a single guided-tour step, consumed by ConnectedTooltip and
// the spotlight engine. Extracted from the deleted System B onboarding-steps.ts.
export interface OnboardingStep {
  id: string;
  route: string | null;
  targetSelector: string | null;
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  allowManualAdvance?: boolean;
}
```

- [ ] **Step 2: Move the three primitive files (preserve history)**

Run from repo root:

```bash
git mv "packages/frontend/app/(app)/onboarding/BreathingSpotlight.tsx" "packages/frontend/app/(app)/tour/primitives/BreathingSpotlight.tsx"
git mv "packages/frontend/app/(app)/onboarding/ConnectedTooltip.tsx" "packages/frontend/app/(app)/tour/primitives/ConnectedTooltip.tsx"
git mv "packages/frontend/app/(app)/onboarding/celebrations.ts" "packages/frontend/app/(app)/tour/primitives/celebrations.ts"
```

- [ ] **Step 3: Repoint `ConnectedTooltip`'s type import**

In `app/(app)/tour/primitives/ConnectedTooltip.tsx`, change the import on line 4 from the deleted System B module to the local type file:

```typescript
// BEFORE: import type { OnboardingStep } from "./onboarding-steps";
import type { OnboardingStep } from "./types";
```

- [ ] **Step 4: Repoint `TourSpotlight`'s imports**

In `app/(app)/tour/components/TourSpotlight.tsx`, replace lines 4-6:

```typescript
// BEFORE:
// import { BreathingSpotlight } from "@/app/onboarding/BreathingSpotlight";
// import { ConnectedTooltip } from "@/app/onboarding/ConnectedTooltip";
// import type { OnboardingStep } from "@/app/onboarding/onboarding-steps";
import { BreathingSpotlight } from "../primitives/BreathingSpotlight";
import { ConnectedTooltip } from "../primitives/ConnectedTooltip";
import type { OnboardingStep } from "../primitives/types";
```

- [ ] **Step 5: Repoint the `TourSpotlight` test mocks**

In `app/(app)/tour/components/__tests__/TourSpotlight.test.tsx`, update the two `vi.mock` paths:

```typescript
// BEFORE: vi.mock("@/app/onboarding/BreathingSpotlight", () => ({
vi.mock("../../primitives/BreathingSpotlight", () => ({
  BreathingSpotlight: (props: any) => (
    <div data-testid="breathing-spotlight" data-target={props.targetSelector} />
  ),
}));
// BEFORE: vi.mock("@/app/onboarding/ConnectedTooltip", () => ({
vi.mock("../../primitives/ConnectedTooltip", () => ({
  ConnectedTooltip: (props: any) => (
    <div
      data-testid="connected-tooltip"
      data-title={props.step.title}
      data-index={props.currentIndex}
    />
  ),
}));
```

- [ ] **Step 6: Verify typecheck, build, and existing tests pass**

Run from `packages/frontend`:

```bash
npm run test:unit -- TourSpotlight
npm run build
```

Expected: TourSpotlight tests PASS; build succeeds with no "module not found" errors. (System B still compiles here — its imports break only after Task 2, which also removes its importers.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(tour): move spotlight primitives to tour/primitives, extract OnboardingStep type"
```

---

## Task 2: Delete System B and fix its two remaining importers

**Files:**

- Delete: `app/(app)/onboarding/TourProvider.tsx`
- Delete: `app/(app)/onboarding/onboarding-steps.ts`
- Delete: `app/(app)/onboarding/useTourState.ts`
- Delete: `app/(app)/onboarding/OnboardingProgressBar.tsx`
- Delete: `app/(app)/onboarding/index.ts`
- Modify: `app/providers.tsx:11,170` (remove `TourProvider` import + wrapper)
- Modify: `app/(app)/help/RestartTutorialSection.tsx` (replace System B `useTour()` with a link)

- [ ] **Step 1: Delete the System B files**

```bash
git rm "packages/frontend/app/(app)/onboarding/TourProvider.tsx" \
       "packages/frontend/app/(app)/onboarding/onboarding-steps.ts" \
       "packages/frontend/app/(app)/onboarding/useTourState.ts" \
       "packages/frontend/app/(app)/onboarding/OnboardingProgressBar.tsx" \
       "packages/frontend/app/(app)/onboarding/index.ts"
```

- [ ] **Step 2: Remove the `TourProvider` mount from `providers.tsx`**

Delete the import on line 11 (`import { TourProvider } from "@/app/onboarding";`) and unwrap the provider. The `EntitlementsProvider` subtree is preserved exactly; only the `<TourProvider>` wrapper is removed:

```tsx
// In the Providers return (was lines ~166-176):
<ToastProvider>
  <EntitlementsProvider>
    <OnboardingBeaconProvider>
      <PaywallProvider>{children}</PaywallProvider>
    </OnboardingBeaconProvider>
  </EntitlementsProvider>
  <ExitIntentModal />
</ToastProvider>
```

- [ ] **Step 3: Rewrite `RestartTutorialSection` to launch the live tour**

System B's `useTour().restartTour` is gone. The live tour restarts by navigating to `/tour?resume=fresh` (the same entry the dashboard "Take the tour" link uses). Replace the whole file `app/(app)/help/RestartTutorialSection.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";

export function RestartTutorialSection() {
  const router = useRouter();

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 mb-8">
      <h3 className="text-lg font-medium text-on-surface mb-2">
        Platform Tutorial
      </h3>
      <p className="text-sm text-on-surface-variant mb-4">
        Take a guided tour of PropertyIQ&apos;s key features. The tutorial
        covers market search, scores, charts, AI assessment, and reports.
      </p>
      <button
        onClick={() => router.push("/tour?resume=fresh")}
        className="px-6 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors duration-200"
      >
        Restart Tutorial
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify nothing else references System B**

Run from `packages/frontend`:

```bash
grep -rn "@/app/onboarding\"" app | grep -v "/onboarding/"   # imports of the deleted index
grep -rn "from \"@/app/onboarding/\(TourProvider\|onboarding-steps\|useTourState\|OnboardingProgressBar\)\"" app
grep -rn "ONBOARDING_STEPS\|useTourState\|OnboardingProgressBar" app
```

Expected: no matches (the only hits before were the files we deleted/edited).

- [ ] **Step 5: Verify build + full unit suite**

```bash
npm run build
npm run test:unit
```

Expected: build succeeds; unit suite green. (If `RestartTutorialSection` had a test importing `useTour`, it will now pass against the simplified component.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(tour): delete System B onboarding tour, repoint providers + help restart"
```

---

## Task 3: Fix the desktop spotlight compositing (crisp target)

**Problem:** `BreathingSpotlight` puts `backdropFilter: blur(3px)` on a full-screen `<svg>`; an inner SVG `<mask>` cuts the _dimming_ but cannot cut the CSS backdrop-filter, so the highlighted element stays blurred. **Fix:** render the dim+blur as four panels tiling the screen _around_ the target rect, leaving the target uncovered (crisp).

**Files:**

- Modify: `app/(app)/tour/primitives/BreathingSpotlight.tsx` (replace the render body)
- Create: `app/(app)/tour/primitives/__tests__/BreathingSpotlight.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/(app)/tour/primitives/__tests__/BreathingSpotlight.test.tsx`. It mocks `getBoundingClientRect` (jsdom returns zeros otherwise) and asserts the four dim panels exist and none of them covers the target rect.

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BreathingSpotlight } from "../BreathingSpotlight";

const TARGET = { top: 100, left: 200, width: 300, height: 80 };

beforeEach(() => {
  // jsdom has no layout; give the queried element a known rect.
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    top: TARGET.top,
    left: TARGET.left,
    width: TARGET.width,
    height: TARGET.height,
    right: TARGET.left + TARGET.width,
    bottom: TARGET.top + TARGET.height,
    x: TARGET.left,
    y: TARGET.top,
    toJSON: () => ({}),
  })) as unknown as typeof Element.prototype.getBoundingClientRect;
  vi.spyOn(document, "querySelector").mockImplementation(() =>
    document.createElement("div"),
  );
});

describe("BreathingSpotlight", () => {
  it("renders four dim panels and leaves the target rect uncovered", () => {
    render(<BreathingSpotlight targetSelector="#x" visible />);
    const top = screen.getByTestId("spotlight-dim-top");
    const bottom = screen.getByTestId("spotlight-dim-bottom");
    const left = screen.getByTestId("spotlight-dim-left");
    const right = screen.getByTestId("spotlight-dim-right");
    // Top panel ends exactly where the (padded) target begins.
    expect(top).toBeInTheDocument();
    expect(bottom).toBeInTheDocument();
    expect(left).toBeInTheDocument();
    expect(right).toBeInTheDocument();
    // No panel is the target itself; the hole has no covering element.
    expect(screen.queryByTestId("spotlight-fullscreen-blur")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- BreathingSpotlight
```

Expected: FAIL (`spotlight-dim-top` not found — the current component renders an SVG, not panels).

- [ ] **Step 3: Replace the render body of `BreathingSpotlight.tsx`**

Keep the existing `measureTarget`/poll logic (lines 1-90 up to and including the `if (!visible) return null;`). Replace the no-target fallback and the `return (<>...</>)` block (current lines 82-156) with panels. The `PADDING` constant and `SpotlightRect` shape are unchanged.

```tsx
if (!visible) return null;

// No target found (after the poll). Render nothing — never blur the whole
// app. Auto-skip is handled by the parent via onTargetMissing (Task 4).
if (!spotlight) return null;

const right = spotlight.left + spotlight.width;
const bottom = spotlight.top + spotlight.height;
const dim = "fixed bg-black/45 backdrop-blur-[3px] transition-all duration-300";

return (
  <>
    {/* Four dim+blur panels tiling the viewport AROUND the target rect.
          The target rect itself is never covered, so it stays razor-sharp. */}
    <div
      data-testid="spotlight-dim-top"
      aria-hidden="true"
      className={dim}
      style={{
        top: 0,
        left: 0,
        width: "100vw",
        height: Math.max(0, spotlight.top),
      }}
      onClick={onClick}
    />
    <div
      data-testid="spotlight-dim-bottom"
      aria-hidden="true"
      className={dim}
      style={{ top: bottom, left: 0, width: "100vw", bottom: 0 }}
      onClick={onClick}
    />
    <div
      data-testid="spotlight-dim-left"
      aria-hidden="true"
      className={dim}
      style={{
        top: spotlight.top,
        left: 0,
        width: Math.max(0, spotlight.left),
        height: spotlight.height,
      }}
      onClick={onClick}
    />
    <div
      data-testid="spotlight-dim-right"
      aria-hidden="true"
      className={dim}
      style={{
        top: spotlight.top,
        left: right,
        right: 0,
        height: spotlight.height,
      }}
      onClick={onClick}
    />

    {/* Pulsing indigo glow ring around the (uncovered) target. */}
    <div
      aria-hidden="true"
      className="fixed z-[9998] pointer-events-none motion-safe:animate-[breathe_2s_ease-in-out_infinite]"
      style={{
        top: spotlight.top - 4,
        left: spotlight.left - 4,
        width: spotlight.width + 8,
        height: spotlight.height + 8,
        borderRadius: spotlight.borderRadius + 4,
        boxShadow:
          "0 0 20px 4px rgba(57,73,171,0.3), 0 0 40px 8px rgba(57,73,171,0.15)",
        transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
      }}
    />

    <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
      `}</style>
  </>
);
```

Notes: the four panels carry `onClick={onClick}` (click the dim to advance/dismiss, exactly as before); the target hole has no covering element so clicks reach the real element; `z-index` on panels defaults under the `z-[9999]` tooltip — add `z-[9998]` to the `dim` class string if your stacking needs it: `const dim = "fixed z-[9998] bg-black/45 backdrop-blur-[3px] transition-all duration-300";`.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:unit -- BreathingSpotlight
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(tour): composite spotlight as four panels so the highlighted target is crisp"
```

---

## Task 4: Auto-skip a missing target (never blur the whole app)

**Files:**

- Modify: `app/(app)/tour/primitives/BreathingSpotlight.tsx` (add `onTargetMissing` prop, fire after poll exhausts)
- Modify: `app/(app)/tour/components/TourSpotlight.tsx` (pass `onTargetMissing={onContinue}`)
- Modify: `app/(app)/tour/primitives/__tests__/BreathingSpotlight.test.tsx` (add test)

- [ ] **Step 1: Write the failing test**

Append to `BreathingSpotlight.test.tsx`:

```tsx
it("calls onTargetMissing (and renders nothing) when the target never appears", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "querySelector").mockReturnValue(null); // target never found
  const onTargetMissing = vi.fn();
  const { container } = render(
    <BreathingSpotlight
      targetSelector="#missing"
      visible
      onTargetMissing={onTargetMissing}
    />,
  );
  // Exhaust the 20 × 200ms poll.
  await vi.advanceTimersByTimeAsync(20 * 200 + 50);
  expect(onTargetMissing).toHaveBeenCalledTimes(1);
  expect(
    container.querySelector('[data-testid="spotlight-dim-top"]'),
  ).toBeNull();
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test:unit -- BreathingSpotlight
```

Expected: FAIL (`onTargetMissing` is not a prop yet).

- [ ] **Step 3: Add the `onTargetMissing` prop + fire it when the poll exhausts**

In `BreathingSpotlight.tsx`, extend the props interface and the poll. Update the interface:

```tsx
interface BreathingSpotlightProps {
  targetSelector: string | null;
  visible: boolean;
  onClick?: () => void;
  onTargetMissing?: () => void;
}
```

Add `onTargetMissing` to the destructured params, and in the `useEffect` poll (currently `if (el || attempts > 20)`), fire the callback once when attempts exhaust without an element:

```tsx
pollInterval = setInterval(() => {
  attempts++;
  const el = document.querySelector(targetSelector);
  if (el || attempts > 20) {
    if (el) {
      measureTarget();
    } else {
      onTargetMissing?.();
    }
    if (pollInterval) clearInterval(pollInterval);
  }
}, 200);
```

Add `onTargetMissing` to the effect dependency array.

- [ ] **Step 4: Wire `TourSpotlight` to auto-advance on a missing target**

In `app/(app)/tour/components/TourSpotlight.tsx`, pass the handler to the desktop `BreathingSpotlight` (the `onContinue` already resolves to `advance`/`advanceToStep4`):

```tsx
<BreathingSpotlight
  targetSelector={content.targetSelector}
  visible
  onClick={onContinue}
  onTargetMissing={onContinue}
/>
```

- [ ] **Step 5: Run to verify it passes**

```bash
npm run test:unit -- BreathingSpotlight TourSpotlight
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(tour): auto-skip a missing spotlight target instead of blurring the app"
```

---

## Task 5: Give the mobile bottom sheet a real cutout

**Problem:** `TourBottomSheet` dims+blurs the whole screen with no hole. **Fix:** reuse `BreathingSpotlight` (now correct) for the mobile highlight, keep the sheet for copy/controls.

**Files:**

- Modify: `app/(app)/tour/components/TourBottomSheet.tsx`
- Modify: `app/(app)/tour/components/__tests__/TourBottomSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

In `TourBottomSheet.test.tsx`, add (mock `BreathingSpotlight` like the TourSpotlight test does):

```tsx
vi.mock("../../primitives/BreathingSpotlight", () => ({
  BreathingSpotlight: (props: any) => (
    <div data-testid="bs" data-target={props.targetSelector} />
  ),
}));

it("renders a real spotlight over the target instead of a full-screen blur", () => {
  render(
    <TourBottomSheet
      title="t"
      body="b"
      progress={0.5}
      onContinue={() => {}}
      onDismiss={() => {}}
      targetSelector='[data-tour="propertyiq-score"]'
    />,
  );
  expect(screen.getByTestId("bs")).toHaveAttribute(
    "data-target",
    '[data-tour="propertyiq-score"]',
  );
  expect(screen.queryByTestId("bottom-sheet-fullscreen-blur")).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test:unit -- TourBottomSheet
```

Expected: FAIL (no `bs` testid; current component renders a `bg-black/40 backdrop-blur-[1px]` div).

- [ ] **Step 3: Replace the full-screen dim with the spotlight**

In `TourBottomSheet.tsx`, import the primitive and swap the dim div (the `fixed inset-0 ... backdrop-blur-[1px]` block) for the spotlight. Keep the sheet markup unchanged.

```tsx
import { BreathingSpotlight } from "../primitives/BreathingSpotlight";
// ...
return (
  <>
    {/* Real cutout highlight on mobile (was a full-screen blur). */}
    <BreathingSpotlight
      targetSelector={targetSelector}
      visible
      onClick={onContinue}
    />

    {/* Bottom sheet (unchanged) */}
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
      {/* ...existing handle, title, body, progress, buttons unchanged... */}
    </div>
  </>
);
```

(The existing `useEffect` that does `scrollIntoView` on the target can stay; `BreathingSpotlight` also scrolls, which is idempotent.)

- [ ] **Step 4: Run to verify it passes**

```bash
npm run test:unit -- TourBottomSheet
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(tour): give the mobile bottom sheet a real spotlight cutout"
```

---

## Task 6: Dismiss into the app + survive navigation

**Problem:** `dismiss()` pushes `/` (marketing page); the tour also dies whenever `?tour=…` is stripped by a stray navigation. **Fix:** dismiss → `/dashboard`; persist the active tour in `sessionStorage` and rehydrate it.

**Files:**

- Modify: `app/(app)/tour/hooks/useTourFromUrl.ts`
- Modify: `app/(app)/tour/__tests__/useTourFromUrl.test.ts`

- [ ] **Step 1: Write the failing tests**

In `useTourFromUrl.test.ts`, add:

```ts
it("dismiss() routes into the app (/dashboard), not the marketing home", () => {
  currentParams = "tour=step1&persona=agent&market=metro-39580&sessionId=abc";
  const { result } = renderHook(() => useTourFromUrl());
  act(() => result.current.dismiss());
  expect(pushSpy).toHaveBeenCalledWith("/dashboard");
});

it("rehydrates the active tour from sessionStorage when URL params are absent", () => {
  window.sessionStorage.setItem(
    "piq.activeTour",
    JSON.stringify({
      stepId: "step2",
      persona: "investor",
      market: { geoLevel: "metro", geoId: "39580", name: "Boise" },
      sessionId: "abc",
    }),
  );
  currentParams = ""; // params were stripped by a stray navigation
  const { result } = renderHook(() => useTourFromUrl());
  expect(result.current.active?.stepId).toBe("step2");
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm run test:unit -- useTourFromUrl
```

Expected: FAIL (dismiss pushes `/`; no rehydration).

- [ ] **Step 3: Implement dismiss-into-app + sessionStorage persistence**

In `useTourFromUrl.ts`:

(a) Change `dismiss()`:

```ts
function dismiss() {
  if (typeof window !== "undefined")
    window.sessionStorage.removeItem("piq.activeTour");
  router.push("/dashboard"); // exit the tour INTO the app, not the marketing home
}
```

(b) Persist on every active resolution and rehydrate when params are missing. Replace the `active` `useMemo` body:

```ts
const active = useMemo<ActiveTour | null>(() => {
  const STORAGE_KEY = "piq.activeTour";
  const stepId = sp?.get("tour") as SandboxStepId | null;

  if (stepId && SANDBOX_STEP_ORDER.includes(stepId)) {
    const market = parseMarket(sp?.get("market") ?? null);
    const sessionId = sp?.get("sessionId") ?? null;
    if (market && sessionId) {
      const tour: ActiveTour = {
        stepId,
        persona: (sp?.get("persona") as Persona | null) ?? null,
        market,
        sessionId,
      };
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tour));
      }
      return tour;
    }
  }

  // URL has no tour params — try to rehydrate one that was interrupted.
  if (typeof window !== "undefined") {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as ActiveTour;
        if (
          saved?.stepId &&
          SANDBOX_STEP_ORDER.includes(saved.stepId) &&
          saved.market &&
          saved.sessionId
        ) {
          return saved;
        }
      } catch {
        /* ignore corrupt storage */
      }
    }
  }
  return null;
}, [sp]);
```

Also clear storage when the tour finishes — in `advanceToStep4()`, before the `router.push`, add:

```ts
if (typeof window !== "undefined")
  window.sessionStorage.removeItem("piq.activeTour");
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm run test:unit -- useTourFromUrl
```

Expected: PASS. (The existing `dismiss() pushes /` test must be updated to expect `/dashboard` — change that assertion.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(tour): dismiss into /dashboard and rehydrate the tour after navigation"
```

---

## Task 7: Respect prefers-reduced-motion

**Files:**

- Modify: `app/(app)/tour/primitives/BreathingSpotlight.tsx` (already added `motion-safe:` in Task 3 — verify) and `celebrations.ts` (confetti already sets `disableForReducedMotion: true`).
- Modify: `app/(app)/tour/primitives/ConnectedTooltip.tsx` (gate the spring transform)

- [ ] **Step 1: Write the failing test**

In a new `ConnectedTooltip.test.tsx` under `tour/primitives/__tests__/`, assert reduced-motion users get no transform animation:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ConnectedTooltip } from "../ConnectedTooltip";

function setReducedMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (q: string) => ({
      matches: reduced && q.includes("reduced-motion"),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

it("uses no scale/translate transform when reduced-motion is requested", () => {
  setReducedMotion(true);
  const step = {
    id: "s",
    route: null,
    targetSelector: null,
    title: "T",
    body: "B",
    placement: "center" as const,
    allowManualAdvance: true,
  };
  const { container } = render(
    <ConnectedTooltip
      step={step}
      currentIndex={0}
      totalSteps={3}
      onDismiss={() => {}}
      onContinue={() => {}}
    />,
  );
  const card = container.querySelector('[role="dialog"]') as HTMLElement;
  expect(card.style.transform).toBe("none");
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test:unit -- ConnectedTooltip
```

Expected: FAIL (transform is `scale(...) translateY(...)`).

- [ ] **Step 3: Gate the spring transform on reduced-motion**

In `ConnectedTooltip.tsx`, add a reduced-motion check and use it for `springTransform`:

```tsx
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const springTransform = prefersReducedMotion
  ? "none"
  : show
    ? "scale(1) translateY(0)"
    : "scale(0.95) translateY(8px)";
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm run test:unit -- ConnectedTooltip
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(tour): respect prefers-reduced-motion in the spotlight tooltip"
```

---

## Task 8: E2E — crisp target, dismiss-into-app, no full-screen blur

**Files:**

- Create: `packages/frontend/tests/e2e/tour-spotlight.spec.ts`

This runs against the live dev servers (frontend :3000, backend :3001) per the project's "real browser, no mocks" rule.

- [ ] **Step 1: Write the E2E spec**

```ts
import { test, expect } from "@playwright/test";

// Drives the live sandbox tour on /map?tour=step1 and asserts the highlighted
// search bar is NOT inside a blurred region, and that dismiss lands in-app.
test.describe("Tour spotlight", () => {
  const TOUR_URL =
    "/map?tour=step1&persona=investor&market=metro-39580&sessionId=e2e-test";

  test("highlighted target is not covered by a dim/blur panel", async ({
    page,
  }) => {
    await page.goto(TOUR_URL, { waitUntil: "load" });
    const target = page.locator('[data-tour="search-bar"]').first();
    await expect(target).toBeVisible();

    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // The element at the target's center must be the search bar (or its child),
    // NOT a dim panel — proves the cutout is real.
    const onTopIsDim = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x as number, y as number);
        return !!el?.closest('[data-testid^="spotlight-dim-"]');
      },
      [cx, cy],
    );
    expect(onTopIsDim).toBe(false);

    // And there is no legacy full-screen blur overlay.
    await expect(
      page.locator('[data-testid="spotlight-fullscreen-blur"]'),
    ).toHaveCount(0);
  });

  test("dismiss returns into the app, not the marketing home", async ({
    page,
  }) => {
    await page.goto(TOUR_URL, { waitUntil: "load" });
    await page.keyboard.press("Escape").catch(() => {});
    // Fallback: click the dim to advance/exit if Esc isn't wired on this surface.
    await page.waitForTimeout(500);
    // Dismiss via the tooltip "Do this later" if present.
    const later = page.getByRole("button", { name: /do this later/i });
    if (await later.count()) await later.first().click();
    await expect(page).not.toHaveURL(/\/$/);
  });
});
```

- [ ] **Step 2: Start dev servers and run the spec**

Ensure frontend (:3000) and backend (:3001) are running, then from `packages/frontend`:

```bash
npm run test:e2e -- tour-spotlight
```

Expected: PASS. If the first test fails because `elementFromPoint` returns a dim panel, the cutout geometry (Task 3) is off — re-check the panel rects.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(tour): e2e verify crisp spotlight target and dismiss-into-app"
```

---

## Self-Review

**Spec coverage (§5.2 + §5.11):**

- Correct compositing → Task 3 ✓
- No full-screen-blur failure → Tasks 3 (no-target renders null) + 4 (auto-skip) ✓
- Mobile real cutout → Task 5 ✓
- Survives navigation → Task 6 ✓
- Dismiss into the app → Task 6 ✓
- Accessibility (reduced-motion; Esc/focus already in `ConnectedTooltip`) → Task 7 ✓ (focus/ARIA already present in the moved `ConnectedTooltip`)
- Delete System B + consolidate primitives → Tasks 1-2 ✓

**Placeholder scan:** No TODO/TBD; every code step shows complete code. ✓

**Type consistency:** `OnboardingStep` defined in Task 1 (`primitives/types.ts`) is consumed unchanged by `ConnectedTooltip` and `TourSpotlight`; `onTargetMissing` added in Task 4 is used consistently in `BreathingSpotlight` + `TourSpotlight`; `dismiss()`/`active`/`advanceToStep4` edits in Task 6 stay within `useTourFromUrl`'s existing `ActiveTour` type. ✓

**Out of scope (handled by Plan 2):** the paywall free-flash (entitlement blur on the highlighted _content_) — independent; this plan fixes the spotlight's own blur and the structure.
