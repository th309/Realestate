# Quinn v2: Pre-Computed Market Intelligence Architecture

**Date:** 2026-02-22
**Status:** Approved
**Scope:** Quinn chatbot overhaul + shared intelligence layer for Reports

---

## 1. Problem Statement

Quinn (PropertyIQ's AI market analyst) has five core problems:

| # | Problem | Impact |
|---|---------|--------|
| 1 | **Too slow** — multi-tool round-trips per query take 20-40s | Users abandon before getting answers |
| 2 | **No recent news** — can only answer from static DB data | Answers feel stale, miss market-moving events |
| 3 | **Too expensive** — Claude as primary LLM for every query | ~$675/mo at 500 queries/day |
| 4 | **Answers too generic** — insufficient market-specific context | Doesn't feel like a real analyst |
| 5 | **Rendering breaks** — tables/structured data inconsistent | Undermines credibility |

Additionally, **Quinn and Reports are independent systems** that can contradict each other — Quinn might say "Chicago is struggling" while a report says "Chicago shows promising fundamentals."

### Performance Target

- **80% of queries:** 3-8 seconds (briefing-backed)
- **15% of queries:** 10-15 seconds (tool fallback)
- **5% of queries:** 12-15 seconds (Claude escalation)
- **Hard ceiling:** 20 seconds maximum

### Cost Target

- ~$130-230/month at 500 queries/day (vs ~$675 today)
- DeepSeek V3 as primary LLM

---

## 2. Solution: Pre-Computed Market Intelligence

### Core Concept

Pre-compute a structured "intelligence briefing" for each market on a weekly schedule. Quinn reads the briefing as context instead of making multiple tool calls. Reports use the same briefing to anchor narrative generation, guaranteeing consistency.

### What's NOT Changing

- The existing tool-call architecture stays as a fallback for edge-case queries
- `MetricResolutionService` remains the data source of truth
- Frontend Quinn components remain (rendering improvements layered on top)
- Report section-based narrative generation stays, just gets briefing context injected

### Quinn's Scope (Defined)

**In scope:**
- Market performance and trends
- Market comparisons and rankings
- Investment strategy guidance (buy-and-hold, cash flow, appreciation)
- PropertyIQ scores and their drivers
- Recent news/activity affecting market-level decisions

**Out of scope (Quinn politely declines):**
- Individual property valuations
- Mortgage calculations or rate shopping
- Legal/tax advice
- Personal financial planning
- Anything not supported by the data

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      BATCH LAYER (Offline)                       │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────┐  │
│  │   Briefing      │  │    News        │  │    Rankings       │  │
│  │  Generator      │  │  Ingestion     │  │     Cache         │  │
│  │  (Weekly)       │  │  (Daily)       │  │   (Weekly)        │  │
│  │                 │  │                │  │                   │  │
│  │ 900 metros +    │  │ News API →     │  │ Top/bottom 10     │  │
│  │ 500 counties    │  │ geo-tag →      │  │ for ~15 metrics   │  │
│  │                 │  │ summarize      │  │ at 3 geo levels   │  │
│  └───────┬────────┘  └───────┬────────┘  └────────┬──────────┘  │
│          │                   │                     │             │
│          ▼                   ▼                     ▼             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   Supabase: market_briefings, market_news, rankings_cache │   │
│  └────────────────────────────┬─────────────────────────────┘   │
└───────────────────────────────┼──────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                                   ▼
   ┌─────────────────────┐            ┌──────────────────────┐
   │       QUINN          │            │      REPORTS          │
   │                      │            │                       │
   │  Intent Detection    │            │  Reads briefing as    │
   │  → Briefing lookup   │            │  narrative anchor     │
   │  → Rankings cache    │            │  → Consistent tone    │
   │  → Tool fallback     │            │  → Same news/risks    │
   │  → LLM Router        │            │  → Same market stance │
   │  → Stream response   │            │                       │
   └─────────────────────┘            └──────────────────────┘
```

---

## 4. Briefing Generation Pipeline

### Schedule & Coverage

- **When:** Weekly cron (Sunday 2am)
- **Coverage:** ~900 metros + ~500 top counties by population (~1,400 total)
- **History:** Append with `generated_date`, index on `is_latest` for fast lookup
- **Storage:** ~5-10KB per briefing × 1,400 = ~7-14MB per week

### Generation Steps (Per Market)

1. **Pull metrics** via `MetricResolutionService.resolveMetricBatch()` — ~15 key metrics (home value, rent, appreciation, cap rate, vacancy, population, unemployment, DOM, inventory, supply, permits, income, price-to-rent, mortgage payment)
2. **Pull scores** — HomeReady + InvestorEdge with confidence and 30-day change
3. **Compute trends** — MoM and YoY deltas from historical snapshots in source tables
4. **Compute market stance** — **RULE-BASED, not AI-generated** (see Section 4.1)
5. **Compute risk flags** — scan metrics against thresholds (see Section 4.2)
6. **Pull recent news** — latest 5 articles from `market_news` for this geography
7. **Generate narrative** — DeepSeek V3: "Write a 3-4 sentence analyst briefing for {market}. Market stance is {stance}. Be direct and opinionated consistent with this stance."
8. **Generate follow-up suggestions** — 3 natural next questions specific to this market
9. **Store** in `market_briefings` table

### 4.1 Rule-Based Market Stance

The market stance (bullish/bearish/neutral) is derived deterministically from metrics, NOT generated by the LLM. This prevents hallucinated stances from propagating to both Quinn and Reports.

**Stance Rules:**

```
BULLISH if 3+ of:
  - YoY appreciation > 3%
  - Population growth > 0.5%
  - Vacancy < national average
  - DOM decreasing YoY
  - HomeReady score > 70

BEARISH if 3+ of:
  - YoY appreciation < 0% (declining)
  - Population growth < -0.3%
  - Vacancy > national average + 1%
  - DOM increasing > 15% YoY
  - HomeReady score < 45

NEUTRAL: everything else
```

Substances: `strong_bullish` (5+ bullish signals), `weak_bullish` (3-4), `neutral`, `weak_bearish` (3-4), `strong_bearish` (5+).

### 4.2 Risk Flags

Pre-computed by scanning metrics against thresholds:

| Flag | Trigger | Severity |
|------|---------|----------|
| `population_decline` | YoY population < -0.3% | high |
| `price_decline` | YoY appreciation < -2% | high |
| `high_vacancy` | Vacancy > national avg + 2% | high |
| `rising_unemployment` | Unemployment > state avg + 1.5% | high |
| `inventory_surge` | Inventory YoY > +20% | medium |
| `dom_increasing` | DOM YoY > +15% | medium |
| `affordability_squeeze` | Price-to-income ratio > 6x | medium |
| `low_rent_growth` | Rent YoY < 0% | medium |
| `tax_burden` | (if data available) | medium |
| `natural_disaster_risk` | coastal/fire/flood flags from geographies table | low |

### 4.3 Briefing Schema

```sql
CREATE TABLE market_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,          -- metro | county
  geography_name TEXT NOT NULL,
  generated_date DATE NOT NULL,
  is_latest BOOLEAN DEFAULT true,        -- fast lookup index

  -- Core data
  metrics_snapshot JSONB NOT NULL,       -- { metric_id: { value, formatted, mom_change, yoy_change, date } }
  scores JSONB NOT NULL,                 -- { homeready: { score, confidence, trend, change_30d }, investoredge: {...} }

  -- Analysis (rule-based)
  market_stance TEXT NOT NULL,           -- strong_bullish | weak_bullish | neutral | weak_bearish | strong_bearish
  stance_signals JSONB NOT NULL,         -- [{ signal, direction, value }] — what drove the stance
  risk_flags JSONB NOT NULL,             -- [{ flag, severity, detail, metric_value, threshold }]

  -- AI-generated (DeepSeek)
  narrative_summary TEXT NOT NULL,       -- 3-4 sentence analyst brief
  suggested_questions JSONB NOT NULL,    -- ["What are the risks?", "Compare to Austin", ...]

  -- News snapshot (from market_news at generation time)
  news_snapshot JSONB,                   -- top 5 articles embedded

  -- Metadata
  metrics_count INTEGER,                 -- how many metrics had data
  data_freshness_days INTEGER,           -- age of newest metric
  generation_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_briefings_latest ON market_briefings (geography_id, is_latest) WHERE is_latest = true;
CREATE INDEX idx_briefings_date ON market_briefings (generated_date);
CREATE INDEX idx_briefings_type ON market_briefings (geography_type);
```

---

## 5. News Ingestion Pipeline

### Schedule & Source

- **When:** Daily cron (6am)
- **Source:** News API service (Bing News Search or NewsAPI)
- **Strategy:** Query by state/region (~50 queries) not per-market (~1,400) to minimize API costs

### Pipeline Steps

1. **Query News API** — `"real estate market {state/region}"` for each of ~50 states/regions, last 7 days
2. **Deduplicate** — hash by URL, skip already-ingested articles
3. **Geo-tag** — match metro/county names in title + description against `geographies` table. Conservative matching: metro names only, require high confidence. Unmatched articles get state-level tag only.
4. **Summarize + classify** — DeepSeek batch: 1-2 sentence summary + topic tags (`risk`, `opportunity`, `policy`, `development`, `economic`) + sentiment (`positive`, `negative`, `neutral`)
5. **Store** in `market_news` table

### Geo-Tagging Rules

- Match against canonical metro names from `geographies` table
- Include common variations (e.g., "DFW" → Dallas-Fort Worth, "Bay Area" → San Francisco/San Jose)
- Confidence threshold: only tag if match confidence > 0.8
- One article can tag to multiple geographies
- Articles that only match a state get `state` geo-level tag (available for all markets in that state)

### News Schema

```sql
CREATE TABLE market_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  headline TEXT NOT NULL,
  source_name TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,                -- 1-2 sentence DeepSeek summary
  tags TEXT[] NOT NULL,                 -- {risk, policy, development, economic, opportunity}
  sentiment TEXT NOT NULL,              -- positive | negative | neutral
  geography_ids TEXT[] NOT NULL,        -- markets this article relates to
  geography_type TEXT,                  -- metro | county | state
  geo_tag_confidence REAL,             -- 0-1
  raw_description TEXT,
  ingested_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_news_geography ON market_news USING GIN (geography_ids);
CREATE INDEX idx_news_published ON market_news (published_at DESC);
CREATE INDEX idx_news_tags ON market_news USING GIN (tags);
```

### Quinn Reads News

At query time, Quinn gets: latest briefing (weekly) + any `market_news` rows newer than the briefing's `generated_date` for that geography. This ensures news is always fresh (daily) even with weekly briefings.

---

## 6. Rankings Cache

### Schedule & Coverage

- **When:** Weekly, alongside briefing generation
- **What:** Pre-compute top 10 and bottom 10 for ~15 most-asked metrics across 3 geo levels (metro, county, state)

### Metrics to Pre-Compute

`home_value`, `appreciation_yoy`, `rent_index`, `cap_rate`, `vacancy_rate`, `population_growth`, `unemployment_rate`, `dom`, `inventory`, `price_to_rent`, `homeready_score`, `investoredge_score`, `market_health_score`, `permits_growth`, `income_growth`

### Rankings Schema

```sql
CREATE TABLE rankings_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id TEXT NOT NULL,
  geography_type TEXT NOT NULL,          -- metro | county | state
  direction TEXT NOT NULL,               -- top | bottom
  generated_date DATE NOT NULL,
  is_latest BOOLEAN DEFAULT true,
  rankings JSONB NOT NULL,               -- [{ rank, geography_id, geography_name, value, formatted }]
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rankings_lookup ON rankings_cache (metric_id, geography_type, direction, is_latest)
  WHERE is_latest = true;
```

### Fallback

If a ranking query doesn't match a pre-computed combination (unusual metric, custom filter like "top 10 cap rate in the Southeast"), fall back to the existing `get_rankings` tool call.

---

## 7. Quinn Query Flow

```
User message arrives
  │
  ▼
Scope Check → OUT OF SCOPE?
  │              → "That's outside what I cover — PropertyIQ focuses
  │                 on market-level investment analysis."
  │
  ▼
Intent Detection (enhanced)
  │
  ├── MARKET QUESTION? (about specific geography)
  │   → Extract geography_id
  │   → SELECT * FROM market_briefings WHERE geography_id = ? AND is_latest = true
  │   → SELECT * FROM market_news WHERE ? = ANY(geography_ids)
  │     AND published_at > briefing.generated_date
  │   → Inject briefing + fresh news as context
  │   → DeepSeek V3 responds (3-8s)
  │
  ├── RANKING QUESTION? (top/bottom lists)
  │   → Check rankings_cache (is_latest = true, metric + geo_type + direction)
  │   → If pre-computed: inject, DeepSeek responds (3-8s)
  │   → If not: existing get_rankings tool call (10-15s)
  │   → UI shows "Digging deeper..." for tool fallback
  │
  ├── COMPARISON? (A vs B)
  │   → Fetch briefings for both markets
  │   → Inject both as context
  │   → DeepSeek compares (5-10s)
  │
  ├── COMPLEX ANALYSIS? (correlations, predictions, multi-market filters)
  │   → Existing tool-call architecture
  │   → Escalate to Claude if 3+ tools needed
  │   → UI shows "Digging deeper..." (12-15s)
  │
  └── FOLLOW-UP? (continuing conversation)
      → Prior briefing still in conversation context
      → Augment if new data needed
      → DeepSeek responds (3-6s)
```

### Uncovered Markets (On-Demand Generation)

If a user asks about a market with no briefing (outside top 1,400):
1. Fall back to tool-call architecture for the immediate response
2. Trigger async briefing generation for that market
3. Cache the briefing for future queries
4. Track uncovered market requests — if a market gets 3+ requests, add to the weekly batch

---

## 8. LLM Provider Strategy

| Scenario | Provider | Why |
|----------|----------|-----|
| Briefing-backed query | DeepSeek V3 | Cheap, fast, context is pre-computed |
| Ranking / comparison | DeepSeek V3 | Single lookup or tool call |
| Complex multi-tool analysis | Claude Sonnet | Better multi-step reasoning |
| Batch narrative generation | DeepSeek V3 | Cheap batch processing |
| News summarization | DeepSeek V3 | Simple summarization |

### Auto-Escalation (DeepSeek → Claude)

- 3+ tool calls needed for the query
- User explicitly asks for deep analysis
- DeepSeek response is under 50 tokens (likely confused/stuck)

### Estimated Monthly Costs (500 queries/day)

| Component | Monthly Cost |
|-----------|-------------|
| Briefing generation (weekly, 1,400 markets) | ~$5 |
| News summarization (daily, ~200 articles) | ~$2 |
| News API service | ~$50-150 |
| DeepSeek user queries (95%) | ~$36 |
| Claude escalation (5%) | ~$34 |
| **Total** | **~$130-230/mo** |

---

## 9. Reports Integration — Shared Intelligence Layer

### The Consistency Guarantee

Both Quinn and Reports read from the same briefing. This guarantees they never contradict each other on market assessment.

### What Changes in Report Generation

The existing report orchestrator (`reports-orchestrator.ts`) gets one new step inserted before narrative generation:

```
Existing pipeline:
  1. Parallel data fetch (scores, metrics, historical, news)
  2. Score contexts
  3. Data coverage assessment
  4. Assemble populated_data
  5. Fetch benchmarks
  6. AI narrative generation  ← CHANGE HERE
  7. Persist report

New step before #6:
  5.5. Fetch market briefing for primary geography
       → Inject briefing.market_stance into narrative prompts
       → Inject briefing.risk_flags into narrative prompts
       → Inject briefing.narrative_summary as "market context"
       → Use market_news instead of live news scouting (faster)
```

### Narrative Prompt Enhancement

Each narrative section prompt gets an additional context block:

```
MARKET INTELLIGENCE CONTEXT (from shared briefing):
Market Stance: {briefing.market_stance} ({briefing.stance_signals})
Key Risks: {briefing.risk_flags}
Analyst Summary: {briefing.narrative_summary}
Recent News: {briefing.news_snapshot + fresh market_news}

Your analysis MUST be consistent with this market assessment.
The depth and personalization of your narrative should remain
unchanged — use the user's specific inputs (income, down payment,
priorities) to personalize. But the directional tone must align
with the market stance above.
```

### What Stays the Same

- All section-specific narratives (affordability, timing, stability, growth, bottom line)
- Personalization based on user inputs (income, down payment, priorities, timeline)
- Comparison analysis for multi-market reports
- Score breakdowns and component explanations
- Section-level prompt templates

### Performance Improvement

Report generation gets faster because live news scouting (currently 5-15s with 60s timeout) is replaced by a DB lookup of pre-ingested `market_news`. Estimated report generation time drops from 30-60s to 20-40s.

---

## 10. Rendering System

### Problem

Tables and structured data render inconsistently. Sometimes clean, sometimes broken.

### Solution: Typed Response Blocks

Quinn responses are sequences of typed blocks, each mapping to a specific React component:

| Block Type | Renders As | When |
|-----------|-----------|------|
| `text` | Streaming markdown | Every response — the narrative |
| `metric_card` | Stat card (value + trend arrow + source) | Citing a specific metric |
| `comparison_table` | Side-by-side market cards | Compare queries |
| `rankings_table` | Sorted table with rank, name, value | Ranking queries |
| `trend_chart` | Sparkline or line chart | Trend queries |
| `risk_flags` | Colored alert badges | Risk-related answers |
| `news_list` | Headline cards with source + date | When citing news |
| `follow_ups` | Clickable chip buttons | End of every response |

### Rendering Flow

1. **Stream text** immediately (word by word via SSE)
2. **Animate in structured data** blocks after text completes
3. **Always end with follow-up chips**

User perceives instant response because text starts streaming immediately, even if structured data takes a moment to render.

---

## 11. Wow Factors

### Phase 1 (Ship with v2)

**1. Opinionated Voice**
Briefing includes `market_stance` (rule-based). System prompt: "You are Quinn, a sharp real estate market analyst. Be direct. Have a point of view. When the data supports a clear position, state it confidently. Don't hedge with 'it depends' when the numbers tell a story."

**2. Follow-Up Suggestions**
Briefing pre-computes 3 market-specific suggestions. LLM also generates contextual follow-ups. Rendered as clickable chip buttons at the end of every response.

**3. Confidence in Voice**
System prompt reads confidence level from briefing. Quinn adjusts language:
- A/B confidence: "I have strong data here — this is a reliable picture."
- C/F confidence: "Fair warning — data coverage is thin for this area. Take this with a grain of salt."

**4. Guided First Use**
Empty chat state shows pre-populated starter questions:
> "I'm Quinn, your real estate market analyst. I track 900+ metros and 3,000+ counties. Try asking me:"
> `What are the hottest markets right now?` · `Compare Denver vs Austin` · `Where should I invest for cash flow?`

One click → instant impressive answer. Hook users in 30 seconds.

### Phase 2 (Post-launch)

**5. Memory / Personalization**
Store user's stated investment strategy + watchlist in conversation context. On return visits: "Welcome back — Denver just ticked up 2 points since you last looked at it."

**6. Stream Text, Then Pop Visuals**
SSE streaming for text (existing infrastructure). Delayed animation for structured data blocks below the text. User reads while visuals render.

**7. Shareable Answers**
"Share this analysis" button generates a unique URL per response. Server-renders a preview card with OG tags for link sharing.

---

## 12. Mitigations for Known Risks

### 12.1 Stale Briefings During Breaking Events

**Risk:** Major event (hurricane, employer closure) happens mid-week. Briefing is stale.

**Mitigation:** Event-triggered refresh. During daily news ingestion, if any article for a market scores above a severity threshold (disaster, major closure, policy shock), trigger an emergency briefing refresh for just that market. Threshold: 2+ high-severity articles for the same market in 24 hours.

### 12.2 News Geo-Tagging Accuracy

**Risk:** Articles matched to wrong markets.

**Mitigation:** Conservative matching only. Match on canonical metro names from `geographies` table + curated variation list. Confidence threshold > 0.8 required. Unmatched articles get state-level tag only (available to all markets in that state). No neighborhood or ambiguous matching.

### 12.3 Inconsistent Speed Perception (Tool Fallback)

**Risk:** 80% of queries are 3-8s, then a fallback query takes 15s. Users confused.

**Mitigation:** When falling back to tools, show distinct UI state: "Digging deeper into this one..." with a progress indicator. Track which queries hit fallback — if the same question pattern recurs, add it to the briefing or rankings cache.

### 12.4 Batch Job Failure

**Risk:** Weekly batch fails partway through. Some markets stale, no alert.

**Mitigation:**
- Idempotent per-market execution (can retry individual markets)
- Alerting on partial failure (< 95% success rate → alert to admin)
- `briefing_health` widget in admin dashboard showing freshness per geography
- Staleness check: if briefing is > 10 days old, fall back to tools instead of serving stale context

### 12.5 Markets Outside Top 1,400

**Risk:** User asks about uncovered market. No briefing → no consistency guarantee.

**Mitigation:** On-demand briefing generation. First query falls back to tools. Async job generates briefing for that market. Cached for future queries. If a market gets 3+ requests, auto-add to weekly batch.

### 12.6 Market Stance Accuracy

**Risk:** AI-generated stance could be wrong and propagate to both Quinn and Reports.

**Mitigation:** Stance is **100% rule-based** (see Section 4.1). Derived deterministically from metric thresholds. The LLM writes the narrative consistent with the stance but cannot override it. Bad LLM output = bad narrative (fixable), not bad stance (structural).

---

## 13. Phased Rollout

### Phase 1: Core Intelligence Layer (Weeks 1-4)

- `market_briefings` table + generation pipeline (NestJS service + cron)
- `market_news` table + ingestion pipeline (News API integration)
- `rankings_cache` table + generation
- Rule-based market stance engine
- Risk flag computation
- DeepSeek as primary provider in Quinn
- Updated Quinn query flow (briefing → rankings → tool fallback)
- Report orchestrator reads briefing as narrative anchor
- Wow factors: opinionated voice, follow-ups, confidence in voice, guided first use

### Phase 2: Polish & Wow (Weeks 5-7)

- Typed response blocks + rendering overhaul
- Streaming text + animated structured data
- User memory / personalization (investment strategy, watchlist)
- Shareable answers
- Event-triggered briefing refresh
- On-demand briefing generation for uncovered markets
- Admin dashboard: briefing health, news pipeline status

### Phase 3: Optimize (Weeks 8+)

- Monitor fallback rate → expand briefings/rankings for common patterns
- A/B test DeepSeek vs Claude quality on sampled queries
- Tune escalation triggers based on user satisfaction signals
- Expand county coverage based on usage analytics
- Add more news sources as needed

---

## 14. Key Files to Modify

### Backend (New)

| File | Purpose |
|------|---------|
| `src/market-intelligence/market-intelligence.module.ts` | NestJS module |
| `src/market-intelligence/briefing-generator.service.ts` | Weekly briefing pipeline |
| `src/market-intelligence/news-ingestion.service.ts` | Daily news pipeline |
| `src/market-intelligence/rankings-cache.service.ts` | Rankings pre-computation |
| `src/market-intelligence/market-stance.service.ts` | Rule-based stance engine |
| `src/market-intelligence/risk-flags.service.ts` | Risk flag computation |
| `src/market-intelligence/briefing.types.ts` | TypeScript types |

### Backend (Modify)

| File | Change |
|------|--------|
| `src/analytics-chat/analytics-chat.service.ts` | Add briefing lookup before tool dispatch |
| `src/analytics-chat/quinn-system-prompt.ts` | Update for opinionated voice + confidence |
| `src/analytics-chat/openai.provider.ts` | Ensure DeepSeek V3 as default |
| `src/reports/reports-orchestrator.ts` | Inject briefing before narrative generation |
| `src/reports/reports-narratives.ts` | Add briefing context to prompts |

### Frontend (Modify)

| File | Change |
|------|--------|
| `app/components/quinn/QuinnFloatingButton.tsx` | Guided first use + starter questions |
| `app/components/quinn/` | Add typed response block components |

### Database (New Tables)

- `market_briefings` (Section 4.3)
- `market_news` (Section 5)
- `rankings_cache` (Section 6)

---

## 15. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Median query response time | ~25s | < 8s (briefing-backed) |
| P95 query response time | ~45s | < 15s |
| Monthly LLM cost (500 q/day) | ~$675 | < $230 |
| Quinn-Report consistency | Uncontrolled | 100% (shared stance) |
| User engagement (follow-up rate) | Unknown | > 40% click follow-up |
| First-use completion (guided) | Unknown | > 60% complete first query |
