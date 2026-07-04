# SEO Rubric 05 — Search Appearance Core: Titles, Snippets & Structured-Data Foundations

> **Source of truth:** Google's own documentation at developers.google.com (Search Central). Every rule below cites the exact source URL.
> **Cluster:** SEARCH APPEARANCE CORE — title links, snippets/meta descriptions, structured-data foundations.
> **Compiled:** 2026-06-19. Verified against live docs.
>
> **Why this cluster matters for PropertyIQ:** We operate **33,000+ programmatic pages** (one per ZIP/county/metro) with **templated titles** like `{City} Housing Market — 2026 Analysis` and **templated meta descriptions**. The single biggest risk at this scale is **boilerplate / near-duplicate titles and descriptions**, which trigger Google to (a) **ignore and rewrite our `<title>`** and (b) treat pages as low-value. The single biggest structured-data risk is **marking up data that isn't visible on the page** — a manual-action-level violation. This file is the authoritative guardrail for both.
>
> **Severity legend:** 🔴 CRITICAL (causes rewrites, manual actions, or index suppression at scale) · 🟠 HIGH (materially hurts CTR/eligibility) · 🟡 MEDIUM (best practice, measurable upside) · ⚪ LOW (polish).

---

## SECTION A — TITLE LINKS (How Google Generates & Rewrites Titles)

**Primary source:** https://developers.google.com/search/docs/appearance/title-link

Google generates the **title link** from multiple sources — not just your `<title>`. Per Google, it considers: the content in the `<title>` element, **the main visual title shown on the page**, **heading elements such as `<h1>`**, other large/prominent text, anchor text pointing to the page, and on-page text. The `<title>` is the **primary** source but Google will override it when it judges the `<title>` to be a poor fit.

### A1. Every page must have a unique, descriptive `<title>` element 🔴

- **(a) Rule:** Give every one of the 33k pages its own non-empty, descriptive `<title>`; never leave it half-empty or generic ("Home", "PropertyIQ").
- **(b) WHY (Google):** Google rewrites titles when it finds **"Half-empty `<title>` elements"** — it then _"uses information in header elements or other large and prominent text on the page to produce a title link."_ You lose control of your most important SERP element.
- **(c) HOW:** Template must always interpolate the geography + intent, e.g. `Austin, TX Housing Market — 2026 Forecast & Data | PropertyIQ`. Fail the build if any page renders an empty/placeholder title.
- **(d) Source:** https://developers.google.com/search/docs/appearance/title-link
- **(e) Severity:** 🔴 CRITICAL

### A2. Do NOT ship boilerplate/duplicated titles across many pages — the #1 programmatic trap 🔴

- **(a) Rule:** The varying portion of the title must carry the page's distinguishing information; the boilerplate (brand, suffix) must be the _minority_ of the string.
- **(b) WHY (Google):** Google explicitly flags **"long text in the `<title>` element that varies by only a single piece of information"** (boilerplate titles) and **"Micro-boilerplate text"** where _"repeated boilerplate appears across a subset of pages with crucial distinguishing information missing."_ In Google's worked example, when a subset of pages share boilerplate and the season number is missing, _"Google can detect the season number used in large, prominent title text and insert the season number."_ For us this means Google may **detect the city from our H1 and rewrite our title** if our template is too boilerplate-heavy. The fix Google prescribes: _"dynamically update the `<title>` element to better reflect the actual content of the page."_
- **(c) HOW:** Ensure the city/metro/ZIP + a page-specific data point (e.g., current median value or YoY %) lead the title. Avoid 33k titles that differ only by one token buried after a long fixed prefix. Audit: pull all rendered titles, compute pairwise similarity, fail any cohort where >X% are near-identical.
- **(d) Source:** https://developers.google.com/search/docs/appearance/title-link
- **(e) Severity:** 🔴 CRITICAL (this is THE rule for our scale)

### A3. Keep titles accurate and current — avoid obsolete/inaccurate titles 🟠

- **(a) Rule:** The `<title>` must reflect what's actually on the page, including the correct year.
- **(b) WHY (Google):** Google rewrites **"Obsolete `<title>` elements"** — when _"page content updates but the `<title>` element doesn't reflect current information (e.g., outdated year). Google may detect this inconsistency and uses the right date from the visible title on the page."_ It also rewrites **"Inaccurate `<title>` elements"** when it _"tries to determine if the `<title>` element isn't accurately showing what a page is about."_
- **(c) HOW:** Our `2026` year token must be a single config-driven variable that updates the title, the H1, and the visible body together — never let the title say "2026" while the page body still shows last year's data. When we roll the year, roll all three atomically.
- **(d) Source:** https://developers.google.com/search/docs/appearance/title-link
- **(e) Severity:** 🟠 HIGH

### A4. Make the main on-page title unambiguous (title ↔ H1 relationship) 🟠

- **(a) Rule:** There must be one clearly-dominant on-page heading that matches the `<title>`'s intent; don't give multiple headings equal visual weight.
- **(b) WHY (Google):** When there's **"No clear main title"** (multiple headings of equal weight), _"Google may use the first heading as the text for the title link."_ Google's remedy: _"Make it clear which text is the main title for the page"_ by making the main title _"distinctive from other text"_ and ensuring it _"stands out as being the most prominent,"_ including _"putting the title text in the first visible `<h1>` element on the page."_
- **(c) HOW:** Exactly one `<h1>` per page, visually the largest text, semantically aligned with the `<title>` (e.g., H1 `Austin, TX Housing Market` ↔ title `Austin, TX Housing Market — 2026 Forecast | PropertyIQ`). Subheads are `<h2>`+.
- **(d) Source:** https://developers.google.com/search/docs/appearance/title-link
- **(e) Severity:** 🟠 HIGH

### A5. Brand the title concisely; place the site name at the start or end 🟡

- **(a) Rule:** Include "PropertyIQ" once, at the beginning or end, separated by a delimiter (hyphen, colon, or pipe). Don't repeat it.
- **(b) WHY (Google):** Best practice is to include the site name _"at the beginning or end of each `<title>`"_ with delimiters. Google also rewrites for **"Duplication of site name"** — it _"may omit the site name from the title link if it's repetitive"_ with the site name already shown in the SERP.
- **(c) HOW:** ` | PropertyIQ` suffix only — never `PropertyIQ Austin Housing Market | PropertyIQ`. Let Google's separately-displayed site name (see E3) carry the brand so we don't double it.
- **(d) Source:** https://developers.google.com/search/docs/appearance/title-link
- **(e) Severity:** 🟡 MEDIUM

### A6. Write for truncation; front-load the distinguishing info ⚪

- **(a) Rule:** Put the city/metro + key intent first; expect tails to be cut.
- **(b) WHY (Google):** _"The title link is truncated in Google Search results as needed, typically to fit the device width."_ There is no fixed character count — it's pixel/device-width based.
- **(c) HOW:** Geography + intent in the first ~50–60 chars; brand/year suffix is the part that may get dropped, which is acceptable.
- **(d) Source:** https://developers.google.com/search/docs/appearance/title-link
- **(e) Severity:** ⚪ LOW

### A7. Avoid keyword stuffing / repetitive terms in titles 🟡

- **(a) Rule:** Don't repeat the city or "real estate / housing market" multiple times to pad the title.
- **(b) WHY (Google):** Best practices call to _"Avoid keyword stuffing and repetitive terms"_ — it looks spammy and contributes to the boilerplate signal that triggers rewrites.
- **(c) HOW:** One mention of the geography, one of the topic. Let the body carry keyword variety.
- **(d) Source:** https://developers.google.com/search/docs/appearance/title-link
- **(e) Severity:** 🟡 MEDIUM

> **Full verbatim list of Google's title-rewrite triggers** (memorize for our audit): Half-empty `<title>` elements · Obsolete `<title>` elements · Inaccurate `<title>` elements · **Micro-boilerplate text in `<title>` elements** · No clear main title · Mismatch of writing system or language · Duplication of site name. (Source: title-link page, "Common issues and how Google manages them".)

---

## SECTION B — SNIPPETS & META DESCRIPTIONS

**Primary source:** https://developers.google.com/search/docs/appearance/snippet

### B1. Meta descriptions are NOT a ranking factor — but they shape the snippet and CTR 🟠

- **(a) Rule:** Treat the meta description as a marketing/CTR lever, not a ranking lever. Optimize it for click-through, not keywords.
- **(b) WHY (Google):** Google **automatically generates snippets primarily from page content** and _"sometimes uses the `<meta name="description">` element if it might give users a more accurate description of the page than content taken directly from the page."_ The same page can show **different snippets for different queries** because Google emphasizes content most relevant to each search. So the meta description is a _candidate_, not a guarantee — and it never moves rankings.
- **(c) HOW:** Don't keyword-stuff descriptions hoping for ranking lift (there is none). Write a human-readable summary that earns the click.
- **(d) Source:** https://developers.google.com/search/docs/appearance/snippet
- **(e) Severity:** 🟠 HIGH (misallocated effort otherwise)

### B2. Programmatic descriptions ARE allowed — but they must be unique & data-rich, not identical 🔴

- **(a) Rule:** Generate descriptions programmatically (Google encourages this for database-driven sites) **but inject page-specific data so no two are identical.**
- **(b) WHY (Google) — quote both halves:**
  - Permission: _"programmatic generation of the descriptions can be appropriate and are encouraged. Good descriptions are human-readable and diverse. Page-specific data is a good candidate for programmatic generation."_
  - Prohibition: _"Identical or similar descriptions on every page of a site aren't helpful when individual pages appear in search results."_
  - For our 33k pages, a description that differs only by city name and is otherwise word-for-word identical is exactly the "identical or similar" anti-pattern. Google's stated remedy is **"Page-specific data"** — real numbers per page.
- **(c) HOW:** Template must interpolate _live page data_, e.g. `Austin, TX home values rose 4.2% YoY to a $540K median with a PropertyIQ Score of 72. See 2026 forecast, rent, and migration data.` The numbers (`4.2%`, `$540K`, `72`) make each of the 33k descriptions genuinely distinct. Audit: dedupe descriptions; fail the build if distinctness ratio falls below threshold.
- **(d) Source:** https://developers.google.com/search/docs/appearance/snippet
- **(e) Severity:** 🔴 CRITICAL (our scale converts "similar descriptions" into a 33k-page liability)

### B3. Make each description accurate, specific, and self-contained 🟡

- **(a) Rule:** Description should accurately summarize that one page and include relevant specifics (data points, what the page offers).
- **(b) WHY (Google):** Good descriptions are _"human-readable and diverse"_; Google may swap in its own snippet if the meta description doesn't accurately describe the page. Accuracy increases the odds Google uses _your_ text.
- **(c) HOW:** Mirror the page's actual content; don't promise data the page lacks.
- **(d) Source:** https://developers.google.com/search/docs/appearance/snippet
- **(e) Severity:** 🟡 MEDIUM

### B4. Snippet-control directives — use deliberately, not by accident 🟠

- **(a) Rule:** Know and correctly apply the controls; do not let a global `nosnippet`/`max-snippet:0` leak onto content pages.
- **(b) WHY / WHAT (Google, verbatim directive names):**
  - **`nosnippet`** (robots meta tag): _"To prevent Google from displaying a snippet for your page in search results, use the `nosnippet` meta tag."_ (Zero snippet — usually undesirable for our SEO pages.)
  - **`max-snippet:[number]`** (robots meta tag): _"To specify the maximum length for your snippets, use the `max-snippet:[number]` meta tag."_ (`-1` = no limit; `0` = no snippet.)
  - **`data-nosnippet`** (HTML attribute): _"You can also prevent certain parts of the page from being shown in a snippet by using the `data-nosnippet` attribute"_ — apply to spans/sections you don't want surfaced (e.g., internal disclaimers, raw IDs).
  - **`max-image-preview:[setting]`** — NOTE: not documented on this snippet page; it lives in the **robots meta tag / crawl-controls** docs. Do not assume it from this page.
  - **`nositelinkssearchbox`** — also NOT on this page; governs the sitelinks search box (now deprecated, see D2). Don't conflate it with snippet controls.
- **(c) HOW:** For our SEO content pages we generally want NO `nosnippet`. Use `data-nosnippet` surgically to hide non-marketable fragments. Verify our default robots meta template never emits `nosnippet`/`max-snippet:0` site-wide.
- **(d) Source:** https://developers.google.com/search/docs/appearance/snippet
- **(e) Severity:** 🟠 HIGH (an accidental global directive could blank 33k snippets)

---

## SECTION C — STRUCTURED DATA: FOUNDATIONS & GENERAL GUIDELINES

**Primary sources:**

- Intro: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- General guidelines/policies: https://developers.google.com/search/docs/appearance/structured-data/sd-policies

### C1. ⭐ Structured data MUST represent content VISIBLE to the user — the cardinal rule 🔴

- **(a) Rule:** Only mark up information that a human can actually see on the rendered page. Never add markup-only data, hidden data, or data on a blank page.
- **(b) WHY (Google) — quote verbatim, this is load-bearing:**
  - From the intro: _"Structured data on the page describes the content of that page. Don't create blank or empty pages just to hold structured data, and don't add structured data about information that is not visible to the user, even if the information is accurate."_
  - From the general guidelines: _"Don't mark up content that is not visible to readers of the page. For example, if the JSON-LD markup describes a performer, the HTML body must describe that same performer."_
  - And: _"Your structured data must be a true representation of the page content."_
- **(c) HOW for PropertyIQ:** For each page, the JSON-LD may only assert numbers/facts that are _also rendered visibly_ on that page. If we emit a `Dataset`, `Place`, or `aggregateRating`-style value in JSON-LD, the same value must appear in the visible body. **Never** stuff our full metric database into JSON-LD while the page only shows three cards — that is markup-only data and a violation. The structured-data builder must read from the _same_ rendered view-model the page renders.
- **(d) Source:** intro-structured-data + sd-policies (both quoted above)
- **(e) Severity:** 🔴 CRITICAL (manual-action class — see C6)

### C2. Eligibility ≠ guarantee 🟡

- **(a) Rule:** Valid structured data makes a page _eligible_ for a rich result; it does not guarantee one will show.
- **(b) WHY (Google):** _"You must include all the required properties for an object to be eligible for appearance in Google Search with enhanced display."_ Eligibility opens the door — Google decides at query time whether to render the rich result.
- **(c) HOW:** Don't promise stakeholders guaranteed rich results from shipping schema; treat it as a probability lift. Monitor actual appearances in Search Console.
- **(d) Source:** https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- **(e) Severity:** 🟡 MEDIUM (expectation-setting)

### C3. Use JSON-LD; it scales 🟡

- **(a) Rule:** Author all structured data as JSON-LD in a `<script type="application/ld+json">` block.
- **(b) WHY (Google):** JSON-LD _"doesn't interleave with the visible text"_ and is _"the easiest solution for website owners to implement and maintain at scale"_ — exactly our 33k-page situation. (Microdata and RDFa are also supported but discouraged for us.)
- **(c) HOW:** Generate the JSON-LD object server-side from the page view-model so it stays in lockstep with visible content (satisfies C1 by construction).
- **(d) Source:** intro-structured-data + sd-policies ("mark up your site's pages using one of three supported formats: JSON-LD (recommended), Microdata, RDFa")
- **(e) Severity:** 🟡 MEDIUM

### C4. Don't block structured-data pages from Googlebot 🟠

- **(a) Rule:** Pages carrying structured data must be crawlable and indexable.
- **(b) WHY (Google):** _"Don't block your structured data pages to Googlebot using robots.txt, `noindex`, or any other access control methods."_ If Google can't crawl/render the page, it can't read or trust the markup.
- **(c) HOW:** Verify our 33k SEO pages are not behind robots.txt disallow, `noindex`, or auth walls. (Cross-check with the crawl/index rubric.)
- **(d) Source:** https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- **(e) Severity:** 🟠 HIGH

### C5. Be relevant, complete, correctly located, and specific 🟡

- **(a) Rule:** Mark up only relevant content; include all required properties; put the markup on the page it describes; use the most specific schema.org type.
- **(b) WHY (Google):**
  - Relevance/misleading: _"Don't mark up irrelevant or misleading content, such as fake reviews or content unrelated to the focus of a page."_
  - Completeness: _"Specify all required properties listed in the documentation for your specific rich result type."_
  - Location: _"Put the structured data on the page that it describes, unless specified otherwise."_
  - Specificity: _"Use the most specific applicable type and property names defined by schema.org."_
- **(c) HOW:** For market pages prefer specific types (`Dataset`, `Place`, `BreadcrumbList`, `Organization`) over vague `Thing`. Put a market's markup on that market's page, not a hub page. Include every required property for whichever rich-result type we target.
- **(d) Source:** https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- **(e) Severity:** 🟡 MEDIUM

### C6. ⭐ Structured-data violations → MANUAL ACTION (loss of rich-result eligibility) 🔴

- **(a) Rule:** Violating the content/quality guidelines (esp. C1, fake reviews, deceptive/impersonation markup) risks a manual action.
- **(b) WHY (Google) — quote verbatim:**
  - _"If your page contains a structured data issue, it can result in a manual action. A structured data manual action means that a page loses eligibility for appearance as a rich result; it doesn't affect how the page ranks in Google web search."_
  - Deception prohibition: _"Don't use structured data to deceive or mislead users. Don't impersonate any person or organization, or misrepresent your ownership, affiliation, or primary purpose."_
  - Also must _"Follow the spam policies for Google web search"_ and the _"Content policies for Google Search."_
- **(c) HOW:** Never fabricate `aggregateRating`/`review` markup we don't display; never assert affiliations we don't have. Treat the Search Console "Manual Actions" report as a release gate after any schema change.
- **(d) Source:** https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- **(e) Severity:** 🔴 CRITICAL

### C7. Test before and monitor after 🟡

- **(a) Rule:** Validate with the Rich Results Test pre-deploy; monitor with the rich-result status reports + URL Inspection post-deploy.
- **(b) WHY (Google):** Google's three steps to eligibility: pick a feature → validate with Rich Results Test → deploy and monitor with URL Inspection + Performance reports.
- **(c) HOW:** Add a CI check that runs a representative sample of our 33k page types through schema validation; alert on regressions in the Search Console rich-result report.
- **(d) Source:** https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- **(e) Severity:** 🟡 MEDIUM

---

## SECTION D — RICH RESULT TYPES: WHAT EXISTS & WHAT'S DEPRECATED

**Primary source (gallery):** https://developers.google.com/search/docs/appearance/structured-data/search-gallery

### D1. Currently-supported rich result types (full gallery)

Article · Breadcrumb · Carousel (host: Recipe/Course/Restaurant/Movie) · Course list · **Dataset** (Google Dataset Search) · Discussion forum · Education Q&A · Employer aggregate rating · Event · Image metadata · Job posting · Local business · Math solver · Movie · **Organization** · Product · **Profile page** · Q&A · Recipe · Review snippet · Software app · Speakable · Subscription & paywalled content · Vacation rental · Video.

### D2. ⚠️ DEPRECATED / RETIRED / SEVERELY LIMITED — do NOT invest here 🔴

- **How-to:** **DEPRECATED.** _"How-to structured data documentation was removed as this rich result is no longer shown in search results, on both desktop and mobile."_ Do not add `HowTo` markup expecting a rich result.
- **FAQ:** **EFFECTIVELY DEAD.** First limited to _"only well-known, authoritative websites that are government-focused or health-focused"_ — which **excludes a real-estate SaaS like us.** Then: _"as of May 7, 2026, FAQ rich results are no longer appearing in Google Search, and Google will be dropping the FAQ search appearance, rich result report, and support in the Rich Results Test in June 2026."_ **Conclusion: do not rely on FAQ structured data for rich results.** (You may still keep `FAQPage` markup for semantic/AI-citation reasons, but expect zero SERP rich result.)
- **Sitelinks search box (`nositelinkssearchbox` / `SearchAction` markup):** the dedicated sitelinks-search-box feature has been **deprecated**; markup is no longer required to influence it. Don't build new work around it.
- **(d) Sources:** https://developers.google.com/search/docs/appearance/structured-data/search-gallery · https://developers.google.com/search/docs/appearance/structured-data/faqpage
- **(e) Severity:** 🔴 CRITICAL (prevents wasted dev effort on dead features)

### D3. Recommended types for PropertyIQ's market/data pages 🟡

- **Breadcrumb (`BreadcrumbList`)** — surfaces our `State › Metro › County › ZIP` hierarchy in the SERP. Low-risk, high-value, fully supported.
- **Organization** — site-wide brand entity (logo, legal name, contact, sameAs). Powers the knowledge panel & site name.
- **Dataset** — strong candidate for our market-data pages _if_ the data is genuinely visible and downloadable/queryable per C1; gets us into Google Dataset Search.
- **Profile page / Q&A** — only if we render real author profiles or genuine Q&A visibly.
- **Avoid:** Review snippet / aggregateRating unless we display real, first-party reviews (fabrication = C6 manual action). FAQ/How-to — dead (D2).
- **(d) Source:** search-gallery (cross-referenced with C1/C6)
- **(e) Severity:** 🟡 MEDIUM

---

## SECTION E — OTHER SERP VISUAL ELEMENTS (Influence Map)

**Sources:** https://developers.google.com/search/docs/appearance/visual-elements-gallery · https://developers.google.com/search/docs/appearance/sitelinks · https://developers.google.com/search/docs/appearance/favicon-in-search

### E1. Sitelinks are fully automated — you cannot hand-pick them 🟡

- **(a) Rule:** Don't try to mark, demote, or specify individual sitelinks; influence them only via site quality signals.
- **(b) WHY (Google):** _"At the moment, sitelinks are automated."_ There is no mechanism to manually specify them. To remove an unwanted sitelink you must remove the page or `noindex` it.
- **(c) HOW:** Earn good sitelinks via: _"informative, relevant, and compact"_ titles/headings; a logical, easy-to-navigate site structure; internal links to important pages with _"concise and relevant"_ anchor text; and avoiding content repetition. (Our internal-linking between state→metro→county→ZIP directly feeds this.)
- **(d) Source:** https://developers.google.com/search/docs/appearance/sitelinks
- **(e) Severity:** 🟡 MEDIUM

### E2. Favicon: one per host, on the home page, crawlable, brand-representative 🟡

- **(a) Rule:** Declare a `<link rel="icon">` on the **home page**; it must be square, ≥48×48px recommended, crawlable, and represent our brand.
- **(b) WHY (Google):** Google supports _"one favicon per site, where a site is defined by the hostname."_ It must be _"a square (1:1 aspect ratio)"_ (recommend _">48×48px"_); _"Googlebot-Image must be able to crawl the favicon file and Googlebot must be able to crawl the home page; they cannot be blocked."_ It _"must be visually representative of your website's brand"_ and _"isn't guaranteed to appear ... even if all guidelines are met."_
- **(c) HOW:** Ensure the PropertyIQ favicon link is in the home-page `<head>`, the icon URL and home page aren't robots-blocked, and the asset is ≥48px square.
- **(d) Source:** https://developers.google.com/search/docs/appearance/favicon-in-search
- **(e) Severity:** 🟡 MEDIUM

### E3. Site name & breadcrumb are structured-data-driven; date & domain are automatic ⚪

- **(a) Rule:** Provide site name + breadcrumb via structured data; accept that byline date, domain, and visible URL are auto-derived.
- **(b) WHY (Google, visual-elements-gallery):** **Site name** — _"Learn how to provide a site name with structured data"_ (`Organization`/`WebSite`). **Breadcrumb** — _"specified via Breadcrumb markup."_ **Byline date** — _"the date that Google estimates the web page was updated or published"_ (you can supply explicit dates in metadata). **Domain/visible URL** — automatic from URL structure.
- **(c) HOW:** Ship `WebSite`/`Organization` for site name and `BreadcrumbList` for the geo hierarchy; expose explicit publish/update dates in page metadata so the byline date is accurate.
- **(d) Source:** https://developers.google.com/search/docs/appearance/visual-elements-gallery
- **(e) Severity:** ⚪ LOW

---

## APPENDIX — PropertyIQ 33k-Page Pre-Flight Checklist (derived from rules above)

| #   | Gate                                                                                        | Rule  | Severity |
| --- | ------------------------------------------------------------------------------------------- | ----- | -------- |
| 1   | No page renders an empty/placeholder `<title>`                                              | A1    | 🔴       |
| 2   | Titles lead with geography + a page-specific data point; boilerplate suffix is the minority | A2    | 🔴       |
| 3   | Year token updates title + H1 + body atomically                                             | A3    | 🟠       |
| 4   | Exactly one dominant `<h1>` per page, aligned to `<title>`                                  | A4    | 🟠       |
| 5   | Brand "PropertyIQ" once, at start/end, not duplicated                                       | A5    | 🟡       |
| 6   | Meta descriptions interpolate LIVE per-page numbers → no two identical                      | B2    | 🔴       |
| 7   | No accidental site-wide `nosnippet` / `max-snippet:0`                                       | B4    | 🟠       |
| 8   | JSON-LD asserts ONLY values also visible on the rendered page                               | C1    | 🔴       |
| 9   | No fabricated reviews/ratings/affiliations in markup                                        | C6    | 🔴       |
| 10  | SEO pages crawlable + indexable (no robots/noindex block)                                   | C4    | 🟠       |
| 11  | Schema validated in CI (Rich Results Test); Manual Actions report is a release gate         | C6/C7 | 🟠       |
| 12  | No new investment in How-to or FAQ rich results (deprecated/dead by Jun 2026)               | D2    | 🔴       |
| 13  | Use Breadcrumb + Organization (+ Dataset if data is visible)                                | D3    | 🟡       |
| 14  | Internal linking + clean titles to earn good (automated) sitelinks                          | E1    | 🟡       |
| 15  | Home-page favicon: square, ≥48px, crawlable, brand-representative                           | E2    | 🟡       |

---

### Source URLs (canonical)

- Title link: https://developers.google.com/search/docs/appearance/title-link
- Snippet / meta description: https://developers.google.com/search/docs/appearance/snippet
- Intro to structured data: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- Structured data general guidelines (policies): https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- Search gallery (rich result types): https://developers.google.com/search/docs/appearance/structured-data/search-gallery
- FAQ deprecation note: https://developers.google.com/search/docs/appearance/structured-data/faqpage
- Sitelinks: https://developers.google.com/search/docs/appearance/sitelinks
- Favicon in search: https://developers.google.com/search/docs/appearance/favicon-in-search
- Visual elements gallery: https://developers.google.com/search/docs/appearance/visual-elements-gallery
