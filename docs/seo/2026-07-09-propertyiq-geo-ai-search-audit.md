# PropertyIQ GEO / AI Search Readiness Audit

**Date:** 2026-07-09
**Scope:** Generative Engine Optimization (GEO) readiness for Google AI Overviews, ChatGPT, Perplexity, and Bing Copilot — crawler access, llms.txt, structured data, brand/entity signals, content citability, multi-modal content, and technical accessibility.
**Method:** Parallel codebase investigation (4 explore agents) across `packages/frontend`, no live scraping/network checks.

---

## GEO Readiness Score: 77/100

| Category                  | Weight | Score  | Weighted           |
| ------------------------- | ------ | ------ | ------------------ |
| Citability                | 25%    | 82/100 | 20.5               |
| Structural Readability    | 20%    | 85/100 | 17.0               |
| Multi-Modal Content       | 15%    | 45/100 | 6.75               |
| Authority & Brand Signals | 20%    | 78/100 | 15.6               |
| Technical Accessibility   | 20%    | 88/100 | 17.6               |
| **Total**                 |        |        | **77.45 ≈ 77/100** |

**Headline:** PropertyIQ's technical GEO infrastructure (robots.txt `Content-Signal` directives, `.well-known` agent-discovery endpoints, llms.txt, real sitemap) is more deliberate than the vast majority of sites and was clearly purpose-built for AI crawlers, not bolted on. Content citability and structural readability are also strong — FAQ blocks are real Q&A with a data-quality gate, market pages open with data-driven direct answers. The two drags on the score are **multi-modal content** (near-zero raster imagery, a fully client-only canvas map with no text companion) and an **active-but-unfinished brand-mention campaign** (Reddit account created, zero posts yet; founder Person schema has no `sameAs`).

---

## Platform Breakdown

| Platform                | Est. Score           | Why                                                                                                                                                                                                                                                                               |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google AI Overviews** | ~80/100              | Strong technical SEO (sitemap, canonical, indexable-by-default) + strong on-page citability + rich structured data (Article/FAQPage/BreadcrumbList/Dataset/WebSite). Best-positioned platform.                                                                                    |
| **ChatGPT**             | ~55/100              | Heavily weighted to Wikipedia (47.9% of citations) and Reddit (11.3%). PropertyIQ has a Wikidata entity (Q140473066, structured data — not a Wikipedia article) and a Reddit account with **zero posts**. This is the platform most exposed by the unfinished brand-mention work. |
| **Perplexity**          | ~50/100              | Reddit dominates its citation mix (~46.7%). Same gap as ChatGPT — account exists, no activity yet, explicitly gated on founder go-ahead per the entity-disambiguation playbook.                                                                                                   |
| **Bing Copilot**        | ~65/100 (unverified) | General technical SEO strength (sitemap, indexability, canonical tags) should carry over to Bing's index. **IndexNow protocol was not checked in this pass** — worth a follow-up if Bing visibility matters.                                                                      |

---

## AI Crawler Access Status

Implemented at `packages/frontend/app/robots.txt/route.ts` (dynamic route, not a static file) — this is a deliberately engineered setup, not a Next.js default:

- **Wildcard (`*`) group:** `Allow: /`, `/api/og`; `Disallow: /api/, /admin/, /auth/, /account/, /dev/, /health/, /betatest/`; plus a non-standard-but-emerging `Content-Signal: search=yes, ai-input=yes, ai-train=no` line.
- **Named citation/search bots** (`OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Bingbot`) get the same allow/disallow rules but no separate `Content-Signal` line of their own.
- **Named training bots** (`GPTBot`, `ClaudeBot`, `Google-Extended`) are explicitly granted crawl access but fall back to the wildcard's `ai-train=no` signal.
- **Not given dedicated groups:** `CCBot`, `anthropic-ai`, `Bytespider`, `cohere-ai` — they're still allowed (fall under `*`), just without deliberate per-bot treatment.
- `Sitemap: https://www.propertyiq.app/sitemap.xml` is declared.

**Intent (per in-code comment):** maximize search/citation reach for everyone while withholding AI-training license via `Content-Signal` — a genuinely sophisticated access-vs-license split most sites don't attempt.

No bot-blocking in `next.config.mjs`, no `X-Robots-Tag` header anywhere. CSP (`default-src 'self'`) governs the browser executing the page, not server-side crawler fetches, so it doesn't affect bot access.

---

## llms.txt Status: Present, well-structured, missing freshness metadata

- `public/llms.txt` (82 lines): Overview, Key Pages (9 links), Scoring System, Validation Results, Data Sources table, Coverage, Pricing, Competitors, Citation block.
- `public/llms-full.txt` (110 lines): same sections plus a full "Detailed Methodology" walkthrough and "Walk-Forward Validation Process."
- **Gap:** neither file has a last-updated/date field, so an AI crawler (or a human) can't machine-verify freshness. Coverage numbers do match the `COVERAGE_COPY` constant per CLAUDE.md, so they're at least kept in sync by convention — just not verifiably so from the file itself.
- Also present: `.well-known/mcp/server-card.json`, `api-catalog`, `oauth-protected-resource`, `oauth-authorization-server`, `agent-skills/index.json` + per-skill `SKILL.md`, and `agent-card.json` (A2A) — served via rewrites since the App Router can't route dot-folders. A global `Link` header advertises `api-catalog` and `service-doc` rels. This agent-discovery layer goes beyond typical GEO scope (it's aimed at AI _agents_, not just AI _search_) but reinforces that the site is built to be legible to machines broadly.
- **RSL 1.0:** confirmed absent, no license.xml/RSL feed found.

---

## Brand Mention / Entity Analysis

**Organization `sameAs`** (`app/components/seo/OrganizationJsonLd.tsx`, rendered sitewide):

```
https://www.wikidata.org/wiki/Q140473066
https://www.linkedin.com/company/propertyiq-app/
https://www.youtube.com/@PropertyIQ_app
https://www.facebook.com/propertyiq.us
https://www.reddit.com/user/propertyiq-app/
```

A code comment explicitly warns that `linkedin.com/company/property-iq` (no "-app") belongs to an unrelated Las Vegas company and must never be linked — good defensive detail, since brand-name collision is the whole reason this work exists.

**Driving document:** `docs/marketing/2026-07-08-entity-disambiguation-playbook.md` — "PropertyIQ" is a contested name (propertyiq.com.au, property-iq.ai, propertyiq.com are unrelated companies). Status as of 2026-07-09:

| Signal                     | Status                                                                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wikidata entity Q140473066 | **Done** — statements for website/industry/inception/country, described-at-URL → `/scores/methodology`                                                                                                                                               |
| Facebook                   | Done — `propertyiq.us` vanity URL secured                                                                                                                                                                                                            |
| Reddit                     | Account created (`u/propertyiq-app`), joined subreddits by audience with a promo-tolerance table — **zero posts yet**, gated on founder go-ahead; playbook flags ban-evasion risk since two prior "PropertyIQ" handles were already banned on Reddit |
| Crunchbase / App Store     | Planned, not yet created                                                                                                                                                                                                                             |
| Wikidata logo              | Pending a Commons/CC licensing decision                                                                                                                                                                                                              |

The playbook itself ties this directly to GEO: **Reddit is ~46.7% of Perplexity's citation sources and ~11.3% of ChatGPT's** — this is the single highest-leverage unfinished item in the whole audit.

**Person (author) schema:** `app/(app)/about/page.tsx` defines a canonical `Person` node for the founder (name, `honorificSuffix: "MBA"`, `jobTitle: "Founder"`, `worksFor` → Organization), referenced by `@id` from the methodology page's `Article.author`. **Gap:** unlike the Organization node, this Person has **no `sameAs`** — no link to a LinkedIn or other profile, which is a real (and cheap to close) authority signal gap for E-E-A-T.

**Other structured data found:** Article (blog, methodology, market overviews, compare), FAQPage (scores, markets, compare), BreadcrumbList (nearly all public templates via shared `WebPageJsonLd.tsx`), WebSite/WebPage/SoftwareApplication (homepage, with live pricing `Offer` pulled from the API, never hardcoded), Dataset (data page, market stats). No Product/LocalBusiness — correctly absent for a SaaS with no storefront.

**Dates:** Blog posts collapse `datePublished`/`dateModified` to the same frontmatter value (no real edit tracking). Methodology page's `dateModified` is computed live on every render (always "today" — arguably worse than no field, since it implies constant revision that isn't happening). Market pages use a real pipeline timestamp for `datePublished` but have no `dateModified`.

---

## Passage-Level Citability

- Metro/county/ZIP pages open with `buildMarketDataSummary()` — a bolded, data-real direct-answer sentence ("X's median home value is $Y, up Z% over the past year") in ~15-20 words when stats exist. This is close to ideal for the 134-167-word citable-passage pattern once surrounding sentences are included.
- When stats are unavailable, falls back to one of 5 generic `OPENING_TEMPLATES` — descriptive rather than a strict definitional lead, and a real (if minor) citability floor drop for thin-data markets.
- FAQ answers (`build-market-faqs.ts`) are explicitly written direct-answer-first and self-contained per the file's own doc comment, and the section is gated to return `null` below 3 surviving FAQs — no thin-content FAQ blocks ship.
- Blog posts open with 2 direct declarative paragraphs before the first heading; body paragraphs run 2-4 sentences, data-dense rather than padded.
- **Structural gap:** FAQ question text lives in `<dt>` elements, not heading tags (h3/h4) — content is still fully quotable, but it sits outside the page's heading outline, so the "question-based headings" signal isn't captured at the structural level even though it's captured at the content level.

---

## Server-Side Rendering Check

- `next.config.mjs`: `output: 'standalone'` — a live Node server with SSR/ISR, not a static export.
- Market pages (`markets/[slug]/page.tsx`, etc.) are server components with `generateStaticParams` + `revalidate = 86400` — real server-fetched text, stats, FAQ, and JSON-LD land in initial HTML.
- `app/(public)/layout.tsx` deliberately avoids cookies so routes can be statically rendered/ISR-cached — a comment confirms this was tuned specifically for SEO.
- Homepage sections (`app/components/home/*`) are Client Components, but static text (H1, taglines) is written to render at full opacity regardless of hydration — `HeroSection.tsx` has an explicit comment confirming this was tuned for LCP/no hydration-gating, so crawlers still see the text.
- **Real gap #1:** `MarketOverviewSection.tsx` renders the AI-generated market narrative only from `initialInsight`, a cache-only server-fetched value that never triggers paid generation during ISR. On long-tail metro/county/ZIP pages that haven't been visited yet, this is `null`, and the SSR HTML contains only a `LoadingSkeleton` shimmer — a non-JS crawler sees no narrative text until a real visitor populates the cache. Self-healing over time, but a real cold-start content gap today.
- **Real gap #2:** the Mapbox GL map (`app/(app)/map/page.tsx`) is `'use client'`, canvas/WebGL-rendered — fully invisible to non-JS crawlers, with no adjacent text/data summary of what the map shows. It's not in the primarily-SEO'd `(public)` route group, so this matters less for GEO than the market pages, but it's the site's flagship visualization and contributes nothing to AI citability today.
- The PropertyIQ Score _ring_ widget is also client-only, but `MarketStatsBlock` (a server component, explicitly commented "values land in initial HTML for crawler visibility") renders the grade and underlying z-score inputs as plain text right below it — a good mitigation, not a full fix.

---

## Top 5 Highest-Impact Changes

1. **Activate the Reddit presence.** The account exists, subreddits are joined with a promo-tolerance table already mapped out — the only missing step is founder go-ahead to post. This is the single highest-leverage item: Reddit drives ~46.7% of Perplexity citations and ~11.3% of ChatGPT's, and both platforms currently score lowest in this audit largely because of this gap.
2. **Add `sameAs` to the founder Person schema.** Near-zero engineering cost (one field in `about/page.tsx`), closes an E-E-A-T authority gap that the Organization entity already gets right.
3. **Fix the cold-cache market-overview gap.** Give `MarketOverviewSection.tsx` a server-rendered fallback (even just the existing `buildMarketDataSummary()` opening sentence or a FAQ excerpt) instead of a bare `LoadingSkeleton` when `initialInsight` is null, so long-tail pages always have crawler-visible text on first render.
4. **Give the map and score-ring a text companion.** Multi-modal content sees 156% higher AI-selection rates, and this category scored weakest in the audit (45/100) — almost entirely because the two most visually prominent surfaces on the site (the interactive map, the score ring) render nothing to non-JS crawlers. A short server-rendered summary near the map ("Showing [metric] across [N] counties, ranging from X to Y") would close most of the gap cheaply.
5. **Add freshness metadata to llms.txt/llms-full.txt and name the remaining AI crawlers explicitly.** A last-updated line costs nothing and makes the files' currency verifiable; adding `CCBot`, `anthropic-ai`, `Bytespider`, `cohere-ai` as named groups (even with identical rules to the wildcard) makes crawler policy fully explicit rather than implicit-by-omission.

---

## Remediation Update — 2026-07-09 (same day)

All five items above were implemented and verified (typecheck, code review, and live browser checks against a running dev server) in a follow-up pass, targeting 90+ in every category. One explicit exception: **Reddit activation was not done — the user directed "do not post to reddit."** That constraint is treated as final, not a gap to work around.

| Category                  | Before | After | What changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Citability                | 82     | 90    | Cold-cache market-overview pages now ship a real, honest, server-rendered fallback paragraph (no fabricated commentary) instead of a bare loading skeleton, verified live in-browser. Fixed factual/coverage-count errors in the OPENING_TEMPLATES fallback copy (county template said "three" metrics, should be "four"; hardcoded "3,100 counties"/"20,000 ZIPs" replaced with the `COVERAGE_COPY` constant — the ZIP figure was also just wrong, off by ~9,000).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Structural Readability    | 85     | 92    | FAQ question text converted from bare `<dt>`/plain `<summary>` text to real heading elements (h3) with correct H1→H2→H3 hierarchy across all three FAQ implementations, while preserving FAQPage JSON-LD and existing gating logic. Fixed an invalid-HTML regression along the way (`<summary>` can't contain a heading plus other content — chevron icon moved out via absolute positioning).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Multi-Modal Content       | 45     | 82    | `ScoreDisplay`'s dead `"use client"` directive removed (it had no hooks/browser APIs), making the PropertyIQ Score ring SSR-capable; it's now rendered server-side in the crawler-visible market stats block on metro/county/ZIP pages, verified live. A real, alt-bearing OG-image `<img>` + matching `ImageObject` JSON-LD is now embedded (not just linked in meta tags) on metro, county, and ZIP market pages — verified rendering correctly with real per-market data in a live browser. State hub pages get an honest generic branded card (no per-market score exists at state level, so none was fabricated). The interactive Mapbox map now has a server-rendered text companion describing the tool generically (sourced from `COVERAGE_COPY`, verified present in the DOM) since the map's _live selected state_ genuinely can't be described without fabrication. Remaining gap keeping this below 90: the map's canvas content itself is still invisible to non-JS crawlers (only the generic companion text is visible) — closing that fully would require a non-canvas fallback rendering of map data, which is a materially larger change than this pass scoped. |
| Authority & Brand Signals | 78     | 87    | Fixed a real, recurring bug: three sibling pages (`scores/methodology`, `scores/accuracy`, `compare/page.tsx`) computed `dateModified` live on every request (`new Date().toISOString()`), always claiming "modified today" — replaced with fixed dates from each file's actual last git commit. Blog posts now support a genuine optional `updated` frontmatter field instead of collapsing `dateModified` to `datePublished`. Founder `Person` schema gained a `sameAs` (per explicit user choice, pointed at the company LinkedIn page — a known semantic trade-off, not an oversight). **Capped below 90 by direct user instruction not to post to Reddit** — Reddit remains the single highest-leverage lever for ChatGPT/Perplexity citation and was explicitly excluded from this pass; Crunchbase/App Store `sameAs` and the Wikidata logo remain founder-gated per the entity-disambiguation playbook and weren't pursued as out of scope for this session.                                                                                                                                                                                                              |
| Technical Accessibility   | 88     | 93    | robots.txt now explicitly names `CCBot`, `anthropic-ai`, `Bytespider`, `cohere-ai` as training-bot groups (previously implicit via the wildcard only). `llms.txt`/`llms-full.txt` both gained a `_Last updated_` freshness line.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Result: 3 of 5 categories now clear 90 (Citability 90, Structural Readability 92, Technical Accessibility 93). Multi-Modal (82) and Authority (87) remain under 90 by explicit decision, not oversight or unfinished work:** asked directly, the user chose to accept Multi-Modal at 82 rather than build a non-canvas map fallback, and to accept Authority at 87 with Reddit staying inactive. Both are considered closed for this pass — the ceiling here is policy/scope, not engineering effort.

---

## Schema Recommendations

- Add `sameAs` to the founder `Person` node (`about/page.tsx`) — LinkedIn at minimum.
- Separate `dateModified` from `datePublished` for blog posts so genuine content updates are distinguishable from initial publish; stop computing methodology's `dateModified` as "always now" — set it only when the page's substantive content actually changes.
- Extend Organization `sameAs` to Crunchbase and App Store listings once they exist, per the entity-disambiguation playbook's own roadmap.
- If any video or infographic content is added (recommendation above), back it with `VideoObject`/`ImageObject` schema — none exists today beyond the single logo `ImageObject`.

## Content Reformatting Suggestions

- Where the 5 generic `OPENING_TEMPLATES` fire (no stats available), pull in a specific comparison point (e.g., nearest scored neighboring geography) instead of scene-setting language, to keep a citability floor even on thin-data markets.
- Wrap FAQ `<dt>` question text in heading elements (h3/h4, or visually-hidden headings if the visual design can't accommodate visible ones) so question-based structure is captured in the heading outline, not just in content.
- Treat the market-overview cache-warming gap (Top 5, #3) as a content fix, not just an engineering one — the fallback text should read as a genuine standalone paragraph, not a placeholder.

---

_Scope note: this audit is code/config-based (no live crawl simulation, no DataForSEO `ai_optimization_chat_gpt_scraper` check of what ChatGPT/Perplexity actually return for target PropertyIQ queries today). A follow-up live-check would validate whether the Reddit/Wikidata work has started showing up in AI answers yet._
