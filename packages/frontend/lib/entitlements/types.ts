// packages/frontend/lib/entitlements/types.ts

export type UserTier = 'free' | 'pro' | 'enterprise' | 'admin';

export type ResourceType = 'metric' | 'geo' | 'feature';

export type AccessLevel = 'full' | 'preview' | 'none';

export interface AccessInfo {
  level: AccessLevel;
  limit?: number;
  tierRequired?: UserTier;
}

export interface TrialInfo {
  active: boolean;
  daysRemaining?: number;
  tier?: UserTier;
}

export interface EntitlementsState {
  tier: UserTier;
  access: Record<string, AccessInfo>;
  trial: TrialInfo | null;
  loading: boolean;
  error: string | null;
}

export interface EntitlementsContextValue extends EntitlementsState {
  // Access checks
  canAccess: (type: ResourceType, id: string) => boolean;
  getAccess: (type: ResourceType, id: string) => AccessInfo;
  getPreviewLimit: (type: ResourceType, id: string) => number | null;
  getTierRequired: (type: ResourceType, id: string) => UserTier | null;
  isMetricGated: (metricId: string) => boolean;

  // Event tracking
  trackPaywallView: (type: ResourceType, id: string, pagePath?: string) => void;
  trackUpgradeClick: (type: ResourceType, id: string, pagePath?: string) => void;
  trackDismiss: (type: ResourceType, id: string) => void;

  // Simulation (dev mode)
  simulatedTier: UserTier | null;
  setSimulatedTier: (tier: UserTier | null) => void;
  simulatedAuth: boolean | null;
  setSimulatedAuth: (auth: boolean | null) => void;
  resetSimulation: () => void;

  // Refresh
  refresh: () => Promise<void>;

  // Usage tracking (for preview limits)
  getUsage: (featureSlug: string) => FeatureUsage | null;
  incrementUsage: (featureSlug: string) => Promise<boolean>;
}

export interface FeatureUsage {
  feature_slug: string;
  usage_count: number;
  limit: number; // -1 = unlimited
  remaining: number; // -1 = unlimited, 0 = at limit
}
