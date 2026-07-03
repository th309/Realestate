/**
 * Grandfathering Types
 *
 * Shared interfaces for the grandfathering service, policy engine, and helpers.
 */

export interface GrandfatheredRecord {
  id: string;
  user_id: string;
  grandfathered_type: 'tier' | 'feature' | 'pricing';
  original_price_monthly?: number;
  original_price_yearly?: number;
  original_tier_slug?: string;
  original_tier_snapshot?: Record<string, unknown>;
  feature_id?: string;
  feature_slug?: string;
  original_feature_value?: unknown;
  reason: string;
  notes?: string;
  grandfathered_at: string;
  effective_from: string;
  expires_at?: string;
  granted_by?: string;
  grant_source?: string;
  is_active: boolean;
  revoked_at?: string;
  revoked_by?: string;
  revoke_reason?: string;
}

export interface GrandfatherPolicy {
  id: string;
  name: string;
  description?: string;
  trigger_type: 'tier_change' | 'price_increase' | 'feature_removal' | 'manual';
  trigger_condition: {
    from_tier?: string;
    to_tier?: string;
    price_increase_threshold?: number;
    feature_slugs?: string[];
  };
  grandfather_type: 'tier' | 'feature' | 'pricing';
  grandfather_config?: {
    preserve_features?: string[];
    preserve_pricing?: boolean;
    preserve_tier_snapshot?: boolean;
  };
  duration_type: 'permanent' | 'months' | 'until_date';
  duration_months?: number;
  is_active: boolean;
  priority: number;
}

export interface CreateGrandfatherDto {
  user_id: string;
  grandfathered_type: 'tier' | 'feature' | 'pricing';
  original_price_monthly?: number;
  original_price_yearly?: number;
  original_tier_slug?: string;
  original_tier_snapshot?: Record<string, unknown>;
  feature_slug?: string;
  original_feature_value?: unknown;
  reason: string;
  notes?: string;
  expires_at?: string;
  granted_by?: string;
  grant_source?: string;
}
