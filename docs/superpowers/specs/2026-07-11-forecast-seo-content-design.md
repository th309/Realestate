# Forecast SEO Content — Design

**Date:** 2026-07-11
**Branch:** `worktree-feat+forecast-2026-seo-content`
**Source:** Reventure competitor audit, Critical item #2 (`docs/audits/reventure-competitor-capture-2026-07-09/ACTION-PLAN.md`)

## Goal

Capture two query families where Reventure is verifiably absent and PropertyIQ has the data to compete honestly:

1. **National head term:** "will home prices crash 2026" (currently owned by Forbes/Newsweek/Yahoo/CNBC/JPMorgan — all speculation, none data-backed at market granularity).
2. **City-level long tail:** "[market] housing market forecast 2026" (~935 scored metros; Reventure has zero indexable per-market pages and structurally cannot rank here).

Content is grounded in the PropertyIQ score + confidence grade — momentum data, not speculation.

## Decisions (settled during brainstorming)

| Decision                                     | Choice                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Relation to existing MDX blog forecast posts | **Supersede** — 308 redirect old posts into the new pages                                                             |
| Geography scope (phase 1)                    | **Metros only** (~935); counties/ZIPs deferred                                                                        |
| Year handling                                | **Evergreen URLs**, year in titles/content only, derived from latest score period                                     |
| Year rollover rule                           | Score period month **≥ October → display next year** (Oct 2026 update → "Forecast 2027"); Jan–Sep → period's own year |
| Architecture                                 | **Dedicated `/forecast` route tree** cross-linked with existing `/markets` pages                                      |

## Architecture

### Routes (frontend, `packages/frontend`)

| Route                                   | Purpose                                                 |
| --------------------------------------- | ------------------------------------------------------- |
| `app/(public)/forecast/page.tsx`        | National hub — the "will home prices crash" answer page |
| `app/(public)/forecast/[slug]/page.tsx` | Per-metro forecast page (e.g. `/forecast/austin-tx`)    |

- Per-metro pages key off the **existing** `lib/data/metro-slug-data.json` map (`SLUG_TO_METRO`), inheriting the fail-closed scored-geo gating with zero new gating code. Unknown slug → `notFound()`. Alias slug → 308 to canonical slug, same as `/markets/[slug]`.
- Same ISR/caching posture as the markets pages.
- Components follow CLAUDE.md size limits (one exported component per file, split at 300 lines).

### Backend — one new insight purpose (`packages/backend/src/insights/`)

Add `market_forecast` as a new `InsightType`:

- Prompt builder in `insight-prompts.ts`; `AI_PURPOSES` key in `ai-provider.types.ts`; one `ai_model_config` row (provider/model swappable without code changes).
- Inputs: existing `InsightContext` — score, the 4 score components (`zhvi_yoy`, `zhvi_mom_3m`, `median_days_on_market`, `price_reduced_share`), confidence grade, key metrics, state/national benchmarks. Add the confidence letter grade to the context if not already present.
- Storage: existing `market_insights` table (upsert on `region_id, geo_level, insight_type`), 30-day TTL.
- Output format: markdown `##` sections (the `market_overview` pattern), parsed into HTML sections by the page component.

**Honesty rules (hard constraints in the prompt, alongside the existing `DATA_GROUNDING_RULE`):**

- The narrative describes what the momentum data signals for the year ahead. It **never invents price targets or percentage price predictions** ("prices will fall 8%" is forbidden; "days on market rising and price cuts increasing signal cooling momentum" is the register).
- Score labels follow CLAUDE.md §9 exactly: momentum/timing language (STEADY/EASING/FIRMING...), never quality verdicts.
- Confidence grade is always surfaced next to the score — "what the data says, and how good the data is."

**Generation:** extend `insight-batch-generator.ts` to include `market_forecast` for published metros in the monthly post-rescore batch (existing concurrency cap 5). Frontend fetches with `cachedOnly=1` — ISR/SSR never triggers live generation (preserves the DeepSeek cost guardrail). ~935 narratives/month is well inside the `AI_DAILY_SPEND_CAP_USD` ledger.

### Per-metro forecast page composition

1. Breadcrumb (Home → Forecast → {Metro}) + H1 "{Metro} Housing Market Forecast {year}".
2. `ScoreWidget` (existing component — score + confidence + momentum label).
3. AI forecast narrative (`market_forecast`, cached-only fetch; **page renders fully without it** — narrative is additive, never blocking).
4. Momentum data section: the 4 score components with trend context, deterministic copy.
5. FAQ section (≥3 items, e.g. "Will {metro} home prices crash in {year}?") answered from the data — reuses the `MarketFaqSection` + FAQPage JSON-LD pattern.
6. Cross-links: back to `/markets/[slug]`, plus same-state forecast pills via the existing `fetchRankings("propertyiq", "metro", { state })` pattern.

### National hub page composition (`/forecast`)

1. H1 answering the head term ("Will Home Prices Crash in {year}? What the Data Shows").
2. **Deterministic aggregate section:** score distribution across all scored metros ("of {N} scored metros, {x}% show weakening momentum, {y}% firming…"), top rising / top cooling metros. Sourced from existing rankings/scores endpoints; a small aggregate endpoint is added only if the existing ones can't serve the distribution efficiently.
3. National prose: **reuse the existing `market_outlook` narrative** (already generated with news context for the landing page) — no new generation cost.
4. Crawlable index of all metro forecast pages grouped by state, plus featured top-movers.
5. FAQ + FAQPage JSON-LD for head-term variants ("will the housing market crash", "is now a good time to buy").

### Cross-linking (existing pages)

- Each `/markets/[slug]` metro page gets a compact "{year} Forecast →" teaser section linking to `/forecast/[slug]`.
- Intent split is deliberate and maintained in titles: `/markets` = current state of the market; `/forecast` = where it's heading. This is the cannibalization guard.

### Blog supersede (redirects)

- `content/blog/housing-market-forecast-2026.mdx` → 308 `/forecast`.
- Per-metro `{market}-real-estate-market-2026.mdx` posts → 308 `/forecast/[slug]` where that slug is published; otherwise → 308 `/forecast`.
- Mapping produced by a small generator script (pattern: `generate-descored-redirects.ts`), output JSON spliced into `next.config.mjs` `redirects()`. The superseded MDX files are deleted (per project rule: delete stale content, don't keep drifted duplicates).

### SEO plumbing

- `generateMetadata()` per page following `lib/seo/market-metadata.ts` patterns: data-interpolated title/description, `alternates.canonical`, OG/Twitter cards.
- JSON-LD: `BreadcrumbList`, `FAQPage` (≥3 items), `Dataset`/stats block per existing `buildStatsJsonLd` pattern.
- Sitemap: forecast URLs added to `lib/seo/sitemap-builder.ts` from the same gated `scoredEntries()` source — automatic inclusion for every published metro; `<lastmod>` from the score period.
- **Year helper:** one shared function (frontend `lib/`, also used in FAQ/metadata copy): `forecastDisplayYear(scorePeriod)` → `scorePeriod.month >= 10 ? scorePeriod.year + 1 : scorePeriod.year`. No hardcoded year anywhere in routes, components, prompts, or metadata.
  - The AI prompt receives the display year as input (so narratives say "heading into 2027" after the October rescore without regeneration logic changes).

### De-scoring behavior

- A metro dropping out of the scored set loses its forecast page the same build its market page is removed. `generate-descored-redirects.ts` is extended to also emit `/forecast/{slug}` → 307 `/forecast` (national hub; there is no county/state forecast ancestor).

## Error handling

| Failure                                 | Behavior                                                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No cached `market_forecast` narrative   | Page renders from deterministic data only (score, components, FAQ); narrative section omitted                                                                               |
| Spend cap hit mid-batch                 | Existing `AiSpendCapExceededError` halts generation; stale (≤30-day) narratives keep serving; next batch fills gaps                                                         |
| Score data missing for a published slug | Cannot happen by construction (slug JSON is generated from the scored set, fail-closed); if fetch fails at render, page 500s into Next error boundary same as markets pages |
| Unknown/de-scored slug                  | `notFound()` / 307 to `/forecast` respectively                                                                                                                              |

## Testing (E2E against real DB — no mocks, per project rule)

1. **Generation:** run `market_forecast` generation for one real metro against the real DB; assert row in `market_insights` with correct `insight_type`, non-empty content, no markdown violations of the prompt contract.
2. **Honesty spot-check harness:** generate for a sample of metros; assert output contains no fabricated price-change percentages (regex for `%` price-prediction patterns outside the provided data values) and no forbidden quality-verdict words.
3. **Rendering:** prod-preview verification (`next build` to `.next-verify`, `next start -p 3100`, Playwright): `/forecast` and `/forecast/{real-slug}` render score, narrative, FAQ; JSON-LD blocks parse as valid JSON; H1/title contain the correct display year.
4. **Year helper:** unit tests for the October rollover boundary (Sep period → same year, Oct period → next year).
5. **Redirects:** blog post URLs 308 to forecast pages; alias slug 308; unknown slug 404.
6. **Sitemap:** forecast URLs present in the generated sitemap for published metros.

## Out of scope (phase 1)

- County and ZIP forecast pages (revisit after metro pages index and rank).
- Any change to the score formula, labels, or `market_overview`/other existing insight types.
- Rank tracking / SERP monitoring tooling.
- Paid promotion or comparison-page changes (other audit items).

## Follow-ups (not this phase)

- Counties/ZIPs expansion once metro pattern proves out (audit item #1 synergy).
- Quarterly re-verify that Reventure remains absent from these SERPs (audit item #7 cadence).
