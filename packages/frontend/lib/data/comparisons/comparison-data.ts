/**
 * Raw comparison data entries for SEO comparison pages.
 *
 * Separated from the main comparisons module to keep file sizes
 * within project limits (CLAUDE.md Section 1.3).
 */

import type { ComparisonData } from "../comparisons";

// ---------------------------------------------------------------------------
// Reventure
// ---------------------------------------------------------------------------

export const REVENTURE_COMPARISON: ComparisonData = {
  slug: "propertyiq-vs-reventure",
  competitorName: "Reventure App",
  competitorUrl: "https://www.reventure.app",
  title: "PropertyIQ vs Reventure: Which Housing Market Tool Is Better?",
  description:
    "Compare PropertyIQ and Reventure App side by side. See how metro coverage, AI reports, pricing, and data sources stack up for real estate investors.",
  features: [
    {
      feature: "Metro Coverage",
      propertyiq: "925 metros",
      competitor: "~500 metros",
      winner: "propertyiq",
    },
    {
      feature: "ZIP Code Data",
      propertyiq: "33,000+ ZIPs",
      competitor: "30,000+ ZIPs",
      winner: "propertyiq",
    },
    {
      feature: "AI Market Reports",
      propertyiq: "Yes",
      competitor: "No",
      winner: "propertyiq",
    },
    {
      feature: "YouTube Community",
      propertyiq: "No",
      competitor: "1M+ followers",
      winner: "competitor",
    },
    {
      feature: "Mobile App",
      propertyiq: "Web only",
      competitor: "iOS + Android",
      winner: "competitor",
    },
    {
      feature: "Market Scoring",
      propertyiq: "3 proprietary scores",
      competitor: "Forecast Score",
      winner: "propertyiq",
    },
    {
      feature: "Data Sources",
      propertyiq: "6 sources",
      competitor: "3 sources",
      winner: "propertyiq",
    },
  ],
  pricing: [
    { tier: "Free", propertyiq: "$0", competitor: "$0" },
    { tier: "Pro", propertyiq: "{{PRO_PRICE}}/mo", competitor: "$49/mo" },
  ],
  summary:
    "Reventure App, created by Nick Gerli, has built a strong following through YouTube content focused on macro housing market commentary and broad directional forecasts. The platform provides a Forecast Score and coverage of roughly 500 metros and 30,000 ZIP codes, with dedicated iOS and Android mobile apps. Reventure's strength lies in its educational content and community — over one million YouTube subscribers tune in for Nick's take on housing trends, interest rates, and crash predictions. However, the platform's analytics are primarily descriptive, offering charts and data visualization rather than predictive scoring models.\n\nPropertyIQ takes a fundamentally different approach: quantitative, predictive, and granular. Rather than offering market commentary, PropertyIQ uses machine learning models trained on 6+ years of historical data to generate three proprietary scores — HomeReady, InvestorEdge, and Market Health — across 925 metros, 3,100+ counties, and 33,000+ ZIP codes. These scores are walk-forward validated against actual market outcomes, achieving a 0.37 out-of-sample Information Coefficient across 4 non-overlapping time windows. PropertyIQ also generates AI-powered market reports with narrative analysis, something Reventure does not offer.\n\nBest for: Choose Reventure if you want macro market education, video-based commentary, and a mobile app experience. Choose PropertyIQ if you need data-driven, actionable scores at the metro, county, or ZIP level to guide specific investment or relocation decisions. PropertyIQ's Pro plan is also more affordable at {{PRO_PRICE}}/month compared to Reventure's $49/month, while offering broader coverage and deeper analytics.\n\nThe key difference: PropertyIQ provides validated, quantitative predictions at granular geography levels. Reventure provides commentary and general market direction. They can be complementary — Reventure for the big picture narrative, PropertyIQ for the data-backed decision.",
  faqs: [
    {
      question: "Is PropertyIQ better than Reventure?",
      answer:
        "PropertyIQ covers more metros (925 vs ~500), offers AI-generated market reports, and costs less per month on the Pro plan. Reventure has a larger community and mobile apps. For data-driven investors who want the broadest coverage and AI insights, PropertyIQ is the better fit.",
    },
    {
      question: "How much does PropertyIQ cost vs Reventure?",
      answer:
        "Both offer free tiers. PropertyIQ Pro starts at {{PRO_PRICE}}/month while Reventure Pro is $49/month. See our pricing page for current rates.",
    },
    {
      question: "Does PropertyIQ have a mobile app like Reventure?",
      answer:
        "PropertyIQ is currently web-only, optimized for desktop and mobile browsers. Reventure offers dedicated iOS and Android apps. A PropertyIQ mobile app is on the roadmap.",
    },
    {
      question: "Can I use PropertyIQ and Reventure together?",
      answer:
        "Yes. Many real estate investors use Reventure for macro market education and big-picture housing trends via Nick Gerli's YouTube content, while relying on PropertyIQ for granular, data-driven scoring at the metro, county, and ZIP level. The two platforms complement each other well.",
    },
    {
      question:
        "Does PropertyIQ validate its predictions like Reventure's Forecast Score?",
      answer:
        "PropertyIQ's scores are walk-forward validated across 4 non-overlapping time windows using actual market outcomes, achieving a 0.37 out-of-sample Information Coefficient. Reventure's Forecast Score provides directional guidance but does not publish comparable validation metrics against realized returns.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Mashvisor
// ---------------------------------------------------------------------------

export const MASHVISOR_COMPARISON: ComparisonData = {
  slug: "propertyiq-vs-mashvisor",
  competitorName: "Mashvisor",
  competitorUrl: "https://www.mashvisor.com",
  title: "PropertyIQ vs Mashvisor: Real Estate Analytics Compared",
  description:
    "Compare PropertyIQ and Mashvisor for real estate investment analysis. See differences in market coverage, scoring, pricing, and short-term rental data.",
  features: [
    {
      feature: "Metro Coverage",
      propertyiq: "925 metros",
      competitor: "~200 metros",
      winner: "propertyiq",
    },
    {
      feature: "Investment Analysis",
      propertyiq: "AI scores",
      competitor: "Rental analytics",
      winner: "tie",
    },
    {
      feature: "Short-Term Rental Data",
      propertyiq: "No",
      competitor: "Yes",
      winner: "competitor",
    },
    {
      feature: "Market Scoring",
      propertyiq: "3 scores",
      competitor: "1 cash-on-cash",
      winner: "propertyiq",
    },
    {
      feature: "Data Freshness",
      propertyiq: "Monthly",
      competitor: "Quarterly",
      winner: "propertyiq",
    },
    {
      feature: "AI Reports",
      propertyiq: "Yes",
      competitor: "No",
      winner: "propertyiq",
    },
  ],
  pricing: [
    { tier: "Free", propertyiq: "$0", competitor: "No free tier" },
    { tier: "Pro", propertyiq: "{{PRO_PRICE}}/mo", competitor: "$99/mo" },
  ],
  summary:
    "Mashvisor has carved out a niche in short-term rental (STR) analytics, specializing in Airbnb and VRBO property-level data. The platform covers approximately 200 metros and provides property-level rental estimates, occupancy rate predictions, and cash-on-cash return calculations specifically designed for vacation rental investors. Mashvisor's strength is its ability to estimate nightly rates and annual revenue for individual properties, making it a strong tool for investors who already know which market they want and need property-level STR numbers.\n\nPropertyIQ takes a broader, market-level approach with predictive intelligence. Rather than estimating rental income for a single property, PropertyIQ scores entire markets across 925 metros, 3,100+ counties, and 33,000+ ZIP codes using three proprietary ML models: HomeReady (livability), InvestorEdge (investment potential), and Market Health (market conditions). Data is updated monthly versus Mashvisor's quarterly refresh cycle, and PropertyIQ's scores are validated against actual market outcomes — something Mashvisor's cash-on-cash estimates do not offer.\n\nBest for: Choose Mashvisor if your investment strategy focuses on short-term rentals and you need property-level Airbnb analytics with occupancy and revenue estimates. Choose PropertyIQ if you want predictive market-level intelligence to identify which metros, counties, or ZIP codes are likely to outperform before you start looking at individual properties. Many investors use both — PropertyIQ to select the right market, then Mashvisor to evaluate specific STR properties within that market.\n\nKey difference: PropertyIQ validates its predictions against real outcomes and covers 4x more metros. Mashvisor provides property-level rental estimates that PropertyIQ does not. PropertyIQ also offers a free tier and costs {{PRO_PRICE}}/month for Pro, compared to Mashvisor's $99/month with no free option.",
  faqs: [
    {
      question:
        "Is PropertyIQ better than Mashvisor for real estate investing?",
      answer:
        "PropertyIQ covers 925 metros versus Mashvisor's ~200, offers three proprietary scoring models, and costs significantly less per month. Mashvisor is stronger for short-term rental analysis with Airbnb-specific data. For general market intelligence, PropertyIQ offers more value.",
    },
    {
      question: "How much does PropertyIQ cost compared to Mashvisor?",
      answer:
        "PropertyIQ has a free tier and a Pro plan starting at {{PRO_PRICE}}/month. Mashvisor has no free tier and starts at $99/month. See our pricing page for current rates.",
    },
    {
      question: "Does Mashvisor have features PropertyIQ doesn't?",
      answer:
        "Mashvisor includes short-term rental (Airbnb) analytics and occupancy rate data that PropertyIQ does not currently offer. If your strategy focuses on vacation rentals, Mashvisor may be a useful complement.",
    },
    {
      question: "Can I use PropertyIQ and Mashvisor together?",
      answer:
        "Yes, and many investors do. Use PropertyIQ to identify the best-performing markets using predictive scoring across 925 metros, then use Mashvisor to analyze specific short-term rental properties within those markets. The two platforms address different stages of the investment process.",
    },
    {
      question: "Does PropertyIQ offer Airbnb or short-term rental data?",
      answer:
        "PropertyIQ does not currently include Airbnb-specific analytics like nightly rates or occupancy estimates. PropertyIQ focuses on market-level predictive scoring using home values, rental trends, economic indicators, and demographic data. For STR-specific numbers, Mashvisor is a useful complement.",
    },
  ],
};

// ---------------------------------------------------------------------------
// NeighborhoodScout
// ---------------------------------------------------------------------------

export const NEIGHBORHOODSCOUT_COMPARISON: ComparisonData = {
  slug: "propertyiq-vs-neighborhoodscout",
  competitorName: "NeighborhoodScout",
  competitorUrl: "https://www.neighborhoodscout.com",
  title: "PropertyIQ vs NeighborhoodScout: Housing Analytics Face-Off",
  description:
    "Compare PropertyIQ and NeighborhoodScout for housing market analytics. See how AI scoring, interactive maps, data visualization, and pricing compare.",
  features: [
    {
      feature: "Geographic Coverage",
      propertyiq: "925 metros, 33K ZIPs",
      competitor: "26,000+ indexed areas",
      winner: "propertyiq",
    },
    {
      feature: "AI Scoring",
      propertyiq: "3 proprietary scores",
      competitor: "Crime/school grades",
      winner: "propertyiq",
    },
    {
      feature: "Interactive Maps",
      propertyiq: "Yes",
      competitor: "Yes",
      winner: "tie",
    },
    {
      feature: "Data Visualization",
      propertyiq: "Graphs + charts",
      competitor: "Static tables",
      winner: "propertyiq",
    },
    {
      feature: "Price",
      propertyiq: "Free tier available",
      competitor: "$41.60/mo minimum",
      winner: "propertyiq",
    },
    {
      feature: "API Access",
      propertyiq: "Coming soon",
      competitor: "No",
      winner: "tie",
    },
  ],
  pricing: [
    { tier: "Free", propertyiq: "$0", competitor: "None" },
    { tier: "Pro", propertyiq: "{{PRO_PRICE}}/mo", competitor: "$41.60/mo" },
    {
      tier: "Enterprise",
      propertyiq: "{{ENTERPRISE_PRICE}}/mo",
      competitor: "$208/mo",
    },
  ],
  summary:
    "NeighborhoodScout has been in the real estate data space for over a decade, building a deep repository of neighborhood-level demographics, crime statistics, school quality ratings, and real estate appreciation data. The platform excels at hyperlocal comparisons — you can drill into specific neighborhoods within a city to compare school grades, crime rates by type, and demographic profiles. NeighborhoodScout indexes over 26,000 areas and presents data primarily through static tables and reports. Their analytics are descriptive, showing what a neighborhood looks like today and how it has changed historically.\n\nPropertyIQ focuses on a different problem: predicting which markets will outperform. Instead of neighborhood-level demographics, PropertyIQ uses machine learning models to generate three proprietary scores — HomeReady, InvestorEdge, and Market Health — across 925 metros, 3,100+ counties, and 33,000+ ZIP codes. These scores are walk-forward validated against actual market outcomes, providing a level of predictive rigor that descriptive platforms like NeighborhoodScout do not attempt. PropertyIQ also offers interactive data visualizations, AI-generated market reports, and a map-based exploration interface, compared to NeighborhoodScout's static table format.\n\nBest for: Choose NeighborhoodScout if you need hyperlocal neighborhood comparisons with detailed crime breakdowns, school quality ratings, and demographic profiles — especially useful for homebuyers evaluating specific neighborhoods within a city. Choose PropertyIQ if you need market-level predictive analytics to identify which metros, counties, or ZIP codes are likely to appreciate, with AI-powered scoring and interactive visualizations.\n\nKey difference: PropertyIQ uses ML models validated against real market outcomes to predict future performance. NeighborhoodScout provides descriptive analytics about current and historical neighborhood characteristics. PropertyIQ also offers a free tier, while NeighborhoodScout's cheapest plan starts at $41.60/month billed annually.",
  faqs: [
    {
      question: "Is PropertyIQ better than NeighborhoodScout?",
      answer:
        "PropertyIQ offers AI-powered scoring, interactive charts, and a free tier starting at $0. NeighborhoodScout starts at $41.60/month with no free option. PropertyIQ is the better value for market analysis, while NeighborhoodScout has deeper crime and school data.",
    },
    {
      question: "How much does PropertyIQ cost vs NeighborhoodScout?",
      answer:
        "PropertyIQ offers a free tier and a Pro plan starting at {{PRO_PRICE}}/month. NeighborhoodScout's cheapest plan is $41.60/month (billed annually at $499), with their professional plan at $208/month. See our pricing page for current rates.",
    },
    {
      question:
        "Does NeighborhoodScout have crime and school data that PropertyIQ doesn't?",
      answer:
        "Yes. NeighborhoodScout offers detailed neighborhood-level crime statistics and school quality grades that PropertyIQ does not currently include. If crime and school ratings are critical to your research, NeighborhoodScout can complement PropertyIQ's market analytics.",
    },
    {
      question: "Can I use PropertyIQ and NeighborhoodScout together?",
      answer:
        "Yes. A common approach is to use PropertyIQ's predictive scores to identify promising markets at the metro or county level, then use NeighborhoodScout to compare specific neighborhoods within those markets based on crime, schools, and demographics. The platforms address different stages of the decision process.",
    },
    {
      question:
        "Does PropertyIQ have neighborhood-level data like NeighborhoodScout?",
      answer:
        "PropertyIQ provides data at the metro, county, and ZIP code level — not at the sub-ZIP neighborhood level. NeighborhoodScout offers finer-grained neighborhood comparisons within cities. If you need block-by-block analysis, NeighborhoodScout goes deeper, while PropertyIQ provides broader predictive market intelligence.",
    },
  ],
};
