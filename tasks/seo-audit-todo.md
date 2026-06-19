# SEO Audit Implementation (2026-06-19)

Source: `docs/seo/2026-06-19-propertyiq-google-seo-audit.md`
Branch: `develop` (commit locally; never push without ask).
Standards: production-ready, no workarounds; verify LIVE (no mocks); all data via `@/lib/data`.

## DONE — typecheck-clean (frontend + backend), pending LIVE render verification

- [x] **C1** gate index + sitemap on data-sufficiency (in-flight from prior session + verified)
  - backend `GET /api/scores/ids/:geography` (now also returns `date`); fetcher fails open; sitemap `scoredEntries`; pages `noindex,follow` when scoreless. **Live-confirmed:** endpoint returns `{date:"2026-05-31", count:935, ids:[…]}`.
- [x] **H1** live data in titles + descriptions — shared `lib/seo/market-metadata.ts` (`buildMarketTitle`/`buildMarketDescription`); wired into all 3 `generateMetadata`. Fetches stats concurrently with the index check (cache hit).
- [x] **H2** real numbers in body prose — `buildMarketDataSummary` lead paragraph; all 3 `generate-seo-content.ts` accept `stats`; rendered first (emphasized).
- [x] **C2** staleness ceiling — `isMarketDataStale` (120-day) in `fetchSeoMarketStats`; stale → null → block/JSON-LD drop + boilerplate fallback (no stale number reaches title/prose).
- [x] **H3** Railway duplicate-host redirect — middleware 308 + `next.config` redirect, **exact host** `propertyiq.up.railway.app` (preview deploys untouched; healthcheck host unaffected).
- [x] **H4** honest `<lastmod>` — driven by each geo's real latest score period (exposed from ids endpoint); static/state omit lastmod; blog keeps real date.
- [x] **H7** AI crawlers — `robots.ts` explicitly allows citation + training bots (decision: allow everything), keeps `*` catch-all.
- [x] **M1** no hardcoded `2026` — year derived from `latestDate` (folded into market-metadata).
- [x] **L1** dropped `changefreq`/`priority` from `sitemap-xml.ts` (Google ignores; ~2.5MB saved).

## DONE — UI tier (live-verified)

- [x] **H5** public methodology page (E-E-A-T). ROOT CAUSE was not auth-gating — `(app)/scores/methodology/page.tsx` `fs.readFileSync` used a path missing the `(app)` route-group segment → ENOENT → **500 on every hit** (broke at the route-group refactor). Fixed path + `outputFileTracingIncludes` (prod standalone). Page now 200. Added sitewide `Organization` JSON-LD (`OrganizationJsonLd` in `AppShell`) + footer Methodology/Data/About links. Deferred: per-market-page "near the score" byline (footer link already covers market pages).
- [x] **H6** hero LCP — `HeroSection` H1 renders full-opacity in SSR (removed `inView` opacity gating on the LCP element); `WebVitals` component (Next `useReportWebVitals`, no new dep) → GA4 via gtag, mounted in `AppShell`.

## COMMITTED

- `5b5d40a8` on `develop` (local, NOT pushed) — 31 files, +990/-341. All 14 audit items (C1, C2, H1-H7, M1-M2, L1-L4; L5 no-op) implemented + live-verified.

## DONE — structured-data backlog (typecheck-clean)

- [x] **M2** `sameAs` → only the real owned profile `linkedin.com/company/property-iq`; dropped the defunct twitter (no X account exists).
- [x] **L2** dropped deprecated `SearchAction` from `JsonLd.tsx` (bare `WebSite{name,url,publisher}`).
- [x] **L3** de-dup `/data` JSON-LD — inline script now carries only the unique `DataCatalog`; `WebPageJsonLd` is the single `WebPage`+`BreadcrumbList`.
- [x] **L4** enriched `Dataset` with `spatialCoverage`/`temporalCoverage`/`isAccessibleForFree`/`keywords`.
- [~] **L5** `FAQPage` — NO code change (audit says "deprioritize", not remove; markup is inert-but-harmless). Accordion kept for users.

## Verification — LIVE against real prod data (2026-06-19, frontend :3000)

- ✅ Scored metro `abilene-tx`: title `Abilene, TX Housing Market: $217K Median, PropertyIQ Score 94 (2026)`; desc with real numbers; no robots meta (indexable); H2 lead has real numbers + "well above the state average of 50".
- ✅ Scored ZIP `99501-anchorage-ak`: title `…$355K Median, PropertyIQ Score 53 (2026)`; H2 score 53 → "right around the state average of 50" (banding correct).
- ✅ Scoreless ZIP `99505-jber-ak`: `<meta name="robots" content="noindex, follow">`; fallback title (no fabricated numbers). (35201 confirmed not in scored set.)
- ✅ `/sitemaps/metros`: real `<lastmod>2026-05-31T00:00:00.000Z`, no changefreq/priority.
- ✅ `/robots.txt`: citation + training bots named; wildcard kept.
- ✅ Railway host 308→www for page paths AND `/sitemap.xml` (config-level).
- ✅ Backend `/api/scores/ids/zip`: 29,417 scored, date 2026-05-31.
- C2: typeclean + logic confirmed (stale → null cascades; 35201-style case folds into C1 noindex). No isolated stale-but-scored geo tested.

## Pending: H5 + H6 (UI — frontend-design skill); then commit (local; user pushes).
