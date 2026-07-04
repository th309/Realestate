# Google SEO Rubric — Cluster 02: Crawling & Indexing

> Authoritative rubric built from Google's own documentation at developers.google.com (Google Search Central).
> Compiled 2026-06-19. Each rule cites the exact source URL. Verbatim Google quotes are in "quotes".
>
> **Context this rubric is tuned for:** a real-estate SaaS with **33,000+ programmatic location pages** (states → metros → counties → ZIPs). The most load-bearing concerns for that profile are flagged inline: **crawl budget**, **robots.txt vs noindex precedence**, **soft 404s on "no data" pages**, **faceted/parameter URL traps**, and **mobile-first content parity**.

---

## How Google Search works (3 stages — orientation)

Google processes the web in three stages, and a page must clear each to rank:

1. **Crawling** — Googlebot discovers and downloads URLs (via sitemaps + links). Controlled by robots.txt and crawl budget.
2. **Indexing** — Google analyzes content, picks the canonical, stores it. Controlled by `noindex`/robots meta + canonicalization.
3. **Serving** — Google returns results from the index.

**Key mental model for a 33k-page site:** robots.txt acts at stage 1 (crawling); `noindex` acts at stage 2 (indexing). They are _not_ interchangeable, and **a page blocked at stage 1 can never receive a stage-2 signal** — this single fact drives half the rules below.

Source: https://developers.google.com/search/docs/crawling-indexing

---

## SECTION A — CRAWL BUDGET (LARGE / PROGRAMMATIC SITES)

Source for all of Section A: https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget

### A1. Know whether crawl budget even applies to you

- **Rule:** Crawl budget is a real concern only for large or frequently-changing sites; do not over-engineer for it on small sites.
- **Why (per Google):** Google says crawl budget management matters for: large sites (**1M+ unique pages**) updating ~weekly; medium/large sites (**10K+ unique pages**) with **daily** content changes; or any site where "a substantial portion" of URLs are classified **"Discovered - currently not indexed"** in Search Console.
- **How:** A 33k-page programmatic real-estate site sits in the **medium-site** band. Crawl budget becomes a live concern **if** location pages change frequently (monthly data refresh) **or** if Search Console's Page Indexing report shows many "Discovered - currently not indexed" / "Crawled - currently not indexed" URLs. Monitor that report monthly after each data import.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- **Severity:** High

### A2. Crawl budget = crawl capacity limit × crawl demand

- **Rule:** Understand the two levers Google uses to set crawl budget.
- **Why (per Google):** Crawl budget is "the set of URLs that Google can and wants to crawl." It is set by:
  - **Crawl capacity limit** — "the maximum number of simultaneous parallel connections that Google can use to crawl a site, as well as the time delay between fetches." Rises when the site responds fast/healthy; falls on slowness or server errors.
  - **Crawl demand** — driven by "perceived inventory," "popularity," and "staleness" of content.
- **How:** You influence capacity by keeping the server fast and error-free (see A6); you influence demand by keeping pages genuinely useful and updating `<lastmod>` honestly.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- **Severity:** Medium

### A3. Eliminate low-value-add URLs — they directly waste budget

- **Rule:** Stop Google from spending crawl budget on URLs that add no unique value.
- **Why (per Google):** Google lists these as crawl-budget wasters: **duplicate content**; **faceted navigation and session identifiers**; **soft 404 errors**; **infinite spaces / infinite scrolling that duplicates linked content**; **differently sorted versions of the same page**; **permanently removed pages still being crawled**; hacked pages, proxies, and low-quality/spam content. Google: "Crawling and indexing each of these URLs wastes crawl budget."
- **How (33k-page site):**
  - Collapse duplicate location URLs to one canonical URL per region (one URL per ZIP/county/metro/state — see C/D).
  - Do **not** generate crawlable sort/filter permutations of market list pages (Section E).
  - Make sure "no data" region pages do not become soft 404s (Section C — **critical** for data-driven pages).
- **Source:** https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- **Severity:** Critical

### A4. Consolidate duplicates — Google crawls unique _content_, not unique _URLs_

- **Rule:** Reduce duplicate content so crawl effort concentrates on unique pages.
- **Why (per Google):** "Consolidate duplicate content … focus crawl budget on unique content rather than unique URLs."
- **How:** One canonical URL per region. If both `/markets/austin-tx` and `/metro/12420` resolve to the same market, pick one and 301 / `rel=canonical` the other.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- **Severity:** High

### A5. Use robots.txt to block _unimportant_ URLs (not `noindex`) for budget

- **Rule:** To keep Google from _crawling_ truly unimportant URLs, block them in robots.txt — and specifically **do not** use `noindex` for this purpose.
- **Why (per Google) — load-bearing:** "Don't use `noindex`, as Google will still request, but then drop the page when it sees a `noindex` `meta` tag or header in the HTTP response, **wasting crawling time**." A robots.txt disallow, by contrast, stops the request entirely.
- **How:** Block crawl-trap patterns (faceted filters, session params, internal search results, infinite calendars) via robots.txt. Reserve `noindex` for pages that **must** be crawled but kept out of the index (and which are NOT robots-disallowed — see B3).
- **Caveat:** Blocking a URL in robots.txt removes it from crawl-budget consumption, but does **not** guarantee de-indexing (see B2). Use this lever only for URLs you don't care about indexing at all.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- **Severity:** Critical

### A6. Make the server fast and healthy → Google crawls more

- **Rule:** Fast, error-free responses raise the crawl capacity limit; slow responses and 5xx errors lower it.
- **Why (per Google):** Crawl capacity adjusts on **crawl health**: "If the site responds quickly for a while, the limit goes up… If the site slows down or responds with server errors, the limit goes down." Also: "Make your pages efficient to load" so Google "can read more content" within the same budget.
- **How (33k-page site):** Cache rendered location pages (CDN/ISR), keep TTFB low, and never let the DB-backed pages time out. A backend that 503s under crawl load will throttle Google across all 33k pages.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- **Severity:** High

### A7. Return 404/410 for permanently-removed pages; avoid long redirect chains; keep sitemaps fresh

- **Rule:** Three hygiene rules that reclaim crawl budget.
- **Why (per Google):** (a) "Return a `404` or `410` status code for permanently removed pages" so Google stops re-crawling them. (b) "Avoid long redirect chains, which have a negative effect on crawling." (c) Keep sitemaps up to date and "use the `<lastmod>` tag" so Google focuses on changed URLs.
- **How (33k-page site):** When a ZIP/county is dissolved or merged, 410 it. Submit a clean XML sitemap (or sitemap index) covering all live region URLs with accurate `<lastmod>` reflecting the last data refresh. Avoid chains like `http → https → trailing-slash → canonical`.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- **Severity:** High

### A8. Myth-check: crawl rate is not a ranking signal; faster ≠ always more crawling

- **Rule:** Don't chase crawl rate as if it were a ranking lever.
- **Why (per Google):** Increasing crawl rate does not improve ranking — Google allocates crawl resources by "popularity, overall user value, content uniqueness, and serving capacity," not by site owner preference. Adding server capacity helps only if you're actually hitting "Host load exceeded" limits.
- **How:** Earn more crawl demand with genuinely useful, unique region content — not by fiddling with crawl-rate settings.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- **Severity:** Medium

---

## SECTION B — robots.txt vs noindex (THE PRECEDENCE NUANCE)

### B1. What robots.txt is for (and what it is NOT for)

- **Rule:** robots.txt manages crawler **traffic**; it is not an indexing-control tool.
- **Why (per Google):** "A robots.txt file tells search engine crawlers which URLs the crawler can access on your site. This is used mainly to avoid overloading your site with requests." Critically: **"it is not a mechanism for keeping a web page out of Google."**
- **How:** Use robots.txt to stop crawling of crawl traps and server-heavy endpoints. Use `noindex` (B3) to keep pages out of the index.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/robots/intro
- **Severity:** Critical

### B2. THE NUANCE: a robots.txt-Disallowed page can still be INDEXED

- **Rule:** Disallowing a URL in robots.txt does **not** remove it from Google — it can still be indexed (without a snippet) if linked from elsewhere.
- **Why (per Google) — load-bearing:** "A page that's disallowed in robots.txt can still be indexed if linked to from other sites." When that happens, "the URL address and, potentially, other publicly available information such as anchor text in links to the page can still appear in Google Search results" — typically as a bare URL with no description.
- **How:** If a region/admin page must be kept **out of the index**, do **not** rely on robots.txt. Use `noindex` (and leave the page crawlable so Google sees it) or password-protect it. Google: to prevent indexing "use another method such as password protection or `noindex`."
- **Source:** https://developers.google.com/search/docs/crawling-indexing/robots/intro
- **Severity:** Critical

### B3. THE TRAP: `noindex` requires the page to be crawlable

- **Rule:** Never combine robots.txt Disallow + `noindex` on the same URL — Google will never see the `noindex`.
- **Why (per Google) — load-bearing:** "For the `noindex` rule to be effective, the page or resource must not be blocked by a robots.txt file, and it has to be otherwise accessible to the crawler. **If the page is blocked by a robots.txt file or the crawler can't access the page, the crawler will never see the `noindex` rule, and the page can still appear in search results.**" The robots-meta spec restates it: "If a page is disallowed from crawling through the robots.txt file, then any information about indexing or serving rules will not be found and will therefore be ignored."
- **How (33k-page site):** Pick ONE strategy per URL class:
  - Want it out of the index? → leave crawlable + add `noindex`.
  - Want to save crawl budget and don't care about indexing? → robots.txt Disallow.
  - **Never both on the same URL.** Audit your `robots.txt` against any route that emits a `noindex`.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/block-indexing • https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- **Severity:** Critical

### B4. robots.txt file location, naming, and encoding

- **Rule:** One `robots.txt`, at the host root, UTF-8.
- **Why (per Google):** "The file must be named robots.txt." "The robots.txt file must be located at the root of the site host to which it applies… It cannot be placed in a subdomain." "Your site can have only one robots.txt file." "A robots.txt file must be a UTF-8 encoded text file (which includes ASCII)." Each origin (scheme + host + port) has its own robots.txt.
- **How:** Serve `https://propertyiq.up.railway.app/robots.txt` from the apex/host. If the marketing site and app are on different hosts, each needs its own file.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt
- **Severity:** High

### B5. robots.txt syntax, grouping, and precedence

- **Rule:** Know how Google groups rules and resolves conflicts.
- **Why (per Google):**
  - Directives: `user-agent`, `disallow`, `allow`, `sitemap`, comments with `#`.
  - `user-agent: *` "matches all crawlers except the various AdsBot crawlers, which must be named explicitly."
  - Grouping: "Crawlers process groups from top to bottom. A user agent can match only one rule set, which is the first, most specific group that matches a given user agent." Multiple groups for the same UA "will be combined into a single group before processing."
  - **Precedence:** the most specific rule by **path length** wins; on a tie, the **least restrictive** rule (i.e., `allow`) wins. (Google's REP spec.)
  - **Case-sensitive paths:** "`disallow: /file.asp` applies to `…/file.asp`, but not `…/FILE.asp`."
  - **Wildcards:** "All rules, except `sitemap`, support the `*` wildcard for a path prefix, suffix, or entire string." `$` anchors the end of a URL.
- **How:** Put the `Sitemap:` line as a fully-qualified URL. Test changes in Search Console's robots.txt report before shipping.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt
- **Severity:** High

### B6. robots.txt directives are advisory and interpreted per-crawler

- **Rule:** Don't treat robots.txt as a security boundary.
- **Why (per Google):** "The instructions in robots.txt files cannot enforce crawler behavior to your site; it's up to the crawler to obey them." "Different crawlers interpret syntax differently." Sensitive data must be protected by auth, not robots.txt.
- **How:** Never list secret/admin paths in robots.txt (it publicly advertises them). Gate sensitive routes with authentication.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/robots/intro
- **Severity:** High

---

## SECTION C — HTTP STATUS CODES & SOFT 404s (CRITICAL FOR DATA PAGES)

Source for all of Section C: https://developers.google.com/search/docs/crawling-indexing/http-network-errors

### C1. 200 OK — content is passed to indexing

- **Rule:** Return 200 only when the page has real, indexable content.
- **Why (per Google):** On 200, "Google passes on whatever it received to the next processing step." But a 200 that _renders_ an error/empty state becomes a **soft 404** (C5).
- **Severity:** High

### C2. 301 vs 302 — permanent vs temporary signal

- **Rule:** Use 301 for permanent moves, 302 only for genuinely temporary ones.
- **Why (per Google):** A **301 (Moved Permanently)** is "a strong signal that the redirect target should be processed" (used for canonicalization). A **302 (Found)** is "a weak signal." 303/307 behave like 302; 308 behaves like 301.
- **How (33k-page site):** When a region URL pattern changes permanently (e.g., slug format), 301 old → new so signals consolidate. Don't use 302 for permanent URL migrations.
- **Severity:** High

### C3. Redirect chains — max 10 hops

- **Rule:** Keep redirects to a single hop; never exceed 10.
- **Why (per Google):** "Google's crawlers follow up to 10 redirect hops" — beyond that the target isn't reached, and long chains "have a negative effect on crawling."
- **Severity:** Medium

### C4. 304 Not Modified — conditional crawling

- **Rule:** Support conditional requests where practical.
- **Why (per Google):** **304** signals "the content is the same as last time," saving crawl budget on unchanged pages.
- **How:** Honor `If-Modified-Since`/`ETag` on stable region pages so unchanged months aren't re-downloaded.
- **Severity:** Low

### C5. SOFT 404 — the #1 trap for "no data" region pages

- **Rule:** A page that has no real content must NOT return HTTP 200. Either return a real 404/410, or return 200 with genuine content.
- **Why (per Google) — load-bearing:** A soft 404 is a URL that returns 200 but whose "content suggests an error for Google Search, an empty page or an error message" — "Search Console will show a soft 404 error." Soft 404s waste crawl budget (Section A3) and erode trust in the URL space.
- **How (33k-page site — CRITICAL):** Programmatic ZIP/county pages that render "No data available for this market" while returning HTTP 200 are textbook soft 404s. Two correct options:
  1. **If the region genuinely has no data and never will:** return **404** (or **410** if permanently gone) instead of a 200 empty shell.
  2. **If the region is valid but data is merely sparse:** return **200 with real, useful content** — show the region name, neighboring/parent-geography context, available partial metrics, methodology, and an explanation — so the page is not "empty." (This aligns with the data layer's `DataUnavailable` pattern: render context, never a bare empty state, and never `|| 400000` fake values.)
  - Audit: pull the Search Console "Soft 404" list monthly; every entry is a region page leaking 200-with-no-content.
- **Source:** https://developers.google.com/search/docs/crawling-indexing/http-network-errors
- **Severity:** Critical

### C6. 404 vs 410 — both drop the page; 4xx removes content

- **Rule:** Return 404 for "not found"; 410 for "permanently gone." Both are correct for dead URLs.
- **Why (per Google):** "Google doesn't use the content from URLs that return 4xx status codes." Newly-encountered 404 pages "aren't processed," and crawl frequency "gradually decreases." "All 4xx errors, except 429, are treated the same" by Google — so 410 is **not** dramatically faster than 404 in current docs; both reliably remove the URL. (410 remains a cleaner semantic signal for "intentionally gone.")
- **How:** Use 410 for deliberately retired regions; 404 for genuinely missing/typo URLs. Do not 200-and-redirect-to-home (that creates soft 404s).
- **Severity:** High

### C7. 429 / 5xx — server overload throttles crawling

- **Rule:** Avoid 429/5xx; they reduce crawl capacity site-wide.
- **Why (per Google):** **429 (Too Many Requests)** and **5xx (500/502/503)** cause Google to "temporarily slow down with crawling." Already-indexed URLs persist initially but are "eventually dropped" if errors persist. "Once the server starts responding with a 2xx status code, Google gradually increases the crawl rate."
- **How (33k-page site):** Under crawl load, a DB/Redis outage that 500s across region pages will throttle Google's crawl of the _entire_ site and can drop pages. Keep backend healthy; cache aggressively.
- **Severity:** High

### C8. 503 for planned maintenance

- **Rule:** During planned downtime/maintenance, return **503** (not 200, 404, or a redirect).
- **Why (per Google):** A 503 tells Google the unavailability is temporary, so it "decreases the crawl rate" and retries rather than dropping pages. (Returning 200 with a maintenance page risks soft 404s; returning 404 risks de-indexing.)
- **How:** Wrap data-import / migration windows behind a 503 response with a `Retry-After` header.
- **Severity:** Medium

### C9. Network, DNS, and timeout errors

- **Rule:** Treat connection/DNS/timeout failures as seriously as 5xx.
- **Why (per Google):** Network errors, DNS failures, and timeouts are handled like server errors — Google slows crawling and, if persistent, drops affected URLs. Also: if `robots.txt` itself returns 5xx or is unreachable for an extended period, Google may stop crawling the site. (Covered in the http-network-errors troubleshooting section.)
- **How:** Ensure `robots.txt` always returns 200 (or 404 = "crawl everything"), never 5xx. Keep DNS healthy.
- **Severity:** High

---

## SECTION D — robots META TAG / X-Robots-Tag

Source for all of Section D: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag

### D1. robots meta tag — syntax and targeting

- **Rule:** Place `<meta name="robots" content="…">` in the page `<head>`; target a specific crawler with `name="googlebot"`.
- **Why (per Google):** `name="robots"` applies to all crawlers; `name="googlebot"` / `name="googlebot-news"` target specific Google crawlers.
- **Severity:** Medium

### D2. Valid directives (full list)

- **Rule:** Use the correct directive for the desired behavior.
- **Why (per Google):**
  - `all` — default; no restrictions.
  - `noindex` — "Do not show this page, media, or resource in search results."
  - `nofollow` — "Do not follow the links on this page."
  - `none` — equals `noindex, nofollow`.
  - `noarchive` / `nosnippet` — "Do not show a text snippet or video preview."
  - `indexifembedded` — allow indexing when embedded in an iframe despite `noindex`.
  - `max-snippet:[number]` — `0` = no snippet, `-1` = Google decides.
  - `max-image-preview:[none|standard|large]`.
  - `max-video-preview:[number]` — `0` = static image, `-1` = unlimited.
  - `notranslate` — "Don't offer translation of this page in search results."
  - `noimageindex` — "Do not index images on this page."
  - `unavailable_after:[date/time]` — "Do not show this page in search results after the specified date/time."
- **How (33k-page site):** For thin/duplicative facet or pagination pages you must keep crawlable, prefer `noindex` over robots.txt so the signal is actually seen (D4). Consider `max-image-preview:large` site-wide for richer SERP appearance.
- **Severity:** Medium

### D3. X-Robots-Tag HTTP header — for non-HTML resources

- **Rule:** Use the `X-Robots-Tag` response header for files you can't put a meta tag in (PDFs, images, CSVs, video).
- **Why (per Google):** "Any rule that can be used in a robots `meta` tag can also be specified as an `X-Robots-Tag`." You may prefix a user agent (`X-Robots-Tag: googlebot: noindex`) and combine comma-separated rules. The header name and values "are not case sensitive."
- **How (33k-page site):** Exported market PDFs / data CSVs you don't want indexed → `X-Robots-Tag: noindex` at the CDN/edge.
- **Severity:** Medium

### D4. Conflicting directives → most restrictive wins; AND must be crawlable

- **Rule:** When rules conflict, the most restrictive applies — and **the page must be crawlable for any of them to be honored**.
- **Why (per Google):** "In the case of conflicting robots rules, the more restrictive rule applies. For example, if a page has both `max-snippet:50` and `nosnippet` rules, the `nosnippet` rule will apply." And — load-bearing — "These settings can be read and followed only if crawlers are allowed to access the pages that include these settings." (Same trap as B3.)
- **Severity:** Critical

---

## SECTION E — FACETED NAVIGATION / URL PARAMETER TRAPS

Source for all of Section E: https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation (and the equivalent Google Crawling Infrastructure page)

### E1. Faceted/filter navigation can generate infinite URL spaces

- **Rule:** Don't let sort/filter UI emit unbounded crawlable URLs.
- **Why (per Google) — load-bearing:** Parameter-based faceted navigation "can generate infinite URL spaces which harms the website." Crawlers "can't determine whether the URLs are going to be useful without crawling first," so they "will typically access a very large number of faceted navigation URLs before … the URLs are in fact useless." And: "If crawling is spent on useless URLs, the crawlers have less time to spend on new, useful URLs." Faceted navigation is among the most common overcrawl sources site owners report.
- **How (33k-page site):** Your `/screener`, `/markets`, `/map` filter & sort controls are the risk surface. Decide per URL class whether facet results should be indexable; default to **not crawled**.
- **Severity:** Critical

### E2. If facet URLs don't need indexing → prevent crawling

- **Rule:** Block crawl of filter/sort permutations you don't want indexed.
- **Why (per Google):** "Oftentimes there's no good reason to allow crawling of filtered items, as it consumes server resources for no or negligible benefit; instead, allow crawling of just the individual items' pages." Three methods:
  - **robots.txt Disallow** the facet parameter patterns.
  - **URL fragments (`#`)** for filters: "If your filtering mechanism is based on URL fragments, it will have no impact on crawling (positive or negative)." A `#` filter never creates a crawlable URL.
  - **`rel="nofollow"`** on facet links — but "every anchor pointing to a specific URL must have the `rel="nofollow"` attribute in order for it to be effective."
- **How (33k-page site):** Keep the canonical region pages (one per state/metro/county/ZIP) crawlable and indexable; implement screener/sort filters as `#` fragments or `?`-params blocked in robots.txt. Ensure unfiltered listing + individual region pages are always reachable via plain crawlable links.
- **Severity:** High

### E3. If facet URLs DO need indexing → strict URL rules

- **Rule:** Make facet URLs deterministic and canonical-stable.
- **Why (per Google):** Use the standard `&` parameter separator — "Avoid characters like comma (`,`), semicolon (`;`), and brackets (`[` and `]`)" which crawlers struggle to parse. Keep the **logical filter order consistent**, allow **no duplicate filters**, and **"Return an HTTP 404 status code when a filter combination doesn't return results"** (so empty facet combos don't become soft 404s — ties to C5).
- **Severity:** Medium

### E4. Don't mix robots.txt block with canonical/noindex on facet URLs

- **Rule:** If you need Google to honor `rel=canonical` or `noindex` on a facet URL, do **not** also robots.txt-block it.
- **Why (per Google):** A robots-blocked URL is never crawled, so its `canonical`/`noindex` is never seen (B3/D4). Choose: block crawling **or** let it be crawled so the consolidation signal is read — not both.
- **Severity:** High

---

## SECTION F — MOBILE-FIRST INDEXING

Source for all of Section F: https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing

### F1. Google indexes the MOBILE version

- **Rule:** The mobile rendering is the source of truth for indexing & ranking.
- **Why (per Google):** "Google uses the mobile version of a site's content, crawled with the smartphone agent, for indexing and ranking. This is called mobile-first indexing." If content/links/structured data differ between mobile and desktop, **only the mobile version is used**.
- **Severity:** Critical

### F2. Content parity — same content on mobile and desktop

- **Rule:** Don't ship less content on mobile.
- **Why (per Google):** "Make sure that your mobile site contains the same content as your desktop site." Serving reduced mobile content causes "traffic loss when your site is enabled mobile-first indexing." Use the "same clear and meaningful headings."
- **How (33k-page site):** Every metric, chart, score, and narrative on a desktop region page must be present (not hidden/dropped) on mobile. Collapsible accordions are fine; _omitting_ content is not.
- **Severity:** Critical

### F3. Same structured data, meta tags, and metadata on both

- **Rule:** Keep schema, robots meta, titles, and descriptions identical across mobile/desktop.
- **Why (per Google):** "Make sure that your mobile and desktop sites have the same structured data." "Use the same robots `meta` tags on the mobile and desktop site" — a `noindex`/`nofollow` present only on mobile will de-index the page. "Make sure that the `title` element and the meta description are equivalent across both versions." Update structured-data URLs to the mobile URLs.
- **Severity:** High

### F4. Don't block resources; don't gate primary content behind interaction

- **Rule:** Let Googlebot load all rendering resources; render primary content without requiring taps.
- **Why (per Google):** Blocking JS/CSS/images via robots.txt and using low-res or different images hurts mobile-first indexing. "Don't lazy-load primary content upon user interaction. Google won't load content that requires user interactions … to load."
- **How (33k-page site):** Don't hide a region's core metrics behind a "Load more"/tab-tap that only fires on user click; ensure SSR/initial render includes primary content. Don't robots.txt-block `/_next/` static assets or the map/tiles needed to render.
- **Severity:** High

### F5. Responsive Web Design is the recommended pattern

- **Rule:** Prefer responsive design over separate m-dot/dynamic-serving sites.
- **Why (per Google):** "Google recommends Responsive Web Design because it's the easiest design pattern to implement and maintain" — identical HTML across devices eliminates sync issues.
- **Severity:** Low

---

## SECTION G — REMOVING CONTENT FROM SEARCH

Source for all of Section G: https://developers.google.com/search/docs/crawling-indexing/remove-information

### G1. Removals tool = temporary (~6 months)

- **Rule:** The Search Console Removals tool is a stopgap, not a permanent fix.
- **Why (per Google):** "Requests made in the Removals tool last for about 6 months." After that, the URL can reappear unless you've done a permanent removal (G2).
- **Severity:** Medium

### G2. Permanent removal = delete (404/410), noindex, or password — NOT robots.txt

- **Rule:** To permanently keep a page out of Search, delete it (404/410), add `noindex`, or password-protect it.
- **Why (per Google) — load-bearing:** "To permanently block a page from Google Search results, take one of the following actions": remove/update the content; "Add a `noindex` tag to your page"; or "Password-protect your page." And explicitly: **"Don't use robots.txt as a way to block your page"** — robots.txt alone does not remove a URL (B2).
- **How (33k-page site):** To pull a region page permanently: serve 404/410 or `noindex` (crawlable) — and optionally fast-track with the Removals tool for the ~6-month window while Google re-crawls.
- **Severity:** High

---

## SECTION H — GOOGLE CRAWLERS (REFERENCE)

Source for all of Section H: https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers

### H1. Three crawler categories; common crawlers respect robots.txt

- **Rule:** Know which clients hit your site.
- **Why (per Google):** Google operates **common crawlers** (e.g., Googlebot — "always respect robots.txt rules for automatic crawls"), **special-case crawlers** (e.g., AdsBot, by agreement), and **user-triggered fetchers** (e.g., Site Verifier). Googlebot supports "HTTP/1.1 and HTTP/2."
- **Severity:** Low

### H2. Googlebot Smartphone is primary (mobile-first); verify by IP/reverse-DNS

- **Rule:** Treat the smartphone crawler as the one that matters; verify Googlebot before trusting the UA.
- **Why (per Google):** Mobile-first indexing crawls "with the smartphone agent" (F1). Verify Googlebot by matching the source IP against Google's published ranges / reverse-DNS — never by user-agent string alone (it's spoofable). "Google egresses primarily from IP addresses in the United States" and may crawl from other countries if US requests are blocked.
- **How (33k-page site):** Don't geo-block or rate-limit US Googlebot IPs. If you firewall by country, allowlist Googlebot ranges.
- **Severity:** Medium

---

## APPENDIX — PRIORITIZED CHECKLIST FOR A 33k-PAGE PROGRAMMATIC SITE

| #   | Check                                                                                                                 | Rule       | Severity |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 1   | "No data" region pages return real content (200) OR a true 404/410 — never a 200 empty shell                          | C5         | Critical |
| 2   | No URL is both robots.txt-Disallowed AND `noindex` (the noindex would never be seen)                                  | B3, D4     | Critical |
| 3   | Screener/map/markets sort+filter controls don't emit unbounded crawlable URLs (use `#` fragments or robots.txt block) | E1, E2     | Critical |
| 4   | One canonical URL per region (state/metro/county/ZIP); duplicates 301'd or `rel=canonical`'d                          | A3, A4     | Critical |
| 5   | Mobile render contains the SAME content/metrics/schema/robots-meta as desktop                                         | F1, F2, F3 | Critical |
| 6   | Backend stays fast & error-free under crawl load (5xx throttles the whole site)                                       | A6, C7     | High     |
| 7   | Use `noindex` (crawlable), NOT robots.txt, to keep pages out of the index                                             | A5, B2, G2 | High     |
| 8   | Sitemap (index) covers all live region URLs with honest `<lastmod>`; no long redirect chains                          | A7         | High     |
| 9   | Retired regions return 410; missing/typo URLs return 404                                                              | C6, A7     | High     |
| 10  | Use 503 (+ `Retry-After`) for data-import / maintenance windows                                                       | C8         | Medium   |
| 11  | Monitor Search Console "Soft 404" + "Discovered/Crawled - currently not indexed" monthly after each import            | A1, C5     | High     |
| 12  | Don't robots.txt-block `/_next/` assets, map tiles, or rendering resources (breaks mobile-first render)               | F4         | High     |

---

### Source index (all URLs verified live 2026-06-19)

- Crawling & Indexing hub — https://developers.google.com/search/docs/crawling-indexing
- Overview of Google crawlers — https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
- robots.txt intro — https://developers.google.com/search/docs/crawling-indexing/robots/intro
- Create a robots.txt file — https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt
- Robots meta tag / X-Robots-Tag specs — https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- Block indexing with noindex — https://developers.google.com/search/docs/crawling-indexing/block-indexing
- HTTP status / network / DNS errors — https://developers.google.com/search/docs/crawling-indexing/http-network-errors
- Large-site crawl budget management — https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- Mobile-first indexing — https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing
- Remove information from Google — https://developers.google.com/search/docs/crawling-indexing/remove-information
- Managing faceted navigation crawling — https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation
