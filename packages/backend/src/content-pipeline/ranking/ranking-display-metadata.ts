/**
 * Display metadata for ranking results.
 *
 * Two helpers — both default-friendly so unknown metrics still render.
 * Source/table/column routing lives in the canonical metric-resolution layer
 * (FALLBACK_REGISTRY + table-routes.ts), not here.
 */

import { MetricFormat } from './format-value';

const FORMATS: Record<string, MetricFormat> = {
  propertyiq_score: 'index',
  // currency
  home_value: 'currency',
  listing_price: 'currency',
  price_per_sqft: 'currency',
  rent_index: 'currency',
  income_to_buy: 'currency',
  income_to_rent: 'currency',
  affordable_home_price: 'currency',
  median_income: 'currency',
  new_construction_price: 'currency',
  new_construction_ppsf: 'currency',
  // days
  days_on_market: 'days',
  median_dom: 'days',
  // percent_abs (already in % units)
  pending_ratio: 'percent_abs',
  homeownership_rate: 'percent_abs',
  unemployment_rate: 'percent_abs',
  pct_sold_above_list: 'percent_abs',
  cap_rate: 'percent_abs',
  gross_yield: 'percent_abs',
  rent_to_price_ratio: 'percent_abs',
  sale_to_list: 'percent_abs',
  // percent (decimal, formatted *100)
  home_value_yoy: 'percent',
  home_value_mom: 'percent',
  home_value_5yr: 'percent',
  home_price_forecast: 'percent',
  inventory_yoy: 'percent',
  home_sales_yoy: 'percent',
  new_listings_yoy: 'percent',
  price_cut_pct: 'percent',
  price_increase_pct: 'percent',
  population_growth: 'percent',
  income_growth: 'percent',
  job_growth: 'percent',
  gdp_growth: 'percent',
  permits_yoy: 'percent',
  overvalued_pct: 'percent',
  inventory_surplus: 'percent',
  // index
  market_heat: 'index',
  hotness_score: 'index',
  demand_score: 'index',
  supply_score: 'index',
  rent_for_houses: 'index',
  cost_of_living: 'index',
};

const LABEL_OVERRIDES: Record<string, string> = {
  propertyiq_score: 'PropertyIQ Score',
  median_dom: 'Median Days on Market',
  pct_sold_above_list: '% Sold Above List',
  grm: 'Gross Rent Multiplier',
  rent_to_price_ratio: 'Rent-to-Price Ratio',
  sale_to_list: 'Sale-to-List Ratio',
  market_heat: 'Market Heat Index',
};

const ACRONYMS = new Set([
  'piq',
  'gdp',
  'mf',
  'sf',
  'ppsf',
  'grm',
  'dom',
  'yoy',
  'mom',
]);

export function getMetricFormat(metricId: string): MetricFormat {
  return FORMATS[metricId] ?? 'number';
}

export function getMetricLabel(metricId: string): string {
  if (LABEL_OVERRIDES[metricId]) return LABEL_OVERRIDES[metricId];
  return metricId
    .split('_')
    .map((word) => {
      if (ACRONYMS.has(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Per-metric thesis lines used by the ranking script generator to give the
 * voiceover investor-relevant framing rather than a bare countdown. Voice:
 * declarative, leading-indicator framed, no causal forecasts the data
 * doesn't support. Each line should answer "why does this ranking matter
 * for someone allocating capital or running a real-estate business?"
 */
const THESES: Record<string, string> = {
  // Score
  propertyiq_score:
    'PropertyIQ measures real-time demand pressure — percent sold above list, days on market, and months of supply — and ranks each market against its state peers. Strong demand pressure is the leading indicator for next-cycle appreciation.',

  // Currency / levels
  home_value:
    'Where the dollar value of a typical home concentrates. The capital footprint of one door.',
  listing_price:
    "What sellers are asking right now. The market's current bid for entry.",
  price_per_sqft:
    'Apples-to-apples value across markets — strips out lot size and home age.',
  rent_index:
    'Where landlords are charging the most. Top-line revenue per door.',
  income_to_buy:
    'What it takes to qualify. High income bars throttle the buyer pool.',
  income_to_rent:
    'What renters can stretch to. Sets the ceiling on rent growth.',
  affordable_home_price:
    'What a median-income household can actually afford here. The natural demand floor.',
  median_income: 'Local earning power. The long-run ceiling on housing demand.',
  new_construction_price:
    'Where developers are pricing fresh inventory. The new-build comp set.',
  new_construction_ppsf:
    'Build economics in real time — land cost, labor, materials.',

  // Counts / quantities
  for_sale_inventory:
    'Homes competing for buyers. More inventory shifts leverage to buyers.',
  new_listings:
    "Fresh supply hitting the market. Sellers' real-time conviction.",
  pending_listings: "Homes under contract. Next month's closings, today.",
  home_sales: 'Volume of completed transactions. The liquidity proxy.',
  population:
    'Total addressable demand. The denominator behind every other metric.',
  median_age:
    'Life-stage mix. Younger drives household formation; older drives downsizing.',
  years_to_save:
    'How long a median household must save for a down payment. Affordability through the buyer’s eyes.',
  grm: 'Years of gross rent to recover the price. Lower means rent dominates the math.',
  months_of_supply:
    "How long today's inventory would last at today's pace. Under four is tight.",
  new_construction_sales:
    'Fresh completions absorbed by buyers. Validates demand for new product.',
  sf_permits:
    'Single-family pipeline 12 to 18 months out. Tomorrow’s for-sale inventory.',
  mf_permits: 'Multifamily pipeline. Where rental supply is heading.',
  total_permits:
    'Total housing pipeline. Future supply pressure on prices and rents.',

  // Days
  days_on_market:
    'How fast homes are moving. Lower means a tighter market favoring sellers.',
  median_dom:
    'Time from listing to contract for the typical home. Tightness in time terms.',

  // Percent (absolute, already in % units)
  pending_ratio:
    'Pendings vs active listings. Higher means turnover is outpacing new supply.',
  homeownership_rate:
    'Share of households who own. Sets the rental tenant pool inversely.',
  unemployment_rate:
    'Job-market strength. Drives household formation and mortgage qualification.',
  pct_sold_above_list:
    'Bidding intensity. The cleanest single read on buyer pressure.',
  cap_rate: 'Net rent yield on price. The return earned before financing.',
  gross_yield: 'Gross rent divided by price. The simplest income test.',
  rent_to_price_ratio:
    'Annual rent as a percent of price. Cashflow signal at a glance.',
  sale_to_list:
    'Pricing discipline. Above one hundred percent means homes routinely clear above ask.',

  // Percent (decimal, growth)
  home_value_yoy:
    'Year-over-year price change. The pace of equity creation for current owners.',
  home_value_mom: 'Short-term price momentum. Recent direction of the market.',
  home_value_5yr: 'Five-year compound growth. The long-cycle wealth signal.',
  home_price_forecast:
    "Zillow's twelve-month forecast. Market consensus, not opinion.",
  inventory_yoy:
    'Year-over-year inventory shift. Rising means the market is loosening.',
  home_sales_yoy:
    'Year-over-year sales volume. Tracks demand independent of price.',
  new_listings_yoy:
    "Year-over-year supply growth. Sellers' willingness to list.",
  price_cut_pct:
    'Share of listings with reductions. Soft prices when this rises.',
  price_increase_pct:
    'Share of listings with bumps. Sellers reading momentum and adjusting up.',
  population_growth:
    'Net migration plus births. The demographic engine of housing demand.',
  income_growth:
    'Local wage trajectory. The long-run mortgage qualification ceiling.',
  job_growth: 'Employment expansion. Drives new household formation.',
  gdp_growth:
    'Local economic output. The macro ceiling for everything housing.',
  permits_yoy:
    'Building pipeline trend. Acceleration or contraction in future supply.',
  overvalued_pct:
    'Distance from model-fair value. Markets above twenty percent have historically corrected.',
  inventory_surplus:
    'Inventory above or below historical norm. Negative means structural undersupply.',

  // Indices
  market_heat:
    "Zillow's composite of demand vs supply pressure. Higher means more competition for inventory.",
  hotness_score:
    "Realtor.com's market-intensity composite — days on market plus listing engagement.",
  demand_score: 'Buyer interest signal. Listing views and saves.',
  supply_score:
    'Inventory pressure. Higher means more supply, more buyer leverage.',
  rent_for_houses:
    'Renter demand for single-family homes specifically. The rotation signal.',
  cost_of_living:
    'Local prices for goods and services. Sets real-disposable income for housing.',
};

/**
 * Returns a 1-line investor-relevant thesis for the metric, or null if the
 * metric has no curated copy yet (the prompt falls back to generic guidance).
 */
export function getMetricThesis(metricId: string): string | null {
  return THESES[metricId] ?? null;
}
