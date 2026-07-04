# Google SEO Rubric — Cluster 06: Specific Structured-Data Types + Image/Video SEO

Authoritative rubric built by reading Google's OWN documentation at developers.google.com (fetched 2026-06-19). For each structured-data type and for image/video SEO this records: required properties, recommended properties, eligibility/deprecation status, common errors, exact source URL, and the severity of getting it wrong.

This site currently emits exactly these schema types: **Organization**, **SoftwareApplication (+ Offer)**, **WebSite + SearchAction (sitelinks searchbox)**, **BreadcrumbList**, **Dataset**, **FAQPage**, **Article**. Every one is validated below, plus image SEO.

---

## VERDICT SUMMARY (per type)

| Type                         | Verdict                       | One-line reason                                                                                                         |
| ---------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Organization                 | **USE (high value)**          | Powers logo + knowledge panel; place on homepage with logo/url/sameAs/contactPoint                                      |
| SoftwareApplication (+Offer) | **USE / fix**                 | Eligible as `WebApplication`; needs `name` + one of rating/review/`offers.price`                                        |
| WebSite + SearchAction       | **DROP markup, KEEP WebSite** | Sitelinks searchbox DEPRECATED Nov 2024 (feature removed). SearchAction is dead weight; keep bare WebSite for site-name |
| BreadcrumbList               | **USE (high value)**          | Live rich result; cheap, broadly eligible; ensure ≥2 items, position starts at 1                                        |
| Dataset                      | **USE — BIG OPPORTUNITY**     | Eligible in Dataset Search vertical; ideal for 33k market-data pages                                                    |
| FAQPage                      | **DROP (no rich result)**     | Restricted Aug 2023 to gov/health sites; a real-estate SaaS gets NO rich result                                         |
| Article                      | **USE for blog**              | No required props; improves title/image/date presentation for blog content                                              |

---

## 1. Organization

**Source:** https://developers.google.com/search/docs/appearance/structured-data/organization
**Verdict: USE (high value).** **Severity of getting it wrong: MEDIUM-HIGH** — this is what controls your logo and helps disambiguate your brand in the knowledge panel.

### Required properties

- **None.** Google: _"There are no required properties; instead, add the properties that apply to your organization."_

### Recommended properties (the ones that matter for us)

- `name` — organization name (use the same name/`alternateName` as your site name).
- `url` — website URL; _helps Google uniquely identify your organization_.
- `logo` — representative image shown in knowledge panels and search results.
- `sameAs` — URLs to the org's profiles on other sites (LinkedIn, X, Crunchbase, etc.).
- `contactPoint` — email + telephone (with country/area codes).
- `address` — physical/mailing address (optional for SaaS, but a trust signal).
- `description`, `vatID` — additional trust signals.

### Logo requirements (verbatim)

- Minimum size: _"112x112px, at minimum"_.
- _"The image URL must be crawlable and indexable."_
- Format must be one Google Images supports.
- _"Make sure the image looks how you intend it to look on a purely white background."_

### Placement

- _"We recommend placing this information on your home page, or a single page that describes your organization, for example the about us page."_

### Knowledge panel note

Google does not publish explicit knowledge-panel eligibility criteria. It states some properties _"are used behind the scenes to disambiguate your organization"_ (`iso6523`, `naics`) while _"others can influence visual elements in Search results (such as which logo is shown)."_

### Common errors / deprecations

- Manual action risk for non-compliant/spammy markup.
- `duns` and `leiCode` deprecated in favor of `iso6523Code` (prefixes `0060:` and `0199:`). Not relevant to us.
- Validate via Search Console's "Unparsable structured data" report.

---

## 2. SoftwareApplication (+ Offer)

**Source:** https://developers.google.com/search/docs/appearance/structured-data/software-app
**Verdict: USE / fix.** **Severity: MEDIUM** — eligible and produces a rich result, but easy to get wrong by omitting the required "one of" property.

### Required properties

1. `name` (Text).
2. **One of**: `aggregateRating`, OR `review`, OR `offers` (with `offers.price`).
   - Google: _"If the app is available without payment, set offers.price to 0"_ and _"recommend also including the offers.priceCurrency property."_

### Recommended properties

- `applicationCategory` — from Google's supported list (`BusinessApplication`, `FinanceApplication`, etc.).
- `operatingSystem` — e.g. `Windows 7`, `Android 1.6` (use a generic value or "Any" for a pure web app).

### Eligibility & content-type restrictions

- Google supports three subtypes: `SoftwareApplication` (general), `MobileApplication`, **`WebApplication`**.
- **Web-based SaaS qualifies** — `WebApplication` is an explicitly supported subtype. Google gives no SaaS-specific restriction.
- Restriction to know: _"Google doesn't show a rich result for Software Apps that only have the VideoGame type. To make sure that your Software App is eligible for display as a rich result, co-type the VideoGame type with another type."_ (Not relevant to us — we are not a game.)

### Offer requirements

- `price` required (use `0` for free).
- `priceCurrency` recommended when price > 0 (e.g. `USD`). Our paid tier ($39/mo) MUST set `priceCurrency`.

### Common errors / deprecations

- Omitting the required "one of" (rating/review/offers) → no rich result.
- No deprecation notices for this type.

**Action for our site:** keep it, but verify `name` + a valid `offers` block with `price` and `priceCurrency`. Consider co-typing/categorizing as `WebApplication` + `applicationCategory: BusinessApplication`.

---

## 3. WebSite + SearchAction (Sitelinks Searchbox) — DEPRECATED

**Sources:**

- https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox (docs removed)
- https://developers.google.com/search/blog/2024/10/sitelinks-search-box ("Farewell, Sitelinks Search Box")

**Verdict: DROP the SearchAction markup; KEEP a bare WebSite for site-name.** **Severity: LOW** (harmless if left, but it's dead weight and misleads anyone reading the codebase into thinking it does something).

### Deprecation status — VERBATIM

- Google's Nov 29, 2024 changelog: **"Removed the sitelinks search box documentation and archived the `nositelinkssearchbox` rule."**
- Rationale: **"The sitelinks search box feature is no longer available in Google Search results."**
- Timeline: the visual element was removed from Search results starting **November 21, 2024**, globally, in all languages and countries. Google noted _"over time, we've noticed that usage has dropped."_

### What this means for our markup

- The `WebSite` + `potentialAction`/`SearchAction` JSON-LD **no longer produces any rich result.** It is inert.
- You may remove it. Google: unsupported structured data like this **won't cause problems** if left in place.
- **IMPORTANT nuance:** the _site name_ feature uses a _different variation of_ `WebSite` structured data which **continues to be supported**. So: drop the `SearchAction`/`potentialAction` block, but a minimal `WebSite` (with `name`/`url`) is still worth keeping for the site-name feature.
- Removed from Search Console reports and the Rich Results Test.

**Action for our site:** strip `potentialAction`/`SearchAction` from the WebSite JSON-LD; retain `WebSite { name, url }`.

---

## 4. BreadcrumbList

**Source:** https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
**Verdict: USE (high value).** **Severity: LOW-MEDIUM** — broadly eligible, live rich result, cheap to implement; getting `position` wrong silently kills it.

### Required properties (verbatim)

- `itemListElement` — _"An array of breadcrumbs listed in a specific order."_
- Per `ListItem` (minimum 2 per BreadcrumbList):
  - `position` — _"The position of the breadcrumb in the breadcrumb trail. Position 1 signifies the beginning."_
  - `name` — _"The title of the breadcrumb displayed for the user."_
  - `item` — _"The URL to the webpage that represents the breadcrumb"_ (optional for the final/current item only).

### Recommended

- Breadcrumbs should _"represent a typical user path to a page, instead of mirroring the URL structure."_ The TLD and the current page need not be included.

### Eligibility

- Produces a **breadcrumb trail in search results** (desktop), across all regions/languages where Google Search is available. Still a live, fully-supported rich result.

### Common errors / deprecations

- **Minimum 2 ListItems** required.
- **`position` must start at 1 and increment sequentially** — the single most common silent failure.
- Last item's `item` is optional (Google uses the containing page URL).
- **Deprecated:** _"Data-vocabulary.org markup is no longer eligible for Google rich result features."_ (Use schema.org JSON-LD, which we do.)

**Action for our site:** keep it; ideal for our 33k geo data pages (Home → State → Metro → ZIP). Verify sequential 1-based positions.

---

## 5. Dataset — BIG OPPORTUNITY

**Source:** https://developers.google.com/search/docs/appearance/structured-data/dataset
**Verdict: USE — BIG OPPORTUNITY.** **Severity of getting it wrong: MEDIUM** (low risk, high upside). A market-data site with ~33k data pages is exactly the use case Dataset markup + Google's Dataset Search vertical exist for.

### Required properties

- `name` — _"A descriptive name of a dataset. For example, 'Snow depth in the Northern Hemisphere'."_
- `description` — _"A short summary describing a dataset"_ (50–5000 characters).

### Recommended properties

- `creator` (Person/Organization), `license` (URL or CreativeWork), `distribution` (`DataDownload` with `contentUrl` + `encodingFormat`), `temporalCoverage` (ISO 8601 intervals), `spatialCoverage` (Place/GeoShape), `variableMeasured`, `identifier` (DOI / Compact ID / URL), `sameAs` (canonical URL), `url` (landing page), `keywords`, `version`, `isAccessibleForFree`, `hasPart`/`isPartOf`, `funder`, `citation`.

### What qualifies as a dataset (verbatim, broad)

Google defines datasets broadly: _"A table or a CSV file with some data … an organized collection of tables … a file in a proprietary format that contains data … a collection of files that together constitute some meaningful dataset … a structured object with data in some other format that you might want to load into a special tool for processing … images capturing data … files relating to machine learning."_

### Discovery surface

- Datasets surface in **Dataset Search** — Google's dedicated vertical at `datasetsearch.research.google.com` (a.k.a. `toolbox.google.com/datasetsearch/`). Markup helps datasets _"be easier to find."_

### Content guidelines / common errors

- Textual properties capped at **5,000 characters** (Google uses only the first 5,000).
- Dataset `name` should be **unique** across distinct datasets — relevant to us at 33k pages: each market's dataset needs a distinct name (e.g. include the metro/ZIP).
- Use `sameAs` to point republished datasets to their canonical source.
- `contactType` may be flagged as required for organizations; accepted values include "customer service", "emergency", "journalist", "newsroom", "public engagement".
- Control indexing in Dataset Search with the robots `meta` tag.

### Deprecations

- None for Dataset markup.

**Action for our site:** strong candidate to add Dataset JSON-LD to market/geo pages. Use unique per-market `name`, `description`, `temporalCoverage`, `spatialCoverage` (Place with the metro/ZIP), `variableMeasured` (ZHVI, rent, DOM, etc.), `creator: Organization (PropertyIQ)`, `license`, and `isAccessibleForFree`.

---

## 6. FAQPage — DROP (no rich result for us)

**Sources:**

- https://developers.google.com/search/docs/appearance/structured-data/faqpage
- https://developers.google.com/search/blog/2023/08/howto-faq-changes ("Changes to HowTo and FAQ rich results")

**Verdict: DROP (will NOT produce a rich result on a real-estate SaaS).** **Severity: MEDIUM** — not harmful, but it's giving us zero SERP benefit while implying otherwise. Explicitly: **FAQ markup on a real-estate SaaS site will NOT produce rich results.**

### The 2023 restriction — VERBATIM

Google's August 2023 announcement ("Changes to HowTo and FAQ rich results"):

> **"Going forward, FAQ (from FAQPage structured data) rich results will only be shown for well-known, authoritative government and health websites. For all other sites, this rich result will no longer be shown regularly."**

### Who still gets FAQ rich results

- ONLY _well-known, authoritative government and health websites._
- Everyone else — **SaaS, real-estate, e-commerce, general sites — do NOT get the FAQ rich result.**

### What this means for PropertyIQ

- Our FAQPage markup will render **no visible rich result** in Google Search, regardless of how clean the markup is. It provides no SERP/visibility benefit for us. (Related: the HowTo rich result was fully deprecated in Sept 2023.)

### Required properties (if kept for any reason)

- `mainEntity` (array of `Question`), each `Question` with `acceptedAnswer` → `Answer`.

**Action for our site:** safe to remove FAQPage JSON-LD (no rich result for us). If we keep FAQ content for users, it can stay as plain on-page Q&A; the structured data just isn't earning anything. Do not claim it produces rich results.

---

## 7. Article

**Source:** https://developers.google.com/search/docs/appearance/structured-data/article
**Verdict: USE for blog content.** **Severity: LOW** — no required props, only upside (better title/image/date presentation).

### Required properties

- **None.** Google: _"There are no required properties; instead, add the properties that apply to your content."_

### Recommended properties

- `author` (Person/Organization) + `author.name`, `author.url`; `datePublished`, `dateModified`; `headline`; `image` (repeatable, `ImageObject`/URL).

### Eligible types

- `Article`, `NewsArticle`, `BlogPosting`. For our blog, use **`BlogPosting`**.

### What it does (verbatim)

- Produces a visible rich result with _improved title text, images, and date information._
- _"While there's no markup requirement to be eligible for Google News features like Top stories, you can add Article to more explicitly tell Google what your content is about."_

### Common errors

- For multi-part articles, `rel=canonical` should point at each page or a "view-all" page, _not_ page 1 of a series.
- `author.name` should contain only the author's name (no titles/honorifics/publisher).
- Images: crawlable, indexable, relevant; minimum 50K pixels (w×h).

**Action for our site:** apply `BlogPosting` to blog posts with `headline`, `author`, `datePublished`/`dateModified`, and a representative `image`. Helps blog content; does not change rankings directly.

---

## 8. Image SEO (Google Images)

**Sources:**

- https://developers.google.com/search/docs/appearance/google-images
- https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading (lazy-loading)
  **Verdict: USE — apply across all pages.** **Severity: MEDIUM** — image SEO drives Google Images traffic and broken lazy-loading can hide images from Google entirely.

### Alt text (verbatim)

- Be descriptive and contextual. Good example: `<img src="puppy.jpg" alt="Dalmatian puppy playing fetch"/>`.
- Avoid keyword stuffing: **"Avoid filling `alt` attributes with keywords (also known as keyword stuffing) as it results in a negative user experience."**

### Descriptive filenames (verbatim)

- **"`my-new-black-kitten.jpg` is better than `IMG00023.JPG`."** Avoid generic `image1.jpg` / `pic.gif`.

### Placement & context

- Put images near relevant text on contextually aligned pages; surrounding content helps Google understand the image.

### What helps images rank

- **"Sharp images are more appealing to users in the result thumbnail and can increase the likelihood of getting traffic."**
- Use responsive images: `srcset` + `<picture>` with a fallback `src`.
- Influence which image is chosen via schema `image` (on `mainEntity`/`mainEntityOfPage`), `primaryImageOfPage`, or Open Graph `og:image`. Avoid generic logos / extreme aspect ratios.

### Supported formats

- BMP, GIF, JPEG, PNG, WebP, SVG, AVIF (plus Base64 data URIs). Filenames should match file type.

### Image sitemaps

- Submit image sitemaps to expose URLs Google might not discover; they may include external/CDN domains (verify CDN domain ownership in Search Console).

### Lazy-loading done right (verbatim) — CRITICAL

Google supports these viewport-based methods:

- _"Browser built-in lazy-loading for images and iframes"_ (native `loading="lazy"`).
- _"IntersectionObserver API and a polyfill."_
- _"A JavaScript library that supports loading data when it enters the viewport."_

Why user-interaction loading fails:

- **"The methods mentioned don't rely on user actions, such as scrolling or clicking, to load content, which is important as Google Search does not interact with your page."**
- => Content loaded ONLY on scroll/click events is invisible to Googlebot.

How to test:

- _"If your image or video URLs appear in the `src` attribute on the `<img>` or `<video>` elements in the rendered HTML, your setup works correctly"_ — check via the URL Inspection Tool in Search Console.

**Action for our site:** use native `loading="lazy"` (or IntersectionObserver), descriptive filenames + alt text on map screenshots/report images, responsive `srcset`, and verify images appear in rendered HTML via URL Inspection.

---

## 9. Video SEO (VideoObject) — for completeness

**Source:** https://developers.google.com/search/docs/appearance/video
**Verdict: USE only if we add video content.** **Severity: LOW** (we currently emit no VideoObject).

### Required VideoObject properties

- `name`, `thumbnailUrl`, `uploadDate`. Google: _"Make sure to provide unique information in the thumbnailUrl, name, and description properties for each video on your site."_

### Recommended

- `description`, `duration`, `contentUrl` (_"the URL of the video file's actual content bytes"_), `embedUrl`, `expires`.

### Eligibility (must all hold)

- Watch page indexed and performing well; video embedded on the watch page; not hidden behind other elements; valid thumbnail at a stable URL.

### Best practices

- Don't block the actual video bytes (M3U8 etc.) with `noindex`/robots.txt; use stable URLs.
- Thumbnails: BMP/GIF/JPEG/PNG/WebP/SVG/AVIF, min 60×30 px, Googlebot-accessible.
- Video sitemap tags: `<video:player_loc>`, `<video:content_loc>`, `<video:thumbnail_loc>`, `<video:expiration_date>`.
- `Clip`/`SeekToAction` for key moments; `BroadcastEvent` for livestreams.
- No deprecation notices.

---

## SOURCES

- Article: https://developers.google.com/search/docs/appearance/structured-data/article
- Organization: https://developers.google.com/search/docs/appearance/structured-data/organization
- LocalBusiness: https://developers.google.com/search/docs/appearance/structured-data/local-business
- Dataset: https://developers.google.com/search/docs/appearance/structured-data/dataset
- FAQPage: https://developers.google.com/search/docs/appearance/structured-data/faqpage
- FAQ change (Aug 2023): https://developers.google.com/search/blog/2023/08/howto-faq-changes
- Sitelinks searchbox (deprecated): https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox
- Sitelinks searchbox farewell (Oct/Nov 2024): https://developers.google.com/search/blog/2024/10/sitelinks-search-box
- Breadcrumb: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- SoftwareApplication: https://developers.google.com/search/docs/appearance/structured-data/software-app
- Google Images: https://developers.google.com/search/docs/appearance/google-images
- Lazy-loading: https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading
- Video: https://developers.google.com/search/docs/appearance/video
