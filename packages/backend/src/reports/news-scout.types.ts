/**
 * Type definitions for the News Scout Service.
 *
 * All types, interfaces, and constants related to news scouting
 * are centralized here as the single source of truth.
 */

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export type NewsCategory =
  // Employer & Jobs
  | 'employer_expansion'
  | 'employer_hiring'
  | 'employer_layoffs'
  | 'employer_relocation'
  | 'employer_new_facility'
  // Development
  | 'development_residential'
  | 'development_commercial'
  | 'development_industrial'
  // Policy
  | 'policy_zoning'
  | 'policy_taxes'
  | 'policy_housing'
  | 'policy_short_term'
  // Infrastructure
  | 'infrastructure_transit'
  | 'infrastructure_roads'
  | 'infrastructure_utilities'
  | 'infrastructure_airport'
  // Climate
  | 'climate_disaster'
  | 'climate_risk'
  | 'climate_insurance'
  // Community
  | 'crime_trends'
  | 'education_schools'
  | 'education_university'
  | 'healthcare'
  // Market
  | 'market_report'
  | 'market_investment'
  | 'demographic_migration'
  | 'demographic_growth'
  | 'other';

export interface LocalNewsItem {
  headline: string;
  summary: string;
  source: string;
  url: string | null;
  published_date: string;
  relevance: 'high' | 'medium' | 'low';
  category: NewsCategory;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact_on_real_estate: string;
}

export interface EconomicIndicator {
  indicator_name: string;
  geography_level: 'local' | 'state' | 'national';
  current_value: string;
  previous_value: string | null;
  change_description: string;
  release_date: string;
  source: string;
  source_url: string | null;
  impact_on_housing: 'positive' | 'negative' | 'neutral';
  impact_explanation: string;
}

export interface MarketSignal {
  signal_type: 'bullish' | 'bearish' | 'neutral';
  headline: string;
  description: string;
  source: string;
  source_url: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface NationalContext {
  fed_rate_news: string | null;
  mortgage_rate_trend: string | null;
  national_housing_news: string[];
  economic_outlook: string;
}

export interface ScoutMetadata {
  search_timestamp: string;
  model_used: string;
  search_queries_used: string[];
  total_sources_found: number;
  processing_time_ms: number;
}

export interface NewsScoutResult {
  geography_id: string;
  geography_type: string;
  geography_name: string;
  state: string;
  local_news: LocalNewsItem[];
  economic_indicators: EconomicIndicator[];
  market_signals: MarketSignal[];
  national_context: NationalContext | null;
  scout_metadata: ScoutMetadata;
}

export interface SignalSummary {
  overall: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  high_confidence_signals: MarketSignal[];
}

// Category groupings for filtering
export const CATEGORY_GROUPS = {
  employer: [
    'employer_expansion',
    'employer_hiring',
    'employer_layoffs',
    'employer_relocation',
    'employer_new_facility',
  ],
  development: [
    'development_residential',
    'development_commercial',
    'development_industrial',
  ],
  policy: [
    'policy_zoning',
    'policy_taxes',
    'policy_housing',
    'policy_short_term',
  ],
  infrastructure: [
    'infrastructure_transit',
    'infrastructure_roads',
    'infrastructure_utilities',
    'infrastructure_airport',
  ],
  climate: ['climate_disaster', 'climate_risk', 'climate_insurance'],
  community: [
    'crime_trends',
    'education_schools',
    'education_university',
    'healthcare',
  ],
  market: [
    'market_report',
    'market_investment',
    'demographic_migration',
    'demographic_growth',
  ],
} as const;
