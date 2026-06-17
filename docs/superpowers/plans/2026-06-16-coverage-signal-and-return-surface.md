# Feature-Coverage Signal, Instrumentation & Return-Surface — Implementation Plan (P2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the one **feature-coverage signal** — "what has this user done / not done?" — that powers the checklist auto-completion, the return-visit surface, and the email drip. Instrument the currently-untracked features so the signal can see them, then render the dashboard "next best move + what's new" surface.

**Architecture:** Frontend feature actions emit `feature.*` events via the existing `trackEvent` (→ `POST /api/usage/events` → `user_events`). MCP connection is detected from the `mcp_oauth_tokens` table. A thin backend endpoint `GET /api/usage/coverage` returns the user's used-feature set + `mcpConnected`. A **pure** `deriveCoverage()` merges that with `onboarding_checklist` + `usage_stats` into a per-feature map and a persona-weighted `recommendedNext`. The dashboard renders a `NextBestActionCard` from that signal and auto-marks completed checklist tasks.

**Tech Stack:** Next.js, React 19, Tailwind 4, Vitest (frontend), NestJS + Jest (backend), Supabase. Frontend cmds from `packages/frontend`, backend from `packages/backend`.

**Dependencies:** P1 (the extended checklist task ids: `analyze_property`, `screen_markets`, `add_watchlist`, `compare_markets`, `connect_claude`, `read_report`, `view_score`). Reuses: `trackEvent` (`lib/analytics/tracker.ts`), `user_events` (`scripts/migrations/113`), `mcp_oauth_tokens` (`scripts/migrations/133`), `fetchOnboardingState`, `updateChecklistTask`.

---

## Task 1: Instrument the untracked frontend features

**Files:**

- Modify: `app/(app)/analyzer/lib/use-grading-result.ts`
- Modify: `app/(app)/screener/ScreenerPageInner.tsx`
- Modify: `app/(app)/graphs/components/GraphsPageV2/GraphsPageV2.tsx`
- Modify: `lib/data/fetchers/watchlist.ts`
- Test: `app/(app)/analyzer/lib/__tests__/use-grading-result.telemetry.test.ts`

All emit via `trackEvent` so they land in `user_events` (the coverage source). Pattern to mirror — the existing `feature.map_filter` call in `app/(app)/map/page.tsx:199`.

- [ ] **Step 1: Write a failing test for the analyzer event**

```ts
import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/analytics/tracker", () => ({ trackEvent: vi.fn() }));
import { trackEvent } from "@/lib/analytics/tracker";
import { emitGradeCoverageEvent } from "../use-grading-result";

it("emits feature.analyzer_grade once per gradable submit", () => {
  emitGradeCoverageEvent({ strategy: "buy_hold", hasRent: true });
  expect(trackEvent).toHaveBeenCalledWith("feature.analyzer_grade", {
    strategy: "buy_hold",
    hasRent: true,
  });
});
```

- [ ] **Step 2: Run it (fails)**

```bash
npm run test:unit -- use-grading-result.telemetry
```

Expected: FAIL (`emitGradeCoverageEvent` not exported).

- [ ] **Step 3: Add the emit helper + fire it when grading is enabled**

In `use-grading-result.ts`, export a tiny helper and call it when a gradable query first enables (guard against repeat with a ref):

```ts
import { trackEvent } from "@/lib/analytics/tracker";

export function emitGradeCoverageEvent(props: {
  strategy: string;
  hasRent: boolean;
}) {
  trackEvent("feature.analyzer_grade", props);
}
```

In the hook body, where `hasGradableInput && activeStrategy` first becomes true, fire it once:

```ts
const firedRef = useRef(false);
useEffect(() => {
  if (hasGradableInput && !firedRef.current) {
    firedRef.current = true;
    emitGradeCoverageEvent({
      strategy: String(activeStrategy),
      hasRent: (input.rentMonthly ?? 0) > 0,
    });
  }
}, [hasGradableInput, activeStrategy, input.rentMonthly]);
```

- [ ] **Step 4: Add the other three emits (no new tests — mirror the pattern)**

Screener — in `ScreenerPageInner.tsx` `handleFilterChange` (line ~166): `trackEvent("feature.screener_filter", { keys: Object.keys(patch) });`
Graphs — in `GraphsPageV2.tsx` chart point click (line ~604): `trackEvent("feature.graphs_view", { chart_type: chartType });`
Watchlist — in `lib/data/fetchers/watchlist.ts` `addToWatchlist`, after a successful response: `trackEvent("feature.watchlist_add", { geography_type: dto.geography_type });` (import `trackEvent`).

- [ ] **Step 5: Run tests + build, commit**

```bash
npm run test:unit -- use-grading-result.telemetry
npm run build
git add -A
git commit -m "feat(analytics): instrument analyzer/screener/graphs/watchlist for feature coverage"
```

---

## Task 2: Emit an MCP-connected event on OAuth token creation

**Files:**

- Modify: `packages/mcp-server/src/lib/oauth/tokens.ts` (after the insert succeeds)

The persisted signal is `mcp_oauth_tokens` (queried in Task 3). We also emit a one-time `feature.mcp_connected` event so the drip/return-surface can react immediately.

- [ ] **Step 1: Emit after a successful token insert**

In `createTokens()` (after the `if (error)` guard, before `return`):

```ts
// Best-effort coverage signal — never block token issuance.
try {
  const apiUrl =
    process.env.PIQ_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001";
  await fetch(`${apiUrl}/api/usage/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events: [
        {
          visitor_id: userId,
          session_id: `mcp-${clientId}`,
          user_id: userId,
          event_category: "feature",
          event_action: "mcp_connected",
          properties: { client_id: clientId },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
} catch {
  /* ignore */
}
```

- [ ] **Step 2: Build the mcp-server, commit**

```bash
cd packages/mcp-server && npm run build
git add -A
git commit -m "feat(mcp): emit feature.mcp_connected coverage event on OAuth token creation"
```

(Verification is integration: connect Claude in a test env and confirm a `mcp_connected` row in `user_events` + a row in `mcp_oauth_tokens`.)

---

## Task 3: Backend coverage endpoint

**Files:**

- Create: `packages/backend/src/usage/usage-coverage.controller.ts`
- Create: `packages/backend/src/usage/usage-coverage.service.ts`
- Modify: the owning module to register them (e.g. `packages/backend/src/onboarding/onboarding.module.ts` or a new `UsageModule` — follow the existing module pattern)
- Create: `packages/backend/src/usage/__tests__/usage-coverage.service.spec.ts`

- [ ] **Step 1: Write the failing service test (pure logic only)**

The service's only non-trivial logic is mapping raw rows → a deduped used-feature set + connected flag. Extract that into a pure static method and test it.

```ts
import { UsageCoverageService } from "../usage-coverage.service";

describe("UsageCoverageService.toCoverage", () => {
  it("dedupes feature actions and reports mcpConnected", () => {
    const out = UsageCoverageService.toCoverage(
      [
        { event_action: "analyzer_grade" },
        { event_action: "analyzer_grade" },
        { event_action: "screener_filter" },
      ],
      /* hasMcpToken */ true,
    );
    expect(out.usedFeatures.sort()).toEqual([
      "analyzer_grade",
      "screener_filter",
    ]);
    expect(out.mcpConnected).toBe(true);
  });
});
```

- [ ] **Step 2: Run it (fails)**

```bash
cd packages/backend && npx jest usage-coverage
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement the service**

```ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service"; // match the existing import used by other services

export interface CoverageResult {
  usedFeatures: string[];
  mcpConnected: boolean;
}

@Injectable()
export class UsageCoverageService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Pure: rows + token flag → coverage. Unit-tested. */
  static toCoverage(
    rows: { event_action: string }[],
    hasMcpToken: boolean,
  ): CoverageResult {
    return {
      usedFeatures: [...new Set(rows.map((r) => r.event_action))],
      mcpConnected: hasMcpToken,
    };
  }

  async getCoverage(userId: string): Promise<CoverageResult> {
    const client = this.supabase.getClient();
    const [{ data: events }, { data: tokens }] = await Promise.all([
      client
        .from("user_events")
        .select("event_action")
        .eq("user_id", userId)
        .eq("event_category", "feature"),
      client
        .from("mcp_oauth_tokens")
        .select("id")
        .eq("user_id", userId)
        .eq("revoked", false)
        .gt("refresh_expires_at", new Date().toISOString())
        .limit(1),
    ]);
    return UsageCoverageService.toCoverage(
      events ?? [],
      (tokens ?? []).length > 0,
    );
  }
}
```

(Confirm the exact `SupabaseService` import path + `getClient()` accessor by matching a neighbouring service such as `entitlements.service.ts`.)

- [ ] **Step 4: Implement the controller**

```ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"; // match existing guard path
import { AuthUserId } from "../common/decorators/auth-user-id.decorator"; // match existing decorator
import { UsageCoverageService } from "./usage-coverage.service";

@UseGuards(JwtAuthGuard)
@Controller("api/usage")
export class UsageCoverageController {
  constructor(private readonly coverage: UsageCoverageService) {}

  @Get("coverage")
  async get(@AuthUserId() userId: string) {
    return { success: true, data: await this.coverage.getCoverage(userId) };
  }
}
```

Register both in the chosen module's `controllers`/`providers`.

- [ ] **Step 5: Run the test + backend build, commit**

```bash
cd packages/backend && npx jest usage-coverage && npm run build
git add -A
git commit -m "feat(usage): GET /api/usage/coverage — used features + mcpConnected"
```

---

## Task 4: Frontend coverage module (the signal)

**Files:**

- Create: `packages/frontend/lib/coverage/feature-coverage.ts`
- Create: `packages/frontend/lib/coverage/useFeatureCoverage.ts`
- Create: `packages/frontend/lib/coverage/__tests__/feature-coverage.test.ts`

- [ ] **Step 1: Write the failing pure-logic test**

```ts
import { describe, it, expect } from "vitest";
import { deriveCoverage, FEATURES } from "../feature-coverage";

it("marks used features and recommends the highest-value unused one (investor)", () => {
  const cov = deriveCoverage({
    persona: "investor",
    usedFeatures: ["screener_filter"], // → screener used
    mcpConnected: false,
    checklist: ["view_score"],
    usageStats: { markets_viewed: 1, scores_checked: 1, reports_generated: 0 },
  });
  expect(cov.byFeature.screener.used).toBe(true);
  expect(cov.byFeature.score.used).toBe(true);
  expect(cov.byFeature.mcp.used).toBe(false);
  // Investor priority leads with mcp (never used) then analyzer.
  expect(cov.recommendedNext).toBe("mcp");
});

it("returns null recommendation when everything is covered", () => {
  const all = FEATURES.reduce(
    (a, f) => ((a[mapToEvent(f)] = true), a),
    {} as Record<string, boolean>,
  );
  void all;
  const cov = deriveCoverage({
    persona: "investor",
    usedFeatures: [
      "analyzer_grade",
      "screener_filter",
      "graphs_view",
      "watchlist_add",
      "compare",
      "report",
    ],
    mcpConnected: true,
    checklist: ["view_score", "read_report", "compare_markets"],
    usageStats: { markets_viewed: 5, scores_checked: 5, reports_generated: 2 },
  });
  expect(cov.recommendedNext).toBeNull();
});

function mapToEvent(f: string) {
  return f;
}
```

- [ ] **Step 2: Run it (fails)**

```bash
npm run test:unit -- feature-coverage
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement the pure module**

```ts
import type { Persona } from "@/lib/data";

export type Feature =
  | "score"
  | "mcp"
  | "analyzer"
  | "screener"
  | "compare"
  | "watchlist"
  | "graphs"
  | "report";
export const FEATURES: Feature[] = [
  "score",
  "mcp",
  "analyzer",
  "screener",
  "compare",
  "watchlist",
  "graphs",
  "report",
];

// Maps a feature to the event_action(s) / checklist ids / stats that prove use.
const EVENT_OF: Partial<Record<Feature, string>> = {
  analyzer: "analyzer_grade",
  screener: "screener_filter",
  graphs: "graphs_view",
  watchlist: "watchlist_add",
  compare: "compare",
  report: "report",
  mcp: "mcp_connected",
};

export interface CoverageInput {
  persona: Persona | null;
  usedFeatures: string[]; // event_actions from /api/usage/coverage
  mcpConnected: boolean;
  checklist: string[]; // onboarding_checklist
  usageStats: {
    markets_viewed: number;
    scores_checked: number;
    reports_generated: number;
  } | null;
}

export interface Coverage {
  byFeature: Record<Feature, { used: boolean }>;
  recommendedNext: Feature | null;
}

const PRIORITY: Record<Persona | "default", Feature[]> = {
  investor: [
    "mcp",
    "analyzer",
    "screener",
    "compare",
    "watchlist",
    "graphs",
    "report",
  ],
  agent: [
    "mcp",
    "compare",
    "report",
    "screener",
    "watchlist",
    "analyzer",
    "graphs",
  ],
  homebuyer: [
    "mcp",
    "analyzer",
    "compare",
    "watchlist",
    "screener",
    "graphs",
    "report",
  ],
  default: [
    "mcp",
    "analyzer",
    "screener",
    "compare",
    "watchlist",
    "graphs",
    "report",
  ],
};

export function deriveCoverage(input: CoverageInput): Coverage {
  const used = new Set(input.usedFeatures);
  const stats = input.usageStats ?? {
    markets_viewed: 0,
    scores_checked: 0,
    reports_generated: 0,
  };

  const isUsed = (f: Feature): boolean => {
    if (f === "score")
      return (
        (stats.scores_checked ?? 0) > 0 ||
        input.checklist.includes("view_score")
      );
    if (f === "mcp") return input.mcpConnected || used.has("mcp_connected");
    if (f === "compare")
      return (
        input.checklist.includes("compare_markets") ||
        (stats.markets_viewed ?? 0) >= 2 ||
        used.has("compare")
      );
    if (f === "report")
      return (
        (stats.reports_generated ?? 0) > 0 ||
        input.checklist.includes("generate_report") ||
        input.checklist.includes("read_report") ||
        used.has("report")
      );
    const ev = EVENT_OF[f];
    return ev ? used.has(ev) : false;
  };

  const byFeature = FEATURES.reduce(
    (acc, f) => ((acc[f] = { used: isUsed(f) }), acc),
    {} as Coverage["byFeature"],
  );
  const order = PRIORITY[input.persona ?? "default"] ?? PRIORITY.default;
  const recommendedNext = order.find((f) => !byFeature[f].used) ?? null;
  return { byFeature, recommendedNext };
}
```

- [ ] **Step 4: Add the hook (glue)**

```ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchOnboardingState } from "@/lib/data";
import { getAuthHeaders } from "@/lib/..."; // match how other fetchers get headers
import { API_URL } from "@/lib/...";
import { deriveCoverage, type Coverage } from "./feature-coverage";
import type { Persona } from "@/lib/data";

async function fetchCoverage(): Promise<{
  usedFeatures: string[];
  mcpConnected: boolean;
}> {
  const res = await fetch(`${API_URL}/api/usage/coverage`, {
    headers: await getAuthHeaders(),
    credentials: "include",
  });
  if (!res.ok) return { usedFeatures: [], mcpConnected: false };
  return (await res.json()).data;
}

export function useFeatureCoverage(persona: Persona | null): Coverage | null {
  const onboarding = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: fetchOnboardingState,
    staleTime: 1000 * 60 * 60 * 2,
  });
  const cov = useQuery({
    queryKey: ["usage-coverage"],
    queryFn: fetchCoverage,
    staleTime: 1000 * 60 * 10,
  });
  if (!cov.data || !onboarding.data) return null;
  return deriveCoverage({
    persona,
    usedFeatures: cov.data.usedFeatures,
    mcpConnected: cov.data.mcpConnected,
    checklist: onboarding.data.onboarding_checklist ?? [],
    usageStats: onboarding.data.usage_stats ?? null,
  });
}
```

(Resolve the `getAuthHeaders`/`API_URL` import paths from an existing fetcher, e.g. `lib/entitlements/api.ts`.)

- [ ] **Step 5: Run the pure test, commit**

```bash
npm run test:unit -- feature-coverage
git add -A
git commit -m "feat(coverage): pure feature-coverage signal + react-query hook"
```

---

## Task 5: Return-visit surface on the dashboard

**Files:**

- Create: `app/(app)/dashboard/components/NextBestActionCard.tsx`
- Create: `app/(app)/dashboard/components/__tests__/NextBestActionCard.test.tsx`
- Modify: `app/(app)/dashboard/page.tsx` (mount after `<TrialExpirationBanner>`)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextBestActionCard } from "../NextBestActionCard";

it("renders the recommended feature's CTA and deep-link", () => {
  render(<NextBestActionCard recommended="analyzer" whatsNew={null} />);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/analyzer");
  expect(screen.getByText(/Underwrite a real deal/i)).toBeInTheDocument();
});

it("renders nothing when there's no recommendation", () => {
  const { container } = render(
    <NextBestActionCard recommended={null} whatsNew={null} />,
  );
  expect(container.firstChild).toBeNull();
});
```

- [ ] **Step 2: Run it (fails)**

```bash
npm run test:unit -- NextBestActionCard
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement the card**

```tsx
"use client";
import Link from "next/link";
import type { Feature } from "@/lib/coverage/feature-coverage";

const COPY: Record<Feature, { title: string; sub: string; href: string }> = {
  mcp: {
    title: "Use PropertyIQ inside Claude",
    sub: "Connect once — ask about any market in plain English. Only on PropertyIQ.",
    href: "/docs/mcp",
  },
  analyzer: {
    title: "Underwrite a real deal",
    sub: "Cap rate, cashflow & CoC on any address in ~10 seconds.",
    href: "/analyzer",
  },
  screener: {
    title: "Find your next market",
    sub: "Rank every market by score, cap rate, supply — your criteria.",
    href: "/screener",
  },
  compare: {
    title: "Compare to a peer",
    sub: "See your market vs. its closest comparable, side by side.",
    href: "/compare/markets",
  },
  watchlist: {
    title: "Build your watchlist",
    sub: "Track markets and get their monthly moves.",
    href: "/market",
  },
  graphs: {
    title: "Explore the data visually",
    sub: "Plot any metric across every market.",
    href: "/graphs",
  },
  report: {
    title: "Generate an AI report",
    sub: "A client-ready market brief in one click.",
    href: "/reports",
  },
  score: {
    title: "Check a market's Score",
    sub: "Your 0–100 demand signal.",
    href: "/market",
  },
};

export function NextBestActionCard({
  recommended,
  whatsNew,
}: {
  recommended: Feature | null;
  whatsNew: string | null;
}) {
  if (!recommended) return null;
  const c = COPY[recommended];
  return (
    <div className="rounded-2xl border border-primary/40 bg-primary-container/30 p-5">
      <div className="text-xs uppercase tracking-wide text-on-surface-variant mb-1">
        Your next best move
      </div>
      <Link href={c.href} className="block">
        <div className="text-lg font-semibold text-on-surface">{c.title}</div>
        <div className="text-sm text-on-surface-variant mt-0.5">{c.sub}</div>
      </Link>
      {whatsNew && (
        <div className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
          <span className="inline-block h-2 w-2 rounded-full bg-tertiary" />
          <span>
            <strong>New since you left:</strong> {whatsNew}
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount it on the dashboard**

In `app/(app)/dashboard/page.tsx`, after `<TrialExpirationBanner ... />` and before `<ProgressChecklist ... />`:

```tsx
import { useFeatureCoverage } from "@/lib/coverage/useFeatureCoverage";
import { NextBestActionCard } from "./components/NextBestActionCard";
// inside the component:
const coverage = useFeatureCoverage(
  (onboardingState?.user_type as any) ?? null,
);
// in JSX:
{
  coverage && (
    <NextBestActionCard
      recommended={coverage.recommendedNext}
      whatsNew={null}
    />
  );
}
```

(`whatsNew` can stay `null` for v1; a follow-up wires fresh-data detection.)

- [ ] **Step 5: Run test + build, commit**

```bash
npm run test:unit -- NextBestActionCard
npm run build
git add -A
git commit -m "feat(dashboard): next-best-move return surface driven by the coverage signal"
```

---

## Self-Review

**Spec coverage (§5.7–§5.9):** coverage signal module → Task 4 ✓; instrumentation of analyzer/screener/watchlist/graphs/MCP → Tasks 1–2 ✓; backend coverage read → Task 3 ✓; return-surface (next-best-move + what's-new placeholder wiring) → Task 5 ✓.

**Placeholder scan:** none. `whatsNew={null}` is an explicit, working v1 state (the prop and rendering exist), not a TODO.

**Type consistency:** `Feature` type defined in Task 4 is consumed by Task 5's card `COPY`; `deriveCoverage` input shape matches the hook's call; `CoverageResult` from the backend (Task 3) matches `fetchCoverage`'s return used by the hook. Event action strings (`analyzer_grade`, `screener_filter`, `graphs_view`, `watchlist_add`, `mcp_connected`) are identical across emit (Tasks 1–2), backend (Task 3), and `EVENT_OF`/`isUsed` (Task 4).

**Import-path caveats (resolve from neighbours during execution):** `SupabaseService`/`JwtAuthGuard`/`AuthUserId` paths (mirror `entitlements.service.ts` / an existing authed controller); `getAuthHeaders`/`API_URL` (mirror `lib/entitlements/api.ts`). These are real symbols already used widely — not placeholders, just path confirmation.

**Dependency:** the checklist auto-completion uses the P1 task ids; the drip's skip-used (P3) reads the same `feature.*` events this plan emits.
