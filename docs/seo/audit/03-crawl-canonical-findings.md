# Crawling / Indexing / Canonicalization Audit — Findings

> Scope: PropertyIQ crawling, indexing, and canonicalization vs Google Search Central rules.
> Method: rubric review (`docs/seo/google-rubric/02-crawling-indexing.md`, `03-urls-links-canonical-js.md`) + read-only code review + **live HTTP tests** (curl, 2026-06-19).
> Every finding cites the Google rule + source URL, the observed live + code behavior, severity, and the exact fix.

---

## TL;DR verdicts

| Crown-jewel test                                 | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DUPLICATE-HOST** (`propertyiq.up.railway.app`) | ❌ **NOT consolidated.** Railway alias serves **HTTP 200** for every page (no 301/308, no `X-Robots-Tag: noindex`), with its **own crawlable robots.txt** (`Allow: /`). Content is **byte-identical** to www (both 50,997 bytes on the Austin metro page). The one mitigation: each Railway page emits an **absolute canonical pointing to `www.propertyiq.app`**, which is "acceptable" per rubric A10 but strictly weaker than a redirect. → **HIGH** |
| **SOFT-404** (non-existent / empty geos)         | ✅ **PASS.** Fabricated metro slug `this-is-not-a-real-city-zz` and fabricated ZIP `00000-nowhere-zz` both return a **real HTTP 404**. Sparse-but-real geo (Palmer AK `99645`) returns **200 with genuinely rich content** (51 KB, real PropertyIQ Score + median prices), not an empty shell. No soft-404s observed.                                                                                                                                   |

---

## Live HTTP test results (raw)

| #   | URL                                                                         | Status  | Redirect                                        | `<link rel=canonical>`                                               | robots meta / `X-Robots-Tag` |
| --- | --------------------------------------------------------------------------- | ------- | ----------------------------------------------- | -------------------------------------------------------------------- | ---------------------------- |
| 1   | `https://propertyiq.up.railway.app/markets/austin-round-rock-san-marcos-tx` | **200** | none (0 hops)                                   | `https://www.propertyiq.app/markets/austin-round-rock-san-marcos-tx` | `index, follow` / none       |
| 2   | `https://propertyiq.up.railway.app/`                                        | **200** | none                                            | `https://www.propertyiq.app`                                         | `index, follow` / none       |
| 3a  | `http://propertyiq.app/`                                                    | **301** | `https://www.propertyiq.app` (1 hop)            | —                                                                    | —                            |
| 3b  | `https://propertyiq.app/`                                                   | **301** | `https://www.propertyiq.app` (1 hop, final 200) | —                                                                    | —                            |
| 4a  | `https://www.propertyiq.app/markets/this-is-not-a-real-city-zz`             | **404** | none                                            | —                                                                    | none (true 404)              |
| 4b  | `https://www.propertyiq.app/markets/zip/00000-nowhere-zz`                   | **404** | none                                            | —                                                                    | none (true 404)              |
| 5   | `https://www.propertyiq.app/markets/zip/99645-palmer-ak` (sparse real)      | **200** | none                                            | `…/markets/zip/99645-palmer-ak` (self)                               | `index, follow`              |
| 6   | `https://www.propertyiq.app/markets/zip/35201-birmingham-al` (real)         | **200** | none                                            | `…/markets/zip/35201-birmingham-al` (self)                           | `index, follow`              |
| 7   | `https://www.propertyiq.app/map` and `…/map?metric=…&geo=zip&state=TX`      | **200** | none                                            | `https://www.propertyiq.app/map` (bare — params stripped)            | `index, follow`              |
| 8   | `https://www.propertyiq.app/screener`                                       | **200** | none                                            | `https://www.propertyiq.app/screener` (self)                         | `index, follow`              |

Supporting facts:

- Railway page and www page are **byte-identical** (50,997 bytes each) → real duplicate-host, not a stub.
- `robots.txt` is served identically on **both** hosts with `Allow: /` and `Sitemap: https://www.propertyiq.app/sitemap.xml` → Railway host is fully crawlable.
- `sitemap.xml` is a proper **sitemap index** listing only `https://www.propertyiq.app/…` children (main, states, metros, counties, zips). No Railway/HTTP URLs.

---

## FINDINGS (ranked by severity)

### 🔴 F1 — HIGH — Duplicate host `propertyiq.up.railway.app` is not consolidated to the canonical host

- **Google rule:** Pick ONE canonical host and permanently redirect the other; a 301/308 is _"a strong signal that the target of the redirect should become canonical"_ and _"consolidates ranking signals to the target URL."_ Rubric 03 §A4 names this the #1 issue for this exact site (`propertyiq.up.railway.app` serving byte-identical content). Rubric 03 §A2: a wrong canonical pick _"fragments ranking signals and skews analytics."_
  Source: https://developers.google.com/search/docs/crawling-indexing/canonicalization · https://developers.google.com/search/docs/crawling-indexing/301-redirects · https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- **Observed (live):** `https://propertyiq.up.railway.app/markets/austin-round-rock-san-marcos-tx` and `/` both return **HTTP 200**, 0 redirects, **no `X-Robots-Tag`**, robots meta `index, follow`. Railway's `robots.txt` is `Allow: /`. Content is byte-identical to www.
- **Observed (code):** `packages/frontend/middleware.ts` only redirects the bare apex `host === "propertyiq.app"` → `www` (line 62-67). There is **no branch for `*.up.railway.app`**. `next.config.mjs` `redirects()` (lines 77-82) likewise only matches `host: 'propertyiq.app'`. Nothing touches the Railway alias.
- **Mitigation already present:** every Railway page emits an **absolute canonical to `www.propertyiq.app`** (because `metadataBase`/`alternates.canonical` are hardcoded to the www origin, not request-derived). Per rubric §A10 a cross-host `rel=canonical` is "acceptable" — so this is **not Critical** — but it is only a _hint_ Google may override, and the Railway URLs remain crawlable and indexable, wasting crawl budget on a full duplicate of all ~33k pages and risking a wrong canonical election (Search Console "Duplicate, Google chose different canonical").
- **Severity:** **HIGH** (downgraded from Critical solely because the cross-host canonical points the right way; it is not Low because the alias is fully crawlable/indexable and signals can still split).
- **Exact fix:** Add a host-consolidation redirect at the top of `middleware.ts` (single hop, 308 permanent), before the apex check:

  ```ts
  // packages/frontend/middleware.ts — first lines of middleware()
  const host = request.headers.get("host") || "";
  const CANONICAL_HOST = "www.propertyiq.app";
  if (host.endsWith(".up.railway.app")) {
    const url = request.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  ```

  Note the existing matcher (line 203) excludes `_next/static`, images, and `.txt`/`.xml` — so `robots.txt`/`sitemap.xml` on the Railway host would **not** be caught by middleware. Mirror the apex pattern in `next.config.mjs` `redirects()` to also catch the Railway host for those file extensions:

  ```js
  {
    source: '/:path*',
    has: [{ type: 'host', value: '(.*)\\.up\\.railway\\.app' }],
    destination: 'https://www.propertyiq.app/:path*',
    permanent: true,
  },
  ```

  If the Railway URL must stay reachable for platform health checks, scope the health path out of the redirect and serve `X-Robots-Tag: noindex` on the rest of the Railway host instead — but a 308 is strictly better (it also consolidates link equity). Do **not** do both on the same URL (a redirected/ noindexed page can't pass a canonical). Verify after deploy: `curl -sI https://propertyiq.up.railway.app/markets/austin-round-rock-san-marcos-tx` → single `308` `Location: https://www.propertyiq.app/...`.

---

### 🟡 F2 — LOW/MEDIUM — `robots.txt` `Disallow: /api/` blocks the OG-image directory's parent, and Disallowed dirs are fine but verify no noindex collision

- **Google rule:** robots.txt manages crawl traffic, _not_ indexing; and never combine a robots.txt `Disallow` with `noindex` on the same URL (the `noindex` is never seen). Rubric 02 §B3/§D4.
  Source: https://developers.google.com/search/docs/crawling-indexing/robots/intro · https://developers.google.com/search/docs/crawling-indexing/block-indexing
- **Observed:** `app/robots.ts` disallows `/api/`, `/admin/`, `/auth/`, `/account/`, `/dev/`, `/health/`, `/betatest/`, with an explicit `Allow: /api/og` carve-out. Google honors the most-specific (longest-path) `Allow`, so `/api/og` is correctly crawlable despite the broader `Disallow: /api/`. No `_next/` disallow exists → rendering assets are not blocked (rubric 02 §F4 / 03 §D3 — **PASS**). The Disallowed dirs (`/admin/`, `/auth/`, `/account/`) are auth-gated app routes with no indexable value, which is correct.
- **Caveat to confirm (no collision found in this pass):** none of the Disallowed prefixes emit a page-level `noindex` that Google needs to read — they are gated behind auth (middleware redirects), so there is no Disallow+noindex trap today. **Action:** keep it that way; if any `/account/*` or `/auth/*` page is ever made public-but-noindex, remove its robots.txt `Disallow` so the `noindex` is crawlable.
- **Severity:** **LOW** (currently compliant; documented to prevent regression).
- **Exact fix:** none required now. Guardrail: do not add `noindex` to any path already in `commonDisallow` in `packages/frontend/app/robots.ts`.

---

### 🟢 F3 — PASS — Soft-404 handling on non-existent and sparse geographies

- **Google rule:** A page with no real content must NOT return 200; return a real 404/410, OR 200 with genuine content. A 200 "no data" shell is a soft-404 that wastes crawl budget. Rubric 02 §C5 (Critical), rubric 03 §D4.
  Source: https://developers.google.com/search/docs/crawling-indexing/http-network-errors
- **Observed (live):** fabricated `…/markets/this-is-not-a-real-city-zz` → **404**; fabricated `…/markets/zip/00000-nowhere-zz` → **404**. Sparse real ZIP Palmer AK `99645` → **200** with 51 KB of real content (PropertyIQ Score, median home price, market overview, internal links) — a genuine page, not an empty shell.
- **Observed (code):** `app/(public)/markets/[slug]/page.tsx` (line 68), `.../zip/[slug]/page.tsx` (line 69), `.../county/[slug]/page.tsx` (line 69) each call `notFound()` when the slug is absent from the static slug map (`SLUG_TO_METRO`/`SLUG_TO_ZIP`/`SLUG_TO_COUNTY`). `notFound()` yields a true HTTP 404 + `app/not-found.tsx`. Known/valid slugs always render full SEO content server-side (`generate-seo-content.ts` + `MarketStatsBlock`), with a `DataUnavailable`-style context pattern rather than a bare empty state.
- **Residual note (not a finding, monitor only):** the 404 boundary is "slug not in the precomputed list," **not** "no data rows for this geo." A slug that _is_ in the list but whose backend stats come back empty still renders 200. Because the slug lists are derived from the same geo universe that has data, and the page always renders region name + score + neighbor context + methodology (real content, never `|| fake`), this is the rubric-preferred "200 with real content" path, not a soft-404. **Action:** after each monthly data import, watch Search Console's "Soft 404" report; if any indexed market URL appears there, tighten the boundary to also `notFound()` when zero core metrics resolve.
- **Severity:** **PASS** (no action required; monitoring guidance above).

---

### 🟢 F4 — PASS — Self-referencing canonical correctness (absolute, canonical host, not request-derived)

- **Google rule:** Self-referencing absolute `rel=canonical` in `<head>`, hardcoded to the canonical host, never built from `headers().host` / `window.location`. Rubric 03 §A6 (Critical).
  Source: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- **Observed (live):** Birmingham `35201` and Palmer `99645` each emit an **absolute self-canonical on `www.propertyiq.app`**. Critically, even the **Railway host** emits a canonical to **www** (not to itself) — proving the canonical is hardcoded, not request-derived. This is exactly rubric §A6's requirement and the saving grace for F1.
- **Observed (code):** `generateMetadata` in every market route sets `alternates.canonical` to an absolute `https://www.propertyiq.app/...` literal (e.g. metro page line 25/31, zip page line 28/34, county page line 28/34). No `headers()`/`window.location` derivation anywhere.
- **Severity:** **PASS.**

---

### 🟢 F5 — PASS — Faceted / filter URL space is controlled

- **Google rule:** Don't let sort/filter UI emit unbounded crawlable URLs; consolidate parameter variants. Rubric 02 §E1-E4, rubric 03 §B4.
  Source: https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation
- **Observed (live):** `/map?metric=home_value&geo=zip&state=TX` returns 200 but its `<link rel=canonical>` is the **bare `https://www.propertyiq.app/map`** — query-param permutations all consolidate to one canonical, so they don't create an infinite crawlable index space. `/screener` self-canonicalizes. Both are `index, follow`, which is fine because the param variants fold into the bare canonical.
- **Severity:** **PASS.** (Defense-in-depth optional: if param URLs ever get linked with `<a href>`, consider `robots.txt` disallowing `?`-param crawl on `/map`/`/screener` — not needed today since the canonical already consolidates.)

---

### 🟢 F6 — PASS — Non-www → www and http → https consolidation (single hop)

- **Google rule:** Permanent, single-hop redirect of protocol/host variants to the canonical; avoid redirect chains. Rubric 03 §A4/§A5, rubric 02 §C2/§C3.
- **Observed (live):** `http://propertyiq.app/` → **301** `https://www.propertyiq.app` (1 hop); `https://propertyiq.app/` → **301** `https://www.propertyiq.app` (1 hop, final 200). No chain.
- **Observed (code):** middleware line 62-67 (301 for apex) + `next.config.mjs` redirects line 77-82 (catches `.xml`/`.txt` excluded by the middleware matcher). Belt-and-suspenders, correct.
- **Severity:** **PASS.** (Only the **Railway** host variant is unhandled — that is F1.)

---

### 🟢 F7 — PASS — Sitemap host hygiene & rendering-resource access

- `sitemap.xml` is a sitemap **index** referencing only `https://www.propertyiq.app/sitemaps/{main,states,metros,counties,zips}` — no Railway-host or HTTP URLs (rubric 03 §A7 — PASS).
- `robots.txt` does **not** `Disallow: /_next/` or CSS/JS, so Googlebot can render (rubric 02 §F4 / 03 §D3 — PASS).
- **Severity:** **PASS.**

---

## Priority action list

1. **F1 (HIGH):** add the `*.up.railway.app` → `www.propertyiq.app` 308 redirect in `middleware.ts` + a matching `next.config.mjs` `redirects()` entry for the `.txt`/`.xml` paths the middleware matcher excludes. This is the only material crawl/canonical defect found.
2. **F3 monitoring:** watch Search Console "Soft 404" monthly after each import; tighten the `notFound()` boundary to fire on zero-metric geos only if entries appear.
3. **F2 guardrail:** never add `noindex` to a path already in `robots.txt` `commonDisallow`.

Everything else (soft-404, self-canonical, faceted-URL consolidation, non-www/http redirects, sitemap host hygiene, rendering-resource access) is compliant.
