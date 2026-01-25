/**
 * Beta Feedback System Types
 */

export type FeedbackCategory = 
  | 'bug' 
  | 'workflow' 
  | 'ux_ui' 
  | 'feature_request' 
  | 'performance' 
  | 'other';

export type FeedbackSeverity = 'critical' | 'high' | 'medium' | 'low';

export type FeedbackStatus = 
  | 'submitted' 
  | 'triaged' 
  | 'in_progress' 
  | 'fixed' 
  | 'deployed' 
  | 'wont_fix' 
  | 'duplicate';

export interface Attachment {
  url: string;
  filename: string;
  type: string;
  size: number;
}

export interface BetaTester {
  id: string;
  token: string;
  name: string;
  email?: string;
  is_active: boolean;
  created_at: string;
}

export interface BetaFeedback {
  id: string;
  tester_id: string;
  category: FeedbackCategory;
  severity?: FeedbackSeverity;
  title: string;
  description: string;
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  page_url?: string;
  affected_component?: string;
  browser_info?: Record<string, string>;
  attachments: Attachment[];
  status: FeedbackStatus;
  admin_notes?: string;
  fix_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface FeedbackFormData {
  category: FeedbackCategory;
  severity?: FeedbackSeverity;
  title: string;
  description: string;
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  page_url?: string;
  affected_component?: string;
}

export interface FeedbackWithTester extends BetaFeedback {
  tester?: {
    name: string;
    email?: string;
  };
}

// Category display configuration
export const CATEGORY_CONFIG: Record<FeedbackCategory, { label: string; icon: string; color: string }> = {
  bug: { label: 'Bug', icon: '🐛', color: 'bg-red-100 text-red-800' },
  workflow: { label: 'Workflow', icon: '🔄', color: 'bg-blue-100 text-blue-800' },
  ux_ui: { label: 'UX/UI', icon: '🎨', color: 'bg-purple-100 text-purple-800' },
  feature_request: { label: 'Feature Request', icon: '💡', color: 'bg-green-100 text-green-800' },
  performance: { label: 'Performance', icon: '⚡', color: 'bg-yellow-100 text-yellow-800' },
  other: { label: 'Other', icon: '📝', color: 'bg-gray-100 text-gray-800' },
};

// Severity display configuration
export const SEVERITY_CONFIG: Record<FeedbackSeverity, { label: string; color: string }> = {
  critical: { label: 'Critical', color: 'bg-red-500 text-white' },
  high: { label: 'High', color: 'bg-orange-500 text-white' },
  medium: { label: 'Medium', color: 'bg-yellow-500 text-black' },
  low: { label: 'Low', color: 'bg-green-500 text-white' },
};

// Status display configuration
export const STATUS_CONFIG: Record<FeedbackStatus, { label: string; color: string; testerLabel: string }> = {
  submitted: { label: 'Submitted', color: 'bg-gray-100 text-gray-800', testerLabel: 'Submitted' },
  triaged: { label: 'Triaged', color: 'bg-blue-100 text-blue-800', testerLabel: 'Under Review' },
  in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-800', testerLabel: 'Being Worked On' },
  fixed: { label: 'Fixed', color: 'bg-green-100 text-green-800', testerLabel: 'Fixed' },
  deployed: { label: 'Deployed', color: 'bg-emerald-100 text-emerald-800', testerLabel: 'Released' },
  wont_fix: { label: "Won't Fix", color: 'bg-slate-100 text-slate-800', testerLabel: 'Closed' },
  duplicate: { label: 'Duplicate', color: 'bg-slate-100 text-slate-800', testerLabel: 'Closed' },
};
