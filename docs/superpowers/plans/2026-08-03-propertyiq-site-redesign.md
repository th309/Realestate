# PropertyIQ Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every PropertyIQ surface — marketing, blog, and the five authed tools — onto one shared layout and typographic system, so the whole site reads as a single product.

**Architecture:** Two primitive layers sit under everything. `app/components/marketing/` owns the public surfaces: one container width, one gutter, two vertical rhythms, four heading scales, alternating surface bands. `app/components/app-shell/` owns the authed tools: one application bar, one control bar, and the repeated data units (KPI tile, data table, score pill, jump bar). Pages consume primitives and never write spacing, heading, or colour utilities inline. Two unit tests enforce it: one asserts the layout contract stays singular, one fails on any hardcoded hex.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (`@theme inline` in `app/globals.css`), Vitest 3 + `@testing-library/react` 16, TypeScript, Mapbox GL, Recharts.

**Approved visual targets** — each phase implements its mockup:

| Surface           | Mockup                                                               |
| ----------------- | -------------------------------------------------------------------- |
| Homepage + blog   | https://claude.ai/code/artifact/99e2d97d-df27-4d55-9f7b-83da181b3697 |
| Analyzer          | https://claude.ai/code/artifact/3218c833-210f-4bc8-8e68-6351ea9533ca |
| Reports           | https://claude.ai/code/artifact/bd22f957-f9c9-4d8d-b1f0-a7abef9b220d |
| Screener          | https://claude.ai/code/artifact/f4d5ad0d-84ea-43ed-be9f-c9bb743a28e0 |
| Map (chrome only) | https://claude.ai/code/artifact/c2a2557f-0576-4a24-a720-20d0e0032f78 |
| Market            | https://claude.ai/code/artifact/bf98674e-7cff-4a49-9253-5369e78dbf7a |

## Global Constraints

Every task's requirements implicitly include this section.

- **No hardcoded hex in TSX.** Semantic tokens only (`bg-surface`, `text-on-surface`, `border-outline-variant`). CLAUDE.md §1.1, §8.2. `bg-[#3949AB]` is forbidden.
- **New colours go in `app/globals.css` only**, following the existing convention: raw value as `--md-<name>` in `:root` (line 9) _and_ in the `@media (prefers-color-scheme: dark)` block (line 86), then mapped as `--color-<name>: var(--md-<name>)` inside `@theme inline` (line 146).
- **File size:** logic/util files under 300 lines, React components under 400. One exported component per file plus local helpers; two or more exports means split. CLAUDE.md §1.3.
- **Numbers use Roboto Mono** with `tabular-nums`. Scores, metrics, currency, percentages. CLAUDE.md §8.3.
- **One number format per quantity type per screen.** A true minus sign `−`, not a hyphen. `−$386` in a KPI tile and `-$386` in a table on the same page is a defect.
- **Shape:** cards `rounded-xl`, buttons and chips `rounded-full`, dialogs `rounded-[28px]`. Cards get `shadow-sm`. CLAUDE.md §8.4.
- **PropertyIQ Score is 1–99**, 50 = that market's state average. Never "0–100".
- **Score labels are momentum words** (VERY STRONG / STRONG / RISING / FIRMING / STEADY / EASING / WEAK / VERY WEAK) via `getScoreLabel()`. Never quality words. Confidence is a separate A/B/C/F data-quality grade. CLAUDE.md §9.
- **Coverage copy** comes from `COVERAGE_COPY` / `formatMarketsScored()` in `lib/data/validation-claims.ts`. Never hardcode market counts.
- **Data fetching** goes through `@/lib/data`. Never add a bare `fetch(API_URL)`. CLAUDE.md §5.
- **Icons are `lucide-react`** (already `^0.562.0`). Never emoji.
- **Git:** branch `develop`. Commit with an explicit pathspec — the working tree carries unrelated in-flight work. No `Co-Authored-By`. Never push unless asked.
- **Run everything from `packages/frontend`.** Tests: `npm run test:unit`. Types: plain `npx tsc --noEmit`, never `nest build`.

## Measured Starting State

|                                       |                                                                                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketing container widths            | six (`max-w-2xl` … `max-w-7xl`)                                                                                                                                                              |
| H1 scales                             | five                                                                                                                                                                                         |
| Gutters                               | `px-4` in `(public)`, `px-6` in `(app)` — split by route group, not design                                                                                                                   |
| Homepage vertical rhythms             | twelve                                                                                                                                                                                       |
| Hex literals                          | 604 across 119 files — concentrated in `app/components/home` (95) and `components/account`. **The five app surfaces are already clean:** analyzer 0, screener 0, reports 0, market 0, map 2. |
| Off-scale radii                       | ~1,418 of 3,554 (40%)                                                                                                                                                                        |
| Elevation systems                     | two — 353 `shadow-*`, 77 `elevation-*`                                                                                                                                                       |
| `<Button>` / `<Card>` primitive usage | **0 import sites**; 961 raw `<button>` elements instead                                                                                                                                      |
| `dark:` coverage                      | 31 of 1,384 files; zero in home, blog, or magnet-landing                                                                                                                                     |
| Blog posts with an image              | **0 of 77** — the frontmatter has no image field                                                                                                                                             |

---

## File Structure

### New — shared primitives

`packages/frontend/app/components/marketing/`

| File                                                                                             | Responsibility                                                                           |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `layout-contract.ts`                                                                             | Only source of container width, gutter, rhythm, surface, heading scales. Pure constants. |
| `Section.tsx`                                                                                    | `<section>` with surface band + rhythm + centred container.                              |
| `SectionHeading.tsx`                                                                             | Eyebrow + H2 + subhead at fixed scales.                                                  |
| `Chip.tsx`                                                                                       | Rounded-full pill, optional icon slot, four tones.                                       |
| `StatTile.tsx`                                                                                   | Micro-label / mono value / caption, accent left stripe.                                  |
| `ScreenshotFrame.tsx`                                                                            | Bordered rounded product-image container over `next/image`.                              |
| `index.ts`                                                                                       | Barrel.                                                                                  |
| `__tests__/layout-contract.test.ts`, `__tests__/primitives.test.tsx`, `__tests__/no-hex.test.ts` | Contract + render + hex guards.                                                          |

`packages/frontend/app/components/app-shell/`

| File                                                       | Responsibility                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `AppBar.tsx`                                               | Dark application bar: logo, nav pills with coloured icon tiles, tier chip, utility icons. |
| `ControlBar.tsx`                                           | Single light filter/control row beneath the app bar.                                      |
| `KpiTile.tsx`                                              | Accent left stripe, micro-label, mono value, caption.                                     |
| `DataTable.tsx`                                            | Sortable table: sticky header, mono right-aligned numerics, `.lab` headers.               |
| `ScorePill.tsx`                                            | Compact 1–99 score pill using `getScoreColor()` + `getScoreLabel()`.                      |
| `JumpBar.tsx`                                              | In-page section navigation for long tool pages.                                           |
| `index.ts`                                                 | Barrel.                                                                                   |
| `__tests__/app-shell.test.tsx`, `__tests__/no-hex.test.ts` | Render + hex guards.                                                                      |

### Modified — by phase

| Phase                 | Primary targets                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B — Homepage          | `app/components/home/landing-v2/*.tsx` (14 files, 1,012 lines), `app/(app)/home-v2/page.tsx`                                                                                                                                                            |
| B — Blog              | `content/blog/*.mdx` frontmatter (77 files), `app/(app)/blog/components/PostCard.tsx`, `app/(app)/blog/BlogIndexContent.tsx`, `app/(app)/blog/[slug]/BlogPostContent.tsx`, `app/(app)/blog/layout.tsx`, `scripts/content/generate-post-images.ts` (new) |
| C — Shell             | `app/components/AppShell.tsx`, `src/components/layout/Header.tsx` (354)                                                                                                                                                                                 |
| C — Analyzer          | `app/(app)/analyzer/AnalyzerClient.tsx` (388), `components/InputPanel/InputPanel.tsx` (389), `components/AnalyzerSections.tsx`, `components/MetricsExpander.tsx`                                                                                        |
| C — Screener          | `app/(app)/screener/ScreenerPageInner.tsx` (399), `components/ScreenerTable.tsx` (377), `components/FilterRail.tsx` (223), `components/PresetChips.tsx` (98)                                                                                            |
| C — Map (chrome only) | `app/(app)/map/MapPageInner.tsx` (389), `components/RightDetailPanel/RightDetailPanel.tsx` (381), `components/RightDetailPanel/CompactScoreCard.tsx` (394), `config/metric-categories.tsx` (334). **No Mapbox-touching file.**                          |
| C — Reports           | `app/(app)/reports/page.tsx`, `app/(app)/reports/[id]/components/sections/core/*` (the existing report design system — 9 components)                                                                                                                    |
| C — Market            | `app/(app)/market/explorer/MarketExplorer.tsx` (380), `components/KpiStrip.tsx` (235), `components/DetailRail.tsx` (311), `components/GeoTileMap.tsx` (267)                                                                                             |
| D — Defects           | `app/(app)/about/page.tsx` (408), `app/(app)/pricing/layout.tsx`, `pricing/components/FeatureShowcaseInsights.tsx`, `pricing/components/FeatureShowcaseData.tsx`, analyzer geo resolution                                                               |
| D — Retire            | `app/(app)/page.tsx`, `middleware.ts`, `lib/experiments/landing-variant.ts`, dead `app/components/home/*.tsx`                                                                                                                                           |

**Reuse, do not rebuild:** `components/ui/Button.tsx` and `Card.tsx` already implement the needed variants and have zero import sites — the surfaces in this plan adopt them rather than adding new button/card primitives.

**`/map` is chrome-only.** The Mapbox canvas keeps its current design — choropleth fills, colour scale, baked-on labels, zoom and pan, and the East Coast label stack all stay. Task 18 changes only what surrounds the canvas, and carries a guard step that fails if any Mapbox-touching file appears in the diff.

---

# Phase A — Shared foundation

### Task 1: Hero gradient tokens

**Files:**

- Modify: `packages/frontend/app/globals.css`

**Interfaces:**

- Consumes: nothing
- Produces: Tailwind utilities `from-hero-from`, `to-hero-to`

- [ ] **Step 1: Add light-mode raw tokens**

In `:root`, after the `--md-warning-*` group (around line 38):

```css
/* Marketing hero wash — pale mint to pale lavender, the neutral ends of the
     indigo range. Used only by the homepage hero band. */
--md-hero-from: #f4f8f8;
--md-hero-to: #efeefa;
```

- [ ] **Step 2: Add dark-mode raw tokens**

Inside `@media (prefers-color-scheme: dark)` (starts line 86):

```css
--md-hero-from: #101520;
--md-hero-to: #14131f;
```

- [ ] **Step 3: Map into the Tailwind theme**

Inside `@theme inline` (starts line 146), after the `--color-warning-*` group:

```css
--color-hero-from: var(--md-hero-from);
--color-hero-to: var(--md-hero-to);
```

- [ ] **Step 4: Verify**

Run: `npm run build 2>&1 | tail -20`
Expected: build completes, no CSS errors.

- [ ] **Step 5: Commit**

```bash
git add -- packages/frontend/app/globals.css
git commit -m "feat(design): add hero gradient tokens to the M3 theme" -- packages/frontend/app/globals.css
```

---

### Task 2: Layout contract

**Files:**

- Create: `packages/frontend/app/components/marketing/layout-contract.ts`
- Test: `packages/frontend/app/components/marketing/__tests__/layout-contract.test.ts`

**Interfaces:**

- Produces: `CONTAINER: string`, `PROSE: string`, `RHYTHM: Record<Rhythm, string>`, `SURFACE: Record<Surface, string>`, `HEADING: Record<HeadingLevel, string>`; types `Rhythm = "standard" | "tight"`, `Surface = "a" | "b"`, `HeadingLevel = "hero" | "page" | "section" | "card"`

- [ ] **Step 1: Write the failing test**

Create `packages/frontend/app/components/marketing/__tests__/layout-contract.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CONTAINER, PROSE, RHYTHM, SURFACE, HEADING } from "../layout-contract";

describe("layout contract is singular", () => {
  it("defines exactly one content max-width", () => {
    expect(CONTAINER.match(/max-w-\S+/g)).toEqual(["max-w-6xl"]);
  });

  it("defines exactly one prose max-width", () => {
    expect(PROSE.match(/max-w-\S+/g)).toEqual(["max-w-3xl"]);
  });

  it("uses one responsive gutter for both containers", () => {
    expect(CONTAINER).toContain("px-6 lg:px-8");
    expect(PROSE).toContain("px-6 lg:px-8");
  });

  it("offers exactly two vertical rhythms", () => {
    expect(Object.keys(RHYTHM)).toEqual(["standard", "tight"]);
  });

  it("offers exactly two surface bands", () => {
    expect(Object.keys(SURFACE)).toEqual(["a", "b"]);
    expect(SURFACE.a).toBe("bg-surface");
    expect(SURFACE.b).toBe("bg-surface-container-low");
  });

  it("offers exactly four heading scales", () => {
    expect(Object.keys(HEADING)).toEqual(["hero", "page", "section", "card"]);
  });

  it("contains no arbitrary hex values", () => {
    const all = [
      CONTAINER,
      PROSE,
      ...Object.values(RHYTHM),
      ...Object.values(SURFACE),
      ...Object.values(HEADING),
    ].join(" ");
    expect(all).not.toMatch(/\[#[0-9A-Fa-f]{3,8}\]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- app/components/marketing`
Expected: FAIL — `Failed to resolve import "../layout-contract"`

- [ ] **Step 3: Write the implementation**

Create `packages/frontend/app/components/marketing/layout-contract.ts`:

```ts
/**
 * The single source of layout truth for every marketing surface.
 *
 * Before this file, the marketing pages used six container widths, two gutter
 * conventions split by route group, twelve per-section rhythms on the homepage
 * alone, and five H1 scales. Pages import from here rather than writing
 * spacing or heading utilities inline.
 */

/** Standard content column. The only permitted marketing container width. */
export const CONTAINER = "mx-auto w-full max-w-6xl px-6 lg:px-8";

/** Narrow column for running prose — blog bodies, legal copy. */
export const PROSE = "mx-auto w-full max-w-3xl px-6 lg:px-8";

export const RHYTHM = {
  standard: "py-20 lg:py-28",
  tight: "py-12 lg:py-16",
} as const;
export type Rhythm = keyof typeof RHYTHM;

/**
 * Sections alternate between exactly two surfaces. This replaces the page-wide
 * gradient, which prevented any section from owning a surface.
 */
export const SURFACE = {
  a: "bg-surface",
  b: "bg-surface-container-low",
} as const;
export type Surface = keyof typeof SURFACE;

export const HEADING = {
  /** Landing heroes only. */
  hero: "text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]",
  /** Every non-hero page title. */
  page: "text-3xl md:text-4xl font-bold tracking-tight",
  section: "text-2xl md:text-3xl font-bold tracking-tight",
  card: "text-lg md:text-xl font-semibold tracking-tight",
} as const;
export type HeadingLevel = keyof typeof HEADING;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- app/components/marketing`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add -- packages/frontend/app/components/marketing
git commit -m "feat(marketing): add the shared layout contract" -- packages/frontend/app/components/marketing
```

---

### Task 3: Section primitive

**Files:**

- Create: `packages/frontend/app/components/marketing/Section.tsx`
- Test: `packages/frontend/app/components/marketing/__tests__/primitives.test.tsx`

**Interfaces:**

- Consumes: `CONTAINER`, `RHYTHM`, `SURFACE`, `Rhythm`, `Surface` from `./layout-contract`
- Produces: `Section({ surface?: Surface; rhythm?: Rhythm; id?: string; children: ReactNode })`, defaults `surface="a"`, `rhythm="standard"`

- [ ] **Step 1: Write the failing test**

Create `packages/frontend/app/components/marketing/__tests__/primitives.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Section } from "../Section";

describe("Section", () => {
  it("renders its children", () => {
    render(<Section>hello</Section>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("defaults to surface A and the standard rhythm", () => {
    const { container } = render(<Section>x</Section>);
    const section = container.querySelector("section");
    expect(section?.className).toContain("bg-surface");
    expect(section?.className).toContain("py-20 lg:py-28");
  });

  it("applies surface B when asked", () => {
    const { container } = render(<Section surface="b">x</Section>);
    expect(container.querySelector("section")?.className).toContain(
      "bg-surface-container-low",
    );
  });

  it("applies the tight rhythm when asked", () => {
    const { container } = render(<Section rhythm="tight">x</Section>);
    expect(container.querySelector("section")?.className).toContain(
      "py-12 lg:py-16",
    );
  });

  it("wraps children in the shared container", () => {
    const { container } = render(<Section>x</Section>);
    const inner = container.querySelector("section > div");
    expect(inner?.className).toContain("max-w-6xl");
    expect(inner?.className).toContain("px-6 lg:px-8");
  });

  it("forwards an id for in-page anchors", () => {
    const { container } = render(<Section id="proof">x</Section>);
    expect(container.querySelector("section")?.id).toBe("proof");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- app/components/marketing`
Expected: FAIL — `Failed to resolve import "../Section"`

- [ ] **Step 3: Write the implementation**

Create `packages/frontend/app/components/marketing/Section.tsx`:

```tsx
import type { ReactNode } from "react";
import {
  CONTAINER,
  RHYTHM,
  SURFACE,
  type Rhythm,
  type Surface,
} from "./layout-contract";

/**
 * A marketing section band. Owns its own surface so adjacent sections separate
 * visually without a page-wide gradient, and applies the shared container and
 * rhythm so no page picks its own width or padding.
 */
export function Section({
  surface = "a",
  rhythm = "standard",
  id,
  children,
}: {
  surface?: Surface;
  rhythm?: Rhythm;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${SURFACE[surface]} ${RHYTHM[rhythm]}`}>
      <div className={CONTAINER}>{children}</div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- app/components/marketing`
Expected: PASS, 13 tests total

- [ ] **Step 5: Commit**

```bash
git add -- packages/frontend/app/components/marketing
git commit -m "feat(marketing): add the Section band primitive" -- packages/frontend/app/components/marketing
```

---

### Task 4: SectionHeading, Chip, StatTile, ScreenshotFrame

These four are independent presentational primitives with no interdependencies. Build them in one task — a reviewer would accept or reject them together.

**Files:**

- Create: `packages/frontend/app/components/marketing/SectionHeading.tsx`, `Chip.tsx`, `StatTile.tsx`, `ScreenshotFrame.tsx`
- Modify: `packages/frontend/app/components/marketing/__tests__/primitives.test.tsx`

**Interfaces:**

- Consumes: `HEADING` from `./layout-contract`; `next/image`
- Produces:
  - `SectionHeading({ eyebrow?: string; title: string; subhead?: ReactNode; align?: "center" | "start" })`
  - `Chip({ children: ReactNode; icon?: ReactNode; tone?: "neutral" | "primary" | "positive" | "warning" })`
  - `StatTile({ label: string; value: string; caption?: string; accent?: "primary" | "tertiary" | "warning" | "error" })`
  - `ScreenshotFrame({ src: string; alt: string; width: number; height: number; priority?: boolean })`

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/primitives.test.tsx`, adding the four imports at the top:

```tsx
import { SectionHeading } from "../SectionHeading";
import { Chip } from "../Chip";
import { StatTile } from "../StatTile";
import { ScreenshotFrame } from "../ScreenshotFrame";

describe("SectionHeading", () => {
  it("renders the title as an h2 at the section scale", () => {
    render(<SectionHeading title="Four inputs" />);
    const h2 = screen.getByRole("heading", { level: 2, name: "Four inputs" });
    expect(h2.className).toContain("text-2xl md:text-3xl");
  });

  it("renders an eyebrow when given one", () => {
    render(<SectionHeading eyebrow="How it works" title="Three steps" />);
    expect(screen.getByText("How it works")).toBeInTheDocument();
  });

  it("renders a subhead when given one", () => {
    render(<SectionHeading title="T" subhead="Explanatory line." />);
    expect(screen.getByText("Explanatory line.")).toBeInTheDocument();
  });

  it("left-aligns when align is start", () => {
    const { container } = render(<SectionHeading title="T" align="start" />);
    expect(container.firstElementChild?.className).toContain("text-left");
  });
});

describe("Chip", () => {
  it("is a full-radius pill per the shape scale", () => {
    const { container } = render(<Chip>x</Chip>);
    expect(container.firstElementChild?.className).toContain("rounded-full");
  });

  it("applies the primary tone when asked", () => {
    const { container } = render(<Chip tone="primary">x</Chip>);
    expect(container.firstElementChild?.className).toContain("bg-primary");
  });

  it("renders an icon slot when given one", () => {
    render(<Chip icon={<svg data-testid="ic" />}>x</Chip>);
    expect(screen.getByTestId("ic")).toBeInTheDocument();
  });
});

describe("StatTile", () => {
  it("renders label, value, and caption", () => {
    render(
      <StatTile
        label="Days on market"
        value="29"
        caption="Realtor.com median"
      />,
    );
    expect(screen.getByText("Days on market")).toBeInTheDocument();
    expect(screen.getByText("29")).toBeInTheDocument();
    expect(screen.getByText("Realtor.com median")).toBeInTheDocument();
  });

  it("renders the value in monospace with tabular figures", () => {
    render(<StatTile label="L" value="+12.07%" />);
    const value = screen.getByText("+12.07%");
    expect(value.className).toContain("font-mono");
    expect(value.className).toContain("tabular-nums");
  });

  it("is a rounded-xl card with a shadow", () => {
    const { container } = render(<StatTile label="L" value="1" />);
    expect(container.firstElementChild?.className).toContain("rounded-xl");
    expect(container.firstElementChild?.className).toContain("shadow-sm");
  });

  it("applies the requested accent stripe", () => {
    const { container } = render(
      <StatTile label="L" value="1" accent="tertiary" />,
    );
    expect(container.firstElementChild?.className).toContain(
      "border-l-tertiary",
    );
  });
});

describe("ScreenshotFrame", () => {
  it("renders the image with its alt text", () => {
    render(
      <ScreenshotFrame
        src="/images/home/market-map-hero-v4.png"
        alt="PropertyIQ market map"
        width={1280}
        height={800}
      />,
    );
    expect(screen.getByAltText("PropertyIQ market map")).toBeInTheDocument();
  });

  it("frames the image in a rounded bordered card", () => {
    const { container } = render(
      <ScreenshotFrame src="/x.png" alt="x" width={10} height={10} />,
    );
    const frame = container.firstElementChild;
    expect(frame?.className).toContain("rounded-xl");
    expect(frame?.className).toContain("border-outline-variant");
    expect(frame?.className).toContain("overflow-hidden");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- app/components/marketing`
Expected: FAIL — four unresolved imports

- [ ] **Step 3: Write SectionHeading**

```tsx
import type { ReactNode } from "react";
import { HEADING } from "./layout-contract";

/**
 * The repeated section-header unit: coloured uppercase eyebrow, H2 at the one
 * section scale, optional subhead. Using this everywhere is most of what makes
 * a long page read as ordered rather than stacked.
 */
export function SectionHeading({
  eyebrow,
  title,
  subhead,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  subhead?: ReactNode;
  align?: "center" | "start";
}) {
  const alignment =
    align === "center"
      ? "mx-auto items-center text-center"
      : "items-start text-left";

  return (
    <div className={`mb-10 flex max-w-3xl flex-col gap-4 ${alignment}`}>
      {eyebrow ? (
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-tertiary">
          {eyebrow}
        </span>
      ) : null}
      <h2 className={`${HEADING.section} text-balance text-on-surface`}>
        {title}
      </h2>
      {subhead ? (
        <p className="max-w-2xl text-lg text-on-surface-variant">{subhead}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Write Chip**

```tsx
import type { ReactNode } from "react";

type ChipTone = "neutral" | "primary" | "positive" | "warning";

const TONE: Record<ChipTone, string> = {
  neutral: "border-outline-variant bg-surface text-on-surface",
  primary: "border-transparent bg-primary text-on-primary",
  positive:
    "border-tertiary/40 bg-tertiary-container text-on-tertiary-container",
  warning: "border-warning/40 bg-warning-container text-on-warning-container",
};

/**
 * One pill for every chip on the site — feature switchers, taxonomy tags,
 * filter labels, presets. Replaces roughly eleven independent chip
 * implementations scattered across the codebase.
 */
export function Chip({
  children,
  icon,
  tone = "neutral",
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: ChipTone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm ${TONE[tone]}`}
    >
      {icon ? (
        <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
      ) : null}
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Write StatTile**

```tsx
type Accent = "primary" | "tertiary" | "warning" | "error";

const STRIPE: Record<Accent, string> = {
  primary: "border-l-primary",
  tertiary: "border-l-tertiary",
  warning: "border-l-warning",
  error: "border-l-error",
};

/**
 * The repeated metric unit: uppercase micro-label, monospace value, caption
 * saying what the metric actually is. The accent stripe carries the health
 * signal so the value does not have to be colour-coded.
 */
export function StatTile({
  label,
  value,
  caption,
  accent = "primary",
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: Accent;
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-xl border border-l-[3px] border-outline-variant ${STRIPE[accent]} bg-surface p-5 shadow-sm`}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-on-surface-variant">
        {label}
      </span>
      <span className="font-mono text-2xl font-medium tracking-tight tabular-nums text-on-surface">
        {value}
      </span>
      {caption ? (
        <span className="text-xs text-on-surface-variant">{caption}</span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Write ScreenshotFrame**

```tsx
import Image from "next/image";

/**
 * Consistent framing for product screenshots so they read as one set rather
 * than pasted-in pictures.
 */
export function ScreenshotFrame({
  src,
  alt,
  width,
  height,
  priority = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes="(min-width: 1024px) 640px, 100vw"
        className="h-auto w-full"
      />
    </div>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:unit -- app/components/marketing`
Expected: PASS, 26 tests total

- [ ] **Step 8: Commit**

```bash
git add -- packages/frontend/app/components/marketing
git commit -m "feat(marketing): add SectionHeading, Chip, StatTile, and ScreenshotFrame" -- packages/frontend/app/components/marketing
```

---

### Task 5: Marketing barrel and hex regression guard

**Files:**

- Create: `packages/frontend/app/components/marketing/index.ts`
- Create: `packages/frontend/app/components/marketing/__tests__/no-hex.test.ts`

- [ ] **Step 1: Write the guard**

Create `packages/frontend/app/components/marketing/__tests__/no-hex.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(__dirname, "..");
const ARBITRARY_HEX = /\[#[0-9A-Fa-f]{3,8}\]/;

/**
 * The marketing surfaces previously carried 604 hardcoded hex literals across
 * 119 files, running alongside the M3 token system. The two disagreed, and in
 * dark mode the tokens flipped while the hex did not. This guard stops that
 * class of drift returning.
 */
describe("marketing primitives use semantic tokens only", () => {
  const files = readdirSync(DIR).filter(
    (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
  );

  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s contains no arbitrary hex utility", (file) => {
    expect(readFileSync(join(DIR, file), "utf8")).not.toMatch(ARBITRARY_HEX);
  });

  it.each(files)("%s contains no bare hex colour literal", (file) => {
    expect(readFileSync(join(DIR, file), "utf8")).not.toMatch(
      /#[0-9A-Fa-f]{6}\b/,
    );
  });
});
```

- [ ] **Step 2: Run it — should already pass**

Run: `npm run test:unit -- app/components/marketing/__tests__/no-hex`
Expected: PASS. If it fails, a primitive has a hex literal; replace it with the semantic token of the same role before continuing.

- [ ] **Step 3: Write the barrel**

Create `packages/frontend/app/components/marketing/index.ts`:

```ts
export { Section } from "./Section";
export { SectionHeading } from "./SectionHeading";
export { Chip } from "./Chip";
export { StatTile } from "./StatTile";
export { ScreenshotFrame } from "./ScreenshotFrame";
export {
  CONTAINER,
  PROSE,
  RHYTHM,
  SURFACE,
  HEADING,
  type Rhythm,
  type Surface,
  type HeadingLevel,
} from "./layout-contract";
```

- [ ] **Step 4: Verify suite and types**

Run: `npm run test:unit -- app/components/marketing && npx tsc --noEmit`
Expected: all PASS; `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add -- packages/frontend/app/components/marketing
git commit -m "feat(marketing): add barrel export and hex regression guard" -- packages/frontend/app/components/marketing
```

---

### Task 6: App-shell primitives — KpiTile, ScorePill, JumpBar

**Files:**

- Create: `packages/frontend/app/components/app-shell/KpiTile.tsx`, `ScorePill.tsx`, `JumpBar.tsx`
- Test: `packages/frontend/app/components/app-shell/__tests__/app-shell.test.tsx`

**Interfaces:**

- Consumes: `getScoreColor`, `getScoreLabel` from `@/app/components/scoring/ScoreDisplay`
- Produces:
  - `KpiTile({ label: string; value: string; caption?: string; accent?: "primary" | "tertiary" | "warning" | "error"; tone?: "neutral" | "positive" | "negative" })`
  - `ScorePill({ score: number; showLabel?: boolean })`
  - `JumpBar({ items: { id: string; label: string; icon: ReactNode; accent: string }[]; activeId: string })`

- [ ] **Step 1: Write the failing test**

Create `packages/frontend/app/components/app-shell/__tests__/app-shell.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiTile } from "../KpiTile";
import { ScorePill } from "../ScorePill";
import { JumpBar } from "../JumpBar";

describe("KpiTile", () => {
  it("renders label, value, and caption", () => {
    render(<KpiTile label="DSCR" value="0.74" caption="NOI / debt service" />);
    expect(screen.getByText("DSCR")).toBeInTheDocument();
    expect(screen.getByText("0.74")).toBeInTheDocument();
    expect(screen.getByText("NOI / debt service")).toBeInTheDocument();
  });

  it("renders the value in monospace with tabular figures", () => {
    render(<KpiTile label="Cash flow" value="−$386" />);
    const v = screen.getByText("−$386");
    expect(v.className).toContain("font-mono");
    expect(v.className).toContain("tabular-nums");
  });

  it("carries the accent as a left stripe", () => {
    const { container } = render(
      <KpiTile label="L" value="1" accent="error" />,
    );
    expect(container.firstElementChild?.className).toContain("border-l-error");
  });
});

describe("ScorePill", () => {
  it("renders the score in monospace", () => {
    render(<ScorePill score={75} />);
    const v = screen.getByText("75");
    expect(v.className).toContain("font-mono");
  });

  it("renders a momentum label, never a quality word", () => {
    render(<ScorePill score={75} showLabel />);
    const text = screen.getByTestId("score-pill").textContent ?? "";
    expect(text).toMatch(/RISING/i);
    expect(text).not.toMatch(/excellent|poor|good|bad/i);
  });

  it("clamps display to the 1-99 scale", () => {
    render(<ScorePill score={100} />);
    expect(screen.getByText("99")).toBeInTheDocument();
  });
});

describe("JumpBar", () => {
  const items = [
    { id: "verdict", label: "Verdict", icon: <svg />, accent: "bg-error" },
    { id: "cashflow", label: "Cash Flow", icon: <svg />, accent: "bg-primary" },
  ];

  it("renders one anchor per item", () => {
    render(<JumpBar items={items} activeId="verdict" />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("links each item to its section anchor", () => {
    render(<JumpBar items={items} activeId="verdict" />);
    expect(screen.getByRole("link", { name: /Verdict/ })).toHaveAttribute(
      "href",
      "#verdict",
    );
  });

  it("marks the active item", () => {
    render(<JumpBar items={items} activeId="cashflow" />);
    expect(screen.getByRole("link", { name: /Cash Flow/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- app/components/app-shell`
Expected: FAIL — three unresolved imports

- [ ] **Step 3: Write KpiTile**

```tsx
type Accent = "primary" | "tertiary" | "warning" | "error";
type Tone = "neutral" | "positive" | "negative";

const STRIPE: Record<Accent, string> = {
  primary: "border-l-primary",
  tertiary: "border-l-tertiary",
  warning: "border-l-warning",
  error: "border-l-error",
};

const TONE: Record<Tone, string> = {
  neutral: "text-on-surface",
  positive: "text-tertiary",
  negative: "text-error",
};

/**
 * The repeated metric unit for the authed tools. The accent stripe carries the
 * health signal; the caption says what the metric actually is, so a tile reads
 * "NOI / debt service" rather than a bare "DSCR".
 */
export function KpiTile({
  label,
  value,
  caption,
  accent = "primary",
  tone = "neutral",
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: Accent;
  tone?: Tone;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border border-l-[3px] border-outline-variant ${STRIPE[accent]} bg-surface p-4 shadow-sm`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface-variant">
        {label}
      </span>
      <span
        className={`font-mono text-2xl font-medium tracking-tight tabular-nums ${TONE[tone]}`}
      >
        {value}
      </span>
      {caption ? (
        <span className="text-[11px] text-on-surface-variant">{caption}</span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Write ScorePill**

```tsx
import {
  getScoreColor,
  getScoreLabel,
} from "@/app/components/scoring/ScoreDisplay";

/**
 * Compact 1-99 score, for table cells and dense rows. Colour and label both
 * come from the canonical scoring helpers so a pill can never disagree with a
 * ScoreDisplay elsewhere on the page. The label is a momentum word, never a
 * quality grade (CLAUDE.md section 9).
 */
export function ScorePill({
  score,
  showLabel = false,
}: {
  score: number;
  showLabel?: boolean;
}) {
  const clamped = Math.max(1, Math.min(99, Math.round(score)));

  return (
    <span
      data-testid="score-pill"
      className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-2.5 py-1"
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: getScoreColor(clamped) }}
        aria-hidden="true"
      />
      <span className="font-mono text-sm font-semibold tabular-nums text-on-surface">
        {clamped}
      </span>
      {showLabel ? (
        <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-on-surface-variant">
          {getScoreLabel(clamped)}
        </span>
      ) : null}
    </span>
  );
}
```

> `getScoreColor()` returns a colour string, so it is applied via `style`, not a class — this is the one sanctioned exception to the no-inline-colour rule, because the value is computed from data. Do not hardcode a palette here.

- [ ] **Step 5: Write JumpBar**

```tsx
import type { ReactNode } from "react";

export type JumpItem = {
  id: string;
  label: string;
  icon: ReactNode;
  /** Tailwind background class for the icon tile, e.g. "bg-primary". */
  accent: string;
};

/**
 * In-page navigation for the long tool pages. The analyzer stacks a verdict, a
 * grading table, four improvement levers, a projection, and a waterfall in one
 * scroll; this makes that depth reachable rather than hiding it.
 */
export function JumpBar({
  items,
  activeId,
}: {
  items: JumpItem[];
  activeId: string;
}) {
  return (
    <nav className="flex flex-wrap gap-1.5 rounded-xl border border-outline-variant bg-surface p-2 shadow-sm">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={active ? "true" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-semibold ${
              active
                ? "border-primary bg-primary-container text-primary"
                : "border-transparent text-on-surface-variant"
            }`}
          >
            <span
              className={`grid size-5 place-items-center rounded-md text-on-primary ${item.accent}`}
            >
              {item.icon}
            </span>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:unit -- app/components/app-shell`
Expected: PASS, 9 tests

- [ ] **Step 7: Commit**

```bash
git add -- packages/frontend/app/components/app-shell
git commit -m "feat(app-shell): add KpiTile, ScorePill, and JumpBar primitives" -- packages/frontend/app/components/app-shell
```

---

### Task 7: App-shell primitive — DataTable

**Files:**

- Create: `packages/frontend/app/components/app-shell/DataTable.tsx`
- Modify: `packages/frontend/app/components/app-shell/__tests__/app-shell.test.tsx`

**Interfaces:**

- Produces: `DataTable<T>({ columns, rows, sortKey, sortDir, onSort })` where `columns: { key: keyof T & string; header: string; align?: "left" | "right"; render?: (row: T) => ReactNode }[]`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/app-shell.test.tsx`, adding `import { DataTable } from "../DataTable";`:

```tsx
type Row = { market: string; score: number; value: string };

const COLUMNS = [
  { key: "market" as const, header: "Market", align: "left" as const },
  { key: "score" as const, header: "Score", align: "right" as const },
  { key: "value" as const, header: "Median value", align: "right" as const },
];

const ROWS: Row[] = [
  { market: "Buffalo, NY", score: 98, value: "$248,700" },
  { market: "Seattle, WA", score: 16, value: "$775,549" },
];

describe("DataTable", () => {
  it("renders a header cell per column", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  });

  it("renders a row per datum", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2
  });

  it("right-aligns numeric columns in monospace", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    const cell = screen.getByText("$248,700");
    expect(cell.className).toContain("text-right");
    expect(cell.className).toContain("font-mono");
    expect(cell.className).toContain("tabular-nums");
  });

  it("leaves the left column in the sans face", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} />);
    expect(screen.getByText("Buffalo, NY").className).not.toContain(
      "font-mono",
    );
  });

  it("marks the sorted column for assistive tech", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        sortKey="score"
        sortDir="desc"
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Score/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- app/components/app-shell`
Expected: FAIL — `Failed to resolve import "../DataTable"`

- [ ] **Step 3: Write the implementation**

Create `packages/frontend/app/components/app-shell/DataTable.tsx`:

```tsx
import type { ReactNode } from "react";

export type Column<T> = {
  key: keyof T & string;
  header: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
};

/**
 * One table treatment for every tabular surface — screener results, market
 * rankings, grading breakdowns, report tables. Numerics are monospace and
 * tabular so columns align; the header row sticks so long result sets stay
 * readable.
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  sortKey,
  sortDir,
  onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {columns.map((col) => {
              const sorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  aria-sort={
                    sorted
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  onClick={onSort ? () => onSort(col.key) : undefined}
                  className={`sticky top-0 z-10 border-b border-outline-variant bg-surface px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface-variant ${
                    col.align === "left" ? "text-left" : "text-right"
                  } ${onSort ? "cursor-pointer select-none" : ""}`}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-outline-variant/50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2.5 ${
                    col.align === "left"
                      ? "text-left text-on-surface-variant"
                      : "text-right font-mono tabular-nums text-on-surface"
                  }`}
                >
                  {col.render ? col.render(row) : String(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- app/components/app-shell`
Expected: PASS, 14 tests total

- [ ] **Step 5: Commit**

```bash
git add -- packages/frontend/app/components/app-shell
git commit -m "feat(app-shell): add the shared DataTable primitive" -- packages/frontend/app/components/app-shell
```

---

### Task 8: App-shell chrome — AppBar and ControlBar

> **Gate:** adopting `AppBar` changes the chrome on every authed page, including dashboard, account, and admin — surfaces this plan does not otherwise touch. That is the intent of a site-wide redesign, but confirm before starting.

**Files:**

- Create: `packages/frontend/app/components/app-shell/AppBar.tsx`, `ControlBar.tsx`, `index.ts`
- Create: `packages/frontend/app/components/app-shell/__tests__/no-hex.test.ts`
- Modify: `packages/frontend/app/components/AppShell.tsx`

**Interfaces:**

- Consumes: `lucide-react`, `usePathname` from `next/navigation`
- Produces: `AppBar()` (self-contained, reads the active route itself); `ControlBar({ children })`

- [ ] **Step 1: Read the current shell and header**

Run: `cat app/components/AppShell.tsx && wc -l src/components/layout/Header.tsx`

Record which routes render `AppShell` and what `Header` currently provides — search, tier badge, mobile menu, breadcrumbs. `AppBar` must preserve every one of those affordances; this is a restyle, not a feature reduction.

- [ ] **Step 2: Write the failing test**

Append to `__tests__/app-shell.test.tsx`, adding `import { AppBar } from "../AppBar";`:

```tsx
describe("AppBar", () => {
  it("renders a nav link per tool", () => {
    render(<AppBar />);
    for (const label of [
      "Dashboard",
      "Map",
      "Analyzer",
      "Screener",
      "Reports",
    ]) {
      expect(
        screen.getByRole("link", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
  });

  it("uses the dark bar surface, not a hardcoded hex", () => {
    const { container } = render(<AppBar />);
    const bar = container.querySelector("header");
    expect(bar?.className).toContain("bg-inverse-surface");
    expect(container.innerHTML).not.toMatch(/\[#[0-9A-Fa-f]{6}\]/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- app/components/app-shell`
Expected: FAIL — `Failed to resolve import "../AppBar"`

- [ ] **Step 4: Write AppBar**

Use the existing `--color-inverse-surface` / `--color-inverse-on-surface` tokens for the dark bar — they are already defined in `globals.css` and flip correctly in dark mode. Do not add new dark-bar tokens.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  Calculator,
  Search,
  FileText,
} from "lucide-react";

const TOOLS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    Icon: LayoutDashboard,
    accent: "bg-primary",
  },
  { href: "/map", label: "Map", Icon: Map, accent: "bg-secondary" },
  {
    href: "/analyzer",
    label: "Analyzer",
    Icon: Calculator,
    accent: "bg-primary",
  },
  { href: "/screener", label: "Screener", Icon: Search, accent: "bg-tertiary" },
  { href: "/reports", label: "Reports", Icon: FileText, accent: "bg-tertiary" },
] as const;

/**
 * The one application bar for every authed tool. Marketing pages stay light;
 * the tools get a dark bar, which signals you have moved from reading to
 * working and separates app chrome from content.
 */
export function AppBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant bg-inverse-surface">
      <div className="flex h-14 items-center gap-4 px-5">
        <Link
          href="/"
          className="flex items-center gap-2 text-inverse-on-surface"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-extrabold text-on-primary">
            P
          </span>
          <span className="text-base font-bold tracking-tight">
            Property<span className="text-inverse-primary">IQ</span>
          </span>
        </Link>

        <nav className="flex gap-1">
          {TOOLS.map(({ href, label, Icon, accent }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
                  active
                    ? "bg-primary text-on-primary"
                    : "text-inverse-on-surface/70"
                }`}
              >
                <span
                  className={`grid size-[18px] place-items-center rounded-md ${active ? "bg-on-primary/25" : accent}`}
                >
                  <Icon className="size-3 text-on-primary" strokeWidth={2} />
                </span>
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
```

Then port the remaining `Header.tsx` affordances recorded in Step 1 — tier badge, notifications, account menu, mobile menu — into the right-hand side of this bar. Do not drop any.

- [ ] **Step 5: Write ControlBar**

```tsx
import type { ReactNode } from "react";

/**
 * The single control row beneath the app bar. The map currently stacks a main
 * nav, a breadcrumb + search + geo-level row, a left icon rail, and a sidebar
 * before you reach the content; everything filter-shaped belongs here instead.
 */
export function ControlBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant bg-surface px-5 py-3">
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Add the barrel and hex guard**

Create `index.ts` exporting `AppBar`, `ControlBar`, `KpiTile`, `DataTable`, `ScorePill`, `JumpBar`, and the `Column` / `JumpItem` types. Create `__tests__/no-hex.test.ts` as an exact copy of the marketing guard from Task 5, with its `describe` renamed to `"app-shell primitives use semantic tokens only"`.

- [ ] **Step 7: Adopt AppBar in the shell**

In `app/components/AppShell.tsx`, replace the existing header render with `<AppBar />`. Leave the `(public)` layout on the light marketing nav.

- [ ] **Step 8: Verify**

Run: `npm run test:unit -- app/components/app-shell && npx tsc --noEmit && npm run build`
Expected: all pass. Then `npx next start -p 3100` and confirm every authed route still has working navigation, tier badge, and account menu.

- [ ] **Step 9: Commit**

```bash
git add -- packages/frontend/app/components/app-shell packages/frontend/app/components/AppShell.tsx
git commit -m "feat(app-shell): add the AppBar and ControlBar chrome" -- packages/frontend/app/components/app-shell packages/frontend/app/components/AppShell.tsx
```

---

# Phase B — Marketing surfaces

### Task 9: BeatSection delegates to the contract

**Files:**

- Modify: `packages/frontend/app/components/home/landing-v2/BeatSection.tsx` (41 lines)
- Test: `packages/frontend/app/components/home/landing-v2/__tests__/beat-section.test.tsx`

**Interfaces:**

- Consumes: `Section`, `Surface` from `@/app/components/marketing`
- Produces: `BeatSection` with its existing props preserved

- [ ] **Step 1: Read the current file**

Run: `cat "app/components/home/landing-v2/BeatSection.tsx"`

Note the exact prop signature. It currently applies `py-20 md:py-28` and `max-w-6xl px-5` itself; those move to `Section`.

- [ ] **Step 2: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BeatSection } from "../BeatSection";

describe("BeatSection delegates layout to the shared contract", () => {
  it("uses the contract container width", () => {
    const { container } = render(<BeatSection>x</BeatSection>);
    expect(container.innerHTML).toContain("max-w-6xl");
  });

  it("uses the contract gutter, not px-5", () => {
    const { container } = render(<BeatSection>x</BeatSection>);
    expect(container.innerHTML).toContain("px-6");
    expect(container.innerHTML).not.toContain("px-5");
  });

  it("uses the contract rhythm", () => {
    const { container } = render(<BeatSection>x</BeatSection>);
    expect(container.innerHTML).toContain("py-20 lg:py-28");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- app/components/home/landing-v2`
Expected: FAIL — current component emits `px-5` and `py-20 md:py-28`

- [ ] **Step 4: Rewrite**

Preserve every prop found in Step 1; the shape below assumes `{ id?, surface?, children }`.

```tsx
import type { ReactNode } from "react";
import { Section, type Surface } from "@/app/components/marketing";

/**
 * Homepage section wrapper. Spacing, container width, and surface now come
 * from the shared layout contract — the homepage previously carried twelve
 * distinct per-section rhythms.
 */
export function BeatSection({
  id,
  surface = "a",
  children,
}: {
  id?: string;
  surface?: Surface;
  children: ReactNode;
}) {
  return (
    <Section id={id} surface={surface}>
      {children}
    </Section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:unit -- app/components/home/landing-v2`
Expected: PASS, 3 tests

- [ ] **Step 6: Commit**

```bash
git add -- packages/frontend/app/components/home/landing-v2
git commit -m "refactor(home): delegate BeatSection layout to the shared contract" -- packages/frontend/app/components/home/landing-v2
```

---

### Task 10: Rebuild the hero

**Files:**

- Modify: `packages/frontend/app/components/home/landing-v2/BeatHero.tsx` (159 lines)
- Test: `packages/frontend/app/components/home/landing-v2/__tests__/beat-hero.test.tsx`

**Interfaces:**

- Consumes: `Section`, `ScreenshotFrame`, `HEADING` from `@/app/components/marketing`
- Produces: `BeatHero` with existing props unchanged

- [ ] **Step 1: Read the current file**

Run: `cat "app/components/home/landing-v2/BeatHero.tsx"`

Record the headline and subhead copy verbatim, CTA labels and hrefs, props, and any `trackEvent` calls. **All content is preserved.** Only layout, gradient, and numeral typography change.

- [ ] **Step 2: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BeatHero } from "../BeatHero";

describe("BeatHero", () => {
  it("renders exactly one h1", () => {
    render(<BeatHero />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders the h1 at the hero scale from the contract", () => {
    render(<BeatHero />);
    expect(screen.getByRole("heading", { level: 1 }).className).toContain(
      "text-4xl md:text-5xl lg:text-6xl",
    );
  });

  it("renders score numerals in monospace", () => {
    const { container } = render(<BeatHero />);
    expect(
      container.querySelectorAll(".font-mono.tabular-nums").length,
    ).toBeGreaterThan(0);
  });

  it("uses the hero gradient tokens, not hardcoded hex", () => {
    const { container } = render(<BeatHero />);
    expect(container.innerHTML).toContain("from-hero-from");
    expect(container.innerHTML).not.toMatch(/\[#[0-9A-Fa-f]{6}\]/);
  });

  it("describes the score as 1-99, never 0-100", () => {
    const { container } = render(<BeatHero />);
    expect(container.textContent).not.toContain("0–100");
    expect(container.textContent).not.toContain("0-100");
  });

  it("shows a product screenshot above the fold", () => {
    render(<BeatHero />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- app/components/home/landing-v2/__tests__/beat-hero`
Expected: FAIL on hero-scale, monospace, gradient-token, and screenshot assertions

- [ ] **Step 4: Rebuild the hero layout**

Keep every string of copy, every CTA href, and every analytics call from Step 1. Change only:

Replace the outer wrapper (currently `pb-10 pt-12 md:pb-14 md:pt-14` with `max-w-6xl px-5`):

```tsx
<div className="bg-gradient-to-b from-hero-from to-hero-to">
  <Section rhythm="tight">
    <div className="grid items-center gap-14 lg:grid-cols-[42fr_58fr]">
      <div className="flex flex-col items-start gap-6">
        {/* eyebrow, h1, subhead, CTA, trust line — copy unchanged */}
      </div>
      <ScreenshotFrame
        src="/images/home/market-scores-detail-v2.png"
        alt="PropertyIQ score panel showing metro scores"
        width={1280}
        height={800}
        priority
      />
    </div>
  </Section>
</div>
```

Change the `<h1>` className from `font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl` to `` `${HEADING.hero} text-balance text-on-surface` ``.

Wrap each score numeral: `<span className="font-mono tabular-nums">16</span>`.

`market-scores-detail-v2.png` already exists in `public/images/home/`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:unit -- app/components/home/landing-v2/__tests__/beat-hero`
Expected: PASS, 6 tests

- [ ] **Step 6: Check LCP did not regress**

```bash
npm run build && npx next start -p 3100
```

The H1 and subhead must paint in the initial SSR HTML with no opacity gating — a previous fix pinned LCP to ~3.5s by animating them in. Do not reintroduce `opacity: 0` on either. Confirm the hero image carries `priority` and is not lazy-loaded.

- [ ] **Step 7: Commit**

```bash
git add -- packages/frontend/app/components/home/landing-v2
git commit -m "feat(home): rebuild the hero on the layout contract with a product screenshot" -- packages/frontend/app/components/home/landing-v2
```

---

### Task 11: Move the remaining Beat sections onto the primitives

**Files:**

- Modify: `BeatScore.tsx` (93), `BeatProof.tsx` (215), `BeatTension.tsx` (83), `BeatDataDepth.tsx` (78), `BeatFoundation.tsx` (102), `BeatPersona.tsx` (31), `BeatMap.tsx` (23), `BeatClose.tsx` (44) — all under `app/components/home/landing-v2/`
- Test: `packages/frontend/app/components/home/landing-v2/__tests__/beats-contract.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(__dirname, "..");
const BEATS = readdirSync(DIR).filter(
  (f) => f.startsWith("Beat") && f.endsWith(".tsx") && f !== "BeatSection.tsx",
);

describe("Beat sections defer to the layout contract", () => {
  it.each(BEATS)("%s sets no container width of its own", (file) => {
    expect(readFileSync(join(DIR, file), "utf8")).not.toMatch(/max-w-[2-7]xl/);
  });

  // Section-scale padding only. Small internal spacing such as py-2 on a chip
  // row is legitimate and must not fail this guard.
  it.each(BEATS)("%s sets no section-scale padding of its own", (file) => {
    expect(readFileSync(join(DIR, file), "utf8")).not.toMatch(
      /\bpy-(1[0-9]|2[0-9]|3[0-9])\b/,
    );
  });

  it.each(BEATS)("%s contains no arbitrary hex utility", (file) => {
    expect(readFileSync(join(DIR, file), "utf8")).not.toMatch(
      /\[#[0-9A-Fa-f]{3,8}\]/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- app/components/home/landing-v2/__tests__/beats-contract`
Expected: FAIL for several files

- [ ] **Step 3: Convert each Beat, smallest first**

Order: `BeatMap`, `BeatPersona`, `BeatClose`, `BeatDataDepth`, `BeatTension`, `BeatScore`, `BeatFoundation`, `BeatProof`. For each:

1. Wrap content in `<BeatSection surface="a">` or `surface="b"`, alternating so adjacent sections differ.
2. Delete the component's own `max-w-*`, `px-*`, section-scale `py-*`.
3. Replace bespoke heading markup with `<SectionHeading eyebrow= title= subhead= />`, copy verbatim.
4. Replace hand-built metric blocks with `<StatTile />`.
5. Replace hand-built pills with `<Chip>`.
6. Map hex to tokens: `[#1A237E]` → `text-on-surface` or `bg-primary` by role, `[#00C853]` → `text-tertiary`, `[#C5CAE9]` → `text-on-surface-variant`, `[#3949AB]` → `bg-primary` / `text-primary`, `[#B3261E]` → `text-error`, `[#FF8F00]` → `text-warning`.

Run the test after each file.

**Worked example.** Before:

```tsx
export function BeatDataDepth() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-[#00C853]">
          Data depth
        </p>
        <h2 className="mb-4 text-3xl font-semibold tracking-tight text-[#1A237E] sm:text-4xl">
          Sixty metrics behind every score
        </h2>
        <p className="mb-10 max-w-2xl text-lg text-[#5B6076]">
          Updated monthly from Zillow, Realtor.com, Census, FRED, and BLS.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E4E7F2] bg-white p-5">
            <span className="text-[11px] uppercase text-[#8B91A8]">
              Metrics
            </span>
            <span className="block text-2xl font-semibold text-[#1A237E]">
              60+
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
```

After:

```tsx
import { BeatSection } from "./BeatSection";
import { SectionHeading, StatTile } from "@/app/components/marketing";

export function BeatDataDepth() {
  return (
    <BeatSection surface="b">
      <SectionHeading
        eyebrow="Data depth"
        title="Sixty metrics behind every score"
        subhead="Updated monthly from Zillow, Realtor.com, Census, FRED, and BLS."
        align="start"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Metrics" value="60+" accent="tertiary" />
      </div>
    </BeatSection>
  );
}
```

Copy stays byte-identical. What disappears is the padding, the container, the bespoke heading sizes, and all six hex literals.

**`BeatProof.tsx` is 215 lines.** If conversion pushes past 400, split the score-band table into a sibling `BeatProofBands.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- app/components/home/landing-v2`
Expected: PASS

- [ ] **Step 5: Verify against the mockup**

```bash
npm run build && npx next start -p 3100
```

Compare `http://localhost:3100/` to the homepage mockup at 1440px and 390px, light and dark. Bands must alternate; no section runs edge-to-edge on a gradient.

- [ ] **Step 6: Commit**

```bash
git add -- packages/frontend/app/components/home/landing-v2
git commit -m "refactor(home): move the Beat sections onto the marketing primitives" -- packages/frontend/app/components/home/landing-v2
```

---

### Task 12: Blog post images — frontmatter field and generator

**Files:**

- Create: `packages/frontend/scripts/content/generate-post-images.ts`
- Modify: `content/blog/*.mdx` (77 files — frontmatter only)
- Modify: the blog frontmatter type (find it with `grep -rn "targetKeyword" lib app --include="*.ts" | head`)
- Test: `packages/frontend/scripts/content/__tests__/generate-post-images.test.ts`

**Interfaces:**

- Consumes: the content-pipeline headless-Chromium PNG renderer (find it with `grep -rn "POST_IMAGE_RENDERER" packages/backend/src | head`)
- Produces: `image: string` frontmatter field; PNG files at `public/images/blog/<slug>.png`

- [ ] **Step 1: Locate the existing renderer**

```bash
grep -rn "POST_IMAGE_RENDERER" ../backend/src | head
grep -rn "targetKeyword" lib app --include="*.ts" | head
```

The content pipeline already renders PNGs headlessly with Chromium and embeds fonts (production has Chromium but not Roboto). Reuse that renderer — do not add a second image pipeline. Note the font-embedding requirement; a generator that omits it produces images with fallback type in production.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildPostImageSpec } from "../generate-post-images";

describe("buildPostImageSpec", () => {
  it("derives an output path from the slug", () => {
    const spec = buildPostImageSpec({
      slug: "best-real-estate-markets-appreciation-2026",
      title: "Best Real Estate Markets for Appreciation in 2026",
      category: "market-analysis",
      headlineValue: "99",
      headlineLabel: "Rochester, NY · forecast +4.3%",
    });
    expect(spec.outputPath).toBe(
      "public/images/blog/best-real-estate-markets-appreciation-2026.png",
    );
  });

  it("renders at 16:9 for the card grid", () => {
    const spec = buildPostImageSpec({ slug: "s", title: "T", category: "c" });
    expect(spec.width / spec.height).toBeCloseTo(16 / 9, 2);
  });

  it("puts the headline number in the spec when given one", () => {
    const spec = buildPostImageSpec({
      slug: "s",
      title: "T",
      category: "c",
      headlineValue: "8.4%",
    });
    expect(spec.headlineValue).toBe("8.4%");
  });

  it("omits the headline block when no value is given", () => {
    const spec = buildPostImageSpec({ slug: "s", title: "T", category: "c" });
    expect(spec.headlineValue).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- scripts/content`
Expected: FAIL — unresolved import

- [ ] **Step 4: Write the generator**

Export a pure `buildPostImageSpec()` (so it is unit-testable) plus a `main()` that walks `content/blog/*.mdx`, builds a spec per post, renders through the existing Chromium renderer, writes to `public/images/blog/`, and appends `image: "/images/blog/<slug>.png"` to the frontmatter if absent. Keep the file under 300 lines — it is a logic file.

The card design is a branded data card: category eyebrow, large display title, and the headline number over a gradient in brand colours. Match the blog thumbnails in the homepage mockup.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:unit -- scripts/content`
Expected: PASS, 4 tests

- [ ] **Step 6: Generate for all 77 posts**

```bash
npx tsx scripts/content/generate-post-images.ts
ls public/images/blog/*.png | wc -l
```

Expected: 77. Spot-check three PNGs for correct fonts — not fallback type.

- [ ] **Step 7: Commit**

```bash
git add -- packages/frontend/scripts/content packages/frontend/content/blog packages/frontend/public/images/blog
git commit -m "feat(blog): generate branded hero images for every post" -- packages/frontend/scripts/content packages/frontend/content/blog packages/frontend/public/images/blog
```

---

### Task 13: Blog cards and prose

**Files:**

- Modify: `app/(app)/blog/components/PostCard.tsx` (70), `app/(app)/blog/BlogIndexContent.tsx` (343), `app/(app)/blog/[slug]/BlogPostContent.tsx` (128), `app/(app)/blog/layout.tsx`, `app/(app)/blog/[slug]/page.tsx`
- Test: `packages/frontend/app/(app)/blog/__tests__/post-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "../components/PostCard";

const POST = {
  slug: "best-cash-flow-real-estate-markets-2026",
  frontmatter: {
    title: "Best Cash Flow Real Estate Markets in 2026",
    description:
      "Rent-to-price ratios that survive debt service, vacancy, and tax.",
    date: "2026-03-28",
    category: "cash-flow",
    tags: ["cash-flow"],
    image: "/images/blog/best-cash-flow-real-estate-markets-2026.png",
  },
  readingTime: "7 min read",
};

describe("PostCard", () => {
  it("renders the hero image", () => {
    render(<PostCard post={POST} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "alt",
      POST.frontmatter.title,
    );
  });

  it("shows the description on every card, not only featured ones", () => {
    render(<PostCard post={POST} />);
    expect(screen.getByText(POST.frontmatter.description)).toBeInTheDocument();
  });

  it("shows date and reading time", () => {
    render(<PostCard post={POST} />);
    expect(screen.getByText("7 min read")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- "app/(app)/blog"`
Expected: FAIL — no image rendered, description only shows when `featured`

- [ ] **Step 3: Rebuild PostCard**

Add a 16:9 `next/image` at the top of the card. Remove the `featured` gate on the description — every card shows it. Keep the category chip, date, and reading time; swap the chip for the shared `<Chip>`.

- [ ] **Step 4: Switch the index to a two-column grid**

In `BlogIndexContent.tsx`, render the post grid at `grid-cols-1 md:grid-cols-2 gap-7`, matching the mockup.

- [ ] **Step 5: Fix the double pad and apply serif prose**

`blog/layout.tsx` applies `px-4 py-8` and `blog/[slug]/page.tsx` applies `px-4 py-10` again — 32px inset and 72px top. Remove the page-level duplication and use `PROSE` from the contract. In `BlogPostContent.tsx`, replace bare `prose prose-lg max-w-none` with the serif editorial face per CLAUDE.md §8.3:

```tsx
<div className="prose prose-lg max-w-none font-[family-name:var(--font-serif)] prose-headings:font-sans">
```

- [ ] **Step 6: Run test and verify visually**

Run: `npm run test:unit -- "app/(app)/blog" && npm run build && npx next start -p 3100`
Expected: tests PASS; `/blog` shows a two-column card grid with images; a post body renders in Source Serif with sans headings; no double padding.

- [ ] **Step 7: Commit**

```bash
git add -- "packages/frontend/app/(app)/blog"
git commit -m "feat(blog): add hero images, two-column grid, and serif prose" -- "packages/frontend/app/(app)/blog"
```

---

# Phase C — App surfaces

Every task in this phase follows the same shape. Read it once here; each task states only what is specific to its surface.

**The pattern, per surface:**

1. Read the surface's page-level component and its chrome, KPI, and table children.
2. Write a guard test asserting the surface defers to the shared primitives (no bespoke container width, numerics in monospace, no hex).
3. Replace the surface's own header/filter chrome with `<ControlBar>`.
4. Replace hand-built metric blocks with `<KpiTile>`, tables with `<DataTable>`, score displays with `<ScorePill>`, pills with `<Chip>`.
5. Add a `<JumpBar>` where the page is a long single scroll.
6. Verify against the surface's mockup in a production preview at 1440px and 390px, light and dark.
7. Commit with a pathspec scoped to that surface.

**Standing constraint for all of Phase C:** these are restyles. Every feature, control, and data point stays. The analyzer's auto-kill gate, F-grade verdict, weighted grading table, per-metric improvement levers with `Apply to inputs`, four-series projection, and cash-flow waterfall all remain — as do the per-field star confidence ratings, which are better than a binary manual/auto marker and must not be simplified away.

**Note:** the five app surfaces are already token-clean (analyzer 0 hex, screener 0, reports 0, market 0, map 2). Phase C is typography, layout, and chrome consistency — not a hex purge.

---

### Task 14: Analyzer

**Mockup:** https://claude.ai/code/artifact/3218c833-210f-4bc8-8e68-6351ea9533ca

**Files:**

- Modify: `app/(app)/analyzer/AnalyzerClient.tsx` (388), `components/InputPanel/InputPanel.tsx` (389), `components/AnalyzerSections.tsx`, `components/MetricsExpander.tsx`
- Test: `app/(app)/analyzer/__tests__/analyzer-contract.test.tsx`

**Surface-specific work:**

- [x] **Step 1: Write the guard test**

```tsx
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CLIENT = readFileSync(
  join(__dirname, "..", "AnalyzerClient.tsx"),
  "utf8",
);
const PANEL = readFileSync(
  join(__dirname, "..", "components/InputPanel/InputPanel.tsx"),
  "utf8",
);

describe("analyzer defers to the shared primitives", () => {
  it("renders KPIs through the shared tile, not bespoke markup", () => {
    expect(CLIENT).toContain("KpiTile");
  });

  it("offers in-page navigation for the long results column", () => {
    expect(CLIENT).toContain("JumpBar");
  });

  it("uses no arbitrary hex", () => {
    expect(CLIENT + PANEL).not.toMatch(/\[#[0-9A-Fa-f]{3,8}\]/);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- "app/(app)/analyzer"`
Expected: FAIL on the `KpiTile` and `JumpBar` assertions

- [x] **Step 3: Normalise the number formatting**

The live page renders `−$386.00` in a KPI card and `-$386` in the grading table for the same value, with proportional type in the cards and monospace in the inputs. Route every figure through one formatter and render all of them via `KpiTile` or `DataTable`, both of which are already monospace and tabular. Use a true minus sign.

- [x] **Step 4: Replace the KPI row**

Swap the four hand-built metric cards for `<KpiTile>`, each with a caption naming the metric: `After debt service`, `Annual CF / cash in`, `NOI / purchase price`, `NOI / debt service`. Set `tone="negative"` for the failing values so the stripe and the value agree.

- [x] **Step 5: Add the jump bar**

Insert `<JumpBar>` above the results column with items for Verdict, Cash Flow, Grading, Improve, Projection, Market. Give each corresponding section an `id` matching the item.

- [x] **Step 6: Fix the nested scroll**

The input panel currently has both a vertical scrollbar and a horizontal one — content overflows its container. Make it a plain sticky column with a two-up field grid so nothing overflows at 344px.

- [x] **Step 7: Pair the wide blocks two-up**

Above 1240px, place the cash-flow waterfall beside the projection, and the grading table beside the improvement levers. Below that, stack. This removes roughly 40% of the scroll to reach the levers.

- [x] **Step 8: Improve the empty state**

Before an address is entered the page shows four em-dashes, a `$0.00` projection chart, and a dashed "enter a property address" card sitting beside the address field it duplicates. Remove the dashed card and replace the dead KPI row and chart with a single explanatory panel.

- [x] **Step 9: Verify and commit**

```bash
npm run test:unit -- "app/(app)/analyzer" && npx tsc --noEmit && npm run build && npx next start -p 3100
```

Enter a real address, confirm every feature listed in the Phase C standing constraint is still present and working, then:

```bash
git add -- "packages/frontend/app/(app)/analyzer"
git commit -m "refactor(analyzer): restyle onto the shared app-shell primitives" -- "packages/frontend/app/(app)/analyzer"
```

**Outcome — deviations from this task as written, and why:**

| Written                                                               | Shipped                                      | Why                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "plain sticky column"                                                 | sticky + `max-h` guard                       | The panel measures 917px (Buy & Hold) to 1231px (compare) against ~852px of viewport. A plain sticky column pins its top and puts the last control permanently off-screen. The mockup solves this with a tabbed input card (`.stabs`: Purchase / Rent / Expenses / Financing) that was **not** built — so the guard is load-bearing, not a fallback. |
| Jump items "Verdict, Cash Flow, Grading, Improve, Projection, Market" | Verdict, Cash Flow, Grading, Improve, Market | Matches the mockup's `.jump`, which has five. Items are now filtered by what actually rendered — Fix & Flip and BRRRR produce no grading result, so those three anchors are absent and their links would have scrolled nowhere.                                                                                                                      |
| Two-up: grading table beside levers                                   | paired, table column sticky above 1240px     | The mockup pairs them at similar heights; the engine emits one lever per failing metric, measuring 399px of table against 1136px of levers. Sticky keeps the breakdown on screen instead of leaving ~740px of dead column.                                                                                                                           |

**Also fixed, outside the written steps:** the left column was `38fr` (455px rendered) where the mockup specifies a fixed `344px` at `min-width:1140px`; six hardcoded hex values in `AdvisoriesStrip` and `UpgradePathOption` that stayed light-mode-coloured in dark mode and had escaped the "analyzer: 0 hex" audit because the guard only matches Tailwind arbitrary values, not hex in a style object.

**Still unbuilt vs the mockup:** the market strip (score ring + "<market> scores 75 — rising ↑" + _Open market →_) that sits between the verdict and the rules chips; the tabbed input card; and the mockup's block order, which puts the KPI row and charts _before_ the grading table + levers.

---

### Task 15: Screener

**Mockup:** https://claude.ai/code/artifact/f4d5ad0d-84ea-43ed-be9f-c9bb743a28e0

**Files:**

- Modify: `app/(app)/screener/ScreenerPageInner.tsx` (399), `components/ScreenerTable.tsx` (377), `components/FilterRail.tsx` (223), `components/PresetChips.tsx` (98)
- Test: `app/(app)/screener/__tests__/screener-contract.test.tsx`

**Surface-specific work:**

- [x] **Step 1: Write the guard test** asserting `ScreenerTable` renders through `DataTable`, score cells render `ScorePill`, and `PresetChips` renders `Chip`.

- [x] **Step 2: Replace the results table** with `<DataTable>`. This is the surface's centrepiece: sticky header, monospace right-aligned numerics, sortable headers with `aria-sort`.

- [x] **Step 3: Render the score column as `<ScorePill>`** so colour and momentum label come from `getScoreColor()` / `getScoreLabel()` and can never disagree with the score shown elsewhere.

- [x] **Step 4: Replace `PresetChips` internals with `<Chip>`**, keeping every preset.

- [x] **Step 5: Make the filter rail read as one panel** rather than a stack of unrelated inputs — group by category with consistent field styling.

- [x] **Step 6: Verify and commit.** Run a real screen and confirm results, sorting, presets, row menu, and alert creation all still work.

```bash
git add -- "packages/frontend/app/(app)/screener"
git commit -m "refactor(screener): restyle onto DataTable, ScorePill, and Chip" -- "packages/frontend/app/(app)/screener"
```

**Outcome — deviation from this task as written:**

Step 5 says "make the filter rail read as one panel". **The mockup has no rail.** Filters are a full-width card above the results with a six-up grid (`.fgrid`, stepping to three at 1240px and two at 720px), the quick-screen presets living inside the card above it. `FilterRail.tsx` is retired for `ScreenerFilters.tsx` — the old name described a layout the design no longer has (§1.4). The collapse toggle is gone too: every field stays visible, because a filter you cannot see is a filter you forget is applied.

**`DataTable` grew rather than the screener shrinking to fit it.** Step 2 as written would have dropped row navigation, the row-actions menu, the empty state, stable row keys, and the staggered row animation. Instead the primitive gained: `rowKey`, `onRowClick` (with Enter support), `rowClassName`/`rowStyle`, per-column `width`/`cellClassName`, `ReactNode` headers so sort icons render, an `empty` slot, and `scroll={false}`. That last one matters — `ScrollShadowContainer` is itself the scroller, and nesting `DataTable`'s own `overflow-x-auto` inside it would have silently killed its edge affordances, the same nested-scroller trap as Task 14's input panel.

**Two bugs fixed in the primitive while there:** its generic was `T extends Record<string, unknown>`, which rejects plain interfaces like `ScreenerRow` (no index signature); and `aria-sort` was tied to `onSort`, so a server-sorted table with no click handler reported no sort state at all.

---

### Task 16: Reports

**Mockup:** https://claude.ai/code/artifact/bd22f957-f9c9-4d8d-b1f0-a7abef9b220d

**Files:**

- Modify: `app/(app)/reports/page.tsx` (builder), `app/(app)/reports/[id]/components/sections/core/*` (the existing 9-component report design system)
- Test: `app/(app)/reports/__tests__/reports-contract.test.tsx`

**Surface-specific work:**

- [x] **Step 1: Write the guard test** asserting the builder page renders `ControlBar` and the report core components use monospace numerics.

- [x] **Step 2: Fix the builder's dead space.** The page is mostly empty with a disabled Generate Report CTA and a large empty gradient band under the title. Tighten the layout and give the disabled state a reason.

- [x] **Step 3: Fix truncated Recent Reports titles.** They currently read "Frederick County, M…" — mid-word truncation with the same market repeated and nothing distinguishing the entries. Show the geography, the report type, and the generation date so duplicates are tellable apart.

- [x] **Step 4: Align the report core components** — `MetricsRow`, `MetricDisplay`, `ComponentScoreBadge`, `SectionCard`, `AIAnalysisBlock` — with the shared primitives. `SectionCard` is imported by 18 files, so changing it propagates widely; run the full suite after.

- [x] **Step 5: Verify and commit.** Open a generated report and confirm every section still renders with its data.

```bash
git add -- "packages/frontend/app/(app)/reports"
git commit -m "refactor(reports): restyle the builder and report core components" -- "packages/frontend/app/(app)/reports"
```

**Outcome.** The mockup's own design notes enumerate each live defect, so they drove this task rather than the prose above. Verified signed in as admin against real report history.

**Bug the restyle exposed:** comparison reports carry `template_name: "PropertyIQ Report"`, so a type badge derived from the template labelled "Charleston-North Charleston - Market Comparison" as a PropertyIQ Report — precisely the thing the badge exists to disambiguate. Type now comes off the title suffix and is stripped from the displayed title, so two same-market, same-date rows read as "Market Comparison" vs "PropertyIQ Report" instead of being indistinguishable.

**Step 4 found a brand violation, not just an alignment gap:** metric values rendered in the editorial **serif** (`--report-font-display`). Numbers are mono + tabular (§8.3), so `MetricsRow`, `MetricDisplay`, `ComponentScoreBadge` and the shared `.report-metric-value` class moved to `--report-font-mono`. The component _label_ stays display — it is prose, not a figure.

**Two mockup notes did NOT reproduce and were left alone:**

- _"Contents lists sections that do not exist."_ Checked the Austin report: all six `IN THIS REPORT` links resolve to real section ids, zero dead anchors. The note cites the Frederick report specifically, so this may be per-report rather than systemic — worth re-checking there before building a filter for a condition that may not exist.
- The comparison-report content fixes (leaked `PART 1:` prompt scaffold, the collapsed `$2K` rent row) live in generated report **content**, not in the components this task covers.

**Separate defect found, not fixed here:** a generated report's narrative reads "PropertyIQ score of 2 out of 100". §9 says the score is **1–99, never 0–100**. This is stored AI prose, so the fix belongs in the insight prompt plus a regeneration — not in a restyle. Worth its own task.

---

### Task 17: Market

**Mockup:** https://claude.ai/code/artifact/bf98674e-7cff-4a49-9253-5369e78dbf7a

**Files:**

- Modify: `app/(app)/market/explorer/MarketExplorer.tsx` (380), `components/KpiStrip.tsx` (235), `components/DetailRail.tsx` (311), `app/(app)/market/[id]/MarketDashboard.tsx` (276)
- Test: `app/(app)/market/__tests__/market-contract.test.tsx`

**Surface-specific work:**

- [x] **Step 1: Write the guard test** asserting `KpiStrip` renders `KpiTile`, score displays render `ScorePill`, and rankings render `DataTable`.

- [x] **Step 2: Replace `KpiStrip` internals with `<KpiTile>`**, adding the caption line each metric currently lacks.

- [x] **Step 3: Route every score through `<ScorePill>`** — momentum labels only, never quality words.

- [x] **Step 4: Replace ranking lists with `<DataTable>`** for aligned monospace columns.

- [x] **Step 5: Verify and commit.** Exercise the ranking and geography controls and open a market detail page.

```bash
git add -- "packages/frontend/app/(app)/market"
git commit -m "refactor(market): restyle onto KpiTile, ScorePill, and DataTable" -- "packages/frontend/app/(app)/market"
```

---

**Outcome.** `KpiTile` and `DataTable` both grew to fit the surface rather than the surface shedding features:

- `KpiTile` gained a series dot, a delta chip on the value baseline, a footer slot for the sparkline, and a `secondary` accent.
- `DataTable` gained `rowRole`. Ranking rows **select in place** (button — Enter or Space); screener rows **navigate away** (link — Enter). Reusing link semantics would have silently dropped Space-to-select; the existing Leaderboard tests caught it.

**A §9 exception retired rather than documented.** The ranking score pill was hand-rolled, with a comment declaring itself "a documented exception to CLAUDE.md §9's ScoreBadge requirement" because the ring would not fit a 76px column. `ScorePill` is exactly that compact form, so the exception is gone and `scoreBg`/`scoreColor` left the row builder with it.

**Duplicate removed:** with the ranking metric set to score, the Value column and a `showLabel` pill both printed the momentum word — rows read "VERY STRONG … VERY STRONG". The mockup keeps a numeric badge and its own mono label column separate; so does this now.

**Note for whoever touches routing:** `MarketExplorer` mounts at `/market`, not `/market/explorer` — that URL falls through to `[id]` and renders a market page for a market literally named "explorer".


### Task 18: Map — chrome only

**Mockup:** https://claude.ai/code/artifact/c2a2557f-0576-4a24-a720-20d0e0032f78

> **Hard boundary:** the Mapbox layer is not touched. The choropleth fills, the seven-colour violet-to-red scale, the baked-on state labels and values, and zoom/pan all stay exactly as they are — including the East Coast label stack, where nine states render as a text column in the Atlantic. That is Mapbox label placement and stays with the map. This task changes only what surrounds the canvas.

**Files:**

- Modify: `app/(app)/map/MapPageInner.tsx` (389) — page chrome only
- Modify: `app/(app)/map/components/RightDetailPanel/RightDetailPanel.tsx` (381), `components/RightDetailPanel/CompactScoreCard.tsx` (394)
- Modify: `app/(app)/map/config/metric-categories.tsx` (334) — presentation of the seven categories
- **Do not modify:** any file that configures Mapbox sources, layers, paint properties, or label placement
- Test: `app/(app)/map/__tests__/map-chrome.test.tsx`

- [x] **Step 1: Identify the Mapbox boundary before editing**

```bash
cd packages/frontend
grep -rln "mapbox-gl\|useMap\|addLayer\|setPaintProperty\|GeoJSONSource" "app/(app)/map"
```

Every file this prints is off-limits. Record the list; the guard test in Step 2 asserts none of them changed.

- [x] **Step 2: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const INNER = readFileSync(join(__dirname, "..", "MapPageInner.tsx"), "utf8");

describe("map chrome matches the other tools", () => {
  it("renders the shared control bar", () => {
    expect(INNER).toContain("ControlBar");
  });

  it("no longer renders a second navigation rail", () => {
    expect(INNER).not.toMatch(/IconRail|LeftRail|NavRail/);
  });

  it("uses no arbitrary hex", () => {
    expect(INNER).not.toMatch(/\[#[0-9A-Fa-f]{3,8}\]/);
  });
});
```

- [x] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- "app/(app)/map"`
Expected: FAIL on the `ControlBar` assertion

- [ ] **Step 4: Collapse two nav bars into one**

`AppBar` from Task 8 already replaced the light top nav. Now fold the second row — breadcrumb, hamburger, search, and the National / State / Metro / County / City / ZIP pills — into a single `<ControlBar>`. Keep every geography level and the search behaviour.

- [x] **Step 5: Remove the left icon rail**

The rail (Home / Maps / Analyzer / Markets / Graphs / Reports / About Us / Pricing) duplicates `AppBar`, leaving two navigation models on one screen. Delete it and return the ~64px. Confirm nothing else routes through it — some of its entries (Graphs, Markets, About Us, Pricing) are not in `AppBar`, so add any missing destinations to the `AppBar` overflow rather than dropping them.

- [ ] **Step 6: Move the metric picker into the control bar**

One button showing the active metric and its category, opening the full catalogue. All seven categories and their question subtitles survive in the sidebar: Affordability ("Can I afford to live here?"), Market Competition ("Should I act fast?"), Pricing & Deals ("Are prices going up or down?"), Area Profile ("Who lives here?"), Local Economy ("How strong is the job market?"), New Construction ("What new homes are being built?"), PropertyIQ Scores ("AI-powered market analysis").

- [ ] **Step 7: Dock the legend**

It currently floats over the Pacific with a "No data available" checkbox inside it. Move it into a map header strip: compact seven-swatch scale, min and max in monospace, the no-data key on the same line. Keep the as-of date.

- [x] **Step 8: Fix the score card's state-level message**

`CompactScoreCard` shows a grey ring reading "Select a region to see scores". At the State geography level that is misleading — a user can click every state and never get a score, because **there is no state-level PropertyIQ Score**. The geography enum is metro, county, and ZIP; 50 is the calibration point against a state average, not a score a state holds (CLAUDE.md §9). At State level the card must say scores run at metro, county, and ZIP and offer those three levels. At Metro, County, and ZIP it behaves exactly as today.

Add a test for this:

```tsx
it("does not imply a state-level score", () => {
  const card = readFileSync(
    join(__dirname, "..", "components/RightDetailPanel/CompactScoreCard.tsx"),
    "utf8",
  );
  expect(card).toMatch(/metro, county, and ZIP|not scored at state level/i);
});
```

- [ ] **Step 9: Dock the Table View control**

It floats bottom-right as an orphan pill. Move it into the control bar as a Map/Table segmented control beside the geography levels.

- [ ] **Step 10: Restyle the sidebar on the shared patterns**

Pro nudge, Homebuyer/Investor toggle, score card, seven category rows, "Explore data points". Same content and order; shared card, chip, and icon-tile treatment. Category icons come from `lucide-react`.

- [x] **Step 11: Verify the map itself did not change**

```bash
git diff --stat -- "app/(app)/map"
```

Cross-check against the Step 1 list: **no Mapbox-touching file may appear in the diff.** If one does, revert that file and move the change into the chrome layer.

Then:

```bash
npm run test:unit -- "app/(app)/map" && npx tsc --noEmit && npm run build && npx next start -p 3100
```

Load `/map` and confirm the choropleth renders identically to before — same colours, same labels, same zoom behaviour — with only the chrome changed.

- [ ] **Step 12: Commit**

```bash
git add -- "packages/frontend/app/(app)/map"
git commit -m "refactor(map): restyle the chrome, leaving the Mapbox canvas unchanged" -- "packages/frontend/app/(app)/map"
```

---

**Status: PARTIAL.** Steps 1-3, 5, 8 and 11 are done and committed. **Steps 4, 6, 7, 9, 10 are NOT done** — fold the toolbar into `ControlBar`, move the metric picker in, dock the legend, dock Table View, restyle the sidebar.

**Step 5 done.** Rail removed; canvas grows 1100x700 to 1180x700, and 1408x700 collapsed. The collapse toggle moved OUT of the panel — the panel is `md:w-0 md:overflow-hidden` when collapsed, so a toggle inside it would have been unreachable the moment it was used. `tsc` caught a second `Sidebar` consumer the grep did not suggest: `app/embed/map-full`.

**The plan contradicts itself at step 1.** Its grep flags `MapPageInner.tsx` as off-limits, but steps 4, 6 and 9 all require editing that file. Resolved in favour of the prose ("any file that **configures** Mapbox sources, layers, paint properties, or label placement"), which is the real rule. The grep returns **26 files, three of them false positives**: `MapPageInner.tsx` matches because it *imports* mapbox-gl and the hooks; `page.tsx` and `MapToolbar.tsx` match only inside *comments*. None configures a source, layer, paint property, or label. **The true off-limits set is 23 files.** Step 11 verified against that set — the diff touches `Sidebar.tsx` and `SidebarScoreCard.tsx` only, and `MapPageInner.tsx` is not modified at all.

**Step 5 blocker — RESOLVED.** The `AppBar` overflow is built (`AppBarOverflow.tsx`), `/market` is promoted into the main tool row, and `/graphs`, `/pricing`, `/about` sit behind "More". All eight rail destinations are now reachable from the app bar on every authed surface, so the rail can be deleted without stranding anything. Built as a **disclosure, not an ARIA menu** — `role="menu"`/`"menuitem"` strips the links' own semantics (a test caught it: the items stopped being findable as links) and promises arrow-key behaviour it does not implement.

**Original blocker, for context.** Deleting the left rail would strand four destinations: the rail links to `/`, `/about`, `/analyzer`, `/graphs`, `/map`, `/market`, `/pricing`, `/reports`, while `AppBar` carries only `/dashboard`, `/map`, `/analyzer`, `/screener`, `/reports`. So **`/market`, `/about`, `/graphs` and `/pricing` exist in no other chrome** — `/market` most notably, a first-class tool absent from the app bar entirely. Step 5's own instruction covers this ("add any missing destinations to the `AppBar` overflow rather than dropping them"), but that means building an overflow menu on the shared `AppBar`, which changes every app surface and wants verifying across all of them. Do that before removing the rail, not after.


# Phase D — Defects and retirement

### Task 19: Analyzer market-adjustment geography bug

Not a design change — a live defect on the most differentiated feature.

**Files:**

- Investigate: `app/(app)/analyzer/`, `packages/backend/src/metric-resolution/`
- Test: a backend spec beside the resolution service

**Reproduction:** analyze `200 Orlando Avenue, Normal, IL 61761`. The verdict narrative says _"No PIQ Score data is available for this location, so I can't gauge market tailwinds or headwinds"_ and the grading table applies `Market adj +0.00`. But Bloomington, IL (CBSA 14010) scores **75** at confidence **A** as of 2026-06-30, with a 12-month range of 68–93.

- [ ] **Step 1: Determine how the analyzer resolves geography**

```bash
grep -rn "propertyiq_scores\|getScore\|score" app/\(app\)/analyzer --include="*.ts" --include="*.tsx" | grep -i "fetch\|resolve\|zip\|metro" | head -20
```

Establish whether it queries by ZIP directly or routes through `MetricResolutionService`. CLAUDE.md §5.1 requires all backend metric fallback and geography inheritance to go through that service, with ZIP → County → Metro → State inheritance enabled by `supportsGeoInheritance: true` in `fallback-registry.ts`.

- [ ] **Step 2: Write a failing test** asserting that resolving a PropertyIQ Score for ZIP 61761 returns the Bloomington metro score of 75 by inheritance rather than null.

- [ ] **Step 3: Run it to confirm the bug reproduces.**

- [ ] **Step 4: Fix** — either enable geo inheritance for the score in the fallback registry, or route the analyzer's score lookup through `MetricResolutionService` if it currently bypasses it.

- [ ] **Step 5: Verify** the analyzer now shows a non-zero market adjustment for that address, and quantify the blast radius: how many ZIPs resolve to a scored parent but currently return null.

- [ ] **Step 6: Commit** with a pathspec covering only the files changed.

---

### Task 20: About and pricing correctness fixes

**Files:**

- Modify: `app/(app)/about/page.tsx` (408 — over the 400-line limit), `app/(app)/pricing/layout.tsx`, `pricing/components/FeatureShowcaseInsights.tsx`, `pricing/components/FeatureShowcaseData.tsx`

- [ ] **Step 1: Resolve the founder contradiction.** "Behind PropertyIQ" is first-person solo and signed "— Troy H, MBA · Founder"; "Our Team" two sections later says PropertyIQ was "founded in 2024 by a team of data scientists and real estate professionals". Pick one and make both sections agree — this is the page carrying the `Person` JSON-LD for E-E-A-T.

- [ ] **Step 2: Split `about/page.tsx`** below 400 lines by extracting the timeline and the differentiator grid into siblings.

- [ ] **Step 3: Source the "+12% excess returns" claim.** `FeatureShowcaseInsights.tsx` hardcodes it around line 283 while every other stat routes through `lib/data/validation-claims.ts`. Move it there, or remove it.

- [ ] **Step 4: Move the pricing FAQ below the content.** `pricing/layout.tsx:142-144` emits `<FaqSection>` before `{children}`, so the FAQ renders above the pricing cards. Every other page renders it last.

- [ ] **Step 5: Replace the fabricated Nashville figures.** The feature showcase renders a score tile of `68`, a `$445K / DOM 34 / +3.2%` grid, and a `Nashville MSA → Davidson Co. → ZIP 37209` drill-down as static JSX, on the page that asks for $39/month while claiming institutional-grade analysis. Fetch real values via `@/lib/data`, or label them explicitly as illustrative.

- [ ] **Step 6: Verify and commit.**

```bash
npm run test:unit && npx tsc --noEmit
git add -- "packages/frontend/app/(app)/about" "packages/frontend/app/(app)/pricing"
git commit -m "fix(marketing): resolve founder contradiction, source claims, reorder pricing FAQ" -- "packages/frontend/app/(app)/about" "packages/frontend/app/(app)/pricing"
```

---

### Task 21: Collapse to a single homepage

> **Gate:** this ends the running landing-page A/B experiment and deletes variant A. Get explicit sign-off. Everything before it ships without it.

**Files:**

- Modify: `app/(app)/page.tsx`, `middleware.ts` (rewrite block ~lines 169–230)
- Delete: `app/(app)/home-v2/`, `lib/experiments/landing-variant.ts`, `app/components/home/landing-v2/VariantStamp.tsx`, dead `app/components/home/*.tsx`

- [ ] **Step 1: Establish what variant A uniquely owns**

```bash
cd packages/frontend
for f in app/components/home/*.tsx; do
  n=$(basename "$f" .tsx)
  c=$(grep -rl "\b$n\b" --include="*.tsx" --include="*.ts" app lib components | grep -v "app/components/home/$n.tsx" | wc -l)
  echo "$c $n"
done | sort -n
```

Anything at `0` after variant A is removed is dead. Do not guess — `Footer`, `JsonLd`, and `StickyScoreBar` may still be imported elsewhere.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

describe("the homepage A/B split is retired", () => {
  it("no longer ships a home-v2 route", () => {
    expect(existsSync(join(ROOT, "app/(app)/home-v2"))).toBe(false);
  });

  it("no longer ships the landing-variant experiment module", () => {
    expect(existsSync(join(ROOT, "lib/experiments/landing-variant.ts"))).toBe(
      false,
    );
  });

  it("middleware performs no landing rewrite", () => {
    const mw = readFileSync(join(ROOT, "middleware.ts"), "utf8");
    expect(mw).not.toContain("home-v2");
    expect(mw).not.toContain("LANDING_VARIANT_COOKIE");
  });
});
```

- [ ] **Step 3: Run it to verify it fails.**

- [ ] **Step 4: Move variant B's body to the root route.** Copy the component body of `app/(app)/home-v2/page.tsx` into `app/(app)/page.tsx`, replacing variant A entirely. Keep `export const metadata = landingMetadata` so canonical SEO carries over. Remove `<VariantStamp />`.

- [ ] **Step 5: Remove the middleware rewrite.** Delete the block that rewrites `/` to `/home-v2`, the cookie set, the `/home-v2` guard near line 223, and the `@/lib/experiments/landing-variant` import at line 10. Leave auth session handling untouched.

- [ ] **Step 6: Delete the dead files.**

```bash
rm -rf "app/(app)/home-v2"
rm -f lib/experiments/landing-variant.ts app/components/home/landing-v2/VariantStamp.tsx
```

Then delete each zero-importer component from Step 1 and re-run that command to confirm nothing newly orphaned was missed.

- [ ] **Step 7: Verify.**

```bash
npm run test:unit && npx tsc --noEmit && npm run lint && npm run build && npx next start -p 3100
curl -sI http://localhost:3100/ | head -5
```

Expected: `200`, no redirect, no `piq_landing_variant` cookie.

- [ ] **Step 8: Commit.**

```bash
git add -A -- packages/frontend/app packages/frontend/lib packages/frontend/middleware.ts packages/frontend/__tests__
git commit -m "refactor(home): collapse the landing A/B split to a single homepage" -- packages/frontend/app packages/frontend/lib packages/frontend/middleware.ts packages/frontend/__tests__
```

---

## Verification

Run after every phase, and in full before shipping.

1. `cd packages/frontend && npm run test:unit` — all green, including the marketing, app-shell, and per-surface guards.
2. `npx tsc --noEmit` — exits 0. Plain `tsc`, not `nest build`; `build.json` and `nest build` exclude spec files and will hide errors.
3. `npm run lint` — clean.
4. `npm run build && npx next start -p 3100` — production preview, never dev. Dev-mode rendering hides bundling and RSC problems.
5. Walk every surface at 1440px and 390px, in light and dark:
   - `/` · `/blog` · a blog post · `/analyzer` with a real address · `/screener` with a real screen · `/reports` and a generated report · `/market` and a market detail page
   - `/map` — chrome restyled, but the choropleth must render **identically** to before: same colours, same labels, same zoom behaviour. Compare against a screenshot taken before Task 18.
   - No horizontal page scroll at 390px.
   - Dark mode shows no white-on-white or invisible text — the failure mode hardcoded hex used to cause.
   - Every figure is monospace and columns align.
   - No score reads "0–100"; no label uses a quality word.
6. Confirm the hex purge held on the surfaces this plan touched:
   ```bash
   grep -rE "\[#[0-9A-Fa-f]{6}\]" app/components/marketing app/components/app-shell app/components/home/landing-v2 | wc -l
   ```
   Expected: `0`.
7. Confirm the layout contract is singular:
   ```bash
   grep -rhoE "max-w-[0-9a-z]+" app/components/home/landing-v2 "app/(app)/blog" | sort -u
   ```
   Expected: at most `max-w-6xl`, `max-w-3xl`, `max-w-2xl` — never five or six distinct values.
8. Confirm every blog post has an image:
   ```bash
   grep -L "^image:" content/blog/*.mdx | wc -l
   ```
   Expected: `0`.
9. Lighthouse LCP on `/` no worse than before — the hero gains an image, so confirm `priority` is set and the H1 still paints in the initial SSR HTML.

## Out of scope

**The Mapbox layer.** Task 18 restyles the map's chrome but never the canvas. Two known map-layer issues stay unfixed and are not scheduled: nine East Coast states rendering as a floating text column in the Atlantic with leader lines, and permanent baked-on labels that sit at poor contrast over the darker choropleth fills. Both are Mapbox label-placement concerns and would need their own decision.

Also deliberately not here: the `components/account/sections/*` hex cluster (a separate surface with its own `bg-white` + `border-indigo-200/50` pattern), the 961 raw `<button>` elements outside the files this plan touches, and adoption of `components/ui/Button.tsx` / `Card.tsx` beyond the surfaces listed above.
