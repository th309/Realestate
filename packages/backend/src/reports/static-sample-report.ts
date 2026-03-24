/**
 * Static Sample Report (V2)
 *
 * Showcase-quality fallback for the public sample report endpoint.
 * Served when no sample report exists in the database, ensuring the
 * /reports/sample page always works and always looks impressive.
 *
 * Uses the V2 narrative format (consolidated sections with structured
 * action items, watch metrics, and scenario analysis).
 *
 * Market: Dallas-Fort Worth-Arlington, TX (CBSA 19100)
 * Report type: HomeReady (homebuyer)
 */

import { SAMPLE_REPORT_NARRATIVES } from './sample-report-narratives';
import { SAMPLE_REPORT_DATA } from './sample-report-data';

/** Score component shared shape (both `component` and `name` for compatibility) */
function comp(
  id: string,
  score: number,
  weight: number,
  desc: string,
  helping: boolean,
) {
  return { component: id, name: id, score, weight, description: desc, helping };
}

export const STATIC_SAMPLE_REPORT = {
  // ---- Identity ----
  id: 'f4b04e7c-34cc-4e38-bdac-541fff06de1e',
  template_id: '00000000-0000-0000-0000-000000000001',
  template_version: 2,
  user_id: '00000000-0000-0000-0000-000000000000',
  organization_id: null,
  user_type: 'homebuyer',
  title: 'Dallas-Fort Worth: Your HomeReady Market Intelligence Brief',

  // ---- Geography ----
  primary_geography_id: '19100',
  primary_geography_type: 'metro',
  primary_geography_name: 'Dallas-Fort Worth-Arlington, TX',
  comparison_geographies: null,

  // ---- User Inputs ----
  user_inputs: {
    priorities: ['affordability', 'growth', 'stability'],
    income: 105000,
    down_payment: 65000,
    timeline: '6_months',
    first_time_buyer: true,
  },

  // ---- Scores ----
  homeready_score: 76,
  investoredge_score: 71,
  confidence_level: 'a',
  scores_snapshot: {
    homeready_score: 76,
    homeready_grade: 'C+',
    homeready_trend: 2.3,
    homeready_details: {
      affordability: 64,
      stability: 83,
      value: 80,
      competition: 73,
    },
    homeready_components: [
      comp(
        'affordability',
        64,
        0.3,
        'Price-to-income ratio, monthly cost burden, and down-payment leverage relative to median home values',
        false,
      ),
      comp(
        'market_stability',
        83,
        0.25,
        'Price volatility, foreclosure rate, employment diversification, and population momentum',
        true,
      ),
      comp(
        'value_trajectory',
        80,
        0.25,
        'Year-over-year appreciation, price-to-rent convergence, and forward-looking growth indicators',
        true,
      ),
      comp(
        'competition',
        73,
        0.2,
        'Days on market, active inventory depth, price-cut frequency, and sale-to-list dynamics',
        true,
      ),
    ],
    investoredge_score: 71,
    investoredge_details: {
      cash_flow: 61,
      appreciation: 79,
      risk: 74,
      liquidity: 71,
    },
    investoredge_components: [
      comp(
        'cash_flow_potential',
        61,
        0.3,
        'Gross rental yield, expense ratios, and net operating income potential',
        false,
      ),
      comp(
        'appreciation',
        79,
        0.25,
        'Historical and projected value growth adjusted for supply pipeline',
        true,
      ),
      comp(
        'risk',
        74,
        0.25,
        'Market volatility, economic diversification, and downside protection',
        true,
      ),
      comp(
        'liquidity',
        71,
        0.2,
        'Days on market, transaction volume, and exit optionality',
        true,
      ),
    ],
    markethealth_score: 74,
    markethealth_components: [
      comp(
        'supply_demand',
        76,
        0.3,
        'Inventory-to-absorption ratio and listing velocity',
        true,
      ),
      comp(
        'price_momentum',
        71,
        0.25,
        'Month-over-month and year-over-year price acceleration',
        true,
      ),
      comp(
        'economic_foundation',
        82,
        0.25,
        'Employment growth, wage gains, and economic diversification index',
        true,
      ),
      comp(
        'affordability_access',
        64,
        0.2,
        'Price-to-income ratio and mortgage qualification rate for median earners',
        false,
      ),
    ],
  },

  // ---- Populated Data (imported) ----
  populated_data: SAMPLE_REPORT_DATA,

  // ---- AI Narratives V2 (imported) ----
  ai_narrative: SAMPLE_REPORT_NARRATIVES,

  // ---- Template ----
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
              id: 'executive_verdict',
              type: 'ai_narrative',
              config: { section: 'executive_verdict' },
            },
            {
              id: 'market_deep_dive',
              type: 'ai_narrative',
              config: { section: 'market_deep_dive' },
            },
            {
              id: 'your_situation',
              type: 'ai_narrative',
              config: { section: 'your_situation' },
            },
            {
              id: 'verdict_and_actions',
              type: 'ai_narrative',
              config: { section: 'verdict_and_actions' },
            },
            {
              id: 'what_to_watch',
              type: 'ai_narrative',
              config: { section: 'what_to_watch' },
            },
          ],
        },
      ],
      user_inputs: [],
      ai_config: {
        narrative_sections: [
          { id: 'executive_verdict', prompt_template: '', max_tokens: 800 },
          { id: 'market_deep_dive', prompt_template: '', max_tokens: 1200 },
          { id: 'your_situation', prompt_template: '', max_tokens: 1000 },
          { id: 'verdict_and_actions', prompt_template: '', max_tokens: 800 },
          { id: 'what_to_watch', prompt_template: '', max_tokens: 800 },
        ],
        conversation_starter:
          'Ask me anything about buying a home in Dallas-Fort Worth.',
        initial_questions: [
          'Which DFW neighborhoods fit my $350K–$400K budget best?',
          'Should I wait for rates to drop further or buy now?',
          'How does DFW compare to Austin, Houston, or San Antonio?',
        ],
      },
      data_requirements: {
        current_metrics: [
          'home_value',
          'rent_index',
          'days_on_market',
          'inventory',
          'unemployment_rate',
          'mortgage_rate_30yr',
          'building_permits',
          'job_growth',
        ],
        historical_metrics: [
          { metric: 'home_value', periods: 15 },
          { metric: 'rent_index', periods: 6 },
          { metric: 'days_on_market', periods: 6 },
          { metric: 'inventory', periods: 6 },
          { metric: 'unemployment_rate', periods: 6 },
        ],
        benchmarks: ['national', 'state'],
        scores: ['homeready', 'investoredge'],
        score_components: true,
      },
    },
  },

  // ---- Metadata ----
  ai_model_used: 'claude-sonnet-4-5-20250514',
  status: 'ready',
  error_message: null,
  data_as_of_date: '2026-03-15',
  generation_time_ms: 18200,
  share_token: null,
  share_access_level: 'view',
  share_view_count: 0,
  created_at: '2026-03-15T10:30:00Z',
  updated_at: '2026-03-15T10:30:18Z',
  expires_at: null,
  last_viewed_at: new Date().toISOString(),
  template_slug: 'homeready-snapshot',
  generation_stage: null,
  generation_stage_detail: null,
};
