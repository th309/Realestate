# PropertyIQ Improvement Backlog — 2026-06-10

Source: Investor-competitor deep dive + live audits (first-visit, signup-pricing, map, markets-seo, analyzer-reports, mobile, scores-trust, mcp, growth, ia-design). All 30 verdicts validated; priority order preserved.

**Team convention:** Every item's acceptance criteria includes E2E verification against real data (live DB, real pages in a browser — no mocks). See `feedback_no-mock-tests-use-live-data` and `feedback_plans-must-include-e2e-tests`.

---

## NOW (Top 8 — conversion funnel + flagship wiring)

### 1. Repair the signup chain end-to-end so every CTA reaches a working account creation

**Effort: medium** | Impact: transformative | Audience: all | Evidence: 11 signup starts / 0 completes in 30d

- [ ] Replace the silent ToS-disable on Create Account/Google buttons with enabled-by-default buttons + inline ToS validation error (`packages/frontend/app/sign-up/page.tsx`, disable logic at lines ~382/404)
- [ ] Route pricing "Get Pro Access" for anonymous users to sign-UP, not sign-in (`packages/frontend/app/pricing/page.tsx` line ~138)
- [ ] Replace anonymous "Current Plan" on the Free tier card with a "Sign up free" CTA
- [ ] Add a signup link/CTA to the anonymous report-builder dead-end (coordinate with item 8)
- [ ] Surface OAuth email-confirmation state clearly post-Google-auth (`packages/frontend/app/auth/callback/page.tsx` — oauth tracking exists at lines ~187-189; add user-facing messaging)
- [ ] Reconcile with the existing activation-funnel remediation plan (`docs/superpowers/specs/2026-04-14-activation-funnel-initiative.md`) — close out overlapping tasks, don't duplicate
- [ ] Add funnel instrumentation assertions: `signup_start` → `signup_complete` events fire into `user_events` (NOT `analytics_events`)

**Acceptance criteria:**

- E2E (Playwright, live site/dev against real DB): a fresh anonymous user completes email signup AND Google OAuth signup from (a) homepage, (b) pricing page, (c) report-builder dead-end — account row appears in Supabase `auth.users` + profile created
- ToS unchecked → clicking Create Account shows inline error, button never silently disabled
- Pricing "Get Pro Access" anonymous click lands on sign-up page
- `signup_complete` events visible in `user_events` table after the E2E run

---

### 2. Replace the undismissable 5-page wall with Reventure-style two-step capture

**Effort: small (UI) → hard overall** | Impact: transformative | Audience: all

- [ ] Add X button, Escape-key handler, and backdrop-tap dismiss to `AnonPaywallOverlay` (currently non-dismissible by design — line 8 of the component)
- [ ] Refactor /map gating from full-page container wall to feature-level locks: free map stays open, clicking a locked premium item opens the modal
- [ ] Convert the capture modal to a one-field Google/email two-step (capture first, payment pitch only after login) — reuse `FreeUserUpgradeModal` dismiss patterns
- [ ] Add inline "Get monthly score updates for {metro}" capture blocks on SEO market pages
- [ ] Implement server-side redaction for gated values (blurred preview rendered from redacted server data, not client CSS blur) — coordinate with item 19
- [ ] Verify crawlability: googlebot/GPTBot/ClaudeBot can reach /map and /markets content without hitting the wall

**Acceptance criteria:**

- E2E on live pages: anonymous user browses 10+ pages on /map and /markets without any undismissable overlay; Escape, X, and backdrop-tap all close the capture modal
- Clicking a locked premium metric opens the one-field capture modal; submitting creates a captured lead/account in the real DB
- View-source / fetch of a gated page shows NO real gated values in the DOM (server-redacted)
- 94%-traffic SEO pages render full public content to curl with no JS

---

### 3. Wire the market-to-deal bridge: every market view ends in "Analyze a property here"

**Effort: small** | Impact: transformative | Audience: investors | White space — no competitor owns both WHERE and WHAT

- [ ] Consume the `?piq_market=level:id` param in `AnalyzerClient` — currently accepted but NOT consumed; pre-load that geo's Market Context on analyzer open
- [ ] Add "Analyze a property in {market}" button to map detail panels (`RightDetailPanel.tsx`)
- [ ] Add `AnalyzeCTA` (already deployed on metro/county/zip pages) to state pages, blog pages, and compare pages
- [ ] Add "Get the full AI report" CTA inside the analyzer, preselecting the originating market
- [ ] Preselect the originating market in report, signup, and dashboard CTAs (carry `piq_market` through the funnel)

**Acceptance criteria:**

- E2E with real data: from a live metro page (e.g., Austin), click Analyze CTA → analyzer opens with Austin Market Context panel populated from real metric data (not zeros)
- Map detail panel → Analyze → same behavior at county and ZIP levels
- Analyzer → "Get full AI report" → report builder has the market preselected
- No regression on existing AnalyzeCTA pages (metro/county/zip) — spot-check 3 live URLs

---

### 4. Put real, citable market data on the 94%-traffic SEO pages (GEO play)

**Effort: medium** | Impact: transformative | Audience: all

- [ ] Build a server-rendered stats block component: median price, DOM, months of supply, rent, YoY deltas, 12-month sparkline — sourced via `MetricResolutionService` / existing data layer (data confirmed present in `zillow_*`/Realtor/Census tables)
- [ ] Deploy stats block on every `/markets/[slug]`, `/county/[slug]`, `/zip/[slug]` page
- [ ] Add ranked top-10 tables on state pages (backend `queryLatestPerRegion` + rankings API already support this)
- [ ] Add "Data through {month} · Source: Redfin/Zillow" freshness/attribution labels on every stat
- [ ] Fix the 404ing AI-insights endpoint (graceful fallback when generation fails) and the "Bastrop County, TX, TX" double-state-suffix bug
- [ ] Replace alphabetical related-market links with relevance-based (same state / similar score / nearby)
- [ ] Add role-segmented inline capture blocks (investor vs homebuyer vs agent)

**Acceptance criteria:**

- E2E: curl (no JS) of 5 real metro, 3 county, 3 ZIP pages returns the stats block with real numbers matching direct DB queries for those regions
- Zero "TX, TX"-style name bugs across a scripted sweep of all state-suffix slugs
- AI-insights endpoint returns 200 or a designed fallback on 20 sampled real slugs — no 404s
- Structured data (schema.org) validates for the stats block; freshness label shows the actual latest `period_date` from the DB

---

### 5. Market-prefilled deal analyzer with source, as-of date, and confidence on every field

**Effort: medium** | Impact: transformative | Audience: investors

- [ ] Prefill rent, taxes, vacancy, appreciation, insurance from the metric layer by ZIP/address via `MetricResolutionService` (`packages/backend/src/metric-resolution/`) — market context API already returns home_value/rent_index with source metadata; currently fetched but unused for prefill
- [ ] Consume the RentCast property-tax history the frontend currently ignores
- [ ] Stamp each prefilled field with source + as-of date + A/B/C/F confidence grade (build grade mapping from data freshness/coverage; reuse confidence utilities from `app/components/scoring/`)
- [ ] Flag user overrides that diverge sharply (e.g., >30%) from market data with a non-blocking warning
- [ ] Rebuild `analyzer-core` after any src export change (`npm run build` — frontend consumes dist/, per project lesson)
- [ ] Add "2-minute analysis, zero spreadsheet" messaging at the analyzer entry point

**Acceptance criteria:**

- E2E with real data: enter a real ZIP (e.g., 78702) → rent/tax/insurance/vacancy fields prefill with non-null values that match the metric layer's live values for that geo; each shows source + as-of + grade
- Override a prefilled rent by 2x → divergence flag renders
- Anonymous + free + Pro tiers all verified in a live browser; analyzer page renders (no analyzer-core dist crash)
- Prefill values match a direct `resolveMetricBatch` call for the same geo

---

### 6. Ship the market screener: preset chips, sliders, and a ranked table over all geos

**Effort: medium** | Impact: transformative | Audience: investors

- [ ] Build `/screener` page: sortable, paginated table over PropertyIQ Score + key metrics across 23,613 geos (746 metros / 2,983 counties / 19,880 ZIPs) — backend `queryLatestPerRegion` + rankings API already exist
- [ ] Implement preset chips: "Hottest Markets", "Undervalued + High Score", "Cash-flows at today's rates" (rate-aware preset — nobody in the category ships this)
- [ ] Add metric range sliders (score, price, rent, DOM, supply) with URL-serialized state so presets are linkable SEO landing pages
- [ ] Free-visible table (Reventure pattern); gate CSV export and ZIP-level depth by tier via existing entitlements
- [ ] Expose presets as MCP tools (extend existing ranking tools in `packages/mcp-server`)
- [ ] All data fetching through `@/lib/data` fetchers — add a screener fetcher to `lib/data/fetchers/`, export from `lib/data/index.ts`

**Acceptance criteria:**

- E2E: anonymous user loads /screener, applies "Hottest Markets" chip → ranked table renders real scores matching the live rankings API; sort by each column verified
- "Cash-flows at today's rates" preset returns a non-empty, plausible ranked list from real data
- Free user: CSV export blocked with priced upsell; Pro user: CSV downloads and row values match the on-screen table
- Preset URL is shareable: pasting it into a fresh incognito session reproduces the filtered table

---

### 7. Open an MCP trial path: free sandbox API keys with a metered call quota

**Effort: medium** | Impact: transformative | Audience: realtors | White space — no competitor has an AI-assistant surface

- [ ] Extend entitlements so any verified account can generate an MCP key scoped to ~50 tool calls/month (currently `feature:mcp_access` is Pro+ only)
- [ ] Implement quota tracking + enforcement per key (does not exist today — only OAuth access control); return a friendly quota-exceeded message with upgrade CTA
- [ ] Optionally add a 24-hour guest key limited to demo markets
- [ ] Upsell to Pro on quota exhaustion (in-tool message + email)
- [ ] Track trial-cohort usage (depends on item 27's `mcp_tool_executions` instrumentation — sequence after or alongside)
- [ ] Respect both MCP caches (backend Redis tier-keyed + mcp-server in-process userId-keyed) when entitlements change — use the existing `/internal/entitlements/invalidate` endpoint

**Acceptance criteria:**

- E2E against live MCP server: create a fresh free account → generate key → make a real tool call from Claude Desktop/MCP client → real data returned
- Exhaust the quota (scripted 50+ calls) → call 51 returns the quota message with upgrade path, not a raw error
- Upgrading the test account to Pro lifts the quota within the 30s cache-TTL window
- Trial key usage rows visible in the real DB

---

### 8. Turn the anonymous report dead-end into the top of the funnel

**Effort: small** | Impact: high | Audience: investors

- [ ] Replace the "You must be signed in" dead-end (reports `page.tsx` line ~599) with a real generated preview: first section visible, rest blurred
- [ ] Add inline one-field signup to unlock (reuse `InlineSignupForm` from the tour; gate with `EntitlementGate`/`PaywallCard`)
- [ ] Apply the same gate to the analyzer AI verdict (analyzer already has `FreePreviewMiddleware` 3-free-analyses cookie pattern — mirror it; note middleware can't read `req.user`, per project lesson)
- [ ] Ensure the blurred portion is server-redacted, not CSS-only blur
- [ ] Track `report_preview_view` → `signup_from_report` conversion events

**Acceptance criteria:**

- E2E: anonymous user completes the full report-builder flow with a real market → sees a real first section with live data + blurred remainder + inline signup; NO dead-end message anywhere in the flow
- Signing up inline immediately unlocks the full report for that same session
- DOM inspection of the preview shows no real gated content behind the blur
- Conversion events land in `user_events`

---

## NEXT (Items 9–20 — trust, polish, monetization surfaces)

### 9. Never show the score naked: scale explainer, confidence legend, and default-journey presence

**Effort: small** | Impact: high | Audience: all

- [ ] Attach a first-exposure explainer to `ScoreWidget` (`app/components/scoring/`): "1–99, relative to state average; 50 = average" (copy exists on /scores FAQ — surface it on the widget)
- [ ] Unhide the A/B/C/F confidence legend (exists in code, hidden by default) and render it wherever a grade shows
- [ ] Add a methodology link from every ScoreWidget render
- [ ] Make PropertyIQ Score the default map metric (or a prominent toggle) — default is currently `home_value` at state level where scores don't exist; do NOT hardcode, change the default in `packages/frontend/app/map/config/metrics.ts` flow
- [ ] Kill the impossible "Score 100" row/copy (max is 99)

**Acceptance criteria:**

- E2E live: fresh anonymous /map load shows the score (or its toggle) in the default journey at a score-supported geo level; clicking a region shows score + explainer + legend + methodology link
- Sweep of SEO pages: no naked "25 F POOR" without explainer; grep confirms zero "Score 100" strings in rendered output
- Real score values on widgets match `fetchScore` API responses

### 10. Fix /scores/accuracy via one shared validation-constants module, then publish the Score Report Card

**Effort: small–moderate** | Impact: high | Audience: investors

- [ ] Create ONE constants module (extend `validation-claims.ts` as the single source) holding IC, hit rates, coverage, dollar impact, backtest years — reconcile the contradictions: IC 0.37 (accuracy metadata) vs 0.23/0.24 (`validation-claims.ts`) vs 0.30/0.37 (`validation-credibility.ts`); metros 746 vs 924 (`ScoreCredibilityBadge.tsx`); $18,100 vs $24,384 (`V4_CLAIMS.scoreExtreme3YGap`)
- [ ] Refactor /scores, /scores/methodology, /scores/accuracy, homepage, and pricing to consume ONLY this module (currently each has hardcoded constants)
- [ ] Purge retired SHAP/XGBoost methodology references; v4.0 Demand Signal only
- [ ] Make the interactive backtest public + cached (currently AdminGuard-protected → 401s for every anonymous visitor under copy mocking competitors)
- [ ] Publish a per-geo-level Score Report Card page
- [ ] Use `/piq-validation-report` skill conventions for any regenerated numbers

**Acceptance criteria:**

- E2E live anonymous: /scores/accuracy backtest renders real cached data, zero 401s
- Scripted sweep: every IC/hit-rate/coverage/dollar number across the 5 surfaces is identical and traces to the constants module
- Numbers match the latest real validation report output

### 11. Purge retired HomeReady/InvestorEdge/Market Health from every live surface, with a CI guard

**Effort: small** | Impact: high | Audience: all

- [ ] Remove the three retired-score tiles from pricing's "See what Pro unlocks" (`FeatureShowcaseInsights.tsx` lines ~249-262)
- [ ] Sweep the metro SEO template "three scores" prose (4 instances in `generate-seo-content.ts`, rendered on ~935 pages)
- [ ] Fix the sample report header (`static-sample-report.ts` line ~37: "Your HomeReady Market Intelligence Brief")
- [ ] Sweep remaining instances of the ~35 found across frontend templates (per project lesson: delete, don't port)
- [ ] Add a CI grep step blocking `HomeReady|InvestorEdge|Market Health` in frontend templates (allowlist the legacy-explanation line in `definitions.ts` if intentionally kept)

**Acceptance criteria:**

- E2E live: pricing page, 5 real metro SEO pages, and the sample report render zero retired-score names
- CI guard demonstrably fails on a test commit reintroducing "HomeReady" in a template, passes on develop

### 12. Mobile conversion repair sprint: uncover the buttons, hit the tap targets

**Effort: small** | Impact: high | Audience: homebuyers

- [ ] Fix the score ticker covering the drawer Log in/Get Started buttons (z-index: sticky bar is z-50, `MobileMenu` has none)
- [ ] Make the homepage map widget Zip/County geo tabs reachable; raise `GeoLevelPills.tsx` (24px, `py-1.5`) and `Header.tsx` hamburger (40px, `p-2`) to ≥44px tap targets
- [ ] Fix the 11px horizontal wiggle (add `scrollbar-gutter` / overflow fix)
- [ ] Fix `StickyScoreBar` truncation to "See …" (`whitespace-nowrap` overflow)

**Acceptance criteria:**

- E2E via Playwright mobile viewport (390x844) on live pages: Log in / Get Started taps register and navigate (signup actually reachable on mobile); geo tabs tappable
- Automated tap-target audit: all interactive controls on home + map + market pages ≥44px
- No horizontal scroll/wiggle at 360px–430px widths; sticky bar value prop fully visible

### 13. Add a one-click demo deal and unlock free-tier sensitivity analysis

**Effort: small–moderate** | Impact: high | Audience: investors

- [ ] Add "Load demo deal" button: realistic price/rent/tax for a known metro, Market Context wired so the score appears
- [ ] Handle via query param (e.g., `?demo=1`) so it's linkable from marketing pages
- [ ] Exempt the demo from the anonymous `FreePreviewMiddleware` quota
- [ ] Confirm sensitivity analysis stays free (verified ungated today — add a regression check); keep only AI narratives Pro-gated
- [ ] Fix the onboarding instruction that points at a Pro-only feature and never dismisses

**Acceptance criteria:**

- E2E anonymous: click "Load demo deal" → full populated analysis with real market context and score in <5s, no quota consumed, sensitivity sliders work
- Free account: grade letter + metrics + working sensitivity; only AI verdict locked with clear upsell

### 14. Kill the 3-minute /tour; land new users in the product with value in 30 seconds

**Effort: small–moderate** | Impact: high | Audience: all

- [ ] Implement the `next` redirect param (TODO comment confirms unimplemented): post-signup, return users to the market/map they came from with URL state preserved, score panel open
- [ ] Replace the 4-step tour as default with a one-chip-row inline persona ask
- [ ] Fix the broken persona button labels (split() word-extraction bug producing "Continue as an →")
- [ ] Instrument `signup_complete` → `first_score_view` as THE activation event (score_view event already fires on mount — link them)
- [ ] Keep /tour available but opt-in

**Acceptance criteria:**

- E2E: start on a real metro page → sign up → land back on that metro with score panel open in one redirect; activation event pair visible in `user_events` for the test user
- Persona chips render correct labels for all personas

### 15. Make the sample report a flawless listing-presentation demo and market Agent Prep

**Effort: small–moderate** | Impact: high | Audience: realtors

- [ ] Fix the sample report self-contradictions from one data pull (3.1 homes listed vs 3.4 months supply; 26% price cuts vs +0.3%) — data is correct, UI presentation contradicts
- [ ] Build `/for-agents` page led by Agent Prep screenshots + the sample report (Agent Prep toggle, talking points, six objection handlers, competitive context all exist — reuse `ReportViewer` + template system)
- [ ] Add Agent Prep to marketing nav/homepage realtor section
- [ ] Invoke `frontend-design:frontend-design` skill for the new page per team convention

**Acceptance criteria:**

- E2E live: sample report numbers internally consistent and matching one real data pull; Agent Prep toggle works end-to-end
- /for-agents renders live, linked from nav, with working sample-report CTA into signup

### 16. Fix the MCP setup-guide auth bug and deep-link key generation

**Effort: small** | Impact: high | Audience: realtors

- [ ] Fix `SETUP_CONFIGS.claudeDesktop`: `Authorization:${PIQ_API_KEY}` → `Authorization: Bearer YOUR_PIQ_API_KEY` (missing "Bearer " — copy-paste fails silently against `auth-http.ts`)
- [ ] Accept both `Bearer <key>` and bare-key formats server-side in `auth-http.ts` (preserve exact behavior for existing valid configs per MCP refactor rule — characterization tests first)
- [ ] Add "Generate Key" CTA in the docs Setup tab deep-linking to `/account/api-keys?action=create`
- [ ] Implement the `action=create` param on the API-keys page to auto-open the creation form

**Acceptance criteria:**

- E2E: copy-paste the published Claude Desktop config verbatim with a real key → tool call succeeds against the live MCP server; bare-key format also authenticates
- Docs Setup tab → Generate Key → form auto-opens → key created in real DB → key works immediately

### 17. Build the Reventure-grade region detail panel as the map's conversion engine

**Effort: medium** | Impact: high | Audience: all

- [ ] Recompose `RightDetailPanel.tsx` as a mini market report: score gauge with the three named inputs (% Sold Above List `sale_to_list`, Median DOM `days_on_market`, Months of Supply), A/B/C/F badge (already in ScoreWidget)
- [ ] Add provenance line: "Source: Redfin · as of {month} · next update {date}" from real metric metadata
- [ ] Add long-run value chart via `fetchTimeSeriesData` (missing today)
- [ ] Add breadcrumb chips + Report/Analyzer CTAs (ties into item 3) + a locked premium row driving the item-2 capture modal
- [ ] Remove the "Double click to edit" debug text (line ~229; also in item 26)
- [ ] Extract the panel as a reusable composition for SEO pages; server-redact gated values (avoid Reventure's DOM leak)

**Acceptance criteria:**

- E2E live: click any metro/county/ZIP on /map → panel shows real score, three real named inputs, confidence badge, provenance with actual latest period_date, and a rendering time-series chart
- No debug strings; locked row opens the dismissible capture modal; gated values absent from DOM

### 18. Rebuild the pricing page: working CTAs, real prices everywhere, annual-first tier, fair-billing promise

**Effort: medium** | Impact: high | Audience: all

- [ ] Remove retired-score marketing (with item 11) and fix the broken Enterprise add-on card
- [ ] Anonymous visitors: working free-signup CTA; Pro CTA → sign-UP flow (with item 1), not sign-in
- [ ] Default the toggle to annual-first ("$X/mo, save 17%") with dollar-quantified value anchors; evaluate a $19-29/mo investor tier against current Free/$29 Pro/$149 Enterprise Stripe config
- [ ] State the actual price at every paywall lock site-wide (feed item 19's standardized component)
- [ ] Publish a fair-billing promise: one-click cancel, renewal reminders, prorated refunds — implement on Stripe + a public page; headline it on /compare pages
- [ ] Use `stripe:stripe-best-practices` for any Stripe changes

**Acceptance criteria:**

- E2E: anonymous → pricing → free signup completes; Pro purchase completes in Stripe test mode end-to-end with annual default
- Sweep of all paywall surfaces: every lock states a real dollar price matching Stripe config
- Billing-promise page live and linked from pricing + checkout

### 19. Make gating coherent: one dismissible paywall pattern, honest labels, no bypasses, server-side redaction

**Effort: medium** | Impact: high | Audience: all

- [ ] Build ONE standardized dismissible paywall component: X + Escape + backdrop dismiss, states actual price, names the correct tier (no "Sign Up Free" under a Pro badge)
- [ ] Replace `AnonPaywallOverlay` (non-dismissible) and `PaywallOverlay` call sites with it
- [ ] Eliminate the CSS-blur leak: `PaywallOverlay` renders children with `blur-sm pointer-events-none opacity-50` (line ~58) — replace with server-side redacted placeholders
- [ ] Adopt the ambient-lock pattern: locked metrics interleaved with free ones, blurred _placeholder_ preview
- [ ] Verify and regression-test the reported ZIP-gate search bypass (audit says search requires selection — prove it with E2E either way)
- [ ] Fix the empty "Share this analysis" PDF modal path (coordinate with item 20)

**Acceptance criteria:**

- E2E across map/analyzer/reports/SEO pages: every paywall dismisses via X/Escape/backdrop, shows price + correct tier name
- DOM audit script over gated pages: zero real locked values present client-side
- Search-to-ZIP flow as free user cannot reveal gated ZIP data

### 20. No-login branded share links for reports and analyses, plus real PDF/CSV export

**Effort: medium** | Impact: high | Audience: realtors

- [ ] Fix CSV export: `ReportHeader.tsx` (lines ~65, 142) passes `reportData=null` into `ShareReportModal`, disabling CSV even for Pro — one-line-class fix
- [ ] Replace `usePDFExport.ts` `window.print()` with headless-Chromium PDF generation (page numbers, rendered `PDFTableOfContents` — currently never rendered, white-label headers via `OrgBrandingHeader`)
- [ ] Extend tokenized no-login share links (exist for reports via `getSharedReport()` in `reports-sharing.ts` with view_count) to analyzer analyses
- [ ] Add agent branding (Pro) + "Powered by PropertyIQ" attribution + view tracking on shared surfaces
- [ ] Route lead-magnet email captures (`LeadMagnetModal`, `/api/lead-magnet`) into account creation — wire `signup_attributions`/`lead_magnet_deliveries` to conversion tracking

**Acceptance criteria:**

- E2E: Pro user exports a working CSV (rows match on-screen report) and a real PDF with TOC + page numbers from a live report
- Share link opens in incognito with no login, branded, view_count increments in the real DB
- Lead-magnet capture → signup flow completes and attribution row links the two

---

## LATER (Items 21–30 — retention, distribution, expansion)

### 21. Watchlist score-threshold alerts plus a monthly "Market Pulse" data-drop event

**Effort: medium (verdict: easy wiring)** | Impact: high | Audience: all

- [ ] Wire watchlists (`packages/backend/src/analytics-persistence/watchlist.service.ts`) into threshold alerts (`packages/backend/src/alerts/threshold-alert.service.ts`, cron `0 14 1 * *`) — support "any TX metro crosses score 70", grade changes, confidence shifts (schema has `confidence_level`; no grade thresholds today)
- [ ] Brand the monthly rescore as "PIQ Market Pulse": dated release email + public changelog with biggest movers per saved farm area (extend `monthly-digest-data.service.ts` mover computation, lines ~178-221)
- [ ] Add score/price/DOM/supply deltas to the digest; make it forwardable (agent-shareable formatting)
- [ ] Use `react-email`/`resend` skills + `email-best-practices` for templates and deliverability

**Acceptance criteria:**

- E2E with real DB: create a watchlist, set a threshold the latest rescore crosses, trigger the cron path → real alert email received with correct market and delta
- Market Pulse email renders real biggest-mover data matching DB diffs between the last two periods; public changelog page live

### 22. Launch a free open-data hub: monthly score CSVs, methodology, and syndication

**Effort: medium** | Impact: high | Audience: all

- [ ] Build `/data-center`: downloadable monthly PropertyIQ Score CSVs per metro/county/ZIP (data already computed in `propertyiq_scores` view — read from view, never write)
- [ ] Publish the documented formula + confidence-grade definitions (reuse item 10's constants module)
- [ ] Ship a monthly "Top 20 Score Gainers" ranked release tied to the Market Pulse cadence (item 21)
- [ ] Add unauthenticated cached score feeds + schema.org Dataset markup; extend existing `/data` page and embed-widget syndication
- [ ] Add attribution requirements ("Source: PropertyIQ") to downloads

**Acceptance criteria:**

- E2E: anonymous download of metro/county/ZIP CSVs; row counts and spot-checked scores match the live `propertyiq_scores` view
- Top 20 Gainers page renders real month-over-month deltas; Dataset schema validates in Rich Results test

### 23. Make MCP discoverable: persona recipes, "Use PIQ in Claude" content, Add-to-Claude CTAs

**Effort: medium** | Impact: high | Audience: realtors

- [ ] Promote MCP from the "More" dropdown to main nav + a landing-page section (extend `AIIntegrationsSection`)
- [ ] Publish dedicated persona guide pages (Agents / Brokers / Property Managers) with sample prompts ("prep a buyer consultation for ZIP 78702") — tool guides exist in `/docs/mcp`, need standalone SEO pages targeting "ChatGPT for real estate agents"
- [ ] Add "Ask Claude about this market" CTA on market detail pages (beside item 3's Analyze CTA)
- [ ] Package the server as a Claude connector / ChatGPT app (read official platform docs FIRST per team rule)

**Acceptance criteria:**

- E2E: logged-out visitor reaches MCP docs from main nav and a metro page in ≤2 clicks; persona pages indexed (in sitemap, render via curl)
- Following a persona guide end-to-end with a real key produces a working Claude session against live data

### 24. Ship seasonality (Best Month to Buy/Sell) free and Overvaluation % as the viral-metric wedge

**Effort: small–moderate** | Impact: medium | Audience: all

- [ ] Build seasonality metrics (best_month_to_buy/sell) from existing Redfin monthly history — zero code exists; add via the calculated-metrics pipeline (`CalculatedMetricsService`)
- [ ] Ship seasonality chips FREE on every market page + region detail panel (undercut Reventure's paywall)
- [ ] Extend Overvaluation % (`CalculatedMetricsService.calculateOvervalued`, metro-only, entitlement-locked) to county where data allows; unlock or cheapen its gate; add to map metric list, screener presets (item 6), and SEO stats blocks (item 4)
- [ ] Register both in `lib/data/registry.ts` + `metric-categories.tsx` per the add-metric flow (`/add-metric` skill); never duplicate names — `app/map/config/metrics.ts` is the source of truth
- [ ] Feed both into Market Pulse (item 21)

**Acceptance criteria:**

- E2E: live metro page shows Best Month to Buy/Sell chips anonymously, values consistent with that metro's real Redfin monthly history; Overvaluation % renders on map + market pages and matches the calculated-metric API

### 25. Launch "X alternative" pages and the "score, not the story" position for doom-fatigued churners

**Effort: small** | Impact: medium | Audience: investors | Depends on items 10 (accuracy) and 18 (billing) landing first

- [ ] Add a BiggerPockets comparison page to the existing `/compare/[slug]` system (Reventure/Mashvisor/NeighborhoodScout already live)
- [ ] Add "neutral, symmetric" positioning copy (state-relative 1-99 highlights winners AND losers) + doom-fatigue framing on the Reventure page
- [ ] Add the billing-transparency/fair-billing section (from item 18) to every compare page
- [ ] Link compare pages from homepage/footer navigation (currently unlinked)
- [ ] Use `seo-competitor-pages` skill for layout/schema

**Acceptance criteria:**

- E2E: all four compare pages render live with real validated claims (numbers from the item-10 constants module), JSON-LD validates, linked from site nav, each leads to a working signup CTA

### 26. Trust-polish sweep: custom domain, footer, debug strings, dev routes

**Effort: small** | Impact: medium | Audience: all

- [ ] Block `/dev/*` routes in production — middleware currently checks `/_dev` (underscore) but routes live at `/dev/test`, `/dev/paywall-overlay-preview` (path mismatch = production-accessible)
- [ ] Remove "Double click to edit" debug text from `RightDetailPanel.tsx` (with item 17)
- [ ] Fix the footer "Federal Contracting Services LLC" company name
- [ ] Move production off the railway.app subdomain to the custom domain (Railway dashboard + `FRONTEND_URL` backend env var; .env changes are LOCAL ONLY per project rule)
- [ ] Add Privacy Policy/Terms links at the consent step on the sign-up page (already inline in tour form — mirror it)

**Acceptance criteria:**

- E2E production: `/dev/test` and `/dev/paywall-overlay-preview` return 404; footer correct; no debug strings on /map; checkout/auth flows work on the custom domain end-to-end (Stripe + OAuth redirect URLs updated and verified with a real test transaction)

### 27. Instrument MCP per-tool usage so the realtor channel can be managed

**Effort: small–moderate** | Impact: medium | Audience: realtors | Prerequisite for managing item 7's trial

- [ ] Supabase migration: `mcp_tool_executions` table (tool_name, user_id, geography, duration_ms, error, tier) — use a real `now` timestamp in the migration filename and include `GRANT ALL ... TO service_role/authenticated` (both per project lessons)
- [ ] Instrument the tool handler callback in `packages/mcp-server/src/server.ts` (lines ~44-60) to emit structured events — preserve exact tool input/output/error behavior (MCP refactor rule; characterization tests first)
- [ ] Join `user_profiles` (subscription_tier, user_type) for tier/persona context
- [ ] Build a simple adoption view: top tools by tier/persona, error rates
- [ ] Verify post-deploy that the migration actually ran (query `schema_migrations`)

**Acceptance criteria:**

- E2E: real MCP tool calls from a live client produce rows in `mcp_tool_executions` with correct tool_name/user/duration/tier; an induced error logs with the error field set; adoption view renders real aggregates; all 47 tools still return byte-identical outputs on characterization fixtures

### 28. Add an STR-vs-LTR lane to the analyzer to capture Mashvisor refugees

**Effort: medium** | Impact: medium | Audience: investors

- [ ] Add an STR strategy type to `analyzer-core` (daily-rate revenue math, occupancy, STR-specific expense/tax models — distinct from the existing buy-and-hold/flip/BRRRR); rebuild dist after export changes
- [ ] Render STR revenue lane beside LTR outputs in the analyzer UI
- [ ] Add an AI verdict comparing which strategy wins (respect AI prose-style rules: no markdown/em-dashes/identifiers)
- [ ] Add STR regulation flags to reports and as an MCP tool (sourced regulatory data — real data only, no placeholder URLs)
- [ ] Update the live Mashvisor compare page ("Short-Term Rental Data: No" → yes) and lead with confidence grades + billing trust + price undercutting their ~$50 Lite tier

**Acceptance criteria:**

- E2E with real data: analyze a real address/ZIP → side-by-side STR vs LTR outputs with a coherent AI verdict; STR regulation flag renders for a known-regulated market (e.g., NYC); MCP STR tool returns real data; analyzer-core unit tests cover the new strategy math

### 29. Turn embeds into a distribution loop: agent-site score widgets and watermarked map shares

**Effort: medium** | Impact: medium | Audience: realtors

- [ ] Ship a copy-paste embeddable score widget (score + confidence + freshness, linking back to PIQ) — embed system with token validation + "Powered by PropertyIQ" attribution already exists; productize the snippet generator for agent farm-area pages
- [ ] Build one-click watermarked map/score image export with auto-generated headline stats for social (absent today; evaluate reusing the existing Remotion template vs server-side canvas)
- [ ] Add embed/share analytics (views, referrers, click-throughs back to PIQ)
- [ ] Improve embed token-validation error feedback (currently silent/unclear)

**Acceptance criteria:**

- E2E: paste the widget snippet into an external test page → live score renders with attribution + working backlink; image export downloads a watermarked PNG with real stats for the selected geo; embed view events land in the real DB; invalid token shows a clear error state

### 30. Portfolio dashboard: saved deals as a ranked, comparable, exportable table

**Effort: large** | Impact: medium | Audience: investors | Backend fully built (`deal_analyses` table, save/list/get endpoints, `fetchSavedAnalyses`)

- [ ] Build the portfolio list UI: saved-deals table with inline KPIs (price, cap rate, grade, market score)
- [ ] Add filters by grade/state/strategy and ranking/sorting
- [ ] Build side-by-side diff of assumption changes between two saved analyses
- [ ] Add reusable assumption sets (save/apply named presets)
- [ ] Add CSV export (tier-gated consistently with item 6)
- [ ] Later: expose via MCP ("rank my deals by PIQ score") — sequence after item 27 instrumentation
- [ ] All fetching through `@/lib/data` (`fetchSavedAnalyses` exists; add hooks as needed)

**Acceptance criteria:**

- E2E with a real account: save 3 real analyses → portfolio table renders all 3 with correct KPIs matching the analyzer outputs; filter/sort/diff verified in a live browser; CSV export matches table; assumption preset applies correctly to a new analysis

---

## Sequencing notes

- Items 1, 2, 8 are the conversion unblockers — everything else compounds on them.
- Item 19 (single paywall component) should land before/with 2 and 18 to avoid building dismiss logic twice.
- Item 10 (constants module) gates item 25 (compare pages); item 27 (instrumentation) gates managing item 7 (MCP trial).
- Item 11's CI guard and item 26's dev-route block are cheap insurance — slot into any sprint.
