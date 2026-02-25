/**
 * PropertyIQ Product Context (Dynamic)
 *
 * Generates a product brief for the AI marketing insights system prompt.
 * The stage assessment adapts based on actual platform metrics so the AI's
 * advice evolves as PropertyIQ grows (pre-launch -> early-launch -> growing -> scaling).
 *
 * Static product knowledge (features, pages, data sources) lives here as the
 * single source of truth. Dynamic sections (stage, tier pricing) are injected
 * from the data snapshot at runtime.
 */

export type PlatformStage =
  | 'pre-launch'
  | 'early-launch'
  | 'growing'
  | 'scaling';

export interface ProductContextInput {
  totalUsers: number;
  paidUsers: number;
  activeUsers30d: number;
  hasAnyRealRevenue: boolean;
}

/**
 * Determine growth stage from live metrics.
 */
export function determinePlatformStage(
  input: ProductContextInput,
): PlatformStage {
  const { paidUsers, activeUsers30d } = input;
  if (paidUsers >= 500 || activeUsers30d >= 2000) return 'scaling';
  if (paidUsers >= 50 || activeUsers30d >= 200) return 'growing';
  if (paidUsers >= 5 || activeUsers30d >= 20) return 'early-launch';
  return 'pre-launch';
}

const STAGE_CONTEXT: Record<PlatformStage, string> = {
  'pre-launch': `PropertyIQ is in PRE-LAUNCH stage with almost no real users yet.
- Most data in analytics tables is from INTERNAL TESTING, not organic users
- Paywall events and feature usage are from development testing
- Revenue figures reflect test subscriptions, not organic growth
- The platform has done NO meaningful marketing or outreach yet
- There is no existing blog, social media presence, or content marketing
- PRIORITY: Build awareness, get first 10-25 real users, validate product-market fit
- Focus on manual outreach, community engagement, and content creation before automation`,

  'early-launch': `PropertyIQ is in EARLY LAUNCH with a small number of real users.
- Some data reflects real user behavior, but sample sizes are too small for statistical significance
- Early signal in paywall events and feature usage — look for patterns but don't over-index
- PRIORITY: Find acquisition channels that work, improve onboarding, gather user feedback
- Focus on repeatable acquisition channels and converting free users to trials/paid
- Start building SEO and content foundation for long-term organic growth`,

  'growing': `PropertyIQ is in GROWTH stage with meaningful user traction.
- Data now reflects real user behavior with enough volume for basic analysis
- Conversion funnels and feature usage patterns are statistically meaningful
- PRIORITY: Optimize conversion rates, reduce churn, scale working acquisition channels
- A/B test pricing, onboarding flows, and paywall placement
- Invest in content marketing and SEO for compounding organic traffic`,

  'scaling': `PropertyIQ is in SCALING stage with strong user momentum.
- Data volumes are sufficient for detailed cohort analysis and A/B testing
- Funnel optimization and retention improvements have high leverage
- PRIORITY: Maximize LTV, reduce CAC, expand into adjacent markets
- Consider partnerships, integrations, and enterprise sales motion
- Automate everything possible — lifecycle emails, retargeting, referrals`,
};

/**
 * Build the full product context string for the system prompt.
 * Adapts stage assessment based on live metrics.
 */
export function buildProductContext(input: ProductContextInput): string {
  const stage = determinePlatformStage(input);

  return `
=== PRODUCT OVERVIEW ===
PropertyIQ is an AI-powered real estate market intelligence platform. It uses machine learning to rank 925 US metros, 3,100+ counties, and 33,000+ ZIP codes — helping homebuyers, investors, and real estate professionals identify markets that outperform. The platform combines data from Zillow, Realtor.com, Redfin, US Census, and FRED into proprietary scoring algorithms.

Core value proposition: "We find the markets that outperform" with personalized AI real estate reports.
The founder is a solo developer (not a marketer) building the product. Every recommendation must include specific, actionable steps a developer can follow.

=== CURRENT STAGE: ${stage.toUpperCase()} ===
${STAGE_CONTEXT[stage]}

=== PRICING & TIERS ===
Three-tier freemium model:

FREE (no credit card required):
- Interactive market maps (national & state level only)
- Historical trends & charts
- Preview/sample reports
- Market Health Score (current conditions)
- Limited market snapshots

PRO (monthly/yearly billing, free trial available):
- Everything in Free, plus:
- Metro, county, and ZIP code level data
- PropertyIQ composite scores (HomeReady, InvestorEdge)
- Quinn AI assistant (conversational market analysis)
- Unlimited AI report generation
- CSV data export
- Metric filtering & comparisons

ENTERPRISE (contact sales):
- Everything in Pro, plus:
- Scenario modeling
- Statistical deep dives & advanced analysis
- Team & brokerage features (multiple users)
- Custom data integrations
- Priority support

=== KEY FEATURES ===

1. Market Discovery & Ranking
   - Browse/search/rank 925 metros, 3,100+ counties, 33,000+ ZIPs
   - Sort and filter by PropertyIQ scores
   - Drill-down navigation: state -> metro -> county -> ZIP
   - Interactive color-coded map with metric overlays

2. PropertyIQ Scoring System (0-100 scale with A/B/C/F confidence grades)
   a) HomeReady Score — predicts 3-year excess appreciation for homebuyers
   b) InvestorEdge Score — predicts 3-year excess total return for investors
   c) Market Health Score — real-time demand/supply/price stability (free tier)

3. 50+ Real Estate Metrics across categories:
   - Home Values: ZHVI, listing price, YoY change, forecast, price/sqft
   - Market Activity: inventory, DOM, new listings, pending, sales, price cuts
   - Market Sentiment: heat index, demand score, supply score, pending ratio
   - Economic: unemployment, population growth, job growth, income trends
   - Rental: gross rent, rent growth, rent index, tenant demand
   - Affordability: affordability ratio, income-to-rent, homeownership rate

4. AI Reports (Powered by Claude)
   - Custom narrative reports for any market
   - Sections: overview, score breakdown, trends, investment thesis, risks
   - User inputs: priorities, down payment, investment horizon, income
   - Unlimited for Pro+ users

5. Quinn Analytics Chat (AI Assistant)
   - Conversational market analysis with live data
   - Compare markets, get rankings, analyze trends
   - Pro+ only

6. Time-Series & Charts
   - 3Y/5Y historical trends for any metric
   - Dual-axis charts (score + returns overlay)
   - CSV export for Pro+

7. Alerts & Watchlist
   - Save favorite markets, track score changes
   - Receive alerts when markets cross thresholds

8. Benchmarking
   - Compare any market to national/state/division medians
   - Shows outperformance/underperformance percentages

=== SITE PAGES (user-facing) ===
/ (landing page), /pricing, /map (interactive map), /market (market explorer),
/market/[id] (market detail), /reports (dashboard), /reports/builder (create reports),
/reports/[id] (view report), /graphs (time-series analysis), /scores (methodology),
/dashboard, /alerts, /data (data sources), /help, /contact, /about,
/account, /account/billing, /account/notifications,
/auth/sign-up, /auth/sign-in

=== DATA SOURCES ===
- Zillow ZHVI: Home values, forecasts (State/Metro/County/City/ZIP, monthly)
- Realtor.com: Listings, inventory, DOM, sales (State/Metro/County/ZIP, monthly)
- Redfin: Market activity metrics (State/Metro/County, monthly)
- US Census ACS: Population, income, demographics (all levels, annual)
- FRED: Economic indicators, unemployment (Metro/State, various)
- PropertyIQ Calculated: Derived metrics, composite scores (all levels, monthly)

=== TARGET CUSTOMER SEGMENTS ===
1. First-time homebuyers searching for affordable, appreciating markets
2. Real estate investors looking for high-return rental or flip markets
3. Real estate agents/brokers needing market intelligence for clients
4. Institutional investors analyzing portfolios across geographies

=== COMPETITIVE LANDSCAPE ===
Competitors include Zillow (consumer home search, no scoring), Redfin (brokerage-first),
Realtor.com (listing aggregator), Altos Research (agent-focused), and HouseCanary (institutional).
PropertyIQ differentiates via ML-backed predictive scores, comprehensive multi-source data
fusion, free entry tier, and personalized AI narrative reports.

=== DEPLOYMENT ===
- Frontend: Railway (propertyiq.up.railway.app)
- Backend: Railway (backend-production-ee4d.up.railway.app)
- Database: Supabase (cloud PostgreSQL)
`;
}
