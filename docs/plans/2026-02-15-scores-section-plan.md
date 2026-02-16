# Scores Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a public "Scores" section with two pages — an overview page explaining PropertyIQ Scores and a methodology page proving their value with the full validation report.

**Architecture:** Two new Next.js pages under `app/scores/` with a shared layout. The overview page is static JSX. The methodology page renders the validation report markdown at build time using `react-markdown` + `remark-gfm`. Navigation updated to include "Scores" in the top nav.

**Tech Stack:** Next.js (static pages), react-markdown + remark-gfm (markdown rendering), Tailwind CSS (styling), lucide-react (icons)

**Design doc:** `docs/plans/2026-02-15-scores-section-design.md`

---

### Task 1: Install Markdown Dependencies

**Files:**
- Modify: `packages/frontend/package.json`

**Step 1: Install react-markdown and remark-gfm**

Run:
```bash
cd packages/frontend && npm install react-markdown remark-gfm
```

**Step 2: Verify installation**

Run:
```bash
cd packages/frontend && node -e "require('react-markdown'); require('remark-gfm'); console.log('OK')"
```
Expected: `OK`

**Step 3: Commit**

```bash
git add packages/frontend/package.json packages/frontend/package-lock.json
git commit -m "chore: add react-markdown and remark-gfm for scores methodology page"
```

---

### Task 2: Add "Scores" to Top Navigation

**Files:**
- Modify: `packages/frontend/src/components/layout/Header.tsx` (lines 6-19)

**Step 1: Add ScoreIcon import**

In `Header.tsx`, update the import on lines 6-10 to add `ScoreIcon`:

```typescript
import {
    MenuIcon, CloseIcon, PersonIcon, SettingsIcon, CreditCardIcon,
    BookIcon, HierarchyIcon, HelpIcon, LogoutIcon, HomeIcon,
    MapIcon, TrendingIcon, ArticleIcon, InfoIcon, MoneyIcon, MarketsIcon, ScoreIcon
} from '@/src/components/common/Icons';
```

**Step 2: Add Scores nav item**

In the `NAV_LINKS` array (lines 12-20), add the Scores entry after Reports and before About us:

```typescript
const NAV_LINKS = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Maps', href: '/map', icon: MapIcon },
    { name: 'Markets', href: '/market', icon: MarketsIcon },
    { name: 'Graphs', href: '/graphs', icon: TrendingIcon },
    { name: 'Reports', href: '/reports', icon: ArticleIcon },
    { name: 'Scores', href: '/scores', icon: ScoreIcon },
    { name: 'About us', href: '/about', icon: InfoIcon },
    { name: 'Pricing', href: '/pricing', icon: MoneyIcon },
];
```

**Step 3: Verify the app compiles**

Run:
```bash
cd packages/frontend && npx next build --no-lint 2>&1 | head -20
```
Expected: No import errors

**Step 4: Commit**

```bash
git add packages/frontend/src/components/layout/Header.tsx
git commit -m "feat: add Scores to top navigation"
```

---

### Task 3: Create Scores Layout

**Files:**
- Create: `packages/frontend/app/scores/layout.tsx`

**Step 1: Create the layout file**

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PropertyIQ Scores',
  description: 'AI-powered scores that predict real estate market performance, validated across 1.1M+ observations.',
};

export default function ScoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/scores/layout.tsx
git commit -m "feat: add scores section layout"
```

---

### Task 4: Create Scores Overview Page

**Files:**
- Create: `packages/frontend/app/scores/page.tsx`

**Step 1: Create the overview page**

Use the `frontend-design` skill to create this page with these exact requirements:

- **Route:** `/scores`
- **Server component** (no `'use client'`)
- **Design doc reference:** `docs/plans/2026-02-15-scores-section-design.md`, "Page 1: Scores Overview" section

**Imports to use:**
```typescript
import { Target, TrendingUp, Shield, ArrowRight, Database, Brain, Award } from 'lucide-react';
import Link from 'next/link';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
```

**Page structure (5 sections):**

1. **Hero** — `PageHeaderWithBreadcrumbs` with:
   - `breadcrumbs={[{ label: 'Scores' }]}`
   - `title="PropertyIQ Scores"`
   - `description="Data-driven scores that predict real estate market performance"`
   - `icon={<Target className="w-5 h-5" />}`
   - Below it, a subtitle line: "Validated across 1.1M+ observations, 384 metros, 5 years of data"

2. **Three Score Cards** — `grid md:grid-cols-3 gap-6` with cards for:
   - **HomeReady** (icon: TrendingUp, color: primary) — "Predicts home price appreciation potential." Best for homebuyers. Measures: demand score, days on market, affordability, hotness.
   - **InvestorEdge** (icon: Target, color: tertiary) — "Predicts total investment return." Best for rental investors. Measures: gross rent, days on market, supply score, demand.
   - **MarketHealth** (icon: Shield, color: secondary) — "Measures market stability and fundamentals." Best for risk assessment. Measures: price trends, inventory levels, economic indicators.
   - Each card: icon in colored container, h3 name, paragraph description, ul with 3-4 "what it measures" bullets, sample score badge "Score: 82 — Grade: A"

3. **Value Proposition** — serif heading "Why Scores Matter", dollar stat "$27,100 more equity on a typical home over 3 years", explanation of quintile spread, CTA link to `/scores/methodology`

4. **How It Works** — 3-step horizontal flow:
   - Step 1: Database icon + "40+ Metrics" + "We collect data from Zillow, Census, BLS, and more"
   - Step 2: Brain icon + "ML Analysis" + "Elastic net cross-validation identifies what predicts returns"
   - Step 3: Award icon + "Score 0-100" + "Each location gets a score with letter grade and confidence level"

5. **CTA Footer** — border-t separator, "Ready to find the best markets?", Link to `/map` with primary button styling

**Styling patterns to follow:**
- Card styling: `bg-surface-container border border-outline-variant rounded-2xl p-5`
- Section spacing: `mt-12 space-y-16`
- Headings: `text-xl font-semibold text-on-surface` with icon
- Editorial headings: `font-[var(--font-source-serif)]`
- Body text: `text-on-surface-variant leading-relaxed`
- Stat emphasis: `text-3xl font-bold text-primary`

**Step 2: Verify it renders**

Run:
```bash
cd packages/frontend && npx next build --no-lint 2>&1 | tail -10
```
Expected: Build succeeds, `/scores` listed in output

**Step 3: Commit**

```bash
git add packages/frontend/app/scores/page.tsx
git commit -m "feat: add scores overview page with score types, value prop, and how-it-works"
```

---

### Task 5: Create Methodology Page — Marketing Stats Section

**Files:**
- Create: `packages/frontend/app/scores/methodology/page.tsx`

**Step 1: Create the methodology page with marketing sections**

Use the `frontend-design` skill to create this page with these exact requirements:

- **Route:** `/scores/methodology`
- **Server component** (no `'use client'`)
- **Design doc reference:** `docs/plans/2026-02-15-scores-section-design.md`, "Page 2: Methodology & Proof" section

**Imports to use:**
```typescript
import { DollarSign, Briefcase, Target, Database, TrendingUp, Shield, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
```

**Metadata override:**
```typescript
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Methodology — How PropertyIQ Scores Predict Market Performance',
  description: 'Walk-forward validated across 5 years of market data. See the statistical proof behind PropertyIQ Scores.',
};
```

**Page structure (top marketing sections only — the validation report rendering comes in Task 6):**

1. **Header** — `PageHeaderWithBreadcrumbs` with:
   - `breadcrumbs={[{ label: 'Scores', href: '/scores' }, { label: 'Methodology' }]}`
   - `title="The Proof Behind PropertyIQ Scores"`
   - `description="Walk-forward validated across 5 years of market data"`
   - `icon={<Target className="w-5 h-5" />}`

2. **Marketing Stats** — `grid grid-cols-2 lg:grid-cols-4 gap-4` with 4 stat cards:
   - Dollar Impact: `$27,100` / "More equity on a typical home over 3 years" / DollarSign icon
   - Portfolio Impact: `$81,300` / "Extra appreciation on a 3-property portfolio (3yr)" / Briefcase icon
   - Hit Rate: `100%` / "Predictive accuracy across all test periods" / Target icon
   - Data Points: `1.1M+` / "Location-period observations validated" / Database icon
   - Each card: `bg-surface-container rounded-2xl p-5 border border-outline-variant`, icon in `bg-primary-container p-2 rounded-xl`, stat as `text-2xl font-bold text-on-surface`, label as `text-sm text-on-surface-variant`

3. **Quintile Comparison** — visual bar chart showing 5 quintiles:
   - Q1 (Bottom 20%): -1.92% avg excess return, narrow red-toned bar
   - Q2: -0.53%, slightly wider bar
   - Q3: +0.14%, neutral bar
   - Q4: +0.69%, wider green bar
   - Q5 (Top 20%): +1.15%, full-width green bar
   - Callout: "Top-20% scored markets returned 142% more equity than bottom-20%"
   - Use horizontal `div` bars with `bg-error/20` for negative and `bg-primary/20` for positive, widths proportional to values
   - Labels for each quintile showing score range and return

4. **Key Findings** — `grid md:grid-cols-2 gap-4` with 3-4 callout cards:
   - "Zero Sign Flips" / Shield icon / "Model features maintained consistent direction across every walk-forward window — zero instability."
   - "Consistent Across Geographies" / TrendingUp icon / "Predictive at metro, county, and ZIP code levels. Works everywhere, not just cherry-picked markets."
   - "v2.0: Major Improvements" / CheckCircle icon / "Up to 1,600% improvement in county-level prediction vs v1.0. Fixed critical InvestorEdge inversion."
   - Each card: `bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant`, icon in small colored circle, bold h3, paragraph description

5. **Placeholder for validation report** — add a `{/* Validation report section rendered in Task 6 */}` comment and a section div with id="technical-report" for the next task to fill in.

**Step 2: Verify it renders**

Run:
```bash
cd packages/frontend && npx next build --no-lint 2>&1 | tail -10
```
Expected: Build succeeds, `/scores/methodology` listed

**Step 3: Commit**

```bash
git add packages/frontend/app/scores/methodology/
git commit -m "feat: add methodology page with marketing stats, quintile comparison, and key findings"
```

---

### Task 6: Add Validation Report Rendering to Methodology Page

**Files:**
- Modify: `packages/frontend/app/scores/methodology/page.tsx`
- Reference: `docs/audits/2026-02-13-v2-validation-report.md`

**Step 1: Create the markdown content component**

Add a `ValidationReport` component to the methodology page (or a co-located file `packages/frontend/app/scores/methodology/ValidationReport.tsx`) that:

1. Imports the validation report markdown as a raw string at build time using `fs.readFileSync`:

```typescript
import fs from 'fs';
import path from 'path';
```

2. In the page's server component body, reads the file:

```typescript
const reportPath = path.join(process.cwd(), '..', '..', 'docs', 'audits', '2026-02-13-v2-validation-report.md');
const reportContent = fs.readFileSync(reportPath, 'utf-8');
```

Note: `process.cwd()` in Next.js is `packages/frontend`, so `../../` gets to project root. Verify the correct relative path by checking the build output.

3. Passes the content to a client component that renders it with `react-markdown`:

Create `packages/frontend/app/scores/methodology/MarkdownRenderer.tsx`:

```typescript
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl font-[var(--font-source-serif)] font-semibold text-on-surface mt-12 mb-4">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-[var(--font-source-serif)] font-semibold text-on-surface mt-10 mb-3">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold text-on-surface mt-8 mb-2">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-on-surface-variant leading-relaxed mb-4">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-on-surface-variant space-y-1 mb-4 ml-4">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-on-surface-variant space-y-1 mb-4 ml-4">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-on-surface-variant leading-relaxed">{children}</li>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-6 rounded-xl border border-outline-variant">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-surface-container text-on-surface font-medium">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-outline-variant">{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-surface-container/50">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-4 py-3 text-left text-xs uppercase tracking-wider">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-3 text-on-surface-variant">{children}</td>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-on-surface">{children}</strong>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary/30 pl-4 italic text-on-surface-variant my-4">{children}</blockquote>
        ),
        code: ({ children }) => (
          <code className="bg-surface-container px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
        ),
        hr: () => (
          <hr className="border-outline-variant my-8" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**Step 2: Integrate into the methodology page**

Replace the placeholder comment from Task 5 with:

```typescript
{/* Technical Validation Report */}
<section id="technical-report" className="mt-16">
  <div className="border-t border-outline-variant pt-12">
    <div className="flex items-center gap-2 mb-2">
      <div className="p-1.5 rounded-lg bg-primary/10">
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <h2 className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Technical Validation Report
      </h2>
    </div>
    <p className="text-lg font-[var(--font-source-serif)] text-on-surface mb-2">
      Walk-forward elastic net cross-validation with bootstrap significance testing
    </p>
    <p className="text-sm text-on-surface-variant mb-8">
      Full methodology and results from our v2.0 scoring model validation, covering December 2020 through December 2025.
    </p>
    <MarkdownRenderer content={reportContent} />
  </div>
</section>
```

Add import at top:
```typescript
import { MarkdownRenderer } from './MarkdownRenderer';
import fs from 'fs';
import path from 'path';
```

Add before return statement in the page component:
```typescript
const reportPath = path.join(process.cwd(), '..', '..', 'docs', 'audits', '2026-02-13-v2-validation-report.md');
const reportContent = fs.readFileSync(reportPath, 'utf-8');
```

**Step 3: Verify build**

Run:
```bash
cd packages/frontend && npx next build --no-lint 2>&1 | tail -20
```
Expected: Build succeeds. The page should be statically rendered at build time.

**Step 4: Visually verify**

Run dev server and check `/scores/methodology` — scroll to the bottom and verify tables render correctly with proper styling.

```bash
cd packages/frontend && npx next dev
```
Open `http://localhost:3000/scores/methodology` and verify:
- All 20+ tables render with borders and hover states
- Headings use serif font
- Code blocks render in monospace
- No broken markdown

**Step 5: Commit**

```bash
git add packages/frontend/app/scores/methodology/
git commit -m "feat: render full validation report on methodology page with styled markdown"
```

---

### Task 7: Update ScorePaywall to Link to Methodology

**Files:**
- Modify: `packages/frontend/components/entitlements/ScorePaywall.tsx`

**Step 1: Add methodology link**

In `ScorePaywall.tsx`, add a "See the proof" link near the existing CTA. Find the CTA section (the Link to `/pricing#scores`) and add a secondary link below it:

```typescript
<Link
  href="/scores/methodology"
  className="text-sm text-primary hover:underline flex items-center gap-1"
>
  See the proof behind our scores
  <ArrowRight className="w-3 h-3" />
</Link>
```

Import `ArrowRight` from `lucide-react` if not already imported.

Do this for both the full and compact render paths.

**Step 2: Verify**

Navigate to a market page where ScorePaywall renders and confirm the link appears and navigates correctly.

**Step 3: Commit**

```bash
git add packages/frontend/components/entitlements/ScorePaywall.tsx
git commit -m "feat: add methodology proof link to ScorePaywall component"
```

---

### Task 8: Visual Review and Polish

**Files:**
- Potentially modify: any files from Tasks 3-7

**Step 1: Review both pages in browser**

Run:
```bash
cd packages/frontend && npx next dev
```

Check these pages:
- `http://localhost:3000/scores` — overview page
- `http://localhost:3000/scores/methodology` — methodology page

**Step 2: Verify navigation**

- Click "Scores" in top nav → goes to `/scores`
- Click "See the proof →" on overview page → goes to `/scores/methodology`
- Click breadcrumb "Scores" on methodology page → goes to `/scores`
- Navigate to a market page, check ScorePaywall link → goes to `/scores/methodology`

**Step 3: Verify responsive design**

- Check both pages at mobile (375px), tablet (768px), and desktop (1280px) widths
- Verify the 3-column score cards stack on mobile
- Verify the 4-column stat cards become 2-column on tablet, 1 on mobile
- Verify markdown tables scroll horizontally on small screens

**Step 4: Fix any visual issues**

Adjust spacing, colors, responsive breakpoints as needed to match the design system.

**Step 5: Commit any fixes**

```bash
git add -A packages/frontend/app/scores/
git commit -m "fix: polish scores pages responsive layout and visual consistency"
```

---

### Task 9: Final Build Verification

**Files:** None (verification only)

**Step 1: Run full build**

```bash
cd packages/frontend && npx next build --no-lint
```
Expected: Build succeeds with no errors. Both `/scores` and `/scores/methodology` appear in output.

**Step 2: Run type check**

```bash
cd packages/frontend && npx tsc --noEmit
```
Expected: No type errors.

**Step 3: Commit if any final fixes needed**

---

## Summary of Files Changed

| Action | File |
|--------|------|
| Modify | `packages/frontend/package.json` (add react-markdown, remark-gfm) |
| Modify | `packages/frontend/src/components/layout/Header.tsx` (add Scores nav) |
| Create | `packages/frontend/app/scores/layout.tsx` |
| Create | `packages/frontend/app/scores/page.tsx` |
| Create | `packages/frontend/app/scores/methodology/page.tsx` |
| Create | `packages/frontend/app/scores/methodology/MarkdownRenderer.tsx` |
| Modify | `packages/frontend/components/entitlements/ScorePaywall.tsx` (add link) |

## Commits (in order)

1. `chore: add react-markdown and remark-gfm for scores methodology page`
2. `feat: add Scores to top navigation`
3. `feat: add scores section layout`
4. `feat: add scores overview page with score types, value prop, and how-it-works`
5. `feat: add methodology page with marketing stats, quintile comparison, and key findings`
6. `feat: render full validation report on methodology page with styled markdown`
7. `feat: add methodology proof link to ScorePaywall component`
8. `fix: polish scores pages responsive layout and visual consistency` (if needed)
