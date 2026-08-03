# PropertyIQ Marketing Layout Foundation + Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared marketing layout contract and primitive set, then rebuild the live homepage on it so the six-container-widths / five-heading-scales / 604-hex-literals problem stops recurring.

**Architecture:** A single `layout-contract.ts` exports the only permitted container width, gutter, vertical rhythm, and heading scales as string constants. Five presentational primitives (`Section`, `SectionHeading`, `Chip`, `StatTile`, `ScreenshotFrame`) consume those constants — no page ever writes a `max-w-*`, `px-*`, `py-*`, or heading size directly. Colour comes only from the M3 semantic tokens already defined in `app/globals.css`; a unit test fails the build if any primitive contains an arbitrary hex utility. The live homepage (variant B, `landing-v2`) is then rebuilt on the primitives, and the A/B machinery collapsed to a single page.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (`@theme inline` in `app/globals.css`), Vitest 3 + `@testing-library/react` 16, TypeScript.

## Global Constraints

Every task's requirements implicitly include this section.

- **No hardcoded hex in TSX.** Use semantic tokens (`bg-surface`, `text-on-surface`, `border-outline-variant`). CLAUDE.md §1.1 and §8.2. Arbitrary-value utilities like `bg-[#3949AB]` are forbidden.
- **New colours go in `app/globals.css` only**, following the existing convention: raw value as `--md-<name>` in `:root` (line 9) _and_ in the `@media (prefers-color-scheme: dark)` block (line 86), then mapped as `--color-<name>: var(--md-<name>)` inside `@theme inline` (line 146).
- **File size:** logic/util files under 300 lines, React components under 400. One exported component per file plus local helpers; two or more exports means split the file. CLAUDE.md §1.3.
- **Numbers use Roboto Mono.** Scores, metrics, and figures get `font-mono` + `tabular-nums`. CLAUDE.md §8.3.
- **Shape:** cards `rounded-xl`, buttons and chips `rounded-full`. Cards get `shadow-sm`. CLAUDE.md §8.4.
- **PropertyIQ Score is 1–99**, where 50 = that market's state average. Never "0–100".
- **Score labels are momentum words** (VERY STRONG / STRONG / RISING / FIRMING / STEADY / EASING / WEAK / VERY WEAK). Never quality words like "excellent" or "poor". CLAUDE.md §9.
- **Coverage copy** comes from `COVERAGE_COPY` and `formatMarketsScored()` in `packages/frontend/lib/data/validation-claims.ts`. Never hardcode market counts.
- **Git:** branch is `develop`. Commit with an explicit pathspec (the working tree has unrelated in-flight work). No `Co-Authored-By` trailer. Never push unless asked.
- **Run all commands from `packages/frontend`.** Test command is `npm run test:unit`.

---

## File Structure

**Create — `packages/frontend/app/components/marketing/`**

| File                                | Responsibility                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `layout-contract.ts`                | The only source of container width, gutter, rhythm, surface, and heading-scale strings. Pure constants, no JSX. |
| `Section.tsx`                       | Renders a `<section>` with a surface band, vertical rhythm, and the centred container.                          |
| `SectionHeading.tsx`                | Eyebrow + H2 + subhead at fixed scales.                                                                         |
| `Chip.tsx`                          | Rounded-full pill with an optional leading icon slot and four tones.                                            |
| `StatTile.tsx`                      | Uppercase micro-label / monospace value / caption, with an accent left stripe.                                  |
| `ScreenshotFrame.tsx`               | Bordered, rounded product-image container wrapping `next/image`.                                                |
| `index.ts`                          | Barrel re-export.                                                                                               |
| `__tests__/layout-contract.test.ts` | Asserts the contract stays singular (one width, one gutter, two rhythms, four heading scales).                  |
| `__tests__/primitives.test.tsx`     | Render assertions for the five primitives.                                                                      |
| `__tests__/no-hex.test.ts`          | Fails if any file in the directory contains an arbitrary hex utility.                                           |

**Modify**

| File                                                                                                                                                                                               | Change                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/frontend/app/globals.css`                                                                                                                                                                | Add `--md-hero-from` / `--md-hero-to` in `:root` and the dark block; map both in `@theme inline`. |
| `packages/frontend/app/components/home/landing-v2/BeatSection.tsx`                                                                                                                                 | Delegate spacing and container to `Section`.                                                      |
| `packages/frontend/app/components/home/landing-v2/BeatHero.tsx`                                                                                                                                    | Rebuild layout on the contract; monospace the score numerals.                                     |
| `packages/frontend/app/components/home/landing-v2/BeatScore.tsx`, `BeatProof.tsx`, `BeatTension.tsx`, `BeatDataDepth.tsx`, `BeatFoundation.tsx`, `BeatPersona.tsx`, `BeatMap.tsx`, `BeatClose.tsx` | Replace bespoke wrappers and headings with `Section` / `SectionHeading` / `StatTile` / `Chip`.    |
| `packages/frontend/app/(app)/page.tsx`                                                                                                                                                             | Task 12 only — becomes the single homepage.                                                       |
| `packages/frontend/middleware.ts`                                                                                                                                                                  | Task 12 only — remove the landing A/B rewrite block (~lines 169–230).                             |

**Delete (Task 12 only, gated)**

`app/(app)/home-v2/`, `lib/experiments/landing-variant.ts`, `app/components/home/landing-v2/VariantStamp.tsx`, and any `app/components/home/*.tsx` left with zero importers.

---

### Task 1: Hero gradient tokens

**Files:**

- Modify: `packages/frontend/app/globals.css` (`:root` from line 9, dark block from line 86, `@theme inline` from line 146)

**Interfaces:**

- Consumes: nothing
- Produces: Tailwind utilities `from-hero-from` and `to-hero-to`, usable as `bg-gradient-to-b from-hero-from to-hero-to`

- [ ] **Step 1: Add the light-mode raw tokens**

In `app/globals.css`, inside the `:root` block, immediately after the `--md-warning-*` group (around line 38), add:

```css
/* Marketing hero wash — pale mint to pale lavender, the neutral ends of the
     indigo range. Used only by the homepage hero band. */
--md-hero-from: #f4f8f8;
--md-hero-to: #efeefa;
```

- [ ] **Step 2: Add the dark-mode raw tokens**

Inside the `@media (prefers-color-scheme: dark)` block that starts at line 86, add the same two names with dark values:

```css
--md-hero-from: #101520;
--md-hero-to: #14131f;
```

- [ ] **Step 3: Map them into the Tailwind theme**

Inside `@theme inline` (starts line 146), after the `--color-warning-*` group, add:

```css
--color-hero-from: var(--md-hero-from);
--color-hero-to: var(--md-hero-to);
```

- [ ] **Step 4: Verify the utilities compile**

Run: `npm run build 2>&1 | tail -20`
Expected: build completes with no CSS errors. (A Tailwind v4 theme key that fails to parse surfaces as a build error, not a silent no-op.)

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

- Consumes: nothing
- Produces: `CONTAINER: string`, `PROSE: string`, `RHYTHM: Record<Rhythm, string>`, `SURFACE: Record<Surface, string>`, `HEADING: Record<HeadingLevel, string>`, and the types `Rhythm = "standard" | "tight"`, `Surface = "a" | "b"`, `HeadingLevel = "hero" | "page" | "section" | "card"`

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

  it("uses the same responsive gutter for both containers", () => {
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
 * Before this file existed the marketing pages used six different container
 * widths (max-w-2xl through max-w-7xl), two gutter conventions split by route
 * group, twelve per-section vertical rhythms on the homepage alone, and five
 * H1 scales. Pages must import from here rather than writing spacing or
 * heading utilities inline.
 */

/** Standard content column. The only permitted marketing container width. */
export const CONTAINER = "mx-auto w-full max-w-6xl px-6 lg:px-8";

/** Narrow column for running prose — blog bodies, legal copy. */
export const PROSE = "mx-auto w-full max-w-3xl px-6 lg:px-8";

export const RHYTHM = {
  /** Default section spacing. */
  standard: "py-20 lg:py-28",
  /** Dense or utility sections — stat strips, breadcrumb bands. */
  tight: "py-12 lg:py-16",
} as const;
export type Rhythm = keyof typeof RHYTHM;

/**
 * Sections alternate between exactly two surfaces. This replaces the
 * page-wide gradient, which prevented any section from owning a surface.
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
  /** Section headings. */
  section: "text-2xl md:text-3xl font-bold tracking-tight",
  /** Card and sub-section headings. */
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
- Produces: `Section({ surface?: Surface; rhythm?: Rhythm; id?: string; children: ReactNode })` — defaults `surface="a"`, `rhythm="standard"`

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

### Task 4: SectionHeading primitive

**Files:**

- Create: `packages/frontend/app/components/marketing/SectionHeading.tsx`
- Modify: `packages/frontend/app/components/marketing/__tests__/primitives.test.tsx`

**Interfaces:**

- Consumes: `HEADING` from `./layout-contract`
- Produces: `SectionHeading({ eyebrow?: string; title: string; subhead?: ReactNode; align?: "center" | "start" })` — default `align="center"`

- [ ] **Step 1: Write the failing test**

Append to `packages/frontend/app/components/marketing/__tests__/primitives.test.tsx`, and add `SectionHeading` to the imports at the top (`import { SectionHeading } from "../SectionHeading";`):

```tsx
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

  it("omits the eyebrow element when not given one", () => {
    const { container } = render(<SectionHeading title="Bare" />);
    expect(container.querySelectorAll("span")).toHaveLength(0);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- app/components/marketing`
Expected: FAIL — `Failed to resolve import "../SectionHeading"`

- [ ] **Step 3: Write the implementation**

Create `packages/frontend/app/components/marketing/SectionHeading.tsx`:

```tsx
import type { ReactNode } from "react";
import { HEADING } from "./layout-contract";

/**
 * The repeated section-header unit: coloured uppercase eyebrow, H2 at the one
 * section scale, optional subhead. Using this everywhere is most of what makes
 * a long marketing page read as ordered rather than stacked.
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- app/components/marketing`
Expected: PASS, 18 tests total

- [ ] **Step 5: Commit**

```bash
git add -- packages/frontend/app/components/marketing
git commit -m "feat(marketing): add the SectionHeading primitive" -- packages/frontend/app/components/marketing
```

---

### Task 5: Chip primitive

**Files:**

- Create: `packages/frontend/app/components/marketing/Chip.tsx`
- Modify: `packages/frontend/app/components/marketing/__tests__/primitives.test.tsx`

**Interfaces:**

- Consumes: nothing
- Produces: `Chip({ children: ReactNode; icon?: ReactNode; tone?: "neutral" | "primary" | "positive" | "warning" })` — default `tone="neutral"`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/primitives.test.tsx`, adding `import { Chip } from "../Chip";` at the top:

```tsx
describe("Chip", () => {
  it("renders its label", () => {
    render(<Chip>Market Score</Chip>);
    expect(screen.getByText("Market Score")).toBeInTheDocument();
  });

  it("is a full-radius pill per the shape scale", () => {
    const { container } = render(<Chip>x</Chip>);
    expect(container.firstElementChild?.className).toContain("rounded-full");
  });

  it("uses neutral tone by default", () => {
    const { container } = render(<Chip>x</Chip>);
    expect(container.firstElementChild?.className).toContain("bg-surface");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- app/components/marketing`
Expected: FAIL — `Failed to resolve import "../Chip"`

- [ ] **Step 3: Write the implementation**

Create `packages/frontend/app/components/marketing/Chip.tsx`:

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
 * One pill component for every chip on the marketing surfaces — feature
 * switchers, taxonomy tags, filter labels. Replaces roughly eleven independent
 * chip implementations scattered across the codebase.
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- app/components/marketing`
Expected: PASS, 23 tests total

- [ ] **Step 5: Commit**

```bash
git add -- packages/frontend/app/components/marketing
git commit -m "feat(marketing): add the Chip primitive" -- packages/frontend/app/components/marketing
```

---

### Task 6: StatTile primitive

**Files:**

- Create: `packages/frontend/app/components/marketing/StatTile.tsx`
- Modify: `packages/frontend/app/components/marketing/__tests__/primitives.test.tsx`

**Interfaces:**

- Consumes: nothing
- Produces: `StatTile({ label: string; value: string; caption?: string; accent?: "primary" | "tertiary" | "warning" | "error" })` — default `accent="primary"`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/primitives.test.tsx`, adding `import { StatTile } from "../StatTile";` at the top:

```tsx
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

  it("is a rounded-xl card with a shadow per the shape scale", () => {
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

  it("omits the caption element when not given one", () => {
    render(<StatTile label="L" value="1" />);
    expect(screen.queryByText("Realtor.com median")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- app/components/marketing`
Expected: FAIL — `Failed to resolve import "../StatTile"`

- [ ] **Step 3: Write the implementation**

Create `packages/frontend/app/components/marketing/StatTile.tsx`:

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
 * signal so the value itself does not have to be colour-coded.
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- app/components/marketing`
Expected: PASS, 28 tests total

- [ ] **Step 5: Commit**

```bash
git add -- packages/frontend/app/components/marketing
git commit -m "feat(marketing): add the StatTile primitive" -- packages/frontend/app/components/marketing
```

---

### Task 7: ScreenshotFrame primitive

**Files:**

- Create: `packages/frontend/app/components/marketing/ScreenshotFrame.tsx`
- Modify: `packages/frontend/app/components/marketing/__tests__/primitives.test.tsx`

**Interfaces:**

- Consumes: `next/image`
- Produces: `ScreenshotFrame({ src: string; alt: string; width: number; height: number; priority?: boolean })` — default `priority=false`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/primitives.test.tsx`, adding `import { ScreenshotFrame } from "../ScreenshotFrame";` at the top:

```tsx
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

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- app/components/marketing`
Expected: FAIL — `Failed to resolve import "../ScreenshotFrame"`

- [ ] **Step 3: Write the implementation**

Create `packages/frontend/app/components/marketing/ScreenshotFrame.tsx`:

```tsx
import Image from "next/image";

/**
 * Consistent framing for product screenshots. Every marketing image gets the
 * same border, radius, and elevation so screenshots read as one set rather
 * than as pasted-in pictures.
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- app/components/marketing`
Expected: PASS, 30 tests total

- [ ] **Step 5: Commit**

```bash
git add -- packages/frontend/app/components/marketing
git commit -m "feat(marketing): add the ScreenshotFrame primitive" -- packages/frontend/app/components/marketing
```

---

### Task 8: Barrel export and the hex regression guard

**Files:**

- Create: `packages/frontend/app/components/marketing/index.ts`
- Create: `packages/frontend/app/components/marketing/__tests__/no-hex.test.ts`

**Interfaces:**

- Consumes: all five primitives and the contract
- Produces: `@/app/components/marketing` as the single import specifier for marketing pages

- [ ] **Step 1: Write the failing test**

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
 * class of drift returning to the primitives.
 */
describe("marketing primitives use semantic tokens only", () => {
  const files = readdirSync(DIR).filter(
    (f) => f.endsWith(".ts") || f.endsWith(".tsx"),
  );

  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s contains no arbitrary hex utility", (file) => {
    const source = readFileSync(join(DIR, file), "utf8");
    expect(source).not.toMatch(ARBITRARY_HEX);
  });

  it.each(files)("%s contains no bare hex colour literal", (file) => {
    const source = readFileSync(join(DIR, file), "utf8");
    expect(source).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
  });
});
```

- [ ] **Step 2: Run test to verify it passes already**

Run: `npm run test:unit -- app/components/marketing/__tests__/no-hex`
Expected: PASS — the primitives were written token-only, so this guard should be green from the start. If it fails, a primitive has a hex literal; replace it with a semantic token before continuing.

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

- [ ] **Step 4: Verify the whole suite and types**

Run: `npm run test:unit -- app/components/marketing && npx tsc --noEmit`
Expected: all marketing tests PASS; `tsc` exits 0. Use plain `npx tsc --noEmit`, not `nest build` — see `reference_backend-tsc-verification`.

- [ ] **Step 5: Commit**

```bash
git add -- packages/frontend/app/components/marketing
git commit -m "feat(marketing): add barrel export and hex regression guard" -- packages/frontend/app/components/marketing
```

---

### Task 9: Rebuild BeatSection on the contract

**Files:**

- Modify: `packages/frontend/app/components/home/landing-v2/BeatSection.tsx` (41 lines)
- Test: `packages/frontend/app/components/home/landing-v2/__tests__/beat-section.test.tsx`

**Interfaces:**

- Consumes: `Section` from `@/app/components/marketing`
- Produces: `BeatSection` keeps its existing public props so the eight Beat components that render it need no changes in this task

- [ ] **Step 1: Read the current file**

Run: `cat "app/components/home/landing-v2/BeatSection.tsx"`

Note its exact current prop signature — the rebuild must preserve it. It currently applies `py-20 md:py-28` and `max-w-6xl px-5` itself; those responsibilities move to `Section`.

- [ ] **Step 2: Write the failing test**

Create `packages/frontend/app/components/home/landing-v2/__tests__/beat-section.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BeatSection } from "../BeatSection";

describe("BeatSection delegates layout to the shared contract", () => {
  it("uses the contract container width, not its own", () => {
    const { container } = render(<BeatSection>x</BeatSection>);
    const html = container.innerHTML;
    expect(html).toContain("max-w-6xl");
    expect(html).not.toContain("max-w-5xl");
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
Expected: FAIL — the current component emits `px-5` and `py-20 md:py-28`

- [ ] **Step 4: Rewrite BeatSection**

Replace the body of `packages/frontend/app/components/home/landing-v2/BeatSection.tsx` so it delegates to `Section`. Preserve every prop the current version accepts; the version below assumes `{ id?, surface?, children }` — if the file you read in Step 1 has additional props, keep them and pass them through.

```tsx
import type { ReactNode } from "react";
import { Section } from "@/app/components/marketing";
import type { Surface } from "@/app/components/marketing";

/**
 * Homepage section wrapper. Spacing, container width, and surface now come
 * from the shared layout contract rather than being set here — the homepage
 * previously carried twelve distinct per-section rhythms.
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

- [ ] **Step 6: Verify the homepage still renders**

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds. If a Beat component passed a prop the rewrite dropped, `tsc` fails here — restore that prop.

- [ ] **Step 7: Commit**

```bash
git add -- packages/frontend/app/components/home/landing-v2
git commit -m "refactor(home): delegate BeatSection layout to the shared contract" -- packages/frontend/app/components/home/landing-v2
```

---

### Task 10: Rebuild BeatHero on the contract

**Files:**

- Modify: `packages/frontend/app/components/home/landing-v2/BeatHero.tsx` (159 lines)
- Test: `packages/frontend/app/components/home/landing-v2/__tests__/beat-hero.test.tsx`

**Interfaces:**

- Consumes: `Section`, `ScreenshotFrame`, `Chip`, `HEADING` from `@/app/components/marketing`
- Produces: `BeatHero` with its existing props unchanged

- [ ] **Step 1: Read the current file**

Run: `cat "app/components/home/landing-v2/BeatHero.tsx"`

Record: the exact headline and subhead copy, the CTA labels and hrefs, any props, and any analytics `trackEvent` calls. **All of that content is preserved.** Only the layout scaffolding, the gradient, and the numeral typography change.

- [ ] **Step 2: Write the failing test**

Create `packages/frontend/app/components/home/landing-v2/__tests__/beat-hero.test.tsx`:

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
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toContain("text-4xl md:text-5xl lg:text-6xl");
  });

  it("renders score numerals in monospace", () => {
    const { container } = render(<BeatHero />);
    const mono = container.querySelectorAll(".font-mono.tabular-nums");
    expect(mono.length).toBeGreaterThan(0);
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
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- app/components/home/landing-v2/__tests__/beat-hero`
Expected: FAIL on the hero-scale, monospace, and gradient-token assertions

- [ ] **Step 4: Rebuild the hero layout**

Edit `BeatHero.tsx`. Keep every string of copy, every CTA href, and every analytics call exactly as found in Step 1. Change only the following:

Replace the outer wrapper (currently `pb-10 pt-12 md:pb-14 md:pt-14` with `max-w-6xl px-5`) with the gradient band plus `Section`:

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

Change the `<h1>` className from its current `font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl` to use the contract:

```tsx
import { HEADING } from "@/app/components/marketing";
// ...
<h1 className={`${HEADING.hero} text-balance text-on-surface`}>
```

Wrap each score numeral in the headline so figures are monospace:

```tsx
<span className="font-mono tabular-nums">16</span>
```

The hero is currently text-only; adding `ScreenshotFrame` puts the product above the fold. Use `market-scores-detail-v2.png`, which already exists in `public/images/home/`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:unit -- app/components/home/landing-v2/__tests__/beat-hero`
Expected: PASS, 5 tests

- [ ] **Step 6: Check LCP did not regress**

Build and serve a production preview, then measure:

```bash
npm run build && npx next start -p 3100
```

Load `http://localhost:3100/` and check the hero image is not lazy-loaded (it carries `priority`). The previous hero was deliberately tuned so the H1 and subhead paint in the initial SSR HTML with no opacity gating — preserve that. Do not reintroduce `opacity: 0` on the H1 or subhead.

- [ ] **Step 7: Commit**

```bash
git add -- packages/frontend/app/components/home/landing-v2
git commit -m "feat(home): rebuild the hero on the layout contract with a product screenshot" -- packages/frontend/app/components/home/landing-v2
```

---

### Task 11: Move the remaining Beat sections onto the primitives

**Files:**

- Modify: `packages/frontend/app/components/home/landing-v2/BeatScore.tsx` (93), `BeatProof.tsx` (215), `BeatTension.tsx` (83), `BeatDataDepth.tsx` (78), `BeatFoundation.tsx` (102), `BeatPersona.tsx` (31), `BeatMap.tsx` (23), `BeatClose.tsx` (44)
- Test: `packages/frontend/app/components/home/landing-v2/__tests__/beats-contract.test.tsx`

**Interfaces:**

- Consumes: `Section`, `SectionHeading`, `StatTile`, `Chip` from `@/app/components/marketing`
- Produces: no public API change — each Beat keeps its current export name and props

- [ ] **Step 1: Write the failing test**

Create `packages/frontend/app/components/home/landing-v2/__tests__/beats-contract.test.tsx`:

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

  // Section-scale padding only (py-10 and up). Small internal spacing such as
  // py-2 on a chip row is legitimate and must not fail this guard.
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
Expected: FAIL for several files — `BeatScore.tsx` and `BeatProof.tsx` currently set `max-w-6xl` and their own padding

- [ ] **Step 3: Convert each Beat, one at a time**

For each file in the list, in ascending size order (`BeatMap`, `BeatPersona`, `BeatClose`, `BeatDataDepth`, `BeatTension`, `BeatScore`, `BeatFoundation`, `BeatProof`):

1. Wrap the content in `<BeatSection surface="a">` or `surface="b"`, alternating so adjacent sections differ.
2. Delete any `max-w-*`, `px-*`, and `py-*` from the component's own wrapper — `Section` owns them now.
3. Replace any bespoke section heading markup with `<SectionHeading eyebrow=… title=… subhead=… />`, keeping the existing copy verbatim.
4. Replace any hand-built metric block with `<StatTile label=… value=… caption=… />`.
5. Replace any hand-built pill with `<Chip>`.
6. Replace arbitrary hex utilities with the semantic token of the same role: `[#1A237E]` → `text-on-surface` or `bg-primary` depending on use, `[#00C853]` → `text-tertiary`, `[#C5CAE9]` → `text-on-surface-variant`, `[#3949AB]` → `bg-primary` / `text-primary`.

Run the test after each file so you know which conversion broke something.

**Worked example.** A Beat that currently looks like this:

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

becomes this:

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

Copy stays byte-identical. What disappears is the section padding, the container, the bespoke heading sizes, and all six hex literals.

**`BeatProof.tsx` is 215 lines.** If converting it pushes past 400, split the score-band table into a sibling `BeatProofBands.tsx` — one exported component per file (CLAUDE.md §1.3).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- app/components/home/landing-v2`
Expected: PASS, all Beat files clean

- [ ] **Step 5: Verify visually against the mockup**

```bash
npm run build && npx next start -p 3100
```

Open `http://localhost:3100/` and compare against the approved mockup at `https://claude.ai/code/artifact/99e2d97d-df27-4d55-9f7b-83da181b3697`. Check at 1440px and 390px, in both light and dark. Confirm section bands alternate and no section runs edge-to-edge on a gradient.

- [ ] **Step 6: Commit**

```bash
git add -- packages/frontend/app/components/home/landing-v2
git commit -m "refactor(home): move the Beat sections onto the marketing primitives" -- packages/frontend/app/components/home/landing-v2
```

---

### Task 12: Collapse to a single homepage

> **Gate:** this task ends the running landing-page A/B experiment and deletes variant A. Get explicit sign-off before starting. Everything through Task 11 ships without it.

**Files:**

- Modify: `packages/frontend/app/(app)/page.tsx`
- Modify: `packages/frontend/middleware.ts` (rewrite block, ~lines 169–230)
- Delete: `packages/frontend/app/(app)/home-v2/`, `packages/frontend/lib/experiments/landing-variant.ts`, `packages/frontend/app/components/home/landing-v2/VariantStamp.tsx`

**Interfaces:**

- Consumes: the rebuilt `landing-v2` components from Tasks 9–11
- Produces: `/` serving the rebuilt page directly, with no rewrite and no variant cookie

- [ ] **Step 1: Establish what variant A uniquely owns**

```bash
cd packages/frontend
for f in app/components/home/*.tsx; do
  n=$(basename "$f" .tsx)
  c=$(grep -rl "\b$n\b" --include="*.tsx" --include="*.ts" app lib components | grep -v "app/components/home/$n.tsx" | wc -l)
  echo "$c $n"
done | sort -n
```

Anything reporting `0` after variant A is removed is dead. Do not delete by guesswork — `Footer`, `JsonLd`, and `StickyScoreBar` may still be imported by variant B or elsewhere.

- [ ] **Step 2: Write the failing test**

Create `packages/frontend/__tests__/single-homepage.test.ts`:

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

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- __tests__/single-homepage`
Expected: FAIL on all three — the route, the module, and the middleware references all still exist

- [ ] **Step 4: Move variant B's page body to the root route**

Copy the component body of `app/(app)/home-v2/page.tsx` into `app/(app)/page.tsx`, replacing variant A's body entirely. Keep `export const metadata = landingMetadata` from the existing root page so canonical SEO carries over unchanged. Remove the `<VariantStamp />` element.

- [ ] **Step 5: Remove the middleware rewrite**

In `middleware.ts`, delete the landing A/B block (the `if` that rewrites `/` to `/home-v2`, the cookie set, and the `/home-v2` guard near line 223) and the `@/lib/experiments/landing-variant` import at line 10. Leave every other middleware concern — auth session handling in particular — untouched.

- [ ] **Step 6: Delete the dead files**

```bash
cd packages/frontend
rm -rf "app/(app)/home-v2"
rm -f lib/experiments/landing-variant.ts
rm -f app/components/home/landing-v2/VariantStamp.tsx
```

Then delete each `app/components/home/*.tsx` that Step 1 reported with zero importers. Re-run the Step 1 command afterwards to confirm nothing newly orphaned was missed.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npm run test:unit && npx tsc --noEmit && npm run lint`
Expected: all pass. A dangling import from a deleted component surfaces here.

- [ ] **Step 8: Verify `/` serves the rebuilt page with no rewrite**

```bash
npm run build && npx next start -p 3100
curl -sI http://localhost:3100/ | head -5
```

Expected: `200`, no redirect, and no `piq_landing_variant` cookie in the response. Load the page and confirm it matches the Task 11 result.

- [ ] **Step 9: Commit**

```bash
git add -A -- packages/frontend/app packages/frontend/lib packages/frontend/middleware.ts packages/frontend/__tests__
git commit -m "refactor(home): collapse the landing A/B split to a single homepage" -- packages/frontend/app packages/frontend/lib packages/frontend/middleware.ts packages/frontend/__tests__
```

---

## Verification

End-to-end, after Task 11 (or Task 12 if taken):

1. `cd packages/frontend && npm run test:unit` — all green, including the three new marketing suites.
2. `npx tsc --noEmit` — exits 0. Plain `tsc`, not `nest build`.
3. `npm run lint` — clean.
4. `npm run build && npx next start -p 3100` — production preview, not dev. Dev-mode rendering hides bundling and RSC problems.
5. At `http://localhost:3100/`, check:
   - Section bands alternate `bg-surface` / `bg-surface-container-low`; no page-wide gradient.
   - The hero shows a product screenshot above the fold.
   - Every score and metric renders in Roboto Mono with aligned figures.
   - Nothing reads "0–100"; the score is described as 1–99.
   - Toggle OS dark mode — no white-on-white or invisible text. This is the failure mode hardcoded hex used to cause.
   - At 390px width the page does not scroll horizontally.
6. Confirm the hex purge held:
   ```bash
   cd packages/frontend
   grep -rE "\[#[0-9A-Fa-f]{6}\]" app/components/marketing app/components/home/landing-v2 | wc -l
   ```
   Expected: `0`.
7. Confirm the layout contract is singular across the rebuilt homepage:
   ```bash
   grep -rhoE "max-w-[0-9a-z]+" app/components/home/landing-v2 | sort -u
   ```
   Expected: at most `max-w-6xl`, `max-w-3xl`, `max-w-2xl` (the last from `SectionHeading`'s subhead) — never five or six distinct values.

## Out of scope

Tracked for their own plans, deliberately not here.

**Blog** — frontmatter `image` field, hero images generated for the 77 existing posts via the content-pipeline's headless-Chromium renderer, `PostCard` with an image slot, Source Serif 4 prose replacing bare `prose prose-lg`, and the `blog/layout.tsx` + `blog/[slug]/page.tsx` double-pad.

**Surface restyles** — analyzer, map, screener, reports, market. Mockups approved; each is its own plan.

**Defects found during this work, each on a surface this plan does not touch:**

| Defect                                                                                                                                                                                                                                       | Location                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Analyzer reports no PropertyIQ Score and applies `Market adj +0.00` for an address in Bloomington, IL — which scores 75 at confidence A (CBSA 14010, 2026-06-30). Likely geography resolution keying on ZIP without inheriting up the chain. | analyzer + `MetricResolutionService`             |
| "Behind PropertyIQ" is first-person solo founder; "Our Team" two sections later says "founded in 2024 by a team of data scientists".                                                                                                         | `app/(app)/about/page.tsx`                       |
| `about/page.tsx` is 408 lines, over the 400-line component limit.                                                                                                                                                                            | `app/(app)/about/page.tsx`                       |
| "+12% excess returns" hardcoded rather than sourced from `lib/data/validation-claims.ts` like every other stat.                                                                                                                              | `pricing/components/FeatureShowcaseInsights.tsx` |
| FAQ renders above the page body because `FaqSection` precedes `{children}`; every other page renders it last.                                                                                                                                | `app/(app)/pricing/layout.tsx:142-144`           |
| Feature showcase displays fabricated Nashville figures (score 68, $445K, DOM 34) while a live scoring API is available.                                                                                                                      | `pricing/components/FeatureShowcaseData.tsx`     |
