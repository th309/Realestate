# Activation Tour Redesign — Phase 06: Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the tour production-ready. Wire all edge cases from the spec, hit WCAG 2.1 keyboard + screen-reader compliance, instrument every funnel step for measurable conversion, add Playwright E2E + visual regression coverage, hit the performance budget (≤200KB unauth report, ≤8s p95 generation), and add the feature-flag wrapper for canary rollout.

**Architecture:** Telemetry uses the existing `trackEvent` from `@/lib/analytics/tracker` (used by the legacy tour). E2E tests live alongside the existing `tests/e2e/` Playwright suite. Visual regression uses Playwright's `toHaveScreenshot()` against 5 curated test markets. Feature flag is a simple env-driven gate at the `/tour` page level — no LaunchDarkly dependency. Sparse-data + slow-network + bot edge cases are tested at the integration level.

**Tech Stack:** Playwright (existing), `@axe-core/playwright` for a11y, vitest + RTL, the existing `trackEvent` analytics helper.

**Spec:** [../specs/2026-05-03-activation-tour-redesign-design.md](../specs/2026-05-03-activation-tour-redesign-design.md), §"Edge cases", §"Mobile design", §"Testing strategy", §"Feature-flag rollout".

**Depends on:** Phases 01-05 all merged. This phase touches almost every file from prior phases — use it AFTER they're stable.

---

## File structure

**New (frontend):**

- `packages/frontend/lib/analytics/tour-events.ts` — typed event helpers
- `packages/frontend/tests/e2e/tour-agent-flow.spec.ts` — full agent walk
- `packages/frontend/tests/e2e/tour-mobile.spec.ts` — mobile viewport variant
- `packages/frontend/tests/e2e/tour-rate-limit.spec.ts` — rate-limit branch
- `packages/frontend/tests/e2e/tour-sparse-data.spec.ts` — sparse-market path
- `packages/frontend/tests/e2e/tour-a11y.spec.ts` — axe scan + keyboard
- `packages/frontend/tests/e2e/visual-regression/listing-presentation.spec.ts` — 5 curated markets
- `packages/frontend/lib/feature-flags/tour-v2.ts` — flag helper

**Modify (frontend):**

- `packages/frontend/app/tour/page.tsx` — gate behind `tour_v2_enabled` flag
- `packages/frontend/app/tour/components/PersonaCards.tsx` — track `persona_selected`
- `packages/frontend/app/tour/components/MarketPickerStep.tsx` — track `market_selected`
- `packages/frontend/app/tour/components/TourSpotlight.tsx` — track `step_viewed` / `step_completed` / `step_dismissed`
- `packages/frontend/app/tour/components/Step4Aha.tsx` — track `report_generated` / `report_failed` / `rate_limit_hit`
- `packages/frontend/app/tour/components/InlineSignupForm.tsx` — track `signup_initiated` / `signup_completed` / `signup_dismissed`
- `packages/frontend/app/tour/components/PostSignupCelebrate.tsx` — track `tour_completed`

**Modify (backend):**

- `packages/backend/src/anonymous/listing-presentation.service.ts` — add per-section data freshness check + emit warnings for sparse markets
- `packages/backend/src/anonymous/anonymous.controller.ts` — log slow-generation events to backend analytics

---

### Task 1: Tour analytics helpers

**Files:**

- Create: `packages/frontend/lib/analytics/tour-events.ts`

- [ ] **Step 1: Implement typed event helpers**

```typescript
// packages/frontend/lib/analytics/tour-events.ts
import { trackEvent } from "./tracker";

type Persona = "agent" | "investor" | "homebuyer";

export const tourEvents = {
  started: (props: {
    source: "direct" | "seo" | "dashboard" | "callback";
    persona?: Persona | null;
    sessionId: string;
  }) => trackEvent("tour.started", props),

  personaSelected: (props: { persona: Persona; sessionId: string }) =>
    trackEvent("tour.persona_selected", props),

  marketSelected: (props: {
    persona: Persona;
    geoLevel: string;
    geoId: string;
    sessionId: string;
    viaHelperChip: boolean;
  }) => trackEvent("tour.market_selected", props),

  stepViewed: (props: {
    stepId: "step1" | "step2" | "step3";
    persona: Persona;
    sessionId: string;
  }) => trackEvent("tour.step_viewed", props),

  stepCompleted: (props: {
    stepId: "step1" | "step2" | "step3";
    persona: Persona;
    durationMs: number;
    sessionId: string;
  }) => trackEvent("tour.step_completed", props),

  stepDismissed: (props: { stepId: string; sessionId: string }) =>
    trackEvent("tour.step_dismissed", props),

  reportGenerationStarted: (props: {
    persona: Persona;
    geoLevel: string;
    geoId: string;
    sessionId: string;
  }) => trackEvent("tour.report_generation_started", props),

  reportGenerated: (props: {
    durationMs: number;
    sessionId: string;
    limitedSections: string[];
  }) => trackEvent("tour.report_generated", props),

  reportFailed: (props: {
    reason: string;
    durationMs: number;
    sessionId: string;
  }) => trackEvent("tour.report_failed", props),

  rateLimitHit: (props: { sessionId: string }) =>
    trackEvent("tour.rate_limit_hit", props),

  signupInitiated: (props: { sessionId: string }) =>
    trackEvent("tour.signup_initiated", props),

  signupCompleted: (props: {
    userId: string;
    sessionId: string;
    reportClaimed: boolean;
  }) => trackEvent("tour.signup_completed", props),

  signupDismissed: (props: { sessionId: string }) =>
    trackEvent("tour.signup_dismissed", props),

  tourCompleted: (props: {
    sessionId: string;
    userId: string;
    durationMs: number;
  }) => trackEvent("tour.completed", props),
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/lib/analytics/tour-events.ts
git commit -m "feat(tour): typed tour-events analytics helpers"
```

---

### Task 2: Wire telemetry into PersonaCards + MarketPickerStep

**Files:**

- Modify: `packages/frontend/app/tour/components/PersonaCards.tsx`
- Modify: `packages/frontend/app/tour/components/MarketPickerStep.tsx`
- Modify: `packages/frontend/app/tour/page.tsx` — fire `tour.started` on first render

- [ ] **Step 1: Fire `tour.started` once per session**

In `app/tour/page.tsx`, inside `TourPhaseSwitch`:

```tsx
import { useEffect, useRef } from "react";
import { tourEvents } from "@/lib/analytics/tour-events";

// inside TourPhaseSwitch:
const fired = useRef(false);
useEffect(() => {
  if (fired.current || !session.sessionId) return;
  fired.current = true;
  const sp = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const source =
    sp.get("from") === "seo"
      ? "seo"
      : sp.get("resume")
        ? "dashboard"
        : "direct";
  tourEvents.started({
    source,
    persona: session.persona,
    sessionId: session.sessionId,
  });
}, [session.sessionId, session.persona]);
```

- [ ] **Step 2: PersonaCards onSelect**

Modify the `setPersona` call inside `PersonaCard` onSelect handler (or wrap it in PersonaCards):

```tsx
// In PersonaCards.tsx, replace the onSelect={setPersona} with:
const onSelect = (p: Persona) => {
  tourEvents.personaSelected({ persona: p, sessionId: session.sessionId });
  setPersona(p);
};

// And use that onSelect instead of bare setPersona.
```

(Get `session` from `useTour()` at the top of PersonaCards.)

- [ ] **Step 3: MarketPickerStep — fire on suggestion select OR helper chip**

In `MarketPickerStep.tsx`, wrap the `setMarket` calls (both in `SuggestionRow.onSelect` and the helper chip handlers):

```tsx
const trackedSetMarket = (m: MarketRef, viaHelperChip: boolean) => {
  if (!session.persona) return;
  tourEvents.marketSelected({
    persona: session.persona,
    geoLevel: m.geoLevel,
    geoId: m.geoId,
    sessionId: session.sessionId,
    viaHelperChip,
  });
  setMarket(m);
};
```

Pass `viaHelperChip: false` when called from the suggestion list, `true` from the chips.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/tour/page.tsx \
  packages/frontend/app/tour/components/PersonaCards.tsx \
  packages/frontend/app/tour/components/MarketPickerStep.tsx
git commit -m "feat(tour): telemetry on tour-start, persona-select, market-select"
```

---

### Task 3: Telemetry for spotlight steps (1-3) + step 4

**Files:**

- Modify: `packages/frontend/app/tour/components/TourSpotlight.tsx`
- Modify: `packages/frontend/app/tour/components/Step4Aha.tsx`

- [ ] **Step 1: TourSpotlight emits step_viewed on mount, step_completed on advance**

```tsx
// Inside TourSpotlight, add:
import { useEffect, useRef } from "react";
import { tourEvents } from "@/lib/analytics/tour-events";

// Inside the component, after `if (!active || active.stepId !== stepId) return null;`:
const mountedAt = useRef(Date.now());
useEffect(() => {
  mountedAt.current = Date.now();
  if (active.persona) {
    tourEvents.stepViewed({
      stepId,
      persona: active.persona,
      sessionId: active.sessionId,
    });
  }
}, [stepId, active.persona, active.sessionId]);

const trackedAdvance = () => {
  if (active.persona) {
    tourEvents.stepCompleted({
      stepId,
      persona: active.persona,
      durationMs: Date.now() - mountedAt.current,
      sessionId: active.sessionId,
    });
  }
  if (isLast) advanceToStep4();
  else advance();
};

const trackedDismiss = () => {
  tourEvents.stepDismissed({ stepId, sessionId: active.sessionId });
  dismiss();
};
```

Replace `onContinue` and `onDismiss` props in the JSX with `trackedAdvance` and `trackedDismiss`.

- [ ] **Step 2: Step4Aha emits report_generation_started + report_generated/failed**

In `Step4Aha.tsx`, around the mutation:

```tsx
import { useEffect, useRef } from "react";
import { tourEvents } from "@/lib/analytics/tour-events";
import { TourRateLimitError } from "@/lib/data";

const startedAt = useRef<number>(0);

useEffect(() => {
  if (mutation.isIdle && session.persona && session.market) {
    startedAt.current = Date.now();
    tourEvents.reportGenerationStarted({
      persona: session.persona,
      geoLevel: session.market.geoLevel,
      geoId: session.market.geoId,
      sessionId: session.sessionId,
    });
    mutation.mutate({
      sessionId: session.sessionId,
      persona: session.persona,
      market: session.market,
    });
  }
}, [mutation, session]);

useEffect(() => {
  if (mutation.isSuccess && mutation.data) {
    const limited = mutation.data.report.sections
      .filter((s: any) => s.limitedData)
      .map((s: any) => s.id);
    tourEvents.reportGenerated({
      durationMs: Date.now() - startedAt.current,
      sessionId: session.sessionId,
      limitedSections: limited,
    });
  }
  if (mutation.isError) {
    if (mutation.error instanceof TourRateLimitError) {
      tourEvents.rateLimitHit({ sessionId: session.sessionId });
    }
    tourEvents.reportFailed({
      reason: (mutation.error as Error)?.message ?? "unknown",
      durationMs: Date.now() - startedAt.current,
      sessionId: session.sessionId,
    });
  }
}, [
  mutation.isSuccess,
  mutation.isError,
  mutation.data,
  mutation.error,
  session.sessionId,
]);
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/tour/components/TourSpotlight.tsx \
  packages/frontend/app/tour/components/Step4Aha.tsx
git commit -m "feat(tour): telemetry on spotlight steps + report generation outcomes"
```

---

### Task 4: Telemetry for signup + completion

**Files:**

- Modify: `packages/frontend/app/tour/components/InlineSignupForm.tsx`
- Modify: `packages/frontend/app/tour/components/PostSignupCelebrate.tsx`

- [ ] **Step 1: InlineSignupForm**

```tsx
// At the top of onSubmit (after `e.preventDefault()`):
tourEvents.signupInitiated({ sessionId: session.sessionId });

// After successful mutateAsync (in the dev auto-confirm branch):
tourEvents.signupCompleted({
  userId: result.userId,
  sessionId: session.sessionId,
  reportClaimed: !!result.reportId,
});

// On dismiss button click (the ✕):
tourEvents.signupDismissed({ sessionId: session.sessionId });
```

- [ ] **Step 2: PostSignupCelebrate emits tour_completed**

```tsx
// Inside PostSignupCelebrate, add:
import { useEffect } from "react";
import { tourEvents } from "@/lib/analytics/tour-events";
import { useAuth } from "@/lib/auth/AuthContext";

// Inside the component:
const { user } = useAuth();
useEffect(() => {
  if (!user || !session.sessionId) return;
  tourEvents.tourCompleted({
    sessionId: session.sessionId,
    userId: user.id,
    durationMs: Date.now() - session.startedAt,
  });
}, [user, session.sessionId, session.startedAt]);
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/tour/components/InlineSignupForm.tsx \
  packages/frontend/app/tour/components/PostSignupCelebrate.tsx
git commit -m "feat(tour): telemetry on signup-initiated/completed/dismissed + tour_completed"
```

---

### Task 5: Feature flag wrapper

**Files:**

- Create: `packages/frontend/lib/feature-flags/tour-v2.ts`
- Modify: `packages/frontend/app/tour/page.tsx`

- [ ] **Step 1: Implement the flag helper**

```typescript
// packages/frontend/lib/feature-flags/tour-v2.ts
"use client";

/**
 * Tour v2 feature flag.
 *
 * - During internal alpha: flag on for the team only (controlled by
 *   NEXT_PUBLIC_TOUR_V2_ENABLED env var).
 * - For 10% canary: deterministic hash of cookie identifier.
 * - For 100% rollout: flag is always on.
 */

const ROLLOUT_VAR = process.env.NEXT_PUBLIC_TOUR_V2_ROLLOUT ?? "off"; // off | alpha | canary-10 | ab-50 | full

function hashCookie(cookieValue: string): number {
  let h = 0;
  for (let i = 0; i < cookieValue.length; i++) {
    h = (h << 5) - h + cookieValue.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 100;
}

export function isTourV2Enabled(piqUid: string | null): boolean {
  if (ROLLOUT_VAR === "off") return false;
  if (ROLLOUT_VAR === "full") return true;
  if (ROLLOUT_VAR === "alpha") {
    // Alpha: check explicit allowlist of internal user IDs (comma-separated env)
    const allowlist = (process.env.NEXT_PUBLIC_TOUR_V2_ALPHA_USERS ?? "")
      .split(",")
      .map((s) => s.trim());
    return !!piqUid && allowlist.includes(piqUid);
  }
  if (ROLLOUT_VAR === "canary-10")
    return piqUid ? hashCookie(piqUid) < 10 : false;
  if (ROLLOUT_VAR === "ab-50") return piqUid ? hashCookie(piqUid) < 50 : false;
  return false;
}
```

- [ ] **Step 2: Gate /tour behind the flag**

In `app/tour/page.tsx`, at the top of the component:

```tsx
import { isTourV2Enabled } from "@/lib/feature-flags/tour-v2";

// Inside TourPage (or a new wrapper):
const piqUid =
  typeof document !== "undefined"
    ? (document.cookie.match(/piq-uid=([^;]+)/)?.[1] ?? null)
    : null;
const enabled = isTourV2Enabled(piqUid);

if (!enabled) {
  if (typeof window !== "undefined") {
    window.location.replace("/get-started"); // legacy path while flag is off
  }
  return null;
}
```

(Note: when ROLLOUT_VAR === 'full' is set during 100% rollout, the legacy `/get-started` will already redirect to `/tour` via middleware, so the redirect-back happens once and stops once flag is on for all users.)

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/lib/feature-flags/tour-v2.ts \
  packages/frontend/app/tour/page.tsx
git commit -m "feat(tour): feature-flag wrapper for canary rollout (off/alpha/canary-10/ab-50/full)"
```

---

### Task 6: Sparse-data + slow-generation polish

**Files:**

- Modify: `packages/backend/src/anonymous/listing-presentation.service.ts`
- Modify: `packages/backend/src/anonymous/listing-presentation-narrative.service.ts`

- [ ] **Step 1: Backend — emit warnings on sparse markets**

In `listing-presentation.service.ts`, after assembling `sections`, count how many sections are `limitedData: true`. If ≥4 of 10, log a warn-level event for downstream alerting:

```typescript
const limitedCount = sections.filter((s) => s.limitedData).length;
if (limitedCount >= 4) {
  this.logger.warn(
    `Sparse-market report: ${market.name} (${market.geoLevel}/${market.geoId}) — ${limitedCount}/10 sections limited`,
  );
}
```

- [ ] **Step 2: Tighten Claude timeout**

In `listing-presentation-narrative.service.ts`, wrap the `anthropic.messages` call with a 12s timeout (Promise.race) so a slow Claude API call doesn't block the whole report. On timeout, fall back to deterministic template.

```typescript
const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("narrative_timeout")), ms),
    ),
  ]);

// In generate():
const response = await withTimeout(
  this.anthropic.messages({
    /* ... */
  }),
  12_000,
);
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/anonymous/listing-presentation.service.ts \
  packages/backend/src/anonymous/listing-presentation-narrative.service.ts
git commit -m "feat(anonymous): sparse-market warning + 12s narrative timeout"
```

---

### Task 7: Keyboard a11y + focus management

**Files:**

- Modify: `packages/frontend/app/tour/components/PersonaCards.tsx` — autofocus first card
- Modify: `packages/frontend/app/tour/components/MarketPickerStep.tsx` — already has `autoFocus` on input
- Modify: `packages/frontend/app/tour/components/TourBottomSheet.tsx` — focus management
- Modify: `packages/frontend/app/tour/components/InlineSignupForm.tsx` — focus email on mount

- [ ] **Step 1: PersonaCards — autofocus the priority (agent) card**

In `PersonaCards.tsx`, on the agent card add `autoFocus` to the wrapping button. Also add `useEffect` to install an `Escape` keydown listener that calls `router.back()` so users can leave.

- [ ] **Step 2: TourBottomSheet — focus the Continue button on mount, restore on unmount**

```tsx
import { useEffect, useRef } from "react";

const continueRef = useRef<HTMLButtonElement>(null);
const previousFocusRef = useRef<HTMLElement | null>(null);

useEffect(() => {
  previousFocusRef.current = document.activeElement as HTMLElement | null;
  const t = setTimeout(() => continueRef.current?.focus(), 200);
  return () => {
    clearTimeout(t);
    if (
      previousFocusRef.current &&
      document.contains(previousFocusRef.current)
    ) {
      previousFocusRef.current.focus({ preventScroll: true });
    }
  };
}, []);

// Add ref={continueRef} to the Continue button.
```

- [ ] **Step 3: Esc handler + focus on InlineSignupForm**

In `InlineSignupForm.tsx`, add:

```tsx
const emailRef = useRef<HTMLInputElement>(null);
useEffect(() => {
  emailRef.current?.focus();
}, []);
```

Add `ref={emailRef}` to the email input.

- [ ] **Step 4: Smoke test with keyboard**

```bash
npm run dev:fresh
# Open /tour. Tab through: should land on agent card first. Enter to select.
# Market screen: input is autofocused. Type, Enter selects first suggestion.
# Spotlight steps: Esc dismisses (already wired in legacy TourProvider; verify). Tab cycles through tooltip controls.
# Step 4: Email input autofocused after report renders.
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/tour/components/
git commit -m "feat(tour): keyboard a11y + focus management"
```

---

### Task 8: Playwright E2E — full agent flow

**Files:**

- Create: `packages/frontend/tests/e2e/tour-agent-flow.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// packages/frontend/tests/e2e/tour-agent-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Activation tour — agent flow", () => {
  test("full path: persona → market → 3 spotlight steps → report → signup → celebrate", async ({
    page,
  }) => {
    await page.goto("/tour?persona=agent&market=metro-39580");

    // Skip persona/market screens since pre-filled — should land on step1 redirect to /map
    await page.waitForURL(/\/map\?tour=step1/);
    await expect(page.locator('[data-tour="search-bar"]')).toBeVisible();

    // Click anywhere to advance
    await page.click("body", { position: { x: 10, y: 10 } });
    await page.waitForURL(/\/market\/.+\?tour=step2/);
    await expect(page.locator('[data-tour="propertyiq-score"]')).toBeVisible();

    await page.click("body", { position: { x: 10, y: 10 } });
    await page.waitForURL(/\/compare\/markets.*\?tour=step3/);
    await expect(page.locator('[data-tour="compare-grid"]')).toBeVisible();

    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/\/tour\?phase=step4/);

    // Report renders within reasonable time
    await expect(page.getByText("Listing Presentation")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/PropertyIQ Score/i)).toBeVisible();

    // Inline signup form
    const email = `e2e+${Date.now()}@test.local`;
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("hunter2hunter2");
    await page.getByRole("button", { name: /save my report/i }).click();

    // Celebrate screen (dev mode, auto-confirm)
    await page.waitForURL(/\/tour\?phase=celebrate/, { timeout: 15_000 });
    await expect(page.getByText(/your.+report is saved/i)).toBeVisible();
  });

  test("rate limit: second generation from same IP within 24h returns friendly screen", async ({
    page,
    request,
  }) => {
    // First call uses up the daily quota
    await request.post("/api/anonymous/listing-presentation", {
      data: {
        sessionId: "e2e-rate-1",
        persona: "agent",
        market: {
          geoLevel: "metro",
          geoId: "16740",
          name: "Charlotte-Concord-Gastonia, NC-SC",
        },
      },
    });

    await page.goto("/tour?persona=agent&market=metro-16740");
    await page.click("body", { position: { x: 10, y: 10 } }); // step1 → step2
    await page.click("body", { position: { x: 10, y: 10 } }); // step2 → step3
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/\/tour\?phase=step4/);
    await expect(page.getByText(/used today's free demo/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
```

- [ ] **Step 2: Run**

```bash
npx playwright test tour-agent-flow
```

Expected: 2 tests pass. (Requires backend + frontend dev servers running.)

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/tests/e2e/tour-agent-flow.spec.ts
git commit -m "test(tour): E2E agent flow + rate-limit branch"
```

---

### Task 9: Mobile + sparse-data E2E

**Files:**

- Create: `packages/frontend/tests/e2e/tour-mobile.spec.ts`
- Create: `packages/frontend/tests/e2e/tour-sparse-data.spec.ts`

- [ ] **Step 1: Mobile**

```typescript
// packages/frontend/tests/e2e/tour-mobile.spec.ts
import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["Pixel 5"] });

test("mobile: persona cards stack, bottom sheet renders, signup form sticky", async ({
  page,
}) => {
  await page.goto("/tour");

  // Persona cards stack vertically on mobile
  const cards = page.getByRole("button", { name: /continue as/i });
  await expect(cards).toHaveCount(3);

  await cards.first().click();
  await page.locator('input[type="search"]').fill("Cary");
  // Wait for first suggestion, click
  const firstSuggestion = page.getByRole("option").first();
  await expect(firstSuggestion).toBeVisible();
  await firstSuggestion.click();

  // Step 1 spotlight: bottom sheet on mobile
  await page.waitForURL(/\/map\?tour=step1/);
  await expect(page.getByRole("dialog", { name: /you picked/i })).toBeVisible();
});
```

- [ ] **Step 2: Sparse data**

```typescript
// packages/frontend/tests/e2e/tour-sparse-data.spec.ts
import { test, expect } from "@playwright/test";

test("sparse-data market renders report with limited-data callouts", async ({
  page,
}) => {
  // Pick a known sparse ZIP — substitute with one your dataset confirms is sparse
  await page.goto("/tour?persona=agent&market=zip-99999");
  // Skip steps 1-3 by navigating directly to step 4
  await page.goto("/tour?phase=step4&persona=agent&market=zip-99999");

  // Loading then report renders
  await expect(page.getByText(/Listing Presentation/i)).toBeVisible({
    timeout: 25_000,
  });
  // At least one section shows "Limited data"
  await expect(page.getByText(/Limited data/i).first()).toBeVisible();
  // Cover still renders (no crash)
  await expect(page.getByText(/PropertyIQ Market Intelligence/i)).toBeVisible();
});
```

- [ ] **Step 3: Run**

```bash
npx playwright test tour-mobile tour-sparse-data
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/tests/e2e/tour-mobile.spec.ts \
  packages/frontend/tests/e2e/tour-sparse-data.spec.ts
git commit -m "test(tour): mobile + sparse-data E2E coverage"
```

---

### Task 10: A11y E2E — axe scan + keyboard

**Files:**

- Create: `packages/frontend/tests/e2e/tour-a11y.spec.ts`

- [ ] **Step 1: Install axe + write the test**

```bash
npm install -D @axe-core/playwright
```

```typescript
// packages/frontend/tests/e2e/tour-a11y.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Tour — accessibility", () => {
  test("persona screen passes axe with no critical issues", async ({
    page,
  }) => {
    await page.goto("/tour");
    const results = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });

  test("listing presentation passes axe", async ({ page }) => {
    await page.goto("/tour?phase=step4&persona=agent&market=metro-16740");
    await page.waitForSelector("article", { timeout: 20_000 });
    const results = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });

  test("keyboard: Tab → Enter walks the persona screen", async ({ page }) => {
    await page.goto("/tour");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    // Should advance to market picker
    await expect(page.getByText(/What market matters most/i)).toBeVisible();
  });

  test("keyboard: Esc dismisses spotlight tour", async ({ page }) => {
    await page.goto("/tour?persona=agent&market=metro-39580");
    await page.waitForURL(/\/map\?tour=step1/);
    await page.keyboard.press("Escape");
    await page.waitForURL("/"); // dismiss returns to homepage per useTourFromUrl.dismiss()
  });
});
```

- [ ] **Step 2: Run**

```bash
npx playwright test tour-a11y
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/tests/e2e/tour-a11y.spec.ts package.json
git commit -m "test(tour): a11y coverage with @axe-core/playwright"
```

---

### Task 11: Visual regression on the listing presentation

**Files:**

- Create: `packages/frontend/tests/e2e/visual-regression/listing-presentation.spec.ts`

- [ ] **Step 1: Pick 5 representative markets**

These should be diverse on score, size, and data density:

- `metro-16740` — Charlotte (large, hot)
- `metro-38900` — Portland (medium, cooling)
- `metro-26420` — Houston (very large, balanced)
- `county-37183` — Wake County NC (sub-metro)
- `metro-19660` — Eugene OR (small, sparse-ish)

- [ ] **Step 2: Write the test**

```typescript
// packages/frontend/tests/e2e/visual-regression/listing-presentation.spec.ts
import { test, expect } from "@playwright/test";

const MARKETS = [
  { id: "charlotte", param: "metro-16740" },
  { id: "portland", param: "metro-38900" },
  { id: "houston", param: "metro-26420" },
  { id: "wake-county", param: "county-37183" },
  { id: "eugene", param: "metro-19660" },
];

test.describe("Visual regression — listing presentation", () => {
  for (const m of MARKETS) {
    test(`listing presentation for ${m.id}`, async ({ page }) => {
      await page.goto(`/tour?phase=step4&persona=agent&market=${m.param}`);
      await page.waitForSelector("article", { timeout: 30_000 });
      // Mask elements that change every render (timestamps in cover)
      await expect(page.locator("article")).toHaveScreenshot(`${m.id}.png`, {
        fullPage: true,
        mask: [page.locator('[data-meta="generated-at"]')],
      });
    });
  }
});
```

- [ ] **Step 3: Generate baseline screenshots**

```bash
npx playwright test visual-regression --update-snapshots
```

- [ ] **Step 4: Re-run for stability check**

```bash
npx playwright test visual-regression
```

Expected: PASS (snapshots match the just-generated baselines).

- [ ] **Step 5: Add `data-meta="generated-at"` to the cover**

In `ListingPresentationCover.tsx`, add the `data-meta="generated-at"` attribute to the "Generated" Meta value so it can be masked by visual regression.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/tests/e2e/visual-regression/ \
  packages/frontend/app/tour/components/ListingPresentationCover.tsx
git commit -m "test(tour): visual regression on listing presentation across 5 markets"
```

---

### Task 12: Performance audit + budget

**Files:**

- Create: `packages/frontend/tests/e2e/tour-perf.spec.ts`

- [ ] **Step 1: Write a quick perf assertion**

```typescript
// packages/frontend/tests/e2e/tour-perf.spec.ts
import { test, expect } from "@playwright/test";

test("listing presentation generation p50 ≤ 8s for a known-good market", async ({
  page,
}) => {
  const start = Date.now();
  await page.goto("/tour?phase=step4&persona=agent&market=metro-16740");
  await page.waitForSelector("article", { timeout: 20_000 });
  const elapsed = Date.now() - start;
  // Smoke check, not statistically rigorous — but flags major regressions
  expect(elapsed).toBeLessThan(12_000);
});

test("total page weight on /tour?phase=step4 is under 600KB (compressed)", async ({
  page,
}) => {
  let totalBytes = 0;
  page.on("response", async (resp) => {
    if (resp.url().includes("/_next/static") || resp.url().includes("/api/")) {
      const body = await resp.body().catch(() => Buffer.alloc(0));
      totalBytes += body.length;
    }
  });
  await page.goto("/tour?phase=step4&persona=agent&market=metro-16740");
  await page.waitForSelector("article", { timeout: 20_000 });
  expect(totalBytes).toBeLessThan(600_000);
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/tests/e2e/tour-perf.spec.ts
git commit -m "test(tour): perf budget assertions (p50 timing + page weight)"
```

---

### Task 13: Full E2E suite run + canary readiness

- [ ] **Step 1: Run the full Playwright suite**

```bash
npx playwright test tour-
```

Expected: ALL tour-prefixed specs pass.

- [ ] **Step 2: Backend test sweep**

```bash
npx nx test backend
```

Expected: All Phase 01 + Phase 05 backend specs pass.

- [ ] **Step 3: Frontend unit + RTL sweep**

```bash
npm run test -w packages/frontend
```

Expected: All vitest specs pass.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: 0 errors in any phase 01-06 file.

- [ ] **Step 5: Set canary flag**

In `packages/frontend/.env.local`:

```
NEXT_PUBLIC_TOUR_V2_ROLLOUT=alpha
NEXT_PUBLIC_TOUR_V2_ALPHA_USERS=<your-user-id>
```

(In Railway: set `NEXT_PUBLIC_TOUR_V2_ROLLOUT=alpha` for the frontend service.)

- [ ] **Step 6: Smoke test as the alpha user**

Sign in as the alpha user. Visit `/tour`. Verify the new flow renders.
Sign in as a non-alpha user. Visit `/tour`. Verify it bounces to `/get-started` (which 308s back if middleware is on — adjust by setting `tour_v2_alpha` exclusion at middleware OR keep the flag-off path returning a friendly message instead of redirecting).

- [ ] **Step 7: Commit canary settings**

```bash
git add packages/frontend/.env.example   # if you add a sample
git commit -m "feat(tour): canary readiness — alpha rollout setting"
```

---

### Task 14: Cleanup of unused legacy onboarding files

- [ ] **Step 1: Identify files no longer referenced**

```bash
grep -rln "from \"@/app/onboarding\"" packages/frontend/app | grep -v 'onboarding/'
```

If the legacy `TourProvider`, `BreathingSpotlight`, `ConnectedTooltip` are still imported by `app/providers.tsx` (which they are), keep them — `BreathingSpotlight` and `ConnectedTooltip` are reused by Phase 03's `TourSpotlight`. Only the legacy `TourProvider` may be safe to remove.

Check with:

```bash
grep -rln "TourProvider\b" packages/frontend/app | grep -v 'onboarding/'
```

If only `app/providers.tsx` references it, decide: leave for now (Phase 06 cleanup is non-blocking) OR remove. Recommend leaving until Phase 06 has been live in canary for 2 weeks.

- [ ] **Step 2: Remove unused `app/get-started/OnboardingSearch.tsx` and `PersonaCards.tsx`**

These are dead since Phase 02 converted the page to a redirect. Delete them.

```bash
git rm packages/frontend/app/get-started/OnboardingSearch.tsx packages/frontend/app/get-started/PersonaCards.tsx
git commit -m "chore(tour): remove unused get-started persona+search components"
```

---

## Acceptance criteria for Phase 06 done

- [ ] All 11 typed tour events fire correctly during a full walk (verified via browser DevTools network tab to analytics endpoint).
- [ ] Feature flag wrapper enforces alpha / canary-10 / ab-50 / full rollouts.
- [ ] Sparse-market reports render every section gracefully with "Limited data" callouts.
- [ ] Claude narrative timeout (12s) falls back to deterministic template without breaking the report.
- [ ] Keyboard a11y: Tab/Enter walks the tour. Esc dismisses spotlight. Focus management restores correctly.
- [ ] Axe scan: zero critical or serious violations on persona screen + listing presentation.
- [ ] E2E Playwright: full agent flow + rate-limit + mobile + sparse-data + a11y + perf all pass.
- [ ] Visual regression baselines committed for 5 representative markets.
- [ ] Total page weight at `/tour?phase=step4` < 600KB compressed.
- [ ] Generation p50 time ≤ 8s; p95 ≤ 12s for a known-good market.
- [ ] All Phase 01-06 backend specs pass.
- [ ] All Phase 01-06 vitest specs pass.
- [ ] Lint clean across changed files.
- [ ] Canary settings documented in `.env.example` and Railway config.
- [ ] Legacy `app/get-started/OnboardingSearch.tsx` + `PersonaCards.tsx` removed.

---

## Phase 06 success metrics — what we'll measure post-launch

These map to the spec's success metrics, with the events from Task 1 wiring up the funnel:

| Event chain                                       | Metric                     | Target |
| ------------------------------------------------- | -------------------------- | ------ |
| `tour.started` → `tour.report_generated`          | Step-4 reach rate          | ≥ 60%  |
| `tour.report_generated` → `tour.signup_completed` | Step-4 → signup conversion | ≥ 25%  |
| `tour.started` → `tour.signup_completed`          | Headline conversion        | ≥ 15%  |
| `tour.signup_completed` (`source=mobile`) / total | Mobile signup share        | ≥ 50%  |
| `tour.report_generated.durationMs`                | Generation p95             | ≤ 8s   |

Once telemetry is flowing, build a Grafana / dashboard view that pivots these events to track each metric live.
