# Reventure Capture Plan — Prioritized Actions

Companion to `FULL-AUDIT-REPORT.md`. Each item translates a specific Reventure gap into a concrete PropertyIQ move. Priority = leverage × how fast it can move, not effort.

---

## Critical

### 1. Push SSR per-geography market page coverage and internal linking harder — this is the whole game

Reventure has **zero indexable market/city/ZIP pages** despite claiming coverage of 500-1,000 metros, ~3,000 counties, and 30,000+ ZIPs — their sitemap has 12 URLs, all app-shell routes, and direct probes of `/market/austin-tx`, `/zip/78701`, `/markets` all 404. PropertyIQ already has the architecture for this (SSR market pages gated to scored geos, per existing `project_seo-score-gated-pages` setup) — this audit confirms the single biggest competitor in this exact niche has **no answer at all** for "[city] housing market forecast" or "[zip] home prices" queries.
**Action:** Treat expanding scored-geo coverage and internal linking depth (metro → county → ZIP crosslinks, "nearby markets" modules) as the top SEO priority this quarter. Every scored geo PropertyIQ adds is a page Reventure structurally cannot compete for.

### 2. Target "will home prices crash 2026" and city-level "[market] forecast 2026" head terms directly

Reventure doesn't rank for its own signature narrative term ("will home prices crash 2026" — Forbes/Newsweek/Yahoo/CNBC/JPMorgan own that SERP instead), and it can't rank for any city-specific forecast query for the reason above.
**Action:** Use the existing AI market-narrative generation (`ai-insights`) to produce forecast-angle content on scored market pages / a forecast content hub, targeting these exact terms where Reventure is verifiably absent and where PropertyIQ has the underlying data to back the content honestly (score + confidence grade, not speculation).

---

## High

### 3. Lead with the account-wall and "no guide" complaints in comparison/positioning copy

Play Store reviews confirm real user friction: can't do "anything unless you pay," sign-up prompts on "just about everything," and a map with "no guide" so users don't know what they're looking at. PropertyIQ's free, no-signup map is a direct answer to this, already stated on `/compare/propertyiq-vs-reventure` — but it's underused as a standalone hook.
**Action:** Surface "no signup wall" more prominently in ad copy / landing-page headlines targeting "Reventure alternative" and "Reventure sign up" searchers. Cite the review pattern generally ("users report...") rather than quoting individuals verbatim.

### 4. Cite Reventure's no-refund policy as a factual trust contrast

Confirmed directly from Reventure's own Terms of Use PDF: no refunds or exchanges on any purchase, corroborated by a billing complaint (paid $49, features never unlocked, no resolution).
**Action:** Add a factual, sourced line to the existing comparison page or a "switching from Reventure" FAQ entry — link the terms PDF directly. Per the fairness guidelines this skill enforces: state the policy as fact with a citation, don't editorialize or imply fraud.

### 5. Turn the transparent-methodology differentiator into long-form, linkable content — not just comparison-page bullets

Reventure has no methodology page, no published weights, no backtest, no confidence grading — PropertyIQ already claims this differentiator on the comparison page, but it's boxed into a vs-page context that only reaches people already comparing the two.
**Action:** Publish/expand a standalone methodology + confidence-grade explainer (if `scores/methodology` isn't already doing this fully) optimized to rank independently on terms like "how are housing market scores calculated" — a query space with no strong Reventure competitor to that content at all.

### 6. Build out cash-flow / deal-analysis content against Reventure's confirmed product gap

Independently corroborated by both reviews and a third-party teardown (Curb Report): Reventure has no cash-flow calculator, no cap rate/cash-on-cash tool, no portfolio tracker — it's a price-direction/timing tool, not an underwriting tool.
**Action:** Content and landing pages pairing PropertyIQ's Deal Analyzer / Cashflow Estimate / Rent-vs-Own tools with market-timing content, explicitly positioning "market signal + deal underwriting in one place" against Reventure's "map only" experience.

---

## Medium

### 7. Watch the "Listing Tool Analyzer" beta — Reventure may be moving into deal-analysis territory

Moderate-confidence signal (a beta dashboard + directory-site mentions, no primary announcement) that Reventure is building toward property-level listing analysis — PropertyIQ's current moat.
**Action:** No content action yet; flag for quarterly re-check. Don't publish "Reventure has no deal tools" claims as a permanent differentiator without re-verifying periodically.

### 8. Lean into the MCP/AI-agent angle where Reventure has no visible answer

No evidence found of Reventure having any AI-agent/LLM-queryable data surface.
**Action:** Continue surfacing PropertyIQ's MCP server in competitive content (consistent with existing guidance that MCP is a top differentiator) — this is a forward-looking wedge Reventure would need a structural rebuild to match.

### 9. Don't compete head-on for "housing market forecast by zip code" — go around it

Reventure ranks #1 on this exact brand-adjacent term. Contesting it directly is low-leverage.
**Action:** Focus on the long tail this term implies (thousands of "[specific city/ZIP] housing market forecast" variants) where item #1 above already gives PropertyIQ the structural advantage.

---

## Low / Watch List

### 10. QA note (no action needed, internal awareness only)

Reventure has leftover generic "– My Blog" WordPress title tags on at least two posts — a minor credibility tell. No PropertyIQ action; just don't inherit similar unfinished-template artifacts on our own content pages.

### 11. Possible future content moment: forecast track record vs. current -1% YoY call

Reventure's brand is built on "crash" framing, but their own current national forecast is a mild -1% YoY — a real gap, but this is our inference, not a documented third-party critique (the one confirmed inaccuracy is the 2022 Airbnb-collapse thread contradicted by AirDNA data). **Do not publish this as a factual claim without further verification** — revisit if Reventure's forecast record becomes a bigger public story, and if so, follow the fairness guidelines (verifiable, sourced, no defamation) precisely.

---

## What this audit deliberately does not do

- No claims about Reventure's Core Web Vitals/performance were made — their JS-hydrated pages weren't benchmarked with a real performance tool in this pass; if that's wanted, it's a follow-up, not included here.
- No live rank-tracking data (this used WebSearch snapshots, which are directional, not a SERP-position tool like DataForSEO would provide).
- Reddit sentiment is explicitly flagged as unverified/absent, not assumed negative.
