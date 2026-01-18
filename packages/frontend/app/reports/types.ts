// ============================================================================
// PROPERTYIQ REPORTS SYSTEM - TYPESCRIPT TYPES
// ============================================================================

// -----------------------------------------------------------------------------
// GEOGRAPHY
// -----------------------------------------------------------------------------

export type GeographyType = 'metro' | 'county' | 'zip';

export interface Geography {
  id: string;
  type: GeographyType;
  name: string;
  state?: string;
  parent_id?: string;
}

// -----------------------------------------------------------------------------
// SUBSCRIPTION TIERS
// -----------------------------------------------------------------------------

export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'enterprise';

export interface TierLimits {
  reports_per_month: number;
  report_types: string[];
  conversation_exchanges: number;
  conversation_persistence_days: number | null;
  multi_report_memory: boolean;
  score_component_breakdown: boolean;
  pdf_export: boolean;
  csv_export: boolean;
  white_label: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    reports_per_month: 2,
    report_types: ['snapshot'],
    conversation_exchanges: 3,
    conversation_persistence_days: null,
    multi_report_memory: false,
    score_component_breakdown: false,
    pdf_export: false,
    csv_export: false,
    white_label: false,
  },
  basic: {
    reports_per_month: 10,
    report_types: ['snapshot', 'comparison', 'investment', 'affordability'],
    conversation_exchanges: 15,
    conversation_persistence_days: 30,
    multi_report_memory: false,
    score_component_breakdown: false,
    pdf_export: true,
    csv_export: false,
    white_label: false,
  },
  pro: {
    reports_per_month: Infinity,
    report_types: ['snapshot', 'comparison', 'investment', 'affordability', 'cycle'],
    conversation_exchanges: Infinity,
    conversation_persistence_days: null,
    multi_report_memory: true,
    score_component_breakdown: true,
    pdf_export: true,
    csv_export: true,
    white_label: false,
  },
  enterprise: {
    reports_per_month: Infinity,
    report_types: ['snapshot', 'comparison', 'investment', 'affordability', 'cycle', 'custom'],
    conversation_exchanges: Infinity,
    conversation_persistence_days: null,
    multi_report_memory: true,
    score_component_breakdown: true,
    pdf_export: true,
    csv_export: true,
    white_label: true,
  },
};

// -----------------------------------------------------------------------------
// USER TYPE
// -----------------------------------------------------------------------------

export type UserType = 'homebuyer' | 'investor';

// -----------------------------------------------------------------------------
// REPORT TEMPLATES
// -----------------------------------------------------------------------------

export type ReportType = 'snapshot' | 'comparison' | 'investment' | 'affordability' | 'cycle';

export interface ReportTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  version: number;
  tier_required: SubscriptionTier;
  is_active: boolean;
  is_public: boolean;
  config: ReportTemplateConfig;
  organization_id: string | null;
  base_template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportTemplateConfig {
  report_type: ReportType;
  supported_geography_types: GeographyType[];
  comparison?: {
    min_geographies: number;
    max_geographies: number;
  };
  user_inputs: UserInputField[];
  pages: ReportPage[];
  ai_config: AIConfig;
  data_requirements: DataRequirements;
}

// -----------------------------------------------------------------------------
// USER INPUTS
// -----------------------------------------------------------------------------

export interface UserInputField {
  field_name: string;
  label: string;
  type: 'number' | 'select' | 'range' | 'boolean' | 'text';
  required?: boolean;
  placeholder?: string;
  default?: any;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

// -----------------------------------------------------------------------------
// REPORT PAGES & SECTIONS
// -----------------------------------------------------------------------------

export interface ReportPage {
  id: string;
  name: string;
  layout?: 'cover' | 'dashboard' | 'comparison' | 'analysis' | 'narrative' | 'charts' | 'scenarios' | 'pro_forma';
  show_if_inputs?: string[];
  sections: ReportSection[];
}

export type SectionType =
  | 'report_title'
  | 'report_metadata'
  | 'score_gauge_single'
  | 'score_gauge_dual'
  | 'metric_grid'
  | 'metric_detail'
  | 'metric_highlight'
  | 'metric_comparison'
  | 'chart_single'
  | 'chart_grid'
  | 'comparison_chart_grid'
  | 'comparison_table'
  | 'comparison_radar'
  | 'comparison_header'
  | 'ai_narrative'
  | 'market_verdict_bar'
  | 'winner_badges'
  | 'pros_cons_table'
  | 'strengths_risks'
  | 'score_breakdown'
  | 'investment_verdict'
  | 'fact_box'
  | 'ranked_list'
  | 'indicator_dashboard'
  | 'indicator_deep_dive'
  | 'indicator_summary_table'
  | 'stress_indicator'
  | 'stress_summary'
  | 'cycle_indicator'
  | 'cycle_diagram'
  | 'percentile_bands'
  | 'percentile_rank'
  | 'scenario_card'
  | 'scenario_chart'
  | 'forecast_display'
  | 'affordability_gap_visual'
  | 'savings_calculator'
  | 'personal_affordability'
  | 'budget_breakdown'
  | 'savings_timeline'
  | 'alternative_areas'
  | 'migration_sankey'
  | 'pro_forma_assumptions'
  | 'pro_forma_cash_flow'
  | 'pro_forma_returns'
  | 'pro_forma_sensitivity'
  | 'text_block'
  | 'status_badge';

export interface ReportSection {
  id: string;
  type: SectionType;
  config: Record<string, any>;
}

// -----------------------------------------------------------------------------
// AI CONFIGURATION
// -----------------------------------------------------------------------------

export interface AIConfig {
  narrative_sections: NarrativeSection[];
  conversation_starter: string;
  initial_questions: string[];
}

export interface NarrativeSection {
  id: string;
  name?: string;
  prompt_template: string;
  max_tokens: number;
  output_format?: 'text' | 'json_array' | 'json_object';
}

// -----------------------------------------------------------------------------
// DATA REQUIREMENTS
// -----------------------------------------------------------------------------

export interface DataRequirements {
  current_metrics: string[];
  historical_metrics: { metric: string; periods: number }[];
  benchmarks: ('national' | 'state' | 'similar_metros')[];
  scores: ('homeready' | 'investoredge')[];
  score_components?: boolean;
  demographics?: string[];
  migration?: {
    include: boolean;
    top_origins?: number;
    top_destinations?: number;
  };
  historical_extremes?: {
    include: boolean;
    metrics?: string[];
    periods?: number;
  };
  cycle_data?: {
    include: boolean;
    historical_peaks_troughs?: boolean;
  };
  include_news?: boolean;
  news_categories?: string[];
  news_limit?: number;
  include_comparables?: boolean;
  comparable_count?: number;
}

// -----------------------------------------------------------------------------
// REPORT INSTANCES
// -----------------------------------------------------------------------------

export type ReportStatus = 'pending' | 'generating' | 'ready' | 'failed' | 'expired';

export interface ReportInstance {
  id: string;
  template_id: string;
  template_version: number;
  user_id: string;
  organization_id: string | null;
  user_type: UserType;
  title: string;

  // Geography
  primary_geography_id: string;
  primary_geography_type: GeographyType;
  primary_geography_name: string;
  comparison_geographies: Geography[] | null;

  // User inputs
  user_inputs: Record<string, any>;

  // Populated data
  populated_data: PopulatedReportData | null;
  ai_narratives: Record<string, string | string[] | Record<string, any>> | null;

  // Scores
  homeready_score: number | null;
  investoredge_score: number | null;

  // Status
  status: ReportStatus;
  error_message: string | null;
  data_as_of_date: string | null;
  confidence_level: 'high' | 'medium' | 'low' | null;
  generation_time_ms: number | null;

  // Sharing
  share_token: string | null;
  share_access_level: 'view' | 'download';
  share_view_count: number;

  // Timestamps
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  last_viewed_at: string | null;
}

export interface PopulatedReportData {
  current: Record<string, number | string | null>;
  historical: Record<string, TimeSeriesPoint[]>;
  benchmarks: {
    national?: Record<string, number>;
    state?: Record<string, number>;
    similar_metros?: Record<string, Record<string, number>>;
  };
  scores: {
    homeready?: ScoreData;
    investoredge?: ScoreData;
  };
  demographics?: Record<string, any>;
  migration?: {
    net_migration: number;
    origins: { geography: Geography; count: number }[];
    destinations: { geography: Geography; count: number }[];
    trend: number[];
  };
  comparables?: {
    geography: Geography;
    metrics: Record<string, number>;
    scores: Record<string, number>;
  }[];
  news?: NewsItem[];
  cycle?: {
    position: 'early_recovery' | 'expansion' | 'hyper_supply' | 'recession';
    historical_peak: { date: string; value: number };
    historical_trough: { date: string; value: number };
  };
  pro_forma?: ProFormaData;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface ScoreData {
  score: number;
  trend: 'up' | 'down' | 'stable';
  components?: Record<string, {
    score: number;
    weight: number;
    helping: boolean;
  }>;
  percentile?: number;
}

export interface NewsItem {
  headline: string;
  summary: string;
  source: string;
  url: string;
  published_at: string;
  category: string;
  relevance_score: number;
}

export interface ProFormaData {
  assumptions: {
    purchase_price: number;
    down_payment: number;
    down_payment_pct: number;
    loan_amount: number;
    interest_rate: number;
    loan_term_years: number;
    expected_rent: number;
    vacancy_pct: number;
    management_pct: number;
    maintenance_pct: number;
    property_tax_annual: number;
    insurance_annual: number;
  };
  monthly_cash_flow: {
    gross_rent: number;
    vacancy: number;
    management: number;
    maintenance: number;
    net_operating_income: number;
    mortgage_pi: number;
    property_tax: number;
    insurance: number;
    net_cash_flow: number;
  };
  returns: {
    cash_on_cash: number;
    cap_rate: number;
    total_return_with_appreciation: number;
  };
  sensitivity: {
    rent_scenarios: { rent_change_pct: number; cash_flow: number }[];
    rate_scenarios: { rate: number; cash_flow: number }[];
  };
}

// -----------------------------------------------------------------------------
// CONVERSATIONS
// -----------------------------------------------------------------------------

export interface ReportConversation {
  id: string;
  report_id: string;
  user_id: string;
  messages: ConversationMessage[];
  user_profile: ConversationUserProfile;
  exchange_count: number;
  status: 'active' | 'archived' | 'exported';
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ConversationUserProfile {
  buyer_type?: 'first_time' | 'experienced' | 'investor';
  goal?: 'buy' | 'rent' | 'invest' | 'relocate';
  timeline?: 'immediate' | '6_months' | '1_year' | 'exploring';
  budget_range?: { min: number; max: number };
  priorities?: string[];
  concerns?: string[];
  investment_goal?: 'cash_flow' | 'appreciation' | 'balanced';
  hold_period?: string;
}

// -----------------------------------------------------------------------------
// API REQUEST/RESPONSE TYPES
// -----------------------------------------------------------------------------

export interface GenerateReportRequest {
  template_slug: string;
  user_type: UserType;
  primary_geography: Geography;
  comparison_geographies?: Geography[];
  user_inputs?: Record<string, any>;
}

export interface GenerateReportResponse {
  report_id: string;
  status: 'generating';
}

export interface SendMessageRequest {
  content: string;
}

export interface SendMessageResponse {
  response: string;
  exchange_count: number;
  limit_reached: boolean;
  suggested_questions?: string[];
}

export interface ReportListItem {
  id: string;
  title: string;
  template_slug: string;
  template_name: string;
  template_icon: string;
  user_type: UserType;
  primary_geography_name: string;
  primary_geography_type: GeographyType;
  homeready_score: number | null;
  investoredge_score: number | null;
  status: ReportStatus;
  data_as_of_date: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// WIZARD STATE
// -----------------------------------------------------------------------------

export interface WizardState {
  step: number;
  userType: UserType;
  selectedTemplate: ReportTemplate | null;
  geoLevel: GeographyType;
  primaryGeography: Geography | null;
  comparisonGeographies: Geography[];
  userInputs: Record<string, any>;
}
