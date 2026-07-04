# Google SEO Rubric — Cluster 1: Foundations, Content Quality (E-E-A-T / Helpful Content), Spam Policies

> **Source of authority:** Google Search Central documentation at `developers.google.com` (read 2026-06-19).
> **Applied to:** PropertyIQ — a real-estate market-data SaaS publishing **33,000+ programmatically generated location pages** (US states, metros, counties, ZIPs), each filled with data. Real estate is a **YMYL (Your Money or Your Life)** domain (finances), so the E-E-A-T bar is high.
>
> **How to read this file:** Each rule is a checklist item with `(a)` the rule, `(b)` WHY per Google, `(c)` HOW to implement on a 33k programmatic site, `(d)` source URL, `(e)` severity if violated. Verbatim Google wording is in quotes.
>
> **Severity key:** **Critical** = can deindex / kill the page or whole site • **High** = strong ranking suppression or partial deindex • **Medium** = lost opportunity / weakened ranking • **Low** = polish.

---

## The single most important framing for a 33k-page programmatic site

Google does **not** ban automation or AI. The line is **value at scale**, restated verbatim:

> "Scaled content abuse is when many pages are generated for the primary purpose of manipulating search rankings and not helping users. This abusive practice is typically focused on creating large amounts of **unoriginal content that provides little to no value to users, no matter how it's created**." — Spam Policies

The phrase **"no matter how it's created"** is the load-bearing clause: programmatic generation is fine _if_ each page provides genuine, distinct value to a real user. The 33k-page strategy survives or dies on whether each location page answers a real question a real investor/agent/buyer would type, with data and analysis they cannot trivially get elsewhere. Treat every rule below through that lens.

---

## SECTION A — TECHNICAL ELIGIBILITY (the bare minimum to appear at all)

> "The technical requirements cover the bare minimum that Google Search needs from a web page in order to show it in search results." — Search Essentials

- [ ] **A1. Googlebot must not be blocked.**
  - (a) Every indexable location page must be reachable by Googlebot — not blocked by `robots.txt` or other access control.
  - (b) "Googlebot isn't blocked" and can "find and access the page." Pages blocked by robots.txt are unlikely to appear in results. Google also can't crawl when there are "robots.txt rules preventing Googlebot's access to the page."
  - (c) Audit `robots.txt` so `/state/`, `/metro/`, `/county/`, `/zip/` path prefixes are crawlable. Do **not** robots-block pages you want indexed (blocking ≠ noindex). For structured-data pages: "Don't block your structured data pages to Googlebot using robots.txt, `noindex`, or any other access control methods."
  - (d) https://developers.google.com/search/docs/essentials/technical
  - (e) **Critical**

- [ ] **A2. Return HTTP `200 (success)`.**
  - (a) Each live location URL must serve a `200`. Soft-404s (thin "no data" pages that still return 200) are a trap — see C-section.
  - (b) The page must return an "HTTP `200 (success)` status code." "Error pages (4xx, 5xx) won't be indexed."
  - (c) For ZIPs/counties with no/insufficient data, return a real `404`/`410` (or `noindex`) rather than a 200 shell. Monitor for soft-404s in Search Console.
  - (d) https://developers.google.com/search/docs/essentials/technical
  - (e) **Critical**

- [ ] **A3. Indexable content type + no `noindex` on pages you want indexed.**
  - (a) Page content must be in "a file type that Google Search supports" and must not carry a `noindex` robots rule (unless intentionally excluded).
  - (b) "Using the `noindex` directive prevents indexing even if Googlebot can crawl the page." Indexing failures also come from "Robots `meta` rules disallow indexing."
  - (c) Use `noindex` deliberately and at scale: thin/empty-data pages get `noindex`; rich pages do not. Make this a data-driven gate in the page template (see C2).
  - (d) https://developers.google.com/search/docs/essentials/technical
  - (e) **Critical**

- [ ] **A4. Content must be visible to Googlebot after JS rendering.**
  - (a) The data and analysis on each page must be present in the rendered DOM Googlebot sees, not hidden behind un-rendered client-only fetches.
  - (b) Google "renders the page and runs any JavaScript it finds" using Chrome, because "websites often rely on JavaScript to bring content to the page." But rendering is not guaranteed to capture everything, and "the design of the website might make indexing difficult."
  - (c) Server-render (SSR/SSG) the core data tables, headings, and narrative for each location page so the substance is in HTML. Don't gate the primary content behind interactions or auth. (This site uses Next.js App Router — prefer SSR/SSG for these public pages.)
  - (d) https://developers.google.com/search/docs/fundamentals/how-search-works
  - (e) **High**

- [ ] **A5. Content must not violate the spam policies (eligibility gate).**
  - (a) Indexable content "doesn't violate our spam policies."
  - (b) "To be eligible to appear in Google web search results, content … shouldn't violate Google Search's overall policies or the spam policies." "Sites that violate our policies may rank lower in results or not appear in results at all."
  - (c) Pass every Section C check before publishing a page template at scale.
  - (d) https://developers.google.com/search/docs/essentials/spam-policies
  - (e) **Critical**

- [ ] **A6. Eligibility ≠ guarantee — design for quality, not just compliance.**
  - (a) Meeting A1–A5 makes a page _eligible_, not indexed/ranked.
  - (b) "Indexing isn't guaranteed; not every page that Google processes will be indexed." "Google doesn't guarantee that it will crawl, index, or serve your page, even if your page follows the Google Search Essentials." Pages don't get indexed when "the quality of the content on [the] page is low."
  - (c) Don't assume 33k submitted URLs = 33k indexed URLs. Track index coverage in Search Console; expect Google to drop low-value pages. Prioritize quality density over raw page count.
  - (d) https://developers.google.com/search/docs/fundamentals/how-search-works
  - (e) **High**

---

## SECTION B — SPAM POLICIES (the lines a programmatic site must not cross)

> Intro, verbatim: "We detect policy-violating practices both through automated systems and, as needed, human review that can result in a manual action. Sites that violate our policies may rank lower in results or not appear in results at all." — Spam Policies

- [ ] **B1. SCALED CONTENT ABUSE — the #1 risk for this site.**
  - (a) Do not generate many location pages "for the primary purpose of manipulating search rankings and not helping users." Every page must add genuine value.
  - (b) Verbatim: "Scaled content abuse is when many pages are generated for the primary purpose of manipulating search rankings and not helping users. This abusive practice is typically focused on creating large amounts of unoriginal content that provides little to no value to users, no matter how it's created." Triggers explicitly include: "Using generative AI tools or other similar tools to generate many pages without adding value for users"; "Scraping feeds, search results, or other content to generate many pages (including through automated transformations like synonymizing, translating, or other obfuscation techniques)"; "Stitching or combining content from different web pages without adding value"; "Creating multiple sites with the intent of hiding the scaled nature of the content"; "Creating many pages where the content makes little or no sense to a reader but contains search keywords." Remedy verbatim: "If you're hosting such content on your site, exclude it from Search."
  - (c) Concrete compliance tactics for 33k pages:
    - Each page must carry **distinct, location-specific data + analysis**, not a swapped place-name on an identical paragraph. Vary the _substance_, not just the noun.
    - Add genuinely useful synthesis Google can't get from a raw feed: the PropertyIQ Score + its drivers, trend narrative, comparisons to state/national, forecasts, rankings — analysis layered on top of the data, not a reprint of Zillow/Realtor feeds.
    - **Do NOT** mass-publish ZIP pages whose only difference is the place name and a couple of numbers, where "the content makes little or no sense to a reader but contains search keywords."
    - **Do NOT** "synonymize"/spin a base template across geographies — that is named verbatim as obfuscation.
    - Gate publication on data sufficiency (B-thresholds): if a ZIP has too few data points to say anything useful, exclude it from Search (`noindex` or don't generate).
  - (d) https://developers.google.com/search/docs/essentials/spam-policies
  - (e) **Critical**

- [ ] **B2. DOORWAY ABUSE — don't create near-duplicate pages that just funnel.**
  - (a) Don't create "sites or pages … created to rank for specific, similar search queries" that are substantially similar and exist mainly to funnel users to one destination.
  - (b) Verbatim: "Doorway abuse is when sites or pages are created to rank for specific, similar search queries." Triggers: "Multiple websites with URL variations targeting specific queries"; "Pages generated specifically to funnel visitors elsewhere"; "Substantially similar pages closer to search results than [a] browseable hierarchy."
  - (c) Each geography level (state/metro/county/ZIP) must be a genuine destination with its own value, not a thin landing page whose real purpose is to push to signup/checkout. Build a real browseable hierarchy (state → metros → counties → ZIPs) with internal links, not 33k flat funnels.
  - (d) https://developers.google.com/search/docs/essentials/spam-policies
  - (e) **High**

- [ ] **B3. THIN AFFILIATION / no-added-value reprints.**
  - (a) Don't publish pages where descriptions/data are "copied directly from the original merchant [data source] without any original content or added value" or use "cookie-cutter" templated content.
  - (b) Verbatim: "Thin affiliation is the practice of publishing content with product affiliate links where the product descriptions and reviews are copied directly from the original merchant without any original content or added value." Problematic when "distributed across a network of affiliates without providing additional value" or using "cookie-cutter"/templated content.
  - (c) Although PropertyIQ isn't an affiliate, the principle binds: don't reprint third-party feeds (Zillow/Realtor/Census/FRED) verbatim across thousands of pages. The proprietary scoring, narrative, and cross-market analysis is the "added value" that distinguishes these pages.
  - (d) https://developers.google.com/search/docs/essentials/spam-policies
  - (e) **High**

- [ ] **B4. AUTO-GENERATED / templated content is judged under Scaled Content Abuse.**
  - (a) Automation is not a separate sin; auto-generated content is fine when it adds value and a violation only when it generates "many pages without adding value."
  - (b) Google does not list "auto-generated content" as a standalone policy; it is covered under "Scaled content abuse" when automated tools generate "many pages without adding value." Value addition is the determinative factor.
  - (c) Keep the generation pipeline, but make value the gate: per-page real data, real analysis, real internal linking, and exclusion of empty geographies.
  - (d) https://developers.google.com/search/docs/essentials/spam-policies
  - (e) **High**

- [ ] **B5. CLOAKING — show Googlebot the same content as users.**
  - (a) Never serve different content/markup to Googlebot than to human visitors.
  - (b) Verbatim: "Cloaking refers to the practice of presenting different content to users and search engines with the intent to manipulate search rankings and mislead users," including "Inserting text or keywords into a page only when the user agent … is a search engine, not a human visitor."
  - (c) SSR the same data and headings users see. Don't inject extra keyword-laden text for crawlers, and don't paywall/blur the primary content for users while exposing it to Googlebot.
  - (d) https://developers.google.com/search/docs/essentials/spam-policies
  - (e) **Critical**

- [ ] **B6. HIDDEN TEXT/LINKS and KEYWORD STUFFING — no place-name/keyword dumps.**
  - (a) No hidden text (white-on-white, off-screen, opacity 0, font-size 0) and no stuffing pages with city/region/keyword lists "in an attempt to manipulate rankings."
  - (b) Hidden text verbatim: "the practice of placing content on a page in a way solely to manipulate search engines and not to be easily viewable by human visitors." Keyword stuffing verbatim: "filling a web page with keywords or numbers in an attempt to manipulate rankings," with named examples including "Blocks of cities/regions targeted for ranking" and "Lists of phone numbers without value."
  - (c) High-risk for geo pages: do **not** append "homes for sale in [City], [City], [City]…" lists or stuff ZIP/county names. Write natural, readable prose. Keep numbers meaningful, not padded.
  - (d) https://developers.google.com/search/docs/essentials/spam-policies
  - (e) **High**

- [ ] **B7. SNEAKY REDIRECTS — none, especially mobile-vs-desktop.**
  - (a) Don't redirect users to content different from what was indexed, or send mobile users somewhere desktop users don't go.
  - (b) Verbatim: "Sneaky redirecting is the practice of doing this maliciously in order to either show users and search engines different content or show users unexpected content," e.g., "Desktop users see normal pages; mobile users redirected to spam domains."
  - (c) Keep redirects honest (301 for moved geographies, consistent across devices). Don't redirect indexed geo pages to signup.
  - (d) https://developers.google.com/search/docs/essentials/spam-policies
  - (e) **High**

- [ ] **B8. SITE REPUTATION ABUSE — guard third-party/UGC content.**
  - (a) Don't let third parties publish content on the domain primarily to ride PropertyIQ's earned ranking signals.
  - (b) Verbatim: "Site reputation abuse is a tactic where third-party content is published on a host site mainly because of that host's already-established ranking signals, which it has earned primarily from its first-party content" (e.g., a medical site hosting unrelated third-party casino content).
  - (c) Low risk today (pages are first-party), but if PropertyIQ ever opens guest posts, sponsored placements, or UGC, apply close oversight and don't host unrelated third-party content for ranking leverage.
  - (d) https://developers.google.com/search/docs/essentials/spam-policies
  - (e) **Medium**

- [ ] **B9. EXPIRED DOMAIN ABUSE — N/A but documented.**
  - (a) Don't buy expired domains to repurpose their authority for low-value content.
  - (b) Verbatim: "Expired domain abuse is where an expired domain name is purchased and repurposed primarily to manipulate search rankings by hosting content that provides little to no value."
  - (c) Not applicable to the primary domain; relevant only if acquiring domains for geo microsites — don't.
  - (d) https://developers.google.com/search/docs/essentials/spam-policies
  - (e) **Low**

- [ ] **B10. MACHINE-GENERATED TRAFFIC — don't scrape Google for rank-checking.**
  - (a) Don't send automated queries to Google Search without permission.
  - (b) Verbatim: "Machine-generated traffic … refers to the practice of sending automated queries to Google. This includes scraping results for rank-checking purposes or other types of automated access to Google Search conducted without express permission."
  - (c) Use Search Console / approved APIs for rank/coverage monitoring, not scrapers.
  - (d) https://developers.google.com/search/docs/essentials/spam-policies
  - (e) **Medium**

---

## SECTION C — HELPFUL, RELIABLE, PEOPLE-FIRST CONTENT (the quality bar)

> Google's #1 key best practice, verbatim: "Create helpful, reliable, people-first content." — Search Essentials

### C1 — People-first self-assessment (aim for "yes" on every one)

For the location-page template, each must be able to answer YES:

- [ ] **C1a.** "Do you have an existing or intended audience for your business or site that would find the content useful if they came directly to you?" → Real audience: investors, agents, buyers researching a market.
- [ ] **C1b.** "Does your content clearly demonstrate first-hand expertise and a depth of knowledge?" → Show the proprietary methodology, score derivation, and analysis depth.
- [ ] **C1c.** "Does your site have a primary purpose or focus?" → Real-estate market intelligence.
- [ ] **C1d.** "After reading your content, will someone leave feeling they've learned enough about a topic to help achieve their goal?" → A reader should understand the market without searching again.
- [ ] **C1e.** "Will someone reading your content leave feeling like they've had a satisfying experience?"
  - (b) WHY: These are Google's published people-first questions; answering "yes" signals people-first alignment.
  - (d) https://developers.google.com/search/docs/fundamentals/creating-helpful-content
  - (e) **High** (whole-site quality signal)

### C2 — "Search-engine-first" red flags (each YES is a programmatic-site landmine — aim for NO)

- [ ] **C2a.** Avoid: "Is the content primarily made to attract visits from search engines?" — The #1 risk for 33k geo pages.
- [ ] **C2b.** Avoid: "Are you producing lots of content on many different topics in hopes that some of it might perform well in search results?"
- [ ] **C2c.** Avoid: "Are you using extensive automation to produce content on many topics?" — Directly names this site's pipeline; mitigate by ensuring each page has real value (B1/B4).
- [ ] **C2d.** Avoid: "Are you mainly summarizing what others have to say without adding much value?" — Don't reprint feeds (B3).
- [ ] **C2e.** Avoid: "Does your content leave readers feeling like they need to search again to get better information?"
- [ ] **C2f.** Avoid: "Are you writing to a particular word count because you've heard or read that Google has a preferred word count?" (Note: "The length of the content alone doesn't matter for ranking purposes.")
- [ ] **C2g.** Avoid: "Did you decide to enter some niche topic area without any real expertise?"
- [ ] **C2h.** Avoid: "Are you changing the date of pages to make them seem fresh when the content has not substantially changed?" — Relevant: only bump `dateModified` when the underlying data actually changes (monthly pipeline).
- [ ] **C2i.** Avoid: "Are you adding a lot of new content or removing a lot of older content primarily because you believe it will help your search rankings?"
  - (b) WHY: Google publishes these as signs of search-engine-first content that the helpful-content systems demote.
  - (c) HOW: Generate a geo page only when there is enough fresh, location-specific data to answer the user's question; update dates only on real data refresh; never publish a geo just to chase a keyword.
  - (d) https://developers.google.com/search/docs/fundamentals/creating-helpful-content
  - (e) **High**

### C3 — Thin-content / data-sufficiency gate (operational rule derived from C2 + B1)

- [ ] **C3.** Gate every programmatic page on a minimum data + analysis threshold; `noindex` or skip pages that fall below it.
  - (b) WHY: Pages aren't indexed/served when "the quality of the content on [the] page is low," and mass thin pages trigger scaled content abuse. "Content length alone doesn't matter," but substance does.
  - (c) HOW: Define a per-geo-level minimum (e.g., N populated metrics + a valid PropertyIQ Score + a generated narrative). ZIPs/counties with sparse data get excluded from Search, not shipped as 200 shells.
  - (d) https://developers.google.com/search/docs/fundamentals/creating-helpful-content + https://developers.google.com/search/docs/fundamentals/how-search-works
  - (e) **Critical** (this is the practical defense against B1)

---

## SECTION D — E-E-A-T & YMYL (real estate = "Your Money or Your Life")

> Google: E-E-A-T = "Experience, Expertise, Authoritativeness, and Trustworthiness," with **trust paramount**, and these factors "carry particular weight for 'Your Money or Your Life' (YMYL) topics affecting health, finances, safety, or societal welfare." Real-estate market/financial guidance is YMYL — the bar is high. (Note Google's nuance: E-E-A-T is not a single direct "ranking factor," but its signals are what the systems aim to reward.)

### D1 — WHO created the content

- [ ] **D1a.** "Is it self-evident to your visitors who authored your content?"
- [ ] **D1b.** "Do pages carry a byline, where one might be expected?"
- [ ] **D1c.** "Do bylines lead to further information about the author or authors involved?"
  - (c) HOW: Attribute geo pages/analysis to PropertyIQ (the org) and/or named analysts; add an "About / methodology / team" page that bylines link to. Make authorship/ownership self-evident.
  - (d) https://developers.google.com/search/docs/fundamentals/creating-helpful-content
  - (e) **High** (YMYL)

### D2 — HOW the content was created (automation disclosure)

- [ ] **D2a.** "Is the use of automation, including AI-generation, self-evident to visitors?"
- [ ] **D2b.** "Are you providing background about how automation or AI-generation was used?"
- [ ] **D2c.** "Are you explaining why automation or AI was seen as useful to produce content?"
  - (c) HOW: Publish a methodology note disclosing that narratives/scores are data-generated, how the PropertyIQ Score is computed, data sources (Zillow, Realtor, Census, FRED, BLS), and refresh cadence. This both satisfies Google's "How" questions and is a trust signal for a YMYL/finance audience.
  - (d) https://developers.google.com/search/docs/fundamentals/creating-helpful-content
  - (e) **High** (YMYL)

### D3 — WHY the content was created

- [ ] **D3.** Primary motivation must be "helping people," not manipulating rankings.
  - (b) Verbatim intent: "Using automation to produce content primarily for search manipulation violates spam policies." The "Why" must be to help users directly.
  - (c) HOW: Keep the user job-to-be-done first ("should I invest in / move to / list in this market?"). The funnel to signup is secondary and must not become the page's reason to exist (ties to B2 doorways).
  - (d) https://developers.google.com/search/docs/fundamentals/creating-helpful-content
  - (e) **High**

### D4 — Trust signals for a YMYL/finance page (from the starter guide + E-E-A-T)

- [ ] **D4a.** Cite credible sources. "Make sure you trust the resource you're linking to."
- [ ] **D4b.** Keep data current. Google "won't show a rich result for time-sensitive content that is no longer relevant"; helpful content must be "up-to-date." Show data "as of" dates.
- [ ] **D4c.** Be accurate and original: "Provide original content that you or your users have generated."
- [ ] **D4d.** Don't let ads/interstitials distract: "Don't let [ads] become overly distracting or prevent your users from reading your content."
  - (c) HOW: Label every metric with its source and date; surface confidence/data-quality (the A/B/C/F confidence badge maps well here); link to source authorities where appropriate; keep monetization unobtrusive on geo pages.
  - (d) https://developers.google.com/search/docs/fundamentals/seo-starter-guide + https://developers.google.com/search/docs/fundamentals/creating-helpful-content
  - (e) **High** (YMYL)

---

## SECTION E — ON-PAGE BEST PRACTICES (starter guide)

- [ ] **E1. Unique, accurate `<title>` per page.** "A good title is unique to the page, clear and concise, and accurately describes the contents of the page." → Template titles must vary meaningfully by geography and intent, not a single boilerplate with a swapped name. **Medium.** (seo-starter-guide)
- [ ] **E2. Unique meta descriptions.** "A good meta description is short, unique to one particular page, and includes the most relevant points of the page." → Generate per-geo descriptions from that geo's actual standout data. **Medium.** (seo-starter-guide)
- [ ] **E3. Descriptive, crawlable internal links + anchor text.** "Make your links crawlable so that Google can find other pages on your site." "Link text tells users and Google something about the page you're linking to." → Build the state→metro→county→ZIP link graph with descriptive anchors (place + intent), via real `<a href>` (crawlable), not JS-only nav. **High** (also fixes B2 doorway risk by creating a real hierarchy). (seo-starter-guide)
- [ ] **E4. Clean, descriptive URL structure grouped by directory.** "Using directories (or folders) to group similar topics can help Google." Parts of the URL show as breadcrumbs. → Keep `/state/`, `/metro/`, `/county/`, `/zip/` directory grouping with readable slugs. **Medium.** (seo-starter-guide)
- [ ] **E5. One canonical URL per piece of content; avoid duplicate URLs.** "Each piece of content on your site is only accessible through one individual URL." → Use canonical tags; avoid the same geo reachable via multiple URL forms. **Medium.** (seo-starter-guide)
- [ ] **E6. Submit a sitemap; help Google find pages.** "Submit a sitemap—which is a file that contains all the URLs on your site that you care about." → For 33k+ URLs, generate segmented sitemaps (sitemap index) and keep them in sync with the index gate (C3) so excluded thin pages aren't listed. **Medium.** (seo-starter-guide)
- [ ] **E7. Don't rely on things Google ignores/penalizes.** "Google Search doesn't use the keywords meta tag." Keyword stuffing is a policy violation. Domain keywords have "hardly any effect." Content length alone doesn't matter. → Don't waste effort on keywords meta, exact-match geo domains, or padding word counts. **Low.** (seo-starter-guide)

---

## SECTION F — STRUCTURED DATA (eligibility for rich results)

> Rich results are an opportunity, not a requirement, but the rules are strict and violations carry manual actions.

- [ ] **F1. Markup must reflect content visible on the page.** Verbatim: "don't add structured data about information that is not visible to the user, even if the information is accurate." "Don't create blank or empty pages just to hold structured data." → Only mark up data actually rendered on the geo page. **High** (manual-action risk). (sd-policies / intro-structured-data)
- [ ] **F2. Don't deceive/mislead; markup must be relevant.** "Don't use structured data to deceive or mislead users." Markup must accurately represent actual page content. → Don't label a market page as a `Recipe`/`Event`/etc.; use the most specific correct schema.org type. **High.** (sd-policies)
- [ ] **F3. Follow spam policies + be complete + original + current.** "Follow the spam policies for Google web search." "Provide original content." "Provide up-to-date information." Specify all required properties or the item is "ineligible for rich results." → If using `Dataset` (well-suited to market data) or `Organization`/`BreadcrumbList`, populate required + recommended fields and keep them fresh. **Medium.** (sd-policies)
- [ ] **F4. Don't block structured-data pages, and place markup on the page it describes.** "Don't block your structured data pages to Googlebot." "Put the structured data on the page that it describes." Place identical markup on duplicate pages, not only the canonical. → Inline JSON-LD per geo page; don't robots-block. **Medium.** (sd-policies)
  - (e) Consequence across F1–F4: "Structured data violations can result in manual actions, causing pages to lose rich result eligibility."

---

## QUICK-REFERENCE: the 10 most load-bearing rules for THIS 33k-page site

1. **Pass the Scaled Content Abuse test (B1)** — value at scale; "no matter how it's created."
2. **Data-sufficiency / thin-content gate (C3)** — `noindex` or skip empty geographies; don't ship 200 shells.
3. **Technical eligibility (A1–A3)** — crawlable, HTTP 200, not noindexed (for pages you want indexed).
4. **SSR the substance (A4)** — core data + analysis in the rendered HTML.
5. **Answer "no" to the search-engine-first red flags (C2)** — especially "extensive automation … without value."
6. **E-E-A-T / YMYL trust (D1–D4)** — authorship, methodology/AI disclosure, sources, freshness dates.
7. **Build a real hierarchy, not doorways (B2 + E3)** — state→metro→county→ZIP internal links with descriptive anchors.
8. **No keyword/place-name stuffing or hidden text (B6)**.
9. **No cloaking; show Googlebot what users see (B5)**.
10. **Unique titles/descriptions/canonicals + sitemaps in sync with the index gate (E1–E6)**.

---

## SOURCES (Google Search Central, read 2026-06-19)

- How Search Works — https://developers.google.com/search/docs/fundamentals/how-search-works
- Search Essentials — https://developers.google.com/search/docs/essentials
- Technical requirements — https://developers.google.com/search/docs/essentials/technical
- Spam policies — https://developers.google.com/search/docs/essentials/spam-policies
- SEO Starter Guide — https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Creating helpful, reliable, people-first content (E-E-A-T) — https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Do I need SEO? — https://developers.google.com/search/docs/fundamentals/do-i-need-seo
- Intro to structured data — https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- General structured data guidelines — https://developers.google.com/search/docs/appearance/structured-data/sd-policies
