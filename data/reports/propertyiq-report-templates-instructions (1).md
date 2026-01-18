# PropertyIQ Report Templates - Implementation Instructions

## Overview

Build 5 report templates that combine static data visualization with AI-generated analysis and interactive conversation. Reports are available as both interactive web pages and downloadable PDFs.

---

## Report Templates Summary

| # | Report | Primary Audience | Geography | User Inputs |
|---|--------|------------------|-----------|-------------|
| 1 | Market Snapshot | Everyone | Single | None required |
| 2 | Market Comparison | Relocators, Investors | 2-5 markets | Market selection, optional weights |
| 3 | Investment Analysis | Investors | Single | Optional financials |
| 4 | Affordability & Migration | Buyers, Developers, Policy | Single | Optional income |
| 5 | Market Cycle & Risk | Sophisticated Investors | Single | Optional scenarios |

---

## Subscription Tier Access

| Feature | Free | Basic | Pro | Enterprise |
|---------|------|-------|-----|------------|
| Reports per month | 2 | 10 | Unlimited | Unlimited |
| Report types | Snapshot only | All 5 | All 5 | All 5 + custom |
| AI conversation exchanges | 3 | 15 | Unlimited | Unlimited |
| Conversation persistence | Session only | 30 days | Unlimited | Unlimited |
| Multi-report memory | No | No | Yes | Yes |
| Component score breakdown | No | No | Yes | Yes |
| PDF export | No | Yes | Yes | Yes |
| CSV data export | No | No | Yes | Yes |
| White label | No | No | No | Yes |

---

## Part 1: Core Report Infrastructure

### 1.1 Database Schema

```sql
-- Reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),  -- For white label
  
  -- Report definition
  report_type TEXT NOT NULL,  -- 'snapshot', 'comparison', 'investment', 'affordability', 'cycle'
  title TEXT NOT NULL,
  
  -- Geography
  primary_geography_id TEXT NOT NULL,
  primary_geography_type TEXT NOT NULL,
  primary_geography_name TEXT NOT NULL,
  comparison_geographies JSONB,  -- Array for comparison reports
  
  -- User inputs
  user_inputs JSONB,  -- Budget, income, preferences, etc.
  
  -- Scores (snapshot at generation time)
  scores JSONB,
  
  -- Generated content
  static_content JSONB,     -- Charts, tables, metrics
  ai_narrative JSONB,       -- AI-generated analysis sections
  
  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'generating', 'ready', 'failed'
  
  -- Metadata
  data_as_of_date DATE,
  confidence_level TEXT,    -- 'high', 'medium', 'low'
  generation_time_ms INTEGER,
  
  -- Branding (for white label)
  branding_config JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ    -- For free tier
);

-- Conversations table
CREATE TABLE report_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  
  -- Conversation state
  messages JSONB DEFAULT '[]',  -- Array of {role, content, timestamp}
  user_profile JSONB,           -- Accumulated from conversation
  exchange_count INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'active',  -- 'active', 'archived', 'exported'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User memory (for Pro tier multi-report context)
CREATE TABLE user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE,
  
  -- Accumulated knowledge
  researched_geographies JSONB DEFAULT '[]',
  investment_criteria JSONB,
  preferences JSONB,
  saved_insights JSONB DEFAULT '[]',
  
  -- Settings
  remember_preferences BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- News cache for AI context
CREATE TABLE news_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Geography
  geography_id TEXT,
  geography_type TEXT,
  geography_name TEXT,
  
  -- Article
  headline TEXT NOT NULL,
  summary TEXT,
  source TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  
  -- Classification
  category TEXT,  -- 'local', 'economic', 'policy', 'development', 'climate'
  relevance_score FLOAT,
  
  -- Cache management
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_news_geography ON news_cache(geography_id, geography_type);
CREATE INDEX idx_news_expires ON news_cache(expires_at);
```

### 1.2 Report Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    REPORT GENERATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. USER REQUEST                                                │
│     ├─> Select report type                                      │
│     ├─> Select geography (or multiple for comparison)           │
│     ├─> Optional: provide inputs (budget, income, etc.)         │
│     └─> Submit request                                          │
│                                                                 │
│  2. VALIDATION                                                  │
│     ├─> Check subscription tier allows report type              │
│     ├─> Check monthly report limit                              │
│     ├─> Validate geography exists in system                     │
│     └─> Return error or proceed                                 │
│                                                                 │
│  3. DATA ASSEMBLY                                               │
│     ├─> Fetch current metrics from market_data                  │
│     ├─> Fetch scores from market_scores                         │
│     ├─> Fetch historical data for trends                        │
│     ├─> Fetch comparison/benchmark data (national, state)       │
│     ├─> Fetch recent news from news_cache                       │
│     └─> Calculate derived metrics                               │
│                                                                 │
│  4. STATIC CONTENT GENERATION                                   │
│     ├─> Build chart configurations                              │
│     ├─> Populate metric cards                                   │
│     ├─> Generate comparison tables                              │
│     └─> Calculate rankings                                      │
│                                                                 │
│  5. AI NARRATIVE GENERATION                                     │
│     ├─> Construct context prompt with all data                  │
│     ├─> Call Claude/Gemini API                                  │
│     ├─> Parse response into sections                            │
│     ├─> Validate output quality                                 │
│     └─> Store narrative content                                 │
│                                                                 │
│  6. FINALIZE REPORT                                             │
│     ├─> Combine static + AI content                             │
│     ├─> Set data_as_of_date                                     │
│     ├─> Update status='ready'                                   │
│     └─> Initialize conversation                                 │
│                                                                 │
│  7. NOTIFY USER                                                 │
│     └─> Email/push notification that report is ready            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Branding Configuration

```typescript
// src/config/report-branding.ts

interface ReportBranding {
  // Identity
  logo_url: string;
  company_name: string;
  tagline?: string;
  
  // Colors
  primary_color: string;      // Headers, accents
  secondary_color: string;    // Subheadings
  accent_color: string;       // Highlights, CTAs
  
  // Typography
  heading_font?: string;
  body_font?: string;
  
  // Contact
  website_url?: string;
  email?: string;
  phone?: string;
  
  // Legal
  disclaimer_text?: string;
  
  // Footer
  footer_text: string;
  show_powered_by: boolean;   // "Powered by PropertyIQ"
}

const DEFAULT_BRANDING: ReportBranding = {
  logo_url: '/images/propertyiq-logo.svg',
  company_name: 'PropertyIQ',
  tagline: 'Intelligent Real Estate Insights',
  primary_color: '#1a56db',
  secondary_color: '#374151',
  accent_color: '#059669',
  heading_font: 'Inter',
  body_font: 'Inter',
  website_url: 'https://propertyiq.com',
  disclaimer_text: 'This report is for informational purposes only and does not constitute financial, legal, or investment advice.',
  footer_text: '© 2025 PropertyIQ. All rights reserved.',
  show_powered_by: false
};
```

---

## Part 2: Template 1 - Market Snapshot Report

### 2.1 Purpose
Quick pulse on any single market. Entry-point report, shareable, designed for broad audience.

### 2.2 User Inputs

```typescript
interface SnapshotInputs {
  geography: {
    id: string;
    type: 'metro' | 'county' | 'zip';
    name: string;
  };
  // No other required inputs
}
```

### 2.3 Structure

```
PAGE 1 - COVER
├── Report Title: "Market Snapshot: [Geography Name]"
├── PropertyIQ Overall Scores (dual gauges)
│   ├── HomeReady Score: [XX] with trend arrow
│   └── InvestorEdge Score: [XX] with trend arrow
├── Generation Date: [Date]
├── Data As Of: [Date]
├── Confidence Level: [High/Medium/Low]
└── Logo (PropertyIQ or white-label)

PAGE 2 - EXECUTIVE SUMMARY
├── Market Verdict Bar
│   └── Buyer's Market ◄────●────► Seller's Market
│
├── Hero Metrics (6 cards, 2x3 grid)
│   ├── Home Value: $XXX,XXX [▲/▼ X.X% YoY] [vs national: +/-X%]
│   ├── Typical Rent: $X,XXX/mo [▲/▼ X.X% YoY] [vs national: +/-X%]
│   ├── Market Heat: [XX/100] [Hot/Warm/Cool/Cold]
│   ├── Days to Pending: [XX days] [▲/▼ X days YoY]
│   ├── For-Sale Inventory: [X,XXX] [▲/▼ X.X% YoY]
│   └── Affordability Index: [XX] [Above/Below median income]
│
├── AI Market Summary (3-5 sentences)
│   └── "[Geography] is currently a [buyer's/seller's/balanced] market.
│        Key drivers include [factor 1], [factor 2], and [factor 3].
│        Compared to [state/national] averages, this market shows
│        [strength/weakness] in [area]. [Forward-looking statement]."
│
└── Quick Facts Box
    ├── Population: X,XXX,XXX
    ├── Median Income: $XX,XXX
    ├── Unemployment: X.X%
    └── 1-Year Forecast: [▲/▼ X.X%]

PAGE 3 - TRENDS (Optional)
├── 12-Month Trend Charts (2x2 grid)
│   ├── Home Value Trend (with ZHVF forecast overlay)
│   ├── Rent Trend
│   ├── Inventory Trend
│   └── Days to Pending Trend
│
└── Key Observations (AI-generated bullet points)
    ├── "[Most notable trend observation]"
    ├── "[Second observation]"
    └── "[Third observation]"
```

### 2.4 Data Requirements

```typescript
interface SnapshotData {
  // Current metrics
  current: {
    zhvi: number;
    zhvi_yoy: number;
    zori: number;
    zori_yoy: number;
    market_heat_index: number;
    days_to_pending: number;
    days_to_pending_yoy: number;
    for_sale_inventory: number;
    inventory_yoy: number;
    affordability_index: number;
  };
  
  // Scores
  scores: {
    homeready_score: number;
    homeready_trend: 'up' | 'down' | 'stable';
    investoredge_score: number;
    investoredge_trend: 'up' | 'down' | 'stable';
  };
  
  // Benchmarks
  benchmarks: {
    national: { zhvi: number; zori: number; /* ... */ };
    state: { zhvi: number; zori: number; /* ... */ };
  };
  
  // Time series (12 months)
  trends: {
    zhvi: TimeSeriesPoint[];
    zori: TimeSeriesPoint[];
    inventory: TimeSeriesPoint[];
    days_to_pending: TimeSeriesPoint[];
  };
  
  // Forecast
  forecast: {
    zhvf_1yr: number;
    zhvf_1yr_pct: number;
  };
  
  // Context
  demographics: {
    population: number;
    median_income: number;
    unemployment_rate: number;
  };
  
  // News
  recent_news: NewsItem[];
}
```

### 2.5 AI Prompt Template

```
CONTEXT:
You are PropertyIQ's market analyst generating a Market Snapshot report for {geography_name}.

CURRENT DATA:
- Home Value (ZHVI): ${zhvi} ({zhvi_yoy}% YoY)
- Typical Rent (ZORI): ${zori}/mo ({zori_yoy}% YoY)
- Market Heat Index: {heat_index}/100
- Days to Pending: {days_to_pending} days
- For-Sale Inventory: {inventory} homes ({inventory_yoy}% YoY)
- Affordability Index: {affordability}
- 1-Year Forecast: {zhvf_1yr_pct}%

BENCHMARKS:
- National ZHVI: ${national_zhvi}
- State ZHVI: ${state_zhvi}
- National Rent: ${national_zori}

SCORES:
- HomeReady Score: {homeready}/100 (trending {homeready_trend})
- InvestorEdge Score: {investoredge}/100 (trending {investoredge_trend})

RECENT NEWS:
{news_items}

INSTRUCTIONS:
Generate a concise market summary (3-5 sentences) covering:
1. Overall market condition (buyer's/seller's/balanced)
2. Key driving factors
3. Comparison to benchmarks
4. Forward-looking statement

Also generate 3 key trend observations as bullet points.

OUTPUT FORMAT:
Return as JSON:
{
  "market_summary": "...",
  "trend_observations": ["...", "...", "..."],
  "market_type": "buyers" | "sellers" | "balanced"
}
```

---

## Part 3: Template 2 - Market Comparison Report

### 3.1 Purpose
Side-by-side analysis for users deciding between multiple markets.

### 3.2 User Inputs

```typescript
interface ComparisonInputs {
  // Required
  geographies: {
    id: string;
    type: string;
    name: string;
  }[];  // 2-5 markets
  
  // Optional
  primaryPurpose?: 'relocating' | 'investing' | 'both';
  
  // Optional weighting (sliders 1-5)
  priorities?: {
    affordability?: number;
    jobMarket?: number;
    cashFlow?: number;
    appreciation?: number;
    safety?: number;
    schools?: number;
  };
}
```

### 3.3 Structure

```
PAGE 1 - COVER
├── Report Title: "Market Comparison"
├── Markets: [Market 1] vs [Market 2] vs [Market 3]...
├── Score Summary Badges (horizontal)
│   └── Each market with HomeReady + InvestorEdge mini-scores
├── Generation Date / Data As Of
└── Logo

PAGE 2 - SCORE COMPARISON
├── Radar/Spider Chart
│   └── All markets overlaid showing component scores
│
├── Winner Badges
│   ├── 🏆 Best for Buyers: [Market] (HomeReady: XX)
│   ├── 💰 Best for Cash Flow: [Market] (Cash Flow Score: XX)
│   ├── 📈 Best for Growth: [Market] (Growth Score: XX)
│   ├── 🛡️ Lowest Risk: [Market] (Risk Score: XX)
│   └── 💎 Best Overall Value: [Market]
│
└── Score Table
    └── Component | Market 1 | Market 2 | Market 3 | ...
        (color-coded: green=best, red=worst in row)

PAGE 3 - METRICS COMPARISON
├── Full Comparison Grid
│   └── Metric | Market 1 | Market 2 | Market 3 | National
│       - Home Value
│       - Rent
│       - Price/Rent Ratio
│       - Days on Market
│       - Inventory
│       - Price Cut %
│       - Appreciation (1Y, 5Y)
│       - Income Needed
│       - Population Growth
│       - Job Growth
│       ... (15-20 key metrics)
│
└── User Priority Highlights (if priorities provided)
    └── Callout box showing how markets rank on user's priorities

PAGE 4 - TREND COMPARISON
├── Overlaid Line Charts
│   ├── Home Value (5 years, all markets)
│   ├── Rent (3 years, all markets)
│   └── Inventory (2 years, all markets)
│
└── Divergence Analysis
    └── "Since 2020, [Market 1] has appreciated X% while [Market 2]..."

PAGE 5 - AI ANALYSIS
├── Comparative Narrative (5-7 paragraphs)
│   ├── Overall comparison summary
│   ├── Each market's unique strengths
│   ├── Each market's key challenges
│   ├── Hidden factors not obvious from metrics
│   └── Migration flows between these markets (if applicable)
│
├── Best Fit Recommendations
│   ├── "Best for first-time buyers: [Market] because..."
│   ├── "Best for families: [Market] because..."
│   ├── "Best for investors: [Market] because..."
│   └── "Best for remote workers: [Market] because..."
│
└── Personalized Recommendation (if user provided priorities)
    └── "Based on your priorities, [Market] is the strongest match..."

PAGE 6 - DECISION MATRIX
├── Pros/Cons Table
│   └── Market | Pros | Cons
│
└── Final Verdict
    └── AI-generated recommendation with reasoning
```

### 3.4 AI Prompt Template

```
CONTEXT:
You are PropertyIQ's market analyst generating a Market Comparison report.

MARKETS BEING COMPARED:
{for each market: name, type, state, scores, key metrics}

USER PROFILE (if provided):
- Primary Purpose: {relocating/investing/both}
- Priorities: {affordability: X, jobMarket: X, cashFlow: X, ...}

INSTRUCTIONS:
Generate a comprehensive comparison analysis:

1. OVERALL COMPARISON (2-3 paragraphs)
- Which market leads overall and why
- Key differentiators between markets
- Any surprising findings

2. INDIVIDUAL MARKET ANALYSIS (1 paragraph each)
For each market:
- Unique strengths
- Key challenges
- Best suited for what type of buyer/investor

3. HIDDEN FACTORS
- Insights not obvious from the numbers
- Qualitative differences (culture, lifestyle, climate)
- Regulatory or policy differences

4. MIGRATION CONTEXT
- Are people moving between these markets?
- Which direction is the flow?

5. BEST FIT RECOMMENDATIONS
- Best for first-time buyers
- Best for families
- Best for cash flow investors
- Best for appreciation investors
- Best for remote workers

6. PERSONALIZED RECOMMENDATION (if user priorities provided)
- Synthesize user's stated priorities
- Provide clear recommendation with reasoning
- Acknowledge trade-offs

7. PROS/CONS
For each market, provide:
- 3 specific pros
- 3 specific cons

OUTPUT FORMAT:
Return as JSON with structured sections
```

---

## Part 4: Template 3 - Investment Analysis Report

### 4.1 Purpose
Deep dive for rental property investors evaluating a market for buy-and-hold investing.

### 4.2 User Inputs

```typescript
interface InvestmentInputs {
  geography: GeographyInfo;
  
  // Optional - for pro forma
  financials?: {
    purchasePrice?: number;
    downPaymentPercent?: number;
    interestRate?: number;
    expectedRent?: number;
    propertyTaxRate?: number;
    insuranceAnnual?: number;
    maintenancePercent?: number;  // of rent
    vacancyPercent?: number;
    propertyManagementPercent?: number;
  };
  
  // Optional - investment profile
  profile?: {
    investorType?: 'first_time' | 'experienced' | 'institutional';
    goal?: 'cash_flow' | 'appreciation' | 'balanced';
    holdPeriod?: '3-5' | '5-10' | '10+';
    managementStyle?: 'self' | 'professional';
  };
}
```

### 4.3 Structure

```
PAGE 1 - COVER
├── Report Title: "Investment Analysis: [Geography Name]"
├── InvestorEdge Score (large gauge)
│   └── Component breakdown preview: Cash Flow | Growth | Demand | Entry | Risk
├── Investment Verdict Badge: Strong Buy / Buy / Hold / Caution / Avoid
├── Generation Date / Data As Of
└── Logo

PAGE 2 - EXECUTIVE SUMMARY
├── Investment Verdict
│   └── Strong Buy / Buy / Hold / Caution / Avoid (with 1-sentence rationale)
│
├── Key Investment Metrics (4 cards)
│   ├── Gross Rent Multiplier: XX.X [Good/Fair/Poor]
│   ├── Rent/Price Ratio: X.XX% [percentile vs all metros]
│   ├── Cap Rate Proxy: X.X% [vs 10-year average]
│   └── ZORDI (Rental Demand): XX [▲/▼]
│
├── Strengths/Risks Summary
│   ├── 🟢 Top 3 Investment Strengths
│   └── 🔴 Top 3 Investment Risks
│
└── AI Investment Thesis (3-4 sentences)
    └── Bull case and key watchlist items

PAGE 3 - CASH FLOW ANALYSIS
├── Rent Metrics
│   ├── Typical Rent (ZORI): $X,XXX/mo
│   ├── Rent Growth (YoY): X.X%
│   ├── Rent Growth (5Y CAGR): X.X%
│   └── Rent vs. National: +/-X%
│
├── Rental Demand (ZORDI)
│   ├── Current Index: XX
│   ├── Trend: [chart 12-month]
│   └── Interpretation: "Strong/Moderate/Weak demand"
│
├── Renter Affordability
│   ├── Rent-to-Income Ratio: XX%
│   ├── Trend: Improving/Stable/Worsening
│   └── Risk Flag: [if >35%]
│
└── Cash Flow Score Component Breakdown (Pro tier only)
    └── What's helping, what's hurting

PAGE 4 - APPRECIATION POTENTIAL
├── Historical Performance
│   ├── 1-Year Appreciation: X.X%
│   ├── 3-Year Appreciation: X.X%
│   ├── 5-Year Appreciation: X.X%
│   ├── 10-Year Appreciation: X.X%
│   └── Chart: ZHVI history (10 years)
│
├── Forecast
│   ├── 1-Year Forecast (ZHVF): X.X%
│   └── Confidence: High/Medium/Low
│
├── Growth Drivers
│   ├── Population Growth: X.X%
│   ├── Job Growth: X.X%
│   ├── Income Growth: X.X%
│   └── Migration: Net +/-X,XXX
│
└── Comparison to Similar Markets
    └── Table: 3-5 comparable metros with growth rates

PAGE 5 - RISK ASSESSMENT
├── Risk Score Gauge
│   └── Low / Moderate / Elevated / High
│
├── Risk Indicators Dashboard
│   ├── Inventory Trend: [▲/▼] [chart]
│   ├── Days on Market: [▲/▼] [chart]
│   ├── Price Cut %: XX% [vs 6mo avg]
│   ├── Sale-to-List Ratio: XX% [trend]
│   └── Market Heat: XX/100 [trend]
│
├── Cycle Position
│   └── Early Recovery → Expansion → Hyper Supply → Recession
│       [indicator showing current position]
│
└── Risk Factor Breakdown
    ├── What's elevating risk
    └── What's mitigating risk

PAGE 6 - COMPARABLE MARKETS
├── Why These Comparables
│   └── "Selected based on similar population, economy, and price point"
│
├── Comparison Table
│   └── Metric | This Market | Comp 1 | Comp 2 | Comp 3
│       - InvestorEdge Score
│       - Rent/Price Ratio
│       - 5Y Appreciation
│       - Population Growth
│       - Risk Score
│
└── Insights
    └── "Outperforms on X, underperforms on Y"

PAGE 7 - PRO FORMA (if user inputs provided)
├── Purchase Assumptions
│   ├── Purchase Price: $XXX,XXX
│   ├── Down Payment: $XX,XXX (XX%)
│   ├── Loan Amount: $XXX,XXX
│   ├── Interest Rate: X.XX%
│   └── Loan Term: 30 years
│
├── Monthly Cash Flow
│   ├── Gross Rent: $X,XXX
│   ├── - Vacancy (X%): -$XXX
│   ├── - Property Management (X%): -$XXX
│   ├── - Maintenance (X%): -$XXX
│   ├── = Effective Gross Income: $X,XXX
│   ├── - Mortgage (P&I): -$X,XXX
│   ├── - Property Tax: -$XXX
│   ├── - Insurance: -$XXX
│   └── = Net Cash Flow: $XXX/mo
│
├── Returns
│   ├── Cash-on-Cash Return: X.X%
│   ├── Cap Rate: X.X%
│   └── Total Return (with appreciation): X.X%
│
└── Sensitivity Analysis
    └── Table showing cash flow at different rent/rate scenarios
```

### 4.4 AI Prompt Template

```
CONTEXT:
You are PropertyIQ's investment analyst generating an Investment Analysis report for {geography_name}.

INVESTMENT METRICS:
- InvestorEdge Score: {score}/100
- Gross Rent Multiplier: {grm}
- Rent/Price Ratio: {rent_price_ratio}%
- Cap Rate Proxy: {cap_rate}%
- ZORDI (Rental Demand): {zordi}
- Renter Affordability (Rent/Income): {rent_to_income}%

GROWTH DATA:
- 1Y Appreciation: {appreciation_1y}%
- 5Y Appreciation: {appreciation_5y}%
- 1Y Forecast: {forecast}%
- Population Growth: {pop_growth}%
- Job Growth: {job_growth}%

RISK INDICATORS:
- Risk Score: {risk_score}/100
- Inventory Change YoY: {inventory_yoy}%
- Days on Market: {dom} days
- Price Cut %: {price_cut_pct}%
- Market Heat: {heat}/100

COMPARABLE MARKETS:
{comparable market data}

USER PROFILE (if provided):
- Investor Type: {first_time/experienced/institutional}
- Goal: {cash_flow/appreciation/balanced}
- Hold Period: {3-5/5-10/10+} years

INSTRUCTIONS:
Generate investment analysis including:

1. INVESTMENT VERDICT
- Clear recommendation: Strong Buy / Buy / Hold / Caution / Avoid
- 1-sentence rationale

2. INVESTMENT THESIS (3-4 paragraphs)
- Bull case: Why invest here
- Bear case: Key risks
- Optimal strategy for this market
- Key watchlist items that would change the thesis

3. STRENGTHS (top 3)
- Specific, data-backed investment strengths

4. RISKS (top 3)
- Specific, data-backed investment risks

5. COMPARABLE ANALYSIS
- How this market compares to peers
- Where it outperforms/underperforms

6. PERSONALIZED RECOMMENDATION (if profile provided)
- Tailored advice based on investor's stated goals

OUTPUT FORMAT:
Return as JSON with structured sections
```

---

## Part 5: Template 4 - Affordability & Migration Report

### 5.1 Purpose
Demographics, affordability deep-dive, and population flow analysis.

### 5.2 User Inputs

```typescript
interface AffordabilityInputs {
  geography: GeographyInfo;
  
  // Optional - for personalized affordability
  householdIncome?: number;
  
  // Optional - for savings analysis
  savingsRate?: number;  // percent of income saved
  currentSavings?: number;
}
```

### 5.3 Structure

```
PAGE 1 - COVER
├── Report Title: "Affordability & Migration: [Geography Name]"
├── HomeReady Score (gauge)
├── Affordability Status: Affordable / Stretched / Unaffordable
├── Net Migration: +X,XXX or -X,XXX annually
├── Generation Date / Data As Of
└── Logo

PAGE 2 - AFFORDABILITY DASHBOARD
├── Key Affordability Metrics
│   ├── Median Home Price: $XXX,XXX
│   ├── Median Household Income: $XX,XXX
│   ├── Income Needed to Buy: $XXX,XXX
│   ├── Affordability Gap: +/- $XX,XXX
│   └── Income Percentile Required: XXth
│
├── Buy vs Rent Gap Visualization
│   └── Horizontal bar: Income Needed to Buy | Median Income | Income Needed to Rent
│       [visual showing gaps]
│
├── Affordability Index Trend
│   └── 5-year chart showing improving/worsening
│
└── Years to Save for Down Payment
    └── At 10% savings rate: X.X years
    └── At 15% savings rate: X.X years
    └── "Requires income in top XX% of households"

PAGE 3 - PERSONALIZED AFFORDABILITY (if income provided)
├── Your Affordability Assessment
│   ├── Can You Afford to Buy? [Yes/Stretch/No]
│   ├── Can You Afford to Rent? [Yes/Stretch/No]
│   └── Affordable Price Range for You: $XXX,XXX - $XXX,XXX
│
├── Monthly Budget Breakdown
│   └── At your income, recommended housing budget is $X,XXX/mo
│
├── Savings Timeline
│   └── At 10% savings rate, X.X years to 20% down on median home
│
└── Recommended Areas
    └── If current geography unaffordable, suggest nearby alternatives

PAGE 4 - MIGRATION PATTERNS
├── Net Migration Summary
│   └── Large number: +X,XXX or -X,XXX annually
│
├── Migration Flow Visualization
│   └── Sankey or chord diagram if possible, or table
│
├── Top 5 Origin Markets
│   └── Where people are moving FROM (with volumes)
│
├── Top 5 Destination Markets
│   └── Where people are leaving TO (with volumes)
│
├── Migration Trend (5-year chart)
│   └── Net migration over time
│
└── Why People Are Moving
    └── AI analysis of push/pull factors

PAGE 5 - DEMOGRAPHIC PROFILE
├── Population Overview
│   ├── Current Population: X,XXX,XXX
│   ├── Growth Rate: +X.X% annually
│   └── Density: X,XXX per sq mile
│
├── Age Distribution (horizontal bar chart)
│   └── Under 25, 25-34, 35-44, 45-54, 55-64, 65+
│
├── Household Composition
│   ├── Family Households: XX%
│   ├── Single Households: XX%
│   ├── Median Age: XX
│   └── Homeownership Rate: XX%
│
├── Education (bar chart)
│   └── High school, Some college, Bachelor's, Graduate
│
└── Remote Work
    └── XX% work from home (vs national XX%)

PAGE 6 - ECONOMIC CONTEXT
├── Employment Overview
│   ├── Unemployment Rate: X.X%
│   ├── Job Growth (YoY): +X.X%
│   └── Labor Force Participation: XX%
│
├── Income Analysis
│   ├── Median Household Income: $XX,XXX
│   ├── Income Growth (YoY): +X.X%
│   ├── Per Capita Income: $XX,XXX
│   └── Income Distribution chart
│
├── Major Industries
│   └── Top 5 industries by employment share
│
├── Major Employers (if available)
│   └── Top employers with recent news
│
└── Economic Outlook
    └── AI analysis of economic trajectory

PAGE 7 - AI NARRATIVE
├── The Story of This Market (3-4 paragraphs)
│   └── Who lives here, why they come, what's changing
│
├── Affordability Trajectory
│   └── Is it getting better or worse? Why?
│
├── Push and Pull Factors
│   ├── What's attracting people
│   └── What's pushing people away
│
├── Policy and Development Factors
│   └── Zoning, development, tax incentives
│
├── Displacement/Gentrification Risk
│   └── If applicable, discuss equity considerations
│
└── Outlook
    └── 3-5 year forward view on affordability and demographics
```

---

## Part 6: Template 5 - Market Cycle & Risk Report

### 6.1 Purpose
Sophisticated analysis of where we are in the cycle, risk factors, and scenario planning.

### 6.2 User Inputs

```typescript
interface CycleInputs {
  geography: GeographyInfo;
  
  // Optional - for scenario analysis
  scenarios?: {
    rateChange?: number;      // e.g., +1 = rates increase 1%
    inventoryChange?: number; // e.g., +20 = inventory up 20%
    recessionProbability?: number;
  };
}
```

### 6.3 Structure

```
PAGE 1 - COVER
├── Report Title: "Market Cycle & Risk: [Geography Name]"
├── Risk Score (large gauge)
│   └── Low / Moderate / Elevated / High
├── Cycle Position Indicator
│   └── Early Recovery → Expansion → Hyper Supply → Recession
├── Generation Date / Data As Of
└── Logo

PAGE 2 - CYCLE POSITION
├── Where Are We in the Cycle?
│   └── Visual indicator on cycle diagram with explanation
│
├── Current vs. Historical Context
│   ├── Current ZHVI vs. 2007 Peak: XX%
│   ├── Current ZHVI vs. 2012 Trough: XX%
│   └── Current ZHVI vs. Pre-COVID (Feb 2020): XX%
│
├── Metrics vs. Historical Ranges
│   └── Box/whisker or percentile bands for:
│       - Home Value
│       - Inventory
│       - Days on Market
│       - Price Cut %
│       Each showing: Min | 25th | Current | 75th | Max (10-year range)
│
└── Cycle Phase Explanation
    └── AI-generated description of what this phase typically means

PAGE 3 - LEADING INDICATORS
├── Inventory Analysis
│   ├── Current: X,XXX
│   ├── YoY Change: XX%
│   ├── Months of Supply: X.X
│   ├── Trend: [chart 24 months]
│   └── Signal: Building / Stable / Declining
│
├── New Listings Momentum
│   ├── Current: X,XXX/month
│   ├── YoY Change: XX%
│   └── Trend: [chart]
│
├── Pending Sales Velocity
│   ├── Days to Pending: XX
│   ├── Change: XX days vs 6mo ago
│   └── Trend: Accelerating / Stable / Slowing
│
├── Price Expectations
│   ├── List Price Growth: X.X%
│   ├── Sale Price Growth: X.X%
│   └── Gap: [indicating where expectations are heading]
│
└── Leading Indicator Summary
    └── Table: Indicator | Current | 3mo Δ | 12mo Δ | Signal

PAGE 4 - STRESS SIGNALS
├── Price Cut Analysis
│   ├── % of Listings with Price Cut: XX%
│   ├── vs 6mo ago: XX%
│   ├── vs 12mo ago: XX%
│   └── Trend: [chart]
│   └── Status: 🟢 Normal / 🟡 Elevated / 🔴 High
│
├── Sale-to-List Ratio
│   ├── Current: XX%
│   ├── Trend: [chart]
│   └── Status: 🟢 Healthy / 🟡 Softening / 🔴 Weak
│
├── Days on Market Trend
│   ├── Current: XX days
│   ├── vs 6mo ago: XX days
│   └── Status indicator
│
├── Market Heat Trajectory
│   ├── Current: XX/100
│   ├── 3mo avg: XX
│   ├── 12mo avg: XX
│   └── Direction: Heating / Stable / Cooling
│
└── Stress Signal Summary
    └── Overall Market Health: Healthy / Caution / Stressed

PAGE 5 - SCENARIO ANALYSIS (if inputs provided)
├── Base Case Forecast
│   ├── 1-Year Price Change: X.X%
│   ├── Confidence: XX%
│   └── Key assumptions
│
├── Scenario 1: Rates +1%
│   ├── Impact on Affordability: X.X%
│   ├── Estimated Price Impact: X.X%
│   └── Timeline: X months
│
├── Scenario 2: Inventory +20%
│   ├── Months of Supply: X.X → X.X
│   ├── Estimated Price Impact: X.X%
│   └── Market Type Shift: [Seller's → Balanced → Buyer's]
│
├── Scenario 3: Recession
│   ├── Historical Drawdown (2008): XX%
│   ├── Estimated Drawdown: XX%
│   ├── Recovery Timeline: X years
│   └── Key differences from 2008
│
└── Scenario Comparison Chart
    └── Visual showing price paths under each scenario

PAGE 6 - RISK SCORE BREAKDOWN
├── Risk Score Components (Pro tier)
│   └── Component | Score | Weight | Status
│       - Valuation Risk
│       - Supply Risk
│       - Demand Risk
│       - Economic Risk
│       - Volatility Risk
│
├── What's Elevating Risk
│   └── Top 3 risk factors with specific data
│
├── What's Mitigating Risk
│   └── Top 3 protective factors with specific data
│
├── Historical Risk Score Trend
│   └── [chart 24 months]
│
└── Comparison to Similar Markets
    └── "Risk is [lower/higher] than XX% of comparable metros"

PAGE 7 - AI RISK NARRATIVE
├── Risk Assessment Summary (2-3 paragraphs)
│   └── Plain-language explanation of risk profile
│
├── Key Watchlist Items
│   └── "Monitor these 3 indicators for early warning signs..."
│
├── Historical Context
│   └── How this market behaved in past downturns
│
├── Defensive Positioning
│   └── Recommendations for risk-averse buyers/investors
│
└── Opportunity in Risk
    └── If any contrarian opportunities exist
```

---

## Part 7: Interactive Conversation System

### 7.1 Conversation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONVERSATION FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. REPORT LOADS                                                │
│     └─> Display static content + AI narrative                   │
│                                                                 │
│  2. CONVERSATION PANEL APPEARS                                  │
│     └─> "I've analyzed [geography]. Ask me anything, or         │
│          answer a few questions for personalized insights."     │
│                                                                 │
│  3. AI ASKS INITIAL QUESTIONS (based on report type)            │
│     │                                                           │
│     │  Market Snapshot:                                         │
│     │  "Are you considering buying, renting, or investing?"     │
│     │                                                           │
│     │  Investment Analysis:                                     │
│     │  "What's your investment goal—cash flow, appreciation,    │
│     │   or balanced? And how long do you plan to hold?"         │
│     │                                                           │
│     │  Market Comparison:                                       │
│     │  "Which factors matter most to you? I can weight          │
│     │   my recommendations accordingly."                        │
│     │                                                           │
│  4. USER RESPONDS                                               │
│     └─> AI updates user_profile, asks follow-up if needed       │
│                                                                 │
│  5. CONVERSATION CONTINUES                                      │
│     ├─> User can ask questions about the data                   │
│     ├─> User can request comparisons                            │
│     ├─> User can ask for recommendations                        │
│     ├─> User can ask about news/events                          │
│     └─> AI maintains context throughout                         │
│                                                                 │
│  6. SESSION END OPTIONS                                         │
│     ├─> Save conversation (Basic+)                              │
│     ├─> Export as PDF appendix                                  │
│     ├─> Generate follow-up report                               │
│     └─> Set alerts                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Conversation State

```typescript
interface ConversationState {
  report_id: string;
  report_type: string;
  geography: GeographyInfo;
  
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }[];
  
  user_profile: {
    // Accumulated from conversation
    buyer_type?: 'first_time' | 'experienced' | 'investor';
    goal?: 'buy' | 'rent' | 'invest' | 'relocate';
    timeline?: 'immediate' | '6_months' | '1_year' | 'exploring';
    budget_range?: { min: number; max: number };
    priorities?: string[];
    concerns?: string[];
    
    // For investors
    investment_goal?: 'cash_flow' | 'appreciation' | 'balanced';
    hold_period?: string;
    existing_properties?: number;
    management_preference?: 'self' | 'professional';
  };
  
  referenced_data: {
    metrics_cited: string[];
    comparisons_made: string[];
    news_discussed: string[];
  };
  
  exchange_count: number;
  subscription_limit: number;
}
```

### 7.3 AI System Prompt for Conversations

```
You are PropertyIQ's market analyst continuing a conversation about the {report_type} report for {geography_name}.

REPORT CONTEXT:
{full report data summary}

USER PROFILE (learned from conversation):
{user_profile}

CONVERSATION HISTORY:
{messages}

GUIDELINES:
- Be analytical but give clear recommendations
- Cite specific numbers from the data
- Acknowledge limitations and uncertainty
- Ask clarifying questions when user intent is unclear
- Connect insights to user's specific situation
- If user asks about something not in your data, say so and suggest alternatives
- Keep responses focused—don't dump everything at once
- Use formatting (bullets, bold) for scannability when appropriate
- When recommending, explain your reasoning

PERSONALITY:
- Confident but not arrogant
- Data-driven but accessible
- Helpful and proactive
- Honest about uncertainty
```

### 7.4 Multi-Report Memory (Pro Tier)

```typescript
// For Pro users, maintain memory across reports

interface UserMemory {
  user_id: string;
  
  // Markets they've researched
  researched_geographies: {
    geography: GeographyInfo;
    report_types: string[];
    last_viewed: Date;
    key_findings: string[];
  }[];
  
  // Investment criteria
  investment_criteria?: {
    goal: string;
    budget_range: { min: number; max: number };
    hold_period: string;
    priorities: string[];
  };
  
  // Saved insights
  saved_insights: {
    report_id: string;
    insight: string;
    saved_at: Date;
  }[];
  
  // Preferences
  preferences: {
    detail_level: 'concise' | 'detailed';
    include_news: boolean;
  };
}

// AI can reference across reports:
// "You've looked at Phoenix, Austin, and Tampa.
//  Based on your cash flow focus, Phoenix offers
//  the best rent/price ratio at 0.7%, compared to
//  Austin (0.5%) and Tampa (0.6%)..."
```

---

## Part 8: News Integration

### 8.1 News Sources by Category

| Category | Sources | Use Case |
|----------|---------|----------|
| Local Real Estate | Local newspapers, real estate blogs | Market-specific news |
| Business/Development | Business journals, press releases | New employers, development |
| Economic | BLS, FRED releases, financial news | Employment, rates, inflation |
| Policy | Government releases, zoning boards | Regulations, tax changes |
| Climate/Risk | NOAA, insurance news | Natural disaster risks |
| National RE | NAR, Redfin, Zillow blogs | Industry trends |

### 8.2 News Fetch Pipeline

```typescript
async function fetchNewsForGeography(
  geography: GeographyInfo
): Promise<NewsItem[]> {
  
  // Check cache first
  const cached = await db.query(`
    SELECT * FROM news_cache
    WHERE geography_id = $1
    AND geography_type = $2
    AND expires_at > NOW()
  `, [geography.id, geography.type]);
  
  if (cached.length > 0) {
    return cached;
  }
  
  // Fetch fresh news
  const searchQueries = [
    `${geography.name} real estate market`,
    `${geography.name} housing prices`,
    `${geography.name} new development construction`,
    `${geography.name} employment jobs`,
    `${geography.name} population growth migration`,
  ];
  
  const articles = await Promise.all(
    searchQueries.map(q => newsAPI.search(q, { days: 90 }))
  );
  
  // Score relevance
  const scored = articles.flat().map(article => ({
    ...article,
    relevance_score: calculateRelevance(article, geography)
  }));
  
  // Filter and dedupe
  const filtered = scored
    .filter(a => a.relevance_score > 0.6)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 20);
  
  // Cache
  await cacheNews(geography, filtered);
  
  return filtered;
}

function calculateRelevance(article: NewsItem, geography: GeographyInfo): number {
  let score = 0;
  
  // Geography mentioned in title
  if (article.headline.toLowerCase().includes(geography.name.toLowerCase())) {
    score += 0.4;
  }
  
  // Real estate keywords
  const reKeywords = ['housing', 'real estate', 'home prices', 'rent', 'mortgage'];
  if (reKeywords.some(k => article.headline.toLowerCase().includes(k))) {
    score += 0.3;
  }
  
  // Recency
  const daysOld = (Date.now() - article.published_at.getTime()) / (1000 * 60 * 60 * 24);
  if (daysOld < 7) score += 0.2;
  else if (daysOld < 30) score += 0.1;
  
  // Source quality
  const qualitySources = ['wsj', 'bloomberg', 'reuters', 'local newspaper'];
  if (qualitySources.some(s => article.source.toLowerCase().includes(s))) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}
```

---

## Part 9: PDF Generation

### 9.1 PDF Structure

```typescript
interface PDFConfig {
  // Page setup
  pageSize: 'letter' | 'a4';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  
  // Branding
  branding: ReportBranding;
  
  // Content options
  includeConversation: boolean;
  includeSavedInsights: boolean;
  
  // Chart rendering
  chartFormat: 'svg' | 'png';
  chartDpi: number;
}

async function generatePDF(
  report: Report,
  conversation?: Conversation,
  config: PDFConfig
): Promise<Buffer> {
  
  const doc = new PDFDocument(config);
  
  // Cover page
  await renderCoverPage(doc, report, config.branding);
  
  // Content pages based on report type
  switch (report.report_type) {
    case 'snapshot':
      await renderSnapshotPages(doc, report);
      break;
    case 'comparison':
      await renderComparisonPages(doc, report);
      break;
    // ... etc
  }
  
  // Optional: Conversation appendix
  if (config.includeConversation && conversation) {
    doc.addPage();
    await renderConversationAppendix(doc, conversation);
  }
  
  // Footer on all pages
  addFooters(doc, config.branding);
  
  return doc.end();
}
```

---

## Part 10: API Endpoints

### 10.1 Report Endpoints

```typescript
// Generate new report
POST /api/v1/reports
Body: {
  report_type: string;
  geography: GeographyInfo;
  comparison_geographies?: GeographyInfo[];
  user_inputs?: object;
}
Response: { report_id: string; status: 'generating' }

// Get report status
GET /api/v1/reports/:id/status
Response: { status: string; progress?: number }

// Get report
GET /api/v1/reports/:id
Response: Report

// List user's reports
GET /api/v1/reports
Query: { page?: number; limit?: number; type?: string }
Response: { reports: Report[]; total: number }

// Delete report
DELETE /api/v1/reports/:id

// Export report as PDF
GET /api/v1/reports/:id/pdf
Query: { include_conversation?: boolean }
Response: PDF binary

// Export report data as CSV
GET /api/v1/reports/:id/csv
Response: CSV binary
```

### 10.2 Conversation Endpoints

```typescript
// Get conversation for report
GET /api/v1/reports/:id/conversation
Response: Conversation

// Send message
POST /api/v1/reports/:id/conversation/messages
Body: { content: string }
Response: { 
  response: string;
  exchange_count: number;
  limit_reached: boolean;
}

// Save insight
POST /api/v1/reports/:id/conversation/insights
Body: { message_id: string; note?: string }
Response: { insight_id: string }

// Generate follow-up report
POST /api/v1/reports/:id/conversation/follow-up
Body: { geography_id: string; additional_inputs?: any }
Response: { new_report_id: string }
```

### 10.3 Memory Endpoints (Pro Tier)

```typescript
// Get user memory
GET /api/v1/user/memory
Response: UserMemory

// Update memory preferences
PATCH /api/v1/user/memory
Body: { remember_preferences?: boolean }

// Clear specific memory
DELETE /api/v1/user/memory/:category
// Categories: researched_geographies, investment_criteria, etc.

// Clear all memory
DELETE /api/v1/user/memory
```

---

## Part 11: Testing Checklist

### Report Generation

For each report template:
- [ ] Static content generates correctly
- [ ] All metrics pull from correct data sources
- [ ] Charts render properly
- [ ] Scores display with correct values
- [ ] AI narrative generates appropriate content
- [ ] AI narrative cites correct numbers
- [ ] Comparison calculations correct (for comparison report)
- [ ] User inputs affect output appropriately
- [ ] PDF exports cleanly
- [ ] Data as-of date accurate

### Conversation System

- [ ] Initial questions appear after report loads
- [ ] User messages process correctly
- [ ] AI responses are contextually appropriate
- [ ] Exchange counting works
- [ ] Limit enforcement works by tier
- [ ] Conversation persists across sessions (Basic+)
- [ ] Memory accumulates across reports (Pro)
- [ ] Insight saving works
- [ ] Follow-up report generation works
- [ ] Alert creation works
- [ ] Conversation exports to PDF

### Subscription Enforcement

- [ ] Free tier limited to Snapshot only
- [ ] Free tier limited to 2 reports/month
- [ ] Free tier limited to 3 exchanges
- [ ] Basic tier limits enforced
- [ ] Pro tier unlimited works
- [ ] Upgrade prompts appear appropriately
- [ ] White label branding applies correctly

### News Integration

- [ ] News fetches for correct geography
- [ ] News categories filter appropriately
- [ ] Relevance scoring filters junk
- [ ] Cache works and respects TTL
- [ ] AI incorporates news appropriately
- [ ] Rate limits handled gracefully

---

## Part 12: Implementation Order

1. **Database schema** - Create all tables
2. **Report generation service** - Core pipeline without AI
3. **Template 1: Market Snapshot** - Simplest template
4. **AI narrative generation** - Add AI to Snapshot
5. **Conversation system** - Basic back-and-forth
6. **PDF generation** - Export capability
7. **Remaining templates** - Build out 2-5
8. **News integration** - Enhance AI with news
9. **Multi-report memory** - Pro tier feature
10. **Subscription enforcement** - Tier limits
11. **White label** - Enterprise branding
12. **Alerts and follow-ups** - Advanced features
