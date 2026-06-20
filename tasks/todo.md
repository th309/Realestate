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

## Tasks (sequence: quick wins → big builds)

- [x] **T1** #1 Persona cards — DONE + verified @375: "For you" badge removed; mobile-compact horizontal cards (3 fit one screen, no scroll); bold high-contrast titles + chevron affordance; richer desktop card preserved; fixed pre-existing "Continue as an" grammar bug.
- [x] **T3** #3 Inputs — DONE + verified @375 (typed "Austin, TX" renders dark): `text-on-surface` added to InlineSignupForm ×2 + MarketPickerStep; MarketPicker `bg-white`→`bg-surface`. Both onboarding inputs already correct.
- [x] **T5** #5 Finale persistence — DONE + verified. New `tour/lib/reportCache.ts` (sessionStorage, keyed persona+geoId); `Step4Aha` restores on mount + persists on success, gated so it never races/re-fires; cache cleared on `?resume=fresh`/reset. 22 tour tests pass incl. new persistence test. Live: seeded cache → finale renders from cache, ZERO network POST. NOTE: live full-generation blocked by anon 1/IP/24h 429; restore mechanism verified live, write-on-success unit-tested.
- [x] **T4** #4 Peer numbers — DONE + verified live. New `ListingPresentationPeersService.buildPeers` enriches peers via MetricResolutionService; `adaptPeers` formats them; peer cards show name + scoreLabel + median price + 12-mo growth + days-on-market + sale-to-list. ROOT CAUSE also found+fixed: orchestrator used unregistered IDs `dom_median`/`pct_sold_above_list`/`sale_to_list_ratio` (always null) → corrected to `days_on_market`/`sale_to_list` in both peers AND source market-now (+ adapter METRIC_FORMAT + Peers "Sale-to-list" relabel). Added ref-guard in Step4Aha so the generation fires once (dev StrictMode was double-firing → 429). Backend tsc clean; 86 frontend tests pass. Live (Phoenix): all 4 peer metrics + market-now DOM/sale-to-list render real numbers.
- [ ] **T6** #6 Comparison — SCOPE CLARIFIED via investigation. The active `comparison` template uses `ComparisonHero` (already handles N markets) — `ComparisonHeroShowdown`'s `.slice(0,2)` is DEAD CODE (not in any template; red herring). REAL root cause: ALL comparison sections (ComparisonHero, HeadToHeadScoreStory, ComponentShowdown, MarketStrengths, ComparisonVerdict) read DEAD legacy scores `report.homeready_score`/`investoredge_score` + `comp.scores.homeready/investoredge` → every market shows "No Score" (looks like only-first-market). LIVE score = `report.propertyiq_score` + `comparisons[geoId].scores.propertyiq.score`. FIX = migrate those reads to PropertyIQ + mobile-readability pass on the comparison sections (tables/gauges). Then verify @375 with 2 & 3 markets.
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
