# Investor Competitor Deep Dive — Competitive Playbook

**Date:** 2026-06-10
**Scope:** BiggerPockets, Reventure App, Mashvisor, PropStream, DealCheck + cross-cutting unmet needs (12 research facets, including live browser teardowns of Reventure and BiggerPockets)
**Grounding note:** `audit-working-2026-06-10/findings.json` was not present at write time; PIQ-today assessments are grounded in the parallel audit's headline facts (broken signup funnel — 11 starts / 0 completes; 94% of traffic on programmatic SEO pages that don't convert; near-zero MCP adoption) plus known platform capabilities.

---

## 1. Executive Summary — Three Strategic Truths

### Truth 1: The market is split into "WHERE" tools and "WHAT" tools, and nobody owns the bridge.

Reventure and BP Market Finder answer "where should I invest" (market-level). DealCheck, BP calculators, and Mashvisor answer "is this deal good" (property-level). PropStream answers "who do I mail" (lead-gen). Investors explicitly complain about paying for 3-4 overlapping subscriptions (PropStream $99 + DealCheck $20 + Rentometer + Reventure $39) because no tool covers market screening AND deal analysis in one flow. **PIQ is the only competitor in this set that already owns both ends** — the metric map + PropertyIQ Score (746 metros / 2,983 counties / 19,880 ZIPs) AND a deal analyzer with AI insights. The bridge ("analyze a property in this 78-score ZIP, prefilled with local data") is the single biggest structural opportunity, and it's a wiring job, not a build job.

### Truth 2: Trust is the unguarded flank — every incumbent is a black box with hostile billing.

The pattern repeats across all five competitors: unaudited scores ("hand selected by our experts," Reventure's self-graded forecast claims, Mashvisor's hidden methodology), stale data presented as live (BP Market Finder stamped "Updated: June 2024" — two years stale), confident numbers in thin-data markets with zero warning, and billing dark patterns (BP BBB 2.4/5 on auto-renew refusals; Mashvisor "starting to feel like a scam company"; Reventure all-sales-final no-refunds; PropStream charging after trial cancellation). PIQ already has the assets to own trust: A/B/C/F confidence grades, documented score methodology, multi-source provenance (Zillow/Redfin/Census/FRED/BLS) via MetricResolutionService, and monthly validation backtests. **None of this is currently weaponized as visible UX or marketing.** Confidence + provenance + published accuracy receipts + clean billing is a complete, cheap differentiation stack no incumbent can copy quickly (their opacity is load-bearing).

### Truth 3: Distribution is shifting to AI surfaces, and the incumbents have zero presence there.

67% of home buyers now start research in an AI tool (up from 17% eighteen months prior); 43% of RE professionals already use ChatGPT/Claude; MCP hit 10,000+ active servers and CRE blogs teach "Claude + real-estate MCP" workflows. BiggerPockets is a media company (podcasts, books, forums), Reventure is one YouTuber's funnel, and none of the five has an MCP server, embeds strategy, or AI-assistant surface. PIQ has the MCP server built — adoption is near zero, but the asset exists and the window is open. The same logic applies to PIQ's 94% programmatic-SEO traffic: it's the equivalent of Reventure's YouTube top-of-funnel, currently leaking 100% of its conversion potential because the signup chain is broken and the pages lack capture mechanics that BP and Reventure execute ruthlessly.

**Strategic posture:** Fix the funnel first (everything else multiplies through it), bridge market→deal second, weaponize trust third, and ride the AI-distribution shift before the incumbents notice it matters.

---

## 2. Per-Competitor Teardowns

### 2.1 BiggerPockets — the community giant with a data problem

**What they are:** A media/community company (3M+ members, 4M+ forum posts, ~4M monthly podcast downloads, 1M+ YouTube subs, est. $21-27M revenue, Chernin-owned since Aug 2024) that monetizes via Pro subscriptions, lead-gen marketplace, books, and events. Tools are the upsell, community is the moat.

**What they nail:**

- **Conversion choreography.** The rental calculator lets anonymous users fill the ENTIRE form (smart defaults, tooltips on every line) then walls results behind Pro — sunk-cost capture at its purest. The agent finder runs a 5-step friction-free anonymous wizard, then drops an undismissable contact-capture modal at the final step. Forum threads (their biggest SEO surface) embed inline name/email/password signup forms in the page body without blocking reading.
- **Value anchoring.** Pro at $390/yr is framed as $3,860-$5,000/yr of partner perks (LendingOne $2,000, Kiavi $1,250, RentRedi $354, Steadily $256) — pure BD leverage, no software built.
- **Shareable artifacts.** Calculator PDF reports (charts, photos, branded) are the most-loved tool feature; investors send them to lenders and partners.
- **Annual retention hooks.** 50-state lawyer-reviewed lease packages are annual-Pro-only — a hoardable asset that makes annual billing self-evidently rational.
- **Persistent monetization surface.** "Build your investing team: Agents | Lenders | Tax Pros" bar on every page; market pages double-monetize with embedded lead-gen widgets.

**What users hate:**

- ~30 minutes of manual data entry per analysis; no MLS/tax/rent auto-fill anywhere.
- Market data is shallow and stale: MSA-only, "Updated: June 2024" stamped on the flagship Market Finder, no ZIP/county drill-down, "Top 25 hand selected by our experts" with zero methodology.
- Rent Estimator spreads of $1,000+ vs Rentometer/Zillow on the same address; multifamily treated as SFH.
- Billing hostility: BBB 2.4/5, charged after cancellation, no refund within hours of renewal, monthly price ($69/mo on some surfaces, $39 on others) penalizes non-committers. Trustpilot as low as 2.9/5 on some counts.
- Agent Finder sells one investor lead to ~5 unvetted agents (~$500); agents report 95% beginner leads; investors get whoever paid.
- Relentless Pro upsell pressure; formerly-free features migrating behind the paywall.

**Pricing:** Free (forums, BiggerDeals, 5 reports/calculator). Pro $39/mo or $390/yr ($32.50/mo; "Save 16%" or "18%" depending on page — sloppy). Scale $125/mo annual. Business $66/mo annual (agent lead-gen). Premium $99/mo with 12-mo commitment. Bootcamps $125-$515.

**The PIQ counter-move:** Don't fight the community — fight the tools. (1) Auto-prefill the deal analyzer from PIQ's own metric layer and market "2-minute analysis vs BP's 30-minute spreadsheet." (2) Attack Market Finder head-on with freshness + granularity: PIQ rescores monthly down to ZIP vs BP's two-year-old MSA map — put "Updated {month}" stamps everywhere and ship a "BiggerPockets Market Finder alternative" comparison page. (3) Steal the choreography, soften the wall: full free analysis, gate AI verdict/exports behind FREE signup (not $390/yr) — same sunk-cost physics, friendlier wall, and a marketing wedge ("see your full results free"). (4) Copy the dollar-anchored pricing page and the persistent action bar. (5) Exploit billing distrust with explicit no-dark-patterns positioning.

### 2.2 Reventure App — the playbook to study (and the bias to exploit)

**What they are:** The monetization layer of Nick Gerli's bearish housing-media brand (~677K YouTube subs, ~2.89M monthly views, 146K X followers, Newsweek/Fortune/Bloomberg quote machine). A choropleth map + a paywalled 0-100 Home Price Forecast Score across 50 states / ~1,000 metros / ~3,000 counties / 30,000 ZIPs. Claims 200K+ active users. This is PIQ's closest structural twin.

**What they nail:**

- **One hero number as the upgrade driver.** The Forecast Score is THE thing people come for, and it's locked at ZIP level behind $39/mo. Everything else is supporting cast.
- **The region detail panel** (best surface in the product, verified live): one click on a ZIP gives breadcrumb chips (County | Metro | State), provenance line "Source: Zillow · Data: Apr. 2026 · Next Update: Mid-Jun," score gauge, Best Month to Buy/Sell chips, and a 25-year value chart with peak/trough dollar callouts. It reads as a mini market report, not a tooltip.
- **Metric glossary with named sources and honest caveats** for ~60+ data points (Zillow ZHVI/ZORI, Census ACS, FRED, US Treasury, even NOAA) — reviewers cite this as why they trust it.
- **Ambient paywall.** The "Popular Data" sidebar deliberately interleaves free metrics with crowned premium ones, so every free session bumps into 4+ lock icons organically. Locked content renders blurred-but-visible with region-personalized unlock copy ("Access Housing Market Forecast for 78701").
- **Screener chrome:** preset filter chips (Cheapest, Most Overvalued, High Income), 9 range sliders, ranked sortable table over 917 metros, historical month date-picker for the whole map, ZIP values printed directly on polygons after search.
- **Accuracy-as-marketing:** annual self-graded "#1 U.S. housing forecast of 2025" blog post (0.85pp national error vs competitors' >2.5pp) converts skeptics and earns press.
- **Two-step paywall:** email-capture modal FIRST ("Sign up for a Free Account"), payment pitch after login. Checkout deep-links with plan preselected.

**What users hate:**

- Perma-bear bias: data is real, interpretation is reliably doom; users who waited since 2021 missed appreciation; YouTube subscriber growth has flatlined (~0 net new in 30 days) — doom fatigue is real and those churned subscribers need a home.
- Black-box score: 5 named inputs, no weights, no per-geo backtest, no confidence indicator. ZIP-level correlation admittedly drops 30-40%.
- Hard wall: the map is now fully blocked for anonymous users (undismissable modal, no X, Esc does nothing); flagship score gauges show "N/A" when locked — zero pre-purchase preview.
- $39/mo (testing $49) feels steep for monthly-refresh data on a slow asset class; single all-or-nothing tier; all sales final, no refunds ever.
- Key-man risk: the entire funnel is one personality; the business pauses when Nick pauses.
- Sloppy gating: "blurred" premium values are CSS-only and readable in the DOM.

**Pricing:** Free account required even to see the map; ~8 free data points. Premium $39/mo or $399/yr ($33/mo, "SAVE 15%"). Premium = 40+ data points, Forecast Score for 30,000 ZIPs, Listing Analyser, 5 report downloads/mo, Excel export, 20-25yr history. No trial, no refunds.

**The PIQ counter-move:** Reventure proved the exact business model PIQ is built for — choropleth map + proprietary paywalled score + free-account-first capture — at $39/mo with 200K users. Copy the mechanics (region detail panel, ambient locks, glossary, screener chips, email-first paywall, annual-first pricing), then beat them on the three things they structurally can't fix: (1) **transparency** — PIQ publishes methodology, A/B/C/F confidence, and validation backtests vs their unaudited self-graded claims; (2) **neutrality** — "the score, not the story": state-relative 1-99 highlights winners AND losers symmetrically, the natural landing spot for doom-fatigued churners; (3) **depth below market level** — deal analyzer + AI insights + MCP, three product surfaces Reventure has zero answer for. Do NOT copy the undismissable wall or the no-refund policy.

### 2.3 Mashvisor — the distressed incumbent (capture its refugees)

**What they nail:** The signature STR-vs-LTR side-by-side comparison (cash-on-cash, cap rate, occupancy, rental income for both strategies on one property view) — the single reason investors pick it. Mashmeter neighborhood composite score + investment heatmaps (directly analogous to PIQ's map+score). Return-metric property search (filter by cap rate/CoC, not just beds/price). STR regulation database for 500+ cities in the cheapest tier.

**What users hate:** Data accuracy collapses outside major metros ("so wrong so frequently that the whole platform is pointless"); no confidence or methodology disclosure; billing/cancellation traps (no refunds post-renewal, cancellations that "fail to register," BBB wrongful-charge complaints); unresponsive support; missing Vrbo data weakens STR estimates vs AirDNA.

**Pricing:** Lite $49.99 / Standard $74.99 / Pro $99.99/mo (annual) — but promo prices (~$17.99) are the real price; constant discounting and lifetime deals on StackSocial signal distress. ~21 employees, ~$1M raised, website traffic down ~74%.

**The PIQ counter-move:** Mashvisor is collapsing and shedding subscribers who still need its core jobs. (1) Add an STR revenue lane next to the analyzer's LTR outputs with an AI verdict on which strategy wins — leapfrogs their static table. (2) Ship a "find markets matching my criteria" screener over score+metrics (their Property Finder analog, but at PIQ's geo strength, no property-level ML needed). (3) Run a "Mashvisor alternative" comparison page leading with billing trust + confidence grades + a $20-40 price point that undercuts their real Lite price. (4) STR regulation flags in reports and as an MCP tool is cheap, sticky reference data.

### 2.4 PropStream — don't compete; be the step before it

**What they nail:** Breadth — 160M properties, 165+ filters, 20 named pre-made lead lists (Tired Landlords, Zombie Properties, High Equity) that users think in; Instant Comparables + unique Flip Comps (bought+sold within 24 months); daily-refreshing Lead Automator saved searches (the retention engine); 2025-2026 "PropStream Intelligence" AI push (foreclosure-risk scoring, photo-condition AI, an AI assistant chat anchored to the Property Details page). Owned by Stewart Title; acquired BatchLeads/BatchDialer in 2025.

**What users hate:** Sticker $99 balloons to ~$278-$350/mo real TCO (skip tracing, List Automator, seats, postage) — $5.35/qualified-lead vs DealMachine's $3.17; county-record data lags weeks; ~70-75% skip-trace match rates; BBB billing horror stories ($972 annual held hostage over a $27 chargeback); overwhelming for beginners; no CRM — "research tool, not a deal-flow engine."

**Pricing:** Essentials $99 / Pro $199 / Elite $699 monthly; tiers gate volume, not data. 7-day trial.

**The PIQ counter-move:** PropStream conflates WHERE to invest (its weakest half — stale county data, no geography scoring) with WHO to mail (its moat — skip tracing, PII, marketing). PIQ should own step zero and never touch lead-gen: (1) Named MARKET lists ("Undervalued ZIPs in TX," "Cooling-fast metros," "High-score low-supply counties") — the list-name mental model with zero PII liability, queryable via MCP. (2) Area-level flip analytics (resale velocity, price spread, DOM trend per ZIP/county) answering "is this a flip market?" without parcel data. (3) Watchlist alerts ("notify me when any TX metro crosses score 70") — the Lead Automator habit loop, leveraging the existing briefings subsystem. (4) Position as the market-intelligence layer investors keep alongside PropStream at a fraction of the cost.

### 2.5 DealCheck — the UX bar for the analyzer

**What they nail:** Address → full underwrite in under a minute via property import (taxes, insurance estimate, HOA, rent/value estimates, sale history, photos); a step-by-step wizard with inline educational tabs; 6 deal types; 35-year projections with per-year tunable assumptions; the Purchase Offer Calculator (reverse-solves max offer from 12+ target criteria); no-login interactive shareable report links with Pro branding (agents reuse them in marketing packages); property templates; a genuinely usable free tier capped by saved-deal COUNT (15) rather than stripped features — which earns 4.7 app-store ratings and goodwill.

**What users hate:** Stale comps/infrequent refresh; ZERO market-level intelligence ("is this ZIP a good market?" unanswerable); untrusted auto-filled estimates users must hand-correct; no integrations/API/AI; no portfolio tracking; dated iOS UI.

**Pricing:** Free forever (15 properties). Plus $14/mo ($10 annual). Pro $29/mo ($20 annual). 14-day trial. The price band investors actually accept.

**The PIQ counter-move:** Match the import-prefill speed, then beat it with what DealCheck structurally lacks: (1) every prefilled field stamped with source + freshness + confidence (attacks their stale-data complaint directly); (2) the deal verdict fused with market context — "this deal cash-flows AND sits in a 78-score ZIP" is the head-to-head positioning line; (3) the Purchase Offer Calculator, but with target assumptions seeded from actual local historicals and AI justification; (4) analyzer-as-MCP-tool — underwrite an address from Claude and get a share-link report back, a moat DealCheck cannot build; (5) copy the free-by-count tier ladder and the no-login share links exactly.

---

## 3. Feature-Gap Matrix

Capabilities investors expect, across the set. PIQ-today is marked honestly per the audit: signup funnel broken, SEO pages don't convert, MCP adoption near zero.

| Capability                                    | BP                            | Reventure                            | Mashvisor                             | PropStream                         | DealCheck                       | PIQ today                                                         |
| --------------------------------------------- | ----------------------------- | ------------------------------------ | ------------------------------------- | ---------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| Interactive market map (choropleth)           | partial (MSA-only, stale)     | yes                                  | partial (heatmaps)                    | no                                 | no                              | **yes**                                                           |
| ZIP/county granularity                        | no                            | yes                                  | partial (ZIP/nbhd, thin markets weak) | yes (parcel)                       | no                              | **yes**                                                           |
| Proprietary market score                      | no (editorial Top 25)         | yes (Forecast Score)                 | yes (Mashmeter)                       | partial (property-level AI scores) | no                              | **yes** (PIQ Score 1-99)                                          |
| Score/forecast methodology transparency       | no                            | no (5 inputs, no weights)            | no                                    | no                                 | n/a                             | **partial** (documented formula; not surfaced as marketing)       |
| Confidence / data-quality indicator           | partial (rent estimator only) | no                                   | no                                    | no                                 | no                              | **yes** (A/B/C/F) — undersold                                     |
| Published accuracy track record               | no                            | partial (self-graded blog)           | no                                    | no                                 | n/a                             | **no** (internal validation exists; nothing public)               |
| Data provenance + freshness shown in UI       | no ("June 2024" stale stamp)  | yes (source + next-update line)      | no                                    | no                                 | no                              | **partial** (resolution layer exists; not consistently surfaced)  |
| Deal analyzer (rental/cash-flow)              | yes (manual entry)            | partial (Listing Analyser, premium)  | yes                                   | partial (calculators)              | yes (best-in-class)             | **yes** (+ AI insights)                                           |
| Address auto-prefill of deal inputs           | no                            | partial                              | yes                                   | yes                                | yes                             | **no**                                                            |
| Multi-strategy analysis (BRRRR/flip/STR)      | yes (separate calculators)    | no                                   | partial (STR+LTR)                     | partial                            | yes (6 types)                   | **no** (single-strategy)                                          |
| STR vs LTR side-by-side                       | no                            | no                                   | yes (signature)                       | no                                 | partial                         | **no**                                                            |
| Reverse max-offer calculator                  | no                            | no                                   | no                                    | no                                 | yes                             | **no**                                                            |
| Market screener (filter/rank all geos)        | partial (Pro, MSA, stale)     | yes (chips + sliders + ranked table) | yes (Market Finder)                   | partial (property filters)         | no                              | **no** (map only; no cross-region ranked table)                   |
| Historical time-travel map / long time series | no                            | yes (25yr + date picker)             | partial                               | no                                 | no                              | **partial** (time-series API exists; no map date picker)          |
| Seasonality (best month to buy/sell)          | no                            | yes                                  | no                                    | no                                 | no                              | **no** (computable from existing Redfin history)                  |
| Overvaluation / fair-value metrics            | no                            | yes (most-cited premium metric)      | no                                    | no                                 | no                              | **no** (computable: Census income + ZHVI/ZORI)                    |
| AI-generated market reports/narratives        | no                            | no                                   | no                                    | no                                 | no                              | **yes** — unique                                                  |
| AI assistant / conversational access          | no                            | no                                   | no                                    | partial (property-page chat)       | no                              | **partial** (MCP server built; ~zero adoption)                    |
| MCP / AI-agent integration                    | no                            | no                                   | no                                    | no                                 | no                              | **yes (built) / no (adopted)**                                    |
| Embeds / shareable widgets                    | no                            | partial (share button)               | no                                    | no                                 | yes (report links)              | **yes** (embeds exist; distribution near zero)                    |
| Shareable branded PDF/link deal reports       | yes (loved)                   | partial (5 downloads/mo)             | yes (Pro)                             | no                                 | yes (no-login links + branding) | **partial** (reports exist; no no-login share, no agent branding) |
| Off-market / owner lead-gen                   | partial (Pro tool)            | no                                   | partial                               | yes (the moat)                     | partial (owner lookup)          | **no** (deliberate non-goal)                                      |
| Saved searches / watchlist alerts             | no                            | no                                   | no                                    | yes (Lead Automator)               | no                              | **partial** (watchlist lib exists; no score-threshold alerts)     |
| Community / forums                            | yes (the moat)                | no                                   | no                                    | no                                 | no                              | **no** (don't copy)                                               |
| Working signup → activation funnel            | yes (ruthless)                | yes (email-first modal)              | yes                                   | yes                                | yes                             | **no — BROKEN (11 starts / 0 completes per audit)**               |
| SEO traffic converted to accounts             | yes (inline forum forms)      | yes (locked-metric modal)            | partial                               | partial                            | partial                         | **no (94% of traffic, ~zero capture)**                            |
| Free tier that's genuinely usable             | partial (5-report cap)        | partial (3-8 metrics)                | no                                    | no (trial only)                    | yes                             | **yes** (map is free) — but no capture on top of it               |
| Mobile apps                                   | partial (web-first)           | yes (4.8★ iOS+Android)               | partial                               | yes (D4D app)                      | yes (4.7★)                      | **no**                                                            |
| Transparent, refund-friendly billing          | no                            | no                                   | no                                    | no                                 | yes (mostly)                    | **opportunity** (Stripe; no public promise yet)                   |

**Read of the matrix:** PIQ already holds the rarest squares (score + confidence + AI reports + MCP + map granularity) and fails the most basic ones (funnel, capture, prefill, screener). The gap between PIQ's assets and PIQ's conversion machinery is the whole story.

---

## 4. Unmet Needs — The White Space PIQ Can Own

1. **The market→deal bridge.** The #1 structural gap. Out-of-state investors cobble together 4+ subscriptions because nobody connects "rank markets" to "underwrite a property there" in one flow. PIQ owns both ends today; no competitor owns either end as well at both levels.
2. **Verifiable accuracy.** Every BP thread on every score/forecast asks "is it accurate?" and no vendor answers with auditable evidence at the geography investors buy in. Reventure's self-graded blog post is the high-water mark — and it's marking its own homework. A public, per-geo-level backtest page (IC, hit rate, vs naive baselines) is unanswered white space PIQ's validation pipeline already produces internally.
3. **Honest uncertainty.** Chronic complaint across the set: small-ZIP volatility and stale comps rendered as confident numbers with zero warning. "We tell you when NOT to trust the number" (A/B/C/F grades + source + as-of date on every value) is a trust feature no incumbent ships because opacity protects their pricing.
4. **The "where does it still pencil" question.** 2026 discourse is dominated by deals not penciling at current rates; demand shifted to Midwest/Northeast cash-flow markets. Investors want a rate-aware shortlist (rent-to-price clearing today's mortgage rates), not another calculator. Computable from PIQ's existing metrics; a recurring monthly content + product hook.
5. **AI-native access to live market data.** RE pros adopted AI assistants (43% already), buyers start research in AI tools (67%), MCP became the rail — but firms "lack the infrastructure" to connect AI to actual market data. PIQ's MCP server is nearly alone in the consumer-investor segment. The need is productization (recipes, "ask Claude about any of 19,880 ZIPs," GEO-optimized pages AI engines cite), not engineering.
6. **Neutral data without a doom narrative.** Reventure's audience is plateauing as the predicted crash keeps not arriving; churned doom-fatigued subscribers want the map and the numbers minus the thesis. "The score, not the story" is a vacant position.
7. **Fair billing as a feature.** Four of five competitors have BBB/Trustpilot billing scandals. One-click cancel + renewal reminders + prorated refunds + a public no-dark-patterns promise is nearly free to implement on Stripe and shows up in every "X alternative" search.
8. **The $20-40 price band with real depth.** Willingness-to-pay clusters at $20-40/mo for analytics ($99+ requires direct deal-flow ROI). Reventure charges $39 for market data only; Mashvisor's real price is ~$18 for unreliable data; DealCheck charges $10-20 for deal math only. Market data + score + analyzer + AI in one $20-40 tier is an open lane.

---

## 5. Adoption Playbook — Prioritized (Impact Order)

> Ordering logic: nothing matters until the funnel converts (the audit's broken-signup finding gates everything); then mechanics that monetize existing traffic; then product gaps; then distribution plays.

### P1. Reventure-style two-step capture on the map + inline capture on SEO pages (FIX THE FUNNEL)

**Evidence:** Verified live — Reventure converts anonymous map curiosity by firing a one-field "Sign up for a Free Account" (Google OAuth or email) modal when a locked metric is clicked; payment pitch comes only after login. BP embeds literal inline signup forms inside forum-thread SEO pages — capture without blocking reading — and walls calculator OUTPUT after free INPUT. Both treat email capture and payment as separate walls.
**PIQ angle:** The audit says 11 signup starts / 0 completes and 94% of traffic lands on programmatic SEO pages with ~zero capture. Repair the signup chain end-to-end (E2E-test it against the real flow), then: lock 2-3 hero items on the map (ZIP-level PIQ Score history, AI verdict) behind a one-field Google/email modal; embed an inline "Get monthly score updates for {metro}" block with role+metro segmentation in every SEO market page (Reventure's newsletter capture pattern). This is the multiplier on every other item below.

### P2. The region detail panel: score gauge + provenance line + 25-year chart + locked-component breakdown

**Evidence:** Reventure's best surface (verified live): click a ZIP → breadcrumbs, "Source: Zillow · Data: Apr. 2026 · Next Update: Mid-Jun," score gauge, Best Month to Buy/Sell chips, 25-year value chart with peak callouts, score component names visible even when values are locked. App-store reviews single this out; it makes one click feel like a market report.
**PIQ angle:** Pure composition of existing pieces — ScoreWidget + fetchTimeSeriesData + MetricResolutionService provenance — into one click-through panel on /map. Beat Reventure by adding what they can't: the A/B/C/F confidence badge and source-fallback transparency, plus the PropertyIQ Score's named input breakdown (% Sold Above List, Median DOM, Months of Supply) always visible. Render locked values blurred server-side/redacted — Reventure leaks theirs in the DOM.

### P3. Address-to-prefilled deal analyzer ("2-minute analysis, zero spreadsheet")

**Evidence:** BP's #1 product weakness — ~30 min of manual entry per property, no auto-fill, and competitors market against it. DealCheck's single most-cited feature is address→import (taxes, insurance, HOA, rent estimate); its top complaint is that those estimates are stale and untrusted.
**PIQ angle:** Prefill rent, taxes, vacancy, appreciation from PIQ's own metric layer by ZIP/address — and stamp every prefilled field with source + as-of date + confidence grade, attacking BP's blank form and DealCheck's untrusted defaults simultaneously. AI insights flag when a user's override diverges sharply from market data (the cross-cutting "silently corrupted deal math" complaint).

### P4. Market screener: preset chips + range sliders + ranked exportable table

**Evidence:** Verified live on Reventure — quick-filter chips (Cheapest, Most Overvalued, High Income), 9 metric sliders, and a sortable ranked table over 917 metros are free-visible and heavily used; this is the "find my market" workflow Mashvisor charges $75/mo for and BP gates behind Pro on two-year-old MSA data. Market-selection overwhelm is the #1 unmet job-to-be-done for out-of-state investors.
**PIQ angle:** PIQ has the map but no cross-region ranked view — a natural `queryLatestPerRegion` table over Score + metrics with chips like "Hottest Markets," "Undervalued + High Score," "Cash-flows at today's rates" (the rate-aware rent-to-price screener nobody ships). Gate CSV export and ZIP-level depth behind tiers; expose the same presets as MCP tools.

### P5. Public accuracy report card + visible confidence everywhere (the trust stack)

**Evidence:** Reventure's "#1 housing forecast of 2025" self-graded post is its most persuasive conversion asset and earns press; BP's "hand selected by experts" picks and stale stamps are its most-mocked data weakness; Mashvisor/PropStream publish no accuracy or confidence disclosure at all; investors' recurring question across all forums is "is it accurate?"
**PIQ angle:** PIQ already runs monthly validation backtests (piq-validation-report) and ships A/B/C/F grades. Publish a public "PropertyIQ Score Report Card" (IC/correlation vs naive baselines, per geography level, methodology page) and surface confidence + "Source: Redfin · as of {date} · next update {date}" on every metric and analyzer assumption. Position: "the only housing score that tells you when NOT to trust it." Honest caveat per memory: only claim what the validation pipeline actually supports.

### P6. Productize the MCP server + map-screenshot sharing as the AI-era distribution loop

**Evidence:** MCP: 10,000+ servers, 97M SDK downloads, OpenAI and Google adopted it, CRE blogs teach Claude+MCP market-report workflows, 67% of buyers start research in AI tools — and zero of the five competitors has any AI-assistant surface. Separately, Reventure's entire 200K-user funnel is watermarked map screenshots attached to one stat ("the map IS the ad").
**PIQ angle:** Adoption is near zero today, so treat this as packaging + distribution, not engineering: publish recipes ("automated market report in Claude," "underwrite an address from chat"), named MCP presets ("top 10 undervalued metros in TX"), GEO-optimize SEO pages for AI citation, and add one-click watermarked "Share this map" exports with auto-generated headline stats. Each embed and MCP install is a compounding distribution node a media company can't match.

### P7. No-login shareable branded reports (the agent-side viral artifact)

**Evidence:** BP's PDF deal reports are its most-praised tool feature (lender/partner-shareable); DealCheck's no-login interactive report links with Pro-tier logo/colors are its strongest upgrade trigger — agents reuse them in client marketing packages; Mashvisor monetizes realtors the same way at its Pro tier.
**PIQ angle:** PIQ already generates AI market reports and analyzer outputs. Add per-deal/per-market share links viewable without an account (each one a branded acquisition surface), gate logo/contact/custom branding behind a paid tier. Serves the realtor-second audience, leverages report depth no competitor matches, and every shared report markets PIQ.

### P8. Pricing architecture: $20-40 tier, annual-first framing, dollar-anchored value, generous free-by-count, clean billing

**Evidence:** Willingness-to-pay clusters at $20-40/mo. Reventure displays $399/yr as "$33/month SAVE 15%" with monthly as the decoy and converts at $39 for market data alone; BP anchors $390 against $3,860+ of quantified perks; DealCheck's free-by-saved-count ladder (15/50/unlimited) earns 4.7★ goodwill while converting power users; and ALL of BP/Reventure/Mashvisor/PropStream carry billing-scandal baggage (BBB complaints, no-refund terms).
**PIQ angle:** Price the investor tier at $19-29/mo (undercuts Reventure $39, Mashvisor's real $49.99, BP's $32.50) with annual-first display and dollar-quantified anchors ("unlimited AI market reports — $X value"); cap free users by analyzer-save count rather than stripping features; and make "cancel in one click, renewal reminders, prorated refunds" a published promise that headlines every "X alternative" comparison page.

**Fast-follow bench (high value, lower urgency):** Best Month to Buy/Sell seasonality chips (trivial from Redfin history; ship FREE as a wedge against Reventure's paywall) · Overvaluation % / fair-value metrics (Census income + ZHVI/ZORI, already in the pipeline) · historical date-picker for the map · STR-vs-LTR lane in the analyzer (Mashvisor-refugee capture) · watchlist score-threshold alerts (briefings subsystem) · named market lists ("Undervalued ZIPs in TX") · monthly auto-generated "PIQ Market Pulse" content drop + press stat packages (the ResiClub loop, no personality required) · 2-3 dollar-anchored partner perks (DSCR lender credit, landlord insurance).

---

## 6. What NOT to Copy (and Why)

1. **BP's undismissable contact-ransom modal and Pro-walled calculator results.** The sunk-cost physics work, but the resentment is documented (BBB 2.4/5, "ransom UX"). PIQ's version gates at FREE signup with a dismissible wall and blurred preview — same conversion mechanic, none of the brand damage, and it's a marketing wedge against BP.
2. **Reventure's hard anonymous wall on the map.** Their map is now fully blocked pre-signup; PIQ's free map is the top-of-funnel hook and the SEO-page payload. Lock the premium layer, never the front door — especially while AI engines and Google are deciding whether PIQ pages are worth citing.
3. **The doom-narrative / single-personality growth engine.** It built Reventure fast and is now its ceiling: flatlined subscribers, credibility discounting, total key-man risk (the business pauses when Nick pauses). Brand the score and the map, not a face; PIQ's automated content pipeline is the scalable substitute.
4. **Lead-gen marketplaces that sell unvetted contacts (BP Agent Finder, PropStream skip tracing).** Both sides of BP's marketplace complain (95% beginner leads, ~5 agents per lead, "overcharge ripoff" reviews); skip tracing drags in PII liability, TCPA/DNC exposure, and a wholly different ops burden. If PIQ ever monetizes the agent side, it must be vetting-by-data (agents ranked by verified market coverage), not pay-to-play — and not before the core funnel works.
5. **Billing dark patterns: all-sales-final, post-cancel charges, monthly-price penalties, hidden add-on stacks.** Every competitor's loudest Trustpilot/BBB complaints. These extract short-term revenue and create the churn + "X alternative" search demand PIQ should be harvesting, not generating.
6. **Building community/forums or a media organization.** BP's moat took 20 years, books, and a podcast network; it requires headcount PIQ doesn't have and decays into AI-spam moderation problems (BP now has an explicit report-AI-content rule). PIQ's substitute is data-derived content (Market Pulse, accuracy reports, anomaly alerts) that compounds without moderators.
7. **Property/owner-level data depth (PropStream's 160M parcels).** County-record licensing, weeks-stale data, and a $99-$699 price ladder PIQ's audience won't pay. PIQ wins as the market-intelligence layer ABOVE the parcel layer — step zero, not a worse PropStream.
8. **Mashvisor's discount spiral (lifetime deals, perpetual promo pricing).** StackSocial lifetime deals and ~$18 effective pricing on a $50 list price trained customers never to pay list and signaled distress. Hold one honest price; compete on trust and depth, not coupon theater.
9. **CSS-only paywall blur.** Reventure's locked values (Best Month to Buy = SEPTEMBER) sit readable in the DOM. Any gated value PIQ renders must be redacted server-side — leaky gating is both lost revenue and a credibility embarrassment when (not if) someone blogs it.
10. **Pricing-copy drift.** BP advertises "Save 16%" and "Save 18%" for the same plan on different surfaces, and Reventure runs $39/$49 SKUs simultaneously. Single source of truth for pricing copy; small sloppiness reads as untrustworthiness in a category where billing trust is the differentiator PIQ is claiming.
