# PWA / Phone-App Build — 2026-07-12

Branch `worktree-PWA` (user-requested worktree). Full analysis + plan: `docs/plans/2026-07-12-propertyiq-phone-app-analysis-and-plan.md`.

## Phase 1 — Standalone correctness core (P0)

- [x] **1.1** History-API back handling (9 modals/sheets wired, desktop-gated RightDetailPanel) — 9dc8a1ec + dcdf8be9, re-reviewed ✅
- [x] **1.2** Skeleton screens matching final dimensions (map/market/graphs loaders + MetricCard/StatCard/ScoreWidget) — 27f22bc4, reviewed ✅ (follow-up: GraphsPageV2 internal spinners)
- [ ] **1.3** Serwist SW foundation (next.config wrapper, app/sw.ts, NO auto-skipWaiting) + update toast ("New version available, tap to refresh")
- [ ] **1.4** Branded `/offline` page (M3)
- [ ] **1.5** Middleware `/sw.js` matcher exclusion

## Phase 2 — Install experience

- [x] **2.1** Manifest completeness (id, shortcuts, maskable icon, display_override, categories) — 52e7b686, reviewed ✅
- [x] **2.2** appleWebApp block + black-translucent status bar — dc9394a0, reviewed ✅ (header `pt-safe-standalone` class = controller integration, pending)
- [x] **2.3** iOS splash screens (8-device sharp matrix, 759KB) — dc9394a0, reviewed ✅
- [x] **2.4** Install prompt UX (value-moment banner, iOS instructions, "Get the app", appinstalled→GA) — d376dff5 + 4b7fe98f, re-reviewed ✅ (mount = controller integration, pending)

## Phase 3 — Native feel + navigation

- [x] **3.1** Bottom tab bar (M3, always on mobile, reuse header-nav-data) — 1e773f58, reviewed ✅ (mount = controller integration, pending)
- [x] **3.2** Touch CSS resets + **3.4** safe-area utils + **3.5** dvh migration (12 pages) — d376dff5, reviewed ✅
- [ ] **3.3** 44px touch targets · **3.4** safe-area sweep · **3.5** dvh migration
- [ ] **3.6** Haptics · **3.7** dynamic theme-color · **3.8** View Transitions
- [x] **3.9** Hover→touch fallbacks (ConfidenceDisplay, RichTooltip, MetricTooltip, base Tooltip) — 911c8334+ceb07881+e2c6a6e6, approved ✅ · **3.10** keyboard occlusion — `interactiveWidget` shipped in 2.2 (dc9394a0)

## Phase 4 — Offline + caching

- [ ] **4.1** SW SWR on /backend GETs (allowlist + sign-out purge) · **4.2** RQ persister (IndexedDB)
- [ ] **4.3** "Cached data from X ago" indicator · **4.4** GeoJSON/fonts caching
- [ ] **4.5** useOnlineStatus + OfflineBanner + map honest-failure · **4.6** lazy-load heavy libs + bundle analyzer

## Phase 5 — Auth hardening, capabilities, stores

- [x] **5.1** OTP password reset · **5.2** magic-link code alternative · **5.3** standalone-aware auth UX — 80c3a5ad + 84d678c1 (backend hook emails now carry the code; Supabase dashboard edit NOT needed — templates unused), reviewed ✅ (GATES: live signup-chain e2e pre-merge; visual email check post-deploy)
- [ ] **5.4** Web Share API · **5.5** Push + Badging · **5.6** Play TWA ($25 gate) · **5.7** iOS store (DEFER)

## Review

**FINAL VERDICT: READY-TO-MERGE** (whole-branch review, 2 rounds). 20 commits on `worktree-PWA`. Every task individually spec+quality reviewed (5 fix rounds total across 1.1/1.3/2.4/3.9/final). Verification: prod build green ×3; 14/14 live Playwright chrome checks @390×844; SW offline E2E (real offline nav → branded page, /backend uncached); full vitest 1289 passed, 24 fails all pre-existing (triaged: 54 env-gated files + 5 stale tour mocks — zero wave-caused); collision fixes live-proven.

**Highest-value catches by the review loop:** (1) /offline was never in the SW precache (manifest freezes pre-prerender) — offline fallback was dead until fixed; (2) first-install surprise reload (clientsClaim + ungated controlling); (3) Supabase dashboard templates are a NO-OP — OTP codes now injected in the backend Resend hook (recovery + magic-link); (4) four bottom-bar collisions with the new nav on money pages; (5) tap-inside-tooltip self-close across 4 components.

**Remaining gates (user-visible):** run live `tests/e2e/signup-chain.spec.ts` against the worktree stack pre-merge (auth refactor guard); visual smoke of reset/magic-link emails post-deploy; real-device install checks (Android WebAPK, iPhone A2HS).

**Follow-up tickets:** /graphs breadcrumb+footer residual scroll + /reports/builder header overflow (pre-existing); SW snackbar dismiss + nav overlap; Skeleton.tsx split; middleware.ts over-limit; GraphsPageV2 internal spinners; dead wave animation; orphaned confidence-\* e2e testids; useDismissableOpen extraction; Playwright in CI; StickyScoreBar forced-mount test; confirm landing-v2 intentionally omits sticky bar; landing-experiment code cleanup once LANDING_EXPERIMENT=on bakes.

---

# GEO Top-5 Fixes — 2026-07-08 (from GEO-ANALYSIS.md)

Branch `develop` (commit locally; never push without ask).

## Plan

- [x] **G1** Claim contradictions FIXED: ValuePropsSection body → transparent 4-signal formula copy; /about ×5 ML-claim rewrites + "production data systems"; milestone "models trained"→"formula built"; JsonLd featureList → COVERAGE_COPY.sentence; layout.tsx root meta description → COVERAGE_COPY.sentence (was raw 935/3,137/29,417).
- [x] **G2** llms.txt: new `scripts/generate-llms-txt.ts` + `scripts/lib/llms-txt-template.ts` (fail-closed, COVERAGE_COPY-sourced, live pricing); `seo:generate-llms` npm script chained into `seo:rebuild-slugs`; post-import-refresh.yml commits the files; both files regenerated ($39 Pro / $149 Enterprise from live API — "Team $99" never existed in DB). BONUS stale-$29 fixes: PersonalizedPaywall CTA (price dropped), PlanComparisonCards (wired usePricingTiers), account-page e2e assertions. Homepage JsonLd offers now pricing-live via new `fetchPaidTierOffers` (ISR 1h, tag piq-pricing) — omits paid offers on fetch failure.
- [x] **G3** Market FAQ: `build-market-faqs.ts` (5 momentum-framed Q&As, 128-162 words, null-gated) + `MarketFaqSection.tsx` (FAQPage JSON-LD, ≥3 gate) on metro/county/zip pages; score labels extracted to `score-labels.ts` (re-exported from ScoreDisplay, 33/33 tests pass).
- [x] **G4** SSR narrative: backend `getCachedInsight` + `cachedOnly` param (never generates — cost guardrail verified by review); frontend `fetchCachedInsight` (ISR, null-safe) → metro page → `initialInsight` prop; client fetch disabled when server-provided. + DTO-audit fixes: geoLevel/type/archetype/blog-type allowlist validation on ALL insights endpoints (2 pre-existing CRITICALs closed).
- [x] **G5** Entity: sameAs → real LinkedIn (`/company/propertyiq-app/`) + YouTube + Facebook (user-provided); removed uncontrolled `@propertyiq` twitter creator handle; safeJsonLdString escape helper (JsonLd + OrganizationJsonLd). MANUAL follow-ups for user: Wikidata item, Reddit presence, Search Console reindex of stale snippets, claim FB vanity URL.
- [~] **G6** Verify: backend tsc ✓; frontend tsc ✓ (×2); frontend vitest score-labels ✓; production build: Turbopack (Next 16.1.6) fails locally resolving `@propertyiq/analyzer-core` (Windows/Turbopack quirk — Node resolves it fine, dist rebuilt, Railway Linux builds unaffected); webpack build running as cross-check; then no-JS HTML render check on :3100.

## Review

All 5 GEO issues implemented; ~14 code-review/security/DTO/data-layer validation passes across the surface, all findings fixed (dangling import, raw counts in root meta, ML phrasing, 2 pre-existing controller CRITICALs, JSON-LD `</script>` escape). Coupling note (user to confirm): `seo:generate-llms` appended to `seo:rebuild-slugs` chain means a pricing-API outage fail-closes the monthly slug rebuild step.

---

# Mobile + cross-platform tour/reports fixes — 2026-06-20

Root causes confirmed via parallel Explore agents + direct file reads. Six bugs.
Branch `develop` (commit locally; never push without ask). All UI follows M3 brand
(CLAUDE.md §8): semantic tokens only, no hardcoded hex; Roboto / Roboto Mono /
Source Serif 4. Verify each LIVE at mobile viewport 375×812 (no mocks).

## Bug inventory & root cause

1. **(mobile) Persona boxes too big, text unreadable, must scroll, stray "For you" badge**
   - `tour/components/PersonaCard.tsx`, `PersonaCards.tsx` — `p-5`, `text-xs` tag/bullets, low-contrast `text-on-surface-variant`; tall vertical cards w/ bullets+button → 3 don't fit one mobile screen. `priority` renders a tertiary "For you" badge on the agent card.
2. **(mobile, CRITICAL) Homebuyer shown agent "listing presentation / farming" finale**
   - `backend/.../listing-presentation-narrative.service.ts:20` SYSTEM_PROMPT hardcoded "for a real estate agent"; persona only in user prompt. Finale + sections identical for all personas. **DECISION (user): build 3 fully distinct finales.**
3. **(mobile) Typed text in inputs unreadable (should be black/on-surface)**
   - `tour/components/InlineSignupForm.tsx:101,111` + `MarketPickerStep.tsx:73` missing `text-on-surface`; MarketPicker also hardcodes `bg-white`. `onboarding/QuizStep.tsx:284` already correct (reference).
4. **(mobile) Finale "compare vs peers" shows 3 cards but no numbers**
   - `backend/markets/peers.service.ts` returns only `{name, score, householdCount}` — no price/growth/DOM/sold-above. `tour/.../listing-sections/adapt-sections.ts:116,193` passes raw through; `Peers.tsx:54-57` reads non-existent fields → blank.
5. **(mobile + web) Tour finale re-runs on browser Back**
   - `tour/components/Step4Aha.tsx:42-54` fires a React Query _mutation_ every mount when `isIdle && persona && market`; `mutation.data` never persisted → regenerates on back-nav.
6. **(mobile + web) /reports comparison: hard to read on mobile + collapses to first market**
   - `ReportViewer.tsx:239-244` routes non-v2 comparisons to `ComparisonHeroShowdown.tsx` which `.slice(0,2)`, hardcodes a 2-up `VS` grid, and reads DEAD legacy scores (`homeready_score`/`investoredge`) → comparison markets show "No Score". User: even 2 is unreadable on mobile. Needs live PropertyIQ score + N markets + mobile-first layout. (`comparison_v2`/`ComparisonHero.tsx` already handles 3+ — evaluate routing all comparisons there.)

## Finale specs (#2 — user chose "fully distinct")

- **AgentFinale** = current listing-presentation (verdict + 10 sections + branded/share CTA). Keep.
- **HomebuyerFinale** — "Should you buy in {market}?" Hero: buyer verdict + affordability headline (median price, est. monthly payment). Sections: Can you afford it · 12-mo forecast (your equity) · Rent vs buy break-even · Lifestyle/jobs/who's moving in · Similar markets · How competitive (DOM, % over ask). CTA: get pre-approved / target neighborhoods / save.
- **InvestorFinale** — "Is {market} a good investment?" Hero: demand signal + investor verdict + cash-flow/appreciation snapshot. Sections: Cash flow (yield) · Appreciation forecast · Rent trends · Comparable cashflow markets · Demand drivers (migration/employment) · Deal analyzer. CTA: analyze an address / top cashflow markets / save.
- Backend: per-persona narrative SYSTEM_PROMPT. Frontend: route `Step4Aha` → finale by `session.persona`.

## T6 redesign (user spec 2026-06-20, REVISED after live review)

FINAL requirements (user was clear after seeing v1 fall short):

1. Like-geo restriction — DONE + verified live (first pick locks metro/county/zip).
2. SUMMARY at top must SYNTHESIZE the comparison in PROSE (AI: "Denver leads on
   momentum, Austin is most affordable, Phoenix…") — NOT a wall of metric cards.
3. Each market's TAB = a FULL report, as deep as an individual single-market
   report. Requires BACKEND change: fetch full data set + generate an AI narrative
   for EVERY comparison market (today comp markets only get score+metrics+history
   → shallow). Reversal of the earlier "data-driven, no backend" choice; user
   accepts longer/costlier generation (N full reports + 1 synthesis per report).
4. TABS: frozen/sticky (don't scroll away so switching is easy); SHORT labels
   (lead city, e.g. "Austin-Round Rock-San Marcos, TX" → "Austin") — NO overflow.
5. Mobile AND web (v1 was shallow on both).

STATUS 2026-06-21: Per-market FULL reports WORK (user confirmed full reports for
both Chicago + Austin in the tabs; Market Pulse shows news from both). Frontend
(synthetic per-market report → single-market template) + backend fork (per-market
narrative + data + per-comparison news) = DONE, tsc clean, NOT committed.
REMAINING = the cross-market SYNTHESIS only (report.ai_narrative): it's fed the
PRIMARY's data for the comparison slot, so the AI says "only one market / metrics
repeat the primary" and can't actually compare; news/indicators primary-only;
verdict_and_actions empty. Diagnosing now (agent), then fix + regenerate.

SYNTHESIS-QUALITY fixes (user, after seeing the rendered synthesis): 6. Head-to-head + economic indicators in the synthesis use ONLY the primary geo's
news/indicators → must incorporate ALL markets' news + economic indicators
(backend now fetches per-comparison news, so feed all markets into the
comparison narrative template vars + prompt). 7. The comparison "Verdict & actions" section must NEVER render "insufficient
data" — always produce a real verdict + actions (robust generation + a
deterministic non-stub fallback).
(These live in the comparison narrative path — buildNarrativeTemplateVars + the
comparison prompt + V2 verdict/actions section. Handle in the backend pass AFTER
the fork lands; do not edit that code in parallel with the fork.)

v1 (shipped to working tree, NOT committed): ComparisonReportV3 + summary cards +
thin data-driven deep-dive + marketBundles defensive score accessor. The score
accessor + geo-restriction + routing/wiring are KEEPERS; the summary + deep-dive
get rebuilt for depth + synthesis. Backend (reports-orchestrator/narrative) must
generate per-comparison-market full data+narrative + a comparison-summary.
Investigations running: frontend section reuse + data gaps; backend gen flow.

## Tasks (sequence: quick wins → big builds)

- [x] **T1** #1 Persona cards — DONE + verified @375: "For you" badge removed; mobile-compact horizontal cards (3 fit one screen, no scroll); bold high-contrast titles + chevron affordance; richer desktop card preserved; fixed pre-existing "Continue as an" grammar bug.
- [x] **T3** #3 Inputs — DONE + verified @375 (typed "Austin, TX" renders dark): `text-on-surface` added to InlineSignupForm ×2 + MarketPickerStep; MarketPicker `bg-white`→`bg-surface`. Both onboarding inputs already correct.
- [x] **T5** #5 Finale persistence — DONE + verified. New `tour/lib/reportCache.ts` (sessionStorage, keyed persona+geoId); `Step4Aha` restores on mount + persists on success, gated so it never races/re-fires; cache cleared on `?resume=fresh`/reset. 22 tour tests pass incl. new persistence test. Live: seeded cache → finale renders from cache, ZERO network POST. NOTE: live full-generation blocked by anon 1/IP/24h 429; restore mechanism verified live, write-on-success unit-tested.
- [x] **T4** #4 Peer numbers — DONE + verified live. New `ListingPresentationPeersService.buildPeers` enriches peers via MetricResolutionService; `adaptPeers` formats them; peer cards show name + scoreLabel + median price + 12-mo growth + days-on-market + sale-to-list. ROOT CAUSE also found+fixed: orchestrator used unregistered IDs `dom_median`/`pct_sold_above_list`/`sale_to_list_ratio` (always null) → corrected to `days_on_market`/`sale_to_list` in both peers AND source market-now (+ adapter METRIC_FORMAT + Peers "Sale-to-list" relabel). Added ref-guard in Step4Aha so the generation fires once (dev StrictMode was double-firing → 429). Backend tsc clean; 86 frontend tests pass. Live (Phoenix): all 4 peer metrics + market-now DOM/sale-to-list render real numbers.
- [~] **T6** #6 Comparison — BUILT + typechecks + logic-tested; authed LIVE render pending. (1) Like-geo restriction live in `MarketSelector` (page.tsx): first market locks the level via `filterByGeoLevel` + dropdown filter + add guard. (2) New comparison view replaces the dead-legacy-score sections: `ComparisonReportV3` = `ComparisonSummaryV3` (all markets compared, live PropertyIQ score + metrics + winner, mobile-first cards) + per-market `PillTabs` -> `MarketDeepDivePanel` (score + 3 drivers + trajectory sparkline + metrics grid). `marketBundles.ts` defensively reads the live score from BOTH nestings (primary `scores.propertyiq` cleaned vs comparison `scores.scores.propertyiq` raw) so no market shows "No Score". Wired via templates/index.ts (`comparison` template = single ComparisonReportV3) + ReportViewer routes all comparisons there. Frontend tsc clean (only pre-existing .next-verify artifact error); 4 ComparisonReportV3 tests pass (both nestings resolve, winner, tabs, fallback). PENDING: authed live /reports render @375 with 2 & 3 markets — blocked by Playwright profile lock (headed mobile-preview window) + auth. Pre-existing file-size debt noted: page.tsx 1104 / ReportViewer 477 (both over 400; not split here).

  (original scope notes:) SCOPE CLARIFIED via investigation. The active `comparison` template uses `ComparisonHero` (already handles N markets) — `ComparisonHeroShowdown`'s `.slice(0,2)` is DEAD CODE (not in any template; red herring). REAL root cause: ALL comparison sections (ComparisonHero, HeadToHeadScoreStory, ComponentShowdown, MarketStrengths, ComparisonVerdict) read DEAD legacy scores `report.homeready_score`/`investoredge_score` + `comp.scores.homeready/investoredge` → every market shows "No Score" (looks like only-first-market). LIVE score = `report.propertyiq_score` + `comparisons[geoId].scores.propertyiq.score`. FIX = migrate those reads to PropertyIQ + mobile-readability pass on the comparison sections (tables/gauges). Then verify @375 with 2 & 3 markets.

- [x] **T2** #2 Three distinct persona finales — DONE + verified live (Phoenix, all 3 personas, single 201 each). Shared `finale/FinaleScaffold.tsx` (config-driven: section order + hero eyebrow/label + AI-strategy voice); `ListingPresentation` refactored to a thin Agent config (tests still pass); new `HomebuyerFinale` (affordability/forecast-forward, "For Homebuyers", "Your buying strategy") + `InvestorFinale` (cash-flow/appreciation-forward, "For Investors", "Your investment strategy"); `ReportHero`/`AiStrategy` got optional persona props; `Step4Aha` routes by `session.persona`. Backend persona narrative confirmed: buyer verdict is buyer-voiced, investor verdict investor-voiced, NO agent/farming framing. 53 finale tests pass. NOTE: InlineSignupForm CTA copy ("share with your client") is still agent-leaning — minor follow-up, separate from the finale.

## Verification

- Build clean with `NEXT_DIST_DIR=.next-verify` (never clobber dev `.next`).
- Live render @375×812 for every UI task; real data, no mocks. Mobile + desktop for #5/#6.

## Review

(filled as tasks complete)

---

# Trial Walkthrough — Feedback Fixes (2026-06-18)

Source: user's manual 14-day trial walk. Branch: `develop` (commit locally; never push without ask).
Standards: production-ready, no workarounds; verify LIVE in browser (no mocks).

## Decisions (locked)

- **D1 Score movers** → quick repoint now (emails → `/screener` current-score sort); full movers feature DEFERRED to a follow-up phase.
- **D2 Feature guidance** → lightweight checklist nudges (reuse `updateChecklistTask` / onboarding checklist); keep anti-haunting fix intact.
- **D3 Day-7 reframe** → trial-aware framing (what your Pro trial unlocks + what reverts to free).
- **Unsubscribe** → build FULL compliant flow now (public one-click + List-Unsubscribe headers + physical address).
- **T1 dev email escape** → skip.
- **Physical address (from ToS):** `Republic Registered Agent LLC, 20 S Charles St, Ste 403, Baltimore, MD 21201`.

## DONE (verified compile; ready to commit)

- [x] **B2a** day-3 copy: "filter on the map" → Screener (`scoreMin=70`); template CTA + fallback → `screenerUrl`.
- [x] **B2b** day-5 movers links → `/screener?sortBy=score&sortOrder=desc`; copy reworded to "Open the Screener / current rankings".
- [x] **B2c** day-7 reframed trial-aware: new heading/intro, `trialNote`, CTA "Keep Pro Access", benefit emoji 🔒→✓.
- [x] **B1 (part b)** standalone signup redirect → `/tour?resume=fresh` (wipes stale `piq_tour`; callback `?phase=celebrate` left untouched). Emails package `tsc --noEmit` = clean.

## IN PROGRESS (parallel implementation)

- [ ] **Unsubscribe vertical (full compliant)** — backend token util + public GET/POST controller; `email.service` `headers` support + `List-Unsubscribe`/`List-Unsubscribe-Post`; wire lifecycle/marketing senders; register controller; frontend public `/unsubscribed` confirmation page; `layout.tsx` footer = unsubscribe link (tokenized) + physical address.
- [ ] **B3 entitlement cold-load retry** — `api.ts` + `EntitlementsContext.tsx`: bounded backoff retry on transient fetch failure so an authed user is never stranded on `free`. (Backend proven correct: returns `pro` for active trial, cache-bypassed.)
- [ ] **B1 (part a)** tour user-scoping — `useTourSession.ts`: tag stored session with userId; clear/reset when authed user differs (robust beyond the signup-redirect fix).

## TODO (next phase)

- [ ] **D2 feature-discovery nudges** — frontend-design skill; dismissible nudges for un-tried Pro features via existing onboarding checklist.
- [ ] **Movers feature (deferred)** — Screener score-delta over 1mo/90d/120d/180d/1yr/3yr (up & down). Separate phase.

## Verification gate (per task, before commit)

Build (affected packages) + live browser check against running stack (no mocks): tour fresh signup → persona picker; entitlements show Pro for active trial; unsubscribe one-click sets `email_preferences.marketing=false` without login; emails render correct links.

## Review — SHIPPED on develop (all verified; not pushed)

- `c78319eb` **B2** email day-3/5 → `/screener`; day-7 trial-aware.
- `8540a515` **B1b** standalone signup → `/tour?resume=fresh`.
- `9598848a` **B1a** tour state user-scoped. Live: `/tour?resume=fresh` renders the persona picker (not a stale finale).
- `ac64633c` **B3** entitlements cold-load retry (4 attempts, fail-closed, aborts not retried). 63 frontend tests pass; backend returns Pro for active trial.
- `bf8b2bed` **Unsubscribe (full compliant)** — HMAC token + public one-click controller + `List-Unsubscribe`/`-Post` headers on all lifecycle/marketing senders + CAN-SPAM footer address. Stream-aware. Live: POST upserts `email_preferences.weekly_digest=false` with NO login; GET renders branded page. `/backend` proxy GET+POST + public reachability confirmed.

Verification: backend+frontend `tsc` clean; 11 backend + 63 frontend tests pass; unsubscribe + tour verified live. §1.6 reviews clean; two findings folded in (token-length cap, stream-aware opt-out). Non-blocking: `engagement-trigger.ts` 301 lines (1 over).

## Remaining

- [x] **D2 feature-discovery nudge** — `6dbd12f1` (NOT pushed). Dismissible M3 sidebar card surfacing un-tried Pro features for trial/pro users, computed from existing `usage_stats`+`onboarding_checklist`, dismissal persisted via `dismissed_beacons`. tsc clean; 6 unit tests pass; live-confirmed inputs (test5 active-trial → "Generate report" + "Screen markets"). Discovery: the beacon coachmark system is dormant (no `data-beacon` anchors exist anywhere).
- [ ] **Movers feature (deferred)** — design spec committed by user (`f0305b40`).
- [ ] Push — D2 (`6dbd12f1`) is committed but unpushed; prior batch already pushed.
- [ ] Release `develop`→`main` per CLAUDE.md §2.6 — user's call.
