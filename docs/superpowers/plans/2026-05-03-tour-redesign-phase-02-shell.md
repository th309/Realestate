# Activation Tour Redesign — Phase 02: Shell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/tour` route skeleton — anonymous-friendly entry, persona selection screen, market picker screen, three-tier state plumbing (URL params + cookie + localStorage), `/get-started` 308 redirect, and the auth-callback branch that routes incomplete users into the new tour.

**Architecture:** New Next.js App Router route at `app/tour/page.tsx` (client component, Suspense-wrapped). State held in a `TourStateProvider` context with three sources of truth: URL params (authoritative), `piq_tour_session` cookie (anon identity, 7-day), `piq_tour` localStorage (refresh-survival). Three rendered phases (`persona`, `market`, `running`) selected by the state machine. Redirect path: middleware rewrites `/get-started` → `/tour` with query-param preservation. Auth callback gains a single new branch.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, `@tanstack/react-query`, Supabase browser client, vitest + RTL.

**Spec:** [../specs/2026-05-03-activation-tour-redesign-design.md](../specs/2026-05-03-activation-tour-redesign-design.md)

**Depends on:** Phase 01 (the fetcher + hook in `@/lib/data` are imported here even though step 4 of the tour isn't built until Phase 04 — the shell phase only needs them imported, not invoked).

---

## File structure

**New (frontend):**

- `packages/frontend/app/tour/page.tsx`
- `packages/frontend/app/tour/types.ts`
- `packages/frontend/app/tour/TourStateProvider.tsx`
- `packages/frontend/app/tour/hooks/useTourSession.ts`
- `packages/frontend/app/tour/components/PersonaCards.tsx`
- `packages/frontend/app/tour/components/MarketPickerStep.tsx`
- `packages/frontend/app/tour/components/PersonaCard.tsx`
- `packages/frontend/app/tour/__tests__/TourStateProvider.test.tsx`
- `packages/frontend/app/tour/__tests__/useTourSession.test.ts`

**Modify:**

- `packages/frontend/middleware.ts` — add `/tour` to PROTECTED_PREFIXES carve-out (anonymous-friendly), add `/get-started` 308 redirect.
- `packages/frontend/app/auth/callback/page.tsx` — route incomplete users to `/tour` (replaces the `/get-started` branch added earlier this session).
- `packages/frontend/app/dashboard/page.tsx` — update "Take the tour" button href.
- `packages/frontend/app/onboarding/TourProvider.tsx` — `restartTourHandler` pushes `/tour?resume=fresh` instead of `/get-started`; `?resetTour=1` handler likewise.
- `packages/frontend/app/get-started/page.tsx` — convert to a thin redirect component (kept as a fallback for client-side navigation).

---

### Task 1: Tour types

**Files:**

- Create: `packages/frontend/app/tour/types.ts`

- [ ] **Step 1: Define the contracts**

```typescript
// packages/frontend/app/tour/types.ts
import type { MarketRef, Persona } from "@/lib/data";

export type TourPhase =
  | "persona"
  | "market"
  | "step1"
  | "step2"
  | "step3"
  | "step4"
  | "celebrate";

export interface TourSession {
  sessionId: string;
  persona: Persona | null;
  market: MarketRef | null;
  phase: TourPhase;
  reportId: string | null;
  startedAt: number;
}

export const STEP_ORDER: TourPhase[] = [
  "persona",
  "market",
  "step1",
  "step2",
  "step3",
  "step4",
  "celebrate",
];

export function nextPhase(current: TourPhase): TourPhase | null {
  const i = STEP_ORDER.indexOf(current);
  return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null;
}

export type { MarketRef, Persona };
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/types.ts
git commit -m "feat(tour): add tour types + STEP_ORDER"
```

---

### Task 2: useTourSession hook (cookie + localStorage + URL)

**Files:**

- Create: `packages/frontend/app/tour/hooks/useTourSession.ts`
- Create: `packages/frontend/app/tour/__tests__/useTourSession.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/app/tour/__tests__/useTourSession.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTourSession } from "../hooks/useTourSession";

const setSearchParams = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(globalThis.__params__ ?? ""),
  useRouter: () => ({ replace: setSearchParams }),
  usePathname: () => "/tour",
}));

describe("useTourSession", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie =
      "piq_tour_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    setSearchParams.mockReset();
    globalThis.__params__ = "";
  });

  it("mints a sessionId on first call and stores it in cookie + localStorage", () => {
    const { result } = renderHook(() => useTourSession());
    expect(result.current.session.sessionId).toBeTruthy();
    expect(document.cookie).toContain("piq_tour_session=");
    expect(JSON.parse(localStorage.getItem("piq_tour") ?? "{}").sessionId).toBe(
      result.current.session.sessionId,
    );
  });

  it("reuses an existing sessionId from cookie across renders", () => {
    document.cookie = "piq_tour_session=existing-uuid; path=/";
    const { result } = renderHook(() => useTourSession());
    expect(result.current.session.sessionId).toBe("existing-uuid");
  });

  it("hydrates persona + market from URL params on first render", () => {
    globalThis.__params__ = "persona=agent&market=cbsa-39580";
    const { result } = renderHook(() => useTourSession());
    expect(result.current.session.persona).toBe("agent");
    expect(result.current.session.market?.geoId).toBe("39580");
  });

  it("updates the URL on phase transition", () => {
    const { result } = renderHook(() => useTourSession());
    act(() => result.current.advanceTo("market"));
    expect(setSearchParams).toHaveBeenCalledWith(
      expect.stringContaining("phase=market"),
    );
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm run test -w packages/frontend -- useTourSession`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```typescript
// packages/frontend/app/tour/hooks/useTourSession.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { MarketRef, Persona, TourPhase, TourSession } from "../types";

const COOKIE_NAME = "piq_tour_session";
const STORAGE_KEY = "piq_tour";
const COOKIE_TTL_DAYS = 7;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const expires = new Date(
    Date.now() + COOKIE_TTL_DAYS * 86400_000,
  ).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; samesite=lax`;
}

function parseMarketParam(raw: string | null): MarketRef | null {
  if (!raw) return null;
  // Format: "<geoLevel>-<geoId>" e.g. "cbsa-39580" or just an identifier we resolve later
  const m = raw.match(/^([a-z]+)-(.+)$/);
  if (!m) return null;
  return { geoLevel: m[1] as MarketRef["geoLevel"], geoId: m[2], name: "" };
}

function loadFromStorage(): Partial<TourSession> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveToStorage(session: TourSession) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function useTourSession() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<TourSession>(() => {
    const stored = loadFromStorage();
    const sessionId =
      readCookie(COOKIE_NAME) ?? stored.sessionId ?? crypto.randomUUID();
    if (!readCookie(COOKIE_NAME)) writeCookie(COOKIE_NAME, sessionId);

    const personaParam = searchParams?.get("persona") as Persona | null;
    const marketParam = parseMarketParam(searchParams?.get("market") ?? null);
    const phaseParam = (searchParams?.get("phase") as TourPhase | null) ?? null;

    const next: TourSession = {
      sessionId,
      persona: personaParam ?? stored.persona ?? null,
      market: marketParam ?? stored.market ?? null,
      phase:
        phaseParam ??
        (personaParam ? (marketParam ? "step1" : "market") : "persona"),
      reportId: stored.reportId ?? null,
      startedAt: stored.startedAt ?? Date.now(),
    };
    saveToStorage(next);
    return next;
  });

  useEffect(() => {
    saveToStorage(session);
  }, [session]);

  const setPersona = useCallback(
    (persona: Persona) => {
      setSession((prev) => {
        const next = {
          ...prev,
          persona,
          phase: prev.market ? "step1" : ("market" as TourPhase),
        };
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set("persona", persona);
        params.set("phase", next.phase);
        router.replace(`${pathname}?${params}`);
        return next;
      });
    },
    [router, pathname, searchParams],
  );

  const setMarket = useCallback(
    (market: MarketRef) => {
      setSession((prev) => {
        const next: TourSession = { ...prev, market, phase: "step1" };
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set("market", `${market.geoLevel}-${market.geoId}`);
        params.set("phase", "step1");
        router.replace(`${pathname}?${params}`);
        return next;
      });
    },
    [router, pathname, searchParams],
  );

  const advanceTo = useCallback(
    (phase: TourPhase) => {
      setSession((prev) => {
        const next = { ...prev, phase };
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set("phase", phase);
        router.replace(`${pathname}?${params}`);
        return next;
      });
    },
    [router, pathname, searchParams],
  );

  const reset = useCallback(() => {
    if (typeof localStorage !== "undefined")
      localStorage.removeItem(STORAGE_KEY);
    document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    setSession({
      sessionId: crypto.randomUUID(),
      persona: null,
      market: null,
      phase: "persona",
      reportId: null,
      startedAt: Date.now(),
    });
  }, []);

  return useMemo(
    () => ({ session, setPersona, setMarket, advanceTo, reset }),
    [session, setPersona, setMarket, advanceTo, reset],
  );
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test -w packages/frontend -- useTourSession`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/tour/hooks/useTourSession.ts \
  packages/frontend/app/tour/__tests__/useTourSession.test.ts
git commit -m "feat(tour): add useTourSession hook (URL+cookie+localStorage)"
```

---

### Task 3: TourStateProvider context

**Files:**

- Create: `packages/frontend/app/tour/TourStateProvider.tsx`
- Create: `packages/frontend/app/tour/__tests__/TourStateProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/app/tour/__tests__/TourStateProvider.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TourStateProvider, useTour } from '../TourStateProvider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/tour',
}));

function Probe() {
  const { session } = useTour();
  return <div data-testid="phase">{session.phase}</div>;
}

describe('TourStateProvider', () => {
  it('provides initial session at persona phase by default', () => {
    render(<TourStateProvider><Probe /></TourStateProvider>);
    expect(screen.getByTestId('phase').textContent).toBe('persona');
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm run test -w packages/frontend -- TourStateProvider`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the provider**

```tsx
// packages/frontend/app/tour/TourStateProvider.tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTourSession } from "./hooks/useTourSession";

type TourContextValue = ReturnType<typeof useTourSession>;

const TourContext = createContext<TourContextValue | null>(null);

export function TourStateProvider({ children }: { children: ReactNode }) {
  const value = useTourSession();
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within <TourStateProvider>");
  return ctx;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test -w packages/frontend -- TourStateProvider`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/tour/TourStateProvider.tsx \
  packages/frontend/app/tour/__tests__/TourStateProvider.test.tsx
git commit -m "feat(tour): add TourStateProvider context"
```

---

### Task 4: PersonaCards UI

**Files:**

- Create: `packages/frontend/app/tour/components/PersonaCard.tsx`
- Create: `packages/frontend/app/tour/components/PersonaCards.tsx`

- [ ] **Step 1: Implement PersonaCard component**

```tsx
// packages/frontend/app/tour/components/PersonaCard.tsx
"use client";

import type { ReactNode } from "react";
import type { Persona } from "@/lib/data";

interface Props {
  persona: Persona;
  icon: string;
  title: string;
  tag: string;
  bullets: string[];
  priority?: boolean;
  onSelect: (p: Persona) => void;
}

export function PersonaCard({
  persona,
  icon,
  title,
  tag,
  bullets,
  priority,
  onSelect,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(persona)}
      className={[
        "group relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all",
        "hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(57,73,171,0.12)]",
        priority
          ? "border-primary bg-gradient-to-b from-white to-primary-container/30"
          : "border-outline-variant bg-white hover:border-primary/60",
      ].join(" ")}
      aria-label={`Continue tour as ${title}`}
    >
      {priority && (
        <span className="absolute right-3 top-3 rounded-md bg-[#00C853] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          For you
        </span>
      )}
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container text-2xl">
        {icon}
      </span>
      <span className="text-base font-semibold text-on-surface">{title}</span>
      <span className="text-xs text-on-surface-variant">{tag}</span>
      <ul className="space-y-1 text-xs text-on-surface-variant">
        {bullets.map((b) => (
          <li
            key={b}
            className="pl-4 before:absolute before:ml-[-12px] before:text-primary before:content-['→']"
          >
            {b}
          </li>
        ))}
      </ul>
      <span className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-on-primary group-hover:bg-primary-dark">
        Continue as {title.split(" ")[1] ?? persona} →
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Implement PersonaCards container**

```tsx
// packages/frontend/app/tour/components/PersonaCards.tsx
"use client";

import { useTour } from "../TourStateProvider";
import { PersonaCard } from "./PersonaCard";

export function PersonaCards() {
  const { setPersona } = useTour();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-on-surface md:text-3xl">
          What brings you to PropertyIQ?
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Pick the closest match. Your tour is tailored to what you're trying to
          do.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PersonaCard
          persona="agent"
          icon="🏠"
          title="I'm an agent / broker"
          tag="Tools that work with your clients today"
          bullets={[
            "Branded listing presentations",
            "Side-by-side market comparisons",
            "Shareable score cards for clients",
          ]}
          priority
          onSelect={setPersona}
        />
        <PersonaCard
          persona="investor"
          icon="📈"
          title="I'm an investor"
          tag="Find your next cashflow market"
          bullets={[
            "Cashflow + appreciation analytics",
            "Deal analyzer for any address",
            "Portfolio diversification scoring",
          ]}
          onSelect={setPersona}
        />
        <PersonaCard
          persona="homebuyer"
          icon="🔑"
          title="I'm a homebuyer"
          tag="Understand a market before you buy"
          bullets={[
            "Home values + 12-month forecast",
            "Schools, cost of living, affordability",
            "Rent vs. buy break-even",
          ]}
          onSelect={setPersona}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/tour/components/PersonaCard.tsx \
  packages/frontend/app/tour/components/PersonaCards.tsx
git commit -m "feat(tour): add PersonaCards screen"
```

---

### Task 5: MarketPickerStep with PIQ Score in suggestions

**Files:**

- Create: `packages/frontend/app/tour/components/MarketPickerStep.tsx`

- [ ] **Step 1: Implement (reuses existing useUniversalSearch)**

```tsx
// packages/frontend/app/tour/components/MarketPickerStep.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUniversalSearch } from "@/lib/search/useUniversalSearch";
import { useScoreData } from "@/lib/data";
import { useTour } from "../TourStateProvider";
import type { MarketRef } from "@/lib/data";

const FALLBACK_MARKETS: MarketRef[] = [
  {
    geoLevel: "metro",
    geoId: "16740",
    name: "Charlotte-Concord-Gastonia, NC-SC",
  },
  { geoLevel: "metro", geoId: "38060", name: "Phoenix-Mesa-Chandler, AZ" },
  {
    geoLevel: "metro",
    geoId: "45300",
    name: "Tampa-St. Petersburg-Clearwater, FL",
  },
];

export function MarketPickerStep() {
  const { setMarket } = useTour();
  const [query, setQuery] = useState("");
  const { results, isLoading } = useUniversalSearch({ query });

  const visible = useMemo(() => results.slice(0, 6), [results]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-on-surface md:text-3xl">
          What market matters most to you?
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Type your farm zip, county, or metro. We'll build a real listing
          presentation for it.
        </p>
      </header>

      <input
        autoFocus
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍  Cary, NC"
        className="w-full rounded-full border-2 border-outline-variant bg-white px-5 py-3.5 text-base shadow-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        aria-label="Search markets"
      />

      {visible.length > 0 && (
        <ul
          className="mt-3 overflow-hidden rounded-xl border border-outline-variant bg-white"
          role="listbox"
        >
          {visible.map((r) => (
            <SuggestionRow
              key={`${r.type}-${r.id}`}
              result={r}
              onSelect={() =>
                setMarket({
                  geoLevel: r.type as MarketRef["geoLevel"],
                  geoId: r.id,
                  name: r.name,
                })
              }
            />
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {FALLBACK_MARKETS.map((m) => (
          <button
            key={m.geoId}
            type="button"
            onClick={() => setMarket(m)}
            className="rounded-full border border-outline-variant bg-surface-container px-4 py-1.5 text-xs text-on-surface-variant hover:border-primary hover:bg-primary-container hover:text-primary-dark"
          >
            {m.name.split(",")[0]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMarket(FALLBACK_MARKETS[0])}
          className="rounded-full border border-outline-variant bg-surface-container px-4 py-1.5 text-xs text-on-surface-variant hover:border-primary hover:bg-primary-container hover:text-primary-dark"
        >
          Or skip — show me Charlotte
        </button>
      </div>

      {isLoading && (
        <p className="mt-4 text-center text-xs text-on-surface-variant">
          Searching…
        </p>
      )}
    </div>
  );
}

function SuggestionRow({
  result,
  onSelect,
}: {
  result: any;
  onSelect: () => void;
}) {
  const { data: score } = useScoreData(result.type, result.id);
  const chip = score
    ? scoreChip(score.score)
    : {
        bg: "bg-outline-variant/30",
        text: "text-on-surface-variant",
        label: "—",
      };

  return (
    <li role="option">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-4 border-b border-outline-variant/40 px-4 py-3 text-left last:border-b-0 hover:bg-primary-container/40"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-on-surface">
            {result.name}
          </p>
          <p className="truncate text-xs text-on-surface-variant">
            {result.subtitle ?? result.type}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${chip.bg} ${chip.text}`}
        >
          {chip.label}
        </span>
      </button>
    </li>
  );
}

function scoreChip(score: number) {
  if (score >= 80)
    return {
      bg: "bg-[#00C853]",
      text: "text-white",
      label: `${score} · GREAT`,
    };
  if (score >= 50)
    return { bg: "bg-[#FF8F00]", text: "text-white", label: `${score} · FAIR` };
  return { bg: "bg-[#B3261E]", text: "text-white", label: `${score} · POOR` };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/tour/components/MarketPickerStep.tsx
git commit -m "feat(tour): add MarketPickerStep with live PIQ Score in suggestions"
```

---

### Task 6: /tour page (the route)

**Files:**

- Create: `packages/frontend/app/tour/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
// packages/frontend/app/tour/page.tsx
"use client";

import { Suspense } from "react";
import { TourStateProvider, useTour } from "./TourStateProvider";
import { PersonaCards } from "./components/PersonaCards";
import { MarketPickerStep } from "./components/MarketPickerStep";

export default function TourPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-on-surface-variant">
          Loading tour…
        </div>
      }
    >
      <TourStateProvider>
        <TourPhaseSwitch />
      </TourStateProvider>
    </Suspense>
  );
}

function TourPhaseSwitch() {
  const { session } = useTour();
  switch (session.phase) {
    case "persona":
      return <PersonaCards />;
    case "market":
      return <MarketPickerStep />;
    case "step1":
    case "step2":
    case "step3":
    case "step4":
      // Phase 03 / Phase 04 will fill these in. For now, render a placeholder
      // that lets us verify routing + state plumbing work end-to-end.
      return (
        <div className="mx-auto max-w-xl px-4 py-12 text-center">
          <p className="text-sm uppercase tracking-wide text-on-surface-variant">
            Phase 03/04 placeholder
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-on-surface">
            Step "{session.phase}" lands here.
          </h1>
          <p className="mt-3 text-sm text-on-surface-variant">
            persona: {session.persona ?? "none"} · market:{" "}
            {session.market?.name ?? "none"}
          </p>
        </div>
      );
    case "celebrate":
      return (
        <div className="mx-auto max-w-xl px-4 py-12 text-center">
          <p className="text-2xl font-semibold text-on-surface">
            🎉 Phase 05 placeholder — celebrate screen lands here.
          </p>
        </div>
      );
    default:
      return <PersonaCards />;
  }
}
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev:fresh
# In browser: http://localhost:3000/tour
# Expected: persona cards render. Click an option. Market picker renders.
# Pick a market. Placeholder for "step1" renders with persona + market visible.
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/tour/page.tsx
git commit -m "feat(tour): add /tour route with phase switch"
```

---

### Task 7: Middleware update — `/tour` public, `/get-started` 308

**Files:**

- Modify: `packages/frontend/middleware.ts`

- [ ] **Step 1: Read the existing middleware**

```bash
sed -n '14,24p' packages/frontend/middleware.ts
```

You'll see `PROTECTED_PREFIXES` includes `/get-started`. We need to remove it (becomes a redirect) and explicitly NOT add `/tour` (anonymous-friendly by default).

- [ ] **Step 2: Modify the middleware**

In `packages/frontend/middleware.ts`:

Replace:

```typescript
const PROTECTED_PREFIXES = [
  "/account",
  "/dashboard",
  "/alerts",
  "/reports",
  "/admin",
  "/upgrade",
  "/get-started",
];
```

with:

```typescript
const PROTECTED_PREFIXES = [
  "/account",
  "/dashboard",
  "/alerts",
  "/reports",
  "/admin",
  "/upgrade",
];
```

Then, before the protected-path check (around line 127, after `const { pathname } = request.nextUrl;`), add:

```typescript
// Permanent redirect: /get-started → /tour, preserving query params.
if (pathname === "/get-started" || pathname.startsWith("/get-started/")) {
  const url = request.nextUrl.clone();
  url.pathname = "/tour";
  return NextResponse.redirect(url, 308);
}
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev:fresh
curl -I http://localhost:3000/get-started
# Expected: HTTP/1.1 308 with Location: /tour
curl -I "http://localhost:3000/get-started?next=/reports"
# Expected: HTTP/1.1 308 with Location: /tour?next=/reports
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/middleware.ts
git commit -m "feat(tour): 308 redirect /get-started → /tour, /tour stays public"
```

---

### Task 8: Convert `/get-started/page.tsx` to a client-side fallback redirect

**Why:** The middleware handles server-side redirect, but if the route is hit via client-side `router.push('/get-started')` (which doesn't go through middleware in some cases), we need a fallback.

**Files:**

- Modify: `packages/frontend/app/get-started/page.tsx`

- [ ] **Step 1: Replace the file's contents**

```tsx
// packages/frontend/app/get-started/page.tsx
import { redirect } from "next/navigation";

export default async function GetStartedRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const target = qs.toString() ? `/tour?${qs}` : "/tour";
  redirect(target);
}
```

This deletes the persona+market wizard. Old `OnboardingSearch.tsx` and `PersonaCards.tsx` files inside `app/get-started/` are now unused; leave them in place — they will be deleted in Phase 06 cleanup once we're confident nothing imports them.

- [ ] **Step 2: Smoke test**

```bash
# Visit /get-started in browser, expect immediate redirect to /tour.
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/get-started/page.tsx
git commit -m "feat(tour): convert /get-started page to /tour redirect"
```

---

### Task 9: Auth callback routes incomplete users to `/tour`

**Files:**

- Modify: `packages/frontend/app/auth/callback/page.tsx`

- [ ] **Step 1: Read current state**

The earlier session edit at lines 130-160 currently routes `needsOnboarding` users to `/get-started`. The middleware redirect would catch this, but it's cleaner to update the callback directly.

- [ ] **Step 2: Edit the destination logic**

Find the block (around line 154-163):

```typescript
const destination = needsOnboarding
  ? explicitNext
    ? `/get-started?next=${encodeURIComponent(explicitNext)}`
    : "/get-started"
  : next;
```

Replace with:

```typescript
const destination = needsOnboarding
  ? explicitNext
    ? `/tour?next=${encodeURIComponent(explicitNext)}`
    : "/tour"
  : next;
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/auth/callback/page.tsx
git commit -m "feat(auth): callback routes incomplete users to /tour (was /get-started)"
```

---

### Task 10: Dashboard "Take the tour" button → `/tour?resume=fresh`

**Files:**

- Modify: `packages/frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Update the button**

In `packages/frontend/app/dashboard/page.tsx`, locate the button shipped earlier this session:

```tsx
<button
  onClick={restartTour}
  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
>
  <RotateCcw className="w-3.5 h-3.5" />
  Take the tour
</button>
```

Replace with:

```tsx
<a
  href="/tour?resume=fresh"
  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
>
  <RotateCcw className="w-3.5 h-3.5" />
  Take the tour
</a>
```

(The `useTour()` import + the `restartTour` destructure are no longer needed; remove the now-unused import and variable to keep the file clean.)

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/dashboard/page.tsx
git commit -m "feat(dashboard): Take the tour button points to /tour?resume=fresh"
```

---

### Task 11: TourProvider `restartTourHandler` → `/tour`

**Files:**

- Modify: `packages/frontend/app/onboarding/TourProvider.tsx`

- [ ] **Step 1: Update the existing handler**

Find:

```typescript
const restartTourHandler = useCallback(() => {
  resetTour();
  setStepIndex(0);
  router.push("/get-started");
}, [resetTour, router]);
```

Replace with:

```typescript
const restartTourHandler = useCallback(() => {
  resetTour();
  setStepIndex(0);
  router.push("/tour?resume=fresh");
}, [resetTour, router]);
```

Also find the `?resetTour=1` handler (added earlier this session) at:

```typescript
useEffect(() => {
  if (searchParams?.get("resetTour") !== "1") return;
  resetTour();
  setStepIndex(0);
  router.replace("/get-started");
}, [searchParams, resetTour, router]);
```

Replace `/get-started` with `/tour?resume=fresh`.

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/onboarding/TourProvider.tsx
git commit -m "feat(onboarding): legacy restartTour now routes to /tour"
```

---

### Task 12: Resume detection (`?resume=fresh`)

**Files:**

- Modify: `packages/frontend/app/tour/hooks/useTourSession.ts`

- [ ] **Step 1: Add resume handling at hook init**

In the `useState` initializer, BEFORE reading the cookie, add:

```typescript
const resumeMode = searchParams?.get("resume");
if (resumeMode === "fresh" && typeof localStorage !== "undefined") {
  localStorage.removeItem(STORAGE_KEY);
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
```

Then strip `resume` from the URL via `router.replace` at end of init.

- [ ] **Step 2: Smoke test**

```bash
# Visit /tour, complete persona + market.
# Visit /tour?resume=fresh.
# Expected: persona cards re-appear (state cleared).
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/tour/hooks/useTourSession.ts
git commit -m "feat(tour): handle ?resume=fresh by clearing local state"
```

---

### Task 13: Manual smoke test — full Phase 02 walkthrough

- [ ] **Step 1: Restart dev**

```bash
# Per memory rule: kill all node, single instance dev:fresh.
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
npm run dev:fresh
```

- [ ] **Step 2: Verify each route**

Open each in the browser, confirm the expected behavior:

- `http://localhost:3000/tour` — persona cards appear.
- Click "Continue as agent" — URL updates to `/tour?persona=agent&phase=market`. Market picker appears.
- Type "Cary" — typeahead suggestions appear, each with a colored PIQ Score chip (real backend call, requires backend running).
- Click a result — URL updates to `/tour?persona=agent&market=cbsa-39580&phase=step1`. Phase 03 placeholder renders.
- `http://localhost:3000/get-started` — redirects to `/tour`.
- `http://localhost:3000/get-started?next=/reports` — redirects to `/tour?next=/reports`.
- `http://localhost:3000/dashboard` — "Take the tour" button shows; clicking it navigates to `/tour?resume=fresh`, then state clears, persona cards render.

- [ ] **Step 3: Commit any remaining cleanup**

If you spot anything during smoke test:

```bash
git add ...
git commit -m "fix(tour): <observation>"
```

---

## Acceptance criteria for Phase 02 done

- [ ] Visiting `/tour` with no params shows persona cards.
- [ ] Selecting a persona shows market picker; URL reflects `?persona=<x>`.
- [ ] Selecting a market lands on a placeholder for step 1; URL reflects `?market=<level>-<id>&phase=step1`.
- [ ] Refreshing mid-tour preserves state (URL params + localStorage round-trip).
- [ ] `/get-started` returns 308 to `/tour` (verified via `curl -I`).
- [ ] Auth callback for `needsOnboarding=true` users redirects to `/tour`.
- [ ] Dashboard "Take the tour" button navigates to `/tour?resume=fresh`.
- [ ] `?resume=fresh` clears local state (cookie + localStorage).
- [ ] All Phase 02 vitest specs pass.
- [ ] No new TypeScript errors in changed files.
