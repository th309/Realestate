# PropertyIQ Product Audit — June 2026

**Date:** 2026-06-10
**Scope:** Full product audit of PropertyIQ (propertyiq.up.railway.app) — code audit across 15 surface areas, live production walkthroughs (desktop + mobile), 10 competitor profiles, an investor-competitor deep dive with live browser teardowns of Reventure and BiggerPockets, and adversarial verification of every recommendation against the codebase.
**Audiences judged:** Realtors (MCP/AI tools), investors (analyzer + reports), homebuyers (map + SEO pages).

---

## 1. Executive Summary

### Where PIQ stands

PropertyIQ holds the rarest squares on the competitive board and fails the most basic ones. No competitor in the investor set — BiggerPockets, Reventure, Mashvisor, PropStream, DealCheck — has all of what PIQ already ships: a proprietary 1-99 market score across 23,600 geographies (746 metros / 2,983 counties / 19,880 ZIPs), A/B/C/F data-confidence grades, a deal analyzer with AI insights, AI-generated market reports, an MCP server with 47 tools, and multi-source provenance through MetricResolutionService. Most competitors have _none_ of these.

And yet the conversion machinery is broken end to end. Funnel data shows **11 signup starts and 0 completions in 30 days**. 94% of traffic lands on programmatic SEO pages that display a single unexplained score ("25 F POOR") and then trap visitors behind an undismissable signup wall feeding that broken signup flow. Mobile users physically cannot tap the Log in / Get Started buttons (a score ticker covers them). The pricing page actively markets three scores that were retired (HomeReady, InvestorEdge, Market Health). The trust pages — /scores/accuracy — 401 for every anonymous visitor and contradict themselves on the flagship IC statistic (0.23 vs 0.37). The two flagship tools (market intelligence and deal analyzer) never reference each other.

**The gap between PIQ's assets and PIQ's conversion machinery is the whole story.** The competitive analysis confirms the strategy is right — Reventure proved the exact model (map + paywalled score) at $39/mo with 200K users — and the execution gap is almost entirely plumbing, wiring, and copy, not new product development.

### The 3 moves that matter most

1. **Fix the funnel (Recs #1, #2, #8, #12).** Nothing compounds while signup completes at zero. Repair the signup chain with a real-flow E2E test, replace the undismissable 5-page wall with Reventure-style two-step capture (email first, payment later), turn the anonymous report dead-end into a blurred-preview signup gate, and unbury the mobile auth buttons. Every other investment multiplies through this.

2. **Wire the market-to-deal bridge (Recs #3, #5, #6).** PIQ is the only player owning both "WHERE should I invest" (map + score) and "WHAT should I buy" (analyzer) — investors today pay for 3-4 overlapping subscriptions because nobody connects them. Finish the `piq_market` parameter consumption, prefill the analyzer from PIQ's own metric layer with source + confidence stamps, and ship the cross-region market screener. This is the structural moat; it is mostly a wiring job.

3. **Weaponize trust (Recs #9, #10, #11, #18).** Every incumbent is a black box with hostile billing (BP BBB 2.4/5, Reventure no-refunds, Mashvisor "scam" reviews, PropStream post-cancel charges). PIQ has methodology docs, confidence grades, and monthly validation backtests — currently self-sabotaged by a 401ing accuracy page, three contradictory IC figures, retired-score marketing, and a score that's never explained at first exposure. Fix the receipts, then market "the only housing score that shows its receipts."

**Sequencing:** funnel first, bridge second, trust third, then ride the AI-distribution window (MCP trial path, discoverability, instrumentation) before incumbents notice it matters — 67% of buyers now start research in AI tools and zero of the five investor competitors has any AI-assistant surface.

---

## 2. Prioritized Recommendations (Full Table)

All 30 verified recommendations, in priority order. Feasibility is the adversarial verifier's verdict after checking each claim against the codebase.

| #   | Recommendation                                                                                           | Audience   | Impact         | Effort | Feasibility |
| --- | -------------------------------------------------------------------------------------------------------- | ---------- | -------------- | ------ | ----------- |
| 1   | Repair the signup chain end-to-end so every CTA reaches a working account creation                       | All        | Transformative | Medium | Moderate    |
| 2   | Replace the undismissable 5-page wall with Reventure-style two-step capture                              | All        | Transformative | Small  | Hard        |
| 3   | Wire the market-to-deal bridge: every market view ends in "Analyze a property here"                      | Investors  | Transformative | Small  | Easy        |
| 4   | Put real, citable market data on the 94%-traffic SEO pages (GEO play)                                    | All        | Transformative | Medium | Moderate    |
| 5   | Market-prefilled deal analyzer with source, as-of date, and confidence on every field                    | Investors  | Transformative | Medium | Moderate    |
| 6   | Ship the market screener: preset chips, sliders, and a ranked table over all geos                        | Investors  | Transformative | Medium | Moderate    |
| 7   | Open an MCP trial path: free sandbox API keys with a metered call quota                                  | Realtors   | Transformative | Medium | Moderate    |
| 8   | Turn the anonymous report dead-end into the top of the funnel                                            | Investors  | High           | Small  | Easy        |
| 9   | Never show the score naked: scale explainer, confidence legend, default-journey presence                 | All        | High           | Small  | Easy        |
| 10  | Fix /scores/accuracy via one shared validation-constants module, then publish the Score Report Card      | Investors  | High           | Small  | Moderate    |
| 11  | Purge retired HomeReady/InvestorEdge/Market Health from every live surface, with a CI guard              | All        | High           | Small  | Easy        |
| 12  | Mobile conversion repair sprint: uncover the buttons, hit the tap targets                                | Homebuyers | High           | Small  | Easy        |
| 13  | Add a one-click demo deal and unlock free-tier sensitivity analysis                                      | Investors  | High           | Small  | Moderate    |
| 14  | Kill the 3-minute /tour; land new users in the product with value in 30 seconds                          | All        | High           | Small  | Moderate    |
| 15  | Make the sample report a flawless listing-presentation demo and market Agent Prep                        | Realtors   | High           | Small  | Moderate    |
| 16  | Fix the MCP setup-guide auth bug and deep-link key generation                                            | Realtors   | High           | Small  | Easy        |
| 17  | Build the Reventure-grade region detail panel as the map's conversion engine                             | All        | High           | Medium | Moderate    |
| 18  | Rebuild the pricing page: working CTAs, real prices everywhere, annual-first tier, fair-billing promise  | All        | High           | Medium | Moderate    |
| 19  | Make gating coherent: one dismissible paywall pattern, honest labels, no bypasses, server-side redaction | All        | High           | Medium | Moderate    |
| 20  | No-login branded share links for reports and analyses, plus real PDF/CSV export                          | Realtors   | High           | Medium | Moderate    |
| 21  | Watchlist score-threshold alerts plus a monthly "Market Pulse" data-drop event                           | All        | High           | Medium | Easy        |
| 22  | Launch a free open-data hub: monthly score CSVs, methodology, and syndication                            | All        | High           | Medium | Moderate    |
| 23  | Make MCP discoverable: persona recipes, "Use PIQ in Claude" content, Add-to-Claude CTAs                  | Realtors   | High           | Medium | Moderate    |
| 24  | Ship seasonality (Best Month to Buy/Sell) free and Overvaluation % as the viral-metric wedge             | All        | Medium         | Small  | Moderate    |
| 25  | Launch "X alternative" pages and the "score, not the story" position for doom-fatigued churners          | Investors  | Medium         | Small  | Moderate    |
| 26  | Trust-polish sweep: custom domain, footer, debug strings, dev routes                                     | All        | Medium         | Small  | Easy        |
| 27  | Instrument MCP per-tool usage so the realtor channel can be managed                                      | Realtors   | Medium         | Small  | Moderate    |
| 28  | Add an STR-vs-LTR lane to the analyzer to capture Mashvisor refugees                                     | Investors  | Medium         | Medium | Moderate    |
| 29  | Turn embeds into a distribution loop: agent-site score widgets and watermarked map shares                | Realtors   | Medium         | Medium | Moderate    |
| 30  | Portfolio dashboard: saved deals as a ranked, comparable, exportable table                               | Investors  | Medium         | Large  | Easy        |

---

## 3. Recommendation Detail

### 1. Repair the signup chain end-to-end so every CTA reaches a working account creation

**What/why.** Nothing else compounds while signup completes at zero. In one sprint with a real-flow E2E test: enable Create Account/Google buttons by default (inline ToS error instead of silent disable), route pricing "Get Pro Access" to sign-UP not sign-in, add a signup link to the anonymous report-builder dead-end, replace the anonymous "Current Plan" badge with a Free-plan signup CTA, and communicate OAuth email confirmation clearly.

**Evidence.** Funnel data: 11 signup starts / 0 completes in 30 days. Live first-visit audit: Create Account AND Google buttons render disabled with no explanation until the ToS checkbox is ticked. Live signup-pricing audit: "Get Pro Access" lands anonymous buyers on /auth/sign-in; Free card shows a disabled "Current Plan" button to visitors who have no plan. Live analyzer-reports audit: anonymous report builder dead-ends with no signup link. Growth audit: OAuth email-confirmation requirement is never communicated, leading to broken sessions.

**Competitor reference.** All five investor competitors have working signup-to-activation funnels (feature-gap matrix row: PIQ is the only "no — BROKEN").

**Verification notes.** Confirmed in code: sign-up buttons disabled until ToS accepted (sign-up/page.tsx lines 382/404); pricing routes to sign-IN (pricing/page.tsx line 138); signup redirects to /tour, not /map. Partially complete remediation in progress: flush() call exists (line 136), OAuth tracking exists (callback/page.tsx lines 187-189). Still missing: inline ToS error handling, pricing sign-up routing, inline signup CTA on reports/analyzer. The 46-task activation-funnel-remediation plan (2026-04-14) covers much of this.

**First step.** Write the Playwright E2E test for the full anonymous→signed-up→/map flow against production config, then fix failures in order: ToS inline error, pricing CTA routing, report-builder signup link.

### 2. Replace the undismissable 5-page wall with Reventure-style two-step capture

**What/why.** Kill the no-X, Escape-ignoring wall trapping 94% of traffic on /map and market pages — it also poisons crawlability and AI/GEO citability (Google's intrusive-interstitial penalty applies to indexed pages). Free map stays open; clicking a locked premium item fires a dismissible one-field Google/email modal; the payment pitch comes only after login. Add inline "Get monthly score updates for {metro}" capture blocks on SEO pages. Render gated values server-side redacted with blurred preview. Lock the premium layer, never the front door.

**Evidence.** The undismissable wall was independently flagged CRITICAL by three live audits (markets-seo, map, mobile) — verified via Playwright: no close button, Escape no-op, scrim-click no-op. 94% of traffic lands on SEO pages with zero capture mechanics. Deep-dive P1 calls this the multiplier on everything else.

**Competitor reference.** Reventure (email-first two-step modal, 200K users — verified live); BiggerPockets (inline SEO-page signup forms inside forum threads). Counter-example: Reventure's own map is now fully hard-walled for anonymous users — the deep-dive explicitly lists that as a do-NOT-copy.

**Verification notes.** AnonPaywallOverlay (non-dismissible, no Escape) confirmed firing after 5 pages on /map. SEO /markets pages render public content with an email signup that the wall then covers. FreeUserUpgradeModal is dismissible (the right pattern exists). No server-side redaction implemented. Rated _hard_ because the real work is refactoring gating from page-container level to feature level, plus Escape/X/backdrop handling.

**First step.** Add X + Escape + backdrop-dismiss to AnonPaywallOverlay and suppress it entirely on SEO market pages (ship in a day); then schedule the feature-level gating refactor.

### 3. Wire the market-to-deal bridge: every market view ends in "Analyze a property here"

**What/why.** PIQ is the only player owning both market intelligence (WHERE) and deal analysis (WHAT), yet the flagship tools never reference each other. Add "Analyze a property in {market}" CTAs to map detail panels, SEO market/state/blog/compare pages, and reports — opening the analyzer with that geo's Market Context pre-loaded — plus "Get the full AI report" inside the analyzer. Preselect the originating market in every report, signup, and dashboard CTA. A wiring job, not a build job.

**Evidence.** Deep-dive Truth 1: investors pay for 3-4 overlapping WHERE/WHAT subscriptions (PropStream $99 + DealCheck $20 + Rentometer + Reventure $39). seo-pages audit: four findings on missing analyzer CTAs (state pages, blog pages, compare pages, metrics pages). Live analyzer-reports and live map audits: the two flagship tools are siloed. Live markets-seo: report CTA drops the market context the user came from.

**Competitor reference.** None — white space; no competitor owns both ends. Pattern reference: PropStream/Redfin "every view ends in an action."

**Verification notes.** The bridge is structurally ~80% built: AnalyzeCTA component exists and is deployed on metro/county/ZIP pages with correct `?piq_market=level:id` hrefs — **but the piq_market parameter is accepted and never consumed in AnalyzerClient**, so the feature does not function end-to-end. Map detail panels have no Analyze button; state and blog pages lack AnalyzeCTA.

**First step.** Implement piq_market consumption in AnalyzerClient (load that geo's Market Context on mount) — this single fix activates every CTA already shipped.

### 4. Put real, citable market data on the 94%-traffic SEO pages (GEO play)

**What/why.** Server-render a compact stats block on every metro/county/ZIP page: median price, DOM, months of supply, rent, YoY deltas, 12-month sparkline, ranked top-10 tables on state pages, and "Data through {month} · Source: Redfin/Zillow" freshness labels — all from data already in the DB. Structured, attributed numbers are what AI Overviews and Perplexity cite. Add role-segmented inline capture, relevance-based related markets, and fix the 404ing AI-insights endpoint and the "Bastrop County, TX, TX" template bug.

**Evidence.** Live markets-seo audit: pages titled "2026 Analysis" contain one naked score plus boilerplate while price/DOM/supply exist in the DB; AI insights endpoint 404s on metro pages; related links are alphabetical noise (Austin's "More Markets in TX" = Abilene, Alice, Amarillo). Live mobile audit: a 2,329px-total market page with no home value, rent, or trend. Deep-dive Truth 3: the SEO funnel is leaking 100% of its conversion potential.

**Competitor reference.** Redfin (data-rich market pages with YoY-delta stat cards and top-10 tables); Reventure (region panel proves one view can read as a mini report); NeighborhoodScout (free SEO pages with state/national comparison bars funneling into paid reports).

**Verification notes.** Market data tables (Zillow, Realtor, Census) confirmed in DB with median price/DOM/supply/rent metrics. Frontend SEO pages currently display only score + boilerplate. Insights endpoint can 404 when generation fails. Architecture supports the feature via the existing data layer.

**First step.** Server-render a 4-6 metric stat block (via queryLatestPerRegion) on the metro template, with source + as-of labels; roll to county/ZIP after.

### 5. Market-prefilled deal analyzer with source, as-of date, and confidence on every field

**What/why.** Prefill rent, taxes, vacancy, appreciation, and insurance from PIQ's own metric layer by ZIP/address, stamping each field with source + as-of date + A/B/C/F grade, and flag overrides that diverge sharply from market data. Attacks BiggerPockets' 30-minute blank form and DealCheck's untrusted stale defaults simultaneously. Marketing line: "2-minute analysis, zero spreadsheet."

**Evidence.** Feature-gap matrix: address auto-prefill is "no" for PIQ, "yes" for DealCheck/Mashvisor/PropStream. BP's #1 user complaint is manual entry; DealCheck's #1 is untrusted estimates (deep-dive P3). Live analyzer-reports: analyzer opens to a wall of zeroed panels with a Pro-only RentCast CTA as the primary instruction.

**Competitor reference.** DealCheck (address-to-underwrite-in-a-minute is its signature feature; its weakness — stale untrusted estimates — is exactly what confidence stamps fix).

**Verification notes.** Metric layer & MetricResolutionService exist with 60+ metrics; the market-context API already returns home_value, rent_index, etc. with source metadata. But the analyzer opens with null fields, market data is fetched and NOT used for prefill, RentCast tax history is returned and ignored by the frontend, and no per-field confidence grades exist. ~70% plumbing already done, 30% UX remaining.

**First step.** Wire the already-fetched market-context response into default values for rent/tax/insurance/vacancy with a per-field "Source: {x} · as of {date}" stamp and an "edited" indicator on override.

### 6. Ship the market screener: preset chips, sliders, and a ranked table over all geos

**What/why.** PIQ has the map but no cross-region ranked view — and market-selection overwhelm is the #1 unmet investor job. Build a sortable table over PropertyIQ Score + metrics across 23,600 geos with preset chips: "Hottest Markets," "Undervalued + High Score," and the rate-aware "Cash-flows at today's rates" screener nobody in the category ships. Free-visible like Reventure's; gate CSV export and ZIP depth by tier; expose presets as MCP tools and linkable SEO landing pages.

**Evidence.** Gap matrix: screener "yes" for Reventure (chips + 9 sliders + ranked table over 917 metros, verified live) and Mashvisor ($75/mo Market Finder), "no" for PIQ. Deep-dive P4 and unmet need #4 (the rate-aware shortlist is unshipped by anyone). PIQ's geo coverage exceeds Reventure's.

**Competitor reference.** Reventure (free-visible screener as upsell surface); Mashvisor (charges $75/mo for the equivalent); BiggerPockets (Market Finder gated behind Pro on two-year-old MSA data).

**Verification notes.** Backend queryLatestPerRegion and rankings API fully exist; 23,613 geos verified; MCP ranking tools live; pagination-ready. No frontend screener UI exists publicly (RankedList component is report-internal only). CSV export and tier gating need implementation.

**First step.** Ship /screener as a thin frontend over the existing rankings API: one ranked table, three preset chips, score + 4 metric columns, metro level only; iterate from there.

### 7. Open an MCP trial path: free sandbox API keys with a metered call quota

**What/why.** Free/trial users cannot generate MCP API keys at all, so the realtor AI channel has zero top-of-funnel despite 47 built tools and no competitor having any AI-assistant surface. Let any verified account generate a key scoped to ~50 tool calls/month (or a 24-hour guest key limited to demo markets), upsell to Pro on quota exhaustion, and track trial-cohort usage. Converts the server from shelfware into an adoption flywheel during the open AI-distribution window.

**Evidence.** MCP audit CRITICAL: "Free tier users cannot generate API keys... Zero trial path = zero adoption signal." Deep-dive Truth 3: 67% of buyers start research in AI tools; MCP row is "yes" for PIQ, "no" for all five competitors.

**Competitor reference.** None — white space. (Mashvisor's May 2026 ChatGPT-app launch shows the PR value; Realtor.com and Zillow ship ChatGPT apps in the consumer segment.)

**Verification notes.** Premise correct: MCP gated at entitlements level via feature:mcp_access, Pro+ only. Architecture supports 47 tools, OAuth flow, tier-based entitlements, and a trial system — but MCP is not trial-scoped and **no quota/metering enforcement exists** (only access control). Work = extend trial system + add usage tracking (pairs with Rec #27).

**First step.** Add feature:mcp_access to the trial tier's entitlements with a per-key monthly call counter checked in the MCP auth layer; return a friendly quota-exhausted message with an upgrade link.

### 8. Turn the anonymous report dead-end into the top of the funnel

**What/why.** Anonymous users complete the entire report-builder flow, then hit "You must be signed in" with no signup link — the purest sunk-cost moment on the site, currently wasted. Generate a real preview instead: first section visible, rest blurred, inline one-field signup to unlock. Apply the same gate to the analyzer AI verdict. BiggerPockets' calculator-wall physics, but gated at FREE signup instead of $390/yr — also a marketing wedge against them.

**Evidence.** Live analyzer-reports CRITICAL: anonymous report generation dead-ends with no recovery path; Ask AI is silently non-functional anonymously. The audit names this "the single highest-leverage conversion fix given near-zero signup completion." Deep-dive 2.1: BP's walled-output engine and its BBB 2.4/5 resentment.

**Competitor reference.** BiggerPockets (free-input, walled-output sunk-cost capture — copy the physics, soften the wall).

**Verification notes.** Confirmed: reports dead-end at line 599 of page.tsx with no recovery path. The analyzer ALREADY implements the target pattern — FreePreviewMiddleware grants 3 free analyses via signed HTTP-only cookie, 402 on quota exceeded. EntitlementGate, PaywallCard, and InlineSignupForm (used in tour) all exist to compose the blurred-preview gate.

**First step.** Replace the flat error with: generate the report server-side, render section 1 + blurred remainder, mount InlineSignupForm inline with "Unlock your full {market} report."

### 9. Never show the score naked: scale explainer, confidence legend, and default-journey presence

**What/why.** The flagship score never appears in the default map journey (state-level home value is the default; scores are metro/county/ZIP), and SEO pages show "25 F POOR" with zero explanation. Make the score the default map metric or a prominent toggle, and attach a first-exposure explainer everywhere it renders: "1-99, relative to state average; 50 = average," an A/B/C/F confidence-grade legend (currently explained nowhere site-wide), and a methodology link from every ScoreWidget. Kill the impossible "Score 100" row.

**Evidence.** Live map audit: score absent from the default journey — sidebar reads "Select a region to see scores" even after selecting a state. Live markets-seo: naked "25 F POOR" on the 94%-traffic pages reads as broken. Scores audit: no methodology links from widgets, A/B/C/F never explained, decile tables show a "Score 100" row on a 1-99 scale, and the homepage says "0–100."

**Competitor reference.** Reventure (the Forecast Score is THE hero number; its gauge + glossary is why reviewers trust it). PIQ is the only player with a confidence grade and hides it.

**Verification notes.** Score explainer exists on /scores FAQ but NOT on ScoreWidget. Confidence legend exists in code but hidden by default (showConfidence not set on market pages). Map defaults to home_value. Score-100 language contradicts the 1-99 max. No methodology links from widgets. All easy composition fixes.

**First step.** Add a one-line explainer + "How scores work →" link to ScoreWidget's default render and set showConfidence={true} on market-page call sites.

### 10. Fix /scores/accuracy via one shared validation-constants module, then publish the Score Report Card

**What/why.** The trust pages currently destroy trust: the "interactive backtest" 401s for every anonymous user (it calls admin-only endpoints) directly under copy mocking competitors' static PNGs; IC is stated as both 0.23 and 0.37; the accuracy page describes the retired SHAP/XGBoost model while methodology describes v4.0; dollar claims disagree 2x. Create one constants module (IC, hit rates, coverage, dollar impact, backtest years) consumed by /scores, /methodology, /accuracy, homepage, and pricing; make the backtest public/cached; then publish a per-geo-level report card. Position: "the only housing score that shows its receipts."

**Evidence.** Live scores-trust CRITICAL: 5x 401s from /api/admin/scores/validation/\* for anonymous users; IC 0.23 vs 0.37 on the same page; "100% hit rate" mislabeled; $13,320/yr vs $18,100/3yr dollar claims; metro counts 746 vs 924 within one page. Live first-visit: "23,600 vs 400+" in one viewport, three score-scale versions. Three audits independently proposed the shared constants module.

**Competitor reference.** HouseCanary (published MdAPE accuracy IS its brand); Reventure (its self-graded "#1 forecast" post is its strongest conversion asset — and it's marking its own homework; PIQ can do it honestly).

**Verification notes.** All contradictions confirmed in code: accuracy metadata claims 0.37 while validation-claims.ts has ic3Y: 0.23/ic1Y: 0.24; validation-credibility.ts adds 0.30 vs 0.37; ScoreCredibilityBadge.tsx says 924 metros vs validation-report.md's 746; $18,100 vs scoreExtreme3YGap 24,384. Methodology IS v4.0 (the accuracy page is the stale one). Backtest endpoints are AdminGuard-protected. validation-claims.ts exists as a candidate single source but is NOT consumed by /methodology or /accuracy.

**First step.** Make every scores page import from validation-claims.ts and delete all hardcoded stats; add public cached read-only validation endpoints (or pre-rendered JSON) for the backtest widgets.

### 11. Purge retired HomeReady/InvestorEdge/Market Health from every live surface, with a CI guard

**What/why.** Remove the three retired scores from the pricing page's "See what Pro unlocks" tiles (active bait-and-switch on a paid surface), the metro SEO template's "three scores" prose rendered on ~935 pages carrying 94% of traffic, and the sample report's "HomeReady Market Intelligence Brief" header. Add a CI grep blocking the retired names in frontend templates so they never return. A template sweep, not a redesign.

**Evidence.** Live signup-pricing CRITICAL: pricing markets three retired scores with sample tiles ("HomeReady 62 B-"). Live markets-seo CRITICAL: metro template prose ("The three scores — HomeReady for buyers, InvestorEdge for investors, and Market Health...") on the 94%-traffic pages. Live analyzer-reports: sample report Ask AI header still says HomeReady.

**Competitor reference.** None — internal hygiene.

**Verification notes.** Premise confirmed: 35+ instances across FeatureShowcaseInsights.tsx (lines 249-262 literally display the retired scores), 4 instances in generate-seo-content.ts, static-sample-report.ts line 37. No existing CI guard. Cleanup is trivial per search scope.

**First step.** Grep-and-rewrite the three files above to single-score language, then add a CI step failing on `HomeReady|InvestorEdge|Market Health` in frontend templates.

### 12. Mobile conversion repair sprint: uncover the buttons, hit the tap targets

**What/why.** Fix the score ticker covering the drawer's Log in/Get Started buttons (taps never register — mobile signup is physically impossible), make the homepage map widget's Zip/County geo tabs reachable, raise 28px controls to the 44px minimum, fix the 11px horizontal wiggle and the sticky bar truncating to "See …". Mobile-heavy homebuyer traffic currently cannot convert at all; this is days of CSS work, not a redesign.

**Evidence.** Live mobile CRITICAL: ticker occupies y=776-844 over auth buttons at y=778-888; elementFromPoint returns ticker elements, not buttons. Plus: geo tab row 423px wide in a 375px viewport with no scroll; 28px metric rows with 14px info icons; documentElement.scrollWidth 386 vs 375; sticky bar value prop measured at 39px wide rendering "See …".

**Competitor reference.** Reventure 4.8-star and DealCheck 4.7-star mobile apps set audience expectations; PIQ has no app, so mobile web must work.

**Verification notes.** All claims validated in code: hamburger 40px (<44 min), GeoLevelPills 24px, sticky bar z-50 with no z-index on MobileMenu (layering bug), whitespace-nowrap truncation, no scrollbar-gutter CSS. Fixes are z-index, padding, and overflow handling.

**First step.** Fix the drawer/ticker z-order (hide ticker while drawer is open) — the single change that makes mobile signup physically possible — then sweep tap targets.

### 13. Add a one-click demo deal and unlock free-tier sensitivity analysis

**What/why.** The analyzer opens on a wall of zeroed panels with a Pro-only RentCast CTA — the aha-moment is hidden behind data entry. Add "Load demo deal" (realistic price/rent/tax for a known metro, Market Context wired so the score appears), keep rent/price sensitivity free, and gate only AI narratives. Free users currently see a grade letter with no guidance, which kills the daily-open habit before it forms.

**Evidence.** Live analyzer-reports opportunity: demo-deal button; analyzer audit: AI narratives Pro-gated but essential for free-tier understanding; the onboarding instruction points at a Pro-only feature ("Enter a property address") and never dismisses.

**Competitor reference.** DealCheck (a genuinely usable free tier earns 4.7-star goodwill; full engine free + usage caps builds habit before the paywall).

**Verification notes.** Good news: sensitivity analysis is already fully free (no gating), and Market Context renders for all tiers — only AI annotation is Pro-locked. No demo-deal button exists. Implementation = demo address prefilling, query-param handling, and exempting the demo from the anonymous 3-analysis quota.

**First step.** Add a "Try a demo deal" button to the empty state that loads a hardcoded realistic Austin (or similar) deal with Market Context wired; change the free empty-state copy to "Enter price and rent to see your numbers."

### 14. Kill the 3-minute /tour; land new users in the product with value in 30 seconds

**What/why.** Redirect post-signup to the market or map the user came from (preserve URL state) with the score panel open — not a 4-step tour firing side-effects before any payoff. Ask persona inline with one chip row and fix the broken "Continue as an →" labels. Activation means seeing your market's score, not completing a tour. Instrument signup_complete → first score view as the activation event.

**Evidence.** Growth audit CRITICAL: signup redirects into a 3-4 minute /tour (persona picker → market picker → spotlight tour) before any value; no tracking between signup and first product use. Live signup-pricing: all three tour persona buttons render "Continue as an →" with the noun missing.

**Competitor reference.** None — competitors simply land users in the product.

**Verification notes.** Tour flow exists (persona → market → step1-4 → celebrate); redirect hardcoded to /tour with a TODO confirming the `next` param is unimplemented. signup_complete event exists but first_score_view is untracked (score view fires feature.score_view on mount — linkable). Persona label bug confirmed: split() logic extracting word [1] breaks the button text.

**First step.** Fix the persona-label interpolation (one-line bug on the main onboarding entry), then implement the `next` redirect param preserving the originating market URL.

### 15. Make the sample report a flawless listing-presentation demo and market Agent Prep

**What/why.** The Client View / Agent Prep toggle (talking points, six objection handlers, competitive context) is "exactly what an agent needs for a listing presentation" — and it's invisible in marketing. Meanwhile the sample report contradicts itself (3.1 homes listed vs 3.4 months supply; 26% price cuts vs +0.3%), poisoning the exact artifact agents would forward to clients. Fix the numbers from one data pull, then build a /for-agents page led by Agent Prep screenshots and the sample report.

**Evidence.** Live analyzer-reports CRITICAL: sample report self-contradicts on inventory and price-cut figures between Client View and Agent Prep; the same audit names Agent Prep "a genuine realtor differentiator" that marketing never surfaces. Sample is also ~3 months stale with three date formats.

**Competitor reference.** BiggerPockets (shareable PDF artifacts are its most-loved tool feature — PIQ's equivalent must be flawless).

**Verification notes.** Agent Prep fully exists (toggle, 5 components, objection handlers, talking points, competitive context). The data is correct; the UI _presentation_ contradicts itself (unit labeling: "3.1 homes" vs 3.4 months supply). /for-agents does not exist but is feasible with the existing ReportViewer + template system.

**First step.** Fix the unit labels and source both views from one resolved dataset; add a CI consistency check on the sample-report payload (units, score scale, brand names, date freshness).

### 16. Fix the MCP setup-guide auth bug and deep-link key generation

**What/why.** The Claude Desktop config example ships `Authorization:${PIQ_API_KEY}` — missing "Bearer " — so copy-paste setups fail silently, killing the few realtors who try. Unify all examples to `Authorization: Bearer YOUR_PIQ_API_KEY` and accept both formats server-side. Add a "Generate Key" CTA in the Setup tab deep-linking to /account/api-keys?action=create instead of burying it three navigations deep. One afternoon removes the two sharpest adoption killers.

**Evidence.** MCP audit: SETUP_CONFIGS.claudeDesktop missing "Bearer" vs auth-http.ts expectation — "config-and-paste likely fails silently"; key page hidden behind /account/api-keys with no direct link from docs.

**Competitor reference.** None — internal bug.

**Verification notes.** Confirmed: malformed Authorization header (also missing the space after the colon); auth validation requires "Bearer "; server doesn't accept alternate formats; API key page lacks an action=create deep-link parameter. Other client examples use the correct format.

**First step.** Fix SETUP_CONFIGS.claudeDesktop, make auth-http.ts tolerate a missing "Bearer " prefix, and add the Generate Key deep-link button to the Setup tab.

### 17. Build the Reventure-grade region detail panel as the map's conversion engine

**What/why.** One click on any geo should read like a mini market report: score gauge with the three named inputs (% Sold Above List, Median DOM, Months of Supply), A/B/C/F confidence badge, provenance line ("Source: Redfin · as of Apr 2026 · next update mid-Jun"), long-run value chart, breadcrumb chips, Report/Analyzer CTAs, and a locked premium row driving the capture modal. Pure composition of ScoreWidget, fetchTimeSeriesData, and MetricResolutionService; reuse on SEO pages. Redact gated values server-side — Reventure leaks theirs in the DOM.

**Evidence.** Deep-dive P2: Reventure's detail panel is its best surface per app-store reviews (verified live: breadcrumbs, provenance line, gauge, seasonality chips, 25-year chart). PIQ's panel today shows "Double click to edit" debug text and unlabeled concatenated Market Factors numbers ("HOME VALUE GROWTH (YOY) -1.2%-36%"); the score is absent from the default journey.

**Competitor reference.** Reventure (region detail panel — copy the composition; beat it with confidence badge + named score inputs + source-fallback transparency it structurally lacks).

**Verification notes.** RightDetailPanel.tsx exists; ScoreWidget, MetricResolutionService, named inputs (sale_to_list, days_on_market, supply_score), confidence badges, PaywallCard/EntitlementGate, and breadcrumbs all exist. Missing: long-run value chart in the panel, report-style layout composition, SEO reuse pattern. "Double click to edit" confirmed at line 229.

**First step.** Remove the debug affordance and label the Market Factors contribution values; then compose the provenance line + time-series chart into the panel.

### 18. Rebuild the pricing page: working CTAs, real prices everywhere, annual-first tier, fair-billing promise

**What/why.** Stop selling retired scores; give anonymous visitors a working free-signup CTA (today: disabled "Current Plan" + "Get Pro Access" routing to sign-IN); fix the broken Enterprise add-on card. Price the investor tier $19-29/mo, annual-first ("$X/mo, save Y%"), with dollar-quantified value anchors. State the actual price at every paywall lock site-wide. Headline a published billing promise: one-click cancel, renewal reminders, prorated refunds — nearly free on Stripe and it headlines every "X alternative" page.

**Evidence.** Live signup-pricing CRITICAL: retired-score marketing, no free-signup CTA, sign-in misroute, orphaned "$15/month" Enterprise Seat Add-on card with empty description; no paywall anywhere on the site states a price. Deep-dive P8: willingness-to-pay clusters $20-40/mo; BP BBB 2.4/5, Mashvisor "scam" reviews, Reventure no-refunds, PropStream post-cancel charges.

**Competitor reference.** BiggerPockets (dollar-anchored pricing: $390 framed against $5,000 of perks); all four investor competitors (the billing-scandal wedge); DealCheck (clean billing earns 4.7-star goodwill).

**Verification notes.** Pricing page exists with real prices ($29/mo Pro, $149/mo Enterprise in Stripe config — note live page shows $39, reconcile) and annual 17% savings. Missing: $19-29 investor-tier positioning decision, annual-first default (toggle is monthly-first), prices at paywall sites ("Upgrade to Pro" states no price), published billing promise, and an anonymous sign-up path for Pro upgrades.

**First step.** Ship the anonymous-visitor fixes (Start Free CTA, sign-up routing with ?plan= intent carried to checkout) and remove the retired-score section — both verified broken today; pricing-architecture decisions follow.

### 19. Make gating coherent: one dismissible paywall pattern, honest labels, no bypasses, server-side redaction

**What/why.** Standardize a single dismissible paywall component that always states the actual price, names the correct tier (no "Sign Up Free" under a Pro badge), and escapes via X/Escape. Fix the empty "Share this analysis" PDF modal, and redact gated values server-side. Adopt Reventure's ambient-lock pattern (locked metrics interleaved with free ones, blurred preview) while avoiding their CSS-only blur leak.

**Evidence.** Live map CRITICAL: clicking a locked metric traps the user in a full-viewport paywall with no escape (7 of 10 Affordability metrics are locked — the trap is one click away); the geo-level paywall has "Maybe Later" (the right pattern) but the metric-level one doesn't. Live mobile: "Sign Up Free" promises a PRO feature. Deep-dive don't-copy #9: Reventure leaks locked values in the DOM.

**Competitor reference.** Reventure (ambient locks to adopt; CSS-blur leak to avoid); BiggerPockets (visible-but-locked Pro chips inline).

**Verification notes.** Confirmed: AnonPaywallOverlay non-dismissible (no Escape/X); PaywallOverlay uses CSS blur leak (`blur-sm pointer-events-none select-none opacity-50` — children render in DOM, line 58); multiple "Sign Up Free"-under-Pro-badge CTAs; no price displayed anywhere. Two corrections from verification: ShareAnalysisModal works fine, and search does NOT actually bypass the ZIP gate (the original live-audit claim didn't survive code review — though the live session did render a ZIP choropleth via search; re-test for an entitlements race).

**First step.** Reuse the "Maybe Later" geo-paywall component for metric-level locks (kills the viewport trap), then converge all paywalls on one component with price + tier props.

### 20. No-login branded share links for reports and analyses, plus real PDF/CSV export

**What/why.** Every report an agent or investor sends a client, lender, or partner should be an acquisition surface. Fix the plumbing first: CSV export passes reportData as null even for Pro (one-line fix), PDF is window.print() — replace with headless-Chromium generation (page numbers, rendered TOC, white-label headers). Then add tokenized no-login share links with agent branding (Pro) plus "Powered by PropertyIQ" attribution and view tracking, and route lead-magnet email captures into account creation.

**Evidence.** Reports audit HIGH: usePDFExport.ts calls window.print(); ShareReportModal CSV disabled (reportData null); PDFTableOfContents never rendered; seo-pages audit: lead magnets dead-end at email capture. Deep-dive P7: these are competitors' most-loved features.

**Competitor reference.** DealCheck (no-login branded share links — its strongest upgrade trigger; agents reuse them in marketing packages); BiggerPockets (PDF reports — its most-loved tool feature).

**Verification notes.** Better than feared: no-login share links EXIST and track view_count via getSharedReport(). Confirmed broken: CSV (ReportHeader.tsx lines 65/142 pass reportData=null), PDF via window.print(), no rendered TOC, lead magnets don't auto-create accounts. White-label branding (OrgBrandingHeader, attribution) already implemented.

**First step.** Fix the reportData=null pass-through (one line, unbreaks Pro CSV today), then schedule headless-Chromium PDF generation.

### 21. Watchlist score-threshold alerts plus a monthly "Market Pulse" data-drop event

**What/why.** The retention engine PIQ lacks: let users watch markets and get alerted when "any TX metro crosses score 70," a score changes grade, or confidence shifts — wired through the existing lib/watchlist and briefings subsystem (market-level, zero PII liability). Treat monthly rescores as releases: a dated "PIQ Market Pulse" email and changelog with biggest movers per saved farm area (score, price, DOM, supply deltas) — content agents can forward to their sphere, doubling as the recurring content engine.

**Evidence.** Gap matrix: watchlist alerts "partial — lib exists, no score-threshold alerts"; a retention engine is present in 4 of 10 competitor profiles and absent in PIQ. Deep-dive 2.4: Lead Automator is PropStream's retention engine; Reventure treats refreshes as releases ("new data is in" episodic habit).

**Competitor reference.** PropStream (Lead Automator daily alerts); Reventure (refresh-as-release cadence); HouseCanary (Market Pulse digest — the name is theirs, consider branding accordingly); Redfin/Zillow (alerts as the #1 retention hook).

**Verification notes.** More exists than expected: watchlist service with folders, threshold-alert service (monthly cron), and a monthly digest with watchlist mover computation are all live in the backend. Missing: watchlist-tied threshold crossing alerts (current threshold alerts run monthly, decoupled from watchlists), the branded release packaging, and confidence-shift alerts (schema has the field). Rated easy — it's wiring + branding, not building.

**First step.** Wire score-threshold rules to watchlist entries and rebrand the existing monthly digest as the dated "PIQ Market Pulse" release with biggest-mover sections.

### 22. Launch a free open-data hub: monthly score CSVs, methodology, and syndication

**What/why.** Publish a /data-center with downloadable monthly PropertyIQ Score CSVs per metro/county/ZIP, the documented formula, confidence-grade definitions, and a monthly "Top 20 Score Gainers" ranked release. This is how Redfin, Zillow Research, and Realtor.com became the citation-of-record — earning permanent backlinks, press cycles, and AI-engine citations at near-zero marginal cost since the data is already computed. The strongest possible GEO signal that PIQ is the authoritative score source.

**Evidence.** Redfin profile: Data Center is an SEO/credibility moat; Realtor.com: FRED syndication earned permanent authority; Zillow: Research hub is the citation-of-record. PIQ matrix row "published accuracy/data": no.

**Competitor reference.** Redfin (Data Center); Zillow Research; Realtor.com Data Library.

**Verification notes.** Partial equivalents exist: /data documents 90+ metrics with schema.org markup; /scores/methodology publishes the validation report; Platform API v1 exposes authenticated rankings; embed widgets allow syndication; lead magnets publish monthly rankings as PDFs. Missing: the public CSV hub, unauthenticated score feeds, "Top 20 Gainers" page, FRED syndication.

**First step.** Publish monthly score CSVs at stable URLs (/data-center/scores/2026-06-metros.csv) with an email-capture-optional download, plus one "Top 20 Score Gainers" landing page generated from the rankings API.

### 23. Make MCP discoverable: persona recipes, "Use PIQ in Claude" content, Add-to-Claude CTAs

**What/why.** MCP lives in an authenticated "More" dropdown; logged-out visitors and the 94% SEO cohort never learn it exists. Put MCP in the main nav and on the landing page; publish "MCP for Agents / Brokers / Property Managers" guides with sample prompts ("prep a buyer consultation for ZIP 78702"); target "ChatGPT for real estate agents" searches; add an "Ask Claude about this market" CTA on every market page; package the server as a Claude connector / ChatGPT app.

**Evidence.** MCP audit HIGH: "No discoverability of MCP in main navigation for logged-out users... SEO traffic doesn't see MCP exists." Realtor.com profile: its ChatGPT app meets users in the pre-search phase; Redfin's Sierra-powered conversational search lifted tour requests 47%.

**Competitor reference.** Realtor.com / Zillow / Mashvisor (ChatGPT apps as PR + acquisition); PIQ's 47 tools are deeper than anything those ship.

**Verification notes.** Partial: /docs/mcp has a 4-tab guide, persona-specific tool groupings, and homepage AIIntegrationsSection with Claude/ChatGPT logos (but its links go to /scores and /reports, not setup). Missing: main-nav placement, dedicated persona guide pages, SEO-targeted prompt-library content, market-page CTA, connector/app packaging.

**First step.** Rename the nav item from "MCP Integration" to "Use with Claude/ChatGPT," surface it in main nav, and point the homepage AI section's CTA at /docs/mcp.

### 24. Ship seasonality (Best Month to Buy/Sell) free and Overvaluation % as the viral-metric wedge

**What/why.** Reventure's most-praised premium feature (seasonality chips) and most viral metric (overvaluation vs long-term value-to-income/rent average) are both computable from data PIQ already holds — Redfin monthly history, ZHVI/ZORI, Census income. Ship seasonality FREE on every market page and the region panel, directly undercutting Reventure's paywall; add Overvaluation % to the map, screener presets, and SEO pages. Both give the thin SEO pages a shareable, screenshot-able hook and feed the monthly Market Pulse.

**Evidence.** Feature-gap matrix: both metrics are Reventure-only, marked "computable from existing Redfin history / Census + ZHVI/ZORI" for PIQ; the deep-dive fast-follow bench recommends shipping seasonality free as the wedge.

**Competitor reference.** Reventure (Overvaluation % is its most-cited premium metric; Best Month chips its most-praised premium feature).

**Verification notes.** Overvaluation % is already CALCULATED and registered (CalculatedMetricsService.calculateOvervalued: price/income vs 3.5 benchmark) but metro-only and entitlement-locked. Seasonality does not exist — zero code — but Redfin monthly timeseries and the calculated-metrics pipeline support it.

**First step.** Unlock the existing overvalued metric for free at metro level and add it to map + SEO pages; then build best_month_to_buy/sell from Redfin monthly medians.

### 25. Launch "X alternative" pages and the "score, not the story" position for doom-fatigued churners

**What/why.** Every competitor generates "alternative" search demand PIQ isn't harvesting: BP billing resentment, Mashvisor distress, Reventure's flatlined doom audience and no-refund policy. Ship comparison pages for each, leading with PIQ's transparency stack — published methodology, confidence grades, accuracy receipts, fair billing, $20-40 positioning. Frame neutrally: state-relative 1-99 highlights winners AND losers symmetrically; brand the score and the map, not a face. Depends on the accuracy-page (#10) and billing (#18) fixes landing first.

**Evidence.** Deep-dive unmet needs #6/#7: "neutral data without doom" and "fair billing" are vacant positions; Reventure churn (zero net new YouTube subs in 30 days) is real and homeless; four of five competitors carry BBB/Trustpilot billing baggage.

**Competitor reference.** Reventure (doom-fatigue churn pool); BiggerPockets/Mashvisor/PropStream (billing-scandal alternative searches).

**Verification notes.** Comparison pages already live at /compare/[slug] for Reventure, Mashvisor, NeighborhoodScout with feature/pricing/FAQ tables and JSON-LD. Missing: a BiggerPockets page, explicit neutral-position messaging, a billing-transparency page, nav/homepage links to the comparison pages, and the churner-targeted copy.

**First step.** Add the BiggerPockets comparison page and link all /compare pages from the footer and pricing page; layer in the "score, not the story" copy once #10/#18 ship.

### 26. Trust-polish sweep: custom domain, footer, debug strings, dev routes

**What/why.** Move production off the railway.app subdomain before asking for credentials and cards; fix the footer reading "Federal Contracting Services LLC"; remove "Double click to edit" debug text shown to anonymous map users; pull /dev/test, /dev/paywall-overlay-preview and other dev routes from production; add Privacy Policy/Terms links at the consent step. Each is small, but together they spend the trust the brand claims to sell.

**Evidence.** Live signup-pricing (Railway subdomain at the money step, no legal footer links), live first-visit (footer LLC link), live map (debug text), ia-design (dev/test routes exposed; /dev/test is a full CRUD database importer).

**Competitor reference.** None — hygiene.

**Verification notes.** Critical confirmation: /dev/test and /dev/paywall-overlay-preview are NOT protected — middleware checks `/_dev` (underscore) but routes live at `/dev` without it; production-accessible to anyone who guesses the URL. Footer LLC text and debug string confirmed. Privacy/Terms links already inline in the tour signup form. Railway subdomain not found in code (checkout uses FRONTEND_URL env) — domain fix is infra, not code.

**First step.** Close the /dev route exposure today (path-match fix in middleware) — it's a security item wearing a polish costume — then sweep footer/debug strings.

### 27. Instrument MCP per-tool usage so the realtor channel can be managed

**What/why.** Tool execution logs nothing — no tool name, user, geography, duration, or error — so PIQ cannot see which of the 47 tools realtors actually use, which fail, or whether the trial path converts. Log structured events per call to an mcp_tool_executions table and build a simple adoption view (top tools by tier/persona, error rates). Without this, every other MCP investment flies blind; with it, low-adoption tools get pruned and winning workflows become marketing.

**Evidence.** MCP audit HIGH: "server.ts calls handler(args)... does NOT log tool_name, user_id, geography... No way to measure which realtor used top_cashflow_markets today."

**Competitor reference.** None — internal capability.

**Verification notes.** Confirmed: zero logging in the tool handler callback (server.ts lines 44-60). userId available in SessionAuth; tier/persona joinable from user_profiles; backend event-ingestion infrastructure (ServerEventEmitterService) exists. Needs: migration, handler instrumentation, adoption view.

**First step.** Add the mcp_tool_executions migration (with GRANTs per the Supabase key rules) and emit one structured event per tool call from the handler wrapper; dashboard later.

### 28. Add an STR-vs-LTR lane to the analyzer to capture Mashvisor refugees

**What/why.** Mashvisor is collapsing (traffic down ~74%, perpetual discounting, ~21 employees) and its one signature feature — STR vs LTR side-by-side on a single property — is shedding users who still need that job. Add an STR revenue lane beside the analyzer's LTR outputs with an AI verdict on which strategy wins, plus STR regulation flags in reports and as an MCP tool. Pair with a "Mashvisor alternative" page leading with confidence grades, billing trust, and a price undercutting their ~$50 Lite tier.

**Evidence.** Deep-dive 2.3: STR-vs-LTR comparison is the single reason investors pick Mashvisor; gap matrix shows STR analysis "no" for PIQ; Mashvisor distress signals (StackSocial lifetime deals) make refugee capture timely.

**Competitor reference.** Mashvisor (signature feature; distressed incumbent). DealCheck also ships an Airbnb/STR calculator.

**Verification notes.** PIQ has zero STR capability — analyzer supports buy-and-hold/flip/BRRRR only. The Mashvisor comparison page already lists "Short-Term Rental Data: No" as a gap. Needs: new STR strategy type in analyzer-core (daily-rate revenue math, different expense model), frontend lane, AI verdict prompting, regulation dataset. Remember: analyzer-core changes require `npm run build` before frontend consumption.

**First step.** Add an STR strategy type to analyzer-core (occupancy × nightly rate, STR expense ratios) rendered as a side-by-side column sharing the existing expense assumptions; regulation flags as a curated state-level dataset first.

### 29. Turn embeds into a distribution loop: agent-site score widgets and watermarked map shares

**What/why.** Embeds exist but distribution is near zero, and the embed route gives no token-validation feedback or reliable "Powered by PropertyIQ" attribution. Ship a copy-paste embeddable score widget agents can put on their farm-area landing pages (score + confidence + freshness, linking back to PIQ), plus one-click watermarked map/score image exports with auto-generated headline stats for social. Reventure's entire 200K-user funnel is watermarked map screenshots — "the map IS the ad."

**Evidence.** Matrix: "embeds exist; distribution near zero"; reports audit: embed token validation/attribution unclear. Deep-dive P6: Reventure's watermarked map screenshots are the proven share loop.

**Competitor reference.** Reventure (watermarked map screenshots as the acquisition engine).

**Verification notes.** Embed widgets with token validation and attribution fully exist; enterprise branding bars implemented. Watermarked image export, social share headlines, and distribution analytics do NOT exist — this rec bundles three features at different stages. A Remotion video template exists but isn't wired for embed distribution.

**First step.** Ship the one-click watermarked map/score PNG export with an auto-generated headline stat (the highest-leverage piece — it requires no third-party adoption), then the copy-paste agent widget.

### 30. Portfolio dashboard: saved deals as a ranked, comparable, exportable table

**What/why.** Investors can save analyses but cannot compare, diff, rank, or export them — so PIQ never becomes the system of record that earns the daily open. Build a saved-deals table with inline KPIs (price, cap rate, grade, market score), filters by grade/state/strategy, side-by-side diff of assumption changes, reusable assumption sets, and CSV export. Later expose via MCP ("rank my deals by PIQ score"). No competitor ships market-aware portfolio context.

**Evidence.** Analyzer audit: no portfolio/bulk analysis, no saved-analysis comparison, assumptions not reusable, no export beyond PDF. DealCheck's documented weakness is no portfolio tracking.

**Competitor reference.** DealCheck (users complain it lacks portfolio tracking — adjacent gap PIQ can own); HouseCanary (Portfolio Monitoring as a sticky retention feature).

**Verification notes.** Backend fully built (deal_analyses table, save/list/get endpoints, fetchSavedAnalyses). Missing is entirely frontend: portfolio list UI, compare view, filters, ranking, CSV export, assumption presets, MCP tools. Rated easy despite "large" effort because no backend work is required.

**First step.** Ship the saved-deals table with inline KPI columns and sort/filter over the existing list endpoint; compare/diff and presets follow.

---

## 4. Competitive Landscape

### 4.1 Investor competitors (in depth)

#### BiggerPockets — the community giant with a data problem

**What they nail:** Conversion choreography (anonymous users fill the ENTIRE rental calculator, results walled behind Pro — sunk-cost capture at its purest; inline signup forms embedded in forum-thread SEO pages without blocking reading). Value anchoring ($390/yr framed as $3,860-$5,000 of partner perks). Shareable PDF deal reports (their most-loved tool feature). Annual retention hooks (50-state lawyer-reviewed leases, annual-Pro-only). A persistent monetization bar on every page.

**What users hate:** ~30 minutes of manual entry per analysis with no auto-fill anywhere. Market data is shallow and stale — MSA-only, "Updated: June 2024" on the flagship Market Finder, "Top 25 hand selected by our experts" with zero methodology. Rent Estimator spreads of $1,000+ vs competitors. Billing hostility: BBB 2.4/5, charges after cancellation, no refunds, inconsistent pricing copy. The Agent Finder sells one investor lead to ~5 unvetted agents.

**PIQ's counter-move:** Don't fight the community — fight the tools. Auto-prefill the analyzer from PIQ's own metric layer ("2-minute analysis vs BP's 30-minute spreadsheet"); attack Market Finder on freshness + granularity (monthly rescores down to ZIP vs two-year-old MSA data); steal the calculator-wall choreography but gate at FREE signup with a blurred preview (Rec #8) — same physics, friendlier wall, and a marketing wedge; copy the dollar-anchored pricing page; exploit billing distrust with an explicit no-dark-patterns promise.

#### Reventure App — the playbook to study (and the bias to exploit)

PIQ's closest structural twin: choropleth map + paywalled 0-100 forecast score, ~200K users at $39/mo, funneled entirely from Nick Gerli's bearish YouTube brand (~677K subs).

**What they nail:** One hero number as the upgrade driver. The region detail panel — verified live as the best surface in the product (breadcrumbs, "Source: Zillow · Data: Apr 2026 · Next Update: Mid-Jun" provenance line, score gauge, Best Month chips, 25-year value chart). A metric glossary with named sources and honest caveats. The ambient paywall (free metrics deliberately interleaved with crowned premium ones; locked content blurred-but-visible with region-personalized unlock copy). Screener chrome (preset chips + 9 sliders + ranked table over 917 metros). Accuracy-as-marketing (annual self-graded "#1 forecast" post). The two-step paywall: email capture first, payment after login.

**What users hate:** Perma-bear bias — the data is real, the interpretation is reliably doom; YouTube growth has flatlined (~zero net new subs in 30 days) and doom-fatigued churners need a home. Black-box score (5 named inputs, no weights, no confidence indicator). The map is now fully hard-walled for anonymous users. $39/mo feels steep; all sales final, no refunds. Total key-man risk. Locked "blurred" values are CSS-only and readable in the DOM.

**PIQ's counter-move:** Copy the mechanics (detail panel, ambient locks, glossary, screener chips, email-first paywall, annual-first pricing), then beat them on the three things they structurally can't fix: **transparency** (published methodology, A/B/C/F confidence, validation backtests vs unaudited self-grading), **neutrality** ("the score, not the story" — state-relative 1-99 highlights winners AND losers; the natural landing spot for doom churners), and **depth below market level** (analyzer + AI reports + MCP — three surfaces Reventure has zero answer for). Do NOT copy the hard wall or the no-refund policy.

#### Mashvisor — the distressed incumbent (capture its refugees)

**What they nail:** The signature STR-vs-LTR side-by-side (cash-on-cash, cap rate, occupancy, income for both strategies on one property — the single reason investors pick it). Mashmeter neighborhood score + investment heatmaps. Return-metric property search. An STR regulation database for 500+ cities.

**What users hate:** Data accuracy collapses outside major metros ("so wrong so frequently that the whole platform is pointless") with no confidence disclosure; billing/cancellation traps; unresponsive support. Distress signals: traffic down ~74%, perpetual discounting (~$18 effective on a $50 list price), StackSocial lifetime deals, ~21 employees.

**PIQ's counter-move:** Add the STR lane with an AI strategy verdict (Rec #28); ship the screener at PIQ's geo strength (Rec #6); run the "Mashvisor alternative" page leading with billing trust + confidence grades + a price undercutting their Lite tier; STR regulation flags as cheap, sticky reference data.

#### PropStream — don't compete; be the step before it

**What they nail:** Breadth (160M properties, 165+ stackable filters, 20 named pre-made lead lists users think in — Tired Landlords, Zombie Properties); the daily-refreshing Lead Automator (the retention engine); every analysis surface ends in an action; zero re-entry from AI answer into pre-filled calculators.

**What users hate:** Sticker $99 balloons to ~$278-$350/mo real TCO; county-record data lags weeks; BBB billing horror stories; overwhelming for beginners; "research tool, not a deal-flow engine."

**PIQ's counter-move:** PropStream conflates WHERE to invest (its weakest half) with WHO to mail (its moat). Own step zero and never touch lead-gen: named MARKET lists ("Undervalued ZIPs in TX") with zero PII liability, queryable via MCP; area-level flip analytics; watchlist alerts as the Lead Automator habit loop (Rec #21); position as the market-intelligence layer investors keep alongside PropStream at a fraction of the cost.

#### DealCheck — the UX bar for the analyzer

**What they nail:** Address → full underwrite in under a minute via property import; live what-if recalculation with no Recalculate button; the Purchase Offer Calculator (reverse-solves max offer and names the binding constraint); no-login interactive shareable report links with Pro branding; assumption templates; a genuinely usable free tier capped by saved-deal COUNT (15) rather than stripped features — earning 4.7-star ratings and goodwill at $10-20/mo, the price band investors actually accept.

**What users hate:** Stale comps; ZERO market-level intelligence ("is this ZIP a good market?" is unanswerable); untrusted auto-filled estimates; no integrations/API/AI; no portfolio tracking.

**PIQ's counter-move:** Match the import-prefill speed, then beat it with source + freshness + confidence stamps on every field (Rec #5); fuse the deal verdict with market context ("this deal cash-flows AND sits in a 78-score ZIP" — the head-to-head line); copy the free-by-count tier ladder and no-login share links exactly (Recs #18, #20); analyzer-as-MCP-tool is a moat DealCheck cannot build.

### 4.2 Feature-gap matrix (from the investor deep-dive)

| Capability                               | BP                        | Reventure                     | Mashvisor          | PropStream           | DealCheck                 | PIQ today                                               |
| ---------------------------------------- | ------------------------- | ----------------------------- | ------------------ | -------------------- | ------------------------- | ------------------------------------------------------- |
| Interactive market map (choropleth)      | partial (MSA-only, stale) | yes                           | partial (heatmaps) | no                   | no                        | **yes**                                                 |
| ZIP/county granularity                   | no                        | yes                           | partial            | yes (parcel)         | no                        | **yes**                                                 |
| Proprietary market score                 | no (editorial Top 25)     | yes (Forecast Score)          | yes (Mashmeter)    | partial              | no                        | **yes** (PIQ Score 1-99)                                |
| Score methodology transparency           | no                        | no                            | no                 | no                   | n/a                       | **partial** (documented; not marketed)                  |
| Confidence / data-quality indicator      | partial                   | no                            | no                 | no                   | no                        | **yes** (A/B/C/F) — undersold                           |
| Published accuracy track record          | no                        | partial (self-graded blog)    | no                 | no                   | n/a                       | **no** (internal validation exists)                     |
| Data provenance + freshness in UI        | no ("June 2024" stamp)    | yes                           | no                 | no                   | no                        | **partial** (layer exists; not surfaced)                |
| Deal analyzer (rental/cash-flow)         | yes (manual)              | partial                       | yes                | partial              | yes (best-in-class)       | **yes** (+ AI insights)                                 |
| Address auto-prefill of deal inputs      | no                        | partial                       | yes                | yes                  | yes                       | **no**                                                  |
| Multi-strategy analysis (BRRRR/flip/STR) | yes                       | no                            | partial (STR+LTR)  | partial              | yes (6 types)             | **partial** (3 strategies, no STR)                      |
| STR vs LTR side-by-side                  | no                        | no                            | yes (signature)    | no                   | partial                   | **no**                                                  |
| Reverse max-offer calculator             | no                        | no                            | no                 | no                   | yes                       | **no**                                                  |
| Market screener (filter/rank all geos)   | partial                   | yes (chips + sliders + table) | yes                | partial              | no                        | **no** (map only)                                       |
| Historical time-travel map / long series | no                        | yes (25yr + date picker)      | partial            | no                   | no                        | **partial** (API exists; no map picker)                 |
| Seasonality (best month to buy/sell)     | no                        | yes                           | no                 | no                   | no                        | **no** (computable today)                               |
| Overvaluation / fair-value metrics       | no                        | yes (most-cited)              | no                 | no                   | no                        | **partial** (computed, metro-only, locked)              |
| AI market reports/narratives             | no                        | no                            | no                 | no                   | no                        | **yes** — unique                                        |
| AI assistant / conversational access     | no                        | no                            | no                 | partial              | no                        | **partial** (MCP built, ~zero adoption)                 |
| MCP / AI-agent integration               | no                        | no                            | no                 | no                   | no                        | **yes (built) / no (adopted)**                          |
| Embeds / shareable widgets               | no                        | partial                       | no                 | no                   | yes                       | **yes** (distribution near zero)                        |
| Branded PDF/link deal reports            | yes (loved)               | partial                       | yes                | no                   | yes (no-login + branding) | **partial** (share links exist; PDF=print, CSV broken)  |
| Off-market / owner lead-gen              | partial                   | no                            | partial            | yes (the moat)       | partial                   | **no** (deliberate non-goal)                            |
| Saved searches / watchlist alerts        | no                        | no                            | no                 | yes (Lead Automator) | no                        | **partial** (lib + monthly digest; no threshold alerts) |
| Community / forums                       | yes (the moat)            | no                            | no                 | no                   | no                        | **no** (don't copy)                                     |
| Working signup → activation funnel       | yes (ruthless)            | yes                           | yes                | yes                  | yes                       | **no — BROKEN (11 starts / 0 completes)**               |
| SEO traffic converted to accounts        | yes (inline forms)        | yes (locked-metric modal)     | partial            | partial              | partial                   | **no (94% of traffic, ~zero capture)**                  |
| Genuinely usable free tier               | partial                   | partial                       | no                 | no (trial only)      | yes                       | **yes** (free map) — no capture on top                  |
| Mobile apps                              | partial                   | yes (4.8★)                    | partial            | yes                  | yes (4.7★)                | **no**                                                  |
| Transparent, refund-friendly billing     | no                        | no                            | no                 | no                   | yes (mostly)              | **opportunity** (Stripe; no public promise)             |

**Read:** PIQ holds the rarest squares (score + confidence + AI reports + MCP + map granularity) and fails the most basic ones (funnel, capture, prefill, screener).

### 4.3 What NOT to copy

1. **BP's undismissable contact-ransom modal and Pro-walled calculator results.** The sunk-cost physics work; the resentment is documented (BBB 2.4/5). Gate at FREE signup with a dismissible wall and blurred preview instead.
2. **Reventure's hard anonymous wall on the map.** PIQ's free map is the top-of-funnel hook and the SEO payload. Lock the premium layer, never the front door — especially while Google and AI engines decide whether PIQ pages are citable.
3. **The doom-narrative / single-personality growth engine.** It built Reventure fast and is now its ceiling: flatlined subscribers, credibility discounting, key-man risk. Brand the score and the map, not a face.
4. **Lead-gen marketplaces selling unvetted contacts** (BP Agent Finder, PropStream skip tracing). Both sides complain; skip tracing drags in PII liability and TCPA/DNC exposure.
5. **Billing dark patterns** — all-sales-final, post-cancel charges, monthly-price penalties, hidden add-on stacks. These generate the "X alternative" search demand PIQ should be harvesting, not creating.
6. **Building community/forums or a media org.** BP's moat took 20 years; the substitute is data-derived content (Market Pulse, accuracy reports) that compounds without moderators.
7. **Property/owner-level data depth** (PropStream's 160M parcels). County-record licensing, weeks-stale data, a price ladder PIQ's audience won't pay. Win as the layer ABOVE the parcel layer.
8. **Mashvisor's discount spiral** (lifetime deals, perpetual promos). Trains customers never to pay list and signals distress. Hold one honest price.
9. **CSS-only paywall blur.** Reventure's locked values sit readable in the DOM — and so do PIQ's today (PaywallOverlay renders blurred children client-side). Redact server-side.
10. **Pricing-copy drift.** BP advertises "Save 16%" and "Save 18%" for the same plan. Single source of truth for pricing copy — small sloppiness reads as untrustworthiness in a category where billing trust is the claimed differentiator.

### 4.4 Consumer giants (Zillow, Redfin, Realtor.com)

Not direct competitors — they monetize the supply side (agent leads, brokerage, mortgage) and give consumers everything free — but they define user expectations and own the patterns PIQ should adapt:

- **Zillow:** the save-and-alert habit loop ("addictive and genius," the engine of weekly return visits → Rec #21); published Zestimate error rates as the trust anchor (→ Rec #10); a pinned "Ask Zillow" AI entry point and the only real-estate ChatGPT app of its class (→ Recs #7, #23); outcome-based filters (monthly payment, BuyAbility) over raw price (→ screener presets, Rec #6); Zillow Research as the open-data authority moat (→ Rec #22).
- **Redfin:** the Data Center (free downloadable dashboards dominating housing-data SEO and press → Rec #22); Compete Score and Hot Home badges (one number + plain-English action implication → score companion chips); "updated every 2 minutes" freshness as explicit marketing (→ provenance lines, Rec #17); top-10 ranked tables as the most-shared content (→ Recs #4, #22); Sierra conversational search lifting tours 47% (→ Rec #23).
- **Realtor.com:** the Market Hotness Index (two named, equally weighted sub-scores — the explainability bar for PIQ's three named inputs → Rec #9); the public Data Library syndicated into FRED (permanent citation authority → Rec #22); a ChatGPT app targeting the pre-search phase (→ Rec #23); smart-prompt AI UX with persistent sessions.

The shared lesson: **free, attributed, fresh data is the moat-builder; the score with admitted error rates is the trust engine; alerts are retention.** All three patterns are cheap for PIQ because the data is already computed.

### 4.5 Data/AI platforms (HouseCanary, NeighborhoodScout, PropStream Intelligence)

- **HouseCanary:** accuracy IS the brand — third-party-tested AVM error rates published openly, self-serve $19/$79/$199 tiers with metered report credits and published per-API-call pricing, CanaryAI chat grounded in their own dataset, and a monthly Market Pulse digest. PIQ adoptions: the public accuracy page (Rec #10), metered report credits as a monetization pattern (Rec #18), and the monthly digest (Rec #21). Note: a chat assistant over PIQ data would need explicit product buy-in — Quinn was deliberately purged; the MCP server is the sanctioned conversational surface.
- **NeighborhoodScout:** premium-priced hyper-local analytics sold on methodology trust ("up to 90% accurate," PhD-built models) and plain-language percentile framing ("safer than 9% of U.S. cities" — trivially adaptable: "outperforms 72% of California markets," since PIQ already IS a within-state percentile). Its free programmatic SEO pages funnel into a $29.99/report paywall. Its loudest complaints — paywall surprise, refused refunds, cancellation friction — are the same billing wedge as the investor set. PIQ already ships a /compare page against it.
- **PropStream Intelligence (AI layer):** branded plain-English propensity scores (Foreclosure Factor) and a property-aware AI assistant that hands off into pre-filled calculators — the "zero re-entry" pattern PIQ should mirror from map panel → analyzer (Rec #3).

---

## 5. Unmet Market Needs — White Space PIQ Can Own

1. **The market→deal bridge.** The #1 structural gap. Investors cobble together 4+ subscriptions because nobody connects "rank markets" to "underwrite a property there" in one flow. PIQ owns both ends today; no competitor owns either end as well at both levels. (Recs #3, #5, #6)
2. **Verifiable accuracy.** Every forum thread on every score asks "is it accurate?" and no vendor answers with auditable evidence at the geography investors buy in. Reventure's self-graded blog post is the high-water mark — marking its own homework. A public per-geo-level backtest page is white space PIQ's validation pipeline already produces internally. (Rec #10)
3. **Honest uncertainty.** Small-ZIP volatility and stale comps rendered as confident numbers with zero warning is the chronic complaint across the set. "We tell you when NOT to trust the number" — A/B/C/F grades + source + as-of date on every value — is a trust feature no incumbent ships because opacity protects their pricing. (Recs #5, #9, #17)
4. **The "where does it still pencil" question.** 2026 discourse is dominated by deals not penciling at current rates. Investors want a rate-aware shortlist (rent-to-price clearing today's mortgage rates), not another calculator. Computable from PIQ's existing metrics; nobody ships it. (Rec #6)
5. **AI-native access to live market data.** 43% of RE pros use AI assistants; 67% of buyers start research in AI tools; MCP is the rail — and PIQ's server is nearly alone in the consumer-investor segment. The need is productization (recipes, trial keys, GEO-citable pages), not engineering. (Recs #4, #7, #22, #23)
6. **Neutral data without a doom narrative.** Reventure's audience is plateauing as the predicted crash keeps not arriving. "The score, not the story" is a vacant position — state-relative 1-99 highlights winners and losers symmetrically. (Rec #25)
7. **Fair billing as a feature.** Four of five investor competitors carry BBB/Trustpilot billing scandals. One-click cancel + renewal reminders + prorated refunds + a public promise is nearly free on Stripe and headlines every "X alternative" search. (Recs #18, #25)
8. **The $20-40 price band with real depth.** Willingness-to-pay clusters at $20-40/mo for analytics. Reventure charges $39 for market data only; DealCheck $10-20 for deal math only. Market data + score + analyzer + AI in one $20-40 tier is an open lane. (Rec #18)

---

## 6. Strengths to Preserve

These surfaced repeatedly across audits as genuinely best-in-class. Do not regress them while fixing the funnel.

1. **The anonymous analyzer's free value.** Manual price+rent entry yields a full graded verdict, sensitivity tornado, 30-yr wealth projection, and "What's holding this deal back" levers with one-click apply — best-in-class deal coaching with zero signup. Plus plain-language education ("What is DSCR?") and honest input warnings.
2. **The Agent Prep toggle.** Talking points, six objection handlers, competitive context — "exactly what an agent needs for a listing presentation." A genuine realtor differentiator; it needs marketing, not rework (Rec #15).
3. **The A/B/C/F confidence system and MetricResolutionService provenance.** No competitor has a data-quality grade at all. This is the trust stack; it's built — it just needs to be surfaced everywhere (Recs #5, #9, #17).
4. **Candid methodology content.** The "Known Limitations" section (hit rate ~58% "not a certainty," 3 negative-IC states named), the plain-English glossary, decile tables with N counts and std dev — rare and trust-building in this category. Protect the candor while fixing the contradictions (Rec #10).
5. **The free map with visible-but-locked gating.** Generous anonymous access with lock icons that communicate the upgrade path without (until the 5-page wall) blocking exploration. The right model — keep the front door open.
6. **SEO page infrastructure.** Static generation, ISR, complete metadata, breadcrumb/JSON-LD schema, server-rendered geo hierarchy, provenance statements, per-market email subscription. The skeleton is excellent; it lacks payload and capture, not structure (Rec #4).
7. **Material Design 3 brand consistency.** Semantic token system, indigo palette, editorial typography in reports — consistent across nearly every surface audited (89 components bypassing tokens with raw hex is the cleanup item, not the system).
8. **The MCP server's depth.** 47 tools across 8 persona categories, dual auth (OAuth 2.1 PKCE + API keys), clean entitlement validation, 4-tab docs. Deeper than anything any competitor ships in this segment — it needs a funnel, not a rebuild (Recs #7, #16, #23, #27).
9. **The reports engine.** 80+ section types, comparison reports with radar charts, white-label org branding, share links with view tracking. The artifact depth no competitor matches (Rec #20 fixes its export plumbing).
10. **URL-as-state on the map.** Shareable, back-button-friendly ?metric/level/st params — the foundation for content-to-map deep links and the screenshot share loop (Rec #29).

---

## 7. Methodology Appendix

**Date of audit:** 2026-06-10 (all live observations against https://propertyiq.up.railway.app production).

**Inputs and process:**

1. **Code audit** — parallel agent reviews of 9 codebase areas: reports, growth/funnel instrumentation, seo-pages, map, scores components, MCP server (packages/mcp-server), analyzer, IA/design system, and data layer. Findings grounded in specific files/lines (e.g., usePDFExport.ts, AnonPaywallOverlay, server.ts tool handler).
2. **Live production walkthroughs** — Playwright-driven sessions over six journeys: first visit (desktop 1440x900), signup + pricing, analyzer + reports (anonymous), markets/SEO pages, the map (including paywall-escape testing via Escape/scrim/X probes and elementFromPoint hit-testing), scores/trust pages (with console 401 capture), and a full mobile pass at 375/390px (tap-target measurement, overflow detection, z-order hit testing).
3. **Competitor research** — 10 structured profiles (BiggerPockets, Reventure, Mashvisor, PropStream, DealCheck, Zillow, Redfin, Realtor.com, HouseCanary, NeighborhoodScout) covering positioning, signature features, UX patterns, monetization, and PIQ-fit adoption ideas.
4. **Investor-competitor deep dive** — 12 research facets on the five investor competitors, including **live browser teardowns of Reventure and BiggerPockets** (paywall mechanics, region detail panel anatomy, screener chrome, signup choreography, DOM-leak inspection), review-site mining (BBB, Trustpilot, app stores), and pricing-page archaeology. Source: `2026-06-10-investor-competitor-deep-dive.md` (folded into this report).
5. **Adversarial verification** — every candidate recommendation was independently verified against the codebase before inclusion: claims checked file-by-file (e.g., confirming piq_market is accepted-but-unconsumed; discovering the /dev middleware path mismatch; correcting the ZIP-paywall-search-bypass claim that didn't survive code review; finding the existing threshold-alert and monthly-digest crons). Each recommendation carries the verifier's feasibility verdict and notes; "alreadyExists: partially" status was the norm — most recommendations complete or wire existing infrastructure rather than build new systems.
6. **Known platform context** applied throughout: funnel data (11 signup starts / 0 completes / 30d; 94% of traffic on programmatic SEO pages; MCP near-zero real users), PropertyIQ Score v4.0 definition (1-99, state-relative, 50 = state average; 746 metros / 2,983 counties / 19,880 ZIPs), and the single-score architecture (HomeReady/InvestorEdge/Market Health retired).

**Supporting artifacts:**

- `docs/superpowers/results/audit-working-2026-06-10/findings.json` — full raw findings (15 audit areas, 10 competitor profiles)
- `docs/superpowers/results/2026-06-10-investor-competitor-deep-dive.md` — investor competitive playbook (source material for §4-§5)

**Caveats:** Live observations are a point-in-time snapshot of production on 2026-06-10; competitor claims reflect public information and live teardowns as of that date. Verification corrected two original audit claims (ShareAnalysisModal works; the ZIP search bypass was not reproducible in code review) — where live observation and code review conflicted, both are noted. Dollar/accuracy figures quoted from PIQ marketing pages are reported as displayed, including their internal contradictions (which are themselves findings).
