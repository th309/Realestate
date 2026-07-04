# Google SEO Rubric — Cluster 04: SITEMAPS

> Authoritative rubric built by reading Google's OWN documentation at developers.google.com.
> Every rule cites the exact Google source URL. Verbatim Google quotes are in `"quotation marks"`.
> Severity scale: **CRITICAL** (breaks indexing / wastes crawl budget at scale) · **HIGH** (meaningful SEO loss) · **MEDIUM** (best practice) · **LOW** (cosmetic / optional).

## Site context this rubric is judged against

This site ships a **sitemap INDEX** with **8 child sitemaps** (`main`, `states`, `metros`, `counties`, `zips-1..4`) covering **33,000+ ZIP pages** plus thousands of county / metro / state pages. Child sitemaps carry `<lastmod>` but **NO `<changefreq>` / `<priority>`**. The verdict on that exact setup is in the **Summary** at the bottom: it is _correct and aligned with Google's stated behavior_.

---

## Sources read (Google Search Central)

| #   | Page                                           | URL                                                                                 |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| S1  | Sitemaps overview                              | https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview       |
| S2  | Build and submit a sitemap                     | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap  |
| S3  | Manage sitemaps with index files (large sites) | https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps |
| S4  | Image sitemaps                                 | https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps |
| S5  | Video sitemaps                                 | https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps |
| S6  | Special tags (meta tags / indexing)            | https://developers.google.com/search/docs/crawling-indexing/special-tags            |

---

# RULES

## R1 — Hard limit: 50,000 URLs AND 50MB uncompressed per sitemap file

- **(a) Rule:** A single sitemap file must contain no more than **50,000 URLs** and be no larger than **50MB uncompressed**. Exceed either and you must split the file.
- **(b) WHY (per Google):** Google enforces both ceilings on every sitemap format. Verbatim: `"All formats limit a single sitemap to 50MB (uncompressed) or 50,000 URLs."` A file over either limit may be only partially processed or rejected.
- **(c) HOW:** Cap each generated sitemap at 50,000 URLs and verify the uncompressed byte size stays under 50MB (52,428,800 bytes); split into additional files when either threshold approaches. `"If you have a sitemap that exceeds the size limits, you'll need to split up your large sitemap into multiple sitemaps such that each new sitemap is below the size limit."` (S3)
- **(d) Source:** S2 https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap ; S3 https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps
- **(e) Severity:** **CRITICAL** — at 33,000+ ZIPs the site MUST split (this is why `zips-1..4` exist). A single un-split sitemap would silently drop URLs.

## R2 — Use a sitemap index file to group the child sitemaps; max 50,000 sitemaps per index

- **(a) Rule:** When you split into multiple sitemaps, group them under a single **sitemap index** file (`<sitemapindex>`) and submit that one index. An index can reference up to **50,000** sitemaps and is itself bound by the 50MB-uncompressed limit.
- **(b) WHY (per Google):** It lets one submission represent the whole site. Verbatim: `"you must break your sitemap into multiple sitemaps. You can optionally create a sitemap index file and submit that single index file to Google."` (S2) The index ceiling: `"A sitemap index file may have up to 50,000 loc tags."` (S3)
- **(c) HOW:** Emit a `<sitemapindex>` document, one `<sitemap><loc>…</loc><lastmod>…</lastmod></sitemap>` per child:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap>
      <loc>https://www.example.com/sitemap1.xml.gz</loc>
      <lastmod>2024-08-15</lastmod>
    </sitemap>
  </sitemapindex>
  ```
  This site's 8-child index is well under the 50,000-sitemap cap.
- **(d) Source:** S2 ; S3 https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps
- **(e) Severity:** **HIGH** — required structure for any site beyond one file; already implemented correctly here.

## R3 — Child sitemaps must be same-site, same-directory-or-lower as the index; submit ≤500 index files per site

- **(a) Rule:** Every sitemap referenced by the index must be hosted on the same site and in the index's directory or lower in the hierarchy. You may submit up to 500 sitemap index files per site.
- **(b) WHY (per Google):** Cross-site or higher-directory references are not trusted/processed. Verbatim: `"The referenced sitemaps must be hosted on the same site as your sitemap index file"` and `"Sitemaps that are referenced in the sitemap index file must be in the same directory as the sitemap index file, or lower in the site hierarchy."` Limit: `"submit up to 500 sitemap index files for each site."` (S3)
- **(c) HOW:** Host the index at e.g. `/sitemap.xml` (or `/sitemaps/`) and place all child sitemaps at the same level or deeper; use absolute same-host URLs in every `<loc>`.
- **(d) Source:** S3 https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps
- **(e) Severity:** **HIGH** — a misplaced child path makes that sitemap silently ignored.

## R4 — Google IGNORES `<changefreq>` and `<priority>` — do NOT add them

- **(a) Rule:** Do not include `<changefreq>` or `<priority>` tags. Google does not use them. (This site correctly omits both — keep it that way.)
- **(b) WHY (per Google):** They have zero effect on crawling or ranking. Verbatim: `"Google ignores <priority> and <changefreq> values."` Adding them is pure noise that bloats the file and gives a false sense of control.
- **(c) HOW:** Generate `<url>` entries with only `<loc>` (and optionally `<lastmod>`). Never compute or emit `changefreq`/`priority`. If a sitemap library adds them by default, disable that.
- **(d) Source:** S2 https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- **(e) Severity:** **LOW** (harmless to indexing) but **flag any code that adds them** — it signals a misunderstanding of how Google reads sitemaps and wastes bytes against the 50MB limit.

## R5 — `<lastmod>` is used ONLY if it is consistently and verifiably accurate

- **(a) Rule:** Include `<lastmod>` only when it truly reflects the date/time of the last _significant_ content change, in W3C Datetime format. If you cannot keep it accurate, omit it rather than fake it.
- **(b) WHY (per Google):** Google trusts `<lastmod>` only when it can verify it against the actual page. Verbatim: `"Google uses the <lastmod> value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate."` A `<lastmod>` that does not match the page's real last modification (e.g., set to "today" on every build, or to the data-load date when the visible content didn't change) is not "verifiably accurate," so Google disregards it — and a site that habitually emits inaccurate values trains Google to stop trusting the signal site-wide.
- **(c) HOW:** Derive `<lastmod>` from the underlying record's real update timestamp (e.g., when a ZIP's metrics/score actually changed), not from build time or deploy time. For the monthly data pipeline, set each page's `<lastmod>` to the month the data driving that page actually refreshed. Use W3C Datetime (`2024-08-15` or `2024-08-15T10:30:00+00:00`). In the index, the `<sitemap><lastmod>` `"must be in W3C Datetime format."` (S3)
- **(d) Source:** S2 https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap ; S3 (format)
- **(e) Severity:** **HIGH** — at 33,000+ programmatic pages, a blanket build-time `<lastmod>` is the single most likely sitemap defect; it makes Google ignore the freshness signal that large dynamic sites depend on for re-crawl prioritization. Audit how this site's `<lastmod>` is generated.

## R6 — Sitemap must list canonical, indexable, 200-OK URLs only (no noindex / redirects / 404s / non-canonical)

- **(a) Rule:** Only include URLs you actually want indexed: canonical, self-referencing, returning HTTP 200, not blocked by robots/`noindex`, not redirecting, not 404. One canonical URL per page.
- **(b) WHY (per Google):** A sitemap is a list of pages you want in Search. Verbatim: `"Include the URLs in your sitemap that you want to see in Google's search results."` Listing a `noindex` URL, a redirect, a 404, or a non-canonical duplicate sends conflicting signals, wastes crawl budget, and generates "Submitted URL" errors/warnings in Search Console. (And note: `"A sitemap helps search engines discover URLs on your site, but it doesn't guarantee that all the items in your sitemap will be crawled and indexed."` — S1)
- **(c) HOW:** Generate sitemap entries from the same canonical-URL source the pages declare in `<link rel="canonical">`. Exclude any route that is `noindex`, paginated-duplicate, parameterized, redirected, or known-missing. For 33,000 programmatic ZIP pages, gate inclusion on "page renders real data + is canonical + returns 200." Re-run a crawl/lint over the sitemap to catch drift.
- **(d) Source:** S2 https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap ; S1 https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- **(e) Severity:** **CRITICAL** at this scale — non-canonical / noindex / redirected / dead URLs in a 33k-page sitemap are the classic programmatic-SEO failure and pollute index-coverage reporting.

## R7 — Use fully-qualified absolute URLs, UTF-8 encoding

- **(a) Rule:** Every `<loc>` must be a complete absolute URL (scheme + host + path); the file must be UTF-8 encoded; special characters entity-escaped.
- **(b) WHY (per Google):** Google crawls exactly what you list. Verbatim: `"Use fully-qualified, absolute URLs in your sitemaps. Google will attempt to crawl your URLs exactly as listed."` and `"The sitemap file must be UTF-8 encoded."`
- **(c) HOW:** Build `<loc>` from `https://<canonical-host>/...` — never relative paths, never the wrong host (www vs non-www must match the canonical). Serve the file as UTF-8 and entity-escape `&`, `<`, `>`, `'`, `"` in URLs.
- **(d) Source:** S2 https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- **(e) Severity:** **HIGH** — a host mismatch (e.g., sitemap lists `www.` but canonicals are bare domain) makes every entry a non-canonical/redirect, multiplying R6 errors across 33k URLs.

## R8 — Submit via robots.txt `Sitemap:` directive AND Search Console; both, for a large site

- **(a) Rule:** Reference the sitemap (or sitemap index) from `robots.txt` with a `Sitemap:` line, and also submit the index in Search Console. Submitting the single index covers all children.
- **(b) WHY (per Google):** These are the supported discovery/submission paths. Verbatim methods: `"Submit a sitemap in Search Console using the Sitemaps report"`, `"Use the Search Console API to programmatically submit a sitemap"`, and `"Insert the following line anywhere in your robots.txt file, specifying the path to your sitemap"`. The robots.txt directive lets any crawler find it; Search Console gives you index-coverage feedback.
- **(c) HOW:** Add to `robots.txt`: `Sitemap: https://example.com/my_sitemap.xml` (point it at the **index** file). Then add the index URL in the Search Console Sitemaps report (or via the Search Console API in CI). You only submit the index; Google reads the children from it.
- **(d) Source:** S2 https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- **(e) Severity:** **HIGH** — without submission/discovery, a perfect sitemap does nothing.

## R9 — Image sitemaps: optional; add only to surface images Google can't otherwise find

- **(a) Rule:** Image sitemaps are NOT required for image SEO. Add `<image:image>`/`<image:loc>` entries only when images are hard for Google to discover (e.g., loaded via JavaScript). Max 1,000 `<image:image>` per `<url>`.
- **(b) WHY (per Google):** Google finds normally-linked `<img>`/CSS images on its own. Verbatim: `"Image sitemaps are a way of telling Google about other images on your site, especially those that we might not otherwise find (such as images your site reaches with JavaScript code)."` and `"Each <url> tag can contain up to 1,000 <image:image> tags."`
- **(c) HOW:** Skip image sitemaps if your images are plain `<img src>` in server-rendered HTML. If key imagery (maps, charts) is injected by JS and not in the static HTML, add `<image:image><image:loc>…</image:loc></image:image>` inside the relevant `<url>`. Generic sitemap best practices (R1–R7) still apply.
- **(d) Source:** S4 https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
- **(e) Severity:** **MEDIUM** — only relevant if image search traffic matters and images are JS-rendered; otherwise skip.

## R10 — Video sitemaps: optional discovery aid; provide required tags if used

- **(a) Rule:** Use a video sitemap only if you host video and want to help Google find/understand it (especially new or hard-to-discover videos). If you create one, each `<video:video>` needs `<video:thumbnail_loc>`, `<video:title>`, `<video:description>`, and at least one of `<video:content_loc>` or `<video:player_loc>`.
- **(b) WHY (per Google):** It is a help, not a requirement. Verbatim: `"Creating a video sitemap is a good way to help Google find and understand the video content on your site, especially content that was recently added or that we might not otherwise discover with our usual crawling mechanisms."` Required-tag rule: `"It's required to provide either a <video:content_loc> or <video:player_loc> tag."` (max 32 tags per video).
- **(c) HOW:** Only build this if the site has real video pages. Provide the four required fields plus optional metadata (`duration`, `publication_date`, etc.). Not applicable to the current data/landing pages.
- **(d) Source:** S5 https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps
- **(e) Severity:** **LOW** — N/A unless/until the site publishes video.

## R11 — Indexing control belongs in meta robots, not the sitemap

- **(a) Rule:** To keep a page out of the index, use `<meta name="robots" content="noindex">` (or `X-Robots-Tag`) on the page — never rely on "leaving it out of the sitemap" to deindex it, and never list a `noindex` page in the sitemap (ties to R6).
- **(b) WHY (per Google):** Sitemaps are a discovery hint, not an index/deindex control. Default is index. Verbatim: `"The default values are index, follow and don't need to be specified."` The keywords meta tag is irrelevant: `"The meta-keyword tag is not used by Google Search, and it has no effect on indexing and ranking."`
- **(c) HOW:** Pages you want indexed: no `noindex`, and include them in the sitemap. Pages you don't: add `noindex` on the page AND exclude from the sitemap. Don't put `changefreq`/`priority`/`keywords` anywhere expecting an effect.
- **(d) Source:** S6 https://developers.google.com/search/docs/crawling-indexing/special-tags
- **(e) Severity:** **MEDIUM** — prevents the common mistake of conflating sitemap presence with index control.

---

# SUMMARY (verdict on this site's sitemap setup)

1. **Limits are real and dual:** `"All formats limit a single sitemap to 50MB (uncompressed) or 50,000 URLs."` Exceed _either_ and you must split. (S2)
2. **Sitemap index is the correct structure** for 33k+ URLs; one index can hold `"up to 50,000 loc tags"` and you may submit `"up to 500 sitemap index files for each site."` The 8-child index here is well within limits. (S3)
3. **Children must be same-site, same-dir-or-lower** as the index. (S3)
4. **`changefreq` and `priority`: Google flat-out ignores them** — `"Google ignores <priority> and <changefreq> values."` This site OMITS both, which is exactly right. Do not add them. (S2)
5. **`lastmod` IS used — but only if accurate:** `"Google uses the <lastmod> value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate."` This site includes `<lastmod>`, which is good — _provided_ it reflects real per-page content changes, not build/deploy time. **This is the #1 thing to audit.** (S2)
6. **Sitemaps must list canonical, indexable, 200-OK URLs only** — `"Include the URLs in your sitemap that you want to see in Google's search results."` No noindex / redirect / 404 / non-canonical entries. Critical at 33k programmatic pages. (S2)
7. **Use fully-qualified absolute URLs, UTF-8** — host must match the canonical (www vs bare). (S2)
8. **Submit the index via robots.txt `Sitemap:` line + Search Console**; submitting the one index covers all children. (S2)
9. **A sitemap doesn't guarantee indexing:** `"A sitemap helps search engines discover URLs on your site, but it doesn't guarantee that all the items in your sitemap will be crawled and indexed."` (S1)
10. **Large dynamic sites are exactly who needs sitemaps** — large, many pages, hard to fully internal-link; this site qualifies. (S1)
11. **Image/video sitemaps are optional discovery aids**, only needed when media is hard to crawl (e.g., JS-injected images); not required for normal image SEO. (S4, S5)
12. **Bottom line:** the current design (index + 8 children, `<lastmod>` present, no `<changefreq>`/`<priority>`) is aligned with Google's documented behavior. The two highest-value audits are (R5) prove `<lastmod>` is per-page-accurate not build-time, and (R6/R7) prove every URL is canonical, 200-OK, indexable, on the canonical host.

---

_File: `docs/seo/google-rubric/04-sitemaps.md` — cluster 04 of the Google SEO rubric._
