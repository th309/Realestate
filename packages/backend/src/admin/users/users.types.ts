import { UserOverride } from '../features/user-features.service';

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  tier: string;
  tierStatus: string;
  createdAt: string;
  lastActive: string;
  // Trial
  trialActive: boolean;
  trialExpiresAt?: string;
  trialTier?: string;
  // Grandfathering
  grandfathered: boolean;
  grandfatheredType?: string;
  grandfatheredReason?: string;
  // Organization
  organizationId?: string;
  organizationName?: string;
  organizationRole?: string;
  // Stripe
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  // Beta
  isBetaTester: boolean;
  betaTesterId?: string;
  // Usage
  overrideCount: number;
  paywallHits: number;
  reportsGenerated: number;
  savedQueriesCount: number;
  watchlistCount: number;
  alertsCount: number;
}

export interface UserDetail extends UserListItem {
  overrides: UserOverride[];
  grandfatheringDetails?: {
    originalPrice?: number;
    originalTier?: string;
    effectiveFrom?: string;
    expiresAt?: string;
  };
}

export interface UserStats {
  totalUsers: number;
  withOverrides: number;
  activeTrials: number;
  grandfathered: number;
  betaTesters: number;
  inOrganizations: number;
  withStripe: number;
  byTier: Record<string, number>;
}
