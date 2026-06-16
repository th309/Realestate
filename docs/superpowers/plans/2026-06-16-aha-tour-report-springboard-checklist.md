# The Aha — Tour Steps, Report Finale, Springboard & Checklist — Implementation Plan (P1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the live tour into the value arc — **Score (interactive) → Why (AI narrative) → 🎉 Pro + full report → bonus Connect Claude** — by reusing the existing 10-section report (de-watermarked) as the finale, adding a persona springboard whose hero is the Claude/MCP differentiator, and extending the getting-started checklist.

**Architecture:** Builds on **P0 Part 1** (the consolidated, fixed spotlight engine under `app/(app)/tour/`). The 3-spotlight sandbox (search → score → compare) becomes a 2-spotlight arc on the market-detail page (score → why); the `/tour?phase=step4` finale (`Step4Aha`) is repurposed: for an authenticated user it renders `ListingPresentation` with `showWatermark={false}`, replaces the anonymous `InlineSignupForm` with the **persona springboard** + a "Pro unlocked" celebration, and offers a skippable **Connect Claude** beat. No new report backend is needed — we reuse the existing `POST /api/anonymous/listing-presentation` (the tour session already carries persona+market+sessionId).

**Tech Stack:** Next.js App Router, React 19, Tailwind 4, Vitest + @testing-library/react, Playwright. Use the `frontend-design:frontend-design` skill when building the springboard/finale UI for visual polish. Frontend commands from `packages/frontend`.

**Dependencies:** P0 Part 1 (tour engine), P0 Part 2 (trial-unblur — so the finale's "Pro unlocked" is true). Reuses: `useAnonymousListingPresentation`, `ListingPresentation`, `Step4Aha`, `ProgressChecklist`, the MCP routes `/auth/mcp-authorize` + `/docs/mcp`.

**Risk:** the anon report endpoint is behind `AnonRateLimitGuard`; one finale report per signup is within limits, but if rate-limiting bites authenticated users, add an authenticated `POST /api/reports/listing-presentation` mirroring `ListingPresentationService.generate()` (out of scope here, noted).

---

## Task 1: Rewrite the tour step arc (Score → Why)

**Files:**

- Modify: `app/(app)/tour/step-content.ts`
- Modify: `app/(app)/tour/hooks/useTourFromUrl.ts` (advance routing)
- Modify: `app/(app)/tour/__tests__/step-content.test.ts`, `app/(app)/tour/__tests__/useTourFromUrl.test.ts`

- [ ] **Step 1: Write the failing step-content test**

In `step-content.test.ts`, replace the step expectations to assert the new 2-step arc and persona copy:

```ts
import { describe, it, expect } from "vitest";
import { SANDBOX_STEP_ORDER, getStepContent } from "../step-content";

describe("sandbox step content (Score → Why)", () => {
  it("has exactly two spotlight steps in order", () => {
    expect(SANDBOX_STEP_ORDER).toEqual(["step1", "step2"]);
  });
  it("step1 targets the PropertyIQ score; step2 the AI assessment", () => {
    expect(getStepContent("step1", null).targetSelector).toBe(
      '[data-tour="propertyiq-score"]',
    );
    expect(getStepContent("step2", null).targetSelector).toBe(
      '[data-tour="ai-assessment"]',
    );
  });
  it("uses persona-specific score copy for investors", () => {
    expect(getStepContent("step1", "investor").body).toMatch(
      /investment signal/i,
    );
  });
});
```

- [ ] **Step 2: Run it (fails)**

```bash
npm run test:unit -- step-content
```

Expected: FAIL (order is `["step1","step2","step3"]`; step1 targets `search-bar`).

- [ ] **Step 3: Rewrite `step-content.ts`**

```ts
import type { Persona } from "@/lib/data";

export type SandboxStepId = "step1" | "step2";
export const SANDBOX_STEP_ORDER: SandboxStepId[] = ["step1", "step2"];

export interface StepContent {
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
    targetSelector: '[data-tour="propertyiq-score"]',
    title: "Your market's PropertyIQ Score",
    body: "A 0–100 read on demand vs. the state average. Higher is stronger — tap it to see what's driving it.",
    placement: "right",
    personaBody: {
      agent:
        "A 0–100 score you can put in front of a client. Higher = listings move faster, often above ask. Tap it to see what's driving it.",
      investor:
        "Your investment signal — higher means stronger demand and competition for inventory. Tap it to see what's driving it.",
      homebuyer:
        "A quick read on how competitive this market is right now. Tap it to see what's driving it.",
    },
  },
  step2: {
    id: "step2",
    targetSelector: '[data-tour="ai-assessment"]',
    title: "What's driving it",
    body: "PropertyIQ reads the market for you, in plain English — the story behind the number.",
    placement: "top",
    personaBody: {
      agent:
        "Talking points for your next client conversation, in plain English.",
      investor:
        "The thesis behind the score — momentum, supply, and pricing pressure in plain English.",
      homebuyer: "What this market means for you as a buyer, in plain English.",
    },
  },
};

export function getStepContent(
  stepId: SandboxStepId,
  persona: Persona | null,
): StepContent {
  const c = CONTENT[stepId];
  if (!c) throw new Error(`Unknown step id: ${stepId}`);
  const body = (persona && c.personaBody?.[persona]) ?? c.body;
  return { ...c, body };
}

export function nextSandboxStep(current: SandboxStepId): SandboxStepId | null {
  const i = SANDBOX_STEP_ORDER.indexOf(current);
  return i >= 0 && i < SANDBOX_STEP_ORDER.length - 1
    ? SANDBOX_STEP_ORDER[i + 1]
    : null;
}
```

- [ ] **Step 4: Update `advance()` routing in `useTourFromUrl.ts`**

Both steps live on the market-detail page, so advancing from step1→step2 stays on `/market/<geoId>`. Replace the `advance()` route logic:

```ts
function advance() {
  if (!active) return;
  const next = nextSandboxStep(active.stepId);
  if (!next) return; // step2 is last → caller uses advanceToStep4
  // step2 lives on the same market page as step1.
  router.push(buildStepUrl(next, `/market/${active.market.geoId}`));
}
```

- [ ] **Step 5: Update the `useTourFromUrl` advance test**

In `useTourFromUrl.test.ts`, change the step1→step2 expectation to stay on the market page:

```ts
it("advance() at step1 pushes /market/<geoId>?tour=step2", () => {
  currentParams = "tour=step1&persona=agent&market=metro-39580&sessionId=abc";
  const { result } = renderHook(() => useTourFromUrl());
  act(() => result.current.advance());
  expect(pushSpy).toHaveBeenCalledWith(
    expect.stringMatching(/^\/market\/39580\?.*tour=step2/),
  );
});
```

(Remove/replace the obsolete step2→`/compare/markets?tour=step3` and step3 tests.)

- [ ] **Step 6: Update where the tour enters step1**

`app/(app)/tour/page.tsx` `RedirectToStep` currently redirects step1 to `/map`. Change it to the market-detail page so step1 (the score) has its target:

```tsx
// case "step1": redirect to the user's market so the score is on-screen.
case "step1":
  return <RedirectToStep step="step1" route={`/market/${session.market?.geoId ?? ""}`} />;
```

And ensure `/map`'s `<TourSpotlight stepId="step1" />` is removed or repointed (the score lives on `/market/[id]`, not `/map`). Add `<TourSpotlight stepId="step1" />` and `<TourSpotlight stepId="step2" />` to the market-detail page (`app/(app)/market/[id]/MarketDashboard.tsx`, near the score/AI sections), and remove the stale `/map` step1 mount.

- [ ] **Step 7: Run tests + build, commit**

```bash
npm run test:unit -- step-content useTourFromUrl
npm run build
git add -A
git commit -m "feat(tour): value-arc steps — Score then Why on the market page"
```

---

## Task 2: Report-as-finale (de-watermarked, with Pro framing)

**Files:**

- Modify: `app/(app)/tour/components/Step4Aha.tsx`
- Modify: `app/(app)/tour/components/__tests__/Step4Aha.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// Mock useAuth → authenticated, and the report mutation → success.
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false }),
}));
// ...mock useAnonymousListingPresentation to return isSuccess + data (mirror existing test setup)...

it("authenticated finale: no demo watermark, no signup form, shows the springboard", async () => {
  render(<Step4Aha />); // with mocked success state
  expect(screen.queryByText(/Demo report/i)).toBeNull();
  expect(screen.queryByTestId("inline-signup-form")).toBeNull();
  expect(screen.getByTestId("persona-springboard")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it (fails)**

```bash
npm run test:unit -- Step4Aha
```

Expected: FAIL (currently always `showWatermark={true}` + `InlineSignupForm`).

- [ ] **Step 3: Branch `Step4Aha` on auth**

Replace the success branch in `Step4Aha.tsx`. Import `useAuth` and the new `PersonaSpringboard` (Task 3):

```tsx
import { useAuth } from "@/lib/auth";
import { PersonaSpringboard } from "./PersonaSpringboard";
// ...
if (mutation.isSuccess && mutation.data) {
  const authed = !!user?.id;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {authed && (
        <div className="mb-6 rounded-2xl bg-primary-container px-6 py-5 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-on-primary-container">
            🎉 You're set with Pro
          </p>
          <h2 className="mt-1 text-xl font-semibold text-on-surface">
            14 days of full access — here's your market, in full.
          </h2>
        </div>
      )}
      <ListingPresentation
        report={mutation.data}
        marketName={session.market.name}
        geographyDescription={session.market.name}
        showWatermark={!authed}
      />
      {authed ? (
        <PersonaSpringboard persona={session.persona} market={session.market} />
      ) : (
        <div data-print-hide="true">
          <InlineSignupForm />
        </div>
      )}
    </div>
  );
}
```

Get `user` from `const { user } = useAuth();` near the top of the component. Trigger confetti for authed users on success — add an effect:

```tsx
import { triggerConfetti } from "../primitives/celebrations";
// after the existing mount effect:
useEffect(() => {
  if (mutation.isSuccess && user?.id) triggerConfetti();
}, [mutation.isSuccess, user?.id]);
```

- [ ] **Step 4: Run it (passes), commit**

```bash
npm run test:unit -- Step4Aha
git add -A
git commit -m "feat(tour): authenticated finale renders the full report unwatermarked with Pro framing"
```

---

## Task 3: Persona springboard (Claude/MCP hero + deep-links)

**Files:**

- Create: `app/(app)/tour/components/PersonaSpringboard.tsx`
- Create: `app/(app)/tour/components/__tests__/PersonaSpringboard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonaSpringboard } from "../PersonaSpringboard";

const market = { geoLevel: "metro" as const, geoId: "39580", name: "Boise" };

describe("PersonaSpringboard", () => {
  it("always leads with the Connect Claude hero", () => {
    render(<PersonaSpringboard persona="investor" market={market} />);
    const cards = screen.getAllByRole("link");
    expect(cards[0]).toHaveTextContent(/Connect Claude/i);
    expect(cards[0]).toHaveAttribute("href", "/docs/mcp");
  });
  it("deep-links the investor's analyzer card", () => {
    render(<PersonaSpringboard persona="investor" market={market} />);
    expect(
      screen.getByRole("link", { name: /analyze a deal/i }),
    ).toHaveAttribute("href", "/analyzer");
  });
});
```

- [ ] **Step 2: Run it (fails)**

```bash
npm run test:unit -- PersonaSpringboard
```

Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement `PersonaSpringboard.tsx`**

```tsx
"use client";

import Link from "next/link";
import type { Persona, MarketRef } from "@/lib/data";

interface Card {
  label: string;
  sub: string;
  href: string;
  hero?: boolean;
}

const MCP_HERO: Card = {
  label: "⚡ Connect Claude",
  sub: "Only on PropertyIQ — query your markets in plain English from inside Claude.",
  href: "/docs/mcp",
  hero: true,
};

function personaCards(persona: Persona | null, market: MarketRef): Card[] {
  const cmp: Card = {
    label: "Compare markets",
    sub: `${market.name} vs. its closest peer, side by side.`,
    href: "/compare/markets",
  };
  const analyze: Card = {
    label: "Analyze a deal",
    sub: "Cap rate + cashflow on any address in seconds.",
    href: "/analyzer",
  };
  const screen: Card = {
    label: "Screen markets",
    sub: "Rank every market by your criteria.",
    href: "/screener",
  };
  switch (persona) {
    case "agent":
      return [
        cmp,
        screen,
        {
          label: "Build a report",
          sub: "A client-ready PDF for any market.",
          href: "/reports",
        },
      ];
    case "homebuyer":
      return [analyze, cmp, screen];
    case "investor":
    default:
      return [analyze, screen, cmp];
  }
}

export function PersonaSpringboard({
  persona,
  market,
}: {
  persona: Persona | null;
  market: MarketRef;
}) {
  const cards = [MCP_HERO, ...personaCards(persona, market)];
  return (
    <section
      data-testid="persona-springboard"
      className="mt-8"
      data-print-hide="true"
    >
      <h3 className="text-sm font-medium uppercase tracking-wide text-on-surface-variant mb-3">
        Now put it to work
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link
            key={c.href + c.label}
            href={c.href}
            className={[
              "block rounded-xl border p-4 transition-colors",
              c.hero
                ? "border-primary/50 bg-primary-container/40 hover:bg-primary-container/60 sm:col-span-2"
                : "border-outline-variant/40 bg-surface-container hover:bg-surface-container-high",
            ].join(" ")}
          >
            <div className="font-medium text-on-surface">{c.label}</div>
            <div className="text-sm text-on-surface-variant mt-0.5">
              {c.sub}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run it (passes), commit**

```bash
npm run test:unit -- PersonaSpringboard
git add -A
git commit -m "feat(tour): persona springboard with Connect Claude hero + deep-links"
```

(Use `frontend-design:frontend-design` to refine visuals before merge — the markup above is brand-correct but minimal.)

---

## Task 4: Extend the getting-started checklist

**Files:**

- Modify: `app/(app)/dashboard/components/ProgressChecklist.tsx`
- Modify: `packages/backend/src/onboarding/onboarding.service.ts` (no new code needed — `updateChecklist` accepts any task id; this step just documents the new ids)
- Create: `app/(app)/dashboard/components/__tests__/ProgressChecklist.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressChecklist } from "../ProgressChecklist";

it("shows the value-framed items including the flagged Connect Claude task", () => {
  render(<ProgressChecklist completedTasks={["view_score"]} />);
  expect(screen.getByText(/Connect PropertyIQ to Claude/i)).toBeInTheDocument();
  expect(screen.getByText(/Analyze a property/i)).toBeInTheDocument();
  expect(
    screen.getByText(/Save a market to your watchlist/i),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it (fails)**

```bash
npm run test:unit -- ProgressChecklist
```

Expected: FAIL (current items are the old 5).

- [ ] **Step 3: Replace `CHECKLIST_ITEMS`**

```tsx
const CHECKLIST_ITEMS = [
  { id: "view_score", label: "See your PropertyIQ Score", href: "/market" },
  {
    id: "read_report",
    label: "Read your full market report",
    href: "/tour?resume=fresh",
  },
  {
    id: "connect_claude",
    label: "Connect PropertyIQ to Claude ⚡",
    href: "/docs/mcp",
  },
  {
    id: "compare_markets",
    label: "Compare your market to a peer",
    href: "/compare/markets",
  },
  {
    id: "screen_markets",
    label: "Screen markets by your criteria",
    href: "/screener",
  },
  { id: "analyze_property", label: "Analyze a property", href: "/analyzer" },
  {
    id: "add_watchlist",
    label: "Save a market to your watchlist",
    href: "/market",
  },
] as const;
```

(The `create_account` auto-complete line in the component should be dropped from the `completed` seed, since it's no longer in the list: change `const completed = new Set([...completedTasks]);`.)

- [ ] **Step 4: Run it (passes), commit**

```bash
npm run test:unit -- ProgressChecklist
git add -A
git commit -m "feat(onboarding): value-framed checklist with Connect Claude + analyzer/screener/watchlist"
```

New checklist task ids (`read_report`, `connect_claude`, `screen_markets`, `analyze_property`, `add_watchlist`) are auto-completed by the P2 coverage signal (the return-surface/dashboard marks them as their events arrive). `updateChecklist` already accepts arbitrary ids — no backend change.

---

## Task 5: Bonus "Connect Claude" beat + E2E

**Files:**

- Modify: `app/(app)/tour/components/PersonaSpringboard.tsx` (hero already added in Task 3 — verify it links to `/docs/mcp`)
- Create: `packages/frontend/tests/e2e/tour-aha.spec.ts`

- [ ] **Step 1: E2E for the authenticated finale**

```ts
import { test, expect } from "@playwright/test";
import path from "path";

test.use({
  storageState: path.join(__dirname, "../fixtures/.auth/trial-user.json"),
});

test("authenticated finale shows the unwatermarked report + Connect Claude hero", async ({
  page,
}) => {
  await page.goto(
    "/tour?phase=step4&persona=investor&market=metro-39580&sessionId=e2e",
    { waitUntil: "load" },
  );
  await expect(page.getByText(/Demo report/i)).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Connect Claude/i }),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run it (dev servers up), commit**

```bash
npm run test:e2e -- tour-aha
git add -A
git commit -m "test(tour): e2e authenticated aha finale + Connect Claude hero"
```

---

## Self-Review

**Spec coverage (§5.3–§5.6):** Score interactive + Why steps → Task 1 ✓; report-as-finale de-watermarked → Task 2 ✓; persona springboard + MCP hero → Task 3 ✓; bonus Connect Claude → Tasks 3+5 ✓; value-framed checklist → Task 4 ✓.

**Placeholder scan:** none — every step has complete code. Visual polish is explicitly delegated to `frontend-design` (not a placeholder; the provided markup compiles and is brand-correct).

**Type consistency:** `Persona`/`MarketRef` imported from `@/lib/data` (matches `useTourFromUrl`'s `ActiveTour`); `PersonaSpringboard` props match its call in `Step4Aha`; new step ids are wired in `step-content.ts` + `useTourFromUrl.advance()` consistently.

**Dependency note:** requires P0 Part 1 (primitives under `tour/primitives/`, hence `../primitives/celebrations`) and P0 Part 2 (so "Pro unlocked" is true). New checklist auto-completion depends on P2's coverage events.
