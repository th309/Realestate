/**
 * Competitor comparison data for SEO comparison pages.
 *
 * Each entry defines a slug-based comparison with feature rows,
 * pricing rows, and a summary paragraph.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComparisonWinner = 'propertyiq' | 'competitor' | 'tie';

export interface FeatureRow {
  feature: string;
  propertyiq: string;
  competitor: string;
  winner: ComparisonWinner;
}

export interface PricingRow {
  tier: string;
  propertyiq: string;
  competitor: string;
}

export interface ComparisonFaq {
  question: string;
  answer: string;
}

export interface ComparisonData {
  slug: string;
  competitorName: string;
  competitorUrl: string;
  title: string;
  description: string;
  features: FeatureRow[];
  pricing: PricingRow[];
  summary: string;
  faqs: ComparisonFaq[];
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const COMPARISONS: ComparisonData[] = [
  {
    slug: 'propertyiq-vs-reventure',
    competitorName: 'Reventure App',
    competitorUrl: 'https://www.reventure.app',
    title: 'PropertyIQ vs Reventure: Which Housing Market Tool Is Better?',
    description:
      'Compare PropertyIQ and Reventure App side by side. See how metro coverage, AI reports, pricing, and data sources stack up for real estate investors.',
    features: [
      { feature: 'Metro Coverage', propertyiq: '925 metros', competitor: '~500 metros', winner: 'propertyiq' },
      { feature: 'ZIP Code Data', propertyiq: '33,000+ ZIPs', competitor: '30,000+ ZIPs', winner: 'propertyiq' },
      { feature: 'AI Market Reports', propertyiq: 'Yes', competitor: 'No', winner: 'propertyiq' },
      { feature: 'YouTube Community', propertyiq: 'No', competitor: '1M+ followers', winner: 'competitor' },
      { feature: 'Mobile App', propertyiq: 'Web only', competitor: 'iOS + Android', winner: 'competitor' },
      { feature: 'Market Scoring', propertyiq: '3 proprietary scores', competitor: 'Forecast Score', winner: 'propertyiq' },
      { feature: 'Data Sources', propertyiq: '6 sources', competitor: '3 sources', winner: 'propertyiq' },
    ],
    pricing: [
      { tier: 'Free', propertyiq: '$0', competitor: '$0' },
      { tier: 'Pro', propertyiq: '$29/mo', competitor: '$49/mo' },
    ],
    summary:
      'PropertyIQ offers broader geographic coverage across 925 metros, AI-powered market reports, and three proprietary scoring models at a lower monthly price. Reventure App brings a massive YouTube community with over one million followers and native mobile apps for iOS and Android. If you value deep analytics and AI insights at a lower cost, PropertyIQ is the stronger choice. If community-driven content and mobile convenience are your priority, Reventure is worth considering.',
    faqs: [
      {
        question: 'Is PropertyIQ better than Reventure?',
        answer:
          'PropertyIQ covers more metros (925 vs ~500), offers AI-generated market reports, and costs $20 less per month on the Pro plan. Reventure has a larger community and mobile apps. For data-driven investors who want the broadest coverage and AI insights, PropertyIQ is the better fit.',
      },
      {
        question: 'How much does PropertyIQ cost vs Reventure?',
        answer:
          'Both offer free tiers. PropertyIQ Pro is $29/month while Reventure Pro is $49/month, making PropertyIQ $240 cheaper per year.',
      },
      {
        question: 'Does PropertyIQ have a mobile app like Reventure?',
        answer:
          'PropertyIQ is currently web-only, optimized for desktop and mobile browsers. Reventure offers dedicated iOS and Android apps. A PropertyIQ mobile app is on the roadmap.',
      },
    ],
  },
  {
    slug: 'propertyiq-vs-mashvisor',
    competitorName: 'Mashvisor',
    competitorUrl: 'https://www.mashvisor.com',
    title: 'PropertyIQ vs Mashvisor: Real Estate Analytics Compared',
    description:
      'Compare PropertyIQ and Mashvisor for real estate investment analysis. See differences in market coverage, scoring, pricing, and short-term rental data.',
    features: [
      { feature: 'Metro Coverage', propertyiq: '925 metros', competitor: '~200 metros', winner: 'propertyiq' },
      { feature: 'Investment Analysis', propertyiq: 'AI scores', competitor: 'Rental analytics', winner: 'tie' },
      { feature: 'Short-Term Rental Data', propertyiq: 'No', competitor: 'Yes', winner: 'competitor' },
      { feature: 'Market Scoring', propertyiq: '3 scores', competitor: '1 cash-on-cash', winner: 'propertyiq' },
      { feature: 'Data Freshness', propertyiq: 'Monthly', competitor: 'Quarterly', winner: 'propertyiq' },
      { feature: 'AI Reports', propertyiq: 'Yes', competitor: 'No', winner: 'propertyiq' },
    ],
    pricing: [
      { tier: 'Free', propertyiq: '$0', competitor: 'No free tier' },
      { tier: 'Pro', propertyiq: '$29/mo', competitor: '$99/mo' },
    ],
    summary:
      'PropertyIQ covers more than four times as many metros as Mashvisor, updates data monthly rather than quarterly, and offers a free tier plus a Pro plan at $29/month compared to Mashvisor\'s $99/month starting price. Mashvisor specializes in short-term rental analytics with Airbnb data, making it a better fit for vacation-rental investors. For broad market analysis with AI-powered scoring at a fraction of the cost, PropertyIQ is the clear winner.',
    faqs: [
      {
        question: 'Is PropertyIQ better than Mashvisor for real estate investing?',
        answer:
          'PropertyIQ covers 925 metros versus Mashvisor\'s ~200, offers three proprietary scoring models, and costs $70 less per month. Mashvisor is stronger for short-term rental analysis with Airbnb-specific data. For general market intelligence, PropertyIQ offers more value.',
      },
      {
        question: 'How much does PropertyIQ cost compared to Mashvisor?',
        answer:
          'PropertyIQ has a free tier and a $29/month Pro plan. Mashvisor has no free tier and starts at $99/month, making PropertyIQ $840 cheaper per year on the paid plan.',
      },
      {
        question: 'Does Mashvisor have features PropertyIQ doesn\'t?',
        answer:
          'Mashvisor includes short-term rental (Airbnb) analytics and occupancy rate data that PropertyIQ does not currently offer. If your strategy focuses on vacation rentals, Mashvisor may be a useful complement.',
      },
    ],
  },
  {
    slug: 'propertyiq-vs-neighborhoodscout',
    competitorName: 'NeighborhoodScout',
    competitorUrl: 'https://www.neighborhoodscout.com',
    title: 'PropertyIQ vs NeighborhoodScout: Housing Analytics Face-Off',
    description:
      'Compare PropertyIQ and NeighborhoodScout for housing market analytics. See how AI scoring, interactive maps, data visualization, and pricing compare.',
    features: [
      { feature: 'Geographic Coverage', propertyiq: '925 metros, 33K ZIPs', competitor: '26,000+ indexed areas', winner: 'propertyiq' },
      { feature: 'AI Scoring', propertyiq: '3 proprietary scores', competitor: 'Crime/school grades', winner: 'propertyiq' },
      { feature: 'Interactive Maps', propertyiq: 'Yes', competitor: 'Yes', winner: 'tie' },
      { feature: 'Data Visualization', propertyiq: 'Graphs + charts', competitor: 'Static tables', winner: 'propertyiq' },
      { feature: 'Price', propertyiq: 'Free tier available', competitor: '$41.60/mo minimum', winner: 'propertyiq' },
      { feature: 'API Access', propertyiq: 'Coming soon', competitor: 'No', winner: 'tie' },
    ],
    pricing: [
      { tier: 'Free', propertyiq: '$0', competitor: 'None' },
      { tier: 'Pro', propertyiq: '$29/mo', competitor: '$41.60/mo' },
      { tier: 'Enterprise', propertyiq: 'Custom', competitor: '$208/mo' },
    ],
    summary:
      'PropertyIQ provides AI-powered market scoring, interactive data visualizations, and a generous free tier at a fraction of the price NeighborhoodScout charges. NeighborhoodScout has deep neighborhood-level crime statistics and school rating data built over many years. For investors who need modern AI-driven market intelligence with interactive tools, PropertyIQ delivers more value. For hyper-local crime and school research, NeighborhoodScout remains a specialized resource.',
    faqs: [
      {
        question: 'Is PropertyIQ better than NeighborhoodScout?',
        answer:
          'PropertyIQ offers AI-powered scoring, interactive charts, and a free tier starting at $0. NeighborhoodScout starts at $41.60/month with no free option. PropertyIQ is the better value for market analysis, while NeighborhoodScout has deeper crime and school data.',
      },
      {
        question: 'How much does PropertyIQ cost vs NeighborhoodScout?',
        answer:
          'PropertyIQ offers a free tier and Pro at $29/month. NeighborhoodScout\'s cheapest plan is $41.60/month (billed annually at $499), with their professional plan at $208/month. PropertyIQ saves you at least $151 per year.',
      },
      {
        question: 'Does NeighborhoodScout have crime and school data that PropertyIQ doesn\'t?',
        answer:
          'Yes. NeighborhoodScout offers detailed neighborhood-level crime statistics and school quality grades that PropertyIQ does not currently include. If crime and school ratings are critical to your research, NeighborhoodScout can complement PropertyIQ\'s market analytics.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Look up a comparison by its URL slug. Returns undefined if not found. */
export function getComparison(slug: string): ComparisonData | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
