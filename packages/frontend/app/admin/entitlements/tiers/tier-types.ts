/** Shared types and constants for the tier configuration page. */

export const CATEGORY_LABELS: Record<string, string> = {
  scores: "PIQ Components",
  metrics: "Metrics",
  geography: "Geography",
  preview: "Preview Limits",
  features: "Features",
};

export function categoryLabel(slug: string): string {
  return CATEGORY_LABELS[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
}

export const TIER_STYLES: Record<
  string,
  { bg: string; border: string; text: string; chip: string; header: string }
> = {
  free: {
    bg: "bg-gray-50",
    border: "border-gray-300",
    text: "text-gray-700",
    chip: "bg-gray-100 text-gray-700 border-gray-300",
    header: "bg-gray-100",
  },
  pro: {
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-700",
    chip: "bg-blue-100 text-blue-700 border-blue-300",
    header: "bg-blue-100",
  },
  enterprise: {
    bg: "bg-indigo-50",
    border: "border-indigo-300",
    text: "text-indigo-700",
    chip: "bg-indigo-100 text-indigo-700 border-indigo-300",
    header: "bg-indigo-100",
  },
};

export interface FeatureDefinition {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  value_type: string;
  is_active: boolean;
  is_enforced: boolean;
}

export interface TierData {
  id: string;
  slug: string;
  name: string;
  values: Record<string, unknown>;
}

export interface FeatureMatrix {
  features: FeatureDefinition[];
  tiers: TierData[];
}

export type FeatureAssignments = Record<string, string>; // feature_id -> tier_slug
