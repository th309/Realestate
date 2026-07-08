# PropertyIQ — GEO (Generative Engine Optimization) Analysis

**Site:** https://www.propertyiq.app · **Analyzed:** 2026-07-08 · **Method:** live-site fetch (robots.txt, llms.txt, sitemap, 10 pages), codebase audit (`packages/frontend`), brand-mention web search.

---

## 1. GEO Readiness Score: 68/100

| Dimension                 | Weight | Score | Weighted      |
| ------------------------- | ------ | ----- | ------------- |
| Citability                | 25%    | 72    | 18.0          |
| Structural readability    | 20%    | 75    | 15.0          |
| Multi-modal content       | 15%    | 55    | 8.3           |
| Authority & brand signals | 20%    | 40    | 8.0           |
| Technical accessibility   | 20%    | 92    | 18.4          |
| **Total**                 |        |       | **67.7 → 68** |

The technical foundation is in the top tier of what sites ship for AI search (explicit AI-crawler allowances, Content-Signal, llms.txt + llms-full.txt, `Accept: text/markdown` content negotiation, SSR/ISR everywhere, honest sitemap lastmod). The score is dragged down by **claim inconsistency across surfaces** and a **near-zero third-party brand footprint** in a namespace crowded with unrelated "PropertyIQ" companies.

## 2. Platform Breakdown

| Platform            | Score | Why                                                                                                                                                                              |
| ------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google AI Overviews | 78    | SSR + strong schema + top rankings for own-brand queries. Held back by stale index snippets (old "925 metros" / "0.37 IC" copy still served) and no FAQPage on 33k market pages. |
| Bing Copilot        | 70    | Bingbot explicitly allowed; good schema. No IndexNow detected.                                                                                                                   |
| ChatGPT             | 55    | GPTBot/OAI-SearchBot allowed and llms.txt is excellent, but ChatGPT leans on Wikipedia (47.9% of citations) — PropertyIQ has no Wikipedia/Wikidata presence.                     |
| Perplexity          | 48    | PerplexityBot allowed, but Perplexity leans on Reddit (46.7% of citations) — zero Reddit footprint found.                                                                        |

## 3. AI Crawler Access Status ✅

Source: `packages/frontend/app/robots.txt/route.ts` (dynamic route emitting text/plain).

| Crawler                                  | Status                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GPTBot, OAI-SearchBot, ChatGPT-User      | ✅ Explicitly allowed                                                                                                   |
| ClaudeBot, Claude-SearchBot, Claude-User | ✅ Explicitly allowed                                                                                                   |
| PerplexityBot                            | ✅ Explicitly allowed (`Perplexity-User` not named; falls under `*` allow)                                              |
| Bingbot, Google-Extended                 | ✅ Explicitly allowed                                                                                                   |
| CCBot, anthropic-ai, Bytespider          | ⚠️ Not named — fall under `*` (allowed to crawl)                                                                        |
| Content-Signal                           | `search=yes, ai-input=yes, ai-train=no` — **only on the `*` group**; the named AI-bot groups get no Content-Signal line |

**Gaps:**

- The stated intent (crawl yes, train no) is undermined for the named training bots: GPTBot/ClaudeBot/Google-Extended groups carry no `Content-Signal: ai-train=no`. A bot honoring its own named group never sees the training signal. Either add the signal line to every group or drop the named training-bot groups so they inherit `*`.
- If "no training" matters, block `CCBot` and `Bytespider` explicitly — Common Crawl is the main training-corpus vector and does not honor Content-Signal.
- No RSL 1.0 licensing terms (optional; Content-Signal partially covers intent).

## 4. llms.txt Status ⚠️ Present but drifting

`public/llms.txt` (4.5KB) and `public/llms-full.txt` (7.7KB) are hand-written static files with **no generation script** — and drift has already happened:

| Claim in llms.txt                         | Live site                                   | Verdict                                                           |
| ----------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| "Pro ($29/month)"                         | Pricing page + homepage JSON-LD: **$39/mo** | ❌ Stale — AI engines quoting llms.txt will state the wrong price |
| Coverage 900+/3,000+/29,000+              | Matches `COVERAGE_COPY` policy              | ✅                                                                |
| 4-input transparent formula, no black-box | Matches methodology                         | ✅ (homepage contradicts — see §6)                                |

**Fix:** generate llms.txt at build time from `lib/data/validation-claims.ts` (`COVERAGE_COPY`, `formatMarketsScored()`) + live pricing config, the same way `lib/agent-markdown/static-pages.ts` works. Otherwise every pricing/coverage change silently invalidates it.

## 5. Brand Mention Analysis ❌ Weakest dimension

| Platform             | Status                                                                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wikipedia / Wikidata | ❌ No presence                                                                                                                                                   |
| Reddit               | ❌ No discussions found for propertyiq.app                                                                                                                       |
| YouTube              | ⚠️ `@PropertyIQ_app` referenced in Organization sameAs; the "PropertyIQ" YouTube channel surfacing in search appears to be a different company                   |
| LinkedIn             | ⚠️ sameAs points to `linkedin.com/company/property-iq` — **verify this page is actually yours**; search results for that slug describe other PropertyIQ entities |

**Entity collision is the strategic risk.** The "PropertyIQ" namespace is occupied by unrelated companies: propertyiq.com.au (strata management software), property-iq.ai (property analysis app — likely the "PropertyIQ" iOS App Store listing), propertyiq.com (reviews.io-listed), "Property IQ" on Clutch. An LLM asked "What is PropertyIQ?" today will plausibly blend these entities. Mitigations:

1. Always co-mention brand + domain ("PropertyIQ (propertyiq.app)") in outreach, profiles, and citations — the llms.txt citation block already does this correctly.
2. Expand `Organization` sameAs (in `app/components/seo/OrganizationJsonLd.tsx`) to every profile you control: X/Twitter (`@propertyiq` is already in Twitter meta), Crunchbase, GitHub, App Store page if/when one exists — and remove/fix any sameAs URL you don't control (a sameAs pointing at another company's LinkedIn actively feeds the entity-confusion problem).
3. Create a Wikidata item (low bar vs. Wikipedia) declaring the entity: official website, industry, founding date, distinct-from the AU company.
4. Seed genuine Reddit presence (r/realestateinvesting, r/RealEstate market-data threads) — Perplexity's #1 citation source. Brand mentions correlate ~3× more with AI visibility than backlinks (Ahrefs, Dec 2025).

## 6. Passage-Level Citability

**Strong:**

- `/scores/methodology` — a numbered validation report (Executive Summary → What the Score Predicts → OOS Results → Permutation tests → Known Limitations) full of unique, citable statistics (IC +0.27 metro / +0.20 county / +0.20 ZIP; monotonic band separation). This is exactly the "original research" AI engines cite. Article + Person schema present.
- Market page titles are data-interpolated ("Boston, MA Housing Market: $742K Median, PropertyIQ Score 70 (2026)") — extremely extractable.
- 208 server-rendered MDX blog posts with Article schema, bylines, dates, comparison headings.
- Markdown content negotiation (`Accept: text/markdown` → raw markdown for blog posts, methodology, key static pages via `lib/agent-markdown/`) — a rare, forward-leaning GEO feature.

**Weak:**

- **Homepage contradicts the methodology.** Live hero copy: _"The PropertyIQ Score is built from 40+ metrics using machine learning, not opinions. Validated across 865 metros and 22 years of data."_ The methodology, llms.txt, and blog all say: 4 transparent inputs, equal weights, no fitted parameters. AI engines cross-check claims across a site; contradictions lower citation confidence and produce inconsistent AI answers. (Also: "865 metros" is a labeled-denominator number appearing unlabeled, and "machine learning" appears 10× on /about.) Rewrite to the canonical framing: _"built from four demand signals — Zillow price momentum plus Realtor.com days-on-market and price cuts — validated across two decades of out-of-sample data."_
- Market pages carry ~250–350 words of server-rendered templated prose; the most unique text (AI narrative in `MarketOverviewSection.tsx`) is client-fetched and **invisible to AI crawlers** (they don't execute JS). The score value itself IS in server HTML (title, Dataset JSON-LD, prose) — good.
- No 134–167-word self-contained answer blocks or question-based headings on market pages (the highest-volume page type, ~33k URLs).
- Stale Google index: snippets still serve retired "925 metros / 33,000+ ZIPs / 0.37 IC" claims from older page versions. Request reindexing of key pages in Search Console.

## 7. Server-Side Rendering Check ✅ (one gap)

- Homepage, /scores, /pricing, methodology, blog, market pages: server-rendered (App Router; market pages use `revalidate = 86400` ISR, first 150 pre-rendered, long tail on demand).
- Market pages' server HTML contains: data-rich title/meta, JSON-LD (Dataset, BreadcrumbList, Place, Article, Organization), stats table, H1, templated SEO prose section, "Market data through {Month Year}" provenance line.
- ❌ Not in server HTML: the AI-generated market narrative (client `useInsight` fetch) and live score widget internals. For AI crawlers, the richest per-market prose doesn't exist. Consider server-fetching the cached narrative (or a truncated first paragraph) into the ISR HTML.

## 8. Top 5 Highest-Impact Changes

1. **Fix the homepage/about claim contradiction** ("40+ metrics using machine learning" → the canonical 4-signal transparent-formula framing; label the 865-metro denominator). One copy edit; removes the biggest cross-page consistency red flag. Files: homepage hero/problem section components, /about page.
2. **Regenerate llms.txt from code constants** (pricing already wrong at $29 vs $39). Build-time script sourcing `validation-claims.ts` + pricing config; add to the monthly `seo:rebuild-slugs` flow so coverage numbers stay honest.
3. **Add a programmatic FAQ block (3–5 Q&As, each a 134–167-word self-contained answer) + FAQPage JSON-LD to the market page template.** One template edit propagates to ~33k pages: "Is {Metro} a good real estate market in 2026?", "What is {Metro}'s PropertyIQ Score?", "Are home prices rising in {Metro}?" — answers interpolate live score/median/DOM data, so they're unique per page.
4. **Server-render the AI market narrative** (or its first ~150 words) inside the ISR HTML on market pages instead of client-fetching it.
5. **Entity disambiguation campaign:** verify/fix the LinkedIn sameAs, add Wikidata item + full sameAs graph, adopt "PropertyIQ (propertyiq.app)" co-mention convention, and start earning Reddit/YouTube mentions (the two highest-correlation AI-citation sources).

## 9. Schema Recommendations

Current (verified live): Organization (sitewide), SoftwareApplication + WebSite + WebPage @graph (home), Dataset + BreadcrumbList + Place + Article (market pages), Article + Person (blog, methodology), FAQPage (/scores and /compare/\* only), CollectionPage (blog index).

Add:

- **FAQPage** on market pages (with the §8.3 content — schema without visible content is a violation; ship both).
- **Person** entities with `sameAs` for real authors. "PropertyIQ Research" as a pseudonymous author is a weak E-E-A-T/authority signal; even one named data-science author with a LinkedIn profile materially helps.
- **`priceValidUntil`/`offers` audit**: keep homepage SoftwareApplication offers ($39/$99) as the single source; llms.txt must match it (see §4).
- **Dataset on ZIP pages** if not already emitted (metro/county confirmed; ZIP follows the same pattern — verify).
- Consider **ClaimReview-style stats blocks** (or at minimum `citation` properties on the methodology Article) linking IC claims to the accuracy page.

## 10. Content Reformatting Suggestions

| Location                      | Current                                                     | Reformat to                                                                                                           |
| ----------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Homepage hero/problem section | "built from 40+ metrics using machine learning… 865 metros" | "built from four transparent demand signals… validated across 20+ years out-of-sample" (match methodology + llms.txt) |
| Market pages                  | Statement headings only                                     | Add "Is {Name} a good market to buy in 2026?" H2 with a 134–167-word direct answer opening with the verdict           |
| /scores/methodology           | Numbered report sections (great for depth)                  | Prepend a 40–60-word "What is the PropertyIQ Score?" definition block above section 1 for extraction                  |
| /about                        | "machine learning" ×10                                      | Reframe as "data science / validated quantitative signal" per canonical framing                                       |
| Blog posts                    | Good structure                                              | Add a "Key takeaways" 3-bullet block at top (extractable summary)                                                     |

---

_Statistics referenced: Ahrefs Dec 2025 brand-mention study (75k brands); platform citation-source distributions (ChatGPT: Wikipedia 47.9%, Reddit 11.3%; Perplexity: Reddit 46.7%); AI Overviews reach 1.5B users/mo. Analysis per seo-geo skill criteria (Feb 2026)._
