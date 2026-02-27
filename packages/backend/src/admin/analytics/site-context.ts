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

export interface BlogPostSummary {
  slug: string;
  title: string;
  category: string;
  targetKeyword: string;
  date: string;
}

export interface ProductContextInput {
  totalUsers: number;
  paidUsers: number;
  activeUsers30d: number;
  hasAnyRealRevenue: boolean;
  blogPosts?: BlogPostSummary[];
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
- There is no existing social media presence or paid marketing
- The platform HAS a blog at /blog — use it for content marketing
- PRIORITY: Build awareness, get first 10-25 real users, validate product-market fit
- Focus on manual outreach, community engagement, and content creation before automation`,

  'early-launch': `PropertyIQ is in EARLY LAUNCH with a small number of real users.
- Some data reflects real user behavior, but sample sizes are too small for statistical significance
- Early signal in paywall events and feature usage — look for patterns but don't over-index
- PRIORITY: Find acquisition channels that work, improve onboarding, gather user feedback
- Focus on repeatable acquisition channels and converting free users to trials/paid
- Start building SEO and content foundation for long-term organic growth`,

  growing: `PropertyIQ is in GROWTH stage with meaningful user traction.
- Data now reflects real user behavior with enough volume for basic analysis
- Conversion funnels and feature usage patterns are statistically meaningful
- PRIORITY: Optimize conversion rates, reduce churn, scale working acquisition channels
- A/B test pricing, onboarding flows, and paywall placement
- Invest in content marketing and SEO for compounding organic traffic`,

  scaling: `PropertyIQ is in SCALING stage with strong user momentum.
- Data volumes are sufficient for detailed cohort analysis and A/B testing
- Funnel optimization and retention improvements have high leverage
- PRIORITY: Maximize LTV, reduce CAC, expand into adjacent markets
- Consider partnerships, integrations, and enterprise sales motion
- Automate everything possible — lifecycle emails, retargeting, referrals`,
};

/**
 * Build blog content section dynamically from live post metadata.
 */
function buildBlogSection(blogPosts?: BlogPostSummary[]): string {
  if (!blogPosts || blogPosts.length === 0) {
    return `=== BLOG CONTENT ===
The platform has a blog at /blog with RSS feed at /blog/rss.xml, but no published articles could be retrieved.
Available categories: market-analysis, investment, methodology, news.
`;
  }

  const categories = Array.from(new Set(blogPosts.map((p) => p.category)));
  const lines = blogPosts.map(
    (p, i) =>
      `${i + 1}. "${p.title}"\n   Slug: /blog/${p.slug} | Category: ${p.category} | Date: ${p.date}\n   Target keyword: "${p.targetKeyword}"`,
  );

  return `=== BLOG CONTENT (${blogPosts.length} published articles at /blog) ===
Content is MDX with SEO metadata, schema.org markup, and reading time. RSS feed at /blog/rss.xml.
Categories in use: ${categories.join(', ')}. Available categories: market-analysis, investment, methodology, news.

${lines.join('\n\n')}

When recommending new blog content, avoid duplicating existing articles. Suggest topics that fill gaps in the current content library.
`;
}

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

=== FULL SITE MAP ===

Public Marketing Pages:
/ (landing page with hero, feature highlights, and CTA)
/pricing (pricing tiers comparison with upgrade CTAs)
/about (company story and mission)
/about/terms (terms of service)
/contact (contact form)
/help (help center / FAQ)
/data (data sources & methodology transparency page)
/blog (blog index with published articles on real estate analytics)
/blog/[slug] (individual blog post)
/blog/rss.xml (RSS feed for blog)

Core Product Pages (require sign-in for full access):
/map (interactive color-coded map with metric overlays — the main product experience)
/market (market explorer — browse/search/rank 925 metros, 3,100+ counties, 33,000+ ZIPs)
/market/[id] (market detail page — scores, metrics, charts for a single market)
/markets (SEO-friendly market directory — static landing pages for organic search)
/markets/[slug] (individual market landing page — SEO-optimized, publicly accessible)
/compare/[slug] (market comparison tool — side-by-side market analysis)
/graphs (time-series analysis — historical trends for any metric)
/metrics/[metricId] (individual metric explorer — deep dive into a single metric across geographies)
/scores (scoring overview — HomeReady, InvestorEdge, Market Health explanation)
/scores/methodology (detailed scoring methodology documentation)
/scores/accuracy (score validation and backtest accuracy results)
/reports (report dashboard — list of user's generated AI reports)
/reports/builder (create AI reports — personalized market analysis generator)
/reports/[id] (view a specific AI report)
/reports/sample (sample report preview — free users can preview report quality)
/shared/report/[token] (publicly shareable report link — viral sharing mechanism)
/dashboard (user dashboard — personalized overview with saved markets and recent activity)
/alerts (watchlist & alerts — saved markets with threshold-based notifications)

Account & Auth:
/auth/sign-up (registration with email/password or OAuth)
/auth/sign-in (login page)
/auth/forgot-password (password reset flow)
/auth/callback (OAuth callback handler)
/account (account settings — profile management)
/account/billing (subscription management — Stripe billing portal)
/account/notifications (notification preferences)
/upgrade/success (post-upgrade confirmation page)

Beta Testing:
/betatest/[token] (beta tester feedback portal — invite-only with unique token)

Admin Panel (internal, not public-facing):
/admin (admin dashboard — system overview)
/admin/analytics (analytics suite — traffic, funnels, AI insights, growth tracking)
/admin/data (data feed management — import status, pipeline health)
/admin/entitlements (entitlement management hub)
/admin/entitlements/users (user tier management — view/change individual user tiers)
/admin/entitlements/tiers (tier configuration — define what each tier includes)
/admin/entitlements/trial (trial settings — duration, features, conversion tracking)
/admin/entitlements/automations (automation rules — tier change triggers)
/admin/entitlements/playbook (entitlements playbook — strategy documentation)
/admin/feedback (user feedback management — review and triage submissions)
/admin/propertyiq-scores (score administration — batch scoring, model monitoring)
/admin/ml-workflow (ML ops — model training pipeline, feature engineering)
/admin/score-validation (score validation — backtest results, accuracy tracking)

Key API Endpoints (frontend-hosted):
/api/newsletter (email newsletter signup)
/api/newsletter/confirm (double opt-in confirmation)
/api/betatest/feedback (beta tester feedback submission)
/api/betatest/upload (beta tester screenshot/file upload)
/api/analytics/chat/[conversationId] (Quinn AI chat — conversational market analysis)
/api/analytics/persistence/* (saved queries, watchlist, alerts, conversations)

${buildBlogSection(input.blogPosts)}
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
