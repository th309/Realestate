# PropertyIQ Report Suite Redesign - Design Document

**Date:** 2026-02-16
**Status:** Approved
**Scope:** Complete redesign of all report types as the flagship experience of the platform

---

## Problem Statement

The current report system has three critical issues:

1. **No cohesive story** - Sections feel like separate widgets bolted together with no narrative thread
2. **Score is decorative** - The PropertyIQ score appears but doesn't drive the content
3. **Not actionable** - Users don't know what to DO after reading

## Vision

Reports are an awesome combination of PropertyIQ scores, expert AI analysis, and data display that relates directly to the user. They read like a personal advisor wrote them with magazine-quality presentation, backed by hard data. Reports are the star feature of the site.

## Design Principles

- **Score is the backbone** - Every section maps to a score component. The report IS the score explained.
- **Data + narrative integrated** - Metrics displayed prominently with AI interpretation woven around them. Metrics are the evidence, narrative is the interpretation.
- **Intent-driven personalization** - If a user provides information, they're telling us it matters. The report honors that. Without inputs, the report still works great.
- **Always factual** - Everything backed by real database data or grounded AI analysis. Never fabricated.
- **Naturally monetizable** - Partner recommendations appear as contextual next steps when configured. Invisible when not.

---

## Shared Architecture

All report types share a consistent section layout pattern and rendering system.

### Universal Section Pattern

Every deep-dive section follows this layout:

1. **Component score badge** - Score/100, grade, helping/hurting indicator
2. **Key metrics row** - 3-4 data points with benchmark comparisons
3. **Trend visual** - Sparkline or chart showing 6-month direction
4. **AI narrative** - 2-3 paragraphs connecting data to meaning
5. **Personalized insight** - If user provided relevant inputs (renders only when applicable)
6. **Recommendation slot** - Partner recommendation (renders only when configured)

### Recommendation Slot System

- Report template defines `recommendation_slots` with a `context_type`
- Separate partner configuration maps context types to partner offers
- **If a partner is configured for a slot, it renders. If not, nothing renders.**
- No empty placeholders, no gaps, no toggles needed
- The absence of a partner config IS the off switch
- Design: subtle card, muted background, "Recommended next step" label
- Tone: "Based on your profile, getting pre-approved helps you move fast. We recommend [Partner]."
- Disclosure: small "PropertyIQ may receive compensation" footnote

### AI Narrative Generation

Each section's AI narrative is generated with full context:
- Score value + component breakdown
- All relevant metrics with benchmarks
- User inputs (priorities, financial info, timeline)
- Historical trends
- News and economic indicators

The AI writes as an expert advisor: factual, insightful, personalized when data allows.

---

## Report Type 1: HomeReady (Homebuyer)

### Score: HomeReady Score
**Components:** Affordability, Market Timing, Stability, Growth Potential

### Personalization Inputs (all optional)

**Priorities** - select up to 3 of 5:
- Affordability
- Appreciation/Growth
- Job Market
- Market Timing
- Stability

**Financial:** Household income, down payment amount
**Timeline:** When they plan to buy, first-time buyer flag

### Narrative Arc

```
1. Hero (Score + Verdict)
2. Score Story (Component breakdown roadmap)
3. Affordability Deep Dive
4. Market Timing Deep Dive
5. Stability Deep Dive
6. Growth Potential Deep Dive
7. Your Priorities (personalized reframing - conditional)
8. The Bottom Line (actionable verdict + next steps)
9. Market Pulse (news, economic context - appendix)
```

### Section Details

#### 1. Hero
- Large HomeReady score with grade (e.g., "72 | B+")
- One-line AI verdict: "A solid market for buyers with strong income fundamentals, but rising costs require timing awareness"
- Market name, geography, report date
- User's priorities as subtle tags (if provided)
- Confidence indicator (HIGH/MEDIUM/LOW)
- Score trend arrow with period change

#### 2. Score Story
- Visual component breakdown (bars or radar) showing all 4 components
- Each labeled: "Strong", "Watch", "Concern", "Excellent"
- AI paragraph connecting them: "Your strongest factor is stability at 81. Affordability is solid at 72 but under pressure..."
- Acts as table of contents for what follows

#### 3. Affordability Deep Dive
- **Metrics:** median_listing_price, median_income, affordability_ratio, price-to-income, estimated PITI
- **Benchmarks:** vs. national, state, similar metros
- **Chart:** 6-month affordability trend
- **AI:** Interprets ratio, explains rate impact, contextualizes vs. benchmarks
- **Personalized:** "With your $85K income and $40K down, you could target homes up to $380K. The median at $365K is within reach."
- **Recommendation context:** `affordability` (lender pre-approval, mortgage comparison)

#### 4. Market Timing Deep Dive
- **Metrics:** days_on_market, active_listing_count, hotness_score, pending_ratio
- **Benchmarks:** vs. national, vs. 6 months ago
- **Chart:** DOM trend + inventory trend
- **AI:** Buyer's vs. seller's market? Window opening or closing?
- **Personalized:** "With your 6-month timeline, inventory trends suggest more options by Q3"
- **Recommendation context:** `timing` (buyer's agent)

#### 5. Stability Deep Dive
- **Metrics:** price volatility (ZHVI YoY consistency), DOM consistency, supply_score
- **Benchmarks:** vs. national stability, state
- **Chart:** ZHVI trend showing price consistency
- **AI:** How predictable? Downside risk? Value protection?
- **Recommendation context:** `stability` (home warranty, insurance)

#### 6. Growth Potential Deep Dive
- **Metrics:** ZHVI YoY, population growth, job growth, hotness_score
- **Benchmarks:** vs. national appreciation, state
- **Chart:** Home value appreciation trend
- **AI:** Where headed? What's driving growth? Sustainable?
- **Dollar impact:** "Markets with this growth score have historically seen $X in equity gain over 3 years" (backtesting data)
- **Recommendation context:** `growth`

#### 7. Your Priorities (conditional)
- Only renders if user provided personalization inputs
- Reframes findings through their lens
- Priority #1 gets lead verdict with supporting/challenging factors from other components
- Income/down payment: personalized affordability math
- Timeline: time-calibrated advice

#### 8. The Bottom Line
- AI executive summary (3-4 paragraphs synthesizing everything)
- **Verdict badge:** "Good time to buy" / "Proceed with caution" / "Wait and watch"
- **3 action items:** Specific next steps ("Get pre-approved at current rates", "Focus search in $350-400K range")
- **What to watch:** 2-3 metrics with thresholds ("If DOM rises above 45, the market shifts in your favor")
- **Recommendation context:** `verdict` (most relevant partner for the situation)

#### 9. Market Pulse (appendix)
- Local news with AI relevance summaries
- Economic indicators (unemployment, job growth, income)
- Market sentiment gauge (bullish/neutral/bearish)

---

## Report Type 2: InvestorEdge (Investor)

### Score: InvestorEdge Score
**Components:** Cash Flow, Rent Demand, Appreciation, Entry Point, Risk

### Personalization Inputs (all optional)

**Priorities** - select up to 3 of 5:
- Cash Flow / Yield
- Appreciation / Growth
- Low Risk / Stability
- Market Timing / Entry Point
- Rent Demand

**Financial:** Investment budget, target cap rate, strategy (buy-and-hold, flip, BRRRR, rental)
**Portfolio:** Number of existing properties, target market count, risk tolerance (conservative/moderate/aggressive), target annual return

### Narrative Arc

```
1. Hero (InvestorEdge Score + Investment Verdict)
2. Score Story (Component breakdown roadmap)
3. Cash Flow Deep Dive
4. Rent Demand Deep Dive
5. Appreciation Deep Dive
6. Entry Point Deep Dive
7. Risk Assessment Deep Dive
8. Investment Thesis (personalized strategy - conditional)
9. Pro Forma Snapshot (if budget provided - conditional)
10. The Bottom Line (actionable verdict + next steps)
11. Market Pulse (appendix)
```

### Section Details

#### 1. Hero
- InvestorEdge score with grade
- AI verdict: "Strong cash flow fundamentals with moderate appreciation upside. Entry point is favorable for buy-and-hold investors."
- Market name, geography, date, confidence
- User's strategy and priorities as tags (if provided)

#### 2. Score Story
- 5-component breakdown visualization
- Each labeled with investor-relevant status
- AI connecting the investment picture

#### 3. Cash Flow Deep Dive
- **Metrics:** cap_rate, gross_yield, GRM, median_gross_rent, ZORI, rent-to-price ratio
- **Benchmarks:** vs. national yields, state, similar metros
- **Chart:** Rent trend (ZORI 6-month)
- **AI:** Is the cash flow real? Sustainable? How does it compare to other investment options?
- **Personalized:** "At your $300K budget, the typical rental here yields $1,850/mo gross. After expenses, expect ~$400/mo positive cash flow."
- **Recommendation context:** `cash_flow` (investment lenders, property management)

#### 4. Rent Demand Deep Dive
- **Metrics:** vacancy indicators, rent growth YoY, population growth, employment growth
- **Benchmarks:** vs. national rent growth, state
- **Chart:** Rent growth trend
- **AI:** How strong is tenant demand? What's driving it? Sustainability?

#### 5. Appreciation Deep Dive
- **Metrics:** ZHVI YoY, 3-year annualized return, price trends, hotness_score
- **Benchmarks:** vs. national, state
- **Chart:** Home value trend with projection band
- **Dollar impact:** "Markets with this appreciation score have delivered $X in equity over 3 years" (backtesting)
- **AI:** Growth drivers, sustainability, comparison to alternative investments

#### 6. Entry Point Deep Dive
- **Metrics:** affordability_ratio, price-to-rent, median_listing_price, price vs. 12-month average
- **Benchmarks:** vs. historical norms for this market, national
- **Chart:** Price trend with "entry zone" highlighting
- **AI:** Are we buying at the right point in the cycle? Is this priced fairly?
- **Personalized:** "At your moderate risk tolerance, the current entry point aligns with buy-and-hold strategy"

#### 7. Risk Assessment Deep Dive
- **Metrics:** supply_score, price volatility, DOM volatility, concentration risk indicators
- **Benchmarks:** vs. national stability
- **Chart:** Volatility visualization
- **AI:** What could go wrong? How exposed is this market? Downside scenarios.
- **Personalized by risk tolerance:** Conservative investors get more cautionary framing

#### 8. Investment Thesis (conditional)
- Only renders if strategy/portfolio inputs provided
- Frames the market within their specific strategy
- Buy-and-hold: emphasizes cash flow sustainability and appreciation
- Flip: emphasizes entry point, DOM, price momentum
- BRRRR: emphasizes after-repair value potential, rent demand
- Portfolio context: "Adding this market diversifies your exposure to [region/type]"

#### 9. Pro Forma Snapshot (conditional)
- Only renders if investment budget provided
- Simplified pro forma based on their budget and market medians
- Estimated monthly cash flow, annual return, 5-year equity projection
- All clearly labeled as estimates based on market medians
- **Recommendation context:** `pro_forma` (1031 exchange services, investment accountants)

#### 10. The Bottom Line
- AI investment verdict synthesis
- **Verdict badge:** "Strong opportunity" / "Selective opportunity" / "Better markets exist"
- **3 action items:** Investor-specific ("Secure investment financing at current rates", "Target properties in the $250-300K range for optimal yield")
- **What to watch:** Key metrics for investment thesis validation
- **Recommendation context:** `verdict`

#### 11. Market Pulse (appendix)
- Same as HomeReady but with investor-relevant news filtering

---

## Report Type 3: Comparison Report

### Score: User's relevant score type (HomeReady or InvestorEdge)
**Supports:** 2-3 markets side by side

### Layout Modes
- **2 markets:** Head-to-head layout, split screen
- **3 markets:** Ranked comparison with table-style layout

### Personalization Inputs
- Same as the corresponding report type (HomeReady or InvestorEdge)
- Plus: user selects priorities that drive the priority-weighted winner calculation

### Narrative Arc

```
1. Comparison Hero (All scores side by side + Winner declaration)
2. Head-to-Head Score Story (Component comparison visualization)
3. Component-by-Component Showdown (one section per component)
4. Priority-Weighted Analysis (why the winner won based on YOUR priorities)
5. Where Each Market Shines (strengths summary per market)
6. The Verdict (which market, for whom, and why)
7. Market Pulse (combined news for all markets)
```

### Section Details

#### 1. Comparison Hero
- All market scores displayed side by side with grades
- Winner badge on the leading market
- AI one-liner: "Austin edges out Nashville on growth fundamentals, but Nashville wins on affordability for budget-conscious buyers"
- If 3 markets: ranked #1, #2, #3

#### 2. Head-to-Head Score Story
- Side-by-side component bars for all markets
- Visual makes it instantly clear where each market leads
- Color coding: green (winner per component), neutral (close), red (trailing)

#### 3. Component-by-Component Showdown
- One section per score component
- Side-by-side metrics for all markets
- AI narrative compares and contrasts: "Austin's affordability ratio of 4.2x is significantly better than Nashville's 5.1x, meaning your dollar goes further..."
- Winner badge per component
- Chart: overlaid trends for all markets

#### 4. Priority-Weighted Analysis
- Uses existing `calculatePriorityWeightedWinner()` logic
- Shows how user's priorities (#1 = 3pts, #2 = 2pts, #3 = 1pt) determined the winner
- Visual breakdown of points per priority
- AI explains the tradeoffs: "Nashville wins overall because your top priority (affordability) outweighs Austin's lead in appreciation"

#### 5. Where Each Market Shines
- Per-market summary card
- Top 2-3 strengths with supporting data
- "Best for..." label (e.g., "Best for: Budget-conscious first-time buyers")

#### 6. The Verdict
- AI synthesis of the comparison
- Clear recommendation with reasoning
- "If X matters most, choose Market A. If Y, choose Market B."
- Action items for the recommended market
- **Recommendation context:** `verdict`

---

## Report Type 4: Market Snapshot (Agent)

### Dual Mode Design
Same underlying data, two presentation modes:

### Mode A: Client-Facing Report
**Purpose:** Agent shares with prospective buyer/seller. Professional, concise, builds credibility.

```
1. Market Overview (MarketHealth score + key stats)
2. Price & Value Summary (3-4 key metrics with trends)
3. Market Conditions (buyer's/seller's market assessment)
4. What This Means For You (buyer or seller framing)
5. About Your Agent (agent branding section)
```

**Characteristics:**
- Clean, branded layout with agent's contact info
- No deep technical analysis - accessible to any consumer
- MarketHealth score (free tier, always available)
- 1-2 pages equivalent, scannable
- AI narrative in plain language, no jargon
- **Recommendation context:** `agent_services` (the agent themselves is the recommendation)

### Mode B: Agent Prep View
**Purpose:** Agent uses to prepare for listings/consultations. Internal tool.

```
1. Market Quick Stats (all key metrics at a glance)
2. Talking Points (AI-generated bullet points)
3. Objection Handlers (common concerns with data-backed responses)
4. Competitive Positioning (how this market compares to neighbors)
5. Recent News & Signals (conversation starters)
```

**Characteristics:**
- Dense, information-rich layout
- Talking points formatted as scripts: "When clients ask about pricing, you can say..."
- Objection handlers: "If they say 'the market is too expensive': median price is actually 8% below state average..."
- Competitive context vs. surrounding markets
- Not designed for sharing - designed for agent's eyes

---

## PDF Export

All report types support PDF export with these specifications:

- **Paginated layout** - Same sections, reformatted for print/PDF
- **Page breaks** - Logical breaks between sections (each component deep dive starts a new page)
- **Cover page** - Report title, score, market, date, PropertyIQ branding
- **Table of contents** - Linked section headers
- **Charts rendered as images** - Static versions of interactive charts
- **Print-optimized colors** - Ensure readability on paper (no pure-screen colors)
- **Recommendation slots** - Included in PDF when configured, same subtle design
- **Agent branding** - Market Snapshot client mode includes agent logo/contact
- **Footer** - Page numbers, report date, "Generated by PropertyIQ" watermark

---

## Interactive Personalization

After the base report is generated, users can adjust personalization inputs and see the report update in real-time.

### Interaction Model
- Persistent personalization panel (collapsible sidebar or top bar)
- User adjusts: priorities, income, down payment, timeline, strategy
- Affected sections re-render with personalized insights
- AI narratives for personalized sections regenerate (with loading state)
- Non-personalized sections (raw metrics, benchmarks) remain static

### What Updates in Real-Time
- Personalized insight lines within component sections
- "Your Priorities" section (reframes based on new priorities)
- Affordability calculations (income/down payment changes)
- Pro Forma snapshot (budget changes for investors)
- Bottom Line action items (recalibrated to new inputs)

### What Does NOT Update (avoids unnecessary API calls)
- Score values (these are market-level, not personal)
- Raw metrics and benchmarks
- Charts and trend data
- Market Pulse / news

### Technical Approach
- Client-side recalculation for affordability math (no API call needed)
- AI narrative regeneration via API call with debounce (only triggers after user stops adjusting for 2 seconds)
- Loading skeleton on regenerating sections while others remain stable

---

## Data Requirements

All data comes from existing backend systems:

| Source | Data | Used In |
|--------|------|---------|
| `propertyiq_scores_v2` | Score, grade, confidence, components | Hero, Score Story, all component sections |
| `realtor_*` tables | median_listing_price, DOM, active_listings, hotness | Affordability, Timing, Growth |
| `zillow_metro` | ZHVI, ZORI, YoY changes | Affordability, Stability, Growth, Cash Flow |
| `calculated_metrics` | cap_rate, gross_yield, affordability_ratio, GRM | Affordability, Cash Flow, Entry Point |
| `census_*` | population, median_income, employment | Affordability, Growth, Job Market |
| `TimeSeriesService` | 6-month historical for all metrics | All trend charts |
| `ScoringService` | Extended history, backtesting outcomes | Growth/Appreciation (dollar impact) |
| `GeminiNewsService` | Local news, economic indicators, sentiment | Market Pulse |
| `ClaudeService` | AI narratives per section | All AI narrative content |
| User inputs | Priorities, financial, timeline, strategy, portfolio | Personalization throughout |
| `partner_config` | Partner offers by context type | Recommendation slots |

---

## Technical Architecture

### Shared Components
- `SectionCard` - Universal section wrapper with consistent spacing/styling
- `ComponentScoreBadge` - Score/100 + grade display
- `MetricsRow` - 3-4 metrics with benchmarks
- `TrendChart` - Sparkline/chart component
- `AINovelNarrative` - Rendered AI prose block
- `PersonalizedInsight` - Conditional personal callout
- `RecommendationSlot` - Partner recommendation card (self-hiding when unconfigured)
- `VerdictBadge` - "Good time to buy" style badge

### Report Renderer
- Template defines section order and types
- Each section is a standalone React component
- Sections receive `report.populated_data`, `report.scores_snapshot`, `report.ai_narrative`, and `user_inputs`
- Recommendation slots are a separate rendering layer injected by partner config
- Score components drive section emphasis

### AI Narrative Generation
- Backend generates per-section narratives with full context
- Prompt includes: score, components, metrics, benchmarks, user inputs, news
- Each section gets its own narrative key in `report.ai_narrative`
- Regeneration endpoint for interactive personalization updates

### Partner Configuration
- Database table or config file mapping `context_type` → partner details
- Partner details: name, logo, CTA text, link, description template
- Description templates support variable interpolation: "Based on your {score_component} score of {score_value}..."
- Admin interface to manage partners (future)
