/**
 * Static Sample Report
 *
 * Resilient fallback for the public sample report endpoint.
 * This data is served when no sample report exists in the database,
 * ensuring the /reports/sample page always works.
 *
 * Based on a HomeReady report for the Dallas-Fort Worth metro area.
 */

export const STATIC_SAMPLE_REPORT = {
  // ---- Identity ----
  id: 'f4b04e7c-34cc-4e38-bdac-541fff06de1e',
  template_id: '00000000-0000-0000-0000-000000000001',
  template_version: 1,
  user_id: '00000000-0000-0000-0000-000000000000',
  organization_id: null,
  user_type: 'homebuyer',
  title: 'HomeReady Report — Dallas-Fort Worth, TX',

  // ---- Geography ----
  primary_geography_id: '19100',
  primary_geography_type: 'metro',
  primary_geography_name: 'Dallas-Fort Worth-Arlington, TX',
  comparison_geographies: null,

  // ---- User Inputs ----
  user_inputs: {
    priorities: ['affordability', 'growth', 'stability'],
    income: 95000,
    down_payment: 60000,
    timeline: '6_months',
    first_time_buyer: true,
  },

  // ---- Scores ----
  homeready_score: 74,
  investoredge_score: 68,
  confidence_level: 'a',
  scores_snapshot: {
    homeready_score: 74,
    homeready_details: {
      affordability: 62,
      stability: 81,
      value: 78,
      competition: 71,
    },
    homeready_components: [
      {
        name: 'affordability',
        score: 62,
        weight: 0.3,
        description: 'Price-to-income ratio and monthly cost burden',
        helping: false,
      },
      {
        name: 'market_stability',
        score: 81,
        weight: 0.25,
        description:
          'Price volatility, foreclosure rate, and employment stability',
        helping: true,
      },
      {
        name: 'value_trajectory',
        score: 78,
        weight: 0.25,
        description: 'Appreciation trends and price-to-rent ratio',
        helping: true,
      },
      {
        name: 'competition',
        score: 71,
        weight: 0.2,
        description: 'Days on market, inventory levels, and price cuts',
        helping: true,
      },
    ],
    investoredge_score: 68,
    investoredge_details: {
      cash_flow: 58,
      appreciation: 76,
      risk: 72,
      liquidity: 69,
    },
    investoredge_components: [
      {
        name: 'cash_flow_potential',
        score: 58,
        weight: 0.3,
        description: 'Rental yield and expense ratios',
        helping: false,
      },
      {
        name: 'appreciation',
        score: 76,
        weight: 0.25,
        description: 'Historical and projected value growth',
        helping: true,
      },
      {
        name: 'risk',
        score: 72,
        weight: 0.25,
        description: 'Market volatility and economic diversification',
        helping: true,
      },
      {
        name: 'liquidity',
        score: 69,
        weight: 0.2,
        description: 'Days on market and transaction volume',
        helping: true,
      },
    ],
    markethealth_score: 71,
    markethealth_components: [
      {
        name: 'supply_demand',
        score: 74,
        weight: 0.3,
        description: 'Inventory vs. absorption rate',
        helping: true,
      },
      {
        name: 'price_momentum',
        score: 68,
        weight: 0.25,
        description: 'Month-over-month and year-over-year price trends',
        helping: false,
      },
      {
        name: 'economic_foundation',
        score: 79,
        weight: 0.25,
        description: 'Employment growth and economic diversification',
        helping: true,
      },
      {
        name: 'affordability_access',
        score: 62,
        weight: 0.2,
        description: 'Price-to-income and mortgage qualification rates',
        helping: false,
      },
    ],
  },

  // ---- Populated Data ----
  populated_data: {
    current: {
      home_value: 385000,
      zhvi: 385000,
      median_listing_price: 399900,
      median_sale_price: 378500,
      rent_index: 1850,
      zori: 1850,
      price_to_rent_ratio: 17.3,
      days_on_market: 38,
      inventory: 2.8,
      months_of_supply: 3.2,
      price_reduced_share: 0.28,
      new_listings: 12400,
      pending_sales: 8200,
      sale_to_list_ratio: 0.978,
      mortgage_rate_30yr: 6.75,
      unemployment_rate: 3.6,
      population_growth: 0.018,
      job_growth: 0.024,
      median_household_income: 78500,
      price_to_income_ratio: 4.9,
      rental_vacancy: 0.068,
      homeownership_rate: 0.612,
      building_permits: 4200,
      foreclosure_rate: 0.003,
    },
    historical: {
      home_value: {
        data: [
          { date: '2024-01', value: 358000 },
          { date: '2024-02', value: 360000 },
          { date: '2024-03', value: 362500 },
          { date: '2024-04', value: 365000 },
          { date: '2024-05', value: 368000 },
          { date: '2024-06', value: 372000 },
          { date: '2024-07', value: 374000 },
          { date: '2024-08', value: 376500 },
          { date: '2024-09', value: 378000 },
          { date: '2024-10', value: 380000 },
          { date: '2024-11', value: 381500 },
          { date: '2024-12', value: 383000 },
          { date: '2025-01', value: 383500 },
          { date: '2025-02', value: 384000 },
          { date: '2025-03', value: 385000 },
        ],
        trend: 'up' as const,
        change_pct: 7.5,
      },
      rent_index: {
        data: [
          { date: '2024-01', value: 1750 },
          { date: '2024-04', value: 1780 },
          { date: '2024-07', value: 1800 },
          { date: '2024-10', value: 1825 },
          { date: '2025-01', value: 1840 },
          { date: '2025-03', value: 1850 },
        ],
        trend: 'up' as const,
        change_pct: 5.7,
      },
      days_on_market: {
        data: [
          { date: '2024-01', value: 45 },
          { date: '2024-04', value: 42 },
          { date: '2024-07', value: 35 },
          { date: '2024-10', value: 40 },
          { date: '2025-01', value: 39 },
          { date: '2025-03', value: 38 },
        ],
        trend: 'down' as const,
        change_pct: -15.6,
      },
      inventory: {
        data: [
          { date: '2024-01', value: 2.2 },
          { date: '2024-04', value: 2.5 },
          { date: '2024-07', value: 3.0 },
          { date: '2024-10', value: 2.9 },
          { date: '2025-01', value: 2.8 },
          { date: '2025-03', value: 2.8 },
        ],
        trend: 'up' as const,
        change_pct: 27.3,
      },
      unemployment_rate: {
        data: [
          { date: '2024-01', value: 3.8 },
          { date: '2024-04', value: 3.7 },
          { date: '2024-07', value: 3.6 },
          { date: '2024-10', value: 3.5 },
          { date: '2025-01', value: 3.6 },
          { date: '2025-03', value: 3.6 },
        ],
        trend: 'stable' as const,
        change_pct: -5.3,
      },
    },
    benchmarks: {
      national: {
        home_value: 362000,
        rent_index: 1780,
        days_on_market: 42,
        inventory: 3.1,
        unemployment_rate: 4.0,
        price_to_income_ratio: 5.2,
        mortgage_rate_30yr: 6.75,
      },
      state: {
        home_value: 310000,
        rent_index: 1680,
        days_on_market: 40,
        inventory: 3.0,
        unemployment_rate: 4.1,
        price_to_income_ratio: 4.5,
      },
    },
    scores: {
      homeready: { score: 74, trend: 'up' as const, percentile: 68 },
      investoredge: { score: 68, trend: 'stable' as const, percentile: 55 },
    },
    demographics: {
      population: 7940000,
      median_age: 34.8,
      college_educated_pct: 0.365,
      median_household_income: 78500,
    },
  },

  // ---- AI Narratives ----
  ai_narrative: {
    market_summary:
      "Dallas-Fort Worth remains one of the nation's strongest housing markets for homebuyers in 2025. With a HomeReady Score of 74 (GOOD), the metro offers a compelling combination of job growth, relative affordability compared to coastal markets, and steady appreciation. The area's diversified economy — spanning technology, healthcare, finance, and logistics — provides a stable foundation that supports long-term homeownership.",
    trend_observations:
      "Home values have risen 7.5% year-over-year to $385,000, outpacing the national average but maintaining a more accessible price point than many comparable metros. Inventory has improved to 2.8 months of supply, up from 2.2 months a year ago, giving buyers slightly more negotiating power. Days on market have decreased to 38, suggesting homes are still moving quickly but not at the frenzied pace of 2021-2022. The sale-to-list ratio of 97.8% indicates a market that's firm but no longer dominated by bidding wars.",
    affordability_analysis:
      'At a median home value of $385,000 and median household income of $78,500, the price-to-income ratio sits at 4.9x — slightly below the national average of 5.2x. With a $60,000 down payment (15.6%) and current 30-year rates at 6.75%, monthly payments would be approximately $2,110 for principal and interest. Including taxes and insurance, expect total monthly housing costs around $2,650. This represents roughly 33% of gross income at $95,000 — right at the conventional lending threshold. The metro scores 62 on affordability, reflecting that while DFW is more accessible than many major metros, rising prices have created some strain for first-time buyers.',
    investment_analysis:
      "The Dallas-Fort Worth metro scores 68 on InvestorEdge, reflecting solid appreciation potential (76) and manageable risk (72), tempered by moderate cash flow prospects (58). Rent growth of 5.7% has been healthy, with the typical rent at $1,850/month. The price-to-rent ratio of 17.3 is reasonable, though cap rates have compressed with rising values. For a first-time buyer considering long-term wealth building, the market's strong population growth (1.8% annually) and job creation (2.4%) support continued demand.",
    stability_deep_dive:
      "Market stability scores an impressive 81, the highest component in the HomeReady analysis. DFW's economic diversification is a key strength — no single industry dominates, reducing vulnerability to sector-specific downturns. The foreclosure rate of 0.3% is well below historical norms, and the unemployment rate of 3.6% sits below both state (4.1%) and national (4.0%) averages. Population inflows continue to drive demand, with DFW adding roughly 140,000 new residents annually through domestic migration and natural growth.",
    growth_potential:
      "Value trajectory scores 78, supported by consistent year-over-year appreciation and strong economic fundamentals. The metro's job growth rate of 2.4% exceeds national averages, driven by corporate relocations and expansions in technology, financial services, and healthcare. Building permits remain elevated at 4,200/month, indicating developer confidence. However, new construction is helping moderate price growth to a more sustainable pace compared to the runaway appreciation of 2020-2022.",
    market_timing:
      'Current market conditions favor patient, prepared buyers. With inventory improving and days on market stabilizing around 38 days, buyers have more breathing room than in recent years. The 28% price-reduced share suggests some sellers are adjusting expectations, creating opportunities for well-positioned offers. First-time buyers should note that seasonal patterns typically favor purchases in late fall through early spring, when competition tends to ease.',
    bottom_line:
      "Dallas-Fort Worth earns a GOOD rating for homebuyers with a score of 74. The market's strongest attributes are stability (81) and growth potential (78), making it well-suited for buyers with a long-term outlook. Affordability (62) is the primary challenge — not prohibitive, but requiring careful budgeting at current rates. For a first-time buyer with $60,000 down and $95,000 income, the market is accessible but tight. The six-month timeline is realistic if mortgage pre-approval is secured promptly. Consider targeting homes in the $350K-$380K range to maintain comfortable debt-to-income ratios.",
    priorities_analysis: [
      '**Affordability (Weight: High):** At $385K median, DFW is 6% above national levels but significantly below comparable Sun Belt metros like Austin ($475K) or Nashville ($440K). Your $60K down payment puts you in a competitive position for the $350-390K range. Score: 62/100.',
      "**Growth (Weight: High):** DFW's 7.5% annual appreciation and 2.4% job growth rate make it one of the strongest growth markets in the country. Corporate relocations continue to fuel demand. Score: 78/100.",
      "**Stability (Weight: Medium):** With a diversified economy, low foreclosure rates (0.3%), and steady employment, DFW offers excellent market stability. This is the market's standout feature. Score: 81/100.",
    ],
  },

  // ---- Template (inline from join) ----
  template: {
    slug: 'homeready-snapshot',
    name: 'HomeReady Report',
    icon: 'home',
    config: {
      report_type: 'snapshot',
      supported_geography_types: ['metro', 'county', 'zip'],
      pages: [
        {
          id: 'overview',
          name: 'Market Overview',
          layout: 'dashboard',
          sections: [
            { id: 'hero', type: 'report_title', config: {} },
            {
              id: 'score',
              type: 'score_gauge_single',
              config: { score_type: 'homeready' },
            },
            { id: 'metrics', type: 'metric_grid', config: {} },
          ],
        },
        {
          id: 'analysis',
          name: 'Deep Analysis',
          layout: 'narrative',
          sections: [
            {
              id: 'summary',
              type: 'ai_narrative',
              config: { section: 'market_summary' },
            },
            {
              id: 'affordability',
              type: 'ai_narrative',
              config: { section: 'affordability_analysis' },
            },
            {
              id: 'trends',
              type: 'ai_narrative',
              config: { section: 'trend_observations' },
            },
          ],
        },
      ],
      user_inputs: [],
      ai_config: {
        narrative_sections: [
          { id: 'market_summary', prompt_template: '', max_tokens: 500 },
          { id: 'trend_observations', prompt_template: '', max_tokens: 500 },
          {
            id: 'affordability_analysis',
            prompt_template: '',
            max_tokens: 500,
          },
          { id: 'bottom_line', prompt_template: '', max_tokens: 400 },
        ],
        conversation_starter:
          'Ask me anything about the Dallas-Fort Worth housing market.',
        initial_questions: [
          'What neighborhoods should I focus on with my budget?',
          'How does DFW compare to Austin or Houston?',
          'Is now a good time to buy or should I wait?',
        ],
      },
      data_requirements: {
        current_metrics: [
          'home_value',
          'rent_index',
          'days_on_market',
          'inventory',
          'unemployment_rate',
        ],
        historical_metrics: [
          { metric: 'home_value', periods: 15 },
          { metric: 'rent_index', periods: 6 },
        ],
        benchmarks: ['national', 'state'],
        scores: ['homeready', 'investoredge'],
        score_components: true,
      },
    },
  },

  // ---- Status ----
  status: 'ready',
  error_message: null,
  data_as_of_date: '2025-03-15',
  generation_time_ms: 12400,

  // ---- Sharing ----
  share_token: null,
  share_access_level: 'view',
  share_view_count: 0,

  // ---- Timestamps ----
  created_at: '2025-03-15T10:30:00Z',
  updated_at: '2025-03-15T10:30:12Z',
  expires_at: null,
  last_viewed_at: new Date().toISOString(),

  // ---- Extra fields the ReportViewer may reference ----
  template_slug: 'homeready-snapshot',
  generation_stage: null,
  generation_stage_detail: null,
};
