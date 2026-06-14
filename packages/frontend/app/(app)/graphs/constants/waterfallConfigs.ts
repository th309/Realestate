/**
 * WATERFALL CHART PRESET CONFIGURATIONS
 *
 * Defines the available waterfall chart presets and their metadata.
 * Each preset corresponds to a different analytical breakdown:
 * - investment: Cap rate decomposition (rent, expenses, NOI)
 * - affordability: Income vs home price gap analysis
 * - momentum: Market growth/decline factors
 * - benchmark: Location vs national average deltas
 * - score: PropertyIQ score component breakdown (Pro only)
 */

export type WaterfallPreset = 'investment' | 'affordability' | 'momentum' | 'benchmark' | 'score';

export interface WaterfallPresetConfig {
  id: WaterfallPreset;
  title: string;
  description: string;
  totalLabel: string;
  proOnly: boolean;
}

export const WATERFALL_PRESETS: Record<WaterfallPreset, WaterfallPresetConfig> = {
  investment: {
    id: 'investment',
    title: 'Investment Return Breakdown',
    description: 'See what drives the cap rate in this market',
    totalLabel: 'Cap Rate',
    proOnly: false,
  },
  affordability: {
    id: 'affordability',
    title: 'Affordability Breakdown',
    description: 'What it takes to buy in this market',
    totalLabel: 'Affordability Gap',
    proOnly: false,
  },
  momentum: {
    id: 'momentum',
    title: 'Market Momentum',
    description: 'What is pushing or dragging this market',
    totalLabel: 'Net Momentum',
    proOnly: false,
  },
  benchmark: {
    id: 'benchmark',
    title: 'Location vs National Average',
    description: 'How this market compares to the national baseline',
    totalLabel: 'Net Difference',
    proOnly: false,
  },
  score: {
    id: 'score',
    title: 'PropertyIQ Score Breakdown',
    description: 'What contributes to this score',
    totalLabel: 'Final Score',
    proOnly: true,
  },
};

/** Ordered list of presets for UI rendering */
export const WATERFALL_PRESET_ORDER: WaterfallPreset[] = [
  'investment',
  'affordability',
  'momentum',
  'benchmark',
  'score',
];

/** Metrics used by each preset (for prefetch or data availability checks) */
export const WATERFALL_PRESET_METRICS: Record<WaterfallPreset, string[]> = {
  investment: ['rent_index', 'home_value'],
  affordability: ['median_income', 'home_value', 'years_to_save', 'affordable_home_price'],
  momentum: [
    'home_value_yoy',
    'inventory_yoy',
    'new_listings_yoy',
    'home_sales_yoy',
    'population_growth',
    'job_growth',
  ],
  benchmark: [
    'home_value',
    'rent_index',
    'median_income',
    'days_on_market',
    'population_growth',
    'job_growth',
  ],
  score: [], // Score uses useScoreData, not individual metrics
};
