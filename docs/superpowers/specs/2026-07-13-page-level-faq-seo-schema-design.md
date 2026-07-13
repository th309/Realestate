# Page-Level FAQ + FAQPage Schema Rollout

**Date:** 2026-07-13
**Status:** Approved for planning
**Worktree:** dedicated (see plan)

## Problem

PropertyIQ wants better alignment with Google's "People Also Ask" / AI Overviews and with
AI answer engines (ChatGPT, Perplexity, Claude) that surface `FAQPage` schema and quotable
Q&A content. Today only 4 page families carry a FAQ block with `FAQPage` JSON-LD
(`/markets/[slug]` + zip/county variants, `/scores`, `/compare/[slug]`, `/docs/mcp`), and
`/forecast` / `/forecast/[slug]` have partial FAQ content that falls short of a useful
question count. Everything else — homepage, `/pricing`, `/about`, `/help`, `/docs/api`,
`/screener`, `/analyzer`, `/map`, `/markets` directory, `/markets/state/[state]`,
`/compare` index — has no FAQ at all.

The requirement: every public/crawlable page gets a FAQ section with **at least 5**
page-specific, non-generic Q&A pairs, rendered visibly and backed by matching `FAQPage`
JSON-LD, so the schema always reflects what's actually on the page (a mismatch between
visible content and schema risks a Google manual action).

## Non-goals

- Authenticated app screens (`/dashboard`, `/admin`, `/account`) — not crawled, no SEO/AEO
  value.
- `/reports` — intentionally `noindex,nofollow` today (existing code comment). Schema there
  is invisible to crawlers, so it's out of scope for this effort.
- `/terms`, `/privacy` — legal boilerplate; Google discourages FAQ schema here.
- `/data`, `/blog` index, `/team`, `/newsletter`, `/tour` — insufficient unique content per
  page to support 5 genuinely distinct, non-generic questions.
- Embed/report-artifact pages (`/embed/*`, `top-cashflow-report`, `movers-report`,
  `market-comparison`, `home-v2`) — report outputs, not pages people ask questions about.

## Scope — 17 page targets

### Bucket A — Audit + expand (already has FAQ + JSON-LD)

| Page                                                               | Current component                             | Action                                            |
| ------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------- |
| `/markets/[slug]`, `/markets/zip/[slug]`, `/markets/county/[slug]` | `MarketFaqSection` (shared)                   | Audit count (≥5) and specificity; expand if short |
| `/scores`                                                          | `ScoresFaqSection`                            | Audit count and specificity; expand if short      |
| `/compare/[slug]`                                                  | inline (original pattern)                     | Audit count and specificity; expand if short      |
| `/docs/mcp`                                                        | `McpFaqSection`                               | Audit count and specificity; expand if short      |
| `/forecast/[slug]`                                                 | `build-forecast-faqs.ts` + `MarketFaqSection` | Currently ≤4 conditional questions — extend to 5+ |
| `/forecast` index                                                  | inline via `MarketFaqSection`                 | Currently 2-3 questions — extend to 5+            |

### Bucket A′ — Has content, missing schema

| Page    | Notes                                                                          | Action                                                                                                                                                                                                                                             |
| ------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/help` | 7-item plain `<details>` FAQ, no JSON-LD, content not in a reusable data shape | Extract to a `{question, answer}[]` array; feed both the existing visible list and a new `buildFaqJsonLd()` call from the same array (single source of truth — no drift). Audit the 7 existing questions for genericness while touching this file. |

### Bucket B — New FAQ, shared component, freshly authored content

| Page                     | File                                          | Notes                                                                                                          |
| ------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Homepage                 | `app/(app)/page.tsx`                          | Server component                                                                                               |
| `/about`                 | `app/(app)/about/page.tsx`                    | Server component                                                                                               |
| `/docs/api`              | `app/(app)/docs/api/page.tsx`                 | Server wrapper around `DocsPageClient`; FAQ added in the server wrapper                                        |
| `/screener`              | `app/(app)/screener/page.tsx`                 | Server wrapper around `ScreenerPageInner`; FAQ about how screening works conceptually                          |
| `/analyzer`              | `app/(app)/analyzer/page.tsx`                 | Server wrapper around `AnalyzerClient`; FAQ about cap rate/cashflow/BRRRR/70% rule concepts                    |
| `/markets` (directory)   | `app/(public)/markets/page.tsx`               | Server component; FAQ about how market data/coverage works                                                     |
| `/markets/state/[state]` | `app/(public)/markets/state/[state]/page.tsx` | New per-state content builder (`build-state-faqs.ts`), data-driven from the page's existing stats              |
| `/compare` index         | `app/(public)/compare/page.tsx`               | Already has `Article`/`ItemList`/`Breadcrumb` JSON-LD in a `@graph` — add a `FAQPage` entity to the same graph |

### Bucket C — Layout-level placement (client `page.tsx`)

| Page       | Target file                    | Why                                                                                                                                                           |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/pricing` | `app/(app)/pricing/layout.tsx` | `page.tsx` is `'use client'`; layout already carries static metadata + JSON-LD + `<noscript>` block — same pattern extends naturally                          |
| `/map`     | `app/(app)/map/layout.tsx`     | `page.tsx` is `'use client'` (dynamic import, `ssr: false`); layout already renders a server-side crawler-visible text block — FAQ follows the same precedent |

## Shared infrastructure

- **`app/components/seo/FaqSection.tsx`** — presentational component. Props:
  `{ faqs: { question: string; answer: string }[], heading?: string }`. Renders an `<h2>`
  (default "Frequently Asked Questions") followed by stacked `.space-y-4` cards
  (`rounded-xl border border-outline-variant p-5`, `<h3>` question + `<p>` answer),
  matching the existing `MarketFaqSection` visual convention. Returns `null` if fewer than
  3 items are passed (consistent minimum bar). Also renders the `<script type="application/
ld+json">` tag inline, generated from the same `faqs` prop passed to it — the render
  function and the schema always read the identical array, so they cannot drift.
- **`lib/seo/faq-json-ld.ts`** — `buildFaqJsonLd(faqs)` returns the `FAQPage` schema object
  (`{"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [...]}`), serialized
  through the existing `safeJsonLdString()` helper (fixes the raw `JSON.stringify` currently
  used in `MarketFaqSection`, which is inconsistent with the newer convention).
- **Refactor existing sections** (`MarketFaqSection`, `ScoresFaqSection`, `McpFaqSection`) to
  render `<FaqSection>` internally, keeping their own domain-specific data-gating logic
  (e.g., "return null below 3 items", "skip questions whose stat is null") as wrapper logic
  around the shared component rather than duplicated inside it.
- Content stays split per page: data-driven pages (markets, scores, forecast) keep their
  existing `build-*-faqs.ts` generator-function pattern; static pages get a plain
  `<page>-faqs.ts` exporting a `{question, answer}[]` array.

## Content standards

1. **Page-specific, not interchangeable.** Every question must be something a user or an AI
   answer engine would plausibly ask _while looking at that specific page_. No near-duplicate
   questions across pages — e.g. the homepage's score question and `/scores`' score question
   must be scoped differently (homepage: "what does this mean for me as a buyer"; `/scores`:
   "how is it calculated").
2. **Grounded in verifiable fact.** Every answer is sourced from that page's own real content
   — registry constants, `COVERAGE_COPY`, actual pricing tiers, the actual score formula,
   actual feature availability. Never invent a number, coverage claim, or feature claim. If a
   fact can't be verified from the codebase, flag it rather than write a plausible guess.
3. **Self-contained, quotable.** 2-4 sentences per answer, brand voice per CLAUDE.md §8.6
   (confident, conversational, data-first), no markdown syntax or em-dashes in the answer
   text (AI answer engines quote these fragments verbatim and out of context).
4. **Placement.** Bottom of page content, above the footer, matching the existing
   `MarketFaqSection` convention.

## Process

1. Dedicated git worktree branched from `develop` (per user request), isolating this work
   from any concurrent in-progress edits on `develop` (e.g. the MCP docs landing page
   currently mid-edit).
2. Build the shared `FaqSection` + `buildFaqJsonLd` infrastructure first; refactor the 3
   existing FAQ sections onto it and confirm no visual/behavioral regression.
3. Dispatch parallel agents across the 17 page targets (grouped into small batches where
   pages share a component family, e.g. all three market geo levels share one audit pass).
   Each agent: reads the page's real content/data source, drafts grounded Q&A, wires the
   section in (or into `layout.tsx` for Bucket C), self-verifies locally (page renders,
   ≥5 items present where not data-gated, JSON-LD is valid parseable `FAQPage` schema).
4. Consolidation pass: full frontend build, run/extend unit tests for the `build-*-faqs.ts`
   generators (data-gating edge cases — null stats, insufficient data), live dev-server
   spot-checks of a sample of pages (visible rendering + view-source JSON-LD), a cross-page
   scan for accidentally duplicated questions.
5. Background `code-reviewer` dispatch per CLAUDE.md §1.6 given the file count touched.

## Error handling / edge cases

- Data-driven pages (`/markets/state/[state]`, `/forecast`, `/forecast/[slug]`) must degrade
  gracefully when underlying stats are null — render fewer questions (down to the existing
  3-item minimum) rather than a broken or empty-string question, mirroring current
  `MarketFaqSection` behavior. They are not held to the "5+" bar as strictly as static pages
  when data genuinely isn't available; the target is "5 when data supports it."
- Bucket C pages (`/pricing`, `/map`): verify during implementation that the layout-level FAQ
  doesn't visually or semantically duplicate anything the client page itself renders.
- `/help`: verify the extracted `{question, answer}[]` array renders identically to the
  current `<details>` markup before wiring in JSON-LD — this is a refactor of working UI, not
  just an addition.

## Testing

- Unit tests for new/modified `build-*-faqs.ts` generators covering data-gating edge cases.
- Live verification (no mocks): dev-server render of every modified/new page confirming the
  FAQ section is visible with the expected question count, and that the JSON-LD script tag
  parses as valid JSON matching `FAQPage` shape.
- Full `npm run build` (frontend) must pass clean with zero errors before this branch is
  considered done, per existing lessons-learned rule.
