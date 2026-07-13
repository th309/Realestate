# Page-Level FAQ + FAQPage Schema Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every public/crawlable PropertyIQ page a visible, page-specific FAQ section (≥5 Q&A) backed by matching `FAQPage` JSON-LD, so Google/AI answer engines have accurate, quotable content to surface.

**Architecture:** One shared presentational component (`FaqSection`) renders both the visible Q&A cards and their `FAQPage` JSON-LD from a single `Faq[]` array (no drift possible). Data-driven pages (markets, scores, forecast) keep generator-function content builders; static pages get a plain content-array file. Three existing FAQ implementations get refactored onto the shared component; six more pages get content extended to hit the 5-question bar; eight pages get entirely new FAQ content; two client-page pages get their FAQ placed in `layout.tsx` instead.

**Tech Stack:** Next.js 16 App Router (Server Components), TypeScript, Vitest 4 + `@testing-library/react` for tests, existing `safeJsonLdString()` helper for JSON-LD escaping.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-page-level-faq-seo-schema-design.md` — every task here implements a piece of that spec.
- Every FAQ answer must be grounded in real, verifiable facts from the named source files in each task. Never invent a number, feature, or claim. If a fact can't be verified, flag it in the commit message rather than guess.
- No near-duplicate questions across pages — see the cross-page dedupe list maintained in Task 20.
- Answers: 2-4 sentences, brand voice per CLAUDE.md §8.6 (confident, conversational, data-first), no markdown syntax or em-dashes in answer text.
- `FaqSection` always renders its own standalone `<script type="application/ld+json">` tag. On pages that already carry other JSON-LD (`/compare` index, `/pricing`), this means **two separate JSON-LD script tags** on the page rather than one merged `@graph` — this is valid per schema.org/Google (multiple JSON-LD blocks per page are explicitly supported) and keeps `FaqSection` simple and drift-proof. Do not attempt to splice FAQ entities into another page's existing `@graph` array.
- Per CLAUDE.md UI unification decision: `/scores` and `/docs/mcp` FAQ sections switch from click-to-expand accordions to the flat always-expanded card style used on markets pages. This is intentional, not a bug.
- `npm run build` (from `packages/frontend`) must pass with zero errors before any task is considered done — fix all errors, not just ones you introduced.
- Dev server must be running (see the `local-dev-servers` skill) before running `verify-faq-jsonld.mjs` checks in any task below.
- Verified live pricing (queried directly from `subscription_tiers` on 2026-07-13): **Free** $0/mo; **Pro** $39/mo, $399/yr; **Enterprise** $149/mo, $999/yr. Use these exact values for any pricing-related FAQ content — do not reuse the stale "Team $99/mo" figure found in `pricing/layout.tsx` today (Task 18 fixes that).

## Content Task Template

Tasks 10-19 (new FAQ content) all follow this shape:

1. **Research step** — read the exact files named in the task to confirm facts.
2. **Write content file** — a `Faq[]` array (or generator function for data-driven pages), with the example entries given verbatim plus additional entries you write following the content standards above, sourced only from the research step.
3. **Wire into page** — add the import and render `<FaqSection faqs={...} />` at the exact JSX location shown.
4. **Verify** — start the dev server, run the `verify-faq-jsonld.mjs` check (built in Task 2), confirm PASS with the expected count.
5. **Commit.**

---

## Phase 0 — Shared Infrastructure

### Task 1: `buildFaqJsonLd` helper

**Files:**

- Create: `packages/frontend/lib/seo/faq-json-ld.ts`
- Test: `packages/frontend/lib/seo/faq-json-ld.test.ts`

**Interfaces:**

- Produces: `interface Faq { question: string; answer: string }`, `function buildFaqJsonLd(faqs: Faq[]): FaqPageJsonLd` — used by Task 2 and every content task after it.

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/lib/seo/faq-json-ld.test.ts
import { describe, it, expect } from "vitest";
import { buildFaqJsonLd } from "./faq-json-ld";

describe("buildFaqJsonLd", () => {
  it("wraps questions and answers in FAQPage schema shape", () => {
    const result = buildFaqJsonLd([
      {
        question: "What is PropertyIQ?",
        answer: "A real estate analytics platform.",
      },
    ]);
    expect(result["@type"]).toBe("FAQPage");
    expect(result["@context"]).toBe("https://schema.org");
    expect(result.mainEntity).toHaveLength(1);
    expect(result.mainEntity[0]).toEqual({
      "@type": "Question",
      name: "What is PropertyIQ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A real estate analytics platform.",
      },
    });
  });

  it("returns an empty mainEntity array for no faqs", () => {
    expect(buildFaqJsonLd([])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/frontend`): `npx vitest run lib/seo/faq-json-ld.test.ts`
Expected: FAIL with "Cannot find module './faq-json-ld'"

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/frontend/lib/seo/faq-json-ld.ts
export interface Faq {
  question: string;
  answer: string;
}

export interface FaqPageJsonLd {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: { "@type": "Answer"; text: string };
  }>;
}

export function buildFaqJsonLd(faqs: Faq[]): FaqPageJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/seo/faq-json-ld.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/seo/faq-json-ld.ts packages/frontend/lib/seo/faq-json-ld.test.ts
git commit -m "feat(seo): add buildFaqJsonLd FAQPage schema helper"
```

---

### Task 2: Shared `FaqSection` component + verification script

**Files:**

- Create: `packages/frontend/app/components/seo/FaqSection.tsx`
- Test: `packages/frontend/app/components/seo/__tests__/FaqSection.test.tsx`
- Create: `packages/frontend/scripts/verify-faq-jsonld.mjs`

**Interfaces:**

- Consumes: `Faq`, `buildFaqJsonLd` from Task 1; `safeJsonLdString` from `packages/frontend/lib/seo/safe-json-ld.ts` (existing).
- Produces: `<FaqSection faqs={Faq[]} heading?={string} />` — a Server Component every subsequent task renders directly in page/layout JSX. Returns `null` below 3 items.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/components/seo/__tests__/FaqSection.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FaqSection } from "../FaqSection";

const THREE_FAQS = [
  { question: "Q1?", answer: "A1." },
  { question: "Q2?", answer: "A2." },
  { question: "Q3?", answer: "A3." },
];

describe("FaqSection", () => {
  it("renders nothing when fewer than 3 faqs are given", () => {
    const { container } = render(<FaqSection faqs={THREE_FAQS.slice(0, 2)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each question and answer plus a valid FAQPage JSON-LD script", () => {
    render(<FaqSection faqs={THREE_FAQS} />);
    expect(screen.getByText("Q1?")).toBeInTheDocument();
    expect(screen.getByText("A3.")).toBeInTheDocument();

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const parsed = JSON.parse(script!.innerHTML);
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed.mainEntity).toHaveLength(3);
  });

  it("uses a custom heading when provided", () => {
    render(<FaqSection faqs={THREE_FAQS} heading="Questions, answered" />);
    expect(
      screen.getByRole("heading", { name: "Questions, answered" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/components/seo/__tests__/FaqSection.test.tsx`
Expected: FAIL with "Cannot find module '../FaqSection'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/components/seo/FaqSection.tsx
import { buildFaqJsonLd, type Faq } from "@/lib/seo/faq-json-ld";
import { safeJsonLdString } from "@/lib/seo/safe-json-ld";

export function FaqSection({
  faqs,
  heading = "Frequently Asked Questions",
}: {
  faqs: Faq[];
  heading?: string;
}) {
  if (faqs.length < 3) return null;

  return (
    <section className="max-w-4xl mx-auto px-4 pb-12">
      <h2 className="text-xl font-medium text-on-surface mb-6">{heading}</h2>
      <div className="space-y-4">
        {faqs.map((faq) => (
          <div
            key={faq.question}
            className="rounded-xl border border-outline-variant p-5"
          >
            <h3 className="text-base font-medium text-on-surface">
              {faq.question}
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdString(buildFaqJsonLd(faqs)),
        }}
      />
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/components/seo/__tests__/FaqSection.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Create the verification script**

```js
#!/usr/bin/env node
// packages/frontend/scripts/verify-faq-jsonld.mjs
//
// Fetches a locally running page and asserts it has a FAQPage JSON-LD block
// with at least the expected number of questions, each with a name and
// answer text. Usage:
//   node scripts/verify-faq-jsonld.mjs /about 5
//   node scripts/verify-faq-jsonld.mjs /about 5 http://localhost:3000

const [, , path, minCountArg, baseUrl = "http://localhost:3000"] = process.argv;

if (!path || !minCountArg) {
  console.error(
    "Usage: node scripts/verify-faq-jsonld.mjs <path> <minCount> [baseUrl]",
  );
  process.exit(1);
}

const minCount = Number(minCountArg);
const url = `${baseUrl}${path}`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`FAIL: ${url} responded ${res.status}`);
  process.exit(1);
}
const html = await res.text();

const scriptMatches = [
  ...html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  ),
];

if (scriptMatches.length === 0) {
  console.error(`FAIL: no JSON-LD <script> tags found on ${url}`);
  process.exit(1);
}

let faqPage = null;
for (const [, raw] of scriptMatches) {
  const parsed = JSON.parse(raw);
  const candidates = Array.isArray(parsed["@graph"])
    ? parsed["@graph"]
    : [parsed];
  const found = candidates.find((entry) => entry["@type"] === "FAQPage");
  if (found) {
    faqPage = found;
    break;
  }
}

if (!faqPage) {
  console.error(`FAIL: no FAQPage entity found in JSON-LD on ${url}`);
  process.exit(1);
}

const count = faqPage.mainEntity?.length ?? 0;
if (count < minCount) {
  console.error(
    `FAIL: ${url} has ${count} FAQ questions, expected >= ${minCount}`,
  );
  process.exit(1);
}

for (const q of faqPage.mainEntity) {
  if (!q.name || !q.acceptedAnswer?.text) {
    console.error(
      `FAIL: malformed question entry on ${url}: ${JSON.stringify(q)}`,
    );
    process.exit(1);
  }
}

console.log(`PASS: ${url} has ${count} valid FAQPage questions`);
```

- [ ] **Step 6: Smoke-test the script against a page that already has FAQ JSON-LD**

Run (with dev server running): `node scripts/verify-faq-jsonld.mjs /scores 3`
Expected: `PASS: http://localhost:3000/scores has 8 valid FAQPage questions` (still the old raw-`JSON.stringify` version at this point — confirms the script's parsing logic works before any refactor tasks change that page)

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/components/seo/FaqSection.tsx packages/frontend/app/components/seo/__tests__/FaqSection.test.tsx packages/frontend/scripts/verify-faq-jsonld.mjs
git commit -m "feat(seo): add shared FaqSection component and FAQ verification script"
```

---

## Phase 1 — Bucket A: Audit + Refactor Existing FAQ Implementations

### Task 3: Refactor `MarketFaqSection` onto shared `FaqSection`

**Files:**

- Modify: `packages/frontend/app/(public)/markets/components/MarketFaqSection.tsx`
- Create: `packages/frontend/app/(public)/markets/components/__tests__/MarketFaqSection.test.tsx`

**Interfaces:**

- Consumes: `FaqSection` (Task 2), existing `MarketFaq` type from `./build-market-faqs.ts` (already `{question, answer}` shape — compatible with `Faq` as-is).
- Produces: same public API (`<MarketFaqSection faqs={MarketFaq[]} />`) — no caller changes needed in `markets/[slug]`, `markets/zip/[slug]`, `markets/county/[slug]`, `forecast/[slug]`, or `forecast/page.tsx`.

Content audit result: `build-market-faqs.ts` already produces up to 5 questions (buy/score/price-trend/sale-speed/data-currency), each grounded in real per-market stats, meeting the ≥5 bar. **No content changes needed** — this task is refactor-only.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(public)/markets/components/__tests__/MarketFaqSection.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketFaqSection } from "../MarketFaqSection";

const FIVE_FAQS = Array.from({ length: 5 }, (_, i) => ({
  question: `Question ${i}?`,
  answer: `Answer ${i}.`,
}));

describe("MarketFaqSection", () => {
  it("returns null below 3 faqs (data-gating preserved)", () => {
    const { container } = render(
      <MarketFaqSection faqs={FIVE_FAQS.slice(0, 2)} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders faqs and FAQPage JSON-LD via the shared FaqSection", () => {
    render(<MarketFaqSection faqs={FIVE_FAQS} />);
    expect(screen.getByText("Question 0?")).toBeInTheDocument();
    const script = document.querySelector('script[type="application/ld+json"]');
    const parsed = JSON.parse(script!.innerHTML);
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed.mainEntity).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(public)/markets/components/__tests__/MarketFaqSection.test.tsx"`
Expected: FAIL (current implementation still passes since behavior is the same today — verify it's currently PASSING against the OLD implementation first as a baseline; the point of this step is confirming the test file itself is correct before refactoring)

- [ ] **Step 3: Refactor `MarketFaqSection` to use the shared component**

```tsx
// packages/frontend/app/(public)/markets/components/MarketFaqSection.tsx
import { FaqSection } from "@/app/components/seo/FaqSection";
import type { MarketFaq } from "./build-market-faqs";

/**
 * Server-rendered FAQ block for market pages (metro / county / ZIP), forecast
 * pages, and any other caller passing pre-built MarketFaq[]. Thin wrapper
 * around the shared FaqSection — kept as its own file/name since callers
 * across markets/ and forecast/ already import it by this name.
 */
export function MarketFaqSection({ faqs }: { faqs: MarketFaq[] }) {
  return <FaqSection faqs={faqs} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(public)/markets/components/__tests__/MarketFaqSection.test.tsx"`
Expected: PASS (2 tests)

- [ ] **Step 5: Live-verify no regression on a real market page**

Start the dev server, then:
Run: `node scripts/verify-faq-jsonld.mjs /markets/austin-tx 3`
Expected: `PASS: ... has 5 valid FAQPage questions` (adjust the slug if `austin-tx` isn't a live metro slug — check `METRO_SLUG_DATA` for a real one first)

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(public)/markets/components/MarketFaqSection.tsx" "packages/frontend/app/(public)/markets/components/__tests__/MarketFaqSection.test.tsx"
git commit -m "refactor(markets): MarketFaqSection delegates to shared FaqSection"
```

---

### Task 4: Refactor `ScoresFaqSection` onto shared `FaqSection`

**Files:**

- Modify: `packages/frontend/app/(app)/scores/ScoresFaqSection.tsx`
- Create: `packages/frontend/app/(app)/scores/__tests__/ScoresFaqSection.test.tsx`

**Interfaces:**

- Consumes: `FaqSection` (Task 2).
- Produces: same public API — `<ScoresFaqSection />` (no props; still exports `ScoresFaqJsonLd` as a no-op export removed, see below) and callers in `/scores/page.tsx` need a one-line check (see Step 6).

Content audit result: 8 items already present, all specific and grounded (coverage numbers, dollar figures, methodology) — the coverage figures ("865 metro areas, 3,073 counties, over 26,000 ZIP codes") are explicitly labeled "in the validation window," which is the CLAUDE.md-sanctioned exception for labeled (non-headline) denominators. **No content changes needed.**

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/scores/__tests__/ScoresFaqSection.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoresFaqSection } from "../ScoresFaqSection";

describe("ScoresFaqSection", () => {
  it("renders all 8 questions with a valid FAQPage JSON-LD script", () => {
    render(<ScoresFaqSection />);
    expect(
      screen.getByText("What is a real estate market score?"),
    ).toBeInTheDocument();
    const script = document.querySelector('script[type="application/ld+json"]');
    const parsed = JSON.parse(script!.innerHTML);
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed.mainEntity).toHaveLength(8);
    expect(parsed.mainEntity[0].name).toBe(
      "What is a real estate market score?",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(app)/scores/__tests__/ScoresFaqSection.test.tsx"`
Expected: FAIL — current file exports `ScoresFaqJsonLd` and `ScoresFaqSection` as two separate pieces with `{q, a}` field names, so `screen.getByText(...)` still passes but there's no single combined script tag matching this shape reliably (verify the actual failure reason before proceeding to Step 3, since the old implementation might partially pass — the goal is confirming behavior changes after the refactor).

- [ ] **Step 3: Refactor to use the shared component**

```tsx
// packages/frontend/app/(app)/scores/ScoresFaqSection.tsx
import { FaqSection } from "@/app/components/seo/FaqSection";

const FAQ_ITEMS = [
  {
    q: "What is a real estate market score?",
    a: "A real estate market score is a single number that measures how strong a housing market is relative to others. The PropertyIQ Score ranks markets from 1 to 99 based on four demand signals — how fast home values have grown over the last year, how fast they've grown over the last 3 months, how quickly homes are selling (days on market), and whether sellers are cutting their asking prices. A score of 50 equals the state average; higher scores indicate markets outperforming their peers. It helps investors and homebuyers quickly compare thousands of markets without analyzing dozens of data points manually.",
  },
  {
    q: "How can I predict housing market performance?",
    a: "The most reliable way to predict housing market performance is to track leading demand signals rather than lagging price data. The PropertyIQ Score combines four proven indicators — price growth over the past year, price growth over the last 3 months, how fast homes sell, and whether sellers are cutting prices. Across more than two decades of monthly backtesting, higher-scored markets outperformed lower-scored markets in every year tested. You can check any market's score for free on PropertyIQ.",
  },
  {
    q: "How often is the PropertyIQ Score updated?",
    a: "The score is recalculated monthly as new housing data arrives. The four input signals — price growth over the last year, price growth over the last 3 months, days on market, and the share of listings with price cuts — update monthly. Each refresh incorporates the latest available data.",
  },
  {
    q: "What data sources power the score?",
    a: "The PropertyIQ Score is built on four housing signals: price growth over the last year and the last 3 months (from Zillow's home value index), plus how fast homes sell (days on market) and the share of sellers cutting prices (both from Realtor.com listing data). We tested 40+ features across Zillow, Realtor.com, Census, FRED, and BLS — these four are the most predictive of future home price appreciation in out-of-sample testing.",
  },
  {
    q: "How accurate is the PropertyIQ Score?",
    a: "Across more than two decades of monthly backtesting, higher-scored markets outperformed lower-scored markets in essentially every year, at metro, county, and ZIP level. Comparing equally-priced homes in the same state, a top-band market has historically added roughly $18,400 more equity than a bottom-band market over 3 years at metro level, and around $24,000 at ZIP level — where investors actually pick neighborhoods. These are historical averages across thousands of markets, not guarantees about any single property.",
  },
  {
    q: "Why only 4 signals?",
    a: "We tested 40+ features across multiple data sources. These four housing signals are the most predictive of future returns in rigorous out-of-sample testing. They carry equal weight and no fitted parameters, so there is almost nothing to overfit. More metrics didn't improve performance — they added noise. Simpler models generalize better, and these four capture the price-momentum and demand dynamics that drive home price appreciation.",
  },
  {
    q: "Can I trust scores for smaller markets?",
    a: "Each score comes with a confidence rating (A through F) that reflects how many of the four input signals are available for that market and how fresh the data is. Markets with A or B confidence have all four inputs covered; markets with C or F confidence are missing some inputs (for example, scored on price momentum alone), and their scores should be used directionally rather than as precise predictions. We always recommend supplementing score data with local market knowledge.",
  },
  {
    q: "How many markets does PropertyIQ cover?",
    a: "PropertyIQ scores housing markets at three levels — roughly 865 metro areas, 3,073 counties, and over 26,000 ZIP codes in the validation window — covering the vast majority of the U.S. housing market. The validation dataset spans more than two decades of monthly history.",
  },
];

/** Expandable FAQ section for the scores page — now flat cards via shared FaqSection. */
export function ScoresFaqSection() {
  return (
    <FaqSection
      faqs={FAQ_ITEMS.map((item) => ({ question: item.q, answer: item.a }))}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(app)/scores/__tests__/ScoresFaqSection.test.tsx"`
Expected: PASS (1 test)

- [ ] **Step 5: Update the caller — remove the now-deleted `ScoresFaqJsonLd` import**

Read `packages/frontend/app/(app)/scores/page.tsx`, find where `ScoresFaqJsonLd` is imported/rendered alongside `ScoresFaqSection` (it likely renders both `<ScoresFaqJsonLd />` and `<ScoresFaqSection />` separately today), and remove the now-redundant `ScoresFaqJsonLd` import and JSX usage — `ScoresFaqSection` now emits its own JSON-LD internally via the shared `FaqSection`.

- [ ] **Step 6: Live-verify**

Run: `node scripts/verify-faq-jsonld.mjs /scores 8`
Expected: `PASS: http://localhost:3000/scores has 8 valid FAQPage questions`

- [ ] **Step 7: Commit**

```bash
git add "packages/frontend/app/(app)/scores/ScoresFaqSection.tsx" "packages/frontend/app/(app)/scores/__tests__/ScoresFaqSection.test.tsx" "packages/frontend/app/(app)/scores/page.tsx"
git commit -m "refactor(scores): ScoresFaqSection delegates to shared FaqSection"
```

---

### Task 5: Refactor `compare/[slug]` inline FAQ + audit comparison FAQ counts

**Files:**

- Modify: `packages/frontend/app/(public)/compare/[slug]/page.tsx`
- Modify (if any entries are short): whichever file(s) under `packages/frontend/lib/data/comparisons/` define `COMPARISONS` entries' `faqs` arrays

**Interfaces:**

- Consumes: `FaqSection` (Task 2).
- Produces: same rendering call site (`<FAQSection faqs={comparison.faqs} />` becomes `<FaqSection faqs={comparison.faqs} />`); `ComparisonData["faqs"]` type must remain `{question, answer}[]` (already does, per the local `FAQSection` component read earlier).

- [ ] **Step 1: Audit comparison FAQ counts**

Run: `grep -rn "faqs:" packages/frontend/lib/data/comparisons/` (adjust path if `COMPARISONS` is defined across multiple files) and count entries per comparison. For any comparison with fewer than 5 `faqs` entries, read that comparison's own `summary`/feature-comparison/pricing data (already in the same object) and add enough grounded, comparison-specific questions to reach 5 — e.g. for a "PropertyIQ vs X" entry, questions like "How does PropertyIQ's pricing compare to X?" or "Does PropertyIQ offer X's [specific feature]?" answered from that entry's own `summary.winner`/feature rows, never invented.

- [ ] **Step 2: Remove the local `FAQSection` function, use the shared component**

In `packages/frontend/app/(public)/compare/[slug]/page.tsx`, delete the local `FAQSection` function entirely (the one building `faqJsonLd` manually with raw `JSON.stringify`) and replace its one call site:

```tsx
// Remove the local `function FAQSection(...) {...}` block entirely.
// Add to the top-level imports:
import { FaqSection } from "@/app/components/seo/FaqSection";

// Change the call site from:
//   <FAQSection faqs={comparison.faqs} />
// to:
<FaqSection faqs={comparison.faqs} />;
```

- [ ] **Step 3: Live-verify**

Run: `node scripts/verify-faq-jsonld.mjs /compare/<a-real-comparison-slug> 5` (pick a real slug from `COMPARISONS` — e.g. check `lib/data/comparisons/index.ts` for one)
Expected: PASS with count ≥5

- [ ] **Step 4: Commit**

```bash
git add "packages/frontend/app/(public)/compare/[slug]/page.tsx" packages/frontend/lib/data/comparisons/
git commit -m "refactor(compare): use shared FaqSection, ensure every comparison has 5+ FAQs"
```

---

### Task 6: Refactor `McpFaqSection` onto shared `FaqSection` (adds JSON-LD)

**Files:**

- Modify: `packages/frontend/app/(app)/docs/mcp/components/landing/McpFaqSection.tsx`

**Interfaces:**

- Consumes: `FaqSection` (Task 2), existing `MCP_FAQ` from `../mcp-docs-data.ts` (already `{question, answer}` shape).
- Produces: same public API — `<McpFaqSection />` (no props), now a Server Component (drops `"use client"`).

Content audit result: `MCP_FAQ` already has 7 items, all specific to MCP setup/usage. **No content changes needed.** This refactor both unifies the visual style and adds the JSON-LD this page currently lacks entirely.

- [ ] **Step 1: Replace the client accordion with the shared component**

```tsx
// packages/frontend/app/(app)/docs/mcp/components/landing/McpFaqSection.tsx
import { FaqSection } from "@/app/components/seo/FaqSection";
import { MCP_FAQ } from "../mcp-docs-data";

export function McpFaqSection() {
  return <FaqSection faqs={MCP_FAQ} heading="Questions, answered" />;
}
```

(This deletes the `"use client"` directive, the `useState`/`ChevronDown`/`ChevronRight` imports, and the local `FaqRow` component — no longer needed.)

- [ ] **Step 2: Confirm the page still builds and renders**

Run (from `packages/frontend`): `npm run build`
Expected: builds clean (confirms removing `"use client"` doesn't break anything relying on it elsewhere — `McpFaqSection` has no other consumers per the earlier search of `docs/mcp/page.tsx`)

- [ ] **Step 3: Live-verify**

Run: `node scripts/verify-faq-jsonld.mjs /docs/mcp 7`
Expected: `PASS: http://localhost:3000/docs/mcp has 7 valid FAQPage questions`

- [ ] **Step 4: Commit**

```bash
git add "packages/frontend/app/(app)/docs/mcp/components/landing/McpFaqSection.tsx"
git commit -m "refactor(mcp-docs): McpFaqSection delegates to shared FaqSection, gains FAQPage JSON-LD"
```

---

### Task 7: Extend `build-forecast-faqs.ts` from ≤4 to 5+ questions

**Files:**

- Modify: `packages/frontend/app/(public)/forecast/components/build-forecast-faqs.ts`
- Modify: `packages/frontend/app/(public)/forecast/components/build-forecast-faqs.test.ts` (existing file — add new test cases, do not remove existing ones)

**Interfaces:**

- Consumes: same inputs as today (`MarketStatsData`, `formatMetricValue`, `getScoreLabel`, `forecastDisplayYear`).
- Produces: same `buildForecastFaqs({ displayName, stats }): MarketFaq[]` signature — callers in `forecast/[slug]/page.tsx` need no changes.

- [ ] **Step 1: Write the failing test for a 5th question**

Add to the existing `describe` block in `build-forecast-faqs.test.ts`:

```ts
it("adds a 5th question about data currency/sources when stats are present", () => {
  expect(faqs.length).toBeGreaterThanOrEqual(4);
  const currencyFaq = faqs.find((f) => f.question.includes("current"));
  expect(currencyFaq).toBeDefined();
  expect(currencyFaq!.answer).toContain("Zillow");
  expect(currencyFaq!.answer).toContain("Realtor.com");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(public)/forecast/components/build-forecast-faqs.test.ts"`
Expected: FAIL — no question containing "current" exists yet

- [ ] **Step 3: Add the 5th question to `buildForecastFaqs`**

Append this block right before the `return faqs;` line in `build-forecast-faqs.ts`:

```ts
faqs.push({
  question: `How current is this ${displayName} forecast data?`,
  answer: `This forecast is refreshed on a monthly cycle${asOf ? `, with the latest figures current through ${asOf}` : ""}. PropertyIQ recomputes the PropertyIQ Score every month using fresh price momentum data from Zillow and fresh days-on-market and price-cut data from Realtor.com, so the score always reflects the most recently completed reporting period rather than a static snapshot.`,
});
```

Add the `asOf` variable near the top of the function body (mirroring `build-market-faqs.ts`'s `monthYear` helper):

```ts
import { monthYear } from "@/app/markets/components/build-market-faqs";
// or, if monthYear isn't exported from build-market-faqs.ts, inline an
// equivalent local helper here — check the export list of build-market-faqs.ts
// first (Task 3 didn't change its exports, so it should still be internal-only;
// if so, copy the 6-line monthYear() function into this file rather than
// reaching across modules for a private helper).
```

Then compute `const asOf = monthYear(stats.latestDate);` alongside the existing `const year = forecastDisplayYear(stats.latestDate);` line.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(public)/forecast/components/build-forecast-faqs.test.ts"`
Expected: PASS (all tests, including the new one)

- [ ] **Step 5: Live-verify**

Run: `node scripts/verify-faq-jsonld.mjs /forecast/<a-real-metro-slug> 5`
Expected: PASS with count ≥5 (use a metro slug with a non-null score — check `SLUG_TO_METRO` for one)

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(public)/forecast/components/build-forecast-faqs.ts" "packages/frontend/app/(public)/forecast/components/build-forecast-faqs.test.ts"
git commit -m "feat(forecast): add 5th FAQ question (data currency) to buildForecastFaqs"
```

---

### Task 8: Extend `/forecast` index FAQ from 2-3 to 5+ questions

**Files:**

- Modify: `packages/frontend/app/(public)/forecast/page.tsx`

**Interfaces:**

- Consumes: `COVERAGE_COPY` from `@/lib/data/validation-claims` (new import needed).
- Produces: no signature change — the `faqs: MarketFaq[]` array grows in place.

- [ ] **Step 1: Add three unconditional questions to the `faqs` array**

In `forecast/page.tsx`, after the existing two-item array literal and before the `if (bottomLinks.length > 0)` block, add:

```tsx
faqs.push({
  question: "How many housing markets does this forecast cover?",
  answer: `PropertyIQ scores ${COVERAGE_COPY.sentence}, and every scored market gets its own forecast page with a live PropertyIQ Score and confidence grade. Coverage grows as new markets accumulate enough data history to score reliably.`,
});

faqs.push({
  question: "What does a PropertyIQ Score of 50 mean?",
  answer:
    "A score of 50 marks a market's own state average, not a national midpoint. Scores are computed nationally across every market at a given geography level, then calibrated so 50 equals that market's state benchmark — a score above 50 predicts the market will outperform its state over the next three years, and a score below 50 predicts underperformance.",
});

faqs.push({
  question: "Does a low PropertyIQ Score mean a market is a bad place to buy?",
  answer:
    "No. The score measures demand momentum and timing, not market quality. A low score means cooling momentum, such as homes taking longer to sell or more sellers cutting prices, which often translates into more room for buyers to negotiate rather than a verdict that the market itself is undesirable.",
});
```

Add the import at the top of the file:

```tsx
import { COVERAGE_COPY } from "@/lib/data/validation-claims";
```

- [ ] **Step 2: Verify these don't duplicate the existing 2 questions or the "cooling fastest" conditional one**

Read the existing 2-3 questions already in the file (crash question, methodology question, conditional cooling-fastest question) and confirm the 3 new ones above are asking something genuinely different — they are (coverage count, score-baseline explainer, low-score-doesn't-mean-bad), but double check there's no overlap with `/scores`' "What is a real estate market score?" question — the forecast-index version above is framed around the 50-baseline specifically, which `/scores` doesn't cover in that framing, so it's distinct.

- [ ] **Step 3: Live-verify**

Run: `node scripts/verify-faq-jsonld.mjs /forecast 5`
Expected: `PASS: http://localhost:3000/forecast has 5 valid FAQPage questions` (or 6 if `bottomLinks` is non-empty)

- [ ] **Step 4: Commit**

```bash
git add "packages/frontend/app/(public)/forecast/page.tsx"
git commit -m "feat(forecast): expand forecast index FAQ from 2-3 to 5+ questions"
```

---

### Task 9: Add `FAQPage` JSON-LD to `/help` (no UI change)

**Files:**

- Modify: `packages/frontend/app/(app)/help/page.tsx`

**Interfaces:**

- Consumes: `buildFaqJsonLd` (Task 1), `safeJsonLdString` (existing).
- Produces: no change to the existing `FAQ_ITEMS` array or `<details>` markup — only adds a JSON-LD `<script>` tag sourced from that same array.

Content audit result: the existing 7 `FAQ_ITEMS` are page-specific (what is PropertyIQ, data sources, update cadence, score explainer, plan differences, upgrade flow, export/print) — not generic boilerplate. **No content changes needed.**

- [ ] **Step 1: Add the JSON-LD script, sourced from the existing `FAQ_ITEMS` array**

Add the import near the top of `help/page.tsx`:

```tsx
import { buildFaqJsonLd } from "@/lib/seo/faq-json-ld";
import { safeJsonLdString } from "@/lib/seo/safe-json-ld";
```

In the component body, right before the `return (` line, add:

```tsx
// FAQ_ITEMS already matches the {question, answer} shape buildFaqJsonLd expects
// (its FaqItem interface is structurally identical to Faq), so no mapping needed.
const faqJsonLd = buildFaqJsonLd(FAQ_ITEMS);
```

Then add the script tag as the first child inside the returned JSX, right after the opening `<div className="min-h-dvh bg-surface">`:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: safeJsonLdString(faqJsonLd) }}
/>
```

- [ ] **Step 2: Live-verify**

Run: `node scripts/verify-faq-jsonld.mjs /help 5`
Expected: `PASS: http://localhost:3000/help has 7 valid FAQPage questions`

- [ ] **Step 3: Commit**

```bash
git add "packages/frontend/app/(app)/help/page.tsx"
git commit -m "feat(help): add FAQPage JSON-LD sourced from existing FAQ_ITEMS"
```

---

## Phase 2 — Bucket B: New FAQ Content

Each task below follows the Content Task Template. Full example entries are given for every page below (not placeholders); each task's remaining entries must be researched from the named files per the template's Step 1 before writing.

### Task 10: Homepage FAQ

**Files:**

- Create: `packages/frontend/app/components/home/homeFaqs.ts`
- Modify: `packages/frontend/app/(app)/page.tsx`

**Research files:** `packages/frontend/lib/data/validation-claims.ts` (COVERAGE_COPY, V4_CLAIMS), `packages/frontend/app/components/scoring/score-labels.ts` (score label thresholds), `packages/frontend/app/components/home/UseCasesSection.tsx` and `AIIntegrationsSection.tsx` (to ground use-case and MCP questions in what's actually claimed there).

- [ ] **Step 1: Research** — read the files above to confirm every number/claim used below and in the additional questions you write.

- [ ] **Step 2: Write the content file**

```ts
// packages/frontend/app/components/home/homeFaqs.ts
import type { Faq } from "@/lib/seo/faq-json-ld";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";

export const HOME_FAQS: Faq[] = [
  {
    question: "What is PropertyIQ and how does it help me pick a market?",
    answer: `PropertyIQ is a real estate market intelligence platform that scores housing markets from 1 to 99 based on demand momentum, then calibrates the scale so 50 equals each market's own state average. Instead of manually comparing dozens of raw statistics, you get one number per market, backed by the four underlying signals, to quickly compare where demand is strengthening or cooling.`,
  },
  {
    question: "How many markets does PropertyIQ cover?",
    answer: `PropertyIQ scores ${COVERAGE_COPY.sentence}, with monthly refreshes as new source data arrives. Coverage is deepest at the metro level and expands over time as more counties and ZIP codes accumulate enough history to score reliably.`,
  },
  // Add 3+ more Faq entries here. Ground each in the research files above.
  // Suggested angles not yet covered elsewhere on this list: what the free
  // tier includes vs paid tiers (verify against Task 18's pricing research
  // rather than guessing), how PropertyIQ connects to ChatGPT/Claude via
  // MCP (ground in AIIntegrationsSection.tsx's actual claims), and what
  // "demand momentum" means for a first-time homebuyer specifically (angle
  // this differently from /scores' methodology-focused version).
];
```

- [ ] **Step 3: Wire into the page**

In `packages/frontend/app/(app)/page.tsx`, add the import:

```tsx
import { FaqSection } from "@/app/components/seo/FaqSection";
import { HOME_FAQS } from "@/app/components/home/homeFaqs";
```

Render it directly before `<Footer />` inside the gradient div:

```tsx
        <PricingSection />
        <CTASection />
        <FaqSection faqs={HOME_FAQS} />
        <Footer />
```

- [ ] **Step 4: Verify**

Run: `node scripts/verify-faq-jsonld.mjs / 5`

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/components/home/homeFaqs.ts "packages/frontend/app/(app)/page.tsx"
git commit -m "feat(homepage): add page-specific FAQ section"
```

---

### Task 11: `/about` FAQ

**Files:**

- Create: `packages/frontend/app/(app)/about/about-faqs.ts`
- Modify: `packages/frontend/app/(app)/about/page.tsx`

**Research files:** `packages/frontend/app/(app)/about/page.tsx` itself (mission/timeline/data-sources/team sections already in the page), `packages/frontend/lib/data/validation-claims.ts`.

- [ ] **Step 1: Research** — re-read `about/page.tsx` in full for the exact mission statement, founder/team bio text, and "what makes us different" claims already written there; do not invent details not already present in the page copy.

- [ ] **Step 2: Write the content file**

```ts
// packages/frontend/app/(app)/about/about-faqs.ts
import type { Faq } from "@/lib/seo/faq-json-ld";

export const ABOUT_FAQS: Faq[] = [
  {
    question: "Where does PropertyIQ get its housing and economic data from?",
    answer:
      "PropertyIQ aggregates data from trusted public and private sources: Realtor.com and Zillow for listing and home-value data, the U.S. Census Bureau for demographics, and the Bureau of Labor Statistics, Bureau of Economic Analysis, and Federal Reserve (FRED) for economic indicators. Each data point in a report is traceable back to its source.",
  },
  {
    question: "Is PropertyIQ affiliated with Zillow, Realtor.com, or Redfin?",
    answer:
      "No. PropertyIQ is an independent analytics platform that licenses and aggregates publicly available data from these providers alongside government sources; it is not owned by or affiliated with any of them.",
  },
  // Add 3+ more Faq entries here, grounded in the actual mission/team/timeline
  // copy already written in about/page.tsx (read it fresh — do not reuse
  // details from this plan document, which only summarized it).
];
```

- [ ] **Step 3: Wire into the page**

Add imports and render `<FaqSection faqs={ABOUT_FAQS} />` right before the page's closing `</div></div></>` (after the CTA block shown in this plan's research, before the fragment closes).

- [ ] **Step 4: Verify**

Run: `node scripts/verify-faq-jsonld.mjs /about 5`

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/about/about-faqs.ts" "packages/frontend/app/(app)/about/page.tsx"
git commit -m "feat(about): add page-specific FAQ section"
```

---

### Task 12: `/docs/api` FAQ

**Files:**

- Create: `packages/frontend/app/(app)/docs/api/docs-api-faqs.ts`
- Modify: `packages/frontend/app/(app)/docs/api/page.tsx`

**Research files:** `packages/frontend/app/(app)/docs/api/components/DocsPageClient.tsx` (full endpoint list, auth model, rate limits, use cases — required reading before writing any answer that claims a specific endpoint, auth method, or limit).

- [ ] **Step 1: Research** — read `DocsPageClient.tsx` in full. Confirm: how API keys are issued/authenticated, what tier gates API access (do not assume it matches MCP's Pro/Enterprise gating without confirming), response format, and 2-3 concrete example endpoints.

- [ ] **Step 2: Write the content file**

```ts
// packages/frontend/app/(app)/docs/api/docs-api-faqs.ts
import type { Faq } from "@/lib/seo/faq-json-ld";

export const DOCS_API_FAQS: Faq[] = [
  {
    question: "Does PropertyIQ have a public REST API?",
    answer:
      "Yes. The PropertyIQ Platform API exposes market data, PropertyIQ Scores, and property-level analysis over HTTP so you can pull the same data that powers the PropertyIQ app directly into your own tools and workflows.",
  },
  // Add 4+ more Faq entries here — authentication method, which plan tier
  // is required, response format, and 1-2 concrete example use cases —
  // all sourced from DocsPageClient.tsx, not guessed.
];
```

- [ ] **Step 3: Wire into the page**

`docs/api/page.tsx` is a thin server wrapper (`return <DocsPageClient />;`). Change it to render the FAQ alongside the client component:

```tsx
import type { Metadata } from "next";
import { DocsPageClient } from "./components/DocsPageClient";
import { FaqSection } from "@/app/components/seo/FaqSection";
import { DOCS_API_FAQS } from "./docs-api-faqs";

export const metadata: Metadata = {
  title: "API Documentation | PropertyIQ",
  description:
    "PropertyIQ Platform API documentation — getting started, use cases, endpoint reference, and troubleshooting.",
};

export default function ApiDocsPage() {
  return (
    <>
      <DocsPageClient />
      <FaqSection faqs={DOCS_API_FAQS} />
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `node scripts/verify-faq-jsonld.mjs /docs/api 5`

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/docs/api/docs-api-faqs.ts" "packages/frontend/app/(app)/docs/api/page.tsx"
git commit -m "feat(docs-api): add page-specific FAQ section"
```

---

### Task 13: `/screener` FAQ

**Files:**

- Create: `packages/frontend/app/(app)/screener/screener-faqs.ts`
- Modify: `packages/frontend/app/(app)/screener/page.tsx`

**Research files:** `packages/frontend/app/(app)/screener/ScreenerPageInner.tsx` (exact filter list and any tier-gating on screener results).

- [ ] **Step 1: Research** — read `ScreenerPageInner.tsx` for the exact set of filterable metrics (confirmed conceptually so far: PropertyIQ Score, cap rate, months of supply, overvaluation — verify the exact current list and any others) and whether screening is free-tier or gated.

- [ ] **Step 2: Write the content file**

```ts
// packages/frontend/app/(app)/screener/screener-faqs.ts
import type { Faq } from "@/lib/seo/faq-json-ld";

export const SCREENER_FAQS: Faq[] = [
  {
    question: "What is the PropertyIQ market screener?",
    answer:
      "The market screener lets you filter every scored PropertyIQ market by criteria like PropertyIQ Score, cap rate, months of housing supply, and overvaluation, so you can narrow thousands of markets down to the ones that fit a specific investing or buying strategy in seconds.",
  },
  {
    question: "What can I filter markets by in the screener?",
    answer:
      "You can screen by PropertyIQ Score range, estimated cap rate, months of supply, and how overvalued or undervalued a market's prices are relative to its fundamentals, then combine filters to find markets matching multiple criteria at once.",
  },
  // Add 3+ more Faq entries here, verified against ScreenerPageInner.tsx —
  // e.g. how screener results differ from the map view, whether results
  // update monthly with the score refresh, and any tier-gating specifics.
];
```

- [ ] **Step 3: Wire into the page**

```tsx
// packages/frontend/app/(app)/screener/page.tsx
import { FaqSection } from "@/app/components/seo/FaqSection";
import { SCREENER_FAQS } from "./screener-faqs";

export default function ScreenerPage() {
  return (
    <>
      <Suspense fallback={<ScreenerSkeleton />}>
        <ScreenerPageInner />
      </Suspense>
      <FaqSection faqs={SCREENER_FAQS} />
    </>
  );
}
```

(Confirm `Suspense`/`ScreenerSkeleton` imports already exist in the file — only add the two new imports and wrap the existing return value in a fragment.)

- [ ] **Step 4: Verify**

Run: `node scripts/verify-faq-jsonld.mjs /screener 5`

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/screener/screener-faqs.ts" "packages/frontend/app/(app)/screener/page.tsx"
git commit -m "feat(screener): add page-specific FAQ section"
```

---

### Task 14: `/analyzer` FAQ

**Files:**

- Create: `packages/frontend/app/(app)/analyzer/analyzer-faqs.ts`
- Modify: `packages/frontend/app/(app)/analyzer/page.tsx`

**Research files:** `packages/frontend/app/(app)/analyzer/AnalyzerClient.tsx` (exact metrics computed — cap rate/cashflow/BRRRR/70% rule formulas as actually implemented).

- [ ] **Step 1: Research** — read `AnalyzerClient.tsx` to confirm exactly which metrics it computes and how the 70% rule and BRRRR calculations are actually implemented, so answers describe real behavior.

- [ ] **Step 2: Write the content file**

```ts
// packages/frontend/app/(app)/analyzer/analyzer-faqs.ts
import type { Faq } from "@/lib/seo/faq-json-ld";

export const ANALYZER_FAQS: Faq[] = [
  {
    question: "What does the PropertyIQ Deal Analyzer calculate?",
    answer:
      "Enter any property address and the Deal Analyzer estimates cap rate, monthly cashflow, and BRRRR (buy, rehab, rent, refinance, repeat) viability, then layers in PropertyIQ's market-level context for that property's ZIP code and metro so you can see the deal alongside local demand momentum.",
  },
  {
    question: "Can I analyze any property address, or only listed properties?",
    answer:
      "You can analyze any U.S. residential address, not just active listings — enter it directly via the address search or as a URL parameter, and the analyzer pulls property and market data to run the numbers.",
  },
  // Add 3+ more Faq entries here, verified against AnalyzerClient.tsx —
  // e.g. what the 70% rule threshold actually is in this tool, what data
  // feeds the cashflow estimate (rent estimate source, expense assumptions),
  // and whether results are saved to an account.
];
```

- [ ] **Step 3: Wire into the page**

```tsx
// packages/frontend/app/(app)/analyzer/page.tsx
import AnalyzerClient from "./AnalyzerClient";
import { FaqSection } from "@/app/components/seo/FaqSection";
import { ANALYZER_FAQS } from "./analyzer-faqs";

export const metadata = {
  title: "Deal Analyzer",
  description:
    "Analyze any property: cap rate, cashflow, BRRRR, 70% rule, plus PropertyIQ market context.",
  alternates: { canonical: "https://www.propertyiq.app/analyzer" },
};

export default function AnalyzerPage({
  searchParams,
}: {
  searchParams: Promise<{
    address?: string;
    zip?: string;
  }>;
}) {
  return (
    <>
      <AnalyzerClient searchParamsPromise={searchParams} />
      <FaqSection faqs={ANALYZER_FAQS} />
    </>
  );
}
```

- [ ] **Step 4: Verify**

Run: `node scripts/verify-faq-jsonld.mjs /analyzer 5`

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/analyzer/analyzer-faqs.ts" "packages/frontend/app/(app)/analyzer/page.tsx"
git commit -m "feat(analyzer): add page-specific FAQ section"
```

---

### Task 15: `/markets` directory FAQ

**Files:**

- Create: `packages/frontend/app/(public)/markets/markets-directory-faqs.ts`
- Modify: `packages/frontend/app/(public)/markets/page.tsx`

**Research files:** `packages/frontend/lib/data/validation-claims.ts` (COVERAGE_COPY), `packages/frontend/lib/data/metro-slug-data.ts` / `state-slug-data.ts` (to confirm geography levels/counts referenced are accurate).

- [ ] **Step 1: Research** — confirm current `COVERAGE_COPY` values and the exact geography hierarchy (state → metro → county → ZIP) as structured in this directory page.

- [ ] **Step 2: Write the content file**

```ts
// packages/frontend/app/(public)/markets/markets-directory-faqs.ts
import type { Faq } from "@/lib/seo/faq-json-ld";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";

export const MARKETS_DIRECTORY_FAQS: Faq[] = [
  {
    question: "How do I find data for a specific housing market on PropertyIQ?",
    answer:
      "Browse by state from this directory, or search directly for a metro, county, or ZIP code. Each market page includes its current PropertyIQ Score, home value trends, days on market, and a full FAQ specific to that market.",
  },
  {
    question: "What geography levels does PropertyIQ track?",
    answer: `PropertyIQ tracks four geography levels: state, metro area, county, and ZIP code, covering ${COVERAGE_COPY.sentence}. Each level rolls up into the next, so you can drill from a state down to an individual ZIP code's market data.`,
  },
  // Add 3+ more Faq entries here — e.g. how often the directory itself
  // updates, whether every U.S. ZIP code is covered or only scored ones,
  // and how to compare two markets side by side (verify this links to
  // /compare if that's actually the case in the page's own copy).
];
```

- [ ] **Step 3: Wire into the page**

```tsx
// In packages/frontend/app/(public)/markets/page.tsx, add imports:
import { FaqSection } from "@/app/components/seo/FaqSection";
import { MARKETS_DIRECTORY_FAQS } from "./markets-directory-faqs";

// Render right before the closing </div> of the page's outer wrapper:
      <MarketSearch metros={METRO_SLUG_DATA} />
      <FaqSection faqs={MARKETS_DIRECTORY_FAQS} />
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `node scripts/verify-faq-jsonld.mjs /markets 5`

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(public)/markets/markets-directory-faqs.ts" "packages/frontend/app/(public)/markets/page.tsx"
git commit -m "feat(markets): add page-specific FAQ section to markets directory"
```

---

### Task 16: `/markets/state/[state]` FAQ (new data-driven builder)

**Files:**

- Create: `packages/frontend/app/(public)/markets/state/[state]/build-state-faqs.ts`
- Modify: `packages/frontend/app/(public)/markets/state/[state]/page.tsx`

**Research files:** `packages/frontend/app/(public)/markets/state/[state]/page.tsx` itself (re-read in full to identify exactly which local variables are already computed and in scope near the insertion point — `stateEntry`, `counties`, the metros list, and whatever `fetchRankings` returns for this state), `packages/frontend/app/(public)/markets/state/[state]/generate-seo-content.ts`.

- [ ] **Step 1: Research** — re-read the full page file to find the exact variable names for: the state's display name, its metro count, its county count, and its top-ranked metro(s) by score (from the `fetchRankings` call already present). Use those exact variable names in Step 2 rather than guessing an interface.

- [ ] **Step 2: Write the generator function**

```ts
// packages/frontend/app/(public)/markets/state/[state]/build-state-faqs.ts
import type { Faq } from "@/lib/seo/faq-json-ld";

export interface BuildStateFaqsInput {
  stateName: string;
  metroCount: number;
  countyCount: number;
  topMetroName: string | null;
}

/**
 * Builds the FAQ set for a state market directory page. Always returns at
 * least 3 unconditional questions (state name/counts don't depend on live
 * stats); the top-metro question is skipped when there's no ranked metro
 * for this state yet.
 */
export function buildStateFaqs({
  stateName,
  metroCount,
  countyCount,
  topMetroName,
}: BuildStateFaqsInput): Faq[] {
  const faqs: Faq[] = [
    {
      question: `How many housing markets does PropertyIQ track in ${stateName}?`,
      answer: `PropertyIQ currently tracks ${metroCount} metro area${metroCount === 1 ? "" : "s"} and ${countyCount} count${countyCount === 1 ? "y" : "ies"} in ${stateName}, each with its own PropertyIQ Score, home value trend, and days-on-market reading, refreshed monthly.`,
    },
    {
      question: `What is a PropertyIQ Score of 50 in ${stateName}?`,
      answer: `A score of 50 marks ${stateName}'s own state average. PropertyIQ computes scores nationally across every market, then calibrates the scale so each state's markets are compared to their own state's typical demand momentum, not the national average.`,
    },
    {
      question: `Where can I find ZIP-code-level housing data for ${stateName}?`,
      answer: `Every county listed on this page links through to its ZIP codes, and every metro links to its own market page with a full breakdown. Drill from state, to county, to ZIP to get progressively more localized market data.`,
    },
  ];

  if (topMetroName) {
    faqs.push({
      question: `Which ${stateName} metro area has the strongest housing demand right now?`,
      answer: `As of the latest monthly refresh, ${topMetroName} has the highest PropertyIQ Score among ${stateName} metros, indicating the strongest demand momentum in the state. Rankings shift month to month as new price, days-on-market, and price-cut data arrives.`,
    });
  }

  // Add 1-2 more Faq entries here if needed to reliably hit 5 when
  // topMetroName is null (e.g. a question about data sources, mirroring
  // build-market-faqs.ts's buildDataCurrencyQuestion pattern, which is
  // always available regardless of ranking data).

  return faqs;
}
```

- [ ] **Step 3: Wire into the page**

Using the exact variable names found in Step 1's research, add imports and a call near where `StateTopMarketsTables`/`StatePageContent` are rendered, then render `<FaqSection faqs={buildStateFaqs({...})} />` right before the closing `</section>` shown in this plan's earlier research (after the "Last updated" paragraph).

- [ ] **Step 4: Verify**

Run: `node scripts/verify-faq-jsonld.mjs /markets/state/<a-real-state-slug> 4` (4 as the floor since the 4th question is conditional — confirm actual count against a state with ranking data for a 5-question check too)

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(public)/markets/state/[state]/build-state-faqs.ts" "packages/frontend/app/(public)/markets/state/[state]/page.tsx"
git commit -m "feat(markets/state): add data-driven FAQ section to state pages"
```

---

### Task 17: `/compare` index FAQ

**Files:**

- Create: `packages/frontend/app/(public)/compare/compare-index-faqs.ts`
- Modify: `packages/frontend/app/(public)/compare/page.tsx`

**Research files:** `packages/frontend/lib/data/comparisons/roundup.ts` (exact `ROUNDUP_CRITERIA` and `ROUNDUP_TOOLS` — ground any claim about ranking criteria or named competitors in this file, never invent a competitor name or ranking reason).

- [ ] **Step 1: Research** — read `roundup.ts` in full for the exact criteria used to rank tools and the exact list of tools compared.

- [ ] **Step 2: Write the content file**

```ts
// packages/frontend/app/(public)/compare/compare-index-faqs.ts
import type { Faq } from "@/lib/seo/faq-json-ld";

export const COMPARE_INDEX_FAQS: Faq[] = [
  {
    question:
      "What real estate market analysis tools does PropertyIQ compare itself to?",
    answer:
      "This page ranks PropertyIQ against other real estate market analysis and investing tools using a consistent set of criteria, with a detailed side-by-side comparison page for each one covering features, pricing, and where each tool wins.",
  },
  // Add 4+ more Faq entries here, grounded in the exact criteria and tool
  // names found in roundup.ts — e.g. what criteria the ranking uses, how
  // often the comparison is updated, and answers about 1-2 specific named
  // competitors from ROUNDUP_TOOLS.
];
```

- [ ] **Step 3: Wire into the page**

```tsx
// packages/frontend/app/(public)/compare/page.tsx — add imports:
import { FaqSection } from "@/app/components/seo/FaqSection";
import { COMPARE_INDEX_FAQS } from "./compare-index-faqs";

// Render after <RankingMatrix .../> and before the page's closing tag —
// find the exact insertion point by reading the JSX after the @graph
// script tag shown in this plan's earlier research.
```

- [ ] **Step 4: Verify**

Run: `node scripts/verify-faq-jsonld.mjs /compare 5`

Note: this page will now have two separate `<script type="application/ld+json">` tags (the existing `@graph` with ItemList/Article/Breadcrumb, plus `FaqSection`'s own `FAQPage` script) — the verify script's `@graph`-aware parsing handles finding the right one either way.

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(public)/compare/compare-index-faqs.ts" "packages/frontend/app/(public)/compare/page.tsx"
git commit -m "feat(compare): add page-specific FAQ section to compare index"
```

---

## Phase 3 — Bucket C: Layout-Level Placement (Client Pages)

### Task 18: `/pricing` FAQ + fix stale Offer schema

**Files:**

- Create: `packages/frontend/app/(app)/pricing/pricing-faqs.ts`
- Modify: `packages/frontend/app/(app)/pricing/layout.tsx`

**Interfaces:** none new — this task only touches `layout.tsx`'s existing `pricingJsonLd` object and adds a `FaqSection` render.

- [ ] **Step 1: Check for an existing FAQ on the client `page.tsx` before adding a second one**

Read `packages/frontend/app/(app)/pricing/page.tsx` and its child components (`PricingCards.tsx`, `build-feature-bullets.ts`, and any other component it renders) in full. Confirm there is no existing FAQ-like Q&A block already rendered client-side. If one exists, do not add a duplicate — instead adapt this task to add JSON-LD to that existing content (following the same pattern as Task 9) rather than authoring new `pricing-faqs.ts` content. If none exists (expected, based on this plan's earlier research showing only plan/tier cards and a billing toggle), proceed to Step 2 as written.

- [ ] **Step 2: Fix the stale `Offer` entities**

In `pricingJsonLd.["@graph"][1].offers` (the `SoftwareApplication` entity), replace the third offer:

```ts
// Replace this:
        {
          "@type": "Offer",
          name: "Team",
          price: "99",
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "99",
            priceCurrency: "USD",
            billingDuration: "P1M",
          },
          description:
            "Everything in Pro plus team collaboration, API access, and custom reports",
        },
// With this (verified live values from subscription_tiers, 2026-07-13):
        {
          "@type": "Offer",
          name: "Enterprise",
          price: "149",
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "149",
            priceCurrency: "USD",
            billingDuration: "P1M",
          },
          description:
            "Everything in Pro plus embeddable objects, widgets, team and brokerage features, and priority support",
        },
```

Also update the `<noscript>` block's matching section:

```tsx
// Replace:
          <h2>Team — $99/month</h2>
          <p>
            Everything in Pro plus team collaboration, API access, custom
            reports, and dedicated account management.
          </p>
// With:
          <h2>Enterprise — $149/month</h2>
          <p>
            Everything in Pro plus embeddable objects, widgets, team and
            brokerage features, and priority support.
          </p>
```

- [ ] **Step 3: Write the FAQ content file**

```ts
// packages/frontend/app/(app)/pricing/pricing-faqs.ts
import type { Faq } from "@/lib/seo/faq-json-ld";

export const PRICING_FAQS: Faq[] = [
  {
    question: "What's included in PropertyIQ's Free plan?",
    answer:
      "The Free plan includes interactive market maps, national and state-level data, historical trends and charts, and preview reports, with no credit card required to sign up.",
  },
  {
    question: "What do I get with PropertyIQ Pro that Free doesn't include?",
    answer:
      "Pro ($39/month) adds metro, county, and ZIP code-level data, full PropertyIQ Score breakdowns, AI-generated market analysis, unlimited AI reports, and ChatGPT and Claude integration through the MCP server, all missing from the Free plan.",
  },
  {
    question: "What does the Enterprise plan add over Pro?",
    answer:
      "Enterprise ($149/month) includes everything in Pro plus embeddable objects and widgets for your own site, team and brokerage collaboration features, and priority support.",
  },
  {
    question: "Can I switch between monthly and yearly billing?",
    answer:
      "Yes. Pro and Enterprise are both available billed monthly or yearly, and you can change your billing interval or plan at any time from your account's subscription settings.",
  },
  {
    question: "Is there a free trial for Pro or Enterprise?",
    answer:
      "You can start on the Free plan with no time limit and upgrade whenever you need metro/county/ZIP-level data or AI-generated reports — there's no separate trial period required to try Pro or Enterprise features.",
  },
];
```

- [ ] **Step 4: Wire into the layout**

```tsx
// packages/frontend/app/(app)/pricing/layout.tsx — add imports:
import { FaqSection } from "@/app/components/seo/FaqSection";
import { PRICING_FAQS } from "./pricing-faqs";

// Add <FaqSection faqs={PRICING_FAQS} /> as a new child right after the
// closing </noscript> tag and before {children}:
      </noscript>

      <FaqSection faqs={PRICING_FAQS} />

      {children}
```

- [ ] **Step 5: Verify**

Run: `node scripts/verify-faq-jsonld.mjs /pricing 5`

Also manually re-check (via the live DB query pattern used earlier, or by re-reading `subscription_tiers`) that $39/$149 are still accurate at implementation time — pricing can change between plan-writing and execution.

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/pricing/pricing-faqs.ts" "packages/frontend/app/(app)/pricing/layout.tsx"
git commit -m "fix(pricing): correct stale Enterprise tier Offer schema, add FAQ section"
```

---

### Task 19: `/map` FAQ

**Files:**

- Create: `packages/frontend/app/(app)/map/map-faqs.ts`
- Modify: `packages/frontend/app/(app)/map/layout.tsx`

**Research files:** `packages/frontend/app/map/config/metrics.ts` (to confirm "40+ metrics" is still accurate and name a few real metric categories rather than inventing examples).

- [ ] **Step 1: Research** — confirm the current metric count in `metrics.ts` matches the "40+ metrics" claim already used in this layout's metadata.

- [ ] **Step 2: Check for existing FAQ-like content on the client `page.tsx`/`MapPageInner`**

Read `packages/frontend/app/(app)/map/page.tsx` and skim `MapPageInner` (the dynamically-imported client component) for any existing help/FAQ text or tooltip content that a new FAQ section might duplicate. The map UI is expected to be pure interactive tooling with no prose FAQ, so this should confirm no overlap; if it turns out one exists, adapt this task to extend that content with JSON-LD instead of introducing a duplicate section.

- [ ] **Step 3: Write the content file**

```ts
// packages/frontend/app/(app)/map/map-faqs.ts
import type { Faq } from "@/lib/seo/faq-json-ld";
import { COVERAGE_COPY } from "@/lib/data/validation-claims";

export const MAP_FAQS: Faq[] = [
  {
    question: "What metrics can I visualize on the PropertyIQ map?",
    answer:
      "The interactive map covers 40+ metrics including the PropertyIQ Score, home values, rent prices, inventory, and days on market, selectable from a single dropdown and rendered as a color-coded heat map across the country.",
  },
  {
    question: "What geography levels can I view on the map?",
    answer: `You can zoom from a national overview down to individual ZIP codes, covering ${COVERAGE_COPY.sentence}. The map automatically adjusts which geography level renders based on your zoom, from state boundaries down to ZIP-code polygons.`,
  },
  // Add 3+ more Faq entries here — e.g. how the color scale is calculated,
  // how often map data refreshes, and whether map data is available via
  // API/MCP for programmatic use (cross-check against Task 12's docs/api
  // research so this doesn't contradict it).
];
```

- [ ] **Step 4: Wire into the layout**

```tsx
// packages/frontend/app/(app)/map/layout.tsx — add imports:
import { FaqSection } from "@/app/components/seo/FaqSection";
import { MAP_FAQS } from "./map-faqs";

// Render right after the existing crawler-visible <section> and before
// {children}:
      </section>
      <FaqSection faqs={MAP_FAQS} />
      {children}
```

- [ ] **Step 5: Verify**

Run: `node scripts/verify-faq-jsonld.mjs /map 5`

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/map/map-faqs.ts" "packages/frontend/app/(app)/map/layout.tsx"
git commit -m "feat(map): add page-specific FAQ section"
```

---

## Phase 4 — Consolidation

### Task 20: Full build, cross-page dedupe scan, live spot-checks

**Files:** none created/modified — verification only.

- [ ] **Step 1: Full frontend build**

Run (from `packages/frontend`): `npm run build`
Expected: builds with zero errors. Fix any error before proceeding, per the Global Constraints rule — including any pre-existing errors surfaced, not just ones from this branch.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including every test file created/modified in Tasks 1-9.

- [ ] **Step 3: Cross-page dedupe scan**

Run this from `packages/frontend` to pull every FAQ question across all new/modified content files into one place for a manual duplicate scan:

```bash
grep -rn "question:" app/components/home/homeFaqs.ts "app/(app)/about/about-faqs.ts" "app/(app)/docs/api/docs-api-faqs.ts" "app/(app)/screener/screener-faqs.ts" "app/(app)/analyzer/analyzer-faqs.ts" "app/(public)/markets/markets-directory-faqs.ts" "app/(public)/markets/state/[state]/build-state-faqs.ts" "app/(public)/compare/compare-index-faqs.ts" "app/(app)/pricing/pricing-faqs.ts" "app/(app)/map/map-faqs.ts"
```

Read the full output. Flag and rewrite any two questions across different pages that are near-duplicates (same underlying question, different phrasing) rather than genuinely distinct angles — per the Global Constraints rule.

- [ ] **Step 4: Live spot-check a sample of 6 pages in a browser**

With the dev server running, open each of: `/`, `/pricing`, `/scores`, `/docs/mcp`, `/markets/state/<a-real-state>`, `/compare`. For each: confirm the FAQ section renders visibly near the bottom of the page with the expected content, and view-source to confirm the `<script type="application/ld+json">` tag is present and well-formed (or run `node scripts/verify-faq-jsonld.mjs <path> <n>` for each as a faster equivalent).

- [ ] **Step 5: Run the verify script against all 17 page targets in one pass**

```bash
node scripts/verify-faq-jsonld.mjs / 5
node scripts/verify-faq-jsonld.mjs /about 5
node scripts/verify-faq-jsonld.mjs /docs/api 5
node scripts/verify-faq-jsonld.mjs /screener 5
node scripts/verify-faq-jsonld.mjs /analyzer 5
node scripts/verify-faq-jsonld.mjs /markets 5
node scripts/verify-faq-jsonld.mjs /markets/state/<a-real-state-slug> 4
node scripts/verify-faq-jsonld.mjs /compare 5
node scripts/verify-faq-jsonld.mjs /pricing 5
node scripts/verify-faq-jsonld.mjs /map 5
node scripts/verify-faq-jsonld.mjs /scores 8
node scripts/verify-faq-jsonld.mjs /docs/mcp 7
node scripts/verify-faq-jsonld.mjs /help 7
node scripts/verify-faq-jsonld.mjs /forecast 5
node scripts/verify-faq-jsonld.mjs /forecast/<a-real-metro-slug> 5
node scripts/verify-faq-jsonld.mjs /markets/<a-real-metro-slug> 5
node scripts/verify-faq-jsonld.mjs /compare/<a-real-comparison-slug> 5
```

Expected: every line prints `PASS`. Fix and re-run any `FAIL` before proceeding.

- [ ] **Step 6: Commit** (only if Step 3's dedupe scan required content fixes; otherwise skip — this is a verification-only task)

```bash
git add -u
git commit -m "fix(seo): resolve cross-page FAQ question duplication found in consolidation pass"
```

---

### Task 21: Background code-reviewer dispatch

**Files:** none.

- [ ] **Step 1: Dispatch the code-reviewer agent in the background**

Per CLAUDE.md §1.6, dispatch a `code-reviewer` agent (`run_in_background: true`) to review the full diff across this branch against CLAUDE.md standards (file size limits, data-layer rules, naming conventions). Surface only CRITICAL/WARNING findings to the user; do not report "all passed."

- [ ] **Step 2: Address any CRITICAL/WARNING findings**

Fix anything flagged, re-run the affected page's verify script, and commit the fix with a message describing what was corrected.
