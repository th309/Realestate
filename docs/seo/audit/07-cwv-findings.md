# 07 — Core Web Vitals / Page Experience — Findings

**Audited:** 2026-06-19
**Scope:** PropertyIQ (`https://www.propertyiq.app`) — Next.js 16 App Router, Mapbox GL, Recharts, ISR market pages.
**Rubric:** `docs/seo/google-rubric/07-page-experience-cwv.md` (Google Search Central + web.dev primary sources).
**Method:** Live PageSpeed Insights API (intended) + read-only architecture analysis of `packages/frontend`.

---

## 0. Framing — do NOT overstate page experience as a ranking lever

Per the rubric (and Google verbatim): **"There is no single signal."** Page experience is a collection of supporting signals, not a "boost" button. Google "always seeks to show the most relevant content, even if the page experience is sub-par"; CWV only helps "for many queries, [where] there is lots of helpful content available" — i.e. as a near-tie differentiator between comparably-relevant pages. **Good Lighthouse scores do not guarantee ranking.** Treat everything below as hygiene that prevents being out-competed by an equally-relevant-but-faster rival, and fix content/relevance/indexability first (other rubric files).

**And the metric Google actually ranks on is FIELD data (CrUX) at p75 — not the lab numbers.** Lab (Lighthouse) is a dev regression tripwire only. INP cannot even be measured in a lab run (no real user clicking). CrUX is a trailing **28-day rolling average**, so any fix lands in Search Console gradually over weeks, not on the next run.

---

## 1. LIVE MEASUREMENT — STATUS: NOT CAPTURED THIS RUN (must be completed)

> **Honest limitation (rubric §2.2 demands this disclosure):** The live PageSpeed Insights / CrUX field data could **not** be retrieved during this audit. The agent's `WebFetch` tool returned persistent HTTP 429 (rate-limited) on every attempt to `googleapis.com/pagespeedonline/...`, and direct shell (`curl`) access was unavailable. **No field or lab numbers below are observed values — the cells are placeholders.** Do not cite numbers from this file until the table is filled from a real run. This is exactly the trap the rubric warns about (don't "verify the fix with a single Lighthouse run and call it done") — and here we couldn't even get the one run, so the verdict is provisional and architecture-derived.

### 1.1 How to capture the real data (run these, then paste results here)

Three PSI calls (no API key needed for low volume; add `&key=YOUR_KEY` to avoid 429):

```bash
# Homepage — mobile (PRIMARY: Google segments mobile separately and most traffic is mobile)
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://www.propertyiq.app/&strategy=mobile&category=performance" > psi_home_mobile.json

# Market page — mobile (tests the heavy client/ISR market template)
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://www.propertyiq.app/markets/austin-round-rock-san-marcos-tx&strategy=mobile&category=performance" > psi_market_mobile.json

# Homepage — desktop
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://www.propertyiq.app/&strategy=desktop&category=performance" > psi_home_desktop.json
```

Then extract:

- **Field (CrUX):** `.loadingExperience` (URL-level) and `.originLoadingExperience` (origin-level). For each of `LARGEST_CONTENTFUL_PAINT_MS`, `INTERACTION_TO_NEXT_PAINT`, `CUMULATIVE_LAYOUT_SHIFT_SCORE`: the `percentile` and `category` (FAST/AVERAGE/SLOW). Plus `overall_category`.
- **`.loadingExperience.origin_fallback`** — `true` means **no URL-level CrUX exists** (page traffic too low) and PSI is showing origin-level data instead. **Expect this to be `true` for the market page and possibly the homepage** — PropertyIQ is a young, low-traffic site (see the activation-funnel memory: ~0 signup completions/30d, most traffic on SEO long-tail), so URL-level CrUX histograms very likely don't meet CrUX's minimum-sample threshold. **Say so explicitly when you fill this in.** If only origin-level data exists, Google still uses it, but you cannot diagnose a single template from it.

### 1.2 Field data (CrUX, real users, p75) — Google ranks on THIS

| Surface                  | LCP p75 (≤2.5s) | INP p75 (≤200ms) | CLS p75 (≤0.1) | Overall   | URL-level CrUX exists?        |
| ------------------------ | --------------- | ---------------- | -------------- | --------- | ----------------------------- |
| Homepage (origin or URL) | _pending_       | _pending_        | _pending_      | _pending_ | _check `origin_fallback`_     |
| Market page              | _pending_       | _pending_        | _pending_      | _pending_ | _likely origin_fallback=true_ |

### 1.3 Lab data (Lighthouse, synthetic — regression tripwire only, NOT ranking)

| Surface            | Perf score | LCP (lab) | CLS (lab) | TBT       | Speed Index | FCP       |
| ------------------ | ---------- | --------- | --------- | --------- | ----------- | --------- |
| Homepage mobile    | _pending_  | _pending_ | _pending_ | _pending_ | _pending_   | _pending_ |
| Market page mobile | _pending_  | _pending_ | _pending_ | _pending_ | _pending_   | _pending_ |
| Homepage desktop   | _pending_  | _pending_ | _pending_ | _pending_ | _pending_   | _pending_ |

> **TBT is the lab proxy for INP risk** (INP itself is field-only). A high TBT (>200ms mobile) predicts an INP problem under real interaction even though Lighthouse "passes."

---

## 2. Architecture-derived verdict (what we CAN assert from code, read-only)

Even without field numbers, the code reveals concrete, fixable CWV defects and several things already done right. Findings are graded by rubric severity. File paths are first-hand verified.

### 2.1 LCP — the hero/market H1 is gated behind hydration

**FINDING #1 — Homepage hero H1 ships `opacity: 0` and only becomes visible after JS hydrates (LCP RISK).**
**Severity: HIGH (CRITICAL metric, concrete defect).** Rubric §3 — "SSR/SSG/RSC the LCP content; don't gate it behind `'use client'` hydration."

- `packages/frontend/app/components/home/HeroSection.tsx:1` is `"use client"`.
- The H1 (the largest above-the-fold element — `packages/frontend/app/components/home/HeroSection.tsx:34-41`, _"33,000+ U.S. Real Estate Markets. Scored."_) is rendered with an inline style `style={fadeUp(inView, "0s")}` where `fadeUp` returns `opacity: inView ? 1 : 0` (`HeroSection.tsx:8-15`).
- `inView` comes from `useInView()` and is **`false` on first paint**. So the server HTML contains the text but paints it at `opacity: 0`; it only animates to `opacity: 1` after React hydrates and the IntersectionObserver fires. **The LCP text candidate is effectively invisible until client JS runs** — pushing LCP from "first server paint" out to "hydration + observer callback." This is a real LCP regression on the most important page, and it is invisible in casual inspection because the HTML _looks_ server-rendered.
- **Fix:** render the hero text visible by default; drive the entrance animation with a CSS-only approach that does not start from `opacity:0` for the LCP element (e.g. animate non-LCP decoration, or use `@media (prefers-reduced-motion)`-safe CSS keyframes that don't hide the headline pre-hydration), OR make the hero a Server Component and move only the CTA click-tracking into a tiny client child. The H1 must paint at full opacity in the initial server HTML.
- **File:** `packages/frontend/app/components/home/HeroSection.tsx:8-41`.

**FINDING #2 — Market-page H1 + entire body hydrate client-side (LCP + INP RISK).**
**Severity: MEDIUM-HIGH.** Rubric §3 (LCP) + §4 (INP).

- `packages/frontend/app/(public)/markets/[slug]/page.tsx:61` is a Server Component with ISR (`revalidate = 86400`, `dynamicParams = true`, `generateStaticParams` pre-renders the top 150 metros) — **good for TTFB**. But it renders almost the entire visible page through `MetroPageContent`, which is `"use client"` (`MetroPageContent.tsx:1`), including the LCP H1 _"{shortName} Housing Market"_ (`MetroPageContent.tsx:49-51`).
- The H1 here is _not_ `opacity:0`-gated (unlike the hero), so the text paints with the SSR HTML — LCP is less at risk than the homepage. The bigger cost is **hydration weight**: the whole market template (`ScoreWidget`, `MarketOverviewSection`, `PersonaCaptureBlock`, `LeadMagnetModal`, score charts) is one client island that hydrates together → INP risk (§2.3).
- **Fix:** keep the server shell rendering the H1 + intro server-side (it already does), and split the interactive widgets into smaller, independently-hydrated/lazy client islands rather than one page-wide `'use client'` wrapper.
- **Files:** `packages/frontend/app/(public)/markets/[slug]/page.tsx:58-61`, `.../MetroPageContent.tsx:1-145`.

**GOOD — Hero is text-LCP, no render-blocking hero image; fonts use `display:swap`; ISR keeps TTFB low on cache hits.** TTFB risk remains for cold ISR / on-demand long-tail metros (the market route on a cache miss runs 3 server fetches: `fetchSeoMarketStats`, `fetchRankings`, sticky scores) — rubric §3 TTFB row. Keep those server fetches cached; do not let a cold render block first byte.

### 2.2 LCP — Mapbox is correctly NOT the LCP element

**GOOD (rubric §3 "the map must NOT be the LCP element").**

- Homepage `MapShowcase` is section 6 of 10 (below the fold) and only initializes when scrolled into view: `import("mapbox-gl")` is a **runtime dynamic import** guarded by `useInView` (`packages/frontend/app/components/home/MapShowcase.tsx:64-74`), with the comment _"dynamically imported to avoid bundling ~700KB on initial load."_ The container has reserved height `min(60vw, 560px)` / `minHeight 320px` (`MapShowcase.tsx:189-194`) so it does not cause CLS.
- This is the right pattern and should be preserved.

**MINOR — the full `/map` page eagerly imports the Mapbox CSS at module scope.**

- `packages/frontend/app/(app)/map/page.tsx:6` does a static `import "mapbox-gl/dist/mapbox-gl.css"` and the page is `"use client"`. The `/map` route is an authenticated app surface (lower SEO weight than the marketing/market pages), so this is low priority, but the CSS loads with the page JS rather than alongside the lazy GL import. **Fix (low priority):** match the `MapShowcase` pattern (lazy-load the CSS with the GL module) if `/map` ever becomes an organic landing page.
- **No static Mapbox Static-Images-API placeholder** is used anywhere as an above-the-fold map preview (rubric §3 suggests one). Not needed today since the live map is below the fold; revisit only if a map ever moves above the fold on an SEO page.

### 2.3 INP — heavy client hydration on market pages (field-only metric)

**FINDING #3 — Market pages hydrate as large client islands with statically-imported Recharts + score widgets; no route-level code-splitting.**
**Severity: MEDIUM (INP is the metric most likely to fail this app; it is field-only — lab can't catch it; rubric §4).**

- There is **no `next/dynamic` / `{ ssr: false }` usage anywhere under `packages/frontend/app/(public)/markets/`** (verified by grep — zero matches). So `ScoreWidget`, `MarketOverviewSection`, and the capture blocks are statically imported and hydrate with the page. **Precision:** the metro `[slug]` page body itself has **no Recharts chart** — Recharts (`ScoreHistoryChart`, `ChartPreview`) lives in scoring/score-detail and homepage-demo components, and the homepage `GraphsShowcase` is an `aspectRatio:16/9` video (CLS-safe). So the INP risk on the metro page is **hydration weight from `ScoreWidget` + `MarketOverviewSection` (which fetches AI insight client-side)**, not Recharts specifically. Recharts remains an INP concern on the score-detail surfaces where `ScoreHistoryChart` mounts. Either way, statically importing heavy widgets into the initial hydration bundle lengthens the long tasks that occur exactly when a user first tries to interact → input delay → INP.
- The homepage similarly composes many `'use client'` sections (`HeroSection`, `MapShowcase`, `GraphsShowcase`, `ScoreTeaser`, `StickyScoreBar`, etc.) — `packages/frontend/app/(app)/page.tsx:1-19`.
- **Fix (rubric §4 "shrink hydration / lazy-mount charts / break long tasks"):**
  1. `next/dynamic(..., { ssr: false, loading: <sized skeleton> })` for the Recharts charts and below-fold widgets so their JS loads on intersection/idle, not in the first hydration pass.
  2. Keep `'use client'` islands minimal — push static text/headings to Server Components.
  3. Throttle/debounce any map `move`/hover and chart-tooltip handlers; use `startTransition` for non-urgent map-driven state.
- **Cannot be confirmed without field INP** — capture it via §1 and/or add RUM (§2.5). The TBT lab number (when §1 is run) is the best available proxy.
- **Files:** `packages/frontend/app/(public)/markets/[slug]/MetroPageContent.tsx`, `.../MarketOverviewSection.tsx`, `app/components/scoring/ScoreHistoryChart.tsx`, `app/(app)/page.tsx`.

### 2.4 CLS — mostly handled well

**GOOD (rubric §5).** Layout-shift defenses are largely in place:

- Map container has reserved height (`MapShowcase.tsx:193`).
- Charts mount into fixed-height boxes: `ScoreHistoryChart` wraps `ResponsiveContainer` in `div.h-48` (`ScoreHistoryChart.tsx:262-263`) and its loading skeleton is the same `h-48 animate-pulse` (matches final dims — rubric §5 "skeletons must match final dimensions"). Homepage `ChartPreview` uses `div.h-36`. `ScoreRingChart` (D3) sizes its SVG explicitly.
- `MarketOverviewSection` shows a sized skeleton while its AI insight fetches.
- Fonts: `next/font/google` with `display:"swap"` on all four families (`app/layout.tsx:7-34`).

**LOW — two residual CLS watch-items:**

1. **Four font families** (Roboto, Roboto Mono, Source Serif 4, DM Sans — `layout.tsx:2`) and **no explicit `adjustFontFallback`** in the `next/font` configs. `next/font` applies a default size-matched fallback automatically (mitigates swap reflow), so this is minor, but four families is heavy. Confirm the size-adjusted fallback is active and consider dropping a family if unused.
2. **Conditional/async cards** (e.g. `ScoreWidget`, `MarketOverviewSection`, `DataUnavailable` branches) must keep reserving their grid height while loading so a late data resolution doesn't shift the page. The chart skeletons do this; verify every data card on the market template does too (rubric §5 final bullet). **Action:** spot-check `MarketOverviewSection` and any `DataUnavailable` paths render at the loaded height.

### 2.5 RUM — no field-data instrumentation exists

**FINDING #4 — No `web-vitals` real-user-monitoring beacon. Production CWV is effectively unobservable from your own analytics.**
**Severity: HIGH (visibility gap — rubric §2.2 "Add the `web-vitals` library to capture LCP/INP/CLS from real visitors").**

- `web-vitals` is **not** a dependency (verified: only matches are in build artifacts under `.next-verify/` and the eslint config — no source import; not in `package.json`). No `useReportWebVitals`/`reportWebVitals`. Analytics is Google Analytics loaded `afterInteractive` (`app/components/analytics/GoogleAnalytics.tsx`) + a custom event tracker; Sentry is present for errors only. **None of these report LCP/INP/CLS.**
- Consequence: you are blind to field CWV except via Search Console / PSI CrUX, which (a) lags 28 days and (b) likely has **no URL-level data** at current traffic (§1.1) — so you cannot tell which template is slow or whether a fix worked.
- **Fix:** add `web-vitals` and beacon `onLCP/onINP/onCLS` to GA4 (or a `/backend` endpoint) via Next's `useReportWebVitals` in a tiny client component in the root layout. This is the single highest-leverage observability action and the only way to see INP at all.
- **Files:** add to `packages/frontend/package.json`; wire in `packages/frontend/app/layout.tsx` (or a `app/_components` client child).

### 2.6 Interstitial / mobile — compliant

**GOOD (rubric §7 "defer the capture wall; no arrival-time full-screen interstitial").**

- `AnonCaptureModal` (`packages/frontend/components/entitlements/AnonCaptureModal.tsx`) is **interaction-gated** — it is rendered by `PaywallProvider` only when an anonymous user clicks a locked premium feature, not on arrival from Search. No timer/scroll auto-show.
- The market-page `LeadMagnetModal` (`MetroPageContent.tsx:137-142`) opens only on an explicit button click (`showLeadMagnet` state), not on load.
- `PersonaCaptureBlock` is an inline block, not a content-blocking overlay.
- **No change required.** Keep it this way — an arrival-time full-screen wall would be both a page-experience negative and a CLS hit (rubric §7). The repo's `mobile-*` screenshots are the de-facto mobile-usability QA set per the rubric.

### 2.7 HTTPS — baseline met

**GOOD (rubric §6, MEDIUM/low-weight).** Site is served over HTTPS via Railway TLS; canonical host is `https://www.propertyiq.app` (`app/layout.tsx:38`, per-page canonicals). Subresources use `https://` (Mapbox `preconnect` to `https://api.mapbox.com` in `layout.tsx:141`; all data via same-origin `/backend/*` proxy). **Verify** no `http://` subresource leaks into ISR-cached HTML and that HSTS is set at the edge. Low ranking weight — table stakes, not a lever.

---

## 3. Severity rollup & top fixes

| #   | Finding                                                               | Rubric | Severity | Metric           | Fix locus                                         |
| --- | --------------------------------------------------------------------- | ------ | -------- | ---------------- | ------------------------------------------------- |
| 1   | Homepage hero H1 ships `opacity:0`, visible only after hydration      | §3     | **HIGH** | LCP              | `HeroSection.tsx:8-41`                            |
| 4   | No `web-vitals` RUM — production CWV unobservable (esp. INP)          | §2.2   | **HIGH** | All (visibility) | `package.json` + `layout.tsx`                     |
| 3   | Market/home charts + widgets hydrate eagerly; no `next/dynamic` split | §4     | MEDIUM   | INP (field-only) | `MetroPageContent.tsx`, charts                    |
| 2   | Market H1/body inside one page-wide `'use client'` island             | §3/§4  | MEDIUM   | LCP/INP          | `markets/[slug]/page.tsx`, `MetroPageContent.tsx` |
| —   | Map correctly lazy + height-reserved (homepage)                       | §3/§5  | GOOD     | LCP/CLS          | `MapShowcase.tsx`                                 |
| —   | Charts/fonts/skeletons reserve space                                  | §5     | GOOD     | CLS              | charts, `layout.tsx`                              |
| —   | Capture modals interaction-gated, not arrival interstitial            | §7     | GOOD     | mobile/CLS       | `AnonCaptureModal.tsx`                            |
| 5   | `/map` eagerly imports Mapbox CSS (auth page, low SEO weight)         | §3     | LOW      | LCP              | `app/(app)/map/page.tsx:6`                        |
| —   | 4 font families, no explicit `adjustFontFallback`                     | §5     | LOW      | CLS              | `layout.tsx:2-34`                                 |
| —   | HTTPS baseline met                                                    | §6     | OK       | —                | edge/Railway                                      |

### Top 3 component-level fixes, ranked by impact

1. **Un-gate the homepage hero H1 (LCP).** Make _"33,000+ U.S. Real Estate Markets. Scored."_ paint at full opacity in the initial server HTML — stop driving the LCP element's entrance from `opacity:0 → 1` via `useInView` after hydration. `HeroSection.tsx:8-41`. Highest-impact LCP win on the highest-value page.
2. **Add `web-vitals` RUM + beacon to GA4 (visibility, unblocks everything else).** Without it you cannot see INP at all, and CrUX likely has no URL-level data at current traffic — so you can't tell which template is slow or whether fix #1/#3 worked. `package.json` + `useReportWebVitals` in `layout.tsx`.
3. **Lazy-load Recharts + below-fold widgets via `next/dynamic({ssr:false})` with sized skeletons (INP).** Shrinks the market-page hydration bundle and the long tasks that hit exactly when users start interacting. `MetroPageContent.tsx`, `ScoreHistoryChart.tsx`.

---

## 4. Honest caveats (per rubric §1 + §2.2)

- **These are architecture-derived risks, not measured ranking data.** Field CWV (CrUX) was not captured this run (WebFetch 429 + no shell). Fill §1 from a real PSI run before quoting any number, and expect `origin_fallback=true` (origin-only, no URL-level CrUX) given the site's current traffic.
- **Lab ≠ ranking.** Even once §1 is filled, Lighthouse/TBT are dev tripwires; Google ranks on field CrUX at p75 over a 28-day window. A fix won't flip Search Console for weeks.
- **Do not promise ranking gains from a Lighthouse bump.** Page experience is "no single signal," a near-tie differentiator behind relevance and helpful content. Fix content/indexability first; treat CWV as hygiene.
