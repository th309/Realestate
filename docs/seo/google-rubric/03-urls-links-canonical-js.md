# Google SEO Rubric — URL Structure, Links, Canonicalization & JavaScript SEO

> Authoritative rules extracted directly from Google's own documentation at `developers.google.com`.
> Cluster 03 of the PropertyIQ Google SEO rubric.
>
> **Site context this rubric is written against:** Next.js App Router + React 19, **33,000+ programmatic
> location pages**, custom domain **`www.propertyiq.app`** that is **also reachable on the Railway alias
> `propertyiq.up.railway.app` serving byte-identical content** (a classic **duplicate-host** problem).
>
> Severity legend:
>
> - 🔴 **CRITICAL** — actively losing/blocking indexing or splitting ranking signals across hosts. Fix now.
> - 🟠 **HIGH** — meaningfully suppresses crawl/discovery or canonical selection at scale.
> - 🟡 **MEDIUM** — best practice; measurable but not catastrophic.
> - ⚪ **LOW** — hygiene / defense-in-depth.
>
> Each rule: **(a)** one-line rule · **(b)** WHY per Google · **(c)** HOW (Next.js App Router) · **(d)** source URL · **(e)** severity.

---

## ⭐ TL;DR — The five rules that matter most for THIS site

1. **🔴 Pick ONE canonical host and 301 the other.** `propertyiq.up.railway.app` must permanently redirect to `https://www.propertyiq.app` (or be blocked from indexing). Two hosts serving identical content = Google may pick the Railway URL as canonical and split your link signals. A permanent redirect is _"a strong signal that the target of the redirect should become canonical."_
2. **🔴 Self-referencing absolute `rel="canonical"` on every one of the 33k pages**, always pointing at the `www.propertyiq.app` host, never the Railway host. _"Use absolute paths rather than relative paths."_
3. **🔴 Every location page must be reachable via a real `<a href>` link** from another page. Google _"can only crawl your link if it's an `<a>` HTML element with an `href` attribute."_ `onClick`/`router.push`/`<button>` navigation is invisible — 33k pages with no `<a>` trail = 33k orphans.
4. **🟠 SSR/SSG the content, don't rely on client-only fetches.** Googlebot renders in a _deferred queue_; client-only sections (data fetched in `useEffect`) can be invisible even when the SSR HTML looks fine. Use Server Components / `generateStaticParams` / ISR.
5. **🟠 Readable, lowercase, hyphenated, parameter-light URLs.** `/markets/austin-tx` not `/markets?id=42&sort=...`. _"Use readable words rather than long ID numbers."_ Google treats `/Austin` and `/austin` as **two different URLs.**

---

# SECTION A — CANONICALIZATION (highest priority for the duplicate-host problem)

## A1. 🔴 Understand what Google is actually doing — it picks ONE canonical from a duplicate set

**(a) Rule:** When multiple URLs serve the same/similar content, Google clusters them and elects a single **canonical URL** to index and show; the rest are crawled less often.
**(b) WHY:** _"A canonical URL is the URL of a page that Google chose as the most representative from a set of duplicate pages."_ Google does this to _"show only one version of the otherwise duplicate content in its search results."_ The canonical _"will be crawled most regularly; duplicates are crawled less frequently in order to reduce the crawling load on sites."_ Critically, **all your preference signals are hints:** _"indicating a canonical preference is a hint, not a rule"_ and _"Google may choose a different page as canonical than you do."_
**(c) HOW:** Accept that you cannot _force_ the canonical; you can only stack strong signals (below) so the elected canonical is the one you want. For PropertyIQ, the duplicate set is `{www.propertyiq.app/X, propertyiq.up.railway.app/X}` for **every** page — you must make the `www.propertyiq.app` version win every cluster.
**(d)** https://developers.google.com/search/docs/crawling-indexing/canonicalization
**(e)** 🔴 CRITICAL (this is the lens for the whole duplicate-host issue)

## A2. 🔴 Duplicate content is not a penalty — but a wrong canonical splits your signals

**(a) Rule:** Having the same content on two hosts is not spam, but letting Google canonicalize the wrong host fragments ranking signals and skews analytics.
**(b) WHY:** _"some duplicate content on a site is normal and it's not a violation of Google's spam policies"_ — Google explicitly lists _"Protocol variants: HTTP and HTTPS versions"_ and region/device variants as normal causes. The cost is operational, not penal: multiple URLs _"creates poor user experience and makes performance tracking harder."_
**(c) HOW:** Don't panic about a "duplicate content penalty" (there isn't one). Do consolidate so link equity and crawl budget concentrate on `www.propertyiq.app`.
**(d)** https://developers.google.com/search/docs/crawling-indexing/canonicalization
**(e)** 🔴 CRITICAL

## A3. 🔴 The signals Google uses to choose a canonical (know their relative strength)

**(a) Rule:** Google weighs a known set of signals to elect the canonical; some are strong, some weak.
**(b) WHY:** Per Google: _"There are a handful of factors that play a role in canonicalization: whether the page is served over HTTP or HTTPS, redirects, presence of the URL in a sitemap, and `rel="canonical"` link annotations."_ Strength, per the consolidate-duplicate-URLs page:

| Signal                             | Strength (Google's exact wording)                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **301/308 redirect**               | _"A strong signal that the target of the redirect should become canonical."_                           |
| **`rel="canonical"` annotation**   | _"A strong signal that the specified URL should become canonical."_                                    |
| **Sitemap inclusion**              | _"A weak signal that helps the URLs that are included in a sitemap become canonical."_                 |
| **HTTPS over HTTP**                | _"Google prefers HTTPS pages over equivalent HTTP pages as canonical."_                                |
| **Internal linking consistency**   | _"Link consistently to the URL that you consider to be canonical."_ (links to a URL are a vote for it) |
| **Cleaner/shorter URL appearance** | Implicit tie-breaker (Google favors the more representative/cleaner URL)                               |

**(c) HOW for the duplicate-host fix — stack ALL strong signals toward `www.propertyiq.app`:**

1. **301 redirect** Railway host → `www.propertyiq.app` (strongest; see A4/A5).
2. **Self-referencing `rel="canonical"`** that always emits the `www.propertyiq.app` host (A6).
3. **Sitemap** lists only `www.propertyiq.app` URLs (A7).
4. **HTTPS** everywhere (already true on both — keep it).
5. **Internal links** always use the `www.propertyiq.app` host or root-relative paths that resolve there (A8).
   **(d)** https://developers.google.com/search/docs/crawling-indexing/canonicalization · https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
   **(e)** 🔴 CRITICAL

## A4. 🔴 DUPLICATE-HOST FIX (primary): 301 the Railway alias to the custom domain

**(a) Rule:** Permanently redirect every `propertyiq.up.railway.app/*` request to the same path on `https://www.propertyiq.app/*`.
**(b) WHY:** A permanent server-side redirect is the **strongest** consolidation signal — _"a signal that the redirect target should be canonical"_ — and it _"consolidates ranking signals to the target URL."_ It removes the duplicate from the crawlable web entirely, so Google never has to choose. Google: _"If you need to change the URL of a page as it is shown in search engine results, we recommend that you use a permanent server-side redirect whenever possible"_ and _"For the quickest effect, use HTTP (also known as server-side) redirects."_
**(c) HOW (Next.js App Router):** Do it at the edge before rendering. In `middleware.ts`, detect the Railway host and 308-redirect to the apex/www host:

```ts
// middleware.ts
import { NextResponse, type NextRequest } from "next/server";

const CANONICAL_HOST = "www.propertyiq.app";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (host !== CANONICAL_HOST && host.endsWith(".up.railway.app")) {
    const url = req.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308); // 308 = permanent, preserves method
  }
  return NextResponse.next();
}
export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
```

> Google treats **301 and 308 identically** as permanent canonical signals. 308 preserves the HTTP method on POST, which is safer for any form endpoints.
> **Alternative if you must keep the Railway URL live** (e.g. health checks): serve `X-Robots-Tag: noindex` on the Railway host instead of redirecting — but a 301 is strictly better for SEO because it also consolidates link equity. Do **not** do both (a noindex page can't pass its redirect target as canonical).
> **(d)** https://developers.google.com/search/docs/crawling-indexing/301-redirects
> **(e)** 🔴 CRITICAL

## A5. 🟠 Avoid redirect chains, JS redirects, and "crypto" redirects for the host fix

**(a) Rule:** Use a single-hop server-side 301/308; never a JS `location` redirect or a manual "click here" link as the host-consolidation mechanism.
**(b) WHY:** Google's redirect-strength order is server-side (strongest) → meta refresh → HTTP refresh header → **JavaScript `location` (weakest, may never be seen)** → crypto redirects (weakest, not recognized). On JS redirects: _"rendering may fail for various reasons… if you set a JavaScript redirect, Google might never see it."_ On crypto: _"Don't rely on crypto redirects for letting search engines know that your content has moved unless you have no other choice."_ Redirect chains dilute and slow signal transfer.
**(c) HOW:** The `middleware.ts` redirect in A4 is server-side and single-hop. Ensure HTTP→HTTPS and apex→www are folded into that same hop (don't chain `railway → apex → www → https`). Verify with `curl -sI` that exactly one `Location:` hop reaches the final `https://www.propertyiq.app/...`.
**(d)** https://developers.google.com/search/docs/crawling-indexing/301-redirects
**(e)** 🟠 HIGH

## A6. 🔴 Self-referencing absolute canonical on every page, hard-coded to the canonical host

**(a) Rule:** Every indexable page emits `<link rel="canonical" href="https://www.propertyiq.app/...">` pointing at itself **on the canonical host**, using an absolute URL, in the `<head>`.
**(b) WHY:** A `rel="canonical"` annotation is _"a strong signal that the specified URL should become canonical."_ Google requires absolute URLs — _"Use absolute paths rather than relative paths with the `rel="canonical"` link element"_ (good: `https://www.example.com/dresses/green/green-dress.html`; bad: `/dresses/green/green-dress.html`). The element _"is only accepted if it appears in the `<head>` section."_ Self-referencing canonicals are Google's recommended default: _use a self-referencing `<link rel="canonical">` on all indexable pages and include those URLs in a sitemap file._ The **absolute host is the whole point here**: if the canonical were relative or host-derived, the Railway host would emit a canonical pointing at _itself_, defeating consolidation.
**(c) HOW (Next.js App Router):** Set `metadataBase` to the canonical origin and use `alternates.canonical` so Next resolves the absolute URL against the **canonical host regardless of which host served the request**:

```ts
// app/layout.tsx
export const metadata = {
  metadataBase: new URL("https://www.propertyiq.app"),
};

// app/markets/[slug]/page.tsx
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  return { alternates: { canonical: `/markets/${params.slug}` } }; // -> https://www.propertyiq.app/markets/<slug>
}
```

> ⚠️ **Pitfall:** never build the canonical from `headers().get('host')` or `window.location` — on the Railway host that yields a self-canonical to Railway. Hard-code `metadataBase` to `www.propertyiq.app`.
> ⚠️ Do **not** set the canonical with client JS if it isn't already in the server HTML pointing somewhere else — _"you shouldn't use JavaScript to change the canonical URL to something else than the URL you specified as the canonical URL in the original HTML."_ With `generateMetadata` it's in the SSR `<head>`, which is correct.
> **(d)** https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
> **(e)** 🔴 CRITICAL

## A7. 🟠 One sitemap, canonical host only, listing all 33k canonical URLs

**(a) Rule:** Generate XML sitemap(s) containing only `https://www.propertyiq.app/...` URLs (the self-canonical of each page); never list Railway-host or HTTP URLs.
**(b) WHY:** Sitemap presence is a (weak) canonical signal and the primary discovery mechanism for large programmatic sites. _"Pick a canonical URL for each of your pages and submit them in a sitemap."_ Google warns against polluting it: don't include HTTP versions or non-canonical hosts in sitemaps/hreflang.
**(c) HOW (Next.js App Router):** Use `app/sitemap.ts` (or a generated set of sitemaps + a sitemap index — a sitemap file caps at 50,000 URLs / 50 MB, so 33k fits in one, but plan for index splitting as you grow). Absolute URLs from `metadataBase`:

```ts
// app/sitemap.ts
export default async function sitemap() {
  const slugs = await getAllMarketSlugs();
  return slugs.map((slug) => ({
    url: `https://www.propertyiq.app/markets/${slug}`,
    lastModified: ...,
  }));
}
```

**(d)** https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
**(e)** 🟠 HIGH

## A8. 🟠 Link consistently to the canonical host internally

**(a) Rule:** All internal links resolve to the canonical host — use root-relative `href="/markets/austin-tx"` (which inherits the request host but, because Railway is 301'd away, always lands on `www.propertyiq.app`) and never hard-code the Railway host anywhere.
**(b) WHY:** _"When linking within your site, link to the canonical URL rather than a duplicate URL"_ and _"Link consistently to the URL that you consider to be canonical."_ Internal links are votes; inconsistent linking muddies the canonical cluster.
**(c) HOW:** Prefer root-relative `<Link href="/...">` everywhere (App Router `next/link`). For anything absolute (Open Graph `og:url`, RSS, emails, JSON-LD), build from `metadataBase` so it's always `www.propertyiq.app`. Grep the codebase for `railway.app` string literals and remove them from any user-facing link/markup.
**(d)** https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
**(e)** 🟠 HIGH

## A9. 🟡 Don't send conflicting canonical signals or use the wrong tools

**(a) Rule:** One canonical preference per page across all methods; never use robots.txt, the URL-removal tool, or `noindex` to "canonicalize."
**(b) WHY:** Google's explicit don'ts: _"Don't specify different URLs as canonical for the same page using different canonicalization techniques"_; _"Don't use the robots.txt file for canonicalization purposes"_; _"Don't use the URL removal tool for canonicalization"_; _"We don't recommend using `noindex` to prevent selection of a canonical page within a single site"_; _"Don't specify a URL fragment as canonical."_ Conflicting signals make Google ignore your preference.
**(c) HOW:** Ensure the 301 (A4), the `rel="canonical"` (A6), the sitemap (A7), and internal links (A8) **all agree** on `www.propertyiq.app`. Don't also add a robots.txt `Disallow` on the Railway host expecting it to consolidate — that just blocks crawling without passing signal.
**(d)** https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
**(e)** 🟡 MEDIUM

## A10. 🟠 Cross-domain canonical is supported — but a 301 is better for an identical alias

**(a) Rule:** `rel="canonical"` _can_ point across domains (canonical URL may live on a different domain than the duplicate), but for an **identical** alias you control, prefer the 301.
**(b) WHY:** Per Google's cross-domain guidance, you may _"use the `rel="canonical"` link element across domains to specify the exact URL of whichever domain is preferred for indexing"_ and _"the pages don't need to be absolutely identical; slight differences are fine."_ But it remains a hint, and **a 301 both consolidates signals and removes the duplicate from crawling** — strictly stronger when you fully control the alias (which you do for Railway).
**(c) HOW:** Use the 301 (A4). Reserve cross-domain `rel="canonical"` for cases where you _can't_ redirect (e.g., a syndication partner hosting your content). **Security note from Google:** hacks sometimes inject a cross-domain `rel="canonical"` or 301 pointing at spam — monitor for unexpected canonicals in Search Console.
**(d)** https://developers.google.com/search/blog/2009/12/handling-legitimate-cross-domain · https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
**(e)** 🟠 HIGH

## A11. 🟡 Troubleshooting: verify which canonical Google actually chose

**(a) Rule:** After deploying the fix, confirm Google elected `www.propertyiq.app` via Search Console.
**(b) WHY:** Google: _"Use the URL Inspection tool to check which page Google considers canonical."_ Google _"might choose a different canonical for various reasons, such as the quality of the content."_ The troubleshooting page lists causes of a wrong pick: language variants without `hreflang`, CMS emitting an unexpected canonical, **misconfigured servers returning identical content across domains** (exactly the duplicate-host case), hacking, and syndication. Relevant Page-Indexing report statuses to watch:

- **"Duplicate without user-selected canonical"** — you didn't declare a canonical; Google guessed.
- **"Duplicate, Google chose different canonical than user"** — your `rel="canonical"`/301 was overridden; signals conflict or content quality differs.
- **"Alternate page with proper canonical tag"** — healthy: the duplicate correctly defers to your canonical.
  **(c) HOW:** In Search Console → URL Inspection on a `www.propertyiq.app` market page, confirm "User-declared canonical" and "Google-selected canonical" both = the `www` URL. Watch the Page Indexing report for the "Duplicate, Google chose different canonical" bucket shrinking to zero after the 301 ships.
  **(d)** https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting
  **(e)** 🟡 MEDIUM

---

# SECTION B — URL STRUCTURE (programmatic pages at scale)

## B1. 🟠 Use readable words, not ID numbers

**(a) Rule:** `/markets/austin-tx` — not `/markets?id=42` or `/p?topic=42&area=3a5ebc`.
**(b) WHY:** _"When possible, use readable words rather than long ID numbers in your URLs."_ Google's example: `example.com/wiki/Aviation` over `example.com/index.php?topic=42&area=3a5ebc944f41daa6f849f730f1`. Readable URLs help users and Google understand the page.
**(c) HOW (App Router):** Dynamic segment `app/markets/[slug]/page.tsx` with human slugs (`austin-tx`, `travis-county-tx`); resolve slug→geo-id server-side. Generate slugs deterministically from region names in `generateStaticParams`.
**(d)** https://developers.google.com/search/docs/crawling-indexing/url-structure
**(e)** 🟠 HIGH

## B2. 🔴 Lowercase everything — Google treats case as distinct URLs

**(a) Rule:** Emit all URLs lowercase; never mix `/Austin` and `/austin`.
**(b) WHY:** _"Google treats both `/APPLE` and `/apple` as distinct URLs with their own content."_ Mixed case silently creates duplicate-URL clusters across your 33k pages.
**(c) HOW:** Lowercase slugs at generation time; add a normalizing 301 in `middleware.ts` if any uppercase URLs could be requested (redirect `/Austin-TX` → `/austin-tx`). Keep `generateStaticParams` output strictly lowercase.
**(d)** https://developers.google.com/search/docs/crawling-indexing/url-structure
**(e)** 🔴 CRITICAL (at 33k pages, case drift doubles your duplicate surface)

## B3. 🟡 Hyphens, not underscores, between words

**(a) Rule:** `summer-clothing`, not `summer_clothing`.
**(b) WHY:** _"We recommend using hyphens (`-`) instead of underscores (`_`) to separate words"_ because _"underscores denote concepts that should be kept together."_
**(c) HOW:** Slugify with hyphen as the separator; strip/replace underscores. Applies to query keys too (`color-profile=dark-grey`).
**(d)** https://developers.google.com/search/docs/crawling-indexing/url-structure
**(e)** 🟡 MEDIUM

## B4. 🟠 Trim unnecessary URL parameters; never let filters explode the URL space

**(a) Rule:** Keep only parameters that change page content; block/avoid faceted-filter combinatorial explosions, session IDs, and tracking params.
**(b) WHY:** _"Shorten URLs by trimming unnecessary parameters (meaning, parameters that don't change the content)."_ Avoid _"unnecessarily high numbers of URLs that point to identical or similar content"_ — additive filter combos waste crawl budget and create duplicates. Replace session IDs with cookies; block referral/sort/session params.
**(c) HOW:** For programmatic pages, bake the page identity into the **path** (`/markets/austin-tx`), not query params. If you add filters/sorts, either render them client-side without changing the URL, or `Disallow` the parameterized variants in `robots.txt` and keep a clean canonical. Use proper `?key=value&key2=value2` encoding if params are unavoidable.
**(d)** https://developers.google.com/search/docs/crawling-indexing/url-structure
**(e)** 🟠 HIGH (33k base pages × filter combos = index bloat risk)

## B5. 🟡 Locale/region in the path, percent-encode non-ASCII, no content-changing fragments

**(a) Rule:** Geotarget via subdirectory (`/de/`) or ccTLD; percent-encode non-ASCII per STD 66; **never** use `#` fragments to change content.
**(b) WHY:** _"Consider using a URL structure that makes it easy to geotarget your site"_ (e.g. `example.com/de/`). _"Characters defined by the standard as reserved must be percent encoded."_ _"Don't use fragments to change the content of a page, as Google Search generally doesn't support URL fragments."_
**(c) HOW:** PropertyIQ is US-only today, so locale paths are likely N/A — but if international launches, use `/{locale}/...` segments + `hreflang`. Keep slugs ASCII/transliterated. Never route page content off `#` (see C5/D5).
**(d)** https://developers.google.com/search/docs/crawling-indexing/url-structure
**(e)** 🟡 MEDIUM

## B6. ⚪ Root-relative internal links; `nofollow` infinite/auto-generated link spaces

**(a) Rule:** Use root-relative (`/category/x`) not parent-relative (`../../x`) links; `nofollow` infinite spaces (e.g., future-dated calendar links).
**(b) WHY:** Parent-relative links on the wrong page _"create bogus URLs and infinite spaces."_ _"Add a `nofollow` attribute to links to dynamically created future calendar pages."_
**(c) HOW:** `next/link` with root-relative `href`. If any auto-generated "next period" navigation could spiral (e.g., paginated time-series with no end), add `rel="nofollow"` or cap the range.
**(d)** https://developers.google.com/search/docs/crawling-indexing/url-structure
**(e)** ⚪ LOW

---

# SECTION C — CRAWLABLE LINKS (discovery of 33k pages)

## C1. 🔴 Google ONLY follows `<a href="real-url">` — this gates all discovery

**(a) Rule:** Links must be `<a>` elements with an `href` resolving to a real URL. Period.
**(b) WHY:** _"Google can only crawl your link if it's an `<a>` HTML element with an `href` attribute."_ The `href` must resemble a valid URI. This is the single hard gate on whether your 33k pages are discoverable.

**Crawlable (Google parses these):**

```html
<a href="https://example.com">
  <a href="/products/category/shoes">
    <a href="./products/category/shoes">
      <a href="/products/category/shoes" onclick="javascript:goTo('shoes')">
        <!-- has real href -->
        <a href="/products/category/shoes" class="pretty"></a></a></a></a
></a>
```

**NOT crawlable / not recommended:**

```html
<a routerLink="products/category">
  <!-- no href -->
  <span href="https://example.com">
    <!-- not an <a> -->
    <a onclick="goto('https://example.com')">
      <!-- no href -->
      <a href="javascript:goTo('products')">
        <!-- href is JS, not a URL -->
        <a href="javascript:window.location.href='/products'">
          <button onClick="{()" ="">
            router.push('/x')}>
            <!-- button, no href -->
          </button></a
        ></a
      ></a
    ></span
  ></a
>
```

**(c) HOW (App Router):** Use `next/link` (`<Link href="/markets/austin-tx">`) — it renders a real `<a href>`. **Never** navigate between location pages with `<button onClick={router.push()}>`, `<div onClick>`, or `router.push` from non-anchor elements for primary discovery paths. Any "Explore markets" UI that uses JS handlers must _also_ expose real `<a href>` links to every target.
**(d)** https://developers.google.com/search/docs/crawling-indexing/links-crawlable
**(e)** 🔴 CRITICAL

## C2. 🔴 No orphan pages — every page needs ≥1 incoming `<a href>` link

**(a) Rule:** Every one of the 33k location pages must be linked from at least one other page on the site.
**(b) WHY:** _"Every page you care about should have a link from at least one other page on your site."_ Sitemaps help discovery but internal links are how Google finds, prioritizes, and passes equity. A page in the sitemap but linked from nowhere is effectively orphaned.
**(c) HOW (programmatic linking at scale):** Build a crawlable internal-link graph:

- **Hub/index pages** with real `<a>` lists (e.g., `/markets` → state hubs → metro/county/zip pages). Paginate or cluster so each page links to a finite, crawlable set.
- **Related-markets / nearby-geography** `<a href>` blocks on each page (parent county, sibling metros, contained ZIPs) — this also distributes link equity deep into the 33k.
- **Breadcrumb `<a>` links** (ZIP → county → metro → state → national).
- The XML sitemap (A7) is a backstop, **not a substitute** for the link graph.
  **(d)** https://developers.google.com/search/docs/crawling-indexing/links-crawlable
  **(e)** 🔴 CRITICAL (single biggest risk for a 33k programmatic build)

## C3. 🟡 Descriptive, concise, relevant anchor text

**(a) Rule:** Anchor text should describe the destination; avoid "click here"/"read more."
**(b) WHY:** _"Anchor text tells people and Google something about the page you're linking to."_ It should be _"descriptive, reasonably concise, and relevant to the page that it's on."_ Test: does the anchor make sense without surrounding context?
**(c) HOW:** Link with the market name + intent, e.g. `Austin, TX housing market` not `View`. For image links, set `alt`; Google uses `title` as a fallback for empty anchors.
**(d)** https://developers.google.com/search/docs/crawling-indexing/links-crawlable
**(e)** 🟡 MEDIUM

## C4. 🟡 Qualify outbound links with `rel="sponsored" | "ugc" | "nofollow"`

**(a) Rule:** Tag paid links `sponsored`, user-generated links `ugc`, and use `nofollow` when none apply / you don't want association.
**(b) WHY:** _"Mark links that are advertisements or paid placements… with the `sponsored` value."_ _"We recommend marking user-generated content (UGC) links, such as comments and forum posts, with the `ugc` value."_ _"Use the `nofollow` value when other values don't apply, and you'd rather Google not associate your site with, or crawl the linked page from, your site."_ These are **hints, not directives** — _links so marked "will generally not be followed,"_ but pages may still be found via sitemaps/other links. Values combine: `rel="ugc nofollow"`.
**(c) HOW:** Affiliate/partner links → `rel="sponsored"`. Any future comments/forum/user-submitted links → `rel="ugc"`. Internal links between your own pages must **never** be nofollowed (don't block your own crawl).
**(d)** https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links
**(e)** 🟡 MEDIUM

## C5. 🔴 SPA routing must use the History API and produce real `<a href>` URLs

**(a) Rule:** Client-side route transitions must change the URL via the History API and be backed by real, server-resolvable `<a href>` URLs — never `#`-fragment routes.
**(b) WHY:** _"Google can only discover your links if they are `<a>` HTML elements with an `href` attribute."_ For SPAs: _"use the History API to implement routing… don't use fragments to load different page content"_ because with `href="#/products"` _"Googlebot can't reliably resolve the URLs."_
**(c) HOW:** App Router already uses the History API via `next/link`/`useRouter` and every route is a real server URL — compliant by default. The trap is hand-rolled in-page navigation (tabs, "load more", map-driven views) that mutates state without a real URL. If such views hold indexable content, give each a real route + `<a href>`.
**(d)** https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
**(e)** 🔴 CRITICAL (if any location content lives behind fragment/JS-only views)

---

# SECTION D — JAVASCRIPT SEO (the "SSR looks fine but client-only sections are invisible" trap)

## D1. 🔴 Googlebot crawls → QUEUES → renders; rendering is deferred

**(a) Rule:** Treat rendering as a separate, deferred phase — content that only appears after client JS executes may index late or not at all.
**(b) WHY:** Google processes JS in three phases — **Crawling → Rendering → Indexing**. _"Googlebot queues all pages with a `200` HTTP status code for rendering, unless a robots meta tag or header tells Google not to index the page. The page may stay on this queue for a few seconds, but it can take longer than that."_ Rendering runs in headless Chromium **after** the initial HTML crawl.
**(c) HOW (App Router):** Put indexable content in the **server-rendered HTML**, not client-only fetches:

- **Server Components** (default in App Router) — data fetched on the server lands in the initial HTML. ✅
- **`generateStaticParams` + SSG/ISR** for the 33k market pages — pre-render at build/revalidate so HTML is complete on first crawl. ✅
- Avoid `'use client'` + `useEffect`-only data fetching for primary content (D2).
  **(d)** https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
  **(e)** 🔴 CRITICAL

## D2. 🔴 THE TRAP: client-only content is invisible even when SSR HTML looks healthy

**(a) Rule:** Anything rendered only on the client (fetched in `useEffect`, behind interaction, or in a `'use client'` island that fetches its own data) can be missing from what Google indexes — even though `view-source` of the shell returns 200 and looks fine.
**(b) WHY:** Google's fix-JS guidance: rendered DOM ≠ page source; _content requiring user interaction won't be indexed_ (_"Expect Googlebot to decline"_ permission prompts; interaction-gated content isn't triggered). _"WRS does not retain state across page loads: Local Storage and Session Storage data are cleared… HTTP Cookies are cleared across page loads."_ So a section that hydrates from `localStorage`, a cookie, or a post-load client fetch may render empty for Googlebot. JS paywalls that hide server-delivered content client-side are _"not a reliable way to limit access"_ — same mechanism that accidentally hides content.
**(c) HOW:** For each market page, ask **"is the key content (score, metrics, narrative) in the server HTML?"**

- Move data fetching into Server Components / page-level `async` functions so values are in the SSR HTML.
- If a client island must show data, **pass it as props from the server** (server fetches, client renders) rather than the client fetching after mount.
- Don't gate indexable content behind clicks, tabs, infinite scroll, or geolocation.
- **Verify** with Search Console **URL Inspection → View crawled page / rendered HTML** and **Rich Results Test** — these show the _rendered_ DOM Google sees, not `view-source`. Confirm score/metrics text is present.
  **(d)** https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript
  **(e)** 🔴 CRITICAL

## D3. 🟠 Don't block JS/CSS resources in robots.txt

**(a) Rule:** Allow Googlebot to fetch the JS and CSS needed to render.
**(b) WHY:** _"Google Search won't render JavaScript from blocked files or on blocked pages."_ Blocking `/_next/static/*` or your CSS in robots.txt breaks rendering → content disappears.
**(c) HOW:** Ensure `robots.txt` does **not** `Disallow: /_next/` or static asset paths. Default Next deployments are fine; audit any custom `robots.txt`/middleware rules. (App Router `app/robots.ts` should not disallow build assets.)
**(d)** https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
**(e)** 🟠 HIGH

## D4. 🟠 Return meaningful HTTP status codes — kill soft 404s on missing geos

**(a) Rule:** A non-existent market URL must return a real `404`, not a 200 "no data" shell.
**(b) WHY:** _"Googlebot uses HTTP status codes to find out if something went wrong."_ SPAs/programmatic pages often 200 their error states → **soft 404s** that waste crawl budget and can suppress real pages. Google's two fixes: _"Use a JavaScript redirect to a URL for which the server responds with a 404"_ **or** _"Add a `<meta name="robots" content="noindex">` to error pages."_
**(c) HOW (App Router):** In `app/markets/[slug]/page.tsx`, call `notFound()` (renders `not-found.tsx` with a real 404) when the slug has no underlying geo/data. For thin-but-valid geos, decide deliberately: real content (preferred) or `noindex`. Never serve a 200 "Market not found" page.
**(d)** https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript · https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
**(e)** 🟠 HIGH (33k generated routes = high soft-404 surface)

## D5. 🟡 Unique server-rendered `<title>`/meta per page; canonical/robots caveats; content fingerprinting

**(a) Rule:** Every page needs a unique, descriptive `<title>` and meta description in the SSR HTML; respect JS caveats for canonical and robots meta; fingerprint assets.
**(b) WHY:** _"Unique, descriptive `<title>` elements and meta descriptions help users quickly identify the best result."_ Canonical caveat (A6): don't JS-rewrite a canonical that's already in HTML. Robots caveat: _"When Google encounters the `noindex` tag, it may skip rendering and JavaScript execution"_ — so you can't reliably _remove_ a `noindex` with JS. Caching: _"Googlebot caches aggressively… WRS may ignore caching headers"_ → use _"content fingerprinting"_ (`main.2bb85551.js`).
**(c) HOW:** `generateMetadata` per route emits unique server-side `<title>`/description for each of the 33k markets (e.g., `Austin, TX Real Estate Market Data | PropertyIQ`). Never start a page with `noindex` and try to clear it client-side. Next.js already content-hashes `/_next/static` filenames — keep that.
**(d)** https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics · https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript
**(e)** 🟡 MEDIUM

## D6. 🟡 Lazy-load images search-friendly; flatten Web Components; HTTP-only data, feature-detect

**(a) Rule:** Follow Google's lazy-loading guidance; ensure shadow-DOM content renders; don't rely on WebSockets/WebRTC for indexable data; feature-detect with fallbacks.
**(b) WHY:** Improper lazy-loading hides images from Google. Google _"flattens the shadow DOM and light DOM… can only see content that's visible in the rendered HTML"_ (use `<slot>`). _"Googlebot uses HTTP requests… does not support… WebSockets or WebRTC."_ _"Ensure that your application uses feature detection for all critical APIs… provide a fallback behavior or polyfill."_
**(c) HOW:** Use `next/image` (handles search-friendly lazy-loading). Deliver market data over HTTP (REST/Server Components), never push-only sockets for indexable content. Any geolocation/permission-gated feature needs a non-gated fallback so Googlebot still sees content.
**(d)** https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics · https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript
**(e)** 🟡 MEDIUM

## D7. 🟠 Do NOT use dynamic rendering — use SSR/SSG/ISR instead

**(a) Rule:** Don't reach for a bot-detecting prerender service; render on the server.
**(b) WHY:** Google now classifies dynamic rendering as legacy: _"Dynamic rendering was a workaround and not a long-term solution for problems with JavaScript-generated content in search engines"_ and _"it creates additional complexities and resource requirements."_ Google recommends **server-side rendering, static rendering, and hydration** instead.
**(c) HOW (App Router):** You already have the right tools — Server Components (SSR), `generateStaticParams` (SSG), `revalidate`/ISR, and React hydration. Render the 33k pages with SSG/ISR; do not add a Rendertron/Prerender.io layer. This maps Next.js _directly_ onto Google's recommended strategy.
**(d)** https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering
**(e)** 🟠 HIGH

---

## Verification checklist (prove it, don't assume it)

- [ ] `curl -sI https://propertyiq.up.railway.app/markets/austin-tx` → single `301/308` `Location: https://www.propertyiq.app/markets/austin-tx` (A4/A5).
- [ ] `curl -s https://www.propertyiq.app/markets/austin-tx | grep -i canonical` → absolute `www.propertyiq.app` self-canonical (A6).
- [ ] Same `curl` on the **Railway host** must NOT emit a self-canonical to Railway (it should redirect first) (A6).
- [ ] Sitemap contains only `https://www.propertyiq.app/...` URLs (A7).
- [ ] Search Console URL Inspection: Google-selected canonical = the `www` URL; "Duplicate, Google chose different canonical" bucket → 0 (A11).
- [ ] URL Inspection **rendered HTML** shows score/metrics/narrative text present (not just the app shell) (D2).
- [ ] Every market page reachable by clicking only real `<a href>` links from `/markets` (C1/C2).
- [ ] Nonexistent slug returns real `404` (`notFound()`), not a 200 shell (D4).
- [ ] `robots.txt` does not disallow `/_next/` or CSS/JS (D3).
- [ ] All slugs lowercase + hyphenated; uppercase requests 301 to lowercase (B2/B3).

---

### Source index

- URL structure — https://developers.google.com/search/docs/crawling-indexing/url-structure
- Crawlable links — https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- Qualify outbound links — https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links
- Canonicalization (overview) — https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Consolidate duplicate URLs (how to specify canonical) — https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Canonicalization troubleshooting — https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting
- Cross-domain content duplication (blog) — https://developers.google.com/search/blog/2009/12/handling-legitimate-cross-domain
- Redirects & canonicalization — https://developers.google.com/search/docs/crawling-indexing/301-redirects
- JavaScript SEO basics — https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Fix JavaScript problems — https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript
- Dynamic rendering (legacy) — https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering
