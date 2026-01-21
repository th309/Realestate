/**
 * Data Cards Types and Mock Data
 *
 * Complete list of all data cards matching the maps page sidebar.
 * Organized by category in exact order as displayed.
 */

export interface MetricHealth {
  metricId: string;
  metricName: string;
  category: string;
  tableName: string;
  status: 'ok' | 'stale' | 'empty' | 'error';
  latestDate: string | null;
  recordCount: number;
  coverage: number;
  source: string;
  isNew?: boolean;
  isPro?: boolean;
  message?: string;
}

export interface CategoryInfo {
  id: string;
  name: string;
  description: string;
  mode: 'homebuyer' | 'investor' | 'both';
}

export const CATEGORIES: CategoryInfo[] = [
  // Homebuyer Mode Categories
  { id: 'affordability', name: 'Affordability', description: 'Can I afford to live here?', mode: 'homebuyer' },
  { id: 'market_competition', name: 'Market Competition', description: 'Should I act fast?', mode: 'homebuyer' },
  { id: 'pricing_deals', name: 'Pricing & Deals', description: 'Are prices going up or down?', mode: 'homebuyer' },
  { id: 'area_profile', name: 'Area Profile', description: 'Who lives here?', mode: 'homebuyer' },
  { id: 'local_economy', name: 'Local Economy', description: 'How strong is the job market?', mode: 'homebuyer' },
  { id: 'new_construction', name: 'New Construction', description: 'What new homes are being built?', mode: 'homebuyer' },
  { id: 'propertyiq_scores', name: 'PropertyIQ Scores', description: 'AI-powered market analysis', mode: 'both' },
  // Investor Mode Categories
  { id: 'cash_flow', name: 'Cash Flow', description: 'Will this make money monthly?', mode: 'investor' },
  { id: 'appreciation', name: 'Appreciation', description: 'Will the value grow?', mode: 'investor' },
  { id: 'demand_risk', name: 'Demand & Risk', description: 'Can I rent/sell it?', mode: 'investor' },
];

export function getMockMetrics(): MetricHealth[] {
  return [
    // ═══════════════════════════════════════════════════════════════════════
    // AFFORDABILITY - "Can I afford to live here?"
    // ═══════════════════════════════════════════════════════════════════════
    { metricId: 'listing_price', metricName: 'Listing Price', category: 'Affordability', tableName: 'realtor_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 29500, coverage: 89.4, source: 'Realtor', isNew: true },
    { metricId: 'income_to_buy', metricName: 'Income to Buy', category: 'Affordability', tableName: 'calculated_metrics', status: 'ok', latestDate: 'Jan 2024', recordCount: 28000, coverage: 85.2, source: 'Calculated', isNew: true },
    { metricId: 'affordable_home_price', metricName: 'Affordable Home Price', category: 'Affordability', tableName: 'calculated_metrics', status: 'ok', latestDate: 'Jan 2024', recordCount: 28000, coverage: 85.2, source: 'Calculated', isNew: true },
    { metricId: 'price_per_sqft', metricName: 'Price Per Sq Ft', category: 'Affordability', tableName: 'realtor_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 27800, coverage: 84.5, source: 'Realtor', isNew: true },
    { metricId: 'years_to_save', metricName: 'Years to Save', category: 'Affordability', tableName: 'calculated_metrics', status: 'ok', latestDate: 'Jan 2024', recordCount: 27500, coverage: 83.6, source: 'Calculated', isNew: true, isPro: true },
    { metricId: 'home_value_yoy_aff', metricName: 'Home Value YoY', category: 'Affordability', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 33120, coverage: 98.5, source: 'Zillow' },
    { metricId: '5_year_growth_aff', metricName: '5-Year Growth', category: 'Affordability', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 31000, coverage: 94.2, source: 'Zillow', isPro: true },

    // ═══════════════════════════════════════════════════════════════════════
    // MARKET COMPETITION - "Should I act fast?"
    // ═══════════════════════════════════════════════════════════════════════
    { metricId: 'days_on_market', metricName: 'Days on Market', category: 'Market Competition', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 31500, coverage: 95.8, source: 'Zillow' },
    { metricId: 'inventory', metricName: 'Inventory', category: 'Market Competition', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 31200, coverage: 95.3, source: 'Zillow' },
    { metricId: 'inventory_yoy', metricName: 'Inventory YoY', category: 'Market Competition', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 30800, coverage: 93.6, source: 'Zillow' },
    { metricId: 'pending_ratio', metricName: 'Pending Ratio', category: 'Market Competition', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 30500, coverage: 92.7, source: 'Zillow' },
    { metricId: 'new_listings_yoy', metricName: 'New Listings YoY', category: 'Market Competition', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 30200, coverage: 91.8, source: 'Zillow', isNew: true },
    { metricId: 'hotness_score', metricName: 'Hotness Score', category: 'Market Competition', tableName: 'realtor_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 28500, coverage: 86.7, source: 'Realtor', isNew: true },
    { metricId: 'market_heat_index', metricName: 'Market Heat Index', category: 'Market Competition', tableName: 'calculated_metrics', status: 'ok', latestDate: 'Jan 2024', recordCount: 28000, coverage: 85.1, source: 'Calculated' },
    { metricId: 'sale_to_list_ratio', metricName: 'Sale-to-List Ratio', category: 'Market Competition', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 30000, coverage: 91.2, source: 'Zillow', isPro: true },

    // ═══════════════════════════════════════════════════════════════════════
    // PRICING & DEALS - "Are prices going up or down?"
    // ═══════════════════════════════════════════════════════════════════════
    { metricId: 'home_value_yoy_price', metricName: 'Home Value YoY', category: 'Pricing & Deals', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 33120, coverage: 98.5, source: 'Zillow' },
    { metricId: 'home_value_mom', metricName: 'Home Value MoM', category: 'Pricing & Deals', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 33120, coverage: 98.5, source: 'Zillow', isPro: true },
    { metricId: 'home_price_forecast_price', metricName: 'Home Price Forecast', category: 'Pricing & Deals', tableName: 'propertyiq_scores', status: 'ok', latestDate: 'Jan 2024', recordCount: 25000, coverage: 76.0, source: 'PropertyIQ', isPro: true },
    { metricId: 'price_cut_pct', metricName: 'Price Cut %', category: 'Pricing & Deals', tableName: 'realtor_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 28000, coverage: 85.1, source: 'Realtor' },
    { metricId: 'price_increase_pct', metricName: 'Price Increase %', category: 'Pricing & Deals', tableName: 'realtor_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 28000, coverage: 85.1, source: 'Realtor', isNew: true },
    { metricId: 'new_listings', metricName: 'New Listings', category: 'Pricing & Deals', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 30500, coverage: 92.7, source: 'Zillow' },
    { metricId: 'inventory_surplus_deficit', metricName: 'Inventory Surplus/Deficit', category: 'Pricing & Deals', tableName: 'calculated_metrics', status: 'ok', latestDate: 'Jan 2024', recordCount: 27000, coverage: 82.1, source: 'Calculated', isPro: true },

    // ═══════════════════════════════════════════════════════════════════════
    // AREA PROFILE - "Who lives here?"
    // ═══════════════════════════════════════════════════════════════════════
    { metricId: 'population', metricName: 'Population', category: 'Area Profile', tableName: 'census_zip', status: 'ok', latestDate: '2023', recordCount: 33000, coverage: 99.1, source: 'Census' },
    { metricId: 'population_growth', metricName: 'Population Growth', category: 'Area Profile', tableName: 'census_zip', status: 'ok', latestDate: '2023', recordCount: 32500, coverage: 98.5, source: 'Census', isPro: true },
    { metricId: 'median_income', metricName: 'Median Income', category: 'Area Profile', tableName: 'census_zip', status: 'ok', latestDate: '2023', recordCount: 32800, coverage: 98.8, source: 'Census' },
    { metricId: 'income_growth', metricName: 'Income Growth', category: 'Area Profile', tableName: 'census_zip', status: 'ok', latestDate: '2023', recordCount: 32000, coverage: 97.3, source: 'Census', isPro: true },
    { metricId: 'median_age', metricName: 'Median Age', category: 'Area Profile', tableName: 'census_zip', status: 'ok', latestDate: '2023', recordCount: 32600, coverage: 98.7, source: 'Census', isPro: true },
    { metricId: 'homeownership_rate', metricName: 'Homeownership Rate', category: 'Area Profile', tableName: 'census_zip', status: 'ok', latestDate: '2023', recordCount: 32400, coverage: 98.2, source: 'Census', isPro: true },

    // ═══════════════════════════════════════════════════════════════════════
    // LOCAL ECONOMY - "How strong is the job market?"
    // ═══════════════════════════════════════════════════════════════════════
    { metricId: 'unemployment_rate', metricName: 'Unemployment Rate', category: 'Local Economy', tableName: 'economic_county', status: 'stale', latestDate: 'Nov 2023', recordCount: 3221, coverage: 95.0, source: 'BLS' },
    { metricId: 'job_growth', metricName: 'Job Growth', category: 'Local Economy', tableName: 'economic_county', status: 'ok', latestDate: 'Dec 2023', recordCount: 3100, coverage: 91.5, source: 'BLS', isPro: true },
    { metricId: 'gdp_growth', metricName: 'GDP Growth', category: 'Local Economy', tableName: 'economic_metro', status: 'ok', latestDate: 'Q3 2023', recordCount: 384, coverage: 100.0, source: 'BEA', isPro: true },
    { metricId: 'cost_of_living', metricName: 'Cost of Living', category: 'Local Economy', tableName: 'economic_metro', status: 'ok', latestDate: '2023', recordCount: 380, coverage: 98.9, source: 'BEA', isPro: true },

    // ═══════════════════════════════════════════════════════════════════════
    // NEW CONSTRUCTION - "What new homes are being built?"
    // ═══════════════════════════════════════════════════════════════════════
    { metricId: 'sf_permits', metricName: 'SF Permits', category: 'New Construction', tableName: 'permits_county', status: 'ok', latestDate: 'Dec 2023', recordCount: 3100, coverage: 92.1, source: 'Census', isNew: true },
    { metricId: 'mf_permits', metricName: 'MF Permits', category: 'New Construction', tableName: 'permits_county', status: 'ok', latestDate: 'Dec 2023', recordCount: 3100, coverage: 92.1, source: 'Census', isNew: true },
    { metricId: 'total_permits', metricName: 'Total Permits', category: 'New Construction', tableName: 'permits_county', status: 'ok', latestDate: 'Dec 2023', recordCount: 3100, coverage: 92.1, source: 'Census', isNew: true },
    { metricId: 'permits_yoy', metricName: 'Permits YoY', category: 'New Construction', tableName: 'permits_county', status: 'ok', latestDate: 'Dec 2023', recordCount: 3050, coverage: 90.5, source: 'Census', isNew: true },
    { metricId: 'sf_mf_ratio', metricName: 'SF/MF Ratio', category: 'New Construction', tableName: 'permits_county', status: 'ok', latestDate: 'Dec 2023', recordCount: 3000, coverage: 89.1, source: 'Census', isNew: true, isPro: true },
    { metricId: 'permit_value_unit', metricName: 'Permit Value/Unit', category: 'New Construction', tableName: 'permits_county', status: 'ok', latestDate: 'Dec 2023', recordCount: 2900, coverage: 86.1, source: 'Census', isNew: true, isPro: true },
    { metricId: 'new_construction_sales', metricName: 'New Construction Sales', category: 'New Construction', tableName: 'census_county', status: 'ok', latestDate: 'Q4 2023', recordCount: 2800, coverage: 83.2, source: 'Census' },
    { metricId: 'new_construction_price', metricName: 'New Construction Price', category: 'New Construction', tableName: 'census_county', status: 'ok', latestDate: 'Q4 2023', recordCount: 2800, coverage: 83.2, source: 'Census' },
    { metricId: 'new_construction_share', metricName: 'New Construction $Share', category: 'New Construction', tableName: 'calculated_metrics', status: 'ok', latestDate: 'Q4 2023', recordCount: 2700, coverage: 80.1, source: 'Calculated', isPro: true },

    // ═══════════════════════════════════════════════════════════════════════
    // PROPERTYIQ SCORES - "AI-powered market analysis"
    // ═══════════════════════════════════════════════════════════════════════
    { metricId: 'homeready_score', metricName: 'HomeReady Score', category: 'PropertyIQ Scores', tableName: 'propertyiq_scores', status: 'ok', latestDate: 'Jan 2024', recordCount: 25000, coverage: 76.0, source: 'PropertyIQ', isNew: true, isPro: true },
    { metricId: 'investoredge_score', metricName: 'InvestorEdge Score', category: 'PropertyIQ Scores', tableName: 'propertyiq_scores', status: 'ok', latestDate: 'Jan 2024', recordCount: 25000, coverage: 76.0, source: 'PropertyIQ', isNew: true, isPro: true },
    { metricId: 'home_price_forecast', metricName: 'Home Price Forecast', category: 'PropertyIQ Scores', tableName: 'propertyiq_scores', status: 'ok', latestDate: 'Jan 2024', recordCount: 25000, coverage: 76.0, source: 'PropertyIQ', isPro: true },

    // ═══════════════════════════════════════════════════════════════════════
    // CASH FLOW - "Will this make money monthly?" (Investor Mode)
    // ═══════════════════════════════════════════════════════════════════════
    { metricId: 'cap_rate', metricName: 'Cap Rate', category: 'Cash Flow', tableName: 'calculated_metrics', status: 'ok', latestDate: 'Jan 2024', recordCount: 27000, coverage: 82.1, source: 'Calculated', isPro: true },
    { metricId: 'rent_index', metricName: 'Rent Index', category: 'Cash Flow', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 28450, coverage: 87.2, source: 'Zillow' },
    { metricId: 'renter_demand_index', metricName: 'Renter Demand Index', category: 'Cash Flow', tableName: 'calculated_metrics', status: 'ok', latestDate: 'Jan 2024', recordCount: 26500, coverage: 80.6, source: 'Calculated' },
    { metricId: 'listing_price_cf', metricName: 'Listing Price', category: 'Cash Flow', tableName: 'realtor_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 29500, coverage: 89.4, source: 'Realtor', isNew: true },
    { metricId: 'price_per_sqft_cf', metricName: 'Price Per Sq Ft', category: 'Cash Flow', tableName: 'realtor_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 27800, coverage: 84.5, source: 'Realtor', isNew: true },

    // ═══════════════════════════════════════════════════════════════════════
    // APPRECIATION - "Will the value grow?" (Investor Mode)
    // ═══════════════════════════════════════════════════════════════════════
    { metricId: 'home_value_yoy_app', metricName: 'Home Value YoY', category: 'Appreciation', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 33120, coverage: 98.5, source: 'Zillow' },
    { metricId: '5_year_growth_app', metricName: '5-Year Growth', category: 'Appreciation', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 31000, coverage: 94.2, source: 'Zillow', isPro: true },
    { metricId: 'home_price_forecast_app', metricName: 'Home Price Forecast', category: 'Appreciation', tableName: 'propertyiq_scores', status: 'ok', latestDate: 'Jan 2024', recordCount: 25000, coverage: 76.0, source: 'PropertyIQ', isPro: true },
    { metricId: 'home_value', metricName: 'Home Value', category: 'Appreciation', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 33120, coverage: 98.5, source: 'Zillow' },
    { metricId: 'overvalued_pct', metricName: 'Overvalued %', category: 'Appreciation', tableName: 'calculated_metrics', status: 'ok', latestDate: 'Jan 2024', recordCount: 26000, coverage: 79.0, source: 'Calculated', isPro: true },

    // ═══════════════════════════════════════════════════════════════════════
    // DEMAND & RISK - "Can I rent/sell it?" (Investor Mode)
    // ═══════════════════════════════════════════════════════════════════════
    { metricId: 'days_on_market_dr', metricName: 'Days on Market', category: 'Demand & Risk', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 31500, coverage: 95.8, source: 'Zillow' },
    { metricId: 'inventory_dr', metricName: 'Inventory', category: 'Demand & Risk', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 31200, coverage: 95.3, source: 'Zillow' },
    { metricId: 'inventory_yoy_dr', metricName: 'Inventory YoY', category: 'Demand & Risk', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 30800, coverage: 93.6, source: 'Zillow' },
    { metricId: 'pending_ratio_dr', metricName: 'Pending Ratio', category: 'Demand & Risk', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 30500, coverage: 92.7, source: 'Zillow' },
    { metricId: 'new_listings_yoy_dr', metricName: 'New Listings YoY', category: 'Demand & Risk', tableName: 'zillow_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 30200, coverage: 91.8, source: 'Zillow', isNew: true },
    { metricId: 'hotness_score_dr', metricName: 'Hotness Score', category: 'Demand & Risk', tableName: 'realtor_zip', status: 'ok', latestDate: 'Jan 2024', recordCount: 28500, coverage: 86.7, source: 'Realtor', isNew: true },
  ];
}

export function getStatusBadgeClasses(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'ok':
      return { bg: 'bg-green-100', text: 'text-green-800', label: 'OK' };
    case 'stale':
      return { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Stale' };
    case 'empty':
      return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Empty' };
    case 'error':
      return { bg: 'bg-red-100', text: 'text-red-800', label: 'Error' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
  }
}

export function getCoverageColor(coverage: number): string {
  if (coverage >= 90) return 'text-green-600';
  if (coverage >= 70) return 'text-amber-600';
  return 'text-red-600';
}
