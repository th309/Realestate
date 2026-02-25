/**
 * Types for AI Marketing Insights persistence and recommendation execution.
 *
 * SavedInsight: Full persisted insight report with parsed recommendations.
 * ImplementationPlan: AI-generated execution plan for a recommendation.
 */

export type RecommendationStatus = 'pending' | 'implemented' | 'dismissed';
export type ActionType = 'db_change' | 'code_change' | 'manual';
export type AiProvider = 'deepseek' | 'claude';

export interface SavedRecommendation {
  id: string;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  title: string;
  content: string;
  action_type: ActionType;
  status: RecommendationStatus;
}

export interface SavedInsight {
  id: string;
  user_id: string;
  title: string;
  markdown_content: string;
  recommendations: SavedRecommendation[];
  provider: AiProvider;
  days_analyzed: number;
  chat_history: Array<{ role: string; content: string }>;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

/** Summary-only projection for list views (no full markdown). */
export interface SavedInsightSummary {
  id: string;
  title: string;
  provider: AiProvider;
  days_analyzed: number;
  is_pinned: boolean;
  recommendation_count: number;
  implemented_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateInsightDto {
  title: string;
  markdown_content: string;
  recommendations: SavedRecommendation[];
  provider: AiProvider;
  days_analyzed: number;
  chat_history?: Array<{ role: string; content: string }>;
}

export interface UpdateInsightDto {
  title?: string;
  is_pinned?: boolean;
}

export interface UpdateRecommendationStatusDto {
  status: RecommendationStatus;
}

// --- Implementation Plan types ---

export interface DbChangeOperation {
  entity: string;
  field: string;
  current_value: unknown;
  new_value: unknown;
  tier_slug?: string;
  feature_slug?: string;
}

export interface CodeChangeFile {
  file_path: string;
  description: string;
  code: string;
  language: string;
}

export interface ManualStep {
  step_number: number;
  description: string;
  effort_estimate?: string;
}

export interface ImplementationPlan {
  action_type: ActionType;
  summary: string;
  risk_level: 'low' | 'medium' | 'high';
  /** For db_change plans */
  db_operations?: DbChangeOperation[];
  /** For code_change plans */
  code_files?: CodeChangeFile[];
  /** For manual plans */
  manual_steps?: ManualStep[];
}
