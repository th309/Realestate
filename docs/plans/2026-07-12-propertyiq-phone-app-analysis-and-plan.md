# PropertyIQ as a Phone App — Full Analysis & Implementation Plan

> Produced 2026-07-12. Research: 5 parallel codebase audits + platform research. Approved plan executed on branch `worktree-PWA`.

## Context

What needs to happen for PropertyIQ (Next.js 16 App Router frontend, NestJS backend, one responsive codebase) to **function as an app on phones**. Current state before this work: a bare web-app manifest (`display: standalone`, 192/512 icons, apple-touch-icon) — installable via Add-to-Home-Screen but no service worker, no offline behavior, no install prompt, no store presence.

## Platform facts (researched 2026-07-12)

- **iOS**: Home-screen web apps run standalone and (since iOS 16.4) support Web Push + Badge API; iOS 26 defaults every added site to open as a web app. Declarative Web Push (Safari 18.4+) works without a service worker. EU caveat: Apple degraded PWAs to Safari tabs in the EU (DMA) — US audience unaffected.
- **Service worker tooling**: Serwist (`@serwist/next`) is the maintained successor to next-pwa and the Next.js-docs-endorsed option; works with Turbopack (Next 16 default bundler).
- **Google Play**: PWAs publishable via Trusted Web Activity (Bubblewrap/PWABuilder), needs Lighthouse ≥80 + Digital Asset Links. $25 one-time.
- **Apple App Store**: no TWA equivalent; requires Capacitor/native wrapper + Xcode/Mac + $99/yr, and Guideline 4.2 rejects "just a website" — needs offline support, push, or native capabilities to pass.
- **Name collision**: an unrelated competing app (App Store id6762011177) already uses the PropertyIQ name — marketing docs already warn not to link it. Store strategy must account for this.

## Codebase audit findings

### Server coupling / native-wrapper feasibility — VERDICT

- **`output: 'export'` (classic Capacitor static packaging): BLOCKED.** Hard blockers: `middleware.ts` (Supabase session refresh, protected-route + admin gating, host redirects, A/B rewrite, rate limit); ~70 route handlers — above all `app/backend/[[...path]]/route.ts`, the same-origin proxy every browser data call depends on (`lib/data/fetchers/api-url.ts` hardcodes `${origin}/backend`); `cookies()` in `app/(app)/layout.tsx` forcing the entire authed group dynamic; next.config `redirects()/rewrites()/headers()` (CSP, .well-known agent rewrites); ISR (11 `revalidate` exports + `dynamicParams` long-tail on SEO markets/forecast pages).
- **Remote-URL wrapper (TWA Android / Capacitor-remote iOS / WebView-over-live-URL): ZERO code-level blockers.** Full server stack runs as today. Backend CORS (`packages/backend/src/main.ts:58-81`) reflects any Origin incl. `capacitor://localhost`.
- **Coupling shape:** interactive app value (map/screener/analyzer/reports/scores) = client-shell components fetching via React Query — ~90% of app value is client-capable. Server-coupled minority = public SEO surface + auth/admin gating — none of which a native app needs. No Server Actions anywhere.

### PWA installability infrastructure

**Exists & correct:** manifest linked (`layout.tsx:110`) with name/standalone/colors/192+512 icons; `apple-touch-icon.png` 180×180; themeColor light/dark + `viewportFit: cover`; CSP `worker-src 'self' blob:` permits a root `/sw.js`; middleware matcher excludes `.webmanifest`/`.png`/`.ico`.

**Gaps:** (1) No service worker with fetch handler — THE Chromium install blocker; (2) no maskable icon; (3) no `appleWebApp` metadata block; (4) no iOS splash screens; (5) no `screenshots`/`id`/`display_override`/`categories`/`shortcuts` in manifest; (6) no `beforeinstallprompt` capture / install CTA / standalone detection anywhere; (7) no offline fallback page; (8) middleware matcher doesn't exclude `/sw.js`.

### Auth/session flows under standalone mode

Architecture: `@supabase/ssr`, `flowType: "implicit"` (tokens in URL hash), cookie-based `sb-*` sessions refreshed by middleware `getUser()`. Zero standalone-mode detection.

| Flow                             | Standalone risk | Why                                                                                           |
| -------------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| Signup via 6-digit OTP code      | **LOW**         | Code typed in-app → session minted in the app's own cookie jar. The one immune flow.          |
| Signup via email confirm link    | **HIGH**        | Link opens in default browser → session lands in browser jar; iOS standalone jar is separate. |
| Password reset                   | **HIGH**        | Link-only, no OTP alternative; completes in browser.                                          |
| Magic-link sign-in               | **HIGH**        | Link-only, no code-entry on sign-in.                                                          |
| Google OAuth                     | MED             | Same-origin return should work; iOS may bounce cross-origin hop to Safari.                    |
| Stripe checkout / billing portal | MED             | Cross-origin hop may break out of standalone; webhook self-heals state.                       |

### Offline / data-layer readiness

- **Live always-online SPA.** No SW, no React Query persistence (global `staleTime` 1min, `gcTime` 5min default). Zero offline UX (`navigator.onLine` unused anywhere).
- **SW-friendliness: uniquely cheap** — ALL browser API traffic is same-origin through ONE proxy route handler (`app/backend/[[...path]]/route.ts`). One URL-prefix rule covers the whole API surface. Cross-origin exceptions: Supabase auth, Mapbox tiles, GA/Sentry.
- Existing resilience: `refetchOnReconnect: false` storm guard + 6-request semaphore; 3x retry on 5xx/network; `reportLoadPolicy.ts` blip-tolerant.
- Maps fully online-dependent (Mapbox CDN style/tiles); GeoJSON boundaries for national/state/metro/county-all are same-origin static files (highest-value precache); map silently renders empty on boundary-fetch failure.
- Fonts fully self-hosted (`next/font`); images all local. Code-splitting gaps: `mapbox-gl` (~700KB) static on `/map`; recharts static in reports/analyzer; no bundle analyzer.

### Mobile app-shell UX

**Well-handled:** back navigation (zero `history.back()` reliance — all fixed-destination Links + breadcrumbs); form keyboards (correct inputmode/autocomplete incl. OTP); MobileMenu drawer a11y; map page immune to pull-to-refresh; `MobileInputSheet` is the model sheet.

**Gaps:** (1) no bottom tab bar (biggest structural miss); (2) no global overscroll guard (pull-to-refresh reloads standalone); (3) no tap-highlight/touch-callout reset; (4) touch targets sub-44px (hamburger ≈40px, GeoLevelPills ~24px, metric rows ~28px) + `RightDetailPanel` header lacks pt-safe; (5) ~15 pages on 100vh instead of dvh; (6) hover-only UI: D3 chart tooltips (8 chart types, zero touch path — MED-HIGH), `ConfidenceDisplay` breakdown, `RichTooltip` primitive, map context menu right-click-only. Correct patterns to copy: `MetricHelpButton`, `MetricTitle`.

## User requirements spec (2026-07-12) — BINDING

**Priority order if scoping: (1) back-button handling, (2) skeleton + count-up loading, (3) SW update toast, then the rest.**

- **Install**: `beforeinstallprompt` capture → custom banner after a value moment (e.g. second deal analysis), never first load; iOS instructional banner (share-icon graphic) gated on iOS ∧ !standalone, dismissal in localStorage; "Get the app" in account menu; `appinstalled` → GA; manifest adds `shortcuts` ("Analyze a Deal", "Top Markets").
- **Offline**: SW stale-while-revalidate for app shell + API data; branded offline page (never a browser error); cache last-viewed market snapshot / deal analysis with "cached data from X ago" indicator; iOS IndexedDB 7-day eviction for non-installed usage — never source of truth.
- **Updates**: waiting SW → non-blocking toast "New version available, tap to refresh"; **never force-reload mid-task**.
- **Native feel**: `touch-action: manipulation`; `-webkit-tap-highlight-color: transparent`; `user-select: none` on buttons/nav; `overscroll-behavior: none`; `:active scale(0.97)`; `navigator.vibrate(10)` on confirmations (Android, feature-detect); 44px minimum touch targets.
- **Standalone correctness**: safe-area insets; theme-color synced to header incl. dark-mode swap; **History-API back handling (pushState on modal/sheet open, popstate closes; back exits only from root)**; iOS splash via `pwa-asset-generator`; cookie sessions over redirect flows.
- **Loading**: skeletons matching final card/chart dimensions (no spinners) + existing count-up; View Transitions API with Safari fallback.
- **Inputs**: numeric inputmode/type; autocomplete; keyboard occlusion (`interactive-widget=resizes-content` or scroll-into-view).
- **Capabilities**: Web Share API (deal analyses, market reports); Badging API (watched-market alerts); push notifications requested in context after watching a market, never on load.

## Implementation plan

**Strategy:** Static export is permanently blocked — everything keeps the live Railway server. Five shippable phases; stores are a gated tail decision. Bottom tab bar approved: always on mobile.

### Phase 1 — Standalone correctness core (user P0 trio)

1. **History-API back handling [M]** — `lib/pwa/use-modal-history.ts`: `pushState` marker on open, `popstate` closes; back exits only from root. Wire into MobileMenu, RightDetailPanel, DataTableModal, MobileInputSheet, MapContextMenu, ShareReportModal/ShareMarketModal, paywall/upgrade modals.
2. **Skeleton screens + count-up pairing [M]** — skeletons matching final card/chart dimensions for metric cards, score widgets, report sections, screener rows; start with the fixed `h-screen` spinner loaders (map/market/graphs).
3. **Serwist SW foundation + update toast [M]** — `@serwist/next` in `next.config.mjs` (inside `withSentryConfig`), `app/sw.ts` precache + document fallback → `/offline`. **NO auto-`skipWaiting`**: waiting SW → M3 snackbar → `postMessage(SKIP_WAITING)` + reload only on tap. Gitignore generated `public/sw.js`; verify Railway image carries it. Risk: Serwist×Next 16.1.1 — prove on first `.next-verify` build; fallback = standalone esbuild `injectManifest`.
4. **Branded `/offline` page [S]** — `app/offline/page.tsx`, M3 semantic vars, retry button.
5. **Middleware `/sw.js` exclusion [S]** — matcher exclusions (`middleware.ts:313`).

### Phase 2 — Install experience

1. **Manifest completeness [S]** — `id: "/"`, `display_override`, `categories`, `shortcuts` ("Analyze a Deal" → `/analyzer`, "Top Markets" → `/markets`), maskable 512 icon. Decisions: `start_url` `?utm_source=pwa`; `screenshots` (can trail).
2. **`appleWebApp` block + status bar [S]** — `capable`, `title`, `statusBarStyle: "black-translucent"` + `@media (display-mode: standalone)` `.pt-safe` on sticky Header (ship together).
3. **iOS splash screens [M]** — `pwa-asset-generator` → `public/splash/` + `appleWebApp.startupImage` matrix.
4. **Install prompt UX [M]** — `lib/pwa/use-install-prompt.ts` (beforeinstallprompt capture, `isStandalone()` util, iOS detect, `appinstalled` → GA); value-moment localStorage counter fed from `use-grading-result.ts` + ReportViewer; `InstallBanner.tsx` (Android prompt / iOS instructions, localStorage dismissal — copy StickyScoreBar pattern); "Get the app" in Header profile dropdown (hidden when standalone).

### Phase 3 — Native feel + navigation (bottom bar approved: always on mobile)

1. **Bottom tab bar [L]** — `src/components/layout/BottomNavBar.tsx`, M3 navigation-bar spec, destinations Map/Markets/Screener/Reports/Scores, reuse `header-nav-data.ts`. Mount in AppShell `lg:hidden`. Content bottom clearance; z-index audit vs map FABs/sheets.
2. **Touch CSS resets [S]** — `touch-action: manipulation`; tap-highlight transparent; `user-select: none` + touch-callout none on buttons/nav; `overscroll-behavior-y: none`; `:active scale(0.97)` with M3 duration. (Do NOT import stray untracked `.ds-styles.css`.)
3. **44px touch targets [M]** — hamburger, GeoLevelPills, metric rows (padding/pseudo-element hit areas).
4. **Safe-area sweep [S]** — `.pt-safe` on RightDetailPanel full-screen header + other overlays.
5. **dvh migration [S]** — `min-h-screen` → `min-h-dvh`; `h-screen` loaders → `h-dvh`.
6. **Haptics [S]** — `navigator.vibrate(10)` feature-detected on key confirmations.
7. **Dynamic theme-color [S]** — sync meta with header surface; dark-mode swap.
8. **View Transitions API [M]** — cross-fade + shared-element market-list → detail; Safari fallback.
9. **Hover→touch fallbacks [M]** — ConfidenceDisplay + RichTooltip tap toggle (copy MetricHelpButton). D3 tooltips = follow-on [L].
10. **Keyboard occlusion [S]** — `interactive-widget=resizes-content`; verify scroll-into-view on focus.

### Phase 4 — Offline + caching

1. **SW runtime caching `/backend` GETs [M]** — GET-only, exclude SSE; stale-while-revalidate, bounded expiration. Entitlement policy: public/metric endpoint allowlist + `caches.delete()` on sign-out via postMessage.
2. **React Query persister [M]** — `@tanstack/react-query-persist-client` + IndexedDB (`idb-keyval`); `app/query-persistence.ts`; `buster` = build id, `maxAge` 24h; extend `QueryCacheCleaner` to purge persisted store on sign-out. iOS 7-day eviction = best-effort cache only.
3. **"Cached data from X ago" indicator [S-M]** — RQ `dataUpdatedAt`-driven badge.
4. **GeoJSON + fonts [S]** — CacheFirst on `/geojson/*.json` (precache national+state only); verify fonts via defaultCache. Delete orphaned `cbsa_2023.json`.
5. **`useOnlineStatus` + OfflineBanner [S-M]** — `lib/hooks/use-online-status.ts` + M3 banner in AppShell; map honest-failure UX (`useMapLayers.ts:269`).
6. **Lazy-load heavy libs + analyzer [M-L]** — mapbox-gl on `/map`, recharts in reports/analyzer, docx/pptxgenjs; add `@next/bundle-analyzer`. Feeds Play-TWA Lighthouse ≥80.

### Phase 5 — Auth hardening, capabilities, stores

1. **OTP password reset [M]** — Supabase Reset template gets `{{ .Token }}` (user action, keep link); `verifyOtp({type:"recovery"})` + `updateUser`; extract shared `components/auth/OtpCodeForm.tsx` from OtpConfirmation.
2. **Magic-link code alternative [S-M]** — `{{ .Token }}` in template (user action) + "enter code instead" on sign-in.
3. **Standalone-aware auth UX [S]** — code-first flows in standalone; verify OAuth on installed device.
4. **Web Share API [S]** — `navigator.share()` in ShareReportModal/ShareMarketModal with fallback.
5. **Push notifications + Badging [L]** — SW push handler + NestJS `web-push` wired to watched-market alerts; in-context permission; `setAppBadge` on alert delivery.
6. **Play Store TWA [M + $25 go/no-go]** — Bubblewrap/PWABuilder; static `public/.well-known/assetlinks.json`; needs Phases 1-2 + Lighthouse ≥80.
7. **iOS App Store [RECOMMEND DEFER]** — $99/yr + Mac/Xcode + Guideline 4.2 risk + name collision (id6762011177) → distinct display name needed. Revisit after Phases 1-5.

### Open user decisions

`start_url` utm param (P2.1) · manifest screenshots (P2.1) · D3 tooltip migration timing (P3.9) · Play $25 go/no-go (P5.6) · iOS wrapper + naming (P5.7) · Supabase email template edits (P5.1/5.2).

## Verification

Per phase, using the prod-preview pattern (`NEXT_DIST_DIR=.next-verify npm run build -w web` → `next start -p 3100`, never `.next-dev`):

- **P1:** DevTools → SW activated w/ fetch handler, zero manifest warnings. Playwright: `setOffline(true)` → branded `/offline`; modal + browser back closes it (not the page); update toast on new deploy, no auto-reload. Real Android: WebAPK install. Real iPhone: standalone launch, status bar correct. (Lighthouse 12 dropped the PWA category — use DevTools installability + PWABuilder report.)
- **P2:** two analyzer grades → banner; dismiss → hidden but "Get the app" present; standalone → all install UI absent; `appinstalled` in GA DebugView; iOS splash; icon shortcuts.
- **P3:** Playwright 390×844: bottom bar all routes w/ active state; ≥44px bounding boxes; `scrollWidth === clientWidth` (re-run 38-route sweep). Real phone: no pull-to-refresh reload, no tap flash, notch clear.
- **P4:** warm-load market+report → airplane mode → reload → cached data + "cached data from X ago" + OfflineBanner; SSE produces zero cache entries; sign-out purges IndexedDB + SW cache; bundle-analyzer before/after in PR.
- **P5:** real iPhone: password reset via code fully in-app; magic-link code sign-in; native share sheet; push permission only after watching a market; TWA internal-testing launches chromeless.
