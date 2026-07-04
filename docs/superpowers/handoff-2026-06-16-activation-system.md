# Onboarding/Activation Redesign — Session Handoff (updated 2026-06-17)

**Read this first to resume.** Single source of truth for continuing the work.
Branch: `develop`. **5 commits are committed LOCALLY but NOT pushed** (user pushes):
`669b36ed`, `7be5818d`, `e64f22a1`, `0f946036`, `2b15411b` (HEAD). Everything older
is on `origin/develop`. See the unpushed set with `git log --oneline origin/develop..develop`.

---

## TL;DR

Full onboarding→14-day-activation redesign. Order: fix the broken tour → fix the
live trial bug → report-as-finale + checklist → coverage signal + return-surface +
behavior-aware email drip.

**Done & pushed (prior sessions):** P0a, P0b (migration **applied to prod**), P1,
the report-render contract fix, P2 Tasks 1–3, the 4 backend report sections, the
activation welcome→sign-in→map flow + open-redirect hardening.

**Done THIS session — committed LOCALLY, NOT pushed:**

- **P2 COMPLETE** (Tasks 4–5: feature-coverage signal + dashboard return-surface) — `669b36ed`, `7be5818d`.
- **Finale report fixes** (the deferred "design cleanup", now in progress):
  - Premium **hero** — Score gauge + KPI tiles w/ sparklines + editorial serif — `2b15411b`.
  - AI narrative now routes to **DeepSeek** (the configured default), reliably (fence-parse + truncation fixed) — `e64f22a1`.
  - Real **market name** resolves + **score reads /100** + pre-existing `daf8344c` debt repaired (sections tsc error + removed mock specs) — `0f946036`.

**Next, in order:**

1. **Finish the finale design cleanup** (in progress — see its own section below):
   - ❌ **Drop empty/limited sections + renumber survivors** (user HARD RULE; the body still renders empty sections below the hero).
   - ❌ Chart polish (trajectory / forecast / affordability gauges).
   - ❌ Redesign the remaining body sections (market-now, peers, migration, employment, validation, ai-strategy) to match the hero.
2. **P3** — behavior-aware drip + Claude/MCP email (NOT started).

---

## The design docs (read after this handoff)

- **Spec:** `docs/superpowers/specs/2026-06-16-onboarding-activation-redesign-design.md`
- **Plans** (`docs/superpowers/plans/2026-06-16-*`):
  - `tour-rebuild-and-system-b-deletion.md` — P0a ✅
  - `trial-unblur.md` — P0b ✅ (migration applied to prod)
  - `aha-tour-report-springboard-checklist.md` — P1 ✅
  - `coverage-signal-and-return-surface.md` — P2 ✅ COMPLETE (Tasks 1–5)
  - `behavior-aware-drip-and-mcp-email.md` — P3 ⏳ not started
- **No plan doc for the finale design cleanup** — it's user-directed iterative work; see the "Finale report cleanup" section below.

---

## What's DONE (rows marked 🆕 are committed LOCALLY only, not yet pushed)

| Phase                     | What                                                                                                                                                                                                      | Key commits                                                                      | Verified                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P0a                       | Delete System B, consolidate spotlight, fix the blur, no-target auto-skip, mobile cutout, dismiss→`/dashboard`, nav-persistence, reduced-motion                                                           | `169c4838`…`6cef8aa8`                                                            | live E2E (`tour-spotlight.spec.ts`)                                            |
| P0b                       | Trial-unblur: `handle_new_user` inserts `user_trials`; SSR-seeded entitlements                                                                                                                            | `609ca0c0`,`ad75093a`,`d466e098`; **migration `20260616213835` APPLIED TO PROD** | real signup (user_trials row, tier=pro)                                        |
| P1                        | 2-step Score→Why arc, de-watermarked finale, persona springboard (Connect-Claude hero), value-framed checklist                                                                                            | `fd029281`…`307981dd`                                                            | opus-reviewed; live spotlight E2E                                              |
| Authed report             | `POST /api/anonymous/listing-presentation/authenticated` (JWT, name resolved server-side)                                                                                                                 | `2c9831b0`                                                                       | unit + curl 201                                                                |
| Report render             | `listing-sections/adapt-sections.ts` — backend section shapes → component props                                                                                                                           | `11989fe5`                                                                       | 36 unit + live E2E `tour-aha.spec.ts`                                          |
| P2 (1–3)                  | Instrument analyzer/screener/graphs/watchlist (`feature.*`); MCP-connected event; `GET /api/usage/coverage`                                                                                               | `a33b5d27`,`ac2afb52`,`f1bf1dfb`                                                 | unit                                                                           |
| **4 sections (NEW)**      | **trajectory / forecast / affordability / validation populated with real, substantiated data**                                                                                                            | **`daf8344c`**                                                                   | unit (68) + **live Playwright screenshot** of authed finale                    |
| **Activation flow (NEW)** | welcome email → `/auth/sign-in?redirect=/map` gate; sign-in auto-forwards live sessions; export `useAuthenticatedListingPresentation`                                                                     | **`7832cac4`**                                                                   | frontend tsc clean                                                             |
| **Security (NEW)**        | open-redirect guard on sign-in `?redirect=` (same-origin relative only)                                                                                                                                   | **`2772fe77`**                                                                   | flagged by commit security review, fixed                                       |
| **P2 Batch 3 🆕**         | feature-coverage signal (`lib/feature-coverage/`) + `useFeatureCoverage` + `fetchUsageCoverage`; `NextBestActionCard` return-surface on dashboard                                                         | **`669b36ed`,`7be5818d`**                                                        | unit (7) + lint + whole-project tsc + live authed Playwright dashboard render  |
| **Finale AI fix 🆕**      | narrative routes to **DeepSeek** via `AiProviderService.complete(LISTING_PRESENTATION_NARRATIVE)` (was hardcoded Anthropic); fence-parse via new `ai/extract-json.ts`; `maxTokens` 1500→3000 (truncation) | **`e64f22a1`**                                                                   | extract-json unit + **live authed E2E** (Austin+Dallas, fallback=0)            |
| **Finale name+score 🆕**  | `getMarketCore` reads real `geographies` table (the `geographies_with_scores` view never existed); score scale `/100`; fixed pre-existing `daf8344c` sections tsc error; removed mock-based service specs | **`0f946036`**                                                                   | backend tsc clean + 37 backend tests + **live E2E** (real metro name, "X/100") |
| **Finale hero 🆕**        | `ReportHero` (Score gauge + KPI tiles + sparklines), `ScoreGauge`/`Sparkline`, `adapt-hero`/`adapt-utils`, serif `ExecutiveSummary`, `--font-serif` token, name resolve via `CBSA_TO_METRO`               | **`2b15411b`**                                                                   | 42 frontend tests + whole-project tsc + **live authed Playwright finale**      |

> Parallel user work already on `origin/develop`: `cc2b1d8c` (anon exec_sql RCE / RLS), `6de6684b` (FK indexes). Always stage own files explicitly (never `git add -A`) and `git branch --show-current` before committing.

---

## The 4 sections — how they work (NEW, commit `daf8344c`)

Orchestrated by **`packages/backend/src/anonymous/listing-presentation-sections.service.ts`**
(injected into `ListingPresentationService`; module wired in `anonymous.module.ts` with
`TimeSeriesModule` + `ZillowModule`). The market's raw ZHVI series is fetched **once** and
reused by trajectory + forecast.

- **trajectory-12mo** — real indexed ZHVI series (start=100) for the market + its parent
  metro (county/zip only) + state, each with window YoY. **Generic `series[]`** (component
  refactored), so metro/county/zip all label honestly. Uses the **server-resolved** market
  name (`marketCore.name`), not the bare geoId.
- **forecast** — Zillow ZHVF **point** forecast (metro+ZIP only) as the drift; an **80%
  interval is MODELED** from the market's own historical volatility (random-walk cone in
  **`forecast-band.ts`**). ZHVF units are **percent** (confirmed: NY 12-mo = `1.0` = +1.0%).
  **Rent card + risk card REMOVED** (no data to substantiate). County/state/national → limited.
- **affordability** (`affordability.ts`) — price-to-income index (0–100) + price-to-rent
  ratio gauge, computed from resolved metrics. **Income uses registry key `median_income`**
  (NOT the unregistered `household_income_median` — that was the bug that showed
  "unavailable"; see Gotchas).
- **validation** (`validation-section.ts`) — **sanctioned geo-type-level** stats from
  `reports/validation-credibility.ts` (no per-market data exists). Copy rewritten so it
  **never claims "this metro"** — "validated across 865 metros / 3,061 counties / 25,783 ZIPs".

Frontend: `adapt-sections.ts` maps the real shapes → props defensively; the 4 components
(`Trajectory`/`Forecast`/`Affordability`/`Validation`) updated to honest contracts; tests +
the realrender regression lock updated to populated shapes. Footer corrected (Realtor.com not
Redfin; dropped "v4"; accurate modeled-CI wording).

---

## DONE — P2 Batch 3 (plan `coverage-signal-and-return-surface.md`, Tasks 4–5)

Implemented & verified (commits `669b36ed`, `7be5818d`, local-only on `develop`).
**P2 is complete.** What actually shipped + deviations the next session must know:

- **Module dir is `lib/feature-coverage/`, NOT `lib/coverage/`.** `.gitignore:15`
  (`coverage/`) silently swallows any dir named `coverage`, so the plan's
  `lib/coverage/` path would never have committed (remote build TS2307). Renamed.
  Files: `feature-coverage.ts` (pure `deriveCoverage`/`FEATURES`/`PRIORITY`/
  `normalizePersona`), `useFeatureCoverage.ts`, `__tests__/feature-coverage.test.ts`.
- **`Persona` IS exported from `@/lib/data`** (handoff was wrong) — it's re-exported
  transitively via `_groups/onboarding.ts` ← `anonymous-listing-presentation.ts`
  (`"agent" | "investor" | "homebuyer"`). Reused it (no duplicate union, per §1.1).
- **Data-layer compliance:** the hook does NOT `fetch()` directly (the
  `content-guards` hook blocks it). Added `lib/data/fetchers/usage-coverage.ts`
  (`fetchUsageCoverage`, via `fetchAPIRaw`, soft-fails to empty), exported from the
  `_groups/onboarding` barrel.
- **Mount:** `NextBestActionCard` on `dashboard/page.tsx` between
  `<TrialExpirationBanner>` and `<ProgressChecklist>`, fed by
  `useFeatureCoverage(normalizePersona(onboardingState?.user_type))`.
- Confirmed: `getAuthHeaders` → `@/lib/data/fetchers/auth-headers`; `API_URL` →
  `@/lib/data/fetchers/base`; `fetchOnboardingState` IS in the `@/lib/data` barrel;
  event strings `analyzer_grade/screener_filter/graphs_view/watchlist_add/mcp_connected`.

## Finale report cleanup (IN PROGRESS — the deferred "design cleanup")

The finale = the listing-presentation report at `/tour?phase=step4`. Component tree:
`Step4Aha` → `ListingPresentation` → `ReportHero` + 10 `listing-sections/*` (each wraps
`Section.tsx`) + `PersonaSpringboard`/`InlineSignupForm`. Data via `adapt-sections.ts`
(+ `adapt-hero.ts`, `adapt-utils.ts`). Goal (user framing): make it obviously worth
**>> $39/mo** — a "$5k analyst report generated in 8 seconds." Direction chosen:
**hero verdict + dense dossier**.

**DONE this session:**

- **Hero** (`ReportHero.tsx`, `2b15411b`): indigo masthead + animated `ScoreGauge`
  (SVG ring, reduced-motion safe) + plain-English verdict + KPI tiles w/ `Sparkline`.
  `ExecutiveSummary` is now the serif narrative (score moved to hero); returns `null`
  when empty. `--font-serif` (Source Serif 4) added to `globals.css @theme`.
- **AI narrative fixed** (`e64f22a1`, `0f946036`): three root causes (all probe-found):
  (1) it **hardcoded Anthropic** — now `AiProviderService.complete(AI_PURPOSES.LISTING_PRESENTATION_NARRATIVE, …)` → the configured **DeepSeek** default (no `ai_model_config` row for the purpose yet → resolves via env `AI_PROVIDER=deepseek`; add a row to tune in prod);
  (2) models wrap JSON in a ` ```json ` fence → naive `JSON.parse` threw → new canonical `src/ai/extract-json.ts` (`extractJsonObject`) + `responseFormat:'json'`;
  (3) `deepseek-v4-pro` is verbose → `maxTokens:1500` truncated mid-JSON → raised to **3000**.
- **Market name** (`0f946036`): `getMarketCore` queried `geographies_with_scores`, a view
  that **was never created** → returned null for every market → report showed the bare geoId
  ("12420") and null parent-metro (→ empty peers). Repointed at the real **`geographies`**
  table (`geography_type`/`geography_id`/`name`/`cbsa_code`/`population`).
  `listing-presentation.service` resolves the name once (`resolvedMarket`) for narrative +
  trajectory; `ListingPresentation.tsx` also resolves bare geoIds via `CBSA_TO_METRO`.
- **Score scale** (`0f946036`): AI read `score: 9` as "9/10"; renamed fact to
  `propertyiqScore` + told the prompt it's 0–100 → verdicts now say "9/100".
- **daf8344c debt repaired**: pre-existing `sections.service` TS2339 (`getInheritanceChain().catch(() => [])` → `never[]`, fixed with a `GeoChainStep[]` annotation) and **two mock-everything service specs deleted** (they had failed since daf8344c and are the kind that hid the original bug — user directive: do not mock; real coverage = live E2E + the pure `extract-json` test).

**REMAINING (do next):**

1. **Drop empty/limited sections + renumber** (user HARD RULE). `adapt-sections` already
   flags each section `limitedData`; the body still renders the empty ones (e.g. "The
   market right now — Limited data"). Implement: `ListingPresentation` filters out
   `limitedData` sections and assigns sequential `num` to survivors (sections need a `num`
   prop; `ai` has no `limitedData` — treat empty as `!thesis && !strategyParagraphs.length`).
2. **Chart polish** — `TrajectoryChart`, `ForecastChart`, `Gauge`, `EmploymentBars` (pale/flat).
3. **Redesign remaining body sections** (market-now, peers, migration, employment,
   validation, ai-strategy) to match the hero's quality.

**Demo markets for screenshots (user wants a MIX of high + low):** capture one strong +
one weak market each iteration. Austin (`metro-12420`) ≈ 5/100, Dallas (`metro-19100`) ≈
9/100 are both low — still need a high-scoring one with rich data.

## THEN — P3 (plan `behavior-aware-drip-and-mcp-email.md`)

**Invert** the skip-active-trial guard in `drip.service.ts` (trial users SHOULD get the
feature-education drip), add behavior-aware skip-used (`drip-coverage.ts` reading the same
`feature.*` events), add the `ConnectClaude` email template (`packages/emails/`), register in
`DRIP_DAY_CONFIGS`. **Verify `RUN_CRONS=true` in prod** before relying on the drip.

---

## Gotchas / context the new session MUST know

- **Finale design cleanup is IN PROGRESS** (see its own section above) — hero + AI/name/score
  fixes done; drop-empty-sections + chart polish + remaining body sections still to do.
  Throwaway capture specs (UNTRACKED, local-only, do NOT commit):
  `packages/frontend/tests/e2e/finale-hero.spec.ts` (current — bumps `sessionId=heroshot-vN-*`
  each run to dodge any cache) and `report-screenshot.spec.ts`; screenshots land in
  `.report-shots/` (UNTRACKED). Use the **authed** path (storageState
  `tests/fixtures/.auth/enterprise-user.json`) for repeat captures.
- **`geographies_with_scores` VIEW DOES NOT EXIST** — `getMarketCore` queried it and silently
  returned null for everything. The real table is **`geographies`**
  (`geography_type`/`geography_id`/`name`/`cbsa_code`/`population`; no `household_count`).
  `PeersService` may still query the missing view — peers were already broken; out of scope
  but worth checking when peers matter.
- **AI services must route through `AiProviderService.complete(purpose, …)`** (resolves the
  configured default = DeepSeek via `ai_model_config`→env), NEVER a hardcoded provider client.
  Parse responses with `src/ai/extract-json.ts` (`extractJsonObject` — unwraps ` ```json `
  fences). Use `responseFormat:'json'` (json_object on DeepSeek/OpenAI, skipped on Anthropic).
  Give the model enough `maxTokens` (deepseek-v4-pro is verbose; ≥3000 for the narrative).
- **Supabase MCP:** use **`mcp__plugin_supabase_supabase__execute_sql`** with project
  **`pysflbhpnqwoczyuaaif`**. The Supabase MCP is authenticated and is the **preferred** tool
  for prod DB work — use it directly (don't fall back to ad-hoc node probes). Prod DB use does
  NOT require approval (user directive 2026-06-17).
- **NO MOCKS (user directive, escalated this session):** do not fix tests by mocking services.
  Pure-logic unit tests only (e.g. `extract-json.spec`); everything else verifies via **live
  E2E with real data**. Two mock-everything service specs were deleted for this reason.
- **`household_income_median` is NOT a registered metric** — the registry key is
  `median_income` (`metric-resolution/fallback-registry/census.ts`). The 4-sections fix added
  `median_income` to the report's metric batch. **Follow-up:** `market-now` still displays
  income via the `household_income_median` key in `adapt-sections.ts` (`METRIC_FORMAT`), so the
  "Median income" stat is silently dropped there — switch that key to `median_income` to
  restore it (out of scope for the 4-sections task; touches market-now + its fixtures).
- **Migration already applied to prod** — `handle_new_user` inserts `user_trials` (recorded as
  `20260616213835`). Do NOT re-apply.
- **Mocks hid a critical contract bug** (in `tasks/lessons.md`): always verify the report
  renders with REAL backend shapes / live E2E, never mock-only. Regression lock:
  `ListingPresentation.realrender.test.tsx`.
- **Dev servers** (`local-dev-servers` skill): restart = PowerShell `Get-Process node |
Stop-Process -Force` → confirm both ports `000` → ONE `npm run dev:fresh` (background).
  Frontend `:3000`, backend `:3001`. Warm routes (curl) before E2E. A `dev:fresh` may still be
  running from this session.
- **E2E:** `cd packages/frontend && PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright
test <name> --project=chromium` (override is MANDATORY; `.env.test` defaults to prod). The
  `chromium` project depends on `setup` (auto-refreshes auth from `.env.test` creds
  `troyhouston76@gmail.com`). Finale URL that renders the real report:
  `/tour?phase=step4&persona=investor&market=metro-39580&sessionId=...`.
- **Anon report endpoint is rate-limited once/day per IP** (429 on repeat) and blocks bot UAs;
  use the **authed** path (Playwright stored auth) for repeat verification.
- **DB/secrets:** `SUPABASE_DB_URL` + `SUPABASE_SERVICE_KEY` in `packages/backend/.env`; or
  Supabase MCP `execute_sql` (project `pysflbhpnqwoczyuaaif`). **Prod DB use does NOT require
  approval** (user directive 2026-06-17) — just query/use it. Still never echo secret values.
- **Verification standard (user rule):** unit (vitest/jest) + **live render with real data**.
  No mock-only UI verification.

## Open follow-ups (non-blocking)

- **market-now income stat** — switch `adapt-sections.ts` `METRIC_FORMAT` income key to
  `median_income` (see Gotchas).
- `BeaconProvider.allComplete` still uses OLD checklist task ids — reconcile with the new
  7-item `ProgressChecklist`.
- `triggerConfetti()` is fire-and-forget without a `.catch`.
- **`ListingPresentationCover.tsx`** is now UNUSED (replaced by `ReportHero`) — safe to delete.
- **`PeersService`** may still query the non-existent `geographies_with_scores` view — verify
  when peer comparison matters (peers currently empty for metros).
- **`market-now` `Days on market`** label collides with a hero KPI label — only matters if a
  test does `getByText(/Days on market/i)` (use a market-now-unique stat instead).

## Working-tree state at handoff

- Untracked, NOT ours, leave alone: the many root-level `*.jpeg`/`*.yml` snapshots,
  `packages/frontend/.next-verify/` (stale build artifact; its `go/[slug]/route.ts` is the one
  pre-existing `tsc` error to ignore), the throwaway capture specs
  `packages/frontend/tests/e2e/{report-screenshot,finale-hero}.spec.ts`, `.report-shots/`, and
  unrelated `docs/superpowers/*` files (ai-shadow-mode, ai-models-admin-streamline, etc.).
- This handoff doc itself is untracked (handoffs are not tracked in this repo).
- **5 unpushed commits on `develop`** (`669b36ed`→`2b15411b`). A local `dev:fresh` (frontend
  `:3000`, backend `:3001`) is running and has recompiled all backend changes.
