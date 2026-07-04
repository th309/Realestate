# 07 — Page Experience, Core Web Vitals, HTTPS & Mobile

**Cluster:** Page Experience · Core Web Vitals · HTTPS · Mobile
**Authority:** Google Search Central + web.dev (Chrome team) — primary sources only.
**Last verified against source:** 2026-06-19
**Target app context:** Next.js 16 (App Router), Mapbox GL maps, charts (Recharts/Visx-class), ISR pages, heavy interactive client layer.

---

## 0. Quote bank (verbatim — do not paraphrase these in any derived work)

> **"There is no single signal. Our core ranking systems look at a variety of signals that align with overall page experience."**
> — Page Experience docs

> **"Google Search always seeks to show the most relevant content, even if the page experience is sub-par. But for many queries, there is lots of helpful content available. Having a great page experience can contribute to success in Search, in such cases."**
> — Page Experience docs (this is Google's actual phrasing of the "tie-breaker" idea — there is NO doc that uses the literal word "tie-breaker")

> **LCP:** "strive to have LCP occur within the first 2.5 seconds of the page starting to load." (Core Web Vitals docs) / "2.5 seconds or less" (web.dev)
> **INP:** "strive to have an INP of less than 200 milliseconds." (Core Web Vitals docs) / "An INP below or at 200 milliseconds means a page has good responsiveness." (web.dev)
> **CLS:** "strive to have a CLS score of less than 0.1." (Core Web Vitals docs) / "0.1 or less" (web.dev)

> **75th percentile:** "a good threshold to measure is the 75th percentile of page loads, segmented across mobile and desktop devices."
> — web.dev (Vitals / LCP / INP / CLS articles, identical wording)

> **HTTPS:** HTTPS is "a very lightweight signal — affecting fewer than 1% of global queries … carrying less weight than other signals such as high-quality content."
> — _HTTPS as a ranking signal_, Google Search Central Blog (2014)

---

## 1. The honest weight of "page experience" in ranking

**Rule:** Page experience is a collection of supporting signals, **not** a single "page experience ranking factor" or a "boost" button. Relevance and helpful content come first; page experience helps decide between comparably-good options.

**WHY (per Google):** Google states flatly _"There is no single signal."_ The May-2021 "page experience signal" rollout combined Core Web Vitals with the pre-existing signals (mobile-friendliness, HTTPS, intrusive-interstitial guidelines) — but the docs were later softened: Google _"always seeks to show the most relevant content, even if the page experience is sub-par."_ Page experience only contributes _"for many queries, [where] there is lots of helpful content available"_ — i.e., when relevance is roughly equal across candidates. Good Core Web Vitals _"doesn't guarantee that your pages will rank at the top."_

**HOW (this app):** Fix content/relevance and indexability first (other rubric files). Treat CWV/HTTPS/mobile as hygiene that prevents being out-competed by an equally-relevant-but-faster rival — not as a growth lever on its own. Do not promise ranking gains from a Lighthouse score bump.

**Source:** https://developers.google.com/search/docs/appearance/page-experience
**Severity:** Foundational / framing (prevents over-claiming).

### Google's page-experience self-assessment checklist (verbatim questions)

1. "Do your pages have good Core Web Vitals?"
2. "Are your pages served in a secure fashion?" (HTTPS)
3. "Does your content display well on mobile devices?"
4. "Does your content avoid using an excessive amount of ads that distract from or interfere with the main content?"
5. "Do your pages avoid using intrusive interstitials?"
6. "Is your page designed so visitors can easily distinguish the main content from other content on your page?"

**Source:** https://developers.google.com/search/docs/appearance/page-experience

---

## 2. The three Core Web Vitals — thresholds, percentile, field-vs-lab

### 2.1 The three metrics and "good" thresholds

| Metric                              | Measures         | GOOD         | NEEDS IMPROVEMENT    | POOR     |
| ----------------------------------- | ---------------- | ------------ | -------------------- | -------- |
| **LCP** — Largest Contentful Paint  | Loading          | **≤ 2.5 s**  | > 2.5 s to ≤ 4.0 s   | > 4.0 s  |
| **INP** — Interaction to Next Paint | Responsiveness   | **≤ 200 ms** | > 200 ms to ≤ 500 ms | > 500 ms |
| **CLS** — Cumulative Layout Shift   | Visual stability | **≤ 0.1**    | > 0.1 to ≤ 0.25      | > 0.25   |

**All three are evaluated at the 75th percentile of real-user page loads, segmented across mobile and desktop devices.** Verbatim: _"a good threshold to measure is the 75th percentile of page loads, segmented across mobile and desktop devices."_ A page passes a metric only when 75% of visits hit the "good" bar.

**INP replaced FID:** Interaction to Next Paint **officially replaced First Input Delay (FID) as a Core Web Vital on March 12, 2024.** FID measured only the _input delay of the first_ interaction; INP measures the worst (near-worst) latency across _all_ interactions over the page's lifetime. FID is deprecated — do not write rules around it.

**Sources:**

- https://developers.google.com/search/docs/appearance/core-web-vitals
- https://web.dev/articles/vitals
- https://web.dev/articles/lcp · https://web.dev/articles/inp · https://web.dev/articles/cls
- INP/FID date: https://web.dev/blog/inp-cwv-march-12

**Severity:** CRITICAL (these are the measurable gates).

### 2.2 FIELD data (CrUX) vs LAB data (Lighthouse) — which Google uses

**Rule:** Google ranks on **FIELD data** (real-user / CrUX), **not** lab data (Lighthouse / local DevTools).

**WHY (per Google/web.dev):** Lab tools catch regressions in development, but only field measurement _"accurately captures the complete picture"_ because real performance varies by device, network, and actual user interactions. INP and the input-delay portion of responsiveness _cannot even exist in a lab run_ — there is no real user clicking. CrUX is the official dataset behind the Search Console Core Web Vitals report and the 75th-percentile pass/fail.

**The 28-day rolling window:** CrUX field data is reported as a **trailing 28-day rolling average**. Consequence: a deploy that fixes CWV today does **not** flip Search Console to "good" immediately — the field score improves gradually as the bad days roll out of the 28-day window. Plan for a multi-week lag; do not "verify the fix" with a single Lighthouse run and call it done.

**HOW (this app):**

- Treat Lighthouse / `next build` analyzer output as a _dev regression tripwire only_.
- Source of truth = **CrUX** (PageSpeed Insights field section, Search Console "Core Web Vitals" report, BigQuery `chrome-ux-report`, or a real-user-monitoring `web-vitals` JS beacon).
- Add the `web-vitals` library to capture LCP/INP/CLS from real visitors and beacon to analytics — lab can't see INP at all.

**Sources:** https://web.dev/articles/vitals · https://developers.google.com/search/docs/appearance/core-web-vitals
**Severity:** CRITICAL (prevents the #1 mistake: optimizing for the lab number Google doesn't rank on).

---

## 3. LCP — causes & fixes for a map/chart/ISR app

**Rule:** Largest Contentful Paint ≤ 2.5 s at p75 (field). The LCP element is the largest `<img>`, `<image>`/`<video>`, `url()` background, or block-level text in the viewport.

**WHY (per web.dev):** LCP decomposes into four parts — **TTFB (~40%) → Resource Load Delay (<10%) → Resource Load Duration (~40%) → Element Render Delay (<10%)**. Each is independently optimizable.

| LCP sub-part               | web.dev definition            | This-app cause                                                                                                               | Fix                                                                                                                                                                            |
| -------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **TTFB**                   | first byte of HTML            | **ISR cold render** (stale-while-revalidate miss → on-demand regeneration), slow Supabase/Mapbox API in RSC, redirect chains | Warm/longer ISR `revalidate`; render LCP content from cache, not a blocking fetch; CDN in front of Railway; cut redirects; avoid per-request DB calls in the LCP path          |
| **Resource Load Delay**    | TTFB → LCP resource starts    | LCP image referenced only in CSS/JS so the preload scanner can't find it                                                     | Put the LCP `<img>` in initial HTML; `<link rel="preload">` for CSS/JS-referenced resources; **`fetchpriority="high"`** on the hero image; same-origin hosting                 |
| **Resource Load Duration** | time to download the resource | Oversized hero/map-preview images                                                                                            | Modern formats (AVIF/WebP) via `next/image`; image CDN; `Cache-Control`; right-sized responsive `sizes`                                                                        |
| **Element Render Delay**   | resource loaded → painted     | Render-blocking CSS/JS in `<head>`; **client-side rendering** delaying first paint; long main-thread tasks                   | Inline only small critical CSS; no synchronous `<script>` in `<head>`; **SSR/SSG/RSC the LCP content** (don't gate it behind `'use client'` hydration); break up long JS tasks |

**Map/chart specifics:**

- **The map must NOT be the LCP element.** Mapbox GL initializes via heavy client JS — if the map canvas is the largest viewport element, LCP waits on hydration + tile fetch. Give the LCP slot to server-rendered text/hero (a headline, a stat, a static preview image) and lazy-mount the live map below/after.
- `next/dynamic(..., { ssr: false })` for Mapbox and chart components so their JS does not block first paint.
- Ship a lightweight static map _image_ (Mapbox Static Images API) as the above-the-fold placeholder; swap to interactive GL on idle/interaction.

**Sources:** https://web.dev/articles/lcp · https://web.dev/articles/optimize-lcp
**Severity:** CRITICAL.

---

## 4. INP — causes & fixes (the map/chart killer)

**Rule:** INP ≤ 200 ms at p75 (field). INP = input delay + event-handler processing + presentation (next-paint) delay, measured across **all** interactions for the page's whole life.

**WHY (per web.dev):** Responsiveness problems are _JavaScript-driven_ — **long tasks block the main thread**, creating input delay before the event handler can even run, then delaying the render of the next frame. A map/chart-heavy React app is exactly the high-risk profile: large hydration, expensive event callbacks, and synchronous re-renders.

**HOW (this app):**

- **Shrink hydration:** maximize React Server Components; keep `'use client'` islands minimal. Less client JS = fewer/shorter long tasks at the exact moment users start interacting.
- **`next/dynamic` + lazy-mount** Mapbox GL and charts; load them on intersection/idle, not eagerly.
- **Break up long tasks:** chunk heavy work, `await scheduler.yield()` / `setTimeout(0)` between chunks, move pure compute to Web Workers (e.g., GeoJSON parsing, score crunching, large dataset transforms).
- **De-bounce/throttle** map `move`/`zoom`/hover and chart-tooltip handlers; coalesce state updates; use `useTransition`/`startTransition` for non-urgent map-driven UI updates so input stays responsive.
- **Defer/limit third-party scripts** (analytics, chat, ads) — they steal main-thread time and inflate INP/input delay.
- Memoize expensive renders (`React.memo`, stable callbacks) so a single hover doesn't re-render the whole map legend + chart.

**Sources:** https://web.dev/articles/inp · https://web.dev/articles/vitals
**Severity:** CRITICAL (the metric most likely to fail on this app; INP is field-only — lab can't catch it).

---

## 5. CLS — causes & fixes for late-loading maps/charts/widgets

**Rule:** CLS ≤ 0.1 at p75 (field). `layout shift score = impact fraction × distance fraction`.

**WHY (per web.dev):** Top causes — (1) images/videos **without dimensions**, (2) **ads/embeds/iframes/widgets that resize themselves**, (3) **dynamically injected content** inserted above existing content, (4) **web fonts** causing FOIT/FOUT reflow. _"Personalized or third-party content often behaves differently in production versus development"_ — so CLS that's invisible locally still hits real users (and CrUX).

**HOW (this app):**

- **Reserve space for the map and every chart:** fixed `height`/`aspect-ratio` container so the Mapbox canvas and chart SVG mount into a pre-sized box and don't push content down.
- Always set explicit `width`/`height` (or `aspect-ratio`) on images — `next/image` enforces this; use it.
- **Don't inject above existing content:** late-loading score badges, AI-narrative blocks, "inherited" data banners, cookie/consent bars, and ad slots must occupy reserved space or render below the fold — never shove the hero down on arrival.
- **Skeletons must match final dimensions** exactly (same height as the loaded chart/map/card).
- Fonts: `next/font` with `font-display: swap` + a size-matched fallback (`adjustFontFallback`) to minimize swap reflow.
- For data-driven cards that may render `DataUnavailable`, reserve the card's height so conditional rendering doesn't shift the grid.

**Sources:** https://web.dev/articles/cls · https://web.dev/articles/vitals
**Severity:** HIGH (cheap to fix, easy to regress with async data/widgets).

---

## 6. HTTPS — ranking signal

**Rule:** Serve every page over HTTPS; redirect HTTP→HTTPS; no mixed content.

**WHY (per Google):** HTTPS is a confirmed ranking signal, but explicitly _"a very lightweight signal — affecting fewer than 1% of global queries,"_ carrying _"less weight than other signals such as high-quality content."_ Google said it _"may decide to strengthen"_ it. It is one of the page-experience self-assessment items (_"Are your pages served in a secure fashion?"_). Do not overstate it — it is table-stakes, not a lever.

**HOW (this app):** Railway frontend/backend already terminate TLS; enforce a single canonical HTTPS host, HSTS, and zero mixed-content (all Mapbox/Supabase/asset URLs `https://`). Verify no `http://` subresources leak into ISR-cached HTML.

**Sources:**

- https://developers.google.com/search/blog/2014/08/https-as-ranking-signal
- https://developers.google.com/search/docs/crawling-indexing/https
- https://developers.google.com/search/docs/appearance/page-experience
  **Severity:** MEDIUM (mandatory baseline, low ranking weight).

---

## 7. Mobile usability & no intrusive interstitials

**Rule:** Content must display and function well on mobile (responsive), and pages must avoid intrusive interstitials that block content. (Mobile-first _indexing_ is covered in another rubric file — this entry is the responsive-usability + interstitial angle.)

**WHY (per Google):** Page-experience self-assessment asks _"Does your content display well on mobile devices?"_ and _"Do your pages avoid using intrusive interstitials?"_ Intrusive interstitials (full-screen pop-ups/overlays that cover the main content, especially right after a user arrives from Search) are called out as a negative page-experience signal. Legally-required banners (cookie consent) and reasonable login walls are exceptions, but they must not dominate the screen.

**HOW (this app):**

- Responsive layout per the M3/Tailwind system; the Mapbox map, screener tables, and charts must be usable at mobile widths (touch targets, no horizontal overflow, readable legends) — the captured `mobile-*` screenshots in the repo are the de-facto QA set.
- **AnonCaptureModal / trial / paywall overlays:** do NOT present a full-screen content-blocking interstitial on first load from organic Search. Defer the email-capture/trial wall (scroll depth, interaction, or after partial content) and keep the underlying SEO content crawlable and visible — an interstitial slammed on arrival is exactly what Google penalizes and also tanks CLS.
- Keep ad/promo density low enough that _"visitors can easily distinguish the main content."_

**Source:** https://developers.google.com/search/docs/appearance/page-experience
**Severity:** HIGH (responsive is mandatory; an arrival-time full-screen wall is both a page-experience negative and a CLS/UX hit).

---

## 8. Severity rollup

| #   | Rule                                                                                           | Severity |
| --- | ---------------------------------------------------------------------------------------------- | -------- |
| 1   | Page experience ≠ single signal / no "boost"; relevance first, PX is a near-tie differentiator | Framing  |
| 2.1 | Hit LCP ≤ 2.5 s · INP ≤ 200 ms · CLS ≤ 0.1 at **p75**                                          | CRITICAL |
| 2.2 | Rank on **field/CrUX**, not lab; respect the **28-day** window; INP replaced FID 2024-03-12    | CRITICAL |
| 3   | LCP: don't let the map be LCP; SSR the hero; preload/`fetchpriority`; modern images            | CRITICAL |
| 4   | INP: shrink hydration, lazy-mount Mapbox/charts, break long tasks, throttle handlers           | CRITICAL |
| 5   | CLS: reserve space for map/charts/widgets; sized images/fonts; no above-content injection      | HIGH     |
| 6   | HTTPS everywhere (lightweight signal, mandatory baseline)                                      | MEDIUM   |
| 7   | Responsive mobile usability + no arrival-time intrusive interstitial (defer the capture wall)  | HIGH     |
