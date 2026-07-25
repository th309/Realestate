# Site Navigation Fixes (Workstream A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair fourteen "dead tap" / orphaned-page / broken-CTA navigation defects, build the Screener row action menu (row-tap navigation + a kebab menu with Favorite / View on Map / Generate Report / Set Alert), fix PropertyIQ-Score alert evaluation in the backend, and delete two confirmed dead-code subgraphs.

**Architecture:** Next.js 16 App Router frontend (`packages/frontend`, all routes under the `app/(app)/` group) + NestJS 11 backend (`packages/backend`). Frontend data access flows through the `@/lib/data` barrel; watchlist is the one sanctioned standalone hook (`@/lib/watchlist/useWatchlist`). Each fix is an isolated task; the Screener feature is a four-task sequence (backend alert branch → alert sub-step component → row menu → table integration) because the menu must exist before the table mounts it. The two deletion passes run last.

**Tech Stack:** Next.js 16 / React 19 / Tailwind 4 / lucide-react; NestJS 11 / Supabase (`@supabase/supabase-js`); frontend tests: Vitest 4 + `@testing-library/react`; backend tests: Jest 30 + `@nestjs/testing`.

## Global Constraints

Every task's requirements implicitly include this section (copied from `CLAUDE.md` §1.1–1.4, §5, §9):

- **Data fetching:** ALL frontend data access goes through the `@/lib/data` barrel (fetchers + hooks). NEVER call raw `fetch(${API_URL}/...)` in components. ESLint blocks `lib/api/client*`. The single sanctioned exception is the watchlist hook `@/lib/watchlist/useWatchlist` (a documented standalone live feature).
- **Metric formatting SSOT:** NEVER format metric values by hand or duplicate metric names/formats. Use `formatMetricValue`, `getMetricTitle`, `getMetricFormat` from `@/lib/data`. `app/map/config/metrics.ts` is the only source of truth for metric metadata.
- **File-size limits:** React components target <300 lines / hard limit 400; logic files (hooks/utils) target <200 / hard 300; test files target <400 / hard 500. Split at the hard limit.
- **Input validation:** Every backend endpoint MUST validate its body with `class-validator` DTOs (this workstream adds one endpoint — it gets a DTO).
- **No secret fallbacks:** NEVER hardcode fallback values for secrets/config; the app must crash if a required secret is missing.
- **Human-readable names:** Every file, function, variable, and test name must be descriptive and self-explanatory.
- **Backend metric resolution:** Ad-hoc metric _fallback chains_ must go through `MetricResolutionService`. NOTE for Task 15: adding a `propertyiq_score` branch to the alert cron's `fetchCurrentMetricValue()` is metric-_table routing_ for the daily alert evaluator (the same shape as its existing `calculated_metrics` read), NOT a resolution fallback chain — it intentionally stays in `alert-processor.service.ts` and does not belong in `MetricResolutionService`.

---

### Task 1: Remove the dead "AI Assist" floating action button (Report Builder)

**Files:**

- Modify: `packages/frontend/app/(app)/reports/builder/Builder.tsx:28` (drop the unused `Sparkles` import) and `:281-285` (delete the FAB block)
- Test: `packages/frontend/app/(app)/reports/builder/__tests__/Builder.fab-removed.test.tsx`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: nothing later tasks rely on. Pure deletion of a decorative button that had no `onClick` and no spec.

The current FAB (verified at `Builder.tsx:282-285`):

```tsx
{
  /* AI Assist Floating Button */
}
<button className="fixed bottom-6 right-6 p-4 bg-tertiary text-on-tertiary rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all">
  <Sparkles className="w-6 h-6" />
</button>;
```

`Sparkles` is imported only for this button (verified: `Builder.tsx:28`, inside the `lucide-react` import that spans lines 17-29). No other file references this FAB.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/components/navigation", () => ({ Breadcrumbs: () => <nav /> }));
vi.mock("../components/SectionLibrary", () => ({
  SectionLibrary: () => <aside />,
}));
vi.mock("../components/Canvas", () => ({ Canvas: () => <main /> }));
vi.mock("../components/PropertyPanel", () => ({
  PropertyPanel: () => <aside />,
}));

import { Builder } from "../Builder";

describe("Report Builder", () => {
  it("no longer renders the removed AI Assist floating action button", () => {
    const { container } = render(<Builder />);
    expect(container.querySelector(".fixed.bottom-6.right-6")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run Builder.fab-removed`
      Expected: FAIL — the assertion `expect(container.querySelector(".fixed.bottom-6.right-6")).toBeNull()` receives the still-present FAB element (not null).

- [ ] **Step 3: Write minimal implementation**
      In `Builder.tsx`, remove `Sparkles,` from the `lucide-react` import so lines 17-29 read:

```tsx
import {
  FileText,
  Save,
  Download,
  Undo,
  Redo,
  Trash2,
  Eye,
  Settings,
  Home,
  TrendingUp,
} from "lucide-react";
```

Then delete the FAB block (the comment + button at lines 281-285) so the end of the component reads:

```tsx
        </DragOverlay>
      </div>
    </DndContext>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run Builder.fab-removed`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/reports/builder/Builder.tsx" "packages/frontend/app/(app)/reports/builder/__tests__/Builder.fab-removed.test.tsx"
git commit -m "fix(reports): remove dead AI Assist FAB from report builder"
```

---

### Task 2: Make market-detail MetricCard link to its metric page

**Files:**

- Modify: `packages/frontend/app/(app)/market/[id]/components/MetricCard.tsx:2-9` (add `Link` import), `:63-68` (add `relative` + stretched link), `:81` (raise the actions row above the link)
- Test: `packages/frontend/app/(app)/market/[id]/components/__tests__/MetricCard.link.test.tsx`

**Interfaces:**

- Consumes: nothing from earlier tasks. Route `/metrics/[metricId]` already exists (`app/(app)/metrics/[metricId]/page.tsx`).
- Produces: nothing later tasks rely on.

The card is currently an inert `motion.div` with hover styling but no navigation (`MetricCard.tsx:63-68`). It also contains an interactive `MetricAlertBell` (rendered only when geography props are present, `:102-110`), so a wrapping `<a>` would be invalid HTML and would swallow the bell's clicks. Use the stretched-link overlay pattern: an absolutely-positioned `<Link>` behind the content, with the interactive actions row raised above it.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: () => (props: any) => <div {...props} /> }),
}));
vi.mock("@/app/components/MetricTitle", () => ({
  MetricTitle: () => <span>metric-title</span>,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { MetricCard } from "../MetricCard";

describe("MetricCard", () => {
  it("wraps the card in a link to /metrics/<metricId>", () => {
    const { container } = render(
      <MetricCard
        metricId="home_value"
        formattedValue="$499K"
        trendPercent={null}
        trendDirection="stable"
      />,
    );
    expect(
      container.querySelector('a[href="/metrics/home_value"]'),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run MetricCard.link`
      Expected: FAIL — `container.querySelector('a[href="/metrics/home_value"]')` is `null` (no link rendered yet).

- [ ] **Step 3: Write minimal implementation**
      Add the `Link` import at the top of `MetricCard.tsx` (after line 2):

```tsx
import Link from "next/link";
```

Change the opening `motion.div` (line 63) to include `relative` and add the stretched link as its first child:

```tsx
    <motion.div
      className="relative bg-surface-container rounded-xl p-4 border border-outline-variant/30 hover:shadow-md hover:border-outline-variant/50 transition-all"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Link
        href={`/metrics/${metricId}`}
        aria-label={`View ${metricId} metric details`}
        className="absolute inset-0 z-0 rounded-xl"
      />
```

Raise the actions row (currently line 81) above the link so the alert bell stays clickable:

```tsx
        <div className="relative z-10 flex items-center gap-1 shrink-0">
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run MetricCard.link`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/[id]/components/MetricCard.tsx" "packages/frontend/app/(app)/market/[id]/components/__tests__/MetricCard.link.test.tsx"
git commit -m "fix(market): metric card links to /metrics/[metricId]"
```

---

### Task 3: Make map DataTableModal rows navigate to the market page

**Files:**

- Modify: `packages/frontend/app/(app)/map/components/DataTableModal.tsx:3` (add `useRouter`), `:37-40` (get router + row handler), `:256-268` (wire the row)
- Test: `packages/frontend/app/(app)/map/components/__tests__/DataTableModal.rownav.test.tsx`

**Interfaces:**

- Consumes: the `/market/[id]?type=<geoLevel>` URL convention established by `QuickActions.handleViewMarket` and `MapContextMenu.handleMarkets`.
- Produces: nothing later tasks rely on.

Rows are currently inert (`DataTableModal.tsx:256-268`: a `<tr>` with hover styling only). `row.id` is the region id (mapData key) and `geoLevel` is a component prop. There is no per-row state code here, so the URL uses `type` only (the minimal form used by `QuickActions`).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ canAccess: () => true }),
}));
vi.mock("@/lib/pwa/use-modal-history", () => ({ useModalHistory: () => {} }));
vi.mock("@/lib/export", () => ({ downloadCsv: () => {} }));
vi.mock("../../config", () => ({
  getMetricFormat: () => "number",
  getMetricTitle: () => "Test Metric",
}));
vi.mock("@/lib/data", () => ({
  formatMetricValue: (v: number | null) => String(v),
}));
vi.mock("../../types", () => ({
  getValueFromEntry: (e: any) => e.value,
  getDateFromEntry: (e: any) => e.date ?? null,
}));

import { DataTableModal } from "../DataTableModal";

describe("DataTableModal rows", () => {
  it("navigates to /market/<id>?type=<geoLevel> and closes on row click", () => {
    const onClose = vi.fn();
    const { getByText } = render(
      <DataTableModal
        isOpen
        onClose={onClose}
        mapData={{ "12420": { value: 5, name: "Austin" } } as any}
        selectedMetric="home_value"
        geoLevel={"metro" as any}
      />,
    );
    fireEvent.click(getByText("Austin"));
    expect(push).toHaveBeenCalledWith("/market/12420?type=metro");
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run DataTableModal.rownav`
      Expected: FAIL — `push` is never called (the row has no click handler), so `expect(push).toHaveBeenCalledWith(...)` fails.

- [ ] **Step 3: Write minimal implementation**
      Add `useRouter` to the `next/navigation`-free file. Insert after line 2 (`import { useState, useMemo } from "react";`):

```tsx
import { useRouter } from "next/navigation";
```

Inside the component, after `const [searchFilter, setSearchFilter] = useState("");` (line 40) add:

```tsx
const router = useRouter();

const handleRowClick = (regionId: string) => {
  router.push(`/market/${regionId}?type=${geoLevel}`);
  onClose();
};
```

Change the row `<tr>` (lines 257-260) to be clickable:

```tsx
                  <tr
                    key={row.id}
                    onClick={() => handleRowClick(row.id)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRowClick(row.id);
                    }}
                    className={`cursor-pointer hover:bg-surface-container transition-colors ${index % 2 === 0 ? "bg-surface" : "bg-surface-container-lowest"}`}
                  >
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run DataTableModal.rownav`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/map/components/DataTableModal.tsx" "packages/frontend/app/(app)/map/components/__tests__/DataTableModal.rownav.test.tsx"
git commit -m "fix(map): data table rows navigate to market detail"
```

---

### Task 4: Add a methodology link to the score displays

**Files:**

- Modify: `packages/frontend/app/(app)/market/[id]/components/ScoreColumn.tsx:2-6` (add `Link`), `:65` (add link under the label)
- Modify: `packages/frontend/app/(app)/map/components/sidebar-components/SidebarScoreCard.tsx:11` (add `Link`), `:63-83` (add link in the header)
- Test: `packages/frontend/app/(app)/market/[id]/components/__tests__/ScoreColumn.methodology.test.tsx`
- Test: `packages/frontend/app/(app)/map/components/sidebar-components/__tests__/SidebarScoreCard.methodology.test.tsx`

**Interfaces:**

- Consumes: nothing. Route `/scores/methodology` already exists (`app/(app)/scores/methodology/page.tsx`).
- Produces: nothing later tasks rely on.

`ScoreColumn` renders `<p className="text-on-surface-variant">PropertyIQ Score</p>` at line 65 with no link. `SidebarScoreCard`'s header (`:63-83`) is a whole-card click target (`onClick` at :60) — the methodology link must `stopPropagation` so it doesn't trigger the card's own click.

- [ ] **Step 1: Write the failing tests**
      `ScoreColumn.methodology.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: () => (props: any) => <div {...props} /> }),
}));
vi.mock("@/app/components/scoring/ScoreDisplay", () => ({
  ScoreDisplay: () => <div />,
}));
vi.mock("../DashboardScoreBadge", () => ({
  DashboardScoreBadge: () => <div />,
}));
vi.mock("@/app/components/social-proof/SocialProofBadge", () => ({
  SocialProofBadge: () => <div />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { ScoreColumn } from "../ScoreColumn";

describe("ScoreColumn", () => {
  it("links to the score methodology page", () => {
    const { container } = render(
      <ScoreColumn
        activeView="investor"
        primaryScore={{ score: 72 }}
        geoLevel="metro"
        geoId="12420"
      />,
    );
    expect(
      container.querySelector('a[href="/scores/methodology"]'),
    ).toBeTruthy();
  });
});
```

`SidebarScoreCard.methodology.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

vi.mock("@/app/components/scoring/ScoreDisplay", () => ({
  ScoreDisplay: () => <div />,
}));
vi.mock("../Icons", () => ({ InsightsIcon: () => <svg /> }));
vi.mock("./TrendArrow", () => ({
  TrendArrow: () => <span />,
  getTrendDirection: () => "flat",
  formatTrendValue: () => "—",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { SidebarScoreCard } from "../SidebarScoreCard";

describe("SidebarScoreCard", () => {
  it("links to methodology without triggering the card onClick", () => {
    const onClick = vi.fn();
    const { container } = render(
      <SidebarScoreCard
        score={{ score: 72, access: "full" }}
        onClick={onClick}
      />,
    );
    const link = container.querySelector(
      'a[href="/scores/methodology"]',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**
      Run: `cd packages/frontend && npx vitest run "methodology"`
      Expected: FAIL — both `a[href="/scores/methodology"]` queries return null.

- [ ] **Step 3: Write minimal implementation**
      In `ScoreColumn.tsx` add after line 5 (`import { SocialProofBadge } ...`):

```tsx
import Link from "next/link";
```

Immediately after the label `<p className="text-on-surface-variant">PropertyIQ Score</p>` (line 65) insert:

```tsx
<Link
  href="/scores/methodology"
  className="mt-1 inline-block text-xs text-primary hover:text-primary/80 transition-colors"
>
  How it&apos;s calculated →
</Link>
```

In `SidebarScoreCard.tsx` add after line 14 (`import { Loader2 } from "lucide-react";`):

```tsx
import Link from "next/link";
```

Add the methodology link as the last child of the header flex row — insert it just before the header `</div>` at line 83 (after the label group `</div>` at line 82):

```tsx
<Link
  href="/scores/methodology"
  onClick={(e) => e.stopPropagation()}
  className="shrink-0 text-[11px] text-primary hover:text-primary/80 transition-colors"
>
  How it&apos;s scored
</Link>
```

- [ ] **Step 4: Run tests to verify they pass**
      Run: `cd packages/frontend && npx vitest run "methodology"`
      Expected: PASS (both files)

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/[id]/components/ScoreColumn.tsx" "packages/frontend/app/(app)/map/components/sidebar-components/SidebarScoreCard.tsx" "packages/frontend/app/(app)/market/[id]/components/__tests__/ScoreColumn.methodology.test.tsx" "packages/frontend/app/(app)/map/components/sidebar-components/__tests__/SidebarScoreCard.methodology.test.tsx"
git commit -m "fix(scores): link score displays to methodology page"
```

---

### Task 5: Link Active Alerts rows to their market

**Files:**

- Modify: `packages/frontend/app/(app)/alerts/page.tsx:4` (add `ChevronRight`), `:104-137` (add per-row market link)
- Test: `packages/frontend/app/(app)/alerts/__tests__/page.market-link.test.tsx`

**Interfaces:**

- Consumes: the `/map?geo=<type>&id=<id>` link pattern already used by `AlertFeed.tsx:57-62`.
- Produces: nothing later tasks rely on.

The Active Alerts row (`page.tsx:104-136`) shows the alert but has no link to its market. `Link` is already imported (`:5`); `ChevronRight` is not (only `Bell, Trash2, ToggleLeft, ToggleRight` at `:4`). The `Alert` type carries `geography_type` and `geography_id` (verified in `lib/data/fetchers/alerts.ts:14-25`).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

const activeAlert = {
  id: "a1",
  geography_type: "metro",
  geography_id: "12420",
  geography_name: "Austin, TX",
  metric_id: "propertyiq_score",
  condition: "above",
  threshold: 60,
  is_active: true,
};

vi.mock("@/lib/alerts/hooks", () => ({
  useAlerts: () => ({
    alerts: [activeAlert],
    isLoading: false,
    remove: vi.fn(),
    update: vi.fn(),
  }),
  useAlertHistory: () => ({
    entries: [],
    unreadCount: 0,
    isLoading: false,
    markRead: vi.fn(),
  }),
}));
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ tier: "pro", loading: false }),
}));
vi.mock("@/components/navigation", () => ({
  PageHeaderWithBreadcrumbs: () => <header />,
}));
vi.mock("@/components/alerts", () => ({ AlertFeed: () => <div /> }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import AlertsPage from "../page";

describe("Alerts page active-alert rows", () => {
  it("renders a link to the alert's market", () => {
    const { container } = render(<AlertsPage />);
    expect(
      container.querySelector('a[href="/map?geo=metro&id=12420"]'),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run page.market-link`
      Expected: FAIL — no anchor with `href="/map?geo=metro&id=12420"` exists.

- [ ] **Step 3: Write minimal implementation**
      Add `ChevronRight` to the lucide import at `page.tsx:4`:

```tsx
import {
  Bell,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
} from "lucide-react";
```

Inside the active-alert row, insert the market link between the alert-info `<div className="flex-1 min-w-0">…</div>` (ends at line 115) and the toggle `<button>` (starts at line 116):

```tsx
<Link
  href={`/map?geo=${alert.geography_type}&id=${alert.geography_id}`}
  className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
  title="View on map"
>
  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
</Link>
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run page.market-link`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/alerts/page.tsx" "packages/frontend/app/(app)/alerts/__tests__/page.market-link.test.tsx"
git commit -m "fix(alerts): active alert rows link to their market"
```

---

### Task 6: Give the /activate success screen a forward path

**Files:**

- Modify: `packages/frontend/app/(app)/activate/page.tsx:4` (add `Link`), `:50-56` (add links to the success block)
- Test: `packages/frontend/app/(app)/activate/__tests__/page.success-links.test.tsx`

**Interfaces:**

- Consumes: nothing. Routes `/account/api-keys` and `/docs/mcp` already exist.
- Produces: nothing later tasks rely on.

The success block (`page.tsx:50-56`) is a dead-end ("You can close this page.") with no navigation. Routes verified: `app/(app)/account/api-keys/page.tsx` and `app/(app)/docs/mcp/page.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/data/fetchers/base", () => ({
  fetchAPIRaw: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import ActivatePage from "../page";

describe("ActivatePage success screen", () => {
  it("shows forward links to API keys and MCP docs after activation", async () => {
    const { container, getByPlaceholderText, getByRole } = render(
      <ActivatePage />,
    );
    fireEvent.change(getByPlaceholderText("ABCD-1234"), {
      target: { value: "ABCD-1234" },
    });
    fireEvent.click(getByRole("button", { name: /activate/i }));
    await waitFor(() => {
      expect(
        container.querySelector('a[href="/account/api-keys"]'),
      ).toBeTruthy();
    });
    expect(container.querySelector('a[href="/docs/mcp"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run page.success-links`
      Expected: FAIL — after activation the success block renders no links; `waitFor` times out on `a[href="/account/api-keys"]`.

- [ ] **Step 3: Write minimal implementation**
      Add after line 4 (`import { fetchAPIRaw } from "@/lib/data/fetchers/base";`):

```tsx
import Link from "next/link";
```

Add the links inside the success block, immediately after the `</p>` (line 55) and before that block's `</div>` (line 56):

```tsx
<div className="mt-4 flex flex-col gap-2">
  <Link
    href="/account/api-keys"
    className="rounded-full bg-primary px-6 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-primary-dark"
  >
    Manage API keys
  </Link>
  <Link
    href="/docs/mcp"
    className="rounded-full border border-outline/30 px-6 py-2.5 text-center text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
  >
    Read the MCP docs
  </Link>
</div>
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run page.success-links`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/activate/page.tsx" "packages/frontend/app/(app)/activate/__tests__/page.success-links.test.tsx"
git commit -m "fix(activate): success screen links to API keys and MCP docs"
```

---

### Task 7: Fix the tour phase-guard dead-end (step2/step3 with a market)

**Files:**

- Create: `packages/frontend/app/(app)/tour/resolveTourPhase.ts`
- Modify: `packages/frontend/app/(app)/tour/page.tsx:17` (import), `:47-53` (use the extracted function)
- Test: `packages/frontend/app/(app)/tour/__tests__/resolveTourPhase.test.ts`

**Interfaces:**

- Consumes: `TourPhase`, `Persona`, `MarketRef` from `./types` (already imported by `page.tsx:17`).
- Produces: `resolveTourPhase(session: { phase: TourPhase; market: MarketRef | null; persona: Persona | null }): TourPhase`.

Today the self-heal (`page.tsx:47-53`) only fires when `!session.market`. Reaching `step2`/`step3` **with** a market set falls through to the "Phase 04 placeholder" dead-end (switch cases at `:76-94`). Extract the phase resolution into a pure, testable function and extend it so vestigial `step2`/`step3` redirect into the product (`"step1"`, which `RedirectToStep` sends to `/market/<geoId>`) when a market is present.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveTourPhase } from "../resolveTourPhase";

const market = { geoId: "12420", geoLevel: "metro", name: "Austin, TX" } as any;

describe("resolveTourPhase", () => {
  it("redirects vestigial step2 to step1 when a market is already set", () => {
    expect(
      resolveTourPhase({ phase: "step2", market, persona: "investor" as any }),
    ).toBe("step1");
  });

  it("redirects vestigial step3 to step1 when a market is already set", () => {
    expect(
      resolveTourPhase({ phase: "step3", market, persona: "investor" as any }),
    ).toBe("step1");
  });

  it("falls back to market collection for a step phase with no market", () => {
    expect(
      resolveTourPhase({
        phase: "step1",
        market: null,
        persona: "investor" as any,
      }),
    ).toBe("market");
  });

  it("falls back to persona when neither market nor persona is set", () => {
    expect(
      resolveTourPhase({ phase: "step1", market: null, persona: null }),
    ).toBe("persona");
  });

  it("passes non-step phases through unchanged", () => {
    expect(
      resolveTourPhase({
        phase: "celebrate",
        market,
        persona: "investor" as any,
      }),
    ).toBe("celebrate");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run resolveTourPhase`
      Expected: FAIL with "Cannot find module '../resolveTourPhase'" (the file does not exist yet).

- [ ] **Step 3: Write minimal implementation**
      Create `packages/frontend/app/(app)/tour/resolveTourPhase.ts`:

```ts
import type { TourPhase, Persona, MarketRef } from "./types";

/**
 * Resolves the phase actually rendered by the tour switch from the raw session.
 *
 * Two self-heals prevent dead-ends (spec §5.2 — never strand the user):
 *  1. A step phase reached with NO market falls back to collecting what's
 *     missing (persona first, then market).
 *  2. The vestigial step2/step3 phases (no real UI on /tour — they otherwise
 *     hit the "Phase 04 placeholder") redirect into the product via "step1"
 *     when a market IS already selected.
 */
export function resolveTourPhase(session: {
  phase: TourPhase;
  market: MarketRef | null;
  persona: Persona | null;
}): TourPhase {
  const STEP_PHASES: TourPhase[] = ["step1", "step2", "step3", "step4"];
  const VESTIGIAL_STEP_PHASES: TourPhase[] = ["step2", "step3"];

  if (STEP_PHASES.includes(session.phase) && !session.market) {
    return session.persona ? "market" : "persona";
  }
  if (VESTIGIAL_STEP_PHASES.includes(session.phase) && session.market) {
    return "step1";
  }
  return session.phase;
}
```

In `page.tsx`, add the import after line 17 (`import type { MarketRef, Persona, TourPhase } from "./types";`):

```tsx
import { resolveTourPhase } from "./resolveTourPhase";
```

Replace the inline block at `page.tsx:47-53` with:

```tsx
const phase: TourPhase = resolveTourPhase(session);
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run resolveTourPhase`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/tour/resolveTourPhase.ts" "packages/frontend/app/(app)/tour/page.tsx" "packages/frontend/app/(app)/tour/__tests__/resolveTourPhase.test.ts"
git commit -m "fix(tour): self-heal step2/step3 dead-end when a market is set"
```

---

### Task 8: Add a forward CTA to the tour signup confirmation panel

**Files:**

- Modify: `packages/frontend/app/(app)/tour/components/InlineSignupForm.tsx:4` (add `Link`), `:48-64` (add CTA)
- Test: `packages/frontend/app/(app)/tour/components/__tests__/InlineSignupForm.cta.test.tsx`

**Interfaces:**

- Consumes: nothing. Route `/dashboard` already exists.
- Produces: nothing later tasks rely on.

The "check your email" panel (`InlineSignupForm.tsx:48-64`) is the real production path (email confirmation is ON) and has zero CTA — the user is stranded. Add a "Continue to dashboard" link.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../TourStateProvider", () => ({
  useTour: () => ({
    session: { sessionId: "s1", market: { name: "Austin, TX" } },
  }),
}));
vi.mock("@/lib/data", () => ({
  useTourSignup: () => ({
    mutateAsync: vi.fn(),
    isSuccess: true,
    isPending: false,
    isError: false,
    data: { needsEmailConfirmation: true },
    error: null,
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { InlineSignupForm } from "../InlineSignupForm";

describe("InlineSignupForm confirmation panel", () => {
  it("offers a forward CTA to the dashboard", () => {
    const { container } = render(<InlineSignupForm />);
    expect(container.querySelector('a[href="/dashboard"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run InlineSignupForm.cta`
      Expected: FAIL — the confirmation panel renders no anchor; `a[href="/dashboard"]` is null.

- [ ] **Step 3: Write minimal implementation**
      Add after line 4 (`import { useRouter } from "next/navigation";`):

```tsx
import Link from "next/link";
```

Inside the `needsEmailConfirmation` panel, add the CTA after the `<p>…waiting for you.</p>` (line 61) and before that block's `</div>` (line 62):

```tsx
<Link
  href="/dashboard"
  className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary/90"
>
  Continue to dashboard →
</Link>
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run InlineSignupForm.cta`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/tour/components/InlineSignupForm.tsx" "packages/frontend/app/(app)/tour/components/__tests__/InlineSignupForm.cta.test.tsx"
git commit -m "fix(tour): add dashboard CTA to signup confirmation panel"
```

---

### Task 9: Link the About page to the score methodology

**Files:**

- Modify: `packages/frontend/app/(app)/about/page.tsx:259-269` (validated-data card) and `:281-290` (methodology card)
- Test: `packages/frontend/app/(app)/about/__tests__/page.methodology.test.tsx`

**Interfaces:**

- Consumes: nothing. `Link` is already imported (`about/page.tsx:3`). Route `/scores/methodology` exists.
- Produces: nothing later tasks rely on.

The "Validated with Real Data" card (`:259-269`) and "Transparent Methodology" card (`:281-290`) both reference methodology/validation in prose but link nowhere.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/components/navigation", () => ({
  PageHeaderWithBreadcrumbs: () => <header />,
}));
vi.mock("@/app/components/seo/WebPageJsonLd", () => ({
  WebPageJsonLd: () => null,
}));
vi.mock("@/app/components/seo/FaqSection", () => ({
  FaqSection: () => <section />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import AboutPage from "../page";

describe("About page", () => {
  it("links to the score methodology page", () => {
    const { container } = render(<AboutPage />);
    expect(
      container.querySelectorAll('a[href="/scores/methodology"]').length,
    ).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run about`
      Expected: FAIL — no anchor with `href="/scores/methodology"` exists (length is 0).

- [ ] **Step 3: Write minimal implementation**
      In the "Validated with Real Data" card, add the link after its `<p>…</p>` (line 268) and before the card's `</div>` (line 269):

```tsx
<Link
  href="/scores/methodology"
  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
>
  See how scores are validated →
</Link>
```

In the "Transparent Methodology" card, add the link after its `<p>…</p>` (line 289) and before the card's `</div>` (line 290):

```tsx
<Link
  href="/scores/methodology"
  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
>
  Read the full methodology →
</Link>
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run about`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/about/page.tsx" "packages/frontend/app/(app)/about/__tests__/page.methodology.test.tsx"
git commit -m "fix(about): link validation and methodology copy to /scores/methodology"
```

---

### Task 10: Fix the Map → Graphs deep-link param mismatch

**Files:**

- Modify: `packages/frontend/app/(app)/map/components/MapContextMenu.tsx:105-121` (`handleGraphs`)
- Test: `packages/frontend/app/(app)/map/components/__tests__/MapContextMenu.graphs.test.tsx`

**Interfaces:**

- Consumes: the URL contract parsed by `useGraphsState` (`app/(app)/graphs/hooks/useGraphsState.ts:210-232`): `mid`, `mname`, `mtype` (one of `metro`/`county`/`zip`), `mstate`.
- Produces: nothing later tasks rely on.

`handleGraphs` currently pushes `geo`/`level`/`name` (`MapContextMenu.tsx:114-118`), which `useGraphsState` never reads — so opening Graphs from the map loads an empty selection. Emit the params `useGraphsState` actually parses.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ canAccess: () => true }),
}));
vi.mock("@/lib/pwa/use-modal-history", () => ({ useModalHistory: () => {} }));
vi.mock("@/components/entitlements/PaywallCard", () => ({
  PaywallCard: () => <div />,
}));

import { MapContextMenu } from "../MapContextMenu";

describe("MapContextMenu → Graphs", () => {
  it("pushes /graphs with the mid/mtype/mname/mstate params useGraphsState reads", () => {
    render(
      <MapContextMenu
        geography={
          {
            id: "12420",
            name: "Austin",
            geoLevel: "metro",
            value: null,
            stateAbbr: "TX",
          } as any
        }
        x={0}
        y={0}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("View in Graphs"));
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("mid=12420");
    expect(url).toContain("mtype=metro");
    expect(url).toContain("mname=Austin");
    expect(url).toContain("mstate=TX");
    expect(url).not.toContain("geo=");
    expect(url).not.toContain("level=");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run MapContextMenu.graphs`
      Expected: FAIL — the pushed URL contains `geo=`/`level=`/`name=`, so `expect(url).toContain("mid=12420")` fails.

- [ ] **Step 3: Write minimal implementation**
      Replace `handleGraphs` (`MapContextMenu.tsx:105-121`) with:

```tsx
function handleGraphs() {
  if (geoGated) {
    setPaywall({
      type: "geo",
      id: geography.geoLevel,
      title: `Unlock ${geography.geoLevel} data`,
    });
    return;
  }
  const params = new URLSearchParams({
    mid: geography.id,
    mtype: geography.geoLevel,
    mname: geography.name,
  });
  if (geography.stateAbbr) params.set("mstate", geography.stateAbbr);
  router.push(`/graphs?${params.toString()}`);
  onClose();
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run MapContextMenu.graphs`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/map/components/MapContextMenu.tsx" "packages/frontend/app/(app)/map/components/__tests__/MapContextMenu.graphs.test.tsx"
git commit -m "fix(map): graphs deep-link uses mid/mtype/mname/mstate params"
```

---

### Task 11: Add a Saved-analyses entry point inside /analyzer

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/components/SavedAnalysesPanel.tsx`
- Modify: `packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx:27` (import), `:252-253` (mount)
- Test: `packages/frontend/app/(app)/analyzer/components/__tests__/SavedAnalysesPanel.test.tsx`

**Interfaces:**

- Consumes: `fetchSavedAnalyses(): Promise<SavedAnalysis[]>` and `type SavedAnalysis` from `@/lib/data` (re-exported via `lib/data/fetchers/index.ts:21` → `./analyzer`). `SavedAnalysis` fields used: `id`, `label`, `address_full`, `address_city`, `address_state`, `created_at` (verified in `lib/data/fetchers/analyzer.ts:162-177`).
- Produces: `SavedAnalysesPanel` React component (no props).

`fetchSavedAnalyses` exists (`analyzer.ts:198`) but nothing in `/analyzer` links to `/analyzer/saved/[id]`. Add a self-contained collapsible panel that renders nothing until saved analyses exist (no clutter for first-run users).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  fetchSavedAnalyses: vi.fn().mockResolvedValue([
    {
      id: "sa-1",
      label: "123 Main St",
      address_city: "Austin",
      address_state: "TX",
      created_at: "2026-07-01T00:00:00Z",
    },
  ]),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import { SavedAnalysesPanel } from "../SavedAnalysesPanel";

describe("SavedAnalysesPanel", () => {
  it("lists saved analyses linking to /analyzer/saved/[id]", async () => {
    const { container, getByRole } = render(<SavedAnalysesPanel />);
    await waitFor(() => {
      expect(getByRole("button", { name: /saved analyses/i })).toBeTruthy();
    });
    fireEvent.click(getByRole("button", { name: /saved analyses/i }));
    expect(
      container.querySelector('a[href="/analyzer/saved/sa-1"]'),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run SavedAnalysesPanel`
      Expected: FAIL with "Cannot find module '../SavedAnalysesPanel'" (the component does not exist yet).

- [ ] **Step 3: Write minimal implementation**
      Create `packages/frontend/app/(app)/analyzer/components/SavedAnalysesPanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronDown, ChevronUp } from "lucide-react";
import { fetchSavedAnalyses, type SavedAnalysis } from "@/lib/data";

/**
 * Entry point for a user's saved analyses inside /analyzer. Renders nothing
 * until at least one saved analysis exists, so first-run users see no clutter.
 * Each row links to /analyzer/saved/[id].
 */
export function SavedAnalysesPanel() {
  const [saved, setSaved] = useState<SavedAnalysis[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSavedAnalyses()
      .then((rows) => {
        if (!cancelled) setSaved(rows);
      })
      .catch(() => {
        if (!cancelled) setSaved([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (saved.length === 0) return null;

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-low">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-on-surface"
      >
        <span className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          Saved analyses ({saved.length})
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-on-surface-variant" />
        ) : (
          <ChevronDown className="h-4 w-4 text-on-surface-variant" />
        )}
      </button>

      {expanded && (
        <ul className="divide-y divide-outline-variant border-t border-outline-variant">
          {saved.map((row) => (
            <li key={row.id}>
              <Link
                href={`/analyzer/saved/${row.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-container"
              >
                <span className="min-w-0 truncate text-sm text-on-surface">
                  {row.label ||
                    row.address_full ||
                    `${row.address_city}, ${row.address_state}`}
                </span>
                <span className="shrink-0 text-xs text-on-surface-variant">
                  {new Date(row.created_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

In `AnalyzerClient.tsx`, add the import after line 27 (`import { PropertyRecordCard } ...`):

```tsx
import { SavedAnalysesPanel } from "./components/SavedAnalysesPanel";
```

Mount it as the first child of the right column. Change lines 252-253 from:

```tsx
          <div className="space-y-6 min-w-0">
            {!address.trim() && !rentcastData ? (
```

to:

```tsx
          <div className="space-y-6 min-w-0">
            <SavedAnalysesPanel />
            {!address.trim() && !rentcastData ? (
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run SavedAnalysesPanel`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/components/SavedAnalysesPanel.tsx" "packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx" "packages/frontend/app/(app)/analyzer/components/__tests__/SavedAnalysesPanel.test.tsx"
git commit -m "feat(analyzer): saved-analyses entry point inside /analyzer"
```

---

### Task 12: Give the standalone Saved-analysis page a way back

**Files:**

- Modify: `packages/frontend/app/(app)/analyzer/saved/[id]/SavedClient.tsx:1-2` (add `Link`), `:22-31` (loading + not-found), `:60-61` (main header)
- Test: `packages/frontend/app/(app)/analyzer/saved/[id]/__tests__/SavedClient.back-link.test.tsx`

**Interfaces:**

- Consumes: nothing. Route `/analyzer` already exists.
- Produces: nothing later tasks rely on.

`SavedClient` is reachable only by direct URL and has no link back to `/analyzer` in any state — the loading (`:22-25`) and not-found (`:27-31`) states are bare text dead-ends. Add a back link to all three states.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

let mockState: any = { data: undefined, isLoading: true };
vi.mock("@/lib/analyzer/useSavedAnalysis", () => ({
  useSavedAnalysis: () => mockState,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : ""} {...rest}>
      {children}
    </a>
  ),
}));

import SavedClient from "../SavedClient";

describe("Analyzer SavedClient dead-end states", () => {
  it("shows a back-to-Analyzer link while loading", () => {
    mockState = { data: undefined, isLoading: true };
    const { container } = render(<SavedClient id="sa-1" />);
    expect(container.querySelector('a[href="/analyzer"]')).toBeTruthy();
  });

  it("shows a back-to-Analyzer link when the analysis is not found", () => {
    mockState = { data: null, isLoading: false };
    const { container } = render(<SavedClient id="sa-1" />);
    expect(container.querySelector('a[href="/analyzer"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run SavedClient.back-link`
      Expected: FAIL — neither the loading nor the not-found state renders an `a[href="/analyzer"]`.

- [ ] **Step 3: Write minimal implementation**
      Add the `Link` import after line 1 (`"use client";`):

```tsx
import Link from "next/link";
```

Replace the loading block (`:22-25`) with:

```tsx
if (isLoading) {
  return (
    <div className="p-12 text-center text-on-surface-variant">
      <p>Loading…</p>
      <Link
        href="/analyzer"
        className="mt-4 inline-block text-primary hover:underline"
      >
        ← Back to Analyzer
      </Link>
    </div>
  );
}
```

Replace the not-found block (`:27-31`) with:

```tsx
if (!row) {
  return (
    <div className="p-12 text-center text-on-surface-variant">
      <p>Not found.</p>
      <Link
        href="/analyzer"
        className="mt-4 inline-block text-primary hover:underline"
      >
        ← Back to Analyzer
      </Link>
    </div>
  );
}
```

In the main render, add a back link at the top of the container — insert after the `<div className="max-w-5xl mx-auto px-6 py-12">` (line 60), before the `<h1>` (line 61):

```tsx
<Link
  href="/analyzer"
  className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
>
  ← Back to Analyzer
</Link>
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run SavedClient.back-link`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/saved/[id]/SavedClient.tsx" "packages/frontend/app/(app)/analyzer/saved/[id]/__tests__/SavedClient.back-link.test.tsx"
git commit -m "fix(analyzer): add back-to-Analyzer links to saved-analysis page"
```

---

### Task 13: Backend — persist report-builder templates (POST /api/reports/builder-templates)

**Files:**

- Modify: `packages/backend/src/reports/dto/generate-report.dto.ts` (append `SaveBuilderTemplateDto`)
- Modify: `packages/backend/src/reports/reports.controller.ts:25-29` (import DTO), after `:109` (new route)
- Modify: `packages/backend/src/reports/reports.service.ts:24` (import DTO), after `:108` (new method)
- Test: `packages/backend/src/reports/__tests__/save-builder-template.spec.ts`

**Interfaces:**

- Consumes: `SupabaseService.getClient()` and the `report_templates` table (columns `slug` UNIQUE NOT NULL, `name`, `description`, `icon`, `tier_required`, `is_active`, `is_public`, `config` JSONB, `created_by` → `user_profiles(id)`; verified in `scripts/migrations/050-create-report-tables.sql:13-39`).
- Produces: `ReportsService.saveBuilderTemplate(userId: string, dto: SaveBuilderTemplateDto): Promise<{ id: string; slug: string }>` and `class SaveBuilderTemplateDto { title: string; user_type: 'homebuyer' | 'investor'; sections: Record<string, unknown>[] }`. **Task 14 consumes the `{ id, slug }` return shape and the `{ title, user_type, sections }` body shape.**

The report builder's "Save Template" button is dead. A Builder layout (sections + userType + title, `geography` is null) is a reusable _template_, not a generated report. `report_templates` was built to hold custom/white-label templates alongside the master formats (it has `created_by`, `is_public`, `config`), so save there with `is_public=false` — it stays out of the public catalog (`getTemplates()` filters `is_public=true`, `reports.service.ts:77-84`).

- [ ] **Step 1: Write the failing test**

```ts
import { ReportsService } from "../reports.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("ReportsService.saveBuilderTemplate", () => {
  it("inserts a private, user-owned report_templates row and returns id + slug", async () => {
    const insertPayloads: any[] = [];
    const client = {
      from: jest.fn((table: string) => {
        if (table !== "report_templates") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          insert: jest.fn((payload: any) => {
            insertPayloads.push(payload);
            return {
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({
                    data: { id: "tmpl-1", slug: payload.slug },
                    error: null,
                  }),
                ),
              })),
            };
          }),
        };
      }),
    };
    const supabase = { getClient: () => client } as unknown as SupabaseService;

    const service = new ReportsService(
      supabase,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
    );

    const result = await service.saveBuilderTemplate("user-1234abcd", {
      title: "My Layout",
      user_type: "investor",
      sections: [{ id: "s1", type: "report_title" }],
    });

    expect(result).toEqual({
      id: "tmpl-1",
      slug: expect.stringContaining("custom-user-123"),
    });
    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0]).toMatchObject({
      name: "My Layout",
      is_public: false,
      is_active: true,
      created_by: "user-1234abcd",
      config: {
        sections: [{ id: "s1", type: "report_title" }],
        userType: "investor",
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/backend && npx jest save-builder-template`
      Expected: FAIL — `service.saveBuilderTemplate is not a function` (the method does not exist yet).

- [ ] **Step 3: Write minimal implementation**
      Append to `packages/backend/src/reports/dto/generate-report.dto.ts` (the decorators `IsString`, `IsNotEmpty`, `IsIn`, `IsArray` are already imported at lines 1-9):

```ts
export class SaveBuilderTemplateDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsIn(["homebuyer", "investor"])
  user_type: "homebuyer" | "investor";

  @IsArray()
  sections: Record<string, unknown>[];
}
```

In `reports.service.ts`, extend the DTO import at line 24:

```ts
import {
  GenerateReportDto,
  SaveBuilderTemplateDto,
} from "./dto/generate-report.dto";
```

Add the method in the "Template CRUD" section, immediately after `getTemplateBySlug` (after line 108):

```ts
  /**
   * Persist a report-builder layout as a private, user-owned template row in
   * report_templates (is_public=false so it never enters the public catalog).
   * The table was built for this: created_by is the owner, config holds the
   * section structure. Returns the new template's id + slug.
   */
  async saveBuilderTemplate(
    userId: string,
    dto: SaveBuilderTemplateDto,
  ): Promise<{ id: string; slug: string }> {
    const client = this.supabase.getClient();
    const slug = `custom-${userId.slice(0, 8)}-${Date.now().toString(36)}`;

    const { data, error } = await client
      .from('report_templates')
      .insert({
        slug,
        name: dto.title,
        description: 'Custom builder template',
        icon: 'FileText',
        tier_required: 'free',
        is_active: true,
        is_public: false,
        config: { sections: dto.sections, userType: dto.user_type },
        created_by: userId,
      })
      .select('id, slug')
      .single();

    if (error || !data) {
      this.logger.error('Failed to save builder template:', error);
      throw new Error('Failed to save builder template');
    }

    return { id: data.id, slug: data.slug };
  }
```

In `reports.controller.ts`, extend the DTO import (lines 25-29):

```ts
import {
  GenerateReportDto,
  SendMessageDto,
  CreateShareDto,
  SaveBuilderTemplateDto,
} from "./dto/generate-report.dto";
```

Add the route immediately after `generateReport` (after line 109):

```ts
  /**
   * Save the current report-builder layout as a private, user-owned template.
   *
   * POST /reports/builder-templates
   */
  @UseGuards(JwtAuthGuard)
  @Post('builder-templates')
  async saveBuilderTemplate(
    @Body() dto: SaveBuilderTemplateDto,
    @AuthUserId() userId: string,
  ) {
    return this.reportsService.saveBuilderTemplate(userId, dto);
  }
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/backend && npx jest save-builder-template`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/backend/src/reports/dto/generate-report.dto.ts" "packages/backend/src/reports/reports.controller.ts" "packages/backend/src/reports/reports.service.ts" "packages/backend/src/reports/__tests__/save-builder-template.spec.ts"
git commit -m "feat(reports): POST /api/reports/builder-templates persists builder layouts"
```

---

### Task 14: Frontend — wire the report builder's "Save Template" button

**Files:**

- Modify: `packages/frontend/lib/data/fetchers/reports-list.ts` (append `saveBuilderTemplate` fetcher)
- Modify: `packages/frontend/app/(app)/reports/builder/hooks/useBuilderState.ts:9` (import), `:456` (interface), after `:599` (function), `:620` (return)
- Modify: `packages/frontend/app/(app)/reports/builder/Builder.tsx:43-59` (destructure), `:227-233` (button)
- Test: `packages/frontend/app/(app)/reports/builder/hooks/__tests__/useBuilderState.save.test.tsx`

**Interfaces:**

- Consumes (from Task 13): endpoint `POST /api/reports/builder-templates` with body `{ title, user_type, sections }`, returning `{ id, slug }`.
- Produces: `saveBuilderTemplate(payload): Promise<{ id: string; slug: string }>` fetcher and `useBuilderState().saveTemplate(): Promise<void>`.

The "Save Template" button (`Builder.tsx:227-233`) has no `onClick`. `useBuilderState` already carries an unused `isSaving` flag (`useBuilderState.ts:28`). NOTE: Task 1 also edits `Builder.tsx` (import line 28 + FAB at 281-285); those edits are below/separate from the button (227-233) and destructure (43-59), so line numbers here are unaffected.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const saveBuilderTemplate = vi
  .fn()
  .mockResolvedValue({ id: "tmpl-1", slug: "custom-x" });
vi.mock("@/lib/data/fetchers/reports-list", () => ({ saveBuilderTemplate }));

import { useBuilderState } from "../useBuilderState";

describe("useBuilderState.saveTemplate", () => {
  it("posts the current layout and clears the dirty flag on success", async () => {
    const { result } = renderHook(() => useBuilderState());

    act(() => {
      result.current.setUserType("investor");
      result.current.addSection("report_title");
    });
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.saveTemplate();
    });

    expect(saveBuilderTemplate).toHaveBeenCalledTimes(1);
    expect(saveBuilderTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ user_type: "investor" }),
    );
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isSaving).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run useBuilderState.save`
      Expected: FAIL — `result.current.saveTemplate` is `undefined` (not a function), so the `await act` call throws.

- [ ] **Step 3: Write minimal implementation**
      Append to `packages/frontend/lib/data/fetchers/reports-list.ts` (it already imports `fetchAPIRaw` and `getAuthHeaders` at lines 9-10):

```ts
export interface SaveBuilderTemplatePayload {
  title: string;
  user_type: "homebuyer" | "investor";
  sections: Record<string, unknown>[];
}

export async function saveBuilderTemplate(
  payload: SaveBuilderTemplatePayload,
): Promise<{ id: string; slug: string }> {
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw("/api/reports/builder-templates", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to save template: ${res.status}`);
  }
  return res.json();
}
```

In `useBuilderState.ts`, add the fetcher import after line 9 (`} from "../../types";`):

```ts
import { saveBuilderTemplate } from "@/lib/data/fetchers/reports-list";
```

In the `UseBuilderStateReturn` interface, add after `loadFromTemplate: (sections: BuilderSection[]) => void;` (line 456):

```ts
saveTemplate: () => Promise<void>;
```

Add the function just before the `// Computed` comment (after `loadFromTemplate`'s definition ends at line 599):

```ts
const saveTemplate = useCallback(async () => {
  setState((prev) => ({ ...prev, isSaving: true }));
  try {
    await saveBuilderTemplate({
      title: state.title,
      user_type: state.userType,
      sections: state.sections as unknown as Record<string, unknown>[],
    });
    setState((prev) => ({ ...prev, isSaving: false, isDirty: false }));
  } catch {
    setState((prev) => ({ ...prev, isSaving: false }));
  }
}, [state.title, state.userType, state.sections]);
```

Add `saveTemplate,` to the returned object — insert after `loadFromTemplate,` (line 620):

```ts
    loadFromTemplate,
    saveTemplate,
    selectedSection,
```

In `Builder.tsx`, extend the destructure (lines 43-59) — replace the tail `isDirty, / selectedSection, } = builderState;` with:

```tsx
    isDirty,
    isSaving,
    selectedSection,
    saveTemplate,
  } = builderState;
```

Wire the button (lines 227-233):

```tsx
<button
  onClick={saveTemplate}
  disabled={sections.length === 0 || isSaving}
  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
>
  <Save className="w-4 h-4" />
  {isSaving ? "Saving…" : "Save Template"}
</button>
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run useBuilderState.save`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/lib/data/fetchers/reports-list.ts" "packages/frontend/app/(app)/reports/builder/hooks/useBuilderState.ts" "packages/frontend/app/(app)/reports/builder/Builder.tsx" "packages/frontend/app/(app)/reports/builder/hooks/__tests__/useBuilderState.save.test.tsx"
git commit -m "feat(reports): wire Save Template button to persist builder layout"
```

---

### Task 15: Backend — evaluate PropertyIQ-Score alerts against propertyiq_scores_v2

**Files:**

- Modify: `packages/backend/src/alerts/alert-processor.service.ts:262-281` (`fetchCurrentMetricValue`)
- Test: `packages/backend/src/alerts/__tests__/alert-processor-score-metric.spec.ts`

**Interfaces:**

- Consumes: the `propertyiq_scores_v2` columns `geography`, `location_id`, `score_type`, `score`, `score_date` (verified in `scoring/scoring-persistence.ts:37-52` and the upsert conflict key `geography,location_id,score_type,score_date`).
- Produces: no exported API change — `fetchCurrentMetricValue` is private. The daily cron now resolves the `propertyiq_score` metric.
- Relates to: the Screener "Set Alert → PropertyIQ Score" chip (Task 16) writes alerts with `metric_id: 'propertyiq_score'`, stored in `user_alerts.metric_name`, which this branch reads. This is metric-_table routing_ for the alert evaluator, not a `MetricResolutionService` fallback chain (see Global Constraints).

Today `fetchCurrentMetricValue` (`:262-281`) only queries `calculated_metrics`. The PropertyIQ Score is not a column there, so score alerts silently never trigger.

- [ ] **Step 1: Write the failing test**

```ts
import { Test, TestingModule } from "@nestjs/testing";
import { AlertProcessorService } from "../alert-processor.service";
import { SupabaseService } from "../../supabase/supabase.service";
import { AlertsService } from "../alerts.service";
import { PushService } from "../../push/push.service";

function createSupabaseMock(
  activeAlerts: any[],
  values: { calculated_metrics?: number; propertyiq_scores_v2?: number },
) {
  return {
    from: jest.fn((table: string) => {
      if (table === "user_alerts") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() =>
              Promise.resolve({ data: activeAlerts, error: null }),
            ),
          })),
          update: jest.fn(() => ({
            in: jest.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }
      if (table === "calculated_metrics") {
        return {
          select: jest.fn((metricId: string) => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    single: jest.fn(() =>
                      Promise.resolve({
                        data: { [metricId]: values.calculated_metrics ?? null },
                        error: null,
                      }),
                    ),
                  })),
                })),
              })),
            })),
          })),
        };
      }
      if (table === "propertyiq_scores_v2") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => ({
                      single: jest.fn(() =>
                        Promise.resolve({
                          data: { score: values.propertyiq_scores_v2 ?? null },
                          error: null,
                        }),
                      ),
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }
      if (table === "alert_history") {
        return {
          insert: jest.fn(() => Promise.resolve({ error: null })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table in mock: ${table}`);
    }),
  };
}

async function buildService(client: any, push: jest.Mock) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AlertProcessorService,
      { provide: SupabaseService, useValue: { getClient: () => client } },
      {
        provide: AlertsService,
        useValue: { getUnreadCount: jest.fn().mockResolvedValue(0) },
      },
      { provide: PushService, useValue: { sendToUser: push } },
    ],
  }).compile();
  return module.get(AlertProcessorService);
}

const baseAlert = {
  id: "alert-1",
  user_id: "user-1",
  geography_type: "metro",
  geography_id: "12420",
  geography_name: "Austin, TX",
  condition_type: "above",
  is_active: true,
  last_triggered_at: null,
};

describe("AlertProcessorService metric routing", () => {
  it("reads calculated_metrics for a non-score metric (existing behavior)", async () => {
    const push = jest.fn().mockResolvedValue({ sent: 1, failed: 0, pruned: 0 });
    const client = createSupabaseMock(
      [{ ...baseAlert, metric_name: "home_value", threshold_value: 100000 }],
      { calculated_metrics: 150000 },
    );
    const service = await buildService(client, push);
    await service.processAlerts();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][1].body).toBe(
      "home_value crossed 100000 (now 150000)",
    );
  });

  it("reads propertyiq_scores_v2 for the propertyiq_score metric (new branch)", async () => {
    const push = jest.fn().mockResolvedValue({ sent: 1, failed: 0, pruned: 0 });
    const client = createSupabaseMock(
      [{ ...baseAlert, metric_name: "propertyiq_score", threshold_value: 50 }],
      { propertyiq_scores_v2: 72 },
    );
    const service = await buildService(client, push);
    await service.processAlerts();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][1].body).toBe(
      "propertyiq_score crossed 50 (now 72)",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/backend && npx jest alert-processor-score-metric`
      Expected: FAIL — the second test throws "Unexpected table in mock: propertyiq_scores_v2" (the service still routes every metric to `calculated_metrics`).

- [ ] **Step 3: Write minimal implementation**
      Replace `fetchCurrentMetricValue` (`alert-processor.service.ts:262-281`) with:

```ts
  private async fetchCurrentMetricValue(
    metricId: string,
    geoType: string,
    geoId: string,
  ): Promise<number | null> {
    const client = this.supabase.getClient();

    // PropertyIQ Score lives in propertyiq_scores_v2, not calculated_metrics.
    // Take the latest score_date for this geography.
    if (metricId === 'propertyiq_score') {
      const { data: scoreRow } = await client
        .from('propertyiq_scores_v2')
        .select('score')
        .eq('geography', geoType)
        .eq('location_id', geoId)
        .eq('score_type', 'propertyiq')
        .order('score_date', { ascending: false })
        .limit(1)
        .single();

      if (scoreRow?.score != null) return Number(scoreRow.score);
      return null;
    }

    // Try calculated_metrics first (most metrics are there)
    const { data } = await client
      .from('calculated_metrics')
      .select(metricId)
      .eq('geography_type', geoType)
      .eq('geography_id', geoId)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (data?.[metricId] != null) return Number(data[metricId]);
    return null;
  }
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/backend && npx jest alert-processor-score-metric`
      Expected: PASS (both tests)

- [ ] **Step 5: Commit**

```bash
git add "packages/backend/src/alerts/alert-processor.service.ts" "packages/backend/src/alerts/__tests__/alert-processor-score-metric.spec.ts"
git commit -m "fix(alerts): evaluate propertyiq_score alerts against propertyiq_scores_v2"
```

---

### Task 16: Screener — build the row alert sub-step (metric picker + CreateAlertForm)

**Files:**

- Create: `packages/frontend/app/(app)/screener/components/ScreenerRowAlertStep.tsx`
- Test: `packages/frontend/app/(app)/screener/components/__tests__/ScreenerRowAlertStep.test.tsx`

**Interfaces:**

- Consumes: `ScreenerRow` fields `geo_level`, `region_id`, `region_name`, `score`, `median_price`, `cap_rate`, `months_of_supply`, `overvalued_pct` (verified in `lib/data/fetchers/screener.ts:52-78`); `createAlert` + `formatGeoDisplayName` from `@/lib/data`; `CreateAlertForm` (props `metricId, metricName, currentValue, geographyType, geographyId, geographyName, onSubmit, onClose, className`, verified in `components/alerts/CreateAlertForm.tsx:7-17`); the paid gate `tier === "pro" | "enterprise" | "admin"` + the `createAlert` submit shape (copied from `components/alerts/MetricAlertBell.tsx:33-34,58-75`).
- Produces: `ScreenerRowAlertStep` with props `{ row: ScreenerRow; onClose: () => void }`. **Task 17 mounts it.**

The "PropertyIQ Score" chip uses `metricId: "propertyiq_score"` — the id Task 15's backend branch reads. Only chips whose row value is non-null are shown (faithful to the design: aggregate/compute within the design, surface real gaps — a null metric simply has no chip).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ tier: "pro" }),
}));
vi.mock("@/lib/data", () => ({
  createAlert: vi.fn().mockResolvedValue({ id: "al-1" }),
  formatGeoDisplayName: (s: string) => s,
}));
vi.mock("@/lib/analytics/tracker", () => ({ trackEvent: () => {} }));

import { ScreenerRowAlertStep } from "../ScreenerRowAlertStep";

const row = {
  geo_level: "metro",
  region_id: "12420",
  region_name: "Austin, TX",
  score: 72,
  median_price: 450000,
  cap_rate: 5.1,
  months_of_supply: 2.3,
  overvalued_pct: 8.4,
} as any;

describe("ScreenerRowAlertStep", () => {
  it("shows metric chips and opens the alert form on selection", () => {
    const { getByText, queryByText } = render(
      <ScreenerRowAlertStep row={row} onClose={vi.fn()} />,
    );
    expect(getByText("PropertyIQ Score")).toBeTruthy();
    expect(queryByText("Create Alert")).toBeNull();
    fireEvent.click(getByText("Cap Rate"));
    expect(getByText("Create Alert")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run ScreenerRowAlertStep`
      Expected: FAIL with "Cannot find module '../ScreenerRowAlertStep'" (the component does not exist yet).

- [ ] **Step 3: Write minimal implementation**
      Create `packages/frontend/app/(app)/screener/components/ScreenerRowAlertStep.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createAlert,
  formatGeoDisplayName,
  type ScreenerRow,
} from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";
import { CreateAlertForm } from "@/components/alerts/CreateAlertForm";

interface AlertMetricOption {
  id: string;
  name: string;
  value: number;
}

interface ScreenerRowAlertStepProps {
  row: ScreenerRow;
  onClose: () => void;
}

/**
 * Alert sub-step for a screener row: pick a metric, then set a threshold via
 * CreateAlertForm. Paid-only (same gate as the /alerts page + MetricAlertBell).
 */
export function ScreenerRowAlertStep({
  row,
  onClose,
}: ScreenerRowAlertStepProps) {
  const { tier } = useEntitlements();
  const isPaid = tier === "pro" || tier === "enterprise" || tier === "admin";
  const [selected, setSelected] = useState<AlertMetricOption | null>(null);

  const options: AlertMetricOption[] = [
    {
      id: "propertyiq_score",
      name: "PropertyIQ Score",
      value: row.score as number,
    },
    {
      id: "median_price",
      name: "Median Price",
      value: row.median_price as number,
    },
    { id: "cap_rate", name: "Cap Rate", value: row.cap_rate as number },
    {
      id: "months_of_supply",
      name: "Months of Supply",
      value: row.months_of_supply as number,
    },
    {
      id: "overvalued_pct",
      name: "Overvalued %",
      value: row.overvalued_pct as number,
    },
  ].filter((option) => option.value !== null && option.value !== undefined);

  if (!isPaid) {
    return (
      <div className="p-3">
        <p className="text-xs text-on-surface-variant">
          Alerts are a Pro feature.
        </p>
        <Link
          href="/pricing"
          className="mt-2 inline-flex text-xs font-medium text-primary hover:text-primary/80"
        >
          Upgrade to Pro →
        </Link>
      </div>
    );
  }

  const handleSubmit = async (data: {
    metric_id: string;
    condition: string;
    threshold: number;
    geography_type: string;
    geography_id: string;
    geography_name: string;
  }) => {
    const result = await createAlert({
      geography_type: data.geography_type,
      geography_id: data.geography_id,
      geography_name: data.geography_name,
      metric_id: data.metric_id,
      condition: data.condition as "above" | "below",
      threshold: data.threshold,
    });
    return !!result;
  };

  if (selected) {
    return (
      <CreateAlertForm
        metricId={selected.id}
        metricName={selected.name}
        currentValue={selected.value}
        geographyType={row.geo_level}
        geographyId={row.region_id}
        geographyName={formatGeoDisplayName(row.region_name)}
        onSubmit={handleSubmit}
        onClose={onClose}
        className="border-none"
      />
    );
  }

  return (
    <div className="p-3">
      <p className="mb-2 text-xs font-medium text-on-surface">
        Set an alert on…
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelected(option)}
            className="rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 text-xs text-on-surface transition-colors hover:bg-surface-container-high"
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run ScreenerRowAlertStep`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/screener/components/ScreenerRowAlertStep.tsx" "packages/frontend/app/(app)/screener/components/__tests__/ScreenerRowAlertStep.test.tsx"
git commit -m "feat(screener): row alert sub-step (metric picker + CreateAlertForm)"
```

---

### Task 17: Screener — build the row action menu (ScreenerRowMenu)

**Files:**

- Create: `packages/frontend/app/(app)/screener/components/ScreenerRowMenu.tsx`
- Test: `packages/frontend/app/(app)/screener/components/__tests__/ScreenerRowMenu.test.tsx`

**Interfaces:**

- Consumes (Task 16): `ScreenerRowAlertStep` with props `{ row: ScreenerRow; onClose: () => void }`. Also `useWatchlist` from `@/lib/watchlist/useWatchlist` (returns `isInWatchlist(type,id)`, `addToWatchlist(type,id,name)`, `removeFromWatchlist(id)`, `items`; verified in `lib/watchlist/useWatchlist.ts`); tier-gating via `useEntitlements().getAccess("feature","watchlist_limit"|"reports")`, `useIsAnonymous`, `AnonCaptureModal`, `buildAnonReturnTo`, `PaywallCard` (all copied from `map/components/RightDetailPanel/QuickActions.tsx`); portal + positioning + dismiss + `useModalHistory(true,onClose,"screener-row-menu")` (copied from `map/components/MapContextMenu.tsx`); the `/map` deep-link contract `geo/id/name/state` (verified in `map/hooks/useMapDeepLinkNav.ts:45-56`); the report prefill via `localStorage["propertyiq-report-prefill"]` (copied from `QuickActions.handleGenerateReport`).
- Produces: `ScreenerRowMenu` with props `{ row: ScreenerRow; x: number; y: number; onClose: () => void }`. **Task 18 mounts it.**

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/watchlist/useWatchlist", () => ({
  useWatchlist: () => ({
    isInWatchlist: () => false,
    addToWatchlist: vi.fn(),
    removeFromWatchlist: vi.fn(),
    items: [],
  }),
}));
vi.mock("@/lib/entitlements", () => ({
  useEntitlements: () => ({ getAccess: () => ({ level: "full" }) }),
}));
vi.mock("@/lib/entitlements/useIsAnonymous", () => ({
  useIsAnonymous: () => false,
}));
vi.mock("@/lib/entitlements/buildAnonReturnTo", () => ({
  buildAnonReturnTo: () => "",
}));
vi.mock("@/components/entitlements/AnonCaptureModal", () => ({
  AnonCaptureModal: () => <div />,
}));
vi.mock("@/components/entitlements/PaywallCard", () => ({
  PaywallCard: () => <div />,
}));
vi.mock("@/lib/pwa/use-modal-history", () => ({ useModalHistory: () => {} }));
vi.mock("@/lib/data", () => ({ formatGeoDisplayName: (s: string) => s }));
vi.mock("../ScreenerRowAlertStep", () => ({
  ScreenerRowAlertStep: () => <div data-testid="alert-step" />,
}));

import { ScreenerRowMenu } from "../ScreenerRowMenu";

const row = {
  geo_level: "metro",
  region_id: "12420",
  region_name: "Austin, TX",
  state_code: "TX",
  score: 72,
} as any;

describe("ScreenerRowMenu", () => {
  it("navigates to the map with the geo/id/name/state deep-link params", () => {
    render(<ScreenerRowMenu row={row} x={0} y={0} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("View on Map"));
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("/map?");
    expect(url).toContain("geo=metro");
    expect(url).toContain("id=12420");
    expect(url).toContain("state=TX");
  });

  it("reveals the alert sub-step when Set Alert is chosen", () => {
    render(<ScreenerRowMenu row={row} x={0} y={0} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Set Alert"));
    expect(screen.getByTestId("alert-step")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run ScreenerRowMenu`
      Expected: FAIL with "Cannot find module '../ScreenerRowMenu'" (the component does not exist yet).

- [ ] **Step 3: Write minimal implementation**
      Create `packages/frontend/app/(app)/screener/components/ScreenerRowMenu.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Heart, Map, FileText, Bell, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEntitlements } from "@/lib/entitlements";
import { useWatchlist } from "@/lib/watchlist/useWatchlist";
import { useIsAnonymous } from "@/lib/entitlements/useIsAnonymous";
import { buildAnonReturnTo } from "@/lib/entitlements/buildAnonReturnTo";
import { AnonCaptureModal } from "@/components/entitlements/AnonCaptureModal";
import { PaywallCard } from "@/components/entitlements/PaywallCard";
import { useModalHistory } from "@/lib/pwa/use-modal-history";
import { formatGeoDisplayName, type ScreenerRow } from "@/lib/data";
import { ScreenerRowAlertStep } from "./ScreenerRowAlertStep";

interface ScreenerRowMenuProps {
  row: ScreenerRow;
  x: number;
  y: number;
  onClose: () => void;
}

export function ScreenerRowMenu({ row, x, y, onClose }: ScreenerRowMenuProps) {
  const router = useRouter();
  const { user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { isInWatchlist, addToWatchlist, removeFromWatchlist, items } =
    useWatchlist({ userId: user?.id ?? "", autoLoad: !!user?.id });
  const { getAccess } = useEntitlements();
  const isAnonymous = useIsAnonymous();

  const [toggling, setToggling] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [overlay, setOverlay] = useState<
    "watchlist" | "reports" | "anon-watchlist" | "anon-reports" | null
  >(null);

  const watchlistLocked =
    getAccess("feature", "watchlist_limit").level === "none";
  const reportAccess = getAccess("feature", "reports");
  const isSaved = isInWatchlist(row.geo_level, row.region_id);
  const displayName = formatGeoDisplayName(row.region_name);

  const [pos, setPos] = useState({ top: y, left: x });
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const margin = 8;
    let top = y;
    let left = x;
    if (left + rect.width + margin > window.innerWidth) {
      left = window.innerWidth - rect.width - margin;
    }
    if (top + rect.height + margin > window.innerHeight) {
      top = window.innerHeight - rect.height - margin;
    }
    setPos({ top, left });
  }, [x, y]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        (!overlayRef.current || !overlayRef.current.contains(target))
      ) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useModalHistory(true, onClose, "screener-row-menu");

  const handleFavorite = async () => {
    if (isAnonymous) {
      setOverlay("anon-watchlist");
      return;
    }
    if (watchlistLocked) {
      setOverlay("watchlist");
      return;
    }
    if (!user?.id || toggling) return;
    setToggling(true);
    try {
      if (isSaved) {
        const item = items.find(
          (i) =>
            i.geography_type === row.geo_level &&
            i.geography_id === row.region_id,
        );
        if (item) await removeFromWatchlist(item.id);
      } else {
        await addToWatchlist(row.geo_level, row.region_id, displayName);
      }
    } finally {
      setToggling(false);
    }
  };

  const handleViewOnMap = () => {
    const params = new URLSearchParams({
      geo: row.geo_level,
      id: row.region_id,
      name: displayName,
    });
    if (row.state_code) params.set("state", row.state_code);
    router.push(`/map?${params.toString()}`);
    onClose();
  };

  const handleGenerateReport = () => {
    if (isAnonymous) {
      setOverlay("anon-reports");
      return;
    }
    if (reportAccess.level === "none") {
      setOverlay("reports");
      return;
    }
    try {
      localStorage.setItem(
        "propertyiq-report-prefill",
        JSON.stringify({
          id: row.region_id,
          name: displayName,
          type: row.geo_level,
          state: row.state_code,
        }),
      );
    } catch {
      /* ignore */
    }
    router.push(
      reportAccess.level === "full"
        ? "/reports?rtype=homebuyer"
        : "/reports/sample",
    );
    onClose();
  };

  return createPortal(
    <>
      <div
        ref={menuRef}
        className="fixed z-[99999] min-w-[220px] rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-1.5 elevation-3"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="border-b border-outline-variant/30 px-3 py-2">
          <div className="truncate text-xs font-semibold text-on-surface">
            {displayName}
          </div>
          <div className="text-[10px] capitalize text-on-surface-variant">
            {row.geo_level}
          </div>
        </div>

        {showAlert ? (
          <ScreenerRowAlertStep row={row} onClose={onClose} />
        ) : (
          <>
            <button
              onClick={handleFavorite}
              disabled={toggling}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
            >
              {toggling ? (
                <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
              ) : (
                <Heart
                  className={`h-4 w-4 ${isSaved ? "fill-primary text-primary" : "text-on-surface-variant"}`}
                />
              )}
              <span className="flex-1 text-left">
                {isSaved ? "Favorited" : "Favorite"}
              </span>
              {watchlistLocked && (
                <Lock className="h-3 w-3 text-on-surface-variant/60" />
              )}
            </button>

            <button
              onClick={handleViewOnMap}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-container"
            >
              <Map className="h-4 w-4 text-on-surface-variant" />
              <span className="flex-1 text-left">View on Map</span>
            </button>

            <button
              onClick={handleGenerateReport}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-container"
            >
              <FileText className="h-4 w-4 text-on-surface-variant" />
              <span className="flex-1 text-left">Generate Report</span>
              {reportAccess.level === "none" && (
                <Lock className="h-3 w-3 text-on-surface-variant/60" />
              )}
            </button>

            <button
              onClick={() => setShowAlert(true)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-on-surface transition-colors hover:bg-surface-container"
            >
              <Bell className="h-4 w-4 text-on-surface-variant" />
              <span className="flex-1 text-left">Set Alert</span>
              <span className="text-on-surface-variant/60">›</span>
            </button>
          </>
        )}
      </div>

      {overlay && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-scrim/40"
          onClick={() => setOverlay(null)}
        >
          <div className="mx-4 max-w-sm" onClick={(e) => e.stopPropagation()}>
            {overlay === "anon-watchlist" || overlay === "anon-reports" ? (
              <AnonCaptureModal
                featureName={
                  overlay === "anon-watchlist" ? "Favorites" : "Reports"
                }
                returnTo={buildAnonReturnTo(
                  window.location.pathname,
                  window.location.search,
                  undefined,
                )}
                onDismiss={() => setOverlay(null)}
              />
            ) : (
              <PaywallCard
                type="feature"
                id={overlay === "watchlist" ? "watchlist_limit" : "reports"}
                title={
                  overlay === "watchlist"
                    ? "Unlock Favorites"
                    : "Unlock Reports"
                }
              />
            )}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run ScreenerRowMenu`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/screener/components/ScreenerRowMenu.tsx" "packages/frontend/app/(app)/screener/components/__tests__/ScreenerRowMenu.test.tsx"
git commit -m "feat(screener): row action menu (Favorite / Map / Report / Set Alert)"
```

---

### Task 18: Screener — make rows navigate and mount the row menu

**Files:**

- Modify: `packages/frontend/app/(app)/screener/components/ScreenerTable.tsx` — imports (`:3-4`, after `:6`, after `:14`), body (after `:146`), columns (`:148-162`), row `<tr>` (`:229-239`), row cells (after `:317`), container close (after `:322`)
- Test: `packages/frontend/app/(app)/screener/components/__tests__/ScreenerTable.interactions.test.tsx`

**Interfaces:**

- Consumes (Task 17): `ScreenerRowMenu` with props `{ row: ScreenerRow; x: number; y: number; onClose: () => void }`.
- Consumes: the `/market/[id]?type=<geo>&view=investor&state=<st>` convention (from `market/TopMarketsSection.tsx:155` which uses `?type=&view=investor`, plus the `state` param from `QuickActions`/`MapContextMenu`).
- Produces: nothing later tasks rely on.

Screener rows are fully inert (`ScreenerTable.tsx:228-318`). Add whole-row navigation and a trailing kebab column that opens `ScreenerRowMenu` (the kebab `stopPropagation`s so it does not also trigger row navigation).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/data", () => ({
  formatMetricValue: (v: number | null) => String(v),
  formatGeoDisplayName: (s: string) => s,
}));
vi.mock("../ScreenerRowMenu", () => ({
  ScreenerRowMenu: () => <div data-testid="row-menu" />,
}));

import { ScreenerTable } from "../ScreenerTable";

const row = {
  geo_level: "metro",
  region_id: "12420",
  region_name: "Austin, TX",
  state_code: "TX",
  score: 72,
  grade: "A",
  confidence: 90,
  median_price: 450000,
  home_value: 460000,
  rent: 1800,
  cap_rate: 5.1,
  gross_yield: 6,
  rent_to_price_ratio: 0.5,
  grm: 12,
  months_of_supply: 2.3,
  overvalued_pct: 8.4,
  score_chg_1m: 1,
  score_chg_3m: 2,
  score_chg_6m: 3,
  score_chg_1y: 4,
  score_chg_3y: 5,
  score_chg_5y: 6,
  population: 1000000,
  as_of: "2026-05-31",
  refreshed_at: "2026-06-01",
} as any;

const baseProps = {
  rows: [row],
  sortBy: "score" as const,
  sortOrder: "desc" as const,
  page: 0,
  pageSize: 50,
  isFetching: false,
  onSort: vi.fn(),
};

describe("ScreenerTable interactions", () => {
  it("navigates to the market page when a row is clicked", () => {
    render(<ScreenerTable {...baseProps} />);
    fireEvent.click(screen.getByText("Austin, TX"));
    expect(push).toHaveBeenCalledWith(
      "/market/12420?type=metro&view=investor&state=TX",
    );
  });

  it("opens the row action menu from the kebab button", () => {
    render(<ScreenerTable {...baseProps} />);
    fireEvent.click(screen.getByLabelText("Row actions"));
    expect(screen.getByTestId("row-menu")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
      Run: `cd packages/frontend && npx vitest run ScreenerTable.interactions`
      Expected: FAIL — clicking the row calls no navigation (`push` never called) and there is no "Row actions" button (`getByLabelText` throws).

- [ ] **Step 3: Write minimal implementation**
      In `ScreenerTable.tsx`, update the imports. Replace line 3:

```tsx
import React, { useState } from "react";
```

Replace line 4:

```tsx
import { ArrowUp, ArrowDown, ChevronsUpDown, MoreVertical } from "lucide-react";
```

Add after line 6 (`import { formatMetricValue, formatGeoDisplayName } from "@/lib/data";`):

```tsx
import { useRouter } from "next/navigation";
```

Add after line 14 (`import { ScrollShadowContainer } from "./ScrollShadowContainer";`):

```tsx
import { ScreenerRowMenu } from "./ScreenerRowMenu";
```

In the component body, add after `const baseRank = page * pageSize + 1;` (line 146):

```tsx
const router = useRouter();
const [menu, setMenu] = useState<{
  row: ScreenerRow;
  x: number;
  y: number;
} | null>(null);

const handleRowClick = (clickedRow: ScreenerRow) => {
  const params = new URLSearchParams({
    type: clickedRow.geo_level,
    view: "investor",
  });
  if (clickedRow.state_code) params.set("state", clickedRow.state_code);
  router.push(`/market/${clickedRow.region_id}?${params.toString()}`);
};
```

Add the trailing kebab column to the `columns` array — insert immediately before the closing `];` (line 162):

```tsx
    { key: null, label: "", align: "right" },
```

Make the row `<tr>` (lines 229-239) clickable — add `onClick` and `cursor-pointer`:

```tsx
                <tr
                  key={`${row.geo_level}-${row.region_id}`}
                  onClick={() => handleRowClick(row)}
                  className="
                    animate-screener-row cursor-pointer
                    border-b border-outline-variant/40 last:border-0
                    hover:bg-primary-container/10 transition-colors duration-100
                  "
                  style={{
                    animationDelay: `${Math.min(i * 20, 300)}ms`,
                  }}
                >
```

Add the kebab cell as the last cell in the row — insert after the Overvalued % `</td>` (line 317) and before `</tr>` (line 318):

```tsx
{
  /* Row actions */
}
<td className="px-2 py-3 text-right">
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setMenu({ row, x: rect.right, y: rect.bottom });
    }}
    aria-label="Row actions"
    className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
  >
    <MoreVertical className="h-4 w-4" />
  </button>
</td>;
```

Render the menu — insert after the `)}` that closes the empty-state/table ternary (line 323, right after `</ScrollShadowContainer>` + `)}`) and before the outer container `</div>`:

```tsx
{
  menu && (
    <ScreenerRowMenu
      row={menu.row}
      x={menu.x}
      y={menu.y}
      onClose={() => setMenu(null)}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
      Run: `cd packages/frontend && npx vitest run ScreenerTable.interactions`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/screener/components/ScreenerTable.tsx" "packages/frontend/app/(app)/screener/components/__tests__/ScreenerTable.interactions.test.tsx"
git commit -m "feat(screener): row-tap navigation + kebab row action menu"
```

---

### Task 19: Delete orphaned reports dashboard components

**Files:**

- Delete: `packages/frontend/app/(app)/reports/Dashboard.tsx`
- Delete: `packages/frontend/app/(app)/reports/DashboardRefined.tsx`
- Delete: `packages/frontend/app/(app)/reports/components/ReportHistory.tsx`
- Delete: `packages/frontend/app/(app)/reports/components/ReportHistoryRefined.tsx`
- Modify: `packages/frontend/tests/e2e/report-builder-flow.spec.ts:31,35,55` (stale comments)

**Interfaces:**

- Consumes: nothing.
- Produces: nothing. Pure cleanup. The live `/reports` route is `app/(app)/reports/page.tsx`, which defines its OWN local `ReportHistory()` function (`page.tsx:29`) and does NOT import any of these files. `Dashboard.tsx` and `DashboardRefined.tsx` both import `ReportHistoryRefined.tsx`, and nothing else imports any of the four — they form a closed, unmounted subgraph.

- [ ] **Step 1: Verify the orphan status (must pass before deleting)**
      Run: `cd packages/frontend && grep -rn "DashboardRefined\|ReportHistoryRefined\|components/ReportHistory\|reports/Dashboard" app tests --include=*.ts --include=*.tsx`
      Expected: matches appear ONLY inside the four files being deleted (their own definitions + `Dashboard.tsx`/`DashboardRefined.tsx` importing `ReportHistoryRefined`) and as three comment lines in `tests/e2e/report-builder-flow.spec.ts`. If any OTHER `app/` source file imports them, STOP and re-plan.

- [ ] **Step 2: Update the stale e2e comments**
      In `tests/e2e/report-builder-flow.spec.ts`, replace line 31:

```tsx
// The /reports page renders a top-level heading.
```

replace line 35:

```tsx
// The empty state renders "No reports yet" in the reports list.
```

replace line 55:

```tsx
// The builder wizard is embedded in the /reports page.
```

- [ ] **Step 3: Delete the four orphaned files**

```bash
git rm "packages/frontend/app/(app)/reports/Dashboard.tsx" "packages/frontend/app/(app)/reports/DashboardRefined.tsx" "packages/frontend/app/(app)/reports/components/ReportHistory.tsx" "packages/frontend/app/(app)/reports/components/ReportHistoryRefined.tsx"
```

- [ ] **Step 4: Verify nothing broke (typecheck)**
      Run: `cd packages/frontend && npx tsc --noEmit`
      Expected: PASS — no "Cannot find module" / dangling-import errors introduced by the deletion.

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/tests/e2e/report-builder-flow.spec.ts"
git commit -m "chore(reports): delete orphaned Dashboard/ReportHistory components"
```

---

### Task 20: Delete the abandoned V1 graphs dead-code subgraph

**Files:**

- Delete: `packages/frontend/app/(app)/graphs/Dashboard.tsx`
- Delete: `packages/frontend/app/(app)/graphs/components/InsightsPanel.tsx`
- Delete: `packages/frontend/app/(app)/graphs/services/geminiService.ts`
- Delete (whole dir): `packages/frontend/app/(app)/graphs/components/GraphsPage/` (`GraphsPage.tsx`, `index.ts`)
- Delete (whole dir): `packages/frontend/app/(app)/graphs/components/ExplorationSidebar/` (`ExplorationSidebar.tsx`, `QuestionCards.tsx`, `ReportCTA.tsx`, `MetricExplorer.tsx`, `index.ts`)
- Delete (whole dir): `packages/frontend/app/(app)/graphs/components/HeroComparison/` (`HeroComparison.tsx`, `PriorityBreakdown.tsx`, `TemplateTabs.tsx`, `TemplateVisualization.tsx`, `ScoreShowdown.tsx`, `index.ts`)

**Interfaces:**

- Consumes: nothing.
- Produces: nothing. Pure cleanup. The live `/graphs` route is `app/(app)/graphs/page.tsx`, which imports `GraphsPageV2` + `GraphsPageSkeleton` only. The V1 subgraph is rooted at two unmounted files — `Dashboard.tsx` (→ `services/geminiService`, `components/InsightsPanel`) and `components/GraphsPage/GraphsPage.tsx` (→ `HeroComparison`, `ExplorationSidebar`) — neither of which is imported by any live file.

- [ ] **Step 1: Verify the orphan status (must pass before deleting)**
      Run: `cd packages/frontend && grep -rn "graphs/Dashboard\|components/GraphsPage\|ExplorationSidebar\|HeroComparison\|components/InsightsPanel\|services/geminiService\|from \"\./Dashboard\"" app/\(app\)/graphs`
      Expected: every match is INTERNAL to the dead subgraph (`Dashboard.tsx`, `GraphsPage/`, `ExplorationSidebar/`, `HeroComparison/`, `InsightsPanel.tsx`, `geminiService.ts` referencing each other). Confirm `app/(app)/graphs/page.tsx` and `app/(app)/graphs/components/GraphsPageV2/GraphsPageV2.tsx` do NOT appear as importers. If either does, STOP and re-plan.

- [ ] **Step 2: Delete the dead files/directories**

```bash
git rm "packages/frontend/app/(app)/graphs/Dashboard.tsx" "packages/frontend/app/(app)/graphs/components/InsightsPanel.tsx" "packages/frontend/app/(app)/graphs/services/geminiService.ts"
git rm -r "packages/frontend/app/(app)/graphs/components/GraphsPage" "packages/frontend/app/(app)/graphs/components/ExplorationSidebar" "packages/frontend/app/(app)/graphs/components/HeroComparison"
```

- [ ] **Step 3: Verify nothing broke (typecheck)**
      Run: `cd packages/frontend && npx tsc --noEmit`
      Expected: PASS — no "Cannot find module" / dangling-import errors introduced by the deletion.

- [ ] **Step 4: Verify the live graphs route still builds its imports**
      Run: `cd packages/frontend && grep -rn "GraphsPageV2\|GraphsPageSkeleton" "app/(app)/graphs/page.tsx"`
      Expected: `page.tsx` still imports `GraphsPageV2` and `GraphsPageSkeleton` — both untouched — confirming the live route is intact.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(graphs): delete abandoned V1 graphs dead-code subgraph"
```
