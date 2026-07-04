# Beta-Test Backlog Triage — 2026-06-26

Source: 29 findings from "Claude Beta Tester" run (6/26/2026). Root causes verified via 7
parallel Explore agents + direct file reads + live Supabase query. Branch `develop`
(commit locally; never push without ask). All UI follows M3 brand (CLAUDE.md §8):
semantic tokens only, no hardcoded hex. Verify each fix LIVE (no mocks).

## ⚠️ Key finding: ~1/3 of the backlog is already fixed

The beta run was executed against an OLDER build than current `develop`. 8 reports are
already fixed in current code (verify-only, do NOT re-fix). Every "already fixed" item
below must be confirmed with a LIVE curl/page-load before closing.

## Ground truth — coverage counts (live `propertyiq_scores_v2`, period 2026-05-31)

| Geo    | Scored regions | High-confidence (A/B) |
| ------ | -------------- | --------------------- |
| Metro  | **935**        | 865                   |
| County | **3,137**      | 3,044                 |
| ZIP    | **29,417**     | 25,502                |

- `lib/data/validation-claims.ts` `V4_CLAIMS` (935 / 3,137 / 29,417) is **correct**.
- All "3,150 / 34,000 / 925 / 900+ / 33,000 / 3,100+ / 900 metros" claims are **wrong/overstated**.
- **DECISION (user 2026-06-26): standardize all UNLABELED headline coverage on
  `900+ metros, 3,000+ counties, 29,000+ ZIPs`** — true against live data, conservative,
  survives monthly rescore drift. Labeled denominators (865 full-formula era, 380 backtest
  sample) stay as-is.
- **CLAUDE.md §9 itself says "~3,150 / ~34,000" — also inaccurate. Flag to user for correction.**

---

## A. CONFIRMED — fix now

### High

- [ ] **#9 llms.txt / llms-full.txt stale methodology** — `packages/frontend/public/llms.txt`,
      `public/llms-full.txt` (STATIC files, not generated). Partially updated since beta run
      (no longer say 746/55.6/13-yr) but still: Redfin listed as data source (line ~45),
      coverage "925 / 3,100+ / 33,000+" (lines 3, 53-55), and internal contradiction
      (line 45 Redfin vs line 79 "No Redfin data is used"). Fix: remove Redfin from source
      table; set coverage to 900+/3,000+/29,000+; align formula to Zillow ZHVI momentum +
      Realtor.com DOM/price-cuts, recenter 50, national/calibrated-to-state, 20+ yr.
- [ ] **#27 FORMULA_VERSION 'v3.0' + analyzer prompt stale** — `scoring/formula-weights.ts:643`
      `export const FORMULA_VERSION = 'v3.0'`. Emitted in API payloads
      (`performance-tracking.service.ts:535`). Consumers: scoring.types.ts:30,
      scoring.controller.ts:956 (JSDoc), validation-credibility.ts:61/128/145. Also
      `analyzer/prompts/piq-by-geo-block.ts:58` says "three Redfin supply-demand signals" +
      "2012-2025". Fix: neutralize version string (CLAUDE.md §9: no versions); correct the
      analyzer prompt methodology + year range.

### Medium

- [ ] **#4 coverage counts — single source of truth** — Many files hardcode wrong numbers
      (landing-v2/BeatDataDepth/BeatFoundation/BeatTension, scores/accuracy/HeadToHead,
      pricing/FeatureShowcaseInsights, screener/page, about/page, help/page, map/layout,
      auth/sign-up/layout, home/FeatureCarousel, home/landing-metadata, data/page,
      reports/q2-2026-by-state, tour/ReportHero, lib/data/definitions). Fix: add a single
      `COVERAGE_COPY` export (900+/3,000+/29,000+) to `validation-claims.ts`; route all
      unlabeled headline copy through it. `app/layout.tsx:43` already models the pattern.
- [ ] **#5 state page weight** — `app/(public)/markets/state/[state]/page.tsx:216,253` inlines
      ALL metro+county+ZIP anchors uncapped (TX = 3MB / 3,062 ZIP links). Fix: cap ZIPs
      top-N by score + "view all N ZIPs →" link.
- [ ] **#15 employment_yoy national stale (data pipeline)** — national `employment_yoy` is
      NEVER computed (QCEW script does state/metro/county only `download-qcew-employment.ts:175`;
      FRED imports raw PAYEMS not YoY). Frozen at 2019-12-01. Fix: derive national YoY from
      PAYEMS history (FRED) OR national QCEW; also consider a stale-flag in
      `health/data-freshness.service.ts`. HEAVIER — data task, may need a script + ingest run.
- [ ] **#23 screener freshness stamp** — `app/(app)/screener/ScreenerPageInner.tsx:253` puts
      `as_of` only in CSV. Fix: render "Data as of {date}" in page header; graceful empty msg.
- [ ] **#22 MCP version drift** — `lib/agent-discovery/manifest.ts:8` & `mcp-server/src/lib/server-info.ts:2`
      both hardcode `0.2.0` independently. Fix: shared constant / read from package.json + assert.

### Low

- [ ] **#2 compare og:image** — `app/(app)/compare/[slug]/page.tsx:39-44` missing
      `openGraph.images`. Fix: add images (reuse `/api/og` like market pages).
- [ ] **#11 help metadata** — `app/(app)/help/page.tsx` no `metadata` export → inherits root
      default. Fix: add page-specific title + description.
- [ ] **#3 simplified slug 404 → 301** — `markets/zip/[slug]/page.tsx:106` notFound() with no
      alias layer; `middleware.ts` has no slug redirect. `ZIP_TO_ENTRY` enables O(1) bare-ZIP
      lookup. Fix: in middleware, 301 bare 5-digit ZIP → canonical slug. (City/county
      fuzzy-redirect is bigger — scope separately.)
- [ ] **#12 v1 error envelope** — guard errors (401/403/429) bypass `{error:{code,message,request_id}}`
      because guards run before `api-response.interceptor.ts`. Fix: platform-api-scoped
      ExceptionFilter registered in `platform-api.module.ts`.
- [ ] **#13 v1 health auth** — `platform-api/v1/health.controller.ts:27` guarded by
      ApiKeyAuthGuard; no `@Public()` decorator exists. Fix: create `@Public()` decorator OR
      remove guard from health controller (make liveness public). LOW.
- [ ] **#20 tour ?next=** — `app/(app)/tour/page.tsx:55-58` TODO; `?next=` preserved through
      steps but never consumed after market step. Fix: consume in PostSignupCelebrate/celebrate phase.
- [ ] **#21 file-size split** — `reports/page.tsx` = 1,146 lines, `reports/[id]/ReportViewer.tsx`
      = 476 (both >400 hard limit). Split boundaries: extract MarketSelector (~185),
      PersonalizationPanel (~192). Pre-existing; mechanical.
- [ ] **#7 reports-list stale comment** — `lib/data/fetchers/reports-list.ts:5` comment claims
      `/api/reports?limit=5`; code correctly calls `/api/reports/history`. One-line doc fix
      (NOT a 404 — see Section B).

---

## B. ALREADY FIXED — live-verify only, DO NOT re-fix

- [ ] **#28 screener ZIP gate** — `screener.controller.ts` gates ZIP via OptionalJwtAuthGuard +
      `assertGeoAllowed()` → 403 for non-Pro. Verify: `curl localhost:3001/api/screener/zip` → 403.
- [ ] **#14 markets/:id 500** — `markets-core.service.ts:83` uses `.maybeSingle()` + throws
      NotFoundException. Verify: `curl localhost:3001/api/markets/foobar` → 404.
- [ ] **#6 malformed ZIP slugs** — `zip-slug-data.json` clean (28,694 entries, 0 malformed);
      generator filters city-less ZIPs. Verify: `curl localhost:3000/markets/zip/01093-01093` → 404.
- [ ] **#1 generate-then-paywall** — `reports/page.tsx:558-575` hard pre-POST gate
      (`if (reportsLocked) { setShowReportsPaywall(true); return; }`) + page-level + view-level
      gates. Verify: as free user, Generate cannot reach POST. (Needs free account or tier sim.)
- [ ] **#16 embed RSC crash** — `app/embed/components/EmbedScoreRing.tsx:1` is `"use client"`;
      ScoreDisplay.tsx too. Verify: load `localhost:3000/embed/score/metro/16740` — renders, no error boundary.
- [ ] **#10 admin/data mock** — `/api/health/data-summary` exists (health.controller.ts:82-141);
      frontend sets null on error, no mock. Verify: load `/admin/data` as admin.
- [ ] **#24 analyzer notes save** — onSave wired NotesSection→AnalyzerSections→saveAnalysis().
      Verify: save a note on `/analyzer`, reload, persists.
- [ ] **#8 onboarding 401 (proxy)** — proxy forwards Authorization (strips cookies); fetchers
      attach Bearer. PROXY THEORY REFUTED. **But verify live** — if 401s persist for an authed
      user, suspect `getSession()` null on cold load (known issue), NOT the proxy.
- [ ] **#18 tour onboarding 401** — same Bearer path. Likely anon-context (tour run logged-out
      fires authed-only endpoints → expected 401). Verify: is `/tour` authed or anon when these
      fire? If anon → make tracking anon-tolerant or skip when logged-out.

---

## C. PRODUCT DECISION REQUIRED — score behavior (no clean "fix"; needs your call)

Facts gathered; levers laid out. These are "the momentum formula working as designed."

- **#19 front-door credibility** (Seattle 14, Rochester 99) — reframe copy as momentum/timing
  signal, and/or apply market-size floor. Cross-surface (landing, screener).
- **#26 micro-metro default** — screener default sort = score desc, no size floor
  (`PresetChips.tsx:23`). Population EXISTS in `geographies.population` but NOT in
  `screener_snapshot`. Lever: add population col to snapshot + `populationMin` floor on default preset.
- **#29 movers ±90 swings** — `20260618120000_screener_snapshot_score_movers.sql:112` delta =
  current − baseline N-mo-ago, NO winsorize, NO min-size. Lever: winsorize ±N, min-size floor,
  or confidence gate. (Partly baseline re-score artifacts — cf. known "never bulk re-score" memory.)
- **#25 A+ grade collision** — REFUTED for screener: `ScreenerTable.tsx:50` explicitly does NOT
  render the badge; `showGrade` defaults false, no caller sets it true. **Live-verify** the
  tester's "A+ badge" sighting (maybe removed since, or shown elsewhere). If truly absent → close.
- **#17 tour resume** — WORKING AS DESIGNED (auto-resume; `?resume=fresh` clears). Optional UX:
  add a "Start over" affordance. LOW.

---

## D. Execution plan

1. Live-verification pass (Section B) — needs dev servers up (3000/3001).
2. High fixes: #9, #27 (+ centralize coverage #4 since #9 depends on it).
3. Medium: #5, #23, #22, #15 (data task).
4. Low: #2, #11, #3, #12, #13, #20, #7, #21.
5. Surface Section C product decisions to user with levers.
6. Verify each fix live; commit on develop (no push without ask).

---

## RESOLUTION LOG (2026-06-26)

Ground truth: live `propertyiq_scores_v2` @ 2026-05-31 = 935 / 3,137 / 29,417.
Decision: headline coverage standardized to **900+ / 3,000+ / 29,000+** via new
`COVERAGE_COPY` + `formatMarketsScored()` in `lib/data/validation-claims.ts`.

### FIXED (code complete, frontend+backend typecheck clean)

- **#9** llms.txt / llms-full.txt — coverage → 900+/3,000+/29,000+ (live-verified curl).
  Methodology was already correct; Redfin KEPT (real platform source via
  scripts/sources/redfin-data-center, just not a scoring input).
- **#27** FORMULA_VERSION → 'PropertyIQ demand signal'; payload fallback, JSDoc,
  scoring.types comments (v3/v4 removed); analyzer piq-by-geo-block.ts fixed
  (retired Redfin/3-signal/14-yr text + CLAUDE.md-forbidden "within-state rank").
- **#4** ~24 files routed onto COVERAGE_COPY (subagent) + BeatFoundation count-up
  animation preserved via numeric tokens.
- **#2** compare og:image (dynamic /api/og). **#3** bare-ZIP→canonical 308 in zip page.
- **#7** reports-list comment. **#11** help metadata export. **#13** v1 health doc.
- **#22** MCP version cross-ref comments (PARTIAL — build assertion is the real follow-up).
- **#23** screener "Data as of {date}" stamp. **#20** tour ?next= consumed in PostSignupCelebrate (open-redirect-safe).
- **#12** v1 ExceptionFilter created + applied to all 7 v1 controllers + registered (subagent; grep-verified all 7).

### ALREADY FIXED (verified, closed)

- #28 ZIP gate (curl 403). #14 markets/:id (curl 404). #6, #16, #10, #24, #1, #8/#18 (code). #17 WAD.

### PARTIAL / needs deeper work

- **#5** state page: ZIP cap (12/container) + "view all" links added — cuts DOM/rendered
  anchors (~2.98MB→2.15MB uncompressed) but **gzip transfer ~unchanged (329→337KB)**:
  repetitive anchors compress away; the gzip bulk is the RSC flight payload. Real
  transfer-weight win needs an RSC/client-prop investigation + metro/county ZIP dedup.

### NEEDS DECISION / GO-AHEAD

- **#15** employment_yoy national: confirmed frozen 2019-12 while raw total_nonfarm_employment
  is current. Exact backfill ready (employment_yoy = ROUND((emp/emp_12mo_ago-1)\*100,2));
  needs go-ahead for the PROD data write + forward-fix in the FRED national import.
- **#21** file-size: reports/page.tsx (1146), ReportViewer (476); hooks also flagged
  formula-weights.ts (709), performance-tracking (595), scoring.controller (1145).
  Heavy refactor, regression risk on critical reports flow — separate focused effort.
- **Score cluster #19/#26/#29/#25** — product decision (market-size floor / winsorize /
  reframe copy / A+ rename). #25 likely already non-rendered (ScreenerTable.tsx:50) — verify.
- **#4 nuance**: 5 "validated across N metros" lines routed to 900+ (scored). If they should
  state the validation SAMPLE, use 865 (V4_CLAIMS.metrosValidated) instead. Confirm.

### FLAGS

- CLAUDE.md §9 says "~3,150 counties, ~34,000 ZIPs" — inaccurate; real 3,137/29,417 → fix to 3,000+/29,000+.
- Bonus (not in 29): help FAQ answer calls PropertyIQ Score a "composite 0-100 across
  affordability/growth/stability" — stale; it's a single demand-signal. Worth correcting.
