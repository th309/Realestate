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

// No mock data - all data comes from the API at /api/health/data-cards

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
