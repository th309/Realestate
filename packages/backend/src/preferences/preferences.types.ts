/**
 * User Preferences Types
 *
 * Types matching the `user_preferences` database table schema.
 * Used by PreferencesService for CRUD operations and by
 * InsightsService for archetype-based AI personalization.
 */

export type UserGoal =
  | 'first_time_buyer'
  | 'relocating'
  | 'investor_rental'
  | 'investor_flip'
  | 'exploring';

export type Timeline =
  | 'under_6_months'
  | '6_to_12_months'
  | '1_to_2_years'
  | 'researching';

/**
 * Per-user defaults for the deal analyzer form. Stored as JSONB in
 * `user_preferences.analyzer_defaults`. All fields optional; consumers fall
 * back to the analyzer's built-in defaults when a key is missing.
 *
 * Units: all *Pct fields are decimals (0.05 = 5%). holdYears is an integer.
 */
export interface AnalyzerDefaults {
  vacancyPct?: number;
  maintenancePct?: number;
  capexPct?: number;
  pmPct?: number;
  rentGrowthPct?: number;
  appreciationPct?: number;
  holdYears?: number;
  closingCostsPct?: number;
  marginalTaxRatePct?: number;
  landValueSharePct?: number;
  expenseGrowthPct?: number;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  goal: UserGoal | null;
  priorities: string[];
  budget_min: number | null;
  budget_max: number | null;
  location_preferences: string[];
  timeline: Timeline | null;
  archetype_id: string | null;
  quiz_completed_at: string | null;
  analyzer_defaults: AnalyzerDefaults | null;
  created_at: string;
  updated_at: string;
}
