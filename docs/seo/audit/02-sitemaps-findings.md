# SEO Audit — Cluster 04: Sitemaps (lastmod / changefreq / priority / size)

> Graded against `docs/seo/google-rubric/04-sitemaps.md`.
> Scope: **`<lastmod>` accuracy, `<changefreq>`/`<priority>` emission, per-child size headroom.**
> A separate crawl audit already confirmed all sitemap URLs are www-host, HTTP 200, and canonical — that is NOT re-graded here (rubric R6/R7 are out of scope for this file).
> Date of live capture: 2026-06-19. Live host: `https://www.propertyiq.app`.

---

## Headline verdicts

| Question                                                                    | Verdict                                                                                                                                                                           |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is `<lastmod>` per-page accurate, or a single build/request-time timestamp? | **Request-time timestamp, identical across all data URLs in a file.** Genuinely fake for ~43,700 of ~43,720 data pages. Only blog posts carry a real per-page date. **FAILS R5.** |
| Are `<changefreq>` / `<priority>` emitted?                                  | **Yes — emitted on every single `<url>` and is dead code per Google.** Violates R4 (Google ignores both).                                                                         |
| Any child sitemap near the 50k-URL / 50MB ceiling?                          | **No.** Largest unchunked file is counties at 3,231 URLs; ZIP chunks are 10,000 each. Comfortable headroom. R1 passes.                                                            |

---

## Evidence

### Code (how `<lastmod>`, `changefreq`, `priority` are generated)

`packages/frontend/lib/seo/sitemap-builder.ts`:

- **Index** (`buildIndexEntries`, line 238–253): `const now = new Date().toISOString();` then every one of the 8 child entries is assigned `lastmod: now`. So all index `<lastmod>` are the **request timestamp**, identical.
- **Every child builder** computes its own `const now = new Date().toISOString();` at the top and assigns it to every URL:
  - `buildMainUrls` (line 92–93): static routes all use `now`. **Only `blogRoutes` (line 171–176) use a real date** — `new Date(post.frontmatter.date).toISOString()`. Comparison routes use `now`.
  - `buildStatesUrls` (line 188–189): all `now`.
  - `buildMetrosUrls` (line 206–207): all `now`.
  - `buildCountiesUrls` (line 216–217): all `now`.
  - `buildZipChunkUrls` (line 226–227): all `now`.
- **`changefreq` + `priority` are hardcoded into every builder** and rendered by `renderUrlset` (line 62–76, which emits `<changefreq>` and `<priority>` whenever present). Examples: home `priority: 1.0` / `weekly`; metros `0.7` / `weekly`; ZIPs `0.4` / `monthly`. There is no code path that omits them for data pages.

`now` is computed at **request handling time** (the route handlers in `app/sitemap.xml/route.ts` and `app/sitemaps/[id]/route.ts` call the builders per request, with `revalidate = 3600`). So `<lastmod>` reflects "when this XML was last regenerated at the edge," NOT when the underlying ZIP/metro/county data or page content changed.

### Live confirmation (2026-06-19)

- **Index** `https://www.propertyiq.app/sitemap.xml`: all 8 children share `<lastmod>2026-06-19T15:32:22.107Z` (identical, = capture time).
- **`/sitemaps/main`**: ~370 URLs. Static routes all `2026-06-19T15:39:19.592Z`; **blog posts vary correctly** (`2026-06-13T00:00:00.000Z`, `2026-04-19...`, `2026-03-04...`). `<changefreq>` and `<priority>` present on every entry.
- **`/sitemaps/metros`**: 935 URLs. Every entry `2026-06-19T15:37:40.644Z` — identical. `weekly` / `0.7` on all.
- **`/sitemaps/zips-1`**: 10,000 URLs. Every entry `2026-06-19T15:37:41.296Z` — identical. `monthly` / `0.4` on all.

Note the timestamps differ **between** files (`15:32:22` index vs `15:39:19` main vs `15:37:40` metros) — proof each route stamps its own request moment, not a shared build or a real data date.

### Exact URL counts (source data)

| Child sitemap | URL count                          | Source                                                                                                                                  |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `main`        | ~370 (static + blog + comparisons) | `buildMainUrls`                                                                                                                         |
| `states`      | 54 (53 states + `/markets/state`)  | 53 `"slug"` in `state-slug-data.ts`                                                                                                     |
| `metros`      | 935                                | 935 `"slug"` in `metro-slug-data.json`                                                                                                  |
| `counties`    | 3,231 (single unchunked file)      | 3,231 `"slug"` in `county-slug-data.json`                                                                                               |
| `zips-1..4`   | 10,000 each (last chunk smaller)   | 39,499 raw rows in `zip-slug-data.json`, filtered to valid 5-digit ZIPs (`/^\d{5}$/`), chunked at `ZIPS_PER_SITEMAP = 10000` → 4 chunks |

Total data pages: ~43,700.

---

## Findings (ranked)

### F1 — `<lastmod>` is a request-time timestamp, identical across all data URLs — Google will disregard the freshness signal site-wide — **HIGH**

- **Google rule (R5):** `"Google uses the <lastmod> value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate."` A `<lastmod>` set to "now" on every regeneration is not verifiably accurate; an habitually inaccurate value trains Google to ignore the signal across the whole site.
  Source: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- **Observed:** Every state/metro/county/ZIP URL — and every index entry — carries the same per-request timestamp (`new Date().toISOString()`), confirmed both in code and live (e.g. all 935 metros at `2026-06-19T15:37:40.644Z`, all 10,000 zips-1 at `...15:37:41.296Z`). The value changes on every edge regeneration regardless of whether the page's data changed. The visible page content for these programmatic pages only changes when the monthly data pipeline refreshes (~17th of month), not at every sitemap regeneration. This is the single most impactful sitemap defect for a 43k-page programmatic site, which depends on `<lastmod>` for re-crawl prioritization.
- **Severity:** HIGH (per rubric R5(e): "a blanket build-time `<lastmod>` is the single most likely sitemap defect").
- **Exact fix** (`packages/frontend/lib/seo/sitemap-builder.ts`): replace the per-builder `now` with a real data-modified date. Two acceptable options:
  1. **Preferred — real per-geo modified date.** Drive `<lastmod>` from the actual last data-refresh date for each geo (e.g. the latest `period_date` the monthly pipeline wrote for that region, or a single pipeline "data as-of" month constant updated when the monthly import lands). For the programmatic pages this can be one shared month-granular constant (e.g. `2026-06-01`) bumped by the monthly pipeline, since all those pages refresh together — that IS verifiably accurate because it matches when the page content actually changed. Change lines 189, 207, 217, 227 (and 92 for static/comparison routes) to use that constant instead of `new Date().toISOString()`. Keep the blog-post real-date logic (line 171–176) as-is — it is already correct.
  2. **Acceptable fallback — drop `<lastmod>` entirely** for the data pages. Rubric R5(a): "If you cannot keep it accurate, omit it rather than fake it." Stop passing `lastmod` for state/metro/county/zip URLs; `renderUrlset` already omits the tag when `lastmod` is undefined (line 66).
- Do NOT keep the current request-time value — it is the exact anti-pattern R5 warns against.

### F2 — `<changefreq>` and `<priority>` are emitted on every URL; Google ignores both — **LOW (remove to cut bytes + signal)**

- **Google rule (R4):** `"Google ignores <priority> and <changefreq> values."` Do not include them.
  Source: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- **Observed:** Both tags are present on every entry in every child sitemap (confirmed live in main/metros/zips). The code emits them via `renderUrlset` (lines 67–70) and sets them in every builder. The rubric's own "Site context" note (line 9) and Summary item 4 describe this site as correctly OMITTING changefreq/priority — that is **stale/aspirational; the live site emits them.** This finding corrects that assumption.
- **Severity:** LOW (harmless to indexing) — but rubric R4(e) says "flag any code that adds them — it signals a misunderstanding of how Google reads sitemaps and wastes bytes against the 50MB limit." At ~43,700 URLs, the two tags add roughly 60–70 bytes/URL (~2.5 MB of pure dead weight across the set).
- **Exact fix** (`packages/frontend/lib/seo/sitemap-builder.ts`): stop emitting them. Cleanest: delete the two `if` blocks in `renderUrlset` (lines 67–70) so the renderer never writes `<changefreq>`/`<priority>`, then remove the now-unused `changefreq`/`priority` fields from the builders and the `SitemapUrl` interface (lines 36–44). Minimal: just remove lines 67–70. Either way no behavior change for Google (it already ignores them), only a smaller, cleaner file.

### F3 — Per-child size headroom is healthy; no file near the 50k-URL / 50MB ceiling — **PASS (no action)**

- **Google rule (R1):** `"All formats limit a single sitemap to 50MB (uncompressed) or 50,000 URLs."`
  Source: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap and https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps
- **Observed:** Largest single file by URL count is **counties at 3,231 URLs** (6.5% of the 50k cap), unchunked. ZIP files are capped at `ZIPS_PER_SITEMAP = 10000` (20% of cap) → 4 chunks for ~39.4k valid ZIPs. Metros 935, states 54, main ~370. Byte-size: even the 10,000-URL ZIP file, at roughly ~200 bytes/entry (including the redundant changefreq/priority), is on the order of ~2 MB uncompressed — well under 50 MB. No file is close to either ceiling.
- **Severity:** PASS — comfortable headroom. No split needed beyond the existing ZIP chunking.
- **Forward-looking note (not a defect):** counties is unchunked at 3,231; it could grow but has a 15x runway before 50k. The ZIP chunking (`ZIPS_PER_SITEMAP = 10000`) is the only generator that auto-splits — that is correct and the only one that needs it today.

---

## Summary for the grader

- **lastmod verdict: FAIL (HIGH).** Not per-page accurate — it is `new Date()` computed per request and stamped identically onto every data URL (and onto every index entry). Only blog posts carry a real date. This is exactly the build/request-time anti-pattern R5 says Google will disregard. Fix: drive it from a real monthly data-refresh date (preferred) or drop the tag for data pages.
- **changefreq/priority verdict: violation of R4 (LOW).** Both are emitted on all ~43,700 URLs though Google ignores them; ~2.5 MB of dead bytes. The rubric's claim that this site omits them is stale — it does not. Remove `renderUrlset` lines 67–70.
- **size headroom verdict: PASS.** Largest file = counties 3,231 URLs; ZIP chunks 10,000 each; all far under 50k URLs / 50MB.
- **Findings file:** `D:\projects\rei-platform\docs\seo\audit\02-sitemaps-findings.md`
